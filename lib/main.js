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
exports.run = void 0;
const path_1 = require("path");
const core_1 = require("@actions/core");
const context_1 = require("@actions/github/lib/context");
const filter_github_action_1 = require("@technote-space/filter-github-action");
const github_action_helper_1 = require("@technote-space/github-action-helper");
const github_action_log_helper_1 = require("@technote-space/github-action-log-helper");
const config_1 = require("./utils/config");
const releases_1 = require("./utils/releases");
const commits_1 = require("./utils/commits");
const sort_pull_requests_1 = require("./utils/sort-pull-requests");
const constant_1 = require("./constant");
const run = () => __awaiter(void 0, void 0, void 0, function* () {
    const logger = new github_action_log_helper_1.Logger();
    const context = new context_1.Context();
    github_action_helper_1.ContextHelper.showActionInfo(path_1.resolve(__dirname, '..'), logger, context);
    if (!filter_github_action_1.isTargetEvent(constant_1.TARGET_EVENTS, context)) {
        throw new Error('This is not target event.');
    }
    const octokit = github_action_helper_1.Utils.getOctokit();
    const branch = yield (new github_action_helper_1.ApiHelper(octokit, context, logger).getDefaultBranch());
    const config = yield config_1.getConfig(branch, core_1.getInput('config-name'), logger, octokit, context);
    const { draftRelease, lastRelease } = yield releases_1.findReleases(logger, octokit, context);
    const { commits, pullRequests: mergedPullRequests } = yield commits_1.findCommitsWithAssociatedPullRequests(branch, lastRelease, logger, octokit, context);
    const sortedMergedPullRequests = sort_pull_requests_1.sortPullRequests(mergedPullRequests, config['sort-by'], config['sort-direction']);
    const releaseInfo = releases_1.generateReleaseInfo(commits, config, lastRelease, sortedMergedPullRequests, core_1.getInput('version'), core_1.getInput('tag'), core_1.getInput('name'));
    let createOrUpdateReleaseResponse;
    if (!draftRelease) {
        logger.info('Creating new release');
        const params = {
            repo: context.repo.repo,
            owner: context.repo.owner,
            name: releaseInfo.name,
            'tag_name': releaseInfo.tag,
            body: releaseInfo.body,
            draft: github_action_helper_1.Utils.getBoolValue(core_1.getInput('draft')),
            prerelease: config.prerelease,
        };
        logger.startProcess('Create release params');
        console.log(params);
        logger.endProcess();
        createOrUpdateReleaseResponse = yield octokit.rest.repos.createRelease(params);
    }
    else {
        logger.info('Updating existing draft release');
        const params = Object.assign(Object.assign(Object.assign(Object.assign({ repo: context.repo.repo, owner: context.repo.owner, 'release_id': draftRelease.id, body: releaseInfo.body }, (draftRelease.tag_name ? { 'tag_name': draftRelease.tag_name } : null)), (!github_action_helper_1.Utils.getBoolValue(core_1.getInput('draft')) ? { draft: false } : null)), (core_1.getInput('tag') ? { 'tag_name': core_1.getInput('tag') } : null)), (core_1.getInput('name') ? { name: core_1.getInput('name') } : null));
        logger.startProcess('Update release params');
        console.log(params);
        logger.endProcess();
        createOrUpdateReleaseResponse = yield octokit.rest.repos.updateRelease(params);
    }
    const { data: { id: releaseId, html_url: htmlUrl, upload_url: uploadUrl } } = createOrUpdateReleaseResponse;
    core_1.setOutput('id', String(releaseId));
    core_1.setOutput('html_url', htmlUrl);
    core_1.setOutput('upload_url', uploadUrl);
});
exports.run = run;
exports.run().catch(error => {
    console.log(error);
    core_1.setFailed(error.message);
});
