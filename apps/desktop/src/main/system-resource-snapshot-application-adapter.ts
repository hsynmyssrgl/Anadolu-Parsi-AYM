import { existsSync, readdirSync, statSync } from 'node:fs';
import { arch, cpus, freemem, loadavg, platform, totalmem } from 'node:os';
import { join } from 'node:path';
import type { SystemResourceSnapshotPort } from '@ppt/application';
import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId
} from '@ppt/core';

export class NodeSystemResourceSnapshotPort implements SystemResourceSnapshotPort {
  public inspect(
    input: { readonly databasePath: string; readonly archivePath: string },
    correlationId: CorrelationId
  ): ReturnType<SystemResourceSnapshotPort['inspect']> {
    try {
      const processors = cpus();
      const totalMemoryBytes = totalmem();
      const freeMemoryBytes = freemem();
      const cpuCores = processors.length;
      const cpuLoadPercent = Math.round(
        Math.min(100, (loadavg()[0] ?? 0) / Math.max(cpuCores, 1) * 100) * 10
      ) / 10;
      const memoryUsagePercent = Math.round(
        ((totalMemoryBytes - freeMemoryBytes) / Math.max(totalMemoryBytes, 1)) * 1000
      ) / 10;
      const databaseBytes = existsSync(input.databasePath) ? statSync(input.databasePath).size : 0;
      const archiveBytes = readdirSync(input.archivePath).reduce((sum, name) => {
        try { return sum + statSync(join(input.archivePath, name)).size; }
        catch { return sum; }
      }, 0);

      return ok({
        platform: platform(),
        arch: arch(),
        cpuModel: processors[0]?.model ?? 'Bilinmiyor',
        cpuCores,
        cpuLoadPercent,
        totalMemoryBytes,
        freeMemoryBytes,
        memoryUsagePercent,
        databaseBytes,
        archiveBytes
      });
    } catch (error) {
      return err(this.#error(correlationId, error));
    }
  }

  #error(correlationId: CorrelationId, error: unknown): AppError {
    return createAppError({
      code: ERROR_CODES.CORE_UNEXPECTED,
      message: 'Sistem kaynak görünümü oluşturulamadı.',
      category: 'infrastructure',
      correlationId,
      details: { cause: error instanceof Error ? error.message : String(error) }
    });
  }
}
