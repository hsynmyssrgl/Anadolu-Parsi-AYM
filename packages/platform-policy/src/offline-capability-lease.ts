import { createHash, timingSafeEqual } from 'node:crypto';
import type { PlatformCapability } from './policy-kernel.js';

export const OFFLINE_CAPABILITY_LEASE_MAX_SECONDS = 86_400;
export const OFFLINE_CAPABILITY_LEASE_MIN_SECONDS = 60;

export interface OfflineCapabilityLease {
  readonly schemaVersion: 1;
  readonly leaseId: string;
  readonly familyId: string;
  readonly subjectAccountId: string;
  readonly deviceId: string;
  readonly capability: PlatformCapability;
  readonly issuedAt: string;
  readonly notBefore: string;
  readonly expiresAt: string;
  readonly policyVersion: string;
  readonly policyPackageVersion: number;
  readonly policyPackageSha256: string;
  readonly capabilityManifestSha256: string;
  readonly nonce: string;
  readonly revokedAt?: string;
  readonly leaseSha256: string;
}

export interface CreateOfflineCapabilityLeaseInput extends Omit<OfflineCapabilityLease, 'schemaVersion' | 'leaseSha256' | 'revokedAt'> {}

export type OfflineCapabilityLeaseReason =
  | 'ACTIVE'
  | 'ONLINE_MODE'
  | 'INVALID_LEASE'
  | 'NOT_YET_VALID'
  | 'EXPIRED'
  | 'REVOKED'
  | 'FAMILY_MISMATCH'
  | 'SUBJECT_MISMATCH'
  | 'DEVICE_MISMATCH'
  | 'CAPABILITY_MISMATCH'
  | 'POLICY_PACKAGE_MISMATCH'
  | 'CAPABILITY_MANIFEST_MISMATCH';

export interface OfflineCapabilityLeaseEvaluationInput {
  readonly lease: OfflineCapabilityLease;
  readonly occurredAt: string;
  readonly online: boolean;
  readonly familyId: string;
  readonly subjectAccountId: string;
  readonly deviceId: string;
  readonly capability: PlatformCapability;
  readonly policyPackageVersion: number;
  readonly policyPackageSha256: string;
  readonly capabilityManifestSha256: string;
}

export interface OfflineCapabilityLeaseDecision {
  readonly allowed: boolean;
  readonly cacheLocked: boolean;
  readonly reason: OfflineCapabilityLeaseReason;
  readonly leaseId?: string;
  readonly expiresAt?: string;
}

const SHA256 = /^[0-9a-f]{64}$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('Offline capability lease value is not JSON serializable');
  return serialized;
};

const leasePayload = (lease: Omit<OfflineCapabilityLease, 'leaseSha256'>): object => ({
  schemaVersion: lease.schemaVersion,
  leaseId: lease.leaseId,
  familyId: lease.familyId,
  subjectAccountId: lease.subjectAccountId,
  deviceId: lease.deviceId,
  capability: lease.capability,
  issuedAt: lease.issuedAt,
  notBefore: lease.notBefore,
  expiresAt: lease.expiresAt,
  policyVersion: lease.policyVersion,
  policyPackageVersion: lease.policyPackageVersion,
  policyPackageSha256: lease.policyPackageSha256,
  capabilityManifestSha256: lease.capabilityManifestSha256,
  nonce: lease.nonce,
  ...(lease.revokedAt ? { revokedAt: lease.revokedAt } : {})
});

export const computeOfflineCapabilityLeaseSha256 = (lease: Omit<OfflineCapabilityLease, 'leaseSha256'>): string =>
  createHash('sha256').update(canonicalJson(leasePayload(lease)), 'utf8').digest('hex');

const validIso = (value: unknown): value is string => typeof value === 'string'
  && ISO_UTC.test(value) && Number.isFinite(Date.parse(value));

const sameSha256 = (left: string, right: string): boolean => SHA256.test(left) && SHA256.test(right)
  && timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));

