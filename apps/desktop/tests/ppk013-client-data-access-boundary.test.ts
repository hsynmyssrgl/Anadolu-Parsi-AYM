import { describe, expect, it } from 'vitest';
import { ERROR_CODES, asCorrelationId } from '@ppt/core';
import { EnforceClientDataAccessUseCase, GetClientDataAccessBoundaryUseCase } from '@ppt/application';
import {
  CLIENT_DIRECT_DATA_ACCESS_EXCEPTIONS,
  ClientDataAccessBoundaryPolicy,
  type ClientDataAccessAuthoritativeContext,
  type ClientDataAccessMethod,
  type ClientDataAccessRequest
} from '@ppt/platform-policy';

const NOW = '2026-08-11T15:00:00.000Z';
const EXPIRES = '2026-08-11T16:00:00.000Z';
const SHA = {
  policy: '1'.repeat(64),
  manifest: '2'.repeat(64),
  certificate: '3'.repeat(64),
  context: '4'.repeat(64)
};

const createPolicy = () => {
  const policy = new ClientDataAccessBoundaryPolicy();
  policy.registerApplicationServiceChannel('family:getSnapshot');
  policy.registerApplicationServiceChannel('data-repair:workspace');
  policy.registerApplicationServiceChannel('archive:operationIdentity:acquire');
  policy.registerApplicationServiceChannel('auth:login', true);
  return policy;
};

const authoritative = (): ClientDataAccessAuthoritativeContext => ({
  applicationId: 'windows-desktop',
  deviceId: 'device-ppk-013',
  subjectAccountId: 'account-ppk-013',
  familyId: 'family-ppk-013',
  policyVersion: 'PPK-013',
  policyPackageSha256: SHA.policy,
  capabilityManifestSha256: SHA.manifest,
  deviceCertificateSha256: SHA.certificate,
  authorizationContextSha256: SHA.context,
  expiresAt: EXPIRES
});

const request = (method: ClientDataAccessMethod = 'application-service'): ClientDataAccessRequest => ({
  schemaVersion: 1,
  channel: 'family:getSnapshot',
  method,
  transport: 'typed-electron-ipc',
  applicationId: 'windows-desktop',
  deviceId: 'device-ppk-013',
  subjectAccountId: 'account-ppk-013',
  familyId: 'family-ppk-013',
  policyVersion: 'PPK-013',
  policyPackageSha256: SHA.policy,
  capabilityManifestSha256: SHA.manifest,
  deviceCertificateSha256: SHA.certificate,
  authorizationContextSha256: SHA.context,
  occurredAt: NOW
});

