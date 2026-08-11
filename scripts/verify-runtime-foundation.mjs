import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  StoredCorrelationContextProvider,
  asCorrelationId,
  asIsoDateTime
} from '../packages/core/dist/index.js';
import {
  applyConfigOverrides,
  createDefaultConfig,
  resolveRuntimeEnvironment,
  validateConfig
} from '../packages/config/dist/index.js';
import { JsonLinesFileLogger } from '../packages/logging/dist/index.js';
import { IpcAdaptiveResourceBudgetController } from '../.tmp-runtime-dist/ipc-adaptive-resource-budget.js';
import { IpcPerformanceTelemetryRegistry } from '../.tmp-runtime-dist/ipc-performance-telemetry.js';
import { IpcReadResultCacheRegistry } from '../.tmp-runtime-dist/ipc-read-sharing.js';
import { IpcRequestLifecycleRegistry } from '../.tmp-runtime-dist/ipc-request-lifecycle.js';
import { registerCorrelatedIpcHandler } from '../.tmp-runtime-dist/ipc-runtime.js';
import { IpcTransportSessionRegistry, createZeroIpcTransportRevisions } from '../.tmp-runtime-dist/ipc-transport-context.js';
import { ProtectedSideArtifactStore } from '../.tmp-runtime-dist/protected-side-artifact-store.js';
import { bootstrapDesktopRuntime } from '../.tmp-runtime-dist/runtime-bootstrap.js';

