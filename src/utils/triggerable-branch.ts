import { Logger } from '@technote-space/github-action-helper';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const flatten = (arr: any): any => {
	return Array.prototype.concat(...arr);
};

export const isTriggerableBranch = (logger: Logger, context, branch, config): boolean => {
	const validBranches = flatten([config.branches]);
	// eslint-disable-next-line no-magic-numbers
	const relevant      = validBranches.indexOf(branch) !== -1;
	if (!relevant) {
		logger.warn('Ignoring push. %s is not one of: %s', branch, validBranches.join(', '));
	}
	return relevant;
};
