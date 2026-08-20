import { existsSync,readFileSync } from 'node:fs';import { mkdir,writeFile } from 'node:fs/promises';import { resolve } from 'node:path';import { spawnSync } from 'node:child_process';
const root=resolve(process.cwd());if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const step=process.argv[2],mode=process.argv[3];const noWrite=process.argv.includes('--no-write');
const packages={
  '34-G':{slug:'e2ee-file-sharing-remaining-communication-ux',decision:'DEC-244',migration:111,
    scope:'config/34-g-e2ee-file-sharing-remaining-communication-ux-scope.json',inventory:'config/34-g-e2ee-file-sharing-remaining-communication-ux-inventory.json',
    decisionFile:'docs/decisions/DEC-244-e2ee-file-sharing-remaining-communication-ux.md',threat:'docs/security/THREAT_MODEL_34_G_E2EE_FILE_SHARING_REMAINING_COMMUNICATION_UX.md',
    localStatus:'LOCAL_PRODUCTION_COMPOSITION_ACCEPTANCE_INCOMPLETE',expectedTestFiles:6,expectedTests:34,
    validation:{migrationSha256:'7d87d405a85196a2f76a765899adf7b734858f7dc2b1715c59577d0048838700',
      ppk015Sha256:'e83ccc2f1c9eaec4848ce47135f666c17cad167e51c7d678006ab93972c34a21',
      ppk021Count:895,ppk021Sha256:'fad3ceeb9485bffc9d6f9878f7bb486f56a73b4aa5d045580471c70a49e59da6',
      ppk022Count:447,ppk022Sha256:'2ac32190c1b40c455093841eb2456c06a168c9aaf519068a14f570705b8a177a'},
    tests:['packages/application/tests/communication-file-sharing-use-cases.test.ts','packages/repositories/communication-file-sharing-repository-policy.test.ts','apps/desktop/tests/communication-file-payload-vault.test.ts','apps/desktop/tests/communication-file-sharing-ipc-integration.test.ts','apps/desktop/tests/communication-file-sharing-ipc-bridge.test.ts','apps/desktop/tests/remaining-communication-distributed-ui.test.ts'],
    markers:[['packages/domain/src/communication-file-sharing.ts','COMMUNICATION_FILE_SAFE_PREVIEW_MAX_BYTES'],['packages/application/src/communication-file-sharing-use-cases.ts','GetCommunicationFileSafePreviewUseCase'],['packages/application/src/communication-file-sharing-use-cases.ts','MaintainCommunicationFilePayloadVaultUseCase'],['packages/database/src/family-database-migrations.ts',"createMigrationDefinition(111, 'communication_file_sharing_remaining_ux'"],['apps/desktop/src/main/communication-file-payload-vault.ts','WindowsDefenderCommunicationFileMalwareScanner'],['apps/desktop/src/main/communication-file-payload-vault.ts','#recoverInterruptedPublications'],['apps/desktop/src/main/communication-file-payload-vault.ts','sweepOrphans'],['apps/desktop/src/main/communication-file-sharing-application-adapter.ts','RepositoryBackedCommunicationFileSharingUnitOfWork'],['apps/desktop/src/main/ipc-integration-policy.ts','getSafePreview'],['apps/desktop/src/main/data-store.ts','maintainCommunicationFilePayloadVault'],['apps/desktop/src/renderer/CommunicationFileSharingPanel.tsx','Güvenli düz metin önizleme']]},
  '34-H':{slug:'communication-audit-archive-integrity',decision:'DEC-245',migration:112,
    scope:'config/34-h-communication-audit-archive-integrity-scope.json',inventory:'config/34-h-communication-audit-archive-integrity-inventory.json',
    decisionFile:'docs/decisions/DEC-245-communication-audit-archive-integrity.md',threat:'docs/security/THREAT_MODEL_34_H_COMMUNICATION_AUDIT_ARCHIVE_INTEGRITY.md',
    localStatus:'LOCAL_PRODUCTION_COMPOSITION_ACCEPTANCE_INCOMPLETE',expectedTestFiles:5,expectedTests:10,
    validation:{migrationSha256:'876cfb55675e5c567c156932c4ddbfd672c87e547f672ebae798e03d69287fba',
      ppk015Sha256:'e83ccc2f1c9eaec4848ce47135f666c17cad167e51c7d678006ab93972c34a21',
      ppk021Count:895,ppk021Sha256:'fad3ceeb9485bffc9d6f9878f7bb486f56a73b4aa5d045580471c70a49e59da6',
      ppk022Count:447,ppk022Sha256:'2ac32190c1b40c455093841eb2456c06a168c9aaf519068a14f570705b8a177a'},
    tests:['packages/application/tests/communication-audit-archive-use-cases.test.ts','packages/repositories/communication-audit-archive-repository-policy.test.ts','apps/desktop/tests/communication-audit-archive-ipc-integration.test.ts','apps/desktop/tests/communication-audit-archive-ipc-bridge.test.ts','apps/desktop/tests/remaining-communication-distributed-ui.test.ts'],
    markers:[['packages/domain/src/communication-audit-archive.ts','productionQueryApiComposed: true'],['packages/domain/src/communication-audit-archive.ts','productionEventProducerHooksComposed: true'],['packages/application/src/communication-audit-archive-use-cases.ts','AppendCommunicationAuditEventUseCase'],['packages/application/src/communication-audit-archive-use-cases.ts','communicationAuditArchiveSafeCenter'],['packages/database/src/family-database-migrations.ts',"createMigrationDefinition(112, 'communication_audit_archive_integrity'"],['packages/repositories/src/communication-audit-archive-repository.ts','exact durable policy receipt'],['apps/desktop/src/main/communication-audit-archive-application-adapter.ts','RepositoryBackedCommunicationAuditArchiveQueryPort'],['apps/desktop/src/main/data-store.ts','#appendCommunicationProductionAudit'],['apps/desktop/src/main/ipc-integration-policy.ts','COMMUNICATION_AUDIT_ARCHIVE_IPC_CHANNELS'],['apps/desktop/src/renderer/CommunicationAuditArchivePanel.tsx','İçerikten ayrı denetim zinciri']]},
  '34-I':{slug:'distributed-core-consensus-tenancy',decision:'DEC-246',migration:113,
    scope:'config/34-i-distributed-core-consensus-tenancy-scope.json',inventory:'config/34-i-distributed-core-consensus-tenancy-inventory.json',
    decisionFile:'docs/decisions/DEC-246-distributed-core-consensus-tenancy.md',threat:'docs/security/THREAT_MODEL_34_I_DISTRIBUTED_CORE_CONSENSUS_TENANCY.md',
    localStatus:'LOCAL_HARDENED_FAIL_CLOSED_FOUNDATION_ACCEPTANCE_INCOMPLETE',expectedTestFiles:4,expectedTests:14,
    validation:{migrationSha256:'3f7b7e02e462744f704ced2255b75d712b90930c807889f13f8dd1d4d2f6e596',
      ppk015Sha256:'e83ccc2f1c9eaec4848ce47135f666c17cad167e51c7d678006ab93972c34a21',
      ppk021Count:895,ppk021Sha256:'fad3ceeb9485bffc9d6f9878f7bb486f56a73b4aa5d045580471c70a49e59da6',
      ppk022Count:447,ppk022Sha256:'2ac32190c1b40c455093841eb2456c06a168c9aaf519068a14f570705b8a177a'},
    tests:['apps/core-service/tests/distributed-core-cluster-runtime.test.ts','apps/core-service/tests/distributed-core-migration-boundary.test.ts','apps/core-service/tests/windows-service-control-server.test.ts','apps/desktop/tests/remaining-communication-distributed-ui.test.ts'],
    markers:[['packages/domain/src/distributed-core-service.ts','durableIdempotencyRequired:true'],['packages/domain/src/distributed-core-service.ts','productionRuntimeComposed:false'],['packages/domain/src/distributed-core-service.ts','windowsServiceHostImplemented:true'],['apps/core-service/src/distributed-core-cluster-runtime.ts','findByIdempotencyKey'],['apps/core-service/src/distributed-core-cluster-runtime.ts','commitAndApply'],['apps/core-service/src/distributed-core-cluster-runtime.ts','allowUnverifiedProviderForTests'],['apps/core-service/src/windows-service-control-server.ts','CoreServiceWindowsServiceControlServer'],['native/windows-core-service-host/ParsYuvaCoreServiceHost.cs','DataProtectionScope.LocalMachine'],['native/windows-core-service-host/ParsYuvaCoreServiceHost.cs','NamedPipeClientStream'],['native/windows-core-service-host/build.ps1','windowsServiceLifecycleVerified = $false'],['packages/database/src/family-database-migrations.ts',"createMigrationDefinition(113, 'distributed_core_consensus_tenancy'"],['apps/desktop/src/renderer/DistributedOperationsPanel.tsx','özel consensus algoritması yazılmamıştır']]},
  '34-J':{slug:'distributed-clients-operations-disaster-recovery',decision:'DEC-247',migration:114,
    scope:'config/34-j-distributed-clients-operations-disaster-recovery-scope.json',inventory:'config/34-j-distributed-clients-operations-disaster-recovery-inventory.json',
    decisionFile:'docs/decisions/DEC-247-distributed-clients-operations-disaster-recovery.md',threat:'docs/security/THREAT_MODEL_34_J_DISTRIBUTED_CLIENTS_OPERATIONS_DR.md',
    localStatus:'LOCAL_HARDENED_FAIL_CLOSED_FOUNDATION_ACCEPTANCE_INCOMPLETE',expectedTestFiles:3,expectedTests:10,
    validation:{migrationSha256:'ed39e408cbba4cc1b97d9e2e0a902f1b6573639c56a7585c3d44f48078e761fb',
      ppk015Sha256:'e83ccc2f1c9eaec4848ce47135f666c17cad167e51c7d678006ab93972c34a21',
      ppk021Count:895,ppk021Sha256:'fad3ceeb9485bffc9d6f9878f7bb486f56a73b4aa5d045580471c70a49e59da6',
      ppk022Count:447,ppk022Sha256:'2ac32190c1b40c455093841eb2456c06a168c9aaf519068a14f570705b8a177a'},
    tests:['apps/core-service/tests/distributed-operations-runtime.test.ts','apps/core-service/tests/distributed-operations-migration-boundary.test.ts','apps/desktop/tests/remaining-communication-distributed-ui.test.ts'],
    markers:[['packages/domain/src/distributed-client-operations.ts','durableOperationsEvidenceRequired: true'],['packages/domain/src/distributed-client-operations.ts','productionRuntimeComposed: false'],['apps/core-service/src/distributed-operations-runtime.ts','validateControlPlaneEnvelope'],['apps/core-service/src/distributed-operations-runtime.ts','verifyAndRegisterBackup'],['apps/core-service/src/distributed-operations-runtime.ts','createRollingUpdatePlan'],['apps/core-service/src/distributed-operations-runtime.ts','allowUnverifiedProvidersForTests'],['packages/database/src/family-database-migrations.ts',"createMigrationDefinition(114, 'distributed_clients_operations_disaster_recovery'"],['apps/desktop/src/renderer/DistributedOperationsPanel.tsx','Remote bağlantı varsayılan kapalıdır']]},
  '34-K':{slug:'windows-resilience-universal-ux',decision:'DEC-248',migration:115,
    scope:'config/34-k-windows-resilience-universal-ux-scope.json',inventory:'config/34-k-windows-resilience-universal-ux-inventory.json',
    decisionFile:'docs/decisions/DEC-248-windows-resilience-universal-ux.md',threat:'docs/security/THREAT_MODEL_34_K_WINDOWS_RESILIENCE_UNIVERSAL_UX.md',
    localStatus:'LOCAL_HARDENED_FAIL_CLOSED_FOUNDATION_ACCEPTANCE_INCOMPLETE',expectedTestFiles:3,expectedTests:16,
    validation:{migrationSha256:'e9e67d7ef5c3097f4e39ea3a01aca76a7f9b64fe5b54de8da4de8cfbfc42e5cc',
      ppk015Sha256:'e83ccc2f1c9eaec4848ce47135f666c17cad167e51c7d678006ab93972c34a21',
      ppk021Count:895,ppk021Sha256:'fad3ceeb9485bffc9d6f9878f7bb486f56a73b4aa5d045580471c70a49e59da6',
      ppk022Count:447,ppk022Sha256:'2ac32190c1b40c455093841eb2456c06a168c9aaf519068a14f570705b8a177a'},
    tests:['packages/application/tests/windows-resilience-universal-ux-use-cases.test.ts','packages/repositories/windows-resilience-universal-ux-repository-policy.test.ts','apps/desktop/tests/universal-ux-consolidation-ui.test.ts'],
    markers:[['packages/domain/src/windows-resilience-universal-ux.ts','callerSuppliedSearchAuthorizationAccepted: false'],['packages/domain/src/windows-resilience-universal-ux.ts','productionUniversalSearchAuthorityComposed: true'],['packages/domain/src/windows-resilience-universal-ux.ts','operationLedgerRetentionPolicyDecided: false'],['packages/application/src/windows-resilience-universal-ux-use-cases.ts','UniversalUxSearchAuthorityPort'],['packages/application/src/windows-resilience-universal-ux-use-cases.ts','WindowsResilienceEvidenceProviderPort'],['packages/repositories/src/windows-resilience-universal-ux-repository.ts','exact durable policy receipt'],['packages/database/src/family-database-migrations.ts',"createMigrationDefinition(115, 'windows_resilience_universal_ux'"],['packages/database/src/family-database-migrations.ts','34-K operation requires exact owner-bound durable PEP receipt'],['apps/desktop/src/renderer/UniversalUxConsolidationPanel.tsx','searchUnifiedAuthorizedRecords({query:normalized,limit:25})']]}
};
const selected=packages[step];if(!selected||!['boundary','contract','runtime'].includes(mode))throw new Error('Usage: node verify-remaining-package-local-foundation.mjs <34-G..34-K> <boundary|contract|runtime> [--no-write]');
const headResult=spawnSync('git',['-c','safe.directory=C:/PPT/AYM/06_KOD/app','rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
if(headResult.status!==0||!/^[0-9a-f]{40}\s*$/u.test(headResult.stdout??''))throw new Error('Cannot resolve exact source HEAD.');
const sourceBaseHead=headResult.stdout.trim();
const read=path=>readFileSync(resolve(root,path),'utf8');const json=path=>JSON.parse(read(path));const checks=[];
const check=(name,passed,detail='')=>checks.push({name,status:passed?'PASS':'FAIL',detail});
const baseFiles=[selected.scope,selected.inventory,selected.decisionFile,selected.threat,...selected.markers.map(item=>item[0]),...selected.tests];
if(mode==='boundary'||mode==='runtime'){
  check('all declared governance source and targeted test files exist',baseFiles.every(path=>existsSync(resolve(root,path))));
  for(const [path,marker] of selected.markers)check(`${path} pins ${marker}`,existsSync(resolve(root,path))&&read(path).includes(marker));
  const migrations=read('packages/database/src/family-database-migrations.ts');check(`migration ${selected.migration} is wired`,migrations.includes(`createMigrationDefinition(${selected.migration},`));
}
if(mode==='contract'||mode==='runtime'){
  const scope=json(selected.scope),inventory=json(selected.inventory),decision=read(selected.decisionFile),threat=read(selected.threat);
  check('governance identity is exact',scope.step===step&&scope.decision===selected.decision&&inventory.step===step&&inventory.decision===selected.decision);
  if(selected.localStatus)check('local implementation status is exact and non-accepting',scope.localImplementationStatus===selected.localStatus&&inventory.localImplementationStatus===selected.localStatus);
  check('fail-honest status remains non-accepting',scope.status==='PLANNED'&&scope.truth?.requirementsClosed===false&&scope.truth?.countsAsRequirementPass===false&&inventory.countsAsRequirementPass===false);
  const manualEvidence = scope.manualEvidence ?? {};
  const manualEvidenceExact = step === '34-K'
    ? Object.entries(manualEvidence).every(([key,value])=>key === 'installedApplicationLaunch'
      ? value === 'PASS_LOCAL_UNSIGNED'
      : key === 'productionUniversalSearchAuthority'
        ? value === 'PASS_LOCAL_REPOSITORY_BACKED_REALTIME_POLICY_FILTERED'
        : value === 'NOT_RUN')
      && scope.truth?.oldMisdirectedInstallationRemoved === true
      && scope.truth?.unsignedLocalFixedPathInstallVerified === true
      && scope.truth?.installedApplicationLaunchVerified === true
      && scope.validation?.installedApplicationEvidence?.status === 'PASS_LOCAL_UNSIGNED_NOT_RELEASE_ACCEPTANCE'
      && scope.validation?.installedApplicationEvidence?.installPath === 'C:\\Program Files\\PPT\\AYM'
      && scope.validation?.installedApplicationEvidence?.signature === 'NotSigned'
      && scope.validation?.installedApplicationEvidence?.mainWindowResponding === true
      && scope.validation?.installedApplicationEvidence?.rendererProcessObserved === true
      && scope.validation?.installedApplicationEvidence?.coreServiceUtilityProcessObserved === true
    : Object.values(manualEvidence).every(value=>value==='NOT_RUN');
  check('manual evidence records only exact local observations and retains external NOT_RUN facts',manualEvidenceExact);
  check('decision and threat model reject false closure',decision.includes('countsAsRequirementPass=false')&&threat.includes('Residual risk'));
  if(selected.validation)check('current migration and PPK evidence is pinned exactly',
    scope.validation?.[`migration${selected.migration}Sha256`]===selected.validation.migrationSha256
      &&scope.validation?.ppk015?.sourceInventorySha256===selected.validation.ppk015Sha256
      &&scope.validation?.ppk021?.exactSurfaces===selected.validation.ppk021Count
      &&scope.validation?.ppk021?.sha256===selected.validation.ppk021Sha256
      &&scope.validation?.ppk022?.exactSurfaces===selected.validation.ppk022Count
      &&scope.validation?.ppk022?.sha256===selected.validation.ppk022Sha256);
}
const run=(name,args)=>{const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',stdio:'pipe',maxBuffer:64*1024*1024});
  const output=`${result.error?.stack??''}${result.stdout??''}${result.stderr??''}`;checks.push({name,status:result.status===0?'PASS':'FAIL',exitCode:result.status??1,output:output.slice(-16000)});return{result,output};};
if(mode==='runtime'){
  const targeted=run('targeted tests',[resolve(root,'node_modules/vitest/vitest.mjs'),'run',...selected.tests,'--maxWorkers=1']);
  if(selected.expectedTestFiles&&selected.expectedTests)check('targeted runtime ratchet is exact',
    targeted.result.status===0&&targeted.output.includes(`Test Files  ${selected.expectedTestFiles} passed (${selected.expectedTestFiles})`)
      &&targeted.output.includes(`Tests  ${selected.expectedTests} passed (${selected.expectedTests})`));
  if(selected.validation){
    const migrations=run('database migration verification',[resolve(root,'scripts/verify-database-migrations.mjs')]);
    check('migration checksum is current',migrations.result.status===0&&migrations.output.includes(selected.validation.migrationSha256));
    const ppk015=run('PPK-015 raw current boundary',[resolve(root,'scripts/verify-network-egress-boundary.mjs')]);
    check('PPK-015 source ratchet is current',ppk015.result.status===0&&ppk015.output.includes(selected.validation.ppk015Sha256));
    const ppk021=run('PPK-021 raw current gate',[resolve(root,'scripts/verify-platform-policy-ast-gate.mjs')]);
    check('PPK-021 exact surface ratchet is current',ppk021.result.status===0&&ppk021.output.includes(`"privilegedSurfaces": ${selected.validation.ppk021Count}`)&&ppk021.output.includes(selected.validation.ppk021Sha256));
    const ppk022=run('PPK-022 raw current gate',[resolve(root,'scripts/verify-platform-capability-manifest-gate.mjs')]);
    check('PPK-022 exact surface ratchet is current',ppk022.result.status===0&&ppk022.output.includes(`"capabilitySurfaces": ${selected.validation.ppk022Count}`)&&ppk022.output.includes(selected.validation.ppk022Sha256));
  }
  if(step==='34-I'){
    const nativeHost=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
      '-File',resolve(root,'native/windows-core-service-host/build.ps1')],{cwd:root,encoding:'utf8',stdio:'pipe',maxBuffer:16*1024*1024});
    const nativeOutput=`${nativeHost.error?.stack??''}${nativeHost.stdout??''}${nativeHost.stderr??''}`;
    checks.push({name:'deterministic unsigned Windows Service Host build',status:nativeHost.status===0
      &&nativeOutput.includes('"deterministic":true')&&nativeOutput.includes('"signed":false')
      &&nativeOutput.includes('"windowsServiceLifecycleVerified":false')?'PASS':'FAIL',exitCode:nativeHost.status??1,
      output:nativeOutput.slice(-8000)});
    const nativeRoundTrip=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
      '-File',resolve(root,'scripts/test-windows-core-service-host.ps1')],{cwd:root,encoding:'utf8',stdio:'pipe',maxBuffer:16*1024*1024});
    const roundTripOutput=`${nativeRoundTrip.error?.stack??''}${nativeRoundTrip.stdout??''}${nativeRoundTrip.stderr??''}`;
    checks.push({name:'DPAPI service configuration round-trip and no-overwrite guard',status:nativeRoundTrip.status===0
      &&roundTripOutput.includes('"roundTrip":"PASS"')&&roundTripOutput.includes('"noOverwrite":"PASS"')
      &&roundTripOutput.includes('"actualServiceInstallation":"NOT_RUN"')?'PASS':'FAIL',exitCode:nativeRoundTrip.status??1,
      output:roundTripOutput.slice(-8000)});
  }
  const projects=['packages/domain/tsconfig.json','packages/repository-contracts/tsconfig.json','packages/application/tsconfig.json','packages/database/tsconfig.json','packages/repositories/tsconfig.json','apps/core-service/tsconfig.json','apps/desktop/tsconfig.electron.json','apps/desktop/tsconfig.renderer.json'];
  for(const project of projects)run(`typecheck ${project}`,[resolve(root,'node_modules/typescript/bin/tsc'),'-p',project,'--noEmit']);
}
const failures=checks.filter(item=>item.status==='FAIL');const report={schemaVersion:1,step,decision:selected.decision,mode,sourceBaseHead,
  status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',localImplementationStatus:selected.localStatus??'PARTIAL_LOCAL_FOUNDATION_ACCEPTANCE_INCOMPLETE',
  requirementsClosed:false,countsAsRequirementPass:false,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,
  checks,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,'artifacts/validation',
  `${step}-${selected.slug}-${mode}.json`),`${JSON.stringify(report,null,2)}\n`,'utf8');}
if(failures.length){console.error(`${step} ${mode}: FAIL (${failures.length}/${checks.length}).`);for(const item of failures)console.error(item.name);process.exit(1);}
console.log(`${step} ${mode}: PASS (${checks.length}/${checks.length}; requirement PASS=false; write=${!noWrite}).`);
