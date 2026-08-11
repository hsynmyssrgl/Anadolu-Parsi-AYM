import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { asCorrelationId, asIsoDateTime } from '@ppt/core';
import {
  PlatformPolicyEnforcementError,
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel
} from '@ppt/platform-policy';
import { SqlitePlatformPolicyTransactionRepository } from '@ppt/repositories';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.ts';

const NOW = asIsoDateTime('2026-08-06T12:30:00.000Z');
const POLICY_VERSION = '30-p-two-process-race-v1';
const FAMILY_ID = 'family-30p-race';
const ACCOUNT_ID = 'account-30p-race';
const PERSON_ID = 'person-30p-race';
const FENCE_NAME = 'archive-write';
const clock = Object.freeze({ now: () => NOW });

const argument = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : fallback;
};
const mode = argument('mode', 'nonce');
const databasePath = resolve(argument('db', ''));
const nonce = argument('nonce', `nonce-30p-race-${process.pid}`);
const correlationId = argument('correlation', `corr-30p-race-${process.pid}`);
const resourceId = argument('resource', `archive-30p-race-${process.pid}`);
const fenceEpoch = Number(argument('epoch', '30'));

if (!databasePath || !Number.isSafeInteger(fenceEpoch) || fenceEpoch < 0) {
  throw new Error('30-P race fixture arguments are invalid');
}
mkdirSync(dirname(databasePath), { recursive: true });

const runtime = new SqliteFamilyDatabaseRuntime({
  databasePath,
  applicationVersion: '30-p-race-child',
  clock,
  skipFileMigrationSafetyBackup: true,
  databaseConfig: { busyTimeoutMs: 10_000, journalMode: 'WAL', synchronous: 'FULL' }
});
const repository = new SqlitePlatformPolicyTransactionRepository();
const repositoryContext = (transaction, requestedCorrelation = transaction.correlationId) => ({
  transaction: transaction.transaction,
  actor: { userId: ACCOUNT_ID, roles: ['family_admin'], personId: PERSON_ID },
  correlationId: requestedCorrelation,
  occurredAt: transaction.occurredAt
});
const emit = (status, details = {}) => {
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    mode,
    processId: process.pid,
    status,
    nonce,
    correlationId,
    resourceId,
    fenceEpoch,
    ...details
  })}\n`);
};

const kernel = () => new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('30-p-two-process-race-signing-key', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['archive.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

const runPolicyAttempt = async () => {
  const pep = new PlatformPolicyEnforcementPoint({
    kernel: kernel(),
    authorityResolver: {
      resolve: () => ({
        policyVersion: POLICY_VERSION,
        accountId: ACCOUNT_ID,
        personId: PERSON_ID,
        deviceId: 'device-30p-race',
        applicationId: 'windows-desktop',
        deviceTrusted: true,
        membershipActive: true,
        roles: ['family_admin'],
        familyIds: [FAMILY_ID],
        online: true,
        grants: [{
          id: `grant-${resourceId}`,
          subjectAccountId: ACCOUNT_ID,
          resourceType: 'archive_item',
          resourceId,
          actions: ['create'],
          purposes: ['archive'],
          effect: 'allow',
          startsAt: '2026-01-01T00:00:00.000Z'
        }],
        expiresAt: '2026-08-06T12:35:00.000Z'
      })
    },
    resourceResolver: {
      resolve: () => ({
        type: 'archive_item',
        id: resourceId,
        familyId: FAMILY_ID,
        ownerPersonId: PERSON_ID,
        sensitivity: 'personal'
      })
    },
    receiptSink: { append: () => undefined, ensure: () => undefined },
    replayStore: {
      reserve: (reservation) => {
        const result = runtime.transactionExecutor.execute(
          asCorrelationId(`${correlationId}-reservation`),
          (transaction) => repository.reserveReplayNonce(
            repositoryContext(transaction),
            reservation
          )
        );
        if (!result.ok) throw new Error(result.error.message);
        return result.value;
      }
    },
    nonceFactory: () => nonce,
    clock: () => NOW,
    deferAllowedReceiptPersistence: true
  });
  return pep.execute({
    correlationId,
    action: 'create',
    capability: 'archive.write',
    resourceType: 'archive_item',
    resourceId,
    purpose: 'archive'
  }, () => ({ writable: true, epoch: fenceEpoch }), (authorization) => {
    if (mode === 'nonce') return { ok: true, value: 'reserved' };
    return runtime.transactionExecutor.execute(
      asCorrelationId(correlationId),
      (transaction) => repository.recordAuthorizedTransaction({
        ...repositoryContext(transaction, asCorrelationId(correlationId)),
        policyAuthorization: authorization
      }, {
        record: authorization.receiptRecord,
        fenceName: FENCE_NAME,
        fenceEpoch: authorization.fenceEpoch,
        fenceWritable: true
      })
    );
  });
};

let exitCode = 70;
try {
  if (mode === 'init') {
    const synchronized = runtime.transactionExecutor.execute(
      asCorrelationId('corr-30p-race-init'),
      (transaction) => repository.synchronizeFence(repositoryContext(transaction), {
        fenceName: FENCE_NAME,
        epoch: fenceEpoch,
        writable: true,
        synchronizedAt: NOW
      })
    );
    if (!synchronized.ok) throw new Error(synchronized.error.message);
    emit('INITIALIZED', { databaseFence: synchronized.value });
    exitCode = 0;
  } else {
    const result = await runPolicyAttempt();
    if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
      const expectedExit = mode === 'correlation' ? 21 : mode === 'stale' ? 22 : 70;
      emit(mode === 'correlation' ? 'DUPLICATE_CORRELATION_REJECTED' : 'STALE_FENCE_REJECTED', {
        repositoryError: result.error
      });
      exitCode = expectedExit;
    } else {
      emit('COMMITTED');
      exitCode = 0;
    }
  }
} catch (error) {
  if (error instanceof PlatformPolicyEnforcementError && error.code === 'RECEIPT_REPLAYED') {
    emit('DUPLICATE_NONCE_REJECTED', { errorCode: error.code, errorMessage: error.message });
    exitCode = 20;
  } else {
    emit('UNEXPECTED_FAILURE', {
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCode: error && typeof error === 'object' && 'code' in error ? String(error.code) : null
    });
    exitCode = 70;
  }
} finally {
  runtime.close();
}
process.exitCode = exitCode;
