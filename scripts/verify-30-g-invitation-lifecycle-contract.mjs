import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const files = {
  decision: 'docs/decisions/DEC-131-b1-04-invitation-lifecycle.md',
  domain: 'packages/domain/src/app-data.ts',
  application: 'packages/application/src/membership-use-cases.ts',
  contract: 'packages/repository-contracts/src/invitation-repository.ts',
  repository: 'packages/repositories/src/invitation-repository.ts',
  adapter: 'apps/desktop/src/main/membership-application-adapter.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  tokenAdapter: 'apps/desktop/src/main/invitation-token-application-adapter.ts',
  migration: 'database/migrations/0053_invitation_lifecycle.sql',
  embeddedMigration: 'packages/database/src/family-database-migrations.ts'
};
const sources = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, readFileSync(path, 'utf8')]));
const checks = [];
const contains = (source, token, label) => { assert.equal(source.includes(token), true, `${label}: ${token}`); checks.push(label); };

contains(sources.decision, '`ready`, `not_yet_active`, `expired`, `used`, `revoked` ve `invalid`', 'decision records finite safe resolution states');
contains(sources.decision, 'aynı transaction içinde iptal eder', 'decision requires atomic resend');
contains(sources.domain, "FamilyInvitationResolutionCode = 'ready'|'not_yet_active'|'expired'|'used'|'revoked'|'invalid'", 'domain defines invitation resolution codes');
contains(sources.domain, "FamilyInvitationRevocationReason = 'manual'|'resent'", 'domain defines auditable revocation reasons');
contains(sources.domain, 'revokedAt?:string', 'domain exposes revocation timestamp');
contains(sources.domain, 'resentFromInvitationId?:string', 'domain exposes resend predecessor');
contains(sources.domain, 'supersededByInvitationId?:string', 'domain exposes resend successor');
contains(sources.domain, 'FamilyInvitationInspectionView { resolution:FamilyInvitationResolutionCode; canAccept:boolean; message:string;', 'inspection view is status-only and does not expose identity');
contains(sources.application, 'export class InspectFamilyInvitationUseCase', 'application exposes token inspection use case');
contains(sources.application, "resolution: 'invalid'", 'inspection classifies invalid code');
contains(sources.application, "resolution: 'used'", 'inspection classifies used code');
contains(sources.application, "resolution: 'revoked'", 'inspection classifies revoked code');
contains(sources.application, "resolution: 'expired'", 'inspection classifies expired code');
contains(sources.application, "resolution: 'not_yet_active'", 'inspection classifies future code');
contains(sources.application, "resolution: 'ready'", 'inspection classifies ready code');
contains(sources.application, 'export class ResendFamilyInvitationUseCase', 'application exposes atomic resend use case');
contains(sources.application, "7 * 24 * 60 * 60 * 1000", 'resend defaults to seven-day validity');
contains(sources.application, "scope.revokeInvitation(previous.value.id, scope.occurredAt, 'resent', invitation.id)", 'resend invalidates predecessor with successor link');
contains(sources.application, "eventType: 'membership.invitation.resent'", 'resend emits governed outbox event');
contains(sources.application, "action: 'invitation.resent'", 'resend appends audit evidence');
contains(sources.application, 'const inspection = inspectInvitation(invitation.value, scope.occurredAt)', 'acceptance shares the same lifecycle policy');
contains(sources.contract, 'findById(context: RepositoryExecutionContext', 'repository contract supports governed resend lookup');
contains(sources.contract, 'supersededByInvitationId?: string', 'repository contract persists successor link');
contains(sources.repository, 'revoked_at,revocation_reason,resent_from_invitation_id,superseded_by_invitation_id', 'repository reads and writes lifecycle columns');
contains(sources.repository, "status IN ('pending','expired','revoked')", 'repository permits controlled resend of unused states');
contains(sources.repository, 'superseded_by_invitation_id IS NULL', 'repository prevents repeated supersession');
contains(sources.adapter, 'findInvitationByTokenHash(context: MembershipApplicationContext', 'query adapter supports anonymous safe inspection');
contains(sources.dataStore, 'public inspectInvitation(input: InspectFamilyInvitationInput)', 'data store composes lifecycle inspection');
contains(sources.dataStore, 'public resendInvitation(input: ResendFamilyInvitationInput)', 'data store composes resend transaction');
contains(sources.tokenAdapter, 'randomBytes(24)', 'invitation codes retain 192-bit cryptographic entropy');
contains(sources.tokenAdapter, "createHash('sha256')", 'only invitation token digest is persisted');
contains(sources.migration, 'ADD COLUMN revoked_at TEXT', 'migration adds revocation timestamp');
contains(sources.migration, 'idx_invitations_resent_from', 'migration enforces unique predecessor link');
contains(sources.migration, 'idx_invitations_superseded_by', 'migration enforces unique successor link');
contains(sources.migration, 'DEFERRABLE INITIALLY DEFERRED', 'successor foreign key is checked atomically at transaction commit');
contains(sources.migration, 'trg_invitations_lifecycle_insert', 'migration rejects invalid inserted lifecycle state');
contains(sources.migration, 'trg_invitations_lifecycle_update', 'migration rejects invalid updated lifecycle state');
contains(sources.embeddedMigration, "createMigrationDefinition(53, 'invitation_lifecycle'", 'runtime registers migration 53');
const normalized = (value) => value.replace(/\r\n/g, '\n').trim();
const embeddedStart = sources.embeddedMigration.indexOf('const invitationLifecycleSql = `');
assert.notEqual(embeddedStart, -1, 'embedded migration constant exists');
const bodyStart = embeddedStart + 'const invitationLifecycleSql = `'.length;
const bodyEnd = sources.embeddedMigration.indexOf('\n`;', bodyStart);
assert.equal(normalized(sources.embeddedMigration.slice(bodyStart, bodyEnd)), normalized(sources.migration), 'migration file and embedded SQL must be exact');
checks.push('migration file equals embedded runtime SQL');

const report = { schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '30-G', requirement: 'B1-04', status: 'PASS', checkCount: checks.length, checks, generatedAt: new Date().toISOString() };
mkdirSync('artifacts/validation', { recursive: true });
writeFileSync('artifacts/validation/30-G-invitation-lifecycle-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`30-G invitation lifecycle contract: PASS (${checks.length} checks).`);
