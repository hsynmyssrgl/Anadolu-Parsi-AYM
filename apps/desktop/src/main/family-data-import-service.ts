import { createHash, randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import { lstatSync, readFileSync } from 'node:fs';
import {
  ERROR_CODES,
  asCorrelationId,
  asEventId,
  asIsoDate,
  asIsoDateTime,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import type { DataLifecycleApplicationContext, LocationApplicationContext, StrongAuthenticationPort, TimelineApplicationContext } from '@ppt/application';
import type {
  AccountRepositoryPort,
  AccountRow,
  AuditRepositoryPort,
  FamilyDataImportRepositoryPort,
  FamilyDataImportExistingData,
  FamilyDataImportBatchRecord,
  FamilyDataImportRollbackPolicyTarget,
  FamilyRepositoryPort,
  LocationRecord,
  LocationRepositoryPort,
  ObjectPermissionRepositoryPort,
  ObjectPermissionRow,
  PersonRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext,
  RelationRepositoryPort,
  RepositoryExecutionContext,
  TimelineRepositoryPort,
  TransactionExecutor
} from '@ppt/repository-contracts';
import type { TransactionContext } from '@ppt/contracts';
import type {
  ApplyFamilyDataImportInput,
  FamilyDataImportBatchView,
  FamilyDataImportEntitySummaryView,
  FamilyDataImportEntityType,
  FamilyDataImportIssueView,
  FamilyDataImportPreviewView,
  RollbackFamilyDataImportInput
} from '@ppt/domain';
import { computePlatformPolicyReceiptHash } from '@ppt/repositories';
import { CentralAuthorizationService, type AuthorizationAction, type AuthorizationGrant } from '@ppt/security';
import type { FamilyDataImportPolicyBatchRequest, FamilyDataImportPolicyBatchRunnerPort } from './family-data-import-policy-batch-runner.js';

const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
const PREVIEW_TTL_MS = 15 * 60 * 1000;
const ROLLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_PEOPLE = 10_000;
const MAX_RELATIONS = 20_000;
const MAX_LOCATIONS = 20_000;
const MAX_EVENTS = 20_000;

const RELATION_TYPES = new Set(['parent', 'spouse', 'child', 'sibling', 'guardian', 'other']);
const VISIBILITIES = new Set(['personal', 'selected_members', 'family']);
const RECURRENCES = new Set(['none', 'yearly']);
const LOCATION_KINDS = new Set(['venue', 'residence', 'memory', 'other']);

interface SourcePerson {
  readonly id: string;
  readonly displayName: string;
  readonly birthDate?: string;
  readonly relationshipType: string;
  readonly generation: number;
  readonly branch: string;
  readonly status: 'active' | 'inactive' | 'deceased';
}

interface SourceRelation {
  readonly id: string;
  readonly fromPersonId: string;
  readonly toPersonId: string;
  readonly relationType: 'parent' | 'spouse' | 'child' | 'sibling' | 'guardian' | 'other';
}

interface SourceLocation {
  readonly id: string;
  readonly label: string;
  readonly address?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly kind: 'venue' | 'residence' | 'memory' | 'other';
}

interface SourceEvent {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly description?: string;
  readonly startAt: string;
  readonly locationId?: string;
  readonly locationLabel?: string;
  readonly visibility: 'personal' | 'selected_members' | 'family';
  readonly participantPersonIds: readonly string[];
  readonly invitationText?: string;
  readonly notes?: string;
  readonly aiProcessingAllowed: boolean;
  readonly recurrence: 'none' | 'yearly';
  readonly reminderDays: readonly number[];
}

interface SourceDocument {
  readonly schemaVersion: 1;
  readonly exportId: string;
  readonly createdAt: string;
  readonly familyName: string;
  readonly people: readonly SourcePerson[];
  readonly relations: readonly SourceRelation[];
  readonly locations: readonly SourceLocation[];
  readonly events: readonly SourceEvent[];
}

type Resolution = 'created' | 'reused';
interface PlannedPerson { readonly sourceId: string; readonly targetId: string; readonly resolution: Resolution; readonly record: SourcePerson; }
interface PlannedRelation { readonly sourceId: string; readonly targetId: string; readonly resolution: Resolution; readonly record: SourceRelation; readonly fromTargetId: string; readonly toTargetId: string; }
interface PlannedLocation { readonly sourceId: string; readonly targetId: string; readonly resolution: Resolution; readonly record: SourceLocation; }
interface PlannedEvent {
  readonly sourceId: string;
  readonly targetId: string;
  readonly resolution: Resolution;
  readonly record: SourceEvent;
  readonly participantTargetIds: readonly string[];
  readonly targetLocationId?: string;
  readonly targetLocationResolution?: Resolution;
}

interface ImportPlan {
  readonly document: SourceDocument;
  readonly people: readonly PlannedPerson[];
  readonly relations: readonly PlannedRelation[];
  readonly locations: readonly PlannedLocation[];
  readonly events: readonly PlannedEvent[];
  readonly issues: readonly FamilyDataImportIssueView[];
  readonly summaries: readonly FamilyDataImportEntitySummaryView[];
  readonly digest: string;
}

interface CachedPreview {
  readonly preview: FamilyDataImportPreviewView;
  readonly familyId: string;
  readonly actorId: string;
  readonly sourcePath: string;
  readonly sourceSize: number;
  readonly sourceModifiedMs: number;
  readonly sourceText: string;
  readonly document: SourceDocument;
  readonly plan: ImportPlan;
  readonly planDigest: string;
}

export interface FamilyDataImportServiceDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly accountRepository: AccountRepositoryPort;
  readonly permissionRepository: ObjectPermissionRepositoryPort;
  readonly importRepository: FamilyDataImportRepositoryPort;
  readonly familyRepository: FamilyRepositoryPort;
  readonly personRepository: PersonRepositoryPort;
  readonly relationRepository: RelationRepositoryPort;
  readonly locationRepository?: LocationRepositoryPort;
  readonly timelineRepository: TimelineRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly strongAuthentication: StrongAuthenticationPort;
  readonly applicationContext: (prefix: string) => DataLifecycleApplicationContext;
  readonly policyBatchRunner?: FamilyDataImportPolicyBatchRunnerPort;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const normalizeText = (value: string): string => value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('tr-TR');
const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const importCorrelation = (parent: string, kind: 'location' | 'location-read' | 'event' | 'rollback-location' | 'rollback-event', index: number, resourceId: string) =>
  asCorrelationId(`${parent.slice(0, 72)}:imp:${kind}:${index}:${sha256(resourceId).slice(0, 12)}`);
const timelineSensitivity = (visibility: SourceEvent['visibility']): 'personal' | 'sensitive' | 'highly_sensitive' =>
  visibility === 'personal' ? 'highly_sensitive' : visibility === 'selected_members' ? 'sensitive' : 'personal';
const isIsoDateTime = (value: string): boolean => Number.isFinite(Date.parse(value)) && value.includes('T');
const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/u.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
const stringValue = (value: unknown, maximum: number): string | undefined => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maximum ? value.trim() : undefined;
const optionalString = (value: unknown, maximum: number): string | undefined => value === undefined || value === null || value === '' ? undefined : stringValue(value, maximum);
const invalidOptionalString = (value: unknown, maximum: number): boolean => value !== undefined && value !== null && value !== '' && optionalString(value, maximum) === undefined;
const repositoryContext = (context: DataLifecycleApplicationContext, transaction: TransactionContext): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  correlationId: context.correlationId,
  occurredAt: transaction.occurredAt,
  actor: {
    userId: context.actor.userId,
    roles: [context.actor.role],
    ...(context.actor.personId ? { personId: context.actor.personId } : {})
  }
});

const activeAccount = (account: AccountRow, occurredAt: string): boolean =>
  account.status === 'active' &&
  Date.parse(account.startsAt) <= Date.parse(occurredAt) &&
  (!account.endsAt || Date.parse(account.endsAt) >= Date.parse(occurredAt));

