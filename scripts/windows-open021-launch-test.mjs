import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const electron = resolve(root, 'node_modules/electron/dist/electron.exe');
const electronInstaller = resolve(root, 'node_modules/electron/install.js');
const appRoot = resolve(root, 'apps/desktop');
const explicitExecutableArgument = process.argv.find((argument) => argument.startsWith('--executable='));
const packagedExecutable = explicitExecutableArgument
  ? resolve(explicitExecutableArgument.slice('--executable='.length))
  : resolve(appRoot, 'release/win-unpacked/Anadolu Parsı Aile Yaşam Merkezi.exe');
const packaged = Boolean(explicitExecutableArgument) || process.argv.includes('--packaged');
const keepTemporary = process.argv.includes('--keep-temporary');
const main = resolve(appRoot, 'dist/main/main.mjs');
const renderer = resolve(appRoot, 'dist/renderer/index.html');
const validationDirectory = resolve(root, 'artifacts/validation');
const launchTemporaryDirectory = resolve(root, '.tmp');
const evidencePath = resolve(
  validationDirectory,
  packaged
    ? 'windows-open021-packaged-launch-probe.json'
    : 'windows-open021-development-launch-probe.json'
);
const electronCachePath = resolve(validationDirectory, 'electron-cache');

const normalizedEnvironment = () => {
  const result = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    result[key.toLowerCase() === 'path' ? 'Path' : key] = value;
  }
  return result;
};

const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const ensureElectronRuntime = () => {
  if (existsSync(electron)) return;
  if (!existsSync(electronInstaller)) {
    throw new Error(`Electron runtime installer not found: ${electronInstaller}`);
  }
  mkdirSync(electronCachePath, { recursive: true });
  const result = spawnSync(process.execPath, [electronInstaller], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    env: {
      ...normalizedEnvironment(),
      ELECTRON_CACHE: electronCachePath,
      electron_config_cache: electronCachePath
    }
  });
  if (result.status !== 0 || !existsSync(electron)) {
    throw new Error([
      `Electron runtime bootstrap failed with exit code ${result.status}.`,
      result.stdout,
      result.stderr
    ].filter(Boolean).join('\n'));
  }
};

const validateProbe = (probe) => {
  if (probe.status !== 'PASS') throw new Error(`OPEN-021 renderer launch probe failed: ${JSON.stringify(probe)}`);
  const policy = probe.rendererPolicy;
  if (
    !policy ||
    policy.sandbox !== true ||
    policy.contextIsolation !== true ||
    policy.nodeIntegration !== false ||
    policy.webSecurity !== true ||
    policy.allowRunningInsecureContent !== false ||
    policy.webviewTag !== false
  ) {
    throw new Error(`OPEN-021 renderer security policy failed: ${JSON.stringify(policy)}`);
  }

  const evidence = probe.windowsOpen021EfsEvidence;
  const expectedBuild = Number(probe.applicationVersion?.split('.').at(-1));
  if (
    !Number.isInteger(expectedBuild) ||
    !evidence ||
    evidence.status !== 'PASS' ||
    evidence.platform !== 'win32' ||
    evidence.build !== expectedBuild ||
    evidence.applicationVersion !== probe.applicationVersion
  ) {
    throw new Error(`OPEN-021 Windows EFS evidence missing or invalid: ${JSON.stringify(evidence)}`);
  }
  if (
    evidence.efs?.status !== 'PASS' ||
    evidence.efs?.protectionStatus !== 'windows-efs' ||
    evidence.efs?.directoryEncryptedAttribute !== 'PASS' ||
    evidence.efs?.snapshotEncryptedAttribute !== 'PASS' ||
    evidence.efs?.snapshotSqliteRoundTrip !== 'PASS' ||
    evidence.efs?.stagingCleanup !== 'PASS' ||
    evidence.efs?.activeDatabase !== 'memory-only'
  ) {
    throw new Error(`OPEN-021 Windows EFS evidence failed: ${JSON.stringify(evidence.efs)}`);
  }
};

