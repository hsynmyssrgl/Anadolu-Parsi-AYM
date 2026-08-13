import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CORE_SERVICE_API_MAXIMUM_FUTURE_SKEW_MS,
  CORE_SERVICE_API_MAXIMUM_REPLAY_ENTRIES,
  CORE_SERVICE_API_MAXIMUM_REQUEST_AGE_MS
} from '@ppt/core-service-contracts';
import { CoreServiceLocalAdminClient, CoreServiceLocalAdminClientError } from '@ppt/core-service-client';
import {
  PlatformPolicyKernel,
  VERSIONED_CORE_SERVICE_API_DIRECT_IMPORT_EXCEPTIONS,
  VersionedCoreServiceApiBoundaryPolicy,
  type VersionedCoreServiceApiAuthoritativeContext,
  type VersionedCoreServiceApiRequestEnvelope
} from '@ppt/platform-policy';
import { CoreServiceLocalAdminServer } from '../src/local-admin-server.js';
import { CoreServiceRuntime } from '../src/core-service-runtime.js';
import { createCoreServiceProcessHost } from '../src/main.js';
import {
  EnforceVersionedCoreServiceApiUseCase,
  VersionedCoreServiceApiDeniedError
} from '../src/versioned-core-service-api-use-case.js';

const NOW = '2026-08-11T12:00:00.000Z';
const TOKEN = 't'.repeat(48);
const context = (overrides: Partial<VersionedCoreServiceApiAuthoritativeContext> = {}): VersionedCoreServiceApiAuthoritativeContext => ({
  protocolVersion: 1,
  apiVersion: 'v1',
  clientApplicationId: 'windows-desktop',
  clientApplicationApiVersion: 'v1',
  supportedMethods: ['health.get'],
  observedAt: NOW,
  maximumRequestAgeMs: 30_000,
  maximumFutureSkewMs: 5_000,
  maximumReplayEntries: 16,
  ...overrides
});
const request = (overrides: Partial<VersionedCoreServiceApiRequestEnvelope> = {}): VersionedCoreServiceApiRequestEnvelope => ({
  protocolVersion: 1,
  apiVersion: 'v1',
  clientApplicationId: 'windows-desktop',
  requestId: 'request-ppk014-1',
  issuedAt: NOW,
  method: 'health.get',
  authenticationToken: TOKEN,
  payload: {},
  ...overrides
});

