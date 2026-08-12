import { describe, expect, it } from 'vitest';
import type { RecordManagedLifeItemInput } from '@ppt/domain';
import {
  RecordManagedLifeItemUseCase,
  buildManagedLifeWorkspace,
  inspectManagedLifeDataContract,
  type FamilyEmergencyPlanWriteRecord,
  type FamilyEmergencyWriteRecord,
  type LifeApplicationContext,
  type LifePolicyIntent,
  type LifeUnitOfWork,
  type LifeWriteScope
} from '../src/life-use-cases.js';

const occurredAt = '2026-08-13T12:00:00.000Z' as never;
const plan:FamilyEmergencyPlanWriteRecord = {
  id: 'plan-1', familyId: 'family-1' as never, ownerPersonId: 'person-1' as never,
  itemType: 'emergency_plan', planKind: 'earthquake', title: 'Deprem planı',
  evacuationInstructions: 'Sarsıntı bitince ana çıkıştan güvenle ayrıl.', privacy: 'family',
  dataSource: 'manual', createdAt: '2026-08-01T00:00:00.000Z' as never
};
const context = (role:'family_admin'|'adult_member', personId = 'person-1'):LifeApplicationContext => ({
  familyId: 'family-1' as never,
  actor: { userId: 'user-1' as never, role, personId: personId as never },
  correlationId: '33-g-test' as never
});
const identifiers = { itemId: 'item-1', auditId: 'audit-1', outboxEventId: 'event-1' as never };

const scope = (input: {
  readonly saved?:(item:FamilyEmergencyWriteRecord)=>void;
  readonly event?:(event:unknown)=>void;
  readonly audit?:(audit:unknown)=>void;
  readonly authorize?:LifeWriteScope['authorize'];
} = {}):LifeWriteScope => ({
  occurredAt,
  findPerson: (id) => ({ ok: true, value: { id, familyId: 'family-1' as never, status: 'active' } }),
  authorize: input.authorize ?? (() => ({ ok: true, value: true })),
  insertLifeRecord: () => ({ ok: true, value: undefined }),
  findManagedLifeProfile: () => ({ ok: true, value: null }),
  insertManagedLifeItem: () => ({ ok: true, value: undefined }),
  findManagedHomeInventoryItem: () => ({ ok: true, value: null }),
  findLatestManagedHomeMeterReading: () => ({ ok: true, value: null }),
  insertManagedHomeInventoryItem: () => ({ ok: true, value: undefined }),
  findFamilyEmergencyPlan: () => ({ ok: true, value: plan }),
  findFamilyEmergencyItem: (id) => ({
    ok: true,
    value: id === 'check-1' ? {
      id, familyId: 'family-1' as never, ownerPersonId: 'person-1' as never,
      itemType: 'checklist_item', planId: 'plan-1', label: 'Gazı kapat', sortOrder: 1,
      privacy: 'family', dataSource: 'manual', createdAt: '2026-08-02T00:00:00.000Z' as never
    } : null
  }),
  insertFamilyEmergencyItem: (item) => {
    input.saved?.(item);
    return { ok: true, value: undefined };
  },
  appendAudit: (audit) => {
    input.audit?.(audit);
    return { ok: true, value: 'audit-hash' };
  },
  enqueueEvent: (event) => {
    input.event?.(event);
    return { ok: true, value: undefined };
  }
});
const uow = (writeScope:LifeWriteScope, intent?:(intent:LifePolicyIntent)=>void):LifeUnitOfWork => ({
  execute: async (_context, value, operation) => {
    intent?.(value);
    return operation(writeScope);
  }
});

