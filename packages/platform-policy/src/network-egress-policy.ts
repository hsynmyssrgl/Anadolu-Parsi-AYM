import type { PlatformApplicationId } from './policy-kernel.js';

export const NETWORK_EGRESS_DIRECT_PRIMITIVE_EXCEPTIONS = Object.freeze([] as const);
export const NETWORK_EGRESS_AUTHORIZED_ADAPTERS = Object.freeze([
  'apps/desktop/src/main/secure-revocation-list-fetcher.ts',
  'apps/desktop/src/main/secure-oidc-network-adapter.ts'
] as const);
export const NETWORK_EGRESS_AUTHORIZED_PURPOSES = Object.freeze([
  'external-backup-revocation-list.fetch',
  'oidc.token.exchange',
  'oidc.jwks.fetch'
] as const);

export type NetworkEgressPurpose = typeof NETWORK_EGRESS_AUTHORIZED_PURPOSES[number];
export type NetworkEgressTlsMode = 'tls' | 'mtls';
export type NetworkEgressDenialReason =
  | 'ALLOW_EGRESS'
  | 'MALFORMED_REQUEST'
  | 'MALFORMED_AUTHORITY'
  | 'APPLICATION_NOT_ALLOWED'
  | 'PURPOSE_NOT_ALLOWED'
  | 'METHOD_NOT_ALLOWED'
  | 'ENDPOINT_DISABLED'
  | 'ENDPOINT_ID_MISMATCH'
  | 'ENDPOINT_NOT_ALLOWLISTED'
  | 'TLS_POLICY_MISMATCH'
  | 'MTLS_IDENTITY_MISMATCH'
  | 'CERTIFICATE_PIN_SET_INVALID';

export interface NetworkEgressPin {
  readonly sha256: string;
  readonly kind: 'primary' | 'secondary';
}

export interface NetworkEgressRequest {
  readonly schemaVersion: 1;
  readonly endpointId: string;
  readonly sourceUrl: string;
  readonly method: string;
  readonly purpose: string;
  readonly applicationId: PlatformApplicationId;
  readonly tlsMode: NetworkEgressTlsMode;
  readonly clientIdentityId: string | null;
}

export interface NetworkEgressAuthoritativeContext {
  readonly schemaVersion: 1;
  readonly endpointId: string;
  readonly sourceUrl: string;
  readonly endpointStatus: 'active' | 'disabled';
  readonly allowedMethod: 'GET' | 'POST';
  readonly allowedPurpose: NetworkEgressPurpose;
  readonly allowedApplicationId: PlatformApplicationId;
  readonly minimumTlsVersion: 'TLSv1.3';
  readonly tlsMode: NetworkEgressTlsMode;
  readonly clientIdentityId: string | null;
  readonly expectedPins: readonly NetworkEgressPin[];
  readonly observedAt: string;
}

export interface NetworkEgressDecision {
  readonly allowed: boolean;
  readonly reason: NetworkEgressDenialReason;
  readonly redirectAllowed: false;
  readonly directNetworkPrimitiveAllowed: false;
}

export interface NetworkEgressBoundarySnapshot {
  readonly schemaVersion: 1;
  readonly enforcement: 'fail-closed';
  readonly authorizedApplicationId: 'windows-desktop';
  readonly authorizedPurpose: 'external-backup-revocation-list.fetch';
  readonly authorizedPurposes: typeof NETWORK_EGRESS_AUTHORIZED_PURPOSES;
  readonly authorizedAdapters: typeof NETWORK_EGRESS_AUTHORIZED_ADAPTERS;
  readonly authorizedAdapterCount: 2;
  readonly directPrimitiveExceptionCount: 0;
  readonly allowlistRequired: true;
  readonly minimumTlsVersion: 'TLSv1.3';
  readonly mutualTlsSupported: true;
  readonly certificatePinRotationSupported: true;
  readonly privateAddressRejected: true;
  readonly redirectAllowed: false;
  readonly persistentPathExposed: false;
  readonly secretMaterialExposed: false;
  readonly cutoverAuthorityAttached: false;
}

const REQUEST_KEYS = Object.freeze([
  'schemaVersion', 'endpointId', 'sourceUrl', 'method', 'purpose',
  'applicationId', 'tlsMode', 'clientIdentityId'
] as const);
const CONTEXT_KEYS = Object.freeze([
  'schemaVersion', 'endpointId', 'sourceUrl', 'endpointStatus', 'allowedMethod',
  'allowedPurpose', 'allowedApplicationId', 'minimumTlsVersion', 'tlsMode',
  'clientIdentityId', 'expectedPins', 'observedAt'
] as const);

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
const APPLICATION_IDS = new Set<PlatformApplicationId>([
  'windows-desktop', 'windows-core-service', 'windows-cluster-agent', 'macos-companion',
  'ios-companion', 'ipados-companion', 'watchos-companion', 'visionos-companion',
  'ocr-worker', 'ai-worker', 'translation-worker', 'communication-service',
  'backup-worker', 'signed-plugin'
]);
const PURPOSE_METHOD = Object.freeze({
  'external-backup-revocation-list.fetch': 'GET',
  'oidc.token.exchange': 'POST',
  'oidc.jwks.fetch': 'GET'
} satisfies Readonly<Record<NetworkEgressPurpose, 'GET' | 'POST'>>);
const normalizedHttpsUrl = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length > 2_048 || value.trim() !== value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || !url.hostname) return null;
    if (url.port && url.port !== '443') return null;
    if (url.hostname.toLowerCase() === 'localhost' || url.hostname.toLowerCase().endsWith('.local')) return null;
    return url.toString();
  } catch {
    return null;
  }
};
const validPins = (value: unknown): value is readonly NetworkEgressPin[] => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2) return false;
  if (!value.every((item) => isPlainRecord(item)
    && exactKeys(item, ['sha256', 'kind'])
    && typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/u.test(item.sha256)
    && (item.kind === 'primary' || item.kind === 'secondary'))) return false;
  const pins = value as unknown as readonly NetworkEgressPin[];
  return pins[0]?.kind === 'primary'
    && (pins.length === 1 || pins[1]?.kind === 'secondary')
    && new Set(pins.map((item) => item.sha256)).size === pins.length;
};
const validTlsBinding = (tlsMode: unknown, clientIdentityId: unknown): boolean =>
  (tlsMode === 'tls' && clientIdentityId === null)
  || (tlsMode === 'mtls' && nonEmpty(clientIdentityId, 256));
