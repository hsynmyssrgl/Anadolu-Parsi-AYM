import { createHash } from 'node:crypto';
import { domainToASCII } from 'node:url';
import {
  ERROR_CODES,
  asEventId,
  asIsoDateTime,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import type { DomainEvent } from '@ppt/events';
import {
  APP_META,
  SIGNED_PLUGIN_CAPABILITY_CODES,
  SIGNED_PLUGIN_MAX_INSTALLATIONS,
  SIGNED_PLUGIN_MAX_MUTATIONS,
  SIGNED_PLUGIN_MAX_RELEASES_PER_PLUGIN,
  SIGNED_PLUGIN_PROVIDER_KINDS,
  type SignedPluginCapabilityCode,
  type SignedPluginDataAccessMode,
  type SignedPluginDataPurpose,
  type SignedPluginDataSensitivity,
  type EmergencyDisableSignedPluginInput,
  type RegisterSignedPluginReleaseInput,
  type RollbackSignedPluginInput,
  type SetSignedPluginDesiredStateInput,
  type SignedPluginMutationKind,
  type SignedPluginMutationReceiptView,
  type SignedPluginPlatformCenterView,
  type SignedPluginResourceType
} from '@ppt/domain';
import type {
  SignedPluginInstallationRow,
  SignedPluginMutationRow,
  SignedPluginPlatformCenterKey,
  SignedPluginReleaseRow,
  SignedPluginStorageUsageRow
} from '@ppt/repository-contracts';
import type { LifeApplicationContext, LifePolicyIntent } from './life-use-cases.js';

export interface SignedPluginPlatformQueryPort {
  getCenter(context: LifeApplicationContext): Promise<Result<SignedPluginPlatformCenterView, AppError>>;
}

export interface SignedPluginPlatformWriteScope {
  readonly occurredAt: SignedPluginMutationRow['occurredAt'];
  readonly ownerPersonId: SignedPluginPlatformCenterKey['ownerPersonId'];
  findInstallation(pluginId: string): Result<SignedPluginInstallationRow | null, AppError>;
  findRelease(pluginId: string, version: string): Result<SignedPluginReleaseRow | null, AppError>;
  getStorageUsage(pluginId: string): Result<SignedPluginStorageUsageRow, AppError>;
  findMutation(clientOperationId: string): Result<SignedPluginMutationRow | null, AppError>;
  insertMutation(row: SignedPluginMutationRow): Result<void, AppError>;
  insertRelease(row: SignedPluginReleaseRow): Result<void, AppError>;
  insertInstallation(row: SignedPluginInstallationRow): Result<void, AppError>;
  saveInstallation(row: SignedPluginInstallationRow, expectedRevision: number): Result<void, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: SignedPluginMutationRow['occurredAt'];
    readonly actorId: LifeApplicationContext['actor']['userId'];
  }): Result<string, AppError>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError>;
}

export interface SignedPluginPlatformUnitOfWork {
  execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: SignedPluginPlatformWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,159}$/u;
const PLUGIN_ID = /^[a-z][a-z0-9.-]{2,63}$/u;
const RESOURCE = /^[a-z][a-z0-9._:-]{1,127}$/u;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const CONTROL = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const EXACT_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const providerKinds = new Set<string>(SIGNED_PLUGIN_PROVIDER_KINDS);
const capabilityCodes = new Set<string>(SIGNED_PLUGIN_CAPABILITY_CODES);
const sensitivities = new Set<SignedPluginDataSensitivity>(['standard', 'personal', 'highly_sensitive']);
const purposes = new Set<SignedPluginDataPurpose>([
  'general', 'finance', 'education', 'home_automation', 'health', 'document_processing', 'ai_assistance',
  'browser_assistance'
]);
const accessModes = new Set<SignedPluginDataAccessMode>(['read_metadata', 'read_content', 'process_local']);
const providerCapability = new Map<string, SignedPluginCapabilityCode>([
  ['bank', 'bank.read'], ['school', 'school.read'], ['matter', 'matter.read'], ['fhir', 'fhir.read'],
  ['onedrive', 'onedrive.read'], ['maps', 'maps.read'], ['ocr', 'ocr.process'], ['ai', 'ai.process'],
  ['browser', 'browser.read']
]);
const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(null);
};
const hash = (value: unknown): string => createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
const exactRecord = (value: unknown, required: readonly string[], optional: readonly string[] = []): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value); if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value); if (keys.some((key) => typeof key === 'symbol')) return false;
  const allowed = new Set([...required, ...optional]);
  if (keys.some((key) => typeof key !== 'string' || !allowed.has(key))) return false;
  if (required.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) return false;
  return keys.every((key) => { const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return Boolean(descriptor && !descriptor.get && !descriptor.set && 'value' in descriptor && descriptor.enumerable); });
};
const exactIso = (value: unknown): value is string => typeof value === 'string' && EXACT_ISO.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const validSemver = (value: unknown): value is string => typeof value === 'string' && value.length >= 5
  && value.length <= 96 && SEMVER.test(value);
