import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultConfig } from '@ppt/config';
import {
  StoredCorrelationContextProvider,
  SystemClock,
  asCorrelationId,
  type CorrelationContext
} from '@ppt/core';
import { FamilyDataStore } from '../src/main/data-store.js';
import { DesktopRepositoryPolicyScope } from '../src/main/desktop-repository-policy-scope.js';
import { VolatileSqliteSession } from '../src/main/volatile-sqlite-session.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('ilk aile üretim bileşimi', () => {
  it('politika korumalı bellek içi SQLite oturumunda ilk aileyi oluşturur', () => {
    const root = mkdtempSync(join(tmpdir(), 'parsyuva-first-family-production-'));
    temporaryDirectories.push(root);
    const config = createDefaultConfig({
      version: '22.08.2026.44',
      environment: 'production',
      paths: {
        data: join(root, 'data'),
        archive: join(root, 'archive'),
        cache: join(root, 'cache'),
        logs: join(root, 'logs'),
        temp: join(root, 'temp'),
        secrets: join(root, 'secrets')
      }
    });
    const clock = new SystemClock();
    const correlation = new StoredCorrelationContextProvider(
      new AsyncLocalStorage<CorrelationContext>()
    );
    const repositoryPolicyScope = new DesktopRepositoryPolicyScope();
    const session = new VolatileSqliteSession({
      stagingRoot: config.paths.temp,
      initialDatabaseBytes: Buffer.alloc(0),
      requireWindowsEfs: false
    });
    let store: FamilyDataStore | undefined;

    try {
      const provisioningCorrelationId = asCorrelationId('startup-first-family-production-test');
      store = correlation.run({ correlationId: provisioningCorrelationId }, () =>
        repositoryPolicyScope.runBootstrap({
          correlationId: provisioningCorrelationId,
          boundary: 'auth:getExternalIdentityProviders'
        }, () => new FamilyDataStore({
          databasePath: join(config.paths.data, config.database.fileName),
          databaseConnection: session.database,
          databaseSnapshotProvider: session,
          skipFileMigrationSafetyBackup: true,
          restoreDatabasePath: session.restoreDatabasePath(),
          deviceIdentityPath: join(config.paths.secrets, 'device-identity.json'),
          archivePath: config.paths.archive,
          applicationVersion: config.app.version,
          databaseConfig: config.database,
          securityConfig: config.security,
          clock,
          correlation,
          repositoryExecutionPolicyGuard: repositoryPolicyScope.guard,
          seed: false
        }))
      );

      const setupCorrelationId = asCorrelationId('ipc-first-family-production-test');
      const state = correlation.run({ correlationId: setupCorrelationId }, () =>
        repositoryPolicyScope.runBootstrap({
          correlationId: setupCorrelationId,
          boundary: 'auth:setup'
        }, () => store!.setupAdmin({
          familyName: 'Müyesseroğlu',
          displayName: 'Hüseyin Müyesseroğlu',
          password: 'GucluIlkAileParolasi!2026'
        }))
      );

      expect(state).toMatchObject({
        initialized: true,
        authenticated: true,
        displayName: 'Hüseyin Müyesseroğlu',
        trustedDevice: true
      });
    } finally {
      try { store?.close(); } finally { session.close(); }
    }
  });
});
