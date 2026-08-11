import type {
  PlatformPolicyAuthorization,
  PlatformPolicyClusterFenceSnapshot,
  PlatformPolicyReceipt,
  PlatformPolicyRequest
} from '@ppt/platform-policy';

export const CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION = 1 as const;
export const CORE_SERVICE_LOCAL_ADMIN_MAX_MESSAGE_BYTES = 64 * 1024;
export const CORE_SERVICE_APPLICATION_API_VERSION = 'v1' as const;

export interface CoreServiceHealthContract {
  readonly lifecycle: 'starting' | 'ready' | 'degraded' | 'stopping' | 'stopped';
  readonly role: 'standalone' | 'leader' | 'follower' | 'witness' | 'backup_only' | 'maintenance';
  readonly writable: boolean;
  readonly safeMode: boolean;
  readonly writeFenceEpoch: number;
  readonly policyVersion: string;
  readonly startedAt: string;
  readonly observedAt: string;
  readonly reasons: readonly string[];
}

export interface CoreServiceArchitectureContract {
  readonly schemaVersion: 1;
  readonly apiVersion: typeof CORE_SERVICE_APPLICATION_API_VERSION;
  readonly protocolVersion: typeof CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION;
  readonly processBoundary: 'headless-core-service';
  readonly ownership: {
    readonly process: 'core-service';
    readonly policyKernel: 'core-service';
    readonly applicationApi: 'core-service';
    readonly familyData: 'desktop-transition' | 'core-service';
    readonly deviceSecretProtection: 'detached' | 'core-service';
    readonly backup: 'desktop-transition';
    readonly sync: 'not-implemented';
  };
  readonly safety: {
    readonly familyDataCutover: 'blocked';
    readonly legacyDesktopDataActive: true;
    readonly automaticCutoverAllowed: false;
  };
  readonly supportedMethods: readonly CoreServiceLocalAdminMethod[];
  readonly requiredDesktopMethods: readonly CoreServiceLocalAdminMethod[];
}

export interface CoreServiceFamilyDataStatusContract {
  readonly schemaVersion: 1;
  readonly owner: 'desktop-transition' | 'core-service';
  readonly lifecycle: 'detached' | 'attaching' | 'ready' | 'sealing' | 'sealed' | 'failed';
  readonly mode: 'none' | 'read-only' | 'read-write';
  readonly writable: boolean;
  readonly epoch: number;
  readonly protectedSessionAttached: boolean;
  readonly persistentPathExposed: false;
  readonly reasons: readonly string[];
  readonly observedAt: string;
}

export interface CoreServiceDeviceSecretProtectionStatusContract {
  readonly schemaVersion: 1;
  readonly owner: 'detached' | 'core-service';
  readonly lifecycle: 'detached' | 'ready' | 'unavailable';
  readonly providerId: string | null;
  readonly required: boolean;
  readonly available: boolean;
  readonly secretMaterialExposed: false;
  readonly electronDependency: false;
  readonly reasons: readonly string[];
  readonly observedAt: string;
}

export type CoreServiceFamilyDataCutoverGateId =
  | 'END_TO_END_SECURITY_VALIDATION'
  | 'KEY_LIFECYCLE_PROOF'
  | 'SINGLE_WRITER_PROOF'
  | 'ROLLBACK_DRILL'
  | 'EXPLICIT_USER_CUTOVER_APPROVAL';

export const CORE_SERVICE_CUTOVER_READINESS_GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000' as const;

export interface CoreServiceFamilyDataCutoverReadinessEntryContract {
  readonly epoch: number;
  readonly gateId: CoreServiceFamilyDataCutoverGateId;
  readonly status: 'pass';
  readonly evidenceDigest: string;
  readonly previousHash: string;
  readonly entryHash: string;
  readonly acceptedAt: string;
}

export const canonicalizeCoreServiceCutoverReadinessEntry = (
  entry: Omit<CoreServiceFamilyDataCutoverReadinessEntryContract, 'entryHash'>
): string => JSON.stringify([
  1,
  entry.epoch,
  entry.gateId,
  entry.status,
  entry.evidenceDigest,
  entry.previousHash,
  entry.acceptedAt
]);

