/* eslint-disable no-magic-numbers */
import {paginate} from '../src/utils/pagination';

describe('pagination', () => {
  it('concats pagination results', async() => {
    const queryFn = jest.fn();
    // query is empty because we mock the result
    const query   = '';

    queryFn
      .mockReturnValueOnce(
        Promise.resolve({
          repository: {
            ref: {
              target: {
                history: {
                  nodes: ['a', 'b', 'c'],
                  pageInfo: {
                    endCursor: 'aaa',
                    hasNextPage: true,
                  },
                },
              },
            },
          },
        }),
      )
      .mockReturnValueOnce(
        Promise.resolve({
          repository: {
            ref: {
              target: {
                history: {
                  nodes: ['d', 'e', 'f'],
                  pageInfo: {
                    endCursor: 'bbb',
                    hasNextPage: false,
                  },
                },
              },
            },
          },
        }),
      );

    const data = await paginate(queryFn, query, {}, [
      'repository',
      'ref',
      'target',
      'history',
    ]);

    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(data.repository.ref.target.history.nodes).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
    ]);
    expect(data.repository.ref.target.history.pageInfo).toEqual({
      endCursor: 'bbb',
      hasNextPage: false,
    });
  });

  it('throws when query doesn\'t return `nodes` fields', async() => {
    const queryFn = jest.fn();
    // query is empty because we mock the result
    const query   = '';

    queryFn.mockReturnValueOnce(Promise.resolve({}));

    await expect(paginate(queryFn, query, {}, [])).rejects.toThrow();
  });

  it('throws when query doesn\'t return `pageInfo` fields', async() => {
    const queryFn = jest.fn();
    // query is empty because we mock the result
    const query   = '';

    queryFn
      .mockReturnValueOnce(
        Promise.resolve({
          repository: {
            ref: {
              target: {
                history: {
                  nodes: ['a', 'b', 'c'],
                },
              },
            },
          },
        }),
      );

    await expect(paginate(queryFn, query, {}, [
      'repository',
      'ref',
      'target',
      'history',
    ])).rejects.toThrow();
  });
});
