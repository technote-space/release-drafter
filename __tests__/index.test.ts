/* eslint-disable no-magic-numbers */
import nock, {Scope} from 'nock';
import {resolve} from 'path';
import {run} from '../src/main';
import {
  testEnv,
  disableNetConnect,
  getApiFixture,
  getConfigFixture,
  spyOnStdout, stdoutContains,
} from '@technote-space/github-action-test-helper';

const rootDir        = resolve(__dirname, '..');
const fixtureRootDir = resolve(__dirname, 'fixtures');
const getConfigMock  = (
  fileName     = 'config.yml',
  repoFileName = 'release-drafter.yml',
): Scope => {
  return nock('https://api.github.com')
    .get(`/repos/toolmantim/release-drafter-test-project/contents/.github/${repoFileName}`)
    .reply(200, getConfigFixture(resolve(fixtureRootDir, 'config'), fileName));
};

describe('release-drafter', () => {
  testEnv(rootDir);
  disableNetConnect(nock);

  beforeEach(() => {
    process.env.INPUT_GITHUB_TOKEN = 'token';
  });

  let payload                    = {};
  let override                   = {};
  let eventName                  = 'push';
  let action: string | undefined = undefined;
  afterEach(() => {
    payload   = {};
    override  = {};
    eventName = 'push';
    action    = undefined;
  });

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  jest.spyOn(require('@actions/github/lib/context'), 'Context').mockImplementation(() => ({
    repo: {
      owner: 'toolmantim',
      repo: 'release-drafter-test-project',
    },
    payload,
    eventName,
    action,
    ref: 'push' === eventName ? payload['ref'] : ('create' === eventName ? `refs/tags/${payload['ref']}` : `refs/tags/${payload['release']['tag_name']}`),
    sha: payload['sha'],
    ...override,
  }));

  describe('push', () => {
    describe('without a config', () => {
      it('does nothing', async() => {
        const spyOn = spyOnStdout();
        nock('https://api.github.com')
          .get('/repos/toolmantim/release-drafter-test-project/contents/.github/release-drafter.yml')
          .reply(404);

        payload = require('./fixtures/payload/push');

        await expect(run()).rejects.toThrow('Invalid config file');

        stdoutContains(spyOn, [
          '::error::"template" is required',
        ]);
      });
    });

    describe('to a branch', () => {
      it('does nothing', async() => {
        getConfigMock();

        payload = require('./fixtures/payload/push-branch');

        await expect(run()).rejects.toThrow('This is not target event.');
      });
    });

    describe('with no past releases', () => {
      it('sets $CHANGES based on all commits, and $PREVIOUS_TAG to blank', async() => {
        getConfigMock('config-previous-tag.yml');
        const fn    = jest.fn();
        const spyOn = spyOnStdout();

        nock('https://api.github.com')
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(
            200,
            getApiFixture(fixtureRootDir, '__generated__/graphql-commits-merge-commit'),
          );

        nock('https://api.github.com')
          .get(
            '/repos/toolmantim/release-drafter-test-project/releases?per_page=100',
          )
          .reply(200, []);

        nock('https://api.github.com')
          .post(
            '/repos/toolmantim/release-drafter-test-project/releases',
            body => {
              fn();
              expect(body).toMatchObject({
                body: `Changes:
* Add documentation (#5) @TimonVS
* Update dependencies (#4) @TimonVS
* Bug fixes (#3) @TimonVS
* Add big feature (#2) @TimonVS
* 👽 Add alien technology (#1) @TimonVS

Previous tag: ''
`,
                draft: true,
                'tag_name': '',
              });
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 0 releases',
          '> No draft release found',
          '> No last release found',
          '> Fetching all commits for branch master',
          '> Creating new release',
        ]);

        expect(fn).toBeCalledTimes(1);
      });

      it('creates a new draft when run as a GitHub Action', async() => {
        getConfigMock();
        const fn    = jest.fn();
        const spyOn = spyOnStdout();

        nock('https://api.github.com')
          .get(
            '/repos/toolmantim/release-drafter-test-project/releases?per_page=100',
          )
          .reply(200, [
            getApiFixture(fixtureRootDir, 'release-2'),
            getApiFixture(fixtureRootDir, 'release'),
            getApiFixture(fixtureRootDir, 'release-3'),
          ]);

        nock('https://api.github.com')
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(
            200,
            getApiFixture(fixtureRootDir, '__generated__/graphql-commits-merge-commit'),
          );

        nock('https://api.github.com')
          .post(
            '/repos/toolmantim/release-drafter-test-project/releases',
            body => {
              fn();
              expect(body).toMatchObject({
                body: `# What's Changed

* Add documentation (#5) @TimonVS
* Update dependencies (#4) @TimonVS
* Bug fixes (#3) @TimonVS
* Add big feature (#2) @TimonVS
* 👽 Add alien technology (#1) @TimonVS
`,
                draft: true,
                'tag_name': '',
              });
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 3 releases',
          '> No draft release found',
          '> Last release: v2.0.0',
          '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
          '> Creating new release',
        ]);

        expect(fn).toBeCalledTimes(1);
      });

      it('makes next versions available as template placeholders', async() => {
        getConfigMock('config-with-next-versioning.yml');
        const fn    = jest.fn();
        const spyOn = spyOnStdout();

        nock('https://api.github.com')
          .get(
            '/repos/toolmantim/release-drafter-test-project/releases?per_page=100',
          )
          .reply(200, [getApiFixture(fixtureRootDir, 'release')]);

        nock('https://api.github.com')
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(
            200,
            getApiFixture(fixtureRootDir, '__generated__/graphql-commits-merge-commit'),
          );

        nock('https://api.github.com')
          .post(
            '/repos/toolmantim/release-drafter-test-project/releases',
            body => {
              fn();
              expect(body).toMatchObject({
                body: 'Placeholder with example. Automatically calculated values are next major=3.0.0, minor=2.1.0, patch=2.0.1',
                draft: true,
                name: 'v2.0.1 (Code name: Placeholder)',
                'tag_name': 'v2.0.1',
              });
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 1 releases',
          '> No draft release found',
          '> Last release: v2.0.0',
          '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
          '> Creating new release',
        ]);

        expect(fn).toBeCalledTimes(1);
      });

      describe('with custom changes-template config', () => {
        it('creates a new draft using the template', async() => {
          getConfigMock('config-with-changes-templates.yml');
          const fn    = jest.fn();
          const spyOn = spyOnStdout();

          nock('https://api.github.com')
            .get(
              '/repos/toolmantim/release-drafter-test-project/releases?per_page=100',
            )
            .reply(200, [getApiFixture(fixtureRootDir, 'release')]);

          nock('https://api.github.com')
            .post('/graphql', body =>
              body.query.includes('query findCommitsWithAssociatedPullRequests'),
            )
            .reply(
              200,
              getApiFixture(fixtureRootDir, '__generated__/graphql-commits-merge-commit'),
            );

          nock('https://api.github.com')
            .post(
              '/repos/toolmantim/release-drafter-test-project/releases',
              body => {
                fn();
                expect(body).toMatchObject({
                  body: `* Change: #5 'Add documentation' @TimonVS
* Change: #4 'Update dependencies' @TimonVS
* Change: #3 'Bug fixes' @TimonVS
* Change: #2 'Add big feature' @TimonVS
* Change: #1 '👽 Add alien technology' @TimonVS`,
                  draft: true,
                  'tag_name': '',
                });
                return true;
              },
            )
            .reply(200);

          payload = require('./fixtures/payload/push');

          await run();

          stdoutContains(spyOn, [
            '> Found 1 releases',
            '> No draft release found',
            '> Last release: v2.0.0',
            '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
            '> Creating new release',
          ]);

          expect(fn).toBeCalledTimes(1);
        });
      });

      describe('with contributors config', () => {
        it('adds the contributors', async() => {
          getConfigMock('config-with-contributors.yml');
          const fn    = jest.fn();
          const spyOn = spyOnStdout();

          nock('https://api.github.com')
            .get(
              '/repos/toolmantim/release-drafter-test-project/releases?per_page=100',
            )
            .reply(200, [getApiFixture(fixtureRootDir, 'release')]);

          nock('https://api.github.com')
            .post('/graphql', body =>
              body.query.includes('query findCommitsWithAssociatedPullRequests'),
            )
            .reply(
              200,
              getApiFixture(fixtureRootDir, '__generated__/graphql-commits-merge-commit'),
            );

          nock('https://api.github.com')
            .post(
              '/repos/toolmantim/release-drafter-test-project/releases',
              body => {
                fn();
                expect(body).toMatchObject({
                  body: 'A big thanks to: @TimonVS and Ada Lovelace',
                  draft: true,
                  'tag_name': '',
                });
                return true;
              },
            )
            .reply(200);

          payload = require('./fixtures/payload/push');

          await run();

          stdoutContains(spyOn, [
            '> Found 1 releases',
            '> No draft release found',
            '> Last release: v2.0.0',
            '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
            '> Creating new release',
          ]);

          expect(fn).toBeCalledTimes(1);
        });
      });
    });

    describe('with no changes since the last release', () => {
      it('creates a new draft with no changes', async() => {
        getConfigMock();
        const fn1   = jest.fn();
        const fn2   = jest.fn();
        const spyOn = spyOnStdout();

        nock('https://api.github.com')
          .get(
            '/repos/toolmantim/release-drafter-test-project/releases?per_page=100',
          )
          .reply(200, [
            getApiFixture(fixtureRootDir, 'release-2'),
            getApiFixture(fixtureRootDir, 'release'),
            getApiFixture(fixtureRootDir, 'release-3'),
          ]);

        nock('https://api.github.com')
          .post('/graphql', body => {
            fn1();
            expect(body.variables.since).toBe(
              getApiFixture(fixtureRootDir, 'release-3')['published_at'],
            );
            return body.query.includes(
              'query findCommitsWithAssociatedPullRequests',
            );
          })
          .reply(200, getApiFixture(fixtureRootDir, 'graphql-commits-empty'));

        nock('https://api.github.com')
          .post(
            '/repos/toolmantim/release-drafter-test-project/releases',
            body => {
              fn2();
              expect(body).toMatchObject({
                body: `# What's Changed

* No changes
`,
                draft: true,
                'tag_name': '',
              });
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 3 releases',
          '> No draft release found',
          '> Last release: v2.0.0',
          '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
          '> Creating new release',
        ]);

        expect(fn1).toBeCalledTimes(1);
        expect(fn2).toBeCalledTimes(1);
      });

      describe('with custom no-changes-template config', () => {
        it('creates a new draft with the template', async() => {
          getConfigMock('config-with-changes-templates.yml');
          const fn    = jest.fn();
          const spyOn = spyOnStdout();

          nock('https://api.github.com')
            .get('/repos/toolmantim/release-drafter-test-project/releases')
            .query(true)
            .reply(200, []);

          nock('https://api.github.com')
            .post('/graphql', body =>
              body.query.includes('query findCommitsWithAssociatedPullRequests'),
            )
            .reply(200, getApiFixture(fixtureRootDir, 'graphql-commits-empty'));

          nock('https://api.github.com')
            .post(
              '/repos/toolmantim/release-drafter-test-project/releases',
              body => {
                fn();
                expect(body).toMatchObject({
                  body: '* No changes mmkay',
                  draft: true,
                  'tag_name': '',
                });
                return true;
              },
            )
            .reply(200);

          payload = require('./fixtures/payload/push');

          await run();

          stdoutContains(spyOn, [
            '> Found 0 releases',
            '> No draft release found',
            '> No last release found',
            '> Fetching all commits for branch master',
            '> Creating new release',
          ]);

          expect(fn).toBeCalledTimes(1);
        });
      });
    });

    describe('with an existing draft release', () => {
      it('updates the existing release’s body', async() => {
        getConfigMock();
        const fn    = jest.fn();
        const spyOn = spyOnStdout();

        nock('https://api.github.com')
          .get('/repos/toolmantim/release-drafter-test-project/releases')
          .query(true)
          .reply(200, [getApiFixture(fixtureRootDir, 'release-draft')]);

        nock('https://api.github.com')
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(
            200,
            getApiFixture(fixtureRootDir, '__generated__/graphql-commits-merge-commit'),
          );

        nock('https://api.github.com')
          .patch(
            '/repos/toolmantim/release-drafter-test-project/releases/11691725',
            body => {
              fn();
              expect(body).toMatchObject({
                body: `# What's Changed

* Add documentation (#5) @TimonVS
* Update dependencies (#4) @TimonVS
* Bug fixes (#3) @TimonVS
* Add big feature (#2) @TimonVS
* 👽 Add alien technology (#1) @TimonVS
`,
              });
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 1 releases',
          '> Draft release: v3.0.0-beta',
          '> No last release found',
          '> Fetching all commits for branch master',
          '> Updating existing draft release',
        ]);

        expect(fn).toBeCalledTimes(1);
      });
    });

    describe('with categories config', () => {
      it('categorizes pull requests with single label', async() => {
        getConfigMock('config-with-categories.yml');
        const fn    = jest.fn();
        const spyOn = spyOnStdout();

        nock('https://api.github.com')
          .get('/repos/toolmantim/release-drafter-test-project/releases')
          .query(true)
          .reply(200, [getApiFixture(fixtureRootDir, 'release')]);

        nock('https://api.github.com')
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(
            200,
            getApiFixture(fixtureRootDir, '__generated__/graphql-commits-merge-commit'),
          );

        nock('https://api.github.com')
          .post(
            '/repos/toolmantim/release-drafter-test-project/releases',
            body => {
              fn();
              expect(body).toMatchObject({
                body: `# What's Changed

* Add documentation (#5) @TimonVS
* Update dependencies (#4) @TimonVS

## 🚀 Features

* Add big feature (#2) @TimonVS
* 👽 Add alien technology (#1) @TimonVS

## 🐛 Bug Fixes

* Bug fixes (#3) @TimonVS
`,
                draft: true,
                'tag_name': '',
              });
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 1 releases',
          '> No draft release found',
          '> Last release: v2.0.0',
          '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
          '> Creating new release',
        ]);

        expect(fn).toBeCalledTimes(1);
      });

      it('categorizes pull requests with multiple labels', async() => {
        getConfigMock('config-with-categories-2.yml');
        const fn    = jest.fn();
        const spyOn = spyOnStdout();

        nock('https://api.github.com')
          .get('/repos/toolmantim/release-drafter-test-project/releases')
          .query(true)
          .reply(200, [getApiFixture(fixtureRootDir, 'release')]);

        nock('https://api.github.com')
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(
            200,
            getApiFixture(fixtureRootDir, '__generated__/graphql-commits-merge-commit'),
          );

        nock('https://api.github.com')
          .post(
            '/repos/toolmantim/release-drafter-test-project/releases',
            body => {
              fn();
              expect(body).toMatchObject({
                body: `# What's Changed

* Add documentation (#5) @TimonVS
* Update dependencies (#4) @TimonVS

## 🚀 Features

* Add big feature (#2) @TimonVS
* 👽 Add alien technology (#1) @TimonVS

## 🐛 Bug Fixes

* Bug fixes (#3) @TimonVS
`,
                draft: true,
                'tag_name': '',
              });
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 1 releases',
          '> No draft release found',
          '> Last release: v2.0.0',
          '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
          '> Creating new release',
        ]);

        expect(fn).toBeCalledTimes(1);
      });

      it('categorizes pull requests with overlapping labels', async() => {
        getConfigMock('config-with-categories-3.yml');
        const fn    = jest.fn();
        const spyOn = spyOnStdout();

        nock('https://api.github.com')
          .get('/repos/toolmantim/release-drafter-test-project/releases')
          .query(true)
          .reply(200, [getApiFixture(fixtureRootDir, 'release')]);

        nock('https://api.github.com')
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(
            200,
            getApiFixture(fixtureRootDir, '__generated__/graphql-commits-overlapping-label'),
          );

        nock('https://api.github.com')
          .post(
            '/repos/toolmantim/release-drafter-test-project/releases',
            body => {
              fn();
              expect(body).toMatchInlineSnapshot(`
                Object {
                  "body": "# What's Changed

                * Add documentation (#22) @casz
                * Update dependencies (#21) @casz

                ## 🚀 Features

                * Add big feature (#19) @casz
                * Add alien technology (#18) @casz

                ## 🐛 Bug Fixes

                * Bug fixes (#20) @casz
                ",
                  "draft": true,
                  "name": "",
                  "prerelease": false,
                  "tag_name": "",
                }
              `);
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 1 releases',
          '> No draft release found',
          '> Last release: v2.0.0',
          '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
          '> Creating new release',
        ]);

        expect(fn).toBeCalledTimes(1);
      });

      it('categorizes pull requests with overlapping labels into multiple categories', async() => {
        getConfigMock('config-with-categories-4.yml');
        const fn    = jest.fn();
        const spyOn = spyOnStdout();

        nock('https://api.github.com')
          .get('/repos/toolmantim/release-drafter-test-project/releases')
          .query(true)
          .reply(200, [getApiFixture(fixtureRootDir, 'release')]);

        nock('https://api.github.com')
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(
            200,
            getApiFixture(fixtureRootDir, '__generated__/graphql-commits-overlapping-label'),
          );

        nock('https://api.github.com')
          .post(
            '/repos/toolmantim/release-drafter-test-project/releases',
            body => {
              fn();
              expect(body).toMatchInlineSnapshot(`
                Object {
                  "body": "# What's Changed

                * Add documentation (#22) @casz
                * Update dependencies (#21) @casz

                ## 🚀 Features

                * Add big feature (#19) @casz
                * Add alien technology (#18) @casz

                ## 🐛 Bug Fixes

                * Bug fixes (#20) @casz

                ## 🎖️ Sentry

                * Bug fixes (#20) @casz
                ",
                  "draft": true,
                  "name": "",
                  "prerelease": false,
                  "tag_name": "",
                }
              `);
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 1 releases',
          '> No draft release found',
          '> Last release: v2.0.0',
          '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
          '> Creating new release',
        ]);

        expect(fn).toBeCalledTimes(1);
      });
    });

    describe('with exclude-labels config', () => {
      it('excludes pull requests', async() => {
        getConfigMock('config-with-exclude-labels.yml');
        const fn    = jest.fn();
        const spyOn = spyOnStdout();

        nock('https://api.github.com')
          .get('/repos/toolmantim/release-drafter-test-project/releases')
          .query(true)
          .reply(200, [getApiFixture(fixtureRootDir, 'release')]);

        nock('https://api.github.com')
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(
            200,
            getApiFixture(fixtureRootDir, '__generated__/graphql-commits-merge-commit'),
          );

        nock('https://api.github.com')
          .post(
            '/repos/toolmantim/release-drafter-test-project/releases',
            body => {
              fn();
              expect(body).toMatchObject({
                body: `# What's Changed

* Update dependencies (#4) @TimonVS

## 🚀 Features

* Add big feature (#2) @TimonVS
* 👽 Add alien technology (#1) @TimonVS

## 🐛 Bug Fixes

* Bug fixes (#3) @TimonVS
`,
                draft: true,
                'tag_name': '',
              });
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 1 releases',
          '> No draft release found',
          '> Last release: v2.0.0',
          '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
          '> Creating new release',
        ]);

        expect(fn).toBeCalledTimes(1);
      });
    });

    describe('with version-template config', () => {
      it('generates next version variables as major.minor.patch', async() => {
        getConfigMock('config-with-major-minor-patch-version-template.yml');
        const fn    = jest.fn();
        const spyOn = spyOnStdout();

        nock('https://api.github.com')
          .get('/repos/toolmantim/release-drafter-test-project/releases')
          .query(true)
          .reply(200, [getApiFixture(fixtureRootDir, 'release')]);

        nock('https://api.github.com')
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(
            200,
            getApiFixture(fixtureRootDir, '__generated__/graphql-commits-merge-commit'),
          );

        nock('https://api.github.com')
          .post(
            '/repos/toolmantim/release-drafter-test-project/releases',
            body => {
              fn();
              expect(body).toMatchObject({
                body: 'Placeholder with example. Automatically calculated values are next major=3.0.0, minor=2.1.0, patch=2.0.1',
                draft: true,
                name: 'v2.0.1 (Code name: Placeholder)',
                'tag_name': 'v2.0.1',
              });
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 1 releases',
          '> No draft release found',
          '> Last release: v2.0.0',
          '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
          '> Creating new release',
        ]);

        expect(fn).toBeCalledTimes(1);
      });

      it('generates next version variables as major.minor', async() => {
        getConfigMock('config-with-major-minor-version-template.yml');
        const fn    = jest.fn();
        const spyOn = spyOnStdout();

        nock('https://api.github.com')
          .get('/repos/toolmantim/release-drafter-test-project/releases')
          .query(true)
          .reply(200, [getApiFixture(fixtureRootDir, 'release')]);

        nock('https://api.github.com')
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(
            200,
            getApiFixture(fixtureRootDir, '__generated__/graphql-commits-merge-commit'),
          );

        nock('https://api.github.com')
          .post(
            '/repos/toolmantim/release-drafter-test-project/releases',
            body => {
              fn();
              expect(body).toMatchObject({
                body: 'Placeholder with example. Automatically calculated values are next major=3.0, minor=2.1, patch=2.0',
                draft: true,
                name: 'v2.1 (Code name: Placeholder)',
                'tag_name': 'v2.1',
              });
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 1 releases',
          '> No draft release found',
          '> Last release: v2.0.0',
          '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
          '> Creating new release',
        ]);

        expect(fn).toBeCalledTimes(1);
      });

      it('generates next version variables as major', async() => {
        getConfigMock('config-with-major-version-template.yml');
        const fn    = jest.fn();
        const spyOn = spyOnStdout();

        nock('https://api.github.com')
          .get('/repos/toolmantim/release-drafter-test-project/releases')
          .query(true)
          .reply(200, [getApiFixture(fixtureRootDir, 'release')]);

        nock('https://api.github.com')
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(
            200,
            getApiFixture(fixtureRootDir, '__generated__/graphql-commits-merge-commit'),
          );

        nock('https://api.github.com')
          .post(
            '/repos/toolmantim/release-drafter-test-project/releases',
            body => {
              fn();
              expect(body).toMatchObject({
                body: 'Placeholder with example. Automatically calculated values are next major=3, minor=2, patch=2',
                draft: true,
                name: 'v3 (Code name: Placeholder)',
                'tag_name': 'v3',
              });
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 1 releases',
          '> No draft release found',
          '> Last release: v2.0.0',
          '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
          '> Creating new release',
        ]);

        expect(fn).toBeCalledTimes(1);
      });
    });

    describe('merging strategies', () => {
      describe('merge commit', () => {
        it('sets $CHANGES based on all commits', async() => {
          getConfigMock();
          const fn    = jest.fn();
          const spyOn = spyOnStdout();

          nock('https://api.github.com')
            .post('/graphql', body =>
              body.query.includes('query findCommitsWithAssociatedPullRequests'),
            )
            .reply(
              200,
              getApiFixture(fixtureRootDir, '__generated__/graphql-commits-merge-commit'),
            );

          nock('https://api.github.com')
            .get(
              '/repos/toolmantim/release-drafter-test-project/releases?per_page=100',
            )
            .reply(200, []);

          nock('https://api.github.com')
            .post(
              '/repos/toolmantim/release-drafter-test-project/releases',
              body => {
                fn();
                expect(body).toMatchObject({
                  body: `# What's Changed

* Add documentation (#5) @TimonVS
* Update dependencies (#4) @TimonVS
* Bug fixes (#3) @TimonVS
* Add big feature (#2) @TimonVS
* 👽 Add alien technology (#1) @TimonVS
`,
                  draft: true,
                  'tag_name': '',
                });
                return true;
              },
            )
            .reply(200);

          payload = require('./fixtures/payload/push');

          await run();

          stdoutContains(spyOn, [
            '> Found 0 releases',
            '> No draft release found',
            '> No last release found',
            '> Fetching all commits for branch master',
            '> Creating new release',
          ]);

          expect(fn).toBeCalledTimes(1);
        });
      });

      describe('rebase merging', () => {
        it('sets $CHANGES based on all commits', async() => {
          getConfigMock();
          const fn    = jest.fn();
          const spyOn = spyOnStdout();

          nock('https://api.github.com')
            .post('/graphql', body =>
              body.query.includes('query findCommitsWithAssociatedPullRequests'),
            )
            .reply(
              200,
              getApiFixture(fixtureRootDir, '__generated__/graphql-commits-rebase-merging'),
            );

          nock('https://api.github.com')
            .get(
              '/repos/toolmantim/release-drafter-test-project/releases?per_page=100',
            )
            .reply(200, []);

          nock('https://api.github.com')
            .post(
              '/repos/toolmantim/release-drafter-test-project/releases',
              body => {
                fn();
                expect(body).toMatchObject({
                  body: `# What's Changed

* Add documentation (#10) @TimonVS
* Update dependencies (#9) @TimonVS
* Bug fixes (#8) @TimonVS
* Add big feature (#7) @TimonVS
* 👽 Add alien technology (#6) @TimonVS
`,
                  draft: true,
                  'tag_name': '',
                });
                return true;
              },
            )
            .reply(200);

          payload = require('./fixtures/payload/push');

          await run();

          stdoutContains(spyOn, [
            '> Found 0 releases',
            '> No draft release found',
            '> No last release found',
            '> Fetching all commits for branch master',
            '> Creating new release',
          ]);

          expect(fn).toBeCalledTimes(1);
        });
      });

      describe('squash merging', () => {
        it('sets $CHANGES based on all commits', async() => {
          getConfigMock();
          const fn    = jest.fn();
          const spyOn = spyOnStdout();

          nock('https://api.github.com')
            .post('/graphql', body =>
              body.query.includes('query findCommitsWithAssociatedPullRequests'),
            )
            .reply(
              200,
              getApiFixture(fixtureRootDir, '__generated__/graphql-commits-squash-merging'),
            );

          nock('https://api.github.com')
            .get(
              '/repos/toolmantim/release-drafter-test-project/releases?per_page=100',
            )
            .reply(200, []);

          nock('https://api.github.com')
            .post(
              '/repos/toolmantim/release-drafter-test-project/releases',
              body => {
                fn();
                expect(body).toMatchObject({
                  body: `# What's Changed

* Add documentation (#15) @TimonVS
* Update dependencies (#14) @TimonVS
* Bug fixes (#13) @TimonVS
* Add big feature (#12) @TimonVS
* 👽 Add alien technology (#11) @TimonVS
`,
                  draft: true,
                  'tag_name': '',
                });
                return true;
              },
            )
            .reply(200);

          payload = require('./fixtures/payload/push');

          await run();

          stdoutContains(spyOn, [
            '> Found 0 releases',
            '> No draft release found',
            '> No last release found',
            '> Fetching all commits for branch master',
            '> Creating new release',
          ]);

          expect(fn).toBeCalledTimes(1);
        });
      });
    });

    describe('pagination', () => {
      it('sets $CHANGES based on all commits', async() => {
        getConfigMock();
        const fn    = jest.fn();
        const spyOn = spyOnStdout();

        nock('https://api.github.com')
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(200, getApiFixture(fixtureRootDir, 'graphql-commits-paginated-1'))
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(200, getApiFixture(fixtureRootDir, 'graphql-commits-paginated-2'));

        nock('https://api.github.com')
          .get(
            '/repos/toolmantim/release-drafter-test-project/releases?per_page=100',
          )
          .reply(200, []);

        nock('https://api.github.com')
          .post(
            '/repos/toolmantim/release-drafter-test-project/releases',
            body => {
              fn();
              expect(body).toMatchObject({
                body: `# What's Changed

* Added great distance (#16) @toolmantim
* Oh hai (#15) @toolmantim
* ❤️ Add MOAR THINGS (#14) @toolmantim
* Add all the tests (#13) @toolmantim
* 🤖 Add robots (#12) @toolmantim
* 🎃 More pumpkins (#11) @toolmantim
* 🐄 Moar cowbell (#10) @toolmantim
* 1️⃣ Switch to a monorepo (#9) @toolmantim
* 👽 Integrate Alien technology (#8) @toolmantim
* Add ⛰ technology (#7) @toolmantim
* 👽 Added alien technology (#6) @toolmantim
* 🙅🏼‍♂️ 🐄 (#5) @toolmantim
* 🐄 More cowbell (#4) @toolmantim
* 🐒 Add monkeys technology (#3) @toolmantim
* Adds a new Widgets API (#2) @toolmantim
* Create new-feature.md (#1) @toolmantim
`,
                draft: true,
                'tag_name': '',
              });
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 0 releases',
          '> No draft release found',
          '> No last release found',
          '> Fetching all commits for branch master',
          '> Creating new release',
        ]);

        expect(fn).toBeCalledTimes(1);
      });
    });

    describe('custom replacers', () => {
      it('replaces a string', async() => {
        getConfigMock('config-with-replacers.yml');
        const fn    = jest.fn();
        const spyOn = spyOnStdout();

        nock('https://api.github.com')
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(
            200,
            getApiFixture(fixtureRootDir, '__generated__/graphql-commits-merge-commit'),
          );

        nock('https://api.github.com')
          .get(
            '/repos/toolmantim/release-drafter-test-project/releases?per_page=100',
          )
          .reply(200, []);

        nock('https://api.github.com')
          .post(
            '/repos/toolmantim/release-drafter-test-project/releases',
            body => {
              fn();
              expect(body).toMatchObject({
                body: `# What's Changed

* Add documentation (#1000) @TimonVS
* Update dependencies (#4) @TimonVS
* Bug fixes (#3) @TimonVS
* Add big feature (#2) @TimonVS
* 👽 Add alien technology (#1) @TimonVS
`,
                draft: true,
                'tag_name': '',
              });
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 0 releases',
          '> No draft release found',
          '> No last release found',
          '> Fetching all commits for branch master',
          '> Creating new release',
        ]);

        expect(fn).toBeCalledTimes(1);
      });
    });
  });

  describe('create', () => {
    describe('without a config', () => {
      it('does nothing', async() => {
        const spyOn = spyOnStdout();
        nock('https://api.github.com')
          .get('/repos/toolmantim/release-drafter-test-project/contents/.github/release-drafter.yml')
          .reply(404);

        payload   = require('./fixtures/payload/create');
        eventName = 'create';

        await expect(run()).rejects.toThrow('Invalid config file');

        stdoutContains(spyOn, [
          '::error::"template" is required',
        ]);
      });
    });
  });

  describe('release', () => {
    describe('without a config', () => {
      it('does nothing', async() => {
        const spyOn = spyOnStdout();
        nock('https://api.github.com')
          .get('/repos/toolmantim/release-drafter-test-project/contents/.github/release-drafter.yml')
          .reply(404);

        payload   = require('./fixtures/payload/release');
        eventName = 'release';
        action    = 'published';

        await expect(run()).rejects.toThrow('Invalid config file');

        stdoutContains(spyOn, [
          '::error::"template" is required',
        ]);
      });
    });
  });

  describe('with sort-by config', () => {
    it('sorts by title', async() => {
      getConfigMock('config-with-sort-by-title.yml');
      const fn    = jest.fn();
      const spyOn = spyOnStdout();

      nock('https://api.github.com')
        .post('/graphql', body => body.query.includes('query findCommitsWithAssociatedPullRequests'))
        .reply(200, getApiFixture(fixtureRootDir, 'graphql-commits-paginated-1'))
        .post('/graphql', body => body.query.includes('query findCommitsWithAssociatedPullRequests'))
        .reply(200, getApiFixture(fixtureRootDir, 'graphql-commits-paginated-2'));

      nock('https://api.github.com')
        .get(
          '/repos/toolmantim/release-drafter-test-project/releases?per_page=100',
        )
        .reply(200, []);

      nock('https://api.github.com')
        .post(
          '/repos/toolmantim/release-drafter-test-project/releases',
          body => {
            fn();
            expect(body).toMatchObject({
              body: `# What's Changed

* 🤖 Add robots (#12) @toolmantim
* 🙅🏼‍♂️ 🐄 (#5) @toolmantim
* 👽 Integrate Alien technology (#8) @toolmantim
* 👽 Added alien technology (#6) @toolmantim
* 🐒 Add monkeys technology (#3) @toolmantim
* 🐄 More cowbell (#4) @toolmantim
* 🐄 Moar cowbell (#10) @toolmantim
* 🎃 More pumpkins (#11) @toolmantim
* ❤️ Add MOAR THINGS (#14) @toolmantim
* Oh hai (#15) @toolmantim
* Create new-feature.md (#1) @toolmantim
* Adds a new Widgets API (#2) @toolmantim
* Added great distance (#16) @toolmantim
* Add ⛰ technology (#7) @toolmantim
* Add all the tests (#13) @toolmantim
* 1️⃣ Switch to a monorepo (#9) @toolmantim
`,
              draft: true,
              'tag_name': '',
            });
            return true;
          },
        )
        .reply(200);

      payload = require('./fixtures/payload/push');

      await run();

      stdoutContains(spyOn, [
        '> Found 0 releases',
        '> No draft release found',
        '> No last release found',
        '> Fetching all commits for branch master',
        '> Creating new release',
      ]);

      expect(fn).toBeCalledTimes(1);
    });
  });

  describe('with sort-direction config', () => {
    it('sorts ascending', async() => {
      getConfigMock('config-with-sort-direction-ascending.yml');
      const fn    = jest.fn();
      const spyOn = spyOnStdout();

      nock('https://api.github.com')
        .post('/graphql', body =>
          body.query.includes('query findCommitsWithAssociatedPullRequests'),
        )
        .reply(200, getApiFixture(fixtureRootDir, 'graphql-commits-paginated-1'))
        .post('/graphql', body =>
          body.query.includes('query findCommitsWithAssociatedPullRequests'),
        )
        .reply(200, getApiFixture(fixtureRootDir, 'graphql-commits-paginated-2'));

      nock('https://api.github.com')
        .get(
          '/repos/toolmantim/release-drafter-test-project/releases?per_page=100',
        )
        .reply(200, []);

      nock('https://api.github.com')
        .post(
          '/repos/toolmantim/release-drafter-test-project/releases',
          body => {
            fn();
            expect(body).toMatchObject({
              body: `# What's Changed

* Create new-feature.md (#1) @toolmantim
* Adds a new Widgets API (#2) @toolmantim
* 🐒 Add monkeys technology (#3) @toolmantim
* 🐄 More cowbell (#4) @toolmantim
* 🙅🏼‍♂️ 🐄 (#5) @toolmantim
* 👽 Added alien technology (#6) @toolmantim
* Add ⛰ technology (#7) @toolmantim
* 👽 Integrate Alien technology (#8) @toolmantim
* 1️⃣ Switch to a monorepo (#9) @toolmantim
* 🐄 Moar cowbell (#10) @toolmantim
* 🎃 More pumpkins (#11) @toolmantim
* 🤖 Add robots (#12) @toolmantim
* Add all the tests (#13) @toolmantim
* ❤️ Add MOAR THINGS (#14) @toolmantim
* Oh hai (#15) @toolmantim
* Added great distance (#16) @toolmantim
`,
              draft: true,
              'tag_name': '',
            });
            return true;
          },
        )
        .reply(200);

      payload = require('./fixtures/payload/push');

      await run();

      stdoutContains(spyOn, [
        '> Found 0 releases',
        '> No draft release found',
        '> No last release found',
        '> Fetching all commits for branch master',
        '> Creating new release',
      ]);

      expect(fn).toBeCalledTimes(1);
    });
  });

  describe('config error handling', () => {
    it('schema error', async() => {
      getConfigMock('config-with-schema-error.yml');
      const spyOn = spyOnStdout();

      payload = require('./fixtures/payload/push');

      await expect(run()).rejects.toThrow('Invalid config file');

      stdoutContains(spyOn, [
        '::error::error() must return an Error object',
      ]);
    });
  });

  describe('with config-name input', () => {
    it('loads from another config path', async() => {
      process.env['INPUT_CONFIG-NAME'] = 'config-name-input.yml';
      const fn                         = jest.fn();
      const spyOn                      = spyOnStdout();

      // Mock config request for file 'config-name-input.yml'
      const getConfigScope = getConfigMock(
        'config-name-input.yml',
        'config-name-input.yml',
      );

      nock('https://api.github.com')
        .post('/graphql', body =>
          body.query.includes('query findCommitsWithAssociatedPullRequests'),
        )
        .reply(200, getApiFixture(fixtureRootDir, 'graphql-commits-no-prs'));

      nock('https://api.github.com')
        .get('/repos/toolmantim/release-drafter-test-project/releases')
        .query(true)
        .reply(200, [getApiFixture(fixtureRootDir, 'release')])
        .post(
          '/repos/toolmantim/release-drafter-test-project/releases',
          body => {
            fn();
            // Assert that the correct body was used
            expect(body).toMatchObject({
              name: '',
              'tag_name': '',
              body: '# There\'s new stuff!\n',
              draft: true,
            });
            return true;
          },
        )
        .reply(200);

      payload = require('./fixtures/payload/push');

      await run();

      // Assert that the GET request was called for the correct config file
      expect(getConfigScope.isDone()).toBe(true);

      stdoutContains(spyOn, [
        '> Found 1 releases',
        '> No draft release found',
        '> Last release: v2.0.0',
        '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
        '> Creating new release',
      ]);

      expect(fn).toBeCalledTimes(1);
    });
  });

  describe('input version, tag and name overrides', () => {
    // Method with all the test's logic, to prevent duplication
    const overridesTest = async(overrides, expectedBody, callback): Promise<void> => {
      if (overrides) {
        if (overrides.version) {
          process.env.INPUT_VERSION = overrides.version;
        }

        if (overrides.tag) {
          process.env.INPUT_TAG = overrides.tag;
        }

        if (overrides.name) {
          process.env.INPUT_NAME = overrides.name;
        }
      }
      const fn    = jest.fn();
      const spyOn = spyOnStdout();

      getConfigMock('config-with-input-version-template.yml');

      nock('https://api.github.com')
        .get('/repos/toolmantim/release-drafter-test-project/releases')
        .query(true)
        .reply(200, [getApiFixture(fixtureRootDir, 'release')]);

      nock('https://api.github.com')
        .post('/graphql', body =>
          body.query.includes('query findCommitsWithAssociatedPullRequests'),
        )
        .reply(
          200,
          getApiFixture(fixtureRootDir, '__generated__/graphql-commits-merge-commit'),
        );

      nock('https://api.github.com')
        .post(
          '/repos/toolmantim/release-drafter-test-project/releases',
          body => {
            fn();
            expect(body).toMatchObject(expectedBody);
            return true;
          },
        )
        .reply(200);

      payload = require('./fixtures/payload/push');

      await run();

      callback(spyOn, fn);
    };

    describe('with just the version', () => {
      it('forces the version on templates', async() => {
        return overridesTest(
          {version: '2.1.1'},
          {
            body: 'Placeholder with example. Automatically calculated values based on previous releases are next major=3.0.0, minor=2.1.0, patch=2.0.1. Manual input version is 2.1.1.',
            draft: true,
            name: 'v2.1.1 (Code name: Placeholder)',
            'tag_name': 'v2.1.1',
          },
          (spyOn, fn) => {
            stdoutContains(spyOn, [
              '> Found 1 releases',
              '> No draft release found',
              '> Last release: v2.0.0',
              '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
              '> Creating new release',
            ]);

            expect(fn).toBeCalledTimes(1);
          },
        );
      });
    });

    describe('with just the tag', () => {
      it('gets the version from the tag and forces using the tag', async() => {
        return overridesTest(
          {tag: 'v2.1.1-alpha'},
          {
            body: 'Placeholder with example. Automatically calculated values based on previous releases are next major=3.0.0, minor=2.1.0, patch=2.0.1. Manual input version is 2.1.1.',
            draft: true,
            name: 'v2.1.1 (Code name: Placeholder)',
            'tag_name': 'v2.1.1-alpha',
          },
          (spyOn, fn) => {
            stdoutContains(spyOn, [
              '> Found 1 releases',
              '> No draft release found',
              '> Last release: v2.0.0',
              '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
              '> Creating new release',
            ]);

            expect(fn).toBeCalledTimes(1);
          },
        );
      });
    });

    describe('with just the name', () => {
      it('gets the version from the name and forces using the name', async() => {
        return overridesTest(
          {name: 'v2.1.1-alpha (Code name: Foxtrot Unicorn)'},
          {
            body: 'Placeholder with example. Automatically calculated values based on previous releases are next major=3.0.0, minor=2.1.0, patch=2.0.1. Manual input version is 2.1.1.',
            draft: true,
            name: 'v2.1.1-alpha (Code name: Foxtrot Unicorn)',
            'tag_name': 'v2.1.1',
          },
          (spyOn, fn) => {
            stdoutContains(spyOn, [
              '> Found 1 releases',
              '> No draft release found',
              '> Last release: v2.0.0',
              '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
              '> Creating new release',
            ]);

            expect(fn).toBeCalledTimes(1);
          },
        );
      });
    });

    describe('with tag and name', () => {
      it('gets the version from the tag and forces using the tag and name', async() => {
        return overridesTest(
          {
            tag: 'v2.1.1-foxtrot-unicorn-alpha',
            name: 'Foxtrot Unicorn',
          },
          {
            body: 'Placeholder with example. Automatically calculated values based on previous releases are next major=3.0.0, minor=2.1.0, patch=2.0.1. Manual input version is 2.1.1.',
            draft: true,
            name: 'Foxtrot Unicorn',
            'tag_name': 'v2.1.1-foxtrot-unicorn-alpha',
          },
          (spyOn, fn) => {
            stdoutContains(spyOn, [
              '> Found 1 releases',
              '> No draft release found',
              '> Last release: v2.0.0',
              '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
              '> Creating new release',
            ]);

            expect(fn).toBeCalledTimes(1);
          },
        );
      });
    });
  });

  describe('resolved version', () => {
    describe('without previous releases, overriding the tag', () => {
      it('resolves to the version extracted from the tag', async() => {
        process.env.INPUT_TAG = 'v1.0.2';
        const fn              = jest.fn();
        const spyOn           = spyOnStdout();

        getConfigMock('config-with-resolved-version-template.yml');

        nock('https://api.github.com')
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(200, getApiFixture(fixtureRootDir, 'graphql-commits-empty'));

        nock('https://api.github.com')
          .get('/repos/toolmantim/release-drafter-test-project/releases')
          .query(true)
          .reply(200, [])
          .post(
            '/repos/toolmantim/release-drafter-test-project/releases',
            body => {
              fn();
              expect(body).toMatchObject({
                name: 'v1.0.2 🌈',
                'tag_name': 'v1.0.2',
              });
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 0 releases',
          '> No draft release found',
          '> No last release found',
          '> Fetching all commits for branch master',
          '> Creating new release',
        ]);

        expect(fn).toBeCalledTimes(1);
      });
    });

    describe('with previous releases, overriding the tag', () => {
      it('resolves to the version extracted from the tag', async() => {
        process.env.INPUT_TAG = 'v1.0.2';
        const fn              = jest.fn();
        const spyOn           = spyOnStdout();

        getConfigMock('config-with-resolved-version-template.yml');

        nock('https://api.github.com')
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(200, getApiFixture(fixtureRootDir, 'graphql-commits-no-prs'));

        nock('https://api.github.com')
          .get('/repos/toolmantim/release-drafter-test-project/releases')
          .query(true)
          .reply(200, [getApiFixture(fixtureRootDir, 'release')])
          .post(
            '/repos/toolmantim/release-drafter-test-project/releases',
            body => {
              fn();
              expect(body).toMatchObject({
                name: 'v1.0.2 🌈',
                'tag_name': 'v1.0.2',
              });
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 1 releases',
          '> No draft release found',
          '> Last release: v2.0.0',
          '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
          '> Creating new release',
        ]);

        expect(fn).toBeCalledTimes(1);
      });
    });

    describe('without previous releases, no overrides', () => {
      it('resolves to the calculated version, which will be empty', async() => {
        getConfigMock('config-with-resolved-version-template.yml');
        const fn    = jest.fn();
        const spyOn = spyOnStdout();

        nock('https://api.github.com')
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(200, getApiFixture(fixtureRootDir, 'graphql-commits-empty'));

        nock('https://api.github.com')
          .get('/repos/toolmantim/release-drafter-test-project/releases')
          .query(true)
          .reply(200, [])
          .post(
            '/repos/toolmantim/release-drafter-test-project/releases',
            body => {
              fn();
              expect(body).toMatchObject({
                name: '',
                'tag_name': '',
              });
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 0 releases',
          '> No draft release found',
          '> No last release found',
          '> Fetching all commits for branch master',
          '> Creating new release',
        ]);

        expect(fn).toBeCalledTimes(1);
      });
    });

    describe('with previous releases, no overrides', () => {
      it('resolves to the calculated version', async() => {
        getConfigMock('config-with-resolved-version-template.yml');
        const fn    = jest.fn();
        const spyOn = spyOnStdout();

        nock('https://api.github.com')
          .post('/graphql', body =>
            body.query.includes('query findCommitsWithAssociatedPullRequests'),
          )
          .reply(200, getApiFixture(fixtureRootDir, 'graphql-commits-no-prs'));

        nock('https://api.github.com')
          .get('/repos/toolmantim/release-drafter-test-project/releases')
          .query(true)
          .reply(200, [getApiFixture(fixtureRootDir, 'release')])
          .post(
            '/repos/toolmantim/release-drafter-test-project/releases',
            body => {
              fn();
              expect(body).toMatchObject({
                name: 'v2.0.1 🌈',
                'tag_name': 'v2.0.1',
              });
              return true;
            },
          )
          .reply(200);

        payload = require('./fixtures/payload/push');

        await run();

        stdoutContains(spyOn, [
          '> Found 1 releases',
          '> No draft release found',
          '> Last release: v2.0.0',
          '> Fetching all commits for branch master since 2018-06-29T05:47:08Z',
          '> Creating new release',
        ]);

        expect(fn).toBeCalledTimes(1);
      });
    });
  });
});
