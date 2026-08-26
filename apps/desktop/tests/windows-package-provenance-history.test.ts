import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  validateWindowsPackageProvenanceEnvelope,
  readWindowsPackageRecoveryBootstrapAuthority,
  verifyExternalWindowsPackageProvenanceAnchor,
  verifyPreviousWindowsPackageProvenance,
  windowsPackageHistoryBundleRelativePath,
  writeWindowsPackageProvenanceTransaction
} from '../../../scripts/lib/windows-package-provenance.mjs';

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const roots: string[] = [];
const evidenceIds = [
  'baseline', 'baselineExternal', 'fullRegression', 'impactAnalysis',
  'impactAssessment', 'sourceIntegrity', 'targetedTest'
] as const;
const recoveryPreviousPackage = (root: string, first: { bundle: { path: string; sizeBytes: number; sha256: string } }, receipt: any,
  recoveryBootstrap: any = {
    decision: 'RECOVERY_BOOTSTRAP_AFTER_REJECTED_50',
    parentStatus: 'REJECTED_INVALID_PACKAGE',
    currentRelease: 'Bronze 26.08.2026.51',
    currentReleaseId: 'bronze-2026-08-26-r51',
    parentRelease: 'Bronze 22.08.2026.50',
    parentReleaseId: 'bronze-2026-08-22-r50',
    currentSequence: 51,
    parentSequence: 50,
    releaseLedger: { path: 'config/release-ledger.json', sizeBytes: 100, sha256: 'e'.repeat(64) }
  }) => ({
  release: receipt.release,
  releaseId: receipt.releaseId,
  path: resolve(root, first.bundle.path),
  sizeBytes: first.bundle.sizeBytes,
  sha256: first.bundle.sha256,
  lineageRole: 'REJECTED_PARENT_HISTORY_ANCHOR_ONLY',
  trustedInstalledPredecessor: false,
  recoveryBootstrap
});
const simulatedHardKill = (expectedPoint: string) => async (point: string) => {
  if (point !== expectedPoint) return;
  throw Object.assign(new Error(`simulated hard kill: ${point}`), { code: 'PPT_SIMULATED_HARD_KILL' });
};

const waitForChildMarker = (child: ReturnType<typeof spawn>, marker: string) => new Promise<void>((resolveMarker, rejectMarker) => {
  let output = '';
  const timeout = setTimeout(() => rejectMarker(new Error(`child marker timeout: ${marker}`)), 15_000);
  child.stdout?.on('data', (chunk) => {
    output += chunk.toString('utf8');
    if (!output.includes(marker)) return;
    clearTimeout(timeout);
    resolveMarker();
  });
  child.once('error', (error) => { clearTimeout(timeout); rejectMarker(error); });
  child.once('exit', (code) => {
    if (output.includes(marker)) return;
    clearTimeout(timeout);
    rejectMarker(new Error(`child exited before marker (${code}): ${output}`));
  });
});

const waitForChildExit = (child: ReturnType<typeof spawn>) => new Promise<void>((resolveExit, rejectExit) => {
  child.once('error', rejectExit);
  child.once('exit', () => resolveExit());
});

