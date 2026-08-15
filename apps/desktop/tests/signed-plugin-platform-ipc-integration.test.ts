import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS,
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy
} from '../src/main/ipc-integration-policy.js';
import {
  resolveIpcRequestAdmissionPolicy,
  resolveIpcRequestLifecyclePolicy,
  resolveIpcRequestRatePolicy
} from '../src/main/ipc-request-lifecycle.js';

const NOW = '2026-08-15T10:00:00.000Z';
const receipt = {
  pluginId: 'local.bank-reader', mutationKind: 'desired_enable', previousRevision: 1, revision: 2,
  occurredAt: NOW, replayed: false, runtimeExecutionPerformed: false,
  externalProviderConnectionPerformed: false, networkUsed: false
};
const truth = {
  localCandidateRegistryImplemented: true, manifestCryptographyImplemented: true, verifiedManifestRequired: true,
  capabilityDefaultDeny: true, networkBrokerRequired: true, sandboxContractRequired: true,
  rollbackRegistryImplemented: true, emergencyDisableRegistryImplemented: true,
  sbomLicenseAndProvenanceHashesRequired: true, supplyChainReleaseGateRequired: true,
  rendererInstallAuthority: false, thirdPartyCodeExecutionPerformed: false,
  externalProviderConnectionPerformed: false, providerCredentialsStored: false,
  productionSigningTrustProvisioned: false, productionReleaseEligible: false,
  sandboxRuntimeVerified: false, osNetworkIsolationVerified: false,
  providerAvailabilityGuaranteed: false, networkUsedByCurrentImplementation: false
};
const center = {
  schemaVersion: 1,
  centerId: 'signed-plugin-platform:family-33-z:person-33-z',
  ownerPersonId: 'person-33-z',
  installations: [{
    id: 'local.bank-reader', ownerPersonId: 'person-33-z', displayName: 'Yerel banka okuyucu',
    currentRelease: {
      version: '1.0.0', providerKinds: ['bank'], capabilityCodes: ['bank.read'],
      dataDeclarations: [{ resourceType: 'finance_record', sensitivity: 'highly_sensitive', purpose: 'finance',
        access: 'read_metadata', retentionDays: 0 }], egressMode: 'none', egressHostCount: 0,
      sandboxProfile: 'isolated_child_process', signatureVerified: true, sbomEvidencePresent: true,
      licenseInventoryEvidencePresent: true, provenanceEvidencePresent: true, verifiedAt: NOW,
      expiresAt: '2026-08-20T10:00:00.000Z'
    },
    desiredState: 'disabled', runtimeExecutionReady: false, externalProviderConnectionReady: false,
    rollbackAvailable: false, revision: 1, createdAt: NOW, updatedAt: NOW
  }],
  truth,
  generatedAt: NOW
};

