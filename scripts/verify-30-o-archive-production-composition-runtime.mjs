import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const validationDirectory = resolve(repoRoot, 'artifacts', 'validation');
const canonicalReportPath = resolve(validationDirectory, '30-O-ppk-002-archive-production-composition-runtime.json');
const firstFailureReportPath = resolve(validationDirectory, '30-O-ppk-002-archive-production-composition-runtime-first-attempt-failure.json');
const successorRegression = process.argv.includes('--successor-regression');
const attemptArgument = process.argv.find((argument) => argument.startsWith('--attempt='));
const successorAttempt = attemptArgument?.slice('--attempt='.length);
if (successorRegression && (!successorAttempt || !/^[a-z0-9][a-z0-9-]{0,63}$/u.test(successorAttempt))) {
  console.error('Successor regression requires --attempt=<lowercase-alphanumeric-or-hyphen> so historical 30-O evidence cannot be overwritten.');
  process.exit(2);
}
const successorReportPath = resolve(
  validationDirectory,
  `30-P-30-O-archive-production-composition-runtime-regression-${successorAttempt}.json`
);
const canonicalVitestReportPath = resolve(validationDirectory, '30-O-archive-production-composition-vitest.json');
const successorVitestReportPath = resolve(
  validationDirectory,
  `30-P-30-O-archive-production-composition-vitest-regression-${successorAttempt}.json`
);
const vitestReportPath = successorRegression ? successorVitestReportPath : canonicalVitestReportPath;
const reportPath = successorRegression ? successorReportPath : canonicalReportPath;
const mandatoryTruth = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const expectedControlledCheckTotal = 111;
const maximumCapturedCharacters = 12_000;
const processTimeoutMs = 180_000;

await mkdir(validationDirectory, { recursive: true });

const summarizeOutput = (value) => {
  const normalized = value.replace(/\r\n/gu, '\n').trim();
  return normalized.length <= 4_000 ? normalized : `[...${normalized.length - 4_000} characters omitted...]\n${normalized.slice(-4_000)}`;
};

const appendCapturedOutput = (current, chunk) => {
  const next = `${current}${chunk.toString('utf8')}`;
  return next.length <= maximumCapturedCharacters ? next : next.slice(-maximumCapturedCharacters);
};

const executeNodeProcess = ({ id, args }) => new Promise((resolveProcess) => {
  const startedAt = new Date();
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  let spawnError = null;
  const child = spawn(process.execPath, args, {
    cwd: repoRoot,
    env: process.env,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  child.stdout.on('data', (chunk) => { stdout = appendCapturedOutput(stdout, chunk); });
  child.stderr.on('data', (chunk) => { stderr = appendCapturedOutput(stderr, chunk); });
  child.once('error', (error) => { spawnError = error; });
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
  }, processTimeoutMs);
  child.once('close', (exitCode, signal) => {
    clearTimeout(timer);
    resolveProcess({
      id,
      executable: process.execPath,
      args,
      shell: false,
      startedAt: startedAt.toISOString(),
      startedAtMs: startedAt.getTime(),
      finishedAt: new Date().toISOString(),
      exitCode,
      signal,
      timedOut,
      spawnError: spawnError instanceof Error ? spawnError.message : null,
      stdoutSummary: summarizeOutput(stdout),
      stderrSummary: summarizeOutput(stderr)
    });
  });
});

const readFreshJsonEvidence = async (relativePath, startedAtMs) => {
  const absolutePath = resolve(repoRoot, relativePath);
  try {
    const [bytes, metadata] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
    const parsed = JSON.parse(bytes.toString('utf8'));
    const generatedAtValue = typeof parsed.generatedAt === 'string' ? Date.parse(parsed.generatedAt) : Number.NaN;
    const generatedAtFresh = Number.isNaN(generatedAtValue) || generatedAtValue >= startedAtMs - 2_000;
    return {
      path: relativePath.replaceAll('\\', '/'),
      available: true,
      fresh: metadata.mtimeMs >= startedAtMs - 2_000 && generatedAtFresh,
      size: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      parsed
    };
  } catch (error) {
    return {
      path: relativePath.replaceAll('\\', '/'),
      available: false,
      fresh: false,
      size: null,
      sha256: null,
      error: error instanceof Error ? error.message : String(error),
      parsed: null
    };
  }
};

