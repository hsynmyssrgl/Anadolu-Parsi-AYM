import type { PlatformApplicationId } from './policy-kernel.js';

export const VERSIONED_CORE_SERVICE_API_DIRECT_IMPORT_EXCEPTIONS = Object.freeze([] as const);

export type VersionedCoreServiceApiDenialReason =
  | 'ALLOW_VERSIONED_API'
  | 'MALFORMED_ENVELOPE'
  | 'PROTOCOL_VERSION_MISMATCH'
  | 'CLIENT_APPLICATION_NOT_ALLOWED'
  | 'API_VERSION_MISMATCH'
  | 'METHOD_NOT_ALLOWED'
  | 'REQUEST_EXPIRED'
  | 'REQUEST_FROM_FUTURE'
  | 'REPLAY_DETECTED'
  | 'REPLAY_STATE_CAPACITY_EXCEEDED';

export interface VersionedCoreServiceApiRequestEnvelope {
  readonly protocolVersion: number;
  readonly apiVersion: string;
  readonly clientApplicationId: PlatformApplicationId;
  readonly requestId: string;
  readonly issuedAt: string;
  readonly method: string;
  readonly authenticationToken: string;
  readonly payload: unknown;
}

export interface VersionedCoreServiceApiAuthoritativeContext {
  readonly protocolVersion: number;
  readonly apiVersion: string;
  readonly clientApplicationId: PlatformApplicationId;
  readonly clientApplicationApiVersion: string;
  readonly supportedMethods: readonly string[];
  readonly observedAt: string;
  readonly maximumRequestAgeMs: number;
  readonly maximumFutureSkewMs: number;
  readonly maximumReplayEntries: number;
}

export interface VersionedCoreServiceApiDecision {
  readonly allowed: boolean;
  readonly reason: VersionedCoreServiceApiDenialReason;
  readonly directCoreServiceImportAllowed: false;
}

export interface VersionedCoreServiceApiBoundarySnapshot {
  readonly schemaVersion: 1;
  readonly enforcement: 'fail-closed';
  readonly exactEnvelopeRequired: true;
  readonly applicationVersionBindingRequired: true;
  readonly freshnessRequired: true;
  readonly replayProtection: 'in-memory-per-process-fail-closed';
  readonly directCoreServiceImportAllowed: false;
  readonly directImportExceptionCount: 0;
  readonly maximumRequestAgeMs: number;
  readonly maximumFutureSkewMs: number;
  readonly maximumReplayEntries: number;
}

const REQUEST_KEYS = Object.freeze([
  'protocolVersion', 'apiVersion', 'clientApplicationId', 'requestId', 'issuedAt',
  'method', 'authenticationToken', 'payload'
] as const);
const APPLICATION_IDS = new Set<PlatformApplicationId>([
  'windows-desktop', 'windows-core-service', 'windows-cluster-agent', 'macos-companion',
  'ios-companion', 'ipados-companion', 'watchos-companion', 'visionos-companion',
  'ocr-worker', 'ai-worker', 'translation-worker', 'communication-service',
  'backup-worker', 'signed-plugin'
]);
const METHOD_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u;

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length && actual.every((key, index) => key === canonical[index]);
};

const nonEmpty = (value: unknown, maximum: number): value is string =>
  typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= maximum;

const strictIso = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
};

const validEnvelope = (value: unknown): value is VersionedCoreServiceApiRequestEnvelope => {
  if (!isPlainRecord(value) || !exactKeys(value, REQUEST_KEYS)) return false;
  return Number.isSafeInteger(value.protocolVersion) && Number(value.protocolVersion) >= 1
    && nonEmpty(value.apiVersion, 128)
    && APPLICATION_IDS.has(value.clientApplicationId as PlatformApplicationId)
    && nonEmpty(value.requestId, 128)
    && strictIso(value.issuedAt)
    && nonEmpty(value.method, 128) && METHOD_PATTERN.test(value.method)
    && nonEmpty(value.authenticationToken, 4096) && value.authenticationToken.length >= 32;
};

