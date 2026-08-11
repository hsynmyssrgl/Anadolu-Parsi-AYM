import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const reportPath=option('--report','artifacts/validation/build166-ipc-adaptive-budget-operator-syntax.json');
const ts=(await import(pathToFileURL(join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript','lib','typescript.js')).href)).default;
const files=['apps/desktop/src/main/ipc-adaptive-resource-budget-state.ts','apps/desktop/src/main/ipc-adaptive-resource-budget.ts','apps/desktop/src/main/ipc-integration-policy.ts','apps/desktop/src/main/main.ts','apps/desktop/src/main/preload.ts','apps/desktop/src/renderer/App.tsx','apps/desktop/src/renderer/global.d.ts','packages/domain/src/app-data.ts'];
const failures=[];
for(const file of files){const source=await readFile(file,'utf8');let errors=[];if(file.endsWith('.d.ts')){const sourceFile=ts.createSourceFile(file,source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);errors=(sourceFile.parseDiagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error);}else{const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true,fileName:file});errors=(output.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error);}if(errors.length)failures.push(`${file}: ${errors.length} syntax diagnostic`);}
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:166,stage:'Bronze RC2 Active Development',status:failures.length?'FAIL':'PASS',fileCount:files.length,files,failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
if(failures.length){console.error(`Build 166 IPC adaptive budget operator syntax: FAIL (${files.length-failures.length}/${files.length})`);for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}else console.log(`Build 166 IPC adaptive budget operator syntax: PASS (${files.length}/${files.length}).`);
