import { randomUUID } from 'node:crypto';
import { createConnection, type Socket } from 'node:net';
import {
  CORE_SERVICE_LOCAL_ADMIN_MAX_MESSAGE_BYTES,
  CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION,
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
}

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

  public constructor(options: CoreServiceLocalAdminClientOptions) {
    if (!options.endpoint.trim()) throw new Error('Core Service endpoint is required');
    if (Buffer.byteLength(options.authenticationToken, 'utf8') < 32) throw new Error('Core Service authentication token must contain at least 32 bytes');
    this.#endpoint = options.endpoint;
    this.#token = options.authenticationToken;
    this.#timeoutMs = Math.min(Math.max(options.timeoutMs ?? 5_000, 250), 30_000);
    this.#maxResponseBytes = Math.min(Math.max(options.maxResponseBytes ?? CORE_SERVICE_LOCAL_ADMIN_MAX_MESSAGE_BYTES, 1_024), CORE_SERVICE_LOCAL_ADMIN_MAX_MESSAGE_BYTES);
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
    const requestId = randomUUID();
    const request: CoreServiceLocalAdminRequest<CoreServiceMethodPayload<TMethod>> = {
      protocolVersion: CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION,
      requestId,
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
          const parsed = JSON.parse(response.slice(0, newline)) as CoreServiceLocalAdminResponse<CoreServiceMethodResult<TMethod>>;
          if (parsed.protocolVersion !== CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION || parsed.requestId !== requestId) {
            complete(new CoreServiceLocalAdminClientError('Core Service response identity or protocol mismatch', 'INVALID_RESPONSE'));
            return;
          }
          if (!parsed.ok) {
            complete(new CoreServiceLocalAdminClientError(parsed.error.message, parsed.error.code));
            return;
          }
          complete(undefined, parsed.result);
        } catch (error) {
          complete(new CoreServiceLocalAdminClientError('Core Service returned invalid JSON', 'INVALID_RESPONSE', { cause: error }));
        }
      });
      socket.once('error', (error) => complete(new CoreServiceLocalAdminClientError('Core Service connection failed', 'CONNECTION_FAILED', { cause: error })));
      socket.once('end', () => { if (!settled) complete(new CoreServiceLocalAdminClientError('Core Service closed the connection before a complete response', 'CONNECTION_CLOSED')); });
    });
  }
}
