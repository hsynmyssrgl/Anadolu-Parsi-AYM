import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

const app=readFileSync(new URL('../src/renderer/App.tsx',import.meta.url),'utf8');

describe('Security Center lazy module integrity',()=>{
  it('starts every heavy security module closed and mounts one selected area',()=>{
    expect(app).toContain('const [activeSecurityModule,setActiveSecurityModule]=useState<SecurityModuleId>();');
    expect(app).toContain('aria-expanded={activeSecurityModule===module.id}');
    expect(app).toContain('aria-controls={`security-module-${module.id}`}');
    expect(app).toContain('current===module.id?undefined:module.id');
    for(const marker of [
      "activeSecurityModule==='privacy-ownership'",
      "activeSecurityModule==='identity-access'",
      "activeSecurityModule==='local-controls'"
    ])expect(app).toContain(marker);
  });

  it('loads local security reads sequentially instead of congesting the governed queue',()=>{
    const effect=app.slice(app.indexOf('if(!window.pardus||!auth.authenticated||!activeSecurityModule)return;'),app.indexOf('const validateBackupPassword'));
    expect(effect.indexOf('listTrustedDevices()')).toBeLessThan(effect.indexOf('refreshPrivacyCenter()'));
    expect(effect.indexOf('refreshPrivacyCenter()')).toBeLessThan(effect.indexOf('listSecurityEventReceipts(20)'));
    expect(effect.indexOf('listSecurityEventReceipts(20)')).toBeLessThan(effect.indexOf('listFamilyDataImports(20)'));
    expect(effect).not.toContain('Promise.all');
  });
});
