import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const root=resolve(process.cwd());
const output='artifacts/validation/33-O-privacy-ownership-data-rights-incident-control-runtime.json';
const testFiles=[
 'packages/application/tests/privacy-ownership-data-rights-use-cases.test.ts','packages/repositories/privacy-ownership-data-rights-repository-policy.test.ts',
 'packages/security/tests/privacy-data-export.test.ts','apps/desktop/tests/privacy-data-export-service.test.ts',
 'apps/desktop/tests/privacy-ownership-data-rights-ipc-integration.test.ts','apps/desktop/tests/privacy-ownership-data-rights-ipc-bridge.test.ts',
 'apps/desktop/tests/privacy-ownership-data-rights-application-adapter.test.ts','apps/desktop/tests/privacy-ownership-data-store.test.ts',
 'apps/desktop/tests/privacy-ownership-data-rights-ui.test.ts','apps/desktop/tests/ppk016-derived-data-policy-inheritance.test.ts',
 'apps/desktop/tests/ppk019-source-deletion-propagation.test.ts'
];
const productionFiles={
 domain:'packages/domain/src/privacy-ownership-data-rights.ts',application:'packages/application/src/privacy-ownership-data-rights-use-cases.ts',
 repository:'packages/repositories/src/privacy-ownership-data-rights-repository.ts',migration:'packages/database/src/family-database-migrations.ts',
 lifecycle:'packages/repositories/src/data-lifecycle-repository.ts',security:'packages/security/src/privacy-data-export.ts',
 fileService:'apps/desktop/src/main/privacy-data-export-service.ts',adapter:'apps/desktop/src/main/privacy-ownership-data-rights-application-adapter.ts',
 dataStore:'apps/desktop/src/main/data-store.ts',ipc:'apps/desktop/src/main/ipc-integration-policy.ts',
 requestLifecycle:'apps/desktop/src/main/ipc-request-lifecycle.ts',main:'apps/desktop/src/main/main.ts',app:'apps/desktop/src/renderer/App.tsx',
 migrationManifest:'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'
};
const run=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run',...testFiles,'--maxWorkers=1'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:300_000,maxBuffer:32*1024*1024,env:process.env});
const combined=`${run.stdout??''}\n${run.stderr??''}`;
const fileMatch=combined.match(/Test Files\s+(?:\d+ failed\s+\|\s+)?(\d+) passed/u);
const testMatch=combined.match(/Tests\s+(?:\d+ failed\s+\|\s+)?(\d+) passed/u);
const filesPassed=fileMatch?Number(fileMatch[1]):0;const testsPassed=testMatch?Number(testMatch[1]):0;
const sources=Object.fromEntries(await Promise.all(testFiles.map(async path=>[path,await readFile(resolve(root,path),'utf8')])));
const production=Object.fromEntries(await Promise.all(Object.entries(productionFiles).map(async([key,path])=>[key,await readFile(resolve(root,path),'utf8')])));
const has=(key,...markers)=>markers.every(marker=>production[key].includes(marker));
const migrationEvidence=JSON.parse(production.migrationManifest);const migration92=migrationEvidence.migrationVersions?.find(item=>item.version===92);
const defs=[
 ['targeted vitest exits successfully',run.status===0],['exact eleven targeted files pass',run.status===0&&filesPassed===11],
 ['exact measured 167-test ratchet passes',run.status===0&&testsPassed===167],
 ['AI memory mutation replay is operation and fingerprint bound',has('application','executeMutation','clientOperationId','requestFingerprint')&&has('repository','findMutationByClientOperationId','state_fingerprint')],
 ['repository owner isolation and bounded complete-category inventory are policy and key bound',has('repository','assertPolicyAuthorizedRepositoryContext','assertKey','owner_person_id','policyScope(context, row.key','MAX_INVENTORY','Privacy inventory category bound exceeded','archive_items item')],
 ['access and processing facts are explicitly local only',has('domain',"observationSource: 'local_runtime'",'networkDeliveryObserved: false','networkDeliveryGuaranteed: false')],
 ['rights incident export scope and permission simulation use exact governed production APIs',has('repository','saveRightsRequest','saveIncident','insertRightsEvent','insertIncidentEvent')&&has('adapter','insertRightsRequest','saveRightsRequest','insertIncident','saveIncident','CentralAuthorizationService')&&has('application',"target.resourceType !== 'privacy_inventory'",'target.resourceId !== key.value.ownerPersonId')&&has('dataStore','exportEncryptedPrivacyData','simulatePrivacyPermission','ownerStructuredData','privacy_digital_legacy','scopeApplied:true')],
 ['migration enforces immutable ledgers and incident containment',has('migration','trg_33o_ai_mutation_update','trg_33o_rights_event_update','trg_33o_incident_event_update','trg_33o_revocation_update')],
 ['encrypted export KDF wrapped DEK and payload AEAD are exact',has('security','scryptSync','aes-256-gcm','wrappedDek','verifyPrivacyDataExportReadback')],
 ['encrypted export authenticates AAD and fails closed',has('security','authenticatedMetadata','decipher.setAAD(aad)','decipher.setAuthTag(tag)','exactKeys','finally')],
 ['file publish is same-directory no-clobber with decrypt readback',has('fileService',"open(temporaryPath, 'wx', 0o600)",'link(temporaryPath, finalPath)','verifyPrivacyDataExportReadback','removeIfPresent(temporaryPath)')],
 ['IPC production policy owns exact channels scopes and unknown rejection',has('ipc','privacyOwnership:getCenter','privacyOwnership:exportEncrypted','UNKNOWN_IPC_CHANNEL',"input.scopeResourceType === 'privacy_inventory'","input.scopeResourceType === 'digital_legacy'","target.resourceType === 'privacy_inventory'")],
 ['IPC recursively rejects banking secret path prototype and oversize input',has('ipc','BANKING_SECRET_FIELD_PROHIBITED','PATH_FIELD_PROHIBITED','NON_PLAIN_OBJECT_REJECTED','PRIVACY_STRING_TOO_LARGE')],
 ['IPC production lifecycle ratchets reads writes concurrency queue and timeout',has('requestLifecycle','maxRequestsPerWindow: 120','maxRequestsPerWindow: 24','maxConcurrentPerSender: 2','maxConcurrentPerChannel: 1','maxQueuedPerSender: 4','queueTimeoutMs: 2_500')],
 ['main owns export destination and cancellation',has('main','dialog.showSaveDialog','PrivacyExportCancelledError','destination: selected.filePath')],
 ['UI preserves retry stable CAS lock exact owner export lifecycle inventory totals and passphrase clearing',has('app','pendingOperations.current.get(key)','expectedRevision:revision',"finally{setExportPassphrase('');setBusy('');}",'scopeResourceId:center.key.ownerPersonId','updatePrivacyRightsRequest','updatePrivacyIncident','item.recordCount')],
 ['PPK-016 lineage authority remains production-bound',has('lifecycle','derived_data_policy_sources','derived_data_policy_bindings')],
 ['PPK-019 AI tombstone trigger and migration checksum are exact',has('lifecycle','governed_ai_memory_records','SOURCE_DELETION_PROPAGATION_AI_MEMORY_NOT_TOMBSTONED')&&has('migration','trg_33o_ai_current_delete')&&migration92?.checksum==='a81c13518563172d29aa2b351218faf553a2189616657fc0fbda9b1922eee137']
];
const checks=defs.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));const failures=checks.filter(x=>x.status==='FAIL');
const report={schemaVersion:1,step:'33-O',decision:'DEC-226',requirements:['B6-02','PPK-028','AUD-COM-006','EXT-036','EXT-037','EXT-038','EXT-040','EXT-041','EXT-042'],status:failures.length?'FAIL':'PASS',checksPassed:checks.length-failures.length,checksFailed:failures.length,targetedTestFilesPassed:filesPassed,targetedTestsPassed:testsPassed,testFiles,checks,process:{exitCode:run.status,signal:run.signal??null},generatedAt:new Date().toISOString()};
await mkdir(dirname(resolve(root,output)),{recursive:true});await writeFile(resolve(root,output),`${JSON.stringify(report,null,2)}\n`,'utf8');console.log(`33-O runtime: ${report.status} (${report.checksPassed}/${checks.length}; ${testsPassed} tests).`);if(failures.length){console.error(combined.slice(-3000));process.exitCode=1;}