const uniqueStrings = (values: readonly string[]): boolean => new Set(values).size === values.length;
const canonicalHost = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length < 4 || value.length > 253 || value !== value.toLowerCase()) return null;
  if (value.includes('*') || value.includes('/') || value.includes(':') || value.includes('@')) return null;
  const ascii = domainToASCII(value);
  if (!ascii || ascii !== value || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u.test(ascii)) return null;
  if (ascii === 'localhost' || ascii.endsWith('.localhost') || ascii.endsWith('.local') || ascii.endsWith('.internal')) return null;
  return ascii;
};

const appError = (
  context: LifeApplicationContext,
  code: typeof ERROR_CODES.CORE_INVALID_ARGUMENT | typeof ERROR_CODES.RESOURCE_CONFLICT |
    typeof ERROR_CODES.RESOURCE_NOT_FOUND | typeof ERROR_CODES.AUTHORIZATION_DENIED,
  message: string,
  category: 'validation' | 'conflict' | 'not_found' | 'authorization'
): AppError => createAppError({ code, message, category, correlationId: context.correlationId });
const invalid = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.CORE_INVALID_ARGUMENT, message, 'validation');
const conflict = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.RESOURCE_CONFLICT, message, 'conflict');
const missing = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.RESOURCE_NOT_FOUND, message, 'not_found');
const denied = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.AUTHORIZATION_DENIED, message, 'authorization');

const actorPerson = (context: LifeApplicationContext): Result<NonNullable<LifeApplicationContext['actor']['personId']>, AppError> =>
  context.actor.personId ? ok(context.actor.personId) : err(denied(context, 'İmzalı eklenti merkezi kişi bağlı oturum gerektirir.'));

const normalizeReason = (context: LifeApplicationContext, value: unknown): Result<string, AppError> => {
  if (typeof value !== 'string') return err(invalid(context, 'Gerekçe metin olmalıdır.'));
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  return normalized.length >= 3 && normalized.length <= 500 && !CONTROL.test(normalized)
    ? ok(normalized) : err(invalid(context, 'Gerekçe sınırları geçersizdir.'));
};
const expectedRevision = (context: LifeApplicationContext, value: unknown, allowZero = false): Result<number, AppError> =>
  Number.isSafeInteger(value) && Number(value) >= (allowZero ? 0 : 1)
    ? ok(Number(value)) : err(invalid(context, 'Beklenen sürüm geçersizdir.'));

export const signedPluginPlatformReadIntent = (): LifePolicyIntent => ({
  action: 'read', capability: 'family.read', resourceType: 'signed_plugin_platform_center', resourceId: '*', purpose: 'general'
});
const writeIntent = (pluginId: string, action: 'create' | 'update' | 'delete', ownerPersonId?: string): LifePolicyIntent => ({
  action,
  capability: 'family.write',
  resourceType: 'signed_plugin_installation',
  resourceId: pluginId,
  purpose: 'general',
  ...(action === 'create' && ownerPersonId ? { ownerPersonId: asPersonId(ownerPersonId), privacy: 'private' as const } : {})
});

const installationFingerprint = (row: Omit<SignedPluginInstallationRow, 'stateFingerprint'>): string => hash({
  id: row.id,
  familyId: row.familyId,
  ownerPersonId: row.ownerPersonId,
  displayName: row.displayName,
  currentVersion: row.currentVersion,
  currentReleaseId: row.currentReleaseId,
  previousVersion: row.previousVersion ?? null,
  desiredState: row.desiredState,
  runtimeExecutionReady: row.runtimeExecutionReady,
  externalProviderConnectionReady: row.externalProviderConnectionReady,
  revision: row.revision,
  lastMutationId: row.lastMutationId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  emergencyDisabledAt: row.emergencyDisabledAt ?? null
});

const releaseFingerprint = (row: Omit<SignedPluginReleaseRow, 'releaseFingerprint'>): string => hash({
  id: row.id,
  familyId: row.familyId,
  ownerPersonId: row.ownerPersonId,
  pluginId: row.pluginId,
  displayName: row.displayName,
  version: row.version,
  minimumHostVersion: row.minimumHostVersion,
  manifestSha256: row.manifestSha256,
  packageSha256: row.packageSha256,
  entrypointSha256: row.entrypointSha256,
  sbomSha256: row.sbomSha256,
  licenseInventorySha256: row.licenseInventorySha256,
  provenanceSha256: row.provenanceSha256,
  signerKeyId: row.signerKeyId,
  providerKinds: row.providerKinds,
  capabilityCodes: row.capabilityCodes,
  dataDeclarations: row.dataDeclarations,
  egressMode: row.egressMode,
  egressHosts: row.egressHosts,
  sandboxProfile: row.sandboxProfile,
  signatureVerified: row.signatureVerified,
  verifiedAt: row.verifiedAt,
  issuedAt: row.issuedAt,
  expiresAt: row.expiresAt,
  mutationId: row.mutationId
});

