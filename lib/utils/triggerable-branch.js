"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTriggerableBranch = void 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const flatten = (arr) => {
    return Array.prototype.concat(...arr);
};
exports.isTriggerableBranch = (logger, context, branch, config) => {
    const validBranches = flatten([config.branches]);
    // eslint-disable-next-line no-magic-numbers
    const relevant = validBranches.indexOf(branch) !== -1;
    if (!relevant) {
        logger.warn('Ignoring push. %s is not one of: %s', branch, validBranches.join(', '));
    }
    return relevant;
};