const launchOnce = async ({ temporaryRoot, userDataPath, runNumber }) => {
  const probePath = resolve(temporaryRoot, `open021-renderer-probe-${runNumber}.json`);
  const stdoutPath = resolve(temporaryRoot, `open021-electron-stdout-${runNumber}.log`);
  const stderrPath = resolve(temporaryRoot, `open021-electron-stderr-${runNumber}.log`);
  const diagnosticPath = resolve(temporaryRoot, `open021-early-startup-${runNumber}.json`);
  const stdoutDescriptor = openSync(stdoutPath, 'w');
  const stderrDescriptor = openSync(stderrPath, 'w');
  const executable = packaged ? packagedExecutable : electron;
  const launchArguments = ['--enable-logging=stderr', '--disable-gpu'];
  if (!packaged) launchArguments.push(appRoot);

  const child = spawn(executable, launchArguments, {
    cwd: root,
    windowsHide: true,
    env: {
      ...normalizedEnvironment(),
      PPT_WINDOWS_LAUNCH_TEST: '1',
      PPT_WINDOWS_OPEN021_EFS_PROBE: '1',
      PPT_WINDOWS_LAUNCH_PROBE_PATH: probePath,
      PPT_WINDOWS_STARTUP_DIAGNOSTIC_PATH: diagnosticPath,
      PPT_WINDOWS_LAUNCH_USER_DATA_PATH: userDataPath,
      ELECTRON_ENABLE_LOGGING: '1',
      ELECTRON_ENABLE_STACK_DUMPING: '1'
    },
    stdio: ['ignore', stdoutDescriptor, stderrDescriptor]
  });

  const readFull = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';
  try {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline && !existsSync(probePath)) {
      if (child.exitCode !== null) {
        throw new Error([
          `OPEN-021 Electron process exited early with code ${child.exitCode}.`,
          readFull(stdoutPath),
          readFull(stderrPath),
          readFull(diagnosticPath)
        ].filter(Boolean).join('\n'));
      }
      await wait(250);
    }
    if (!existsSync(probePath)) {
      throw new Error([
        'OPEN-021 renderer did not produce a launch probe within 30 seconds.',
        readFull(stdoutPath),
        readFull(stderrPath),
        readFull(diagnosticPath)
      ].filter(Boolean).join('\n'));
    }
    const probe = JSON.parse(readFileSync(probePath, 'utf8'));
    validateProbe(probe);
    await wait(1_000);
    if (child.exitCode !== null) throw new Error(`OPEN-021 Electron process exited after renderer load with code ${child.exitCode}.`);
    return probe;
  } finally {
    const childClosed = new Promise((resolveClosed) => {
      if (child.exitCode !== null) resolveClosed();
      else child.once('close', resolveClosed);
    });
    if (child.exitCode === null && child.pid) {
      spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
        windowsHide: true,
        stdio: 'ignore'
      });
    }
    await Promise.race([childClosed, wait(5_000)]);
    closeSync(stdoutDescriptor);
    closeSync(stderrDescriptor);
    child.removeAllListeners();
    child.unref();
  }
};

const run = async () => {
  if (process.platform !== 'win32') throw new Error('OPEN-021 launch test can run only on real Windows.');
  if (!existsSync(main)) throw new Error(`Electron main build not found: ${main}`);
  if (!existsSync(renderer)) throw new Error(`Renderer build not found: ${renderer}`);
  if (packaged && !existsSync(packagedExecutable)) throw new Error(`Packaged Windows executable not found: ${packagedExecutable}`);
  mkdirSync(validationDirectory, { recursive: true });
  rmSync(evidencePath, { force: true });
  if (!packaged) ensureElectronRuntime();

  mkdirSync(launchTemporaryDirectory, { recursive: true });
  const temporaryRoot = mkdtempSync(join(launchTemporaryDirectory, 'panthera-open021-windows-launch-'));
  const userDataPath = resolve(temporaryRoot, 'user-data');
  const mode = packaged ? 'packaged' : 'development';
  const persistedLogs = [1, 2].flatMap((runNumber) => [
    `windows-open021-${mode}-run${runNumber}-full-stdout.log`,
    `windows-open021-${mode}-run${runNumber}-full-stderr.log`
  ]);
  try {
    const firstRun = await launchOnce({ temporaryRoot, userDataPath, runNumber: 1 });
    const secondRun = await launchOnce({ temporaryRoot, userDataPath, runNumber: 2 });
    const evidence = {
      schemaVersion: 1,
      product: 'Anadolu Parsı Aile Yaşam Merkezi',
      applicationVersion: secondRun.applicationVersion,
      mode: packaged ? 'packaged' : 'development',
      status: 'PASS',
      platform: 'win32',
      official: true,
      sameUserDataAcrossRuns: true,
      windowsOpen021EfsRuntime: 'PASS',
      rendererSandboxPolicy: 'PASS',
      fullProcessLogs: persistedLogs,
      earlyStartupDiagnosticPattern: `windows-open021-${mode}-runN-early-startup.json`,
      runs: [firstRun, secondRun],
      generatedAt: new Date().toISOString()
    };
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`OPEN-021 ${packaged ? 'packaged' : 'development'} Windows EFS launch evidence: PASS (${secondRun.applicationVersion}).`);
  } finally {
    for (const runNumber of [1, 2]) {
      const sources = [
        [`open021-electron-stdout-${runNumber}.log`, `windows-open021-${mode}-run${runNumber}-full-stdout.log`],
        [`open021-electron-stderr-${runNumber}.log`, `windows-open021-${mode}-run${runNumber}-full-stderr.log`],
        [`open021-early-startup-${runNumber}.json`, `windows-open021-${mode}-run${runNumber}-early-startup.json`]
      ];
      for (const [sourceName, targetName] of sources) {
        const source = resolve(temporaryRoot, sourceName);
        if (existsSync(source)) writeFileSync(resolve(validationDirectory, targetName), readFileSync(source));
      }
    }
    if (!keepTemporary) {
      try {
        rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
      } catch (error) {
        console.warn(`OPEN-021 temporary directory cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  mkdirSync(validationDirectory, { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify({
    schemaVersion: 1,
    product: 'Anadolu Parsı Aile Yaşam Merkezi',
    mode: packaged ? 'packaged' : 'development',
    status: 'FAIL',
    platform: process.platform,
    official: process.platform === 'win32',
    error: message,
    generatedAt: new Date().toISOString()
  }, null, 2)}\n`);
  console.error(message);
  process.exitCode = 1;
});
