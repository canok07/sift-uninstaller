import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.test-build');
fs.mkdirSync(output, { recursive: true });
const before = new Set(fs.readdirSync(output));
const result = spawnSync(require('electron'), [path.join(root, 'tests/electron-smoke.cjs')], {
  cwd: root, stdio: 'inherit', timeout: 120000,
  env: { ...process.env, SIFT_SMOKE_PACKAGED: process.argv.includes('--packaged') ? '1' : '0' }
});
if (result.error) console.error(result.error.message);
if (result.status === 0) {
  for (const name of fs.readdirSync(output)) {
    if (before.has(name) || !name.startsWith('electron-smoke-')) continue;
    const target = path.resolve(output, name);
    if (path.dirname(target) !== output || !fs.lstatSync(target).isDirectory() || fs.lstatSync(target).isSymbolicLink()) {
      throw new Error('Invalid test cleanup target');
    }
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
process.exitCode = result.status ?? 1;
