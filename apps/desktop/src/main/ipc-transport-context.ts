export const IPC_TRANSPORT_SCHEMA_VERSION = 1 as const;

export const IPC_TRANSPORT_REVISION_KEYS = [
  'graph',
  'timeline',
  'personCatalog',
  'eventCatalog',
  'dashboard',
  'notifications',
  'archive'
] as const;

export type IpcTransportRevisionKey = typeof IPC_TRANSPORT_REVISION_KEYS[number];

export type IpcTransportRevisions = Readonly<Record<IpcTransportRevisionKey, number>>;

export interface IpcTransportRequestContext {
  readonly schemaVersion: typeof IPC_TRANSPORT_SCHEMA_VERSION;
  readonly rendererSessionId: string;
  readonly requestId: string;
  readonly sessionEpoch: number;
  readonly requestSequence: number;
  readonly channel: string;
  readonly revisions: IpcTransportRevisions;
}

export interface IpcTransportResponseEnvelope<TResult = unknown> {
  readonly schemaVersion: typeof IPC_TRANSPORT_SCHEMA_VERSION;
  readonly request: IpcTransportRequestContext;
  readonly correlationId: string;
  readonly result: TResult;
}

export type IpcTransportProtocolErrorCode =
  | 'INVALID_REQUEST_CONTEXT'
  | 'INVALID_RESPONSE_ENVELOPE'
  | 'CHANNEL_MISMATCH'
  | 'STALE_SESSION_EPOCH'
  | 'DUPLICATE_REQUEST_ID'
  | 'RESPONSE_REQUEST_MISMATCH'
  | 'REQUEST_TIMEOUT'
  | 'REQUEST_CANCELLED';

export class IpcTransportProtocolError extends Error {
  public override readonly name = 'IpcTransportProtocolError';

  public constructor(
    public readonly code: IpcTransportProtocolErrorCode,
    message: string
  ) {
    super(message);
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHANNEL_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*:[a-zA-Z][a-zA-Z0-9]*$/;
const MAX_EPOCH = 2_147_483_647;
const MAX_SEQUENCE = Number.MAX_SAFE_INTEGER;

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

const validInteger = (value: unknown, minimum: number, maximum: number): value is number =>
  Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;

export const createZeroIpcTransportRevisions = (): IpcTransportRevisions => ({
  graph: 0,
  timeline: 0,
  personCatalog: 0,
  eventCatalog: 0,
  dashboard: 0,
  notifications: 0,
  archive: 0
});

export const assertIpcTransportRevisions = (value: unknown): IpcTransportRevisions => {
  if (!isPlainRecord(value) || !hasExactKeys(value, IPC_TRANSPORT_REVISION_KEYS)) {
    throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'IPC revizyon bağlamı geçersiz.');
  }
  const revisions = createZeroIpcTransportRevisions() as Record<IpcTransportRevisionKey, number>;
  for (const key of IPC_TRANSPORT_REVISION_KEYS) {
    const revision = value[key];
    if (!validInteger(revision, 0, MAX_SEQUENCE)) {
      throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', `IPC revizyon değeri geçersiz: ${key}.`);
    }
    revisions[key] = revision;
  }
  return Object.freeze({ ...revisions });
};

export const assertIpcTransportRequestContext = (
  value: unknown,
  expectedChannel?: string
): IpcTransportRequestContext => {
  const keys = [
    'schemaVersion',
    'rendererSessionId',
    'requestId',
    'sessionEpoch',
    'requestSequence',
    'channel',
    'revisions'
  ] as const;
  if (!isPlainRecord(value) || !hasExactKeys(value, keys)) {
    throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'IPC istek bağlamı geçersiz.');
  }
  if (value.schemaVersion !== IPC_TRANSPORT_SCHEMA_VERSION) {
    throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'IPC istek bağlamı şema sürümü desteklenmiyor.');
  }
  if (typeof value.rendererSessionId !== 'string' || !UUID_PATTERN.test(value.rendererSessionId)) {
    throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'Renderer oturum kimliği geçersiz.');
  }
  if (typeof value.requestId !== 'string' || !UUID_PATTERN.test(value.requestId)) {
    throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'IPC istek kimliği geçersiz.');
  }
  if (!validInteger(value.sessionEpoch, 0, MAX_EPOCH)) {
    throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'IPC oturum çağı geçersiz.');
  }
  if (!validInteger(value.requestSequence, 1, MAX_SEQUENCE)) {
    throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'IPC istek sırası geçersiz.');
  }
  if (typeof value.channel !== 'string' || value.channel.length > 128 || !CHANNEL_PATTERN.test(value.channel)) {
    throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'IPC kanal adı geçersiz.');
  }
  if (expectedChannel !== undefined && value.channel !== expectedChannel) {
    throw new IpcTransportProtocolError('CHANNEL_MISMATCH', 'IPC istek bağlamı kanal ile uyuşmuyor.');
  }
  return Object.freeze({
    schemaVersion: IPC_TRANSPORT_SCHEMA_VERSION,
    rendererSessionId: value.rendererSessionId,
    requestId: value.requestId,
    sessionEpoch: value.sessionEpoch,
    requestSequence: value.requestSequence,
    channel: value.channel,
    revisions: assertIpcTransportRevisions(value.revisions)
  });
};

const sameRevisions = (left: IpcTransportRevisions, right: IpcTransportRevisions): boolean =>
  IPC_TRANSPORT_REVISION_KEYS.every((key) => left[key] === right[key]);

