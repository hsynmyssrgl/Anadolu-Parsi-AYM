import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';

const read = (path: string): string => readFileSync(path, 'utf8').replace(/\r\n/gu, '\n');

describe('B2-05/B6-03 desktop integration surface', () => {
  it('binds the four sensitivity profiles through domain, policy and SQLite repository metadata', () => {
    const domain = read('packages/domain/src/app-data.ts');
    const application = read('packages/application/src/ai-consent-use-cases.ts');
    const adapter = read('apps/desktop/src/main/ai-consent-application-adapter.ts');
    const repository = read('packages/repositories/src/ai-consent-repository.ts');
    expect(domain).toContain("SENSITIVE_DATA_CATEGORIES = ['child','health','finance','location']");
    expect(application).toContain("SENSITIVE_DATA_PROFILE_RESOURCE_TYPE = 'sensitive_data_profile'");
    expect(application).toContain("effectiveStatus: 'default_denied'");
    expect(application).toContain('explicitConsent !== true');
    expect(application).toContain('SensitiveDataAuthorizationPort');
    expect(application).not.toContain("actor.role === 'family_admin'");
    expect(adapter).toContain("action: 'administer'");
    expect(adapter).toContain('CentralAuthorizationService');
    expect(repository).toContain('listSensitiveDataInventory');
    expect(repository).toContain('SELECT COUNT(*) FROM health_records');
    expect(repository).not.toMatch(/SELECT\s+\*\s+FROM\s+(?:health_records|finance_records|locations)/iu);
  });

  it('exposes exact IPC and preload methods on the existing AI menu screen', () => {
    const main = read('apps/desktop/src/main/main.ts');
    const preload = read('apps/desktop/src/main/preload.ts');
    const rendererTypes = read('apps/desktop/src/renderer/global.d.ts');
    const renderer = read('apps/desktop/src/renderer/App.tsx');
    const navigation = read('packages/domain/src/product-surface-governance.ts');
    for (const channel of ['ai:listSensitiveProfiles','ai:upsertSensitiveConsent','ai:previewSensitiveExport']) {
      expect(main).toContain(channel);
      expect(preload).toContain(channel);
    }
    for (const method of ['listSensitiveDataProfiles','upsertSensitiveDataConsent','previewSensitiveExport']) {
      expect(rendererTypes).toContain(method);
      expect(renderer).toContain(method);
    }
    expect(renderer).toContain('Veri göndermeden önizleme oluştur');
    expect(renderer).toContain('Derhal iptal et');
    expect(navigation).toContain("id: 'ai'");
  });

  it('returns metadata-only preview state and provides no outbound transfer action', () => {
    const domain = read('packages/domain/src/app-data.ts');
    const application = read('packages/application/src/ai-consent-use-cases.ts');
    const main = read('apps/desktop/src/main/main.ts');
    expect(domain).toContain('outboundTransferPerformed:false');
    expect(application).toContain('outboundTransferPerformed: false');
    expect(application).toContain("action: 'ai.sensitive_export_previewed'");
    expect(main).not.toMatch(/ai:(?:send|transfer|upload)Sensitive/iu);
  });

  it('rejects malformed or implicit sensitive-consent IPC payloads before the handler', () => {
    expect(evaluateIpcIntegrationPolicy('ai:upsertConsent', [{
      purpose: 'summary', resourceType: 'event', resourceId: '*', status: 'granted'
    }])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('ai:previewAccess', ['summary'])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('ai:upsertConsent', [{
      purpose: 'sensitive_processing', resourceType: 'sensitive_data_profile', resourceId: 'health', status: 'granted'
    }])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('ai:previewAccess', ['external_export'])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('ai:listSensitiveProfiles', [])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('ai:listSensitiveProfiles', ['extra'])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('ai:upsertSensitiveConsent', [{
      category: 'health', purpose: 'external_export', status: 'granted', durationMinutes: 60, explicitConsent: true
    }])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('ai:upsertSensitiveConsent', [{
      category: 'health', purpose: 'external_export', status: 'granted', durationMinutes: 60, explicitConsent: false
    }])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('ai:previewSensitiveExport', [{
      categories: ['health','health'], destinationLabel: 'Hedef', businessPurpose: 'Kullanıcı isteği'
    }])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('ai:previewSensitiveExport', [{
      categories: ['health'], destinationLabel: 'Hedef', businessPurpose: 'Kullanıcı isteği', payload: 'yasak'
    }])).toMatchObject({ accepted: false, reason: 'UNKNOWN_OBJECT_FIELD' });
  });
});
