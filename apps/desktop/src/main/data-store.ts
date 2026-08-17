import {
  SqliteAuditStorageProtectionCommandPort,
  SqliteBackupDatabaseSafetyPort,
  SqliteDatabaseMaintenanceCommandPort,
  SqliteDatabaseRuntimeHealthQueryPort
} from '@ppt/infrastructure';
import type { AsyncTransactionExecutor, DatabaseConnection } from '@ppt/contracts';
import type { MigrationRunSummary } from '@ppt/database';
import type {
  PlatformPolicyArchiveOperationMetadata,
  PlatformPolicyArchivePendingOperationMutation,
  PlatformPolicyArchivePendingOperationRecord,
  RepositoryExecutionContext
} from '@ppt/repository-contracts';
import { createHash, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { arch, platform } from 'node:os';
import {
  SystemClock,
  asCorrelationId,
  asEventId,
  asFamilyBranchId,
  asFamilyId,
  asHouseholdId,
  asIsoDate,
  asIsoDateTime,
  asPersonId,
  asMembershipId,
  asUserId,
  createAppError,
  err,
  ok,
  ERROR_CODES,
  type Clock,
  type CorrelationContextProvider
} from '@ppt/core';
import { EventDispatcher, createExponentialRetryPolicy, type DomainEvent, type EventDispatchBatchSummary, type EventDispatchStore } from '@ppt/events';
import type { Logger } from '@ppt/logging';
import {
  authorizationRoleMatches,
  canonicalizePrivacyDataExport,
  verifySignedPluginManifest,
  type TrustedPluginSigningKey
} from '@ppt/security';
import type { RepositoryExecutionPolicyGuard } from '@ppt/repositories';
import {
  AppendAuditEntryUseCase, type AuditWriteApplicationContext, GetLatestAuditOccurredAtUseCase, type AuditReadApplicationContext, InstallAuditStorageProtectionUseCase, ListAutomationRulesUseCase, CreateAutomationRuleUseCase, ToggleAutomationRuleUseCase, ListAutomationRunsUseCase, RunAutomationRulesUseCase, type AutomationApplicationContext, GetReportSummaryUseCase, type ReportApplicationContext,
  ChangePasswordUseCase,
  GetAuthStateUseCase,
  GetSessionLockStateUseCase,
  RecordSessionActivityUseCase,
  LockSessionUseCase,
  GetDesktopSecurityPostureUseCase,
  LoginUseCase,
  LogoutUseCase,
  SetupAdminUseCase,
  BeginTwoFactorSetupUseCase,
  EnableTwoFactorUseCase,
  DisableTwoFactorUseCase,
  TrustCurrentDeviceUseCase,
  ReauthorizeCurrentDeviceAfterRecoveryUseCase,
  RotateAccountSecurityEpochAfterRecoveryUseCase,
  isSessionSecurityEpochCurrent,
  ListTrustedDevicesUseCase,
  RevokeTrustedDeviceUseCase,
  InspectDatabaseRuntimeHealthUseCase,
  InspectSystemResourceSnapshotUseCase,
  ResolveFamilyStorageLayoutUseCase,
  RunDatabaseMaintenanceUseCase,
  PrepareBackupDatabaseUseCase,
  VerifyBackupDatabaseIntegrityUseCase,
  PrepareRestoredDatabaseForReauthorizationUseCase,
  GetBackupTargetFreeBytesUseCase,
  PrepareBackupTargetUseCase,
  CreateBackupArtifactPathUseCase,
  InspectBackupArtifactUseCase,
  DeleteBackupArtifactUseCase,
  ListBackupArtifactsUseCase,
  PrepareFullBackupDestinationUseCase,
  CreateFullBackupUseCase,
  InspectFullBackupUseCase,
  StageFullBackupRestoreUseCase,
  CommitFullBackupRestoreUseCase,
  DiscardFullBackupRestoreUseCase,
  StoreArchiveFileUseCase,
  MaterializeArchiveFileUseCase,
  ReadArchiveFileBytesUseCase,
  DestroyArchiveFileUseCase,
  WriteOperationalTextArtifactUseCase,
  WriteOperationalGzipArtifactUseCase,
  VerifyOperationalArtifactUseCase,
  ReadOperationalTextArtifactUseCase,
  ReadOperationalGzipArtifactUseCase,
  EvaluateAuthorizationUseCase,
  ListOfflineCapabilityLeasesUseCase,
  IssueOfflineCapabilityLeaseUseCase,
  RevokeOfflineCapabilityLeaseUseCase,
  GetPrivacyControlCenterUseCase,
  UpsertLiveLocationConsentUseCase,
  ShutdownLostDeviceAuthorityUseCase,
  ListObjectPermissionsUseCase,
  UpsertObjectPermissionUseCase,
  DeleteObjectPermissionUseCase,
  ListAuditEntriesUseCase, VerifyAuditIntegrityUseCase,
  RecordPerformanceSampleUseCase, ListPerformanceSamplesUseCase, GetPerformanceTrendUseCase, RecordDiagnosticUseCase, ListDiagnosticsUseCase, RecordSystemHealthHistoryUseCase, ListSystemHealthHistoryUseCase, ListSystemHealthHistorySinceUseCase, RecordMaintenanceHistoryUseCase, ListMaintenanceHistoryUseCase, SearchMaintenanceHistoryUseCase, GetMaintenancePolicyUseCase, UpsertMaintenancePolicyUseCase, ListHealthNotificationsUseCase, FindActiveHealthNotificationUseCase, RecordHealthNotificationUseCase, AttachHealthNotificationTaskUseCase, AcknowledgeHealthNotificationUseCase, GetOperationalHealthCountsUseCase, CleanupOperationalHealthUseCase, GetMaintenanceRecommendationsUseCase, RecordExportArtifactUseCase, ListExportArtifactsUseCase, FindExportArtifactUseCase, RecordDiagnosticReportUseCase, ListDiagnosticReportsUseCase, FindDiagnosticReportUseCase, RecordDiagnosticArchiveUseCase, ListDiagnosticArchivesUseCase, FindDiagnosticArchiveUseCase, DeleteDiagnosticsThroughUseCase, type OperationalHealthApplicationContext, ListBackupTargetsUseCase, FindBackupTargetUseCase, UpsertBackupTargetUseCase, ListBackupRunsUseCase, ListSuccessfulBackupRunsUseCase, ListEnabledBackupTargetIdsUseCase, ListDueBackupTargetIdsUseCase, RecordBackupRunUseCase, MarkBackupTargetSuccessUseCase, MarkBackupTargetFailureUseCase, DeleteBackupRunUseCase, type BackupApplicationContext, ListBackgroundTasksUseCase, StartBackgroundTaskUseCase, FinishBackgroundTaskUseCase, ListQueuedTasksUseCase, ListRunnableQueuedTasksUseCase, EnqueueTaskUseCase, DeferQueuedTaskUseCase, StartQueuedTaskUseCase, CompleteQueuedTaskUseCase, FailOrRetryQueuedTaskUseCase, type TaskApplicationContext,
  CreateFamilyMemberUseCase,
  CreateFamilyRelationUseCase,
  CreateHouseholdUseCase,
  CreateFamilyBranchUseCase,
  AssignPersonMembershipUseCase,
  EndPersonMembershipUseCase,
  GetHouseholdMembershipWorkspaceUseCase,
  UpdatePersonProfileUseCase,
  ArchivePersonProfileUseCase,
  MergePersonProfileUseCase,
  RequestSafePersonDeletionUseCase,
  UndoPersonLifecycleOperationUseCase,
  GetPersonLifecycleWorkspaceUseCase,
  ScanDataRepairIssuesUseCase,
  PreviewDataRepairUseCase,
  ApplyDataRepairUseCase,
  UndoDataRepairUseCase,
  GetDataRepairWorkspaceUseCase,
  GetFamilyGraphUseCase,
  GetGenealogyReadModelUseCase,
  GetImportantDayDetailsUseCase,
  GetTimelineReadModelUseCase,
  CreateImportantDayUseCase,
  CreateGovernedFamilyLocationUseCase,
  GetDashboardOverviewUseCase,
  CreateFamilyInvitationUseCase,
  ListFamilyInvitationsUseCase,
  InspectFamilyInvitationUseCase,
  RevokeFamilyInvitationUseCase,
  ResendFamilyInvitationUseCase,
  AcceptFamilyInvitationUseCase,
  ListFamilyAccountsUseCase,
  UpdateFamilyAccountUseCase,
  UpdateImportantDayParticipantsUseCase,
  UpdateImportantDayInvitationUseCase,
  UpdateImportantDayNotesUseCase,
  UpdateFamilyEventUseCase,
  SetFamilyEventArchivedUseCase,
  ListArchivedTimelineEventsUseCase,
  AcknowledgeTimelineNotificationUseCase,
  ListHealthRecordsUseCase,
  CreateHealthRecordUseCase,
  ListMedicationPlansUseCase,
  CreateMedicationPlanUseCase,
  ListFamilyHealthHistoryUseCase,
  CreateFamilyHealthHistoryUseCase,
  GetHealthCareCoordinationCenterUseCase,
  RecordHealthCareEntryUseCase,
  UpsertHealthCareAccessGrantUseCase,
  RevokeHealthCareAccessGrantUseCase,
  GetHouseholdOperationsCenterUseCase,
  CreateHouseholdOperationItemUseCase,
  UpdateHouseholdOperationItemUseCase,
  DeleteHouseholdOperationItemUseCase,
  GetChildEducationCenterUseCase,
  CreateChildEducationItemUseCase,
  UpdateChildEducationItemUseCase,
  DeleteChildEducationItemUseCase,
  GetPlacesTravelCenterUseCase,
  CreatePlacesTravelItemUseCase,
  UpdatePlacesTravelItemUseCase,
  DeletePlacesTravelItemUseCase,
  GetFamilyAiAssistantCenterUseCase,
  GenerateFamilyAiSuggestionUseCase,
  ReviewFamilyAiSuggestionUseCase,
  GetMemoryStudioCenterUseCase,
  CreateMemoryStudioRecordUseCase,
  DeleteMemoryStudioRecordUseCase,
  CreateMemoryTimeCapsuleUseCase,
  ReviewMemoryTimeCapsuleUseCase,
  TransitionMemoryTimeCapsuleUseCase,
  GetSmartHomeEnergyCenterUseCase,
  RegisterSmartHomeDeviceUseCase,
  UpdateSmartHomeDeviceStatusUseCase,
  RecordSmartHomeObservationUseCase,
  GrantSmartHomeCameraConsentUseCase,
  RevokeSmartHomeCameraConsentUseCase,
  SetSmartHomeProcessingUseCase,
  GetSignedPluginPlatformCenterUseCase,
  RegisterSignedPluginReleaseUseCase,
  SetSignedPluginDesiredStateUseCase,
  EmergencyDisableSignedPluginUseCase,
  RollbackSignedPluginUseCase,
  GetCommunicationSecurityCenterUseCase,
  RegisterCommunicationDeviceCredentialUseCase,
  RevokeCommunicationDeviceCredentialUseCase,
  CreateCommunicationRoomUseCase,
  AddCommunicationRoomMemberUseCase,
  RemoveCommunicationRoomMemberUseCase,
  RekeyCommunicationRoomAfterDeviceRevocationUseCase,
  SetCommunicationHistoryAccessUseCase,
  FreezeCommunicationRoomUseCase,
  GetCommunicationMessagingCenterUseCase,
  SearchCommunicationMessagesUseCase,
  GetCommunicationMessageContentUseCase,
  CreateCommunicationMessageUseCase,
  EditCommunicationMessageUseCase,
  SetCommunicationMessageLifecycleUseCase,
  AnnotateCommunicationMessageUseCase,
  UpdateCommunicationDeliveryUseCase,
  SetCommunicationPresenceUseCase,
  SetCommunicationRetentionPolicyUseCase,
  MaintainCommunicationMessagePayloadVaultUseCase,
  GetCommunicationRealtimeCallingCenterUseCase,
  CreateCommunicationCallUseCase,
  RunCommunicationCallPreflightUseCase,
  UpdateCommunicationCallControlsUseCase,
  AdvanceCommunicationCallUseCase,
  SetCommunicationCallPreferencesUseCase,
  GetCommunicationRecordingCenterUseCase,
  CreateCommunicationRecordingRequestUseCase,
  DecideCommunicationRecordingConsentUseCase,
  WithdrawCommunicationRecordingConsentUseCase,
  AddCommunicationRecordingLateJoinerUseCase,
  SetCommunicationRecordingSegmentUseCase,
  UpdateCommunicationRecordingRetentionUseCase,
  RequestCommunicationRecordingDeletionUseCase,
  GetLocalTranslationCenterUseCase,
  UpdateLocalTranslationProfileUseCase,
  AddLocalTranslationDictionaryEntryUseCase,
  UpdateLocalTranslationDictionaryEntryUseCase,
  DeleteLocalTranslationDictionaryEntryUseCase,
  PrepareLocalTranslationRequestUseCase,
  RecordLocalTranslationCorrectionUseCase,
  CancelLocalTranslationRequestUseCase,
  GetFamilyMeetingCenterUseCase,
  GetFamilyMeetingMinutesUseCase,
  CreateFamilyMeetingUseCase,
  UpdateFamilyMeetingPlanUseCase,
  SetFamilyMeetingStateUseCase,
  UpsertFamilyMeetingParticipantUseCase,
  UpsertFamilyMeetingAgendaItemUseCase,
  CreateFamilyMeetingPollUseCase,
  CastFamilyMeetingVoteUseCase,
  RecordFamilyMeetingDecisionUseCase,
  UpsertFamilyMeetingTaskUseCase,
  AddFamilyMeetingCollaborationUseCase,
  PrepareFamilyMeetingAiMinutesUseCase,
  FinalizeFamilyMeetingMinutesUseCase,
  unavailableFamilyMeetingAiMinutesProvider,
  ApplyCommunicationFileSharingCommandUseCase,
  GetCommunicationFileSharingCenterUseCase,
  GetCommunicationFileSafePreviewUseCase,
  MaintainCommunicationFilePayloadVaultUseCase,
  PrepareCommunicationFileUseCase,
  GetCommunicationAuditArchiveSafeCenterUseCase,
  type CommunicationFilePayloadPort,
  type CommunicationCallPreflightPort,
  ListLifeRecordsUseCase,
  CreateLifeRecordUseCase,
  GetManagedLifeWorkspaceUseCase,
  RecordManagedLifeItemUseCase,
  PrepareFamilyEmergencyCardExportUseCase,
  RecordFamilyEmergencyCardExportCompletionUseCase,
  createFamilyEmergencyCardExportAuthorizationProof,
  familyEmergencyCardSelectionSha256,
  type PreparedFamilyEmergencyCardExport,
  ListFinanceRecordsUseCase,
  CreateFinanceRecordUseCase,
  ListFinanceValuationsUseCase,
  CreateFinanceValuationUseCase,
  ListBankInstitutionsUseCase,
  ListBankAccountsUseCase,
  ValidateIbanUseCase,
  CreateBankAccountUseCase,
  ListPaymentCardsUseCase,
  CreatePaymentCardUseCase,
  ListLoanAccountsUseCase,
  CreateLoanAccountUseCase,
  RecordLoanPaymentUseCase,
  GetFinancePlanningWorkspaceUseCase,
  RecordFinancePlanningItemUseCase,
  CommitFinanceImportBatchUseCase,
  GetLongTermPortfolioWorkspaceUseCase,
  RecordLongTermPortfolioItemUseCase,
  GetAccessibilityPreferencesUseCase,
  UpdateAccessibilityPreferencesUseCase,
  GetFormDraftWorkspaceUseCase,
  SaveFormDraftUseCase,
  UndoFormDraftUseCase,
  GetPrivacyOwnershipControlCenterUseCase,
  ManageAiMemoryUseCase,
  ManageDataRightsRequestUseCase,
  FinalizeEncryptedPrivacyExportUseCase,
  ManagePrivacyIncidentUseCase,
  SimulatePermissionVisibilityUseCase,
  ListArchiveItemsUseCase,
  SearchArchiveItemsUseCase,
  SearchUnifiedAuthorizedRecordsUseCase,
  PrepareArchiveOpenUseCase,
  RecordArchiveOpenedUseCase,
  AuthorizeEmergencyArchiveReadUseCase,
  ListArchiveVersionsUseCase,
  ListArchiveRelationEvidenceUseCase,
  ListArchiveRelationEvidenceHistoryUseCase,
  AddArchiveRelationEvidenceUseCase,
  RemoveArchiveRelationEvidenceUseCase,
  AddArchiveItemVersionUseCase,
  ImportArchiveItemUseCase,
  ListArchiveRetentionPoliciesUseCase,
  ListArchiveRetentionStatusUseCase,
  CreateArchiveRetentionPolicyUseCase,
  AssignArchiveRetentionPolicyUseCase,
  PrepareArchiveDestructionUseCase,
  MarkArchiveDestroyedUseCase,
  ReattestLegacyArchiveOwnershipUseCase,
  GetLocalGovernedOcrCenterUseCase,
  GetLocalGovernedOcrResultUseCase,
  SearchLocalGovernedOcrUseCase,
  CreateLocalGovernedOcrJobUseCase,
  RunLocalGovernedOcrJobUseCase,
  CancelLocalGovernedOcrJobUseCase,
  CorrectLocalGovernedOcrResultUseCase,
  RerunLocalGovernedOcrJobUseCase,
  DeleteLocalGovernedOcrJobUseCase,
  ReconcileLocalGovernedOcrAuthorizationUseCase,
  ReconcileLocalGovernedOcrRetentionUseCase,
  SweepLocalGovernedOcrOrphansUseCase,
  SetLocalGovernedOcrEnabledUseCase,
  PropagateLocalGovernedOcrSourceDeletionUseCase,
  localGovernedOcrSettingsResourceId,
  ListArchiveCategoriesUseCase, ListAiConsentsUseCase, UpsertAiConsentUseCase, PreviewAiAccessUseCase,
  ListSensitiveDataProfilesUseCase, UpsertSensitiveDataConsentUseCase, PreviewSensitiveExportUseCase,
  ListArchiveClassificationsUseCase,
  CreateArchiveCategoryUseCase,
  UpdateArchiveClassificationUseCase,
  ListDigitalLegacyPlansUseCase, ListLegacyGrantsUseCase, ListLegacyApprovalsUseCase, UpsertDigitalLegacyPlanUseCase, UpsertLegacyGrantUseCase, RequestLegacyExecutionUseCase, ApproveLegacyExecutionUseCase, FinalizeLegacyExecutionUseCase, CancelLegacyExecutionUseCase,
  type AuthApplicationContext,
  type AuthSessionPort,
  type AuthorizationApplicationContext,
  type CurrentDeviceContext,
  type DashboardApplicationContext,
  type FamilyApplicationContext,
  type HouseholdMembershipApplicationContext,
  type PersonLifecycleApplicationContext,
  type DataRepairApplicationContext,
  type HealthApplicationContext,
  type LifeApplicationContext,
  type FinanceApplicationContext,
  type LongTermPortfolioApplicationContext,
  type AccessibilityPreferencesApplicationContext,
  type FormDraftApplicationContext,
  type PrivacyOwnershipApplicationContext,
  type ArchiveApplicationContext,
  type LegacyApplicationContext,
  type MembershipApplicationContext,
  type LocationApplicationContext,
  type TimelineApplicationContext,
  type LocalGovernedOcrApplicationContext,
  type UnifiedAuthorizedSearchApplicationContext,
  type LocalGovernedOcrOperationIdentifiers,
  type LocalGovernedOcrRuntimePort,
  type CommunicationMlsFoundationPort,
  type CommunicationMessagePayloadPort,
  type FamilyMeetingMinutesArtifactPort,
  ListDataRetentionPoliciesUseCase,
  ListDataLifecycleRecordsUseCase,
  CreateDataRetentionPolicyUseCase,
  ArchiveDataResourceUseCase,
  RestoreDataResourceUseCase,
  RequestDataPurgeUseCase,
  CancelDataPurgeUseCase,
  ExecuteDataPurgeUseCase,
  EnforceSourceDeletionPropagationUseCase,
  SetDataLegalHoldUseCase,
  ListPendingBackupPropagationUseCase,
  ListBackupPropagationRunsUseCase,
  CompleteBackupPropagationUseCase,
  RecordBackupPropagationRunUseCase,
  GetBackupCleanRewritePolicyUseCase,
  ListBackupCleanRewriteRunsUseCase,
  UpdateBackupCleanRewritePolicyUseCase,
  ClaimBackupCleanRewriteUseCase,
  CompleteBackupCleanRewriteUseCase,
  RecoverInterruptedBackupCleanRewriteUseCase,
  executeManagedBackupPropagation,
  QuarantineManagedBackupArtifactsUseCase,
  GetBackupQuarantinePolicyUseCase,
  ListBackupQuarantineBatchesUseCase,
  RegisterBackupQuarantineBatchUseCase,
  UpdateBackupQuarantinePolicyUseCase,
  SetBackupQuarantineLegalHoldUseCase,
  DestroyBackupQuarantineBatchUseCase,
  ListExternalBackupCopiesUseCase,
  GetExternalBackupInventorySummaryUseCase,
  RegisterExternalBackupCopyUseCase,
  ReviewExternalBackupCopyUseCase,
  SetExternalBackupCopyLegalHoldUseCase,
  AttestExternalBackupCopyDestroyedUseCase,
  ListExternalBackupEvidenceIssuersUseCase,
  ListExternalBackupEvidenceIssuerRotationsUseCase,
  ListExternalBackupDestructionEvidenceUseCase,
  RegisterExternalBackupEvidenceIssuerUseCase,
  RotateExternalBackupEvidenceIssuerUseCase,
  RevokeExternalBackupEvidenceIssuerUseCase,
  VerifyExternalBackupDestructionEvidenceUseCase,
  ListExternalBackupEvidenceRevocationListsUseCase,
  ApplyExternalBackupEvidenceRevocationListUseCase,
  ListExternalBackupRevocationEndpointsUseCase,
  FindExternalBackupRevocationEndpointUseCase,
  UpsertExternalBackupRevocationEndpointUseCase,
  RecordExternalBackupRevocationEndpointFetchUseCase,
  type DataLifecycleApplicationContext,
  type BackupPropagationApplicationContext,
  type BackupQuarantineApplicationContext,
  type ExternalBackupInventoryApplicationContext,
  type StrongAuthenticationPort,
  GetWindowsHelloStateUseCase,
  EnrollWindowsHelloUseCase,
  LoginWithWindowsHelloUseCase,
  ReauthenticateWithWindowsHelloUseCase,
  type WindowsHelloPlatformPort,
  type WindowsHelloDeviceBindingPort
} from '@ppt/application';
import type { AddArchiveItemVersionInput, AddArchiveRelationEvidenceInput, ArchiveRelationEvidenceHistoryView, ArchiveRelationEvidenceView, ChildEducationCenterView, ChildEducationMutationReceiptView, CreateChildEducationItemInput, CreateHouseholdOperationItemInput, DeleteChildEducationItemInput, DeleteHouseholdOperationItemInput, HealthCareCoordinationCenterView, HealthCareMutationReceiptView, HouseholdOperationMutationReceiptView, HouseholdOperationsCenterView, RecordHealthCareEntryInput, RemoveArchiveRelationEvidenceInput, RevokeHealthCareAccessGrantInput, UnifiedAuthorizedSearchInput, UnifiedAuthorizedSearchView, UpdateChildEducationItemInput, UpdateHouseholdOperationItemInput, UpsertHealthCareAccessGrantInput } from '@ppt/domain';
import type { CreatePlacesTravelItemInput, DeletePlacesTravelItemInput, PlacesTravelCenterView, PlacesTravelMutationReceiptView, UpdatePlacesTravelItemInput } from '@ppt/domain';
import type { FamilyAiAssistantCenterView, FamilyAiSuggestionMutationReceiptView, GenerateFamilyAiSuggestionInput, ReviewFamilyAiSuggestionInput } from '@ppt/domain';
import type { CreateMemoryStudioRecordInput, DeleteMemoryStudioRecordInput, CreateMemoryTimeCapsuleInput, MemoryStudioCenterView, MemoryStudioMutationReceiptView, ReviewMemoryTimeCapsuleInput, TransitionMemoryTimeCapsuleInput } from '@ppt/domain';
import type { GrantSmartHomeCameraConsentInput, RecordSmartHomeObservationInput, RegisterSmartHomeDeviceInput, RevokeSmartHomeCameraConsentInput, SetSmartHomeProcessingInput, SmartHomeEnergyCenterView, SmartHomeMutationReceiptView, UpdateSmartHomeDeviceStatusInput } from '@ppt/domain';
import type { EmergencyDisableSignedPluginInput, RollbackSignedPluginInput, SetSignedPluginDesiredStateInput, SignedPluginMutationReceiptView, SignedPluginPlatformCenterView, VerifiedSignedPluginReleaseInput } from '@ppt/domain';
import { APP_META } from '@ppt/domain';
import type {
  AddCommunicationRoomMemberInput,
  CommunicationSecurityCenterView,
  CommunicationSecurityMutationReceiptView,
  CreateCommunicationRoomInput,
  FreezeCommunicationRoomInput,
  RekeyCommunicationRoomAfterDeviceRevocationInput,
  RemoveCommunicationRoomMemberInput,
  RevokeCommunicationDeviceCredentialInput,
  SetCommunicationHistoryAccessInput
} from '@ppt/domain';
import type {
  CommunicationAuditArchiveSafeCenterView,
  CommunicationFileSharingCenterView,
  CommunicationFileSharingCommand,
  CommunicationFileSharingMutationReceiptView,
  CommunicationFileSharingRendererCenterView,
  CommunicationFileSharingRendererMutationReceiptView,
  CommunicationFileSafePreviewView,
  CommunicationFilePayloadMaintenanceView
} from '@ppt/domain';
import type {
  AddFamilyMeetingCollaborationInput,
  CastFamilyMeetingVoteInput,
  CreateFamilyMeetingInput,
  CreateFamilyMeetingPollInput,
  FamilyMeetingCenterView,
  FamilyMeetingMinutesContentView,
  FamilyMeetingMutationReceiptView,
  FinalizeFamilyMeetingMinutesInput,
  PrepareFamilyMeetingAiMinutesInput,
  RecordFamilyMeetingDecisionInput,
  SetFamilyMeetingStateInput,
  UpdateFamilyMeetingPlanInput,
  UpsertFamilyMeetingAgendaItemInput,
  UpsertFamilyMeetingParticipantInput,
  UpsertFamilyMeetingTaskInput
} from '@ppt/domain';
import type {
  AddLocalTranslationDictionaryEntryInput,
  CancelLocalTranslationRequestInput,
  DeleteLocalTranslationDictionaryEntryInput,
  LocalTranslationCenterView,
  LocalTranslationMutationReceiptView,
  PrepareLocalTranslationRequestInput,
  RecordLocalTranslationCorrectionInput,
  UpdateLocalTranslationDictionaryEntryInput,
  UpdateLocalTranslationProfileInput
} from '@ppt/domain';
import type {
  AnnotateCommunicationMessageInput,
  CommunicationMessageContentView,
  CommunicationMessageView,
  CommunicationMessagingCenterView,
  CommunicationMessagingMaintenanceView,
  CommunicationMessagingMutationReceiptView,
  CreateCommunicationMessageInput,
  EditCommunicationMessageInput,
  SearchCommunicationMessagesInput,
  SetCommunicationMessageLifecycleInput,
  SetCommunicationPresenceInput,
  SetCommunicationRetentionPolicyInput,
  UpdateCommunicationDeliveryInput
} from '@ppt/domain';
import type {
  AdvanceCommunicationCallInput,
  CommunicationRealtimeCallingCenterView,
  CommunicationRealtimeCallingMutationReceiptView,
  CreateCommunicationCallInput,
  RunCommunicationCallPreflightInput,
  SetCommunicationCallPreferencesInput,
  UpdateCommunicationCallControlsInput
} from '@ppt/domain';
import type {
  AddCommunicationRecordingLateJoinerInput,
  CommunicationRecordingCenterView,
  CommunicationRecordingMutationReceiptView,
  CreateCommunicationRecordingRequestInput,
  DecideCommunicationRecordingConsentInput,
  RequestCommunicationRecordingDeletionInput,
  SetCommunicationRecordingSegmentInput,
  UpdateCommunicationRecordingRetentionInput,
  WithdrawCommunicationRecordingConsentInput
} from '@ppt/domain';
import { RepositoryBackedFamilyApplicationUnitOfWork, RepositoryBackedFamilyGraphQueryPort } from './family-application-adapter.js';
import { RepositoryBackedHouseholdMembershipUnitOfWork } from './household-membership-application-adapter.js';
import { RepositoryBackedPersonLifecycleUnitOfWork } from './person-lifecycle-application-adapter.js';
import { RepositoryBackedDataRepairUnitOfWork } from './data-repair-application-adapter.js';
import { RepositoryBackedGenealogyReadModelQueryPort } from './genealogy-application-adapter.js';
import {
  RepositoryBackedTimelineApplicationUnitOfWork,
  RepositoryBackedTimelinePolicyTransactionRunner,
  RepositoryBackedTimelineQueryPort,
  failClosedTimelinePolicyEnforcementPointResolver,
  nonWritableTimelineClusterFence,
  type TimelinePolicyEnforcementPointResolver
} from './timeline-application-adapter.js';
import { RepositoryBackedAccessibilityPreferencesUnitOfWork } from './accessibility-preferences-application-adapter.js';
import { RepositoryBackedFormDraftUnitOfWork } from './form-draft-application-adapter.js';
import { RepositoryBackedDashboardQueryPort } from './dashboard-application-adapter.js';
import { RepositoryBackedAuthApplicationUnitOfWork } from './auth-application-adapter.js';
import {
  PowerShellWindowsHelloPlatformAdapter,
  type WindowsHelloWindowHandleProvider
} from './windows-hello-platform-adapter.js';
import { RepositoryBackedAuthorizationQueryPort, RepositoryBackedAuthorizationUnitOfWork } from './authorization-application-adapter.js';
import { RepositoryBackedMembershipQueryPort, RepositoryBackedMembershipUnitOfWork } from './membership-application-adapter.js';
import {
  RepositoryBackedHealthQueryPort,
  RepositoryBackedHealthCareCoordinationUnitOfWork,
  RepositoryBackedHealthUnitOfWork,
  failClosedHealthPolicyEnforcementPointResolver,
  nonWritableHealthClusterFence,
  type HealthPolicyEnforcementPointResolver
} from './health-application-adapter.js';
import {
  RepositoryBackedLifePolicyTransactionRunner,
  RepositoryBackedLifeQueryPort,
  RepositoryBackedLifeUnitOfWork,
  failClosedLifePolicyEnforcementPointResolver,
  nonWritableLifeClusterFence,
  type LifePolicyEnforcementPointResolver
} from './life-application-adapter.js';
import {
  RepositoryBackedHouseholdOperationsQueryPort,
  RepositoryBackedHouseholdOperationsUnitOfWork
} from './household-operations-application-adapter.js';
import {
  RepositoryBackedChildEducationCoordinationUnitOfWork,
  RepositoryBackedChildEducationQueryPort
} from './child-education-coordination-application-adapter.js';
import {
  RepositoryBackedPlacesTravelAssetPetUnitOfWork,
  RepositoryBackedPlacesTravelQueryPort
} from './places-travel-asset-pet-application-adapter.js';
import {
  RepositoryBackedFamilyAiAssistantQueryPort,
  RepositoryBackedFamilyAiAssistantSourcePort,
  RepositoryBackedFamilyAiAssistantUnitOfWork
} from './family-ai-assistant-application-adapter.js';
import {
  RepositoryBackedMemoryStudioQueryPort,
  RepositoryBackedMemoryStudioUnitOfWork
} from './memory-studio-application-adapter.js';
import {
  RepositoryBackedSmartHomeEnergyQueryPort,
  RepositoryBackedSmartHomeEnergyUnitOfWork
} from './smart-home-energy-application-adapter.js';
import {
  RepositoryBackedSignedPluginPlatformQueryPort,
  RepositoryBackedSignedPluginPlatformUnitOfWork
} from './signed-plugin-platform-application-adapter.js';
import {
  RepositoryBackedCommunicationSecurityQueryPort,
  RepositoryBackedCommunicationSecurityUnitOfWork
} from './communication-security-application-adapter.js';
import {
  RepositoryBackedCommunicationMessagingQueryPort,
  RepositoryBackedCommunicationMessagingUnitOfWork
} from './communication-messaging-application-adapter.js';
import {
  RepositoryBackedCommunicationAuditArchiveQueryPort
} from './communication-audit-archive-application-adapter.js';
import {
  RepositoryBackedCommunicationFileSharingQueryPort,
  RepositoryBackedCommunicationFileSharingUnitOfWork
} from './communication-file-sharing-application-adapter.js';
import {
  RepositoryBackedCommunicationRealtimeCallingQueryPort,
  RepositoryBackedCommunicationRealtimeCallingUnitOfWork
} from './communication-realtime-calling-application-adapter.js';
import {
  RepositoryBackedCommunicationRecordingQueryPort,
  RepositoryBackedCommunicationRecordingUnitOfWork
} from './communication-recording-retention-application-adapter.js';
import {
  RepositoryBackedLocalTranslationQueryPort,
  RepositoryBackedLocalTranslationUnitOfWork
} from './local-translation-language-application-adapter.js';
import {
  RepositoryBackedFamilyMeetingQueryPort,
  RepositoryBackedFamilyMeetingRecordingConsentPort,
  RepositoryBackedFamilyMeetingUnitOfWork
} from './family-meeting-application-adapter.js';
import { CommunicationMessagePayloadVault } from './communication-message-payload-vault.js';
import {
  CommunicationFilePayloadVault,
  type CommunicationFileMalwareScannerPort
} from './communication-file-payload-vault.js';
import { FamilyMeetingMinutesVault } from './family-meeting-minutes-vault.js';
import {
  RepositoryBackedLocationPolicyTransactionRunner,
  RepositoryBackedLocationUnitOfWork,
  failClosedLocationPolicyEnforcementPointResolver,
  nonWritableLocationClusterFence,
  type LocationPolicyEnforcementPointResolver
} from './location-application-adapter.js';
import { RepositoryBackedOperationalHealthAdapter } from './operational-health-application-adapter.js';
import { RepositoryBackedBackupAdapter } from './backup-application-adapter.js';
import { RepositoryBackedTaskAdapter } from './task-application-adapter.js';
import {
  RepositoryBackedFinanceQueryPort,
  RepositoryBackedFinanceUnitOfWork,
  failClosedFinancePolicyEnforcementPointResolver,
  nonWritableFinanceClusterFence,
  type FinancePolicyEnforcementPointResolver
} from './finance-application-adapter.js';
import {
  RepositoryBackedLongTermPortfolioQueryPort,
  RepositoryBackedLongTermPortfolioUnitOfWork
} from './long-term-portfolio-application-adapter.js';
import {
  RepositoryBackedArchiveQueryPort,
  RepositoryBackedArchiveUnitOfWork,
  failClosedArchivePolicyEnforcementPointResolver,
  nonWritableArchiveClusterFence,
  type ArchivePolicyEnforcementPointResolver
} from './archive-application-adapter.js';
import { RepositoryBackedUnifiedAuthorizedSearchSourcePort } from './unified-authorized-search-application-adapter.js';
import {
  PlatformPolicyEnforcementError,
  SensitiveLogPolicy,
  SourceDeletionPropagationPolicy,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyClusterFence,
  type PlatformPolicyConnectionAuthority,
  type PlatformPolicyReceiptSink
} from '@ppt/platform-policy';
import { createArchiveProductionPolicyEnforcementPointResolver } from './archive-production-policy-runtime.js';
import { createFinanceProductionPolicyEnforcementPointResolver } from './finance-production-policy-runtime.js';
import { createHealthProductionPolicyEnforcementPointResolver } from './health-production-policy-runtime.js';
import { createLifeProductionPolicyEnforcementPointResolver } from './life-production-policy-runtime.js';
import { createLocationProductionPolicyEnforcementPointResolver } from './location-production-policy-runtime.js';
import {
  createLocalGovernedOcrProductionPolicyEnforcementPointResolver,
  createTimelineProductionPolicyEnforcementPointResolver,
  type LocalGovernedOcrProductionPolicyEnforcementPointResolver
} from './timeline-production-policy-runtime.js';
import { RepositoryBackedDataLifecycleQueryPort, RepositoryBackedDataLifecycleUnitOfWork, RepositoryBackedStrongAuthenticationPort } from './data-lifecycle-application-adapter.js';
import {
  DesktopSourceDeletionRuntimeCacheInvalidationPort,
  type DesktopSourceDeletionExternalCacheInvalidator
} from './source-deletion-propagation-application-adapter.js';
import { RepositoryBackedBackupPropagationAdapter } from './backup-propagation-application-adapter.js';
import { RepositoryBackedBackupQuarantineAdapter } from './backup-quarantine-application-adapter.js';
import { RepositoryBackedExternalBackupInventoryAdapter } from './external-backup-inventory-application-adapter.js';
import { NodeExternalBackupEvidenceCryptoAdapter } from './external-backup-evidence-crypto-adapter.js';
import { FileSystemBackupPurgeQuarantinePort } from './backup-purge-propagation-file-application-adapter.js';
import { FileSystemBackupQuarantineDestructionPort } from './backup-quarantine-file-application-adapter.js';
import { RepositoryBackedAiConsentQueryPort, RepositoryBackedAiConsentUnitOfWork, RepositoryBackedSensitiveDataAuthorizationPort } from './ai-consent-application-adapter.js';
import { RepositoryBackedPrivacyControlQueryPort, RepositoryBackedPrivacyControlUnitOfWork } from './privacy-control-application-adapter.js';
import { RepositoryBackedPrivacyOwnershipDataRightsUnitOfWork } from './privacy-ownership-data-rights-application-adapter.js';
import {
  RepositoryBackedIdentityAccessCredentialUnitOfWork,
  type IdentityAccessCredentialQuotaPort,
  type IdentityAccessExternalSecurityPorts,
  type IdentityAccessFederatedVaultControlPort,
  type IdentityAccessPolicyTransactionRunner
} from './identity-access-credential-application-adapter.js';
import { RepositoryBackedLegacyQueryPort, RepositoryBackedLegacyUnitOfWork } from './legacy-application-adapter.js';
import { RepositoryBackedAutomationAdapter } from './automation-application-adapter.js';
import { RepositoryBackedReportQueryPort } from './report-application-adapter.js';
import { RepositoryBackedAuditReadQueryPort } from './audit-read-application-adapter.js';
import { RepositoryBackedAuditWriteCommandPort } from './audit-write-application-adapter.js';
import { FileSystemBackupTargetFilePort } from './backup-target-file-application-adapter.js';
import {
  FileSystemFullBackupFilePort,
  recoverInterruptedFullBackupRestore
} from './full-backup-file-application-adapter.js';
import { FileSystemArchiveVaultFilePort } from './archive-vault-file-application-adapter.js';
import { RepositoryBackedLocalGovernedOcrUnitOfWork } from './local-governed-ocr-application-adapter.js';
import { createWindowsLocalGovernedOcrRuntimeAdapter } from './local-governed-ocr-runtime-adapter.js';
import { LocalGovernedOcrResultVault } from './local-governed-ocr-result-vault.js';
import { FileSystemOperationalArtifactFilePort } from './operational-artifact-file-application-adapter.js';
import { writePrivacyDataExportFile, type PrivacyDataExportFileResult } from './privacy-data-export-service.js';
import type { OperationalArtifactFilePort } from '@ppt/application';
import { NodeSystemResourceSnapshotPort } from './system-resource-snapshot-application-adapter.js';
import { NodeFamilyStorageLayoutPort } from './family-storage-layout-application-adapter.js';
import { NodeInvitationTokenService } from './invitation-token-application-adapter.js';
import { createFamilyMemberCreatedDiagnosticHandler, createFamilyMemberCreatedLogHandler, createFamilyRelationCreatedDiagnosticHandler, createFamilyRelationCreatedLogHandler, createImportantDayCreatedDiagnosticHandler, createImportantDayCreatedLogHandler, type FamilyMemberCreatedPayload } from './event-handlers.js';
import type {
  CreateFamilyEventInput,
  CreateFamilyLocationInput,
  CreateFamilyMemberInput,
  CreateHouseholdInput,
  CreateFamilyBranchInput,
  AssignPersonMembershipInput,
  Household,
  FamilyBranch,
  PersonMembership,
  HouseholdMembershipWorkspaceView,
  PersonLifecycleProfile,
  PersonLifecycleWorkspaceView,
  UpdatePersonProfileInput,
  DataRepairIssue,
  DataRepairOperation,
  DataRepairWorkspaceView,
  DashboardOverviewView,
  FamilyAppSnapshot,
  FamilySnapshotSectionsInput,
  FamilySnapshotPatchView,
  FamilyMutationResultView,
  FamilyEventView,
  FamilyLocationView,
  FamilyMemberView,
  FamilyNotificationView,
  FamilyRelationView,
  ArchiveItemView, AuthStateView, CreateArchiveItemInput, CreateFamilyRelationInput, LoginInput, SetupAdminInput, ChangePasswordInput, AuditEntryView, TwoFactorSetupView, EnableTwoFactorInput, DisableTwoFactorInput, TrustCurrentDeviceInput, ReauthorizeCurrentDeviceInput, ReauthorizeCurrentDeviceResultView, SecurityEventReceiptArchiveItemView, SecurityEventReceiptVerificationView, TrustedDeviceView, FamilyAccountView, FamilyInvitationView, FamilyInvitationInspectionView, CreateFamilyInvitationInput, InspectFamilyInvitationInput, ResendFamilyInvitationInput, AcceptFamilyInvitationInput, UpdateEventParticipantsInput, UpdateEventInvitationInput, UpdateEventNotesInput, UpdateFamilyEventInput, SetFamilyEventArchivedInput, AcknowledgeFamilyNotificationInput, ObjectPermissionView, UpsertObjectPermissionInput, AuthorizationPurpose, AuthorizationContextWorkspaceView, UpdateFamilyAccountInput, FamilyRole, FinanceRecordView, CreateFinanceRecordInput, BankInstitutionView, BankAccountView, CreateBankAccountInput, IbanStructuralValidationView, ValidateIbanInput, PaymentCardView, CreatePaymentCardInput, HealthRecordView, CreateHealthRecordInput, MedicationPlanView, CreateMedicationPlanInput, FamilyHealthHistoryView, CreateFamilyHealthHistoryInput, FinanceValuationView, CreateFinanceValuationInput, LifeRecordView, CreateLifeRecordInput, AutomationRuleView, CreateAutomationRuleInput, ReportSummaryView, GenealogyInsightView, ArchiveCategoryView, ArchiveClassificationView, CreateArchiveCategoryInput, UpdateArchiveClassificationInput, AiConsentView, UpsertAiConsentInput, AiAccessPreviewView, SensitiveDataProfileView, UpsertSensitiveDataConsentInput, SensitiveExportPreviewInput, SensitiveExportPreviewView, AutomationRunView, RunAutomationInput, DigitalLegacyPlanView, UpsertDigitalLegacyPlanInput, LegacyGrantView, UpsertLegacyGrantInput, ExecuteLegacyPlanInput, LegacyApprovalView, ApproveLegacyExecutionInput, CancelLegacyExecutionInput, ArchiveSearchInput, ArchiveVersionView, ArchiveRetentionPolicyView, CreateArchiveRetentionPolicyInput, AssignArchiveRetentionPolicyInput, ArchiveRetentionStatusView, SystemHealthView, BackupTargetView, UpsertBackupTargetInput, BackupRunView, BackupRunResultView, PerformanceSampleView, DiagnosticEntryView, MaintenanceResultView, BackupSchedulerResultView, AdaptiveResourceStateView, PerformanceTrendView, BackgroundTaskView, QueuedTaskView, EnqueueTaskInput, TaskQueueCycleResultView, MaintenancePolicyView, UpsertMaintenancePolicyInput, MaintenanceCycleResultView, HealthNotificationView, DiagnosticReportView, DiagnosticFilterInput, DiagnosticReportHistoryView, SystemHealthScoreView, SystemHealthHistoryView, SystemHealthTrendView, DiagnosticArchiveView, DiagnosticReportVerificationView, DiagnosticArchiveVerificationView, DiagnosticReportContentView, PerformanceAnomalyView, MaintenanceRecommendationView, DiagnosticReportComparisonView, DiagnosticArchiveContentView, DiagnosticArchiveSearchInput, DiagnosticArchiveExportView, MaintenanceHistoryView, MaintenanceHistoryFilterInput, MaintenanceHistoryExportView, UnifiedDiagnosticArchiveSearchView, SystemHealthStatus, ExportArtifactView, ExportArtifactVerificationView, BackupInspectionView, AuditIntegrityView, BackupPropagationRunView, BackupCleanRewritePolicyView, BackupCleanRewriteStatusView, BackupCleanRewriteRunStatus, BackupCleanRewriteRunView, BackupCleanRewriteTrigger, BackupCleanRewriteState, BackupCleanRewriteOutcome, UpdateBackupCleanRewritePolicyInput, BackupQuarantinePolicyView, BackupQuarantineBatchView, BackupQuarantineDestructionResultView, UpdateBackupQuarantinePolicyInput, SetBackupQuarantineLegalHoldInput, DestroyBackupQuarantineBatchInput, ExternalBackupCopyView, ExternalBackupInventorySummaryView, RegisterExternalBackupCopyInput, ReviewExternalBackupCopyInput, SetExternalBackupCopyLegalHoldInput, AttestExternalBackupCopyDestroyedInput, ExternalBackupEvidenceIssuerView, ExternalBackupEvidenceIssuerRotationView, ExternalBackupEvidenceRevocationListView, ExternalBackupRevocationEndpointView, ExternalBackupDestructionEvidenceView, RegisterExternalBackupEvidenceIssuerInput, RotateExternalBackupEvidenceIssuerInput, RevokeExternalBackupEvidenceIssuerInput, ApplyExternalBackupEvidenceRevocationListInput, UpsertExternalBackupRevocationEndpointInput, VerifyExternalBackupDestructionEvidenceInput, FamilyDataImportPreviewView, FamilyDataImportBatchView, ApplyFamilyDataImportInput, RollbackFamilyDataImportInput, GenealogyTreePageInput, GenealogyTreePageView, TimelinePageInput, TimelinePageView, ArchivePageInput, ArchivePageView, PersonCatalogPageInput, PersonCatalogPageView, EventCatalogPageInput, EventCatalogPageView, EntityCatalogLookupInput, EntityCatalogLookupView, DataRetentionPolicyView, DataLifecycleRecordView, CreateDataRetentionPolicyInput, ArchiveDataResourceInput, RestoreDataResourceInput, RequestDataPurgeInput, CancelDataPurgeInput, ExecuteDataPurgeInput, SetDataLegalHoldInput
} from '@ppt/domain';
import { archiveLegacyOwnershipReattestationConfirmation, type LegacyArchiveOwnershipReattestationView, type ReattestLegacyArchiveOwnershipInput } from '@ppt/domain';
import type {
  LoanAccountView,
  CreateLoanAccountInput,
  RecordLoanPaymentInput,
  FinancePlanningWorkspaceView,
  RecordFinancePlanningItemInput,
  CommitFinanceImportPreparedBatchInput,
  CommitFinanceImportBatchInput
} from '@ppt/domain';
import { buildDefaultLongTermPortfolioBootstrap, type LongTermPortfolioWorkspaceView, type RecordLongTermPortfolioItemInput } from '@ppt/domain';
import type { AccessibilityPreferencesView, UpdateAccessibilityPreferencesInput } from '@ppt/domain';
import type { FormDraftView, FormDraftWorkspaceView, SaveFormDraftInput, UndoFormDraftInput } from '@ppt/domain';
import type {
  CorrectAiMemoryInput,
  CreateDataRightsRequestInput,
  CreatePrivacyIncidentInput,
  DeleteAiMemoryInput,
  ExpireAiMemoryInput,
  PermissionSimulationView,
  PrivacyOwnershipControlCenterView,
  PrivacyOwnershipMutationReceiptView,
  RestrictAiMemoryInput,
  SimulatePermissionVisibilityInput,
  UpdateDataRightsRequestInput,
  UpdatePrivacyIncidentInput
} from '@ppt/domain';
import type { ManagedLifeWorkspaceView, RecordManagedLifeItemInput } from '@ppt/domain';
import type {
  EnrollWindowsHelloInput,
  LoginWithWindowsHelloInput,
  ReauthenticateWithWindowsHelloInput,
  WindowsHelloAuthenticationView,
  WindowsHelloEnrollmentView,
  WindowsHelloStateView
} from '@ppt/domain';
import type { DesktopSecurityPostureView, SessionLockStateView, UnlockSessionInput } from '@ppt/domain';
import type {
  CancelLocalGovernedOcrJobInput,
  CorrectLocalGovernedOcrResultInput,
  CreateLocalGovernedOcrJobInput,
  DeleteLocalGovernedOcrJobInput,
  LocalGovernedOcrCenterView,
  LocalGovernedOcrMutationReceiptView,
  LocalGovernedOcrResultView,
  LocalGovernedOcrSearchView,
  PropagateLocalGovernedOcrSourceDeletionInput,
  RerunLocalGovernedOcrJobInput,
  RunLocalGovernedOcrJobInput,
  SearchLocalGovernedOcrInput,
  SetLocalGovernedOcrEnabledInput
} from '@ppt/domain';
import { SqliteFamilyDatabaseRuntime } from './family-database-runtime.js';
import { createSqliteRepositoryCompositionRoot, type RepositoryCompositionRoot } from './repository-composition-root.js';
import type { IssueOfflineCapabilityLeaseInput, OfflineCapabilityLeaseView, LostDeviceShutdownInput, LostDeviceShutdownResultView, PrivacyControlCenterView, UpsertLiveLocationConsentInput } from '@ppt/domain';
import { FileDeviceIdentityProvider } from './device-identity.js';
import {
  issueIdentityAccessOperationToken,
  verifyIdentityAccessOperationToken
} from './identity-access-operation-token.js';
import type { DeviceSecretProtector } from './device-secret-protector.js';
import { ManagedBackupPasswordProvider } from './managed-backup-password.js';
import { ProtectedArchiveVaultKeyProvider } from './archive-vault-key-provider.js';
import { InMemoryAuthSessionPort, NodeDeviceProofVerifier, NodePasswordService, NodeSecondFactorService } from './auth-security-application-adapter.js';
import { FamilyDataImportService } from './family-data-import-service.js';
import { RepositoryBackedFamilyDataImportPolicyBatchRunner } from './family-data-import-policy-batch-runner.js';
import { LargeFamilyReadModelService } from './large-family-read-model-service.js';
import { EntityCatalogService } from './entity-catalog-service.js';
import { createAccountSecurityReceiptFingerprint, createSecurityEventReceipt } from './security-event-receipt.js';
import { SecurityEventReceiptStore } from './security-event-receipt-store.js';
import type { ProtectedSideArtifactStore } from './protected-side-artifact-store.js';
import { FamilyMutationRevisionService, type FamilyMutationResultInput } from './family-mutation-revision-service.js';
import {
  AuthenticateWithPasskeyUseCase,
  BeginFederatedIdentityLinkUseCase,
  BeginPasskeyAuthenticationUseCase,
  BeginPasskeyRegistrationUseCase,
  CompletePasskeyRegistrationUseCase,
  CreateReadOnlyCompanionSnapshotUseCase,
  GetIdentityAccessCredentialCenterUseCase,
  IssueTemporaryVerifiableCredentialUseCase,
  LinkFederatedIdentityUseCase,
  RecoverLostPasskeyUseCase,
  RevokePasskeyUseCase,
  RevokeTemporaryVerifiableCredentialUseCase,
  UnlinkFederatedIdentityUseCase,
  VerifyTemporaryVerifiableCredentialUseCase,
  type IdentityAccessApplicationContext,
  type IdentityChallengeGeneratorPort
} from '@ppt/application';
import type {
  AuthenticateWithPasskeyInput,
  CompanionSyncDenialView,
  CompletePasskeyRegistrationInput,
  CreateReadOnlyCompanionSnapshotInput,
  FederatedAuthorizationCeremonyView,
  FederatedIdentityProvider,
  IdentityAccessCredentialCenterView,
  IdentityAccessOperationKind,
  IdentityAccessOperationTokenView,
  IdentityAccessMutationReceiptView,
  IssueTemporaryVerifiableCredentialInput,
  IssuedTemporaryVerifiableCredentialView,
  LinkFederatedIdentityInput,
  PasskeyChallengeView,
  ReadOnlyCompanionSnapshotView,
  RecoverLostPasskeyInput,
  RevokePasskeyInput,
  RevokeTemporaryVerifiableCredentialInput,
  TemporaryCredentialVerificationView,
  UnlinkFederatedIdentityInput,
  VerifyTemporaryVerifiableCredentialInput
} from '@ppt/domain';

export class FullBackupRestoreRestartRequiredError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'FullBackupRestoreRestartRequiredError';
  }
}


interface DatabaseSnapshotProvider {
  withSnapshot<T>(operation: (databasePath: string) => T): T;
  databaseBytes(): number;
}

export interface IdentityAccessDataStorePorts extends Omit<IdentityAccessExternalSecurityPorts, 'passkeySession'> {
  readonly challengeGenerator: IdentityChallengeGeneratorPort;
  readonly federatedVaultControl: IdentityAccessFederatedVaultControlPort;
  readonly quota: IdentityAccessCredentialQuotaPort;
}

interface DataStoreOptions {
  databasePath: string;
  databaseConnection?: DatabaseConnection;
  databaseSnapshotProvider?: DatabaseSnapshotProvider;
  skipFileMigrationSafetyBackup?: boolean;
  restoreDatabasePath?: string;
  deviceIdentityPath?: string;
  deviceSecretProtector?: DeviceSecretProtector;
  mfaSecretProtector?: DeviceSecretProtector;
  windowsHelloPlatform?: WindowsHelloPlatformPort;
  windowsHelloDeviceBinding?: WindowsHelloDeviceBindingPort;
  windowsHelloWindowHandleProvider?: WindowsHelloWindowHandleProvider;
  backupSecretProtector?: DeviceSecretProtector;
  backupPasswordPath?: string;
  securityEventReceiptPath?: string;
  protectedSideArtifacts?: ProtectedSideArtifactStore;
  operationalArtifactFiles?: OperationalArtifactFilePort;
  vaultKeySecretProtector?: DeviceSecretProtector;
  archivePath?: string;
  /** Explicit bounded runtime seam for deterministic production-composition integration tests. */
  localGovernedOcrRuntime?: LocalGovernedOcrRuntimePort;
  /** Must resolve to a dedicated directory disjoint from the archive, database and key paths. */
  localGovernedOcrResultPath?: string;
  archivePolicyEnforcementPointResolver?: ArchivePolicyEnforcementPointResolver;
  financePolicyEnforcementPointResolver?: FinancePolicyEnforcementPointResolver;
  healthPolicyEnforcementPointResolver?: HealthPolicyEnforcementPointResolver;
  lifePolicyEnforcementPointResolver?: LifePolicyEnforcementPointResolver;
  locationPolicyEnforcementPointResolver?: LocationPolicyEnforcementPointResolver;
  timelinePolicyEnforcementPointResolver?: TimelinePolicyEnforcementPointResolver;
  archivePolicyAuthorizationProvider?: PlatformPolicyAuthorizationProvider;
  archivePolicyReceiptSink?: PlatformPolicyReceiptSink;
  archivePolicyVersion?: string;
  archiveClusterFence?: PlatformPolicyClusterFence;
  seed?: boolean;
  applicationVersion?: string;
  databaseConfig?: {
    busyTimeoutMs: number;
    journalMode: 'WAL';
    synchronous: 'NORMAL' | 'FULL';
  };
  migrationBackupDirectory?: string;
  onMigrationCompleted?: (summary: MigrationRunSummary) => void;
  clock?: Clock;
  correlation?: CorrelationContextProvider;
  logger?: Logger;
  repositoryExecutionPolicyGuard?: RepositoryExecutionPolicyGuard;
  sourceDeletionExternalCacheInvalidator?: DesktopSourceDeletionExternalCacheInvalidator;
  /** Missing capabilities remain unavailable; no crypto/provider/vault fallback is synthesized. */
  identityAccessPorts?: Partial<IdentityAccessDataStorePorts>;
  /** Public verification keys only. Missing production trust keeps package registration unavailable. */
  signedPluginTrustedKeys?: readonly TrustedPluginSigningKey[];
  /** Main-only RFC 9420 provider seam. Missing production configuration keeps all MLS writes unavailable. */
  communicationMlsFoundation?: CommunicationMlsFoundationPort;
  /** Main-only protected payload seam. Renderer code cannot provide or replace this authority. */
  communicationMessagePayloads?: CommunicationMessagePayloadPort;
  /** Must resolve to a dedicated directory disjoint from archive, database, key and temporary-open storage. */
  communicationMessagePayloadPath?: string;
  /** Main-only encrypted file staging seam. Renderer code cannot provide bytes, paths or sealed references. */
  communicationFilePayloads?: CommunicationFilePayloadPort;
  /** Main-only malware verdict provider. Absence is represented as provider_unavailable, never as clean. */
  communicationFileMalwareScanner?: CommunicationFileMalwareScannerPort;
  /** Must resolve to a dedicated directory disjoint from archive, message payload, database, key and temporary-open storage. */
  communicationFilePayloadPath?: string;
  /** Main-only protected family-meeting minutes seam. Renderer code cannot provide or replace this authority. */
  familyMeetingMinutesArtifacts?: FamilyMeetingMinutesArtifactPort;
  /** Must resolve to a dedicated directory disjoint from archive, database, key and temporary-open storage. */
  familyMeetingMinutesPath?: string;
  /** Main-only local media-device preflight. Missing production configuration remains fail-closed. */
  communicationCallPreflight?: CommunicationCallPreflightPort;
  federatedProviderConfigurations?: readonly import('@ppt/repository-contracts').FederatedProviderProvisioningRow[];
  securityConfig?: {
    sessionIdleTimeoutMinutes: number;
    maximumFailedLoginAttempts: number;
  };
}

interface ArchiveProductionPolicyConfiguration {
  readonly authorizationProvider: PlatformPolicyAuthorizationProvider;
  readonly receiptSink: PlatformPolicyReceiptSink;
  readonly policyVersion: string;
  readonly clusterFence: PlatformPolicyClusterFence;
}

const archiveProductionPolicyConfiguration = (
  options: DataStoreOptions
): ArchiveProductionPolicyConfiguration | undefined => {
  const authorizationProvider = options.archivePolicyAuthorizationProvider;
  const receiptSink = options.archivePolicyReceiptSink;
  const policyVersion = options.archivePolicyVersion;
  const clusterFence = options.archiveClusterFence;
  if (authorizationProvider === undefined && receiptSink === undefined && policyVersion === undefined) {
    return undefined;
  }
  if (
    authorizationProvider === undefined
    || receiptSink === undefined
    || policyVersion === undefined
    || clusterFence === undefined
  ) {
    throw new PlatformPolicyEnforcementError(
      'ENFORCEMENT_UNAVAILABLE',
      'Archive production policy composition is incomplete; provider, receipt sink, policy version and live cluster fence are all required'
    );
  }
  if (
    options.archivePolicyEnforcementPointResolver !== undefined
    || options.financePolicyEnforcementPointResolver !== undefined
    || options.healthPolicyEnforcementPointResolver !== undefined
    || options.lifePolicyEnforcementPointResolver !== undefined
    || options.locationPolicyEnforcementPointResolver !== undefined
    || options.timelinePolicyEnforcementPointResolver !== undefined
  ) {
    throw new PlatformPolicyEnforcementError(
      'ENFORCEMENT_UNAVAILABLE',
      'Production policy composition conflicts with an explicit enforcement-point resolver'
    );
  }
  return Object.freeze({ authorizationProvider, receiptSink, policyVersion, clusterFence });
};

const nowIso = (): string => new Date().toISOString();
const OFFLINE_CAPABILITY_LEASE_BINDING = Object.freeze({
  policyVersion: 'PPT-PLATFORM-POLICY-PPK-012',
  policyPackageVersion: 12,
  policyPackageSha256: createHash('sha256').update('PPK-012:offline-capability-lease:policy-package:v12').digest('hex'),
  capabilityManifestSha256: createHash('sha256').update('PPK-012:windows-desktop:offline-capability-manifest:v1').digest('hex')
});
const initialsOf = (displayName: string): string => displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase('tr-TR') ?? '').join('');
const ARCHIVE_OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

const canonicalArchiveOperationValue = (value: unknown): string => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Arşiv işlem girdisi sonlu bir sayı olmalıdır.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalArchiveOperationValue).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalArchiveOperationValue(record[key])}`)
      .join(',')}}`;
  }
  throw new Error('Arşiv işlem girdisi kanonik JSON ile temsil edilemiyor.');
};

const deterministicArchiveIdentifier = (operationId: string, label: string): string => {
  const hex = createHash('sha256').update(`${operationId}\u0000${label}`, 'utf8').digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const LOCAL_GOVERNED_OCR_CLIENT_OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u;

const localGovernedOcrFingerprintCommand = (command: unknown): unknown => {
  if (typeof command !== 'object' || command === null || Array.isArray(command)) return command;
  const record = command as Readonly<Record<string, unknown>>;
  if (typeof record.correctedText !== 'string') return command;
  const { correctedText, ...metadata } = record;
  return Object.freeze({
    ...metadata,
    correctedTextSha256: createHash('sha256').update(correctedText, 'utf8').digest('hex')
  });
};

const localGovernedOcrOperationSeed = (
  context: LocalGovernedOcrApplicationContext,
  clientOperationId: string
): string => {
  if (!LOCAL_GOVERNED_OCR_CLIENT_OPERATION_ID.test(clientOperationId)) {
    throw new Error('Local OCR clientOperationId must be a stable 8-160 character identifier.');
  }
  return canonicalArchiveOperationValue({
    familyId: context.familyId,
    accountId: context.actor.userId,
    ownerPersonId: context.actor.personId,
    clientOperationId
  });
};

const localGovernedOcrMutationIdentifiers = (
  context: LocalGovernedOcrApplicationContext,
  clientOperationId: string,
  resourceId: string,
  operation: string,
  command: unknown
): LocalGovernedOcrOperationIdentifiers => {
  const seed = localGovernedOcrOperationSeed(context, clientOperationId);
  return Object.freeze({
    mutationId: deterministicArchiveIdentifier(seed, 'local-ocr-mutation'),
    resourceId,
    requestFingerprint: createHash('sha256').update(canonicalArchiveOperationValue({
      operation,
      familyId: context.familyId,
      accountId: context.actor.userId,
      ownerPersonId: context.actor.personId,
      command: localGovernedOcrFingerprintCommand(command)
    }), 'utf8').digest('hex'),
    auditId: deterministicArchiveIdentifier(seed, 'local-ocr-audit'),
    outboxEventId: asEventId(deterministicArchiveIdentifier(seed, 'local-ocr-outbox'))
  });
};

const localGovernedOcrJobId = (
  context: LocalGovernedOcrApplicationContext,
  clientOperationId: string
): string => deterministicArchiveIdentifier(
  localGovernedOcrOperationSeed(context, clientOperationId),
  'local-ocr-job'
);

const localGovernedOcrStageCorrelationId = (
  correlationId: LocalGovernedOcrApplicationContext['correlationId'],
  stage: 'archive-destruction-plan' | 'archive-deletion-propagation'
): LocalGovernedOcrApplicationContext['correlationId'] => asCorrelationId(
  `local-ocr-${stage}-${deterministicArchiveIdentifier(correlationId, stage)}`
);

const normalizedCompositionPath = (value: string): string => {
  const normalized = resolve(value);
  return process.platform === 'win32' ? normalized.toLocaleLowerCase('en-US') : normalized;
};

const compositionPathsOverlap = (left: string, right: string): boolean => {
  const normalizedLeft = normalizedCompositionPath(left);
  const normalizedRight = normalizedCompositionPath(right);
  return normalizedLeft === normalizedRight
    || normalizedLeft.startsWith(`${normalizedRight}${sep}`)
    || normalizedRight.startsWith(`${normalizedLeft}${sep}`);
};

const localGovernedOcrResultRoot = (input: {
  readonly requestedPath?: string;
  readonly databasePath: string;
  readonly archivePath: string;
  readonly keyPath: string;
  readonly temporaryOpenPath: string;
}): string => {
  const root = resolve(input.requestedPath ?? `${input.databasePath}.local-ocr-results`);
  if (
    !root.trim()
    || compositionPathsOverlap(root, input.databasePath)
    || compositionPathsOverlap(root, input.archivePath)
    || compositionPathsOverlap(root, input.keyPath)
    || compositionPathsOverlap(root, input.temporaryOpenPath)
  ) throw new PlatformPolicyEnforcementError(
    'ENFORCEMENT_UNAVAILABLE',
    'Local OCR protected result root must be separate from archive, database, key and temporary-open storage'
  );
  return root;
};

const communicationMessagePayloadRoot = (input: {
  readonly requestedPath?: string;
  readonly databasePath: string;
  readonly archivePath: string;
  readonly keyPath: string;
  readonly temporaryOpenPath: string;
}): string => {
  const root = resolve(input.requestedPath ?? `${input.databasePath}.communication-message-payloads`);
  if (!root.trim() || compositionPathsOverlap(root, input.databasePath) || compositionPathsOverlap(root, input.archivePath)
    || compositionPathsOverlap(root, input.keyPath) || compositionPathsOverlap(root, input.temporaryOpenPath)) {
    throw new PlatformPolicyEnforcementError('ENFORCEMENT_UNAVAILABLE',
      'Communication message payload root must be separate from archive, database, key and temporary-open storage');
  }
  return root;
};

const communicationFilePayloadRoot = (input: {
  readonly requestedPath?: string;
  readonly databasePath: string;
  readonly archivePath: string;
  readonly keyPath: string;
  readonly temporaryOpenPath: string;
  readonly messagePayloadPath: string;
}): string => {
  const root = resolve(input.requestedPath ?? `${input.databasePath}.communication-file-payloads`);
  if (!root.trim() || compositionPathsOverlap(root, input.databasePath) || compositionPathsOverlap(root, input.archivePath)
    || compositionPathsOverlap(root, input.keyPath) || compositionPathsOverlap(root, input.temporaryOpenPath)
    || compositionPathsOverlap(root, input.messagePayloadPath)) {
    throw new PlatformPolicyEnforcementError('ENFORCEMENT_UNAVAILABLE',
      'Communication file payload root must be separate from message payload, archive, database, key and temporary-open storage');
  }
  return root;
};

const familyMeetingMinutesRoot = (input: {
  readonly requestedPath?: string;
  readonly databasePath: string;
  readonly archivePath: string;
  readonly keyPath: string;
  readonly temporaryOpenPath: string;
}): string => {
  const root = resolve(input.requestedPath ?? `${input.databasePath}.family-meeting-minutes`);
  if (!root.trim() || compositionPathsOverlap(root, input.databasePath) || compositionPathsOverlap(root, input.archivePath)
    || compositionPathsOverlap(root, input.keyPath) || compositionPathsOverlap(root, input.temporaryOpenPath)) {
    throw new PlatformPolicyEnforcementError('ENFORCEMENT_UNAVAILABLE',
      'Family meeting minutes root must be separate from archive, database, key and temporary-open storage');
  }
  return root;
};

const communicationPayloadFailure = (correlationId: Parameters<CommunicationMessagePayloadPort['seal']>[0]['correlationId']) =>
  err(createAppError({ code: ERROR_CODES.AUTHORIZATION_DENIED, category: 'security',
    message: 'Protected communication message payload provider is unavailable.', correlationId }));
const failClosedCommunicationMessagePayloads: CommunicationMessagePayloadPort = Object.freeze({
  seal: (input: Parameters<CommunicationMessagePayloadPort['seal']>[0]) => communicationPayloadFailure(input.correlationId),
  open: (_row: Parameters<CommunicationMessagePayloadPort['open']>[0],
    correlationId: Parameters<CommunicationMessagePayloadPort['open']>[1]) => communicationPayloadFailure(correlationId),
  discard: (_reference: Parameters<CommunicationMessagePayloadPort['discard']>[0],
    correlationId: Parameters<CommunicationMessagePayloadPort['discard']>[1]) => communicationPayloadFailure(correlationId),
  sweepOrphans: (input: Parameters<CommunicationMessagePayloadPort['sweepOrphans']>[0]) =>
    communicationPayloadFailure(input.correlationId)
});
const assertCommunicationMessagePayloadPort = (value: CommunicationMessagePayloadPort): CommunicationMessagePayloadPort => {
  if (!value || typeof value.seal !== 'function' || typeof value.open !== 'function' || typeof value.discard !== 'function'
    || typeof value.sweepOrphans !== 'function') {
    throw new PlatformPolicyEnforcementError('ENFORCEMENT_UNAVAILABLE',
      'Explicit communication message payload provider is incomplete');
  }
  return value;
};
const communicationFilePayloadFailure = (correlationId: Parameters<CommunicationFilePayloadPort['seal']>[0]['correlationId']) =>
  err(createAppError({ code: ERROR_CODES.AUTHORIZATION_DENIED, category: 'security',
    message: 'Protected communication file payload provider is unavailable.', correlationId }));
const failClosedCommunicationFilePayloads: CommunicationFilePayloadPort = Object.freeze({
  seal: (input: Parameters<CommunicationFilePayloadPort['seal']>[0]) => communicationFilePayloadFailure(input.correlationId),
  open: (input: Parameters<CommunicationFilePayloadPort['open']>[0]) => communicationFilePayloadFailure(input.correlationId),
  discard: (_reference: Parameters<CommunicationFilePayloadPort['discard']>[0],
    correlationId: Parameters<CommunicationFilePayloadPort['discard']>[1]) => communicationFilePayloadFailure(correlationId),
  sweepOrphans: (input: Parameters<CommunicationFilePayloadPort['sweepOrphans']>[0]) =>
    communicationFilePayloadFailure(input.correlationId)
});
const assertCommunicationFilePayloadPort = (value: CommunicationFilePayloadPort): CommunicationFilePayloadPort => {
  if (!value || typeof value.seal !== 'function' || typeof value.open !== 'function' || typeof value.discard !== 'function'
    || typeof value.sweepOrphans !== 'function') {
    throw new PlatformPolicyEnforcementError('ENFORCEMENT_UNAVAILABLE',
      'Explicit communication file payload provider is incomplete');
  }
  return value;
};
const projectCommunicationFileSharingCenter = (
  value: CommunicationFileSharingCenterView
): CommunicationFileSharingRendererCenterView => Object.freeze({ schemaVersion: 1,
  files: Object.freeze(value.files.map((file) => Object.freeze({ id: file.id,
    ...(file.roomId === undefined ? {} : { roomId: file.roomId }),
    ...(file.meetingId === undefined ? {} : { meetingId: file.meetingId }), displayName: file.displayName,
    mimeType: file.mimeType, totalBytes: file.totalBytes, totalChunks: file.totalChunks,
    verifiedChunkCount: file.chunks.length, state: file.state, scanState: file.scanState,
    versionCount: file.versions.length, comments: Object.freeze([...file.comments]),
    accessGrants: Object.freeze([...file.accessGrants]),
    ...(file.archiveItemId === undefined ? {} : { archiveItemId: file.archiveItemId }),
    ...(file.albumId === undefined ? {} : { albumId: file.albumId }), selectedForStory: file.selectedForStory,
    likedByPersonIds: Object.freeze([...file.likedByPersonIds]), externalLinkEnabled: false,
    externalLinkAccessCodeRequired: true, revision: file.revision, createdAt: file.createdAt, updatedAt: file.updatedAt }))),
  notificationProfile: value.notificationProfile, emergencyAnnouncements: value.emergencyAnnouncements,
  remoteAssistance: value.remoteAssistance, coWatchSessions: value.coWatchSessions, voiceActions: value.voiceActions,
  truth: value.truth, revision: value.revision, generatedAt: value.generatedAt });
const projectCommunicationFileSharingReceipt = (
  value: CommunicationFileSharingMutationReceiptView
): CommunicationFileSharingRendererMutationReceiptView => Object.freeze({ commandKind: value.commandKind,
  previousRevision: value.previousRevision, revision: value.revision, occurredAt: value.occurredAt,
  replayed: value.replayed, externalOperationPerformed: false, networkUsed: false });
const communicationFileSharingMainOnlyCommandKinds=new Set<CommunicationFileSharingCommand['kind']>([
  'prepare_file','record_chunk','set_scan','add_version'
]);
const familyMeetingMinutesFailure = (correlationId: Parameters<FamilyMeetingMinutesArtifactPort['seal']>[0]['correlationId']) =>
  err(createAppError({ code: ERROR_CODES.AUTHORIZATION_DENIED, category: 'security',
    message: 'Protected family meeting minutes provider is unavailable.', correlationId }));
const failClosedFamilyMeetingMinutesArtifacts: FamilyMeetingMinutesArtifactPort = Object.freeze({
  seal: (input: Parameters<FamilyMeetingMinutesArtifactPort['seal']>[0]) => familyMeetingMinutesFailure(input.correlationId),
  open: (_row: Parameters<FamilyMeetingMinutesArtifactPort['open']>[0], _actorPersonId: string,
    correlationId: Parameters<FamilyMeetingMinutesArtifactPort['open']>[2]) => familyMeetingMinutesFailure(correlationId),
  discard: (_reference: string, correlationId: Parameters<FamilyMeetingMinutesArtifactPort['discard']>[1]) =>
    familyMeetingMinutesFailure(correlationId)
});
const assertFamilyMeetingMinutesArtifactPort = (value: FamilyMeetingMinutesArtifactPort): FamilyMeetingMinutesArtifactPort => {
  if (!value || typeof value.seal !== 'function' || typeof value.open !== 'function' || typeof value.discard !== 'function') {
    throw new PlatformPolicyEnforcementError('ENFORCEMENT_UNAVAILABLE',
      'Explicit family meeting minutes provider is incomplete');
  }
  return value;
};

const failClosedLocalGovernedOcrPolicyEnforcementPointResolver:
LocalGovernedOcrProductionPolicyEnforcementPointResolver = Object.freeze({
  resolve(): never {
    throw new PlatformPolicyEnforcementError(
      'ENFORCEMENT_UNAVAILABLE',
      'Local OCR production policy enforcement is not composed for this process'
    );
  }
});

const localGovernedOcrRuntimeFailure = (
  correlationId: Parameters<LocalGovernedOcrRuntimePort['runAndSeal']>[0]['correlationId']
) => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  category: 'security',
  message: 'Local OCR protected runtime prerequisites are unavailable.',
  correlationId
}));

const failClosedLocalGovernedOcrRuntime: LocalGovernedOcrRuntimePort = Object.freeze({
  async runAndSeal(input: Parameters<LocalGovernedOcrRuntimePort['runAndSeal']>[0]) {
    return localGovernedOcrRuntimeFailure(input.correlationId);
  },
  async correctAndSeal(input: Parameters<LocalGovernedOcrRuntimePort['correctAndSeal']>[0]) {
    return localGovernedOcrRuntimeFailure(input.correlationId);
  },
  async readSealedResult(input: Parameters<LocalGovernedOcrRuntimePort['readSealedResult']>[0]) {
    return localGovernedOcrRuntimeFailure(input.correlationId);
  },
  async searchSealedResult(input: Parameters<LocalGovernedOcrRuntimePort['searchSealedResult']>[0]) {
    return localGovernedOcrRuntimeFailure(input.correlationId);
  },
  async requestCancellation(input: Parameters<LocalGovernedOcrRuntimePort['requestCancellation']>[0]) {
    return localGovernedOcrRuntimeFailure(input.correlationId);
  },
  async purgeSealedResult(input: Parameters<LocalGovernedOcrRuntimePort['purgeSealedResult']>[0]) {
    return localGovernedOcrRuntimeFailure(input.correlationId);
  },
  async sweepOrphans(input: Parameters<LocalGovernedOcrRuntimePort['sweepOrphans']>[0]) {
    return localGovernedOcrRuntimeFailure(input.correlationId);
  }
});

const assertLocalGovernedOcrRuntimePort = (runtime: LocalGovernedOcrRuntimePort): LocalGovernedOcrRuntimePort => {
  if (!runtime
    || typeof runtime.runAndSeal !== 'function'
    || typeof runtime.correctAndSeal !== 'function'
    || typeof runtime.readSealedResult !== 'function'
    || typeof runtime.searchSealedResult !== 'function'
    || typeof runtime.requestCancellation !== 'function'
    || typeof runtime.purgeSealedResult !== 'function'
    || typeof runtime.sweepOrphans !== 'function') {
    throw new PlatformPolicyEnforcementError(
      'ENFORCEMENT_UNAVAILABLE',
      'Explicit Local OCR bounded runtime injection is incomplete'
    );
  }
  return runtime;
};

const privacyOperationFingerprint = (operation: string, input: unknown): string => createHash('sha256')
  .update(canonicalArchiveOperationValue({ operation, input }), 'utf8')
  .digest('hex');

const privacyMutationIdentifiers = (
  clientOperationId: string,
  resourceId: string,
  operation: string,
  input: unknown
) => ({
  mutationId: deterministicArchiveIdentifier(clientOperationId, 'privacy-mutation'),
  resourceId,
  requestFingerprint: privacyOperationFingerprint(operation, input),
  auditId: deterministicArchiveIdentifier(clientOperationId, 'privacy-audit'),
  outboxEventId: asEventId(deterministicArchiveIdentifier(clientOperationId, 'privacy-outbox'))
});

const IDENTITY_ACCESS_CLIENT_OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u;

const identityAccessOperationSeed = (
  context: IdentityAccessApplicationContext,
  clientOperationId: string
): string => {
  if (!IDENTITY_ACCESS_CLIENT_OPERATION_ID.test(clientOperationId)) {
    throw new Error('Kimlik erişim clientOperationId değeri 8-160 karakter ve güvenli biçimde olmalıdır.');
  }
  return canonicalArchiveOperationValue({
    familyId: context.familyId,
    accountId: context.actor.userId,
    ownerPersonId: context.actor.personId,
    clientOperationId
  });
};

const identityAccessResourceId = (
  context: IdentityAccessApplicationContext,
  clientOperationId: string,
  label: string
): string => deterministicArchiveIdentifier(identityAccessOperationSeed(context, clientOperationId), `identity-${label}`);

const identityAccessMutationIdentifiers = (
  context: IdentityAccessApplicationContext,
  clientOperationId: string,
  resourceId: string,
  operation: string,
  command: unknown
) => {
  const seed = identityAccessOperationSeed(context, clientOperationId);
  return {
    mutationId: deterministicArchiveIdentifier(seed, 'identity-mutation'),
    resourceId,
    requestFingerprint: createHash('sha256').update(canonicalArchiveOperationValue({
      operation,
      familyId: context.familyId,
      accountId: context.actor.userId,
      ownerPersonId: context.actor.personId,
      command
    }), 'utf8').digest('hex'),
    auditId: deterministicArchiveIdentifier(seed, 'identity-audit'),
    outboxEventId: asEventId(deterministicArchiveIdentifier(seed, 'identity-outbox'))
  };
};

const identityAccessEvidenceIdentifiers = (
  context: IdentityAccessApplicationContext,
  clientOperationId: string,
  resourceLabel: string
) => {
  const seed = identityAccessOperationSeed(context, clientOperationId);
  return {
    resourceId: deterministicArchiveIdentifier(seed, `identity-${resourceLabel}`),
    auditId: deterministicArchiveIdentifier(seed, 'identity-audit'),
    outboxEventId: asEventId(deterministicArchiveIdentifier(seed, 'identity-outbox'))
  };
};

const identityAccessUnavailable = (message: string, correlationId = asCorrelationId('identity-access-port-unavailable')) =>
  err(createAppError({
    code: ERROR_CODES.AUTHORIZATION_DENIED,
    category: 'security',
    message,
    correlationId
  }));

const communicationMlsUnavailable = (message: string) => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  category: 'security',
  message,
  correlationId: asCorrelationId('communication-mls-provider-unavailable')
}));

interface ArchiveOperationExpectation {
  readonly resourceType: 'archive_item' | 'archive_retention_policy' | 'archive_category';
  readonly resourceId: string;
  readonly action: 'create' | 'update' | 'delete' | 'record';
}

const ARCHIVE_PENDING_OPERATION_MUTATIONS = new Set<PlatformPolicyArchivePendingOperationMutation>([
  'archive:import',
  'archive:open',
  'archive:secureDestroy',
  'archive:createRetentionPolicy',
  'archive:assignRetentionPolicy',
  'archive:createCategory',
  'archive:updateClassification'
]);

const ARCHIVE_OPERATION_PREFIX_TO_PENDING_MUTATION: Readonly<Record<string, PlatformPolicyArchivePendingOperationMutation>> = Object.freeze({
  'archive.import': 'archive:import',
  'archive.open': 'archive:open',
  'archive.secure-destroy': 'archive:secureDestroy',
  'archive.retention-policy.create': 'archive:createRetentionPolicy',
  'archive.retention-policy.assign': 'archive:assignRetentionPolicy',
  'archive.category.create': 'archive:createCategory',
  'archive.classification.update': 'archive:updateClassification'
});

export interface ArchivePendingOperationIntentInput {
  readonly mutation: PlatformPolicyArchivePendingOperationMutation;
  readonly semanticInput: unknown;
}

export interface ArchivePendingOperationIdentityView {
  readonly operationId: string;
  readonly intentFingerprint: string;
  readonly mutation: PlatformPolicyArchivePendingOperationMutation;
  readonly recovered: boolean;
  readonly state: 'pending' | 'acknowledged';
}

export class FamilyDataStore {
  readonly #databaseRuntime: SqliteFamilyDatabaseRuntime;
  readonly #database: DatabaseConnection;
  readonly #databasePath: string;
  readonly #databaseSnapshotProvider: DatabaseSnapshotProvider | undefined;
  readonly #restoreDatabasePath: string;
  readonly #archivePath: string;
  readonly #keyPath: string;
  readonly #managedBackupPasswordProvider: ManagedBackupPasswordProvider | undefined;
  readonly #sessionManager: AuthSessionPort;
  readonly #strongAuthentication: StrongAuthenticationPort;
  readonly #clock: Clock;
  readonly #correlation: CorrelationContextProvider | undefined;
  readonly #transactionExecutor: AsyncTransactionExecutor;
  readonly #repositories: RepositoryCompositionRoot;
  readonly #listBackupTargetsUseCase: ListBackupTargetsUseCase;
  readonly #findBackupTargetUseCase: FindBackupTargetUseCase;
  readonly #upsertBackupTargetUseCase: UpsertBackupTargetUseCase;
  readonly #listBackupRunsUseCase: ListBackupRunsUseCase;
  readonly #listSuccessfulBackupRunsUseCase: ListSuccessfulBackupRunsUseCase;
  readonly #listEnabledBackupTargetIdsUseCase: ListEnabledBackupTargetIdsUseCase;
  readonly #listDueBackupTargetIdsUseCase: ListDueBackupTargetIdsUseCase;
  readonly #recordBackupRunUseCase: RecordBackupRunUseCase;
  readonly #markBackupTargetSuccessUseCase: MarkBackupTargetSuccessUseCase;
  readonly #markBackupTargetFailureUseCase: MarkBackupTargetFailureUseCase;
  readonly #deleteBackupRunUseCase: DeleteBackupRunUseCase;
  readonly #listBackgroundTasksUseCase: ListBackgroundTasksUseCase;
  readonly #startBackgroundTaskUseCase: StartBackgroundTaskUseCase;
  readonly #finishBackgroundTaskUseCase: FinishBackgroundTaskUseCase;
  readonly #listQueuedTasksUseCase: ListQueuedTasksUseCase;
  readonly #listRunnableQueuedTasksUseCase: ListRunnableQueuedTasksUseCase;
  readonly #enqueueTaskUseCase: EnqueueTaskUseCase;
  readonly #deferQueuedTaskUseCase: DeferQueuedTaskUseCase;
  readonly #startQueuedTaskUseCase: StartQueuedTaskUseCase;
  readonly #completeQueuedTaskUseCase: CompleteQueuedTaskUseCase;
  readonly #failOrRetryQueuedTaskUseCase: FailOrRetryQueuedTaskUseCase;
  readonly #inspectDatabaseRuntimeHealthUseCase: InspectDatabaseRuntimeHealthUseCase;
  readonly #inspectSystemResourceSnapshotUseCase: InspectSystemResourceSnapshotUseCase;
  readonly #runDatabaseMaintenanceUseCase: RunDatabaseMaintenanceUseCase;
  readonly #prepareBackupDatabaseUseCase: PrepareBackupDatabaseUseCase;
  readonly #verifyBackupDatabaseIntegrityUseCase: VerifyBackupDatabaseIntegrityUseCase;
  readonly #prepareRestoredDatabaseForReauthorizationUseCase: PrepareRestoredDatabaseForReauthorizationUseCase;
  readonly #getBackupTargetFreeBytesUseCase: GetBackupTargetFreeBytesUseCase;
  readonly #prepareBackupTargetUseCase: PrepareBackupTargetUseCase;
  readonly #createBackupArtifactPathUseCase: CreateBackupArtifactPathUseCase;
  readonly #inspectBackupArtifactUseCase: InspectBackupArtifactUseCase;
  readonly #deleteBackupArtifactUseCase: DeleteBackupArtifactUseCase;
  readonly #listBackupArtifactsUseCase: ListBackupArtifactsUseCase;
  readonly #prepareFullBackupDestinationUseCase: PrepareFullBackupDestinationUseCase;
  readonly #createFullBackupUseCase: CreateFullBackupUseCase;
  readonly #inspectFullBackupUseCase: InspectFullBackupUseCase;
  readonly #stageFullBackupRestoreUseCase: StageFullBackupRestoreUseCase;
  readonly #commitFullBackupRestoreUseCase: CommitFullBackupRestoreUseCase;
  readonly #discardFullBackupRestoreUseCase: DiscardFullBackupRestoreUseCase;
  readonly #storeArchiveFileUseCase: StoreArchiveFileUseCase;
  readonly #materializeArchiveFileUseCase: MaterializeArchiveFileUseCase;
  readonly #readArchiveFileBytesUseCase: ReadArchiveFileBytesUseCase;
  readonly #destroyArchiveFileUseCase: DestroyArchiveFileUseCase;
  readonly #writeOperationalTextArtifactUseCase: WriteOperationalTextArtifactUseCase;
  readonly #writeOperationalGzipArtifactUseCase: WriteOperationalGzipArtifactUseCase;
  readonly #verifyOperationalArtifactUseCase: VerifyOperationalArtifactUseCase;
  readonly #readOperationalTextArtifactUseCase: ReadOperationalTextArtifactUseCase;
  readonly #readOperationalGzipArtifactUseCase: ReadOperationalGzipArtifactUseCase;
  readonly #installAuditStorageProtectionUseCase: InstallAuditStorageProtectionUseCase;
  readonly #recordPerformanceSampleUseCase: RecordPerformanceSampleUseCase;
  readonly #listPerformanceSamplesUseCase: ListPerformanceSamplesUseCase;
  readonly #getPerformanceTrendUseCase: GetPerformanceTrendUseCase;
  readonly #recordDiagnosticUseCase: RecordDiagnosticUseCase;
  readonly #listDiagnosticsUseCase: ListDiagnosticsUseCase;
  readonly #recordSystemHealthHistoryUseCase: RecordSystemHealthHistoryUseCase;
  readonly #listSystemHealthHistoryUseCase: ListSystemHealthHistoryUseCase;
  readonly #listSystemHealthHistorySinceUseCase: ListSystemHealthHistorySinceUseCase;
  readonly #recordMaintenanceHistoryUseCase: RecordMaintenanceHistoryUseCase;
  readonly #listMaintenanceHistoryUseCase: ListMaintenanceHistoryUseCase;
  readonly #searchMaintenanceHistoryUseCase: SearchMaintenanceHistoryUseCase;
  readonly #getMaintenancePolicyUseCase: GetMaintenancePolicyUseCase;
  readonly #upsertMaintenancePolicyUseCase: UpsertMaintenancePolicyUseCase;
  readonly #listHealthNotificationsUseCase: ListHealthNotificationsUseCase;
  readonly #findActiveHealthNotificationUseCase: FindActiveHealthNotificationUseCase;
  readonly #recordHealthNotificationUseCase: RecordHealthNotificationUseCase;
  readonly #attachHealthNotificationTaskUseCase: AttachHealthNotificationTaskUseCase;
  readonly #acknowledgeHealthNotificationUseCase: AcknowledgeHealthNotificationUseCase;
  readonly #getOperationalHealthCountsUseCase: GetOperationalHealthCountsUseCase;
  readonly #cleanupOperationalHealthUseCase: CleanupOperationalHealthUseCase;
  readonly #getMaintenanceRecommendationsUseCase: GetMaintenanceRecommendationsUseCase;
  readonly #recordExportArtifactUseCase: RecordExportArtifactUseCase;
  readonly #listExportArtifactsUseCase: ListExportArtifactsUseCase;
  readonly #findExportArtifactUseCase: FindExportArtifactUseCase;
  readonly #recordDiagnosticReportUseCase: RecordDiagnosticReportUseCase;
  readonly #listDiagnosticReportsUseCase: ListDiagnosticReportsUseCase;
  readonly #findDiagnosticReportUseCase: FindDiagnosticReportUseCase;
  readonly #recordDiagnosticArchiveUseCase: RecordDiagnosticArchiveUseCase;
  readonly #listDiagnosticArchivesUseCase: ListDiagnosticArchivesUseCase;
  readonly #findDiagnosticArchiveUseCase: FindDiagnosticArchiveUseCase;
  readonly #deleteDiagnosticsThroughUseCase: DeleteDiagnosticsThroughUseCase;
  readonly #getAuthStateUseCase: GetAuthStateUseCase;
  readonly #getSessionLockStateUseCase: GetSessionLockStateUseCase;
  readonly #recordSessionActivityUseCase: RecordSessionActivityUseCase;
  readonly #lockSessionUseCase: LockSessionUseCase;
  readonly #getDesktopSecurityPostureUseCase: GetDesktopSecurityPostureUseCase;
  #auditedSessionLockAt: string | undefined;
  readonly #setupAdminUseCase: SetupAdminUseCase;
  readonly #loginUseCase: LoginUseCase;
  readonly #logoutUseCase: LogoutUseCase;
  readonly #changePasswordUseCase: ChangePasswordUseCase;
  readonly #beginTwoFactorSetupUseCase: BeginTwoFactorSetupUseCase;
  readonly #enableTwoFactorUseCase: EnableTwoFactorUseCase;
  readonly #disableTwoFactorUseCase: DisableTwoFactorUseCase;
  readonly #trustCurrentDeviceUseCase: TrustCurrentDeviceUseCase;
  readonly #reauthorizeCurrentDeviceAfterRecoveryUseCase: ReauthorizeCurrentDeviceAfterRecoveryUseCase;
  readonly #rotateAccountSecurityEpochAfterRecoveryUseCase: RotateAccountSecurityEpochAfterRecoveryUseCase;
  readonly #listTrustedDevicesUseCase: ListTrustedDevicesUseCase;
  readonly #revokeTrustedDeviceUseCase: RevokeTrustedDeviceUseCase;
  readonly #getWindowsHelloStateUseCase: GetWindowsHelloStateUseCase;
  readonly #enrollWindowsHelloUseCase: EnrollWindowsHelloUseCase;
  readonly #loginWithWindowsHelloUseCase: LoginWithWindowsHelloUseCase;
  readonly #reauthenticateWithWindowsHelloUseCase: ReauthenticateWithWindowsHelloUseCase;
  readonly #evaluateAuthorizationUseCase: EvaluateAuthorizationUseCase;
  readonly #listObjectPermissionsUseCase: ListObjectPermissionsUseCase;
  readonly #upsertObjectPermissionUseCase: UpsertObjectPermissionUseCase;
  readonly #deleteObjectPermissionUseCase: DeleteObjectPermissionUseCase;
  readonly #listOfflineCapabilityLeasesUseCase: ListOfflineCapabilityLeasesUseCase;
  readonly #issueOfflineCapabilityLeaseUseCase: IssueOfflineCapabilityLeaseUseCase;
  readonly #revokeOfflineCapabilityLeaseUseCase: RevokeOfflineCapabilityLeaseUseCase;
  readonly #getPrivacyControlCenterUseCase: GetPrivacyControlCenterUseCase;
  readonly #upsertLiveLocationConsentUseCase: UpsertLiveLocationConsentUseCase;
  readonly #shutdownLostDeviceAuthorityUseCase: ShutdownLostDeviceAuthorityUseCase;
  readonly #listAuditEntriesUseCase: ListAuditEntriesUseCase;
  readonly #verifyAuditIntegrityUseCase: VerifyAuditIntegrityUseCase;
  readonly #deviceIdentityProvider: FileDeviceIdentityProvider;
  readonly #temporaryCredentialEnvelope: IdentityAccessExternalSecurityPorts['temporaryCredentialEnvelope'];
  readonly #securityEventReceiptStore: SecurityEventReceiptStore;
  readonly #listAutomationRulesUseCase: ListAutomationRulesUseCase;
  readonly #createAutomationRuleUseCase: CreateAutomationRuleUseCase;
  readonly #toggleAutomationRuleUseCase: ToggleAutomationRuleUseCase;
  readonly #listAutomationRunsUseCase: ListAutomationRunsUseCase;
  readonly #runAutomationRulesUseCase: RunAutomationRulesUseCase;
  readonly #getReportSummaryUseCase: GetReportSummaryUseCase;
  readonly #appendAuditEntryUseCase: AppendAuditEntryUseCase;
  readonly #getLatestAuditOccurredAtUseCase: GetLatestAuditOccurredAtUseCase;
  readonly #getFamilyGraphUseCase: GetFamilyGraphUseCase;
  readonly #getGenealogyReadModelUseCase: GetGenealogyReadModelUseCase;
  readonly #createFamilyMemberUseCase: CreateFamilyMemberUseCase;
  readonly #createFamilyRelationUseCase: CreateFamilyRelationUseCase;
  readonly #createHouseholdUseCase: CreateHouseholdUseCase;
  readonly #createFamilyBranchUseCase: CreateFamilyBranchUseCase;
  readonly #assignPersonMembershipUseCase: AssignPersonMembershipUseCase;
  readonly #endPersonMembershipUseCase: EndPersonMembershipUseCase;
  readonly #getHouseholdMembershipWorkspaceUseCase: GetHouseholdMembershipWorkspaceUseCase;
  readonly #updatePersonProfileUseCase: UpdatePersonProfileUseCase;
  readonly #archivePersonProfileUseCase: ArchivePersonProfileUseCase;
  readonly #mergePersonProfileUseCase: MergePersonProfileUseCase;
  readonly #requestSafePersonDeletionUseCase: RequestSafePersonDeletionUseCase;
  readonly #undoPersonLifecycleOperationUseCase: UndoPersonLifecycleOperationUseCase;
  readonly #getPersonLifecycleWorkspaceUseCase: GetPersonLifecycleWorkspaceUseCase;
  readonly #scanDataRepairIssuesUseCase: ScanDataRepairIssuesUseCase;
  readonly #previewDataRepairUseCase: PreviewDataRepairUseCase;
  readonly #applyDataRepairUseCase: ApplyDataRepairUseCase;
  readonly #undoDataRepairUseCase: UndoDataRepairUseCase;
  readonly #getDataRepairWorkspaceUseCase: GetDataRepairWorkspaceUseCase;
  readonly #getTimelineReadModelUseCase: GetTimelineReadModelUseCase;
  readonly #getImportantDayDetailsUseCase: GetImportantDayDetailsUseCase;
  readonly #createImportantDayUseCase: CreateImportantDayUseCase;
  readonly #createFamilyLocationUseCase: CreateGovernedFamilyLocationUseCase;
  readonly #getDashboardOverviewUseCase: GetDashboardOverviewUseCase;
  readonly #createFamilyInvitationUseCase: CreateFamilyInvitationUseCase;
  readonly #listFamilyInvitationsUseCase: ListFamilyInvitationsUseCase;
  readonly #inspectFamilyInvitationUseCase: InspectFamilyInvitationUseCase;
  readonly #listFamilyAccountsUseCase: ListFamilyAccountsUseCase;
  readonly #updateFamilyAccountUseCase: UpdateFamilyAccountUseCase;
  readonly #revokeFamilyInvitationUseCase: RevokeFamilyInvitationUseCase;
  readonly #resendFamilyInvitationUseCase: ResendFamilyInvitationUseCase;
  readonly #acceptFamilyInvitationUseCase: AcceptFamilyInvitationUseCase;
  readonly #updateImportantDayParticipantsUseCase: UpdateImportantDayParticipantsUseCase;
  readonly #updateImportantDayInvitationUseCase: UpdateImportantDayInvitationUseCase;
  readonly #updateImportantDayNotesUseCase: UpdateImportantDayNotesUseCase;
  readonly #updateFamilyEventUseCase: UpdateFamilyEventUseCase;
  readonly #setFamilyEventArchivedUseCase: SetFamilyEventArchivedUseCase;
  readonly #listArchivedTimelineEventsUseCase: ListArchivedTimelineEventsUseCase;
  readonly #acknowledgeTimelineNotificationUseCase: AcknowledgeTimelineNotificationUseCase;
  readonly #listHealthRecordsUseCase: ListHealthRecordsUseCase;
  readonly #createHealthRecordUseCase: CreateHealthRecordUseCase;
  readonly #listMedicationPlansUseCase: ListMedicationPlansUseCase;
  readonly #createMedicationPlanUseCase: CreateMedicationPlanUseCase;
  readonly #listFamilyHealthHistoryUseCase: ListFamilyHealthHistoryUseCase;
  readonly #createFamilyHealthHistoryUseCase: CreateFamilyHealthHistoryUseCase;
  readonly #getHealthCareCoordinationCenterUseCase: GetHealthCareCoordinationCenterUseCase;
  readonly #recordHealthCareEntryUseCase: RecordHealthCareEntryUseCase;
  readonly #upsertHealthCareAccessGrantUseCase: UpsertHealthCareAccessGrantUseCase;
  readonly #revokeHealthCareAccessGrantUseCase: RevokeHealthCareAccessGrantUseCase;
  readonly #listLifeRecordsUseCase: ListLifeRecordsUseCase;
  readonly #createLifeRecordUseCase: CreateLifeRecordUseCase;
  readonly #getManagedLifeWorkspaceUseCase: GetManagedLifeWorkspaceUseCase;
  readonly #recordManagedLifeItemUseCase: RecordManagedLifeItemUseCase;
  readonly #getHouseholdOperationsCenterUseCase: GetHouseholdOperationsCenterUseCase;
  readonly #createHouseholdOperationItemUseCase: CreateHouseholdOperationItemUseCase;
  readonly #updateHouseholdOperationItemUseCase: UpdateHouseholdOperationItemUseCase;
  readonly #deleteHouseholdOperationItemUseCase: DeleteHouseholdOperationItemUseCase;
  readonly #getChildEducationCenterUseCase: GetChildEducationCenterUseCase;
  readonly #createChildEducationItemUseCase: CreateChildEducationItemUseCase;
  readonly #updateChildEducationItemUseCase: UpdateChildEducationItemUseCase;
  readonly #deleteChildEducationItemUseCase: DeleteChildEducationItemUseCase;
  readonly #getPlacesTravelCenterUseCase: GetPlacesTravelCenterUseCase;
  readonly #createPlacesTravelItemUseCase: CreatePlacesTravelItemUseCase;
  readonly #updatePlacesTravelItemUseCase: UpdatePlacesTravelItemUseCase;
  readonly #deletePlacesTravelItemUseCase: DeletePlacesTravelItemUseCase;
  readonly #getFamilyAiAssistantCenterUseCase:GetFamilyAiAssistantCenterUseCase;
  readonly #generateFamilyAiSuggestionUseCase:GenerateFamilyAiSuggestionUseCase;
  readonly #reviewFamilyAiSuggestionUseCase:ReviewFamilyAiSuggestionUseCase;
  readonly #getMemoryStudioCenterUseCase:GetMemoryStudioCenterUseCase;
  readonly #createMemoryStudioRecordUseCase:CreateMemoryStudioRecordUseCase;
  readonly #deleteMemoryStudioRecordUseCase:DeleteMemoryStudioRecordUseCase;
  readonly #createMemoryTimeCapsuleUseCase:CreateMemoryTimeCapsuleUseCase;
  readonly #reviewMemoryTimeCapsuleUseCase:ReviewMemoryTimeCapsuleUseCase;
  readonly #transitionMemoryTimeCapsuleUseCase:TransitionMemoryTimeCapsuleUseCase;
  readonly #getSmartHomeEnergyCenterUseCase:GetSmartHomeEnergyCenterUseCase;
  readonly #registerSmartHomeDeviceUseCase:RegisterSmartHomeDeviceUseCase;
  readonly #updateSmartHomeDeviceStatusUseCase:UpdateSmartHomeDeviceStatusUseCase;
  readonly #recordSmartHomeObservationUseCase:RecordSmartHomeObservationUseCase;
  readonly #grantSmartHomeCameraConsentUseCase:GrantSmartHomeCameraConsentUseCase;
  readonly #revokeSmartHomeCameraConsentUseCase:RevokeSmartHomeCameraConsentUseCase;
  readonly #setSmartHomeProcessingUseCase:SetSmartHomeProcessingUseCase;
  readonly #getSignedPluginPlatformCenterUseCase:GetSignedPluginPlatformCenterUseCase;
  readonly #registerSignedPluginReleaseUseCase:RegisterSignedPluginReleaseUseCase;
  readonly #setSignedPluginDesiredStateUseCase:SetSignedPluginDesiredStateUseCase;
  readonly #emergencyDisableSignedPluginUseCase:EmergencyDisableSignedPluginUseCase;
  readonly #rollbackSignedPluginUseCase:RollbackSignedPluginUseCase;
  readonly #signedPluginTrustedKeys:readonly TrustedPluginSigningKey[];
  readonly #getCommunicationSecurityCenterUseCase:GetCommunicationSecurityCenterUseCase;
  readonly #registerCommunicationDeviceCredentialUseCase:RegisterCommunicationDeviceCredentialUseCase;
  readonly #revokeCommunicationDeviceCredentialUseCase:RevokeCommunicationDeviceCredentialUseCase;
  readonly #createCommunicationRoomUseCase:CreateCommunicationRoomUseCase;
  readonly #addCommunicationRoomMemberUseCase:AddCommunicationRoomMemberUseCase;
  readonly #removeCommunicationRoomMemberUseCase:RemoveCommunicationRoomMemberUseCase;
  readonly #rekeyCommunicationRoomAfterDeviceRevocationUseCase:RekeyCommunicationRoomAfterDeviceRevocationUseCase;
  readonly #setCommunicationHistoryAccessUseCase:SetCommunicationHistoryAccessUseCase;
  readonly #freezeCommunicationRoomUseCase:FreezeCommunicationRoomUseCase;
  readonly #getCommunicationMessagingCenterUseCase:GetCommunicationMessagingCenterUseCase;
  readonly #searchCommunicationMessagesUseCase:SearchCommunicationMessagesUseCase;
  readonly #getCommunicationMessageContentUseCase:GetCommunicationMessageContentUseCase;
  readonly #createCommunicationMessageUseCase:CreateCommunicationMessageUseCase;
  readonly #editCommunicationMessageUseCase:EditCommunicationMessageUseCase;
  readonly #setCommunicationMessageLifecycleUseCase:SetCommunicationMessageLifecycleUseCase;
  readonly #annotateCommunicationMessageUseCase:AnnotateCommunicationMessageUseCase;
  readonly #updateCommunicationDeliveryUseCase:UpdateCommunicationDeliveryUseCase;
  readonly #setCommunicationPresenceUseCase:SetCommunicationPresenceUseCase;
  readonly #setCommunicationRetentionPolicyUseCase:SetCommunicationRetentionPolicyUseCase;
  readonly #maintainCommunicationMessagePayloadVaultUseCase:MaintainCommunicationMessagePayloadVaultUseCase;
  readonly #getCommunicationFileSharingCenterUseCase:GetCommunicationFileSharingCenterUseCase;
  readonly #getCommunicationAuditArchiveSafeCenterUseCase:GetCommunicationAuditArchiveSafeCenterUseCase;
  readonly #getCommunicationFileSafePreviewUseCase:GetCommunicationFileSafePreviewUseCase;
  readonly #maintainCommunicationFilePayloadVaultUseCase:MaintainCommunicationFilePayloadVaultUseCase;
  readonly #prepareCommunicationFileUseCase:PrepareCommunicationFileUseCase;
  readonly #applyCommunicationFileSharingCommandUseCase:ApplyCommunicationFileSharingCommandUseCase;
  readonly #getCommunicationRealtimeCallingCenterUseCase:GetCommunicationRealtimeCallingCenterUseCase;
  readonly #createCommunicationCallUseCase:CreateCommunicationCallUseCase;
  readonly #runCommunicationCallPreflightUseCase:RunCommunicationCallPreflightUseCase;
  readonly #updateCommunicationCallControlsUseCase:UpdateCommunicationCallControlsUseCase;
  readonly #advanceCommunicationCallUseCase:AdvanceCommunicationCallUseCase;
  readonly #setCommunicationCallPreferencesUseCase:SetCommunicationCallPreferencesUseCase;
  readonly #getCommunicationRecordingCenterUseCase:GetCommunicationRecordingCenterUseCase;
  readonly #createCommunicationRecordingRequestUseCase:CreateCommunicationRecordingRequestUseCase;
  readonly #decideCommunicationRecordingConsentUseCase:DecideCommunicationRecordingConsentUseCase;
  readonly #withdrawCommunicationRecordingConsentUseCase:WithdrawCommunicationRecordingConsentUseCase;
  readonly #addCommunicationRecordingLateJoinerUseCase:AddCommunicationRecordingLateJoinerUseCase;
  readonly #setCommunicationRecordingSegmentUseCase:SetCommunicationRecordingSegmentUseCase;
  readonly #updateCommunicationRecordingRetentionUseCase:UpdateCommunicationRecordingRetentionUseCase;
  readonly #requestCommunicationRecordingDeletionUseCase:RequestCommunicationRecordingDeletionUseCase;
  readonly #getLocalTranslationCenterUseCase:GetLocalTranslationCenterUseCase;
  readonly #updateLocalTranslationProfileUseCase:UpdateLocalTranslationProfileUseCase;
  readonly #addLocalTranslationDictionaryEntryUseCase:AddLocalTranslationDictionaryEntryUseCase;
  readonly #updateLocalTranslationDictionaryEntryUseCase:UpdateLocalTranslationDictionaryEntryUseCase;
  readonly #deleteLocalTranslationDictionaryEntryUseCase:DeleteLocalTranslationDictionaryEntryUseCase;
  readonly #prepareLocalTranslationRequestUseCase:PrepareLocalTranslationRequestUseCase;
  readonly #recordLocalTranslationCorrectionUseCase:RecordLocalTranslationCorrectionUseCase;
  readonly #cancelLocalTranslationRequestUseCase:CancelLocalTranslationRequestUseCase;
  readonly #getFamilyMeetingCenterUseCase:GetFamilyMeetingCenterUseCase;
  readonly #getFamilyMeetingMinutesUseCase:GetFamilyMeetingMinutesUseCase;
  readonly #createFamilyMeetingUseCase:CreateFamilyMeetingUseCase;
  readonly #updateFamilyMeetingPlanUseCase:UpdateFamilyMeetingPlanUseCase;
  readonly #setFamilyMeetingStateUseCase:SetFamilyMeetingStateUseCase;
  readonly #upsertFamilyMeetingParticipantUseCase:UpsertFamilyMeetingParticipantUseCase;
  readonly #upsertFamilyMeetingAgendaItemUseCase:UpsertFamilyMeetingAgendaItemUseCase;
  readonly #createFamilyMeetingPollUseCase:CreateFamilyMeetingPollUseCase;
  readonly #castFamilyMeetingVoteUseCase:CastFamilyMeetingVoteUseCase;
  readonly #recordFamilyMeetingDecisionUseCase:RecordFamilyMeetingDecisionUseCase;
  readonly #upsertFamilyMeetingTaskUseCase:UpsertFamilyMeetingTaskUseCase;
  readonly #addFamilyMeetingCollaborationUseCase:AddFamilyMeetingCollaborationUseCase;
  readonly #prepareFamilyMeetingAiMinutesUseCase:PrepareFamilyMeetingAiMinutesUseCase;
  readonly #finalizeFamilyMeetingMinutesUseCase:FinalizeFamilyMeetingMinutesUseCase;
  readonly #prepareFamilyEmergencyCardExportUseCase: PrepareFamilyEmergencyCardExportUseCase;
  readonly #recordFamilyEmergencyCardExportCompletionUseCase: RecordFamilyEmergencyCardExportCompletionUseCase;
  readonly #listFinanceRecordsUseCase: ListFinanceRecordsUseCase;
  readonly #createFinanceRecordUseCase: CreateFinanceRecordUseCase;
  readonly #listFinanceValuationsUseCase: ListFinanceValuationsUseCase;
  readonly #createFinanceValuationUseCase: CreateFinanceValuationUseCase;
  readonly #listBankInstitutionsUseCase: ListBankInstitutionsUseCase;
  readonly #listBankAccountsUseCase: ListBankAccountsUseCase;
  readonly #validateIbanUseCase: ValidateIbanUseCase;
  readonly #createBankAccountUseCase: CreateBankAccountUseCase;
  readonly #listPaymentCardsUseCase: ListPaymentCardsUseCase;
  readonly #createPaymentCardUseCase: CreatePaymentCardUseCase;
  readonly #listLoanAccountsUseCase: ListLoanAccountsUseCase;
  readonly #createLoanAccountUseCase: CreateLoanAccountUseCase;
  readonly #recordLoanPaymentUseCase: RecordLoanPaymentUseCase;
  readonly #getFinancePlanningWorkspaceUseCase: GetFinancePlanningWorkspaceUseCase;
  readonly #recordFinancePlanningItemUseCase: RecordFinancePlanningItemUseCase;
  readonly #commitFinanceImportBatchUseCase: CommitFinanceImportBatchUseCase;
  readonly #getLongTermPortfolioWorkspaceUseCase: GetLongTermPortfolioWorkspaceUseCase;
  readonly #recordLongTermPortfolioItemUseCase: RecordLongTermPortfolioItemUseCase;
  readonly #getAccessibilityPreferencesUseCase: GetAccessibilityPreferencesUseCase;
  readonly #updateAccessibilityPreferencesUseCase: UpdateAccessibilityPreferencesUseCase;
  readonly #getFormDraftWorkspaceUseCase: GetFormDraftWorkspaceUseCase;
  readonly #saveFormDraftUseCase: SaveFormDraftUseCase;
  readonly #undoFormDraftUseCase: UndoFormDraftUseCase;
  readonly #getPrivacyOwnershipControlCenterUseCase: GetPrivacyOwnershipControlCenterUseCase;
  readonly #manageAiMemoryUseCase: ManageAiMemoryUseCase;
  readonly #manageDataRightsRequestUseCase: ManageDataRightsRequestUseCase;
  readonly #finalizeEncryptedPrivacyExportUseCase: FinalizeEncryptedPrivacyExportUseCase;
  readonly #managePrivacyIncidentUseCase: ManagePrivacyIncidentUseCase;
  readonly #simulatePermissionVisibilityUseCase: SimulatePermissionVisibilityUseCase;
  readonly #getIdentityAccessCredentialCenterUseCase: GetIdentityAccessCredentialCenterUseCase;
  readonly #beginPasskeyRegistrationUseCase: BeginPasskeyRegistrationUseCase;
  readonly #beginPasskeyAuthenticationUseCase: BeginPasskeyAuthenticationUseCase;
  readonly #completePasskeyRegistrationUseCase: CompletePasskeyRegistrationUseCase;
  readonly #authenticateWithPasskeyUseCase: AuthenticateWithPasskeyUseCase;
  readonly #revokePasskeyUseCase: RevokePasskeyUseCase;
  readonly #recoverLostPasskeyUseCase: RecoverLostPasskeyUseCase;
  readonly #beginFederatedIdentityLinkUseCase: BeginFederatedIdentityLinkUseCase;
  readonly #linkFederatedIdentityUseCase: LinkFederatedIdentityUseCase;
  readonly #unlinkFederatedIdentityUseCase: UnlinkFederatedIdentityUseCase;
  readonly #issueTemporaryVerifiableCredentialUseCase: IssueTemporaryVerifiableCredentialUseCase;
  readonly #revokeTemporaryVerifiableCredentialUseCase: RevokeTemporaryVerifiableCredentialUseCase;
  readonly #verifyTemporaryVerifiableCredentialUseCase: VerifyTemporaryVerifiableCredentialUseCase;
  readonly #createReadOnlyCompanionSnapshotUseCase: CreateReadOnlyCompanionSnapshotUseCase;
  readonly #listArchiveItemsUseCase: ListArchiveItemsUseCase;
  readonly #searchArchiveItemsUseCase: SearchArchiveItemsUseCase;
  readonly #searchUnifiedAuthorizedRecordsUseCase: SearchUnifiedAuthorizedRecordsUseCase;
  readonly #prepareArchiveOpenUseCase: PrepareArchiveOpenUseCase;
  readonly #recordArchiveOpenedUseCase: RecordArchiveOpenedUseCase;
  readonly #authorizeEmergencyArchiveReadUseCase: AuthorizeEmergencyArchiveReadUseCase;
  readonly #listArchiveVersionsUseCase: ListArchiveVersionsUseCase;
  readonly #listArchiveRelationEvidenceUseCase: ListArchiveRelationEvidenceUseCase;
  readonly #listArchiveRelationEvidenceHistoryUseCase: ListArchiveRelationEvidenceHistoryUseCase;
  readonly #addArchiveRelationEvidenceUseCase: AddArchiveRelationEvidenceUseCase;
  readonly #removeArchiveRelationEvidenceUseCase: RemoveArchiveRelationEvidenceUseCase;
  readonly #addArchiveItemVersionUseCase: AddArchiveItemVersionUseCase;
  readonly #importArchiveItemUseCase: ImportArchiveItemUseCase;
  readonly #listArchiveRetentionPoliciesUseCase: ListArchiveRetentionPoliciesUseCase;
  readonly #listArchiveRetentionStatusUseCase: ListArchiveRetentionStatusUseCase;
  readonly #createArchiveRetentionPolicyUseCase: CreateArchiveRetentionPolicyUseCase;
  readonly #assignArchiveRetentionPolicyUseCase: AssignArchiveRetentionPolicyUseCase;
  readonly #prepareArchiveDestructionUseCase: PrepareArchiveDestructionUseCase;
  readonly #markArchiveDestroyedUseCase: MarkArchiveDestroyedUseCase;
  readonly #reattestLegacyArchiveOwnershipUseCase: ReattestLegacyArchiveOwnershipUseCase;
  readonly #getLocalGovernedOcrCenterUseCase: GetLocalGovernedOcrCenterUseCase;
  readonly #getLocalGovernedOcrResultUseCase: GetLocalGovernedOcrResultUseCase;
  readonly #searchLocalGovernedOcrUseCase: SearchLocalGovernedOcrUseCase;
  readonly #createLocalGovernedOcrJobUseCase: CreateLocalGovernedOcrJobUseCase;
  readonly #runLocalGovernedOcrJobUseCase: RunLocalGovernedOcrJobUseCase;
  readonly #cancelLocalGovernedOcrJobUseCase: CancelLocalGovernedOcrJobUseCase;
  readonly #correctLocalGovernedOcrResultUseCase: CorrectLocalGovernedOcrResultUseCase;
  readonly #rerunLocalGovernedOcrJobUseCase: RerunLocalGovernedOcrJobUseCase;
  readonly #deleteLocalGovernedOcrJobUseCase: DeleteLocalGovernedOcrJobUseCase;
  readonly #reconcileLocalGovernedOcrAuthorizationUseCase: ReconcileLocalGovernedOcrAuthorizationUseCase;
  readonly #reconcileLocalGovernedOcrRetentionUseCase: ReconcileLocalGovernedOcrRetentionUseCase;
  readonly #sweepLocalGovernedOcrOrphansUseCase: SweepLocalGovernedOcrOrphansUseCase;
  readonly #setLocalGovernedOcrEnabledUseCase: SetLocalGovernedOcrEnabledUseCase;
  readonly #propagateLocalGovernedOcrSourceDeletionUseCase: PropagateLocalGovernedOcrSourceDeletionUseCase;
  readonly #listDataRetentionPoliciesUseCase: ListDataRetentionPoliciesUseCase;
  readonly #listDataLifecycleRecordsUseCase: ListDataLifecycleRecordsUseCase;
  readonly #createDataRetentionPolicyUseCase: CreateDataRetentionPolicyUseCase;
  readonly #archiveDataResourceUseCase: ArchiveDataResourceUseCase;
  readonly #restoreDataResourceUseCase: RestoreDataResourceUseCase;
  readonly #requestDataPurgeUseCase: RequestDataPurgeUseCase;
  readonly #cancelDataPurgeUseCase: CancelDataPurgeUseCase;
  readonly #executeDataPurgeUseCase: ExecuteDataPurgeUseCase;
  readonly #setDataLegalHoldUseCase: SetDataLegalHoldUseCase;
  readonly #listPendingBackupPropagationUseCase: ListPendingBackupPropagationUseCase;
  readonly #listBackupPropagationRunsUseCase: ListBackupPropagationRunsUseCase;
  readonly #completeBackupPropagationUseCase: CompleteBackupPropagationUseCase;
  readonly #recordBackupPropagationRunUseCase: RecordBackupPropagationRunUseCase;
  readonly #getBackupCleanRewritePolicyUseCase: GetBackupCleanRewritePolicyUseCase;
  readonly #listBackupCleanRewriteRunsUseCase: ListBackupCleanRewriteRunsUseCase;
  readonly #updateBackupCleanRewritePolicyUseCase: UpdateBackupCleanRewritePolicyUseCase;
  readonly #claimBackupCleanRewriteUseCase: ClaimBackupCleanRewriteUseCase;
  readonly #completeBackupCleanRewriteUseCase: CompleteBackupCleanRewriteUseCase;
  readonly #recoverInterruptedBackupCleanRewriteUseCase: RecoverInterruptedBackupCleanRewriteUseCase;
  readonly #quarantineManagedBackupArtifactsUseCase: QuarantineManagedBackupArtifactsUseCase;
  readonly #getBackupQuarantinePolicyUseCase: GetBackupQuarantinePolicyUseCase;
  readonly #listBackupQuarantineBatchesUseCase: ListBackupQuarantineBatchesUseCase;
  readonly #registerBackupQuarantineBatchUseCase: RegisterBackupQuarantineBatchUseCase;
  readonly #updateBackupQuarantinePolicyUseCase: UpdateBackupQuarantinePolicyUseCase;
  readonly #setBackupQuarantineLegalHoldUseCase: SetBackupQuarantineLegalHoldUseCase;
  readonly #destroyBackupQuarantineBatchUseCase: DestroyBackupQuarantineBatchUseCase;
  readonly #listExternalBackupCopiesUseCase: ListExternalBackupCopiesUseCase;
  readonly #getExternalBackupInventorySummaryUseCase: GetExternalBackupInventorySummaryUseCase;
  readonly #registerExternalBackupCopyUseCase: RegisterExternalBackupCopyUseCase;
  readonly #reviewExternalBackupCopyUseCase: ReviewExternalBackupCopyUseCase;
  readonly #setExternalBackupCopyLegalHoldUseCase: SetExternalBackupCopyLegalHoldUseCase;
  readonly #attestExternalBackupCopyDestroyedUseCase: AttestExternalBackupCopyDestroyedUseCase;
  readonly #listExternalBackupEvidenceIssuersUseCase: ListExternalBackupEvidenceIssuersUseCase;
  readonly #listExternalBackupEvidenceIssuerRotationsUseCase: ListExternalBackupEvidenceIssuerRotationsUseCase;
  readonly #listExternalBackupDestructionEvidenceUseCase: ListExternalBackupDestructionEvidenceUseCase;
  readonly #registerExternalBackupEvidenceIssuerUseCase: RegisterExternalBackupEvidenceIssuerUseCase;
  readonly #rotateExternalBackupEvidenceIssuerUseCase: RotateExternalBackupEvidenceIssuerUseCase;
  readonly #revokeExternalBackupEvidenceIssuerUseCase: RevokeExternalBackupEvidenceIssuerUseCase;
  readonly #verifyExternalBackupDestructionEvidenceUseCase: VerifyExternalBackupDestructionEvidenceUseCase;
  readonly #listExternalBackupEvidenceRevocationListsUseCase: ListExternalBackupEvidenceRevocationListsUseCase;
  readonly #applyExternalBackupEvidenceRevocationListUseCase: ApplyExternalBackupEvidenceRevocationListUseCase;
  readonly #listExternalBackupRevocationEndpointsUseCase: ListExternalBackupRevocationEndpointsUseCase;
  readonly #findExternalBackupRevocationEndpointUseCase: FindExternalBackupRevocationEndpointUseCase;
  readonly #upsertExternalBackupRevocationEndpointUseCase: UpsertExternalBackupRevocationEndpointUseCase;
  readonly #recordExternalBackupRevocationEndpointFetchUseCase: RecordExternalBackupRevocationEndpointFetchUseCase;
  readonly #familyDataImportService: FamilyDataImportService;
  readonly #largeFamilyReadModelService: LargeFamilyReadModelService;
  readonly #entityCatalogService: EntityCatalogService;
  readonly #listArchiveCategoriesUseCase: ListArchiveCategoriesUseCase;
  readonly #listArchiveClassificationsUseCase: ListArchiveClassificationsUseCase;
  readonly #createArchiveCategoryUseCase: CreateArchiveCategoryUseCase;
  readonly #updateArchiveClassificationUseCase: UpdateArchiveClassificationUseCase;
  readonly #listAiConsentsUseCase: ListAiConsentsUseCase;
  readonly #upsertAiConsentUseCase: UpsertAiConsentUseCase;
  readonly #previewAiAccessUseCase: PreviewAiAccessUseCase;
  readonly #listSensitiveDataProfilesUseCase: ListSensitiveDataProfilesUseCase;
  readonly #upsertSensitiveDataConsentUseCase: UpsertSensitiveDataConsentUseCase;
  readonly #previewSensitiveExportUseCase: PreviewSensitiveExportUseCase;
  readonly #listDigitalLegacyPlansUseCase: ListDigitalLegacyPlansUseCase;
  readonly #listLegacyGrantsUseCase: ListLegacyGrantsUseCase;
  readonly #listLegacyApprovalsUseCase: ListLegacyApprovalsUseCase;
  readonly #upsertDigitalLegacyPlanUseCase: UpsertDigitalLegacyPlanUseCase;
  readonly #upsertLegacyGrantUseCase: UpsertLegacyGrantUseCase;
  readonly #requestLegacyExecutionUseCase: RequestLegacyExecutionUseCase;
  readonly #approveLegacyExecutionUseCase: ApproveLegacyExecutionUseCase;
  readonly #finalizeLegacyExecutionUseCase: FinalizeLegacyExecutionUseCase;
  readonly #cancelLegacyExecutionUseCase: CancelLegacyExecutionUseCase;
  readonly #logger: Logger | undefined;
  readonly #eventDispatcher: EventDispatcher;
  readonly #runningBackupTargets = new Set<string>();
  readonly #runningTasks = new Map<string, { taskType:string; label:string; startedAt:string; warningThresholdMs:number }>();
  readonly #mutationRevisionService = new FamilyMutationRevisionService();

  #recordMutation(input: FamilyMutationResultInput): FamilyMutationResultView {
    const latestAuditResult = this.#getLatestAuditOccurredAtUseCase.execute(
      this.#auditReadApplicationContext('mutation-revision')
    );
    if (!latestAuditResult.ok) throw new Error(`[${latestAuditResult.error.code}] ${latestAuditResult.error.message}`);
    return this.#mutationRevisionService.record(input, latestAuditResult.value);
  }

  async #readCommittedEventView(eventId: string): Promise<FamilyEventView | undefined> {
    try {
      return await this.getImportantDayDetails(eventId);
    } catch (error) {
      this.#logger?.warn({
        timestamp: this.#clock.now(),
        service: 'desktop-main',
        process: 'main',
        event: 'timeline.post_commit_view_unavailable',
        correlationId: this.#correlation?.current()?.correlationId
          ?? asCorrelationId(`timeline-post-commit-${randomUUID()}`),
        outcome: 'partial',
        metadata: {
          eventId,
          errorName: error instanceof Error ? error.name : typeof error
        }
      });
      return undefined;
    }
  }

  public constructor(options: DataStoreOptions) {
    const productionArchivePolicy = archiveProductionPolicyConfiguration(options);
    this.#repositories = createSqliteRepositoryCompositionRoot({
      ...(options.repositoryExecutionPolicyGuard
        ? { executionPolicyGuard: options.repositoryExecutionPolicyGuard }
        : {})
    });
    this.#clock = options.clock ?? new SystemClock();
    this.#signedPluginTrustedKeys=Object.freeze((options.signedPluginTrustedKeys??[]).map(key=>Object.freeze({...key})));
    this.#correlation = options.correlation;
    this.#logger = options.logger;
    const storageLayoutResult = new ResolveFamilyStorageLayoutUseCase(
      new NodeFamilyStorageLayoutPort()
    ).execute(
      this.#correlation?.current()?.correlationId
        ?? asCorrelationId(`family-storage-layout-${randomUUID()}`),
      {
        databasePath: options.databasePath,
        ...(options.deviceIdentityPath === undefined
          ? {}
          : { deviceIdentityPath: options.deviceIdentityPath }),
        ...(options.archivePath === undefined ? {} : { archivePath: options.archivePath })
      }
    );
    if (!storageLayoutResult.ok) {
      throw new Error(`[${storageLayoutResult.error.code}] ${storageLayoutResult.error.message}`);
    }
    const storageLayout = storageLayoutResult.value;
    this.#databasePath = storageLayout.databasePath;
    this.#databaseSnapshotProvider = options.databaseSnapshotProvider;
    this.#restoreDatabasePath = options.restoreDatabasePath ?? storageLayout.databasePath;
    this.#deviceIdentityProvider = new FileDeviceIdentityProvider(
      storageLayout.deviceIdentityPath,
      this.#clock,
      options.deviceSecretProtector
    );
    this.#securityEventReceiptStore = new SecurityEventReceiptStore(
      options.securityEventReceiptPath ?? `${storageLayout.databasePath}.security-receipts.json`,
      options.protectedSideArtifacts
    );
    this.#archivePath = storageLayout.archivePath;
    this.#keyPath = storageLayout.vaultKeyPath;
    this.#managedBackupPasswordProvider = options.backupSecretProtector !== undefined
      && options.backupPasswordPath !== undefined
      ? new ManagedBackupPasswordProvider(options.backupPasswordPath, options.backupSecretProtector)
      : undefined;
    const restoreRecovery = recoverInterruptedFullBackupRestore({
      databasePath: storageLayout.databasePath,
      keyPath: storageLayout.vaultKeyPath,
      archivePath: storageLayout.archivePath
    });
    if (restoreRecovery.recovered) {
      this.#logger?.warn({
        timestamp: this.#clock.now(),
        service: 'desktop-main',
        process: 'main',
        event: 'backup.restore_interrupted_recovered',
        correlationId: this.#correlation?.current()?.correlationId
          ?? asCorrelationId(`restore-recovery-${randomUUID()}`),
        outcome: 'success',
        metadata: {
          action: restoreRecovery.action,
          transactionId: restoreRecovery.transactionId ?? 'unknown'
        }
      });
    }
    const archiveVaultKeyProvider = options.vaultKeySecretProtector
      ? new ProtectedArchiveVaultKeyProvider(
        this.#keyPath,
        options.vaultKeySecretProtector,
        this.#clock
      )
      : undefined;
    const archiveVaultFiles = new FileSystemArchiveVaultFilePort({
      archivePath: this.#archivePath,
      keyPath: this.#keyPath,
      ...(archiveVaultKeyProvider ? { keyProvider: archiveVaultKeyProvider } : {}),
      temporaryOpenPath: storageLayout.temporaryOpenPath
    });
    this.#storeArchiveFileUseCase = new StoreArchiveFileUseCase(archiveVaultFiles);
    this.#materializeArchiveFileUseCase = new MaterializeArchiveFileUseCase(archiveVaultFiles);
    this.#readArchiveFileBytesUseCase = new ReadArchiveFileBytesUseCase(archiveVaultFiles);
    this.#destroyArchiveFileUseCase = new DestroyArchiveFileUseCase(archiveVaultFiles);
    const operationalArtifactFiles = options.operationalArtifactFiles ?? new FileSystemOperationalArtifactFilePort();
    this.#writeOperationalTextArtifactUseCase = new WriteOperationalTextArtifactUseCase(operationalArtifactFiles);
    this.#writeOperationalGzipArtifactUseCase = new WriteOperationalGzipArtifactUseCase(operationalArtifactFiles);
    this.#verifyOperationalArtifactUseCase = new VerifyOperationalArtifactUseCase(operationalArtifactFiles);
    this.#readOperationalTextArtifactUseCase = new ReadOperationalTextArtifactUseCase(operationalArtifactFiles);
    this.#readOperationalGzipArtifactUseCase = new ReadOperationalGzipArtifactUseCase(operationalArtifactFiles);
    this.#databaseRuntime = new SqliteFamilyDatabaseRuntime({
      databasePath: options.databasePath,
      ...(options.databaseConnection === undefined ? {} : { databaseConnection: options.databaseConnection, closeDatabaseOnClose: false }),
      ...(options.skipFileMigrationSafetyBackup === undefined ? {} : { skipFileMigrationSafetyBackup: options.skipFileMigrationSafetyBackup }),
      applicationVersion: options.applicationVersion ?? 'development',
      clock: this.#clock,
      ...(options.databaseConfig === undefined ? {} : { databaseConfig: options.databaseConfig }),
      ...(options.migrationBackupDirectory === undefined
        ? {}
        : { migrationBackupDirectory: options.migrationBackupDirectory }),
      ...(options.onMigrationCompleted === undefined
        ? {}
        : { onMigrationCompleted: options.onMigrationCompleted })
    });
    this.#database = this.#databaseRuntime.database;
    this.#transactionExecutor = this.#databaseRuntime.transactionExecutor;
    const federatedProviderProvisioning=this.#transactionExecutor.execute(
      this.#correlation?.current()?.correlationId ?? asCorrelationId(`identity-provider-provision-${randomUUID()}`),
      (transaction) => {
        const provisioned=this.#repositories.identityAccessCredentialRepository.provisionFederatedProviderConfigurations({
          transaction:transaction.transaction,
          actor:{userId:asUserId('deployment-configuration'),roles:['system']},
          correlationId:this.#correlation?.current()?.correlationId ?? asCorrelationId(`identity-provider-provision-${randomUUID()}`),
          occurredAt:transaction.occurredAt
        },options.federatedProviderConfigurations??[]);
        if(!provisioned.ok)throw new Error(`[${provisioned.error.code}] ${provisioned.error.message}`);
        const cutoff=asIsoDateTime(new Date(Date.parse(transaction.occurredAt)-30*86_400_000).toISOString());
        const pruned=this.#repositories.identityAccessCredentialRepository.pruneTerminalChallenges({
          transaction:transaction.transaction,
          actor:{userId:asUserId('deployment-configuration'),roles:['system']},
          correlationId:this.#correlation?.current()?.correlationId ?? asCorrelationId(`identity-challenge-retention-${randomUUID()}`),
          occurredAt:transaction.occurredAt
        },cutoff);
        if(!pruned.ok)throw new Error(`[${pruned.error.code}] ${pruned.error.message}`);
        return ok(undefined);
      }
    );
    if(!federatedProviderProvisioning.ok)throw new Error(`[${federatedProviderProvisioning.error.code}] Federated provider deployment configuration could not be provisioned.`);
    const authSessionPort = new InMemoryAuthSessionPort(
      this.#clock,
      options.securityConfig?.sessionIdleTimeoutMinutes ?? 15
    );
    this.#sessionManager = authSessionPort;
    this.#getSessionLockStateUseCase = new GetSessionLockStateUseCase(authSessionPort);
    this.#recordSessionActivityUseCase = new RecordSessionActivityUseCase(authSessionPort);
    this.#lockSessionUseCase = new LockSessionUseCase(authSessionPort);
    this.#getDesktopSecurityPostureUseCase = new GetDesktopSecurityPostureUseCase();
    const authUnitOfWork = new RepositoryBackedAuthApplicationUnitOfWork({
      transactionExecutor: this.#transactionExecutor,
      accountRepository: this.#repositories.accountRepository,
      auditRepository: this.#repositories.auditRepository,
      bootstrapRepository: this.#repositories.bootstrapRepository,
      objectPermissionRepository: this.#repositories.objectPermissionRepository,
      trustedDeviceRepository: this.#repositories.trustedDeviceRepository,
      windowsHelloRegistrationRepository: this.#repositories.windowsHelloRegistrationRepository,
      ...(options.mfaSecretProtector === undefined ? {} : { mfaSecretProtector: options.mfaSecretProtector })
    });
    const passwordService = new NodePasswordService();
    const secondFactorService = new NodeSecondFactorService();
    const deviceProofVerifier = new NodeDeviceProofVerifier();
    this.#getAuthStateUseCase = new GetAuthStateUseCase(authUnitOfWork, authSessionPort);
    this.#setupAdminUseCase = new SetupAdminUseCase(
      authUnitOfWork,
      passwordService,
      deviceProofVerifier,
      authSessionPort
    );
    this.#loginUseCase = new LoginUseCase(
      authUnitOfWork,
      passwordService,
      secondFactorService,
      deviceProofVerifier,
      authSessionPort,
      {
        maximumFailedAttempts: options.securityConfig?.maximumFailedLoginAttempts ?? 5,
        lockMinutes: 15
      }
    );
    this.#logoutUseCase = new LogoutUseCase(authUnitOfWork, authSessionPort);
    this.#changePasswordUseCase = new ChangePasswordUseCase(authUnitOfWork, passwordService, authSessionPort);
    this.#beginTwoFactorSetupUseCase = new BeginTwoFactorSetupUseCase(authUnitOfWork, secondFactorService, authSessionPort);
    this.#enableTwoFactorUseCase = new EnableTwoFactorUseCase(authUnitOfWork, secondFactorService, authSessionPort);
    this.#disableTwoFactorUseCase = new DisableTwoFactorUseCase(authUnitOfWork, passwordService, secondFactorService, authSessionPort);
    this.#trustCurrentDeviceUseCase = new TrustCurrentDeviceUseCase(authUnitOfWork, passwordService, secondFactorService, deviceProofVerifier, authSessionPort);
    this.#reauthorizeCurrentDeviceAfterRecoveryUseCase = new ReauthorizeCurrentDeviceAfterRecoveryUseCase(authUnitOfWork, passwordService, secondFactorService, deviceProofVerifier, authSessionPort);
    this.#rotateAccountSecurityEpochAfterRecoveryUseCase = new RotateAccountSecurityEpochAfterRecoveryUseCase(authUnitOfWork, authSessionPort);
    this.#listTrustedDevicesUseCase = new ListTrustedDevicesUseCase(authUnitOfWork, authSessionPort);
    this.#revokeTrustedDeviceUseCase = new RevokeTrustedDeviceUseCase(authUnitOfWork, authSessionPort);
    const windowsHelloPlatform = options.windowsHelloPlatform
      ?? new PowerShellWindowsHelloPlatformAdapter(options.windowsHelloWindowHandleProvider);
    const windowsHelloDeviceBinding = options.windowsHelloDeviceBinding ?? {
      current: () => {
        const identity = this.#deviceIdentityProvider.snapshot();
        return {
          deviceId: identity.deviceId,
          deviceFingerprint: identity.fingerprint,
          displayName: `${platform()} ${arch()}`
        };
      }
    };
    this.#getWindowsHelloStateUseCase = new GetWindowsHelloStateUseCase(
      authUnitOfWork,
      windowsHelloPlatform,
      windowsHelloDeviceBinding,
      authSessionPort
    );
    this.#enrollWindowsHelloUseCase = new EnrollWindowsHelloUseCase(
      authUnitOfWork,
      windowsHelloPlatform,
      windowsHelloDeviceBinding,
      passwordService,
      secondFactorService,
      authSessionPort
    );
    this.#loginWithWindowsHelloUseCase = new LoginWithWindowsHelloUseCase(
      authUnitOfWork,
      windowsHelloPlatform,
      windowsHelloDeviceBinding,
      authSessionPort
    );
    this.#reauthenticateWithWindowsHelloUseCase = new ReauthenticateWithWindowsHelloUseCase(
      authUnitOfWork,
      windowsHelloPlatform,
      windowsHelloDeviceBinding,
      authSessionPort
    );
    const authorizationDependencies = {
      transactionExecutor: this.#transactionExecutor,
      accountRepository: this.#repositories.accountRepository,
      permissionRepository: this.#repositories.objectPermissionRepository,
      offlineCapabilityLeaseRepository: this.#repositories.offlineCapabilityLeaseRepository,
      householdMembershipRepository: this.#repositories.householdMembershipRepository,
      auditRepository: this.#repositories.auditRepository
    } as const;
    const authorizationQuery = new RepositoryBackedAuthorizationQueryPort(authorizationDependencies);
    const authorizationUnitOfWork = new RepositoryBackedAuthorizationUnitOfWork(authorizationDependencies);
    this.#evaluateAuthorizationUseCase = new EvaluateAuthorizationUseCase(authorizationQuery);
    this.#listObjectPermissionsUseCase = new ListObjectPermissionsUseCase(authorizationQuery);
    this.#upsertObjectPermissionUseCase = new UpsertObjectPermissionUseCase(authorizationUnitOfWork);
    this.#deleteObjectPermissionUseCase = new DeleteObjectPermissionUseCase(authorizationUnitOfWork);
    this.#listOfflineCapabilityLeasesUseCase = new ListOfflineCapabilityLeasesUseCase(authorizationQuery);
    this.#issueOfflineCapabilityLeaseUseCase = new IssueOfflineCapabilityLeaseUseCase(authorizationUnitOfWork);
    this.#revokeOfflineCapabilityLeaseUseCase = new RevokeOfflineCapabilityLeaseUseCase(authorizationUnitOfWork);
    this.#listAuditEntriesUseCase = new ListAuditEntriesUseCase(authorizationQuery);
    this.#verifyAuditIntegrityUseCase = new VerifyAuditIntegrityUseCase(authorizationQuery);
    const dataLifecycleDependencies = {
      transactionExecutor: this.#transactionExecutor,
      dataLifecycleRepository: this.#repositories.dataLifecycleRepository,
      accountRepository: this.#repositories.accountRepository,
      permissionRepository: this.#repositories.objectPermissionRepository,
      auditRepository: this.#repositories.auditRepository,
      outboxRepository: this.#repositories.outboxRepository
    } as const;
    const dataLifecycleQuery = new RepositoryBackedDataLifecycleQueryPort(dataLifecycleDependencies);
    const dataLifecycleUnit = new RepositoryBackedDataLifecycleUnitOfWork(dataLifecycleDependencies);
    const strongAuthentication = new RepositoryBackedStrongAuthenticationPort(authUnitOfWork, passwordService, secondFactorService, authSessionPort);
    this.#strongAuthentication = strongAuthentication;
    const privacyControlDependencies = {
      transactionExecutor: this.#transactionExecutor,
      accountRepository: this.#repositories.accountRepository,
      permissionRepository: this.#repositories.objectPermissionRepository,
      trustedDeviceRepository: this.#repositories.trustedDeviceRepository,
      offlineCapabilityLeaseRepository: this.#repositories.offlineCapabilityLeaseRepository,
      consentRepository: this.#repositories.aiConsentRepository,
      auditRepository: this.#repositories.auditRepository,
      currentDeviceId: () => this.#deviceIdentityProvider.snapshot().deviceId
    } as const;
    const privacyControlQuery = new RepositoryBackedPrivacyControlQueryPort(privacyControlDependencies);
    const privacyControlUnitOfWork = new RepositoryBackedPrivacyControlUnitOfWork(privacyControlDependencies);
    this.#getPrivacyControlCenterUseCase = new GetPrivacyControlCenterUseCase(privacyControlQuery, authSessionPort);
    this.#upsertLiveLocationConsentUseCase = new UpsertLiveLocationConsentUseCase(privacyControlUnitOfWork, authSessionPort);
    this.#shutdownLostDeviceAuthorityUseCase = new ShutdownLostDeviceAuthorityUseCase(
      privacyControlUnitOfWork,
      authSessionPort,
      strongAuthentication
    );
    this.#entityCatalogService = new EntityCatalogService({
      transactionExecutor: this.#transactionExecutor,
      repository: this.#repositories.entityCatalogRepository,
      currentAccountId: () => this.#requireAuth(),
      canReadEvent: (eventId) => this.#hasObjectPermission(this.#requireAuth(), 'event', eventId, 'read')
    });
    this.#listDataRetentionPoliciesUseCase = new ListDataRetentionPoliciesUseCase(dataLifecycleQuery);
    this.#listDataLifecycleRecordsUseCase = new ListDataLifecycleRecordsUseCase(dataLifecycleQuery);
    this.#createDataRetentionPolicyUseCase = new CreateDataRetentionPolicyUseCase(dataLifecycleUnit);
    this.#archiveDataResourceUseCase = new ArchiveDataResourceUseCase(dataLifecycleUnit);
    this.#restoreDataResourceUseCase = new RestoreDataResourceUseCase(dataLifecycleUnit);
    this.#requestDataPurgeUseCase = new RequestDataPurgeUseCase(dataLifecycleUnit, strongAuthentication);
    this.#cancelDataPurgeUseCase = new CancelDataPurgeUseCase(dataLifecycleUnit);
    const sourceDeletionPropagation = new EnforceSourceDeletionPropagationUseCase(
      new SourceDeletionPropagationPolicy(),
      new DesktopSourceDeletionRuntimeCacheInvalidationPort(
        () => this.#familyDataImportService.clearCachedPreviews(),
        options.sourceDeletionExternalCacheInvalidator
      )
    );
    this.#executeDataPurgeUseCase = new ExecuteDataPurgeUseCase(dataLifecycleUnit, strongAuthentication, sourceDeletionPropagation);
    this.#setDataLegalHoldUseCase = new SetDataLegalHoldUseCase(dataLifecycleUnit, strongAuthentication);
    const backupPropagationAdapter = new RepositoryBackedBackupPropagationAdapter({transactionExecutor:this.#transactionExecutor,repository:this.#repositories.backupPropagationRepository});
    this.#listPendingBackupPropagationUseCase = new ListPendingBackupPropagationUseCase(backupPropagationAdapter);
    this.#listBackupPropagationRunsUseCase = new ListBackupPropagationRunsUseCase(backupPropagationAdapter);
    this.#completeBackupPropagationUseCase = new CompleteBackupPropagationUseCase(backupPropagationAdapter);
    this.#recordBackupPropagationRunUseCase = new RecordBackupPropagationRunUseCase(backupPropagationAdapter);
    this.#getBackupCleanRewritePolicyUseCase = new GetBackupCleanRewritePolicyUseCase(backupPropagationAdapter);
    this.#listBackupCleanRewriteRunsUseCase = new ListBackupCleanRewriteRunsUseCase(backupPropagationAdapter);
    this.#updateBackupCleanRewritePolicyUseCase = new UpdateBackupCleanRewritePolicyUseCase(backupPropagationAdapter,strongAuthentication);
    this.#claimBackupCleanRewriteUseCase = new ClaimBackupCleanRewriteUseCase(backupPropagationAdapter);
    this.#completeBackupCleanRewriteUseCase = new CompleteBackupCleanRewriteUseCase(backupPropagationAdapter);
    this.#recoverInterruptedBackupCleanRewriteUseCase = new RecoverInterruptedBackupCleanRewriteUseCase(backupPropagationAdapter);
    const backupQuarantineAdapter = new RepositoryBackedBackupQuarantineAdapter({transactionExecutor:this.#transactionExecutor,repository:this.#repositories.backupQuarantineRepository});
    this.#getBackupQuarantinePolicyUseCase = new GetBackupQuarantinePolicyUseCase(backupQuarantineAdapter);
    this.#listBackupQuarantineBatchesUseCase = new ListBackupQuarantineBatchesUseCase(backupQuarantineAdapter);
    this.#registerBackupQuarantineBatchUseCase = new RegisterBackupQuarantineBatchUseCase(backupQuarantineAdapter,backupQuarantineAdapter);
    this.#updateBackupQuarantinePolicyUseCase = new UpdateBackupQuarantinePolicyUseCase(backupQuarantineAdapter,strongAuthentication);
    this.#setBackupQuarantineLegalHoldUseCase = new SetBackupQuarantineLegalHoldUseCase(backupQuarantineAdapter,backupQuarantineAdapter,strongAuthentication);
    this.#destroyBackupQuarantineBatchUseCase = new DestroyBackupQuarantineBatchUseCase(backupQuarantineAdapter,backupQuarantineAdapter,new FileSystemBackupQuarantineDestructionPort(),strongAuthentication);
    const externalBackupInventoryAdapter = new RepositoryBackedExternalBackupInventoryAdapter({transactionExecutor:this.#transactionExecutor,repository:this.#repositories.externalBackupInventoryRepository});
    this.#listExternalBackupCopiesUseCase = new ListExternalBackupCopiesUseCase(externalBackupInventoryAdapter);
    this.#getExternalBackupInventorySummaryUseCase = new GetExternalBackupInventorySummaryUseCase(externalBackupInventoryAdapter);
    this.#registerExternalBackupCopyUseCase = new RegisterExternalBackupCopyUseCase(externalBackupInventoryAdapter);
    this.#reviewExternalBackupCopyUseCase = new ReviewExternalBackupCopyUseCase(externalBackupInventoryAdapter,externalBackupInventoryAdapter,strongAuthentication);
    this.#setExternalBackupCopyLegalHoldUseCase = new SetExternalBackupCopyLegalHoldUseCase(externalBackupInventoryAdapter,externalBackupInventoryAdapter,strongAuthentication);
    this.#attestExternalBackupCopyDestroyedUseCase = new AttestExternalBackupCopyDestroyedUseCase(externalBackupInventoryAdapter,externalBackupInventoryAdapter,strongAuthentication);
    const externalBackupEvidenceCrypto = new NodeExternalBackupEvidenceCryptoAdapter();
    this.#listExternalBackupEvidenceIssuersUseCase = new ListExternalBackupEvidenceIssuersUseCase(externalBackupInventoryAdapter);
    this.#listExternalBackupEvidenceIssuerRotationsUseCase = new ListExternalBackupEvidenceIssuerRotationsUseCase(externalBackupInventoryAdapter);
    this.#listExternalBackupDestructionEvidenceUseCase = new ListExternalBackupDestructionEvidenceUseCase(externalBackupInventoryAdapter);
    this.#registerExternalBackupEvidenceIssuerUseCase = new RegisterExternalBackupEvidenceIssuerUseCase(externalBackupInventoryAdapter,externalBackupInventoryAdapter,externalBackupEvidenceCrypto,strongAuthentication);
    this.#rotateExternalBackupEvidenceIssuerUseCase = new RotateExternalBackupEvidenceIssuerUseCase(externalBackupInventoryAdapter,externalBackupInventoryAdapter,externalBackupEvidenceCrypto,strongAuthentication);
    this.#revokeExternalBackupEvidenceIssuerUseCase = new RevokeExternalBackupEvidenceIssuerUseCase(externalBackupInventoryAdapter,externalBackupInventoryAdapter,strongAuthentication);
    this.#verifyExternalBackupDestructionEvidenceUseCase = new VerifyExternalBackupDestructionEvidenceUseCase(externalBackupInventoryAdapter,externalBackupInventoryAdapter,externalBackupEvidenceCrypto,strongAuthentication);
    this.#listExternalBackupEvidenceRevocationListsUseCase = new ListExternalBackupEvidenceRevocationListsUseCase(externalBackupInventoryAdapter);
    this.#applyExternalBackupEvidenceRevocationListUseCase = new ApplyExternalBackupEvidenceRevocationListUseCase(externalBackupInventoryAdapter,externalBackupInventoryAdapter,externalBackupEvidenceCrypto,strongAuthentication);
    this.#listExternalBackupRevocationEndpointsUseCase = new ListExternalBackupRevocationEndpointsUseCase(externalBackupInventoryAdapter);
    this.#findExternalBackupRevocationEndpointUseCase = new FindExternalBackupRevocationEndpointUseCase(externalBackupInventoryAdapter);
    this.#upsertExternalBackupRevocationEndpointUseCase = new UpsertExternalBackupRevocationEndpointUseCase(externalBackupInventoryAdapter,externalBackupInventoryAdapter,strongAuthentication);
    this.#recordExternalBackupRevocationEndpointFetchUseCase = new RecordExternalBackupRevocationEndpointFetchUseCase(externalBackupInventoryAdapter);
    const lifePolicyEnforcementPointResolver = productionArchivePolicy === undefined
      ? options.lifePolicyEnforcementPointResolver ?? failClosedLifePolicyEnforcementPointResolver
      : createLifeProductionPolicyEnforcementPointResolver({
          transactionExecutor: this.#transactionExecutor,
          accountRepository: this.#repositories.accountRepository,
          permissionRepository: this.#repositories.objectPermissionRepository,
          trustedDeviceRepository: this.#repositories.trustedDeviceRepository,
          lifePolicyResourceRepository: this.#repositories.lifeRepository,
          householdOperationsPolicyResourceRepository: this.#repositories.householdOperationsRepository,
          childEducationPolicyResourceRepository: this.#repositories.childEducationRepository,
          communicationAuditArchivePolicyResourceRepository: this.#repositories.communicationAuditArchiveRepository,
          placesTravelPolicyResourceRepository: this.#repositories.placesTravelRepository,
          familyAiAssistantPolicyResourceRepository: this.#repositories.familyAiAssistantRepository,
          familyMeetingPolicyResourceRepository: this.#repositories.familyMeetingRepository,
          communicationFileSharingPolicyResourceRepository: this.#repositories.communicationFileSharingRepository,
          memoryStudioPolicyResourceRepository: this.#repositories.memoryStudioRepository,
          smartHomeEnergyPolicyResourceRepository: this.#repositories.smartHomeEnergyRepository,
          signedPluginPlatformPolicyResourceRepository: this.#repositories.signedPluginPlatformRepository,
          communicationMessagingPolicyResourceRepository: this.#repositories.communicationMessagingRepository,
          communicationRealtimeCallingPolicyResourceRepository: this.#repositories.communicationRealtimeCallingRepository,
          communicationRecordingPolicyResourceRepository: this.#repositories.communicationRecordingRepository,
          localTranslationPolicyResourceRepository: this.#repositories.localTranslationRepository,
          communicationSecurityPolicyResourceRepository: this.#repositories.communicationSecurityRepository,
          personRepository: this.#repositories.personRepository,
          deviceIdentityProvider: this.#deviceIdentityProvider,
          authorizationProvider: productionArchivePolicy.authorizationProvider,
          receiptSink: productionArchivePolicy.receiptSink,
          policyTransactionRepository: this.#repositories.platformPolicyTransactionRepository,
          clusterFence: productionArchivePolicy.clusterFence,
          policyVersion: productionArchivePolicy.policyVersion,
          clock: this.#clock
        });
    const lifeApplicationDependencies = {
      transactionExecutor: this.#transactionExecutor,
      lifeRepository: this.#repositories.lifeRepository,
      householdOperationsRepository: this.#repositories.householdOperationsRepository,
      childEducationRepository: this.#repositories.childEducationRepository,
      childEducationPolicyResourceRepository: this.#repositories.childEducationRepository,
      communicationAuditArchiveRepository: this.#repositories.communicationAuditArchiveRepository,
      communicationAuditArchivePolicyResourceRepository: this.#repositories.communicationAuditArchiveRepository,
      placesTravelRepository: this.#repositories.placesTravelRepository,
      placesTravelPolicyResourceRepository: this.#repositories.placesTravelRepository,
      familyAiAssistantRepository: this.#repositories.familyAiAssistantRepository,
      familyAiAssistantPolicyResourceRepository: this.#repositories.familyAiAssistantRepository,
      familyMeetingRepository: this.#repositories.familyMeetingRepository,
      familyMeetingPolicyResourceRepository: this.#repositories.familyMeetingRepository,
      communicationFileSharingRepository: this.#repositories.communicationFileSharingRepository,
      communicationFileSharingPolicyResourceRepository: this.#repositories.communicationFileSharingRepository,
      memoryStudioRepository: this.#repositories.memoryStudioRepository,
      memoryStudioPolicyResourceRepository: this.#repositories.memoryStudioRepository,
      smartHomeEnergyRepository: this.#repositories.smartHomeEnergyRepository,
      smartHomeEnergyPolicyResourceRepository: this.#repositories.smartHomeEnergyRepository,
      signedPluginPlatformRepository: this.#repositories.signedPluginPlatformRepository,
      signedPluginPlatformPolicyResourceRepository: this.#repositories.signedPluginPlatformRepository,
      communicationMessagingRepository: this.#repositories.communicationMessagingRepository,
      communicationMessagingPolicyResourceRepository: this.#repositories.communicationMessagingRepository,
      communicationRealtimeCallingRepository: this.#repositories.communicationRealtimeCallingRepository,
      communicationRealtimeCallingPolicyResourceRepository: this.#repositories.communicationRealtimeCallingRepository,
      communicationRecordingRepository: this.#repositories.communicationRecordingRepository,
      communicationRecordingPolicyResourceRepository: this.#repositories.communicationRecordingRepository,
      localTranslationRepository: this.#repositories.localTranslationRepository,
      localTranslationPolicyResourceRepository: this.#repositories.localTranslationRepository,
      communicationSecurityRepository: this.#repositories.communicationSecurityRepository,
      communicationSecurityPolicyResourceRepository: this.#repositories.communicationSecurityRepository,
      aiConsentRepository: this.#repositories.aiConsentRepository,
      accountRepository: this.#repositories.accountRepository,
      permissionRepository: this.#repositories.objectPermissionRepository,
      personRepository: this.#repositories.personRepository,
      auditRepository: this.#repositories.auditRepository,
      outboxRepository: this.#repositories.outboxRepository,
      policyEnforcementPointResolver: lifePolicyEnforcementPointResolver,
      clusterFence: productionArchivePolicy?.clusterFence
        ?? options.archiveClusterFence
        ?? nonWritableLifeClusterFence
    } as const;
    const lifePolicyTransactionRunner = new RepositoryBackedLifePolicyTransactionRunner(
      lifeApplicationDependencies
    );
    const automationAdapter = new RepositoryBackedAutomationAdapter({
      transactionExecutor: this.#transactionExecutor,
      automationRepository: this.#repositories.automationRepository,
      lifeRepository: this.#repositories.lifeRepository,
      auditRepository: this.#repositories.auditRepository,
      outboxRepository: this.#repositories.outboxRepository,
      lifePolicyTransactionRunner
    });
    this.#listAutomationRulesUseCase = new ListAutomationRulesUseCase(automationAdapter);
    this.#createAutomationRuleUseCase = new CreateAutomationRuleUseCase(automationAdapter);
    this.#toggleAutomationRuleUseCase = new ToggleAutomationRuleUseCase(automationAdapter);
    this.#listAutomationRunsUseCase = new ListAutomationRunsUseCase(automationAdapter);
    this.#runAutomationRulesUseCase = new RunAutomationRulesUseCase(automationAdapter);
    this.#getReportSummaryUseCase = new GetReportSummaryUseCase(new RepositoryBackedReportQueryPort({
      transactionExecutor: this.#transactionExecutor,
      reportRepository: this.#repositories.reportRepository,
      lifeProjectionRepository: this.#repositories.lifeRepository,
      lifePolicyTransactionRunner
    }));
    this.#appendAuditEntryUseCase = new AppendAuditEntryUseCase(new RepositoryBackedAuditWriteCommandPort({transactionExecutor:this.#transactionExecutor,auditRepository:this.#repositories.auditRepository}));
    this.#getLatestAuditOccurredAtUseCase = new GetLatestAuditOccurredAtUseCase(new RepositoryBackedAuditReadQueryPort({transactionExecutor:this.#transactionExecutor,auditRepository:this.#repositories.auditRepository}));
    const membershipDependencies = {
      transactionExecutor: this.#transactionExecutor,
      invitationRepository: this.#repositories.invitationRepository,
      accountRepository: this.#repositories.accountRepository,
      personRepository: this.#repositories.personRepository,
      auditRepository: this.#repositories.auditRepository,
      outboxRepository: this.#repositories.outboxRepository
    } as const;
    const membershipUnitOfWork = new RepositoryBackedMembershipUnitOfWork(membershipDependencies);
    const membershipQuery = new RepositoryBackedMembershipQueryPort(membershipDependencies);
    const invitationTokenService = new NodeInvitationTokenService();
    this.#createFamilyInvitationUseCase = new CreateFamilyInvitationUseCase(membershipUnitOfWork, invitationTokenService);
    this.#listFamilyInvitationsUseCase = new ListFamilyInvitationsUseCase(membershipQuery);
    this.#inspectFamilyInvitationUseCase = new InspectFamilyInvitationUseCase(membershipQuery, invitationTokenService);
    this.#revokeFamilyInvitationUseCase = new RevokeFamilyInvitationUseCase(membershipUnitOfWork);
    this.#resendFamilyInvitationUseCase = new ResendFamilyInvitationUseCase(membershipUnitOfWork, invitationTokenService);
    this.#acceptFamilyInvitationUseCase = new AcceptFamilyInvitationUseCase(membershipUnitOfWork, invitationTokenService, passwordService);
    this.#listFamilyAccountsUseCase = new ListFamilyAccountsUseCase(membershipQuery);
    this.#updateFamilyAccountUseCase = new UpdateFamilyAccountUseCase(membershipUnitOfWork);
    const familyApplicationDependencies = {
      transactionExecutor: this.#transactionExecutor,
      familyRepository: this.#repositories.familyRepository,
      personRepository: this.#repositories.personRepository,
      relationRepository: this.#repositories.relationRepository,
      auditRepository: this.#repositories.auditRepository,
      outboxRepository: this.#repositories.outboxRepository
    } as const;
    const familyUnitOfWork = new RepositoryBackedFamilyApplicationUnitOfWork(familyApplicationDependencies);
    this.#getFamilyGraphUseCase = new GetFamilyGraphUseCase(
      new RepositoryBackedFamilyGraphQueryPort(familyApplicationDependencies)
    );
    this.#createFamilyMemberUseCase = new CreateFamilyMemberUseCase(familyUnitOfWork);
    this.#createFamilyRelationUseCase = new CreateFamilyRelationUseCase(familyUnitOfWork);
    const householdMembershipUnitOfWork = new RepositoryBackedHouseholdMembershipUnitOfWork({
      transactionExecutor: this.#transactionExecutor,
      accountRepository: this.#repositories.accountRepository,
      householdMembershipRepository: this.#repositories.householdMembershipRepository,
      personRepository: this.#repositories.personRepository,
      auditRepository: this.#repositories.auditRepository,
      outboxRepository: this.#repositories.outboxRepository
    });
    this.#createHouseholdUseCase = new CreateHouseholdUseCase(householdMembershipUnitOfWork);
    this.#createFamilyBranchUseCase = new CreateFamilyBranchUseCase(householdMembershipUnitOfWork);
    this.#assignPersonMembershipUseCase = new AssignPersonMembershipUseCase(householdMembershipUnitOfWork);
    this.#endPersonMembershipUseCase = new EndPersonMembershipUseCase(householdMembershipUnitOfWork);
    this.#getHouseholdMembershipWorkspaceUseCase = new GetHouseholdMembershipWorkspaceUseCase(householdMembershipUnitOfWork);
    const personLifecycleUnitOfWork = new RepositoryBackedPersonLifecycleUnitOfWork({
      transactionExecutor: this.#transactionExecutor,
      accountRepository: this.#repositories.accountRepository,
      personLifecycleRepository: this.#repositories.personLifecycleRepository,
      auditRepository: this.#repositories.auditRepository,
      outboxRepository: this.#repositories.outboxRepository
    });
    this.#updatePersonProfileUseCase = new UpdatePersonProfileUseCase(personLifecycleUnitOfWork);
    this.#archivePersonProfileUseCase = new ArchivePersonProfileUseCase(personLifecycleUnitOfWork);
    this.#mergePersonProfileUseCase = new MergePersonProfileUseCase(personLifecycleUnitOfWork);
    this.#requestSafePersonDeletionUseCase = new RequestSafePersonDeletionUseCase(personLifecycleUnitOfWork);
    this.#undoPersonLifecycleOperationUseCase = new UndoPersonLifecycleOperationUseCase(personLifecycleUnitOfWork);
    this.#getPersonLifecycleWorkspaceUseCase = new GetPersonLifecycleWorkspaceUseCase(personLifecycleUnitOfWork);
    const dataRepairUnitOfWork = new RepositoryBackedDataRepairUnitOfWork({
      transactionExecutor: this.#transactionExecutor,
      accountRepository: this.#repositories.accountRepository,
      dataRepairRepository: this.#repositories.dataRepairRepository,
      auditRepository: this.#repositories.auditRepository,
      outboxRepository: this.#repositories.outboxRepository
    });
    this.#scanDataRepairIssuesUseCase = new ScanDataRepairIssuesUseCase(dataRepairUnitOfWork);
    this.#previewDataRepairUseCase = new PreviewDataRepairUseCase(dataRepairUnitOfWork);
    this.#applyDataRepairUseCase = new ApplyDataRepairUseCase(dataRepairUnitOfWork);
    this.#undoDataRepairUseCase = new UndoDataRepairUseCase(dataRepairUnitOfWork);
    this.#getDataRepairWorkspaceUseCase = new GetDataRepairWorkspaceUseCase(dataRepairUnitOfWork);
    this.#getGenealogyReadModelUseCase = new GetGenealogyReadModelUseCase(
      new RepositoryBackedGenealogyReadModelQueryPort({
        transactionExecutor: this.#transactionExecutor,
        personRepository: this.#repositories.personRepository,
        relationRepository: this.#repositories.relationRepository,
        genealogyRepository: this.#repositories.genealogyRepository
      })
    );
    const locationPolicyEnforcementPointResolver = productionArchivePolicy === undefined
      ? options.locationPolicyEnforcementPointResolver ?? failClosedLocationPolicyEnforcementPointResolver
      : createLocationProductionPolicyEnforcementPointResolver({
          transactionExecutor: this.#transactionExecutor,
          accountRepository: this.#repositories.accountRepository,
          permissionRepository: this.#repositories.objectPermissionRepository,
          trustedDeviceRepository: this.#repositories.trustedDeviceRepository,
          locationPolicyResourceRepository: this.#repositories.locationRepository,
          personRepository: this.#repositories.personRepository,
          deviceIdentityProvider: this.#deviceIdentityProvider,
          authorizationProvider: productionArchivePolicy.authorizationProvider,
          receiptSink: productionArchivePolicy.receiptSink,
          policyTransactionRepository: this.#repositories.platformPolicyTransactionRepository,
          clusterFence: productionArchivePolicy.clusterFence,
          policyVersion: productionArchivePolicy.policyVersion,
          clock: this.#clock
        });
    const locationApplicationDependencies = {
      transactionExecutor: this.#transactionExecutor,
      locationRepository: this.#repositories.locationRepository,
      personRepository: this.#repositories.personRepository,
      auditRepository: this.#repositories.auditRepository,
      outboxRepository: this.#repositories.outboxRepository,
      policyEnforcementPointResolver: locationPolicyEnforcementPointResolver,
      clusterFence: productionArchivePolicy?.clusterFence
        ?? options.archiveClusterFence
        ?? nonWritableLocationClusterFence
    } as const;
    const locationPolicyTransactionRunner = new RepositoryBackedLocationPolicyTransactionRunner(
      locationApplicationDependencies
    );
    this.#largeFamilyReadModelService = new LargeFamilyReadModelService({
      transactionExecutor: this.#transactionExecutor,
      repository: this.#repositories.largeFamilyReadModelRepository,
      locationRepository: this.#repositories.locationRepository,
      locationPolicyTransactionRunner,
      locationApplicationContext: (prefix) => this.#locationApplicationContext(prefix),
      currentAccountId: () => this.#requireAuth(),
      canReadEvent: (eventId) => this.#hasObjectPermission(this.#requireAuth(), 'event', eventId, 'read'),
      canReadArchiveItem: (itemId) => this.#hasObjectPermission(this.#requireAuth(), 'archive_item', itemId, 'read')
    });
    const locationUnitOfWork = new RepositoryBackedLocationUnitOfWork(
      locationApplicationDependencies,
      locationPolicyTransactionRunner
    );
    this.#createFamilyLocationUseCase = new CreateGovernedFamilyLocationUseCase(locationUnitOfWork);
    const timelinePolicyEnforcementPointResolver = productionArchivePolicy === undefined
      ? options.timelinePolicyEnforcementPointResolver ?? failClosedTimelinePolicyEnforcementPointResolver
      : createTimelineProductionPolicyEnforcementPointResolver({
          transactionExecutor: this.#transactionExecutor,
          accountRepository: this.#repositories.accountRepository,
          permissionRepository: this.#repositories.objectPermissionRepository,
          trustedDeviceRepository: this.#repositories.trustedDeviceRepository,
          timelinePolicyResourceRepository: this.#repositories.timelineRepository,
          accessibilityPreferencesRepository: this.#repositories.accessibilityPreferencesRepository,
          formDraftRepository: this.#repositories.formDraftRepository,
          identityAccessCredentialRepository: this.#repositories.identityAccessCredentialRepository,
          privacyOwnershipDataRightsRepository: this.#repositories.privacyOwnershipDataRightsRepository,
          personRepository: this.#repositories.personRepository,
          deviceIdentityProvider: this.#deviceIdentityProvider,
          authorizationProvider: productionArchivePolicy.authorizationProvider,
          receiptSink: productionArchivePolicy.receiptSink,
          policyTransactionRepository: this.#repositories.platformPolicyTransactionRepository,
          clusterFence: productionArchivePolicy.clusterFence,
          policyVersion: productionArchivePolicy.policyVersion,
          clock: this.#clock
        });
    const timelineApplicationDependencies = {
      transactionExecutor: this.#transactionExecutor,
      familyRepository: this.#repositories.familyRepository,
      personRepository: this.#repositories.personRepository,
      locationRepository: this.#repositories.locationRepository,
      timelineRepository: this.#repositories.timelineRepository,
      notificationStateRepository: this.#repositories.notificationStateRepository,
      auditRepository: this.#repositories.auditRepository,
      outboxRepository: this.#repositories.outboxRepository,
      locationPolicyTransactionRunner,
      policyEnforcementPointResolver: timelinePolicyEnforcementPointResolver,
      clusterFence: productionArchivePolicy?.clusterFence
        ?? options.archiveClusterFence
        ?? nonWritableTimelineClusterFence
    } as const;
    const timelinePolicyTransactionRunner = new RepositoryBackedTimelinePolicyTransactionRunner(
      timelineApplicationDependencies
    );
    const accessibilityPreferencesUnitOfWork = new RepositoryBackedAccessibilityPreferencesUnitOfWork({
      transactionExecutor: this.#transactionExecutor,
      repository: this.#repositories.accessibilityPreferencesRepository,
      auditRepository: this.#repositories.auditRepository,
      outboxRepository: this.#repositories.outboxRepository,
      policyTransactionRunner: timelinePolicyTransactionRunner
    });
    this.#getAccessibilityPreferencesUseCase = new GetAccessibilityPreferencesUseCase(
      accessibilityPreferencesUnitOfWork
    );
    this.#updateAccessibilityPreferencesUseCase = new UpdateAccessibilityPreferencesUseCase(
      accessibilityPreferencesUnitOfWork
    );
    const formDraftUnitOfWork = new RepositoryBackedFormDraftUnitOfWork({
      transactionExecutor: this.#transactionExecutor,
      repository: this.#repositories.formDraftRepository,
      auditRepository: this.#repositories.auditRepository,
      outboxRepository: this.#repositories.outboxRepository,
      policyTransactionRunner: timelinePolicyTransactionRunner
    });
    this.#getFormDraftWorkspaceUseCase = new GetFormDraftWorkspaceUseCase(formDraftUnitOfWork);
    this.#saveFormDraftUseCase = new SaveFormDraftUseCase(formDraftUnitOfWork);
    this.#undoFormDraftUseCase = new UndoFormDraftUseCase(formDraftUnitOfWork);
    const privacyOwnershipUnitOfWork = new RepositoryBackedPrivacyOwnershipDataRightsUnitOfWork({
      policyTransactionRunner:timelinePolicyTransactionRunner,
      privacyRepository:this.#repositories.privacyOwnershipDataRightsRepository,
      accountRepository:this.#repositories.accountRepository,
      personRepository:this.#repositories.personRepository,
      trustedDeviceRepository:this.#repositories.trustedDeviceRepository,
      offlineCapabilityLeaseRepository:this.#repositories.offlineCapabilityLeaseRepository,
      aiConsentRepository:this.#repositories.aiConsentRepository,
      objectPermissionRepository:this.#repositories.objectPermissionRepository,
      auditRepository:this.#repositories.auditRepository,
      outboxRepository:this.#repositories.outboxRepository,
      aiMemoryDeletionPropagation:{
        propagate:(repositoryContext,input)=>{
          const subject = repositoryContext.policyAuthorization.subject;
          if(!subject.personId)return err(createAppError({
            code:ERROR_CODES.AUTHORIZATION_DENIED,category:'security',
            message:'AI hafÄ±za temizliÄŸi exact kiÅŸi kapsamÄ± gerektirir.',
            correlationId:repositoryContext.correlationId
          }));
          const key = {familyId:asFamilyId(repositoryContext.policyAuthorization.resourceFamilyId),
            accountId:asUserId(subject.accountId),ownerPersonId:asPersonId(subject.personId)};
          const current = this.#repositories.privacyOwnershipDataRightsRepository.findAiMemoryRecord(
            repositoryContext,key,input.recordId
          );
          if(!current.ok)return current;
          if(!current.value || current.value.derivedBindingHash!==input.derivedBindingHash)return err(createAppError({
            code:ERROR_CODES.AUTHORIZATION_DENIED,category:'security',
            message:'AI hafÄ±za temizliÄŸi exact sealed binding ile eÅŸleÅŸmiyor.',
            correlationId:repositoryContext.correlationId
          }));
          const sourceIdentity = `${current.value.sourceResourceType}\u0000${current.value.sourceResourceId}`;
          const permissions = this.#repositories.objectPermissionRepository.listAll(repositoryContext);
          if(!permissions.ok)return permissions;
          for(const permission of permissions.value.filter((item)=>
            (item.resourceType==='ai_memory_record'||item.resourceType==='ai_memory')&&item.resourceId===input.recordId)){
            const removed = this.#repositories.objectPermissionRepository.delete(repositoryContext,permission.id);
            if(!removed.ok)return removed;
          }
          const remaining = this.#repositories.objectPermissionRepository.listAll(repositoryContext);
          if(!remaining.ok)return remaining;
          const grantRemains = remaining.value.some((item)=>
            (item.resourceType==='ai_memory_record'||item.resourceType==='ai_memory')&&item.resourceId===input.recordId);
          const preserved = this.#repositories.privacyOwnershipDataRightsRepository.findAiMemoryRecord(
            repositoryContext,key,input.recordId
          );
          if(!preserved.ok)return preserved;
          if(grantRemains || !preserved.value
            || `${preserved.value.sourceResourceType}\u0000${preserved.value.sourceResourceId}`!==sourceIdentity
            || preserved.value.derivedBindingHash!==input.derivedBindingHash)return err(createAppError({
              code:ERROR_CODES.RESOURCE_CONFLICT,category:'conflict',
              message:'AI hafÄ±za yerel grant temizliÄŸi veya kaynak korumasÄ± tamamlanmadÄ±.',
              correlationId:repositoryContext.correlationId
            }));
          return ok({locallyCompleted:true,resourceGrantCleanupComplete:true,processingDisabled:true,
            sourcePreserved:true,derivedBindingHash:input.derivedBindingHash});
        }
      }
    });
    this.#getPrivacyOwnershipControlCenterUseCase = new GetPrivacyOwnershipControlCenterUseCase(privacyOwnershipUnitOfWork);
    this.#manageAiMemoryUseCase = new ManageAiMemoryUseCase(privacyOwnershipUnitOfWork);
    this.#manageDataRightsRequestUseCase = new ManageDataRightsRequestUseCase(privacyOwnershipUnitOfWork);
    this.#finalizeEncryptedPrivacyExportUseCase = new FinalizeEncryptedPrivacyExportUseCase(privacyOwnershipUnitOfWork);
    this.#managePrivacyIncidentUseCase = new ManagePrivacyIncidentUseCase(privacyOwnershipUnitOfWork);
    this.#simulatePermissionVisibilityUseCase = new SimulatePermissionVisibilityUseCase(privacyOwnershipUnitOfWork);
    const identityAccessRepository = this.#repositories.identityAccessCredentialRepository;
    const identityAccessPorts = options.identityAccessPorts;
    const passkeyCeremonyVerifier = identityAccessPorts?.passkeyCeremonyVerifier ?? {
      verifyRegistration: () => identityAccessUnavailable('WebAuthn kayıt doğrulayıcısı yapılandırılmadı.'),
      verifyAuthentication: () => identityAccessUnavailable('WebAuthn assertion doğrulayıcısı yapılandırılmadı.')
    };
    const passkeyRecoveryVerifier = identityAccessPorts?.passkeyRecoveryVerifier ?? {
      verify: (input) => identityAccessUnavailable('Güçlü passkey kurtarma doğrulayıcısı yapılandırılmadı.', input.correlationId)
    };
    const federatedAuthorizationCeremony = identityAccessPorts?.federatedAuthorizationCeremony ?? {
      createAndStore: (input) => identityAccessUnavailable('Federated authorization ceremony portu yapılandırılmadı.', input.correlationId),
      discardCeremony: () => undefined
    };
    const federatedAuthorizationCodeVerifier = identityAccessPorts?.federatedAuthorizationCodeVerifier ?? {
      consumeVerifiedFlow: (input) => identityAccessUnavailable('Federated authorization code doğrulayıcısı yapılandırılmadı.', input.correlationId),
      discardVaultEntry: () => undefined
    };
    const temporaryCredentialEnvelope = identityAccessPorts?.temporaryCredentialEnvelope ?? {
      issueAndStore: () => identityAccessUnavailable('Geçici credential envelope portu yapılandırılmadı.'),
      discardEncryptedEnvelope: () => { throw new Error('Geçici credential envelope fiziksel imha portu yapılandırılmadı.'); },
      verifyOffline: () => identityAccessUnavailable('Geçici credential offline doğrulayıcısı yapılandırılmadı.')
    };
    this.#temporaryCredentialEnvelope = temporaryCredentialEnvelope;
    const encryptedCompanionSnapshot = identityAccessPorts?.encryptedCompanionSnapshot ?? {
      create: () => identityAccessUnavailable('Şifreli companion snapshot portu yapılandırılmadı.')
    };
    const externalSecurityPorts: IdentityAccessExternalSecurityPorts = {
      passkeyCeremonyVerifier,
      passkeySession: {
        start: (accountId, securityEpoch) => this.#sessionManager.start(accountId, securityEpoch)
      },
      passkeyRecoveryVerifier,
      federatedAuthorizationCeremony,
      federatedAuthorizationCodeVerifier,
      temporaryCredentialEnvelope,
      encryptedCompanionSnapshot
    };
    const identityAccessUnitOfWork = new RepositoryBackedIdentityAccessCredentialUnitOfWork({
      policyTransactionRunner: timelinePolicyTransactionRunner as unknown as IdentityAccessPolicyTransactionRunner,
      identityRepository: identityAccessRepository,
      accountRepository: this.#repositories.accountRepository,
      trustedDeviceRepository: this.#repositories.trustedDeviceRepository,
      auditRepository: this.#repositories.auditRepository,
      outboxRepository: this.#repositories.outboxRepository,
      federatedVaultControl: identityAccessPorts?.federatedVaultControl ?? {
        revokeEntry: (repositoryContext) => identityAccessUnavailable(
          'Federated token vault iptal portu yapılandırılmadı.',
          repositoryContext.correlationId
        )
      },
      quota: identityAccessPorts?.quota ?? {
        countTemporaryCredentials: (repositoryContext,key) => identityAccessRepository.countTemporaryCredentials(repositoryContext,key)
      },
      localSessionRevocation: {
        clearForAccount: (accountId) => {
          const active = this.#sessionManager.snapshot().accountId;
          if (active && active !== accountId) {
            return identityAccessUnavailable('Yerel oturum iptali farklı bir hesap kapsamına yöneltildi.');
          }
          this.#sessionManager.clear();
          return ok(undefined);
        }
      },
      externalSecurityPorts
    });
    const challengeGenerator = identityAccessPorts?.challengeGenerator ?? {
      createChallenge: () => { throw new Error('Passkey challenge üreticisi yapılandırılmadı.'); }
    };
    this.#getIdentityAccessCredentialCenterUseCase = new GetIdentityAccessCredentialCenterUseCase(identityAccessUnitOfWork);
    this.#beginPasskeyRegistrationUseCase = new BeginPasskeyRegistrationUseCase(identityAccessUnitOfWork, challengeGenerator);
    this.#beginPasskeyAuthenticationUseCase = new BeginPasskeyAuthenticationUseCase(identityAccessUnitOfWork, challengeGenerator);
    this.#completePasskeyRegistrationUseCase = new CompletePasskeyRegistrationUseCase(identityAccessUnitOfWork, passkeyCeremonyVerifier);
    this.#authenticateWithPasskeyUseCase = new AuthenticateWithPasskeyUseCase(identityAccessUnitOfWork, passkeyCeremonyVerifier, externalSecurityPorts.passkeySession);
    this.#revokePasskeyUseCase = new RevokePasskeyUseCase(identityAccessUnitOfWork);
    this.#recoverLostPasskeyUseCase = new RecoverLostPasskeyUseCase(identityAccessUnitOfWork, passkeyRecoveryVerifier);
    this.#beginFederatedIdentityLinkUseCase = new BeginFederatedIdentityLinkUseCase(identityAccessUnitOfWork, federatedAuthorizationCeremony);
    this.#linkFederatedIdentityUseCase = new LinkFederatedIdentityUseCase(identityAccessUnitOfWork, federatedAuthorizationCodeVerifier);
    this.#unlinkFederatedIdentityUseCase = new UnlinkFederatedIdentityUseCase(identityAccessUnitOfWork);
    this.#issueTemporaryVerifiableCredentialUseCase = new IssueTemporaryVerifiableCredentialUseCase(identityAccessUnitOfWork, temporaryCredentialEnvelope);
    this.#revokeTemporaryVerifiableCredentialUseCase = new RevokeTemporaryVerifiableCredentialUseCase(identityAccessUnitOfWork);
    this.#verifyTemporaryVerifiableCredentialUseCase = new VerifyTemporaryVerifiableCredentialUseCase(identityAccessUnitOfWork, temporaryCredentialEnvelope);
    this.#createReadOnlyCompanionSnapshotUseCase = new CreateReadOnlyCompanionSnapshotUseCase(identityAccessUnitOfWork, encryptedCompanionSnapshot);
    const familyDataImportPolicyBatchRunner = new RepositoryBackedFamilyDataImportPolicyBatchRunner({
      transactionExecutor: this.#transactionExecutor,
      locationRunner: locationPolicyTransactionRunner,
      timelineRunner: timelinePolicyTransactionRunner
    });
    this.#familyDataImportService = new FamilyDataImportService({
      transactionExecutor: this.#transactionExecutor,
      accountRepository: this.#repositories.accountRepository,
      permissionRepository: this.#repositories.objectPermissionRepository,
      importRepository: this.#repositories.familyDataImportRepository,
      familyRepository: this.#repositories.familyRepository,
      personRepository: this.#repositories.personRepository,
      relationRepository: this.#repositories.relationRepository,
      locationRepository: this.#repositories.locationRepository,
      timelineRepository: this.#repositories.timelineRepository,
      auditRepository: this.#repositories.auditRepository,
      strongAuthentication,
      applicationContext: (prefix) => this.#dataLifecycleApplicationContext(prefix),
      policyBatchRunner: familyDataImportPolicyBatchRunner
    });
    const timelineQuery = new RepositoryBackedTimelineQueryPort(
      timelineApplicationDependencies,
      timelinePolicyTransactionRunner
    );
    const timelineUnitOfWork = new RepositoryBackedTimelineApplicationUnitOfWork(
      timelineApplicationDependencies,
      timelinePolicyTransactionRunner
    );
    this.#getTimelineReadModelUseCase = new GetTimelineReadModelUseCase(timelineQuery, this.#clock);
    this.#getImportantDayDetailsUseCase = new GetImportantDayDetailsUseCase(timelineQuery);
    this.#createImportantDayUseCase = new CreateImportantDayUseCase(timelineUnitOfWork);
    this.#updateImportantDayParticipantsUseCase = new UpdateImportantDayParticipantsUseCase(timelineUnitOfWork);
    this.#updateImportantDayInvitationUseCase = new UpdateImportantDayInvitationUseCase(timelineUnitOfWork);
    this.#updateImportantDayNotesUseCase = new UpdateImportantDayNotesUseCase(timelineUnitOfWork);
    this.#updateFamilyEventUseCase = new UpdateFamilyEventUseCase(timelineUnitOfWork);
    this.#setFamilyEventArchivedUseCase = new SetFamilyEventArchivedUseCase(timelineUnitOfWork);
    this.#listArchivedTimelineEventsUseCase = new ListArchivedTimelineEventsUseCase(timelineQuery);
    this.#acknowledgeTimelineNotificationUseCase = new AcknowledgeTimelineNotificationUseCase(timelineQuery, timelineUnitOfWork, this.#clock);
    this.#getDashboardOverviewUseCase = new GetDashboardOverviewUseCase(
      new RepositoryBackedDashboardQueryPort({
        dashboardRepository: this.#repositories.dashboardRepository,
        locationRepository: this.#repositories.locationRepository,
        locationPolicyTransactionRunner
      })
    );
    this.#inspectDatabaseRuntimeHealthUseCase = new InspectDatabaseRuntimeHealthUseCase(new SqliteDatabaseRuntimeHealthQueryPort(this.#database));
    this.#inspectSystemResourceSnapshotUseCase = new InspectSystemResourceSnapshotUseCase(new NodeSystemResourceSnapshotPort());
    this.#runDatabaseMaintenanceUseCase = new RunDatabaseMaintenanceUseCase(new SqliteDatabaseMaintenanceCommandPort(this.#database));
    const backupDatabaseSafetyPort = new SqliteBackupDatabaseSafetyPort(this.#database);
    this.#prepareBackupDatabaseUseCase = new PrepareBackupDatabaseUseCase(backupDatabaseSafetyPort);
    this.#verifyBackupDatabaseIntegrityUseCase = new VerifyBackupDatabaseIntegrityUseCase(backupDatabaseSafetyPort);
    this.#prepareRestoredDatabaseForReauthorizationUseCase = new PrepareRestoredDatabaseForReauthorizationUseCase(backupDatabaseSafetyPort);
    const backupTargetFiles = new FileSystemBackupTargetFilePort();
    this.#quarantineManagedBackupArtifactsUseCase = new QuarantineManagedBackupArtifactsUseCase(new FileSystemBackupPurgeQuarantinePort());
    this.#getBackupTargetFreeBytesUseCase = new GetBackupTargetFreeBytesUseCase(backupTargetFiles);
    this.#prepareBackupTargetUseCase = new PrepareBackupTargetUseCase(backupTargetFiles);
    this.#createBackupArtifactPathUseCase = new CreateBackupArtifactPathUseCase(backupTargetFiles);
    this.#inspectBackupArtifactUseCase = new InspectBackupArtifactUseCase(backupTargetFiles);
    this.#deleteBackupArtifactUseCase = new DeleteBackupArtifactUseCase(backupTargetFiles);
    this.#listBackupArtifactsUseCase = new ListBackupArtifactsUseCase(backupTargetFiles);
    const fullBackupFiles = new FileSystemFullBackupFilePort(
      archiveVaultKeyProvider ? { vaultKeyProvider: archiveVaultKeyProvider } : {}
    );
    this.#prepareFullBackupDestinationUseCase = new PrepareFullBackupDestinationUseCase(fullBackupFiles);
    this.#createFullBackupUseCase = new CreateFullBackupUseCase(fullBackupFiles);
    this.#inspectFullBackupUseCase = new InspectFullBackupUseCase(fullBackupFiles);
    this.#stageFullBackupRestoreUseCase = new StageFullBackupRestoreUseCase(fullBackupFiles);
    this.#commitFullBackupRestoreUseCase = new CommitFullBackupRestoreUseCase(fullBackupFiles);
    this.#discardFullBackupRestoreUseCase = new DiscardFullBackupRestoreUseCase(fullBackupFiles);
    this.#installAuditStorageProtectionUseCase = new InstallAuditStorageProtectionUseCase(
      new SqliteAuditStorageProtectionCommandPort(this.#database)
    );
    const operationalHealthAdapter = new RepositoryBackedOperationalHealthAdapter({ transactionExecutor: this.#transactionExecutor, diagnosticRepository: this.#repositories.diagnosticRepository });
    this.#recordPerformanceSampleUseCase = new RecordPerformanceSampleUseCase(operationalHealthAdapter);
    this.#listPerformanceSamplesUseCase = new ListPerformanceSamplesUseCase(operationalHealthAdapter);
    this.#getPerformanceTrendUseCase = new GetPerformanceTrendUseCase(operationalHealthAdapter);
    this.#recordDiagnosticUseCase = new RecordDiagnosticUseCase(operationalHealthAdapter, new SensitiveLogPolicy());
    this.#listDiagnosticsUseCase = new ListDiagnosticsUseCase(operationalHealthAdapter);
    this.#recordSystemHealthHistoryUseCase = new RecordSystemHealthHistoryUseCase(operationalHealthAdapter);
    this.#listSystemHealthHistoryUseCase = new ListSystemHealthHistoryUseCase(operationalHealthAdapter);
    this.#listSystemHealthHistorySinceUseCase = new ListSystemHealthHistorySinceUseCase(operationalHealthAdapter);
    this.#recordMaintenanceHistoryUseCase = new RecordMaintenanceHistoryUseCase(operationalHealthAdapter);
    this.#listMaintenanceHistoryUseCase = new ListMaintenanceHistoryUseCase(operationalHealthAdapter);
    this.#searchMaintenanceHistoryUseCase = new SearchMaintenanceHistoryUseCase(operationalHealthAdapter);
    this.#getMaintenancePolicyUseCase = new GetMaintenancePolicyUseCase(operationalHealthAdapter);
    this.#upsertMaintenancePolicyUseCase = new UpsertMaintenancePolicyUseCase(operationalHealthAdapter);
    this.#listHealthNotificationsUseCase = new ListHealthNotificationsUseCase(operationalHealthAdapter);
    this.#findActiveHealthNotificationUseCase = new FindActiveHealthNotificationUseCase(operationalHealthAdapter);
    this.#recordHealthNotificationUseCase = new RecordHealthNotificationUseCase(operationalHealthAdapter);
    this.#attachHealthNotificationTaskUseCase = new AttachHealthNotificationTaskUseCase(operationalHealthAdapter);
    this.#acknowledgeHealthNotificationUseCase = new AcknowledgeHealthNotificationUseCase(operationalHealthAdapter);
    this.#getOperationalHealthCountsUseCase = new GetOperationalHealthCountsUseCase(operationalHealthAdapter);
    this.#cleanupOperationalHealthUseCase = new CleanupOperationalHealthUseCase(operationalHealthAdapter, operationalHealthAdapter);
    this.#getMaintenanceRecommendationsUseCase = new GetMaintenanceRecommendationsUseCase(operationalHealthAdapter);
    this.#recordExportArtifactUseCase = new RecordExportArtifactUseCase(operationalHealthAdapter);
    this.#listExportArtifactsUseCase = new ListExportArtifactsUseCase(operationalHealthAdapter);
    this.#findExportArtifactUseCase = new FindExportArtifactUseCase(operationalHealthAdapter);
    this.#recordDiagnosticReportUseCase = new RecordDiagnosticReportUseCase(operationalHealthAdapter);
    this.#listDiagnosticReportsUseCase = new ListDiagnosticReportsUseCase(operationalHealthAdapter);
    this.#findDiagnosticReportUseCase = new FindDiagnosticReportUseCase(operationalHealthAdapter);
    this.#recordDiagnosticArchiveUseCase = new RecordDiagnosticArchiveUseCase(operationalHealthAdapter);
    this.#listDiagnosticArchivesUseCase = new ListDiagnosticArchivesUseCase(operationalHealthAdapter);
    this.#findDiagnosticArchiveUseCase = new FindDiagnosticArchiveUseCase(operationalHealthAdapter);
    this.#deleteDiagnosticsThroughUseCase = new DeleteDiagnosticsThroughUseCase(operationalHealthAdapter);
    const backupAdapter = new RepositoryBackedBackupAdapter({ transactionExecutor: this.#transactionExecutor, backupRepository: this.#repositories.backupRepository });
    this.#listBackupTargetsUseCase = new ListBackupTargetsUseCase(backupAdapter);
    this.#findBackupTargetUseCase = new FindBackupTargetUseCase(backupAdapter);
    this.#upsertBackupTargetUseCase = new UpsertBackupTargetUseCase(backupAdapter);
    this.#listBackupRunsUseCase = new ListBackupRunsUseCase(backupAdapter);
    this.#listSuccessfulBackupRunsUseCase = new ListSuccessfulBackupRunsUseCase(backupAdapter);
    this.#listEnabledBackupTargetIdsUseCase = new ListEnabledBackupTargetIdsUseCase(backupAdapter);
    this.#listDueBackupTargetIdsUseCase = new ListDueBackupTargetIdsUseCase(backupAdapter);
    this.#recordBackupRunUseCase = new RecordBackupRunUseCase(backupAdapter);
    this.#markBackupTargetSuccessUseCase = new MarkBackupTargetSuccessUseCase(backupAdapter);
    this.#markBackupTargetFailureUseCase = new MarkBackupTargetFailureUseCase(backupAdapter);
    this.#deleteBackupRunUseCase = new DeleteBackupRunUseCase(backupAdapter);
    const taskAdapter = new RepositoryBackedTaskAdapter({ transactionExecutor: this.#transactionExecutor, taskRepository: this.#repositories.taskRepository });
    this.#listBackgroundTasksUseCase = new ListBackgroundTasksUseCase(taskAdapter);
    this.#startBackgroundTaskUseCase = new StartBackgroundTaskUseCase(taskAdapter);
    this.#finishBackgroundTaskUseCase = new FinishBackgroundTaskUseCase(taskAdapter);
    this.#listQueuedTasksUseCase = new ListQueuedTasksUseCase(taskAdapter);
    this.#listRunnableQueuedTasksUseCase = new ListRunnableQueuedTasksUseCase(taskAdapter);
    this.#enqueueTaskUseCase = new EnqueueTaskUseCase(taskAdapter);
    this.#deferQueuedTaskUseCase = new DeferQueuedTaskUseCase(taskAdapter);
    this.#startQueuedTaskUseCase = new StartQueuedTaskUseCase(taskAdapter);
    this.#completeQueuedTaskUseCase = new CompleteQueuedTaskUseCase(taskAdapter);
    this.#failOrRetryQueuedTaskUseCase = new FailOrRetryQueuedTaskUseCase(taskAdapter);
    const healthPolicyEnforcementPointResolver = productionArchivePolicy === undefined
      ? options.healthPolicyEnforcementPointResolver ?? failClosedHealthPolicyEnforcementPointResolver
      : createHealthProductionPolicyEnforcementPointResolver({
          transactionExecutor: this.#transactionExecutor,
          accountRepository: this.#repositories.accountRepository,
          permissionRepository: this.#repositories.objectPermissionRepository,
          trustedDeviceRepository: this.#repositories.trustedDeviceRepository,
          healthPolicyResourceRepository: this.#repositories.healthRepository,
          personRepository: this.#repositories.personRepository,
          deviceIdentityProvider: this.#deviceIdentityProvider,
          authorizationProvider: productionArchivePolicy.authorizationProvider,
          receiptSink: productionArchivePolicy.receiptSink,
          policyTransactionRepository: this.#repositories.platformPolicyTransactionRepository,
          clusterFence: productionArchivePolicy.clusterFence,
          policyVersion: productionArchivePolicy.policyVersion,
          clock: this.#clock
        });
    const healthApplicationDependencies = {
      transactionExecutor: this.#transactionExecutor,
      healthRepository: this.#repositories.healthRepository,
      accountRepository: this.#repositories.accountRepository,
      permissionRepository: this.#repositories.objectPermissionRepository,
      personRepository: this.#repositories.personRepository,
      auditRepository: this.#repositories.auditRepository,
      outboxRepository: this.#repositories.outboxRepository,
      policyEnforcementPointResolver: healthPolicyEnforcementPointResolver,
      clusterFence: productionArchivePolicy?.clusterFence
        ?? options.archiveClusterFence
        ?? nonWritableHealthClusterFence
    } as const;
    const healthQuery = new RepositoryBackedHealthQueryPort(healthApplicationDependencies);
    const healthUnitOfWork = new RepositoryBackedHealthUnitOfWork(healthApplicationDependencies);
    const healthCareUnitOfWork = new RepositoryBackedHealthCareCoordinationUnitOfWork(healthApplicationDependencies);
    this.#listHealthRecordsUseCase = new ListHealthRecordsUseCase(healthQuery);
    this.#createHealthRecordUseCase = new CreateHealthRecordUseCase(healthUnitOfWork);
    this.#listMedicationPlansUseCase = new ListMedicationPlansUseCase(healthQuery);
    this.#createMedicationPlanUseCase = new CreateMedicationPlanUseCase(healthUnitOfWork);
    this.#listFamilyHealthHistoryUseCase = new ListFamilyHealthHistoryUseCase(healthQuery);
    this.#createFamilyHealthHistoryUseCase = new CreateFamilyHealthHistoryUseCase(healthUnitOfWork);
    this.#getHealthCareCoordinationCenterUseCase = new GetHealthCareCoordinationCenterUseCase(healthQuery);
    this.#recordHealthCareEntryUseCase = new RecordHealthCareEntryUseCase(healthCareUnitOfWork);
    this.#upsertHealthCareAccessGrantUseCase = new UpsertHealthCareAccessGrantUseCase(healthCareUnitOfWork);
    this.#revokeHealthCareAccessGrantUseCase = new RevokeHealthCareAccessGrantUseCase(healthCareUnitOfWork);
    const lifeQuery = new RepositoryBackedLifeQueryPort(
      lifeApplicationDependencies,
      lifePolicyTransactionRunner
    );
    const lifeUnitOfWork = new RepositoryBackedLifeUnitOfWork(
      lifeApplicationDependencies,
      lifePolicyTransactionRunner
    );
    this.#listLifeRecordsUseCase = new ListLifeRecordsUseCase(lifeQuery);
    this.#createLifeRecordUseCase = new CreateLifeRecordUseCase(lifeUnitOfWork);
    this.#getManagedLifeWorkspaceUseCase = new GetManagedLifeWorkspaceUseCase(lifeQuery);
    this.#recordManagedLifeItemUseCase = new RecordManagedLifeItemUseCase(lifeUnitOfWork);
    const householdOperationsQuery = new RepositoryBackedHouseholdOperationsQueryPort(
      lifeApplicationDependencies,
      lifePolicyTransactionRunner
    );
    const householdOperationsUnitOfWork = new RepositoryBackedHouseholdOperationsUnitOfWork(
      lifeApplicationDependencies,
      lifePolicyTransactionRunner
    );
    this.#getHouseholdOperationsCenterUseCase = new GetHouseholdOperationsCenterUseCase(householdOperationsQuery);
    this.#createHouseholdOperationItemUseCase = new CreateHouseholdOperationItemUseCase(householdOperationsUnitOfWork);
    this.#updateHouseholdOperationItemUseCase = new UpdateHouseholdOperationItemUseCase(householdOperationsUnitOfWork);
    this.#deleteHouseholdOperationItemUseCase = new DeleteHouseholdOperationItemUseCase(householdOperationsUnitOfWork);
    const childEducationQuery = new RepositoryBackedChildEducationQueryPort(
      lifeApplicationDependencies,
      lifePolicyTransactionRunner
    );
    const childEducationUnitOfWork = new RepositoryBackedChildEducationCoordinationUnitOfWork(
      lifeApplicationDependencies,
      lifePolicyTransactionRunner
    );
    this.#getChildEducationCenterUseCase = new GetChildEducationCenterUseCase(childEducationQuery);
    this.#createChildEducationItemUseCase = new CreateChildEducationItemUseCase(childEducationUnitOfWork);
    this.#updateChildEducationItemUseCase = new UpdateChildEducationItemUseCase(childEducationUnitOfWork);
    this.#deleteChildEducationItemUseCase = new DeleteChildEducationItemUseCase(childEducationUnitOfWork);
    const placesTravelQuery = new RepositoryBackedPlacesTravelQueryPort(
      lifeApplicationDependencies,
      lifePolicyTransactionRunner
    );
    const placesTravelUnitOfWork = new RepositoryBackedPlacesTravelAssetPetUnitOfWork(
      lifeApplicationDependencies,
      lifePolicyTransactionRunner
    );
    this.#getPlacesTravelCenterUseCase = new GetPlacesTravelCenterUseCase(placesTravelQuery);
    this.#createPlacesTravelItemUseCase = new CreatePlacesTravelItemUseCase(placesTravelUnitOfWork);
    this.#updatePlacesTravelItemUseCase = new UpdatePlacesTravelItemUseCase(placesTravelUnitOfWork);
    this.#deletePlacesTravelItemUseCase = new DeletePlacesTravelItemUseCase(placesTravelUnitOfWork);
    this.#prepareFamilyEmergencyCardExportUseCase = new PrepareFamilyEmergencyCardExportUseCase(
      lifeUnitOfWork,
      () => Date.parse(this.#clock.now())
    );
    this.#recordFamilyEmergencyCardExportCompletionUseCase =
      new RecordFamilyEmergencyCardExportCompletionUseCase(lifeUnitOfWork);
    const financePolicyEnforcementPointResolver = productionArchivePolicy === undefined
      ? options.financePolicyEnforcementPointResolver ?? failClosedFinancePolicyEnforcementPointResolver
      : createFinanceProductionPolicyEnforcementPointResolver({
          transactionExecutor: this.#transactionExecutor,
          accountRepository: this.#repositories.accountRepository,
          permissionRepository: this.#repositories.objectPermissionRepository,
          trustedDeviceRepository: this.#repositories.trustedDeviceRepository,
          financePolicyResourceRepository: this.#repositories.financeRepository,
          personRepository: this.#repositories.personRepository,
          deviceIdentityProvider: this.#deviceIdentityProvider,
          authorizationProvider: productionArchivePolicy.authorizationProvider,
          receiptSink: productionArchivePolicy.receiptSink,
          policyTransactionRepository: this.#repositories.platformPolicyTransactionRepository,
          clusterFence: productionArchivePolicy.clusterFence,
          policyVersion: productionArchivePolicy.policyVersion,
          clock: this.#clock
        });
    const financeApplicationDependencies = {
      transactionExecutor: this.#transactionExecutor,
      financeRepository: this.#repositories.financeRepository,
      accountRepository: this.#repositories.accountRepository,
      permissionRepository: this.#repositories.objectPermissionRepository,
      personRepository: this.#repositories.personRepository,
      auditRepository: this.#repositories.auditRepository,
      outboxRepository: this.#repositories.outboxRepository,
      policyEnforcementPointResolver: financePolicyEnforcementPointResolver,
      clusterFence: productionArchivePolicy?.clusterFence
        ?? options.archiveClusterFence
        ?? nonWritableFinanceClusterFence
    } as const;
    const financeQuery = new RepositoryBackedFinanceQueryPort(financeApplicationDependencies);
    const financeUnitOfWork = new RepositoryBackedFinanceUnitOfWork(financeApplicationDependencies);
    this.#listFinanceRecordsUseCase = new ListFinanceRecordsUseCase(financeQuery);
    this.#createFinanceRecordUseCase = new CreateFinanceRecordUseCase(financeUnitOfWork);
    this.#listFinanceValuationsUseCase = new ListFinanceValuationsUseCase(financeQuery);
    this.#createFinanceValuationUseCase = new CreateFinanceValuationUseCase(financeUnitOfWork);
    this.#listBankInstitutionsUseCase = new ListBankInstitutionsUseCase(financeQuery);
    this.#listBankAccountsUseCase = new ListBankAccountsUseCase(financeQuery);
    this.#validateIbanUseCase = new ValidateIbanUseCase(financeQuery);
    this.#createBankAccountUseCase = new CreateBankAccountUseCase(financeUnitOfWork);
    this.#listPaymentCardsUseCase = new ListPaymentCardsUseCase(financeQuery);
    this.#createPaymentCardUseCase = new CreatePaymentCardUseCase(financeUnitOfWork);
    this.#listLoanAccountsUseCase = new ListLoanAccountsUseCase(financeQuery);
    this.#createLoanAccountUseCase = new CreateLoanAccountUseCase(financeUnitOfWork);
    this.#recordLoanPaymentUseCase = new RecordLoanPaymentUseCase(financeUnitOfWork);
    this.#getFinancePlanningWorkspaceUseCase = new GetFinancePlanningWorkspaceUseCase(financeQuery);
    this.#recordFinancePlanningItemUseCase = new RecordFinancePlanningItemUseCase(financeUnitOfWork);
    this.#commitFinanceImportBatchUseCase = new CommitFinanceImportBatchUseCase(financeUnitOfWork);
    const longTermPortfolioDependencies = {
      ...financeApplicationDependencies,
      repository: this.#repositories.longTermPortfolioRepository
    } as const;
    const longTermPortfolioQuery = new RepositoryBackedLongTermPortfolioQueryPort(longTermPortfolioDependencies);
    const longTermPortfolioUnitOfWork = new RepositoryBackedLongTermPortfolioUnitOfWork(longTermPortfolioDependencies);
    this.#getLongTermPortfolioWorkspaceUseCase = new GetLongTermPortfolioWorkspaceUseCase(longTermPortfolioQuery);
    this.#recordLongTermPortfolioItemUseCase = new RecordLongTermPortfolioItemUseCase(longTermPortfolioUnitOfWork);
    const archivePolicyEnforcementPointResolver = productionArchivePolicy === undefined
      ? options.archivePolicyEnforcementPointResolver ?? failClosedArchivePolicyEnforcementPointResolver
      : createArchiveProductionPolicyEnforcementPointResolver({
          transactionExecutor: this.#transactionExecutor,
          accountRepository: this.#repositories.accountRepository,
          permissionRepository: this.#repositories.objectPermissionRepository,
          trustedDeviceRepository: this.#repositories.trustedDeviceRepository,
          archiveRepository: this.#repositories.archiveRepository,
          personRepository: this.#repositories.personRepository,
          deviceIdentityProvider: this.#deviceIdentityProvider,
          authorizationProvider: productionArchivePolicy.authorizationProvider,
          receiptSink: productionArchivePolicy.receiptSink,
          policyTransactionRepository: this.#repositories.platformPolicyTransactionRepository,
          clusterFence: productionArchivePolicy.clusterFence,
          policyVersion: productionArchivePolicy.policyVersion,
          clock: this.#clock
        });
    const archiveApplicationDependencies = {
      transactionExecutor: this.#transactionExecutor,
      archiveRepository: this.#repositories.archiveRepository,
      accountRepository: this.#repositories.accountRepository,
      permissionRepository: this.#repositories.objectPermissionRepository,
      auditRepository: this.#repositories.auditRepository,
      outboxRepository: this.#repositories.outboxRepository,
      policyEnforcementPointResolver: archivePolicyEnforcementPointResolver,
      clusterFence: productionArchivePolicy?.clusterFence ?? options.archiveClusterFence ?? nonWritableArchiveClusterFence
    } as const;
    const archiveQuery = new RepositoryBackedArchiveQueryPort(archiveApplicationDependencies);
    const archiveUnitOfWork = new RepositoryBackedArchiveUnitOfWork(archiveApplicationDependencies);
    this.#listArchiveItemsUseCase = new ListArchiveItemsUseCase(archiveQuery);
    this.#searchArchiveItemsUseCase = new SearchArchiveItemsUseCase(archiveQuery);
    const unifiedAuthorizedSearchSource = new RepositoryBackedUnifiedAuthorizedSearchSourcePort({
      loadFamilyAndEvents: () => this.getSnapshotSections({ sections: ['graph', 'timeline'] }),
      listArchive: () => this.listArchive(),
      listFinance: () => this.listFinanceRecords(),
      listHealth: () => this.listHealthRecords(),
      listLife: () => this.listLifeRecords(),
      now: () => this.#clock.now()
    });
    this.#searchUnifiedAuthorizedRecordsUseCase = new SearchUnifiedAuthorizedRecordsUseCase(unifiedAuthorizedSearchSource);
    const familyAiAssistantDependencies={...lifeApplicationDependencies,
      familyAiAssistantRepository:this.#repositories.familyAiAssistantRepository,
      familyAiAssistantPolicyResourceRepository:this.#repositories.familyAiAssistantRepository,
      aiConsentRepository:this.#repositories.aiConsentRepository} as const;
    const familyAiAssistantQuery=new RepositoryBackedFamilyAiAssistantQueryPort(
      familyAiAssistantDependencies,lifePolicyTransactionRunner);
    const familyAiAssistantUnitOfWork=new RepositoryBackedFamilyAiAssistantUnitOfWork(
      familyAiAssistantDependencies,lifePolicyTransactionRunner);
    const familyAiAssistantSource=new RepositoryBackedFamilyAiAssistantSourcePort({
      unifiedSource:unifiedAuthorizedSearchSource,
      loadOcrCenter:()=>this.getLocalGovernedOcrCenter(),
      loadHouseholdCenter:()=>this.getHouseholdOperationsCenter(),
      loadPlacesCenter:(ownerPersonId)=>this.getPlacesTravelCenter(ownerPersonId),
      listConsents:()=>Promise.resolve(this.listAiConsents()),
      listSensitiveProfiles:()=>Promise.resolve(this.listSensitiveDataProfiles()),
      now:()=>this.#clock.now()
    });
    this.#getFamilyAiAssistantCenterUseCase=new GetFamilyAiAssistantCenterUseCase(familyAiAssistantQuery);
    this.#generateFamilyAiSuggestionUseCase=new GenerateFamilyAiSuggestionUseCase(familyAiAssistantSource,familyAiAssistantUnitOfWork);
    this.#reviewFamilyAiSuggestionUseCase=new ReviewFamilyAiSuggestionUseCase(familyAiAssistantUnitOfWork);
    const memoryStudioDependencies={...lifeApplicationDependencies,
      memoryStudioRepository:this.#repositories.memoryStudioRepository,
      memoryStudioPolicyResourceRepository:this.#repositories.memoryStudioRepository} as const;
    const memoryStudioQuery=new RepositoryBackedMemoryStudioQueryPort(memoryStudioDependencies,lifePolicyTransactionRunner);
    const memoryStudioUnitOfWork=new RepositoryBackedMemoryStudioUnitOfWork(memoryStudioDependencies,lifePolicyTransactionRunner);
    this.#getMemoryStudioCenterUseCase=new GetMemoryStudioCenterUseCase(memoryStudioQuery);
    this.#createMemoryStudioRecordUseCase=new CreateMemoryStudioRecordUseCase(memoryStudioUnitOfWork);
    this.#deleteMemoryStudioRecordUseCase=new DeleteMemoryStudioRecordUseCase(memoryStudioUnitOfWork);
    this.#createMemoryTimeCapsuleUseCase=new CreateMemoryTimeCapsuleUseCase(memoryStudioUnitOfWork);
    this.#reviewMemoryTimeCapsuleUseCase=new ReviewMemoryTimeCapsuleUseCase(memoryStudioUnitOfWork);
    this.#transitionMemoryTimeCapsuleUseCase=new TransitionMemoryTimeCapsuleUseCase(memoryStudioUnitOfWork);
    const smartHomeEnergyDependencies={...lifeApplicationDependencies,
      smartHomeEnergyRepository:this.#repositories.smartHomeEnergyRepository,
      smartHomeEnergyPolicyResourceRepository:this.#repositories.smartHomeEnergyRepository} as const;
    const smartHomeEnergyQuery=new RepositoryBackedSmartHomeEnergyQueryPort(smartHomeEnergyDependencies,lifePolicyTransactionRunner);
    const smartHomeEnergyUnitOfWork=new RepositoryBackedSmartHomeEnergyUnitOfWork(smartHomeEnergyDependencies,lifePolicyTransactionRunner);
    this.#getSmartHomeEnergyCenterUseCase=new GetSmartHomeEnergyCenterUseCase(smartHomeEnergyQuery);
    this.#registerSmartHomeDeviceUseCase=new RegisterSmartHomeDeviceUseCase(smartHomeEnergyUnitOfWork);
    this.#updateSmartHomeDeviceStatusUseCase=new UpdateSmartHomeDeviceStatusUseCase(smartHomeEnergyUnitOfWork);
    this.#recordSmartHomeObservationUseCase=new RecordSmartHomeObservationUseCase(smartHomeEnergyUnitOfWork);
    this.#grantSmartHomeCameraConsentUseCase=new GrantSmartHomeCameraConsentUseCase(smartHomeEnergyUnitOfWork);
    this.#revokeSmartHomeCameraConsentUseCase=new RevokeSmartHomeCameraConsentUseCase(smartHomeEnergyUnitOfWork);
    this.#setSmartHomeProcessingUseCase=new SetSmartHomeProcessingUseCase(smartHomeEnergyUnitOfWork);
    const signedPluginPlatformDependencies={...lifeApplicationDependencies,
      signedPluginPlatformRepository:this.#repositories.signedPluginPlatformRepository,
      signedPluginPlatformPolicyResourceRepository:this.#repositories.signedPluginPlatformRepository} as const;
    const signedPluginPlatformQuery=new RepositoryBackedSignedPluginPlatformQueryPort(signedPluginPlatformDependencies,lifePolicyTransactionRunner);
    const signedPluginPlatformUnitOfWork=new RepositoryBackedSignedPluginPlatformUnitOfWork(signedPluginPlatformDependencies,lifePolicyTransactionRunner);
    this.#getSignedPluginPlatformCenterUseCase=new GetSignedPluginPlatformCenterUseCase(signedPluginPlatformQuery);
    this.#registerSignedPluginReleaseUseCase=new RegisterSignedPluginReleaseUseCase(signedPluginPlatformUnitOfWork);
    this.#setSignedPluginDesiredStateUseCase=new SetSignedPluginDesiredStateUseCase(signedPluginPlatformUnitOfWork);
    this.#emergencyDisableSignedPluginUseCase=new EmergencyDisableSignedPluginUseCase(signedPluginPlatformUnitOfWork);
    this.#rollbackSignedPluginUseCase=new RollbackSignedPluginUseCase(signedPluginPlatformUnitOfWork);
    const communicationSecurityDependencies={...lifeApplicationDependencies,
      communicationSecurityRepository:this.#repositories.communicationSecurityRepository,
      communicationSecurityPolicyResourceRepository:this.#repositories.communicationSecurityRepository} as const;
    const communicationSecurityQuery=new RepositoryBackedCommunicationSecurityQueryPort(
      communicationSecurityDependencies,lifePolicyTransactionRunner);
    const communicationSecurityUnitOfWork=new RepositoryBackedCommunicationSecurityUnitOfWork(
      communicationSecurityDependencies,lifePolicyTransactionRunner);
    const communicationMlsFoundation:CommunicationMlsFoundationPort=options.communicationMlsFoundation??{
      provisionDeviceCredential:()=>communicationMlsUnavailable('RFC 9420 MLS cihaz kimliği sağlayıcısı yapılandırılmadı.'),
      createGroup:()=>communicationMlsUnavailable('RFC 9420 MLS grup sağlayıcısı yapılandırılmadı.'),
      advanceEpoch:()=>communicationMlsUnavailable('RFC 9420 MLS dönem sağlayıcısı yapılandırılmadı.')
    };
    this.#getCommunicationSecurityCenterUseCase=new GetCommunicationSecurityCenterUseCase(communicationSecurityQuery);
    this.#registerCommunicationDeviceCredentialUseCase=new RegisterCommunicationDeviceCredentialUseCase(
      communicationSecurityUnitOfWork,communicationMlsFoundation);
    this.#revokeCommunicationDeviceCredentialUseCase=new RevokeCommunicationDeviceCredentialUseCase(communicationSecurityUnitOfWork);
    this.#createCommunicationRoomUseCase=new CreateCommunicationRoomUseCase(communicationSecurityUnitOfWork,communicationMlsFoundation);
    this.#addCommunicationRoomMemberUseCase=new AddCommunicationRoomMemberUseCase(communicationSecurityUnitOfWork,communicationMlsFoundation);
    this.#removeCommunicationRoomMemberUseCase=new RemoveCommunicationRoomMemberUseCase(communicationSecurityUnitOfWork,communicationMlsFoundation);
    this.#rekeyCommunicationRoomAfterDeviceRevocationUseCase=new RekeyCommunicationRoomAfterDeviceRevocationUseCase(
      communicationSecurityUnitOfWork,communicationMlsFoundation);
    this.#setCommunicationHistoryAccessUseCase=new SetCommunicationHistoryAccessUseCase(communicationSecurityUnitOfWork);
    this.#freezeCommunicationRoomUseCase=new FreezeCommunicationRoomUseCase(communicationSecurityUnitOfWork);
    const communicationMessagePayloadPath=communicationMessagePayloadRoot({
      ...(options.communicationMessagePayloadPath===undefined?{}:{requestedPath:options.communicationMessagePayloadPath}),
      databasePath:storageLayout.databasePath,archivePath:storageLayout.archivePath,
      keyPath:storageLayout.vaultKeyPath,temporaryOpenPath:storageLayout.temporaryOpenPath
    });
    const communicationMessagePayloads=options.communicationMessagePayloads!==undefined
      ?assertCommunicationMessagePayloadPort(options.communicationMessagePayloads)
      :options.protectedSideArtifacts===undefined
        ?failClosedCommunicationMessagePayloads
        :new CommunicationMessagePayloadVault({
            rootDirectory:communicationMessagePayloadPath,
            protectedStore:options.protectedSideArtifacts
          });
    const communicationMessagingDependencies={...lifeApplicationDependencies,
      communicationMessagingRepository:this.#repositories.communicationMessagingRepository,
      communicationMessagingPolicyResourceRepository:this.#repositories.communicationMessagingRepository,
      communicationMessagePayloads} as const;
    const communicationMessagingQuery=new RepositoryBackedCommunicationMessagingQueryPort(
      communicationMessagingDependencies,lifePolicyTransactionRunner);
    const communicationMessagingUnitOfWork=new RepositoryBackedCommunicationMessagingUnitOfWork(
      communicationMessagingDependencies,lifePolicyTransactionRunner);
    this.#getCommunicationMessagingCenterUseCase=new GetCommunicationMessagingCenterUseCase(communicationMessagingQuery);
    this.#searchCommunicationMessagesUseCase=new SearchCommunicationMessagesUseCase(communicationMessagingQuery);
    this.#getCommunicationMessageContentUseCase=new GetCommunicationMessageContentUseCase(communicationMessagingQuery);
    this.#createCommunicationMessageUseCase=new CreateCommunicationMessageUseCase(
      communicationMessagingUnitOfWork,communicationMessagePayloads);
    this.#editCommunicationMessageUseCase=new EditCommunicationMessageUseCase(
      communicationMessagingUnitOfWork,communicationMessagePayloads);
    this.#setCommunicationMessageLifecycleUseCase=new SetCommunicationMessageLifecycleUseCase(communicationMessagingUnitOfWork);
    this.#annotateCommunicationMessageUseCase=new AnnotateCommunicationMessageUseCase(communicationMessagingUnitOfWork);
    this.#updateCommunicationDeliveryUseCase=new UpdateCommunicationDeliveryUseCase(communicationMessagingUnitOfWork);
    this.#setCommunicationPresenceUseCase=new SetCommunicationPresenceUseCase(communicationMessagingUnitOfWork);
    this.#setCommunicationRetentionPolicyUseCase=new SetCommunicationRetentionPolicyUseCase(communicationMessagingUnitOfWork);
    this.#maintainCommunicationMessagePayloadVaultUseCase=new MaintainCommunicationMessagePayloadVaultUseCase(
      communicationMessagingQuery,communicationMessagePayloads);
    const communicationFilePayloads=options.communicationFilePayloads!==undefined
      ?assertCommunicationFilePayloadPort(options.communicationFilePayloads)
      :options.protectedSideArtifacts===undefined
        ?failClosedCommunicationFilePayloads
        :new CommunicationFilePayloadVault({
            rootDirectory:communicationFilePayloadRoot({
              ...(options.communicationFilePayloadPath===undefined?{}:{requestedPath:options.communicationFilePayloadPath}),
              databasePath:storageLayout.databasePath,archivePath:storageLayout.archivePath,
              keyPath:storageLayout.vaultKeyPath,temporaryOpenPath:storageLayout.temporaryOpenPath,
              messagePayloadPath:communicationMessagePayloadPath
            }),
            protectedStore:options.protectedSideArtifacts,
            ...(options.communicationFileMalwareScanner===undefined?{}:{malwareScanner:options.communicationFileMalwareScanner})
          });
    const communicationFileSharingDependencies={...lifeApplicationDependencies,
      communicationFileSharingRepository:this.#repositories.communicationFileSharingRepository,
      communicationFileSharingPolicyResourceRepository:this.#repositories.communicationFileSharingRepository} as const;
    const communicationFileSharingQuery=new RepositoryBackedCommunicationFileSharingQueryPort(
      communicationFileSharingDependencies,lifePolicyTransactionRunner);
    const communicationFileSharingUnitOfWork=new RepositoryBackedCommunicationFileSharingUnitOfWork(
      communicationFileSharingDependencies,lifePolicyTransactionRunner);
    this.#getCommunicationFileSharingCenterUseCase=new GetCommunicationFileSharingCenterUseCase(communicationFileSharingQuery);
    this.#getCommunicationFileSafePreviewUseCase=new GetCommunicationFileSafePreviewUseCase(
      communicationFileSharingQuery,communicationFilePayloads);
    this.#maintainCommunicationFilePayloadVaultUseCase=new MaintainCommunicationFilePayloadVaultUseCase(
      communicationFileSharingQuery,communicationFilePayloads);
    this.#prepareCommunicationFileUseCase=new PrepareCommunicationFileUseCase(
      communicationFileSharingUnitOfWork,communicationFilePayloads);
    this.#applyCommunicationFileSharingCommandUseCase=new ApplyCommunicationFileSharingCommandUseCase(
      communicationFileSharingUnitOfWork);
    const communicationAuditArchiveDependencies={...lifeApplicationDependencies,
      communicationAuditArchiveRepository:this.#repositories.communicationAuditArchiveRepository,
      communicationAuditArchivePolicyResourceRepository:this.#repositories.communicationAuditArchiveRepository} as const;
    const communicationAuditArchiveQuery=new RepositoryBackedCommunicationAuditArchiveQueryPort(
      communicationAuditArchiveDependencies,lifePolicyTransactionRunner);
    this.#getCommunicationAuditArchiveSafeCenterUseCase=new GetCommunicationAuditArchiveSafeCenterUseCase(
      communicationAuditArchiveQuery);
    const communicationRealtimeCallingDependencies={...lifeApplicationDependencies,
      communicationRealtimeCallingRepository:this.#repositories.communicationRealtimeCallingRepository,
      communicationRealtimeCallingPolicyResourceRepository:this.#repositories.communicationRealtimeCallingRepository} as const;
    const communicationCallPreflight:CommunicationCallPreflightPort=options.communicationCallPreflight??{
      run:(context)=>Promise.resolve(err(createAppError({code:ERROR_CODES.AUTHORIZATION_DENIED,category:'security',
        message:'Yerel kamera, mikrofon ve hoparlör preflight sağlayıcısı yapılandırılmadı.',correlationId:context.correlationId})))
    };
    const communicationRealtimeCallingQuery=new RepositoryBackedCommunicationRealtimeCallingQueryPort(
      communicationRealtimeCallingDependencies,lifePolicyTransactionRunner,options.communicationCallPreflight!==undefined);
    const communicationRealtimeCallingUnitOfWork=new RepositoryBackedCommunicationRealtimeCallingUnitOfWork(
      communicationRealtimeCallingDependencies,lifePolicyTransactionRunner);
    this.#getCommunicationRealtimeCallingCenterUseCase=new GetCommunicationRealtimeCallingCenterUseCase(communicationRealtimeCallingQuery);
    this.#createCommunicationCallUseCase=new CreateCommunicationCallUseCase(communicationRealtimeCallingUnitOfWork);
    this.#runCommunicationCallPreflightUseCase=new RunCommunicationCallPreflightUseCase(
      communicationRealtimeCallingUnitOfWork,communicationCallPreflight);
    this.#updateCommunicationCallControlsUseCase=new UpdateCommunicationCallControlsUseCase(communicationRealtimeCallingUnitOfWork);
    this.#advanceCommunicationCallUseCase=new AdvanceCommunicationCallUseCase(communicationRealtimeCallingUnitOfWork);
    this.#setCommunicationCallPreferencesUseCase=new SetCommunicationCallPreferencesUseCase(communicationRealtimeCallingUnitOfWork);
    const communicationRecordingDependencies={...lifeApplicationDependencies,
      communicationRecordingRepository:this.#repositories.communicationRecordingRepository,
      communicationRecordingPolicyResourceRepository:this.#repositories.communicationRecordingRepository} as const;
    const communicationRecordingQuery=new RepositoryBackedCommunicationRecordingQueryPort(
      communicationRecordingDependencies,lifePolicyTransactionRunner);
    const communicationRecordingUnitOfWork=new RepositoryBackedCommunicationRecordingUnitOfWork(
      communicationRecordingDependencies,lifePolicyTransactionRunner);
    this.#getCommunicationRecordingCenterUseCase=new GetCommunicationRecordingCenterUseCase(communicationRecordingQuery);
    this.#createCommunicationRecordingRequestUseCase=new CreateCommunicationRecordingRequestUseCase(communicationRecordingUnitOfWork);
    this.#decideCommunicationRecordingConsentUseCase=new DecideCommunicationRecordingConsentUseCase(communicationRecordingUnitOfWork);
    this.#withdrawCommunicationRecordingConsentUseCase=new WithdrawCommunicationRecordingConsentUseCase(communicationRecordingUnitOfWork);
    this.#addCommunicationRecordingLateJoinerUseCase=new AddCommunicationRecordingLateJoinerUseCase(communicationRecordingUnitOfWork);
    this.#setCommunicationRecordingSegmentUseCase=new SetCommunicationRecordingSegmentUseCase(communicationRecordingUnitOfWork);
    this.#updateCommunicationRecordingRetentionUseCase=new UpdateCommunicationRecordingRetentionUseCase(communicationRecordingUnitOfWork);
    this.#requestCommunicationRecordingDeletionUseCase=new RequestCommunicationRecordingDeletionUseCase(communicationRecordingUnitOfWork);
    const localTranslationDependencies={...lifeApplicationDependencies,
      localTranslationRepository:this.#repositories.localTranslationRepository,
      localTranslationPolicyResourceRepository:this.#repositories.localTranslationRepository} as const;
    const localTranslationQuery=new RepositoryBackedLocalTranslationQueryPort(
      localTranslationDependencies,lifePolicyTransactionRunner);
    const localTranslationUnitOfWork=new RepositoryBackedLocalTranslationUnitOfWork(
      localTranslationDependencies,lifePolicyTransactionRunner);
    this.#getLocalTranslationCenterUseCase=new GetLocalTranslationCenterUseCase(localTranslationQuery);
    this.#updateLocalTranslationProfileUseCase=new UpdateLocalTranslationProfileUseCase(localTranslationUnitOfWork);
    this.#addLocalTranslationDictionaryEntryUseCase=new AddLocalTranslationDictionaryEntryUseCase(localTranslationUnitOfWork);
    this.#updateLocalTranslationDictionaryEntryUseCase=new UpdateLocalTranslationDictionaryEntryUseCase(localTranslationUnitOfWork);
    this.#deleteLocalTranslationDictionaryEntryUseCase=new DeleteLocalTranslationDictionaryEntryUseCase(localTranslationUnitOfWork);
    this.#prepareLocalTranslationRequestUseCase=new PrepareLocalTranslationRequestUseCase(localTranslationUnitOfWork);
    this.#recordLocalTranslationCorrectionUseCase=new RecordLocalTranslationCorrectionUseCase(localTranslationUnitOfWork);
    this.#cancelLocalTranslationRequestUseCase=new CancelLocalTranslationRequestUseCase(localTranslationUnitOfWork);
    const familyMeetingMinutesArtifacts=options.familyMeetingMinutesArtifacts!==undefined
      ?assertFamilyMeetingMinutesArtifactPort(options.familyMeetingMinutesArtifacts)
      :options.protectedSideArtifacts===undefined
        ?failClosedFamilyMeetingMinutesArtifacts
        :new FamilyMeetingMinutesVault({
            rootDirectory:familyMeetingMinutesRoot({
              ...(options.familyMeetingMinutesPath===undefined?{}:{requestedPath:options.familyMeetingMinutesPath}),
              databasePath:storageLayout.databasePath,archivePath:storageLayout.archivePath,
              keyPath:storageLayout.vaultKeyPath,temporaryOpenPath:storageLayout.temporaryOpenPath
            }),
            protectedStore:options.protectedSideArtifacts
          });
    const familyMeetingDependencies={...lifeApplicationDependencies,
      familyMeetingRepository:this.#repositories.familyMeetingRepository,
      familyMeetingPolicyResourceRepository:this.#repositories.familyMeetingRepository,
      communicationRecordingRepository:this.#repositories.communicationRecordingRepository,
      minutesArtifacts:familyMeetingMinutesArtifacts} as const;
    const familyMeetingQuery=new RepositoryBackedFamilyMeetingQueryPort(
      familyMeetingDependencies,lifePolicyTransactionRunner);
    const familyMeetingUnitOfWork=new RepositoryBackedFamilyMeetingUnitOfWork(
      familyMeetingDependencies,lifePolicyTransactionRunner);
    const familyMeetingRecordingConsent=new RepositoryBackedFamilyMeetingRecordingConsentPort(
      familyMeetingDependencies,lifePolicyTransactionRunner);
    this.#getFamilyMeetingCenterUseCase=new GetFamilyMeetingCenterUseCase(familyMeetingQuery);
    this.#getFamilyMeetingMinutesUseCase=new GetFamilyMeetingMinutesUseCase(familyMeetingQuery);
    this.#createFamilyMeetingUseCase=new CreateFamilyMeetingUseCase(familyMeetingUnitOfWork);
    this.#updateFamilyMeetingPlanUseCase=new UpdateFamilyMeetingPlanUseCase(familyMeetingUnitOfWork);
    this.#setFamilyMeetingStateUseCase=new SetFamilyMeetingStateUseCase(familyMeetingUnitOfWork);
    this.#upsertFamilyMeetingParticipantUseCase=new UpsertFamilyMeetingParticipantUseCase(familyMeetingUnitOfWork);
    this.#upsertFamilyMeetingAgendaItemUseCase=new UpsertFamilyMeetingAgendaItemUseCase(familyMeetingUnitOfWork);
    this.#createFamilyMeetingPollUseCase=new CreateFamilyMeetingPollUseCase(familyMeetingUnitOfWork);
    this.#castFamilyMeetingVoteUseCase=new CastFamilyMeetingVoteUseCase(familyMeetingUnitOfWork);
    this.#recordFamilyMeetingDecisionUseCase=new RecordFamilyMeetingDecisionUseCase(familyMeetingUnitOfWork);
    this.#upsertFamilyMeetingTaskUseCase=new UpsertFamilyMeetingTaskUseCase(familyMeetingUnitOfWork);
    this.#addFamilyMeetingCollaborationUseCase=new AddFamilyMeetingCollaborationUseCase(familyMeetingUnitOfWork);
    this.#prepareFamilyMeetingAiMinutesUseCase=new PrepareFamilyMeetingAiMinutesUseCase(
      familyMeetingUnitOfWork,familyMeetingRecordingConsent,unavailableFamilyMeetingAiMinutesProvider,
      familyMeetingMinutesArtifacts);
    this.#finalizeFamilyMeetingMinutesUseCase=new FinalizeFamilyMeetingMinutesUseCase(
      familyMeetingUnitOfWork,familyMeetingMinutesArtifacts);
    this.#prepareArchiveOpenUseCase = new PrepareArchiveOpenUseCase(archiveQuery);
    this.#recordArchiveOpenedUseCase = new RecordArchiveOpenedUseCase(archiveUnitOfWork);
    this.#authorizeEmergencyArchiveReadUseCase = new AuthorizeEmergencyArchiveReadUseCase(archiveUnitOfWork);
    this.#listArchiveVersionsUseCase = new ListArchiveVersionsUseCase(archiveQuery);
    this.#listArchiveRelationEvidenceUseCase = new ListArchiveRelationEvidenceUseCase(archiveQuery);
    this.#listArchiveRelationEvidenceHistoryUseCase = new ListArchiveRelationEvidenceHistoryUseCase(archiveQuery);
    this.#addArchiveRelationEvidenceUseCase = new AddArchiveRelationEvidenceUseCase(archiveUnitOfWork);
    this.#removeArchiveRelationEvidenceUseCase = new RemoveArchiveRelationEvidenceUseCase(archiveUnitOfWork);
    this.#addArchiveItemVersionUseCase = new AddArchiveItemVersionUseCase(archiveUnitOfWork);
    this.#importArchiveItemUseCase = new ImportArchiveItemUseCase(archiveUnitOfWork);
    this.#listArchiveRetentionPoliciesUseCase = new ListArchiveRetentionPoliciesUseCase(archiveQuery);
    this.#listArchiveRetentionStatusUseCase = new ListArchiveRetentionStatusUseCase(archiveQuery);
    this.#createArchiveRetentionPolicyUseCase = new CreateArchiveRetentionPolicyUseCase(archiveUnitOfWork);
    this.#assignArchiveRetentionPolicyUseCase = new AssignArchiveRetentionPolicyUseCase(archiveUnitOfWork);
    this.#prepareArchiveDestructionUseCase = new PrepareArchiveDestructionUseCase(archiveQuery);
    this.#markArchiveDestroyedUseCase = new MarkArchiveDestroyedUseCase(archiveUnitOfWork);
    this.#reattestLegacyArchiveOwnershipUseCase = new ReattestLegacyArchiveOwnershipUseCase(archiveUnitOfWork, strongAuthentication);
    this.#listArchiveCategoriesUseCase = new ListArchiveCategoriesUseCase(archiveQuery);
    this.#listArchiveClassificationsUseCase = new ListArchiveClassificationsUseCase(archiveQuery);
    this.#createArchiveCategoryUseCase = new CreateArchiveCategoryUseCase(archiveUnitOfWork);
    this.#updateArchiveClassificationUseCase = new UpdateArchiveClassificationUseCase(archiveUnitOfWork);
    const aiConsentDependencies = { transactionExecutor:this.#transactionExecutor, consentRepository:this.#repositories.aiConsentRepository, accountRepository:this.#repositories.accountRepository, permissionRepository:this.#repositories.objectPermissionRepository, auditRepository:this.#repositories.auditRepository } as const;
    const aiConsentQuery = new RepositoryBackedAiConsentQueryPort(aiConsentDependencies);
    const aiConsentUnitOfWork = new RepositoryBackedAiConsentUnitOfWork(aiConsentDependencies);
    const sensitiveDataAuthorization = new RepositoryBackedSensitiveDataAuthorizationPort(aiConsentDependencies);
    this.#listAiConsentsUseCase = new ListAiConsentsUseCase(aiConsentQuery);
    this.#upsertAiConsentUseCase = new UpsertAiConsentUseCase(aiConsentUnitOfWork);
    this.#previewAiAccessUseCase = new PreviewAiAccessUseCase(aiConsentQuery);
    this.#listSensitiveDataProfilesUseCase = new ListSensitiveDataProfilesUseCase(aiConsentQuery, sensitiveDataAuthorization);
    this.#upsertSensitiveDataConsentUseCase = new UpsertSensitiveDataConsentUseCase(aiConsentUnitOfWork, sensitiveDataAuthorization);
    this.#previewSensitiveExportUseCase = new PreviewSensitiveExportUseCase(aiConsentQuery, aiConsentUnitOfWork, sensitiveDataAuthorization);
    const localGovernedOcrPolicyEnforcementPointResolver = productionArchivePolicy === undefined
      ? failClosedLocalGovernedOcrPolicyEnforcementPointResolver
      : createLocalGovernedOcrProductionPolicyEnforcementPointResolver({
          transactionExecutor: this.#transactionExecutor,
          accountRepository: this.#repositories.accountRepository,
          permissionRepository: this.#repositories.objectPermissionRepository,
          trustedDeviceRepository: this.#repositories.trustedDeviceRepository,
          timelinePolicyResourceRepository: this.#repositories.timelineRepository,
          accessibilityPreferencesRepository: this.#repositories.accessibilityPreferencesRepository,
          formDraftRepository: this.#repositories.formDraftRepository,
          identityAccessCredentialRepository: this.#repositories.identityAccessCredentialRepository,
          privacyOwnershipDataRightsRepository: this.#repositories.privacyOwnershipDataRightsRepository,
          personRepository: this.#repositories.personRepository,
          deviceIdentityProvider: this.#deviceIdentityProvider,
          authorizationProvider: productionArchivePolicy.authorizationProvider,
          receiptSink: productionArchivePolicy.receiptSink,
          policyTransactionRepository: this.#repositories.platformPolicyTransactionRepository,
          clusterFence: productionArchivePolicy.clusterFence,
          policyVersion: productionArchivePolicy.policyVersion,
          clock: this.#clock,
          localGovernedOcrRepository: this.#repositories.localGovernedOcrRepository,
          aiConsentRepository: this.#repositories.aiConsentRepository
        });
    const localGovernedOcrUnitOfWork = new RepositoryBackedLocalGovernedOcrUnitOfWork({
      transactionExecutor: this.#transactionExecutor,
      localGovernedOcrRepository: this.#repositories.localGovernedOcrRepository,
      derivedDataPolicyRepository: this.#repositories.derivedDataPolicyRepository,
      auditRepository: this.#repositories.auditRepository,
      outboxRepository: this.#repositories.outboxRepository,
      policyEnforcementPointResolver: localGovernedOcrPolicyEnforcementPointResolver,
      clusterFence: productionArchivePolicy?.clusterFence ?? nonWritableArchiveClusterFence
    });
    const localGovernedOcrRuntime = options.localGovernedOcrRuntime !== undefined
      ? assertLocalGovernedOcrRuntimePort(options.localGovernedOcrRuntime)
      : options.protectedSideArtifacts === undefined
        ? failClosedLocalGovernedOcrRuntime
        : createWindowsLocalGovernedOcrRuntimeAdapter({
            authority: localGovernedOcrUnitOfWork,
            archiveVaultFiles,
            resultVault: new LocalGovernedOcrResultVault({
              rootDirectory: localGovernedOcrResultRoot({
                ...(options.localGovernedOcrResultPath === undefined
                  ? {}
                  : { requestedPath: options.localGovernedOcrResultPath }),
                databasePath: storageLayout.databasePath,
                archivePath: storageLayout.archivePath,
                keyPath: storageLayout.vaultKeyPath,
                temporaryOpenPath: storageLayout.temporaryOpenPath
              }),
              protectedStore: options.protectedSideArtifacts
            }),
            now: () => this.#clock.now()
          });
    this.#getLocalGovernedOcrCenterUseCase = new GetLocalGovernedOcrCenterUseCase(localGovernedOcrUnitOfWork);
    this.#getLocalGovernedOcrResultUseCase = new GetLocalGovernedOcrResultUseCase(
      localGovernedOcrUnitOfWork,
      localGovernedOcrRuntime
    );
    this.#searchLocalGovernedOcrUseCase = new SearchLocalGovernedOcrUseCase(
      localGovernedOcrUnitOfWork,
      localGovernedOcrRuntime
    );
    this.#createLocalGovernedOcrJobUseCase = new CreateLocalGovernedOcrJobUseCase(localGovernedOcrUnitOfWork);
    this.#runLocalGovernedOcrJobUseCase = new RunLocalGovernedOcrJobUseCase(
      localGovernedOcrUnitOfWork,
      localGovernedOcrRuntime
    );
    this.#cancelLocalGovernedOcrJobUseCase = new CancelLocalGovernedOcrJobUseCase(
      localGovernedOcrUnitOfWork,
      localGovernedOcrRuntime
    );
    this.#correctLocalGovernedOcrResultUseCase = new CorrectLocalGovernedOcrResultUseCase(
      localGovernedOcrUnitOfWork,
      localGovernedOcrRuntime
    );
    this.#rerunLocalGovernedOcrJobUseCase = new RerunLocalGovernedOcrJobUseCase(
      localGovernedOcrUnitOfWork,
      localGovernedOcrRuntime
    );
    this.#deleteLocalGovernedOcrJobUseCase = new DeleteLocalGovernedOcrJobUseCase(
      localGovernedOcrUnitOfWork,
      localGovernedOcrRuntime
    );
    this.#reconcileLocalGovernedOcrAuthorizationUseCase = new ReconcileLocalGovernedOcrAuthorizationUseCase(
      localGovernedOcrUnitOfWork,
      localGovernedOcrRuntime
    );
    this.#reconcileLocalGovernedOcrRetentionUseCase = new ReconcileLocalGovernedOcrRetentionUseCase(
      localGovernedOcrUnitOfWork,
      localGovernedOcrRuntime
    );
    this.#sweepLocalGovernedOcrOrphansUseCase = new SweepLocalGovernedOcrOrphansUseCase(
      localGovernedOcrUnitOfWork,
      localGovernedOcrRuntime
    );
    this.#setLocalGovernedOcrEnabledUseCase = new SetLocalGovernedOcrEnabledUseCase(
      localGovernedOcrUnitOfWork,
      localGovernedOcrRuntime
    );
    this.#propagateLocalGovernedOcrSourceDeletionUseCase = new PropagateLocalGovernedOcrSourceDeletionUseCase(
      localGovernedOcrUnitOfWork,
      localGovernedOcrRuntime
    );
    const legacyDependencies={transactionExecutor:this.#transactionExecutor,legacyRepository:this.#repositories.legacyRepository,accountRepository:this.#repositories.accountRepository,permissionRepository:this.#repositories.objectPermissionRepository,personRepository:this.#repositories.personRepository,auditRepository:this.#repositories.auditRepository,outboxRepository:this.#repositories.outboxRepository} as const;
    const legacyQuery=new RepositoryBackedLegacyQueryPort(legacyDependencies); const legacyUnitOfWork=new RepositoryBackedLegacyUnitOfWork(legacyDependencies);
    this.#listDigitalLegacyPlansUseCase=new ListDigitalLegacyPlansUseCase(legacyQuery); this.#listLegacyGrantsUseCase=new ListLegacyGrantsUseCase(legacyQuery); this.#listLegacyApprovalsUseCase=new ListLegacyApprovalsUseCase(legacyQuery);
    this.#upsertDigitalLegacyPlanUseCase=new UpsertDigitalLegacyPlanUseCase(legacyUnitOfWork); this.#upsertLegacyGrantUseCase=new UpsertLegacyGrantUseCase(legacyUnitOfWork); this.#requestLegacyExecutionUseCase=new RequestLegacyExecutionUseCase(legacyUnitOfWork); this.#approveLegacyExecutionUseCase=new ApproveLegacyExecutionUseCase(legacyUnitOfWork); this.#finalizeLegacyExecutionUseCase=new FinalizeLegacyExecutionUseCase(legacyUnitOfWork); this.#cancelLegacyExecutionUseCase=new CancelLegacyExecutionUseCase(legacyUnitOfWork);
    const systemActor = { userId: asUserId('system-event-dispatcher'), roles: ['system'] } as const;
    const eventStore: EventDispatchStore = {
      claimPending: (input) => this.#transactionExecutor.execute(input.correlationId, (transaction) =>
        this.#repositories.outboxRepository.claimPending({
          transaction: transaction.transaction,
          actor: systemActor,
          correlationId: input.correlationId,
          occurredAt: input.now
        }, { limit: input.limit, staleBefore: input.staleBefore })),
      hasSuccessfulReceipt: (input) => this.#transactionExecutor.execute(input.correlationId, (transaction) =>
        this.#repositories.outboxRepository.hasSuccessfulReceipt({
          transaction: transaction.transaction,
          actor: systemActor,
          correlationId: input.correlationId,
          occurredAt: transaction.occurredAt
        }, input.eventId, input.handlerName)),
      recordReceipt: (input) => this.#transactionExecutor.execute(input.correlationId, (transaction) =>
        this.#repositories.outboxRepository.recordHandlerReceipt({
          transaction: transaction.transaction,
          actor: systemActor,
          correlationId: input.correlationId,
          occurredAt: transaction.occurredAt
        }, input.receipt)),
      markPublished: (input) => this.#transactionExecutor.execute(input.correlationId, (transaction) =>
        this.#repositories.outboxRepository.markPublished({
          transaction: transaction.transaction,
          actor: systemActor,
          correlationId: input.correlationId,
          occurredAt: transaction.occurredAt
        }, input.eventId, input.publishedAt)),
      reschedule: (input) => this.#transactionExecutor.execute(input.correlationId, (transaction) =>
        this.#repositories.outboxRepository.reschedule({
          transaction: transaction.transaction,
          actor: systemActor,
          correlationId: input.correlationId,
          occurredAt: transaction.occurredAt
        }, input.eventId, input.availableAt, input.error)),
      markFailed: (input) => this.#transactionExecutor.execute(input.correlationId, (transaction) =>
        this.#repositories.outboxRepository.markFailed({
          transaction: transaction.transaction,
          actor: systemActor,
          correlationId: input.correlationId,
          occurredAt: transaction.occurredAt
        }, input.eventId, input.failedAt, input.error))
    };
    this.#eventDispatcher = new EventDispatcher({
      store: eventStore,
      clock: this.#clock,
      retryPolicy: createExponentialRetryPolicy({
        maximumAttempts: 5,
        baseDelayMs: 1_000,
        maximumDelayMs: 5 * 60_000
      }),
      handlers: [
        createFamilyMemberCreatedLogHandler(this.#logger, this.#clock),
        createFamilyMemberCreatedDiagnosticHandler((event) =>
          this.#transactionExecutor.execute(event.correlationId, (transaction) =>
            this.#repositories.diagnosticRepository.insertIfAbsent({
              transaction: transaction.transaction,
              actor: systemActor,
              correlationId: event.correlationId,
              occurredAt: transaction.occurredAt
            }, {
              id: `event-handler:${event.eventId}:family-member-created-diagnostic-v1`,
              severity: 'info',
              code: 'family.member.created',
              message: `${event.payload.displayName} aile üyesi olarak işlendi.`,
              details: JSON.stringify({
                eventId: event.eventId,
                personId: event.payload.personId,
                familyId: event.payload.familyId,
                generation: event.payload.generation,
                branch: event.payload.branch
              }),
              occurredAt: event.occurredAt
            }))),
        createFamilyRelationCreatedLogHandler(this.#logger, this.#clock),
        createFamilyRelationCreatedDiagnosticHandler((event) =>
          this.#transactionExecutor.execute(event.correlationId, (transaction) =>
            this.#repositories.diagnosticRepository.insertIfAbsent({
              transaction: transaction.transaction,
              actor: systemActor,
              correlationId: event.correlationId,
              occurredAt: transaction.occurredAt
            }, {
              id: `event-handler:${event.eventId}:family-relation-created-diagnostic-v1`,
              severity: 'info',
              code: 'family.relation.created',
              message: `${event.payload.relationType} aile ilişkisi işlendi.`,
              details: JSON.stringify({
                eventId: event.eventId,
                relationId: event.payload.relationId,
                familyId: event.payload.familyId,
                fromPersonId: event.payload.fromPersonId,
                toPersonId: event.payload.toPersonId,
                relationType: event.payload.relationType
              }),
              occurredAt: event.occurredAt
            }))),
        createImportantDayCreatedLogHandler(this.#logger, this.#clock),
        createImportantDayCreatedDiagnosticHandler((event) =>
          this.#transactionExecutor.execute(event.correlationId, (transaction) =>
            this.#repositories.diagnosticRepository.insertIfAbsent({
              transaction: transaction.transaction,
              actor: systemActor,
              correlationId: event.correlationId,
              occurredAt: transaction.occurredAt
            }, {
              id: `event-handler:${event.eventId}:important-day-created-diagnostic-v1`,
              severity: 'info',
              code: 'timeline.important_day.created',
              message: `${event.payload.title} önemli gün olarak işlendi.`,
              details: JSON.stringify({
                eventId: event.eventId,
                timelineEventId: event.payload.eventId,
                familyId: event.payload.familyId,
                startAt: event.payload.startAt,
                participantCount: event.payload.participantCount,
                recurrence: event.payload.recurrence,
                aiProcessingAllowed: event.payload.aiProcessingAllowed
              }),
              occurredAt: event.occurredAt
            })))
      ]
    });
    const auditBackfillCorrelationId = asCorrelationId(`audit-backfill-${randomUUID()}`);
    const auditBackfillResult = this.#transactionExecutor.execute(auditBackfillCorrelationId, (transaction) =>
      this.#repositories.auditRepository.backfillMissingChain({
        transaction: transaction.transaction,
        actor: { userId: asUserId('system'), roles: ['system_operator'] },
        correlationId: auditBackfillCorrelationId,
        occurredAt: transaction.occurredAt
      })
    );
    if (!auditBackfillResult.ok) throw new Error(`[${auditBackfillResult.error.code}] ${auditBackfillResult.error.message}`);
    const auditProtectionCorrelationId = asCorrelationId(`audit-storage-protection-${randomUUID()}`);
    const auditProtectionResult = this.#installAuditStorageProtectionUseCase.execute(auditProtectionCorrelationId);
    if (!auditProtectionResult.ok) throw new Error(`[${auditProtectionResult.error.code}] ${auditProtectionResult.error.message}`);
    const ensureAdminCorrelationId = asCorrelationId(`ensure-family-admin-${randomUUID()}`);
    const ensureAdminResult = this.#transactionExecutor.execute(ensureAdminCorrelationId, (transaction) =>
      this.#repositories.accountRepository.ensureFamilyAdminExists({
        transaction: transaction.transaction,
        actor: { userId: asUserId('system'), roles: ['system_operator'] },
        correlationId: ensureAdminCorrelationId,
        occurredAt: transaction.occurredAt
      })
    );
    if (!ensureAdminResult.ok) throw new Error(`[${ensureAdminResult.error.code}] ${ensureAdminResult.error.message}`);
    // Build 208 Constitution V3: production startup is intentionally empty; user data is created only through explicit setup/import flows.
  }

  public close(): void { this.#databaseRuntime.close(); }
  public isAuthenticated(): boolean { try { this.#requireAuth({ touch: false }); return true; } catch { return false; } }


  public async dispatchPendingEvents(limit = 50): Promise<EventDispatchBatchSummary> {
    const correlationId = this.#correlation?.current()?.correlationId
      ?? asCorrelationId(`outbox-${randomUUID()}`);
    const result = await this.#eventDispatcher.dispatchBatch({ correlationId, limit });
    if (!result.ok) {
      this.#logger?.error({
        timestamp: this.#clock.now(),
        service: 'desktop-main',
        process: 'event-dispatcher',
        event: 'event_dispatch.batch.failed',
        correlationId,
        outcome: 'failure',
        errorCode: result.error.code
      });
      throw new Error(`[${result.error.code}] ${result.error.message}`);
    }
    this.#logger?.info({
      timestamp: this.#clock.now(),
      service: 'desktop-main',
      process: 'event-dispatcher',
      event: 'event_dispatch.batch.completed',
      correlationId,
      outcome: 'success',
      metadata: {
        checkedAt: result.value.checkedAt,
        claimed: result.value.claimed,
        published: result.value.published,
        retried: result.value.retried,
        failed: result.value.failed,
        successfulHandlers: result.value.successfulHandlers,
        skippedHandlers: result.value.skippedHandlers
      }
    });
    return result.value;
  }

  #startTask(taskType:string,label:string,warningThresholdMs=30_000): string { const id=randomUUID(),startedAt=nowIso(); this.#runningTasks.set(id,{taskType,label,startedAt,warningThresholdMs}); const result=this.#startBackgroundTaskUseCase.execute(this.#taskApplicationContext('background-task-start'),{id,taskType,label,status:'running',startedAt,warningThresholdMs}); if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`); return id; }
  #finishTask(id:string,status:'success'|'failed'|'deferred',details?:string): void { const task=this.#runningTasks.get(id); const completedAt=nowIso(); const durationMs=task?Math.max(0,new Date(completedAt).getTime()-new Date(task.startedAt).getTime()):0; const result=this.#finishBackgroundTaskUseCase.execute(this.#taskApplicationContext('background-task-finish'),id,status,completedAt,durationMs,details); if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`); if(task&&durationMs>=task.warningThresholdMs)this.recordDiagnostic('warning','task.long_running',`${task.label} uzun sürdü.`,`${durationMs} ms`); this.#runningTasks.delete(id); }
  public listBackgroundTasks(limit=100): BackgroundTaskView[] { this.#requireAuth(); const result=this.#listBackgroundTasksUseCase.execute(this.#taskApplicationContext('background-task-list'),limit); if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`); return [...result.value]; }
  public enqueueTask(input:EnqueueTaskInput): QueuedTaskView { this.#requireAuth(); const id=randomUUID(),createdAt=nowIso(); const result=this.#enqueueTaskUseCase.execute(this.#taskApplicationContext('task-enqueue'),input,id,createdAt); if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`); this.#writeAudit('task.enqueued','task_queue',id,createdAt); return result.value; }
  public listQueuedTasks(limit=100): QueuedTaskView[] { this.#requireAuth(); const result=this.#listQueuedTasksUseCase.execute(this.#taskApplicationContext('task-list'),limit); if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`); return [...result.value]; }
  public processTaskQueue(): TaskQueueCycleResultView { this.#requireAuth(); const adaptive=this.getAdaptiveResourceState(); const checkedAt=nowIso(); const capacity=adaptive.maxConcurrentJobs; const listed=this.#listRunnableQueuedTasksUseCase.execute(this.#taskApplicationContext('task-runnable-list'),capacity); if(!listed.ok)throw new Error(`[${listed.error.code}] ${listed.error.message}`); const rows=[...listed.value]; if(adaptive.deferBackgroundJobs){for(const r of rows){const deferred=this.#deferQueuedTaskUseCase.execute(this.#taskApplicationContext('task-defer'),r.id,adaptive.reason);if(!deferred.ok)throw new Error(`[${deferred.error.code}] ${deferred.error.message}`);} return {checkedAt,capacity,processed:0,completed:0,failed:0,deferred:rows.length,taskIds:rows.map(r=>r.id)};} let completed=0,failed=0; for(const r of rows){const id=r.id,attempts=r.attempts+1; const started=this.#startQueuedTaskUseCase.execute(this.#taskApplicationContext('task-start'),id,nowIso(),attempts);if(!started.ok)throw new Error(`[${started.error.code}] ${started.error.message}`); try { const type=r.taskType; if(type==='maintenance') this.runAutomaticMaintenance(); else if(type.startsWith('maintenance.')) { const op=type.slice('maintenance.'.length) as MaintenanceResultView['operation']; if(!['integrity_check','wal_checkpoint','analyze','vacuum'].includes(op)) throw new Error(`Bilinmeyen bakım işlemi: ${op}`); const result=this.runMaintenance(op,'queue'); if(!result.success) throw new Error(result.message); } else if(type==='performance.sample') this.capturePerformanceSample(); else if(type==='backup.due') this.runDueBackupTargets(); else if(type==='backup.propagation') this.propagatePurgedDataToManagedBackups(); else throw new Error(`Bilinmeyen görev türü: ${type}`); const done=this.#completeQueuedTaskUseCase.execute(this.#taskApplicationContext('task-complete'),id,nowIso());if(!done.ok)throw new Error(`[${done.error.code}] ${done.error.message}`); completed++; } catch(error){const message=error instanceof Error?error.message:String(error); const status=attempts<r.maxAttempts?'queued':'failed'; const saved=this.#failOrRetryQueuedTaskUseCase.execute(this.#taskApplicationContext('task-fail-or-retry'),id,status,status==='failed'?nowIso():undefined,message);if(!saved.ok)throw new Error(`[${saved.error.code}] ${saved.error.message}`); if(status==='failed')failed++;}} return {checkedAt,capacity,processed:rows.length,completed,failed,deferred:0,taskIds:rows.map(r=>r.id)}; }
  public getMaintenancePolicy(): MaintenancePolicyView { const r=this.#getMaintenancePolicyUseCase.execute(this.#operationalHealthApplicationContext('maintenance-policy-get')); if(!r.ok)throw new Error(`[${r.error.code}] ${r.error.message}`); return r.value; }
  public upsertMaintenancePolicy(input:UpsertMaintenancePolicyInput): MaintenancePolicyView { const current=this.getMaintenancePolicy(); const enabled=input.enabled??current.enabled,interval=Math.max(1,Math.min(input.intervalHours??current.intervalHours,720)),diag=Math.max(1,Math.min(input.keepDiagnosticDays??current.keepDiagnosticDays,3650)),perf=Math.max(1,Math.min(input.keepPerformanceDays??current.keepPerformanceDays,3650)); const next=enabled?new Date(Date.now()+interval*3600_000).toISOString():undefined; const policy:MaintenancePolicyView={...current,enabled,intervalHours:interval,keepDiagnosticDays:diag,keepPerformanceDays:perf,...(next?{nextRunAt:next}:{} )}; const r=this.#upsertMaintenancePolicyUseCase.execute(this.#operationalHealthApplicationContext('maintenance-policy-upsert'),policy); if(!r.ok)throw new Error(`[${r.error.code}] ${r.error.message}`); return r.value; }
  public runAutomaticMaintenance(): MaintenanceCycleResultView { this.#requireAuth(); const startedAt=nowIso(),policy=this.getMaintenancePolicy(); const diagnosticCutoff=new Date(Date.now()-policy.keepDiagnosticDays*86400_000).toISOString(),performanceCutoff=new Date(Date.now()-policy.keepPerformanceDays*86400_000).toISOString(),completedAt=nowIso(),nextRunAt=new Date(Date.now()+policy.intervalHours*3600_000).toISOString(); const cleanup=this.#cleanupOperationalHealthUseCase.execute(this.#operationalHealthApplicationContext('maintenance-cleanup'),diagnosticCutoff,performanceCutoff,completedAt,nextRunAt); if(!cleanup.ok)throw new Error(`[${cleanup.error.code}] ${cleanup.error.message}`); const operations=[this.runMaintenance('wal_checkpoint'),this.runMaintenance('analyze')]; return {startedAt,completedAt:nowIso(),deletedDiagnostics:cleanup.value.deletedDiagnostics,deletedPerformanceSamples:cleanup.value.deletedPerformanceSamples,operations,success:operations.every(x=>x.success)}; }
  public evaluateHealthNotifications(): HealthNotificationView[] { this.#requireAuth(); const health=this.getSystemHealth(),adaptive=this.getAdaptiveResourceState(),now=nowIso(); const counts=this.#getOperationalHealthCountsUseCase.execute(this.#operationalHealthApplicationContext('health-notification-counts'),new Date(Date.now()-86400_000).toISOString()); if(!counts.ok)throw new Error(`[${counts.error.code}] ${counts.error.message}`); const candidates:Array<Omit<HealthNotificationView,'id'|'createdAt'|'generatedTaskId'>>=[]; if(health.status==='critical')candidates.push({severity:'critical',code:'system.critical',title:'Kritik sistem durumu',message:health.warnings.join(' ')}); if(adaptive.memoryUsagePercent>=85)candidates.push({severity:'warning',code:'memory.pressure',title:'Bellek baskısı',message:`Bellek kullanımı %${adaptive.memoryUsagePercent}.`}); if(adaptive.cpuLoadPercent>=85)candidates.push({severity:'warning',code:'cpu.pressure',title:'Yüksek CPU kullanımı',message:`CPU yükü %${adaptive.cpuLoadPercent}.`}); if(counts.value.failedBackups)candidates.push({severity:'warning',code:'backup.failed',title:'Başarısız yedekleme',message:`Son 24 saatte ${counts.value.failedBackups} yedekleme başarısız oldu.`}); for(const c of candidates){const context=this.#operationalHealthApplicationContext('health-notification-evaluate');let found=this.#findActiveHealthNotificationUseCase.execute(context,c.code);if(!found.ok)throw new Error(`[${found.error.code}] ${found.error.message}`);let row=found.value;if(!row){const created:HealthNotificationView={id:randomUUID(),...c,createdAt:now};const saved=this.#recordHealthNotificationUseCase.execute(context,created);if(!saved.ok)throw new Error(`[${saved.error.code}] ${saved.error.message}`);row=saved.value;} if(!row.generatedTaskId&&c.severity!=='info'){const task=this.enqueueTask({taskType:c.code==='backup.failed'?'backup.due':'performance.sample',label:`Sağlık uyarısı: ${c.title}`,priority:c.severity==='critical'?'critical':'high',maxAttempts:2,payload:JSON.stringify({notificationId:row.id,code:c.code})});const attached=this.#attachHealthNotificationTaskUseCase.execute(context,row.id,task.id);if(!attached.ok)throw new Error(`[${attached.error.code}] ${attached.error.message}`);}} return this.listHealthNotifications(); }
  public listHealthNotifications(limit=100): HealthNotificationView[] { const r=this.#listHealthNotificationsUseCase.execute(this.#operationalHealthApplicationContext('health-notification-list'),limit); if(!r.ok)throw new Error(`[${r.error.code}] ${r.error.message}`); return [...r.value]; }
  public acknowledgeHealthNotification(id:string): HealthNotificationView[] { const r=this.#acknowledgeHealthNotificationUseCase.execute(this.#operationalHealthApplicationContext('health-notification-ack'),id,nowIso()); if(!r.ok)throw new Error(`[${r.error.code}] ${r.error.message}`); return this.listHealthNotifications(); }
  public searchDiagnostics(input:DiagnosticFilterInput={}): DiagnosticEntryView[] { this.#requireAuth(); const all=this.listDiagnostics(input.limit??500); return all.filter(r=>(!input.query?.trim()||[r.message,r.details??'',r.code].some(v=>v.toLocaleLowerCase('tr-TR').includes(input.query!.trim().toLocaleLowerCase('tr-TR'))))&&(!input.severity||r.severity===input.severity)&&(!input.code?.trim()||r.code.toLocaleLowerCase('tr-TR').includes(input.code.trim().toLocaleLowerCase('tr-TR')))&&(!input.from||r.occurredAt>=input.from)&&(!input.to||r.occurredAt<=input.to)).slice(0,Math.max(1,Math.min(input.limit??100,500))); }
  public getSystemHealthScore(): SystemHealthScoreView { this.#requireAuth(); const system=this.getSystemHealth(); const deductions:SystemHealthScoreView['deductions']=[]; const add=(code:string,points:number,message:string)=>deductions.push({code,points,message}); if(!system.integrityOk)add('database.integrity',45,'Veritabanı bütünlük kontrolü başarısız.'); if(system.status==='critical')add('system.critical',25,'Sistem kritik durumda.'); else if(system.status==='warning')add('system.warning',10,'Sistem uyarı durumunda.'); if(system.memoryUsagePercent>=90)add('memory.critical',20,'Bellek kullanımı kritik seviyede.'); else if(system.memoryUsagePercent>=80)add('memory.warning',10,'Bellek kullanımı yüksek.'); const counts=this.#getOperationalHealthCountsUseCase.execute(this.#operationalHealthApplicationContext('health-score-counts'),new Date(Date.now()-86400_000).toISOString()); if(!counts.ok)throw new Error(`[${counts.error.code}] ${counts.error.message}`); const failedBackups24h=counts.value.failedBackups,longRunningTasks24h=counts.value.matchingDiagnostics,activeNotifications=counts.value.activeNotifications; if(failedBackups24h)add('backup.failed',Math.min(20,failedBackups24h*5),`${failedBackups24h} yedekleme başarısız.`); if(longRunningTasks24h)add('task.long_running',Math.min(10,longRunningTasks24h*2),`${longRunningTasks24h} uzun görev algılandı.`); if(activeNotifications)add('notifications.active',Math.min(15,activeNotifications*3),`${activeNotifications} aktif sağlık bildirimi var.`); const score=Math.max(0,100-deductions.reduce((a,b)=>a+b.points,0)); return {generatedAt:nowIso(),score,grade:score>=90?'excellent':score>=75?'good':score>=50?'attention':'critical',deductions,systemStatus:system.status,activeNotifications,failedBackups24h,longRunningTasks24h}; }

  public recordExportArtifact(kind:ExportArtifactView['kind'],format:ExportArtifactView['format'],filePath:string,sha256:string,sizeBytes:number,recordCount?:number): ExportArtifactView { this.#requireAuth(); const row:ExportArtifactView={id:randomUUID(),kind,format,filePath,sha256,sizeBytes,...(recordCount===undefined?{}:{recordCount}),createdAt:nowIso()}; const result=this.#recordExportArtifactUseCase.execute(this.#operationalHealthApplicationContext('export-artifact-record'),row); if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`); return result.value; }
  public listExportArtifacts(limit=100): ExportArtifactView[] { this.#requireAuth(); const result=this.#listExportArtifactsUseCase.execute(this.#operationalHealthApplicationContext('export-artifact-list'),limit); if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`); return [...result.value]; }
  public verifyExportArtifact(id:string): ExportArtifactVerificationView { this.#requireAuth(); const context=this.#operationalHealthApplicationContext('export-artifact-verify'); const result=this.#findExportArtifactUseCase.execute(context,id); if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`); const row=result.value; if(!row)throw new Error('Dışa aktarım kaydı bulunamadı.'); const verification=this.#verifyOperationalArtifactUseCase.execute(context.correlationId,{filePath:row.filePath,expectedSha256:row.sha256}); if(!verification.ok)throw new Error(`[${verification.error.code}] ${verification.error.message}`); return {id,...verification.value,checkedAt:nowIso()}; }
  public getDiagnosticReport(): DiagnosticReportView {
    this.#requireAuth();
    const backupTargets=this.listBackupTargets();
    const recentBackupRuns=this.listBackupRuns(50);
    const healthNotifications=this.listHealthNotifications(100);
    const queue=this.listQueuedTasks(100);
    return {
      generatedAt:nowIso(),
      healthScore:this.getSystemHealthScore(),
      system:this.getSystemHealth(),
      adaptive:this.getAdaptiveResourceState(),
      performance:this.getPerformanceTrend(24),
      diagnostics:this.searchDiagnostics({limit:100}),
      backupResults:{
        targetCount:backupTargets.length,
        recentRunCount:recentBackupRuns.length,
        successfulRunCount:recentBackupRuns.filter((run)=>run.status==='success').length,
        failedRunCount:recentBackupRuns.filter((run)=>run.status==='failed').length
      },
      notificationResults:{activeCount:healthNotifications.filter((entry)=>entry.acknowledgedAt===undefined).length},
      queueResults:{
        totalCount:queue.length,
        queuedCount:queue.filter((entry)=>entry.status==='queued').length,
        runningCount:queue.filter((entry)=>entry.status==='running').length,
        completedCount:queue.filter((entry)=>entry.status==='completed').length,
        failedCount:queue.filter((entry)=>entry.status==='failed').length,
        deferredCount:queue.filter((entry)=>entry.status==='deferred').length
      }
    };
  }
  public exportDiagnosticReport(destinationPath:string): string { this.#requireAuth(); const context=this.#operationalHealthApplicationContext('diagnostic-report-export'); const report=this.getDiagnosticReport(); const written=this.#writeOperationalTextArtifactUseCase.execute(context.correlationId,{destinationPath,content:JSON.stringify(report,null,2)}); if(!written.ok)throw new Error(`[${written.error.code}] ${written.error.message}`); const id=randomUUID(); const row:DiagnosticReportHistoryView={id,generatedAt:report.generatedAt,healthScore:report.healthScore.score,status:report.system.status,filePath:written.value.filePath,sha256:written.value.sha256,sizeBytes:written.value.sizeBytes}; const saved=this.#recordDiagnosticReportUseCase.execute(context,row); if(!saved.ok)throw new Error(`[${saved.error.code}] ${saved.error.message}`); this.#writeAudit('diagnostic.exported','diagnostic_report',id,nowIso()); this.recordExportArtifact('diagnostic_report','json',written.value.filePath,written.value.sha256,written.value.sizeBytes); return written.value.filePath; }
  public listDiagnosticReports(limit=100): DiagnosticReportHistoryView[] { this.#requireAuth(); const result=this.#listDiagnosticReportsUseCase.execute(this.#operationalHealthApplicationContext('diagnostic-report-list'),limit); if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`); return [...result.value]; }
  public captureSystemHealthScore(): SystemHealthHistoryView { this.#requireAuth(); const score=this.getSystemHealthScore(),entry:SystemHealthHistoryView={id:randomUUID(),score:score.score,grade:score.grade,systemStatus:score.systemStatus,deductions:score.deductions.length,capturedAt:nowIso()}; const r=this.#recordSystemHealthHistoryUseCase.execute(this.#operationalHealthApplicationContext('health-score-record'),entry); if(!r.ok)throw new Error(`[${r.error.code}] ${r.error.message}`); return r.value; }
  public listSystemHealthHistory(limit=500): SystemHealthHistoryView[] { const r=this.#listSystemHealthHistoryUseCase.execute(this.#operationalHealthApplicationContext('health-score-list'),limit); if(!r.ok)throw new Error(`[${r.error.code}] ${r.error.message}`); return [...r.value]; }
  public getSystemHealthTrend(days=30): SystemHealthTrendView { const windowDays=Math.max(1,Math.min(days,3650)),cutoff=new Date(Date.now()-windowDays*86400_000).toISOString(); const result=this.#listSystemHealthHistorySinceUseCase.execute(this.#operationalHealthApplicationContext('health-trend'),cutoff); if(!result.ok)throw new Error(result.error.message); const rows=[...result.value]; if(!rows.length){const current=this.captureSystemHealthScore();rows.push({id:randomUUID(),score:current.score,grade:current.grade,systemStatus:current.systemStatus,deductions:current.deductions,capturedAt:current.capturedAt});} const scores=rows.map(r=>Number(r.score)),currentScore=scores.at(-1)??0,change=currentScore-(scores[0]??currentScore); return {generatedAt:nowIso(),windowDays,sampleCount:scores.length,currentScore,averageScore:Math.round(scores.reduce((a,b)=>a+b,0)/scores.length),minimumScore:Math.min(...scores),maximumScore:Math.max(...scores),change,direction:change>=5?'improving':change<=-5?'degrading':'stable'}; }
  public archiveDiagnostics(before:string,destinationPath:string): DiagnosticArchiveView { this.#requireAuth(); const context=this.#operationalHealthApplicationContext('diagnostic-archive-create'); const rows=this.searchDiagnostics({to:before,limit:500}); if(!rows.length)throw new Error('Arşivlenecek tanılama kaydı bulunamadı.'); const written=this.#writeOperationalGzipArtifactUseCase.execute(context.correlationId,{destinationPath,content:JSON.stringify(rows,null,2)}); if(!written.ok)throw new Error(`[${written.error.code}] ${written.error.message}`); const id=randomUUID(),createdAt=nowIso(),from=rows.at(-1)!.occurredAt,to=rows[0]!.occurredAt; const archive:DiagnosticArchiveView={id,createdAt,from,to,entryCount:rows.length,filePath:written.value.filePath,sha256:written.value.sha256,sizeBytes:written.value.sizeBytes}; const saved=this.#recordDiagnosticArchiveUseCase.execute(context,archive);if(!saved.ok)throw new Error(`[${saved.error.code}] ${saved.error.message}`);const deleted=this.#deleteDiagnosticsThroughUseCase.execute(context,before);if(!deleted.ok)throw new Error(`[${deleted.error.code}] ${deleted.error.message}`);return archive; }
  public listDiagnosticArchives(limit=100): DiagnosticArchiveView[] { this.#requireAuth(); const r=this.#listDiagnosticArchivesUseCase.execute(this.#operationalHealthApplicationContext('diagnostic-archive-list'),limit);if(!r.ok)throw new Error(`[${r.error.code}] ${r.error.message}`);return [...r.value]; }
  public verifyDiagnosticReport(id:string): DiagnosticReportVerificationView { this.#requireAuth(); const context=this.#operationalHealthApplicationContext('diagnostic-report-verify'); const found=this.#findDiagnosticReportUseCase.execute(context,id);if(!found.ok)throw new Error(`[${found.error.code}] ${found.error.message}`);const row=found.value;if(!row)throw new Error('Tanılama raporu bulunamadı.');const filePath=row.filePath??''; if(!filePath)return {id,exists:false,valid:false,expectedSha256:row.sha256,checkedAt:nowIso()}; const verification=this.#verifyOperationalArtifactUseCase.execute(context.correlationId,{filePath,expectedSha256:row.sha256});if(!verification.ok)throw new Error(`[${verification.error.code}] ${verification.error.message}`);return {id,...verification.value,checkedAt:nowIso()}; }
  public readDiagnosticReport(id:string): DiagnosticReportContentView { this.#requireAuth(); const context=this.#operationalHealthApplicationContext('diagnostic-report-read'); const found=this.#findDiagnosticReportUseCase.execute(context,id);if(!found.ok)throw new Error(`[${found.error.code}] ${found.error.message}`);const row=found.value;if(!row)throw new Error('Tanılama raporu bulunamadı.');const filePath=row.filePath??''; if(!filePath)return {id,generatedAt:row.generatedAt,valid:false,content:''}; const verification=this.#verifyOperationalArtifactUseCase.execute(context.correlationId,{filePath,expectedSha256:row.sha256});if(!verification.ok)throw new Error(`[${verification.error.code}] ${verification.error.message}`);let content='';if(verification.value.exists){const read=this.#readOperationalTextArtifactUseCase.execute(context.correlationId,{filePath});if(!read.ok)throw new Error(`[${read.error.code}] ${read.error.message}`);content=read.value;}return {id,generatedAt:row.generatedAt,filePath,valid:verification.value.valid,content}; }
  public compareDiagnosticReports(leftId:string,rightId:string): DiagnosticReportComparisonView { this.#requireAuth(); const left=this.readDiagnosticReport(leftId),right=this.readDiagnosticReport(rightId); if(!left.valid||!right.valid)throw new Error('Karşılaştırma için iki raporun da bütünlüğü doğrulanmalıdır.'); const l=JSON.parse(left.content) as Record<string,unknown>,r=JSON.parse(right.content) as Record<string,unknown>; const lk=new Set(Object.keys(l)),rk=new Set(Object.keys(r)); const added=[...rk].filter(k=>!lk.has(k)),removed=[...lk].filter(k=>!rk.has(k)),changed=[...lk].filter(k=>rk.has(k)&&JSON.stringify(l[k])!==JSON.stringify(r[k])); const ls=Number((l.healthScore as {score?:number}|undefined)?.score??0),rs=Number((r.healthScore as {score?:number}|undefined)?.score??0),lst=String((l.health as {status?:string}|undefined)?.status??''),rst=String((r.health as {status?:string}|undefined)?.status??''); const summarize=(v:unknown)=>{const text=JSON.stringify(v);return text.length>240?`${text.slice(0,237)}…`:text}; const sectionChanges=[...added.map(key=>({key,kind:'added' as const,rightSummary:summarize(r[key])})),...removed.map(key=>({key,kind:'removed' as const,leftSummary:summarize(l[key])})),...changed.map(key=>({key,kind:'changed' as const,leftSummary:summarize(l[key]),rightSummary:summarize(r[key])}))]; const fieldChanges:Array<{path:string;kind:'added'|'removed'|'changed';leftValue?:string;rightValue?:string}>=[]; const walk=(a:unknown,b:unknown,path:string)=>{if(fieldChanges.length>=250)return; if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){const keys=new Set([...Object.keys(a as Record<string,unknown>),...Object.keys(b as Record<string,unknown>)]); for(const key of keys)walk((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key],path?`${path}.${key}`:key);return;} if(JSON.stringify(a)===JSON.stringify(b))return; const av=a===undefined?undefined:summarize(a),bv=b===undefined?undefined:summarize(b); fieldChanges.push({path,kind:a===undefined?'added':b===undefined?'removed':'changed',...(av===undefined?{}:{leftValue:av}),...(bv===undefined?{}:{rightValue:bv})});}; walk(l,r,''); return {leftId,rightId,leftGeneratedAt:left.generatedAt,rightGeneratedAt:right.generatedAt,leftHealthScore:ls,rightHealthScore:rs,healthScoreChange:rs-ls,statusChanged:lst!==rst,addedKeys:added,removedKeys:removed,changedKeys:changed,sectionChanges,fieldChanges}; }
  public readDiagnosticArchive(id:string): DiagnosticArchiveContentView { this.#requireAuth(); const context=this.#operationalHealthApplicationContext('diagnostic-archive-read'); const found=this.#findDiagnosticArchiveUseCase.execute(context,id);if(!found.ok)throw new Error(`[${found.error.code}] ${found.error.message}`);const row=found.value;if(!row)throw new Error('Tanılama arşivi bulunamadı.');const verification=this.#verifyOperationalArtifactUseCase.execute(context.correlationId,{filePath:row.filePath,expectedSha256:row.sha256});if(!verification.ok)throw new Error(`[${verification.error.code}] ${verification.error.message}`);if(!verification.value.valid)throw new Error('Tanılama arşivi bütünlüğü doğrulanamadı.');const read=this.#readOperationalGzipArtifactUseCase.execute(context.correlationId,{filePath:row.filePath});if(!read.ok)throw new Error(`[${read.error.code}] ${read.error.message}`);const parsed=JSON.parse(read.value) as {entries?:DiagnosticEntryView[]}|DiagnosticEntryView[];const entries=Array.isArray(parsed)?parsed:(parsed.entries??[]);return {id,valid:true,entryCount:entries.length,entries}; }
  public searchDiagnosticArchive(id:string,input:DiagnosticArchiveSearchInput={}): DiagnosticArchiveContentView { const content=this.readDiagnosticArchive(id); const q=(input.query??'').trim().toLocaleLowerCase('tr-TR'); const code=(input.code??'').trim().toLocaleLowerCase('tr-TR'); const limit=Math.max(1,Math.min(input.limit??200,2000)); const entries=content.entries.filter(e=>(!input.severity||e.severity===input.severity)&&(!code||e.code.toLocaleLowerCase('tr-TR').includes(code))&&(!q||`${e.code} ${e.message} ${e.details??''}`.toLocaleLowerCase('tr-TR').includes(q))).slice(0,limit); return {...content,entryCount:entries.length,entries}; }
  public exportDiagnosticArchiveEntries(id:string,input:DiagnosticArchiveSearchInput,format:'json'|'csv',destinationPath:string): DiagnosticArchiveExportView { this.#requireAuth(); const context=this.#operationalHealthApplicationContext('diagnostic-archive-export'); const content=this.searchDiagnosticArchive(id,input); const esc=(v:string)=>`"${v.replaceAll('"','""')}"`; const body=format==='csv'?[['severity','code','message','details','occurredAt'].join(','),...content.entries.map(e=>[e.severity,e.code,e.message,e.details??'',e.occurredAt].map(esc).join(','))].join('\n'):JSON.stringify({archiveId:id,entries:content.entries},null,2); const written=this.#writeOperationalTextArtifactUseCase.execute(context.correlationId,{destinationPath,content:body});if(!written.ok)throw new Error(`[${written.error.code}] ${written.error.message}`);this.recordExportArtifact('diagnostic_archive',format,written.value.filePath,written.value.sha256,written.value.sizeBytes,content.entries.length);return {archiveId:id,filePath:written.value.filePath,format,entryCount:content.entries.length,sha256:written.value.sha256,sizeBytes:written.value.sizeBytes,exportedAt:nowIso()}; }
  public listMaintenanceHistory(limit=100): MaintenanceHistoryView[] { const result=this.#listMaintenanceHistoryUseCase.execute(this.#operationalHealthApplicationContext('maintenance-history-list'),limit);if(!result.ok)throw new Error(result.error.message);return [...result.value]; }

  public searchMaintenanceHistory(input:MaintenanceHistoryFilterInput={}): MaintenanceHistoryView[] { const result=this.#searchMaintenanceHistoryUseCase.execute(this.#operationalHealthApplicationContext('maintenance-history-search'),input);if(!result.ok)throw new Error(result.error.message);return [...result.value]; }
  public exportMaintenanceHistory(input:MaintenanceHistoryFilterInput,format:'json'|'csv',destinationPath:string): MaintenanceHistoryExportView { this.#requireAuth(); const context=this.#operationalHealthApplicationContext('maintenance-history-export'); const rows=this.searchMaintenanceHistory({...input,limit:1000}); const content=format==='json'?JSON.stringify(rows,null,2):['id,operation,success,source,startedAt,completedAt,durationMs,message',...rows.map(r=>[r.id,r.operation,r.success,r.source,r.startedAt,r.completedAt,r.durationMs,JSON.stringify(r.message)].join(','))].join('\n'); const written=this.#writeOperationalTextArtifactUseCase.execute(context.correlationId,{destinationPath,content});if(!written.ok)throw new Error(`[${written.error.code}] ${written.error.message}`);this.recordExportArtifact('maintenance_history',format,written.value.filePath,written.value.sha256,written.value.sizeBytes,rows.length);return {filePath:written.value.filePath,format,recordCount:rows.length,sizeBytes:written.value.sizeBytes,sha256:written.value.sha256}; }
  public searchAllDiagnosticArchives(input:DiagnosticArchiveSearchInput={}): UnifiedDiagnosticArchiveSearchView { this.#requireAuth(); const archives=this.listDiagnosticArchives(500); const matches:UnifiedDiagnosticArchiveSearchView['matches']=[]; for(const archive of archives){ try { const content=this.searchDiagnosticArchive(archive.id,{...input,limit:Math.min(input.limit??100,500)}); for(const entry of content.entries) matches.push({archiveId:archive.id,archiveCreatedAt:archive.createdAt,entry}); } catch { /* bozuk veya kayıp arşiv birleşik aramayı durdurmaz */ } } const limit=Math.max(1,Math.min(input.limit??250,1000)); matches.sort((a,b)=>b.entry.occurredAt.localeCompare(a.entry.occurredAt)); return {generatedAt:nowIso(),archiveCount:archives.length,totalMatches:matches.length,matches:matches.slice(0,limit)}; }


  public verifyDiagnosticArchive(id:string): DiagnosticArchiveVerificationView { this.#requireAuth(); const context=this.#operationalHealthApplicationContext('diagnostic-archive-verify'); const found=this.#findDiagnosticArchiveUseCase.execute(context,id);if(!found.ok)throw new Error(`[${found.error.code}] ${found.error.message}`);const row=found.value;if(!row)throw new Error('Tanılama arşivi bulunamadı.');const verification=this.#verifyOperationalArtifactUseCase.execute(context.correlationId,{filePath:row.filePath,expectedSha256:row.sha256});if(!verification.ok)throw new Error(`[${verification.error.code}] ${verification.error.message}`);return {id,...verification.value,checkedAt:nowIso()}; }
  public getPerformanceAnomalies(hours=24): PerformanceAnomalyView[] { this.#requireAuth(); const trend=this.getPerformanceTrend(hours),detectedAt=nowIso(),items:PerformanceAnomalyView[]=[]; if(trend.peakCpuPercent>=90)items.push({metric:'cpu',severity:'critical',value:trend.peakCpuPercent,threshold:90,message:'CPU kullanımı kritik tepe değerine ulaştı.',detectedAt});else if(trend.peakCpuPercent>=75)items.push({metric:'cpu',severity:'warning',value:trend.peakCpuPercent,threshold:75,message:'CPU kullanımı yüksek.',detectedAt}); if(trend.peakMemoryPercent>=90)items.push({metric:'memory',severity:'critical',value:trend.peakMemoryPercent,threshold:90,message:'Bellek kullanımı kritik tepe değerine ulaştı.',detectedAt});else if(trend.peakMemoryPercent>=80)items.push({metric:'memory',severity:'warning',value:trend.peakMemoryPercent,threshold:80,message:'Bellek kullanımı yüksek.',detectedAt}); if(trend.databaseGrowthBytes>536870912)items.push({metric:'database_growth',severity:'warning',value:trend.databaseGrowthBytes,threshold:536870912,message:'Veritabanı hızlı büyüyor.',detectedAt});if(trend.archiveGrowthBytes>1073741824)items.push({metric:'archive_growth',severity:'warning',value:trend.archiveGrowthBytes,threshold:1073741824,message:'Arşiv hızlı büyüyor.',detectedAt});return items; }
  public getMaintenanceRecommendations(): MaintenanceRecommendationView[] { this.#requireAuth(); const result=this.#getMaintenanceRecommendationsUseCase.execute(this.#operationalHealthApplicationContext('maintenance-recommendations'),{health:this.getSystemHealth(),trend:this.getPerformanceTrend(168)});if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return [...result.value]; }


  #requireAuth(options: { readonly touch?: boolean } = {}): string {
    const snapshot = this.#sessionManager.snapshot();
    if (!snapshot.active || !snapshot.accountId || snapshot.securityEpoch === undefined) throw new Error('Bu işlem için oturum açılmalıdır.');
    const accountId = asUserId(snapshot.accountId);
    const correlationId = this.#correlation?.current()?.correlationId ?? asCorrelationId(`session-epoch-${randomUUID()}`);
    const account = this.#transactionExecutor.execute(correlationId, (transaction) => this.#repositories.accountRepository.findById({
      transaction: transaction.transaction,
      actor: { userId: accountId, roles: ['system_operator'] },
      correlationId,
      occurredAt: transaction.occurredAt
    }, accountId));
    if (!account.ok) throw new Error(`[${account.error.code}] ${account.error.message}`);
    if (!account.value || !isSessionSecurityEpochCurrent(account.value.securityEpoch, snapshot.securityEpoch)) {
      this.#sessionManager.clear();
      throw new Error('[AUTH_SESSION_STALE] Oturum güvenlik dönemi değişti. Lütfen yeniden giriş yapın.');
    }
    this.#sessionManager.currentAccountId({ touch: options.touch ?? false });
    return accountId;
  }
  #operationalHealthApplicationContext(prefix:string): OperationalHealthApplicationContext { const actorId=asUserId(this.#requireAuth()); return {actorId,correlationId:this.#correlation?.current()?.correlationId??asCorrelationId(`${prefix}-${randomUUID()}`)}; }
  #backupApplicationContext(prefix:string): BackupApplicationContext { const actorId=asUserId(this.#requireAuth()); return {actorId,correlationId:this.#correlation?.current()?.correlationId??asCorrelationId(`${prefix}-${randomUUID()}`)}; }
  #taskApplicationContext(prefix:string): TaskApplicationContext { const actorId=asUserId(this.#requireAuth()); return {actorId,correlationId:this.#correlation?.current()?.correlationId??asCorrelationId(`${prefix}-${randomUUID()}`)}; }
  #authApplicationContext(prefix: string): AuthApplicationContext {
    return {
      correlationId: this.#correlation?.current()?.correlationId
        ?? asCorrelationId(`${prefix}-${randomUUID()}`)
    };
  }
  #authorizationApplicationContext(prefix: string): AuthorizationApplicationContext {
    return {
      correlationId: this.#correlation?.current()?.correlationId
        ?? asCorrelationId(`${prefix}-${randomUUID()}`)
    };
  }

  #currentDeviceContext(prefix: string, correlationId?: ReturnType<typeof asCorrelationId>): CurrentDeviceContext {
    const identity = this.#deviceIdentityProvider.snapshot();
    const challenge = `${prefix}:${correlationId ?? asCorrelationId(`${prefix}-${randomUUID()}`)}`;
    return {
      deviceId: identity.deviceId,
      displayName: `${platform()} ${arch()}`,
      fingerprint: identity.fingerprint,
      publicKeyPem: identity.publicKeyPem,
      proof: this.#deviceIdentityProvider.createProof(challenge)
    };
  }
  #familyApplicationContext(prefix: string): FamilyApplicationContext {
    const location = this.#locationApplicationContext(prefix);
    return {
      familyId: location.familyId,
      actor: {
        userId: location.actor.userId,
        roles: [location.actor.role],
        ...(location.actor.personId ? { personId: location.actor.personId } : {})
      },
      correlationId: location.correlationId
    };
  }
  #householdMembershipApplicationContext(prefix: string): HouseholdMembershipApplicationContext {
    const authenticatedUserId = this.#requireAuth();
    const account = this.#currentAccount();
    return {
      familyId: asFamilyId('family-main'),
      actor: { userId: asUserId(authenticatedUserId), roles: [account.role] },
      correlationId: this.#correlation?.current()?.correlationId
        ?? asCorrelationId(`${prefix}-${randomUUID()}`)
    };
  }
  #personLifecycleApplicationContext(prefix: string): PersonLifecycleApplicationContext {
    const authenticatedUserId = this.#requireAuth();
    const account = this.#currentAccount();
    return {
      familyId: asFamilyId('family-main'),
      actor: { userId: asUserId(authenticatedUserId), roles: [account.role] },
      correlationId: this.#correlation?.current()?.correlationId
        ?? asCorrelationId(`${prefix}-${randomUUID()}`)
    };
  }
  #dataRepairApplicationContext(prefix: string): DataRepairApplicationContext {
    const authenticatedUserId = this.#requireAuth();
    const account = this.#currentAccount();
    return {
      familyId: asFamilyId('family-main'),
      actor: { userId: asUserId(authenticatedUserId), roles: [account.role] },
      correlationId: this.#correlation?.current()?.correlationId
        ?? asCorrelationId(`${prefix}-${randomUUID()}`)
    };
  }
  #membershipApplicationContext(prefix: string): MembershipApplicationContext {
    return {
      correlationId: this.#correlation?.current()?.correlationId
        ?? asCorrelationId(`${prefix}-${randomUUID()}`)
    };
  }
  #locationApplicationContext(prefix: string): LocationApplicationContext {
    const authenticatedUserId = this.#requireAuth();
    const account = this.#currentAccount();
    if (!account.personId) throw new Error('Kayıtlı konum işlemleri için etkin kişi üyeliği gereklidir.');
    const correlationId = this.#correlation?.current()?.correlationId
      ?? asCorrelationId(`${prefix}-${randomUUID()}`);
    const person = this.#transactionExecutor.execute(correlationId, (transaction) =>
      this.#repositories.personRepository.findById({
        transaction: transaction.transaction,
        actor: { userId: asUserId(authenticatedUserId), roles: [account.role], personId: asPersonId(account.personId!) },
        correlationId,
        occurredAt: transaction.occurredAt
      }, asPersonId(account.personId!))
    );
    if (!person.ok) throw new Error(`[${person.error.code}] ${person.error.message}`);
    if (!person.value || person.value.status !== 'active') {
      throw new Error('Kayıtlı konum işlemleri için aynı ailede etkin kişi üyeliği gereklidir.');
    }
    return {
      familyId: person.value.familyId,
      actor: {
        userId: asUserId(authenticatedUserId),
        role: account.role,
        personId: asPersonId(account.personId)
      },
      correlationId
    };
  }
  #timelineApplicationContext(prefix: string): TimelineApplicationContext {
    const location = this.#locationApplicationContext(prefix);
    return {
      familyId: location.familyId,
      actor: {
        userId: location.actor.userId,
        roles: [location.actor.role],
        ...(location.actor.personId ? { personId: location.actor.personId } : {})
      },
      correlationId: location.correlationId
    };
  }
  #dashboardApplicationContext(prefix: string): DashboardApplicationContext {
    const location = this.#locationApplicationContext(prefix);
    return {
      familyId: location.familyId,
      actor: {
        userId: location.actor.userId,
        roles: [location.actor.role],
        ...(location.actor.personId ? { personId: location.actor.personId } : {})
      },
      correlationId: location.correlationId
    };
  }
  #healthApplicationContext(prefix: string): HealthApplicationContext {
    const authenticatedUserId = this.#requireAuth();
    const account = this.#currentAccount();
    return {
      familyId: asFamilyId('family-main'),
      actor: {
        userId: asUserId(authenticatedUserId),
        role: account.role,
        ...(account.personId ? { personId: asPersonId(account.personId) } : {})
      },
      correlationId: this.#correlation?.current()?.correlationId
        ?? asCorrelationId(`${prefix}-${randomUUID()}`)
    };
  }
  #lifeApplicationContext(prefix: string): LifeApplicationContext {
    const authenticatedUserId = this.#requireAuth();
    const account = this.#currentAccount();
    return {
      familyId: asFamilyId('family-main'),
      actor: {
        userId: asUserId(authenticatedUserId),
        role: account.role,
        ...(account.personId ? { personId: asPersonId(account.personId) } : {})
      },
      correlationId: this.#correlation?.current()?.correlationId
        ?? asCorrelationId(`${prefix}-${randomUUID()}`)
    };
  }
  #financeApplicationContext(prefix: string): FinanceApplicationContext {
    const authenticatedUserId = this.#requireAuth();
    const account = this.#currentAccount();
    return {
      familyId: asFamilyId('family-main'),
      actor: { userId: asUserId(authenticatedUserId), role: account.role, ...(account.personId ? { personId: asPersonId(account.personId) } : {}) },
      correlationId: this.#correlation?.current()?.correlationId ?? asCorrelationId(`${prefix}-${randomUUID()}`)
    };
  }
  #longTermPortfolioApplicationContext(prefix:string):LongTermPortfolioApplicationContext {
    return this.#financeApplicationContext(prefix);
  }
  #accessibilityPreferencesApplicationContext(prefix:string):AccessibilityPreferencesApplicationContext {
    return this.#financeApplicationContext(prefix);
  }
  #formDraftApplicationContext(prefix:string):FormDraftApplicationContext {
    return this.#financeApplicationContext(prefix);
  }
  #privacyOwnershipApplicationContext(prefix:string):PrivacyOwnershipApplicationContext {
    return this.#financeApplicationContext(prefix);
  }
  #identityAccessApplicationContext(prefix: string): IdentityAccessApplicationContext {
    const location = this.#locationApplicationContext(prefix);
    const session = this.#sessionManager.snapshot();
    if (!session.active || !session.accountId || session.securityEpoch === undefined
      || session.accountId !== location.actor.userId || !location.actor.personId) {
      throw new Error('[AUTH_SESSION_STALE] Kimlik erişim merkezi exact etkin hesap ve kişi oturumu gerektirir.');
    }
    const personId = location.actor.personId;
    const identity = this.#deviceIdentityProvider.snapshot();
    const trusted = this.#transactionExecutor.execute(location.correlationId, (transaction) =>
      this.#repositories.trustedDeviceRepository.findActive({
        transaction: transaction.transaction,
        actor: {
          userId: location.actor.userId,
          roles: [location.actor.role],
          personId
        },
        correlationId: location.correlationId,
        occurredAt: transaction.occurredAt
      }, location.actor.userId, identity.deviceId)
    );
    if (!trusted.ok) throw new Error(`[${trusted.error.code}] ${trusted.error.message}`);
    if (!trusted.value || trusted.value.revokedAt || trusted.value.accountId !== location.actor.userId
      || trusted.value.deviceId !== identity.deviceId || trusted.value.securityEpoch !== session.securityEpoch
      || trusted.value.fingerprint !== identity.fingerprint || trusted.value.publicKeyPem !== identity.publicKeyPem) {
      throw new Error('[AUTH_DEVICE_TRUST_STALE] Kimlik erişim merkezi exact güncel güvenilir cihaz ve security_epoch gerektirir.');
    }
    return {
      familyId: location.familyId,
      actor: {
        userId: location.actor.userId,
        role: location.actor.role,
        personId
      },
      currentDevice: {
        trustedDeviceId: trusted.value.id,
        deviceId: trusted.value.deviceId,
        securityEpoch: trusted.value.securityEpoch
      },
      correlationId: location.correlationId
    };
  }

  #requireIdentityAccessOperationToken(
    context: IdentityAccessApplicationContext,
    clientOperationId: string,
    operationKind: IdentityAccessOperationKind
  ): void {
    const identity = this.#deviceIdentityProvider.snapshot();
    verifyIdentityAccessOperationToken({
      clientOperationId,
      binding: {
        accountId: context.actor.userId,
        deviceId: context.currentDevice.deviceId,
        securityEpoch: context.currentDevice.securityEpoch,
        operationKind
      },
      now: this.#clock.now(),
      devicePublicKeyPem: identity.publicKeyPem
    });
  }

  #maintainIdentityAccessRetention(context: IdentityAccessApplicationContext): void {
    if (!context.actor.personId) throw new Error('[AUTH_SESSION_STALE] Identity retention requires an exact owner.');
    const personId = context.actor.personId;
    const key = Object.freeze({
      familyId: context.familyId,
      accountId: context.actor.userId,
      ownerPersonId: personId
    });
    const ownerRefSha256 = createHash('sha256').update(
      JSON.stringify([key.familyId, key.accountId, key.ownerPersonId]), 'utf8'
    ).digest('hex');
    const owned = this.#temporaryCredentialEnvelope.listOwnedEnvelopeReferences?.(ownerRefSha256) ?? [];
    const ownedReferenceValues = owned.map(({ encryptedEnvelopeReference }) => encryptedEnvelopeReference);
    if (!Array.isArray(owned) || owned.length > 2_048 || new Set(ownedReferenceValues).size !== owned.length
      || owned.some(({ encryptedEnvelopeReference, createdAt }) =>
        !/^temporary-credential-envelope:[0-9a-f]{64}$/u.test(encryptedEnvelopeReference)
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(createdAt)
        || new Date(createdAt).toISOString() !== createdAt)) {
      throw new Error('Temporary credential owned-envelope inventory is invalid or exceeds its absolute bound.');
    }
    if (owned.length > 0) {
      const referenced = this.#transactionExecutor.execute(context.correlationId, (transaction) =>
        this.#repositories.identityAccessCredentialRepository.listReferencedTemporaryCredentialEnvelopeReferences({
          transaction: transaction.transaction,
          actor: { userId: context.actor.userId, roles: [context.actor.role], personId },
          correlationId: context.correlationId,
          occurredAt: transaction.occurredAt
        }, key)
      );
      if (!referenced.ok) throw new Error(`[${referenced.error.code}] ${referenced.error.message}`);
      const retained = new Set(referenced.value);
      const orphanCutoff = Date.parse(this.#clock.now()) - 7 * 24 * 60 * 60 * 1_000;
      for (const envelope of owned) {
        if (Date.parse(envelope.createdAt) <= orphanCutoff && !retained.has(envelope.encryptedEnvelopeReference)) {
          this.#temporaryCredentialEnvelope.discardEncryptedEnvelope(envelope.encryptedEnvelopeReference, ownerRefSha256);
        }
      }
    }
    const listed = this.#transactionExecutor.execute(context.correlationId, (transaction) =>
      this.#repositories.identityAccessCredentialRepository.listTerminalTemporaryCredentialEnvelopeReferences({
        transaction: transaction.transaction,
        actor: { userId: context.actor.userId, roles: [context.actor.role], personId },
        correlationId: context.correlationId,
        occurredAt: transaction.occurredAt
      }, key)
    );
    if (!listed.ok) throw new Error(`[${listed.error.code}] ${listed.error.message}`);
    for (const reference of listed.value) this.#temporaryCredentialEnvelope.discardEncryptedEnvelope(reference, ownerRefSha256);
    const pruned = this.#transactionExecutor.execute(context.correlationId, (transaction) =>
      this.#repositories.identityAccessCredentialRepository.pruneTerminalCredentialMetadata({
        transaction: transaction.transaction,
        actor: { userId: context.actor.userId, roles: [context.actor.role], personId },
        correlationId: context.correlationId,
        occurredAt: transaction.occurredAt
      }, key, listed.value)
    );
    if (!pruned.ok) throw new Error(`[${pruned.error.code}] ${pruned.error.message}`);
  }
  #dataLifecycleApplicationContext(prefix:string): DataLifecycleApplicationContext {
    const authenticatedUserId=this.#requireAuth();
    const account=this.#currentAccount();
    return {familyId:asFamilyId('family-main'),actor:{userId:asUserId(authenticatedUserId),role:account.role,...(account.personId?{personId:asPersonId(account.personId)}:{})},correlationId:this.#correlation?.current()?.correlationId??asCorrelationId(`${prefix}-${randomUUID()}`)};
  }
  #backupPropagationApplicationContext(prefix:string):BackupPropagationApplicationContext {
    const authenticatedUserId=this.#requireAuth();
    const account=this.#currentAccount();
    return {familyId:asFamilyId('family-main'),actor:{userId:asUserId(authenticatedUserId),role:account.role,...(account.personId?{personId:asPersonId(account.personId)}:{})},correlationId:this.#correlation?.current()?.correlationId??asCorrelationId(`${prefix}-${randomUUID()}`)};
  }
  #backupQuarantineApplicationContext(prefix:string):BackupQuarantineApplicationContext {
    const authenticatedUserId=this.#requireAuth();
    const account=this.#currentAccount();
    return {familyId:asFamilyId('family-main'),actor:{userId:asUserId(authenticatedUserId),role:account.role,...(account.personId?{personId:asPersonId(account.personId)}:{})},correlationId:this.#correlation?.current()?.correlationId??asCorrelationId(`${prefix}-${randomUUID()}`)};
  }
  #externalBackupInventoryApplicationContext(prefix:string):ExternalBackupInventoryApplicationContext {
    const authenticatedUserId=this.#requireAuth();
    const account=this.#currentAccount();
    return {familyId:asFamilyId('family-main'),actor:{userId:asUserId(authenticatedUserId),role:account.role,...(account.personId?{personId:asPersonId(account.personId)}:{})},correlationId:this.#correlation?.current()?.correlationId??asCorrelationId(`${prefix}-${randomUUID()}`)};
  }
  #aiConsentApplicationContext(prefix: string) { const accountId = this.#requireAuth(); const account = this.#currentAccount(); return { actor: { userId: asUserId(accountId), role: account.role, ...(account.personId ? { personId: account.personId } : {}) }, correlationId: this.#correlation?.current()?.correlationId ?? asCorrelationId(`${prefix}-${randomUUID()}`) }; }

  #privacyControlApplicationContext(prefix:string) {
    const accountId=this.#requireAuth(); const account=this.#currentAccount();
    return {familyId:asFamilyId('family-main'),actor:{userId:asUserId(accountId),role:account.role,...(account.personId?{personId:asPersonId(account.personId)}:{})},correlationId:this.#correlation?.current()?.correlationId??asCorrelationId(`${prefix}-${randomUUID()}`)};
  }

  #archiveApplicationContext(prefix: string): ArchiveApplicationContext {
    const authenticatedUserId=this.#requireAuth(); const account=this.#currentAccount();
    return {familyId:asFamilyId('family-main'),actor:{userId:asUserId(authenticatedUserId),role:account.role,...(account.personId?{personId:asPersonId(account.personId)}:{})},correlationId:this.#correlation?.current()?.correlationId??asCorrelationId(`${prefix}-${randomUUID()}`)};
  }

  #localGovernedOcrApplicationContext(prefix: string): LocalGovernedOcrApplicationContext {
    const authenticatedUserId = this.#requireAuth();
    const account = this.#currentAccount();
    return {
      familyId: asFamilyId('family-main'),
      actor: {
        userId: asUserId(authenticatedUserId),
        role: account.role,
        ...(account.personId ? { personId: asPersonId(account.personId) } : {})
      },
      correlationId: this.#correlation?.current()?.correlationId
        ?? asCorrelationId(`${prefix}-${randomUUID()}`)
    };
  }

  #unifiedAuthorizedSearchApplicationContext(prefix: string): UnifiedAuthorizedSearchApplicationContext {
    return this.#localGovernedOcrApplicationContext(prefix);
  }

  async #propagateLocalGovernedOcrArchiveDeletion(
    archiveContext: ArchiveApplicationContext,
    sourceResourceId: string,
    archiveOperationId: string
  ): Promise<void> {
    const context: LocalGovernedOcrApplicationContext = {
      familyId: archiveContext.familyId,
      actor: {
        userId: archiveContext.actor.userId,
        role: archiveContext.actor.role,
        ...(archiveContext.actor.personId
          ? { personId: asPersonId(archiveContext.actor.personId) }
          : {})
      },
      correlationId: archiveContext.correlationId
    };
    const clientOperationId = deterministicArchiveIdentifier(
      archiveOperationId,
      'local-ocr-source-delete'
    );
    const command: PropagateLocalGovernedOcrSourceDeletionInput = {
      sourceResourceType: 'archive_item',
      sourceResourceId,
      purgedAt: asIsoDateTime(this.#clock.now()),
      clientOperationId
    };
    const result = await this.#propagateLocalGovernedOcrSourceDeletionUseCase.execute({
      context,
      command,
      identifiers: localGovernedOcrMutationIdentifiers(
        context,
        clientOperationId,
        sourceResourceId,
        'source_delete_propagate',
        { sourceResourceType: 'archive_item', sourceResourceId }
      )
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
  }

  #archiveOperationId(operationId?: string): string {
    const resolved = operationId === undefined ? `archive-op-${randomUUID()}` : operationId;
    if (!ARCHIVE_OPERATION_ID.test(resolved)) {
      throw new PlatformPolicyEnforcementError(
        'TRANSACTION_CONTEXT_MISMATCH',
        'Arşiv mutasyonu geçerli ve çağıran tarafından sabit tutulan bir işlem kimliği gerektirir.'
      );
    }
    return resolved;
  }

  #legacyArchiveOwnershipReattestationContext(itemId:string):ArchiveApplicationContext {
    const context=this.#archiveApplicationContext('archive-legacy-ownership-reattestation');
    if(!context.actor.personId)throw new PlatformPolicyEnforcementError('TRANSACTION_CONTEXT_MISMATCH','Eski arşiv sahipliği için kişi profili zorunludur.');
    const operationSeed=canonicalArchiveOperationValue({familyId:context.familyId,actorAccountId:context.actor.userId,ownerPersonId:context.actor.personId,itemId,confirmationVersion:1});
    const operationDigest=createHash('sha256').update(operationSeed,'utf8').digest('hex');
    return {...context,operationId:`archive-reattest-${operationDigest}`,operationFingerprint:createHash('sha256').update(canonicalArchiveOperationValue({mutation:'archive.legacy-ownership-reattestation',familyId:context.familyId,actorAccountId:context.actor.userId,ownerPersonId:context.actor.personId,itemId,confirmationVersion:1}),'utf8').digest('hex')};
  }

  #archiveMutationContext(
    prefix: string,
    operationId: string,
    semanticInput: unknown,
    correlationId?: ArchiveApplicationContext['correlationId']
  ): ArchiveApplicationContext {
    const authenticatedUserId = this.#requireAuth();
    const account = this.#currentAccount();
    const familyId = asFamilyId('family-main');
    const actor = {
      userId: asUserId(authenticatedUserId),
      role: account.role,
      ...(account.personId ? { personId: asPersonId(account.personId) } : {})
    } as const;
    const operationFingerprint = createHash('sha256').update(canonicalArchiveOperationValue({
      actorAccountId: actor.userId,
      familyId,
      mutation: prefix,
      semanticInput
    }), 'utf8').digest('hex');
    const context: ArchiveApplicationContext = {
      familyId,
      actor,
      correlationId: correlationId
        ?? this.#correlation?.current()?.correlationId
        ?? asCorrelationId(`${prefix}-${randomUUID()}`),
      operationId,
      operationFingerprint
    };
    const pendingMutation = ARCHIVE_OPERATION_PREFIX_TO_PENDING_MUTATION[prefix];
    if (!pendingMutation) {
      throw new PlatformPolicyEnforcementError(
        'TRANSACTION_CONTEXT_MISMATCH',
        'Arşiv mutasyonu kalıcı bekleyen işlem türüyle eşleştirilemedi.'
      );
    }
    this.#bindArchivePendingOperation(context, pendingMutation);
    return context;
  }

  #archiveDirectMutationContext(
    prefix: string,
    clientOperationId: string,
    semanticInput: unknown,
    correlationId?: ArchiveApplicationContext['correlationId']
  ): ArchiveApplicationContext {
    const operationId = this.#archiveOperationId(clientOperationId);
    const authenticatedUserId = this.#requireAuth();
    const account = this.#currentAccount();
    const familyId = asFamilyId('family-main');
    const actor = {
      userId: asUserId(authenticatedUserId),
      role: account.role,
      ...(account.personId ? { personId: asPersonId(account.personId) } : {})
    } as const;
    return {
      familyId,
      actor,
      correlationId: correlationId
        ?? this.#correlation?.current()?.correlationId
        ?? asCorrelationId(`${prefix}-${randomUUID()}`),
      operationId,
      operationFingerprint: createHash('sha256').update(canonicalArchiveOperationValue({
        actorAccountId: actor.userId,
        familyId,
        mutation: prefix,
        semanticInput
      }), 'utf8').digest('hex')
    };
  }

  #archiveRepositoryContext(
    context: ArchiveApplicationContext,
    transaction: Parameters<Parameters<AsyncTransactionExecutor['execute']>[1]>[0]
  ): RepositoryExecutionContext {
    return {
      transaction: transaction.transaction,
      actor: {
        userId: context.actor.userId,
        roles: [context.actor.role],
        ...(context.actor.personId ? { personId: asPersonId(context.actor.personId) } : {})
      },
      correlationId: context.correlationId,
      occurredAt: transaction.occurredAt
    };
  }

  #findArchiveOperation(
    context: ArchiveApplicationContext,
    expectation: ArchiveOperationExpectation
  ): PlatformPolicyArchiveOperationMetadata | undefined {
    if (!context.operationId) return undefined;
    if (!context.operationFingerprint) {
      throw new PlatformPolicyEnforcementError(
        'TRANSACTION_CONTEXT_MISMATCH',
        'ArÅŸiv iÅŸlem metadata sorgusu geÃ§erli bir fingerprint gerektirir.'
      );
    }
    const result = this.#transactionExecutor.execute(
      context.correlationId,
      (transaction) => this.#repositories.platformPolicyTransactionRepository.findArchiveOperationMetadata(
        this.#archiveRepositoryContext(context, transaction),
        {
          operationId: context.operationId!,
          operationFingerprint: context.operationFingerprint!,
          resourceFamilyId: String(context.familyId),
          actorAccountId: String(context.actor.userId),
          purpose: 'archive',
          resourceType: expectation.resourceType,
          resourceId: expectation.resourceId,
          action: expectation.action,
          capability: 'archive.write'
        }
      )
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  #assertArchiveOperationIdentity(
    context: ArchiveApplicationContext,
    expectation: ArchiveOperationExpectation
  ): boolean {
    const operation = this.#findArchiveOperation(context, expectation);
    if (!operation) return false;
    if (
      operation.operationFingerprint !== context.operationFingerprint
      || operation.resourceFamilyId !== context.familyId
      || operation.actorAccountId !== context.actor.userId
      || operation.purpose !== 'archive'
      || operation.resourceType !== expectation.resourceType
      || operation.resourceId !== expectation.resourceId
      || operation.action !== expectation.action
      || operation.capability !== 'archive.write'
    ) {
      throw new PlatformPolicyEnforcementError(
        'TRANSACTION_CONTEXT_MISMATCH',
        'Arşiv işlem kimliği farklı bir mutasyon için yeniden kullanılamaz.'
      );
    }
    return true;
  }

  #archivePendingIntentIdentity(input: ArchivePendingOperationIntentInput): {
    readonly context: ArchiveApplicationContext;
    readonly intentFingerprint: string;
    readonly secureDestroyResourceId?: string;
  } {
    if (!ARCHIVE_PENDING_OPERATION_MUTATIONS.has(input.mutation)) {
      throw new PlatformPolicyEnforcementError(
        'TRANSACTION_CONTEXT_MISMATCH',
        'Arşiv için bekleyen işlem türü geçersizdir.'
      );
    }
    const context = this.#archiveApplicationContext('archive-pending-operation');
    const canonicalIntent = canonicalArchiveOperationValue({
      actorAccountId: context.actor.userId,
      familyId: context.familyId,
      mutation: input.mutation,
      semanticInput: input.semanticInput
    });
    if (canonicalIntent.length > 262_144) {
      throw new PlatformPolicyEnforcementError(
        'TRANSACTION_CONTEXT_MISMATCH',
        'Arşiv için bekleyen işlem girdisi güvenli boyut sınırını aşıyor.'
      );
    }
    let secureDestroyResourceId: string | undefined;
    if (input.mutation === 'archive:secureDestroy') {
      if (!input.semanticInput || typeof input.semanticInput !== 'object' || Array.isArray(input.semanticInput)) {
        throw new PlatformPolicyEnforcementError(
          'TRANSACTION_CONTEXT_MISMATCH',
          'Arşiv güvenli imha kurtarma girdisi exact kaynak kimliği gerektirir.'
        );
      }
      const record = input.semanticInput as Record<string, unknown>;
      const itemIdDescriptor = Object.getOwnPropertyDescriptor(record, 'itemId');
      if (Reflect.ownKeys(record).length !== 1 || !itemIdDescriptor || !('value' in itemIdDescriptor)
        || typeof itemIdDescriptor.value !== 'string'
        || itemIdDescriptor.value !== itemIdDescriptor.value.trim()
        || itemIdDescriptor.value.length < 1 || itemIdDescriptor.value.length > 256) {
        throw new PlatformPolicyEnforcementError(
          'TRANSACTION_CONTEXT_MISMATCH',
          'Arşiv güvenli imha kurtarma kaynak kimliği kanonik değildir.'
        );
      }
      secureDestroyResourceId = itemIdDescriptor.value;
    }
    return {
      context,
      intentFingerprint: createHash('sha256').update(canonicalIntent, 'utf8').digest('hex'),
      ...(secureDestroyResourceId === undefined ? {} : { secureDestroyResourceId })
    };
  }

  #bindArchivePendingOperation(
    context: ArchiveApplicationContext,
    mutation: PlatformPolicyArchivePendingOperationMutation
  ): PlatformPolicyArchivePendingOperationRecord | undefined {
    if (!context.operationId || !context.operationFingerprint) {
      throw new PlatformPolicyEnforcementError(
        'TRANSACTION_CONTEXT_MISMATCH',
        'Arşiv mutasyonu işlem kimliği ve fingerprint gerektirir.'
      );
    }
    const result = this.#transactionExecutor.execute(context.correlationId, (transaction) =>
      this.#repositories.platformPolicyTransactionRepository.bindArchivePendingOperation(
        this.#archiveRepositoryContext(context, transaction),
        {
          operationId: context.operationId!,
          operationFingerprint: context.operationFingerprint!,
          mutation,
          resourceFamilyId: context.familyId,
          actorAccountId: context.actor.userId,
          purpose: 'archive'
        }
      )
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public acquireArchivePendingOperationIdentity(
    input: ArchivePendingOperationIntentInput
  ): ArchivePendingOperationIdentityView {
    const { context, intentFingerprint, secureDestroyResourceId } = this.#archivePendingIntentIdentity(input);
    const candidateOperationId = `archive-op-${randomUUID()}`;
    const acquired = this.#transactionExecutor.execute(context.correlationId, (transaction) =>
      this.#repositories.platformPolicyTransactionRepository.acquireArchivePendingOperation(
        this.#archiveRepositoryContext(context, transaction),
        {
          operationId: candidateOperationId,
          intentFingerprint,
          mutation: input.mutation,
          resourceFamilyId: context.familyId,
          actorAccountId: context.actor.userId,
          purpose: 'archive',
          ...(secureDestroyResourceId === undefined ? {} : { secureDestroyResourceId })
        }
      )
    );
    if (!acquired.ok) throw new Error(`[${acquired.error.code}] ${acquired.error.message}`);
    return Object.freeze({
      operationId: acquired.value.operationId,
      intentFingerprint: acquired.value.intentFingerprint,
      mutation: acquired.value.mutation,
      recovered: acquired.value.operationId !== candidateOperationId,
      state: acquired.value.acknowledgedAt ? 'acknowledged' : 'pending'
    });
  }

  public requireArchivePendingOperationIdentity(
    input: ArchivePendingOperationIntentInput & { readonly operationId: string }
  ): ArchivePendingOperationIdentityView {
    const operationId = this.#archiveOperationId(input.operationId);
    const { context, intentFingerprint } = this.#archivePendingIntentIdentity(input);
    const found = this.#transactionExecutor.execute(context.correlationId, (transaction) =>
      this.#repositories.platformPolicyTransactionRepository.findArchivePendingOperation(
        this.#archiveRepositoryContext(context, transaction),
        operationId
      )
    );
    if (!found.ok) throw new Error(`[${found.error.code}] ${found.error.message}`);
    if (
      !found.value
      || found.value.intentFingerprint !== intentFingerprint
      || found.value.mutation !== input.mutation
      || found.value.resourceFamilyId !== context.familyId
      || found.value.actorAccountId !== context.actor.userId
      || found.value.purpose !== 'archive'
      || found.value.acknowledgedAt !== undefined
    ) {
      throw new PlatformPolicyEnforcementError(
        'TRANSACTION_CONTEXT_MISMATCH',
        'Üretim arşiv mutasyonu açık ve kanonik girdiye bağlı kalıcı işlem kimliği gerektirir.'
      );
    }
    return Object.freeze({
      operationId: found.value.operationId,
      intentFingerprint: found.value.intentFingerprint,
      mutation: found.value.mutation,
      recovered: true,
      state: 'pending'
    });
  }

  public acknowledgeArchivePendingOperationIdentity(
    input: ArchivePendingOperationIntentInput & { readonly operationId: string }
  ): ArchivePendingOperationIdentityView {
    const operationId = this.#archiveOperationId(input.operationId);
    const { context, intentFingerprint } = this.#archivePendingIntentIdentity(input);
    const acknowledged = this.#transactionExecutor.execute(context.correlationId, (transaction) =>
      this.#repositories.platformPolicyTransactionRepository.acknowledgeArchivePendingOperation(
        this.#archiveRepositoryContext(context, transaction),
        {
          operationId,
          intentFingerprint,
          mutation: input.mutation,
          resourceFamilyId: context.familyId,
          actorAccountId: context.actor.userId,
          purpose: 'archive'
        }
      )
    );
    if (!acknowledged.ok) throw new Error(`[${acknowledged.error.code}] ${acknowledged.error.message}`);
    return Object.freeze({
      operationId: acknowledged.value.operationId,
      intentFingerprint: acknowledged.value.intentFingerprint,
      mutation: acknowledged.value.mutation,
      recovered: false,
      state: acknowledged.value.acknowledgedAt ? 'acknowledged' : 'pending'
    });
  }

  public async resumePendingLocalGovernedOcrArchiveDeletions(limit = 8): Promise<{
    readonly attempted: number;
    readonly completed: number;
    readonly failed: number;
  }> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 32) {
      throw new PlatformPolicyEnforcementError(
        'TRANSACTION_CONTEXT_MISMATCH',
        'Yerel OCR kaynak silme kurtarma sınırı geçersizdir.'
      );
    }
    const context = this.#archiveApplicationContext('local-ocr-source-deletion-recovery');
    const listed = this.#transactionExecutor.execute(context.correlationId, (transaction) =>
      this.#repositories.platformPolicyTransactionRepository.listRecoverableArchiveSecureDestroyOperations(
        this.#archiveRepositoryContext(context, transaction),
        {
          resourceFamilyId: context.familyId,
          actorAccountId: context.actor.userId,
          limit
        }
      )
    );
    if (!listed.ok) throw new Error(`[${listed.error.code}] ${listed.error.message}`);
    let completed = 0;
    let failed = 0;
    for (const recovery of listed.value) {
      const pendingInput = {
        mutation: 'archive:secureDestroy' as const,
        semanticInput: { itemId: recovery.sourceResourceId }
      };
      try {
        const identity = this.requireArchivePendingOperationIdentity({
          ...pendingInput,
          operationId: recovery.operationId
        });
        if (identity.intentFingerprint !== recovery.intentFingerprint) {
          throw new PlatformPolicyEnforcementError(
            'TRANSACTION_CONTEXT_MISMATCH',
            'Yerel OCR kaynak silme kurtarma fingerprinti değişmiştir.'
          );
        }
        await this.securelyDestroyArchiveItem(recovery.sourceResourceId, recovery.operationId);
        this.acknowledgeArchivePendingOperationIdentity({
          ...pendingInput,
          operationId: recovery.operationId
        });
        completed += 1;
      } catch {
        failed += 1;
      }
    }
    return { attempted: listed.value.length, completed, failed };
  }

  public async reconcileLocalGovernedOcrAuthorizations(limit = 8): Promise<{
    readonly attempted: number;
    readonly completed: number;
    readonly failed: number;
  }> {
    const listContext = this.#localGovernedOcrApplicationContext('local-ocr-authorization-reconcile-list');
    const listed = this.#reconcileLocalGovernedOcrAuthorizationUseCase.list(listContext, limit);
    if (!listed.ok) throw new Error(`[${listed.error.code}] ${listed.error.message}`);
    let completed = 0;
    let failed = 0;
    for (const candidate of listed.value) {
      const context = this.#localGovernedOcrApplicationContext('local-ocr-authorization-reconcile');
      const clientOperationId = deterministicArchiveIdentifier(
        canonicalArchiveOperationValue({
          familyId: context.familyId,
          accountId: context.actor.userId,
          ownerPersonId: context.actor.personId,
          jobId: candidate.jobId,
          revision: candidate.revision,
          reason: candidate.reason
        }),
        'local-ocr-authorization-reconcile'
      );
      const command = Object.freeze({
        jobId: candidate.jobId,
        expectedRevision: candidate.revision,
        reason: candidate.reason,
        clientOperationId
      });
      try {
        const result = await this.#reconcileLocalGovernedOcrAuthorizationUseCase.execute({
          context,
          command,
          identifiers: localGovernedOcrMutationIdentifiers(
            context,
            clientOperationId,
            candidate.jobId,
            'authorization_revoke_propagate',
            command
          )
        });
        if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
        completed += 1;
      } catch {
        failed += 1;
      }
    }
    return { attempted: listed.value.length, completed, failed };
  }

  public async reconcileLocalGovernedOcrRetention(limit = 8): Promise<{
    readonly attempted: number;
    readonly completed: number;
    readonly failed: number;
  }> {
    const listContext = this.#localGovernedOcrApplicationContext('local-ocr-retention-reconcile-list');
    const listed = this.#reconcileLocalGovernedOcrRetentionUseCase.list(listContext, limit);
    if (!listed.ok) throw new Error(`[${listed.error.code}] ${listed.error.message}`);
    let completed = 0;
    let failed = 0;
    for (const candidate of listed.value) {
      const context = this.#localGovernedOcrApplicationContext('local-ocr-retention-reconcile');
      const clientOperationId = deterministicArchiveIdentifier(
        canonicalArchiveOperationValue({
          familyId: context.familyId,
          accountId: context.actor.userId,
          ownerPersonId: context.actor.personId,
          jobId: candidate.jobId,
          revision: candidate.revision,
          retentionUntil: candidate.retentionUntil
        }),
        'local-ocr-retention-reconcile'
      );
      const command = Object.freeze({
        jobId: candidate.jobId,
        expectedRevision: candidate.revision,
        retentionUntil: candidate.retentionUntil,
        clientOperationId
      });
      try {
        const result = await this.#reconcileLocalGovernedOcrRetentionUseCase.execute({
          context,
          command,
          identifiers: localGovernedOcrMutationIdentifiers(
            context,
            clientOperationId,
            candidate.jobId,
            'retention_expire_propagate',
            command
          )
        });
        if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
        completed += 1;
      } catch {
        failed += 1;
      }
    }
    return { attempted: listed.value.length, completed, failed };
  }

  public async sweepLocalGovernedOcrOrphans(maximumCandidates = 64): Promise<{
    readonly scanned: number;
    readonly deleted: number;
    readonly referenced: number;
    readonly rejected: number;
    readonly networkUsed: false;
    readonly cloudUsed: false;
  }> {
    const context = this.#localGovernedOcrApplicationContext('local-ocr-orphan-sweep');
    const operationId = deterministicArchiveIdentifier(
      canonicalArchiveOperationValue({
        familyId: context.familyId,
        accountId: context.actor.userId,
        ownerPersonId: context.actor.personId,
        correlationId: context.correlationId,
        maximumCandidates
      }),
      'local-ocr-orphan-sweep'
    );
    const result = await this.#sweepLocalGovernedOcrOrphansUseCase.execute({
      context,
      maximumCandidates,
      auditId: deterministicArchiveIdentifier(operationId, 'audit'),
      outboxEventId: asEventId(deterministicArchiveIdentifier(operationId, 'outbox'))
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  #legacyApplicationContext(prefix:string):LegacyApplicationContext {
    const authenticatedUserId=this.#requireAuth(); const account=this.#currentAccount();
    return {familyId:asFamilyId('family-main'),actor:{userId:asUserId(authenticatedUserId),role:account.role,...(account.personId?{personId:account.personId}:{})},correlationId:this.#correlation?.current()?.correlationId??asCorrelationId(`${prefix}-${randomUUID()}`)};
  }

  #backupSafetyCorrelationId(prefix: string): ReturnType<typeof asCorrelationId> {
    return this.#correlation?.current()?.correlationId ?? asCorrelationId(`${prefix}-${randomUUID()}`);
  }

  #systemResourceSnapshot(prefix: string) {
    const result = this.#inspectSystemResourceSnapshotUseCase.execute(
      this.#backupSafetyCorrelationId(prefix),
      { databasePath: this.#databasePath, archivePath: this.#archivePath }
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.#databaseSnapshotProvider
      ? { ...result.value, databaseBytes: this.#databaseSnapshotProvider.databaseBytes() }
      : result.value;
  }

  #withDatabaseSnapshot<T>(operation: (databasePath: string) => T): T {
    return this.#databaseSnapshotProvider
      ? this.#databaseSnapshotProvider.withSnapshot(operation)
      : operation(this.#databasePath);
  }

  #prepareDatabaseForBackup(prefix: string): void {
    const result = this.#prepareBackupDatabaseUseCase.execute(this.#backupSafetyCorrelationId(prefix));
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
  }

  #verifyBackupDatabaseFile(databasePath: string, prefix: string): void {
    const result = this.#verifyBackupDatabaseIntegrityUseCase.execute(
      databasePath,
      this.#backupSafetyCorrelationId(prefix)
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
  }

  public verifyStrongAuthentication(input: { readonly password:string; readonly code?:string }): void {
    const context = this.#dataLifecycleApplicationContext('ipc-adaptive-budget-maintenance-reauthentication');
    const result = this.#strongAuthentication.verify(context, {
      password: input.password,
      ...(input.code ? { code: input.code } : {})
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
  }

  public changePassword(input: ChangePasswordInput): AuthStateView {
    const result = this.#changePasswordUseCase.execute({
      context: this.#authApplicationContext('change-password'),
      command: input,
      auditId: randomUUID()
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.getAuthState();
  }

  public listAudit(limit=100): AuditEntryView[] { const actorId=asUserId(this.#requireAuth()); const result=this.#listAuditEntriesUseCase.execute(this.#authorizationApplicationContext('audit-list'),actorId,this.#clock.now(),limit); if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`); return [...result.value]; }

  public verifyAuditIntegrity(): AuditIntegrityView {
    const actorId = asUserId(this.#requireAuth());
    const result = this.#verifyAuditIntegrityUseCase.execute(
      this.#authorizationApplicationContext('audit-integrity'),
      actorId,
      this.#clock.now()
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }


  public async openArchiveItem(id:string, requestedOperationId?:string): Promise<string> {
    const itemId = id.trim();
    const operationId = this.#archiveOperationId(requestedOperationId);
    const context = this.#archiveMutationContext('archive.open', operationId, { itemId });
    this.#assertArchiveOperationIdentity(context, {
      resourceType: 'archive_item',
      resourceId: itemId,
      action: 'record'
    });
    const plan=await this.#prepareArchiveOpenUseCase.execute(context,itemId);
    if(!plan.ok) throw new Error(`[${plan.error.code}] ${plan.error.message}`);
    const materialized=this.#materializeArchiveFileUseCase.execute(context.correlationId,{
      itemId,
      storedName:plan.value.storedName,
      originalName:plan.value.originalName,
      expectedSha256:plan.value.sha256
    });
    if(!materialized.ok) throw new Error(`[${materialized.error.code}] ${materialized.error.message}`);
    const recorded=await this.#recordArchiveOpenedUseCase.execute({
      context,
      itemId,
      identifiers:{auditId:deterministicArchiveIdentifier(operationId, 'audit')}
    });
    if(!recorded.ok) {
      rmSync(materialized.value, { force: true });
      throw new Error(`[${recorded.error.code}] ${recorded.error.message}`);
    }
    return materialized.value;
  }

  public async readArchiveItemBytesForEmergencyExport(
    id: string,
    requestedOperationId?: string,
    requestedCorrelationId?: string
  ): Promise<{
    readonly itemId: string;
    readonly originalName: string;
    readonly mimeType: string;
    readonly sizeBytes: number;
    readonly sha256: string;
    readonly bytes: Buffer;
  }> {
    const itemId = id.trim();
    if (!itemId) throw new Error('Acil kart arşiv belgesi kimliği zorunludur.');
    const pendingInput = { mutation: 'archive:open' as const, semanticInput: { itemId } };
    const operationId = requestedOperationId === undefined
      ? this.acquireArchivePendingOperationIdentity(pendingInput).operationId
      : this.#archiveOperationId(requestedOperationId);
    this.requireArchivePendingOperationIdentity({ ...pendingInput, operationId });
    const context = this.#archiveMutationContext(
      'archive.open',
      operationId,
      { itemId },
      requestedCorrelationId === undefined ? undefined : asCorrelationId(requestedCorrelationId)
    );
    this.#assertArchiveOperationIdentity(context, {
      resourceType: 'archive_item',
      resourceId: itemId,
      action: 'record'
    });
    let bytes:Buffer | undefined;
    try {
      const plan = await this.#authorizeEmergencyArchiveReadUseCase.execute({
        context,
        itemId,
        identifiers:{ auditId:deterministicArchiveIdentifier(operationId, 'audit') }
      });
      if (!plan.ok) throw new Error(`[${plan.error.code}] ${plan.error.message}`);
      if (plan.value.state === 'denied') {
        if (plan.value.reason === 'not_found') throw new Error('Acil kart arşiv belgesi bulunamadı.');
        if (plan.value.reason === 'sensitivity') throw new Error('Acil kart için yalnız yüksek hassasiyetli arşiv belgesi okunabilir.');
        throw new Error('Acil kart arşiv belgesi 10 MiB güvenli boyut sınırını aşıyor.');
      }
      const read = this.#readArchiveFileBytesUseCase.execute(context.correlationId, {
        itemId,
        storedName: plan.value.storedName,
        expectedSha256: plan.value.sha256,
        expectedSizeBytes: plan.value.sizeBytes,
        maximumBytes: 10 * 1024 * 1024
      });
      if (!read.ok) throw new Error(`[${read.error.code}] ${read.error.message}`);
      bytes = Buffer.from(read.value);
      read.value.fill(0);
      return {
        itemId,
        originalName: plan.value.originalName,
        mimeType: plan.value.mimeType,
        sizeBytes: plan.value.sizeBytes,
        sha256: plan.value.sha256,
        bytes
      };
    } finally {
      try {
        this.acknowledgeArchivePendingOperationIdentity({ ...pendingInput, operationId });
      } catch (error) {
        bytes?.fill(0);
        throw error;
      }
    }
  }

  #resolveBackupPassword(explicitPassword?: string): string {
    if (explicitPassword !== undefined && explicitPassword.length > 0) return explicitPassword;
    if (this.#managedBackupPasswordProvider) return this.#managedBackupPasswordProvider.getOrCreate();
    throw new Error('Yedek parolası zorunludur; otomatik yedek parolası sağlayıcısı yapılandırılmamış.');
  }

  public exportFullBackup(destinationPath:string, password?:string): void {
    this.#requireAuth();
    if(!destinationPath.toLowerCase().endsWith('.pptbackup')) throw new Error('Tam yedek .pptbackup uzantılı olmalıdır.');
    this.#prepareDatabaseForBackup('backup-checkpoint');
    const context=this.#backupApplicationContext('full-backup-export');
    const createdAt=nowIso();
    const backupPassword=this.#resolveBackupPassword(password);
    const result=this.#withDatabaseSnapshot((databasePath) => this.#createFullBackupUseCase.execute(context.correlationId,{
      databasePath,
      keyPath:this.#keyPath,
      archivePath:this.#archivePath,
      destinationPath,
      createdAt,
      password:backupPassword
    }));
    if(!result.ok) throw new Error(result.error.message);
    this.#writeAudit('backup.full_exported','database','family-main',createdAt);
  }

  public inspectFullBackup(sourcePath:string, password?:string): BackupInspectionView {
    this.#requireAuth();
    const context=this.#backupApplicationContext('full-backup-inspect');
    const effectivePassword=password ?? this.#managedBackupPasswordProvider?.getOrCreate();
    const result=this.#inspectFullBackupUseCase.execute(context.correlationId,sourcePath,effectivePassword);
    if(!result.ok) throw new Error(result.error.message);
    return result.value;
  }

  public restoreFullBackup(sourcePath: string, safetyBackupPath: string, password?: string): void {
    this.#requireAuth();
    const context=this.#backupApplicationContext('full-backup-restore');
    const effectivePassword=password ?? this.#managedBackupPasswordProvider?.getOrCreate();
    const inspected=this.#inspectFullBackupUseCase.execute(context.correlationId,sourcePath,effectivePassword);
    if(!inspected.ok) throw new Error(inspected.error.message);
    const preparedDestination=this.#prepareFullBackupDestinationUseCase.execute(context.correlationId,safetyBackupPath);
    if(!preparedDestination.ok) throw new Error(preparedDestination.error.message);
    const safetyPassword=effectivePassword && effectivePassword.length>0 ? effectivePassword : this.#resolveBackupPassword();
    this.exportFullBackup(safetyBackupPath,safetyPassword);
    const staged=this.#stageFullBackupRestoreUseCase.execute(context.correlationId,{
      sourcePath,
      databasePath:this.#restoreDatabasePath,
      keyPath:this.#keyPath,
      archivePath:this.#archivePath,
      ...(effectivePassword === undefined ? {} : { password: effectivePassword })
    });
    if(!staged.ok) throw new Error(staged.error.message);

    const restoredAt=nowIso();
    let databaseClosed=false;
    try {
      this.#verifyBackupDatabaseFile(staged.value.stagedDatabasePath,'restore-staged-database-integrity');
      const reauthorization=this.#prepareRestoredDatabaseForReauthorizationUseCase.execute(
        staged.value.stagedDatabasePath,
        restoredAt,
        context.correlationId
      );
      if(!reauthorization.ok) throw new Error(`[${reauthorization.error.code}] ${reauthorization.error.message}`);
      this.#verifyBackupDatabaseFile(staged.value.stagedDatabasePath,'restore-staged-database-post-reauthorization-integrity');
      this.#prepareDatabaseForBackup('restore-checkpoint');
      this.#databaseRuntime.close();
      databaseClosed=true;
      const committed=this.#commitFullBackupRestoreUseCase.execute(context.correlationId,{
        plan:staged.value,
        restoredAt,
        safetyBackupPath,
        revokedTrustedDeviceCount:reauthorization.value.revokedTrustedDeviceCount
      });
      if(!committed.ok) {
        throw new FullBackupRestoreRestartRequiredError(committed.error.message);
      }
      this.#sessionManager.clear();
    } catch(error) {
      if(!databaseClosed) {
        const discarded=this.#discardFullBackupRestoreUseCase.execute(context.correlationId,staged.value);
        if(!discarded.ok) {
          throw new Error(`${error instanceof Error ? error.message : String(error)}; staging temizlenemedi: ${discarded.error.message}`);
        }
      }
      if(databaseClosed && !(error instanceof FullBackupRestoreRestartRequiredError)) {
        throw new FullBackupRestoreRestartRequiredError(error instanceof Error ? error.message : String(error));
      }
      throw error;
    }
  }


  public async getWindowsHelloState(accountId?: string): Promise<WindowsHelloStateView> {
    const result = await this.#getWindowsHelloStateUseCase.execute(
      this.#authApplicationContext('windows-hello-state'),
      accountId
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public currentAuthenticatedAccountId(): string {
    return this.#requireAuth();
  }

  public currentPlatformPolicyAuthority(binding: {
    readonly policyVersion: string;
    readonly policyPackageVersion: number;
    readonly policyPackageSha256: string;
    readonly applicationVersion: string;
  }): PlatformPolicyConnectionAuthority {
    const account = this.#currentAccount();
    const auth = this.getAuthState();
    const device = this.#deviceIdentityProvider.snapshot();
    if (
      !auth.authenticated
      || !authorizationRoleMatches(auth.role, account.role)
      || auth.currentDeviceId !== device.deviceId
      || auth.trustedDevice !== true
      || typeof auth.sessionExpiresAt !== 'string'
      || !Number.isFinite(Date.parse(auth.sessionExpiresAt))
    ) throw new PlatformPolicyEnforcementError(
      'AUTHORITY_RESOLUTION_FAILED',
      'Authenticated Desktop policy authority is incomplete or untrusted'
    );
    return Object.freeze({
      policyVersion: binding.policyVersion,
      policyPackageVersion: binding.policyPackageVersion,
      policyPackageSha256: binding.policyPackageSha256,
      accountId: account.id,
      ...(account.personId ? { personId: account.personId } : {}),
      deviceId: device.deviceId,
      applicationId: 'windows-desktop',
      applicationVersion: binding.applicationVersion,
      devicePublicKeyFingerprintSha256: device.fingerprint,
      deviceCertificateIssuedAt: device.createdAt,
      deviceTrusted: true,
      membershipActive: true,
      roles: Object.freeze([account.role]),
      familyIds: Object.freeze(['family-main']),
      online: true,
      expiresAt: auth.sessionExpiresAt
    });
  }

  public async enrollWindowsHello(
    input: EnrollWindowsHelloInput
  ): Promise<WindowsHelloEnrollmentView> {
    const result = await this.#enrollWindowsHelloUseCase.execute({
      context: this.#authApplicationContext('windows-hello-enroll'),
      command: input,
      registrationId: randomUUID(),
      auditId: randomUUID(),
      revocationAuditId: randomUUID()
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async loginWithWindowsHello(
    input: LoginWithWindowsHelloInput
  ): Promise<WindowsHelloAuthenticationView> {
    if (!input.accountId) {
      throw new Error('[ACCOUNT_UNAVAILABLE] Windows Hello girişi için ana süreç tarafından doğrulanmış hesap bağı gereklidir.');
    }
    const context = this.#authApplicationContext('windows-hello-login');
    const result = await this.#loginWithWindowsHelloUseCase.execute({
      context,
      accountId: input.accountId,
      auditId: randomUUID(),
      revocationAuditId: randomUUID()
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    if (result.value.authenticated || !input.fallback) return result.value;
    const fallback = this.#loginUseCase.execute({
      context,
      command: {
        accountId: input.accountId,
        password: input.fallback.password,
        ...(input.fallback.secondFactorCode
          ? { secondFactorCode: input.fallback.secondFactorCode }
          : {})
      },
      auditId: randomUUID(),
      recoveryAuditId: randomUUID(),
      currentDevice: this.#currentDeviceContext('windows-hello-password-fallback', context.correlationId)
    });
    if (!fallback.ok) throw new Error(`[${fallback.error.code}] ${fallback.error.message}`);
    return {
      ...result.value,
      authenticated: true,
      method: 'password_fallback'
    };
  }

  public async reauthenticateWithWindowsHello(
    input: ReauthenticateWithWindowsHelloInput
  ): Promise<WindowsHelloAuthenticationView> {
    const result = await this.#reauthenticateWithWindowsHelloUseCase.execute({
      context: this.#authApplicationContext('windows-hello-reauthenticate'),
      auditId: randomUUID(),
      revocationAuditId: randomUUID()
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    if (result.value.authenticated || !input.fallback) return result.value;
    const fallbackContext = this.#dataLifecycleApplicationContext(
      'windows-hello-reauthenticate-password-fallback'
    );
    const fallback = this.#strongAuthentication.verify(fallbackContext, {
      password: input.fallback.password,
      ...(input.fallback.secondFactorCode
        ? { code: input.fallback.secondFactorCode }
        : {})
    });
    if (!fallback.ok) throw new Error(`[${fallback.error.code}] ${fallback.error.message}`);
    return {
      ...result.value,
      authenticated: true,
      method: 'password_fallback'
    };
  }

  public beginTwoFactorSetup(): TwoFactorSetupView {
    const context = this.#authApplicationContext('two-factor-setup');
    const result = this.#beginTwoFactorSetupUseCase.execute(context, randomUUID());
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public enableTwoFactor(input: EnableTwoFactorInput): AuthStateView {
    const context = this.#authApplicationContext('two-factor-enable');
    const result = this.#enableTwoFactorUseCase.execute(context, input, randomUUID());
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.getAuthState();
  }

  public disableTwoFactor(input: DisableTwoFactorInput): AuthStateView {
    const context = this.#authApplicationContext('two-factor-disable');
    const result = this.#disableTwoFactorUseCase.execute(context, input, randomUUID());
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.getAuthState();
  }

  public rotateAccountSecurityEpochAfterMaintenanceRecovery(): {
    readonly previousSecurityEpoch: number;
    readonly securityEpoch: number;
    readonly revokedTrustedDeviceCount: number;
  } {
    const context = this.#authApplicationContext('maintenance-recovery-security-epoch');
    const result = this.#rotateAccountSecurityEpochAfterRecoveryUseCase.execute(context, randomUUID());
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public trustCurrentDevice(input: TrustCurrentDeviceInput): TrustedDeviceView[] {
    const context = this.#authApplicationContext('trust-device');
    const currentDevice = this.#currentDeviceContext('trust-device', context.correlationId);
    const result = this.#trustCurrentDeviceUseCase.execute({
      context,
      command: input,
      currentDevice,
      trustedDeviceId: randomUUID(),
      auditId: randomUUID(),
      recoveryAuditId: randomUUID()
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listTrustedDevices();
  }

  public reauthorizeCurrentDeviceAfterRecovery(input: ReauthorizeCurrentDeviceInput): ReauthorizeCurrentDeviceResultView {
    const context = this.#authApplicationContext('reauthorize-device-after-recovery');
    const currentDevice = this.#currentDeviceContext('reauthorize-device-after-recovery', context.correlationId);
    const trustedDeviceId = randomUUID();
    const auditId = randomUUID();
    const result = this.#reauthorizeCurrentDeviceAfterRecoveryUseCase.execute({
      context,
      command: input,
      currentDevice,
      trustedDeviceId,
      auditId,
      recoveryAuditId: randomUUID()
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    const identity = this.#deviceIdentityProvider.snapshot();
    const receipt = createSecurityEventReceipt({
      receiptId: randomUUID(),
      accountId: result.value.accountId,
      deviceId: identity.deviceId,
      deviceFingerprint: identity.fingerprint,
      securityEpoch: result.value.securityEpoch,
      trustedDeviceId: result.value.trustedDeviceId,
      auditId: result.value.auditId,
      occurredAt: result.value.occurredAt,
      signerPublicKeyPem: identity.publicKeyPem
    }, (payload) => this.#deviceIdentityProvider.createProof(payload).signatureBase64);
    const receiptArchived = this.#securityEventReceiptStore.append(receipt);
    return { devices: this.listTrustedDevices(), receipt, receiptArchived };
  }

  public listSecurityEventReceipts(limit = 20): SecurityEventReceiptArchiveItemView[] {
    const accountId = this.#sessionManager.currentAccountId({ touch: false });
    if (!accountId) throw new Error('[AUTHENTICATION_REQUIRED] Güvenlik makbuzlarını görmek için giriş yapılmalıdır.');
    return this.#securityEventReceiptStore.list(createAccountSecurityReceiptFingerprint(accountId), limit);
  }

  public verifySecurityEventReceiptJson(receiptJson: string): SecurityEventReceiptVerificationView {
    if (!this.#sessionManager.currentAccountId({ touch: false })) {
      throw new Error('[AUTHENTICATION_REQUIRED] Güvenlik makbuzu doğrulamak için giriş yapılmalıdır.');
    }
    return this.#securityEventReceiptStore.verifyJson(receiptJson);
  }

  public listTrustedDevices(): TrustedDeviceView[] {
    const context = this.#authApplicationContext('list-trusted-devices');
    const currentDevice = this.#deviceIdentityProvider.snapshot();
    const result = this.#listTrustedDevicesUseCase.execute(context, currentDevice.deviceId);
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public revokeTrustedDevice(id: string): TrustedDeviceView[] {
    const context = this.#authApplicationContext('revoke-trusted-device');
    const result = this.#revokeTrustedDeviceUseCase.execute(context, id, randomUUID());
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listTrustedDevices();
  }

  #currentAccount(): { id:string; role:FamilyRole; personId?:string } {
    const id = this.#requireAuth();
    const correlationId = this.#correlation?.current()?.correlationId
      ?? asCorrelationId(`current-account-${randomUUID()}`);
    const result = this.#transactionExecutor.execute(correlationId, (transaction) =>
      this.#repositories.accountRepository.findById({
        transaction: transaction.transaction,
        actor: { userId: asUserId(id), roles: ['system_operator'] },
        correlationId,
        occurredAt: transaction.occurredAt
      }, asUserId(id))
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    const account = result.value;
    const now = Date.now();
    if (!account || account.status !== 'active' || new Date(account.startsAt).getTime() > now || (account.endsAt && new Date(account.endsAt).getTime() < now)) {
      throw new Error('Üyeliğiniz etkin değil.');
    }
    return { id: account.id, role: account.role as FamilyRole, ...(account.personId ? { personId: account.personId } : {}) };
  }

  #authorizationDecision(
    accountId: string,
    resourceType: string,
    resourceId: string,
    action: 'read'|'create'|'update'|'delete'|'share'|'ai_process'|'administer',
    ownerPersonId?: string,
    purpose: AuthorizationPurpose = 'general',
    resourceBranchId?: string
  ): { readonly allowed: boolean; readonly reason: string } {
    const result = this.#evaluateAuthorizationUseCase.execute({
      context: this.#authorizationApplicationContext(`authorize-${action}`),
      accountId: asUserId(accountId),
      occurredAt: this.#clock.now(),
      action,
      resourceType,
      resourceId,
      purpose,
      ...(resourceBranchId ? { resourceBranchId: asFamilyBranchId(resourceBranchId) } : {}),
      ...(ownerPersonId ? { ownerPersonId } : {})
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  #authorize(resourceType:string, resourceId:string, action:'read'|'create'|'update'|'delete'|'share'|'ai_process'|'administer', ownerPersonId?:string): boolean {
    return this.#authorizationDecision(this.#requireAuth(), resourceType, resourceId, action, ownerPersonId).allowed;
  }

  #hasObjectPermission(accountId:string,resourceType:string,resourceId:string,action:'read'|'create'|'update'|'delete'|'share'): boolean {
    const decision = this.#authorizationDecision(accountId, resourceType, resourceId, action);
    return decision.allowed && decision.reason === 'explicit_allow';
  }

  #canRead(resourceType:string,resourceId:string,ownerPersonId?:string): boolean {
    return this.#authorize(resourceType, resourceId, 'read', ownerPersonId);
  }

  #assertAdmin(): string {
    const id = this.#requireAuth();
    if (!this.#authorize('object_permission', '*', 'administer')) throw new Error('Bu işlem aile yöneticisi yetkisi gerektirir.');
    return id;
  }


  public listAccounts(): FamilyAccountView[] {
    const actorId = asUserId(this.#assertAdmin());
    const result = this.#listFamilyAccountsUseCase.execute(this.#membershipApplicationContext('accounts-list'), actorId);
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public updateAccount(input: UpdateFamilyAccountInput): FamilyAccountView[] {
    const actorId = asUserId(this.#assertAdmin());
    const result = this.#updateFamilyAccountUseCase.execute({
      context: this.#membershipApplicationContext('account-update'),
      actorId,
      command: input,
      auditId: randomUUID(),
      outboxEventId: asEventId(randomUUID())
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listAccounts();
  }

  public createInvitation(input: CreateFamilyInvitationInput): { invitation: FamilyInvitationView; token:string } {
    const actorId = asUserId(this.#assertAdmin());
    const result = this.#createFamilyInvitationUseCase.execute({
      context: this.#membershipApplicationContext('invitation-create'),
      actorId,
      command: input,
      identifiers: {
        invitationId: randomUUID(),
        auditId: randomUUID(),
        outboxEventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public listInvitations(): FamilyInvitationView[] {
    this.#assertAdmin();
    const result = this.#listFamilyInvitationsUseCase.execute(
      this.#membershipApplicationContext('invitation-list'),
      this.#clock.now()
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public inspectInvitation(input: InspectFamilyInvitationInput): FamilyInvitationInspectionView {
    const result = this.#inspectFamilyInvitationUseCase.execute(
      this.#membershipApplicationContext('invitation-inspect'),
      input,
      this.#clock.now()
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public revokeInvitation(id:string): FamilyInvitationView[] {
    const actorId = asUserId(this.#assertAdmin());
    const result = this.#revokeFamilyInvitationUseCase.execute({
      context: this.#membershipApplicationContext('invitation-revoke'),
      actorId,
      invitationId: id,
      auditId: randomUUID(),
      outboxEventId: asEventId(randomUUID())
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listInvitations();
  }

  public resendInvitation(input: ResendFamilyInvitationInput): { invitation: FamilyInvitationView; token: string } {
    const actorId = asUserId(this.#assertAdmin());
    const result = this.#resendFamilyInvitationUseCase.execute({
      context: this.#membershipApplicationContext('invitation-resend'),
      actorId,
      command: input,
      identifiers: {
        invitationId: randomUUID(),
        auditId: randomUUID(),
        outboxEventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public acceptInvitation(input: AcceptFamilyInvitationInput): AuthStateView {
    const accountId = asUserId(randomUUID());
    const result = this.#acceptFamilyInvitationUseCase.execute({
      context: this.#membershipApplicationContext('invitation-accept'),
      command: input,
      accountId,
      auditId: randomUUID(),
      outboxEventId: asEventId(randomUUID())
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    this.#sessionManager.start(result.value, 0);
    return this.getAuthState();
  }


  public listPermissions(): ObjectPermissionView[] {
    const actorId = asUserId(this.#requireAuth());
    const result = this.#listObjectPermissionsUseCase.execute(
      this.#authorizationApplicationContext('permissions-list'),
      actorId,
      this.#clock.now()
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public getAuthorizationContextWorkspace(): AuthorizationContextWorkspaceView {
    return {
      accounts: this.listAccounts(),
      permissions: this.listPermissions(),
      branches: this.getHouseholdMembershipWorkspace().branches
    };
  }

  public upsertPermission(input: UpsertObjectPermissionInput): ObjectPermissionView[] {
    const actorId = asUserId(this.#requireAuth());
    const result = this.#upsertObjectPermissionUseCase.execute({
      context: this.#authorizationApplicationContext('permission-upsert'),
      actorId,
      command: input,
      permissionId: input.id ?? randomUUID(),
      auditId: randomUUID()
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listPermissions();
  }

  public deletePermission(id:string): ObjectPermissionView[] {
    const actorId = asUserId(this.#requireAuth());
    const result = this.#deleteObjectPermissionUseCase.execute({
      context: this.#authorizationApplicationContext('permission-delete'),
      actorId,
      permissionId: id,
      auditId: randomUUID()
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listPermissions();
  }

  public listOfflineCapabilityLeases(): OfflineCapabilityLeaseView[] {
    const actorId = asUserId(this.#requireAuth());
    const result = this.#listOfflineCapabilityLeasesUseCase.execute({
      context: this.#authorizationApplicationContext('offline-capability-lease-list'),
      actorId,
      familyId: 'family-main',
      occurredAt: this.#clock.now()
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public issueOfflineCapabilityLease(input: IssueOfflineCapabilityLeaseInput): OfflineCapabilityLeaseView {
    const actorId = asUserId(this.#requireAuth());
    const result = this.#issueOfflineCapabilityLeaseUseCase.execute({
      context: this.#authorizationApplicationContext('offline-capability-lease-issue'),
      actorId,
      familyId: 'family-main',
      deviceId: this.#deviceIdentityProvider.snapshot().deviceId,
      command: input,
      identifiers: { leaseId: randomUUID(), nonce: randomUUID() },
      binding: OFFLINE_CAPABILITY_LEASE_BINDING
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public revokeOfflineCapabilityLease(leaseId: string): OfflineCapabilityLeaseView {
    const actorId = asUserId(this.#requireAuth());
    const result = this.#revokeOfflineCapabilityLeaseUseCase.execute({
      context: this.#authorizationApplicationContext('offline-capability-lease-revoke'),
      actorId,
      leaseId
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }


  public getAuthState(): AuthStateView {
    const context = this.#authApplicationContext('auth-state');
    const result = this.#getAuthStateUseCase.execute(context, this.#currentDeviceContext('auth-state', context.correlationId));
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public getSessionLockState(): SessionLockStateView {
    const internal = this.#sessionManager.snapshot();
    if (internal.status === 'locked' && internal.accountId && internal.lockedAt && internal.lockedAt !== this.#auditedSessionLockAt) {
      this.#writeAuditAs(internal.accountId, `session.locked_${internal.lockReason ?? 'idle_timeout'}`, 'account', internal.accountId, internal.lockedAt);
      this.#auditedSessionLockAt = internal.lockedAt;
    }
    return this.#getSessionLockStateUseCase.execute();
  }

  public recordSessionActivity(): SessionLockStateView {
    return this.#recordSessionActivityUseCase.execute();
  }

  public lockSession(): SessionLockStateView {
    const current = this.#sessionManager.snapshot();
    const view = this.#lockSessionUseCase.execute('manual');
    if (current.active && current.accountId && view.lockedAt) {
      this.#writeAuditAs(current.accountId, 'session.locked_manual', 'account', current.accountId, view.lockedAt);
      this.#auditedSessionLockAt = view.lockedAt;
    }
    return view;
  }

  public unlockSession(input: UnlockSessionInput): AuthStateView {
    const current = this.#sessionManager.snapshot();
    if (current.status !== 'locked' || !current.accountId) {
      throw new Error('[AUTH_SESSION_NOT_LOCKED] Yeniden doğrulama yalnız kilitli oturum için kullanılabilir.');
    }
    const state = this.login({
      accountId: current.accountId,
      password: input.password,
      ...(input.secondFactorCode ? { secondFactorCode: input.secondFactorCode } : {})
    });
    this.#writeAudit('session.unlocked', 'account', current.accountId, nowIso());
    this.#auditedSessionLockAt = undefined;
    return state;
  }

  public getDesktopSecurityPosture(): DesktopSecurityPostureView {
    return this.#getDesktopSecurityPostureUseCase.execute();
  }

  public setupAdmin(input: SetupAdminInput): AuthStateView {
    const accountId = asUserId(randomUUID());
    const personId = asPersonId(`person-${accountId}`);
    const context = this.#authApplicationContext('setup-admin');
    const result = this.#setupAdminUseCase.execute({
      context,
      command: input,
      currentDevice: this.#currentDeviceContext('setup-admin', context.correlationId),
      identifiers: {
        accountId,
        familyId: asFamilyId('family-main'),
        personId,
        auditId: randomUUID(),
        familyAuditId: randomUUID(),
        membershipAuditId: randomUUID(),
        trustedDeviceId: randomUUID(),
        trustedDeviceAuditId: randomUUID(),
        archivePermissionIds: {
          archive_item: randomUUID(),
          archive_retention_policy: randomUUID(),
          archive_category: randomUUID()
        },
        archivePermissionAuditIds: {
          archive_item: randomUUID(),
          archive_retention_policy: randomUUID(),
          archive_category: randomUUID()
        }
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.getAuthState();
  }

  public login(input: LoginInput): AuthStateView {
    const context = this.#authApplicationContext('login');
    const result = this.#loginUseCase.execute({
      context,
      command: input,
      auditId: randomUUID(),
      recoveryAuditId: randomUUID(),
      currentDevice: this.#currentDeviceContext('login', context.correlationId)
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.getAuthState();
  }

  public logout(): AuthStateView {
    const result = this.#logoutUseCase.execute(this.#authApplicationContext('logout'), randomUUID());
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    this.#familyDataImportService.clearCachedPreviews();
    return this.getAuthState();
  }

  public createRelation(input: CreateFamilyRelationInput): FamilyMutationResultView {
    const context = this.#familyApplicationContext('relation');
    const result = this.#createFamilyRelationUseCase.execute({
      context,
      command: input,
      identifiers: {
        relationId: randomUUID(),
        auditId: randomUUID(),
        eventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.#recordMutation({
      entityType: 'relation',
      entityId: result.value,
      operation: 'created',
      changedSections: ['graph'],
      changedRevisions: ['graph', 'dashboard'],
      relation: { id: result.value, fromPersonId: input.fromPersonId, toPersonId: input.toPersonId, relationType: input.relationType }
    });
  }

  public async listArchive(): Promise<ArchiveItemView[]> {
    const result=await this.#listArchiveItemsUseCase.execute(this.#archiveApplicationContext('archive-list'));
    if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public async importArchiveFile(
    sourcePath: string,
    input: CreateArchiveItemInput & { readonly operationId?: string }
  ): Promise<ArchiveItemView[]> {
    const operationId = this.#archiveOperationId(input.operationId);
    const itemId = deterministicArchiveIdentifier(operationId, 'item');
    const fileContext = this.#archiveApplicationContext('archive-import-file');
    const stored=this.#storeArchiveFileUseCase.execute(fileContext.correlationId,{sourcePath,itemId});
    if(!stored.ok) throw new Error(`[${stored.error.code}] ${stored.error.message}`);
    const command = {
      title: input.title.trim(),
      originalName: stored.value.originalName,
      storedName: stored.value.storedName,
      mimeType: stored.value.mimeType,
      sizeBytes: stored.value.sizeBytes,
      sha256: stored.value.sha256,
      ...(input.linkedEventId ? { linkedEventId: input.linkedEventId } : {})
    };
    const context = this.#archiveMutationContext(
      'archive.import',
      operationId,
      command,
      fileContext.correlationId
    );
    this.#assertArchiveOperationIdentity(context, {
      resourceType: 'archive_item',
      resourceId: itemId,
      action: 'create'
    });
    const result=await this.#importArchiveItemUseCase.execute({
      context,
      command,
      identifiers:{
        itemId,
        versionId:deterministicArchiveIdentifier(operationId, 'version'),
        auditId:deterministicArchiveIdentifier(operationId, 'audit'),
        outboxEventId:asEventId(deterministicArchiveIdentifier(operationId, 'outbox'))
      }
    });
    if(!result.ok){
      let safeToRemoveNewFile = false;
      try {
        safeToRemoveNewFile = !this.#assertArchiveOperationIdentity(context, {
          resourceType: 'archive_item',
          resourceId: itemId,
          action: 'create'
        });
      } catch {
        // Unknown database/commit state is fail-safe: preserve the encrypted file.
      }
      if (stored.value.createdNewFile && safeToRemoveNewFile) {
        this.#destroyArchiveFileUseCase.execute(context.correlationId,{storedName:stored.value.storedName,secureDestroy:false});
      }
      throw new Error(`[${result.error.code}] ${result.error.message}`);
    }
    return this.listArchive();
  }

  public async listLifeRecords(): Promise<LifeRecordView[]> {
    const result=await this.#listLifeRecordsUseCase.execute(this.#lifeApplicationContext('life-list'));
    if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public async createLifeRecord(input:CreateLifeRecordInput): Promise<LifeRecordView[]> {
    const visibleBeforeCommit = await this.listLifeRecords();
    const result=await this.#createLifeRecordUseCase.execute({context:this.#lifeApplicationContext('life-create'),command:input,identifiers:{recordId:randomUUID(),auditId:randomUUID(),outboxEventId:asEventId(randomUUID())}});
    if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [result.value, ...visibleBeforeCommit.filter((record) => record.id !== result.value.id)]
      .sort((left, right) => (
        (right.dueAt ?? right.startsAt ?? right.createdAt)
          .localeCompare(left.dueAt ?? left.startsAt ?? left.createdAt)
        || left.id.localeCompare(right.id)
      ));
  }

  public async getManagedLifeWorkspace(): Promise<ManagedLifeWorkspaceView> {
    const result = await this.#getManagedLifeWorkspaceUseCase.execute(
      this.#lifeApplicationContext('life-managed-workspace')
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async recordManagedLifeItem(
    input: RecordManagedLifeItemInput
  ): Promise<ManagedLifeWorkspaceView> {
    const result = await this.#recordManagedLifeItemUseCase.execute({
      context: this.#lifeApplicationContext('life-managed-record'),
      command: input,
      identifiers: {
        itemId: randomUUID(),
        auditId: randomUUID(),
        outboxEventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.getManagedLifeWorkspace();
  }

  public async getHouseholdOperationsCenter(): Promise<HouseholdOperationsCenterView> {
    const result = await this.#getHouseholdOperationsCenterUseCase.execute(
      this.#lifeApplicationContext('household-operations-center-get')
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async createHouseholdOperationItem(
    input: CreateHouseholdOperationItemInput
  ): Promise<HouseholdOperationMutationReceiptView> {
    const result = await this.#createHouseholdOperationItemUseCase.execute({
      context: this.#lifeApplicationContext('household-operation-item-create'),
      command: input
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async updateHouseholdOperationItem(
    input: UpdateHouseholdOperationItemInput
  ): Promise<HouseholdOperationMutationReceiptView> {
    const result = await this.#updateHouseholdOperationItemUseCase.execute({
      context: this.#lifeApplicationContext('household-operation-item-update'),
      command: input
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async deleteHouseholdOperationItem(
    input: DeleteHouseholdOperationItemInput
  ): Promise<HouseholdOperationMutationReceiptView> {
    const result = await this.#deleteHouseholdOperationItemUseCase.execute({
      context: this.#lifeApplicationContext('household-operation-item-delete'),
      command: input
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async getChildEducationCenter(childPersonId:string):Promise<ChildEducationCenterView>{
    const result=await this.#getChildEducationCenterUseCase.execute({
      context:this.#lifeApplicationContext('child-education-center-get'),childPersonId
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async createChildEducationItem(input:CreateChildEducationItemInput):Promise<ChildEducationMutationReceiptView>{
    const result=await this.#createChildEducationItemUseCase.execute({
      context:this.#lifeApplicationContext('child-education-item-create'),command:input
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async updateChildEducationItem(input:UpdateChildEducationItemInput):Promise<ChildEducationMutationReceiptView>{
    const result=await this.#updateChildEducationItemUseCase.execute({
      context:this.#lifeApplicationContext('child-education-item-update'),command:input
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async deleteChildEducationItem(input:DeleteChildEducationItemInput):Promise<ChildEducationMutationReceiptView>{
    const result=await this.#deleteChildEducationItemUseCase.execute({
      context:this.#lifeApplicationContext('child-education-item-delete'),command:input
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async getPlacesTravelCenter(ownerPersonId:string):Promise<PlacesTravelCenterView>{
    const result=await this.#getPlacesTravelCenterUseCase.execute({
      context:this.#lifeApplicationContext('places-travel-center-get'),ownerPersonId
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async createPlacesTravelItem(input:CreatePlacesTravelItemInput):Promise<PlacesTravelMutationReceiptView>{
    const result=await this.#createPlacesTravelItemUseCase.execute({
      context:this.#lifeApplicationContext('places-travel-item-create'),command:input
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async updatePlacesTravelItem(input:UpdatePlacesTravelItemInput):Promise<PlacesTravelMutationReceiptView>{
    const result=await this.#updatePlacesTravelItemUseCase.execute({
      context:this.#lifeApplicationContext('places-travel-item-update'),command:input
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async deletePlacesTravelItem(input:DeletePlacesTravelItemInput):Promise<PlacesTravelMutationReceiptView>{
    const result=await this.#deletePlacesTravelItemUseCase.execute({
      context:this.#lifeApplicationContext('places-travel-item-delete'),command:input
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async prepareEmergencyCardExport(input: {
    readonly profileId:string;
    readonly configurationId:string;
    readonly mode:'print'|'pdf'|'encrypted_pack';
    readonly selectedFieldIds:readonly string[];
    readonly documentLinkIds:readonly string[];
    readonly credentials:{ readonly password:string; readonly code?:string };
    readonly rendererSessionId:string;
    readonly operationId:string;
    readonly correlationId:string;
    readonly onStrongAuthenticationVerified?:()=>void;
  }): Promise<PreparedFamilyEmergencyCardExport> {
    const context:LifeApplicationContext = {
      ...this.#lifeApplicationContext('life-emergency-card-export'),
      correlationId:asCorrelationId(input.correlationId)
    };
    const verified = this.#strongAuthentication.verify(context, {
      password:input.credentials.password,
      ...(input.credentials.code ? { code:input.credentials.code } : {})
    });
    if (!verified.ok) throw new Error(`[${verified.error.code}] ${verified.error.message}`);
    const verifiedAt = this.#clock.now();
    input.onStrongAuthenticationVerified?.();
    const workspace = await this.#getManagedLifeWorkspaceUseCase.execute({
      ...context,
      correlationId:asCorrelationId(`life-emergency-card-selection-${randomUUID()}`)
    });
    if (!workspace.ok) throw new Error(`[${workspace.error.code}] ${workspace.error.message}`);
    const profile = workspace.value.emergencyAssistanceProfiles.find((candidate) => candidate.id === input.profileId);
    const configuration = profile?.cardConfigurations.find((candidate) => candidate.id === input.configurationId);
    if (!profile || !configuration || configuration.profileId !== profile.id) {
      throw new Error('[CORE_NOT_FOUND] Acil durum kartı yapılandırması görünür özel profilde bulunamadı.');
    }
    const selectedFields = input.selectedFieldIds.map((selectedFieldId) => {
      const selected = configuration.selectedFields.find((candidate) => candidate.id === selectedFieldId);
      if (!selected) throw new Error('[CORE_INVALID_ARGUMENT] Seçili acil durum kartı alanı yapılandırmada bulunamadı.');
      return Object.freeze({ selectedFieldId:selected.id, fieldCode:selected.fieldCode });
    });
    for (const documentLinkId of input.documentLinkIds) {
      if (!configuration.documentLinks.some((candidate) => candidate.id === documentLinkId)) {
        throw new Error('[CORE_INVALID_ARGUMENT] Seçili acil durum kartı belgesi yapılandırmada bulunamadı.');
      }
    }
    const selection = Object.freeze({
      selectedFields:Object.freeze(selectedFields),
      documentLinkIds:Object.freeze([...input.documentLinkIds])
    });
    const selectionSha256 = familyEmergencyCardSelectionSha256({
      profileId:profile.id,
      configurationId:configuration.id,
      mode:input.mode,
      selection
    });
    const authorizationProof = createFamilyEmergencyCardExportAuthorizationProof({
      rendererSessionId:input.rendererSessionId,
      operationId:input.operationId,
      correlationId:context.correlationId,
      profileId:profile.id,
      configurationId:configuration.id,
      mode:input.mode,
      selectionSha256,
      verifiedAt,
      expiresAt:asIsoDateTime(new Date(Date.parse(verifiedAt) + 60_000).toISOString())
    });
    const prepared = await this.#prepareFamilyEmergencyCardExportUseCase.execute({
      context,
      command:{
        profileId:profile.id,
        configurationId:configuration.id,
        mode:input.mode,
        rendererSessionId:input.rendererSessionId,
        operationId:input.operationId,
        selection
      },
      authorizationProof
    });
    if (!prepared.ok) throw new Error(`[${prepared.error.code}] ${prepared.error.message}`);
    return prepared.value;
  }

  public async completeEmergencyCardExport(
    prepared:PreparedFamilyEmergencyCardExport,
    command:Parameters<RecordFamilyEmergencyCardExportCompletionUseCase['execute']>[0]['command'],
    correlationId:string
  ): Promise<void> {
    const result = await this.#recordFamilyEmergencyCardExportCompletionUseCase.execute({
      context:{
        ...this.#lifeApplicationContext('life-emergency-card-export-completion'),
        correlationId:asCorrelationId(correlationId)
      },
      command,
      completionProof:prepared.completionProof,
      identifiers:{
        itemId:randomUUID(),
        auditId:randomUUID(),
        outboxEventId:asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
  }

  public async listFinanceRecords(): Promise<FinanceRecordView[]> {
    const result=await this.#listFinanceRecordsUseCase.execute(this.#financeApplicationContext('finance-list'));
    if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public async createFinanceRecord(input:CreateFinanceRecordInput): Promise<FinanceRecordView[]> {
    const result=await this.#createFinanceRecordUseCase.execute({context:this.#financeApplicationContext('finance-create'),command:input,identifiers:{recordId:randomUUID(),auditId:randomUUID(),outboxEventId:asEventId(randomUUID())}});
    if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listFinanceRecords();
  }

  public async listBankInstitutions(): Promise<BankInstitutionView[]> {
    const result = await this.#listBankInstitutionsUseCase.execute(this.#financeApplicationContext('bank-institution-list'));
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public async listBankAccounts(): Promise<BankAccountView[]> {
    const result = await this.#listBankAccountsUseCase.execute(this.#financeApplicationContext('bank-account-list'));
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public async validateIban(input: ValidateIbanInput): Promise<IbanStructuralValidationView> {
    const result = await this.#validateIbanUseCase.execute({
      context: this.#financeApplicationContext('iban-validate'),
      iban: input.iban
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async createBankAccount(input: CreateBankAccountInput): Promise<BankAccountView[]> {
    const result = await this.#createBankAccountUseCase.execute({
      context: this.#financeApplicationContext('bank-account-create'),
      command: input,
      identifiers: {
        accountId: `bank-account-${randomUUID()}`,
        auditId: randomUUID(),
        outboxEventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listBankAccounts();
  }

  public async listPaymentCards(): Promise<PaymentCardView[]> {
    const result = await this.#listPaymentCardsUseCase.execute(this.#financeApplicationContext('payment-card-list'));
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public async createPaymentCard(input: CreatePaymentCardInput): Promise<PaymentCardView[]> {
    const result = await this.#createPaymentCardUseCase.execute({
      context: this.#financeApplicationContext('payment-card-create'),
      command: input,
      identifiers: {
        cardId: `payment-card-${randomUUID()}`,
        auditId: randomUUID(),
        outboxEventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listPaymentCards();
  }

  public async listLoanAccounts(): Promise<LoanAccountView[]> {
    const result = await this.#listLoanAccountsUseCase.execute(this.#financeApplicationContext('loan-account-list'));
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public async createLoanAccount(input: CreateLoanAccountInput): Promise<LoanAccountView[]> {
    const result = await this.#createLoanAccountUseCase.execute({
      context: this.#financeApplicationContext('loan-account-create'),
      command: input,
      identifiers: {
        loanId: `loan-account-${randomUUID()}`,
        auditId: randomUUID(),
        outboxEventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listLoanAccounts();
  }

  public async recordLoanPayment(input: RecordLoanPaymentInput): Promise<LoanAccountView[]> {
    const result = await this.#recordLoanPaymentUseCase.execute({
      context: this.#financeApplicationContext('loan-payment-record'),
      command: input,
      identifiers: {
        paymentId: `loan-payment-${randomUUID()}`,
        auditId: randomUUID(),
        outboxEventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listLoanAccounts();
  }

  public async getFinancePlanningWorkspace(): Promise<FinancePlanningWorkspaceView> {
    const result = await this.#getFinancePlanningWorkspaceUseCase.execute(
      this.#financeApplicationContext('finance-planning-workspace')
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async recordFinancePlanningItem(
    input: RecordFinancePlanningItemInput
  ): Promise<FinancePlanningWorkspaceView> {
    const result = await this.#recordFinancePlanningItemUseCase.execute({
      context: this.#financeApplicationContext(`finance-planning-${input.itemType}`),
      command: input,
      identifiers: {
        itemId: `finance-planning-${input.itemType}-${randomUUID()}`,
        auditId: randomUUID(),
        outboxEventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.getFinancePlanningWorkspace();
  }

  public async commitFinanceImport(
    input: CommitFinanceImportPreparedBatchInput
  ): Promise<FinancePlanningWorkspaceView> {
    const context = this.#financeApplicationContext('finance-import-commit');
    const normalizeFingerprintText = (value?: string): string => value
      ? value.normalize('NFKC').trim().toLocaleLowerCase('tr-TR').replace(/\s+/gu, ' ')
      : '';
    const command: CommitFinanceImportBatchInput = {
      ...input,
      rows: input.rows.map((row) => {
        return {
          ...row,
          rowFingerprint: createHash('sha256').update(JSON.stringify({
            familyId: context.familyId,
            ownerPersonId: input.ownerPersonId,
            sourceFileSha256: input.fileSha256,
            sourceRowNumber: row.sourceRowNumber,
            occurredAt: row.occurredAt,
            direction: row.direction,
            amount: row.amount.toFixed(2),
            currency: row.currency,
            externalId: normalizeFingerprintText(row.externalId),
            description: normalizeFingerprintText(row.description)
          }), 'utf8').digest('hex')
        };
      })
    };
    const result = await this.#commitFinanceImportBatchUseCase.execute({
      context,
      command,
      identifiers: {
        batchId: `finance-import-batch-${randomUUID()}`,
        entryIds: command.rows.map(() => `finance-import-entry-${randomUUID()}`),
        auditId: randomUUID(),
        outboxEventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.getFinancePlanningWorkspace();
  }

  public async getLongTermPortfolioWorkspace():Promise<LongTermPortfolioWorkspaceView> {
    const result=await this.#getLongTermPortfolioWorkspaceUseCase.execute(
      this.#longTermPortfolioApplicationContext('long-term-portfolio-workspace')
    );
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async recordLongTermPortfolioItem(input:RecordLongTermPortfolioItemInput):Promise<LongTermPortfolioWorkspaceView> {
    const mutationId=`long-term-portfolio-mutation-${randomUUID()}`;
    const context=this.#longTermPortfolioApplicationContext(`long-term-portfolio-${input.itemType}`);
    const requestFingerprint=createHash('sha256').update(canonicalArchiveOperationValue({familyId:context.familyId,actorUserId:context.actor.userId,actorPersonId:context.actor.personId,input}),'utf8').digest('hex');
    const seed=input.itemType==='bootstrap_default'?buildDefaultLongTermPortfolioBootstrap():undefined;
    const allocationCount=input.itemType==='plan_version'?input.allocations.length:seed?.allocations.length??0;
    const identifiers={
      mutationId,
      requestFingerprint,
      ...(input.itemType==='bootstrap_default'?{
        portfolioId:`long-term-portfolio-${randomUUID()}`,
        instrumentIds:seed!.instruments.map(()=>`long-term-instrument-${randomUUID()}`),
        instrumentRevisionIds:seed!.instruments.map(()=>`long-term-instrument-revision-${randomUUID()}`),
        planVersionId:`long-term-plan-${randomUUID()}`,
        allocationIds:Array.from({length:allocationCount},()=>`long-term-allocation-${randomUUID()}`)
      }:{}),
      ...(input.itemType==='instrument_revision'?{
        instrumentId:input.instrumentId??`long-term-instrument-${randomUUID()}`,
        instrumentRevisionId:`long-term-instrument-revision-${randomUUID()}`
      }:{}),
      ...(input.itemType==='plan_version'?{
        planVersionId:`long-term-plan-${randomUUID()}`,
        allocationIds:Array.from({length:allocationCount},()=>`long-term-allocation-${randomUUID()}`)
      }:{}),
      ...(input.itemType==='ledger_event'?{ledgerEventId:`long-term-event-${randomUUID()}`}:{ }),
      ...(input.itemType==='price_observation'?{priceObservationId:`long-term-price-${randomUUID()}`}:{ }),
      auditId:randomUUID(),
      outboxEventId:asEventId(randomUUID())
    };
    const result=await this.#recordLongTermPortfolioItemUseCase.execute({
      context,command:input,identifiers
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.getLongTermPortfolioWorkspace();
  }

  public async getAccessibilityPreferences():Promise<AccessibilityPreferencesView> {
    const result=await this.#getAccessibilityPreferencesUseCase.execute(
      this.#accessibilityPreferencesApplicationContext('accessibility-preferences-read')
    );
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async updateAccessibilityPreferences(
    input:UpdateAccessibilityPreferencesInput
  ):Promise<AccessibilityPreferencesView> {
    const context=this.#accessibilityPreferencesApplicationContext('accessibility-preferences-update');
    const requestFingerprint=createHash('sha256').update(canonicalArchiveOperationValue({
      familyId:context.familyId,
      actorUserId:context.actor.userId,
      actorPersonId:context.actor.personId,
      input
    }),'utf8').digest('hex');
    const result=await this.#updateAccessibilityPreferencesUseCase.execute({
      context,
      command:input,
      identifiers:{
        mutationId:`accessibility-preferences-${randomUUID()}`,
        requestFingerprint,
        auditId:randomUUID(),
        outboxEventId:asEventId(randomUUID())
      }
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async getFormDraftWorkspace(formKey:string):Promise<FormDraftWorkspaceView> {
    const result=await this.#getFormDraftWorkspaceUseCase.execute({
      context:this.#formDraftApplicationContext('form-draft-workspace'),formKey
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async saveFormDraft(input:SaveFormDraftInput):Promise<FormDraftView> {
    const context=this.#formDraftApplicationContext('form-draft-save');
    const requestFingerprint=createHash('sha256').update(canonicalArchiveOperationValue({
      familyId:context.familyId,actorUserId:context.actor.userId,actorPersonId:context.actor.personId,input
    }),'utf8').digest('hex');
    const result=await this.#saveFormDraftUseCase.execute({context,command:input,identifiers:{
      mutationId:`form-draft-${randomUUID()}`,
      requestFingerprint,
      auditId:randomUUID(),outboxEventId:asEventId(randomUUID())
    }});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async undoFormDraft(input:UndoFormDraftInput):Promise<FormDraftView> {
    const context=this.#formDraftApplicationContext('form-draft-undo');
    const requestFingerprint=createHash('sha256').update(canonicalArchiveOperationValue({
      familyId:context.familyId,actorUserId:context.actor.userId,actorPersonId:context.actor.personId,input
    }),'utf8').digest('hex');
    const result=await this.#undoFormDraftUseCase.execute({context,command:input,identifiers:{
      mutationId:`form-draft-${randomUUID()}`,
      requestFingerprint,
      auditId:randomUUID(),outboxEventId:asEventId(randomUUID())
    }});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async listHealthRecords(): Promise<HealthRecordView[]> {
    const result = await this.#listHealthRecordsUseCase.execute(this.#healthApplicationContext('health-list'));
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public async createHealthRecord(input: CreateHealthRecordInput): Promise<HealthRecordView[]> {
    const visibleBeforeCommit = await this.listHealthRecords();
    const result = await this.#createHealthRecordUseCase.execute({
      context: this.#healthApplicationContext('health-create'),
      command: input,
      identifiers: {
        recordId: randomUUID(),
        auditId: randomUUID(),
        outboxEventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [result.value, ...visibleBeforeCommit.filter((record) => record.id !== result.value.id)]
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || left.id.localeCompare(right.id));
  }

  public async listMedicationPlans(): Promise<MedicationPlanView[]> {
    const result = await this.#listMedicationPlansUseCase.execute(this.#healthApplicationContext('medication-list'));
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public async createMedicationPlan(input: CreateMedicationPlanInput): Promise<MedicationPlanView[]> {
    const visibleBeforeCommit = await this.listMedicationPlans();
    const result = await this.#createMedicationPlanUseCase.execute({
      context: this.#healthApplicationContext('medication-create'),
      command: input,
      identifiers: {
        recordId: randomUUID(),
        auditId: randomUUID(),
        outboxEventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [result.value, ...visibleBeforeCommit.filter((plan) => plan.id !== result.value.id)]
      .sort((left, right) => right.startsAt.localeCompare(left.startsAt) || left.id.localeCompare(right.id));
  }

  public async listFamilyHealthHistory(): Promise<FamilyHealthHistoryView[]> {
    const result = await this.#listFamilyHealthHistoryUseCase.execute(this.#healthApplicationContext('family-health-history-list'));
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public async createFamilyHealthHistory(input: CreateFamilyHealthHistoryInput): Promise<FamilyHealthHistoryView[]> {
    const visibleBeforeCommit = await this.listFamilyHealthHistory();
    const result = await this.#createFamilyHealthHistoryUseCase.execute({
      context: this.#healthApplicationContext('family-health-history-create'),
      command: input,
      identifiers: {
        recordId: randomUUID(),
        auditId: randomUUID(),
        outboxEventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [result.value, ...visibleBeforeCommit.filter((record) => record.id !== result.value.id)]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
  }

  public async getHealthCareCoordinationCenter(
    ownerPersonId: string
  ): Promise<HealthCareCoordinationCenterView> {
    const result = await this.#getHealthCareCoordinationCenterUseCase.execute({
      context: this.#healthApplicationContext('health-care-center-get'),
      ownerPersonId
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async recordHealthCareEntry(
    input: RecordHealthCareEntryInput
  ): Promise<HealthCareMutationReceiptView> {
    const context = this.#healthApplicationContext('health-care-entry-record');
    const requestFingerprint = createHash('sha256').update(canonicalArchiveOperationValue({
      familyId: context.familyId,
      actorAccountId: context.actor.userId,
      actorPersonId: context.actor.personId,
      input
    }), 'utf8').digest('hex');
    const identity = createHash('sha256').update(
      `${context.familyId}\u0000${context.actor.userId}\u0000${input.clientOperationId}`,
      'utf8'
    ).digest('hex');
    const result = await this.#recordHealthCareEntryUseCase.execute({
      context,
      command: input,
      identifiers: {
        mutationId: `health-care-mutation:${identity}`,
        targetId: `health-care-entry:${identity}`,
        requestFingerprint,
        auditId: `health-care-audit:${identity}`,
        outboxEventId: asEventId(`health-care-event:${identity}`)
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async upsertHealthCareAccessGrant(
    input: UpsertHealthCareAccessGrantInput
  ): Promise<HealthCareMutationReceiptView> {
    const context = this.#healthApplicationContext('health-care-grant-upsert');
    const requestFingerprint = createHash('sha256').update(canonicalArchiveOperationValue({
      familyId: context.familyId,
      actorAccountId: context.actor.userId,
      actorPersonId: context.actor.personId,
      input
    }), 'utf8').digest('hex');
    const identity = createHash('sha256').update(
      `${context.familyId}\u0000${context.actor.userId}\u0000${input.clientOperationId}`,
      'utf8'
    ).digest('hex');
    const result = await this.#upsertHealthCareAccessGrantUseCase.execute({
      context,
      command: input,
      identifiers: {
        mutationId: `health-care-mutation:${identity}`,
        requestFingerprint,
        auditId: `health-care-audit:${identity}`,
        outboxEventId: asEventId(`health-care-event:${identity}`)
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async revokeHealthCareAccessGrant(
    input: RevokeHealthCareAccessGrantInput
  ): Promise<HealthCareMutationReceiptView> {
    const context = this.#healthApplicationContext('health-care-grant-revoke');
    const requestFingerprint = createHash('sha256').update(canonicalArchiveOperationValue({
      familyId: context.familyId,
      actorAccountId: context.actor.userId,
      actorPersonId: context.actor.personId,
      input
    }), 'utf8').digest('hex');
    const identity = createHash('sha256').update(
      `${context.familyId}\u0000${context.actor.userId}\u0000${input.clientOperationId}`,
      'utf8'
    ).digest('hex');
    const result = await this.#revokeHealthCareAccessGrantUseCase.execute({
      context,
      command: input,
      identifiers: {
        mutationId: `health-care-mutation:${identity}`,
        requestFingerprint,
        auditId: `health-care-audit:${identity}`,
        outboxEventId: asEventId(`health-care-event:${identity}`)
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }


  public async listFinanceValuations(): Promise<FinanceValuationView[]> {
    const result=await this.#listFinanceValuationsUseCase.execute(this.#financeApplicationContext('finance-valuations-list'));
    if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public async createFinanceValuation(input:CreateFinanceValuationInput): Promise<FinanceValuationView[]> {
    const result=await this.#createFinanceValuationUseCase.execute({context:this.#financeApplicationContext('finance-valuation-create'),command:input,identifiers:{valuationId:randomUUID(),auditId:randomUUID(),outboxEventId:asEventId(randomUUID())}});
    if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listFinanceValuations();
  }

  public listDataRetentionPolicies():DataRetentionPolicyView[] {
    const result=this.#listDataRetentionPoliciesUseCase.execute(this.#dataLifecycleApplicationContext('data-retention-policy-list'));
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public listDataLifecycleRecords():DataLifecycleRecordView[] {
    const result=this.#listDataLifecycleRecordsUseCase.execute(this.#dataLifecycleApplicationContext('data-lifecycle-list'));
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public createDataRetentionPolicy(input:CreateDataRetentionPolicyInput):DataRetentionPolicyView[] {
    const result=this.#createDataRetentionPolicyUseCase.execute({context:this.#dataLifecycleApplicationContext('data-retention-policy-create'),command:input,identifiers:{policyId:randomUUID(),auditId:randomUUID()}});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listDataRetentionPolicies();
  }

  public archiveDataResource(input:ArchiveDataResourceInput):DataLifecycleRecordView[] {
    const result=this.#archiveDataResourceUseCase.execute({context:this.#dataLifecycleApplicationContext('data-resource-archive'),command:input,identifiers:{auditId:randomUUID(),outboxEventId:asEventId(randomUUID())}});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listDataLifecycleRecords();
  }

  public restoreDataResource(input:RestoreDataResourceInput):DataLifecycleRecordView[] {
    const result=this.#restoreDataResourceUseCase.execute({context:this.#dataLifecycleApplicationContext('data-resource-restore'),command:input,identifiers:{auditId:randomUUID(),outboxEventId:asEventId(randomUUID())}});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listDataLifecycleRecords();
  }

  public requestDataPurge(input:RequestDataPurgeInput):DataLifecycleRecordView[] {
    const result=this.#requestDataPurgeUseCase.execute({context:this.#dataLifecycleApplicationContext('data-purge-request'),command:input,identifiers:{auditId:randomUUID()}});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listDataLifecycleRecords();
  }

  public cancelDataPurge(input:CancelDataPurgeInput):DataLifecycleRecordView[] {
    const result=this.#cancelDataPurgeUseCase.execute({context:this.#dataLifecycleApplicationContext('data-purge-cancel'),command:input,identifiers:{auditId:randomUUID()}});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listDataLifecycleRecords();
  }

  public executeDataPurge(input:ExecuteDataPurgeInput):DataLifecycleRecordView[] {
    const result=this.#executeDataPurgeUseCase.execute({context:this.#dataLifecycleApplicationContext('data-purge-execute'),command:input,identifiers:{auditId:randomUUID(),outboxEventId:asEventId(randomUUID())}});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    const checkpoint=this.runMaintenance('wal_checkpoint','manual');
    if(!checkpoint.success)this.recordDiagnostic('warning','data.purge_wal_checkpoint_failed','Kalıcı imha tamamlandı ancak WAL temizliği başarısız oldu.',checkpoint.message);
    this.enqueueTask({taskType:'backup.propagation',label:'Kalıcı imhayı yönetilen yedeklere uygula',priority:'critical',maxAttempts:3,payload:JSON.stringify({resourceType:input.resourceType,resourceId:input.resourceId})});
    return this.listDataLifecycleRecords();
  }

  public setDataLegalHold(input:SetDataLegalHoldInput):DataLifecycleRecordView[] {
    const result=this.#setDataLegalHoldUseCase.execute({context:this.#dataLifecycleApplicationContext('data-legal-hold'),command:input,identifiers:{auditId:randomUUID()}});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listDataLifecycleRecords();
  }

  #reconcileBackupQuarantineBatches():void {
    const propagationContext=this.#backupPropagationApplicationContext('backup-quarantine-reconcile-runs');
    const runs=this.#listBackupPropagationRunsUseCase.execute(propagationContext,500);
    if(!runs.ok)throw new Error(`[${runs.error.code}] ${runs.error.message}`);
    const context=this.#backupQuarantineApplicationContext('backup-quarantine-reconcile');
    for(const run of runs.value){
      for(const target of run.targetResults){
        if(target.quarantinedArtifacts<1||!target.quarantineDirectory||!target.quarantineManifestPath)continue;
        const id=`quarantine-${createHash('sha256').update(`${run.id}\0${target.targetId}`,'utf8').digest('hex').slice(0,32)}`;
        const registered=this.#registerBackupQuarantineBatchUseCase.execute(context,{id,propagationRunId:run.id,targetId:target.targetId,targetName:target.targetName,quarantineDirectory:target.quarantineDirectory,manifestPath:target.quarantineManifestPath,quarantinedArtifacts:target.quarantinedArtifacts,quarantinedAt:run.completedAt});
        if(!registered.ok)throw new Error(`[${registered.error.code}] ${registered.error.message}`);
      }
    }
  }

  public getBackupQuarantinePolicy():BackupQuarantinePolicyView {
    const result=this.#getBackupQuarantinePolicyUseCase.execute(this.#backupQuarantineApplicationContext('backup-quarantine-policy-get'));
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public listBackupQuarantineBatches(limit=100):BackupQuarantineBatchView[] {
    this.#reconcileBackupQuarantineBatches();
    const result=this.#listBackupQuarantineBatchesUseCase.execute(this.#backupQuarantineApplicationContext('backup-quarantine-list'),limit);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public updateBackupQuarantinePolicy(input:UpdateBackupQuarantinePolicyInput):BackupQuarantinePolicyView {
    const occurredAt=nowIso();
    const result=this.#updateBackupQuarantinePolicyUseCase.execute(this.#backupQuarantineApplicationContext('backup-quarantine-policy-update'),input,occurredAt);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    this.#writeAudit('backup.quarantine_policy_updated','backup_quarantine_policy','default',occurredAt);
    return result.value;
  }

  public setBackupQuarantineLegalHold(input:SetBackupQuarantineLegalHoldInput):BackupQuarantineBatchView[] {
    const occurredAt=nowIso();
    const result=this.#setBackupQuarantineLegalHoldUseCase.execute(this.#backupQuarantineApplicationContext('backup-quarantine-hold'),input,occurredAt);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    this.#writeAudit(input.enabled?'backup.quarantine_hold_enabled':'backup.quarantine_hold_disabled','backup_quarantine_batch',input.batchId,occurredAt);
    return this.listBackupQuarantineBatches();
  }

  public destroyBackupQuarantineBatch(input:DestroyBackupQuarantineBatchInput):BackupQuarantineDestructionResultView {
    const occurredAt=nowIso();
    const result=this.#destroyBackupQuarantineBatchUseCase.execute(this.#backupQuarantineApplicationContext('backup-quarantine-destroy'),input,occurredAt);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    this.#writeAudit('backup.quarantine_destroyed','backup_quarantine_batch',input.batchId,occurredAt);
    this.recordDiagnostic('info','backup.quarantine_destroyed',`${result.value.destroyedArtifacts} karantina yedeği nihai imha edildi.`,`Silinen yaklaşık veri: ${result.value.destroyedBytes} bayt; devam ettirilen işlem: ${result.value.resumed?'evet':'hayır'}`);
    return result.value;
  }

  public listExternalBackupCopies(limit=100):ExternalBackupCopyView[] {
    const result=this.#listExternalBackupCopiesUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-list'),limit);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public getExternalBackupInventorySummary():ExternalBackupInventorySummaryView {
    const result=this.#getExternalBackupInventorySummaryUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-summary'),nowIso());
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public registerExternalBackupCopy(input:RegisterExternalBackupCopyInput):ExternalBackupCopyView[] {
    const occurredAt=nowIso();
    const copyId=`external-backup-${randomUUID()}`;
    const result=this.#registerExternalBackupCopyUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-register'),input,{copyId,attestationId:randomUUID()},occurredAt);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    this.#writeAudit('backup.external_copy_registered','external_backup_copy',copyId,occurredAt);
    return this.listExternalBackupCopies();
  }

  public reviewExternalBackupCopy(input:ReviewExternalBackupCopyInput):ExternalBackupCopyView[] {
    const occurredAt=nowIso();
    const result=this.#reviewExternalBackupCopyUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-review'),input,randomUUID(),occurredAt);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    this.#writeAudit('backup.external_copy_reviewed','external_backup_copy',input.id,occurredAt);
    return this.listExternalBackupCopies();
  }

  public setExternalBackupCopyLegalHold(input:SetExternalBackupCopyLegalHoldInput):ExternalBackupCopyView[] {
    const occurredAt=nowIso();
    const result=this.#setExternalBackupCopyLegalHoldUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-hold'),input,randomUUID(),occurredAt);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    this.#writeAudit(input.enabled?'backup.external_copy_hold_enabled':'backup.external_copy_hold_disabled','external_backup_copy',input.id,occurredAt);
    return this.listExternalBackupCopies();
  }

  public attestExternalBackupCopyDestroyed(input:AttestExternalBackupCopyDestroyedInput):ExternalBackupCopyView[] {
    const occurredAt=nowIso();
    const result=this.#attestExternalBackupCopyDestroyedUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-destroyed-attestation'),input,randomUUID(),occurredAt);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    this.#writeAudit('backup.external_copy_destroyed_attested','external_backup_copy',input.id,occurredAt);
    this.recordDiagnostic('warning','backup.external_copy_destroyed_attested','Uygulama dışı yedek için kullanıcı imha teyidi kaydedildi.','Bu kayıt otomatik fiziksel imha kanıtı değildir; kullanıcı beyanı ve isteğe bağlı SHA-256 kanıtı olarak tutulur.');
    return this.listExternalBackupCopies();
  }


  public listExternalBackupEvidenceIssuers(limit=100):ExternalBackupEvidenceIssuerView[] {
    const result=this.#listExternalBackupEvidenceIssuersUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-evidence-issuer-list'),limit);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public listExternalBackupEvidenceIssuerRotations(limit=100):ExternalBackupEvidenceIssuerRotationView[] {
    const result=this.#listExternalBackupEvidenceIssuerRotationsUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-evidence-rotation-list'),limit);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public listExternalBackupEvidenceRevocationLists(limit=100):ExternalBackupEvidenceRevocationListView[] {
    const result=this.#listExternalBackupEvidenceRevocationListsUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-revocation-list-list'),limit);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public applyExternalBackupEvidenceRevocationList(input:ApplyExternalBackupEvidenceRevocationListInput):{lists:ExternalBackupEvidenceRevocationListView[];issuers:ExternalBackupEvidenceIssuerView[]} {
    const occurredAt=nowIso();
    const result=this.#applyExternalBackupEvidenceRevocationListUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-revocation-list-apply'),input,{list:randomUUID(),entries:input.entries.map(()=>randomUUID())},occurredAt);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    this.#writeAudit('backup.external_evidence_revocation_list_applied','external_backup_evidence_revocation_list',result.value.id,occurredAt);
    this.recordDiagnostic('warning','backup.external_evidence_revocation_list_applied','İmzalı sağlayıcı iptal listesi uygulandı.',`${result.value.listId} / sıra ${result.value.sequenceNumber} / ${result.value.entries.length} anahtar`);
    return {lists:this.listExternalBackupEvidenceRevocationLists(),issuers:this.listExternalBackupEvidenceIssuers()};
  }

  public listExternalBackupRevocationEndpoints(limit=100):ExternalBackupRevocationEndpointView[] {
    const result=this.#listExternalBackupRevocationEndpointsUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-revocation-endpoint-list'),limit);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public getExternalBackupRevocationEndpoint(id:string):ExternalBackupRevocationEndpointView {
    const result=this.#findExternalBackupRevocationEndpointUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-revocation-endpoint-get'),id);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public upsertExternalBackupRevocationEndpoint(input:UpsertExternalBackupRevocationEndpointInput):ExternalBackupRevocationEndpointView[] {
    const occurredAt=nowIso();
    const result=this.#upsertExternalBackupRevocationEndpointUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-revocation-endpoint-upsert'),input,randomUUID(),occurredAt);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    this.#writeAudit('backup.external_revocation_endpoint_upserted','external_backup_revocation_endpoint',result.value.id,occurredAt);
    return this.listExternalBackupRevocationEndpoints();
  }

  public recordExternalBackupRevocationEndpointFetch(id:string,status:'success'|'failed',error?:string,at=nowIso()):void {
    const result=this.#recordExternalBackupRevocationEndpointFetchUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-revocation-endpoint-fetch-record'),{id,fetchedAt:at,status,...(error?{error:error.slice(0,1000)}:{})});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
  }

  public listExternalBackupDestructionEvidence(copyId?:string,limit=100):ExternalBackupDestructionEvidenceView[] {
    const result=this.#listExternalBackupDestructionEvidenceUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-evidence-list'),copyId,limit);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public registerExternalBackupEvidenceIssuer(input:RegisterExternalBackupEvidenceIssuerInput):ExternalBackupEvidenceIssuerView[] {
    const occurredAt=nowIso();
    const result=this.#registerExternalBackupEvidenceIssuerUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-evidence-issuer-register'),input,randomUUID(),occurredAt);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    this.#writeAudit('backup.external_evidence_issuer_registered','external_backup_evidence_issuer',result.value.id,occurredAt);
    return this.listExternalBackupEvidenceIssuers();
  }

  public rotateExternalBackupEvidenceIssuer(input:RotateExternalBackupEvidenceIssuerInput):{issuers:ExternalBackupEvidenceIssuerView[];rotations:ExternalBackupEvidenceIssuerRotationView[]} {
    const occurredAt=nowIso();
    const result=this.#rotateExternalBackupEvidenceIssuerUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-evidence-issuer-rotate'),input,{successor:randomUUID(),rotation:randomUUID(),predecessorEvent:randomUUID(),successorEvent:randomUUID()},occurredAt);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    this.#writeAudit('backup.external_evidence_issuer_rotated','external_backup_evidence_issuer',result.value.successor.id,occurredAt);
    this.recordDiagnostic('info','backup.external_evidence_issuer_rotated','İmzalı imha kanıtı sağlayıcısının anahtarı döndürüldü.',`${result.value.predecessor.id} -> ${result.value.successor.id}`);
    return {issuers:this.listExternalBackupEvidenceIssuers(),rotations:this.listExternalBackupEvidenceIssuerRotations()};
  }

  public revokeExternalBackupEvidenceIssuer(input:RevokeExternalBackupEvidenceIssuerInput):ExternalBackupEvidenceIssuerView[] {
    const occurredAt=nowIso();
    const result=this.#revokeExternalBackupEvidenceIssuerUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-evidence-issuer-revoke'),input,occurredAt);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    this.#writeAudit('backup.external_evidence_issuer_revoked','external_backup_evidence_issuer',input.id,occurredAt);
    this.recordDiagnostic('warning','backup.external_evidence_issuer_revoked','İmzalı imha kanıtı sağlayıcısının güven anahtarı iptal edildi.',input.reason);
    return this.listExternalBackupEvidenceIssuers();
  }

  public verifyExternalBackupDestructionEvidence(input:VerifyExternalBackupDestructionEvidenceInput):{copies:ExternalBackupCopyView[];evidence:ExternalBackupDestructionEvidenceView[]} {
    const occurredAt=nowIso();
    const result=this.#verifyExternalBackupDestructionEvidenceUseCase.execute(this.#externalBackupInventoryApplicationContext('external-backup-signed-destruction-evidence'),input,randomUUID(),occurredAt);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    this.#writeAudit('backup.external_signed_destruction_evidence_verified','external_backup_copy',input.copyId,occurredAt);
    return {copies:this.listExternalBackupCopies(),evidence:this.listExternalBackupDestructionEvidence(input.copyId)};
  }

  #automationApplicationContext(prefix:string):AutomationApplicationContext {
    const actorId = asUserId(this.#requireAuth());
    const account = this.#currentAccount();
    return {
      actorId,
      actorRole: account.role,
      familyId: asFamilyId('family-main'),
      ...(account.personId ? { actorPersonId: asPersonId(account.personId) } : {}),
      correlationId: this.#correlation?.current()?.correlationId
        ?? asCorrelationId(`${prefix}-${randomUUID()}`),
      occurredAt: asIsoDateTime(nowIso())
    };
  }

  public async listAutomationRules(): Promise<AutomationRuleView[]> { const r=await this.#listAutomationRulesUseCase.execute(this.#automationApplicationContext('automation-list')); if(!r.ok) throw new Error(`[${r.error.code}] ${r.error.message}`); return [...r.value]; }

  public async createAutomationRule(input: CreateAutomationRuleInput): Promise<AutomationRuleView[]> { const c=this.#automationApplicationContext('automation-create'); const id=randomUUID(); const r=await this.#createAutomationRuleUseCase.execute(c,input,id); if(!r.ok) throw new Error(`[${r.error.code}] ${r.error.message}`); this.#writeAudit('automation.created','automation_rule',id,c.occurredAt); return await this.listAutomationRules(); }

  public async toggleAutomationRule(id:string, enabled:boolean): Promise<AutomationRuleView[]> { const c=this.#automationApplicationContext('automation-toggle'); const r=await this.#toggleAutomationRuleUseCase.execute(c,id,enabled); if(!r.ok) throw new Error(`[${r.error.code}] ${r.error.message}`); this.#writeAudit(enabled?'automation.enabled':'automation.disabled','automation_rule',id,c.occurredAt); return await this.listAutomationRules(); }


  public async runAutomationRules(input:RunAutomationInput={}): Promise<AutomationRunView[]> {
    const c=this.#automationApplicationContext('automation-run');
    const r=await this.#runAutomationRulesUseCase.execute(c,input.now,{nextRunId:()=>randomUUID(),nextTaskId:()=>randomUUID(),nextAuditId:()=>randomUUID()});
    if(!r.ok) throw new Error(`[${r.error.code}] ${r.error.message}`);
    return await this.listAutomationRuns();
  }

  public async listAutomationRuns():Promise<AutomationRunView[]>{ const r=await this.#listAutomationRunsUseCase.execute(this.#automationApplicationContext('automation-runs'),100); if(!r.ok) throw new Error(`[${r.error.code}] ${r.error.message}`); return [...r.value]; }

  public listDigitalLegacyPlans():DigitalLegacyPlanView[]{ const r=this.#listDigitalLegacyPlansUseCase.execute(this.#legacyApplicationContext('list')); if(!r.ok) throw new Error(`[${r.error.code}] ${r.error.message}`); return [...r.value]; }
  public upsertDigitalLegacyPlan(input:UpsertDigitalLegacyPlanInput):DigitalLegacyPlanView[]{ const c=this.#legacyApplicationContext('upsert-plan'); const r=this.#upsertDigitalLegacyPlanUseCase.execute({context:c,command:input,identifiers:{planId:randomUUID(),auditId:randomUUID(),outboxEventId:asEventId(randomUUID())}}); if(!r.ok) throw new Error(`[${r.error.code}] ${r.error.message}`); return this.listDigitalLegacyPlans(); }
  public listLegacyGrants(planId?:string):LegacyGrantView[]{ const r=this.#listLegacyGrantsUseCase.execute(this.#legacyApplicationContext('list-grants'),planId); if(!r.ok) throw new Error(`[${r.error.code}] ${r.error.message}`); return [...r.value]; }
  public upsertLegacyGrant(input:UpsertLegacyGrantInput):LegacyGrantView[]{ const c=this.#legacyApplicationContext('upsert-grant'); const r=this.#upsertLegacyGrantUseCase.execute({context:c,command:input,identifiers:{grantId:randomUUID(),auditId:randomUUID(),outboxEventId:asEventId(randomUUID())}}); if(!r.ok) throw new Error(`[${r.error.code}] ${r.error.message}`); return this.listLegacyGrants(input.planId); }
  public listLegacyApprovals(planId:string):LegacyApprovalView[]{ const r=this.#listLegacyApprovalsUseCase.execute(this.#legacyApplicationContext('list-approvals'),planId); if(!r.ok) throw new Error(`[${r.error.code}] ${r.error.message}`); return [...r.value]; }
  public executeDigitalLegacyPlan(input:ExecuteLegacyPlanInput):DigitalLegacyPlanView[]{ const c=this.#legacyApplicationContext('request'); const r=this.#requestLegacyExecutionUseCase.execute({context:c,command:input,identifiers:{approvalId:randomUUID(),auditId:randomUUID(),outboxEventId:asEventId(randomUUID())}}); if(!r.ok) throw new Error(`[${r.error.code}] ${r.error.message}`); return this.listDigitalLegacyPlans(); }
  public approveLegacyExecution(input:ApproveLegacyExecutionInput):DigitalLegacyPlanView[]{ const c=this.#legacyApplicationContext('approve'); const r=this.#approveLegacyExecutionUseCase.execute({context:c,command:input,identifiers:{approvalId:randomUUID(),auditId:randomUUID(),outboxEventId:asEventId(randomUUID())}}); if(!r.ok) throw new Error(`[${r.error.code}] ${r.error.message}`); return this.listDigitalLegacyPlans(); }
  public finalizeLegacyExecution(planId:string):DigitalLegacyPlanView[]{ const c=this.#legacyApplicationContext('finalize'); const grants=this.listLegacyGrants(planId); const r=this.#finalizeLegacyExecutionUseCase.execute({context:c,planId,identifiers:{permissionIds:grants.map(()=>randomUUID()),auditId:randomUUID(),outboxEventId:asEventId(randomUUID())}}); if(!r.ok) throw new Error(`[${r.error.code}] ${r.error.message}`); return this.listDigitalLegacyPlans(); }
  public cancelLegacyExecution(input:CancelLegacyExecutionInput):DigitalLegacyPlanView[]{ const c=this.#legacyApplicationContext('cancel'); const r=this.#cancelLegacyExecutionUseCase.execute({context:c,command:input,identifiers:{auditId:randomUUID(),outboxEventId:asEventId(randomUUID())}}); if(!r.ok) throw new Error(`[${r.error.code}] ${r.error.message}`); return this.listDigitalLegacyPlans(); }

  #reportApplicationContext(prefix:string):ReportApplicationContext {
    const actorId = asUserId(this.#requireAuth());
    const account = this.#currentAccount();
    return {
      actorId,
      actorRole: account.role,
      familyId: asFamilyId('family-main'),
      ...(account.personId ? { actorPersonId: asPersonId(account.personId) } : {}),
      correlationId: this.#correlation?.current()?.correlationId
        ?? asCorrelationId(`${prefix}-${randomUUID()}`),
      occurredAt: asIsoDateTime(nowIso())
    };
  }
  #auditReadApplicationContext(prefix:string):AuditReadApplicationContext { return {actorId:asUserId(this.#requireAuth()),correlationId:this.#correlation?.current()?.correlationId??asCorrelationId(`${prefix}-${randomUUID()}`),occurredAt:asIsoDateTime(nowIso())}; }
  #auditWriteApplicationContext(prefix:string,occurredAt:string):AuditWriteApplicationContext { return {actorId:asUserId(this.#sessionManager.currentAccountId({touch:false})??''),correlationId:this.#correlation?.current()?.correlationId??asCorrelationId(`${prefix}-${randomUUID()}`),occurredAt:asIsoDateTime(occurredAt)}; }

  public async getReportSummary(): Promise<ReportSummaryView> { const result=await this.#getReportSummaryUseCase.execute(this.#reportApplicationContext('report-summary')); if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`); return result.value; }

  public getGenealogyInsights(): GenealogyInsightView {
    const context = this.#familyApplicationContext('genealogy');
    const result = this.#getGenealogyReadModelUseCase.execute({
      familyId: context.familyId,
      correlationId: context.correlationId
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public listLargeGenealogyTree(input: GenealogyTreePageInput = {}): GenealogyTreePageView {
    this.#requireAuth();
    return this.#largeFamilyReadModelService.listTreePage(input);
  }

  public async listLargeTimeline(input: TimelinePageInput = {}): Promise<TimelinePageView> {
    this.#requireAuth();
    return await this.#largeFamilyReadModelService.listTimelinePage(input);
  }

  public listLargeArchive(input: ArchivePageInput = {}): ArchivePageView {
    this.#requireAuth();
    return this.#largeFamilyReadModelService.listArchivePage(input);
  }

  public async reattestLegacyArchiveOwnership(input:ReattestLegacyArchiveOwnershipInput):Promise<LegacyArchiveOwnershipReattestationView> {
    const itemId=input.itemId.trim();
    const context=this.#legacyArchiveOwnershipReattestationContext(itemId);
    if(input.confirmation!==archiveLegacyOwnershipReattestationConfirmation(itemId))throw new Error('Eski arşiv sahipliği onay metni birebir eşleşmelidir.');
    const operationId=context.operationId!;
    const result=await this.#reattestLegacyArchiveOwnershipUseCase.execute({
      context,
      command:{itemId,password:input.password,...(input.code?{code:input.code}:{}),confirmation:input.confirmation},
      identifiers:{auditId:deterministicArchiveIdentifier(operationId,'audit'),outboxEventId:asEventId(deterministicArchiveIdentifier(operationId,'outbox'))}
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public listPersonCatalog(input: PersonCatalogPageInput = {}): PersonCatalogPageView {
    this.#requireAuth();
    return this.#entityCatalogService.listPeople(input);
  }

  public listEventCatalog(input: EventCatalogPageInput = {}): EventCatalogPageView {
    this.#requireAuth();
    return this.#entityCatalogService.listEvents(input);
  }

  public lookupEntityCatalog(input: EntityCatalogLookupInput = {}): EntityCatalogLookupView {
    this.#requireAuth();
    return this.#entityCatalogService.lookup(input);
  }

  public async getLocalGovernedOcrCenter(): Promise<LocalGovernedOcrCenterView> {
    const result = await this.#getLocalGovernedOcrCenterUseCase.execute(
      this.#localGovernedOcrApplicationContext('local-ocr-center')
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async getLocalGovernedOcrResult(
    input: { readonly jobId: string }
  ): Promise<LocalGovernedOcrResultView> {
    const context = this.#localGovernedOcrApplicationContext('local-ocr-result-read');
    const result = await this.#getLocalGovernedOcrResultUseCase.execute({
      context,
      jobId: input.jobId,
      auditId: randomUUID()
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async searchLocalGovernedOcr(input: SearchLocalGovernedOcrInput): Promise<LocalGovernedOcrSearchView> {
    const result = await this.#searchLocalGovernedOcrUseCase.execute({
      context: this.#localGovernedOcrApplicationContext('local-ocr-search'),
      command: input,
      auditId: randomUUID()
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async createLocalGovernedOcrJob(
    input: CreateLocalGovernedOcrJobInput
  ): Promise<LocalGovernedOcrMutationReceiptView> {
    const context = this.#localGovernedOcrApplicationContext('local-ocr-job-create');
    const resourceId = localGovernedOcrJobId(context, input.clientOperationId);
    const result = await this.#createLocalGovernedOcrJobUseCase.execute({
      context,
      command: input,
      identifiers: localGovernedOcrMutationIdentifiers(
        context,
        input.clientOperationId,
        resourceId,
        'job_create',
        input
      )
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async runLocalGovernedOcrJob(
    input: RunLocalGovernedOcrJobInput
  ): Promise<LocalGovernedOcrMutationReceiptView> {
    const context = this.#localGovernedOcrApplicationContext('local-ocr-job-run');
    const result = await this.#runLocalGovernedOcrJobUseCase.execute({
      context,
      command: input,
      identifiers: localGovernedOcrMutationIdentifiers(
        context, input.clientOperationId, input.jobId, 'job_run', input
      )
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async cancelLocalGovernedOcrJob(
    input: CancelLocalGovernedOcrJobInput
  ): Promise<LocalGovernedOcrMutationReceiptView> {
    const context = this.#localGovernedOcrApplicationContext('local-ocr-job-cancel');
    const result = await this.#cancelLocalGovernedOcrJobUseCase.execute({
      context,
      command: input,
      identifiers: localGovernedOcrMutationIdentifiers(
        context, input.clientOperationId, input.jobId, 'job_cancel', input
      )
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async correctLocalGovernedOcrResult(
    input: CorrectLocalGovernedOcrResultInput
  ): Promise<LocalGovernedOcrMutationReceiptView> {
    const context = this.#localGovernedOcrApplicationContext('local-ocr-result-correct');
    const result = await this.#correctLocalGovernedOcrResultUseCase.execute({
      context,
      command: input,
      identifiers: localGovernedOcrMutationIdentifiers(
        context, input.clientOperationId, input.jobId, 'result_correct', input
      )
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async rerunLocalGovernedOcrJob(
    input: RerunLocalGovernedOcrJobInput
  ): Promise<LocalGovernedOcrMutationReceiptView> {
    const context = this.#localGovernedOcrApplicationContext('local-ocr-job-rerun');
    const result = await this.#rerunLocalGovernedOcrJobUseCase.execute({
      context,
      command: input,
      identifiers: localGovernedOcrMutationIdentifiers(
        context, input.clientOperationId, input.jobId, 'job_rerun', input
      )
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async deleteLocalGovernedOcrJob(
    input: DeleteLocalGovernedOcrJobInput
  ): Promise<LocalGovernedOcrMutationReceiptView> {
    const context = this.#localGovernedOcrApplicationContext('local-ocr-job-delete');
    const result = await this.#deleteLocalGovernedOcrJobUseCase.execute({
      context,
      command: input,
      identifiers: localGovernedOcrMutationIdentifiers(
        context, input.clientOperationId, input.jobId, 'job_delete', input
      )
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async setLocalGovernedOcrEnabled(
    input: SetLocalGovernedOcrEnabledInput
  ): Promise<LocalGovernedOcrMutationReceiptView> {
    const context = this.#localGovernedOcrApplicationContext('local-ocr-settings-update');
    if (!context.actor.personId) {
      throw new Error('[AUTHORIZATION_DENIED] Local OCR settings require an exact owner person.');
    }
    const resourceId = localGovernedOcrSettingsResourceId(context.actor.personId);
    const result = await this.#setLocalGovernedOcrEnabledUseCase.execute({
      context,
      command: input,
      identifiers: localGovernedOcrMutationIdentifiers(
        context, input.clientOperationId, resourceId,
        input.enabled ? 'processing_enable' : 'processing_disable', input
      )
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }


  public async searchArchive(input: ArchiveSearchInput = {}): Promise<ArchiveItemView[]> { const result=await this.#searchArchiveItemsUseCase.execute(this.#archiveApplicationContext('archive-search'),input); if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`); return [...result.value]; }

  public async searchUnifiedAuthorizedRecords(
    input: UnifiedAuthorizedSearchInput
  ): Promise<UnifiedAuthorizedSearchView> {
    const result = await this.#searchUnifiedAuthorizedRecordsUseCase.execute(
      this.#unifiedAuthorizedSearchApplicationContext('unified-authorized-search'),
      input
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async getFamilyAiAssistantCenter():Promise<FamilyAiAssistantCenterView>{
    const result=await this.#getFamilyAiAssistantCenterUseCase.execute(
      this.#lifeApplicationContext('family-ai-assistant-center'));
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async generateFamilyAiSuggestion(
    input:GenerateFamilyAiSuggestionInput
  ):Promise<FamilyAiSuggestionMutationReceiptView>{
    const result=await this.#generateFamilyAiSuggestionUseCase.execute({
      context:this.#lifeApplicationContext('family-ai-assistant-generate'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async reviewFamilyAiSuggestion(
    input:ReviewFamilyAiSuggestionInput
  ):Promise<FamilyAiSuggestionMutationReceiptView>{
    const result=await this.#reviewFamilyAiSuggestionUseCase.execute({
      context:this.#lifeApplicationContext('family-ai-assistant-review'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async getMemoryStudioCenter():Promise<MemoryStudioCenterView>{
    const result=await this.#getMemoryStudioCenterUseCase.execute(this.#lifeApplicationContext('memory-studio-center'));
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async createMemoryStudioRecord(input:CreateMemoryStudioRecordInput):Promise<MemoryStudioMutationReceiptView>{
    const result=await this.#createMemoryStudioRecordUseCase.execute({context:this.#lifeApplicationContext('memory-studio-record-create'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async deleteMemoryStudioRecord(input:DeleteMemoryStudioRecordInput):Promise<MemoryStudioMutationReceiptView>{
    const result=await this.#deleteMemoryStudioRecordUseCase.execute({context:this.#lifeApplicationContext('memory-studio-record-delete'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async createMemoryTimeCapsule(input:CreateMemoryTimeCapsuleInput):Promise<MemoryStudioMutationReceiptView>{
    const result=await this.#createMemoryTimeCapsuleUseCase.execute({context:this.#lifeApplicationContext('memory-time-capsule-create'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async reviewMemoryTimeCapsule(input:ReviewMemoryTimeCapsuleInput):Promise<MemoryStudioMutationReceiptView>{
    const result=await this.#reviewMemoryTimeCapsuleUseCase.execute({context:this.#lifeApplicationContext('memory-time-capsule-review'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async transitionMemoryTimeCapsule(input:TransitionMemoryTimeCapsuleInput):Promise<MemoryStudioMutationReceiptView>{
    const result=await this.#transitionMemoryTimeCapsuleUseCase.execute({context:this.#lifeApplicationContext('memory-time-capsule-transition'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async getSmartHomeEnergyCenter():Promise<SmartHomeEnergyCenterView>{
    const result=await this.#getSmartHomeEnergyCenterUseCase.execute(this.#lifeApplicationContext('smart-home-energy-center'));
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  /** Main-only signed adapter boundary; no renderer bridge is exposed. */
  public async registerSmartHomeDevice(input:RegisterSmartHomeDeviceInput):Promise<SmartHomeMutationReceiptView>{
    const result=await this.#registerSmartHomeDeviceUseCase.execute({context:this.#lifeApplicationContext('smart-home-device-register'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  /** Main-only provider lifecycle boundary; no renderer bridge is exposed. */
  public async updateSmartHomeDeviceStatus(input:UpdateSmartHomeDeviceStatusInput):Promise<SmartHomeMutationReceiptView>{
    const result=await this.#updateSmartHomeDeviceStatusUseCase.execute({context:this.#lifeApplicationContext('smart-home-device-status'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  /** Main-only bounded scalar observation boundary; raw media is not accepted. */
  public async recordSmartHomeObservation(input:RecordSmartHomeObservationInput):Promise<SmartHomeMutationReceiptView>{
    const result=await this.#recordSmartHomeObservationUseCase.execute({context:this.#lifeApplicationContext('smart-home-observation-record'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async grantSmartHomeCameraConsent(input:GrantSmartHomeCameraConsentInput):Promise<SmartHomeMutationReceiptView>{
    const result=await this.#grantSmartHomeCameraConsentUseCase.execute({context:this.#lifeApplicationContext('smart-home-camera-consent-grant'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async revokeSmartHomeCameraConsent(input:RevokeSmartHomeCameraConsentInput):Promise<SmartHomeMutationReceiptView>{
    const result=await this.#revokeSmartHomeCameraConsentUseCase.execute({context:this.#lifeApplicationContext('smart-home-camera-consent-revoke'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async setSmartHomeProcessing(input:SetSmartHomeProcessingInput):Promise<SmartHomeMutationReceiptView>{
    const result=await this.#setSmartHomeProcessingUseCase.execute({context:this.#lifeApplicationContext('smart-home-processing-setting'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async getSignedPluginPlatformCenter():Promise<SignedPluginPlatformCenterView>{
    const result=await this.#getSignedPluginPlatformCenterUseCase.execute(this.#lifeApplicationContext('signed-plugin-platform-center'));
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  /** Main-only cryptographic registration boundary. Renderer IPC never accepts manifests, signatures, keys or paths. */
  public async registerSignedPluginManifest(input:{readonly clientOperationId:string;readonly expectedRevision:number;readonly envelope:unknown})
  :Promise<SignedPluginMutationReceiptView>{
    if(this.#signedPluginTrustedKeys.length===0)throw new Error('[AUTHORIZATION-DENIED] Production plugin signing trust is not provisioned.');
    const verified=verifySignedPluginManifest(input.envelope,{trustedKeys:this.#signedPluginTrustedKeys,
      hostVersion:APP_META.packageVersion,now:()=>new Date(this.#clock.now())});
    const release:VerifiedSignedPluginReleaseInput=Object.freeze({pluginId:verified.pluginId,displayName:verified.displayName,
      version:verified.version,minimumHostVersion:verified.minimumHostVersion,
      manifestSha256:verified.manifestSha256,packageSha256:verified.packageSha256,
      entrypointSha256:verified.entrypointSha256,sbomSha256:verified.sbomSha256,
      licenseInventorySha256:verified.licenseInventorySha256,provenanceSha256:verified.provenanceSha256,
      signerKeyId:verified.signerKeyId,signatureVerified:true,providerKinds:verified.providerKinds,
      capabilityCodes:verified.capabilityCodes,dataDeclarations:verified.dataDeclarations,egressMode:verified.egressMode,
      egressHosts:verified.egressHosts,sandboxProfile:'isolated_child_process',filesystemAccess:'none',
      processSpawnAllowed:false,nativeModulesAllowed:false,networkBrokerOnly:true,issuedAt:verified.issuedAt,expiresAt:verified.expiresAt});
    const result=await this.#registerSignedPluginReleaseUseCase.execute({context:this.#lifeApplicationContext('signed-plugin-release-register'),
      command:{clientOperationId:input.clientOperationId,expectedRevision:input.expectedRevision,release}});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async setSignedPluginDesiredState(input:SetSignedPluginDesiredStateInput):Promise<SignedPluginMutationReceiptView>{
    const result=await this.#setSignedPluginDesiredStateUseCase.execute({context:this.#lifeApplicationContext('signed-plugin-desired-state'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async emergencyDisableSignedPlugin(input:EmergencyDisableSignedPluginInput):Promise<SignedPluginMutationReceiptView>{
    const result=await this.#emergencyDisableSignedPluginUseCase.execute({context:this.#lifeApplicationContext('signed-plugin-emergency-disable'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async rollbackSignedPlugin(input:RollbackSignedPluginInput):Promise<SignedPluginMutationReceiptView>{
    const result=await this.#rollbackSignedPluginUseCase.execute({context:this.#lifeApplicationContext('signed-plugin-rollback'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async getCommunicationSecurityCenter():Promise<CommunicationSecurityCenterView>{
    const result=await this.#getCommunicationSecurityCenterUseCase.execute(
      this.#lifeApplicationContext('communication-security-center'));
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  /** The renderer cannot choose a trusted-device identity; it is derived from the exact active session. */
  public async registerCommunicationDeviceCredential(input:{readonly clientOperationId:string;readonly expectedRevision:number})
  :Promise<CommunicationSecurityMutationReceiptView>{
    const context=this.#identityAccessApplicationContext('communication-device-credential-register');
    const result=await this.#registerCommunicationDeviceCredentialUseCase.execute({context,command:{
      clientOperationId:input.clientOperationId,expectedRevision:input.expectedRevision,
      trustedDeviceId:context.currentDevice.trustedDeviceId
    }});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async revokeCommunicationDeviceCredential(input:RevokeCommunicationDeviceCredentialInput)
  :Promise<CommunicationSecurityMutationReceiptView>{
    const result=await this.#revokeCommunicationDeviceCredentialUseCase.execute({
      context:this.#lifeApplicationContext('communication-device-credential-revoke'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async createCommunicationRoom(input:CreateCommunicationRoomInput):Promise<CommunicationSecurityMutationReceiptView>{
    const result=await this.#createCommunicationRoomUseCase.execute({
      context:this.#lifeApplicationContext('communication-room-create'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async addCommunicationRoomMember(input:AddCommunicationRoomMemberInput):Promise<CommunicationSecurityMutationReceiptView>{
    const result=await this.#addCommunicationRoomMemberUseCase.execute({
      context:this.#lifeApplicationContext('communication-room-member-add'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async removeCommunicationRoomMember(input:RemoveCommunicationRoomMemberInput)
  :Promise<CommunicationSecurityMutationReceiptView>{
    const result=await this.#removeCommunicationRoomMemberUseCase.execute({
      context:this.#lifeApplicationContext('communication-room-member-remove'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async rekeyCommunicationRoomAfterDeviceRevocation(input:RekeyCommunicationRoomAfterDeviceRevocationInput)
  :Promise<CommunicationSecurityMutationReceiptView>{
    const result=await this.#rekeyCommunicationRoomAfterDeviceRevocationUseCase.execute({
      context:this.#lifeApplicationContext('communication-room-device-rekey'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async setCommunicationHistoryAccess(input:SetCommunicationHistoryAccessInput)
  :Promise<CommunicationSecurityMutationReceiptView>{
    const result=await this.#setCommunicationHistoryAccessUseCase.execute({
      context:this.#lifeApplicationContext('communication-room-history-policy'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async freezeCommunicationRoom(input:FreezeCommunicationRoomInput):Promise<CommunicationSecurityMutationReceiptView>{
    const result=await this.#freezeCommunicationRoomUseCase.execute({
      context:this.#lifeApplicationContext('communication-room-freeze'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async getCommunicationMessagingCenter():Promise<CommunicationMessagingCenterView>{
    const result=await this.#getCommunicationMessagingCenterUseCase.execute(
      this.#lifeApplicationContext('communication-messaging-center'));
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async searchCommunicationMessages(input:SearchCommunicationMessagesInput):Promise<readonly CommunicationMessageView[]>{
    const result=await this.#searchCommunicationMessagesUseCase.execute(
      this.#lifeApplicationContext('communication-message-search'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async getCommunicationMessageContent(messageId:string):Promise<CommunicationMessageContentView>{
    const result=await this.#getCommunicationMessageContentUseCase.execute(
      this.#lifeApplicationContext('communication-message-content'),messageId);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async createCommunicationMessage(input:CreateCommunicationMessageInput):Promise<CommunicationMessagingMutationReceiptView>{
    const result=await this.#createCommunicationMessageUseCase.execute({
      context:this.#lifeApplicationContext('communication-message-create'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async editCommunicationMessage(input:EditCommunicationMessageInput):Promise<CommunicationMessagingMutationReceiptView>{
    const result=await this.#editCommunicationMessageUseCase.execute({
      context:this.#lifeApplicationContext('communication-message-edit'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async setCommunicationMessageLifecycle(input:SetCommunicationMessageLifecycleInput)
  :Promise<CommunicationMessagingMutationReceiptView>{
    const result=await this.#setCommunicationMessageLifecycleUseCase.execute({
      context:this.#lifeApplicationContext('communication-message-lifecycle'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async annotateCommunicationMessage(input:AnnotateCommunicationMessageInput):Promise<CommunicationMessagingMutationReceiptView>{
    const result=await this.#annotateCommunicationMessageUseCase.execute({
      context:this.#lifeApplicationContext('communication-message-annotate'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async updateCommunicationDelivery(input:UpdateCommunicationDeliveryInput):Promise<CommunicationMessagingMutationReceiptView>{
    const result=await this.#updateCommunicationDeliveryUseCase.execute({
      context:this.#lifeApplicationContext('communication-message-delivery'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async setCommunicationPresence(input:SetCommunicationPresenceInput):Promise<CommunicationMessagingMutationReceiptView>{
    const result=await this.#setCommunicationPresenceUseCase.execute({
      context:this.#lifeApplicationContext('communication-presence-update'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async setCommunicationRetentionPolicy(input:SetCommunicationRetentionPolicyInput)
  :Promise<CommunicationMessagingMutationReceiptView>{
    const result=await this.#setCommunicationRetentionPolicyUseCase.execute({
      context:this.#lifeApplicationContext('communication-retention-update'),command:input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  /** Main-only scheduled maintenance; renderer code has no channel for this authority. */
  public async maintainCommunicationMessagingLifecycle():Promise<CommunicationMessagingMaintenanceView>{
    const center=await this.getCommunicationMessagingCenter();const nowMs=Date.parse(center.generatedAt);
    let expiredMessagesDeleted=0;let expiredPresenceProfilesHidden=0;let failedOperations=0;
    const retentionByRoom=new Map(center.retentionPolicies.map(policy=>[policy.roomId,policy] as const));
    for(const message of center.messages){
      const policy=retentionByRoom.get(message.roomId);
      if(message.deleted||policy?.mode==='legal_hold'||policy?.mode==='permanent')continue;
      const effectiveExpiresAt=policy&&['duration','auto_delete'].includes(policy.mode)&&policy.durationDays
        ?new Date(Date.parse(message.createdAt)+policy.durationDays*86_400_000).toISOString()
        :message.expiresAt;
      if(!effectiveExpiresAt||Date.parse(effectiveExpiresAt)>nowMs)continue;
      const digest=createHash('sha256').update(`communication-retention\0${message.id}\0${effectiveExpiresAt}`,'utf8').digest('hex');
      try{
        await this.setCommunicationMessageLifecycle({clientOperationId:`comm-retention-${digest.slice(0,48)}`,
          expectedRevision:message.revision,messageId:message.id,action:'delete',
          reason:'Süresi dolan yerel mesaj saklama kararı yürütüldü.'});
        expiredMessagesDeleted+=1;
      }catch{failedOperations+=1;}
    }
    if(center.presence.expiresAt&&Date.parse(center.presence.expiresAt)<=nowMs){
      const digest=createHash('sha256').update(
        `communication-presence-expiry\0${center.ownerPersonId}\0${center.presence.expiresAt}`,'utf8').digest('hex');
      try{
        await this.setCommunicationPresence({clientOperationId:`comm-presence-expiry-${digest.slice(0,40)}`,
          expectedRevision:center.presence.revision,status:'offline',audience:'nobody',lastSeenShared:false,
          typingIndicatorsEnabled:false,readReceiptsEnabled:false,emergencyReachabilityEnabled:false});
        expiredPresenceProfilesHidden+=1;
      }catch{failedOperations+=1;}
    }
    const swept=await this.#maintainCommunicationMessagePayloadVaultUseCase.execute(
      this.#lifeApplicationContext('communication-message-payload-maintenance'));
    if(!swept.ok)throw new Error(`[${swept.error.code}] ${swept.error.message}`);
    return Object.freeze({expiredMessagesDeleted,expiredPresenceProfilesHidden,
      scannedPayloadFiles:swept.value.scannedFiles,deletedOrphanPayloadFiles:swept.value.deletedFiles,
      rejectedPayloadFiles:swept.value.rejectedFiles,failedOperations,completedAt:swept.value.completedAt,
      physicalSecureEraseGuaranteed:false,backupPropagationGuaranteed:false,networkUsed:false,cloudUsed:false});
  }

  public async getCommunicationFileSharingCenter():Promise<CommunicationFileSharingRendererCenterView>{
    const result=await this.#getCommunicationFileSharingCenterUseCase.execute(
      this.#lifeApplicationContext('communication-file-sharing-center'));
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return projectCommunicationFileSharingCenter(result.value);
  }

  public async getCommunicationFileSafePreview(fileId:string):Promise<CommunicationFileSafePreviewView>{
    const result=await this.#getCommunicationFileSafePreviewUseCase.execute(
      this.#lifeApplicationContext('communication-file-sharing-safe-preview'),fileId);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  /** Main-only scheduled maintenance. It derives the exact owner and live payload references through a fresh PEP read. */
  public async maintainCommunicationFilePayloadVault():Promise<CommunicationFilePayloadMaintenanceView>{
    const result=await this.#maintainCommunicationFilePayloadVaultUseCase.execute(
      this.#lifeApplicationContext('communication-file-payload-maintenance'));
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async getCommunicationAuditArchiveCenter():Promise<CommunicationAuditArchiveSafeCenterView>{
    const result=await this.#getCommunicationAuditArchiveSafeCenterUseCase.execute(
      this.#lifeApplicationContext('communication-audit-archive-center'));
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  /** Main-only file selection boundary. Renderer IPC never supplies paths, raw bytes, hashes or sealed references. */
  public async prepareCommunicationFile(input:{readonly clientOperationId:string;readonly expectedRevision:number;
    readonly roomId?:string;readonly meetingId?:string;readonly displayName:string;readonly mimeType:string;
    readonly bytes:Uint8Array}):Promise<CommunicationFileSharingRendererMutationReceiptView>{
    const result=await this.#prepareCommunicationFileUseCase.execute({
      context:this.#lifeApplicationContext('communication-file-sharing-prepare'),...input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return projectCommunicationFileSharingReceipt(result.value);
  }

  public async applyCommunicationFileSharingCommand(input:{readonly clientOperationId:string;readonly expectedRevision:number;
    readonly command:CommunicationFileSharingCommand}):Promise<CommunicationFileSharingRendererMutationReceiptView>{
    if(communicationFileSharingMainOnlyCommandKinds.has(input.command.kind))
      throw new Error('[AUTHORIZATION-DENIED] File payload, chunk and scan evidence are main-process authorities.');
    const result=await this.#applyCommunicationFileSharingCommandUseCase.execute({
      context:this.#lifeApplicationContext('communication-file-sharing-mutate'),...input});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return projectCommunicationFileSharingReceipt(result.value);
  }

  public async getCommunicationRealtimeCallingCenter():Promise<CommunicationRealtimeCallingCenterView>{
    const result=await this.#getCommunicationRealtimeCallingCenterUseCase.execute(
      this.#lifeApplicationContext('communication-calling-center'));
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async createCommunicationCall(input:CreateCommunicationCallInput):Promise<CommunicationRealtimeCallingMutationReceiptView>{
    const result=await this.#createCommunicationCallUseCase.execute(
      this.#lifeApplicationContext('communication-call-create'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async runCommunicationCallPreflight(input:RunCommunicationCallPreflightInput)
  :Promise<CommunicationRealtimeCallingMutationReceiptView>{
    const result=await this.#runCommunicationCallPreflightUseCase.execute(
      this.#lifeApplicationContext('communication-call-preflight'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async updateCommunicationCallControls(input:UpdateCommunicationCallControlsInput)
  :Promise<CommunicationRealtimeCallingMutationReceiptView>{
    const result=await this.#updateCommunicationCallControlsUseCase.execute(
      this.#lifeApplicationContext('communication-call-controls'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async advanceCommunicationCall(input:AdvanceCommunicationCallInput)
  :Promise<CommunicationRealtimeCallingMutationReceiptView>{
    const result=await this.#advanceCommunicationCallUseCase.execute(
      this.#lifeApplicationContext('communication-call-lifecycle'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async setCommunicationCallPreferences(input:SetCommunicationCallPreferencesInput)
  :Promise<CommunicationRealtimeCallingMutationReceiptView>{
    const result=await this.#setCommunicationCallPreferencesUseCase.execute(
      this.#lifeApplicationContext('communication-call-preferences'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async getCommunicationRecordingCenter():Promise<CommunicationRecordingCenterView>{
    const result=await this.#getCommunicationRecordingCenterUseCase.execute(
      this.#lifeApplicationContext('communication-recording-center'));
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async createCommunicationRecordingRequest(input:CreateCommunicationRecordingRequestInput):Promise<CommunicationRecordingMutationReceiptView>{
    const result=await this.#createCommunicationRecordingRequestUseCase.execute(
      this.#lifeApplicationContext('communication-recording-create'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async decideCommunicationRecordingConsent(input:DecideCommunicationRecordingConsentInput):Promise<CommunicationRecordingMutationReceiptView>{
    const result=await this.#decideCommunicationRecordingConsentUseCase.execute(
      this.#lifeApplicationContext('communication-recording-consent'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async withdrawCommunicationRecordingConsent(input:WithdrawCommunicationRecordingConsentInput):Promise<CommunicationRecordingMutationReceiptView>{
    const result=await this.#withdrawCommunicationRecordingConsentUseCase.execute(
      this.#lifeApplicationContext('communication-recording-withdraw'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async addCommunicationRecordingLateJoiner(input:AddCommunicationRecordingLateJoinerInput):Promise<CommunicationRecordingMutationReceiptView>{
    const result=await this.#addCommunicationRecordingLateJoinerUseCase.execute(
      this.#lifeApplicationContext('communication-recording-late-joiner'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async setCommunicationRecordingSegment(input:SetCommunicationRecordingSegmentInput):Promise<CommunicationRecordingMutationReceiptView>{
    const result=await this.#setCommunicationRecordingSegmentUseCase.execute(
      this.#lifeApplicationContext('communication-recording-segment'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async updateCommunicationRecordingRetention(input:UpdateCommunicationRecordingRetentionInput):Promise<CommunicationRecordingMutationReceiptView>{
    const result=await this.#updateCommunicationRecordingRetentionUseCase.execute(
      this.#lifeApplicationContext('communication-recording-retention'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async requestCommunicationRecordingDeletion(input:RequestCommunicationRecordingDeletionInput):Promise<CommunicationRecordingMutationReceiptView>{
    const result=await this.#requestCommunicationRecordingDeletionUseCase.execute(
      this.#lifeApplicationContext('communication-recording-delete'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async getLocalTranslationCenter():Promise<LocalTranslationCenterView>{
    const result=await this.#getLocalTranslationCenterUseCase.execute(this.#lifeApplicationContext('local-translation-center'));
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async updateLocalTranslationProfile(input:UpdateLocalTranslationProfileInput):Promise<LocalTranslationMutationReceiptView>{
    const result=await this.#updateLocalTranslationProfileUseCase.execute(this.#lifeApplicationContext('local-translation-profile'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async addLocalTranslationDictionaryEntry(input:AddLocalTranslationDictionaryEntryInput):Promise<LocalTranslationMutationReceiptView>{
    const result=await this.#addLocalTranslationDictionaryEntryUseCase.execute(this.#lifeApplicationContext('local-translation-dictionary-add'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async updateLocalTranslationDictionaryEntry(input:UpdateLocalTranslationDictionaryEntryInput):Promise<LocalTranslationMutationReceiptView>{
    const result=await this.#updateLocalTranslationDictionaryEntryUseCase.execute(this.#lifeApplicationContext('local-translation-dictionary-update'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async deleteLocalTranslationDictionaryEntry(input:DeleteLocalTranslationDictionaryEntryInput):Promise<LocalTranslationMutationReceiptView>{
    const result=await this.#deleteLocalTranslationDictionaryEntryUseCase.execute(this.#lifeApplicationContext('local-translation-dictionary-delete'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async prepareLocalTranslationRequest(input:PrepareLocalTranslationRequestInput):Promise<LocalTranslationMutationReceiptView>{
    const result=await this.#prepareLocalTranslationRequestUseCase.execute(this.#lifeApplicationContext('local-translation-request'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async recordLocalTranslationCorrection(input:RecordLocalTranslationCorrectionInput):Promise<LocalTranslationMutationReceiptView>{
    const result=await this.#recordLocalTranslationCorrectionUseCase.execute(this.#lifeApplicationContext('local-translation-correction'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async cancelLocalTranslationRequest(input:CancelLocalTranslationRequestInput):Promise<LocalTranslationMutationReceiptView>{
    const result=await this.#cancelLocalTranslationRequestUseCase.execute(this.#lifeApplicationContext('local-translation-cancel'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async getFamilyMeetingCenter():Promise<FamilyMeetingCenterView>{
    const result=await this.#getFamilyMeetingCenterUseCase.execute(this.#lifeApplicationContext('family-meeting-center'));
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async getFamilyMeetingMinutes(meetingId:string):Promise<FamilyMeetingMinutesContentView>{
    const result=await this.#getFamilyMeetingMinutesUseCase.execute(
      this.#lifeApplicationContext('family-meeting-minutes-read'),meetingId);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async createFamilyMeeting(command:CreateFamilyMeetingInput):Promise<FamilyMeetingMutationReceiptView>{
    const result=await this.#createFamilyMeetingUseCase.execute({context:this.#lifeApplicationContext('family-meeting-create'),command});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async updateFamilyMeetingPlan(command:UpdateFamilyMeetingPlanInput):Promise<FamilyMeetingMutationReceiptView>{
    const result=await this.#updateFamilyMeetingPlanUseCase.execute({context:this.#lifeApplicationContext('family-meeting-plan'),command});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async setFamilyMeetingState(command:SetFamilyMeetingStateInput):Promise<FamilyMeetingMutationReceiptView>{
    const result=await this.#setFamilyMeetingStateUseCase.execute({context:this.#lifeApplicationContext('family-meeting-state'),command});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async upsertFamilyMeetingParticipant(command:UpsertFamilyMeetingParticipantInput):Promise<FamilyMeetingMutationReceiptView>{
    const result=await this.#upsertFamilyMeetingParticipantUseCase.execute({context:this.#lifeApplicationContext('family-meeting-participant'),command});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async upsertFamilyMeetingAgendaItem(command:UpsertFamilyMeetingAgendaItemInput):Promise<FamilyMeetingMutationReceiptView>{
    const result=await this.#upsertFamilyMeetingAgendaItemUseCase.execute({context:this.#lifeApplicationContext('family-meeting-agenda'),command});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async createFamilyMeetingPoll(command:CreateFamilyMeetingPollInput):Promise<FamilyMeetingMutationReceiptView>{
    const result=await this.#createFamilyMeetingPollUseCase.execute({context:this.#lifeApplicationContext('family-meeting-poll'),command});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async castFamilyMeetingVote(command:CastFamilyMeetingVoteInput):Promise<FamilyMeetingMutationReceiptView>{
    const result=await this.#castFamilyMeetingVoteUseCase.execute({context:this.#lifeApplicationContext('family-meeting-vote'),command});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async recordFamilyMeetingDecision(command:RecordFamilyMeetingDecisionInput):Promise<FamilyMeetingMutationReceiptView>{
    const result=await this.#recordFamilyMeetingDecisionUseCase.execute({context:this.#lifeApplicationContext('family-meeting-decision'),command});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async upsertFamilyMeetingTask(command:UpsertFamilyMeetingTaskInput):Promise<FamilyMeetingMutationReceiptView>{
    const result=await this.#upsertFamilyMeetingTaskUseCase.execute({context:this.#lifeApplicationContext('family-meeting-task'),command});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async addFamilyMeetingCollaboration(command:AddFamilyMeetingCollaborationInput):Promise<FamilyMeetingMutationReceiptView>{
    const result=await this.#addFamilyMeetingCollaborationUseCase.execute({context:this.#lifeApplicationContext('family-meeting-collaboration'),command});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async prepareFamilyMeetingAiMinutes(command:PrepareFamilyMeetingAiMinutesInput):Promise<FamilyMeetingMutationReceiptView>{
    const result=await this.#prepareFamilyMeetingAiMinutesUseCase.execute({context:this.#lifeApplicationContext('family-meeting-ai-minutes'),command});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public async finalizeFamilyMeetingMinutes(command:FinalizeFamilyMeetingMinutesInput):Promise<FamilyMeetingMutationReceiptView>{
    const result=await this.#finalizeFamilyMeetingMinutesUseCase.execute({context:this.#lifeApplicationContext('family-meeting-minutes-finalize'),command});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }

  public async listArchiveVersions(itemId:string): Promise<ArchiveVersionView[]> { const result=await this.#listArchiveVersionsUseCase.execute(this.#archiveApplicationContext('archive-versions'),itemId); if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`); return [...result.value]; }
  public async listArchiveRelationEvidence(itemId:string):Promise<ArchiveRelationEvidenceView[]>{const result=await this.#listArchiveRelationEvidenceUseCase.execute(this.#archiveApplicationContext('archive-relation-evidence-list'),itemId);if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return [...result.value];}
  public async listArchiveRelationEvidenceHistory(itemId:string):Promise<ArchiveRelationEvidenceHistoryView[]>{const result=await this.#listArchiveRelationEvidenceHistoryUseCase.execute(this.#archiveApplicationContext('archive-relation-evidence-history'),itemId);if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return [...result.value];}
  public async addArchiveRelationEvidence(input:AddArchiveRelationEvidenceInput&{readonly clientOperationId:string}):Promise<ArchiveRelationEvidenceView[]>{
    const command={relationId:input.relationId.trim(),archiveItemId:input.archiveItemId.trim(),evidenceDate:input.evidenceDate,confidence:input.confidence};
    const context=this.#archiveDirectMutationContext('archive.relation-evidence.add',input.clientOperationId,command);
    const evidenceId=deterministicArchiveIdentifier(input.clientOperationId,'relation-evidence');
    const result=await this.#addArchiveRelationEvidenceUseCase.execute({context,command,identifiers:{evidenceId,mutationId:deterministicArchiveIdentifier(input.clientOperationId,'mutation'),auditId:deterministicArchiveIdentifier(input.clientOperationId,'audit'),outboxEventId:asEventId(deterministicArchiveIdentifier(input.clientOperationId,'outbox'))}});
    if(!result.ok){const current=await this.listArchiveRelationEvidence(command.archiveItemId);if(result.error.code===ERROR_CODES.RESOURCE_CONFLICT&&current.some(item=>item.id===evidenceId))return current;throw new Error(`[${result.error.code}] ${result.error.message}`);}
    return this.listArchiveRelationEvidence(command.archiveItemId);
  }
  public async removeArchiveRelationEvidence(input:RemoveArchiveRelationEvidenceInput&{readonly clientOperationId:string}):Promise<ArchiveRelationEvidenceView[]>{
    const command={evidenceId:input.evidenceId.trim(),archiveItemId:input.archiveItemId.trim(),expectedRevision:input.expectedRevision};
    const context=this.#archiveDirectMutationContext('archive.relation-evidence.remove',input.clientOperationId,command);
    const mutationId=deterministicArchiveIdentifier(input.clientOperationId,'mutation');
    const result=await this.#removeArchiveRelationEvidenceUseCase.execute({context,command,identifiers:{mutationId,auditId:deterministicArchiveIdentifier(input.clientOperationId,'audit'),outboxEventId:asEventId(deterministicArchiveIdentifier(input.clientOperationId,'outbox'))}});
    if(!result.ok){
      const current=await this.listArchiveRelationEvidence(command.archiveItemId);
      if(result.error.code===ERROR_CODES.RESOURCE_CONFLICT){
        const history=await this.listArchiveRelationEvidenceHistory(command.archiveItemId);
        if(history.some(item=>item.mutationId===mutationId&&item.evidenceId===command.evidenceId&&item.mutationKind==='evidence_remove'&&item.revision===command.expectedRevision+1))return current;
      }
      throw new Error(`[${result.error.code}] ${result.error.message}`);
    }
    return this.listArchiveRelationEvidence(command.archiveItemId);
  }
  public async addArchiveItemVersionFile(sourcePath:string,input:AddArchiveItemVersionInput&{readonly clientOperationId:string}):Promise<ArchiveVersionView[]>{
    const itemId=input.itemId.trim();
    const operationId=this.#archiveOperationId(input.clientOperationId);
    const versionId=deterministicArchiveIdentifier(operationId,'version');
    const fileContext=this.#archiveApplicationContext('archive-version-file');
    const stored=this.#storeArchiveFileUseCase.execute(fileContext.correlationId,{sourcePath,itemId:versionId});
    if(!stored.ok)throw new Error(`[${stored.error.code}] ${stored.error.message}`);
    const command={itemId,originalName:stored.value.originalName,storedName:stored.value.storedName,mimeType:stored.value.mimeType,sizeBytes:stored.value.sizeBytes,sha256:stored.value.sha256,...(input.note?.trim()?{note:input.note.trim()}:{})};
    const context=this.#archiveDirectMutationContext('archive.version.add',operationId,command,fileContext.correlationId);
    const result=await this.#addArchiveItemVersionUseCase.execute({context,command,identifiers:{versionId,auditId:deterministicArchiveIdentifier(operationId,'audit'),outboxEventId:asEventId(deterministicArchiveIdentifier(operationId,'outbox'))}});
    if(!result.ok){
      let existing:ArchiveVersionView[]|undefined;
      try{existing=await this.listArchiveVersions(itemId);}catch{/* Unknown commit state preserves the encrypted file. */}
      if(result.error.code===ERROR_CODES.RESOURCE_CONFLICT&&existing?.some(version=>version.id===versionId))return existing;
      if(stored.value.createdNewFile&&existing&&!existing.some(version=>version.id===versionId))this.#destroyArchiveFileUseCase.execute(context.correlationId,{storedName:stored.value.storedName,secureDestroy:false});
      throw new Error(`[${result.error.code}] ${result.error.message}`);
    }
    return this.listArchiveVersions(itemId);
  }
  public async listArchiveRetentionPolicies(): Promise<ArchiveRetentionPolicyView[]> { const result=await this.#listArchiveRetentionPoliciesUseCase.execute(this.#archiveApplicationContext('archive-retention-policies')); if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`); return [...result.value]; }
  public async createArchiveRetentionPolicy(
    input:CreateArchiveRetentionPolicyInput & { readonly operationId?: string }
  ): Promise<ArchiveRetentionPolicyView[]> {
    const operationId = this.#archiveOperationId(input.operationId);
    const command = {
      name: input.name.trim(),
      retentionDays: input.retentionDays,
      secureDestroy: input.secureDestroy
    };
    const policyId = deterministicArchiveIdentifier(operationId, 'retention-policy');
    const context = this.#archiveMutationContext('archive.retention-policy.create', operationId, command);
    this.#assertArchiveOperationIdentity(context, {
      resourceType: 'archive_retention_policy',
      resourceId: policyId,
      action: 'create'
    });
    const result=await this.#createArchiveRetentionPolicyUseCase.execute({
      context,
      command,
      identifiers:{
        policyId,
        auditId:deterministicArchiveIdentifier(operationId, 'audit')
      }
    });
    if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listArchiveRetentionPolicies();
  }

  public async assignArchiveRetentionPolicy(
    input:AssignArchiveRetentionPolicyInput & { readonly operationId?: string }
  ): Promise<ArchiveRetentionStatusView[]> {
    const operationId = this.#archiveOperationId(input.operationId);
    const itemId = input.itemId.trim();
    const policyId = input.policyId?.trim() || undefined;
    const context = this.#archiveMutationContext(
      'archive.retention-policy.assign',
      operationId,
      { itemId, policyId: policyId ?? null }
    );
    this.#assertArchiveOperationIdentity(context, {
      resourceType: 'archive_item',
      resourceId: itemId,
      action: 'update'
    });
    const result=await this.#assignArchiveRetentionPolicyUseCase.execute({
      context,
      itemId,
      ...(policyId ? { policyId } : {}),
      identifiers:{auditId:deterministicArchiveIdentifier(operationId, 'audit')}
    });
    if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listArchiveRetentionStatus();
  }
  public async listArchiveRetentionStatus(): Promise<ArchiveRetentionStatusView[]> { const result=await this.#listArchiveRetentionStatusUseCase.execute(this.#archiveApplicationContext('archive-retention-status')); if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`); return [...result.value]; }
  public async securelyDestroyArchiveItem(itemId:string, requestedOperationId?:string): Promise<ArchiveRetentionStatusView[]> {
    const normalizedItemId = itemId.trim();
    const operationId = this.#archiveOperationId(requestedOperationId);
    const context = this.#archiveMutationContext(
      'archive.secure-destroy',
      operationId,
      { itemId: normalizedItemId }
    );
    const replay = this.#assertArchiveOperationIdentity(context, {
      resourceType: 'archive_item',
      resourceId: normalizedItemId,
      action: 'delete'
    });
    if (!replay) {
      const destructionPlanContext: ArchiveApplicationContext = {
        ...context,
        correlationId: localGovernedOcrStageCorrelationId(
          context.correlationId,
          'archive-destruction-plan'
        )
      };
      const prepared=await this.#prepareArchiveDestructionUseCase.execute(
        destructionPlanContext,
        normalizedItemId
      );
      if(!prepared.ok) throw new Error(`[${prepared.error.code}] ${prepared.error.message}`);
      const destroyed=this.#destroyArchiveFileUseCase.execute(context.correlationId,prepared.value);
      if(!destroyed.ok) throw new Error(`[${destroyed.error.code}] ${destroyed.error.message}`);
      await this.#propagateLocalGovernedOcrArchiveDeletion(
        {
          ...context,
          correlationId: localGovernedOcrStageCorrelationId(
            context.correlationId,
            'archive-deletion-propagation'
          )
        },
        normalizedItemId,
        operationId
      );
    }
    const marked=await this.#markArchiveDestroyedUseCase.execute({
      context,
      itemId:normalizedItemId,
      identifiers:{auditId:deterministicArchiveIdentifier(operationId, 'audit')}
    });
    if(!marked.ok) throw new Error(`[${marked.error.code}] ${marked.error.message}`);
    return this.listArchiveRetentionStatus();
  }

  public async listArchiveCategories(): Promise<ArchiveCategoryView[]> { const result=await this.#listArchiveCategoriesUseCase.execute(this.#archiveApplicationContext('archive-category-list')); if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`); return [...result.value]; }
  public async createArchiveCategory(
    input:CreateArchiveCategoryInput & { readonly operationId?: string }
  ): Promise<ArchiveCategoryView[]> {
    const operationId = this.#archiveOperationId(input.operationId);
    const command = {
      name: input.name.trim(),
      ...(input.description?.trim() ? { description: input.description.trim() } : {})
    };
    const categoryId = deterministicArchiveIdentifier(operationId, 'category');
    const context = this.#archiveMutationContext('archive.category.create', operationId, command);
    this.#assertArchiveOperationIdentity(context, {
      resourceType: 'archive_category',
      resourceId: categoryId,
      action: 'create'
    });
    const result=await this.#createArchiveCategoryUseCase.execute({
      context,
      command,
      identifiers:{
        categoryId,
        auditId:deterministicArchiveIdentifier(operationId, 'audit')
      }
    });
    if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.listArchiveCategories();
  }
  public async getArchiveClassifications(): Promise<ArchiveClassificationView[]> { const result=await this.#listArchiveClassificationsUseCase.execute(this.#archiveApplicationContext('archive-classification-list')); if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`); return [...result.value]; }
  public async updateArchiveClassification(
    input:UpdateArchiveClassificationInput & { readonly operationId?: string }
  ): Promise<ArchiveClassificationView[]> {
    const operationId = this.#archiveOperationId(input.operationId);
    const command = {
      itemId: input.itemId.trim(),
      ...(input.categoryId?.trim() ? { categoryId: input.categoryId.trim() } : {}),
      tagNames: [...input.tagNames],
      sensitivity: input.sensitivity,
      aiProcessingAllowed: input.aiProcessingAllowed
    };
    const context = this.#archiveMutationContext('archive.classification.update', operationId, command);
    this.#assertArchiveOperationIdentity(context, {
      resourceType: 'archive_item',
      resourceId: command.itemId,
      action: 'update'
    });
    const result=await this.#updateArchiveClassificationUseCase.execute({
      context,
      command,
      identifiers:{
        auditId:deterministicArchiveIdentifier(operationId, 'audit'),
        tagIds:Array.from(
          {length:20},
          (_unused, index)=>deterministicArchiveIdentifier(operationId, `tag-${index}`)
        )
      }
    });
    if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.getArchiveClassifications();
  }

  public listAiConsents(): AiConsentView[] { const result=this.#listAiConsentsUseCase.execute(this.#aiConsentApplicationContext('ai-consent-list')); if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`); return [...result.value]; }
  public upsertAiConsent(input:UpsertAiConsentInput): AiConsentView[] { const result=this.#upsertAiConsentUseCase.execute({context:this.#aiConsentApplicationContext('ai-consent-upsert'),command:input,identifiers:{consentId:randomUUID(),auditId:randomUUID()}}); if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`); return this.listAiConsents(); }
  public previewAiAccess(purpose:AiAccessPreviewView['purpose']): AiAccessPreviewView { const result=this.#previewAiAccessUseCase.execute(this.#aiConsentApplicationContext('ai-access-preview'),purpose); if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`); return result.value; }
  public listSensitiveDataProfiles(): SensitiveDataProfileView[] { const result=this.#listSensitiveDataProfilesUseCase.execute(this.#aiConsentApplicationContext('ai-sensitive-profile-list')); if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`); return [...result.value]; }
  public upsertSensitiveDataConsent(input:UpsertSensitiveDataConsentInput): SensitiveDataProfileView[] { const result=this.#upsertSensitiveDataConsentUseCase.execute({context:this.#aiConsentApplicationContext('ai-sensitive-consent-upsert'),command:input,identifiers:{consentId:randomUUID(),auditId:randomUUID()}}); if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`); return this.listSensitiveDataProfiles(); }
  public previewSensitiveExport(input:SensitiveExportPreviewInput): SensitiveExportPreviewView { const result=this.#previewSensitiveExportUseCase.execute({context:this.#aiConsentApplicationContext('ai-sensitive-export-preview'),command:input,identifiers:{previewId:randomUUID(),auditId:randomUUID()}}); if(!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`); return result.value; }
  public getPrivacyControlCenter():PrivacyControlCenterView { const result=this.#getPrivacyControlCenterUseCase.execute(this.#privacyControlApplicationContext('privacy-control-center')); if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value; }
  public upsertLiveLocationConsent(input:UpsertLiveLocationConsentInput):PrivacyControlCenterView { const result=this.#upsertLiveLocationConsentUseCase.execute({context:this.#privacyControlApplicationContext('privacy-live-location-consent'),command:input,identifiers:{consentId:randomUUID(),auditId:randomUUID()}});if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return this.getPrivacyControlCenter(); }
  public shutdownLostDeviceAuthority(input:LostDeviceShutdownInput):LostDeviceShutdownResultView { const result=this.#shutdownLostDeviceAuthorityUseCase.execute({context:this.#privacyControlApplicationContext('privacy-lost-device-shutdown'),command:input,auditId:randomUUID()});if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value; }

  public async getPrivacyOwnershipCenter():Promise<PrivacyOwnershipControlCenterView> {
    const result = await this.#getPrivacyOwnershipControlCenterUseCase.execute(
      this.#privacyOwnershipApplicationContext('privacy-ownership-center')
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async correctAiMemory(input:CorrectAiMemoryInput):Promise<PrivacyOwnershipMutationReceiptView> {
    const result = await this.#manageAiMemoryUseCase.execute({
      context:this.#privacyOwnershipApplicationContext('privacy-ai-memory-correct'),
      command:{operation:'correct',input},
      identifiers:privacyMutationIdentifiers(input.clientOperationId,input.recordId,'ai_memory_correct',input)
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async restrictAiMemory(input:RestrictAiMemoryInput):Promise<PrivacyOwnershipMutationReceiptView> {
    const result = await this.#manageAiMemoryUseCase.execute({
      context:this.#privacyOwnershipApplicationContext('privacy-ai-memory-restrict'),
      command:{operation:'restrict',input},
      identifiers:privacyMutationIdentifiers(input.clientOperationId,input.recordId,'ai_memory_restrict',input)
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async deleteAiMemory(input:DeleteAiMemoryInput):Promise<PrivacyOwnershipMutationReceiptView> {
    const result = await this.#manageAiMemoryUseCase.execute({
      context:this.#privacyOwnershipApplicationContext('privacy-ai-memory-delete'),
      command:{operation:'delete',input},
      identifiers:privacyMutationIdentifiers(input.clientOperationId,input.recordId,'ai_memory_delete',input)
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async expireAiMemory(input:ExpireAiMemoryInput):Promise<PrivacyOwnershipMutationReceiptView> {
    const result = await this.#manageAiMemoryUseCase.execute({
      context:this.#privacyOwnershipApplicationContext('privacy-ai-memory-expire'),
      command:{operation:'expire',input},
      identifiers:privacyMutationIdentifiers(input.clientOperationId,input.recordId,'ai_memory_expire',input)
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async createPrivacyRightsRequest(input:CreateDataRightsRequestInput):Promise<PrivacyOwnershipMutationReceiptView> {
    const resourceId = deterministicArchiveIdentifier(input.clientOperationId,'privacy-rights-request');
    const result = await this.#manageDataRightsRequestUseCase.execute({
      context:this.#privacyOwnershipApplicationContext('privacy-rights-request-create'),
      command:{operation:'create',input},
      identifiers:privacyMutationIdentifiers(input.clientOperationId,resourceId,'rights_request_create',input)
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async updatePrivacyRightsRequest(input:UpdateDataRightsRequestInput):Promise<PrivacyOwnershipMutationReceiptView> {
    const result = await this.#manageDataRightsRequestUseCase.execute({
      context:this.#privacyOwnershipApplicationContext('privacy-rights-request-update'),
      command:{operation:'update',input},
      identifiers:privacyMutationIdentifiers(input.clientOperationId,input.requestId,'rights_request_update',input)
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async createPrivacyIncident(input:CreatePrivacyIncidentInput):Promise<PrivacyOwnershipMutationReceiptView> {
    const resourceId = deterministicArchiveIdentifier(input.clientOperationId,'privacy-incident');
    const result = await this.#managePrivacyIncidentUseCase.execute({
      context:this.#privacyOwnershipApplicationContext('privacy-incident-create'),
      command:{operation:'create',input},
      identifiers:privacyMutationIdentifiers(input.clientOperationId,resourceId,'incident_create',input)
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    if(input.actions.some((item)=>item.action==='revoke_local_session_authority'))this.#sessionManager.clear();
    return result.value;
  }

  public async updatePrivacyIncident(input:UpdatePrivacyIncidentInput):Promise<PrivacyOwnershipMutationReceiptView> {
    const result = await this.#managePrivacyIncidentUseCase.execute({
      context:this.#privacyOwnershipApplicationContext('privacy-incident-update'),
      command:{operation:'update',input},
      identifiers:privacyMutationIdentifiers(input.clientOperationId,input.incidentId,'incident_update',input)
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async simulatePrivacyPermission(input:SimulatePermissionVisibilityInput):Promise<PermissionSimulationView> {
    const result = await this.#simulatePermissionVisibilityUseCase.execute({
      context:this.#privacyOwnershipApplicationContext('privacy-permission-simulation'),
      targets:input.targets
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async getIdentityAccessCredentialCenter(): Promise<IdentityAccessCredentialCenterView> {
    const result = await this.#getIdentityAccessCredentialCenterUseCase.execute(
      this.#identityAccessApplicationContext('identity-access-center')
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public issueIdentityAccessOperationToken(operationKind: IdentityAccessOperationKind): IdentityAccessOperationTokenView {
    const context = this.#identityAccessApplicationContext('identity-operation-token-issue');
    this.#maintainIdentityAccessRetention(context);
    return issueIdentityAccessOperationToken({
      binding: {
        accountId: context.actor.userId,
        deviceId: context.currentDevice.deviceId,
        securityEpoch: context.currentDevice.securityEpoch,
        operationKind
      },
      now: this.#clock.now(),
      deviceIdentityProvider: this.#deviceIdentityProvider
    });
  }

  public async beginPasskeyRegistration(input: {
    readonly clientOperationId: string;
    readonly relyingPartyId: string;
  }): Promise<PasskeyChallengeView> {
    const context = this.#identityAccessApplicationContext('identity-passkey-registration-begin');
    this.#requireIdentityAccessOperationToken(context, input.clientOperationId, 'passkey_register');
    const identifiers = identityAccessEvidenceIdentifiers(context, input.clientOperationId, 'passkey-registration-challenge');
    const result = await this.#beginPasskeyRegistrationUseCase.execute({
      context,
      relyingPartyId: input.relyingPartyId,
      identifiers: {
        challengeId: identifiers.resourceId,
        auditId: identifiers.auditId,
        outboxEventId: identifiers.outboxEventId
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async beginPasskeyAuthentication(input: {
    readonly clientOperationId: string;
    readonly relyingPartyId: string;
  }): Promise<PasskeyChallengeView> {
    const context = this.#identityAccessApplicationContext('identity-passkey-authentication-begin');
    this.#requireIdentityAccessOperationToken(context, input.clientOperationId, 'passkey_authenticate');
    const identifiers = identityAccessEvidenceIdentifiers(context, input.clientOperationId, 'passkey-authentication-challenge');
    const result = await this.#beginPasskeyAuthenticationUseCase.execute({
      context,
      relyingPartyId: input.relyingPartyId,
      identifiers: {
        challengeId: identifiers.resourceId,
        auditId: identifiers.auditId,
        outboxEventId: identifiers.outboxEventId
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async completePasskeyRegistration(input: CompletePasskeyRegistrationInput): Promise<IdentityAccessMutationReceiptView> {
    const context = this.#identityAccessApplicationContext('identity-passkey-registration-complete');
    this.#requireIdentityAccessOperationToken(context, input.clientOperationId, 'passkey_register');
    const resourceId = identityAccessResourceId(context, input.clientOperationId, 'passkey');
    const result = await this.#completePasskeyRegistrationUseCase.execute({
      context,
      command: input,
      identifiers: identityAccessMutationIdentifiers(
        context, input.clientOperationId, resourceId, 'passkey_register', input
      )
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async authenticateWithPasskey(
    input: AuthenticateWithPasskeyInput & { readonly credentialId: string }
  ): Promise<IdentityAccessMutationReceiptView> {
    const context = this.#identityAccessApplicationContext('identity-passkey-authenticate');
    this.#requireIdentityAccessOperationToken(context, input.clientOperationId, 'passkey_authenticate');
    const { credentialId, ...command } = input;
    const result = await this.#authenticateWithPasskeyUseCase.execute({
      context,
      command,
      identifiers: identityAccessMutationIdentifiers(
        context, command.clientOperationId, credentialId, 'passkey_authenticate', input
      )
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async revokePasskey(input: RevokePasskeyInput): Promise<IdentityAccessMutationReceiptView> {
    const context = this.#identityAccessApplicationContext('identity-passkey-revoke');
    this.#requireIdentityAccessOperationToken(context, input.clientOperationId, 'passkey_revoke');
    const result = await this.#revokePasskeyUseCase.execute({
      context,
      command: input,
      identifiers: identityAccessMutationIdentifiers(
        context, input.clientOperationId, input.credentialId, 'passkey_revoke', input
      )
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async recoverLostPasskey(input: RecoverLostPasskeyInput): Promise<IdentityAccessMutationReceiptView> {
    const context = this.#identityAccessApplicationContext('identity-passkey-recover-lost');
    this.#requireIdentityAccessOperationToken(context, input.clientOperationId, 'passkey_recover_lost');
    const result = await this.#recoverLostPasskeyUseCase.execute({
      context,
      command: input,
      identifiers: identityAccessMutationIdentifiers(
        context, input.clientOperationId, input.credentialId, 'passkey_recover_lost', input
      )
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async beginFederatedIdentityLink(input: {
    readonly clientOperationId: string;
    readonly provider: FederatedIdentityProvider;
  }): Promise<FederatedAuthorizationCeremonyView> {
    const context = this.#identityAccessApplicationContext('identity-federated-link-begin');
    this.#requireIdentityAccessOperationToken(context, input.clientOperationId, 'federated_link');
    const identifiers = identityAccessEvidenceIdentifiers(context, input.clientOperationId, 'federated-flow');
    const result = await this.#beginFederatedIdentityLinkUseCase.execute({
      context,
      provider: input.provider,
      identifiers: {
        flowId: identifiers.resourceId,
        auditId: identifiers.auditId,
        outboxEventId: identifiers.outboxEventId
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async linkFederatedIdentity(input: LinkFederatedIdentityInput): Promise<IdentityAccessMutationReceiptView> {
    const context = this.#identityAccessApplicationContext('identity-federated-link-complete');
    this.#requireIdentityAccessOperationToken(context, input.clientOperationId, 'federated_link');
    const resourceId = input.verifiedFlowId;
    const result = await this.#linkFederatedIdentityUseCase.execute({
      context,
      command: input,
      identifiers: identityAccessMutationIdentifiers(
        context, input.clientOperationId, resourceId, 'federated_link', input
      )
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async unlinkFederatedIdentity(input: UnlinkFederatedIdentityInput): Promise<IdentityAccessMutationReceiptView> {
    const context = this.#identityAccessApplicationContext('identity-federated-unlink');
    this.#requireIdentityAccessOperationToken(context, input.clientOperationId, 'federated_unlink');
    const result = await this.#unlinkFederatedIdentityUseCase.execute({
      context,
      command: input,
      identifiers: identityAccessMutationIdentifiers(
        context, input.clientOperationId, input.linkId, 'federated_unlink', input
      )
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async issueTemporaryVerifiableCredential(input: IssueTemporaryVerifiableCredentialInput): Promise<{
    readonly receipt: IdentityAccessMutationReceiptView;
    readonly issued?: IssuedTemporaryVerifiableCredentialView;
  }> {
    const context = this.#identityAccessApplicationContext('identity-temporary-credential-issue');
    this.#requireIdentityAccessOperationToken(context, input.clientOperationId, 'temporary_credential_issue');
    const resourceId = identityAccessResourceId(context, input.clientOperationId, `temporary-${input.kind}`);
    const result = await this.#issueTemporaryVerifiableCredentialUseCase.execute({
      context,
      command: input,
      identifiers: identityAccessMutationIdentifiers(
        context, input.clientOperationId, resourceId, 'temporary_credential_issue', input
      )
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async revokeTemporaryVerifiableCredential(
    input: RevokeTemporaryVerifiableCredentialInput
  ): Promise<IdentityAccessMutationReceiptView> {
    const context = this.#identityAccessApplicationContext('identity-temporary-credential-revoke');
    this.#requireIdentityAccessOperationToken(context, input.clientOperationId, 'temporary_credential_revoke');
    const result = await this.#revokeTemporaryVerifiableCredentialUseCase.execute({
      context,
      command: input,
      identifiers: identityAccessMutationIdentifiers(
        context, input.clientOperationId, input.credentialId, 'temporary_credential_revoke', input
      )
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async verifyTemporaryVerifiableCredential(
    input: VerifyTemporaryVerifiableCredentialInput
  ): Promise<TemporaryCredentialVerificationView> {
    const result = await this.#verifyTemporaryVerifiableCredentialUseCase.execute({
      context: this.#identityAccessApplicationContext('identity-temporary-credential-verify'),
      command: input
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async createReadOnlyCompanionSnapshot(
    input: CreateReadOnlyCompanionSnapshotInput & { readonly clientOperationId: string }
  ): Promise<ReadOnlyCompanionSnapshotView | CompanionSyncDenialView> {
    const context = this.#identityAccessApplicationContext('identity-companion-snapshot-create');
    this.#requireIdentityAccessOperationToken(context, input.clientOperationId, 'companion_snapshot_create');
    const { clientOperationId, ...command } = input;
    const identifiers = identityAccessEvidenceIdentifiers(context, clientOperationId, 'companion-snapshot');
    const result = await this.#createReadOnlyCompanionSnapshotUseCase.execute({
      context,
      command,
      identifiers: {
        snapshotId: identifiers.resourceId,
        auditId: identifiers.auditId,
        outboxEventId: identifiers.outboxEventId
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async exportEncryptedPrivacyData(input:{readonly requestId:string;readonly passphrase:string;readonly destination:string}):Promise<PrivacyDataExportFileResult> {
    if(!input || typeof input!=='object' || Array.isArray(input)
      || Object.getPrototypeOf(input)!==Object.prototype
      || Object.keys(input).sort().join(',')!=='destination,passphrase,requestId') {
      throw new Error('Åifreli gizlilik dÄ±ÅŸa aktarÄ±m isteÄŸi exact deÄŸildir.');
    }
    const center = await this.getPrivacyOwnershipCenter();
    const request = center.rightsRequests.find((item)=>item.id===input.requestId);
    if(!request || !['encrypted_export','legacy_export'].includes(request.kind)
      || !['requested','in_review'].includes(request.status)) {
      throw new Error('Åifreli dÄ±ÅŸa aktarÄ±m iÃ§in etkin ve exact owner talebi gerekir.');
    }
    const privacyInventoryScope = request.kind==='encrypted_export'
      && request.scopeResourceType==='privacy_inventory'
      && request.scopeResourceId===center.key.ownerPersonId;
    const digitalLegacyScope = request.kind==='legacy_export'
      && request.scopeResourceType==='digital_legacy'
      && request.scopeResourceId===center.key.ownerPersonId;
    if(!privacyInventoryScope && !digitalLegacyScope) {
      throw new Error('Şifreli dışa aktarım talep türü ve exact kullanıcı kapsamı eşleşmiyor.');
    }
    const createdAt = this.#clock.now();
    const requestMetadata = Object.freeze({id:request.id,kind:request.kind,
      scopeResourceType:request.scopeResourceType,scopeResourceId:request.scopeResourceId});
    const ownerLegacyPlans = digitalLegacyScope
      ? this.listDigitalLegacyPlans().filter((plan)=>plan.ownerPersonId===center.key.ownerPersonId)
      : [];
    const ownerLegacyPlanIds = new Set(ownerLegacyPlans.map((plan)=>plan.id));
    const ownerLegacyGrants = digitalLegacyScope
      ? ownerLegacyPlans.flatMap((plan)=>this.listLegacyGrants(plan.id)).filter((grant)=>ownerLegacyPlanIds.has(grant.planId))
      : [];
    const ownerLegacyApprovals = digitalLegacyScope
      ? ownerLegacyPlans.flatMap((plan)=>this.listLegacyApprovals(plan.id)).filter((approval)=>ownerLegacyPlanIds.has(approval.planId))
      : [];
    let structuredOwnerItemCount = 0;
    let ownerStructuredData:Readonly<Record<string,unknown>>|undefined;
    if(privacyInventoryScope) {
      const ownerPersonId = center.key.ownerPersonId;
      const financeRecords = (await this.listFinanceRecords()).filter((item)=>item.ownerPersonId===ownerPersonId);
      const financeRecordIds = new Set(financeRecords.map((item)=>item.id));
      const financeValuations = (await this.listFinanceValuations()).filter((item)=>financeRecordIds.has(item.financeRecordId));
      const bankAccounts = (await this.listBankAccounts()).filter((item)=>item.ownerPersonId===ownerPersonId);
      const paymentCards = (await this.listPaymentCards()).filter((item)=>item.ownerPersonId===ownerPersonId);
      const loanAccounts = (await this.listLoanAccounts()).filter((item)=>item.ownerPersonId===ownerPersonId);
      const healthRecords = (await this.listHealthRecords()).filter((item)=>item.ownerPersonId===ownerPersonId);
      const medicationPlans = (await this.listMedicationPlans()).filter((item)=>item.ownerPersonId===ownerPersonId);
      const familyHealthHistory = (await this.listFamilyHealthHistory()).filter((item)=>item.relatedPersonId===ownerPersonId);
      const lifeRecords = (await this.listLifeRecords()).filter((item)=>item.ownerPersonId===ownerPersonId);
      const lifecycleRecords = this.listDataLifecycleRecords().filter((item)=>item.ownerPersonId===ownerPersonId);
      const accountProfiles = this.listAccounts().filter((item)=>item.id===center.key.accountId && item.personId===ownerPersonId);
      const personProfiles = this.lookupEntityCatalog({personIds:[ownerPersonId]}).people.filter((item)=>item.id===ownerPersonId);
      const planning = await this.getFinancePlanningWorkspace();
      const ownerPlanning = Object.freeze({
        categories:planning.categories.filter((item)=>item.ownerPersonId===ownerPersonId),
        cashFlowEntries:planning.cashFlowEntries.filter((item)=>item.ownerPersonId===ownerPersonId),
        importedCashFlowEntries:planning.importedCashFlowEntries.filter((item)=>item.ownerPersonId===ownerPersonId),
        importBatches:planning.importBatches.filter((item)=>item.ownerPersonId===ownerPersonId),
        budgetRevisions:planning.budgetRevisions.filter((item)=>item.ownerPersonId===ownerPersonId),
        budgetVariances:planning.budgetVariances.filter((item)=>item.ownerPersonId===ownerPersonId),
        recurringRules:planning.recurringRules.filter((item)=>item.ownerPersonId===ownerPersonId),
        goals:planning.goals.filter((item)=>item.ownerPersonId===ownerPersonId),
        portfolioAssets:planning.portfolioAssets.filter((item)=>item.ownerPersonId===ownerPersonId),
        upcomingPayments:planning.upcomingPayments.filter((item)=>item.ownerPersonId===ownerPersonId),
        personSummary:planning.personSummaries.find((item)=>item.ownerPersonId===ownerPersonId)??null,
        generatedAt:planning.generatedAt,
        dataSource:planning.dataSource,
        externalPricing:planning.externalPricing,
        bankSynchronization:planning.bankSynchronization,
        paymentExecution:planning.paymentExecution
      });
      const managedLife = await this.getManagedLifeWorkspace();
      const ownerManagedLife = Object.freeze({
        profiles:managedLife.profiles.filter((item)=>item.ownerPersonId===ownerPersonId),
        homeInventoryItems:managedLife.homeInventoryItems.filter((item)=>item.ownerPersonId===ownerPersonId),
        emergencyPlans:managedLife.emergencyPlans.filter((item)=>item.ownerPersonId===ownerPersonId),
        emergencyAssistanceProfiles:managedLife.emergencyAssistanceProfiles.filter((item)=>item.ownerPersonId===ownerPersonId),
        upcomingReminders:managedLife.upcomingReminders.filter((item)=>item.ownerPersonId===ownerPersonId),
        generatedAt:managedLife.generatedAt,
        truth:{dataSource:managedLife.dataSource,externalRegistryLookup:managedLife.externalRegistryLookup,
          providerContact:managedLife.providerContact,documentContentExposure:managedLife.documentContentExposure,
          networkEgressAdded:managedLife.networkEgressAdded}
      });
      const longTermPortfolio = await this.getLongTermPortfolioWorkspace();
      const ownerLongTermPortfolio = longTermPortfolio.portfolio?.ownerPersonId===ownerPersonId ? longTermPortfolio : null;
      const accessibility = await this.getAccessibilityPreferences();
      if(accessibility.accountId!==center.key.accountId || accessibility.familyId!==center.key.familyId
        || accessibility.ownerPersonId!==ownerPersonId) {
        throw new Error('Erişilebilirlik tercihi exact dışa aktarım sahibiyle eşleşmiyor.');
      }
      const ownerCollections = [accountProfiles,personProfiles,financeRecords,financeValuations,bankAccounts,paymentCards,
        loanAccounts,healthRecords,medicationPlans,familyHealthHistory,lifeRecords,lifecycleRecords,
        ownerPlanning.categories,ownerPlanning.cashFlowEntries,ownerPlanning.importedCashFlowEntries,ownerPlanning.importBatches,
        ownerPlanning.budgetRevisions,ownerPlanning.budgetVariances,ownerPlanning.recurringRules,ownerPlanning.goals,
        ownerPlanning.portfolioAssets,ownerPlanning.upcomingPayments,ownerManagedLife.profiles,ownerManagedLife.homeInventoryItems,
        ownerManagedLife.emergencyPlans,ownerManagedLife.emergencyAssistanceProfiles,ownerManagedLife.upcomingReminders];
      structuredOwnerItemCount = ownerCollections.reduce((sum,items)=>sum+items.length,0)
        + 1 + (ownerPlanning.personSummary?1:0) + (ownerLongTermPortfolio?1:0);
      ownerStructuredData = Object.freeze({
        accountProfiles,personProfiles,financeRecords,financeValuations,bankAccounts,paymentCards,loanAccounts,
        healthRecords,medicationPlans,familyHealthHistory,lifeRecords,lifecycleRecords,
        financePlanning:ownerPlanning,managedLife:ownerManagedLife,longTermPortfolio:ownerLongTermPortfolio,accessibility,
        coverage:Object.freeze({ownerScoped:true,archiveBinaryPayloadsIncluded:false,
          unscopedFamilyEventContentIncluded:false,formDraftPayloadsIncluded:false,
          formDraftExclusionReason:'selected_form_key_required'})
      });
    }
    const exportLineage = privacyInventoryScope ? center.derivedDataLineage : [];
    const exportValue = privacyInventoryScope ? Object.freeze({
      schemaVersion:1,
      exportType:'privacy_self_data',
      key:center.key,
      request:requestMetadata,
      ownerStructuredData,
      dataInventory:center.dataInventory,
      aiMemoryRecords:center.aiMemoryRecords,
      accessHistory:center.accessHistory,
      localDeviceActivity:center.localDeviceActivity,
      localProcessingObservations:center.localProcessingObservations,
      derivedDataLineage:exportLineage,
      rightsRequests:center.rightsRequests,
      encryptedExports:center.encryptedExports,
      incidents:center.incidents,
      truth:{...center.truth,scopeApplied:true,scopeKind:'privacy_inventory',
        archiveBinaryPayloadsIncluded:false,networkDelivery:'not_performed',externalPhysicalErasureGuaranteed:false},
      generatedAt:createdAt
    }) : Object.freeze({
      schemaVersion:1,
      exportType:'privacy_digital_legacy',
      key:center.key,
      request:requestMetadata,
      digitalLegacy:Object.freeze({plans:ownerLegacyPlans,grants:ownerLegacyGrants,approvals:ownerLegacyApprovals}),
      truth:Object.freeze({scopeApplied:true,scopeKind:'digital_legacy',ownerFiltered:true,
        unrelatedPrivacyRecordsIncluded:false,networkDelivery:'not_performed',recipientReadGuaranteed:false,
        externalPhysicalErasureGuaranteed:false}),
      generatedAt:createdAt
    });
    const scopeSha256 = createHash('sha256').update(canonicalizePrivacyDataExport({
      requestId:request.id,kind:request.kind,scopeResourceType:request.scopeResourceType,scopeResourceId:request.scopeResourceId,
      familyId:center.key.familyId,accountId:center.key.accountId,ownerPersonId:center.key.ownerPersonId
    }),'utf8').digest('hex');
    const lineageSha256 = createHash('sha256')
      .update(canonicalizePrivacyDataExport(exportLineage),'utf8').digest('hex');
    const itemCount = privacyInventoryScope
      ? 1 + structuredOwnerItemCount + center.dataInventory.length + center.aiMemoryRecords.length
        + center.accessHistory.length + center.localDeviceActivity.length + center.localProcessingObservations.length
        + exportLineage.length + center.rightsRequests.length + center.encryptedExports.length + center.incidents.length
      : 1 + ownerLegacyPlans.length + ownerLegacyGrants.length + ownerLegacyApprovals.length;
    if(!Number.isSafeInteger(itemCount) || itemCount<1 || itemCount>10_000) {
      throw new Error('Şifreli dışa aktarım kapsamı güvenli öğe sınırını aşıyor.');
    }
    return writePrivacyDataExportFile({
      value:exportValue,
      metadata:{accountId:center.key.accountId,familyId:center.key.familyId,ownerPersonId:center.key.ownerPersonId,
        requestId:request.id,scopeSha256,lineageSha256,createdAt},
      passphrase:input.passphrase,
      destination:input.destination,
      onVerified:async (verified)=>{
        const clientOperationId = deterministicArchiveIdentifier(`${request.id}:${verified.artifactSha256}`,'privacy-export-finalize');
        const command = {
          requestId:request.id,
          expectedRevision:request.revision,
          clientOperationId,
          artifactSha256:verified.artifactSha256,
          envelopeSha256:verified.artifactSha256,
          lineageSha256,
          itemCount,
          plaintextSizeBytes:verified.plaintextSizeBytes,
          sizeBytes:verified.artifactSizeBytes
        } as const;
        const result = await this.#finalizeEncryptedPrivacyExportUseCase.execute({
          context:this.#privacyOwnershipApplicationContext('privacy-export-finalize'),
          command,
          identifiers:{
            mutationId:deterministicArchiveIdentifier(clientOperationId,'privacy-mutation'),
            exportId:deterministicArchiveIdentifier(clientOperationId,'privacy-export-record'),
            requestFingerprint:privacyOperationFingerprint('rights_export_finalize',command),
            auditId:deterministicArchiveIdentifier(clientOperationId,'privacy-audit'),
            outboxEventId:asEventId(deterministicArchiveIdentifier(clientOperationId,'privacy-outbox'))
          }
        });
        if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
      }
    });
  }

  public async getDashboardOverview(): Promise<DashboardOverviewView> {
    const result = await this.#getDashboardOverviewUseCase.execute({
      context: this.#dashboardApplicationContext('dashboard-overview'),
      now: this.#clock.now()
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public previewFamilyDataImport(sourcePath: string): FamilyDataImportPreviewView {
    return this.#familyDataImportService.preview(sourcePath);
  }

  public applyFamilyDataImport(input: ApplyFamilyDataImportInput): Promise<FamilyDataImportBatchView> {
    return this.#familyDataImportService.apply(input);
  }

  public listFamilyDataImports(limit = 50): FamilyDataImportBatchView[] {
    return this.#familyDataImportService.listBatches(limit);
  }

  public rollbackFamilyDataImport(input: RollbackFamilyDataImportInput): Promise<FamilyDataImportBatchView> {
    return this.#familyDataImportService.rollback(input);
  }

  public async getSnapshotSections(input: FamilySnapshotSectionsInput): Promise<FamilySnapshotPatchView> {
    const requested = [...new Set(input.sections)];
    if (requested.length === 0 || requested.some((section) => section !== 'graph' && section !== 'timeline')) {
      throw new Error('En az bir geçerli aile veri bölümü seçilmelidir.');
    }

    const familyContext = this.#familyApplicationContext('family-snapshot-sections');
    let family: FamilyAppSnapshot['family'] | undefined;
    let people: FamilyAppSnapshot['people'] | undefined;
    let relations: FamilyAppSnapshot['relations'] | undefined;
    let locations: FamilyAppSnapshot['locations'] | undefined;
    let events: FamilyAppSnapshot['events'] | undefined;
    let notifications: FamilyAppSnapshot['notifications'] | undefined;

    if (requested.includes('graph')) {
      const graphResult = this.#getFamilyGraphUseCase.execute(familyContext);
      if (!graphResult.ok) throw new Error(`[${graphResult.error.code}] ${graphResult.error.message}`);
      family = graphResult.value.family;
      people = [...graphResult.value.people];
      relations = [...graphResult.value.relations];
    }

    if (requested.includes('timeline')) {
      const timelineResult = await this.#getTimelineReadModelUseCase.execute(
        this.#timelineApplicationContext('timeline-snapshot-section')
      );
      if (!timelineResult.ok) throw new Error(`[${timelineResult.error.code}] ${timelineResult.error.message}`);
      locations = [...timelineResult.value.locations];
      events = [...timelineResult.value.events];
      notifications = [...timelineResult.value.notifications];
    }

    if (!family) {
      const loadedFamily = this.#transactionExecutor.execute(familyContext.correlationId, (transaction) =>
        this.#repositories.familyRepository.findById({
          transaction: transaction.transaction,
          actor: familyContext.actor,
          correlationId: familyContext.correlationId,
          occurredAt: transaction.occurredAt
        }, familyContext.familyId)
      );
      if (!loadedFamily.ok) throw new Error(`[${loadedFamily.error.code}] ${loadedFamily.error.message}`);
      if (!loadedFamily.value) throw new Error('Aile kaydı bulunamadı.');
      family = { id: loadedFamily.value.id, name: loadedFamily.value.name };
    }

    const latestAuditResult = this.#getLatestAuditOccurredAtUseCase.execute(
      this.#auditReadApplicationContext('snapshot-sections-last-updated')
    );
    if (!latestAuditResult.ok) throw new Error(`[${latestAuditResult.error.code}] ${latestAuditResult.error.message}`);

    return {
      family,
      ...(people ? { people } : {}),
      ...(relations ? { relations } : {}),
      ...(locations ? { locations } : {}),
      ...(events ? { events } : {}),
      ...(notifications ? { notifications } : {}),
      loadedSections: requested,
      lastUpdatedAt: latestAuditResult.value
    };
  }

  public async getSnapshot(): Promise<FamilyAppSnapshot> {
    const familyContext = this.#familyApplicationContext('family-graph');
    const graphResult = this.#getFamilyGraphUseCase.execute(familyContext);
    if (!graphResult.ok) throw new Error(`[${graphResult.error.code}] ${graphResult.error.message}`);
    const timelineResult = await this.#getTimelineReadModelUseCase.execute(
      this.#timelineApplicationContext('timeline-read-model')
    );
    if (!timelineResult.ok) throw new Error(`[${timelineResult.error.code}] ${timelineResult.error.message}`);
    const { family, people, relations } = graphResult.value;
    const { locations, events, notifications } = timelineResult.value;
    const latestAuditResult = this.#getLatestAuditOccurredAtUseCase.execute(
      this.#auditReadApplicationContext('snapshot-last-updated')
    );
    if (!latestAuditResult.ok) throw new Error(`[${latestAuditResult.error.code}] ${latestAuditResult.error.message}`);
    return {
      family,
      people: [...people],
      relations: [...relations],
      locations: [...locations],
      events: [...events],
      notifications: [...notifications],
      lastUpdatedAt: latestAuditResult.value
    };
  }

  public async getImportantDayDetails(eventId: string): Promise<FamilyEventView> {
    const result = await this.#getImportantDayDetailsUseCase.execute({
      context: this.#timelineApplicationContext('important-day-details'),
      eventId: asEventId(eventId)
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public createMember(input: CreateFamilyMemberInput): FamilyMutationResultView {
    const context = this.#familyApplicationContext('member');
    const result = this.#createFamilyMemberUseCase.execute({
      context,
      command: input,
      identifiers: {
        personId: asPersonId(randomUUID()),
        auditId: randomUUID(),
        eventId: asEventId(randomUUID()),
        ...(input.relationshipCode && input.referencePersonId ? { relationship: {
          forwardRelationId: randomUUID(),
          reverseRelationId: randomUUID(),
          forwardAuditId: randomUUID(),
          reverseAuditId: randomUUID(),
          forwardEventId: asEventId(randomUUID()),
          reverseEventId: asEventId(randomUUID())
        }} : {})
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    const person = this.lookupEntityCatalog({ personIds: [result.value] }).people[0];
    if (!person) throw new Error('Oluşturulan aile üyesi katalogda bulunamadı.');
    return this.#recordMutation({
      entityType: 'person',
      entityId: result.value,
      operation: 'created',
      changedSections: ['graph'],
      changedRevisions: ['graph', 'personCatalog', 'dashboard'],
      person
    });
  }

  public getHouseholdMembershipWorkspace(): HouseholdMembershipWorkspaceView {
    const result = this.#getHouseholdMembershipWorkspaceUseCase.execute(
      this.#householdMembershipApplicationContext('household-membership-workspace')
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public createHousehold(input: CreateHouseholdInput): Household {
    const result = this.#createHouseholdUseCase.execute({
      context: this.#householdMembershipApplicationContext('household-create'),
      command: input,
      identifiers: {
        householdId: asHouseholdId(randomUUID()),
        auditId: randomUUID(),
        eventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public createFamilyBranch(input: CreateFamilyBranchInput): FamilyBranch {
    const result = this.#createFamilyBranchUseCase.execute({
      context: this.#householdMembershipApplicationContext('family-branch-create'),
      command: input,
      identifiers: {
        branchId: asFamilyBranchId(randomUUID()),
        auditId: randomUUID(),
        eventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public assignPersonMembership(input: AssignPersonMembershipInput): PersonMembership {
    const result = this.#assignPersonMembershipUseCase.execute({
      context: this.#householdMembershipApplicationContext('person-membership-assign'),
      command: input,
      identifiers: {
        membershipId: asMembershipId(randomUUID()),
        auditId: randomUUID(),
        eventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public endPersonMembership(membershipId: string, endedAt: string): PersonMembership {
    const result = this.#endPersonMembershipUseCase.execute({
      context: this.#householdMembershipApplicationContext('person-membership-end'),
      membershipId: asMembershipId(membershipId),
      endedAt: asIsoDateTime(endedAt),
      identifiers: { auditId: randomUUID(), eventId: asEventId(randomUUID()) }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public getPersonLifecycleWorkspace(personId: string): PersonLifecycleWorkspaceView {
    const result = this.#getPersonLifecycleWorkspaceUseCase.execute(
      this.#personLifecycleApplicationContext('person-lifecycle-workspace'),
      asPersonId(personId)
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public updatePersonProfile(input: UpdatePersonProfileInput): PersonLifecycleProfile {
    const result = this.#updatePersonProfileUseCase.execute({
      context: this.#personLifecycleApplicationContext('person-profile-update'),
      command: input,
      identifiers: {
        operationId: randomUUID(),
        auditId: randomUUID(),
        eventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public archivePersonProfile(input: { personId: string; expectedVersion: number; reason: string }): PersonLifecycleProfile {
    const result = this.#archivePersonProfileUseCase.execute({
      context: this.#personLifecycleApplicationContext('person-profile-archive'),
      personId: asPersonId(input.personId),
      expectedVersion: input.expectedVersion,
      reason: input.reason,
      identifiers: {
        operationId: randomUUID(),
        auditId: randomUUID(),
        eventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public mergePersonProfiles(input: {
    sourcePersonId: string;
    targetPersonId: string;
    expectedSourceVersion: number;
    expectedTargetVersion: number;
    conflictResolution: 'KEEP_TARGET';
    reason: string;
  }): PersonLifecycleProfile {
    const result = this.#mergePersonProfileUseCase.execute({
      context: this.#personLifecycleApplicationContext('person-profile-merge'),
      sourcePersonId: asPersonId(input.sourcePersonId),
      targetPersonId: asPersonId(input.targetPersonId),
      expectedSourceVersion: input.expectedSourceVersion,
      expectedTargetVersion: input.expectedTargetVersion,
      conflictResolution: input.conflictResolution,
      reason: input.reason,
      identifiers: {
        operationId: randomUUID(),
        auditId: randomUUID(),
        eventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public requestSafePersonDeletion(input: { personId: string; expectedVersion: number; confirmationText: string; reason: string }): PersonLifecycleProfile {
    const result = this.#requestSafePersonDeletionUseCase.execute({
      context: this.#personLifecycleApplicationContext('person-profile-safe-delete'),
      personId: asPersonId(input.personId),
      expectedVersion: input.expectedVersion,
      confirmationText: input.confirmationText,
      reason: input.reason,
      identifiers: {
        operationId: randomUUID(),
        auditId: randomUUID(),
        eventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public undoPersonLifecycleOperation(operationId: string): PersonLifecycleProfile {
    const result = this.#undoPersonLifecycleOperationUseCase.execute({
      context: this.#personLifecycleApplicationContext('person-lifecycle-undo'),
      operationId,
      auditId: randomUUID(),
      eventId: asEventId(randomUUID())
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public scanDataRepairIssues(): readonly DataRepairIssue[] {
    const result = this.#scanDataRepairIssuesUseCase.execute(
      this.#dataRepairApplicationContext('data-repair-scan')
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public getDataRepairWorkspace(): DataRepairWorkspaceView {
    const result = this.#getDataRepairWorkspaceUseCase.execute(
      this.#dataRepairApplicationContext('data-repair-workspace')
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public previewDataRepair(input: { issueId: string; reason: string }): DataRepairOperation {
    const result = this.#previewDataRepairUseCase.execute({
      context: this.#dataRepairApplicationContext('data-repair-preview'),
      issueId: input.issueId,
      reason: input.reason,
      identifiers: {
        operationId: randomUUID(),
        auditId: randomUUID(),
        eventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public applyDataRepair(input: { operationId: string; expectedRevisionToken: string }): DataRepairOperation {
    const result = this.#applyDataRepairUseCase.execute({
      context: this.#dataRepairApplicationContext('data-repair-apply'),
      operationId: input.operationId,
      expectedRevisionToken: input.expectedRevisionToken,
      identifiers: { auditId: randomUUID(), eventId: asEventId(randomUUID()) }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public undoDataRepair(operationId: string): DataRepairOperation {
    const result = this.#undoDataRepairUseCase.execute({
      context: this.#dataRepairApplicationContext('data-repair-undo'),
      operationId,
      identifiers: { auditId: randomUUID(), eventId: asEventId(randomUUID()) }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }

  public async createLocation(input: CreateFamilyLocationInput): Promise<FamilyMutationResultView> {
    const result = await this.#createFamilyLocationUseCase.execute({
      context: this.#locationApplicationContext('location'),
      command: input,
      identifiers: {
        locationId: randomUUID(),
        auditId: randomUUID(),
        outboxEventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    const location: FamilyLocationView = {
      id: result.value.id,
      label: result.value.label,
      ...(result.value.address ? { address: result.value.address } : {}),
      ...(result.value.latitude !== undefined ? { latitude: result.value.latitude } : {}),
      ...(result.value.longitude !== undefined ? { longitude: result.value.longitude } : {}),
      kind: result.value.kind
    };
    return this.#recordMutation({
      entityType: 'location',
      entityId: location.id,
      operation: 'created',
      changedSections: ['timeline'],
      changedRevisions: ['timeline', 'dashboard'],
      location
    });
  }

  public async createEvent(input: CreateFamilyEventInput): Promise<FamilyMutationResultView> {
    const result = await this.#createImportantDayUseCase.execute({
      context: this.#timelineApplicationContext('important-day'),
      command: input,
      identifiers: {
        eventId: asEventId(randomUUID()),
        auditId: randomUUID(),
        outboxEventId: asEventId(randomUUID())
      }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    const mutation = this.#recordMutation({
      entityType: 'event', entityId: result.value, operation: 'created',
      changedSections: ['timeline'],
      changedRevisions: ['timeline', 'eventCatalog', 'dashboard', 'notifications']
    });
    const event = await this.#readCommittedEventView(result.value);
    return event ? { ...mutation, event } : mutation;
  }

  public async updateImportantDayParticipants(input: UpdateEventParticipantsInput): Promise<FamilyMutationResultView> {
    const result = await this.#updateImportantDayParticipantsUseCase.execute({
      context: this.#timelineApplicationContext('important-day-participants'),
      command: input,
      identifiers: { auditId: randomUUID(), outboxEventId: asEventId(randomUUID()) }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    const mutation = this.#recordMutation({
      entityType: 'event', entityId: input.eventId, operation: 'updated',
      changedSections: ['timeline'],
      changedRevisions: ['timeline', 'eventCatalog', 'dashboard', 'notifications']
    });
    const event = await this.#readCommittedEventView(input.eventId);
    return event ? { ...mutation, event } : mutation;
  }

  public async updateImportantDayInvitation(input: UpdateEventInvitationInput): Promise<FamilyMutationResultView> {
    const result = await this.#updateImportantDayInvitationUseCase.execute({
      context: this.#timelineApplicationContext('important-day-invitation'),
      command: input,
      identifiers: { auditId: randomUUID(), outboxEventId: asEventId(randomUUID()) }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    const mutation = this.#recordMutation({
      entityType: 'event', entityId: input.eventId, operation: 'updated',
      changedSections: ['timeline'],
      changedRevisions: ['timeline', 'eventCatalog', 'dashboard', 'notifications']
    });
    const event = await this.#readCommittedEventView(input.eventId);
    return event ? { ...mutation, event } : mutation;
  }

  public async updateImportantDayNotes(input: UpdateEventNotesInput): Promise<FamilyMutationResultView> {
    const result = await this.#updateImportantDayNotesUseCase.execute({
      context: this.#timelineApplicationContext('important-day-notes'),
      command: input,
      identifiers: { auditId: randomUUID(), outboxEventId: asEventId(randomUUID()) }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    const mutation = this.#recordMutation({
      entityType: 'event', entityId: input.eventId, operation: 'updated',
      changedSections: ['timeline'],
      changedRevisions: ['timeline', 'eventCatalog', 'dashboard', 'notifications']
    });
    const event = await this.#readCommittedEventView(input.eventId);
    return event ? { ...mutation, event } : mutation;
  }

  public async updateFamilyEvent(input: UpdateFamilyEventInput): Promise<FamilyMutationResultView> {
    const result = await this.#updateFamilyEventUseCase.execute({
      context: this.#timelineApplicationContext('timeline-event-update'),
      command: input,
      identifiers: { auditId: randomUUID(), outboxEventId: asEventId(randomUUID()) }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    const mutation = this.#recordMutation({
      entityType: 'event', entityId: input.eventId, operation: 'updated',
      changedSections: ['timeline'],
      changedRevisions: ['timeline', 'eventCatalog', 'dashboard', 'notifications']
    });
    const event = await this.#readCommittedEventView(input.eventId);
    return event ? { ...mutation, event } : mutation;
  }

  public async setFamilyEventArchived(input: SetFamilyEventArchivedInput): Promise<FamilyMutationResultView> {
    const previousEvent = input.archived
      ? await this.getImportantDayDetails(input.eventId)
      : (await this.listArchivedTimelineEvents()).find((event) => event.id === input.eventId);
    if (!previousEvent) throw new Error('Arşiv durumu değiştirilecek olay bulunamadı.');
    const result = await this.#setFamilyEventArchivedUseCase.execute({
      context: this.#timelineApplicationContext(input.archived ? 'timeline-event-archive' : 'timeline-event-restore'),
      command: input,
      identifiers: { auditId: randomUUID(), outboxEventId: asEventId(randomUUID()) }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    const mutation = this.#recordMutation({
      entityType: 'event', entityId: input.eventId, operation: input.archived ? 'archived' : 'restored',
      changedSections: ['timeline'],
      changedRevisions: ['timeline', 'eventCatalog', 'dashboard', 'notifications', 'archive']
    });
    const { archivedAt: _archivedAt, ...restoredEvent } = previousEvent;
    return {
      ...mutation,
      event: input.archived
        ? { ...previousEvent, archivedAt: mutation.occurredAt }
        : { ...restoredEvent, updatedAt: mutation.occurredAt }
    };
  }

  public async listArchivedTimelineEvents(): Promise<FamilyEventView[]> {
    const result = await this.#listArchivedTimelineEventsUseCase.execute(
      this.#timelineApplicationContext('timeline-event-archive-list')
    );
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }

  public async acknowledgeTimelineNotification(input: AcknowledgeFamilyNotificationInput): Promise<FamilyMutationResultView> {
    const result = await this.#acknowledgeTimelineNotificationUseCase.execute({
      context: this.#timelineApplicationContext('timeline-notification-acknowledge'),
      command: input,
      identifiers: { auditId: randomUUID(), outboxEventId: asEventId(randomUUID()) }
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return this.#recordMutation({
      entityType: 'notification', entityId: input.notificationId, operation: 'acknowledged',
      changedSections: ['timeline'],
      changedRevisions: ['timeline', 'dashboard', 'notifications'],
      notificationId: input.notificationId
    });
  }

  public exportBackup(destinationPath: string): void {
    this.#requireAuth();
    if (!destinationPath.toLowerCase().endsWith('.pptbackup')) {
      throw new Error('Korumasız .db dışa aktarımı yasaktır; yedek hedefi .pptbackup olmalıdır.');
    }
    this.exportFullBackup(destinationPath);
  }

  public getSystemHealth(): SystemHealthView {
    this.#requireAuth();
    const resources = this.#systemResourceSnapshot('system-health-resources');
    const databaseHealth=this.#inspectDatabaseRuntimeHealthUseCase.execute(this.#correlation?.current()?.correlationId ?? asCorrelationId(`system-health-database-${randomUUID()}`));
    if(!databaseHealth.ok) throw new Error(`[${databaseHealth.error.code}] ${databaseHealth.error.message}`);
    const {integrityOk,journalMode}=databaseHealth.value;
    const warnings:string[]=[];
    if(resources.memoryUsagePercent>=90) warnings.push('Bellek kullanımı kritik seviyede.'); else if(resources.memoryUsagePercent>=80) warnings.push('Bellek kullanımı hedef bölgenin üzerinde.');
    if(!integrityOk) warnings.push('SQLite bütünlük kontrolü başarısız.');
    if(resources.databaseBytes>2_000_000_000) warnings.push('Veritabanı boyutu 2 GB sınırını aştı.');
    return {generatedAt:nowIso(),status:!integrityOk||resources.memoryUsagePercent>=90?'critical':warnings.length?'warning':'healthy',platform:resources.platform,arch:resources.arch,cpuModel:resources.cpuModel,cpuCores:resources.cpuCores,totalMemoryBytes:resources.totalMemoryBytes,freeMemoryBytes:resources.freeMemoryBytes,memoryUsagePercent:resources.memoryUsagePercent,databaseBytes:resources.databaseBytes,archiveBytes:resources.archiveBytes,journalMode,integrityOk,walCheckpoint:'ready',warnings};
  }

  #nextBackupRun(schedule: BackupTargetView['schedule'], from = new Date()): string | undefined {
    if(schedule==='manual') return undefined; const next=new Date(from);
    if(schedule==='hourly') next.setHours(next.getHours()+1);
    else if(schedule==='daily') next.setDate(next.getDate()+1);
    else if(schedule==='weekly') next.setDate(next.getDate()+7);
    else next.setMonth(next.getMonth()+1);
    return next.toISOString();
  }
  public listBackupTargets(): BackupTargetView[] {
    const r=this.#listBackupTargetsUseCase.execute(this.#backupApplicationContext('backup-target-list'));
    if(!r.ok)throw new Error(`[${r.error.code}] ${r.error.message}`);
    return r.value.map((item)=>{
      const copy={...item};
      const free=this.#getBackupTargetFreeBytesUseCase.execute(this.#backupSafetyCorrelationId('backup-target-space'),copy.path);
      if(free.ok) copy.freeBytes=free.value;
      return copy;
    });
  }
  public upsertBackupTarget(input:UpsertBackupTargetInput): BackupTargetView[] { const id=input.id??randomUUID(),schedule=input.schedule??'manual',next=this.#nextBackupRun(schedule),context=this.#backupApplicationContext('backup-target-upsert'); const r=this.#upsertBackupTargetUseCase.execute(context,input,id,nowIso(),next);if(!r.ok)throw new Error(`[${r.error.code}] ${r.error.message}`);this.#writeAudit('backup_target.upserted','backup_target',id,nowIso());return this.listBackupTargets(); }
  public listBackupRuns(limit=100): BackupRunView[] { const r=this.#listBackupRunsUseCase.execute(this.#backupApplicationContext('backup-run-list'),limit);if(!r.ok)throw new Error(`[${r.error.code}] ${r.error.message}`);return [...r.value]; }
  #applyBackupRetention(targetId:string,targetPath:string,retentionCount:number):void {
    const context=this.#backupApplicationContext('backup-retention');
    const runs=this.#listSuccessfulBackupRunsUseCase.execute(context,targetId);
    if(!runs.ok)throw new Error(`[${runs.error.code}] ${runs.error.message}`);
    for(const stale of runs.value.slice(retentionCount)){
      if(stale.filePath){
        const removed=this.#deleteBackupArtifactUseCase.execute(this.#backupSafetyCorrelationId('backup-retention-delete'),stale.filePath);
        if(!removed.ok) throw new Error(removed.error.message);
      }
      const deleted=this.#deleteBackupRunUseCase.execute(context,stale.id);
      if(!deleted.ok)throw new Error(`[${deleted.error.code}] ${deleted.error.message}`);
    }
    const known=new Set(runs.value.slice(0,retentionCount).map(x=>x.filePath).filter((path): path is string=>Boolean(path)));
    const listed=this.#listBackupArtifactsUseCase.execute(this.#backupSafetyCorrelationId('backup-retention-list'),targetPath);
    if(!listed.ok) throw new Error(listed.error.message);
    if(runs.value.length>=retentionCount){
      for(const filePath of listed.value){
        if(known.has(filePath)) continue;
        this.#deleteBackupArtifactUseCase.execute(this.#backupSafetyCorrelationId('backup-retention-orphan'),filePath);
      }
    }
  }
  public runBackupTarget(targetId:string, options: { readonly applyRetention?: boolean } = {}): BackupRunResultView {
    this.#requireAuth();
    if(this.#runningBackupTargets.has(targetId))throw new Error('Bu yedek hedefi zaten çalışıyor.');
    const context=this.#backupApplicationContext('backup-run');
    const found=this.#findBackupTargetUseCase.execute(context,targetId);
    if(!found.ok)throw new Error(`[${found.error.code}] ${found.error.message}`);
    const target=found.value;
    if(!target)throw new Error('Yedek hedefi bulunamadı.');
    const taskId=this.#startTask('backup','Yedek hedefi çalıştırma',60_000);
    this.#runningBackupTargets.add(targetId);
    let last:BackupRunResultView|undefined;
    try{
      for(let attempt=0;attempt<=target.retryCount;attempt++){
        const runId=randomUUID(),startedAt=nowIso();
        let filePath:string|undefined;
        try{
          if(!target.enabled)throw new Error('Yedek hedefi kapalı.');
          const prepared=this.#prepareBackupTargetUseCase.execute(this.#backupSafetyCorrelationId('backup-target-prepare'),{targetPath:target.path,minimumFreeBytes:100*1024*1024});
          if(!prepared.ok)throw new Error(prepared.error.message);
          const destination=this.#createBackupArtifactPathUseCase.execute(this.#backupSafetyCorrelationId('backup-target-path'),{targetPath:target.path,createdAt:nowIso(),attempt});
          if(!destination.ok)throw new Error(destination.error.message);
          filePath=destination.value;
          this.exportFullBackup(filePath);
          const inspected=this.#inspectBackupArtifactUseCase.execute(this.#backupSafetyCorrelationId('backup-target-inspect'),filePath);
          if(!inspected.ok)throw new Error(inspected.error.message);
          const completedAt=nowIso();
          const run:BackupRunView={id:runId,targetId,status:'success',filePath,sizeBytes:inspected.value.sizeBytes,sha256:inspected.value.sha256,freeBytes:prepared.value.freeBytes,startedAt,completedAt};
          const saved=this.#recordBackupRunUseCase.execute(context,run);
          if(!saved.ok)throw new Error(`[${saved.error.code}] ${saved.error.message}`);
          const marked=this.#markBackupTargetSuccessUseCase.execute(context,targetId,completedAt,this.#nextBackupRun(target.schedule));
          if(!marked.ok)throw new Error(`[${marked.error.code}] ${marked.error.message}`);
          if(options.applyRetention!==false)this.#applyBackupRetention(targetId,target.path,target.retentionCount);
          this.recordDiagnostic('info','backup.target_success',`${target.name} hedefi doğrulandı.`,inspected.value.sha256);
          return {targetId,success:true,run};
        }catch(error){
          const message=error instanceof Error?error.message:String(error),completedAt=nowIso(),run:BackupRunView={id:runId,targetId,status:'failed',...(filePath?{filePath}:{}),error:message,startedAt,completedAt};
          const saved=this.#recordBackupRunUseCase.execute(context,run);
          if(!saved.ok)throw new Error(`[${saved.error.code}] ${saved.error.message}`);
          last={targetId,success:false,run};
          if(attempt===target.retryCount){
            const marked=this.#markBackupTargetFailureUseCase.execute(context,targetId,message);
            if(!marked.ok)throw new Error(`[${marked.error.code}] ${marked.error.message}`);
            this.recordDiagnostic('error','backup.target_failed',`${target.name} hedefi başarısız.`,message);
          }
        }
      }
      return last!;
    }finally{
      const latest=this.listBackupRuns(500).find(x=>x.targetId===targetId);
      this.#finishTask(taskId,latest?.status==='success'?'success':'failed',latest?.error);
      this.#runningBackupTargets.delete(targetId);
    }
  }
  public runAllBackupTargets(): BackupRunResultView[] { const r=this.#listEnabledBackupTargetIdsUseCase.execute(this.#backupApplicationContext('backup-all'));if(!r.ok)throw new Error(`[${r.error.code}] ${r.error.message}`);return r.value.map(id=>this.runBackupTarget(id)); }
  public runAllBackups(): BackupRunResultView[] { return this.runAllBackupTargets(); }
  public listBackupPropagationRuns(limit=20):BackupPropagationRunView[] {
    const result=this.#listBackupPropagationRunsUseCase.execute(this.#backupPropagationApplicationContext('backup-propagation-list'),limit);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return [...result.value];
  }
  public getBackupCleanRewritePolicy():BackupCleanRewritePolicyView {
    const result=this.#getBackupCleanRewritePolicyUseCase.execute(this.#backupPropagationApplicationContext('backup-clean-rewrite-policy'));
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    return result.value;
  }
  public getBackupCleanRewriteStatus(at=nowIso()):BackupCleanRewriteStatusView {
    const context=this.#backupPropagationApplicationContext('backup-clean-rewrite-status');
    const policyResult=this.#getBackupCleanRewritePolicyUseCase.execute(context);if(!policyResult.ok)throw new Error(`[${policyResult.error.code}] ${policyResult.error.message}`);
    const pendingResult=this.#listPendingBackupPropagationUseCase.execute(context);if(!pendingResult.ok)throw new Error(`[${pendingResult.error.code}] ${pendingResult.error.message}`);
    const cutoff=Date.parse(at)-policyResult.value.retentionDays*86_400_000;
    const due=pendingResult.value.filter(record=>Date.parse(record.purgedAt??record.updatedAt)<=cutoff).length;
    const adaptive=this.getAdaptiveResourceState();
    const adaptiveDeferred=adaptive.cpuLoadPercent>=85||adaptive.memoryUsagePercent>=85;
    return {policy:policyResult.value,pendingRecords:pendingResult.value.length,dueRecords:due,enabledTargets:this.listBackupTargets().filter(target=>target.enabled).length,adaptiveDeferred,...(adaptiveDeferred?{adaptiveReason:`CPU %${adaptive.cpuLoadPercent.toFixed(1)} / bellek %${adaptive.memoryUsagePercent.toFixed(1)}`}:{}) ,checkedAt:at};
  }
  public listBackupCleanRewriteRuns(limit=20):BackupCleanRewriteRunView[] {
    const result=this.#listBackupCleanRewriteRunsUseCase.execute(this.#backupPropagationApplicationContext('backup-clean-rewrite-run-list'),limit);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return [...result.value];
  }
  public updateBackupCleanRewritePolicy(input:UpdateBackupCleanRewritePolicyInput):BackupCleanRewritePolicyView {
    const result=this.#updateBackupCleanRewritePolicyUseCase.execute(this.#backupPropagationApplicationContext('backup-clean-rewrite-policy-update'),input,nowIso());
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public claimBackupCleanRewrite(input:{readonly trigger:BackupCleanRewriteTrigger;readonly runId:string;readonly startedAt:string;readonly retentionCutoff:string;readonly dueRecords:number;readonly enabledTargets:number}):BackupCleanRewritePolicyView|null {
    const result=this.#claimBackupCleanRewriteUseCase.execute(this.#backupPropagationApplicationContext('backup-clean-rewrite-claim'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public completeBackupCleanRewrite(input:{readonly runId:string;readonly state:BackupCleanRewriteState;readonly outcome:BackupCleanRewriteOutcome;readonly runStatus:Exclude<BackupCleanRewriteRunStatus,'running'|'interrupted'>;readonly completedAt:string;readonly nextAttemptAt?:string;readonly error?:string;readonly propagationRunId?:string;readonly success:boolean}):{readonly policy:BackupCleanRewritePolicyView;readonly run:BackupCleanRewriteRunView}|null {
    const result=this.#completeBackupCleanRewriteUseCase.execute(this.#backupPropagationApplicationContext('backup-clean-rewrite-complete'),input);
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value;
  }
  public recoverInterruptedBackupCleanRewrite(observedAt:string,error:string):BackupCleanRewritePolicyView {
    const result=this.#recoverInterruptedBackupCleanRewriteUseCase.execute(this.#backupPropagationApplicationContext('backup-clean-rewrite-recover'),{observedAt,error});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);return result.value.policy;
  }
  public propagatePurgedDataToManagedBackups(retentionCutoff?:string):BackupPropagationRunView {
    const context=this.#backupPropagationApplicationContext('backup-propagation-run');
    const pendingResult=this.#listPendingBackupPropagationUseCase.execute(context);
    if(!pendingResult.ok)throw new Error(`[${pendingResult.error.code}] ${pendingResult.error.message}`);
    const startedAt=nowIso();
    const startedMonotonicMs=performance.now();
    const runId=`purge-${randomUUID()}`;
    const pending=pendingResult.value.filter(record=>!retentionCutoff||Date.parse(record.purgedAt??record.updatedAt)<=Date.parse(retentionCutoff));
    const tombstones=pending.map(record=>({
      fingerprint:createHash('sha256').update(`${record.resourceType}\0${record.resourceId}\0${record.purgedAt??record.updatedAt}`,'utf8').digest('hex'),
      purgedAt:record.purgedAt??record.updatedAt
    }));
    const targets=this.listBackupTargets();
    const result=executeManagedBackupPropagation({
      correlationId:context.correlationId,
      runId,
      pending,
      targets,
      tombstones,
      startedAt,
      startedMonotonicMs,
      monotonicNowMs:()=>performance.now(),
      operations:{
        listSuccessfulRuns:(targetId)=>this.#listSuccessfulBackupRunsUseCase.execute(this.#backupApplicationContext('backup-propagation-list-runs'),targetId),
        createVerifiedBackup:(targetId)=>{
          try {
            const refreshed=this.runBackupTarget(targetId,{applyRetention:false});
            if(refreshed.success)return ok(refreshed.run);
            return err(createAppError({code:ERROR_CODES.CORE_UNEXPECTED,message:refreshed.run.error??'İmha sonrası temiz yedek oluşturulamadı.',category:'infrastructure',correlationId:context.correlationId}));
          } catch(error){
            return err(createAppError({code:ERROR_CODES.CORE_UNEXPECTED,message:error instanceof Error?error.message:String(error),category:'infrastructure',correlationId:context.correlationId}));
          }
        },
        quarantineManagedArtifacts:(input)=>this.#quarantineManagedBackupArtifactsUseCase.execute(this.#backupSafetyCorrelationId('backup-propagation-quarantine'),input),
        deleteManagedRun:(runId)=>this.#deleteBackupRunUseCase.execute(this.#backupApplicationContext('backup-propagation-delete-run'),runId),
        listArtifacts:(targetPath)=>this.#listBackupArtifactsUseCase.execute(this.#backupSafetyCorrelationId('backup-propagation-list-files'),targetPath),
        completePending:(records,at)=>this.#completeBackupPropagationUseCase.execute(context,records,at)
      }
    });
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
    const run=result.value;
    const recorded=this.#recordBackupPropagationRunUseCase.execute(context,run);
    if(!recorded.ok)throw new Error(`[${recorded.error.code}] ${recorded.error.message}`);
    this.#reconcileBackupQuarantineBatches();
    const unmanagedCount=run.targetResults.reduce((sum,item)=>sum+item.unmanagedArtifacts,0);
    this.#writeAudit(run.status==='success'?'backup.purge_propagation_completed':'backup.purge_propagation_attention','backup_propagation',run.id,run.completedAt);
    this.recordDiagnostic(run.status==='success'?'info':'warning','backup.purge_propagation',`Yedek imha yayılımı ${run.status} durumunda tamamlandı.`,`Bekleyen: ${run.pendingRemaining}; yenilenen hedef: ${run.refreshedTargets}/${run.targetCount}; karantinaya alınan yönetilen yedek: ${run.quarantinedArtifacts}; dokunulmayan yönetilmeyen yedek: ${unmanagedCount}`);
    return run;
  }

  public getAdaptiveResourceState(): AdaptiveResourceStateView { this.#requireAuth(); const resources=this.#systemResourceSnapshot('adaptive-resource-state'); const low=resources.totalMemoryBytes<8*1024**3, pressured=resources.memoryUsagePercent>=85||resources.cpuLoadPercent>=85; const profile=low?'low':resources.totalMemoryBytes>=16*1024**3?'high':'balanced'; return {generatedAt:nowIso(),profile,cpuLoadPercent:resources.cpuLoadPercent,memoryUsagePercent:resources.memoryUsagePercent,maxConcurrentJobs:pressured?1:profile==='high'?4:profile==='balanced'?2:1,deferBackgroundJobs:pressured,reason:pressured?'Sistem yükü yüksek; arka plan görevleri ertelendi.':`Donanım profili ${profile} olarak belirlendi.`}; }
  public runDueBackupTargets(at=nowIso()): BackupSchedulerResultView { const adaptive=this.getAdaptiveResourceState(),r=this.#listDueBackupTargetIdsUseCase.execute(this.#backupApplicationContext('backup-due'),at);if(!r.ok)throw new Error(`[${r.error.code}] ${r.error.message}`);const due=[...r.value];if(adaptive.deferBackgroundJobs){this.recordDiagnostic('warning','backup.scheduler_deferred','Yedek zamanlayıcısı yüksek sistem yükü nedeniyle ertelendi.',adaptive.reason);return {checkedAt:at,dueTargets:due.length,successful:0,failed:0,deferred:due.length,results:[]};}const results=due.slice(0,adaptive.maxConcurrentJobs).map(id=>this.runBackupTarget(id));return {checkedAt:at,dueTargets:due.length,successful:results.filter(x=>x.success).length,failed:results.filter(x=>!x.success).length,deferred:Math.max(0,due.length-results.length),results}; }
  public capturePerformanceSample(): PerformanceSampleView { this.#requireAuth(); const resources=this.#systemResourceSnapshot('performance-sample-resources'); const sample:PerformanceSampleView={id:randomUUID(),cpuLoadPercent:resources.cpuLoadPercent,memoryUsagePercent:resources.memoryUsagePercent,databaseBytes:resources.databaseBytes,archiveBytes:resources.archiveBytes,sampledAt:nowIso()}; const r=this.#recordPerformanceSampleUseCase.execute(this.#operationalHealthApplicationContext('performance-sample'),sample); if(!r.ok)throw new Error(`[${r.error.code}] ${r.error.message}`); return r.value; }
  public listPerformanceSamples(limit=100): PerformanceSampleView[] { const r=this.#listPerformanceSamplesUseCase.execute(this.#operationalHealthApplicationContext('performance-list'),limit); if(!r.ok)throw new Error(`[${r.error.code}] ${r.error.message}`); return [...r.value]; }
  public getPerformanceTrend(windowHours=24): PerformanceTrendView { const r=this.#getPerformanceTrendUseCase.execute(this.#operationalHealthApplicationContext('performance-trend'),windowHours); if(!r.ok)throw new Error(`[${r.error.code}] ${r.error.message}`); return r.value; }
  public recordDiagnostic(severity:DiagnosticEntryView['severity'],code:string,message:string,details?:string): void { const context=this.#operationalHealthApplicationContext('diagnostic-record'); const r=this.#recordDiagnosticUseCase.execute(context,{id:randomUUID(),severity,code,message,...(details?{details}:{}),occurredAt:nowIso()}); if(!r.ok)throw new Error(`[${r.error.code}] ${r.error.message}`); }
  public listDiagnostics(limit=100): DiagnosticEntryView[] { const r=this.#listDiagnosticsUseCase.execute(this.#operationalHealthApplicationContext('diagnostic-list'),limit); if(!r.ok)throw new Error(`[${r.error.code}] ${r.error.message}`); return [...r.value]; }
  public runMaintenance(operation:MaintenanceResultView['operation'],source:MaintenanceHistoryView['source']='manual'): MaintenanceResultView { this.#requireAuth(); const historyId=randomUUID(),startedAt=nowIso(),startedMs=Date.now(); try { const maintenance=this.#runDatabaseMaintenanceUseCase.execute(this.#correlation?.current()?.correlationId ?? asCorrelationId(`database-maintenance-${operation}-${randomUUID()}`),operation); if(!maintenance.ok)throw new Error(`[${maintenance.error.code}] ${maintenance.error.message}`); const result={operation,success:true,message:'İşlem başarıyla tamamlandı.',completedAt:nowIso()} as MaintenanceResultView; { const h={id:historyId,operation,success:true,message:result.message,startedAt,completedAt:result.completedAt,durationMs:Date.now()-startedMs,source}; const saved=this.#recordMaintenanceHistoryUseCase.execute(this.#operationalHealthApplicationContext('maintenance-history'),h); if(!saved.ok)throw new Error(`[${saved.error.code}] ${saved.error.message}`); } this.recordDiagnostic('info',`maintenance.${operation}`,result.message); return result; } catch(error){const message=error instanceof Error?error.message:String(error),completedAt=nowIso();{ const h={id:historyId,operation,success:false,message,startedAt,completedAt,durationMs:Date.now()-startedMs,source}; const saved=this.#recordMaintenanceHistoryUseCase.execute(this.#operationalHealthApplicationContext('maintenance-history-failed'),h); if(!saved.ok) return {operation,success:false,message:`${message}; geçmiş kaydı: ${saved.error.message}`,completedAt}; }this.recordDiagnostic('error',`maintenance.${operation}`,message);return {operation,success:false,message,completedAt};} }


  #writeAudit(action: string, resourceType: string, resourceId: string, occurredAt: string): void {
    const id=randomUUID();
    const result=this.#appendAuditEntryUseCase.execute(this.#auditWriteApplicationContext('audit-write',occurredAt),{id,action,resourceType,resourceId});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
  }

  #writeAuditAs(actorId: string, action: string, resourceType: string, resourceId: string, occurredAt: string): void {
    const result=this.#appendAuditEntryUseCase.execute({
      actorId: asUserId(actorId),
      correlationId:this.#correlation?.current()?.correlationId??asCorrelationId(`audit-write-${randomUUID()}`),
      occurredAt:asIsoDateTime(occurredAt)
    },{id:randomUUID(),action,resourceType,resourceId});
    if(!result.ok)throw new Error(`[${result.error.code}] ${result.error.message}`);
  }
}
