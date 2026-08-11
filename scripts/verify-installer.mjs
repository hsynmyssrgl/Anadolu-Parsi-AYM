import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['scripts/verify-installer.mjs'], {
  cwd: new URL('../apps/desktop/', import.meta.url),
  stdio: 'inherit'
});
process.exit(result.status ?? 1);
