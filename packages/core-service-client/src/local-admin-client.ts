import { randomUUID } from 'node:crypto';
import { createConnection, type Socket } from 'node:net';
import {
  CORE_SERVICE_APPLICATION_API_VERSION,
  CORE_SERVICE_APPLICATION_ID,
  CORE_SERVICE_LOCAL_ADMIN_CLIENT_APPLICATION_ID,
  CORE_SERVICE_LOCAL_ADMIN_ERROR_CODES,
  CORE_SERVICE_LOCAL_ADMIN_MAX_MESSAGE_BYTES,
  CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION,
  type CoreServiceApiBoundaryStatusContract,
  type CoreServiceArchitectureContract,
  type CoreServiceDeviceSecretProtectionStatusContract,
  type CoreServiceFamilyDataCutoverReadinessStatusContract,
  type CoreServiceFamilyDataCutoverStatusContract,
  type CoreServiceHealthContract,
  type CoreServiceFamilyDataStatusContract,
  type CoreServiceLocalAdminMethod,
  type CoreServiceMethodPayload,
  type CoreServiceMethodResult,
  type CoreServiceLocalAdminRequest,
  type CoreServiceLocalAdminResponse,
  type PolicyAuthorizationContractPayload,
  type PolicyAuthorizationContractResult,
  type PolicyReceiptVerificationContractPayload,
  type PolicyReceiptVerificationContractResult
  , type PolicyJournalCheckpointContractPayload
  , type PolicyJournalCheckpointContractResult
} from '@ppt/core-service-contracts';

export interface CoreServiceLocalAdminClientOptions {
  readonly endpoint: string;
  readonly authenticationToken: string;
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
  readonly apiVersion?: string;
  readonly clientApplicationId?: CoreServiceLocalAdminRequest['clientApplicationId'];
  readonly clock?: () => string;
  readonly requestIdFactory?: () => string;
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length && actual.every((key, index) => key === canonical[index]);
};
const isExactResponse = (value: unknown): value is CoreServiceLocalAdminResponse => {
  if (!isPlainRecord(value)) return false;
  const common = value.protocolVersion === CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION
    && value.apiVersion === CORE_SERVICE_APPLICATION_API_VERSION
    && value.serverApplicationId === CORE_SERVICE_APPLICATION_ID
    && typeof value.requestId === 'string' && value.requestId.length > 0 && value.requestId.length <= 128;
  if (!common || typeof value.ok !== 'boolean') return false;
  if (value.ok) return exactKeys(value, ['protocolVersion', 'apiVersion', 'serverApplicationId', 'requestId', 'ok', 'result']);
  if (!exactKeys(value, ['protocolVersion', 'apiVersion', 'serverApplicationId', 'requestId', 'ok', 'error']) || !isPlainRecord(value.error)) return false;
  return exactKeys(value.error, ['code', 'message'])
    && typeof value.error.code === 'string'
    && CORE_SERVICE_LOCAL_ADMIN_ERROR_CODES.includes(value.error.code as typeof CORE_SERVICE_LOCAL_ADMIN_ERROR_CODES[number])
    && typeof value.error.message === 'string' && value.error.message.length > 0;
};

export class CoreServiceLocalAdminClientError extends Error {
  public readonly code: string;

  public constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CoreServiceLocalAdminClientError';
    this.code = code;
  }
}

export class CoreServiceLocalAdminClient {
  readonly #endpoint: string;
  readonly #token: string;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #apiVersion: string;
  readonly #clientApplicationId: CoreServiceLocalAdminRequest['clientApplicationId'];
  readonly #clock: () => string;
  readonly #requestIdFactory: () => string;

  public constructor(options: CoreServiceLocalAdminClientOptions) {
    if (!options.endpoint.trim()) throw new Error('Core Service endpoint is required');
    if (Buffer.byteLength(options.authenticationToken, 'utf8') < 32) throw new Error('Core Service authentication token must contain at least 32 bytes');
    this.#endpoint = options.endpoint;
    this.#token = options.authenticationToken;
    this.#timeoutMs = Math.min(Math.max(options.timeoutMs ?? 5_000, 250), 30_000);
    this.#maxResponseBytes = Math.min(Math.max(options.maxResponseBytes ?? CORE_SERVICE_LOCAL_ADMIN_MAX_MESSAGE_BYTES, 1_024), CORE_SERVICE_LOCAL_ADMIN_MAX_MESSAGE_BYTES);
    this.#apiVersion = options.apiVersion ?? CORE_SERVICE_APPLICATION_API_VERSION;
    this.#clientApplicationId = options.clientApplicationId ?? CORE_SERVICE_LOCAL_ADMIN_CLIENT_APPLICATION_ID;
    this.#clock = options.clock ?? (() => new Date().toISOString());
    this.#requestIdFactory = options.requestIdFactory ?? randomUUID;
  }