const validContext = (value: unknown): value is VersionedCoreServiceApiAuthoritativeContext => {
  if (!isPlainRecord(value) || !exactKeys(value, [
    'protocolVersion', 'apiVersion', 'clientApplicationId', 'clientApplicationApiVersion',
    'supportedMethods', 'observedAt', 'maximumRequestAgeMs', 'maximumFutureSkewMs',
    'maximumReplayEntries'
  ])) return false;
  return Number.isSafeInteger(value.protocolVersion) && Number(value.protocolVersion) >= 1
    && nonEmpty(value.apiVersion, 128)
    && APPLICATION_IDS.has(value.clientApplicationId as PlatformApplicationId)
    && nonEmpty(value.clientApplicationApiVersion, 128)
    && Array.isArray(value.supportedMethods) && value.supportedMethods.length > 0
    && value.supportedMethods.every((method) => nonEmpty(method, 128) && METHOD_PATTERN.test(method))
    && new Set(value.supportedMethods).size === value.supportedMethods.length
    && strictIso(value.observedAt)
    && Number.isSafeInteger(value.maximumRequestAgeMs) && Number(value.maximumRequestAgeMs) >= 1_000 && Number(value.maximumRequestAgeMs) <= 300_000
    && Number.isSafeInteger(value.maximumFutureSkewMs) && Number(value.maximumFutureSkewMs) >= 0 && Number(value.maximumFutureSkewMs) <= 30_000
    && Number.isSafeInteger(value.maximumReplayEntries) && Number(value.maximumReplayEntries) >= 16 && Number(value.maximumReplayEntries) <= 65_536;
};

const decision = (allowed: boolean, reason: VersionedCoreServiceApiDenialReason): VersionedCoreServiceApiDecision =>
  Object.freeze({ allowed, reason, directCoreServiceImportAllowed: false });

/**
 * Core Service dışındaki bir uygulamanın tek yetkili girişini sürüm, uygulama,
 * yöntem, tazelik ve tekrar bağlarıyla fail-closed korur.
 */
export class VersionedCoreServiceApiBoundaryPolicy {
  readonly #replayExpirations = new Map<string, number>();

  public authorize(
    request: unknown,
    authoritativeContext: unknown
  ): VersionedCoreServiceApiDecision {
    if (!validEnvelope(request) || !validContext(authoritativeContext)) {
      return decision(false, 'MALFORMED_ENVELOPE');
    }
    if (request.protocolVersion !== authoritativeContext.protocolVersion) {
      return decision(false, 'PROTOCOL_VERSION_MISMATCH');
    }
    if (request.clientApplicationId !== authoritativeContext.clientApplicationId) {
      return decision(false, 'CLIENT_APPLICATION_NOT_ALLOWED');
    }
    if (
      request.apiVersion !== authoritativeContext.apiVersion
      || request.apiVersion !== authoritativeContext.clientApplicationApiVersion
    ) return decision(false, 'API_VERSION_MISMATCH');
    if (!authoritativeContext.supportedMethods.includes(request.method)) {
      return decision(false, 'METHOD_NOT_ALLOWED');
    }

    const now = Date.parse(authoritativeContext.observedAt);
    const issuedAt = Date.parse(request.issuedAt);
    if (now - issuedAt >= authoritativeContext.maximumRequestAgeMs) {
      return decision(false, 'REQUEST_EXPIRED');
    }
    if (issuedAt - now > authoritativeContext.maximumFutureSkewMs) {
      return decision(false, 'REQUEST_FROM_FUTURE');
    }

    for (const [requestId, expiresAt] of this.#replayExpirations) {
      if (expiresAt <= now) this.#replayExpirations.delete(requestId);
    }
    if (this.#replayExpirations.has(request.requestId)) {
      return decision(false, 'REPLAY_DETECTED');
    }
    if (this.#replayExpirations.size >= authoritativeContext.maximumReplayEntries) {
      return decision(false, 'REPLAY_STATE_CAPACITY_EXCEEDED');
    }
    this.#replayExpirations.set(
      request.requestId,
      now + authoritativeContext.maximumRequestAgeMs + authoritativeContext.maximumFutureSkewMs
    );
    return decision(true, 'ALLOW_VERSIONED_API');
  }

  public snapshot(input: {
    readonly maximumRequestAgeMs: number;
    readonly maximumFutureSkewMs: number;
    readonly maximumReplayEntries: number;
  }): VersionedCoreServiceApiBoundarySnapshot {
    return Object.freeze({
      schemaVersion: 1,
      enforcement: 'fail-closed',
      exactEnvelopeRequired: true,
      applicationVersionBindingRequired: true,
      freshnessRequired: true,
      replayProtection: 'in-memory-per-process-fail-closed',
      directCoreServiceImportAllowed: false,
      directImportExceptionCount: VERSIONED_CORE_SERVICE_API_DIRECT_IMPORT_EXCEPTIONS.length,
      maximumRequestAgeMs: input.maximumRequestAgeMs,
      maximumFutureSkewMs: input.maximumFutureSkewMs,
      maximumReplayEntries: input.maximumReplayEntries
    });
  }
}
