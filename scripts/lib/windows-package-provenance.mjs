import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { link, lstat, mkdir, open, readFile, readdir, realpath, rename, rm, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, parse, relative, resolve } from 'node:path';
import {
  assertMatchingReleaseSourceProvenance,
  captureHistoricalReleaseSourceProvenance,
  captureReleaseSourceProvenance,
  listChangedPathsForImpactAnalysis,
  validateMutationReleaseEvidence
} from './release-source-provenance.mjs';
import {
  loadMutationEvidencePolicy,
  readEvidenceBinding,
  readExternalBaselineFromPointer,
  readRepoFileBinding,
  sha256Bytes,
  snapshotMutationEvidenceAndToolchain,
  validateImpactAssessment
} from './mutation-release-evidence.mjs';

export const WINDOWS_PACKAGE_PROVENANCE_ID = 'PPT-WINDOWS-PACKAGE-PROVENANCE-V2';
export const WINDOWS_PACKAGE_PROVENANCE_SCHEMA_VERSION = 2;
export const WINDOWS_PACKAGE_PROVENANCE_PATH = 'artifacts/validation/windows-package-provenance.json';
export const WINDOWS_PACKAGE_HISTORY_BUNDLE_ID = 'PPT-WINDOWS-PACKAGE-PROVENANCE-HISTORY-BUNDLE-V1';
export const WINDOWS_PACKAGE_HISTORY_BUNDLE_FILE = 'bundle.json';
export const GOVERNED_PREFLIGHT_PATH = 'artifacts/validation/governed-preflight.json';
export const WINDOWS_PACKAGE_PROVENANCE_CHAIN_ID = 'PPT-WINDOWS-PACKAGE-PROVENANCE-CHAIN-RECORD-V1';
export const WINDOWS_PACKAGE_PROVENANCE_CHAIN_ROOT = 'D:\\AYM_LIBRARY\\ParsYuva\\ParsYuva Aile Yasam Merkezi\\governance\\PR-239\\Bronze\\package-provenance-chain';

