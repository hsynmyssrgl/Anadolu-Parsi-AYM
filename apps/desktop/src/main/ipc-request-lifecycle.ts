import type { IpcMainInvokeEvent } from 'electron';
import { ERROR_CODES } from '@ppt/core';
import {
  IpcTransportProtocolError,
  assertIpcTransportRequestContext,
  type IpcTransportRequestContext
} from './ipc-transport-context.js';

export const IPC_REQUEST_CANCEL_CHANNEL = 'transport:cancel' as const;
export const IPC_REQUEST_CANCEL_ALL_CHANNEL = 'transport:cancelAll' as const;
export const IPC_REQUEST_LIFECYCLE_SCHEMA_VERSION = 1 as const;

export const countedStrongAuthenticationFailureCode = (
  error:unknown
):typeof ERROR_CODES.AUTH_INVALID_CREDENTIALS | typeof ERROR_CODES.AUTH_SECOND_FACTOR_INVALID | undefined => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith(`[${ERROR_CODES.AUTH_INVALID_CREDENTIALS}]`)) return ERROR_CODES.AUTH_INVALID_CREDENTIALS;
  if (message.startsWith(`[${ERROR_CODES.AUTH_SECOND_FACTOR_INVALID}]`)) return ERROR_CODES.AUTH_SECOND_FACTOR_INVALID;
  return undefined;
};

export type IpcRequestCancellationReason =
  | 'superseded'
  | 'timeout'
  | 'session-changed'
  | 'renderer-unloaded'
  | 'window-closed'
  | 'manual';

export interface IpcRequestCancelMessage {
  readonly schemaVersion: typeof IPC_REQUEST_LIFECYCLE_SCHEMA_VERSION;
  readonly rendererSessionId: string;
  readonly requestId: string;
  readonly sessionEpoch: number;
  readonly channel: string;
  readonly reason: IpcRequestCancellationReason;
}

export interface IpcRequestCancelAllMessage {
  readonly schemaVersion: typeof IPC_REQUEST_LIFECYCLE_SCHEMA_VERSION;
  readonly rendererSessionId: string;
  readonly sessionEpoch: number;
  readonly reason: Exclude<IpcRequestCancellationReason, 'superseded' | 'timeout'>;
}

export interface IpcRequestLifecyclePolicy {
  readonly cancellable: boolean;
  readonly latestWins: boolean;
  readonly timeoutMs: number;
}

const readLatestWinsChannels = new Set<string>([
  'data:getSnapshot',
  'data:getSnapshotSections',
  'dashboard:getOverview',
  'catalog:listPeople',
  'catalog:listEvents',
  'catalog:lookup',
  'largeData:tree',
  'largeData:timeline',
  'largeData:archive',
  'genealogy:insights',
  'archive:versions',
  'archive:search',
  'unifiedSearch:search',
  'timeline:listArchived'
]);
const formDraftReadChannels = new Set<string>([
  'formDraft:getWorkspace'
]);
const formDraftWriteChannels = new Set<string>([
  'formDraft:save',
  'formDraft:undo'
]);
const formDraftChannels = new Set<string>([
  ...formDraftReadChannels,
  ...formDraftWriteChannels
]);
const privacyOwnershipReadChannels = new Set<string>([
  'privacyOwnership:getCenter',
  'privacyOwnership:simulatePermission'
]);
const privacyOwnershipWriteChannels = new Set<string>([
  'privacyOwnership:correctAiMemory',
  'privacyOwnership:restrictAiMemory',
  'privacyOwnership:deleteAiMemory',
  'privacyOwnership:expireAiMemory',
  'privacyOwnership:createRightsRequest',
  'privacyOwnership:updateRightsRequest',
  'privacyOwnership:createIncident',
  'privacyOwnership:updateIncident',
  'privacyOwnership:exportEncrypted'
]);
const privacyOwnershipChannels = new Set<string>([
  ...privacyOwnershipReadChannels,
  ...privacyOwnershipWriteChannels
]);
const identityAccessReadChannels = new Set<string>([
  'identityAccess:getCenter',
  'identityAccess:verifyTemporaryCredential'
]);
const identityAccessWriteChannels = new Set<string>([
  'identityAccess:issueOperationToken',
  'identityAccess:beginPasskeyRegistration',
  'identityAccess:beginPasskeyAuthentication',
  'identityAccess:completePasskeyRegistration',
  'identityAccess:authenticateWithPasskey',
  'identityAccess:revokePasskey',
  'identityAccess:recoverLostPasskey',
  'identityAccess:beginFederatedIdentityLink',
  'identityAccess:completeFederatedIdentityLink',
  'identityAccess:unlinkFederatedIdentity',
  'identityAccess:issueTemporaryCredential',
  'identityAccess:revokeTemporaryCredential',
  'identityAccess:createCompanionSnapshot'
]);
const identityAccessChannels = new Set<string>([
  ...identityAccessReadChannels,
  ...identityAccessWriteChannels
]);
const localGovernedOcrReadChannels = new Set<string>([
  'localOcr:getCenter',
  'localOcr:getResult',
  'localOcr:search'
]);
const localGovernedOcrWriteChannels = new Set<string>([
  'localOcr:create',
  'localOcr:run',
  'localOcr:cancel',
  'localOcr:correct',
  'localOcr:rerun',
  'localOcr:delete',
  'localOcr:setEnabled'
]);
const localGovernedOcrChannels = new Set<string>([
  ...localGovernedOcrReadChannels,
  ...localGovernedOcrWriteChannels
]);
const archiveOwnershipReattestationChannels = new Set<string>([
  'archive:reattestLegacyOwnership'
]);
const archiveEvidenceReadChannels = new Set<string>([
  'archive:listRelationEvidence',
  'archive:listRelationEvidenceHistory'
]);
const archiveEvidenceWriteChannels = new Set<string>([
  'archive:addRelationEvidence',
  'archive:removeRelationEvidence',
  'archive:addVersion'
]);
const archiveEvidenceChannels = new Set<string>([
  ...archiveEvidenceReadChannels,
  ...archiveEvidenceWriteChannels
]);

