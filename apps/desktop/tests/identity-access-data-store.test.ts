import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ERROR_CODES,
  asCorrelationId,
  asIsoDateTime,
  createAppError,
  err,
  ok,
  type Clock
} from '@ppt/core';
import type {
  EncryptedCompanionSnapshotPort,
  OfflineTemporaryCredentialVerification,
  TemporaryCredentialEnvelopePort
} from '@ppt/application';
import type { TemporaryCredentialClaimKey, TemporaryCredentialKind } from '@ppt/domain';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import {
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '@ppt/repositories';
import {
  FamilyDataStore,
  type IdentityAccessDataStorePorts
} from '../src/main/data-store.js';

const POLICY_VERSION = '33-p-identity-data-store-policy-v1';
const PASSWORD = 'GucluKimlikTestParolasi123!';
const EMAIL = 'identity-owner@example.com';
const SHA256 = /^[0-9a-f]{64}$/u;
const temporaryDirectories: string[] = [];
const openStores = new Set<FamilyDataStore>();

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const policyKernel = new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('33-p-identity-data-store-signing-key-v1', 'utf8'),
  applicationCapabilities: {
    'windows-desktop': [
      'family.read', 'family.write', 'finance.read', 'finance.write',
      'health.read', 'health.write', 'location.read', 'archive.read', 'archive.write'
    ]
  },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

const authorizationProvider: PlatformPolicyAuthorizationProvider = Object.freeze({
  resolvePolicyPackage: () => policyKernel.policyPackage,
  authorize({ request, nonce }) {
    return Object.freeze({
      effectiveRequest: request,
      authorization: policyKernel.authorizeWithReceipt(request, request.occurredAt, nonce)
    });
  },
  verify({ request, receipt }) {
    return policyKernel.verifyReceiptForRequest(receipt, request);
  }
});

const projectionProof = (record: PlatformPolicyReceiptRecord): PlatformPolicyJournalProjectionProof => Object.freeze({
  schemaVersion: 1,
  receiptHash: computePlatformPolicyReceiptHash(record.receipt),
  recordHash: computePlatformPolicyReceiptRecordHash(record),
  receiptNonce: record.receipt.nonce,
  entrySequence: 1,
  entryHash: 'd'.repeat(64),
  headSequence: 1,
  headHash: 'd'.repeat(64),
  journalSizeBytes: 512,
  issuedAt: record.recordedAt,
  proofMac: 'e'.repeat(64)
});

const monotonicClock = (): Clock => {
  let observed = Date.now();
  return Object.freeze({
    now: () => {
      observed = Math.max(observed, Date.now());
      return asIsoDateTime(new Date(observed).toISOString());
    }
  });
};

const temporaryEnvelope = (): TemporaryCredentialEnvelopePort => {
  const issued = new Map<string, OfflineTemporaryCredentialVerification>();
  return {
    issueAndStore(input) {
      const disclosure = JSON.parse(input.canonicalDisclosureJson) as readonly unknown[];
      const credentialId = String(disclosure[1]);
      const kind = String(disclosure[2]) as TemporaryCredentialKind;
      const claims = disclosure[5] as readonly (readonly [TemporaryCredentialClaimKey, string])[];
      const notBefore = asIsoDateTime(String(disclosure[6]));
      const expiresAt = asIsoDateTime(String(disclosure[7]));
      const qrPayload = Buffer.from(input.canonicalDisclosureJson, 'utf8').toString('base64url');
      const payloadSha256 = sha256(qrPayload);
      issued.set(qrPayload, Object.freeze({
        credentialId,
        kind,
        payloadSha256,
        issuerPublicKeySha256: sha256('issuer-public-key-33-p'),
        audienceRefSha256: sha256('Anadolu İlkokulu güvenlik noktası'),
        notBefore,
        expiresAt,
        disclosedClaimKeys: Object.freeze(claims.map(([key]) => key)),
        signatureValid: true,
        disclosureValid: true,
        audienceMatched: true,
        issuerIdentityCertified: false,
        networkUsed: false
      }));
      return ok(Object.freeze({
        qrPayload,
        payloadSha256,
        signatureSha256: sha256(`signature:${qrPayload}`),
        issuerKeyId: 'issuer-key-33-p',
        issuerPublicKeySha256: sha256('issuer-public-key-33-p'),
        signatureAlgorithm: 'Ed25519' as const,
        disclosureSha256: input.disclosureSha256,
        encryptedEnvelopeReference: `protected-envelope-${sha256(credentialId)}`,
        containsOnlyCanonicalDisclosure: true as const
      }));
    },
    discardEncryptedEnvelope: () => undefined,
    verifyOffline(qrPayload) {
      const found = issued.get(qrPayload);
      return found ? ok(found) : err(createAppError({
        code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        category: 'security',
        message: 'Geçici credential envelope bulunamadı.',
        correlationId: asCorrelationId('identity-temp-envelope-test')
      }));
    }
  };
};

const companionSnapshot: EncryptedCompanionSnapshotPort = {
  create(input) {
    const encryptedEnvelopeBase64Url = Buffer.from(JSON.stringify({
      sourceVersion: input.sourceVersion,
      schemaVersion: input.schemaVersion,
      trustedDeviceId: input.trustedDeviceId
    }), 'utf8').toString('base64url');
    return ok(Object.freeze({
      encryptedEnvelopeBase64Url,
      ciphertextSha256: sha256(`ciphertext:${encryptedEnvelopeBase64Url}`),
      envelopeSha256: sha256(encryptedEnvelopeBase64Url),
      sourceVersion: input.sourceVersion,
      schemaVersion: input.schemaVersion,
      expiresAt: asIsoDateTime(new Date(Date.parse(input.generatedAt) + 300_000).toISOString())
    }));
  }
};

interface Fixture {
  readonly directory: string;
  readonly databasePath: string;
  readonly store: FamilyDataStore;
}

const makeStore = (identityAccessPorts: Partial<IdentityAccessDataStorePorts> = {}): Fixture => {
  const directory = mkdtempSync(join(tmpdir(), 'panthera-identity-33-p-'));
  temporaryDirectories.push(directory);
  const databasePath = join(directory, 'family.db');
  const store = new FamilyDataStore({
    databasePath,
    deviceIdentityPath: join(directory, 'device-identity.json'),
    archivePath: join(directory, 'archive'),
    archivePolicyAuthorizationProvider: authorizationProvider,
    archivePolicyReceiptSink: {
      append: () => undefined,
      ensure: projectionProof,
      verifyProjectionProof: () => true
    },
    archivePolicyVersion: POLICY_VERSION,
    archiveClusterFence: () => ({ writable: true, epoch: 33 }),
    clock: monotonicClock(),
    identityAccessPorts
  });
  openStores.add(store);
  store.setupAdmin({
    familyName: 'Kimlik Erişim Test Ailesi',
    displayName: 'Kimlik Erişim Sahibi',
    email: EMAIL,
    password: PASSWORD
  });
  return { directory, databasePath, store };
};

const databaseCount = (databasePath: string, table: string): number => {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return Number((database.prepare(`SELECT COUNT(*) total FROM ${table}`).get() as { total: number }).total);
  } finally {
    database.close();
  }
};

