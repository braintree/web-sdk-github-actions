import * as core from '@actions/core';

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    core.setFailed(`Required environment variable ${name} is not set`);
    process.exit(1);
  }
  return value;
}
