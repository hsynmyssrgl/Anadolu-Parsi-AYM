import type {
  FamilyMutationResultView,
  FamilyMutationRevisionKey,
  FamilyMutationRevisionsView
} from '@ppt/domain';

export interface AsyncWriteTicket {
  readonly scope: string;
  readonly epoch: number;
  readonly sequence: number;
}

export class AsyncWriteGuard {
  #epoch = 0;
  readonly #sequences = new Map<string, number>();

  public start(scope: string): AsyncWriteTicket {
    const normalized = scope.trim();
    if (!normalized) throw new Error('Asenkron yazma kapsamı boş olamaz.');
    const sequence = (this.#sequences.get(normalized) ?? 0) + 1;
    this.#sequences.set(normalized, sequence);
    return Object.freeze({ scope: normalized, epoch: this.#epoch, sequence });
  }

  public invalidate(scope: string): void {
    const normalized = scope.trim();
    if (!normalized) throw new Error('Asenkron yazma kapsamı boş olamaz.');
    this.#sequences.set(normalized, (this.#sequences.get(normalized) ?? 0) + 1);
  }

  public invalidateAll(): void {
    this.#epoch += 1;
    this.#sequences.clear();
  }

  public isCurrent(ticket: AsyncWriteTicket): boolean {
    return ticket.epoch === this.#epoch
      && this.#sequences.get(ticket.scope) === ticket.sequence;
  }

  public commit(ticket: AsyncWriteTicket, write: () => void): boolean {
    if (!this.isCurrent(ticket)) return false;
    write();
    return true;
  }

  public get epoch(): number {
    return this.#epoch;
  }
}

const revisionKeys: readonly FamilyMutationRevisionKey[] = [
  'graph',
  'timeline',
  'personCatalog',
  'eventCatalog',
  'dashboard',
  'notifications',
  'archive'
];

const initialRevisions = (): FamilyMutationRevisionsView => ({
  graph: 0,
  timeline: 0,
  personCatalog: 0,
  eventCatalog: 0,
  dashboard: 0,
  notifications: 0,
  archive: 0
});

export interface MutationRevisionAcceptance {
  readonly accepted: boolean;
  readonly duplicate: boolean;
  readonly advancedKeys: readonly FamilyMutationRevisionKey[];
  readonly revisions: FamilyMutationRevisionsView;
}

export class MutationRevisionWatermark {
  #revisions: FamilyMutationRevisionsView = initialRevisions();
  readonly #seenMutationIds = new Set<string>();
  readonly #seenMutationOrder: string[] = [];

  public constructor(readonly maxSeenMutationIds = 512) {
    if (!Number.isInteger(maxSeenMutationIds) || maxSeenMutationIds < 16 || maxSeenMutationIds > 4096) {
      throw new Error('Mutasyon kimliği kapasitesi 16 ile 4096 arasında olmalıdır.');
    }
  }

  public accept(result: FamilyMutationResultView): MutationRevisionAcceptance {
    if (this.#seenMutationIds.has(result.mutationId)) {
      return { accepted: false, duplicate: true, advancedKeys: [], revisions: { ...this.#revisions } };
    }
    for (const key of revisionKeys) {
      const value = result.revisions[key];
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`Geçersiz mutasyon revizyonu: ${key}.`);
      }
    }
    const changed = new Set(result.changedRevisions);
    if (changed.size !== result.changedRevisions.length) {
      throw new Error('Mutasyon revizyon anahtarları yinelenemez.');
    }
    const advancedKeys = result.changedRevisions.filter((key) => result.revisions[key] > this.#revisions[key]);
    this.#remember(result.mutationId);
    const merged = { ...this.#revisions };
    for (const key of revisionKeys) merged[key] = Math.max(merged[key], result.revisions[key]);
    this.#revisions = merged;
    return {
      accepted: advancedKeys.length > 0,
      duplicate: false,
      advancedKeys,
      revisions: { ...this.#revisions }
    };
  }

  public snapshot(): FamilyMutationRevisionsView {
    return { ...this.#revisions };
  }

  public reset(): void {
    this.#revisions = initialRevisions();
    this.#seenMutationIds.clear();
    this.#seenMutationOrder.length = 0;
  }

  #remember(mutationId: string): void {
    if (!mutationId.trim()) throw new Error('Mutasyon kimliği boş olamaz.');
    this.#seenMutationIds.add(mutationId);
    this.#seenMutationOrder.push(mutationId);
    while (this.#seenMutationOrder.length > this.maxSeenMutationIds) {
      const oldest = this.#seenMutationOrder.shift();
      if (oldest) this.#seenMutationIds.delete(oldest);
    }
  }
}
