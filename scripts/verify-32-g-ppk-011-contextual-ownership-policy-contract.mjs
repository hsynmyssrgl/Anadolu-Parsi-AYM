import { mkdir, readFile, writeFile } from 'node:fs/promises';

const checks = [];
const failures = [];
const check = (name, condition) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status });
  if (!condition) failures.push(name);
};
const sources = Object.fromEntries(await Promise.all(Object.entries({
  security: 'packages/security/src/authorization.ts',
  kernel: 'packages/platform-policy/src/policy-kernel.ts',
  pep: 'packages/platform-policy/src/policy-enforcement-point.ts',
  domain: 'packages/domain/src/app-data.ts',
  useCase: 'packages/application/src/authorization-use-cases.ts',
  repositoryContract: 'packages/repository-contracts/src/object-permission-repository.ts',
  repository: 'packages/repositories/src/object-permission-repository.ts',
  adapter: 'apps/desktop/src/main/authorization-application-adapter.ts',
  financeRuntime: 'apps/desktop/src/main/finance-production-policy-runtime.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  main: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  renderer: 'apps/desktop/src/renderer/App.tsx',
  targetedTest: 'apps/desktop/tests/ppk011-contextual-ownership-policy.test.ts',
  authorizationRuntime: 'scripts/verify-authorization-audit.mjs',
  packageJson: 'package.json',
  decision: 'docs/decisions/DEC-192-ppk-011-contextual-ownership-policy.md',
  audit: 'docs/audit/32-G_PPK-011_BAGLAMSAL_SAHIPLIK_ORANI_UST_KAPANIS.md'
}).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const requirement = registry.requirements.find((item) => item.id === 'PPK-011');
const scope = JSON.parse(await readFile('config/32-g-ppk-011-contextual-ownership-policy-scope.json', 'utf8'));
const packageJson = JSON.parse(sources.packageJson);

check('central grant carries ownership basis points', sources.security.includes('readonly ownershipBasisPoints?: number'));
check('central request carries a minimum ownership threshold', sources.security.includes('readonly minimumOwnershipBasisPoints?: number'));
check('central policy validates the 1..10000 basis-point vocabulary', sources.security.includes('value >= 1 && value <= 10_000'));
check('central explicit denial is selected before ownership-qualified allow', sources.security.indexOf("grant.effect === 'deny'") < sources.security.indexOf("grant.effect === 'allow' && ownershipQualified"));
check('central policy returns a dedicated ownership-threshold denial', sources.security.includes("reason: 'ownership_threshold'"));
check('platform grants carry ownership basis points', sources.kernel.includes('export interface PolicyGrant') && sources.kernel.includes('readonly ownershipBasisPoints?: number'));
check('platform requests carry the minimum ownership threshold', sources.kernel.includes('readonly minimumOwnershipBasisPoints?: number'));
check('platform policy exposes a dedicated ownership denial reason', sources.kernel.includes("| 'OWNERSHIP_SHARE_REQUIRED'"));
check('platform grant validation forbids ownership metadata on deny', sources.kernel.includes("value.effect === 'allow' && Number.isInteger(value.ownershipBasisPoints)"));
check('platform context snapshot signs the ownership threshold', sources.kernel.includes('minimumOwnershipBasisPoints: request.minimumOwnershipBasisPoints ?? 0'));
check('platform explicit denial precedes the qualifying allow lookup', sources.kernel.indexOf('const explicitDeny = activeGrants.find') < sources.kernel.indexOf('const explicitAllow = activeGrants.find'));
check('platform decision returns the matched ownership share', sources.kernel.includes('matchedOwnershipBasisPoints: explicitAllow.ownershipBasisPoints'));
check('PEP intent accepts an ownership threshold', sources.pep.includes('readonly minimumOwnershipBasisPoints?: number'));
check('PEP validates and forwards the ownership threshold', sources.pep.includes('Policy intent ownership threshold is invalid') && sources.pep.includes('{ minimumOwnershipBasisPoints: intent.minimumOwnershipBasisPoints }'));
check('domain permission view carries ownership basis points', sources.domain.includes('familyBranchId?:string; ownershipBasisPoints?:number; denialReason?:string'));
check('domain upsert input carries ownership basis points', sources.domain.includes('purpose?:AuthorizationPurpose; familyBranchId?:string; ownershipBasisPoints?:number'));
check('use-case validates exact integer basis-point range', sources.useCase.includes('ownershipBasisPoints < 1 || ownershipBasisPoints > 10_000'));
check('use-case forbids ownership metadata on explicit denial', sources.useCase.includes("input.command.effect === 'deny' && ownershipBasisPoints !== undefined"));
check('use-case maps persisted ownership into central grants', sources.useCase.includes('{ ownershipBasisPoints: permission.ownershipBasisPoints }'));
check('repository contract carries ownership basis points', sources.repositoryContract.includes('readonly ownershipBasisPoints?: number'));
check('repository maps ownership share from SQLite', sources.repository.includes('ownership_basis_points') && sources.repository.includes('ownershipBasisPoints: Number(row.ownership_basis_points)'));
check('repository selects ownership share in all reads', (sources.repository.match(/SELECT id,subject_account_id,resource_type,resource_id,actions,effect,purpose,family_branch_id,ownership_basis_points/gu) ?? []).length === 2);
check('repository upsert writes and updates ownership share', sources.repository.includes('ownership_basis_points=excluded.ownership_basis_points'));
check('migration 75 adds the ownership basis-point column', sources.migration.includes('ADD COLUMN ownership_basis_points INTEGER'));
check('migration 75 installs insert and update ownership triggers', sources.migration.includes('trg_ppk011_object_permission_ownership_insert') && sources.migration.includes('trg_ppk011_object_permission_ownership_update'));
check('migration 75 is registered append-only', sources.migration.includes("createMigrationDefinition(75, 'ppk011_contextual_ownership_share'"));
check('application adapter maps ownership in both directions', (sources.adapter.match(/ownershipBasisPoints/gu) ?? []).length >= 4);
check('typed IPC and preload keep the contextual permission route', sources.main.includes("registerIpcHandler('permissions:upsert'") && sources.preload.includes("upsertPermission:(input:UpsertObjectPermissionInput)"));
check('renderer captures and displays ownership percentages', sources.renderer.includes('ownershipPercent') && sources.renderer.includes('permission.ownershipBasisPoints') && sources.renderer.includes('Sahiplik oranı'));
check('production authority validates, grants and fingerprints ownership', sources.financeRuntime.includes('Number.isInteger(row.ownershipBasisPoints)') && sources.financeRuntime.includes('{ ownershipBasisPoints: row.ownershipBasisPoints }') && sources.financeRuntime.includes('ownershipBasisPoints: row.ownershipBasisPoints'));
check('targeted test covers central, platform, denial, threshold and hash binding', (sources.targetedTest.match(/\bit\(/gu) ?? []).length === 12 && sources.targetedTest.includes('platformPolicyContextHash'));
check('closure registry, scope and truth boundary are complete without B4-02 overclaim', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true) && scope.status === 'COMPLETED' && scope.bankAccountB402CompletionClaimed === false && sources.decision.includes('B4-02') && sources.audit.includes('B4-02') && packageJson.scripts['build:foundation'].indexOf('@ppt/security') < packageJson.scripts['build:foundation'].indexOf('@ppt/repositories') && sources.authorizationRuntime.includes('ownershipBasisPoints: true'));

const report = {
  schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '32-G', requirement: 'PPK-011',
  phase: 'CONTEXTUAL_OWNERSHIP_POLICY_CONTRACT', status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length, passed: checks.filter((item) => item.status === 'PASS').length, failed: failures.length,
  checks, failures, bankAccountB402CompletionClaimed: false, cutoverAuthorityAttached: false, realDataTransferPerformed: false,
  requirementCompletionClaimed: failures.length === 0, generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-G-ppk-011-contextual-ownership-policy-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`32-G PPK-011 contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`32-G PPK-011 contract: PASS (${checks.length}/${checks.length}).`);
