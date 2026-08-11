import { existsSync, readdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  serializeLogEvent,
  toSafeLogWriteFailure,
  type LogEvent,
  type Logger,
  type LogLevel,
  type SafeLogWriteFailure
} from '@ppt/logging';
import type { ProtectedSideArtifactStore } from './protected-side-artifact-store.js';

const levelWeight: Readonly<Record<LogLevel, number>> = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });

export interface ProtectedSideArtifactLoggerOptions {
  readonly directory: string;
  readonly store: ProtectedSideArtifactStore;
  readonly minimumLevel?: LogLevel;
  readonly maxFileBytes: number;
  readonly retentionDays: number;
  readonly onWriteError?: (failure: SafeLogWriteFailure) => void;
}

export class ProtectedSideArtifactLogger implements Logger {
  readonly #filePath: string;
  readonly #minimumLevel: LogLevel;

  public constructor(private readonly options: ProtectedSideArtifactLoggerOptions) {
    this.#filePath = join(options.directory, 'desktop-main.pplog');
    this.#minimumLevel = options.minimumLevel ?? 'info';
    this.#pruneExpiredFiles();
  }

  public get filePath(): string { return this.#filePath; }
  public debug(event: Omit<LogEvent, 'level'>): void { this.#write('debug', event); }
  public info(event: Omit<LogEvent, 'level'>): void { this.#write('info', event); }
  public warn(event: Omit<LogEvent, 'level'>): void { this.#write('warn', event); }
  public error(event: Omit<LogEvent, 'level'>): void { this.#write('error', event); }

  #write(level: LogLevel, event: Omit<LogEvent, 'level'>): void {
    if (levelWeight[level] < levelWeight[this.#minimumLevel]) return;
    try {
      const serialized = serializeLogEvent({ ...event, level });
      this.#rotateIfRequired(Buffer.byteLength(serialized, 'utf8') * 2 + 768);
      this.options.store.appendTextRecord(this.#filePath, 'log-event', serialized);
    } catch (error) {
      this.options.onWriteError?.(toSafeLogWriteFailure(error));
    }
  }

  #rotateIfRequired(incomingBytes: number): void {
    if (!existsSync(this.#filePath)) return;
    const currentSize = statSync(this.#filePath).size;
    if (currentSize === 0 || currentSize + incomingBytes <= this.options.maxFileBytes) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    let sequence = 0;
    let rotatedPath = join(this.options.directory, `desktop-main.${stamp}.pplog`);
    while (existsSync(rotatedPath)) {
      sequence += 1;
      rotatedPath = join(this.options.directory, `desktop-main.${stamp}.${sequence}.pplog`);
    }
    renameSync(this.#filePath, rotatedPath);
    this.#pruneExpiredFiles();
  }

  #pruneExpiredFiles(): void {
    try {
      const cutoff = Date.now() - this.options.retentionDays * 86_400_000;
      for (const fileName of readdirSync(this.options.directory)) {
        if (!fileName.startsWith('desktop-main.') || !fileName.endsWith('.pplog')) continue;
        const filePath = join(this.options.directory, fileName);
        if (statSync(filePath).mtimeMs < cutoff) unlinkSync(filePath);
      }
    } catch (error) {
      this.options.onWriteError?.(toSafeLogWriteFailure(error));
    }
  }
}
