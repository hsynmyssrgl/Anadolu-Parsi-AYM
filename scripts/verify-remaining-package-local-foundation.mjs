import { existsSync,readFileSync } from 'node:fs';import { mkdir,writeFile } from 'node:fs/promises';import { resolve } from 'node:path';import { spawnSync } from 'node:child_process';
const root=resolve(process.cwd());if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const step=process.argv[2],mode=process.argv[3];const noWrite=process.argv.includes('--no-write');
const packages={
  '34-G':{slug:'e2ee-file-sharing-remaining-communication-ux',decision:'DEC-244',migration:111,
    scope:'config/34-g-e2ee-file-sharing-remaining-communication-ux-scope.json',inventory:'config/34-g-e2ee-file-sharing-remaining-communication-ux-inventory.json',
    decisionFile:'docs/decisions/DEC-244-e2ee-file-sharing-remaining-communication-ux.md',threat:'docs/security/THREAT_MODEL_34_G_E2EE_FILE_SHARING_REMAINING_COMMUNICATION_UX.md',
    tests:['packages/application/tests/communication-file-sharing-use-cases.test.ts','packages/repositories/communication-file-sharing-repository-policy.test.ts','apps/desktop/tests/remaining-communication-distributed-ui.test.ts'],
    markers:[['packages/domain/src/communication-file-sharing.ts','externalLinksDefaultClosed'],['packages/application/src/communication-file-sharing-use-cases.ts','Dosya parça doğrulama kaydı geçersizdir'],['packages/database/src/family-database-migrations.ts',"createMigrationDefinition(111, 'communication_file_sharing_remaining_ux'"],['apps/desktop/src/renderer/CommunicationFileSharingPanel.tsx','Acil servis garantisi değildir']]},
  '34-H':{slug:'communication-audit-archive-integrity',decision:'DEC-245',migration:112,
    scope:'config/34-h-communication-audit-archive-integrity-scope.json',inventory:'config/34-h-communication-audit-archive-integrity-inventory.json',
    decisionFile:'docs/decisions/DEC-245-communication-audit-archive-integrity.md',threat:'docs/security/THREAT_MODEL_34_H_COMMUNICATION_AUDIT_ARCHIVE_INTEGRITY.md',
    tests:['packages/application/tests/communication-audit-archive-use-cases.test.ts','packages/repositories/communication-audit-archive-repository-policy.test.ts','apps/desktop/tests/remaining-communication-distributed-ui.test.ts'],
    markers:[['packages/domain/src/communication-audit-archive.ts','contentExcludedFromAuditByConstruction'],['packages/application/src/communication-audit-archive-use-cases.ts','verifyCommunicationAuditChain'],['packages/database/src/family-database-migrations.ts',"createMigrationDefinition(112, 'communication_audit_archive_integrity'"],['apps/desktop/src/renderer/CommunicationAuditArchivePanel.tsx','İçerikten ayrı denetim zinciri']]},
  '34-I':{slug:'distributed-core-consensus-tenancy',decision:'DEC-246',migration:113,
    scope:'config/34-i-distributed-core-consensus-tenancy-scope.json',inventory:'config/34-i-distributed-core-consensus-tenancy-inventory.json',
    decisionFile:'docs/decisions/DEC-246-distributed-core-consensus-tenancy.md',threat:'docs/security/THREAT_MODEL_34_I_DISTRIBUTED_CORE_CONSENSUS_TENANCY.md',
    tests:['apps/core-service/tests/distributed-core-cluster-runtime.test.ts','apps/core-service/tests/distributed-core-migration-boundary.test.ts','apps/desktop/tests/remaining-communication-distributed-ui.test.ts'],
    markers:[['packages/domain/src/distributed-core-service.ts','customConsensusAlgorithmImplemented:false'],['apps/core-service/src/distributed-core-cluster-runtime.ts','RAFT_PROVIDER_UNAVAILABLE'],['packages/database/src/family-database-migrations.ts',"createMigrationDefinition(113, 'distributed_core_consensus_tenancy'"],['apps/desktop/src/renderer/DistributedOperationsPanel.tsx','özel consensus algoritması yazılmamıştır']]},
  '34-J':{slug:'distributed-clients-operations-disaster-recovery',decision:'DEC-247',migration:114,
    scope:'config/34-j-distributed-clients-operations-disaster-recovery-scope.json',inventory:'config/34-j-distributed-clients-operations-disaster-recovery-inventory.json',
    decisionFile:'docs/decisions/DEC-247-distributed-clients-operations-disaster-recovery.md',threat:'docs/security/THREAT_MODEL_34_J_DISTRIBUTED_CLIENTS_OPERATIONS_DR.md',
    tests:['apps/core-service/tests/distributed-operations-runtime.test.ts','apps/core-service/tests/distributed-operations-migration-boundary.test.ts','apps/desktop/tests/remaining-communication-distributed-ui.test.ts'],
    markers:[['packages/domain/src/distributed-client-operations.ts','remoteConnectivityDefaultDisabled'],['apps/core-service/src/distributed-operations-runtime.ts','validateControlPlaneEnvelope'],['packages/database/src/family-database-migrations.ts',"createMigrationDefinition(114, 'distributed_clients_operations_disaster_recovery'"],['apps/desktop/src/renderer/DistributedOperationsPanel.tsx','Remote bağlantı varsayılan kapalıdır']]},
  '34-K':{slug:'windows-resilience-universal-ux',decision:'DEC-248',migration:115,
    scope:'config/34-k-windows-resilience-universal-ux-scope.json',inventory:'config/34-k-windows-resilience-universal-ux-inventory.json',
    decisionFile:'docs/decisions/DEC-248-windows-resilience-universal-ux.md',threat:'docs/security/THREAT_MODEL_34_K_WINDOWS_RESILIENCE_UNIVERSAL_UX.md',
    tests:['packages/application/tests/windows-resilience-universal-ux-use-cases.test.ts','packages/repositories/windows-resilience-universal-ux-repository-policy.test.ts','apps/desktop/tests/universal-ux-consolidation-ui.test.ts'],
    markers:[['packages/domain/src/windows-resilience-universal-ux.ts','evaluatePolicyWeakening'],['packages/application/src/windows-resilience-universal-ux-use-cases.ts','requirementsClosed'],['packages/database/src/family-database-migrations.ts',"createMigrationDefinition(115, 'windows_resilience_universal_ux'"],['apps/desktop/src/renderer/UniversalUxConsolidationPanel.tsx','7 günlük soak kanıtı yoktur']]}
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
  check('fail-honest status remains non-accepting',scope.status==='PLANNED'&&scope.truth?.requirementsClosed===false&&scope.truth?.countsAsRequirementPass===false&&inventory.countsAsRequirementPass===false);
  check('manual evidence retains NOT_RUN facts',Object.values(scope.manualEvidence??{}).every(value=>value==='NOT_RUN'));
  check('decision and threat model reject false closure',decision.includes('countsAsRequirementPass=false')&&threat.includes('Residual risk'));
}
const run=(name,args)=>{const result=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',stdio:'pipe',maxBuffer:64*1024*1024});
  const output=`${result.error?.stack??''}${result.stdout??''}${result.stderr??''}`;checks.push({name,status:result.status===0?'PASS':'FAIL',exitCode:result.status??1,output:output.slice(-16000)});};