const toAuthorizationGrant = (row: ObjectPermissionRow): AuthorizationGrant => ({
  id: row.id,
  subjectAccountId: row.subjectAccountId,
  resourceType: row.resourceType,
  resourceId: row.resourceId,
  actions: row.actions as readonly AuthorizationAction[],
  effect: row.effect,
  purpose: row.purpose,
  ...(row.familyBranchId ? { familyBranchId: row.familyBranchId } : {}),
  ...(row.denialReason ? { denialReason: row.denialReason } : {}),
  startsAt: row.startsAt,
  ...(row.endsAt ? { endsAt: row.endsAt } : {})
});

const familyDataImportAuthorization = new CentralAuthorizationService();

const authorizeFamilyDataImport = (
  dependencies: FamilyDataImportServiceDependencies,
  context: DataLifecycleApplicationContext,
  repository: RepositoryExecutionContext,
  action: AuthorizationAction
): Result<void, AppError> => {
  const account = dependencies.accountRepository.findById(repository, context.actor.userId);
  if (!account.ok) return account;
  if (
    !account.value ||
    !activeAccount(account.value, repository.occurredAt) ||
    account.value.role !== context.actor.role ||
    account.value.personId !== context.actor.personId
  ) {
    return err(createAppError({
      code: ERROR_CODES.AUTHORIZATION_DENIED,
      message: 'Aile verisi içe aktarma işlemleri için etkin ve doğrulanmış üyelik gereklidir.',
      category: 'authorization',
      correlationId: context.correlationId
    }));
  }
  const grants = dependencies.permissionRepository.listActiveForSubject(repository, context.actor.userId, repository.occurredAt);
  if (!grants.ok) return grants;
  const decision = familyDataImportAuthorization.authorize({
    accountId: account.value.id,
    role: context.actor.role,
    action,
    resourceType: 'family_data_import',
    resourceId: context.familyId,
    occurredAt: repository.occurredAt,
    purpose: 'administration',
    ...(account.value.personId ? { actorPersonId: account.value.personId } : {}),
    grants: grants.value.map(toAuthorizationGrant)
  });
  if (decision.allowed) return ok(undefined);
  return err(createAppError({
    code: ERROR_CODES.AUTHORIZATION_DENIED,
    message: 'Bu aile verisi içe aktarma işlemi için merkezi yetkilendirme izin vermedi.',
    category: 'authorization',
    correlationId: context.correlationId,
    details: {
      authorizationReason: decision.reason,
      ...(decision.matchedGrantId ? { matchedGrantId: decision.matchedGrantId } : {}),
      ...(decision.denialReason ? { denialReason: decision.denialReason } : {})
    }
  }));
};

const issue = (issues: FamilyDataImportIssueView[], severity: 'error' | 'warning', code: string, message: string, path?: string): void => {
  issues.push({ severity, code, message, ...(path ? { path } : {}) });
};

const rejectUnknownKeys = (value: Record<string, unknown>, allowed: readonly string[], issues: FamilyDataImportIssueView[], path: string): void => {
  const accepted = new Set(allowed);
  for (const key of Object.keys(value)) if (!accepted.has(key)) issue(issues, 'error', 'import.unknown_field', `Desteklenmeyen alan: ${key}`, `${path}.${key}`);
};

