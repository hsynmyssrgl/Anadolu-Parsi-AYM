import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ledger = JSON.parse(await readFile('config/release-ledger.json', 'utf8'));
const currentVersion = ledger.current;
if (!currentVersion) throw new Error('Sürüm defterinin güncel kaydı bulunamadı.');
const expectedPackageVersion = currentVersion.packageVersion;
const expectedDisplayVersion = currentVersion.version;
const expectedStage = `${currentVersion.channel} · Aktif Geliştirme`;
const rootPackage = JSON.parse(await readFile('package.json', 'utf8'));
const desktopPackage = JSON.parse(await readFile('apps/desktop/package.json', 'utf8'));
const applicationPackage = JSON.parse(await readFile('packages/application/package.json', 'utf8'));
const infrastructurePackage = JSON.parse(await readFile('packages/infrastructure/package.json', 'utf8'));
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const meta = await readFile('packages/domain/src/app-meta.ts', 'utf8');
const main = await readFile('apps/desktop/src/main/main.ts', 'utf8');
const preload = await readFile('apps/desktop/src/main/preload.ts', 'utf8');
const dataStore = await readFile('apps/desktop/src/main/data-store.ts', 'utf8');
const familyDatabaseRuntime = await readFile('apps/desktop/src/main/family-database-runtime.ts', 'utf8');
const familyUseCases = await readFile('packages/application/src/family-use-cases.ts', 'utf8');
const genealogyUseCases = await readFile('packages/application/src/genealogy-use-cases.ts', 'utf8');
const timelineUseCases = await readFile('packages/application/src/timeline-use-cases.ts', 'utf8');
const dashboardUseCases = await readFile('packages/application/src/dashboard-use-cases.ts', 'utf8');
const navigationState = await readFile('apps/desktop/src/renderer/navigation.ts', 'utf8');
const authApplication = await readFile('packages/application/src/auth-use-cases.ts', 'utf8');
const accountRepository = await readFile('packages/repositories/src/account-repository.ts', 'utf8');
const authAdapter = await readFile('apps/desktop/src/main/auth-application-adapter.ts', 'utf8');
const sessionSecurity = await readFile('packages/security/src/session.ts', 'utf8');
const migrationModule = await readFile('packages/database/src/family-database-migrations.ts', 'utf8');
const migration1 = await readFile('database/migrations/0001_legacy_mvp40_schema.sql', 'utf8');
const migration2 = await readFile('database/migrations/0002_legacy_mvp40_compatibility.sql', 'utf8');
const migration4 = await readFile('database/migrations/0004_transactional_outbox.sql', 'utf8');
const migration5 = await readFile('database/migrations/0005_event_dispatcher_state.sql', 'utf8');
const migration6 = await readFile('database/migrations/0006_trusted_devices.sql', 'utf8');
const trustedDeviceRepository = await readFile('packages/repositories/src/trusted-device-repository.ts', 'utf8');
const totpSecurity = await readFile('packages/security/src/totp.ts', 'utf8');
const deviceIdentitySecurity = await readFile('packages/security/src/device-identity.ts', 'utf8');
const deviceIdentityAdapter = await readFile('apps/desktop/src/main/device-identity.ts', 'utf8');
const migration7 = await readFile('database/migrations/0007_authorization_audit_hardening.sql', 'utf8');
const migration8 = await readFile('database/migrations/0008_membership_collaboration_notifications.sql', 'utf8');
const migration9 = await readFile('database/migrations/0009_health_application_indexes.sql', 'utf8');
const migration10 = await readFile('database/migrations/0010_finance_query_indexes.sql', 'utf8');
const migration11 = await readFile('database/migrations/0011_archive_application_indexes.sql', 'utf8');
const healthUseCases = await readFile('packages/application/src/health-use-cases.ts', 'utf8');
const healthRepository = await readFile('packages/repositories/src/health-repository.ts', 'utf8');
const healthAdapter = await readFile('apps/desktop/src/main/health-application-adapter.ts', 'utf8');
const financeUseCases = await readFile('packages/application/src/finance-use-cases.ts', 'utf8');
const financeRepository = await readFile('packages/repositories/src/finance-repository.ts', 'utf8');
const financeAdapter = await readFile('apps/desktop/src/main/finance-application-adapter.ts', 'utf8');
const archiveUseCases = await readFile('packages/application/src/archive-use-cases.ts', 'utf8');
const archiveRepository = await readFile('packages/repositories/src/archive-repository.ts', 'utf8');
const archiveAdapter = await readFile('apps/desktop/src/main/archive-application-adapter.ts', 'utf8');
const membershipUseCases = await readFile('packages/application/src/membership-use-cases.ts', 'utf8');
const invitationRepository = await readFile('packages/repositories/src/invitation-repository.ts', 'utf8');
const notificationStateRepository = await readFile('packages/repositories/src/notification-state-repository.ts', 'utf8');
const membershipAdapter = await readFile('apps/desktop/src/main/membership-application-adapter.ts', 'utf8');
const authorizationSecurity = await readFile('packages/security/src/authorization.ts', 'utf8');
const authorizationUseCases = await readFile('packages/application/src/authorization-use-cases.ts', 'utf8');
const objectPermissionRepository = await readFile('packages/repositories/src/object-permission-repository.ts', 'utf8');
const authorizationAdapter = await readFile('apps/desktop/src/main/authorization-application-adapter.ts', 'utf8');
const auditChainCore = await readFile('packages/core/src/audit-chain.ts', 'utf8');
const auditRepository = await readFile('packages/repositories/src/audit-repository.ts', 'utf8');
const auditStorageProtectionUseCases = await readFile('packages/application/src/audit-storage-protection-use-cases.ts', 'utf8');
const sqliteDatabaseOperations = await readFile('packages/infrastructure/src/sqlite-database-operations.ts', 'utf8');
const auditStorageProtectionDatabase = await readFile('packages/database/src/audit-storage-protection.ts', 'utf8');

