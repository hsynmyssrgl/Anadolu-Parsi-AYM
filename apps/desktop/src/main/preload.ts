import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_TRANSPORT_SCHEMA_VERSION,
  IpcTransportProtocolError,
  createZeroIpcTransportRevisions,
  mergeIpcTransportRevisions,
  unwrapIpcTransportResponse,
  type IpcTransportRequestContext,
  type IpcTransportRevisions
} from './ipc-transport-context.js';
import {
  IPC_REQUEST_CANCEL_ALL_CHANNEL,
  IPC_REQUEST_CANCEL_CHANNEL,
  createIpcRequestCancelAllMessage,
  createIpcRequestCancelMessage,
  resolveIpcRequestLifecyclePolicy,
  type IpcRequestCancellationReason
} from './ipc-request-lifecycle.js';
import {
  IpcReadSharingClient,
  createIpcReadSharingKey,
  resolveIpcReadSharingPolicy,
  shouldInvalidateIpcReadSharing
} from './ipc-read-sharing.js';
import type {
  FamilyMeetingCenterIpcView,
  FamilyMeetingMinutesIpcView,
  FamilyMeetingMutationIpcView,
  LocalGovernedOcrCenterIpcView,
  LocalGovernedOcrCorrectIpcInput,
  LocalGovernedOcrCreateIpcInput,
  LocalGovernedOcrDeleteIpcInput,
  LocalGovernedOcrJobMutationIpcInput,
  LocalGovernedOcrMutationIpcView,
  LocalGovernedOcrRerunIpcInput,
  LocalGovernedOcrResultIpcView,
  LocalGovernedOcrResultReadIpcInput,
  LocalGovernedOcrSearchIpcInput,
  LocalGovernedOcrSearchIpcView,
  LocalGovernedOcrSetEnabledIpcInput
} from './ipc-integration-policy.js';
import type { FamilyEventView, FamilyMutationResultView, SetFamilyEventArchivedInput, UpdateFamilyEventInput } from '@ppt/domain';
import type { UnifiedAuthorizedSearchInput, UnifiedAuthorizedSearchView } from '@ppt/domain';
import type { AddArchiveItemVersionInput, AddArchiveRelationEvidenceInput, ArchiveRelationEvidenceHistoryView, ArchiveRelationEvidenceView, RemoveArchiveRelationEvidenceInput } from '@ppt/domain';
import type { HealthCareCoordinationCenterView, HealthCareMutationReceiptView, RecordHealthCareEntryInput, RevokeHealthCareAccessGrantInput, UpsertHealthCareAccessGrantInput } from '@ppt/domain';
import type { CreateHouseholdOperationItemInput, DeleteHouseholdOperationItemInput, HouseholdOperationMutationReceiptView, HouseholdOperationsCenterView, UpdateHouseholdOperationItemInput } from '@ppt/domain';
import type { ChildEducationCenterView, ChildEducationMutationReceiptView, CreateChildEducationItemInput, DeleteChildEducationItemInput, UpdateChildEducationItemInput } from '@ppt/domain';
import type { CreatePlacesTravelItemInput, DeletePlacesTravelItemInput, PlacesTravelCenterView, PlacesTravelMutationReceiptView, UpdatePlacesTravelItemInput } from '@ppt/domain';
import type { FamilyAiAssistantCenterView, FamilyAiSuggestionMutationReceiptView, GenerateFamilyAiSuggestionInput, ReviewFamilyAiSuggestionInput } from '@ppt/domain';
import type { CreateMemoryStudioRecordInput, DeleteMemoryStudioRecordInput, CreateMemoryTimeCapsuleInput, MemoryStudioCenterView, MemoryStudioMutationReceiptView, ReviewMemoryTimeCapsuleInput, TransitionMemoryTimeCapsuleInput } from '@ppt/domain';
import type { GrantSmartHomeCameraConsentInput, RevokeSmartHomeCameraConsentInput, SetSmartHomeProcessingInput, SmartHomeEnergyCenterView, SmartHomeMutationReceiptView } from '@ppt/domain';
import type { EmergencyDisableSignedPluginInput, RollbackSignedPluginInput, SetSignedPluginDesiredStateInput, SignedPluginMutationReceiptView, SignedPluginPlatformCenterView } from '@ppt/domain';
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
  AnnotateCommunicationMessageInput,
  CommunicationMessageContentView,
  CommunicationMessageView,
  CommunicationMessagingCenterView,
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
  AddFamilyMeetingCollaborationInput,
  CastFamilyMeetingVoteInput,
  CreateFamilyMeetingInput,
  CreateFamilyMeetingPollInput,
  FinalizeFamilyMeetingMinutesInput,
  PrepareFamilyMeetingAiMinutesInput,
  RecordFamilyMeetingDecisionInput,
  SetFamilyMeetingStateInput,
  UpdateFamilyMeetingPlanInput,
  UpsertFamilyMeetingAgendaItemInput,
  UpsertFamilyMeetingParticipantInput,
  UpsertFamilyMeetingTaskInput
} from '@ppt/domain';
import type { LegacyArchiveOwnershipReattestationView, ReattestLegacyArchiveOwnershipInput } from '@ppt/domain';
import type { AssignPersonMembershipInput, CreateFamilyBranchInput, CreateHouseholdInput, FamilyBranch, Household, HouseholdMembershipWorkspaceView, PersonLifecycleProfile, PersonLifecycleWorkspaceView, PersonMembership, UpdatePersonProfileInput } from '@ppt/domain';
import type { AuthorizationContextWorkspaceView } from '@ppt/domain';
import type { IssueOfflineCapabilityLeaseInput, OfflineCapabilityLeaseWorkspaceView } from '@ppt/domain';
import type { LostDeviceShutdownInput, LostDeviceShutdownResultView, PrivacyControlCenterView, UpsertLiveLocationConsentInput } from '@ppt/domain';
import type { ClientDataAccessBoundaryView } from '@ppt/domain';
import type { NetworkEgressBoundaryView } from '@ppt/domain';
import type { DerivedDataPolicyBoundaryView } from '@ppt/domain';
import type { SensitiveLoggingBoundaryView } from '@ppt/domain';
import type { PolicyDecisionAuditBoundaryView } from '@ppt/domain';
import type { SourceDeletionPropagationBoundaryView } from '@ppt/domain';
import type { PolicyConformanceSuiteBoundaryView } from '@ppt/domain';
import type { PlatformPolicyAstGateBoundaryView } from '@ppt/domain';
import type { PlatformCapabilityManifestGateBoundaryView } from '@ppt/domain';
import type { ApplicationSecurityProfileGateBoundaryView } from '@ppt/domain';
import type { PolicyServiceAvailabilityBoundaryView } from '@ppt/domain';
import type { ProductSurfaceGovernanceView } from '@ppt/domain';
import type { DesktopSecurityPostureView, SessionLockStateView, UnlockSessionInput } from '@ppt/domain';
import type { DataRepairOperation, DataRepairWorkspaceView } from '@ppt/domain';
import type {
  EnrollWindowsHelloInput,
  LoginWithWindowsHelloInput,
  ReauthenticateWithWindowsHelloInput,
  WindowsHelloAuthenticationView,
  WindowsHelloEnrollmentView,
  WindowsHelloStateView
} from '@ppt/domain';
import type { CoreServiceApiBoundaryStatusContract, CoreServiceHealthContract } from '@ppt/core-service-contracts';
import type { UserVisibleAppInfo } from '@ppt/domain';
import type { PersonCatalogPageInput, PersonCatalogPageView, EventCatalogPageInput, EventCatalogPageView, EntityCatalogLookupInput, EntityCatalogLookupView } from '@ppt/domain';
import type { BackupPropagationRunView, BackupCleanRewriteStatusView, BackupCleanRewritePolicyView, BackupCleanRewriteRunView, BackupCleanRewriteRunResultView, UpdateBackupCleanRewritePolicyInput, BackupQuarantinePolicyView, BackupQuarantineBatchView, BackupQuarantineDestructionResultView, UpdateBackupQuarantinePolicyInput, SetBackupQuarantineLegalHoldInput, DestroyBackupQuarantineBatchInput, ExternalBackupCopyView, ExternalBackupInventorySummaryView, RegisterExternalBackupCopyInput, ReviewExternalBackupCopyInput, SetExternalBackupCopyLegalHoldInput, AttestExternalBackupCopyDestroyedInput, ExternalBackupEvidenceIssuerView, ExternalBackupEvidenceIssuerRotationView, ExternalBackupEvidenceRevocationListView, ExternalBackupRevocationEndpointView, ExternalBackupDestructionEvidenceView, RegisterExternalBackupEvidenceIssuerInput, RotateExternalBackupEvidenceIssuerInput, RevokeExternalBackupEvidenceIssuerInput, ApplyExternalBackupEvidenceRevocationListInput, UpsertExternalBackupRevocationEndpointInput, PendingRevocationSyncListView, ApplyPendingRevocationSyncInput, RevocationSyncEndpointStateView, RevocationSyncRunResultView, VerifyExternalBackupDestructionEvidenceInput, FamilyDataImportPreviewView, FamilyDataImportBatchView, ApplyFamilyDataImportInput, RollbackFamilyDataImportInput, GenealogyTreePageInput, GenealogyTreePageView, TimelinePageInput, TimelinePageView, ArchivePageInput, ArchivePageView, DataRetentionPolicyView, DataLifecycleRecordView, CreateDataRetentionPolicyInput, ArchiveDataResourceInput, RestoreDataResourceInput, RequestDataPurgeInput, CancelDataPurgeInput, ExecuteDataPurgeInput, SetDataLegalHoldInput } from '@ppt/domain';
import type { ArchiveItemView, AuthStateView, ExternalIdentityProviderView, CreateArchiveItemInput, CreateFamilyEventInput, UpdateEventParticipantsInput, UpdateEventInvitationInput, UpdateEventNotesInput, AcknowledgeFamilyNotificationInput, CreateFamilyLocationInput, CreateFamilyMemberInput, CreateFamilyRelationInput, DashboardOverviewView, FamilyAppSnapshot, FamilySnapshotSectionsInput, FamilySnapshotPatchView, LoginInput, SetupAdminInput, ChangePasswordInput, AuditEntryView, AuditIntegrityView, TwoFactorSetupView, EnableTwoFactorInput, DisableTwoFactorInput, TrustCurrentDeviceInput, ReauthorizeCurrentDeviceInput, ReauthorizeCurrentDeviceResultView, SecurityEventReceiptArchiveItemView, SecurityEventReceiptVerificationView, TrustedDeviceView, FamilyAccountView, FamilyInvitationView, FamilyInvitationInspectionView, CreateFamilyInvitationInput, InspectFamilyInvitationInput, ResendFamilyInvitationInput, AcceptFamilyInvitationInput, ObjectPermissionView, UpsertObjectPermissionInput, UpdateFamilyAccountInput, FinanceRecordView, CreateFinanceRecordInput, HealthRecordView, CreateHealthRecordInput, MedicationPlanView, CreateMedicationPlanInput, FamilyHealthHistoryView, CreateFamilyHealthHistoryInput, FinanceValuationView, CreateFinanceValuationInput, LifeRecordView, CreateLifeRecordInput, AutomationRuleView, CreateAutomationRuleInput, ReportSummaryView, GenealogyInsightView, ArchiveCategoryView, ArchiveClassificationView, CreateArchiveCategoryInput, UpdateArchiveClassificationInput, AiConsentView, UpsertAiConsentInput, AiAccessPreviewView, AiConsentPurpose, SensitiveDataProfileView, UpsertSensitiveDataConsentInput, SensitiveExportPreviewInput, SensitiveExportPreviewView, AutomationRunView, RunAutomationInput, DigitalLegacyPlanView, UpsertDigitalLegacyPlanInput, LegacyGrantView, UpsertLegacyGrantInput, ExecuteLegacyPlanInput, LegacyApprovalView, ApproveLegacyExecutionInput, CancelLegacyExecutionInput, ArchiveSearchInput, ArchiveVersionView, ArchiveRetentionPolicyView, CreateArchiveRetentionPolicyInput, AssignArchiveRetentionPolicyInput, ArchiveRetentionStatusView, SystemHealthView, BackupTargetView, UpsertBackupTargetInput, BackupRunView, BackupRunResultView, PerformanceSampleView, DiagnosticEntryView, MaintenanceResultView, BackupSchedulerResultView, AdaptiveResourceStateView, PerformanceTrendView, BackgroundTaskView, SchedulerStatusView, QueuedTaskView, EnqueueTaskInput, TaskQueueCycleResultView, MaintenancePolicyView, UpsertMaintenancePolicyInput, MaintenanceCycleResultView, HealthNotificationView, DiagnosticReportView, DiagnosticFilterInput, DiagnosticReportHistoryView, SystemHealthScoreView, SystemHealthHistoryView, SystemHealthTrendView, DiagnosticArchiveView, DiagnosticReportVerificationView, DiagnosticArchiveVerificationView, DiagnosticReportContentView, PerformanceAnomalyView, IpcPerformanceTelemetryView, IpcAdaptiveBudgetMaintenanceAuthorityView, IpcAdaptiveBudgetMaintenanceReauthenticationInput, IpcAdaptiveBudgetMaintenanceSessionView, IpcAdaptiveBudgetMaintenanceAuthorizationInput, IpcAdaptiveBudgetMaintenanceRecoveryAuthorityView, IpcAdaptiveBudgetMaintenanceRecoveryInput, IpcAdaptiveBudgetMaintenanceRecoveryView, IpcAdaptiveBudgetResetView, IpcAdaptiveBudgetDiagnosticExportView, MaintenanceRecommendationView, DiagnosticReportComparisonView, DiagnosticArchiveContentView, DiagnosticArchiveSearchInput, DiagnosticArchiveExportView, MaintenanceHistoryView, MaintenanceHistoryFilterInput, MaintenanceHistoryExportView, UnifiedDiagnosticArchiveSearchView, ExportArtifactView, ExportArtifactVerificationView, BackupInspectionView } from '@ppt/domain';
import type { BankInstitutionView, BankAccountView, CreateBankAccountInput, IbanStructuralValidationView, ValidateIbanInput, PaymentCardView, CreatePaymentCardInput } from '@ppt/domain';
import type { LoanAccountView, CreateLoanAccountInput, RecordLoanPaymentInput } from '@ppt/domain';
import type { FinancePlanningWorkspaceView, RecordFinancePlanningItemInput, FinanceImportPreviewView, SelectFinanceImportFileResult, CommitFinanceImportPreviewInput } from '@ppt/domain';
import type { LongTermPortfolioWorkspaceView, RecordLongTermPortfolioItemInput } from '@ppt/domain';
import type { AccessibilityPreferencesView, UpdateAccessibilityPreferencesInput } from '@ppt/domain';
import type { FormDraftView, FormDraftWorkspaceView, SaveFormDraftInput, UndoFormDraftInput } from '@ppt/domain';
import type { ManagedLifeWorkspaceView, RecordManagedLifeItemInput } from '@ppt/domain';
import type {
  AuthenticateWithPasskeyInput,CompanionSyncDenialView,CreateReadOnlyCompanionSnapshotInput,FederatedAuthorizationCeremonyView,FederatedIdentityProvider,
  IdentityAccessCredentialCenterView,IdentityAccessMutationReceiptView,IdentityAccessOperationKind,IdentityAccessOperationTokenView,IssueTemporaryVerifiableCredentialInput,IssuedTemporaryVerifiableCredentialView,
  PasskeyChallengeView,ReadOnlyCompanionSnapshotView,RecoverLostPasskeyInput,RevokePasskeyInput,RevokeTemporaryVerifiableCredentialInput,
  TemporaryCredentialVerificationView,UnlinkFederatedIdentityInput,VerifyTemporaryVerifiableCredentialInput
} from '@ppt/domain';
import type { WebAuthnAssertionInput,WebAuthnRegistrationInput } from '@ppt/security';
import type {
  CorrectAiMemoryInput,
  RestrictAiMemoryInput,
  DeleteAiMemoryInput,
  ExpireAiMemoryInput,
  CreateDataRightsRequestInput,
  UpdateDataRightsRequestInput,
  CreatePrivacyIncidentInput,
  UpdatePrivacyIncidentInput,
  SimulatePermissionVisibilityInput,
  PrivacyOwnershipControlCenterView,
  PrivacyOwnershipMutationReceiptView,
  PermissionSimulationView
} from '@ppt/domain';

