import {
  ERROR_CODES,
  createAppError,
  err,
  type AppError,
  type CorrelationId,
  type Result
} from '@ppt/core';
import type { BackupInspectionView } from '@ppt/domain';

export interface FullBackupRestorePlan {
  readonly transactionId: string;
  readonly stagingDirectory: string;
  readonly stagedDatabasePath: string;
  readonly stagedKeyPath: string;
  readonly stagedArchivePath: string;
  readonly databasePath: string;
  readonly keyPath: string;
  readonly archivePath: string;
}

export interface FullBackupFilePort {
  prepareDestination(
    input: { readonly destinationPath: string },
    correlationId: CorrelationId
  ): Result<void, AppError>;
  create(
    input: {
      readonly databasePath: string;
      readonly keyPath: string;
      readonly archivePath: string;
      readonly destinationPath: string;
      readonly createdAt: string;
      readonly password: string;
    },
    correlationId: CorrelationId
  ): Result<void, AppError>;
  inspect(
    input: { readonly sourcePath: string; readonly password?: string },
    correlationId: CorrelationId
  ): Result<BackupInspectionView, AppError>;
  stageRestore(
    input: {
      readonly sourcePath: string;
      readonly databasePath: string;
      readonly keyPath: string;
      readonly archivePath: string;
      readonly password?: string;
    },
    correlationId: CorrelationId
  ): Result<FullBackupRestorePlan, AppError>;
  commitRestore(
    input: {
      readonly plan: FullBackupRestorePlan;
      readonly restoredAt: string;
      readonly safetyBackupPath: string;
      readonly revokedTrustedDeviceCount: number;
    },
    correlationId: CorrelationId
  ): Result<void, AppError>;
  discardRestore(
    input: { readonly plan: FullBackupRestorePlan },
    correlationId: CorrelationId
  ): Result<void, AppError>;
}

const invalid = (correlationId: CorrelationId, message: string): AppError =>
  createAppError({
    code: ERROR_CODES.CORE_INVALID_ARGUMENT,
    message,
    category: 'validation',
    correlationId
  });

const required = (
  correlationId: CorrelationId,
  value: string,
  label: string
): Result<void, AppError> => {
  if (!value.trim()) return err(invalid(correlationId, `${label} zorunludur.`));
  return { ok: true, value: undefined };
};

export class PrepareFullBackupDestinationUseCase {
  public constructor(private readonly files: FullBackupFilePort) {}

  public execute(correlationId: CorrelationId, destinationPath: string): Result<void, AppError> {
    const valid = required(correlationId, destinationPath, 'Yedek hedefi');
    if (!valid.ok) return valid;
    return this.files.prepareDestination({ destinationPath }, correlationId);
  }
}

export class CreateFullBackupUseCase {
  public constructor(private readonly files: FullBackupFilePort) {}

  public execute(
    correlationId: CorrelationId,
    input: {
      readonly databasePath: string;
      readonly keyPath: string;
      readonly archivePath: string;
      readonly destinationPath: string;
      readonly createdAt: string;
      readonly password: string;
    }
  ): Result<void, AppError> {
    for (const [value, label] of [
      [input.databasePath, 'Veritabanı yolu'],
      [input.keyPath, 'Kasa anahtarı yolu'],
      [input.archivePath, 'Arşiv yolu'],
      [input.destinationPath, 'Yedek hedefi']
    ] as const) {
      const valid = required(correlationId, value, label);
      if (!valid.ok) return valid;
    }
    if (!input.destinationPath.toLowerCase().endsWith('.pptbackup')) {
      return err(invalid(correlationId, 'Tam yedek .pptbackup uzantılı olmalıdır.'));
    }
    if (Number.isNaN(Date.parse(input.createdAt))) {
      return err(invalid(correlationId, 'Yedek oluşturma zamanı geçersizdir.'));
    }
    if (input.password.length < 12 || input.password.length > 1_024 || input.password.trim().length === 0) {
      return err(invalid(correlationId, 'Yedek parolası 12-1024 karakter arasında olmalıdır.'));
    }
    return this.files.create(input, correlationId);
  }
}

export class InspectFullBackupUseCase {
  public constructor(private readonly files: FullBackupFilePort) {}

  public execute(
    correlationId: CorrelationId,
    sourcePath: string,
    password?: string
  ): Result<BackupInspectionView, AppError> {
    const valid = required(correlationId, sourcePath, 'Yedek dosyası');
    if (!valid.ok) return valid;
    if (!sourcePath.toLowerCase().endsWith('.pptbackup')) {
      return err(invalid(correlationId, '[BKP-001] İncelenecek dosya .pptbackup uzantılı olmalıdır.'));
    }
    return this.files.inspect({ sourcePath, ...(password === undefined ? {} : { password }) }, correlationId);
  }
}

export class StageFullBackupRestoreUseCase {
  public constructor(private readonly files: FullBackupFilePort) {}

  public execute(
    correlationId: CorrelationId,
    input: {
      readonly sourcePath: string;
      readonly databasePath: string;
      readonly keyPath: string;
      readonly archivePath: string;
      readonly password?: string;
    }
  ): Result<FullBackupRestorePlan, AppError> {
    for (const [value, label] of [
      [input.sourcePath, 'Yedek dosyası'],
      [input.databasePath, 'Veritabanı yolu'],
      [input.keyPath, 'Kasa anahtarı yolu'],
      [input.archivePath, 'Arşiv yolu']
    ] as const) {
      const valid = required(correlationId, value, label);
      if (!valid.ok) return valid;
    }
    return this.files.stageRestore(input, correlationId);
  }
}

export class CommitFullBackupRestoreUseCase {
  public constructor(private readonly files: FullBackupFilePort) {}

  public execute(
    correlationId: CorrelationId,
    input: {
      readonly plan: FullBackupRestorePlan;
      readonly restoredAt: string;
      readonly safetyBackupPath: string;
      readonly revokedTrustedDeviceCount: number;
    }
  ): Result<void, AppError> {
    const safety = required(correlationId, input.safetyBackupPath, 'Emniyet yedeği yolu');
    if (!safety.ok) return safety;
    if (Number.isNaN(Date.parse(input.restoredAt))) {
      return err(invalid(correlationId, 'Geri yükleme zamanı geçersizdir.'));
    }
    if (!Number.isInteger(input.revokedTrustedDeviceCount) || input.revokedTrustedDeviceCount < 0) {
      return err(invalid(correlationId, 'İptal edilen güvenilir cihaz sayısı geçersizdir.'));
    }
    return this.files.commitRestore(input, correlationId);
  }
}

export class DiscardFullBackupRestoreUseCase {
  public constructor(private readonly files: FullBackupFilePort) {}

  public execute(
    correlationId: CorrelationId,
    plan: FullBackupRestorePlan
  ): Result<void, AppError> {
    if (!plan.transactionId.trim() || !plan.stagingDirectory.trim()) {
      return err(invalid(correlationId, 'Geri yükleme staging planı geçersizdir.'));
    }
    return this.files.discardRestore({ plan }, correlationId);
  }
}

