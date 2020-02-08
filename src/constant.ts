import { Context } from '@actions/github/lib/context';
import { Utils } from '@technote-space/github-action-helper';

export const TARGET_EVENTS = {
	'create': [
		(context: Context): boolean => Utils.isTagRef(context),
	],
	'release': [
		[
			'published',
			(context: Context): boolean => Utils.isTagRef(context),
		],
	],
	'push': [
		(context: Context): boolean => Utils.isTagRef(context),
	],
};