const cancellableNetworkChannels = new Set<string>([
  'dataLifecycle:runRevocationSync'
]);
const cancellableInteractiveAuthenticationChannels = new Set<string>([
  'auth:enrollWindowsHello',
  'auth:loginWithWindowsHello',
  'auth:reauthenticateWithWindowsHello'
]);

export const resolveIpcRequestLifecyclePolicy = (channel: string): IpcRequestLifecyclePolicy => {
  if (archiveEvidenceReadChannels.has(channel)) {
    return Object.freeze({ cancellable: true, latestWins: true, timeoutMs: 10_000 });
  }
  if (archiveEvidenceWriteChannels.has(channel)) {
    return Object.freeze({ cancellable: false, latestWins: false, timeoutMs: 0 });
  }
  if (archiveOwnershipReattestationChannels.has(channel)) {
    return Object.freeze({ cancellable: false, latestWins: false, timeoutMs: 0 });
  }
  if (localGovernedOcrReadChannels.has(channel)) {
    return Object.freeze({ cancellable: true, latestWins: true, timeoutMs: 10_000 });
  }
  if (localGovernedOcrWriteChannels.has(channel)) {
    return Object.freeze({ cancellable: false, latestWins: false, timeoutMs: 0 });
  }
  if (identityAccessReadChannels.has(channel)) {
    return Object.freeze({ cancellable: true, latestWins: true, timeoutMs: 10_000 });
  }
  if (identityAccessWriteChannels.has(channel)) {
    return Object.freeze({ cancellable: false, latestWins: false, timeoutMs: 0 });
  }
  if (privacyOwnershipReadChannels.has(channel)) {
    return Object.freeze({ cancellable: true, latestWins: true, timeoutMs: 10_000 });
  }
  if (privacyOwnershipWriteChannels.has(channel)) {
    return Object.freeze({ cancellable: false, latestWins: false, timeoutMs: 0 });
  }
  if (formDraftReadChannels.has(channel)) {
    return Object.freeze({ cancellable: true, latestWins: true, timeoutMs: 10_000 });
  }
  if (formDraftWriteChannels.has(channel)) {
    return Object.freeze({ cancellable: false, latestWins: false, timeoutMs: 0 });
  }
  if (readLatestWinsChannels.has(channel)) {
    return Object.freeze({ cancellable: true, latestWins: true, timeoutMs: 30_000 });
  }
  if (cancellableNetworkChannels.has(channel)) {
    return Object.freeze({ cancellable: true, latestWins: true, timeoutMs: 45_000 });
  }
  if (cancellableInteractiveAuthenticationChannels.has(channel)) {
    return Object.freeze({ cancellable: true, latestWins: false, timeoutMs: 180_000 });
  }
  return Object.freeze({ cancellable: false, latestWins: false, timeoutMs: 0 });
};


export type IpcRequestAdmissionPriority = 'interactive' | 'standard' | 'background';

export interface IpcRequestAdmissionPolicy {
  readonly enabled: boolean;
  readonly priority: IpcRequestAdmissionPriority;
  readonly priorityWeight: number;
  readonly maxConcurrentPerSender: number;
  readonly maxConcurrentPerChannel: number;
  readonly maxQueuedPerSender: number;
  readonly queueTimeoutMs: number;
}

const interactiveAdmissionChannels = new Set<string>([
  'data:getSnapshot',
  'data:getSnapshotSections',
  'dashboard:getOverview',
  'catalog:listPeople',
  'catalog:listEvents',
  'catalog:lookup',
  'life:exportEmergencyCard'
]);

