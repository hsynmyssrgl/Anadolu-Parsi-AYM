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

const sensitiveKeyPattern = /(password|secret|token|recovery|private.?key|totp|authorization|cookie|credential)/i;

const redactValue = (value: unknown, key: string, seen: WeakSet<object>): unknown => {
  if (sensitiveKeyPattern.test(key)) return '<redacted>';
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '<function>';
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '<circular>';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, '', seen));
  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      redactValue(entryValue, entryKey, seen)
    ])
  );
};

export const redactLogMetadata = (
  metadata: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, unknown>> | undefined => {
  if (metadata === undefined) return undefined;
  return Object.freeze(redactValue(metadata, '', new WeakSet<object>()) as Record<string, unknown>);
};

export const serializeLogEvent = (event: LogEvent): string => {
  const metadata = redactLogMetadata(event.metadata);
  const safeEvent = metadata === undefined
    ? Object.fromEntries(Object.entries(event).filter(([key]) => key !== 'metadata'))
    : { ...event, metadata };
  return JSON.stringify(safeEvent);
};

export class MemoryLogger implements Logger {
  readonly #events: LogEvent[] = [];

  public get events(): readonly LogEvent[] {
    return this.#events;
  }

  public debug(event: Omit<LogEvent, 'level'>): void { this.#push('debug', event); }
  public info(event: Omit<LogEvent, 'level'>): void { this.#push('info', event); }
  public warn(event: Omit<LogEvent, 'level'>): void { this.#push('warn', event); }
  public error(event: Omit<LogEvent, 'level'>): void { this.#push('error', event); }

  #push(level: LogLevel, event: Omit<LogEvent, 'level'>): void {
    const metadata = redactLogMetadata(event.metadata);
    const value: LogEvent = metadata === undefined
      ? { ...event, level }
      : { ...event, level, metadata };
    this.#events.push(Object.freeze(value));
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
  readonly onWriteError?: (error: unknown) => void;
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
  readonly #onWriteError: ((error: unknown) => void) | undefined;

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
      this.#onWriteError?.(error);
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
      this.#onWriteError?.(error);
    }
  }
}
