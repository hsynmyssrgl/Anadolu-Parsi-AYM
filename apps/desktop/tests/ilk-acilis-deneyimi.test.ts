import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach,describe,expect,it} from 'vitest';
import {evaluateIpcIntegrationPolicy,evaluateIpcIntegrationResultPolicy} from '../src/main/ipc-integration-policy.js';
import {resolveIpcRequestLifecyclePolicy} from '../src/main/ipc-request-lifecycle.js';
import {readFirstRunExperience,writeFirstRunExperience} from '../src/main/ui-language-preference-store.js';
import {resolveVaultSessionGuardAction} from '../src/main/vault-session-guard-policy.js';
import {selectPreferredFemaleNarrationVoice,selectPreferredNarrationVoice,waitForPreferredNarrationVoice} from '../src/renderer/accessibility.js';

const temporaryDirectories:string[]=[];
const temporaryFile=():string=>{const directory=mkdtempSync(join(tmpdir(),'parsyuva-ilk-acilis-'));temporaryDirectories.push(directory);return join(directory,'preferences','first-run-experience.json');};

afterEach(()=>{for(const directory of temporaryDirectories.splice(0))rmSync(directory,{recursive:true,force:true});});

describe('Ilk acilis deneyimi',()=>{
  it('temel kimlik kanallarini kesin ve fail-closed girdi sozlesmeleriyle kabul eder',()=>{
    const valid:ReadonlyArray<readonly[string,readonly unknown[]]>=[
      ['auth:getExternalIdentityProviders',[]],['auth:getState',[]],['auth:logout',[]],['auth:beginTwoFactorSetup',[]],['auth:listTrustedDevices',[]],
      ['auth:setup',[{familyName:'Yilmaz Ailesi',displayName:'Ayse Yilmaz',password:'Guclu-Parola-123!'}]],
      ['auth:login',[{accountId:'hesap-1',password:'Guclu-Parola-123!',secondFactorCode:'123456'}]],
      ['auth:changePassword',[{currentPassword:'Guclu-Parola-123!',newPassword:'Daha-Guclu-456!'}]],
      ['auth:enableTwoFactor',[{code:'123456'}]],['auth:disableTwoFactor',[{password:'Guclu-Parola-123!',code:'123456'}]],
      ['auth:trustCurrentDevice',[{password:'Guclu-Parola-123!',code:'123456',displayName:'Ev Bilgisayari'}]],
      ['auth:reauthorizeCurrentDeviceAfterRecovery',[{password:'Guclu-Parola-123!',code:'123456',confirmation:'GÜVENLİ CİHAZI YENİDEN YETKİLENDİR'}]],
      ['auth:listSecurityEventReceipts',[100]],['auth:verifySecurityEventReceipt',['{"schemaVersion":1}']],['auth:revokeTrustedDevice',['cihaz-1']],
      ['auth:loginWithWindowsHello',[{accountId:'hesap-1',fallback:{password:'Guclu-Parola-123!',secondFactorCode:'123456'}}]]
    ];
    for(const [channel,args] of valid)expect(evaluateIpcIntegrationPolicy(channel,args),channel).toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy('auth:getState',[{extra:true}])).toMatchObject({accepted:false});
    expect(evaluateIpcIntegrationPolicy('auth:setup',[{displayName:'Ayse',password:'Guclu-Parola-123!',token:'yasak'}])).toMatchObject({accepted:false,reason:'UNKNOWN_OBJECT_FIELD'});
    expect(evaluateIpcIntegrationPolicy('auth:reauthorizeCurrentDeviceAfterRecovery',[{password:'x',code:'1',confirmation:'YANLIS'}])).toMatchObject({accepted:false});
  });

  it('ilk tanitimin bir kez sunulmasini ana surec tercih dosyasinda kalici tutar',()=>{
    const file=temporaryFile();
    expect(readFirstRunExperience(file)).toEqual({introductionCompleted:false,narrationOffered:false});
    expect(writeFirstRunExperience(file,{introductionCompleted:false,narrationOffered:true})).toEqual({introductionCompleted:false,narrationOffered:true});
    expect(readFirstRunExperience(file)).toEqual({introductionCompleted:false,narrationOffered:true});
    expect(writeFirstRunExperience(file,{introductionCompleted:true,narrationOffered:false})).toEqual({introductionCompleted:true,narrationOffered:true});
    expect(readFirstRunExperience(file)).toEqual({introductionCompleted:true,narrationOffered:true});
    expect(JSON.parse(readFileSync(file,'utf8'))).toMatchObject({schemaVersion:1,introductionCompleted:true,narrationOffered:true});
  });

  it('ilk kullanim IPC ve zaman asimi sinirlarini dogrular',()=>{
    for(const channel of ['app:getFirstRunExperience','app:markFirstRunNarrationOffered','app:completeFirstRunIntroduction']){
      expect(evaluateIpcIntegrationPolicy(channel,[]),channel).toEqual({accepted:true});
      expect(evaluateIpcIntegrationPolicy(channel,[{extra:true}]),channel).toMatchObject({accepted:false});
      expect(evaluateIpcIntegrationResultPolicy(channel,{introductionCompleted:true,narrationOffered:true}),channel).toEqual({accepted:true});
      expect(evaluateIpcIntegrationResultPolicy(channel,{introductionCompleted:true,narrationOffered:false}),channel).toMatchObject({accepted:false});
    }
    for(const channel of ['app:getInfo','app:getFirstRunExperience','auth:getState'])expect(resolveIpcRequestLifecyclePolicy(channel)).toEqual({cancellable:true,latestWins:true,timeoutMs:10_000});
  });

  it('kilitli oturumda kasayi yeniden kimlik dogrulama icin acik tutar',()=>{
    expect(resolveVaultSessionGuardAction('active',true)).toBe('checkpoint');
    expect(resolveVaultSessionGuardAction('warning',true)).toBe('checkpoint');
    expect(resolveVaultSessionGuardAction('locked',false)).toBe('defer_locked');
    expect(resolveVaultSessionGuardAction('signed_out',false)).toBe('seal');
    expect(resolveVaultSessionGuardAction('active',false)).toBe('seal');
    const main=readFileSync(new URL('../src/main/main.ts',import.meta.url),'utf8');
    const guardStart=main.indexOf('function startVaultSessionGuard');
    const guard=main.slice(guardStart,guardStart+2_500);
    expect(guard).toContain("if (guardAction === 'defer_locked') return;");
    expect(guard.indexOf("if (guardAction === 'defer_locked') return;")).toBeLessThan(guard.indexOf('universalApiPolicyEnforcement().execute'));
  });

  it('ilk 2FA sonrasi ana uygulamadan once mevcut bilgisayari guclu dogrulamayla guvenilir yapar',()=>{
    const renderer=readFileSync(new URL('../src/renderer/App.tsx',import.meta.url),'utf8');
    expect(renderer).toContain("auth.authenticated && (!auth.twoFactorEnabled||auth.trustedDevice!==true)");
    expect(renderer).toContain("window.pardus.trustCurrentDevice({password,code");
    expect(renderer).toContain("trustedState.trustedDevice!==true");
    expect(renderer.indexOf("window.pardus.trustCurrentDevice({password,code")).toBeLessThan(renderer.indexOf('await bootstrapAuthenticatedSession();',renderer.indexOf('completeFirstRunSecuritySetup')));
    expect(renderer).toContain('autoComplete="current-password"');
  });

  it('Turkce ve Ingilizce anlatimda kadin sesi tercih eder',()=>{
    const voices=[{name:'Microsoft Tolga',lang:'tr-TR'},{name:'Microsoft Emel',lang:'tr-TR'},{name:'Microsoft Zira',lang:'en-US'}];
    expect(selectPreferredFemaleNarrationVoice(voices,'tr')?.name).toBe('Microsoft Emel');
    expect(selectPreferredFemaleNarrationVoice(voices,'en')?.name).toBe('Microsoft Zira');
    expect(selectPreferredFemaleNarrationVoice([{name:'Microsoft Tolga',lang:'tr-TR'}],'tr')).toBeUndefined();
    expect(selectPreferredNarrationVoice(voices,'tr')?.name).toBe('Microsoft Emel');
    expect(selectPreferredNarrationVoice([{name:'Microsoft Tolga',lang:'tr-TR'},{name:'Microsoft Zira',lang:'en-US'}],'tr')?.name).toBe('Microsoft Tolga');
    expect(selectPreferredNarrationVoice([{name:'Microsoft Zira',lang:'en-US'}],'tr')).toBeUndefined();
  });

  it('ses listesi gec yuklense de kadin sesini bekler',async()=>{
    let voices:ReadonlyArray<{name:string;lang:string}>=[];
    let listener:(()=>void)|undefined;
    const voicePromise=waitForPreferredNarrationVoice({
      getVoices:()=>voices,
      addEventListener:(_type,next)=>{listener=next;},
      removeEventListener:()=>{listener=undefined;}
    },'en',100);
    voices=[{name:'Microsoft Zira',lang:'en-US'}];
    listener?.();
    await expect(voicePromise).resolves.toMatchObject({name:'Microsoft Zira',lang:'en-US'});
  });
});