const parseSourceDocument = (sourceText: string, policyBatchAvailable: boolean): { readonly document?: SourceDocument; readonly issues: readonly FamilyDataImportIssueView[] } => {
  const issues: FamilyDataImportIssueView[] = [];
  let raw: unknown;
  try { raw = JSON.parse(sourceText) as unknown; }
  catch { return { issues: [{ severity: 'error', code: 'import.invalid_json', message: 'Dosya geçerli UTF-8 JSON içermiyor.', path: '$' }] }; }
  if (!isObject(raw)) return { issues: [{ severity: 'error', code: 'import.invalid_root', message: 'İçe aktarma kökü bir JSON nesnesi olmalıdır.', path: '$' }] };
  rejectUnknownKeys(raw, ['schemaVersion', 'exportId', 'createdAt', 'family', 'people', 'relations', 'locations', 'events'], issues, '$');
  if (raw.schemaVersion !== 1) issue(issues, 'error', 'import.schema_version', 'Yalnız şema sürümü 1 destekleniyor.', '$.schemaVersion');
  const exportId = stringValue(raw.exportId, 128);
  if (!exportId) issue(issues, 'error', 'import.export_id', 'exportId 1-128 karakter arasında olmalıdır.', '$.exportId');
  const createdAt = stringValue(raw.createdAt, 64);
  if (!createdAt || !isIsoDateTime(createdAt)) issue(issues, 'error', 'import.created_at', 'createdAt geçerli ISO tarih-saat olmalıdır.', '$.createdAt');
  let familyName: string | undefined;
  if (!isObject(raw.family)) issue(issues, 'error', 'import.family', 'family alanı bir nesne olmalıdır.', '$.family');
  else {
    rejectUnknownKeys(raw.family, ['name'], issues, '$.family');
    familyName = stringValue(raw.family.name, 160);
    if (!familyName) issue(issues, 'error', 'import.family_name', 'Aile adı 1-160 karakter arasında olmalıdır.', '$.family.name');
  }

  const parseArray = (key: 'people' | 'relations' | 'locations' | 'events', maximum: number): readonly unknown[] => {
    const value = raw[key];
    if (!Array.isArray(value)) { issue(issues, 'error', `import.${key}_array`, `${key} alanı bir dizi olmalıdır.`, `$.${key}`); return []; }
    if (value.length > maximum) issue(issues, 'error', `import.${key}_limit`, `${key} kayıt sayısı güvenli sınırı aşıyor (${maximum}).`, `$.${key}`);
    return value.slice(0, maximum);
  };

  const people: SourcePerson[] = [];
  const personIds = new Set<string>();
  for (const [index, value] of parseArray('people', MAX_PEOPLE).entries()) {
    const path = `$.people[${index}]`;
    if (!isObject(value)) { issue(issues, 'error', 'import.person_object', 'Kişi kaydı bir nesne olmalıdır.', path); continue; }
    rejectUnknownKeys(value, ['id', 'displayName', 'birthDate', 'relationshipType', 'generation', 'branch', 'status'], issues, path);
    const id = stringValue(value.id, 128);
    const displayName = stringValue(value.displayName, 160);
    const relationshipType = stringValue(value.relationshipType, 80);
    const generation = typeof value.generation === 'number' && Number.isInteger(value.generation) && value.generation >= 0 && value.generation <= 30 ? value.generation : undefined;
    const branch = optionalString(value.branch, 120) ?? 'Ana Dal';
    const birthDate = optionalString(value.birthDate, 10);
    const branchValid = !invalidOptionalString(value.branch, 120);
    const birthDateTypeValid = !invalidOptionalString(value.birthDate, 10);
    const status = value.status === undefined ? 'active' : value.status;
    if (!id) issue(issues, 'error', 'import.person_id', 'Kişi id alanı zorunludur.', `${path}.id`);
    else if (personIds.has(id)) issue(issues, 'error', 'import.person_id_duplicate', `Yinelenen kişi id: ${id}`, `${path}.id`);
    if (!displayName) issue(issues, 'error', 'import.person_name', 'Kişi adı 1-160 karakter arasında olmalıdır.', `${path}.displayName`);
    if (!relationshipType) issue(issues, 'error', 'import.person_relationship', 'Yakınlık türü zorunludur.', `${path}.relationshipType`);
    if (generation === undefined) issue(issues, 'error', 'import.person_generation', 'Nesil 0-30 arasında tam sayı olmalıdır.', `${path}.generation`);
    if (!branchValid) issue(issues, 'error', 'import.person_branch', 'Dal adı metin olarak en fazla 120 karakter olmalıdır.', `${path}.branch`);
    if (!birthDateTypeValid || (birthDate && !isIsoDate(birthDate))) issue(issues, 'error', 'import.person_birth_date', 'Doğum tarihi YYYY-AA-GG biçiminde metin olmalıdır.', `${path}.birthDate`);
    if (!['active', 'inactive', 'deceased'].includes(String(status))) issue(issues, 'error', 'import.person_status', 'Kişi durumu active, inactive veya deceased olmalıdır.', `${path}.status`);
    if (id && displayName && relationshipType && generation !== undefined && branchValid && birthDateTypeValid && (!birthDate || isIsoDate(birthDate)) && ['active', 'inactive', 'deceased'].includes(String(status))) {
      personIds.add(id);
      people.push({ id, displayName, ...(birthDate ? { birthDate } : {}), relationshipType, generation, branch, status: status as SourcePerson['status'] });
    }
  }

  const locations: SourceLocation[] = [];
  const locationIds = new Set<string>();
  const locationValues = parseArray('locations', MAX_LOCATIONS);
  for (const [index, value] of locationValues.entries()) {
    const path = `$.locations[${index}]`;
    if (!isObject(value)) { issue(issues, 'error', 'import.location_object', 'Konum kaydı bir nesne olmalıdır.', path); continue; }
    rejectUnknownKeys(value, ['id', 'label', 'address', 'latitude', 'longitude', 'kind'], issues, path);
    const id = stringValue(value.id, 128);
    const label = stringValue(value.label, 160);
    const address = optionalString(value.address, 500);
    const addressValid = !invalidOptionalString(value.address, 500);
    const latitude = value.latitude;
    const longitude = value.longitude;
    const latitudeValid = latitude === undefined || (typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90);
    const longitudeValid = longitude === undefined || (typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180);
    const kind = value.kind === undefined ? 'other' : String(value.kind);
    if (!id) issue(issues, 'error', 'import.location_id', 'Konum id alanı zorunludur.', `${path}.id`);
    else if (locationIds.has(id)) issue(issues, 'error', 'import.location_id_duplicate', `Yinelenen konum id: ${id}`, `${path}.id`);
    if (!label) issue(issues, 'error', 'import.location_label', 'Konum adı 1-160 karakter arasında olmalıdır.', `${path}.label`);
    if (!addressValid) issue(issues, 'error', 'import.location_address', 'Konum adresi en fazla 500 karakter olmalıdır.', `${path}.address`);
    if (!latitudeValid) issue(issues, 'error', 'import.location_latitude', 'Enlem -90 ile 90 arasında olmalıdır.', `${path}.latitude`);
    if (!longitudeValid) issue(issues, 'error', 'import.location_longitude', 'Boylam -180 ile 180 arasında olmalıdır.', `${path}.longitude`);
    if (!LOCATION_KINDS.has(kind)) issue(issues, 'error', 'import.location_kind', 'Konum türü desteklenmiyor.', `${path}.kind`);
    if (id && label && addressValid && latitudeValid && longitudeValid && LOCATION_KINDS.has(kind)) {
      locationIds.add(id);
      locations.push({ id, label, ...(address ? { address } : {}), ...(typeof latitude === 'number' ? { latitude } : {}), ...(typeof longitude === 'number' ? { longitude } : {}), kind: kind as SourceLocation['kind'] });
    }
  }
  if (locationValues.length > 0 && !policyBatchAvailable) {
    issue(
      issues,
      'error',
      'import.location_policy_batch_required',
      'Konum içeren paketler için governed çoklu-makbuz runner bu süreçte bağlı değildir.',
      '$.locations'
    );
  }

  const relations: SourceRelation[] = [];
  const relationIds = new Set<string>();
  for (const [index, value] of parseArray('relations', MAX_RELATIONS).entries()) {
    const path = `$.relations[${index}]`;
    if (!isObject(value)) { issue(issues, 'error', 'import.relation_object', 'Bağ kaydı bir nesne olmalıdır.', path); continue; }
    rejectUnknownKeys(value, ['id', 'fromPersonId', 'toPersonId', 'relationType'], issues, path);
    const id = stringValue(value.id, 128);
    const fromPersonId = stringValue(value.fromPersonId, 128);
    const toPersonId = stringValue(value.toPersonId, 128);
    const relationType = stringValue(value.relationType, 32);
    if (!id) issue(issues, 'error', 'import.relation_id', 'Bağ id alanı zorunludur.', `${path}.id`);
    else if (relationIds.has(id)) issue(issues, 'error', 'import.relation_id_duplicate', `Yinelenen bağ id: ${id}`, `${path}.id`);
    if (!fromPersonId || !personIds.has(fromPersonId)) issue(issues, 'error', 'import.relation_from', 'Bağın başlangıç kişisi dosyada bulunmuyor.', `${path}.fromPersonId`);
    if (!toPersonId || !personIds.has(toPersonId)) issue(issues, 'error', 'import.relation_to', 'Bağın hedef kişisi dosyada bulunmuyor.', `${path}.toPersonId`);
    if (fromPersonId && toPersonId && fromPersonId === toPersonId) issue(issues, 'error', 'import.relation_self', 'Kişi kendisiyle aile bağı kuramaz.', path);
    if (!relationType || !RELATION_TYPES.has(relationType)) issue(issues, 'error', 'import.relation_type', 'Bağ türü desteklenmiyor.', `${path}.relationType`);
    if (id && fromPersonId && toPersonId && fromPersonId !== toPersonId && personIds.has(fromPersonId) && personIds.has(toPersonId) && relationType && RELATION_TYPES.has(relationType)) {
      relationIds.add(id);
      relations.push({ id, fromPersonId, toPersonId, relationType: relationType as SourceRelation['relationType'] });
    }
  }

  const events: SourceEvent[] = [];
  const eventIds = new Set<string>();
  let hasLocationLinkedEvent = false;
  for (const [index, value] of parseArray('events', MAX_EVENTS).entries()) {
    const path = `$.events[${index}]`;
    if (!isObject(value)) { issue(issues, 'error', 'import.event_object', 'Etkinlik kaydı bir nesne olmalıdır.', path); continue; }
    rejectUnknownKeys(value, ['id', 'kind', 'title', 'description', 'startAt', 'locationId', 'locationLabel', 'visibility', 'participantPersonIds', 'invitationText', 'notes', 'aiProcessingAllowed', 'recurrence', 'reminderDays'], issues, path);
    const id = stringValue(value.id, 128);
    const kind = optionalString(value.kind, 80) ?? 'important_day';
    const kindValid = !invalidOptionalString(value.kind, 80);
    const title = stringValue(value.title, 240);
    const description = optionalString(value.description, 4000);
    const descriptionValid = !invalidOptionalString(value.description, 4000);
    const startAt = stringValue(value.startAt, 64);
    const locationId = optionalString(value.locationId, 128);
    const locationIdValid = !invalidOptionalString(value.locationId, 128);
    if (locationId) hasLocationLinkedEvent = true;
    const locationLabel = optionalString(value.locationLabel, 200);
    const locationLabelValid = !invalidOptionalString(value.locationLabel, 200);
    const visibility = value.visibility === undefined ? 'family' : String(value.visibility);
    const participantValue = value.participantPersonIds;
    const participantsValid = participantValue === undefined || (Array.isArray(participantValue) && participantValue.every((entry) => typeof entry === 'string' && entry.trim().length > 0 && entry.trim().length <= 128));
    const participantPersonIds = participantsValid && Array.isArray(participantValue) ? participantValue.map((entry) => String(entry).trim()) : [];
    const participantsUnique = new Set(participantPersonIds).size === participantPersonIds.length;
    const invitationText = optionalString(value.invitationText, 4000);
    const invitationTextValid = !invalidOptionalString(value.invitationText, 4000);
    const notes = optionalString(value.notes, 8000);
    const notesValid = !invalidOptionalString(value.notes, 8000);
    const aiProcessingAllowed = value.aiProcessingAllowed === undefined ? false : value.aiProcessingAllowed;
    const aiProcessingAllowedValid = typeof aiProcessingAllowed === 'boolean';
    const recurrence = value.recurrence === undefined ? 'none' : String(value.recurrence);
    const reminderDays = value.reminderDays === undefined ? [7, 1] : Array.isArray(value.reminderDays) ? value.reminderDays : [];
    if (!id) issue(issues, 'error', 'import.event_id', 'Etkinlik id alanı zorunludur.', `${path}.id`);
    else if (eventIds.has(id)) issue(issues, 'error', 'import.event_id_duplicate', `Yinelenen etkinlik id: ${id}`, `${path}.id`);
    if (!kindValid) issue(issues, 'error', 'import.event_kind', 'Etkinlik türü metin olarak en fazla 80 karakter olmalıdır.', `${path}.kind`);
    if (!title) issue(issues, 'error', 'import.event_title', 'Etkinlik başlığı zorunludur.', `${path}.title`);
    if (!descriptionValid) issue(issues, 'error', 'import.event_description', 'Açıklama metin olarak en fazla 4000 karakter olmalıdır.', `${path}.description`);
    if (!startAt || !isIsoDateTime(startAt)) issue(issues, 'error', 'import.event_start', 'Etkinlik tarihi geçerli ISO tarih-saat olmalıdır.', `${path}.startAt`);
    if (!locationIdValid) issue(issues, 'error', 'import.event_location_id', 'Konum kimliği metin olarak en fazla 128 karakter olmalıdır.', `${path}.locationId`);
    else if (locationId && !locationIds.has(locationId)) issue(issues, 'error', 'import.event_location_missing', `Etkinliğin bağlı olduğu kaynak konum dosyada bulunmuyor: ${locationId}`, `${path}.locationId`);
    if (!locationLabelValid) issue(issues, 'error', 'import.event_location_label', 'Konum etiketi metin olarak en fazla 200 karakter olmalıdır.', `${path}.locationLabel`);
    if (!VISIBILITIES.has(visibility)) issue(issues, 'error', 'import.event_visibility', 'Etkinlik görünürlüğü desteklenmiyor.', `${path}.visibility`);
    if (!RECURRENCES.has(recurrence)) issue(issues, 'error', 'import.event_recurrence', 'Tekrar türü desteklenmiyor.', `${path}.recurrence`);
    if (!participantsValid) issue(issues, 'error', 'import.event_participants_type', 'Katılımcılar 1-128 karakterlik kişi kimliklerinden oluşan bir dizi olmalıdır.', `${path}.participantPersonIds`);
    if (!participantsUnique) issue(issues, 'error', 'import.event_participants_duplicate', 'Katılımcı kimlikleri yinelenemez.', `${path}.participantPersonIds`);
    const invalidParticipant = participantPersonIds.find((personId) => !personIds.has(personId));
    if (invalidParticipant) issue(issues, 'error', 'import.event_participant', `Katılımcı kişi dosyada bulunmuyor: ${invalidParticipant}`, `${path}.participantPersonIds`);
    if (!invitationTextValid) issue(issues, 'error', 'import.event_invitation', 'Davetiye metni en fazla 4000 karakter olmalıdır.', `${path}.invitationText`);
    if (!notesValid) issue(issues, 'error', 'import.event_notes', 'Notlar metin olarak en fazla 8000 karakter olmalıdır.', `${path}.notes`);
    if (!aiProcessingAllowedValid) issue(issues, 'error', 'import.event_ai_permission', 'aiProcessingAllowed boolean olmalıdır.', `${path}.aiProcessingAllowed`);
    const normalizedReminderDays = [...new Set(reminderDays.filter((day): day is number => typeof day === 'number' && Number.isInteger(day) && day >= 0 && day <= 365))].sort((a, b) => b - a);
    if (!Array.isArray(value.reminderDays) && value.reminderDays !== undefined) issue(issues, 'error', 'import.event_reminders', 'Hatırlatma günleri bir dizi olmalıdır.', `${path}.reminderDays`);
    else if (normalizedReminderDays.length !== reminderDays.length || normalizedReminderDays.length > 20) issue(issues, 'error', 'import.event_reminders', 'Hatırlatma günleri 0-365 arasında en fazla 20 benzersiz tam sayı olmalıdır.', `${path}.reminderDays`);
    if (id && kindValid && title && descriptionValid && startAt && isIsoDateTime(startAt) && locationIdValid && (!locationId || locationIds.has(locationId)) && locationLabelValid && VISIBILITIES.has(visibility) && RECURRENCES.has(recurrence) && participantsValid && participantsUnique && !invalidParticipant && invitationTextValid && notesValid && aiProcessingAllowedValid && normalizedReminderDays.length <= 20 && normalizedReminderDays.length === reminderDays.length) {
      eventIds.add(id);
      events.push({ id, kind, title, ...(description ? { description } : {}), startAt, ...(locationId ? { locationId } : {}), ...(locationLabel ? { locationLabel } : {}), visibility: visibility as SourceEvent['visibility'], participantPersonIds, ...(invitationText ? { invitationText } : {}), ...(notes ? { notes } : {}), aiProcessingAllowed, recurrence: recurrence as SourceEvent['recurrence'], reminderDays: normalizedReminderDays });
    }
  }
  if (hasLocationLinkedEvent && !policyBatchAvailable) {
    issue(
      issues,
      'error',
      'import.event_location_policy_batch_required',
      'locationId taşıyan etkinlikler için governed kaynak-konum read makbuzu runner bu süreçte bağlı değildir.',
      '$.events'
    );
  }

  if (!exportId || !createdAt || !isIsoDateTime(createdAt) || !familyName || raw.schemaVersion !== 1) return { issues };
  return { document: { schemaVersion: 1, exportId, createdAt, familyName, people, relations, locations, events }, issues };
};

