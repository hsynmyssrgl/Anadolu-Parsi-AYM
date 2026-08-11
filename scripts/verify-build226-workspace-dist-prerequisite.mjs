import { access, mkdir, writeFile } from 'node:fs/promises';
const reportPath = process.argv[2] ?? 'artifacts/validation/build226-workspace-dist-prerequisite.json';
const packages = ['core','contracts','config','logging','database','domain','events','repository-contracts','repositories','security','application','infrastructure','test-data'];
const results=[];
for (const name of packages) {
  for (const leaf of ['index.js','index.d.ts']) {
    const path=`packages/${name}/dist/${leaf}`;
    let ok=true;
    try { await access(path); } catch { ok=false; }
    results.push({id:`${name}-${leaf}`,path,status:ok?'PASS':'FAIL'});
  }
}
const status=results.every(x=>x.status==='PASS')?'PASS':'FAIL';
await mkdir('artifacts/validation',{recursive:true});
await writeFile(reportPath,`${JSON.stringify({schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',applicationVersion:'02.08.2026.226',packageVersion:'2.8.2026-226',build:226,purpose:'Fail-closed workspace package dist readiness before Windows package:win',status,checks:results.length,passCount:results.filter(x=>x.status==='PASS').length,results,generatedAt:new Date().toISOString()},null,2)}\n`);
console.log(`Build226 workspace dist prerequisite: ${status} (${results.filter(x=>x.status==='PASS').length}/${results.length}).`);
if(status!=='PASS') process.exitCode=1;