describe('32-J PPK-014 versioned Core Service API boundary policy', () => {
  it('binds the 33-J desktop file-share surface to signed policy package version 2', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ppt-33j-core-manifest-'));
    const endpoint = process.platform === 'win32'
      ? `\\\\.\\pipe\\ppt-33j-core-manifest-${process.pid}-${Date.now()}`
      : join(directory, 'core-service.sock');
    const host = createCoreServiceProcessHost({
      PPT_CORE_SERVICE_LOCAL_ADMIN_ENDPOINT: endpoint,
      PPT_CORE_SERVICE_LOCAL_ADMIN_TOKEN: randomBytes(48).toString('base64url'),
      PPT_POLICY_SIGNING_KEY_HEX: randomBytes(32).toString('hex'),
      PPT_POLICY_JOURNAL_AUTHORITY_PATH: join(directory, 'policy-journal-authority.json'),
      PPT_POLICY_VERSION: 'PPT-PLATFORM-POLICY-2026-08-04-V1'
    });
    try {
      const policyPackage = host.runtime.health().policyPackage;
      const desktopManifest = policyPackage.payload.applicationManifests['windows-desktop'];
      expect(policyPackage.payload.packageVersion).toBe(2);
      expect(desktopManifest?.capabilities).toContain('file.share');
      expect(policyPackage.payload.applicationCapabilities['windows-desktop']).toEqual(
        desktopManifest?.capabilities
      );
      expect(host.runtime.health().policyPackageVerified).toBe(true);
    } finally {
      await host.stop();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('publishes an immutable zero-exception fail-closed boundary snapshot', () => {
    const policy = new VersionedCoreServiceApiBoundaryPolicy();
    expect(VERSIONED_CORE_SERVICE_API_DIRECT_IMPORT_EXCEPTIONS).toEqual([]);
    expect(Object.isFrozen(VERSIONED_CORE_SERVICE_API_DIRECT_IMPORT_EXCEPTIONS)).toBe(true);
    expect(policy.snapshot({ maximumRequestAgeMs: 30_000, maximumFutureSkewMs: 5_000, maximumReplayEntries: 16 })).toEqual({
      schemaVersion: 1,
      enforcement: 'fail-closed',
      exactEnvelopeRequired: true,
      applicationVersionBindingRequired: true,
      freshnessRequired: true,
      replayProtection: 'in-memory-per-process-fail-closed',
      directCoreServiceImportAllowed: false,
      directImportExceptionCount: 0,
      maximumRequestAgeMs: 30_000,
      maximumFutureSkewMs: 5_000,
      maximumReplayEntries: 16
    });
  });

  it('allows only an exact request matching the authoritative client application version', () => {
    expect(new VersionedCoreServiceApiBoundaryPolicy().authorize(request(), context())).toEqual({
      allowed: true,
      reason: 'ALLOW_VERSIONED_API',
      directCoreServiceImportAllowed: false
    });
  });

  it('rejects an envelope with an undeclared field', () => {
    expect(new VersionedCoreServiceApiBoundaryPolicy().authorize({ ...request(), sql: 'SELECT 1' }, context()).reason).toBe('MALFORMED_ENVELOPE');
  });

  it('rejects a protocol version mismatch', () => {
    expect(new VersionedCoreServiceApiBoundaryPolicy().authorize(request({ protocolVersion: 2 }), context()).reason).toBe('PROTOCOL_VERSION_MISMATCH');
  });

  it('rejects an unauthorized client application identity', () => {
    expect(new VersionedCoreServiceApiBoundaryPolicy().authorize(request({ clientApplicationId: 'macos-companion' }), context()).reason).toBe('CLIENT_APPLICATION_NOT_ALLOWED');
  });

  it('rejects a request API version mismatch', () => {
    expect(new VersionedCoreServiceApiBoundaryPolicy().authorize(request({ apiVersion: 'v2' }), context()).reason).toBe('API_VERSION_MISMATCH');
  });

  it('rejects a signed application manifest version mismatch', () => {
    expect(new VersionedCoreServiceApiBoundaryPolicy().authorize(request(), context({ clientApplicationApiVersion: 'v2' })).reason).toBe('API_VERSION_MISMATCH');
  });

  it('rejects a method outside the versioned allowlist', () => {
    expect(new VersionedCoreServiceApiBoundaryPolicy().authorize(request({ method: 'database.query' }), context()).reason).toBe('METHOD_NOT_ALLOWED');
  });

  it('rejects a request at the exact maximum age boundary', () => {
    const issuedAt = new Date(Date.parse(NOW) - 30_000).toISOString();
    expect(new VersionedCoreServiceApiBoundaryPolicy().authorize(request({ issuedAt }), context()).reason).toBe('REQUEST_EXPIRED');
  });

  it('rejects a request beyond the allowed future clock skew', () => {
    const issuedAt = new Date(Date.parse(NOW) + 5_001).toISOString();
    expect(new VersionedCoreServiceApiBoundaryPolicy().authorize(request({ issuedAt }), context()).reason).toBe('REQUEST_FROM_FUTURE');
  });

  it('rejects replay of an already accepted request ID', () => {
    const policy = new VersionedCoreServiceApiBoundaryPolicy();
    expect(policy.authorize(request(), context()).allowed).toBe(true);
    expect(policy.authorize(request(), context()).reason).toBe('REPLAY_DETECTED');
  });

  it('fails closed when the bounded replay state reaches capacity', () => {
    const policy = new VersionedCoreServiceApiBoundaryPolicy();
    for (let index = 0; index < 16; index += 1) {
      expect(policy.authorize(request({ requestId: `capacity-${index}` }), context()).allowed).toBe(true);
    }
    expect(policy.authorize(request({ requestId: 'capacity-overflow' }), context()).reason).toBe('REPLAY_STATE_CAPACITY_EXCEEDED');
  });

  it('does not execute the application operation after a policy denial', () => {
    let calls = 0;
    const useCase = new EnforceVersionedCoreServiceApiUseCase(new VersionedCoreServiceApiBoundaryPolicy(), () => context());
    expect(() => useCase.execute(request({ apiVersion: 'v2' }), () => { calls += 1; })).toThrowError(VersionedCoreServiceApiDeniedError);
    expect(calls).toBe(0);
  });
});

describe('32-J PPK-014 authenticated versioned API runtime', () => {
  let directory = '';
  let endpoint = '';
  let server: CoreServiceLocalAdminServer;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ppt-ppk014-'));
    endpoint = process.platform === 'win32'
      ? `\\\\.\\pipe\\ppt-ppk014-${process.pid}-${Date.now()}`
      : join(directory, 'core-service.sock');
    const kernel = new PlatformPolicyKernel({
      policyVersion: 'PPT-PLATFORM-POLICY-2026-08-04-V1',
      signingKey: randomBytes(32),
      applicationVersions: { 'windows-desktop': 'v1', 'windows-core-service': 'v1' },
      applicationCapabilities: { 'windows-desktop': ['family.read'], 'windows-core-service': [] },
      consentRequiredCapabilities: [],
      onlineOnlyCapabilities: [],
      writeActions: ['create', 'update', 'delete']
    });
    const runtime = new CoreServiceRuntime({
      policyKernel: kernel,
      policyVersion: 'PPT-PLATFORM-POLICY-2026-08-04-V1',
      clock: () => NOW
    });
    runtime.markReady('standalone');
    server = new CoreServiceLocalAdminServer({
      endpoint,
      authenticationToken: TOKEN,
      runtime,
      clock: () => NOW
    });
    await server.start();
  });

  afterAll(async () => {
    await server?.stop();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('serves the exact fail-closed boundary status without path, secret, or cutover authority', async () => {
    const status = await new CoreServiceLocalAdminClient({ endpoint, authenticationToken: TOKEN, clock: () => NOW }).apiBoundaryStatus();
    expect(status).toEqual({
      schemaVersion: 1,
      enforcement: 'fail-closed',
      apiVersion: 'v1',
      protocolVersion: 1,
      serverApplicationId: 'windows-core-service',
      allowedClientApplicationIds: ['windows-desktop'],
      transport: 'authenticated-local-named-pipe-or-socket',
      exactEnvelopeRequired: true,
      applicationVersionBindingRequired: true,
      freshnessRequired: true,
      replayProtection: 'in-memory-per-process-fail-closed',
      directCoreServiceImportAllowed: false,
      directImportExceptionCount: 0,
      maximumRequestAgeMs: CORE_SERVICE_API_MAXIMUM_REQUEST_AGE_MS,
      maximumFutureSkewMs: CORE_SERVICE_API_MAXIMUM_FUTURE_SKEW_MS,
      maximumReplayEntries: CORE_SERVICE_API_MAXIMUM_REPLAY_ENTRIES,
      persistentPathExposed: false,
      secretMaterialExposed: false,
      cutoverAuthorityAttached: false
    });
  });

  it('rejects a client-selected unsupported API version', async () => {
    const client = new CoreServiceLocalAdminClient({ endpoint, authenticationToken: TOKEN, apiVersion: 'v2', clock: () => NOW });
    await expect(client.health()).rejects.toMatchObject({ code: 'API_VERSION_MISMATCH' });
  });

  it('rejects a client application identity outside the authorized API contract', async () => {
    const client = new CoreServiceLocalAdminClient({ endpoint, authenticationToken: TOKEN, clientApplicationId: 'macos-companion', clock: () => NOW });
    await expect(client.health()).rejects.toMatchObject({ code: 'CLIENT_APPLICATION_NOT_ALLOWED' });
  });

  it('rejects replay through the real client and local authenticated server boundary', async () => {
    const client = new CoreServiceLocalAdminClient({
      endpoint,
      authenticationToken: TOKEN,
      clock: () => NOW,
      requestIdFactory: () => 'runtime-replay-ppk014'
    });
    await expect(client.health()).resolves.toMatchObject({ lifecycle: 'ready' });
    try {
      await client.health();
      throw new Error('Replay request was unexpectedly accepted');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreServiceLocalAdminClientError);
      expect(error).toMatchObject({ code: 'REPLAY_DETECTED' });
    }
  });
});