const summary = (entityType: FamilyDataImportEntityType, sourceCount: number, resolutions: readonly Resolution[], skipCount = 0): FamilyDataImportEntitySummaryView => ({
  entityType,
  sourceCount,
  createCount: resolutions.filter((value) => value === 'created').length,
  reuseCount: resolutions.filter((value) => value === 'reused').length,
  skipCount
});

const buildPlan = (document: SourceDocument, existing: FamilyDataImportExistingData, inheritedIssues: readonly FamilyDataImportIssueView[], targetFamilyName: string, baseline?: ImportPlan): ImportPlan => {
  const issues = [...inheritedIssues];
  if (normalizeText(document.familyName) !== normalizeText(targetFamilyName)) issue(issues, 'warning', 'import.family_name_mismatch', `Kaynak aile adı “${document.familyName}”; veriler mevcut “${targetFamilyName}” alanına eklenecek.`, '$.family.name');

  const people: PlannedPerson[] = [];
  const personTargets = new Map<string, string>();
  const personByKey = new Map(existing.people.map((row) => [`${normalizeText(row.displayName)}|${row.birthDate ?? ''}`, row.id]));
  const baselinePeople = new Map(baseline?.people.map((row) => [row.sourceId, row.targetId]) ?? []);
  for (const record of document.people) {
    const key = `${normalizeText(record.displayName)}|${record.birthDate ?? ''}`;
    const targetId = personByKey.get(key) ?? baselinePeople.get(record.id) ?? randomUUID();
    const resolution: Resolution = personByKey.has(key) ? 'reused' : 'created';
    if (resolution === 'reused') issue(issues, 'warning', 'import.person_reused', `Mevcut kişi yeniden kullanılacak: ${record.displayName}`, `$.people[id=${record.id}]`);
    else personByKey.set(key, targetId);
    personTargets.set(record.id, targetId);
    people.push({ sourceId: record.id, targetId, resolution, record });
  }

  const relations: PlannedRelation[] = [];
  const relationByKey = new Map(existing.relations.map((row) => [`${row.fromPersonId}|${row.toPersonId}|${row.relationType}`, row.id]));
  const baselineRelations = new Map(baseline?.relations.map((row) => [row.sourceId, row.targetId]) ?? []);
  for (const record of document.relations) {
    const fromTargetId = personTargets.get(record.fromPersonId)!;
    const toTargetId = personTargets.get(record.toPersonId)!;
    if (fromTargetId === toTargetId) {
      issue(issues, 'warning', 'import.relation_collapsed', 'İki kaynak kişi aynı mevcut kişiye eşleştiği için öz-bağ atlandı.', `$.relations[id=${record.id}]`);
      continue;
    }
    const key = `${fromTargetId}|${toTargetId}|${record.relationType}`;
    const targetId = relationByKey.get(key) ?? baselineRelations.get(record.id) ?? randomUUID();
    const resolution: Resolution = relationByKey.has(key) ? 'reused' : 'created';
    if (resolution === 'reused') issue(issues, 'warning', 'import.relation_reused', 'Mevcut aile bağı yeniden kullanılacak.', `$.relations[id=${record.id}]`);
    else relationByKey.set(key, targetId);
    relations.push({ sourceId: record.id, targetId, resolution, record, fromTargetId, toTargetId });
  }

  const locations: PlannedLocation[] = [];
  const locationByKey = new Map((existing.locations ?? []).map((row) => [`${normalizeText(row.label)}|${row.kind}`, row.id]));
  const baselineLocations = new Map(baseline?.locations.map((row) => [row.sourceId, row.targetId]) ?? []);
  for (const record of document.locations) {
    const key = `${normalizeText(record.label)}|${record.kind}`;
    const targetId = locationByKey.get(key) ?? baselineLocations.get(record.id) ?? randomUUID();
    const resolution: Resolution = locationByKey.has(key) ? 'reused' : 'created';
    if (resolution === 'reused') issue(issues, 'warning', 'import.location_reused', `Mevcut konum yeniden kullanılacak: ${record.label}`, `$.locations[id=${record.id}]`);
    else locationByKey.set(key, targetId);
    locations.push({ sourceId: record.id, targetId, resolution, record });
  }
  const plannedLocationsBySource = new Map(locations.map((row) => [row.sourceId, row]));

  const events: PlannedEvent[] = [];
  const eventByKey = new Map(existing.events.map((row) => [`${normalizeText(row.title)}|${row.startAt}`, row.id]));
  const baselineEvents = new Map(baseline?.events.map((row) => [row.sourceId, row.targetId]) ?? []);
  for (const record of document.events) {
    const key = `${normalizeText(record.title)}|${record.startAt}`;
    const targetId = eventByKey.get(key) ?? baselineEvents.get(record.id) ?? randomUUID();
    const resolution: Resolution = eventByKey.has(key) ? 'reused' : 'created';
    const targetLocation = record.locationId ? plannedLocationsBySource.get(record.locationId) : undefined;
    if (resolution === 'reused') issue(issues, 'warning', 'import.event_reused', `Mevcut etkinlik yeniden kullanılacak: ${record.title}`, `$.events[id=${record.id}]`);
    else eventByKey.set(key, targetId);
    events.push({
      sourceId: record.id,
      targetId,
      resolution,
      record,
      participantTargetIds: record.participantPersonIds.map((personId) => personTargets.get(personId)!),
      ...(targetLocation ? { targetLocationId: targetLocation.targetId, targetLocationResolution: targetLocation.resolution } : {})
    });
  }

  const summaries = [
    summary('person', document.people.length, people.map((row) => row.resolution)),
    summary('relation', document.relations.length, relations.map((row) => row.resolution), document.relations.length - relations.length),
    summary('location', document.locations.length, locations.map((row) => row.resolution)),
    summary('event', document.events.length, events.map((row) => row.resolution))
  ];
  const digest = sha256(JSON.stringify({
    source: document.exportId,
    people: people.map((row) => [row.sourceId, row.targetId, row.resolution]),
    relations: relations.map((row) => [row.sourceId, row.targetId, row.resolution, row.fromTargetId, row.toTargetId]),
    locations: locations.map((row) => [row.sourceId, row.targetId, row.resolution]),
    events: events.map((row) => [row.sourceId, row.targetId, row.resolution, row.participantTargetIds, row.targetLocationId ?? null, row.targetLocationResolution ?? null])
  }));
  return { document, people, relations, locations, events, issues, summaries, digest };
};

