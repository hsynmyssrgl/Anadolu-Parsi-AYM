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
const explicitExecutableArgument = process.argv.find((argument) =>
  argument.startsWith('--executable=')
);
const packagedExecutable = explicitExecutableArgument
  ? resolve(explicitExecutableArgument.slice('--executable='.length))
  : resolve(appRoot, 'release/win-unpacked/ParsYuva Aile Yaşam Merkezi.exe');
const packaged = process.argv.includes('--packaged') || Boolean(explicitExecutableArgument);
const diagnosticSingleProcess = process.argv.includes('--diagnostic-single-process');
const diagnosticNoSandbox = process.argv.includes('--diagnostic-no-sandbox');
const diagnosticInProcessGpu = process.argv.includes('--diagnostic-in-process-gpu');
const diagnosticDisableGpuSandbox = process.argv.includes('--diagnostic-disable-gpu-sandbox');
const diagnosticDisableRendererCodeIntegrity = process.argv.includes(
  '--diagnostic-disable-renderer-code-integrity'
);
const diagnosticDisableAppContainer = process.argv.includes(
  '--diagnostic-disable-app-container'
);
const keepTemporary = process.argv.includes('--keep-temporary');
const diagnosticLabels = [
  diagnosticSingleProcess && 'single-process',
  diagnosticNoSandbox && 'no-sandbox',
  diagnosticInProcessGpu && 'in-process-gpu',
  diagnosticDisableGpuSandbox && 'disable-gpu-sandbox',
  diagnosticDisableRendererCodeIntegrity && 'disable-renderer-code-integrity',
  diagnosticDisableAppContainer && 'disable-app-container'
].filter(Boolean);
const diagnosticMode = diagnosticLabels.length > 0;
const main = resolve(appRoot, 'dist/main/main.mjs');
const renderer = resolve(appRoot, 'dist/renderer/index.html');
const validationDirectory = resolve(root, 'artifacts/validation');
const launchTemporaryDirectory = resolve(root, '.tmp');
const evidencePath = resolve(
  validationDirectory,
  diagnosticMode
    ? `${packaged ? 'windows-packaged-launch' : 'windows-real-launch'}-diagnostic-${diagnosticLabels.join('-')}.json`
    : packaged
      ? 'windows-packaged-launch-probe.json'
      : 'windows-real-launch-probe.json'
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

const wait = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

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

const buildLaunchArguments = () => {
  const launchArguments = ['--enable-logging=stderr', '--v=1', '--disable-gpu'];
  if (diagnosticSingleProcess) {
    launchArguments.push(
      '--no-sandbox',
      '--single-process',
      '--disable-software-rasterizer',
      '--disable-gpu-compositing',
      '--in-process-gpu'
    );
  }
  if (diagnosticNoSandbox && !launchArguments.includes('--no-sandbox')) {
    launchArguments.push('--no-sandbox');
  }
  if (diagnosticInProcessGpu && !launchArguments.includes('--in-process-gpu')) {
    launchArguments.push('--in-process-gpu', '--disable-software-rasterizer');
  }
  if (diagnosticDisableGpuSandbox) launchArguments.push('--disable-gpu-sandbox');
  const disabledFeatures = [];
  if (diagnosticDisableRendererCodeIntegrity) {
    disabledFeatures.push('RendererCodeIntegrity', 'WinSboxForceRendererCodeIntegrity');
  }
  if (diagnosticDisableAppContainer) {
    disabledFeatures.push('RendererAppContainer', 'GpuAppContainer');
  }
  if (disabledFeatures.length > 0) {
    launchArguments.push(`--disable-features=${disabledFeatures.join(',')}`);
  }
  if (!packaged) launchArguments.push(appRoot);
  return launchArguments;
};

const validateProbe = (probe, expectedSentinelState) => {
  if (probe.status !== 'PASS') {
    throw new Error(`Renderer launch probe failed: ${JSON.stringify(probe)}`);
  }
  const startup = probe.startupSecurity;
  if (!startup || typeof startup !== 'object') {
    throw new Error('Launch probe does not contain startup security evidence.');
  }
  if (startup.protectionProvider !== 'windows-dpapi') {
    throw new Error(`Unexpected Windows secret provider: ${startup.protectionProvider}`);
  }
  if (startup.encryptionRoundTrip !== 'PASS') {
    throw new Error('Windows safeStorage encryption round-trip was not proven.');
  }
  if (startup.sentinelState !== expectedSentinelState) {
    throw new Error(
      `Startup sentinel state=${startup.sentinelState}; expected=${expectedSentinelState}.`
    );
  }
  if (startup.diagnosticOnly !== diagnosticMode) {
    throw new Error('Startup diagnostic classification does not match launch mode.');
  }
  const windowsSecurity = probe.windowsSecurityEvidence;
  const expectedBuild = Number(probe.applicationVersion?.split('.').at(-1));
  if (!Number.isInteger(expectedBuild) || !windowsSecurity || windowsSecurity.status !== 'PASS' || windowsSecurity.build !== expectedBuild) {
    throw new Error(`Windows security evidence probe failed or missing: ${JSON.stringify(windowsSecurity)}`);
  }
  if (
    windowsSecurity.efs?.status !== 'PASS' ||
    windowsSecurity.efs?.protectionStatus !== 'windows-efs' ||
    windowsSecurity.efs?.directoryEncryptedAttribute !== 'PASS' ||
    windowsSecurity.efs?.snapshotEncryptedAttribute !== 'PASS' ||
    windowsSecurity.efs?.stagingCleanup !== 'PASS'
  ) {
    throw new Error(`Windows EFS evidence failed: ${JSON.stringify(windowsSecurity.efs)}`);
  }
  if (
    windowsSecurity.protectedSideArtifacts?.status !== 'PASS' ||
    windowsSecurity.protectedSideArtifacts?.protectionId !== 'windows-dpapi-current-user-v1' ||
    windowsSecurity.protectedSideArtifacts?.keyEnvelopeDeviceWrapped !== 'PASS' ||
    windowsSecurity.protectedSideArtifacts?.ciphertextHidesProbePlaintext !== 'PASS' ||
    windowsSecurity.protectedSideArtifacts?.decryptRoundTrip !== 'PASS'
  ) {
    throw new Error(`Windows protected side-artifact evidence failed: ${JSON.stringify(windowsSecurity.protectedSideArtifacts)}`);
  }
  const policy = startup.rendererPolicy;
  if (
    !policy ||
    policy.sandbox !== true ||
    policy.contextIsolation !== true ||
    policy.nodeIntegration !== false ||
    policy.webSecurity !== true ||
    policy.allowRunningInsecureContent !== false ||
    policy.webviewTag !== false
  ) {
    throw new Error(`Renderer security policy failed: ${JSON.stringify(policy)}`);
  }
};

const launchOnce = async ({ temporaryRoot, userDataPath, runNumber, expectedSentinelState }) => {
  const probePath = resolve(temporaryRoot, `renderer-probe-${runNumber}.json`);
  const stdoutPath = resolve(temporaryRoot, `electron-stdout-${runNumber}.log`);
  const stderrPath = resolve(temporaryRoot, `electron-stderr-${runNumber}.log`);
  const stdoutDescriptor = openSync(stdoutPath, 'w');
  const stderrDescriptor = openSync(stderrPath, 'w');
  const executable = packaged ? packagedExecutable : electron;
  const child = spawn(executable, buildLaunchArguments(), {
    cwd: root,
    windowsHide: true,
    env: {
      ...normalizedEnvironment(),
      PPT_WINDOWS_LAUNCH_TEST: '1',
      PPT_WINDOWS_SECURITY_PROBE: '1',
      PPT_WINDOWS_LAUNCH_PROBE_PATH: probePath,
      PPT_WINDOWS_LAUNCH_USER_DATA_PATH: userDataPath,
      ...(diagnosticMode ? { PPT_ALLOW_UNSAFE_ELECTRON_DIAGNOSTIC: '1' } : {}),
      ELECTRON_ENABLE_LOGGING: '1',
      ELECTRON_ENABLE_STACK_DUMPING: '1'
    },
    stdio: ['ignore', stdoutDescriptor, stderrDescriptor]
  });
  const readTail = (path) => existsSync(path) ? readFileSync(path, 'utf8').slice(-16_384) : '';
  try {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline && !existsSync(probePath)) {
      if (child.exitCode !== null) {
        throw new Error([
          `Electron process exited early with code ${child.exitCode}.`,
          readTail(stdoutPath),
          readTail(stderrPath)
        ].filter(Boolean).join('\n'));
      }
      await wait(250);
    }
    if (!existsSync(probePath)) {
      throw new Error([
        'Renderer did not produce a launch probe within 30 seconds.',
        readTail(stdoutPath),
        readTail(stderrPath)
      ].filter(Boolean).join('\n'));
    }
    const probe = JSON.parse(readFileSync(probePath, 'utf8'));
    validateProbe(probe, expectedSentinelState);
    await wait(1_000);
    if (child.exitCode !== null) {
      throw new Error(`Electron process exited after renderer load with code ${child.exitCode}.`);
    }
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
  if (!existsSync(main)) throw new Error(`Electron main build not found: ${main}`);
  if (!existsSync(renderer)) throw new Error(`Renderer build not found: ${renderer}`);
  if (packaged && !existsSync(packagedExecutable)) {
    throw new Error(`Packaged Windows executable not found: ${packagedExecutable}`);
  }
  mkdirSync(validationDirectory, { recursive: true });
  rmSync(evidencePath, { force: true });
  if (!packaged) ensureElectronRuntime();
  mkdirSync(launchTemporaryDirectory, { recursive: true });
  const temporaryRoot = mkdtempSync(join(launchTemporaryDirectory, 'panthera-windows-launch-'));
  const userDataPath = resolve(temporaryRoot, 'user-data');
  try {
    const firstRun = await launchOnce({
      temporaryRoot,
      userDataPath,
      runNumber: 1,
      expectedSentinelState: 'created'
    });
    const secondRun = await launchOnce({
      temporaryRoot,
      userDataPath,
      runNumber: 2,
      expectedSentinelState: 'verified'
    });
    const evidence = {
      schemaVersion: 2,
      product: 'ParsYuva Aile Yaşam Merkezi',
      applicationVersion: secondRun.applicationVersion,
      mode: packaged ? 'packaged' : 'development',
      status: diagnosticMode ? 'DIAGNOSTIC_PASS' : 'PASS',
      diagnosticMode,
      securityExceptions: diagnosticLabels,
      sameUserDataAcrossRuns: true,
      dpapiCrossProcessPersistence: 'PASS',
      rendererSandboxPolicy: 'PASS',
      windowsEfsRuntime: 'PASS',
      windowsSafeStorageDpapiRuntime: 'PASS',
      protectedSideArtifactWindowsRuntime: 'PASS',
      runs: [firstRun, secondRun],
      generatedAt: new Date().toISOString()
    };
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`${diagnosticMode ? 'Diagnostic only — ' : ''}${
      packaged ? 'Packaged Windows application' : 'Windows Electron'
    } DPAPI persistence, main process and sandboxed renderer load verified: ${
      secondRun.applicationVersion
    }.`);
  } finally {
    if (!keepTemporary) {
      try {
        rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
      } catch (error) {
        console.warn(
          `Windows launch temporary directory could not be removed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  mkdirSync(validationDirectory, { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify({
    schemaVersion: 2,
    product: 'ParsYuva Aile Yaşam Merkezi',
    mode: packaged ? 'packaged' : 'development',
    status: diagnosticMode ? 'DIAGNOSTIC_FAIL' : 'FAIL',
    diagnosticMode,
    securityExceptions: diagnosticLabels,
    error: message,
    generatedAt: new Date().toISOString()
  }, null, 2)}\n`);
  console.error(message);
  process.exitCode = 1;
});
