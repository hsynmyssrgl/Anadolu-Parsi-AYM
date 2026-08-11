import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync
} from 'node:fs';
import { join } from 'node:path';
import type { CausationId, CorrelationId, ErrorCode, IsoDateTime } from '@ppt/core';
import {
  SensitiveLogPolicy,
  type SensitiveLogPolicyRejectionReason
} from '@ppt/platform-policy';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEvent {
  readonly timestamp: IsoDateTime;
  readonly level: LogLevel;
  readonly service: string;
  readonly process: string;
  readonly event: string;
  readonly correlationId: CorrelationId;
  readonly causationId?: CausationId;
  readonly durationMs?: number;
  readonly outcome?: 'success' | 'failure' | 'partial';
  readonly errorCode?: ErrorCode;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface Logger {
  debug(event: Omit<LogEvent, 'level'>): void;
  info(event: Omit<LogEvent, 'level'>): void;
  warn(event: Omit<LogEvent, 'level'>): void;
  error(event: Omit<LogEvent, 'level'>): void;
}

const sensitiveLogPolicy = new SensitiveLogPolicy();

export class SensitiveLogPolicyViolation extends Error {
  public constructor(public readonly reason: SensitiveLogPolicyRejectionReason) {
    super('SENSITIVE_LOG_POLICY_REJECTED');
    this.name = 'SensitiveLogPolicyViolation';
  }
}

export interface SafeLogWriteFailure {
  readonly code: 'SENSITIVE_LOG_POLICY_REJECTED' | 'LOG_WRITE_FAILED';
  readonly reason: SensitiveLogPolicyRejectionReason | 'FILESYSTEM_OPERATION_FAILED';
}

export const toSafeLogWriteFailure = (error: unknown): SafeLogWriteFailure => Object.freeze(
  error instanceof SensitiveLogPolicyViolation
    ? { code: 'SENSITIVE_LOG_POLICY_REJECTED', reason: error.reason }
    : { code: 'LOG_WRITE_FAILED', reason: 'FILESYSTEM_OPERATION_FAILED' }
);

export const redactLogMetadata = (
  metadata: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, unknown>> | undefined => {
  const decision = sensitiveLogPolicy.evaluate({
    timestamp: '2026-01-01T00:00:00.000Z',
    level: 'info',
    service: 'metadata-policy',
    process: 'logging',
    event: 'metadata.evaluate',
    correlationId: 'metadata-policy',
    ...(metadata === undefined ? {} : { metadata })
  });
  if (!decision.allowed) throw new SensitiveLogPolicyViolation(decision.reason);
  return decision.metadata;
};

export const serializeLogEvent = (event: LogEvent): string => {
  const decision = sensitiveLogPolicy.evaluate(event);
  if (!decision.allowed) throw new SensitiveLogPolicyViolation(decision.reason);
  const metadata = decision.metadata;
  const safeEvent = metadata === undefined
    ? Object.fromEntries(Object.entries(event).filter(([key]) => key !== 'metadata'))
    : { ...event, metadata };
  return JSON.stringify(safeEvent);
};

export const writeContentFreeConsoleEvent = (
  event: LogEvent,
  stream: 'stdout' | 'stderr' = 'stdout'
): boolean => {
  try {
    const line = `${serializeLogEvent(event)}\n`;
    process[stream].write(line);
    return true;
  } catch {
    return false;
  }
};

export class MemoryLogger implements Logger {
  readonly #events: LogEvent[] = [];
  readonly #rejections: SafeLogWriteFailure[] = [];

  public get events(): readonly LogEvent[] {
    return this.#events;
  }

  public get rejections(): readonly SafeLogWriteFailure[] {
    return this.#rejections;
  }

  public debug(event: Omit<LogEvent, 'level'>): void { this.#push('debug', event); }
  public info(event: Omit<LogEvent, 'level'>): void { this.#push('info', event); }
  public warn(event: Omit<LogEvent, 'level'>): void { this.#push('warn', event); }
  public error(event: Omit<LogEvent, 'level'>): void { this.#push('error', event); }

  #push(level: LogLevel, event: Omit<LogEvent, 'level'>): void {
    try {
      const complete: LogEvent = { ...event, level };
      const decision = sensitiveLogPolicy.evaluate(complete);
      if (!decision.allowed) throw new SensitiveLogPolicyViolation(decision.reason);
      const value: LogEvent = decision.metadata === undefined
        ? Object.fromEntries(Object.entries(complete).filter(([key]) => key !== 'metadata')) as unknown as LogEvent
        : { ...complete, metadata: decision.metadata };
      this.#events.push(Object.freeze(value));
    } catch (error) {
      this.#rejections.push(toSafeLogWriteFailure(error));
    }
  }
}

const levelWeight: Readonly<Record<LogLevel, number>> = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
});

export interface JsonLinesFileLoggerOptions {
  readonly directory: string;
  readonly fileName?: string;
  readonly minimumLevel?: LogLevel;
  readonly maxFileBytes: number;
  readonly retentionDays: number;
  readonly onWriteError?: (failure: SafeLogWriteFailure) => void;
}

/**
 * Yerel-first masaüstü uygulaması için senkron ve kayıp toleranslı JSONL logger.
 * Logger hataları authoritative domain transaction'ını hiçbir zaman bozmaz.
 */
export class JsonLinesFileLogger implements Logger {
  readonly #filePath: string;
  readonly #minimumLevel: LogLevel;
  readonly #maxFileBytes: number;
  readonly #retentionDays: number;
  readonly #onWriteError: ((failure: SafeLogWriteFailure) => void) | undefined;

  public constructor(private readonly options: JsonLinesFileLoggerOptions) {
    mkdirSync(options.directory, { recursive: true });
    this.#filePath = join(options.directory, options.fileName ?? 'desktop-main.jsonl');
    this.#minimumLevel = options.minimumLevel ?? 'info';
    this.#maxFileBytes = options.maxFileBytes;
    this.#retentionDays = options.retentionDays;
    this.#onWriteError = options.onWriteError;
    this.#pruneExpiredFiles();
  }

  public get filePath(): string {
    return this.#filePath;
  }

  public debug(event: Omit<LogEvent, 'level'>): void { this.#write('debug', event); }
  public info(event: Omit<LogEvent, 'level'>): void { this.#write('info', event); }
  public warn(event: Omit<LogEvent, 'level'>): void { this.#write('warn', event); }
  public error(event: Omit<LogEvent, 'level'>): void { this.#write('error', event); }

  #write(level: LogLevel, event: Omit<LogEvent, 'level'>): void {
    if (levelWeight[level] < levelWeight[this.#minimumLevel]) return;
    try {
      const line = `${serializeLogEvent({ ...event, level })}\n`;
      this.#rotateIfRequired(Buffer.byteLength(line, 'utf8'));
      appendFileSync(this.#filePath, line, { encoding: 'utf8', mode: 0o600 });
    } catch (error) {
      this.#onWriteError?.(toSafeLogWriteFailure(error));
    }
  }

  #rotateIfRequired(incomingBytes: number): void {
    if (!existsSync(this.#filePath)) return;
    const currentSize = statSync(this.#filePath).size;
    if (currentSize === 0 || currentSize + incomingBytes <= this.#maxFileBytes) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    let sequence = 0;
    let rotatedPath = join(this.options.directory, `desktop-main.${stamp}.jsonl`);
    while (existsSync(rotatedPath)) {
      sequence += 1;
      rotatedPath = join(this.options.directory, `desktop-main.${stamp}.${sequence}.jsonl`);
    }
    renameSync(this.#filePath, rotatedPath);
    this.#pruneExpiredFiles();
  }

  #pruneExpiredFiles(): void {
    try {
      const cutoff = Date.now() - this.#retentionDays * 86_400_000;
      for (const fileName of readdirSync(this.options.directory)) {
        if (!fileName.startsWith('desktop-main.') || !fileName.endsWith('.jsonl')) continue;
        const filePath = join(this.options.directory, fileName);
        if (statSync(filePath).mtimeMs < cutoff) unlinkSync(filePath);
      }
    } catch (error) {
      this.#onWriteError?.(toSafeLogWriteFailure(error));
    }
  }
}
