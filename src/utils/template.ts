import regexParser from 'regex-parser';
import {Logger} from '@technote-space/github-action-log-helper';

/**
 * replaces all uppercase dollar templates with their string representation from obj
 * if replacement is undefined in obj the dollar template string is left untouched
 */

const regexEscape = (string: string): string => string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const template = (string: string, obj: { [key: string]: any }, customReplacers?: Array<{ search: string | RegExp; replace: string }>): string => {
  let str = string.replace(/(\$[A-Z_]+)/g, (match, key) => {
    if (obj[key] === undefined || obj[key] === null) {
      return key;
    } else if (typeof obj[key] === 'object') {
      return template(obj[key].template, obj[key]);
    }
    return `${obj[key]}`;
  });
  if (customReplacers) {
    customReplacers.forEach(({search, replace}) => {
      str = str.replace(search, replace);
    });
  }
  return str;
};

const toRegex = (search: string): RegExp => {
  if (search.match(/^\/.+\/[gmixXsuUAJ]*$/)) {
    return regexParser(search);
  }
  // plain string
  return new RegExp(regexEscape(search), 'g');
};

export const validateReplacers = (logger: Logger, replacers: Array<{ search: string; replace: string }>): Array<{ search: RegExp | string; replace: string }> => replacers.map(replacer => {
  try {
    return {...replacer, search: toRegex(replacer.search)};
  } catch (error) {
    /* istanbul ignore next */
    logger.error('Bad replacer regex: %s', replacer.search);
    /* istanbul ignore next */
    return {search: '', replace: '', invalid: true};
  }
}).filter(item => !item.invalid);
