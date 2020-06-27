import Logger from '@technote-space/github-action-helper/dist/logger';
import {Octokit} from '@technote-space/github-action-helper/dist/types';
import {Context} from '@actions/github/lib/context';
import compareVersions from 'compare-versions';
import {ReposListReleasesResponseData} from '@octokit/types/dist-types/generated/Endpoints';
import {getVersionInfo} from './versions';
import {template} from './template';

const sortReleases = (releases: Array<{ 'tag_name': string; 'published_at': string }>): Array<{ 'tag_name': string }> => {
  // For semver, we find the greatest release number
  // For non-semver, we use the most recently merged
  try {
    return releases.sort((r1, r2) => compareVersions(r1.tag_name, r2.tag_name));
  } catch (error) {
    /* istanbul ignore next */
    return releases.sort(
      (r1, r2) => (new Date(r1.published_at)).getTimezoneOffset() - (new Date(r2.published_at)).getTimezoneOffset(),
    );
  }
};

export const findReleases = async(logger: Logger, octokit: Octokit, context: Context): Promise<{ draftRelease; lastRelease }> => {
  const releases: ReposListReleasesResponseData = await octokit.paginate(
    octokit.repos.listReleases,
    {
      repo: context.repo.repo,
      owner: context.repo.owner,
      'per_page': 100,
    },
  );

  logger.info('Found %d releases', releases.length);

  const sortedPublishedReleases = sortReleases(releases.filter(release => !release.draft));
  const draftRelease            = releases.find(release => release.draft);
  // eslint-disable-next-line no-magic-numbers
  const lastRelease             = sortedPublishedReleases[sortedPublishedReleases.length - 1];

  if (draftRelease) {
    logger.info('Draft release: %s', draftRelease.tag_name);
  } else {
    logger.info('No draft release found');
  }

  if (lastRelease) {
    logger.info('Last release: %s', lastRelease.tag_name);
  } else {
    logger.info('No last release found');
  }

  return {draftRelease, lastRelease};
};

const contributorsSentence = (commits, pullRequests): string => {
  const contributors = new Set<string>();

  commits.forEach(commit => {
    if (commit.author.user) {
      contributors.add(`@${commit.author.user.login}`);
    } else {
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
      sortedContributors.slice(-1)
    );
  } else {
    return sortedContributors[0];
  }
};

const categorizePullRequests = (pullRequests: Array<{ labels }>, config: { 'exclude-labels'; excludeLabels; categories }): { uncategorizedPullRequests; categorizedPullRequests } => {
  const {'exclude-labels': excludeLabels, categories} = config;
  const allCategoryLabels                             = categories.flatMap(category => category.labels);
  const categorizedPullRequests                       = [...categories].map(category => {
    return {...category, pullRequests: []};
  });

  const filterExcludedPullRequests      = (pullRequest: { labels }): boolean => !pullRequest.labels.nodes.some(label => excludeLabels.includes(label.name));
  const filterUncategorizedPullRequests = (flag: boolean) => (pullRequest: { labels }): boolean => {
    const labels = pullRequest.labels.nodes;
    return !labels.length || !labels.some(label => allCategoryLabels.includes(label.name)) ? flag : !flag;
  };

  // we only want pull requests that have yet to be categorized
  const filteredPullRequests      = pullRequests.filter(filterExcludedPullRequests).filter(filterUncategorizedPullRequests(false));
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

  return {uncategorizedPullRequests, categorizedPullRequests};
};

const generateChangeLog = (mergedPullRequests, config): string => {
  if (!mergedPullRequests.length) {
    return config['no-changes-template'];
  }

  const {uncategorizedPullRequests, categorizedPullRequests} = categorizePullRequests(mergedPullRequests, config);

  const pullRequestToString = (pullRequests: Array<{ title; number; author }>): string =>
    pullRequests
      .map(pullRequest =>
        template(config['change-template'], {
          $TITLE: pullRequest.title,
          $NUMBER: pullRequest.number,
          $AUTHOR: pullRequest.author ? pullRequest.author.login : 'ghost',
        }),
      )
      .join('\n');

  const changeLog: Array<string> = [];

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

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const generateReleaseInfo = (commits, config, lastRelease, mergedPullRequests, version: string, tag: string, name: string): { name: string; tag: string; body: string } => {
  let body = config.template;

  body = template(
    body,
    {
      $PREVIOUS_TAG: lastRelease ? lastRelease.tag_name : '',
      $CHANGES: generateChangeLog(mergedPullRequests, config),
      $CONTRIBUTORS: contributorsSentence(commits, mergedPullRequests),
    },
    config.replacers,
  );

  const versionInfo = getVersionInfo(
    lastRelease,
    config['version-template'],
    // Use the first override parameter to identify
    // a version, from the most accurate to the least
    version || tag || name,
  );

  if (versionInfo) {
    body = template(body, versionInfo);
  }

  if (!tag) {
    tag = versionInfo ? template(config['tag-template'] || '', versionInfo) : '';
  }

  if (!name) {
    name = versionInfo ? template(config['name-template'] || '', versionInfo) : '';
  }

  return {name, tag, body};
};
