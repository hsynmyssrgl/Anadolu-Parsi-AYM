import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createVerifiedUninstallBackups, discoverUninstallBackupTargets } from '../src/main/uninstall-backup-assistant.js';

const roots:string[]=[];
afterEach(async()=>{await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
const temp=async()=>{const root=await mkdtemp(join(tmpdir(),'aym-uninstall-'));roots.push(root);return root;};

describe('kaldırma yedek yardımcısı',()=>{
  it('Belgeler ve yalnız kurulu eşitleme sağlayıcılarını çoklu hedef yapar',async()=>{
    const root=await temp(),documents=join(root,'Documents'),oneDrive=join(root,'OneDrive'),home=join(root,'Home');
    await Promise.all([mkdir(documents),mkdir(oneDrive),mkdir(join(home,'iCloudDrive'),{recursive:true})]);
    const targets=await discoverUninstallBackupTargets({documentsPath:documents,homePath:home,environment:{OneDrive:oneDrive}});
    expect(targets.map(target=>target.kind)).toEqual(['local_documents','onedrive','icloud_drive']);
    expect(targets.some(target=>target.kind==='google_drive')).toBe(false);
  });

  it('kalıcı şifreli kökleri birden çok hedefe kopyalar ve hash manifestini doğrular',async()=>{
    const root=await temp(),userData=join(root,'UserData'),targetA=join(root,'A'),targetB=join(root,'B');
    await mkdir(join(userData,'data'),{recursive:true});await mkdir(join(userData,'secrets'),{recursive:true});
    await writeFile(join(userData,'data','family-data.pptvault'),'ciphertext');await writeFile(join(userData,'secrets','user-data-vault.json'),'protected-header');
    const result=await createVerifiedUninstallBackups({userDataPath:userData,targets:[{kind:'local_documents',rootPath:targetA},{kind:'onedrive',rootPath:targetB}],createdAt:'2026-08-18T00:00:00.000Z',applicationVersion:'18.08.2026.30'});
    expect(result).toMatchObject({status:'success',copiedFiles:2,copiedBytes:26});
    for(const directory of result.backupDirectories){
      const manifest=JSON.parse(await readFile(join(directory,'YEDEK_MANIFESTOSU.json'),'utf8'));
      expect(manifest).toMatchObject({encryptedPersistentCopy:true,cloudUploadObserved:false});
      expect(manifest.files).toHaveLength(2);
    }
  });

  it('kaynakla iç içe hedefi fail-closed reddeder',async()=>{
    const root=await temp(),userData=join(root,'UserData');await mkdir(join(userData,'data'),{recursive:true});
    await writeFile(join(userData,'data','family-data.pptvault'),'ciphertext');
    await expect(createVerifiedUninstallBackups({userDataPath:userData,targets:[{kind:'local_documents',rootPath:join(userData,'backup')}],createdAt:'2026-08-18T00:00:00.000Z',applicationVersion:'1'})).rejects.toThrow(/iç içe/u);
  });
});
