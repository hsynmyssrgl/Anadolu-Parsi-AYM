import { mkdir, readFile, writeFile } from 'node:fs/promises';
const reportPath=process.argv[2]??'artifacts/validation/build219-validation-boundary.json';const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const [contract,runtime,open021Contract,open021Runtime,open022Contract,open022Runtime,packageTypes,desktopTypes]=await Promise.all([
 readJson('artifacts/validation/build219-bronze-security-unified-contract.json'),readJson('artifacts/validation/build219-bronze-security-result-runtime.json'),readJson('artifacts/validation/build217-open021-isolation-contract.json'),readJson('artifacts/validation/build217-open021-result-runtime.json'),readJson('artifacts/validation/build218-open022-isolation-contract.json'),readJson('artifacts/validation/build218-open022-result-runtime.json'),readJson('artifacts/validation/package-source-typecheck.json'),readJson('artifacts/validation/desktop-main-source-typecheck.json')]);
const results=[
{id:'build219-unified-contract',status:contract.status,evidence:'artifacts/validation/build219-bronze-security-unified-contract.json'},
{id:'build219-unified-result-runtime',status:runtime.status,evidence:'artifacts/validation/build219-bronze-security-result-runtime.json'},
{id:'build217-open021-regression',status:open021Contract.status,evidence:'artifacts/validation/build217-open021-isolation-contract.json'},
{id:'build217-open021-runtime-regression',status:open021Runtime.status,evidence:'artifacts/validation/build217-open021-result-runtime.json'},
{id:'build218-open022-regression',status:open022Contract.status,evidence:'artifacts/validation/build218-open022-isolation-contract.json'},
{id:'build218-open022-runtime-regression',status:open022Runtime.status,evidence:'artifacts/validation/build218-open022-result-runtime.json'},
{id:'package-source-typecheck',status:packageTypes.status,evidence:'artifacts/validation/package-source-typecheck.json'},
{id:'desktop-main-source-typecheck',status:desktopTypes.status,evidence:'artifacts/validation/desktop-main-source-typecheck.json'},
{id:'unified-real-windows-execution',status:'NOT_RUN',reason:`Requires real Windows; current platform=${process.platform}`},
{id:'unified-real-windows-evidence-intake',status:'NOT_RUN',reason:'No exact-source-bound Build219 unified Windows evidence bundle has returned.'},
{id:'open021-closure',status:'IN_PROGRESS',reason:'Requires Build219 real Windows EFS PASS evidence governed into the master ledger.'},
{id:'open022-closure',status:'IN_PROGRESS',reason:'Requires Build219 real Windows safeStorage/DPAPI + protected side-artifact PASS evidence governed into the master ledger.'},
{id:'clean-npm-ci',status:'NOT_RUN',reason:'The Windows runner uses npm ci as a prerequisite, but no run occurred here and OPEN-002 remains separate.'},
{id:'full-root-tsc-no-emit',status:'NOT_RUN',reason:'Controlled source typechecks PASS; dependency-backed full root gate was not run.'},
{id:'full-unit-integration-suite',status:'NOT_RUN',reason:'Not run in this environment.'},
{id:'electron-production-build',status:'NOT_RUN',reason:'The real Windows runner will build one installer; not run here.'},
{id:'blocking-smoke',status:'NOT_RUN',reason:'Not run in this environment.'}
];
const counts=Object.fromEntries(['PASS','FAIL','NOT_RUN','IN_PROGRESS'].map(s=>[s,results.filter(x=>x.status===s).length]));const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',applicationVersion:'01.08.2026.219',packageVersion:'1.8.2026-219',build:219,stage:'Bronze RC2 Active Development',overallStatus:'INCOMPLETE',interpretation:'Build219 unified Windows closure source preparation is validated. OPEN-021/022 remain IN_PROGRESS until exact-source real Windows evidence returns.',counts,results,generatedAt:new Date().toISOString()};await mkdir('artifacts/validation',{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);console.log(`Build219 validation boundary: ${report.overallStatus} — ${counts.PASS} PASS / ${counts.NOT_RUN} NOT_RUN / ${counts.IN_PROGRESS} IN_PROGRESS.`);
