import { createHash } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');
const json=async(path)=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const text=async(path)=>readFile(resolve(root,path),'utf8');
const has=(source,markers)=>markers.every((marker)=>source.includes(marker));
const targetedTestFiles=Object.freeze([
  'packages/application/tests/family-ai-assistant-use-cases.test.ts',
  'packages/repositories/family-ai-assistant-repository-policy.test.ts',
  'apps/desktop/tests/family-ai-assistant-data-store.test.ts',
  'apps/desktop/tests/family-ai-assistant-ipc-integration.test.ts',
  'apps/desktop/tests/family-ai-assistant-ui.test.ts'
]);
const [scope,inventory,manifest,migrations,contract,repository,adapter,runtime,main,preload,globalTypes,decision,threat,...tests]=await Promise.all([
  json('config/33-w-consent-bound-family-ai-assistant-scope.json'),json('config/33-w-consent-bound-family-ai-assistant-inventory.json'),
  json('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),text('packages/database/src/family-database-migrations.ts'),
  text('packages/repository-contracts/src/family-ai-assistant-repository.ts'),text('packages/repositories/src/family-ai-assistant-repository.ts'),
  text('apps/desktop/src/main/family-ai-assistant-application-adapter.ts'),text('apps/desktop/src/main/life-production-policy-runtime.ts'),
  text('apps/desktop/src/main/main.ts'),text('apps/desktop/src/main/preload.ts'),text('apps/desktop/src/renderer/global.d.ts'),
  text('docs/decisions/DEC-234-consent-bound-family-ai-assistant.md'),text('docs/security/THREAT_MODEL_33_W_CONSENT_BOUND_FAMILY_AI_ASSISTANT.md'),
  ...targetedTestFiles.map(text)
]);
const match=migrations.match(/const familyAiAssistantSql = `([\s\S]*?)`;\r?\n/u);
const sha=match?createHash('sha256').update(`${match[1].replace(/\r\n/g,'\n').trim()}\n`).digest('hex'):'';
const migration=manifest.migrationVersions?.find((item)=>item.version===101);
const p21=scope.validation.ppk021;const p22=scope.validation.ppk022;
const definitions=[
  ['scope inventory and five-test matrix are exact',JSON.stringify(scope.requirements)===JSON.stringify(inventory.requirements)&&JSON.stringify(scope.validation.targetedTestFiles)===JSON.stringify(inventory.implementedTargetedTests)&&tests.length===5&&scope.validation.targetedTestRatchet===26],
  ['migration 101 source manifest and scope checksums are canonical',migration?.name==='consent_bound_family_ai_assistant'&&migration?.checksum===sha&&sha===scope.validation.migrationSha256&&sha==='ef3790fad5f64de7bbd089d09a835dcb302092d64ccef6abb85e2105fbab2b5b'],
  ['migration owns immutable current and mutation ledgers',has(migrations,['family_ai_suggestion_mutations','family_ai_suggestions','trg_33w_family_ai_suggestion_delete','trg_33w_family_ai_mutation_delete'])],
  ['repository contract exposes center suggestion mutation and policy ports',has(contract,['loadCenter','findSuggestion','findMutationByClientOperationId','insertMutation','insertSuggestion','saveSuggestion','findSuggestionForPolicyResolution'])],
  ['repository enforces exact receipt payload-free resolution and bounded capacity',has(repository,['writeBinding(context,row)','findSuggestionForPolicyResolution','FAMILY_AI_ASSISTANT_MAX_SUGGESTIONS','suggestion capacity is exhausted'])],
  ['desktop adapter composes central policy consent and transactional audit outbox',has(adapter,['RepositoryBackedLifePolicyTransactionRunner','RepositoryBackedFamilyAiAssistantUnitOfWork','aiConsentRepository','auditRepository.append','outboxRepository.enqueue'])],
  ['production runtime resolves exact private suggestion owner',has(runtime,["resourceType === 'family_ai_suggestion'",'ownerPersonId: found.value.ownerPersonId'])],
  ['main preload and renderer expose exact three safe methods',has(main,['FAMILY_AI_ASSISTANT_IPC_CHANNELS.getCenter','FAMILY_AI_ASSISTANT_IPC_CHANNELS.generate','FAMILY_AI_ASSISTANT_IPC_CHANNELS.review'])&&has(preload,['getFamilyAiAssistantCenter','generateFamilyAiSuggestion','reviewFamilyAiSuggestion'])&&has(globalTypes,['getFamilyAiAssistantCenter','generateFamilyAiSuggestion','reviewFamilyAiSuggestion'])],
  ['tests cover canonical replay module pairing deny precedence capacity rollback IPC and route',has(tests.join('\n'),['replayed:true','source.calls','operation-cross-module',"status:'revoked'",'capacity-overflow','controlled 33-W outbox failure','durableActionPerformed','familyAiAssistant:future','family-ai-assistant-title'])],
  ['decision and threat model deny provider inference downstream action and acceptance claims',has(decision,['countsAsRequirementPass=false','model çıkarımı','durableActionPerformed=not_performed','NOT_RUN'])&&has(threat,['Otonom eylem yanılsaması','Ham içerik sızıntısı','NOT_RUN'])],
  ['PPK ratchets are exact PASS while requirement remains open',p21.status==='PASS'&&p21.scannedProductionFiles===556&&p21.exactPrivilegedSurfaceCount===876&&p21.exactAllowlistSha256==='709379784b8e59727f58d54c6187a4f2924d19c0bcefbe6efb976ed64f825dd0'&&p22.status==='PASS'&&p22.scannedProductionFiles===556&&p22.exactCapabilitySurfaceCount===395&&p22.exactCapabilityManifestSha256==='a3b3f91af4a08d2b4fcb58d71b67a9e40283e6b94364a64519409c4d44a21d0e'&&scope.validation.countsAsRequirementPass===false]
];
const checks=definitions.map(([name,passed])=>({name,status:passed?'PASS':'FAIL'}));
const failures=checks.filter((item)=>item.status==='FAIL');
const report={schemaVersion:1,step:'33-W',decision:'DEC-234',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',countsAsRequirementPass:false,migration101Sha256:sha,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,checks,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,'artifacts/validation/33-W-consent-bound-family-ai-assistant-contract.json'),`${JSON.stringify(report,null,2)}\n`);}
if(failures.length){console.error(`33-W contract: FAIL (${failures.length}/${checks.length}).`);for(const item of failures)console.error(item.name);process.exit(1);}
console.log(`33-W contract: PASS (${checks.length}/${checks.length}).`);
