import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const args=process.argv.slice(2),option=(n,f)=>{const i=args.indexOf(n);return i<0?f:args[i+1];};
const reportPath=resolve(option('--report','artifacts/validation/build173-ipc-adaptive-budget-maintenance-lock-recovery-syntax.json'));
const files=[
  'apps/desktop/src/main/ipc-adaptive-budget-maintenance-lock-recovery.ts',
  'apps/desktop/src/main/ipc-adaptive-budget-maintenance-authority.ts',
  'apps/desktop/src/main/ipc-adaptive-budget-maintenance-reauthentication-guard.ts',
  'apps/desktop/src/main/ipc-adaptive-budget-maintenance-reauthentication-state.ts',
  'apps/desktop/src/main/ipc-adaptive-budget-maintenance-session.ts',
  'apps/desktop/src/main/main.ts',
  'apps/desktop/src/main/preload.ts',
  'apps/desktop/src/renderer/App.tsx',
  'apps/desktop/src/renderer/global.d.ts',
  'packages/domain/src/app-data.ts',
  'packages/domain/src/app-meta.ts',
  'scripts/verify-build173-ipc-adaptive-budget-maintenance-lock-recovery-contract.mjs',
  'scripts/verify-build173-ipc-adaptive-budget-maintenance-lock-recovery-runtime.mjs'
];
const ts=(await import(pathToFileURL(join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript','lib','typescript.js')).href)).default;
const failures=[];
for(const file of files){const source=await readFile(file,'utf8');const kind=file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS;const sf=ts.createSourceFile(file,source,ts.ScriptTarget.ES2022,true,kind);const errors=(sf.parseDiagnostics??[]).filter(x=>x.category===ts.DiagnosticCategory.Error);if(errors.length)failures.push(`${file}: ${errors.length} syntax diagnostic`);}
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:173,stage:'Bronze RC2 Active Development',status:failures.length?'FAIL':'PASS',fileCount:files.length,files,failures,generatedAt:new Date().toISOString()};await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);if(failures.length){console.error('Build 173 maintenance lock recovery syntax: FAIL');for(const f of failures)console.error(`- ${f}`);process.exitCode=1;}else console.log(`Build 173 maintenance lock recovery syntax: PASS (${files.length}/${files.length}).`);
