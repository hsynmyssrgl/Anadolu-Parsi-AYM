import { dirname, join } from 'node:path';
import type { FamilyStorageLayoutPort } from '@ppt/application';
import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId
} from '@ppt/core';

export class NodeFamilyStorageLayoutPort implements FamilyStorageLayoutPort {
  public resolve(
    input: {
      readonly databasePath: string;
      readonly deviceIdentityPath?: string;
      readonly archivePath?: string;
    },
    correlationId: CorrelationId
  ): ReturnType<FamilyStorageLayoutPort['resolve']> {
    try {
      const rootPath = dirname(input.databasePath);
      return ok({
        databasePath: input.databasePath,
        deviceIdentityPath:
          input.deviceIdentityPath ?? join(rootPath, 'secrets', 'device-identity.json'),
        archivePath: input.archivePath ?? join(rootPath, 'archive'),
        vaultKeyPath: join(rootPath, 'vault.key'),
        temporaryOpenPath: join(rootPath, 'temp-open')
      });
    } catch (error) {
      return err(this.#error(correlationId, error));
    }
  }

  #error(correlationId: CorrelationId, error: unknown): AppError {
    return createAppError({
      code: ERROR_CODES.CORE_UNEXPECTED,
      message: 'Aile depolama dizini oluşturulamadı.',
      category: 'infrastructure',
      correlationId,
      details: { cause: error instanceof Error ? error.message : String(error) }
    });
  }
}
