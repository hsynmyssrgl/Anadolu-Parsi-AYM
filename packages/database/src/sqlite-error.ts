import {
  ERROR_CODES,
  createAppError,
  type AppError,
  type CorrelationId
} from '@ppt/core';

interface SqliteLikeError {
  readonly code?: unknown;
  readonly errcode?: unknown;
  readonly errstr?: unknown;
  readonly message?: unknown;
}

const errorText = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as SqliteLikeError).message ?? '');
  }
  return String(error);
};

export const mapSqliteError = (
  error: unknown,
  correlationId: CorrelationId
): AppError => {
  const candidate = typeof error === 'object' && error !== null
    ? error as SqliteLikeError
    : undefined;
  const message = errorText(error);
  const codeText = [candidate?.code, candidate?.errcode, candidate?.errstr, message]
    .filter((value) => value !== undefined)
    .map(String)
    .join(' ')
    .toLocaleUpperCase('en-US');

  if (codeText.includes('SQLITE_BUSY')) {
    return createAppError({
      code: ERROR_CODES.DATABASE_BUSY,
      message: 'SQLite veritabanı geçici olarak meşgul.',
      category: 'infrastructure',
      correlationId,
      retryable: true
    });
  }
  if (codeText.includes('SQLITE_LOCKED')) {
    return createAppError({
      code: ERROR_CODES.DATABASE_LOCKED,
      message: 'SQLite veritabanı geçici olarak kilitli.',
      category: 'infrastructure',
      correlationId,
      retryable: true
    });
  }
  if (codeText.includes('SQLITE_CORRUPT') || codeText.includes('MALFORMED')) {
    return createAppError({
      code: ERROR_CODES.DATABASE_CORRUPT,
      message: 'SQLite veritabanı bozuk veya okunamaz durumda.',
      category: 'infrastructure',
      correlationId
    });
  }
  if (codeText.includes('SQLITE_FULL') || codeText.includes('DISK IS FULL')) {
    return createAppError({
      code: ERROR_CODES.DATABASE_DISK_FULL,
      message: 'SQLite işlemi için yeterli disk alanı yok.',
      category: 'infrastructure',
      correlationId
    });
  }
  if (codeText.includes('SQLITE_READONLY') || codeText.includes('READONLY')) {
    return createAppError({
      code: ERROR_CODES.DATABASE_READ_ONLY,
      message: 'SQLite veritabanı salt okunur durumda.',
      category: 'infrastructure',
      correlationId
    });
  }
  if (codeText.includes('UNIQUE CONSTRAINT') || codeText.includes('SQLITE_CONSTRAINT_UNIQUE')) {
    return createAppError({
      code: ERROR_CODES.RESOURCE_CONFLICT,
      message: 'Aynı benzersiz değere sahip bir kayıt zaten bulunuyor.',
      category: 'conflict',
      correlationId
    });
  }
  if (codeText.includes('FOREIGN KEY CONSTRAINT') || codeText.includes('SQLITE_CONSTRAINT_FOREIGNKEY')) {
    return createAppError({
      code: ERROR_CODES.RESOURCE_CONFLICT,
      message: 'İlişkili kayıt kısıtı nedeniyle SQLite işlemi tamamlanamadı.',
      category: 'conflict',
      correlationId
    });
  }
  return createAppError({
    code: ERROR_CODES.CORE_UNEXPECTED,
    message: 'SQLite işlemi beklenmeyen bir hatayla tamamlanamadı.',
    category: 'infrastructure',
    correlationId,
    details: {
      errorName: error instanceof Error ? error.name : typeof error
    }
  });
};
