import type { CoreServiceFamilyDataCutoverReadinessEntryContract } from '@ppt/core-service-contracts';

export interface ProtectedCutoverReadinessAnchor {
  readonly schemaVersion: 1;
  readonly epoch: number;
  readonly entryCount: number;
  readonly headHash: string;
}

export interface ProtectedCutoverReadinessSnapshot {
  readonly schemaVersion: 1;
  readonly entries: readonly CoreServiceFamilyDataCutoverReadinessEntryContract[];
  readonly anchor: ProtectedCutoverReadinessAnchor;
}

export interface ProtectedCutoverReadinessCommit {
  readonly expectedAnchor: ProtectedCutoverReadinessAnchor;
  readonly nextSnapshot: ProtectedCutoverReadinessSnapshot;
}

export interface ProtectedCutoverReadinessJournalPort {
  readonly protectionId: string | null;
  readonly available: boolean;
  load(): Promise<ProtectedCutoverReadinessSnapshot | null>;
  compareAndSwap(commit: ProtectedCutoverReadinessCommit): Promise<void>;
  seal(): Promise<void>;
}

export type ProtectedCutoverReadinessJournalErrorCode =
  | 'JOURNAL_UNAVAILABLE'
  | 'ANCHOR_MISMATCH'
  | 'JOURNAL_INVALID';

export class ProtectedCutoverReadinessJournalError extends Error {
  public readonly code: ProtectedCutoverReadinessJournalErrorCode;

  public constructor(code: ProtectedCutoverReadinessJournalErrorCode, message: string) {
    super(message);
    this.name = 'ProtectedCutoverReadinessJournalError';
    this.code = code;
  }
}

const unavailable = (): ProtectedCutoverReadinessJournalError =>
  new ProtectedCutoverReadinessJournalError(
    'JOURNAL_UNAVAILABLE',
    'Protected cutover-readiness journal is not attached'
  );

export class DetachedProtectedCutoverReadinessJournal implements ProtectedCutoverReadinessJournalPort {
  public readonly protectionId = null;
  public readonly available = false;

  public async load(): Promise<never> {
    throw unavailable();
  }

  public async compareAndSwap(_commit: ProtectedCutoverReadinessCommit): Promise<never> {
    throw unavailable();
  }

  public async seal(): Promise<never> {
    throw unavailable();
  }
}
