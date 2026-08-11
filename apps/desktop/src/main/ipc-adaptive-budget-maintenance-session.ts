import { createHash, randomUUID } from 'node:crypto';

export type IpcAdaptiveBudgetMaintenanceOperation = 'reset' | 'diagnostics-export';

export interface IpcAdaptiveBudgetMaintenanceSessionView {
  readonly sessionId: string;
  readonly operation: IpcAdaptiveBudgetMaintenanceOperation;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface IpcAdaptiveBudgetMaintenanceSessionBeginInput {
  readonly senderId: number;
  readonly rendererSessionId: string;
  readonly authFingerprint: string;
  readonly operation: IpcAdaptiveBudgetMaintenanceOperation;
  readonly now?: number;
}

export interface IpcAdaptiveBudgetMaintenanceSessionConsumeInput extends IpcAdaptiveBudgetMaintenanceSessionBeginInput {
  readonly sessionId: string;
}

export interface IpcAdaptiveBudgetMaintenanceSessionConsumeResult {
  readonly accepted: boolean;
  readonly reason:
    | 'ACCEPTED'
    | 'SESSION_NOT_FOUND'
    | 'SESSION_EXPIRED'
    | 'SESSION_ALREADY_USED'
    | 'SENDER_MISMATCH'
    | 'RENDERER_SESSION_MISMATCH'
    | 'AUTH_CONTEXT_MISMATCH'
    | 'OPERATION_MISMATCH';
  readonly consumedAt?: string;
  readonly sessionFingerprint?: string;
}

interface MaintenanceSessionRecord {
  readonly sessionId: string;
  readonly senderId: number;
  readonly rendererSessionId: string;
  readonly authFingerprint: string;
  readonly operation: IpcAdaptiveBudgetMaintenanceOperation;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  usedAtMs?: number;
}

const VALID_OPERATIONS = new Set<IpcAdaptiveBudgetMaintenanceOperation>(['reset', 'diagnostics-export']);
const SESSION_ID_PATTERN = /^[0-9a-f-]{36}$/u;
const RENDERER_SESSION_ID_PATTERN = /^[0-9a-f-]{36}$/u;
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const DEFAULT_TTL_MS = 90_000;
const DEFAULT_MAXIMUM_SESSIONS_PER_SENDER = 8;

const sessionFingerprint = (record: MaintenanceSessionRecord): string => createHash('sha256')
  .update(`${record.sessionId}:${record.senderId}:${record.rendererSessionId}:${record.operation}:${record.issuedAtMs}`, 'utf8')
  .digest('hex');

export class IpcAdaptiveBudgetMaintenanceSessionRegistry {
  readonly #ttlMs: number;
  readonly #maximumSessionsPerSender: number;
  readonly #sessions = new Map<string, MaintenanceSessionRecord>();

  public constructor(options: { readonly ttlMs?: number; readonly maximumSessionsPerSender?: number } = {}) {
    this.#ttlMs = Math.max(10_000, Math.min(options.ttlMs ?? DEFAULT_TTL_MS, 5 * 60_000));
    this.#maximumSessionsPerSender = Math.max(1, Math.min(options.maximumSessionsPerSender ?? DEFAULT_MAXIMUM_SESSIONS_PER_SENDER, 32));
  }