const evidenceMetrics = (id, report) => {
  if (!report) return { status: 'UNAVAILABLE', actualCheckCount: null, passed: null, failed: null };
  if (id === 'provider-core-pep') {
    return {
      status: report.status,
      actualCheckCount: report.assertionCount,
      passed: report.passed,
      failed: report.failed
    };
  }
  if (id === 'core-service-entrypoint') {
    const assertions = Array.isArray(report.assertions) ? report.assertions : [];
    return {
      status: report.status,
      actualCheckCount: report.assertionCount,
      passed: assertions.filter((item) => item.status === 'PASS').length,
      failed: assertions.filter((item) => item.status !== 'PASS').length
    };
  }
  if (id === 'protected-receipt-journal') {
    return {
      status: report.status,
      actualCheckCount: report.checkCount,
      passed: report.passed,
      failed: report.failed
    };
  }
  return {
    status: report.success === true ? 'PASS' : 'FAIL',
    actualCheckCount: report.numTotalTests,
    passed: report.numPassedTests,
    failed: report.numFailedTests
  };
};

const gates = [
  {
    id: 'provider-core-pep',
    title: 'Core Service provider and archive policy enforcement point runtime',
    expectedCheckCount: 29,
    reportPath: 'artifacts/validation/30-O-core-service-policy-provider-runtime.json',
    args: [
      '--experimental-strip-types',
      '--experimental-loader',
      './scripts/ts-workspace-loader.mjs',
      'scripts/verify-30-o-core-service-policy-provider-runtime.mjs'
    ]
  },
  {
    id: 'core-service-entrypoint',
    title: 'Real Core Service process entrypoint and local administration IPC runtime',
    expectedCheckCount: 24,
    reportPath: 'artifacts/validation/30-O-core-service-entrypoint-runtime.json',
    args: [
      '--experimental-strip-types',
      '--experimental-loader',
      './scripts/ts-workspace-loader.mjs',
      'scripts/verify-30-o-core-service-entrypoint-runtime.mjs'
    ]
  },
  {
    id: 'protected-receipt-journal',
    title: 'Protected receipt journal restart, replay and tamper runtime',
    expectedCheckCount: 14,
    reportPath: 'artifacts/validation/30-O-protected-receipt-journal-runtime.json',
    args: ['scripts/verify-30-o-protected-receipt-journal-runtime.mjs']
  },
  {
    id: 'archive-production-sqlite-vitest',
    title: 'Real SQLite archive production policy runtime and data-store regression',
    expectedCheckCount: 44,
    reportPath: successorRegression
      ? `artifacts/validation/30-P-30-O-archive-production-composition-vitest-regression-${successorAttempt}.json`
      : 'artifacts/validation/30-O-archive-production-composition-vitest.json',
    args: [
      'node_modules/vitest/vitest.mjs',
      'run',
      'apps/desktop/tests/archive-production-policy-runtime.test.ts',
      'apps/desktop/tests/data-store.test.ts',
      '--reporter=json',
      '--outputFile',
      vitestReportPath
    ]
  }
];

const gateResults = [];
for (const gate of gates) {
  const processResult = await executeNodeProcess(gate);
  const evidence = await readFreshJsonEvidence(gate.reportPath, processResult.startedAtMs);
  const metrics = evidenceMetrics(gate.id, evidence.parsed);
  const countMatches = metrics.actualCheckCount === gate.expectedCheckCount;
  const passedMatches = metrics.passed === gate.expectedCheckCount;
  const noFailures = metrics.failed === 0;
  const status = processResult.exitCode === 0
    && processResult.signal === null
    && processResult.timedOut === false
    && processResult.spawnError === null
    && evidence.available
    && evidence.fresh
    && evidence.sha256 !== null
    && metrics.status === 'PASS'
    && countMatches
    && passedMatches
    && noFailures
    ? 'PASS'
    : 'FAIL';
  gateResults.push({
    id: gate.id,
    title: gate.title,
    status,
    expectedCheckCount: gate.expectedCheckCount,
    actualCheckCount: metrics.actualCheckCount,
    passed: metrics.passed,
    failed: metrics.failed,
    reportStatus: metrics.status,
    countMatches,
    report: {
      path: evidence.path,
      available: evidence.available,
      fresh: evidence.fresh,
      size: evidence.size,
      sha256: evidence.sha256,
      ...(evidence.error === undefined ? {} : { error: evidence.error })
    },
    process: {
      executable: processResult.executable,
      args: processResult.args,
      shell: processResult.shell,
      startedAt: processResult.startedAt,
      finishedAt: processResult.finishedAt,
      exitCode: processResult.exitCode,
      signal: processResult.signal,
      timedOut: processResult.timedOut,
      spawnError: processResult.spawnError,
      stdoutSummary: processResult.stdoutSummary,
      stderrSummary: processResult.stderrSummary
    }
  });
}

