import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const entries = readdirSync('src')
  .filter((f) => f.endsWith('.ts') && f !== 'utils.ts')
  .map((f) => `src/${f}`);

if (entries.length === 0) {
  console.log('Nothing to bundle (no entrypoints in src/ besides utils.ts).');
  process.exit(0);
}

execSync(
  `npx esbuild ${entries.join(' ')} --bundle --platform=node --outdir=dist --target=node24 --minify`,
  { stdio: 'inherit' }
);
