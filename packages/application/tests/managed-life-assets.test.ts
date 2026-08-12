import { describe, expect, it } from 'vitest';
import type {
  ManagedLifeLedgerItemView,
  ManagedLifeProfileLedgerItemView,
  RecordManagedLifeItemInput
} from '@ppt/domain';
import {
  RecordManagedLifeItemUseCase,
  buildManagedLifeWorkspace,
  inspectManagedLifeDataContract,
  isExactManagedLifeIsoDateTime,
  type LifePolicyIntent,
  type LifeUnitOfWork,
  type LifeWriteScope
} from '../src/life-use-cases.js';

const context = {
  familyId: 'family-1' as never,
  actor: {
    userId: 'user-1' as never,
    role: 'family_admin' as const,
    personId: 'person-1' as never
  },
  correlationId: 'managed-life-test' as never
};

const profileCommands: readonly RecordManagedLifeItemInput[] = [
  {
    itemType: 'profile', ownerPersonId: 'person-1', category: 'insurance', title: 'DASK',
    status: 'active', privacy: 'private', details: { insuranceKind: 'dask', provider: 'Güven Sigorta' }
  },
  {
    itemType: 'profile', ownerPersonId: 'person-1', category: 'subscription', title: 'Elektrik',
    status: 'active', privacy: 'private', details: { provider: 'Yerel Enerji', planName: 'Mesken', billingCycle: 'monthly' }
  },
  {
    itemType: 'profile', ownerPersonId: 'person-1', category: 'education', title: 'Eğitim planı',
    status: 'active', privacy: 'private', details: { institution: 'Yerel Okul', program: 'Lise' }
  },
  {
    itemType: 'profile', ownerPersonId: 'person-1', category: 'employment', title: 'İş sözleşmesi',
    status: 'active', privacy: 'private', details: { employer: 'Örnek İşveren', position: 'Uzman' }
  },
  {
    itemType: 'profile', ownerPersonId: 'person-1', category: 'official_operation', title: 'Resmî başvuru',
    status: 'planned', privacy: 'private', details: { authority: 'Yerel Kurum', operationType: 'Başvuru' }
  },
  {
    itemType: 'profile', ownerPersonId: 'person-1', category: 'home', title: 'Aile evi',
    status: 'active', privacy: 'private', details: { tenure: 'owner', propertyType: 'residence', addressLabel: 'Ana konut' }
  },
  {
    itemType: 'profile', ownerPersonId: 'person-1', category: 'vehicle', title: 'Aile aracı',
    status: 'active', privacy: 'private', details: { vehicleType: 'car', energyType: 'hybrid', plate: '34 ABC 123' }
  }
];

const identifiers = {
  itemId: 'managed-item-1',
  auditId: 'audit-1',
  outboxEventId: 'event-1' as never
};

const vehicleParent: ManagedLifeProfileLedgerItemView & {
  familyId: never;
  ownerPersonId: never;
  createdAt: never;
} = {
  id: 'vehicle-root',
  familyId: 'family-1' as never,
  ownerPersonId: 'person-1' as never,
  itemType: 'profile',
  category: 'vehicle',
  title: 'Aile aracı',
  status: 'active',
  details: { vehicleType: 'car', energyType: 'hybrid' },
  privacy: 'private',
  dataSource: 'manual',
  externalVerification: 'not_performed',
  paymentExecution: 'not_performed',
  createdAt: '2026-08-01T00:00:00.000Z' as never
};

const makeScope = (input: {
  parent?: typeof vehicleParent | null;
  saved?: (item: ManagedLifeLedgerItemView) => void;
  event?: (item: Record<string, unknown>) => void;
} = {}): LifeWriteScope => ({
  occurredAt: '2026-08-12T12:00:00.000Z' as never,
  findPerson: () => ({ ok: true, value: { id: 'person-1' as never } }),
  authorize: () => ({ ok: true, value: true }),
  insertLifeRecord: () => ({ ok: true, value: undefined }),
  findManagedLifeProfile: () => ({ ok: true, value: input.parent === undefined ? vehicleParent : input.parent }),
  insertManagedLifeItem: (item) => {
    input.saved?.(item);
    return { ok: true, value: undefined };
  },
  appendAudit: () => ({ ok: true, value: 'audit-hash' }),
  enqueueEvent: (event) => {
    input.event?.(event as unknown as Record<string, unknown>);
    return { ok: true, value: undefined };
  }
});