export const isOfflineCapabilityLeaseStructurallyValid = (lease: OfflineCapabilityLease): boolean => {
  if (lease.schemaVersion !== 1
    || !IDENTIFIER.test(lease.leaseId)
    || !IDENTIFIER.test(lease.familyId)
    || !IDENTIFIER.test(lease.subjectAccountId)
    || !IDENTIFIER.test(lease.deviceId)
    || !IDENTIFIER.test(lease.nonce)
    || typeof lease.policyVersion !== 'string' || lease.policyVersion.trim() !== lease.policyVersion
    || lease.policyVersion.length < 1 || lease.policyVersion.length > 80
    || !Number.isInteger(lease.policyPackageVersion) || lease.policyPackageVersion < 1
    || !SHA256.test(lease.policyPackageSha256)
    || !SHA256.test(lease.capabilityManifestSha256)
    || !SHA256.test(lease.leaseSha256)
    || !validIso(lease.issuedAt) || !validIso(lease.notBefore) || !validIso(lease.expiresAt)
    || (lease.revokedAt !== undefined && !validIso(lease.revokedAt))) return false;
  const issued = Date.parse(lease.issuedAt);
  const notBefore = Date.parse(lease.notBefore);
  const expires = Date.parse(lease.expiresAt);
  if (notBefore < issued || expires <= notBefore
    || expires - notBefore > OFFLINE_CAPABILITY_LEASE_MAX_SECONDS * 1000
    || expires - notBefore < OFFLINE_CAPABILITY_LEASE_MIN_SECONDS * 1000) return false;
  return sameSha256(lease.leaseSha256, computeOfflineCapabilityLeaseSha256({ ...lease, leaseSha256: undefined } as never));
};

export const createOfflineCapabilityLease = (input: CreateOfflineCapabilityLeaseInput): OfflineCapabilityLease => {
  const unsigned: Omit<OfflineCapabilityLease, 'leaseSha256'> = Object.freeze({ schemaVersion: 1, ...input });
  const lease = Object.freeze({ ...unsigned, leaseSha256: computeOfflineCapabilityLeaseSha256(unsigned) });
  if (!isOfflineCapabilityLeaseStructurallyValid(lease)) throw new Error('Offline capability lease is invalid');
  return lease;
};

export const revokeOfflineCapabilityLease = (lease: OfflineCapabilityLease, revokedAt: string): OfflineCapabilityLease => {
  if (!isOfflineCapabilityLeaseStructurallyValid(lease) || !validIso(revokedAt) || Date.parse(revokedAt) < Date.parse(lease.issuedAt)) {
    throw new Error('Offline capability lease revocation is invalid');
  }
  const { leaseSha256: _previousSha256, revokedAt: _previousRevokedAt, ...base } = lease;
  const unsigned: Omit<OfflineCapabilityLease, 'leaseSha256'> = { ...base, revokedAt };
  return Object.freeze({ ...unsigned, leaseSha256: computeOfflineCapabilityLeaseSha256(unsigned) });
};

const denied = (reason: OfflineCapabilityLeaseReason): OfflineCapabilityLeaseDecision =>
  Object.freeze({ allowed: false, cacheLocked: true, reason });

export class OfflineCapabilityLeasePolicy {
  public evaluate(input: OfflineCapabilityLeaseEvaluationInput): OfflineCapabilityLeaseDecision {
    const lease = input.lease;
    if (!isOfflineCapabilityLeaseStructurallyValid(lease) || !validIso(input.occurredAt)) return denied('INVALID_LEASE');
    if (input.online) return denied('ONLINE_MODE');
    if (lease.revokedAt) return denied('REVOKED');
    const occurredAt = Date.parse(input.occurredAt);
    if (occurredAt < Date.parse(lease.notBefore)) return denied('NOT_YET_VALID');
    if (occurredAt >= Date.parse(lease.expiresAt)) return denied('EXPIRED');
    if (lease.familyId !== input.familyId) return denied('FAMILY_MISMATCH');
    if (lease.subjectAccountId !== input.subjectAccountId) return denied('SUBJECT_MISMATCH');
    if (lease.deviceId !== input.deviceId) return denied('DEVICE_MISMATCH');
    if (lease.capability !== input.capability) return denied('CAPABILITY_MISMATCH');
    if (lease.policyPackageVersion !== input.policyPackageVersion
      || !sameSha256(lease.policyPackageSha256, input.policyPackageSha256)) return denied('POLICY_PACKAGE_MISMATCH');
    if (!sameSha256(lease.capabilityManifestSha256, input.capabilityManifestSha256)) return denied('CAPABILITY_MANIFEST_MISMATCH');
    return Object.freeze({ allowed: true, cacheLocked: false, reason: 'ACTIVE', leaseId: lease.leaseId, expiresAt: lease.expiresAt });
  }
}
