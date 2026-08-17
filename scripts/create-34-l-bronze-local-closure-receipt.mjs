import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, open, readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const evidencePaths = Object.freeze([
  'artifacts/validation/34-L-bronze-final-local-closure-boundary.json',
  'artifacts/validation/34-L-bronze-final-local-closure-contract.json',
  'artifacts/validation/34-L-bronze-final-local-closure-runtime.json'
]);
const expectedModes = new Map(evidencePaths.map((path) => [path,
  path.endsWith('-boundary.json') ? 'boundary' : path.endsWith('-contract.json') ? 'contract' : 'runtime']));
const git = (args) => spawnSync('git', ['-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', ...args],
  { cwd: root, encoding: 'utf8', stdio: 'pipe', maxBuffer: 8 * 1024 * 1024 });
const headResult = git(['rev-parse', 'HEAD']);
if (headResult.status !== 0 || !/^[0-9a-f]{40}\s*$/u.test(headResult.stdout ?? '')) {
  throw new Error('Cannot resolve source base HEAD.');
}
const sourceBaseHead = headResult.stdout.trim();

const evidence = [];
for (const path of evidencePaths) {
  const bytes = await readFile(resolve(root, path));
  const parsed = JSON.parse(bytes.toString('utf8'));
  const generatedAtMs = Date.parse(parsed.generatedAt);
  if (parsed.schemaVersion !== 1 || parsed.step !== '34-L' || parsed.decision !== 'DEC-249' ||
    parsed.mode !== expectedModes.get(path) || parsed.status !== 'PASS' || parsed.requirementsClosed !== false ||
    parsed.countsAsRequirementPass !== false || parsed.sourceBaseHead !== sourceBaseHead ||
    !Number.isFinite(generatedAtMs) || Math.abs(Date.now() - generatedAtMs) > 86_400_000) {
    throw new Error(`Evidence is stale, malformed or not source-bound: ${path}`);
  }
  evidence.push(Object.freeze({ path, bytes: bytes.length, sha256: sha256(bytes), mode: parsed.mode,
    status: parsed.status, sourceBaseHead: parsed.sourceBaseHead, countsAsRequirementPass: false }));
}

const evidenceSetSha256 = sha256(Buffer.from(JSON.stringify(evidence)));
const receiptPath = `artifacts/validation/34-L-bronze-local-closure-receipts/${sourceBaseHead}-${evidenceSetSha256.slice(0, 16)}.json`;
const target = resolve(root, receiptPath);
const checksumTarget = `${target}.sha256`;
if (existsSync(target) || existsSync(checksumTarget)) {
  if (!existsSync(target) || !existsSync(checksumTarget)) throw new Error('Existing receipt publication is incomplete.');
  const bytes = await readFile(target);
  const parsed = JSON.parse(bytes.toString('utf8'));
  const checksum = (await readFile(checksumTarget, 'ascii')).trim();
  const exactEvidence = Array.isArray(parsed.evidence) && parsed.evidence.length === evidence.length &&
    parsed.evidence.every((item, index) => item?.path === evidence[index].path && item.sha256 === evidence[index].sha256);
  if (parsed.sourceBaseHead !== sourceBaseHead || parsed.status !== 'PASS_LOCAL_ONLY' ||
    parsed.finalCommitBindingEstablished !== false || parsed.requirementsClosed !== false ||
    parsed.countsAsRequirementPass !== false || !exactEvidence ||
    checksum !== `${sha256(bytes)}  ${basename(target)}`) {
    throw new Error('Existing versioned local closure receipt is malformed; overwrite is forbidden.');
  }
  console.log(JSON.stringify({ status: parsed.status, path: receiptPath,
    sha256: sha256(bytes), sourceBaseHead, reused: true, requirementsClosed: false }));
  process.exit(0);
}

const statusResult = git(['status', '--porcelain=v1', '-z', '--untracked-files=all']);
if (statusResult.status !== 0) throw new Error('Cannot inspect worktree state before receipt creation.');
const allowedDirty = new Set(evidencePaths);
const dirtyEntries = (statusResult.stdout ?? '').split('\0').filter(Boolean);
for (const entry of dirtyEntries) {
  const status = entry.slice(0, 2);
  const path = entry.slice(3).replaceAll('\\', '/');
  if (!allowedDirty.has(path) || ![' M', '??'].includes(status)) {
    throw new Error(`Receipt creation requires an evidence-only unstaged worktree; blocked by ${status} ${path}`);
  }
}

const scope = JSON.parse(await readFile(resolve(root,
  'config/34-l-bronze-final-drift-deterministic-delivery-closure-scope.json'), 'utf8'));
const receipt = Object.freeze({
  schemaVersion: 2,
  id: `34-L-BRONZE-LOCAL-CLOSURE-${evidenceSetSha256.slice(0, 24)}`,
  step: '34-L',
  decision: 'DEC-249',
  status: 'PASS_LOCAL_ONLY',
  sourceBaseHead,
  finalCommitBindingEstablished: false,
  finalCommitBinding: 'NOT_ESTABLISHED_PRECOMMIT_LOCAL_EVIDENCE',
  evidence,
  evidenceSetSha256,
  localAutomatedEvidenceComplete: true,
  requirementsClosed: false,
  countsAsRequirementPass: false,
  manualEvidence: scope.manualEvidence,
  externalClaimsMade: false,
  generatedAt: new Date().toISOString()
});
const receiptBytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
await mkdir(resolve(root, 'artifacts/validation/34-L-bronze-local-closure-receipts'), { recursive: true });
const handle = await open(target, 'wx', 0o600);
try {
  await handle.writeFile(receiptBytes);
  await handle.sync();
} finally {
  await handle.close();
}
const readback = await readFile(target);
if (!readback.equals(receiptBytes)) throw new Error('Receipt readback mismatch.');
const checksumBytes = Buffer.from(`${sha256(readback)}  ${basename(target)}\n`, 'ascii');
const checksumHandle = await open(checksumTarget, 'wx', 0o600);
try {
  await checksumHandle.writeFile(checksumBytes);
  await checksumHandle.sync();
} finally {
  await checksumHandle.close();
}
if (!(await readFile(checksumTarget)).equals(checksumBytes)) throw new Error('Receipt checksum readback mismatch.');
console.log(JSON.stringify({ status: receipt.status, path: receiptPath,
  sha256: sha256(readback), sourceBaseHead, reused: false, requirementsClosed: false }));
