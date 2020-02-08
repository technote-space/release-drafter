# Release Drafter

[![CI Status](https://github.com/technote-space/release-drafter/workflows/CI/badge.svg)](https://github.com/technote-space/release-drafter/actions)
[![codecov](https://codecov.io/gh/technote-space/release-drafter/branch/master/graph/badge.svg)](https://codecov.io/gh/technote-space/release-drafter)
[![CodeFactor](https://www.codefactor.io/repository/github/technote-space/release-drafter/badge)](https://www.codefactor.io/repository/github/technote-space/release-drafter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/technote-space/release-drafter/blob/master/LICENSE)

This is a `GitHub Actions` create release.  

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
<details>
<summary>Details</summary>

- [Usage](#usage)
- [Configuration](#configuration)
  - [Example](#example)
- [Configuration Options](#configuration-options)
- [Template Variables](#template-variables)
- [Next Version Variables](#next-version-variables)
- [Version Template Variables](#version-template-variables)
- [Change Template Variables](#change-template-variables)
- [Categorize Pull Requests](#categorize-pull-requests)
- [Exclude Pull Requests](#exclude-pull-requests)
- [Replacers](#replacers)
- [Projects that don't use Semantic Versioning](#projects-that-dont-use-semantic-versioning)
- [Action event details](#action-event-details)
  - [Target events](#target-events)
  - [condition](#condition)
- [Action Outputs](#action-outputs)
- [Author](#author)

</details>
<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Usage
e.g. release.yml
```yaml
name: Release Drafter

on:
  push:
    tags:
      - "v*"

jobs:
  update_release_draft:
    runs-on: ubuntu-latest
    steps:
      - uses: technote-space/release-drafter@v1
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
[More details of target event](#action-event-details)

## Configuration

Once you’ve added Release Drafter to your repository, it must be enabled by adding a `.github/release-drafter.yml` configuration file to each repository.

### Example

For example, take the following `.github/release-drafter.yml` file in a repository:

```yml
template: |
  ## What’s Changed

  $CHANGES
```

As pull requests are merged, a draft release is kept up-to-date listing the changes, ready to publish when you’re ready:

The following is a more complicated configuration, which categorises the changes into headings, and automatically suggests the next version number:

```yml
name-template: 'v$NEXT_PATCH_VERSION 🌈'
tag-template: 'v$NEXT_PATCH_VERSION'
categories:
  - title: '🚀 Features'
    labels:
      - 'feature'
      - 'enhancement'
  - title: '🐛 Bug Fixes'
    labels:
      - 'fix'
      - 'bugfix'
      - 'bug'
  - title: '🧰 Maintenance'
    label: 'chore'
change-template: '- $TITLE @$AUTHOR (#$NUMBER)'
template: |
  ## Changes

  $CHANGES
```

## Configuration Options

You can configure Release Drafter using the following key in your `.github/release-drafter.yml` file:

| Key                   | Required | Description                                                                                                                                                                                                       |
| --------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `template`            | Required | The template for the body of the draft release. Use [template variables](#template-variables) to insert values.                                                                                                   |
| `name-template`       | Optional | The template for the name of the draft release. For example: `"v$NEXT_PATCH_VERSION"`.                                                                                                                            |
| `tag-template`        | Optional | The template for the tag of the draft release. For example: `"v$NEXT_PATCH_VERSION"`.                                                                                                                             |
| `version-template`    | Optional | The template to use when calculating the next version number for the release. Useful for projects that don't use semantic versioning. Default: `"$MAJOR.$MINOR.$PATCH"`                                           |
| `change-template`     | Optional | The template to use for each merged pull request. Use [change template variables](#change-template-variables) to insert values. Default: `"* $TITLE (#$NUMBER) @$AUTHOR"`.                                        |
| `no-changes-template` | Optional | The template to use for when there’s no changes. Default: `"* No changes"`.                                                                                                                                       |
| `branches`            | Optional | The branches to listen for configuration updates to `.github/release-drafter.yml` and for merge commits. Useful if you want to test the app on a pull request branch. Default is the repository’s default branch. |
| `categories`          | Optional | Categorize pull requests using labels. Refer to [Categorize Pull Requests](#categorize-pull-requests) to learn more about this option.                                                                            |
| `exclude-labels`      | Optional | Exclude pull requests using labels. Refer to [Exclude Pull Requests](#exclude-pull-requests) to learn more about this option.                                                                                     |
| `replacers`           | Optional | Search and replace content in the generated changelog body. Refer to [Replacers](#replacers) to learn more about this option.                                                                                     |
| `sort-by`             | Optional | Sort changelog by merged_at or title. Can be one of: `merged_at`, `title`. Default: `merged_at`.                                                                                                                  |
| `sort-direction`      | Optional | Sort changelog in ascending or descending order. Can be one of: `ascending`, `descending`. Default: `descending`.                                                                                                 |
| `prerelease`          | Optional | Mark the draft release as pre-release. Default `false`.                                                                                                                                                           |

Release Drafter also supports [Probot Config](https://github.com/probot/probot-config), if you want to store your configuration files in a central repository. This allows you to share configurations between projects, and create a organization-wide configuration file by creating a repository named `.github` with the file `.github/release-drafter.yml`.

## Template Variables

You can use any of the following variables in your `template`:

| Variable        | Description                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `$CHANGES`      | The markdown list of pull requests that have been merged.                                                             |
| `$CONTRIBUTORS` | A comma separated list of contributors to this release (pull request authors, commit authors, and commit committers). |
| `$PREVIOUS_TAG` | The previous releases’s tag.                                                                                          |

## Next Version Variables

You can use any of the following variables in your `template`, `name-template` and `tag-template`:

| Variable              | Description                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$NEXT_PATCH_VERSION` | The next patch version number. For example, if the last tag or release was `v1.2.3`, the value would be `v1.2.4`. This is the most commonly used value. |
| `$NEXT_MINOR_VERSION` | The next minor version number. For example, if the last tag or release was `v1.2.3`, the value would be `v1.3.0`.                                       |
| `$NEXT_MAJOR_VERSION` | The next major version number. For example, if the last tag or release was `v1.2.3`, the value would be `v2.0.0`.                                       |

## Version Template Variables

You can use any of the following variables in `version-template` to format the `$NEXT_{PATCH,MINOR,MAJOR}_VERSION` variables:

| Variable | Description               |
| -------- | ------------------------- |
| `$PATCH` | The patch version number. |
| `$MINOR` | The minor version number. |
| `$MAJOR` | The major version number. |

## Change Template Variables

You can use any of the following variables in `change-template`:

| Variable  | Description                                                 |
| --------- | ----------------------------------------------------------- |
| `$NUMBER` | The number of the pull request, e.g. `42`.                  |
| `$TITLE`  | The title of the pull request, e.g. `Add alien technology`. |
| `$AUTHOR` | The pull request author’s username, e.g. `gracehopper`.     |

## Categorize Pull Requests

With the `categories` option you can categorize pull requests in release notes using labels. For example, append the following to your `.github/release-drafter.yml` file:

```yml
categories:
  - title: '🚀 Features'
    label: 'feature'
  - title: '🐛 Bug Fixes'
    labels:
      - 'fix'
      - 'bugfix'
      - 'bug'
```

Pull requests with the label "feature" or "fix" will now be grouped together:

Adding such labels to your PRs can be automated by using [PR Labeler](https://github.com/TimonVS/pr-labeler-action) or [Probot Auto Labeler](https://github.com/probot/autolabeler).

## Exclude Pull Requests

With the `exclude-labels` option you can exclude pull requests from the release notes using labels. For example, append the following to your `.github/release-drafter.yml` file:

```yml
exclude-labels:
  - 'skip-changelog'
```

Pull requests with the label "skip-changelog" will now be excluded from the release draft.

## Replacers

You can search and replace content in the generated changelog body, using regular expressions, with the `replacers` option. Each replacer is applied in order.

```yml
replacers:
  - search: '/CVE-(\d{4})-(\d+)/g'
    replace: 'https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-$1-$2'
  - search: 'myname'
    replace: 'My Name'
```

## Projects that don't use Semantic Versioning

If your project doesn't follow [Semantic Versioning](https://semver.org) you can still use Release Drafter, but you may want to set the `version-template` option to customize how the `$NEXT_{PATCH,MINOR,MAJOR}_VERSION` environment variables are generated.

For example, if your project doesn't use patch version numbers, you can set `version-template` to `$MAJOR.$MINOR`. If the current release is version 1.0, then `$NEXT_MINOR_VERSION` will be `1.1`.

## Action event details
### Target events
| eventName: action | condition |
|:---:|:---:|
|push: *|[condition](#condition)|
|release: published|[condition](#condition)|
|create: *|[condition](#condition)|
### condition
- tags
  - semantic versioning tag (e.g. `v1.2.3`)

## Action Outputs

The Release Drafter GitHub Action sets a couple of outputs which can be used as inputs to other Actions in the workflow ([example](https://github.com/actions/upload-release-asset#example-workflow---upload-a-release-asset)).

| Output       | Description                                                                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | The ID of the release that was created or updated.                                                                                                                                                                            |
| `html_url`   | The URL users can navigate to in order to view the release. i.e. `https://github.com/octocat/Hello-World/releases/v1.0.0`.                                                                                                    |
| `upload_url` | The URL for uploading assets to the release, which could be used by GitHub Actions for additional uses, for example the [`@actions/upload-release-asset GitHub Action`](https://www.github.com/actions/upload-release-asset). |

## Author
[GitHub (Technote)](https://github.com/technote-space)  
[Blog](https://technote.space)
