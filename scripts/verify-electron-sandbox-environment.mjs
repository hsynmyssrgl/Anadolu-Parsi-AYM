import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const appMetaSource = readFileSync(resolve(root, 'packages/domain/src/app-meta.ts'), 'utf8');
const applicationVersion = /version: '([^']+)'/u.exec(appMetaSource)?.[1] ?? 'unknown';
const electron = resolve(root, 'node_modules/electron/dist/electron.exe');
const temporaryBase = resolve(root, '.tmp');
const evidenceDirectory = resolve(root, 'artifacts/validation');
const evidencePath = resolve(
  evidenceDirectory,
  'electron-sandbox-environment-diagnostic.json'
);
mkdirSync(temporaryBase, { recursive: true });
mkdirSync(evidenceDirectory, { recursive: true });

const temporaryRoot = mkdtempSync(join(temporaryBase, 'electron-sandbox-diagnostic-'));
const mainPath = resolve(temporaryRoot, 'main.cjs');
const resultPath = resolve(temporaryRoot, 'result.txt');
const userDataPath = resolve(temporaryRoot, 'user-data');
const stdoutPath = resolve(temporaryRoot, 'stdout.log');
const stderrPath = resolve(temporaryRoot, 'stderr.log');

writeFileSync(mainPath, `
const { app, BrowserWindow } = require('electron');
const { writeFileSync } = require('node:fs');
app.setPath('userData', process.env.PPT_SANDBOX_PROBE_USER_DATA);
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false
    }
  });
  window.webContents.once('did-finish-load', () => {
    writeFileSync(process.env.PPT_SANDBOX_PROBE_RESULT, 'PASS\\n');
    app.quit();
  });
  window.webContents.once('render-process-gone', (_event, details) => {
    writeFileSync(
      process.env.PPT_SANDBOX_PROBE_RESULT,
      \`FAIL \${details.reason} \${details.exitCode}\\n\`
    );
    app.exit(1);
  });
  try {
    await window.loadURL('data:text/html,<h1>Electron sandbox environment probe</h1>');
  } catch {}
});
setTimeout(() => {
  writeFileSync(process.env.PPT_SANDBOX_PROBE_RESULT, 'FAIL timeout\\n');
  app.exit(1);
}, 20000).unref();
`, 'utf8');

const stdoutDescriptor = openSync(stdoutPath, 'w');
const stderrDescriptor = openSync(stderrPath, 'w');
const child = spawn(
  electron,
  ['--disable-gpu', '--disable-gpu-sandbox', mainPath],
  {
    cwd: root,
    windowsHide: true,
    env: {
      ...process.env,
      PPT_SANDBOX_PROBE_USER_DATA: userDataPath,
      PPT_SANDBOX_PROBE_RESULT: resultPath
    },
    stdio: ['ignore', stdoutDescriptor, stderrDescriptor]
  }
);

await new Promise((resolveExit) => {
  const timer = setTimeout(() => {
    if (child.pid) {
      spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
        windowsHide: true,
        stdio: 'ignore'
      });
    }
    resolveExit();
  }, 25_000);
  child.once('exit', () => {
    clearTimeout(timer);
    resolveExit();
  });
});
closeSync(stdoutDescriptor);
closeSync(stderrDescriptor);

const rawResult = existsSync(resultPath)
  ? readFileSync(resultPath, 'utf8').trim()
  : 'FAIL no-result';
const rendererPassed = rawResult === 'PASS';
const evidence = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion,
  packageVersion: packageJson.version,
  diagnostic: 'minimal-electron-renderer-sandbox',
  status: rendererPassed ? 'PASS' : 'BLOCKED_ENVIRONMENT',
  rendererOutcome: rendererPassed ? 'PASS' : 'FAIL',
  rendererSandboxEnabled: true,
  gpuSandboxDisabledForIsolation: true,
  applicationCodeIncluded: false,
  rawResult,
  processExitCode: child.exitCode,
  conclusion: rendererPassed
    ? 'Minimal sandboxed Electron renderer can start in this host.'
    : 'A minimal renderer without application code cannot start in this host; the Windows launch failure is environmental.',
  generatedAt: new Date().toISOString()
};
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

try {
  rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
} catch {}

console.log(
  rendererPassed
    ? 'Electron sandbox environment diagnostic: PASS.'
    : `Electron sandbox environment diagnostic: BLOCKED_ENVIRONMENT (${rawResult}).`
);
