import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { dirname } from 'node:path';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const reportPath=option('--report','artifacts/validation/build162-ipc-read-sharing-syntax.json');
const files=['apps/desktop/src/main/ipc-read-sharing.ts','apps/desktop/src/main/preload.ts','apps/desktop/src/main/ipc-runtime.ts','apps/desktop/src/main/main.ts'];
const failures=[];
for(const file of files){const source=await readFile(file,'utf8');try{stripTypeScriptTypes(source,{mode:'transform',sourceMap:false});}catch(error){failures.push(`${file}: ${error instanceof Error?error.message:String(error)}`);}}
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:162,stage:'Bronze RC2 Active Development',status:failures.length?'FAIL':'PASS',fileCount:files.length,files,failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
if(failures.length){console.error(`Build 162 IPC read sharing syntax: FAIL (${files.length-failures.length}/${files.length})`);for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}else console.log(`Build 162 IPC read sharing syntax: PASS (${files.length}/${files.length}).`);
