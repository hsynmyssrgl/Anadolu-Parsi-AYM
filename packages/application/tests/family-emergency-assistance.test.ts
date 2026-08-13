import { describe, expect, it } from 'vitest';
import type { RecordManagedLifeItemInput } from '@ppt/domain';
import {
  RecordManagedLifeItemUseCase,
  buildManagedLifeWorkspace,
  inspectManagedLifeDataContract,
  type FamilyEmergencyAssistanceProfileWriteRecord,
  type FamilyEmergencyAssistanceWriteRecord,
  type FamilyEmergencyPlanWriteRecord,
  type LifeApplicationContext,
  type LifePolicyIntent,
  type LifeUnitOfWork,
  type LifeWriteScope
} from '../src/life-use-cases.js';

const occurredAt = '2026-08-13T12:00:00.000Z' as never;
const plan:FamilyEmergencyPlanWriteRecord = {
  id: 'plan-1',
  familyId: 'family-1' as never,
  ownerPersonId: 'person-1' as never,
  itemType: 'emergency_plan',
  planKind: 'general',
  title: 'Family emergency plan',
  evacuationInstructions: 'Use the safe exit.',
  privacy: 'family',
  dataSource: 'manual',
  createdAt: '2026-08-01T00:00:00.000Z' as never
};
const profile:FamilyEmergencyAssistanceProfileWriteRecord = {
  id: 'profile-1',
  familyId: 'family-1' as never,
  ownerPersonId: 'person-2' as never,
  planId: 'plan-1',
  itemType: 'emergency_profile',
  label: 'Private emergency card',
  subjectKind: 'person',
  subjectPersonId: 'person-2',
  privacy: 'private',
  dataSource: 'manual',
  createdAt: '2026-08-02T00:00:00.000Z' as never
};
const context:LifeApplicationContext = {
  familyId: 'family-1' as never,
  actor: { userId: 'user-1' as never, role: 'adult_member', personId: 'person-1' as never },
  correlationId: '33-i-test' as never
};
const identifiers = { itemId: 'new-item', auditId: 'audit-1', outboxEventId: 'event-1' as never };

