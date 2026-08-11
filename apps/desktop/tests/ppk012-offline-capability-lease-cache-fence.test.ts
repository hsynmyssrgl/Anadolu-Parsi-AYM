import { describe, expect, it } from 'vitest';
import {
  OfflineCapabilityLeasePolicy,
  computeOfflineCapabilityLeaseSha256,
  createOfflineCapabilityLease,
  isOfflineCapabilityLeaseStructurallyValid,
  revokeOfflineCapabilityLease,
  type OfflineCapabilityLease
} from '@ppt/platform-policy';
import { OfflineSensitiveCacheRegistry } from '../src/main/ipc-read-sharing.js';

const NOW = Date.parse('2026-08-11T12:00:00.000Z');
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

const lease = (overrides: Partial<OfflineCapabilityLease> = {}): OfflineCapabilityLease => createOfflineCapabilityLease({
  leaseId: 'lease-ppk012-1',
  familyId: 'family-main',
  subjectAccountId: 'account-admin',
  deviceId: 'device-windows-1',
  capability: 'health.read',
  issuedAt: new Date(NOW).toISOString(),
  notBefore: new Date(NOW).toISOString(),
  expiresAt: new Date(NOW + 60 * 60_000).toISOString(),
  policyVersion: 'PPT-PLATFORM-POLICY-PPK-012',
  policyPackageVersion: 12,
  policyPackageSha256: HASH_A,
  capabilityManifestSha256: HASH_B,
  nonce: 'nonce-ppk012-1',
  ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'schemaVersion' && key !== 'leaseSha256' && key !== 'revokedAt'))
} as Parameters<typeof createOfflineCapabilityLease>[0]);

const context = {
  familyId: 'family-main',
  subjectAccountId: 'account-admin',
  deviceId: 'device-windows-1',
  capability: 'health.read' as const,
  policyPackageVersion: 12,
  policyPackageSha256: HASH_A,
  capabilityManifestSha256: HASH_B
};

describe('32-H PPK-012 offline capability lease and sensitive cache fence', () => {
  it('creates a finite integrity-bound lease', () => {
    const value = lease();
    expect(isOfflineCapabilityLeaseStructurallyValid(value)).toBe(true);
    const { leaseSha256: _sha, ...unsigned } = value;
    expect(value.leaseSha256).toBe(computeOfflineCapabilityLeaseSha256(unsigned));
  });

  it('rejects leases longer than the 24-hour offline ceiling', () => {
    expect(() => lease({ expiresAt: new Date(NOW + 86_401_000).toISOString() })).toThrow(/invalid/u);
  });

  it('allows an exact lease only while offline and within its validity window', () => {
    const policy = new OfflineCapabilityLeasePolicy();
    expect(policy.evaluate({ lease: lease(), occurredAt: new Date(NOW + 1).toISOString(), online: false, ...context }))
      .toMatchObject({ allowed: true, cacheLocked: false, reason: 'ACTIVE' });
  });

  it('does not let an offline lease replace the online policy path', () => {
    const policy = new OfflineCapabilityLeasePolicy();
    expect(policy.evaluate({ lease: lease(), occurredAt: new Date(NOW + 1).toISOString(), online: true, ...context }))
      .toEqual({ allowed: false, cacheLocked: true, reason: 'ONLINE_MODE' });
  });

  it('fails closed at the exact expiry instant', () => {
    const value = lease();
    const policy = new OfflineCapabilityLeasePolicy();
    expect(policy.evaluate({ lease: value, occurredAt: value.expiresAt, online: false, ...context }))
      .toEqual({ allowed: false, cacheLocked: true, reason: 'EXPIRED' });
  });

  it('rejects subject, device, capability and policy-package mismatches', () => {
    const policy = new OfflineCapabilityLeasePolicy();
    for (const changed of [
      { subjectAccountId: 'account-other' },
      { deviceId: 'device-other' },
      { capability: 'finance.read' as const },
      { policyPackageSha256: 'c'.repeat(64) }
    ]) {
      expect(policy.evaluate({ lease: lease(), occurredAt: new Date(NOW + 1).toISOString(), online: false, ...context, ...changed }).allowed).toBe(false);
    }
  });

  it('detects payload tampering through the lease digest', () => {
    const value = { ...lease(), expiresAt: new Date(NOW + 30 * 60_000).toISOString() };
    expect(isOfflineCapabilityLeaseStructurallyValid(value)).toBe(false);
  });

  it('starts with the sensitive cache locked and empty', () => {
    expect(new OfflineSensitiveCacheRegistry().state(NOW)).toEqual({ locked: true, reason: 'NO_LEASE', entryCount: 0 });
  });

  it('stores and returns cloned sensitive data only under the exact active lease', () => {
    const cache = new OfflineSensitiveCacheRegistry();
    expect(cache.activate(lease(), NOW)).toBe(true);
    expect(cache.store('health:1', { diagnosis: 'private' }, context, { ttlMs: 30_000, maxEntries: 2, maxResultBytes: 2_000, now: NOW + 1 })).toBe(true);
    const found = cache.lookup<{ diagnosis: string }>('health:1', context, NOW + 2);
    expect(found).toMatchObject({ hit: true, result: { diagnosis: 'private' } });
    found.result!.diagnosis = 'changed';
    expect(cache.lookup<{ diagnosis: string }>('health:1', context, NOW + 3).result?.diagnosis).toBe('private');
  });

  it('locks and clears all sensitive entries when the lease expires', () => {
    const cache = new OfflineSensitiveCacheRegistry();
    const value = lease();
    cache.activate(value, NOW);
    cache.store('health:1', { secret: true }, context, { ttlMs: 86_400_000, maxEntries: 2, maxResultBytes: 2_000, now: NOW + 1 });
    expect(cache.state(Date.parse(value.expiresAt))).toEqual({ locked: true, reason: 'EXPIRED', entryCount: 0 });
  });

  it('locks and clears the cache on a context mismatch', () => {
    const cache = new OfflineSensitiveCacheRegistry();
    cache.activate(lease(), NOW);
    cache.store('health:1', { secret: true }, context, { ttlMs: 30_000, maxEntries: 2, maxResultBytes: 2_000, now: NOW + 1 });
    expect(cache.lookup('health:1', { ...context, deviceId: 'device-other' }, NOW + 2)).toEqual({ hit: false });
    expect(cache.state(NOW + 3)).toEqual({ locked: true, reason: 'CONTEXT_MISMATCH', entryCount: 0 });
  });

  it('recomputes the integrity digest on revocation and refuses reactivation', () => {
    const active = lease();
    const revoked = revokeOfflineCapabilityLease(active, new Date(NOW + 10_000).toISOString());
    expect(revoked.leaseSha256).not.toBe(active.leaseSha256);
    expect(isOfflineCapabilityLeaseStructurallyValid(revoked)).toBe(true);
    const cache = new OfflineSensitiveCacheRegistry();
    expect(cache.activate(revoked, NOW + 11_000)).toBe(false);
    expect(cache.state(NOW + 11_000)).toEqual({ locked: true, reason: 'REVOKED', entryCount: 0 });
  });
});
