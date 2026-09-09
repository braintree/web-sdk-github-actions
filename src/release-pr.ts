import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as github from "@actions/github";
import { getRequiredEnv } from "./utils";

const newVersion = getRequiredEnv("NEW_VERSION");
const baseBranch = getRequiredEnv("BASE_BRANCH");
const bumpBranch = getRequiredEnv("BUMP_BRANCH");
const githubToken = getRequiredEnv("GITHUB_TOKEN");
const [owner, repo] = getRequiredEnv("GITHUB_REPOSITORY").split("/");

// Default-true: only an explicit "false" disables PR creation, so existing
// consumers that don't set CREATE_PR keep their current behavior.
const createPr = process.env.CREATE_PR !== "false";

async function run(): Promise<void> {
  const releaseTag = `v${newVersion}`;

  // Push the bump branch. On merge, a separate workflow tags and deploys.
  // We don't wait on the merge, and we don't tag here. Tagging happens on merge.
  await exec.exec("git", ["push", "-u", "origin", bumpBranch]);

  // Some orgs disable "Allow GitHub Actions to create and approve pull
  // requests". There, pulls.create fails, so callers can set create-pr: false
  // and open the PR manually instead.
  if (!createPr) {
    core.setOutput("pr_url", "");
    core.summary.addRaw(
      `#### Release branch pushed for ${releaseTag}\n` +
        `PR creation is disabled (create-pr: false). ` +
        `Open a pull request from \`${bumpBranch}\` into \`${baseBranch}\` to continue the release.`,
    );
    await core.summary.write();
    return;
  }

  const octokit = github.getOctokit(githubToken);
  const { data: pr } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: `chore: release ${releaseTag}`,
    body: `Version bump and changelog for ${releaseTag}.`,
    base: baseBranch,
    head: bumpBranch,
  });

  core.setOutput("pr_url", pr.html_url);
  core.summary.addRaw(`#### Opened release PR for ${releaseTag}: ${pr.html_url}`);
  await core.summary.write();
}

run().catch((error: Error) => core.setFailed(error.message));