export interface CoreServiceFamilyDataCutoverReadinessStatusContract {
  readonly schemaVersion: 1;
  readonly mode: 'monotonic-evidence-no-cutover';
  readonly decision: 'blocked';
  readonly ledgerEpoch: number;
  readonly entryCount: number;
  readonly headHash: string;
  readonly verifierAttached: boolean;
  readonly trustedAnchorAttached: boolean;
  readonly integrity: 'verified';
  readonly acceptanceState: 'incomplete' | 'all-gates-pass-cutover-still-blocked';
  readonly allRequiredGatesPass: boolean;
  readonly cutoverAuthorityAttached: false;
  readonly automaticActivationAllowed: false;
  readonly persistentPathExposed: false;
  readonly secretMaterialExposed: false;
  readonly requiredGates: readonly {
    readonly id: CoreServiceFamilyDataCutoverGateId;
    readonly status: 'pending' | 'pass';
    readonly evidenceEpoch: number | null;
    readonly evidenceDigest: string | null;
  }[];
  readonly entries: readonly CoreServiceFamilyDataCutoverReadinessEntryContract[];
  readonly reasons: readonly string[];
  readonly observedAt: string;
}

export interface CoreServiceFamilyDataCutoverStatusContract {
  readonly schemaVersion: 1;
  readonly mode: 'coexistence-no-cutover';
  readonly decision: 'blocked';
  readonly cutoverEpoch: 0;
  readonly legacyDesktopDataActive: true;
  readonly realDataTransferAllowed: false;
  readonly writeOwnershipTransferAllowed: false;
  readonly automaticActivationAllowed: false;
  readonly cutoverAuthorityAttached: false;
  readonly persistentPathExposed: false;
  readonly secretMaterialExposed: false;
  readonly requiredGates: readonly {
    readonly id: CoreServiceFamilyDataCutoverGateId;
    readonly status: 'pending';
  }[];
  readonly reasons: readonly string[];
  readonly observedAt: string;
}

export interface CoreServiceLocalAdminRequest<TPayload = unknown> {
  readonly protocolVersion: typeof CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly method: CoreServiceLocalAdminMethod;
  readonly authenticationToken: string;
  readonly payload: TPayload;
}

export interface CoreServiceLocalAdminSuccess<TResult = unknown> {
  readonly protocolVersion: typeof CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly ok: true;
  readonly result: TResult;
}

export type CoreServiceLocalAdminErrorCode =
  | 'AUTHENTICATION_FAILED'
  | 'INVALID_REQUEST'
  | 'METHOD_NOT_ALLOWED'
  | 'MESSAGE_TOO_LARGE'
  | 'INTERNAL_ERROR';

export interface CoreServiceLocalAdminFailure {
  readonly protocolVersion: typeof CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly ok: false;
  readonly error: {
    readonly code: CoreServiceLocalAdminErrorCode;
    readonly message: string;
  };
}

export type CoreServiceLocalAdminResponse<TResult = unknown> =
  | CoreServiceLocalAdminSuccess<TResult>
  | CoreServiceLocalAdminFailure;

export interface PolicyAuthorizationContractPayload {
  readonly request: PlatformPolicyRequest;
  readonly nonce: string;
}

export interface PolicyAuthorizationContractResult {
  readonly effectiveRequest: PlatformPolicyRequest;
  readonly authorization: PlatformPolicyAuthorization;
  readonly fence: PlatformPolicyClusterFenceSnapshot;
}

export interface PolicyReceiptVerificationContractPayload {
  readonly request: PlatformPolicyRequest;
  readonly receipt: PlatformPolicyReceipt;
}

export interface PolicyReceiptVerificationContractResult {
  readonly valid: boolean;
  readonly fence: PlatformPolicyClusterFenceSnapshot;
}

export interface PolicyJournalCheckpointContractPayload {
  readonly journalSequence: number;
  readonly journalHeadHash: string;
  readonly journalSizeBytes: number;
}

export interface PolicyJournalCheckpointContractResult extends PolicyJournalCheckpointContractPayload {
  readonly schemaVersion: 1;
  readonly authorityEpoch: number;
  readonly checkpointHash: string;
  readonly acceptedAt: string;
}

