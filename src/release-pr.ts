import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as github from "@actions/github";
import { getRequiredEnv } from "./utils";

const newVersion = getRequiredEnv("NEW_VERSION");
const baseBranch = getRequiredEnv("BASE_BRANCH");
const bumpBranch = getRequiredEnv("BUMP_BRANCH");
const githubToken = getRequiredEnv("GITHUB_TOKEN");
const [owner, repo] = getRequiredEnv("GITHUB_REPOSITORY").split("/");
const isDryRun = process.env.DRY_RUN === "true";

async function run(): Promise<void> {
  const releaseTag = `v${newVersion}`;

  if (isDryRun) {
    core.info(`DRY RUN: skipping branch push and PR creation for "${releaseTag}".`);

    return;
  }

  // Push the bump branch and open a PR into the base branch. That's all we do here.
  // A human approves and merges the PR, and the merge is what kicks off the deploy.
  // We don't wait on the merge, and we don't tag. Tagging happens on merge.
  await exec.exec("git", ["push", "-u", "origin", bumpBranch]);

  const octokit = github.getOctokit(githubToken);
  const { data: pr } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: `Release ${releaseTag}`,
    body: `Version bump and changelog for ${releaseTag}.`,
    base: baseBranch,
    head: bumpBranch,
  });

  core.setOutput("pr_url", pr.html_url);
  core.summary.addRaw(`#### Opened release PR for ${releaseTag}: ${pr.html_url}`);
  await core.summary.write();
}

run().catch((error: Error) => core.setFailed(error.message));
