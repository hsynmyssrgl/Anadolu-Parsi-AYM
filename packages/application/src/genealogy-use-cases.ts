import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type FamilyId,
  type IsoDate,
  type PersonId,
  type Result
} from '@ppt/core';
import type { GenealogyInsightView, RelationType } from '@ppt/domain';

export interface GenealogyPersonRecord {
  readonly id: PersonId;
  readonly familyId: FamilyId;
  readonly displayName: string;
  readonly birthDate?: IsoDate;
  readonly generation: number;
  readonly branch: string;
  readonly status: 'active' | 'archived';
}

export interface GenealogyRelationRecord {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly fromPersonId: PersonId;
  readonly toPersonId: PersonId;
  readonly relationType: RelationType;
}

export interface GenealogyTimelineEventRecord {
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly participantPersonIds: readonly PersonId[];
}

export interface GenealogyReadModelContext {
  readonly familyId: FamilyId;
  readonly correlationId: CorrelationId;
}

export interface GenealogyReadModelQueryPort {
  load(context: GenealogyReadModelContext): Result<{
    readonly people: readonly GenealogyPersonRecord[];
    readonly relations: readonly GenealogyRelationRecord[];
    readonly events: readonly GenealogyTimelineEventRecord[];
  }, AppError>;
}

export interface GenealogyGenerationAnalysis {
  readonly generationByPersonId: ReadonlyMap<PersonId, number>;
  readonly parentedPersonIds: ReadonlySet<PersonId>;
  readonly cyclePersonIds: readonly PersonId[];
  readonly brokenRelationIds: readonly string[];
  readonly normalizedParentLinkCount: number;
}

const clampGeneration = (value: number): number => Number.isInteger(value)
  ? Math.max(1, Math.min(20, value))
  : 1;

/**
 * Computes safe generation levels without trusting malformed relation chains.
 * Stored generations remain the baseline; valid acyclic parent links may only
 * move descendants to a deeper generation. Parent links inside a cycle are
 * excluded, so corrupt data cannot cause an infinite relaxation loop.
 */
export const calculateGenealogyGenerations = (input: {
  readonly people: readonly Pick<GenealogyPersonRecord, 'id' | 'generation'>[];
  readonly relations: readonly Pick<GenealogyRelationRecord, 'id' | 'fromPersonId' | 'toPersonId' | 'relationType'>[];
}): GenealogyGenerationAnalysis => {
  const personIds = new Set<PersonId>(input.people.map((person) => person.id));
  const generationByPersonId = new Map<PersonId, number>(
    input.people.map((person) => [person.id, clampGeneration(person.generation)])
  );
  const brokenRelationIds: string[] = [];
  const edges: Array<{ relationId: string; parentId: PersonId; childId: PersonId }> = [];

  for (const relation of input.relations) {
    if (!personIds.has(relation.fromPersonId) || !personIds.has(relation.toPersonId)) {
      brokenRelationIds.push(relation.id);
      continue;
    }
    if (relation.relationType === 'parent') {
      edges.push({ relationId: relation.id, parentId: relation.fromPersonId, childId: relation.toPersonId });
    } else if (relation.relationType === 'child') {
      edges.push({ relationId: relation.id, parentId: relation.toPersonId, childId: relation.fromPersonId });
    }
  }

  const adjacency = new Map<PersonId, PersonId[]>();
  for (const edge of edges) {
    const children = adjacency.get(edge.parentId) ?? [];
    children.push(edge.childId);
    adjacency.set(edge.parentId, children);
  }

  const visiting = new Set<PersonId>();
  const visited = new Set<PersonId>();
  const cyclePersonIds = new Set<PersonId>();
  const stack: PersonId[] = [];

  const visit = (personId: PersonId): void => {
    if (visited.has(personId)) return;
    if (visiting.has(personId)) {
      const start = stack.lastIndexOf(personId);
      for (const member of stack.slice(Math.max(0, start))) cyclePersonIds.add(member);
      cyclePersonIds.add(personId);
      return;
    }
    visiting.add(personId);
    stack.push(personId);
    for (const childId of adjacency.get(personId) ?? []) visit(childId);
    stack.pop();
    visiting.delete(personId);
    visited.add(personId);
  };
  for (const personId of personIds) visit(personId);

  const safeEdges = edges.filter((edge) => !cyclePersonIds.has(edge.parentId) && !cyclePersonIds.has(edge.childId));
  const parentedPersonIds = new Set<PersonId>(safeEdges.map((edge) => edge.childId));

  // Longest-path relaxation is bounded by the number of people and only uses
  // acyclic edges. Stored generation is the compatibility baseline.
  for (let pass = 0; pass < input.people.length; pass += 1) {
    let changed = false;
    for (const edge of safeEdges) {
      const parentGeneration = generationByPersonId.get(edge.parentId) ?? 1;
      const childGeneration = generationByPersonId.get(edge.childId) ?? 1;
      const next = Math.min(20, Math.max(childGeneration, parentGeneration + 1));
      if (next !== childGeneration) {
        generationByPersonId.set(edge.childId, next);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return {
    generationByPersonId,
    parentedPersonIds,
    cyclePersonIds: [...cyclePersonIds].sort(),
    brokenRelationIds: brokenRelationIds.sort(),
    normalizedParentLinkCount: safeEdges.length
  };
};

export class GetGenealogyReadModelUseCase {
  public constructor(private readonly query: GenealogyReadModelQueryPort) {}

  public execute(context: GenealogyReadModelContext): Result<GenealogyInsightView, AppError> {
    const loaded = this.query.load(context);
    if (!loaded.ok) return loaded;

    const activePeople = loaded.value.people.filter((person) => person.status === 'active');
    const analysis = calculateGenealogyGenerations({
      people: activePeople,
      relations: loaded.value.relations
    });

    const branches = [...new Set(activePeople.map((person) => person.branch))]
      .map((name) => ({
        name,
        members: activePeople.filter((person) => person.branch === name).length
      }))
      .sort((left, right) => right.members - left.members || left.name.localeCompare(right.name, 'tr-TR'));

    const births = activePeople
      .filter((person): person is GenealogyPersonRecord & { birthDate: IsoDate } => Boolean(person.birthDate))
      .map((person) => ({
        id: `birth-${person.id}`,
        date: new Date(`${person.birthDate}T00:00:00.000Z`).toISOString(),
        title: `${person.displayName} doğdu`,
        kind: 'birth' as const,
        personIds: [person.id]
      }));

    const knownPersonIds = new Set(activePeople.map((person) => person.id));
    const events = loaded.value.events.map((event) => ({
      id: event.id,
      date: event.date,
      title: event.title,
      kind: 'event' as const,
      personIds: event.participantPersonIds.filter((personId) => knownPersonIds.has(personId))
    }));

    const maximumGeneration = Math.max(
      0,
      ...activePeople.map((person) => analysis.generationByPersonId.get(person.id) ?? clampGeneration(person.generation))
    );

    return ok({
      generations: maximumGeneration,
      branches,
      missingParentLinks: activePeople
        .filter((person) => (analysis.generationByPersonId.get(person.id) ?? 1) > 1)
        .filter((person) => !analysis.parentedPersonIds.has(person.id))
        .map((person) => person.displayName)
        .sort((left, right) => left.localeCompare(right, 'tr-TR')),
      timeline: [...births, ...events].sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id)),
      integrity: {
        cyclePersonIds: [...analysis.cyclePersonIds],
        brokenRelationIds: [...analysis.brokenRelationIds],
        normalizedParentLinkCount: analysis.normalizedParentLinkCount,
        calculatedGenerationCount: activePeople.length
      }
    });
  }
}

