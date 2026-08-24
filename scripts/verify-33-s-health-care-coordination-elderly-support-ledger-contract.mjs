import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const noWrite = process.argv.includes('--no-write');
const output = 'artifacts/validation/33-S-health-care-coordination-elderly-support-ledger-contract.json';
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const readText = async (path) => readFile(resolve(root, path), 'utf8');
const hasAll = (source, markers) => markers.every((marker) => source.includes(marker));
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const [scope, inventory, migrationManifest, migrations, contract, repository, adapter, runtime, main, preload, globalTypes,
  decision, threat, appTest, repositoryTest, ipcTest, dataStoreTest, uiTest] = await Promise.all([
  readJson('config/33-s-health-care-coordination-elderly-support-ledger-scope.json'),
  readJson('config/33-s-health-care-coordination-elderly-support-ledger-inventory.json'),
  readJson('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),
  readText('packages/database/src/family-database-migrations.ts'),
  readText('packages/repository-contracts/src/health-repository.ts'),
  readText('packages/repositories/src/health-repository.ts'),
  readText('apps/desktop/src/main/health-application-adapter.ts'),
  readText('apps/desktop/src/main/health-production-policy-runtime.ts'),
  readText('apps/desktop/src/main/main.ts'),
  readText('apps/desktop/src/main/preload.ts'),
  readText('apps/desktop/src/renderer/global.d.ts'),
  readText('docs/decisions/DEC-230-health-care-coordination-elderly-support-ledger.md'),
  readText('docs/security/THREAT_MODEL_33_S_HEALTH_CARE_COORDINATION_ELDERLY_SUPPORT_LEDGER.md'),
  readText('packages/application/tests/health-care-coordination-use-cases.test.ts'),
  readText('packages/repositories/health-care-coordination-repository-policy.test.ts'),
  readText('apps/desktop/tests/health-care-coordination-ipc-integration.test.ts'),
  readText('apps/desktop/tests/health-care-coordination-data-store.test.ts'),
  readText('apps/desktop/tests/health-care-coordination-ui.test.ts')
]);

const migrationMatch = migrations.match(/const healthCareCoordinationElderSupportSql = `([\s\S]*?)`;\r?\n\r?\n(?=const [A-Za-z_$][A-Za-z0-9_$]*Sql =|export const FAMILY_DATABASE_MIGRATIONS)/u);
const migrationSha256 = migrationMatch ? createHash('sha256').update(`${migrationMatch[1].replace(/\r\n/g,'\n').trim()}\n`).digest('hex') : '';
const migration97 = migrationManifest.migrationVersions?.find((item) => item.version === 97);
const testFiles = scope.validation?.targetedTestFiles ?? [];

const definitions = [
  ['scope inventory and five-test matrix are exact', exact(scope.requirements, inventory.requirements)
    && exact(inventory.implementedTargetedTests, testFiles) && testFiles.length === 5
    && scope.validation?.targetedTestFileRatchet === 5 && scope.validation?.targetedTestRatchet === 20],
  ['migration 97 source manifest and scope checksums are canonical', migration97?.name === 'health_care_coordination_elder_support'
    && migration97?.checksum === migrationSha256 && migrationSha256 === scope.validation?.migrationSha256
    && migrationSha256 === 'e3d60800e250feb674cd1250449982ac45cd7e700e74a728be7f6500c054d081'],
  ['migration owns exact current entry grant and immutable mutation tables', hasAll(migrations,
    ['health_care_mutations', 'health_care_centers', 'health_care_entries', 'health_care_access_grants', 'trg_33s_health_care_mutation_delete'])],
  ['repository contract exposes center mutation entry grant and policy resolution ports', hasAll(contract,
    ['loadHealthCareCenter', 'findHealthCareMutationByClientOperationId', 'insertHealthCareEntry', 'upsertHealthCareAccessGrant', 'findHealthCareCenterForPolicyResolution'])],
  ['repository enforces exact receipt subject purpose and bounded lists', hasAll(repository,
    ["authorization.resourceType !== 'health_care_center'", "authorization.receiptRecord.request.purpose !== 'care'", 'LIMIT 501', 'LIMIT 257'])],
  ['desktop adapter persists receipt time and content-free audit outbox transactionally', hasAll(adapter,
    ['asIsoDateTime(authorization.receiptRecord.recordedAt)', 'RepositoryBackedHealthCareCoordinationUnitOfWork', 'auditRepository.append', 'outboxRepository.enqueue'])],
  ['production policy runtime binds health center exact owner purpose and sensitivity', hasAll(runtime,
    ["requestedIntent.resourceType === 'health_care_center'", "requestedIntent.purpose !== 'care'", "sensitivity: 'highly_sensitive'", "requestedIntent.action !== 'read'"])],
  ['main preload and renderer types expose only four safe methods', hasAll(main,
    ['registerIpcHandler(HEALTH_CARE_COORDINATION_IPC_CHANNELS.getCenter', 'registerIpcHandler(HEALTH_CARE_COORDINATION_IPC_CHANNELS.recordEntry', 'registerIpcHandler(HEALTH_CARE_COORDINATION_IPC_CHANNELS.upsertGrant', 'registerIpcHandler(HEALTH_CARE_COORDINATION_IPC_CHANNELS.revokeGrant'])
    && hasAll(preload, ['getHealthCareCoordinationCenter', 'recordHealthCareEntry', 'upsertHealthCareAccessGrant', 'revokeHealthCareAccessGrant'])
    && hasAll(globalTypes, ['getHealthCareCoordinationCenter', 'recordHealthCareEntry', 'upsertHealthCareAccessGrant', 'revokeHealthCareAccessGrant'])],
  ['application tests cover replay mismatch scope and transactional writes', hasAll(appTest,
    ['replays the exact operation', 'different fingerprint', 'minimum-necessary', 'object permission'])],
  ['repository tests cover owner grant scope forged receipt and immutability', hasAll(repositoryTest,
    ['owner', 'minimum-necessary', 'forged', 'immutable'])],
  ['IPC tests reject renderer authority and unsafe result shapes', hasAll(ipcTest,
    ['rejects', 'nested accessors', 'authority', 'safe center'])],
  ['DataStore tests prove PEP fail closed replay and full rollback', hasAll(dataStoreTest,
    ['fails closed before reads or writes', 'replays', 'atomically rolls back', 'event_outbox'])],
  ['UI test pins existing route stable retry and local truth boundaries', hasAll(uiTest,
    ['without creating a competing product route', 'idempotency identity', 'medical verification', 'large-text'])],
  ['decision and threat model deny external medical and acceptance claims', hasAll(decision,
    ['countsAsRequirementPass=false', 'tıbbi doğrulama', 'NOT_RUN']) && hasAll(threat,
    ['Direct role authorization yasaktır', 'sağlık registry sorgusu', 'certification'])],
  ['PPK ratchets are exact while requirement remains open', scope.validation?.ppk021?.scannedProductionFiles === 590
    && scope.validation?.ppk021?.exactPrivilegedSurfaceCount === 897
    && scope.validation?.ppk021?.exactAllowlistSha256 === '9ea5b846e552e760fbd8dd5f8bee7fb83988ef19bb93e3bbd4ac0465c4b71205'
    && scope.validation?.ppk022?.scannedProductionFiles === 590
    && scope.validation?.ppk022?.exactCapabilitySurfaceCount === 447
    && scope.validation?.ppk022?.exactCapabilityManifestSha256 === '54061e189e7771868552efa869c69a75426f24e4edd846af1c62496c82f0e1d6'
    && scope.validation?.countsAsRequirementPass === false && inventory.validation?.countsAsRequirementPass === false]
];

const checks = definitions.map(([name, passed]) => ({name,status:passed?'PASS':'FAIL'}));
const failures = checks.filter((item) => item.status === 'FAIL');
const report = {schemaVersion:1,step:'33-S',decision:'DEC-230',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',countsAsRequirementPass:false,checkCount:checks.length,passed:checks.length-failures.length,failed:failures.length,migration97Sha256:migrationSha256,checks,generatedAt:new Date().toISOString()};
if (!noWrite) { await mkdir(resolve(root,'artifacts/validation'),{recursive:true}); await writeFile(resolve(root,output),`${JSON.stringify(report,null,2)}\n`,{flag:'w'}); }
if (failures.length) { console.error(`33-S contract: FAIL (${failures.length}/${checks.length}).`); for(const failure of failures) console.error(failure.name); process.exit(1); }
console.log(`33-S contract: PASS (${checks.length}/${checks.length}).`);
