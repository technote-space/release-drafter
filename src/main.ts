import path from 'path';
import { getInput, setOutput, setFailed } from '@actions/core';
import { Context } from '@actions/github/lib/context';
import { GitHub } from '@actions/github';
import { isTargetEvent } from '@technote-space/filter-github-action';
import { Logger, ContextHelper, Utils, ApiHelper } from '@technote-space/github-action-helper';
import { getConfig } from './utils/config';
import { findReleases, generateReleaseInfo } from './utils/releases';
import { findCommitsWithAssociatedPullRequests } from './utils/commits';
import { sortPullRequests } from './utils/sort-pull-requests';
import { TARGET_EVENTS } from './constant';

export const run = async(): Promise<void> => {
	const logger  = new Logger();
	const context = new Context();
	ContextHelper.showActionInfo(path.resolve(__dirname, '..'), logger, context);

	if (!isTargetEvent(TARGET_EVENTS, context)) {
		logger.info('This is not target event.');
		return;
	}

	const octokit = new GitHub(Utils.getAccessToken(true));
	const branch  = await (new ApiHelper(octokit, context, logger).getDefaultBranch());
	const config  = await getConfig(branch, getInput('config-name'), logger, octokit, context);
	if (!config) {
		return;
	}

	const {draftRelease, lastRelease}                 = await findReleases(logger, octokit, context);
	const {commits, pullRequests: mergedPullRequests} = await findCommitsWithAssociatedPullRequests(branch, lastRelease, logger, octokit, context);
	const sortedMergedPullRequests                    = sortPullRequests(mergedPullRequests, config['sort-by'], config['sort-direction']);
	const releaseInfo                                 = generateReleaseInfo(commits, config, lastRelease, sortedMergedPullRequests, getInput('version'), getInput('tag'), getInput('name'));

	let createOrUpdateReleaseResponse;
	if (!draftRelease) {
		logger.info('Creating new draft release');
		createOrUpdateReleaseResponse = await octokit.repos.createRelease({
			repo: context.repo.repo,
			owner: context.repo.owner,
			name: releaseInfo.name,
			'tag_name': releaseInfo.tag,
			body: releaseInfo.body,
			draft: true,
			prerelease: config.prerelease,
		});
	} else {
		logger.info('Updating existing draft release');
		createOrUpdateReleaseResponse = await octokit.repos.updateRelease({
			repo: context.repo.repo,
			owner: context.repo.owner,
			'release_id': draftRelease.id,
			body: releaseInfo.body,
			...(draftRelease.tag_name ? {'tag_name': draftRelease.tag_name} : null),
		});
	}

	const {data: {id: releaseId, html_url: htmlUrl, upload_url: uploadUrl}} = createOrUpdateReleaseResponse;
	setOutput('id', releaseId);
	setOutput('html_url', htmlUrl);
	setOutput('upload_url', uploadUrl);
};

run().catch(error => setFailed(error.message));