describe('32-I PPK-013 istemci veri erişim güvenlik çiti', () => {
  it('doğrudan erişim istisna defterini boş ve değişmez tutar', () => {
    expect(CLIENT_DIRECT_DATA_ACCESS_EXCEPTIONS).toEqual([]);
    expect(Object.isFrozen(CLIENT_DIRECT_DATA_ACCESS_EXCEPTIONS)).toBe(true);
  });

  it('kayıtlı tipli IPC uygulama servisini doğru bağlamda açar', () => {
    expect(createPolicy().evaluate(request(), authoritative())).toEqual({
      allowed: true, reason: 'ALLOW_APPLICATION_SERVICE', directAccessAllowed: false
    });
  });

  it.each([
    ['direct-repository', 'DIRECT_REPOSITORY_FORBIDDEN'],
    ['direct-sql', 'DIRECT_SQL_FORBIDDEN'],
    ['direct-sqlite', 'DIRECT_SQLITE_FORBIDDEN'],
    ['direct-vault-file', 'DIRECT_VAULT_FILE_FORBIDDEN']
  ] as const)('%s erişimini fail-closed reddeder', (method, reason) => {
    expect(createPolicy().evaluate(request(method), authoritative())).toMatchObject({ allowed: false, reason });
  });

  it('uygulama kimliği uyuşmazlığını reddeder', () => {
    expect(createPolicy().evaluate({ ...request(), applicationId: 'macos-companion' }, authoritative()))
      .toMatchObject({ allowed: false, reason: 'APPLICATION_MISMATCH' });
  });

  it('cihaz kimliği uyuşmazlığını reddeder', () => {
    expect(createPolicy().evaluate({ ...request(), deviceId: 'other-device' }, authoritative()))
      .toMatchObject({ allowed: false, reason: 'DEVICE_MISMATCH' });
  });

  it('hesap bağlamı uyuşmazlığını reddeder', () => {
    expect(createPolicy().evaluate({ ...request(), subjectAccountId: 'other-account' }, authoritative()))
      .toMatchObject({ allowed: false, reason: 'SUBJECT_MISMATCH' });
  });

  it('aile bağlamı uyuşmazlığını reddeder', () => {
    expect(createPolicy().evaluate({ ...request(), familyId: 'other-family' }, authoritative()))
      .toMatchObject({ allowed: false, reason: 'FAMILY_MISMATCH' });
  });

  it('politika sürümü ve paket uyuşmazlığını reddeder', () => {
    expect(createPolicy().evaluate({ ...request(), policyVersion: 'PPK-012' }, authoritative()))
      .toMatchObject({ allowed: false, reason: 'POLICY_VERSION_MISMATCH' });
    expect(createPolicy().evaluate({ ...request(), policyPackageSha256: '5'.repeat(64) }, authoritative()))
      .toMatchObject({ allowed: false, reason: 'POLICY_PACKAGE_MISMATCH' });
  });

  it('capability manifest ve cihaz sertifikası uyuşmazlığını reddeder', () => {
    expect(createPolicy().evaluate({ ...request(), capabilityManifestSha256: '5'.repeat(64) }, authoritative()))
      .toMatchObject({ allowed: false, reason: 'CAPABILITY_MANIFEST_MISMATCH' });
    expect(createPolicy().evaluate({ ...request(), deviceCertificateSha256: '6'.repeat(64) }, authoritative()))
      .toMatchObject({ allowed: false, reason: 'DEVICE_CERTIFICATE_MISMATCH' });
  });

  it('imzalı yetkilendirme bağlamı uyuşmazlığını reddeder', () => {
    expect(createPolicy().evaluate({ ...request(), authorizationContextSha256: '7'.repeat(64) }, authoritative()))
      .toMatchObject({ allowed: false, reason: 'AUTHORIZATION_CONTEXT_MISMATCH' });
  });

  it('kesin bitiş anında yetkilendirme bağlamını kapatır', () => {
    expect(createPolicy().evaluate({ ...request(), occurredAt: EXPIRES }, authoritative()))
      .toMatchObject({ allowed: false, reason: 'AUTHORIZATION_CONTEXT_EXPIRED' });
  });

  it('bozuk veya fazladan alanlı bağlamı reddeder', () => {
    expect(createPolicy().evaluate({ ...request(), injectedPath: 'family.pptvault' }, authoritative()))
      .toMatchObject({ allowed: false, reason: 'MALFORMED_CONTEXT' });
  });

  it('kayıtsız kanalı ve bootstrap kanalının normal yoldan kullanımını reddeder', () => {
    const policy = createPolicy();
    expect(policy.evaluate({ ...request(), channel: 'family:unknown' }, authoritative()))
      .toMatchObject({ allowed: false, reason: 'CHANNEL_NOT_REGISTERED' });
    expect(policy.evaluate({ ...request(), channel: 'auth:login' }, authoritative()))
      .toMatchObject({ allowed: false, reason: 'CHANNEL_NOT_REGISTERED' });
  });

  it('izin verilmeyen istemci taşımasını reddeder', () => {
    expect(createPolicy().evaluate({ ...request(), transport: 'direct-process-bridge' }, authoritative()))
      .toMatchObject({ allowed: false, reason: 'TRANSPORT_FORBIDDEN' });
  });

  it('yalnız açık bootstrap kanalını tipli IPC ile açar', () => {
    const policy = createPolicy();
    const bootstrap = {
      schemaVersion: 1 as const,
      channel: 'auth:login',
      method: 'application-service' as const,
      transport: 'typed-electron-ipc' as const,
      applicationId: 'windows-desktop' as const,
      deviceId: 'device-ppk-013',
      policyVersion: 'PPK-013',
      policyPackageSha256: SHA.policy,
      capabilityManifestSha256: SHA.manifest,
      occurredAt: NOW
    };
    expect(policy.evaluateBootstrap(bootstrap)).toMatchObject({ allowed: true });
    expect(policy.evaluateBootstrap({ ...bootstrap, channel: 'family:getSnapshot' }))
      .toMatchObject({ allowed: false, reason: 'BOOTSTRAP_CHANNEL_FORBIDDEN' });
  });

  it('uygulama use-case çağrısını yalnız izin kararından sonra yürütür', async () => {
    const policy = createPolicy();
    const useCase = new EnforceClientDataAccessUseCase(policy);
    let executed = 0;
    await expect(useCase.execute({
      correlationId: asCorrelationId('corr-ppk-013-allow'),
      request: request(),
      authoritativeContext: authoritative(),
      operation: () => { executed += 1; return 'service-result'; }
    })).resolves.toBe('service-result');
    await expect(useCase.execute({
      correlationId: asCorrelationId('corr-ppk-013-deny'),
      request: request('direct-sql'),
      authoritativeContext: authoritative(),
      operation: () => { executed += 1; return 'must-not-run'; }
    })).rejects.toMatchObject({ code: ERROR_CODES.AUTHORIZATION_DENIED });
    expect(executed).toBe(1);
  });

  it('UI durum görünümünde bütün doğrudan yolları kapalı ve kasayı korunmuş gösterir', () => {
    const view = new GetClientDataAccessBoundaryUseCase(createPolicy()).execute();
    expect(view).toMatchObject({
      enforcement: 'fail-closed',
      directAccess: { repository: false, sql: false, sqlite: false, vaultFile: false },
      directAccessExceptionCount: 0,
      legacyDesktopVaultPreserved: true,
      sqliteOwnershipTransferred: false,
      persistentPathExposed: false,
      secretMaterialExposed: false
    });
  });
});
