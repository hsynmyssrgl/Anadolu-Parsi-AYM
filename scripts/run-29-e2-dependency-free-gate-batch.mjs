import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const readJson = async (path) => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/u, ''));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const valueAfter = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const start = Number(valueAfter('--start', '0'));
const size = Number(valueAfter('--size', '25'));
const output = valueAfter('--output', `artifacts/validation/29-E2_batches/batch-${start}.json`);
if (!Number.isInteger(start) || start < 0 || !Number.isInteger(size) || size < 1) throw new Error('Invalid batch bounds');

const inventory = await readJson('artifacts/inventory/29-E1_TARGETED_TEST_SECURITY_GATE_INVENTORY.json');
const candidates = inventory.scripts.filter((item) => item.executionClass === 'DEPENDENCY_FREE_NODE' && item.name.startsWith('verify:'));
const selected = candidates.slice(start, start + size);
const results = [];
for (const item of selected) {
  const segmentResults = [];
  let exitCode = 0;
  for (const segment of item.command.split(/\s+&&\s+/u)) {
    const tokens = segment.trim().split(/\s+/u);
    if (!/^node(?:\.exe)?$/iu.test(tokens[0] ?? '')) {
      segmentResults.push({ segment, exitCode: 126, signal: null, error: 'NON_NODE_SEGMENT_REJECTED', stdout: '', stderr: '', stdoutSha256: sha256(''), stderrSha256: sha256('') });
      exitCode = 126;
      break;
    }
    const run = spawnSync(process.execPath, tokens.slice(1), { cwd: process.cwd(), env: process.env, encoding: 'utf8', timeout: 120000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    const stdout = run.stdout ?? '';
    const stderr = run.stderr ?? '';
    const code = Number.isInteger(run.status) ? run.status : 125;
    segmentResults.push({ segment, exitCode: code, signal: run.signal ?? null, error: run.error ? `${run.error.name}: ${run.error.message}` : null, stdout, stderr, stdoutSha256: sha256(stdout), stderrSha256: sha256(stderr) });
    if (code !== 0) { exitCode = code; break; }
  }
  results.push({ name: item.name, command: item.command, securityCandidate: item.securityCandidate, targetedTestCandidate: item.targetedTestCandidate, executionClass: item.executionClass, segmentResults, exitCode, status: exitCode === 0 ? 'PASS' : 'FAIL' });
}
const failed = results.filter((item) => item.exitCode !== 0).length;
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '29-E2',
  phase: 'DEPENDENCY_FREE_GATE_BATCH_EXECUTION',
  candidateTotal: candidates.length,
  batchStart: start,
  batchSizeRequested: size,
  executed: results.length,
  passed: results.length - failed,
  failed,
  results,
  collectorProcessStatus: 'PASS',
  gateStatus: failed === 0 ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString(),
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(`29-E2 batch ${start}-${start + results.length - 1}: ${report.gateStatus} (${report.passed}/${report.executed}, candidate total ${candidates.length}).`);
