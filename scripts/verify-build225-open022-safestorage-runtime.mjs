import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
const root=process.cwd(), temp=await mkdtemp(join(tmpdir(),'ppt-build225-open022-'));
for(const file of ['apps/desktop/src/main/windows-open022-side-artifact-evidence-probe.ts','apps/desktop/src/main/device-secret-protector.ts']){const target=join(temp,file);await mkdir(dirname(target),{recursive:true});await cp(resolve(root,file),target)}
const verifier=resolve(root,'scripts/verify-build225-open022-safestorage-contract.mjs');
const invoke=(name)=>spawnSync(process.execPath,[verifier,temp,join(temp,`${name}.json`)],{cwd:root,encoding:'utf8'});
const valid=invoke('valid');
const probePath=join(temp,'apps/desktop/src/main/windows-open022-side-artifact-evidence-probe.ts');
await writeFile(probePath,(await readFile(probePath,'utf8')).replace("if (input.protector.protectionId", "if (input.selectedStorageBackend !== 'dpapi') throw new Error('tampered');\n  if (input.protector.protectionId"));
const backendTamper=invoke('backend-tamper');
await cp(resolve(root,'apps/desktop/src/main/windows-open022-side-artifact-evidence-probe.ts'),probePath);
await writeFile(probePath,(await readFile(probePath,'utf8')).replace('const protectedMarker = input.protector.protect(marker);','const protectedMarker = marker;'));
const roundtripTamper=invoke('roundtrip-tamper');
const results=[{id:'valid-contract-pass',status:valid.status===0?'PASS':'FAIL',details:valid.stderr},{id:'backend-name-gate-tamper-rejected',status:backendTamper.status!==0?'PASS':'FAIL',details:backendTamper.stdout},{id:'roundtrip-tamper-rejected',status:roundtripTamper.status!==0?'PASS':'FAIL',details:roundtripTamper.stdout}];
const status=results.every(x=>x.status==='PASS')?'PASS':'FAIL';await mkdir('artifacts/validation',{recursive:true});await writeFile('artifacts/validation/build225-open022-safestorage-runtime.json',`${JSON.stringify({schemaVersion:1,build:225,openWorkId:'OPEN-022',status,checks:results.length,results,generatedAt:new Date().toISOString()},null,2)}\n`);await rm(temp,{recursive:true,force:true});console.log(`Build225 OPEN-022 safeStorage runtime/tamper: ${status} (${results.filter(x=>x.status==='PASS').length}/${results.length}).`);if(status!=='PASS')process.exitCode=1;
