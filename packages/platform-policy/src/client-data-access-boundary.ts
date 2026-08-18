import type { PlatformApplicationId } from './policy-kernel.js';

export const CLIENT_DIRECT_DATA_ACCESS_EXCEPTIONS = Object.freeze([] as const);

export const CLIENT_DATA_ACCESS_METHODS = Object.freeze([
  'application-service',
  'direct-repository',
  'direct-sql',
  'direct-sqlite',
  'direct-vault-file'
] as const);

export type ClientDataAccessMethod = typeof CLIENT_DATA_ACCESS_METHODS[number];
export type ClientDataAccessTransport = 'typed-electron-ipc' | 'versioned-core-service-api';

export type ClientDataAccessDenialReason =
  | 'ALLOW_APPLICATION_SERVICE'
  | 'MALFORMED_CONTEXT'
  | 'CHANNEL_NOT_REGISTERED'
  | 'BOOTSTRAP_CHANNEL_FORBIDDEN'
  | 'DIRECT_REPOSITORY_FORBIDDEN'
  | 'DIRECT_SQL_FORBIDDEN'
  | 'DIRECT_SQLITE_FORBIDDEN'
  | 'DIRECT_VAULT_FILE_FORBIDDEN'
  | 'TRANSPORT_FORBIDDEN'
  | 'APPLICATION_MISMATCH'
  | 'DEVICE_MISMATCH'
  | 'SUBJECT_MISMATCH'
  | 'FAMILY_MISMATCH'
  | 'POLICY_VERSION_MISMATCH'
  | 'POLICY_PACKAGE_MISMATCH'
  | 'CAPABILITY_MANIFEST_MISMATCH'
  | 'DEVICE_CERTIFICATE_MISMATCH'
  | 'AUTHORIZATION_CONTEXT_MISMATCH'
  | 'AUTHORIZATION_CONTEXT_EXPIRED';

export interface ClientDataAccessRequest {
  readonly schemaVersion: 1;
  readonly channel: string;
  readonly method: ClientDataAccessMethod;
  readonly transport: ClientDataAccessTransport;
  readonly applicationId: PlatformApplicationId;
  readonly deviceId: string;
  readonly subjectAccountId: string;
  readonly familyId: string;
  readonly policyVersion: string;
  readonly policyPackageSha256: string;
  readonly capabilityManifestSha256: string;
  readonly deviceCertificateSha256: string;
  readonly authorizationContextSha256: string;
  readonly occurredAt: string;
}

export interface ClientDataAccessAuthoritativeContext {
  readonly applicationId: PlatformApplicationId;
  readonly deviceId: string;
  readonly subjectAccountId: string;
  readonly familyId: string;
  readonly policyVersion: string;
  readonly policyPackageSha256: string;
  readonly capabilityManifestSha256: string;
  readonly deviceCertificateSha256: string;
  readonly authorizationContextSha256: string;
  readonly expiresAt: string;
}

export interface ClientDataAccessBootstrapRequest {
  readonly schemaVersion: 1;
  readonly channel: string;
  readonly method: 'application-service';
  readonly transport: 'typed-electron-ipc';
  readonly applicationId: 'windows-desktop';
  readonly deviceId: string;
  readonly policyVersion: string;
  readonly policyPackageSha256: string;
  readonly capabilityManifestSha256: string;
  readonly occurredAt: string;
}

export interface ClientDataAccessDecision {
  readonly allowed: boolean;
  readonly reason: ClientDataAccessDenialReason;
  readonly directAccessAllowed: false;
}

export interface ClientDataAccessBoundarySnapshot {
  readonly schemaVersion: 1;
  readonly enforcement: 'fail-closed';
  readonly allowedTransports: readonly ['typed-electron-ipc', 'versioned-core-service-api'];
  readonly repositoryDirectAccess: false;
  readonly sqlDirectAccess: false;
  readonly sqliteDirectAccess: false;
  readonly vaultFileDirectAccess: false;
  readonly directAccessExceptionCount: 0;
  readonly registeredApplicationServiceChannels: number;
  readonly protectedContextBindings: readonly [
    'application', 'device', 'subject', 'family', 'policy-package',
    'capability-manifest', 'device-certificate', 'authorization-context'
  ];
}

