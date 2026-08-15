import { DatabaseSync } from 'node:sqlite';
import { generateKeyPairSync, sign } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import { computePlatformPolicyReceiptHash, computePlatformPolicyReceiptRecordHash } from '@ppt/repositories';
import {
  canonicalizeSignedPluginManifest,
  type SignedPluginManifest,
  type SignedPluginManifestEnvelope
} from '@ppt/security';
import { FamilyDataStore } from '../src/main/data-store.js';

const POLICY_VERSION = '33-z-signed-plugin-data-store-v1';
const PASSWORD = 'Guclu33ZImzaliEklentiParolasi!';
const directories: string[] = [];
const stores: FamilyDataStore[] = [];
let projectionSequence = 0;
const signingPair = generateKeyPairSync('ed25519');
const signingKey = {
  keyId: 'plugin-root-2026',
  publicKeyPem: signingPair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  status: 'ACTIVE' as const
};
const kernel = new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('33-z-signed-plugin-data-store-key-material', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write', 'location.read'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete']
});
const provider: PlatformPolicyAuthorizationProvider = {
  resolvePolicyPackage: () => kernel.policyPackage,
  authorize: ({ request, nonce }) => ({
    effectiveRequest: request,
    authorization: kernel.authorizeWithReceipt(request, request.occurredAt, nonce)
  }),
  verify: ({ request, receipt }) => kernel.verifyReceiptForRequest(receipt, request)
};
const projectionProof = (record: PlatformPolicyReceiptRecord): PlatformPolicyJournalProjectionProof => ({
  schemaVersion: 1,
  receiptHash: computePlatformPolicyReceiptHash(record.receipt),
  recordHash: computePlatformPolicyReceiptRecordHash(record),
  receiptNonce: record.receipt.nonce,
  entrySequence: ++projectionSequence,
  entryHash: 'd'.repeat(64),
  headSequence: projectionSequence,
  headHash: 'd'.repeat(64),
  journalSizeBytes: projectionSequence * 512,
  issuedAt: record.recordedAt,
  proofMac: 'e'.repeat(64)
});