const createFixture = async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'parsyuva-package-provenance-'));
  roots.push(root);
  const externalChainRoot = resolve(root, 'external-chain');
  await mkdir(resolve(root, 'artifacts/validation/release-history'), { recursive: true });
  const bindings: Record<string, { path: string; sizeBytes: number; sha256: string }> = {};
  for (const id of evidenceIds) {
    const path = resolve(root, 'evidence', `${id}.json`);
    const bytes = Buffer.from(`${JSON.stringify({ id, status: 'PASS' })}\n`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    bindings[id] = { path, sizeBytes: bytes.length, sha256: sha256(bytes) };
  }
  const provenance = {
    channel: 'Bronze', branch: 'channel/bronze', worktreeClean: true,
    sharedGitObjectDatabaseVerified: true, headCommit: 'a'.repeat(40)
  };
  const receipt = {
    schemaVersion: 2,
    id: 'PPT-WINDOWS-PACKAGE-PROVENANCE-V2',
    evidenceKind: 'WINDOWS_PACKAGE_PROVENANCE',
    status: 'PASS',
    buildMode: 'LOCAL_UNSIGNED_NSIS',
    release: 'Bronze 22.08.2026.50',
    releaseId: 'bronze-2026-08-22-r50',
    channel: 'Bronze',
    version: '22.08.2026.50',
    packageVersion: '22.8.2026-50',
    parentRelease: 'Bronze 22.08.2026.49',
    previousPackageProvenance: null,
    generatedAt: '2026-08-22T12:00:00.000Z',
    producer: { path: 'apps/desktop/scripts/run-electron-builder.mjs', sizeBytes: 123, sha256: 'b'.repeat(64) },
    sourceProvenance: provenance,
    pr235EvidenceBindings: bindings
  };
  const recoveryPreallocatedRelease = {
    visibleRelease: 'Bronze 26.08.2026.51', releaseId: 'bronze-2026-08-26-r51', monthlySequence: 51,
    parentRelease: 'Bronze 22.08.2026.50', recoveryBootstrapDecision: 'RECOVERY_BOOTSTRAP_AFTER_REJECTED_50'
  };
  const ledger = {
    schemaVersion: 1,
    current: { ...recoveryPreallocatedRelease, status: 'IN_PROGRESS' },
    entries: [
      { version: '22.08.2026.50', monthlySequence: 50, releaseId: 'bronze-2026-08-22-r50', status: 'REJECTED_INVALID_PACKAGE' },
      { version: '26.08.2026.51', monthlySequence: 51, releaseId: 'bronze-2026-08-26-r51', status: 'IN_PROGRESS',
        parentRelease: 'Bronze 22.08.2026.50', recoveryBootstrapDecision: 'RECOVERY_BOOTSTRAP_AFTER_REJECTED_50' }
    ]
  };
  await mkdir(resolve(root, 'config'), { recursive: true });
  await writeFile(resolve(root, 'config/release-ledger.json'), `${JSON.stringify(ledger)}\n`);
  const recoveryBootstrap = await readWindowsPackageRecoveryBootstrapAuthority({ root, preallocatedRelease: recoveryPreallocatedRelease });
  return { root, receipt, bindings, externalChainRoot, recoveryBootstrap };
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 50
  })));
});

