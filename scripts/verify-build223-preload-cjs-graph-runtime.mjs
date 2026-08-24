import { mkdtemp, mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const reportPath=process.argv[2]??'artifacts/validation/build223-preload-cjs-graph-runtime.json';
const sourceRoot='apps/desktop/src/main';
const sourceNames=['preload.ts','ipc-transport-context.ts','ipc-request-lifecycle.ts','ipc-read-sharing.ts'];
const transform=(source)=>source
 .replace(/from '((?:\.\/)ipc-[^']+)\.js'/g,"from '$1.cjs'")
 .replace(/=\s*<([A-Za-z_$][^>\n]*)>\s*\(/g,'= <$1,>(')
 .replace(/async\s+<([A-Za-z_$][^>\n]*)>\s*\(/g,'async <$1,>(');
const temp=await mkdtemp(join(tmpdir(),'ppt-build223-cjs-'));
const stage=join(temp,'stage'),out=join(temp,'out');await mkdir(stage);await mkdir(out);
const sourceByName=new Map();
for(const name of sourceNames){const source=await readFile(`${sourceRoot}/${name}`,'utf8');sourceByName.set(name,source);await writeFile(join(stage,name.replace(/\.ts$/,'.cts')),transform(source));}
const preloadSource=await readFile(`${sourceRoot}/preload.ts`,'utf8');
const domainNames=[];
const stagedSource=[...sourceByName.values()].join('\n');
for(const match of stagedSource.matchAll(/import type \{([^}]+)\} from '@ppt\/domain';/gs)){
 for(const part of match[1].split(',')){const name=part.trim().split(/\s+as\s+/).at(-1)?.trim();if(name&&/^[A-Za-z_$][\w$]*$/.test(name)&&!domainNames.includes(name))domainNames.push(name);}
}
const integrationNames=[];
for(const match of preloadSource.matchAll(/import type \{([^}]+)\} from '\.\/ipc-integration-policy\.js';/gs)){
 for(const part of match[1].split(',')){const name=part.trim().split(/\s+as\s+/).at(-1)?.trim();if(name&&/^[A-Za-z_$][\w$]*$/.test(name)&&!integrationNames.includes(name))integrationNames.push(name);}
}
const integrationStubPath=join(stage,'ipc-integration-policy.cts');
await writeFile(integrationStubPath,integrationNames.map(name=>`export type ${name} = any;`).join('\n')+'\n');
const stubs=[
 "declare module 'electron' { export const contextBridge: any; export const ipcRenderer: any; export type IpcMainInvokeEvent = any; }",
 "declare module 'node:crypto' { export const randomUUID: any; export const createHash: any; }",
 "declare module '@ppt/core' { export const ERROR_CODES: any; }",
 "declare module '@ppt/platform-policy' { export const OfflineCapabilityLeasePolicy: any; export const isOfflineCapabilityLeaseStructurallyValid: any; export type OfflineCapabilityLease = any; export type PlatformCapability = any; }",
 "declare module '@ppt/core-service-contracts' { export type CoreServiceApiBoundaryStatusContract = any; export type CoreServiceHealthContract = any; }",
 "declare module '@ppt/security' { export type WebAuthnAssertionInput = any; export type WebAuthnRegistrationInput = any; }",
 'declare const Buffer: any;',
 'declare function setTimeout(handler: (...args:any[])=>void, timeout?: number): any;',
 'declare function clearTimeout(handle:any): void;',
 "declare module '@ppt/domain' {",
 ...domainNames.map(name=>` export type ${name} = any;`),
 '}'
].join('\n');
const stubsPath=join(stage,'stubs.d.ts');await writeFile(stubsPath,stubs);
const entries=[...sourceNames.map(name=>join(stage,name.replace(/\.ts$/,'.cts'))),integrationStubPath];
const baseArgs=[...entries,stubsPath,'--target','ES2024','--module','NodeNext','--moduleResolution','NodeNext','--rootDir',stage,'--outDir',out,'--skipLibCheck','--strict','--sourceMap'];
const compiler=join('node_modules','typescript','lib','tsc.js');
const run=(args)=>spawnSync(process.execPath,[compiler,'--ignoreConfig',...args],{encoding:'utf8'});
const valid=run(baseArgs);const validOutput=`${valid.stdout??''}${valid.stderr??''}`;
const outputNames=valid.status===0?await readdir(out):[];
const preloadCjs=outputNames.includes('preload.cjs')?await readFile(join(out,'preload.cjs'),'utf8'):'';
await rm(join(stage,'ipc-read-sharing.cts'),{force:true});await rm(out,{recursive:true,force:true});await mkdir(out);
const tamperedEntries=entries.filter(path=>!path.endsWith('ipc-read-sharing.cts'));
const tampered=run([...tamperedEntries,stubsPath,'--target','ES2024','--module','NodeNext','--moduleResolution','NodeNext','--rootDir',stage,'--outDir',out,'--skipLibCheck','--strict']);
const tamperedOutput=`${tampered.stdout??''}${tampered.stderr??''}`;
const checks=[];const add=(id,c,d)=>checks.push({id,status:c?'PASS':'FAIL',...(d!==undefined?{details:d}:{})});
add('valid-compile-exit-zero',valid.status===0,{exitCode:valid.status,output:validOutput.trim()});
add('no-ts2307-valid',!validOutput.includes('TS2307'),validOutput.trim());
add('no-ts7060-valid',!validOutput.includes('TS7060'),validOutput.trim());
for(const name of ['preload.cjs','ipc-transport-context.cjs','ipc-request-lifecycle.cjs','ipc-read-sharing.cjs'])add(`output-${name}`,outputNames.includes(name),outputNames);
add('preload-requires-context-cjs',preloadCjs.includes('require("./ipc-transport-context.cjs")'));
add('preload-requires-lifecycle-cjs',preloadCjs.includes('require("./ipc-request-lifecycle.cjs")'));
add('preload-requires-sharing-cjs',preloadCjs.includes('require("./ipc-read-sharing.cjs")'));
add('preload-no-local-js-require',!preloadCjs.includes('require("./ipc-transport-context.js")')&&!preloadCjs.includes('require("./ipc-request-lifecycle.js")')&&!preloadCjs.includes('require("./ipc-read-sharing.js")'));
add('tamper-fails',tampered.status!==0,{exitCode:tampered.status});
add('tamper-missing-sharing-detected',tamperedOutput.includes('TS2307')&&tamperedOutput.includes('ipc-read-sharing.cjs'),tamperedOutput.trim());
const status=checks.every(x=>x.status==='PASS')?'PASS':'FAIL';
const versionRun=spawnSync(process.execPath,[compiler,'-v'],{encoding:'utf8'});
await mkdir('artifacts/validation',{recursive:true});await writeFile(reportPath,JSON.stringify({schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',applicationVersion:'02.08.2026.223',packageVersion:'2.8.2026-223',build:223,compiler:'workspace TypeScript CLI',compilerVersion:(versionRun.stdout??'').trim(),status,checks:checks.length,passCount:checks.filter(x=>x.status==='PASS').length,results:checks,generatedAt:new Date().toISOString()},null,2)+'\n');
await rm(temp,{recursive:true,force:true});
console.log(`Build223 preload CJS graph runtime: ${status} (${checks.filter(x=>x.status==='PASS').length}/${checks.length}).`);
if(status!=='PASS'){console.error(JSON.stringify(checks.filter(x=>x.status==='FAIL'),null,2));process.exitCode=1;}
