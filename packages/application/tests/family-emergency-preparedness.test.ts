import { describe, expect, it } from 'vitest';
import type { RecordManagedLifeItemInput } from '@ppt/domain';
import {
  RecordManagedLifeItemUseCase,
  buildManagedLifeWorkspace,
  inspectManagedLifeDataContract,
  isExactManagedLifeIsoCalendarDate,
  type FamilyEmergencyPlanWriteRecord,
  type FamilyEmergencyPreparednessWriteRecord,
  type LifeApplicationContext,
  type LifePolicyIntent,
  type LifeUnitOfWork,
  type LifeWriteScope
} from '../src/life-use-cases.js';

const transactionTime = '2026-08-13T12:00:00.000Z' as never;
const plan:FamilyEmergencyPlanWriteRecord = {
  id: 'plan-1', familyId: 'family-1' as never, ownerPersonId: 'person-1' as never,
  itemType: 'emergency_plan', planKind: 'general', title: 'Aile planı',
  evacuationInstructions: 'Ana çıkıştan güvenle ayrıl.', privacy: 'family', dataSource: 'manual',
  createdAt: '2026-08-01T00:00:00.000Z' as never
};
const kit:FamilyEmergencyPreparednessWriteRecord = {
  id: 'kit-1', familyId: 'family-1' as never, ownerPersonId: 'person-1' as never,
  itemType: 'preparedness_kit', planId: 'plan-1', kitKind: 'household_72_hour',
  label: 'Ev 72 saat çantası', privacy: 'family', dataSource: 'manual',
  createdAt: '2026-08-02T00:00:00.000Z' as never
};
const kitItem:FamilyEmergencyPreparednessWriteRecord = {
  id: 'kit-item-1', familyId: 'family-1' as never, ownerPersonId: 'person-1' as never,
  itemType: 'preparedness_kit_item', planId: 'plan-1', kitId: 'kit-1', category: 'water',
  label: 'İçme suyu', targetQuantityMilliunits: 6_000, quantityUnit: 'liter',
  expiresOn: '2027-08-13', privacy: 'family', dataSource: 'manual',
  createdAt: '2026-08-03T00:00:00.000Z' as never
};
const vehicleKit:FamilyEmergencyPreparednessWriteRecord = {
  id: 'kit-2', familyId: 'family-1' as never, ownerPersonId: 'person-1' as never,
  itemType: 'preparedness_kit', planId: 'plan-1', kitKind: 'vehicle', label: 'Araç çantası',
  privacy: 'family', dataSource: 'manual', createdAt: '2026-08-02T01:00:00.000Z' as never
};
const context:LifeApplicationContext = {
  familyId: 'family-1' as never,
  actor: { userId: 'user-1' as never, role: 'family_admin', personId: 'person-1' as never },
  correlationId: '33-h-test' as never
};
const identifiers = { itemId: 'new-item', auditId: 'audit-1', outboxEventId: 'event-1' as never };

const makeScope = (input: {
  readonly preparednessItems?:readonly FamilyEmergencyPreparednessWriteRecord[];
  readonly saved?:(item:FamilyEmergencyPreparednessWriteRecord)=>void;
  readonly audit?:(value:unknown)=>void;
  readonly event?:(value:unknown)=>void;
} = {}):LifeWriteScope => {
  const items = input.preparednessItems ?? [kit, vehicleKit, kitItem];
  return {
    occurredAt: transactionTime,
    findPerson: (id) => ({ ok: true, value: { id, familyId: 'family-1' as never, status: 'active' } }),
    authorize: () => ({ ok: true, value: true }),
    insertLifeRecord: () => ({ ok: true, value: undefined }),
    findManagedLifeProfile: () => ({ ok: true, value: null }),
    insertManagedLifeItem: () => ({ ok: true, value: undefined }),
    findManagedHomeInventoryItem: () => ({ ok: true, value: null }),
    findLatestManagedHomeMeterReading: () => ({ ok: true, value: null }),
    insertManagedHomeInventoryItem: () => ({ ok: true, value: undefined }),
    findFamilyEmergencyPlan: () => ({ ok: true, value: plan }),
    findFamilyEmergencyItem: () => ({ ok: true, value: null }),
    insertFamilyEmergencyItem: () => ({ ok: true, value: undefined }),
    findFamilyEmergencyPreparednessItem: (id) => ({
      ok: true,
      value: items.find((item) => item.id === id) ?? null
    }),
    insertFamilyEmergencyPreparednessItem: (item) => {
      input.saved?.(item);
      return { ok: true, value: undefined };
    },
    appendAudit: (value) => {
      input.audit?.(value);
      return { ok: true, value: 'audit-hash' };
    },
    enqueueEvent: (value) => {
      input.event?.(value);
      return { ok: true, value: undefined };
    }
  };
};
const makeUnitOfWork = (
  scope:LifeWriteScope,
  inspectIntent?:(intent:LifePolicyIntent)=>void
):LifeUnitOfWork => ({
  execute: async (_context, intent, operation) => {
    inspectIntent?.(intent);
    return operation(scope);
  }
});

