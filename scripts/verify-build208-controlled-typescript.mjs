import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const require=createRequire(import.meta.url);
const ts=require(join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const files=['apps/desktop/src/main/data-store.ts','apps/desktop/src/main/main.ts','apps/desktop/src/renderer/App.tsx','packages/domain/src/app-meta.ts','packages/database/src/family-database-migrations.ts'];const results=[];let failures=[];
for(const file of files){const src=await readFile(file,'utf8');const out=ts.transpileModule(src,{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}});const diagnostics=(out.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error);results.push({file,status:diagnostics.length?'FAIL':'PASS',diagnostics:diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' '))});if(diagnostics.length)failures.push(file);}
const report={schemaVersion:1,build:208,files:results,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};await mkdir('artifacts/validation',{recursive:true});await writeFile('artifacts/validation/build208-controlled-typescript.json',JSON.stringify(report,null,2)+'\n');if(failures.length){console.error(JSON.stringify(report,null,2));process.exit(1)}console.log(`Build 208 controlled TypeScript: PASS (${results.length}/${results.length}).`);