const mutationId = (context: LifeApplicationContext, clientOperationId: string, requestFingerprint: string): string =>
  hash({ familyId: context.familyId, accountId: context.actor.userId, clientOperationId, requestFingerprint });
const releaseId = (familyId: string, ownerPersonId: string, pluginId: string, version: string, manifestSha256: string): string =>
  hash({ familyId, ownerPersonId, pluginId, version, manifestSha256 });
const receipt = (row: SignedPluginMutationRow, replayed: boolean): SignedPluginMutationReceiptView => Object.freeze({
  pluginId: row.resourceId,
  mutationKind: row.mutationKind,
  previousRevision: row.expectedRevision,
  revision: row.revision,
  occurredAt: row.occurredAt,
  replayed,
  runtimeExecutionPerformed: false,
  externalProviderConnectionPerformed: false,
  networkUsed: false
});
const replay = (
  context: LifeApplicationContext,
  existing: SignedPluginMutationRow | null,
  requestFingerprint: string,
  mutationKind: SignedPluginMutationKind,
  pluginId: string
): Result<SignedPluginMutationReceiptView | null, AppError> => {
  if (!existing) return ok(null);
  return existing.requestFingerprint === requestFingerprint && existing.mutationKind === mutationKind
    && existing.resourceType === 'signed_plugin_installation' && existing.resourceId === pluginId
    ? ok(receipt(existing, true))
    : err(conflict(context, 'Aynı işlem kimliği farklı bir eklenti komutuyla kullanıldı.'));
};

const mutationRow = (
  context: LifeApplicationContext,
  scope: SignedPluginPlatformWriteScope,
  actor: NonNullable<LifeApplicationContext['actor']['personId']>,
  input: {
    readonly id: string;
    readonly pluginId: string;
    readonly mutationKind: SignedPluginMutationKind;
    readonly clientOperationId: string;
    readonly requestFingerprint: string;
    readonly expectedRevision: number;
    readonly revision: number;
    readonly stateFingerprint: string;
  }
): SignedPluginMutationRow => Object.freeze({
  id: input.id,
  familyId: context.familyId,
  ownerPersonId: scope.ownerPersonId,
  resourceType: 'signed_plugin_installation',
  resourceId: input.pluginId,
  actorAccountId: context.actor.userId,
  actorPersonId: actor,
  mutationKind: input.mutationKind,
  clientOperationId: input.clientOperationId,
  requestFingerprint: input.requestFingerprint,
  expectedRevision: input.expectedRevision,
  revision: input.revision,
  resourceStateFingerprint: input.stateFingerprint,
  occurredAt: asIsoDateTime(scope.occurredAt)
});

const persist = (
  context: LifeApplicationContext,
  scope: SignedPluginPlatformWriteScope,
  mutation: SignedPluginMutationRow,
  beforeCurrent: (() => Result<void, AppError>) | undefined,
  writeCurrent: () => Result<void, AppError>
): Result<SignedPluginMutationReceiptView, AppError> => {
  const ledger = scope.insertMutation(mutation); if (!ledger.ok) return ledger;
  if (beforeCurrent) { const before = beforeCurrent(); if (!before.ok) return before; }
  const current = writeCurrent(); if (!current.ok) return current;
  const audit = scope.appendAudit({
    id: hash({ mutationId: mutation.id, kind: 'audit' }),
    action: `signed_plugin.${mutation.mutationKind}`,
    resourceType: mutation.resourceType,
    resourceId: mutation.resourceId,
    occurredAt: mutation.occurredAt,
    actorId: context.actor.userId
  });
  if (!audit.ok) return audit;
  const event = scope.enqueueEvent({
    eventId: asEventId(hash({ mutationId: mutation.id, kind: 'event' })),
    eventType: `signed_plugin.${mutation.mutationKind}`,
    eventVersion: 1,
    aggregateType: mutation.resourceType,
    aggregateId: mutation.resourceId,
    occurredAt: mutation.occurredAt,
    actorId: context.actor.userId,
    correlationId: context.correlationId,
    payload: {
      pluginId: mutation.resourceId,
      mutationKind: mutation.mutationKind,
      revision: mutation.revision,
      runtimeExecutionPerformed: false,
      externalProviderConnectionPerformed: false,
      networkUsed: false
    }
  });
  return event.ok ? ok(receipt(mutation, false)) : event;
};

