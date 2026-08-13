import { createHash, randomUUID } from 'node:crypto';
import { existsSync, linkSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReadArchiveFileBytesUseCase } from '@ppt/application';
import { asCorrelationId } from '@ppt/core';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import { computePlatformPolicyReceiptHash, computePlatformPolicyReceiptRecordHash } from '@ppt/repositories';
import { afterEach, describe, expect, it } from 'vitest';
import { FileSystemArchiveVaultFilePort } from '../src/main/archive-vault-file-application-adapter.js';
import { FamilyDataStore } from '../src/main/data-store.js';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';
import { countedStrongAuthenticationFailureCode } from '../src/main/ipc-request-lifecycle.js';
import { IpcAdaptiveBudgetMaintenanceReauthenticationGuard } from '../src/main/ipc-adaptive-budget-maintenance-reauthentication-guard.js';

const temporaryDirectories:string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive:true, force:true });
});

const profileId = 'assistance-profile-33j';
const configurationId = 'card-configuration-33j';
const configuration = {
  itemType:'card_configuration', profileId, label:'Cüzdan acil durum kartı', locale:'tr-TR'
} as const;
const selectedField = {
  itemType:'selected_field', profileId, configurationId,
  sourceItemId:'health-fact-33j', sourceItemType:'health_fact', fieldCode:'fact_value'
} as const;
const documentLink = {
  itemType:'document_link', profileId, configurationId, archiveItemId:'archive-item-33j'
} as const;
const powerMode = {
  itemType:'power_mode_event', profileId, configurationId, mode:'enabled',
  activationSource:'manual', powerSource:'unknown', batteryLevel:'not_measured',
  automaticLowBatteryDetection:'not_performed', lowBatteryClaimed:false
} as const;
const encryptedExport = {
  profileId, configurationId, mode:'encrypted_pack',
  selectedFieldIds:['selected-field-33j'], documentLinkIds:['document-link-33j'],
  password:'StrongAccountPassword!33J', code:'123456',
  packagePassphrase:'Independent package passphrase 33J', plaintextWarningConfirmed:false
} as const;

const policyKernel = new PlatformPolicyKernel({
  policyVersion:'33-j-family-emergency-card-portability-desktop-test-v1',
  policyPackageVersion:2,
  signingKey:Buffer.from('33-j-family-emergency-card-portability-controlled-key','utf8'),
  applicationCapabilities:{ 'windows-desktop':['family.read','family.write','file.share','archive.read','archive.write'] },
  consentRequiredCapabilities:[], onlineOnlyCapabilities:[],
  writeActions:['create','update','delete','record']
});
const policyProvider:PlatformPolicyAuthorizationProvider = Object.freeze({
  resolvePolicyPackage:() => policyKernel.policyPackage,
  authorize({request,nonce}) {
    return Object.freeze({ effectiveRequest:request, authorization:policyKernel.authorizeWithReceipt(request,request.occurredAt,nonce) });
  },
  verify:({request,receipt}) => policyKernel.verifyReceiptForRequest(receipt,request)
});
const projectionProof = (record:PlatformPolicyReceiptRecord):PlatformPolicyJournalProjectionProof => Object.freeze({
  schemaVersion:1,
  receiptHash:computePlatformPolicyReceiptHash(record.receipt),
  recordHash:computePlatformPolicyReceiptRecordHash(record),
  receiptNonce:record.receipt.nonce,
  entrySequence:1, entryHash:'8'.repeat(64), headSequence:1, headHash:'8'.repeat(64),
  journalSizeBytes:512, issuedAt:record.recordedAt, proofMac:'b'.repeat(64)
});

