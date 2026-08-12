import { app, BrowserWindow, dialog, ipcMain, net, protocol, safeStorage, shell, type IpcMainInvokeEvent } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { asCorrelationId, asIsoDateTime } from '@ppt/core';
import { writeContentFreeConsoleEvent } from '@ppt/logging';
import { APP_META, USER_VISIBLE_APP_INFO, type CreateArchiveItemInput, CreateFamilyEventInput, UpdateFamilyEventInput, SetFamilyEventArchivedInput, UpdateEventParticipantsInput, UpdateEventInvitationInput, UpdateEventNotesInput, AcknowledgeFamilyNotificationInput, CreateFamilyLocationInput, CreateFamilyMemberInput, CreateFamilyRelationInput, LoginInput, SetupAdminInput, ChangePasswordInput, EnableTwoFactorInput, DisableTwoFactorInput, TrustCurrentDeviceInput, ReauthorizeCurrentDeviceInput, CreateFamilyInvitationInput, InspectFamilyInvitationInput, ResendFamilyInvitationInput, AcceptFamilyInvitationInput, UpsertObjectPermissionInput, UpdateFamilyAccountInput, CreateFinanceRecordInput, CreateBankAccountInput, ValidateIbanInput, CreatePaymentCardInput, CreateHealthRecordInput, CreateMedicationPlanInput, CreateFamilyHealthHistoryInput, CreateFinanceValuationInput, CreateLifeRecordInput, CreateAutomationRuleInput, CreateArchiveCategoryInput, UpdateArchiveClassificationInput, UpsertAiConsentInput, AiConsentPurpose, UpsertSensitiveDataConsentInput, SensitiveExportPreviewInput, RunAutomationInput, UpsertDigitalLegacyPlanInput, UpsertLegacyGrantInput, ExecuteLegacyPlanInput, ApproveLegacyExecutionInput, CancelLegacyExecutionInput, ArchiveSearchInput, CreateArchiveRetentionPolicyInput, AssignArchiveRetentionPolicyInput, UpsertBackupTargetInput, MaintenanceResultView, BackupSchedulerResultView, AdaptiveResourceStateView, EnqueueTaskInput, UpsertMaintenancePolicyInput, DiagnosticFilterInput, DiagnosticArchiveSearchInput, MaintenanceHistoryFilterInput, CreateDataRetentionPolicyInput, ArchiveDataResourceInput, RestoreDataResourceInput, RequestDataPurgeInput, CancelDataPurgeInput, ExecuteDataPurgeInput, SetDataLegalHoldInput, UpdateBackupQuarantinePolicyInput, SetBackupQuarantineLegalHoldInput, DestroyBackupQuarantineBatchInput, RegisterExternalBackupCopyInput, ReviewExternalBackupCopyInput, SetExternalBackupCopyLegalHoldInput, AttestExternalBackupCopyDestroyedInput, RegisterExternalBackupEvidenceIssuerInput, RotateExternalBackupEvidenceIssuerInput, RevokeExternalBackupEvidenceIssuerInput, ApplyExternalBackupEvidenceRevocationListInput, UpsertExternalBackupRevocationEndpointInput, PendingRevocationSyncListView, ApplyPendingRevocationSyncInput, RevocationSyncEndpointStateView, RevocationSyncRunResultView, VerifyExternalBackupDestructionEvidenceInput, ApplyFamilyDataImportInput, RollbackFamilyDataImportInput, GenealogyTreePageInput, TimelinePageInput, ArchivePageInput, PersonCatalogPageInput, EventCatalogPageInput, EntityCatalogLookupInput, FamilySnapshotSectionsInput, IpcAdaptiveBudgetMaintenanceOperation, IpcAdaptiveBudgetMaintenanceAuthorizationInput, IpcAdaptiveBudgetMaintenanceReauthenticationInput, IpcAdaptiveBudgetMaintenanceRecoveryInput, UpdateBackupCleanRewritePolicyInput } from '@ppt/domain';
import type {
  AssignPersonMembershipInput,
  CreateFamilyBranchInput,
  CreateHouseholdInput,
  EnrollWindowsHelloInput,
  LoginWithWindowsHelloInput,
  ReauthenticateWithWindowsHelloInput,
  UnlockSessionInput,
  UpdatePersonProfileInput,
  WindowsHelloAuthenticationOutcome,
  WindowsHelloAuthenticationView,
  WindowsHelloStateView
} from '@ppt/domain';
import { EvaluatePolicyServiceAvailabilityUseCase, GetApplicationSecurityProfileGateBoundaryUseCase, GetDerivedDataPolicyBoundaryUseCase, GetPlatformCapabilityManifestGateBoundaryUseCase, GetPlatformPolicyAstGateBoundaryUseCase, GetPolicyConformanceSuiteBoundaryUseCase, GetPolicyDecisionAuditBoundaryUseCase, GetPolicyServiceAvailabilityBoundaryUseCase, GetSensitiveLoggingBoundaryUseCase, GetSourceDeletionPropagationBoundaryUseCase, type WindowsHelloPlatformPort } from '@ppt/application';
import type { IssueOfflineCapabilityLeaseInput, OfflineCapabilityLeaseWorkspaceView } from '@ppt/domain';
import {
  FamilyDataStore,
  FullBackupRestoreRestartRequiredError,
  type ArchivePendingOperationIntentInput
} from './data-store.js';
import { bootstrapDesktopRuntime, type DesktopRuntime } from './runtime-bootstrap.js';
import { registerCorrelatedIpcHandler, registerIpcCancellationHandlers, createRuntimeCorrelationId, type IpcHandler } from './ipc-runtime.js';
import { IpcTransportSessionRegistry } from './ipc-transport-context.js';
import { getIpcRequestAbortSignal, getIpcRequestContext, IpcRequestLifecycleRegistry } from './ipc-request-lifecycle.js';
import { IpcReadResultCacheRegistry, OfflineSensitiveCacheRegistry } from './ipc-read-sharing.js';
import { IpcPerformanceTelemetryRegistry } from './ipc-performance-telemetry.js';
import { IPC_ADAPTIVE_RESOURCE_BUDGET_POLICY_FINGERPRINT, IpcAdaptiveResourceBudgetController } from './ipc-adaptive-resource-budget.js';
import { IpcAdaptiveResourceBudgetStateStore } from './ipc-adaptive-resource-budget-state.js';
import { IpcAdaptiveBudgetMaintenanceSessionRegistry } from './ipc-adaptive-budget-maintenance-session.js';
import { evaluateIpcAdaptiveBudgetMaintenanceAuthority } from './ipc-adaptive-budget-maintenance-authority.js';
import { IpcAdaptiveBudgetMaintenanceReauthenticationGuard } from './ipc-adaptive-budget-maintenance-reauthentication-guard.js';
import { IpcAdaptiveBudgetMaintenanceReauthenticationStateStore } from './ipc-adaptive-budget-maintenance-reauthentication-state.js';
import { deriveIpcAdaptiveBudgetMaintenanceRecoveryContextKey, deriveIpcAdaptiveBudgetMaintenanceRecoveryCooldownContextKey, evaluateIpcAdaptiveBudgetMaintenanceRecoveryAuthority, parseIpcAdaptiveBudgetMaintenanceRecoveryInput } from './ipc-adaptive-budget-maintenance-lock-recovery.js';
import { isSafeExternalHttpsUrl, normalizeTrustedRendererDocumentUrl, type TrustedRendererDescriptor } from './ipc-sender-trust.js';
import { installRendererSessionSecurity, type RendererSecurityWebContentsLike } from './renderer-session-security.js';
import { PRIMARY_RENDERER_DOCUMENT_URL, PRIMARY_RENDERER_SCHEME, resolvePrimaryRendererAssetPath } from './renderer-protocol.js';
import {
  ElectronSafeStorageDeviceSecretProtector,
  WindowsDpapiDeviceSecretProtector,
  type DeviceSecretProtector
} from './device-secret-protector.js';
import { FileDeviceIdentityProvider } from './device-identity.js';
import { createSecureRendererPreferences, assertSecureRendererPreferences } from './renderer-window-security.js';
import { runStartupSecurityPreflight, type StartupSecurityPreflightReport } from './startup-security-preflight.js';
import { SecureRevocationSyncService } from './secure-revocation-sync-service.js';
import { ProtectedRevocationSyncStateStore } from './secure-revocation-sync-state.js';
import { AutomaticCleanBackupRewriteService } from './automatic-clean-backup-rewrite-service.js';
import { UserDataVault, WindowsHelloVaultUnlockError } from './user-data-vault.js';
import { PowerShellWindowsHelloPlatformAdapter } from './windows-hello-platform-adapter.js';
import {
  WindowsHelloPlatformCoordinator,
  type WindowsHelloVaultGrantBinding
} from './windows-hello-platform-coordinator.js';
import { VolatileSqliteSession } from './volatile-sqlite-session.js';
import { ProtectedSideArtifactStore } from './protected-side-artifact-store.js';
import { ProtectedOperationalArtifactFilePort } from './operational-artifact-file-application-adapter.js';
import { runWindowsSecurityEvidenceProbe, type WindowsSecurityEvidenceProbeReport } from './windows-security-evidence-probe.js';
import { runWindowsOpen021EfsEvidenceProbe, type WindowsOpen021EfsEvidenceProbeReport } from './windows-open021-efs-evidence-probe.js';
import { runWindowsOpen022SideArtifactEvidenceProbe, type WindowsOpen022SideArtifactEvidenceProbeReport } from './windows-open022-side-artifact-evidence-probe.js';
import { connectCoreServiceAtStartup, type CoreServiceStartupConnectionResult } from './core-service-startup-connection.js';
import { PlatformPolicyReceiptFileSink } from './platform-policy-receipt-file-sink.js';
import { PlatformPolicyDecisionAuditInspectionAdapter } from './policy-decision-audit-application-adapter.js';
import { DesktopUniversalApiPolicyEnforcement } from './desktop-universal-api-policy-enforcement.js';
import { DesktopRepositoryPolicyScope } from './desktop-repository-policy-scope.js';
import { PolicyServiceAvailabilityApplicationAdapter } from './policy-service-availability-application-adapter.js';
import { ApplicationSecurityProfilePolicy, DerivedDataInheritancePolicy, ImmutablePolicyDecisionAuditPolicy, NetworkEgressPolicy, PlatformCapabilityManifestPolicy, PlatformPolicyAstGatePolicy, PlatformPolicyConformanceSuite, PolicyServiceAvailabilityPolicy, SensitiveLogPolicy, SourceDeletionPropagationPolicy, assertPinnedBootstrapRuntimeCapability } from '@ppt/platform-policy';
import type { ApplicationSecurityProfileGateBoundaryView, DerivedDataPolicyBoundaryView, NetworkEgressBoundaryView, PlatformCapabilityManifestGateBoundaryView, PlatformPolicyAstGateBoundaryView, PolicyConformanceSuiteBoundaryView, PolicyDecisionAuditBoundaryView, PolicyServiceAvailabilityBoundaryView, SensitiveLoggingBoundaryView, SourceDeletionPropagationBoundaryView } from '@ppt/domain';
import { GetProductSurfaceGovernanceUseCase } from '@ppt/application';
import type { ProductSurfaceGovernanceView } from '@ppt/domain';
import { createProductSurfaceGovernanceRepository } from './repository-composition-root.js';

type ArchiveMutationInput<TInput> = TInput & { readonly operationId: string };
interface ArchiveItemMutationInput {
  readonly itemId: string;
  readonly operationId: string;
}

const currentDir = dirname(fileURLToPath(import.meta.url));
protocol.registerSchemesAsPrivileged([{
  scheme: PRIMARY_RENDERER_SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false }
}]);
const networkEgressPolicy = new NetworkEgressPolicy();
const derivedDataInheritancePolicy = new DerivedDataInheritancePolicy();
const sensitiveLogPolicy = new SensitiveLogPolicy();
const immutablePolicyDecisionAuditPolicy = new ImmutablePolicyDecisionAuditPolicy();
const sourceDeletionPropagationPolicy = new SourceDeletionPropagationPolicy();
const platformPolicyConformanceSuite = new PlatformPolicyConformanceSuite();
const platformPolicyAstGatePolicy = new PlatformPolicyAstGatePolicy();
const platformCapabilityManifestPolicy = new PlatformCapabilityManifestPolicy();
const applicationSecurityProfilePolicy = new ApplicationSecurityProfilePolicy();
const policyServiceAvailabilityPolicy = new PolicyServiceAvailabilityPolicy();
const getDerivedDataPolicyBoundaryUseCase = new GetDerivedDataPolicyBoundaryUseCase(derivedDataInheritancePolicy);
const getSensitiveLoggingBoundaryUseCase = new GetSensitiveLoggingBoundaryUseCase(sensitiveLogPolicy);
const getSourceDeletionPropagationBoundaryUseCase = new GetSourceDeletionPropagationBoundaryUseCase(sourceDeletionPropagationPolicy);
const getPolicyConformanceSuiteBoundaryUseCase = new GetPolicyConformanceSuiteBoundaryUseCase(platformPolicyConformanceSuite);
const getPlatformPolicyAstGateBoundaryUseCase = new GetPlatformPolicyAstGateBoundaryUseCase(platformPolicyAstGatePolicy);
const getPlatformCapabilityManifestGateBoundaryUseCase = new GetPlatformCapabilityManifestGateBoundaryUseCase(platformCapabilityManifestPolicy);
const getApplicationSecurityProfileGateBoundaryUseCase = new GetApplicationSecurityProfileGateBoundaryUseCase(applicationSecurityProfilePolicy);
const getProductSurfaceGovernanceUseCase = new GetProductSurfaceGovernanceUseCase(
  createProductSurfaceGovernanceRepository()
);
const currentProductName = 'Anadolu Parsı Aile Yaşam Merkezi';
assertPinnedBootstrapRuntimeCapability('windows-desktop', 'file.access');
assertPinnedBootstrapRuntimeCapability('windows-desktop', 'network.access');
const volatileRuntimeRoot = join(app.getPath('temp'), 'Anadolu-Parsi-Aile-Yasam-Merkezi', `runtime-${process.pid}`);
rmSync(volatileRuntimeRoot, { recursive: true, force: true });
mkdirSync(join(volatileRuntimeRoot, 'browser-session'), { recursive: true, mode: 0o700 });
mkdirSync(join(volatileRuntimeRoot, 'crash'), { recursive: true, mode: 0o700 });
app.setPath('sessionData', join(volatileRuntimeRoot, 'browser-session'));
app.setPath('crashDumps', join(volatileRuntimeRoot, 'crash'));
app.enableSandbox();
if (process.env.PPT_WINDOWS_LAUNCH_TEST) {
  app.disableHardwareAcceleration();
}
if (process.env.PPT_WINDOWS_LAUNCH_USER_DATA_PATH) {
  app.setPath('userData', process.env.PPT_WINDOWS_LAUNCH_USER_DATA_PATH);
} else if (app.isPackaged) {
  const appDataPath = app.getPath('appData');
  const currentUserDataPath = join(appDataPath, currentProductName);
  app.setPath('userData', currentUserDataPath);
}
const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) app.quit();
app.setAppUserModelId('tr.anadoluparsi.aileyasammerkezi');
let dataStore: FamilyDataStore | undefined;
let desktopRuntime: DesktopRuntime | undefined;
let coreServiceStartupConnection: CoreServiceStartupConnectionResult | undefined;
let archivePolicyReceiptSink: PlatformPolicyReceiptFileSink | undefined;
let desktopUniversalApiPolicyEnforcement: DesktopUniversalApiPolicyEnforcement | undefined;
let evaluatePolicyServiceAvailabilityUseCase: EvaluatePolicyServiceAvailabilityUseCase | undefined;
let getPolicyServiceAvailabilityBoundaryUseCase: GetPolicyServiceAvailabilityBoundaryUseCase | undefined;
const desktopRepositoryPolicyScope = new DesktopRepositoryPolicyScope();
let schedulerTimer: NodeJS.Timeout | undefined;
let performanceTimer: NodeJS.Timeout | undefined;
let schedulerStartedAt: string | undefined;
let lastSchedulerCycleAt: string | undefined;
let lastSchedulerResult: BackupSchedulerResultView | undefined;
let primaryWindow: BrowserWindow | undefined;
let trustedRenderer: TrustedRendererDescriptor | undefined;
let coordinatedWindowsHelloPlatform: WindowsHelloPlatformCoordinator | undefined;
let windowsHelloOperationInProgress = false;

function currentPrimaryWindowHandle(): string | null {
  if (process.platform !== 'win32' || !primaryWindow || primaryWindow.isDestroyed()) return null;
  const handle = primaryWindow.getNativeWindowHandle();
  if (handle.byteLength === 8) {
    const value = handle.readBigUInt64LE(0);
    return value > 0n ? value.toString() : null;
  }
  if (handle.byteLength === 4) {
    const value = handle.readUInt32LE(0);
    return value > 0 ? String(value) : null;
  }
  return null;
}