const compareSemver = (left: string, right: string): number => {
  const l = SEMVER.exec(left)!; const r = SEMVER.exec(right)!;
  for (let index = 1; index <= 3; index += 1) {
    const a = l[index]!; const b = r[index]!;
    if (a.length !== b.length) return a.length - b.length;
    if (a !== b) return a < b ? -1 : 1;
  }
  const lp = l[4]?.split('.'); const rp = r[4]?.split('.');
  if (!lp && !rp) return 0; if (!lp) return 1; if (!rp) return -1;
  for (let index = 0; index < Math.max(lp.length, rp.length); index += 1) {
    const a = lp[index]; const b = rp[index];
    if (a === undefined) return -1; if (b === undefined) return 1; if (a === b) continue;
    const an = /^\d+$/u.test(a); const bn = /^\d+$/u.test(b);
    if (an && bn) return a.length === b.length ? (a < b ? -1 : 1) : a.length - b.length;
    if (an !== bn) return an ? -1 : 1;
    return a < b ? -1 : 1;
  }
  return 0;
};

const validRelease = (
  context: LifeApplicationContext,
  release: RegisterSignedPluginReleaseInput['release']
): Result<void, AppError> => {
  if (!exactRecord(release, [
    'pluginId', 'displayName', 'version', 'minimumHostVersion', 'manifestSha256', 'packageSha256', 'entrypointSha256',
    'sbomSha256', 'licenseInventorySha256', 'provenanceSha256', 'signerKeyId', 'signatureVerified', 'providerKinds',
    'capabilityCodes', 'dataDeclarations', 'egressMode', 'egressHosts', 'sandboxProfile', 'filesystemAccess',
    'processSpawnAllowed', 'nativeModulesAllowed', 'networkBrokerOnly', 'issuedAt', 'expiresAt'
  ]) || !PLUGIN_ID.test(release.pluginId) || typeof release.displayName !== 'string'
    || release.displayName.length < 2 || release.displayName.length > 120
    || release.displayName.normalize('NFKC').trim() !== release.displayName || CONTROL.test(release.displayName)
    || !validSemver(release.version) || !validSemver(release.minimumHostVersion)
    || compareSemver(APP_META.packageVersion, release.minimumHostVersion) < 0
    || release.signatureVerified !== true || typeof release.signerKeyId !== 'string' || !SAFE_ID.test(release.signerKeyId)
    || ![release.manifestSha256, release.packageSha256, release.entrypointSha256, release.sbomSha256,
      release.licenseInventorySha256, release.provenanceSha256]
      .every((value) => typeof value === 'string' && SHA256.test(value) && !/^0{64}$/u.test(value))
    || release.sandboxProfile !== 'isolated_child_process' || release.filesystemAccess !== 'none'
    || release.processSpawnAllowed !== false || release.nativeModulesAllowed !== false || release.networkBrokerOnly !== true
    || !exactIso(release.issuedAt) || !exactIso(release.expiresAt)) {
    return err(denied(context, 'Eklenti sürümü yalnız doğrulanmış, uyumlu ve minimum yetkili imzalı manifest kanıtıyla kaydedilebilir.'));
  }
  if (!Array.isArray(release.providerKinds) || release.providerKinds.length < 1 || release.providerKinds.length > 9
    || !release.providerKinds.every((item) => typeof item === 'string' && providerKinds.has(item))
    || !uniqueStrings(release.providerKinds)
    || !Array.isArray(release.capabilityCodes) || release.capabilityCodes.length < 1 || release.capabilityCodes.length > 16
    || !release.capabilityCodes.every((item) => typeof item === 'string' && capabilityCodes.has(item))
    || !uniqueStrings(release.capabilityCodes)) {
    return err(denied(context, 'Sağlayıcı veya yetenek bildirimi minimum yetki politikasını ihlal ediyor.'));
  }
  for (const provider of release.providerKinds) {
    if (!release.capabilityCodes.includes(providerCapability.get(provider)!))
      return err(denied(context, 'Her sağlayıcı exact yeteneğiyle birlikte bildirilmelidir.'));
  }
  for (const capability of release.capabilityCodes) {
    const provider = capability.split('.')[0]!;
    if (!release.providerKinds.includes(provider as (typeof release.providerKinds)[number]))
      return err(denied(context, 'Her yetenek bildirilmiş bir sağlayıcıya bağlı olmalıdır.'));
  }
  if (!Array.isArray(release.dataDeclarations) || release.dataDeclarations.length < 1 || release.dataDeclarations.length > 32)
    return err(denied(context, 'Veri bildirimi sayısı politika sınırları dışındadır.'));
  const declarations: string[] = [];
  for (const declaration of release.dataDeclarations) {
    if (!exactRecord(declaration, ['resourceType', 'sensitivity', 'purpose', 'access', 'retentionDays'])
      || typeof declaration.resourceType !== 'string' || !RESOURCE.test(declaration.resourceType)
      || !sensitivities.has(declaration.sensitivity) || !purposes.has(declaration.purpose)
      || !accessModes.has(declaration.access) || !Number.isSafeInteger(declaration.retentionDays)
      || declaration.retentionDays < 0 || declaration.retentionDays > 30) {
      return err(denied(context, 'Veri hassasiyeti, amacı, erişimi veya saklama bildirimi geçersizdir.'));
    }
    declarations.push(`${declaration.resourceType}\u0000${declaration.sensitivity}\u0000${declaration.purpose}\u0000${declaration.access}\u0000${declaration.retentionDays}`);
  }
  if (!uniqueStrings(declarations)) return err(denied(context, 'Veri bildirimleri benzersiz olmalıdır.'));
  if (!Array.isArray(release.egressHosts) || release.egressHosts.length > 16 || !uniqueStrings(release.egressHosts)
    || !release.egressHosts.every((host) => canonicalHost(host) === host)
    || (release.egressMode === 'none' ? release.egressHosts.length !== 0
      : release.egressMode === 'allowlist' ? release.egressHosts.length < 1 : true)) {
    return err(denied(context, 'Ağ çıkışı exact genel-host izin listesi kullanmalıdır.'));
  }
  const issuedAt = Date.parse(release.issuedAt); const expiresAt = Date.parse(release.expiresAt);
  if (expiresAt <= issuedAt || expiresAt - issuedAt > 31 * 86_400_000)
    return err(denied(context, 'Manifest geçerlilik süresi politika sınırları dışındadır.'));
  return ok(undefined);
};

