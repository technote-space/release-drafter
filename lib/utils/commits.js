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
exports.findCommitsWithAssociatedPullRequests = exports.findCommitsWithAssociatedPullRequestsQuery = void 0;
const lodash_1 = __importDefault(require("lodash"));
const pagination_1 = require("./pagination");
exports.findCommitsWithAssociatedPullRequestsQuery = `
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
exports.findCommitsWithAssociatedPullRequests = (branch, lastRelease, logger, octokit, context) => __awaiter(void 0, void 0, void 0, function* () {
    const { owner, repo } = context.repo;
    const variables = { name: repo, owner, branch };
    const dataPath = ['repository', 'ref', 'target', 'history'];
    let data;
    if (lastRelease) {
        logger.info('Fetching all commits for branch %s since %s', branch, lastRelease.published_at);
        data = yield pagination_1.paginate(octokit.graphql, exports.findCommitsWithAssociatedPullRequestsQuery, Object.assign(Object.assign({}, variables), { since: lastRelease.published_at }), dataPath);
    }
    else {
        logger.info('Fetching all commits for branch %s', branch);
        data = yield pagination_1.paginate(octokit.graphql, exports.findCommitsWithAssociatedPullRequestsQuery, variables, dataPath);
    }
    const commits = lodash_1.default.get(data, [...dataPath, 'nodes']);
    const pullRequests = lodash_1.default.uniqBy(lodash_1.default.flatten(commits.map(commit => commit.associatedPullRequests.nodes)), 'number');
    return { commits, pullRequests };
});
