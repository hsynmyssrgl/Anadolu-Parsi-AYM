import { createHash, randomUUID } from 'node:crypto';
import { asCorrelationId, asFamilyId, asPersonId, asUserId, type CorrelationId } from '@ppt/core';
import type {
  EntityCatalogLookupInput,
  EntityCatalogLookupView,
  EventCatalogItemView,
  EventCatalogPageInput,
  EventCatalogPageView,
  FamilyMemberView,
  PersonCatalogPageInput,
  PersonCatalogPageView
} from '@ppt/domain';
import type {
  EntityCatalogRepositoryPort,
  EventCatalogCursor,
  PersonCatalogCursor,
  RepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';

const DEFAULT_PAGE_SIZE = 40;
const MAX_PAGE_SIZE = 100;
const MAX_QUERY_LENGTH = 120;
const MAX_CURSOR_LENGTH = 512;
const MAX_LOOKUP_IDS = 100;

type CursorEnvelope =
  | { readonly v: 1; readonly kind: 'person'; readonly scope: string; readonly displayName: string; readonly id: string }
  | { readonly v: 1; readonly kind: 'event'; readonly scope: string; readonly startAt: string; readonly id: string };

const boundedText = (value: unknown, label: string, maximum = MAX_QUERY_LENGTH): string => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new TypeError(`${label} metin olmalıdır.`);
  const normalized = value.trim();
  if (normalized.length > maximum) throw new RangeError(`${label} en fazla ${maximum} karakter olabilir.`);
  return normalized;
};

const pageSize = (value: unknown): number => {
  if (value === undefined) return DEFAULT_PAGE_SIZE;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 10 || value > MAX_PAGE_SIZE) {
    throw new RangeError(`Katalog sayfa boyutu 10-${MAX_PAGE_SIZE} arasında tam sayı olmalıdır.`);
  }
  return value;
};

const scopeHash = (kind: CursorEnvelope['kind'], accountId: string, filters: Record<string, unknown>): string =>
  createHash('sha256').update(JSON.stringify({ v: 1, kind, accountId, filters })).digest('hex');

const encodeCursor = (value: CursorEnvelope): string => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

const decodeCursor = (value: unknown, kind: CursorEnvelope['kind'], expectedScope: string): CursorEnvelope | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_CURSOR_LENGTH) throw new TypeError('Katalog imleci geçersizdir.');
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); }
  catch { throw new TypeError('Katalog imleci çözümlenemedi.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError('Katalog imleci geçersizdir.');
  const candidate = parsed as Record<string, unknown>;
  if (candidate.v !== 1 || candidate.kind !== kind || candidate.scope !== expectedScope) throw new TypeError('Katalog imleci mevcut kullanıcı ve filtre kapsamıyla uyumlu değildir.');
  const id = boundedText(candidate.id, 'Katalog imleç kimliği', 128);
  if (!id) throw new TypeError('Katalog imleç kimliği eksiktir.');
  if (kind === 'person') {
    const displayName = boundedText(candidate.displayName, 'Katalog kişi adı', 240);
    if (!displayName) throw new TypeError('Kişi katalog imleci geçersizdir.');
    return { v: 1, kind, scope: expectedScope, displayName, id };
  }
  const startAt = boundedText(candidate.startAt, 'Katalog olay tarihi', 64);
  if (!startAt || !Number.isFinite(Date.parse(startAt))) throw new TypeError('Olay katalog imleci geçersizdir.');
  return { v: 1, kind, scope: expectedScope, startAt, id };
};

const initials = (displayName: string): string => displayName.split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => part[0] ?? '').join('').toLocaleUpperCase('tr-TR');

const mapPerson = (row: import('@ppt/repository-contracts').PersonCatalogRow): FamilyMemberView => ({
  id: row.id,
  displayName: row.displayName,
  ...(row.birthDate ? { birthDate: row.birthDate } : {}),
  relationshipType: row.relationshipType,
  generation: row.generation,
  branch: row.branch,
  status: row.status === 'active' ? 'active' : 'archived',
  initials: initials(row.displayName)
});

const mapEvent = (row: import('@ppt/repository-contracts').EventCatalogRow): EventCatalogItemView => ({
  id: row.id,
  title: row.title,
  kind: row.kind,
  startAt: row.startAt,
  ...(row.archivedAt ? { archivedAt: row.archivedAt } : {})
});

const uniqueIds = (value: unknown, label: string): string[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`${label} bir dizi olmalıdır.`);
  if (value.length > MAX_LOOKUP_IDS) throw new RangeError(`${label} en fazla ${MAX_LOOKUP_IDS} kayıt içerebilir.`);
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const id = boundedText(item, label, 128);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
};

export interface EntityCatalogServiceDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly repository: EntityCatalogRepositoryPort;
  readonly currentAccountId: () => string;
  readonly currentCorrelationId?: () => CorrelationId | undefined;
  readonly canReadEvent: (eventId: string) => boolean;
}

export class EntityCatalogService {
  public constructor(private readonly dependencies: EntityCatalogServiceDependencies) {}

