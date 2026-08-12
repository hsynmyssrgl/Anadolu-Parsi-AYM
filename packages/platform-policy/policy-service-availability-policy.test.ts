import { describe, expect, it } from 'vitest';
import {
  POLICY_SERVICE_OBSERVATION_MAX_AGE_MS,
  POLICY_SERVICE_OBSERVATION_MAX_FUTURE_SKEW_MS,
  PolicyServiceAvailabilityPolicy,
  type PolicyServiceAvailabilityObservation
} from './src/policy-service-availability-policy.js';

const CHECKED_AT = '2026-08-12T00:00:30.000Z';
const PACKAGE_SHA256 = 'a'.repeat(64);

const observation = (
  overrides: Partial<PolicyServiceAvailabilityObservation> = {}
): PolicyServiceAvailabilityObservation => Object.freeze({
  schemaVersion: 1,
  lifecycle: 'ready',
  writable: true,
  safeMode: false,
  policyPackageVerified: true,
  policyVersion: 'PPK-024',
  policyPackageVersion: 24,
  policyPackageSha256: PACKAGE_SHA256,
  expectedPolicyVersion: 'PPK-024',
  expectedPolicyPackageVersion: 24,
  expectedPolicyPackageSha256: PACKAGE_SHA256,
  observedAt: CHECKED_AT,
  checkedAt: CHECKED_AT,
  ...overrides
});

const atOffsetFromCheckedAt = (offsetMs: number): string =>
  new Date(Date.parse(CHECKED_AT) + offsetMs).toISOString();

