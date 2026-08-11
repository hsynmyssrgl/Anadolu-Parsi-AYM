import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const args=process.argv.slice(2);const option=(name,fallback)=>{const index=args.indexOf(name);if(index<0)return fallback;const value=args[index+1];if(!value||value.startsWith('--'))throw new Error(`${name} requires a value.`);return value;};
const reportPath=resolve(option('--report','artifacts/validation/build139-renderer-bridge-syntax.json'));
const globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
const ts=(await import(pathToFileURL(join(globalRoot,'typescript','lib','typescript.js')).href)).default;
const files=['apps/desktop/src/renderer/App.tsx','apps/desktop/src/renderer/global.d.ts','apps/desktop/src/main/preload.ts'];
const failures=[];const results=[];
const format=(diagnostic)=>{const message=ts.flattenDiagnosticMessageText(diagnostic.messageText,'\n');if(!diagnostic.file||diagnostic.start===undefined)return message;const position=diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);return `${diagnostic.file.fileName}:${position.line+1}:${position.character+1} ${message}`;};
for(const path of files){const source=await readFile(path,'utf8');const sourceFile=ts.createSourceFile(path,source,ts.ScriptTarget.ES2022,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);const diagnostics=(sourceFile.parseDiagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error).map(format);results.push({path,status:diagnostics.length?'FAIL':'PASS',diagnostics});failures.push(...diagnostics.map(item=>`${path}: ${item}`));}
const ledger=JSON.parse(await readFile('artifacts/manifests/VERSION_LEDGER.json','utf8'));const current=ledger.entries?.at(-1);
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:139,applicationVersion:current?.version??null,packageVersion:current?.packageVersion??null,stage:'Bronze RC2 Active Development',scope:'Build 139 renderer, preload and global bridge syntax validation without dependency installation',typeScriptVersion:ts.version,fileCount:files.length,status:failures.length?'FAIL':'PASS',results,failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);console.log(`Build 139 renderer/preload/global syntax: ${report.status} — ${files.length}/${files.length} files`);if(failures.length){for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}
