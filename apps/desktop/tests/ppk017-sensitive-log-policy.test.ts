import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync as readSource } from 'node:fs';
import {
  asCorrelationId,
  asIsoDateTime,
  asUserId,
  ok
} from '@ppt/core';
import {
  SensitiveLogPolicy,
  type ContentFreeDiagnosticRecord
} from '@ppt/platform-policy';
import {
  MemoryLogger,
  SensitiveLogPolicyViolation,
  serializeLogEvent
} from '@ppt/logging';
import {
  GetSensitiveLoggingBoundaryUseCase,
  RecordDiagnosticUseCase,
  type OperationalHealthWritePort
} from '@ppt/application';
import { SqliteDiagnosticRepository } from '@ppt/repositories';
import type { DiagnosticEntryView } from '@ppt/domain';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';
import { ProtectedSideArtifactStore, type ProtectedSideArtifactEnvelope } from '../src/main/protected-side-artifact-store.js';
import { ProtectedSideArtifactLogger } from '../src/main/protected-side-artifact-logger.js';
import type { DeviceSecretProtector } from '../src/main/device-secret-protector.js';

const NOW = '2026-08-12T00:00:00.000Z';
const CANARY = 'OCR sağlık finans gizli payload metni 123456';
const temporaryDirectories: string[] = [];

const testProtector: DeviceSecretProtector = Object.freeze({
  protectionId: 'ppk017-test-protector',
  required: false,
  isAvailable: () => true,
  protect: (value) => Buffer.from(`protected:${value}`, 'utf8').toString('base64url'),
  unprotect: (value) => {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    if (!decoded.startsWith('protected:')) throw new Error('TEST_PROTECTOR_ENVELOPE_INVALID');
    return decoded.slice('protected:'.length);
  }
});

const context = (database: DatabaseSync): RepositoryExecutionContext => ({
  transaction: database as never,
  actor: { userId: asUserId('system'), roles: ['system_operator'] },
  correlationId: asCorrelationId('ppk017-runtime'),
  occurredAt: asIsoDateTime(NOW)
});