const checks = [];
const verify = async (name, operation) => {
  await operation();
  checks.push(name);
};
const createProtectedArtifacts = (directory) => new ProtectedSideArtifactStore({
  keyPath: join(directory, 'secrets', 'runtime-foundation-side-key.json'),
  applicationVersion: ACTIVE_BUILD_META.applicationVersion,
  protector: {
    protectionId: 'runtime-foundation-test-protector',
    required: true,
    isAvailable: () => true,
    protect: (value) => Buffer.from(value, 'utf8').toString('base64url'),
    unprotect: (value) => Buffer.from(value, 'base64url').toString('utf8')
  }
});
const readProtectedLog = async (path, store) => {
  const raw = await readFile(path, 'utf8');
  return {
    raw,
    plaintext: raw.trim().split('\n').filter(Boolean)
      .map((line) => store.openEnvelope(JSON.parse(line)).toString('utf8'))
      .join('\n')
  };
};
const root = await mkdtemp(join(tmpdir(), 'ppt-mvp44-'));
try {
  await verify('runtime environment resolution', () => {
    assert.equal(resolveRuntimeEnvironment(undefined, false), 'development');
    assert.equal(resolveRuntimeEnvironment(undefined, true), 'production');
    assert.equal(resolveRuntimeEnvironment('test', true), 'test');
  });

  await verify('configuration overrides and validation', () => {
    const base = createDefaultConfig({
      version: ACTIVE_BUILD_META.applicationVersion,
      environment: 'test',
      paths: {
        data: join(root, 'data'), archive: join(root, 'archive'), cache: join(root, 'cache'),
        logs: join(root, 'logs'), temp: join(root, 'temp')
      }
    });
    const config = applyConfigOverrides(base, { jobs: { schedulerIntervalMs: 15_000 } });
    assert.equal(config.database.fileName, 'panthera-family.db');
    assert.equal(config.jobs.schedulerIntervalMs, 15_000);
    assert.equal(validateConfig(config).ok, true);
  });

  await verify('stored correlation provider propagates async context', async () => {
    const provider = new StoredCorrelationContextProvider(new AsyncLocalStorage());
    const correlationId = asCorrelationId('cor-runtime-test');
    await provider.run({ correlationId }, async () => {
      await Promise.resolve();
      assert.equal(provider.current()?.correlationId, correlationId);
    });
    assert.equal(provider.current(), undefined);
  });

  await verify('JSONL file logging rejects payload and rotates content-free events', async () => {
    const directory = join(root, 'file-logger');
    const failures = [];
    const logger = new JsonLinesFileLogger({
      directory,
      minimumLevel: 'debug',
      maxFileBytes: 256,
      retentionDays: 30,
      onWriteError: (failure) => failures.push(failure)
    });
    for (let index = 0; index < 24; index += 1) {
      logger.info({
        timestamp: asIsoDateTime(new Date().toISOString()),
        service: 'test', process: 'node', event: 'rotation.test',
        correlationId: asCorrelationId(`cor-${index}`),
        metadata: { eventId: `evt-${index}`, index }
      });
    }
    logger.info({
      timestamp: asIsoDateTime(new Date().toISOString()),
      service: 'test', process: 'node', event: 'payload.rejected',
      correlationId: asCorrelationId('cor-sensitive'),
      metadata: { password: 'never-log', payload: 'OCR secret text' }
    });
    assert.equal(failures.length, 1);
    assert.equal(failures[0].code, 'SENSITIVE_LOG_POLICY_REJECTED');
    const files = await readdir(directory);
    assert.ok(files.length > 1, 'Log rotasyonu oluşmadı.');
    for (const file of files) {
      const text = await readFile(join(directory, file), 'utf8');
      assert.equal(text.includes('never-log'), false);
      for (const line of text.trim().split('\n').filter(Boolean)) JSON.parse(line);
    }
  });

  await verify('desktop runtime creates isolated paths and startup log', async () => {
    const userDataPath = join(root, 'runtime');
    const protectedArtifacts = createProtectedArtifacts(userDataPath);
    try {
      const runtime = bootstrapDesktopRuntime({
        version: ACTIVE_BUILD_META.applicationVersion,
        isPackaged: false,
        userDataPath,
        volatileRootPath: join(root, 'runtime-volatile'),
        protectedArtifacts,
        environment: 'test',
        configOverrides: { logging: { maxFileBytes: 64 * 1024 } }
      });
      for (const path of Object.values(runtime.config.paths)) {
        assert.equal((await stat(path)).isDirectory(), true);
      }
      const startupLog = await readProtectedLog(
        join(runtime.config.paths.logs, 'desktop-main.pplog'),
        protectedArtifacts
      );
      assert.match(startupLog.plaintext, /runtime\.bootstrap\.completed/);
      assert.equal(startupLog.plaintext.includes(userDataPath), false);
      assert.equal(startupLog.raw.includes('runtime.bootstrap.completed'), false);
    } finally {
      protectedArtifacts.dispose();
    }
  });

  await verify('IPC wrapper logs success and preserves return value', async () => {
    const userDataPath = join(root, 'ipc');
    const protectedArtifacts = createProtectedArtifacts(userDataPath);
    try {
      const runtime = bootstrapDesktopRuntime({
        version: ACTIVE_BUILD_META.applicationVersion,
        isPackaged: false,
        userDataPath,
        volatileRootPath: join(root, 'ipc-volatile'),
        protectedArtifacts,
        environment: 'test'
      });
      const handlers = new Map();
      const ipcMain = { handle: (channel, listener) => handlers.set(channel, listener) };
      const frame = { url: 'file:///runtime-test/index.html' };
      registerCorrelatedIpcHandler({
        ipcMain,
        runtime,
        channel: 'test:echo',
        resolveTrustedRenderer: () => ({ webContentsId: 7, documentUrl: frame.url }),
        transportSessions: new IpcTransportSessionRegistry(),
        requestLifecycles: new IpcRequestLifecycleRegistry(),
        readResults: new IpcReadResultCacheRegistry(),
        telemetry: new IpcPerformanceTelemetryRegistry(),
        adaptiveBudget: new IpcAdaptiveResourceBudgetController(),
        handler: async (_event, value) => {
          assert.match(runtime.correlation.current()?.correlationId ?? '', /^ipc-/);
          await Promise.resolve();
          return { value };
        }
      });
      const request = {
        schemaVersion: 1,
        rendererSessionId: '11111111-1111-4111-8111-111111111111',
        requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        sessionEpoch: 0,
        requestSequence: 1,
        channel: 'test:echo',
        revisions: createZeroIpcTransportRevisions()
      };
      const response = await handlers.get('test:echo')({ sender: { id: 7, mainFrame: frame }, senderFrame: frame }, request, 'aile');
      assert.deepEqual(response.result, { value: 'aile' });
      assert.equal(response.request.requestId, request.requestId);
      assert.equal(runtime.correlation.current(), undefined);
      const log = await readProtectedLog(
        join(runtime.config.paths.logs, 'desktop-main.pplog'),
        protectedArtifacts
      );
      assert.match(log.plaintext, /ipc\.request\.started/);
      assert.match(log.plaintext, /ipc\.request\.completed/);
      assert.equal(log.raw.includes('ipc.request.started'), false);
    } finally {
      protectedArtifacts.dispose();
    }
  });

  console.log(JSON.stringify({ status: 'passed', checks: checks.length, names: checks }, null, 2));
} finally {
  await rm(root, { recursive: true, force: true });
}
