import { describe, expect, it } from 'vitest';
import { asCorrelationId, ERROR_CODES } from '@ppt/core';
import { mapSqliteError } from './src/sqlite-error.js';

describe('SQLite hata eşleme', () => {
  it('işlem sınırı çakışmasını yeniden denenebilir busy hatası olarak ayırır', () => {
    const error = mapSqliteError(
      new Error('SQLITE_TRANSACTION_ALREADY_ACTIVE'),
      asCorrelationId('corr-sqlite-transaction-active-0001')
    );

    expect(error).toMatchObject({
      code: ERROR_CODES.DATABASE_BUSY,
      category: 'infrastructure',
      retryable: true,
      details: { reason: 'transaction_already_active' }
    });
    expect(error.message).not.toContain('SQLITE_TRANSACTION_ALREADY_ACTIVE');
  });

  it('repository policy guard hatasını beklenmeyen SQLite hatası olarak maskelemez', () => {
    const policyError = Object.assign(new Error('Repository correlation mismatch'), {
      name: 'PlatformPolicyEnforcementError',
      code: 'TRANSACTION_CONTEXT_MISMATCH'
    });
    const error = mapSqliteError(
      policyError,
      asCorrelationId('correlation-policy-guard')
    );

    expect(error).toMatchObject({
      code: ERROR_CODES.AUTHORIZATION_DENIED,
      category: 'authorization',
      retryable: false,
      details: { enforcementCode: 'TRANSACTION_CONTEXT_MISMATCH' }
    });
    expect(error.message).not.toContain('SQLite işlemi beklenmeyen');
  });
});
