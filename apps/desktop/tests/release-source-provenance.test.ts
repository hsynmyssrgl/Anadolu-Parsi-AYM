import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertAuthoritativeAndChannelExactEquality,
  captureAuthoritativeSourceProvenance,
  captureReleaseSourceProvenance,
  computeGovernedFingerprintFromEntries,
  computeTrackedCommitFingerprintFromEntries,
  listChangedPathsForImpactAnalysis,
  verifyLocalSourceProtectionArtifacts
} from '../../../scripts/lib/release-source-provenance.mjs';
import { BOOTSTRAP_ADOPTION_BASE_COMMIT } from '../../../scripts/lib/mutation-release-evidence.mjs';

const root = 'C:\\PPT\\AYM\\06_KOD\\kanallar\\Bronze';
const authorityGit = 'C:\\PPT\\AYM\\06_KOD\\app\\.git';
const authoritativeRoot = 'C:\\PPT\\AYM\\06_KOD\\app';
const commit = 'a'.repeat(40);
const tree = 'b'.repeat(40);
const configuration = {
  schemaVersion: 1,
  policyId: 'PPT-RELEASE-CHANNEL-WORKTREE-ISOLATION-V1',
  authoritativeRepositoryDirectory: 'app',
  worktreeRootDirectory: 'kanallar',
  channels: [{ channel: 'Bronze', directory: 'Bronze', branch: 'channel/bronze' }]
};
const releaseLedger = { current: { channel: 'Bronze' } };
const gitBlobOid = (bytes: Buffer) => createHash('sha1')
  .update(Buffer.from(`blob ${bytes.length}\0`))
  .update(bytes)
  .digest('hex');
const baselineProducerBytes = Buffer.from('export const baselineProducer = true;\n');
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

const createRunner = ({ branch = 'channel/bronze', dirty = false, mode = '100644' } = {}) => {
  const blobs = [
    { path: 'apps/desktop/package.json', mode, bytes: Buffer.from('{"name":"desktop"}\n') },
    { path: 'package.json', mode: '100644', bytes: Buffer.from('{"name":"root"}\n') },
    { path: 'scripts/record-mutation-baseline.mjs', mode: '100644', bytes: baselineProducerBytes }
  ].map((entry) => ({ ...entry, oid: gitBlobOid(entry.bytes) }));
  return (args: string[]) => {
    const key = args.join(' ');
    if (key === 'rev-parse --show-toplevel') return Buffer.from(root);
    if (key === 'symbolic-ref --quiet --short HEAD') return Buffer.from(branch);
    if (key === 'rev-parse HEAD') return Buffer.from(commit);
    if (key === 'rev-parse HEAD^{tree}') return Buffer.from(tree);
    if (key === 'rev-parse refs/heads/channel/bronze') return Buffer.from(commit);
    if (key === 'rev-parse --show-object-format') return Buffer.from('sha1');
    if (key === 'status --porcelain=v1 -z --untracked-files=all') return dirty ? Buffer.from('?? dirty.txt\0') : Buffer.alloc(0);
    if (key === 'worktree list --porcelain') {
      return Buffer.from(`worktree ${root}\nHEAD ${commit}\nbranch refs/heads/${branch}\n`);
    }
    if (key === 'rev-parse --git-common-dir') return Buffer.from(authorityGit);
    if (key === `ls-tree -r -z --full-tree ${commit}`) {
      return Buffer.from(blobs.map((entry) => `${entry.mode} ${entry.mode === '120000' ? 'blob' : 'blob'} ${entry.oid}\t${entry.path}\0`).join(''));
    }
    if (key === `show ${commit}:scripts/record-mutation-baseline.mjs`) return baselineProducerBytes;
    const catFile = /^cat-file blob ([a-f0-9]+)$/u.exec(key);
    if (catFile) return blobs.find((entry) => entry.oid === catFile[1])?.bytes ?? Buffer.alloc(0);
    throw new Error(`Unexpected git command: ${key}`);
  };
};

const createAuthoritativeRunner = ({ dirty = false } = {}) => {
  const channelRunner = createRunner({ branch: 'main', dirty });
  return (args: string[]) => {
    const key = args.join(' ');
    if (key === 'rev-parse --show-toplevel') return Buffer.from(authoritativeRoot);
    if (key === 'worktree list --porcelain') {
      return Buffer.from(`worktree ${authoritativeRoot}\nHEAD ${commit}\nbranch refs/heads/main\n`);
    }
    if (key === 'rev-parse --git-common-dir') return Buffer.from(authorityGit);
    return channelRunner(args);
  };
};

