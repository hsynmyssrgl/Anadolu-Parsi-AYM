import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const reportPath=process.argv[2]??'artifacts/validation/build222-preload-typescript-ab-runtime.json';
const temp=await mkdtemp(join(tmpdir(),'ppt-build222-preload-ab-'));
const oldPath=join(temp,'old.ts'),newPath=join(temp,'new.ts');
await writeFile(oldPath,"globalThis.addEventListener?.('beforeunload', () => {}, { once: true });\n");
await writeFile(newPath,`const rendererLifecycleTarget = globalThis as typeof globalThis & {\n  readonly addEventListener?: (\n    type: 'beforeunload',\n    listener: () => void,\n    options?: { readonly once?: boolean }\n  ) => void;\n};\nrendererLifecycleTarget.addEventListener?.('beforeunload', () => {}, { once: true });\n`);
const args=['--strict','--noEmit','--target','ES2024','--module','NodeNext','--moduleResolution','NodeNext','--lib','ES2024','--skipLibCheck'];
const compiler=join('node_modules','typescript','lib','tsc.js');
const run=(p)=>spawnSync(process.execPath,[compiler,'--ignoreConfig',...args,p],{encoding:'utf8'});
const oldRun=run(oldPath),newRun=run(newPath);
const checks=[
 {id:'old-expression-fails',status:oldRun.status!==0?'PASS':'FAIL',details:{exitCode:oldRun.status}},
 {id:'old-expression-ts7017',status:(oldRun.stdout+oldRun.stderr).includes('TS7017')?'PASS':'FAIL',details:(oldRun.stdout+oldRun.stderr).trim()},
 {id:'new-adapter-compiles',status:newRun.status===0?'PASS':'FAIL',details:{exitCode:newRun.status,output:(newRun.stdout+newRun.stderr).trim()}},
 {id:'exact-source-uses-adapter',status:(await readFile('apps/desktop/src/main/preload.ts','utf8')).includes('rendererLifecycleTarget.addEventListener')?'PASS':'FAIL'}
];
const status=checks.every(x=>x.status==='PASS')?'PASS':'FAIL';
const versionRun=spawnSync(process.execPath,[compiler,'-v'],{encoding:'utf8'});
await mkdir('artifacts/validation',{recursive:true});await writeFile(reportPath,JSON.stringify({schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',applicationVersion:'02.08.2026.222',build:222,compiler:'workspace TypeScript CLI',compilerVersion:(versionRun.stdout??'').trim(),status,checks:checks.length,passCount:checks.filter(x=>x.status==='PASS').length,results:checks,generatedAt:new Date().toISOString()},null,2)+'\n');
await rm(temp,{recursive:true,force:true});
console.log(`Build222 preload TypeScript A/B runtime: ${status} (${checks.filter(x=>x.status==='PASS').length}/${checks.length}).`);if(status!=='PASS')process.exitCode=1;
