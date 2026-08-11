import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  StoredCorrelationContextProvider,
  SystemClock,
  asCorrelationId,
  asIsoDateTime,
  type Clock,
  type CorrelationContext
} from '@ppt/core';
import {
  applyConfigOverrides,
  createDefaultConfig,
  resolveRuntimeEnvironment,
  validateConfig,
  type AppConfig,
  type AppConfigOverrides
} from '@ppt/config';
import { writeContentFreeConsoleEvent, type Logger } from '@ppt/logging';
import { ProtectedSideArtifactLogger } from './protected-side-artifact-logger.js';
import type { ProtectedSideArtifactStore } from './protected-side-artifact-store.js';

export interface DesktopRuntime {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly correlation: StoredCorrelationContextProvider;
  readonly clock: Clock;
  readonly protectedArtifacts: ProtectedSideArtifactStore;
}

export interface BootstrapDesktopRuntimeInput {
  readonly version: string;
  readonly isPackaged: boolean;
  readonly userDataPath: string;
  readonly volatileRootPath: string;
  readonly protectedArtifacts: ProtectedSideArtifactStore;
  readonly environment?: string;
  readonly configOverrides?: AppConfigOverrides;
}

export const bootstrapDesktopRuntime = (input: BootstrapDesktopRuntimeInput): DesktopRuntime => {
  const paths = {
    data: join(input.userDataPath, 'data'),
    archive: join(input.userDataPath, 'archive'),
    cache: join(input.volatileRootPath, 'cache'),
    logs: join(input.userDataPath, 'logs'),
    temp: join(input.volatileRootPath, 'temp'),
    secrets: join(input.userDataPath, 'secrets')
  };
  const config = applyConfigOverrides(createDefaultConfig({
    version: input.version,
    environment: resolveRuntimeEnvironment(input.environment, input.isPackaged),
    paths
  }), input.configOverrides);
  const validation = validateConfig(config);
  if (!validation.ok) {
    throw new Error(`${validation.error.code}: ${validation.error.message}`);
  }
  for (const path of Object.values(config.paths)) mkdirSync(path, { recursive: true });

  const logger = new ProtectedSideArtifactLogger({
    directory: config.paths.logs,
    store: input.protectedArtifacts,
    maxFileBytes: config.logging.maxFileBytes,
    retentionDays: config.logging.retentionDays,
    minimumLevel: config.logging.level,
    onWriteError: (failure) => {
      writeContentFreeConsoleEvent({
        timestamp: asIsoDateTime(new Date().toISOString()),
        level: 'error',
        service: 'desktop-main',
        process: 'logging',
        event: 'protected_log.write_failed',
        correlationId: asCorrelationId('protected-log-write'),
        outcome: 'failure',
        metadata: { failureCode: failure.code, reason: failure.reason }
      }, 'stderr');
    }
  });
  const correlation = new StoredCorrelationContextProvider(
    new AsyncLocalStorage<CorrelationContext>()
  );
  const clock = new SystemClock();
  logger.info({
    timestamp: clock.now(),
    service: 'desktop-main',
    process: 'electron-main',
    event: 'runtime.bootstrap.completed',
    correlationId: asCorrelationId('runtime-bootstrap'),
    outcome: 'success',
    metadata: {
      applicationVersion: config.app.version,
      environment: config.app.environment,
      loggingLevel: config.logging.level
    }
  });
  return { config, logger, correlation, clock, protectedArtifacts: input.protectedArtifacts };
};
