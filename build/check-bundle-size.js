#!/usr/bin/env node

import {Octokit} from "@octokit/rest";
import prettyBytes from 'pretty-bytes';
import fs from 'fs';
import {execSync} from 'child_process';
import zlib from 'zlib';

process.on('unhandledRejection', (/** @type {Error} */ error) => {
    // don't log `error` directly, because errors from child_process.execSync
    // contain an (undocumented) `envPairs` with environment variable values
    console.log(error.message || 'Error');
    process.exit(1);
});

const FILES = [
    ['JS', "dist/mapbox-gl.js"],
    ['CSS', "dist/mapbox-gl.css"]
];
const PK = process.env['MBX_CI_DOMAIN'];
if (!PK) {
    console.log('Fork PR; not computing size.');
    process.exit(0);
}
const owner = 'mapbox';
const repo = 'mapbox-gl-js';

(async () => {
    // Initialize github client
    const github = new Octokit({
        auth: execSync('~/mbx-ci github notifier token').toString().trim()
    });

    //get current sizes
    /** @type {Array<[string, {size: number, gzipSize: number}]>} */
    const currentSizes = FILES.map(([label, filePath]) => [label, getSize(filePath)]);
    console.log(currentSizes);

    async function getMergeBase() {
        const head = process.env['CIRCLE_SHA1'];
        const pr = process.env['CIRCLE_PULL_REQUEST'];
        if (pr) {
            const number = +pr.match(/\/(\d+)\/?$/)[1];
            return github.pulls.get({
                owner,
                repo,
                // eslint-disable-next-line camelcase
                pull_number: number
            }).then(({data}) => {
                const base = data.base.ref;
                return execSync(`git merge-base origin/${base} ${head}`).toString().trim();
            });
        } else {
            // Walk backward through the history (maximum of 10 commits) until
            // finding a commit on either master or release-*; assume that's the
            // base branch.
            for (const sha of execSync(`git rev-list --max-count=10 ${head}`).toString().trim().split('\n')) {
                const base = execSync(`git branch -r --contains ${sha} origin/main origin/release-*`).toString().split('\n')[0].trim();
                if (base) {
                    return Promise.resolve(execSync(`git merge-base ${base} ${head}`).toString().trim());
                }
            }
        }

        return Promise.resolve(null);
    }

    async function getPriorSize(mergeBase, name) {
        if (!mergeBase) {
            console.log('No merge base available.');
            return Promise.resolve(null);
        }

        return github.checks.listForRef({
            owner,
            repo,
            ref: mergeBase
        }).then(({data}) => {
            const run = data.check_runs.find(run => run.name === name);
            if (run) {
                const match = run.output.summary.match(/`[^`]+` is (\d+) bytes \([^\)]+\) uncompressed, (\d+) bytes \([^\)]+\) gzipped\./);
                if (match) {
                    const prior = {size: +match[1], gzipSize: +match[2]};
                    console.log(`Prior size was ${prettyBytes(prior.size)}, gzipped ${prior.gzipSize}.`);
                    return prior;
                }
            }
            console.log('No matching check found.');
            return Promise.resolve(null);
        });
    }

    const mergeBase = await getMergeBase();

    // Generate a github check for each filetype
    // eslint-disable-next-line camelcase
    for (let check_idx = 0; check_idx < FILES.length; check_idx++) {
        // eslint-disable-next-line camelcase
        const [label, file] = FILES[check_idx];
        const name = `Size - ${label}`;
        /** @type {{size: number, gzipSize: number}} */
        // eslint-disable-next-line camelcase
        const size = currentSizes[check_idx][1];
        // eslint-disable-next-line no-await-in-loop
        const priorSize = await getPriorSize(mergeBase, name);
        console.log('priorSize: ', label, priorSize);

        const title = `${formatSize(size.size, priorSize ? priorSize.size : null)}, gzipped ${formatSize(size.gzipSize, priorSize ? priorSize.gzipSize : null)}`;

        const megabit = Math.pow(2, 12);
        const downloadTime3G = (size.gzipSize / (3 * megabit)).toFixed(0);
        const downloadTime4G = (size.gzipSize / (10 * megabit)).toFixed(0);
        const summary = `\`${file}\` is ${size.size} bytes (${prettyBytes(size.size)}) uncompressed, ${size.gzipSize} bytes (${prettyBytes(size.gzipSize)}) gzipped.
        That's **${downloadTime3G} seconds** over slow 3G (3 Mbps), **${downloadTime4G} seconds** over fast 4G (10 Mbps).`;
        console.log('Posting check to GitHub');
        console.log(`Title: ${title}`);
        console.log(`Summary: ${summary}`);

        // eslint-disable-next-line no-await-in-loop
        await github.checks.create({
            owner,
            repo,
            name,
            // eslint-disable-next-line camelcase
            head_branch: process.env['CIRCLE_BRANCH'],
            // eslint-disable-next-line camelcase
            head_sha: process.env['CIRCLE_SHA1'],
            status: 'completed',
            conclusion: 'success',
            // eslint-disable-next-line camelcase
            completed_at: new Date().toISOString(),
            output: {title, summary}
        });
    }
})();

function getSize(filePath) {
    const {size} = fs.statSync(filePath);
    const gzipSize = zlib.gzipSync(fs.readFileSync(filePath)).length;
    return {size, gzipSize};
}

function formatSize(size, priorSize) {
    if (priorSize) {
        const change = size - priorSize;
        const percent = (change / priorSize) * 100;
        return `${change >= 0 ? '+' : ''}${prettyBytes(change)} ${percent.toFixed(3)}% (${prettyBytes(size)})`;
    } else {
        return prettyBytes(size);
    }
}
