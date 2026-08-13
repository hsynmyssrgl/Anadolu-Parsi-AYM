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
  SqliteDerivedDataPolicyRepository,
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
  SqliteLongTermPortfolioRepository,
  SqliteLargeFamilyReadModelRepository,
  SqliteLocationRepository,
  SqliteNotificationStateRepository,
  SqliteObjectPermissionRepository,
  SqliteOfflineCapabilityLeaseRepository,
  SqliteOutboxRepository,
  SqlitePersonRepository,
  SqlitePersonLifecycleRepository,
  SqlitePlatformPolicyTransactionRepository,
  SqliteRelationRepository,
  SqliteReportRepository,
  SqliteTaskRepository,
  SqliteTimelineRepository,
  SqliteTrustedDeviceRepository,
  SqliteWindowsHelloRegistrationRepository,
  StaticProductSurfaceGovernanceRepository
} from '@ppt/repositories';
import type { RepositoryExecutionPolicyGuard, SqliteRepositoryOptions } from '@ppt/repositories';
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
  DerivedDataPolicyRepositoryPort,
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
  LongTermPortfolioRepository,
  LocationPolicyResourceRepositoryPort,
  LocationRepositoryPort,
  NotificationStateRepositoryPort,
  ObjectPermissionRepositoryPort,
  OfflineCapabilityLeaseRepositoryPort,
  OutboxRepositoryPort,
  PersonRepositoryPort,
  PersonLifecycleRepositoryPort,
  PlatformPolicyTransactionRepositoryPort,
  ProductSurfaceGovernanceRepositoryPort,
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
  readonly derivedDataPolicyRepository: DerivedDataPolicyRepositoryPort;
  readonly entityCatalogRepository: EntityCatalogRepositoryPort;
  readonly familyRepository: FamilyRepositoryPort;
  readonly familyDataImportRepository: FamilyDataImportRepositoryPort;
  readonly financeRepository: FinanceRepositoryPort & FinancePolicyResourceRepositoryPort;
  readonly longTermPortfolioRepository: LongTermPortfolioRepository;
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
  readonly offlineCapabilityLeaseRepository: OfflineCapabilityLeaseRepositoryPort;
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

export interface RepositoryCompositionRootOptions {
  readonly executionPolicyGuard?: RepositoryExecutionPolicyGuard;
}

export const createProductSurfaceGovernanceRepository = (): ProductSurfaceGovernanceRepositoryPort =>
  new StaticProductSurfaceGovernanceRepository();

export const createSqliteRepositoryCompositionRoot = (
  options: RepositoryCompositionRootOptions = {}
): RepositoryCompositionRoot => {
  const repositoryOptions: SqliteRepositoryOptions = options.executionPolicyGuard
    ? { executionPolicyGuard: options.executionPolicyGuard }
    : {};
  return {
    accountRepository: new SqliteAccountRepository(repositoryOptions),
    aiConsentRepository: new SqliteAiConsentRepository(repositoryOptions),
    archiveRepository: new SqliteArchiveRepository(repositoryOptions),
    auditRepository: new SqliteAuditRepository(repositoryOptions),
    automationRepository: new SqliteAutomationRepository(repositoryOptions),
    backupRepository: new SqliteBackupRepository(repositoryOptions),
    backupPropagationRepository: new SqliteBackupPropagationRepository(repositoryOptions),
    backupQuarantineRepository: new SqliteBackupQuarantineRepository(repositoryOptions),
    bootstrapRepository: new SqliteBootstrapRepository(repositoryOptions),
    dashboardRepository: new SqliteDashboardRepository(repositoryOptions),
    dataRepairRepository: new SqliteDataRepairRepository(repositoryOptions),
    dataLifecycleRepository: new SqliteDataLifecycleRepository(repositoryOptions),
    diagnosticRepository: new SqliteDiagnosticRepository(repositoryOptions),
    derivedDataPolicyRepository: new SqliteDerivedDataPolicyRepository(repositoryOptions),
    entityCatalogRepository: new SqliteEntityCatalogRepository(repositoryOptions),
    familyRepository: new SqliteFamilyRepository(repositoryOptions),
    familyDataImportRepository: new SqliteFamilyDataImportRepository(repositoryOptions),
    financeRepository: new SqliteFinanceRepository(repositoryOptions),
    longTermPortfolioRepository: new SqliteLongTermPortfolioRepository(repositoryOptions),
    externalBackupInventoryRepository: new SqliteExternalBackupInventoryRepository(repositoryOptions),
    genealogyRepository: new SqliteGenealogyRepository(repositoryOptions),
    healthRepository: new SqliteHealthRepository(repositoryOptions),
    householdMembershipRepository: new SqliteHouseholdMembershipRepository(repositoryOptions),
    invitationRepository: new SqliteInvitationRepository(repositoryOptions),
    legacyRepository: new SqliteLegacyRepository(repositoryOptions),
    lifeRepository: new SqliteLifeRepository(repositoryOptions),
    largeFamilyReadModelRepository: new SqliteLargeFamilyReadModelRepository(repositoryOptions),
    locationRepository: new SqliteLocationRepository(repositoryOptions),
    notificationStateRepository: new SqliteNotificationStateRepository(repositoryOptions),
    objectPermissionRepository: new SqliteObjectPermissionRepository(repositoryOptions),
    offlineCapabilityLeaseRepository: new SqliteOfflineCapabilityLeaseRepository(repositoryOptions),
    outboxRepository: new SqliteOutboxRepository(repositoryOptions),
    personRepository: new SqlitePersonRepository(repositoryOptions),
    personLifecycleRepository: new SqlitePersonLifecycleRepository(repositoryOptions),
    platformPolicyTransactionRepository: new SqlitePlatformPolicyTransactionRepository(repositoryOptions),
    relationRepository: new SqliteRelationRepository(repositoryOptions),
    reportRepository: new SqliteReportRepository(repositoryOptions),
    taskRepository: new SqliteTaskRepository(repositoryOptions),
    timelineRepository: new SqliteTimelineRepository(repositoryOptions),
    trustedDeviceRepository: new SqliteTrustedDeviceRepository(repositoryOptions),
    windowsHelloRegistrationRepository: new SqliteWindowsHelloRegistrationRepository(repositoryOptions),
  };
};
