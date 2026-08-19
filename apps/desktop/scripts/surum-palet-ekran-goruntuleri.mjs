import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const electronExecutable = resolve(repositoryRoot, 'node_modules/electron/dist/electron.exe');
const captureEntrypoint = resolve(import.meta.dirname, 'surum-palet-yakalayici/palet-yakalayici.cjs');

if (!existsSync(electronExecutable)) {
  throw new Error(`Electron calisma zamani bulunamadi: ${electronExecutable}`);
}
if (!existsSync(captureEntrypoint)) {
  throw new Error(`Palet yakalama girisi bulunamadi: ${captureEntrypoint}`);
}

const child = spawn(
  electronExecutable,
  [
    '--disable-gpu',
    '--disable-gpu-sandbox',
    '--force-device-scale-factor=1',
    captureEntrypoint
  ],
  {
    cwd: repositoryRoot,
    windowsHide: true,
    stdio: 'inherit'
  }
);

const exitCode = await new Promise((resolveExit, rejectExit) => {
  const timeout = setTimeout(() => {
    if (child.pid) {
      spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
        windowsHide: true,
        stdio: 'ignore'
      });
    }
    rejectExit(new Error('Palet ekran goruntusu yakalama 30 saniyede tamamlanmadi.'));
  }, 30_000);
  child.once('error', (error) => {
    clearTimeout(timeout);
    rejectExit(error);
  });
  child.once('exit', (code) => {
    clearTimeout(timeout);
    resolveExit(code ?? 1);
  });
});

if (exitCode !== 0) {
  throw new Error(`Palet ekran goruntusu yakalama cikis kodu: ${exitCode}`);
}