export interface CoreServiceLocalAdminMethodMap {
  readonly 'architecture.get': {
    readonly payload: Record<string, never>;
    readonly result: CoreServiceArchitectureContract;
  };
  readonly 'health.get': {
    readonly payload: Record<string, never>;
    readonly result: CoreServiceHealthContract;
  };
  readonly 'family-data.status': {
    readonly payload: Record<string, never>;
    readonly result: CoreServiceFamilyDataStatusContract;
  };
  readonly 'device-secret-protection.status': {
    readonly payload: Record<string, never>;
    readonly result: CoreServiceDeviceSecretProtectionStatusContract;
  };
  readonly 'family-data-cutover.status': {
    readonly payload: Record<string, never>;
    readonly result: CoreServiceFamilyDataCutoverStatusContract;
  };
  readonly 'family-data-cutover-readiness.status': {
    readonly payload: Record<string, never>;
    readonly result: CoreServiceFamilyDataCutoverReadinessStatusContract;
  };
  readonly 'policy.authorize': {
    readonly payload: PolicyAuthorizationContractPayload;
    readonly result: PolicyAuthorizationContractResult;
  };
  readonly 'policy.verify': {
    readonly payload: PolicyReceiptVerificationContractPayload;
    readonly result: PolicyReceiptVerificationContractResult;
  };
  readonly 'policy-journal.checkpoint': {
    readonly payload: PolicyJournalCheckpointContractPayload;
    readonly result: PolicyJournalCheckpointContractResult;
  };
}

export type CoreServiceLocalAdminMethod = keyof CoreServiceLocalAdminMethodMap;
export type CoreServiceMethodPayload<TMethod extends CoreServiceLocalAdminMethod> =
  CoreServiceLocalAdminMethodMap[TMethod]['payload'];
export type CoreServiceMethodResult<TMethod extends CoreServiceLocalAdminMethod> =
  CoreServiceLocalAdminMethodMap[TMethod]['result'];

export const CORE_SERVICE_REQUIRED_DESKTOP_METHODS = Object.freeze([
  'architecture.get',
  'health.get',
  'family-data.status',
  'device-secret-protection.status',
  'family-data-cutover.status',
  'family-data-cutover-readiness.status',
  'policy.authorize',
  'policy.verify',
  'policy-journal.checkpoint'
] as const satisfies readonly CoreServiceLocalAdminMethod[]);

export type HealthRequest = CoreServiceLocalAdminRequest<Record<string, never>>;
export type HealthResponse = CoreServiceLocalAdminResponse<CoreServiceHealthContract>;
export type FamilyDataStatusRequest = CoreServiceLocalAdminRequest<Record<string, never>>;
export type FamilyDataStatusResponse = CoreServiceLocalAdminResponse<CoreServiceFamilyDataStatusContract>;
export type DeviceSecretProtectionStatusRequest = CoreServiceLocalAdminRequest<Record<string, never>>;
export type DeviceSecretProtectionStatusResponse = CoreServiceLocalAdminResponse<CoreServiceDeviceSecretProtectionStatusContract>;
export type FamilyDataCutoverStatusRequest = CoreServiceLocalAdminRequest<Record<string, never>>;
export type FamilyDataCutoverStatusResponse = CoreServiceLocalAdminResponse<CoreServiceFamilyDataCutoverStatusContract>;
export type FamilyDataCutoverReadinessStatusRequest = CoreServiceLocalAdminRequest<Record<string, never>>;
export type FamilyDataCutoverReadinessStatusResponse = CoreServiceLocalAdminResponse<CoreServiceFamilyDataCutoverReadinessStatusContract>;
export type ArchitectureRequest = CoreServiceLocalAdminRequest<Record<string, never>>;
export type ArchitectureResponse = CoreServiceLocalAdminResponse<CoreServiceArchitectureContract>;
export type PolicyAuthorizationRequest = CoreServiceLocalAdminRequest<PolicyAuthorizationContractPayload>;
export type PolicyAuthorizationResponse = CoreServiceLocalAdminResponse<PolicyAuthorizationContractResult>;
export type PolicyReceiptVerificationRequest = CoreServiceLocalAdminRequest<PolicyReceiptVerificationContractPayload>;
export type PolicyReceiptVerificationResponse = CoreServiceLocalAdminResponse<PolicyReceiptVerificationContractResult>;
export type PolicyJournalCheckpointRequest = CoreServiceLocalAdminRequest<PolicyJournalCheckpointContractPayload>;
export type PolicyJournalCheckpointResponse = CoreServiceLocalAdminResponse<PolicyJournalCheckpointContractResult>;