for (const [label, value] of [
  ['kök paket', rootPackage.version],
  ['masaüstü paket', desktopPackage.version],
  ['kilit dosyası', lock.version],
  ['kilit kök paketi', lock.packages?.['']?.version],
  ['kilit masaüstü paketi', lock.packages?.['apps/desktop']?.version]
]) {
  if (value !== expectedPackageVersion) throw new Error(`${label} sürümü uyumsuz: ${value ?? 'yok'}`);
}
if (!meta.includes(`version: '${expectedDisplayVersion}'`)) throw new Error('Görünen uygulama sürümü uyumsuz.');
if (!meta.includes(`packageVersion: '${expectedPackageVersion}'`)) throw new Error('APP_META paket sürümü uyumsuz.');
if (!meta.includes(`releaseId: '${currentVersion.releaseId}'`)) throw new Error('APP_META releaseId uyumsuz.');
if (!meta.includes(`monthlySequence: ${currentVersion.monthlySequence}`)) throw new Error('APP_META aylık sıra uyumsuz.');
if (!meta.includes(`stage: '${expectedStage}'`)) throw new Error('Application use-case aşama etiketi eksik.');
if (desktopPackage.dependencies?.['@ppt/application'] !== expectedPackageVersion) throw new Error('Desktop application workspace bağımlılığı eksik.');
if (desktopPackage.dependencies?.['@ppt/repositories'] !== expectedPackageVersion || desktopPackage.dependencies?.['@ppt/events'] !== expectedPackageVersion) throw new Error('Desktop repository/events workspace bağımlılıkları eksik.');
if (desktopPackage.dependencies?.['@ppt/database'] !== expectedPackageVersion) throw new Error('Desktop database workspace bağımlılığı eksik.');
if (desktopPackage.dependencies?.['@ppt/security'] !== expectedPackageVersion) throw new Error('Desktop security workspace bağımlılığı eksik.');
if (applicationPackage.dependencies?.['@ppt/infrastructure']) throw new Error('Application katmanı infrastructure paketine bağımlı olamaz.');
if (applicationPackage.dependencies?.['@ppt/core'] !== expectedPackageVersion || applicationPackage.dependencies?.['@ppt/domain'] !== expectedPackageVersion || applicationPackage.dependencies?.['@ppt/events'] !== expectedPackageVersion) throw new Error('Application katmanı bağımlılıkları eksik.');
if (applicationPackage.dependencies?.['@ppt/security'] !== expectedPackageVersion) throw new Error('Application authorization için security bağımlılığı eksik.');
if (infrastructurePackage.dependencies?.['@ppt/application'] !== expectedPackageVersion) throw new Error('Infrastructure application portlarını uygulamalıdır.');
if (lock.packages?.['packages/application']?.dependencies?.['@ppt/infrastructure']) throw new Error('Lockfile application→infrastructure bağımlılığı içeriyor.');
if (lock.packages?.['packages/application']?.dependencies?.['@ppt/security'] !== expectedPackageVersion) throw new Error('Lockfile application→security bağımlılığı eksik.');

