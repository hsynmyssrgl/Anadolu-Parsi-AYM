import type {
  AuditStorageProtectionCommandPort,
  BackupDatabaseSafetyPort,
  DatabaseMaintenanceCommandPort,
  DatabaseMaintenanceOperation,
  DatabaseRuntimeHealthQueryPort
} from '@ppt/application';
import type { DatabaseExecutor } from '@ppt/contracts';
import type { CorrelationId } from '@ppt/core';
import {
  checkpointSqliteForBackup,
  executeSqliteMaintenance,
  inspectSqliteRuntimeHealth,
  installSqliteAuditAppendOnlyGuards,
  prepareSqliteRestoredDatabaseForReauthorization,
  verifySqliteBackupFileIntegrity
} from '@ppt/database';

/** SQLite implementation of the application-level database health port. */
export class SqliteDatabaseRuntimeHealthQueryPort implements DatabaseRuntimeHealthQueryPort {
  public constructor(private readonly database: DatabaseExecutor) {}

  public inspect(
    correlationId: CorrelationId
  ): ReturnType<DatabaseRuntimeHealthQueryPort['inspect']> {
    return inspectSqliteRuntimeHealth(this.database, correlationId);
  }
}

/** SQLite implementation of the application-level audit protection port. */
export class SqliteAuditStorageProtectionCommandPort implements AuditStorageProtectionCommandPort {
  public constructor(private readonly database: DatabaseExecutor) {}

  public install(
    correlationId: CorrelationId
  ): ReturnType<AuditStorageProtectionCommandPort['install']> {
    return installSqliteAuditAppendOnlyGuards(this.database, correlationId);
  }
}

/** SQLite implementation of the application-level backup safety port. */
export class SqliteBackupDatabaseSafetyPort implements BackupDatabaseSafetyPort {
  public constructor(private readonly database: DatabaseExecutor) {}

  public checkpoint(
    correlationId: CorrelationId
  ): ReturnType<BackupDatabaseSafetyPort['checkpoint']> {
    return checkpointSqliteForBackup(this.database, correlationId);
  }

  public verifyFile(
    databasePath: string,
    correlationId: CorrelationId
  ): ReturnType<BackupDatabaseSafetyPort['verifyFile']> {
    return verifySqliteBackupFileIntegrity(databasePath, correlationId);
  }

  public prepareRestoredFileForReauthorization(
    databasePath: string,
    restoredAt: string,
    correlationId: CorrelationId
  ): ReturnType<BackupDatabaseSafetyPort['prepareRestoredFileForReauthorization']> {
    return prepareSqliteRestoredDatabaseForReauthorization(databasePath, restoredAt, correlationId);
  }
}

/** SQLite implementation of the application-level maintenance command port. */
export class SqliteDatabaseMaintenanceCommandPort implements DatabaseMaintenanceCommandPort {
  public constructor(private readonly database: DatabaseExecutor) {}

  public execute(
    operation: DatabaseMaintenanceOperation,
    correlationId: CorrelationId
  ): ReturnType<DatabaseMaintenanceCommandPort['execute']> {
    return executeSqliteMaintenance(this.database, operation, correlationId);
  }
}