function windowsHelloPlatform(): WindowsHelloPlatformCoordinator {
  coordinatedWindowsHelloPlatform ??= new WindowsHelloPlatformCoordinator(
    new PowerShellWindowsHelloPlatformAdapter({ current: currentPrimaryWindowHandle })
  );
  return coordinatedWindowsHelloPlatform;
}

async function withExclusiveWindowsHelloOperation<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
  if (windowsHelloOperationInProgress) throw new Error('Başka bir Windows Hello işlemi devam ediyor.');
  windowsHelloOperationInProgress = true;
  try {
    return await operation();
  } finally {
    windowsHelloOperationInProgress = false;
  }
}

let osSecretProtector: DeviceSecretProtector | undefined;
let startupSecurityReport: StartupSecurityPreflightReport | undefined;
let windowsSecurityEvidenceReport: WindowsSecurityEvidenceProbeReport | undefined;
let windowsOpen021EfsEvidenceReport: WindowsOpen021EfsEvidenceProbeReport | undefined;
let windowsOpen022SideArtifactEvidenceReport: WindowsOpen022SideArtifactEvidenceProbeReport | undefined;
type StartupStage =
  | 'WAITING_FOR_APP_READY'
  | 'SAFE_STORAGE_INITIALIZATION'
  | 'RUNTIME_BOOTSTRAP'
  | 'CORE_SERVICE_CONNECTION'
  | 'POLICY_RECEIPT_JOURNAL_VERIFICATION'
  | 'RENDERER_SECURITY_POLICY'
  | 'STARTUP_SECURITY_PREFLIGHT'
  | 'DEVICE_IDENTITY_INITIALIZATION'
  | 'WINDOWS_SECURITY_PROBE'
  | 'OPEN021_EFS_PROBE'
  | 'OPEN022_SIDE_ARTIFACT_PROBE'
  | 'VAULT_INITIALIZATION'
  | 'IPC_REGISTRATION'
  | 'WINDOW_CREATION'
  | 'READY';
let startupStage: StartupStage = 'WAITING_FOR_APP_READY';

