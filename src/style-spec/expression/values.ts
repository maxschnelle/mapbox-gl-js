import assert from 'assert';
import Color from '../util/color';
import Collator from './types/collator';
import Formatted from './types/formatted';
import ResolvedImage from './types/resolved_image';
import {NullType, NumberType, StringType, BooleanType, ColorType, ObjectType, ValueType, CollatorType, FormattedType, ResolvedImageType, array} from './types';

import type {Type} from './types';

export function validateRGBA(r: unknown, g: unknown, b: unknown, a?: unknown): string | null {
    if (!(
        typeof r === 'number' && r >= 0 && r <= 255 &&
        typeof g === 'number' && g >= 0 && g <= 255 &&
        typeof b === 'number' && b >= 0 && b <= 255
    )) {
        const value = (typeof a === 'number' ? [r, g, b, a] : [r, g, b]) as number[];
        return `Invalid rgba value [${value.join(', ')}]: 'r', 'g', and 'b' must be between 0 and 255.`;
    }

    if (!(
        typeof a === 'undefined' || (typeof a === 'number' && a >= 0 && a <= 1)
    )) {
        return `Invalid rgba value [${([r, g, b, a] as number[]).join(', ')}]: 'a' must be between 0 and 1.`;
    }

    return null;
}

export function validateHSLA(h: unknown, s: unknown, l: unknown, a?: unknown): string | null {
    if (!(
        typeof h === 'number' && h >= 0 && h <= 360
    )) {
        const value = (typeof a === 'number' ? [h, s, l, a] : [h, s, l]) as number[];
        return `Invalid hsla value [${value.join(', ')}]: 'h' must be between 0 and 360.`;
    }

    if (!(
        typeof s === 'number' && s >= 0 && s <= 100 &&
        typeof l === 'number' && l >= 0 && l <= 100
    )) {
        const value = (typeof a === 'number' ? [h, s, l, a] : [h, s, l]) as number[];
        return `Invalid hsla value [${value.join(', ')}]: 's', and 'l' must be between 0 and 100.`;
    }

    if (!(
        typeof a === 'undefined' || (typeof a === 'number' && a >= 0 && a <= 1)
    )) {
        return `Invalid hsla value [${([h, s, l, a] as number[]).join(', ')}]: 'a' must be between 0 and 1.`;
    }

    return null;
}

export type Value = null | string | boolean | number | Color | Collator | Formatted | ResolvedImage | ReadonlyArray<Value> | {readonly [key: string]: Value};

export function isValue(mixed: unknown): boolean {
    if (mixed === null) {
        return true;
    } else if (typeof mixed === 'string') {
        return true;
    } else if (typeof mixed === 'boolean') {
        return true;
    } else if (typeof mixed === 'number') {
        return true;
    } else if (mixed instanceof Color) {
        return true;
    } else if (mixed instanceof Collator) {
        return true;
    } else if (mixed instanceof Formatted) {
        return true;
    } else if (mixed instanceof ResolvedImage) {
        return true;
    } else if (Array.isArray(mixed)) {
        for (const item of mixed) {
            if (!isValue(item)) {
                return false;
            }
        }
        return true;
    } else if (typeof mixed === 'object') {
        for (const key in mixed) {
            if (!isValue(mixed[key])) {
                return false;
            }
        }
        return true;
    } else {
        return false;
    }
}

export function typeOf(value: Value): Type {
    if (value === null) {
        return NullType;
    } else if (typeof value === 'string') {
        return StringType;
    } else if (typeof value === 'boolean') {
        return BooleanType;
    } else if (typeof value === 'number') {
        return NumberType;
    } else if (value instanceof Color) {
        return ColorType;
    } else if (value instanceof Collator) {
        return CollatorType;
    } else if (value instanceof Formatted) {
        return FormattedType;
    } else if (value instanceof ResolvedImage) {
        return ResolvedImageType;
    } else if (Array.isArray(value)) {
        const length = value.length;
        let itemType: Type;

        for (const item of value) {
            const t = typeOf(item);
            if (!itemType) {
                itemType = t;
            } else if (itemType === t) {
                continue;
            } else {
                itemType = ValueType;
                break;
            }
        }

        return array(itemType || ValueType, length);
    } else {
        assert(typeof value === 'object');
        return ObjectType;
    }
}

export function toString(value: Value): string {
    const type = typeof value;
    if (value === null) {
        return '';
    } else if (type === 'string' || type === 'number' || type === 'boolean') {
        return String(value as string | number | boolean);
    } else if (value instanceof Color) {
        return value.toStringPremultipliedAlpha();
    } else if (value instanceof Formatted || value instanceof ResolvedImage) {
        return value.toString();
    } else {
        return JSON.stringify(value);
    }
}

export {Color, Collator};
