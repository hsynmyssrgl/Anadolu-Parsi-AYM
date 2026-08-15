import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  HEALTH_CARE_COORDINATION_IPC_CHANNELS,
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy
} from '../src/main/ipc-integration-policy.js';
import {
  resolveIpcRequestAdmissionPolicy,
  resolveIpcRequestLifecyclePolicy,
  resolveIpcRequestRatePolicy
} from '../src/main/ipc-request-lifecycle.js';
import { resolveIpcReadSharingPolicy } from '../src/main/ipc-read-sharing.js';

const NOW = '2026-08-15T14:00:00.000Z';
const OWNER_PERSON = 'person-33-s-owner';
const CENTER_ID = `health-care-center:${OWNER_PERSON}`;
const entry = {
  id: 'health-care-entry-33-s',
  centerId: CENTER_ID,
  ownerPersonId: OWNER_PERSON,
  kind: 'allergy',
  accessScope: 'emergency_summary',
  title: 'Penisilin alerjisi',
  status: 'active',
  occurredAt: NOW,
  note: 'Acil kartta gösterilir.',
  recordedBy: 'owner',
  source: 'manual_local',
  createdAt: NOW
} as const;
const grant = {
  id: 'grant-33-s',
  centerId: CENTER_ID,
  ownerPersonId: OWNER_PERSON,
  caregiverAccountId: 'account-33-s-caregiver',
  caregiverPersonId: 'person-33-s-caregiver',
  allowedScopes: ['appointments', 'measurements'],
  actions: ['read', 'record'],
  state: 'active',
  startsAt: NOW,
  revision: 1,
  createdAt: NOW,
  updatedAt: NOW
} as const;
const center = {
  schemaVersion: 1,
  centerId: CENTER_ID,
  ownerPersonId: OWNER_PERSON,
  revision: 2,
  entries: [entry],
  caregiverGrants: [grant],
  emergencySummary: {
    allergies: [entry],
    chronicConditions: [],
    activeMedicationConfirmations: []
  },
  visibleScopes: [
    'emergency_summary','care_plan','medication','appointments','measurements','check_ins','alerts','contacts','documents'
  ],
  canRecord: true,
  truncated: false,
  truth: {
    localOnly: true,
    medicalVerification: 'not_performed',
    healthRegistryLookup: 'not_performed',
    sensorIntegration: 'not_configured',
    helpDelivery: 'not_performed',
    emergencyServiceContact: 'not_performed',
    remoteAssistance: 'not_configured',
    minimumNecessaryFiltered: true,
    largeTextPresentationAvailable: true
  },
  generatedAt: NOW
} as const;
const receipt = {
  centerId: CENTER_ID,
  mutationKind: 'entry_record',
  previousRevision: 1,
  revision: 2,
  occurredAt: NOW,
  replayed: false,
  localOnly: true,
  externalDelivery: 'not_performed'
} as const;