const makeScope = (input:{
  readonly items?:readonly FamilyEmergencyAssistanceWriteRecord[];
  readonly activePersonIds?:readonly string[];
  readonly findPlan?:(id:string)=>ReturnType<LifeWriteScope['findFamilyEmergencyPlan']>;
  readonly authorize?:LifeWriteScope['authorize'];
  readonly saved?:(item:FamilyEmergencyAssistanceWriteRecord)=>void;
  readonly audit?:(value:unknown)=>void;
  readonly event?:(value:unknown)=>void;
} = {}):LifeWriteScope => {
  const items = input.items ?? [profile];
  const activeIds = new Set(input.activePersonIds ?? ['person-1','person-2']);
  return {
    occurredAt,
    findPerson: (id) => ({
      ok: true,
      value: activeIds.has(id)
        ? { id, familyId: 'family-1' as never, status: 'active' }
        : null
    }),
    authorize: input.authorize ?? (() => ({ ok: true, value: true })),
    insertLifeRecord: () => ({ ok: true, value: undefined }),
    findManagedLifeProfile: () => ({ ok: true, value: null }),
    insertManagedLifeItem: () => ({ ok: true, value: undefined }),
    findManagedHomeInventoryItem: () => ({ ok: true, value: null }),
    findLatestManagedHomeMeterReading: () => ({ ok: true, value: null }),
    insertManagedHomeInventoryItem: () => ({ ok: true, value: undefined }),
    findFamilyEmergencyPlan: input.findPlan ?? ((id) => ({
      ok: true,
      value: id === plan.id ? plan : null
    })),
    findFamilyEmergencyItem: () => ({ ok: true, value: null }),
    insertFamilyEmergencyItem: () => ({ ok: true, value: undefined }),
    findFamilyEmergencyPreparednessItem: () => ({ ok: true, value: null }),
    insertFamilyEmergencyPreparednessItem: () => ({ ok: true, value: undefined }),
    findFamilyEmergencyAssistanceProfile: (id) => ({
      ok: true,
      value: items.find((item):item is FamilyEmergencyAssistanceProfileWriteRecord =>
        item.itemType === 'emergency_profile' && item.id === id) ?? null
    }),
    findFamilyEmergencyAssistanceItem: (id) => ({
      ok: true,
      value: items.find((item) => item.id === id) ?? null
    }),
    insertFamilyEmergencyAssistanceItem: (item) => {
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

describe('33-I private family emergency assistance boundary', () => {
  it('accepts only exact discriminated variants and rejects recursive secrets, PAN, paths and base64', () => {
    const commands:readonly RecordManagedLifeItemInput[] = [
      {
        itemType: 'emergency_profile', planId: 'plan-1', label: 'Person card',
        subjectKind: 'person', subjectPersonId: 'person-2'
      },
      {
        itemType: 'emergency_profile', planId: 'plan-1', label: 'Pet card',
        subjectKind: 'pet', subjectPetId: 'pet-1', responsiblePersonId: 'person-2'
      },
      {
        itemType: 'health_fact', profileId: 'profile-1', factKind: 'blood_type',
        bloodType: 'o_positive'
      },
      {
        itemType: 'health_fact', profileId: 'profile-1', factKind: 'allergy', value: 'Peanut'
      },
      {
        itemType: 'emergency_contact', profileId: 'profile-1', name: 'Care contact',
        phoneE164: '+905551234567', relationship: 'Sibling'
      },
      {
        itemType: 'assistance_instruction', profileId: 'profile-1', instructionKind: 'mobility',
        instruction: 'Use the evacuation chair.'
      }
    ];
    for (const command of commands) {
      expect(inspectManagedLifeDataContract(command)).toMatchObject({
        accepted: true,
        contractFamily: 'family_emergency_assistance',
        itemType: command.itemType
      });
    }
    expect(inspectManagedLifeDataContract({ ...commands[2], value: 'wrong branch' })).toMatchObject({
      accepted: false, unknownFields: ['$.value']
    });
    expect(inspectManagedLifeDataContract({ ...commands[3], bloodType: 'o_positive' })).toMatchObject({
      accepted: false, unknownFields: ['$.bloodType']
    });
    expect(inspectManagedLifeDataContract({ ...commands[5], apiToken: 'secret' })).toMatchObject({
      accepted: false, prohibitedFields: ['$.apiToken']
    });
    expect(inspectManagedLifeDataContract({ ...commands[3], note: '4111111111111111' })).toMatchObject({
      accepted: false, panLikeValueDetected: true
    });
    expect(inspectManagedLifeDataContract({ ...commands[5], instruction: 'C:\\Users\\person\\card.txt' })).toMatchObject({
      accepted: false, pathLikeValueDetected: true
    });
    expect(inspectManagedLifeDataContract({ ...commands[3], note: 'QUJD'.repeat(32) })).toMatchObject({
      accepted: false, base64LikeValueDetected: true
    });
  });

  it('creates person and pet roots with fixed private ownership through central policy only', async () => {
    let intent:LifePolicyIntent | undefined;
    let authorization:Parameters<LifeWriteScope['authorize']>[0] | undefined;
    let saved:FamilyEmergencyAssistanceWriteRecord | undefined;
    const result = await new RecordManagedLifeItemUseCase(makeUnitOfWork(makeScope({
      authorize: (value) => {
        authorization = value;
        return { ok: true, value: true };
      },
      saved: (value) => { saved = value; }
    }), (value) => { intent = value; })).execute({
      context,
      command: {
        itemType: 'emergency_profile', planId: 'plan-1', label: 'Pet support',
        subjectKind: 'pet', subjectPetId: 'pet-1', responsiblePersonId: 'person-2'
      },
      identifiers: { ...identifiers, itemId: 'profile-pet' }
    });
    expect(result).toMatchObject({
      ok: true,
      value: { id: 'profile-pet', itemType: 'emergency_profile', subjectKind: 'pet' }
    });
    expect(intent).toEqual({
      action: 'create', capability: 'family.write', resourceType: 'life_record',
      resourceId: 'profile-pet', purpose: 'general', ownerPersonId: 'person-2', privacy: 'private'
    });
    expect(authorization).toEqual({
      action: 'create', resourceType: 'life_record', resourceId: 'profile-pet',
      ownerPersonId: 'person-2', privacy: 'private'
    });
    expect(saved).toMatchObject({
      familyId: 'family-1', ownerPersonId: 'person-2', planId: 'plan-1',
      privacy: 'private', dataSource: 'manual', subjectPetId: 'pet-1'
    });

    let deniedSave = false;
    let deniedAuthorization = false;
    const inactiveOwner = await new RecordManagedLifeItemUseCase(makeUnitOfWork(makeScope({
      activePersonIds: ['person-1'],
      authorize: () => {
        deniedAuthorization = true;
        return { ok: true, value: true };
      },
      saved: () => { deniedSave = true; }
    }))).execute({
      context,
      command: {
        itemType: 'emergency_profile', planId: 'plan-1', label: 'Pet support',
        subjectKind: 'pet', subjectPetId: 'pet-1', responsiblePersonId: 'person-2'
      },
      identifiers: { ...identifiers, itemId: 'profile-inactive' }
    });
    expect(inactiveOwner).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(deniedAuthorization).toBe(false);
    expect(deniedSave).toBe(false);
  });

  it('binds children to a private profile update receipt and emits content-free audit/outbox', async () => {
    let intent:LifePolicyIntent | undefined;
    let authorization:Parameters<LifeWriteScope['authorize']>[0] | undefined;
    let saved:FamilyEmergencyAssistanceWriteRecord | undefined;
    let audit:unknown;
    let event:unknown;
    const result = await new RecordManagedLifeItemUseCase(makeUnitOfWork(makeScope({
      findPlan: () => { throw new Error('child receipt must not read the plan root'); },
      authorize: (value) => {
        authorization = value;
        return { ok: true, value: true };
      },
      saved: (value) => { saved = value; },
      audit: (value) => { audit = value; },
      event: (value) => { event = value; }
    }), (value) => { intent = value; })).execute({
      context,
      command: {
        itemType: 'health_fact', profileId: 'profile-1', factKind: 'allergy',
        value: 'Sensitive allergy detail', note: 'Private health note'
      },
      identifiers
    });
    expect(result).toMatchObject({
      ok: true,
      value: { itemType: 'health_fact', profileId: 'profile-1', factKind: 'allergy' }
    });
    expect(intent).toEqual({
      action: 'update', capability: 'family.write', resourceType: 'life_record',
      resourceId: 'profile-1', purpose: 'general'
    });
    expect(authorization).toEqual({
      action: 'update', resourceType: 'life_record', resourceId: 'profile-1',
      ownerPersonId: 'person-2', privacy: 'private'
    });
    expect(saved).toMatchObject({
      familyId: 'family-1', ownerPersonId: 'person-2', planId: 'plan-1',
      profileId: 'profile-1', privacy: 'private', dataSource: 'manual'
    });
    expect(audit).toMatchObject({ resourceId: 'profile-1' });
    expect(event).toMatchObject({
      aggregateId: 'profile-1',
      payload: { itemId: 'new-item', recordId: 'profile-1', privacy: 'private' }
    });
    expect(event).not.toHaveProperty('payload.itemType');
    expect(JSON.stringify({ audit, event })).not.toMatch(
      /health_fact|allergy|blood_type|emergency_contact|assistance_instruction|Sensitive|Private health note/u
    );

    let deniedSave = false;
    const denied = await new RecordManagedLifeItemUseCase(makeUnitOfWork(makeScope({
      authorize: () => ({ ok: true, value: false }),
      saved: () => { deniedSave = true; }
    }))).execute({
      context,
      command: {
        itemType: 'assistance_instruction', profileId: 'profile-1',
        instructionKind: 'evacuation', instruction: 'Use the east exit.'
      },
      identifiers
    });
    expect(denied).toMatchObject({ ok: false, error: { category: 'authorization' } });
    expect(deniedSave).toBe(false);

    let fakeAuthorization = false;
    let fakeSave = false;
    const fakeProfile:FamilyEmergencyAssistanceProfileWriteRecord = {
      ...profile,
      familyId: 'family-other' as never
    };
    const invalidRoot = await new RecordManagedLifeItemUseCase(makeUnitOfWork(makeScope({
      items: [fakeProfile],
      findPlan: () => { throw new Error('invalid child root must not read the plan'); },
      authorize: () => {
        fakeAuthorization = true;
        return { ok: true, value: true };
      },
      saved: () => { fakeSave = true; }
    }))).execute({
      context,
      command: {
        itemType: 'health_fact', profileId: 'profile-1', factKind: 'allergy', value: 'Peanut'
      },
      identifiers
    });
    expect(invalidRoot).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(fakeAuthorization).toBe(false);
    expect(fakeSave).toBe(false);
  });

  it('rejects cross-profile and cross-subtype supersession', async () => {
    const priorAllergy:FamilyEmergencyAssistanceWriteRecord = {
      id: 'fact-1', familyId: 'family-1' as never, ownerPersonId: 'person-2' as never,
      planId: 'plan-1', profileId: 'profile-1', itemType: 'health_fact', factKind: 'allergy',
      value: 'Peanut', privacy: 'private', dataSource: 'manual',
      createdAt: '2026-08-03T00:00:00.000Z' as never
    };
    const crossProfile:FamilyEmergencyAssistanceWriteRecord = {
      ...priorAllergy,
      id: 'fact-cross',
      profileId: 'profile-other'
    };
    for (const supersedesItemId of ['fact-1','fact-cross']) {
      let saved = false;
      const result = await new RecordManagedLifeItemUseCase(makeUnitOfWork(makeScope({
        items: [profile, priorAllergy, crossProfile],
        saved: () => { saved = true; }
      }))).execute({
        context,
        command: {
          itemType: 'health_fact', profileId: 'profile-1', supersedesItemId,
          factKind: 'chronic_condition', value: 'Asthma'
        },
        identifiers
      });
      expect(result).toMatchObject({ ok: false, error: { category: 'validation' } });
      expect(saved).toBe(false);
    }
  });

  it('projects only current root-bound private data with explicit no-external-action truth', () => {
    const common = {
      familyId: 'family-1' as never,
      ownerPersonId: 'person-2' as never,
      planId: 'plan-1',
      profileId: 'profile-1',
      privacy: 'private' as const,
      dataSource: 'manual' as const
    };
    const assistanceItems:FamilyEmergencyAssistanceWriteRecord[] = [
      profile,
      { ...common, id: 'contact-old', itemType: 'emergency_contact', name: 'Old contact',
        phoneE164: '+905550000001', createdAt: '2026-08-03T00:00:00.000Z' as never },
      { ...common, id: 'contact-new', itemType: 'emergency_contact', supersedesItemId: 'contact-old',
        name: 'Current contact', phoneE164: '+905550000002', relationship: 'Sibling',
        createdAt: '2026-08-04T00:00:00.000Z' as never },
      { ...common, id: 'fact-1', itemType: 'health_fact', factKind: 'blood_type',
        bloodType: 'a_positive', createdAt: '2026-08-05T00:00:00.000Z' as never },
      { ...common, id: 'instruction-1', itemType: 'assistance_instruction', instructionKind: 'mobility',
        instruction: 'Use the evacuation chair.', createdAt: '2026-08-06T00:00:00.000Z' as never },
      { ...common, id: 'rogue-contact', ownerPersonId: 'person-3' as never,
        itemType: 'emergency_contact', name: 'Rogue contact', phoneE164: '+905550000003',
        createdAt: '2026-08-07T00:00:00.000Z' as never }
    ];
    const workspace = buildManagedLifeWorkspace({
      items: [],
      assistanceItems,
      generatedAt: '2026-08-13T00:00:00.000Z'
    });
    expect(workspace.emergencyAssistanceProfiles).toHaveLength(1);
    expect(workspace.emergencyAssistanceProfiles[0]).toMatchObject({
      id: 'profile-1', privacy: 'private', dataSource: 'manual',
      healthFacts: [{ factKind: 'blood_type', bloodType: 'a_positive' }],
      emergencyContacts: [{ id: 'contact-new', phoneE164: '+905550000002' }],
      assistanceInstructions: [{ instructionKind: 'mobility' }]
    });
    expect(workspace).toMatchObject({
      dataSource: 'manual', offlineAvailability: 'local_only',
      medicalVerification: 'not_performed', healthRegistryLookup: 'not_performed',
      externalDelivery: 'not_performed', localExport: 'user_authorized_only',
      cloudUpload: 'not_performed', messageDelivery: 'not_performed',
      emergencyServiceContact: 'not_performed', networkEgressAdded: false
    });
    const serialized = JSON.stringify(workspace);
    expect(serialized).not.toMatch(/Old contact|905550000001|Rogue contact|905550000003/u);
    expect(serialized).not.toMatch(/familyId|policyReceipt|receiptHash/u);
  });
});
