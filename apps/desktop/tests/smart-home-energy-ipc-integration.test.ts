import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SMART_HOME_ENERGY_IPC_CHANNELS,
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
  resourceType: 'smart_home_camera_consent', resourceId: 'consent-33-y', mutationKind: 'camera_consent_grant',
  previousRevision: 0, revision: 1, occurredAt: NOW, replayed: false, networkUsed: false, cloudUsed: false,
  providerActionPerformed: 'not_performed'
};
const center = {
  schemaVersion: 1, centerId: 'smart-home-energy:family-33-y:person-33-y', ownerPersonId: 'person-33-y',
  devices: [{ id: 'doorbell-33-y', ownerPersonId: 'person-33-y', adapterId: 'adapter-33-y', providerId: 'provider-33-y',
    kind: 'doorbell', label: 'Yerel kapı zili', room: 'Giriş', status: 'active', signedAdapterEvidencePersisted: true,
    revision: 1, createdAt: NOW, updatedAt: NOW }],
  observations: [{ id: 'observation-33-y', deviceId: 'doorbell-33-y', kind: 'door_open', unit: 'boolean',
    booleanValue: true, observedAt: NOW, recordedAt: NOW }],
  observationTotal: 1, observationsTruncated: false,
  cameraConsents: [{ id: 'consent-33-y', deviceId: 'doorbell-33-y', purpose: 'doorbell_answer', status: 'active',
    grantedByAccountId: 'account-33-y', grantedByPersonId: 'person-33-y', visibleIndicatorRequired: true,
    expiresAt: '2026-08-15T10:15:00.000Z', revision: 1, createdAt: NOW, updatedAt: NOW }],
  settings: { id: 'smart-home-settings:person-33-y', ownerPersonId: 'person-33-y', processingEnabled: true,
    cameraAccessDefaultDenied: true, hiddenSurveillanceProhibited: true, revision: 1, createdAt: NOW, updatedAt: NOW },
  truth: { localFirst: true, cloudUsed: false, externalDeliveryPerformed: 'not_performed', matterCommissioningPerformed: false,
    liveProviderConnectionTested: false, liveDeviceControlPerformed: false, sensorProviderIngestionPerformed: false,
    rawCameraOrAudioStored: false, hiddenSurveillanceProhibited: true, visibleTimeBoundedCameraConsentRequired: true,
    maximumCameraConsentMinutes: 60, signedAdapterEvidenceRequired: true, providerAvailabilityGuaranteed: false,
    observationPayloadMode: 'bounded_scalar_metadata_only', networkUsedByCurrentImplementation: false }, generatedAt: NOW
};