const standardAdmissionChannels = new Set<string>([
  'largeData:tree',
  'largeData:timeline',
  'largeData:archive',
  'genealogy:insights',
  'archive:versions',
  'archive:search',
  'unifiedSearch:search',
  'timeline:listArchived'
]);

export const resolveIpcRequestAdmissionPolicy = (channel: string): IpcRequestAdmissionPolicy => {
  if (archiveEvidenceChannels.has(channel)) {
    return Object.freeze({ enabled:true, priority:'interactive', priorityWeight:100, maxConcurrentPerSender:2, maxConcurrentPerChannel:1, maxQueuedPerSender:4, queueTimeoutMs:2_500 });
  }
  if (archiveOwnershipReattestationChannels.has(channel)) {
    return Object.freeze({ enabled:true, priority:'interactive', priorityWeight:100, maxConcurrentPerSender:2, maxConcurrentPerChannel:1, maxQueuedPerSender:4, queueTimeoutMs:2_500 });
  }
  if (localGovernedOcrChannels.has(channel)) {
    return Object.freeze({
      enabled: true,
      priority: 'interactive',
      priorityWeight: 100,
      maxConcurrentPerSender: 2,
      maxConcurrentPerChannel: 1,
      maxQueuedPerSender: 4,
      queueTimeoutMs: 2_500
    });
  }
  if (identityAccessChannels.has(channel)) {
    return Object.freeze({
      enabled: true,
      priority: 'interactive',
      priorityWeight: 100,
      maxConcurrentPerSender: 2,
      maxConcurrentPerChannel: 1,
      maxQueuedPerSender: 4,
      queueTimeoutMs: 2_500
    });
  }
  if (privacyOwnershipChannels.has(channel)) {
    return Object.freeze({
      enabled: true,
      priority: 'interactive',
      priorityWeight: 100,
      maxConcurrentPerSender: 2,
      maxConcurrentPerChannel: 1,
      maxQueuedPerSender: 4,
      queueTimeoutMs: 2_500
    });
  }
  if (formDraftChannels.has(channel)) {
    return Object.freeze({
      enabled: true,
      priority: 'interactive',
      priorityWeight: 100,
      maxConcurrentPerSender: 2,
      maxConcurrentPerChannel: 1,
      maxQueuedPerSender: 4,
      queueTimeoutMs: 2_500
    });
  }
  if (interactiveAdmissionChannels.has(channel)) {
    return Object.freeze({
      enabled: true,
      priority: 'interactive',
      priorityWeight: 100,
      maxConcurrentPerSender: 4,
      maxConcurrentPerChannel: 1,
      maxQueuedPerSender: 12,
      queueTimeoutMs: 4_000
    });
  }
  if (standardAdmissionChannels.has(channel)) {
    return Object.freeze({
      enabled: true,
      priority: 'standard',
      priorityWeight: 60,
      maxConcurrentPerSender: 4,
      maxConcurrentPerChannel: 1,
      maxQueuedPerSender: 12,
      queueTimeoutMs: 6_000
    });
  }
  if (cancellableNetworkChannels.has(channel)) {
    return Object.freeze({
      enabled: true,
      priority: 'background',
      priorityWeight: 20,
      maxConcurrentPerSender: 2,
      maxConcurrentPerChannel: 1,
      maxQueuedPerSender: 4,
      queueTimeoutMs: 10_000
    });
  }
  return Object.freeze({
    enabled: false,
    priority: 'standard',
    priorityWeight: 0,
    maxConcurrentPerSender: Number.MAX_SAFE_INTEGER,
    maxConcurrentPerChannel: Number.MAX_SAFE_INTEGER,
    maxQueuedPerSender: 0,
    queueTimeoutMs: 0
  });
};

export interface IpcRequestRatePolicy {
  readonly enabled: boolean;
  readonly maxRequestsPerWindow: number;
  readonly windowMs: number;
}

