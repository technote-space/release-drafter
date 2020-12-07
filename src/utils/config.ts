import {Octokit} from '@technote-space/github-action-helper/dist/types';
import {Context} from '@actions/github/lib/context';
import {validateSchema} from './schema';
import {DEFAULT_CONFIG} from './default-config';
import {Logger} from '@technote-space/github-action-log-helper';
import {getConfig as getRepoConfig} from '@technote-space/github-action-config-helper';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getConfig = async(defaultBranch: string, configName: string, logger: Logger, octokit: Octokit, context: Context): Promise<any> | never => {
  const config = await getRepoConfig(configName, octokit, context);
  if (typeof config === 'boolean') {
    logger.error('"template" is required');
    throw new Error('Invalid config file');
  }

  try {
    return validateSchema(defaultBranch, logger, {...DEFAULT_CONFIG, ...config});
  } catch (error) {
    logger.error(error.message);
    throw new Error('Invalid config file');
  }
};
