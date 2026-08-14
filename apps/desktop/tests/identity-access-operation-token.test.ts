import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FixedClock, asIsoDateTime, asUserId } from '@ppt/core';
import { FileDeviceIdentityProvider } from '../src/main/device-identity.js';
import {
  IDENTITY_ACCESS_OPERATION_TOKEN_TTL_SECONDS,
  issueIdentityAccessOperationToken,
  verifyIdentityAccessOperationToken
} from '../src/main/identity-access-operation-token.js';

const NOW = asIsoDateTime('2026-08-14T08:30:00.000Z');

const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-identity-operation-token-'));
  const provider = new FileDeviceIdentityProvider(join(directory, 'device-identity.json'), new FixedClock(NOW));
  const identity = provider.snapshot();
  const binding = Object.freeze({
    accountId: asUserId('account-33-p'),
    deviceId: identity.deviceId,
    securityEpoch: 7,
    operationKind: 'temporary_credential_issue' as const
  });
  return { directory, provider, identity, binding };
};

describe('identity access main-issued operation token', () => {
  it('issues a compact token and verifies the exact account/device/epoch/kind binding', () => {
    const value = fixture();
    try {
      const token = issueIdentityAccessOperationToken({ binding: value.binding, now: NOW, deviceIdentityProvider: value.provider });
      expect(token.clientOperationId).toMatch(/^iat1\./u);
      expect(token.clientOperationId.length).toBeLessThanOrEqual(160);
      expect(token.clientOperationId.length).toBeGreaterThan(128 - 2);
      expect(Date.parse(token.expiresAt) - Date.parse(token.issuedAt)).toBe(IDENTITY_ACCESS_OPERATION_TOKEN_TTL_SECONDS * 1_000);
      expect(verifyIdentityAccessOperationToken({
        clientOperationId: token.clientOperationId,
        binding: value.binding,
        now: NOW,
        devicePublicKeyPem: value.identity.publicKeyPem
      })).toEqual({ issuedAt: token.issuedAt, expiresAt: token.expiresAt });
    } finally { rmSync(value.directory, { recursive: true, force: true }); }
  });

  it.each([
    ['account', (binding: typeof fixture extends never ? never : ReturnType<typeof fixture>['binding']) => ({ ...binding, accountId: asUserId('other-account') })],
    ['device', (binding: ReturnType<typeof fixture>['binding']) => ({ ...binding, deviceId: 'other-device' })],
    ['epoch', (binding: ReturnType<typeof fixture>['binding']) => ({ ...binding, securityEpoch: binding.securityEpoch + 1 })],
    ['operation kind', (binding: ReturnType<typeof fixture>['binding']) => ({ ...binding, operationKind: 'passkey_register' as const })]
  ])('rejects a wrong %s binding', (_label, mutate) => {
    const value = fixture();
    try {
      const token = issueIdentityAccessOperationToken({ binding: value.binding, now: NOW, deviceIdentityProvider: value.provider });
      expect(() => verifyIdentityAccessOperationToken({
        clientOperationId: token.clientOperationId,
        binding: mutate(value.binding),
        now: NOW,
        devicePublicKeyPem: value.identity.publicKeyPem
      })).toThrow(/IDEMPOTENCY_SCOPE_MISMATCH/u);
    } finally { rmSync(value.directory, { recursive: true, force: true }); }
  });

  it('rejects tamper, forged TTL, future issuance and expiry with explicit errors', () => {
    const value = fixture();
    try {
      const token = issueIdentityAccessOperationToken({ binding: value.binding, now: NOW, deviceIdentityProvider: value.provider });
      const pieces = token.clientOperationId.split('.');
      const tamperedSignature = `${pieces[4]![0] === 'A' ? 'B' : 'A'}${pieces[4]!.slice(1)}`;
      const tampered = [...pieces.slice(0, 4), tamperedSignature].join('.');
      expect(() => verifyIdentityAccessOperationToken({ clientOperationId: tampered, binding: value.binding, now: NOW,
        devicePublicKeyPem: value.identity.publicKeyPem })).toThrow(/IDEMPOTENCY_SCOPE_MISMATCH/u);
      const forgedTtl = [pieces[0], pieces[1], (Number.parseInt(pieces[2]!, 36) + 1).toString(36), pieces[3], pieces[4]].join('.');
      expect(() => verifyIdentityAccessOperationToken({ clientOperationId: forgedTtl, binding: value.binding, now: NOW,
        devicePublicKeyPem: value.identity.publicKeyPem })).toThrow(/IDEMPOTENCY_INVALID/u);
      expect(() => verifyIdentityAccessOperationToken({ clientOperationId: token.clientOperationId, binding: value.binding,
        now: asIsoDateTime('2026-08-14T08:29:29.000Z'), devicePublicKeyPem: value.identity.publicKeyPem })).toThrow(/IDEMPOTENCY_INVALID/u);
      expect(() => verifyIdentityAccessOperationToken({ clientOperationId: token.clientOperationId, binding: value.binding,
        now: token.expiresAt, devicePublicKeyPem: value.identity.publicKeyPem })).toThrow(/IDEMPOTENCY_EXPIRED/u);
      expect(() => verifyIdentityAccessOperationToken({ clientOperationId: 'iat1.invalid', binding: value.binding, now: NOW,
        devicePublicKeyPem: value.identity.publicKeyPem })).toThrow(/IDEMPOTENCY_INVALID/u);
    } finally { rmSync(value.directory, { recursive: true, force: true }); }
  });
});
