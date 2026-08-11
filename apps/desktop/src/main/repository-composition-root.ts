import {
  SqliteAccountRepository,
  SqliteAiConsentRepository,
  SqliteArchiveRepository,
  SqliteAuditRepository,
  SqliteAutomationRepository,
  SqliteBackupRepository,
  SqliteBackupPropagationRepository,
  SqliteBackupQuarantineRepository,
  SqliteBootstrapRepository,
  SqliteDashboardRepository,
  SqliteDataRepairRepository,
  SqliteDataLifecycleRepository,
  SqliteDiagnosticRepository,
  SqliteEntityCatalogRepository,
  SqliteFamilyRepository,
  SqliteFamilyDataImportRepository,
  SqliteFinanceRepository,
  SqliteExternalBackupInventoryRepository,
  SqliteGenealogyRepository,
  SqliteHealthRepository,
  SqliteHouseholdMembershipRepository,
  SqliteInvitationRepository,
  SqliteLegacyRepository,
  SqliteLifeRepository,
  SqliteLargeFamilyReadModelRepository,
  SqliteLocationRepository,
  SqliteNotificationStateRepository,
  SqliteObjectPermissionRepository,
  SqliteOutboxRepository,
  SqlitePersonRepository,
  SqlitePersonLifecycleRepository,
  SqlitePlatformPolicyTransactionRepository,
  SqliteRelationRepository,
  SqliteReportRepository,
  SqliteTaskRepository,
  SqliteTimelineRepository,
  SqliteTrustedDeviceRepository,
  SqliteWindowsHelloRegistrationRepository
} from '@ppt/repositories';
import type {
  AccountRepositoryPort,
  AiConsentRepositoryPort,
  ArchiveRepositoryPort,
  ArchivePolicyResourceRepositoryPort,
  AuditRepositoryPort,
  AutomationRepositoryPort,
  BackupRepositoryPort,
  BackupPropagationRepositoryPort,
  BackupQuarantineRepositoryPort,
  BootstrapRepositoryPort,
  DashboardRepositoryPort,
  DataRepairRepositoryPort,
  DataLifecycleRepositoryPort,
  DiagnosticRepositoryPort,
  EntityCatalogRepositoryPort,
  FamilyRepositoryPort,
  FamilyDataImportRepositoryPort,
  FinancePolicyResourceRepositoryPort,
  FinanceRepositoryPort,
  ExternalBackupInventoryRepositoryPort,
  GenealogyRepositoryPort,
  HealthPolicyResourceRepositoryPort,
  HealthRepositoryPort,
  HouseholdMembershipRepositoryPort,
  InvitationRepositoryPort,
  LegacyRepositoryPort,
  LargeFamilyReadModelRepositoryPort,
  LifePolicyResourceRepositoryPort,
  LifeProjectionRepositoryPort,
  LifeRepositoryPort,
  LocationPolicyResourceRepositoryPort,
  LocationRepositoryPort,
  NotificationStateRepositoryPort,
  ObjectPermissionRepositoryPort,
  OutboxRepositoryPort,
  PersonRepositoryPort,
  PersonLifecycleRepositoryPort,
  PlatformPolicyTransactionRepositoryPort,
  RelationRepositoryPort,
  ReportRepositoryPort,
  TaskRepositoryPort,
  TimelineEventPolicyResourceRepositoryPort,
  TimelineRepositoryPort,
  TrustedDeviceRepositoryPort,
  WindowsHelloRegistrationRepositoryPort
} from '@ppt/repository-contracts';

