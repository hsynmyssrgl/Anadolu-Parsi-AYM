import { mkdir,readFile,writeFile } from 'node:fs/promises';import { resolve } from 'node:path';
const root=resolve(process.cwd());if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');const json=async(path)=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const text=async(path)=>readFile(resolve(root,path),'utf8');const has=(source,markers)=>markers.every((marker)=>source.includes(marker));
const [scope,inventory,registry,roadmap,plan,ledger,domain,application,repository,dataStore,ipc,panel]=await Promise.all([
  json('config/33-v-places-travel-asset-pet-scope.json'),json('config/33-v-places-travel-asset-pet-inventory.json'),json('config/accepted-scope-registry.json'),
  json('config/remaining-scope-package-roadmap.json'),json('config/work-segmentation-plan.json'),json('config/active-governance-ledger.json'),
  text('packages/domain/src/places-travel-asset-pet.ts'),text('packages/application/src/places-travel-asset-pet-use-cases.ts'),
  text('packages/repositories/src/places-travel-asset-pet-repository.ts'),text('apps/desktop/src/main/data-store.ts'),
  text('apps/desktop/src/main/ipc-integration-policy.ts'),text('apps/desktop/src/renderer/PlacesTravelAssetPetPanel.tsx')]);
const requirements=['B5-05','EXT-033','EXT-035','EXT-058','EXT-059','EXT-060','EXT-061','EXT-062','EXT-063'];
const roadmapItem=roadmap.packages?.find((item)=>item.step==='33-V');const registryItems=requirements.map((id)=>registry.requirements?.find((item)=>item.id===id));
const manual=Object.entries(scope.manualEvidence??{}).filter(([key])=>key!=='certificationClaimed').every(([,value])=>value==='NOT_RUN');
const definitions=[
  ['scope inventory and roadmap identities are exact',scope.step==='33-V'&&scope.decision==='DEC-233'&&JSON.stringify(scope.requirements)===JSON.stringify(requirements)&&JSON.stringify(inventory.requirements)===JSON.stringify(requirements)&&roadmapItem?.status==='PLANNED'&&JSON.stringify(roadmapItem.dependsOn)===JSON.stringify(['33-R','33-S'])],
  ['registry plan and ledger stay open',registryItems.every((item)=>item&&item.status!=='COMPLETE'&&item.chain?.evidence===false)&&plan.currentStep==='33-P'&&ledger.activeMicroStep==='33-P'],
  ['domain covers four areas fourteen kinds and truth',has(domain,['PLACES_TRAVEL_AREAS','PLACES_TRAVEL_KINDS','PlacesTravelCenterView','PlacesTravelTruthView'])],
  ['application exposes exact four governed use cases',has(application,['GetPlacesTravelCenterUseCase','CreatePlacesTravelItemUseCase','UpdatePlacesTravelItemUseCase','DeletePlacesTravelItemUseCase'])],
  ['application enforces owner participants current-target visibility and workflow shapes',has(application,["visibility==='private'","participants.includes(ownerPersonId)",'currentAllowed','targetAllowed','Seyahat bütçesi tarih aralığı','Ortak gider ve kapatma kaydı'])],
  ['repository uses exact owner-bound PEP receipt and bounded results',has(repository,["authorization.purpose!=='general'",'receiptRecord.request.resource.ownerPersonId!==key.ownerPersonId','writeBinding(context,row)','LIMIT 1001','findItemForPolicyResolution'])],
  ['DataStore composes four safe methods',has(dataStore,['GetPlacesTravelCenterUseCase','CreatePlacesTravelItemUseCase','UpdatePlacesTravelItemUseCase','DeletePlacesTravelItemUseCase','getPlacesTravelCenter('])],
  ['IPC exposes four bounded channels with the canonical field matrix',has(ipc,["'placesTravel:getCenter'","'placesTravel:createItem'","'placesTravel:updateItem'","'placesTravel:deleteItem'",'placesTravelSpecificShape','placesTravelReceiptResult'])],
  ['renderer reuses Life route and presents meaningful local summaries',has(panel,['Yer ve seyahat merkezi','Harita, rezervasyon, ödeme','OCR kimliği sadece öneri referansıdır','Evcil hayvan kaydı sağlık tavsiyesi değildir','itemSummary(item)','Opak seyahat / gider referansı'])],
  ['external booking tracking payment verification AI and sharing claims stay false',scope.truth?.externalBookingPerformed===false&&scope.truth?.liveTransportTrackingPerformed===false&&scope.truth?.paymentExecutionPerformed===false&&scope.truth?.documentVerificationPerformed===false&&scope.truth?.aiProcessingAllowed===false&&scope.truth?.externalSharingAllowed===false],
  ['local implementation is not requirement acceptance',scope.truth?.requirementsClosed===false&&scope.truth?.countsAsRequirementPass===false&&inventory.countsAsRequirementPass===false],
  ['manual evidence and persistent receipt remain closed',manual&&scope.manualEvidence?.certificationClaimed===false&&scope.persistentReceiptStatus==='NOT_RUN']
];
const checks=definitions.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));const failures=checks.filter((item)=>item.status==='FAIL');
const report={schemaVersion:1,step:'33-V',decision:'DEC-233',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',countsAsRequirementPass:false,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,checks,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,'artifacts/validation/33-V-places-travel-asset-pet-boundary.json'),`${JSON.stringify(report,null,2)}\n`);}
if(failures.length){console.error(`33-V boundary: FAIL (${failures.length}/${checks.length}).`);for(const item of failures)console.error(item.name);process.exit(1);}console.log(`33-V boundary: PASS (${checks.length}/${checks.length}).`);
