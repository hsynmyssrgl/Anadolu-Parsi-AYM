import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import {
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '@ppt/repositories';
import { FamilyDataStore } from '../src/main/data-store.js';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';

const POLICY_VERSION = '33-i-family-emergency-assistance-desktop-test-v1';
const kernel = new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('33-i-family-emergency-assistance-controlled-test-key', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['family.read','family.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create','update','delete','record']
});
const provider:PlatformPolicyAuthorizationProvider = Object.freeze({
  resolvePolicyPackage: () => kernel.policyPackage,
  authorize({ request, nonce }) {
    return Object.freeze({
      effectiveRequest: request,
      authorization: kernel.authorizeWithReceipt(request, request.occurredAt, nonce)
    });
  },
  verify: ({ request, receipt }) => kernel.verifyReceiptForRequest(receipt, request)
});
const projectionProof = (record:PlatformPolicyReceiptRecord):PlatformPolicyJournalProjectionProof => Object.freeze({
  schemaVersion: 1,
  receiptHash: computePlatformPolicyReceiptHash(record.receipt),
  recordHash: computePlatformPolicyReceiptRecordHash(record),
  receiptNonce: record.receipt.nonce,
  entrySequence: 1,
  entryHash: '8'.repeat(64),
  headSequence: 1,
  headHash: '8'.repeat(64),
  journalSizeBytes: 512,
  issuedAt: record.recordedAt,
  proofMac: 'b'.repeat(64)
});

const assistanceInputs = [
  {
    itemType:'emergency_profile', planId:'emergency-plan-1', label:'Ayşe acil sağlık kartı',
    subjectKind:'person', subjectPersonId:'person-1'
  },
  {
    itemType:'emergency_profile', planId:'emergency-plan-1', label:'Kedi tahliye kartı',
    subjectKind:'pet', subjectPetId:'pet-local-1', responsiblePersonId:'person-1'
  },
  {
    itemType:'health_fact', profileId:'assistance-profile-1', factKind:'blood_type',
    bloodType:'a_positive', note:'Manuel aile beyanı'
  },
  {
    itemType:'health_fact', profileId:'assistance-profile-1', factKind:'allergy',
    value:'Arı sokmasına karşı hassasiyet', note:'Manuel gözlem'
  },
  {
    itemType:'emergency_contact', profileId:'assistance-profile-1', name:'Yakın irtibat',
    phoneE164:'+905551112233', relationship:'Kardeş', note:'Yalnız özel yerel kart'
  },
  {
    itemType:'assistance_instruction', profileId:'assistance-profile-1',
    instructionKind:'mobility', instruction:'Tahliye sandalyesini giriş kapısının yanından al.',
    note:'İki kişi birlikte destek olur'
  }
] as const;

