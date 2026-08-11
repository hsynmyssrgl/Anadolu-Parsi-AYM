import { randomUUID } from 'node:crypto';
import type {
  FamilyMutationResultView,
  FamilyMutationRevisionKey,
  FamilyMutationRevisionsView
} from '@ppt/domain';

type MutableMutationRevisions = { -readonly [K in keyof FamilyMutationRevisionsView]: number };
export type FamilyMutationResultInput = Omit<FamilyMutationResultView, 'mutationId' | 'occurredAt' | 'revisions'>;

const createInitialRevisions = (): MutableMutationRevisions => ({
  graph: 0,
  timeline: 0,
  personCatalog: 0,
  eventCatalog: 0,
  dashboard: 0,
  notifications: 0,
  archive: 0
});

export class FamilyMutationRevisionService {
  readonly #revisions = createInitialRevisions();

  public record(input: FamilyMutationResultInput, occurredAt: string): FamilyMutationResultView {
    const uniqueRevisionKeys = new Set<FamilyMutationRevisionKey>(input.changedRevisions);
    if (uniqueRevisionKeys.size !== input.changedRevisions.length) {
      throw new Error('Mutasyon revizyon anahtarları yinelenemez.');
    }
    if (new Set(input.changedSections).size !== input.changedSections.length) {
      throw new Error('Mutasyon bölüm anahtarları yinelenemez.');
    }
    for (const key of uniqueRevisionKeys) this.#revisions[key] += 1;
    return {
      ...input,
      mutationId: randomUUID(),
      occurredAt,
      revisions: { ...this.#revisions }
    };
  }

  public snapshot(): FamilyMutationRevisionsView {
    return { ...this.#revisions };
  }
}
