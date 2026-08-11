import { createHash } from 'node:crypto';

export const SENSITIVE_LOG_ALLOWED_METADATA_CLASSES = Object.freeze([
  'IDENTIFIER',
  'SHA256',
  'RESULT',
  'CORRELATION',
  'COUNTER',
  'BOOLEAN',
  'TIMESTAMP',
  'VERSION'
] as const);

export type SensitiveLogPolicyRejectionReason =
  | 'EVENT_ENVELOPE_INVALID'
  | 'METADATA_KEY_FORBIDDEN'
  | 'METADATA_KEY_NOT_ALLOWLISTED'
  | 'METADATA_VALUE_INVALID'
  | 'METADATA_NESTING_FORBIDDEN'
  | 'METADATA_LIMIT_EXCEEDED'
  | 'DIAGNOSTIC_ENVELOPE_INVALID'
  | 'DIAGNOSTIC_NOT_CONTENT_FREE';

export interface SensitiveLogPolicySnapshot {
  readonly schemaVersion: 1;
  readonly enforcement: 'fail-closed';
  readonly allowedMetadataClasses: typeof SENSITIVE_LOG_ALLOWED_METADATA_CLASSES;
  readonly maximumMetadataFields: 48;
  readonly maximumTechnicalTokenLength: 160;
  readonly payloadAllowed: false;
  readonly ocrTextAllowed: false;
  readonly arbitraryMessageAllowed: false;
  readonly errorStackAllowed: false;
  readonly persistentPathAllowed: false;
  readonly nestedMetadataAllowed: false;
  readonly diagnosticTextStored: false;
  readonly diagnosticSourceTextHashed: true;
  readonly protectedDesktopSinkRequired: true;
  readonly directConsolePrimitiveAllowedOutsideLoggingPackage: false;
}

export interface SensitiveLogEventInput {
  readonly timestamp: string;
  readonly level: string;
  readonly service: string;
  readonly process: string;
  readonly event: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly durationMs?: number;
  readonly outcome?: string;
  readonly errorCode?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type SensitiveLogEventDecision =
  | { readonly allowed: true; readonly metadata?: Readonly<Record<string, string | number | boolean | readonly number[]>> }
  | { readonly allowed: false; readonly reason: SensitiveLogPolicyRejectionReason };

export interface SensitiveDiagnosticInput {
  readonly id: string;
  readonly severity: string;
  readonly code: string;
  readonly message: string;
  readonly details?: string;
  readonly occurredAt: string;
}

export interface ContentFreeDiagnosticRecord {
  readonly id: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly code: string;
  readonly message: string;
  readonly details?: string;
  readonly occurredAt: string;
}

const MAXIMUM_METADATA_FIELDS = 48;
const MAXIMUM_TECHNICAL_TOKEN_LENGTH = 160;
const TECHNICAL_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,159}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const SHORT_HASH = /^[a-fA-F0-9]{8,128}$/u;
const DIAGNOSTIC_CODE = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const DIAGNOSTIC_DETAILS_HASH = /^sha256:[a-f0-9]{64}$/u;
const FORBIDDEN_METADATA_KEY = /(?:payload|body|text|ocr|transcript|message|detail|content|stack|query|sql|password|secret|token|cookie|credential|authorization|private.?key|totp|file.?path|directory|display.?name|title|note|description)/iu;

const STRING_RESULT_KEYS = new Set([
  'action', 'admissionKind', 'admissionPriority', 'authorityReason', 'channel',
  'applicationVersion', 'classification', 'environment', 'errorName', 'failureCode', 'kind',
  'lifecycle', 'loggingLevel', 'mode', 'operation', 'origin', 'permission', 'policyVersion',
  'previousMode', 'previousReason', 'primaryReason', 'processRole', 'protection',
  'protectionProvider', 'reason', 'recurrence', 'relationType', 'result', 'role',
  'sentinelState', 'signal', 'startupSecurityStatus', 'startupStage', 'state', 'status', 'type'
]);

const NUMBER_ARRAY_KEYS = new Set([
  'adoptedVersions',
  'alreadyAppliedVersions',
  'appliedVersions'
]);

const isIsoDateTime = (value: string): boolean => {
  if (value.length < 20 || value.length > 35) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
};

const isTechnicalToken = (value: string): boolean =>
  value.length <= MAXIMUM_TECHNICAL_TOKEN_LENGTH && TECHNICAL_TOKEN.test(value);

const isIdentifierKey = (key: string): boolean => /(?:^|[A-Z_])(?:id|ids)$/u.test(key) || /Id$/u.test(key);
const isHashKey = (key: string): boolean => /(?:Hash|Fingerprint)$/u.test(key);
const isDateKey = (key: string): boolean => /(?:At|Until)$/u.test(key);

