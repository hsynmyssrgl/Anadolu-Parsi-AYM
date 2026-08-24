import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import {
  BOOTSTRAP_ADOPTION_BASE_COMMIT, CANONICAL_MUTATION_IMPACT_AREAS,
  CANONICAL_UNIVERSAL_AFFECTED_VITEST_FILES, CANONICAL_UNIVERSAL_DEPENDENT_RECORDS,
  createDependencyAssessmentContract,
  validateFullEvidenceCommandResults,
  validateImpactAssessment, validateTargetedTestFiles
} from './mutation-release-evidence.mjs';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const GIT_OBJECT_PATTERN = /^[a-f0-9]{40,64}$/u;
const REGULAR_BLOB_MODES = new Set(['100644', '100755']);
const GOVERNED_PREFIXES = Object.freeze([
  'apps/', 'packages/', 'scripts/', 'config/', 'docs/current/', 'docs/decisions/', 'docs/adr/'
]);
const GOVERNED_EXACT_PATHS = new Set([
  'package.json', 'package-lock.json', 'repository-metadata.json', 'tsconfig.base.json'
]);
const GOVERNED_SELF_INDEX_PATHS = new Set([
  'artifacts/manifests/PROJECT_ARTIFACT_INDEX.json',
  'artifacts/manifests/PROJECT_ARTIFACT_INDEX.csv',
  'artifacts/manifests/PROJECT_ARTIFACT_INDEX.md',
  'artifacts/manifests/ALL_DOCUMENTS_INDEX.json',
  'artifacts/manifests/ALL_DOCUMENTS_INDEX.csv',
  'artifacts/manifests/ALL_DOCUMENTS_INDEX.md',
  'docs/current/08_TUM_BELGELER_DIZINI.md',
  'artifacts/inventory/TESLIMAT_CALISMA_AGACI_ENVANTERI.json',
  'docs/current/13_TESLIMAT_CALISMA_AGACI_ENVANTERI.md',
  'manifest.json',
  'SHA256SUMS.txt'
]);

const sha256Bytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sha256File = (path) => new Promise((resolvePromise, rejectPromise) => {
  const hasher = createHash('sha256');
  const stream = createReadStream(path);
  stream.on('error', rejectPromise);
  stream.on('data', (chunk) => hasher.update(chunk));
  stream.on('end', () => resolvePromise(hasher.digest('hex')));
});
const portablePath = (path) => path.split(sep).join('/');
const samePath = (left, right) => resolve(left).toLowerCase() === resolve(right).toLowerCase();
const fail = (message) => { throw new Error(message); };

const resolveEvidenceFile = async ({ aymRoot, relativePath, expectedPrefix, label }) => {
  if (typeof relativePath !== 'string' || isAbsolute(relativePath) || relativePath.includes('\\')) {
    fail(`${label} path is not a safe portable relative path.`);
  }
  const segments = relativePath.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')
    || !relativePath.startsWith(expectedPrefix)) {
    fail(`${label} path is outside its governed evidence boundary.`);
  }
  const anchor = await realpath(resolve(aymRoot));
  const target = resolve(anchor, ...segments);
  const item = await lstat(target);
  if (!item.isFile() || item.isSymbolicLink()) fail(`${label} must be a regular non-link file.`);
  const resolvedTarget = await realpath(target);
  const local = relative(anchor, resolvedTarget);
  if (!local || local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local)) {
    fail(`${label} resolved outside the AYM evidence root.`);
  }
  return Object.freeze({ fullPath: resolvedTarget, sizeBytes: item.size, sha256: await sha256File(resolvedTarget) });
};

export const isGovernedSourcePath = (path) => (
  !GOVERNED_SELF_INDEX_PATHS.has(path)
  && (GOVERNED_EXACT_PATHS.has(path) || GOVERNED_PREFIXES.some((prefix) => path.startsWith(prefix)))
);

export const computeGovernedFingerprintFromEntries = (entries) => {
  const governed = entries.filter((entry) => isGovernedSourcePath(entry.path)).sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const hash = createHash('sha256');
  for (const entry of governed) {
    hash.update(entry.path);
    hash.update('\0');
    hash.update(entry.bytes);
    hash.update('\0');
  }
  return Object.freeze({ sha256: hash.digest('hex'), fileCount: governed.length });
};

export const computeTrackedCommitFingerprintFromEntries = (entries) => {
  const ordered = [...entries].sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const hash = createHash('sha256');
  let totalBytes = 0;
  for (const entry of ordered) {
    const digest = entry.sha256 ?? sha256Bytes(entry.bytes);
    totalBytes += entry.sizeBytes ?? entry.bytes.length;
    hash.update(entry.path);
    hash.update('\0');
    hash.update(entry.mode);
    hash.update('\0');
    hash.update(String(entry.sizeBytes ?? entry.bytes.length));
    hash.update('\0');
    hash.update(digest);
    hash.update('\0');
  }
  return Object.freeze({ sha256: hash.digest('hex'), fileCount: ordered.length, totalBytes });
};

const createDefaultGitRunner = (root) => (args) => {
  const result = spawnSync('git', ['-c', `safe.directory=${root}`, ...args], {
    cwd: root,
    encoding: null,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 1024
  });
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : String(result.stderr ?? '');
    fail(`git ${args.join(' ')} failed: ${stderr.trim()}`);
  }
  return Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? '');
};

const asBuffer = (value) => Buffer.isBuffer(value) ? value : Buffer.from(value ?? '');
const gitText = (runGit, args) => asBuffer(runGit(args)).toString('utf8').trim();

const parseWorktrees = (text) => text.split(/\r?\n\r?\n/u).filter(Boolean).map((record) => ({
  path: /^worktree (.+)$/mu.exec(record)?.[1] ?? '',
  branch: /^branch refs\/heads\/(.+)$/mu.exec(record)?.[1] ?? null,
  detached: /^detached$/mu.test(record)
}));

