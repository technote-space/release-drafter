import { DEFAULT_CONFIG } from '../src/utils/default-config';
import { getConfig } from '../src/utils/config';
import { SORT_DIRECTIONS } from '../src/utils/sort-pull-requests';
import { Logger } from '@technote-space/github-action-helper';
import { getOctokit, getContext, spyOnStdout, stdoutContains } from '@technote-space/github-action-test-helper';

const logger = new Logger();

describe('getConfig', () => {
	it('returns defaults', async() => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const spy = jest.spyOn(require('@technote-space/github-action-config-helper'), 'getConfig').mockImplementation(() => ({
			template: '$CHANGES',
		}));

		expect(await getConfig('master', '', logger, getOctokit(), getContext({
			payload: {repository: {'default_branch': 'master'}},
		}))).toEqual({
			...DEFAULT_CONFIG,
			template: '$CHANGES',
			branches: ['master'],
		});

		spy.mockReset();
		spy.mockRestore();
	});

	describe('`replacers` option', () => {
		it('validates `replacers` option', async() => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const spy   = jest.spyOn(require('@technote-space/github-action-config-helper'), 'getConfig').mockImplementation(() => ({
				replacers: 'bogus',
			}));
			const spyOn = spyOnStdout();

			await expect(getConfig('master', '', logger, getOctokit(), getContext({
				payload: {repository: {'default_branch': 'master'}},
			}))).rejects.toThrow('Invalid config file');

			stdoutContains(spyOn, [
				'::error::"replacers" must be an array. "template" is required',
			]);

			spy.mockReset();
			spy.mockRestore();
		});

		it('accepts valid `replacers`', async() => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const spy = jest.spyOn(require('@technote-space/github-action-config-helper'), 'getConfig').mockImplementation(() => ({
				template: '$CHANGES',
				replacers: [{search: 'search', replace: 'replace'}],
			}));

			const config = await getConfig('master', '', logger, getOctokit(), getContext({
				payload: {repository: {'default_branch': 'master'}},
			}));

			expect(config['replacers']).toEqual([
				{search: expect.any(RegExp), replace: 'replace'},
			]);

			spy.mockReset();
			spy.mockRestore();
		});
	});

	describe('`sort-direction` option', () => {
		it('validates `sort-direction` option', async() => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const spy   = jest.spyOn(require('@technote-space/github-action-config-helper'), 'getConfig').mockImplementation(() => ({
				'sort-direction': 'bogus',
			}));
			const spyOn = spyOnStdout();

			await expect(getConfig('master', '', logger, getOctokit(), getContext({
				payload: {repository: {'default_branch': 'master'}},
			}))).rejects.toThrow('Invalid config file');

			stdoutContains(spyOn, [
				'::error::"sort-direction" must be one of [ascending, descending]. "template" is required',
			]);

			spy.mockReset();
			spy.mockRestore();
		});

		it('accepts a valid `sort-direction`', async() => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const spy = jest.spyOn(require('@technote-space/github-action-config-helper'), 'getConfig').mockImplementation(() => ({
				template: '$CHANGES',
				'sort-direction': SORT_DIRECTIONS.ascending,
			}));

			const config = await getConfig('master', '', logger, getOctokit(), getContext({
				payload: {repository: {'default_branch': 'master'}},
			}));

			expect(config['sort-direction']).toBe(SORT_DIRECTIONS.ascending);

			spy.mockReset();
			spy.mockRestore();
		});
	});
});