describe('release source provenance', () => {
  it('binds only exact tracked commit blobs to the clean Bronze worktree', async () => {
    const result = await captureReleaseSourceProvenance({
      root, expectedChannel: 'Bronze', runGit: createRunner(), configuration, releaseLedger
    });
    expect(result.provenance).toMatchObject({
      channel: 'Bronze',
      source: '06_KOD/kanallar/Bronze',
      branch: 'channel/bronze',
      headCommit: commit,
      headTree: tree,
      worktreeClean: true,
      sharedGitObjectDatabaseVerified: true
    });
    expect(result.provenance.trackedCommitFingerprint.fileCount).toBe(3);
    expect(result.provenance.governedSourceFingerprint.fileCount).toBe(3);
    expect(result.entries.map((entry) => entry.path)).toEqual([
      'apps/desktop/package.json', 'package.json', 'scripts/record-mutation-baseline.mjs'
    ]);
  });

  it('rejects dirty worktrees, wrong branches and non-regular tracked entries', async () => {
    await expect(captureReleaseSourceProvenance({
      root, runGit: createRunner({ dirty: true }), configuration, releaseLedger
    })).rejects.toThrow(/not clean/u);
    await expect(captureReleaseSourceProvenance({
      root, runGit: createRunner({ branch: 'codex/local' }), configuration, releaseLedger
    })).rejects.toThrow(/branch mismatch/u);
    await expect(captureReleaseSourceProvenance({
      root, runGit: createRunner({ mode: '120000' }), configuration, releaseLedger
    })).rejects.toThrow(/forbidden non-regular/u);
  });

  it('captures only a clean authoritative app commit and requires exact Bronze equality', async () => {
    const authoritative = await captureAuthoritativeSourceProvenance({
      root: authoritativeRoot,
      runGit: createAuthoritativeRunner(),
      configuration
    });
    const bronze = await captureReleaseSourceProvenance({
      root,
      expectedChannel: 'Bronze',
      runGit: createRunner(),
      configuration,
      releaseLedger
    });
    expect(authoritative.provenance).toMatchObject({
      channel: 'Authoritative',
      source: '06_KOD/app',
      branch: 'main',
      headCommit: commit,
      headTree: tree,
      worktreeClean: true
    });
    expect(() => assertAuthoritativeAndChannelExactEquality(
      authoritative.provenance, bronze.provenance
    )).not.toThrow();
    expect(() => assertAuthoritativeAndChannelExactEquality(
      authoritative.provenance,
      { ...bronze.provenance, headCommit: 'f'.repeat(40) }
    )).toThrow(/headCommit mismatch/u);
    await expect(captureAuthoritativeSourceProvenance({
      root: authoritativeRoot,
      runGit: createAuthoritativeRunner({ dirty: true }),
      configuration
    })).rejects.toThrow(/not clean/u);
  });

  it('keeps governed and all-tracked fingerprints as separate deterministic identities', () => {
    const entries = [
      { path: 'apps/a.ts', mode: '100644', bytes: Buffer.from('a') },
      { path: 'notes.local', mode: '100644', bytes: Buffer.from('ignored by governed scope') }
    ];
    const governed = computeGovernedFingerprintFromEntries(entries);
    const tracked = computeTrackedCommitFingerprintFromEntries(entries);
    expect(governed.fileCount).toBe(1);
    expect(tracked.fileCount).toBe(2);
    expect(governed.sha256).not.toBe(tracked.sha256);
  });

  it('derives the mutation diff only from the recorded pre-mutation baseline receipt', async () => {
    const baselineCommit = '9'.repeat(40);
    const baseRunner = createRunner();
    const runner = (args: string[]) => {
      const key = args.join(' ');
      if (key === `merge-base --is-ancestor ${baselineCommit} ${commit}`) return Buffer.alloc(0);
      if (key === `rev-parse ${baselineCommit}^{tree}`) return Buffer.from(tree);
      if (key === `ls-tree -r -z --full-tree ${baselineCommit}`) return baseRunner(['ls-tree', '-r', '-z', '--full-tree', commit]);
      if (key === `show ${baselineCommit}:scripts/record-mutation-baseline.mjs`) return baselineProducerBytes;
      if (key === `diff --name-only -z --diff-filter=ACDMRTUXB ${baselineCommit} ${commit}`) {
        return Buffer.from('apps/desktop/package.json\0scripts/new-rule.mjs\0');
      }
      return baseRunner(args);
    };
    const current = await captureReleaseSourceProvenance({
      root, expectedChannel: 'Bronze', runGit: runner, configuration, releaseLedger
    });
    const baseline = {
      schemaVersion: 2, id: 'PPT-MUTATION-BASELINE-EXTERNAL-V2', requirement: 'PR-235', decision: 'DEC-270',
      strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275',
      status: 'PASS', evidenceKind: 'PRE_MUTATION_BASELINE_EXTERNAL', baselineType: 'PRE_MUTATION',
      operationRuleBinding: {
        status: 'PASS', kind: 'mutation', operation: 'record-pre-mutation-baseline', sha256: '1'.repeat(64)
      },
      producer: {
        path: 'scripts/record-mutation-baseline.mjs',
        sizeBytes: baselineProducerBytes.length,
        sha256: sha256(baselineProducerBytes)
      },
      recordedAt: '2026-08-23T18:00:00.000Z',
      sourceProvenance: { ...current.provenance, headCommit: baselineCommit }
    };
    expect(listChangedPathsForImpactAnalysis({
      runGit: runner, baselineReceipt: baseline, headCommit: commit, currentProvenance: current.provenance
    })).toEqual(['apps/desktop/package.json', 'scripts/new-rule.mjs']);
    expect(() => listChangedPathsForImpactAnalysis({
      runGit: runner,
      baselineReceipt: { ...baseline, sourceProvenance: { ...baseline.sourceProvenance, headTree: '7'.repeat(40) } },
      headCommit: commit,
      currentProvenance: current.provenance
    })).toThrow(/tree is stale or forged/u);
    expect(() => listChangedPathsForImpactAnalysis({
      runGit: runner,
      baselineReceipt: { ...baseline, producer: { ...baseline.producer, sha256: '2'.repeat(64) } },
      headCommit: commit,
      currentProvenance: current.provenance
    })).toThrow(/producer is not bound/u);
  });

  it('binds the bootstrap producer to the later recording commit while preserving the historical diff base', async () => {
    const producerCommit = '8'.repeat(40);
    const bootstrapTree = '7'.repeat(40);
    const baseRunner = createRunner();
    const bootstrapEntries = [
      { path: 'apps/desktop/package.json', mode: '100644', bytes: Buffer.from('{"name":"desktop"}\n') },
      { path: 'package.json', mode: '100644', bytes: Buffer.from('{"name":"root"}\n') }
    ].map((entry) => ({ ...entry, oid: gitBlobOid(entry.bytes) }));
    const runner = (args: string[]) => {
      const key = args.join(' ');
      if (key === `merge-base --is-ancestor ${BOOTSTRAP_ADOPTION_BASE_COMMIT} ${commit}`
        || key === `merge-base --is-ancestor ${BOOTSTRAP_ADOPTION_BASE_COMMIT} ${producerCommit}`
        || key === `merge-base --is-ancestor ${producerCommit} ${commit}`) return Buffer.alloc(0);
      if (key === `rev-parse ${BOOTSTRAP_ADOPTION_BASE_COMMIT}^{tree}`) return Buffer.from(bootstrapTree);
      if (key === `ls-tree -r -z --full-tree ${BOOTSTRAP_ADOPTION_BASE_COMMIT}`) {
        return Buffer.from(bootstrapEntries.map((entry) => `${entry.mode} blob ${entry.oid}\t${entry.path}\0`).join(''));
      }
      if (key === `show ${producerCommit}:scripts/record-mutation-baseline.mjs`) return baselineProducerBytes;
      if (key === `diff --name-only -z --diff-filter=ACDMRTUXB ${BOOTSTRAP_ADOPTION_BASE_COMMIT} ${commit}`) {
        return Buffer.from('scripts/record-mutation-baseline.mjs\0');
      }
      return baseRunner(args);
    };
    const current = await captureReleaseSourceProvenance({
      root, expectedChannel: 'Bronze', runGit: runner, configuration, releaseLedger
    });
    const baseline = {
      schemaVersion: 2, id: 'PPT-MUTATION-BASELINE-EXTERNAL-V2', requirement: 'PR-235', decision: 'DEC-270',
      strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275', status: 'PASS',
      evidenceKind: 'PRE_MUTATION_BASELINE_EXTERNAL', baselineType: 'BOOTSTRAP_ADOPTION',
      bootstrapDecision: 'DEC-270_INITIAL_ACTIVATION_ONLY', fullDiffRequired: true,
      chain: { sequence: 1 },
      operationRuleBinding: {
        status: 'PASS', kind: 'mutation', operation: 'record-pre-mutation-baseline', sha256: '1'.repeat(64)
      },
      producer: {
        path: 'scripts/record-mutation-baseline.mjs', sizeBytes: baselineProducerBytes.length,
        sha256: sha256(baselineProducerBytes)
      },
      recordedAt: '2026-08-24T09:52:13.780Z',
      sourceProvenance: {
        ...current.provenance, headCommit: BOOTSTRAP_ADOPTION_BASE_COMMIT, headTree: bootstrapTree,
        trackedCommitFingerprint: computeTrackedCommitFingerprintFromEntries(bootstrapEntries),
        governedSourceFingerprint: computeGovernedFingerprintFromEntries(bootstrapEntries)
      }
    };
    const pointer = {
      schemaVersion: 2, id: 'PPT-MUTATION-BASELINE-POINTER-V2', status: 'PASS',
      requirement: 'PR-235', decision: 'DEC-270',
      strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275',
      evidenceKind: 'PRE_MUTATION_BASELINE_POINTER', sourceCommit: producerCommit,
      producer: baseline.producer
    };
    expect(listChangedPathsForImpactAnalysis({
      runGit: runner, baselineReceipt: baseline, baselinePointer: pointer,
      headCommit: commit, currentProvenance: current.provenance
    })).toEqual(['scripts/record-mutation-baseline.mjs']);
    expect(() => listChangedPathsForImpactAnalysis({
      runGit: runner, baselineReceipt: baseline,
      baselinePointer: { ...pointer, producer: { ...pointer.producer, sha256: '2'.repeat(64) } },
      headCommit: commit, currentProvenance: current.provenance
    })).toThrow(/recording commit is invalid/u);
    expect(() => listChangedPathsForImpactAnalysis({
      runGit: runner, baselineReceipt: baseline,
      headCommit: commit, currentProvenance: current.provenance
    })).toThrow(/recording commit is invalid/u);
    expect(() => listChangedPathsForImpactAnalysis({
      runGit: runner, baselineReceipt: baseline,
      baselinePointer: { ...pointer, sourceCommit: BOOTSTRAP_ADOPTION_BASE_COMMIT },
      headCommit: commit, currentProvenance: current.provenance
    })).toThrow(/recording commit is invalid/u);
    for (const drift of [
      { requirement: 'PR-999' }, { decision: 'DEC-999' },
      { strengthenedByRequirement: 'PR-999' }, { strengthenedByDecision: 'DEC-999' }
    ]) {
      expect(() => listChangedPathsForImpactAnalysis({
        runGit: runner, baselineReceipt: baseline, baselinePointer: { ...pointer, ...drift },
        headCommit: commit, currentProvenance: current.provenance
      })).toThrow(/recording commit is invalid/u);
    }
    expect(() => listChangedPathsForImpactAnalysis({
      runGit: runner, baselineReceipt: baseline,
      baselinePointer: { ...pointer, producer: { ...pointer.producer, sizeBytes: pointer.producer.sizeBytes + 1 } },
      headCommit: commit, currentProvenance: current.provenance
    })).toThrow(/recording commit is invalid/u);
    const rejectGitKey = (rejectedKey: string) => (args: string[]) => {
      if (args.join(' ') === rejectedKey) throw new Error(`Rejected ${rejectedKey}`);
      return runner(args);
    };
    expect(() => listChangedPathsForImpactAnalysis({
      runGit: rejectGitKey(`merge-base --is-ancestor ${BOOTSTRAP_ADOPTION_BASE_COMMIT} ${producerCommit}`),
      baselineReceipt: baseline, baselinePointer: pointer,
      headCommit: commit, currentProvenance: current.provenance
    })).toThrow(/outside the release ancestry/u);
    expect(() => listChangedPathsForImpactAnalysis({
      runGit: rejectGitKey(`merge-base --is-ancestor ${producerCommit} ${commit}`),
      baselineReceipt: baseline, baselinePointer: pointer,
      headCommit: commit, currentProvenance: current.provenance
    })).toThrow(/outside the release ancestry/u);
    expect(() => listChangedPathsForImpactAnalysis({
      runGit: rejectGitKey(`show ${producerCommit}:scripts/record-mutation-baseline.mjs`),
      baselineReceipt: baseline, baselinePointer: pointer,
      headCommit: commit, currentProvenance: current.provenance
    })).toThrow(/not available at its governed producer commit/u);
    expect(() => listChangedPathsForImpactAnalysis({
      runGit: (args: string[]) => args.join(' ') === `show ${producerCommit}:scripts/record-mutation-baseline.mjs`
        ? Buffer.from('tampered producer') : runner(args),
      baselineReceipt: baseline, baselinePointer: pointer,
      headCommit: commit, currentProvenance: current.provenance
    })).toThrow(/producer is not bound/u);
  });

  it('reads back the actual local source receipt and exact-commit backup by governed path and SHA-256', async () => {
    const aymRoot = await mkdtemp(join(tmpdir(), 'parsyuva-source-protection-'));
    const receiptDirectory = join(aymRoot, '05_TEST', '30Z_LOCAL_RECEIPT', 'Bronze');
    const backupDirectory = join(aymRoot, '10_YEDEK', 'Bronze');
    const sourceProvenance = {
      schemaVersion: 1,
      policyId: 'PPT-RELEASE-CHANNEL-WORKTREE-ISOLATION-V1',
      channel: 'Bronze', source: '06_KOD/kanallar/Bronze', worktreeDirectory: 'Bronze',
      branch: 'channel/bronze', headCommit: commit, headTree: tree, objectFormat: 'sha1',
      worktreeClean: true, sharedGitObjectDatabaseVerified: true,
      trackedCommitFingerprint: { sha256: 'c'.repeat(64), fileCount: 2, totalBytes: 20 },
      governedSourceFingerprint: { sha256: 'd'.repeat(64), fileCount: 2 }
    };
    const backupBytes = Buffer.from('exact tracked commit backup');
    const backupSha256 = createHash('sha256').update(backupBytes).digest('hex');
    const receipt = {
      schemaVersion: 2, localReceiptStatus: 'LOCAL_RECEIPT_VERIFIED',
      backupScope: 'TRACKED_FILES_AT_EXACT_COMMIT', treeSha256: sourceProvenance.trackedCommitFingerprint.sha256,
      fileCount: 2, totalBytes: 20, sourceProvenance
    };
    const receiptBytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
    const receiptSha256 = createHash('sha256').update(receiptBytes).digest('hex');
    const protection = {
      schemaVersion: 2, localReceiptStatus: 'LOCAL_RECEIPT_VERIFIED',
      treeSha256: sourceProvenance.trackedCommitFingerprint.sha256, fileCount: 2, totalBytes: 20,
      sourceProvenance,
      receipt: { path: '05_TEST/30Z_LOCAL_RECEIPT/Bronze/SOURCE.json', sha256: receiptSha256 },
      backup: {
        path: '10_YEDEK/Bronze/BACKUP.zip', bytes: backupBytes.length, sha256: backupSha256,
        scope: 'TRACKED_FILES_AT_EXACT_COMMIT', headCommit: commit, headTree: tree,
        trackedCommitFingerprint: sourceProvenance.trackedCommitFingerprint
      }
    };
    try {
      await mkdir(receiptDirectory, { recursive: true });
      await mkdir(backupDirectory, { recursive: true });
      await writeFile(join(receiptDirectory, 'SOURCE.json'), receiptBytes);
      await writeFile(join(backupDirectory, 'BACKUP.zip'), backupBytes);
      await expect(verifyLocalSourceProtectionArtifacts({
        aymRoot, protection, expectedProvenance: sourceProvenance, expectedChannel: 'Bronze'
      })).resolves.toMatchObject({ status: 'PASS', backup: { sha256: backupSha256 } });

      await writeFile(join(backupDirectory, 'BACKUP.zip'), Buffer.from('tampered'));
      await expect(verifyLocalSourceProtectionArtifacts({
        aymRoot, protection, expectedProvenance: sourceProvenance, expectedChannel: 'Bronze'
      })).rejects.toThrow(/backup size\/SHA-256 readback mismatch/u);
    } finally {
      await rm(aymRoot, { recursive: true, force: true });
    }
  });
});
