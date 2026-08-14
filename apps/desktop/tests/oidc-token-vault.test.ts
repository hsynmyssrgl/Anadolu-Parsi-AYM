import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DeviceSecretProtector } from '@ppt/security';
import { FileSystemOidcVaultPersistence, OidcTokenVault } from '../src/main/oidc-token-vault.js';

class TestProtector implements DeviceSecretProtector {
  public readonly protectionId = 'test-protector-v1';
  public readonly required = true;
  public isAvailable(): boolean { return true; }
  public protect(value: string): string { return Buffer.from(`sealed:${value}`, 'utf8').toString('base64'); }
  public unprotect(value: string): string {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    if (!decoded.startsWith('sealed:')) throw new Error('bad');
    return decoded.slice(7);
  }
}

const binding = { accountId: 'account-1', providerId: 'google' as const, linkId: 'link-1', flowId: 'flow-1' };
const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const tokens = {
  accessToken: 'access-token-secret',
  idToken: 'id-token-secret',
  refreshToken: 'refresh-token-secret',
  tokenType: 'Bearer' as const,
  scopes: ['profile', 'openid'],
  issuedAt: '2026-08-14T06:00:00.000Z',
  expiresAt: '2026-08-14T07:00:00.000Z'
};

describe('OIDC token vault', () => {
  it('stores only device-protected ciphertext and exact binding metadata', () => {
    const vault = new OidcTokenVault(new TestProtector());
    const protectedSet = vault.seal(binding, tokens);
    expect(JSON.stringify(protectedSet)).not.toContain('access-token-secret');
    expect(vault.open(binding, protectedSet, '2026-08-14T06:30:00.000Z')).toEqual({ ...tokens, scopes: ['openid', 'profile'] });
  });

  it('rejects foreign account/link binding, ciphertext tamper and expiry', () => {
    const vault = new OidcTokenVault(new TestProtector());
    const protectedSet = vault.seal(binding, tokens);
    expect(() => vault.open({ ...binding, accountId: 'account-2' }, protectedSet, '2026-08-14T06:30:00.000Z')).toThrow(/metadata/u);
    expect(() => vault.open({ ...binding, flowId: 'flow-2' }, protectedSet, '2026-08-14T06:30:00.000Z')).toThrow(/metadata/u);
    expect(() => vault.open(binding, { ...protectedSet, protectedPayload: `${protectedSet.protectedPayload.slice(0, -4)}AAAA` }, '2026-08-14T06:30:00.000Z'))
      .toThrow(/metadata/u);
    expect(() => vault.open(binding, protectedSet, '2026-08-14T07:00:00.000Z')).toThrow(/sure/u);
  });

  it('durably overwrites an atomic device-protected file across restarts and keeps revoked tokens unavailable', () => {
    const directory = mkdtempSync(join(tmpdir(), 'ppt-oidc-vault-'));
    const filePath = join(directory, 'oidc-vault.json');
    const protector = new TestProtector();
    const codeVerifier = 'A'.repeat(43);
    try {
      const first = new OidcTokenVault(protector, new FileSystemOidcVaultPersistence(filePath));
      first.storeAuthorizationFlow(binding, {
        configurationId: 'google-production-v1',
        configuration: {
          providerId: 'google', issuer: 'https://accounts.example.test',
          authorizationEndpoint: 'https://accounts.example.test/oauth2/authorize',
          tokenEndpoint: 'https://accounts.example.test/oauth2/token',
          jwksUri: 'https://accounts.example.test/.well-known/jwks.json', clientId: 'desktop-client-id',
          redirectUri: 'pardus-app://oidc', scopes: ['openid', 'profile']
        },
        stateSha256: sha256('state-1'), nonceSha256: sha256('nonce-1'),
        codeVerifier, codeVerifierSha256: sha256(codeVerifier),
        createdAt: '2026-08-14T06:00:00.000Z', expiresAt: '2026-08-14T06:05:00.000Z'
      }, '2026-08-14T06:00:00.000Z');
      expect(readFileSync(filePath, 'utf8')).not.toContain(codeVerifier);

      const restarted = new OidcTokenVault(protector, new FileSystemOidcVaultPersistence(filePath));
      expect(restarted.listPendingAuthorizationFlowBindings('2026-08-14T06:01:00.000Z')).toEqual([{
        flowId: 'flow-1',
        accountId: 'account-1',
        providerId: 'google',
        stateSha256: sha256('state-1'),
        redirectUri: 'pardus-app://oidc',
        expiresAt: '2026-08-14T06:05:00.000Z'
      }]);
      expect(JSON.stringify(restarted.listPendingAuthorizationFlowBindings('2026-08-14T06:01:00.000Z'))).not.toContain(codeVerifier);
      expect(restarted.takeAuthorizationFlow({
        flowId: 'flow-1', accountId: 'account-1', observedAt: '2026-08-14T06:01:00.000Z'
      })?.secret.codeVerifier).toBe(codeVerifier);
      const entryId = restarted.putToken(binding, tokens, '2026-08-14T06:01:00.000Z');
      expect(readFileSync(filePath, 'utf8')).not.toContain('refresh-token-secret');
      expect(new OidcTokenVault(protector, new FileSystemOidcVaultPersistence(filePath))
        .getToken(binding, entryId, '2026-08-14T06:30:00.000Z').accessToken).toBe('access-token-secret');
      expect(restarted.revokeToken(entryId, '2026-08-14T06:31:00.000Z')).toBe(true);
      expect(() => new OidcTokenVault(protector, new FileSystemOidcVaultPersistence(filePath))
        .getToken(binding, entryId, '2026-08-14T06:32:00.000Z')).toThrow(/iptal/u);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
