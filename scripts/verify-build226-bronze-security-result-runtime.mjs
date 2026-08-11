import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const reportPath=process.argv[2]??'artifacts/validation/build226-bronze-security-result-runtime.json';
const root=process.cwd();const tempRoot=await mkdtemp(join(tmpdir(),'ppt-build226-unified-'));const ev=join(tempRoot,'evidence');await mkdir(ev,{recursive:true});
const writeJson=(n,v)=>writeFile(join(ev,n),`${JSON.stringify(v,null,2)}\n`);
const fullLogs=(prefix)=>[1,2].flatMap(n=>[`${prefix}-run${n}-full-stdout.log`,`${prefix}-run${n}-full-stderr.log`]);
for(const prefix of ['windows-open021-development','windows-open021-packaged','windows-open022-development','windows-open022-packaged'])for(const log of fullLogs(prefix))await writeFile(join(ev,log),'complete process log\n');
const open021Security={status:'PASS',platform:'win32',build:226,applicationVersion:'02.08.2026.226',efs:{status:'PASS',protectionStatus:'windows-efs',activeDatabase:'memory-only',directoryEncryptedAttribute:'PASS',snapshotEncryptedAttribute:'PASS',snapshotSqliteRoundTrip:'PASS',stagingCleanup:'PASS'}};
const open021Run={status:'PASS',applicationVersion:'02.08.2026.226',windowsOpen021EfsEvidence:open021Security};
const open021Launch=(mode)=>({schemaVersion:1,applicationVersion:'02.08.2026.226',mode,status:'PASS',platform:'win32',official:true,windowsOpen021EfsRuntime:'PASS',rendererSandboxPolicy:'PASS',fullProcessLogs:fullLogs(`windows-open021-${mode}`),runs:[open021Run,open021Run]});
const side={schemaVersion:1,build:226,status:'PASS',platform:'win32',applicationVersion:'02.08.2026.226',safeStorage:{status:'PASS',selectedBackend:'unknown',runtimeBackendReported:false,provider:'windows-dpapi',providerBasis:'electron-safe-storage-windows-platform-contract',protectionId:'electron-safe-storage-v1',encryptionAvailable:'PASS',encryptDecryptRoundTrip:'PASS'},keyEnvelope:{status:'PASS',deviceWrapped:'PASS',noPlainDataKey:'PASS'},containers:{pplog:'PASS',pptdiag:'PASS',pptreport:'PASS',ciphertextHidesPlaintext:'PASS',decryptRoundTrip:'PASS'},startupEvidence:{status:'PASS',encryptedAtRest:'PASS',decryptRoundTrip:'PASS',protectionProvider:'windows-dpapi'},volatilePaths:{status:'PASS',sessionDataUnderVolatileRoot:'PASS',crashDumpsUnderVolatileRoot:'PASS'}};
const startup={status:'PASS',protectionProvider:'windows-dpapi',encryptionRoundTrip:'PASS',diagnosticOnly:false};
const open022Run={status:'PASS',applicationVersion:'02.08.2026.226',startupSecurity:startup,windowsOpen022SideArtifactEvidence:side};
const open022Launch=(mode)=>({schemaVersion:1,applicationVersion:'02.08.2026.226',mode,status:'PASS',platform:'win32',official:true,dpapiCrossProcessPersistence:'PASS',windowsSafeStorageDpapiRuntime:'PASS',protectedSideArtifactWindowsRuntime:'PASS',volatileBrowserCrashRuntime:'PASS',rendererSandboxPolicy:'PASS',fullProcessLogs:fullLogs(`windows-open022-${mode}`),runs:[open022Run,open022Run]});
const lifecycle={schemaVersion:1,applicationVersion:'02.08.2026.226',packageVersion:'2.8.2026-226',build:226,status:'PASS',official:true,diagnosticOnly:false,installer:{sha256:'c'.repeat(64)},steps:['windows-installer-build','development-open021-launch','development-open022-launch','silent-install','installed-open021-launch','installed-open022-launch','silent-uninstall'].map(id=>({id,status:'PASS',exitCode:0}))};
await writeJson('lifecycle.json',lifecycle);await writeJson('021dev.json',open021Launch('development'));await writeJson('021pkg.json',open021Launch('packaged'));await writeJson('022dev.json',open022Launch('development'));await writeJson('022pkg.json',open022Launch('packaged'));await writeJson('integrity.json',{schemaVersion:1,status:'PASS'});
const verifier=resolve(root,'scripts/verify-build226-bronze-security-windows-result.mjs');
const invoke=(out)=>spawnSync(process.execPath,[verifier,'02.08.2026.226',join(ev,'lifecycle.json'),join(ev,'021dev.json'),join(ev,'021pkg.json'),join(ev,'022dev.json'),join(ev,'022pkg.json'),join(ev,'integrity.json'),join(ev,out)],{cwd:root,encoding:'utf8'});
const valid=invoke('valid.json');const validResult=JSON.parse(await readFile(join(ev,'valid.json'),'utf8'));
const tamper022=open022Launch('packaged');tamper022.runs=JSON.parse(JSON.stringify(tamper022.runs));tamper022.runs[1].windowsOpen022SideArtifactEvidence.containers.pptdiag='FAIL';await writeJson('022pkg.json',tamper022);
const partial021=invoke('partial021.json');const partial021Result=JSON.parse(await readFile(join(ev,'partial021.json'),'utf8'));
await writeJson('022pkg.json',open022Launch('packaged'));
const tamper021=open021Launch('packaged');tamper021.runs=JSON.parse(JSON.stringify(tamper021.runs));tamper021.runs[0].windowsOpen021EfsEvidence.efs.snapshotEncryptedAttribute='FAIL';await writeJson('021pkg.json',tamper021);
const partial022=invoke('partial022.json');const partial022Result=JSON.parse(await readFile(join(ev,'partial022.json'),'utf8'));
const checks=[
{id:'valid-exit-0',status:valid.status===0?'PASS':'FAIL',details:valid.stderr},
{id:'valid-both-ready',status:validResult.status==='PASS'&&validResult.closureReadiness.open021==='READY_TO_CLOSE'&&validResult.closureReadiness.open022==='READY_TO_CLOSE'?'PASS':'FAIL',details:validResult.closureReadiness},
{id:'tamper022-exit-21',status:partial021.status===21?'PASS':'FAIL',details:partial021.status},
{id:'tamper022-open021-preserved',status:partial021Result.status==='PARTIAL'&&partial021Result.closureReadiness.open021==='READY_TO_CLOSE'&&partial021Result.closureReadiness.open022==='NOT_READY'?'PASS':'FAIL',details:partial021Result.closureReadiness},
{id:'tamper021-exit-22',status:partial022.status===22?'PASS':'FAIL',details:partial022.status},
{id:'tamper021-open022-preserved',status:partial022Result.status==='PARTIAL'&&partial022Result.closureReadiness.open021==='NOT_READY'&&partial022Result.closureReadiness.open022==='READY_TO_CLOSE'?'PASS':'FAIL',details:partial022Result.closureReadiness},
{id:'no-ledger-mutation',status:validResult.closureReadiness.ledgerMutationPerformed===false&&partial021Result.closureReadiness.ledgerMutationPerformed===false&&partial022Result.closureReadiness.ledgerMutationPerformed===false?'PASS':'FAIL'}
];
const status=checks.every(x=>x.status==='PASS')?'PASS':'FAIL';await mkdir('artifacts/validation',{recursive:true});await writeFile(reportPath,`${JSON.stringify({schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',applicationVersion:'02.08.2026.226',build:226,status,checks:checks.length,passCount:checks.filter(x=>x.status==='PASS').length,results:checks,generatedAt:new Date().toISOString()},null,2)}\n`);await rm(tempRoot,{recursive:true,force:true});console.log(`Build226 unified result runtime: ${status} (${checks.filter(x=>x.status==='PASS').length}/${checks.length}).`);if(status!=='PASS')process.exitCode=1;
