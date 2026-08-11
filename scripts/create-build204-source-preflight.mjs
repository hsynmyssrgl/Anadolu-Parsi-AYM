import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
const output=process.argv[2]??'artifacts/validation/build204-source-preflight-final.json';
const checks=[
 ['build204-contract','artifacts/validation/build204-clean-rewrite-propagation-replace-bypass-contract.json'],
 ['build204-sqlite','artifacts/validation/build204-clean-rewrite-propagation-replace-bypass-sqlite-runtime.json'],
 ['build204-typescript','artifacts/validation/build204-clean-rewrite-propagation-replace-bypass-typescript.json'],
 ['source-integrity','artifacts/validation/build204-source-integrity.json'],
 ['active-version','artifacts/validation/active-version-contract.json'],
 ['active-documents','artifacts/validation/active-delivery-documents.json'],
 ['attestation-contract','artifacts/validation/delivery-attestation-contract.json']
];
const results=[];const failures=[];
for(const [id,path] of checks){try{const json=JSON.parse(await readFile(path,'utf8'));const status=json.status;results.push({id,path,status});if(status!=='PASS')failures.push(`${id}=${status}`)}catch(error){results.push({id,path,status:'FAIL'});failures.push(`${id}: ${error.message}`)}}
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:204,status:failures.length?'FAIL':'PASS',passed:results.filter(x=>x.status==='PASS').length,total:results.length,results,failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
if(failures.length){console.error(`Build 204 source preflight FAIL (${report.passed}/${report.total})`);for(const f of failures)console.error('-',f);process.exit(1)}
console.log(`Build 204 source preflight PASS (${report.passed}/${report.total})`);