  public apiBoundaryStatus(): Promise<CoreServiceApiBoundaryStatusContract> {
    return this.request('client-api-boundary.status', {});
  }

  public health(): Promise<CoreServiceHealthContract> {
    return this.request('health.get', {});
  }

  public architecture(): Promise<CoreServiceArchitectureContract> {
    return this.request('architecture.get', {});
  }

  public familyDataStatus(): Promise<CoreServiceFamilyDataStatusContract> {
    return this.request('family-data.status', {});
  }

  public deviceSecretProtectionStatus(): Promise<CoreServiceDeviceSecretProtectionStatusContract> {
    return this.request('device-secret-protection.status', {});
  }

  public familyDataCutoverStatus(): Promise<CoreServiceFamilyDataCutoverStatusContract> {
    return this.request('family-data-cutover.status', {});
  }

  public familyDataCutoverReadinessStatus(): Promise<CoreServiceFamilyDataCutoverReadinessStatusContract> {
    return this.request('family-data-cutover-readiness.status', {});
  }

  public authorize(payload: PolicyAuthorizationContractPayload): Promise<PolicyAuthorizationContractResult> {
    return this.request('policy.authorize', payload);
  }

  public verify(payload: PolicyReceiptVerificationContractPayload): Promise<PolicyReceiptVerificationContractResult> {
    return this.request('policy.verify', payload);
  }

  public checkpointPolicyJournal(
    payload: PolicyJournalCheckpointContractPayload
  ): Promise<PolicyJournalCheckpointContractResult> {
    return this.request('policy-journal.checkpoint', payload);
  }

  public async request<TMethod extends CoreServiceLocalAdminMethod>(
    method: TMethod,
    payload: CoreServiceMethodPayload<TMethod>
  ): Promise<CoreServiceMethodResult<TMethod>> {
    const requestId = this.#requestIdFactory();
    const request: CoreServiceLocalAdminRequest<CoreServiceMethodPayload<TMethod>> = {
      protocolVersion: CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION,
      apiVersion: this.#apiVersion as typeof CORE_SERVICE_APPLICATION_API_VERSION,
      clientApplicationId: this.#clientApplicationId,
      requestId,
      issuedAt: this.#clock(),
      method,
      authenticationToken: this.#token,
      payload
    };
    const encoded = `${JSON.stringify(request)}\n`;
    if (Buffer.byteLength(encoded, 'utf8') > CORE_SERVICE_LOCAL_ADMIN_MAX_MESSAGE_BYTES) {
      throw new CoreServiceLocalAdminClientError('Core Service request exceeds the local administration limit', 'MESSAGE_TOO_LARGE');
    }

    return new Promise<CoreServiceMethodResult<TMethod>>((resolve, reject) => {
      let socket: Socket | undefined;
      let settled = false;
      let response = '';
      const finish = (error?: Error, value?: CoreServiceMethodResult<TMethod>): void => {
        if (settled) return;
        settled = true;
        socket?.destroy();
        if (error) reject(error);
        else resolve(value as CoreServiceMethodResult<TMethod>);
      };
      const timer = setTimeout(() => finish(new CoreServiceLocalAdminClientError('Core Service request timed out', 'TIMEOUT')), this.#timeoutMs);
      const complete = (error?: Error, value?: CoreServiceMethodResult<TMethod>): void => { clearTimeout(timer); finish(error, value); };

      socket = createConnection(this.#endpoint);
      socket.setEncoding('utf8');
      socket.once('connect', () => socket?.write(encoded));
      socket.on('data', (chunk: string) => {
        response += chunk;
        if (Buffer.byteLength(response, 'utf8') > this.#maxResponseBytes) {
          complete(new CoreServiceLocalAdminClientError('Core Service response exceeds the local administration limit', 'MESSAGE_TOO_LARGE'));
          return;
        }
        const newline = response.indexOf('\n');
        if (newline < 0) return;
        try {
          const parsed: unknown = JSON.parse(response.slice(0, newline));
          if (!isExactResponse(parsed) || parsed.requestId !== requestId) {
            complete(new CoreServiceLocalAdminClientError('Core Service response identity or protocol mismatch', 'INVALID_RESPONSE'));
            return;
          }
          if (!parsed.ok) {
            complete(new CoreServiceLocalAdminClientError(parsed.error.message, parsed.error.code));
            return;
          }
          complete(undefined, parsed.result as CoreServiceMethodResult<TMethod>);
        } catch (error) {
          complete(new CoreServiceLocalAdminClientError('Core Service returned invalid JSON', 'INVALID_RESPONSE', { cause: error }));
        }
      });
      socket.once('error', (error) => complete(new CoreServiceLocalAdminClientError('Core Service connection failed', 'CONNECTION_FAILED', { cause: error })));
      socket.once('end', () => { if (!settled) complete(new CoreServiceLocalAdminClientError('Core Service closed the connection before a complete response', 'CONNECTION_CLOSED')); });
    });
  }
}
