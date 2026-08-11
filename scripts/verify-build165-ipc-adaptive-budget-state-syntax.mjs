import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const reportPath=option('--report','artifacts/validation/build165-ipc-adaptive-budget-state-syntax.json');
const ts=(await import(pathToFileURL(join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript','lib','typescript.js')).href)).default;
const files=['apps/desktop/src/main/ipc-adaptive-resource-budget-state.ts','apps/desktop/src/main/ipc-adaptive-resource-budget.ts','apps/desktop/src/main/ipc-request-lifecycle.ts','apps/desktop/src/main/ipc-read-sharing.ts','apps/desktop/src/main/ipc-runtime.ts','apps/desktop/src/main/main.ts','apps/desktop/src/renderer/App.tsx','packages/domain/src/app-data.ts'];
const failures=[];
for(const file of files){const source=await readFile(file,'utf8');const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true,fileName:file});const errors=(output.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error);if(errors.length)failures.push(`${file}: ${errors.length} syntax diagnostic`);}
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:165,stage:'Bronze RC2 Active Development',status:failures.length?'FAIL':'PASS',fileCount:files.length,files,failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
if(failures.length){console.error(`Build 165 IPC adaptive budget state syntax: FAIL (${files.length-failures.length}/${files.length})`);for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}else console.log(`Build 165 IPC adaptive budget state syntax: PASS (${files.length}/${files.length}).`);
