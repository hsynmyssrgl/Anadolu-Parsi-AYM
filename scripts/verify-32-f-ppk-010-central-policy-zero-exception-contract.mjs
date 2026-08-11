import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const checks = [];
const failures = [];
const check = (name, condition) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status });
  if (!condition) failures.push(name);
};
const paths = {
  authorization: 'packages/security/src/authorization.ts',
  targetedTest: 'packages/security/central-policy-zero-exception.test.ts',
  dataRepair: 'apps/desktop/src/main/data-repair-application-adapter.ts',
  lifecycle: 'apps/desktop/src/main/person-lifecycle-application-adapter.ts',
  membership: 'apps/desktop/src/main/household-membership-application-adapter.ts',
  dashboard: 'apps/desktop/src/main/dashboard-application-adapter.ts',
  timeline: 'apps/desktop/src/main/timeline-application-adapter.ts',
  healthRepository: 'packages/repositories/src/health-repository.ts',
  lifeRepository: 'packages/repositories/src/life-repository.ts',
  archivePolicy: 'apps/desktop/src/main/archive-production-policy-runtime.ts',
  financePolicy: 'apps/desktop/src/main/finance-production-policy-runtime.ts',
  healthPolicy: 'apps/desktop/src/main/health-production-policy-runtime.ts',
  lifePolicy: 'apps/desktop/src/main/life-production-policy-runtime.ts',
  locationPolicy: 'apps/desktop/src/main/location-production-policy-runtime.ts',
  timelinePolicy: 'apps/desktop/src/main/timeline-production-policy-runtime.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  familyImport: 'apps/desktop/src/main/family-data-import-service.ts',
  universal: 'apps/desktop/src/main/desktop-universal-api-policy-enforcement.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  repositoryPackage: 'packages/repositories/package.json',
  decision: 'docs/decisions/DEC-191-ppk-010-central-policy-zero-exception.md',
  audit: 'docs/audit/32-F_PPK-010_MERKEZI_POLITIKA_SIFIR_ISTISNA_UST_KAPANIS.md'
};
const sources = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const requirement = registry.requirements.find((item) => item.id === 'PPK-010');
const scope = JSON.parse(await readFile('config/32-f-ppk-010-central-policy-zero-exception-scope.json', 'utf8'));
const repositoryPackage = JSON.parse(sources.repositoryPackage);