  #context(correlationId: CorrelationId, transaction: TransactionContext, accountId: string): RepositoryExecutionContext {
    return { transaction: transaction.transaction, actor: { userId: asUserId(accountId), roles: ['reader'] }, correlationId, occurredAt: transaction.occurredAt };
  }

  #correlationId(prefix: string): CorrelationId {
    return this.dependencies.currentCorrelationId?.()
      ?? asCorrelationId(`${prefix}-${randomUUID()}`);
  }

  public listPeople(input: PersonCatalogPageInput = {}): PersonCatalogPageView {
    const limit = pageSize(input.limit);
    const query = boundedText(input.query, 'Kişi katalog araması').toLocaleLowerCase('tr-TR');
    const accountId = this.dependencies.currentAccountId();
    const scope = scopeHash('person', accountId, { query });
    const decoded = decodeCursor(input.cursor, 'person', scope) as Extract<CursorEnvelope, { kind: 'person' }> | undefined;
    const cursor: PersonCatalogCursor | undefined = decoded ? { displayName: decoded.displayName, id: decoded.id } : undefined;
    const correlationId = this.#correlationId('person-catalog');
    const started = performance.now();
    const result = this.dependencies.transactionExecutor.execute(correlationId, (transaction) => this.dependencies.repository.listPeoplePage(
      this.#context(correlationId, transaction, accountId),
      { familyId: asFamilyId('family-main'), limit: limit + 1, query, ...(cursor ? { cursor } : {}) }
    ));
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    const hasMore = result.value.length > limit;
    const rows = result.value.slice(0, limit);
    const last = rows.at(-1);
    return {
      items: rows.map(mapPerson),
      hasMore,
      ...(hasMore && last ? { nextCursor: encodeCursor({ v: 1, kind: 'person', scope, displayName: last.displayName, id: last.id }) } : {}),
      metrics: { returned: rows.length, scanned: result.value.length, queryDurationMs: Number((performance.now() - started).toFixed(2)), limit }
    };
  }

  public listEvents(input: EventCatalogPageInput = {}): EventCatalogPageView {
    const limit = pageSize(input.limit);
    const query = boundedText(input.query, 'Olay katalog araması').toLocaleLowerCase('tr-TR');
    const personIdText = boundedText(input.personId, 'Kişi kimliği', 128);
    const kind = boundedText(input.kind, 'Olay türü', 64);
    const archiveMode = input.archiveMode ?? 'active';
    if (!['active', 'archived', 'all'].includes(archiveMode)) throw new RangeError('Olay katalog arşiv modu geçersizdir.');
    const accountId = this.dependencies.currentAccountId();
    const scope = scopeHash('event', accountId, { query, personId: personIdText, kind, archiveMode });
    const decoded = decodeCursor(input.cursor, 'event', scope) as Extract<CursorEnvelope, { kind: 'event' }> | undefined;
    const cursor: EventCatalogCursor | undefined = decoded ? { startAt: decoded.startAt, id: decoded.id } : undefined;
    const correlationId = this.#correlationId('event-catalog');
    const started = performance.now();
    const result = this.dependencies.transactionExecutor.execute(correlationId, (transaction) => this.dependencies.repository.listEventsPage(
      this.#context(correlationId, transaction, accountId),
      {
        familyId: asFamilyId('family-main'), limit: limit + 1, query, kind, archiveMode,
        ...(personIdText ? { personId: asPersonId(personIdText) } : {}), ...(cursor ? { cursor } : {})
      }
    ));
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    const scanned = result.value;
    const pageRows = scanned.slice(0, limit);
    const visible = pageRows.filter((row) => this.dependencies.canReadEvent(row.id));
    const hasMore = scanned.length > limit;
    const last = pageRows.at(-1);
    return {
      items: visible.map(mapEvent),
      hasMore,
      ...(hasMore && last ? { nextCursor: encodeCursor({ v: 1, kind: 'event', scope, startAt: last.startAt, id: last.id }) } : {}),
      metrics: { returned: visible.length, scanned: scanned.length, queryDurationMs: Number((performance.now() - started).toFixed(2)), limit }
    };
  }

  public lookup(input: EntityCatalogLookupInput = {}): EntityCatalogLookupView {
    const personIds = uniqueIds(input.personIds, 'Kişi kimlikleri');
    const eventIds = uniqueIds(input.eventIds, 'Olay kimlikleri');
    const accountId = this.dependencies.currentAccountId();
    const correlationId = this.#correlationId('entity-catalog-lookup');
    const result = this.dependencies.transactionExecutor.execute(correlationId, (transaction) => {
      const context = this.#context(correlationId, transaction, accountId);
      const people = this.dependencies.repository.findPeopleByIds(context, asFamilyId('family-main'), personIds.map(asPersonId));
      if (!people.ok) return people;
      const events = this.dependencies.repository.findEventsByIds(context, asFamilyId('family-main'), eventIds);
      if (!events.ok) return events;
      return { ok: true as const, value: { people: people.value, events: events.value } };
    });
    if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
    return {
      people: result.value.people.map(mapPerson),
      events: result.value.events.filter((row) => this.dependencies.canReadEvent(row.id)).map(mapEvent)
    };
  }
}