const CHANNEL_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*(?:-[a-zA-Z0-9]+)*(?::[a-zA-Z][a-zA-Z0-9]*)+$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const allowedTransports = new Set<ClientDataAccessTransport>([
  'typed-electron-ipc',
  'versioned-core-service-api'
]);
const clientApplications = new Set<PlatformApplicationId>([
  'windows-desktop', 'windows-cluster-agent', 'macos-companion', 'ios-companion',
  'ipados-companion', 'watchos-companion', 'visionos-companion', 'ocr-worker',
  'ai-worker', 'translation-worker', 'communication-service', 'backup-worker', 'signed-plugin'
]);

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

const nonEmpty = (value: unknown, maximum = 512): value is string =>
  typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= maximum;

const strictIso = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
};

const decision = (allowed: boolean, reason: ClientDataAccessDenialReason): ClientDataAccessDecision =>
  Object.freeze({ allowed, reason, directAccessAllowed: false });

const directDenial = (method: ClientDataAccessMethod): ClientDataAccessDenialReason | undefined => ({
  'direct-repository': 'DIRECT_REPOSITORY_FORBIDDEN',
  'direct-sql': 'DIRECT_SQL_FORBIDDEN',
  'direct-sqlite': 'DIRECT_SQLITE_FORBIDDEN',
  'direct-vault-file': 'DIRECT_VAULT_FILE_FORBIDDEN'
} as const)[method as Exclude<ClientDataAccessMethod, 'application-service'>];

const validRequest = (value: unknown): value is ClientDataAccessRequest => {
  if (!isPlainRecord(value) || !exactKeys(value, [
    'schemaVersion', 'channel', 'method', 'transport', 'applicationId', 'deviceId',
    'subjectAccountId', 'familyId', 'policyVersion', 'policyPackageSha256',
    'capabilityManifestSha256', 'deviceCertificateSha256', 'authorizationContextSha256', 'occurredAt'
  ])) return false;
  return value.schemaVersion === 1
    && nonEmpty(value.channel, 128) && CHANNEL_PATTERN.test(value.channel)
    && CLIENT_DATA_ACCESS_METHODS.includes(value.method as ClientDataAccessMethod)
    && nonEmpty(value.transport, 64)
    && clientApplications.has(value.applicationId as PlatformApplicationId)
    && nonEmpty(value.deviceId, 256) && nonEmpty(value.subjectAccountId, 256)
    && nonEmpty(value.familyId, 256) && nonEmpty(value.policyVersion, 128)
    && SHA256_PATTERN.test(String(value.policyPackageSha256))
    && SHA256_PATTERN.test(String(value.capabilityManifestSha256))
    && SHA256_PATTERN.test(String(value.deviceCertificateSha256))
    && SHA256_PATTERN.test(String(value.authorizationContextSha256))
    && strictIso(value.occurredAt);
};

const validAuthoritativeContext = (value: unknown): value is ClientDataAccessAuthoritativeContext => {
  if (!isPlainRecord(value) || !exactKeys(value, [
    'applicationId', 'deviceId', 'subjectAccountId', 'familyId', 'policyVersion',
    'policyPackageSha256', 'capabilityManifestSha256', 'deviceCertificateSha256',
    'authorizationContextSha256', 'expiresAt'
  ])) return false;
  return clientApplications.has(value.applicationId as PlatformApplicationId)
    && nonEmpty(value.deviceId, 256) && nonEmpty(value.subjectAccountId, 256)
    && nonEmpty(value.familyId, 256) && nonEmpty(value.policyVersion, 128)
    && SHA256_PATTERN.test(String(value.policyPackageSha256))
    && SHA256_PATTERN.test(String(value.capabilityManifestSha256))
    && SHA256_PATTERN.test(String(value.deviceCertificateSha256))
    && SHA256_PATTERN.test(String(value.authorizationContextSha256))
    && strictIso(value.expiresAt);
};

const validBootstrap = (value: unknown): value is ClientDataAccessBootstrapRequest => {
  if (!isPlainRecord(value) || !exactKeys(value, [
    'schemaVersion', 'channel', 'method', 'transport', 'applicationId', 'deviceId',
    'policyVersion', 'policyPackageSha256', 'capabilityManifestSha256', 'occurredAt'
  ])) return false;
  return value.schemaVersion === 1 && value.method === 'application-service'
    && value.transport === 'typed-electron-ipc' && value.applicationId === 'windows-desktop'
    && nonEmpty(value.channel, 128) && CHANNEL_PATTERN.test(value.channel)
    && nonEmpty(value.deviceId, 256) && nonEmpty(value.policyVersion, 128)
    && SHA256_PATTERN.test(String(value.policyPackageSha256))
    && SHA256_PATTERN.test(String(value.capabilityManifestSha256))
    && strictIso(value.occurredAt);
};