const makeUnitOfWork = (
  scope: LifeWriteScope,
  intent?: (value: LifePolicyIntent) => void
): LifeUnitOfWork => ({
  execute: async (_applicationContext, value, operation) => {
    intent?.(value);
    return operation(scope);
  }
});

describe('33-E managed LIFE assets application boundary', () => {
  it('accepts all seven exact category detail contracts', () => {
    for (const command of profileCommands) {
      expect(inspectManagedLifeDataContract(command)).toMatchObject({
        accepted: true,
        itemType: 'profile',
        exactShape: true,
        unknownFields: [],
        missingFields: [],
        prohibitedFields: []
      });
    }
  });

  it('recursively rejects unknown, secret, PAN, path and base64-bearing inputs', () => {
    const base = profileCommands.at(-1)!;
    expect(inspectManagedLifeDataContract({ ...base, futureField: true })).toMatchObject({
      accepted: false, unknownFields: ['$.futureField']
    });
    expect(inspectManagedLifeDataContract({
      ...base,
      details: { ...base.details, credentialToken: 'secret' }
    })).toMatchObject({ accepted: false, prohibitedFields: ['$.details.credentialToken'] });
    expect(inspectManagedLifeDataContract({
      ...base,
      title: 'Araç 4111 1111 1111 1111'
    })).toMatchObject({ accepted: false, panLikeValueDetected: true });
    expect(inspectManagedLifeDataContract({
      ...base,
      details: { vehicleType: 'car', energyType: 'fuel', plate: 'C:\\Users\\person\\document.pdf' }
    })).toMatchObject({ accepted: false, pathLikeValueDetected: true });
    expect(inspectManagedLifeDataContract({
      itemType: 'document', recordId: 'vehicle-root', archiveItemId: 'archive-1', documentKind: 'invoice',
      label: `data:text/plain;base64,${'A'.repeat(128)}`
    })).toMatchObject({ accepted: false, base64LikeValueDetected: true });
  });

  it('uses exact canonical UTC timestamps including exact calendar validation', () => {
    expect(isExactManagedLifeIsoDateTime('2028-02-29T23:59:59.999Z')).toBe(true);
    expect(isExactManagedLifeIsoDateTime('2027-02-29T12:00:00.000Z')).toBe(false);
    expect(isExactManagedLifeIsoDateTime('2026-02-31T12:00:00.000Z')).toBe(false);
    expect(isExactManagedLifeIsoDateTime('2026-08-12T15:00:00+03:00')).toBe(false);
    expect(isExactManagedLifeIsoDateTime('2026-08-12')).toBe(false);
  });

  it('rejects unsafe integer money, quantities and invalid activity matrices before persistence', async () => {
    let transactionStarted = false;
    const unitOfWork: LifeUnitOfWork = {
      execute: async () => {
        transactionStarted = true;
        throw new Error('transaction must not start');
      }
    };
    const useCase = new RecordManagedLifeItemUseCase(unitOfWork);
    const unsafe = await useCase.execute({
      context,
      command: {
        itemType: 'activity', recordId: 'vehicle-root', activityKind: 'fuel',
        occurredAt: '2026-08-12T10:00:00.000Z', amountMinor: 1.5, currency: 'TRY', quantityMilliunits: 10_000
      },
      identifiers
    });
    expect(unsafe).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(transactionStarted).toBe(false);

    const invalidMatrix = await new RecordManagedLifeItemUseCase(makeUnitOfWork(makeScope())).execute({
      context,
      command: {
        itemType: 'activity', recordId: 'vehicle-root', activityKind: 'rent_payment',
        occurredAt: '2026-08-12T10:00:00.000Z', amountMinor: 50_000, currency: 'TRY'
      },
      identifiers
    });
    expect(invalidMatrix).toMatchObject({ ok: false, error: { category: 'validation' } });
  });

  it('binds profile creation to create and children to parent update while inheriting owner and privacy', async () => {
    let profileIntent: LifePolicyIntent | undefined;
    let childIntent: LifePolicyIntent | undefined;
    let savedChild: ManagedLifeLedgerItemView | undefined;
    let childEvent: Record<string, unknown> | undefined;
    const profile = await new RecordManagedLifeItemUseCase(makeUnitOfWork(
      makeScope(),
      (intent) => { profileIntent = intent; }
    )).execute({ context, command: profileCommands[5]!, identifiers });
    expect(profile).toMatchObject({ ok: true, value: { itemType: 'profile', category: 'home' } });
    expect(profileIntent).toMatchObject({
      action: 'create', resourceId: 'managed-item-1', ownerPersonId: 'person-1', privacy: 'private'
    });

    const child = await new RecordManagedLifeItemUseCase(makeUnitOfWork(
      makeScope({
        saved: (item) => { savedChild = item; },
        event: (event) => { childEvent = event; }
      }),
      (intent) => { childIntent = intent; }
    )).execute({
      context,
      command: {
        itemType: 'activity', recordId: 'vehicle-root', activityKind: 'maintenance',
        occurredAt: '2026-08-12T10:00:00.000Z', provider: 'Yerel servis',
        amountMinor: 125_000, currency: 'try', odometerKm: 12_345,
        reminderMutation: { action: 'set', kind: 'maintenance', dueAt: '2027-08-12T10:00:00.000Z' },
        note: 'Periyodik bakım'
      },
      identifiers: { ...identifiers, itemId: 'activity-1' }
    });
    expect(child).toMatchObject({ ok: true, value: { itemType: 'activity', recordId: 'vehicle-root' } });
    expect(childIntent).toEqual({
      action: 'update', capability: 'family.write', resourceType: 'life_record',
      resourceId: 'vehicle-root', purpose: 'general'
    });
    expect(savedChild).toMatchObject({ ownerPersonId: 'person-1', privacy: 'private', currency: 'TRY' });
    expect(JSON.stringify(childEvent)).not.toMatch(/Yerel servis|125000|12345|Periyodik bakım|2027-08-12/u);
  });

  it('builds append-only latest reminder truth and never exposes document content', () => {
    const common = {
      ownerPersonId: 'person-1', privacy: 'private' as const, dataSource: 'manual' as const,
      externalVerification: 'not_performed' as const, paymentExecution: 'not_performed' as const
    };
    const items: ManagedLifeLedgerItemView[] = [
      {
        ...common, id: 'vehicle-root', itemType: 'profile', category: 'vehicle', title: 'Aile aracı',
        status: 'active', details: { vehicleType: 'car', energyType: 'fuel' },
        initialReminder: { kind: 'inspection', dueAt: '2026-09-01T00:00:00.000Z' },
        createdAt: '2026-08-01T00:00:00.000Z'
      },
      {
        ...common, id: 'renewal-1', itemType: 'activity', recordId: 'vehicle-root', activityKind: 'inspection',
        occurredAt: '2026-08-05T00:00:00.000Z', financePosting: 'not_performed',
        reminderMutation: { action: 'set', kind: 'inspection', dueAt: '2027-09-01T00:00:00.000Z' },
        createdAt: '2026-08-05T00:00:00.000Z'
      },
      {
        ...common, id: 'document-1', itemType: 'document', recordId: 'vehicle-root',
        archiveItemId: 'opaque-archive-id', documentKind: 'inspection_report',
        createdAt: '2026-08-05T01:00:00.000Z'
      }
    ];
    const workspace = buildManagedLifeWorkspace({
      items,
      generatedAt: '2026-08-12T00:00:00.000Z'
    });
    expect(workspace.profiles[0]?.currentReminder).toMatchObject({
      sourceId: 'renewal-1', recordId: 'vehicle-root', kind: 'inspection', dueAt: '2027-09-01T00:00:00.000Z'
    });
    expect(workspace).toMatchObject({
      dataSource: 'manual', externalRegistryLookup: 'not_performed', providerContact: 'not_performed',
      paymentExecution: 'not_performed', documentContentExposure: 'not_performed'
    });
    expect(JSON.stringify(workspace)).not.toMatch(/filePath|storedName|sha256|base64|documentPayload/u);

    const cleared = buildManagedLifeWorkspace({
      items: [...items, {
        ...common, id: 'clear-1', itemType: 'activity', recordId: 'vehicle-root', activityKind: 'inspection',
        occurredAt: '2026-08-06T00:00:00.000Z', financePosting: 'not_performed',
        reminderMutation: { action: 'clear' }, createdAt: '2026-08-06T00:00:00.000Z'
      }],
      generatedAt: '2026-08-12T00:00:00.000Z'
    });
    expect(cleared.profiles[0]?.currentReminder).toBeUndefined();
    expect(cleared.upcomingReminders).toEqual([]);
  });
});
