import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as github from "@actions/github";
import { getRequiredEnv } from "./utils";

const newVersion = getRequiredEnv("NEW_VERSION");
const baseBranch = getRequiredEnv("BASE_BRANCH");
const githubToken = getRequiredEnv("GITHUB_TOKEN");
const [owner, repo] = getRequiredEnv("GITHUB_REPOSITORY").split("/");

async function run(): Promise<void> {
  const releaseTag = `v${newVersion}`;
  const octokit = github.getOctokit(githubToken);

  await exec.exec("git", ["push", "origin", "release"]);

  await exec.exec("git", ["tag", "-m", releaseTag, releaseTag]);
  await exec.exec("git", ["push", "origin", releaseTag]);

  const { data: pr } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: `Release ${releaseTag}`,
    body: `Sync release ${releaseTag} back into ${baseBranch}`,
    base: baseBranch,
    head: "release",
  });

  try {
    await octokit.graphql(
      `mutation EnableAutoMerge($pullRequestId: ID!) {
        enablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId, mergeMethod: SQUASH }) {
          pullRequest { number }
        }
      }`,
      { pullRequestId: pr.node_id },
    );
  } catch (error) {
    core.warning(`Could not enable auto-merge on PR #${pr.number}: ${(error as Error).message}`);
  }

  core.setOutput("pr_url", pr.html_url);
  core.summary.addRaw(
    `#### Released ${releaseTag} from the release branch. Sync PR into ${baseBranch}: ${pr.html_url}`,
  );
  await core.summary.write();
}

run().catch((error: Error) => core.setFailed(error.message));
