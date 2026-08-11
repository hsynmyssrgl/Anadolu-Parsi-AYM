import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';

const directory=mkdtempSync(join(tmpdir(),'panthera-mvp63-health-'));
const databasePath=join(directory,'family.db');
let store;
try{
  store=new FamilyDataStore({databasePath,applicationVersion:'24.07.2026.63',seed:true});
  if(!store.getAuthState().initialized) store.setupAdmin({displayName:'MVP63 Yöneticisi',email:'mvp63@example.com',password:'GucluMVP63Parolasi123!'});
  const updated=store.upsertMaintenancePolicy({enabled:true,intervalHours:12,keepDiagnosticDays:7,keepPerformanceDays:7});
  assert.equal(updated.intervalHours,12);
  assert.equal(updated.keepDiagnosticDays,7);
  const db=new DatabaseSync(databasePath);
  try{
    const old=new Date(Date.now()-20*86400_000).toISOString();
    db.prepare("INSERT INTO diagnostic_entries(id,severity,code,message,occurred_at) VALUES('old-diag','info','old.test','eski',?)").run(old);
    db.prepare("INSERT INTO performance_samples(id,cpu_load_percent,memory_usage_percent,database_bytes,archive_bytes,sampled_at) VALUES('old-perf',1,1,1,1,?)").run(old);
    db.prepare("INSERT INTO health_notifications(id,severity,code,title,message,created_at) VALUES('note-1','warning','test.note','Test','Mesaj',?)").run(new Date().toISOString());
  }finally{db.close();}
  assert.equal(store.listHealthNotifications().some(x=>x.id==='note-1'),true);
  const afterAck=store.acknowledgeHealthNotification('note-1').find(x=>x.id==='note-1');
  assert.ok(afterAck?.acknowledgedAt);
  const cycle=store.runAutomaticMaintenance();
  assert.equal(cycle.deletedDiagnostics>=1,true);
  assert.equal(cycle.deletedPerformanceSamples>=1,true);
  const policy=store.getMaintenancePolicy();
  assert.ok(policy.lastRunAt);
  assert.ok(policy.nextRunAt);
  const score=store.getSystemHealthScore();
  assert.equal(Number.isFinite(score.score),true);
  console.log(JSON.stringify({status:'passed',checks:10,policy,cycle,score:score.score},null,2));
}finally{store?.close();rmSync(directory,{recursive:true,force:true});}
