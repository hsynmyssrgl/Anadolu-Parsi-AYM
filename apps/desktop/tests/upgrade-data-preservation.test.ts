import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceSecretProtector } from '../src/main/device-secret-protector.js';
import { UserDataVault } from '../src/main/user-data-vault.js';

class FixtureProtector implements DeviceSecretProtector {
  public readonly protectionId='fixture-dpapi';
  public readonly required=true;
  public isAvailable(){return true;}
  public protect(value:string){return Buffer.from(value,'utf8').toString('base64');}
  public unprotect(value:string){return Buffer.from(value,'base64').toString('utf8');}
}

const roots:string[]=[];
afterEach(async()=>{
  for(const root of roots.splice(0)){
    await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:50});
  }
});

describe('sürüm yükseltmede veri koruma',()=>{
  it('mevcut şifreli kasa ve DPAPI başlığını sürüm başına no-overwrite SHA geri-okuma kanıtıyla saklar',async()=>{
    const root=await mkdtemp(join(tmpdir(),'aym-upgrade-'));roots.push(root);
    const headerPath=join(root,'secrets','user-data-vault.json');
    const containerPath=join(root,'data','family-data.pptvault');
    const backupDirectory=join(root,'safety-backups','surum-yukseltme');
    const vault=new UserDataVault({headerPath,containerPath,protector:new FixtureProtector()});
    const empty=vault.initialize('Guvenli!Parola123');empty.fill(0);
    const sentinel=Buffer.from('KISISEL-VERI-SENTINELI','utf8');
    vault.checkpoint(sentinel);vault.discardSession();
    const unlocked=vault.unlock('Guvenli!Parola123');expect(unlocked.equals(sentinel)).toBe(true);unlocked.fill(0);
    const evidence=vault.createUpgradeRollbackSnapshot({directory:backupDirectory,applicationVersion:'18.8.2026-30',createdAt:'2026-08-18T00:00:00.000Z'});
    expect(evidence).toMatchObject({schemaVersion:1,kind:'encrypted-upgrade-rollback',applicationVersion:'18.8.2026-30',encryptedAtRest:true,readbackVerified:true});
    if(!evidence)throw new Error('Geri dönüş kanıtı üretilmedi.');
    const encryptedCopy=await readFile(join(backupDirectory,evidence.containerFile));
    expect(encryptedCopy.toString('utf8')).not.toContain('KISISEL-VERI-SENTINELI');
    const repeated=vault.createUpgradeRollbackSnapshot({directory:backupDirectory,applicationVersion:'18.8.2026-30'});
    expect(repeated).toEqual(evidence);
  });

  it('bozulmuş veya yarım mevcut geri dönüş kopyasını ezmeden fail-closed reddeder',async()=>{
    const root=await mkdtemp(join(tmpdir(),'aym-upgrade-'));roots.push(root);
    const vault=new UserDataVault({headerPath:join(root,'header.json'),containerPath:join(root,'data.pptvault'),protector:new FixtureProtector()});
    vault.initialize('Guvenli!Parola123');vault.checkpoint(Buffer.from('cipher-source'));vault.discardSession();
    const bytes=vault.unlock('Guvenli!Parola123');bytes.fill(0);
    const directory=join(root,'rollback');
    const evidence=vault.createUpgradeRollbackSnapshot({directory,applicationVersion:'18.8.2026-30'});
    if(!evidence)throw new Error('Geri dönüş kanıtı üretilmedi.');
    await writeFile(join(directory,evidence.containerFile),'tampered');
    expect(()=>vault.createUpgradeRollbackSnapshot({directory,applicationVersion:'18.8.2026-30'})).toThrow(/bütünlüğü bozulmuş/u);
  });

  it('parola ve Windows Hello girişinin migration öncesi aynı korumalı snapshot sınırını kullandığını sabitler',async()=>{
    const main=await readFile(new URL('../src/main/main.ts',import.meta.url),'utf8');
    expect(main).toContain("directory: join(app.getPath('userData'), 'safety-backups', 'surum-yukseltme')");
    expect(main.match(/openUpgradableUserDataSession\(/gu)?.length).toBeGreaterThanOrEqual(3);
    expect(main).toContain("event: 'database.upgrade.rollback_snapshot_verified'");
    expect(main).toContain('encryptedAtRest: snapshot.encryptedAtRest');
    expect(main).toContain('readbackVerified: snapshot.readbackVerified');
  });
});