  public begin(input: IpcAdaptiveBudgetMaintenanceSessionBeginInput): IpcAdaptiveBudgetMaintenanceSessionView {
    this.#assertBeginInput(input);
    const now = this.#normalizeNow(input.now);
    this.prune(now);
    const senderSessions = [...this.#sessions.values()]
      .filter((record) => record.senderId === input.senderId)
      .sort((left, right) => left.issuedAtMs - right.issuedAtMs);
    while (senderSessions.length >= this.#maximumSessionsPerSender) {
      const oldest = senderSessions.shift();
      if (oldest) this.#sessions.delete(oldest.sessionId);
    }
    const sessionId = randomUUID();
    const record: MaintenanceSessionRecord = {
      sessionId,
      senderId: input.senderId,
      rendererSessionId: input.rendererSessionId,
      authFingerprint: input.authFingerprint,
      operation: input.operation,
      issuedAtMs: now,
      expiresAtMs: now + this.#ttlMs
    };
    this.#sessions.set(sessionId, record);
    return Object.freeze({
      sessionId,
      operation: input.operation,
      issuedAt: new Date(record.issuedAtMs).toISOString(),
      expiresAt: new Date(record.expiresAtMs).toISOString()
    });
  }

  public consume(input: IpcAdaptiveBudgetMaintenanceSessionConsumeInput): IpcAdaptiveBudgetMaintenanceSessionConsumeResult {
    this.#assertBeginInput(input);
    if (!SESSION_ID_PATTERN.test(input.sessionId)) {
      return Object.freeze({ accepted: false, reason: 'SESSION_NOT_FOUND' });
    }
    const now = this.#normalizeNow(input.now);
    const record = this.#sessions.get(input.sessionId);
    if (!record) return Object.freeze({ accepted: false, reason: 'SESSION_NOT_FOUND' });
    if (record.usedAtMs !== undefined) return Object.freeze({ accepted: false, reason: 'SESSION_ALREADY_USED' });
    if (now > record.expiresAtMs) {
      this.#sessions.delete(record.sessionId);
      return Object.freeze({ accepted: false, reason: 'SESSION_EXPIRED' });
    }
    if (record.senderId !== input.senderId) return Object.freeze({ accepted: false, reason: 'SENDER_MISMATCH' });
    if (record.rendererSessionId !== input.rendererSessionId) return Object.freeze({ accepted: false, reason: 'RENDERER_SESSION_MISMATCH' });
    if (record.authFingerprint !== input.authFingerprint) return Object.freeze({ accepted: false, reason: 'AUTH_CONTEXT_MISMATCH' });
    if (record.operation !== input.operation) return Object.freeze({ accepted: false, reason: 'OPERATION_MISMATCH' });
    record.usedAtMs = now;
    return Object.freeze({
      accepted: true,
      reason: 'ACCEPTED',
      consumedAt: new Date(now).toISOString(),
      sessionFingerprint: sessionFingerprint(record)
    });
  }

  public clearSender(senderId: number): number {
    let cleared = 0;
    for (const [sessionId, record] of this.#sessions.entries()) {
      if (record.senderId !== senderId) continue;
      this.#sessions.delete(sessionId);
      cleared += 1;
    }
    return cleared;
  }

  public clearAll(): number {
    const count = this.#sessions.size;
    this.#sessions.clear();
    return count;
  }

  public prune(now = Date.now()): number {
    const normalizedNow = this.#normalizeNow(now);
    let pruned = 0;
    for (const [sessionId, record] of this.#sessions.entries()) {
      if (record.expiresAtMs >= normalizedNow && record.usedAtMs === undefined) continue;
      this.#sessions.delete(sessionId);
      pruned += 1;
    }
    return pruned;
  }

  public activeCount(senderId?: number, now = Date.now()): number {
    this.prune(now);
    if (senderId === undefined) return this.#sessions.size;
    return [...this.#sessions.values()].filter((record) => record.senderId === senderId).length;
  }

  #assertBeginInput(input: IpcAdaptiveBudgetMaintenanceSessionBeginInput): void {
    if (!Number.isInteger(input.senderId) || input.senderId < 0) throw new Error('Bakım oturumu gönderici kimliği geçersiz.');
    if (!RENDERER_SESSION_ID_PATTERN.test(input.rendererSessionId)) throw new Error('Bakım oturumu renderer kimliği geçersiz.');
    if (!HASH_PATTERN.test(input.authFingerprint)) throw new Error('Bakım oturumu kimlik bağlamı geçersiz.');
    if (!VALID_OPERATIONS.has(input.operation)) throw new Error('Bakım oturumu işlem türü geçersiz.');
  }

  #normalizeNow(value: number | undefined): number {
    return Number.isFinite(value) ? Math.max(0, Number(value)) : Date.now();
  }
}