export const resolveIpcRequestRatePolicy = (channel: string): IpcRequestRatePolicy => {
  if (archiveEvidenceReadChannels.has(channel)) {
    return Object.freeze({ enabled: true, maxRequestsPerWindow: 60, windowMs: 60_000 });
  }
  if (archiveEvidenceWriteChannels.has(channel)) {
    return Object.freeze({ enabled: true, maxRequestsPerWindow: 16, windowMs: 60_000 });
  }
  if (channel === 'unifiedSearch:search') {
    return Object.freeze({ enabled: true, maxRequestsPerWindow: 60, windowMs: 60_000 });
  }
  if (archiveOwnershipReattestationChannels.has(channel)) {
    return Object.freeze({ enabled: true, maxRequestsPerWindow: 6, windowMs: 60_000 });
  }
  if (localGovernedOcrReadChannels.has(channel)) {
    return Object.freeze({ enabled: true, maxRequestsPerWindow: 60, windowMs: 60_000 });
  }
  if (localGovernedOcrWriteChannels.has(channel)) {
    return Object.freeze({ enabled: true, maxRequestsPerWindow: 12, windowMs: 60_000 });
  }
  if (identityAccessReadChannels.has(channel)) {
    return Object.freeze({ enabled: true, maxRequestsPerWindow: 120, windowMs: 60_000 });
  }
  if (identityAccessWriteChannels.has(channel)) {
    return Object.freeze({ enabled: true, maxRequestsPerWindow: 16, windowMs: 60_000 });
  }
  if (privacyOwnershipReadChannels.has(channel)) {
    return Object.freeze({ enabled: true, maxRequestsPerWindow: 120, windowMs: 60_000 });
  }
  if (privacyOwnershipWriteChannels.has(channel)) {
    return Object.freeze({ enabled: true, maxRequestsPerWindow: 24, windowMs: 60_000 });
  }
  if (formDraftReadChannels.has(channel)) {
    return Object.freeze({ enabled: true, maxRequestsPerWindow: 120, windowMs: 60_000 });
  }
  if (formDraftWriteChannels.has(channel)) {
    return Object.freeze({ enabled: true, maxRequestsPerWindow: 32, windowMs: 60_000 });
  }
  return Object.freeze({ enabled: false, maxRequestsPerWindow: Number.MAX_SAFE_INTEGER, windowMs: 0 });
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHANNEL_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*:[a-zA-Z][a-zA-Z0-9]*$/;
const cancellationReasons = new Set<IpcRequestCancellationReason>([
  'superseded',
  'timeout',
  'session-changed',
  'renderer-unloaded',
  'window-closed',
  'manual'
]);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const normalizedExpected = [...expected].sort();
  return actual.length === normalizedExpected.length
    && actual.every((key, index) => key === normalizedExpected[index]);
};

const assertCommonCancellationFields = (value: Record<string, unknown>): void => {
  if (value.schemaVersion !== IPC_REQUEST_LIFECYCLE_SCHEMA_VERSION) {
    throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'IPC iptal şema sürümü desteklenmiyor.');
  }
  if (typeof value.rendererSessionId !== 'string' || !UUID_PATTERN.test(value.rendererSessionId)) {
    throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'IPC iptal renderer oturum kimliği geçersiz.');
  }
  if (!Number.isSafeInteger(value.sessionEpoch) || Number(value.sessionEpoch) < 0 || Number(value.sessionEpoch) > 2_147_483_647) {
    throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'IPC iptal oturum çağı geçersiz.');
  }
  if (typeof value.reason !== 'string' || !cancellationReasons.has(value.reason as IpcRequestCancellationReason)) {
    throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'IPC iptal nedeni geçersiz.');
  }
};

export const assertIpcRequestCancelMessage = (value: unknown): IpcRequestCancelMessage => {
  const keys = ['schemaVersion', 'rendererSessionId', 'requestId', 'sessionEpoch', 'channel', 'reason'] as const;
  if (!isPlainRecord(value) || !hasExactKeys(value, keys)) {
    throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'IPC istek iptal mesajı geçersiz.');
  }
  assertCommonCancellationFields(value);
  if (typeof value.requestId !== 'string' || !UUID_PATTERN.test(value.requestId)) {
    throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'IPC iptal istek kimliği geçersiz.');
  }
  if (typeof value.channel !== 'string' || value.channel.length > 128 || !CHANNEL_PATTERN.test(value.channel)) {
    throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'IPC iptal kanal adı geçersiz.');
  }
  return Object.freeze({
    schemaVersion: IPC_REQUEST_LIFECYCLE_SCHEMA_VERSION,
    rendererSessionId: value.rendererSessionId as string,
    requestId: value.requestId as string,
    sessionEpoch: value.sessionEpoch as number,
    channel: value.channel as string,
    reason: value.reason as IpcRequestCancellationReason
  });
};

export const assertIpcRequestCancelAllMessage = (value: unknown): IpcRequestCancelAllMessage => {
  const keys = ['schemaVersion', 'rendererSessionId', 'sessionEpoch', 'reason'] as const;
  if (!isPlainRecord(value) || !hasExactKeys(value, keys)) {
    throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'IPC toplu iptal mesajı geçersiz.');
  }
  assertCommonCancellationFields(value);
  if (value.reason === 'superseded' || value.reason === 'timeout') {
    throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'Toplu IPC iptal nedeni geçersiz.');
  }
  return Object.freeze({
    schemaVersion: IPC_REQUEST_LIFECYCLE_SCHEMA_VERSION,
    rendererSessionId: value.rendererSessionId as string,
    sessionEpoch: value.sessionEpoch as number,
    reason: value.reason as IpcRequestCancelAllMessage['reason']
  });
};

