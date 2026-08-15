import { createHash } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(process.cwd());if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');const json=async(path)=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const text=async(path)=>readFile(resolve(root,path),'utf8');const has=(source,markers)=>markers.every((marker)=>source.includes(marker));
const targetedTestFiles=Object.freeze(['packages/application/tests/smart-home-energy-use-cases.test.ts','packages/repositories/smart-home-energy-repository-policy.test.ts','apps/desktop/tests/smart-home-energy-data-store.test.ts','apps/desktop/tests/smart-home-energy-ipc-integration.test.ts','apps/desktop/tests/smart-home-energy-ui.test.ts']);
const [scope,inventory,manifest,migrations,contract,repository,adapter,runtime,main,preload,globalTypes,decision,threat,...tests]=await Promise.all([
  json('config/33-y-local-first-smart-home-energy-scope.json'),json('config/33-y-local-first-smart-home-energy-inventory.json'),json('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),
  text('packages/database/src/family-database-migrations.ts'),text('packages/repository-contracts/src/smart-home-energy-repository.ts'),text('packages/repositories/src/smart-home-energy-repository.ts'),
  text('apps/desktop/src/main/smart-home-energy-application-adapter.ts'),text('apps/desktop/src/main/life-production-policy-runtime.ts'),text('apps/desktop/src/main/main.ts'),text('apps/desktop/src/main/preload.ts'),text('apps/desktop/src/renderer/global.d.ts'),
  text('docs/decisions/DEC-236-local-first-smart-home-energy-adapters.md'),text('docs/security/THREAT_MODEL_33_Y_LOCAL_FIRST_SMART_HOME_ENERGY.md'),...targetedTestFiles.map(text)
]);
const match=migrations.match(/const smartHomeEnergySql = `([\s\S]*?)`;\r?\n/u);const sha=match?createHash('sha256').update(`${match[1].replace(/\r\n/g,'\n').trim()}\n`).digest('hex'):'';
const migration=manifest.migrationVersions?.find((item)=>item.version===103);const p21=scope.validation.ppk021;const p22=scope.validation.ppk022;
const definitions=[
  ['scope inventory and five-test matrix are exact',JSON.stringify(scope.requirements)===JSON.stringify(inventory.requirements)&&JSON.stringify(scope.validation.targetedTestFiles)===JSON.stringify(inventory.implementedTargetedTests)&&tests.length===5&&scope.validation.targetedTestRatchet===21],
  ['migration 103 source manifest and scope checksums are canonical',migration?.name==='local_first_smart_home_energy'&&migration?.checksum===sha&&sha===scope.validation.migrationSha256&&sha==='d41d1a1e1bff6b89638a44096eb2ef62358e4d5370ef82d58ae2f0b4de211513'],
  ['migration owns immutable device observation consent settings and mutation ledgers',has(migrations,['smart_home_mutations','smart_home_devices','smart_home_observations','smart_home_camera_consents','smart_home_settings','trg_33y_smart_home_mutation_delete','trg_33y_smart_home_device_delete'])],
  ['repository contract exposes center current mutation and payload-free policy ports',has(contract,['loadCenter','findDevice','findConsent','findSettings','findMutationByClientOperationId','insertMutation','insertDevice','saveDevice','insertObservation','insertConsent','saveConsent','insertSettings','saveSettings','resolvePolicyResource'])],
  ['repository enforces receipt owner signature and manifest bindings',has(repository,['writeBinding(context, row)','resolvePolicyResource','adapterManifestSha256','sourceManifestSha256'])],
  ['desktop adapter composes central policy and transactional audit outbox',has(adapter,['RepositoryBackedLifePolicyTransactionRunner','RepositoryBackedSmartHomeEnergyUnitOfWork','auditRepository.append','outboxRepository.enqueue'])],
  ['production runtime resolves exact private smart-home owners',has(runtime,["'smart_home_device','smart_home_observation'","'smart_home_camera_consent','smart_home_settings'",'smartHomeEnergyPolicyResourceRepository.resolvePolicyResource'])],
  ['main preload and renderer expose exact four safe methods',has(main,['SMART_HOME_ENERGY_IPC_CHANNELS.getCenter','SMART_HOME_ENERGY_IPC_CHANNELS.grantCameraConsent','SMART_HOME_ENERGY_IPC_CHANNELS.setProcessing'])&&has(preload,['getSmartHomeEnergyCenter','grantSmartHomeCameraConsent','revokeSmartHomeCameraConsent','setSmartHomeProcessing'])&&has(globalTypes,['getSmartHomeEnergyCenter','grantSmartHomeCameraConsent','revokeSmartHomeCameraConsent','setSmartHomeProcessing'])],
  ['tests cover replay forged trust rollback bounded consent no-route and safe IPC',has(tests.join('\n'),['replayed:true','forged manifest','controlled 33-Y outbox failure','min={5}','without a new route','rejects renderer-supplied trust evidence'])],
  ['decision and threat model deny commissioning provider device control cloud and acceptance claims',has(decision,['countsAsRequirementPass=false','Matter eşleme','cihaz kontrolü','NOT_RUN'])&&has(threat,['Sahte adapter veya cihaz','Gizli gözetim','Cihaz kontrolü yanılgısı','NOT_RUN'])],
  ['PPK ratchets are exact PASS while requirement remains open',p21.status==='PASS'&&p21.scannedProductionFiles===486&&p21.exactPrivilegedSurfaceCount===751&&p21.exactAllowlistSha256==='63e2766aa18e42b1472a9ccf9521c586b81ac19e36d7d9ca72fe48e872be2aa2'&&p22.status==='PASS'&&p22.scannedProductionFiles===486&&p22.exactCapabilitySurfaceCount===345&&p22.exactCapabilityManifestSha256==='1b8625264023eb79d3f36a3c25ca19480569bea6aa1f4589841b1b4d14d5ec3e'&&scope.validation.countsAsRequirementPass===false]
];
const checks=definitions.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));const failures=checks.filter((item)=>item.status==='FAIL');
const report={schemaVersion:1,step:'33-Y',decision:'DEC-236',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',countsAsRequirementPass:false,migration103Sha256:sha,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,checks,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,'artifacts/validation/33-Y-local-first-smart-home-energy-contract.json'),`${JSON.stringify(report,null,2)}\n`);}
if(failures.length){console.error(`33-Y contract: FAIL (${failures.length}/${checks.length}).`);for(const item of failures)console.error(item.name);process.exit(1);}console.log(`33-Y contract: PASS (${checks.length}/${checks.length}).`);
