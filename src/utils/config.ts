import { Octokit } from '@octokit/rest';
import { validateSchema } from './schema';
import { DEFAULT_CONFIG } from './default-config';
import { Logger } from '@technote-space/github-action-helper';
import { getConfig as getRepoConfig } from '@technote-space/github-action-config-helper';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getConfig = async(defaultBranch: string, configName: string, logger: Logger, octokit: Octokit, context): Promise<any | null> => {
	try {
		return validateSchema(defaultBranch, logger, {...DEFAULT_CONFIG, ...await getRepoConfig(configName, octokit, context)});
	} catch (error) {
		logger.error(error.message);
		logger.error('Invalid config file');

		return null;
	}
};
