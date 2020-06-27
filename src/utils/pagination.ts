import _ from 'lodash';

/**
 * Utility function to paginate a GraphQL function using Relay-style cursor pagination.
 *
 * @param {function} queryFn - function used to query the GraphQL API
 * @param {string} query - GraphQL query, must include `nodes` and `pageInfo` fields for the field that will be paginated
 * @param {object} variables variables
 * @param {string[]} paginatePath - path to field to paginate
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
export const paginate = async(queryFn, query, variables, paginatePath): Promise<any> => {
  const nodesPath       = [...paginatePath, 'nodes'];
  const pageInfoPath    = [...paginatePath, 'pageInfo'];
  const endCursorPath   = [...pageInfoPath, 'endCursor'];
  const hasNextPagePath = [...pageInfoPath, 'hasNextPage'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasNextPage     = (data: any): any => _.get(data, hasNextPagePath);

  const data = await queryFn(query, variables);

  if (!_.has(data, nodesPath)) {
    throw new Error(
      'Data doesn\'t contain `nodes` field. Make sure the `paginatePath` is set to the field you wish to paginate and that the query includes the `nodes` field.',
    );
  }

  if (
    !_.has(data, pageInfoPath) ||
    !_.has(data, endCursorPath) ||
    !_.has(data, hasNextPagePath)
  ) {
    throw new Error(
      'Data doesn\'t contain `pageInfo` field with `endCursor` and `hasNextPage` fields. Make sure the `paginatePath` is set to the field you wish to paginate and that the query includes the `pageInfo` field.',
    );
  }

  while (hasNextPage(data)) {
    const newData     = await queryFn(query, {
      ...variables,
      after: _.get(data, [...pageInfoPath, 'endCursor']),
    });
    const newNodes    = _.get(newData, nodesPath);
    const newPageInfo = _.get(newData, pageInfoPath);

    _.set(data, pageInfoPath, newPageInfo);
    _.update(data, nodesPath, data => data.concat(newNodes));
  }

  return data;
};
