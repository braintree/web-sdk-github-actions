import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as semver from 'semver';
import { readFileSync, writeFileSync } from 'node:fs';
import { getRequiredEnv } from './utils';

const versionType = getRequiredEnv('VERSION_TYPE');
const featureTag = process.env.FEATURE_TAG ?? '';
const isDryRun = process.env.DRY_RUN === 'true';

const PRE_RELEASE_TYPES = ['beta', 'alpha', 'rc'] as const;
type PreReleaseType = (typeof PRE_RELEASE_TYPES)[number];

function isPreRelease(type: string): type is PreReleaseType {
  return PRE_RELEASE_TYPES.includes(type as PreReleaseType);
}

async function run(): Promise<void> {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const currentVersion: string = packageJson.version;

  let newVersion: string;

  if (isPreRelease(versionType)) {
    const preid = featureTag ? `${versionType}-${featureTag}` : versionType;

    if (isDryRun) {
      const bumpType = currentVersion.includes('-') ? 'prerelease' : 'preminor';
      newVersion = semver.inc(currentVersion, bumpType, preid) ?? '';
    } else {
      const bumpType = currentVersion.includes('-') ? 'prerelease' : 'preminor';
      const { stdout } = await exec.getExecOutput('npm', [
        'version',
        bumpType,
        `--preid=${preid}`,
        '--no-git-tag-version',
      ]);
      newVersion = stdout.trim().replace(/^v/, '');
    }
  } else {
    if (isDryRun) {
      newVersion = semver.inc(currentVersion, versionType as semver.ReleaseType) ?? '';
    } else {
      const { stdout } = await exec.getExecOutput('npm', [
        'version',
        versionType,
        '--no-git-tag-version',
      ]);
      newVersion = stdout.trim().replace(/^v/, '');
    }
  }

  if (!newVersion) {
    core.setFailed(`Failed to calculate new version from ${currentVersion} with type ${versionType}`);
    return;
  }

  if (!isDryRun) {
    const today = new Date().toISOString().slice(0, 10);
    const changelog = readFileSync('CHANGELOG.md', 'utf8');
    writeFileSync('CHANGELOG.md', changelog.replace(/^## UNRELEASED/im, `## ${newVersion} (${today})`));

    await exec.exec('git', ['add', 'package.json', 'package-lock.json', 'CHANGELOG.md']);
    await exec.exec('git', ['commit', '-m', `chore(release): v${newVersion}`]);
  } else {
    core.info('DRY RUN — no files modified, no git commit created');
    core.info(`  Repository    : ${process.env.GITHUB_REPOSITORY ?? ''}`);
    core.info(`  Actor         : ${process.env.GITHUB_ACTOR ?? ''}`);
    core.info(`  Base branch   : ${process.env.BASE_BRANCH ?? ''}`);
    core.info(`  Bump type     : ${versionType}`);
    core.info(`  Feature tag   : ${featureTag}`);
    core.info(`  Would release : v${newVersion}`);
  }

  core.setOutput('new_version', newVersion);
  core.summary.addRaw(`### Version Bump\n${versionType} → **${newVersion}**`);
  await core.summary.write();
}

run().catch((error: Error) => core.setFailed(error.message));
