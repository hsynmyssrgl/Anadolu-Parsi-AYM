import { mkdir, readFile, writeFile } from 'node:fs/promises';
const reportPath=process.argv[2]??'artifacts/validation/build221-bronze-security-workspace-build-contract.json';
const read=(p)=>readFile(p,'utf8'); const readBytes=(p)=>readFile(p);
const pairs=[
 ['cmd','BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD221.cmd'],
 ['runner','scripts/run-build221-bronze-security-closure.ps1'],
 ['lifecycle','scripts/windows-bronze-security-release-validation-build221.ps1'],
 ['result','scripts/verify-build221-bronze-security-windows-result.mjs'],
 ['distGuard','scripts/verify-build221-workspace-dist-prerequisite.mjs'],
 ['open021Launch','scripts/windows-open021-launch-test.mjs'],
 ['open022Launch','scripts/windows-open022-launch-test.mjs'],
 ['rootPackage','package.json']
];
const files=Object.fromEntries(await Promise.all(pairs.map(async([k,p])=>[k,await read(p)])));
const runnerBytes=await readBytes('scripts/run-build221-bronze-security-closure.ps1');
const lifecycleBytes=await readBytes('scripts/windows-bronze-security-release-validation-build221.ps1');
const rootPackage=JSON.parse(files.rootPackage);
const checks=[]; const add=(id,c,d=undefined)=>checks.push({id,status:c?'PASS':'FAIL',...(d!==undefined?{details:d}:{})});
add('cmd-build221',files.cmd.includes('Build221 / 02.08.2026.221'));
add('cmd-runner',files.cmd.includes('run-build221-bronze-security-closure.ps1'));
add('cmd-exit-21',files.cmd.includes('PPT_EXIT_CODE%"=="21'));
add('cmd-exit-22',files.cmd.includes('PPT_EXIT_CODE%"=="22'));
add('runner-utf8-bom',runnerBytes[0]===0xef&&runnerBytes[1]===0xbb&&runnerBytes[2]===0xbf);
add('lifecycle-utf8-bom',lifecycleBytes[0]===0xef&&lifecycleBytes[1]===0xbb&&lifecycleBytes[2]===0xbf);
add('runner-build221',files.runner.includes('$build -ne 221'));
add('runner-source-integrity',files.runner.includes('verify-source-integrity.mjs'));
add('runner-root-npm-ci-once',(files.runner.match(/npm\.cmd ci --no-audit --no-fund/g)??[]).length===1);
add('runner-packager-bootstrap-step',files.runner.includes('windows-packager-bootstrap-prerequisite'));
add('runner-packager-install-command',(files.runner.match(/npm\.cmd run windows-packager:install/g)??[]).length===1);
add('root-packager-install-script',rootPackage.scripts?.['windows-packager:install']==='npm ci --prefix tools/windows-packager --ignore-scripts --no-audit --no-fund',rootPackage.scripts?.['windows-packager:install']);
add('runner-builder-cli-guard',files.runner.includes('tools\\windows-packager\\node_modules\\electron-builder\\cli.js')&&files.runner.includes('Isolated electron-builder CLI was not installed.'));
add('runner-workspace-build-step',files.runner.includes('workspace-package-build-prerequisite'));
add('runner-workspace-build-command',(files.runner.match(/npm\.cmd run build:packages/g)??[]).length===1);
add('runner-workspace-dist-guard-step',files.runner.includes('workspace-package-dist-guard'));
add('runner-workspace-dist-guard-command',files.runner.includes('verify-build221-workspace-dist-prerequisite.mjs'));
add('dist-guard-build221',files.distGuard.includes("applicationVersion:'02.08.2026.221'")&&files.distGuard.includes("build:221"));
for(const pkg of ['core','contracts','config','logging','database','domain','events','repository-contracts','repositories','security','application','infrastructure','test-data']) add(`dist-guard-${pkg}`,files.distGuard.includes(`'${pkg}'`));
add('dist-guard-js',files.distGuard.includes("['index.js','index.d.ts']"));
add('dist-guard-fail-closed',files.distGuard.includes("if(status!=='PASS') process.exitCode=1"));
add('runner-lifecycle',files.runner.includes('windows-bronze-security-release-validation-build221.ps1'));
add('runner-verifier',files.runner.includes('verify-build221-bronze-security-windows-result.mjs'));
add('runner-build221-bundle',files.runner.includes('Bronze_Guvenlik_Windows_Kanitlari_Build221_'));
add('runner-source-binding',files.runner.includes('manifestSha256')&&files.runner.includes('sha256SumsSha256'));
add('runner-no-ledger-mutation',files.runner.includes('ledgerMutationPerformed=$false'));
add('runner-open002-not-auto-close',files.runner.includes('prerequisiteNpmCiDoesNotAutoCloseOpen002'));
add('runner-independent-readiness',files.runner.includes('open021=$open021Readiness')&&files.runner.includes('open022=$open022Readiness'));
add('runner-excludes-full-rc2',!files.runner.includes('run-rc2-validation-gates'));
add('runner-excludes-audit',!files.runner.includes('npm-audit')&&!files.runner.includes('dependency-audit'));
add('lifecycle-build221',files.lifecycle.includes('$build -ne 221'));
add('lifecycle-single-package-build',(files.lifecycle.match(/npm\.cmd run package:win --workspace @ppt\/desktop/g)??[]).length===1);
add('lifecycle-single-install',(files.lifecycle.match(/Invoke-RecordedProcess -Id "silent-install"/g)??[]).length===1);
add('lifecycle-single-uninstall',(files.lifecycle.match(/Invoke-RecordedProcess -Id "silent-uninstall"/g)??[]).length===1);
add('lifecycle-open021-development',files.lifecycle.includes('development-open021-launch'));
add('lifecycle-open022-development',files.lifecycle.includes('development-open022-launch'));
add('lifecycle-open021-installed',files.lifecycle.includes('installed-open021-launch'));
add('lifecycle-open022-installed',files.lifecycle.includes('installed-open022-launch'));
add('lifecycle-official',files.lifecycle.includes('official = $true')&&files.lifecycle.includes('diagnosticOnly = $false'));
add('lifecycle-process-stdout-capture',files.lifecycle.includes('RedirectStandardOutput = $true')&&files.lifecycle.includes('ReadToEndAsync()'));
add('lifecycle-process-stderr-capture',files.lifecycle.includes('RedirectStandardError = $true')&&files.lifecycle.includes('stderrTail'));
add('lifecycle-output-tail-bounded',files.lifecycle.includes('$tailLength = 12000'));
add('result-build221',files.result.includes('expectedBuild !== 221'));
add('result-open021-ready',files.result.includes("open021: open021Pass ? 'READY_TO_CLOSE' : 'NOT_READY'"));
add('result-open022-ready',files.result.includes("open022: open022Pass ? 'READY_TO_CLOSE' : 'NOT_READY'"));
add('result-no-ledger-mutation',files.result.includes('ledgerMutationPerformed: false'));
add('result-partial',files.result.includes("? 'PASS' : open021Pass || open022Pass ? 'PARTIAL' : 'FAIL'"));
add('result-open021-efs',files.result.includes('directoryEncryptedAttribute')&&files.result.includes('snapshotEncryptedAttribute'));
add('result-open022-dpapi',files.result.includes("selectedBackend === 'dpapi'")&&files.result.includes("protectionId === 'electron-safe-storage-v1'"));
add('result-open022-containers',files.result.includes('pplog')&&files.result.includes('pptdiag')&&files.result.includes('pptreport'));
add('result-open022-volatile',files.result.includes('sessionDataUnderVolatileRoot')&&files.result.includes('crashDumpsUnderVolatileRoot'));
add('open021-launch-current-build-dynamic',files.open021Launch.includes("expectedBuild = Number(probe.applicationVersion?.split('.').at(-1))"));
add('open022-launch-current-build-dynamic',files.open022Launch.includes("expectedBuild = Number(probe.applicationVersion?.split('.').at(-1))"));
add('regression-build220-command-preserved',await read('BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD220.cmd').then(x=>x.includes('Build220 / 02.08.2026.220')));
const status=checks.every(x=>x.status==='PASS')?'PASS':'FAIL';
await mkdir('artifacts/validation',{recursive:true});
await writeFile(reportPath,`${JSON.stringify({schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',applicationVersion:'02.08.2026.221',packageVersion:'2.8.2026-221',build:221,scope:'Windows workspace build prerequisite remediation',status,checks:checks.length,passCount:checks.filter(x=>x.status==='PASS').length,results:checks,generatedAt:new Date().toISOString()},null,2)}\n`);
console.log(`Build221 Windows workspace build contract: ${status} (${checks.filter(x=>x.status==='PASS').length}/${checks.length}).`);
if(status!=='PASS') process.exitCode=1;