export const createIpcRequestCancelMessage = (
  request: IpcTransportRequestContext,
  reason: IpcRequestCancellationReason
): IpcRequestCancelMessage => Object.freeze({
  schemaVersion: IPC_REQUEST_LIFECYCLE_SCHEMA_VERSION,
  rendererSessionId: request.rendererSessionId,
  requestId: request.requestId,
  sessionEpoch: request.sessionEpoch,
  channel: request.channel,
  reason
});

export const createIpcRequestCancelAllMessage = (
  rendererSessionId: string,
  sessionEpoch: number,
  reason: IpcRequestCancelAllMessage['reason']
): IpcRequestCancelAllMessage => assertIpcRequestCancelAllMessage({
  schemaVersion: IPC_REQUEST_LIFECYCLE_SCHEMA_VERSION,
  rendererSessionId,
  sessionEpoch,
  reason
});

export type IpcRequestAbortKind = 'cancelled' | 'timeout';

export class IpcRequestAbortedError extends Error {
  public override readonly name = 'IpcRequestAbortedError';

  public constructor(
    public readonly kind: IpcRequestAbortKind,
    public readonly reason: IpcRequestCancellationReason,
    public readonly requestId: string,
    public readonly channel: string
  ) {
    super(kind === 'timeout'
      ? `IPC isteği süre aşımına uğradı: ${channel}.`
      : `IPC isteği iptal edildi: ${channel}.`);
  }
}

interface ActiveIpcRequest {
  readonly senderId: number;
  readonly request: IpcTransportRequestContext;
  readonly policy: IpcRequestLifecyclePolicy;
  readonly controller: AbortController;
  readonly timeoutHandle?: ReturnType<typeof setTimeout>;
}

interface RunningIpcAdmission {
  readonly requestId: string;
  readonly channel: string;
}

interface QueuedIpcAdmission {
  readonly senderId: number;
  readonly request: IpcTransportRequestContext;
  readonly lifecyclePolicy: IpcRequestLifecyclePolicy;
  readonly admissionPolicy: IpcRequestAdmissionPolicy;
  readonly enqueuedAt: number;
  readonly resolve: (lease: IpcRequestLease) => void;
  readonly reject: (error: Error) => void;
  readonly timeoutHandle: ReturnType<typeof setTimeout>;
}

export interface IpcRequestAdmissionView {
  readonly queued: boolean;
  readonly waitMs: number;
  readonly priority: IpcRequestAdmissionPriority;
}

export interface IpcRequestLease {
  readonly signal: AbortSignal;
  readonly request: IpcTransportRequestContext;
  readonly admission: IpcRequestAdmissionView;
  run<TResult>(operation: Promise<TResult>): Promise<TResult>;
  complete(): void;
}

export type IpcRequestAdmissionErrorKind = 'queue-full' | 'queue-timeout' | 'rate-limit';

export class IpcRequestAdmissionError extends Error {
  public override readonly name = 'IpcRequestAdmissionError';

  public constructor(
    public readonly kind: IpcRequestAdmissionErrorKind,
    public readonly requestId: string,
    public readonly channel: string
  ) {
    super(kind === 'queue-full'
      ? `IPC geri basınç kuyruğu dolu: ${channel}.`
      : kind === 'rate-limit'
        ? `IPC istek hızı sınırı aşıldı: ${channel}.`
        : `IPC isteği geri basınç kuyruğunda süre aşımına uğradı: ${channel}.`);
  }
}

const abortSignalsByEvent = new WeakMap<object, AbortSignal>();
const requestContextsByEvent = new WeakMap<object, IpcTransportRequestContext>();

export const getIpcRequestAbortSignal = (event: IpcMainInvokeEvent): AbortSignal | undefined =>
  abortSignalsByEvent.get(event as unknown as object);

export const getIpcRequestContext = (event: IpcMainInvokeEvent): IpcTransportRequestContext | undefined =>
  requestContextsByEvent.get(event as unknown as object);

export class IpcRequestLifecycleRegistry {
  readonly #activeBySender = new Map<number, Map<string, ActiveIpcRequest>>();
  readonly #runningAdmissionsBySender = new Map<number, Map<string, RunningIpcAdmission>>();
  readonly #queuedAdmissionsBySender = new Map<number, QueuedIpcAdmission[]>();
  readonly #rateWindowsBySender = new Map<number, Map<string, { startedAt: number; count: number }>>();
  readonly #now: () => number;

  public constructor(options: { readonly now?: () => number } = {}) {
    this.#now = options.now ?? (() => Date.now());
  }