describe('33-S health care coordination IPC boundary', () => {
  it('accepts the four exact renderer inputs and rejects authority or unknown fields', () => {
    expect(evaluateIpcIntegrationPolicy(HEALTH_CARE_COORDINATION_IPC_CHANNELS.getCenter, [{ ownerPersonId: OWNER_PERSON }]))
      .toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy(HEALTH_CARE_COORDINATION_IPC_CHANNELS.recordEntry, [{
      ownerPersonId: OWNER_PERSON,
      expectedRevision: 1,
      clientOperationId: 'operation-health-care-entry-33-s',
      kind: 'blood_pressure',
      title: 'Tansiyon ölçümü',
      status: 'observed',
      occurredAt: NOW,
      measurement: { value: 125, secondaryValue: 78, unit: 'mmHg' }
    }])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy(HEALTH_CARE_COORDINATION_IPC_CHANNELS.upsertGrant, [{
      ownerPersonId: OWNER_PERSON,
      expectedRevision: 2,
      clientOperationId: 'operation-health-care-grant-33-s',
      grantId: 'grant-33-s',
      caregiverAccountId: 'account-33-s-caregiver',
      allowedScopes: ['appointments', 'measurements'],
      actions: ['read', 'record'],
      startsAt: NOW
    }])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy(HEALTH_CARE_COORDINATION_IPC_CHANNELS.revokeGrant, [{
      ownerPersonId: OWNER_PERSON,
      expectedRevision: 3,
      clientOperationId: 'operation-health-care-revoke-33-s',
      grantId: 'grant-33-s'
    }])).toEqual({ accepted: true });

    for (const forged of [
      { ownerPersonId: OWNER_PERSON, accountId: 'forged-actor' },
      { ownerPersonId: OWNER_PERSON, familyId: 'forged-family' },
      { ownerPersonId: OWNER_PERSON, policyReceiptHash: 'a'.repeat(64) },
      { ownerPersonId: OWNER_PERSON, sourcePath: 'C:\\private\\health.json' }
    ]) expect(evaluateIpcIntegrationPolicy(HEALTH_CARE_COORDINATION_IPC_CHANNELS.getCenter, [forged]))
      .toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('healthCare:future', [])).toMatchObject({
      accepted: false, reason: 'UNKNOWN_IPC_CHANNEL'
    });
  });

  it('rejects nested accessors, malformed measurements and invalid grant scope combinations', () => {
    const measurement: Record<string, unknown> = { value: 125, unit: 'mmHg' };
    Object.defineProperty(measurement, 'secondaryValue', { enumerable: true, get: () => 78 });
    expect(evaluateIpcIntegrationPolicy(HEALTH_CARE_COORDINATION_IPC_CHANNELS.recordEntry, [{
      ownerPersonId: OWNER_PERSON,
      expectedRevision: 1,
      clientOperationId: 'operation-health-care-entry-33-s',
      kind: 'blood_pressure',
      title: 'Tansiyon ölçümü',
      status: 'observed',
      occurredAt: NOW,
      measurement
    }])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy(HEALTH_CARE_COORDINATION_IPC_CHANNELS.upsertGrant, [{
      ownerPersonId: OWNER_PERSON,
      expectedRevision: 2,
      clientOperationId: 'operation-health-care-grant-33-s',
      grantId: 'grant-33-s',
      caregiverAccountId: 'account-33-s-caregiver',
      allowedScopes: ['measurements', 'measurements'],
      actions: ['record'],
      startsAt: NOW
    }])).toMatchObject({ accepted: false });
  });

  it('accepts safe center and mutation results while rejecting repository authority leakage', () => {
    expect(evaluateIpcIntegrationResultPolicy(HEALTH_CARE_COORDINATION_IPC_CHANNELS.getCenter, center))
      .toEqual({ accepted: true });
    expect(evaluateIpcIntegrationResultPolicy(HEALTH_CARE_COORDINATION_IPC_CHANNELS.recordEntry, receipt))
      .toEqual({ accepted: true });
    for (const forged of [
      { ...center, familyId: 'family-forged' },
      { ...center, entries: [{ ...entry, recordedByAccountId: 'account-private' }] },
      { ...center, caregiverGrants: [{ ...grant, mutationId: 'mutation-private' }] },
      { ...receipt, stateFingerprint: 'a'.repeat(64) },
      { ...receipt, externalDelivery: 'delivered' }
    ]) {
      const channel = 'revision' in forged && !('schemaVersion' in forged)
        ? HEALTH_CARE_COORDINATION_IPC_CHANNELS.recordEntry
        : HEALTH_CARE_COORDINATION_IPC_CHANNELS.getCenter;
      expect(evaluateIpcIntegrationResultPolicy(channel, forged)).toMatchObject({ accepted: false });
    }
  });

  it('keeps health reads non-cacheable and writes durable, serialized and rate-bounded', () => {
    const read = HEALTH_CARE_COORDINATION_IPC_CHANNELS.getCenter;
    expect(resolveIpcRequestLifecyclePolicy(read)).toEqual({ cancellable: true, latestWins: true, timeoutMs: 10_000 });
    expect(resolveIpcReadSharingPolicy(read).enabled).toBe(false);
    expect(resolveIpcRequestRatePolicy(read)).toEqual({ enabled: true, maxRequestsPerWindow: 60, windowMs: 60_000 });
    for (const channel of [
      HEALTH_CARE_COORDINATION_IPC_CHANNELS.recordEntry,
      HEALTH_CARE_COORDINATION_IPC_CHANNELS.upsertGrant,
      HEALTH_CARE_COORDINATION_IPC_CHANNELS.revokeGrant
    ]) {
      expect(resolveIpcRequestLifecyclePolicy(channel)).toEqual({ cancellable: false, latestWins: false, timeoutMs: 0 });
      expect(resolveIpcRequestRatePolicy(channel)).toEqual({ enabled: true, maxRequestsPerWindow: 16, windowMs: 60_000 });
      expect(resolveIpcRequestAdmissionPolicy(channel)).toMatchObject({ enabled: true, maxConcurrentPerChannel: 1 });
    }
  });

  it('registers the four exact main/preload/global bridges without renderer policy authority', () => {
    const main = readFileSync('apps/desktop/src/main/main.ts', 'utf8');
    const preload = readFileSync('apps/desktop/src/main/preload.ts', 'utf8');
    const globalTypes = readFileSync('apps/desktop/src/renderer/global.d.ts', 'utf8');
    for (const channel of Object.values(HEALTH_CARE_COORDINATION_IPC_CHANNELS)) {
      expect(main.split(`HEALTH_CARE_COORDINATION_IPC_CHANNELS.${Object.entries(HEALTH_CARE_COORDINATION_IPC_CHANNELS).find(([, value]) => value === channel)?.[0]}`).length - 1)
        .toBeGreaterThanOrEqual(1);
      expect(preload).toContain(`invoke('${channel}'`);
    }
    expect(globalTypes).toContain('getHealthCareCoordinationCenter(input:{readonly ownerPersonId:string})');
    expect(globalTypes).toContain('recordHealthCareEntry(input:RecordHealthCareEntryInput)');
    expect(preload).not.toContain('healthCarePolicyReceipt');
    expect(globalTypes).not.toContain('HealthCarePolicyReceipt');
  });
});