describe('33-Z signed plugin platform IPC boundary', () => {
  it('accepts only the four renderer-safe channels and exact inputs', () => {
    expect(evaluateIpcIntegrationPolicy(SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.getCenter, []).accepted).toBe(true);
    expect(evaluateIpcIntegrationPolicy(SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.setDesiredState, [{
      clientOperationId: 'operation-desired-33-z', pluginId: 'local.bank-reader', expectedRevision: 1,
      enabled: true, reason: 'Yerel kayit tercihi.'
    }]).accepted).toBe(true);
    expect(evaluateIpcIntegrationPolicy(SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.emergencyDisable, [{
      clientOperationId: 'operation-emergency-33-z', pluginId: 'local.bank-reader', expectedRevision: 2,
      confirmation: 'EKLENTIYI ACIL DURDUR', reason: 'Supheli paket davranisi.'
    }]).accepted).toBe(true);
    expect(evaluateIpcIntegrationPolicy(SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.rollback, [{
      clientOperationId: 'operation-rollback-33-z', pluginId: 'local.bank-reader', expectedRevision: 3,
      targetVersion: '1.0.0', confirmation: 'ONCEKI SURUME DON'
    }]).accepted).toBe(true);
    expect(evaluateIpcIntegrationPolicy('signedPluginPlatform:install', [{}]).accepted).toBe(false);
  });

  it('rejects renderer-supplied manifests, signatures, keys, paths, hosts and prototypes', () => {
    const base = {
      clientOperationId: 'operation-desired-33-z', pluginId: 'local.bank-reader', expectedRevision: 1,
      enabled: true, reason: 'Yerel kayit tercihi.'
    };
    for (const extra of [
      { manifest: {} }, { signature: 'signed' }, { signerKeyId: 'root' }, { publicKeyPem: 'PUBLIC KEY' },
      { packagePath: 'C:\\plugins\\bank.zip' }, { egressHosts: ['api.example.com'] }, { token: 'secret' }
    ]) {
      expect(evaluateIpcIntegrationPolicy(SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.setDesiredState, [{ ...base, ...extra }]).accepted)
        .toBe(false);
    }
    const inherited = Object.create({ admin: true }) as Record<string, unknown>;
    Object.assign(inherited, base);
    expect(evaluateIpcIntegrationPolicy(SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.setDesiredState, [inherited]).accepted).toBe(false);
  });

  it('accepts only safe center and receipt projections', () => {
    expect(evaluateIpcIntegrationResultPolicy(SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.getCenter, center).accepted).toBe(true);
    expect(evaluateIpcIntegrationResultPolicy(SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.setDesiredState, receipt).accepted).toBe(true);
    for (const extra of [
      { manifestSha256: 'a'.repeat(64) }, { signerKeyId: 'plugin-root' }, { publicKeyPem: 'PUBLIC KEY' },
      { egressHosts: ['api.example.com'] }, { packagePath: 'C:\\plugins\\bank.zip' }
    ]) {
      expect(evaluateIpcIntegrationResultPolicy(SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.getCenter, { ...center, ...extra }).accepted)
        .toBe(false);
    }
    expect(evaluateIpcIntegrationResultPolicy(SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.setDesiredState,
      { ...receipt, policyReceiptHash: 'b'.repeat(64) }).accepted).toBe(false);
  });

  it('keeps reads cancellable and durable writes non-cancellable and bounded', () => {
    expect(resolveIpcRequestLifecyclePolicy(SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.getCenter))
      .toMatchObject({ cancellable: true, latestWins: true, timeoutMs: 10_000 });
    for (const channel of Object.values(SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS)
      .filter((value) => value !== SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.getCenter)) {
      expect(resolveIpcRequestLifecyclePolicy(channel)).toMatchObject({ cancellable: false, latestWins: false, timeoutMs: 0 });
      expect(resolveIpcRequestRatePolicy(channel)).toMatchObject({ enabled: true, maxRequestsPerWindow: 10, windowMs: 60_000 });
      expect(resolveIpcRequestAdmissionPolicy(channel)).toMatchObject({
        enabled: true, maxConcurrentPerChannel: 1, maxQueuedPerSender: 4
      });
    }
  });

  it('registers and exposes no installation or signing-authority bridge', () => {
    const main = readFileSync('apps/desktop/src/main/main.ts', 'utf8');
    const preload = readFileSync('apps/desktop/src/main/preload.ts', 'utf8');
    const globalTypes = readFileSync('apps/desktop/src/renderer/global.d.ts', 'utf8');
    for (const channel of Object.values(SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS)) expect(main + preload).toContain(channel);
    for (const method of [
      'getSignedPluginPlatformCenter', 'setSignedPluginDesiredState', 'emergencyDisableSignedPlugin', 'rollbackSignedPlugin'
    ]) expect(preload + globalTypes).toContain(method);
    for (const forbidden of [
      'registerSignedPluginManifest', 'installSignedPlugin', 'setPluginSigningKey', 'readSignedPluginPackage'
    ]) expect(preload + globalTypes).not.toContain(forbidden);
  });
});
