import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as semver from 'semver';
import { readFileSync, writeFileSync } from 'node:fs';
import { getRequiredEnv } from './utils';

const versionType = getRequiredEnv('VERSION_TYPE');
const featureTag = process.env.FEATURE_TAG ?? '';
const prereleaseLevel = process.env.PRERELEASE_LEVEL ?? '';
const isDryRun = process.env.DRY_RUN === 'true';

const PRE_RELEASE_TYPES = ['beta', 'alpha', 'rc'] as const;
type PreReleaseType = (typeof PRE_RELEASE_TYPES)[number];

const PRERELEASE_LEVELS = ['premajor', 'preminor', 'prepatch', 'prerelease'] as const;
type PrereleaseLevel = (typeof PRERELEASE_LEVELS)[number];

function isPreRelease(type: string): type is PreReleaseType {
  return PRE_RELEASE_TYPES.includes(type as PreReleaseType);
}

function isPrereleaseLevel(level: string): level is PrereleaseLevel {
  return PRERELEASE_LEVELS.includes(level as PrereleaseLevel);
}

async function run(): Promise<void> {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const currentVersion: string = packageJson.version;

  if (prereleaseLevel && !isPrereleaseLevel(prereleaseLevel)) {
    core.setFailed(
      `Invalid prerelease-level '${prereleaseLevel}'. Must be one of: ${PRERELEASE_LEVELS.join(', ')}`,
    );
    return;
  }

  if (prereleaseLevel && !isPreRelease(versionType)) {
    core.setFailed(
      `prerelease-level '${prereleaseLevel}' is only valid with a prerelease version-type (${PRE_RELEASE_TYPES.join(', ')}), not '${versionType}'`,
    );
    return;
  }

  let newVersion: string;

  if (isPreRelease(versionType)) {
    const preid = featureTag ? `${versionType}-${featureTag}` : versionType;

    // An explicit prerelease-level wins; otherwise fall back to the historical
    // auto behavior: continue an existing prerelease line, else start a new minor.
    const bumpType: PrereleaseLevel =
      (prereleaseLevel as PrereleaseLevel) ||
      (currentVersion.includes('-') ? 'prerelease' : 'preminor');

    if (isDryRun) {
      newVersion = semver.inc(currentVersion, bumpType, preid) ?? '';
    } else {
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
    await exec.exec('git', ['commit', '-m', `chore: release v${newVersion}`]);
  } else {
    core.info('DRY RUN — no files modified, no git commit created');
    core.info(`  Repository    : ${process.env.GITHUB_REPOSITORY ?? ''}`);
    core.info(`  Actor         : ${process.env.GITHUB_ACTOR ?? ''}`);
    core.info(`  Base branch   : ${process.env.BASE_BRANCH ?? ''}`);
    core.info(`  Bump type     : ${versionType}`);
    core.info(`  Feature tag   : ${featureTag}`);
    core.info(`  Prerelease lvl: ${prereleaseLevel || '(auto)'}`);
    core.info(`  Would release : v${newVersion}`);
  }

  core.setOutput('new_version', newVersion);
  core.summary.addRaw(`### Version Bump\n${versionType} → **${newVersion}**`);
  await core.summary.write();
}

run().catch((error: Error) => core.setFailed(error.message));
