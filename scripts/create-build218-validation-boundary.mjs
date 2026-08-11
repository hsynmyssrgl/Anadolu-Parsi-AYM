import { mkdir, readFile, writeFile } from 'node:fs/promises';
const reportPath = process.argv[2] ?? 'artifacts/validation/build218-validation-boundary.json';
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const [contract, runtime, open022Contract, protectedRuntime, integrationRuntime, winHarness, packageTypes, desktopTypes] = await Promise.all([
  readJson('artifacts/validation/build218-open022-isolation-contract.json'),
  readJson('artifacts/validation/build218-open022-result-runtime.json'),
  readJson('artifacts/validation/build214-open022-contract.json'),
  readJson('artifacts/validation/build214-protected-side-artifact-runtime.json'),
  readJson('artifacts/validation/build214-side-artifact-integration-runtime.json'),
  readJson('artifacts/validation/build215-windows-security-evidence-contract.json'),
  readJson('artifacts/validation/package-source-typecheck.json'),
  readJson('artifacts/validation/desktop-main-source-typecheck.json')
]);
const results = [
  { id:'open022-isolation-contract',status:contract.status,evidence:'artifacts/validation/build218-open022-isolation-contract.json' },
  { id:'open022-result-runtime',status:runtime.status,evidence:'artifacts/validation/build218-open022-result-runtime.json' },
  { id:'build214-open022-contract',status:open022Contract.status,evidence:'artifacts/validation/build214-open022-contract.json' },
  { id:'build214-protected-runtime',status:protectedRuntime.status,evidence:'artifacts/validation/build214-protected-side-artifact-runtime.json' },
  { id:'build214-integration-runtime',status:integrationRuntime.status,evidence:'artifacts/validation/build214-side-artifact-integration-runtime.json' },
  { id:'build215-windows-harness-regression',status:winHarness.status,evidence:'artifacts/validation/build215-windows-security-evidence-contract.json' },
  { id:'package-source-typecheck',status:packageTypes.status,evidence:'artifacts/validation/package-source-typecheck.json' },
  { id:'desktop-main-source-typecheck',status:desktopTypes.status,evidence:'artifacts/validation/desktop-main-source-typecheck.json' },
  { id:'open022-real-windows-execution',status:'NOT_RUN',reason:`Requires real Windows; current platform=${process.platform}` },
  { id:'open022-real-windows-evidence-intake',status:'NOT_RUN',reason:'No exact-source-bound Build218 Windows evidence bundle has returned.' },
  { id:'open022-closure',status:'IN_PROGRESS',reason:'Cannot close before real Windows PASS evidence is governed into the master ledger.' },
  { id:'open021-closure',status:'IN_PROGRESS',reason:'Build218 explicitly leaves OPEN-021 unchanged.' },
  { id:'clean-npm-ci',status:'NOT_RUN',reason:'Reserved for execution environment / Silver validation; Build218 source preparation does not claim PASS.' },
  { id:'full-root-tsc-no-emit',status:'NOT_RUN',reason:'Controlled source typechecks PASS; full dependency-backed root gate not run.' },
  { id:'full-unit-integration-suite',status:'NOT_RUN',reason:'Not run in this environment.' },
  { id:'electron-production-build',status:'NOT_RUN',reason:'Real Windows runner will build installer; not run here.' },
  { id:'blocking-smoke',status:'NOT_RUN',reason:'Not run in this environment.' }
];
const counts=Object.fromEntries(['PASS','FAIL','NOT_RUN','IN_PROGRESS'].map((status)=>[status,results.filter((item)=>item.status===status).length]));
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',applicationVersion:'01.08.2026.218',packageVersion:'1.8.2026-218',build:218,stage:'Bronze RC2 Active Development',overallStatus:'INCOMPLETE',interpretation:'Build218 OPEN-022 close-runner source preparation is validated; OPEN-022 remains IN_PROGRESS until real Windows PASS evidence returns.',counts,results,generatedAt:new Date().toISOString()};
await mkdir('artifacts/validation',{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);console.log(`Build218 validation boundary: ${report.overallStatus} — ${counts.PASS} PASS / ${counts.NOT_RUN} NOT_RUN / ${counts.IN_PROGRESS} IN_PROGRESS.`);