  public begin(
    senderId: number,
    rawRequest: IpcTransportRequestContext,
    policy = resolveIpcRequestLifecyclePolicy(rawRequest.channel)
  ): IpcRequestLease {
    if (!Number.isSafeInteger(senderId) || senderId < 0) {
      throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'IPC lifecycle gönderici kimliği geçersiz.');
    }
    const request = assertIpcTransportRequestContext(rawRequest, rawRequest.channel);
    let senderRequests = this.#activeBySender.get(senderId);
    if (!senderRequests) {
      senderRequests = new Map<string, ActiveIpcRequest>();
      this.#activeBySender.set(senderId, senderRequests);
    }
    if (senderRequests.has(request.requestId)) {
      throw new IpcTransportProtocolError('DUPLICATE_REQUEST_ID', 'IPC lifecycle içinde yinelenen istek kimliği reddedildi.');
    }
    const controller = new AbortController();
    const timeoutHandle = policy.cancellable && policy.timeoutMs > 0
      ? setTimeout(() => {
          controller.abort(new IpcRequestAbortedError('timeout', 'timeout', request.requestId, request.channel));
        }, policy.timeoutMs)
      : undefined;
    timeoutHandle?.unref?.();
    const active: ActiveIpcRequest = { senderId, request, policy, controller, ...(timeoutHandle ? { timeoutHandle } : {}) };
    senderRequests.set(request.requestId, active);
    let completed = false;
    const complete = (): void => {
      if (completed) return;
      completed = true;
      if (active.timeoutHandle) clearTimeout(active.timeoutHandle);
      const current = this.#activeBySender.get(senderId);
      current?.delete(request.requestId);
      if (current?.size === 0) this.#activeBySender.delete(senderId);
    };
    return Object.freeze({
      signal: controller.signal,
      request,
      admission: Object.freeze({ queued: false, waitMs: 0, priority: 'standard' as const }),
      run: async <TResult>(operation: Promise<TResult>): Promise<TResult> => {
        if (!policy.cancellable) return operation;
        if (controller.signal.aborted) throw this.#abortError(active);
        let removeAbortListener = (): void => undefined;
        const aborted = new Promise<never>((_resolve, reject) => {
          const listener = (): void => reject(this.#abortError(active));
          controller.signal.addEventListener('abort', listener, { once: true });
          removeAbortListener = () => controller.signal.removeEventListener('abort', listener);
        });
        try {
          return await Promise.race([operation, aborted]);
        } finally {
          removeAbortListener();
        }
      },
      complete
    });
  }

  public acquire(
    senderId: number,
    rawRequest: IpcTransportRequestContext,
    lifecyclePolicy = resolveIpcRequestLifecyclePolicy(rawRequest.channel),
    admissionPolicy = resolveIpcRequestAdmissionPolicy(rawRequest.channel),
    ratePolicy = resolveIpcRequestRatePolicy(rawRequest.channel)
  ): Promise<IpcRequestLease> {
    if (!Number.isSafeInteger(senderId) || senderId < 0) {
      return Promise.reject(new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'IPC admission gönderici kimliği geçersiz.'));
    }
    const request = assertIpcTransportRequestContext(rawRequest, rawRequest.channel);
    if (!admissionPolicy.enabled) return Promise.resolve(this.begin(senderId, request, lifecyclePolicy));
    if (this.#hasRequest(senderId, request.requestId)) {
      return Promise.reject(new IpcTransportProtocolError('DUPLICATE_REQUEST_ID', 'IPC admission içinde yinelenen istek kimliği reddedildi.'));
    }
    if (!this.#consumeRate(senderId, request.channel, ratePolicy)) {
      return Promise.reject(new IpcRequestAdmissionError('rate-limit', request.requestId, request.channel));
    }
    if (this.#canStart(senderId, request.channel, admissionPolicy)) {
      return Promise.resolve(this.#startAdmitted(senderId, request, lifecyclePolicy, admissionPolicy, false, Date.now()));
    }
    const queue = this.#queuedAdmissionsBySender.get(senderId) ?? [];
    if (queue.length >= admissionPolicy.maxQueuedPerSender) {
      return Promise.reject(new IpcRequestAdmissionError('queue-full', request.requestId, request.channel));
    }
    return new Promise<IpcRequestLease>((resolve, reject) => {
      const enqueuedAt = Date.now();
      const timeoutHandle = setTimeout(() => {
        const removed = this.#removeQueued(senderId, request.requestId);
        if (!removed) return;
        reject(new IpcRequestAdmissionError('queue-timeout', request.requestId, request.channel));
        this.#dispatch(senderId);
      }, admissionPolicy.queueTimeoutMs);
      queue.push({ senderId, request, lifecyclePolicy, admissionPolicy, enqueuedAt, resolve, reject, timeoutHandle });
      this.#queuedAdmissionsBySender.set(senderId, queue);
      this.#sortQueue(queue);
    });
  }

