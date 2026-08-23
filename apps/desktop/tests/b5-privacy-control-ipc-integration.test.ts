import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';
import { resolveIpcRequestLifecyclePolicy } from '../src/main/ipc-request-lifecycle.js';
const read=(path:string)=>readFileSync(path,'utf8');
describe('33-K B5-06/EXT-039 desktop boundary',()=>{
  it('exposes exactly the governed center channels',()=>{
    for(const channel of ['privacyControl:getCenter','privacyControl:setLiveLocationConsent','privacyControl:shutdownLostDevice']){
      expect(read('apps/desktop/src/main/main.ts')).toContain(channel);expect(read('apps/desktop/src/main/preload.ts')).toContain(channel);
    }
    expect(evaluateIpcIntegrationPolicy('privacyControl:getCenter',[])).toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy('privacyControl:setLiveLocationConsent',[{status:'granted',durationMinutes:60,explicitConsent:true}])).toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy('privacyControl:setLiveLocationConsent',[{status:'granted',durationMinutes:60,explicitConsent:false}])).toMatchObject({accepted:false});
    expect(evaluateIpcIntegrationPolicy('privacyControl:shutdownLostDevice',[{trustedDeviceId:'device-1',password:'password',confirmation:'KAYIP CİHAZ YETKİLERİNİ KAPAT'}])).toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy('privacyControl:shutdownLostDevice',[{trustedDeviceId:'device-1',password:'password',confirmation:'sil'}])).toMatchObject({accepted:false});
    expect(resolveIpcRequestLifecyclePolicy('privacyControl:getCenter')).toEqual({cancellable:true,latestWins:false,timeoutMs:30_000});
  });
  it('binds central PEP/UoW and makes no remote claim',()=>{
    const adapter=read('apps/desktop/src/main/privacy-control-application-adapter.ts');const application=read('packages/application/src/privacy-control-use-cases.ts');const ui=read('apps/desktop/src/renderer/App.tsx');
    expect(adapter).toContain('CentralAuthorizationService');expect(adapter).toContain('transactionExecutor.execute');expect(adapter).not.toContain("actor.role === 'family_admin'");
    expect(application).toContain('revokeOfflineCapabilityLease');expect(application).toContain('advanceSecurityEpoch');expect(application).toContain('revokeAllTrustedDevices');expect(application).toContain('this.session.clear()');
    expect(read('apps/desktop/src/main/main.ts')).toContain("offlineSensitiveCache.lock('REVOKED')");
    expect(read('apps/desktop/src/main/main.ts')).toContain('sealUserDataSession()');
    expect(read('apps/desktop/src/main/ipc-read-sharing.ts')).toMatch(/MUTATION_ACTION_PATTERN[^\n]+shutdown/u);
    expect(ui).toContain('uzaktan silme, MDM veya ağ üzerinden teslim garantisi vermez');
    expect(ui).toContain('Promise.allSettled([window.pardus.listTrustedDevices()');
    expect(ui).toContain('Gizlilik merkezi güvenli biçimde yüklenemedi. Yerel yetki durumu kapalı tutuldu; yeniden deneyin.');
    expect(ui).toContain('disabled={!privacyCenter||liveLocationDuration<15||liveLocationDuration>43200}');
    for(const marker of ["scope:'local_authority_only'","remoteWipePerformed:false","mdmOperationPerformed:false","networkDelivery:'not_performed'"])expect(application).toContain(marker);
    expect(read('apps/desktop/src/main/main.ts')).not.toMatch(/privacyControl:(?:wipe|mdm|deliver|send|upload)/u);
  });
});
