import { createHash } from 'node:crypto';import { mkdir,readFile,writeFile } from 'node:fs/promises';import { resolve } from 'node:path';
const root=resolve(process.cwd());if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');const json=async(path)=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const text=async(path)=>readFile(resolve(root,path),'utf8');const has=(source,markers)=>markers.every((marker)=>source.includes(marker));
const targetedTestFiles=Object.freeze([
  'packages/application/tests/places-travel-asset-pet-use-cases.test.ts',
  'packages/repositories/places-travel-asset-pet-repository-policy.test.ts',
  'apps/desktop/tests/places-travel-asset-pet-ipc-integration.test.ts',
  'apps/desktop/tests/places-travel-asset-pet-data-store.test.ts',
  'apps/desktop/tests/places-travel-asset-pet-ui.test.ts'
]);
const [scope,inventory,manifest,migrations,contract,repository,adapter,runtime,main,preload,globalTypes,decision,threat,...tests]=await Promise.all([
  json('config/33-v-places-travel-asset-pet-scope.json'),json('config/33-v-places-travel-asset-pet-inventory.json'),json('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),
  text('packages/database/src/family-database-migrations.ts'),text('packages/repository-contracts/src/places-travel-asset-pet-repository.ts'),text('packages/repositories/src/places-travel-asset-pet-repository.ts'),
  text('apps/desktop/src/main/places-travel-asset-pet-application-adapter.ts'),text('apps/desktop/src/main/life-production-policy-runtime.ts'),text('apps/desktop/src/main/main.ts'),text('apps/desktop/src/main/preload.ts'),text('apps/desktop/src/renderer/global.d.ts'),
  text('docs/decisions/DEC-233-places-travel-asset-pet.md'),text('docs/security/THREAT_MODEL_33_V_PLACES_TRAVEL_ASSET_PET.md'),
  ...targetedTestFiles.map(text)]);
const match=migrations.match(/const placesTravelAssetPetSql = `([\s\S]*?)`;\r?\n/u);const sha=match?createHash('sha256').update(`${match[1].replace(/\r\n/g,'\n').trim()}\n`).digest('hex'):'';
const migration=manifest.migrationVersions?.find((item)=>item.version===100);const p21=scope.validation.ppk021;const p22=scope.validation.ppk022;
const definitions=[
  ['scope inventory and five-test matrix are exact',JSON.stringify(scope.requirements)===JSON.stringify(inventory.requirements)&&JSON.stringify(scope.validation.targetedTestFiles)===JSON.stringify(inventory.implementedTargetedTests)&&tests.length===5&&scope.validation.targetedTestRatchet===27],
  ['migration 100 source manifest and scope checksums are canonical',migration?.name==='places_travel_asset_pet_workflows'&&migration?.checksum===sha&&sha===scope.validation.migrationSha256&&sha==='99039cdc9ebebaa727db0b9b8bc51c416e8f77c8bc4a5a9b9b119b9fb73c03dd'],
  ['migration owns immutable current and mutation ledgers',has(migrations,['places_travel_mutations','places_travel_items','trg_33v_places_travel_item_delete','trg_33v_places_travel_mutation_delete'])],
  ['repository contract exposes center item mutation and policy ports',has(contract,['loadCenter','findMutationByClientOperationId','insertItem','saveItem','findItemForPolicyResolution'])],
  ['repository enforces exact owner-bound receipt and payload-free policy resolution',has(repository,["authorization.purpose!=='general'",'receiptRecord.request.resource.ownerPersonId!==key.ownerPersonId','writeBinding(context,row)','findItemForPolicyResolution','LIMIT 1001'])],
  ['desktop adapter uses central authorization and transactional audit outbox',has(adapter,['CentralAuthorizationService','RepositoryBackedPlacesTravelAssetPetUnitOfWork','auditRepository.append','outboxRepository.enqueue'])],
  ['production runtime resolves exact center and item owner privacy',has(runtime,["requestedIntent.resourceType === 'places_travel_center'",'collectionOwnerPersonId','ownerPersonId: found.value.ownerPersonId','placesTravelVisibilityPrivacy'])],
  ['main preload and renderer expose exact four safe methods',has(main,['PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.getCenter','PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.createItem','PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.updateItem','PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.deleteItem'])&&has(preload,['getPlacesTravelCenter','createPlacesTravelItem','updatePlacesTravelItem','deletePlacesTravelItem'])&&has(globalTypes,['getPlacesTravelCenter','createPlacesTravelItem','updatePlacesTravelItem','deletePlacesTravelItem'])],
  ['tests cover replay owner binding visibility laundering all workflows rollback IPC and route',has(tests.join('\n'),['replays exact command','active same-family travel participants','prevents visibility laundering','canonical field matrix','atomically rolls back','rejects renderer authority','existing Life route'])],
  ['decision and threat model deny provider payment tracking and acceptance claims',has(decision,['countsAsRequirementPass=false','Harita sağlayıcısı','NOT_RUN'])&&has(threat,['canlı servis takibi','ödeme','NOT_RUN'])],
  ['PPK ratchets are final PASS while requirement remains open',p21.status==='PASS'&&p21.scannedProductionFiles>0&&p21.exactPrivilegedSurfaceCount>0&&/^[0-9a-f]{64}$/u.test(p21.exactAllowlistSha256)&&p22.status==='PASS'&&p22.scannedProductionFiles===p21.scannedProductionFiles&&p22.exactCapabilitySurfaceCount>0&&/^[0-9a-f]{64}$/u.test(p22.exactCapabilityManifestSha256)&&scope.validation.countsAsRequirementPass===false]
];
const checks=definitions.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));const failures=checks.filter((item)=>item.status==='FAIL');
const report={schemaVersion:1,step:'33-V',decision:'DEC-233',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',countsAsRequirementPass:false,migration100Sha256:sha,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,checks,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,'artifacts/validation/33-V-places-travel-asset-pet-contract.json'),`${JSON.stringify(report,null,2)}\n`);}
if(failures.length){console.error(`33-V contract: FAIL (${failures.length}/${checks.length}).`);for(const item of failures)console.error(item.name);process.exit(1);}console.log(`33-V contract: PASS (${checks.length}/${checks.length}).`);