for (const requiredFile of [
  'database/migrations/0001_legacy_mvp40_schema.sql',
  'database/migrations/0002_legacy_mvp40_compatibility.sql',
  'database/migrations/0003_database_metadata.sql',
  'database/migrations/0004_transactional_outbox.sql',
  'database/migrations/0005_event_dispatcher_state.sql',
  'database/migrations/0006_trusted_devices.sql',
  'database/migrations/0007_authorization_audit_hardening.sql',
  'database/migrations/0008_membership_collaboration_notifications.sql',
  'database/migrations/0009_health_application_indexes.sql',
  'database/migrations/0010_finance_query_indexes.sql',
  'database/migrations/0011_archive_application_indexes.sql',
  'packages/application/src/finance-use-cases.ts',
  'packages/repositories/src/finance-repository.ts',
  'apps/desktop/src/main/finance-application-adapter.ts',
  'packages/application/src/archive-use-cases.ts',
  'packages/repositories/src/archive-repository.ts',
  'apps/desktop/src/main/archive-application-adapter.ts',
  'packages/application/src/health-use-cases.ts',
  'packages/repositories/src/health-repository.ts',
  'apps/desktop/src/main/health-application-adapter.ts',
  'packages/application/src/membership-use-cases.ts',
  'packages/repositories/src/invitation-repository.ts',
  'packages/repositories/src/notification-state-repository.ts',
  'apps/desktop/src/main/membership-application-adapter.ts',
  'packages/repositories/src/trusted-device-repository.ts',
  'packages/repositories/src/object-permission-repository.ts',
  'packages/security/src/authorization.ts',
  'packages/application/src/authorization-use-cases.ts',
  'apps/desktop/src/main/authorization-application-adapter.ts',
  'packages/core/src/audit-chain.ts',
  'packages/security/src/totp.ts',
  'packages/security/src/device-identity.ts',
  'apps/desktop/src/main/device-identity.ts',
  'packages/database/src/migration-runner.ts',
  'packages/database/src/transaction.ts',
  'packages/repositories/src/sqlite-base.ts',
  'packages/repositories/src/family-repository.ts',
  'packages/repositories/src/person-repository.ts',
  'packages/repositories/src/relation-repository.ts',
  'packages/repositories/src/audit-repository.ts',
  'packages/repositories/src/outbox-repository.ts',
  'packages/application/src/family-use-cases.ts',
  'packages/application/src/genealogy-use-cases.ts',
  'packages/repositories/src/genealogy-repository.ts',
  'apps/desktop/src/main/genealogy-application-adapter.ts',
  'packages/application/src/timeline-use-cases.ts',
  'packages/repositories/src/timeline-repository.ts',
  'packages/repositories/src/location-repository.ts',
  'apps/desktop/src/main/timeline-application-adapter.ts',
  'packages/application/src/dashboard-use-cases.ts',
  'packages/repositories/src/dashboard-repository.ts',
  'packages/application/src/auth-use-cases.ts',
  'packages/repositories/src/account-repository.ts',
  'apps/desktop/src/main/auth-application-adapter.ts',
  'packages/security/src/session.ts',
  'apps/desktop/src/main/dashboard-application-adapter.ts',
  'apps/desktop/src/renderer/navigation.ts',
  'packages/application/src/timeline-ports.ts',
  'apps/desktop/src/main/family-application-adapter.ts',
  'apps/desktop/src/main/event-handlers.ts',
  'apps/desktop/src/main/database-migrations.ts',
  'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
  'artifacts/manifests/DATA_STORE_SMOKE_MVP56.json',
  'artifacts/manifests/REPOSITORY_OUTBOX_VERIFICATION_MVP56.json',
  'artifacts/manifests/EVENT_DISPATCHER_VERIFICATION_MVP56.json',
  'artifacts/manifests/FAMILY_USE_CASE_VERIFICATION_MVP56.json',
  'artifacts/manifests/GENEALOGY_READ_MODEL_VERIFICATION_MVP56.json',
  'artifacts/manifests/TIMELINE_USE_CASE_VERIFICATION_MVP56.json',
  'artifacts/manifests/DASHBOARD_OVERVIEW_VERIFICATION_MVP56.json',
  'artifacts/manifests/AUTH_SESSION_VERIFICATION_MVP56.json',
  'artifacts/manifests/MFA_TRUSTED_DEVICE_VERIFICATION_MVP56.json',
  'artifacts/manifests/AUTHORIZATION_AUDIT_VERIFICATION_MVP56.json',
  'artifacts/manifests/MEMBERSHIP_COLLABORATION_VERIFICATION_MVP56.json',
  'artifacts/manifests/HEALTH_USE_CASE_VERIFICATION_MVP56.json',
  'artifacts/manifests/FINANCE_USE_CASE_VERIFICATION_MVP56.json',
  'artifacts/manifests/ARCHIVE_USE_CASE_VERIFICATION_MVP56.json',
  'artifacts/manifests/VERSION_LEDGER.json'
]) await access(requiredFile);