describe('immutable Windows package provenance history', () => {
  it('writes current receipt and all PR-235 copies under one immutable bundle', async () => {
    const { root, receipt, bindings, externalChainRoot } = await createFixture();
    const result = await writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot });
    expect(result.bundle.path).toBe(windowsPackageHistoryBundleRelativePath(receipt.release));
    const bundle = JSON.parse(await readFile(resolve(root, result.bundle.path), 'utf8'));
    expect(Object.keys(bundle.pr235EvidenceBindings).sort()).toEqual([...evidenceIds].sort());
    for (const id of evidenceIds) {
      const archived = await readFile(resolve(dirname(resolve(root, result.bundle.path)), `pr235/${id}.json`));
      expect(sha256(archived)).toBe(bindings[id].sha256);
      expect(archived.length).toBe(bindings[id].sizeBytes);
    }
    const current = await readFile(resolve(root, 'artifacts/validation/windows-package-provenance.json'));
    const archived = await readFile(resolve(dirname(resolve(root, result.bundle.path)), 'windows-package-provenance.json'));
    expect(current.equals(archived)).toBe(true);
    expect(result.externalAnchor.sha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('fails closed on duplicate bundle and preserves the committed current receipt', async () => {
    const { root, receipt, externalChainRoot } = await createFixture();
    await writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot });
    const currentPath = resolve(root, 'artifacts/validation/windows-package-provenance.json');
    const before = await readFile(currentPath);
    await expect(writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot }))
      .rejects.toThrow(/already exist/u);
    expect((await readFile(currentPath)).equals(before)).toBe(true);
  });

  it('fails closed when an unparseable history lock already exists', async () => {
    const { root, receipt, externalChainRoot } = await createFixture();
    await writeFile(resolve(root, 'artifacts/validation/release-history/.windows-package-provenance.lock'), 'occupied');
    await expect(writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot })).rejects.toThrow(/valid JSON/u);
  });

  it('rejects a live exact lock owner, then recovers after the writer is really killed by the OS', async () => {
    const { root, receipt, externalChainRoot } = await createFixture();
    const receiptPath = resolve(root, 'child-receipt.json');
    await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`);
    const modulePath = fileURLToPath(new URL('../../../scripts/lib/windows-package-provenance.mjs', import.meta.url));
    const childSource = `
      import { readFile } from 'node:fs/promises';
      import { pathToFileURL } from 'node:url';
      const [modulePath, root, receiptPath, externalChainRoot] = process.argv.slice(1);
      const { writeWindowsPackageProvenanceTransaction } = await import(pathToFileURL(modulePath).href);
      const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
      await writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot, faultInjection: async (point) => {
        if (point !== 'AFTER_BUNDLE_DIRECTORY_PUBLISH') return;
        process.stdout.write('REAL_LOCK_READY\\n');
        await new Promise(() => { setInterval(() => {}, 1_000); });
      }});
    `;
    const child = spawn(process.execPath, ['--input-type=module', '-e', childSource, modulePath, root, receiptPath, externalChainRoot], {
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    await waitForChildMarker(child, 'REAL_LOCK_READY');
    await expect(writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot }))
      .rejects.toThrow(/live exact owner/u);
    const exited = waitForChildExit(child);
    expect(child.kill('SIGKILL')).toBe(true);
    await exited;
    const recovered = await writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot });
    expect(recovered.externalAnchor.sha256).toMatch(/^[a-f0-9]{64}$/u);
    await expect(readFile(resolve(root, 'artifacts/validation/release-history/.windows-package-provenance.lock')))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('treats a reused PID with a different process start identity as a stale exact lock', async () => {
    const { root, receipt, externalChainRoot } = await createFixture();
    const lockPath = resolve(root, 'artifacts/validation/release-history/.windows-package-provenance.lock');
    await writeFile(lockPath, `${JSON.stringify({
      schemaVersion: 1,
      id: 'PPT-WINDOWS-PACKAGE-PROVENANCE-LOCK-V1',
      pid: process.pid,
      processStartIdentity: 'definitely-not-the-current-process-start-identity',
      release: receipt.release,
      releaseId: receipt.releaseId,
      bundlePath: windowsPackageHistoryBundleRelativePath(receipt.release),
      createdAt: new Date().toISOString(),
    }, null, 2)}\n`);
    const recovered = await writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot });
    expect(recovered.bundle.path).toBe(windowsPackageHistoryBundleRelativePath(receipt.release));
  });

  it('rejects a reparse evidence source before publishing either receipt', async () => {
    const { root, receipt, bindings, externalChainRoot } = await createFixture();
    const link = resolve(root, 'evidence-junction');
    await symlink(resolve(root, 'evidence'), link, 'junction');
    receipt.pr235EvidenceBindings.baseline = { ...bindings.baseline, path: resolve(link, 'baseline.json') };
    await expect(writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot })).rejects.toThrow(/symlink\/reparse/u);
    await expect(readFile(resolve(root, 'artifacts/validation/windows-package-provenance.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('checks the nearest existing ancestor before creating the release-history root', async () => {
    const { root, receipt, externalChainRoot } = await createFixture();
    const validationRoot = resolve(root, 'artifacts/validation');
    const redirectedRoot = await mkdtemp(resolve(tmpdir(), 'parsyuva-provenance-redirect-'));
    roots.push(redirectedRoot);
    await rm(validationRoot, { recursive: true, force: false });
    await symlink(redirectedRoot, validationRoot, 'junction');
    await expect(writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot }))
      .rejects.toThrow(/symlink\/reparse|realpath drifted/u);
    expect(await readdir(redirectedRoot)).toEqual([]);
  });

  it('recovers only an identical published-but-unanchored bundle and rejects drift', async () => {
    const { root, receipt, externalChainRoot } = await createFixture();
    const first = await writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot });
    await unlink(first.externalAnchor.path);
    const recovered = await writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot });
    expect(recovered.bundle.sha256).toBe(first.bundle.sha256);
    await unlink(recovered.externalAnchor.path);
    await writeFile(resolve(dirname(resolve(root, recovered.bundle.path)), 'pr235/baseline.json'), '{"drift":true}\n');
    await expect(writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot }))
      .rejects.toThrow(/drift/u);
  });

  it('recovers an identical bundle after a hard kill immediately after atomic bundle publish', async () => {
    const { root, receipt, externalChainRoot } = await createFixture();
    await expect(writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot,
      faultInjection: simulatedHardKill('AFTER_BUNDLE_DIRECTORY_PUBLISH') }))
      .rejects.toThrow(/simulated hard kill/u);
    await expect(readFile(resolve(root, windowsPackageHistoryBundleRelativePath(receipt.release)))).resolves.toBeInstanceOf(Buffer);
    await expect(readFile(resolve(root, 'artifacts/validation/windows-package-provenance.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    const recovered = await writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot });
    expect(recovered.externalAnchor.sha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('ignores a hard-killed partial anchor staging file and atomically publishes a complete record on retry', async () => {
    const { root, receipt, externalChainRoot } = await createFixture();
    await expect(writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot,
      faultInjection: simulatedHardKill('AFTER_EXTERNAL_ANCHOR_STAGE_FSYNC') }))
      .rejects.toThrow(/simulated hard kill/u);
    expect(await readdir(externalChainRoot)).toEqual([]);
    const externalStagingRoot = resolve(dirname(externalChainRoot), '.package-provenance-chain-staging');
    expect((await readdir(externalStagingRoot)).some((name) => name.endsWith('.tmp'))).toBe(true);
    const recovered = await writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot });
    expect(await readdir(externalChainRoot)).toHaveLength(1);
    expect(JSON.parse(await readFile(recovered.externalAnchor.path, 'utf8')).status).toBe('PASS');
  });

  it('repairs only the non-authoritative current copy after anchor commit hard kill and then rejects a complete duplicate', async () => {
    const { root, receipt, externalChainRoot } = await createFixture();
    await expect(writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot,
      faultInjection: simulatedHardKill('AFTER_EXTERNAL_ANCHOR_COMMIT') }))
      .rejects.toThrow(/simulated hard kill/u);
    const currentPath = resolve(root, 'artifacts/validation/windows-package-provenance.json');
    await expect(readFile(currentPath)).rejects.toMatchObject({ code: 'ENOENT' });
    const recovered = await writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot });
    expect(sha256(await readFile(currentPath))).toBe(recovered.current.sha256);
    await writeFile(currentPath, '{"stale":true}\n');
    const staleRepaired = await writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot });
    expect(sha256(await readFile(currentPath))).toBe(staleRepaired.current.sha256);
    await expect(writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot }))
      .rejects.toThrow(/already exist/u);
  });

  it('keeps rejected sequence-50 as immutable ancestry and hashes it into the exact recovery sequence-51 record', async () => {
    const { root, receipt, externalChainRoot, recoveryBootstrap } = await createFixture();
    const first = await writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot });
    const next = { ...receipt, release: 'Bronze 26.08.2026.51', releaseId: 'bronze-2026-08-26-r51',
      version: '26.08.2026.51', packageVersion: '26.8.2026-51', parentRelease: receipt.release,
      previousPackageProvenance: recoveryPreviousPackage(root, first, receipt, recoveryBootstrap), generatedAt: '2026-08-25T12:00:00.000Z' };
    const forgedLedgerBinding = JSON.parse(JSON.stringify(next));
    forgedLedgerBinding.previousPackageProvenance.recoveryBootstrap.releaseLedger.sha256 = '0'.repeat(64);
    await expect(writeWindowsPackageProvenanceTransaction({ root, receipt: forgedLedgerBinding, externalChainRoot }))
      .rejects.toThrow(/live canonical release ledger/u);
    const second = await writeWindowsPackageProvenanceTransaction({ root, receipt: next, externalChainRoot });
    const firstRecord = JSON.parse(await readFile(first.externalAnchor.path, 'utf8'));
    const secondRecord = JSON.parse(await readFile(second.externalAnchor.path, 'utf8'));
    expect(firstRecord.chainMode).toBe('BOOTSTRAP');
    expect(secondRecord.chainMode).toBe('CONTINUATION');
    expect(secondRecord.previous.recordSha256).toBe(sha256(await readFile(first.externalAnchor.path)));
  });

  it('rejects forged recovery parent path, live binding drift and non-sequence-50 identity at immutable precommit', async () => {
    const createNext = async () => {
      const fixture = await createFixture();
      const first = await writeWindowsPackageProvenanceTransaction({
        root: fixture.root, receipt: fixture.receipt, externalChainRoot: fixture.externalChainRoot
      });
      const next = {
        ...fixture.receipt,
        release: 'Bronze 26.08.2026.51', releaseId: 'bronze-2026-08-26-r51',
        version: '26.08.2026.51', packageVersion: '26.8.2026-51', parentRelease: fixture.receipt.release,
        previousPackageProvenance: recoveryPreviousPackage(fixture.root, first, fixture.receipt, fixture.recoveryBootstrap),
        generatedAt: '2026-08-25T12:00:00.000Z'
      };
      return { ...fixture, first, next };
    };

    const forgedPath = await createNext();
    forgedPath.next.previousPackageProvenance.path = resolve(forgedPath.root, 'forged', 'bundle.json');
    await expect(writeWindowsPackageProvenanceTransaction({
      root: forgedPath.root, receipt: forgedPath.next, externalChainRoot: forgedPath.externalChainRoot
    })).rejects.toThrow(/path is not canonical at immutable precommit/u);

    const bindingDrift = await createNext();
    bindingDrift.next.previousPackageProvenance.sha256 = '0'.repeat(64);
    await expect(writeWindowsPackageProvenanceTransaction({
      root: bindingDrift.root, receipt: bindingDrift.next, externalChainRoot: bindingDrift.externalChainRoot
    })).rejects.toThrow(/live size\/SHA binding changed/u);

    const identityDrift = await createNext();
    const parentBundlePath = resolve(identityDrift.root, identityDrift.first.bundle.path);
    const forgedBundle = JSON.parse(await readFile(parentBundlePath, 'utf8'));
    forgedBundle.release = 'Bronze 22.08.2026.49';
    forgedBundle.releaseId = 'bronze-2026-08-22-r49';
    const forgedBytes = Buffer.from(`${JSON.stringify(forgedBundle, null, 2)}\n`);
    await writeFile(parentBundlePath, forgedBytes);
    identityDrift.next.previousPackageProvenance.sizeBytes = forgedBytes.length;
    identityDrift.next.previousPackageProvenance.sha256 = sha256(forgedBytes);
    await expect(writeWindowsPackageProvenanceTransaction({
      root: identityDrift.root, receipt: identityDrift.next, externalChainRoot: identityDrift.externalChainRoot
    })).rejects.toThrow(/exact rejected Bronze sequence-50 provenance identity/u);
  });

  it('fails closed on missing, future-dated and forged external anchor/bundle evidence', async () => {
    const { root, receipt, externalChainRoot } = await createFixture();
    const result = await writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot });
    const bundlePath = resolve(root, result.bundle.path);
    const bundle = JSON.parse(await readFile(bundlePath, 'utf8'));
    await unlink(result.externalAnchor.path);
    await expect(verifyExternalWindowsPackageProvenanceAnchor({ root, expectedRelease: receipt.release,
      bundleDirectory: dirname(bundlePath), bundle, externalChainRoot })).rejects.toThrow(/missing/u);
    const recovered = await writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot });
    const record = JSON.parse(await readFile(recovered.externalAnchor.path, 'utf8'));
    record.generatedAt = '2999-01-01T00:00:00.000Z';
    await writeFile(recovered.externalAnchor.path, `${JSON.stringify(record, null, 2)}\n`);
    await expect(verifyExternalWindowsPackageProvenanceAnchor({ root, expectedRelease: receipt.release,
      bundleDirectory: dirname(bundlePath), bundle, externalChainRoot })).rejects.toThrow(/future-dated/u);
  });

  it('rejects missing archive files and forged producer anchors', async () => {
    const { root, receipt, externalChainRoot } = await createFixture();
    const result = await writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot });
    const bundlePath = resolve(root, result.bundle.path);
    const bundle = JSON.parse(await readFile(bundlePath, 'utf8'));
    await unlink(resolve(dirname(bundlePath), 'pr235/targetedTest.json'));
    await expect(verifyExternalWindowsPackageProvenanceAnchor({ root, expectedRelease: receipt.release,
      bundleDirectory: dirname(bundlePath), bundle, externalChainRoot })).rejects.toThrow(/inventory/u);
    await writeFile(resolve(dirname(bundlePath), 'pr235/targetedTest.json'), await readFile(receipt.pr235EvidenceBindings.targetedTest.path));
    const record = JSON.parse(await readFile(result.externalAnchor.path, 'utf8'));
    record.producer.sha256 = 'f'.repeat(64);
    await writeFile(result.externalAnchor.path, `${JSON.stringify(record, null, 2)}\n`);
    await expect(verifyExternalWindowsPackageProvenanceAnchor({ root, expectedRelease: receipt.release,
      bundleDirectory: dirname(bundlePath), bundle, externalChainRoot })).rejects.toThrow(/differs/u);
  });

  it('rejects full-chain parent-record hash drift', async () => {
    const { root, receipt, externalChainRoot, recoveryBootstrap } = await createFixture();
    const first = await writeWindowsPackageProvenanceTransaction({ root, receipt, externalChainRoot });
    const next = { ...receipt, release: 'Bronze 26.08.2026.51', releaseId: 'bronze-2026-08-26-r51',
      version: '26.08.2026.51', packageVersion: '26.8.2026-51', parentRelease: receipt.release,
      previousPackageProvenance: recoveryPreviousPackage(root, first, receipt, recoveryBootstrap), generatedAt: '2026-08-25T12:00:00.000Z' };
    const second = await writeWindowsPackageProvenanceTransaction({ root, receipt: next, externalChainRoot });
    await writeFile(first.externalAnchor.path, `${(await readFile(first.externalAnchor.path, 'utf8')).trim()} \n`);
    const secondBundlePath = resolve(root, second.bundle.path);
    await expect(verifyExternalWindowsPackageProvenanceAnchor({ root, expectedRelease: next.release,
      bundleDirectory: dirname(secondBundlePath), bundle: JSON.parse(await readFile(secondBundlePath, 'utf8')),
      externalChainRoot })).rejects.toThrow(/parent hash/u);
  });

  it('requires the canonical exact parent bundle for sequence 51 while sequence 50 has no predecessor', async () => {
    const currentProvenance = { headCommit: 'c'.repeat(40) };
    await expect(verifyPreviousWindowsPackageProvenance({
      root: 'C:/canonical',
      preallocatedRelease: { monthlySequence: 50 },
      bundlePath: undefined,
      currentProvenance,
      runGit: () => Buffer.alloc(0)
    })).resolves.toBeNull();
    await expect(verifyPreviousWindowsPackageProvenance({
      root: 'C:/canonical',
      preallocatedRelease: { monthlySequence: 51, parentRelease: 'Bronze 22.08.2026.50' },
      bundlePath: undefined,
      currentProvenance,
      runGit: () => Buffer.alloc(0)
    })).rejects.toThrow(/exact parent/u);
    await expect(verifyPreviousWindowsPackageProvenance({
      root: 'C:/canonical',
      preallocatedRelease: { monthlySequence: 51, parentRelease: 'Bronze 22.08.2026.50' },
      bundlePath: 'C:/arbitrary/elevated/self-claim.json',
      currentProvenance,
      runGit: () => Buffer.alloc(0)
    })).rejects.toThrow(/not canonical/u);
  });

  it('accepts recovery authority only from the exact live ledger decision and rejected-invalid sequence-50 status', async () => {
    const { root } = await createFixture();
    const preallocatedRelease = {
      visibleRelease: 'Bronze 26.08.2026.51', releaseId: 'bronze-2026-08-26-r51', monthlySequence: 51,
      parentRelease: 'Bronze 22.08.2026.50', recoveryBootstrapDecision: 'RECOVERY_BOOTSTRAP_AFTER_REJECTED_50'
    };
    const ledger = {
      schemaVersion: 1,
      current: { ...preallocatedRelease, status: 'IN_PROGRESS' },
      entries: [
        { version: '22.08.2026.50', monthlySequence: 50, releaseId: 'bronze-2026-08-22-r50', status: 'REJECTED_INVALID_PACKAGE' },
        { version: '26.08.2026.51', monthlySequence: 51, releaseId: 'bronze-2026-08-26-r51', status: 'IN_PROGRESS',
          parentRelease: 'Bronze 22.08.2026.50', recoveryBootstrapDecision: 'RECOVERY_BOOTSTRAP_AFTER_REJECTED_50' }
      ]
    };
    await mkdir(resolve(root, 'config'), { recursive: true });
    await writeFile(resolve(root, 'config/release-ledger.json'), `${JSON.stringify(ledger)}\n`);
    await expect(readWindowsPackageRecoveryBootstrapAuthority({ root, preallocatedRelease })).resolves.toMatchObject({
      decision: 'RECOVERY_BOOTSTRAP_AFTER_REJECTED_50', parentStatus: 'REJECTED_INVALID_PACKAGE',
      currentSequence: 51, parentSequence: 50, releaseLedger: { path: 'config/release-ledger.json' }
    });
    ledger.entries[0].status = 'IN_PROGRESS';
    await writeFile(resolve(root, 'config/release-ledger.json'), `${JSON.stringify(ledger)}\n`);
    await expect(readWindowsPackageRecoveryBootstrapAuthority({ root, preallocatedRelease }))
      .rejects.toThrow(/rejected-invalid-package/u);
    ledger.entries[0].status = 'REJECTED_INVALID_PACKAGE';
    ledger.current.status = 'REJECTED_INVALID_PACKAGE';
    await writeFile(resolve(root, 'config/release-ledger.json'), `${JSON.stringify(ledger)}\n`);
    await expect(readWindowsPackageRecoveryBootstrapAuthority({ root, preallocatedRelease }))
      .rejects.toThrow(/authorized Bronze sequence-51/u);
    ledger.current.status = 'IN_PROGRESS';
    ledger.entries[1].status = 'COMPLETED';
    await writeFile(resolve(root, 'config/release-ledger.json'), `${JSON.stringify(ledger)}\n`);
    await expect(readWindowsPackageRecoveryBootstrapAuthority({ root, preallocatedRelease }))
      .rejects.toThrow(/authorized Bronze sequence-51/u);
    await expect(readWindowsPackageRecoveryBootstrapAuthority({ root, preallocatedRelease: {
      ...preallocatedRelease, monthlySequence: 52
    } })).rejects.toThrow(/exact authorized/u);
  });

  it('rejects sequence-51 envelopes that forge a trusted installed predecessor or omit recovery authority', () => {
    const receipt: any = {
      schemaVersion: 2, id: 'PPT-WINDOWS-PACKAGE-PROVENANCE-V2', evidenceKind: 'WINDOWS_PACKAGE_PROVENANCE',
      status: 'PASS', buildMode: 'LOCAL_UNSIGNED_NSIS', release: 'Bronze 26.08.2026.51',
      releaseId: 'bronze-2026-08-26-r51', channel: 'Bronze', version: '26.08.2026.51', packageVersion: '26.8.2026-51',
      parentRelease: 'Bronze 22.08.2026.50', previousPackageProvenance: recoveryPreviousPackage('C:/canonical', {
        bundle: { path: 'bundle.json', sizeBytes: 100, sha256: 'f'.repeat(64) }
      }, { release: 'Bronze 22.08.2026.50', releaseId: 'bronze-2026-08-22-r50' }),
      generatedAt: '2026-08-25T12:00:00.000Z', producer: {
        path: 'apps/desktop/scripts/run-electron-builder.mjs', sizeBytes: 1, sha256: 'd'.repeat(64)
      }, sourceProvenance: { channel: 'Bronze', branch: 'channel/bronze', worktreeClean: true,
        sharedGitObjectDatabaseVerified: true }
    };
    receipt.previousPackageProvenance.trustedInstalledPredecessor = true;
    expect(() => validateWindowsPackageProvenanceEnvelope({ receipt, expectedReleaseId: receipt.releaseId }))
      .toThrow(/history-anchor-only/u);
    delete receipt.previousPackageProvenance.recoveryBootstrap;
    receipt.previousPackageProvenance.trustedInstalledPredecessor = false;
    expect(() => validateWindowsPackageProvenanceEnvelope({ receipt, expectedReleaseId: receipt.releaseId }))
      .toThrow(/authority binding/u);
  });

  it('rejects forged schema-2 channel, version and release identity claims', () => {
    const base = {
      schemaVersion: 2, id: 'PPT-WINDOWS-PACKAGE-PROVENANCE-V2', evidenceKind: 'WINDOWS_PACKAGE_PROVENANCE',
      status: 'PASS', buildMode: 'LOCAL_UNSIGNED_NSIS', release: 'Bronze 22.08.2026.50',
      releaseId: 'bronze-2026-08-22-r50', channel: 'Bronze', version: '22.08.2026.50', packageVersion: '22.8.2026-50',
      parentRelease: 'Bronze 22.08.2026.49', previousPackageProvenance: null,
      generatedAt: '2026-08-22T12:00:00.000Z', producer: {
        path: 'apps/desktop/scripts/run-electron-builder.mjs', sizeBytes: 1, sha256: 'd'.repeat(64)
      }, sourceProvenance: { channel: 'Bronze', branch: 'channel/bronze', worktreeClean: true,
        sharedGitObjectDatabaseVerified: true }
    };
    expect(() => validateWindowsPackageProvenanceEnvelope({ receipt: { ...base, channel: 'Gold' },
      expectedReleaseId: base.releaseId })).toThrow(/identity/u);
    expect(() => validateWindowsPackageProvenanceEnvelope({ receipt: { ...base, version: '22.08.2026.51' },
      expectedReleaseId: base.releaseId })).toThrow(/identity/u);
  });
});
