import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type CorrelationId
} from '@ppt/core';
import type { SourceDeletionRuntimeCacheInvalidationPort } from '@ppt/application';
import type {
  SourceDeletionCacheInvalidation,
  SourceDeletionIdentity
} from '@ppt/platform-policy';

export interface DesktopSourceDeletionExternalCacheInvalidator {
  invalidate(): readonly {
    readonly registryId: 'ipc-main-read' | 'offline-sensitive';
    readonly invalidatedEntryCount: number;
  }[];
}
export class DesktopSourceDeletionRuntimeCacheInvalidationPort implements SourceDeletionRuntimeCacheInvalidationPort {
  public constructor(
    private readonly clearFamilyImportPreviews: () => number,
    private readonly external: DesktopSourceDeletionExternalCacheInvalidator = {
      invalidate: () => Object.freeze([
        Object.freeze({ registryId: 'ipc-main-read' as const, invalidatedEntryCount: 0 }),
        Object.freeze({ registryId: 'offline-sensitive' as const, invalidatedEntryCount: 0 })
      ])
    }
  ) {}

  public invalidate(
    input: SourceDeletionIdentity,
    correlationId: CorrelationId
  ): ReturnType<SourceDeletionRuntimeCacheInvalidationPort['invalidate']> {
    try {
      const familyCount = this.clearFamilyImportPreviews();
      const external = this.external.invalidate();
      const invalidations: readonly SourceDeletionCacheInvalidation[] = Object.freeze([
        Object.freeze({ registryId: 'family-import-preview', invalidatedEntryCount: familyCount, invalidatedAt: input.purgedAt }),
        ...external.map((entry) => Object.freeze({ ...entry, invalidatedAt: input.purgedAt }))
      ]);
      return ok(invalidations);
    } catch (error) {
      return err(createAppError({
        code: ERROR_CODES.CORE_UNEXPECTED,
        message: 'Kaynak silme öncesinde runtime cache sahipleri temizlenemedi.',
        category: 'infrastructure',
        correlationId,
        details: { cause: error instanceof Error ? error.message : String(error) }
      }));
    }
  }
}
