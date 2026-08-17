import { existsSync,readFileSync } from 'node:fs';import { mkdir,writeFile } from 'node:fs/promises';import { resolve } from 'node:path';import { spawnSync } from 'node:child_process';
const root=resolve(process.cwd());if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const step=process.argv[2],mode=process.argv[3];const noWrite=process.argv.includes('--no-write');
const packages={
  '34-G':{slug:'e2ee-file-sharing-remaining-communication-ux',decision:'DEC-244',migration:111,
    scope:'config/34-g-e2ee-file-sharing-remaining-communication-ux-scope.json',inventory:'config/34-g-e2ee-file-sharing-remaining-communication-ux-inventory.json',
    decisionFile:'docs/decisions/DEC-244-e2ee-file-sharing-remaining-communication-ux.md',threat:'docs/security/THREAT_MODEL_34_G_E2EE_FILE_SHARING_REMAINING_COMMUNICATION_UX.md',
    localStatus:'LOCAL_PRODUCTION_COMPOSITION_ACCEPTANCE_INCOMPLETE',expectedTestFiles:6,expectedTests:34,
    validation:{migrationSha256:'7d87d405a85196a2f76a765899adf7b734858f7dc2b1715c59577d0048838700',
      ppk015Sha256:'d956f8e82d49d92da8b4eb407f61502e8450e6d397c5d1ae38564ee1a6a775db',
      ppk021Count:876,ppk021Sha256:'709379784b8e59727f58d54c6187a4f2924d19c0bcefbe6efb976ed64f825dd0',
      ppk022Count:395,ppk022Sha256:'a3b3f91af4a08d2b4fcb58d71b67a9e40283e6b94364a64519409c4d44a21d0e'},
    tests:['packages/application/tests/communication-file-sharing-use-cases.test.ts','packages/repositories/communication-file-sharing-repository-policy.test.ts','apps/desktop/tests/communication-file-payload-vault.test.ts','apps/desktop/tests/communication-file-sharing-ipc-integration.test.ts','apps/desktop/tests/communication-file-sharing-ipc-bridge.test.ts','apps/desktop/tests/remaining-communication-distributed-ui.test.ts'],
    markers:[['packages/domain/src/communication-file-sharing.ts','COMMUNICATION_FILE_SAFE_PREVIEW_MAX_BYTES'],['packages/application/src/communication-file-sharing-use-cases.ts','GetCommunicationFileSafePreviewUseCase'],['packages/application/src/communication-file-sharing-use-cases.ts','MaintainCommunicationFilePayloadVaultUseCase'],['packages/database/src/family-database-migrations.ts',"createMigrationDefinition(111, 'communication_file_sharing_remaining_ux'"],['apps/desktop/src/main/communication-file-payload-vault.ts','WindowsDefenderCommunicationFileMalwareScanner'],['apps/desktop/src/main/communication-file-payload-vault.ts','#recoverInterruptedPublications'],['apps/desktop/src/main/communication-file-payload-vault.ts','sweepOrphans'],['apps/desktop/src/main/communication-file-sharing-application-adapter.ts','RepositoryBackedCommunicationFileSharingUnitOfWork'],['apps/desktop/src/main/ipc-integration-policy.ts','getSafePreview'],['apps/desktop/src/main/data-store.ts','maintainCommunicationFilePayloadVault'],['apps/desktop/src/renderer/CommunicationFileSharingPanel.tsx','Güvenli düz metin önizleme']]},
  '34-H':{slug:'communication-audit-archive-integrity',decision:'DEC-245',migration:112,
    scope:'config/34-h-communication-audit-archive-integrity-scope.json',inventory:'config/34-h-communication-audit-archive-integrity-inventory.json',
    decisionFile:'docs/decisions/DEC-245-communication-audit-archive-integrity.md',threat:'docs/security/THREAT_MODEL_34_H_COMMUNICATION_AUDIT_ARCHIVE_INTEGRITY.md',
    localStatus:'LOCAL_PRODUCTION_QUERY_COMPOSED_ACCEPTANCE_INCOMPLETE',expectedTestFiles:5,expectedTests:10,
    validation:{migrationSha256:'876cfb55675e5c567c156932c4ddbfd672c87e547f672ebae798e03d69287fba',
      ppk015Sha256:'39e31743b413a2ec4abb95ca595f022ab4e8b27b23831f006d0e9460c14bfecb',
      ppk021Count:876,ppk021Sha256:'709379784b8e59727f58d54c6187a4f2924d19c0bcefbe6efb976ed64f825dd0',
      ppk022Count:395,ppk022Sha256:'a3b3f91af4a08d2b4fcb58d71b67a9e40283e6b94364a64519409c4d44a21d0e'},
    tests:['packages/application/tests/communication-audit-archive-use-cases.test.ts','packages/repositories/communication-audit-archive-repository-policy.test.ts','apps/desktop/tests/communication-audit-archive-ipc-integration.test.ts','apps/desktop/tests/communication-audit-archive-ipc-bridge.test.ts','apps/desktop/tests/remaining-communication-distributed-ui.test.ts'],
    markers:[['packages/domain/src/communication-audit-archive.ts','productionQueryApiComposed: true'],['packages/application/src/communication-audit-archive-use-cases.ts','communicationAuditArchiveSafeCenter'],['packages/database/src/family-database-migrations.ts',"createMigrationDefinition(112, 'communication_audit_archive_integrity'"],['packages/repositories/src/communication-audit-archive-repository.ts','exact durable policy receipt'],['apps/desktop/src/main/communication-audit-archive-application-adapter.ts','RepositoryBackedCommunicationAuditArchiveQueryPort'],['apps/desktop/src/main/ipc-integration-policy.ts','COMMUNICATION_AUDIT_ARCHIVE_IPC_CHANNELS'],['apps/desktop/src/renderer/CommunicationAuditArchivePanel.tsx','İçerikten ayrı denetim zinciri']]},
  '34-I':{slug:'distributed-core-consensus-tenancy',decision:'DEC-246',migration:113,
    scope:'config/34-i-distributed-core-consensus-tenancy-scope.json',inventory:'config/34-i-distributed-core-consensus-tenancy-inventory.json',
    decisionFile:'docs/decisions/DEC-246-distributed-core-consensus-tenancy.md',threat:'docs/security/THREAT_MODEL_34_I_DISTRIBUTED_CORE_CONSENSUS_TENANCY.md',
    localStatus:'LOCAL_HARDENED_FAIL_CLOSED_FOUNDATION_ACCEPTANCE_INCOMPLETE',expectedTestFiles:3,expectedTests:10,
    validation:{migrationSha256:'0e8fd6ce7f527d9ea1795f68a50e16f9a6a322391f8a3eef39aeb79698514860',
      ppk015Sha256:'dd417d3278b872587fa1ef32cda41e5dcf44a22c9781f29c311d78d845d48e29',
      ppk021Count:873,ppk021Sha256:'843cb93dce2402bbaeb3d44b5538b88a3a55f4832436ad23aaf61937bc8c99dc',
      ppk022Count:392,ppk022Sha256:'cb879c739cb8ef3a2e92d1f0e451cd21ba7e9d4b0fcd519f343cddd725c9745c'},
    tests:['apps/core-service/tests/distributed-core-cluster-runtime.test.ts','apps/core-service/tests/distributed-core-migration-boundary.test.ts','apps/desktop/tests/remaining-communication-distributed-ui.test.ts'],
    markers:[['packages/domain/src/distributed-core-service.ts','durableIdempotencyRequired:true'],['packages/domain/src/distributed-core-service.ts','productionRuntimeComposed:false'],['apps/core-service/src/distributed-core-cluster-runtime.ts','findByIdempotencyKey'],['apps/core-service/src/distributed-core-cluster-runtime.ts','commitAndApply'],['apps/core-service/src/distributed-core-cluster-runtime.ts','allowUnverifiedProviderForTests'],['packages/database/src/family-database-migrations.ts',"createMigrationDefinition(113, 'distributed_core_consensus_tenancy'"],['apps/desktop/src/renderer/DistributedOperationsPanel.tsx','özel consensus algoritması yazılmamıştır']]},
  '34-J':{slug:'distributed-clients-operations-disaster-recovery',decision:'DEC-247',migration:114,
    scope:'config/34-j-distributed-clients-operations-disaster-recovery-scope.json',inventory:'config/34-j-distributed-clients-operations-disaster-recovery-inventory.json',
    decisionFile:'docs/decisions/DEC-247-distributed-clients-operations-disaster-recovery.md',threat:'docs/security/THREAT_MODEL_34_J_DISTRIBUTED_CLIENTS_OPERATIONS_DR.md',
    localStatus:'LOCAL_HARDENED_FAIL_CLOSED_FOUNDATION_ACCEPTANCE_INCOMPLETE',expectedTestFiles:3,expectedTests:10,
    validation:{migrationSha256:'023c2a416901671b1231388563153d661152e372c2ec305a54f8f06874c55f34',
      ppk015Sha256:'dd417d3278b872587fa1ef32cda41e5dcf44a22c9781f29c311d78d845d48e29',
      ppk021Count:873,ppk021Sha256:'843cb93dce2402bbaeb3d44b5538b88a3a55f4832436ad23aaf61937bc8c99dc',
      ppk022Count:392,ppk022Sha256:'cb879c739cb8ef3a2e92d1f0e451cd21ba7e9d4b0fcd519f343cddd725c9745c'},
    tests:['apps/core-service/tests/distributed-operations-runtime.test.ts','apps/core-service/tests/distributed-operations-migration-boundary.test.ts','apps/desktop/tests/remaining-communication-distributed-ui.test.ts'],
    markers:[['packages/domain/src/distributed-client-operations.ts','durableOperationsEvidenceRequired: true'],['packages/domain/src/distributed-client-operations.ts','productionRuntimeComposed: false'],['apps/core-service/src/distributed-operations-runtime.ts','validateControlPlaneEnvelope'],['apps/core-service/src/distributed-operations-runtime.ts','verifyAndRegisterBackup'],['apps/core-service/src/distributed-operations-runtime.ts','createRollingUpdatePlan'],['apps/core-service/src/distributed-operations-runtime.ts','allowUnverifiedProvidersForTests'],['packages/database/src/family-database-migrations.ts',"createMigrationDefinition(114, 'distributed_clients_operations_disaster_recovery'"],['apps/desktop/src/renderer/DistributedOperationsPanel.tsx','Remote bağlantı varsayılan kapalıdır']]},
  '34-K':{slug:'windows-resilience-universal-ux',decision:'DEC-248',migration:115,
    scope:'config/34-k-windows-resilience-universal-ux-scope.json',inventory:'config/34-k-windows-resilience-universal-ux-inventory.json',
    decisionFile:'docs/decisions/DEC-248-windows-resilience-universal-ux.md',threat:'docs/security/THREAT_MODEL_34_K_WINDOWS_RESILIENCE_UNIVERSAL_UX.md',
    localStatus:'LOCAL_HARDENED_FAIL_CLOSED_FOUNDATION_ACCEPTANCE_INCOMPLETE',expectedTestFiles:3,expectedTests:13,
    validation:{migrationSha256:'e43ccbe70eecee7c7572f3c78cd26f357ab0c69357da712664bb50ed3c81279b',
      ppk015Sha256:'dd417d3278b872587fa1ef32cda41e5dcf44a22c9781f29c311d78d845d48e29',
      ppk021Count:873,ppk021Sha256:'843cb93dce2402bbaeb3d44b5538b88a3a55f4832436ad23aaf61937bc8c99dc',
      ppk022Count:392,ppk022Sha256:'cb879c739cb8ef3a2e92d1f0e451cd21ba7e9d4b0fcd519f343cddd725c9745c'},
    tests:['packages/application/tests/windows-resilience-universal-ux-use-cases.test.ts','packages/repositories/windows-resilience-universal-ux-repository-policy.test.ts','apps/desktop/tests/universal-ux-consolidation-ui.test.ts'],
    markers:[['packages/domain/src/windows-resilience-universal-ux.ts','callerSuppliedSearchAuthorizationAccepted: false'],['packages/domain/src/windows-resilience-universal-ux.ts','operationLedgerRetentionPolicyDecided: false'],['packages/application/src/windows-resilience-universal-ux-use-cases.ts','UniversalUxSearchAuthorityPort'],['packages/application/src/windows-resilience-universal-ux-use-cases.ts','WindowsResilienceEvidenceProviderPort'],['packages/repositories/src/windows-resilience-universal-ux-repository.ts','exact durable policy receipt'],['packages/database/src/family-database-migrations.ts',"createMigrationDefinition(115, 'windows_resilience_universal_ux'"],['packages/database/src/family-database-migrations.ts','34-K operation requires exact owner-bound durable PEP receipt'],['apps/desktop/src/renderer/UniversalUxConsolidationPanel.tsx','yetkilendirilmiş evrensel veri araması değildir']]}
};
const selected=packages[step];if(!selected||!['boundary','contract','runtime'].includes(mode))throw new Error('Usage: node verify-remaining-package-local-foundation.mjs <34-G..34-K> <boundary|contract|runtime> [--no-write]');
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
  check('manual evidence retains NOT_RUN facts',Object.values(scope.manualEvidence??{}).every(value=>value==='NOT_RUN'));
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
  const projects=['packages/domain/tsconfig.json','packages/repository-contracts/tsconfig.json','packages/application/tsconfig.json','packages/database/tsconfig.json','packages/repositories/tsconfig.json','apps/core-service/tsconfig.json','apps/desktop/tsconfig.electron.json','apps/desktop/tsconfig.renderer.json'];
  for(const project of projects)run(`typecheck ${project}`,[resolve(root,'node_modules/typescript/bin/tsc'),'-p',project,'--noEmit']);
}
const failures=checks.filter(item=>item.status==='FAIL');const report={schemaVersion:1,step,decision:selected.decision,mode,
  status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',localImplementationStatus:selected.localStatus??'PARTIAL_LOCAL_FOUNDATION_ACCEPTANCE_INCOMPLETE',
  requirementsClosed:false,countsAsRequirementPass:false,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,
  checks,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,'artifacts/validation',
  `${step}-${selected.slug}-${mode}.json`),`${JSON.stringify(report,null,2)}\n`,'utf8');}
if(failures.length){console.error(`${step} ${mode}: FAIL (${failures.length}/${checks.length}).`);for(const item of failures)console.error(item.name);process.exit(1);}
console.log(`${step} ${mode}: PASS (${checks.length}/${checks.length}; requirement PASS=false; write=${!noWrite}).`);
