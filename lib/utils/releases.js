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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const compare_versions_1 = __importDefault(require("compare-versions"));
const versions_1 = require("./versions");
const template_1 = require("./template");
const sortReleases = (releases) => {
    // For semver, we find the greatest release number
    // For non-semver, we use the most recently merged
    try {
        return releases.sort((r1, r2) => compare_versions_1.default(r1.tag_name, r2.tag_name));
    }
    catch (error) {
        return releases.sort((r1, r2) => (new Date(r1.published_at)).getTimezoneOffset() - (new Date(r2.published_at)).getTimezoneOffset());
    }
};
exports.findReleases = (logger, octokit, context) => __awaiter(void 0, void 0, void 0, function* () {
    const releases = yield octokit.paginate(octokit.repos.listReleases.endpoint.merge({
        repo: context.repo.repo,
        owner: context.repo.owner,
        'per_page': 100,
    }));
    logger.info('Found %d releases', releases.length);
    const sortedPublishedReleases = sortReleases(releases.filter(release => !release.draft));
    const draftRelease = releases.find(release => release.draft);
    // eslint-disable-next-line no-magic-numbers
    const lastRelease = sortedPublishedReleases[sortedPublishedReleases.length - 1];
    if (draftRelease) {
        logger.info('Draft release: %s', draftRelease.tag_name);
    }
    else {
        logger.info('No draft release found');
    }
    if (lastRelease) {
        logger.info('Draft release: %s', lastRelease.tag_name);
    }
    else {
        logger.info('No last release found');
    }
    return { draftRelease, lastRelease };
});
const contributorsSentence = (commits, pullRequests) => {
    const contributors = new Set();
    commits.forEach(commit => {
        if (commit.author.user) {
            contributors.add(`@${commit.author.user.login}`);
        }
        else {
            contributors.add(commit.author.name);
        }
    });
    pullRequests.forEach(pullRequest => {
        if (pullRequest.author) {
            contributors.add(`@${pullRequest.author.login}`);
        }
    });
    const sortedContributors = Array.from(contributors).sort();
    // eslint-disable-next-line no-magic-numbers
    if (sortedContributors.length > 1) {
        return (
        // eslint-disable-next-line no-magic-numbers
        sortedContributors.slice(0, sortedContributors.length - 1).join(', ') +
            ' and ' +
            // eslint-disable-next-line no-magic-numbers
            sortedContributors.slice(-1));
    }
    else {
        return sortedContributors[0];
    }
};
const categorizePullRequests = (pullRequests, config) => {
    const { 'exclude-labels': excludeLabels, categories } = config;
    const allCategoryLabels = categories.flatMap(category => category.labels);
    const categorizedPullRequests = [...categories].map(category => {
        return Object.assign(Object.assign({}, category), { pullRequests: [] });
    });
    const filterExcludedPullRequests = (pullRequest) => !pullRequest.labels.nodes.some(label => excludeLabels.includes(label.name));
    const filterUncategorizedPullRequests = (flag) => (pullRequest) => {
        const labels = pullRequest.labels.nodes;
        return !labels.length || !labels.some(label => allCategoryLabels.includes(label.name)) ? flag : !flag;
    };
    // we only want pull requests that have yet to be categorized
    const filteredPullRequests = pullRequests.filter(filterExcludedPullRequests).filter(filterUncategorizedPullRequests(false));
    const uncategorizedPullRequests = pullRequests.filter(filterExcludedPullRequests).filter(filterUncategorizedPullRequests(true));
    categorizedPullRequests.map(category => {
        filteredPullRequests.map(pullRequest => {
            // lets categorize some pull request based on labels
            // due note that having the same label in multiple categories
            // then it is intended to "duplicate" the pull request into each category
            const labels = pullRequest.labels.nodes;
            if (labels.some(label => category.labels.includes(label.name))) {
                category.pullRequests.push(pullRequest);
            }
        });
    });
    return { uncategorizedPullRequests, categorizedPullRequests };
};
const generateChangeLog = (mergedPullRequests, config) => {
    if (!mergedPullRequests.length) {
        return config['no-changes-template'];
    }
    const { uncategorizedPullRequests, categorizedPullRequests } = categorizePullRequests(mergedPullRequests, config);
    const pullRequestToString = (pullRequests) => pullRequests
        .map(pullRequest => template_1.template(config['change-template'], {
        $TITLE: pullRequest.title,
        $NUMBER: pullRequest.number,
        $AUTHOR: pullRequest.author ? pullRequest.author.login : 'ghost',
    }))
        .join('\n');
    const changeLog = [];
    if (uncategorizedPullRequests.length) {
        changeLog.push(pullRequestToString(uncategorizedPullRequests));
        changeLog.push('\n\n');
    }
    categorizedPullRequests.map((category, index) => {
        if (category.pullRequests.length) {
            changeLog.push(`## ${category.title}\n\n`);
            changeLog.push(pullRequestToString(category.pullRequests));
            // eslint-disable-next-line no-magic-numbers
            if (index + 1 !== categorizedPullRequests.length) {
                changeLog.push('\n\n');
            }
        }
    });
    return changeLog.join('').trim();
};
exports.generateReleaseInfo = (commits, config, lastRelease, mergedPullRequests, version, tag, name) => {
    let body = config.template;
    body = template_1.template(body, {
        $PREVIOUS_TAG: lastRelease ? lastRelease.tag_name : '',
        $CHANGES: generateChangeLog(mergedPullRequests, config),
        $CONTRIBUTORS: contributorsSentence(commits, mergedPullRequests),
    }, config.replacers);
    const versionInfo = versions_1.getVersionInfo(lastRelease, config['version-template'], 
    // Use the first override parameter to identify
    // a version, from the most accurate to the least
    version || tag || name);
    if (versionInfo) {
        body = template_1.template(body, versionInfo);
    }
    if (!tag) {
        tag = versionInfo ? template_1.template(config['tag-template'] || '', versionInfo) : '';
    }
    if (!name) {
        name = versionInfo ? template_1.template(config['name-template'] || '', versionInfo) : '';
    }
    return { name, tag, body };
};