const assertSafeTrackedPath = (path) => {
  if (!path || path.includes('\\') || path.startsWith('/') || /^[A-Za-z]:/u.test(path)) fail(`Unsafe tracked path: ${path}`);
  const segments = path.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) fail(`Unsafe tracked path segment: ${path}`);
};

const parseLsTree = (bytes) => {
  const entries = [];
  const paths = new Set();
  for (const raw of asBuffer(bytes).toString('utf8').split('\0')) {
    if (!raw) continue;
    const match = /^(\d{6}) ([^ ]+) ([a-f0-9]{40,64})\t([\s\S]+)$/u.exec(raw);
    if (!match) fail(`Malformed git ls-tree entry: ${raw}`);
    const [, mode, type, oid, path] = match;
    assertSafeTrackedPath(path);
    if (type !== 'blob' || !REGULAR_BLOB_MODES.has(mode)) {
      fail(`Tracked source contains a forbidden non-regular entry: ${mode} ${type} ${path}`);
    }
    if (paths.has(path)) fail(`Duplicate tracked path: ${path}`);
    paths.add(path);
    entries.push({ path, mode, oid });
  }
  if (entries.length === 0) fail('Exact commit tracked inventory is empty.');
  return entries.sort((a, b) => a.path.localeCompare(b.path, 'en'));
};

const gitObjectId = (objectFormat, bytes) => createHash(objectFormat)
  .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
  .update(bytes)
  .digest('hex');

const resolvePolicy = async ({ root, expectedChannel, configuration, releaseLedger }) => {
  const config = configuration ?? JSON.parse(await readFile(resolve(root, 'config/release-channel-worktrees.json'), 'utf8'));
  const ledger = releaseLedger ?? JSON.parse(await readFile(resolve(root, 'config/release-ledger.json'), 'utf8'));
  if (config?.schemaVersion !== 1 || config.policyId !== 'PPT-RELEASE-CHANNEL-WORKTREE-ISOLATION-V1') {
    fail('Release-channel worktree policy is invalid.');
  }
  const definition = config.channels?.find((entry) => entry.channel === expectedChannel);
  if (!definition) fail(`Release-channel worktree definition is missing: ${expectedChannel}`);
  if (ledger.current?.channel !== expectedChannel) fail(`Active release channel is not ${expectedChannel}.`);
  const codeRoot = dirname(dirname(root));
  const expectedRoot = resolve(codeRoot, config.worktreeRootDirectory, definition.directory);
  const authorityRoot = resolve(codeRoot, config.authoritativeRepositoryDirectory);
  return Object.freeze({ config, ledger, definition, codeRoot, expectedRoot, authorityRoot });
};

