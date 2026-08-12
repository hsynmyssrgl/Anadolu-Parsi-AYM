import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
const directory=mkdtempSync(join(tmpdir(),'panthera-mvp60-backup-'));
const testSecretProtector={protectionId:'backup-smoke-test-v1',required:false,isAvailable:()=>true,protect:(secret)=>Buffer.from(`test:${secret}`,'utf8').toString('base64'),unprotect:(protectedBase64)=>{const value=Buffer.from(protectedBase64,'base64').toString('utf8');assert.equal(value.startsWith('test:'),true);return value.slice(5);}};
let store;
try{
 store=new FamilyDataStore({databasePath:join(directory,'family.db'),applicationVersion:'24.07.2026.60',migrationBackupDirectory:join(directory,'migration-backups'),backupSecretProtector:testSecretProtector,backupPasswordPath:join(directory,'managed-backup-password.json')});
 if(!store.getAuthState().initialized)store.setupAdmin({displayName:'Backup Test Yöneticisi',email:'backup@example.com',password:'GucluBackupParolasi123!'});
 const targetPath=join(directory,'target');
 const targets=store.upsertBackupTarget({name:'Yerel Test Hedefi',kind:'local',path:targetPath,enabled:true,schedule:'manual',retentionCount:2,retryCount:0});
 assert.equal(targets.length,1);assert.equal(targets[0].name,'Yerel Test Hedefi');
 const result=store.runBackupTarget(targets[0].id);assert.equal(result.success,true);assert.equal(existsSync(result.run.filePath),true);
 const runs=store.listBackupRuns();assert.equal(runs.length,1);assert.equal(runs[0].status,'success');assert.ok(runs[0].sha256);
 const all=store.runAllBackupTargets();assert.equal(all.length,1);assert.equal(all[0].success,true);
 console.log(JSON.stringify({version:'24.07.2026.60',status:'passed',checks:8,targetCount:targets.length,runCount:store.listBackupRuns().length},null,2));
}finally{store?.close();rmSync(directory,{recursive:true,force:true});}
