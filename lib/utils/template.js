"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateReplacers = exports.template = void 0;
const regex_parser_1 = __importDefault(require("regex-parser"));
/**
 * replaces all uppercase dollar templates with their string representation from obj
 * if replacement is undefined in obj the dollar template string is left untouched
 */
const regexEscape = (string) => string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const template = (string, obj, customReplacers) => {
    let str = string.replace(/(\$[A-Z_]+)/g, (match, key) => {
        if (obj[key] === undefined || obj[key] === null) {
            return key;
        }
        else if (typeof obj[key] === 'object') {
            return exports.template(obj[key].template, obj[key]);
        }
        return `${obj[key]}`;
    });
    if (customReplacers) {
        customReplacers.forEach(({ search, replace }) => {
            str = str.replace(search, replace);
        });
    }
    return str;
};
exports.template = template;
const toRegex = (search) => {
    if (search.match(/^\/.+\/[gmixXsuUAJ]*$/)) {
        return regex_parser_1.default(search);
    }
    // plain string
    return new RegExp(regexEscape(search), 'g');
};
const validateReplacers = (logger, replacers) => replacers.map(replacer => {
    try {
        return Object.assign(Object.assign({}, replacer), { search: toRegex(replacer.search) });
    }
    catch (error) {
        /* istanbul ignore next */
        logger.error('Bad replacer regex: %s', replacer.search);
        /* istanbul ignore next */
        return { search: '', replace: '', invalid: true };
    }
}).filter(item => !item.invalid);
exports.validateReplacers = validateReplacers;
