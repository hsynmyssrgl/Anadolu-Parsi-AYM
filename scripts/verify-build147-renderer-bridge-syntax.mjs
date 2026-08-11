import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const args=process.argv.slice(2),option=(n,f)=>{const i=args.indexOf(n);if(i<0)return f;const v=args[i+1];if(!v||v.startsWith('--'))throw new Error(`${n} requires a value.`);return v;};
const reportPath=resolve(option('--report','artifacts/validation/build147-renderer-bridge-syntax.json'));
const ts=(await import(pathToFileURL(join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript','lib','typescript.js')).href)).default;
const files=['apps/desktop/src/renderer/App.tsx','apps/desktop/src/renderer/global.d.ts','apps/desktop/src/main/preload.ts','apps/desktop/src/main/main.ts'];
const results=[],failures=[];
for(const path of files){const source=await readFile(path,'utf8'),sf=ts.createSourceFile(path,source,ts.ScriptTarget.ES2024,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),diagnostics=(sf.parseDiagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n'));results.push({path,status:diagnostics.length?'FAIL':'PASS',diagnostics});failures.push(...diagnostics.map(d=>`${path}: ${d}`));}
const pkg=JSON.parse(await readFile('package.json','utf8'));
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:147,packageVersion:pkg.version,stage:'Bronze RC2 Active Development',scope:'Build 147 renderer, preload, global API and Electron main syntax without dependency installation',typeScriptVersion:ts.version,fileCount:files.length,status:failures.length?'FAIL':'PASS',results,failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
console.log(`Build 147 renderer/preload/global/main syntax: ${report.status} — ${files.length}/${files.length} files`);if(failures.length)process.exitCode=1;
