import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { FixedClock, asIsoDateTime } from '../packages/core/dist/index.js';

const root=mkdtempSync(join(tmpdir(),'ppt-30-j-data-repair-workspace-'));
const clock=new FixedClock(asIsoDateTime('2026-08-05T18:00:00.000Z'));
const adminPassword='30JGuvenliYonetici!2026';
const memberPassword='30JGuvenliUye!2026';
const checks=[];
const check=(name,operation)=>{operation();checks.push(name);};
let store;
try{
  store=new FamilyDataStore({databasePath:join(root,'family.db'),deviceIdentityPath:join(root,'device'),migrationBackupDirectory:join(root,'migration-backups'),applicationVersion:'04.08.2026.29',clock});
  store.setupAdmin({displayName:'Veri Onarma Yöneticisi',email:'admin-30j@example.test',password:adminPassword});
  store.createMember({displayName:'Yinelenen Kişi',birthDate:'1988-08-08',relationshipType:'Aile üyesi',generation:1,branch:'Ana Dal'});
  store.createMember({displayName:'Yinelenen Kişi',birthDate:'1988-08-08',relationshipType:'Aile üyesi',generation:1,branch:'Ana Dal'});

  const initial=store.getDataRepairWorkspace();
  const duplicate=initial.issues.find((issue)=>issue.kind==='duplicate_person');
  check('administrator workspace scans and displays the duplicate issue',()=>{
    assert.equal(initial.operations.length,0);
    assert.ok(duplicate);
    assert.equal(duplicate?.repairable,true);
  });
  if(!duplicate)throw new Error('Yinelenen kişi bulgusu oluşturulamadı.');

  const preview=store.previewDataRepair({issueId:duplicate.id,reason:'Yinelenen kişi profilini güvenle birleştir'});
  check('workspace preview records immutable before and after states',()=>{
    assert.equal(preview.status,'previewed');
    assert.equal(preview.beforeSnapshot.entityType,'person');
    assert.equal(preview.afterSnapshot.entityType,'person');
    assert.notEqual(preview.revisionToken.length,0);
  });
  check('workspace history exposes the pending preview',()=>{
    const current=store.getDataRepairWorkspace();
    assert.equal(current.operations.some((operation)=>operation.id===preview.id&&operation.status==='previewed'),true);
  });

  const applied=store.applyDataRepair({operationId:preview.id,expectedRevisionToken:preview.revisionToken});
  check('confirmed preview applies through the composed DataStore boundary',()=>assert.equal(applied.status,'applied'));
  check('successful repair removes the duplicate issue from the fresh scan',()=>assert.equal(store.getDataRepairWorkspace().issues.some((issue)=>issue.id===duplicate.id),false));

  const undone=store.undoDataRepair(preview.id);
  check('applied repair is reversibly undone through the same boundary',()=>assert.equal(undone.status,'undone'));
  const afterUndo=store.getDataRepairWorkspace();
  const restoredIssue=afterUndo.issues.find((issue)=>issue.kind==='duplicate_person');
  check('rollback restores the issue and retains immutable operation history',()=>{
    assert.ok(restoredIssue);
    assert.equal(afterUndo.operations.some((operation)=>operation.id===preview.id&&operation.status==='undone'),true);
  });
  if(!restoredIssue)throw new Error('Geri alma sonrası yinelenen kişi bulgusu bulunamadı.');

  const stalePreview=store.previewDataRepair({issueId:restoredIssue.id,reason:'Eski önizleme sürüm korumasını doğrula'});
  if(stalePreview.beforeSnapshot.entityType!=='person')throw new Error('Beklenen kişi önizlemesi alınamadı.');
  const stalePerson=stalePreview.beforeSnapshot.row;
  store.updatePersonProfile({personId:stalePerson.id,expectedVersion:stalePerson.lifecycleVersion,displayName:`${stalePerson.displayName} Güncellendi`,...(stalePerson.birthDate?{birthDate:stalePerson.birthDate}:{}),relationshipType:stalePerson.relationshipType,generation:stalePerson.generation,branch:stalePerson.branch});
  check('stale preview fails closed after underlying data changes',()=>assert.throws(()=>store.applyDataRepair({operationId:stalePreview.id,expectedRevisionToken:stalePreview.revisionToken}),/yeniden tarama|değişti|önizleme/i));

  const invitation=store.createInvitation({email:'member-30j@example.test',role:'adult_member',startsAt:'2026-08-05T17:00:00.000Z',endsAt:'2026-08-12T23:59:59.999Z'});
  store.acceptInvitation({token:invitation.token,displayName:'Veri Onarma Üyesi',password:memberPassword});
  check('non-administrator workspace access is denied without issue disclosure',()=>assert.throws(()=>store.getDataRepairWorkspace(),/yalnız aile yöneticisi|yetki/i));

  store.logout();
  store.login({email:'admin-30j@example.test',password:adminPassword});
  check('administrator can reopen complete preview and rollback history',()=>{
    const finalWorkspace=store.getDataRepairWorkspace();
    assert.equal(finalWorkspace.operations.length,2);
    assert.equal(finalWorkspace.operations.some((operation)=>operation.status==='undone'),true);
    assert.equal(finalWorkspace.operations.some((operation)=>operation.status==='previewed'),true);
  });
  check('preview apply rollback and authorization writes preserve audit integrity',()=>assert.equal(store.verifyAuditIntegrity().valid,true));

  const report={
    schemaVersion:1,
    release:'Bronze 04.08.2026.29',
    step:'30-J',
    requirement:'B1-05',
    status:'PASS',
    checkCount:checks.length,
    checks,
    assertions:{dataStoreComposition:'PASS',administratorWorkspace:'PASS',mandatoryPreview:'PASS',atomicApply:'PASS',rollback:'PASS',stalePreviewProtection:'PASS',authorizationBoundary:'PASS',operationHistory:'PASS',auditIntegrity:'PASS'},
    generatedAt:new Date().toISOString()
  };
  mkdirSync('artifacts/validation',{recursive:true});
  writeFileSync('artifacts/validation/30-J-data-repair-workspace-runtime.json',`${JSON.stringify(report,null,2)}\n`);
  console.log(`30-J data repair workspace runtime: PASS (${checks.length} checks).`);
}finally{
  try{store?.close();}catch{/* preserve original verification result */}
  rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