const unwrap = <T>(result: Result<T, AppError>): T => {
  if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
  return result.value;
};

export class FamilyDataImportService {
  readonly #previews = new Map<string, CachedPreview>();
  public constructor(private readonly dependencies: FamilyDataImportServiceDependencies) {}

  public preview(sourcePath: string): FamilyDataImportPreviewView {
    const context = this.dependencies.applicationContext('family-data-import-preview');
    this.#assertAuthorized(context, 'read');
    const stat = lstatSync(sourcePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('İçe aktarma kaynağı normal bir dosya olmalıdır.');
    if (extname(sourcePath).toLocaleLowerCase('tr-TR') !== '.json') throw new Error('Aile verisi içe aktarma dosyası .json uzantılı olmalıdır.');
    if (stat.size <= 0 || stat.size > MAX_IMPORT_BYTES) throw new Error(`İçe aktarma dosyası 1 bayt ile ${MAX_IMPORT_BYTES} bayt arasında olmalıdır.`);
    const sourceBuffer = readFileSync(sourcePath);
    let sourceText: string;
    try { sourceText = new TextDecoder('utf-8', { fatal: true }).decode(sourceBuffer); }
    catch { throw new Error('İçe aktarma dosyası geçerli UTF-8 kodlamasında olmalıdır.'); }
    if (sourceText.includes('\u0000')) throw new Error('İçe aktarma dosyası NUL karakteri içeremez.');
    const parsed = parseSourceDocument(sourceText, Boolean(this.dependencies.policyBatchRunner && this.dependencies.locationRepository));
    const target = unwrap(this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const repository = repositoryContext(context, transaction);
      const existing = this.dependencies.importRepository.loadExisting(repository, context.familyId);
      if (!existing.ok) return existing;
      const family = this.dependencies.familyRepository.findById(repository, context.familyId);
      if (!family.ok) return family;
      if (!family.value) return err(createAppError({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: 'Aktif aile alanı bulunamadı.', category: 'not_found', correlationId: context.correlationId }));
      return ok({ existing: existing.value, familyName: family.value.name });
    }));
    const document = parsed.document;
    const plan = document ? buildPlan(document, target.existing, parsed.issues, target.familyName) : undefined;
    const previewId = randomUUID();
    const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS).toISOString();
    const summaries = plan?.summaries ?? [summary('person', 0, []), summary('relation', 0, []), summary('location', 0, []), summary('event', 0, [])];
    const issues = plan?.issues ?? parsed.issues;
    const preview: FamilyDataImportPreviewView = {
      previewId,
      fileName: basename(sourcePath),
      fileSizeBytes: stat.size,
      sha256: sha256(sourceBuffer),
      schemaVersion: 1,
      sourceExportId: document?.exportId ?? 'geçersiz',
      sourceCreatedAt: document?.createdAt ?? new Date(0).toISOString(),
      sourceFamilyName: document?.familyName ?? 'Geçersiz kaynak',
      targetFamilyName: target.familyName,
      expiresAt,
      valid: Boolean(document) && !issues.some((entry) => entry.severity === 'error'),
      totalSourceRecords: summaries.reduce((total, entry) => total + entry.sourceCount, 0),
      totalCreateRecords: summaries.reduce((total, entry) => total + entry.createCount, 0),
      totalReuseRecords: summaries.reduce((total, entry) => total + entry.reuseCount, 0),
      issues: [...issues],
      entities: [...summaries]
    };
    if (document && plan) this.#previews.set(previewId, { preview, familyId: context.familyId, actorId: context.actor.userId, sourcePath, sourceSize: stat.size, sourceModifiedMs: stat.mtimeMs, sourceText, document, plan, planDigest: plan.digest });
    this.#removeExpiredPreviews();
    return preview;
  }

  public async apply(input: ApplyFamilyDataImportInput): Promise<FamilyDataImportBatchView> {
    if (!input || typeof input.previewId !== 'string' || typeof input.password !== 'string' || input.password.length === 0 || input.password.length > 1024 || (input.code !== undefined && (typeof input.code !== 'string' || input.code.length > 256))) throw new Error('İçe aktarma doğrulama bilgileri geçersiz.');
    const context = this.dependencies.applicationContext('family-data-import-apply');
    this.#assertAuthorized(context, 'create');
    const cached = this.#previews.get(input.previewId);
    if (!cached) throw new Error('İçe aktarma ön izlemesi bulunamadı veya süresi doldu. Dosyayı yeniden ön izleyin.');
    if (cached.familyId !== context.familyId || cached.actorId !== context.actor.userId) {
      this.#previews.delete(input.previewId);
      throw new Error('İçe aktarma ön izlemesi farklı kullanıcı veya aile oturumuna aittir. Dosyayı yeniden ön izleyin.');
    }
    if (!cached.preview.valid) throw new Error('Hatalı ön izleme uygulanamaz.');
    if (Date.parse(cached.preview.expiresAt) <= Date.now()) { this.#previews.delete(input.previewId); throw new Error('İçe aktarma ön izlemesinin süresi doldu.'); }
    const stat = lstatSync(cached.sourcePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== cached.sourceSize || stat.mtimeMs !== cached.sourceModifiedMs) throw new Error('İçe aktarma dosyası ön izlemeden sonra değişti. Yeniden ön izleme gereklidir.');
    const sourceBuffer = readFileSync(cached.sourcePath);
    if (sha256(sourceBuffer) !== cached.preview.sha256 || sourceBuffer.toString('utf8') !== cached.sourceText) throw new Error('İçe aktarma dosyasının SHA-256 değeri ön izlemeyle eşleşmiyor.');
    unwrap(this.dependencies.strongAuthentication.verify(context, { password: input.password, ...(input.code ? { code: input.code } : {}) }));

    const actorPersonId = context.actor.personId;
    const governedRows = [
      ...cached.plan.locations.filter((row) => row.resolution === 'created'),
      ...cached.plan.events.filter((row) => row.resolution === 'created')
    ];
    if (governedRows.length > 0 && (!this.dependencies.policyBatchRunner || !this.dependencies.locationRepository || !actorPersonId)) {
      throw new Error('Governed konum/etkinlik içe aktarma batch bağı veya etkin kişi kimliği bulunmadığı için işlem fail-closed durduruldu.');
    }
    const requests: FamilyDataImportPolicyBatchRequest[] = [];
    for (const [index, row] of cached.plan.locations.filter((item) => item.resolution === 'created').entries()) {
      const childContext: LocationApplicationContext = {
        familyId: context.familyId,
        actor: { userId: context.actor.userId, role: context.actor.role, ...(actorPersonId ? { personId: actorPersonId } : {}) },
        correlationId: importCorrelation(context.correlationId, 'location', index, row.targetId)
      };
      requests.push({
        key: `location:${row.targetId}`,
        kind: 'location',
        context: childContext,
        intent: { action: 'create', capability: 'family.write', resourceType: 'location', resourceId: row.targetId, purpose: 'general', ...(actorPersonId ? { ownerPersonId: actorPersonId } : {}), sensitivity: 'highly_sensitive' }
      });
    }
    for (const [index, row] of cached.plan.events.filter((item) => item.resolution === 'created' && item.targetLocationId).entries()) {
      const childContext: LocationApplicationContext = {
        familyId: context.familyId,
        actor: { userId: context.actor.userId, role: context.actor.role, ...(actorPersonId ? { personId: actorPersonId } : {}) },
        correlationId: importCorrelation(context.correlationId, 'location-read', index, row.targetLocationId!)
      };
      requests.push(row.targetLocationResolution === 'created' ? {
        key: `event-location-read:${row.targetId}`,
        kind: 'created-location-read',
        createKey: `location:${row.targetLocationId}`,
        context: childContext,
        intent: { action: 'read', capability: 'location.read', resourceType: 'location', resourceId: row.targetLocationId!, purpose: 'general', sensitivity: 'highly_sensitive' }
      } : {
        key: `event-location-read:${row.targetId}`,
        kind: 'location',
        context: childContext,
        intent: { action: 'read', capability: 'location.read', resourceType: 'location', resourceId: row.targetLocationId!, purpose: 'general', sensitivity: 'highly_sensitive' }
      });
    }
    for (const [index, row] of cached.plan.events.filter((item) => item.resolution === 'created').entries()) {
      const childContext: TimelineApplicationContext = {
        familyId: context.familyId,
        actor: { userId: context.actor.userId, roles: [context.actor.role], ...(actorPersonId ? { personId: actorPersonId } : {}) },
        correlationId: importCorrelation(context.correlationId, 'event', index, row.targetId)
      };
      requests.push({
        key: `event:${row.targetId}`,
        kind: 'event',
        context: childContext,
        intent: { action: 'create', capability: 'family.write', resourceType: 'event', resourceId: row.targetId, purpose: 'general', ...(actorPersonId ? { ownerPersonId: actorPersonId } : {}), targetSensitivity: timelineSensitivity(row.record.visibility), sourceResourceMode: 'replace', ...(row.targetLocationId ? { sourceResourceId: row.targetLocationId } : {}) }
      });
    }

    const applyTransaction = (transaction: TransactionContext, policyRepositories: ReadonlyMap<string, PolicyAuthorizedRepositoryExecutionContext>): Result<FamilyDataImportBatchView, AppError> => {
      const repository = repositoryContext(context, transaction);
      const authorization = authorizeFamilyDataImport(this.dependencies, context, repository, 'create');
      if (!authorization.ok) return authorization;
      const existingSource = this.dependencies.importRepository.findActiveSource(repository, context.familyId, cached.preview.sha256, cached.document.exportId);
      if (!existingSource.ok) return existingSource;
      if (existingSource.value) return err(createAppError({ code: ERROR_CODES.RESOURCE_CONFLICT, message: 'Bu dışa aktarma paketi daha önce uygulanmış ve geri alınmamış.', category: 'conflict', correlationId: context.correlationId }));
      const existing = this.dependencies.importRepository.loadExisting(repository, context.familyId);
      if (!existing.ok) return existing;
      const currentPlan = buildPlan(cached.document, existing.value, [], cached.preview.targetFamilyName, cached.plan);
      if (currentPlan.digest !== cached.planDigest) return err(createAppError({ code: ERROR_CODES.RESOURCE_CONFLICT, message: 'Aile verileri ön izlemeden sonra değişti. Çakışma planını yenilemek için dosyayı yeniden ön izleyin.', category: 'conflict', correlationId: context.correlationId }));
      const now = transaction.occurredAt;
      const batchId = randomUUID();
      const rollbackDeadline = asIsoDateTime(new Date(Date.parse(now) + ROLLBACK_WINDOW_MS).toISOString());
      const batch = this.dependencies.importRepository.insertBatch(repository, {
        id: batchId,
        familyId: context.familyId,
        sourceFileName: cached.preview.fileName,
        sourceSha256: cached.preview.sha256,
        sourceExportId: cached.document.exportId,
        sourceCreatedAt: asIsoDateTime(cached.document.createdAt),
        sourceFamilyName: cached.document.familyName,
        schemaVersion: 1,
        status: 'applied',
        appliedAt: now,
        rollbackDeadline,
        actorId: context.actor.userId,
        summary: currentPlan.summaries
      });
      if (!batch.ok) return batch;

      for (const row of currentPlan.people) {
        if (row.resolution === 'created') {
          const inserted = this.dependencies.personRepository.insert(repository, {
            id: asPersonId(row.targetId), familyId: context.familyId, displayName: row.record.displayName,
            ...(row.record.birthDate ? { birthDate: asIsoDate(row.record.birthDate) } : {}), relationshipType: row.record.relationshipType,
            generation: row.record.generation, branch: row.record.branch, status: row.record.status, createdAt: now
          });
          if (!inserted.ok) return inserted;
        }
        const tracked = this.dependencies.importRepository.insertItem(repository, { batchId, entityType: 'person', entityId: row.targetId, sourceId: row.sourceId, resolution: row.resolution, createdAt: now });
        if (!tracked.ok) return tracked;
      }
      for (const row of currentPlan.relations) {
        if (row.resolution === 'created') {
          const inserted = this.dependencies.relationRepository.insert(repository, { id: row.targetId, familyId: context.familyId, fromPersonId: asPersonId(row.fromTargetId), toPersonId: asPersonId(row.toTargetId), relationType: row.record.relationType });
          if (!inserted.ok) return inserted;
        }
        const tracked = this.dependencies.importRepository.insertItem(repository, { batchId, entityType: 'relation', entityId: row.targetId, sourceId: row.sourceId, resolution: row.resolution, createdAt: now });
        if (!tracked.ok) return tracked;
      }
      for (const row of currentPlan.locations) {
        if (row.resolution === 'created') {
          const governedRepository = policyRepositories.get(`location:${row.targetId}`);
          if (!governedRepository || !this.dependencies.locationRepository || !actorPersonId) return err(createAppError({ code: ERROR_CODES.AUTHORIZATION_DENIED, message: 'Konum içe aktarma politika makbuzu bulunamadı.', category: 'security', correlationId: context.correlationId }));
          const inserted = this.dependencies.locationRepository.insert(governedRepository, {
            id: row.targetId, familyId: context.familyId, ownerPersonId: asPersonId(actorPersonId), label: row.record.label,
            ...(row.record.address ? { address: row.record.address } : {}), ...(row.record.latitude !== undefined ? { latitude: row.record.latitude } : {}),
            ...(row.record.longitude !== undefined ? { longitude: row.record.longitude } : {}), kind: row.record.kind, createdAt: now
          });
          if (!inserted.ok) return inserted;
        }
        const tracked = this.dependencies.importRepository.insertItem(repository, { batchId, entityType: 'location', entityId: row.targetId, sourceId: row.sourceId, resolution: row.resolution, createdAt: now });
        if (!tracked.ok) return tracked;
      }
      for (const row of currentPlan.events) {
        if (row.resolution === 'created') {
          const governedRepository = policyRepositories.get(`event:${row.targetId}`);
          if (!governedRepository || !actorPersonId) return err(createAppError({ code: ERROR_CODES.AUTHORIZATION_DENIED, message: 'Etkinlik içe aktarma politika makbuzu bulunamadı.', category: 'security', correlationId: context.correlationId }));
          let locationBinding: Readonly<{ location: LocationRecord; receiptHash: string }> | undefined;
          if (row.targetLocationId) {
            const locationReadRepository = policyRepositories.get(`event-location-read:${row.targetId}`);
            if (!locationReadRepository || !this.dependencies.locationRepository) return err(createAppError({ code: ERROR_CODES.AUTHORIZATION_DENIED, message: 'Etkinlik kaynak-konum read makbuzu bulunamadı.', category: 'security', correlationId: context.correlationId }));
            const found = this.dependencies.locationRepository.findById(locationReadRepository, context.familyId, row.targetLocationId);
            if (!found.ok) return found;
            if (!found.value || found.value.id !== row.targetLocationId || found.value.familyId !== context.familyId) return err(createAppError({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: 'Etkinliğin governed kaynak konumu bulunamadı.', category: 'not_found', correlationId: context.correlationId }));
            locationBinding = {
              location: found.value,
              receiptHash: computePlatformPolicyReceiptHash(locationReadRepository.policyAuthorization.receiptRecord.receipt)
            };
          }
          const inserted = this.dependencies.timelineRepository.insert(governedRepository, {
            id: asEventId(row.targetId), familyId: context.familyId, ownerPersonId: asPersonId(actorPersonId), kind: row.record.kind,
            title: row.record.title, ...(row.record.description ? { description: row.record.description } : {}), startAt: asIsoDateTime(row.record.startAt),
            ...(locationBinding ? { locationId: locationBinding.location.id, locationLabel: locationBinding.location.label, sourceLocationReceiptHash: locationBinding.receiptHash } : row.record.locationLabel ? { locationLabel: row.record.locationLabel } : {}), visibility: row.record.visibility,
            participantPersonIds: row.participantTargetIds.map(asPersonId), ...(row.record.invitationText ? { invitationText: row.record.invitationText } : {}),
            ...(row.record.notes ? { notes: row.record.notes } : {}), attachmentCount: 0, aiProcessingAllowed: row.record.aiProcessingAllowed,
            recurrence: row.record.recurrence, reminderDays: row.record.reminderDays, createdAt: now
          });
          if (!inserted.ok) return inserted;
        }
        const tracked = this.dependencies.importRepository.insertItem(repository, { batchId, entityType: 'event', entityId: row.targetId, sourceId: row.sourceId, resolution: row.resolution, createdAt: now });
        if (!tracked.ok) return tracked;
      }
      const audit = this.dependencies.auditRepository.append(repository, { id: randomUUID(), action: 'family_data.import_applied', resourceType: 'family_data_import', resourceId: batchId, occurredAt: now, actorId: context.actor.userId });
      if (!audit.ok) return audit;
      return ok(this.#batchView({ id: batchId, familyId: context.familyId, sourceFileName: cached.preview.fileName, sourceSha256: cached.preview.sha256, sourceExportId: cached.document.exportId, sourceCreatedAt: asIsoDateTime(cached.document.createdAt), sourceFamilyName: cached.document.familyName, schemaVersion: 1, status: 'applied', appliedAt: now, rollbackDeadline, actorId: context.actor.userId, summary: currentPlan.summaries }, []));
    };
    const result = requests.length > 0
      ? await this.dependencies.policyBatchRunner!.execute(context.correlationId, requests, ({ transaction, repositories }) => applyTransaction(transaction, repositories))
      : this.dependencies.transactionExecutor.execute<FamilyDataImportBatchView>(context.correlationId, (transaction) => applyTransaction(transaction, new Map()));
    const view = unwrap(result);
    this.#previews.delete(input.previewId);
    return view;
  }

  public listBatches(limit = 50): FamilyDataImportBatchView[] {
    const context = this.dependencies.applicationContext('family-data-import-list');
    const result = this.dependencies.transactionExecutor.execute<FamilyDataImportBatchView[]>(context.correlationId, (transaction) => {
      const repository = repositoryContext(context, transaction);
      const authorization = authorizeFamilyDataImport(this.dependencies, context, repository, 'read');
      if (!authorization.ok) return authorization;
      const batches = this.dependencies.importRepository.listBatches(repository, context.familyId, limit);
      if (!batches.ok) return batches;
      const output: FamilyDataImportBatchView[] = [];
      for (const batch of batches.value) {
        const inspection = batch.status === 'rolled_back' ? ok({ allowed: false, blockers: [] as readonly string[] }) : this.dependencies.importRepository.inspectRollback(repository, batch.id);
        if (!inspection.ok) return inspection;
        output.push(this.#batchView(batch, inspection.value.blockers));
      }
      return ok(output);
    });
    return unwrap(result);
  }

  public async rollback(input: RollbackFamilyDataImportInput): Promise<FamilyDataImportBatchView> {
    if (!input || typeof input.batchId !== 'string' || typeof input.password !== 'string' || input.password.length === 0 || input.password.length > 1024 || (input.code !== undefined && (typeof input.code !== 'string' || input.code.length > 256))) throw new Error('Geri alma doğrulama bilgileri geçersiz.');
    const context = this.dependencies.applicationContext('family-data-import-rollback');
    this.#assertAuthorized(context, 'delete');
    unwrap(this.dependencies.strongAuthentication.verify(context, { password: input.password, ...(input.code ? { code: input.code } : {}) }));

    const prepared = unwrap(this.dependencies.transactionExecutor.execute<Readonly<{
      batch: FamilyDataImportBatchRecord;
      targets: readonly FamilyDataImportRollbackPolicyTarget[];
      blockedView?: FamilyDataImportBatchView;
    }>>(context.correlationId, (transaction) => {
      const repository = repositoryContext(context, transaction);
      const authorization = authorizeFamilyDataImport(this.dependencies, context, repository, 'delete');
      if (!authorization.ok) return authorization;
      const found = this.dependencies.importRepository.findBatch(repository, input.batchId);
      if (!found.ok) return found;
      if (!found.value || found.value.familyId !== context.familyId) return err(createAppError({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: 'İçe aktarma işlemi bulunamadı.', category: 'not_found', correlationId: context.correlationId }));
      const batch = found.value;
      if (batch.status === 'rolled_back') return err(createAppError({ code: ERROR_CODES.RESOURCE_CONFLICT, message: 'Bu içe aktarma daha önce geri alınmış.', category: 'conflict', correlationId: context.correlationId }));
      if (Date.parse(batch.rollbackDeadline) < Date.parse(transaction.occurredAt)) return err(createAppError({ code: ERROR_CODES.RESOURCE_CONFLICT, message: '24 saatlik kontrollü geri alma penceresi sona ermiş.', category: 'conflict', correlationId: context.correlationId }));
      const inspection = this.dependencies.importRepository.inspectRollback(repository, batch.id);
      if (!inspection.ok) return inspection;
      if (!inspection.value.allowed) {
        const marked = this.dependencies.importRepository.markRollbackBlocked(repository, batch.id);
        if (!marked.ok) return marked;
        const blockedBatch = { ...batch, status: 'rollback_blocked' as const };
        return ok({
          batch: blockedBatch,
          targets: [] as readonly FamilyDataImportRollbackPolicyTarget[],
          blockedView: this.#batchView(blockedBatch, inspection.value.blockers)
        });
      }
      const targets = this.dependencies.importRepository.listRollbackPolicyTargets(repository, batch.id);
      if (!targets.ok) return targets;
      return ok({ batch, targets: targets.value });
    }));
    if (prepared.blockedView) throw new Error(`Geri alma güvenli değil: ${prepared.blockedView.rollbackBlockers.join(' ')}`);

    const actorPersonId = context.actor.personId;
    const governedTargets = prepared.targets.filter((target) => target.governed);
    if (governedTargets.length > 0 && (!this.dependencies.policyBatchRunner || !actorPersonId)) {
      throw new Error('Governed import rollback politika batch bağı veya etkin kişi kimliği bulunmadığı için fail-closed durduruldu.');
    }
    const requests: FamilyDataImportPolicyBatchRequest[] = governedTargets.map((target, index) => {
      if (target.entityType === 'location') {
        const childContext: LocationApplicationContext = {
          familyId: context.familyId,
          actor: {
            userId: context.actor.userId,
            role: context.actor.role,
            ...(actorPersonId ? { personId: actorPersonId } : {})
          },
          correlationId: importCorrelation(context.correlationId, 'rollback-location', index, target.entityId)
        };
        return {
          key: `location:${target.entityId}`,
          kind: 'location' as const,
          context: childContext,
          intent: {
            action: 'delete' as const,
            capability: 'family.write' as const,
            resourceType: 'location' as const,
            resourceId: target.entityId,
            purpose: 'general' as const,
            sensitivity: 'highly_sensitive' as const
          }
        };
      }
      const childContext: TimelineApplicationContext = {
        familyId: context.familyId,
        actor: {
          userId: context.actor.userId,
          roles: [context.actor.role],
          ...(actorPersonId ? { personId: actorPersonId } : {})
        },
        correlationId: importCorrelation(context.correlationId, 'rollback-event', index, target.entityId)
      };
      return {
        key: `event:${target.entityId}`,
        kind: 'event' as const,
        context: childContext,
        intent: {
          action: 'delete' as const,
          capability: 'family.write' as const,
          resourceType: 'event' as const,
          resourceId: target.entityId,
          purpose: 'general' as const
        }
      };
    });

    const rollbackTransaction = (
      transaction: TransactionContext,
      policyRepositories: ReadonlyMap<string, PolicyAuthorizedRepositoryExecutionContext>
    ): Result<Readonly<{ view: FamilyDataImportBatchView; blocked: boolean }>, AppError> => {
      const repository = repositoryContext(context, transaction);
      const authorization = authorizeFamilyDataImport(this.dependencies, context, repository, 'delete');
      if (!authorization.ok) return authorization;
      const found = this.dependencies.importRepository.findBatch(repository, input.batchId);
      if (!found.ok) return found;
      if (!found.value || found.value.familyId !== context.familyId) return err(createAppError({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: 'İçe aktarma işlemi bulunamadı.', category: 'not_found', correlationId: context.correlationId }));
      const batch = found.value;
      if (batch.status === 'rolled_back') return err(createAppError({ code: ERROR_CODES.RESOURCE_CONFLICT, message: 'Bu içe aktarma daha önce geri alınmış.', category: 'conflict', correlationId: context.correlationId }));
      if (Date.parse(batch.rollbackDeadline) < Date.parse(transaction.occurredAt)) return err(createAppError({ code: ERROR_CODES.RESOURCE_CONFLICT, message: '24 saatlik kontrollü geri alma penceresi sona ermiş.', category: 'conflict', correlationId: context.correlationId }));
      const inspection = this.dependencies.importRepository.inspectRollback(repository, batch.id);
      if (!inspection.ok) return inspection;
      if (!inspection.value.allowed) {
        const marked = this.dependencies.importRepository.markRollbackBlocked(repository, batch.id);
        if (!marked.ok) return marked;
        return ok({ view: this.#batchView({ ...batch, status: 'rollback_blocked' }, inspection.value.blockers), blocked: true });
      }
      const deleted = this.dependencies.importRepository.deleteCreatedEntities(repository, batch.id, policyRepositories);
      if (!deleted.ok) return deleted;
      const marked = this.dependencies.importRepository.markRolledBack(repository, batch.id, transaction.occurredAt);
      if (!marked.ok) return marked;
      const audit = this.dependencies.auditRepository.append(repository, { id: randomUUID(), action: 'family_data.import_rolled_back', resourceType: 'family_data_import', resourceId: batch.id, occurredAt: transaction.occurredAt, actorId: context.actor.userId });
      if (!audit.ok) return audit;
      return ok({ view: this.#batchView({ ...batch, status: 'rolled_back', rolledBackAt: transaction.occurredAt }, []), blocked: false });
    };
    const result = requests.length > 0
      ? await this.dependencies.policyBatchRunner!.execute(context.correlationId, requests, ({ transaction, repositories }) => rollbackTransaction(transaction, repositories))
      : this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => rollbackTransaction(transaction, new Map()));
    const outcome = unwrap(result);
    if (outcome.blocked) throw new Error(`Geri alma güvenli değil: ${outcome.view.rollbackBlockers.join(' ')}`);
    return outcome.view;
  }

  public clearCachedPreviews(): void {
    this.#previews.clear();
  }

  #assertAuthorized(context: DataLifecycleApplicationContext, action: AuthorizationAction): void {
    unwrap(this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) =>
      authorizeFamilyDataImport(this.dependencies, context, repositoryContext(context, transaction), action)
    ));
  }

  #batchView(batch: FamilyDataImportBatchRecord, blockers: readonly string[]): FamilyDataImportBatchView {
    const rollbackAvailable = batch.status !== 'rolled_back' && Date.parse(batch.rollbackDeadline) >= Date.now() && blockers.length === 0;
    return {
      id: batch.id,
      sourceFileName: batch.sourceFileName,
      sourceSha256: batch.sourceSha256,
      sourceExportId: batch.sourceExportId,
      sourceCreatedAt: batch.sourceCreatedAt,
      sourceFamilyName: batch.sourceFamilyName,
      schemaVersion: 1,
      status: batch.status,
      appliedAt: batch.appliedAt,
      rollbackDeadline: batch.rollbackDeadline,
      ...(batch.rolledBackAt ? { rolledBackAt: batch.rolledBackAt } : {}),
      rollbackAvailable,
      rollbackBlockers: [...blockers],
      entities: [...batch.summary],
      totalCreatedRecords: batch.summary.reduce((total, entry) => total + entry.createCount, 0),
      totalReusedRecords: batch.summary.reduce((total, entry) => total + entry.reuseCount, 0)
    };
  }

  #removeExpiredPreviews(): void {
    const now = Date.now();
    for (const [id, cached] of this.#previews) if (Date.parse(cached.preview.expiresAt) <= now) this.#previews.delete(id);
  }
}
