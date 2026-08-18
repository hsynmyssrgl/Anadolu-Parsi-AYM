import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceSecretProtector } from '@ppt/security';
import { FACTORY_RESET_CONFIRMATION, FactoryResetManager } from '../src/main/factory-reset-manager.js';

class Protector implements DeviceSecretProtector{readonly protectionId='fixture';readonly required=true;isAvailable(){return true;}protect(v:string){return Buffer.from(v).toString('base64');}unprotect(v:string){return Buffer.from(v,'base64').toString();}}
const roots:string[]=[];afterEach(async()=>{await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});

describe('ilk kurulum durumuna dönüş',()=>{
  it('DPAPI korumalı isteği no-backup gerçeğiyle kaydeder, bilinen yedekleri ve kişisel kökü sonraki başlangıçta siler',async()=>{
    const root=await mkdtemp(join(tmpdir(),'aym-reset-'));roots.push(root);const userData=join(root,'user-data'),backup=join(root,'managed.pptbackup'),marker=join(root,'authority','reset.pptreset');
    await mkdir(userData);await writeFile(join(userData,'family.pptvault'),'cipher');await writeFile(backup,'backup');
    const manager=new FactoryResetManager({markerPath:marker,protector:new Protector(),userDataPath:userData,clock:()=>new Date('2026-08-18T00:00:00.000Z')});
    await manager.request([backup],FACTORY_RESET_CONFIRMATION);
    expect(await readFile(marker,'utf8')).not.toContain(userData);
    expect(await manager.executePending()).toEqual({executed:true,deletedBackupCount:1});
    await expect(readFile(backup)).rejects.toMatchObject({code:'ENOENT'});await expect(readFile(join(userData,'family.pptvault'))).rejects.toMatchObject({code:'ENOENT'});
  });

  it('yanlış onayı reddeder ve isteksiz başlangıçta hiçbir şey silmez',async()=>{
    const root=await mkdtemp(join(tmpdir(),'aym-reset-'));roots.push(root);const userData=join(root,'user-data');await mkdir(userData);
    const manager=new FactoryResetManager({markerPath:join(root,'reset.pptreset'),protector:new Protector(),userDataPath:userData});
    await expect(manager.request([],'EVET')).rejects.toThrow(/onayı/u);
    expect(await manager.executePending()).toEqual({executed:false,deletedBackupCount:0});
  });

  it('renderer, preload ve main zincirini exact onay, güçlü doğrulama ve dayanıklı IPC olarak sınırlar',async()=>{
    const [app,preload,global,main,lifecycle]=await Promise.all([
      readFile(new URL('../src/renderer/App.tsx',import.meta.url),'utf8'),
      readFile(new URL('../src/main/preload.ts',import.meta.url),'utf8'),
      readFile(new URL('../src/renderer/global.d.ts',import.meta.url),'utf8'),
      readFile(new URL('../src/main/main.ts',import.meta.url),'utf8'),
      readFile(new URL('../src/main/ipc-request-lifecycle.ts',import.meta.url),'utf8')
    ]);
    for(const marker of ['İlk kurulum anına dön','Bu işlem geri alınamaz.','Evet, tüm kişisel verileri sil','Hayır, vazgeç','ILK KURULUM ANINA DON','Gold etkinleştirmesi ve deneme başlangıcı sıfırlanmaz'])expect(app).toContain(marker);
    expect(preload).toContain("factoryResetToInitialState:(input:");
    expect(preload).toContain("invoke('system:factoryReset',input)");
    expect(global).toContain('factoryResetToInitialState(input:');
    expect(main).toContain("registerIpcHandler('system:factoryReset'");
    expect(main).toContain("Object.getPrototypeOf(input)!==Object.prototype");
    expect(main).toContain('store().prepareFactoryReset(input)');
    expect(lifecycle).toContain("const destructiveSystemChannels = new Set<string>(['system:factoryReset'])");
    expect(lifecycle).toContain('maxRequestsPerWindow:3');
  });
});
