import * as core from '@actions/core';
import { readFileSync } from 'node:fs';

let changelog: string;

try {
  changelog = readFileSync('CHANGELOG.md', 'utf8');
} catch {
  core.setFailed('Could not read CHANGELOG.md');
  process.exit(1);
}

const lines = changelog.split('\n');
const firstHeader = lines.findIndex((line) => /^## /.test(line));

if (firstHeader === -1) {
  core.setFailed('No release section (## heading) found in CHANGELOG.md');
  process.exit(1);
}

const secondHeader = lines.findIndex((line, index) => index > firstHeader && /^## /.test(line));

const notes = lines
  .slice(firstHeader + 1, secondHeader === -1 ? undefined : secondHeader)
  .join('\n')
  .trim();

core.setOutput('release_details', notes);
