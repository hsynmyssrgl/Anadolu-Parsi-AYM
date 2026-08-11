import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const failures = [];
let checks = 0;
const verify = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const read = (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await read(path));

const packageJson = await readJson('package.json');
const preflight = await readJson('config/source-preflight-checks.json');
const setter = await read('scripts/set-workspace-version.mjs');
const verifier = await read('scripts/verify-active-delivery-documents.mjs');
const ci = await read('.github/workflows/ci.yml');
const windows = await read('.github/workflows/windows-rc2-validation.yml');
const cleanNpmRunner = await read('scripts/run-clean-npm-ci.mjs');

verify(packageJson.scripts?.['verify:active-delivery-docs'] === 'node scripts/verify-active-delivery-documents.mjs', 'active delivery package script missing');
verify(packageJson.scripts?.['verify:build114:architecture'] === 'node scripts/verify-build114-architecture.mjs', 'Build 114 architecture script missing');
const check = preflight.checks?.at(-1);
verify(check?.id === 'active-delivery-documents', `active delivery check must be last; actual=${check?.id}`);
verify(check?.script === 'scripts/verify-active-delivery-documents.mjs', 'active delivery preflight script mismatch');
verify(check?.args?.includes('artifacts/validation/active-delivery-documents.json'), 'active delivery evidence path missing');
verify(ci.includes('active-delivery-documents.json'), 'Linux CI evidence missing');
verify(windows.includes('active-delivery-documents.json'), 'Windows evidence missing');
verify(cleanNpmRunner.includes('forcedSettlement: true'), 'clean npm ci timeout does not force-settle the attempt');
verify(cleanNpmRunner.includes("forcedSettlement = false"), 'clean npm ci result does not expose forcedSettlement');
verify(cleanNpmRunner.includes("signal: process.platform === 'win32' ? 'TASKKILL' : 'SIGKILL'"), 'clean npm ci force-settle signal is not platform aware');
for (const path of ['README.md', 'START_HERE_TR.md', 'PAKET_OZETI_TR.md', 'DELIVERY_SUMMARY_TR.md', 'VERIFICATION_REPORT.md']) {
  verify(setter.includes(`writeFile('${path}'`), `version setter does not regenerate ${path}`);
}
for (const label of ['Source preflight gate', 'Source integrity', 'Clean install gate', 'Full root `tsc --noEmit`', 'Electron production build', 'Blocking smoke chain', 'Windows launch / installer']) {
  verify(setter.includes(`resetStatusLine('${label}'`), `version setter does not reset ${label}`);
}
for (const marker of ['stale display version', 'stale package version', 'stale active build reference', 'obsolete MVP active reference', 'status mismatch', 'package and delivery summaries diverged']) {
  verify(verifier.includes(marker), `delivery verifier guard missing=${marker}`);
}

const fixture = await mkdtemp(join(tmpdir(), 'ppt-build114-'));
try {
  const files = [
    'README.md', 'START_HERE_TR.md', 'PAKET_OZETI_TR.md', 'DELIVERY_SUMMARY_TR.md', 'VERIFICATION_REPORT.md', 'BUILD_STATUS.md',
    'BUILD_STATUS_BRONZE_RC2_BUILD114.md', 'RELEASE_NOTES_BRONZE_RC2_BUILD114.md',
    'BUILD114_ARCHITECTURE_VALIDATION_REPORT.md', 'BUILD114_DELIVERY_VALIDATION_REPORT.md',
    'artifacts/manifests/VERSION_LEDGER.json'
  ];
  for (const path of files) {
    await mkdir(dirname(join(fixture, path)), { recursive: true });
    await cp(path, join(fixture, path));
  }
  const run = () => spawnSync(process.execPath, [resolve('scripts/verify-active-delivery-documents.mjs'), '--root', fixture, '--report', 'evidence.json'], { encoding: 'utf8' });
  const good = run();
  verify(good.status === 0, `good fixture failed: ${good.stderr}`);
  const goodEvidence = await readJson(join(fixture, 'evidence.json'));
  verify(goodEvidence.status === 'PASS', `good evidence status=${goodEvidence.status}`);
  verify(goodEvidence.documentCount === 5, `good evidence documentCount=${goodEvidence.documentCount}`);
  verify(goodEvidence.checks > 50, `good evidence checks=${goodEvidence.checks}`);

  const originalReadme = await read(join(fixture, 'README.md'));
  await writeFile(join(fixture, 'README.md'), originalReadme.replace('25.07.2026.114', '25.07.2026.113'));
  const staleVersion = run();
  verify(staleVersion.status !== 0, 'stale display version was accepted');
  verify(staleVersion.stderr.includes('stale display version=25.07.2026.113'), `stale version reason missing=${staleVersion.stderr}`);
  await writeFile(join(fixture, 'README.md'), originalReadme);

  const originalStart = await read(join(fixture, 'START_HERE_TR.md'));
  await writeFile(join(fixture, 'START_HERE_TR.md'), originalStart.replace('BUILD_STATUS_BRONZE_RC2_BUILD114.md', 'BUILD_STATUS_BRONZE_RC2_BUILD113.md'));
  const staleRef = run();
  verify(staleRef.status !== 0, 'stale build reference was accepted');
  verify(staleRef.stderr.includes('stale active build reference'), `stale reference reason missing=${staleRef.stderr}`);
  await writeFile(join(fixture, 'START_HERE_TR.md'), originalStart);

  const originalVerification = await read(join(fixture, 'VERIFICATION_REPORT.md'));
  const rootCleanStatus = (await read(join(fixture, 'BUILD_STATUS.md'))).match(/^- Clean install gate: \*\*(PASS|FAIL|NOT_RUN)/m)?.[1];
  const mismatchedStatus = rootCleanStatus === 'PASS' ? 'NOT_RUN' : 'PASS';
  await writeFile(join(fixture, 'VERIFICATION_REPORT.md'), originalVerification.replace(/- Clean install gate: \*\*(?:PASS|FAIL|NOT_RUN)\*\*/, `- Clean install gate: **${mismatchedStatus}**`));
  const falsePass = run();
  verify(falsePass.status !== 0, 'false PASS mismatch was accepted');
  verify(falsePass.stderr.includes('status mismatch Clean install gate'), `false PASS reason missing=${falsePass.stderr}`);
  await writeFile(join(fixture, 'VERIFICATION_REPORT.md'), originalVerification);

  await writeFile(join(fixture, 'DELIVERY_SUMMARY_TR.md'), `${await read(join(fixture, 'DELIVERY_SUMMARY_TR.md'))}\nDrift\n`);
  const summaryDrift = run();
  verify(summaryDrift.status !== 0, 'summary drift was accepted');
  verify(summaryDrift.stderr.includes('package and delivery summaries diverged'), `summary drift reason missing=${summaryDrift.stderr}`);
} finally {
  await rm(fixture, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`Build 114 architecture validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 114 architecture verified: ${checks} assertions.`);
