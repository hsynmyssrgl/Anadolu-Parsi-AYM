import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';

const emergencyInputs = [
  { itemType:'emergency_plan', planKind:'earthquake', title:'Aile deprem ve tahliye planı', evacuationInstructions:'Sarsıntı bitince gazı kapat, çantayı al ve birincil noktaya ilerle.' },
  { itemType:'meeting_point', planId:'emergency-plan-1', meetingPointKind:'primary', label:'Mahalle parkı kuzey kapısı', address:'Yerel manuel adres', directions:'Ana caddeden yaya geçidine ilerle.' },
  { itemType:'external_contact', planId:'emergency-plan-1', name:'Şehir dışı irtibat', phoneE164:'+905551112233', city:'Ankara', note:'Yalnız yerel aile kartı' },
  { itemType:'checklist_item', planId:'emergency-plan-1', label:'Gaz vanasını kapat', sortOrder:1 },
  { itemType:'checklist_status', planId:'emergency-plan-1', checklistItemId:'checklist-1', status:'completed' },
  { itemType:'member_status', planId:'emergency-plan-1', memberPersonId:'person-1', status:'needs_help', occurredAt:'2026-08-13T00:30:00.000Z', note:'Buluşma noktasına ulaşamadım' }
] as const;

describe('33-G B5-07/EXT-009/EXT-010/EXT-013 family emergency IPC boundary', () => {
  it('keeps the existing exact two-channel LIFE API and accepts all six emergency variants', () => {
    expect(evaluateIpcIntegrationPolicy('life:getManagedWorkspace', [])).toEqual({ accepted:true });
    expect(evaluateIpcIntegrationPolicy('life:getManagedWorkspace', [{}])).toMatchObject({
      accepted:false, reason:'ARGUMENT_COUNT_MISMATCH'
    });
    for (const input of emergencyInputs) {
      expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [input])).toEqual({ accepted:true });
    }
  });

  it('accepts only strict E.164 contact input and does not misclassify it as a PAN', () => {
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [emergencyInputs[2]])).toEqual({ accepted:true });
    for (const phoneE164 of ['05551112233','+005551112233','+90 555 111 22 33','+1234567','+1234567890123456']) {
      expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{ ...emergencyInputs[2], phoneE164 }]))
        .toMatchObject({ accepted:false, reason:'MANAGED_LIFE_ARGUMENT_INVALID' });
    }
  });

  it('keeps emergency text bounds aligned with the application and database contracts', () => {
    const safeLabelAtLimit = `${'Nokta '.repeat(39)}NoktaX`;
    expect(safeLabelAtLimit).toHaveLength(240);
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...emergencyInputs[1], label:safeLabelAtLimit
    }])).toEqual({ accepted:true });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...emergencyInputs[1], label:`${safeLabelAtLimit}x`
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_ARGUMENT_INVALID' });
    for (const input of [
      { ...emergencyInputs[0], evacuationInstructions:'x' },
      { ...emergencyInputs[1], address:'x' },
      { ...emergencyInputs[2], city:'x' },
      { ...emergencyInputs[3], label:'x' },
      { ...emergencyInputs[5], note:'x' }
    ]) {
      expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [input]))
        .toMatchObject({ accepted:false, reason:'MANAGED_LIFE_ARGUMENT_INVALID' });
    }
  });

  it('rejects renderer-supplied reporter identity, location telemetry and unknown fields', () => {
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...emergencyInputs[5], reportedByPersonId:'forged-reporter'
    }])).toMatchObject({ accepted:false, reason:'UNKNOWN_OBJECT_FIELD' });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...emergencyInputs[5], latitude:39.9, longitude:32.8
    }])).toMatchObject({ accepted:false, reason:'UNKNOWN_OBJECT_FIELD' });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...emergencyInputs[0], ownerPersonId:'forged-owner'
    }])).toMatchObject({ accepted:false, reason:'UNKNOWN_OBJECT_FIELD' });
  });

  it('rejects secret, PAN, path, base64 and non-canonical status inputs before dispatch', () => {
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...emergencyInputs[0], token:'unsafe'
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_SECRET_FIELD_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...emergencyInputs[1], directions:'Kart 4111 1111 1111 1111'
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_SECRET_VALUE_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...emergencyInputs[1], address:'C:\\Users\\family\\meeting.txt'
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_PATH_VALUE_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...emergencyInputs[5], note:'A'.repeat(128)
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_SECRET_VALUE_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...emergencyInputs[5], occurredAt:'2026-08-13T00:30:00Z'
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_ARGUMENT_INVALID' });
  });

  it('composes emergency root policy resolution and renders explicit offline truth without network primitives', () => {
    const runtime = readFileSync(new URL('../src/main/life-production-policy-runtime.ts', import.meta.url), 'utf8');
    const panel = readFileSync(new URL('../src/renderer/ManagedLifePanel.tsx', import.meta.url), 'utf8');
    expect(runtime).toContain('findFamilyEmergencyPlanForPolicyResolution');
    expect(panel).toContain('Acil durum merkezi');
    expect(panel).toContain('Çevrimdışı aile kaydıdır; acil yardım çağrısı değildir.');
    expect(panel).toContain('contact.phoneE164');
    expect(panel).not.toContain('contact.phoneMasked');
    expect(panel).toContain('sağlayıcıya, loga veya dışa aktarıma gönderilmez');
    expect(panel).toContain('merkezi yetki denetimi izin verirse');
    expect(panel).not.toContain('yalnız aile yöneticisi yetkisiyle');
    for (const marker of ['offlineAvailability','mapLookup','liveLocation','messageDelivery','emergencyServiceContact','emergencyServiceGuarantee','networkEgressAdded']) {
      expect(panel).toContain(marker);
    }
    expect(panel).not.toMatch(/\b(?:fetch|WebSocket|navigator\.geolocation|sendSMS)\b/u);
    expect(panel).not.toContain('tel:');
  });
});