export const sameIpcTransportRequest = (
  left: IpcTransportRequestContext,
  right: IpcTransportRequestContext
): boolean => left.schemaVersion === right.schemaVersion
  && left.rendererSessionId === right.rendererSessionId
  && left.requestId === right.requestId
  && left.sessionEpoch === right.sessionEpoch
  && left.requestSequence === right.requestSequence
  && left.channel === right.channel
  && sameRevisions(left.revisions, right.revisions);

export const createIpcTransportResponseEnvelope = <TResult>(
  request: IpcTransportRequestContext,
  correlationId: string,
  result: TResult
): IpcTransportResponseEnvelope<TResult> => Object.freeze({
  schemaVersion: IPC_TRANSPORT_SCHEMA_VERSION,
  request,
  correlationId,
  result
});

export const unwrapIpcTransportResponse = <TResult>(input: {
  readonly expectedRequest: IpcTransportRequestContext;
  readonly currentSessionEpoch: number;
  readonly response: unknown;
}): TResult => {
  if (!isPlainRecord(input.response)
    || !hasExactKeys(input.response, ['schemaVersion', 'request', 'correlationId', 'result'])
    || input.response.schemaVersion !== IPC_TRANSPORT_SCHEMA_VERSION
    || typeof input.response.correlationId !== 'string'
    || input.response.correlationId.length < 8
    || input.response.correlationId.length > 160) {
    throw new IpcTransportProtocolError('INVALID_RESPONSE_ENVELOPE', 'IPC yanıt zarfı geçersiz.');
  }
  const responseRequest = assertIpcTransportRequestContext(input.response.request, input.expectedRequest.channel);
  if (!sameIpcTransportRequest(responseRequest, input.expectedRequest)) {
    throw new IpcTransportProtocolError('RESPONSE_REQUEST_MISMATCH', 'IPC yanıtı beklenen istek bağlamına ait değil.');
  }
  if (responseRequest.sessionEpoch !== input.currentSessionEpoch) {
    throw new IpcTransportProtocolError('STALE_SESSION_EPOCH', 'IPC yanıtı artık geçerli olmayan bir oturum çağına ait.');
  }
  return input.response.result as TResult;
};

export const mergeIpcTransportRevisions = (
  current: IpcTransportRevisions,
  candidate: unknown
): IpcTransportRevisions => {
  let revisions: IpcTransportRevisions;
  try {
    revisions = assertIpcTransportRevisions(candidate);
  } catch {
    return current;
  }
  const merged = createZeroIpcTransportRevisions() as Record<IpcTransportRevisionKey, number>;
  for (const key of IPC_TRANSPORT_REVISION_KEYS) merged[key] = Math.max(current[key], revisions[key]);
  return Object.freeze({ ...merged });
};

interface RendererTransportSessionState {
  rendererSessionId: string;
  highestEpoch: number;
  readonly seenRequestIds: Set<string>;
  readonly seenRequestOrder: string[];
}

export class IpcTransportSessionRegistry {
  readonly #sessions = new Map<number, RendererTransportSessionState>();

  public constructor(readonly maxSeenRequestIds = 2_048) {
    if (!Number.isInteger(maxSeenRequestIds) || maxSeenRequestIds < 64 || maxSeenRequestIds > 16_384) {
      throw new Error('IPC görülen istek kapasitesi 64 ile 16384 arasında olmalıdır.');
    }
  }

  public accept(senderId: number, channel: string, rawContext: unknown): IpcTransportRequestContext {
    if (!Number.isSafeInteger(senderId) || senderId < 0) {
      throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'IPC gönderici kimliği geçersiz.');
    }
    const context = assertIpcTransportRequestContext(rawContext, channel);
    let state = this.#sessions.get(senderId);
    if (!state || state.rendererSessionId !== context.rendererSessionId) {
      if (context.requestSequence !== 1) {
        throw new IpcTransportProtocolError('INVALID_REQUEST_CONTEXT', 'Yeni renderer oturumu ilk istek sırasıyla başlamadı.');
      }
      state = {
        rendererSessionId: context.rendererSessionId,
        highestEpoch: context.sessionEpoch,
        seenRequestIds: new Set<string>(),
        seenRequestOrder: []
      };
      this.#sessions.set(senderId, state);
    } else if (context.sessionEpoch < state.highestEpoch) {
      throw new IpcTransportProtocolError('STALE_SESSION_EPOCH', 'Eski renderer oturum çağından IPC isteği reddedildi.');
    } else if (context.sessionEpoch > state.highestEpoch) {
      state.highestEpoch = context.sessionEpoch;
      state.seenRequestIds.clear();
      state.seenRequestOrder.length = 0;
    }
    if (state.seenRequestIds.has(context.requestId)) {
      throw new IpcTransportProtocolError('DUPLICATE_REQUEST_ID', 'Yinelenen IPC istek kimliği reddedildi.');
    }
    state.seenRequestIds.add(context.requestId);
    state.seenRequestOrder.push(context.requestId);
    while (state.seenRequestOrder.length > this.maxSeenRequestIds) {
      const oldest = state.seenRequestOrder.shift();
      if (oldest) state.seenRequestIds.delete(oldest);
    }
    return context;
  }

  public clearSender(senderId: number): void {
    this.#sessions.delete(senderId);
  }

  public clearAll(): void {
    this.#sessions.clear();
  }
}
