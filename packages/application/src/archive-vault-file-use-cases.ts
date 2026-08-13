import {
  ERROR_CODES,
  createAppError,
  err,
  type AppError,
  type CorrelationId,
  type Result
} from '@ppt/core';

export interface StoredArchiveFile {
  readonly originalName: string;
  readonly storedName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  /** True only when this call created the encrypted vault member. */
  readonly createdNewFile: boolean;
}

export interface ArchiveVaultFilePort {
  store(
    input: { readonly sourcePath: string; readonly itemId: string },
    correlationId: CorrelationId
  ): Result<StoredArchiveFile, AppError>;
  materialize(
    input: {
      readonly itemId: string;
      readonly storedName: string;
      readonly originalName: string;
      readonly expectedSha256: string;
    },
    correlationId: CorrelationId
  ): Result<string, AppError>;
  readBytes(
    input: {
      readonly itemId: string;
      readonly storedName: string;
      readonly expectedSha256: string;
      readonly expectedSizeBytes: number;
      readonly maximumBytes: number;
    },
    correlationId: CorrelationId
  ): Result<Uint8Array, AppError>;
  destroy(
    input: { readonly storedName: string; readonly secureDestroy: boolean },
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

export class StoreArchiveFileUseCase {
  public constructor(private readonly files: ArchiveVaultFilePort) {}

  public execute(
    correlationId: CorrelationId,
    input: { readonly sourcePath: string; readonly itemId: string }
  ): Result<StoredArchiveFile, AppError> {
    if (!input.sourcePath.trim()) return err(invalid(correlationId, 'Kaynak dosya yolu zorunludur.'));
    if (!input.itemId.trim()) return err(invalid(correlationId, 'Arşiv kaydı kimliği zorunludur.'));
    return this.files.store(input, correlationId);
  }
}

export class MaterializeArchiveFileUseCase {
  public constructor(private readonly files: ArchiveVaultFilePort) {}

  public execute(
    correlationId: CorrelationId,
    input: {
      readonly itemId: string;
      readonly storedName: string;
      readonly originalName: string;
      readonly expectedSha256: string;
    }
  ): Result<string, AppError> {
    if (!input.itemId.trim()) return err(invalid(correlationId, 'Arşiv kaydı kimliği zorunludur.'));
    if (!input.storedName.trim()) return err(invalid(correlationId, 'Kasa dosyası adı zorunludur.'));
    if (!input.originalName.trim()) return err(invalid(correlationId, 'Özgün dosya adı zorunludur.'));
    if (!/^[a-f0-9]{64}$/i.test(input.expectedSha256)) {
      return err(invalid(correlationId, 'Dosya özeti geçersizdir.'));
    }
    return this.files.materialize(input, correlationId);
  }
}

export class ReadArchiveFileBytesUseCase {
  public constructor(private readonly files: ArchiveVaultFilePort) {}

  public execute(
    correlationId: CorrelationId,
    input: {
      readonly itemId: string;
      readonly storedName: string;
      readonly expectedSha256: string;
      readonly expectedSizeBytes: number;
      readonly maximumBytes: number;
    }
  ): Result<Uint8Array, AppError> {
    if (!input.itemId.trim()) return err(invalid(correlationId, 'Arşiv kaydı kimliği zorunludur.'));
    if (!input.storedName.trim()) return err(invalid(correlationId, 'Kasa dosyası adı zorunludur.'));
    if (!/^[a-f0-9]{64}$/i.test(input.expectedSha256)) {
      return err(invalid(correlationId, 'Dosya özeti geçersizdir.'));
    }
    if (!Number.isSafeInteger(input.expectedSizeBytes) || input.expectedSizeBytes < 1) {
      return err(invalid(correlationId, 'Beklenen dosya boyutu geçersizdir.'));
    }
    if (!Number.isSafeInteger(input.maximumBytes) || input.maximumBytes < 1) {
      return err(invalid(correlationId, 'Dosya okuma üst sınırı geçersizdir.'));
    }
    if (input.expectedSizeBytes > input.maximumBytes) {
      return err(invalid(correlationId, 'Arşiv dosyası izin verilen okuma üst sınırını aşıyor.'));
    }
    return this.files.readBytes(input, correlationId);
  }
}

export class DestroyArchiveFileUseCase {
  public constructor(private readonly files: ArchiveVaultFilePort) {}

  public execute(
    correlationId: CorrelationId,
    input: { readonly storedName: string; readonly secureDestroy: boolean }
  ): Result<void, AppError> {
    if (!input.storedName.trim()) return err(invalid(correlationId, 'Kasa dosyası adı zorunludur.'));
    return this.files.destroy(input, correlationId);
  }
}