export interface EncryptedPrivacyDataExportIpcInput {
  readonly requestId: string;
  readonly passphrase: string;
}
export type {
  FamilyMeetingCenterIpcView,
  FamilyMeetingMinutesIpcView,
  FamilyMeetingMutationIpcView,
  LocalGovernedOcrCenterIpcView,
  LocalGovernedOcrCorrectIpcInput,
  LocalGovernedOcrCreateIpcInput,
  LocalGovernedOcrDeleteIpcInput,
  LocalGovernedOcrJobMutationIpcInput,
  LocalGovernedOcrMutationIpcView,
  LocalGovernedOcrRerunIpcInput,
  LocalGovernedOcrResultIpcView,
  LocalGovernedOcrResultReadIpcInput,
  LocalGovernedOcrSearchIpcInput,
  LocalGovernedOcrSearchIpcView,
  LocalGovernedOcrSetEnabledIpcInput
};
export interface CompletePasskeyRegistrationIpcInput {
  readonly expectedRevision:number;readonly clientOperationId:string;readonly challengeId:string;readonly displayName:string;
  readonly response:WebAuthnRegistrationInput;readonly confirmation:'PASSKEY KAYDINI TAMAMLA';
}
export interface AuthenticateWithPasskeyIpcInput extends Omit<AuthenticateWithPasskeyInput,'ceremonyResponseId'> {
  readonly credentialId:string;readonly response:WebAuthnAssertionInput;readonly confirmation:'PASSKEY ILE DOGRULA';
}
export interface RecoverLostPasskeyIpcInput extends Omit<RecoverLostPasskeyInput,'recoveryProofId'> {readonly fallback?:{readonly password:string;readonly secondFactorCode?:string};readonly confirmation:'KAYIP PASSKEY KURTARMASINI BASLAT';}
export interface CompleteFederatedIdentityLinkIpcInput {readonly expectedRevision:number;readonly clientOperationId:string;readonly provider:FederatedIdentityProvider;readonly flowId:string;readonly confirmation:'FEDERATED KIMLIGI BAGLA';}
export interface EncryptedPrivacyDataExportIpcResult {
  readonly fileName: string;
  readonly artifactSha256: string;
  readonly artifactSizeBytes: number;
  readonly createdAt: string;
  readonly delivery: 'not_performed';
}

interface EmergencyCardExportIpcInput {
  readonly profileId:string;
  readonly configurationId:string;
  readonly mode:'print'|'pdf'|'encrypted_pack';
  readonly selectedFieldIds:readonly string[];
  readonly documentLinkIds:readonly string[];
  readonly password:string;
  readonly code?:string;
  readonly packagePassphrase?:string;
  readonly plaintextWarningConfirmed:boolean;
}
type EmergencyCardExportIpcResult =
  | { readonly canceled:true }
  | {
      readonly canceled:false;
      readonly mode:'print'|'pdf'|'encrypted_pack';
      readonly artifactSha256:string;
      readonly artifactSizeBytes:number;
      readonly powerSource:'battery'|'ac'|'unknown';
      readonly batteryLevel:'not_measured';
      readonly automaticLowBatteryDetection:'not_performed';
      readonly lowBatteryClaimed:false;
      readonly artifactReadbackStatus:'verified'|'not_applicable_print';
      readonly printerDispatchStatus?:'confirmed';
    };
export type AppInfo = UserVisibleAppInfo;

const rendererCrypto = globalThis.crypto;
if (!rendererCrypto || typeof rendererCrypto.randomUUID !== 'function') {
  throw new Error('Sandbox preload Web Crypto randomUUID kullanılamıyor.');
}
const randomUUID = (): string => rendererCrypto.randomUUID();
const ARCHIVE_OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const rawInvoke = ipcRenderer.invoke.bind(ipcRenderer);
const rendererSessionId = randomUUID();
const activeRequests = new Map<string, IpcTransportRequestContext>();
const latestRequestByChannel = new Map<string, IpcTransportRequestContext>();
const readSharing = new IpcReadSharingClient();
type ArchiveMutationChannel =
  | 'archive:import'
  | 'archive:open'
  | 'archive:secureDestroy'
  | 'archive:createRetentionPolicy'
  | 'archive:assignRetentionPolicy'
  | 'archive:createCategory'
  | 'archive:updateClassification';
interface ArchiveMutationRetryState {
  operationId?: string;
  intentFingerprint?: string;
  inflight?: Promise<unknown>;
}
interface ArchivePendingOperationIdentity {
  readonly operationId: string;
  readonly intentFingerprint: string;
  readonly mutation: ArchiveMutationChannel;
  readonly recovered: boolean;
  readonly state: 'pending' | 'acknowledged';
}
const archiveMutationRetries = new Map<string, ArchiveMutationRetryState>();
const sessionBoundaryChannels = new Set([
  'auth:setup',
  'auth:login',
  'auth:loginWithWindowsHello',
  'auth:lockSession',
  'auth:unlockSession',
  'auth:logout',
  'auth:reauthorizeCurrentDeviceAfterRecovery',
  'invitations:accept',
  'backup:restoreFull'
]);
let transportSessionEpoch = 0;
let transportRequestSequence = 0;
let transportRevisions: IpcTransportRevisions = createZeroIpcTransportRevisions();

const sendCancellation = (request: IpcTransportRequestContext, reason: IpcRequestCancellationReason): void => {
  void rawInvoke(IPC_REQUEST_CANCEL_CHANNEL, createIpcRequestCancelMessage(request, reason)).catch(() => undefined);
};

const cancelCurrentEpoch = (reason: 'session-changed' | 'renderer-unloaded' | 'manual'): void => {
  if (activeRequests.size === 0) return;
  void rawInvoke(
    IPC_REQUEST_CANCEL_ALL_CHANNEL,
    createIpcRequestCancelAllMessage(rendererSessionId, transportSessionEpoch, reason)
  ).catch(() => undefined);
};

const advanceTransportSession = (): void => {
  cancelCurrentEpoch('session-changed');
  if (transportSessionEpoch >= 2_147_483_647) throw new Error('IPC oturum çağı güvenli sınırı aştı.');
  transportSessionEpoch += 1;
  transportRequestSequence = 0;
  transportRevisions = createZeroIpcTransportRevisions();
  activeRequests.clear();
  latestRequestByChannel.clear();
  archiveMutationRetries.clear();
  readSharing.invalidate();
};

async function invokeTransport<TResult>(channel: string, ...args: unknown[]): Promise<TResult> {
  const lifecyclePolicy = resolveIpcRequestLifecyclePolicy(channel);
  if (lifecyclePolicy.latestWins) {
    const previous = latestRequestByChannel.get(channel);
    if (previous) sendCancellation(previous, 'superseded');
  }
  transportRequestSequence += 1;
  const request: IpcTransportRequestContext = Object.freeze({
    schemaVersion: IPC_TRANSPORT_SCHEMA_VERSION,
    rendererSessionId,
    requestId: randomUUID(),
    sessionEpoch: transportSessionEpoch,
    requestSequence: transportRequestSequence,
    channel,
    revisions: transportRevisions
  });
  activeRequests.set(request.requestId, request);
  if (lifecyclePolicy.latestWins) latestRequestByChannel.set(channel, request);
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const invocation = rawInvoke(channel, request, ...args);
  const timed = lifecyclePolicy.cancellable && lifecyclePolicy.timeoutMs > 0
    ? new Promise<never>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => {
          sendCancellation(request, 'timeout');
          reject(new IpcTransportProtocolError('REQUEST_TIMEOUT', `IPC isteği süre aşımına uğradı: ${channel}.`));
        }, lifecyclePolicy.timeoutMs);
      })
    : undefined;
  try {
    const response = timed ? await Promise.race([invocation, timed]) : await invocation;
    const result = unwrapIpcTransportResponse<TResult>({
      expectedRequest: request,
      currentSessionEpoch: transportSessionEpoch,
      response
    });
    if (typeof result === 'object' && result !== null && 'revisions' in result) {
      transportRevisions = mergeIpcTransportRevisions(
        transportRevisions,
        (result as { readonly revisions?: unknown }).revisions
      );
    }
    return result;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    activeRequests.delete(request.requestId);
    if (latestRequestByChannel.get(channel)?.requestId === request.requestId) latestRequestByChannel.delete(channel);
  }
}