describe('32-T PPK-024 policy service availability policy', () => {
  const policy = new PolicyServiceAvailabilityPolicy();

  it.each([
    ['ready writable', { lifecycle: 'ready', writable: true, safeMode: false }, 'read-write', 'FRESH_VERIFIED_READ_WRITE'],
    ['ready non-writable', { lifecycle: 'ready', writable: false, safeMode: false }, 'read-only', 'FRESH_VERIFIED_READ_ONLY'],
    ['degraded safe mode', { lifecycle: 'degraded', writable: false, safeMode: true }, 'read-only', 'FRESH_VERIFIED_READ_ONLY'],
    ['starting', { lifecycle: 'starting', writable: false, safeMode: true }, 'deny', 'SERVICE_NOT_READY'],
    ['stopping', { lifecycle: 'stopping', writable: false, safeMode: true }, 'deny', 'SERVICE_NOT_READY'],
    ['stopped', { lifecycle: 'stopped', writable: false, safeMode: true }, 'deny', 'SERVICE_NOT_READY'],
    ['ready writable safe mode', { lifecycle: 'ready', writable: true, safeMode: true }, 'deny', 'UNSAFE_SERVICE_STATE'],
    ['ready non-writable safe mode', { lifecycle: 'ready', writable: false, safeMode: true }, 'deny', 'UNSAFE_SERVICE_STATE'],
    ['degraded writable safe mode', { lifecycle: 'degraded', writable: true, safeMode: true }, 'deny', 'UNSAFE_SERVICE_STATE'],
    ['degraded writable without safe mode', { lifecycle: 'degraded', writable: true, safeMode: false }, 'deny', 'UNSAFE_SERVICE_STATE'],
    ['degraded non-writable without safe mode', { lifecycle: 'degraded', writable: false, safeMode: false }, 'deny', 'UNSAFE_SERVICE_STATE']
  ] as const)('maps the exact lifecycle matrix for %s', (_name, state, mode, reason) => {
    expect(policy.evaluate(observation(state))).toMatchObject({
      mode,
      reason,
      sensitiveReadAllowed: mode !== 'deny',
      sensitiveMutationAllowed: mode === 'read-write',
      policyPackageVerified: true,
      observationFresh: reason === 'FRESH_VERIFIED_READ_WRITE'
        || reason === 'FRESH_VERIFIED_READ_ONLY'
        || reason === 'SERVICE_NOT_READY'
        || reason === 'UNSAFE_SERVICE_STATE'
    });
  });

  it.each([
    ['invalid signature', { policyPackageVerified: false }, 'POLICY_PACKAGE_SIGNATURE_INVALID'],
    ['policy version mismatch', { policyVersion: 'PPK-023' }, 'POLICY_VERSION_MISMATCH'],
    ['package version mismatch', { policyPackageVersion: 23 }, 'POLICY_PACKAGE_VERSION_MISMATCH'],
    ['package hash mismatch', { policyPackageSha256: 'b'.repeat(64) }, 'POLICY_PACKAGE_HASH_MISMATCH']
  ] as const)('denies %s before sensitive authority is granted', (_name, patch, reason) => {
    expect(policy.evaluate(observation(patch))).toMatchObject({
      mode: 'deny',
      reason,
      sensitiveReadAllowed: false,
      sensitiveMutationAllowed: false,
      observationFresh: false
    });
  });

  it('accepts an observation at the exact 30,000 ms freshness boundary', () => {
    expect(policy.evaluate(observation({
      observedAt: atOffsetFromCheckedAt(-POLICY_SERVICE_OBSERVATION_MAX_AGE_MS)
    }))).toMatchObject({
      mode: 'read-write',
      reason: 'FRESH_VERIFIED_READ_WRITE',
      observationAgeMs: 30_000
    });
  });

  it('denies an observation one millisecond beyond the 30,000 ms freshness boundary', () => {
    expect(policy.evaluate(observation({
      observedAt: atOffsetFromCheckedAt(-(POLICY_SERVICE_OBSERVATION_MAX_AGE_MS + 1))
    }))).toMatchObject({
      mode: 'deny',
      reason: 'OBSERVATION_STALE',
      observationAgeMs: 30_001
    });
  });

  it('accepts an observation at the exact -5,000 ms future-skew boundary', () => {
    expect(policy.evaluate(observation({
      observedAt: atOffsetFromCheckedAt(POLICY_SERVICE_OBSERVATION_MAX_FUTURE_SKEW_MS)
    }))).toMatchObject({
      mode: 'read-write',
      reason: 'FRESH_VERIFIED_READ_WRITE',
      observationAgeMs: -5_000
    });
  });

  it('denies an observation one millisecond beyond the -5,000 ms future-skew boundary', () => {
    expect(policy.evaluate(observation({
      observedAt: atOffsetFromCheckedAt(POLICY_SERVICE_OBSERVATION_MAX_FUTURE_SKEW_MS + 1)
    }))).toMatchObject({
      mode: 'deny',
      reason: 'OBSERVATION_FROM_FUTURE',
      observationAgeMs: -5_001
    });
  });

  it.each([
    ['undefined', undefined, 'SERVICE_UNAVAILABLE'],
    ['null', null, 'SERVICE_UNAVAILABLE'],
    ['primitive', 'ready', 'OBSERVATION_MALFORMED'],
    ['array', [], 'OBSERVATION_MALFORMED'],
    ['missing field', (() => { const { checkedAt: _checkedAt, ...value } = observation(); return value; })(), 'OBSERVATION_MALFORMED'],
    ['extra field', { ...observation(), extra: true }, 'OBSERVATION_MALFORMED'],
    ['wrong schema', { ...observation(), schemaVersion: 2 }, 'OBSERVATION_MALFORMED'],
    ['unknown lifecycle', { ...observation(), lifecycle: 'unknown' }, 'OBSERVATION_MALFORMED'],
    ['wrong boolean', { ...observation(), writable: 1 }, 'OBSERVATION_MALFORMED'],
    ['non-positive package version', { ...observation(), policyPackageVersion: 0 }, 'OBSERVATION_MALFORMED'],
    ['uppercase hash', { ...observation(), policyPackageSha256: 'A'.repeat(64) }, 'OBSERVATION_MALFORMED'],
    ['non-canonical timestamp', { ...observation(), observedAt: '2026-08-12T00:00:30Z' }, 'OBSERVATION_MALFORMED']
  ] as const)('fails closed for %s input', (_name, value, reason) => {
    expect(policy.evaluate(value)).toMatchObject({
      mode: 'deny',
      reason,
      sensitiveReadAllowed: false,
      sensitiveMutationAllowed: false
    });
  });

  it('publishes a frozen, content-free and exactly verifiable boundary snapshot', () => {
    const snapshot = policy.snapshot(policy.evaluate(observation()));
    expect(policy.verifySnapshot(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      status: 'policy-service-availability-evaluated',
      enforcement: 'fail-closed',
      mode: 'read-write',
      mappingGrantsRuntimeAuthority: false,
      historicalReceiptGrantsCurrentAuthority: false,
      sourcePathsExposedToClient: false,
      policyPackageHashesExposedToClient: false,
      schemaMigrationRequired: false,
      latestDatabaseMigration: 77
    });
    expect(snapshot).not.toHaveProperty('policyPackageSha256');
    expect(snapshot).not.toHaveProperty('expectedPolicyPackageSha256');
    expect(snapshot).not.toHaveProperty('sourcePath');
  });

  it.each([
    ['an extra field', (snapshot: object) => ({ ...snapshot, extra: true })],
    ['an inconsistent read flag', (snapshot: object) => ({ ...snapshot, sensitiveReadAllowed: false })],
    ['an inconsistent mutation flag', (snapshot: object) => ({ ...snapshot, sensitiveMutationAllowed: false })],
    ['a widened authority marker', (snapshot: object) => ({ ...snapshot, mappingGrantsRuntimeAuthority: true })],
    ['a changed observation ceiling', (snapshot: object) => ({ ...snapshot, maximumObservationAgeMs: 30_001 })]
  ])('rejects a boundary snapshot containing %s', (_name, mutate) => {
    const snapshot = policy.snapshot(policy.evaluate(observation()));
    expect(policy.verifySnapshot(mutate(snapshot))).toBe(false);
  });

});
