/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import * as colorSpaces from '../util/color_spaces';
import Color from '../util/color';
import extend from '../util/extend';
import getType from '../util/get_type';
import * as interpolate from '../util/interpolate';
import Interpolate from '../expression/definitions/interpolate';
import Formatted from '../expression/types/formatted';
import ResolvedImage from '../expression/types/resolved_image';
import {supportsInterpolation} from '../util/properties';
import {findStopLessThanOrEqualTo} from '../expression/stops';

export function isFunction(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function identityFunction(x) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return x;
}

export function createFunction(parameters, propertySpec) {
    const isColor = propertySpec.type === 'color';
    const zoomAndFeatureDependent = parameters.stops && typeof parameters.stops[0][0] === 'object';
    const featureDependent = zoomAndFeatureDependent || parameters.property !== undefined;
    const zoomDependent = zoomAndFeatureDependent || !featureDependent;
    const type = parameters.type || (supportsInterpolation(propertySpec) ? 'exponential' : 'interval');

    if (isColor) {
        parameters = extend({}, parameters);

        if (parameters.stops) {
            parameters.stops = parameters.stops.map((stop) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return [stop[0], Color.parse(stop[1])];
            });
        }

        if (parameters.default) {
            parameters.default = Color.parse(parameters.default);
        } else {
            parameters.default = Color.parse(propertySpec.default);
        }
    }

    if (parameters.colorSpace && parameters.colorSpace !== 'rgb' && !colorSpaces[parameters.colorSpace]) {
        throw new Error(`Unknown color space: ${parameters.colorSpace}`);
    }

    let innerFun;
    let hashedStops;
    let categoricalKeyType;
    if (type === 'exponential') {
        innerFun = evaluateExponentialFunction;
    } else if (type === 'interval') {
        innerFun = evaluateIntervalFunction;
    } else if (type === 'categorical') {
        innerFun = evaluateCategoricalFunction;

        // For categorical functions, generate an Object as a hashmap of the stops for fast searching
        hashedStops = Object.create(null);
        for (const stop of parameters.stops) {
            hashedStops[stop[0]] = stop[1];
        }

        // Infer key type based on first stop key-- used to encforce strict type checking later
        categoricalKeyType = typeof parameters.stops[0][0];

    } else if (type === 'identity') {
        innerFun = evaluateIdentityFunction;
    } else {
        throw new Error(`Unknown function type "${type}"`);
    }

    if (zoomAndFeatureDependent) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const featureFunctions: Record<string, any> = {};
        const zoomStops = [];
        for (let s = 0; s < parameters.stops.length; s++) {
            const stop = parameters.stops[s];
            const zoom = stop[0].zoom;
            if (featureFunctions[zoom] === undefined) {
                featureFunctions[zoom] = {
                    zoom,
                    type: parameters.type,
                    property: parameters.property,
                    default: parameters.default,
                    stops: []
                };
                zoomStops.push(zoom);
            }
            featureFunctions[zoom].stops.push([stop[0].value, stop[1]]);
        }

        const featureFunctionStops = [];
        for (const z of zoomStops) {
            featureFunctionStops.push([featureFunctions[z].zoom, createFunction(featureFunctions[z], propertySpec)]);
        }

        const interpolationType = {name: 'linear'};
        return {
            kind: 'composite',
            interpolationType,
            interpolationFactor: Interpolate.interpolationFactor.bind(undefined, interpolationType),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            zoomStops: featureFunctionStops.map(s => s[0]),
            evaluate({zoom}, properties) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return evaluateExponentialFunction({
                    stops: featureFunctionStops,
                    base: parameters.base
                }, propertySpec, zoom).evaluate(zoom, properties);
            }
        };
    } else if (zoomDependent) {
        const interpolationType = type === 'exponential' ?
            {name: 'exponential', base: parameters.base !== undefined ? parameters.base : 1} : null;
        return {
            kind: 'camera',
            interpolationType,
            interpolationFactor: Interpolate.interpolationFactor.bind(undefined, interpolationType),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            zoomStops: parameters.stops.map(s => s[0]),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            evaluate: ({zoom}) => innerFun(parameters, propertySpec, zoom, hashedStops, categoricalKeyType)
        };
    } else {
        return {
            kind: 'source',
            evaluate(_, feature) {
                const value = feature && feature.properties ? feature.properties[parameters.property] : undefined;
                if (value === undefined) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                    return coalesce(parameters.default, propertySpec.default);
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return innerFun(parameters, propertySpec, value, hashedStops, categoricalKeyType);
            }
        };
    }
}

function coalesce(a, b, c) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (a !== undefined) return a;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (b !== undefined) return b;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (c !== undefined) return c;
}

function evaluateCategoricalFunction(parameters, propertySpec, input, hashedStops, keyType) {
    const evaluated = typeof input === keyType ? hashedStops[input] : undefined; // Enforce strict typing on input
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return coalesce(evaluated, parameters.default, propertySpec.default);
}