const invalidateSharedReads = (): void => {
  readSharing.invalidate();
  for (const request of activeRequests.values()) {
    if (resolveIpcReadSharingPolicy(request.channel).enabled) sendCancellation(request, 'superseded');
  }
};

async function invoke<TResult>(channel: string, ...args: unknown[]): Promise<TResult> {
  if (sessionBoundaryChannels.has(channel)) advanceTransportSession();
  const sharingPolicy = resolveIpcReadSharingPolicy(channel);
  if (!sharingPolicy.enabled) {
    if (shouldInvalidateIpcReadSharing(channel)) invalidateSharedReads();
    return invokeTransport<TResult>(channel, ...args);
  }
  const key = createIpcReadSharingKey({
    rendererSessionId,
    sessionEpoch: transportSessionEpoch,
    channel,
    revisions: transportRevisions,
    arguments: args
  });
  return readSharing.execute(key, sharingPolicy, () => invokeTransport<TResult>(channel, ...args));
}

const canonicalArchiveMutationValue = (value: unknown): string => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Arşiv mutasyonu sonlu bir sayı gerektirir.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalArchiveMutationValue).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalArchiveMutationValue(record[key])}`)
      .join(',')}}`;
  }
  throw new Error('Arşiv mutasyonu kanonik JSON ile temsil edilemiyor.');
};

async function invokeArchiveMutation<TResult, TSemantic>(
  channel: ArchiveMutationChannel,
  semanticInput: TSemantic,
  createPayload: (operationId: string) => unknown
): Promise<TResult> {
  const retryKey = `${channel}:${canonicalArchiveMutationValue(semanticInput)}`;
  let state = archiveMutationRetries.get(retryKey);
  if (state?.inflight) return state.inflight as Promise<TResult>;
  if (!state) {
    state = {};
    archiveMutationRetries.set(retryKey, state);
  }
  const retryState = state;
  const invocation = (async (): Promise<TResult> => {
    if (!retryState.operationId) {
      const acquired = await invoke<ArchivePendingOperationIdentity>(
        'archive:operationIdentity:acquire',
        { mutation: channel, semanticInput }
      );
      if (
        !ARCHIVE_OPERATION_ID.test(acquired.operationId)
        || !/^[0-9a-f]{64}$/u.test(acquired.intentFingerprint)
        || acquired.mutation !== channel
        || acquired.state !== 'pending'
      ) {
        throw new Error('Kalıcı arşiv işlem kimliği edinimi doğrulanamadı.');
      }
      retryState.operationId = acquired.operationId;
      retryState.intentFingerprint = acquired.intentFingerprint;
    }
    const result = await invoke<TResult>(channel, createPayload(retryState.operationId));
    const acknowledged = await invoke<ArchivePendingOperationIdentity>(
      'archive:operationIdentity:acknowledge',
      { operationId: retryState.operationId, mutation: channel, semanticInput }
    );
    if (
      acknowledged.operationId !== retryState.operationId
      || acknowledged.intentFingerprint !== retryState.intentFingerprint
      || acknowledged.mutation !== channel
      || acknowledged.state !== 'acknowledged'
    ) {
      throw new Error('Kalıcı arşiv işlem kimliği onayı doğrulanamadı.');
    }
    return result;
  })();
  state.inflight = invocation;
  try {
    const result = await invocation;
    if (archiveMutationRetries.get(retryKey) === state) archiveMutationRetries.delete(retryKey);
    return result;
  } catch (error) {
    if (archiveMutationRetries.get(retryKey) === state) delete state.inflight;
    throw error;
  }
}


