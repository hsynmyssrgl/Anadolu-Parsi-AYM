import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path:string):string => readFileSync(resolve(process.cwd(), path), 'utf8');
const preload = source('apps/desktop/src/main/preload.ts');
const globalTypes = source('apps/desktop/src/renderer/global.d.ts');
const main = source('apps/desktop/src/main/main.ts');
const channels = [
  'privacyOwnership:getCenter', 'privacyOwnership:correctAiMemory', 'privacyOwnership:restrictAiMemory',
  'privacyOwnership:deleteAiMemory', 'privacyOwnership:expireAiMemory', 'privacyOwnership:createRightsRequest',
  'privacyOwnership:updateRightsRequest', 'privacyOwnership:createIncident', 'privacyOwnership:updateIncident',
  'privacyOwnership:simulatePermission', 'privacyOwnership:exportEncrypted'
] as const;

describe('33-O privacy ownership desktop IPC bridge', () => {
  it('exposes and handles every governed channel exactly once', () => {
    for (const channel of channels) {
      expect(preload.match(new RegExp(`invoke\\('${channel}'`, 'gu'))).toHaveLength(1);
      expect(main.match(new RegExp(`registerIpcHandler\\('${channel}'`, 'gu'))).toHaveLength(1);
    }
  });

  it('keeps owner scope and export material out of renderer-controlled signatures', () => {
    expect(preload).toContain("getPrivacyOwnershipCenter:():Promise<PrivacyOwnershipControlCenterView>=>invoke('privacyOwnership:getCenter')");
    expect(preload).toContain("exportEncryptedPrivacyData:(input:EncryptedPrivacyDataExportIpcInput):Promise<EncryptedPrivacyDataExportIpcResult>=>invoke('privacyOwnership:exportEncrypted',input)");
    const rendererInput = preload.slice(preload.indexOf('export interface EncryptedPrivacyDataExportIpcInput'), preload.indexOf('export interface EncryptedPrivacyDataExportIpcResult'));
    expect(rendererInput).toContain('requestId: string');
    expect(rendererInput).toContain('passphrase: string');
    for (const forbidden of ['familyId', 'accountId', 'ownerPersonId', 'destination', 'value', 'metadata']) expect(rendererInput).not.toContain(forbidden);
  });

  it('derives destination only in main and fails closed on dialog cancellation', () => {
    expect(main).toContain("dialog.showSaveDialog({");
    expect(main).toContain("extensions: ['pptprivacy']");
    expect(main).toContain('if (selected.canceled || !selected.filePath) throw new PrivacyExportCancelledError()');
    expect(main).toContain("public readonly code = 'PRIVACY_EXPORT_CANCELLED' as const");
    expect(main).toContain('destination: selected.filePath');
    expect(main).toContain('exportEncryptedPrivacyData({');
  });

  it('declares a content-free success result without cancellation, path or delivery claims', () => {
    const resultType = globalTypes.slice(globalTypes.indexOf('interface EncryptedPrivacyDataExportIpcResult'), globalTypes.indexOf('export {};'));
    expect(resultType).toContain("delivery:'not_performed'");
    for (const forbidden of ['canceled:', 'filePath:', 'absolutePath:', 'recipient:', "delivery:'sent'"]) expect(resultType).not.toContain(forbidden);
  });
});
