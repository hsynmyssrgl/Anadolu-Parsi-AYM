import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const args=process.argv.slice(2),option=(name,fallback)=>{const index=args.indexOf(name);return index<0?fallback:args[index+1];},reportPath=resolve(option('--report','artifacts/validation/build158-renderer-syntax.json'));
const ts=(await import(pathToFileURL(join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript','lib','typescript.js')).href)).default;
const files=['apps/desktop/src/renderer/async-state-guard.ts','apps/desktop/src/renderer/App.tsx','apps/desktop/src/renderer/global.d.ts','apps/desktop/src/main/preload.ts','apps/desktop/src/main/main.ts','apps/desktop/src/main/ipc-integration-policy.ts'];
const results=[],failures=[];
for(const path of files){const source=await readFile(path,'utf8'),sourceFile=ts.createSourceFile(path,source,ts.ScriptTarget.ES2024,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),diagnostics=(sourceFile.parseDiagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error).map(item=>ts.flattenDiagnosticMessageText(item.messageText,'\n'));results.push({path,status:diagnostics.length?'FAIL':'PASS',diagnostics});failures.push(...diagnostics.map(item=>`${path}: ${item}`));}
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:158,stage:'Bronze RC2 Active Development',typeScriptVersion:ts.version,fileCount:files.length,status:failures.length?'FAIL':'PASS',results,failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);console.log(`Build 158 renderer async guard syntax: ${report.status} — ${files.length}/${files.length} files`);if(failures.length)process.exitCode=1;
