import { describe, expect, it } from 'vitest';
import {
  PrepareFamilyEmergencyCardExportUseCase,
  RecordManagedLifeItemUseCase,
  RecordFamilyEmergencyCardExportCompletionUseCase,
  buildManagedLifeWorkspace,
  createFamilyEmergencyCardExportAuthorizationProof,
  familyEmergencyCardSelectionSha256,
  inspectManagedLifeDataContract,
  type FamilyEmergencyAssistanceProfileWriteRecord,
  type FamilyEmergencyAssistanceWriteRecord,
  type FamilyEmergencyCardPortabilityWriteRecord,
  type LifeApplicationContext,
  type LifePolicyIntent,
  type LifeUnitOfWork,
  type LifeWriteScope
} from '../src/life-use-cases.js';

const occurredAt = '2026-08-13T12:00:00.000Z' as never;
const context:LifeApplicationContext = {
  familyId: 'family-1' as never,
  actor: { userId: 'user-1' as never, role: 'adult_member', personId: 'person-1' as never },
  correlationId: '33-j-test' as never
};
const profile:FamilyEmergencyAssistanceProfileWriteRecord = {
  id: 'profile-1', planId: 'plan-1', familyId: 'family-1' as never,
  ownerPersonId: 'person-1' as never, itemType: 'emergency_profile', label: 'Ayse acil karti',
  subjectKind: 'person', subjectPersonId: 'person-1', privacy: 'private', dataSource: 'manual',
  createdAt: '2026-08-01T00:00:00.000Z' as never
};
const contact:FamilyEmergencyAssistanceWriteRecord = {
  id: 'contact-1', profileId: 'profile-1', planId: 'plan-1', familyId: 'family-1' as never,
  ownerPersonId: 'person-1' as never, itemType: 'emergency_contact', name: 'Acil irtibat',
  phoneE164: '+905551234567', relationship: 'Kardes', note: 'Yalniz acilde ara',
  privacy: 'private', dataSource: 'manual', createdAt: '2026-08-02T00:00:00.000Z' as never
};
const configuration:FamilyEmergencyCardPortabilityWriteRecord = {
  id: 'config-1', profileId: 'profile-1', familyId: 'family-1' as never,
  ownerPersonId: 'person-1' as never, itemType: 'card_configuration', label: 'Cevrimdisi kart',
  locale: 'tr-TR', privacy: 'private', dataSource: 'manual',
  createdAt: '2026-08-03T00:00:00.000Z' as never
};
const selectedPhone:FamilyEmergencyCardPortabilityWriteRecord = {
  id: 'selected-1', profileId: 'profile-1', configurationId: 'config-1', familyId: 'family-1' as never,
  ownerPersonId: 'person-1' as never, itemType: 'selected_field', sourceItemId: 'contact-1',
  sourceItemType: 'emergency_contact', fieldCode: 'phone_e164', privacy: 'private', dataSource: 'manual',
  createdAt: '2026-08-04T00:00:00.000Z' as never
};
const documentLink:FamilyEmergencyCardPortabilityWriteRecord = {
  id: 'document-1', profileId: 'profile-1', configurationId: 'config-1', familyId: 'family-1' as never,
  ownerPersonId: 'person-1' as never, itemType: 'document_link', archiveItemId: 'archive-1',
  privacy: 'private', dataSource: 'manual', createdAt: '2026-08-05T00:00:00.000Z' as never
};
const exportEvent:FamilyEmergencyCardPortabilityWriteRecord = {
  id: 'export-1', profileId: 'profile-1', configurationId: 'config-1', familyId: 'family-1' as never,
  ownerPersonId: 'person-1' as never, itemType: 'export_event', mode: 'encrypted_pack',
  selectedFieldCount: 1, documentCount: 1, selectionSha256: 'a'.repeat(64),
  shareReceiptHash: 'c'.repeat(64), artifactSha256: 'd'.repeat(64), artifactSizeBytes: 8192,
  powerSource: 'unknown', batteryLevel: 'not_measured', automaticLowBatteryDetection: 'not_performed',
  lowBatteryClaimed: false, artifactReadbackStatus: 'verified', privacy: 'private', dataSource: 'manual',
  createdAt: '2026-08-06T00:00:00.000Z' as never
};