const ensureCapacity = (
  context: LifeApplicationContext,
  usage: SignedPluginStorageUsageRow,
  options: { readonly newInstallation?: boolean; readonly newRelease?: boolean }
): Result<void, AppError> => {
  if (usage.mutationCount >= SIGNED_PLUGIN_MAX_MUTATIONS)
    return err(conflict(context, 'Eklenti mutasyon kapasitesi doludur; yeni yazım fail-closed kapatıldı.'));
  if (options.newInstallation && usage.installationCount >= SIGNED_PLUGIN_MAX_INSTALLATIONS)
    return err(conflict(context, 'Eklenti kurulum kapasitesi doludur.'));
  if (options.newRelease && usage.releaseCount >= SIGNED_PLUGIN_MAX_RELEASES_PER_PLUGIN)
    return err(conflict(context, 'Eklenti sürüm geçmişi kapasitesi doludur.'));
  return ok(undefined);
};

const requireMonotonicTime = (
  context: LifeApplicationContext,
  occurredAt: string,
  current: SignedPluginInstallationRow
): Result<void, AppError> => Date.parse(occurredAt) > Date.parse(current.updatedAt)
  ? ok(undefined) : Date.parse(occurredAt) === Date.parse(current.updatedAt)
    ? ok(undefined) : err(conflict(context, 'Eklenti değişiklik zamanı geriye gidemez.'));

export class GetSignedPluginPlatformCenterUseCase {
  public constructor(private readonly queryPort: SignedPluginPlatformQueryPort) {}
  public execute(context: LifeApplicationContext): Promise<Result<SignedPluginPlatformCenterView, AppError>> {
    return this.queryPort.getCenter(context);
  }
}

