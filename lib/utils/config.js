"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = void 0;
const schema_1 = require("./schema");
const default_config_1 = require("./default-config");
const github_action_config_helper_1 = require("@technote-space/github-action-config-helper");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getConfig = (defaultBranch, configName, logger, octokit, context) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return schema_1.validateSchema(defaultBranch, logger, Object.assign(Object.assign({}, default_config_1.DEFAULT_CONFIG), yield github_action_config_helper_1.getConfig(configName, octokit, context)));
    }
    catch (error) {
        logger.error(error.message);
        throw new Error('Invalid config file');
    }
});
exports.getConfig = getConfig;
