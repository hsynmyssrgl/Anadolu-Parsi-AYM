import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');
const json=async(path)=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const text=async(path)=>readFile(resolve(root,path),'utf8');
const has=(source,markers)=>markers.every((marker)=>source.includes(marker));
const [scope,inventory,registry,roadmap,plan,ledger,domain,application,repository,adapter,modelAdapter,dataStore,ipc,panel]=await Promise.all([
  json('config/33-w-consent-bound-family-ai-assistant-scope.json'),
  json('config/33-w-consent-bound-family-ai-assistant-inventory.json'),
  json('config/accepted-scope-registry.json'),json('config/remaining-scope-package-roadmap.json'),
  json('config/work-segmentation-plan.json'),json('config/active-governance-ledger.json'),
  text('packages/domain/src/family-ai-assistant.ts'),text('packages/application/src/family-ai-assistant-use-cases.ts'),
  text('packages/repositories/src/family-ai-assistant-repository.ts'),
  text('apps/desktop/src/main/family-ai-assistant-application-adapter.ts'),
  text('apps/desktop/src/main/local-family-ai-model-adapter.ts'),text('apps/desktop/src/main/data-store.ts'),
  text('apps/desktop/src/main/ipc-integration-policy.ts'),text('apps/desktop/src/renderer/FamilyAiAssistantPanel.tsx')
]);
const requirements=['B6-01','EXT-043','EXT-044','EXT-045','EXT-046','EXT-047','EXT-048','EXT-049','EXT-050'];
const dependencies=['33-O','33-Q','33-R','33-S','33-T'];
const roadmapItem=roadmap.packages?.find((item)=>item.step==='33-W');
const registryItems=requirements.map((id)=>registry.requirements?.find((item)=>item.id===id));
const manual=Object.entries(scope.manualEvidence??{}).filter(([key])=>key!=='certificationClaimed').every(([,value])=>value==='NOT_RUN');
const definitions=[
  ['scope inventory roadmap and dependency identities are exact',scope.step==='33-W'&&scope.decision==='DEC-234'&&JSON.stringify(scope.requirements)===JSON.stringify(requirements)&&JSON.stringify(inventory.requirements)===JSON.stringify(requirements)&&roadmapItem?.status==='PLANNED'&&JSON.stringify(roadmapItem.dependsOn)===JSON.stringify(dependencies)],
  ['registry plan and ledger remain open behind 33-P',registryItems.every((item)=>item&&item.status!=='COMPLETE'&&item.chain?.evidence===false)&&plan.currentStep==='33-P'&&ledger.activeMicroStep==='33-P'],
  ['domain fixes fifteen kinds canonical modules and fail-honest truth',has(domain,['FAMILY_AI_ASSISTANT_KINDS','FAMILY_AI_ASSISTANT_MODULES_BY_KIND','FAMILY_AI_ASSISTANT_RESOURCE_TYPE_BY_MODULE','FamilyAiAssistantTruthView',"durableActionPerformed: 'not_performed'",'confirmationExecutesDownstreamAction: false'])],
  ['application exposes governed suggestion and transient local-model use cases',has(application,['GetFamilyAiAssistantCenterUseCase','GetFamilyAiLocalModelStatusUseCase','RunFamilyAiLocalModelUseCase','GenerateFamilyAiSuggestionUseCase','ReviewFamilyAiSuggestionUseCase'])],
  ['application revalidates source consent and never records downstream action',has(application,['revalidateSourceConsent','durableActionPerformed:\'not_performed\'',"decision==='confirm'"])],
  ['repository uses receipt fence and bounded owner reads and writes',has(repository,['writeBinding(context,row)','findSuggestionForPolicyResolution','FAMILY_AI_ASSISTANT_MAX_SUGGESTIONS','suggestion capacity is exhausted'])],
  ['desktop adapter applies deny-precedence standard and bounded sensitive consent',has(adapter,['matching.some((consent)=>consent.status===\'revoked\')','sensitiveConsentActive','RepositoryBackedFamilyAiAssistantUnitOfWork','inactiveConsentSuggestions'])],
  ['local model transport is exact loopback opt-in bounded and non-persistent',has(modelAdapter,["ENDPOINT='http://127.0.0.1:11434'","hostname:'127.0.0.1'",'port:11434',"path:'/api/chat'",'maximumResponseBytes:131_072','stream:false'])],
  ['DataStore composes five safe methods',has(dataStore,['GetFamilyAiAssistantCenterUseCase','GetFamilyAiLocalModelStatusUseCase','RunFamilyAiLocalModelUseCase','GenerateFamilyAiSuggestionUseCase','ReviewFamilyAiSuggestionUseCase','getFamilyAiAssistantCenter('])],
  ['IPC exposes exact five bounded channels',has(ipc,["getCenter:'familyAiAssistant:getCenter'","getLocalModelStatus:'familyAiAssistant:getLocalModelStatus'","runLocalModel:'familyAiAssistant:runLocalModel'","generate:'familyAiAssistant:generate'","review:'familyAiAssistant:review'",'familyAiResult'])],
  ['renderer states consent local no-action transient model and source-coverage truth',has(panel,['Yerel ve onaylı çalışma sınırı','Buluta veya dış ağa veri gönderilmez','Model yanıtı kaydedilmez','Kaynak izni model çalışırken değişirse','kaynak kapsam göstergesi','inactiveConsentSuggestions'])],
  ['default runtime truth stays closed while local model adapter is recorded',scope.truth?.providerConfigured===false&&scope.truth?.networkUsed===false&&scope.truth?.cloudUsed===false&&scope.truth?.modelInferencePerformed===false&&scope.truth?.localModelAdapterImplemented===true&&scope.truth?.localLoopbackOnly===true&&scope.truth?.networkEgressUsed===false&&scope.truth?.modelResponsePersisted===false&&scope.truth?.speechSynthesisPerformed===false&&scope.truth?.translationPerformed===false&&scope.truth?.ocrSuggestionAutomaticallyAccepted===false&&scope.truth?.durableActionPerformed==='not_performed'],
  ['manual evidence persistent receipt and requirement acceptance remain closed',manual&&scope.manualEvidence?.certificationClaimed===false&&scope.persistentReceiptStatus==='NOT_RUN'&&scope.truth?.requirementsClosed===false&&scope.truth?.countsAsRequirementPass===false&&inventory.countsAsRequirementPass===false]
];
const checks=definitions.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));
const failures=checks.filter((item)=>item.status==='FAIL');
const report={schemaVersion:1,step:'33-W',decision:'DEC-234',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',countsAsRequirementPass:false,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,checks,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,'artifacts/validation/33-W-consent-bound-family-ai-assistant-boundary.json'),`${JSON.stringify(report,null,2)}\n`);}
if(failures.length){console.error(`33-W boundary: FAIL (${failures.length}/${checks.length}).`);for(const item of failures)console.error(item.name);process.exit(1);}
console.log(`33-W boundary: PASS (${checks.length}/${checks.length}).`);
