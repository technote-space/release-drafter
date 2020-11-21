"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVersionInfo = void 0;
const semver_1 = __importDefault(require("semver"));
const splitSemVer = (input, versionKey = 'version') => {
    if (!input[versionKey]) {
        return undefined;
    }
    const version = input.inc
        ? semver_1.default.inc(input[versionKey], input.inc, true)
        : semver_1.default.parse(input[versionKey]);
    return Object.assign(Object.assign({}, input), { version, $MAJOR: semver_1.default.major(version), $MINOR: semver_1.default.minor(version), $PATCH: semver_1.default.patch(version) });
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTemplatableVersion = (input) => {
    const templatableVersion = {
        $NEXT_MAJOR_VERSION: splitSemVer(Object.assign(Object.assign({}, input), { inc: 'major' })),
        $NEXT_MINOR_VERSION: splitSemVer(Object.assign(Object.assign({}, input), { inc: 'minor' })),
        $NEXT_PATCH_VERSION: splitSemVer(Object.assign(Object.assign({}, input), { inc: 'patch' })),
        $INPUT_VERSION: splitSemVer(input, 'inputVersion'),
    };
    return Object.assign({ $RESOLVED_VERSION: templatableVersion.$INPUT_VERSION || templatableVersion.$NEXT_PATCH_VERSION }, templatableVersion);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const coerceVersion = (input) => {
    if (!input) {
        return null;
    }
    return typeof input === 'object'
        ? semver_1.default.coerce(input.tag_name) || semver_1.default.coerce(input.name)
        : semver_1.default.coerce(input);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
const getVersionInfo = (release, template, inputVersion) => {
    const version = coerceVersion(release);
    inputVersion = coerceVersion(inputVersion);
    if (!version && !inputVersion) {
        return undefined;
    }
    return Object.assign({}, getTemplatableVersion({
        version,
        template,
        inputVersion,
    }));
};
exports.getVersionInfo = getVersionInfo;
