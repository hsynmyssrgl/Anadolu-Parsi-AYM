import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type Server, type Socket } from 'node:net';
import {
  CORE_SERVICE_LOCAL_ADMIN_MAX_MESSAGE_BYTES,
  CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION,
  type CoreServiceLocalAdminFailure,
  type CoreServiceLocalAdminRequest,
  type CoreServiceLocalAdminResponse
} from '@ppt/core-service-contracts';
import type { CoreServiceRuntime } from './core-service-runtime.js';
import { CoreServiceMethodDispatcher } from './core-service-method-dispatcher.js';

export interface CoreServiceLocalAdminServerOptions {
  readonly endpoint: string;
  readonly authenticationToken: string;
  readonly runtime: CoreServiceRuntime;
  readonly maxMessageBytes?: number;
  readonly socketIdleTimeoutMs?: number;
  readonly shutdownGraceTimeoutMs?: number;
}

const tokenDigest = (token: string): Buffer => createHash('sha256').update(token, 'utf8').digest();
const safeRequestId = (value: unknown): string => typeof value === 'string' && value.length > 0 && value.length <= 128 ? value : 'unknown';

export class CoreServiceLocalAdminServer {
  readonly #endpoint: string;
  readonly #expectedTokenDigest: Buffer;
  readonly #dispatcher: CoreServiceMethodDispatcher;
  readonly #maxMessageBytes: number;
  readonly #socketIdleTimeoutMs: number;
  readonly #shutdownGraceTimeoutMs: number;
  readonly #sockets = new Set<Socket>();
  #server: Server | undefined;
  #stopPromise: Promise<void> | undefined;

  public constructor(options: CoreServiceLocalAdminServerOptions) {
    if (!options.endpoint.trim()) throw new Error('Core Service local administration endpoint is required');
    if (Buffer.byteLength(options.authenticationToken, 'utf8') < 32) throw new Error('Core Service local administration token must contain at least 32 bytes');
    this.#endpoint = options.endpoint;
    this.#expectedTokenDigest = tokenDigest(options.authenticationToken);
    this.#dispatcher = new CoreServiceMethodDispatcher(options.runtime);
    this.#maxMessageBytes = Math.min(Math.max(options.maxMessageBytes ?? CORE_SERVICE_LOCAL_ADMIN_MAX_MESSAGE_BYTES, 1_024), CORE_SERVICE_LOCAL_ADMIN_MAX_MESSAGE_BYTES);
    this.#socketIdleTimeoutMs = Math.min(Math.max(options.socketIdleTimeoutMs ?? 5_000, 250), 30_000);
    this.#shutdownGraceTimeoutMs = Math.min(Math.max(options.shutdownGraceTimeoutMs ?? 1_000, 100), 5_000);
  }

  public async start(): Promise<void> {
    if (this.#server) throw new Error('Core Service local administration server is already started');
    if (this.#stopPromise) throw new Error('Core Service local administration server cannot restart after shutdown');
    const server = createServer((socket) => this.#handleSocket(socket));
    this.#server = server;
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error): void => { server.off('listening', onListening); reject(error); };
        const onListening = (): void => { server.off('error', onError); resolve(); };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(this.#endpoint);
      });
    } catch (error) {
      if (this.#server === server) this.#server = undefined;
      server.removeAllListeners();
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (this.#stopPromise) return this.#stopPromise;
    const server = this.#server;
    this.#server = undefined;
    if (!server) return;
    this.#stopPromise = this.#closeServer(server);
    return this.#stopPromise;
  }

  async #closeServer(server: Server): Promise<void> {
    const closePromise = new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    const forcedClose = setTimeout(() => {
      for (const socket of this.#sockets) socket.destroy();
    }, this.#shutdownGraceTimeoutMs);
    forcedClose.unref();
    try {
      await closePromise;
    } finally {
      clearTimeout(forcedClose);
      for (const socket of this.#sockets) socket.destroy();
    }
  }

  #handleSocket(socket: Socket): void {
    this.#sockets.add(socket);
    socket.once('close', () => this.#sockets.delete(socket));
    socket.setEncoding('utf8');
    socket.setTimeout(this.#socketIdleTimeoutMs, () => socket.destroy());
    let received = '';
    let completed = false;
    const respond = (response: CoreServiceLocalAdminResponse): void => {
      if (completed) return;
      completed = true;
      socket.end(`${JSON.stringify(response)}\n`);
    };
    socket.on('data', (chunk: string) => {
      if (completed) return;
      received += chunk;
      if (Buffer.byteLength(received, 'utf8') > this.#maxMessageBytes) {
        respond(this.#failure('unknown', 'MESSAGE_TOO_LARGE', 'Local administration request exceeds the allowed size'));
        return;
      }
      const newline = received.indexOf('\n');
      if (newline < 0) return;
      void this.#dispatch(received.slice(0, newline)).then(respond).catch(() => respond(this.#failure('unknown', 'INTERNAL_ERROR', 'Local administration request failed')));
    });
    socket.once('error', () => { completed = true; });
  }

  async #dispatch(raw: string): Promise<CoreServiceLocalAdminResponse> {
    let request: CoreServiceLocalAdminRequest;
    try { request = JSON.parse(raw) as CoreServiceLocalAdminRequest; }
    catch { return this.#failure('unknown', 'INVALID_REQUEST', 'Local administration request is not valid JSON'); }
    const requestId = safeRequestId(request.requestId);
    if (request.protocolVersion !== CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION || requestId === 'unknown' || typeof request.authenticationToken !== 'string') {
      return this.#failure(requestId, 'INVALID_REQUEST', 'Local administration request envelope is invalid');
    }
    const actual = tokenDigest(request.authenticationToken);
    if (actual.byteLength !== this.#expectedTokenDigest.byteLength || !timingSafeEqual(actual, this.#expectedTokenDigest)) {
      return this.#failure(requestId, 'AUTHENTICATION_FAILED', 'Local administration authentication failed');
    }
    return this.#dispatcher.dispatch(requestId, request.method, request.payload);
  }

  #failure(requestId: string, code: CoreServiceLocalAdminFailure['error']['code'], message: string): CoreServiceLocalAdminFailure {
    return { protocolVersion: CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION, requestId, ok: false, error: { code, message } };
  }
}
