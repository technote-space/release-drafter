"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SORT_BY = {
    mergedAt: 'merged_at',
    title: 'title',
};
exports.SORT_DIRECTIONS = {
    ascending: 'ascending',
    descending: 'descending',
};
const getMergedAt = (pullRequest) => new Date(pullRequest.mergedAt);
const getTitle = (pullRequest) => pullRequest.title;
const dateSortAscending = (date1, date2) => {
    if (date1 > date2) {
        // eslint-disable-next-line no-magic-numbers
        return 1;
    }
    if (date1 < date2) {
        // eslint-disable-next-line no-magic-numbers
        return -1;
    }
    // eslint-disable-next-line no-magic-numbers
    return 0;
};
const dateSortDescending = (date1, date2) => {
    if (date1 > date2) {
        // eslint-disable-next-line no-magic-numbers
        return -1;
    }
    if (date1 < date2) {
        // eslint-disable-next-line no-magic-numbers
        return 1;
    }
    // eslint-disable-next-line no-magic-numbers
    return 0;
};
exports.sortPullRequests = (pullRequests, sortBy, sortDirection) => {
    const getSortFieldFn = sortBy === exports.SORT_BY.title ? getTitle : getMergedAt;
    const sortFn = sortDirection === exports.SORT_DIRECTIONS.ascending ? dateSortAscending : dateSortDescending;
    return pullRequests
        .slice()
        .sort((pr1, pr2) => sortFn(getSortFieldFn(pr1), getSortFieldFn(pr2)));
};
