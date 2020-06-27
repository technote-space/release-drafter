export const SORT_BY = {
  mergedAt: 'merged_at',
  title: 'title',
};

export const SORT_DIRECTIONS = {
  ascending: 'ascending',
  descending: 'descending',
};

type prType = {
  mergedAt: string;
  title: string;
}

const getMergedAt = (pullRequest: prType): Date => new Date(pullRequest.mergedAt);

const getTitle = (pullRequest: prType): string => pullRequest.title;

const dateSortAscending = (date1, date2): number => {
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

const dateSortDescending = (date1, date2): number => {
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

export const sortPullRequests = (pullRequests: Array<prType>, sortBy: string, sortDirection: string): Array<prType> => {
  const getSortFieldFn = sortBy === SORT_BY.title ? getTitle : getMergedAt;
  const sortFn         = sortDirection === SORT_DIRECTIONS.ascending ? dateSortAscending : dateSortDescending;

  return pullRequests
    .slice()
    .sort((pr1, pr2) => sortFn(getSortFieldFn(pr1), getSortFieldFn(pr2)));
};
