import { describe, expect, it } from 'vitest';
import type {
  ManagedHomeInventoryLedgerItemView,
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
  findManagedHomeInventoryItem: () => ({ ok: true, value: null }),
  findLatestManagedHomeMeterReading: () => ({ ok: true, value: null }),
  insertManagedHomeInventoryItem: (item) => {
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

describe('33-F managed home inventory application boundary', () => {
  const homeParent = {
    ...vehicleParent,
    id: 'home-root',
    category: 'home' as const,
    title: 'Aile evi',
    details: { tenure: 'owner' as const, propertyType: 'residence' as const, addressLabel: 'Ana konut' }
  };

  it('accepts all seven exact home inventory variants and preserves DEC-217 truth', () => {
    const variants: readonly RecordManagedLifeItemInput[] = [
      { itemType: 'room', recordId: 'home-root', name: 'Salon', roomKind: 'living_room' },
      {
        itemType: 'meter', recordId: 'home-root', roomId: 'room-1', label: 'Doğal gaz sayacı',
        meterKind: 'natural_gas', readingUnit: 'milliliter_cubic_meter_equivalent'
      },
      {
        itemType: 'meter_reading', recordId: 'home-root', meterId: 'meter-1', readingKind: 'replacement',
        readingMilliunits: 0, recordedAt: '2026-08-12T10:00:00.000Z', note: 'Sayaç değiştirildi'
      },
      {
        itemType: 'belonging', recordId: 'home-root', roomId: 'room-1', name: 'Buzdolabı',
        belongingKind: 'appliance', serialNumber: 'SN-AB12-3456'
      },
      {
        itemType: 'warranty', recordId: 'home-root', belongingId: 'belonging-1',
        startsAt: '2026-08-01T00:00:00.000Z', endsAt: '2028-08-01T00:00:00.000Z',
        reminderAt: '2028-07-01T00:00:00.000Z'
      },
      {
        itemType: 'service', recordId: 'home-root', targetItemId: 'room-1', targetType: 'room',
        serviceKind: 'maintenance', occurredAt: '2026-08-10T00:00:00.000Z'
      },
      {
        itemType: 'document', recordId: 'home-root', targetItemId: 'warranty-1', targetType: 'warranty',
        archiveItemId: 'archive-1', documentKind: 'warranty'
      }
    ];
    for (const command of variants) {
      expect(inspectManagedLifeDataContract(command)).toMatchObject({
        accepted: true,
        contractFamily: 'home_inventory',
        itemType: command.itemType
      });
    }
    const workspace = buildManagedLifeWorkspace({
      items: [homeParent],
      generatedAt: '2026-08-13T00:00:00.000Z'
    });
    expect(workspace).toMatchObject({
      dataSource: 'manual', smartMeterLookup: 'not_performed', providerContact: 'not_performed',
      warrantyLookup: 'not_performed', ocr: 'not_performed', paymentExecution: 'not_performed',
      documentContentExposure: 'not_performed'
    });
  });

  it('rejects drift, secrets, PAN, path, base64, unsafe integers and duplicate finance values', async () => {
    const base = { itemType: 'belonging', recordId: 'home-root', name: 'Buzdolabı', belongingKind: 'appliance' } as const;
    const serialAtLimit = `SN-${'ABCD-'.repeat(31)}XY`;
    const acceptedAtLimit = await new RecordManagedLifeItemUseCase(makeUnitOfWork({
      ...makeScope({ parent: homeParent }),
      findManagedHomeInventoryItem: () => ({ ok: true, value: null }),
      findLatestManagedHomeMeterReading: () => ({ ok: true, value: null })
    })).execute({
      context,
      command: { ...base, serialNumber: serialAtLimit },
      identifiers
    });
    expect(serialAtLimit).toHaveLength(160);
    expect(acceptedAtLimit).toMatchObject({ ok: true, value: { serialNumberMasked: expect.stringMatching(/D-XY$/u) } });
    expect(inspectManagedLifeDataContract({ ...base, futureField: true })).toMatchObject({
      accepted: false, unknownFields: ['$.futureField']
    });
    expect(inspectManagedLifeDataContract({ ...base, warrantyToken: 'secret' })).toMatchObject({
      accepted: false, prohibitedFields: ['$.warrantyToken']
    });
    expect(inspectManagedLifeDataContract({ ...base, serialNumber: '4111 1111 1111 1111' })).toMatchObject({
      accepted: false, panLikeValueDetected: true
    });
    expect(inspectManagedLifeDataContract({ ...base, serialNumber: 'C:\\Users\\person\\serial.txt' })).toMatchObject({
      accepted: false, pathLikeValueDetected: true
    });
    expect(inspectManagedLifeDataContract({ ...base, serialNumber: `data:text/plain;base64,${'A'.repeat(128)}` })).toMatchObject({
      accepted: false, base64LikeValueDetected: true
    });
    const invalidCommands: readonly RecordManagedLifeItemInput[] = [
      { ...base, purchaseAmountMinor: 1.5, currency: 'TRY' },
      { ...base, purchaseAmountMinor: Number.MAX_SAFE_INTEGER + 1, currency: 'TRY' },
      { ...base, purchaseAmountMinor: 100, currency: 'TRY', financeExpenseId: 'expense-1' },
      { ...base, serialNumber: `${serialAtLimit}Z` },
      {
        itemType: 'meter', recordId: 'home-root', label: 'Su', meterKind: 'water', readingUnit: 'wh'
      },
      {
        itemType: 'meter_reading', recordId: 'home-root', meterId: 'meter-1', readingKind: 'reset',
        readingMilliunits: 0, recordedAt: '2026-08-12T10:00:00.000Z'
      }
    ];
    for (const command of invalidCommands) {
      let started = false;
      const result = await new RecordManagedLifeItemUseCase({
        execute: async () => { started = true; throw new Error('must not start'); }
      }).execute({ context, command, identifiers });
      expect(result).toMatchObject({ ok: false, error: { category: 'validation' } });
      expect(started).toBe(false);
    }
  });

  it('binds inventory writes to the home root, enforces monotonic readings and emits content-free metadata', async () => {
    const meter = {
      id: 'meter-1', familyId: 'family-1' as never, recordId: 'home-root', ownerPersonId: 'person-1' as never,
      itemType: 'meter' as const, label: 'Elektrik sayacı', meterKind: 'electricity' as const,
      readingUnit: 'wh' as const, privacy: 'private' as const, dataSource: 'manual' as const,
      externalVerification: 'not_performed' as const, paymentExecution: 'not_performed' as const,
      createdAt: '2026-08-01T00:00:00.000Z' as never
    };
    const latest = {
      ...meter, id: 'reading-1', itemType: 'meter_reading' as const, meterId: 'meter-1',
      readingKind: 'reading' as const, readingMilliunits: 1000,
      recordedAt: '2026-08-10T00:00:00.000Z' as never
    };
    let started = false;
    let saved: ManagedHomeInventoryLedgerItemView | undefined;
    let event: Record<string, unknown> | undefined;
    let intent: LifePolicyIntent | undefined;
    const scope = {
      ...makeScope({ parent: homeParent }),
      findManagedHomeInventoryItem: (id:string) => ({ ok: true as const, value: id === 'meter-1' ? meter : null }),
      findLatestManagedHomeMeterReading: () => ({ ok: true as const, value: latest }),
      insertManagedHomeInventoryItem: (item: never) => {
        saved = item as ManagedHomeInventoryLedgerItemView;
        return { ok: true as const, value: undefined };
      },
      enqueueEvent: (value: unknown) => {
        event = value as Record<string, unknown>;
        return { ok: true as const, value: undefined };
      }
    };
    const decreasing = await new RecordManagedLifeItemUseCase(makeUnitOfWork(scope, () => { started = true; })).execute({
      context,
      command: {
        itemType: 'meter_reading', recordId: 'home-root', meterId: 'meter-1', readingKind: 'reading',
        readingMilliunits: 900, recordedAt: '2026-08-12T10:00:00.000Z'
      },
      identifiers
    });
    expect(started).toBe(true);
    expect(decreasing).toMatchObject({ ok: false, error: { category: 'validation' } });

    const reset = await new RecordManagedLifeItemUseCase(makeUnitOfWork(scope, (value) => { intent = value; })).execute({
      context,
      command: {
        itemType: 'meter_reading', recordId: 'home-root', meterId: 'meter-1', readingKind: 'reset',
        readingMilliunits: 0, recordedAt: '2026-08-12T10:00:00.000Z', note: 'Sayaç sıfırlandı'
      },
      identifiers
    });
    expect(reset).toMatchObject({ ok: true, value: { itemType: 'meter_reading', readingKind: 'reset' } });
    expect(intent).toEqual({
      action: 'update', capability: 'family.write', resourceType: 'life_record',
      resourceId: 'home-root', purpose: 'general'
    });
    expect(saved).toMatchObject({ ownerPersonId: 'person-1', privacy: 'private', recordId: 'home-root' });
    expect(JSON.stringify(event)).not.toMatch(/Sayaç sıfırlandı|readingMilliunits|meter-1|archive|finance|provider/u);
  });

  it('masks raw serials and strips persistence-only fields from use-case and renderer results', async () => {
    const raw = {
      id: 'belonging-1', familyId: 'family-1' as never, recordId: 'home-root', ownerPersonId: 'person-1' as never,
      itemType: 'belonging' as const, name: 'Buzdolabı', belongingKind: 'appliance' as const,
      serialNumber: 'SN-SECRET-9876', financePosting: 'not_performed' as const,
      privacy: 'private' as const, dataSource: 'manual' as const,
      externalVerification: 'not_performed' as const, paymentExecution: 'not_performed' as const,
      createdAt: '2026-08-12T00:00:00.000Z' as never
    };
    const workspace = buildManagedLifeWorkspace({
      items: [homeParent], homeInventoryItems: [raw], generatedAt: '2026-08-13T00:00:00.000Z'
    });
    expect(workspace.homeInventoryItems[0]).toMatchObject({ serialNumberMasked: '**********9876' });
    const json = JSON.stringify(workspace);
    expect(json).not.toContain('SN-SECRET-9876');
    expect(json).not.toMatch(/familyId|policyReceipt|receiptHash|filePath|storedName|sha256|documentPayload/u);

    const recorded = await new RecordManagedLifeItemUseCase(makeUnitOfWork({
      ...makeScope({ parent: homeParent }),
      findManagedHomeInventoryItem: () => ({ ok: true, value: null }),
      findLatestManagedHomeMeterReading: () => ({ ok: true, value: null })
    })).execute({
      context,
      command: {
        itemType: 'belonging', recordId: 'home-root', name: 'Buzdolabı',
        belongingKind: 'appliance', serialNumber: 'SN-SECRET-9876'
      },
      identifiers
    });
    expect(recorded).toMatchObject({ ok: true, value: { serialNumberMasked: '**********9876' } });
    expect(JSON.stringify(recorded)).not.toContain('SN-SECRET-9876');
  });
});
