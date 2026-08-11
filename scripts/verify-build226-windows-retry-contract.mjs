import { mkdir, readFile, writeFile } from 'node:fs/promises';
const read=(p)=>readFile(p,'utf8');
const [cmd,runner,lifecycle,result,open021,open022]=await Promise.all([
  read('BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD226.cmd'),read('scripts/run-build226-bronze-security-closure.ps1'),read('scripts/windows-bronze-security-release-validation-build226.ps1'),read('scripts/verify-build226-bronze-security-windows-result.mjs'),read('scripts/windows-open021-launch-test.mjs'),read('scripts/windows-open022-launch-test.mjs')
]);
const results=[];const check=(id,c)=>results.push({id,status:c?'PASS':'FAIL'});
check('one-click-build226-cmd',cmd.includes('run-build226-bronze-security-closure.ps1'));
check('exact-build226-guards',runner.includes('$build -ne 226')&&lifecycle.includes('$build -ne 226')&&result.includes('expectedBuild !== 226'));
check('source-integrity-prerequisite',runner.includes('build226-bronze-security-source-integrity-windows.json'));
check('development-open021-required',lifecycle.includes('development-open021-launch'));
check('installed-open021-required',lifecycle.includes('installed-open021-launch'));
check('development-open022-required',lifecycle.includes('development-open022-launch'));
check('installed-open022-required',lifecycle.includes('installed-open022-launch'));
check('not-run-not-pass',lifecycle.includes('-Status "NOT_RUN"')&&result.includes("row?.status === 'PASS'"));
check('full-lifecycle-stdout-persisted',lifecycle.includes('fullStdoutPath')&&lifecycle.includes('WriteAllText($stdoutPath,$stdout'));
check('full-lifecycle-stderr-persisted',lifecycle.includes('fullStderrPath')&&lifecycle.includes('WriteAllText($stderrPath,$stderr'));
check('open021-full-process-logs',open021.includes('fullProcessLogs')&&!open021.includes("const readTail"));
check('open022-full-process-logs',open022.includes('fullProcessLogs')&&!open022.includes("const readTail"));
check('early-diagnostic-env-open021',open021.includes('PPT_WINDOWS_STARTUP_DIAGNOSTIC_PATH'));
check('early-diagnostic-env-open022',open022.includes('PPT_WINDOWS_STARTUP_DIAGNOSTIC_PATH'));
check('verbose-v1-spam-removed',!open021.includes("'--v=1'")&&!open022.includes("'--v=1'"));
check('backend-name-not-required',!result.includes("selectedBackend === 'dpapi'"));
check('behavior-roundtrip-required',result.includes('encryptDecryptRoundTrip')&&result.includes('providerBasis'));
check('full-logs-bundled',runner.includes('$fullDiagnosticLogs')&&runner.includes("windows-open02*-full-*.log"));
check('open-readiness-independent',result.includes("open021: open021Pass ? 'READY_TO_CLOSE' : 'NOT_READY'")&&result.includes("open022: open022Pass ? 'READY_TO_CLOSE' : 'NOT_READY'"));
const failures=results.filter(x=>x.status==='FAIL');const report={schemaVersion:1,build:226,status:failures.length?'FAIL':'PASS',checks:results.length,passed:results.length-failures.length,failed:failures.length,results,generatedAt:new Date().toISOString()};await mkdir('artifacts/validation',{recursive:true});await writeFile('artifacts/validation/build226-windows-retry-contract.json',`${JSON.stringify(report,null,2)}\n`);console.log(`Build226 Windows retry contract: ${report.status} (${report.passed}/${report.checks}).`);if(failures.length)process.exitCode=1;