afterEach(() => {
  for (const store of openStores) store.close();
  openStores.clear();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('33-P identity access FamilyDataStore integration', () => {
  it('fails store construction closed when deployment provider provisioning is invalid',()=>{
    const directory=mkdtempSync(join(tmpdir(),'panthera-identity-provider-invalid-'));temporaryDirectories.push(directory);
    const database=new DatabaseSync(':memory:');
    try{expect(()=>new FamilyDataStore({databasePath:join(directory,'family.db'),databaseConnection:database,skipFileMigrationSafetyBackup:true,deviceIdentityPath:join(directory,'device-identity.json'),archivePath:join(directory,'archive'),
        federatedProviderConfigurations:[{provider:'google',configured:true,configurationId:'google-production',authorizationEndpointSha256:'forged',clientConfigurationSha256:'b'.repeat(64)}]
      })).toThrow(/deployment configuration could not be provisioned/u);
    }finally{database.close();}
  });

  it('requires an authenticated exact owner and current trusted-device/security_epoch binding', async () => {
    const { store, databasePath } = makeStore();
    const center = await store.getIdentityAccessCredentialCenter();
    expect(center.key.accountId).toBeTruthy();
    expect(center.key.ownerPersonId).toBeTruthy();
    expect(center.truth).toMatchObject({
      passkeyPrivateKeyStored: false,
      biometricDataStored: false,
      tokenBytesExposed: false,
      companionSourceAuthority: 'windows_single_writer'
    });

    const database = new DatabaseSync(databasePath);
    try {
      database.prepare('UPDATE trusted_devices SET security_epoch=security_epoch+1 WHERE revoked_at IS NULL').run();
    } finally {
      database.close();
    }
    await expect(store.getIdentityAccessCredentialCenter()).rejects.toThrow('AUTH_DEVICE_TRUST_STALE');
    store.logout();
    await expect(store.getIdentityAccessCredentialCenter()).rejects.toThrow(/oturum|giriş/u);
  });

  it('issues a minimum-disclosure credential once and returns durable replay without a second envelope or write', async () => {
    let quotaReads = 0;
    const envelope = temporaryEnvelope();
    const { store, databasePath } = makeStore({
      temporaryCredentialEnvelope: envelope,
      quota: {
        countTemporaryCredentials: () => {
          quotaReads += 1;
          return ok(0);
        }
      }
    });
    const now = Date.now();
    const operation = await store.issueIdentityAccessOperationToken('temporary_credential_issue');
    const input = {
      clientOperationId: operation.clientOperationId,
      expectedRevision: 0,
      kind: 'school_pickup' as const,
      purpose: 'school_pickup_authorization' as const,
      audienceReference: 'Anadolu İlkokulu güvenlik noktası',
      disclosedClaims: [
        { key: 'subject_display_name' as const, value: 'Ada Pars' },
        { key: 'authorized_person_display_name' as const, value: 'Deniz Pars' }
      ],
      notBefore: asIsoDateTime(new Date(now - 10_000).toISOString()),
      expiresAt: asIsoDateTime(new Date(now + 3_600_000).toISOString())
    };
    const before = {
      mutations: databaseCount(databasePath, 'identity_access_mutations'),
      credentials: databaseCount(databasePath, 'identity_temporary_credentials'),
      audit: databaseCount(databasePath, 'audit_log'),
      outbox: databaseCount(databasePath, 'event_outbox')
    };
    const first = await store.issueTemporaryVerifiableCredential(input);
    expect(first.receipt).toMatchObject({ replayed: false, previousRevision: 0, revision: 1 });
    expect(first.issued).toMatchObject({
      qrPayloadBytes: expect.any(Number),
      containsOnlySelectedClaims: true,
      privateSigningKeyExposed: false,
      networkDeliveryGuaranteed: false
    });
    expect(first.issued?.qrPayload).toBeTruthy();
    expect(SHA256.test(first.receipt.stateFingerprint)).toBe(true);

    const afterFirst = {
      mutations: databaseCount(databasePath, 'identity_access_mutations'),
      credentials: databaseCount(databasePath, 'identity_temporary_credentials'),
      audit: databaseCount(databasePath, 'audit_log'),
      outbox: databaseCount(databasePath, 'event_outbox')
    };
    expect(afterFirst).toEqual({
      mutations: before.mutations + 1,
      credentials: before.credentials + 1,
      audit: before.audit + 1,
      outbox: before.outbox + 1
    });

    const replay = await store.issueTemporaryVerifiableCredential(input);
    expect(replay).toEqual({ receipt: { ...first.receipt, replayed: true } });
    expect(quotaReads).toBe(1);
    expect({
      mutations: databaseCount(databasePath, 'identity_access_mutations'),
      credentials: databaseCount(databasePath, 'identity_temporary_credentials'),
      audit: databaseCount(databasePath, 'audit_log'),
      outbox: databaseCount(databasePath, 'event_outbox')
    }).toEqual(afterFirst);

    await expect(store.issueTemporaryVerifiableCredential({
      ...input,
      audienceReference: 'Farklı hedef'
    })).rejects.toThrow(/RESOURCE-CONFLICT|farklı istek/u);

    const verification = await store.verifyTemporaryVerifiableCredential({ qrPayload: first.issued!.qrPayload,
      expectedAudienceReference: 'Anadolu İlkokulu güvenlik noktası' });
    expect(verification).toMatchObject({
      credentialId: first.receipt.resourceId,
      signatureValid: true,
      disclosureValid: true,
      revocationStatus: 'not_revoked_locally',
      decision: 'accepted_locally',
      networkUsed: false,
      remoteRevocationFreshnessGuaranteed: false
    });
    const center = await store.getIdentityAccessCredentialCenter();
    expect(center.temporaryCredentials).toHaveLength(1);
    expect(JSON.stringify(center)).not.toContain(first.issued!.qrPayload);
    expect(JSON.stringify(center)).not.toContain('Anadolu İlkokulu');
  });

  it('fails closed before durable writes when a required external security port is absent', async () => {
    const { store, databasePath } = makeStore();
    const before = {
      challenges: databaseCount(databasePath, 'identity_passkey_challenges'),
      audit: databaseCount(databasePath, 'audit_log'),
      outbox: databaseCount(databasePath, 'event_outbox')
    };
    const operation = await store.issueIdentityAccessOperationToken('passkey_register');
    await expect(store.beginPasskeyRegistration({
      clientOperationId: operation.clientOperationId,
      relyingPartyId: 'desktop.aile.local'
    })).rejects.toThrow(/challenge|yapılandırılmadı/u);
    expect({
      challenges: databaseCount(databasePath, 'identity_passkey_challenges'),
      audit: databaseCount(databasePath, 'audit_log'),
      outbox: databaseCount(databasePath, 'event_outbox')
    }).toEqual(before);
  });

  it('sweeps only seven-day-old owner-bound crash orphans before issuing a fresh operation token', async () => {
    const discarded: string[] = [];
    const oldReference = `temporary-credential-envelope:${'1'.repeat(64)}`;
    const freshReference = `temporary-credential-envelope:${'2'.repeat(64)}`;
    const base = temporaryEnvelope();
    const { store } = makeStore({
      temporaryCredentialEnvelope: {
        ...base,
        listOwnedEnvelopeReferences(ownerRefSha256) {
          expect(ownerRefSha256).toMatch(SHA256);
          return [
            { encryptedEnvelopeReference: oldReference, createdAt: asIsoDateTime('2026-08-01T00:00:00.000Z') },
            { encryptedEnvelopeReference: freshReference, createdAt: asIsoDateTime(new Date(Date.now() - 60_000).toISOString()) }
          ];
        },
        discardEncryptedEnvelope(reference) { discarded.push(reference); }
      }
    });
    await store.issueIdentityAccessOperationToken('passkey_register');
    expect(discarded).toEqual([oldReference]);
  });

  it('creates only encrypted read-only Windows-authoritative companion metadata and rejects write mode', async () => {
    const { store, databasePath } = makeStore({
      encryptedCompanionSnapshot: companionSnapshot
    });
    const current = store.listTrustedDevices().find(({ current: isCurrent }) => isCurrent);
    if (!current) throw new Error('Current trusted device was not created');
    const snapshotOperation = await store.issueIdentityAccessOperationToken('companion_snapshot_create');
    const snapshot = await store.createReadOnlyCompanionSnapshot({
      clientOperationId: snapshotOperation.clientOperationId,
      trustedDeviceId: current.id,
      requestedMode: 'read_only'
    });
    expect(snapshot).toMatchObject({
      status: 'snapshot_ready',
      trustedDeviceId: current.id,
      sourceVersion: 0,
      sourceAuthority: 'windows_single_writer',
      encrypted: true,
      readOnly: true,
      remoteWritesAccepted: false,
      networkDeliveryGuaranteed: false
    });
    expect(databaseCount(databasePath, 'identity_companion_snapshots')).toBe(1);
    const center = await store.getIdentityAccessCredentialCenter();
    expect(center.companionSnapshots).toHaveLength(1);
    expect(JSON.stringify(center)).not.toContain('encryptedEnvelopeBase64Url');

    const deniedOperation = await store.issueIdentityAccessOperationToken('companion_snapshot_create');
    const denied = await store.createReadOnlyCompanionSnapshot({
      clientOperationId: deniedOperation.clientOperationId,
      trustedDeviceId: current.id,
      requestedMode: 'write'
    });
    expect(denied).toMatchObject({
      status: 'write_forbidden',
      sourceAuthority: 'windows_single_writer',
      remoteWritesAccepted: false,
      networkDeliveryGuaranteed: false
    });
    expect(databaseCount(databasePath, 'identity_companion_snapshots')).toBe(1);
  });
});
