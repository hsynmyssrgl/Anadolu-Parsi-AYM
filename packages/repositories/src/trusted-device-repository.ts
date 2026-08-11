import type { TrustedDeviceRow, TrustedDeviceRepositoryPort } from '@ppt/repository-contracts';
import type { IsoDateTime, UserId } from '@ppt/core';
import type { RepositoryResult } from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';

const mapRow = (row: Record<string, unknown>): TrustedDeviceRow => ({
  id: String(row.id),
  accountId: String(row.account_id) as UserId,
  deviceId: String(row.device_id),
  displayName: String(row.display_name),
  fingerprint: String(row.fingerprint),
  publicKeyPem: String(row.public_key_pem),
  trustedAt: String(row.trusted_at) as IsoDateTime,
  lastSeenAt: String(row.last_seen_at) as IsoDateTime,
  securityEpoch: Number(row.security_epoch ?? 0),
  ...(row.revoked_at ? { revokedAt: String(row.revoked_at) as IsoDateTime } : {})
});

export class SqliteTrustedDeviceRepository extends SqliteRepository implements TrustedDeviceRepositoryPort {
  public findActive(
    context: RepositoryExecutionContext,
    accountId: UserId,
    deviceId: string
  ): RepositoryResult<TrustedDeviceRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,account_id,device_id,display_name,fingerprint,public_key_pem,
               trusted_at,last_seen_at,security_epoch,revoked_at
        FROM trusted_devices
        WHERE account_id=? AND device_id=? AND revoked_at IS NULL
      `).get(accountId, deviceId) as Record<string, unknown> | undefined;
      return row ? mapRow(row) : null;
    });
  }

  public listByAccount(
    context: RepositoryExecutionContext,
    accountId: UserId
  ): RepositoryResult<readonly TrustedDeviceRow[]> {
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT id,account_id,device_id,display_name,fingerprint,public_key_pem,
               trusted_at,last_seen_at,security_epoch,revoked_at
        FROM trusted_devices WHERE account_id=?
        ORDER BY revoked_at IS NOT NULL, last_seen_at DESC
      `).all(accountId) as Record<string, unknown>[]
    ).map(mapRow));
  }

  public upsert(context: RepositoryExecutionContext, input: TrustedDeviceRow): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO trusted_devices(
          id,account_id,device_id,display_name,fingerprint,public_key_pem,
          trusted_at,last_seen_at,security_epoch,revoked_at,created_at
        ) VALUES(?,?,?,?,?,?,?,?,?,NULL,?)
        ON CONFLICT(account_id,device_id) DO UPDATE SET
          display_name=excluded.display_name,
          fingerprint=excluded.fingerprint,
          public_key_pem=excluded.public_key_pem,
          trusted_at=excluded.trusted_at,
          last_seen_at=excluded.last_seen_at,
          security_epoch=excluded.security_epoch,
          revoked_at=NULL
      `).run(
        input.id,
        input.accountId,
        input.deviceId,
        input.displayName,
        input.fingerprint,
        input.publicKeyPem,
        input.trustedAt,
        input.lastSeenAt,
        input.securityEpoch,
        input.trustedAt
      );
    });
  }

  public touch(
    context: RepositoryExecutionContext,
    accountId: UserId,
    deviceId: string,
    lastSeenAt: IsoDateTime
  ): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        UPDATE trusted_devices SET last_seen_at=?
        WHERE account_id=? AND device_id=? AND revoked_at IS NULL
      `).run(lastSeenAt, accountId, deviceId);
    });
  }

  public revoke(
    context: RepositoryExecutionContext,
    accountId: UserId,
    trustedDeviceId: string,
    revokedAt: IsoDateTime
  ): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        UPDATE trusted_devices SET revoked_at=? WHERE id=? AND account_id=?
      `).run(revokedAt, trustedDeviceId, accountId);
    });
  }

  public revokeAll(
    context: RepositoryExecutionContext,
    accountId: UserId,
    revokedAt: IsoDateTime
  ): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        UPDATE trusted_devices SET revoked_at=?
        WHERE account_id=? AND revoked_at IS NULL
      `).run(revokedAt, accountId);
    });
  }
}
