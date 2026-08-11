import type {
  RepositoryExecutionContext,
  RepositoryResult,
  WindowsHelloRegistrationRepositoryPort,
  WindowsHelloRegistrationRow
} from '@ppt/repository-contracts';
import type { IsoDateTime, UserId } from '@ppt/core';
import { SqliteRepository } from './sqlite-base.js';

const columns = `
  id,account_id,device_id,device_fingerprint,windows_principal_hash,display_name,
  security_epoch,enrolled_at,last_verified_at,revoked_at,revocation_reason
`;

const mapRow = (row: Record<string, unknown>): WindowsHelloRegistrationRow => ({
  id: String(row.id),
  accountId: String(row.account_id) as UserId,
  deviceId: String(row.device_id),
  deviceFingerprint: String(row.device_fingerprint),
  windowsPrincipalHash: String(row.windows_principal_hash),
  displayName: String(row.display_name),
  securityEpoch: Number(row.security_epoch),
  enrolledAt: String(row.enrolled_at) as IsoDateTime,
  ...(row.last_verified_at ? { lastVerifiedAt: String(row.last_verified_at) as IsoDateTime } : {}),
  ...(row.revoked_at ? { revokedAt: String(row.revoked_at) as IsoDateTime } : {}),
  ...(row.revocation_reason
    ? { revocationReason: String(row.revocation_reason) as NonNullable<WindowsHelloRegistrationRow['revocationReason']> }
    : {})
});

const changesOf = (result: unknown): number => Number(
  (result as { readonly changes?: number | bigint }).changes ?? 0
);

export class SqliteWindowsHelloRegistrationRepository
extends SqliteRepository
implements WindowsHelloRegistrationRepositoryPort {
  public findActive(
    context: RepositoryExecutionContext,
    accountId: UserId,
    deviceId: string
  ): RepositoryResult<WindowsHelloRegistrationRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT ${columns}
        FROM windows_hello_registrations
        WHERE account_id=? AND device_id=? AND revoked_at IS NULL
      `).get(accountId, deviceId) as Record<string, unknown> | undefined;
      return row ? mapRow(row) : null;
    });
  }

  public listByAccount(
    context: RepositoryExecutionContext,
    accountId: UserId
  ): RepositoryResult<readonly WindowsHelloRegistrationRow[]> {
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT ${columns}
        FROM windows_hello_registrations
        WHERE account_id=?
        ORDER BY revoked_at IS NOT NULL,enrolled_at DESC,id DESC
      `).all(accountId) as Record<string, unknown>[]
    ).map(mapRow));
  }

  public insert(
    context: RepositoryExecutionContext,
    input: WindowsHelloRegistrationRow
  ): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO windows_hello_registrations(
          id,account_id,device_id,device_fingerprint,windows_principal_hash,display_name,
          security_epoch,enrolled_at,last_verified_at,revoked_at,revocation_reason,created_at
        ) VALUES(?,?,?,?,?,?,?,?,NULL,NULL,NULL,?)
      `).run(
        input.id,
        input.accountId,
        input.deviceId,
        input.deviceFingerprint,
        input.windowsPrincipalHash,
        input.displayName,
        input.securityEpoch,
        input.enrolledAt,
        input.enrolledAt
      );
    });
  }

  public markVerified(
    context: RepositoryExecutionContext,
    input: {
      readonly registrationId: string;
      readonly accountId: UserId;
      readonly deviceId: string;
      readonly deviceFingerprint: string;
      readonly windowsPrincipalHash: string;
      readonly securityEpoch: number;
      readonly verifiedAt: IsoDateTime;
    }
  ): RepositoryResult<boolean> {
    return this.execute(context, () => changesOf(this.database(context).prepare(`
      UPDATE windows_hello_registrations
      SET last_verified_at=?
      WHERE id=? AND account_id=? AND device_id=? AND device_fingerprint=?
        AND windows_principal_hash=? AND security_epoch=? AND revoked_at IS NULL
    `).run(
      input.verifiedAt,
      input.registrationId,
      input.accountId,
      input.deviceId,
      input.deviceFingerprint,
      input.windowsPrincipalHash,
      input.securityEpoch
    )) === 1);
  }

  public revokeActiveForDevice(
    context: RepositoryExecutionContext,
    input: {
      readonly accountId: UserId;
      readonly registrationId: string;
      readonly deviceId: string;
      readonly revokedAt: IsoDateTime;
      readonly reason: WindowsHelloRegistrationRow['revocationReason'];
    }
  ): RepositoryResult<number> {
    return this.execute(context, () => changesOf(this.database(context).prepare(`
      UPDATE windows_hello_registrations
      SET revoked_at=?,revocation_reason=?
      WHERE id=? AND account_id=? AND device_id=? AND revoked_at IS NULL
    `).run(
      input.revokedAt,
      input.reason,
      input.registrationId,
      input.accountId,
      input.deviceId
    )));
  }
}