export interface RepositoryCompositionRoot {
  readonly accountRepository: AccountRepositoryPort;
  readonly aiConsentRepository: AiConsentRepositoryPort;
  readonly archiveRepository: ArchiveRepositoryPort & ArchivePolicyResourceRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly automationRepository: AutomationRepositoryPort;
  readonly backupRepository: BackupRepositoryPort;
  readonly backupPropagationRepository: BackupPropagationRepositoryPort;
  readonly backupQuarantineRepository: BackupQuarantineRepositoryPort;
  readonly bootstrapRepository: BootstrapRepositoryPort;
  readonly dashboardRepository: DashboardRepositoryPort;
  readonly dataRepairRepository: DataRepairRepositoryPort;
  readonly dataLifecycleRepository: DataLifecycleRepositoryPort;
  readonly diagnosticRepository: DiagnosticRepositoryPort;
  readonly entityCatalogRepository: EntityCatalogRepositoryPort;
  readonly familyRepository: FamilyRepositoryPort;
  readonly familyDataImportRepository: FamilyDataImportRepositoryPort;
  readonly financeRepository: FinanceRepositoryPort & FinancePolicyResourceRepositoryPort;
  readonly externalBackupInventoryRepository: ExternalBackupInventoryRepositoryPort;
  readonly genealogyRepository: GenealogyRepositoryPort;
  readonly healthRepository: HealthRepositoryPort & HealthPolicyResourceRepositoryPort;
  readonly householdMembershipRepository: HouseholdMembershipRepositoryPort;
  readonly invitationRepository: InvitationRepositoryPort;
  readonly legacyRepository: LegacyRepositoryPort;
  readonly lifeRepository: LifeRepositoryPort & LifePolicyResourceRepositoryPort & LifeProjectionRepositoryPort;
  readonly largeFamilyReadModelRepository: LargeFamilyReadModelRepositoryPort;
  readonly locationRepository: LocationRepositoryPort & LocationPolicyResourceRepositoryPort;
  readonly notificationStateRepository: NotificationStateRepositoryPort;
  readonly objectPermissionRepository: ObjectPermissionRepositoryPort;
  readonly outboxRepository: OutboxRepositoryPort;
  readonly personRepository: PersonRepositoryPort;
  readonly personLifecycleRepository: PersonLifecycleRepositoryPort;
  readonly platformPolicyTransactionRepository: PlatformPolicyTransactionRepositoryPort;
  readonly relationRepository: RelationRepositoryPort;
  readonly reportRepository: ReportRepositoryPort;
  readonly taskRepository: TaskRepositoryPort;
  readonly timelineRepository: TimelineRepositoryPort & TimelineEventPolicyResourceRepositoryPort;
  readonly trustedDeviceRepository: TrustedDeviceRepositoryPort;
  readonly windowsHelloRegistrationRepository: WindowsHelloRegistrationRepositoryPort;
}

export const createSqliteRepositoryCompositionRoot = (): RepositoryCompositionRoot => ({
  accountRepository: new SqliteAccountRepository(),
  aiConsentRepository: new SqliteAiConsentRepository(),
  archiveRepository: new SqliteArchiveRepository(),
  auditRepository: new SqliteAuditRepository(),
  automationRepository: new SqliteAutomationRepository(),
  backupRepository: new SqliteBackupRepository(),
  backupPropagationRepository: new SqliteBackupPropagationRepository(),
  backupQuarantineRepository: new SqliteBackupQuarantineRepository(),
  bootstrapRepository: new SqliteBootstrapRepository(),
  dashboardRepository: new SqliteDashboardRepository(),
  dataRepairRepository: new SqliteDataRepairRepository(),
  dataLifecycleRepository: new SqliteDataLifecycleRepository(),
  diagnosticRepository: new SqliteDiagnosticRepository(),
  entityCatalogRepository: new SqliteEntityCatalogRepository(),
  familyRepository: new SqliteFamilyRepository(),
  familyDataImportRepository: new SqliteFamilyDataImportRepository(),
  financeRepository: new SqliteFinanceRepository(),
  externalBackupInventoryRepository: new SqliteExternalBackupInventoryRepository(),
  genealogyRepository: new SqliteGenealogyRepository(),
  healthRepository: new SqliteHealthRepository(),
  householdMembershipRepository: new SqliteHouseholdMembershipRepository(),
  invitationRepository: new SqliteInvitationRepository(),
  legacyRepository: new SqliteLegacyRepository(),
  lifeRepository: new SqliteLifeRepository(),
  largeFamilyReadModelRepository: new SqliteLargeFamilyReadModelRepository(),
  locationRepository: new SqliteLocationRepository(),
  notificationStateRepository: new SqliteNotificationStateRepository(),
  objectPermissionRepository: new SqliteObjectPermissionRepository(),
  outboxRepository: new SqliteOutboxRepository(),
  personRepository: new SqlitePersonRepository(),
  personLifecycleRepository: new SqlitePersonLifecycleRepository(),
  platformPolicyTransactionRepository: new SqlitePlatformPolicyTransactionRepository(),
  relationRepository: new SqliteRelationRepository(),
  reportRepository: new SqliteReportRepository(),
  taskRepository: new SqliteTaskRepository(),
  timelineRepository: new SqliteTimelineRepository(),
  trustedDeviceRepository: new SqliteTrustedDeviceRepository(),
  windowsHelloRegistrationRepository: new SqliteWindowsHelloRegistrationRepository(),
});
