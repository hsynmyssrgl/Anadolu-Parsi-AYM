import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  HOUSEHOLD_OPERATIONS_IPC_CHANNELS,
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy
} from '../src/main/ipc-integration-policy.js';
import {
  resolveIpcRequestAdmissionPolicy,
  resolveIpcRequestLifecyclePolicy,
  resolveIpcRequestRatePolicy
} from '../src/main/ipc-request-lifecycle.js';
import { resolveIpcReadSharingPolicy } from '../src/main/ipc-read-sharing.js';

const NOW = '2026-08-15T15:00:00.000Z';
const CENTER_ID = 'household-operations-center:family-33-t';
const OWNER_PERSON_ID = 'person-33-t-owner';

const item = {
  id: 'household-item-33-t',
  centerId: CENTER_ID,
  ownerPersonId: OWNER_PERSON_ID,
  kind: 'shared_expense',
  area: 'expenses',
  title: 'Ortak market gideri',
  status: 'due',
  revision: 1,
  amountMinor: 12_500,
  currency: 'TRY',
  splitShares: [
    { personId: OWNER_PERSON_ID, basisPoints: 6_000 },
    { personId: 'person-33-t-member', basisPoints: 4_000 }
  ],
  createdAt: NOW,
  updatedAt: NOW
} as const;

const center = {
  schemaVersion: 1,
  centerId: CENTER_ID,
  revision: 1,
  items: [item],
  countsByArea: {
    shopping: 0,
    inventory: 0,
    meals: 0,
    chores: 0,
    expenses: 1,
    deliveries: 0,
    guests: 0,
    pets: 0
  },
  truth: {
    localOnly: true,
    externalShoppingOrder: 'not_performed',
    automaticInventoryScan: 'not_configured',
    recipeMedicalAdvice: 'not_provided',
    paymentExecution: 'not_performed',
    carrierSynchronization: 'not_performed',
    remoteAccessControl: 'not_configured',
    keyCodeStored: false,
    petCareDelivery: 'not_performed'
  },
  generatedAt: NOW
} as const;

const receipt = {
  centerId: CENTER_ID,
  itemId: item.id,
  mutationKind: 'item_create',
  previousCenterRevision: 0,
  centerRevision: 1,
  previousItemRevision: 0,
  itemRevision: 1,
  occurredAt: NOW,
  replayed: false,
  localOnly: true,
  externalAction: 'not_performed'
} as const;