  public bindEvent(
    event: IpcMainInvokeEvent,
    signal: AbortSignal,
    request: IpcTransportRequestContext
  ): void {
    abortSignalsByEvent.set(event as unknown as object, signal);
    requestContextsByEvent.set(event as unknown as object, request);
  }

  public unbindEvent(event: IpcMainInvokeEvent): void {
    abortSignalsByEvent.delete(event as unknown as object);
    requestContextsByEvent.delete(event as unknown as object);
  }

  public cancel(senderId: number, rawMessage: unknown): boolean {
    const message = assertIpcRequestCancelMessage(rawMessage);
    const active = this.#activeBySender.get(senderId)?.get(message.requestId);
    if (active && active.policy.cancellable
      && active.request.rendererSessionId === message.rendererSessionId
      && active.request.sessionEpoch === message.sessionEpoch
      && active.request.channel === message.channel) {
      if (!active.controller.signal.aborted) {
        active.controller.abort(new IpcRequestAbortedError(
          message.reason === 'timeout' ? 'timeout' : 'cancelled',
          message.reason,
          active.request.requestId,
          active.request.channel
        ));
      }
      return true;
    }
    const queued = this.#findQueued(senderId, message.requestId);
    if (!queued
      || queued.request.rendererSessionId !== message.rendererSessionId
      || queued.request.sessionEpoch !== message.sessionEpoch
      || queued.request.channel !== message.channel) return false;
    this.#removeQueued(senderId, message.requestId);
    queued.reject(new IpcRequestAbortedError(
      message.reason === 'timeout' ? 'timeout' : 'cancelled',
      message.reason,
      queued.request.requestId,
      queued.request.channel
    ));
    this.#dispatch(senderId);
    return true;
  }

