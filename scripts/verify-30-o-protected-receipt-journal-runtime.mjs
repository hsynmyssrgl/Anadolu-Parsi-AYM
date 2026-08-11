import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { PlatformPolicyEnforcementPoint, PlatformPolicyKernel } from '../packages/platform-policy/dist/index.js';
import { ProtectedSideArtifactStore } from '../apps/desktop/dist/main/protected-side-artifact-store.js';
import { PlatformPolicyReceiptFileSink } from '../apps/desktop/dist/main/platform-policy-receipt-file-sink.js';

const truth = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const reportPath = 'artifacts/validation/30-O-protected-receipt-journal-runtime.json';
const canonicalTruth = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const checks = [];
const failures = [];
const evidenceBoundary = Object.freeze({
  compiledDesktopRuntimeModules: true,
  controlledDeviceProtector: true,
  hmacSha256ChainWithSeparateDeviceProtectedKey: true,
  trustedRestartReceiptVerification: 'CONTROLLED_KERNEL_PROVIDER',
  completeTailRollbackWithExternalMonotonicAnchor: 'PASS_CONTROLLED_AUTHORITY',
  multiProcessReplayProtection: 'NOT_RUN_NOT_PASS'
});

const describeError = (error) => error instanceof Error
  ? `${error.name}: ${error.message}`
  : String(error);
const check = async (name, operation) => {
  try {
    await operation();
    checks.push({ name, status: 'PASS' });
  } catch (error) {
    const message = describeError(error);
    checks.push({ name, status: 'FAIL', error: message });
    failures.push({ name, error: message });
  }
};

class ControlledDeviceSecretProtector {
  protectionId = 'controlled-device-protector-30o-journal';
  required = true;

  isAvailable() { return true; }

  protect(secret) {
    return Buffer.from(`controlled-30o:${secret}`, 'utf8').toString('base64url');
  }

  unprotect(protectedValue) {
    const opened = Buffer.from(protectedValue, 'base64url').toString('utf8');
    if (!opened.startsWith('controlled-30o:')) throw new Error('CONTROLLED_DEVICE_PROTECTOR_INVALID');
    return opened.slice('controlled-30o:'.length);
  }
}

class ControlledMonotonicAuthority {
  epoch = 0;
  checkpoint = undefined;

  async checkpointPolicyJournal(input) {
    const current = this.checkpoint;
    if (current && input.journalSequence < current.journalSequence) {
      throw new Error('POLICY_JOURNAL_ROLLBACK_DETECTED');
    }
    if (current && input.journalSequence === current.journalSequence) {
      if (input.journalHeadHash !== current.journalHeadHash || input.journalSizeBytes !== current.journalSizeBytes) {
        throw new Error('POLICY_JOURNAL_EQUIVOCATION_DETECTED');
      }
    } else {
      this.epoch += 1;
      this.checkpoint = Object.freeze({ ...input });
    }
    const accepted = this.checkpoint ?? Object.freeze({ ...input });
    return Object.freeze({
      schemaVersion: 1,
      authorityEpoch: Math.max(1, this.epoch),
      ...accepted,
      checkpointHash: createHash('sha256').update(JSON.stringify(accepted)).digest('hex'),
      acceptedAt: occurredAt
    });
  }
}