describe('33-Y smart home and energy IPC boundary', () => {
  it('accepts only the four renderer-safe channels and exact inputs', () => {
    expect(evaluateIpcIntegrationPolicy(SMART_HOME_ENERGY_IPC_CHANNELS.getCenter, []).accepted).toBe(true);
    expect(evaluateIpcIntegrationPolicy(SMART_HOME_ENERGY_IPC_CHANNELS.grantCameraConsent, [{ clientOperationId: 'operation-grant-33-y',
      consentId: 'consent-33-y', deviceId: 'doorbell-33-y', purpose: 'doorbell_answer', expiresAt: '2026-08-15T10:15:00.000Z' }]).accepted).toBe(true);
    expect(evaluateIpcIntegrationPolicy(SMART_HOME_ENERGY_IPC_CHANNELS.revokeCameraConsent, [{ clientOperationId: 'operation-revoke-33-y',
      consentId: 'consent-33-y', expectedRevision: 1 }]).accepted).toBe(true);
    expect(evaluateIpcIntegrationPolicy(SMART_HOME_ENERGY_IPC_CHANNELS.setProcessing, [{ clientOperationId: 'operation-settings-33-y',
      expectedRevision: 0, enabled: true, reason: 'Yerel sensör metadatasını işle.' }]).accepted).toBe(true);
    expect(evaluateIpcIntegrationPolicy('smartHomeEnergy:registerDevice', [{}]).accepted).toBe(false);
  });

  it('rejects renderer-supplied trust evidence, provider observations, paths, secrets and prototypes', () => {
    const base = { clientOperationId: 'operation-grant-33-y', consentId: 'consent-33-y', deviceId: 'doorbell-33-y',
      purpose: 'live_view', expiresAt: '2026-08-15T10:15:00.000Z' };
    for (const extra of [{ adapterSignatureVerified: true }, { adapterManifestSha256: 'a'.repeat(64) },
      { sourceManifestSha256: 'b'.repeat(64) }, { observedAt: NOW }, { path: 'C:\\private.json' }, { token: 'secret-token' }]) {
      expect(evaluateIpcIntegrationPolicy(SMART_HOME_ENERGY_IPC_CHANNELS.grantCameraConsent, [{ ...base, ...extra }]).accepted).toBe(false);
    }
    const inherited = Object.create({ admin: true }) as Record<string, unknown>; Object.assign(inherited, base);
    expect(evaluateIpcIntegrationPolicy(SMART_HOME_ENERGY_IPC_CHANNELS.grantCameraConsent, [inherited]).accepted).toBe(false);
  });

  it('accepts safe center and receipts while rejecting hashes and authorization authority', () => {
    expect(evaluateIpcIntegrationResultPolicy(SMART_HOME_ENERGY_IPC_CHANNELS.getCenter, center).accepted).toBe(true);
    expect(evaluateIpcIntegrationResultPolicy(SMART_HOME_ENERGY_IPC_CHANNELS.grantCameraConsent, receipt).accepted).toBe(true);
    expect(evaluateIpcIntegrationResultPolicy(SMART_HOME_ENERGY_IPC_CHANNELS.getCenter,
      { ...center, adapterManifestSha256: 'a'.repeat(64) }).accepted).toBe(false);
    expect(evaluateIpcIntegrationResultPolicy(SMART_HOME_ENERGY_IPC_CHANNELS.grantCameraConsent,
      { ...receipt, policyReceiptHash: 'b'.repeat(64) }).accepted).toBe(false);
  });

  it('keeps reads cancellable and durable mutations non-cancellable and bounded', () => {
    expect(resolveIpcRequestLifecyclePolicy(SMART_HOME_ENERGY_IPC_CHANNELS.getCenter))
      .toMatchObject({ cancellable: true, latestWins: true, timeoutMs: 10_000 });
    for (const channel of Object.values(SMART_HOME_ENERGY_IPC_CHANNELS).filter(value => value !== SMART_HOME_ENERGY_IPC_CHANNELS.getCenter)) {
      expect(resolveIpcRequestLifecyclePolicy(channel)).toMatchObject({ cancellable: false, latestWins: false, timeoutMs: 0 });
      expect(resolveIpcRequestRatePolicy(channel)).toMatchObject({ enabled: true, maxRequestsPerWindow: 12, windowMs: 60_000 });
      expect(resolveIpcRequestAdmissionPolicy(channel)).toMatchObject({ enabled: true, maxConcurrentPerChannel: 1, maxQueuedPerSender: 4 });
    }
  });

  it('registers and exposes only the four safe bridge methods', () => {
    const main = readFileSync('apps/desktop/src/main/main.ts', 'utf8');
    const preload = readFileSync('apps/desktop/src/main/preload.ts', 'utf8');
    const globalTypes = readFileSync('apps/desktop/src/renderer/global.d.ts', 'utf8');
    for (const channel of Object.values(SMART_HOME_ENERGY_IPC_CHANNELS)) expect(main + preload).toContain(channel);
    for (const method of ['getSmartHomeEnergyCenter', 'grantSmartHomeCameraConsent', 'revokeSmartHomeCameraConsent', 'setSmartHomeProcessing'])
      expect(preload + globalTypes).toContain(method);
    for (const forbidden of ['registerSmartHomeDevice', 'recordSmartHomeObservation', 'updateSmartHomeDeviceStatus',
      'readSmartHomeCameraBytes', 'getSmartHomeAdapterManifest']) expect(preload + globalTypes).not.toContain(forbidden);
  });
});