  public cancelAll(senderId: number, rawMessage: unknown): number {
    const message = assertIpcRequestCancelAllMessage(rawMessage);
    const active = this.#activeBySender.get(senderId);
    let cancelled = 0;
    if (active) {
      for (const request of active.values()) {
        if (!request.policy.cancellable
          || request.request.rendererSessionId !== message.rendererSessionId
          || request.request.sessionEpoch !== message.sessionEpoch) continue;
        if (!request.controller.signal.aborted) {
          request.controller.abort(new IpcRequestAbortedError(
            'cancelled',
            message.reason,
            request.request.requestId,
            request.request.channel
          ));
          cancelled += 1;
        }
      }
    }
    const queue = [...(this.#queuedAdmissionsBySender.get(senderId) ?? [])];
    for (const queued of queue) {
      if (queued.request.rendererSessionId !== message.rendererSessionId
        || queued.request.sessionEpoch !== message.sessionEpoch) continue;
      this.#removeQueued(senderId, queued.request.requestId);
      queued.reject(new IpcRequestAbortedError('cancelled', message.reason, queued.request.requestId, queued.request.channel));
      cancelled += 1;
    }
    this.#dispatch(senderId);
    return cancelled;
  }

  public clearSender(senderId: number): number {
    const active = this.#activeBySender.get(senderId);
    let cancelled = 0;
    if (active) {
      for (const request of active.values()) {
        if (!request.policy.cancellable || request.controller.signal.aborted) continue;
        request.controller.abort(new IpcRequestAbortedError(
          'cancelled',
          'window-closed',
          request.request.requestId,
          request.request.channel
        ));
        cancelled += 1;
      }
    }
    const queue = [...(this.#queuedAdmissionsBySender.get(senderId) ?? [])];
    for (const queued of queue) {
      this.#removeQueued(senderId, queued.request.requestId);
      queued.reject(new IpcRequestAbortedError('cancelled', 'window-closed', queued.request.requestId, queued.request.channel));
      cancelled += 1;
    }
    this.#queuedAdmissionsBySender.delete(senderId);
    this.#rateWindowsBySender.delete(senderId);
    return cancelled;
  }

  public activeCount(senderId?: number): number {
    if (senderId !== undefined) return this.#activeBySender.get(senderId)?.size ?? 0;
    let total = 0;
    for (const requests of this.#activeBySender.values()) total += requests.size;
    return total;
  }

  public queuedCount(senderId?: number): number {
    if (senderId !== undefined) return this.#queuedAdmissionsBySender.get(senderId)?.length ?? 0;
    let total = 0;
    for (const requests of this.#queuedAdmissionsBySender.values()) total += requests.length;
    return total;
  }

  #hasRequest(senderId: number, requestId: string): boolean {
    return (this.#activeBySender.get(senderId)?.has(requestId) ?? false)
      || this.#findQueued(senderId, requestId) !== undefined;
  }

  #consumeRate(senderId: number, channel: string, policy: IpcRequestRatePolicy): boolean {
    if (!policy.enabled) return true;
    const now = this.#now();
    let sender = this.#rateWindowsBySender.get(senderId);
    if (!sender) {
      sender = new Map();
      this.#rateWindowsBySender.set(senderId, sender);
    }
    const current = sender.get(channel);
    if (!current || now - current.startedAt >= policy.windowMs || now < current.startedAt) {
      sender.set(channel, { startedAt: now, count: 1 });
      return true;
    }
    if (current.count >= policy.maxRequestsPerWindow) return false;
    current.count += 1;
    return true;
  }

  #canStart(senderId: number, channel: string, policy: IpcRequestAdmissionPolicy): boolean {
    const running = this.#runningAdmissionsBySender.get(senderId);
    const senderCount = running?.size ?? 0;
    let channelCount = 0;
    for (const item of running?.values() ?? []) if (item.channel === channel) channelCount += 1;
    return senderCount < policy.maxConcurrentPerSender && channelCount < policy.maxConcurrentPerChannel;
  }

  #startAdmitted(
    senderId: number,
    request: IpcTransportRequestContext,
    lifecyclePolicy: IpcRequestLifecyclePolicy,
    admissionPolicy: IpcRequestAdmissionPolicy,
    queued: boolean,
    enqueuedAt: number
  ): IpcRequestLease {
    let running = this.#runningAdmissionsBySender.get(senderId);
    if (!running) {
      running = new Map<string, RunningIpcAdmission>();
      this.#runningAdmissionsBySender.set(senderId, running);
    }
    running.set(request.requestId, { requestId: request.requestId, channel: request.channel });
    let base: IpcRequestLease;
    try {
      base = this.begin(senderId, request, lifecyclePolicy);
    } catch (error) {
      running.delete(request.requestId);
      if (running.size === 0) this.#runningAdmissionsBySender.delete(senderId);
      this.#dispatch(senderId);
      throw error;
    }
    let released = false;
    return Object.freeze({
      signal: base.signal,
      request: base.request,
      admission: Object.freeze({
        queued,
        waitMs: queued ? Math.max(0, Date.now() - enqueuedAt) : 0,
        priority: admissionPolicy.priority
      }),
      run: base.run,
      complete: (): void => {
        if (released) return;
        released = true;
        base.complete();
        const current = this.#runningAdmissionsBySender.get(senderId);
        current?.delete(request.requestId);
        if (current?.size === 0) this.#runningAdmissionsBySender.delete(senderId);
        this.#dispatch(senderId);
      }
    });
  }

  #dispatch(senderId: number): void {
    const queue = this.#queuedAdmissionsBySender.get(senderId);
    if (!queue?.length) {
      this.#queuedAdmissionsBySender.delete(senderId);
      return;
    }
    this.#sortQueue(queue);
    let madeProgress = true;
    while (madeProgress && queue.length > 0) {
      madeProgress = false;
      const index = queue.findIndex((queued) => this.#canStart(senderId, queued.request.channel, queued.admissionPolicy));
      if (index < 0) break;
      const [queued] = queue.splice(index, 1);
      if (!queued) break;
      clearTimeout(queued.timeoutHandle);
      try {
        queued.resolve(this.#startAdmitted(
          senderId,
          queued.request,
          queued.lifecyclePolicy,
          queued.admissionPolicy,
          true,
          queued.enqueuedAt
        ));
      } catch (error) {
        queued.reject(error instanceof Error ? error : new Error(String(error)));
      }
      madeProgress = true;
    }
    if (queue.length === 0) this.#queuedAdmissionsBySender.delete(senderId);
  }

  #sortQueue(queue: QueuedIpcAdmission[]): void {
    queue.sort((left, right) => right.admissionPolicy.priorityWeight - left.admissionPolicy.priorityWeight
      || left.request.requestSequence - right.request.requestSequence
      || left.enqueuedAt - right.enqueuedAt);
  }

  #findQueued(senderId: number, requestId: string): QueuedIpcAdmission | undefined {
    return this.#queuedAdmissionsBySender.get(senderId)?.find((item) => item.request.requestId === requestId);
  }

  #removeQueued(senderId: number, requestId: string): QueuedIpcAdmission | undefined {
    const queue = this.#queuedAdmissionsBySender.get(senderId);
    if (!queue) return undefined;
    const index = queue.findIndex((item) => item.request.requestId === requestId);
    if (index < 0) return undefined;
    const [removed] = queue.splice(index, 1);
    if (removed) clearTimeout(removed.timeoutHandle);
    if (queue.length === 0) this.#queuedAdmissionsBySender.delete(senderId);
    return removed;
  }

  #abortError(active: ActiveIpcRequest): IpcRequestAbortedError {
    const reason = active.controller.signal.reason;
    return reason instanceof IpcRequestAbortedError
      ? reason
      : new IpcRequestAbortedError('cancelled', 'manual', active.request.requestId, active.request.channel);
  }
}
