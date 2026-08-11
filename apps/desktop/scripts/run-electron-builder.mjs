import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const cacheRoot = resolve(root, 'artifacts/validation/electron-cache');
const builderCli = resolve(root, 'tools/windows-packager/node_modules/electron-builder/cli.js');
const packageMode = process.argv.includes('--dir') ? ['--win', 'dir'] : ['--win', 'nsis'];
if (!existsSync(builderCli)) {
  console.error('Windows paketleme bağımlılıkları kurulmamış. Önce kökte `npm run windows-packager:install` komutunu çalıştırın.');
  process.exit(1);
}
mkdirSync(cacheRoot, { recursive: true });

const child = spawn(process.execPath, [builderCli, ...packageMode], {
  cwd: resolve(root, 'apps/desktop'),
  env: {
    ...process.env,
    ELECTRON_CACHE: cacheRoot,
    electron_config_cache: cacheRoot
  },
  shell: false,
  windowsHide: true,
  stdio: 'inherit'
});

child.on('error', (error) => {
  console.error(`Electron builder could not start: ${error.message}`);
  process.exitCode = 1;
});
child.on('close', (exitCode, signal) => {
  if (signal) {
    console.error(`Electron builder was terminated by signal ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = exitCode ?? 1;
});
