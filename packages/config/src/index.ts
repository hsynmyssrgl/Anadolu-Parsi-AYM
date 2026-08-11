import {
  ERROR_CODES,
  asCorrelationId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';

export type ReleaseChannel = 'bronze' | 'silver' | 'gold';
export type RuntimeEnvironment = 'development' | 'test' | 'production';

export interface AppPathsConfig {
  readonly data: string;
  readonly archive: string;
  readonly cache: string;
  readonly logs: string;
  readonly temp: string;
  readonly secrets: string;
}

export interface AppConfig {
  readonly app: {
    readonly channel: ReleaseChannel;
    readonly version: string;
    readonly environment: RuntimeEnvironment;
  };
  readonly paths: AppPathsConfig;
  readonly database: {
    readonly fileName: string;
    readonly busyTimeoutMs: number;
    readonly journalMode: 'WAL';
    readonly synchronous: 'NORMAL' | 'FULL';
  };
  readonly logging: {
    readonly level: 'debug' | 'info' | 'warn' | 'error';
    readonly retentionDays: number;
    readonly maxFileBytes: number;
  };
  readonly jobs: {
    readonly enabled: boolean;
    readonly schedulerIntervalMs: number;
    readonly performanceIntervalMs: number;
    readonly maximumConcurrentJobs: number;
  };
  readonly backup: {
    readonly minimumVerifiedCopies: number;
    readonly defaultRetentionCount: number;
  };
  readonly security: {
    readonly sessionIdleTimeoutMinutes: number;
    readonly maximumFailedLoginAttempts: number;
  };
  readonly features: Readonly<Record<string, boolean>>;
}

export interface CreateDefaultConfigInput {
  readonly version: string;
  readonly environment: RuntimeEnvironment;
  readonly paths: AppPathsConfig;
}

export interface AppConfigOverrides {
  readonly database?: Partial<AppConfig['database']>;
  readonly logging?: Partial<AppConfig['logging']>;
  readonly jobs?: Partial<AppConfig['jobs']>;
  readonly backup?: Partial<AppConfig['backup']>;
  readonly security?: Partial<AppConfig['security']>;
  readonly features?: Readonly<Record<string, boolean>>;
}

export const resolveRuntimeEnvironment = (
  explicitValue: string | undefined,
  isPackaged: boolean
): RuntimeEnvironment => {
  if (explicitValue === 'development' || explicitValue === 'test' || explicitValue === 'production') {
    return explicitValue;
  }
  return isPackaged ? 'production' : 'development';
};

export const createDefaultConfig = (input: CreateDefaultConfigInput): AppConfig => ({
  app: {
    channel: 'bronze',
    version: input.version,
    environment: input.environment
  },
  paths: { ...input.paths },
  database: {
    fileName: 'panthera-family.db',
    busyTimeoutMs: 5_000,
    journalMode: 'WAL',
    synchronous: 'NORMAL'
  },
  logging: {
    level: input.environment === 'production' ? 'info' : 'debug',
    retentionDays: 30,
    maxFileBytes: 10 * 1024 * 1024
  },
  jobs: {
    enabled: true,
    schedulerIntervalMs: 60_000,
    performanceIntervalMs: 300_000,
    maximumConcurrentJobs: 2
  },
  backup: {
    minimumVerifiedCopies: 1,
    defaultRetentionCount: 7
  },
  security: {
    sessionIdleTimeoutMinutes: 15,
    maximumFailedLoginAttempts: 5
  },
  features: Object.freeze({})
});

export const applyConfigOverrides = (
  config: AppConfig,
  overrides: AppConfigOverrides | undefined
): AppConfig => {
  if (overrides === undefined) return config;
  return {
    ...config,
    database: { ...config.database, ...overrides.database },
    logging: { ...config.logging, ...overrides.logging },
    jobs: { ...config.jobs, ...overrides.jobs },
    backup: { ...config.backup, ...overrides.backup },
    security: { ...config.security, ...overrides.security },
    features: Object.freeze({ ...config.features, ...overrides.features })
  };
};

export const validateConfig = (config: AppConfig): Result<AppConfig, AppError> => {
  const correlationId = asCorrelationId('configuration-bootstrap');
  const pathEntries = Object.entries(config.paths);
  const blankPath = pathEntries.find(([, value]) => value.trim().length === 0);
  if (blankPath) {
    return err(createAppError({
      code: ERROR_CODES.CONFIG_INVALID,
      message: `Configuration yolu boş olamaz: ${blankPath[0]}`,
      category: 'validation',
      correlationId,
      details: { field: `paths.${blankPath[0]}` }
    }));
  }

  const normalizedPaths = pathEntries.map(([, value]) => value.trim().toLocaleLowerCase('en-US'));
  if (new Set(normalizedPaths).size !== normalizedPaths.length) {
    return err(createAppError({
      code: ERROR_CODES.CONFIG_INVALID,
      message: 'Veri, arşiv, cache, log ve temp yolları birbirinden ayrılmalıdır.',
      category: 'validation',
      correlationId
    }));
  }

  if (!/^[A-Za-z0-9._-]+$/.test(config.database.fileName)) {
    return err(createAppError({
      code: ERROR_CODES.CONFIG_INVALID,
      message: 'SQLite dosya adı yalnızca güvenli dosya adı karakterleri içermelidir.',
      category: 'validation',
      correlationId,
      details: { field: 'database.fileName' }
    }));
  }

  if (config.database.busyTimeoutMs < 1_000 || config.database.busyTimeoutMs > 60_000) {
    return err(createAppError({
      code: ERROR_CODES.CONFIG_INVALID,
      message: 'SQLite busy timeout 1.000–60.000 ms aralığında olmalıdır.',
      category: 'validation',
      correlationId,
      details: { field: 'database.busyTimeoutMs' }
    }));
  }

  if (config.logging.retentionDays < 1 || config.logging.retentionDays > 365) {
    return err(createAppError({
      code: ERROR_CODES.CONFIG_INVALID,
      message: 'Log saklama süresi 1–365 gün aralığında olmalıdır.',
      category: 'validation',
      correlationId,
      details: { field: 'logging.retentionDays' }
    }));
  }

  if (config.logging.maxFileBytes < 64 * 1024) {
    return err(createAppError({
      code: ERROR_CODES.CONFIG_INVALID,
      message: 'Log dosyası üst sınırı en az 64 KiB olmalıdır.',
      category: 'validation',
      correlationId,
      details: { field: 'logging.maxFileBytes' }
    }));
  }

  if (config.jobs.schedulerIntervalMs < 10_000 || config.jobs.performanceIntervalMs < 10_000) {
    return err(createAppError({
      code: ERROR_CODES.CONFIG_INVALID,
      message: 'Arka plan iş aralıkları en az 10 saniye olmalıdır.',
      category: 'validation',
      correlationId,
      details: { field: 'jobs' }
    }));
  }

  if (config.jobs.maximumConcurrentJobs < 1 || config.jobs.maximumConcurrentJobs > 16) {
    return err(createAppError({
      code: ERROR_CODES.CONFIG_INVALID,
      message: 'Eşzamanlı arka plan iş sayısı 1–16 aralığında olmalıdır.',
      category: 'validation',
      correlationId,
      details: { field: 'jobs.maximumConcurrentJobs' }
    }));
  }

  if (config.backup.minimumVerifiedCopies < 1) {
    return err(createAppError({
      code: ERROR_CODES.CONFIG_INVALID,
      message: 'En az bir doğrulanmış backup kopyası zorunludur.',
      category: 'validation',
      correlationId,
      details: { field: 'backup.minimumVerifiedCopies' }
    }));
  }

  return ok(config);
};

export const redactConfig = (config: AppConfig): Readonly<Record<string, unknown>> => ({
  app: config.app,
  database: config.database,
  logging: config.logging,
  jobs: config.jobs,
  backup: config.backup,
  security: {
    sessionIdleTimeoutMinutes: config.security.sessionIdleTimeoutMinutes,
    maximumFailedLoginAttempts: config.security.maximumFailedLoginAttempts
  },
  features: config.features,
  paths: Object.fromEntries(Object.keys(config.paths).map((key) => [key, '<configured>']))
});
