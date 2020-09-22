import _ from 'lodash';
import {GitHub} from '@actions/github';
import {Context} from '@actions/github/lib/context';
import {Logger} from '@technote-space/github-action-log-helper';
import {paginate} from './pagination';

export const findCommitsWithAssociatedPullRequestsQuery = /* GraphQL */ `
  query findCommitsWithAssociatedPullRequests(
    $name: String!
    $owner: String!
    $branch: String!
    $since: GitTimestamp
    $after: String
  ) {
    repository(name: $name, owner: $owner) {
      ref(qualifiedName: $branch) {
        target {
          ... on Commit {
            history(first: 100, since: $since, after: $after) {
              totalCount
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                message
                author {
                  name
                  user {
                    login
                  }
                }
                associatedPullRequests(first: 5) {
                  nodes {
                    title
                    number
                    author {
                      login
                    }
                    mergedAt
                    isCrossRepository
                    labels(first: 10) {
                      nodes {
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const findCommitsWithAssociatedPullRequests = async(branch: string, lastRelease: { 'published_at': string }, logger: Logger, octokit: GitHub, context: Context): Promise<{ commits; pullRequests }> => {
  const {owner, repo} = context.repo;
  const variables     = {name: repo, owner, branch};
  const dataPath      = ['repository', 'ref', 'target', 'history'];

  let data;
  if (lastRelease) {
    logger.info('Fetching all commits for branch %s since %s', branch, lastRelease.published_at);

    data = await paginate(
      octokit.graphql,
      findCommitsWithAssociatedPullRequestsQuery,
      {...variables, since: lastRelease.published_at},
      dataPath,
    );
  } else {
    logger.info('Fetching all commits for branch %s', branch);

    data = await paginate(
      octokit.graphql,
      findCommitsWithAssociatedPullRequestsQuery,
      variables,
      dataPath,
    );
  }

  const commits      = _.get(data, [...dataPath, 'nodes']);
  const pullRequests = _.uniqBy(
    _.flatten(commits.map(commit => commit.associatedPullRequests.nodes)),
    'number',
  );

  return {commits, pullRequests};
};