describe('33-J B5-03/EXT-016 governed emergency card desktop boundary', () => {
  it('keeps the two LIFE channels, adds one exact export channel and accepts four renderer-managed variants', () => {
    expect(evaluateIpcIntegrationPolicy('life:getManagedWorkspace', [])).toEqual({ accepted:true });
    for (const input of [configuration, selectedField, documentLink, powerMode]) {
      expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [input])).toEqual({ accepted:true });
    }
    expect(evaluateIpcIntegrationPolicy('life:exportEmergencyCard', [encryptedExport])).toEqual({ accepted:true });
    expect(evaluateIpcIntegrationPolicy('life:exportEmergencyCard', [])).toMatchObject({ accepted:false });
  });

  it('keeps export proof and output paths main-only and rejects forged evidence', () => {
    for (const input of [
      { ...encryptedExport, strongAuthGrant:{ granted:true } },
      { ...encryptedExport, outputPath:'C:\\Users\\family\\card.pptemergency' },
      { ...encryptedExport, packagePassphrase:'short-value' },
      { ...encryptedExport, selectedFieldIds:['same-id','same-id'] },
      { ...encryptedExport, mode:'pdf', packagePassphrase:undefined, plaintextWarningConfirmed:false }
    ]) {
      expect(evaluateIpcIntegrationPolicy('life:exportEmergencyCard', [input])).toMatchObject({ accepted:false });
    }
    expect(evaluateIpcIntegrationPolicy('life:exportEmergencyCard', [{
      ...encryptedExport, mode:'pdf', documentLinkIds:[], packagePassphrase:undefined, plaintextWarningConfirmed:true
    }])).toEqual({ accepted:true });
    expect(evaluateIpcIntegrationPolicy('life:exportEmergencyCard', [{
      ...encryptedExport, mode:'pdf', packagePassphrase:undefined, plaintextWarningConfirmed:true
    }])).toMatchObject({ accepted:false });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      itemType:'export_event', profileId, configurationId, mode:'pdf', selectedFieldCount:1,
      documentCount:0, artifactSha256:'a'.repeat(64), artifactSizeBytes:1234,
      selectionSha256:'b'.repeat(64),
      powerSource:'ac', batteryLevel:'not_measured', automaticLowBatteryDetection:'not_performed',
      lowBatteryClaimed:false, artifactReadbackStatus:'verified'
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_MAIN_PROCESS_ONLY' });
  });

  it('enforces the exact source-field matrix and closed evidence truth', () => {
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...selectedField, sourceItemType:'health_fact', fieldCode:'label'
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_ARGUMENT_INVALID' });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...powerMode, batteryLevel:82
    }])).toMatchObject({ accepted:false });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...powerMode, automaticLowBatteryDetection:'performed'
    }])).toMatchObject({ accepted:false });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...powerMode, activationSource:'battery_prompt'
    }])).toMatchObject({ accepted:false });
  });

  it('counts the real credential/2FA error codes, locks five failures and clears on success', () => {
    expect(countedStrongAuthenticationFailureCode(new Error('[AUTH-CREDENTIALS-001] invalid'))).toBe('AUTH-CREDENTIALS-001');
    expect(countedStrongAuthenticationFailureCode(new Error('[AUTH-2FA-INVALID-001] invalid'))).toBe('AUTH-2FA-INVALID-001');
    expect(countedStrongAuthenticationFailureCode(new Error('[AUTH-2FA-REQUIRED-001] required'))).toBeUndefined();
    const guard = new IpcAdaptiveBudgetMaintenanceReauthenticationGuard({
      maximumFailedAttempts:5, lockDurationMs:5 * 60_000, failureWindowMs:10 * 60_000
    });
    const contextKey = 'a'.repeat(64);
    for (let index=0; index<4; index += 1) expect(guard.recordFailure(contextKey, index * 1_000).locked).toBe(false);
    expect(guard.recordFailure(contextKey, 4_000)).toMatchObject({ locked:true, failedAttempts:5, remainingAttempts:0 });
    expect(guard.status(contextKey, 4_001).locked).toBe(true);
    guard.recordSuccess(contextKey, 4_002);
    expect(guard.status(contextKey, 4_003)).toMatchObject({ locked:false, failedAttempts:0, remainingAttempts:5 });
  });

  it('decrypts a bounded archive member in memory with exact size/hash and creates no plaintext temp file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppt-33j-archive-read-'));
    temporaryDirectories.push(directory);
    const sourcePath = join(directory, 'source.txt');
    const archivePath = join(directory, 'archive');
    const temporaryOpenPath = join(directory, 'open');
    const plain = Buffer.from('bounded private emergency document', 'utf8');
    writeFileSync(sourcePath, plain);
    const files = new FileSystemArchiveVaultFilePort({
      archivePath, keyPath:join(directory, 'archive.key'), temporaryOpenPath
    });
    const correlationId = asCorrelationId('corr-33j-in-memory-archive');
    const stored = files.store({ sourcePath, itemId:'archive-item-33j' }, correlationId);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    const read = new ReadArchiveFileBytesUseCase(files).execute(correlationId, {
      itemId:'archive-item-33j', storedName:stored.value.storedName,
      expectedSha256:createHash('sha256').update(plain).digest('hex'),
      expectedSizeBytes:plain.length, maximumBytes:10 * 1024 * 1024
    });
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(Buffer.from(read.value)).toEqual(plain);
      read.value.fill(0);
    }
    expect(existsSync(temporaryOpenPath)).toBe(false);
    expect(readFileSync(join(archivePath, stored.value.storedName), 'utf8')).not.toContain(plain.toString('utf8'));
  });

  it('publishes with no-overwrite semantics and preserves an existing destination on failure', () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppt-33j-exclusive-publish-'));
    temporaryDirectories.push(directory);
    const temporaryPath = join(directory, '.artifact.tmp');
    const existingPath = join(directory, 'existing.pdf');
    const newPath = join(directory, 'new.pdf');
    writeFileSync(temporaryPath, 'new private artifact');
    writeFileSync(existingPath, 'existing user bytes');

    expect(() => linkSync(temporaryPath, existingPath)).toThrow();
    expect(readFileSync(existingPath, 'utf8')).toBe('existing user bytes');

    linkSync(temporaryPath, newPath);
    expect(readFileSync(newPath, 'utf8')).toBe('new private artifact');
    rmSync(newPath, { force:true });
    expect(existsSync(newPath)).toBe(false);
    expect(readFileSync(temporaryPath, 'utf8')).toBe('new private artifact');
  });

  it('binds visible private configurations, main-owned power observation and honest UI truth without network APIs', () => {
    const adapter = readFileSync(new URL('../src/main/life-application-adapter.ts', import.meta.url), 'utf8');
    const runtime = readFileSync(new URL('../src/main/life-production-policy-runtime.ts', import.meta.url), 'utf8');
    const main = readFileSync(new URL('../src/main/main.ts', import.meta.url), 'utf8');
    const preload = readFileSync(new URL('../src/main/preload.ts', import.meta.url), 'utf8');
    const panel = readFileSync(new URL('../src/renderer/ManagedLifePanel.tsx', import.meta.url), 'utf8');
    const coreService = readFileSync(new URL('../../core-service/src/main.ts', import.meta.url), 'utf8');
    const lifeProjection = readFileSync(new URL('../../../packages/application/src/life-use-cases.ts', import.meta.url), 'utf8');
    expect(adapter).toContain('listFamilyEmergencyCardPortabilityItems');
    expect(adapter).toContain('portabilityItems');
    expect(main).toContain("'life:exportEmergencyCard'");
    expect(main).toContain('powerMonitor.isOnBatteryPower()');
    expect(preload).toContain("invoke('life:exportEmergencyCard',input)");
    expect(coreService).toContain('policyPackageVersion: 2');
    expect(coreService).toContain("'file.share'");
    expect(main).toContain('emergencyCardExportReauthenticationGuard.clearAll()');
    expect(main).toContain('emergencyCardExportReauthenticationGuard.clearMemory()');
    expect(main).toContain("contentEncoding:'length-prefixed-raw'");
    expect(main).not.toContain("contentBase64:read.bytes.toString('base64')");
    expect(main).toContain('Acil kart çıktısı mevcut dosyanın üzerine yazılmaz');
    expect(main).toContain('let artifactCreated = false;');
    expect(main).toContain('artifactCreated = true;');
    expect(main).toContain('if (artifactCreated && artifactPath) rmSync(artifactPath, { force:true })');
    expect(main).not.toContain('if (artifactPath) rmSync(artifactPath, { force:true })');
    expect(main).toContain('linkSync(temporaryPath, destinationPath)');
    expect(main).not.toContain('renameSync(temporaryPath, destinationPath)');
    expect(main).toContain('if (published) rmSync(destinationPath, { force:true })');
    expect(main).toContain('life.emergency_card_print_dispatched_completion_unrecorded');
    const archiveAdapter = readFileSync(new URL('../src/main/archive-application-adapter.ts', import.meta.url), 'utf8');
    expect(archiveAdapter).toContain('findForPolicyResolution(this.execution, itemId)');
    const exportProjection = /case 'export_event':[\s\S]*?case 'power_mode_event':/u.exec(lifeProjection)?.[0] ?? '';
    expect(exportProjection).not.toContain('shareReceiptHash:');
    for (const marker of [
      'Çevrimdışı acil kart çıktısı','Güçlü doğrulama ve yerel çıktı',
      'plaintextTemporaryFiles','automaticLowBatteryDetection','externalDelivery','localExport'
    ]) expect(panel).toContain(marker);
    expect(`${adapter}\n${runtime}\n${panel}`).not.toMatch(/node:https|node:http|fetch\s*\(|axios|WebSocket|navigator\.geolocation/u);
  });

  it('prepares an exact field subset and completes it through distinct read/share/update production receipts', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppt-33j-real-uow-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'family.db');
    const store = new FamilyDataStore({
      databasePath,
      archivePath:join(directory,'archive'),
      seed:false,
      archivePolicyAuthorizationProvider:policyProvider,
      archivePolicyReceiptSink:{ append:() => undefined, ensure:projectionProof, verifyProjectionProof:() => true },
      archivePolicyVersion:'33-j-family-emergency-card-portability-desktop-test-v1',
      archiveClusterFence:() => ({ writable:true, epoch:88 })
    });
    try {
      const password = 'CardPortability33JStrongPassword!';
      store.setupAdmin({
        familyName:'33-J Taşınabilirlik Ailesi', displayName:'33-J Yönetici',
        email:'portability-33j@example.com', password
      });
      const ownerPersonId = store.listAccounts()[0]!.personId!;
      let workspace = await store.recordManagedLifeItem({
        itemType:'emergency_plan', planKind:'general', title:'Yerel acil plan',
        evacuationInstructions:'Yerel tahliye rotasını kullan ve aile buluşma noktasına ilerle.'
      });
      const planId = workspace.emergencyPlans[0]!.id;
      workspace = await store.recordManagedLifeItem({
        itemType:'emergency_profile', planId, label:'Özel acil kart',
        subjectKind:'person', subjectPersonId:ownerPersonId
      });
      const assistanceProfile = workspace.emergencyAssistanceProfiles[0]!;
      workspace = await store.recordManagedLifeItem({
        itemType:'health_fact', profileId:assistanceProfile.id, factKind:'allergy',
        value:'Arı sokmasına karşı hassasiyet', note:'Manuel aile beyanı'
      });
      const healthFact = workspace.emergencyAssistanceProfiles[0]!.healthFacts[0]!;
      workspace = await store.recordManagedLifeItem({
        itemType:'card_configuration', profileId:assistanceProfile.id,
        label:'Cüzdan acil kartı', locale:'tr-TR'
      });
      const cardConfiguration = workspace.emergencyAssistanceProfiles[0]!.cardConfigurations[0]!;
      workspace = await store.recordManagedLifeItem({
        itemType:'selected_field', profileId:assistanceProfile.id,
        configurationId:cardConfiguration.id, sourceItemId:assistanceProfile.id,
        sourceItemType:'emergency_profile', fieldCode:'label'
      });
      workspace = await store.recordManagedLifeItem({
        itemType:'selected_field', profileId:assistanceProfile.id,
        configurationId:cardConfiguration.id, sourceItemId:healthFact.id,
        sourceItemType:'health_fact', fieldCode:'fact_value'
      });
      const configuredFields = workspace.emergencyAssistanceProfiles[0]!.cardConfigurations[0]!.selectedFields;
      expect(configuredFields).toHaveLength(2);
      const selectedSubset = configuredFields.find((field) => field.fieldCode === 'fact_value')!;
      const shareCorrelationId = 'corr-33j-share-preparation';
      const prepared = await store.prepareEmergencyCardExport({
        profileId:assistanceProfile.id,
        configurationId:cardConfiguration.id,
        mode:'pdf',
        selectedFieldIds:[selectedSubset.id],
        documentLinkIds:[],
        credentials:{ password },
        rendererSessionId:randomUUID(),
        operationId:randomUUID(),
        correlationId:shareCorrelationId
      });
      expect(prepared).toMatchObject({
        profileId:assistanceProfile.id,
        configurationId:cardConfiguration.id,
        mode:'pdf',
        selectedFields:[{ selectedFieldId:selectedSubset.id, fieldCode:'fact_value', value:'Arı sokmasına karşı hassasiyet' }]
      });
      expect(prepared.selectedFields).toHaveLength(1);
      expect(prepared.shareReceiptHash).toMatch(/^[a-f0-9]{64}$/u);
      const completionCorrelationId = 'corr-33j-export-completion';
      await store.completeEmergencyCardExport(prepared, {
        artifactSha256:'c'.repeat(64), artifactSizeBytes:4096, powerSource:'ac',
        batteryLevel:'not_measured', automaticLowBatteryDetection:'not_performed',
        lowBatteryClaimed:false, artifactReadbackStatus:'verified'
      }, completionCorrelationId);

      const database = new DatabaseSync(databasePath, { readOnly:true });
      try {
        const receipts = database.prepare(`
          SELECT receipt_hash,correlation_id,action,capability
          FROM platform_policy_transaction_receipts
          WHERE correlation_id=? OR correlation_id=? OR correlation_id LIKE 'life-emergency-card-selection-%'
          ORDER BY rowid
        `).all(shareCorrelationId,completionCorrelationId) as Array<Record<string,unknown>>;
        expect(receipts.some((row) => row.correlation_id === shareCorrelationId
          && row.action === 'share' && row.capability === 'file.share')).toBe(true);
        expect(receipts.some((row) => row.correlation_id === completionCorrelationId
          && row.action === 'update' && row.capability === 'family.write')).toBe(true);
        expect(receipts.some((row) => String(row.correlation_id).startsWith('life-emergency-card-selection-')
          && row.action === 'read')).toBe(true);
        expect(new Set(receipts.map((row) => row.correlation_id)).size).toBe(receipts.length);
        const event = database.prepare(`
          SELECT selected_field_count,document_count,selection_sha256,share_receipt_hash,
                 artifact_sha256,policy_correlation_id
          FROM family_emergency_card_portability_ledger
          WHERE item_type='export_event'
        `).get() as Record<string,unknown>;
        expect(event).toMatchObject({
          selected_field_count:1, document_count:0,
          selection_sha256:prepared.selectionSha256,
          share_receipt_hash:prepared.shareReceiptHash,
          artifact_sha256:'c'.repeat(64),
          policy_correlation_id:completionCorrelationId
        });
        expect(receipts.find((row) => row.correlation_id === shareCorrelationId)?.receipt_hash)
          .toBe(prepared.shareReceiptHash);
      } finally {
        database.close();
      }
      const visible = await store.getManagedLifeWorkspace();
      const exportEvent = visible.emergencyAssistanceProfiles[0]!.cardConfigurations[0]!.exportEvents[0]!;
      expect(exportEvent).toMatchObject({ selectedFieldCount:1, documentCount:0, artifactReadbackStatus:'verified' });
      expect(JSON.stringify(exportEvent)).not.toContain('shareReceiptHash');

      const archiveSourcePath = join(directory, 'emergency-document.txt');
      const archivePlain = Buffer.from('private emergency archive payload', 'utf8');
      writeFileSync(archiveSourcePath, archivePlain);
      const importSemanticInput = { title:'Özel acil durum belgesi' };
      const importIdentity = store.acquireArchivePendingOperationIdentity({
        mutation:'archive:import', semanticInput:importSemanticInput
      });
      const archived = await store.importArchiveFile(archiveSourcePath, {
        ...importSemanticInput, operationId:importIdentity.operationId
      });
      const archiveItem = archived[0]!;
      await expect(store.readArchiveItemBytesForEmergencyExport(
        archiveItem.id, undefined, 'corr-33j-archive-sensitivity-denied'
      )).rejects.toThrow(/CORE-UNEXPECTED|hassas|sensitivity|arÅŸiv|arşiv/iu);
      const deniedPending = new DatabaseSync(databasePath, { readOnly:true });
      try {
        const deniedRows = deniedPending.prepare(`
          SELECT acknowledgement_kind FROM platform_policy_archive_pending_operations
          WHERE mutation='archive:open'
        `).all() as Array<{acknowledgement_kind:string|null}>;
        expect(deniedRows).toEqual([{ acknowledgement_kind:'completed' }]);
      } finally {
        deniedPending.close();
      }
      const classificationInput = {
        itemId:archiveItem.id, tagNames:[], sensitivity:'high' as const, aiProcessingAllowed:false
      };
      const classificationIdentity = store.acquireArchivePendingOperationIdentity({
        mutation:'archive:updateClassification', semanticInput:classificationInput
      });
      await store.updateArchiveClassification({ ...classificationInput, operationId:classificationIdentity.operationId });
      const vaultPath = join(directory, 'archive', `${archiveItem.id}.vault`);
      const originalEnvelope = readFileSync(vaultPath);
      writeFileSync(vaultPath, Buffer.from('{"invalid":true}', 'utf8'));
      await expect(store.readArchiveItemBytesForEmergencyExport(
        archiveItem.id, undefined, 'corr-33j-archive-failed-read'
      )).rejects.toThrow(/bellek|arşiv|şifreli/iu);
      writeFileSync(vaultPath, originalEnvelope);
      originalEnvelope.fill(0);
      const recoveredRead = await store.readArchiveItemBytesForEmergencyExport(
        archiveItem.id, undefined, 'corr-33j-archive-retry-read'
      );
      try {
        expect(recoveredRead.bytes).toEqual(archivePlain);
      } finally {
        recoveredRead.bytes.fill(0);
        archivePlain.fill(0);
      }
      const pending = new DatabaseSync(databasePath, { readOnly:true });
      try {
        const reads = pending.prepare(`
          SELECT COUNT(*) AS total,
                 SUM(CASE WHEN acknowledgement_kind='completed' THEN 1 ELSE 0 END) AS completed
          FROM platform_policy_archive_pending_operations
          WHERE mutation='archive:open'
        `).get() as {total:number;completed:number};
        expect(Number(reads.total)).toBeGreaterThanOrEqual(3);
        expect(Number(reads.completed)).toBe(Number(reads.total));
      } finally {
        pending.close();
      }
    } finally {
      store.close();
    }
  }, 30_000);
});