function evaluateIntervalFunction(parameters, propertySpec, input) {
    // Edge cases
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (getType(input) !== 'number') return coalesce(parameters.default, propertySpec.default);
    const n = parameters.stops.length;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (n === 1) return parameters.stops[0][1];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (input <= parameters.stops[0][0]) return parameters.stops[0][1];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (input >= parameters.stops[n - 1][0]) return parameters.stops[n - 1][1];

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const index = findStopLessThanOrEqualTo(parameters.stops.map((stop) => stop[0]), input);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return parameters.stops[index][1];
}

function evaluateExponentialFunction(parameters, propertySpec, input) {
    const base = parameters.base !== undefined ? parameters.base : 1;

    // Edge cases
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (getType(input) !== 'number') return coalesce(parameters.default, propertySpec.default);
    const n = parameters.stops.length;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (n === 1) return parameters.stops[0][1];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (input <= parameters.stops[0][0]) return parameters.stops[0][1];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (input >= parameters.stops[n - 1][0]) return parameters.stops[n - 1][1];

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const index = findStopLessThanOrEqualTo(parameters.stops.map((stop) => stop[0]), input);
    const t = interpolationFactor(
        input, base,
        parameters.stops[index][0],
        parameters.stops[index + 1][0]);

    const outputLower = parameters.stops[index][1];
    const outputUpper = parameters.stops[index + 1][1];
    let interp = interpolate[propertySpec.type] || identityFunction;

    if (parameters.colorSpace && parameters.colorSpace !== 'rgb') {
        const colorspace = colorSpaces[parameters.colorSpace];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        interp = (a, b) => colorspace.reverse(colorspace.interpolate(colorspace.forward(a), colorspace.forward(b), t));
    }

    if (typeof outputLower.evaluate === 'function') {
        return {
            evaluate(...args) {
                const evaluatedLower = outputLower.evaluate.apply(undefined, args);
                const evaluatedUpper = outputUpper.evaluate.apply(undefined, args);
                // Special case for fill-outline-color, which has no spec default.
                if (evaluatedLower === undefined || evaluatedUpper === undefined) {
                    return undefined;
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return interp(evaluatedLower, evaluatedUpper, t);
            }
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return interp(outputLower, outputUpper, t);
}

function evaluateIdentityFunction(parameters, propertySpec, input) {
    if (propertySpec.type === 'color') {
        input = Color.parse(input);
    } else if (propertySpec.type === 'formatted') {
        input = Formatted.fromString(input.toString());
    } else if (propertySpec.type === 'resolvedImage') {
        input = ResolvedImage.build(input.toString());
    } else if (getType(input) !== propertySpec.type && (propertySpec.type !== 'enum' || !propertySpec.values[input])) {
        input = undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return coalesce(input, parameters.default, propertySpec.default);
}

/**
 * Returns a ratio that can be used to interpolate between exponential function
 * stops.
 *
 * How it works:
 * Two consecutive stop values define a (scaled and shifted) exponential
 * function `f(x) = a * base^x + b`, where `base` is the user-specified base,
 * and `a` and `b` are constants affording sufficient degrees of freedom to fit
 * the function to the given stops.
 *
 * Here's a bit of algebra that lets us compute `f(x)` directly from the stop
 * values without explicitly solving for `a` and `b`:
 *
 * First stop value: `f(x0) = y0 = a * base^x0 + b`
 * Second stop value: `f(x1) = y1 = a * base^x1 + b`
 * => `y1 - y0 = a(base^x1 - base^x0)`
 * => `a = (y1 - y0)/(base^x1 - base^x0)`
 *
 * Desired value: `f(x) = y = a * base^x + b`
 * => `f(x) = y0 + a * (base^x - base^x0)`
 *
 * From the above, we can replace the `a` in `a * (base^x - base^x0)` and do a
 * little algebra:
 * ```
 * a * (base^x - base^x0) = (y1 - y0)/(base^x1 - base^x0) * (base^x - base^x0)
 *                     = (y1 - y0) * (base^x - base^x0) / (base^x1 - base^x0)
 * ```
 *
 * If we let `(base^x - base^x0) / (base^x1 base^x0)`, then we have
 * `f(x) = y0 + (y1 - y0) * ratio`.  In other words, `ratio` may be treated as
 * an interpolation factor between the two stops' output values.
 *
 * (Note: a slightly different form for `ratio`,
 * `(base^(x-x0) - 1) / (base^(x1-x0) - 1) `, is equivalent, but requires fewer
 * expensive `Math.pow()` operations.)
 *
 * @private
 */
function interpolationFactor(input, base, lowerValue, upperValue) {
    const difference = upperValue - lowerValue;
    const progress = input - lowerValue;

    if (difference === 0) {
        return 0;
    } else if (base === 1) {
        return progress / difference;
    } else {
        return (Math.pow(base, progress) - 1) / (Math.pow(base, difference) - 1);
    }
}
