"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const github_action_helper_1 = require("@technote-space/github-action-helper");
exports.TARGET_EVENTS = {
    'create': [
        (context) => github_action_helper_1.Utils.isSemanticVersioningTagName(github_action_helper_1.ContextHelper.getTagName(context)),
    ],
    'release': [
        [
            'published',
            (context) => github_action_helper_1.Utils.isSemanticVersioningTagName(github_action_helper_1.ContextHelper.getTagName(context)),
        ],
    ],
    'push': [
        (context) => github_action_helper_1.Utils.isSemanticVersioningTagName(github_action_helper_1.ContextHelper.getTagName(context)),
    ],
};