/**
 * Stateless, fail-closed policy in front of every client-visible data route.
 * Provider processes may own repositories, SQLite and the legacy Desktop vault,
 * but clients can reach them only through a registered application-service route.
 */
export class ClientDataAccessBoundaryPolicy {
  readonly #registeredChannels = new Set<string>();
  readonly #bootstrapChannels = new Set<string>();

  public registerApplicationServiceChannel(channel: string, bootstrap = false): void {
    if (!nonEmpty(channel, 128) || !CHANNEL_PATTERN.test(channel) || this.#registeredChannels.has(channel)) {
      throw new Error('CLIENT_DATA_ACCESS_CHANNEL_INVALID_OR_DUPLICATE');
    }
    this.#registeredChannels.add(channel);
    if (bootstrap) this.#bootstrapChannels.add(channel);
  }

  public evaluate(
    request: unknown,
    authoritativeContext: unknown
  ): ClientDataAccessDecision {
    if (!validRequest(request) || !validAuthoritativeContext(authoritativeContext)) {
      return decision(false, 'MALFORMED_CONTEXT');
    }
    const denied = directDenial(request.method);
    if (denied) return decision(false, denied);
    if (!allowedTransports.has(request.transport)) return decision(false, 'TRANSPORT_FORBIDDEN');
    if (!this.#registeredChannels.has(request.channel) || this.#bootstrapChannels.has(request.channel)) {
      return decision(false, 'CHANNEL_NOT_REGISTERED');
    }
    if (request.applicationId !== authoritativeContext.applicationId) return decision(false, 'APPLICATION_MISMATCH');
    if (request.deviceId !== authoritativeContext.deviceId) return decision(false, 'DEVICE_MISMATCH');
    if (request.subjectAccountId !== authoritativeContext.subjectAccountId) return decision(false, 'SUBJECT_MISMATCH');
    if (request.familyId !== authoritativeContext.familyId) return decision(false, 'FAMILY_MISMATCH');
    if (request.policyVersion !== authoritativeContext.policyVersion) return decision(false, 'POLICY_VERSION_MISMATCH');
    if (request.policyPackageSha256 !== authoritativeContext.policyPackageSha256) return decision(false, 'POLICY_PACKAGE_MISMATCH');
    if (request.capabilityManifestSha256 !== authoritativeContext.capabilityManifestSha256) return decision(false, 'CAPABILITY_MANIFEST_MISMATCH');
    if (request.deviceCertificateSha256 !== authoritativeContext.deviceCertificateSha256) return decision(false, 'DEVICE_CERTIFICATE_MISMATCH');
    if (request.authorizationContextSha256 !== authoritativeContext.authorizationContextSha256) {
      return decision(false, 'AUTHORIZATION_CONTEXT_MISMATCH');
    }
    if (Date.parse(request.occurredAt) >= Date.parse(authoritativeContext.expiresAt)) {
      return decision(false, 'AUTHORIZATION_CONTEXT_EXPIRED');
    }
    return decision(true, 'ALLOW_APPLICATION_SERVICE');
  }

  public evaluateBootstrap(request: unknown): ClientDataAccessDecision {
    if (!validBootstrap(request)) return decision(false, 'MALFORMED_CONTEXT');
    if (!this.#registeredChannels.has(request.channel) || !this.#bootstrapChannels.has(request.channel)) {
      return decision(false, 'BOOTSTRAP_CHANNEL_FORBIDDEN');
    }
    return decision(true, 'ALLOW_APPLICATION_SERVICE');
  }

  public snapshot(): ClientDataAccessBoundarySnapshot {
    return Object.freeze({
      schemaVersion: 1,
      enforcement: 'fail-closed',
      allowedTransports: Object.freeze(['typed-electron-ipc', 'versioned-core-service-api'] as const),
      repositoryDirectAccess: false,
      sqlDirectAccess: false,
      sqliteDirectAccess: false,
      vaultFileDirectAccess: false,
      directAccessExceptionCount: CLIENT_DIRECT_DATA_ACCESS_EXCEPTIONS.length,
      registeredApplicationServiceChannels: this.#registeredChannels.size,
      protectedContextBindings: Object.freeze([
        'application', 'device', 'subject', 'family', 'policy-package',
        'capability-manifest', 'device-certificate', 'authorization-context'
      ] as const)
    });
  }
}