if (dataStore.includes('#migrate()')) throw new Error('Legacy tek parça #migrate metodu kaldırılmamış.');
if (!dataStore.includes('new SqliteFamilyDatabaseRuntime(') || !familyDatabaseRuntime.includes('runFamilyDatabaseMigrations')) throw new Error('Family database runtime migration runner entegrasyonu eksik.');
if (!dataStore.includes('RepositoryBackedFamilyApplicationUnitOfWork') || !dataStore.includes('RepositoryBackedFamilyGraphQueryPort') || !dataStore.includes('RepositoryBackedGenealogyReadModelQueryPort')) throw new Error('Family application SQLite adapter entegrasyonu eksik.');
if (!dataStore.includes('RepositoryBackedTimelineApplicationUnitOfWork') || !dataStore.includes('RepositoryBackedTimelineQueryPort')) throw new Error('Timeline application SQLite adapter entegrasyonu eksik.');
if (!dataStore.includes('this.#createFamilyMemberUseCase.execute') || !dataStore.includes('this.#createFamilyRelationUseCase.execute') || !dataStore.includes('this.#getFamilyGraphUseCase.execute')) throw new Error('Aile çekirdek işlemleri use-case katmanına taşınmamış.');
if (!familyUseCases.includes('class CreateFamilyMemberUseCase') || !familyUseCases.includes('class CreateFamilyRelationUseCase') || !familyUseCases.includes('class GetFamilyGraphUseCase')) throw new Error('Family use-case sınıfları eksik.');
if (!genealogyUseCases.includes('class GetGenealogyReadModelUseCase') || !genealogyUseCases.includes('calculateGenealogyGenerations')) throw new Error('Genealogy read-model use-case veya hesaplayıcı eksik.');
if (!timelineUseCases.includes('class GetTimelineReadModelUseCase') || !timelineUseCases.includes('class GetImportantDayDetailsUseCase') || !timelineUseCases.includes('class CreateImportantDayUseCase')) throw new Error('Timeline application use-case sınıfları eksik.');
if (!dashboardUseCases.includes('class GetDashboardOverviewUseCase') || !dataStore.includes('this.#getDashboardOverviewUseCase.execute')) throw new Error('Dashboard query use-case entegrasyonu eksik.');
if (!navigationState.includes('navigationReducer') || !navigationState.includes('persistNavigationState')) throw new Error('Navigation state reducer veya kalıcı durum yönetimi eksik.');
if (genealogyUseCases.includes('node:sqlite') || genealogyUseCases.includes('@ppt/repositories') || genealogyUseCases.includes('@ppt/infrastructure')) throw new Error('Genealogy application katmanı infrastructure ayrıntısı içeriyor.');
if (familyUseCases.includes('node:sqlite') || familyUseCases.includes('@ppt/repositories') || familyUseCases.includes('@ppt/infrastructure')) throw new Error('Application use-case katmanı infrastructure ayrıntısı içeriyor.');
if (timelineUseCases.includes('node:sqlite') || timelineUseCases.includes('@ppt/repositories') || timelineUseCases.includes('@ppt/infrastructure')) throw new Error('Timeline application katmanı infrastructure ayrıntısı içeriyor.');
if (dashboardUseCases.includes('node:sqlite') || dashboardUseCases.includes('@ppt/repositories') || dashboardUseCases.includes('@ppt/infrastructure')) throw new Error('Dashboard application katmanı infrastructure ayrıntısı içeriyor.');