const createDiagnosticDatabase = (): DatabaseSync => {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    CREATE TABLE diagnostic_entries(
      id TEXT PRIMARY KEY,
      severity TEXT NOT NULL,
      code TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT,
      occurred_at TEXT NOT NULL
    ) STRICT;
  `);
  return database;
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('PPK-017 hassas log politikası', () => {
  it('content-free sınır snapshotını fail-closed yayımlar', () => {
    const view = new GetSensitiveLoggingBoundaryUseCase(new SensitiveLogPolicy()).execute();
    expect(view).toMatchObject({
      schemaVersion: 1,
      enforcement: 'fail-closed',
      payloadAllowed: false,
      ocrTextAllowed: false,
      arbitraryMessageAllowed: false,
      errorStackAllowed: false,
      persistentPathAllowed: false,
      nestedMetadataAllowed: false,
      diagnosticTextStored: false,
      diagnosticSourceTextHashed: true,
      protectedDesktopSinkRequired: true,
      schemaMigrationRequired: false,
      latestDatabaseMigration: 77,
      payloadExposed: false,
      cutoverAuthorityAttached: false
    });
  });

  it('kimlik/hash/sonuç/correlation sınıflarını kabul eder', () => {
    const policy = new SensitiveLogPolicy();
    const decision = policy.evaluate({
      timestamp: NOW,
      level: 'info',
      service: 'desktop-main',
      process: 'electron-main',
      event: 'ocr.operation.completed',
      correlationId: 'cor-017',
      outcome: 'success',
      metadata: { resourceId: 'archive-1', contentHash: 'a'.repeat(64), result: 'completed', recordCount: 2 }
    });
    expect(decision.allowed).toBe(true);
  });

  it.each([
    ['payload key', { payload: CANARY }],
    ['OCR text key', { ocrText: CANARY }],
    ['arbitrary message', { message: CANARY }],
    ['stack', { stack: `Error: ${CANARY}` }],
    ['file path', { filePath: `C:\\private\\${CANARY}.txt` }],
    ['nested object', { result: { payload: CANARY } }],
    ['string array', { resultIds: [CANARY] }],
    ['payload under identifier', { resourceId: CANARY }]
  ])('%s girişini fail-closed reddeder', (_name, metadata) => {
    const policy = new SensitiveLogPolicy();
    expect(policy.evaluate({
      timestamp: NOW,
      level: 'warn',
      service: 'desktop-main',
      process: 'electron-main',
      event: 'sensitive.rejected',
      correlationId: 'cor-017',
      metadata
    })).toMatchObject({ allowed: false });
  });

  it('serializer hassas içerik için hiçbir çıktı üretmez', () => {
    expect(() => serializeLogEvent({
      timestamp: asIsoDateTime(NOW),
      level: 'error',
      service: 'desktop-main',
      process: 'electron-main',
      event: 'ocr.failed',
      correlationId: asCorrelationId('cor-017'),
      metadata: { details: CANARY }
    })).toThrow(SensitiveLogPolicyViolation);
  });

  it('MemoryLogger reddedilen içeriği bellekte de tutmaz', () => {
    const logger = new MemoryLogger();
    logger.info({
      timestamp: asIsoDateTime(NOW),
      service: 'desktop-main',
      process: 'electron-main',
      event: 'ocr.failed',
      correlationId: asCorrelationId('cor-017'),
      metadata: { payload: CANARY }
    });
    expect(logger.events).toHaveLength(0);
    expect(JSON.stringify(logger.rejections)).not.toContain(CANARY);
    expect(logger.rejections[0]).toMatchObject({ code: 'SENSITIVE_LOG_POLICY_REJECTED' });
  });

  it('tanı use-case ham mesaj ve ayrıntıyı yalnız SHA-256 özetiyle kalıcılaştırır', () => {
    let captured: DiagnosticEntryView | undefined;
    const write = {
      insertDiagnostic: (_context: unknown, entry: DiagnosticEntryView) => {
        captured = entry;
        return ok(undefined);
      }
    } as unknown as OperationalHealthWritePort;
    const useCase = new RecordDiagnosticUseCase(write, new SensitiveLogPolicy());
    const result = useCase.execute({
      actor: { userId: asUserId('system'), roles: ['system_operator'] },
      correlationId: asCorrelationId('ppk017-diagnostic'),
      occurredAt: asIsoDateTime(NOW)
    }, {
      id: 'diag-1',
      severity: 'error',
      code: 'ocr.processing_failed',
      message: CANARY,
      details: `C:\\private\\source.pdf ${CANARY}`,
      occurredAt: NOW
    });
    expect(result.ok).toBe(true);
    expect(captured).toMatchObject({
      id: 'diag-1',
      code: 'ocr.processing_failed',
      message: 'Teknik tanı sonucu: ocr.processing_failed.'
    });
    expect(captured?.details).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(JSON.stringify(captured)).not.toContain(CANARY);
    expect(JSON.stringify(captured)).not.toContain('source.pdf');
  });

  it('repository idempotent olay tanısını da içeriksizleştirir', () => {
    const database = createDiagnosticDatabase();
    try {
      const repository = new SqliteDiagnosticRepository();
      const result = repository.insertIfAbsent(context(database), {
        id: 'event-handler:evt-1:diagnostic',
        severity: 'info',
        code: 'family.member.created',
        message: CANARY,
        details: JSON.stringify({ displayName: CANARY, path: 'C:\\private\\member.json' }),
        occurredAt: asIsoDateTime(NOW)
      });
      expect(result.ok).toBe(true);
      const row = database.prepare('SELECT * FROM diagnostic_entries').get() as Record<string, unknown>;
      expect(row.message).toBe('Teknik tanı sonucu: family.member.created.');
      expect(row.details).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(JSON.stringify(row)).not.toContain(CANARY);
      expect(repository.listDiagnostics(context(database), 10)).toMatchObject({ ok: true });
    } finally {
      database.close();
    }
  });

  it('repository içeriksiz olmayan doğrudan yazımı reddeder', () => {
    const database = createDiagnosticDatabase();
    try {
      const repository = new SqliteDiagnosticRepository();
      const result = repository.insertDiagnostic(context(database), {
        id: 'diag-unsafe', severity: 'error', code: 'ocr.failed', message: CANARY, details: CANARY, occurredAt: NOW
      });
      expect(result.ok).toBe(false);
      expect(database.prepare('SELECT COUNT(*) AS count FROM diagnostic_entries').get()).toMatchObject({ count: 0 });
    } finally {
      database.close();
    }
  });

  it('repository bozulmuş kalıcı satırı okuma sırasında fail-closed reddeder', () => {
    const database = createDiagnosticDatabase();
    try {
      const repository = new SqliteDiagnosticRepository();
      const policy = new SensitiveLogPolicy();
      const safe: ContentFreeDiagnosticRecord = policy.sanitizeDiagnostic({
        id: 'diag-safe', severity: 'warning', code: 'ocr.warning', message: CANARY, occurredAt: NOW
      });
      expect(repository.insertDiagnostic(context(database), safe)).toMatchObject({ ok: true });
      database.prepare('UPDATE diagnostic_entries SET message=? WHERE id=?').run(CANARY, safe.id);
      expect(repository.listDiagnostics(context(database), 10)).toMatchObject({ ok: false });
    } finally {
      database.close();
    }
  });

  it('korumalı Desktop sink yalnız içeriksiz olayı şifreli zarf içinde tutar', () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppk017-protected-log-'));
    temporaryDirectories.push(directory);
    const store = new ProtectedSideArtifactStore({
      keyPath: join(directory, 'side-artifact.key'),
      applicationVersion: '4.8.2026.29',
      protector: testProtector,
      now: () => NOW
    });
    const failures: unknown[] = [];
    const logger = new ProtectedSideArtifactLogger({
      directory,
      store,
      minimumLevel: 'debug',
      maxFileBytes: 1_000_000,
      retentionDays: 30,
      onWriteError: (failure) => failures.push(failure)
    });
    logger.info({
      timestamp: asIsoDateTime(NOW), service: 'desktop-main', process: 'electron-main',
      event: 'ocr.operation.completed', correlationId: asCorrelationId('cor-017'),
      metadata: { resourceId: 'archive-1', contentHash: 'b'.repeat(64), result: 'completed' }
    });
    logger.error({
      timestamp: asIsoDateTime(NOW), service: 'desktop-main', process: 'electron-main',
      event: 'ocr.operation.failed', correlationId: asCorrelationId('cor-017'),
      metadata: { ocrText: CANARY }
    });
    const raw = readFileSync(logger.filePath, 'utf8');
    expect(raw).not.toContain('ocr.operation.completed');
    expect(raw).not.toContain(CANARY);
    const envelopes = raw.trim().split('\n').map((line) => JSON.parse(line) as ProtectedSideArtifactEnvelope);
    expect(envelopes).toHaveLength(1);
    const plaintext = store.openEnvelope(envelopes[0]!).toString('utf8');
    expect(plaintext).toContain('ocr.operation.completed');
    expect(plaintext).not.toContain(CANARY);
    expect(failures).toEqual([{ code: 'SENSITIVE_LOG_POLICY_REJECTED', reason: 'METADATA_KEY_FORBIDDEN' }]);
    store.dispose();
  });

  it('IPC ve bakım günlüklerinin güvenli teknik sayaç adlarını kabul eder', () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppk017-safe-log-metadata-'));
    temporaryDirectories.push(directory);
    const store = new ProtectedSideArtifactStore({
      keyPath: join(directory, 'side-artifact.key'),
      applicationVersion: '22.8.2026.50',
      protector: testProtector,
      now: () => NOW
    });
    const failures: unknown[] = [];
    const logger = new ProtectedSideArtifactLogger({
      directory,
      store,
      minimumLevel: 'debug',
      maxFileBytes: 1_000_000,
      retentionDays: 30,
      onWriteError: (failure) => failures.push(failure)
    });

    logger.info({
      timestamp: asIsoDateTime(NOW), service: 'desktop-main', process: 'electron-main',
      event: 'ipc.safe_metadata.completed', correlationId: asCorrelationId('cor-safe-metadata-017'),
      metadata: {
        requestNodeCount: 12,
        requestEstimatedBytes: 2048,
        clearedScopeCount: 2,
        restoredScopeCount: 1,
        recoveryScopeFingerprint: 'abcdef1234567890'
      }
    });

    expect(failures).toEqual([]);
    expect(readFileSync(logger.filePath, 'utf8').trim()).not.toBe('');
    store.dispose();
  });

  it('üretim başlangıç kanıtında ham message/stack yerine fingerprint kullanır', () => {
    const source = readSource(new URL('../src/main/main.ts', import.meta.url), 'utf8');
    const segment = source.slice(source.indexOf('const writeEarlyStartupFailureEvidence'), source.indexOf('let revocationSyncService'));
    expect(segment).toContain('errorFingerprint = sensitiveLogPolicy.hashSensitiveSignal(error)');
    expect(segment).not.toContain('message: error.message');
    expect(segment).not.toContain('stack: error.stack');
    expect(segment).not.toContain('console.error');
  });

  it('Core Service üretim çıktısını merkezi içeriksiz console writer üzerinden verir', () => {
    const source = readSource(new URL('../../core-service/src/main.ts', import.meta.url), 'utf8');
    expect(source).toContain('writeContentFreeConsoleEvent');
    expect(source).not.toMatch(/console\.(?:log|error|warn|info)\s*\(/u);
    expect(source).not.toContain('health: host.runtime.health()');
  });

  it('IPC boundary no-cache ve UI görünürlüğüyle bağlıdır', () => {
    const readSharing = readSource(new URL('../src/main/ipc-read-sharing.ts', import.meta.url), 'utf8');
    const main = readSource(new URL('../src/main/main.ts', import.meta.url), 'utf8');
    const preload = readSource(new URL('../src/main/preload.ts', import.meta.url), 'utf8');
    const renderer = readSource(new URL('../src/renderer/App.tsx', import.meta.url), 'utf8');
    expect(readSharing).toContain("'system:getSensitiveLoggingBoundary'");
    expect(main).toContain("registerIpcHandler('system:getSensitiveLoggingBoundary'");
    expect(preload).toContain('getSensitiveLoggingBoundary');
    expect(renderer).toContain('PPK-017 · hassas log güvenliği');
    expect(renderer).toContain('Hassas log güvenliği</button>');
  });

  it('tanı raporu kullanıcı hedefi/iş kuyruğu payloadı yerine yalnız teknik sonuç sayaçları taşır', () => {
    const source = readSource(new URL('../src/main/data-store.ts', import.meta.url), 'utf8');
    const segment = source.slice(source.indexOf('public getDiagnosticReport()'), source.indexOf('public exportDiagnosticReport'));
    expect(segment).toContain('backupResults:');
    expect(segment).toContain('notificationResults:');
    expect(segment).toContain('queueResults:');
    expect(segment).not.toContain('backupTargets:');
    expect(segment).not.toContain('recentBackupRuns:');
    expect(segment).not.toContain('healthNotifications:');
    expect(segment).not.toContain('queue:');
  });
});
