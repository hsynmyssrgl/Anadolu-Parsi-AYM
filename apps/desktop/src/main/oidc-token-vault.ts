import { createHash, randomBytes } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  validateOidcProviderConfiguration,
  type DeviceSecretProtector,
  type OidcProviderConfiguration,
  type SupportedOidcProviderId
} from '@ppt/security';

const TOKEN_FORMAT = 'ppt-oidc-token-vault' as const;
const STORE_FORMAT = 'ppt-oidc-durable-secret-store' as const;
const VERSION = 1 as const;
const MAX_PROTECTED_BYTES = 128 * 1024;
const MAX_STORE_BYTES = 4 * 1024 * 1024;
const MAX_RECORDS = 512;
const MAX_FLOW_TTL_MS = 10 * 60 * 1000;
const REVOKED_TOMBSTONE_TTL_MS = 31 * 24 * 60 * 60 * 1000;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{1,255}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;

export interface OidcTokenVaultBinding {
  readonly accountId: string;
  readonly providerId: SupportedOidcProviderId;
  readonly linkId: string;
  readonly flowId: string;
}

export interface OidcTokenSet {
  readonly accessToken: string;
  readonly idToken: string;
  readonly refreshToken?: string;
  readonly tokenType: 'Bearer';
  readonly scopes: readonly string[];
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface ProtectedOidcTokenSet {
  readonly format: typeof TOKEN_FORMAT;
  readonly version: typeof VERSION;
  readonly protectionId: string;
  readonly bindingSha256: string;
  readonly protectedPayload: string;
  readonly protectedPayloadSha256: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface OidcAuthorizationFlowSecret {
  readonly configurationId: string;
  readonly configuration: OidcProviderConfiguration;
  readonly stateSha256: string;
  readonly nonceSha256: string;
  readonly codeVerifier: string;
  readonly codeVerifierSha256: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

/** Content-free metadata used only to bind OS deep links back to a protected flow. */
export interface PendingOidcAuthorizationFlowBinding {
  readonly flowId: string;
  readonly accountId: string;
  readonly providerId: SupportedOidcProviderId;
  readonly stateSha256: string;
  readonly redirectUri: string;
  readonly expiresAt: string;
}

export interface CompletedOidcAuthorizationFlow {
  readonly binding: OidcTokenVaultBinding;
  readonly configurationId: string;
  readonly authorizationEndpointSha256: string;
  readonly clientConfigurationSha256: string;
  readonly providerSubjectSha256: string;
  readonly grantedScopes: readonly string[];
  readonly encryptedVaultEntryId: string;
  readonly completedAt: string;
  readonly expiresAt: string;
}

export interface OidcVaultPersistence {
  read(): string | null;
  write(serializedEnvelope: string): void;
}

export class FileSystemOidcVaultPersistence implements OidcVaultPersistence {
  readonly #path: string;
  readonly #maximumBytes: number;

  public constructor(filePath: string, maximumBytes = MAX_STORE_BYTES) {
    if (typeof filePath !== 'string' || filePath.trim() === '' || !Number.isSafeInteger(maximumBytes)
      || maximumBytes < 65_536 || maximumBytes > 16 * 1024 * 1024) {
      throw new Error('OIDC vault persistence secenekleri gecersizdir.');
    }
    this.#path = resolve(filePath);
    this.#maximumBytes = maximumBytes;
  }

  public read(): string | null {
    if (!existsSync(this.#path)) return null;
    if (statSync(this.#path).size > this.#maximumBytes) throw new Error('OIDC vault dosyasi boyut sinirini asti.');
    return readFileSync(this.#path, 'utf8');
  }

  public write(serializedEnvelope: string): void {
    const bytes = Buffer.from(serializedEnvelope, 'utf8');
    if (bytes.length < 2 || bytes.length > this.#maximumBytes) throw new Error('OIDC vault dosyasi boyut sinirini asti.');
    mkdirSync(dirname(this.#path), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.#path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
    let descriptor: number | undefined;
    try {
      descriptor = openSync(temporaryPath, 'wx', 0o600);
      writeFileSync(descriptor, bytes);
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = undefined;
      try { chmodSync(temporaryPath, 0o600); } catch { /* Windows ACL and device protection are authoritative. */ }
      renameSync(temporaryPath, this.#path);
      try { chmodSync(this.#path, 0o600); } catch { /* Windows ACL and device protection are authoritative. */ }
    } catch (error) {
      if (descriptor !== undefined) try { closeSync(descriptor); } catch { /* best effort */ }
      rmSync(temporaryPath, { force: true });
      throw error;
    } finally {
      bytes.fill(0);
    }
  }
}

interface StoredAuthorizationFlow {
  readonly kind: 'authorization_flow';
  readonly recordId: string;
  readonly binding: OidcTokenVaultBinding;
  readonly secret: OidcAuthorizationFlowSecret;
}

interface StoredCompletedFlow {
  readonly kind: 'completed_flow';
  readonly recordId: string;
  readonly value: CompletedOidcAuthorizationFlow;
}

interface StoredActiveToken {
  readonly kind: 'active_token';
  readonly recordId: string;
  readonly entryId: string;
  readonly bindingSha256: string;
  readonly protectedSet: ProtectedOidcTokenSet;
}

interface StoredRevokedToken {
  readonly kind: 'revoked_token';
  readonly recordId: string;
  readonly entryId: string;
  readonly bindingSha256: string;
  readonly revokedAt: string;
}

type OidcVaultRecord = StoredAuthorizationFlow | StoredCompletedFlow | StoredActiveToken | StoredRevokedToken;

interface OidcVaultPayload {
  readonly format: typeof STORE_FORMAT;
  readonly version: typeof VERSION;
  readonly revision: number;
  readonly records: readonly OidcVaultRecord[];
}

interface ProtectedOidcVaultEnvelope {
  readonly format: typeof STORE_FORMAT;
  readonly version: typeof VERSION;
  readonly protectionId: string;
  readonly payloadSha256: string;
  readonly protectedPayload: string;
}

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const validSha256 = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
const validIso = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  && new Date(value).toISOString() === value;
const validId = (value: unknown): value is string => typeof value === 'string' && value === value.trim() && ID.test(value);
const validToken = (value: unknown): value is string => typeof value === 'string' && value.length >= 8 && value.length <= 32 * 1024
  && !/[\u0000-\u0020\u007f]/u.test(value);
const validProtected = (value: unknown, maximumBytes = MAX_PROTECTED_BYTES): value is string => typeof value === 'string' && value.length >= 4
  && value.length <= Math.ceil(maximumBytes / 3) * 4
  && value.length % 4 === 0 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)
  && Buffer.from(value, 'base64').toString('base64') === value
  && Buffer.from(value, 'base64').length <= maximumBytes;
const plainRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
  && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const normalizedScopes = (scopes: readonly string[]): readonly string[] => {
  const result = [...new Set(scopes)].sort();
  if (result.length < 1 || result.length > 16 || !result.includes('openid')
    || result.some((scope) => !/^[A-Za-z0-9._:-]{1,64}$/u.test(scope))) throw new Error('OIDC token scope kumesi gecersizdir.');
  return Object.freeze(result);
};

const validateBinding = (binding: OidcTokenVaultBinding): OidcTokenVaultBinding => {
  if (!validId(binding.accountId) || !validId(binding.linkId) || !validId(binding.flowId)
    || !['apple', 'google', 'microsoft'].includes(binding.providerId)) throw new Error('OIDC token vault binding gecersizdir.');
  return Object.freeze({ ...binding });
};

const bindingSha256 = (binding: OidcTokenVaultBinding): string => {
  const valid = validateBinding(binding);
  return sha256(JSON.stringify([valid.accountId, valid.providerId, valid.linkId, valid.flowId]));
};

const validateTokenSet = (value: OidcTokenSet): OidcTokenSet => {
  if (!validToken(value.accessToken) || !validToken(value.idToken)
    || (value.refreshToken !== undefined && !validToken(value.refreshToken))
    || value.tokenType !== 'Bearer' || !validIso(value.issuedAt) || !validIso(value.expiresAt)
    || Date.parse(value.expiresAt) <= Date.parse(value.issuedAt)) throw new Error('OIDC token set gecersizdir.');
  return Object.freeze({ ...value, scopes: normalizedScopes(value.scopes) });
};

const validateProtectedSet = (value: unknown): value is ProtectedOidcTokenSet => {
  if (!plainRecord(value) || !exactKeys(value, [
    'format', 'version', 'protectionId', 'bindingSha256', 'protectedPayload', 'protectedPayloadSha256', 'issuedAt', 'expiresAt'
  ])) return false;
  return value.format === TOKEN_FORMAT && value.version === VERSION && validId(value.protectionId)
    && validSha256(value.bindingSha256) && validProtected(value.protectedPayload)
    && validSha256(value.protectedPayloadSha256) && sha256(value.protectedPayload) === value.protectedPayloadSha256
    && validIso(value.issuedAt) && validIso(value.expiresAt) && Date.parse(value.expiresAt) > Date.parse(value.issuedAt);
};

const validateConfiguration = (value: unknown): value is OidcProviderConfiguration => {
  if (!plainRecord(value) || !exactKeys(value, [
    'providerId', 'issuer', 'authorizationEndpoint', 'tokenEndpoint', 'jwksUri', 'clientId', 'redirectUri', 'scopes'
  ]) || !Array.isArray(value.scopes) || value.scopes.some((scope) => typeof scope !== 'string')) return false;
  try { validateOidcProviderConfiguration(value as unknown as OidcProviderConfiguration); return true; }
  catch { return false; }
};

const validateFlowSecret = (value: unknown, binding: OidcTokenVaultBinding): value is OidcAuthorizationFlowSecret => {
  if (!plainRecord(value) || !exactKeys(value, [
    'configurationId', 'configuration', 'stateSha256', 'nonceSha256', 'codeVerifier', 'codeVerifierSha256', 'createdAt', 'expiresAt'
  ]) || !validId(value.configurationId) || !validateConfiguration(value.configuration)
    || value.configuration.providerId !== binding.providerId || !validSha256(value.stateSha256) || !validSha256(value.nonceSha256)
    || typeof value.codeVerifier !== 'string' || value.codeVerifier.length < 43 || value.codeVerifier.length > 128
    || !BASE64URL.test(value.codeVerifier) || !validSha256(value.codeVerifierSha256)
    || sha256(value.codeVerifier) !== value.codeVerifierSha256 || !validIso(value.createdAt) || !validIso(value.expiresAt)
    || Date.parse(value.expiresAt) <= Date.parse(value.createdAt)
    || Date.parse(value.expiresAt) - Date.parse(value.createdAt) > MAX_FLOW_TTL_MS) return false;
  return true;
};

const validateCompletedFlow = (value: unknown): value is CompletedOidcAuthorizationFlow => {
  if (!plainRecord(value) || !exactKeys(value, [
    'binding', 'configurationId', 'authorizationEndpointSha256', 'clientConfigurationSha256',
    'providerSubjectSha256', 'grantedScopes', 'encryptedVaultEntryId', 'completedAt', 'expiresAt'
  ]) || !plainRecord(value.binding) || !validId(value.configurationId)
    || !validSha256(value.authorizationEndpointSha256) || !validSha256(value.clientConfigurationSha256)
    || !validSha256(value.providerSubjectSha256)
    || !Array.isArray(value.grantedScopes) || value.grantedScopes.some((scope) => typeof scope !== 'string')
    || !validId(value.encryptedVaultEntryId) || !validIso(value.completedAt) || !validIso(value.expiresAt)
    || Date.parse(value.expiresAt) <= Date.parse(value.completedAt)
    || Date.parse(value.expiresAt) - Date.parse(value.completedAt) > MAX_FLOW_TTL_MS) return false;
  try {
    validateBinding(value.binding as unknown as OidcTokenVaultBinding);
    normalizedScopes(value.grantedScopes as string[]);
    return true;
  } catch { return false; }
};

const validateRecord = (value: unknown): value is OidcVaultRecord => {
  if (!plainRecord(value) || typeof value.kind !== 'string' || !validId(value.recordId)) return false;
  if (value.kind === 'authorization_flow') {
    if (!exactKeys(value, ['kind', 'recordId', 'binding', 'secret']) || !plainRecord(value.binding)) return false;
    try {
      const binding = validateBinding(value.binding as unknown as OidcTokenVaultBinding);
      return value.recordId === `flow:${sha256(binding.flowId)}` && validateFlowSecret(value.secret, binding);
    } catch { return false; }
  }
  if (value.kind === 'completed_flow') {
    return exactKeys(value, ['kind', 'recordId', 'value']) && validateCompletedFlow(value.value)
      && value.recordId === `completed:${sha256(value.value.binding.flowId)}`;
  }
  if (value.kind === 'active_token') {
    return exactKeys(value, ['kind', 'recordId', 'entryId', 'bindingSha256', 'protectedSet'])
      && validId(value.entryId) && value.recordId === value.entryId && validSha256(value.bindingSha256)
      && validateProtectedSet(value.protectedSet) && value.bindingSha256 === value.protectedSet.bindingSha256;
  }
  if (value.kind === 'revoked_token') {
    return exactKeys(value, ['kind', 'recordId', 'entryId', 'bindingSha256', 'revokedAt'])
      && validId(value.entryId) && value.recordId === value.entryId && validSha256(value.bindingSha256) && validIso(value.revokedAt);
  }
  return false;
};

const cloneConfiguration = (value: OidcProviderConfiguration): OidcProviderConfiguration => Object.freeze({
  ...value,
  scopes: Object.freeze([...value.scopes])
});

export class OidcTokenVault {
  readonly #protector: DeviceSecretProtector;
  readonly #persistence: OidcVaultPersistence | undefined;

  public constructor(protector: DeviceSecretProtector, persistence?: OidcVaultPersistence) {
    if (!validId(protector.protectionId)) throw new Error('OIDC token vault protection kimligi gecersizdir.');
    this.#protector = protector;
    this.#persistence = persistence;
  }

  public seal(binding: OidcTokenVaultBinding, tokenSet: OidcTokenSet): ProtectedOidcTokenSet {
    if (!this.#protector.isAvailable()) throw new Error('OIDC token vault device protection kullanilamiyor.');
    const exactBindingHash = bindingSha256(binding);
    const normalized = validateTokenSet(tokenSet);
    const plaintext = JSON.stringify({
      format: TOKEN_FORMAT,
      version: VERSION,
      bindingSha256: exactBindingHash,
      tokenSet: normalized
    });
    const protectedPayload = this.#protector.protect(plaintext);
    if (!validProtected(protectedPayload)) throw new Error('OIDC token vault protected payload gecersizdir.');
    return Object.freeze({
      format: TOKEN_FORMAT,
      version: VERSION,
      protectionId: this.#protector.protectionId,
      bindingSha256: exactBindingHash,
      protectedPayload,
      protectedPayloadSha256: sha256(protectedPayload),
      issuedAt: normalized.issuedAt,
      expiresAt: normalized.expiresAt
    });
  }

  public open(binding: OidcTokenVaultBinding, protectedSet: ProtectedOidcTokenSet, observedAt: string): OidcTokenSet {
    if (!this.#protector.isAvailable()) throw new Error('OIDC token vault device protection kullanilamiyor.');
    const expectedBinding = bindingSha256(binding);
    if (!validateProtectedSet(protectedSet) || protectedSet.protectionId !== this.#protector.protectionId
      || protectedSet.bindingSha256 !== expectedBinding || !validIso(observedAt)
      || Date.parse(observedAt) < Date.parse(protectedSet.issuedAt)
      || Date.parse(observedAt) >= Date.parse(protectedSet.expiresAt)) throw new Error('OIDC token vault metadata veya sure gecersizdir.');
    let parsed: unknown;
    try { parsed = JSON.parse(this.#protector.unprotect(protectedSet.protectedPayload)); }
    catch { throw new Error('OIDC token vault payload acilamadi.'); }
    if (!plainRecord(parsed) || !exactKeys(parsed, ['bindingSha256', 'format', 'tokenSet', 'version'])
      || parsed.format !== TOKEN_FORMAT || parsed.version !== VERSION || parsed.bindingSha256 !== expectedBinding
      || !plainRecord(parsed.tokenSet)) throw new Error('OIDC token vault plaintext binding gecersizdir.');
    const token = parsed.tokenSet as unknown as OidcTokenSet;
    const exactTokenKeys = Object.keys(token as unknown as Record<string, unknown>).sort();
    const expectedTokenKeys = ['accessToken', 'idToken', 'issuedAt', 'expiresAt', 'scopes', 'tokenType', ...(token.refreshToken === undefined ? [] : ['refreshToken'])].sort();
    if (JSON.stringify(exactTokenKeys) !== JSON.stringify(expectedTokenKeys)) throw new Error('OIDC token set alanlari exact degildir.');
    const normalized = validateTokenSet(token);
    if (normalized.issuedAt !== protectedSet.issuedAt || normalized.expiresAt !== protectedSet.expiresAt) {
      throw new Error('OIDC token vault zaman binding eslesmedi.');
    }
    return normalized;
  }

  public storeAuthorizationFlow(binding: OidcTokenVaultBinding, secret: OidcAuthorizationFlowSecret, observedAt: string): void {
    const exactBinding = validateBinding(binding);
    if (!validIso(observedAt) || !validateFlowSecret(secret, exactBinding)
      || Date.parse(secret.createdAt) > Date.parse(observedAt) + 60_000
      || Date.parse(secret.expiresAt) <= Date.parse(observedAt)) throw new Error('OIDC authorization flow secret gecersizdir.');
    const state = this.#load();
    const records = this.#prune(state.records, observedAt);
    const recordId = `flow:${sha256(exactBinding.flowId)}`;
    if (records.some((record) => record.recordId === recordId)) throw new Error('OIDC authorization flow replay veya duplicate kaydidir.');
    this.#persist(state.revision + 1, [...records, Object.freeze({
      kind: 'authorization_flow' as const,
      recordId,
      binding: exactBinding,
      secret: Object.freeze({ ...secret, configuration: cloneConfiguration(secret.configuration) })
    })]);
  }

  public takeAuthorizationFlow(input: {
    readonly flowId: string;
    readonly accountId: string;
    readonly observedAt: string;
  }): { readonly binding: OidcTokenVaultBinding; readonly secret: OidcAuthorizationFlowSecret } | null {
    if (!validId(input.flowId) || !validId(input.accountId) || !validIso(input.observedAt)) throw new Error('OIDC flow consume binding gecersizdir.');
    const state = this.#load();
    const records = this.#prune(state.records, input.observedAt);
    const recordId = `flow:${sha256(input.flowId)}`;
    const record = records.find((candidate): candidate is StoredAuthorizationFlow => candidate.kind === 'authorization_flow' && candidate.recordId === recordId);
    if (!record || record.binding.accountId !== input.accountId || Date.parse(record.secret.expiresAt) <= Date.parse(input.observedAt)) {
      if (records.length !== state.records.length) this.#persist(state.revision + 1, records);
      return null;
    }
    this.#persist(state.revision + 1, records.filter((candidate) => candidate.recordId !== recordId));
    return Object.freeze({ binding: record.binding, secret: record.secret });
  }

  public listPendingAuthorizationFlowBindings(observedAt: string): readonly PendingOidcAuthorizationFlowBinding[] {
    if (!validIso(observedAt)) throw new Error('OIDC pending flow lookup zamani gecersizdir.');
    const state = this.#load();
    const records = this.#prune(state.records, observedAt);
    if (records.length !== state.records.length) this.#persist(state.revision + 1, records);
    return Object.freeze(records
      .filter((record): record is StoredAuthorizationFlow => record.kind === 'authorization_flow')
      .map((record) => Object.freeze({
        flowId: record.binding.flowId,
        accountId: record.binding.accountId,
        providerId: record.binding.providerId,
        stateSha256: record.secret.stateSha256,
        redirectUri: record.secret.configuration.redirectUri,
        expiresAt: record.secret.expiresAt
      })));
  }

  public discardAuthorizationFlow(flowId: string, observedAt = new Date().toISOString()): void {
    if (!validId(flowId) || !validIso(observedAt)) throw new Error('OIDC flow discard binding gecersizdir.');
    const state = this.#load();
    const records = this.#prune(state.records, observedAt);
    const recordId = `flow:${sha256(flowId)}`;
    const filtered = records.filter((record) => record.recordId !== recordId);
    if (filtered.length !== state.records.length) this.#persist(state.revision + 1, filtered);
  }

  public putToken(binding: OidcTokenVaultBinding, tokenSet: OidcTokenSet, observedAt: string): string {
    if (!validIso(observedAt)) throw new Error('OIDC token persist zamani gecersizdir.');
    const protectedSet = this.seal(binding, tokenSet);
    if (Date.parse(protectedSet.issuedAt) > Date.parse(observedAt)
      || Date.parse(protectedSet.expiresAt) <= Date.parse(observedAt)) throw new Error('Gelecek veya suresi dolmus OIDC token persist edilemez.');
    const state = this.#load();
    const records = this.#prune(state.records, observedAt);
    if (records.length >= MAX_RECORDS) throw new Error('OIDC vault kayit kotasi dolu.');
    let entryId: string;
    do { entryId = `oidc-${randomBytes(24).toString('hex')}`; }
    while (records.some((record) => record.recordId === entryId));
    const exactBindingHash = bindingSha256(binding);
    this.#persist(state.revision + 1, [...records, Object.freeze({
      kind: 'active_token' as const,
      recordId: entryId,
      entryId,
      bindingSha256: exactBindingHash,
      protectedSet
    })]);
    return entryId;
  }

  public getToken(binding: OidcTokenVaultBinding, entryId: string, observedAt: string): OidcTokenSet {
    if (!validId(entryId) || !validIso(observedAt)) throw new Error('OIDC token lookup binding gecersizdir.');
    const state = this.#load();
    const record = state.records.find((candidate): candidate is StoredActiveToken => candidate.kind === 'active_token' && candidate.entryId === entryId);
    if (!record || record.bindingSha256 !== bindingSha256(binding)) throw new Error('OIDC token entry bulunamadi veya iptal edildi.');
    return this.open(binding, record.protectedSet, observedAt);
  }

  public isActiveTokenEntry(binding: OidcTokenVaultBinding, entryId: string, observedAt: string): boolean {
    if (!validId(entryId) || !validIso(observedAt)) return false;
    try {
      const state = this.#load();
      const record = state.records.find((candidate): candidate is StoredActiveToken => candidate.kind === 'active_token' && candidate.entryId === entryId);
      return Boolean(record && record.bindingSha256 === bindingSha256(binding)
        && record.protectedSet.protectionId === this.#protector.protectionId
        && Date.parse(record.protectedSet.issuedAt) <= Date.parse(observedAt)
        && Date.parse(record.protectedSet.expiresAt) > Date.parse(observedAt));
    } catch { return false; }
  }

  public revokeToken(entryId: string, observedAt: string): boolean {
    if (!validId(entryId) || !validIso(observedAt)) throw new Error('OIDC token revoke binding gecersizdir.');
    const state = this.#load();
    const records = this.#prune(state.records, observedAt);
    const index = records.findIndex((record) => record.kind === 'active_token' && record.entryId === entryId);
    if (index < 0) {
      if (records.length !== state.records.length) this.#persist(state.revision + 1, records);
      return records.some((record) => record.kind === 'revoked_token' && record.entryId === entryId);
    }
    const active = records[index] as StoredActiveToken;
    const next = [...records];
    next[index] = Object.freeze({
      kind: 'revoked_token' as const,
      recordId: entryId,
      entryId,
      bindingSha256: active.bindingSha256,
      revokedAt: observedAt
    });
    this.#persist(state.revision + 1, next);
    return true;
  }

  public storeCompletedFlow(value: CompletedOidcAuthorizationFlow, observedAt: string): void {
    if (!validateCompletedFlow(value) || !validIso(observedAt)
      || Date.parse(value.completedAt) > Date.parse(observedAt) + 60_000
      || Date.parse(value.expiresAt) <= Date.parse(observedAt)
      || !this.isActiveTokenEntry(value.binding, value.encryptedVaultEntryId, observedAt)) {
      throw new Error('OIDC completed flow binding gecersizdir.');
    }
    const state = this.#load();
    const records = this.#prune(state.records, observedAt);
    const recordId = `completed:${sha256(value.binding.flowId)}`;
    if (records.some((record) => record.recordId === recordId)) throw new Error('OIDC completed flow duplicate kaydidir.');
    this.#persist(state.revision + 1, [...records, Object.freeze({ kind: 'completed_flow' as const, recordId, value: Object.freeze({
      ...value,
      binding: validateBinding(value.binding),
      grantedScopes: normalizedScopes(value.grantedScopes)
    }) })]);
  }

  public takeCompletedFlow(input: {
    readonly flowId: string;
    readonly accountId: string;
    readonly providerId: SupportedOidcProviderId;
    readonly expectedLinkId: string;
    readonly observedAt: string;
  }): CompletedOidcAuthorizationFlow | null {
    if (!validId(input.flowId) || !validId(input.accountId) || !validId(input.expectedLinkId) || !validIso(input.observedAt)) throw new Error('OIDC completed flow consume binding gecersizdir.');
    const state = this.#load();
    const records = this.#prune(state.records, input.observedAt);
    const recordId = `completed:${sha256(input.flowId)}`;
    const record = records.find((candidate): candidate is StoredCompletedFlow => candidate.kind === 'completed_flow' && candidate.recordId === recordId);
    if (!record || record.value.binding.accountId !== input.accountId || record.value.binding.providerId !== input.providerId
      || record.value.binding.linkId !== input.expectedLinkId
      || !this.isActiveTokenEntry(record.value.binding, record.value.encryptedVaultEntryId, input.observedAt)) {
      if (records.length !== state.records.length) this.#persist(state.revision + 1, records);
      return null;
    }
    this.#persist(state.revision + 1, records.filter((candidate) => candidate.recordId !== recordId));
    return record.value;
  }

  #load(): OidcVaultPayload {
    if (!this.#persistence) throw new Error('OIDC durable vault persistence yapilandirilmadi.');
    if (!this.#protector.isAvailable()) throw new Error('OIDC durable vault device protection kullanilamiyor.');
    const serialized = this.#persistence.read();
    if (serialized === null) return Object.freeze({ format: STORE_FORMAT, version: VERSION, revision: 0, records: Object.freeze([]) });
    if (Buffer.byteLength(serialized, 'utf8') > MAX_STORE_BYTES) throw new Error('OIDC durable vault envelope boyutu gecersizdir.');
    let envelopeValue: unknown;
    try { envelopeValue = JSON.parse(serialized); } catch { throw new Error('OIDC durable vault envelope JSON degildir.'); }
    if (!plainRecord(envelopeValue) || !exactKeys(envelopeValue, ['format', 'version', 'protectionId', 'payloadSha256', 'protectedPayload'])
      || envelopeValue.format !== STORE_FORMAT || envelopeValue.version !== VERSION
      || envelopeValue.protectionId !== this.#protector.protectionId || !validSha256(envelopeValue.payloadSha256)
      || !validProtected(envelopeValue.protectedPayload, MAX_STORE_BYTES)) throw new Error('OIDC durable vault envelope gecersizdir.');
    let payloadText: string;
    try { payloadText = this.#protector.unprotect(envelopeValue.protectedPayload); }
    catch { throw new Error('OIDC durable vault payload acilamadi.'); }
    if (sha256(payloadText) !== envelopeValue.payloadSha256) throw new Error('OIDC durable vault payload hash eslesmedi.');
    let payloadValue: unknown;
    try { payloadValue = JSON.parse(payloadText); } catch { throw new Error('OIDC durable vault payload JSON degildir.'); }
    if (!plainRecord(payloadValue) || !exactKeys(payloadValue, ['format', 'version', 'revision', 'records'])
      || payloadValue.format !== STORE_FORMAT || payloadValue.version !== VERSION
      || !Number.isSafeInteger(payloadValue.revision) || Number(payloadValue.revision) < 0
      || !Array.isArray(payloadValue.records) || payloadValue.records.length > MAX_RECORDS
      || !payloadValue.records.every(validateRecord)) throw new Error('OIDC durable vault payload sozlesmesi gecersizdir.');
    const records = payloadValue.records as OidcVaultRecord[];
    if (new Set(records.map((record) => record.recordId)).size !== records.length) throw new Error('OIDC durable vault duplicate record iceriyor.');
    return Object.freeze({ format: STORE_FORMAT, version: VERSION, revision: Number(payloadValue.revision), records: Object.freeze([...records]) });
  }

  #persist(revision: number, records: readonly OidcVaultRecord[]): void {
    if (!this.#persistence || !this.#protector.isAvailable() || !Number.isSafeInteger(revision) || revision < 1 || records.length > MAX_RECORDS
      || !records.every(validateRecord) || new Set(records.map((record) => record.recordId)).size !== records.length) {
      throw new Error('OIDC durable vault persist sozlesmesi gecersizdir.');
    }
    const payload: OidcVaultPayload = Object.freeze({ format: STORE_FORMAT, version: VERSION, revision, records: Object.freeze([...records]) });
    const payloadText = JSON.stringify(payload);
    const protectedPayload = this.#protector.protect(payloadText);
    if (!validProtected(protectedPayload, MAX_STORE_BYTES)) throw new Error('OIDC durable vault protected payload gecersizdir.');
    const envelope: ProtectedOidcVaultEnvelope = Object.freeze({
      format: STORE_FORMAT,
      version: VERSION,
      protectionId: this.#protector.protectionId,
      payloadSha256: sha256(payloadText),
      protectedPayload
    });
    const serialized = `${JSON.stringify(envelope, null, 2)}\n`;
    if (Buffer.byteLength(serialized, 'utf8') > MAX_STORE_BYTES) throw new Error('OIDC durable vault envelope boyutu gecersizdir.');
    this.#persistence.write(serialized);
  }

  #prune(records: readonly OidcVaultRecord[], observedAt: string): readonly OidcVaultRecord[] {
    const now = Date.parse(observedAt);
    return records.filter((record) => {
      if (record.kind === 'authorization_flow') return Date.parse(record.secret.expiresAt) > now;
      if (record.kind === 'completed_flow') return Date.parse(record.value.expiresAt) > now;
      if (record.kind === 'active_token') return Date.parse(record.protectedSet.expiresAt) > now;
      return now - Date.parse(record.revokedAt) <= REVOKED_TOMBSTONE_TTL_MS;
    });
  }
}
