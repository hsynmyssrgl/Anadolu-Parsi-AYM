import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';

const directory=mkdtempSync(join(tmpdir(),'panthera-mvp63-export-'));
const databasePath=join(directory,'family.db');
let store;
try{
  store=new FamilyDataStore({databasePath,applicationVersion:'24.07.2026.63',seed:true});
  if(!store.getAuthState().initialized) store.setupAdmin({displayName:'MVP63 Yöneticisi',email:'mvp63@example.com',password:'GucluMVP63Parolasi123!'});
  const manualPath=join(directory,'manual.json');
  const manual='{"ok":true}';
  writeFileSync(manualPath,manual,'utf8');
  const manualHash=createHash('sha256').update(manual).digest('hex');
  const artifact=store.recordExportArtifact('maintenance_history','json',manualPath,manualHash,Buffer.byteLength(manual),1);
  assert.equal(store.listExportArtifacts().some(x=>x.id===artifact.id),true);
  assert.equal(store.verifyExportArtifact(artifact.id).valid,true);
  const reportPath=join(directory,'diagnostic-report.json');
  store.exportDiagnosticReport(reportPath);
  const reports=store.listDiagnosticReports();
  assert.equal(reports.length,1);
  assert.equal(store.verifyDiagnosticReport(reports[0].id).valid,true);
  const content=store.readDiagnosticReport(reports[0].id);
  assert.equal(content.valid,true);
  assert.equal(content.content.includes('generatedAt'),true);
  const artifacts=store.listExportArtifacts();
  assert.equal(artifacts.some(x=>x.kind==='diagnostic_report'),true);
  console.log(JSON.stringify({version:'24.07.2026.63',status:'passed',checks:8,artifactCount:artifacts.length,reportCount:reports.length},null,2));
}finally{store?.close();rmSync(directory,{recursive:true,force:true});}
