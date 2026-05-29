import * as core from '@actions/core';
import { readFileSync } from 'node:fs';

let changelog: string;

try {
  changelog = readFileSync('CHANGELOG.md', 'utf8');
} catch {
  core.setFailed('Could not read CHANGELOG.md');
  process.exit(1);
}

if (!/##\s+UNRELEASED/i.test(changelog)) {
  core.setFailed('UNRELEASED section not found in CHANGELOG.md');
}
