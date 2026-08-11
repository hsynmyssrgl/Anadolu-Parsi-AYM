import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { FAMILY_DATABASE_MIGRATIONS } from '../packages/database/dist/index.js';

const sources = Object.fromEntries([
  ['domain', 'packages/domain/src/person-lifecycle.ts'],
  ['contract', 'packages/repository-contracts/src/person-lifecycle-repository.ts'],
  ['repository', 'packages/repositories/src/person-lifecycle-repository.ts'],
  ['application', 'packages/application/src/person-lifecycle-use-cases.ts'],
  ['adapter', 'apps/desktop/src/main/person-lifecycle-application-adapter.ts'],
  ['composition', 'apps/desktop/src/main/repository-composition-root.ts'],
  ['standaloneMigration', 'database/migrations/0051_person_profile_lifecycle.sql']
].map(([key, path]) => [key, readFileSync(path, 'utf8')]));

const checks = [];
const contains = (source, token, label) => {
  assert.equal(source.includes(token), true, `${label}: ${token}`);
  checks.push(label);
};

const migration = FAMILY_DATABASE_MIGRATIONS.find((item) => item.version === 51);
assert.ok(migration);
checks.push('migration version 51 exists');
assert.equal(migration.name, 'person_profile_lifecycle');
checks.push('migration version 51 name');
assert.equal(migration.sql.trim(), sources.standaloneMigration.trim());
checks.push('embedded and standalone migration are exact matches');

for (const [token, label] of [
  ['lifecycle_version', 'optimistic lifecycle version'],
  ['person_lifecycle_operations', 'reversible operation ledger'],
  ['before_snapshot', 'before snapshot'],
  ['after_snapshot', 'after snapshot'],
  ['reference_snapshot', 'reference snapshot'],
  ['trg_people_merge_target_scope', 'merge target scope trigger'],
  ['trg_person_lifecycle_operation_family_scope', 'operation family scope trigger'],
  ["status IN ('applied','undone')", 'operation status constraint']
]) contains(migration.sql, token, `migration ${label}`);

contains(sources.domain, 'PersonLifecycleProfile', 'domain lifecycle profile');
contains(sources.domain, 'PersonLifecycleOperation', 'domain reversible operation');
contains(sources.domain, 'PersonReferenceSummary', 'domain reference summary');
contains(sources.contract, 'findPotentialDuplicate', 'repository duplicate query');
contains(sources.contract, 'inspectReferences', 'repository reference inspection');
contains(sources.contract, 'markOperationUndone', 'repository undo marker');
contains(sources.repository, 'lower(trim(display_name))=lower(trim(?))', 'case-insensitive duplicate SQL');
contains(sources.repository, 'referenceQueries', 'referential integrity inventory');
contains(sources.repository, "UPDATE person_lifecycle_operations SET status='undone'", 'atomic undo marker SQL');
contains(sources.application, 'UpdatePersonProfileUseCase', 'profile update use case');
contains(sources.application, 'ArchivePersonProfileUseCase', 'archive use case');
contains(sources.application, 'MergePersonProfileUseCase', 'logical merge use case');
contains(sources.application, 'RequestSafePersonDeletionUseCase', 'safe delete request use case');
contains(sources.application, 'UndoPersonLifecycleOperationUseCase', 'undo use case');
contains(sources.application, 'references.value.total > 0', 'safe delete reference blocker');
contains(sources.application, "conflictResolution: 'KEEP_TARGET'", 'explicit merge conflict resolution');
contains(sources.application, 'executeAuthorized(this.unitOfWork', 'central authorization wrapper usage');
contains(sources.adapter, 'CentralAuthorizationService', 'central authorization service');
contains(sources.adapter, "action: 'administer'", 'central administer decision');
contains(sources.composition, 'SqlitePersonLifecycleRepository', 'desktop repository composition');

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-C',
  requirement: 'B1-02',
  status: 'PASS',
  checkCount: checks.length,
  checks,
  generatedAt: new Date().toISOString()
};
mkdirSync('artifacts/validation', { recursive: true });
writeFileSync('artifacts/validation/30-C-person-lifecycle-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`30-C person lifecycle contract: PASS (${checks.length} checks).`);