export class RegisterSignedPluginReleaseUseCase {
  public constructor(private readonly unitOfWork: SignedPluginPlatformUnitOfWork) {}
  public async execute(input: { readonly context: LifeApplicationContext; readonly command: RegisterSignedPluginReleaseInput })
  : Promise<Result<SignedPluginMutationReceiptView, AppError>> {
    const { context, command } = input;
    if (!exactRecord(command, ['clientOperationId', 'expectedRevision', 'release']))
      return err(invalid(context, 'Eklenti sürüm kayıt komutu exact alanları taşımıyor.'));
    const actor = actorPerson(context); if (!actor.ok) return actor;
    const expected = expectedRevision(context, command.expectedRevision, true); if (!expected.ok) return expected;
    const release = command.release;
    if (!SAFE_ID.test(command.clientOperationId)) return err(invalid(context, 'Eklenti işlem kimliği geçersizdir.'));
    const validated = validRelease(context, release); if (!validated.ok) return validated;
    const requestFingerprint = hash(command);
    return this.unitOfWork.execute(context, writeIntent(release.pluginId, expected.value === 0 ? 'create' : 'update',
      expected.value === 0 ? actor.value : undefined), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const kind: SignedPluginMutationKind = expected.value === 0 ? 'release_register' : 'release_update';
      const replayed = replay(context, prior.value, requestFingerprint, kind, release.pluginId);
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      if (Date.parse(release.expiresAt) <= Date.parse(scope.occurredAt)
        || Date.parse(release.issuedAt) > Date.parse(scope.occurredAt) + 300_000)
        return err(denied(context, 'Süresi dolmuş veya gelecek zamanlı manifest kaydedilemez.'));
      const existing = scope.findInstallation(release.pluginId); if (!existing.ok) return existing;
      if (expected.value === 0 ? Boolean(existing.value) : (!existing.value || existing.value.revision !== expected.value))
        return err(conflict(context, 'Eklenti kayıt sürümü değişti.'));
      if (existing.value && compareSemver(release.version, existing.value.currentVersion) <= 0)
        return err(conflict(context, 'Yeni kayıt yalnız daha yüksek imzalı sürüm olabilir; geri dönüş ayrı komuttur.'));
      const duplicate = scope.findRelease(release.pluginId, release.version); if (!duplicate.ok) return duplicate;
      if (duplicate.value) return err(conflict(context, 'Eklenti sürümü zaten kayıtlı.'));
      const usage = scope.getStorageUsage(release.pluginId); if (!usage.ok) return usage;
      const capacity = ensureCapacity(context, usage.value, { newInstallation: !existing.value, newRelease: true });
      if (!capacity.ok) return capacity;
      if (existing.value) { const time = requireMonotonicTime(context, scope.occurredAt, existing.value); if (!time.ok) return time; }
      const occurredAt = asIsoDateTime(scope.occurredAt); const nextRevision = expected.value + 1;
      const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const releaseBase: Omit<SignedPluginReleaseRow, 'releaseFingerprint'> = Object.freeze({
        id: releaseId(context.familyId, scope.ownerPersonId, release.pluginId, release.version, release.manifestSha256),
        familyId: context.familyId,
        ownerPersonId: scope.ownerPersonId,
        pluginId: release.pluginId,
        displayName: release.displayName,
        version: release.version,
        minimumHostVersion: release.minimumHostVersion,
        manifestSha256: release.manifestSha256,
        packageSha256: release.packageSha256,
        entrypointSha256: release.entrypointSha256,
        sbomSha256: release.sbomSha256,
        licenseInventorySha256: release.licenseInventorySha256,
        provenanceSha256: release.provenanceSha256,
        signerKeyId: release.signerKeyId,
        providerKinds: Object.freeze([...release.providerKinds]),
        capabilityCodes: Object.freeze([...release.capabilityCodes]),
        dataDeclarations: Object.freeze(release.dataDeclarations.map((item) => Object.freeze({ ...item }))),
        egressMode: release.egressMode,
        egressHosts: Object.freeze([...release.egressHosts]),
        sandboxProfile: 'isolated_child_process',
        signatureVerified: true,
        verifiedAt: occurredAt,
        issuedAt: asIsoDateTime(new Date(release.issuedAt).toISOString()),
        expiresAt: asIsoDateTime(new Date(release.expiresAt).toISOString()),
        mutationId: id
      });
      const releaseRow: SignedPluginReleaseRow = Object.freeze({ ...releaseBase, releaseFingerprint: releaseFingerprint(releaseBase) });
      const installationBase: Omit<SignedPluginInstallationRow, 'stateFingerprint'> = Object.freeze({
        id: release.pluginId,
        familyId: context.familyId,
        ownerPersonId: scope.ownerPersonId,
        displayName: release.displayName,
        currentVersion: release.version,
        currentReleaseId: releaseRow.id,
        ...(existing.value ? { previousVersion: existing.value.currentVersion } : {}),
        desiredState: 'disabled',
        runtimeExecutionReady: false,
        externalProviderConnectionReady: false,
        revision: nextRevision,
        lastMutationId: id,
        createdAt: existing.value?.createdAt ?? occurredAt,
        updatedAt: occurredAt
      });
      const installation: SignedPluginInstallationRow = Object.freeze({
        ...installationBase,
        stateFingerprint: installationFingerprint(installationBase)
      });
      const mutation = mutationRow(context, scope, actor.value, { id, pluginId: release.pluginId, mutationKind: kind,
        clientOperationId: command.clientOperationId, requestFingerprint, expectedRevision: expected.value,
        revision: nextRevision, stateFingerprint: installation.stateFingerprint });
      return persist(context, scope, mutation, () => scope.insertRelease(releaseRow), () => existing.value
        ? scope.saveInstallation(installation, expected.value) : scope.insertInstallation(installation));
    });
  }
}

