import * as core from '@actions/core';
import { getRequiredEnv } from './utils';

const prBody = process.env.PR_BODY ?? '';
const jiraPattern = getRequiredEnv('JIRA_PATTERN');

const regex = new RegExp(jiraPattern);

if (!regex.test(prBody)) {
  core.setFailed(
    'Missing Jira ticket link in PR body. Include the full Jira ticket link:\n' +
      '  | [Jira ticket](https://paypal.atlassian.net/browse/DTBTWEB-123) |'
  );
}