const releaseHistoryRoot = 'artifacts/validation/release-history';
const lockRelativePath = `${releaseHistoryRoot}/.windows-package-provenance.lock`;
const shaPattern = /^[a-f0-9]{64}$/u;
const gitObjectPattern = /^[a-f0-9]{40,64}$/u;
const expectedEvidenceIds = Object.freeze([
  'baseline', 'baselineExternal', 'fullRegression', 'impactAnalysis',
  'impactAssessment', 'sourceIntegrity', 'targetedTest'
]);
const fail = (message) => { throw new Error(message); };
const check = (condition, message) => { if (!condition) fail(message); };
const portable = (value) => value.replaceAll('\\', '/');
const normalize = (value) => resolve(value).replaceAll('/', '\\').toLowerCase();
const strictDescendant = (candidate, parent) => {
  const child = normalize(candidate);
  const base = normalize(parent).replace(/[\\/]+$/u, '');
  return child.startsWith(`${base}\\`);
};
const exactKeys = (value, expected, label) => {
  check(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object.`);
  check(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort()), `${label} inventory is not exact.`);
};

const assertNoReparseAncestors = async (targetPath, boundaryPath, { allowMissingTarget = false } = {}) => {
  const target = resolve(targetPath);
  const boundary = resolve(boundaryPath);
  check(normalize(target) === normalize(boundary) || strictDescendant(target, boundary), 'Evidence path escapes its canonical boundary.');
  const segments = relative(boundary, target).split(/[\\/]/u).filter(Boolean);
  let cursor = boundary;
  for (const segment of ['', ...segments]) {
    if (segment) cursor = resolve(cursor, segment);
    let item;
    try { item = await lstat(cursor); }
    catch (error) {
      if (allowMissingTarget && error?.code === 'ENOENT') return;
      throw error;
    }
    check(!item.isSymbolicLink(), `Evidence path contains a symlink/reparse ancestor: ${cursor}`);
    check(normalize(await realpath(cursor)) === normalize(cursor), `Evidence path ancestor realpath drifted: ${cursor}`);
  }
  if (!allowMissingTarget || existsSync(target)) {
    check(normalize(await realpath(target)) === normalize(target), `Evidence realpath changed the canonical target: ${target}`);
  }
};

const readRegularFile = async (path, label, boundary) => {
  const fullPath = resolve(path);
  await assertNoReparseAncestors(fullPath, boundary ?? parse(fullPath).root);
  const item = await lstat(fullPath);
  check(item.isFile() && !item.isSymbolicLink(), `${label} must be a regular non-link file.`);
  const bytes = await readFile(fullPath);
  return Object.freeze({ fullPath, bytes, sizeBytes: bytes.length, sha256: sha256Bytes(bytes) });
};

const parseJson = (bytes, label) => {
  try { return JSON.parse(bytes.toString('utf8')); }
  catch { fail(`${label} is not valid JSON.`); }
};

const readCanonicalJson = async (root, relativePath, label) => {
  check(typeof relativePath === 'string' && !isAbsolute(relativePath) && portable(relativePath) === relativePath,
    `${label} path must be portable and repository-relative.`);
  const fullPath = resolve(root, relativePath);
  const binding = await readRegularFile(fullPath, label, resolve(root, 'artifacts/validation'));
  return Object.freeze({ path: relativePath, ...binding, value: parseJson(binding.bytes, label) });
};

const sameBinding = (actual, expected) => actual?.path === expected.path
  && Number(actual?.sizeBytes) === expected.sizeBytes && actual?.sha256 === expected.sha256;
const bindingWithoutBytes = (binding) => ({ path: binding.path, sizeBytes: binding.sizeBytes, sha256: binding.sha256 });

const releaseIdentity = (release) => {
  const match = /^Bronze (\d{2})\.(\d{2})\.(\d{4})\.(\d+)$/u.exec(String(release ?? ''));
  check(match, 'Windows package release identity is invalid.');
  const [, day, month, year, sequenceText] = match;
  const sequence = Number(sequenceText);
  check(Number.isSafeInteger(sequence) && sequence > 0, 'Windows package release sequence is invalid.');
  return Object.freeze({
    channel: 'Bronze',
    version: `${day}.${month}.${year}.${sequence}`,
    packageVersion: `${Number(day)}.${Number(month)}.${year}-${sequence}`,
    releaseId: `bronze-${year}-${month}-${day}-r${sequence}`,
    day, month, year, sequence
  });
};

export const windowsPackageHistoryBundleRelativePath = (release) => {
  const identity = releaseIdentity(release);
  return `${releaseHistoryRoot}/bronze-${identity.version}-windows-package-provenance-bundle/${WINDOWS_PACKAGE_HISTORY_BUNDLE_FILE}`;
};

const chainRecordFileName = (identity) => `${String(identity.sequence).padStart(4, '0')}-${identity.releaseId}.json`;
const canonicalDigest = (value) => sha256Bytes(Buffer.from(`${JSON.stringify(value)}\n`, 'utf8'));
const invokeFaultInjection = async (faultInjection, point) => {
  if (typeof faultInjection === 'function') await faultInjection(point);
};

const bundleDirectorySnapshot = async (bundleDirectory) => {
  await assertNoReparseAncestors(bundleDirectory, resolve(bundleDirectory, '..'));
  const rootEntries = await readdir(bundleDirectory, { withFileTypes: true });
  check(JSON.stringify(rootEntries.map(({ name }) => name).sort())
    === JSON.stringify([WINDOWS_PACKAGE_HISTORY_BUNDLE_FILE, 'pr235', 'windows-package-provenance.json'].sort()),
  'Immutable package bundle file inventory is not exact.');
  check(rootEntries.every((entry) => entry.name === 'pr235' ? entry.isDirectory() : entry.isFile()),
    'Immutable package bundle contains a non-regular entry.');
  const evidenceEntries = await readdir(resolve(bundleDirectory, 'pr235'), { withFileTypes: true });
  check(evidenceEntries.every((entry) => entry.isFile())
    && JSON.stringify(evidenceEntries.map(({ name }) => name).sort())
      === JSON.stringify(expectedEvidenceIds.map((id) => `${id}.json`).sort()),
  'Immutable PR-235 archive inventory is not exact.');
  const paths = [WINDOWS_PACKAGE_HISTORY_BUNDLE_FILE, 'windows-package-provenance.json',
    ...expectedEvidenceIds.map((id) => `pr235/${id}.json`)].sort();
  const files = await Promise.all(paths.map(async (path) => {
    const binding = await readRegularFile(resolve(bundleDirectory, path), `Immutable bundle ${path}`, bundleDirectory);
    return Object.freeze({ path, sizeBytes: binding.sizeBytes, sha256: binding.sha256 });
  }));
  return Object.freeze({ files: Object.freeze(files), fileCount: files.length,
    totalBytes: files.reduce((sum, item) => sum + item.sizeBytes, 0), digestSha256: canonicalDigest(files) });
};

const readPackageProvenanceChain = async ({ externalChainRoot = WINDOWS_PACKAGE_PROVENANCE_CHAIN_ROOT }) => {
  const root = resolve(externalChainRoot);
  await assertNoReparseAncestors(root, parse(root).root);
  const entries = await readdir(root, { withFileTypes: true });
  check(entries.every((entry) => entry.isFile() && /^\d{4}-bronze-\d{4}-\d{2}-\d{2}-r\d+\.json$/u.test(entry.name)),
    'External package provenance chain inventory contains an invalid entry.');
  const records = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const binding = await readRegularFile(resolve(root, entry.name), 'External package provenance chain record', root);
    const record = parseJson(binding.bytes, 'External package provenance chain record');
    const identity = releaseIdentity(record.release);
    check(record?.schemaVersion === 1 && record.id === WINDOWS_PACKAGE_PROVENANCE_CHAIN_ID && record.status === 'PASS'
      && record.trustBoundary === 'EXTERNAL_APPEND_ONLY_LOCAL_EVIDENCE_NOT_PRODUCTION_SIGNATURE'
      && record.channel === 'Bronze' && record.sequence === identity.sequence && record.releaseId === identity.releaseId
      && entry.name === chainRecordFileName(identity) && record.sourceCommit && gitObjectPattern.test(record.sourceCommit)
      && Number.isFinite(Date.parse(record.generatedAt)) && Date.parse(record.generatedAt) <= Date.now(),
    'External package provenance chain record identity is invalid, forged, or future-dated.');
    check(record.bundle?.path === windowsPackageHistoryBundleRelativePath(record.release)
      && shaPattern.test(String(record.bundle?.directoryDigestSha256 ?? ''))
      && shaPattern.test(String(record.bundle?.manifestSha256 ?? ''))
      && Number(record.bundle?.fileCount) === 9 && Number(record.bundle?.totalBytes) > 0,
    'External package provenance chain bundle binding is invalid.');
    check(record.producer?.path === 'apps/desktop/scripts/run-electron-builder.mjs'
      && Number(record.producer?.sizeBytes) > 0 && shaPattern.test(String(record.producer?.sha256 ?? ''))
      && shaPattern.test(String(record.pr235EvidenceDigestSha256 ?? '')),
    'External package provenance chain producer/PR-235 binding is invalid.');
    const previous = records.at(-1);
    if (!previous) {
      check(identity.sequence === 50 && record.chainMode === 'BOOTSTRAP' && record.previous === null,
        'External package provenance chain must begin with the single Bronze sequence-50 bootstrap.');
    } else {
      check(identity.sequence === previous.identity.sequence + 1 && record.chainMode === 'CONTINUATION'
        && identity.year === previous.identity.year && identity.month === previous.identity.month
        && record.previous?.releaseId === previous.record.releaseId
        && record.previous?.recordSha256 === previous.binding.sha256
        && record.previous?.bundleDigestSha256 === previous.record.bundle.directoryDigestSha256,
      'External package provenance chain parent hash/sequence is broken.');
    }
    records.push(Object.freeze({ record, identity,
      binding: Object.freeze({ path: resolve(root, entry.name), sizeBytes: binding.sizeBytes, sha256: binding.sha256 }) }));
  }
  return Object.freeze(records);
};

export const verifyExternalWindowsPackageProvenanceAnchor = async ({ root, expectedRelease, bundleDirectory,
  bundle, externalChainRoot = WINDOWS_PACKAGE_PROVENANCE_CHAIN_ROOT }) => {
  const identity = releaseIdentity(expectedRelease);
  const records = await readPackageProvenanceChain({ externalChainRoot });
  const anchored = records.find(({ identity: candidate }) => candidate.sequence === identity.sequence);
  check(anchored, `External package provenance anchor is missing for ${identity.releaseId}.`);
  const snapshot = await bundleDirectorySnapshot(bundleDirectory);
  const manifestBinding = await readRegularFile(resolve(bundleDirectory, WINDOWS_PACKAGE_HISTORY_BUNDLE_FILE),
    'Immutable package bundle manifest', bundleDirectory);
  check(anchored.record.release === expectedRelease && anchored.record.sourceCommit === bundle.sourceCommit
    && anchored.record.bundle.path === windowsPackageHistoryBundleRelativePath(expectedRelease)
    && anchored.record.bundle.directoryDigestSha256 === snapshot.digestSha256
    && anchored.record.bundle.manifestSha256 === manifestBinding.sha256
    && anchored.record.bundle.fileCount === snapshot.fileCount && anchored.record.bundle.totalBytes === snapshot.totalBytes
    && JSON.stringify(anchored.record.producer) === JSON.stringify(bundle.producer)
    && anchored.record.pr235EvidenceDigestSha256 === canonicalDigest(bundle.pr235EvidenceBindings),
  'External package provenance anchor differs from the immutable bundle/source/producer/PR-235 bindings.');
  return Object.freeze({ ...anchored, snapshot });
};

const publishExternalAnchorAtomically = async ({ path, bytes, chainRoot, faultInjection }) => {
  const stagingRoot = resolve(dirname(chainRoot), '.package-provenance-chain-staging');
  await assertNoReparseAncestors(stagingRoot, parse(stagingRoot).root, { allowMissingTarget: true });
  await mkdir(stagingRoot, { recursive: true });
  await assertNoReparseAncestors(stagingRoot, parse(stagingRoot).root);
  const temporary = resolve(stagingRoot, `.anchor-${process.pid}-${randomUUID()}.tmp`);
  let preserveStagingForSimulatedHardKill = false;
  try {
    await writeExclusiveFile(temporary, bytes);
    try { await invokeFaultInjection(faultInjection, 'AFTER_EXTERNAL_ANCHOR_STAGE_FSYNC'); }
    catch (error) {
      preserveStagingForSimulatedHardKill = error?.code === 'PPT_SIMULATED_HARD_KILL';
      throw error;
    }
    await link(temporary, path);
    const readback = await readRegularFile(path, 'External package provenance anchor atomic publish readback', chainRoot);
    check(readback.sizeBytes === bytes.length && readback.sha256 === sha256Bytes(bytes),
      'External package provenance anchor atomic publish readback failed.');
    return readback;
  } finally {
    if (!preserveStagingForSimulatedHardKill) await unlink(temporary).catch(() => undefined);
  }
};

const appendExternalWindowsPackageProvenanceAnchor = async ({ root, receipt, bundleDirectory, bundle,
  externalChainRoot = WINDOWS_PACKAGE_PROVENANCE_CHAIN_ROOT, faultInjection }) => {
  const chainRoot = resolve(externalChainRoot);
  await assertNoReparseAncestors(chainRoot, parse(chainRoot).root, { allowMissingTarget: true });
  await mkdir(chainRoot, { recursive: true });
  await assertNoReparseAncestors(chainRoot, parse(chainRoot).root);
  const identity = releaseIdentity(receipt.release);
  const records = await readPackageProvenanceChain({ externalChainRoot: chainRoot });
  check(!records.some(({ identity: candidate }) => candidate.sequence === identity.sequence),
    `External package provenance anchor already exists: ${identity.releaseId}`);
  const previous = records.at(-1);
  if (identity.sequence === 50) check(!previous, 'Bronze sequence 50 bootstrap must be the first and only bootstrap record.');
  else check(previous?.identity.sequence === identity.sequence - 1, 'External package provenance chain exact parent is missing.');
  const snapshot = await bundleDirectorySnapshot(bundleDirectory);
  const manifestBinding = await readRegularFile(resolve(bundleDirectory, WINDOWS_PACKAGE_HISTORY_BUNDLE_FILE),
    'Immutable package bundle manifest', bundleDirectory);
  const record = {
    schemaVersion: 1, id: WINDOWS_PACKAGE_PROVENANCE_CHAIN_ID, status: 'PASS',
    trustBoundary: 'EXTERNAL_APPEND_ONLY_LOCAL_EVIDENCE_NOT_PRODUCTION_SIGNATURE',
    chainMode: previous ? 'CONTINUATION' : 'BOOTSTRAP', channel: 'Bronze', sequence: identity.sequence,
    release: receipt.release, releaseId: receipt.releaseId, sourceCommit: receipt.sourceProvenance.headCommit,
    bundle: { path: windowsPackageHistoryBundleRelativePath(receipt.release), directoryDigestSha256: snapshot.digestSha256,
      manifestSha256: manifestBinding.sha256, fileCount: snapshot.fileCount, totalBytes: snapshot.totalBytes },
    producer: receipt.producer, pr235EvidenceDigestSha256: canonicalDigest(bundle.pr235EvidenceBindings),
    previous: previous ? { releaseId: previous.record.releaseId, recordSha256: previous.binding.sha256,
      bundleDigestSha256: previous.record.bundle.directoryDigestSha256 } : null,
    generatedAt: new Date().toISOString()
  };
  const bytes = Buffer.from(`${JSON.stringify(record, null, 2)}\n`, 'utf8');
  const path = resolve(chainRoot, chainRecordFileName(identity));
  await publishExternalAnchorAtomically({ path, bytes, chainRoot, faultInjection });
  return verifyExternalWindowsPackageProvenanceAnchor({ root, expectedRelease: receipt.release,
    bundleDirectory, bundle, externalChainRoot: chainRoot });
};

const gitBlobBinding = (runGit, commit, path, label) => {
  check(gitObjectPattern.test(String(commit ?? '')), `${label} commit is invalid.`);
  check(typeof path === 'string' && portable(path) === path && !isAbsolute(path)
    && !path.split('/').some((segment) => !segment || segment === '.' || segment === '..'), `${label} path is unsafe.`);
  let treeLine;
  try { treeLine = Buffer.from(runGit(['ls-tree', commit, '--', path])).toString('utf8').trim(); }
  catch { fail(`${label} is missing from the source commit.`); }
  const match = /^(100644|100755) blob ([a-f0-9]{40,64})\t(.+)$/u.exec(treeLine);
  check(match?.[3] === path, `${label} is not an exact regular Git blob.`);
  let bytes;
  try { bytes = Buffer.from(runGit(['show', `${commit}:${path}`])); }
  catch { fail(`${label} could not be read from the source commit.`); }
  return Object.freeze({ path, sizeBytes: bytes.length, sha256: sha256Bytes(bytes), bytes });
};

const readArchivedEvidence = async (bundleDirectory, manifest, receipt) => {
  exactKeys(manifest.pr235EvidenceBindings, expectedEvidenceIds, 'Archived PR-235 evidence');
  exactKeys(receipt.pr235EvidenceBindings, expectedEvidenceIds, 'Package PR-235 evidence');
  const entries = await Promise.all(expectedEvidenceIds.map(async (id) => {
    const archived = manifest.pr235EvidenceBindings[id];
    const claimed = receipt.pr235EvidenceBindings[id];
    check(archived?.sourcePath === claimed?.path && Number(archived?.sizeBytes) === Number(claimed?.sizeBytes)
      && archived?.sha256 === claimed?.sha256 && shaPattern.test(String(archived?.sha256 ?? '')),
    `Archived PR-235 ${id} source binding differs from the package receipt.`);
    check(typeof archived.archivePath === 'string' && archived.archivePath === `pr235/${id}.json`,
      `Archived PR-235 ${id} path is not canonical.`);
    const binding = await readRegularFile(resolve(bundleDirectory, archived.archivePath), `Archived PR-235 ${id}`, bundleDirectory);
    check(binding.sizeBytes === archived.sizeBytes && binding.sha256 === archived.sha256,
      `Archived PR-235 ${id} readback mismatch.`);
    return [id, Object.freeze({ ...bindingWithoutBytes({ ...binding, path: archived.archivePath }), value: parseJson(binding.bytes, `Archived PR-235 ${id}`) })];
  }));
  return Object.freeze(Object.fromEntries(entries));
};

const validateArchivedPr235 = ({ runGit, receipt, evidence, historicalProvenance }) => {
  const commit = historicalProvenance.headCommit;
  const policyBinding = gitBlobBinding(runGit, commit, 'config/mutation-release-readiness-policy.json', 'Historical PR-235 policy');
  const dependencyRegistryFile = gitBlobBinding(runGit, commit, 'config/change-impact-dependency-registry.json', 'Historical change-impact dependency registry');
  const registryBinding = gitBlobBinding(runGit, commit, 'config/canonical-rule-registry.json', 'Historical canonical-rule registry');
  const policy = parseJson(policyBinding.bytes, 'Historical PR-235 policy');
  const dependencyRegistry = parseJson(dependencyRegistryFile.bytes, 'Historical change-impact dependency registry');
  const dependencyRegistryBinding = Object.freeze({ ...bindingWithoutBytes(dependencyRegistryFile), value: dependencyRegistry });
  check(policy.dependencyRegistry?.sha256 === dependencyRegistryBinding.sha256,
    'Historical PR-235 dependency registry hash differs from its policy binding.');
  const registry = parseJson(registryBinding.bytes, 'Historical canonical-rule registry');
  const producerBindings = Object.freeze(Object.fromEntries(Object.entries(policy.canonicalProducers ?? {}).map(([id, path]) => {
    const binding = gitBlobBinding(runGit, commit, path, `Historical ${id} producer`);
    return [id, bindingWithoutBytes(binding)];
  })));
  const baseline = evidence.baseline.value;
  const baselineExternal = evidence.baselineExternal.value;
  const assessment = evidence.impactAssessment.value;
  const changedFiles = listChangedPathsForImpactAnalysis({ runGit, baselineReceipt: baselineExternal,
    baselinePointer: baseline,
    headCommit: commit, currentProvenance: historicalProvenance });
  const assessed = validateImpactAssessment({ policy, assessment, changedFiles, dependencyRegistry, dependencyRegistryBinding });
  const impactEvidencePaths = [...new Set(Object.values(assessed.impactAreas).flatMap((area) => area.evidencePaths ?? []))].sort();
  const impactEvidenceBindings = Object.fromEntries(impactEvidencePaths.map((path) => {
    const binding = gitBlobBinding(runGit, commit, path, `Historical impact evidence ${path}`);
    return [path, bindingWithoutBytes(binding)];
  }));
  const dependencyRecordBindings = Object.fromEntries(assessed.dependencyPlan.dependentRecords.map((path) => {
    const binding = gitBlobBinding(runGit, commit, path, `Historical dependent record ${path}`);
    return [path, bindingWithoutBytes(binding)];
  }));
  const affectedTestBindings = Object.fromEntries(assessed.dependencyPlan.affectedVitestFiles.map((path) => {
    const binding = gitBlobBinding(runGit, commit, path, `Historical affected test ${path}`);
    return [path, bindingWithoutBytes(binding)];
  }));
  const manifest = gitBlobBinding(runGit, commit, 'manifest.json', 'Historical package manifest');
  const sha256Sums = gitBlobBinding(runGit, commit, 'SHA256SUMS.txt', 'Historical package SHA256SUMS');
  const toolchainBindings = evidence.targetedTest.value?.executionGuard?.toolchainBindings;
  check(Array.isArray(toolchainBindings) && toolchainBindings.length > 0
    && JSON.stringify(toolchainBindings) === JSON.stringify(evidence.fullRegression.value?.executionGuard?.toolchainBindings),
  'Archived PR-235 toolchain bindings are missing or inconsistent.');
  const lockfile = toolchainBindings.find((binding) => binding.path === 'package-lock.json');
  check(sameBinding(lockfile, bindingWithoutBytes(gitBlobBinding(runGit, commit, 'package-lock.json', 'Historical package lock'))),
    'Archived PR-235 package-lock binding differs from the source commit.');
  const readiness = validateMutationReleaseEvidence({
    policy, canonicalRulesSha256: registry.rulesSha256, provenance: historicalProvenance, changedFiles,
    mutationBaselinePointer: baseline, mutationBaselinePointerSha256: evidence.baseline.sha256,
    mutationBaseline: baselineExternal, mutationBaselineExternalSha256: evidence.baselineExternal.sha256,
    impactAssessment: assessment, impactAssessmentSha256: evidence.impactAssessment.sha256,
    impactAnalysis: evidence.impactAnalysis.value, targetedTest: evidence.targetedTest.value,
    fullRegression: evidence.fullRegression.value, sourceIntegrity: evidence.sourceIntegrity.value,
    evidenceHashes: { impactAnalysis: evidence.impactAnalysis.sha256, targetedTest: evidence.targetedTest.sha256,
      fullRegression: evidence.fullRegression.sha256 },
    producerBindings,
    manifestBindings: { manifest: bindingWithoutBytes(manifest), sha256Sums: bindingWithoutBytes(sha256Sums) },
    impactEvidenceBindings, toolchainBindings,
    dependencyRegistry, dependencyRegistryBinding, dependencyRecordBindings, affectedTestBindings
  });
  check(JSON.stringify(receipt.mutationReleaseReadiness) === JSON.stringify({ ...readiness, evidenceBindings: receipt.pr235EvidenceBindings }),
    'Archived package provenance PR-235 readiness summary is forged or stale.');
  return readiness;
};

export const validateWindowsPackageProvenanceEnvelope = ({ receipt, expectedReleaseId }) => {
  check(receipt?.schemaVersion === WINDOWS_PACKAGE_PROVENANCE_SCHEMA_VERSION
    && receipt.id === WINDOWS_PACKAGE_PROVENANCE_ID && receipt.evidenceKind === 'WINDOWS_PACKAGE_PROVENANCE'
    && receipt.status === 'PASS', 'Windows package provenance schema-2 envelope is invalid.');
  check(receipt.releaseId === expectedReleaseId, 'Windows package provenance releaseId mismatch.');
  check(['LOCAL_UNSIGNED_NSIS', 'SIGNED_NSIS'].includes(receipt.buildMode), 'Windows package provenance buildMode is invalid.');
  const identity = releaseIdentity(receipt.release);
  check(receipt.channel === identity.channel && receipt.version === identity.version
    && receipt.packageVersion === identity.packageVersion && receipt.releaseId === identity.releaseId,
  'Windows package provenance channel/version identity is not exact.');
  const parent = releaseIdentity(receipt.parentRelease);
  check(parent.sequence === identity.sequence - 1 && parent.year === identity.year && parent.month === identity.month,
    'Windows package provenance parent release is not the exact monthly predecessor.');
  if (identity.sequence === 50) check(receipt.previousPackageProvenance === null,
    'Bronze sequence 50 is the governed bootstrap and cannot carry a previous package self-claim.');
  else check(receipt.previousPackageProvenance?.release === receipt.parentRelease
    && receipt.previousPackageProvenance?.releaseId === parent.releaseId
    && typeof receipt.previousPackageProvenance?.path === 'string' && isAbsolute(receipt.previousPackageProvenance.path)
    && shaPattern.test(String(receipt.previousPackageProvenance?.sha256 ?? '')),
  'Windows package provenance exact parent bundle binding is missing or invalid.');
  check(Number.isFinite(Date.parse(receipt.generatedAt)) && Date.parse(receipt.generatedAt) <= Date.now(),
    'Windows package provenance timestamp is invalid or future-dated.');
  check(receipt.producer?.path === 'apps/desktop/scripts/run-electron-builder.mjs'
    && Number(receipt.producer?.sizeBytes) > 0 && shaPattern.test(String(receipt.producer?.sha256 ?? '')),
  'Windows package provenance producer identity is invalid.');
  check(receipt.sourceProvenance?.channel === 'Bronze' && receipt.sourceProvenance?.branch === 'channel/bronze'
    && receipt.sourceProvenance?.worktreeClean === true && receipt.sourceProvenance?.sharedGitObjectDatabaseVerified === true,
  'Windows package provenance is not bound to a clean Bronze release worktree.');
  return receipt;
};

export const verifyWindowsPackageHistoryBundle = async ({ root, bundlePath, expectedRelease, expectedReleaseId,
  currentProvenance, runGit, requireEarlierCommit = false,
  externalChainRoot = WINDOWS_PACKAGE_PROVENANCE_CHAIN_ROOT }) => {
  const canonicalRelativePath = windowsPackageHistoryBundleRelativePath(expectedRelease);
  const canonicalFullPath = resolve(root, canonicalRelativePath);
  check(normalize(bundlePath) === normalize(canonicalFullPath), 'Package provenance history bundle path is not canonical.');
  const bundleBinding = await readRegularFile(canonicalFullPath, 'Package provenance history bundle', resolve(root, releaseHistoryRoot));
  const bundle = parseJson(bundleBinding.bytes, 'Package provenance history bundle');
  const bundleDirectory = dirname(canonicalFullPath);
  const identity = releaseIdentity(expectedRelease);
  check(bundle?.schemaVersion === 1 && bundle.id === WINDOWS_PACKAGE_HISTORY_BUNDLE_ID && bundle.status === 'PASS'
    && bundle.release === expectedRelease && bundle.releaseId === expectedReleaseId && bundle.channel === identity.channel
    && bundle.version === identity.version && bundle.packageVersion === identity.packageVersion,
  'Package provenance history bundle identity is invalid or stale.');
  check(bundle.packageProvenance?.archivePath === 'windows-package-provenance.json', 'Archived package provenance path is not canonical.');
  const packageBinding = await readRegularFile(resolve(bundleDirectory, bundle.packageProvenance.archivePath),
    'Archived Windows package provenance', bundleDirectory);
  check(packageBinding.sizeBytes === Number(bundle.packageProvenance.sizeBytes) && packageBinding.sha256 === bundle.packageProvenance.sha256,
    'Archived Windows package provenance readback mismatch.');
  const receipt = validateWindowsPackageProvenanceEnvelope({ receipt: parseJson(packageBinding.bytes, 'Archived Windows package provenance'), expectedReleaseId });
  check(receipt.release === expectedRelease && receipt.sourceProvenance?.headCommit === bundle.sourceCommit
    && receipt.producer?.path === bundle.producer?.path && receipt.producer?.sizeBytes === bundle.producer?.sizeBytes
    && receipt.producer?.sha256 === bundle.producer?.sha256,
  'History bundle is not bound to its archived package provenance receipt.');
  check(gitObjectPattern.test(String(bundle.sourceCommit ?? '')), 'History bundle source commit is invalid.');
  if (requireEarlierCommit) check(bundle.sourceCommit !== currentProvenance.headCommit,
    'Previous package provenance cannot claim the current source commit.');
  const historicalProvenance = captureHistoricalReleaseSourceProvenance({ runGit, currentProvenance, commit: bundle.sourceCommit });
  assertMatchingReleaseSourceProvenance(historicalProvenance, receipt.sourceProvenance, 'archived package source commit');
  const producer = gitBlobBinding(runGit, bundle.sourceCommit, receipt.producer.path, 'Archived package producer');
  check(sameBinding(receipt.producer, bindingWithoutBytes(producer)),
    'Archived package producer differs from the exact source-commit blob.');
  const evidence = await readArchivedEvidence(bundleDirectory, bundle, receipt);
  const readiness = validateArchivedPr235({ runGit, receipt, evidence, historicalProvenance });
  const externalAnchor = await verifyExternalWindowsPackageProvenanceAnchor({ root, expectedRelease,
    bundleDirectory, bundle, externalChainRoot });
  return Object.freeze({
    bundle,
    bundleBinding: Object.freeze({ path: canonicalRelativePath, fullPath: canonicalFullPath,
      sizeBytes: bundleBinding.sizeBytes, sha256: bundleBinding.sha256 }),
    packageBinding: Object.freeze({ path: bundle.packageProvenance.archivePath, fullPath: packageBinding.fullPath,
      sizeBytes: packageBinding.sizeBytes, sha256: packageBinding.sha256 }),
    receipt, readiness, provenance: historicalProvenance, externalAnchor
  });
};

export const verifyPreviousWindowsPackageProvenance = async ({ root, preallocatedRelease, bundlePath, currentProvenance, runGit,
  externalChainRoot = WINDOWS_PACKAGE_PROVENANCE_CHAIN_ROOT }) => {
  const sequence = Number(preallocatedRelease?.monthlySequence);
  check(Number.isSafeInteger(sequence) && sequence >= 50, 'Package sequence is outside the governed predecessor boundary.');
  if (sequence === 50) {
    check(!bundlePath, 'Bronze sequence 50 is the first governed predecessor and must not accept a previous self-claim.');
    return null;
  }
  check(typeof bundlePath === 'string' && bundlePath.trim() !== '', 'The exact parent package provenance history bundle is required.');
  const parent = releaseIdentity(preallocatedRelease.parentRelease);
  check(parent.sequence === sequence - 1, 'Previous package provenance is not the exact monthly parent sequence.');
  const result = await verifyWindowsPackageHistoryBundle({ root, bundlePath,
    expectedRelease: preallocatedRelease.parentRelease, expectedReleaseId: parent.releaseId,
    currentProvenance, runGit, requireEarlierCommit: true, externalChainRoot });
  const generatedAt = Date.parse(result.receipt.generatedAt);
  check(Number.isFinite(generatedAt) && generatedAt < Date.now(), 'Previous package provenance timestamp is stale or from the future.');
  return Object.freeze({
    path: result.bundleBinding.fullPath, sizeBytes: result.bundleBinding.sizeBytes, sha256: result.bundleBinding.sha256,
    release: result.receipt.release, releaseId: result.receipt.releaseId, channel: result.receipt.channel,
    version: result.receipt.version, packageVersion: result.receipt.packageVersion,
    sourceCommit: result.receipt.sourceProvenance.headCommit, producer: result.receipt.producer,
    packagedRuntime: result.receipt.artifacts?.packagedRuntime,
    externalAnchor: { path: result.externalAnchor.binding.path, sizeBytes: result.externalAnchor.binding.sizeBytes,
      sha256: result.externalAnchor.binding.sha256 }
  });
};

const writeExclusiveFile = async (path, bytes) => {
  let handle;
  try { handle = await open(path, 'wx'); await handle.writeFile(bytes); await handle.sync(); }
  finally { if (handle) await handle.close().catch(() => undefined); }
};

const WINDOWS_PACKAGE_PROVENANCE_LOCK_ID = 'PPT-WINDOWS-PACKAGE-PROVENANCE-LOCK-V1';

const readProcessStartIdentity = async (pid) => {
  check(Number.isSafeInteger(pid) && pid > 0, 'Package provenance lock PID is invalid.');
  if (process.platform === 'win32') {
    const script = [
      "$ErrorActionPreference='Stop'",
      '$targetPid=[int]$env:PPT_PACKAGE_PROVENANCE_LOCK_PID',
      '$targetProcess=Get-CimInstance Win32_Process -Filter ("ProcessId={0}"-f $targetPid) -ErrorAction Stop',
      "if($null-ne$targetProcess){[Console]::Out.Write(('win32-cim-utc-ticks:{0}'-f $targetProcess.CreationDate.ToUniversalTime().Ticks))}",
    ].join(';');
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8', windowsHide: true, env: { ...process.env, PPT_PACKAGE_PROVENANCE_LOCK_PID: String(pid) },
    });
    check(result.status === 0, `Package provenance lock process identity could not be read: ${result.stderr || result.stdout}`);
    return result.stdout.trim() || null;
  }
  if (process.platform === 'linux') {
    let raw;
    try { raw = await readFile(`/proc/${pid}/stat`, 'utf8'); }
    catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
    const closingParenthesis = raw.lastIndexOf(')');
    check(closingParenthesis > 0, 'Package provenance lock /proc identity is malformed.');
    const fieldsAfterCommand = raw.slice(closingParenthesis + 2).trim().split(/\s+/u);
    const startTicks = fieldsAfterCommand[19];
    const bootId = (await readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim();
    check(/^\d+$/u.test(startTicks ?? '') && bootId !== '', 'Package provenance lock /proc start identity is invalid.');
    return `linux-proc:${bootId}:${startTicks}`;
  }
  const result = spawnSync('ps', ['-p', String(pid), '-o', 'lstart='], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout.trim()) return null;
  return `${process.platform}-ps:${result.stdout.trim().replace(/\s+/gu, ' ')}`;
};

const validateHistoryLockRecord = (record) => {
  exactKeys(record, ['schemaVersion', 'id', 'pid', 'processStartIdentity', 'release', 'releaseId', 'bundlePath', 'createdAt'],
    'Package provenance history lock');
  const identity = releaseIdentity(record.release);
  check(record.schemaVersion === 1 && record.id === WINDOWS_PACKAGE_PROVENANCE_LOCK_ID
    && Number.isSafeInteger(record.pid) && record.pid > 0
    && typeof record.processStartIdentity === 'string' && record.processStartIdentity.length > 0
    && record.releaseId === identity.releaseId
    && record.bundlePath === windowsPackageHistoryBundleRelativePath(record.release)
    && Number.isFinite(Date.parse(record.createdAt)) && Date.parse(record.createdAt) <= Date.now(),
  'Package provenance history lock record is malformed or future-dated.');
  return record;
};

const recoverStaleHistoryLock = async ({ lockPath, historyRoot }) => {
  await assertNoReparseAncestors(lockPath, historyRoot);
  const binding = await readRegularFile(lockPath, 'Package provenance history lock', historyRoot);
  const record = validateHistoryLockRecord(parseJson(binding.bytes, 'Package provenance history lock'));
  const liveStartIdentity = await readProcessStartIdentity(record.pid);
  check(liveStartIdentity !== record.processStartIdentity,
    `Package provenance history lock has a live exact owner: pid=${record.pid}.`);
  const quarantinePath = `${lockPath}.stale-${randomUUID()}`;
  await rename(lockPath, quarantinePath);
  const quarantine = await readRegularFile(quarantinePath, 'Quarantined stale package provenance history lock', historyRoot);
  check(quarantine.sizeBytes === binding.sizeBytes && quarantine.sha256 === binding.sha256,
    'Stale package provenance history lock quarantine readback drifted.');
  await unlink(quarantinePath);
  return Object.freeze({ stalePid: record.pid, pidReuseDetected: liveStartIdentity !== null });
};

const acquireHistoryLock = async ({ lockPath, historyRoot, receipt, bundleRelativePath }) => {
  const processStartIdentity = await readProcessStartIdentity(process.pid);
  check(processStartIdentity, 'Current package provenance process start identity could not be read.');
  const record = {
    schemaVersion: 1,
    id: WINDOWS_PACKAGE_PROVENANCE_LOCK_ID,
    pid: process.pid,
    processStartIdentity,
    release: receipt.release,
    releaseId: receipt.releaseId,
    bundlePath: bundleRelativePath,
    createdAt: new Date().toISOString(),
  };
  const bytes = Buffer.from(`${JSON.stringify(record, null, 2)}\n`, 'utf8');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const temporary = `${lockPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeExclusiveFile(temporary, bytes);
      await link(temporary, lockPath);
      const readback = await readRegularFile(lockPath, 'Package provenance history lock publish readback', historyRoot);
      check(readback.sizeBytes === bytes.length && readback.sha256 === sha256Bytes(bytes),
        'Package provenance history lock publish readback failed.');
      return Object.freeze({ path: lockPath, bytes, sha256: readback.sha256, record: Object.freeze(record) });
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      try { await recoverStaleHistoryLock({ lockPath, historyRoot }); }
      catch (recoveryError) {
        if (recoveryError?.code !== 'ENOENT') throw recoveryError;
      }
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }
  fail('Package provenance history lock could not be acquired after stale-lock recovery.');
};

const releaseHistoryLock = async ({ lock, historyRoot }) => {
  const readback = await readRegularFile(lock.path, 'Owned package provenance history lock release readback', historyRoot);
  check(readback.sizeBytes === lock.bytes.length && readback.sha256 === lock.sha256,
    'Package provenance history lock ownership changed before release.');
  await unlink(lock.path);
  check(!existsSync(lock.path), 'Package provenance history lock still exists after release.');
};

const replaceFileAtomically = async (path, bytes) => {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try { await writeExclusiveFile(temporary, bytes); await rename(temporary, path); }
  finally { await unlink(temporary).catch(() => undefined); }
};

export const writeWindowsPackageProvenanceTransaction = async ({ root, receipt,
  externalChainRoot = WINDOWS_PACKAGE_PROVENANCE_CHAIN_ROOT, faultInjection }) => {
  const receiptBytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  const identity = releaseIdentity(receipt.release);
  validateWindowsPackageProvenanceEnvelope({ receipt, expectedReleaseId: receipt.releaseId });
  const bundleRelativePath = windowsPackageHistoryBundleRelativePath(receipt.release);
  const bundlePath = resolve(root, bundleRelativePath);
  const bundleDirectory = dirname(bundlePath);
  const historyRoot = resolve(root, releaseHistoryRoot);
  const validationRoot = resolve(root, 'artifacts/validation');
  const currentPath = resolve(root, WINDOWS_PACKAGE_PROVENANCE_PATH);
  const lockPath = resolve(root, lockRelativePath);
  await assertNoReparseAncestors(historyRoot, resolve(root), { allowMissingTarget: true });
  await mkdir(historyRoot, { recursive: true });
  await assertNoReparseAncestors(historyRoot, resolve(root));
  await assertNoReparseAncestors(currentPath, validationRoot, { allowMissingTarget: true });
  let historyLock;
  let stagingDirectory;
  let bundle;
  let bundleBytes;
  try {
    historyLock = await acquireHistoryLock({ lockPath, historyRoot, receipt, bundleRelativePath });
    stagingDirectory = resolve(historyRoot, `.windows-package-provenance-${process.pid}-${randomUUID()}.tmp`);
    await mkdir(resolve(stagingDirectory, 'pr235'), { recursive: true });
    exactKeys(receipt.pr235EvidenceBindings, expectedEvidenceIds, 'Package PR-235 evidence');
    const archivedBindings = {};
    for (const id of expectedEvidenceIds) {
      const source = receipt.pr235EvidenceBindings[id];
      check(typeof source?.path === 'string' && isAbsolute(source.path), `PR-235 ${id} source path is not absolute.`);
      const sourceBinding = await readRegularFile(source.path, `PR-235 ${id} source`);
      check(sourceBinding.sizeBytes === Number(source.sizeBytes) && sourceBinding.sha256 === source.sha256,
        `PR-235 ${id} source changed before archive transaction.`);
      const archivePath = `pr235/${id}.json`;
      await writeExclusiveFile(resolve(stagingDirectory, archivePath), sourceBinding.bytes);
      archivedBindings[id] = { sourcePath: source.path, archivePath, sizeBytes: sourceBinding.sizeBytes, sha256: sourceBinding.sha256 };
    }
    await writeExclusiveFile(resolve(stagingDirectory, 'windows-package-provenance.json'), receiptBytes);
    bundle = {
      schemaVersion: 1, id: WINDOWS_PACKAGE_HISTORY_BUNDLE_ID, status: 'PASS',
      release: receipt.release, releaseId: receipt.releaseId, channel: identity.channel,
      version: identity.version, packageVersion: identity.packageVersion,
      sourceCommit: receipt.sourceProvenance.headCommit, producer: receipt.producer,
      packageProvenance: { sourcePath: WINDOWS_PACKAGE_PROVENANCE_PATH, archivePath: 'windows-package-provenance.json',
        sizeBytes: receiptBytes.length, sha256: sha256Bytes(receiptBytes) },
      pr235EvidenceBindings: archivedBindings, generatedAt: receipt.generatedAt
    };
    bundleBytes = Buffer.from(`${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
    await writeExclusiveFile(resolve(stagingDirectory, WINDOWS_PACKAGE_HISTORY_BUNDLE_FILE), bundleBytes);
    for (const binding of [
      { path: resolve(stagingDirectory, 'windows-package-provenance.json'), sizeBytes: receiptBytes.length, sha256: sha256Bytes(receiptBytes) },
      ...Object.values(archivedBindings).map((binding) => ({ path: resolve(stagingDirectory, binding.archivePath), ...binding }))
    ]) {
      const readback = await readRegularFile(binding.path, 'Staged package provenance transaction', stagingDirectory);
      check(readback.sizeBytes === binding.sizeBytes && readback.sha256 === binding.sha256,
        'Staged package provenance transaction readback failed.');
    }
    const bundleReadback = await readRegularFile(resolve(stagingDirectory, WINDOWS_PACKAGE_HISTORY_BUNDLE_FILE),
      'Staged package provenance bundle', stagingDirectory);
    check(bundleReadback.sizeBytes === bundleBytes.length && bundleReadback.sha256 === sha256Bytes(bundleBytes),
      'Staged package provenance bundle readback failed.');
    const stagedSnapshot = await bundleDirectorySnapshot(stagingDirectory);
    let externalAnchor;
    if (existsSync(bundleDirectory)) {
      const publishedSnapshot = await bundleDirectorySnapshot(bundleDirectory);
      check(publishedSnapshot.digestSha256 === stagedSnapshot.digestSha256,
        `Immutable package provenance bundle already exists with drift: ${bundleDirectory}`);
      const records = existsSync(resolve(externalChainRoot))
        ? await readPackageProvenanceChain({ externalChainRoot }) : [];
      await rm(stagingDirectory, { recursive: true, force: true });
      stagingDirectory = undefined;
      if (records.some(({ identity: candidate }) => candidate.sequence === identity.sequence)) {
        externalAnchor = await verifyExternalWindowsPackageProvenanceAnchor({ root, expectedRelease: receipt.release,
          bundleDirectory, bundle, externalChainRoot });
        const currentReadback = existsSync(currentPath)
          ? await readRegularFile(currentPath, 'Current package provenance convenience copy', validationRoot) : null;
        check(!currentReadback || currentReadback.sizeBytes !== receiptBytes.length
          || currentReadback.sha256 !== sha256Bytes(receiptBytes),
        `Immutable package provenance bundle, external anchor and current convenience already exist: ${bundleDirectory}`);
      } else {
        externalAnchor = await appendExternalWindowsPackageProvenanceAnchor({ root, receipt, bundleDirectory,
          bundle, externalChainRoot, faultInjection });
      }
    } else {
      await rename(stagingDirectory, bundleDirectory);
      stagingDirectory = undefined;
      await invokeFaultInjection(faultInjection, 'AFTER_BUNDLE_DIRECTORY_PUBLISH');
      externalAnchor = await appendExternalWindowsPackageProvenanceAnchor({ root, receipt, bundleDirectory,
        bundle, externalChainRoot, faultInjection });
    }
    await invokeFaultInjection(faultInjection, 'AFTER_EXTERNAL_ANCHOR_COMMIT');
    await replaceFileAtomically(currentPath, receiptBytes);
    const [currentReadback, archiveReadback] = await Promise.all([
      readRegularFile(currentPath, 'Current package provenance readback', validationRoot),
      readRegularFile(resolve(bundleDirectory, 'windows-package-provenance.json'), 'Archived package provenance readback', bundleDirectory)
    ]);
    check(currentReadback.sha256 === archiveReadback.sha256 && currentReadback.sizeBytes === archiveReadback.sizeBytes,
      'Current and immutable package provenance receipts differ after transaction commit.');
    return Object.freeze({ current: { path: WINDOWS_PACKAGE_PROVENANCE_PATH, sizeBytes: currentReadback.sizeBytes,
      sha256: currentReadback.sha256 }, bundle: { path: bundleRelativePath, sizeBytes: bundleBytes.length,
      sha256: sha256Bytes(bundleBytes) }, externalAnchor: { path: externalAnchor.binding.path,
      sizeBytes: externalAnchor.binding.sizeBytes, sha256: externalAnchor.binding.sha256 } });
  } catch (error) {
    throw error;
  } finally {
    if (stagingDirectory) await rm(stagingDirectory, { recursive: true, force: true }).catch(() => undefined);
    if (historyLock) await releaseHistoryLock({ lock: historyLock, historyRoot });
  }
};

export const verifyWindowsPackageProvenanceLive = async ({ root, expectedReleaseId,
  packageProvenancePath = resolve(root, WINDOWS_PACKAGE_PROVENANCE_PATH),
  governedPreflightPath = resolve(root, GOVERNED_PREFLIGHT_PATH), requireArtifactReadback = true,
  externalChainRoot = WINDOWS_PACKAGE_PROVENANCE_CHAIN_ROOT }) => {
  check(normalize(packageProvenancePath) === normalize(resolve(root, WINDOWS_PACKAGE_PROVENANCE_PATH)), 'Package provenance path is not canonical.');
  check(normalize(governedPreflightPath) === normalize(resolve(root, GOVERNED_PREFLIGHT_PATH)), 'Governed preflight path is not canonical.');
  const currentConveniencePromise = existsSync(resolve(root, WINDOWS_PACKAGE_PROVENANCE_PATH))
    ? readRegularFile(resolve(root, WINDOWS_PACKAGE_PROVENANCE_PATH), 'Non-authoritative current package provenance convenience copy',
      resolve(root, 'artifacts/validation')) : Promise.resolve(null);
  const [currentConvenience, preflightBinding, liveSource, policyBundle, registryRaw, producerBinding, releaseLedger] = await Promise.all([
    currentConveniencePromise,
    readCanonicalJson(root, GOVERNED_PREFLIGHT_PATH, 'Governed preflight'),
    captureReleaseSourceProvenance({ root, expectedChannel: 'Bronze' }),
    loadMutationEvidencePolicy(root),
    readFile(resolve(root, 'config/canonical-rule-registry.json'), 'utf8').then(JSON.parse),
    readRepoFileBinding(root, 'apps/desktop/scripts/run-electron-builder.mjs', 'Windows package provenance producer'),
    readFile(resolve(root, 'config/release-ledger.json'), 'utf8').then(JSON.parse)
  ]);
  const { policy: policyRaw, dependencyRegistry, dependencyRegistryBinding } = policyBundle;
  check(releaseLedger.current?.channel === 'Bronze' && releaseLedger.current?.releaseId === expectedReleaseId
    && releaseLedger.current?.visibleRelease === `Bronze ${releaseLedger.current?.version}`,
  'Current release ledger does not match the expected Bronze package identity.');
  const immutableBundle = await verifyWindowsPackageHistoryBundle({ root,
    bundlePath: resolve(root, windowsPackageHistoryBundleRelativePath(releaseLedger.current.visibleRelease)),
    expectedRelease: releaseLedger.current.visibleRelease, expectedReleaseId,
    currentProvenance: liveSource.provenance, runGit: liveSource.runGit, externalChainRoot });
  const receipt = immutableBundle.receipt;
  if (currentConvenience) check(currentConvenience.sizeBytes === immutableBundle.packageBinding.sizeBytes
    && currentConvenience.sha256 === immutableBundle.packageBinding.sha256,
  'Non-authoritative current package receipt convenience copy differs from the canonical immutable bundle.');
  const packageBinding = Object.freeze({ ...immutableBundle.packageBinding, value: receipt,
    authority: 'IMMUTABLE_RELEASE_BUNDLE_WITH_EXTERNAL_APPEND_ONLY_ANCHOR' });
  check(sameBinding(receipt.producer, producerBinding), 'Windows package provenance producer readback drifted.');
  assertMatchingReleaseSourceProvenance(liveSource.provenance, receipt.sourceProvenance, 'live package provenance source');
  assertMatchingReleaseSourceProvenance(receipt.sourceProvenanceBefore, receipt.sourceProvenanceAfter, 'package source before/after');
  assertMatchingReleaseSourceProvenance(receipt.sourceProvenance, receipt.sourceProvenanceAfter, 'package source final');
  check(preflightBinding.value?.schemaVersion === 1 && preflightBinding.value.status === 'PASS'
    && preflightBinding.value.rulesSha256 === registryRaw.rulesSha256
    && preflightBinding.value.sourceFingerprint?.sha256 === liveSource.provenance.governedSourceFingerprint.sha256,
  'Governed preflight is stale or bound to another source/rule registry.');
  const specs = [['baseline', policyRaw.defaultEvidence.baseline], ['impactAnalysis', policyRaw.defaultEvidence.impactAnalysis],
    ['targetedTest', policyRaw.defaultEvidence.targetedTest], ['fullRegression', policyRaw.defaultEvidence.fullRegression],
    ['sourceIntegrity', policyRaw.defaultEvidence.sourceIntegrity]];
  const evidence = await Promise.all(specs.map(async ([id, path]) => ({ id, ...await readEvidenceBinding(root, path, `${id} evidence`) })));
  const byId = Object.fromEntries(evidence.map((binding) => [binding.id, binding]));
  const [externalBaseline, assessment, manifest, sha256Sums, evidenceSnapshot] = await Promise.all([
    readExternalBaselineFromPointer({ pointer: byId.baseline.value }),
    readEvidenceBinding(root, policyRaw.defaultInput.impactAssessment, 'mutation impact assessment'),
    readRepoFileBinding(root, 'manifest.json', 'package manifest'), readRepoFileBinding(root, 'SHA256SUMS.txt', 'package SHA256SUMS'),
    snapshotMutationEvidenceAndToolchain(root)
  ]);
  const producerBindings = Object.freeze(Object.fromEntries(await Promise.all(Object.entries(policyRaw.canonicalProducers).map(async ([id, path]) => {
    const binding = await readRepoFileBinding(root, path, `${id} producer`); return [id, bindingWithoutBytes(binding)];
  }))));
  const changedFiles = listChangedPathsForImpactAnalysis({ runGit: liveSource.runGit,
    baselineReceipt: externalBaseline.record.value, baselinePointer: byId.baseline.value,
    headCommit: liveSource.provenance.headCommit,
    currentProvenance: liveSource.provenance });
  const assessed = validateImpactAssessment({
    policy: policyRaw, assessment: assessment.value, changedFiles, dependencyRegistry, dependencyRegistryBinding
  });
  const impactEvidencePaths = [...new Set(Object.values(assessed.impactAreas).flatMap((area) => area.evidencePaths ?? []))].sort();
  const impactEvidenceBindings = Object.fromEntries(await Promise.all(impactEvidencePaths.map(async (path) => {
    const binding = await readRepoFileBinding(root, path, `impact evidence ${path}`); return [path, bindingWithoutBytes(binding)];
  })));
  const dependencyRecordBindings = Object.fromEntries(await Promise.all(assessed.dependencyPlan.dependentRecords.map(async (path) => {
    const binding = await readRepoFileBinding(root, path, `dependent record ${path}`); return [path, bindingWithoutBytes(binding)];
  })));
  const affectedTestBindings = Object.fromEntries(await Promise.all(assessed.dependencyPlan.affectedVitestFiles.map(async (path) => {
    const binding = await readRepoFileBinding(root, path, `affected test ${path}`); return [path, bindingWithoutBytes(binding)];
  })));
  const readiness = validateMutationReleaseEvidence({
    policy: policyRaw, canonicalRulesSha256: registryRaw.rulesSha256, provenance: liveSource.provenance, changedFiles,
    mutationBaselinePointer: byId.baseline.value, mutationBaselinePointerSha256: byId.baseline.sha256,
    mutationBaseline: externalBaseline.record.value, mutationBaselineExternalSha256: externalBaseline.record.sha256,
    impactAssessment: assessment.value, impactAssessmentSha256: assessment.sha256,
    impactAnalysis: byId.impactAnalysis.value, targetedTest: byId.targetedTest.value,
    fullRegression: byId.fullRegression.value, sourceIntegrity: byId.sourceIntegrity.value,
    evidenceHashes: { impactAnalysis: byId.impactAnalysis.sha256, targetedTest: byId.targetedTest.sha256,
      fullRegression: byId.fullRegression.sha256 }, producerBindings,
    manifestBindings: { manifest: bindingWithoutBytes(manifest), sha256Sums: bindingWithoutBytes(sha256Sums) },
    impactEvidenceBindings, toolchainBindings: evidenceSnapshot.toolchain,
    dependencyRegistry, dependencyRegistryBinding, dependencyRecordBindings, affectedTestBindings
  });
  check(JSON.stringify(receipt.mutationReleaseReadiness) === JSON.stringify({ ...readiness, evidenceBindings: receipt.pr235EvidenceBindings }),
    'Package provenance PR-235 readiness summary or evidence bindings are forged/stale.');
  const expectedEvidenceBindings = {
    ...Object.fromEntries(evidence.map((binding) => [binding.id, { path: binding.fullPath, sizeBytes: binding.sizeBytes, sha256: binding.sha256 }])),
    baselineExternal: { path: externalBaseline.record.fullPath, sizeBytes: externalBaseline.record.sizeBytes,
      sha256: externalBaseline.record.sha256, chainTipSha256: externalBaseline.chain.tipSha256 },
    impactAssessment: { path: assessment.fullPath, sizeBytes: assessment.sizeBytes, sha256: assessment.sha256 }
  };
  check(JSON.stringify(receipt.pr235EvidenceBindings) === JSON.stringify(expectedEvidenceBindings),
    'Package provenance PR-235 live readback bindings differ.');
  const identity = releaseIdentity(receipt.release);
  if (identity.sequence === 50) {
    check(receipt.previousPackageProvenance === null,
      'Bronze sequence 50 must be the exact package-provenance bootstrap without a self-claimed parent bundle.');
  } else {
    const previous = await verifyPreviousWindowsPackageProvenance({ root,
      preallocatedRelease: { monthlySequence: identity.sequence, parentRelease: receipt.parentRelease },
      bundlePath: receipt.previousPackageProvenance?.path, currentProvenance: liveSource.provenance,
      runGit: liveSource.runGit, externalChainRoot });
    check(JSON.stringify(receipt.previousPackageProvenance) === JSON.stringify(previous),
      'Current package provenance parent lineage differs from the verified exact parent bundle/anchor.');
  }
  if (requireArtifactReadback) {
    const releaseRoot = resolve(root, 'apps/desktop/release');
    for (const [label, artifact] of Object.entries(receipt.artifacts ?? {})) {
      check(strictDescendant(artifact?.path, releaseRoot), `${label} artifact path escapes the release root.`);
      await assertNoReparseAncestors(artifact.path, releaseRoot);
      const bytes = await readFile(artifact.path);
      check(bytes.length === Number(artifact.sizeBytes) && sha256Bytes(bytes) === artifact.sha256,
        `${label} artifact live readback mismatch.`);
    }
  }
  return Object.freeze({ receipt, packageBinding, currentConvenience, preflightBinding, immutableBundle,
    provenance: liveSource.provenance, readiness });
};
