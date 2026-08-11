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
import type { FamilyEventView, FamilyMutationResultView, SetFamilyEventArchivedInput, UpdateFamilyEventInput } from '@ppt/domain';
import type { AssignPersonMembershipInput, CreateFamilyBranchInput, CreateHouseholdInput, FamilyBranch, Household, HouseholdMembershipWorkspaceView, PersonLifecycleProfile, PersonLifecycleWorkspaceView, PersonMembership, UpdatePersonProfileInput } from '@ppt/domain';
import type { AuthorizationContextWorkspaceView } from '@ppt/domain';
import type { IssueOfflineCapabilityLeaseInput, OfflineCapabilityLeaseWorkspaceView } from '@ppt/domain';
import type { ClientDataAccessBoundaryView } from '@ppt/domain';
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
import type { ArchiveItemView, AuthStateView, ExternalIdentityProviderView, CreateArchiveItemInput, CreateFamilyEventInput, UpdateEventParticipantsInput, UpdateEventInvitationInput, UpdateEventNotesInput, AcknowledgeFamilyNotificationInput, CreateFamilyLocationInput, CreateFamilyMemberInput, CreateFamilyRelationInput, DashboardOverviewView, FamilyAppSnapshot, FamilySnapshotSectionsInput, FamilySnapshotPatchView, LoginInput, SetupAdminInput, ChangePasswordInput, AuditEntryView, AuditIntegrityView, TwoFactorSetupView, EnableTwoFactorInput, DisableTwoFactorInput, TrustCurrentDeviceInput, ReauthorizeCurrentDeviceInput, ReauthorizeCurrentDeviceResultView, SecurityEventReceiptArchiveItemView, SecurityEventReceiptVerificationView, TrustedDeviceView, FamilyAccountView, FamilyInvitationView, FamilyInvitationInspectionView, CreateFamilyInvitationInput, InspectFamilyInvitationInput, ResendFamilyInvitationInput, AcceptFamilyInvitationInput, ObjectPermissionView, UpsertObjectPermissionInput, UpdateFamilyAccountInput, FinanceRecordView, CreateFinanceRecordInput, HealthRecordView, CreateHealthRecordInput, MedicationPlanView, CreateMedicationPlanInput, FamilyHealthHistoryView, CreateFamilyHealthHistoryInput, FinanceValuationView, CreateFinanceValuationInput, LifeRecordView, CreateLifeRecordInput, AutomationRuleView, CreateAutomationRuleInput, ReportSummaryView, GenealogyInsightView, ArchiveCategoryView, ArchiveClassificationView, CreateArchiveCategoryInput, UpdateArchiveClassificationInput, AiConsentView, UpsertAiConsentInput, AiAccessPreviewView, AiConsentPurpose, AutomationRunView, RunAutomationInput, DigitalLegacyPlanView, UpsertDigitalLegacyPlanInput, LegacyGrantView, UpsertLegacyGrantInput, ExecuteLegacyPlanInput, LegacyApprovalView, ApproveLegacyExecutionInput, CancelLegacyExecutionInput, ArchiveSearchInput, ArchiveVersionView, ArchiveRetentionPolicyView, CreateArchiveRetentionPolicyInput, AssignArchiveRetentionPolicyInput, ArchiveRetentionStatusView, SystemHealthView, BackupTargetView, UpsertBackupTargetInput, BackupRunView, BackupRunResultView, PerformanceSampleView, DiagnosticEntryView, MaintenanceResultView, BackupSchedulerResultView, AdaptiveResourceStateView, PerformanceTrendView, BackgroundTaskView, SchedulerStatusView, QueuedTaskView, EnqueueTaskInput, TaskQueueCycleResultView, MaintenancePolicyView, UpsertMaintenancePolicyInput, MaintenanceCycleResultView, HealthNotificationView, DiagnosticReportView, DiagnosticFilterInput, DiagnosticReportHistoryView, SystemHealthScoreView, SystemHealthHistoryView, SystemHealthTrendView, DiagnosticArchiveView, DiagnosticReportVerificationView, DiagnosticArchiveVerificationView, DiagnosticReportContentView, PerformanceAnomalyView, IpcPerformanceTelemetryView, IpcAdaptiveBudgetMaintenanceAuthorityView, IpcAdaptiveBudgetMaintenanceReauthenticationInput, IpcAdaptiveBudgetMaintenanceSessionView, IpcAdaptiveBudgetMaintenanceAuthorizationInput, IpcAdaptiveBudgetMaintenanceRecoveryAuthorityView, IpcAdaptiveBudgetMaintenanceRecoveryInput, IpcAdaptiveBudgetMaintenanceRecoveryView, IpcAdaptiveBudgetResetView, IpcAdaptiveBudgetDiagnosticExportView, MaintenanceRecommendationView, DiagnosticReportComparisonView, DiagnosticArchiveContentView, DiagnosticArchiveSearchInput, DiagnosticArchiveExportView, MaintenanceHistoryView, MaintenanceHistoryFilterInput, MaintenanceHistoryExportView, UnifiedDiagnosticArchiveSearchView, ExportArtifactView, ExportArtifactVerificationView, BackupInspectionView } from '@ppt/domain';
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
  listArchiveCategories: ():Promise<ArchiveCategoryView[]> => invoke('archive:listCategories'),
  createArchiveCategory: (input:CreateArchiveCategoryInput):Promise<ArchiveCategoryView[]> =>
    invokeArchiveMutation('archive:createCategory', input, (operationId) => ({ ...input, operationId })),
  listArchiveClassifications: ():Promise<ArchiveClassificationView[]> => invoke('archive:listClassifications'),
  updateArchiveClassification: (input:UpdateArchiveClassificationInput):Promise<ArchiveClassificationView[]> =>
    invokeArchiveMutation('archive:updateClassification', input, (operationId) => ({ ...input, operationId })),
  listAiConsents: ():Promise<AiConsentView[]> => invoke('ai:listConsents'),
  upsertAiConsent: (input:UpsertAiConsentInput):Promise<AiConsentView[]> => invoke('ai:upsertConsent',input),
  previewAiAccess: (purpose:AiConsentPurpose):Promise<AiAccessPreviewView> => invoke('ai:previewAccess',purpose),
  getAuthState: (): Promise<AuthStateView> => invoke('auth:getState'),
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
  listFinance:():Promise<FinanceRecordView[]>=>invoke('finance:list'),
  createFinance:(input:CreateFinanceRecordInput):Promise<FinanceRecordView[]>=>invoke('finance:create',input),
  listHealth:():Promise<HealthRecordView[]>=>invoke('health:list'),
  createHealth:(input:CreateHealthRecordInput):Promise<HealthRecordView[]>=>invoke('health:create',input),
  listMedicationPlans:():Promise<MedicationPlanView[]>=>invoke('health:listMedicationPlans'),
  createMedicationPlan:(input:CreateMedicationPlanInput):Promise<MedicationPlanView[]>=>invoke('health:createMedicationPlan',input),
  listFamilyHealthHistory:():Promise<FamilyHealthHistoryView[]>=>invoke('health:listFamilyHistory'),
  createFamilyHealthHistory:(input:CreateFamilyHealthHistoryInput):Promise<FamilyHealthHistoryView[]>=>invoke('health:createFamilyHistory',input),
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
  listArchiveVersions:(itemId:string):Promise<ArchiveVersionView[]>=>invoke('archive:listVersions',itemId),
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