const dashboardSection = dataStore.slice(dataStore.indexOf('public getDashboardOverview()'), dataStore.indexOf('public getSnapshot()'));
if (/SELECT\s+/i.test(dashboardSection) || /this\.#database/i.test(dashboardSection)) throw new Error('getDashboardOverview doğrudan SQL/database erişimi içeriyor.');
const genealogySection = dataStore.slice(dataStore.indexOf('public getGenealogyInsights()'), dataStore.indexOf('public searchArchive('));
if (/SELECT\s+/i.test(genealogySection) || /this\.#database/i.test(genealogySection)) throw new Error('getGenealogyInsights doğrudan SQL/database erişimi içeriyor.');
const memberSection = dataStore.slice(dataStore.indexOf('public createMember('), dataStore.indexOf('public createLocation('));
const relationSection = dataStore.slice(dataStore.indexOf('public createRelation('), dataStore.indexOf('public listArchive('));
const snapshotSection = dataStore.slice(dataStore.indexOf('public getSnapshot('), dataStore.indexOf('public createMember('));
if (/INSERT\s+INTO\s+people/i.test(memberSection)) throw new Error('createMember içinde doğrudan kişi SQL yazımı kaldı.');
if (/INSERT\s+INTO\s+relations/i.test(relationSection)) throw new Error('createRelation içinde doğrudan ilişki SQL yazımı kaldı.');
if (/SELECT\s+id,\s*display_name/i.test(snapshotSection) || /FROM\s+relations/i.test(snapshotSection)) throw new Error('getSnapshot aile grafiğini doğrudan SQL ile okuyor.');
if (/FROM\s+events/i.test(snapshotSection) || /FROM\s+locations/i.test(snapshotSection)) throw new Error('getSnapshot timeline verisini doğrudan SQL ile okuyor.');
const createEventSection = dataStore.slice(dataStore.indexOf('public createEvent('), dataStore.indexOf('public exportBackup('));
if (/INSERT\s+INTO\s+events/i.test(createEventSection) || /BEGIN\s+IMMEDIATE/i.test(createEventSection)) throw new Error('createEvent doğrudan SQL/transaction erişimi içeriyor.');
if (!dataStore.includes('this.#getTimelineReadModelUseCase.execute') || !dataStore.includes('this.#getImportantDayDetailsUseCase.execute') || !dataStore.includes('this.#createImportantDayUseCase.execute')) throw new Error('Timeline işlemleri use-case katmanına taşınmamış.');
if (!main.includes("family:createRelation', async")) throw new Error('Relation IPC outbox dispatch akışına bağlanmamış.');
if (!main.includes("timeline:createImportantDay', async")) throw new Error('Timeline IPC outbox dispatch akışına bağlanmamış.');
if (!main.includes("timeline:updateParticipants', async") || !main.includes("timeline:updateInvitation', async") || !main.includes("timeline:updateNotes', async") || !main.includes("notifications:acknowledge', async")) throw new Error('Collaboration IPC/outbox akışları eksik.');
if (!dataStore.includes('this.#createFamilyInvitationUseCase.execute') || !dataStore.includes('this.#acceptFamilyInvitationUseCase.execute')) throw new Error('Aile davet işlemleri membership use-case katmanına taşınmamış.');
if (!dataStore.includes('this.#updateImportantDayParticipantsUseCase.execute') || !dataStore.includes('this.#acknowledgeTimelineNotificationUseCase.execute')) throw new Error('Etkinlik iş birliği ve bildirim işlemleri use-case katmanına taşınmamış.');
if (membershipUseCases.includes('node:sqlite') || membershipUseCases.includes('@ppt/repositories')) throw new Error('Membership application katmanı SQLite/repository ayrıntısı içeriyor.');
if (!invitationRepository.includes('class SqliteInvitationRepository') || !notificationStateRepository.includes('class SqliteNotificationStateRepository')) throw new Error('Invitation/notification repository implementasyonları eksik.');
if (!membershipAdapter.includes('class RepositoryBackedMembershipUnitOfWork') || !membershipAdapter.includes('class RepositoryBackedMembershipQueryPort')) throw new Error('Membership SQLite adapter eksik.');

const authSection = dataStore.slice(dataStore.indexOf('public getAuthState()'), dataStore.indexOf('public createRelation('));
if (/SELECT\s+|INSERT\s+|UPDATE\s+/i.test(authSection) || /this\.#database/i.test(authSection)) throw new Error('Temel auth işlemlerinde doğrudan SQL/database erişimi kaldı.');
if (!dataStore.includes('this.#setupAdminUseCase.execute') || !dataStore.includes('this.#loginUseCase.execute') || !dataStore.includes('this.#changePasswordUseCase.execute')) throw new Error('Kimlik doğrulama işlemleri use-case katmanına taşınmamış.');
if (!authApplication.includes('class LoginUseCase') || !authApplication.includes('class ChangePasswordUseCase')) throw new Error('Auth application use-case sınıfları eksik.');
if (!accountRepository.includes('class SqliteAccountRepository')) throw new Error('Account repository implementasyonu eksik.');
if (!authAdapter.includes('class RepositoryBackedAuthApplicationUnitOfWork')) throw new Error('Auth SQLite adapter eksik.');
if (!sessionSecurity.includes('class InMemorySessionManager')) throw new Error('Session güvenlik yöneticisi eksik.');

if (!migrationModule.includes('LEGACY_MVP40_SCHEMA_FINGERPRINT')) throw new Error('Legacy schema fingerprint tanımı eksik.');
if (!migrationModule.includes('MVP56_APPLICATION_SCHEMA_FINGERPRINT')) throw new Error('MVP-56 son şema fingerprint tanımı eksik.');
if (!migrationModule.includes("createMigrationDefinition(5, 'event_dispatcher_state'")) throw new Error('Event dispatcher state migration tanımı eksik.');
if (!migrationModule.includes("createMigrationDefinition(6, 'trusted_devices'")) throw new Error('Trusted device migration tanımı eksik.');
if (!migrationModule.includes("createMigrationDefinition(7, 'authorization_audit_hardening'")) throw new Error('Authorization/audit hardening migration tanımı eksik.');
if (!migrationModule.includes("createMigrationDefinition(8, 'membership_collaboration_notifications'")) throw new Error('Membership collaboration migration tanımı eksik.');
if (!migrationModule.includes("createMigrationDefinition(9, 'health_application_indexes'")) throw new Error('Health application index migration tanımı eksik.');
if (!migrationModule.includes("createMigrationDefinition(10, 'finance_application_indexes'")) throw new Error('Finance application index migration tanımı eksik.');
if (!migrationModule.includes("createMigrationDefinition(11, 'archive_application_indexes'")) throw new Error('Archive application index migration tanımı eksik.');
if (!migration4.includes('CREATE TABLE event_outbox') || !migration4.includes('CREATE TABLE event_handler_receipts')) throw new Error('Outbox altyapı tabloları eksik.');
if (!migration5.includes('processing_started_at') || !migration5.includes('idx_event_outbox_processing')) throw new Error('Dispatcher stale-processing migration eksik.');
if (!migration6.includes('CREATE TABLE trusted_devices') || !migration6.includes('public_key_pem')) throw new Error('Trusted device şeması eksik.');
if (!migration7.includes('sequence_no') || !migration7.includes('hash_version') || !migration7.includes('idx_permission_subject_active')) throw new Error('Authorization/audit hardening şeması eksik.');
if (!migration8.includes('CREATE TABLE event_notification_states') || !migration8.includes('idx_invitations_pending_email')) throw new Error('Membership collaboration/notification state şeması eksik.');
if (!migration9.includes('idx_medication_owner_active') || !migration9.includes('idx_family_health_related') || !migration9.includes('idx_health_kind_date')) throw new Error('Health query index migration eksik.');
if (!migration10.includes('idx_finance_records_kind_currency_date') || !migration10.includes('idx_finance_valuations_record_date')) throw new Error('Finance query index migration eksik.');
if (!migration11.includes('stored_name') || !migration11.includes('idx_archive_versions_item_version') || !migration11.includes('ux_archive_versions_item_sha')) throw new Error('Archive versioning migration eksik.');
if (!financeUseCases.includes('class CreateFinanceRecordUseCase') || !financeUseCases.includes('class CreateFinanceValuationUseCase')) throw new Error('Finance application use-case sınıfları eksik.');
if (!financeRepository.includes('class SqliteFinanceRepository') || !financeAdapter.includes('class RepositoryBackedFinanceUnitOfWork')) throw new Error('Finance repository/adapter eksik.');
if (!archiveUseCases.includes('class ImportArchiveItemUseCase') || !archiveUseCases.includes('class ListArchiveVersionsUseCase')) throw new Error('Archive application use-case sınıfları eksik.');
if (!archiveRepository.includes('class SqliteArchiveRepository') || !archiveAdapter.includes('class RepositoryBackedArchiveUnitOfWork')) throw new Error('Archive repository/adapter eksik.');
if (!dataStore.includes('this.#importArchiveItemUseCase.execute') || !dataStore.includes('this.#listArchiveVersionsUseCase.execute')) throw new Error('Archive işlemleri use-case katmanına taşınmamış.');
if (!healthUseCases.includes('class CreateHealthRecordUseCase') || !healthUseCases.includes('class CreateMedicationPlanUseCase') || !healthUseCases.includes('class CreateFamilyHealthHistoryUseCase')) throw new Error('Health application use-case sınıfları eksik.');
if (healthUseCases.includes('node:sqlite') || healthUseCases.includes('@ppt/repositories')) throw new Error('Health application katmanı SQLite/repository ayrıntısı içeriyor.');
if (!healthRepository.includes('class SqliteHealthRepository')) throw new Error('Health repository implementasyonu eksik.');
if (!healthAdapter.includes('class RepositoryBackedHealthUnitOfWork') || !healthAdapter.includes('class RepositoryBackedHealthQueryPort')) throw new Error('Health SQLite adapter eksik.');
if (!dataStore.includes('this.#createHealthRecordUseCase.execute') || !dataStore.includes('this.#createMedicationPlanUseCase.execute') || !dataStore.includes('this.#createFamilyHealthHistoryUseCase.execute')) throw new Error('Health işlemleri use-case katmanına taşınmamış.');
if (!authorizationSecurity.includes('class CentralAuthorizationService') || !authorizationSecurity.includes("grant.effect === 'deny'")) throw new Error('Merkezi deny-precedence authorization servisi eksik.');
if (!authorizationUseCases.includes('class EvaluateAuthorizationUseCase') || !authorizationUseCases.includes('class UpsertObjectPermissionUseCase') || !authorizationUseCases.includes('class VerifyAuditIntegrityUseCase')) throw new Error('Authorization application use-case sınıfları eksik.');
if (!objectPermissionRepository.includes('class SqliteObjectPermissionRepository')) throw new Error('Object permission repository implementasyonu eksik.');
if (!authorizationAdapter.includes('class RepositoryBackedAuthorizationUnitOfWork')) throw new Error('Authorization SQLite adapter eksik.');
if (!auditChainCore.includes('computeAuditEntryHashV2') || !auditChainCore.includes('verifyAuditChain')) throw new Error('Audit v2 hash/verification çekirdeği eksik.');
if (!auditRepository.includes('const hashVersion = 2') || !auditRepository.includes('sequence_no')) throw new Error('Audit repository v2 zinciri eksik.');
if (!auditStorageProtectionUseCases.includes('class InstallAuditStorageProtectionUseCase') || !sqliteDatabaseOperations.includes('class SqliteAuditStorageProtectionCommandPort') || !auditStorageProtectionDatabase.includes('AUDIT-APPEND-ONLY') || !dataStore.includes('new InstallAuditStorageProtectionUseCase') || !dataStore.includes('new SqliteAuditStorageProtectionCommandPort(this.#database)')) throw new Error('Audit append-only storage protection sınırı eksik.');
if (!dataStore.includes('this.#upsertObjectPermissionUseCase.execute') || !dataStore.includes('this.#deleteObjectPermissionUseCase.execute')) throw new Error('Permission yazımları merkezi use-case katmanına taşınmamış.');
if (!trustedDeviceRepository.includes('class SqliteTrustedDeviceRepository')) throw new Error('Trusted device repository implementasyonu eksik.');
if (!totpSecurity.includes('generateTotp') || !totpSecurity.includes('consumeRecoveryCode')) throw new Error('TOTP/recovery security primitives eksik.');
if (!deviceIdentitySecurity.includes('generateKeyPairSync') || !deviceIdentitySecurity.includes('createDeviceProof')) throw new Error("Ed25519 cihaz kimliği primitive'leri eksik.");
if (!deviceIdentityAdapter.includes('class FileDeviceIdentityProvider')) throw new Error("Dosya tabanlı cihaz kimliği adapter'ı eksik.");

const tableDeclarations = [...migration1.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_]+)/gi)];
if (tableDeclarations.length !== 40) throw new Error(`Legacy uygulama tablo sayısı 40 olmalı: ${tableDeclarations.length}`);
const compatibilityAlters = [...migration2.matchAll(/ALTER\s+TABLE/gi)];
if (compatibilityAlters.length !== 24) throw new Error(`Compatibility ALTER sayısı 24 olmalı: ${compatibilityAlters.length}`);

