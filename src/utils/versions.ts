import semver from 'semver';

type SplitSemVerType = {
  inc: string;
  version: string;
  $MAJOR: string;
  $MINOR: string;
  $PATCH: string;
};

type TemplatableVersionType = {
  $NEXT_MAJOR_VERSION: SplitSemVerType | undefined;
  $NEXT_MINOR_VERSION: SplitSemVerType | undefined;
  $NEXT_PATCH_VERSION: SplitSemVerType | undefined;
  $INPUT_VERSION: SplitSemVerType | undefined;
  $RESOLVED_VERSION: SplitSemVerType | undefined;
}

const splitSemVer = (input, versionKey = 'version'): SplitSemVerType | undefined => {
  if (!input[versionKey]) {
    return undefined;
  }

  const version = input.inc
    ? semver.inc(input[versionKey], input.inc, true)
    : semver.parse(input[versionKey]);

  return {
    ...input,
    version,
    $MAJOR: semver.major(version),
    $MINOR: semver.minor(version),
    $PATCH: semver.patch(version),
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTemplatableVersion = (input: any): TemplatableVersionType => {
  const templatableVersion = {
    $NEXT_MAJOR_VERSION: splitSemVer({...input, inc: 'major'}),
    $NEXT_MINOR_VERSION: splitSemVer({...input, inc: 'minor'}),
    $NEXT_PATCH_VERSION: splitSemVer({...input, inc: 'patch'}),
    $INPUT_VERSION: splitSemVer(input, 'inputVersion'),
  };

  return {$RESOLVED_VERSION: templatableVersion.$INPUT_VERSION || templatableVersion.$NEXT_PATCH_VERSION, ...templatableVersion};
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const coerceVersion = (input: any): any => {
  if (!input) {
    return null;
  }

  return typeof input === 'object'
    ? semver.coerce(input.tag_name) || semver.coerce(input.name)
    : semver.coerce(input);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
export const getVersionInfo = (release, template?: any, inputVersion?: any): TemplatableVersionType | undefined => {
  const version = coerceVersion(release);
  inputVersion  = coerceVersion(inputVersion);

  if (!version && !inputVersion) {
    return undefined;
  }

  return {
    ...getTemplatableVersion({
      version,
      template,
      inputVersion,
    }),
  };
};