const productionFiles = [];
const visit = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await visit(path);
    else if (entry.isFile() && path.endsWith('.ts') && !path.endsWith('.test.ts')) productionFiles.push(path);
  }
};
await visit('apps');
await visit('packages');
const excluded = new Set(['packages/security/src/authorization.ts', 'apps/core-service/src/core-service-runtime.ts']);
const directRolePattern = /new Set<[^>]*Role|roles\.some\([^\n]*\.has|roles\.includes\(|(?:\.|\b)role\s*(?:===|!==)/u;
const directRoleFindings = [];
for (const path of productionFiles) {
  const normalized = relative(process.cwd(), path).replaceAll('\\', '/');
  if (!excluded.has(normalized) && directRolePattern.test(await readFile(path, 'utf8'))) directRoleFindings.push(normalized);
}

check('direct-role exception registry is exported empty and frozen', sources.authorization.includes('DIRECT_ROLE_AUTHORIZATION_EXCEPTIONS = Object.freeze([] as const)'));
check('central role vocabulary guard is exported', sources.authorization.includes('export const isAuthorizationRole'));
check('role identity consistency helper is exported', sources.authorization.includes('export const authorizationRoleMatches'));
check('administrative role resolution delegates to central policy vocabulary', sources.authorization.includes('export const isAdministrativeRole') && sources.authorization.includes("?.['*']?.includes('administer')"));
check('adult life collection read remains an explicit central policy action', sources.authorization.includes("archive_item: [], life_record: ['read']"));
check('caregiver life collection read remains an explicit central policy action', sources.authorization.includes("family_health_history: ['read'], life_record: ['read']"));
check('central authorization service remains the decision engine', sources.authorization.includes('export class CentralAuthorizationService'));
check('data repair administration uses the central service', sources.dataRepair.includes('new CentralAuthorizationService()') && sources.dataRepair.includes('#authorization.authorize'));
check('person lifecycle administration uses the central service', sources.lifecycle.includes('new CentralAuthorizationService()') && sources.lifecycle.includes('#authorization.authorize'));
check('household membership administration uses the central service', sources.membership.includes('new CentralAuthorizationService()') && sources.membership.includes('#authorization.authorize'));
check('dashboard derives the role through the central vocabulary', sources.dashboard.includes('roles.find(isAuthorizationRole)'));
check('timeline derives the role through the central vocabulary', sources.timeline.includes('roles.find(isAuthorizationRole)'));
check('health collection visibility calls central authorization', sources.healthRepository.includes('centralHealthAuthorization.authorize'));
check('life collection visibility calls central authorization', sources.lifeRepository.includes('centralLifeAuthorization.authorize'));
check('production direct-role authorization scan has zero findings', directRoleFindings.length === 0);
check('archive identity role comparison uses the non-granting helper', sources.archivePolicy.includes('authorizationRoleMatches'));
check('finance identity role comparison uses the non-granting helper', sources.financePolicy.includes('authorizationRoleMatches'));
check('health identity role comparison uses the non-granting helper', sources.healthPolicy.includes('authorizationRoleMatches'));
check('life identity role comparison uses the non-granting helper', sources.lifePolicy.includes('authorizationRoleMatches'));
check('location identity role comparison uses the non-granting helper', sources.locationPolicy.includes('authorizationRoleMatches'));
check('timeline identity role comparison uses the non-granting helper', sources.timelinePolicy.includes('authorizationRoleMatches'));
check('data store identity role comparison uses the non-granting helper', sources.dataStore.includes('authorizationRoleMatches'));
check('family import identity role comparison uses the non-granting helper', sources.familyImport.includes('authorizationRoleMatches'));
check('repository package declares its central security dependency', repositoryPackage.dependencies?.['@ppt/security'] === '4.8.2026-29');
check('universal Desktop PEP still requires the Core decision provider', sources.universal.includes("dependencies.authorizationProvider?.decisionAuthority !== 'windows-core-service'"));
check('migration 74 retains durable Core decision-authority binding', sources.migration.includes("createMigrationDefinition(74, 'ppk009_core_service_decision_reevaluation'"));
check('targeted test enforces an empty exception registry', sources.targetedTest.includes('keeps the direct-role authorization exception registry empty'));
check('targeted test recursively scans production TypeScript', sources.targetedTest.includes('finds zero direct role allow or deny comparisons in production code'));
check('accepted registry closes the complete PPK-010 evidence chain', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true));
check('scope record claims only the completed PPK-010 boundary', scope.status === 'COMPLETED' && scope.requirementCompletionClaimed === true && scope.realDataTransferPerformed === false);
check('decision records migration reuse and no cutover authority', sources.decision.includes('göç 74 yeniden kullanılır') && sources.decision.includes('DEC-171'));
check('audit records zero exceptions and truthful no-transfer boundary', sources.audit.includes('sıfır bulgu') && sources.audit.includes('Gerçek veri taşınmamıştır'));

const report = {
  schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '32-F', requirement: 'PPK-010',
  phase: 'CENTRAL_POLICY_ZERO_EXCEPTION_CONTRACT', status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length, passed: checks.filter((item) => item.status === 'PASS').length, failed: failures.length,
  checks, failures, directRoleFindings, cutoverAuthorityAttached: false, realDataTransferPerformed: false,
  requirementCompletionClaimed: failures.length === 0, generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-F-ppk-010-central-policy-zero-exception-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`32-F PPK-010 contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`32-F PPK-010 contract: PASS (${checks.length}/${checks.length}).`);
