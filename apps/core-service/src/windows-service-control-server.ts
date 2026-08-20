import { timingSafeEqual } from 'node:crypto';
import { createServer, type Server, type Socket } from 'node:net';

const CONTROL_PROTOCOL_VERSION = 1;
const MAXIMUM_CONTROL_MESSAGE_BYTES = 4 * 1024;
const DEFAULT_IDLE_TIMEOUT_MS = 5_000;
const WINDOWS_PIPE_PREFIX = '\\\\.\\pipe\\ppt-core-service-host-control-';

export interface CoreServiceWindowsServiceControlServerOptions {
  readonly endpoint: string;
  readonly authenticationToken: string;
  readonly requestShutdown: () => Promise<void> | void;
  readonly platform?: NodeJS.Platform;
  readonly idleTimeoutMs?: number;
}

interface ShutdownRequest {
  readonly protocolVersion: 1;
  readonly command: 'shutdown';
  readonly authenticationToken: string;
}

interface ControlResponse {
  readonly protocolVersion: 1;
  readonly ok: boolean;
  readonly code: 'SHUTDOWN_ACCEPTED' | 'AUTHENTICATION_FAILED' | 'INVALID_REQUEST' | 'REPLAY_DETECTED';
}

const exactKeys = (value: object, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
};

const canonicalWindowsControlPipe = (endpoint: string): boolean =>
  endpoint.startsWith(WINDOWS_PIPE_PREFIX)
  && endpoint.length > WINDOWS_PIPE_PREFIX.length
  && endpoint.length <= 240
  && endpoint === endpoint.trim()
  && !/[\0\r\n]/u.test(endpoint)
  && /^[\\.A-Za-z0-9_-]+$/u.test(endpoint.slice(WINDOWS_PIPE_PREFIX.length));

const validToken = (value: string): boolean =>
  Buffer.byteLength(value, 'utf8') >= 32
  && Buffer.byteLength(value, 'utf8') <= 128
  && value === value.trim()
  && !/[\0\r\n]/u.test(value);

const tokenMatches = (actual: string, expected: string): boolean => {
  const actualBytes = Buffer.from(actual, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  try {
    return actualBytes.byteLength === expectedBytes.byteLength && timingSafeEqual(actualBytes, expectedBytes);
  } finally {
    actualBytes.fill(0);
    expectedBytes.fill(0);
  }
};

const parseRequest = (line: string): ShutdownRequest | null => {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || !exactKeys(value, [
    'protocolVersion', 'command', 'authenticationToken'
  ])) return null;
  const candidate = value as Partial<ShutdownRequest>;
  if (
    candidate.protocolVersion !== CONTROL_PROTOCOL_VERSION
    || candidate.command !== 'shutdown'
    || typeof candidate.authenticationToken !== 'string'
    || !validToken(candidate.authenticationToken)
  ) return null;
  return candidate as ShutdownRequest;
};

const respond = (socket: Socket, response: ControlResponse): void => {
  if (!socket.destroyed) socket.end(`${JSON.stringify(response)}\n`);
};

export class CoreServiceWindowsServiceControlServer {
  readonly #options: CoreServiceWindowsServiceControlServerOptions;
  readonly #platform: NodeJS.Platform;
  readonly #idleTimeoutMs: number;
  #server: Server | undefined;
  #shutdownAccepted = false;

  public constructor(options: CoreServiceWindowsServiceControlServerOptions) {
    this.#options = options;
    this.#platform = options.platform ?? process.platform;
    this.#idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    if (
      this.#platform !== 'win32'
      || !canonicalWindowsControlPipe(options.endpoint)
      || !validToken(options.authenticationToken)
      || typeof options.requestShutdown !== 'function'
      || !Number.isSafeInteger(this.#idleTimeoutMs)
      || this.#idleTimeoutMs < 1_000
      || this.#idleTimeoutMs > 30_000
    ) throw new Error('CORE_SERVICE_WINDOWS_CONTROL_OPTIONS_INVALID');
  }

  public async start(): Promise<void> {
    if (this.#server) throw new Error('CORE_SERVICE_WINDOWS_CONTROL_ALREADY_STARTED');
    const server = createServer((socket) => this.#handle(socket));
    this.#server = server;
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        server.removeListener('listening', onListening);
        this.#server = undefined;
        reject(error);
      };
      const onListening = (): void => {
        server.removeListener('error', onError);
        resolve();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(this.#options.endpoint);
    });
  }

  public async stop(): Promise<void> {
    const server = this.#server;
    this.#server = undefined;
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  #handle(socket: Socket): void {
    let bytes = 0;
    let buffer = '';
    let settled = false;
    const fail = (code: ControlResponse['code']): void => {
      if (settled) return;
      settled = true;
      respond(socket, Object.freeze({ protocolVersion: 1, ok: false, code }));
    };
    socket.setTimeout(this.#idleTimeoutMs, () => fail('INVALID_REQUEST'));
    socket.once('error', () => { settled = true; socket.destroy(); });
    socket.on('data', (chunk: Buffer) => {
      if (settled) return;
      bytes += chunk.byteLength;
      if (bytes > MAXIMUM_CONTROL_MESSAGE_BYTES) {
        fail('INVALID_REQUEST');
        return;
      }
      buffer += chunk.toString('utf8');
      const newline = buffer.indexOf('\n');
      if (newline < 0) return;
      const line = buffer.slice(0, newline);
      if (buffer.slice(newline + 1).length !== 0 || line.length === 0) {
        fail('INVALID_REQUEST');
        return;
      }
      const request = parseRequest(line);
      if (!request) {
        fail('INVALID_REQUEST');
        return;
      }
      if (!tokenMatches(request.authenticationToken, this.#options.authenticationToken)) {
        fail('AUTHENTICATION_FAILED');
        return;
      }
      if (this.#shutdownAccepted) {
        fail('REPLAY_DETECTED');
        return;
      }
      this.#shutdownAccepted = true;
      settled = true;
      respond(socket, Object.freeze({ protocolVersion: 1, ok: true, code: 'SHUTDOWN_ACCEPTED' }));
      setImmediate(() => {
        void Promise.resolve(this.#options.requestShutdown()).catch(() => undefined);
      });
    });
  }
}

export const readWindowsServiceControlConfiguration = (
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): { readonly endpoint: string; readonly authenticationToken: string } | null => {
  const endpoint = environment.PPT_CORE_SERVICE_HOST_CONTROL_ENDPOINT;
  const authenticationToken = environment.PPT_CORE_SERVICE_HOST_CONTROL_TOKEN;
  if (endpoint === undefined && authenticationToken === undefined) return null;
  if (
    platform !== 'win32'
    || typeof endpoint !== 'string'
    || typeof authenticationToken !== 'string'
    || !canonicalWindowsControlPipe(endpoint)
    || !validToken(authenticationToken)
  ) throw new Error('CORE_SERVICE_WINDOWS_CONTROL_CONFIGURATION_INVALID');
  return Object.freeze({ endpoint, authenticationToken });
};