export class SetSignedPluginDesiredStateUseCase {
  public constructor(private readonly unitOfWork: SignedPluginPlatformUnitOfWork) {}
  public async execute(input: { readonly context: LifeApplicationContext; readonly command: SetSignedPluginDesiredStateInput })
  : Promise<Result<SignedPluginMutationReceiptView, AppError>> {
    const { context, command } = input;
    if (!exactRecord(command, ['clientOperationId', 'pluginId', 'expectedRevision', 'enabled', 'reason']))
      return err(invalid(context, 'Eklenti istenen durum komutu exact alanları taşımıyor.'));
    const actor = actorPerson(context); if (!actor.ok) return actor;
    const expected = expectedRevision(context, command.expectedRevision); if (!expected.ok) return expected;
    const reason = normalizeReason(context, command.reason); if (!reason.ok) return reason;
    if (!SAFE_ID.test(command.clientOperationId) || !PLUGIN_ID.test(command.pluginId) || typeof command.enabled !== 'boolean')
      return err(invalid(context, 'Eklenti istenen durum komutu geçersizdir.'));
    const requestFingerprint = hash({ ...command, reason: reason.value });
    const kind: SignedPluginMutationKind = command.enabled ? 'desired_enable' : 'desired_disable';
    return this.unitOfWork.execute(context, writeIntent(command.pluginId, 'update'), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(context, prior.value, requestFingerprint, kind, command.pluginId);
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      const usage = scope.getStorageUsage(command.pluginId); if (!usage.ok) return usage;
      const capacity = ensureCapacity(context, usage.value, {}); if (!capacity.ok) return capacity;
      const found = scope.findInstallation(command.pluginId); if (!found.ok) return found;
      if (!found.value) return err(missing(context, 'Eklenti kaydı bulunamadı.'));
      if (found.value.revision !== expected.value || found.value.desiredState === 'emergency_disabled')
        return err(conflict(context, 'Eklenti sürümü değişti veya acil kapatma yeni imzalı sürüm gerektiriyor.'));
      const desiredState = command.enabled ? 'enabled' : 'disabled';
      if (found.value.desiredState === desiredState)
        return err(conflict(context, 'Eklenti zaten istenen durumdadır; no-op mutasyon reddedildi.'));
      const time = requireMonotonicTime(context, scope.occurredAt, found.value); if (!time.ok) return time;
      if (command.enabled) {
        const release = scope.findRelease(command.pluginId, found.value.currentVersion); if (!release.ok) return release;
        if (!release.value || Date.parse(release.value.expiresAt) <= Date.parse(scope.occurredAt))
          return err(denied(context, 'Süresi geçerli imzalı sürüm olmadan etkin durum istenemez.'));
      }
      const occurredAt = asIsoDateTime(scope.occurredAt); const nextRevision = found.value.revision + 1;
      const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const base: Omit<SignedPluginInstallationRow, 'stateFingerprint'> = Object.freeze({ ...found.value,
        desiredState, revision: nextRevision, lastMutationId: id,
        updatedAt: occurredAt, ...(found.value.emergencyDisabledAt ? { emergencyDisabledAt: found.value.emergencyDisabledAt } : {}) });
      const row: SignedPluginInstallationRow = Object.freeze({ ...base, stateFingerprint: installationFingerprint(base) });
      const mutation = mutationRow(context, scope, actor.value, { id, pluginId: command.pluginId, mutationKind: kind,
        clientOperationId: command.clientOperationId, requestFingerprint, expectedRevision: found.value.revision,
        revision: nextRevision, stateFingerprint: row.stateFingerprint });
      return persist(context, scope, mutation, undefined, () => scope.saveInstallation(row, found.value!.revision));
    });
  }
}

export class EmergencyDisableSignedPluginUseCase {
  public constructor(private readonly unitOfWork: SignedPluginPlatformUnitOfWork) {}
  public async execute(input: { readonly context: LifeApplicationContext; readonly command: EmergencyDisableSignedPluginInput })
  : Promise<Result<SignedPluginMutationReceiptView, AppError>> {
    const { context, command } = input;
    if (!exactRecord(command, ['clientOperationId', 'pluginId', 'expectedRevision', 'confirmation', 'reason']))
      return err(invalid(context, 'Acil kapatma komutu exact alanları taşımıyor.'));
    const actor = actorPerson(context); if (!actor.ok) return actor;
    const expected = expectedRevision(context, command.expectedRevision); if (!expected.ok) return expected;
    const reason = normalizeReason(context, command.reason); if (!reason.ok) return reason;
    if (!SAFE_ID.test(command.clientOperationId) || !PLUGIN_ID.test(command.pluginId)
      || command.confirmation !== 'EKLENTIYI ACIL DURDUR') return err(invalid(context, 'Acil kapatma onayı geçersizdir.'));
    const requestFingerprint = hash({ ...command, reason: reason.value });
    return this.unitOfWork.execute(context, writeIntent(command.pluginId, 'delete'), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(context, prior.value, requestFingerprint, 'emergency_disable', command.pluginId);
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      const usage = scope.getStorageUsage(command.pluginId); if (!usage.ok) return usage;
      const capacity = ensureCapacity(context, usage.value, {}); if (!capacity.ok) return capacity;
      const found = scope.findInstallation(command.pluginId); if (!found.ok) return found;
      if (!found.value) return err(missing(context, 'Eklenti kaydı bulunamadı.'));
      if (found.value.revision !== expected.value || found.value.desiredState === 'emergency_disabled')
        return err(conflict(context, 'Eklenti sürümü veya acil kapatma durumu değişti.'));
      const time = requireMonotonicTime(context, scope.occurredAt, found.value); if (!time.ok) return time;
      const occurredAt = asIsoDateTime(scope.occurredAt); const nextRevision = found.value.revision + 1;
      const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const base: Omit<SignedPluginInstallationRow, 'stateFingerprint'> = Object.freeze({ ...found.value,
        desiredState: 'emergency_disabled', revision: nextRevision, lastMutationId: id,
        updatedAt: occurredAt, emergencyDisabledAt: occurredAt });
      const row: SignedPluginInstallationRow = Object.freeze({ ...base, stateFingerprint: installationFingerprint(base) });
      const mutation = mutationRow(context, scope, actor.value, { id, pluginId: command.pluginId,
        mutationKind: 'emergency_disable', clientOperationId: command.clientOperationId, requestFingerprint,
        expectedRevision: found.value.revision, revision: nextRevision, stateFingerprint: row.stateFingerprint });
      return persist(context, scope, mutation, undefined, () => scope.saveInstallation(row, found.value!.revision));
    });
  }
}