const actualControlledCheckTotal = gateResults.reduce(
  (total, gate) => total + (Number.isInteger(gate.actualCheckCount) ? gate.actualCheckCount : 0),
  0
);
const allGatesPass = gateResults.every((gate) => gate.status === 'PASS');
const totalMatches = actualControlledCheckTotal === expectedControlledCheckTotal;
const status = allGatesPass && totalMatches ? 'PASS' : 'FAIL';
const generatedAt = new Date().toISOString();
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: successorRegression ? '30-P' : '30-O',
  ...(successorRegression ? { predecessorStep: '30-O' } : {}),
  ...(successorRegression ? { attempt: successorAttempt } : {}),
  requirement: 'PPK-002',
  phase: successorRegression ? '30-O_PREDECESSOR_REGRESSION' : 'ARCHIVE_PRODUCTION_COMPOSITION_RUNTIME',
  status,
  ppk002Status: 'PARTIAL',
  evidenceClassification: 'CONTROLLED_RUNTIME_VALIDATION_ONLY',
  childProcessContract: {
    executable: process.execPath,
    shell: false,
    realExitCodesRequired: true,
    freshMachineReadableReportsRequired: true,
    reportSha256BindingRequired: true
  },
  controlledChecks: {
    expected: expectedControlledCheckTotal,
    actual: actualControlledCheckTotal,
    status: totalMatches ? 'PASS' : 'FAIL'
  },
  gates: gateResults,
  reportSha256Bindings: gateResults.map((gate) => ({
    gateId: gate.id,
    reportPath: gate.report.path,
    sha256: gate.report.sha256,
    fresh: gate.report.fresh
  })),
  ...(successorRegression ? {
    evidenceBoundary: {
      historical30OReportMutated: false,
      PPK002: 'PARTIAL',
      universalRepositoryEnforcement: 'NOT_COMPLETE'
    }
  } : {}),
  openBoundaries: [
    { id: 'PPK-002-UNIVERSAL-ENFORCEMENT', status: 'NOT_COMPLETE', countAsPass: false },
    { id: 'CROSS_PROCESS_FENCE_TO_SQLITE_COMMIT_ATOMICITY', status: 'NOT_IMPLEMENTED', countAsPass: false },
    { id: 'DURABLE_MULTI_PROCESS_REPLAY', status: 'NOT_RUN_NOT_PASS', countAsPass: false },
    { id: 'COMPLETE_TAIL_ROLLBACK_DETECTION', status: 'NOT_IMPLEMENTED', countAsPass: false },
    { id: 'WINDOWS_INSTALLED_SERVICE_RUNTIME', status: 'NOT_RUN_NOT_PASS', countAsPass: false },
    { id: 'PROTECTED_CREDENTIAL_PROVISIONING_ROTATION_AND_ACL', status: 'NOT_IMPLEMENTED', countAsPass: false }
  ],
  mandatoryTruth,
  generatedAt
};

const serializedReport = `${JSON.stringify(report, null, 2)}\n`;
await writeFile(reportPath, serializedReport, 'utf8');
if (status !== 'PASS') {
  if (!successorRegression) {
    try {
      await writeFile(firstFailureReportPath, serializedReport, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if (!(error && typeof error === 'object' && error.code === 'EEXIST')) throw error;
    }
  }
  console.error(`${successorRegression ? '30-O predecessor archive production composition runtime regression' : '30-O archive production composition runtime'}: FAIL (${actualControlledCheckTotal}/${expectedControlledCheckTotal} controlled checks).`);
  for (const gate of gateResults.filter((item) => item.status !== 'PASS')) {
    console.error(`${gate.id}: exit=${String(gate.process.exitCode)} report=${gate.reportStatus} checks=${String(gate.actualCheckCount)}/${gate.expectedCheckCount}`);
  }
  console.error(mandatoryTruth);
  process.exit(1);
}

console.log(`${successorRegression ? '30-O predecessor archive production composition runtime regression' : '30-O archive production composition runtime'}: PASS (${actualControlledCheckTotal}/${expectedControlledCheckTotal} controlled checks).`);
console.log(mandatoryTruth);
