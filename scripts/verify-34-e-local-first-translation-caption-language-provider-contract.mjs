import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');const text=async path=>readFile(resolve(root,path),'utf8');
const has=(value,markers)=>markers.every(marker=>value.includes(marker));const sha=value=>createHash('sha256').update(value,'utf8').digest('hex');
const paths={scope:'config/34-e-local-first-translation-caption-language-provider-scope.json',
  inventory:'config/34-e-local-first-translation-caption-language-provider-inventory.json',
  decision:'docs/decisions/DEC-242-local-first-translation-caption-language-provider.md',
  threat:'docs/security/THREAT_MODEL_34_E_LOCAL_FIRST_TRANSLATION_CAPTION_LANGUAGE_PROVIDER.md',
  domain:'packages/domain/src/local-translation-language.ts',contract:'packages/repository-contracts/src/local-translation-language-repository.ts',
  application:'packages/application/src/local-translation-language-use-cases.ts',repository:'packages/repositories/src/local-translation-language-repository.ts',
  adapter:'apps/desktop/src/main/local-translation-language-application-adapter.ts',migration:'packages/database/src/family-database-migrations.ts',
  ipc:'apps/desktop/src/main/ipc-integration-policy.ts',lifecycle:'apps/desktop/src/main/ipc-request-lifecycle.ts',
  main:'apps/desktop/src/main/main.ts',preload:'apps/desktop/src/main/preload.ts',global:'apps/desktop/src/renderer/global.d.ts',
  panel:'apps/desktop/src/renderer/LocalTranslationLanguagePanel.tsx',app:'apps/desktop/src/renderer/App.tsx',package:'package.json'};
const entries=await Promise.all(Object.entries(paths).map(async([key,path])=>[key,await text(path)]));const content=Object.fromEntries(entries);
const scope=JSON.parse(content.scope);const inventory=JSON.parse(content.inventory);const pkg=JSON.parse(content.package);
const checks=[
  ['governance identities and no pass truth are exact',scope.step==='34-E'&&scope.decision==='DEC-242'&&inventory.step==='34-E'
    &&scope.status==='PLANNED'&&scope.truth?.countsAsRequirementPass===false&&inventory.countsAsRequirementPass===false],
  ['domain publishes safe views and false execution truth',has(content.domain,['LocalTranslationCenterView',
    'LocalTranslationMutationReceiptView','productionTranslationProviderConfigured: false','translationExecuted: false','networkUsed: false'])],
  ['repository contract exposes exact governed persistence and payload free resolution',has(content.contract,[
    'LocalTranslationLanguageRepositoryPort','LocalTranslationPolicyResourceRepositoryPort','resolvePolicyResource',
    'insertMutation','saveProfile','saveDictionaryEntry','saveRequest','appendEvent'])],
  ['application keeps provider and execution truth false',has(content.application,['TranslationProviderPort',
    'providerConfigured: false','translationExecuted: false','networkUsed: false','cloudUsed: false'])],
  ['migration 109 owns five tables and immutable ledgers',has(content.migration,["createMigrationDefinition(109, 'local_first_translation_language'",
    'CREATE TABLE local_translation_mutations','CREATE TABLE local_translation_profiles',
    'CREATE TABLE local_translation_dictionary_entries','CREATE TABLE local_translation_requests',
    'CREATE TABLE local_translation_events','translation mutation ledger is immutable','translation event ledger is immutable'])],
  ['migration forces no provider execution and exact consent pairing',has(content.migration,[
    'translation_executed INTEGER NOT NULL CHECK(translation_executed=0)',
    "provider_mode='external_preview' AND external_preview_acknowledged=1 AND explicit_external_consent=1",
    'dictionary uses content-free logical deletion'])],
  ['repository and adapter require central policy context',has(content.repository,['assertPolicyAuthorizedRepositoryContext',
    'platformPolicyPersistenceBinding','family_id=? AND owner_person_id=?'])&&has(content.adapter,[
    'RepositoryBackedLifePolicyTransactionRunner','RepositoryBackedLocalTranslationUnitOfWork','auditRepository.append','outboxRepository.enqueue'])],
  ['IPC lifecycle bridge and preload expose eight bounded channels',has(content.ipc,['localTranslation:getCenter',
    'localTranslation:updateProfile','localTranslation:addDictionary','localTranslation:updateDictionary',
    'localTranslation:deleteDictionary','localTranslation:prepareRequest','localTranslation:recordCorrection','localTranslation:cancelRequest'])
    &&has(content.lifecycle,['localTranslationReadChannels','localTranslationWriteChannels'])
    &&has(content.main,['getLocalTranslationCenter','cancelLocalTranslationRequest'])
    &&has(content.preload,['getLocalTranslationCenter','cancelLocalTranslationRequest'])
    &&has(content.global,['LocalTranslationCenterView','cancelLocalTranslationRequest'])],
  ['renderer reuses App surface and every safe bridge',has(content.panel,['LocalTranslationLanguagePanel',
    'updateLocalTranslationDictionaryEntry','recordLocalTranslationCorrection','cancelLocalTranslationRequest'])
    &&has(content.app,['<LocalTranslationLanguagePanel/>'])],
  ['documents preserve fail honest residuals',has(content.decision,['countsAsRequirementPass=false','production adapter yoktur','NOT_RUN'])
    &&has(content.threat,['Düzeltme plaintext sızıntısı','Sahte provider başarısı','Şifreli cihazlar arası'])],
  ['targeted package command is exact',pkg.scripts?.['verify:34-e:targeted']===
    'vitest run packages/application/tests/local-translation-language-use-cases.test.ts packages/repositories/local-translation-language-repository-policy.test.ts apps/desktop/tests/local-translation-language-data-store.test.ts apps/desktop/tests/local-translation-language-ipc-integration.test.ts apps/desktop/tests/local-translation-language-ui.test.ts --maxWorkers=1'],
  ['governance verifier commands are wired',pkg.scripts?.['verify:34-e:local-first-translation-caption-language-provider:boundary']
    &&pkg.scripts?.['verify:34-e:local-first-translation-caption-language-provider:contract']
    &&pkg.scripts?.['verify:34-e:local-first-translation-caption-language-provider:runtime']],
  ['migration and PPK ratchets are exact',scope.validation?.migrationSha256==='619461d7ce65e87d9095fc2ea88cf9f801261b9309da67c0b67183c46094e71b'
    &&scope.validation?.ppk015?.status==='PASS'&&scope.validation?.ppk019?.status==='PASS'
    &&scope.validation?.ppk021?.status==='PASS'&&scope.validation?.ppk022?.status==='PASS'],
  ['governance sources are nonempty and uniquely bound',new Set(Object.values(paths)).size===Object.keys(paths).length
    &&Object.values(content).every(value=>value.length>20)&&sha(content.scope)!==sha(content.inventory)]
];
const results=checks.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));const failures=results.filter(item=>item.status==='FAIL');
const report={schemaVersion:1,step:'34-E',decision:'DEC-242',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',
  countsAsRequirementPass:false,checkCount:results.length,passed:results.length-failures.length,failed:failures.length,
  checks:results,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,
  'artifacts/validation/34-E-local-first-translation-caption-language-provider-contract.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');}
if(failures.length){console.error(`34-E contract: FAIL (${failures.length}/${results.length}).`);
  for(const item of failures)console.error(item.name);process.exit(1);}
console.log(`34-E contract: PASS (${results.length}/${results.length}; requirement PASS=false; write=${!noWrite}).`);