describe('33-G offline family emergency planning boundary', () => {
  it('accepts only the six exact emergency input variants and keeps strict E.164 useful offline', () => {
    const commands:readonly RecordManagedLifeItemInput[] = [
      { itemType: 'emergency_plan', planKind: 'general', title: 'Aile planı', evacuationInstructions: 'Merdivenleri kullan.' },
      { itemType: 'meeting_point', planId: 'plan-1', meetingPointKind: 'primary', label: 'Okul bahçesi' },
      { itemType: 'external_contact', planId: 'plan-1', name: 'Teyze', phoneE164: '+905551234567', city: 'Ankara' },
      { itemType: 'checklist_item', planId: 'plan-1', label: 'Gazı kapat', sortOrder: 1 },
      { itemType: 'checklist_status', planId: 'plan-1', checklistItemId: 'check-1', status: 'completed' },
      { itemType: 'member_status', planId: 'plan-1', memberPersonId: 'person-1', status: 'safe', occurredAt: '2026-08-13T10:00:00.000Z' }
    ];
    for (const command of commands) {
      expect(inspectManagedLifeDataContract(command)).toMatchObject({
        accepted: true, contractFamily: 'family_emergency', itemType: command.itemType
      });
    }
    expect(inspectManagedLifeDataContract({ ...commands[2], phoneE164: '4111111111111111' })).toMatchObject({
      accepted: false, panLikeValueDetected: true
    });
    expect(inspectManagedLifeDataContract({ ...commands[2], apiToken: 'secret' })).toMatchObject({
      accepted: false, prohibitedFields: ['$.apiToken']
    });
    expect(inspectManagedLifeDataContract({
      ...commands[1], label: `data:text/plain;base64,${'A'.repeat(128)}`
    })).toMatchObject({ accepted: false, base64LikeValueDetected: true });
    expect(inspectManagedLifeDataContract({ ...commands[1], address: 'C:\\Users\\person\\plan.txt' })).toMatchObject({
      accepted: false, pathLikeValueDetected: true
    });
  });

  it('accepts a 240-character meeting label and rejects 241 before persistence', async () => {
    const atLimit = `MP-${'AB-'.repeat(79)}`;
    expect(atLimit).toHaveLength(240);
    const accepted = await new RecordManagedLifeItemUseCase(uow(scope())).execute({
      context: context('family_admin'),
      command: { itemType: 'meeting_point', planId: 'plan-1', meetingPointKind: 'alternate', label: atLimit },
      identifiers
    });
    expect(accepted).toMatchObject({ ok: true });
    let started = false;
    const rejected = await new RecordManagedLifeItemUseCase({ execute: async () => {
      started = true;
      throw new Error('must not start');
    } }).execute({
      context: context('family_admin'),
      command: { itemType: 'meeting_point', planId: 'plan-1', meetingPointKind: 'alternate', label: `${atLimit}Z` },
      identifiers
    });
    expect(rejected).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(started).toBe(false);
  });

  it('binds plan create and child update intents and keeps audit/outbox content-free', async () => {
    let planIntent:LifePolicyIntent | undefined;
    let createdPlan:FamilyEmergencyWriteRecord | undefined;
    const planResult = await new RecordManagedLifeItemUseCase(uow(scope({
      saved: (item) => { createdPlan = item; }
    }), (value) => { planIntent = value; })).execute({
      context: context('family_admin'),
      command: {
        itemType: 'emergency_plan', planKind: 'fire', title: 'Yangın planı',
        evacuationInstructions: 'Merdivenleri kullan ve ana buluşma noktasına git.'
      },
      identifiers: { ...identifiers, itemId: 'plan-new' }
    });
    expect(planResult).toMatchObject({ ok: true, value: { id: 'plan-new', itemType: 'emergency_plan' } });
    expect(planIntent).toEqual({
      action: 'create', capability: 'family.write', resourceType: 'life_record',
      resourceId: 'plan-new', purpose: 'general', ownerPersonId: 'person-1', privacy: 'family'
    });
    expect(createdPlan).toMatchObject({ ownerPersonId: 'person-1', privacy: 'family', dataSource: 'manual' });

    let intent:LifePolicyIntent | undefined;
    let saved:FamilyEmergencyWriteRecord | undefined;
    let audit:unknown;
    let event:unknown;
    const result = await new RecordManagedLifeItemUseCase(uow(scope({
      saved: (item) => { saved = item; },
      audit: (value) => { audit = value; },
      event: (value) => { event = value; }
    }), (value) => { intent = value; })).execute({
      context: context('family_admin'),
      command: { itemType: 'external_contact', planId: 'plan-1', name: 'Teyze', phoneE164: '+905551234567', city: 'Ankara', note: 'Şehir dışı' },
      identifiers
    });
    expect(result).toMatchObject({ ok: true, value: { itemType: 'external_contact', phoneE164: '+905551234567' } });
    expect(intent).toEqual({ action: 'update', capability: 'family.write', resourceType: 'life_record', resourceId: 'plan-1', purpose: 'general' });
    expect(saved).toMatchObject({ ownerPersonId: 'person-1', privacy: 'family', dataSource: 'manual' });
    expect(JSON.stringify({ audit, event })).not.toMatch(/905551234567|Teyze|Ankara|Şehir dışı/u);
  });

  it('binds self and admin on-behalf member status to member-owned create receipts and rejects ordinary impersonation', async () => {
    const execute = async (
      role:'family_admin'|'adult_member',
      reporter:string,
      member:string,
      statusOccurredAt = '2026-08-13T10:00:00.000Z'
    ) => {
      let intent:LifePolicyIntent | undefined;
      let saved:FamilyEmergencyWriteRecord | undefined;
      let audit:unknown;
      let event:unknown;
      const result = await new RecordManagedLifeItemUseCase(uow(scope({
        saved: (item) => { saved = item; },
        audit: (value) => { audit = value; },
        event: (value) => { event = value; },
        authorize: (request) => ({
          ok: true,
          value: role === 'family_admin' || request.ownerPersonId === reporter
        })
      }),
        (value) => { intent = value; })).execute({
        context: context(role, reporter),
        command: { itemType: 'member_status', planId: 'plan-1', memberPersonId: member, status: 'needs_help', occurredAt: statusOccurredAt, note: 'Yardıma ihtiyacım var' },
        identifiers: { ...identifiers, itemId: `status-${reporter}-${member}` }
      });
      return { result, intent, saved, audit, event };
    };
    const self = await execute('adult_member', 'person-1', 'person-1');
    expect(self.result).toMatchObject({ ok: true });
    expect(self.intent).toMatchObject({ action: 'create', resourceId: 'status-person-1-person-1', ownerPersonId: 'person-1', privacy: 'family' });
    expect(self.saved).toMatchObject({ memberPersonId: 'person-1', reportedByPersonId: 'person-1' });
    expect(self.audit).toMatchObject({ resourceId: 'status-person-1-person-1' });
    expect(self.event).toMatchObject({ aggregateId: 'status-person-1-person-1', payload: { recordId: 'plan-1' } });

    const onBehalf = await execute('family_admin', 'person-1', 'person-2');
    expect(onBehalf.result).toMatchObject({ ok: true });
    expect(onBehalf.intent).toMatchObject({ action: 'create', ownerPersonId: 'person-2', privacy: 'family' });
    expect(onBehalf.saved).toMatchObject({ memberPersonId: 'person-2', reportedByPersonId: 'person-1' });

    const denied = await execute('adult_member', 'person-1', 'person-2');
    expect(denied.result).toMatchObject({ ok: false, error: { category: 'authorization' } });
    expect(denied.saved).toBeUndefined();

    const beforePlan = await execute('adult_member', 'person-1', 'person-1', '2026-07-31T23:59:59.999Z');
    expect(beforePlan.result).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(beforePlan.saved).toBeUndefined();
  });

  it('projects current append-only checklist/member truth and explicit no-network guarantees', () => {
    const common = { familyId: 'family-1' as never, privacy: 'family' as const, dataSource: 'manual' as const };
    const emergencyItems:FamilyEmergencyWriteRecord[] = [
      plan,
      { ...common, id: 'check-1', ownerPersonId: 'person-1' as never, itemType: 'checklist_item', planId: 'plan-1', label: 'Gazı kapat', sortOrder: 1, createdAt: '2026-08-02T00:00:00.000Z' as never },
      { ...common, id: 'check-status-1', ownerPersonId: 'person-1' as never, itemType: 'checklist_status', planId: 'plan-1', checklistItemId: 'check-1', status: 'open', createdAt: '2026-08-03T00:00:00.000Z' as never },
      { ...common, id: 'check-status-2', ownerPersonId: 'person-1' as never, itemType: 'checklist_status', planId: 'plan-1', checklistItemId: 'check-1', status: 'completed', createdAt: '2026-08-04T00:00:00.000Z' as never },
      { ...common, id: 'member-1', ownerPersonId: 'person-2' as never, itemType: 'member_status', planId: 'plan-1', memberPersonId: 'person-2' as never, reportedByPersonId: 'person-1' as never, status: 'needs_help', occurredAt: '2026-08-05T00:00:00.000Z' as never, createdAt: '2026-08-05T00:00:00.000Z' as never },
      { ...common, id: 'member-2', ownerPersonId: 'person-2' as never, itemType: 'member_status', planId: 'plan-1', memberPersonId: 'person-2' as never, reportedByPersonId: 'person-2' as never, status: 'safe', occurredAt: '2026-08-06T00:00:00.000Z' as never, createdAt: '2026-08-06T00:00:00.000Z' as never }
    ];
    const workspace = buildManagedLifeWorkspace({ items: [], emergencyItems, generatedAt: '2026-08-13T00:00:00.000Z' });
    expect(workspace.emergencyPlans[0]?.checklistItems[0]?.latestStatus?.status).toBe('completed');
    expect(workspace.emergencyPlans[0]?.latestMemberStatuses).toHaveLength(1);
    expect(workspace.emergencyPlans[0]?.latestMemberStatuses[0]).toMatchObject({ memberPersonId: 'person-2', status: 'safe' });
    expect(workspace).toMatchObject({
      dataSource: 'manual', offlineAvailability: 'local_only', mapLookup: 'not_performed',
      liveLocation: 'not_performed', messageDelivery: 'not_performed', emergencyServiceContact: 'not_performed',
      emergencyServiceGuarantee: 'not_claimed', networkEgressAdded: false
    });
    expect(JSON.stringify(workspace)).not.toMatch(/familyId|policyReceipt|receiptHash/u);
  });
});
