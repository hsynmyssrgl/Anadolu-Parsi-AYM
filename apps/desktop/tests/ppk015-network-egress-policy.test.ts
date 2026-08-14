import { describe, expect, it, vi } from 'vitest';
import type { ExternalBackupRevocationEndpointView, FetchedExternalBackupEvidenceRevocationListView } from '@ppt/domain';
import {
  NETWORK_EGRESS_AUTHORIZED_ADAPTERS,
  NETWORK_EGRESS_AUTHORIZED_PURPOSES,
  NETWORK_EGRESS_DIRECT_PRIMITIVE_EXCEPTIONS,
  NetworkEgressPolicy,
  type NetworkEgressAuthoritativeContext,
  type NetworkEgressRequest
} from '@ppt/platform-policy';
import {
  GovernedRevocationListFetchUseCase,
  NetworkEgressDeniedError
} from '../src/main/governed-network-egress-use-case.js';

const NOW = '2026-08-11T12:00:00.000Z';
const SOURCE = 'https://revocations.example.com/v1/list.json';
const PRIMARY = 'a'.repeat(64);
const SECONDARY = 'b'.repeat(64);

const request = (overrides: Partial<NetworkEgressRequest> = {}): NetworkEgressRequest => ({
  schemaVersion: 1,
  endpointId: 'endpoint-1',
  sourceUrl: SOURCE,
  method: 'GET',
  purpose: 'external-backup-revocation-list.fetch',
  applicationId: 'windows-desktop',
  tlsMode: 'tls',
  clientIdentityId: null,
  ...overrides
});

const authority = (overrides: Partial<NetworkEgressAuthoritativeContext> = {}): NetworkEgressAuthoritativeContext => ({
  schemaVersion: 1,
  endpointId: 'endpoint-1',
  sourceUrl: SOURCE,
  endpointStatus: 'active',
  allowedMethod: 'GET',
  allowedPurpose: 'external-backup-revocation-list.fetch',
  allowedApplicationId: 'windows-desktop',
  minimumTlsVersion: 'TLSv1.3',
  tlsMode: 'tls',
  clientIdentityId: null,
  expectedPins: [{ sha256: PRIMARY, kind: 'primary' }],
  observedAt: NOW,
  ...overrides
});

const endpoint = (overrides: Partial<ExternalBackupRevocationEndpointView> = {}): ExternalBackupRevocationEndpointView => ({
  id: 'endpoint-1',
  issuerId: 'issuer-1',
  issuerLabel: 'Sağlayıcı',
  sourceUrl: SOURCE,
  primarySpkiSha256: PRIMARY,
  status: 'active',
  lastFetchStatus: 'never',
  createdBy: 'admin-1',
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides
});

const fetched: FetchedExternalBackupEvidenceRevocationListView = {
  endpointId: 'endpoint-1',
  list: {
    signerIssuerId: 'issuer-1',
    listId: 'list-1',
    sequenceNumber: 1,
    thisUpdate: NOW,
    nextUpdate: '2026-08-12T12:00:00.000Z',
    entries: [],
    signatureBase64: 'signature',
    sourceUrl: SOURCE
  },
  fetchedAt: NOW,
  sourceUrl: SOURCE,
  tlsSpkiSha256: PRIMARY,
  matchedPin: 'primary',
  responseBytes: 128
};

