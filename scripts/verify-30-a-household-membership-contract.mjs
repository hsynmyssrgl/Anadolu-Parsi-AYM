import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { FAMILY_DATABASE_MIGRATIONS } from '../packages/database/dist/index.js';

const requiredFiles = [
  'packages/domain/src/household-membership.ts',
  'packages/repository-contracts/src/household-membership-repository.ts',
  'packages/repositories/src/household-membership-repository.ts',
  'packages/application/src/household-membership-use-cases.ts',
  'apps/desktop/src/main/household-membership-application-adapter.ts',
  'database/migrations/0050_household_family_branch_person_membership.sql'
];
const checks = [];
for (const path of requiredFiles) {
  const source = readFileSync(path, 'utf8');
  assert.equal(source.length > 100, true, `${path} is unexpectedly empty`);
  checks.push(`source:${path}`);
}
const migration = FAMILY_DATABASE_MIGRATIONS.find((item) => item.version === 50);
assert.ok(migration);
assert.equal(migration.name, 'household_family_branch_person_membership');
checks.push('migration:version-50-name');
for (const token of [
  'CREATE TABLE households',
  'CREATE TABLE family_branches',
  'CREATE TABLE person_memberships',
  'trg_person_memberships_family_scope_insert',
  'trg_person_memberships_overlap_insert',
  'trg_person_memberships_identity_immutable'
]) {
  assert.equal(migration.sql.includes(token), true, `migration token missing: ${token}`);
  checks.push(`migration:${token}`);
}
const useCases = readFileSync('packages/application/src/household-membership-use-cases.ts', 'utf8');
for (const token of [
  'CreateHouseholdUseCase',
  'CreateFamilyBranchUseCase',
  'AssignPersonMembershipUseCase',
  'EndPersonMembershipUseCase',
  'authorizeAdministration',
  'hasOverlappingMembership',
  'appendAudit',
  'enqueueEvent'
]) {
  assert.equal(useCases.includes(token), true, `application token missing: ${token}`);
  checks.push(`application:${token}`);
}
const report = {
  schemaVersion: 1,
  step: '30-A',
  requirement: 'B1-01',
  status: 'PASS',
  checkCount: checks.length,
  checks,
  migrationChecksum: migration.checksum,
  generatedAt: new Date().toISOString()
};
mkdirSync('artifacts/validation', { recursive: true });
writeFileSync('artifacts/validation/30-A-household-membership-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`30-A household membership contract: PASS (${checks.length} checks).`);
