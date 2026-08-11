
import type { CorrelationId } from './brand.js';

export const ERROR_CODES = Object.freeze({
  CORE_UNEXPECTED: 'CORE-UNEXPECTED-001',
  CORE_INVALID_ARGUMENT: 'CORE-VALIDATION-001',
  CONTRACT_INVALID: 'CONTRACT-VALIDATION-001',
  CONFIG_INVALID: 'CONFIG-VALIDATION-001',
  AUTHENTICATION_REQUIRED: 'AUTH-REQUIRED-001',
  AUTH_INVALID_CREDENTIALS: 'AUTH-CREDENTIALS-001',
  AUTH_ACCOUNT_LOCKED: 'AUTH-LOCKED-001',
  AUTH_SECOND_FACTOR_REQUIRED: 'AUTH-2FA-REQUIRED-001',
  AUTH_SECOND_FACTOR_INVALID: 'AUTH-2FA-INVALID-001',
  AUTH_DEVICE_NOT_TRUSTED: 'AUTH-DEVICE-TRUST-001',
  AUTHORIZATION_DENIED: 'PERMISSION-DENIED-001',
  RESOURCE_NOT_FOUND: 'RESOURCE-NOT-FOUND-001',
  RESOURCE_CONFLICT: 'RESOURCE-CONFLICT-001',
  DATABASE_BUSY: 'DATABASE-BUSY-001',
  DATABASE_LOCKED: 'DATABASE-LOCKED-001',
  DATABASE_CORRUPT: 'DATABASE-CORRUPT-001',
  DATABASE_DISK_FULL: 'DATABASE-DISK-FULL-001',
  DATABASE_READ_ONLY: 'DATABASE-READ-ONLY-001',
  MIGRATION_CHECKSUM_MISMATCH: 'MIGRATION-CHECKSUM-001',
  MIGRATION_UNKNOWN_BASELINE: 'MIGRATION-BASELINE-001',
  MIGRATION_UNKNOWN_VERSION: 'MIGRATION-VERSION-001',
  MIGRATION_FAILED: 'MIGRATION-FAILED-001',
  DATABASE_INTEGRITY_FAILED: 'DATABASE-INTEGRITY-001',
  DATABASE_FOREIGN_KEY_FAILED: 'DATABASE-FOREIGN-KEY-001',
  EVENT_HANDLER_FAILED: 'EVENT-HANDLER-001'
} as const);

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export type ErrorCategory =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'conflict'
  | 'not_found'
  | 'infrastructure'
  | 'security'
  | 'unexpected';

export interface AppError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly correlationId: CorrelationId;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface CreateAppErrorInput {
  readonly code: ErrorCode;
  readonly message: string;
  readonly category: ErrorCategory;
  readonly correlationId: CorrelationId;
  readonly retryable?: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export const createAppError = (input: CreateAppErrorInput): AppError => {
  const base = {
    code: input.code,
    message: input.message,
    category: input.category,
    retryable: input.retryable ?? false,
    correlationId: input.correlationId
  } satisfies Omit<AppError, 'details'>;

  return input.details === undefined
    ? base
    : { ...base, details: Object.freeze({ ...input.details }) };
};

export const isAppError = (value: unknown): value is AppError => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<AppError>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.category === 'string' &&
    typeof candidate.retryable === 'boolean' &&
    typeof candidate.correlationId === 'string'
  );
};