const validRequest = (value: unknown): value is NetworkEgressRequest => {
  if (!isPlainRecord(value) || !exactKeys(value, REQUEST_KEYS)) return false;
  return value.schemaVersion === 1
    && nonEmpty(value.endpointId, 128)
    && normalizedHttpsUrl(value.sourceUrl) === value.sourceUrl
    && nonEmpty(value.method, 16) && /^[A-Z]+$/u.test(value.method)
    && nonEmpty(value.purpose, 128)
    && APPLICATION_IDS.has(value.applicationId as PlatformApplicationId)
    && validTlsBinding(value.tlsMode, value.clientIdentityId);
};
const validContext = (value: unknown): value is NetworkEgressAuthoritativeContext => {
  if (!isPlainRecord(value) || !exactKeys(value, CONTEXT_KEYS)) return false;
  return value.schemaVersion === 1
    && nonEmpty(value.endpointId, 128)
    && normalizedHttpsUrl(value.sourceUrl) === value.sourceUrl
    && (value.endpointStatus === 'active' || value.endpointStatus === 'disabled')
    && (value.allowedMethod === 'GET' || value.allowedMethod === 'POST')
    && NETWORK_EGRESS_AUTHORIZED_PURPOSES.includes(value.allowedPurpose as NetworkEgressPurpose)
    && PURPOSE_METHOD[value.allowedPurpose as NetworkEgressPurpose] === value.allowedMethod
    && value.allowedApplicationId === 'windows-desktop'
    && value.minimumTlsVersion === 'TLSv1.3'
    && validTlsBinding(value.tlsMode, value.clientIdentityId)
    && validPins(value.expectedPins)
    && strictIso(value.observedAt);
};
const decision = (allowed: boolean, reason: NetworkEgressDenialReason): NetworkEgressDecision => Object.freeze({
  allowed,
  reason,
  redirectAllowed: false,
  directNetworkPrimitiveAllowed: false
});

/** Authoritative allowlist context and the concrete outbound request must match exactly. */
export class NetworkEgressPolicy {
  public authorize(request: unknown, authority: unknown): NetworkEgressDecision {
    if (!validRequest(request)) return decision(false, 'MALFORMED_REQUEST');
    if (!validContext(authority)) return decision(false, 'MALFORMED_AUTHORITY');
    if (request.applicationId !== authority.allowedApplicationId) return decision(false, 'APPLICATION_NOT_ALLOWED');
    if (request.purpose !== authority.allowedPurpose) return decision(false, 'PURPOSE_NOT_ALLOWED');
    if (request.method !== authority.allowedMethod) return decision(false, 'METHOD_NOT_ALLOWED');
    if (authority.endpointStatus !== 'active') return decision(false, 'ENDPOINT_DISABLED');
    if (request.endpointId !== authority.endpointId) return decision(false, 'ENDPOINT_ID_MISMATCH');
    if (request.sourceUrl !== authority.sourceUrl) return decision(false, 'ENDPOINT_NOT_ALLOWLISTED');
    if (request.tlsMode !== authority.tlsMode || authority.minimumTlsVersion !== 'TLSv1.3') {
      return decision(false, 'TLS_POLICY_MISMATCH');
    }
    if (request.clientIdentityId !== authority.clientIdentityId) return decision(false, 'MTLS_IDENTITY_MISMATCH');
    if (!validPins(authority.expectedPins)) return decision(false, 'CERTIFICATE_PIN_SET_INVALID');
    return decision(true, 'ALLOW_EGRESS');
  }

  public snapshot(): NetworkEgressBoundarySnapshot {
    return Object.freeze({
      schemaVersion: 1,
      enforcement: 'fail-closed',
      authorizedApplicationId: 'windows-desktop',
      authorizedPurpose: 'external-backup-revocation-list.fetch',
      authorizedPurposes: NETWORK_EGRESS_AUTHORIZED_PURPOSES,
      authorizedAdapters: NETWORK_EGRESS_AUTHORIZED_ADAPTERS,
      authorizedAdapterCount: NETWORK_EGRESS_AUTHORIZED_ADAPTERS.length,
      directPrimitiveExceptionCount: NETWORK_EGRESS_DIRECT_PRIMITIVE_EXCEPTIONS.length,
      allowlistRequired: true,
      minimumTlsVersion: 'TLSv1.3',
      mutualTlsSupported: true,
      certificatePinRotationSupported: true,
      privateAddressRejected: true,
      redirectAllowed: false,
      persistentPathExposed: false,
      secretMaterialExposed: false,
      cutoverAuthorityAttached: false
    });
  }
}