export class RollbackSignedPluginUseCase {
  public constructor(private readonly unitOfWork: SignedPluginPlatformUnitOfWork) {}
  public async execute(input: { readonly context: LifeApplicationContext; readonly command: RollbackSignedPluginInput })
  : Promise<Result<SignedPluginMutationReceiptView, AppError>> {
    const { context, command } = input;
    if (!exactRecord(command, ['clientOperationId', 'pluginId', 'expectedRevision', 'targetVersion', 'confirmation']))
      return err(invalid(context, 'Eklenti geri dönüş komutu exact alanları taşımıyor.'));
    const actor = actorPerson(context); if (!actor.ok) return actor;
    const expected = expectedRevision(context, command.expectedRevision); if (!expected.ok) return expected;
    if (!SAFE_ID.test(command.clientOperationId) || !PLUGIN_ID.test(command.pluginId) || !SEMVER.test(command.targetVersion)
      || command.confirmation !== 'ONCEKI SURUME DON') return err(invalid(context, 'Geri dönüş komutu geçersizdir.'));
    const requestFingerprint = hash(command);
    return this.unitOfWork.execute(context, writeIntent(command.pluginId, 'update'), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(context, prior.value, requestFingerprint, 'release_rollback', command.pluginId);
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      const usage = scope.getStorageUsage(command.pluginId); if (!usage.ok) return usage;
      const capacity = ensureCapacity(context, usage.value, {}); if (!capacity.ok) return capacity;
      const found = scope.findInstallation(command.pluginId); if (!found.ok) return found;
      if (!found.value) return err(missing(context, 'Eklenti kaydı bulunamadı.'));
      if (found.value.revision !== expected.value || found.value.previousVersion !== command.targetVersion
        || found.value.desiredState === 'emergency_disabled')
        return err(conflict(context, 'Geri dönüş hedefi veya eklenti sürümü değişti.'));
      const time = requireMonotonicTime(context, scope.occurredAt, found.value); if (!time.ok) return time;
      const target = scope.findRelease(command.pluginId, command.targetVersion); if (!target.ok) return target;
      if (!target.value || Date.parse(target.value.expiresAt) <= Date.parse(scope.occurredAt))
        return err(denied(context, 'Geçerli imzalı geçmiş sürüm olmadan geri dönüş yapılamaz.'));
      const occurredAt = asIsoDateTime(scope.occurredAt); const nextRevision = found.value.revision + 1;
      const id = mutationId(context, command.clientOperationId, requestFingerprint);
      const base: Omit<SignedPluginInstallationRow, 'stateFingerprint'> = Object.freeze({ ...found.value,
        displayName: target.value.displayName, currentVersion: target.value.version, currentReleaseId: target.value.id,
        previousVersion: found.value.currentVersion, desiredState: 'disabled', revision: nextRevision,
        lastMutationId: id, updatedAt: occurredAt });
      const row: SignedPluginInstallationRow = Object.freeze({ ...base, stateFingerprint: installationFingerprint(base) });
      const mutation = mutationRow(context, scope, actor.value, { id, pluginId: command.pluginId,
        mutationKind: 'release_rollback', clientOperationId: command.clientOperationId, requestFingerprint,
        expectedRevision: found.value.revision, revision: nextRevision, stateFingerprint: row.stateFingerprint });
      return persist(context, scope, mutation, undefined, () => scope.saveInstallation(row, found.value!.revision));
    });
  }
}
