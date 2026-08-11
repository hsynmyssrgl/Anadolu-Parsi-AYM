import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const args=process.argv.slice(2),option=(name,fallback)=>{const index=args.indexOf(name);return index<0?fallback:args[index+1];},reportPath=resolve(option('--report','artifacts/validation/build159-ipc-transport-syntax.json'));
const ts=(await import(pathToFileURL(join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript','lib','typescript.js')).href)).default;
const files=['apps/desktop/src/main/ipc-transport-context.ts','apps/desktop/src/main/ipc-runtime.ts','apps/desktop/src/main/preload.ts','apps/desktop/src/main/main.ts','apps/desktop/src/main/ipc-integration-policy.ts','apps/desktop/src/renderer/async-state-guard.ts','apps/desktop/src/renderer/App.tsx'];
const results=[],failures=[];
for(const path of files){const source=await readFile(path,'utf8'),sourceFile=ts.createSourceFile(path,source,ts.ScriptTarget.ES2024,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),diagnostics=(sourceFile.parseDiagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error).map(item=>ts.flattenDiagnosticMessageText(item.messageText,'\n'));results.push({path,status:diagnostics.length?'FAIL':'PASS',diagnostics});failures.push(...diagnostics.map(item=>`${path}: ${item}`));}
const main=await readFile('apps/desktop/src/main/main.ts','utf8'),preload=await readFile('apps/desktop/src/main/preload.ts','utf8');
const mainChannels=[...main.matchAll(/registerIpcHandler\(\s*['"]([^'"]+)/g)].map(match=>match[1]);
const preloadChannels=[...preload.matchAll(/\binvoke(?:<[^>]+>)?\(\s*['"]([^'"]+)/g)].map(match=>match[1]);
const missingInPreload=[...new Set(mainChannels)].filter(channel=>!preloadChannels.includes(channel));
const missingInMain=[...new Set(preloadChannels)].filter(channel=>!mainChannels.includes(channel));
if(new Set(mainChannels).size!==new Set(preloadChannels).size)failures.push(`IPC unique channel count mismatch: ${new Set(mainChannels).size}/${new Set(preloadChannels).size}`);
failures.push(...missingInPreload.map(channel=>`Main IPC missing in preload: ${channel}`),...missingInMain.map(channel=>`Preload IPC missing in main: ${channel}`));
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:159,stage:'Bronze RC2 Active Development',typeScriptVersion:ts.version,fileCount:files.length,channelParity:{status:missingInPreload.length||missingInMain.length||new Set(mainChannels).size!==new Set(preloadChannels).size?'FAIL':'PASS',mainChannelCount:mainChannels.length,preloadChannelCount:preloadChannels.length,missingInPreload,missingInMain},status:failures.length?'FAIL':'PASS',results,failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);console.log(`Build 159 IPC transport syntax/parity: ${report.status} — ${files.length}/${files.length} files, ${mainChannels.length}/${preloadChannels.length} IPC channels`);if(failures.length)process.exitCode=1;
