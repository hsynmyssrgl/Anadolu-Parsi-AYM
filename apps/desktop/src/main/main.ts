import { app, BrowserWindow, dialog, ipcMain, Menu, powerMonitor, protocol, safeStorage, shell, Tray, utilityProcess, type IpcMainInvokeEvent } from 'electron';
import { fileURLToPath } from 'node:url';
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { closeSync, constants, existsSync, fstatSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { asCorrelationId, asIsoDateTime, createAppError, err, ERROR_CODES, ok, type AppError, type Result } from '@ppt/core';
import { createWebAuthnChallenge, encryptPortableEmergencyPack, sha256Hex, validateOidcProviderConfiguration, verifyPortableEmergencyPackReadback, type OidcProviderConfiguration, type WebAuthnAssertionInput, type WebAuthnRegistrationInput } from '@ppt/security';
import { writeContentFreeConsoleEvent } from '@ppt/logging';
import { APP_META, USER_VISIBLE_APP_INFO, resolveUiLocalization, selectOperatingSystemUiLanguage, type UiLocalizationBootstrapView, type CreateArchiveItemInput, CreateFamilyEventInput, UpdateFamilyEventInput, SetFamilyEventArchivedInput, UpdateEventParticipantsInput, UpdateEventInvitationInput, UpdateEventNotesInput, AcknowledgeFamilyNotificationInput, CreateFamilyLocationInput, CreateFamilyMemberInput, CreateFamilyRelationInput, LoginInput, SetupAdminInput, ChangePasswordInput, EnableTwoFactorInput, DisableTwoFactorInput, TrustCurrentDeviceInput, ReauthorizeCurrentDeviceInput, CreateFamilyInvitationInput, InspectFamilyInvitationInput, ResendFamilyInvitationInput, AcceptFamilyInvitationInput, UpsertObjectPermissionInput, UpdateFamilyAccountInput, CreateFinanceRecordInput, CreateBankAccountInput, ValidateIbanInput, CreatePaymentCardInput, CreateHealthRecordInput, CreateMedicationPlanInput, CreateFamilyHealthHistoryInput, CreateFinanceValuationInput, CreateLifeRecordInput, CreateAutomationRuleInput, CreateArchiveCategoryInput, UpdateArchiveClassificationInput, UpsertAiConsentInput, AiConsentPurpose, UpsertSensitiveDataConsentInput, SensitiveExportPreviewInput, RunAutomationInput, UpsertDigitalLegacyPlanInput, UpsertLegacyGrantInput, ExecuteLegacyPlanInput, ApproveLegacyExecutionInput, CancelLegacyExecutionInput, ArchiveSearchInput, CreateArchiveRetentionPolicyInput, AssignArchiveRetentionPolicyInput, UpsertBackupTargetInput, MaintenanceResultView, BackupSchedulerResultView, AdaptiveResourceStateView, EnqueueTaskInput, UpsertMaintenancePolicyInput, DiagnosticFilterInput, DiagnosticArchiveSearchInput, MaintenanceHistoryFilterInput, CreateDataRetentionPolicyInput, ArchiveDataResourceInput, RestoreDataResourceInput, RequestDataPurgeInput, CancelDataPurgeInput, ExecuteDataPurgeInput, SetDataLegalHoldInput, UpdateBackupQuarantinePolicyInput, SetBackupQuarantineLegalHoldInput, DestroyBackupQuarantineBatchInput, RegisterExternalBackupCopyInput, ReviewExternalBackupCopyInput, SetExternalBackupCopyLegalHoldInput, AttestExternalBackupCopyDestroyedInput, RegisterExternalBackupEvidenceIssuerInput, RotateExternalBackupEvidenceIssuerInput, RevokeExternalBackupEvidenceIssuerInput, ApplyExternalBackupEvidenceRevocationListInput, UpsertExternalBackupRevocationEndpointInput, PendingRevocationSyncListView, ApplyPendingRevocationSyncInput, RevocationSyncEndpointStateView, RevocationSyncRunResultView, VerifyExternalBackupDestructionEvidenceInput, ApplyFamilyDataImportInput, RollbackFamilyDataImportInput, GenealogyTreePageInput, TimelinePageInput, ArchivePageInput, PersonCatalogPageInput, EventCatalogPageInput, EntityCatalogLookupInput, FamilySnapshotSectionsInput, IpcAdaptiveBudgetMaintenanceOperation, IpcAdaptiveBudgetMaintenanceAuthorizationInput, IpcAdaptiveBudgetMaintenanceReauthenticationInput, IpcAdaptiveBudgetMaintenanceRecoveryInput, UpdateBackupCleanRewritePolicyInput } from '@ppt/domain';
import type { AddArchiveItemVersionInput, AddArchiveRelationEvidenceInput, RemoveArchiveRelationEvidenceInput } from '@ppt/domain';
import { STABLE_USER_DATA_DIRECTORY_NAME } from '@ppt/domain';
import type { UiLanguagePreference } from '@ppt/domain';
import type { RecordHealthCareEntryInput, RevokeHealthCareAccessGrantInput, UpsertHealthCareAccessGrantInput } from '@ppt/domain';
import type { CreateHouseholdOperationItemInput, DeleteHouseholdOperationItemInput, UpdateHouseholdOperationItemInput } from '@ppt/domain';
import type { CreateChildEducationItemInput, DeleteChildEducationItemInput, UpdateChildEducationItemInput } from '@ppt/domain';
import type { CreatePlacesTravelItemInput, DeletePlacesTravelItemInput, UpdatePlacesTravelItemInput } from '@ppt/domain';
import type { GenerateFamilyAiSuggestionInput, RunFamilyAiLocalModelInput, ReviewFamilyAiSuggestionInput } from '@ppt/domain';
import type { CreateMemoryStudioRecordInput, DeleteMemoryStudioRecordInput, CreateMemoryTimeCapsuleInput, ReviewMemoryTimeCapsuleInput, TransitionMemoryTimeCapsuleInput } from '@ppt/domain';
import type { GrantSmartHomeCameraConsentInput, RevokeSmartHomeCameraConsentInput, SetSmartHomeProcessingInput } from '@ppt/domain';
import type { EmergencyDisableSignedPluginInput, RollbackSignedPluginInput, SetSignedPluginDesiredStateInput } from '@ppt/domain';
import type {
  AddCommunicationRoomMemberInput,
  CreateCommunicationRoomInput,
  FreezeCommunicationRoomInput,
  RekeyCommunicationRoomAfterDeviceRevocationInput,
  RemoveCommunicationRoomMemberInput,
  RevokeCommunicationDeviceCredentialInput,
  SetCommunicationHistoryAccessInput
} from '@ppt/domain';
import type {
  AnnotateCommunicationMessageInput,
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
  CreateCommunicationCallInput,
  RunCommunicationCallPreflightInput,
  SetCommunicationCallPreferencesInput,
  UpdateCommunicationCallControlsInput
} from '@ppt/domain';
import type {
  AddCommunicationRecordingLateJoinerInput,
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
import type { ReattestLegacyArchiveOwnershipInput } from '@ppt/domain';
import type { UnifiedAuthorizedSearchInput } from '@ppt/domain';
import type { RecordManagedLifeItemInput } from '@ppt/domain';
import type {
  CancelLocalGovernedOcrJobInput,
  CorrectLocalGovernedOcrResultInput,
  CreateLocalGovernedOcrJobInput,
  DeleteLocalGovernedOcrJobInput,
  LocalGovernedOcrCenterView,
  LocalGovernedOcrMutationReceiptView,
  LocalGovernedOcrResultView,
  LocalGovernedOcrSearchView,
  RerunLocalGovernedOcrJobInput,
  RunLocalGovernedOcrJobInput,
  SearchLocalGovernedOcrInput,
  SetLocalGovernedOcrEnabledInput
} from '@ppt/domain';
import type { CreateLoanAccountInput, RecordLoanPaymentInput, RecordFinancePlanningItemInput, CommitFinanceImportPreviewInput, RecordLongTermPortfolioItemInput, UpdateAccessibilityPreferencesInput } from '@ppt/domain';
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
import type { IssueOfflineCapabilityLeaseInput, OfflineCapabilityLeaseWorkspaceView, LostDeviceShutdownInput, UpsertLiveLocationConsentInput } from '@ppt/domain';
import {
  FamilyDataStore,
  FullBackupRestoreRestartRequiredError,
  type ArchivePendingOperationIntentInput,
  type IdentityAccessDataStorePorts
} from './data-store.js';
import { bootstrapDesktopRuntime, type DesktopRuntime } from './runtime-bootstrap.js';
import { registerCorrelatedIpcHandler, registerIpcCancellationHandlers, createRuntimeCorrelationId, type IpcHandler } from './ipc-runtime.js';
import {
  CHILD_EDUCATION_COORDINATION_IPC_CHANNELS,
  FAMILY_AI_ASSISTANT_IPC_CHANNELS,
  MEMORY_STUDIO_IPC_CHANNELS,
  SMART_HOME_ENERGY_IPC_CHANNELS,
  SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS,
  COMMUNICATION_SECURITY_IPC_CHANNELS,
  COMMUNICATION_MESSAGING_IPC_CHANNELS,
  COMMUNICATION_FILE_SHARING_IPC_CHANNELS,
  COMMUNICATION_AUDIT_ARCHIVE_IPC_CHANNELS,
  COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS,
  COMMUNICATION_RECORDING_IPC_CHANNELS,
  LOCAL_TRANSLATION_IPC_CHANNELS,
  FAMILY_MEETING_IPC_CHANNELS,
  PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS,
  HEALTH_CARE_COORDINATION_IPC_CHANNELS,
  HOUSEHOLD_OPERATIONS_IPC_CHANNELS,
  LOCAL_GOVERNED_OCR_IPC_CHANNELS,
  projectLocalGovernedOcrCenterIpcView,
  projectLocalGovernedOcrMutationIpcView,
  projectLocalGovernedOcrResultIpcView,
  projectLocalGovernedOcrSearchIpcView,
  projectFamilyMeetingCenterIpcView,
  projectFamilyMeetingMinutesIpcView,
  projectFamilyMeetingMutationIpcView,
  type LocalGovernedOcrCorrectIpcInput,
  type LocalGovernedOcrCreateIpcInput,
  type LocalGovernedOcrDeleteIpcInput,
  type LocalGovernedOcrJobMutationIpcInput,
  type LocalGovernedOcrRerunIpcInput,
  type LocalGovernedOcrResultReadIpcInput,
  type LocalGovernedOcrSearchIpcInput,
  type LocalGovernedOcrSetEnabledIpcInput,
  type CommunicationFileSharingApplyIpcInput,
  type CommunicationFileSharingPreviewIpcInput,
  type CommunicationFileSharingSelectIpcInput
} from './ipc-integration-policy.js';
import { IpcTransportSessionRegistry } from './ipc-transport-context.js';
import { countedStrongAuthenticationFailureCode, getIpcRequestAbortSignal, getIpcRequestContext, IpcRequestLifecycleRegistry } from './ipc-request-lifecycle.js';
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
import {
  ElectronCommunicationCallPreflightPort,
  type CommunicationCallPreflightWindowLike
} from './communication-call-preflight-adapter.js';
import { PRIMARY_RENDERER_DOCUMENT_URL, PRIMARY_RENDERER_ORIGIN, PRIMARY_RENDERER_SCHEME, resolvePrimaryRendererAssetPath } from './renderer-protocol.js';
import { respondToOfflineFamilyMapRequest } from './offline-family-map-protocol.js';
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
import { resolveVaultSessionGuardAction } from './vault-session-guard-policy.js';
import { PowerShellWindowsHelloPlatformAdapter } from './windows-hello-platform-adapter.js';
import {
  WindowsHelloPlatformCoordinator,
  type WindowsHelloVaultGrantBinding
} from './windows-hello-platform-coordinator.js';
import { VolatileSqliteSession } from './volatile-sqlite-session.js';
import { ProtectedSideArtifactStore } from './protected-side-artifact-store.js';
import { ProtectedOperationalArtifactFilePort } from './operational-artifact-file-application-adapter.js';
import { OllamaFamilyAiModelAdapter, resolveLocalFamilyAiEnabled } from './local-family-ai-model-adapter.js';
import { WindowsDefenderCommunicationFileMalwareScanner } from './communication-file-payload-vault.js';
import { WindowsDefenderLocalOcrMalwareAdapter } from './windows-defender-local-ocr-malware-adapter.js';
import { runWindowsSecurityEvidenceProbe, type WindowsSecurityEvidenceProbeReport } from './windows-security-evidence-probe.js';
import { runWindowsOpen021EfsEvidenceProbe, type WindowsOpen021EfsEvidenceProbeReport } from './windows-open021-efs-evidence-probe.js';
import { runWindowsOpen022SideArtifactEvidenceProbe, type WindowsOpen022SideArtifactEvidenceProbeReport } from './windows-open022-side-artifact-evidence-probe.js';
import { connectCoreServiceAtStartup, type CoreServiceStartupConnectionResult } from './core-service-startup-connection.js';
import { CoreServiceCompanionManager } from './core-service-companion-manager.js';
import { PlatformPolicyReceiptFileSink } from './platform-policy-receipt-file-sink.js';
import { PlatformPolicyDecisionAuditInspectionAdapter } from './policy-decision-audit-application-adapter.js';
import {
  DesktopUniversalApiPolicyEnforcement,
  VAULT_SESSION_CHECKPOINT_CHANNEL
} from './desktop-universal-api-policy-enforcement.js';
import { DesktopRepositoryPolicyScope } from './desktop-repository-policy-scope.js';
import { PolicyServiceAvailabilityApplicationAdapter } from './policy-service-availability-application-adapter.js';
import { ProductLicenseManager } from './product-license-manager.js';
import { createVerifiedUninstallBackups, discoverUninstallBackupTargets } from './uninstall-backup-assistant.js';
import { FACTORY_RESET_CONFIRMATION, FactoryResetManager } from './factory-reset-manager.js';
import { readFirstRunExperience, readUiLanguagePreference, writeFirstRunExperience, writeUiLanguagePreference } from './ui-language-preference-store.js';
import { ApplicationSecurityProfilePolicy, DerivedDataInheritancePolicy, ImmutablePolicyDecisionAuditPolicy, NetworkEgressPolicy, PlatformCapabilityManifestPolicy, PlatformPolicyAstGatePolicy, PlatformPolicyConformanceSuite, PolicyServiceAvailabilityPolicy, SensitiveLogPolicy, SourceDeletionPropagationPolicy, assertPinnedBootstrapRuntimeCapability } from '@ppt/platform-policy';
import type { ApplicationSecurityProfileGateBoundaryView, DerivedDataPolicyBoundaryView, NetworkEgressBoundaryView, PlatformCapabilityManifestGateBoundaryView, PlatformPolicyAstGateBoundaryView, PolicyConformanceSuiteBoundaryView, PolicyDecisionAuditBoundaryView, PolicyServiceAvailabilityBoundaryView, SensitiveLoggingBoundaryView, SourceDeletionPropagationBoundaryView } from '@ppt/domain';
import { GetProductSurfaceGovernanceUseCase } from '@ppt/application';
import type { ProductSurfaceGovernanceView } from '@ppt/domain';
import type { SaveFormDraftInput, UndoFormDraftInput } from '@ppt/domain';
import type {
  CorrectAiMemoryInput,
  RestrictAiMemoryInput,
  DeleteAiMemoryInput,
  ExpireAiMemoryInput,
  CreateDataRightsRequestInput,
  UpdateDataRightsRequestInput,
  CreatePrivacyIncidentInput,
  UpdatePrivacyIncidentInput,
  SimulatePermissionVisibilityInput
} from '@ppt/domain';
import { createProductSurfaceGovernanceRepository } from './repository-composition-root.js';
import { FinanceImportFileSessionRegistry } from './finance-import-file-session.js';
import { WebAuthnCeremonyAdapter } from './webauthn-ceremony-adapter.js';
import { ProtectedTemporaryCredentialEnvelopeAdapter } from './temporary-credential-envelope-adapter.js';
import { X25519EncryptedCompanionSnapshotAdapter } from './companion-sync-envelope-adapter.js';
import {
  OidcFederatedIdentityAdapter,
  StaticTrustedOidcProviderConfigurationResolver
} from './oidc-federated-identity-adapter.js';
import { SecureOidcNetworkAdapter, type TrustedOidcNetworkRegistration } from './secure-oidc-network-adapter.js';
import { FileSystemOidcVaultPersistence, OidcTokenVault } from './oidc-token-vault.js';
import { MainOnlyOidcDeepLinkCallbackRegistry } from './oidc-deep-link-callback-registry.js';
import type {
  AuthenticateWithPasskeyInput,
  CompletePasskeyRegistrationInput,
  CreateReadOnlyCompanionSnapshotInput,
  FederatedIdentityProvider,
  IdentityAccessOperationKind,
  IssueTemporaryVerifiableCredentialInput,
  RecoverLostPasskeyInput,
  RevokePasskeyInput,
  RevokeTemporaryVerifiableCredentialInput,
  UnlinkFederatedIdentityInput,
  VerifyTemporaryVerifiableCredentialInput
} from '@ppt/domain';

type ArchiveMutationInput<TInput> = TInput & { readonly operationId: string };
interface ArchiveItemMutationInput {
  readonly itemId: string;
  readonly operationId: string;
}

interface EncryptedPrivacyDataExportRendererInput {
  readonly requestId: string;
  readonly passphrase: string;
}

interface CompletePasskeyRegistrationRendererInput extends Omit<CompletePasskeyRegistrationInput,'ceremonyResponseId'> {
  readonly response:WebAuthnRegistrationInput;
  readonly confirmation:'PASSKEY KAYDINI TAMAMLA';
}
interface AuthenticateWithPasskeyRendererInput extends Omit<AuthenticateWithPasskeyInput,'ceremonyResponseId'> {
  readonly credentialId:string;
  readonly response:WebAuthnAssertionInput;
  readonly confirmation:'PASSKEY ILE DOGRULA';
}
interface CompleteFederatedIdentityLinkRendererInput {
  readonly expectedRevision:number;
  readonly clientOperationId:string;
  readonly provider:FederatedIdentityProvider;
  readonly flowId:string;
  readonly confirmation:'FEDERATED KIMLIGI BAGLA';
}

const IDENTITY_WEBAUTHN_RP_ID='renderer';
const identityFailure=(message:string):AppError=>createAppError({code:ERROR_CODES.AUTHORIZATION_DENIED,category:'security',message,correlationId:asCorrelationId('identity-production-composition')});

class MainOnlyPasskeyRecoveryRegistry {
  readonly #proofs=new Map<string,{accountId:string;expiresAt:number}>();
  public issue(accountId:string):string{const id=randomUUID();this.#prune();this.#proofs.set(id,{accountId,expiresAt:Date.now()+300_000});return id;}
  public verify(input:{accountId:string;recoveryProofId:string}):Result<true,AppError>{const proof=this.#proofs.get(input.recoveryProofId);if(proof)this.#proofs.delete(input.recoveryProofId);this.#prune();return proof&&proof.accountId===input.accountId&&proof.expiresAt>Date.now()?ok(true):err(identityFailure('Passkey kurtarma proofu gecersiz veya kullanilmis.'));}
  #prune():void{const now=Date.now();for(const [id,proof] of this.#proofs)if(proof.expiresAt<=now)this.#proofs.delete(id);}
}

const configuredOidcNetworkRegistrations=():readonly TrustedOidcNetworkRegistration[]=>{
  const registrations:TrustedOidcNetworkRegistration[]=[];
  for(const provider of ['apple','google','microsoft'] as const){
    const prefix=`PPT_OIDC_${provider.toUpperCase()}`;
    const values=[process.env[`${prefix}_CONFIGURATION_ID`],process.env[`${prefix}_ISSUER`],process.env[`${prefix}_AUTHORIZATION_ENDPOINT`],process.env[`${prefix}_TOKEN_ENDPOINT`],process.env[`${prefix}_JWKS_URI`],process.env[`${prefix}_CLIENT_ID`],process.env[`${prefix}_REDIRECT_URI`],process.env[`${prefix}_SCOPES`],process.env[`${prefix}_CLIENT_AUTHENTICATION_MODE`],process.env[`${prefix}_TOKEN_SPKI_PRIMARY_SHA256`],process.env[`${prefix}_TOKEN_SPKI_SECONDARY_SHA256`],process.env[`${prefix}_JWKS_SPKI_PRIMARY_SHA256`],process.env[`${prefix}_JWKS_SPKI_SECONDARY_SHA256`]];
    if(values.some((value)=>!value))continue;
    const [configurationId,issuer,authorizationEndpoint,tokenEndpoint,jwksUri,clientId,redirectUri,scopesText,clientAuthenticationMode,tokenPrimaryPin,tokenSecondaryPin,jwksPrimaryPin,jwksSecondaryPin]=values as [string,string,string,string,string,string,string,string,string,string,string,string,string];
    if(provider==='apple'||clientAuthenticationMode!=='public_pkce'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/u.test(configurationId))continue;
    if(!['pardus-app://oidc','pardus-app://oidc/','pardus-app://oidc/callback'].includes(redirectUri))continue;
    if(![tokenPrimaryPin,tokenSecondaryPin,jwksPrimaryPin,jwksSecondaryPin].every((pin)=>/^[0-9a-f]{64}$/u.test(pin))
      ||tokenPrimaryPin===tokenSecondaryPin||jwksPrimaryPin===jwksSecondaryPin)continue;
    const configuration:OidcProviderConfiguration=Object.freeze({providerId:provider,issuer,authorizationEndpoint,tokenEndpoint,jwksUri,clientId,redirectUri,scopes:Object.freeze(scopesText.split(' ').filter(Boolean))});
    try{validateOidcProviderConfiguration(configuration);}catch{continue;}
    registrations.push(Object.freeze({configurationId,configuration,clientAuthenticationMode,
      tokenEndpointPins:Object.freeze([{sha256:tokenPrimaryPin,kind:'primary' as const},{sha256:tokenSecondaryPin,kind:'secondary' as const}]),
      jwksEndpointPins:Object.freeze([{sha256:jwksPrimaryPin,kind:'primary' as const},{sha256:jwksSecondaryPin,kind:'secondary' as const}])}));
  }
  return Object.freeze(registrations);
};


class PrivacyExportCancelledError extends Error {
  public readonly code = 'PRIVACY_EXPORT_CANCELLED' as const;
  public constructor() {
    super('[PRIVACY_EXPORT_CANCELLED] Şifreli gizlilik dışa aktarımı kullanıcı tarafından iptal edildi.');
    this.name = 'PrivacyExportCancelledError';
  }
}

const COMMUNICATION_FILE_SELECTION_MAX_BYTES=64*1024*1024;
const normalizeSelectedFilePath=(value:string):string=>process.platform==='win32'
  ?resolve(value).toLocaleLowerCase('en-US'):resolve(value);
const communicationFileMimeType=(bytes:Uint8Array,fileName:string):string=>{
  const extension=extname(fileName).toLowerCase();
  if(bytes.byteLength>=8&&Buffer.from(bytes.subarray(0,8)).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return'image/png';
  if(bytes.byteLength>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return'image/jpeg';
  if(bytes.byteLength>=6&&['GIF87a','GIF89a'].includes(Buffer.from(bytes.subarray(0,6)).toString('ascii')))return'image/gif';
  if(bytes.byteLength>=12&&Buffer.from(bytes.subarray(0,4)).toString('ascii')==='RIFF'
    &&Buffer.from(bytes.subarray(8,12)).toString('ascii')==='WEBP')return'image/webp';
  if(bytes.byteLength>=5&&Buffer.from(bytes.subarray(0,5)).toString('ascii')==='%PDF-')return'application/pdf';
  if(bytes.byteLength>=12&&Buffer.from(bytes.subarray(0,4)).toString('ascii')==='RIFF'
    &&Buffer.from(bytes.subarray(8,12)).toString('ascii')==='WAVE')return'audio/wav';
  if((bytes.byteLength>=3&&Buffer.from(bytes.subarray(0,3)).toString('ascii')==='ID3')
    ||(bytes.byteLength>=2&&bytes[0]===0xff&&((bytes[1]??0)&0xe0)===0xe0))return'audio/mpeg';
  if(bytes.byteLength>=12&&Buffer.from(bytes.subarray(4,8)).toString('ascii')==='ftyp')
    return extension==='.m4a'?'audio/mp4':'video/mp4';
  return extension==='.txt'?'text/plain':extension==='.json'?'application/json':extension==='.csv'?'text/csv'
    :'application/octet-stream';
};
const readCommunicationFileForMainAuthority=(selectedPath:string):{
  readonly displayName:string;readonly mimeType:string;readonly bytes:Buffer
}=>{
  if(!isAbsolute(selectedPath))throw new Error('[AUTHORIZATION-DENIED] Selected communication file path is not absolute.');
  const selected=resolve(selectedPath);const stat=lstatSync(selected);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size<1||stat.size>COMMUNICATION_FILE_SELECTION_MAX_BYTES)
    throw new Error('[AUTHORIZATION-DENIED] Selected communication file metadata is unsafe or outside the local limit.');
  if(normalizeSelectedFilePath(realpathSync(selected))!==normalizeSelectedFilePath(selected))
    throw new Error('[AUTHORIZATION-DENIED] Selected communication file path traverses a reparse point.');
  const descriptor=openSync(selected,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const opened=fstatSync(descriptor);
    if(!opened.isFile()||opened.nlink!==1||opened.dev!==stat.dev||opened.ino!==stat.ino||opened.size!==stat.size)
      throw new Error('[AUTHORIZATION-DENIED] Selected communication file identity changed while opening.');
    const bytes=readFileSync(descriptor);
    if(bytes.byteLength!==stat.size){bytes.fill(0);throw new Error('[AUTHORIZATION-DENIED] Selected communication file readback size changed.');}
    const displayName=basename(selected).normalize('NFKC').trim();
    if(displayName.length<1||displayName.length>255||/[\p{Cc}\p{Cf}\p{Cs}]/u.test(displayName)){
      bytes.fill(0);throw new Error('[AUTHORIZATION-DENIED] Selected communication file name is invalid.');
    }
    return Object.freeze({displayName,mimeType:communicationFileMimeType(bytes,displayName),bytes});
  }finally{closeSync(descriptor);}
};

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
const financeImportFileSessions = new FinanceImportFileSessionRegistry(
  (bytes) => createHash('sha256').update(bytes).digest('hex'),
  () => createRuntimeCorrelationId('ipc')
);
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
const currentProductName = APP_META.name;
let uiLocalizationBootstrap: Readonly<UiLocalizationBootstrapView> = resolveUiLocalization(undefined);
const uiLanguagePreferencePath=():string=>join(app.getPath('userData'),'preferences','ui-language.json');
const firstRunExperiencePath=():string=>join(app.getPath('userData'),'preferences','first-run-experience.json');
const operatingSystemUiLanguage = (): string => selectOperatingSystemUiLanguage(
  app.getSystemLocale(),
  app.getPreferredSystemLanguages()
);
const resolveMainUiLocalization = (preference:UiLanguagePreference):Readonly<UiLocalizationBootstrapView> =>
  resolveUiLocalization(operatingSystemUiLanguage(),preference);
const mainText = (turkish: string, english: string): string =>
  uiLocalizationBootstrap.language === 'tr' ? turkish : english;
const uninstallBackupAssistantRequested = process.argv.includes('--uninstall-backup-assistant');
assertPinnedBootstrapRuntimeCapability('windows-desktop', 'file.access');
assertPinnedBootstrapRuntimeCapability('windows-desktop', 'network.access');
const volatileRuntimeBase = join(app.getPath('temp'), 'ParsYuva-Aile-Yasam-Merkezi');
const volatileRuntimeCleanupMarker = join(volatileRuntimeBase, 'last-runtime-root.txt');
const volatileRuntimeRoot = join(
  volatileRuntimeBase,
  `runtime-${process.pid}-${Date.now().toString(36)}`
);
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
  const currentUserDataPath = join(appDataPath, STABLE_USER_DATA_DIRECTORY_NAME);
  app.setPath('userData', currentUserDataPath);
}
const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  if (uninstallBackupAssistantRequested) app.exit(5);
  else app.quit();
}
else {
  // The previous Chromium process may release its cache handles only after the
  // Electron main process exits. Clean exactly that recorded, direct child on
  // the next successful primary launch; never touch a live process or symlink.
  try {
    const previousRuntimeRoot = resolve(readFileSync(volatileRuntimeCleanupMarker, 'utf8').trim());
    const previousName = basename(previousRuntimeRoot);
    const previousMatch = /^runtime-(\d+)(?:-[a-z0-9]+)?$/u.exec(previousName);
    const previousProcessId = Number(previousMatch?.[1]);
    let previousProcessAlive = false;
    if (Number.isSafeInteger(previousProcessId) && previousProcessId > 0) {
      try { process.kill(previousProcessId, 0); previousProcessAlive = true; }
      catch (error) { previousProcessAlive = (error as NodeJS.ErrnoException).code === 'EPERM'; }
    }
    if (
      previousMatch
      && dirname(previousRuntimeRoot) === resolve(volatileRuntimeBase)
      && previousRuntimeRoot !== volatileRuntimeRoot
      && !previousProcessAlive
      && existsSync(previousRuntimeRoot)
    ) {
      const previousStat = lstatSync(previousRuntimeRoot);
      if (previousStat.isDirectory() && !previousStat.isSymbolicLink()) {
        try { rmSync(previousRuntimeRoot, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 }); }
        catch { /* Leave the locked residue untouched; normal OS temp maintenance remains safe. */ }
      }
    }
  } catch { /* No valid previous-runtime marker exists yet. */ }
  mkdirSync(volatileRuntimeBase, { recursive: true, mode: 0o700 });
  writeFileSync(volatileRuntimeCleanupMarker, `${volatileRuntimeRoot}\n`, { encoding: 'utf8', mode: 0o600 });
}
app.setAppUserModelId('tr.anadoluparsi.aileyasammerkezi');

type LocalGovernedOcrBridgeValue<T> = T | Promise<T>;

/**
 * Temporary structural boundary until FamilyDataStore exposes the 33-Q application facade.
 * Authenticated family/account/owner context, operation identifiers, audit identifiers and
 * sealed-result authority are resolved behind these main-only methods, never by renderer input.
 * Archive source-deletion propagation intentionally has no method on this renderer bridge.
 */
interface LocalGovernedOcrIpcDataStoreBridge {
  getLocalGovernedOcrCenter(): LocalGovernedOcrBridgeValue<LocalGovernedOcrCenterView>;
  getLocalGovernedOcrResult(input: LocalGovernedOcrResultReadIpcInput): LocalGovernedOcrBridgeValue<LocalGovernedOcrResultView>;
  searchLocalGovernedOcr(input: SearchLocalGovernedOcrInput): LocalGovernedOcrBridgeValue<LocalGovernedOcrSearchView>;
  createLocalGovernedOcrJob(input: CreateLocalGovernedOcrJobInput): LocalGovernedOcrBridgeValue<LocalGovernedOcrMutationReceiptView>;
  runLocalGovernedOcrJob(input: RunLocalGovernedOcrJobInput): LocalGovernedOcrBridgeValue<LocalGovernedOcrMutationReceiptView>;
  cancelLocalGovernedOcrJob(input: CancelLocalGovernedOcrJobInput): LocalGovernedOcrBridgeValue<LocalGovernedOcrMutationReceiptView>;
  correctLocalGovernedOcrResult(input: CorrectLocalGovernedOcrResultInput): LocalGovernedOcrBridgeValue<LocalGovernedOcrMutationReceiptView>;
  rerunLocalGovernedOcrJob(input: RerunLocalGovernedOcrJobInput): LocalGovernedOcrBridgeValue<LocalGovernedOcrMutationReceiptView>;
  deleteLocalGovernedOcrJob(input: DeleteLocalGovernedOcrJobInput): LocalGovernedOcrBridgeValue<LocalGovernedOcrMutationReceiptView>;
  setLocalGovernedOcrEnabled(input: SetLocalGovernedOcrEnabledInput): LocalGovernedOcrBridgeValue<LocalGovernedOcrMutationReceiptView>;
}

let dataStore: FamilyDataStore | undefined;
let desktopRuntime: DesktopRuntime | undefined;
let coreServiceStartupConnection: CoreServiceStartupConnectionResult | undefined;
let coreServiceCompanionManager: CoreServiceCompanionManager | undefined;
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
let applicationTray: Tray | undefined;
let explicitApplicationQuit = false;
let closeToTrayNoticeShown = false;
let trustedRenderer: TrustedRendererDescriptor | undefined;
let coordinatedWindowsHelloPlatform: WindowsHelloPlatformCoordinator | undefined;
let windowsHelloOperationInProgress = false;
let webAuthnCeremony:WebAuthnCeremonyAdapter|undefined;
let oidcFederatedIdentity:OidcFederatedIdentityAdapter|undefined;
let oidcTokenVault:OidcTokenVault|undefined;
const passkeyRecoveryRegistry=new MainOnlyPasskeyRecoveryRegistry();
const issuedOidcAuthorizationUrls=new Map<string,number>();
const oidcDeepLinkCallbacks=new MainOnlyOidcDeepLinkCallbackRegistry(()=>new Date().toISOString());
const queuedOidcArgumentDeliveries:string[][]=[];
const oidcDeepLinkProtocolRegistered=(()=>{
  if(process.platform!=='win32'||!app.isPackaged)return false;
  try{return app.setAsDefaultProtocolClient('pardus-app');}catch{return false;}
})();

const restoreOidcDeepLinkBindings=():void=>{
  if(!oidcTokenVault)return;
  for(const binding of oidcTokenVault.listPendingAuthorizationFlowBindings(new Date().toISOString())){
    oidcDeepLinkCallbacks.register({flowId:binding.flowId,provider:binding.providerId,accountId:binding.accountId,
      stateSha256:binding.stateSha256,redirectUri:binding.redirectUri,expiresAt:binding.expiresAt});
  }
};
const captureOidcDeepLinkArguments=(argumentsList:readonly string[]):void=>{
  const candidates=argumentsList.filter((value)=>typeof value==='string'&&value.toLowerCase().startsWith('pardus-app://'));
  if(candidates.length===0)return;
  if(!oidcTokenVault){if(candidates.length===1&&Buffer.byteLength(candidates[0]!,'utf8')<=8_192&&queuedOidcArgumentDeliveries.length<4)queuedOidcArgumentDeliveries.push([candidates[0]!]);return;}
  try{restoreOidcDeepLinkBindings();oidcDeepLinkCallbacks.captureFromArguments(argumentsList);}
  catch{/* Fail closed without logging callback code, state or URL. */}
};
const drainQueuedOidcDeepLinks=():void=>{
  if(!oidcTokenVault)return;
  const deliveries=[process.argv,...queuedOidcArgumentDeliveries.splice(0)];
  for(const delivery of deliveries)captureOidcDeepLinkArguments(delivery);
};

const observeEmergencyCardPowerSource = (): 'battery'|'ac'|'unknown' => {
  try {
    return powerMonitor.isOnBatteryPower() ? 'battery' : 'ac';
  } catch {
    return 'unknown';
  }
};

interface EmergencyCardExportMainInput {
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

const emergencyCardHtmlEscape = (value:unknown):string => String(value).replace(
  /[&<>"']/gu,
  (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character] ?? character
);

const emergencyCardHtml = (prepared:{
  readonly configurationLabel:string;
  readonly selectedFields:readonly { readonly fieldCode:string; readonly value:string }[];
}):string => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>
@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#101828;font-size:12pt}h1{font-size:20pt;margin:0 0 5mm}p{margin:0 0 6mm;color:#475467}.field{break-inside:avoid;border:1px solid #d0d5dd;border-radius:8px;padding:4mm;margin:0 0 3mm}.label{font-size:9pt;color:#667085;text-transform:uppercase;letter-spacing:.04em}.value{font-size:13pt;font-weight:600;white-space:pre-wrap;overflow-wrap:anywhere}.warning{margin-top:8mm;border-top:2px solid #b42318;padding-top:4mm;color:#b42318;font-weight:700}
</style></head><body><h1>${emergencyCardHtmlEscape(prepared.configurationLabel)}</h1><p>Çevrimdışı acil sağlık ve iletişim kartı · yerel, manuel ve kullanıcı seçimiyle oluşturuldu.</p>${prepared.selectedFields.map((field) => `<section class="field"><div class="label">${emergencyCardHtmlEscape(field.fieldCode)}</div><div class="value">${emergencyCardHtmlEscape(field.value)}</div></section>`).join('')}<div class="warning">Harita, canlı konum, mesaj teslimi, sağlık doğrulaması veya acil servis teması yapılmadı; hizmet garantisi değildir.</div></body></html>`;

const emergencyCardCanonicalPayload = (input:{
  readonly prepared:{
    readonly profileId:string;
    readonly configurationId:string;
    readonly configurationLabel:string;
    readonly locale:'tr-TR';
    readonly selectionSha256:string;
    readonly selectedFields:readonly { readonly selectedFieldId:string; readonly sourceItemId:string; readonly sourceItemType:string; readonly fieldCode:string; readonly value:string }[];
  };
  readonly documents:readonly { readonly documentLinkId:string; readonly archiveItemId:string; readonly originalName:string; readonly mimeType:string; readonly sizeBytes:number; readonly sha256:string; readonly content:Buffer }[];
}):Buffer => {
  const documents = [...input.documents].sort((left,right) => left.documentLinkId.localeCompare(right.documentLinkId));
  let contentOffsetBytes = 0;
  const metadata = Buffer.from(JSON.stringify({
    format:'ppt-family-emergency-card',version:1,contentEncoding:'length-prefixed-raw',
    profileId:input.prepared.profileId,
    configurationId:input.prepared.configurationId,
    configurationLabel:input.prepared.configurationLabel,
    locale:input.prepared.locale,
    selectionSha256:input.prepared.selectionSha256,
    selectedFields:[...input.prepared.selectedFields].map((field) => ({
      selectedFieldId:field.selectedFieldId,
      sourceItemId:field.sourceItemId,
      sourceItemType:field.sourceItemType,
      fieldCode:field.fieldCode,
      value:field.value
    })).sort((left,right) => left.selectedFieldId.localeCompare(right.selectedFieldId)),
    documents:documents.map((document) => {
      const result = {
        documentLinkId:document.documentLinkId,
        archiveItemId:document.archiveItemId,
        originalName:document.originalName,
        mimeType:document.mimeType,
        sizeBytes:document.sizeBytes,
        sha256:document.sha256,
        contentOffsetBytes,
        contentSizeBytes:document.content.length
      };
      contentOffsetBytes += document.content.length;
      return result;
    })
  }), 'utf8');
  const prefix = Buffer.alloc(12);
  prefix.write('PPTEMR01', 0, 'ascii');
  prefix.writeUInt32BE(metadata.length, 8);
  const payload = Buffer.alloc(prefix.length + metadata.length + contentOffsetBytes);
  try {
    prefix.copy(payload, 0);
    metadata.copy(payload, prefix.length);
    let offset = prefix.length + metadata.length;
    for (const document of documents) {
      document.content.copy(payload, offset);
      offset += document.content.length;
    }
    return payload;
  } finally {
    prefix.fill(0);
    metadata.fill(0);
  }
};

const writeEmergencyCardArtifactAtomically = (destinationPath:string, bytes:Buffer):{
  readonly artifactSha256:string;
  readonly artifactSizeBytes:number;
} => {
  if (!isAbsolute(destinationPath)) throw new Error('Acil kart çıktı yolu mutlak olmalıdır.');
  const directory = dirname(destinationPath);
  const directoryMetadata = lstatSync(directory);
  if (!directoryMetadata.isDirectory() || directoryMetadata.isSymbolicLink()) {
    throw new Error('Acil kart çıktı üst dizini normal bir yerel dizin olmalıdır.');
  }
  if (existsSync(destinationPath)) {
    const existing = lstatSync(destinationPath);
    if (!existing.isFile() || existing.isSymbolicLink()) {
      throw new Error('Acil kart çıktı hedefi normal bir dosya olmalıdır.');
    }
    throw new Error('Acil kart çıktısı mevcut dosyanın üzerine yazılmaz; yeni bir dosya adı seçin.');
  }
  const temporaryPath = join(directory, `.${basename(destinationPath)}.${process.pid}.${randomUUID()}.tmp`);
  let published = false;
  try {
    const descriptor = openSync(temporaryPath, 'wx', 0o600);
    try {
      writeFileSync(descriptor, bytes);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    const temporaryReadback = readFileSync(temporaryPath);
    try {
      if (temporaryReadback.length !== bytes.length
        || sha256Hex(temporaryReadback) !== sha256Hex(bytes)) throw new Error('Acil kart geçici çıktı okuma doğrulaması başarısız.');
    } finally {
      temporaryReadback.fill(0);
    }
    linkSync(temporaryPath, destinationPath);
    published = true;
    const metadata = statSync(destinationPath);
    const finalReadback = readFileSync(destinationPath);
    try {
      const artifactSha256 = sha256Hex(bytes);
      if (!metadata.isFile() || metadata.size !== bytes.length || finalReadback.length !== bytes.length
        || sha256Hex(finalReadback) !== artifactSha256) throw new Error('Acil kart kalıcı çıktı okuma doğrulaması başarısız.');
      return Object.freeze({ artifactSha256, artifactSizeBytes:bytes.length });
    } finally {
      finalReadback.fill(0);
    }
  } catch (error) {
    if (published) rmSync(destinationPath, { force:true });
    throw error;
  } finally {
    rmSync(temporaryPath, { force:true });
  }
};

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
let productLicenseManager: ProductLicenseManager | undefined;
let factoryResetManager: FactoryResetManager | undefined;
let productLicenseTimer: NodeJS.Timeout | undefined;
let startupSecurityReport: StartupSecurityPreflightReport | undefined;
let windowsSecurityEvidenceReport: WindowsSecurityEvidenceProbeReport | undefined;
let windowsOpen021EfsEvidenceReport: WindowsOpen021EfsEvidenceProbeReport | undefined;
let windowsOpen022SideArtifactEvidenceReport: WindowsOpen022SideArtifactEvidenceProbeReport | undefined;
type StartupStage =
  | 'WAITING_FOR_APP_READY'
  | 'SAFE_STORAGE_INITIALIZATION'
  | 'PRODUCT_LICENSE_INITIALIZATION'
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
let startupIpcRegistrationChannel: string | undefined;

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
    failedIpcChannel: startupStage === 'IPC_REGISTRATION' ? startupIpcRegistrationChannel ?? null : null,
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
const emergencyCardExportReauthenticationGuard = new IpcAdaptiveBudgetMaintenanceReauthenticationGuard({
  maximumFailedAttempts: 5,
  lockDurationMs: 5 * 60_000,
  failureWindowMs: 10 * 60_000,
  maximumTrackedContexts: 256
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

function openUpgradableUserDataSession(userVault: UserDataVault, initialDatabaseBytes: Buffer): void {
  try {
    const current = runtime();
    const snapshot = userVault.createUpgradeRollbackSnapshot({
      directory: join(app.getPath('userData'), 'safety-backups', 'surum-yukseltme'),
      applicationVersion: APP_META.version,
      createdAt: current.clock.now()
    });
    if (snapshot) current.logger.info({
      timestamp: current.clock.now(), service: 'desktop-main', process: 'electron-main',
      event: 'database.upgrade.rollback_snapshot_verified', correlationId: createRuntimeCorrelationId('migration'), outcome: 'success',
      metadata: { applicationVersion: snapshot.applicationVersion, encryptedAtRest: snapshot.encryptedAtRest,
        readbackVerified: snapshot.readbackVerified, containerSha256: snapshot.containerSha256, containerSizeBytes: snapshot.containerSizeBytes }
    });
    openVolatileUserDataSession(initialDatabaseBytes);
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
    const auth = current.getAuthState();
    const guardAction = resolveVaultSessionGuardAction(
      current.getSessionLockState().status,
      auth.authenticated,
      auth.trustedDevice === true
    );
    // A locked session has no normal policy authority by design. Defer before
    // entering the PEP so its fail-closed authority resolver cannot seal the
    // recoverable vault that the reauthentication overlay still needs.
    if (guardAction === 'defer_locked' || guardAction === 'defer_untrusted') return;
    const correlationId = createRuntimeCorrelationId('job');
    void runtime().correlation.run({ correlationId }, () => universalApiPolicyEnforcement().execute({
      channel: VAULT_SESSION_CHECKPOINT_CHANNEL,
      correlationId,
      operation: () => {
        if (guardAction === 'seal') throw new Error('VAULT_SESSION_AUTHORITY_EXPIRED');
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
      try {
        const locked = current.lockSession();
        if (locked.status !== 'locked') sealUserDataSession();
      } catch {
        sealUserDataSession();
      }
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

function createIdentityAccessProductionPorts(current:DesktopRuntime,protector:DeviceSecretProtector):{
  readonly ports:Partial<IdentityAccessDataStorePorts>;
  readonly providerConfigurations:readonly import('@ppt/repository-contracts').FederatedProviderProvisioningRow[];
}{
  const deviceIdentity=new FileDeviceIdentityProvider(join(current.config.paths.secrets,'device-identity.json'),current.clock,protector);
  webAuthnCeremony=new WebAuthnCeremonyAdapter({trustedRelyingParties:[{relyingPartyId:IDENTITY_WEBAUTHN_RP_ID,origin:PRIMARY_RENDERER_ORIGIN}],authenticatedDeviceId:(accountId)=>{
    if(!dataStore)return null;const auth=dataStore.getAuthState();return auth.authenticated&&dataStore.currentAuthenticatedAccountId()===accountId&&auth.trustedDevice===true?auth.currentDeviceId??null:null;
  },clock:()=>current.clock.now()});
  const secureOidcNetworkAdapter=new SecureOidcNetworkAdapter({registrations:configuredOidcNetworkRegistrations(),policy:networkEgressPolicy,clock:()=>current.clock.now()});
  const registrations=secureOidcNetworkAdapter.networkReadyProviderRegistrations();
  const providerConfigurations=new StaticTrustedOidcProviderConfigurationResolver(registrations);
  oidcTokenVault=new OidcTokenVault(protector,new FileSystemOidcVaultPersistence(join(current.config.paths.secrets,'identity-oidc-vault.json')));
  drainQueuedOidcDeepLinks();
  oidcFederatedIdentity=new OidcFederatedIdentityAdapter({providerConfigurations,codeExchangeClient:secureOidcNetworkAdapter,jwksResolver:secureOidcNetworkAdapter,tokenVault:oidcTokenVault,clock:()=>current.clock.now()});
  const temporaryCredentialEnvelope=new ProtectedTemporaryCredentialEnvelopeAdapter({directory:join(current.config.paths.secrets,'temporary-credentials'),protector,deviceIdentity,clock:current.clock});
  const encryptedCompanionSnapshot=new X25519EncryptedCompanionSnapshotAdapter({
    encryptionKeys:{resolve:({trustedDeviceId,securityEpoch})=>{
      const configuredDevice=process.env.PPT_COMPANION_TRUSTED_DEVICE_ID;const publicKeySpkiBase64Url=process.env.PPT_COMPANION_X25519_PUBLIC_KEY_SPKI_BASE64URL;
      return configuredDevice&&publicKeySpkiBase64Url&&configuredDevice===trustedDeviceId?ok({publicKeySpkiBase64Url,algorithm:'X25519' as const,securityEpoch}):err(identityFailure('Companion X25519 recipient key is unavailable.'));
    }}
  });
  const ports:Partial<IdentityAccessDataStorePorts>={challengeGenerator:{createChallenge:createWebAuthnChallenge},passkeyCeremonyVerifier:webAuthnCeremony,passkeyRecoveryVerifier:passkeyRecoveryRegistry,
    federatedAuthorizationCeremony:oidcFederatedIdentity,federatedAuthorizationCodeVerifier:oidcFederatedIdentity,temporaryCredentialEnvelope,encryptedCompanionSnapshot,
    federatedVaultControl:{revokeEntry:(_context,entryId)=>oidcTokenVault?.revokeToken(entryId,current.clock.now())?ok(undefined):err(identityFailure('Federated vault entry could not be revoked.'))}};
  return Object.freeze({ports,providerConfigurations:Object.freeze(registrations.map(({configurationId,configuration,clientConfigurationSha256})=>Object.freeze({provider:configuration.providerId,configured:true,configurationId,authorizationEndpointSha256:createHash('sha256').update(configuration.authorizationEndpoint).digest('hex'),clientConfigurationSha256}))) });
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
    const identityAccess=createIdentityAccessProductionPorts(current,osSecretProtector);
    const defenderExecutable=join(process.env.ProgramFiles??'C:\\Program Files','Windows Defender','MpCmdRun.exe');
    let defenderScanner:WindowsDefenderCommunicationFileMalwareScanner|undefined;
    if(process.platform==='win32'&&existsSync(defenderExecutable)){
      try{
        defenderScanner=new WindowsDefenderCommunicationFileMalwareScanner({
          executablePath:defenderExecutable,
          scratchDirectory:join(current.config.paths.temp,'windows-defender-scan')
        });
      }catch{
        // The downstream OCR and file-sharing ports remain fail-closed when Defender cannot be attested.
      }
    }
    const provisioningCorrelationId=createRuntimeCorrelationId('startup');
    dataStore=current.correlation.run({correlationId:provisioningCorrelationId},()=>desktopRepositoryPolicyScope.runBootstrap({correlationId:provisioningCorrelationId,boundary:'auth:getExternalIdentityProviders'},()=>new FamilyDataStore({
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
      familyAiAssistantModel:new OllamaFamilyAiModelAdapter({
        enabled:resolveLocalFamilyAiEnabled(process.env.PPT_LOCAL_AI_ENABLED),
        model:process.env.PPT_LOCAL_AI_MODEL?.trim()||'qwen3:4b',
        clock:()=>current.clock.now()
      }),
      ...(defenderScanner===undefined?{}:{
        communicationFileMalwareScanner:defenderScanner,
        localGovernedOcrMalwareScanner:new WindowsDefenderLocalOcrMalwareAdapter(defenderScanner)
      }),
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
      communicationCallPreflight:new ElectronCommunicationCallPreflightPort({
        windows:{create:(options)=>new BrowserWindow(options) as unknown as CommunicationCallPreflightWindowLike},
        clock:()=>current.clock.now()
      }),
      identityAccessPorts:identityAccess.ports,
      federatedProviderConfigurations:identityAccess.providerConfigurations,
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
    })));
  }
  return dataStore;
}

function financeImportSessionOwnerToken(event: IpcMainInvokeEvent): string {
  return createHash('sha256').update(
    `${event.sender.id}\u0000${store().currentAuthenticatedAccountId()}\u0000family-main`,
    'utf8'
  ).digest('hex');
}

function registerIpcHandler<TArguments extends unknown[], TResult>(
  channel: string,
  handler: IpcHandler<TArguments, TResult>
): void {
  startupIpcRegistrationChannel = channel;
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
  startupIpcRegistrationChannel = undefined;
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

const countedMaintenanceReauthenticationFailureCode = countedStrongAuthenticationFailureCode;

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

function localGovernedOcrBridgeMethod<K extends keyof LocalGovernedOcrIpcDataStoreBridge>(
  methodName: K
): LocalGovernedOcrIpcDataStoreBridge[K] {
  const bridge = store() as unknown as Partial<LocalGovernedOcrIpcDataStoreBridge>;
  const method = bridge[methodName];
  if (typeof method !== 'function') {
    throw new Error('Local governed OCR main application bridge is not configured.');
  }
  return method.bind(bridge) as LocalGovernedOcrIpcDataStoreBridge[K];
}

function registerIpc(): void {
  universalApiPolicyEnforcement().registerClientApplicationServiceChannel(VAULT_SESSION_CHECKPOINT_CHANNEL);
  registerIpcCancellationHandlers({
    ipcMain,
    runtime: runtime(),
    resolveTrustedRenderer: () => trustedRenderer,
    requestLifecycles: ipcRequestLifecycles
  });
  registerIpcHandler('app:getInfo', () => USER_VISIBLE_APP_INFO);
  registerIpcHandler('app:getLocalizationBootstrap', () => uiLocalizationBootstrap);
  registerIpcHandler('app:setLanguagePreference', (_event, preference:UiLanguagePreference) => {
    writeUiLanguagePreference(uiLanguagePreferencePath(),preference);
    uiLocalizationBootstrap=resolveMainUiLocalization(preference);
    return uiLocalizationBootstrap;
  });
  registerIpcHandler('app:getFirstRunExperience', () => readFirstRunExperience(firstRunExperiencePath()));
  registerIpcHandler('app:markFirstRunNarrationOffered', () => {
    const current=readFirstRunExperience(firstRunExperiencePath());
    return writeFirstRunExperience(firstRunExperiencePath(),{...current,narrationOffered:true});
  });
  registerIpcHandler('app:completeFirstRunIntroduction', () =>
    writeFirstRunExperience(firstRunExperiencePath(),{introductionCompleted:true,narrationOffered:true}));
  registerIpcHandler('auth:getExternalIdentityProviders', () => (oidcDeepLinkProtocolRegistered?oidcFederatedIdentity?.listVisibleConfiguredProviders()??[]:[]).map(({provider})=>({id:provider,label:provider==='apple'?mainText('Apple ile devam et','Continue with Apple'):provider==='google'?mainText('Google ile devam et','Continue with Google'):mainText('Microsoft ile devam et','Continue with Microsoft'),configured:true,productionReady:false})));
  registerIpcHandler('auth:getState', () => dataStore ? dataStore.getAuthState() : lockedAuthState());
  registerIpcHandler('auth:getSessionLockState', () => {
    const state = store().getSessionLockState();
    if (state.status === 'locked' || state.status === 'signed_out') financeImportFileSessions.clear();
    return state;
  });
  registerIpcHandler('auth:recordSessionActivity', () => store().recordSessionActivity());
  registerIpcHandler('auth:lockSession', () => {
    financeImportFileSessions.clear();
    return store().lockSession();
  });
  registerIpcHandler('auth:unlockSession', (_event, input: UnlockSessionInput) => store().unlockSession(input));
  registerIpcHandler('auth:getWindowsHelloState', () =>
    dataStore ? store().getWindowsHelloState() : lockedWindowsHelloState()
  );
  registerIpcHandler('auth:setup', (_event, input: SetupAdminInput) => {
    financeImportFileSessions.clear();
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
    financeImportFileSessions.clear();
    if (windowsHelloOperationInProgress) {
      throw new Error('Windows Hello işlemi sürerken parola girişi başlatılamaz.');
    }
    const userVault = vault();
    if (!userVault.isInitialized()) throw new Error('İlk kurulum tamamlanmamış.');
    try {
      if (!userVault.isUnlocked()) openUpgradableUserDataSession(userVault,userVault.unlock(input.password));
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
    financeImportFileSessions.clear();
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
        openUpgradableUserDataSession(userVault,unlocked.databaseBytes);
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
    finally {
      financeImportFileSessions.clear();
      emergencyCardExportReauthenticationGuard.clearAll();
      offlineSensitiveCache.lock('NO_LEASE');
      sealUserDataSession();
    }
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
  registerIpcHandler('privacyControl:getCenter', () => store().getPrivacyControlCenter());
  registerIpcHandler('privacyControl:setLiveLocationConsent', (_event, input:UpsertLiveLocationConsentInput) => store().upsertLiveLocationConsent(input));
  registerIpcHandler('privacyControl:shutdownLostDevice', (_event, input:LostDeviceShutdownInput) => {
    const result = store().shutdownLostDeviceAuthority(input);
    financeImportFileSessions.clear();
    emergencyCardExportReauthenticationGuard.clearAll();
    offlineSensitiveCache.lock('REVOKED');
    sealUserDataSession();
    return result;
  });
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
  registerIpcHandler('system:factoryReset', async (_event,input:{readonly password:string;readonly code?:string;readonly confirmation:string}) => {
    if(!factoryResetManager)throw new Error('Fabrika ayarı yöneticisi hazır değil.');
    if(!input||typeof input!=='object'||Object.getPrototypeOf(input)!==Object.prototype)throw new Error('Fabrika ayarı isteği geçersiz.');
    const keys=Object.keys(input).sort();
    if(keys.some(key=>!['code','confirmation','password'].includes(key))||!keys.includes('confirmation')||!keys.includes('password')
      ||typeof input.password!=='string'||input.password.length<1||input.password.length>1024
      ||(input.code!==undefined&&(typeof input.code!=='string'||input.code.length>256))
      ||input.confirmation!==FACTORY_RESET_CONFIRMATION)throw new Error('Fabrika ayarı isteği geçersiz.');
    const plan=store().prepareFactoryReset(input);
    await factoryResetManager.request(plan.backupArtifactPaths,FACTORY_RESET_CONFIRMATION);
    stopBackgroundSchedulers();
    stopVaultSessionGuard();
    discardVolatileUserDataSession();
    vault().discardSession();
    app.relaunch();
    setImmediate(()=>app.exit(0));
    return Object.freeze({restarting:true,noBackupCreated:true,knownBackupCount:plan.backupArtifactPaths.length});
  });
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
  registerIpcHandler('system:archiveDiagnostics', async (_event,before?:string) => { const cutoff=before??new Date(Date.now()-30*86_400_000).toISOString(); const result=await dialog.showSaveDialog({title:'Tanılama olay arşivini kaydet',defaultPath:`ParsYuva_Aile_Yasam_Merkezi_Tanilama_Arsivi_${new Date().toISOString().slice(0,10)}.pptdiag`,filters:[{name:'Korumalı Tanılama',extensions:['pptdiag']}]}); if(result.canceled||!result.filePath)return {canceled:true}; return {canceled:false,archive:store().archiveDiagnostics(cutoff,result.filePath)}; });
  registerIpcHandler('system:verifyDiagnosticArchive', (_event,id:string) => store().verifyDiagnosticArchive(id));
  registerIpcHandler('system:readDiagnosticReport', (_event,id:string) => store().readDiagnosticReport(id));
  registerIpcHandler('system:verifyDiagnosticReport', (_event,id:string) => store().verifyDiagnosticReport(id));
  registerIpcHandler('system:compareDiagnosticReports', (_event,leftId:string,rightId:string) => store().compareDiagnosticReports(leftId,rightId));
  registerIpcHandler('system:readDiagnosticArchive', (_event,id:string) => store().readDiagnosticArchive(id));
  registerIpcHandler('system:searchDiagnosticArchive', (_event,id:string,input:DiagnosticArchiveSearchInput) => store().searchDiagnosticArchive(id,input));
  registerIpcHandler('system:exportDiagnosticArchiveEntries', async (_event,id:string,input:DiagnosticArchiveSearchInput,format:'json'|'csv') => { const result=await dialog.showSaveDialog({title:'Arşiv olaylarını dışa aktar',defaultPath:`ParsYuva_Aile_Yasam_Merkezi_Arsiv_Olaylari_${new Date().toISOString().slice(0,10)}.pptdiag`,filters:[{name:'Korumalı Tanılama',extensions:['pptdiag']}]}); if(result.canceled||!result.filePath)return {canceled:true}; return {canceled:false,export:store().exportDiagnosticArchiveEntries(id,input,format,result.filePath)}; });
  registerIpcHandler('system:listMaintenanceHistory', (_event,limit?:number) => store().listMaintenanceHistory(limit));

  registerIpcHandler('system:searchMaintenanceHistory', (_event,input:MaintenanceHistoryFilterInput) => store().searchMaintenanceHistory(input));
  registerIpcHandler('system:exportMaintenanceHistory', async (_event,input:MaintenanceHistoryFilterInput,format:'json'|'csv') => { const result=await dialog.showSaveDialog({title:'Bakım geçmişini dışa aktar',defaultPath:`ParsYuva_Aile_Yasam_Merkezi_Bakim_Gecmisi_${new Date().toISOString().slice(0,10)}.pptdiag`,filters:[{name:'Korumalı Tanılama',extensions:['pptdiag']}]}); if(result.canceled||!result.filePath)return {canceled:true}; return {canceled:false,export:store().exportMaintenanceHistory(input,format,result.filePath)}; });
  registerIpcHandler('system:searchAllDiagnosticArchives', (_event,input:DiagnosticArchiveSearchInput) => store().searchAllDiagnosticArchives(input));
  registerIpcHandler('system:exportSystemPdf', async () => { const report=store().getDiagnosticReport(); const result=await dialog.showSaveDialog({title:'Sistem sağlık raporunu PDF olarak kaydet',defaultPath:`ParsYuva_Aile_Yasam_Merkezi_Sistem_Raporu_${new Date().toISOString().slice(0,10)}.pptreport`,filters:[{name:'Korumalı Sistem Raporu',extensions:['pptreport']}]}); if(result.canceled||!result.filePath)return {canceled:true}; const win=new BrowserWindow({show:false,webPreferences:{sandbox:true}}); const esc=(v:unknown)=>String(v).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!)); const html=`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:32px;color:#1d2433}h1{font-size:24px}h2{font-size:16px;margin-top:24px}.score{font-size:42px;font-weight:700}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{border:1px solid #ddd;border-radius:10px;padding:14px}small{color:#667}</style></head><body><h1>ParsYuva Aile Yaşam Merkezi — Sistem Sağlık Raporu</h1><p>${esc(report.generatedAt)}</p><div class="score">${report.healthScore.score}/100</div><p>${esc(report.healthScore.grade)} · ${esc(report.system.status)}</p><div class="grid"><div class="card"><h2>Donanım</h2><p>${esc(report.system.cpuModel)}</p><p>CPU çekirdeği: ${report.system.cpuCores}</p><p>Bellek: ${report.system.memoryUsagePercent.toFixed(1)}%</p></div><div class="card"><h2>Depolama</h2><p>Veritabanı: ${report.system.databaseBytes} bayt</p><p>Arşiv: ${report.system.archiveBytes} bayt</p><p>Bütünlük: ${report.system.integrityOk?'Başarılı':'Başarısız'}</p></div></div><h2>Kesintiler</h2><ul>${report.healthScore.deductions.map(d=>`<li>${esc(d.message)} (-${d.points})</li>`).join('')||'<li>Kesinti yok</li>'}</ul><h2>Son tanılama olayları</h2><ul>${report.diagnostics.slice(0,20).map(d=>`<li>${esc(d.occurredAt)} — ${esc(d.code)} — ${esc(d.message)}</li>`).join('')}</ul></body></html>`; await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`); const buffer=await win.webContents.printToPDF({printBackground:true,pageSize:'A4'}); const protectedReport=runtime().protectedArtifacts.writeBuffer(result.filePath,'system-health-report-pdf',buffer); buffer.fill(0); win.destroy(); store().recordExportArtifact('system_pdf','pdf',protectedReport.filePath,protectedReport.sha256,protectedReport.sizeBytes); return {canceled:false,...protectedReport}; });

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
      defaultPath: `ParsYuva_Aile_Yasam_Merkezi_IPC_Adaptif_Tani_${new Date().toISOString().slice(0, 10)}.pptdiag`,
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
  registerIpcHandler('system:exportDiagnosticReport', async () => { const result=await dialog.showSaveDialog({title:'Tanılama raporunu kaydet',defaultPath:`ParsYuva_Aile_Yasam_Merkezi_Tanilama_${new Date().toISOString().slice(0,10)}.pptdiag`,filters:[{name:'Korumalı Tanılama Raporu',extensions:['pptdiag']}]}); if(result.canceled||!result.filePath)return {canceled:true}; store().exportDiagnosticReport(result.filePath); return {canceled:false,filePath:result.filePath}; });
  registerIpcHandler('data:getSnapshot', () => store().getSnapshot());
  registerIpcHandler('data:getSnapshotSections', (_event, input:FamilySnapshotSectionsInput) => store().getSnapshotSections(input));
  registerIpcHandler('dashboard:getOverview', () => store().getDashboardOverview());
  registerIpcHandler('catalog:listPeople', (_event, input:PersonCatalogPageInput = {}) => store().listPersonCatalog(input));
  registerIpcHandler('catalog:listEvents', (_event, input:EventCatalogPageInput = {}) => store().listEventCatalog(input));
  registerIpcHandler('catalog:lookup', (_event, input:EntityCatalogLookupInput = {}) => store().lookupEntityCatalog(input));
  registerIpcHandler('life:list', async () => await store().listLifeRecords());
  registerIpcHandler('life:getManagedWorkspace', async () => await store().getManagedLifeWorkspace());
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
  registerIpcHandler('archive:reattestLegacyOwnership', (_event,input:ReattestLegacyArchiveOwnershipInput) => store().reattestLegacyArchiveOwnership(input));
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
  registerIpcHandler('life:recordManagedItem', async (_event, input:RecordManagedLifeItemInput) => await store().recordManagedLifeItem(
    input.itemType === 'power_mode_event'
      ? { ...input, powerSource:observeEmergencyCardPowerSource() }
      : input
  ));
  registerIpcHandler('life:exportEmergencyCard', async (event, input:EmergencyCardExportMainInput) => {
    const request = getIpcRequestContext(event);
    const correlationId = runtime().correlation.current()?.correlationId;
    const senderId = event.sender?.id;
    if (!request || !correlationId || !Number.isSafeInteger(senderId) || Number(senderId) < 0
      || request.channel !== 'life:exportEmergencyCard') {
      throw new Error('Acil durum kartı dışa aktarımının güvenilir IPC bağı bulunamadı.');
    }
    if (input.mode !== 'encrypted_pack' && input.documentLinkIds.length > 0) {
      throw new Error('Düz metin PDF/yazıcı çıktısına arşiv belgesi eklenemez.');
    }
    const throttleKey = createHash('sha256').update(
      `${store().currentAuthenticatedAccountId()}\u0000${senderId}\u0000${request.rendererSessionId}\u0000emergency-card-export`,
      'utf8'
    ).digest('hex');
    const before = emergencyCardExportReauthenticationGuard.status(throttleKey);
    if (before.locked) {
      throw new Error(`[AUTH_RATE_LIMITED] Acil kart güçlü doğrulaması geçici olarak kilitlendi. ${before.retryAfterSeconds ?? 1} saniye sonra yeniden deneyin.`);
    }
    let prepared:Awaited<ReturnType<FamilyDataStore['prepareEmergencyCardExport']>>;
    try {
      prepared = await store().prepareEmergencyCardExport({
        profileId:input.profileId,
        configurationId:input.configurationId,
        mode:input.mode,
        selectedFieldIds:input.selectedFieldIds,
        documentLinkIds:input.documentLinkIds,
        credentials:{ password:input.password, ...(input.code ? { code:input.code } : {}) },
        rendererSessionId:request.rendererSessionId,
        operationId:request.requestId,
        correlationId,
        onStrongAuthenticationVerified:() => emergencyCardExportReauthenticationGuard.recordSuccess(throttleKey)
      });
    } catch (error) {
      const failureCode = countedMaintenanceReauthenticationFailureCode(error);
      if (failureCode) {
        const throttle = emergencyCardExportReauthenticationGuard.recordFailure(throttleKey);
        runtime().logger.warn({
          timestamp:runtime().clock.now(), service:'desktop-main', process:'electron-main',
          event:'life.emergency_card_export_reauthentication_failed', correlationId, outcome:'failure',
          metadata:{ senderId, failureCode, failedAttempts:throttle.failedAttempts, remainingAttempts:throttle.remainingAttempts, locked:throttle.locked }
        });
        if (throttle.locked) {
          throw new Error(`[AUTH_RATE_LIMITED] Acil kart güçlü doğrulaması geçici olarak kilitlendi. ${throttle.retryAfterSeconds ?? 1} saniye sonra yeniden deneyin.`);
        }
      }
      throw error;
    }

    const powerSource = observeEmergencyCardPowerSource();
    let printWindow:BrowserWindow | undefined;
    let artifactSha256 = '';
    let artifactSizeBytes = 0;
    let artifactPath:string | undefined;
    let artifactCreated = false;
    let artifactReadbackStatus:'verified'|'not_applicable_print';
    let printerDispatchStatus:'confirmed'|undefined;
    const documentBytes:Buffer[] = [];
    try {
      if (input.mode === 'print' || input.mode === 'pdf') {
        const html = emergencyCardHtml(prepared);
        printWindow = new BrowserWindow({ show:false, webPreferences:{ nodeIntegration:false, contextIsolation:true, sandbox:true, webSecurity:true } });
        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      }
      if (input.mode === 'print' && printWindow) {
        const activePrintWindow = printWindow;
        const canonicalPdf = await activePrintWindow.webContents.printToPDF({ printBackground:true, pageSize:'A4' });
        try {
          artifactSha256 = sha256Hex(canonicalPdf);
          artifactSizeBytes = canonicalPdf.length;
        } finally {
          canonicalPdf.fill(0);
        }
        const printed = await new Promise<boolean>((resolvePrint) => activePrintWindow.webContents.print(
          { printBackground:true, silent:false },
          (success) => resolvePrint(success)
        ));
        if (!printed) return Object.freeze({ canceled:true as const });
        artifactReadbackStatus = 'not_applicable_print';
        printerDispatchStatus = 'confirmed';
      } else if (input.mode === 'pdf' && printWindow) {
        const selected = await dialog.showSaveDialog({
          title:'Özel acil kart PDF dosyasını kaydet',
          defaultPath:`Acil_Kart_${new Date().toISOString().slice(0,10)}.pdf`,
          filters:[{ name:'PDF', extensions:['pdf'] }]
        });
        if (selected.canceled || !selected.filePath) return Object.freeze({ canceled:true as const });
        if (!isAbsolute(selected.filePath) || extname(selected.filePath).toLocaleLowerCase('en-US') !== '.pdf') {
          throw new Error('Acil kart PDF çıktısı mutlak ve .pdf uzantılı bir hedef gerektirir.');
        }
        artifactPath = selected.filePath;
        const pdf = await printWindow.webContents.printToPDF({ printBackground:true, pageSize:'A4' });
        try {
          ({ artifactSha256, artifactSizeBytes } = writeEmergencyCardArtifactAtomically(artifactPath, pdf));
          artifactCreated = true;
        } finally {
          pdf.fill(0);
        }
        artifactReadbackStatus = 'verified';
      } else {
        if (!input.packagePassphrase) throw new Error('Şifreli paket için bağımsız paket parolası zorunludur.');
        const selected = await dialog.showSaveDialog({
          title:'Şifreli özel acil kart paketini kaydet',
          defaultPath:`Acil_Kart_${new Date().toISOString().slice(0,10)}.pptemergency`,
          filters:[{ name:'Şifreli Acil Kart Paketi', extensions:['pptemergency'] }]
        });
        if (selected.canceled || !selected.filePath) return Object.freeze({ canceled:true as const });
        if (!isAbsolute(selected.filePath) || extname(selected.filePath).toLocaleLowerCase('en-US') !== '.pptemergency') {
          throw new Error('Şifreli acil kart çıktısı mutlak ve .pptemergency uzantılı bir hedef gerektirir.');
        }
        artifactPath = selected.filePath;
        let totalDocumentBytes = 0;
        const documents:{ documentLinkId:string; archiveItemId:string; originalName:string; mimeType:string; sizeBytes:number; sha256:string; content:Buffer }[] = [];
        for (const document of prepared.documents) {
          const documentCorrelationId = asCorrelationId(`archive-emergency-export-${createHash('sha256').update(
            `${correlationId}\u0000${document.documentLinkId}`,
            'utf8'
          ).digest('hex').slice(0,48)}`);
          const read = await store().readArchiveItemBytesForEmergencyExport(
            document.archiveItemId,
            undefined,
            documentCorrelationId
          );
          documentBytes.push(read.bytes);
          totalDocumentBytes += read.bytes.length;
          if (totalDocumentBytes > 25 * 1024 * 1024) throw new Error('Acil kart belgeleri toplam 25 MiB sınırını aşıyor.');
          documents.push({
            documentLinkId:document.documentLinkId,
            archiveItemId:document.archiveItemId,
            originalName:read.originalName,
            mimeType:read.mimeType,
            sizeBytes:read.sizeBytes,
            sha256:read.sha256,
            content:read.bytes
          });
        }
        const plaintext = emergencyCardCanonicalPayload({ prepared, documents });
        let encrypted:Buffer | undefined;
        try {
          encrypted = encryptPortableEmergencyPack({
            plaintext,
            passphrase:input.packagePassphrase,
            metadata:{ profileId:prepared.profileId, configurationId:prepared.configurationId, selectionSha256:prepared.selectionSha256 }
          });
          ({ artifactSha256, artifactSizeBytes } = writeEmergencyCardArtifactAtomically(artifactPath, encrypted));
          artifactCreated = true;
          const readback = readFileSync(artifactPath);
          try {
            const verified = verifyPortableEmergencyPackReadback({
              serialized:readback,
              passphrase:input.packagePassphrase,
              expectedPlaintextSha256:sha256Hex(plaintext)
            });
            if (verified.artifactSha256 !== artifactSha256 || verified.artifactSizeBytes !== artifactSizeBytes
              || verified.metadata.selectionSha256 !== prepared.selectionSha256) {
              throw new Error('Şifreli acil kart paketi exact okuma doğrulamasından geçmedi.');
            }
          } finally {
            readback.fill(0);
          }
        } finally {
          plaintext.fill(0);
          encrypted?.fill(0);
        }
        artifactReadbackStatus = 'verified';
      }

      const completionCorrelationId = createRuntimeCorrelationId('ipc');
      const completionCommon = {
        artifactSha256,
        artifactSizeBytes,
        powerSource,
        batteryLevel:'not_measured',
        automaticLowBatteryDetection:'not_performed',
        lowBatteryClaimed:false
      } as const;
      try {
        await store().completeEmergencyCardExport(
          prepared,
          input.mode === 'print'
            ? { ...completionCommon, artifactReadbackStatus:'not_applicable_print', printerDispatchStatus:'confirmed' }
            : { ...completionCommon, artifactReadbackStatus:'verified' },
          completionCorrelationId
        );
      } catch (error) {
        if (input.mode === 'print') {
          runtime().logger.error({
            timestamp:runtime().clock.now(), service:'desktop-main', process:'electron-main',
            event:'life.emergency_card_print_dispatched_completion_unrecorded',
            correlationId:completionCorrelationId, outcome:'failure',
            metadata:{ mode:'print', printerDispatchStatus:'confirmed', ledgerRecorded:false }
          });
        }
        throw error;
      }
      return Object.freeze({
        canceled:false as const,
        mode:input.mode,
        artifactSha256,
        artifactSizeBytes,
        powerSource,
        batteryLevel:'not_measured' as const,
        automaticLowBatteryDetection:'not_performed' as const,
        lowBatteryClaimed:false as const,
        artifactReadbackStatus,
        ...(printerDispatchStatus ? { printerDispatchStatus } : {})
      });
    } catch (error) {
      if (artifactCreated && artifactPath) rmSync(artifactPath, { force:true });
      throw error;
    } finally {
      for (const bytes of documentBytes) bytes.fill(0);
      if (printWindow && !printWindow.isDestroyed()) printWindow.destroy();
    }
  });
  registerIpcHandler('accessibility:getPreferences', () => store().getAccessibilityPreferences());
  registerIpcHandler('accessibility:updatePreferences', (_event, input:UpdateAccessibilityPreferencesInput) => store().updateAccessibilityPreferences(input));
  registerIpcHandler('formDraft:getWorkspace', (_event, formKey:string) => store().getFormDraftWorkspace(formKey));
  registerIpcHandler('formDraft:save', (_event, input:SaveFormDraftInput) => store().saveFormDraft(input));
  registerIpcHandler('formDraft:undo', (_event, input:UndoFormDraftInput) => store().undoFormDraft(input));
  registerIpcHandler(LOCAL_GOVERNED_OCR_IPC_CHANNELS.getCenter, async () =>
    projectLocalGovernedOcrCenterIpcView(await localGovernedOcrBridgeMethod('getLocalGovernedOcrCenter')()));
  registerIpcHandler(LOCAL_GOVERNED_OCR_IPC_CHANNELS.getResult, async (_event, input:LocalGovernedOcrResultReadIpcInput) =>
    projectLocalGovernedOcrResultIpcView(await localGovernedOcrBridgeMethod('getLocalGovernedOcrResult')(input)));
  registerIpcHandler(LOCAL_GOVERNED_OCR_IPC_CHANNELS.search, async (_event, input:LocalGovernedOcrSearchIpcInput) =>
    projectLocalGovernedOcrSearchIpcView(await localGovernedOcrBridgeMethod('searchLocalGovernedOcr')(input)));
  registerIpcHandler(LOCAL_GOVERNED_OCR_IPC_CHANNELS.create, async (_event, input:LocalGovernedOcrCreateIpcInput) =>
    projectLocalGovernedOcrMutationIpcView(await localGovernedOcrBridgeMethod('createLocalGovernedOcrJob')({
      ...input,
      sourceResourceType: 'archive_item'
    }), 'job_create'));
  registerIpcHandler(LOCAL_GOVERNED_OCR_IPC_CHANNELS.run, async (_event, input:LocalGovernedOcrJobMutationIpcInput) =>
    projectLocalGovernedOcrMutationIpcView(await localGovernedOcrBridgeMethod('runLocalGovernedOcrJob')(input), 'job_run'));
  registerIpcHandler(LOCAL_GOVERNED_OCR_IPC_CHANNELS.cancel, async (_event, input:LocalGovernedOcrJobMutationIpcInput) =>
    projectLocalGovernedOcrMutationIpcView(await localGovernedOcrBridgeMethod('cancelLocalGovernedOcrJob')(input), 'job_cancel'));
  registerIpcHandler(LOCAL_GOVERNED_OCR_IPC_CHANNELS.correct, async (_event, input:LocalGovernedOcrCorrectIpcInput) =>
    projectLocalGovernedOcrMutationIpcView(await localGovernedOcrBridgeMethod('correctLocalGovernedOcrResult')(input), 'result_correct'));
  registerIpcHandler(LOCAL_GOVERNED_OCR_IPC_CHANNELS.rerun, async (_event, input:LocalGovernedOcrRerunIpcInput) =>
    projectLocalGovernedOcrMutationIpcView(await localGovernedOcrBridgeMethod('rerunLocalGovernedOcrJob')(input), 'job_rerun'));
  registerIpcHandler(LOCAL_GOVERNED_OCR_IPC_CHANNELS.delete, async (_event, input:LocalGovernedOcrDeleteIpcInput) =>
    projectLocalGovernedOcrMutationIpcView(await localGovernedOcrBridgeMethod('deleteLocalGovernedOcrJob')(input), 'job_delete'));
  registerIpcHandler(LOCAL_GOVERNED_OCR_IPC_CHANNELS.setEnabled, async (_event, input:LocalGovernedOcrSetEnabledIpcInput) =>
    projectLocalGovernedOcrMutationIpcView(
      await localGovernedOcrBridgeMethod('setLocalGovernedOcrEnabled')(input),
      input.enabled ? 'processing_enable' : 'processing_disable'
    ));
  registerIpcHandler('identityAccess:getCenter',()=>store().getIdentityAccessCredentialCenter());
  registerIpcHandler('identityAccess:issueOperationToken',(_event,input:{readonly operationKind:IdentityAccessOperationKind})=>store().issueIdentityAccessOperationToken(input.operationKind));
  registerIpcHandler('identityAccess:beginPasskeyRegistration',(_event,input:{readonly clientOperationId:string})=>store().beginPasskeyRegistration({...input,relyingPartyId:IDENTITY_WEBAUTHN_RP_ID}));
  registerIpcHandler('identityAccess:beginPasskeyAuthentication',(_event,input:{readonly clientOperationId:string})=>store().beginPasskeyAuthentication({...input,relyingPartyId:IDENTITY_WEBAUTHN_RP_ID}));
  registerIpcHandler('identityAccess:completePasskeyRegistration',(_event,input:CompletePasskeyRegistrationRendererInput&{readonly ceremonyResponseId?:string})=>{
    const current=store();const auth=current.getAuthState();const accountId=current.currentAuthenticatedAccountId();const deviceId=auth.currentDeviceId;
    if(!deviceId||auth.trustedDevice!==true||!webAuthnCeremony)throw new Error('WebAuthn exact authenticated device binding is unavailable.');
    const ceremonyResponseId=randomUUID();webAuthnCeremony.storeRegistrationResponse({ceremonyResponseId,accountId:accountId as never,deviceId,expiresAt:new Date(Date.now()+300_000).toISOString()},input.response);
    return current.completePasskeyRegistration({expectedRevision:input.expectedRevision,clientOperationId:input.clientOperationId,challengeId:input.challengeId,ceremonyResponseId,displayName:input.displayName});
  });
  registerIpcHandler('identityAccess:authenticateWithPasskey',(_event,input:AuthenticateWithPasskeyRendererInput&{readonly ceremonyResponseId?:string})=>{
    const current=store();const auth=current.getAuthState();const accountId=current.currentAuthenticatedAccountId();const deviceId=auth.currentDeviceId;
    if(!deviceId||auth.trustedDevice!==true||!webAuthnCeremony)throw new Error('WebAuthn exact authenticated device binding is unavailable.');
    const ceremonyResponseId=randomUUID();webAuthnCeremony.storeAuthenticationResponse({ceremonyResponseId,accountId:accountId as never,deviceId,expiresAt:new Date(Date.now()+300_000).toISOString()},input.response);
    return current.authenticateWithPasskey({expectedRevision:input.expectedRevision,clientOperationId:input.clientOperationId,credentialId:input.credentialId,challengeId:input.challengeId,ceremonyResponseId});
  });
  registerIpcHandler('identityAccess:revokePasskey',(_event,input:RevokePasskeyInput&{readonly confirmation:string})=>store().revokePasskey({expectedRevision:input.expectedRevision,clientOperationId:input.clientOperationId,credentialId:input.credentialId,reason:input.reason}));
  registerIpcHandler('identityAccess:recoverLostPasskey',async(_event,input:Omit<RecoverLostPasskeyInput,'recoveryProofId'>&{readonly fallback?:{readonly password:string;readonly secondFactorCode?:string};readonly confirmation:string})=>{
    const current=store();const authentication=await current.reauthenticateWithWindowsHello(input.fallback?{fallback:input.fallback}:{});if(!authentication.authenticated)throw new Error('Lost-passkey recovery requires strong local reauthentication.');
    const accountId=current.currentAuthenticatedAccountId();const recoveryProofId=passkeyRecoveryRegistry.issue(accountId);
    return current.recoverLostPasskey({expectedRevision:input.expectedRevision,clientOperationId:input.clientOperationId,credentialId:input.credentialId,recoveryProofId});
  });
  registerIpcHandler('identityAccess:beginFederatedIdentityLink',async(_event,input:{readonly clientOperationId:string;readonly provider:FederatedIdentityProvider})=>{if(!oidcDeepLinkProtocolRegistered)throw new Error('OIDC deep-link protocol registration is unavailable.');const ceremony=await store().beginFederatedIdentityLink(input);const expiry=Date.parse(ceremony.expiresAt);if(!isSafeExternalHttpsUrl(ceremony.authorizationUrl)||!Number.isFinite(expiry)||expiry<=Date.now()||expiry-Date.now()>600_000)throw new Error('OIDC authorization URL main-issued binding is invalid.');for(const [url,expiresAt] of issuedOidcAuthorizationUrls)if(expiresAt<=Date.now())issuedOidcAuthorizationUrls.delete(url);if(issuedOidcAuthorizationUrls.size>=16)throw new Error('OIDC authorization URL registry quota exceeded.');restoreOidcDeepLinkBindings();issuedOidcAuthorizationUrls.set(ceremony.authorizationUrl,expiry);return ceremony;});
  registerIpcHandler('identityAccess:completeFederatedIdentityLink',async(_event,input:CompleteFederatedIdentityLinkRendererInput&{readonly verifiedFlowId?:string})=>{
    const current=store();if(!oidcFederatedIdentity)throw new Error('OIDC production adapter is unavailable.');const accountId=current.currentAuthenticatedAccountId();
    const captured=oidcDeepLinkCallbacks.take({flowId:input.flowId,provider:input.provider,accountId:String(accountId)});
    const verified=await oidcFederatedIdentity.acceptAuthorizationCallback({flowId:input.flowId,linkId:input.flowId,provider:input.provider,accountId:accountId as never,callbackUrl:captured.callbackUrl,correlationId:createRuntimeCorrelationId('ipc')});
    if(!verified.ok)throw new Error(`[${verified.error.code}] ${verified.error.message}`);
    return current.linkFederatedIdentity({expectedRevision:input.expectedRevision,clientOperationId:input.clientOperationId,provider:input.provider,verifiedFlowId:input.flowId});
  });
  registerIpcHandler('identityAccess:unlinkFederatedIdentity',(_event,input:UnlinkFederatedIdentityInput&{readonly confirmation:string})=>store().unlinkFederatedIdentity({expectedRevision:input.expectedRevision,clientOperationId:input.clientOperationId,linkId:input.linkId}));
  registerIpcHandler('identityAccess:issueTemporaryCredential',(_event,input:IssueTemporaryVerifiableCredentialInput&{readonly confirmation:string})=>store().issueTemporaryVerifiableCredential({expectedRevision:input.expectedRevision,clientOperationId:input.clientOperationId,kind:input.kind,purpose:input.purpose,audienceReference:input.audienceReference,disclosedClaims:input.disclosedClaims,notBefore:input.notBefore,expiresAt:input.expiresAt}));
  registerIpcHandler('identityAccess:revokeTemporaryCredential',(_event,input:RevokeTemporaryVerifiableCredentialInput&{readonly confirmation:string})=>store().revokeTemporaryVerifiableCredential({expectedRevision:input.expectedRevision,clientOperationId:input.clientOperationId,credentialId:input.credentialId,reason:input.reason}));
  registerIpcHandler('identityAccess:verifyTemporaryCredential',(_event,input:VerifyTemporaryVerifiableCredentialInput)=>store().verifyTemporaryVerifiableCredential(input));
  registerIpcHandler('identityAccess:createCompanionSnapshot',(_event,input:CreateReadOnlyCompanionSnapshotInput&{readonly clientOperationId:string;readonly confirmation:string})=>store().createReadOnlyCompanionSnapshot({clientOperationId:input.clientOperationId,trustedDeviceId:input.trustedDeviceId,requestedMode:input.requestedMode,...(input.knownSourceVersion===undefined?{}:{knownSourceVersion:input.knownSourceVersion})}));
  registerIpcHandler('privacyOwnership:getCenter', () => store().getPrivacyOwnershipCenter());
  registerIpcHandler('privacyOwnership:correctAiMemory', (_event, input:CorrectAiMemoryInput) => store().correctAiMemory(input));
  registerIpcHandler('privacyOwnership:restrictAiMemory', (_event, input:RestrictAiMemoryInput) => store().restrictAiMemory(input));
  registerIpcHandler('privacyOwnership:deleteAiMemory', (_event, input:DeleteAiMemoryInput) => store().deleteAiMemory(input));
  registerIpcHandler('privacyOwnership:expireAiMemory', (_event, input:ExpireAiMemoryInput) => store().expireAiMemory(input));
  registerIpcHandler('privacyOwnership:createRightsRequest', (_event, input:CreateDataRightsRequestInput) => store().createPrivacyRightsRequest(input));
  registerIpcHandler('privacyOwnership:updateRightsRequest', (_event, input:UpdateDataRightsRequestInput) => store().updatePrivacyRightsRequest(input));
  registerIpcHandler('privacyOwnership:createIncident', (_event, input:CreatePrivacyIncidentInput) => store().createPrivacyIncident(input));
  registerIpcHandler('privacyOwnership:updateIncident', (_event, input:UpdatePrivacyIncidentInput) => store().updatePrivacyIncident(input));
  registerIpcHandler('privacyOwnership:simulatePermission', (_event, input:SimulatePermissionVisibilityInput) => store().simulatePrivacyPermission(input));
  registerIpcHandler('privacyOwnership:exportEncrypted', async (_event, input:EncryptedPrivacyDataExportRendererInput) => {
    const selected = await dialog.showSaveDialog({
      title: 'Şifreli gizlilik verisi dışa aktarımını kaydet',
      defaultPath: `ParsYuva_Aile_Yasam_Merkezi_Gizlilik_Verileri_${new Date().toISOString().slice(0, 10)}.pptprivacy`,
      filters: [{ name: 'ParsYuva Aile Yaşam Merkezi Şifreli Gizlilik Verisi', extensions: ['pptprivacy'] }],
      properties: ['createDirectory']
    });
    if (selected.canceled || !selected.filePath) throw new PrivacyExportCancelledError();
    if (!isAbsolute(selected.filePath) || extname(selected.filePath).toLowerCase() !== '.pptprivacy') {
      throw new Error('Şifreli gizlilik dışa aktarım hedefi absolute ve .pptprivacy uzantılı olmalıdır.');
    }
    return store().exportEncryptedPrivacyData({
      requestId: input.requestId,
      passphrase: input.passphrase,
      destination: selected.filePath
    });
  });
  registerIpcHandler('finance:list', () => store().listFinanceRecords());
  registerIpcHandler('finance:create', (_event, input:CreateFinanceRecordInput) => store().createFinanceRecord(input));
  registerIpcHandler('finance:listBankInstitutions', () => store().listBankInstitutions());
  registerIpcHandler('finance:listBankAccounts', () => store().listBankAccounts());
  registerIpcHandler('finance:validateIban', (_event, input:ValidateIbanInput) => store().validateIban(input));
  registerIpcHandler('finance:createBankAccount', (_event, input:CreateBankAccountInput) => store().createBankAccount(input));
  registerIpcHandler('finance:listPaymentCards', () => store().listPaymentCards());
  registerIpcHandler('finance:createPaymentCard', (_event, input:CreatePaymentCardInput) => store().createPaymentCard(input));
  registerIpcHandler('finance:listLoanAccounts', () => store().listLoanAccounts());
  registerIpcHandler('finance:createLoanAccount', (_event, input:CreateLoanAccountInput) => store().createLoanAccount(input));
  registerIpcHandler('finance:recordLoanPayment', (_event, input:RecordLoanPaymentInput) => store().recordLoanPayment(input));
  registerIpcHandler('finance:getPlanningWorkspace', () => store().getFinancePlanningWorkspace());
  registerIpcHandler('finance:recordPlanningItem', (_event, input:RecordFinancePlanningItemInput) => store().recordFinancePlanningItem(input));
  registerIpcHandler('finance:getLongTermPortfolioWorkspace', () => store().getLongTermPortfolioWorkspace());
  registerIpcHandler('finance:recordLongTermPortfolioItem', (_event, input:RecordLongTermPortfolioItemInput) => store().recordLongTermPortfolioItem(input));
  registerIpcHandler('finance:selectImportFile', async (event) => {
    const result = await dialog.showOpenDialog({
      title: 'KontrollÃ¼ finans hareketi dosyasÄ±nÄ± seÃ§',
      properties: ['openFile'],
      filters: [{ name: 'Finans hareketleri', extensions: ['csv','tsv','xlsx','ofx','qfx'] }]
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const filePath = result.filePaths[0];
    const maximumBytes = 5 * 1024 * 1024;
    const descriptor = openSync(filePath, 'r');
    let bytes: Buffer;
    try {
      const metadata = fstatSync(descriptor);
      if (!metadata.isFile() || metadata.size < 1 || metadata.size > maximumBytes) {
        throw new Error('İçe aktarma dosyası normal bir dosya ve 1 bayt–5 MiB aralığında olmalıdır.');
      }
      bytes = Buffer.allocUnsafe(metadata.size);
      let offset = 0;
      while (offset < bytes.length) {
        const count = readSync(descriptor, bytes, offset, bytes.length - offset, offset);
        if (count === 0) throw new Error('İçe aktarma dosyası okunurken beklenmedik biçimde kısaldı.');
        offset += count;
      }
      const changed = fstatSync(descriptor);
      if (changed.size !== metadata.size || changed.mtimeMs !== metadata.mtimeMs) {
        throw new Error('İçe aktarma dosyası okunurken değişti; dosyayı yeniden seçin.');
      }
    } finally {
      closeSync(descriptor);
    }
    const preview = financeImportFileSessions.createFilePreview({
      fileName: basename(filePath),
      bytes,
      ownerToken: financeImportSessionOwnerToken(event)
    });
    return { canceled: false, preview };
  });
  registerIpcHandler('finance:previewOpenBankingSandbox', (event) =>
    financeImportFileSessions.createSandboxPreview(new Date(), financeImportSessionOwnerToken(event)));
  registerIpcHandler('finance:commitImportPreview', async (event, input: CommitFinanceImportPreviewInput) => {
    const ownerToken = financeImportSessionOwnerToken(event);
    const prepared = financeImportFileSessions.resolve(input, new Date(), ownerToken);
    const workspace = await store().commitFinanceImport(prepared);
    financeImportFileSessions.consume(input.previewId, ownerToken);
    return workspace;
  });
  registerIpcHandler('health:list', async () => store().listHealthRecords());
  registerIpcHandler('health:create', async (_event, input:CreateHealthRecordInput) => store().createHealthRecord(input));
  registerIpcHandler('health:listMedicationPlans', async () => store().listMedicationPlans());
  registerIpcHandler('health:createMedicationPlan', async (_event, input:CreateMedicationPlanInput) => store().createMedicationPlan(input));
  registerIpcHandler('health:listFamilyHistory', async () => store().listFamilyHealthHistory());
  registerIpcHandler('health:createFamilyHistory', async (_event, input:CreateFamilyHealthHistoryInput) => store().createFamilyHealthHistory(input));
  registerIpcHandler(HEALTH_CARE_COORDINATION_IPC_CHANNELS.getCenter, async (_event, input:{readonly ownerPersonId:string}) =>
    store().getHealthCareCoordinationCenter(input.ownerPersonId));
  registerIpcHandler(HEALTH_CARE_COORDINATION_IPC_CHANNELS.recordEntry, async (_event, input:RecordHealthCareEntryInput) =>
    store().recordHealthCareEntry(input));
  registerIpcHandler(HEALTH_CARE_COORDINATION_IPC_CHANNELS.upsertGrant, async (_event, input:UpsertHealthCareAccessGrantInput) =>
    store().upsertHealthCareAccessGrant(input));
  registerIpcHandler(HEALTH_CARE_COORDINATION_IPC_CHANNELS.revokeGrant, async (_event, input:RevokeHealthCareAccessGrantInput) =>
    store().revokeHealthCareAccessGrant(input));
  registerIpcHandler(HOUSEHOLD_OPERATIONS_IPC_CHANNELS.getCenter, async () =>
    store().getHouseholdOperationsCenter());
  registerIpcHandler(HOUSEHOLD_OPERATIONS_IPC_CHANNELS.createItem, async (_event, input:CreateHouseholdOperationItemInput) =>
    store().createHouseholdOperationItem(input));
  registerIpcHandler(HOUSEHOLD_OPERATIONS_IPC_CHANNELS.updateItem, async (_event, input:UpdateHouseholdOperationItemInput) =>
    store().updateHouseholdOperationItem(input));
  registerIpcHandler(HOUSEHOLD_OPERATIONS_IPC_CHANNELS.deleteItem, async (_event, input:DeleteHouseholdOperationItemInput) =>
    store().deleteHouseholdOperationItem(input));
  registerIpcHandler(CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.getCenter, async (_event, input:{readonly childPersonId:string}) =>
    store().getChildEducationCenter(input.childPersonId));
  registerIpcHandler(CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.createItem, async (_event, input:CreateChildEducationItemInput) =>
    store().createChildEducationItem(input));
  registerIpcHandler(CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.updateItem, async (_event, input:UpdateChildEducationItemInput) =>
    store().updateChildEducationItem(input));
  registerIpcHandler(CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.deleteItem, async (_event, input:DeleteChildEducationItemInput) =>
    store().deleteChildEducationItem(input));
  registerIpcHandler(PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.getCenter, async (_event,input:{readonly ownerPersonId:string})=>
    store().getPlacesTravelCenter(input.ownerPersonId));
  registerIpcHandler(PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.createItem, async (_event,input:CreatePlacesTravelItemInput)=>
    store().createPlacesTravelItem(input));
  registerIpcHandler(PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.updateItem, async (_event,input:UpdatePlacesTravelItemInput)=>
    store().updatePlacesTravelItem(input));
  registerIpcHandler(PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.deleteItem, async (_event,input:DeletePlacesTravelItemInput)=>
    store().deletePlacesTravelItem(input));
  registerIpcHandler(FAMILY_AI_ASSISTANT_IPC_CHANNELS.getCenter,async()=>store().getFamilyAiAssistantCenter());
  registerIpcHandler(FAMILY_AI_ASSISTANT_IPC_CHANNELS.getLocalModelStatus,async()=>store().getFamilyAiLocalModelStatus());
  registerIpcHandler(FAMILY_AI_ASSISTANT_IPC_CHANNELS.runLocalModel,async(_event,input:RunFamilyAiLocalModelInput)=>
    store().runFamilyAiLocalModel(input));
  registerIpcHandler(FAMILY_AI_ASSISTANT_IPC_CHANNELS.generate,async(_event,input:GenerateFamilyAiSuggestionInput)=>
    store().generateFamilyAiSuggestion(input));
  registerIpcHandler(FAMILY_AI_ASSISTANT_IPC_CHANNELS.review,async(_event,input:ReviewFamilyAiSuggestionInput)=>
    store().reviewFamilyAiSuggestion(input));
  registerIpcHandler(MEMORY_STUDIO_IPC_CHANNELS.getCenter,async()=>store().getMemoryStudioCenter());
  registerIpcHandler(MEMORY_STUDIO_IPC_CHANNELS.createRecord,async(_event,input:CreateMemoryStudioRecordInput)=>
    store().createMemoryStudioRecord(input));
  registerIpcHandler(MEMORY_STUDIO_IPC_CHANNELS.deleteRecord,async(_event,input:DeleteMemoryStudioRecordInput)=>
    store().deleteMemoryStudioRecord(input));
  registerIpcHandler(MEMORY_STUDIO_IPC_CHANNELS.createCapsule,async(_event,input:CreateMemoryTimeCapsuleInput)=>
    store().createMemoryTimeCapsule(input));
  registerIpcHandler(MEMORY_STUDIO_IPC_CHANNELS.reviewCapsule,async(_event,input:ReviewMemoryTimeCapsuleInput)=>
    store().reviewMemoryTimeCapsule(input));
  registerIpcHandler(MEMORY_STUDIO_IPC_CHANNELS.transitionCapsule,async(_event,input:TransitionMemoryTimeCapsuleInput)=>
    store().transitionMemoryTimeCapsule(input));
  registerIpcHandler(SMART_HOME_ENERGY_IPC_CHANNELS.getCenter,async()=>store().getSmartHomeEnergyCenter());
  registerIpcHandler(SMART_HOME_ENERGY_IPC_CHANNELS.grantCameraConsent,async(_event,input:GrantSmartHomeCameraConsentInput)=>
    store().grantSmartHomeCameraConsent(input));
  registerIpcHandler(SMART_HOME_ENERGY_IPC_CHANNELS.revokeCameraConsent,async(_event,input:RevokeSmartHomeCameraConsentInput)=>
    store().revokeSmartHomeCameraConsent(input));
  registerIpcHandler(SMART_HOME_ENERGY_IPC_CHANNELS.setProcessing,async(_event,input:SetSmartHomeProcessingInput)=>
    store().setSmartHomeProcessing(input));
  registerIpcHandler(SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.getCenter,async()=>store().getSignedPluginPlatformCenter());
  registerIpcHandler(SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.setDesiredState,async(_event,input:SetSignedPluginDesiredStateInput)=>
    store().setSignedPluginDesiredState(input));
  registerIpcHandler(SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.emergencyDisable,async(_event,input:EmergencyDisableSignedPluginInput)=>
    store().emergencyDisableSignedPlugin(input));
  registerIpcHandler(SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.rollback,async(_event,input:RollbackSignedPluginInput)=>
    store().rollbackSignedPlugin(input));
  registerIpcHandler(COMMUNICATION_SECURITY_IPC_CHANNELS.getCenter,async()=>store().getCommunicationSecurityCenter());
  registerIpcHandler(COMMUNICATION_SECURITY_IPC_CHANNELS.registerDeviceCredential,
    async(_event,input:{readonly clientOperationId:string;readonly expectedRevision:number})=>
      store().registerCommunicationDeviceCredential(input));
  registerIpcHandler(COMMUNICATION_SECURITY_IPC_CHANNELS.revokeDeviceCredential,
    async(_event,input:RevokeCommunicationDeviceCredentialInput)=>store().revokeCommunicationDeviceCredential(input));
  registerIpcHandler(COMMUNICATION_SECURITY_IPC_CHANNELS.createRoom,
    async(_event,input:CreateCommunicationRoomInput)=>store().createCommunicationRoom(input));
  registerIpcHandler(COMMUNICATION_SECURITY_IPC_CHANNELS.addMember,
    async(_event,input:AddCommunicationRoomMemberInput)=>store().addCommunicationRoomMember(input));
  registerIpcHandler(COMMUNICATION_SECURITY_IPC_CHANNELS.removeMember,
    async(_event,input:RemoveCommunicationRoomMemberInput)=>store().removeCommunicationRoomMember(input));
  registerIpcHandler(COMMUNICATION_SECURITY_IPC_CHANNELS.rekeyRoom,
    async(_event,input:RekeyCommunicationRoomAfterDeviceRevocationInput)=>
      store().rekeyCommunicationRoomAfterDeviceRevocation(input));
  registerIpcHandler(COMMUNICATION_SECURITY_IPC_CHANNELS.setHistoryAccess,
    async(_event,input:SetCommunicationHistoryAccessInput)=>store().setCommunicationHistoryAccess(input));
  registerIpcHandler(COMMUNICATION_SECURITY_IPC_CHANNELS.freezeRoom,
    async(_event,input:FreezeCommunicationRoomInput)=>store().freezeCommunicationRoom(input));
  registerIpcHandler(COMMUNICATION_MESSAGING_IPC_CHANNELS.getCenter,
    async()=>store().getCommunicationMessagingCenter());
  registerIpcHandler(COMMUNICATION_MESSAGING_IPC_CHANNELS.search,
    async(_event,input:SearchCommunicationMessagesInput)=>store().searchCommunicationMessages(input));
  registerIpcHandler(COMMUNICATION_MESSAGING_IPC_CHANNELS.getContent,
    async(_event,input:{readonly messageId:string})=>store().getCommunicationMessageContent(input.messageId));
  registerIpcHandler(COMMUNICATION_MESSAGING_IPC_CHANNELS.create,
    async(_event,input:CreateCommunicationMessageInput)=>store().createCommunicationMessage(input));
  registerIpcHandler(COMMUNICATION_MESSAGING_IPC_CHANNELS.edit,
    async(_event,input:EditCommunicationMessageInput)=>store().editCommunicationMessage(input));
  registerIpcHandler(COMMUNICATION_MESSAGING_IPC_CHANNELS.setLifecycle,
    async(_event,input:SetCommunicationMessageLifecycleInput)=>store().setCommunicationMessageLifecycle(input));
  registerIpcHandler(COMMUNICATION_MESSAGING_IPC_CHANNELS.annotate,
    async(_event,input:AnnotateCommunicationMessageInput)=>store().annotateCommunicationMessage(input));
  registerIpcHandler(COMMUNICATION_MESSAGING_IPC_CHANNELS.updateDelivery,
    async(_event,input:UpdateCommunicationDeliveryInput)=>store().updateCommunicationDelivery(input));
  registerIpcHandler(COMMUNICATION_MESSAGING_IPC_CHANNELS.setPresence,
    async(_event,input:SetCommunicationPresenceInput)=>store().setCommunicationPresence(input));
  registerIpcHandler(COMMUNICATION_MESSAGING_IPC_CHANNELS.setRetentionPolicy,
    async(_event,input:SetCommunicationRetentionPolicyInput)=>store().setCommunicationRetentionPolicy(input));
  registerIpcHandler(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.getCenter,
    async()=>store().getCommunicationFileSharingCenter());
  registerIpcHandler(COMMUNICATION_AUDIT_ARCHIVE_IPC_CHANNELS.getCenter,
    async()=>store().getCommunicationAuditArchiveCenter());
  registerIpcHandler(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.getSafePreview,
    async(_event,input:CommunicationFileSharingPreviewIpcInput)=>store().getCommunicationFileSafePreview(input.fileId));
  registerIpcHandler(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.selectAndPrepare,
    async(_event,input:CommunicationFileSharingSelectIpcInput)=>{
      const selection=await dialog.showOpenDialog({title:'Yerel olarak şifrelenecek iletişim dosyasını seç',
        properties:['openFile'],filters:[{name:'Desteklenen yerel dosyalar',
          extensions:['pdf','png','jpg','jpeg','gif','webp','mp4','m4a','mp3','wav','txt','json','csv']}]});
      if(selection.canceled||!selection.filePaths[0])return Object.freeze({canceled:true as const});
      const selected=readCommunicationFileForMainAuthority(selection.filePaths[0]);
      try{return await store().prepareCommunicationFile({...input,displayName:selected.displayName,
        mimeType:selected.mimeType,bytes:selected.bytes});}
      finally{selected.bytes.fill(0);}
    });
  registerIpcHandler(COMMUNICATION_FILE_SHARING_IPC_CHANNELS.apply,
    async(_event,input:CommunicationFileSharingApplyIpcInput)=>store().applyCommunicationFileSharingCommand(input));
  registerIpcHandler(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.getCenter,
    async()=>store().getCommunicationRealtimeCallingCenter());
  registerIpcHandler(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.create,
    async(_event,input:CreateCommunicationCallInput)=>store().createCommunicationCall(input));
  registerIpcHandler(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.runPreflight,
    async(_event,input:RunCommunicationCallPreflightInput)=>store().runCommunicationCallPreflight(input));
  registerIpcHandler(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.updateControls,
    async(_event,input:UpdateCommunicationCallControlsInput)=>store().updateCommunicationCallControls(input));
  registerIpcHandler(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.advance,
    async(_event,input:AdvanceCommunicationCallInput)=>store().advanceCommunicationCall(input));
  registerIpcHandler(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.setPreferences,
    async(_event,input:SetCommunicationCallPreferencesInput)=>store().setCommunicationCallPreferences(input));
  registerIpcHandler(COMMUNICATION_RECORDING_IPC_CHANNELS.getCenter,
    async()=>store().getCommunicationRecordingCenter());
  registerIpcHandler(COMMUNICATION_RECORDING_IPC_CHANNELS.createRequest,
    async(_event,input:CreateCommunicationRecordingRequestInput)=>store().createCommunicationRecordingRequest(input));
  registerIpcHandler(COMMUNICATION_RECORDING_IPC_CHANNELS.decideConsent,
    async(_event,input:DecideCommunicationRecordingConsentInput)=>store().decideCommunicationRecordingConsent(input));
  registerIpcHandler(COMMUNICATION_RECORDING_IPC_CHANNELS.withdrawConsent,
    async(_event,input:WithdrawCommunicationRecordingConsentInput)=>store().withdrawCommunicationRecordingConsent(input));
  registerIpcHandler(COMMUNICATION_RECORDING_IPC_CHANNELS.addLateJoiner,
    async(_event,input:AddCommunicationRecordingLateJoinerInput)=>store().addCommunicationRecordingLateJoiner(input));
  registerIpcHandler(COMMUNICATION_RECORDING_IPC_CHANNELS.setSegment,
    async(_event,input:SetCommunicationRecordingSegmentInput)=>store().setCommunicationRecordingSegment(input));
  registerIpcHandler(COMMUNICATION_RECORDING_IPC_CHANNELS.updateRetention,
    async(_event,input:UpdateCommunicationRecordingRetentionInput)=>store().updateCommunicationRecordingRetention(input));
  registerIpcHandler(COMMUNICATION_RECORDING_IPC_CHANNELS.requestDeletion,
    async(_event,input:RequestCommunicationRecordingDeletionInput)=>store().requestCommunicationRecordingDeletion(input));
  registerIpcHandler(LOCAL_TRANSLATION_IPC_CHANNELS.getCenter,async()=>store().getLocalTranslationCenter());
  registerIpcHandler(LOCAL_TRANSLATION_IPC_CHANNELS.updateProfile,
    async(_event,input:UpdateLocalTranslationProfileInput)=>store().updateLocalTranslationProfile(input));
  registerIpcHandler(LOCAL_TRANSLATION_IPC_CHANNELS.addDictionary,
    async(_event,input:AddLocalTranslationDictionaryEntryInput)=>store().addLocalTranslationDictionaryEntry(input));
  registerIpcHandler(LOCAL_TRANSLATION_IPC_CHANNELS.updateDictionary,
    async(_event,input:UpdateLocalTranslationDictionaryEntryInput)=>store().updateLocalTranslationDictionaryEntry(input));
  registerIpcHandler(LOCAL_TRANSLATION_IPC_CHANNELS.deleteDictionary,
    async(_event,input:DeleteLocalTranslationDictionaryEntryInput)=>store().deleteLocalTranslationDictionaryEntry(input));
  registerIpcHandler(LOCAL_TRANSLATION_IPC_CHANNELS.prepareRequest,
    async(_event,input:PrepareLocalTranslationRequestInput)=>store().prepareLocalTranslationRequest(input));
  registerIpcHandler(LOCAL_TRANSLATION_IPC_CHANNELS.recordCorrection,
    async(_event,input:RecordLocalTranslationCorrectionInput)=>store().recordLocalTranslationCorrection(input));
  registerIpcHandler(LOCAL_TRANSLATION_IPC_CHANNELS.cancelRequest,
    async(_event,input:CancelLocalTranslationRequestInput)=>store().cancelLocalTranslationRequest(input));
  registerIpcHandler(FAMILY_MEETING_IPC_CHANNELS.getCenter,async()=>
    projectFamilyMeetingCenterIpcView(await store().getFamilyMeetingCenter()));
  registerIpcHandler(FAMILY_MEETING_IPC_CHANNELS.getMinutes,async(_event,input:{readonly meetingId:string})=>
    projectFamilyMeetingMinutesIpcView(await store().getFamilyMeetingMinutes(input.meetingId)));
  registerIpcHandler(FAMILY_MEETING_IPC_CHANNELS.create,async(_event,input:CreateFamilyMeetingInput)=>
    projectFamilyMeetingMutationIpcView(await store().createFamilyMeeting(input),'meeting_create'));
  registerIpcHandler(FAMILY_MEETING_IPC_CHANNELS.updatePlan,async(_event,input:UpdateFamilyMeetingPlanInput)=>
    projectFamilyMeetingMutationIpcView(await store().updateFamilyMeetingPlan(input),'meeting_plan_update'));
  registerIpcHandler(FAMILY_MEETING_IPC_CHANNELS.setState,async(_event,input:SetFamilyMeetingStateInput)=>
    projectFamilyMeetingMutationIpcView(await store().setFamilyMeetingState(input),'meeting_state_update'));
  registerIpcHandler(FAMILY_MEETING_IPC_CHANNELS.upsertParticipant,async(_event,input:UpsertFamilyMeetingParticipantInput)=>
    projectFamilyMeetingMutationIpcView(await store().upsertFamilyMeetingParticipant(input),'participant_upsert'));
  registerIpcHandler(FAMILY_MEETING_IPC_CHANNELS.upsertAgenda,async(_event,input:UpsertFamilyMeetingAgendaItemInput)=>
    projectFamilyMeetingMutationIpcView(await store().upsertFamilyMeetingAgendaItem(input),'agenda_upsert'));
  registerIpcHandler(FAMILY_MEETING_IPC_CHANNELS.createPoll,async(_event,input:CreateFamilyMeetingPollInput)=>
    projectFamilyMeetingMutationIpcView(await store().createFamilyMeetingPoll(input),'poll_create'));
  registerIpcHandler(FAMILY_MEETING_IPC_CHANNELS.castVote,async(_event,input:CastFamilyMeetingVoteInput)=>
    projectFamilyMeetingMutationIpcView(await store().castFamilyMeetingVote(input),'vote_cast'));
  registerIpcHandler(FAMILY_MEETING_IPC_CHANNELS.recordDecision,async(_event,input:RecordFamilyMeetingDecisionInput)=>
    projectFamilyMeetingMutationIpcView(await store().recordFamilyMeetingDecision(input),'decision_record'));
  registerIpcHandler(FAMILY_MEETING_IPC_CHANNELS.upsertTask,async(_event,input:UpsertFamilyMeetingTaskInput)=>
    projectFamilyMeetingMutationIpcView(await store().upsertFamilyMeetingTask(input),'task_upsert'));
  registerIpcHandler(FAMILY_MEETING_IPC_CHANNELS.addCollaboration,async(_event,input:AddFamilyMeetingCollaborationInput)=>
    projectFamilyMeetingMutationIpcView(await store().addFamilyMeetingCollaboration(input),'collaboration_add'));
  registerIpcHandler(FAMILY_MEETING_IPC_CHANNELS.prepareAiMinutes,async(_event,input:PrepareFamilyMeetingAiMinutesInput)=>
    projectFamilyMeetingMutationIpcView(await store().prepareFamilyMeetingAiMinutes(input),'ai_minutes_prepare'));
  registerIpcHandler(FAMILY_MEETING_IPC_CHANNELS.finalizeMinutes,async(_event,input:FinalizeFamilyMeetingMinutesInput)=>
    projectFamilyMeetingMutationIpcView(await store().finalizeFamilyMeetingMinutes(input),'minutes_finalize'));
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
      filters: [{ name: 'ParsYuva Aile Yaşam Merkezi Aile Verisi', extensions: ['json'] }]
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
  registerIpcHandler('unifiedSearch:search', (_event, input: UnifiedAuthorizedSearchInput) =>
    store().searchUnifiedAuthorizedRecords(input));
  registerIpcHandler('archive:listVersions', (_event,itemId:string) => store().listArchiveVersions(itemId));
  registerIpcHandler('archive:listRelationEvidence', (_event,itemId:string) => store().listArchiveRelationEvidence(itemId));
  registerIpcHandler('archive:listRelationEvidenceHistory', (_event,itemId:string) => store().listArchiveRelationEvidenceHistory(itemId));
  registerIpcHandler('archive:addRelationEvidence', (_event,input:AddArchiveRelationEvidenceInput&{readonly clientOperationId:string}) => store().addArchiveRelationEvidence(input));
  registerIpcHandler('archive:removeRelationEvidence', (_event,input:RemoveArchiveRelationEvidenceInput&{readonly clientOperationId:string}) => store().removeArchiveRelationEvidence(input));
  registerIpcHandler('archive:addVersion', async (_event,input:AddArchiveItemVersionInput&{readonly clientOperationId:string}) => {
    const result=await dialog.showOpenDialog({title:'Yeni arşiv sürümünü seç',properties:['openFile']});
    if(result.canceled||!result.filePaths[0])return store().listArchiveVersions(input.itemId);
    return store().addArchiveItemVersionFile(result.filePaths[0],input);
  });
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
    const result=await dialog.showSaveDialog({title:'Parola korumalı tam yedeği kaydet',defaultPath:`ParsYuva_Aile_Yasam_Merkezi_${new Date().toISOString().slice(0,10)}.pptbackup`,filters:[{name:'ParsYuva Aile Yaşam Merkezi Tam Yedek',extensions:['pptbackup']}]});
    if(result.canceled||!result.filePath) return {canceled:true};
    store().exportFullBackup(result.filePath,input.password);
    return {canceled:false,filePath:result.filePath};
  });
  registerIpcHandler('backup:inspectFull', async (_event, input: { readonly password?: string }) => {
    const result=await dialog.showOpenDialog({title:'Tam yedeği güvenli biçimde incele',properties:['openFile'],filters:[{name:'ParsYuva Aile Yaşam Merkezi Tam Yedek',extensions:['pptbackup']}]});
    if(result.canceled||!result.filePaths[0]) return {canceled:true};
    return {canceled:false,filePath:result.filePaths[0],inspection:store().inspectFullBackup(result.filePaths[0],input.password)};
  });
  registerIpcHandler('backup:restoreFull', async (_event, input: { readonly password?: string }) => {
    const result=await dialog.showOpenDialog({title:'Tam yedekten geri yükle',properties:['openFile'],filters:[{name:'ParsYuva Aile Yaşam Merkezi Tam Yedek',extensions:['pptbackup']}]});
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
      defaultPath: `ParsYuva_Aile_Yasam_Merkezi_Aile_Yedek_${new Date().toISOString().slice(0, 10)}.pptbackup`,
      filters: [{ name: 'ParsYuva Aile Yaşam Merkezi Korumalı Yedek', extensions: ['pptbackup'] }]
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
      const communicationMessagingMaintenance=await current.maintainCommunicationMessagingLifecycle().catch((error:unknown)=>{
        current.recordDiagnostic('error','communication.messaging_maintenance_failed',
          'Mesaj saklama, presence süresi veya payload bakım çevrimi tamamlanamadı.',error instanceof Error?error.name:typeof error);
        return undefined;
      });
      if(communicationMessagingMaintenance&&(communicationMessagingMaintenance.failedOperations>0
        ||communicationMessagingMaintenance.rejectedPayloadFiles>0))current.recordDiagnostic('warning',
        'communication.messaging_maintenance_pending','Bazı mesajlaşma bakım adayları güvenle tamamlanamadığı için sonraki çevrime bırakıldı.',
        `failed=${communicationMessagingMaintenance.failedOperations};rejected=${communicationMessagingMaintenance.rejectedPayloadFiles}`);
      const communicationFileMaintenance=await current.maintainCommunicationFilePayloadVault().catch((error:unknown)=>{
        current.recordDiagnostic('error','communication.file_payload_maintenance_failed',
          'İletişim dosyası payload bakım çevrimi tamamlanamadı.',error instanceof Error?error.name:typeof error);
        return undefined;
      });
      if(communicationFileMaintenance&&communicationFileMaintenance.rejectedFiles>0)current.recordDiagnostic('warning',
        'communication.file_payload_maintenance_rejected','Bazı iletişim dosyası payload adayları güvenle sınıflandırılamadığı için korundu.',
        `scanned=${communicationFileMaintenance.scannedFiles};deleted=${communicationFileMaintenance.deletedFiles};rejected=${communicationFileMaintenance.rejectedFiles}`);
      const ocrAuthorization = await current.reconcileLocalGovernedOcrAuthorizations().catch((error: unknown) => {
        current.recordDiagnostic(
          'error',
          'ocr.authorization_reconciliation_cycle_failed',
          'Yerel OCR izin ve rıza uzlaştırma çevrimi tamamlanamadı.',
          error instanceof Error ? error.name : typeof error
        );
        return undefined;
      });
      if (ocrAuthorization && ocrAuthorization.failed > 0) {
        current.recordDiagnostic(
          'warning',
          'ocr.authorization_reconciliation_item_pending',
          'Bazı yerel OCR izin veya rıza iptalleri sonraki çevrimde yeniden denenecek.',
          `attempted=${ocrAuthorization.attempted};completed=${ocrAuthorization.completed};failed=${ocrAuthorization.failed}`
        );
      }
      const ocrRetention = await current.reconcileLocalGovernedOcrRetention().catch((error: unknown) => {
        current.recordDiagnostic(
          'error',
          'ocr.retention_reconciliation_cycle_failed',
          'Yerel OCR retention uzlaştırma çevrimi tamamlanamadı.',
          error instanceof Error ? error.name : typeof error
        );
        return undefined;
      });
      if (ocrRetention && ocrRetention.failed > 0) {
        current.recordDiagnostic(
          'warning',
          'ocr.retention_reconciliation_item_pending',
          'Bazı süresi dolan yerel OCR sonuçları sonraki çevrimde yeniden denenecek.',
          `attempted=${ocrRetention.attempted};completed=${ocrRetention.completed};failed=${ocrRetention.failed}`
        );
      }
      const ocrOrphans = await current.sweepLocalGovernedOcrOrphans().catch((error: unknown) => {
        current.recordDiagnostic(
          'error',
          'ocr.orphan_sweep_cycle_failed',
          'Yerel OCR orphan bakım çevrimi tamamlanamadı.',
          error instanceof Error ? error.name : typeof error
        );
        return undefined;
      });
      if (ocrOrphans && ocrOrphans.rejected > 0) {
        current.recordDiagnostic(
          'warning',
          'ocr.orphan_sweep_item_rejected',
          'Bazı yerel OCR sealed sonuçları canlı owner bağı doğrulanamadığı için korunarak sonraki çevrime bırakıldı.',
          `scanned=${ocrOrphans.scanned};deleted=${ocrOrphans.deleted};referenced=${ocrOrphans.referenced};rejected=${ocrOrphans.rejected}`
        );
      }
      const ocrRecovery = await current.resumePendingLocalGovernedOcrArchiveDeletions().catch((error: unknown) => {
        current.recordDiagnostic(
          'error',
          'ocr.source_deletion_recovery_cycle_failed',
          'Yerel OCR kaynak silme kurtarma çevrimi tamamlanamadı.',
          error instanceof Error ? error.name : typeof error
        );
        return undefined;
      });
      if (ocrRecovery && ocrRecovery.failed > 0) {
        current.recordDiagnostic(
          'warning',
          'ocr.source_deletion_recovery_item_pending',
          'Bazı yerel OCR kaynak silme işlemleri sonraki çevrimde yeniden denenecek.',
          `attempted=${ocrRecovery.attempted};completed=${ocrRecovery.completed};failed=${ocrRecovery.failed}`
        );
      }
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
    title: 'ParsYuva Aile Yaşam Merkezi - Güvenli Belge Önizleme',
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

function showPrimaryWindow(): void {
  const window = primaryWindow;
  if (!window || window.isDestroyed()) {
    createWindow();
    return;
  }
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function lockApplicationFromTray(): void {
  try {
    if (dataStore) dataStore.logout();
  } finally {
    financeImportFileSessions.clear();
    emergencyCardExportReauthenticationGuard.clearAll();
    offlineSensitiveCache.lock('NO_LEASE');
    try { sealUserDataSession(); } catch { /* renderer reload remains fail-closed */ }
  }
  const window = primaryWindow;
  if (window && !window.isDestroyed()) window.webContents.reload();
  showPrimaryWindow();
}

async function requestExplicitApplicationQuit(): Promise<void> {
  const options = {
    type: 'warning' as const,
    title: currentProductName,
    message: mainText('Uygulamayı tamamen kapatmak istiyor musunuz?', 'Do you want to quit the application completely?'),
    detail: mainText('Arka plan görevleri durdurulacak ve açık kullanıcı veri oturumu güvenle kilitlenecek.', 'Background tasks will stop and the open user-data session will be locked securely.'),
    buttons: [mainText('Tamamen kapat','Quit completely'), mainText('Vazgeç','Cancel')],
    defaultId: 1,
    cancelId: 1,
    noLink: true
  };
  const window = primaryWindow;
  const result = window && !window.isDestroyed()
    ? await dialog.showMessageBox(window, options)
    : await dialog.showMessageBox(options);
  if (result.response !== 0) return;
  explicitApplicationQuit = true;
  app.quit();
}

function createApplicationTray(): void {
  if (applicationTray) return;
  applicationTray = new Tray(join(currentDir, 'tray-icon.png'));
  applicationTray.setToolTip(currentProductName);
  applicationTray.setContextMenu(Menu.buildFromTemplate([
    { label: mainText('Uygulamayı aç','Open application'), click: () => showPrimaryWindow() },
    { label: mainText('Kilitle','Lock'), click: () => lockApplicationFromTray() },
    { type: 'separator' },
    { label: mainText('Tamamen kapat','Quit completely'), click: () => { void requestExplicitApplicationQuit(); } }
  ]));
  applicationTray.on('double-click', () => showPrimaryWindow());
}

function createWindow(): void {
  const configuredRendererUrl = process.env.PPT_RENDERER_URL;
  const rendererDocumentUrl = configuredRendererUrl
    ? normalizeTrustedRendererDocumentUrl(configuredRendererUrl, { allowLocalDevelopmentServer: !app.isPackaged })
    : normalizeTrustedRendererDocumentUrl(PRIMARY_RENDERER_DOCUMENT_URL, { allowLocalDevelopmentServer: false });
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 900,
    minHeight: 640,
    icon: join(currentDir, 'window-icon.ico'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#F7F3ED',
      symbolColor: '#5B5148',
      height: 42
    },
    roundedCorners: true,
    // Binding visual baseline: never flash the retired dark shell before the
    // renderer paints the warm-white Bronze onboarding surface.
    backgroundColor: '#FDFDFC',
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
    const expiresAt=issuedOidcAuthorizationUrls.get(url);if(expiresAt!==undefined)issuedOidcAuthorizationUrls.delete(url);
    if (expiresAt!==undefined&&expiresAt>Date.now()&&isSafeExternalHttpsUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.on('close', (event) => {
    if (explicitApplicationQuit) return;
    event.preventDefault();
    window.hide();
    if (!closeToTrayNoticeShown && applicationTray) {
      closeToTrayNoticeShown = true;
      applicationTray.displayBalloon({
        title: currentProductName,
        content: mainText('Uygulama tamamen kapanmadı; sistem tepsisinde çalışmaya devam ediyor.', 'The application did not quit; it is still running in the system tray.'),
        noSound: true
      });
    }
  });

  window.once('closed', () => {
    ipcTransportSessions.clearSender(primaryWebContentsId);
    ipcRequestLifecycles.clearSender(primaryWebContentsId);
    ipcReadResults.invalidateSender(primaryWebContentsId);
    ipcAdaptiveBudgetMaintenanceSessions.clearSender(primaryWebContentsId);
    emergencyCardExportReauthenticationGuard.clearAll();
    if (primaryWindow === window) primaryWindow = undefined;
    if (trustedRenderer?.webContentsId === primaryWebContentsId) trustedRenderer = undefined;
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.once('did-finish-load', async () => {
    const probePath = process.env.PPT_WINDOWS_LAUNCH_PROBE_PATH;
    if (probePath) {
      const rendererLocalization = await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
        const deadline = Date.now() + 15000;
        const inspect = () => {
          const loadingVisible = document.querySelector('.secure-startup-card .loader') !== null;
          const startupErrorVisible = document.querySelector('.secure-startup-error') !== null;
          const readySurface = document.querySelector('.auth-shell,.first-run-steps,.first-run-security-shell,.app-shell');
          const value = {
            bridgePresent: typeof window.pardus === 'object' && window.pardus !== null,
            localizationBootstrapMethodPresent: typeof window.pardus?.getLocalizationBootstrap === 'function',
            documentLanguage: document.documentElement.lang,
            dataLanguage: document.documentElement.dataset.uiLanguage ?? '',
            loadingVisible,
            startupErrorVisible,
            secureStartupReady: Boolean(readySurface) && !loadingVisible && !startupErrorVisible,
            readySurface: readySurface?.className ?? ''
          };
          if (value.localizationBootstrapMethodPresent && value.dataLanguage.length > 0 && value.secureStartupReady) resolve(value);
          else if (Date.now() >= deadline) reject(new Error('Renderer secure startup timed out.'));
          else setTimeout(inspect, 25);
        };
        inspect();
      })`, true) as {
        readonly bridgePresent: boolean;
        readonly localizationBootstrapMethodPresent: boolean;
        readonly documentLanguage: string;
        readonly dataLanguage: string;
        readonly loadingVisible:boolean;
        readonly startupErrorVisible:boolean;
        readonly secureStartupReady:boolean;
        readonly readySurface:string;
      };
      writeFileSync(probePath, `${JSON.stringify({
        status: 'PASS',
        applicationVersion: APP_META.version,
        uiLocalizationBootstrap,
        rendererLocalization,
        rendererDocumentUrl,
        webContentsId: window.webContents.id,
        startupSecurity: startupSecurityReport,
        rendererPolicy: startupSecurityReport?.rendererPolicy,
        windowsSecurityEvidence: windowsSecurityEvidenceReport,
        windowsOpen021EfsEvidence: windowsOpen021EfsEvidenceReport,
        windowsOpen022SideArtifactEvidence: windowsOpen022SideArtifactEvidenceReport,
        recordedAt: new Date().toISOString()
      }, null, 2)}\n`);
      if(process.env.PPT_WINDOWS_LAUNCH_TEST==='1')globalThis.setTimeout(()=>{
        explicitApplicationQuit=true;
        app.quit();
      },250);
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

app.on('second-instance', (_event,commandLine) => {
  captureOidcDeepLinkArguments(commandLine);
  showPrimaryWindow();
});

app.on('open-url',(event,url)=>{event.preventDefault();captureOidcDeepLinkArguments([url]);});

app.whenReady().then(async () => {
  uiLocalizationBootstrap = resolveMainUiLocalization(readUiLanguagePreference(uiLanguagePreferencePath()));
  if (uninstallBackupAssistantRequested) {
    const targets = await discoverUninstallBackupTargets({
      documentsPath: app.getPath('documents'), homePath: app.getPath('home'), environment: process.env
    });
    const targetLines = targets.map((target) => `• ${target.kind}: ${target.rootPath}`).join('\n');
    const decision = await dialog.showMessageBox({
      type: 'question', title: `${currentProductName} ${mainText('kaldırma yedeği','uninstall backup')}`,
      message: mainText('Şifreli kişisel veriler kaldırılmadan önce yedeklensin mi?','Should encrypted personal data be backed up before uninstalling?'),
      detail: `${mainText('Yedek aynı anda aşağıdaki kullanılabilir konumlara yazılacak ve SHA-256 ile doğrulanacak. Bulut istemcisinin gerçekten eşitlediği iddia edilmez.','The backup will be written to the available locations below at the same time and verified with SHA-256. Actual cloud synchronization is not claimed.')}\n\n${targetLines}`,
      buttons: [mainText('Yedekle ve kaldırmaya devam et','Back up and continue uninstalling'), mainText('İptal','Cancel')], defaultId: 1, cancelId: 1, noLink: true
    });
    if (decision.response !== 0) { app.exit(2); return; }
    const result = await createVerifiedUninstallBackups({
      userDataPath: app.getPath('userData'), targets, createdAt: new Date().toISOString(), applicationVersion: APP_META.version
    });
    await dialog.showMessageBox({
      type: 'info', title: `${currentProductName} ${mainText('kaldırma yedeği','uninstall backup')}`,
      message: result.status === 'no_data' ? mainText('Yedeklenecek kişisel veri bulunmadı.','No personal data was found to back up.') : mainText('Kaldırma yedekleri doğrulandı.','Uninstall backups were verified.'),
      detail: result.status === 'no_data' ? mainText('Kaldırma işlemine devam edilebilir.','Uninstalling can continue.') : mainText(`${result.copiedFiles} dosya, ${result.backupDirectories.length} hedefe doğrulanarak kopyalandı.`,`${result.copiedFiles} files were copied and verified across ${result.backupDirectories.length} destinations.`),
      buttons: [mainText('Tamam','OK')]
    });
    app.exit(0);
    return;
  }
  const rendererRoot = resolve(currentDir, '../renderer');
  const rendererMediaTypes=Object.freeze(new Map<string,string>([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],['.json','application/json; charset=utf-8'],['.svg','image/svg+xml'],['.png','image/png'],['.ico','image/x-icon'],['.woff2','font/woff2'],['.wasm','application/wasm']]));
  protocol.handle(PRIMARY_RENDERER_SCHEME, async (request) => {
    const offlineMapResponse = respondToOfflineFamilyMapRequest(request, app.getPath('userData'));
    if (offlineMapResponse) return offlineMapResponse;
    if (request.method !== 'GET') return new Response('Not found', { status: 404 });
    const candidate = resolvePrimaryRendererAssetPath(request.url, rendererRoot);
    if (!candidate) return new Response('Not found', { status: 404 });
    try{return new Response(new Uint8Array(await readFile(candidate)),{status:200,headers:{'content-type':rendererMediaTypes.get(extname(candidate).toLowerCase())??'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'}});}
    catch{return new Response('Not found',{status:404});}
  });
  startupStage = 'SAFE_STORAGE_INITIALIZATION';
  osSecretProtector = process.platform === 'win32'
    ? new WindowsDpapiDeviceSecretProtector({ required: true })
    : new ElectronSafeStorageDeviceSecretProtector(safeStorage, app.isPackaged);
  startupStage = 'PRODUCT_LICENSE_INITIALIZATION';
  const licenseTrust = JSON.parse(await readFile(join(currentDir, 'gold-activation-trust.json'), 'utf8')) as {
    readonly schemaVersion: number;
    readonly productId: string;
    readonly algorithm: string;
    readonly status: string;
    readonly publicKeyPem: string | null;
    readonly privateKeyInRepositoryAllowed: boolean;
  };
  if (licenseTrust.schemaVersion !== 1 || licenseTrust.productId !== 'tr.anadoluparsi.aileyasammerkezi'
    || licenseTrust.algorithm !== 'Ed25519' || licenseTrust.privateKeyInRepositoryAllowed !== false
    || (licenseTrust.publicKeyPem !== null && !licenseTrust.publicKeyPem.includes('BEGIN PUBLIC KEY'))) {
    throw new Error('Gold aktivasyon güven yapılandırması geçersiz.');
  }
  const licenseDeviceBinding = createHash('sha256').update([
    process.env.COMPUTERNAME ?? 'unknown-computer',
    process.env.USERDOMAIN ?? 'unknown-domain',
    process.env.USERNAME ?? 'unknown-user',
    app.getPath('home')
  ].join('\u0000'), 'utf8').digest('hex');
  const bindingOutputArgument = process.argv.find((argument) => argument.startsWith('--write-license-device-binding='));
  if (bindingOutputArgument) {
    const outputPath = bindingOutputArgument.slice('--write-license-device-binding='.length);
    if (!isAbsolute(outputPath) || existsSync(outputPath)) throw new Error('Cihaz bağı çıktı yolu mutlak ve yeni olmalıdır.');
    mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });
    writeFileSync(outputPath, `${licenseDeviceBinding}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    explicitApplicationQuit = true;
    app.quit();
    return;
  }
  const localLicenseRoot = join(process.env.LOCALAPPDATA ?? app.getPath('appData'), 'PPT', 'AYM-Lisans');
  const roamingLicenseRoot = join(app.getPath('appData'), 'Panthera-Pardus-Tulliana', 'AYM-Lisans');
  factoryResetManager = new FactoryResetManager({
    markerPath: join(localLicenseRoot, 'bekleyen-fabrika-ayari.pptreset'),
    protector: osSecretProtector,
    userDataPath: app.getPath('userData')
  });
  await factoryResetManager.executePending();
  const productReleaseChannel = USER_VISIBLE_APP_INFO.channel;
  productLicenseManager = new ProductLicenseManager({
    primaryPath: join(localLicenseRoot, 'lisans-kaydi.pptlicense'),
    anchorPath: join(roamingLicenseRoot, 'lisans-capa-kaydi.pptlicense'),
    protector: osSecretProtector,
    channel: productReleaseChannel,
    deviceBindingSha256: licenseDeviceBinding,
    ...(licenseTrust.status === 'PROVISIONED' && licenseTrust.publicKeyPem ? { goldPublicKeyPem: licenseTrust.publicKeyPem } : {})
  });
  let licenseStatus = await productLicenseManager.initialize();
  const activationArgument = process.argv.find((argument) => argument.startsWith('--install-gold-activation='));
  if (activationArgument) {
    const activationPath = activationArgument.slice('--install-gold-activation='.length);
    if (!isAbsolute(activationPath)) throw new Error('Gold aktivasyon dosyası mutlak bir yol olmalıdır.');
    const metadata = lstatSync(activationPath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || metadata.size < 64 || metadata.size > 4096) {
      throw new Error('Gold aktivasyon dosyası güvenilir değil.');
    }
    licenseStatus = await productLicenseManager.activateGold((await readFile(activationPath, 'utf8')).trim());
    await dialog.showMessageBox({ type: 'info', title: currentProductName, message: mainText('Gold aktivasyonu doğrulandı.','Gold activation was verified.'), detail: mainText('Bu cihaz için sınırsız kullanım etkinleştirildi.','Unlimited use was enabled for this device.'), buttons: [mainText('Tamam','OK')] });
    explicitApplicationQuit = true;
    app.quit();
    return;
  }
  if (!licenseStatus.allowed) {
    await dialog.showMessageBox({
      type: 'error', title: currentProductName, message: mainText('30 günlük kullanım süresi sona erdi.','The 30-day usage period has ended.'),
      detail: productReleaseChannel === 'Gold'
        ? mainText('Uygulamayı açmak için bu cihaza ait geçerli Gold aktivasyonunu ayrı yönetici aracıyla kurun.','Install a valid Gold activation for this device with the separate administrator tool to open the application.')
        : mainText(`${productReleaseChannel} sürümü süre sonunda kullanılamaz. Kişisel verileriniz silinmedi.`,`${productReleaseChannel} cannot be used after the trial period. Your personal data was not deleted.`),
      buttons: [mainText('Kapat','Close')]
    });
    explicitApplicationQuit = true;
    app.quit();
    return;
  }
  const scheduleLicenseRefresh = (): void => {
    const remaining = Math.max(60_000, Date.parse(productLicenseManager!.status().trialEndsAt) - Date.now() + 1_000);
    productLicenseTimer = setTimeout(async () => {
      try {
        const refreshed = await productLicenseManager!.refresh();
        if (!refreshed.allowed) {
          await dialog.showMessageBox({ type: 'error', title: currentProductName, message: mainText('Kullanım süresi sona erdi.','The usage period has ended.'), detail: mainText('Açık oturum güvenle kapatılıyor; kişisel verileriniz silinmeyecek.','The open session is being closed securely; your personal data will not be deleted.'), buttons: [mainText('Kapat','Close')] });
          explicitApplicationQuit = true;
          app.quit();
          return;
        }
        scheduleLicenseRefresh();
      } catch (error) {
        writeEarlyStartupFailureEvidence(error, 'product-license-refresh');
        explicitApplicationQuit = true;
        app.quit();
      }
    }, Math.min(remaining, 12 * 60 * 60_000));
    productLicenseTimer.unref();
  };
  scheduleLicenseRefresh();
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
  const coreServiceAuthorityPath = join(runtime().config.paths.secrets, 'core-service-connection.pptsecret');
  coreServiceCompanionManager = new CoreServiceCompanionManager({
    modulePath: join(currentDir, '../core-service/companion.js'),
    authorityPath: coreServiceAuthorityPath,
    provisioningPath: join(runtime().config.paths.secrets, 'core-service-device-provisioning.pptsecret'),
    policyJournalAuthorityPath: join(runtime().config.paths.data, 'core-service-policy-journal-authority.json'),
    protectedStore: runtime().protectedArtifacts,
    clock: () => runtime().clock.now(),
    fork: (modulePath, options) => utilityProcess.fork(modulePath, [], {
      env: options.env,
      execArgv: [...options.execArgv],
      stdio: options.stdio,
      serviceName: options.serviceName
    })
  });
  await coreServiceCompanionManager.start();
  coreServiceStartupConnection = await connectCoreServiceAtStartup({
    authorityPath: coreServiceAuthorityPath,
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
    createApplicationTray();
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
    showPrimaryWindow();
  });
}).catch((error: unknown) => {
  coreServiceCompanionManager?.dispose();
  coreServiceCompanionManager = undefined;
  exitAfterFatalStartupError(error, 'app.whenReady');
});

app.on('before-quit', () => {
  explicitApplicationQuit = true;
  if (productLicenseTimer) clearTimeout(productLicenseTimer);
  productLicenseTimer = undefined;
  coreServiceCompanionManager?.dispose();
  coreServiceCompanionManager = undefined;
  financeImportFileSessions.dispose();
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
  emergencyCardExportReauthenticationGuard.clearMemory();
  ipcAdaptiveResourceBudget.clear({ persist: false });
  applicationTray?.destroy();
  applicationTray = undefined;
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
    finally {
      // Chromium can retain Windows handles for session/cache files until the
      // BrowserWindow teardown is complete. Volatile cleanup must never turn a
      // normal application exit into an uncaught EPERM/EBUSY main-process error.
      try { rmSync(volatileRuntimeRoot, { recursive: true, force: true }); }
      catch { /* will-quit retries after all windows have closed */ }
    }
  }
});

app.on('will-quit', () => {
  try { rmSync(volatileRuntimeRoot, { recursive: true, force: true }); }
  catch { /* OS temporary-storage maintenance may remove a still-locked residue later. */ }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