describe('32-K PPK-015 network egress policy', () => {
  it('publishes a zero-exception fail-closed boundary snapshot', () => {
    expect(NETWORK_EGRESS_DIRECT_PRIMITIVE_EXCEPTIONS).toEqual([]);
    expect(Object.isFrozen(NETWORK_EGRESS_DIRECT_PRIMITIVE_EXCEPTIONS)).toBe(true);
    expect(NETWORK_EGRESS_AUTHORIZED_ADAPTERS).toEqual([
      'apps/desktop/src/main/secure-revocation-list-fetcher.ts',
      'apps/desktop/src/main/secure-oidc-network-adapter.ts'
    ]);
    expect(NETWORK_EGRESS_AUTHORIZED_PURPOSES).toEqual([
      'external-backup-revocation-list.fetch', 'oidc.token.exchange', 'oidc.jwks.fetch'
    ]);
    expect(new NetworkEgressPolicy().snapshot()).toEqual({
      schemaVersion: 1,
      enforcement: 'fail-closed',
      authorizedApplicationId: 'windows-desktop',
      authorizedPurpose: 'external-backup-revocation-list.fetch',
      authorizedPurposes: ['external-backup-revocation-list.fetch', 'oidc.token.exchange', 'oidc.jwks.fetch'],
      authorizedAdapters: [
        'apps/desktop/src/main/secure-revocation-list-fetcher.ts',
        'apps/desktop/src/main/secure-oidc-network-adapter.ts'
      ],
      authorizedAdapterCount: 2,
      directPrimitiveExceptionCount: 0,
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
  });

  it('allows an exact TLS request bound to one primary pin', () => {
    expect(new NetworkEgressPolicy().authorize(request(), authority())).toMatchObject({ allowed: true, reason: 'ALLOW_EGRESS' });
  });

  it('allows only the exact OIDC token POST and JWKS GET purpose-method bindings', () => {
    const policy = new NetworkEgressPolicy();
    expect(policy.authorize(
      request({ sourceUrl: 'https://accounts.example.com/oauth/token', method: 'POST', purpose: 'oidc.token.exchange' }),
      authority({ sourceUrl: 'https://accounts.example.com/oauth/token', allowedMethod: 'POST', allowedPurpose: 'oidc.token.exchange' })
    )).toMatchObject({ allowed: true, reason: 'ALLOW_EGRESS' });
    expect(policy.authorize(
      request({ sourceUrl: 'https://accounts.example.com/.well-known/jwks.json', purpose: 'oidc.jwks.fetch' }),
      authority({ sourceUrl: 'https://accounts.example.com/.well-known/jwks.json', allowedPurpose: 'oidc.jwks.fetch' })
    )).toMatchObject({ allowed: true, reason: 'ALLOW_EGRESS' });
  });

  it('rejects a purpose whose authoritative HTTP method violates the fixed inventory', () => {
    expect(new NetworkEgressPolicy().authorize(
      request({ sourceUrl: 'https://accounts.example.com/oauth/token', method: 'POST', purpose: 'oidc.token.exchange' }),
      authority({ sourceUrl: 'https://accounts.example.com/oauth/token', allowedMethod: 'GET', allowedPurpose: 'oidc.token.exchange' })
    ).reason).toBe('MALFORMED_AUTHORITY');
  });

  it('allows an exact mTLS request with a bound client identity and rotation pin', () => {
    const pins = [{ sha256: PRIMARY, kind: 'primary' as const }, { sha256: SECONDARY, kind: 'secondary' as const }];
    expect(new NetworkEgressPolicy().authorize(
      request({ tlsMode: 'mtls', clientIdentityId: 'device-certificate-7' }),
      authority({ tlsMode: 'mtls', clientIdentityId: 'device-certificate-7', expectedPins: pins })
    )).toMatchObject({ allowed: true, reason: 'ALLOW_EGRESS' });
  });

  it('rejects undeclared request fields as malformed', () => {
    expect(new NetworkEgressPolicy().authorize({ ...request(), sql: 'SELECT 1' }, authority()).reason).toBe('MALFORMED_REQUEST');
  });

  it('rejects an unauthorized application identity', () => {
    expect(new NetworkEgressPolicy().authorize(request({ applicationId: 'macos-companion' }), authority()).reason).toBe('APPLICATION_NOT_ALLOWED');
  });

  it('rejects a purpose outside the egress allowlist', () => {
    expect(new NetworkEgressPolicy().authorize(request({ purpose: 'telemetry.upload' }), authority()).reason).toBe('PURPOSE_NOT_ALLOWED');
  });

  it('rejects a method outside the read-only allowlist', () => {
    expect(new NetworkEgressPolicy().authorize(request({ method: 'POST' }), authority()).reason).toBe('METHOD_NOT_ALLOWED');
  });

  it('rejects a disabled authoritative endpoint', () => {
    expect(new NetworkEgressPolicy().authorize(request(), authority({ endpointStatus: 'disabled' })).reason).toBe('ENDPOINT_DISABLED');
  });

  it('rejects an endpoint identity mismatch', () => {
    expect(new NetworkEgressPolicy().authorize(request({ endpointId: 'endpoint-2' }), authority()).reason).toBe('ENDPOINT_ID_MISMATCH');
  });

  it('rejects a URL not exactly equal to the authoritative allowlist record', () => {
    expect(new NetworkEgressPolicy().authorize(request({ sourceUrl: 'https://revocations.example.com/v1/other.json' }), authority()).reason).toBe('ENDPOINT_NOT_ALLOWLISTED');
  });

  it('rejects TLS and mTLS mode mismatch', () => {
    expect(new NetworkEgressPolicy().authorize(request(), authority({ tlsMode: 'mtls', clientIdentityId: 'identity-1' })).reason).toBe('TLS_POLICY_MISMATCH');
  });

  it('rejects a mismatched mTLS client identity', () => {
    expect(new NetworkEgressPolicy().authorize(
      request({ tlsMode: 'mtls', clientIdentityId: 'identity-2' }),
      authority({ tlsMode: 'mtls', clientIdentityId: 'identity-1' })
    ).reason).toBe('MTLS_IDENTITY_MISMATCH');
  });

  it('rejects malformed, duplicated, or incorrectly ordered pin rotation sets', () => {
    const policy = new NetworkEgressPolicy();
    expect(policy.authorize(request(), authority({ expectedPins: [] })).reason).toBe('MALFORMED_AUTHORITY');
    expect(policy.authorize(request(), authority({ expectedPins: [{ sha256: PRIMARY, kind: 'primary' }, { sha256: PRIMARY, kind: 'secondary' }] })).reason).toBe('MALFORMED_AUTHORITY');
    expect(policy.authorize(request(), authority({ expectedPins: [{ sha256: SECONDARY, kind: 'secondary' }] })).reason).toBe('MALFORMED_AUTHORITY');
  });

  it('rejects credentials, fragments, non-standard ports, and local names', () => {
    const policy = new NetworkEgressPolicy();
    for (const sourceUrl of ['https://u:p@example.com/x', 'https://example.com/x#fragment', 'https://example.com:8443/x', 'https://localhost/x']) {
      expect(policy.authorize(request({ sourceUrl }), authority()).reason).toBe('MALFORMED_REQUEST');
    }
  });

  it('does not invoke the network adapter after policy denial', () => {
    const adapter = vi.fn(async () => fetched);
    const useCase = new GovernedRevocationListFetchUseCase(new NetworkEgressPolicy(), adapter);
    expect(() => useCase.execute({ endpoint: endpoint({ status: 'disabled' }), expectedPins: [{ sha256: PRIMARY, kind: 'primary' }], observedAt: NOW })).toThrow(NetworkEgressDeniedError);
    expect(adapter).not.toHaveBeenCalled();
  });

  it('passes only the governed TLS profile to the single authorized adapter', async () => {
    const adapter = vi.fn(async () => fetched);
    const useCase = new GovernedRevocationListFetchUseCase(new NetworkEgressPolicy(), adapter);
    await expect(useCase.execute({ endpoint: endpoint(), expectedPins: [{ sha256: PRIMARY, kind: 'primary' }], observedAt: NOW })).resolves.toEqual(fetched);
    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({ endpointId: 'endpoint-1', sourceUrl: SOURCE, expectedPins: [{ sha256: PRIMARY, kind: 'primary' }] }));
  });

  it('binds and forwards an mTLS client identity without exposing it through IPC status', async () => {
    const adapter = vi.fn(async () => fetched);
    const identity = { identityId: 'identity-1', cert: 'certificate', key: 'private-key' };
    const useCase = new GovernedRevocationListFetchUseCase(new NetworkEgressPolicy(), adapter);
    await useCase.execute({ endpoint: endpoint(), expectedPins: [{ sha256: PRIMARY, kind: 'primary' }], observedAt: NOW, mutualTlsIdentity: identity });
    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({ mutualTlsIdentity: identity }));
    expect(new NetworkEgressPolicy().snapshot().secretMaterialExposed).toBe(false);
  });
});
