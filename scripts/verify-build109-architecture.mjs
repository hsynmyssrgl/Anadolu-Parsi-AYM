import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveValidationCommand } from './lib/validation-command.mjs';

const expectedDisplayVersion = '25.07.2026.109';
const expectedPackageVersion = '25.7.2026-109';
const expectedBuild = 109;
const failures = [];
let checks = 0;
const verify = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const exists = async (path) => { try { await stat(path); return true; } catch { return false; } };
const temporaryRoot = await mkdtemp(join(tmpdir(), 'ppt-build109-verification-'));

try {
  const rootManifest = await readJson('package.json');
  verify(rootManifest.version === expectedPackageVersion, `root package version=${rootManifest.version}`);
  verify(rootManifest.scripts?.['verify:build109:architecture'] === 'node scripts/verify-build109-architecture.mjs', 'Build 109 verifier is not registered');
  verify(rootManifest.scripts?.['verify:dashboard']?.includes('node scripts/clean-directory.mjs .tmp/navigation'), 'dashboard verification does not use the portable directory cleaner');
  verify(!rootManifest.scripts?.['verify:dashboard']?.includes('rm -rf'), 'dashboard verification retains Unix-only rm -rf');

  const appMeta = await readFile('packages/domain/src/app-meta.ts', 'utf8');
  verify(appMeta.includes(`version: '${expectedDisplayVersion}'`), 'APP_META display version mismatch');
  verify(appMeta.includes(`packageVersion: '${expectedPackageVersion}'`), 'APP_META package version mismatch');
  verify(appMeta.includes(`Build ${expectedBuild}`), 'APP_META build mismatch');

  const runnerSource = await readFile('scripts/run-rc2-validation-gates.mjs', 'utf8');
  verify(runnerSource.includes("from './lib/validation-command.mjs'"), 'RC2 runner does not use the platform command resolver');
  verify(runnerSource.includes('shell: false'), 'RC2 runner must keep shell execution disabled');
  verify(runnerSource.includes("reason: 'RUNNER_INTERRUPTED'"), 'RC2 runner does not record interrupted gates');
  verify(runnerSource.includes("if (currentGate?.child === child) currentGate = null;"), 'RC2 runner does not clear only the active child');
  verify(runnerSource.includes("optionValue('--config')"), 'RC2 runner does not support isolated configuration verification');
  verify(runnerSource.includes('schemaVersion: 3'), 'RC2 runner report schema was not upgraded');

  const npmFromExecPath = resolveValidationCommand({
    command: 'npm',
    args: ['run', 'typecheck'],
    platform: 'win32',
    env: { npm_execpath: 'C:\\npm\\npm-cli.js' },
    nodeExecutable: 'C:\\node\\node.exe'
  });
  verify(npmFromExecPath.command === 'C:\\node\\node.exe', `npm execpath command=${npmFromExecPath.command}`);
  verify(JSON.stringify(npmFromExecPath.args) === JSON.stringify(['C:\\npm\\npm-cli.js', 'run', 'typecheck']), `npm execpath args=${JSON.stringify(npmFromExecPath.args)}`);
  verify(npmFromExecPath.strategy === 'npm-execpath', `npm execpath strategy=${npmFromExecPath.strategy}`);

  const npmFallback = resolveValidationCommand({ command: 'npm', args: ['ci'], platform: 'win32', env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' }, nodeExecutable: 'node.exe' });
  verify(npmFallback.command === 'C:\\Windows\\System32\\cmd.exe', `Windows npm fallback=${npmFallback.command}`);
  verify(JSON.stringify(npmFallback.args) === JSON.stringify(['/d', '/s', '/c', 'npm', 'ci']), `Windows npm fallback args=${JSON.stringify(npmFallback.args)}`);
  verify(npmFallback.strategy === 'windows-command-interpreter', `Windows npm fallback strategy=${npmFallback.strategy}`);
  const powershell = resolveValidationCommand({ command: 'powershell', args: ['-NoProfile'], platform: 'win32', env: {} });
  verify(powershell.command === 'powershell.exe', `Windows PowerShell command=${powershell.command}`);
  const nodeCommand = resolveValidationCommand({ command: 'node', args: ['--version'], platform: 'win32', env: {}, nodeExecutable: 'node-test.exe' });
  verify(nodeCommand.command === 'node-test.exe', `Node command=${nodeCommand.command}`);

  const cleanTarget = '.tmp/build109-portable-clean-test';
  await mkdir(join(cleanTarget, 'nested'), { recursive: true });
  await writeFile(join(cleanTarget, 'nested', 'evidence.txt'), 'temporary');
  const cleanRun = spawnSync(process.execPath, ['scripts/clean-directory.mjs', cleanTarget], { cwd: process.cwd(), encoding: 'utf8' });
  verify(cleanRun.status === 0, `portable cleaner failed: ${cleanRun.stderr || cleanRun.stdout}`);
  verify(!(await exists(cleanTarget)), 'portable cleaner did not remove the target directory');
  const unsafeCleanRun = spawnSync(process.execPath, ['scripts/clean-directory.mjs', '.'], { cwd: process.cwd(), encoding: 'utf8' });
  verify(unsafeCleanRun.status !== 0, 'portable cleaner accepted the repository root');

  const passConfigPath = join(temporaryRoot, 'pass-config.json');
  const passReportPath = join(temporaryRoot, 'pass-report.json');
  await writeFile(passConfigPath, JSON.stringify({
    schemaVersion: 2,
    stage: 'Bronze RC2 Active Development',
    stopOnFailure: true,
    gates: [{
      id: 'portable-node-pass',
      label: 'Portable node command pass',
      command: 'node',
      args: ['-e', "process.stdout.write('BUILD109_PASS\\n')"],
      platforms: [process.platform],
      timeoutMs: 10_000
    }]
  }, null, 2));
  const passRun = spawnSync(process.execPath, ['scripts/run-rc2-validation-gates.mjs', '--config', passConfigPath, '--report', passReportPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, TERM: 'dumb' }
  });
  verify(passRun.status === 0, `isolated RC2 runner pass failed: ${passRun.stderr || passRun.stdout}`);
  const passReport = await readJson(passReportPath);
  verify(passReport.schemaVersion === 3, `pass report schema=${passReport.schemaVersion}`);
  verify(passReport.overallStatus === 'PASS', `pass report status=${passReport.overallStatus}`);
  verify(passReport.results?.length === 1, `pass report result count=${passReport.results?.length}`);
  verify(passReport.results?.[0]?.commandResolutionStrategy === 'node-executable', `pass command strategy=${passReport.results?.[0]?.commandResolutionStrategy}`);
  verify(passReport.results?.[0]?.resolvedCommand === process.execPath, `pass resolved command=${passReport.results?.[0]?.resolvedCommand}`);

  const interruptConfigPath = join(temporaryRoot, 'interrupt-config.json');
  const interruptReportPath = join(temporaryRoot, 'interrupt-report.json');
  await writeFile(interruptConfigPath, JSON.stringify({
    schemaVersion: 2,
    stage: 'Bronze RC2 Active Development',
    stopOnFailure: true,
    gates: [
      {
        id: 'interrupt-active-gate',
        label: 'Interrupt active gate',
        command: 'node',
        args: ['-e', "process.stdout.write('BUILD109_INTERRUPT_READY\\n'); setInterval(() => {}, 1000)"],
        platforms: [process.platform],
        timeoutMs: 30_000
      },
      {
        id: 'interrupt-not-run-gate',
        label: 'Interrupt not run gate',
        command: 'node',
        args: ['-e', "process.stdout.write('SHOULD_NOT_RUN\\n')"],
        platforms: [process.platform],
        timeoutMs: 10_000
      }
    ]
  }, null, 2));

  const interruptOutcome = await new Promise((resolveOutcome, rejectOutcome) => {
    const child = spawn(process.execPath, ['scripts/run-rc2-validation-gates.mjs', '--config', interruptConfigPath, '--report', interruptReportPath], {
      cwd: process.cwd(),
      env: { ...process.env, TERM: 'dumb' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let signalled = false;
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* already closed */ }
      rejectOutcome(new Error(`Interrupted runner test timed out. stdout=${stdout} stderr=${stderr}`));
    }, 15_000);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (!signalled && stdout.includes('BUILD109_INTERRUPT_READY')) {
        signalled = true;
        child.kill('SIGTERM');
      }
    });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => { clearTimeout(timer); rejectOutcome(error); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolveOutcome({ code, signal, stdout, stderr, signalled });
    });
  });
  verify(interruptOutcome.signalled === true, 'interrupted runner did not reach the active gate');
  verify(interruptOutcome.code !== 0, `interrupted runner exit code=${interruptOutcome.code}`);
  const interruptReport = await readJson(interruptReportPath);
  verify(interruptReport.overallStatus === 'INCOMPLETE', `interrupt report status=${interruptReport.overallStatus}`);
  verify(interruptReport.interruptedSignal === 'SIGTERM', `interrupt signal=${interruptReport.interruptedSignal}`);
  verify(interruptReport.results?.length === 2, `interrupt result count=${interruptReport.results?.length}`);
  verify(new Set(interruptReport.results?.map((result) => result.id)).size === 2, 'interrupt report contains duplicate gate ids');
  verify(interruptReport.results?.[0]?.status === 'FAIL' && interruptReport.results?.[0]?.reason === 'RUNNER_INTERRUPTED', `active interrupt result=${JSON.stringify(interruptReport.results?.[0])}`);
  verify(interruptReport.results?.[1]?.status === 'NOT_RUN', `remaining interrupt result=${JSON.stringify(interruptReport.results?.[1])}`);
  verify(!interruptOutcome.stdout.includes('SHOULD_NOT_RUN'), 'runner executed a gate after interruption');

  const invalidConfigPath = join(temporaryRoot, 'invalid-config.json');
  await writeFile(invalidConfigPath, JSON.stringify({
    schemaVersion: 2,
    stage: 'Bronze RC2 Active Development',
    stopOnFailure: true,
    gates: [
      { id: 'duplicate', label: 'One', command: 'node', args: [], platforms: [process.platform], timeoutMs: 1_000 },
      { id: 'duplicate', label: 'Two', command: 'node', args: [], platforms: [process.platform], timeoutMs: 1_000 }
    ]
  }, null, 2));
  const invalidRun = spawnSync(process.execPath, ['scripts/run-rc2-validation-gates.mjs', '--config', invalidConfigPath, '--report', join(temporaryRoot, 'invalid-report.json')], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  verify(invalidRun.status !== 0, 'RC2 runner accepted duplicate gate ids');

  const workflow = await readFile('.github/workflows/windows-rc2-validation.yml', 'utf8');
  verify(workflow.includes('validate:rc2:gates'), 'Windows workflow bypasses the hardened gate runner');
  const gateConfig = await readJson('config/rc2-validation-gates.json');
  verify(gateConfig.gates.filter((gate) => gate.command === 'npm').length >= 5, 'RC2 gate configuration no longer covers npm lifecycle gates');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`Build 109 architecture verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 109 architecture verification completed: ${checks} targeted assertions.`);