describe('33-I EXT-012/EXT-014 family emergency assistance IPC and UI boundary', () => {
  it('keeps the existing two LIFE channels and accepts person, pet and all child variants', () => {
    expect(evaluateIpcIntegrationPolicy('life:getManagedWorkspace', [])).toEqual({ accepted:true });
    expect(evaluateIpcIntegrationPolicy('life:getManagedWorkspace', [{}])).toMatchObject({
      accepted:false, reason:'ARGUMENT_COUNT_MISMATCH'
    });
    for (const input of assistanceInputs) {
      expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [input])).toEqual({ accepted:true });
    }
  });

  it('keeps root privacy and ownership server-derived with exact person/pet semantics', () => {
    for (const input of [
      { ...assistanceInputs[0], privacy:'family' },
      { ...assistanceInputs[0], ownerPersonId:'person-1' },
      { ...assistanceInputs[0], responsiblePersonId:'person-1' },
      { ...assistanceInputs[1], subjectPersonId:'person-1' },
      { ...assistanceInputs[1], responsiblePersonId:undefined },
      { ...assistanceInputs[0], subjectKind:'household' }
    ]) {
      expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [input])).toMatchObject({ accepted:false });
    }
  });

  it('enforces the discriminated health fact, strict E.164 and bounded instruction contract', () => {
    for (const input of [
      { ...assistanceInputs[2], value:'A Rh+' },
      { ...assistanceInputs[3], bloodType:'a_positive' },
      { ...assistanceInputs[3], value:'x' },
      { ...assistanceInputs[4], phoneE164:'05551112233' },
      { ...assistanceInputs[4], phoneE164:'+90 555 111 22 33' },
      { ...assistanceInputs[5], instructionKind:'transport' },
      { ...assistanceInputs[5], instruction:'x' },
      { ...assistanceInputs[5], instruction:'A'.repeat(1_001) }
    ]) {
      expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [input]))
        .toMatchObject({ accepted:false });
    }
  });

  it('rejects recursive secret, path, PAN, base64 and false service claims before dispatch', () => {
    for (const input of [
      { ...assistanceInputs[0], token:'unsafe' },
      { ...assistanceInputs[3], value:'C:\\Users\\family\\health.txt' },
      { ...assistanceInputs[4], note:'Kart 4111 1111 1111 1111' },
      { ...assistanceInputs[5], note:'A'.repeat(128) },
      { ...assistanceInputs[2], medicallyVerified:true },
      { ...assistanceInputs[4], messageDelivered:true },
      { ...assistanceInputs[5], emergencyServiceCalled:true }
    ]) {
      expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [input])).toMatchObject({ accepted:false });
    }
  });

  it('composes an independent private policy root and renders accessible honest local-only cards', () => {
    const adapter = readFileSync(new URL('../src/main/life-application-adapter.ts', import.meta.url), 'utf8');
    const runtime = readFileSync(new URL('../src/main/life-production-policy-runtime.ts', import.meta.url), 'utf8');
    const panel = readFileSync(new URL('../src/renderer/ManagedLifePanel.tsx', import.meta.url), 'utf8');
    const main = readFileSync(new URL('../src/main/main.ts', import.meta.url), 'utf8');
    const preload = readFileSync(new URL('../src/main/preload.ts', import.meta.url), 'utf8');
    expect(adapter).toContain('listFamilyEmergencyAssistanceItems');
    expect(adapter).toContain('findFamilyEmergencyAssistanceProfile');
    expect(runtime).toContain('findFamilyEmergencyAssistanceProfileForPolicyResolution');
    expect(main).toContain("'life:getManagedWorkspace'");
    expect(main).toContain("'life:recordManagedItem'");
    expect(preload).toContain("'life:getManagedWorkspace'");
    expect(preload).toContain("'life:recordManagedItem'");
    for (const marker of [
      'Acil sağlık ve iletişim kartı','Özel yardım planı','emergencyAssistanceProfiles',
      'medicalVerification','healthRegistryLookup','exportSharing','offlineAvailability',
      'Plan bağlantısı erişim vermez','telefon veya sağlık içeriği loga'
    ]) expect(panel).toContain(marker);
    expect(panel).toContain('aria-labelledby="emergency-assistance-heading"');
    expect(panel).not.toMatch(/\b(?:fetch|WebSocket|navigator\.geolocation|sendSMS)\b/u);
    expect(panel).not.toContain('tel:');
  });

  it('records a private root and child through the real production unit-of-work with content-free evidence', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppt-33i-assistance-desktop-'));
    const databasePath = join(directory, 'family.db');
    const store = new FamilyDataStore({
      databasePath,
      seed:false,
      archivePolicyAuthorizationProvider:provider,
      archivePolicyReceiptSink:{
        append:() => undefined,
        ensure:projectionProof,
        verifyProjectionProof:() => true
      },
      archivePolicyVersion:POLICY_VERSION,
      archiveClusterFence:() => ({ writable:true, epoch:87 })
    });
    try {
      store.setupAdmin({
        familyName:'33-I Yardım Ailesi', displayName:'33-I Yardım Yöneticisi',
        email:'assistance-33i@example.com', password:'Assistance33IGucluParola!'
      });
      const ownerPersonId = store.listAccounts()[0]!.personId!;
      let workspace = await store.recordManagedLifeItem({
        itemType:'emergency_plan', planKind:'general', title:'Aile acil durum planı',
        evacuationInstructions:'Güvenli çıkış rotasını kullan ve yerel buluşma noktasına ilerle.'
      });
      const planId = workspace.emergencyPlans[0]!.id;
      workspace = await store.recordManagedLifeItem({
        itemType:'emergency_profile', planId, label:'Özel acil sağlık kartı',
        subjectKind:'person', subjectPersonId:ownerPersonId
      });
      const profileId = workspace.emergencyAssistanceProfiles[0]!.id;
      workspace = await store.recordManagedLifeItem({
        itemType:'health_fact', profileId, factKind:'allergy',
        value:'Arı sokmasına karşı hassasiyet', note:'Manuel aile beyanı'
      });
      workspace = await store.recordManagedLifeItem({
        itemType:'emergency_contact', profileId, name:'Yakın irtibat',
        phoneE164:'+905551112233', relationship:'Kardeş', note:'Yalnız özel yerel kart'
      });
      workspace = await store.recordManagedLifeItem({
        itemType:'assistance_instruction', profileId, instructionKind:'mobility',
        instruction:'Tahliye sandalyesini giriş kapısının yanından al.',
        note:'İki kişi birlikte destek olur'
      });
      expect(workspace.emergencyAssistanceProfiles[0]).toMatchObject({
        id:profileId, privacy:'private', subjectKind:'person', subjectPersonId:ownerPersonId,
        healthFacts:[{ factKind:'allergy', value:'Arı sokmasına karşı hassasiyet' }],
        emergencyContacts:[{ name:'Yakın irtibat', phoneE164:'+905551112233' }],
        assistanceInstructions:[{
          instructionKind:'mobility', instruction:'Tahliye sandalyesini giriş kapısının yanından al.'
        }]
      });

      const database = new DatabaseSync(databasePath, { readOnly:true });
      try {
        const childOutbox = database.prepare(`
          SELECT payload_json,policy_action,policy_resource_id
          FROM event_outbox
          WHERE event_type='life.managed.item_recorded' AND policy_resource_id=?
          ORDER BY rowid
        `).all(profileId) as Array<{
          payload_json:string; policy_action:string; policy_resource_id:string;
        }>;
        expect(childOutbox).toHaveLength(4);
        for (const row of childOutbox) {
          expect(row.policy_resource_id).toBe(profileId);
          const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
          expect(Object.keys(payload).sort()).toEqual(['itemId','privacy','recordId']);
          expect(payload).toMatchObject({ recordId:profileId, privacy:'private' });
        }
        const serializedOutbox = childOutbox.map((row) => row.payload_json).join('\n');
        expect(serializedOutbox).not.toContain('health_fact');
        expect(serializedOutbox).not.toContain('Arı sokmasına');
        expect(serializedOutbox).not.toContain('+905551112233');
        expect(serializedOutbox).not.toContain('Tahliye sandalyesini');
        const childAudit = database.prepare(`
          SELECT action,resource_id,policy_action,policy_resource_id
          FROM audit_log
          WHERE action='life.managed.private_item.recorded'
          ORDER BY rowid DESC LIMIT 1
        `).get() as Record<string, unknown>;
        expect(childAudit).toMatchObject({
          action:'life.managed.private_item.recorded', resource_id:profileId,
          policy_action:'update', policy_resource_id:profileId
        });
      } finally {
        database.close();
      }
    } finally {
      store.close();
      rmSync(directory, { recursive:true, force:true });
    }
  });
});