const writeEarlyStartupFailureEvidence = (error: unknown, origin: string): void => {
  const outputPath = process.env.PPT_WINDOWS_STARTUP_DIAGNOSTIC_PATH;
  if (!outputPath || !isAbsolute(outputPath)) return;
  const errorName = error instanceof Error ? error.name : 'NonErrorThrown';
  const errorFingerprint = sensitiveLogPolicy.hashSensitiveSignal(error);
  mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });
  writeFileSync(outputPath, `${JSON.stringify({
    schemaVersion: 1,
    product: currentProductName,
    applicationVersion: APP_META.version,
    packageVersion: APP_META.packageVersion,
    build: Number(APP_META.version.split('.').at(-1)),
    status: 'FAIL',
    fatal: true,
    origin,
    startupStage,
    errorName,
    errorFingerprint,
    generatedAt: new Date().toISOString()
  }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
};

const exitAfterFatalStartupError = (error: unknown, origin: string): void => {
  try { writeEarlyStartupFailureEvidence(error, origin); } catch (diagnosticError) {
    writeContentFreeConsoleEvent({
      timestamp: asIsoDateTime(new Date().toISOString()),
      level: 'error',
      service: 'desktop-main',
      process: 'startup',
      event: 'startup.evidence_write_failed',
      correlationId: asCorrelationId('startup-fatal'),
      outcome: 'failure',
      metadata: { origin, startupStage, errorName: diagnosticError instanceof Error ? diagnosticError.name : typeof diagnosticError }
    }, 'stderr');
  }
  writeContentFreeConsoleEvent({
    timestamp: asIsoDateTime(new Date().toISOString()),
    level: 'error',
    service: 'desktop-main',
    process: 'startup',
    event: 'application.startup_failed',
    correlationId: asCorrelationId('startup-fatal'),
    outcome: 'failure',
    metadata: {
      origin,
      startupStage,
      errorName: error instanceof Error ? error.name : 'NonErrorThrown',
      errorFingerprint: sensitiveLogPolicy.hashSensitiveSignal(error)
    }
  }, 'stderr');
  process.exitCode = 1;
  app.exit(1);
};
let revocationSyncService: SecureRevocationSyncService | undefined;
let automaticCleanBackupRewriteService: AutomaticCleanBackupRewriteService | undefined;
let userDataVault: UserDataVault | undefined;
let userDataSqliteSession: VolatileSqliteSession | undefined;
let vaultSessionGuardTimer: NodeJS.Timeout | undefined;
let lastVaultCheckpointAt = 0;
let maintenanceReauthenticationBinding: string | undefined;
const ipcTransportSessions = new IpcTransportSessionRegistry();
const ipcRequestLifecycles = new IpcRequestLifecycleRegistry();
const ipcReadResults = new IpcReadResultCacheRegistry();
const offlineSensitiveCache = new OfflineSensitiveCacheRegistry();
const ipcPerformanceTelemetry = new IpcPerformanceTelemetryRegistry();
const ipcAdaptiveResourceBudgetStateStore = new IpcAdaptiveResourceBudgetStateStore({
  directoryPath: join(app.getPath('userData'), 'runtime-state'),
  applicationVersion: APP_META.version,
  policyFingerprint: IPC_ADAPTIVE_RESOURCE_BUDGET_POLICY_FINGERPRINT
});
const protectedRevocationSyncStateStore = new ProtectedRevocationSyncStateStore({
  directoryPath: join(app.getPath('userData'), 'runtime-state'),
  applicationVersion: APP_META.version,
  protector: () => secretProtector(),
  maximumEndpoints: 128,
  maximumQuarantineFiles: 8
});
const ipcAdaptiveResourceBudget = new IpcAdaptiveResourceBudgetController({
  persistence: ipcAdaptiveResourceBudgetStateStore
});
const ipcAdaptiveBudgetMaintenanceSessions = new IpcAdaptiveBudgetMaintenanceSessionRegistry({ ttlMs: 90_000, maximumSessionsPerSender: 8 });
const ipcAdaptiveBudgetMaintenanceReauthenticationStateStore = new IpcAdaptiveBudgetMaintenanceReauthenticationStateStore({
  directoryPath: join(app.getPath('userData'), 'runtime-state'),
  applicationVersion: APP_META.version,
  protector: () => secretProtector(),
  deviceBinding: () => maintenanceReauthenticationDeviceBinding(),
  maximumTrackedContexts: 256,
  maximumQuarantineFiles: 4
});
const ipcAdaptiveBudgetMaintenanceRecoveryCooldownGuard = new IpcAdaptiveBudgetMaintenanceReauthenticationGuard({
  maximumFailedAttempts: 1,
  lockDurationMs: 15 * 60_000,
  failureWindowMs: 15 * 60_000,
  maximumTrackedContexts: 256,
  persistence: ipcAdaptiveBudgetMaintenanceReauthenticationStateStore
});
const ipcAdaptiveBudgetMaintenanceReauthenticationGuard = new IpcAdaptiveBudgetMaintenanceReauthenticationGuard({
  maximumFailedAttempts: 5,
  lockDurationMs: 5 * 60_000,
  failureWindowMs: 10 * 60_000,
  maximumTrackedContexts: 256,
  persistence: ipcAdaptiveBudgetMaintenanceReauthenticationStateStore
});

function runtime(): DesktopRuntime {
  if (!desktopRuntime) throw new Error('Desktop runtime henüz başlatılmadı.');
  return desktopRuntime;
}

function coreServiceConnection(): CoreServiceStartupConnectionResult {
  if (!coreServiceStartupConnection) throw new Error('Core Service bağlantısı henüz başlatılmadı.');
  return coreServiceStartupConnection;
}

function policyServiceAvailabilityEvaluation(): EvaluatePolicyServiceAvailabilityUseCase {
  if (!evaluatePolicyServiceAvailabilityUseCase) {
    throw new Error('Policy Service availability gate has not completed trusted startup');
  }
  return evaluatePolicyServiceAvailabilityUseCase;
}

function policyServiceAvailabilityBoundary(): GetPolicyServiceAvailabilityBoundaryUseCase {
  if (!getPolicyServiceAvailabilityBoundaryUseCase) {
    throw new Error('Policy Service availability boundary has not completed trusted startup');
  }
  return getPolicyServiceAvailabilityBoundaryUseCase;
}

function policyReceiptSink(): PlatformPolicyReceiptFileSink {
  if (!archivePolicyReceiptSink) {
    throw new Error('Platform policy receipt journal has not passed trusted startup verification');
  }
  return archivePolicyReceiptSink;
}

function universalApiPolicyEnforcement(): DesktopUniversalApiPolicyEnforcement {
  if (!desktopUniversalApiPolicyEnforcement) {
    const coreService = coreServiceConnection();
    desktopUniversalApiPolicyEnforcement = new DesktopUniversalApiPolicyEnforcement({
      authorizationProvider: coreService.adapter.policyProvider,
      receiptSink: policyReceiptSink(),
      clusterFence: coreService.adapter.clusterFence,
      resolveAuthority: () => store().currentPlatformPolicyAuthority({
        policyVersion: coreService.health.policyVersion,
        policyPackageVersion: coreService.health.policyPackage.payload.packageVersion,
        policyPackageSha256: coreService.health.policyPackage.payloadSha256,
        applicationVersion: coreService.health.policyPackage.payload.applicationVersions['windows-desktop']!
      }),
      repositoryPolicyScope: desktopRepositoryPolicyScope,
      evaluatePolicyServiceAvailability: () => policyServiceAvailabilityEvaluation().execute(),
      onAvailabilityRestricted: () => {
        ipcReadResults.clearAll();
        offlineSensitiveCache.lock('CONTEXT_MISMATCH');
      },
      resolveBootstrapClientContext: () => {
        const health = coreServiceConnection().health;
        const manifest = health.policyPackage.payload.applicationManifests['windows-desktop'];
        const device = currentWindowsHelloDeviceBinding();
        if (!manifest) throw new Error('CLIENT_DATA_ACCESS_APPLICATION_MANIFEST_UNAVAILABLE');
        return Object.freeze({
          applicationId: 'windows-desktop' as const,
          deviceId: device.deviceId,
          policyVersion: health.policyVersion,
          policyPackageSha256: health.policyPackage.payloadSha256,
          capabilityManifestSha256: manifest.capabilityManifestSha256,
          occurredAt: runtime().clock.now()
        });
      },
      clock: () => runtime().clock.now()
    });
  }
  return desktopUniversalApiPolicyEnforcement;
}

function secretProtector(): DeviceSecretProtector {
  if (!osSecretProtector) throw new Error('İşletim sistemi sır koruması henüz başlatılmadı.');
  return osSecretProtector;
}

function vault(): UserDataVault {
  if (!userDataVault) {
    const current = runtime();
    userDataVault = new UserDataVault({
      headerPath: join(current.config.paths.secrets, 'user-data-vault.json'),
      containerPath: join(current.config.paths.data, 'family-data.pptvault'),
      protector: secretProtector()
    });
  }
  return userDataVault;
}

function lockedAuthState() {
  return { initialized: vault().isInitialized(), authenticated: false } as const;
}

function currentWindowsHelloDeviceBinding(): { readonly deviceId: string; readonly deviceFingerprint: string } {
  const current = runtime();
  const identity = new FileDeviceIdentityProvider(
    join(current.config.paths.secrets, 'device-identity.json'),
    current.clock,
    secretProtector()
  ).snapshot();
  return { deviceId: identity.deviceId, deviceFingerprint: identity.fingerprint };
}

function currentWindowsHelloRequestBinding(
  event: IpcMainInvokeEvent,
  device: { readonly deviceId: string; readonly deviceFingerprint: string }
): WindowsHelloVaultGrantBinding {
  const request = getIpcRequestContext(event);
  const correlationId = runtime().correlation.current()?.correlationId;
  const senderId = event.sender?.id;
  if (!request || !correlationId || !Number.isSafeInteger(senderId) || senderId < 0) {
    throw new Error('Windows Hello isteğinin güvenilir IPC bağı bulunamadı.');
  }
  return {
    ...device,
    senderId,
    requestId: request.requestId,
    correlationId
  };
}

function requireActiveIpcRequest(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new Error('Windows Hello IPC isteği iptal edildi.');
}

const windowsHelloAuthenticationView = (
  outcome: WindowsHelloAuthenticationOutcome,
  diagnosticCode?: string
): WindowsHelloAuthenticationView => ({
  authenticated: false,
  method: 'none',
  outcome,
  passwordFallbackAvailable: true,
  ...(diagnosticCode ? { diagnosticCode } : {})
});

async function lockedWindowsHelloState(): Promise<WindowsHelloStateView> {
  const assessment = await windowsHelloPlatform().assessAvailability();
  const hasVaultSlot = vault().hasWindowsHelloKeySlots();
  return {
    availability: assessment.availability,
    enrolled: hasVaultSlot,
    deviceChanged: false,
    principalChanged: false,
    securityEpochChanged: false,
    passwordFallbackAvailable: true,
    diagnosticCode: hasVaultSlot
      ? 'locked_vault_binding_requires_user_consent'
      : assessment.diagnosticCode ?? 'registration_not_found'
  };
}

function stopVaultSessionGuard(): void {
  if (vaultSessionGuardTimer) clearInterval(vaultSessionGuardTimer);
  vaultSessionGuardTimer = undefined;
}

function openVolatileUserDataSession(initialDatabaseBytes: Buffer): void {
  if (userDataSqliteSession) throw new Error('Bellek-içi kullanıcı veri oturumu zaten açık.');
  const current = runtime();
  try {
    userDataSqliteSession = new VolatileSqliteSession({
      stagingRoot: join(current.config.paths.temp, 'secure-user-staging'),
      initialDatabaseBytes,
      requireWindowsEfs: process.platform === 'win32'
    });
  } finally {
    initialDatabaseBytes.fill(0);
  }
}

function checkpointUserDataSession(): void {
  const session = userDataSqliteSession;
  const userVault = userDataVault;
  if (!session || !userVault?.isUnlocked()) return;
  const bytes = session.snapshotBytes();
  try {
    userVault.checkpoint(bytes);
    lastVaultCheckpointAt = Date.now();
  } finally {
    bytes.fill(0);
  }
}

function discardVolatileUserDataSession(): void {
  const currentStore = dataStore;
  const currentSession = userDataSqliteSession;
  dataStore = undefined;
  userDataSqliteSession = undefined;
  automaticCleanBackupRewriteService = undefined;
  const failures: unknown[] = [];
  try { currentStore?.close(); } catch (error) { failures.push(error); }
  try { currentSession?.close(); } catch (error) { failures.push(error); }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(failures, 'Bellek-içi kullanıcı veri oturumu tamamen kapatılamadı.');
  }
}

function sealUserDataSession(): void {
  stopBackgroundSchedulers();
  stopVaultSessionGuard();
  const session = userDataSqliteSession;
  const userVault = userDataVault;
  if (!session || !userVault?.isUnlocked()) {
    try { discardVolatileUserDataSession(); }
    finally { userVault?.discardSession(); }
    return;
  }
  const currentStore = dataStore;
  dataStore = undefined;
  userDataSqliteSession = undefined;
  automaticCleanBackupRewriteService = undefined;
  const failures: unknown[] = [];
  let bytes: Buffer | undefined;
  try { currentStore?.close(); } catch (error) { failures.push(error); }
  if (failures.length === 0) {
    try {
      bytes = session.snapshotBytes();
      userVault.seal(bytes);
    } catch (error) {
      failures.push(error);
    }
  }
  bytes?.fill(0);
  userVault.discardSession();
  try { session.close(); } catch (error) { failures.push(error); }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(failures, 'Kullanıcı veri oturumu güvenli biçimde mühürlenemedi.');
  }
}

function startVaultSessionGuard(): void {
  if (vaultSessionGuardTimer) return;
  vaultSessionGuardTimer = setInterval(() => {
    const current = dataStore;
    if (!current) return;
    const correlationId = createRuntimeCorrelationId('job');
    void runtime().correlation.run({ correlationId }, () => universalApiPolicyEnforcement().execute({
      channel: 'system:captureVaultSessionCheckpoint',
      correlationId,
      operation: () => {
        if (!current.isAuthenticated()) throw new Error('VAULT_SESSION_AUTHORITY_EXPIRED');
        if (Date.now() - lastVaultCheckpointAt >= 30_000) checkpointUserDataSession();
      }
    })).catch((error: unknown) => {
      runtime().logger.warn({
        timestamp: runtime().clock.now(),
        service: 'desktop-main',
        process: 'vault-session-guard',
        event: 'vault.session_guard.authorization_failed',
        correlationId,
        outcome: 'failure',
        metadata: { errorName: error instanceof Error ? error.name : typeof error }
      });
      sealUserDataSession();
    });
  }, 15_000);
}


function initializeMaintenanceReauthenticationDeviceBinding(): void {
  const identityPath = join(runtime().config.paths.secrets, 'device-identity.json');
  const identity = new FileDeviceIdentityProvider(identityPath, runtime().clock, secretProtector()).snapshot();
  maintenanceReauthenticationBinding = createHash('sha256')
    .update(`${identity.deviceId}\u0000${identity.fingerprint}`, 'utf8')
    .digest('hex');
}

function maintenanceReauthenticationDeviceBinding(): string {
  if (!maintenanceReauthenticationBinding) {
    throw new Error('Bakım yeniden doğrulama cihaz bağı güvenli cihaz kimliğinden başlatılmadı.');
  }
  return maintenanceReauthenticationBinding;
}

function revocationSync(): SecureRevocationSyncService {
  if(!revocationSyncService){
    revocationSyncService=new SecureRevocationSyncService({
      listEndpoints:()=>store().listExternalBackupRevocationEndpoints(500),
      listVerifiedLists:()=>store().listExternalBackupEvidenceRevocationLists(500),
      recordFetch:(endpointId,status,error,at)=>{store().recordExternalBackupRevocationEndpointFetch(endpointId,status,error,at);},
      notify:({title,body,urgency})=>{void dialog.showMessageBox({type:urgency==='critical'?'warning':'info',title,message:body,noLink:true});},
      diagnostic:(severity,code,message,details)=>store().recordDiagnostic(severity,code,message,details),
      now:()=>new Date(),
      persistence:protectedRevocationSyncStateStore
    });
  }
  return revocationSyncService;
}

function cleanBackupRewrite():AutomaticCleanBackupRewriteService {
  if(!automaticCleanBackupRewriteService)automaticCleanBackupRewriteService=new AutomaticCleanBackupRewriteService(()=>store(),()=>new Date().toISOString(),()=>performance.now());
  return automaticCleanBackupRewriteService;
}

function store(windowsHelloPlatformOverride?: WindowsHelloPlatformPort): FamilyDataStore {
  if (!dataStore) {
    const current = runtime();
    const osSecretProtector = secretProtector();
    const session = userDataSqliteSession;
    if (!session || !vault().isUnlocked()) throw new Error('Kullanıcı veri kasası kilitli.');
    const databasePath = join(current.config.paths.data, current.config.database.fileName);
    const coreService = coreServiceConnection();
    const archivePolicyReceiptSink = policyReceiptSink();
    dataStore = new FamilyDataStore({
      databasePath,
      databaseConnection: session.database,
      databaseSnapshotProvider: session,
      skipFileMigrationSafetyBackup: true,
      restoreDatabasePath: session.restoreDatabasePath(),
      deviceIdentityPath: join(current.config.paths.secrets, 'device-identity.json'),
      deviceSecretProtector: osSecretProtector,
      mfaSecretProtector: osSecretProtector,
      windowsHelloPlatform: windowsHelloPlatformOverride ?? windowsHelloPlatform(),
      windowsHelloWindowHandleProvider: { current: currentPrimaryWindowHandle },
      backupSecretProtector: osSecretProtector,
      vaultKeySecretProtector: osSecretProtector,
      backupPasswordPath: join(current.config.paths.secrets, 'managed-backup-password.json'),
      securityEventReceiptPath: join(dirname(databasePath), 'security-event-receipts.pptdiag'),
      protectedSideArtifacts: current.protectedArtifacts,
      operationalArtifactFiles: new ProtectedOperationalArtifactFilePort(current.protectedArtifacts),
      archivePath: current.config.paths.archive,
      archivePolicyAuthorizationProvider: coreService.adapter.policyProvider,
      archivePolicyReceiptSink,
      archivePolicyVersion: coreService.health.policyVersion,
      archiveClusterFence: coreService.adapter.clusterFence,
      applicationVersion: APP_META.version,
      databaseConfig: current.config.database,
      clock: current.clock,
      correlation: current.correlation,
      logger: current.logger,
      repositoryExecutionPolicyGuard: desktopRepositoryPolicyScope.guard,
      sourceDeletionExternalCacheInvalidator: {
        invalidate: () => {
          const mainReadEntries = ipcReadResults.entryCount();
          ipcReadResults.clearAll();
          const offlineSensitiveEntries = offlineSensitiveCache.state().entryCount;
          offlineSensitiveCache.lock('NO_LEASE');
          return Object.freeze([
            Object.freeze({ registryId: 'ipc-main-read' as const, invalidatedEntryCount: mainReadEntries }),
            Object.freeze({ registryId: 'offline-sensitive' as const, invalidatedEntryCount: offlineSensitiveEntries })
          ]);
        }
      },
      securityConfig: current.config.security,
      migrationBackupDirectory: join(dirname(databasePath), 'migration-backups'),
      onMigrationCompleted: (summary) => current.logger.info({
        timestamp: current.clock.now(),
        service: 'desktop-main',
        process: 'electron-main',
        event: 'database.migration.completed',
        correlationId: createRuntimeCorrelationId('migration'),
        outcome: 'success',
        metadata: {
          appliedVersions: summary.appliedVersions,
          adoptedVersions: summary.adoptedVersions,
          alreadyAppliedVersions: summary.alreadyAppliedVersions,
          schemaFingerprint: summary.schemaAfter.fingerprint,
          applicationTableCount: summary.schemaAfter.tableCount,
          safetyBackupCreated: summary.safetyBackup !== undefined
        }
      })
    });
  }
  return dataStore;
}

function registerIpcHandler<TArguments extends unknown[], TResult>(
  channel: string,
  handler: IpcHandler<TArguments, TResult>
): void {
  const policyEnforcement = universalApiPolicyEnforcement();
  policyEnforcement.registerClientApplicationServiceChannel(channel);
  registerCorrelatedIpcHandler({
    ipcMain,
    runtime: runtime(),
    channel,
    resolveTrustedRenderer: () => trustedRenderer,
    transportSessions: ipcTransportSessions,
    requestLifecycles: ipcRequestLifecycles,
    readResults: ipcReadResults,
    telemetry: ipcPerformanceTelemetry,
    adaptiveBudget: ipcAdaptiveResourceBudget,
    policyEnforcement,
    handler
  });
}

function adaptiveMaintenanceAuthSnapshot(): { readonly fingerprint: string; readonly authority: ReturnType<typeof evaluateIpcAdaptiveBudgetMaintenanceAuthority>; readonly role: string; readonly trustedDevice: boolean } {
  const auth = store().getAuthState();
  const fingerprint = createHash('sha256').update(JSON.stringify({
    authenticated: auth.authenticated,
    role: auth.role ?? null,
    currentDeviceId: auth.currentDeviceId ?? null,
    sessionExpiresAt: auth.sessionExpiresAt ?? null,
    trustedDevice: auth.trustedDevice ?? false
  }), 'utf8').digest('hex');
  const throttle = ipcAdaptiveBudgetMaintenanceReauthenticationGuard.status(fingerprint);
  const authority = evaluateIpcAdaptiveBudgetMaintenanceAuthority(auth, Date.now(), throttle);
  return Object.freeze({ fingerprint, authority, role: auth.role ?? 'none', trustedDevice: auth.trustedDevice === true });
}

function adaptiveMaintenanceRecoverySnapshot(): { readonly primaryFingerprint: string; readonly recoveryFingerprint: string; readonly cooldownFingerprint: string; readonly primaryAuthority: ReturnType<typeof evaluateIpcAdaptiveBudgetMaintenanceAuthority>; readonly authority: ReturnType<typeof evaluateIpcAdaptiveBudgetMaintenanceRecoveryAuthority>; readonly role: string; readonly trustedDevice: boolean } {
  const auth = store().getAuthState();
  const primary = adaptiveMaintenanceAuthSnapshot();
  const recoveryFingerprint = deriveIpcAdaptiveBudgetMaintenanceRecoveryContextKey(primary.fingerprint);
  const recoveryThrottle = ipcAdaptiveBudgetMaintenanceReauthenticationGuard.status(recoveryFingerprint);
  const cooldownFingerprint = deriveIpcAdaptiveBudgetMaintenanceRecoveryCooldownContextKey(primary.fingerprint);
  const recoveryCooldown = ipcAdaptiveBudgetMaintenanceRecoveryCooldownGuard.status(cooldownFingerprint);
  const authority = evaluateIpcAdaptiveBudgetMaintenanceRecoveryAuthority(auth, primary.authority, recoveryThrottle, recoveryCooldown, Date.now());
  return Object.freeze({
    primaryFingerprint: primary.fingerprint,
    recoveryFingerprint,
    cooldownFingerprint,
    primaryAuthority: primary.authority,
    authority,
    role: auth.role ?? 'none',
    trustedDevice: auth.trustedDevice === true
  });
}

function adaptiveMaintenanceRecoveryContext(): ReturnType<typeof adaptiveMaintenanceRecoverySnapshot> {
  const snapshot = adaptiveMaintenanceRecoverySnapshot();
  if (snapshot.authority.allowed) return snapshot;
  runtime().logger.warn({
    timestamp: runtime().clock.now(),
    service: 'desktop-main',
    process: 'electron-main',
    event: 'ipc.adaptive_budget.maintenance_lock_recovery_authority_rejected',
    correlationId: createRuntimeCorrelationId('ipc'),
    outcome: 'failure',
    metadata: {
      reason: snapshot.authority.reason,
      primaryReason: snapshot.primaryAuthority.reason,
      role: snapshot.role,
      trustedDevice: snapshot.trustedDevice,
      recoveryLocked: snapshot.authority.recoveryLocked,
      retryAfterSeconds: snapshot.authority.recoveryRetryAfterSeconds ?? 0
    }
  });
  if (snapshot.authority.reason === 'RECOVERY_COOLDOWN_ACTIVE') {
    throw new Error(`[AUTH_RATE_LIMITED] Bakım kilidi kurtarma soğuma süresi etkin. ${snapshot.authority.recoveryCooldownRetryAfterSeconds ?? 1} saniye sonra yeniden deneyin.`);
  }
  if (snapshot.authority.reason === 'RECOVERY_RATE_LIMITED') {
    throw new Error(`[AUTH_RATE_LIMITED] Bakım kilidi kurtarma geçici olarak sınırlandı. ${snapshot.authority.recoveryRetryAfterSeconds ?? 1} saniye sonra yeniden deneyin.`);
  }
  throw new Error(`Bakım kilidi kurtarma yetkisi reddedildi: ${snapshot.authority.reason}.`);
}

function adaptiveMaintenanceAuthContext(): { readonly fingerprint: string; readonly authority: ReturnType<typeof evaluateIpcAdaptiveBudgetMaintenanceAuthority> } {
  const snapshot = adaptiveMaintenanceAuthSnapshot();
  const rejectAuthority = (): never => {
    runtime().logger.warn({
      timestamp: runtime().clock.now(),
      service: 'desktop-main',
      process: 'electron-main',
      event: 'ipc.adaptive_budget.maintenance_authority_rejected',
      correlationId: createRuntimeCorrelationId('ipc'),
      outcome: 'failure',
      metadata: {
        reason: snapshot.authority.reason,
        role: snapshot.role,
        trustedDevice: snapshot.trustedDevice,
        reauthenticationLocked: snapshot.authority.reauthenticationLocked,
        retryAfterSeconds: snapshot.authority.reauthenticationRetryAfterSeconds ?? 0
      }
    });
    if (snapshot.authority.reason === 'REAUTHENTICATION_LOCKED') {
      throw new Error(`[AUTH_RATE_LIMITED] Güçlü doğrulama geçici olarak kilitlendi. ${snapshot.authority.reauthenticationRetryAfterSeconds ?? 1} saniye sonra yeniden deneyin.`);
    }
    throw new Error(`Adaptif bütçe bakım yetkisi reddedildi: ${snapshot.authority.reason}.`);
  };
  if (!snapshot.authority.allowed) rejectAuthority();
  return Object.freeze({ fingerprint: snapshot.fingerprint, authority: snapshot.authority });
}

const countedMaintenanceReauthenticationFailureCode = (error: unknown): 'AUTH_INVALID_CREDENTIALS' | 'AUTH_SECOND_FACTOR_INVALID' | undefined => {
  const message = error instanceof Error ? error.message : String(error);
  const code = /^\[([A-Z0-9_]+)\]/u.exec(message)?.[1];
  return code === 'AUTH_INVALID_CREDENTIALS' || code === 'AUTH_SECOND_FACTOR_INVALID' ? code : undefined;
};

function adaptiveMaintenanceAuthFingerprint(): string {
  return adaptiveMaintenanceAuthContext().fingerprint;
}

function consumeAdaptiveMaintenanceSession(
  senderId: number,
  input: IpcAdaptiveBudgetMaintenanceAuthorizationInput,
  expectedOperation: IpcAdaptiveBudgetMaintenanceOperation
): string {
  if (input.operation !== expectedOperation) throw new Error('Bakım oturumu işlem türü çağrıyla uyuşmuyor.');
  const decision = ipcAdaptiveBudgetMaintenanceSessions.consume({
    senderId,
    rendererSessionId: input.rendererSessionId,
    authFingerprint: adaptiveMaintenanceAuthFingerprint(),
    operation: expectedOperation,
    sessionId: input.sessionId
  });
  if (!decision.accepted || !decision.sessionFingerprint) {
    runtime().logger.warn({
      timestamp: runtime().clock.now(),
      service: 'desktop-main',
      process: 'electron-main',
      event: 'ipc.adaptive_budget.maintenance_session_rejected',
      correlationId: createRuntimeCorrelationId('ipc'),
      outcome: 'failure',
      metadata: { operation: expectedOperation, reason: decision.reason, senderId }
    });
    throw new Error(`Adaptif bütçe bakım oturumu reddedildi: ${decision.reason}.`);
  }
  runtime().logger.info({
    timestamp: runtime().clock.now(),
    service: 'desktop-main',
    process: 'electron-main',
    event: 'ipc.adaptive_budget.maintenance_session_consumed',
    correlationId: createRuntimeCorrelationId('ipc'),
    outcome: 'success',
    metadata: { operation: expectedOperation, sessionFingerprint: decision.sessionFingerprint.slice(0, 16), senderId }
  });
  return decision.sessionFingerprint;
}

function registerIpc(): void {
  registerIpcCancellationHandlers({
    ipcMain,
    runtime: runtime(),
    resolveTrustedRenderer: () => trustedRenderer,
    requestLifecycles: ipcRequestLifecycles
  });
  registerIpcHandler('app:getInfo', () => USER_VISIBLE_APP_INFO);
  registerIpcHandler('auth:getExternalIdentityProviders', () => ([
    { id: 'apple', label: 'Apple ile devam et', configured: Boolean(process.env.PPT_OIDC_APPLE_CLIENT_ID), productionReady: process.env.PPT_OIDC_APPLE_READY === '1' },
    { id: 'google', label: 'Google ile devam et', configured: Boolean(process.env.PPT_OIDC_GOOGLE_CLIENT_ID), productionReady: process.env.PPT_OIDC_GOOGLE_READY === '1' },
    { id: 'microsoft', label: 'Microsoft ile devam et', configured: Boolean(process.env.PPT_OIDC_MICROSOFT_CLIENT_ID), productionReady: process.env.PPT_OIDC_MICROSOFT_READY === '1' }
  ]));
  registerIpcHandler('auth:getState', () => dataStore ? dataStore.getAuthState() : lockedAuthState());
  registerIpcHandler('auth:getSessionLockState', () => store().getSessionLockState());
  registerIpcHandler('auth:recordSessionActivity', () => store().recordSessionActivity());
  registerIpcHandler('auth:lockSession', () => store().lockSession());
  registerIpcHandler('auth:unlockSession', (_event, input: UnlockSessionInput) => store().unlockSession(input));
  registerIpcHandler('auth:getWindowsHelloState', () =>
    dataStore ? store().getWindowsHelloState() : lockedWindowsHelloState()
  );
  registerIpcHandler('auth:setup', (_event, input: SetupAdminInput) => {
    const userVault = vault();
    if (userVault.isInitialized()) throw new Error('İlk kurulum daha önce tamamlanmış.');
    const initialDatabaseBytes = userVault.initialize(input.password);
    try {
      openVolatileUserDataSession(initialDatabaseBytes);
      const state = store().setupAdmin(input);
      userVault.markInitializationCommitted();
      checkpointUserDataSession();
      startBackgroundSchedulers();
      startVaultSessionGuard();
      return state;
    } catch (error) {
      discardVolatileUserDataSession();
      userVault.abortInitialization();
      throw error;
    }
  });
  registerIpcHandler('auth:login', (_event, input: LoginInput) => {
    if (windowsHelloOperationInProgress) {
      throw new Error('Windows Hello işlemi sürerken parola girişi başlatılamaz.');
    }
    const userVault = vault();
    if (!userVault.isInitialized()) throw new Error('İlk kurulum tamamlanmamış.');
    try {
      if (!userVault.isUnlocked()) openVolatileUserDataSession(userVault.unlock(input.password));
      const current = store().getAuthState();
      const accountId = input.accountId ?? current.profiles?.[0]?.id;
      if (!accountId) throw new Error('Yerel kullanıcı profili bulunamadı.');
      const state = store().login({ ...input, accountId });
      checkpointUserDataSession();
      startBackgroundSchedulers();
      startVaultSessionGuard();
      return state;
    } catch (error) {
      discardVolatileUserDataSession();
      userVault.discardSession();
      throw error;
    }
  });
  registerIpcHandler('auth:loginWithWindowsHello', async (event, input: LoginWithWindowsHelloInput) => {
    if (windowsHelloOperationInProgress) {
      return windowsHelloAuthenticationView('device_busy', 'windows_hello_operation_in_progress');
    }
    return withExclusiveWindowsHelloOperation(async () => {
      const signal = getIpcRequestAbortSignal(event);
      requireActiveIpcRequest(signal);
      const userVault = vault();
      if (!userVault.isInitialized()) throw new Error('İlk kurulum tamamlanmamış.');
      if (dataStore || userVault.isUnlocked()) {
        return windowsHelloAuthenticationView('error', 'session_already_open');
      }
      if (!userVault.hasWindowsHelloKeySlots()) {
        return windowsHelloAuthenticationView('registration_not_found', 'vault_slot_not_found');
      }
      const platform = windowsHelloPlatform();
      const initialDevice = currentWindowsHelloDeviceBinding();
      const requestBinding = currentWindowsHelloRequestBinding(event, initialDevice);
      let prepared;
      try {
        prepared = await platform.prepareLoginVerification(requestBinding);
        requireActiveIpcRequest(signal);
      } catch {
        return windowsHelloAuthenticationView('error', 'native_verification_exception');
      }
      const postPromptDevice = currentWindowsHelloDeviceBinding();
      if (
        postPromptDevice.deviceId !== initialDevice.deviceId
        || postPromptDevice.deviceFingerprint !== initialDevice.deviceFingerprint
      ) {
        prepared.releaseReplay?.();
        return windowsHelloAuthenticationView('device_changed', 'device_changed_during_prompt');
      }
      const verification = prepared.verification;
      if (prepared.assessment.availability !== 'available') {
        return windowsHelloAuthenticationView(
          prepared.assessment.availability,
          prepared.assessment.diagnosticCode
        );
      }
      if (!verification || verification.outcome !== 'verified') {
        return windowsHelloAuthenticationView(
          verification?.outcome ?? 'error',
          verification?.diagnosticCode ?? 'native_verification_missing'
        );
      }
      if (!prepared.vaultUnlockGrant || !prepared.replayPlatform) {
        return windowsHelloAuthenticationView('error', 'verified_principal_hash_missing_or_invalid');
      }
      let unlocked;
      try {
        requireActiveIpcRequest(signal);
        unlocked = userVault.unlockWithWindowsHello({
          grant: prepared.vaultUnlockGrant,
          requestBinding
        });
      } catch (error) {
        prepared.releaseReplay?.();
        if (error instanceof WindowsHelloVaultUnlockError) {
          const outcome: WindowsHelloAuthenticationOutcome = error.failure === 'device_changed'
            ? 'device_changed'
            : error.failure === 'principal_changed'
              ? 'principal_changed'
              : error.failure === 'slot_not_found'
                ? 'registration_not_found'
                : 'error';
          if (error.failure === 'device_changed' || error.failure === 'principal_changed' || error.failure === 'slot_invalid') {
            try { userVault.clearWindowsHelloKeySlots(); }
            catch { return windowsHelloAuthenticationView('error', 'vault_mismatch_cleanup_failed'); }
          }
          return windowsHelloAuthenticationView(outcome, `vault_${error.failure}`);
        }
        return windowsHelloAuthenticationView('error', 'vault_unlock_failure');
      }
      if (input.accountId && input.accountId !== unlocked.accountId) {
        prepared.releaseReplay?.();
        unlocked.databaseBytes.fill(0);
        userVault.discardSession();
        return windowsHelloAuthenticationView('account_unavailable', 'selected_account_does_not_match_vault_slot');
      }
      try {
        requireActiveIpcRequest(signal);
        openVolatileUserDataSession(unlocked.databaseBytes);
        const result = await store(prepared.replayPlatform).loginWithWindowsHello({
          ...input,
          accountId: unlocked.accountId
        });
        prepared.releaseReplay?.();
        requireActiveIpcRequest(signal);
        const exactRegistration = result.registration?.id === unlocked.registrationId
          && result.registration.securityEpoch === unlocked.securityEpoch;
        if (!result.authenticated || !exactRegistration) {
          userVault.removeWindowsHelloKeySlot(unlocked.slotId);
          try { discardVolatileUserDataSession(); }
          finally { userVault.discardSession(); }
          return result.authenticated
            ? windowsHelloAuthenticationView('security_epoch_changed', 'vault_registration_binding_mismatch')
            : result;
        }
        checkpointUserDataSession();
        startBackgroundSchedulers();
        startVaultSessionGuard();
        return result;
      } catch (error) {
        prepared.releaseReplay?.();
        try { discardVolatileUserDataSession(); }
        finally { userVault.discardSession(); }
        throw error;
      }
    });
  });
  registerIpcHandler('auth:logout', () => {
    if (windowsHelloOperationInProgress) {
      throw new Error('Windows Hello işlemi sürerken oturum kapatılamaz.');
    }
    try { return store().logout(); }
    finally { offlineSensitiveCache.lock('NO_LEASE'); sealUserDataSession(); }
  });
  registerIpcHandler('auth:changePassword', (_event, input: ChangePasswordInput) => {
    if (windowsHelloOperationInProgress) {
      throw new Error('Windows Hello işlemi sürerken parola değiştirilemez.');
    }
    const state = store().changePassword(input);
    vault().replacePassword(input.newPassword);
    checkpointUserDataSession();
    return state;
  });
  registerIpcHandler('auth:enrollWindowsHello', async (event, input: EnrollWindowsHelloInput) => {
    if (windowsHelloOperationInProgress) {
      return {
        enrolled: false,
        outcome: 'device_busy',
        passwordFallbackAvailable: true,
        diagnosticCode: 'windows_hello_operation_in_progress'
      };
    }
    return withExclusiveWindowsHelloOperation(async () => {
      const signal = getIpcRequestAbortSignal(event);
      requireActiveIpcRequest(signal);
      const platform = windowsHelloPlatform();
      const capture = platform.beginVerificationCapture();
      let captureFinished = false;
      let registrationCreated = false;
      try {
        const result = await store().enrollWindowsHello(input);
        registrationCreated = result.enrolled && Boolean(result.registration);
        requireActiveIpcRequest(signal);
        const verification = platform.finishVerificationCapture(capture);
        captureFinished = true;
        if (result.enrolled && result.registration) {
          if (
            verification?.outcome !== 'verified'
            || !verification.windowsPrincipalHash
            || !/^[a-f0-9]{64}$/u.test(verification.windowsPrincipalHash)
          ) {
            throw new Error('Windows Hello kasa yuvası için doğrulanmış Windows kullanıcı bağı bulunamadı.');
          }
          const binding = currentWindowsHelloDeviceBinding();
          let slotId: string | undefined;
          try {
            requireActiveIpcRequest(signal);
            slotId = vault().registerWindowsHelloKeySlot({
              accountId: store().currentAuthenticatedAccountId(),
              registrationId: result.registration.id,
              deviceId: binding.deviceId,
              deviceFingerprint: binding.deviceFingerprint,
              windowsPrincipalHash: verification.windowsPrincipalHash,
              securityEpoch: result.registration.securityEpoch
            });
            checkpointUserDataSession();
          } catch (error) {
            let slotRollbackError: unknown;
            if (slotId) {
              try { vault().removeWindowsHelloKeySlot(slotId); }
              catch (rollbackError) { slotRollbackError = rollbackError; }
            }
            try { discardVolatileUserDataSession(); }
            finally { vault().discardSession(); }
            if (slotRollbackError) {
              throw new AggregateError(
                [error, slotRollbackError],
                'Windows Hello kaydı kalıcılaştırılamadı ve kasa yuvası geri alınamadı.'
              );
            }
            throw error;
          }
        }
        return result;
      } catch (error) {
        if (registrationCreated && dataStore) {
          try { discardVolatileUserDataSession(); }
          finally { vault().discardSession(); }
        }
        throw error;
      } finally {
        if (!captureFinished) platform.cancelVerificationCapture(capture);
      }
    });
  });
  registerIpcHandler('auth:reauthenticateWithWindowsHello', async (event, input: ReauthenticateWithWindowsHelloInput) => {
    if (windowsHelloOperationInProgress) {
      return windowsHelloAuthenticationView('device_busy', 'windows_hello_operation_in_progress');
    }
    return withExclusiveWindowsHelloOperation(async () => {
      const signal = getIpcRequestAbortSignal(event);
      requireActiveIpcRequest(signal);
      const result = await store().reauthenticateWithWindowsHello(input);
      requireActiveIpcRequest(signal);
      return result;
    });
  });
  registerIpcHandler('auth:beginTwoFactorSetup', () => store().beginTwoFactorSetup());
  registerIpcHandler('auth:enableTwoFactor', (_event, input: EnableTwoFactorInput) => store().enableTwoFactor(input));
  registerIpcHandler('auth:disableTwoFactor', (_event, input: DisableTwoFactorInput) => store().disableTwoFactor(input));
  registerIpcHandler('auth:trustCurrentDevice', (_event, input: TrustCurrentDeviceInput) => store().trustCurrentDevice(input));
  registerIpcHandler('auth:reauthorizeCurrentDeviceAfterRecovery', (_event, input: ReauthorizeCurrentDeviceInput) => store().reauthorizeCurrentDeviceAfterRecovery(input));
  registerIpcHandler('auth:listSecurityEventReceipts', (_event, limit?: number) => store().listSecurityEventReceipts(limit));
  registerIpcHandler('auth:verifySecurityEventReceipt', (_event, receiptJson: string) => store().verifySecurityEventReceiptJson(receiptJson));
  registerIpcHandler('auth:listTrustedDevices', () => store().listTrustedDevices());
  registerIpcHandler('auth:revokeTrustedDevice', (_event, id: string) => store().revokeTrustedDevice(id));
  registerIpcHandler('audit:list', (_event, limit?:number) => store().listAudit(limit));
  registerIpcHandler('audit:verifyIntegrity', () => store().verifyAuditIntegrity());
  registerIpcHandler('accounts:list', () => store().listAccounts());
  registerIpcHandler('accounts:update', (_event, input:UpdateFamilyAccountInput) => store().updateAccount(input));
  registerIpcHandler('invitations:create', (_event, input:CreateFamilyInvitationInput) => store().createInvitation(input));
  registerIpcHandler('invitations:list', () => store().listInvitations());
  registerIpcHandler('invitations:inspect', (_event, input:InspectFamilyInvitationInput) => store().inspectInvitation(input));
  registerIpcHandler('invitations:revoke', (_event, id:string) => store().revokeInvitation(id));
  registerIpcHandler('invitations:resend', (_event, input:ResendFamilyInvitationInput) => store().resendInvitation(input));
  registerIpcHandler('invitations:accept', (_event, input:AcceptFamilyInvitationInput) => store().acceptInvitation(input));
  registerIpcHandler('permissions:getContextWorkspace', () => store().getAuthorizationContextWorkspace());
  registerIpcHandler('permissions:list', () => store().listPermissions());
  registerIpcHandler('permissions:upsert', (_event, input:UpsertObjectPermissionInput) => store().upsertPermission(input));
  registerIpcHandler('permissions:delete', (_event, id:string) => store().deletePermission(id));
  registerIpcHandler('clientDataAccess:getBoundary', () => universalApiPolicyEnforcement().clientDataAccessBoundary());
  const offlineCapabilityWorkspace = (): OfflineCapabilityLeaseWorkspaceView => ({
    leases: store().listOfflineCapabilityLeases(),
    cache: offlineSensitiveCache.state(),
    maximumDurationMinutes: 1_440,
    minimumDurationMinutes: 1
  });
  registerIpcHandler('offlineCapability:getWorkspace', () => offlineCapabilityWorkspace());
  registerIpcHandler('offlineCapability:issue', (_event, input:IssueOfflineCapabilityLeaseInput) => {
    const lease = store().issueOfflineCapabilityLease(input);
    offlineSensitiveCache.activate(lease);
    return offlineCapabilityWorkspace();
  });
  registerIpcHandler('offlineCapability:revoke', (_event, leaseId:string) => {
    store().revokeOfflineCapabilityLease(leaseId);
    offlineSensitiveCache.revoke(leaseId);
    return offlineCapabilityWorkspace();
  });
  registerIpcHandler('data-repair:workspace', () => store().getDataRepairWorkspace());
  registerIpcHandler('data-repair:preview', (_event, input:{issueId:string;reason:string}) => store().previewDataRepair(input));
  registerIpcHandler('data-repair:apply', (_event, input:{operationId:string;expectedRevisionToken:string}) => store().applyDataRepair(input));
  registerIpcHandler('data-repair:undo', (_event, operationId:string) => store().undoDataRepair(operationId));
  registerIpcHandler('dataLifecycle:listPolicies', () => store().listDataRetentionPolicies());
  registerIpcHandler('dataLifecycle:createPolicy', (_event,input:CreateDataRetentionPolicyInput) => store().createDataRetentionPolicy(input));
  registerIpcHandler('dataLifecycle:listRecords', () => store().listDataLifecycleRecords());
  registerIpcHandler('dataLifecycle:archive', (_event,input:ArchiveDataResourceInput) => store().archiveDataResource(input));
  registerIpcHandler('dataLifecycle:restore', (_event,input:RestoreDataResourceInput) => store().restoreDataResource(input));
  registerIpcHandler('dataLifecycle:requestPurge', (_event,input:RequestDataPurgeInput) => store().requestDataPurge(input));
  registerIpcHandler('dataLifecycle:cancelPurge', (_event,input:CancelDataPurgeInput) => store().cancelDataPurge(input));
  registerIpcHandler('dataLifecycle:executePurge', (_event,input:ExecuteDataPurgeInput) => store().executeDataPurge(input));
  registerIpcHandler('dataLifecycle:setLegalHold', (_event,input:SetDataLegalHoldInput) => store().setDataLegalHold(input));
  registerIpcHandler('dataLifecycle:listBackupPropagationRuns', (_event,limit?:number) => store().listBackupPropagationRuns(limit));
  registerIpcHandler('dataLifecycle:propagatePurgedBackups', () => store().propagatePurgedDataToManagedBackups());
  registerIpcHandler('dataLifecycle:getBackupCleanRewriteStatus', () => cleanBackupRewrite().status());
  registerIpcHandler('dataLifecycle:listBackupCleanRewriteRuns', (_event,limit?:number) => cleanBackupRewrite().listRuns(limit));
  registerIpcHandler('dataLifecycle:updateBackupCleanRewritePolicy', (_event,input:UpdateBackupCleanRewritePolicyInput) => cleanBackupRewrite().updatePolicy(input));
  registerIpcHandler('dataLifecycle:runBackupCleanRewrite', () => cleanBackupRewrite().runManual());
  registerIpcHandler('dataLifecycle:getBackupQuarantinePolicy', () => store().getBackupQuarantinePolicy());
  registerIpcHandler('dataLifecycle:listBackupQuarantineBatches', (_event,limit?:number) => store().listBackupQuarantineBatches(limit));
  registerIpcHandler('dataLifecycle:updateBackupQuarantinePolicy', (_event,input:UpdateBackupQuarantinePolicyInput) => store().updateBackupQuarantinePolicy(input));
  registerIpcHandler('dataLifecycle:setBackupQuarantineLegalHold', (_event,input:SetBackupQuarantineLegalHoldInput) => store().setBackupQuarantineLegalHold(input));
  registerIpcHandler('dataLifecycle:destroyBackupQuarantineBatch', (_event,input:DestroyBackupQuarantineBatchInput) => store().destroyBackupQuarantineBatch(input));
  registerIpcHandler('dataLifecycle:listExternalBackupCopies', (_event,limit?:number) => store().listExternalBackupCopies(limit));
  registerIpcHandler('dataLifecycle:getExternalBackupInventorySummary', () => store().getExternalBackupInventorySummary());
  registerIpcHandler('dataLifecycle:registerExternalBackupCopy', (_event,input:RegisterExternalBackupCopyInput) => store().registerExternalBackupCopy(input));
  registerIpcHandler('dataLifecycle:reviewExternalBackupCopy', (_event,input:ReviewExternalBackupCopyInput) => store().reviewExternalBackupCopy(input));
  registerIpcHandler('dataLifecycle:setExternalBackupCopyLegalHold', (_event,input:SetExternalBackupCopyLegalHoldInput) => store().setExternalBackupCopyLegalHold(input));
  registerIpcHandler('dataLifecycle:attestExternalBackupCopyDestroyed', (_event,input:AttestExternalBackupCopyDestroyedInput) => store().attestExternalBackupCopyDestroyed(input));
  registerIpcHandler('dataLifecycle:listExternalBackupEvidenceIssuers', (_event,limit?:number) => store().listExternalBackupEvidenceIssuers(limit));
  registerIpcHandler('dataLifecycle:listExternalBackupEvidenceIssuerRotations', (_event,limit?:number) => store().listExternalBackupEvidenceIssuerRotations(limit));
  registerIpcHandler('dataLifecycle:listExternalBackupEvidenceRevocationLists', (_event,limit?:number) => store().listExternalBackupEvidenceRevocationLists(limit));
  registerIpcHandler('dataLifecycle:applyExternalBackupEvidenceRevocationList', (_event,input:ApplyExternalBackupEvidenceRevocationListInput) => {
    const result=store().applyExternalBackupEvidenceRevocationList(input);
    revocationSync().invalidateIssuer(input.signerIssuerId,'manual-or-external-list-applied');
    return result;
  });
  registerIpcHandler('dataLifecycle:listExternalBackupRevocationEndpoints', (_event,limit?:number) => store().listExternalBackupRevocationEndpoints(limit));
  registerIpcHandler('dataLifecycle:upsertExternalBackupRevocationEndpoint', (_event,input:UpsertExternalBackupRevocationEndpointInput) => {
    const result=store().upsertExternalBackupRevocationEndpoint(input);
    revocationSync().invalidateIssuer(input.issuerId,'endpoint-profile-updated');
    return result;
  });
  registerIpcHandler('dataLifecycle:listRevocationSyncStates', ():readonly RevocationSyncEndpointStateView[] => revocationSync().listStates());
  registerIpcHandler('dataLifecycle:runRevocationSync', async (event,endpointId?:string):Promise<RevocationSyncRunResultView> => revocationSync().runDue(endpointId,getIpcRequestAbortSignal(event)));
  registerIpcHandler('dataLifecycle:getPendingRevocationSyncList', (_event,endpointId:string):PendingRevocationSyncListView|null => revocationSync().getPendingSummary(endpointId)??null);
  registerIpcHandler('dataLifecycle:applyPendingRevocationSyncList', (_event,input:ApplyPendingRevocationSyncInput) => {
    const pending=revocationSync().getPendingForApply(input.endpointId,input.pendingListId);
    const result=store().applyExternalBackupEvidenceRevocationList({
      ...pending.list,
      confirmation:input.confirmation,
      password:input.password,
      ...(input.code?{code:input.code}:{})
    });
    revocationSync().markApplied(input.endpointId,input.pendingListId,pending.list.sequenceNumber);
    return result;
  });
  registerIpcHandler('dataLifecycle:listExternalBackupDestructionEvidence', (_event,copyId?:string,limit?:number) => store().listExternalBackupDestructionEvidence(copyId,limit));
  registerIpcHandler('dataLifecycle:registerExternalBackupEvidenceIssuer', (_event,input:RegisterExternalBackupEvidenceIssuerInput) => store().registerExternalBackupEvidenceIssuer(input));
  registerIpcHandler('dataLifecycle:rotateExternalBackupEvidenceIssuer', (_event,input:RotateExternalBackupEvidenceIssuerInput) => {
    const result=store().rotateExternalBackupEvidenceIssuer(input);
    revocationSync().invalidateAll('issuer-key-rotation');
    return result;
  });
  registerIpcHandler('dataLifecycle:revokeExternalBackupEvidenceIssuer', (_event,input:RevokeExternalBackupEvidenceIssuerInput) => {
    const result=store().revokeExternalBackupEvidenceIssuer(input);
    revocationSync().invalidateAll('issuer-revoked');
    return result;
  });
  registerIpcHandler('dataLifecycle:verifyExternalBackupDestructionEvidence', (_event,input:VerifyExternalBackupDestructionEvidenceInput) => store().verifyExternalBackupDestructionEvidence(input));

  registerIpcHandler('system:health', () => store().getSystemHealth());
  registerIpcHandler('system:getCoreServiceHealth', () => coreServiceConnection().adapter.getHealth());
  registerIpcHandler('system:getCoreServiceApiBoundary', () => coreServiceConnection().adapter.getApiBoundaryStatus());
  registerIpcHandler('system:getNetworkEgressBoundary', ():NetworkEgressBoundaryView => networkEgressPolicy.snapshot());
  registerIpcHandler('system:getDerivedDataPolicyBoundary', ():DerivedDataPolicyBoundaryView => getDerivedDataPolicyBoundaryUseCase.execute());
  registerIpcHandler('system:getSensitiveLoggingBoundary', ():SensitiveLoggingBoundaryView => getSensitiveLoggingBoundaryUseCase.execute());
  registerIpcHandler('system:getPolicyDecisionAuditBoundary', ():PolicyDecisionAuditBoundaryView => new GetPolicyDecisionAuditBoundaryUseCase(
    immutablePolicyDecisionAuditPolicy,
    new PlatformPolicyDecisionAuditInspectionAdapter(policyReceiptSink())
  ).execute());
  registerIpcHandler('system:getSourceDeletionPropagationBoundary', ():SourceDeletionPropagationBoundaryView => getSourceDeletionPropagationBoundaryUseCase.execute());
  registerIpcHandler('system:getPolicyConformanceSuiteBoundary', ():PolicyConformanceSuiteBoundaryView => getPolicyConformanceSuiteBoundaryUseCase.execute());
  registerIpcHandler('system:getPlatformPolicyAstGateBoundary', ():PlatformPolicyAstGateBoundaryView => getPlatformPolicyAstGateBoundaryUseCase.execute());
  registerIpcHandler('system:getPlatformCapabilityManifestGateBoundary', ():PlatformCapabilityManifestGateBoundaryView => getPlatformCapabilityManifestGateBoundaryUseCase.execute());
  registerIpcHandler('system:getApplicationSecurityProfileGateBoundary', ():ApplicationSecurityProfileGateBoundaryView => getApplicationSecurityProfileGateBoundaryUseCase.execute());
  registerIpcHandler('system:getPolicyServiceAvailabilityBoundary', ():Promise<PolicyServiceAvailabilityBoundaryView> => policyServiceAvailabilityBoundary().execute());
  registerIpcHandler('system:getProductSurfaceGovernance', ():ProductSurfaceGovernanceView => getProductSurfaceGovernanceUseCase.execute());
  registerIpcHandler('system:getDesktopSecurityPosture', () => store().getDesktopSecurityPosture());
  registerIpcHandler('system:listBackupTargets', () => store().listBackupTargets());
  registerIpcHandler('system:upsertBackupTarget', (_event,input:UpsertBackupTargetInput) => store().upsertBackupTarget(input));
  registerIpcHandler('system:listBackupRuns', (_event,limit?:number) => store().listBackupRuns(limit));
  registerIpcHandler('system:runBackupTarget', (_event,id:string) => store().runBackupTarget(id));
  registerIpcHandler('system:runAllBackups', () => store().runAllBackupTargets());
  registerIpcHandler('system:runDueBackups', (_event,at?:string) => store().runDueBackupTargets(at));
  registerIpcHandler('system:adaptiveState', () => store().getAdaptiveResourceState());
  registerIpcHandler('system:capturePerformance', () => store().capturePerformanceSample());
  registerIpcHandler('system:listPerformance', (_event,limit?:number) => store().listPerformanceSamples(limit));
  registerIpcHandler('system:getPerformanceTrend', (_event,hours?:number) => store().getPerformanceTrend(hours));
  registerIpcHandler('system:listBackgroundTasks', (_event,limit?:number) => store().listBackgroundTasks(limit));
  registerIpcHandler('system:schedulerStatus', () => ({active:Boolean(schedulerTimer),...(schedulerStartedAt?{startedAt:schedulerStartedAt}:{}),...(lastSchedulerCycleAt?{lastCycleAt:lastSchedulerCycleAt}:{}),cycleIntervalSeconds:runtime().config.jobs.schedulerIntervalMs/1_000,performanceIntervalSeconds:runtime().config.jobs.performanceIntervalMs/1_000,...(lastSchedulerResult?{lastResult:lastSchedulerResult}:{})}));
  registerIpcHandler('system:listDiagnostics', (_event,limit?:number) => store().listDiagnostics(limit));
  registerIpcHandler('system:searchDiagnostics', (_event,input:DiagnosticFilterInput) => store().searchDiagnostics(input));
  registerIpcHandler('system:getHealthScore', () => store().getSystemHealthScore());
  registerIpcHandler('system:listDiagnosticReports', (_event,limit?:number) => store().listDiagnosticReports(limit));
  registerIpcHandler('system:captureHealthScore', () => store().captureSystemHealthScore());
  registerIpcHandler('system:listHealthHistory', (_event,limit?:number) => store().listSystemHealthHistory(limit));
  registerIpcHandler('system:getHealthTrend', (_event,days?:number) => store().getSystemHealthTrend(days));
  registerIpcHandler('system:listDiagnosticArchives', (_event,limit?:number) => store().listDiagnosticArchives(limit));
  registerIpcHandler('system:archiveDiagnostics', async (_event,before?:string) => { const cutoff=before??new Date(Date.now()-30*86_400_000).toISOString(); const result=await dialog.showSaveDialog({title:'Tanılama olay arşivini kaydet',defaultPath:`Anadolu_Parsi_Tanilama_Arsivi_${new Date().toISOString().slice(0,10)}.pptdiag`,filters:[{name:'Korumalı Tanılama',extensions:['pptdiag']}]}); if(result.canceled||!result.filePath)return {canceled:true}; return {canceled:false,archive:store().archiveDiagnostics(cutoff,result.filePath)}; });
  registerIpcHandler('system:verifyDiagnosticArchive', (_event,id:string) => store().verifyDiagnosticArchive(id));
  registerIpcHandler('system:readDiagnosticReport', (_event,id:string) => store().readDiagnosticReport(id));
  registerIpcHandler('system:verifyDiagnosticReport', (_event,id:string) => store().verifyDiagnosticReport(id));
  registerIpcHandler('system:compareDiagnosticReports', (_event,leftId:string,rightId:string) => store().compareDiagnosticReports(leftId,rightId));
  registerIpcHandler('system:readDiagnosticArchive', (_event,id:string) => store().readDiagnosticArchive(id));
  registerIpcHandler('system:searchDiagnosticArchive', (_event,id:string,input:DiagnosticArchiveSearchInput) => store().searchDiagnosticArchive(id,input));
  registerIpcHandler('system:exportDiagnosticArchiveEntries', async (_event,id:string,input:DiagnosticArchiveSearchInput,format:'json'|'csv') => { const result=await dialog.showSaveDialog({title:'Arşiv olaylarını dışa aktar',defaultPath:`Anadolu_Parsi_Arsiv_Olaylari_${new Date().toISOString().slice(0,10)}.pptdiag`,filters:[{name:'Korumalı Tanılama',extensions:['pptdiag']}]}); if(result.canceled||!result.filePath)return {canceled:true}; return {canceled:false,export:store().exportDiagnosticArchiveEntries(id,input,format,result.filePath)}; });
  registerIpcHandler('system:listMaintenanceHistory', (_event,limit?:number) => store().listMaintenanceHistory(limit));

  registerIpcHandler('system:searchMaintenanceHistory', (_event,input:MaintenanceHistoryFilterInput) => store().searchMaintenanceHistory(input));
  registerIpcHandler('system:exportMaintenanceHistory', async (_event,input:MaintenanceHistoryFilterInput,format:'json'|'csv') => { const result=await dialog.showSaveDialog({title:'Bakım geçmişini dışa aktar',defaultPath:`Anadolu_Parsi_Bakim_Gecmisi_${new Date().toISOString().slice(0,10)}.pptdiag`,filters:[{name:'Korumalı Tanılama',extensions:['pptdiag']}]}); if(result.canceled||!result.filePath)return {canceled:true}; return {canceled:false,export:store().exportMaintenanceHistory(input,format,result.filePath)}; });
  registerIpcHandler('system:searchAllDiagnosticArchives', (_event,input:DiagnosticArchiveSearchInput) => store().searchAllDiagnosticArchives(input));
  registerIpcHandler('system:exportSystemPdf', async () => { const report=store().getDiagnosticReport(); const result=await dialog.showSaveDialog({title:'Sistem sağlık raporunu PDF olarak kaydet',defaultPath:`Anadolu_Parsi_Sistem_Raporu_${new Date().toISOString().slice(0,10)}.pptreport`,filters:[{name:'Korumalı Sistem Raporu',extensions:['pptreport']}]}); if(result.canceled||!result.filePath)return {canceled:true}; const win=new BrowserWindow({show:false,webPreferences:{sandbox:true}}); const esc=(v:unknown)=>String(v).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!)); const html=`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:32px;color:#1d2433}h1{font-size:24px}h2{font-size:16px;margin-top:24px}.score{font-size:42px;font-weight:700}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{border:1px solid #ddd;border-radius:10px;padding:14px}small{color:#667}</style></head><body><h1>Anadolu Parsı Aile Yaşam Merkezi — Sistem Sağlık Raporu</h1><p>${esc(report.generatedAt)}</p><div class="score">${report.healthScore.score}/100</div><p>${esc(report.healthScore.grade)} · ${esc(report.system.status)}</p><div class="grid"><div class="card"><h2>Donanım</h2><p>${esc(report.system.cpuModel)}</p><p>CPU çekirdeği: ${report.system.cpuCores}</p><p>Bellek: ${report.system.memoryUsagePercent.toFixed(1)}%</p></div><div class="card"><h2>Depolama</h2><p>Veritabanı: ${report.system.databaseBytes} bayt</p><p>Arşiv: ${report.system.archiveBytes} bayt</p><p>Bütünlük: ${report.system.integrityOk?'Başarılı':'Başarısız'}</p></div></div><h2>Kesintiler</h2><ul>${report.healthScore.deductions.map(d=>`<li>${esc(d.message)} (-${d.points})</li>`).join('')||'<li>Kesinti yok</li>'}</ul><h2>Son tanılama olayları</h2><ul>${report.diagnostics.slice(0,20).map(d=>`<li>${esc(d.occurredAt)} — ${esc(d.code)} — ${esc(d.message)}</li>`).join('')}</ul></body></html>`; await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`); const buffer=await win.webContents.printToPDF({printBackground:true,pageSize:'A4'}); const protectedReport=runtime().protectedArtifacts.writeBuffer(result.filePath,'system-health-report-pdf',buffer); buffer.fill(0); win.destroy(); store().recordExportArtifact('system_pdf','pdf',protectedReport.filePath,protectedReport.sha256,protectedReport.sizeBytes); return {canceled:false,...protectedReport}; });

  registerIpcHandler('system:getPerformanceAnomalies', (_event,hours?:number) => store().getPerformanceAnomalies(hours));
  registerIpcHandler('system:getIpcAdaptiveBudgetMaintenanceAuthority', () => adaptiveMaintenanceAuthSnapshot().authority);
  registerIpcHandler('system:getIpcAdaptiveBudgetMaintenanceRecoveryAuthority', () => adaptiveMaintenanceRecoverySnapshot().authority);
  registerIpcHandler('system:getIpcPerformanceTelemetry', () => {
    const telemetry = ipcPerformanceTelemetry.snapshot({
      activeRequests: ipcRequestLifecycles.activeCount(),
      queuedRequests: ipcRequestLifecycles.queuedCount(),
      cacheEntries: ipcReadResults.entryCount()
    });
    ipcAdaptiveResourceBudget.refresh(telemetry);
    return Object.freeze({ ...telemetry, adaptiveBudget: ipcAdaptiveResourceBudget.snapshot() });
  });
  registerIpcHandler('system:recoverIpcAdaptiveBudgetMaintenanceLock', async (event, input:IpcAdaptiveBudgetMaintenanceRecoveryInput) => {
    const parsed = parseIpcAdaptiveBudgetMaintenanceRecoveryInput(input);
    const recoveryContext = adaptiveMaintenanceRecoveryContext();
    const confirmation = await dialog.showMessageBox({
      type: 'warning',
      title: 'Bakım kilidini kurtar',
      message: 'Kalıcı bakım yeniden doğrulama sayaçları ve kilitleri temizlenecek. Bu işlem yalnız mevcut kilit durumunu kaldırır; kullanıcı verilerini veya adaptif kaynak bütçesini değiştirmez.',
      detail: 'İşlem geri alınamaz. Devam etmek için güçlü kimlik doğrulaması yeniden denetlenecek.',
      buttons: ['Vazgeç', 'Kimliği doğrula ve kilidi temizle'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    if (confirmation.response !== 1) return Object.freeze({ canceled: true });
    try {
      store().verifyStrongAuthentication({ password: parsed.password, ...(parsed.code ? { code: parsed.code } : {}) });
      ipcAdaptiveBudgetMaintenanceReauthenticationGuard.recordSuccess(recoveryContext.recoveryFingerprint);
    } catch (error) {
      const failureCode = countedMaintenanceReauthenticationFailureCode(error);
      if (failureCode) {
        const throttle = ipcAdaptiveBudgetMaintenanceReauthenticationGuard.recordFailure(recoveryContext.recoveryFingerprint);
        runtime().logger.warn({
          timestamp: runtime().clock.now(),
          service: 'desktop-main',
          process: 'electron-main',
          event: 'ipc.adaptive_budget.maintenance_lock_recovery_reauthentication_failed',
          correlationId: createRuntimeCorrelationId('ipc'),
          outcome: 'failure',
          metadata: {
            senderId: event.sender.id,
            failureCode,
            failedAttempts: throttle.failedAttempts,
            remainingAttempts: throttle.remainingAttempts,
            locked: throttle.locked,
            retryAfterSeconds: throttle.retryAfterSeconds ?? 0
          }
        });
        if (throttle.locked) {
          throw new Error(`[AUTH_RATE_LIMITED] Bakım kilidi kurtarma geçici olarak sınırlandı. ${throttle.retryAfterSeconds ?? 1} saniye sonra yeniden deneyin.`);
        }
      }
      throw error;
    }
    const clearedContextCount = ipcAdaptiveBudgetMaintenanceReauthenticationGuard.trackedContextCount();
    const securityEpochRotation = store().rotateAccountSecurityEpochAfterMaintenanceRecovery();
    ipcAdaptiveBudgetMaintenanceSessions.clearAll();
    ipcAdaptiveBudgetMaintenanceReauthenticationGuard.clearAll();
    ipcAdaptiveBudgetMaintenanceRecoveryCooldownGuard.recordFailure(recoveryContext.cooldownFingerprint);
    store().logout();
    const recoveryContextFingerprint = recoveryContext.recoveryFingerprint.slice(0, 16);
    runtime().logger.warn({
      timestamp: runtime().clock.now(),
      service: 'desktop-main',
      process: 'electron-main',
      event: 'ipc.adaptive_budget.maintenance_lock_recovered',
      correlationId: createRuntimeCorrelationId('ipc'),
      outcome: 'success',
      metadata: {
        senderId: event.sender.id,
        previousReason: recoveryContext.primaryAuthority.reason,
        clearedContextCount,
        recoveryContextFingerprint,
        twoFactorRequired: recoveryContext.authority.twoFactorRequired,
        explicitConfirmation: true,
        sessionTerminated: true,
        trustedDeviceReevaluationRequired: true,
        securityEpochAdvanced: true,
        previousSecurityEpoch: securityEpochRotation.previousSecurityEpoch,
        securityEpoch: securityEpochRotation.securityEpoch,
        trustedDevicesRevoked: true,
        revokedTrustedDeviceCount: securityEpochRotation.revokedTrustedDeviceCount,
        recoveryCooldownSeconds: 900
      }
    });
    return Object.freeze({
      canceled: false,
      recovered: true,
      recoveredAt: new Date().toISOString(),
      previousReason: recoveryContext.primaryAuthority.reason,
      clearedContextCount,
      recoveryContextFingerprint,
      sessionTerminated: true,
      trustedDeviceReevaluationRequired: true,
      securityEpochAdvanced: true,
      previousSecurityEpoch: securityEpochRotation.previousSecurityEpoch,
      securityEpoch: securityEpochRotation.securityEpoch,
      trustedDevicesRevoked: true,
      revokedTrustedDeviceCount: securityEpochRotation.revokedTrustedDeviceCount,
      recoveryCooldownUntil: ipcAdaptiveBudgetMaintenanceRecoveryCooldownGuard.status(recoveryContext.cooldownFingerprint).lockedUntil
    });
  });
  registerIpcHandler('system:beginIpcAdaptiveBudgetMaintenanceSession', async (event, operation:IpcAdaptiveBudgetMaintenanceOperation, rendererSessionId:string, reauthentication:IpcAdaptiveBudgetMaintenanceReauthenticationInput) => {
    const authContext = adaptiveMaintenanceAuthContext();
    try {
      store().verifyStrongAuthentication(reauthentication);
      ipcAdaptiveBudgetMaintenanceReauthenticationGuard.recordSuccess(authContext.fingerprint);
    } catch (error) {
      const failureCode = countedMaintenanceReauthenticationFailureCode(error);
      if (failureCode) {
        const throttle = ipcAdaptiveBudgetMaintenanceReauthenticationGuard.recordFailure(authContext.fingerprint);
        runtime().logger.warn({
          timestamp: runtime().clock.now(),
          service: 'desktop-main',
          process: 'electron-main',
          event: 'ipc.adaptive_budget.maintenance_reauthentication_failed',
          correlationId: createRuntimeCorrelationId('ipc'),
          outcome: 'failure',
          metadata: {
            operation,
            senderId: event.sender.id,
            failureCode,
            failedAttempts: throttle.failedAttempts,
            remainingAttempts: throttle.remainingAttempts,
            locked: throttle.locked,
            retryAfterSeconds: throttle.retryAfterSeconds ?? 0
          }
        });
        if (throttle.locked) {
          throw new Error(`[AUTH_RATE_LIMITED] Güçlü doğrulama geçici olarak kilitlendi. ${throttle.retryAfterSeconds ?? 1} saniye sonra yeniden deneyin.`);
        }
      }
      throw error;
    }
    runtime().logger.info({
      timestamp: runtime().clock.now(),
      service: 'desktop-main',
      process: 'electron-main',
      event: 'ipc.adaptive_budget.maintenance_reauthentication_succeeded',
      correlationId: createRuntimeCorrelationId('ipc'),
      outcome: 'success',
      metadata: { operation, senderId: event.sender.id, twoFactorRequired: authContext.authority.twoFactorRequired }
    });
    const authFingerprint = authContext.fingerprint;
    const title = operation === 'reset' ? 'Adaptif kaynak bütçesini sıfırla' : 'Adaptif IPC tanı paketi oluştur';
    const message = operation === 'reset'
      ? 'IPC performans telemetrisi ve kısa ömürlü okuma cache’i temizlenecek. Kaynak bütçesi güvenli başlangıç moduna dönecek.'
      : 'Gizlilik güvenli teknik tanı paketi oluşturulacak. Kullanıcı, oturum, IPC argümanı ve payload verileri pakete alınmayacak.';
    const confirmation = await dialog.showMessageBox({
      type: operation === 'reset' ? 'warning' : 'info',
      title,
      message,
      buttons: ['Vazgeç', operation === 'reset' ? 'Bakım oturumu aç ve sıfırla' : 'Bakım oturumu aç ve dışa aktar'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    if (confirmation.response !== 1) return Object.freeze({ canceled: true });
    const session = ipcAdaptiveBudgetMaintenanceSessions.begin({
      senderId: event.sender.id,
      rendererSessionId,
      authFingerprint,
      operation
    });
    runtime().logger.info({
      timestamp: runtime().clock.now(),
      service: 'desktop-main',
      process: 'electron-main',
      event: 'ipc.adaptive_budget.maintenance_session_opened',
      correlationId: createRuntimeCorrelationId('ipc'),
      outcome: 'success',
      metadata: { operation, expiresAt: session.expiresAt, senderId: event.sender.id, authorityReason: authContext.authority.reason, strongReauthentication: true }
    });
    return Object.freeze({ canceled: false, ...session });
  });
  registerIpcHandler('system:resetIpcAdaptiveBudget', (event, authorization:IpcAdaptiveBudgetMaintenanceAuthorizationInput) => {
    const maintenanceSessionFingerprint = consumeAdaptiveMaintenanceSession(event.sender.id, authorization, 'reset');
    const previousMode = ipcAdaptiveResourceBudget.snapshot().mode;
    ipcReadResults.clearAll();
    ipcPerformanceTelemetry.clear();
    const current = ipcAdaptiveResourceBudget.manualReset();
    const retention = ipcAdaptiveResourceBudgetStateStore.pruneQuarantine();
    runtime().logger.info({
      timestamp: runtime().clock.now(),
      service: 'desktop-main',
      process: 'electron-main',
      event: 'ipc.adaptive_budget.manual_reset',
      correlationId: createRuntimeCorrelationId('ipc'),
      outcome: 'success',
      metadata: { previousMode, mode: current.mode, generation: current.generation, quarantinePruned: retention.prunedCount, maintenanceSessionFingerprint: maintenanceSessionFingerprint.slice(0, 16) }
    });
    return Object.freeze({
      canceled: false,
      resetAt: new Date().toISOString(),
      previousMode,
      current,
      cacheCleared: true,
      telemetryCleared: true,
      quarantinePruned: retention.prunedCount,
      maintenanceSessionFingerprint
    });
  });
  registerIpcHandler('system:exportIpcAdaptiveBudgetDiagnostics', async (event, authorization:IpcAdaptiveBudgetMaintenanceAuthorizationInput) => {
    const maintenanceSessionFingerprint = consumeAdaptiveMaintenanceSession(event.sender.id, authorization, 'diagnostics-export');
    const result = await dialog.showSaveDialog({
      title: 'Adaptif IPC tanı paketini kaydet',
      defaultPath: `Anadolu_Parsi_IPC_Adaptif_Tani_${new Date().toISOString().slice(0, 10)}.pptdiag`,
      filters: [{ name: 'Korumalı Tanı Paketi', extensions: ['pptdiag'] }]
    });
    if (result.canceled || !result.filePath) return Object.freeze({ canceled: true, maintenanceSessionFingerprint });
    const temporaryDiagnosticPath = join(runtime().config.paths.temp, `ipc-adaptive-diagnostic-${process.pid}-${Date.now()}.json`);
    const exportedPlain = ipcAdaptiveResourceBudgetStateStore.exportDiagnosticBundle(temporaryDiagnosticPath, ipcAdaptiveResourceBudget.snapshot());
    const plainBytes = readFileSync(temporaryDiagnosticPath);
    const protectedExport = runtime().protectedArtifacts.writeBuffer(result.filePath, 'ipc-adaptive-diagnostic', plainBytes);
    plainBytes.fill(0);
    rmSync(temporaryDiagnosticPath, { force: true });
    const exported = { ...exportedPlain, ...protectedExport };
    runtime().logger.info({
      timestamp: runtime().clock.now(),
      service: 'desktop-main',
      process: 'electron-main',
      event: 'ipc.adaptive_budget.diagnostics_exported',
      correlationId: createRuntimeCorrelationId('ipc'),
      outcome: 'success',
      metadata: { sizeBytes: exported.sizeBytes, journalEntryCount: exported.journalEntryCount, quarantineFileCount: exported.quarantineFileCount, maintenanceSessionFingerprint: maintenanceSessionFingerprint.slice(0, 16) }
    });
    return Object.freeze({ canceled: false, ...exported, maintenanceSessionFingerprint });
  });
  registerIpcHandler('system:getMaintenanceRecommendations', () => store().getMaintenanceRecommendations());
  registerIpcHandler('system:maintenance', (_event,operation:MaintenanceResultView['operation']) => store().runMaintenance(operation));
  registerIpcHandler('system:enqueueTask', (_event,input:EnqueueTaskInput) => store().enqueueTask(input));
  registerIpcHandler('system:listQueuedTasks', (_event,limit?:number) => store().listQueuedTasks(limit));
  registerIpcHandler('system:processTaskQueue', () => store().processTaskQueue());
  registerIpcHandler('system:getMaintenancePolicy', () => store().getMaintenancePolicy());
  registerIpcHandler('system:upsertMaintenancePolicy', (_event,input:UpsertMaintenancePolicyInput) => store().upsertMaintenancePolicy(input));
  registerIpcHandler('system:runAutomaticMaintenance', () => store().runAutomaticMaintenance());
  registerIpcHandler('system:listHealthNotifications', (_event,limit?:number) => store().listHealthNotifications(limit));
  registerIpcHandler('system:evaluateHealthNotifications', () => store().evaluateHealthNotifications());
  registerIpcHandler('system:acknowledgeHealthNotification', (_event,id:string) => store().acknowledgeHealthNotification(id));
  registerIpcHandler('system:getDiagnosticReport', () => store().getDiagnosticReport());
  registerIpcHandler('system:listExportArtifacts', (_event,limit?:number) => store().listExportArtifacts(limit));
  registerIpcHandler('system:verifyExportArtifact', (_event,id:string) => store().verifyExportArtifact(id));
  registerIpcHandler('system:exportDiagnosticReport', async () => { const result=await dialog.showSaveDialog({title:'Tanılama raporunu kaydet',defaultPath:`Anadolu_Parsi_Tanilama_${new Date().toISOString().slice(0,10)}.pptdiag`,filters:[{name:'Korumalı Tanılama Raporu',extensions:['pptdiag']}]}); if(result.canceled||!result.filePath)return {canceled:true}; store().exportDiagnosticReport(result.filePath); return {canceled:false,filePath:result.filePath}; });
  registerIpcHandler('data:getSnapshot', () => store().getSnapshot());
  registerIpcHandler('data:getSnapshotSections', (_event, input:FamilySnapshotSectionsInput) => store().getSnapshotSections(input));
  registerIpcHandler('dashboard:getOverview', () => store().getDashboardOverview());
  registerIpcHandler('catalog:listPeople', (_event, input:PersonCatalogPageInput = {}) => store().listPersonCatalog(input));
  registerIpcHandler('catalog:listEvents', (_event, input:EventCatalogPageInput = {}) => store().listEventCatalog(input));
  registerIpcHandler('catalog:lookup', (_event, input:EntityCatalogLookupInput = {}) => store().lookupEntityCatalog(input));
  registerIpcHandler('life:list', async () => await store().listLifeRecords());
  registerIpcHandler('automation:list', async () => await store().listAutomationRules());
  registerIpcHandler('automation:create', async (_event,input:CreateAutomationRuleInput) => await store().createAutomationRule(input));
  registerIpcHandler('automation:toggle', async (_event,id:string,enabled:boolean) => await store().toggleAutomationRule(id,enabled));
  registerIpcHandler('automation:runs', async () => await store().listAutomationRuns());
  registerIpcHandler('automation:run', async (_event,input:RunAutomationInput) => await store().runAutomationRules(input));
  registerIpcHandler('legacy:listPlans', () => store().listDigitalLegacyPlans());
  registerIpcHandler('legacy:upsertPlan', (_event,input:UpsertDigitalLegacyPlanInput) => store().upsertDigitalLegacyPlan(input));
  registerIpcHandler('legacy:listGrants', (_event,planId?:string) => store().listLegacyGrants(planId));
  registerIpcHandler('legacy:upsertGrant', (_event,input:UpsertLegacyGrantInput) => store().upsertLegacyGrant(input));
  registerIpcHandler('legacy:execute', (_event,input:ExecuteLegacyPlanInput) => store().executeDigitalLegacyPlan(input));
  registerIpcHandler('legacy:listApprovals', (_event,planId:string) => store().listLegacyApprovals(planId));
  registerIpcHandler('legacy:approve', (_event,input:ApproveLegacyExecutionInput) => store().approveLegacyExecution(input));
  registerIpcHandler('legacy:finalize', (_event,planId:string) => store().finalizeLegacyExecution(planId));
  registerIpcHandler('legacy:cancel', (_event,input:CancelLegacyExecutionInput) => store().cancelLegacyExecution(input));
  registerIpcHandler('reports:summary', async () => await store().getReportSummary());
  registerIpcHandler('genealogy:insights', () => store().getGenealogyInsights());
  registerIpcHandler('largeData:tree', (_event,input:GenealogyTreePageInput={}) => store().listLargeGenealogyTree(input));
  registerIpcHandler('largeData:timeline', (_event,input:TimelinePageInput={}) => store().listLargeTimeline(input));
  registerIpcHandler('largeData:archive', (_event,input:ArchivePageInput={}) => store().listLargeArchive(input));
  registerIpcHandler('archive:listCategories', () => store().listArchiveCategories());
  registerIpcHandler('archive:createCategory', (_event,input:ArchiveMutationInput<CreateArchiveCategoryInput>) => {
    const { operationId, ...semanticInput } = input;
    store().requireArchivePendingOperationIdentity({ operationId, mutation: 'archive:createCategory', semanticInput });
    return store().createArchiveCategory(input);
  });
  registerIpcHandler('archive:listClassifications', () => store().getArchiveClassifications());
  registerIpcHandler('archive:updateClassification', (_event,input:ArchiveMutationInput<UpdateArchiveClassificationInput>) => {
    const { operationId, ...semanticInput } = input;
    store().requireArchivePendingOperationIdentity({ operationId, mutation: 'archive:updateClassification', semanticInput });
    return store().updateArchiveClassification(input);
  });
  registerIpcHandler('ai:listConsents', () => store().listAiConsents());
  registerIpcHandler('ai:upsertConsent', (_event,input:UpsertAiConsentInput) => store().upsertAiConsent(input));
  registerIpcHandler('ai:previewAccess', (_event,purpose:AiConsentPurpose) => store().previewAiAccess(purpose));
  registerIpcHandler('ai:listSensitiveProfiles', () => store().listSensitiveDataProfiles());
  registerIpcHandler('ai:upsertSensitiveConsent', (_event,input:UpsertSensitiveDataConsentInput) => store().upsertSensitiveDataConsent(input));
  registerIpcHandler('ai:previewSensitiveExport', (_event,input:SensitiveExportPreviewInput) => store().previewSensitiveExport(input));
  registerIpcHandler('life:create', async (_event, input:CreateLifeRecordInput) => await store().createLifeRecord(input));
  registerIpcHandler('finance:list', () => store().listFinanceRecords());
  registerIpcHandler('finance:create', (_event, input:CreateFinanceRecordInput) => store().createFinanceRecord(input));
  registerIpcHandler('finance:listBankInstitutions', () => store().listBankInstitutions());
  registerIpcHandler('finance:listBankAccounts', () => store().listBankAccounts());
  registerIpcHandler('finance:validateIban', (_event, input:ValidateIbanInput) => store().validateIban(input));
  registerIpcHandler('finance:createBankAccount', (_event, input:CreateBankAccountInput) => store().createBankAccount(input));
  registerIpcHandler('finance:listPaymentCards', () => store().listPaymentCards());
  registerIpcHandler('finance:createPaymentCard', (_event, input:CreatePaymentCardInput) => store().createPaymentCard(input));
  registerIpcHandler('health:list', async () => store().listHealthRecords());
  registerIpcHandler('health:create', async (_event, input:CreateHealthRecordInput) => store().createHealthRecord(input));
  registerIpcHandler('health:listMedicationPlans', async () => store().listMedicationPlans());
  registerIpcHandler('health:createMedicationPlan', async (_event, input:CreateMedicationPlanInput) => store().createMedicationPlan(input));
  registerIpcHandler('health:listFamilyHistory', async () => store().listFamilyHealthHistory());
  registerIpcHandler('health:createFamilyHistory', async (_event, input:CreateFamilyHealthHistoryInput) => store().createFamilyHealthHistory(input));
  registerIpcHandler('finance:listValuations', () => store().listFinanceValuations());
  registerIpcHandler('finance:createValuation', (_event, input:CreateFinanceValuationInput) => store().createFinanceValuation(input));
  registerIpcHandler('family:createRelation', async (_event, input: CreateFamilyRelationInput) => {
    const mutation = store().createRelation(input);
    await store().dispatchPendingEvents();
    return mutation;
  });
  registerIpcHandler('households:getWorkspace', () => store().getHouseholdMembershipWorkspace());
  registerIpcHandler('households:create', async (_event, input: CreateHouseholdInput) => {
    const household = store().createHousehold(input);
    await store().dispatchPendingEvents();
    return household;
  });
  registerIpcHandler('households:createBranch', async (_event, input: CreateFamilyBranchInput) => {
    const branch = store().createFamilyBranch(input);
    await store().dispatchPendingEvents();
    return branch;
  });
  registerIpcHandler('households:assignPerson', async (_event, input: AssignPersonMembershipInput) => {
    const membership = store().assignPersonMembership(input);
    await store().dispatchPendingEvents();
    return membership;
  });
  registerIpcHandler('households:endMembership', async (_event, input: { membershipId: string; endedAt: string }) => {
    const membership = store().endPersonMembership(input.membershipId, input.endedAt);
    await store().dispatchPendingEvents();
    return membership;
  });
  registerIpcHandler('people:getLifecycleWorkspace', (_event, personId: string) => store().getPersonLifecycleWorkspace(personId));
  registerIpcHandler('people:updateProfile', async (_event, input: UpdatePersonProfileInput) => {
    const profile = store().updatePersonProfile(input);
    await store().dispatchPendingEvents();
    return profile;
  });
  registerIpcHandler('people:archiveProfile', async (_event, input: { personId: string; expectedVersion: number; reason: string }) => {
    const profile = store().archivePersonProfile(input);
    await store().dispatchPendingEvents();
    return profile;
  });
  registerIpcHandler('people:mergeProfiles', async (_event, input: { sourcePersonId: string; targetPersonId: string; expectedSourceVersion: number; expectedTargetVersion: number; conflictResolution: 'KEEP_TARGET'; reason: string }) => {
    const profile = store().mergePersonProfiles(input);
    await store().dispatchPendingEvents();
    return profile;
  });
  registerIpcHandler('people:requestSafeDeletion', async (_event, input: { personId: string; expectedVersion: number; confirmationText: string; reason: string }) => {
    const profile = store().requestSafePersonDeletion(input);
    await store().dispatchPendingEvents();
    return profile;
  });
  registerIpcHandler('people:undoLifecycleOperation', async (_event, operationId: string) => {
    const profile = store().undoPersonLifecycleOperation(operationId);
    await store().dispatchPendingEvents();
    return profile;
  });
  registerIpcHandler('familyData:previewImport', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Aile verisi JSON dosyasını ön izle',
      properties: ['openFile'],
      filters: [{ name: 'Anadolu Parsı Aile Verisi', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    return { canceled: false, preview: store().previewFamilyDataImport(result.filePaths[0]) };
  });
  registerIpcHandler('familyData:applyImport', (_event, input: ApplyFamilyDataImportInput) => store().applyFamilyDataImport(input));
  registerIpcHandler('familyData:listImports', (_event, limit?: number) => store().listFamilyDataImports(limit));
  registerIpcHandler('familyData:rollbackImport', (_event, input: RollbackFamilyDataImportInput) => store().rollbackFamilyDataImport(input));
  registerIpcHandler('family:createMember', async (_event, input: CreateFamilyMemberInput) => {
    const mutation = store().createMember(input);
    await store().dispatchPendingEvents();
    return mutation;
  });
  registerIpcHandler('timeline:createImportantDay', async (_event, input: CreateFamilyEventInput) => {
    const mutation = await store().createEvent(input);
    await store().dispatchPendingEvents();
    return mutation;
  });
  registerIpcHandler('timeline:updateParticipants', async (_event, input: UpdateEventParticipantsInput) => {
    const mutation = await store().updateImportantDayParticipants(input);
    await store().dispatchPendingEvents();
    return mutation;
  });
  registerIpcHandler('timeline:updateInvitation', async (_event, input: UpdateEventInvitationInput) => {
    const mutation = await store().updateImportantDayInvitation(input);
    await store().dispatchPendingEvents();
    return mutation;
  });
  registerIpcHandler('timeline:updateNotes', async (_event, input: UpdateEventNotesInput) => {
    const mutation = await store().updateImportantDayNotes(input);
    await store().dispatchPendingEvents();
    return mutation;
  });
  registerIpcHandler('timeline:updateEvent', async (_event, input: UpdateFamilyEventInput) => {
    const mutation = await store().updateFamilyEvent(input);
    await store().dispatchPendingEvents();
    return mutation;
  });
  registerIpcHandler('timeline:setArchived', async (_event, input: SetFamilyEventArchivedInput) => {
    const mutation = await store().setFamilyEventArchived(input);
    await store().dispatchPendingEvents();
    return mutation;
  });
  registerIpcHandler('timeline:listArchived', () => store().listArchivedTimelineEvents());
  registerIpcHandler('notifications:acknowledge', async (_event, input: AcknowledgeFamilyNotificationInput) => {
    const mutation = await store().acknowledgeTimelineNotification(input);
    await store().dispatchPendingEvents();
    return mutation;
  });
  registerIpcHandler('location:create', async (_event, input: CreateFamilyLocationInput) => {
    const mutation = await store().createLocation(input);
    await store().dispatchPendingEvents();
    return mutation;
  });
  registerIpcHandler(
    'archive:operationIdentity:acquire',
    (_event, input: ArchivePendingOperationIntentInput) => store().acquireArchivePendingOperationIdentity(input)
  );
  registerIpcHandler(
    'archive:operationIdentity:acknowledge',
    (_event, input: ArchivePendingOperationIntentInput & { readonly operationId: string }) =>
      store().acknowledgeArchivePendingOperationIdentity(input)
  );
  registerIpcHandler('archive:list', () => store().listArchive());
  registerIpcHandler('archive:search', (_event,input:ArchiveSearchInput) => store().searchArchive(input));
  registerIpcHandler('archive:listVersions', (_event,itemId:string) => store().listArchiveVersions(itemId));
  registerIpcHandler('archive:listRetentionPolicies', () => store().listArchiveRetentionPolicies());
  registerIpcHandler('archive:createRetentionPolicy', (_event,input:ArchiveMutationInput<CreateArchiveRetentionPolicyInput>) => {
    const { operationId, ...semanticInput } = input;
    store().requireArchivePendingOperationIdentity({ operationId, mutation: 'archive:createRetentionPolicy', semanticInput });
    return store().createArchiveRetentionPolicy(input);
  });
  registerIpcHandler('archive:assignRetentionPolicy', (_event,input:ArchiveMutationInput<AssignArchiveRetentionPolicyInput>) => {
    const { operationId, ...semanticInput } = input;
    store().requireArchivePendingOperationIdentity({ operationId, mutation: 'archive:assignRetentionPolicy', semanticInput });
    return store().assignArchiveRetentionPolicy(input);
  });
  registerIpcHandler('archive:listRetentionStatus', () => store().listArchiveRetentionStatus());
  registerIpcHandler('archive:secureDestroy', (_event,input:ArchiveItemMutationInput) => {
    store().requireArchivePendingOperationIdentity({
      operationId: input.operationId,
      mutation: 'archive:secureDestroy',
      semanticInput: { itemId: input.itemId }
    });
    return store().securelyDestroyArchiveItem(input.itemId, input.operationId);
  });
  registerIpcHandler('archive:open', async (_event, input:ArchiveItemMutationInput) => {
    store().requireArchivePendingOperationIdentity({
      operationId: input.operationId,
      mutation: 'archive:open',
      semanticInput: { itemId: input.itemId }
    });
    return openArchiveInSecurePreview(input.itemId, input.operationId);
  });
  registerIpcHandler('archive:import', async (_event, input: ArchiveMutationInput<CreateArchiveItemInput>) => {
    const { operationId, ...semanticInput } = input;
    store().requireArchivePendingOperationIdentity({ operationId, mutation: 'archive:import', semanticInput });
    const result = await dialog.showOpenDialog({ title: 'Arşive eklenecek dosyayı seç', properties: ['openFile'] });
    if (result.canceled || !result.filePaths[0]) return store().listArchive();
    return store().importArchiveFile(result.filePaths[0], input);
  });
  registerIpcHandler('backup:exportFull', async (_event, input: { readonly password: string }) => {
    const result=await dialog.showSaveDialog({title:'Parola korumalı tam yedeği kaydet',defaultPath:`Anadolu_Parsi_Aile_${new Date().toISOString().slice(0,10)}.pptbackup`,filters:[{name:'Anadolu Parsı Tam Yedek',extensions:['pptbackup']}]});
    if(result.canceled||!result.filePath) return {canceled:true};
    store().exportFullBackup(result.filePath,input.password);
    return {canceled:false,filePath:result.filePath};
  });
  registerIpcHandler('backup:inspectFull', async (_event, input: { readonly password?: string }) => {
    const result=await dialog.showOpenDialog({title:'Tam yedeği güvenli biçimde incele',properties:['openFile'],filters:[{name:'Anadolu Parsı Tam Yedek',extensions:['pptbackup']}]});
    if(result.canceled||!result.filePaths[0]) return {canceled:true};
    return {canceled:false,filePath:result.filePaths[0],inspection:store().inspectFullBackup(result.filePaths[0],input.password)};
  });
  registerIpcHandler('backup:restoreFull', async (_event, input: { readonly password?: string }) => {
    const result=await dialog.showOpenDialog({title:'Tam yedekten geri yükle',properties:['openFile'],filters:[{name:'Anadolu Parsı Tam Yedek',extensions:['pptbackup']}]});
    if(result.canceled||!result.filePaths[0]) return {canceled:true};
    const safetyDir=join(app.getPath('userData'),'safety-backups');
    const safetyPath=join(safetyDir,`Geri_Yukleme_Oncesi_${new Date().toISOString().replace(/[:.]/g,'-')}.pptbackup`);
    const current=store();
    let restoreCompleted=false;
    try {
      current.restoreFullBackup(result.filePaths[0],safetyPath,input.password);
      restoreCompleted=true;
    } catch (error) {
      if (!(error instanceof FullBackupRestoreRestartRequiredError)) throw error;
    }
    if (restoreCompleted) {
      const restoredDatabasePath=userDataSqliteSession?.restoreDatabasePath();
      if (!restoredDatabasePath || !existsSync(restoredDatabasePath)) throw new Error('Geri yüklenen veritabanı korumalı staging alanında bulunamadı.');
      vault().sealExternalDatabaseFile(restoredDatabasePath);
    } else {
      vault().discardSession();
    }
    dataStore=undefined;
    userDataSqliteSession?.close();
    userDataSqliteSession=undefined;
    automaticCleanBackupRewriteService=undefined;
    app.relaunch(); setImmediate(()=>app.exit(0));
    return {canceled:false,safetyBackupPath:safetyPath,restarting:true};
  });
  registerIpcHandler('backup:export', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Cihaz korumalı tam yedeği kaydet',
      defaultPath: `Anadolu_Parsi_Aile_Yedek_${new Date().toISOString().slice(0, 10)}.pptbackup`,
      filters: [{ name: 'Anadolu Parsı Korumalı Yedek', extensions: ['pptbackup'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    store().exportBackup(result.filePath);
    return { canceled: false, filePath: result.filePath };
  });
}


function startBackgroundSchedulers(): void {
  if (schedulerTimer || performanceTimer || !runtime().config.jobs.enabled) return;
  schedulerStartedAt = new Date().toISOString();
  const runJob = async (eventName: string, operation: () => void | Promise<void>): Promise<void> => {
    const correlationId = createRuntimeCorrelationId('job');
    const startedAt = Date.now();
    await runtime().correlation.run({ correlationId }, async () => {
      try {
        await universalApiPolicyEnforcement().execute({
          channel: 'system:runBackgroundSchedulerJob',
          correlationId,
          operation
        });
        runtime().logger.info({
          timestamp: runtime().clock.now(),
          service: 'desktop-main',
          process: 'background-scheduler',
          event: `${eventName}.completed`,
          correlationId,
          durationMs: Date.now() - startedAt,
          outcome: 'success'
        });
      } catch (error) {
        runtime().logger.error({
          timestamp: runtime().clock.now(),
          service: 'desktop-main',
          process: 'background-scheduler',
          event: `${eventName}.failed`,
          correlationId,
          durationMs: Date.now() - startedAt,
          outcome: 'failure',
          metadata: { errorName: error instanceof Error ? error.name : typeof error }
        });
        throw error;
      }
    });
  };
  const cycle = (): void => {
    const current=dataStore;
    if(!current) return;
    lastSchedulerCycleAt=new Date().toISOString();
    void runJob('scheduler.protected_cycle', async () => {
      await current.dispatchPendingEvents().catch((error: unknown) => {
        current.recordDiagnostic(
          'error',
          'event_dispatch.batch_failed',
          'Transactional outbox olayları işlenemedi.',
          error instanceof Error ? error.message : String(error)
        );
      });
      if(!current.isAuthenticated()) return;
      try { lastSchedulerResult=current.runDueBackupTargets(lastSchedulerCycleAt); }
      catch(error){ current.recordDiagnostic('error','scheduler.cycle_failed','Arka plan zamanlayıcısı çalışamadı.',error instanceof Error?error.message:String(error)); }
      await revocationSync().runDue().catch((error:unknown)=>current.recordDiagnostic('error','revocation.sync_cycle_failed','Periyodik güvenli iptal listesi senkronizasyonu çalışamadı.',error instanceof Error?error.message:String(error)));
      try { cleanBackupRewrite().recoverInterrupted(); cleanBackupRewrite().runAutomaticCycle(); }
      catch(error){current.recordDiagnostic('error','backup.clean_rewrite_cycle_failed','Otomatik temiz yedek yeniden yazım çevrimi çalışamadı.',error instanceof Error?error.message:String(error));}
    }).catch(() => undefined);
  };
  const sample = (): void => {
    const current=dataStore;
    if(!current) return;
    void runJob('scheduler.performance_sample', () => {
      try { current.capturePerformanceSample(); }
      catch(error){current.recordDiagnostic('warning','performance.sample_failed','Otomatik performans örneği alınamadı.',error instanceof Error?error.message:String(error));}
    }).catch(() => undefined);
  };
  schedulerTimer=setInterval(cycle,runtime().config.jobs.schedulerIntervalMs);
  performanceTimer=setInterval(sample,runtime().config.jobs.performanceIntervalMs);
  cycle();
  sample();
}
function stopBackgroundSchedulers(): void { if(schedulerTimer)clearInterval(schedulerTimer); if(performanceTimer)clearInterval(performanceTimer); schedulerTimer=undefined; performanceTimer=undefined; }

async function openArchiveInSecurePreview(itemId: string, operationId: string): Promise<{ opened: true }> {
  const temporaryPath = await store().openArchiveItem(itemId, operationId);
  let bytes: Buffer;
  try { bytes = readFileSync(temporaryPath); }
  finally { rmSync(temporaryPath, { force: true }); }
  if (bytes.byteLength > 32 * 1024 * 1024) throw new Error('Belge güvenli önizleme sınırını aşıyor.');
  const extension = extname(temporaryPath).toLocaleLowerCase('en-US');
  const mime = extension === '.pdf' ? 'application/pdf'
    : extension === '.png' ? 'image/png'
    : extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg'
    : extension === '.gif' ? 'image/gif'
    : extension === '.webp' ? 'image/webp'
    : extension === '.txt' || extension === '.md' || extension === '.csv' ? 'text/plain'
    : 'application/octet-stream';
  if (mime === 'application/octet-stream') throw new Error('Bu dosya türü uygulama içi güvenli önizlemede desteklenmiyor.');
  const dataUrl = `data:${mime};base64,${bytes.toString('base64')}`;
  bytes.fill(0);
  const preview = new BrowserWindow({
    width: 1080,
    height: 780,
    title: 'Anadolu Parsı - Güvenli Belge Önizleme',
    autoHideMenuBar: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true }
  });
  preview.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  preview.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('data:')) event.preventDefault();
  });
  if (mime.startsWith('image/')) {
    const html = `<!doctype html><meta charset="utf-8"><title>Güvenli önizleme</title><style>html,body{height:100%;margin:0;background:#111827}body{display:grid;place-items:center}img{max-width:100%;max-height:100%;object-fit:contain}</style><img alt="Güvenli belge önizlemesi" src="${dataUrl}">`;
    await preview.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  } else if (mime === 'text/plain') {
    const text = Buffer.from(dataUrl.split(',')[1] ?? '', 'base64').toString('utf8');
    const escaped = text.replace(/[&<>]/gu, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c] ?? c));
    await preview.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><meta charset="utf-8"><style>body{font-family:system-ui;padding:28px;white-space:pre-wrap;background:#fff;color:#172033}</style><body>${escaped}</body>`)}`);
  } else {
    await preview.loadURL(dataUrl);
  }
  return { opened: true };
}

function createWindow(): void {
  const configuredRendererUrl = process.env.PPT_RENDERER_URL;
  const rendererDocumentUrl = configuredRendererUrl
    ? normalizeTrustedRendererDocumentUrl(configuredRendererUrl, { allowLocalDevelopmentServer: !app.isPackaged })
    : normalizeTrustedRendererDocumentUrl(PRIMARY_RENDERER_DOCUMENT_URL, { allowLocalDevelopmentServer: false });
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#06111e',
    show: false,
    autoHideMenuBar: true,
    webPreferences: createSecureRendererPreferences(
      join(currentDir, 'preload.cjs'),
      !app.isPackaged
    )
  });

  const primaryWebContentsId = window.webContents.id;
  primaryWindow = window;
  trustedRenderer = {
    webContentsId: primaryWebContentsId,
    documentUrl: rendererDocumentUrl
  };

  installRendererSessionSecurity({
    webContents: window.webContents as unknown as RendererSecurityWebContentsLike,
    trustedDocumentUrl: rendererDocumentUrl,
    onViolation: ({ reason, permission }) => runtime().logger.warn({
      timestamp: runtime().clock.now(),
      service: 'desktop-main',
      process: 'electron-main',
      event: 'renderer.session.violation',
      correlationId: createRuntimeCorrelationId('ipc'),
      outcome: 'failure',
      metadata: {
        reason,
        permission
      }
    })
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalHttpsUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });


  window.once('closed', () => {
    ipcTransportSessions.clearSender(primaryWebContentsId);
    ipcRequestLifecycles.clearSender(primaryWebContentsId);
    ipcReadResults.invalidateSender(primaryWebContentsId);
    ipcAdaptiveBudgetMaintenanceSessions.clearSender(primaryWebContentsId);
    if (primaryWindow === window) primaryWindow = undefined;
    if (trustedRenderer?.webContentsId === primaryWebContentsId) trustedRenderer = undefined;
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.once('did-finish-load', () => {
    const probePath = process.env.PPT_WINDOWS_LAUNCH_PROBE_PATH;
    if (probePath) {
      writeFileSync(probePath, `${JSON.stringify({
        status: 'PASS',
        applicationVersion: APP_META.version,
        rendererDocumentUrl,
        webContentsId: window.webContents.id,
        startupSecurity: startupSecurityReport,
        rendererPolicy: startupSecurityReport?.rendererPolicy,
        windowsSecurityEvidence: windowsSecurityEvidenceReport,
        windowsOpen021EfsEvidence: windowsOpen021EfsEvidenceReport,
        windowsOpen022SideArtifactEvidence: windowsOpen022SideArtifactEvidenceReport,
        recordedAt: new Date().toISOString()
      }, null, 2)}\n`);
    }
  });
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
    const probePath = process.env.PPT_WINDOWS_LAUNCH_PROBE_PATH;
    if (probePath && isMainFrame) {
      writeFileSync(probePath, `${JSON.stringify({
        status: 'FAIL',
        applicationVersion: APP_META.version,
        errorCode,
        errorDescription,
        validatedUrl,
        recordedAt: new Date().toISOString()
      }, null, 2)}\n`);
    }
  });
  void window.loadURL(rendererDocumentUrl);
}

app.on('second-instance', () => {
  const window = BrowserWindow.getAllWindows()[0];
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
});

app.whenReady().then(async () => {
  const rendererRoot = resolve(currentDir, '../renderer');
  const fetchRendererAsset = net.fetch.bind(net);
  protocol.handle(PRIMARY_RENDERER_SCHEME, (request) => {
    if (request.method !== 'GET') return new Response('Not found', { status: 404 });
    const candidate = resolvePrimaryRendererAssetPath(request.url, rendererRoot);
    if (!candidate) return new Response('Not found', { status: 404 });
    return fetchRendererAsset(pathToFileURL(candidate).toString());
  });
  startupStage = 'SAFE_STORAGE_INITIALIZATION';
  osSecretProtector = process.platform === 'win32'
    ? new WindowsDpapiDeviceSecretProtector({ required: true })
    : new ElectronSafeStorageDeviceSecretProtector(safeStorage, app.isPackaged);
  const protectedArtifacts = new ProtectedSideArtifactStore({
    keyPath: join(app.getPath('userData'), 'secrets', 'side-artifact-key.json'),
    applicationVersion: APP_META.version,
    protector: osSecretProtector
  });
  startupStage = 'RUNTIME_BOOTSTRAP';
  desktopRuntime = bootstrapDesktopRuntime({
    version: APP_META.version,
    isPackaged: app.isPackaged,
    userDataPath: app.getPath('userData'),
    volatileRootPath: volatileRuntimeRoot,
    protectedArtifacts,
    ...(process.env.PPT_RUNTIME_ENV ? { environment: process.env.PPT_RUNTIME_ENV } : {})
  });
  startupStage = 'CORE_SERVICE_CONNECTION';
  coreServiceStartupConnection = await connectCoreServiceAtStartup({
    authorityPath: join(runtime().config.paths.secrets, 'core-service-connection.pptsecret'),
    authorityReader: runtime().protectedArtifacts,
    clock: () => runtime().clock.now()
  });
  const policyServiceObservation = new PolicyServiceAvailabilityApplicationAdapter({
    adapter: coreServiceStartupConnection.adapter,
    startupHealth: coreServiceStartupConnection.health,
    clock: () => runtime().clock.now()
  });
  coreServiceStartupConnection.adapter.bindPolicyServiceAvailabilityObserver(
    () => policyServiceObservation.observe()
  );
  evaluatePolicyServiceAvailabilityUseCase = new EvaluatePolicyServiceAvailabilityUseCase(
    policyServiceAvailabilityPolicy,
    policyServiceObservation
  );
  getPolicyServiceAvailabilityBoundaryUseCase = new GetPolicyServiceAvailabilityBoundaryUseCase(
    policyServiceAvailabilityPolicy,
    policyServiceObservation
  );
  runtime().logger.info({
    timestamp: runtime().clock.now(),
    service: 'desktop-main',
    process: 'electron-main',
    event: 'core_service.startup_connection.ready',
    correlationId: createRuntimeCorrelationId('startup'),
    outcome: 'success',
    metadata: {
      lifecycle: coreServiceStartupConnection.health.lifecycle,
      role: coreServiceStartupConnection.health.role,
      writable: coreServiceStartupConnection.health.writable,
      safeMode: coreServiceStartupConnection.health.safeMode,
      policyVersion: coreServiceStartupConnection.health.policyVersion
    }
  });
  startupStage = 'POLICY_RECEIPT_JOURNAL_VERIFICATION';
  const policyJournalDatabasePath = join(runtime().config.paths.data, runtime().config.database.fileName);
  archivePolicyReceiptSink = new PlatformPolicyReceiptFileSink({
    filePath: join(dirname(policyJournalDatabasePath), 'platform-policy-receipts.pptjournal'),
    macKeyPath: join(runtime().config.paths.secrets, 'platform-policy-receipt-journal-mac-key.pptsecret'),
    macKeyProtector: secretProtector(),
    protectedArtifactStore: runtime().protectedArtifacts,
    monotonicAuthority: coreServiceStartupConnection.adapter
  });
  const archivePolicyReceiptJournal = await archivePolicyReceiptSink.inspectWithTrustedProvider(
    coreServiceStartupConnection.adapter.policyProvider
  );
  runtime().logger.info({
    timestamp: runtime().clock.now(),
    service: 'desktop-main',
    process: 'electron-main',
    event: 'archive.policy_receipt_journal.trusted_restart_verification_ready',
    correlationId: createRuntimeCorrelationId('startup'),
    outcome: 'success',
    metadata: {
      exists: archivePolicyReceiptJournal.exists,
      valid: archivePolicyReceiptJournal.valid,
      trustedReceiptCount: archivePolicyReceiptJournal.entryCount,
      sizeBytes: archivePolicyReceiptJournal.sizeBytes,
      headHash: archivePolicyReceiptJournal.headHash,
      protection: archivePolicyReceiptJournal.protection
    }
  });
  startupStage = 'RENDERER_SECURITY_POLICY';
  const rendererPolicy = assertSecureRendererPreferences(
    createSecureRendererPreferences(join(currentDir, 'preload.cjs'), !app.isPackaged)
  );
  startupStage = 'STARTUP_SECURITY_PREFLIGHT';
  startupSecurityReport = runStartupSecurityPreflight({
    applicationVersion: APP_META.version,
    packageVersion: APP_META.packageVersion,
    platform: process.platform,
    isPackaged: app.isPackaged,
    electronVersion: process.versions.electron ?? 'unknown',
    commandLineArguments: process.argv.slice(1),
    allowUnsafeDiagnostic:
      process.env.PPT_WINDOWS_LAUNCH_TEST === '1' &&
      process.env.PPT_ALLOW_UNSAFE_ELECTRON_DIAGNOSTIC === '1',
    protector: osSecretProtector,
    sentinelPath: join(runtime().config.paths.secrets, 'startup-security-sentinel.json'),
    evidencePath: join(runtime().config.paths.logs, 'startup-security-preflight.pptdiag'),
    rendererPolicy,
    writeEvidence: (path, report) => {
      runtime().protectedArtifacts.writeText(path, 'startup-security-preflight', `${JSON.stringify(report, null, 2)}\n`);
    }
  });
  startupStage = 'DEVICE_IDENTITY_INITIALIZATION';
  initializeMaintenanceReauthenticationDeviceBinding();
  if (process.env.PPT_WINDOWS_SECURITY_PROBE === '1') {
    startupStage = 'WINDOWS_SECURITY_PROBE';
    windowsSecurityEvidenceReport = runWindowsSecurityEvidenceProbe({
      applicationVersion: APP_META.version,
      userDataPath: app.getPath('userData'),
      volatileRuntimeRoot,
      protector: osSecretProtector,
      protectedArtifacts: runtime().protectedArtifacts,
      selectedStorageBackend: safeStorage.getSelectedStorageBackend?.() ?? 'unknown'
    });
  }
  if (process.env.PPT_WINDOWS_OPEN021_EFS_PROBE === '1') {
    startupStage = 'OPEN021_EFS_PROBE';
    windowsOpen021EfsEvidenceReport = runWindowsOpen021EfsEvidenceProbe({
      applicationVersion: APP_META.version,
      volatileRuntimeRoot
    });
  }
  if (process.env.PPT_WINDOWS_OPEN022_SIDE_ARTIFACT_PROBE === '1') {
    startupStage = 'OPEN022_SIDE_ARTIFACT_PROBE';
    windowsOpen022SideArtifactEvidenceReport = runWindowsOpen022SideArtifactEvidenceProbe({
      applicationVersion: APP_META.version,
      userDataPath: app.getPath('userData'),
      volatileRuntimeRoot,
      sessionDataPath: app.getPath('sessionData'),
      crashDumpsPath: app.getPath('crashDumps'),
      selectedStorageBackend: safeStorage.getSelectedStorageBackend?.() ?? 'unknown',
      protector: osSecretProtector,
      protectedArtifacts: runtime().protectedArtifacts,
      startupEvidencePath: join(runtime().config.paths.logs, 'startup-security-preflight.pptdiag')
    });
  }
  startupStage = 'VAULT_INITIALIZATION';
  vault();
  const maintenanceReauthenticationRestore = ipcAdaptiveBudgetMaintenanceReauthenticationGuard.restore(Date.now());
  const startupCorrelationId = createRuntimeCorrelationId('startup');
  runtime().correlation.run({ correlationId: startupCorrelationId }, () => {
    runtime().logger[maintenanceReauthenticationRestore.status === 'REJECTED' ? 'warn' : 'info']({
      timestamp: runtime().clock.now(),
      service: 'desktop-main',
      process: 'electron-main',
      event: 'ipc.adaptive_budget.maintenance_reauthentication_state_restored',
      correlationId: startupCorrelationId,
      outcome: maintenanceReauthenticationRestore.status === 'REJECTED' ? 'failure' : 'success',
      metadata: {
        status: maintenanceReauthenticationRestore.status,
        reason: maintenanceReauthenticationRestore.reason,
        restoredContextCount: maintenanceReauthenticationRestore.restoredContextCount,
        recoveryHold: maintenanceReauthenticationRestore.recoveryHold,
        recoveryHoldUntil: maintenanceReauthenticationRestore.recoveryHoldUntil,
        quarantined: maintenanceReauthenticationRestore.quarantinePath !== undefined,
        classification: maintenanceReauthenticationRestore.classification,
        stateRewriteCompleted: maintenanceReauthenticationRestore.stateRewriteCompleted ?? false,
        protectionTemporarilyUnavailable: maintenanceReauthenticationRestore.status === 'UNAVAILABLE',
        protectionProvider: startupSecurityReport?.protectionProvider
      }
    });
    startupStage = 'IPC_REGISTRATION';
    registerIpc();
    startupStage = 'WINDOW_CREATION';
    createWindow();
    startupStage = 'READY';
    runtime().logger.info({
      timestamp: runtime().clock.now(),
      service: 'desktop-main',
      process: 'electron-main',
      event: 'application.ready',
      correlationId: startupCorrelationId,
      outcome: 'success',
      metadata: {
        startupSecurityStatus: startupSecurityReport?.status,
        protectionProvider: startupSecurityReport?.protectionProvider,
        sentinelState: startupSecurityReport?.sentinelState
      }
    });
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error: unknown) => {
  exitAfterFatalStartupError(error, 'app.whenReady');
});

app.on('before-quit', () => {
  if (desktopRuntime) {
    desktopRuntime.logger.info({
      timestamp: desktopRuntime.clock.now(),
      service: 'desktop-main',
      process: 'electron-main',
      event: 'application.before_quit',
      correlationId: createRuntimeCorrelationId('startup'),
      outcome: 'success'
    });
  }
  for (const window of BrowserWindow.getAllWindows()) {
    ipcRequestLifecycles.clearSender(window.webContents.id);
    ipcReadResults.invalidateSender(window.webContents.id);
    ipcAdaptiveBudgetMaintenanceSessions.clearSender(window.webContents.id);
  }
  ipcPerformanceTelemetry.clear();
  ipcAdaptiveBudgetMaintenanceSessions.clearAll();
  ipcAdaptiveBudgetMaintenanceReauthenticationGuard.clearMemory();
  ipcAdaptiveResourceBudget.clear({ persist: false });
  try {
    sealUserDataSession();
  } finally {
    userDataVault = undefined;
    try { archivePolicyReceiptSink?.dispose(); }
    finally {
      archivePolicyReceiptSink = undefined;
      desktopUniversalApiPolicyEnforcement = undefined;
      evaluatePolicyServiceAvailabilityUseCase = undefined;
      getPolicyServiceAvailabilityBoundaryUseCase = undefined;
    }
    try { desktopRuntime?.protectedArtifacts.dispose(); }
    finally { rmSync(volatileRuntimeRoot, { recursive: true, force: true }); }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