const rendererLifecycleTarget = globalThis as typeof globalThis & {
  readonly addEventListener?: (
    type: 'beforeunload',
    listener: () => void,
    options?: { readonly once?: boolean }
  ) => void;
};
rendererLifecycleTarget.addEventListener?.('beforeunload', () => cancelCurrentEpoch('renderer-unloaded'), { once: true });
contextBridge.exposeInMainWorld('pardus', {
  enqueueTask:(input:EnqueueTaskInput):Promise<QueuedTaskView>=>invoke('system:enqueueTask',input),
  listQueuedTasks:(limit?:number):Promise<QueuedTaskView[]>=>invoke('system:listQueuedTasks',limit),
  processTaskQueue:():Promise<TaskQueueCycleResultView>=>invoke('system:processTaskQueue'),
  getMaintenancePolicy:():Promise<MaintenancePolicyView>=>invoke('system:getMaintenancePolicy'),
  upsertMaintenancePolicy:(input:UpsertMaintenancePolicyInput):Promise<MaintenancePolicyView>=>invoke('system:upsertMaintenancePolicy',input),
  runAutomaticMaintenance:():Promise<MaintenanceCycleResultView>=>invoke('system:runAutomaticMaintenance'),
  listHealthNotifications:(limit?:number):Promise<HealthNotificationView[]>=>invoke('system:listHealthNotifications',limit),
  evaluateHealthNotifications:():Promise<HealthNotificationView[]>=>invoke('system:evaluateHealthNotifications'),
  acknowledgeHealthNotification:(id:string):Promise<HealthNotificationView[]>=>invoke('system:acknowledgeHealthNotification',id),
  getDiagnosticReport:():Promise<DiagnosticReportView>=>invoke('system:getDiagnosticReport'),
  exportDiagnosticReport:():Promise<{canceled:boolean;filePath?:string}>=>invoke('system:exportDiagnosticReport'),
  listExportArtifacts:(limit?:number):Promise<ExportArtifactView[]>=>invoke('system:listExportArtifacts',limit),
  verifyExportArtifact:(id:string):Promise<ExportArtifactVerificationView>=>invoke('system:verifyExportArtifact',id),
  getSystemHealth:():Promise<SystemHealthView>=>invoke('system:health'),
  getCoreServiceHealth:():Promise<CoreServiceHealthContract>=>invoke('system:getCoreServiceHealth'),
  getCoreServiceApiBoundary:():Promise<CoreServiceApiBoundaryStatusContract>=>invoke('system:getCoreServiceApiBoundary'),
  getNetworkEgressBoundary:():Promise<NetworkEgressBoundaryView>=>invoke('system:getNetworkEgressBoundary'),
  getDerivedDataPolicyBoundary:():Promise<DerivedDataPolicyBoundaryView>=>invoke('system:getDerivedDataPolicyBoundary'),
  getSensitiveLoggingBoundary:():Promise<SensitiveLoggingBoundaryView>=>invoke('system:getSensitiveLoggingBoundary'),
  getPolicyDecisionAuditBoundary:():Promise<PolicyDecisionAuditBoundaryView>=>invoke('system:getPolicyDecisionAuditBoundary'),
  getSourceDeletionPropagationBoundary:():Promise<SourceDeletionPropagationBoundaryView>=>invoke('system:getSourceDeletionPropagationBoundary'),
  getPolicyConformanceSuiteBoundary:():Promise<PolicyConformanceSuiteBoundaryView>=>invoke('system:getPolicyConformanceSuiteBoundary'),
  getPlatformPolicyAstGateBoundary:():Promise<PlatformPolicyAstGateBoundaryView>=>invoke('system:getPlatformPolicyAstGateBoundary'),
  getPlatformCapabilityManifestGateBoundary:():Promise<PlatformCapabilityManifestGateBoundaryView>=>invoke('system:getPlatformCapabilityManifestGateBoundary'),
  getApplicationSecurityProfileGateBoundary:():Promise<ApplicationSecurityProfileGateBoundaryView>=>invoke('system:getApplicationSecurityProfileGateBoundary'),
  getPolicyServiceAvailabilityBoundary:():Promise<PolicyServiceAvailabilityBoundaryView>=>invoke('system:getPolicyServiceAvailabilityBoundary'),
  getProductSurfaceGovernance:():Promise<ProductSurfaceGovernanceView>=>invoke('system:getProductSurfaceGovernance'),
  getDesktopSecurityPosture:():Promise<DesktopSecurityPostureView>=>invoke('system:getDesktopSecurityPosture'),
  listBackupTargets:():Promise<BackupTargetView[]>=>invoke('system:listBackupTargets'),
  upsertBackupTarget:(input:UpsertBackupTargetInput):Promise<BackupTargetView[]>=>invoke('system:upsertBackupTarget',input),
  listBackupRuns:(limit?:number):Promise<BackupRunView[]>=>invoke('system:listBackupRuns',limit),
  runBackupTarget:(id:string):Promise<BackupRunResultView>=>invoke('system:runBackupTarget',id),
  runAllBackups:():Promise<BackupRunResultView[]>=>invoke('system:runAllBackups'),
  runDueBackups:(at?:string):Promise<BackupSchedulerResultView>=>invoke('system:runDueBackups',at),
  getAdaptiveState:():Promise<AdaptiveResourceStateView>=>invoke('system:adaptiveState'),
  capturePerformance:():Promise<PerformanceSampleView>=>invoke('system:capturePerformance'),
  listPerformance:(limit?:number):Promise<PerformanceSampleView[]>=>invoke('system:listPerformance',limit),
  getPerformanceTrend:(hours?:number):Promise<PerformanceTrendView>=>invoke('system:getPerformanceTrend',hours),
  listBackgroundTasks:(limit?:number):Promise<BackgroundTaskView[]>=>invoke('system:listBackgroundTasks',limit),
  getSchedulerStatus:():Promise<SchedulerStatusView>=>invoke('system:schedulerStatus'),
  listDiagnostics:(limit?:number):Promise<DiagnosticEntryView[]>=>invoke('system:listDiagnostics',limit),
  searchDiagnostics:(input:DiagnosticFilterInput):Promise<DiagnosticEntryView[]>=>invoke('system:searchDiagnostics',input),
  getHealthScore:():Promise<SystemHealthScoreView>=>invoke('system:getHealthScore'),
  listDiagnosticReports:(limit?:number):Promise<DiagnosticReportHistoryView[]>=>invoke('system:listDiagnosticReports',limit),
  captureHealthScore:():Promise<SystemHealthHistoryView>=>invoke('system:captureHealthScore'),
  listHealthHistory:(limit?:number):Promise<SystemHealthHistoryView[]>=>invoke('system:listHealthHistory',limit),
  getHealthTrend:(days?:number):Promise<SystemHealthTrendView>=>invoke('system:getHealthTrend',days),
  listDiagnosticArchives:(limit?:number):Promise<DiagnosticArchiveView[]>=>invoke('system:listDiagnosticArchives',limit),
  archiveDiagnostics:(before?:string):Promise<{canceled:boolean;archive?:DiagnosticArchiveView}>=>invoke('system:archiveDiagnostics',before),
  verifyDiagnosticArchive:(id:string):Promise<DiagnosticArchiveVerificationView>=>invoke('system:verifyDiagnosticArchive',id),
  readDiagnosticReport:(id:string):Promise<DiagnosticReportContentView>=>invoke('system:readDiagnosticReport',id),
  verifyDiagnosticReport:(id:string):Promise<DiagnosticReportVerificationView>=>invoke('system:verifyDiagnosticReport',id),
  compareDiagnosticReports:(leftId:string,rightId:string):Promise<DiagnosticReportComparisonView>=>invoke('system:compareDiagnosticReports',leftId,rightId),
  readDiagnosticArchive:(id:string):Promise<DiagnosticArchiveContentView>=>invoke('system:readDiagnosticArchive',id),
  searchDiagnosticArchive:(id:string,input:DiagnosticArchiveSearchInput):Promise<DiagnosticArchiveContentView>=>invoke('system:searchDiagnosticArchive',id,input),
  exportDiagnosticArchiveEntries:(id:string,input:DiagnosticArchiveSearchInput,format:'json'|'csv'):Promise<{canceled:boolean;export?:DiagnosticArchiveExportView}>=>invoke('system:exportDiagnosticArchiveEntries',id,input,format),
  listMaintenanceHistory:(limit?:number):Promise<MaintenanceHistoryView[]>=>invoke('system:listMaintenanceHistory',limit),

  searchMaintenanceHistory:(input:MaintenanceHistoryFilterInput):Promise<MaintenanceHistoryView[]>=>invoke('system:searchMaintenanceHistory',input),
  exportMaintenanceHistory:(input:MaintenanceHistoryFilterInput,format:'json'|'csv'):Promise<{canceled:boolean;export?:MaintenanceHistoryExportView}>=>invoke('system:exportMaintenanceHistory',input,format),
  searchAllDiagnosticArchives:(input:DiagnosticArchiveSearchInput):Promise<UnifiedDiagnosticArchiveSearchView>=>invoke('system:searchAllDiagnosticArchives',input),
  exportSystemPdf:():Promise<{canceled:boolean;filePath?:string;sizeBytes?:number;sha256?:string}>=>invoke('system:exportSystemPdf'),

  getPerformanceAnomalies:(hours?:number):Promise<PerformanceAnomalyView[]>=>invoke('system:getPerformanceAnomalies',hours),
  getIpcAdaptiveBudgetMaintenanceAuthority:():Promise<IpcAdaptiveBudgetMaintenanceAuthorityView>=>invoke('system:getIpcAdaptiveBudgetMaintenanceAuthority'),
  getIpcAdaptiveBudgetMaintenanceRecoveryAuthority:():Promise<IpcAdaptiveBudgetMaintenanceRecoveryAuthorityView>=>invoke('system:getIpcAdaptiveBudgetMaintenanceRecoveryAuthority'),
  recoverIpcAdaptiveBudgetMaintenanceLock:(input:IpcAdaptiveBudgetMaintenanceRecoveryInput):Promise<IpcAdaptiveBudgetMaintenanceRecoveryView>=>invoke('system:recoverIpcAdaptiveBudgetMaintenanceLock',input),
  getIpcPerformanceTelemetry:():Promise<IpcPerformanceTelemetryView>=>invoke('system:getIpcPerformanceTelemetry'),
  resetIpcAdaptiveBudget:async(reauthentication:IpcAdaptiveBudgetMaintenanceReauthenticationInput):Promise<IpcAdaptiveBudgetResetView>=>{const session=await invoke<IpcAdaptiveBudgetMaintenanceSessionView>('system:beginIpcAdaptiveBudgetMaintenanceSession','reset',rendererSessionId,reauthentication);if(session.canceled||!session.sessionId)return {canceled:true};const authorization:IpcAdaptiveBudgetMaintenanceAuthorizationInput={sessionId:session.sessionId,rendererSessionId,operation:'reset'};return invoke('system:resetIpcAdaptiveBudget',authorization);},
  exportIpcAdaptiveBudgetDiagnostics:async(reauthentication:IpcAdaptiveBudgetMaintenanceReauthenticationInput):Promise<IpcAdaptiveBudgetDiagnosticExportView>=>{const session=await invoke<IpcAdaptiveBudgetMaintenanceSessionView>('system:beginIpcAdaptiveBudgetMaintenanceSession','diagnostics-export',rendererSessionId,reauthentication);if(session.canceled||!session.sessionId)return {canceled:true};const authorization:IpcAdaptiveBudgetMaintenanceAuthorizationInput={sessionId:session.sessionId,rendererSessionId,operation:'diagnostics-export'};return invoke('system:exportIpcAdaptiveBudgetDiagnostics',authorization);},
  getMaintenanceRecommendations:():Promise<MaintenanceRecommendationView[]>=>invoke('system:getMaintenanceRecommendations'),
  runMaintenance:(operation:MaintenanceResultView['operation']):Promise<MaintenanceResultView>=>invoke('system:maintenance',operation),
  getAppInfo: (): Promise<AppInfo> => invoke('app:getInfo'),
  getGenealogyInsights: ():Promise<GenealogyInsightView> => invoke('genealogy:insights'),
  listLargeGenealogyTree:(input:GenealogyTreePageInput={}):Promise<GenealogyTreePageView>=>invoke('largeData:tree',input),
  listLargeTimeline:(input:TimelinePageInput={}):Promise<TimelinePageView>=>invoke('largeData:timeline',input),
  listLargeArchive:(input:ArchivePageInput={}):Promise<ArchivePageView>=>invoke('largeData:archive',input),
  reattestLegacyArchiveOwnership:(input:ReattestLegacyArchiveOwnershipInput):Promise<LegacyArchiveOwnershipReattestationView>=>invoke('archive:reattestLegacyOwnership',input),
  listArchiveCategories: ():Promise<ArchiveCategoryView[]> => invoke('archive:listCategories'),
  createArchiveCategory: (input:CreateArchiveCategoryInput):Promise<ArchiveCategoryView[]> =>
    invokeArchiveMutation('archive:createCategory', input, (operationId) => ({ ...input, operationId })),
  listArchiveClassifications: ():Promise<ArchiveClassificationView[]> => invoke('archive:listClassifications'),
  updateArchiveClassification: (input:UpdateArchiveClassificationInput):Promise<ArchiveClassificationView[]> =>
    invokeArchiveMutation('archive:updateClassification', input, (operationId) => ({ ...input, operationId })),
  listAiConsents: ():Promise<AiConsentView[]> => invoke('ai:listConsents'),
  upsertAiConsent: (input:UpsertAiConsentInput):Promise<AiConsentView[]> => invoke('ai:upsertConsent',input),
  previewAiAccess: (purpose:AiConsentPurpose):Promise<AiAccessPreviewView> => invoke('ai:previewAccess',purpose),
  listSensitiveDataProfiles: ():Promise<SensitiveDataProfileView[]> => invoke('ai:listSensitiveProfiles'),
  upsertSensitiveDataConsent: (input:UpsertSensitiveDataConsentInput):Promise<SensitiveDataProfileView[]> => invoke('ai:upsertSensitiveConsent',input),
  previewSensitiveExport: (input:SensitiveExportPreviewInput):Promise<SensitiveExportPreviewView> => invoke('ai:previewSensitiveExport',input),
  getAuthState: (): Promise<AuthStateView> => invoke('auth:getState'),
  getAccessibilityPreferences:():Promise<AccessibilityPreferencesView>=>invoke('accessibility:getPreferences'),
  updateAccessibilityPreferences:(input:UpdateAccessibilityPreferencesInput):Promise<AccessibilityPreferencesView>=>invoke('accessibility:updatePreferences',input),
  getFormDraftWorkspace:(formKey:string):Promise<FormDraftWorkspaceView>=>invoke('formDraft:getWorkspace',formKey),
  saveFormDraft:(input:SaveFormDraftInput):Promise<FormDraftView>=>invoke('formDraft:save',input),
  undoFormDraft:(input:UndoFormDraftInput):Promise<FormDraftView>=>invoke('formDraft:undo',input),
  getLocalGovernedOcrCenter:():Promise<LocalGovernedOcrCenterIpcView>=>invoke('localOcr:getCenter'),
  getLocalGovernedOcrResult:(input:LocalGovernedOcrResultReadIpcInput):Promise<LocalGovernedOcrResultIpcView>=>invoke('localOcr:getResult',input),
  searchLocalGovernedOcr:(input:LocalGovernedOcrSearchIpcInput):Promise<LocalGovernedOcrSearchIpcView>=>invoke('localOcr:search',input),
  createLocalGovernedOcrJob:(input:LocalGovernedOcrCreateIpcInput):Promise<LocalGovernedOcrMutationIpcView>=>invoke('localOcr:create',input),
  runLocalGovernedOcrJob:(input:LocalGovernedOcrJobMutationIpcInput):Promise<LocalGovernedOcrMutationIpcView>=>invoke('localOcr:run',input),
  cancelLocalGovernedOcrJob:(input:LocalGovernedOcrJobMutationIpcInput):Promise<LocalGovernedOcrMutationIpcView>=>invoke('localOcr:cancel',input),
  correctLocalGovernedOcrResult:(input:LocalGovernedOcrCorrectIpcInput):Promise<LocalGovernedOcrMutationIpcView>=>invoke('localOcr:correct',input),
  rerunLocalGovernedOcrJob:(input:LocalGovernedOcrRerunIpcInput):Promise<LocalGovernedOcrMutationIpcView>=>invoke('localOcr:rerun',input),
  deleteLocalGovernedOcrJob:(input:LocalGovernedOcrDeleteIpcInput):Promise<LocalGovernedOcrMutationIpcView>=>invoke('localOcr:delete',input),
  setLocalGovernedOcrEnabled:(input:LocalGovernedOcrSetEnabledIpcInput):Promise<LocalGovernedOcrMutationIpcView>=>invoke('localOcr:setEnabled',input),
  getIdentityAccessCredentialCenter:():Promise<IdentityAccessCredentialCenterView>=>invoke('identityAccess:getCenter'),
  issueIdentityAccessOperationToken:(operationKind:IdentityAccessOperationKind):Promise<IdentityAccessOperationTokenView>=>invoke('identityAccess:issueOperationToken',{operationKind}),
  beginPasskeyRegistration:(input:{readonly clientOperationId:string}):Promise<PasskeyChallengeView>=>invoke('identityAccess:beginPasskeyRegistration',input),
  beginPasskeyAuthentication:(input:{readonly clientOperationId:string}):Promise<PasskeyChallengeView>=>invoke('identityAccess:beginPasskeyAuthentication',input),
  completePasskeyRegistration:(input:CompletePasskeyRegistrationIpcInput):Promise<IdentityAccessMutationReceiptView>=>invoke('identityAccess:completePasskeyRegistration',input),
  authenticateWithPasskey:(input:AuthenticateWithPasskeyIpcInput):Promise<IdentityAccessMutationReceiptView>=>invoke('identityAccess:authenticateWithPasskey',input),
  revokePasskey:(input:RevokePasskeyInput&{readonly confirmation:'PASSKEY YETKISINI IPTAL ET'}):Promise<IdentityAccessMutationReceiptView>=>invoke('identityAccess:revokePasskey',input),
  recoverLostPasskey:(input:RecoverLostPasskeyIpcInput):Promise<IdentityAccessMutationReceiptView>=>invoke('identityAccess:recoverLostPasskey',input),
  beginFederatedIdentityLink:(input:{readonly clientOperationId:string;readonly provider:FederatedIdentityProvider}):Promise<FederatedAuthorizationCeremonyView>=>invoke('identityAccess:beginFederatedIdentityLink',input),
  completeFederatedIdentityLink:(input:CompleteFederatedIdentityLinkIpcInput):Promise<IdentityAccessMutationReceiptView>=>invoke('identityAccess:completeFederatedIdentityLink',input),
  unlinkFederatedIdentity:(input:UnlinkFederatedIdentityInput&{readonly confirmation:'FEDERATED KIMLIK BAGINI KALDIR'}):Promise<IdentityAccessMutationReceiptView>=>invoke('identityAccess:unlinkFederatedIdentity',input),
  issueTemporaryVerifiableCredential:(input:IssueTemporaryVerifiableCredentialInput&{readonly confirmation:'GECICI YETKI BELGESI OLUSTUR'}):Promise<{readonly receipt:IdentityAccessMutationReceiptView;readonly issued?:IssuedTemporaryVerifiableCredentialView}>=>invoke('identityAccess:issueTemporaryCredential',input),
  revokeTemporaryVerifiableCredential:(input:RevokeTemporaryVerifiableCredentialInput&{readonly confirmation:'GECICI YETKI BELGESINI IPTAL ET'}):Promise<IdentityAccessMutationReceiptView>=>invoke('identityAccess:revokeTemporaryCredential',input),
  verifyTemporaryVerifiableCredential:(input:VerifyTemporaryVerifiableCredentialInput):Promise<TemporaryCredentialVerificationView>=>invoke('identityAccess:verifyTemporaryCredential',input),
  createReadOnlyCompanionSnapshot:(input:CreateReadOnlyCompanionSnapshotInput&{readonly clientOperationId:string;readonly confirmation:'SALT OKUNUR ESLIKCI KOPYASI OLUSTUR'}):Promise<ReadOnlyCompanionSnapshotView|CompanionSyncDenialView>=>invoke('identityAccess:createCompanionSnapshot',input),
  getPrivacyOwnershipCenter:():Promise<PrivacyOwnershipControlCenterView>=>invoke('privacyOwnership:getCenter'),
  correctAiMemory:(input:CorrectAiMemoryInput):Promise<PrivacyOwnershipMutationReceiptView>=>invoke('privacyOwnership:correctAiMemory',input),
  restrictAiMemory:(input:RestrictAiMemoryInput):Promise<PrivacyOwnershipMutationReceiptView>=>invoke('privacyOwnership:restrictAiMemory',input),
  deleteAiMemory:(input:DeleteAiMemoryInput):Promise<PrivacyOwnershipMutationReceiptView>=>invoke('privacyOwnership:deleteAiMemory',input),
  expireAiMemory:(input:ExpireAiMemoryInput):Promise<PrivacyOwnershipMutationReceiptView>=>invoke('privacyOwnership:expireAiMemory',input),
  createPrivacyRightsRequest:(input:CreateDataRightsRequestInput):Promise<PrivacyOwnershipMutationReceiptView>=>invoke('privacyOwnership:createRightsRequest',input),
  updatePrivacyRightsRequest:(input:UpdateDataRightsRequestInput):Promise<PrivacyOwnershipMutationReceiptView>=>invoke('privacyOwnership:updateRightsRequest',input),
  createPrivacyIncident:(input:CreatePrivacyIncidentInput):Promise<PrivacyOwnershipMutationReceiptView>=>invoke('privacyOwnership:createIncident',input),
  updatePrivacyIncident:(input:UpdatePrivacyIncidentInput):Promise<PrivacyOwnershipMutationReceiptView>=>invoke('privacyOwnership:updateIncident',input),
  simulatePrivacyPermission:(input:SimulatePermissionVisibilityInput):Promise<PermissionSimulationView>=>invoke('privacyOwnership:simulatePermission',input),
  exportEncryptedPrivacyData:(input:EncryptedPrivacyDataExportIpcInput):Promise<EncryptedPrivacyDataExportIpcResult>=>invoke('privacyOwnership:exportEncrypted',input),
  getSessionLockState:():Promise<SessionLockStateView>=>invoke('auth:getSessionLockState'),
  recordSessionActivity:():Promise<SessionLockStateView>=>invoke('auth:recordSessionActivity'),
  lockSession:():Promise<SessionLockStateView>=>invoke('auth:lockSession'),
  unlockSession:(input:UnlockSessionInput):Promise<AuthStateView>=>invoke('auth:unlockSession',input),
  getExternalIdentityProviders: (): Promise<ExternalIdentityProviderView[]> => invoke('auth:getExternalIdentityProviders'),
  setupAdmin: (input:SetupAdminInput):Promise<AuthStateView> => invoke('auth:setup',input),
  login: (input:LoginInput):Promise<AuthStateView> => invoke('auth:login',input),
  getWindowsHelloState:():Promise<WindowsHelloStateView>=>invoke('auth:getWindowsHelloState'),
  enrollWindowsHello:(input:EnrollWindowsHelloInput):Promise<WindowsHelloEnrollmentView>=>invoke('auth:enrollWindowsHello',input),
  loginWithWindowsHello:(input:LoginWithWindowsHelloInput):Promise<WindowsHelloAuthenticationView>=>invoke('auth:loginWithWindowsHello',input),
  reauthenticateWithWindowsHello:(input:ReauthenticateWithWindowsHelloInput):Promise<WindowsHelloAuthenticationView>=>invoke('auth:reauthenticateWithWindowsHello',input),
  logout: ():Promise<AuthStateView> => invoke('auth:logout'),
  changePassword:(input:ChangePasswordInput):Promise<AuthStateView>=>invoke('auth:changePassword',input),
  beginTwoFactorSetup:():Promise<TwoFactorSetupView>=>invoke('auth:beginTwoFactorSetup'),
  enableTwoFactor:(input:EnableTwoFactorInput):Promise<AuthStateView>=>invoke('auth:enableTwoFactor',input),
  disableTwoFactor:(input:DisableTwoFactorInput):Promise<AuthStateView>=>invoke('auth:disableTwoFactor',input),
  trustCurrentDevice:(input:TrustCurrentDeviceInput):Promise<TrustedDeviceView[]>=>invoke('auth:trustCurrentDevice',input),
  reauthorizeCurrentDeviceAfterRecovery:(input:ReauthorizeCurrentDeviceInput):Promise<ReauthorizeCurrentDeviceResultView>=>invoke('auth:reauthorizeCurrentDeviceAfterRecovery',input),
  listSecurityEventReceipts:(limit?:number):Promise<SecurityEventReceiptArchiveItemView[]>=>invoke('auth:listSecurityEventReceipts',limit),
  verifySecurityEventReceipt:(receiptJson:string):Promise<SecurityEventReceiptVerificationView>=>invoke('auth:verifySecurityEventReceipt',receiptJson),
  listTrustedDevices:():Promise<TrustedDeviceView[]>=>invoke('auth:listTrustedDevices'),
  revokeTrustedDevice:(id:string):Promise<TrustedDeviceView[]>=>invoke('auth:revokeTrustedDevice',id),
  getPrivacyControlCenter:():Promise<PrivacyControlCenterView>=>invoke('privacyControl:getCenter'),
  setLiveLocationConsent:(input:UpsertLiveLocationConsentInput):Promise<PrivacyControlCenterView>=>invoke('privacyControl:setLiveLocationConsent',input),
  shutdownLostDevice:(input:LostDeviceShutdownInput):Promise<LostDeviceShutdownResultView>=>invoke('privacyControl:shutdownLostDevice',input),
  listAudit:(limit?:number):Promise<AuditEntryView[]>=>invoke('audit:list',limit),
  verifyAuditIntegrity:():Promise<AuditIntegrityView>=>invoke('audit:verifyIntegrity'),
  listAccounts:():Promise<FamilyAccountView[]>=>invoke('accounts:list'),
  updateAccount:(input:UpdateFamilyAccountInput):Promise<FamilyAccountView[]>=>invoke('accounts:update',input),
  createInvitation:(input:CreateFamilyInvitationInput):Promise<{invitation:FamilyInvitationView;token:string}>=>invoke('invitations:create',input),
  listInvitations:():Promise<FamilyInvitationView[]>=>invoke('invitations:list'),
  inspectInvitation:(input:InspectFamilyInvitationInput):Promise<FamilyInvitationInspectionView>=>invoke('invitations:inspect',input),
  revokeInvitation:(id:string):Promise<FamilyInvitationView[]>=>invoke('invitations:revoke',id),
  resendInvitation:(input:ResendFamilyInvitationInput):Promise<{invitation:FamilyInvitationView;token:string}>=>invoke('invitations:resend',input),
  acceptInvitation:(input:AcceptFamilyInvitationInput):Promise<AuthStateView>=>invoke('invitations:accept',input),
  getAuthorizationContextWorkspace:():Promise<AuthorizationContextWorkspaceView>=>invoke('permissions:getContextWorkspace'),
  getClientDataAccessBoundary:():Promise<ClientDataAccessBoundaryView>=>invoke('clientDataAccess:getBoundary'),
  listPermissions:():Promise<ObjectPermissionView[]>=>invoke('permissions:list'),
  upsertPermission:(input:UpsertObjectPermissionInput):Promise<ObjectPermissionView[]>=>invoke('permissions:upsert',input),
  deletePermission:(id:string):Promise<ObjectPermissionView[]>=>invoke('permissions:delete',id),
  getOfflineCapabilityLeaseWorkspace:():Promise<OfflineCapabilityLeaseWorkspaceView>=>invoke('offlineCapability:getWorkspace'),
  issueOfflineCapabilityLease:(input:IssueOfflineCapabilityLeaseInput):Promise<OfflineCapabilityLeaseWorkspaceView>=>invoke('offlineCapability:issue',input),
  revokeOfflineCapabilityLease:(leaseId:string):Promise<OfflineCapabilityLeaseWorkspaceView>=>invoke('offlineCapability:revoke',leaseId),
  getDataRepairWorkspace:():Promise<DataRepairWorkspaceView>=>invoke('data-repair:workspace'),
  previewDataRepair:(input:{issueId:string;reason:string}):Promise<DataRepairOperation>=>invoke('data-repair:preview',input),
  applyDataRepair:(input:{operationId:string;expectedRevisionToken:string}):Promise<DataRepairOperation>=>invoke('data-repair:apply',input),
  undoDataRepair:(operationId:string):Promise<DataRepairOperation>=>invoke('data-repair:undo',operationId),
  listDataRetentionPolicies:():Promise<DataRetentionPolicyView[]>=>invoke('dataLifecycle:listPolicies'),
  createDataRetentionPolicy:(input:CreateDataRetentionPolicyInput):Promise<DataRetentionPolicyView[]>=>invoke('dataLifecycle:createPolicy',input),
  listDataLifecycleRecords:():Promise<DataLifecycleRecordView[]>=>invoke('dataLifecycle:listRecords'),
  archiveDataResource:(input:ArchiveDataResourceInput):Promise<DataLifecycleRecordView[]>=>invoke('dataLifecycle:archive',input),
  restoreDataResource:(input:RestoreDataResourceInput):Promise<DataLifecycleRecordView[]>=>invoke('dataLifecycle:restore',input),
  requestDataPurge:(input:RequestDataPurgeInput):Promise<DataLifecycleRecordView[]>=>invoke('dataLifecycle:requestPurge',input),
  cancelDataPurge:(input:CancelDataPurgeInput):Promise<DataLifecycleRecordView[]>=>invoke('dataLifecycle:cancelPurge',input),
  executeDataPurge:(input:ExecuteDataPurgeInput):Promise<DataLifecycleRecordView[]>=>invoke('dataLifecycle:executePurge',input),
  setDataLegalHold:(input:SetDataLegalHoldInput):Promise<DataLifecycleRecordView[]>=>invoke('dataLifecycle:setLegalHold',input),
  listBackupPropagationRuns:(limit?:number):Promise<BackupPropagationRunView[]>=>invoke('dataLifecycle:listBackupPropagationRuns',limit),
  propagatePurgedBackups:():Promise<BackupPropagationRunView>=>invoke('dataLifecycle:propagatePurgedBackups'),
  getBackupCleanRewriteStatus:():Promise<BackupCleanRewriteStatusView>=>invoke('dataLifecycle:getBackupCleanRewriteStatus'),
  listBackupCleanRewriteRuns:(limit?:number):Promise<BackupCleanRewriteRunView[]>=>invoke('dataLifecycle:listBackupCleanRewriteRuns',limit),
  updateBackupCleanRewritePolicy:(input:UpdateBackupCleanRewritePolicyInput):Promise<BackupCleanRewritePolicyView>=>invoke('dataLifecycle:updateBackupCleanRewritePolicy',input),
  runBackupCleanRewrite:():Promise<BackupCleanRewriteRunResultView>=>invoke('dataLifecycle:runBackupCleanRewrite'),
  getBackupQuarantinePolicy:():Promise<BackupQuarantinePolicyView>=>invoke('dataLifecycle:getBackupQuarantinePolicy'),
  listBackupQuarantineBatches:(limit?:number):Promise<BackupQuarantineBatchView[]>=>invoke('dataLifecycle:listBackupQuarantineBatches',limit),
  updateBackupQuarantinePolicy:(input:UpdateBackupQuarantinePolicyInput):Promise<BackupQuarantinePolicyView>=>invoke('dataLifecycle:updateBackupQuarantinePolicy',input),
  setBackupQuarantineLegalHold:(input:SetBackupQuarantineLegalHoldInput):Promise<BackupQuarantineBatchView[]>=>invoke('dataLifecycle:setBackupQuarantineLegalHold',input),
  destroyBackupQuarantineBatch:(input:DestroyBackupQuarantineBatchInput):Promise<BackupQuarantineDestructionResultView>=>invoke('dataLifecycle:destroyBackupQuarantineBatch',input),
  listExternalBackupCopies:(limit?:number):Promise<ExternalBackupCopyView[]>=>invoke('dataLifecycle:listExternalBackupCopies',limit),
  getExternalBackupInventorySummary:():Promise<ExternalBackupInventorySummaryView>=>invoke('dataLifecycle:getExternalBackupInventorySummary'),
  registerExternalBackupCopy:(input:RegisterExternalBackupCopyInput):Promise<ExternalBackupCopyView[]>=>invoke('dataLifecycle:registerExternalBackupCopy',input),
  reviewExternalBackupCopy:(input:ReviewExternalBackupCopyInput):Promise<ExternalBackupCopyView[]>=>invoke('dataLifecycle:reviewExternalBackupCopy',input),
  setExternalBackupCopyLegalHold:(input:SetExternalBackupCopyLegalHoldInput):Promise<ExternalBackupCopyView[]>=>invoke('dataLifecycle:setExternalBackupCopyLegalHold',input),
  attestExternalBackupCopyDestroyed:(input:AttestExternalBackupCopyDestroyedInput):Promise<ExternalBackupCopyView[]>=>invoke('dataLifecycle:attestExternalBackupCopyDestroyed',input),
  listExternalBackupEvidenceIssuers:(limit?:number):Promise<ExternalBackupEvidenceIssuerView[]>=>invoke('dataLifecycle:listExternalBackupEvidenceIssuers',limit),
  listExternalBackupEvidenceIssuerRotations:(limit?:number):Promise<ExternalBackupEvidenceIssuerRotationView[]>=>invoke('dataLifecycle:listExternalBackupEvidenceIssuerRotations',limit),
  listExternalBackupEvidenceRevocationLists:(limit?:number):Promise<ExternalBackupEvidenceRevocationListView[]>=>invoke('dataLifecycle:listExternalBackupEvidenceRevocationLists',limit),
  applyExternalBackupEvidenceRevocationList:(input:ApplyExternalBackupEvidenceRevocationListInput):Promise<{lists:ExternalBackupEvidenceRevocationListView[];issuers:ExternalBackupEvidenceIssuerView[]}>=>invoke('dataLifecycle:applyExternalBackupEvidenceRevocationList',input),
  listExternalBackupRevocationEndpoints:(limit?:number):Promise<ExternalBackupRevocationEndpointView[]>=>invoke('dataLifecycle:listExternalBackupRevocationEndpoints',limit),
  upsertExternalBackupRevocationEndpoint:(input:UpsertExternalBackupRevocationEndpointInput):Promise<ExternalBackupRevocationEndpointView[]>=>invoke('dataLifecycle:upsertExternalBackupRevocationEndpoint',input),
  listRevocationSyncStates:():Promise<RevocationSyncEndpointStateView[]>=>invoke('dataLifecycle:listRevocationSyncStates'),
  runRevocationSync:(endpointId?:string):Promise<RevocationSyncRunResultView>=>invoke('dataLifecycle:runRevocationSync',endpointId),
  getPendingRevocationSyncList:(endpointId:string):Promise<PendingRevocationSyncListView|null>=>invoke('dataLifecycle:getPendingRevocationSyncList',endpointId),
  applyPendingRevocationSyncList:(input:ApplyPendingRevocationSyncInput):Promise<{lists:ExternalBackupEvidenceRevocationListView[];issuers:ExternalBackupEvidenceIssuerView[]}>=>invoke('dataLifecycle:applyPendingRevocationSyncList',input),
  listExternalBackupDestructionEvidence:(copyId?:string,limit?:number):Promise<ExternalBackupDestructionEvidenceView[]>=>invoke('dataLifecycle:listExternalBackupDestructionEvidence',copyId,limit),
  registerExternalBackupEvidenceIssuer:(input:RegisterExternalBackupEvidenceIssuerInput):Promise<ExternalBackupEvidenceIssuerView[]>=>invoke('dataLifecycle:registerExternalBackupEvidenceIssuer',input),
  rotateExternalBackupEvidenceIssuer:(input:RotateExternalBackupEvidenceIssuerInput):Promise<{issuers:ExternalBackupEvidenceIssuerView[];rotations:ExternalBackupEvidenceIssuerRotationView[]}>=>invoke('dataLifecycle:rotateExternalBackupEvidenceIssuer',input),
  revokeExternalBackupEvidenceIssuer:(input:RevokeExternalBackupEvidenceIssuerInput):Promise<ExternalBackupEvidenceIssuerView[]>=>invoke('dataLifecycle:revokeExternalBackupEvidenceIssuer',input),
  verifyExternalBackupDestructionEvidence:(input:VerifyExternalBackupDestructionEvidenceInput):Promise<{copies:ExternalBackupCopyView[];evidence:ExternalBackupDestructionEvidenceView[]}>=>invoke('dataLifecycle:verifyExternalBackupDestructionEvidence',input),

  previewFamilyDataImport:():Promise<{canceled:boolean;preview?:FamilyDataImportPreviewView}>=>invoke('familyData:previewImport'),
  applyFamilyDataImport:(input:ApplyFamilyDataImportInput):Promise<FamilyDataImportBatchView>=>invoke('familyData:applyImport',input),
  listFamilyDataImports:(limit?:number):Promise<FamilyDataImportBatchView[]>=>invoke('familyData:listImports',limit),
  rollbackFamilyDataImport:(input:RollbackFamilyDataImportInput):Promise<FamilyDataImportBatchView>=>invoke('familyData:rollbackImport',input),
  getSnapshot: (): Promise<FamilyAppSnapshot> => invoke('data:getSnapshot'),
  getHouseholdMembershipWorkspace: (): Promise<HouseholdMembershipWorkspaceView> => invoke('households:getWorkspace'),
  createHousehold: (input: CreateHouseholdInput): Promise<Household> => invoke('households:create', input),
  createFamilyBranch: (input: CreateFamilyBranchInput): Promise<FamilyBranch> => invoke('households:createBranch', input),
  assignPersonMembership: (input: AssignPersonMembershipInput): Promise<PersonMembership> => invoke('households:assignPerson', input),
  endPersonMembership: (input: { membershipId: string; endedAt: string }): Promise<PersonMembership> => invoke('households:endMembership', input),
  getPersonLifecycleWorkspace: (personId: string): Promise<PersonLifecycleWorkspaceView> => invoke('people:getLifecycleWorkspace', personId),
  updatePersonProfile: (input: UpdatePersonProfileInput): Promise<PersonLifecycleProfile> => invoke('people:updateProfile', input),
  archivePersonProfile: (input: { personId: string; expectedVersion: number; reason: string }): Promise<PersonLifecycleProfile> => invoke('people:archiveProfile', input),
  mergePersonProfiles: (input: { sourcePersonId: string; targetPersonId: string; expectedSourceVersion: number; expectedTargetVersion: number; conflictResolution: 'KEEP_TARGET'; reason: string }): Promise<PersonLifecycleProfile> => invoke('people:mergeProfiles', input),
  requestSafePersonDeletion: (input: { personId: string; expectedVersion: number; confirmationText: string; reason: string }): Promise<PersonLifecycleProfile> => invoke('people:requestSafeDeletion', input),
  undoPersonLifecycleOperation: (operationId: string): Promise<PersonLifecycleProfile> => invoke('people:undoLifecycleOperation', operationId),
  getSnapshotSections: (input:FamilySnapshotSectionsInput): Promise<FamilySnapshotPatchView> => invoke('data:getSnapshotSections',input),
  getDashboardOverview: (): Promise<DashboardOverviewView> => invoke('dashboard:getOverview'),
  listPersonCatalog:(input:PersonCatalogPageInput={}):Promise<PersonCatalogPageView>=>invoke('catalog:listPeople',input),
  listEventCatalog:(input:EventCatalogPageInput={}):Promise<EventCatalogPageView>=>invoke('catalog:listEvents',input),
  lookupEntityCatalog:(input:EntityCatalogLookupInput={}):Promise<EntityCatalogLookupView>=>invoke('catalog:lookup',input),
  listLifeRecords:():Promise<LifeRecordView[]>=>invoke('life:list'),
  getManagedLifeWorkspace:():Promise<ManagedLifeWorkspaceView>=>invoke('life:getManagedWorkspace'),
  listAutomationRules:():Promise<AutomationRuleView[]>=>invoke('automation:list'),
  createAutomationRule:(input:CreateAutomationRuleInput):Promise<AutomationRuleView[]>=>invoke('automation:create',input),
  toggleAutomationRule:(id:string,enabled:boolean):Promise<AutomationRuleView[]>=>invoke('automation:toggle',id,enabled),
  listAutomationRuns:():Promise<AutomationRunView[]>=>invoke('automation:runs'),
  runAutomationRules:(input:RunAutomationInput={}):Promise<AutomationRunView[]>=>invoke('automation:run',input),
  listDigitalLegacyPlans:():Promise<DigitalLegacyPlanView[]>=>invoke('legacy:listPlans'),
  upsertDigitalLegacyPlan:(input:UpsertDigitalLegacyPlanInput):Promise<DigitalLegacyPlanView[]>=>invoke('legacy:upsertPlan',input),
  listLegacyGrants:(planId?:string):Promise<LegacyGrantView[]>=>invoke('legacy:listGrants',planId),
  upsertLegacyGrant:(input:UpsertLegacyGrantInput):Promise<LegacyGrantView[]>=>invoke('legacy:upsertGrant',input),
  executeDigitalLegacyPlan:(input:ExecuteLegacyPlanInput):Promise<DigitalLegacyPlanView[]>=>invoke('legacy:execute',input),
  listLegacyApprovals:(planId:string):Promise<LegacyApprovalView[]>=>invoke('legacy:listApprovals',planId),
  approveLegacyExecution:(input:ApproveLegacyExecutionInput):Promise<DigitalLegacyPlanView[]>=>invoke('legacy:approve',input),
  finalizeLegacyExecution:(planId:string):Promise<DigitalLegacyPlanView[]>=>invoke('legacy:finalize',planId),
  cancelLegacyExecution:(input:CancelLegacyExecutionInput):Promise<DigitalLegacyPlanView[]>=>invoke('legacy:cancel',input),
  getReportSummary:():Promise<ReportSummaryView>=>invoke('reports:summary'),
  createLifeRecord:(input:CreateLifeRecordInput):Promise<LifeRecordView[]>=>invoke('life:create',input),
  recordManagedLifeItem:(input:RecordManagedLifeItemInput):Promise<ManagedLifeWorkspaceView>=>invoke('life:recordManagedItem',input),
  exportEmergencyCard:(input:EmergencyCardExportIpcInput):Promise<EmergencyCardExportIpcResult>=>invoke('life:exportEmergencyCard',input),
  listFinance:():Promise<FinanceRecordView[]>=>invoke('finance:list'),
  createFinance:(input:CreateFinanceRecordInput):Promise<FinanceRecordView[]>=>invoke('finance:create',input),
  listBankInstitutions:():Promise<BankInstitutionView[]>=>invoke('finance:listBankInstitutions'),
  listBankAccounts:():Promise<BankAccountView[]>=>invoke('finance:listBankAccounts'),
  validateIban:(input:ValidateIbanInput):Promise<IbanStructuralValidationView>=>invoke('finance:validateIban',input),
  createBankAccount:(input:CreateBankAccountInput):Promise<BankAccountView[]>=>invoke('finance:createBankAccount',input),
  listPaymentCards:():Promise<PaymentCardView[]>=>invoke('finance:listPaymentCards'),
  createPaymentCard:(input:CreatePaymentCardInput):Promise<PaymentCardView[]>=>invoke('finance:createPaymentCard',input),
  listLoanAccounts:():Promise<LoanAccountView[]>=>invoke('finance:listLoanAccounts'),
  createLoanAccount:(input:CreateLoanAccountInput):Promise<LoanAccountView[]>=>invoke('finance:createLoanAccount',input),
  recordLoanPayment:(input:RecordLoanPaymentInput):Promise<LoanAccountView[]>=>invoke('finance:recordLoanPayment',input),
  getFinancePlanningWorkspace:():Promise<FinancePlanningWorkspaceView>=>invoke('finance:getPlanningWorkspace'),
  recordFinancePlanningItem:(input:RecordFinancePlanningItemInput):Promise<FinancePlanningWorkspaceView>=>invoke('finance:recordPlanningItem',input),
  getLongTermPortfolioWorkspace:():Promise<LongTermPortfolioWorkspaceView>=>invoke('finance:getLongTermPortfolioWorkspace'),
  recordLongTermPortfolioItem:(input:RecordLongTermPortfolioItemInput):Promise<LongTermPortfolioWorkspaceView>=>invoke('finance:recordLongTermPortfolioItem',input),
  selectFinanceImportFile:():Promise<SelectFinanceImportFileResult>=>invoke('finance:selectImportFile'),
  previewOpenBankingSandbox:():Promise<FinanceImportPreviewView>=>invoke('finance:previewOpenBankingSandbox'),
  commitFinanceImportPreview:(input:CommitFinanceImportPreviewInput):Promise<FinancePlanningWorkspaceView>=>invoke('finance:commitImportPreview',input),
  listHealth:():Promise<HealthRecordView[]>=>invoke('health:list'),
  createHealth:(input:CreateHealthRecordInput):Promise<HealthRecordView[]>=>invoke('health:create',input),
  listMedicationPlans:():Promise<MedicationPlanView[]>=>invoke('health:listMedicationPlans'),
  createMedicationPlan:(input:CreateMedicationPlanInput):Promise<MedicationPlanView[]>=>invoke('health:createMedicationPlan',input),
  listFamilyHealthHistory:():Promise<FamilyHealthHistoryView[]>=>invoke('health:listFamilyHistory'),
  createFamilyHealthHistory:(input:CreateFamilyHealthHistoryInput):Promise<FamilyHealthHistoryView[]>=>invoke('health:createFamilyHistory',input),
  getHealthCareCoordinationCenter:(input:{readonly ownerPersonId:string}):Promise<HealthCareCoordinationCenterView>=>invoke('healthCare:getCenter',input),
  recordHealthCareEntry:(input:RecordHealthCareEntryInput):Promise<HealthCareMutationReceiptView>=>invoke('healthCare:recordEntry',input),
  upsertHealthCareAccessGrant:(input:UpsertHealthCareAccessGrantInput):Promise<HealthCareMutationReceiptView>=>invoke('healthCare:upsertGrant',input),
  revokeHealthCareAccessGrant:(input:RevokeHealthCareAccessGrantInput):Promise<HealthCareMutationReceiptView>=>invoke('healthCare:revokeGrant',input),
  getHouseholdOperationsCenter:():Promise<HouseholdOperationsCenterView>=>invoke('householdOperations:getCenter'),
  createHouseholdOperationItem:(input:CreateHouseholdOperationItemInput):Promise<HouseholdOperationMutationReceiptView>=>invoke('householdOperations:createItem',input),
  updateHouseholdOperationItem:(input:UpdateHouseholdOperationItemInput):Promise<HouseholdOperationMutationReceiptView>=>invoke('householdOperations:updateItem',input),
  deleteHouseholdOperationItem:(input:DeleteHouseholdOperationItemInput):Promise<HouseholdOperationMutationReceiptView>=>invoke('householdOperations:deleteItem',input),
  getChildEducationCenter:(input:{readonly childPersonId:string}):Promise<ChildEducationCenterView>=>invoke('childEducation:getCenter',input),
  createChildEducationItem:(input:CreateChildEducationItemInput):Promise<ChildEducationMutationReceiptView>=>invoke('childEducation:createItem',input),
  updateChildEducationItem:(input:UpdateChildEducationItemInput):Promise<ChildEducationMutationReceiptView>=>invoke('childEducation:updateItem',input),
  deleteChildEducationItem:(input:DeleteChildEducationItemInput):Promise<ChildEducationMutationReceiptView>=>invoke('childEducation:deleteItem',input),
  getPlacesTravelCenter:(input:{readonly ownerPersonId:string}):Promise<PlacesTravelCenterView>=>invoke('placesTravel:getCenter',input),
  createPlacesTravelItem:(input:CreatePlacesTravelItemInput):Promise<PlacesTravelMutationReceiptView>=>invoke('placesTravel:createItem',input),
  updatePlacesTravelItem:(input:UpdatePlacesTravelItemInput):Promise<PlacesTravelMutationReceiptView>=>invoke('placesTravel:updateItem',input),
  deletePlacesTravelItem:(input:DeletePlacesTravelItemInput):Promise<PlacesTravelMutationReceiptView>=>invoke('placesTravel:deleteItem',input),
  getFamilyAiAssistantCenter:():Promise<FamilyAiAssistantCenterView>=>invoke('familyAiAssistant:getCenter'),
  generateFamilyAiSuggestion:(input:GenerateFamilyAiSuggestionInput):Promise<FamilyAiSuggestionMutationReceiptView>=>invoke('familyAiAssistant:generate',input),
  reviewFamilyAiSuggestion:(input:ReviewFamilyAiSuggestionInput):Promise<FamilyAiSuggestionMutationReceiptView>=>invoke('familyAiAssistant:review',input),
  getMemoryStudioCenter:():Promise<MemoryStudioCenterView>=>invoke('memoryStudio:getCenter'),
  createMemoryStudioRecord:(input:CreateMemoryStudioRecordInput):Promise<MemoryStudioMutationReceiptView>=>invoke('memoryStudio:createRecord',input),
  deleteMemoryStudioRecord:(input:DeleteMemoryStudioRecordInput):Promise<MemoryStudioMutationReceiptView>=>invoke('memoryStudio:deleteRecord',input),
  createMemoryTimeCapsule:(input:CreateMemoryTimeCapsuleInput):Promise<MemoryStudioMutationReceiptView>=>invoke('memoryStudio:createCapsule',input),
  reviewMemoryTimeCapsule:(input:ReviewMemoryTimeCapsuleInput):Promise<MemoryStudioMutationReceiptView>=>invoke('memoryStudio:reviewCapsule',input),
  transitionMemoryTimeCapsule:(input:TransitionMemoryTimeCapsuleInput):Promise<MemoryStudioMutationReceiptView>=>invoke('memoryStudio:transitionCapsule',input),
  getSmartHomeEnergyCenter:():Promise<SmartHomeEnergyCenterView>=>invoke('smartHomeEnergy:getCenter'),
  grantSmartHomeCameraConsent:(input:GrantSmartHomeCameraConsentInput):Promise<SmartHomeMutationReceiptView>=>invoke('smartHomeEnergy:grantCameraConsent',input),
  revokeSmartHomeCameraConsent:(input:RevokeSmartHomeCameraConsentInput):Promise<SmartHomeMutationReceiptView>=>invoke('smartHomeEnergy:revokeCameraConsent',input),
  setSmartHomeProcessing:(input:SetSmartHomeProcessingInput):Promise<SmartHomeMutationReceiptView>=>invoke('smartHomeEnergy:setProcessing',input),
  getSignedPluginPlatformCenter:():Promise<SignedPluginPlatformCenterView>=>invoke('signedPluginPlatform:getCenter'),
  setSignedPluginDesiredState:(input:SetSignedPluginDesiredStateInput):Promise<SignedPluginMutationReceiptView>=>invoke('signedPluginPlatform:setDesiredState',input),
  emergencyDisableSignedPlugin:(input:EmergencyDisableSignedPluginInput):Promise<SignedPluginMutationReceiptView>=>invoke('signedPluginPlatform:emergencyDisable',input),
  rollbackSignedPlugin:(input:RollbackSignedPluginInput):Promise<SignedPluginMutationReceiptView>=>invoke('signedPluginPlatform:rollback',input),
  getCommunicationSecurityCenter:():Promise<CommunicationSecurityCenterView>=>invoke('communicationSecurity:getCenter'),
  registerCommunicationDeviceCredential:(input:{readonly clientOperationId:string;readonly expectedRevision:number})
    :Promise<CommunicationSecurityMutationReceiptView>=>invoke('communicationSecurity:registerDeviceCredential',input),
  revokeCommunicationDeviceCredential:(input:RevokeCommunicationDeviceCredentialInput)
    :Promise<CommunicationSecurityMutationReceiptView>=>invoke('communicationSecurity:revokeDeviceCredential',input),
  createCommunicationRoom:(input:CreateCommunicationRoomInput):Promise<CommunicationSecurityMutationReceiptView>=>
    invoke('communicationSecurity:createRoom',input),
  addCommunicationRoomMember:(input:AddCommunicationRoomMemberInput):Promise<CommunicationSecurityMutationReceiptView>=>
    invoke('communicationSecurity:addMember',input),
  removeCommunicationRoomMember:(input:RemoveCommunicationRoomMemberInput):Promise<CommunicationSecurityMutationReceiptView>=>
    invoke('communicationSecurity:removeMember',input),
  rekeyCommunicationRoomAfterDeviceRevocation:(input:RekeyCommunicationRoomAfterDeviceRevocationInput)
    :Promise<CommunicationSecurityMutationReceiptView>=>invoke('communicationSecurity:rekeyRoom',input),
  setCommunicationHistoryAccess:(input:SetCommunicationHistoryAccessInput):Promise<CommunicationSecurityMutationReceiptView>=>
    invoke('communicationSecurity:setHistoryAccess',input),
  freezeCommunicationRoom:(input:FreezeCommunicationRoomInput):Promise<CommunicationSecurityMutationReceiptView>=>
    invoke('communicationSecurity:freezeRoom',input),
  getCommunicationMessagingCenter:():Promise<CommunicationMessagingCenterView>=>invoke('communicationMessaging:getCenter'),
  searchCommunicationMessages:(input:SearchCommunicationMessagesInput):Promise<readonly CommunicationMessageView[]>=>
    invoke('communicationMessaging:search',input),
  getCommunicationMessageContent:(input:{readonly messageId:string}):Promise<CommunicationMessageContentView>=>
    invoke('communicationMessaging:getContent',input),
  createCommunicationMessage:(input:CreateCommunicationMessageInput):Promise<CommunicationMessagingMutationReceiptView>=>
    invoke('communicationMessaging:create',input),
  editCommunicationMessage:(input:EditCommunicationMessageInput):Promise<CommunicationMessagingMutationReceiptView>=>
    invoke('communicationMessaging:edit',input),
  setCommunicationMessageLifecycle:(input:SetCommunicationMessageLifecycleInput):Promise<CommunicationMessagingMutationReceiptView>=>
    invoke('communicationMessaging:setLifecycle',input),
  annotateCommunicationMessage:(input:AnnotateCommunicationMessageInput):Promise<CommunicationMessagingMutationReceiptView>=>
    invoke('communicationMessaging:annotate',input),
  updateCommunicationDelivery:(input:UpdateCommunicationDeliveryInput):Promise<CommunicationMessagingMutationReceiptView>=>
    invoke('communicationMessaging:updateDelivery',input),
  setCommunicationPresence:(input:SetCommunicationPresenceInput):Promise<CommunicationMessagingMutationReceiptView>=>
    invoke('communicationMessaging:setPresence',input),
  setCommunicationRetentionPolicy:(input:SetCommunicationRetentionPolicyInput):Promise<CommunicationMessagingMutationReceiptView>=>
    invoke('communicationMessaging:setRetentionPolicy',input),
  getCommunicationRealtimeCallingCenter:():Promise<CommunicationRealtimeCallingCenterView>=>
    invoke('communicationCalling:getCenter'),
  createCommunicationCall:(input:CreateCommunicationCallInput):Promise<CommunicationRealtimeCallingMutationReceiptView>=>
    invoke('communicationCalling:create',input),
  runCommunicationCallPreflight:(input:RunCommunicationCallPreflightInput):Promise<CommunicationRealtimeCallingMutationReceiptView>=>
    invoke('communicationCalling:runPreflight',input),
  updateCommunicationCallControls:(input:UpdateCommunicationCallControlsInput):Promise<CommunicationRealtimeCallingMutationReceiptView>=>
    invoke('communicationCalling:updateControls',input),
  advanceCommunicationCall:(input:AdvanceCommunicationCallInput):Promise<CommunicationRealtimeCallingMutationReceiptView>=>
    invoke('communicationCalling:advance',input),
  setCommunicationCallPreferences:(input:SetCommunicationCallPreferencesInput):Promise<CommunicationRealtimeCallingMutationReceiptView>=>
    invoke('communicationCalling:setPreferences',input),
  getCommunicationRecordingCenter:():Promise<CommunicationRecordingCenterView>=>
    invoke('communicationRecording:getCenter'),
  createCommunicationRecordingRequest:(input:CreateCommunicationRecordingRequestInput):Promise<CommunicationRecordingMutationReceiptView>=>
    invoke('communicationRecording:createRequest',input),
  decideCommunicationRecordingConsent:(input:DecideCommunicationRecordingConsentInput):Promise<CommunicationRecordingMutationReceiptView>=>
    invoke('communicationRecording:decideConsent',input),
  withdrawCommunicationRecordingConsent:(input:WithdrawCommunicationRecordingConsentInput):Promise<CommunicationRecordingMutationReceiptView>=>
    invoke('communicationRecording:withdrawConsent',input),
  addCommunicationRecordingLateJoiner:(input:AddCommunicationRecordingLateJoinerInput):Promise<CommunicationRecordingMutationReceiptView>=>
    invoke('communicationRecording:addLateJoiner',input),
  setCommunicationRecordingSegment:(input:SetCommunicationRecordingSegmentInput):Promise<CommunicationRecordingMutationReceiptView>=>
    invoke('communicationRecording:setSegment',input),
  updateCommunicationRecordingRetention:(input:UpdateCommunicationRecordingRetentionInput):Promise<CommunicationRecordingMutationReceiptView>=>
    invoke('communicationRecording:updateRetention',input),
  requestCommunicationRecordingDeletion:(input:RequestCommunicationRecordingDeletionInput):Promise<CommunicationRecordingMutationReceiptView>=>
    invoke('communicationRecording:requestDeletion',input),
  getLocalTranslationCenter:():Promise<LocalTranslationCenterView>=>invoke('localTranslation:getCenter'),
  updateLocalTranslationProfile:(input:UpdateLocalTranslationProfileInput):Promise<LocalTranslationMutationReceiptView>=>
    invoke('localTranslation:updateProfile',input),
  addLocalTranslationDictionaryEntry:(input:AddLocalTranslationDictionaryEntryInput):Promise<LocalTranslationMutationReceiptView>=>
    invoke('localTranslation:addDictionary',input),
  updateLocalTranslationDictionaryEntry:(input:UpdateLocalTranslationDictionaryEntryInput):Promise<LocalTranslationMutationReceiptView>=>
    invoke('localTranslation:updateDictionary',input),
  deleteLocalTranslationDictionaryEntry:(input:DeleteLocalTranslationDictionaryEntryInput):Promise<LocalTranslationMutationReceiptView>=>
    invoke('localTranslation:deleteDictionary',input),
  prepareLocalTranslationRequest:(input:PrepareLocalTranslationRequestInput):Promise<LocalTranslationMutationReceiptView>=>
    invoke('localTranslation:prepareRequest',input),
  recordLocalTranslationCorrection:(input:RecordLocalTranslationCorrectionInput):Promise<LocalTranslationMutationReceiptView>=>
    invoke('localTranslation:recordCorrection',input),
  cancelLocalTranslationRequest:(input:CancelLocalTranslationRequestInput):Promise<LocalTranslationMutationReceiptView>=>
    invoke('localTranslation:cancelRequest',input),
  getFamilyMeetingCenter:():Promise<FamilyMeetingCenterIpcView>=>invoke('familyMeeting:getCenter'),
  getFamilyMeetingMinutes:(input:{readonly meetingId:string}):Promise<FamilyMeetingMinutesIpcView>=>
    invoke('familyMeeting:getMinutes',input),
  createFamilyMeeting:(input:CreateFamilyMeetingInput):Promise<FamilyMeetingMutationIpcView>=>
    invoke('familyMeeting:create',input),
  updateFamilyMeetingPlan:(input:UpdateFamilyMeetingPlanInput):Promise<FamilyMeetingMutationIpcView>=>
    invoke('familyMeeting:updatePlan',input),
  setFamilyMeetingState:(input:SetFamilyMeetingStateInput):Promise<FamilyMeetingMutationIpcView>=>
    invoke('familyMeeting:setState',input),
  upsertFamilyMeetingParticipant:(input:UpsertFamilyMeetingParticipantInput):Promise<FamilyMeetingMutationIpcView>=>
    invoke('familyMeeting:upsertParticipant',input),
  upsertFamilyMeetingAgendaItem:(input:UpsertFamilyMeetingAgendaItemInput):Promise<FamilyMeetingMutationIpcView>=>
    invoke('familyMeeting:upsertAgenda',input),
  createFamilyMeetingPoll:(input:CreateFamilyMeetingPollInput):Promise<FamilyMeetingMutationIpcView>=>
    invoke('familyMeeting:createPoll',input),
  castFamilyMeetingVote:(input:CastFamilyMeetingVoteInput):Promise<FamilyMeetingMutationIpcView>=>
    invoke('familyMeeting:castVote',input),
  recordFamilyMeetingDecision:(input:RecordFamilyMeetingDecisionInput):Promise<FamilyMeetingMutationIpcView>=>
    invoke('familyMeeting:recordDecision',input),
  upsertFamilyMeetingTask:(input:UpsertFamilyMeetingTaskInput):Promise<FamilyMeetingMutationIpcView>=>
    invoke('familyMeeting:upsertTask',input),
  addFamilyMeetingCollaboration:(input:AddFamilyMeetingCollaborationInput):Promise<FamilyMeetingMutationIpcView>=>
    invoke('familyMeeting:addCollaboration',input),
  prepareFamilyMeetingAiMinutes:(input:PrepareFamilyMeetingAiMinutesInput):Promise<FamilyMeetingMutationIpcView>=>
    invoke('familyMeeting:prepareAiMinutes',input),
  finalizeFamilyMeetingMinutes:(input:FinalizeFamilyMeetingMinutesInput):Promise<FamilyMeetingMutationIpcView>=>
    invoke('familyMeeting:finalizeMinutes',input),
  listFinanceValuations:():Promise<FinanceValuationView[]>=>invoke('finance:listValuations'),
  createFinanceValuation:(input:CreateFinanceValuationInput):Promise<FinanceValuationView[]>=>invoke('finance:createValuation',input),
  createMember: (input: CreateFamilyMemberInput): Promise<FamilyMutationResultView> => invoke('family:createMember', input),
  createRelation: (input:CreateFamilyRelationInput):Promise<FamilyMutationResultView> => invoke('family:createRelation',input),
  createImportantDay: (input: CreateFamilyEventInput): Promise<FamilyMutationResultView> => invoke('timeline:createImportantDay', input),
  updateImportantDayParticipants: (input: UpdateEventParticipantsInput): Promise<FamilyMutationResultView> => invoke('timeline:updateParticipants', input),
  updateImportantDayInvitation: (input: UpdateEventInvitationInput): Promise<FamilyMutationResultView> => invoke('timeline:updateInvitation', input),
  updateImportantDayNotes: (input: UpdateEventNotesInput): Promise<FamilyMutationResultView> => invoke('timeline:updateNotes', input),
  updateFamilyEvent: (input:UpdateFamilyEventInput):Promise<FamilyMutationResultView> => invoke('timeline:updateEvent',input),
  setFamilyEventArchived: (input:SetFamilyEventArchivedInput):Promise<FamilyMutationResultView> => invoke('timeline:setArchived',input),
  listArchivedTimelineEvents: ():Promise<FamilyEventView[]> => invoke('timeline:listArchived'),
  acknowledgeTimelineNotification: (input: AcknowledgeFamilyNotificationInput): Promise<FamilyMutationResultView> => invoke('notifications:acknowledge', input),
  createLocation: (input: CreateFamilyLocationInput): Promise<FamilyMutationResultView> => invoke('location:create', input),
  listArchive: ():Promise<ArchiveItemView[]> => invoke('archive:list'),
  searchArchive:(input:ArchiveSearchInput={}):Promise<ArchiveItemView[]>=>invoke('archive:search',input),
  searchUnifiedAuthorizedRecords:(input:UnifiedAuthorizedSearchInput):Promise<UnifiedAuthorizedSearchView>=>
    invoke('unifiedSearch:search',input),
  listArchiveVersions:(itemId:string):Promise<ArchiveVersionView[]>=>invoke('archive:listVersions',itemId),
  listArchiveRelationEvidence:(itemId:string):Promise<ArchiveRelationEvidenceView[]>=>invoke('archive:listRelationEvidence',itemId),
  listArchiveRelationEvidenceHistory:(itemId:string):Promise<ArchiveRelationEvidenceHistoryView[]>=>invoke('archive:listRelationEvidenceHistory',itemId),
  addArchiveRelationEvidence:(input:AddArchiveRelationEvidenceInput&{readonly clientOperationId:string}):Promise<ArchiveRelationEvidenceView[]>=>invoke('archive:addRelationEvidence',input),
  removeArchiveRelationEvidence:(input:RemoveArchiveRelationEvidenceInput&{readonly clientOperationId:string}):Promise<ArchiveRelationEvidenceView[]>=>invoke('archive:removeRelationEvidence',input),
  addArchiveItemVersion:(input:AddArchiveItemVersionInput&{readonly clientOperationId:string}):Promise<ArchiveVersionView[]>=>invoke('archive:addVersion',input),
  listArchiveRetentionPolicies:():Promise<ArchiveRetentionPolicyView[]>=>invoke('archive:listRetentionPolicies'),
  createArchiveRetentionPolicy:(input:CreateArchiveRetentionPolicyInput):Promise<ArchiveRetentionPolicyView[]>=>
    invokeArchiveMutation('archive:createRetentionPolicy', input, (operationId) => ({ ...input, operationId })),
  assignArchiveRetentionPolicy:(input:AssignArchiveRetentionPolicyInput):Promise<ArchiveRetentionStatusView[]>=>
    invokeArchiveMutation('archive:assignRetentionPolicy', input, (operationId) => ({ ...input, operationId })),
  listArchiveRetentionStatus:():Promise<ArchiveRetentionStatusView[]>=>invoke('archive:listRetentionStatus'),
  securelyDestroyArchiveItem:(itemId:string):Promise<ArchiveRetentionStatusView[]>=>
    invokeArchiveMutation('archive:secureDestroy', { itemId }, (operationId) => ({ itemId, operationId })),
  openArchive:(id:string):Promise<{opened:true}>=>
    invokeArchiveMutation('archive:open', { itemId: id }, (operationId) => ({ itemId: id, operationId })),
  importArchive: (input:CreateArchiveItemInput):Promise<ArchiveItemView[]> =>
    invokeArchiveMutation('archive:import', input, (operationId) => ({ ...input, operationId })),
  exportBackup: (): Promise<{ canceled: boolean; filePath?: string }> => invoke('backup:export'),
  exportFullBackup:(input:{password:string}):Promise<{canceled:boolean;filePath?:string}>=>invoke('backup:exportFull',input),
  inspectFullBackup:(input:{password?:string}):Promise<{canceled:boolean;filePath?:string;inspection?:BackupInspectionView}>=>invoke('backup:inspectFull',input),
  restoreFullBackup:(input:{password?:string}):Promise<{canceled:boolean;safetyBackupPath?:string;restarting?:boolean}>=>invoke('backup:restoreFull',input)
});