afterEach(() => {
  projectionSequence = 0;
  for (const store of stores.splice(0)) {
    try { store.close(); } catch { /* best effort */ }
  }
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const makeStore = (governed: boolean, trusted = true) => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-33z-signed-plugin-'));
  directories.push(directory);
  const databasePath = join(directory, 'family.db');
  const store = new FamilyDataStore({
    databasePath,
    seed: false,
    signedPluginTrustedKeys: trusted ? [signingKey] : [],
    ...(governed ? {
      archivePolicyAuthorizationProvider: provider,
      archivePolicyReceiptSink: { append: () => undefined, ensure: projectionProof, verifyProjectionProof: () => true },
      archivePolicyVersion: POLICY_VERSION,
      archiveClusterFence: () => ({ writable: true, epoch: 104 })
    } : {})
  });
  stores.push(store);
  store.setupAdmin({
    familyName: '33-Z Eklenti Ailesi',
    displayName: '33-Z Aile Yoneticisi',
    email: 'signed-plugin-33z@example.test',
    password: PASSWORD
  });
  const account = store.listAccounts()[0]!;
  return { databasePath, store, accountId: account.id };
};

const allow = (store: FamilyDataStore, accountId: string) => {
  for (const [resourceType, actions] of [
    ['signed_plugin_platform_center', ['read']],
    ['signed_plugin_installation', ['create', 'update', 'delete']]
  ] as const) {
    store.upsertPermission({
      subjectAccountId: accountId,
      resourceType,
      resourceId: '*',
      actions: [...actions],
      effect: 'allow',
      purpose: 'general'
    });
  }
};

const manifest = (version = '1.0.0'): SignedPluginManifest => {
  const issuedAt = new Date(Date.now() - 60_000).toISOString();
  const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
  return {
    pluginId: 'local.bank-reader',
    displayName: 'Yerel banka okuyucu',
    version,
    minimumHostVersion: '4.8.2026',
    sourceCommitId: '1'.repeat(40),
    packageSha256: '1'.repeat(64),
    entrypointSha256: '2'.repeat(64),
    sbomSha256: '3'.repeat(64),
    licenseInventorySha256: '4'.repeat(64),
    provenanceSha256: '5'.repeat(64),
    providerKinds: ['bank'],
    capabilityCodes: ['bank.read'],
    dataDeclarations: [{
      resourceType: 'finance_record', sensitivity: 'highly_sensitive', purpose: 'finance',
      access: 'read_metadata', retentionDays: 0
    }],
    egress: { mode: 'none', hosts: [] },
    sandbox: {
      profile: 'isolated_child_process', filesystemAccess: 'none', processSpawnAllowed: false,
      nativeModulesAllowed: false, networkBrokerOnly: true
    },
    issuedAt,
    expiresAt
  };
};
const envelope = (value = manifest()): SignedPluginManifestEnvelope => ({
  format: 'ppt-signed-plugin-manifest',
  version: 1,
  manifest: value,
  signature: {
    algorithm: 'Ed25519',
    keyId: signingKey.keyId,
    valueBase64Url: sign(
      null,
      Buffer.from(canonicalizeSignedPluginManifest(value), 'utf8'),
      signingPair.privateKey
    ).toString('base64url')
  }
});

describe('33-Z signed plugin DataStore integration', () => {
  it('fails closed without central policy or provisioned signing trust', async () => {
    const noPep = makeStore(false, true).store;
    await expect(noPep.getSignedPluginPlatformCenter()).rejects.toThrow(/policy enforcement is not composed/i);
    const noTrust = makeStore(true, false);
    allow(noTrust.store, noTrust.accountId);
    await expect(noTrust.store.registerSignedPluginManifest({
      clientOperationId: 'register-no-trust', expectedRevision: 0, envelope: envelope()
    })).rejects.toThrow(/signing trust is not provisioned/i);
    const database = new DatabaseSync(noTrust.databasePath, { readOnly: true });
    try {
      expect(database.prepare('SELECT COUNT(*) count FROM signed_plugin_mutations').get()).toEqual({ count: 0 });
    } finally { database.close(); }
  });

  it('verifies, registers, emergency-disables and rolls back without exposing signing authority', async () => {
    const { store, accountId } = makeStore(true, true);
    allow(store, accountId);
    const v1 = envelope(manifest('1.0.0'));
    expect(await store.registerSignedPluginManifest({
      clientOperationId: 'register-v1', expectedRevision: 0, envelope: v1
    })).toMatchObject({ mutationKind: 'release_register', revision: 1, replayed: false, networkUsed: false });
    expect(await store.registerSignedPluginManifest({
      clientOperationId: 'register-v1', expectedRevision: 0, envelope: v1
    })).toMatchObject({ revision: 1, replayed: true });
    expect(await store.setSignedPluginDesiredState({
      clientOperationId: 'enable-v1', pluginId: 'local.bank-reader', expectedRevision: 1,
      enabled: true, reason: 'Yerel inceleme tamamlandi.'
    })).toMatchObject({ mutationKind: 'desired_enable', revision: 2 });
    expect(await store.emergencyDisableSignedPlugin({
      clientOperationId: 'emergency-v1', pluginId: 'local.bank-reader', expectedRevision: 2,
      confirmation: 'EKLENTIYI ACIL DURDUR', reason: 'Supheli yerel paket davranisi.'
    })).toMatchObject({ mutationKind: 'emergency_disable', revision: 3 });
    expect(await store.registerSignedPluginManifest({
      clientOperationId: 'register-v2', expectedRevision: 3, envelope: envelope(manifest('1.1.0'))
    })).toMatchObject({ mutationKind: 'release_update', revision: 4 });
    expect(await store.rollbackSignedPlugin({
      clientOperationId: 'rollback-v1', pluginId: 'local.bank-reader', expectedRevision: 4,
      targetVersion: '1.0.0', confirmation: 'ONCEKI SURUME DON'
    })).toMatchObject({ mutationKind: 'release_rollback', revision: 5 });
    const center = await store.getSignedPluginPlatformCenter();
    expect(center).toMatchObject({
      installations: [{
        id: 'local.bank-reader', currentRelease: { version: '1.0.0', signatureVerified: true },
        previousVersion: '1.1.0', desiredState: 'disabled', rollbackAvailable: true,
        runtimeExecutionReady: false, externalProviderConnectionReady: false
      }],
      truth: {
        manifestCryptographyImplemented: true,
        productionSigningTrustProvisioned: false,
        productionReleaseEligible: false,
        thirdPartyCodeExecutionPerformed: false,
        externalProviderConnectionPerformed: false,
        networkUsedByCurrentImplementation: false
      }
    });
    const serialized = JSON.stringify(center);
    for (const forbidden of ['manifestSha256', 'packageSha256', 'signerKeyId', 'publicKeyPem', 'egressHosts']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('rolls back mutation, installation, audit and outbox together on downstream failure', async () => {
    const { databasePath, store, accountId } = makeStore(true, true);
    allow(store, accountId);
    await store.registerSignedPluginManifest({
      clientOperationId: 'register-rollback-test', expectedRevision: 0, envelope: envelope()
    });
    const injector = new DatabaseSync(databasePath);
    try {
      injector.exec(`CREATE TRIGGER test_33z_outbox_failure BEFORE INSERT ON event_outbox
        WHEN NEW.event_type='signed_plugin.desired_enable'
        BEGIN SELECT RAISE(ABORT,'controlled 33-Z outbox failure'); END;`);
    } finally { injector.close(); }
    await expect(store.setSignedPluginDesiredState({
      clientOperationId: 'enable-rollback-test', pluginId: 'local.bank-reader', expectedRevision: 1,
      enabled: true, reason: 'Atomik rollback kaniti.'
    })).rejects.toThrow(/SQLite|beklenmeyen/i);
    store.close();
    stores.splice(stores.indexOf(store), 1);
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      expect(database.prepare('SELECT desired_state,revision FROM signed_plugin_installations').get())
        .toEqual({ desired_state: 'disabled', revision: 1 });
      expect(database.prepare('SELECT COUNT(*) count FROM signed_plugin_mutations').get()).toEqual({ count: 1 });
      expect(database.prepare("SELECT COUNT(*) count FROM audit_log WHERE action='signed_plugin.desired_enable'").get())
        .toEqual({ count: 0 });
      expect(database.prepare("SELECT COUNT(*) count FROM event_outbox WHERE event_type='signed_plugin.desired_enable'").get())
        .toEqual({ count: 0 });
    } finally { database.close(); }
  });
});
