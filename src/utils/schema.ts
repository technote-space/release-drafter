import Logger from '@technote-space/github-action-helper/dist/logger';
import Joi from '@hapi/joi';
import { SORT_BY, SORT_DIRECTIONS } from './sort-pull-requests';
import { DEFAULT_CONFIG } from './default-config';
import { validateReplacers } from './template';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const schema = (defaultBranch: string): any => Joi.object().keys({
	branches: Joi.array().items(Joi.string()).default([defaultBranch]),

	'change-template': Joi.string().default(DEFAULT_CONFIG['change-template']),

	'no-changes-template': Joi.string().default(
		DEFAULT_CONFIG['no-changes-template'],
	),

	'version-template': Joi.string().default(
		DEFAULT_CONFIG['version-template'],
	),

	'name-template': Joi.string()
		.allow('')
		.default(DEFAULT_CONFIG['name-template']),

	'tag-template': Joi.string()
		.allow('')
		.default(DEFAULT_CONFIG['tag-template']),

	'exclude-labels': Joi.array()
		.items(Joi.string())
		.default(DEFAULT_CONFIG['exclude-labels']),

	'sort-by': Joi.string()
		.valid(SORT_BY.mergedAt, SORT_BY.title)
		.default(DEFAULT_CONFIG['sort-by']),

	'sort-direction': Joi.string()
		.valid(SORT_DIRECTIONS.ascending, SORT_DIRECTIONS.descending)
		.default(DEFAULT_CONFIG['sort-direction']),

	prerelease: Joi.boolean().default(DEFAULT_CONFIG.prerelease),

	replacers: Joi.array()
		.items(
			Joi.object().keys({
				search: Joi.string()
					.required()
					.error(
						() => '"search" is required and must be a regexp or a string',
					),
				replace: Joi.string()
					.allow('')
					.required(),
			}),
		)
		.default(DEFAULT_CONFIG.replacers),

	categories: Joi.array()
		.items(
			Joi.object()
				.keys({
					title: Joi.string().required(),
					label: Joi.string(),
					labels: Joi.array()
						.items(Joi.string())
						.single()
						.default([]),
				})
				.rename('label', 'labels', {ignoreUndefined: true, override: true}),
		)
		.default(DEFAULT_CONFIG.categories),

	template: Joi.string().required(),

	_extends: Joi.string(),
});

export const validateSchema = (defaultBranch: string, logger: Logger, repoConfig: object): object => {
	const {error, value: config} = schema(defaultBranch).validate(repoConfig, {
		abortEarly: false,
		allowUnknown: true,
	});
	if (error) {
		throw error;
	}

	try {
		config.replacers = validateReplacers(logger, config.replacers);
	} catch (error) {
		config.replacers = [];
	}

	return config;
};
