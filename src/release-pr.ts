import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import { getRequiredEnv } from './utils';

const newVersion = getRequiredEnv('NEW_VERSION');
const baseBranch = getRequiredEnv('BASE_BRANCH');
const githubToken = getRequiredEnv('GITHUB_TOKEN');
const [owner, repo] = getRequiredEnv('GITHUB_REPOSITORY').split('/');
const isDryRun = process.env.DRY_RUN === 'true';

const POLL_INITIAL_DELAY_MS = 10_000;
const POLL_MAX_DELAY_MS = 60_000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

async function run(): Promise<void> {
  if (isDryRun) {
    core.info('DRY RUN — skipping release branch, PR creation, and tagging');
    return;
  }

  const releaseBranch = 'release';
  const octokit = github.getOctokit(githubToken);

  await exec.exec('git', ['checkout', releaseBranch]);
  await exec.exec('git', ['push', '-u', 'origin', releaseBranch]);

  const { data: pr } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: `Release v${newVersion}`,
    body: `Updated changelog for release v${newVersion}`,
    base: baseBranch,
    head: releaseBranch,
  });

  await octokit.graphql(
    `mutation EnableAutoMerge($pullRequestId: ID!) {
      enablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId, mergeMethod: SQUASH }) {
        pullRequest { number }
      }
    }`,
    { pullRequestId: pr.node_id }
  );

  core.info(`Waiting for PR #${pr.number} to merge...`);
  await waitForMerge(octokit, pr.number);

  await octokit.rest.git.deleteRef({ owner, repo, ref: `heads/${releaseBranch}` });

  await exec.exec('git', ['checkout', baseBranch]);
  await exec.exec('git', ['pull', 'origin', baseBranch]);
  await exec.exec('git', ['tag', '-m', `v${newVersion}`, `v${newVersion}`]);
  await exec.exec('git', ['push', 'origin', `v${newVersion}`]);

  core.setOutput('pr_url', pr.html_url);
  core.summary.addRaw(`#### Merged release PR: ${pr.html_url}`);
  await core.summary.write();
}

async function waitForMerge(
  octokit: ReturnType<typeof github.getOctokit>,
  prNumber: number
): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let delay = POLL_INITIAL_DELAY_MS;

  while (Date.now() < deadline) {
    await sleep(delay);
    const { data: current } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });

    if (current.merged) {
      core.info('PR merged');
      return;
    }
    if (current.state === 'closed') {
      throw new Error(`PR #${prNumber} was closed without merging`);
    }

    delay = Math.min(delay * 2, POLL_MAX_DELAY_MS);
  }

  throw new Error(`Timed out waiting for PR #${prNumber} to merge`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

run().catch((error: Error) => core.setFailed(error.message));