describe('33-T household operations IPC boundary', () => {
  it('accepts exact zero-argument reads and bounded item mutations', () => {
    expect(evaluateIpcIntegrationPolicy(HOUSEHOLD_OPERATIONS_IPC_CHANNELS.getCenter, []))
      .toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy(HOUSEHOLD_OPERATIONS_IPC_CHANNELS.createItem, [{
      expectedCenterRevision: 0,
      clientOperationId: 'operation-household-create-33-t',
      itemId: item.id,
      kind: 'shared_expense',
      title: item.title,
      status: 'due',
      amountMinor: 12_500,
      currency: 'TRY',
      splitShares: item.splitShares
    }])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy(HOUSEHOLD_OPERATIONS_IPC_CHANNELS.updateItem, [{
      expectedCenterRevision: 1,
      expectedItemRevision: 1,
      clientOperationId: 'operation-household-update-33-t',
      itemId: item.id,
      status: 'completed'
    }])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy(HOUSEHOLD_OPERATIONS_IPC_CHANNELS.deleteItem, [{
      expectedCenterRevision: 2,
      expectedItemRevision: 2,
      clientOperationId: 'operation-household-delete-33-t',
      itemId: item.id,
      reason: 'Yerel kayıt artık gerekli değil.'
    }])).toEqual({ accepted: true });
  });

  it('rejects renderer authority, external secrets and malformed household semantics', () => {
    expect(evaluateIpcIntegrationPolicy(HOUSEHOLD_OPERATIONS_IPC_CHANNELS.getCenter, [{}]))
      .toMatchObject({ accepted: false });
    for (const forbidden of [
      { accountId: 'account-forged' },
      { familyId: 'family-forged' },
      { policyReceiptHash: 'a'.repeat(64) },
      { sourcePath: 'C:\\private\\household.json' },
      { keyCode: '9271' },
      { fullTrackingId: 'TRK-1234567890' },
      { paymentToken: 'secret-token' }
    ]) {
      expect(evaluateIpcIntegrationPolicy(HOUSEHOLD_OPERATIONS_IPC_CHANNELS.createItem, [{
        expectedCenterRevision: 0,
        clientOperationId: 'operation-household-forged-33-t',
        itemId: 'household-item-forged-33-t',
        kind: 'shopping_item',
        title: 'Ekmek',
        ...forbidden
      }])).toMatchObject({ accepted: false });
    }
    expect(evaluateIpcIntegrationPolicy(HOUSEHOLD_OPERATIONS_IPC_CHANNELS.createItem, [{
      expectedCenterRevision: 0,
      clientOperationId: 'operation-household-split-33-t',
      itemId: 'household-expense-invalid-33-t',
      kind: 'shared_expense',
      title: 'Eksik paylaşım',
      amountMinor: 1_000,
      currency: 'TRY',
      splitShares: [
        { personId: OWNER_PERSON_ID, basisPoints: 5_000 },
        { personId: 'person-33-t-member', basisPoints: 4_999 }
      ]
    }])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('householdOperations:future', []))
      .toMatchObject({ accepted: false, reason: 'UNKNOWN_IPC_CHANNEL' });
  });

  it('accepts safe results and rejects repository, payment or remote-control overclaims', () => {
    expect(evaluateIpcIntegrationResultPolicy(HOUSEHOLD_OPERATIONS_IPC_CHANNELS.getCenter, center))
      .toEqual({ accepted: true });
    expect(evaluateIpcIntegrationResultPolicy(HOUSEHOLD_OPERATIONS_IPC_CHANNELS.createItem, receipt))
      .toEqual({ accepted: true });
    for (const forged of [
      { ...center, familyId: 'family-private' },
      { ...center, items: [{ ...item, policyReceiptHash: 'a'.repeat(64) }] },
      { ...center, items: [{ ...item, paymentToken: 'secret' }] },
      { ...center, truth: { ...center.truth, remoteAccessControl: 'configured' } },
      { ...receipt, stateFingerprint: 'b'.repeat(64) },
      { ...receipt, externalAction: 'performed' }
    ]) {
      const channel = 'mutationKind' in forged
        ? HOUSEHOLD_OPERATIONS_IPC_CHANNELS.createItem
        : HOUSEHOLD_OPERATIONS_IPC_CHANNELS.getCenter;
      expect(evaluateIpcIntegrationResultPolicy(channel, forged)).toMatchObject({ accepted: false });
    }
  });

  it('keeps reads non-cacheable and serializes durable writes with explicit rate limits', () => {
    const read = HOUSEHOLD_OPERATIONS_IPC_CHANNELS.getCenter;
    expect(resolveIpcRequestLifecyclePolicy(read)).toEqual({ cancellable: true, latestWins: true, timeoutMs: 10_000 });
    expect(resolveIpcReadSharingPolicy(read).enabled).toBe(false);
    expect(resolveIpcRequestRatePolicy(read)).toEqual({ enabled: true, maxRequestsPerWindow: 60, windowMs: 60_000 });
    for (const channel of [
      HOUSEHOLD_OPERATIONS_IPC_CHANNELS.createItem,
      HOUSEHOLD_OPERATIONS_IPC_CHANNELS.updateItem,
      HOUSEHOLD_OPERATIONS_IPC_CHANNELS.deleteItem
    ]) {
      expect(resolveIpcRequestLifecyclePolicy(channel)).toEqual({ cancellable: false, latestWins: false, timeoutMs: 0 });
      expect(resolveIpcRequestRatePolicy(channel)).toEqual({ enabled: true, maxRequestsPerWindow: 16, windowMs: 60_000 });
      expect(resolveIpcRequestAdmissionPolicy(channel)).toMatchObject({ enabled: true, maxConcurrentPerChannel: 1 });
    }
  });

  it('pins the four main, preload and renderer bridge methods without policy authority', () => {
    const main = readFileSync('apps/desktop/src/main/main.ts', 'utf8');
    const preload = readFileSync('apps/desktop/src/main/preload.ts', 'utf8');
    const globalTypes = readFileSync('apps/desktop/src/renderer/global.d.ts', 'utf8');
    for (const [name, channel] of Object.entries(HOUSEHOLD_OPERATIONS_IPC_CHANNELS)) {
      expect(main).toContain(`HOUSEHOLD_OPERATIONS_IPC_CHANNELS.${name}`);
      expect(preload).toContain(`invoke('${channel}'`);
    }
    for (const method of [
      'getHouseholdOperationsCenter',
      'createHouseholdOperationItem',
      'updateHouseholdOperationItem',
      'deleteHouseholdOperationItem'
    ]) expect(globalTypes).toContain(method);
    expect(preload).not.toContain('householdOperationsPolicyReceipt');
    expect(globalTypes).not.toContain('HouseholdOperationsPolicyReceipt');
  });
});