if(mode==='runtime'){
  run('targeted tests',[resolve(root,'node_modules/vitest/vitest.mjs'),'run',...selected.tests,'--maxWorkers=1']);
  const projects=['packages/domain/tsconfig.json','packages/repository-contracts/tsconfig.json','packages/application/tsconfig.json','packages/database/tsconfig.json','packages/repositories/tsconfig.json','apps/core-service/tsconfig.json','apps/desktop/tsconfig.electron.json','apps/desktop/tsconfig.renderer.json'];
  for(const project of projects)run(`typecheck ${project}`,[resolve(root,'node_modules/typescript/bin/tsc'),'-p',project,'--noEmit']);
}
const failures=checks.filter(item=>item.status==='FAIL');const report={schemaVersion:1,step,decision:selected.decision,mode,
  status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',localImplementationStatus:'PARTIAL_LOCAL_FOUNDATION_ACCEPTANCE_INCOMPLETE',
  requirementsClosed:false,countsAsRequirementPass:false,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,
  checks,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,'artifacts/validation',
  `${step}-${selected.slug}-${mode}.json`),`${JSON.stringify(report,null,2)}\n`,'utf8');}
if(failures.length){console.error(`${step} ${mode}: FAIL (${failures.length}/${checks.length}).`);for(const item of failures)console.error(item.name);process.exit(1);}
console.log(`${step} ${mode}: PASS (${checks.length}/${checks.length}; requirement PASS=false; write=${!noWrite}).`);