const captureLightweightIdentity = ({ root, runGit, policy, requireClean }) => {
  const topLevel = gitText(runGit, ['rev-parse', '--show-toplevel']);
  if (!samePath(topLevel, root) || !samePath(root, policy.expectedRoot)) {
    fail(`Release source must run from the exact ${policy.definition.channel} worktree: ${policy.expectedRoot}`);
  }
  const branch = gitText(runGit, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  if (branch !== policy.definition.branch) fail(`Release source branch mismatch: ${branch || 'DETACHED'}`);
  const headCommit = gitText(runGit, ['rev-parse', 'HEAD']).toLowerCase();
  const headTree = gitText(runGit, ['rev-parse', 'HEAD^{tree}']).toLowerCase();
  const branchCommit = gitText(runGit, ['rev-parse', `refs/heads/${policy.definition.branch}`]).toLowerCase();
  const objectFormat = gitText(runGit, ['rev-parse', '--show-object-format']).toLowerCase();
  if (!GIT_OBJECT_PATTERN.test(headCommit) || !GIT_OBJECT_PATTERN.test(headTree) || headCommit !== branchCommit) {
    fail('Release source HEAD/tree/branch identity is invalid.');
  }
  if (!new Set(['sha1', 'sha256']).has(objectFormat)) fail(`Unsupported Git object format: ${objectFormat}`);
  const status = asBuffer(runGit(['status', '--porcelain=v1', '-z', '--untracked-files=all']));
  if (requireClean && status.length !== 0) fail('Release source worktree is not clean.');
  const worktrees = parseWorktrees(gitText(runGit, ['worktree', 'list', '--porcelain']));
  const binding = worktrees.find((entry) => samePath(entry.path, root));
  if (!binding || binding.detached || binding.branch !== policy.definition.branch) fail('Release worktree registration is invalid.');
  const commonGitDirectory = resolve(root, gitText(runGit, ['rev-parse', '--git-common-dir']));
  const expectedCommonGitDirectory = resolve(policy.authorityRoot, '.git');
  if (!samePath(commonGitDirectory, expectedCommonGitDirectory)) fail('Release worktree does not use the authoritative shared Git object database.');
  return Object.freeze({ branch, headCommit, headTree, objectFormat, worktreeClean: status.length === 0 });
};

export const captureReleaseSourceProvenance = async ({
  root = process.cwd(),
  expectedChannel = 'Bronze',
  requireClean = true,
  runGit: suppliedRunner,
  configuration,
  releaseLedger
} = {}) => {
  const sourceRoot = resolve(root);
  const runGit = suppliedRunner ?? createDefaultGitRunner(sourceRoot);
  const policy = await resolvePolicy({ root: sourceRoot, expectedChannel, configuration, releaseLedger });
  const before = captureLightweightIdentity({ root: sourceRoot, runGit, policy, requireClean });
  const treeEntries = parseLsTree(runGit(['ls-tree', '-r', '-z', '--full-tree', before.headCommit]));
  const entries = [];
  for (const entry of treeEntries) {
    const bytes = asBuffer(runGit(['cat-file', 'blob', entry.oid]));
    const calculatedObjectId = gitObjectId(before.objectFormat, bytes);
    if (calculatedObjectId !== entry.oid) fail(`Git blob identity mismatch: ${entry.path}`);
    entries.push(Object.freeze({
      ...entry,
      sizeBytes: bytes.length,
      sha256: sha256Bytes(bytes),
      bytes
    }));
  }
  const trackedCommitFingerprint = computeTrackedCommitFingerprintFromEntries(entries);
  const governedSourceFingerprint = computeGovernedFingerprintFromEntries(entries);
  if (!SHA256_PATTERN.test(trackedCommitFingerprint.sha256) || !SHA256_PATTERN.test(governedSourceFingerprint.sha256)) {
    fail('Release source fingerprint calculation failed.');
  }
  const after = captureLightweightIdentity({ root: sourceRoot, runGit, policy, requireClean });
  for (const key of ['branch', 'headCommit', 'headTree', 'objectFormat', 'worktreeClean']) {
    if (after[key] !== before[key]) fail(`Release source changed while provenance was captured: ${key}`);
  }
  const relativeSource = portablePath(relative(dirname(policy.codeRoot), sourceRoot));
  const provenance = Object.freeze({
    schemaVersion: 1,
    policyId: policy.config.policyId,
    channel: expectedChannel,
    source: relativeSource,
    worktreeDirectory: policy.definition.directory,
    branch: before.branch,
    headCommit: before.headCommit,
    headTree: before.headTree,
    objectFormat: before.objectFormat,
    worktreeClean: before.worktreeClean,
    sharedGitObjectDatabaseVerified: true,
    trackedCommitFingerprint,
    governedSourceFingerprint
  });
  return Object.freeze({ provenance, entries: Object.freeze(entries), policy, runGit });
};

export const captureAuthoritativeSourceProvenance = async ({
  root = process.cwd(),
  requireClean = true,
  runGit: suppliedRunner,
  configuration
} = {}) => {
  const sourceRoot = resolve(root);
  const runGit = suppliedRunner ?? createDefaultGitRunner(sourceRoot);
  const activeConfiguration = configuration
    ?? JSON.parse(await readFile(resolve(sourceRoot, 'config/release-channel-worktrees.json'), 'utf8'));
  if (activeConfiguration?.schemaVersion !== 1
    || activeConfiguration.policyId !== 'PPT-RELEASE-CHANNEL-WORKTREE-ISOLATION-V1') {
    fail('Authoritative source worktree policy is invalid.');
  }
  const codeRoot = dirname(sourceRoot);
  const expectedRoot = resolve(codeRoot, activeConfiguration.authoritativeRepositoryDirectory);
  if (!samePath(sourceRoot, expectedRoot)
    || !samePath(gitText(runGit, ['rev-parse', '--show-toplevel']), expectedRoot)) {
    fail(`Authoritative source must run from the exact repository root: ${expectedRoot}`);
  }

  const captureIdentity = () => {
    const branch = gitText(runGit, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
    if (!branch) fail('Authoritative source must not use a detached HEAD.');
    const headCommit = gitText(runGit, ['rev-parse', 'HEAD']).toLowerCase();
    const headTree = gitText(runGit, ['rev-parse', 'HEAD^{tree}']).toLowerCase();
    const objectFormat = gitText(runGit, ['rev-parse', '--show-object-format']).toLowerCase();
    if (!GIT_OBJECT_PATTERN.test(headCommit) || !GIT_OBJECT_PATTERN.test(headTree)) {
      fail('Authoritative source HEAD/tree identity is invalid.');
    }
    if (!new Set(['sha1', 'sha256']).has(objectFormat)) fail(`Unsupported Git object format: ${objectFormat}`);
    const status = asBuffer(runGit(['status', '--porcelain=v1', '-z', '--untracked-files=all']));
    if (requireClean && status.length !== 0) fail('Authoritative source worktree is not clean.');
    const worktrees = parseWorktrees(gitText(runGit, ['worktree', 'list', '--porcelain']));
    const binding = worktrees.find((entry) => samePath(entry.path, sourceRoot));
    if (!binding || binding.detached || binding.branch !== branch) {
      fail('Authoritative source worktree registration is invalid.');
    }
    const commonGitDirectory = resolve(sourceRoot, gitText(runGit, ['rev-parse', '--git-common-dir']));
    if (!samePath(commonGitDirectory, resolve(sourceRoot, '.git'))) {
      fail('Authoritative source does not own the shared Git object database.');
    }
    return Object.freeze({ branch, headCommit, headTree, objectFormat, worktreeClean: status.length === 0 });
  };

  const before = captureIdentity();
  const treeEntries = parseLsTree(runGit(['ls-tree', '-r', '-z', '--full-tree', before.headCommit]));
  const entries = [];
  for (const entry of treeEntries) {
    const bytes = asBuffer(runGit(['cat-file', 'blob', entry.oid]));
    if (gitObjectId(before.objectFormat, bytes) !== entry.oid) {
      fail(`Authoritative Git blob identity mismatch: ${entry.path}`);
    }
    entries.push(Object.freeze({
      ...entry,
      sizeBytes: bytes.length,
      sha256: sha256Bytes(bytes),
      bytes
    }));
  }
  const after = captureIdentity();
  for (const key of ['branch', 'headCommit', 'headTree', 'objectFormat', 'worktreeClean']) {
    if (after[key] !== before[key]) fail(`Authoritative source changed while provenance was captured: ${key}`);
  }
  const provenance = Object.freeze({
    schemaVersion: 1,
    policyId: activeConfiguration.policyId,
    channel: 'Authoritative',
    source: portablePath(relative(dirname(codeRoot), sourceRoot)),
    branch: before.branch,
    headCommit: before.headCommit,
    headTree: before.headTree,
    objectFormat: before.objectFormat,
    worktreeClean: before.worktreeClean,
    sharedGitObjectDatabaseVerified: true,
    trackedCommitFingerprint: computeTrackedCommitFingerprintFromEntries(entries),
    governedSourceFingerprint: computeGovernedFingerprintFromEntries(entries)
  });
  return Object.freeze({
    policy: Object.freeze({ codeRoot, expectedRoot, authorityRoot: sourceRoot, config: activeConfiguration }),
    provenance,
    entries: Object.freeze(entries),
    runGit
  });
};

export const assertAuthoritativeAndChannelExactEquality = (authoritative, channel) => {
  if (authoritative?.worktreeClean !== true || channel?.worktreeClean !== true) {
    fail('Authoritative application and release channel worktrees must both be clean.');
  }
  for (const key of ['headCommit', 'headTree', 'objectFormat']) {
    if (authoritative?.[key] !== channel?.[key]) fail(`Authoritative application / release channel ${key} mismatch.`);
  }
  for (const fingerprint of ['trackedCommitFingerprint', 'governedSourceFingerprint']) {
    for (const key of ['sha256', 'fileCount']) {
      if (authoritative?.[fingerprint]?.[key] !== channel?.[fingerprint]?.[key]) {
        fail(`Authoritative application / release channel ${fingerprint}.${key} mismatch.`);
      }
    }
  }
  if (authoritative?.trackedCommitFingerprint?.totalBytes !== channel?.trackedCommitFingerprint?.totalBytes) {
    fail('Authoritative application / release channel tracked byte count mismatch.');
  }
  return true;
};

export const assertMatchingReleaseSourceProvenance = (actual, expected, label = 'release source') => {
  const keys = ['policyId', 'channel', 'source', 'worktreeDirectory', 'branch', 'headCommit', 'headTree', 'objectFormat'];
  for (const key of keys) if (actual?.[key] !== expected?.[key]) fail(`${label} ${key} mismatch.`);
  if (actual?.worktreeClean !== true || actual?.sharedGitObjectDatabaseVerified !== true) fail(`${label} is not a clean governed worktree.`);
  for (const fingerprint of ['trackedCommitFingerprint', 'governedSourceFingerprint']) {
    if (actual?.[fingerprint]?.sha256 !== expected?.[fingerprint]?.sha256
      || actual?.[fingerprint]?.fileCount !== expected?.[fingerprint]?.fileCount) {
      fail(`${label} ${fingerprint} mismatch.`);
    }
  }
  if (actual?.trackedCommitFingerprint?.totalBytes !== expected?.trackedCommitFingerprint?.totalBytes) {
    fail(`${label} trackedCommitFingerprint totalBytes mismatch.`);
  }
  return true;
};

const assertReleaseEvidenceIdentity = (evidence, provenance, canonicalRulesSha256, label) => {
  if (evidence?.status !== 'PASS') fail(`${label} did not PASS.`);
  if (evidence.sourceCommit !== provenance.headCommit) fail(`${label} source commit is stale.`);
  if (evidence.governedSourceFingerprintSha256 !== provenance.governedSourceFingerprint.sha256) {
    fail(`${label} governed-source fingerprint is stale.`);
  }
  if (evidence.canonicalRuleRegistrySha256 !== canonicalRulesSha256) fail(`${label} canonical-rule hash is stale.`);
};

const assertVitestOutputBinding = (evidence, label) => {
  const output = evidence?.vitestOutput;
  if (!Number.isSafeInteger(output?.stdoutSizeBytes) || output.stdoutSizeBytes < 0
    || !SHA256_PATTERN.test(String(output?.stdoutSha256 ?? ''))
    || !Number.isSafeInteger(output?.stderrSizeBytes) || output.stderrSizeBytes < 0
    || !SHA256_PATTERN.test(String(output?.stderrSha256 ?? ''))) {
    fail(`${label} Vitest output size/SHA-256 binding is invalid.`);
  }
};

const captureCommitFingerprints = ({ runGit, commit, objectFormat }) => {
  const treeEntries = parseLsTree(runGit(['ls-tree', '-r', '-z', '--full-tree', commit]));
  const entries = treeEntries.map((entry) => {
    const bytes = asBuffer(runGit(['cat-file', 'blob', entry.oid]));
    if (gitObjectId(objectFormat, bytes) !== entry.oid) fail(`Git blob identity mismatch: ${entry.path}`);
    return { ...entry, sizeBytes: bytes.length, sha256: sha256Bytes(bytes), bytes };
  });
  return Object.freeze({
    trackedCommitFingerprint: computeTrackedCommitFingerprintFromEntries(entries),
    governedSourceFingerprint: computeGovernedFingerprintFromEntries(entries),
    entries: Object.freeze(entries)
  });
};

export const captureHistoricalReleaseSourceProvenance = ({ runGit, currentProvenance, commit }) => {
  if (!GIT_OBJECT_PATTERN.test(String(commit ?? ''))) fail('Historical release source commit is invalid.');
  try { runGit(['merge-base', '--is-ancestor', commit, currentProvenance.headCommit]); }
  catch { fail('Historical release source commit is not an ancestor of current HEAD.'); }
  const headTree = gitText(runGit, ['rev-parse', `${commit}^{tree}`]).toLowerCase();
  const fingerprints = captureCommitFingerprints({ runGit, commit, objectFormat: currentProvenance.objectFormat });
  return Object.freeze({
    ...currentProvenance,
    headCommit: commit,
    headTree,
    trackedCommitFingerprint: fingerprints.trackedCommitFingerprint,
    governedSourceFingerprint: fingerprints.governedSourceFingerprint
  });
};

export const verifyMutationBaselineReceipt = ({ runGit, baselineReceipt, baselinePointer, currentProvenance }) => {
  const baseline = baselineReceipt?.sourceProvenance;
  if (baselineReceipt?.schemaVersion !== 2 || baselineReceipt.id !== 'PPT-MUTATION-BASELINE-EXTERNAL-V2'
    || baselineReceipt.requirement !== 'PR-235' || baselineReceipt.decision !== 'DEC-270'
    || baselineReceipt.strengthenedByRequirement !== 'PR-240' || baselineReceipt.strengthenedByDecision !== 'DEC-275'
    || baselineReceipt.status !== 'PASS' || baselineReceipt.evidenceKind !== 'PRE_MUTATION_BASELINE_EXTERNAL'
    || !new Set(['PRE_MUTATION', 'BOOTSTRAP_ADOPTION']).has(baselineReceipt.baselineType)
    || baselineReceipt.operationRuleBinding?.status !== 'PASS'
    || baselineReceipt.operationRuleBinding?.kind !== 'mutation'
    || baselineReceipt.operationRuleBinding?.operation !== 'record-pre-mutation-baseline'
    || !SHA256_PATTERN.test(String(baselineReceipt.operationRuleBinding?.sha256 ?? ''))
    || baselineReceipt.producer?.path !== 'scripts/record-mutation-baseline.mjs'
    || !SHA256_PATTERN.test(String(baselineReceipt.producer?.sha256 ?? ''))
    || !Number.isFinite(Date.parse(baselineReceipt.recordedAt ?? ''))) {
    fail('Pre-mutation baseline receipt is invalid.');
  }
  if (!baseline || baseline.channel !== currentProvenance?.channel || baseline.branch !== currentProvenance?.branch
    || baseline.policyId !== currentProvenance?.policyId || baseline.objectFormat !== currentProvenance?.objectFormat
    || baseline.worktreeClean !== true || baseline.sharedGitObjectDatabaseVerified !== true) {
    fail('Pre-mutation baseline is not bound to the governed release channel.');
  }
  const baseCommit = String(baseline.headCommit ?? '').toLowerCase();
  const headCommit = String(currentProvenance?.headCommit ?? '').toLowerCase();
  if (!GIT_OBJECT_PATTERN.test(baseCommit) || !GIT_OBJECT_PATTERN.test(headCommit) || baseCommit === headCommit) {
    fail('Pre-mutation baseline and release commit are invalid or identical.');
  }
  if (baselineReceipt.baselineType === 'BOOTSTRAP_ADOPTION'
    && (baseCommit !== BOOTSTRAP_ADOPTION_BASE_COMMIT || baselineReceipt.bootstrapDecision !== 'DEC-270_INITIAL_ACTIVATION_ONLY'
      || baselineReceipt.fullDiffRequired !== true || baselineReceipt.chain?.sequence !== 1)) {
    fail('Bootstrap adoption baseline is not the single-use DEC-270 activation record.');
  }
  try { runGit(['merge-base', '--is-ancestor', baseCommit, headCommit]); }
  catch { fail('Mutation impact analysis base commit is not an ancestor of the release commit.'); }
  const actualTree = gitText(runGit, ['rev-parse', `${baseCommit}^{tree}`]).toLowerCase();
  if (actualTree !== baseline.headTree) fail('Pre-mutation baseline tree is stale or forged.');
  const actual = captureCommitFingerprints({ runGit, commit: baseCommit, objectFormat: baseline.objectFormat });
  let producerCommit = baseCommit;
  if (baselineReceipt.baselineType === 'BOOTSTRAP_ADOPTION') {
    producerCommit = String(baselinePointer?.sourceCommit ?? '').toLowerCase();
    if (baselinePointer?.schemaVersion !== 2 || baselinePointer.id !== 'PPT-MUTATION-BASELINE-POINTER-V2'
      || baselinePointer.status !== 'PASS' || baselinePointer.evidenceKind !== 'PRE_MUTATION_BASELINE_POINTER'
      || baselinePointer.requirement !== 'PR-235' || baselinePointer.decision !== 'DEC-270'
      || baselinePointer.strengthenedByRequirement !== 'PR-240'
      || baselinePointer.strengthenedByDecision !== 'DEC-275'
      || !GIT_OBJECT_PATTERN.test(producerCommit) || producerCommit === baseCommit
      || baselinePointer.producer?.path !== baselineReceipt.producer.path
      || baselinePointer.producer?.sizeBytes !== baselineReceipt.producer.sizeBytes
      || baselinePointer.producer?.sha256 !== baselineReceipt.producer.sha256) {
      fail('Bootstrap adoption baseline producer recording commit is invalid.');
    }
    try {
      runGit(['merge-base', '--is-ancestor', baseCommit, producerCommit]);
      runGit(['merge-base', '--is-ancestor', producerCommit, headCommit]);
    } catch {
      fail('Bootstrap adoption baseline producer recording commit is outside the release ancestry.');
    }
  }
  let producerBytes;
  try { producerBytes = asBuffer(runGit(['show', `${producerCommit}:${baselineReceipt.producer.path}`])); }
  catch { fail('Pre-mutation baseline producer is not available at its governed producer commit.'); }
  if (producerBytes.length !== baselineReceipt.producer.sizeBytes
    || sha256Bytes(producerBytes) !== baselineReceipt.producer.sha256) {
    fail('Pre-mutation baseline producer is not bound to its governed producer commit.');
  }
  assertMatchingReleaseSourceProvenance({
    ...baseline,
    headCommit: baseCommit,
    headTree: actualTree,
    trackedCommitFingerprint: actual.trackedCommitFingerprint,
    governedSourceFingerprint: actual.governedSourceFingerprint
  }, baseline, 'pre-mutation baseline readback');
  return Object.freeze({ baseCommit, baseline });
};

export const listChangedPathsForImpactAnalysis = ({ runGit, baselineReceipt, baselinePointer, headCommit, currentProvenance }) => {
  const { baseCommit } = verifyMutationBaselineReceipt({ runGit, baselineReceipt, baselinePointer, currentProvenance });
  const bytes = asBuffer(runGit(['diff', '--name-only', '-z', '--diff-filter=ACDMRTUXB', baseCommit, headCommit]));
  const paths = bytes.toString('utf8').split('\0').filter(Boolean);
  for (const path of paths) assertSafeTrackedPath(path);
  return Object.freeze([...new Set(paths)].sort((a, b) => a.localeCompare(b, 'en')));
};

export const validateMutationReleaseEvidence = ({
  policy,
  canonicalRulesSha256,
  provenance,
  changedFiles,
  mutationBaselinePointer,
  mutationBaselinePointerSha256,
  mutationBaseline,
  mutationBaselineExternalSha256,
  impactAssessment,
  impactAssessmentSha256,
  impactAnalysis,
  targetedTest,
  fullRegression,
  sourceIntegrity,
  evidenceHashes,
  producerBindings,
  manifestBindings,
  impactEvidenceBindings,
  toolchainBindings,
  dependencyRegistry,
  dependencyRegistryBinding,
  dependencyRecordBindings,
  affectedTestBindings
}) => {
  if (policy?.schemaVersion !== 2 || policy.id !== 'PPT-MUTATION-RELEASE-READINESS-V2'
    || policy.requirement !== 'PR-235' || policy.decision !== 'DEC-270'
    || policy.strengthenedByRequirement !== 'PR-240' || policy.strengthenedByDecision !== 'DEC-275'
    || JSON.stringify(policy.impactAreas) !== JSON.stringify(CANONICAL_MUTATION_IMPACT_AREAS)
    || policy.failClosed !== true || policy.waiverAllowed !== false) {
    fail('Mutation-release readiness policy is invalid or weakened.');
  }
  if (provenance?.worktreeClean !== true || provenance?.sharedGitObjectDatabaseVerified !== true) {
    fail('Mutation-release evidence is not evaluated on a clean governed release worktree.');
  }
  if (mutationBaselinePointer?.schemaVersion !== 2 || mutationBaselinePointer.id !== 'PPT-MUTATION-BASELINE-POINTER-V2'
    || mutationBaselinePointer.status !== 'PASS' || mutationBaselinePointer.evidenceKind !== 'PRE_MUTATION_BASELINE_POINTER'
    || mutationBaselinePointer.requirement !== 'PR-235' || mutationBaselinePointer.decision !== 'DEC-270'
    || mutationBaselinePointer.strengthenedByRequirement !== 'PR-240' || mutationBaselinePointer.strengthenedByDecision !== 'DEC-275'
    || !SHA256_PATTERN.test(String(mutationBaselinePointerSha256 ?? ''))
    || !SHA256_PATTERN.test(String(mutationBaselineExternalSha256 ?? ''))
    || mutationBaselinePointer.external?.sha256 !== mutationBaselineExternalSha256) {
    fail('Pre-mutation baseline receipt binding is missing or invalid.');
  }
  const assertProducer = (evidence, id, label) => {
    const expected = producerBindings?.[id];
    if (!expected || evidence?.producer?.path !== expected.path || evidence.producer.sha256 !== expected.sha256
      || evidence.producer.sizeBytes !== expected.sizeBytes) fail(`${label} canonical producer binding is invalid.`);
  };
  if (mutationBaselinePointer?.producer?.path !== mutationBaseline?.producer?.path
    || mutationBaselinePointer?.producer?.sha256 !== mutationBaseline?.producer?.sha256
    || mutationBaselinePointer?.producer?.sizeBytes !== mutationBaseline?.producer?.sizeBytes) {
    fail('Pre-mutation baseline pointer and external receipt producer bindings differ.');
  }
  assertReleaseEvidenceIdentity(impactAnalysis, provenance, canonicalRulesSha256, 'Mutation impact analysis');
  if (impactAnalysis.schemaVersion !== 2 || impactAnalysis.id !== 'PPT-MUTATION-IMPACT-ANALYSIS-V2'
    || impactAnalysis.evidenceKind !== 'MUTATION_IMPACT_ANALYSIS' || impactAnalysis.requirement !== 'PR-235'
    || impactAnalysis.decision !== 'DEC-270' || impactAnalysis.strengthenedByRequirement !== 'PR-240'
    || impactAnalysis.strengthenedByDecision !== 'DEC-275' || impactAnalysis.headCommit !== provenance.headCommit
    || impactAnalysis.baseCommit !== mutationBaseline.sourceProvenance?.headCommit
    || impactAnalysis.chain?.baselinePointerSha256 !== mutationBaselinePointerSha256
    || impactAnalysis.chain?.baselineExternalSha256 !== mutationBaselineExternalSha256
    || impactAnalysis.chain?.assessmentSha256 !== impactAssessmentSha256
    || impactAnalysis.chain?.dependencyRegistrySha256 !== dependencyRegistryBinding?.sha256) {
    fail('Mutation impact analysis contract is invalid.');
  }
  assertProducer(impactAnalysis, 'impactAnalysis', 'Mutation impact analysis');
  const claimedFiles = [...new Set(impactAnalysis.changedFiles ?? [])].sort((a, b) => a.localeCompare(b, 'en'));
  const actualFiles = [...new Set(changedFiles ?? [])].sort((a, b) => a.localeCompare(b, 'en'));
  if (actualFiles.length === 0 || JSON.stringify(claimedFiles) !== JSON.stringify(actualFiles)) {
    fail('Mutation impact analysis changed-file inventory is missing or not exact.');
  }
  const assessed = validateImpactAssessment({
    policy,
    assessment: impactAssessment,
    changedFiles: actualFiles,
    dependencyRegistry,
    dependencyRegistryBinding
  });
  const dependencyAssessment = createDependencyAssessmentContract({ plan: assessed.dependencyPlan, registryBinding: dependencyRegistryBinding });
  if (JSON.stringify(impactAnalysis.impactAreas) !== JSON.stringify(assessed.impactAreas)
    || JSON.stringify(impactAnalysis.changedFileImpacts) !== JSON.stringify(assessed.changedFileImpacts)
    || JSON.stringify(impactAnalysis.evidencePathBindings) !== JSON.stringify(impactEvidenceBindings)
    || JSON.stringify(impactAnalysis.dependencyPlan) !== JSON.stringify(dependencyAssessment)
    || JSON.stringify(impactAnalysis.dependencyRecordBindings) !== JSON.stringify(dependencyRecordBindings)
    || JSON.stringify(impactAnalysis.affectedTestBindings) !== JSON.stringify(affectedTestBindings)) {
    fail('Mutation impact analysis does not match the read-back assessment.');
  }
  assertReleaseEvidenceIdentity(targetedTest, provenance, canonicalRulesSha256, 'Targeted test evidence');
  assertProducer(targetedTest, 'targetedTest', 'Targeted test evidence');
  const targetedFiles = validateTargetedTestFiles(targetedTest.targetFiles);
  if (JSON.stringify(targetedFiles) !== JSON.stringify(assessed.dependencyPlan.affectedVitestFiles)) {
    fail('Targeted test evidence is not the exact affected Vitest set.');
  }
  const expectedTargetedArgs = ['run', ...targetedFiles, '--maxWorkers=1', '--reporter=json'];
  if (targetedTest.schemaVersion !== 2 || targetedTest.id !== 'PPT-MUTATION-TARGETED-TEST-V2'
    || targetedTest.evidenceKind !== 'TARGETED_TEST' || targetedTest.exitCode !== 0
    || targetedTest.requirement !== 'PR-235' || targetedTest.decision !== 'DEC-270'
    || targetedTest.strengthenedByRequirement !== 'PR-240' || targetedTest.strengthenedByDecision !== 'DEC-275'
    || JSON.stringify(targetedTest.commandArguments) !== JSON.stringify(expectedTargetedArgs)
    || targetedTest.chain?.baselinePointerSha256 !== mutationBaselinePointerSha256
    || targetedTest.chain?.impactAnalysisSha256 !== evidenceHashes?.impactAnalysis
    || targetedTest.chain?.assessmentSha256 !== impactAssessmentSha256
    || targetedTest.dependencyRegistry?.path !== dependencyRegistryBinding?.path
    || targetedTest.dependencyRegistry?.sizeBytes !== dependencyRegistryBinding?.sizeBytes
    || targetedTest.dependencyRegistry?.sha256 !== dependencyRegistryBinding?.sha256
    || JSON.stringify(targetedTest.dependencyPlan) !== JSON.stringify(dependencyAssessment)
    || targetedTest.additionalCommandCount !== 0
    || JSON.stringify(targetedTest.additionalCommands) !== JSON.stringify([])
    || targetedTest.additionalCommandsSha256 !== sha256Bytes(Buffer.from(JSON.stringify([])))
    || targetedTest.executionGuard?.beforeSha256 !== targetedTest.executionGuard?.afterSha256
    || !SHA256_PATTERN.test(String(targetedTest.executionGuard?.beforeSha256 ?? ''))
    || JSON.stringify(targetedTest.executionGuard?.toolchainBindings) !== JSON.stringify(toolchainBindings)
    || typeof targetedTest.command !== 'string' || targetedTest.command.trim().length < 8
    || Number(targetedTest.testFilesPassed) < 1 || Number(targetedTest.testsPassed) < 1
    || Number(targetedTest.testFilesFailed ?? 0) !== 0 || Number(targetedTest.testsFailed ?? 0) !== 0) {
    fail('Targeted test evidence has no measured PASS result.');
  }
  assertVitestOutputBinding(targetedTest, 'Targeted test evidence');
  assertReleaseEvidenceIdentity(fullRegression, provenance, canonicalRulesSha256, 'Full regression evidence');
  assertProducer(fullRegression, 'fullRegression', 'Full regression evidence');
  if (fullRegression.schemaVersion !== 2 || fullRegression.id !== 'PPT-MUTATION-FULL-REGRESSION-V2'
    || fullRegression.evidenceKind !== 'FULL_REGRESSION' || fullRegression.exitCode !== 0
    || fullRegression.requirement !== 'PR-235' || fullRegression.decision !== 'DEC-270'
    || fullRegression.strengthenedByRequirement !== 'PR-240' || fullRegression.strengthenedByDecision !== 'DEC-275'
    || JSON.stringify(fullRegression.commandArguments) !== JSON.stringify(['run', '--maxWorkers=1', '--reporter=json'])
    || fullRegression.chain?.targetedTestSha256 !== evidenceHashes?.targetedTest
    || fullRegression.chain?.impactAnalysisSha256 !== evidenceHashes?.impactAnalysis
    || fullRegression.dependencyRegistry?.path !== dependencyRegistryBinding?.path
    || fullRegression.dependencyRegistry?.sizeBytes !== dependencyRegistryBinding?.sizeBytes
    || fullRegression.dependencyRegistry?.sha256 !== dependencyRegistryBinding?.sha256
    || JSON.stringify(fullRegression.dependencyPlan) !== JSON.stringify(dependencyAssessment)
    || fullRegression.executionGuard?.beforeSha256 !== fullRegression.executionGuard?.afterSha256
    || !SHA256_PATTERN.test(String(fullRegression.executionGuard?.beforeSha256 ?? ''))
    || JSON.stringify(fullRegression.executionGuard?.toolchainBindings) !== JSON.stringify(toolchainBindings)
    || Number(fullRegression.testFilesPassed) < 1 || Number(fullRegression.testsPassed) < 1
    || Number(fullRegression.testFilesFailed ?? 0) !== 0 || Number(fullRegression.testsFailed ?? 0) !== 0) {
    fail('Full regression evidence has no measured PASS result.');
  }
  assertVitestOutputBinding(fullRegression, 'Full regression evidence');
  validateFullEvidenceCommandResults({ receipt: fullRegression, registry: dependencyRegistry, changedFiles: actualFiles });
  assertReleaseEvidenceIdentity(sourceIntegrity, provenance, canonicalRulesSha256, 'Source integrity evidence');
  assertProducer(sourceIntegrity, 'sourceIntegrity', 'Source integrity evidence');
  if (sourceIntegrity.schemaVersion !== 2 || sourceIntegrity.id !== 'PPT-MUTATION-SOURCE-INTEGRITY-V2'
    || sourceIntegrity.evidenceKind !== 'SOURCE_INTEGRITY' || sourceIntegrity.exitCode !== 0
    || sourceIntegrity.requirement !== 'PR-235' || sourceIntegrity.decision !== 'DEC-270'
    || sourceIntegrity.strengthenedByRequirement !== 'PR-240' || sourceIntegrity.strengthenedByDecision !== 'DEC-275'
    || JSON.stringify(sourceIntegrity.commandArguments) !== JSON.stringify([
      '--release-evidence', '--report', 'artifacts/validation/mutation-source-integrity.json'
    ])
    || sourceIntegrity.chain?.fullRegressionSha256 !== evidenceHashes?.fullRegression
    || sourceIntegrity.chain?.targetedTestSha256 !== evidenceHashes?.targetedTest
    || sourceIntegrity.chain?.impactAnalysisSha256 !== evidenceHashes?.impactAnalysis
    || sourceIntegrity.manifestBindings?.manifest?.sha256 !== manifestBindings?.manifest?.sha256
    || sourceIntegrity.manifestBindings?.sha256Sums?.sha256 !== manifestBindings?.sha256Sums?.sha256
    || !Array.isArray(sourceIntegrity.failures) || sourceIntegrity.failures.length !== 0
    || Number(sourceIntegrity.manifestFileCount) < 1
    || Number(sourceIntegrity.actualSourceFileCount) !== Number(sourceIntegrity.manifestFileCount)) {
    fail('Source integrity evidence is incomplete.');
  }
  return Object.freeze({
    status: 'PASS', requirement: 'PR-235', decision: 'DEC-270',
    strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275',
    baselineCommit: mutationBaseline.sourceProvenance.headCommit,
    baselineReceiptSha256: mutationBaselinePointerSha256,
    baselineExternalReceiptSha256: mutationBaselineExternalSha256,
    sourceCommit: provenance.headCommit,
    governedSourceFingerprintSha256: provenance.governedSourceFingerprint.sha256,
    canonicalRuleRegistrySha256: canonicalRulesSha256,
    changedFileCount: actualFiles.length,
    dependencyClosure: Object.freeze({
      registry: Object.freeze({
        path: dependencyRegistryBinding.path,
        sizeBytes: dependencyRegistryBinding.sizeBytes,
        sha256: dependencyRegistryBinding.sha256
      }),
      universalDependentRecords: Object.freeze([...CANONICAL_UNIVERSAL_DEPENDENT_RECORDS]),
      universalAffectedVitestFiles: Object.freeze([...CANONICAL_UNIVERSAL_AFFECTED_VITEST_FILES]),
      dependentRecords: Object.freeze([...assessed.dependencyPlan.dependentRecords]),
      affectedVitestFiles: Object.freeze([...assessed.dependencyPlan.affectedVitestFiles]),
      dependentRecordBindingsSha256: sha256Bytes(Buffer.from(JSON.stringify(dependencyRecordBindings))),
      affectedTestBindingsSha256: sha256Bytes(Buffer.from(JSON.stringify(affectedTestBindings)))
    }),
    impactAreas: Object.keys(assessed.impactAreas).sort(),
    targetedTestsPassed: Number(targetedTest.testsPassed),
    fullRegressionTestsPassed: Number(fullRegression.testsPassed),
    sourceIntegrityFiles: Number(sourceIntegrity.manifestFileCount)
  });
};

export const verifyLocalSourceProtectionArtifacts = async ({
  aymRoot,
  protection,
  expectedProvenance,
  expectedChannel = 'Bronze'
}) => {
  if (!new Set(['Bronze', 'Silver', 'Gold']).has(expectedChannel)) fail('Unsupported source-protection channel.');
  if (protection?.schemaVersion !== 2
    || protection.localReceiptStatus !== 'LOCAL_RECEIPT_VERIFIED'
    || protection.backup?.scope !== 'TRACKED_FILES_AT_EXACT_COMMIT') {
    fail('Local source protection is not a verified tracked-only exact-commit receipt.');
  }
  assertMatchingReleaseSourceProvenance(protection.sourceProvenance, expectedProvenance, 'local source protection');
  const receiptFile = await resolveEvidenceFile({
    aymRoot,
    relativePath: protection.receipt?.path,
    expectedPrefix: `05_TEST/30Z_LOCAL_RECEIPT/${expectedChannel}/`,
    label: 'Local source receipt'
  });
  const backupFile = await resolveEvidenceFile({
    aymRoot,
    relativePath: protection.backup?.path,
    expectedPrefix: `10_YEDEK/${expectedChannel}/`,
    label: 'Local exact-commit backup'
  });
  if (receiptFile.sha256 !== protection.receipt?.sha256) fail('Local source receipt SHA-256 readback mismatch.');
  if (backupFile.sha256 !== protection.backup?.sha256
    || backupFile.sizeBytes !== Number(protection.backup?.bytes)) {
    fail('Local exact-commit backup size/SHA-256 readback mismatch.');
  }
  let receipt;
  try { receipt = JSON.parse(await readFile(receiptFile.fullPath, 'utf8')); }
  catch { fail('Local source receipt is not valid JSON.'); }
  if (receipt?.schemaVersion !== 2
    || receipt.localReceiptStatus !== 'LOCAL_RECEIPT_VERIFIED'
    || receipt.backupScope !== 'TRACKED_FILES_AT_EXACT_COMMIT'
    || receipt.treeSha256 !== protection.treeSha256
    || receipt.fileCount !== protection.fileCount
    || receipt.totalBytes !== protection.totalBytes) {
    fail('Local source receipt identity/readback is incomplete.');
  }
  assertMatchingReleaseSourceProvenance(receipt.sourceProvenance, expectedProvenance, 'local source receipt');
  if (protection.backup.headCommit !== expectedProvenance.headCommit
    || protection.backup.headTree !== expectedProvenance.headTree
    || protection.backup.trackedCommitFingerprint?.sha256 !== expectedProvenance.trackedCommitFingerprint?.sha256) {
    fail('Local exact-commit backup provenance binding mismatch.');
  }
  return Object.freeze({
    status: 'PASS',
    verification: 'ACTUAL_LOCAL_RECEIPT_AND_BACKUP_SIZE_SHA256_READBACK',
    receipt: { path: protection.receipt.path, sizeBytes: receiptFile.sizeBytes, sha256: receiptFile.sha256 },
    backup: { path: protection.backup.path, sizeBytes: backupFile.sizeBytes, sha256: backupFile.sha256 }
  });
};