describe('33-H offline family emergency preparedness boundary', () => {
  it('accepts only the four exact input variants and rejects recursive sensitive payloads', () => {
    const commands:readonly RecordManagedLifeItemInput[] = [
      { itemType: 'preparedness_kit', planId: 'plan-1', kitKind: 'household_72_hour', label: 'Ev çantası' },
      {
        itemType: 'preparedness_kit_item', planId: 'plan-1', kitId: 'kit-1', category: 'water',
        label: 'Su', targetQuantityMilliunits: 6_000, quantityUnit: 'liter', expiresOn: '2028-02-29'
      },
      {
        itemType: 'preparedness_kit_check', planId: 'plan-1', kitItemId: 'kit-item-1',
        status: 'ready', actualQuantityMilliunits: 6_000, checkedAt: '2026-08-13T10:00:00.000Z'
      },
      {
        itemType: 'emergency_drill', planId: 'plan-1', drillKind: 'earthquake', status: 'completed',
        occurredAt: '2026-08-12T10:00:00.000Z', durationSeconds: 300
      }
    ];
    for (const command of commands) {
      expect(inspectManagedLifeDataContract(command)).toMatchObject({
        accepted: true, contractFamily: 'family_emergency_preparedness', itemType: command.itemType
      });
    }
    expect(inspectManagedLifeDataContract({ ...commands[0], apiToken: 'secret' })).toMatchObject({
      accepted: false, prohibitedFields: ['$.apiToken']
    });
    expect(inspectManagedLifeDataContract({ ...commands[2], note: '4111111111111111' })).toMatchObject({
      accepted: false, panLikeValueDetected: true
    });
    expect(inspectManagedLifeDataContract({ ...commands[0], label: 'C:\\Users\\person\\kit.txt' })).toMatchObject({
      accepted: false, pathLikeValueDetected: true
    });
    expect(inspectManagedLifeDataContract({ ...commands[2], note: 'QUJD'.repeat(32) })).toMatchObject({
      accepted: false, base64LikeValueDetected: true
    });
  });

  it('enforces exact calendar dates and bounded integer quantities/durations before policy dispatch', async () => {
    expect(isExactManagedLifeIsoCalendarDate('2028-02-29')).toBe(true);
    expect(isExactManagedLifeIsoCalendarDate('2027-02-29')).toBe(false);
    const invalidCommands:RecordManagedLifeItemInput[] = [
      {
        itemType: 'preparedness_kit_item', planId: 'plan-1', kitId: 'kit-1', category: 'food',
        label: 'Konserve', targetQuantityMilliunits: 1_000, quantityUnit: 'item', expiresOn: '2027-02-29'
      },
      {
        itemType: 'preparedness_kit_item', planId: 'plan-1', kitId: 'kit-1', category: 'food',
        label: 'Konserve', targetQuantityMilliunits: 1.5, quantityUnit: 'item'
      },
      {
        itemType: 'preparedness_kit_check', planId: 'plan-1', kitItemId: 'kit-item-1',
        status: 'low', actualQuantityMilliunits: -1, checkedAt: '2026-08-13T10:00:00.000Z'
      },
      {
        itemType: 'emergency_drill', planId: 'plan-1', drillKind: 'fire', status: 'completed',
        occurredAt: '2026-08-12T10:00:00.000Z', durationSeconds: 604_801
      }
    ];
    for (const command of invalidCommands) {
      let started = false;
      const result = await new RecordManagedLifeItemUseCase({ execute: async () => {
        started = true;
        throw new Error('policy must not start');
      } }).execute({ context, command, identifiers });
      expect(result).toMatchObject({ ok: false, error: { category: 'validation' } });
      expect(started).toBe(false);
    }
  });

  it('binds every preparedness append to the plan update receipt and emits content-free audit/outbox', async () => {
    let intent:LifePolicyIntent | undefined;
    let saved:FamilyEmergencyPreparednessWriteRecord | undefined;
    let audit:unknown;
    let event:unknown;
    const result = await new RecordManagedLifeItemUseCase(makeUnitOfWork(makeScope({
      saved: (value) => { saved = value; },
      audit: (value) => { audit = value; },
      event: (value) => { event = value; }
    }), (value) => { intent = value; })).execute({
      context,
      command: {
        itemType: 'preparedness_kit_item', planId: 'plan-1', kitId: 'kit-1', category: 'first_aid',
        label: 'Özel yara bakım seti', targetQuantityMilliunits: 2_000, quantityUnit: 'item',
        expiresOn: '2028-08-13'
      },
      identifiers
    });
    expect(result).toMatchObject({ ok: true, value: { itemType: 'preparedness_kit_item', planId: 'plan-1' } });
    expect(intent).toEqual({
      action: 'update', capability: 'family.write', resourceType: 'life_record',
      resourceId: 'plan-1', purpose: 'general'
    });
    expect(saved).toMatchObject({
      ownerPersonId: 'person-1', familyId: 'family-1', privacy: 'family', dataSource: 'manual'
    });
    expect(audit).toMatchObject({ resourceId: 'plan-1' });
    expect(event).toMatchObject({ aggregateId: 'plan-1', payload: {
      itemId: 'new-item', recordId: 'plan-1', itemType: 'preparedness_kit_item', privacy: 'family'
    } });
    expect(JSON.stringify({ audit, event })).not.toMatch(/Özel|yara|2028-08-13|2000|first_aid/u);
  });

  it('rejects cross-parent, self-supersession and out-of-plan timestamps', async () => {
    const invalidCommands:RecordManagedLifeItemInput[] = [
      {
        itemType: 'preparedness_kit_item', planId: 'plan-1', kitId: 'missing-kit', category: 'water',
        label: 'Su', targetQuantityMilliunits: 6_000, quantityUnit: 'liter'
      },
      {
        itemType: 'preparedness_kit', planId: 'plan-1', supersedesItemId: 'new-item',
        kitKind: 'vehicle', label: 'Araç çantası'
      },
      {
        itemType: 'preparedness_kit_item', planId: 'plan-1', kitId: 'kit-2',
        supersedesItemId: 'kit-item-1', category: 'water', label: 'Taşınan su',
        targetQuantityMilliunits: 2_000, quantityUnit: 'liter'
      },
      {
        itemType: 'preparedness_kit_check', planId: 'plan-1', kitItemId: 'kit-item-1', status: 'ready',
        actualQuantityMilliunits: 6_000, checkedAt: '2026-07-31T23:59:59.999Z'
      },
      {
        itemType: 'emergency_drill', planId: 'plan-1', drillKind: 'flood', status: 'partial',
        occurredAt: '2026-08-13T12:00:00.001Z'
      }
    ];
    for (const command of invalidCommands) {
      let saved = false;
      const result = await new RecordManagedLifeItemUseCase(makeUnitOfWork(makeScope({
        saved: () => { saved = true; }
      }))).execute({ context, command, identifiers });
      expect(result).toMatchObject({ ok: false, error: { category: 'validation' } });
      expect(saved).toBe(false);
    }
  });

  it('projects active kits/drills and the deterministic latest check without persistence fields', () => {
    const common = {
      familyId: 'family-1' as never, ownerPersonId: 'person-1' as never, planId: 'plan-1',
      privacy: 'family' as const, dataSource: 'manual' as const
    };
    const preparednessItems:FamilyEmergencyPreparednessWriteRecord[] = [
      kit,
      kitItem,
      { ...common, id: 'check-1', itemType: 'preparedness_kit_check', kitItemId: 'kit-item-1',
        status: 'low', actualQuantityMilliunits: 3_000, checkedAt: '2026-08-05T10:00:00.000Z' as never,
        createdAt: '2026-08-05T10:00:00.000Z' as never },
      { ...common, id: 'check-2', itemType: 'preparedness_kit_check', kitItemId: 'kit-item-1',
        status: 'ready', actualQuantityMilliunits: 6_000, checkedAt: '2026-08-06T10:00:00.000Z' as never,
        createdAt: '2026-08-06T10:00:00.000Z' as never },
      { ...common, id: 'drill-1', itemType: 'emergency_drill', drillKind: 'earthquake', status: 'partial',
        occurredAt: '2026-08-07T10:00:00.000Z' as never, createdAt: '2026-08-07T10:00:00.000Z' as never },
      { ...common, id: 'drill-2', itemType: 'emergency_drill', supersedesItemId: 'drill-1',
        drillKind: 'earthquake', status: 'completed', occurredAt: '2026-08-08T10:00:00.000Z' as never,
        durationSeconds: 420, createdAt: '2026-08-08T10:00:00.000Z' as never }
    ];
    const workspace = buildManagedLifeWorkspace({
      items: [], emergencyItems: [plan], preparednessItems, generatedAt: '2026-08-13T00:00:00.000Z'
    });
    expect(workspace.emergencyPlans[0]?.preparednessKits[0]?.items[0]?.latestCheck).toMatchObject({
      id: 'check-2', status: 'ready', actualQuantityMilliunits: 6_000
    });
    expect(workspace.emergencyPlans[0]?.emergencyDrills).toEqual([
      expect.objectContaining({ id: 'drill-2', status: 'completed', durationSeconds: 420 })
    ]);
    expect(workspace).toMatchObject({
      barcodeLookup: 'not_performed', expiryVerification: 'not_performed',
      notificationDelivery: 'not_performed', sensorIntegration: 'not_performed',
      readinessGuarantee: 'not_claimed', networkEgressAdded: false
    });
    expect(JSON.stringify(workspace)).not.toMatch(/familyId|policyReceipt|receiptHash/u);
  });
});
