import type { IsoDateTime, UserId } from '@ppt/core';
import type { OfflineCapability } from '@ppt/domain';
import type {
  OfflineCapabilityLeaseRepositoryPort,
  OfflineCapabilityLeaseRow,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';

const SHA256 = /^[0-9a-f]{64}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

const mapRow = (row: Record<string, unknown>): OfflineCapabilityLeaseRow => ({
  schemaVersion: 1,
  leaseId: String(row.lease_id),
  familyId: String(row.family_id),
  subjectAccountId: String(row.subject_account_id) as UserId,
  deviceId: String(row.device_id),
  capability: String(row.capability) as OfflineCapability,
  issuedAt: String(row.issued_at) as IsoDateTime,
  notBefore: String(row.not_before) as IsoDateTime,
  expiresAt: String(row.expires_at) as IsoDateTime,
  policyVersion: String(row.policy_version),
  policyPackageVersion: Number(row.policy_package_version),
  policyPackageSha256: String(row.policy_package_sha256),
  capabilityManifestSha256: String(row.capability_manifest_sha256),
  nonce: String(row.nonce),
  ...(row.revoked_at ? { revokedAt: String(row.revoked_at) as IsoDateTime } : {}),
  leaseSha256: String(row.lease_sha256)
});

const assertLease = (lease: OfflineCapabilityLeaseRow): void => {
  if (lease.schemaVersion !== 1
    || !IDENTIFIER.test(lease.leaseId) || !IDENTIFIER.test(lease.familyId)
    || !IDENTIFIER.test(lease.subjectAccountId) || !IDENTIFIER.test(lease.deviceId)
    || !IDENTIFIER.test(lease.nonce)
    || !ISO_UTC.test(lease.issuedAt) || !ISO_UTC.test(lease.notBefore) || !ISO_UTC.test(lease.expiresAt)
    || (lease.revokedAt !== undefined && !ISO_UTC.test(lease.revokedAt))
    || !Number.isInteger(lease.policyPackageVersion) || lease.policyPackageVersion < 1
    || !SHA256.test(lease.policyPackageSha256) || !SHA256.test(lease.capabilityManifestSha256)
    || !SHA256.test(lease.leaseSha256)) throw new Error('OFFLINE_CAPABILITY_LEASE_INVALID');
};

export class SqliteOfflineCapabilityLeaseRepository extends SqliteRepository implements OfflineCapabilityLeaseRepositoryPort {
  public listForFamily(context: RepositoryExecutionContext, familyId: string): RepositoryResult<readonly OfflineCapabilityLeaseRow[]> {
    return this.execute(context, () => (this.database(context).prepare(`
      SELECT * FROM offline_capability_leases WHERE family_id=? ORDER BY issued_at DESC,lease_id
    `).all(familyId) as Array<Record<string, unknown>>).map(mapRow));
  }

  public findById(context: RepositoryExecutionContext, leaseId: string): RepositoryResult<OfflineCapabilityLeaseRow | undefined> {
    return this.execute(context, () => {
      const row = this.database(context).prepare('SELECT * FROM offline_capability_leases WHERE lease_id=?').get(leaseId) as Record<string, unknown> | undefined;
      return row ? mapRow(row) : undefined;
    });
  }

  public findActiveForScope(context: RepositoryExecutionContext, input: {
    readonly familyId: string; readonly subjectAccountId: UserId; readonly deviceId: string;
    readonly capability: OfflineCapability; readonly occurredAt: IsoDateTime;
  }): RepositoryResult<OfflineCapabilityLeaseRow | undefined> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT * FROM offline_capability_leases
        WHERE family_id=? AND subject_account_id=? AND device_id=? AND capability=?
          AND revoked_at IS NULL AND not_before<=? AND expires_at>?
        ORDER BY expires_at DESC LIMIT 1
      `).get(input.familyId,input.subjectAccountId,input.deviceId,input.capability,input.occurredAt,input.occurredAt) as Record<string, unknown> | undefined;
      return row ? mapRow(row) : undefined;
    });
  }

  public insert(context: RepositoryExecutionContext, lease: OfflineCapabilityLeaseRow): RepositoryResult<void> {
    return this.execute(context, () => {
      assertLease(lease);
      this.database(context).prepare(`
        INSERT INTO offline_capability_leases(
          lease_id,schema_version,family_id,subject_account_id,device_id,capability,issued_at,not_before,expires_at,
          policy_version,policy_package_version,policy_package_sha256,capability_manifest_sha256,nonce,revoked_at,lease_sha256
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(lease.leaseId,1,lease.familyId,lease.subjectAccountId,lease.deviceId,lease.capability,lease.issuedAt,
        lease.notBefore,lease.expiresAt,lease.policyVersion,lease.policyPackageVersion,lease.policyPackageSha256,
        lease.capabilityManifestSha256,lease.nonce,lease.revokedAt??null,lease.leaseSha256);
    });
  }

  public revoke(context: RepositoryExecutionContext, lease: OfflineCapabilityLeaseRow): RepositoryResult<boolean> {
    return this.execute(context, () => {
      assertLease(lease);
      if (!lease.revokedAt) throw new Error('OFFLINE_CAPABILITY_LEASE_REVOCATION_REQUIRED');
      return Number(this.database(context).prepare(`
        UPDATE offline_capability_leases SET revoked_at=?,lease_sha256=?
        WHERE lease_id=? AND revoked_at IS NULL
      `).run(lease.revokedAt,lease.leaseSha256,lease.leaseId).changes) > 0;
    });
  }
}
