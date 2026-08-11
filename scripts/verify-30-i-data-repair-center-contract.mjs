import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const files = {
  decision: 'docs/decisions/DEC-133-b1-05-data-repair-center.md',
  domain: 'packages/domain/src/data-repair.ts',
  application: 'packages/application/src/data-repair-use-cases.ts',
  contract: 'packages/repository-contracts/src/data-repair-repository.ts',
  repository: 'packages/repositories/src/data-repair-repository.ts',
  adapter: 'apps/desktop/src/main/data-repair-application-adapter.ts',
  composition: 'apps/desktop/src/main/repository-composition-root.ts',
  migration: 'database/migrations/0054_data_repair_center.sql',
  embeddedMigration: 'packages/database/src/family-database-migrations.ts'
};
const sources = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, readFileSync(path, 'utf8')]));
const checks = [];
const contains = (source, token, label) => { assert.equal(source.includes(token), true, `${label}: ${token}`); checks.push(label); };

contains(sources.decision, 'değişiklik yapılmadan önizlenir', 'decision requires preview before mutation');
contains(sources.decision, 'revisionToken', 'decision requires stale-preview token');
contains(sources.decision, 'fail-closed', 'decision records fail-closed repair and undo');
contains(sources.domain, "DataRepairIssueKind = 'duplicate_person' | 'broken_relation' | 'inconsistent_family_link'", 'domain defines governed issue kinds');
contains(sources.domain, "DataRepairOperationStatus = 'previewed' | 'applied' | 'undone'", 'domain defines finite operation states');
contains(sources.domain, "'end_inconsistent_membership'", 'domain retains inconsistent membership history');
contains(sources.domain, 'beforeSnapshot: DataRepairEntitySnapshot', 'domain records before snapshot');
contains(sources.domain, 'afterSnapshot: DataRepairEntitySnapshot', 'domain records after snapshot');
contains(sources.contract, 'scanIssues(context: RepositoryExecutionContext', 'repository contract exposes scoped scan');
contains(sources.contract, 'expectedRevisionToken: string', 'repository contract requires expected preview token');
contains(sources.contract, 'undoRepair(context: RepositoryExecutionContext', 'repository contract exposes rollback');
contains(sources.repository, 'ROW_NUMBER() OVER', 'repository deterministically ranks duplicate people');
contains(sources.repository, 'LEFT JOIN people source', 'repository detects broken relation endpoints');
contains(sources.repository, "suggestedResolution: 'align_relation_family'", 'repository detects alignable family link');
contains(sources.repository, "suggestedResolution: 'remove_cross_family_relation'", 'repository detects cross-family link');
contains(sources.repository, "suggestedResolution: 'end_inconsistent_membership'", 'repository detects inconsistent membership');
contains(sources.repository, "operation.revisionToken !== input.expectedRevisionToken", 'repository rejects mismatched preview token');
contains(sources.repository, "status='applied',applied_at=?", 'repository records atomic application');
contains(sources.repository, "status='undone',undone_at=?", 'repository records atomic rollback');
contains(sources.application, 'export class ScanDataRepairIssuesUseCase', 'application exposes authorized scanner');
contains(sources.application, 'export class PreviewDataRepairUseCase', 'application exposes preview');
contains(sources.application, 'export class ApplyDataRepairUseCase', 'application exposes safe apply');
contains(sources.application, 'export class UndoDataRepairUseCase', 'application exposes rollback');
contains(sources.application, 'export class GetDataRepairWorkspaceUseCase', 'application exposes governed workspace');
contains(sources.application, "action: `data_repair.${phase}`", 'application appends phase audit evidence');
contains(sources.application, "eventType: `family.data_repair.${phase}`", 'application enqueues phase outbox evidence');
contains(sources.adapter, "new Set<AuthorizationRole>(['family_admin'])", 'adapter restricts repairs to family administrator');
contains(sources.adapter, "action: 'administer'", 'adapter uses central authorization');
contains(sources.composition, 'dataRepairRepository: new SqliteDataRepairRepository()', 'composition root registers repair repository');
contains(sources.migration, 'CREATE TABLE data_repair_operations', 'migration creates durable repair ledger');
contains(sources.migration, 'ux_data_repair_active_issue', 'migration prevents concurrent repair plans');
contains(sources.migration, 'trg_data_repair_transition_update', 'migration guards state transitions');
contains(sources.migration, "status='previewed' AND applied_at IS NULL", 'migration binds state timestamps');
contains(sources.embeddedMigration, "createMigrationDefinition(54, 'data_repair_center'", 'runtime registers migration 54');

const normalized = (value) => value.replace(/\r\n/g, '\n').trim();
const embeddedStart = sources.embeddedMigration.indexOf('const dataRepairCenterSql = `');
assert.notEqual(embeddedStart, -1, 'embedded migration constant exists');
const bodyStart = embeddedStart + 'const dataRepairCenterSql = `'.length;
const bodyEnd = sources.embeddedMigration.indexOf('\n`;', bodyStart);
assert.equal(normalized(sources.embeddedMigration.slice(bodyStart, bodyEnd)), normalized(sources.migration), 'migration file and embedded SQL must be exact');
checks.push('migration file equals embedded runtime SQL');

const report = { schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '30-I', requirement: 'B1-05', status: 'PASS', checkCount: checks.length, checks, generatedAt: new Date().toISOString() };
mkdirSync('artifacts/validation', { recursive: true });
writeFileSync('artifacts/validation/30-I-data-repair-center-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`30-I data repair center contract: PASS (${checks.length} checks).`);
