import { createHash, createHmac } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  GetPolicyDecisionAuditBoundaryUseCase,
  type PolicyDecisionAuditInspectionPort
} from '@ppt/application';
import {
  ImmutablePolicyDecisionAuditError,
  ImmutablePolicyDecisionAuditPolicy,
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  type PlatformPolicyConnectionAuthority,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import { PlatformPolicyReceiptFileSink } from '../src/main/platform-policy-receipt-file-sink.js';
import { PlatformPolicyDecisionAuditInspectionAdapter } from '../src/main/policy-decision-audit-application-adapter.js';
import { ProtectedSideArtifactStore, type ProtectedSideArtifactEnvelope } from '../src/main/protected-side-artifact-store.js';
import type { DeviceSecretProtector } from '../src/main/device-secret-protector.js';

const NOW = '2026-08-12T02:00:00.000Z';
const LATER = '2026-08-12T03:00:00.000Z';
const temporaryDirectories: string[] = [];

const canonicalize = (value: unknown): string => {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
};

const protector: DeviceSecretProtector = Object.freeze({
  protectionId: 'ppk018-controlled-device',
  required: false,
  isAvailable: () => true,
  protect: (value) => Buffer.from(`ppk018:${value}`, 'utf8').toString('base64url'),
  unprotect: (value) => {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    if (!decoded.startsWith('ppk018:')) throw new Error('PPK018_PROTECTOR_INVALID');
    return decoded.slice('ppk018:'.length);
  }
});

class MonotonicAuthority {
  #sequence = 0;
  #headHash = '0'.repeat(64);
  #sizeBytes = 0;

  public checkpointPolicyJournal(input: { journalSequence: number; journalHeadHash: string; journalSizeBytes: number }) {
    if (input.journalSequence < this.#sequence) throw new Error('PPK018_ROLLBACK');
    if (input.journalSequence === this.#sequence && (
      input.journalHeadHash !== this.#headHash || input.journalSizeBytes !== this.#sizeBytes
    )) throw new Error('PPK018_EQUIVOCATION');
    this.#sequence = input.journalSequence;
    this.#headHash = input.journalHeadHash;
    this.#sizeBytes = input.journalSizeBytes;
    return Promise.resolve(Object.freeze({
      schemaVersion: 1 as const,
      authorityEpoch: Math.max(1, this.#sequence),
      journalSequence: this.#sequence,
      journalHeadHash: this.#headHash,
      journalSizeBytes: this.#sizeBytes,
      checkpointHash: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
      acceptedAt: NOW
    }));
  }
}

class DelayedMonotonicAuthority {
  readonly acceptedSequences: number[] = [];
  #sequence = 0;
  #headHash = '0'.repeat(64);
  #sizeBytes = 0;

  public async checkpointPolicyJournal(input: { journalSequence: number; journalHeadHash: string; journalSizeBytes: number }) {
    if (input.journalSequence === 1) await new Promise((resolve) => setTimeout(resolve, 25));
    if (input.journalSequence < this.#sequence) throw new Error('PPK018_ROLLBACK');
    if (input.journalSequence === this.#sequence && (
      input.journalHeadHash !== this.#headHash || input.journalSizeBytes !== this.#sizeBytes
    )) throw new Error('PPK018_EQUIVOCATION');
    this.#sequence = input.journalSequence;
    this.#headHash = input.journalHeadHash;
    this.#sizeBytes = input.journalSizeBytes;
    this.acceptedSequences.push(input.journalSequence);
    return Object.freeze({
      schemaVersion: 1 as const,
      authorityEpoch: Math.max(1, this.#sequence),
      journalSequence: this.#sequence,
      journalHeadHash: this.#headHash,
      journalSizeBytes: this.#sizeBytes,
      checkpointHash: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
      acceptedAt: NOW
    });
  }
}

const kernel = (): PlatformPolicyKernel => new PlatformPolicyKernel({
  policyVersion: 'PPK-018-V1',
  signingKey: Buffer.alloc(32, 18),
  policyPackageVersion: 18,
  decisionAuthorityId: 'local-policy-kernel',
  applicationVersions: { 'windows-desktop': '4.8.2026-29' },
  applicationCapabilities: { 'windows-desktop': ['family.read'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

const authority = (allowed: boolean): PlatformPolicyConnectionAuthority => ({
  policyVersion: 'PPK-018-V1',
  accountId: 'account-018',
  personId: 'person-018',
  deviceId: 'device-018',
  applicationId: 'windows-desktop',
  applicationVersion: '4.8.2026-29',
  decisionAuthorityId: 'local-policy-kernel',
  deviceTrusted: allowed,
  membershipActive: true,
  roles: ['adult_member'],
  familyIds: ['family-018'],
  householdIds: [],
  familyBranchIds: [],
  online: true,
  expiresAt: LATER
});

const resource = Object.freeze({
  type: 'special_record',
  id: 'record-018',
  familyId: 'family-018',
  ownerPersonId: 'person-018',
  sensitivity: 'highly_sensitive' as const,
  dataClasses: ['special'] as const,
  classificationSource: 'declared' as const
});

const captureRecord = async (allowed: boolean, nonce: string): Promise<PlatformPolicyReceiptRecord> => {
  let captured: PlatformPolicyReceiptRecord | undefined;
  const pep = new PlatformPolicyEnforcementPoint({
    kernel: kernel(),
    authorityResolver: { resolve: () => authority(allowed) },
    resourceResolver: { resolve: () => resource },
    receiptSink: { append: (record) => { captured = record; } },
    replayStore: { reserve: () => true },
    clock: () => NOW,
    nonceFactory: () => nonce
  });
  const operation = () => 'executed';
  const promise = pep.execute({
    correlationId: `corr-${nonce}`,
    resourceType: resource.type,
    resourceId: resource.id,
    action: 'read',
    capability: 'family.read',
    purpose: 'ppk018-audit'
  }, () => ({ writable: true, epoch: 18 }), operation);
  if (allowed) await expect(promise).resolves.toBe('executed');
  else await expect(promise).rejects.toMatchObject({ code: 'POLICY_DENIED' });
  if (!captured) throw new Error('PPK018_RECORD_NOT_CAPTURED');
  return captured;
};

const createSink = (
  directory: string,
  monotonicAuthority: ConstructorParameters<typeof PlatformPolicyReceiptFileSink>[0]['monotonicAuthority'] = new MonotonicAuthority()
) => {
  const store = new ProtectedSideArtifactStore({
    keyPath: join(directory, 'secrets', 'data-key.json'),
    applicationVersion: '4.8.2026-29',
    protector,
    now: () => NOW
  });
  const sink = new PlatformPolicyReceiptFileSink({
    filePath: join(directory, 'data', 'policy-decisions.pptjournal'),
    macKeyPath: join(directory, 'secrets', 'audit-mac-key.json'),
    macKeyProtector: protector,
    protectedArtifactStore: store,
    monotonicAuthority
  });
  return { sink, store, journalPath: join(directory, 'data', 'policy-decisions.pptjournal') };
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('PPK-018 değişmez policy karar audit zinciri', () => {
  it('izin kararında policy sürümü, exact yükümlülükler ve kimlik hashlerini bağlar', async () => {
    const source = await captureRecord(true, 'nonce-018-policy-allow');
    const policy = new ImmutablePolicyDecisionAuditPolicy();
    const audit = policy.create(source);
    expect(audit).toMatchObject({
      schemaVersion: 1,
      decision: 'allowed',
      decisionReason: 'ALLOW_POLICY',
      policyVersion: 'PPK-018-V1',
      policyPackageVersion: 18,
      policyPackageSha256: source.policyPackageSha256,
      correlationId: source.correlationId,
      contextHash: source.contextHash,
      requestHash: source.receipt.requestHash,
      obligations: source.decision.obligations
    });
    expect(audit.receiptHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(audit.recordHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(audit.auditHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(source.obligationExecution?.attestationHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(policy.verify(source, audit)).toBe(true);
  });

  it('ret kararını işlem açılmadan reason ve ret yükümlülükleriyle yakalar', async () => {
    const source = await captureRecord(false, 'nonce-018-policy-deny');
    const audit = new ImmutablePolicyDecisionAuditPolicy().create(source);
    expect(audit.decision).toBe('denied');
    expect(audit.decisionReason).toBe('DEVICE_NOT_TRUSTED');
    expect(audit.obligations).toEqual(source.decision.obligations);
    expect(source.obligationExecution).toBeUndefined();
  });

  it.each([
    ['policy package', (record: PlatformPolicyReceiptRecord) => ({ ...record, policyPackageSha256: '0'.repeat(64) })],
    ['context hash', (record: PlatformPolicyReceiptRecord) => ({ ...record, contextHash: '0'.repeat(64) })],
    ['resource identity', (record: PlatformPolicyReceiptRecord) => ({ ...record, resourceId: 'other-record' })],
    ['decision reason', (record: PlatformPolicyReceiptRecord) => ({ ...record, decision: { ...record.decision, reason: 'EXPLICIT_DENY' as const } })],
    ['obligations', (record: PlatformPolicyReceiptRecord) => ({ ...record, decision: { ...record.decision, obligations: [{ type: 'no_export' as const }] } })],
    ['obligation execution', (record: PlatformPolicyReceiptRecord) => ({ ...record, obligationExecution: { ...record.obligationExecution!, attestationHash: '0'.repeat(64) } })]
  ])('%s uyuşmazlığını fail-closed reddeder', async (_name, mutate) => {
    const source = await captureRecord(true, `nonce-018-tamper-${String(_name).replace(/\s+/gu, '-')}`);
    expect(() => new ImmutablePolicyDecisionAuditPolicy().create(mutate(source) as PlatformPolicyReceiptRecord))
      .toThrow(ImmutablePolicyDecisionAuditError);
  });

  it('audit hash ve audit gövdesi değişikliğini doğrulamaz', async () => {
    const source = await captureRecord(true, 'nonce-018-audit-tamper');
    const policy = new ImmutablePolicyDecisionAuditPolicy();
    const audit = policy.create(source);
    expect(policy.verify(source, { ...audit, auditHash: '0'.repeat(64) })).toBe(false);
    expect(policy.verify(source, { ...audit, decisionReason: 'EXPLICIT_DENY' })).toBe(false);
  });

  it('izin ve ret kararlarını şifreli audit zarfıyla aynı HMAC zincirine yazar', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppk018-audit-chain-'));
    temporaryDirectories.push(directory);
    const { sink, store, journalPath } = createSink(directory);
    try {
      const allowed = await captureRecord(true, 'nonce-018-chain-allow');
      const denied = await captureRecord(false, 'nonce-018-chain-deny');
      await sink.append(allowed);
      await sink.append(denied);
      const inspection = sink.inspectForControlledTest();
      expect(inspection).toMatchObject({
        valid: true,
        entryCount: 2,
        auditedEntryCount: 2,
        legacyReceiptEntryCount: 0
      });
      expect(inspection.latestAuditHash).toMatch(/^[0-9a-f]{64}$/u);

      const diskText = readFileSync(journalPath, 'utf8');
      expect(diskText).not.toContain(allowed.correlationId);
      expect(diskText).not.toContain(denied.correlationId);
      expect(diskText).not.toContain('DEVICE_NOT_TRUSTED');
      const first = JSON.parse(diskText.trim().split('\n')[0]!) as { protectedRecord: ProtectedSideArtifactEnvelope };
      const plaintext = store.openEnvelope(first.protectedRecord);
      try {
        const payload = JSON.parse(plaintext.toString('utf8')) as Record<string, unknown>;
        expect(payload).toMatchObject({ schemaVersion: 1, kind: 'immutable-policy-decision-audit' });
        expect(payload).toHaveProperty('auditRecord');
        expect(payload).toHaveProperty('receiptRecord');
      } finally {
        plaintext.fill(0);
      }
    } finally {
      sink.dispose();
      store.dispose();
    }
  });

  it('es zamanli makbuz checkpointlerini Core Service otoritesine journal sirasiyla iletir', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppk018-audit-concurrent-'));
    temporaryDirectories.push(directory);
    const monotonicAuthority = new DelayedMonotonicAuthority();
    const { sink, store } = createSink(directory, monotonicAuthority);
    try {
      const first = await captureRecord(true, 'nonce-018-concurrent-first');
      const second = await captureRecord(false, 'nonce-018-concurrent-second');
      await expect(Promise.all([sink.append(first), sink.append(second)])).resolves.toEqual([undefined, undefined]);
      expect(monotonicAuthority.acceptedSequences).toEqual([1, 2]);
      expect(sink.inspectForControlledTest()).toMatchObject({ valid: true, entryCount: 2 });
    } finally {
      sink.dispose();
      store.dispose();
    }
  });

  it('trusted restart bütün receiptleri ve korumalı audit bağlarını doğrular', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppk018-audit-restart-'));
    temporaryDirectories.push(directory);
    const first = createSink(directory);
    const policyKernel = kernel();
    try {
      await first.sink.append(await captureRecord(true, 'nonce-018-restart-allow'));
      await first.sink.append(await captureRecord(false, 'nonce-018-restart-deny'));
      first.sink.dispose();
      first.store.dispose();
      const restarted = createSink(directory);
      try {
        const inspection = await restarted.sink.inspectWithTrustedProvider({
          verify: ({ request, receipt }) => policyKernel.verifyReceiptForRequest(receipt, request)
        });
        expect(inspection).toMatchObject({ valid: true, entryCount: 2, auditedEntryCount: 2 });
      } finally {
        restarted.sink.dispose();
        restarted.store.dispose();
      }
    } catch (error) {
      try { first.sink.dispose(); } catch { /* already disposed */ }
      try { first.store.dispose(); } catch { /* already disposed */ }
      throw error;
    }
  });

  it('tarihsel doğrudan receipt payloadını geriye uyumlu okur ve yeni audit sayısına katmaz', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppk018-audit-legacy-'));
    temporaryDirectories.push(directory);
    const { sink, store, journalPath } = createSink(directory);
    try {
      const record = await captureRecord(true, 'nonce-018-legacy');
      const recordBytes = Buffer.from(canonicalize(record), 'utf8');
      const protectedRecord = store.sealBuffer('platform-policy-receipt', recordBytes);
      recordBytes.fill(0);
      const payload = Object.freeze({
        schemaVersion: 2,
        sequence: 1,
        previousHash: '0'.repeat(64),
        protectedRecordHash: createHash('sha256').update(canonicalize(protectedRecord)).digest('hex'),
        protectedRecord
      });
      const keyEnvelope = JSON.parse(readFileSync(join(directory, 'secrets', 'audit-mac-key.json'), 'utf8')) as {
        protectedMacKey: string;
      };
      const macKey = Buffer.from(protector.unprotect(keyEnvelope.protectedMacKey), 'base64url');
      const entry = Object.freeze({
        ...payload,
        entryHash: createHmac('sha256', macKey).update(canonicalize(payload)).digest('hex')
      });
      macKey.fill(0);
      mkdirSync(join(directory, 'data'), { recursive: true });
      writeFileSync(journalPath, `${JSON.stringify(entry)}\n`, 'utf8');
      const inspection = await sink.inspectWithTrustedProvider({
        verify: ({ request, receipt }) => kernel().verifyReceiptForRequest(receipt, request)
      });
      expect(inspection).toMatchObject({
        valid: true,
        entryCount: 1,
        auditedEntryCount: 0,
        legacyReceiptEntryCount: 1
      });
      expect(inspection.latestAuditHash).toBeUndefined();
    } finally {
      sink.dispose();
      store.dispose();
    }
  });

  it('aynı nonce ile değişen kararın tek bir baytını bile eklemez', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppk018-audit-replay-'));
    temporaryDirectories.push(directory);
    const { sink, store, journalPath } = createSink(directory);
    try {
      const source = await captureRecord(true, 'nonce-018-replay');
      await sink.append(source);
      const before = readFileSync(journalPath);
      await expect(sink.ensure!({
        ...source,
        decision: { ...source.decision, obligations: [{ type: 'no_export' }] },
        receipt: { ...source.receipt, decision: { ...source.receipt.decision, obligations: [{ type: 'no_export' }] } }
      })).rejects.toThrow();
      expect(readFileSync(journalPath)).toEqual(before);
    } finally {
      sink.dispose();
      store.dispose();
    }
  });

  it('journal bit değişikliğinde hiçbir durum projectionı döndürmez', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppk018-audit-bit-'));
    temporaryDirectories.push(directory);
    const { sink, store, journalPath } = createSink(directory);
    try {
      await sink.append(await captureRecord(true, 'nonce-018-bit'));
      const bytes = readFileSync(journalPath);
      const marker = Buffer.from('"entryHash":"', 'utf8');
      const markerOffset = bytes.lastIndexOf(marker);
      expect(markerOffset).toBeGreaterThanOrEqual(0);
      const offset = markerOffset + marker.byteLength;
      const mutated = Buffer.from(bytes);
      mutated[offset] = mutated[offset] === 0x61 ? 0x62 : 0x61;
      writeFileSync(journalPath, mutated);
      expect(() => sink.inspectDecisionAuditBoundary()).toThrow(/POLICY_RECEIPT_JOURNAL_HASH_CHAIN_INVALID/u);
    } finally {
      sink.dispose();
      store.dispose();
    }
  });

  it.each([
    ['izin', true],
    ['ret', false]
  ] as const)('%s audit yazımı başarısızsa karar veya payload operasyonuna geçmez', async (_name, allowed) => {
    let operationCalls = 0;
    const pep = new PlatformPolicyEnforcementPoint({
      kernel: kernel(),
      authorityResolver: { resolve: () => authority(allowed) },
      resourceResolver: { resolve: () => resource },
      receiptSink: { append: () => { throw new Error('CONTROLLED_AUDIT_FAILURE'); } },
      replayStore: { reserve: () => true },
      clock: () => NOW,
      nonceFactory: () => 'nonce-018-fail-closed'
    });
    await expect(pep.execute({
      correlationId: 'corr-018-fail-closed', resourceType: resource.type, resourceId: resource.id,
      action: 'read', capability: 'family.read', purpose: 'ppk018-audit'
    }, () => ({ writable: true, epoch: 18 }), () => { operationCalls += 1; }))
      .rejects.toMatchObject({ code: 'RECEIPT_PERSISTENCE_FAILED' });
    expect(operationCalls).toBe(0);
  });

  it('tipli boundary yalnız content-free doğrulama durumunu yayınlar', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppk018-audit-view-'));
    temporaryDirectories.push(directory);
    const { sink, store } = createSink(directory);
    try {
      await sink.append(await captureRecord(false, 'nonce-018-view'));
      const view = new GetPolicyDecisionAuditBoundaryUseCase(
        new ImmutablePolicyDecisionAuditPolicy(),
        new PlatformPolicyDecisionAuditInspectionAdapter(sink)
      ).execute();
      expect(view).toMatchObject({
        schemaVersion: 1,
        status: 'verified',
        enforcement: 'fail-closed',
        allowedDecisionsRecorded: true,
        deniedDecisionsRecorded: true,
        denialReasonRequired: true,
        obligationsRecordedExactly: true,
        appendOnly: true,
        encryptedAtRest: true,
        hmacSha256Chained: true,
        externalMonotonicCheckpointRequired: true,
        payloadExposedToClient: false,
        auditedEntryCount: 1,
        legacyReceiptEntryCount: 0
      });
      expect(JSON.stringify(view)).not.toContain('account-018');
      expect(JSON.stringify(view)).not.toContain('record-018');
      expect(JSON.stringify(view)).not.toContain('DEVICE_NOT_TRUSTED');
    } finally {
      sink.dispose();
      store.dispose();
    }
  });

  it.each([
    { valid: false, entryCount: 0, auditedEntryCount: 0, legacyReceiptEntryCount: 0, headHash: '0'.repeat(64) },
    { valid: true, entryCount: 2, auditedEntryCount: 1, legacyReceiptEntryCount: 0, headHash: '0'.repeat(64) },
    { valid: true, entryCount: 0, auditedEntryCount: 0, legacyReceiptEntryCount: 0, headHash: 'not-a-hash' }
  ])('bozuk inspection verisini fail-closed reddeder', (inspection) => {
    const port: PolicyDecisionAuditInspectionPort = { inspect: () => inspection };
    expect(() => new GetPolicyDecisionAuditBoundaryUseCase(new ImmutablePolicyDecisionAuditPolicy(), port).execute())
      .toThrow('POLICY_DECISION_AUDIT_INSPECTION_FAILED');
  });
});