const policyVersion = 'PPT-PLATFORM-POLICY-2026-08-04-V1';
const occurredAt = '2026-08-06T03:30:00.000Z';
const kernel = new PlatformPolicyKernel({
  policyVersion,
  signingKey: Buffer.alloc(32, 31),
  applicationCapabilities: { 'windows-desktop': ['archive.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});
const verifiedRestartNonces = [];
const controlledTrustedReceiptVerifier = Object.freeze({
  verify: ({ request, receipt }) => {
    verifiedRestartNonces.push(receipt.nonce);
    return kernel.verifyReceiptForRequest(receipt, request);
  }
});
const canonicalize = (value) => {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
};
const unkeyedSha256 = (value) => createHash('sha256').update(value).digest('hex');
const attackerRechain = (first, remaining) => {
  let previousHash = first.entryHash;
  const rechained = [first];
  for (const [offset, source] of remaining.entries()) {
    const payload = {
      schemaVersion: source.schemaVersion,
      sequence: offset + 2,
      previousHash,
      protectedRecordHash: source.protectedRecordHash,
      protectedRecord: source.protectedRecord
    };
    const forged = { ...payload, entryHash: unkeyedSha256(canonicalize(payload)) };
    rechained.push(forged);
    previousHash = forged.entryHash;
  }
  return Buffer.from(`${rechained.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8');
};
const makeRecord = async (sequence, nonce) => {
  const correlationId = `corr-30o-journal-${sequence}`;
  let capturedRecord;
  const enforcementPoint = new PlatformPolicyEnforcementPoint({
    kernel,
    authorityResolver: Object.freeze({
      resolve: () => Object.freeze({
        policyVersion,
      accountId: 'account-30o-journal',
      personId: 'person-30o-journal',
      deviceId: 'device-30o-journal',
      applicationId: 'windows-desktop',
      deviceTrusted: true,
      membershipActive: true,
      roles: Object.freeze(['adult_member']),
      familyIds: Object.freeze(['family-30o-journal']),
      householdIds: Object.freeze([]),
        familyBranchIds: Object.freeze([]),
        online: true,
        expiresAt: '2026-08-07T03:30:00.000Z'
      })
    }),
    resourceResolver: Object.freeze({
      resolve: () => Object.freeze({
      type: 'archive_item',
      id: `archive-30o-journal-${sequence}`,
      familyId: 'family-30o-journal',
      ownerPersonId: 'person-30o-journal',
      sensitivity: 'personal',
      dataClasses: Object.freeze(['personal']),
      classificationSource: 'declared'
      })
    }),
    receiptSink: Object.freeze({
      append: (record) => { capturedRecord = record; }
    }),
    replayStore: Object.freeze({ reserve: () => true }),
    clock: () => occurredAt,
    nonceFactory: () => nonce
  });
  const result = await enforcementPoint.execute({
    correlationId,
    resourceType: 'archive_item',
    resourceId: `archive-30o-journal-${sequence}`,
    action: 'update',
    capability: 'archive.write',
    purpose: 'journal-runtime-verification'
  }, () => Object.freeze({ writable: true, epoch: 30 }), () => 'authorized');
  assert.equal(result, 'authorized');
  assert.ok(capturedRecord);
  return capturedRecord;
};

let temporaryRoot;
let firstStore;
let restartedStore;
let firstSink;
let restartedSink;
try {
  temporaryRoot = await mkdtemp(resolve(tmpdir(), 'ppt-30o-protected-journal-'));
  const keyPath = resolve(temporaryRoot, 'keys', 'receipt-data-key.json');
  const macKeyPath = resolve(temporaryRoot, 'keys', 'receipt-journal-mac-key.json');
  const journalPath = resolve(temporaryRoot, 'journal', 'policy-receipts.jsonl');
  const lockPath = `${journalPath}.lock`;
  const firstRecord = await makeRecord(1, 'nonce-30o-journal-1');
  const secondRecord = await makeRecord(2, 'nonce-30o-journal-2');
  const thirdRecord = await makeRecord(3, 'nonce-30o-journal-3');
  const monotonicAuthority = new ControlledMonotonicAuthority();

  firstStore = new ProtectedSideArtifactStore({
    keyPath,
    applicationVersion: '4.8.2026-29',
    protector: new ControlledDeviceSecretProtector(),
    now: () => occurredAt
  });
  firstSink = new PlatformPolicyReceiptFileSink({
    filePath: journalPath,
    macKeyPath,
    macKeyProtector: new ControlledDeviceSecretProtector(),
    protectedArtifactStore: firstStore,
    monotonicAuthority
  });

  await check('first protected append is decrypted and read back as one valid journal entry', async () => {
    await firstSink.append(firstRecord);
    const inspection = firstSink.inspectForControlledTest();
    assert.equal(inspection.exists, true);
    assert.equal(inspection.valid, true);
    assert.equal(inspection.entryCount, 1);
    assert.equal(inspection.latestReceiptNonce, firstRecord.receipt.nonce);
    assert.equal(inspection.protection, 'AES_256_GCM_AND_HMAC_SHA256_DEVICE_PROTECTED_KEYS');
    const onDisk = (await readFile(journalPath)).toString('utf8');
    assert.equal(onDisk.includes(firstRecord.correlationId), false);
    assert.equal(onDisk.includes(firstRecord.receipt.nonce), false);
  });

  await check('store and sink restart recover the protected key and read the existing entry', async () => {
    firstSink.dispose();
    firstSink = undefined;
    firstStore.dispose();
    firstStore = undefined;
    restartedStore = new ProtectedSideArtifactStore({
      keyPath,
      applicationVersion: '4.8.2026-29',
      protector: new ControlledDeviceSecretProtector(),
      now: () => occurredAt
    });
    restartedSink = new PlatformPolicyReceiptFileSink({
      filePath: journalPath,
      macKeyPath,
      macKeyProtector: new ControlledDeviceSecretProtector(),
      protectedArtifactStore: restartedStore,
      monotonicAuthority
    });
    verifiedRestartNonces.length = 0;
    const inspection = await restartedSink.inspectWithTrustedProvider(controlledTrustedReceiptVerifier);
    assert.equal(inspection.valid, true);
    assert.equal(inspection.entryCount, 1);
    assert.equal(inspection.latestReceiptNonce, firstRecord.receipt.nonce);
    assert.deepEqual(verifiedRestartNonces, [firstRecord.receipt.nonce]);
  });

  let twoEntryBytes;
  let twoEntryInspection;
  await check('second append after restart extends the verified hash chain to two entries', async () => {
    const priorHead = restartedSink.inspectForControlledTest().headHash;
    await restartedSink.append(secondRecord);
    verifiedRestartNonces.length = 0;
    twoEntryInspection = await restartedSink.inspectWithTrustedProvider(controlledTrustedReceiptVerifier);
    twoEntryBytes = await readFile(journalPath);
    assert.equal(twoEntryInspection.valid, true);
    assert.equal(twoEntryInspection.entryCount, 2);
    assert.equal(twoEntryInspection.latestReceiptNonce, secondRecord.receipt.nonce);
    assert.notEqual(twoEntryInspection.headHash, priorHead);
    assert.deepEqual(verifiedRestartNonces, [firstRecord.receipt.nonce, secondRecord.receipt.nonce]);
  });

  await check('duplicate nonce is rejected before any journal byte is written', async () => {
    const before = await readFile(journalPath);
    await assert.rejects(restartedSink.append(firstRecord), /POLICY_RECEIPT_JOURNAL_NONCE_REPLAY/u);
    const after = await readFile(journalPath);
    assert.deepEqual(after, before);
    const inspection = restartedSink.inspectForControlledTest();
    assert.equal(inspection.valid, true);
    assert.equal(inspection.entryCount, 2);
    assert.equal(inspection.headHash, twoEntryInspection.headHash);
  });

  await check('stale side lock blocks inspection without changing the two-entry journal', async () => {
    await writeFile(lockPath, 'stale-owner:controlled-runtime\n', 'utf8');
    await utimes(lockPath, new Date('2000-01-01T00:00:00.000Z'), new Date('2000-01-01T00:00:00.000Z'));
    try {
      assert.throws(() => restartedSink.inspectForControlledTest(), /POLICY_RECEIPT_JOURNAL_LOCK_PRESENT/u);
    } finally {
      await rm(lockPath, { force: true });
    }
    assert.equal(restartedSink.inspectForControlledTest().entryCount, 2);
  });

  await check('single-bit journal tamper is rejected by the hash chain', async () => {
    const tampered = Buffer.from(twoEntryBytes);
    const marker = Buffer.from('"entryHash":"', 'utf8');
    const hashStart = tampered.lastIndexOf(marker) + marker.byteLength;
    assert.ok(hashStart >= marker.byteLength);
    let tamperOffset = -1;
    for (let offset = hashStart; offset < hashStart + 64; offset += 1) {
      const changed = tampered[offset] ^ 1;
      if (/^[0-9a-f]$/u.test(String.fromCharCode(changed))) {
        tamperOffset = offset;
        break;
      }
    }
    assert.notEqual(tamperOffset, -1);
    tampered[tamperOffset] ^= 1;
    await writeFile(journalPath, tampered);
    try {
      assert.throws(() => restartedSink.inspectForControlledTest(), /POLICY_RECEIPT_JOURNAL_HASH_CHAIN_INVALID/u);
    } finally {
      await writeFile(journalPath, twoEntryBytes);
    }
    assert.equal(restartedSink.inspectForControlledTest().entryCount, 2);
  });

  await check('partial final record truncation is rejected and the restored journal remains valid', async () => {
    assert.ok(twoEntryBytes.byteLength > 16);
    await writeFile(journalPath, twoEntryBytes.subarray(0, twoEntryBytes.byteLength - 7));
    try {
      assert.throws(() => restartedSink.inspectForControlledTest(), /POLICY_RECEIPT_JOURNAL_TRUNCATED/u);
    } finally {
      await writeFile(journalPath, twoEntryBytes);
    }
    const restored = restartedSink.inspectForControlledTest();
    assert.equal(restored.valid, true);
    assert.equal(restored.entryCount, 2);
  });

  let threeEntryBytes;
  await check('third append and trusted restart inspection verify every decrypted request and receipt', async () => {
    await restartedSink.append(thirdRecord);
    verifiedRestartNonces.length = 0;
    const inspection = await restartedSink.inspectWithTrustedProvider(controlledTrustedReceiptVerifier);
    threeEntryBytes = await readFile(journalPath);
    assert.equal(inspection.entryCount, 3);
    assert.deepEqual(verifiedRestartNonces, [
      firstRecord.receipt.nonce,
      secondRecord.receipt.nonce,
      thirdRecord.receipt.nonce
    ]);
  });

  await check('deleting a middle entry and recomputing an unkeyed SHA chain is rejected by HMAC', async () => {
    const entries = threeEntryBytes.toString('utf8').trimEnd().split('\n').map((line) => JSON.parse(line));
    assert.equal(entries.length, 3);
    await writeFile(journalPath, attackerRechain(entries[0], [entries[2]]));
    try {
      assert.throws(
        () => restartedSink.inspectForControlledTest(),
        /POLICY_RECEIPT_JOURNAL_HASH_CHAIN_INVALID/u
      );
    } finally {
      await writeFile(journalPath, threeEntryBytes);
    }
  });

  await check('reordering entries and recomputing an unkeyed SHA chain is rejected by HMAC', async () => {
    const entries = threeEntryBytes.toString('utf8').trimEnd().split('\n').map((line) => JSON.parse(line));
    await writeFile(journalPath, attackerRechain(entries[0], [entries[2], entries[1]]));
    try {
      assert.throws(
        () => restartedSink.inspectForControlledTest(),
        /POLICY_RECEIPT_JOURNAL_HASH_CHAIN_INVALID/u
      );
    } finally {
      await writeFile(journalPath, threeEntryBytes);
    }
  });

  await check('forged receipt in a locally authentic journal is rejected by trusted restart verification', async () => {
    const original = await makeRecord(4, 'nonce-30o-journal-forged');
    const forgedRecord = Object.freeze({
      ...original,
      receipt: Object.freeze({ ...original.receipt, signature: '0'.repeat(64) })
    });
    await restartedSink.append(forgedRecord);
    const restartAfterForgery = new PlatformPolicyReceiptFileSink({
      filePath: journalPath,
      macKeyPath,
      macKeyProtector: new ControlledDeviceSecretProtector(),
      protectedArtifactStore: restartedStore,
      monotonicAuthority
    });
    try {
      await assert.rejects(
        restartAfterForgery.inspectWithTrustedProvider(controlledTrustedReceiptVerifier),
        /POLICY_RECEIPT_JOURNAL_RECEIPT_VERIFICATION_FAILED/u
      );
    } finally {
      restartAfterForgery.dispose();
      await writeFile(journalPath, threeEntryBytes);
    }
    assert.equal(restartedSink.inspectForControlledTest().entryCount, 3);
  });

  await check('missing or corrupt device-protected MAC key fails closed when a journal exists', async () => {
    const protectedMacKey = await readFile(macKeyPath);
    await rm(macKeyPath, { force: true });
    assert.throws(
      () => new PlatformPolicyReceiptFileSink({
        filePath: journalPath,
        macKeyPath,
        macKeyProtector: new ControlledDeviceSecretProtector(),
        protectedArtifactStore: restartedStore,
        monotonicAuthority
      }),
      /POLICY_RECEIPT_JOURNAL_MAC_KEY_MISSING/u
    );
    await writeFile(macKeyPath, Buffer.from('{"schemaVersion":1,"corrupt":true}\n', 'utf8'));
    assert.throws(
      () => new PlatformPolicyReceiptFileSink({
        filePath: journalPath,
        macKeyPath,
        macKeyProtector: new ControlledDeviceSecretProtector(),
        protectedArtifactStore: restartedStore,
        monotonicAuthority
      }),
      /POLICY_RECEIPT_JOURNAL_MAC_KEY_INVALID/u
    );
    await writeFile(macKeyPath, protectedMacKey);
    const verified = new PlatformPolicyReceiptFileSink({
      filePath: journalPath,
      macKeyPath,
      macKeyProtector: new ControlledDeviceSecretProtector(),
      protectedArtifactStore: restartedStore,
      monotonicAuthority
    });
    try {
      assert.equal(verified.inspectForControlledTest().entryCount, 3);
    } finally {
      verified.dispose();
    }
  });

  await check('external monotonic authority rejects a complete-tail rollback', async () => {
    const lines = threeEntryBytes.toString('utf8').trimEnd().split('\n');
    await writeFile(journalPath, `${lines.slice(0, 2).join('\n')}\n`, 'utf8');
    try {
      await assert.rejects(
        restartedSink.inspectWithTrustedProvider(controlledTrustedReceiptVerifier),
        /POLICY_RECEIPT_JOURNAL_MONOTONIC_CHECKPOINT_FAILED/u
      );
      assert.equal(evidenceBoundary.completeTailRollbackWithExternalMonotonicAnchor, 'PASS_CONTROLLED_AUTHORITY');
    } finally {
      await writeFile(journalPath, threeEntryBytes);
    }
  });

  await check('unimplemented durability boundaries remain explicitly non-PASS', async () => {
    assert.equal(evidenceBoundary.completeTailRollbackWithExternalMonotonicAnchor, 'PASS_CONTROLLED_AUTHORITY');
    assert.equal(evidenceBoundary.multiProcessReplayProtection, 'NOT_RUN_NOT_PASS');
  });
} catch (error) {
  const message = describeError(error);
  checks.push({ name: 'runtime setup and orchestration', status: 'FAIL', error: message });
  failures.push({ name: 'runtime setup and orchestration', error: message });
} finally {
  restartedSink?.dispose();
  firstSink?.dispose();
  restartedStore?.dispose();
  firstStore?.dispose();
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
}

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-O',
  requirement: 'PPK-002',
  phase: 'PROTECTED_RECEIPT_JOURNAL_RUNTIME',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  evidenceBoundary,
  mandatoryTruthSentence: canonicalTruth,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (failures.length > 0) {
  console.error(`30-O protected receipt journal runtime: FAIL (${failures.length}/${checks.length})`);
  for (const failure of failures) console.error(`${failure.name}: ${failure.error}`);
  process.exit(1);
}
console.log(`30-O protected receipt journal runtime: PASS (${checks.length} checks).`);
console.log(canonicalTruth);
