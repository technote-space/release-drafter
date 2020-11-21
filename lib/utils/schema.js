"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSchema = exports.schema = void 0;
const joi_1 = __importDefault(require("@hapi/joi"));
const sort_pull_requests_1 = require("./sort-pull-requests");
const default_config_1 = require("./default-config");
const template_1 = require("./template");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const schema = (defaultBranch) => joi_1.default.object().keys({
    branches: joi_1.default.array().items(joi_1.default.string()).default([defaultBranch]),
    'change-template': joi_1.default.string().default(default_config_1.DEFAULT_CONFIG['change-template']),
    'no-changes-template': joi_1.default.string().default(default_config_1.DEFAULT_CONFIG['no-changes-template']),
    'version-template': joi_1.default.string().default(default_config_1.DEFAULT_CONFIG['version-template']),
    'name-template': joi_1.default.string()
        .allow('')
        .default(default_config_1.DEFAULT_CONFIG['name-template']),
    'tag-template': joi_1.default.string()
        .allow('')
        .default(default_config_1.DEFAULT_CONFIG['tag-template']),
    'exclude-labels': joi_1.default.array()
        .items(joi_1.default.string())
        .default(default_config_1.DEFAULT_CONFIG['exclude-labels']),
    'sort-by': joi_1.default.string()
        .valid(sort_pull_requests_1.SORT_BY.mergedAt, sort_pull_requests_1.SORT_BY.title)
        .default(default_config_1.DEFAULT_CONFIG['sort-by']),
    'sort-direction': joi_1.default.string()
        .valid(sort_pull_requests_1.SORT_DIRECTIONS.ascending, sort_pull_requests_1.SORT_DIRECTIONS.descending)
        .default(default_config_1.DEFAULT_CONFIG['sort-direction']),
    prerelease: joi_1.default.boolean().default(default_config_1.DEFAULT_CONFIG.prerelease),
    replacers: joi_1.default.array()
        .items(joi_1.default.object().keys({
        search: joi_1.default.string()
            .required()
            .error(() => '"search" is required and must be a regexp or a string'),
        replace: joi_1.default.string()
            .allow('')
            .required(),
    }))
        .default(default_config_1.DEFAULT_CONFIG.replacers),
    categories: joi_1.default.array()
        .items(joi_1.default.object()
        .keys({
        title: joi_1.default.string().required(),
        label: joi_1.default.string(),
        labels: joi_1.default.array()
            .items(joi_1.default.string())
            .single()
            .default([]),
    })
        .rename('label', 'labels', { ignoreUndefined: true, override: true }))
        .default(default_config_1.DEFAULT_CONFIG.categories),
    template: joi_1.default.string().required(),
    _extends: joi_1.default.string(),
});
exports.schema = schema;
// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
const validateSchema = (defaultBranch, logger, repoConfig) => {
    const { error, value: config } = exports.schema(defaultBranch).validate(repoConfig, {
        abortEarly: false,
        allowUnknown: true,
    });
    if (error) {
        throw error;
    }
    try {
        config.replacers = template_1.validateReplacers(logger, config.replacers);
    }
    catch (error) {
        /* istanbul ignore next */
        config.replacers = [];
    }
    return config;
};
exports.validateSchema = validateSchema;
