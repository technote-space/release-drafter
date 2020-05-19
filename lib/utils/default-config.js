"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = void 0;
const sort_pull_requests_1 = require("./sort-pull-requests");
exports.DEFAULT_CONFIG = Object.freeze({
    'name-template': '',
    'tag-template': '',
    'change-template': '* $TITLE (#$NUMBER) @$AUTHOR',
    'no-changes-template': '* No changes',
    'version-template': '$MAJOR.$MINOR.$PATCH',
    categories: [],
    'exclude-labels': [],
    replacers: [],
    'sort-by': sort_pull_requests_1.SORT_BY.mergedAt,
    'sort-direction': sort_pull_requests_1.SORT_DIRECTIONS.descending,
    prerelease: false,
});
