import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');
const json=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const source=async path=>readFile(resolve(root,path),'utf8');
const has=(text,markers)=>markers.every(marker=>text.includes(marker));
const exact=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const [scope,inventory,registry,roadmap,plan,ledger,domain,application,repository,adapter,dataStore,ipc,panel]=await Promise.all([
  json('config/34-e-local-first-translation-caption-language-provider-scope.json'),
  json('config/34-e-local-first-translation-caption-language-provider-inventory.json'),
  json('config/accepted-scope-registry.json'),json('config/remaining-scope-package-roadmap.json'),
  json('config/work-segmentation-plan.json'),json('config/active-governance-ledger.json'),
  source('packages/domain/src/local-translation-language.ts'),source('packages/application/src/local-translation-language-use-cases.ts'),
  source('packages/repositories/src/local-translation-language-repository.ts'),
  source('apps/desktop/src/main/local-translation-language-application-adapter.ts'),source('apps/desktop/src/main/data-store.ts'),
  source('apps/desktop/src/main/ipc-integration-policy.ts'),source('apps/desktop/src/renderer/LocalTranslationLanguagePanel.tsx')
]);
const requirements=['AI-LNG-001','AI-LNG-002','AI-LNG-003','AI-LNG-004','AI-LNG-005','AI-LNG-006','AI-LNG-007','AI-LNG-008','AI-LNG-009','AI-LNG-010','AI-LNG-011'];
const roadmapItem=roadmap.packages?.find(item=>item.step==='34-E');
const registryItems=requirements.map(id=>registry.requirements?.find(item=>item.id===id));
const manualNotRun=Object.entries(scope.manualEvidence??{}).filter(([key])=>key!=='certificationClaimed').every(([,value])=>value==='NOT_RUN');
const checks=[
  ['scope inventory roadmap and dependencies are exact',scope.step==='34-E'&&scope.decision==='DEC-242'
    &&exact(scope.requirements,requirements)&&exact(inventory.requirements,requirements)&&roadmapItem?.status==='PLANNED'
    &&exact(roadmapItem.dependsOn,['33-Q','33-W','34-C','34-D'])],
  ['registry plan and ledger remain open behind predecessor',registryItems.every(item=>item&&item.status!=='COMPLETE'
    &&item.chain?.evidence===false)&&plan.currentStep==='33-P'&&ledger.activeMicroStep==='33-P'],
  ['domain distinguishes modeled provider policy from execution',has(domain,['LocalTranslationTruthView',
    'productionTranslationProviderConfigured: false','languageDetectionExecuted: false','translationExecuted: false',
    'speechToTextExecuted: false','networkUsedByCurrentImplementation: false'])],
  ['application exposes governed metadata lifecycle and future provider seam',has(application,['TranslationProviderPort',
    'GetLocalTranslationCenterUseCase','UpdateLocalTranslationProfileUseCase','AddLocalTranslationDictionaryEntryUseCase',
    'PrepareLocalTranslationRequestUseCase','RecordLocalTranslationCorrectionUseCase','CancelLocalTranslationRequestUseCase'])],
  ['repository remains owner scoped and resolver payload free',has(repository,['SqliteLocalTranslationLanguageRepository',
    'family_id=? AND owner_person_id=?','platformPolicyPersistenceBinding','resolvePolicyResource'])
    &&!repository.includes('translated_text')&&!repository.includes('audio_bytes')&&!repository.includes('provider_token')],
  ['desktop composes central Life PEP and content free audit',has(adapter,['RepositoryBackedLocalTranslationUnitOfWork',
    'RepositoryBackedLifePolicyTransactionRunner','auditRepository.append','outboxRepository.enqueue'])
    &&has(dataStore,['getLocalTranslationCenter','updateLocalTranslationProfile','prepareLocalTranslationRequest','cancelLocalTranslationRequest'])],
  ['IPC exposes eight safe channels',has(ipc,["getCenter:'localTranslation:getCenter'","updateProfile:'localTranslation:updateProfile'",
    "addDictionary:'localTranslation:addDictionary'","updateDictionary:'localTranslation:updateDictionary'",
    "deleteDictionary:'localTranslation:deleteDictionary'","prepareRequest:'localTranslation:prepareRequest'",
    "recordCorrection:'localTranslation:recordCorrection'","cancelRequest:'localTranslation:cancelRequest'"])],
  ['renderer preserves retry identity and no provider authority',has(panel,['LocalTranslationLanguagePanel','operations.current.get(key)',
    'operations.current.delete(key)','updateLocalTranslationDictionaryEntry','explicitExternalConsent'])
    &&!panel.includes('fetch(')&&!panel.includes('TranslationProviderPort')],
  ['production execution claims remain false',scope.truth?.productionTranslationProviderConfigured===false
    &&scope.truth?.localLanguagePackInstalled===false&&scope.truth?.languageDetectionExecuted===false
    &&scope.truth?.translationExecuted===false&&scope.truth?.speechToTextExecuted===false
    &&scope.truth?.speakerSeparationExecuted===false&&scope.truth?.textToSpeechExecuted===false
    &&scope.truth?.externalContentTransferred===false&&scope.truth?.networkUsedByCurrentImplementation===false],
  ['manual evidence receipt and requirement acceptance remain closed',manualNotRun
    &&scope.manualEvidence?.certificationClaimed===false&&scope.persistentReceiptStatus==='NOT_RUN'
    &&scope.truth?.requirementsClosed===false&&scope.truth?.countsAsRequirementPass===false&&inventory.countsAsRequirementPass===false],
  ['local test and migration ratchets are exact',scope.validation?.targetedTestFileRatchet===5
    &&scope.validation?.targetedTestRatchet===23&&scope.validation?.migrationVersion===109
    &&scope.validation?.migrationSha256==='619461d7ce65e87d9095fc2ea88cf9f801261b9309da67c0b67183c46094e71b'],
  ['PPK ratchets are closed without requirement pass',scope.validation?.ppk015?.status==='PASS'
    &&scope.validation?.ppk019?.status==='PASS'&&scope.validation?.ppk021?.status==='PASS'
    &&scope.validation?.ppk022?.status==='PASS'&&scope.validation?.countsAsRequirementPass===false]
];
const results=checks.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));const failures=results.filter(item=>item.status==='FAIL');
const report={schemaVersion:1,step:'34-E',decision:'DEC-242',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',
  implementationStatus:scope.localImplementationStatus,countsAsRequirementPass:false,checkCount:results.length,
  passed:results.length-failures.length,failed:failures.length,checks:results,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,
  'artifacts/validation/34-E-local-first-translation-caption-language-provider-boundary.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');}
if(failures.length){console.error(`34-E boundary: FAIL (${failures.length}/${results.length}).`);
  for(const item of failures)console.error(item.name);process.exit(1);}
console.log(`34-E boundary: PASS (${results.length}/${results.length}; requirement PASS=false; write=${!noWrite}).`);
