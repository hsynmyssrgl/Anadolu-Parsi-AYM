import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertGovernedSourceRoot } from './lib/governed-source-root.mjs';

const noWrite=process.argv.includes('--no-write');
const root=assertGovernedSourceRoot({allowReleaseChannel:noWrite});
const json=async(path)=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const text=async(path)=>readFile(resolve(root,path),'utf8');
const has=(source,markers)=>markers.every((marker)=>source.includes(marker));
const [scope,inventory,registry,roadmap,plan,ledger,domain,application,repository,adapter,dataStore,ipc,panel]=await Promise.all([
  json('config/33-y-local-first-smart-home-energy-scope.json'),json('config/33-y-local-first-smart-home-energy-inventory.json'),
  json('config/accepted-scope-registry.json'),json('config/remaining-scope-package-roadmap.json'),
  json('config/work-segmentation-plan.json'),json('config/active-governance-ledger.json'),
  text('packages/domain/src/smart-home-energy.ts'),text('packages/application/src/smart-home-energy-use-cases.ts'),
  text('packages/repositories/src/smart-home-energy-repository.ts'),text('apps/desktop/src/main/smart-home-energy-application-adapter.ts'),
  text('apps/desktop/src/main/data-store.ts'),text('apps/desktop/src/main/ipc-integration-policy.ts'),
  text('apps/desktop/src/renderer/SmartHomeEnergyPanel.tsx')
]);
const requirements=['EXT-064','EXT-065','EXT-066','EXT-067','EXT-068','EXT-069'];
const dependencies=['33-O','33-P'];
const roadmapItem=roadmap.packages?.find((item)=>item.step==='33-Y');
const registryItems=requirements.map((id)=>registry.requirements?.find((item)=>item.id===id));
const manual=Object.entries(scope.manualEvidence??{}).filter(([key])=>key!=='certificationClaimed').every(([,value])=>value==='NOT_RUN');
const definitions=[
  ['scope inventory roadmap and dependency identities are exact',scope.step==='33-Y'&&scope.decision==='DEC-236'&&JSON.stringify(scope.requirements)===JSON.stringify(requirements)&&JSON.stringify(inventory.requirements)===JSON.stringify(requirements)&&roadmapItem?.status==='PLANNED'&&JSON.stringify(roadmapItem.dependsOn)===JSON.stringify(dependencies)],
  ['registry plan and ledger remain open behind 33-P',registryItems.every((item)=>item&&item.status!=='COMPLETE'&&item.chain?.evidence===false)&&plan.currentStep==='33-P'&&ledger.activeMicroStep==='33-P'],
  ['domain fixes device observation capacity and fail-honest truth vocabularies',has(domain,['SMART_HOME_DEVICE_KINDS','SMART_HOME_OBSERVATION_KINDS','SMART_HOME_MAX_DEVICES = 500','SMART_HOME_MAX_OBSERVATIONS = 50_000','SMART_HOME_MAX_CAMERA_CONSENTS = 2_000','SMART_HOME_MAX_MUTATIONS = 100_000','processingDisabledBlocksNewObservations: true','automaticRetentionRecoveryImplemented: false'])],
  ['application exposes exact seven governed use cases',has(application,['GetSmartHomeEnergyCenterUseCase','RegisterSmartHomeDeviceUseCase','UpdateSmartHomeDeviceStatusUseCase','RecordSmartHomeObservationUseCase','GrantSmartHomeCameraConsentUseCase','RevokeSmartHomeCameraConsentUseCase','SetSmartHomeProcessingUseCase'])],
  ['application enforces exact commands processing gate capacity and bounded visible consent',has(application,['exactRecord(command','getStorageUsage()','Yeni sensör gözlemleri için yerel işleme açık olmalıdır.','Kapı zilini yanıtlama izni yalnız kapı zili cihazı','adapterSignatureVerified !== true','visibleIndicatorRequired: true'])],
  ['repository uses exact receipt fence owner scope bounded usage and payload-free resolution',has(repository,['writeBinding(context, row)','resolvePolicyResource','getStorageUsage','owner_person_id=? AND actor_account_id=?','smart_home_mutations','signed_adapter_evidence_persisted'])],
  ['desktop adapter composes central PEP and atomic audit outbox',has(adapter,['RepositoryBackedSmartHomeEnergyUnitOfWork','RepositoryBackedLifePolicyTransactionRunner','auditRepository.append','outboxRepository.enqueue'])],
  ['DataStore composes seven use cases with main-only provider writes',has(dataStore,['GetSmartHomeEnergyCenterUseCase','RegisterSmartHomeDeviceUseCase','RecordSmartHomeObservationUseCase','GrantSmartHomeCameraConsentUseCase','getSmartHomeEnergyCenter(','registerSmartHomeDevice(','recordSmartHomeObservation('])],
  ['adapter and IPC redact grant actors and expose bounded effective state',has(adapter,['effectiveStatus:','storageCapacity: Object.freeze','cameraConsentTotal:'])&&has(ipc,['effectiveStatus','cameraConsentTotal','storageCapacity','automaticRetentionRecoveryImplemented'])],
  ['IPC exposes exactly four renderer-safe channels',has(ipc,["getCenter:'smartHomeEnergy:getCenter'","grantCameraConsent:'smartHomeEnergy:grantCameraConsent'","revokeCameraConsent:'smartHomeEnergy:revokeCameraConsent'","setProcessing:'smartHomeEnergy:setProcessing'"])],
  ['renderer states capacity retention and provider no-claim boundary',has(panel,['Gizli gözetim yasaktır','en çok 60 dakikadır','eski kayıtlar otomatik silinmedi','Akıllı ev eşleme','cihaz kontrolü','bu sürümde kullanılmaz'])],
  ['network cloud control camera and provider claims stay false',scope.truth?.matterCommissioningPerformed===false&&scope.truth?.liveProviderConnectionTested===false&&scope.truth?.liveDeviceControlPerformed===false&&scope.truth?.sensorProviderIngestionPerformed===false&&scope.truth?.rawCameraOrAudioStored===false&&scope.truth?.networkUsedByCurrentImplementation===false&&scope.truth?.cloudUsed===false&&scope.truth?.externalDeliveryPerformed==='not_performed'],
  ['manual evidence receipt and requirement acceptance remain closed',manual&&scope.manualEvidence?.certificationClaimed===false&&scope.persistentReceiptStatus==='NOT_RUN'&&scope.truth?.requirementsClosed===false&&scope.truth?.countsAsRequirementPass===false&&inventory.countsAsRequirementPass===false]
];
const checks=definitions.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));const failures=checks.filter((item)=>item.status==='FAIL');
const report={schemaVersion:1,step:'33-Y',decision:'DEC-236',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',countsAsRequirementPass:false,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,checks,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,'artifacts/validation/33-Y-local-first-smart-home-energy-boundary.json'),`${JSON.stringify(report,null,2)}\n`);}
if(failures.length){console.error(`33-Y boundary: FAIL (${failures.length}/${checks.length}).`);for(const item of failures)console.error(item.name);process.exit(1);}console.log(`33-Y boundary: PASS (${checks.length}/${checks.length}).`);
