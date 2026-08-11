import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const files = {
  decision: 'docs/decisions/DEC-130-b1-03-contextual-central-authorization.md',
  domain: 'packages/domain/src/app-data.ts',
  security: 'packages/security/src/authorization.ts',
  application: 'packages/application/src/authorization-use-cases.ts',
  contract: 'packages/repository-contracts/src/object-permission-repository.ts',
  repository: 'packages/repositories/src/object-permission-repository.ts',
  adapter: 'apps/desktop/src/main/authorization-application-adapter.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  migration: 'database/migrations/0052_authorization_context.sql',
  embeddedMigration: 'packages/database/src/family-database-migrations.ts'
};
const sources = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, readFileSync(path, 'utf8')]));
const checks = [];
const contains = (source, token, label) => { assert.equal(source.includes(token), true, `${label}: ${token}`); checks.push(label); };

contains(sources.decision, 'işlemin amacı (`purpose`)', 'decision records mandatory purpose context');
contains(sources.decision, 'açık ret', 'decision records explicit denial context');
contains(sources.domain, 'AuthorizationPurpose', 'domain defines finite authorization purposes');
contains(sources.domain, 'familyBranchId?:string', 'domain permission supports family branch scope');
contains(sources.domain, 'denialReason?:string', 'domain permission preserves explicit denial reason');
contains(sources.security, "grant.purpose === 'general'", 'central policy evaluates grant purpose');
contains(sources.security, 'grant.familyBranchId === request.resourceBranchId', 'central policy matches resource family branch');
contains(sources.security, "reason: 'branch_boundary'", 'central policy fails closed at branch boundary');
contains(sources.security, 'denialReason: deny.denialReason', 'central policy returns explicit denial context');
contains(sources.security, 'Date.parse(grant.startsAt)', 'central policy evaluates grant start time');
contains(sources.security, 'Date.parse(grant.endsAt)', 'central policy evaluates grant end time');
contains(sources.application, 'listActiveBranchIds?', 'authorization query port exposes branch context');
contains(sources.application, "purpose: input.purpose ?? 'general'", 'authorization use case sends purpose to policy');
contains(sources.application, 'actorBranchIds: branches.value', 'authorization use case sends active actor branches');
contains(sources.application, 'Açık ret gerekçesi 5 ile 500 karakter arasında olmalıdır.', 'permission write validates explicit denial reason');
contains(sources.contract, 'readonly purpose: AuthorizationPurpose', 'repository contract persists purpose');
contains(sources.contract, 'readonly familyBranchId?: FamilyBranchId', 'repository contract persists family branch');
contains(sources.contract, 'readonly denialReason?: string', 'repository contract persists denial reason');
contains(sources.repository, 'purpose,family_branch_id,denial_reason', 'repository reads contextual permission columns');
contains(sources.repository, 'family_branch_id=excluded.family_branch_id', 'repository atomically updates contextual fields');
contains(sources.adapter, 'listActiveBranchIds(', 'desktop adapter resolves active branch memberships');
contains(sources.adapter, "membership.status === 'active'", 'desktop adapter filters inactive memberships');
contains(sources.dataStore, 'householdMembershipRepository: this.#repositories.householdMembershipRepository', 'data store composes branch-aware authorization query');
contains(sources.dataStore, "purpose: AuthorizationPurpose = 'general'", 'data store central decision accepts explicit purpose');
contains(sources.migration, 'ADD COLUMN purpose TEXT NOT NULL', 'migration adds required purpose column');
contains(sources.migration, 'ADD COLUMN family_branch_id TEXT REFERENCES family_branches', 'migration adds governed branch foreign key');
contains(sources.migration, 'ADD COLUMN denial_reason TEXT', 'migration adds denial evidence');
contains(sources.migration, 'trg_object_permissions_context_insert', 'migration enforces context on insert');
contains(sources.migration, 'trg_object_permissions_context_update', 'migration enforces context on update');
contains(sources.embeddedMigration, "createMigrationDefinition(52, 'authorization_context'", 'runtime registers migration 52');
const normalized = (value) => value.replace(/\r\n/g, '\n').trim();
const embeddedStart = sources.embeddedMigration.indexOf('const authorizationContextSql = `');
assert.notEqual(embeddedStart, -1, 'embedded migration constant exists');
const bodyStart = embeddedStart + 'const authorizationContextSql = `'.length;
const bodyEnd = sources.embeddedMigration.indexOf('\n`;', bodyStart);
assert.equal(normalized(sources.embeddedMigration.slice(bodyStart, bodyEnd)), normalized(sources.migration), 'migration file and embedded SQL must be exact');
checks.push('migration file equals embedded runtime SQL');

const report = { schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '30-E', requirement: 'B1-03', status: 'PASS', checkCount: checks.length, checks, generatedAt: new Date().toISOString() };
mkdirSync('artifacts/validation', { recursive: true });
writeFileSync('artifacts/validation/30-E-authorization-context-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`30-E authorization context contract: PASS (${checks.length} checks).`);