const mainChannels = [...main.matchAll(/registerIpcHandler\(\s*['"]([^'"]+)/g)].map((match) => match[1]);
const directPreloadChannels = [...preload.matchAll(/\binvoke(?:<[^>]+>)?\(\s*['"]([^'"]+)/g)].map((match) => match[1]);
const archiveMutationChannels = [...preload.matchAll(/\binvokeArchiveMutation(?:<[^>]+>)?\(\s*['"]([^'"]+)/g)].map((match) => match[1]);
const uniqueMainChannels = [...new Set(mainChannels)];
const preloadChannels = [...new Set([...directPreloadChannels, ...archiveMutationChannels])];
if (mainChannels.length !== uniqueMainChannels.length) throw new Error('Main tarafında yinelenen IPC kanal kaydı var.');
const missingInMain = preloadChannels.filter((channel) => !uniqueMainChannels.includes(channel));
const missingInPreload = uniqueMainChannels.filter((channel) => !preloadChannels.includes(channel));
if (missingInMain.length || missingInPreload.length) {
  throw new Error(`IPC eşleşmesi bozuldu: preload-only=${missingInMain.join(',') || 'yok'}; main-only=${missingInPreload.join(',') || 'yok'}`);
}

for (const artifact of [
  'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
  'artifacts/manifests/DATA_STORE_SMOKE_MVP56.json',
  'artifacts/manifests/REPOSITORY_OUTBOX_VERIFICATION_MVP56.json',
  'artifacts/manifests/EVENT_DISPATCHER_VERIFICATION_MVP56.json',
  'artifacts/manifests/FAMILY_USE_CASE_VERIFICATION_MVP56.json',
  'artifacts/manifests/GENEALOGY_READ_MODEL_VERIFICATION_MVP56.json',
  'artifacts/manifests/TIMELINE_USE_CASE_VERIFICATION_MVP56.json',
  'artifacts/manifests/DASHBOARD_OVERVIEW_VERIFICATION_MVP56.json',
  'artifacts/manifests/AUTH_SESSION_VERIFICATION_MVP56.json',
  'artifacts/manifests/MFA_TRUSTED_DEVICE_VERIFICATION_MVP56.json',
  'artifacts/manifests/AUTHORIZATION_AUDIT_VERIFICATION_MVP56.json',
  'artifacts/manifests/MEMBERSHIP_COLLABORATION_VERIFICATION_MVP56.json',
  'artifacts/manifests/HEALTH_USE_CASE_VERIFICATION_MVP56.json'
]) {
  const report = JSON.parse(await readFile(artifact, 'utf8'));
  if (report.status !== 'passed') throw new Error(`Doğrulama raporu başarısız: ${artifact}`);
}

const forbiddenName = /Anadolu Pars[ıi].*(yatırım|işlem|borsa)/i;
const forbiddenIntegration = /(Matriks|İş Yatırım|Is Yatirim|Deniz Yatırım|Deniz Yatirim|\bbroker\b|otomatik emir)/i;
const unfinishedMarker = /\b(TODO|FIXME|HACK|XXX)\b/;
const violations = [];
async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (['dist', 'node_modules', 'release', '.tmp'].includes(entry.name)) continue;
    const full = join(path, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (/\.(ts|tsx|sql)$/.test(entry.name)) {
      const text = await readFile(full, 'utf8');
      if (forbiddenName.test(text)) violations.push(`${full}: eski ürün adı`);
      if (forbiddenIntegration.test(text)) violations.push(`${full}: kapsam dışı yatırım entegrasyonu`);
      if (unfinishedMarker.test(text)) violations.push(`${full}: tamamlanmamış kod işareti`);
    }
  }
}
for (const root of ['apps', 'packages', 'database']) await walk(root);
if (violations.length) throw new Error(`Bronze database gate ihlalleri: ${violations.join(', ')}`);

console.log('Bronze veri kapısı başarılı: arşiv repository/use-case, şifreli kasa bütünlüğü, immutable sürüm kaydı, transactional audit/outbox, 15 migration, 42 uygulama/güvenlik tablosu ve güncel IPC kanalları doğrulandı.');
