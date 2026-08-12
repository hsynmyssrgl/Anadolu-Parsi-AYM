import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';

const preparednessInputs = [
  {
    itemType:'preparedness_kit', planId:'emergency-plan-1', kitKind:'household_72_hour',
    label:'Antre 72 saat hazırlık çantası'
  },
  {
    itemType:'preparedness_kit_item', planId:'emergency-plan-1', kitId:'preparedness-kit-1',
    category:'water', label:'İçme suyu', targetQuantityMilliunits:6_000,
    quantityUnit:'liter', expiresOn:'2027-08-13'
  },
  {
    itemType:'preparedness_kit_check', planId:'emergency-plan-1', kitItemId:'preparedness-item-1',
    status:'ready', actualQuantityMilliunits:6_000, checkedAt:'2026-08-13T08:30:00.000Z',
    note:'Manuel gözle kontrol edildi'
  },
  {
    itemType:'emergency_drill', planId:'emergency-plan-1', drillKind:'earthquake',
    status:'completed', occurredAt:'2026-08-13T08:00:00.000Z', durationSeconds:420,
    note:'Birincil buluşma noktasına yüründü'
  }
] as const;

describe('33-H B5/EXT-011/EXT-015 family emergency preparedness IPC boundary', () => {
  it('preserves the existing exact two LIFE channels and accepts all four preparedness variants', () => {
    expect(evaluateIpcIntegrationPolicy('life:getManagedWorkspace', [])).toEqual({ accepted:true });
    expect(evaluateIpcIntegrationPolicy('life:getManagedWorkspace', [{}])).toMatchObject({
      accepted:false, reason:'ARGUMENT_COUNT_MISMATCH'
    });
    for (const input of preparednessInputs) {
      expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [input])).toEqual({ accepted:true });
    }
  });

  it('enforces exact enums, milliunit integer bounds, expiry dates and drill duration', () => {
    for (const input of [
      { ...preparednessInputs[0], kitKind:'go_bag' },
      { ...preparednessInputs[1], category:'medicine' },
      { ...preparednessInputs[1], targetQuantityMilliunits:0 },
      { ...preparednessInputs[1], targetQuantityMilliunits:1.5 },
      { ...preparednessInputs[1], expiresOn:'2027-02-30' },
      { ...preparednessInputs[2], status:'unknown' },
      { ...preparednessInputs[2], actualQuantityMilliunits:-1 },
      { ...preparednessInputs[3], drillKind:'storm' },
      { ...preparednessInputs[3], durationSeconds:604_801 }
    ]) {
      expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [input]))
        .toMatchObject({ accepted:false, reason:'MANAGED_LIFE_ARGUMENT_INVALID' });
    }
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...preparednessInputs[0], label:'K'.repeat(120)
    }])).toEqual({ accepted:true });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...preparednessInputs[0], label:'K'.repeat(121)
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_ARGUMENT_INVALID' });
  });

  it('rejects unknown automation claims and non-canonical timestamps', () => {
    for (const input of [
      { ...preparednessInputs[0], barcodeLookup:'performed' },
      { ...preparednessInputs[1], expiryVerified:true },
      { ...preparednessInputs[2], sensorReading:true },
      { ...preparednessInputs[3], notificationDelivered:true }
    ]) {
      expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [input]))
        .toMatchObject({ accepted:false, reason:'UNKNOWN_OBJECT_FIELD' });
    }
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...preparednessInputs[2], checkedAt:'2026-08-13T08:30:00Z'
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_ARGUMENT_INVALID' });
  });

  it('rejects recursive token, PAN, path and base64 leakage before dispatch', () => {
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...preparednessInputs[0], token:'unsafe'
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_SECRET_FIELD_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...preparednessInputs[2], note:'Kart 4111 1111 1111 1111'
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_SECRET_VALUE_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...preparednessInputs[0], label:'C:\\Users\\family\\kit.txt'
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_PATH_VALUE_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...preparednessInputs[3], note:'A'.repeat(128)
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_SECRET_VALUE_PROHIBITED' });
  });

  it('composes visible plan-root preparedness data and renders honest local-only truth', () => {
    const adapter = readFileSync(new URL('../src/main/life-application-adapter.ts', import.meta.url), 'utf8');
    const runtime = readFileSync(new URL('../src/main/life-production-policy-runtime.ts', import.meta.url), 'utf8');
    const panel = readFileSync(new URL('../src/renderer/ManagedLifePanel.tsx', import.meta.url), 'utf8');
    expect(adapter).toContain('listFamilyEmergencyPreparednessItems');
    expect(adapter).toContain('visibleEmergencyPlanIds.has(item.planId)');
    expect(runtime).toContain('findFamilyEmergencyPlanForPolicyResolution');
    for (const marker of [
      'preparednessKits','emergencyDrills','barcodeLookup','expiryVerification',
      'notificationDelivery','sensorIntegration','readinessGuarantee','offlineAvailability',
      'exactPreparednessMilliunits'
    ]) expect(panel).toContain(marker);
    expect(panel).toContain('/^(0|[1-9]\\d*)(?:\\.(\\d{1,3}))?$/u.exec(value.trim())');
    expect(/^(0|[1-9]\d*)(?:\.(\d{1,3}))?$/u.test('1.2345')).toBe(false);
    expect(panel).toContain('if (!match) return undefined;');
    expect(panel).toContain('Hedef miktar en fazla üç ondalıklı');
    expect(`${adapter}\n${runtime}\n${panel}`).not.toMatch(/node:https|node:http|fetch\s*\(|axios|WebSocket|openExternal/u);
  });
});
