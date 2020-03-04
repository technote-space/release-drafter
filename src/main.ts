import Octokit from '@octokit/rest';
import { resolve } from 'path';
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

export const run = async(): Promise<void> | never => {
	const logger  = new Logger();
	const context = new Context();
	ContextHelper.showActionInfo(resolve(__dirname, '..'), logger, context);

	if (!isTargetEvent(TARGET_EVENTS, context)) {
		throw new Error('This is not target event.');
	}

	// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
	// @ts-ignore
	const octokit = new GitHub(Utils.getAccessToken(true)) as Octokit;
	const branch  = await (new ApiHelper(octokit, context, logger).getDefaultBranch());
	const config  = await getConfig(branch, getInput('config-name'), logger, octokit, context);

	const {draftRelease, lastRelease}                 = await findReleases(logger, octokit, context);
	const {commits, pullRequests: mergedPullRequests} = await findCommitsWithAssociatedPullRequests(branch, lastRelease, logger, octokit, context);
	const sortedMergedPullRequests                    = sortPullRequests(mergedPullRequests, config['sort-by'], config['sort-direction']);
	const releaseInfo                                 = generateReleaseInfo(commits, config, lastRelease, sortedMergedPullRequests, getInput('version'), getInput('tag'), getInput('name'));

	let createOrUpdateReleaseResponse;
	if (!draftRelease) {
		logger.info('Creating new release');
		const params = {
			repo: context.repo.repo,
			owner: context.repo.owner,
			name: releaseInfo.name,
			'tag_name': releaseInfo.tag,
			body: releaseInfo.body,
			draft: Utils.getBoolValue(getInput('draft')),
			prerelease: config.prerelease,
		};
		logger.startProcess('Create release params');
		console.log(params);
		logger.endProcess();
		createOrUpdateReleaseResponse = await octokit.repos.createRelease(params);
	} else {
		logger.info('Updating existing draft release');
		const params = {
			repo: context.repo.repo,
			owner: context.repo.owner,
			'release_id': draftRelease.id,
			body: releaseInfo.body,
			...(draftRelease.tag_name ? {'tag_name': draftRelease.tag_name} : null),
			...(!Utils.getBoolValue(getInput('draft')) ? {draft: false} : null),
			...(getInput('tag') ? {'tag_name': getInput('tag')} : null),
			...(getInput('name') ? {name: getInput('name')} : null),
		};
		logger.startProcess('Update release params');
		console.log(params);
		logger.endProcess();
		createOrUpdateReleaseResponse = await octokit.repos.updateRelease(params);
	}

	const {data: {id: releaseId, html_url: htmlUrl, upload_url: uploadUrl}} = createOrUpdateReleaseResponse;
	setOutput('id', String(releaseId));
	setOutput('html_url', htmlUrl);
	setOutput('upload_url', uploadUrl);
};

run().catch(error => {
	console.log(error);
	setFailed(error.message);
});