const scope = (input:{
  readonly saved?:(item:FamilyEmergencyCardPortabilityWriteRecord)=>void;
  readonly audit?:(value:unknown)=>void;
  readonly event?:(value:unknown)=>void;
  readonly portabilityItems?:readonly FamilyEmergencyCardPortabilityWriteRecord[];
  readonly occurredAt?:typeof occurredAt;
} = {}):LifeWriteScope => ({
  occurredAt: input.occurredAt ?? occurredAt,
  authorizationReceiptHash: 'c'.repeat(64),
  findPerson: () => ({ ok: true, value: null }),
  authorize: () => ({ ok: true, value: true }),
  insertLifeRecord: () => ({ ok: true, value: undefined }),
  findManagedLifeProfile: () => ({ ok: true, value: null }),
  insertManagedLifeItem: () => ({ ok: true, value: undefined }),
  findManagedHomeInventoryItem: () => ({ ok: true, value: null }),
  findLatestManagedHomeMeterReading: () => ({ ok: true, value: null }),
  insertManagedHomeInventoryItem: () => ({ ok: true, value: undefined }),
  findFamilyEmergencyPlan: () => ({ ok: true, value: null }),
  findFamilyEmergencyItem: () => ({ ok: true, value: null }),
  insertFamilyEmergencyItem: () => ({ ok: true, value: undefined }),
  findFamilyEmergencyPreparednessItem: () => ({ ok: true, value: null }),
  insertFamilyEmergencyPreparednessItem: () => ({ ok: true, value: undefined }),
  findFamilyEmergencyAssistanceProfile: (id) => ({ ok: true, value: id === profile.id ? profile : null }),
  findFamilyEmergencyAssistanceItem: (id) => ({
    ok: true,
    value: id === profile.id ? profile : id === contact.id ? contact : null
  }),
  insertFamilyEmergencyAssistanceItem: () => ({ ok: true, value: undefined }),
  findFamilyEmergencyCardConfiguration: (id) => ({
    ok: true,
    value: id === configuration.id ? configuration : null
  }),
  findFamilyEmergencyCardPortabilityItem: () => ({ ok: true, value: null }),
  listFamilyEmergencyCardPortabilityItems: () => ({
    ok: true,
    value: input.portabilityItems ?? [configuration, selectedPhone, documentLink]
  }),
  insertFamilyEmergencyCardPortabilityItem: (item) => {
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
});

const uow = (
  writeScope:LifeWriteScope,
  onIntent?:(intent:LifePolicyIntent)=>void,
  onExecute?:()=>void
):LifeUnitOfWork => ({
  execute: async (_context, intent, operation) => {
    onExecute?.();
    onIntent?.(intent);
    return operation(writeScope);
  }
});

describe('33-J family emergency card portability application boundary', () => {
  it('accepts only the closed five-item ledger contract and rejects secret/path payloads', () => {
    const valid = [
      { itemType: 'card_configuration', profileId: 'profile-1', label: 'Kart', locale: 'tr-TR' },
      { itemType: 'selected_field', profileId: 'profile-1', configurationId: 'config-1', sourceItemId: 'contact-1', sourceItemType: 'emergency_contact', fieldCode: 'phone_e164' },
      { itemType: 'document_link', profileId: 'profile-1', configurationId: 'config-1', archiveItemId: 'archive-1' },
      { itemType: 'export_event', profileId: 'profile-1', configurationId: 'config-1', mode: 'encrypted_pack', selectedFieldCount: 1, documentCount: 1, selectionSha256: 'a'.repeat(64), shareReceiptHash: 'c'.repeat(64), artifactSha256: 'b'.repeat(64), artifactSizeBytes: 4096, powerSource: 'unknown', batteryLevel: 'not_measured', automaticLowBatteryDetection: 'not_performed', lowBatteryClaimed: false, artifactReadbackStatus: 'verified' },
      { itemType: 'power_mode_event', profileId: 'profile-1', configurationId: 'config-1', mode: 'enabled', activationSource: 'manual', powerSource: 'battery', batteryLevel: 'not_measured', automaticLowBatteryDetection: 'not_performed', lowBatteryClaimed: false }
    ] as const;
    for (const command of valid) {
      expect(inspectManagedLifeDataContract(command)).toMatchObject({
        accepted: true, contractFamily: 'family_emergency_card_portability', itemType: command.itemType
      });
    }
    const uuidWithPanLikeDigits = '41111111-1111-1111-a111-111111111111';
    const uuidSelectedField = {
      ...valid[1], profileId:uuidWithPanLikeDigits, configurationId:uuidWithPanLikeDigits,
      sourceItemId:uuidWithPanLikeDigits
    };
    expect(inspectManagedLifeDataContract(uuidSelectedField)).toMatchObject({
      accepted:true, panLikeValueDetected:false, contractFamily:'family_emergency_card_portability'
    });
    expect(inspectManagedLifeDataContract({ ...uuidSelectedField, sourceItemId:'4111111111111111' })).toMatchObject({
      accepted:true, panLikeValueDetected:false
    });
    expect(inspectManagedLifeDataContract({ ...valid[0], label:'4111111111111111' })).toMatchObject({
      accepted:false, panLikeValueDetected:true
    });
    for (const prohibited of [
      { ...valid[0], passphrase: 'do-not-store' },
      { ...valid[0], totp: '123456' },
      { ...valid[0], outputPath: 'C:\\Users\\person\\card.pdf' }
    ]) expect(inspectManagedLifeDataContract(prohibited).accepted).toBe(false);
  });

  it('writes profile-rooted private rows and keeps audit/outbox free of type and selected content', async () => {
    let saved:FamilyEmergencyCardPortabilityWriteRecord | undefined;
    let audit:unknown;
    let event:unknown;
    let intent:LifePolicyIntent | undefined;
    const result = await new RecordManagedLifeItemUseCase(uow(scope({
      saved: (value) => { saved = value; },
      audit: (value) => { audit = value; },
      event: (value) => { event = value; }
    }), (value) => { intent = value; })).execute({
      context,
      command: {
        itemType: 'card_configuration', profileId: 'profile-1', label: 'Cevrimdisi kart', locale: 'tr-TR'
      },
      identifiers: { itemId: 'config-new', auditId: 'audit-1', outboxEventId: 'event-1' as never }
    });
    expect(result).toMatchObject({ ok: true, value: { itemType: 'card_configuration', id: 'config-new' } });
    expect(intent).toEqual({
      action: 'update', capability: 'family.write', resourceType: 'life_record',
      resourceId: 'profile-1', purpose: 'general'
    });
    expect(saved).toMatchObject({ ownerPersonId: 'person-1', privacy: 'private', dataSource: 'manual' });
    const evidence = JSON.stringify({ audit, event });
    expect(evidence).not.toMatch(/card_configuration|Cevrimdisi kart|phone_e164|905551234567/u);
    expect(event).toMatchObject({ payload: { itemId: 'config-new', recordId: 'profile-1', privacy: 'private' } });
  });

  it('binds exact selection to a one-shot main-only proof and share receipt without logging values', async () => {
    const selection = {
      selectedFields: [{ selectedFieldId: 'selected-1', fieldCode: 'phone_e164' as const }],
      documentLinkIds: ['document-1']
    };
    const command = {
      profileId: 'profile-1', configurationId: 'config-1', mode: 'encrypted_pack' as const,
      rendererSessionId: 'renderer-session-1', operationId: 'operation-1', selection
    };
    const selectionSha256 = familyEmergencyCardSelectionSha256(command);
    const proof = createFamilyEmergencyCardExportAuthorizationProof({
      rendererSessionId: command.rendererSessionId,
      operationId: command.operationId,
      correlationId: context.correlationId,
      profileId: command.profileId,
      configurationId: command.configurationId,
      mode: command.mode,
      selectionSha256,
      verifiedAt: '2026-08-13T11:59:00.000Z',
      expiresAt: '2026-08-13T12:01:00.000Z'
    });
    let intent:LifePolicyIntent | undefined;
    let executions = 0;
    const useCase = new PrepareFamilyEmergencyCardExportUseCase(
      uow(scope(), (value) => { intent = value; }, () => { executions += 1; }),
      () => Date.parse('2026-08-13T12:00:00.000Z')
    );
    const result = await useCase.execute({ context, command, authorizationProof: proof });
    expect(result).toMatchObject({
      ok: true,
      value: {
        selectionSha256,
        shareReceiptHash: 'c'.repeat(64),
        selectedFields: [{ fieldCode: 'phone_e164', value: '+905551234567' }],
        documents: [{ archiveItemId: 'archive-1' }],
        plaintextTemporaryFiles: 'not_created', networkEgressAdded: false
      }
    });
    expect(intent).toEqual({
      action: 'share', capability: 'file.share', resourceType: 'life_record',
      resourceId: 'profile-1', purpose: 'emergency-offline-portability',
      requestedFields: ['phone_e164', `selection_sha256:${selectionSha256}`]
    });
    expect(JSON.stringify(intent)).not.toMatch(/905551234567|Acil irtibat|Yalniz acilde ara/u);
    const replay = await useCase.execute({ context, command, authorizationProof: proof });
    expect(replay).toMatchObject({ ok: false, error: { category: 'authorization' } });
    expect(executions).toBe(1);
  });

  it('records completion with a fresh update receipt and consumes the share-bound proof once', async () => {
    const selection = {
      selectedFields: [{ selectedFieldId: 'selected-1', fieldCode: 'phone_e164' as const }],
      documentLinkIds: ['document-1']
    };
    const prepareCommand = {
      profileId: 'profile-1', configurationId: 'config-1', mode: 'encrypted_pack' as const,
      rendererSessionId: 'renderer-session-1', operationId: 'operation-1', selection
    };
    const selectionSha256 = familyEmergencyCardSelectionSha256(prepareCommand);
    const authorizationProof = createFamilyEmergencyCardExportAuthorizationProof({
      rendererSessionId: prepareCommand.rendererSessionId,
      operationId: prepareCommand.operationId,
      correlationId: context.correlationId,
      profileId: prepareCommand.profileId,
      configurationId: prepareCommand.configurationId,
      mode: prepareCommand.mode,
      selectionSha256,
      verifiedAt: '2026-08-13T11:59:00.000Z',
      expiresAt: '2026-08-13T12:01:00.000Z'
    });
    const prepared = await new PrepareFamilyEmergencyCardExportUseCase(
      uow(scope()),
      () => Date.parse('2026-08-13T12:00:00.000Z')
    ).execute({ context, command: prepareCommand, authorizationProof });
    expect(prepared).toMatchObject({ ok: true });
    if (!prepared.ok) throw new Error('prepare failed');

    let saved:FamilyEmergencyCardPortabilityWriteRecord | undefined;
    let audit:unknown;
    let event:unknown;
    let intent:LifePolicyIntent | undefined;
    const completionContext = { ...context, correlationId: '33-j-completion' as never };
    const completion = new RecordFamilyEmergencyCardExportCompletionUseCase(uow(scope({
      saved: (value) => { saved = value; },
      audit: (value) => { audit = value; },
      event: (value) => { event = value; }
    }), (value) => { intent = value; }));
    const completionInput = {
      context: completionContext,
      command: {
        artifactSha256: 'd'.repeat(64), artifactSizeBytes: 8192,
        powerSource: 'unknown' as const, batteryLevel: 'not_measured' as const,
        automaticLowBatteryDetection: 'not_performed' as const, lowBatteryClaimed: false as const,
        artifactReadbackStatus: 'verified' as const
      },
      completionProof: prepared.value.completionProof,
      identifiers: { itemId: 'export-1', auditId: 'audit-export-1', outboxEventId: 'event-export-1' as never }
    };
    const result = await completion.execute(completionInput);
    expect(result).toMatchObject({
      ok: true,
      value: {
        itemType: 'export_event', mode: 'encrypted_pack', selectionSha256,
        artifactReadbackStatus: 'verified'
      }
    });
    expect(JSON.stringify(result)).not.toContain('shareReceiptHash');
    expect(intent).toEqual({
      action: 'update', capability: 'family.write', resourceType: 'life_record',
      resourceId: 'profile-1', purpose: 'general'
    });
    expect(saved).toMatchObject({
      selectionSha256, shareReceiptHash: 'c'.repeat(64), selectedFieldCount: 1, documentCount: 1
    });
    expect(JSON.stringify({ audit, event })).not.toMatch(/phone_e164|905551234567|shareReceiptHash|selectionSha256/u);
    expect(await completion.execute(completionInput)).toMatchObject({
      ok: false, error: { category: 'authorization' }
    });
  });

  it('accepts completion at exactly five minutes and denies five minutes plus one millisecond', async () => {
    const prepare = async (operationId:string) => {
      const selection = {
        selectedFields: [{ selectedFieldId: 'selected-1', fieldCode: 'phone_e164' as const }],
        documentLinkIds: []
      };
      const command = {
        profileId: 'profile-1', configurationId: 'config-1', mode: 'pdf' as const,
        rendererSessionId: 'renderer-session-1', operationId, selection
      };
      const proof = createFamilyEmergencyCardExportAuthorizationProof({
        rendererSessionId: command.rendererSessionId,
        operationId,
        correlationId: context.correlationId,
        profileId: command.profileId,
        configurationId: command.configurationId,
        mode: command.mode,
        selectionSha256: familyEmergencyCardSelectionSha256(command),
        verifiedAt: '2026-08-13T11:59:00.000Z',
        expiresAt: '2026-08-13T12:01:00.000Z'
      });
      return new PrepareFamilyEmergencyCardExportUseCase(
        uow(scope()),
        () => Date.parse('2026-08-13T12:00:00.000Z')
      ).execute({ context, command, authorizationProof: proof });
    };
    const completionCommand = {
      artifactSha256: 'd'.repeat(64), artifactSizeBytes: 4096,
      powerSource: 'unknown' as const, batteryLevel: 'not_measured' as const,
      automaticLowBatteryDetection: 'not_performed' as const, lowBatteryClaimed: false as const,
      artifactReadbackStatus: 'verified' as const
    };
    const atBoundary = await prepare('operation-boundary');
    if (!atBoundary.ok) throw new Error('prepare failed');
    const accepted = await new RecordFamilyEmergencyCardExportCompletionUseCase(uow(scope({
      occurredAt: '2026-08-13T12:05:00.000Z' as never
    }))).execute({
      context: { ...context, correlationId: 'completion-boundary' as never },
      command: completionCommand,
      completionProof: atBoundary.value.completionProof,
      identifiers: { itemId: 'export-boundary', auditId: 'audit-boundary', outboxEventId: 'event-boundary' as never }
    });
    expect(accepted).toMatchObject({ ok: true });

    const afterBoundary = await prepare('operation-after-boundary');
    if (!afterBoundary.ok) throw new Error('prepare failed');
    const denied = await new RecordFamilyEmergencyCardExportCompletionUseCase(uow(scope({
      occurredAt: '2026-08-13T12:05:00.001Z' as never
    }))).execute({
      context: { ...context, correlationId: 'completion-after-boundary' as never },
      command: completionCommand,
      completionProof: afterBoundary.value.completionProof,
      identifiers: { itemId: 'export-after', auditId: 'audit-after', outboxEventId: 'event-after' as never }
    });
    expect(denied).toMatchObject({ ok: false, error: { category: 'authorization' } });
  });

  it('rejects renderer/generic export-event persistence even with a valid-looking receipt hash', async () => {
    let executions = 0;
    const result = await new RecordManagedLifeItemUseCase(uow(scope(), undefined, () => {
      executions += 1;
    })).execute({
      context,
      command: {
        itemType: 'export_event', profileId: 'profile-1', configurationId: 'config-1',
        mode: 'pdf', selectedFieldCount: 1, documentCount: 0,
        selectionSha256: 'a'.repeat(64), shareReceiptHash: 'c'.repeat(64),
        artifactSha256: 'd'.repeat(64), artifactSizeBytes: 4096, powerSource: 'unknown',
        batteryLevel: 'not_measured', automaticLowBatteryDetection: 'not_performed',
        lowBatteryClaimed: false, artifactReadbackStatus: 'verified'
      },
      identifiers: { itemId: 'export-forged', auditId: 'audit-forged', outboxEventId: 'event-forged' as never }
    });
    expect(result).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(executions).toBe(0);
  });

  it('rejects forged or selection-mismatched proof before policy/UoW execution', async () => {
    const selection = {
      selectedFields: [{ selectedFieldId: 'selected-1', fieldCode: 'phone_e164' as const }],
      documentLinkIds: []
    };
    const command = {
      profileId: 'profile-1', configurationId: 'config-1', mode: 'pdf' as const,
      rendererSessionId: 'renderer-session-1', operationId: 'operation-1', selection
    };
    let executions = 0;
    const useCase = new PrepareFamilyEmergencyCardExportUseCase(
      uow(scope(), undefined, () => { executions += 1; }),
      () => Date.parse('2026-08-13T12:00:00.000Z')
    );
    const forged = await useCase.execute({
      context,
      command,
      authorizationProof: Object.freeze({}) as never
    });
    expect(forged).toMatchObject({ ok: false, error: { category: 'authorization' } });
    const proof = createFamilyEmergencyCardExportAuthorizationProof({
      rendererSessionId: command.rendererSessionId,
      operationId: command.operationId,
      correlationId: context.correlationId,
      profileId: command.profileId,
      configurationId: command.configurationId,
      mode: command.mode,
      selectionSha256: 'f'.repeat(64),
      verifiedAt: '2026-08-13T11:59:00.000Z',
      expiresAt: '2026-08-13T12:01:00.000Z'
    });
    const mismatch = await useCase.execute({ context, command, authorizationProof: proof });
    expect(mismatch).toMatchObject({ ok: false, error: { category: 'authorization' } });
    expect(executions).toBe(0);
  });

  it('rejects document links for print/PDF before policy because documents require encrypted_pack', async () => {
    let executions = 0;
    const selection = {
      selectedFields: [{ selectedFieldId: 'selected-1', fieldCode: 'phone_e164' as const }],
      documentLinkIds: ['document-1']
    };
    const command = {
      profileId: 'profile-1', configurationId: 'config-1', mode: 'pdf' as const,
      rendererSessionId: 'renderer-session-1', operationId: 'operation-1', selection
    };
    const proof = createFamilyEmergencyCardExportAuthorizationProof({
      rendererSessionId: command.rendererSessionId,
      operationId: command.operationId,
      correlationId: context.correlationId,
      profileId: command.profileId,
      configurationId: command.configurationId,
      mode: command.mode,
      selectionSha256: familyEmergencyCardSelectionSha256(command),
      verifiedAt: '2026-08-13T11:59:00.000Z',
      expiresAt: '2026-08-13T12:01:00.000Z'
    });
    const useCase = new PrepareFamilyEmergencyCardExportUseCase(
      uow(scope(), undefined, () => { executions += 1; }),
      () => Date.parse('2026-08-13T12:00:00.000Z')
    );
    const result = await useCase.execute({ context, command, authorizationProof: proof });
    expect(result).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(executions).toBe(0);
  });

  it('projects explicit local-export truth and strips persistence-only fields', () => {
    const workspace = buildManagedLifeWorkspace({
      items: [],
      assistanceItems: [profile, contact],
      portabilityItems: [configuration, selectedPhone, documentLink, exportEvent],
      generatedAt: '2026-08-13T12:00:00.000Z'
    });
    expect(workspace.emergencyAssistanceProfiles[0]?.cardConfigurations[0]).toMatchObject({
      id: 'config-1', selectedFields: [{ id: 'selected-1', fieldCode: 'phone_e164' }],
      documentLinks: [{ id: 'document-1', archiveItemId: 'archive-1' }]
    });
    expect(workspace.emergencyAssistanceProfiles[0]?.cardConfigurations[0]?.exportEvents).toMatchObject([
      { id: 'export-1', selectionSha256: 'a'.repeat(64), artifactSha256: 'd'.repeat(64) }
    ]);
    expect(workspace).toMatchObject({
      externalDelivery: 'not_performed', localExport: 'user_authorized_only',
      cloudUpload: 'not_performed', pdfEncryption: 'not_claimed',
      portablePackEncryption: 'application_specific_container', plaintextTemporaryFiles: 'not_created',
      batteryLevel: 'not_measured', automaticLowBatteryDetection: 'not_performed',
      lowBatteryClaimed: false, networkEgressAdded: false
    });
    const serializedWorkspace = JSON.stringify(workspace);
    expect(serializedWorkspace).not.toContain('shareReceiptHash');
    expect(serializedWorkspace).not.toMatch(/familyId|policyReceipt|authorizationReceipt|share_receipt_hash/iu);
  });
});