const sanitizeMetadata = (
  metadata: Readonly<Record<string, unknown>> | undefined
): SensitiveLogEventDecision => {
  if (metadata === undefined) return { allowed: true };
  const entries = Object.entries(metadata);
  if (entries.length > MAXIMUM_METADATA_FIELDS) {
    return { allowed: false, reason: 'METADATA_LIMIT_EXCEEDED' };
  }
  const safe: Record<string, string | number | boolean | readonly number[]> = {};
  for (const [key, value] of entries) {
    if (!TECHNICAL_TOKEN.test(key)) return { allowed: false, reason: 'METADATA_KEY_NOT_ALLOWLISTED' };
    if (FORBIDDEN_METADATA_KEY.test(key) && !isHashKey(key)) {
      return { allowed: false, reason: 'METADATA_KEY_FORBIDDEN' };
    }
    if (value === undefined) continue;
    if (typeof value === 'boolean') {
      safe[key] = value;
      continue;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
        return { allowed: false, reason: 'METADATA_VALUE_INVALID' };
      }
      safe[key] = value;
      continue;
    }
    if (typeof value === 'string') {
      if (isHashKey(key)) {
        if (!SHORT_HASH.test(value)) return { allowed: false, reason: 'METADATA_VALUE_INVALID' };
      } else if (isDateKey(key)) {
        if (!isIsoDateTime(value)) return { allowed: false, reason: 'METADATA_VALUE_INVALID' };
      } else if (isIdentifierKey(key) || STRING_RESULT_KEYS.has(key)) {
        if (!isTechnicalToken(value)) return { allowed: false, reason: 'METADATA_VALUE_INVALID' };
      } else {
        return { allowed: false, reason: 'METADATA_KEY_NOT_ALLOWLISTED' };
      }
      safe[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      if (!NUMBER_ARRAY_KEYS.has(key)
        || value.length > 128
        || value.some((item) => !Number.isSafeInteger(item) || Number(item) < 0)) {
        return { allowed: false, reason: 'METADATA_NESTING_FORBIDDEN' };
      }
      safe[key] = Object.freeze([...value]) as readonly number[];
      continue;
    }
    return { allowed: false, reason: 'METADATA_NESTING_FORBIDDEN' };
  }
  return Object.keys(safe).length === 0
    ? { allowed: true }
    : { allowed: true, metadata: Object.freeze(safe) };
};

const diagnosticMessage = (code: string): string => `Teknik tanı sonucu: ${code}.`;
const diagnosticSourceHash = (input: SensitiveDiagnosticInput): string => createHash('sha256')
  .update(input.message, 'utf8')
  .update('\u0000', 'utf8')
  .update(input.details ?? '', 'utf8')
  .digest('hex');

export class SensitiveLogPolicy {
  public snapshot(): SensitiveLogPolicySnapshot {
    return Object.freeze({
      schemaVersion: 1,
      enforcement: 'fail-closed',
      allowedMetadataClasses: SENSITIVE_LOG_ALLOWED_METADATA_CLASSES,
      maximumMetadataFields: MAXIMUM_METADATA_FIELDS,
      maximumTechnicalTokenLength: MAXIMUM_TECHNICAL_TOKEN_LENGTH,
      payloadAllowed: false,
      ocrTextAllowed: false,
      arbitraryMessageAllowed: false,
      errorStackAllowed: false,
      persistentPathAllowed: false,
      nestedMetadataAllowed: false,
      diagnosticTextStored: false,
      diagnosticSourceTextHashed: true,
      protectedDesktopSinkRequired: true,
      directConsolePrimitiveAllowedOutsideLoggingPackage: false
    });
  }

  public evaluate(event: SensitiveLogEventInput): SensitiveLogEventDecision {
    if (!isIsoDateTime(event.timestamp)
      || !['debug', 'info', 'warn', 'error'].includes(event.level)
      || !isTechnicalToken(event.service)
      || !isTechnicalToken(event.process)
      || !isTechnicalToken(event.event)
      || !isTechnicalToken(event.correlationId)
      || (event.causationId !== undefined && !isTechnicalToken(event.causationId))
      || (event.durationMs !== undefined && (!Number.isFinite(event.durationMs) || event.durationMs < 0))
      || (event.outcome !== undefined && !['success', 'failure', 'partial'].includes(event.outcome))
      || (event.errorCode !== undefined && !isTechnicalToken(event.errorCode))) {
      return { allowed: false, reason: 'EVENT_ENVELOPE_INVALID' };
    }
    return sanitizeMetadata(event.metadata);
  }

  public sanitizeDiagnostic(input: SensitiveDiagnosticInput): ContentFreeDiagnosticRecord {
    if (!isTechnicalToken(input.id)
      || !['info', 'warning', 'error'].includes(input.severity)
      || !DIAGNOSTIC_CODE.test(input.code)
      || !isIsoDateTime(input.occurredAt)
      || typeof input.message !== 'string'
      || (input.details !== undefined && typeof input.details !== 'string')) {
      throw new Error('SENSITIVE_LOG_DIAGNOSTIC_ENVELOPE_INVALID');
    }
    const details = input.message.length > 0 || (input.details?.length ?? 0) > 0
      ? `sha256:${diagnosticSourceHash(input)}`
      : undefined;
    return Object.freeze({
      id: input.id,
      severity: input.severity as ContentFreeDiagnosticRecord['severity'],
      code: input.code,
      message: diagnosticMessage(input.code),
      ...(details === undefined ? {} : { details }),
      occurredAt: input.occurredAt
    });
  }

  public verifyDiagnostic(input: SensitiveDiagnosticInput): boolean {
    return isTechnicalToken(input.id)
      && ['info', 'warning', 'error'].includes(input.severity)
      && DIAGNOSTIC_CODE.test(input.code)
      && input.message === diagnosticMessage(input.code)
      && (input.details === undefined || DIAGNOSTIC_DETAILS_HASH.test(input.details))
      && isIsoDateTime(input.occurredAt);
  }

  public hashSensitiveSignal(value: unknown): string {
    const text = typeof value === 'string'
      ? value
      : value instanceof Error
        ? `${value.name}\u0000${value.message}\u0000${value.stack ?? ''}`
        : Object.prototype.toString.call(value);
    return createHash('sha256').update(text, 'utf8').digest('hex');
  }
}

export const isSha256 = (value: string): boolean => SHA256.test(value);
