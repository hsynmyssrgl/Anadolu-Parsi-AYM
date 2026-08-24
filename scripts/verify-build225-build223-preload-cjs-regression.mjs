import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const reportPath = process.argv[2] ?? 'artifacts/validation/build225-build223-preload-cjs-regression.json';
const temporaryRoot = await mkdtemp(join(tmpdir(), 'ppt-build225-build223-regression-'));
const nestedReportPath = join(temporaryRoot, 'build223-runtime.json');
try {
  const run = spawnSync(process.execPath, [
    'scripts/verify-build223-preload-cjs-graph-runtime.mjs',
    nestedReportPath
  ], { encoding: 'utf8' });
  let nested = null;
  try { nested = JSON.parse(await readFile(nestedReportPath, 'utf8')); } catch { /* Report absence is a failure below. */ }
  const checks = [
    { id: 'canonical-build223-runtime-exit-zero', status: run.status === 0 ? 'PASS' : 'FAIL', details: { exitCode: run.status, stdout: run.stdout?.trim(), stderr: run.stderr?.trim() } },
    { id: 'canonical-build223-runtime-report-pass', status: nested?.status === 'PASS' ? 'PASS' : 'FAIL', details: nested?.status ?? 'MISSING' },
    { id: 'canonical-build223-runtime-check-count', status: nested?.checks === 13 && nested?.passCount === 13 ? 'PASS' : 'FAIL', details: { checks: nested?.checks, passCount: nested?.passCount } },
    { id: 'canonical-build223-tamper-detection-preserved', status: nested?.results?.some((item) => item.id === 'tamper-missing-sharing-detected' && item.status === 'PASS') === true ? 'PASS' : 'FAIL' }
  ];
  const status = checks.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL';
  const report = {
    schemaVersion: 2,
    product: 'ParsYuva Aile Yaşam Merkezi',
    featureBuild: 225,
    regressionOfBuild: 223,
    canonicalHarness: 'scripts/verify-build223-preload-cjs-graph-runtime.mjs',
    status,
    checks: checks.length,
    passCount: checks.filter((item) => item.status === 'PASS').length,
    results: checks,
    generatedAt: new Date().toISOString()
  };
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Build225 Build223 preload CJS regression: ${status} (${report.passCount}/${report.checks}).`);
  if (status !== 'PASS') {
    console.error(JSON.stringify(checks.filter((item) => item.status === 'FAIL'), null, 2));
    process.exitCode = 1;
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
