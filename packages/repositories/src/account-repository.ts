import type { AccountRow, InsertAccountInput, AccountRepositoryPort, ProtectLegacyTwoFactorSecretsInput } from '@ppt/repository-contracts';
import type { IsoDateTime, UserId } from '@ppt/core';
import type { RepositoryResult } from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';

const mapAccount = (row: Record<string, unknown>): AccountRow => ({
  id: String(row.id) as UserId,
  displayName: String(row.display_name),
  email: String(row.email),
  passwordRecord: String(row.password_record),
  role: String(row.role),
  status: String(row.status),
  ...(row.person_id ? { personId: String(row.person_id) } : {}),
  startsAt: String(row.starts_at) as IsoDateTime,
  ...(row.ends_at ? { endsAt: String(row.ends_at) as IsoDateTime } : {}),
  failedLoginCount: Number(row.failed_login_count ?? 0),
  securityEpoch: Number(row.security_epoch ?? 0),
  ...(row.locked_until ? { lockedUntil: String(row.locked_until) as IsoDateTime } : {}),
  ...(row.totp_secret ? { totpSecret: String(row.totp_secret) } : {}),
  ...(row.recovery_codes ? { recoveryCodes: String(row.recovery_codes) } : {}),
  ...(row.pending_totp_secret ? { pendingTotpSecret: String(row.pending_totp_secret) } : {}),
  ...(row.pending_recovery_codes ? { pendingRecoveryCodes: String(row.pending_recovery_codes) } : {}),
  createdAt: String(row.created_at) as IsoDateTime
});

export class SqliteAccountRepository extends SqliteRepository implements AccountRepositoryPort {
  public count(context: RepositoryExecutionContext): RepositoryResult<number> {
    return this.execute(context, () => Number((
      this.database(context).prepare('SELECT COUNT(*) AS total FROM accounts').get() as { readonly total?: unknown }
    ).total ?? 0));
  }

  public findByEmail(context: RepositoryExecutionContext, email: string): RepositoryResult<AccountRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,display_name,email,password_record,role,status,person_id,starts_at,ends_at,
               failed_login_count,security_epoch,locked_until,totp_secret,recovery_codes,pending_totp_secret,pending_recovery_codes,created_at
        FROM accounts WHERE email=?
      `).get(email) as Record<string, unknown> | undefined;
      return row ? mapAccount(row) : null;
    });
  }

  public findById(context: RepositoryExecutionContext, id: UserId): RepositoryResult<AccountRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,display_name,email,password_record,role,status,person_id,starts_at,ends_at,
               failed_login_count,security_epoch,locked_until,totp_secret,recovery_codes,pending_totp_secret,pending_recovery_codes,created_at
        FROM accounts WHERE id=?
      `).get(id) as Record<string, unknown> | undefined;
      return row ? mapAccount(row) : null;
    });
  }

  public insert(context: RepositoryExecutionContext, input: InsertAccountInput): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO accounts(
          id,display_name,email,password_record,role,status,person_id,starts_at,ends_at,created_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?)
      `).run(
        input.id,
        input.displayName,
        input.email,
        input.passwordRecord,
        input.role,
        input.status,
        input.personId ?? null,
        input.startsAt,
        input.endsAt ?? null,
        input.createdAt
      );
    });
  }

  public list(context: RepositoryExecutionContext): RepositoryResult<readonly AccountRow[]> {
    return this.execute(context, () => (this.database(context).prepare(`
      SELECT id,display_name,email,password_record,role,status,person_id,starts_at,ends_at,
             failed_login_count,security_epoch,locked_until,totp_secret,recovery_codes,pending_totp_secret,pending_recovery_codes,created_at
      FROM accounts ORDER BY created_at
    `).all() as Array<Record<string, unknown>>).map(mapAccount));
  }

  public ensureFamilyAdminExists(context: RepositoryExecutionContext): RepositoryResult<boolean> {
    return this.execute(context, () => {
      const result = this.database(context).prepare(`
        UPDATE accounts
        SET role='family_admin'
        WHERE id=(SELECT id FROM accounts ORDER BY created_at LIMIT 1)
          AND NOT EXISTS(SELECT 1 FROM accounts WHERE role='family_admin')
      `).run();
      return result.changes > 0;
    });
  }

  public updateMembership(context: RepositoryExecutionContext, input: {
    readonly accountId: UserId;
    readonly role: string;
    readonly status: string;
    readonly personId?: string;
    readonly startsAt: IsoDateTime;
    readonly endsAt?: IsoDateTime;
  }): RepositoryResult<boolean> {
    return this.execute(context, () => this.database(context).prepare(`
      UPDATE accounts SET role=?,status=?,person_id=?,starts_at=?,ends_at=? WHERE id=?
    `).run(input.role, input.status, input.personId ?? null, input.startsAt, input.endsAt ?? null, input.accountId).changes > 0);
  }

  public recordLoginFailure(
    context: RepositoryExecutionContext,
    input: { readonly accountId: UserId; readonly failedLoginCount: number; readonly lockedUntil?: IsoDateTime }
  ): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        UPDATE accounts SET failed_login_count=?,locked_until=? WHERE id=?
      `).run(input.failedLoginCount, input.lockedUntil ?? null, input.accountId);
    });
  }

  public clearLoginFailures(context: RepositoryExecutionContext, accountId: UserId): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        UPDATE accounts SET failed_login_count=0,locked_until=NULL WHERE id=?
      `).run(accountId);
    });
  }

  public advanceSecurityEpoch(context: RepositoryExecutionContext, accountId: UserId): RepositoryResult<number> {
    return this.execute(context, () => {
      const updated = this.database(context).prepare(`
        UPDATE accounts SET security_epoch=security_epoch+1
        WHERE id=? AND security_epoch < 2147483647
      `).run(accountId);
      if (updated.changes !== 1) throw new Error('Hesap güvenlik dönemi ilerletilemedi.');
      const row = this.database(context).prepare('SELECT security_epoch FROM accounts WHERE id=?')
        .get(accountId) as { readonly security_epoch?: unknown } | undefined;
      const next = Number(row?.security_epoch);
      if (!Number.isSafeInteger(next) || next < 1 || next > 2147483647) {
        throw new Error('Hesap güvenlik dönemi doğrulanamadı.');
      }
      return next;
    });
  }

  public updatePassword(
    context: RepositoryExecutionContext,
    accountId: UserId,
    passwordRecord: string
  ): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare('UPDATE accounts SET password_record=? WHERE id=?')
        .run(passwordRecord, accountId);
    });
  }
  public savePendingTwoFactor(
    context: RepositoryExecutionContext,
    input: { readonly accountId: UserId; readonly secret: string; readonly recoveryCodes: string }
  ): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        UPDATE accounts SET pending_totp_secret=?,pending_recovery_codes=? WHERE id=?
      `).run(input.secret, input.recoveryCodes, input.accountId);
    });
  }

  public enableTwoFactor(context: RepositoryExecutionContext, accountId: UserId): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        UPDATE accounts
        SET totp_secret=pending_totp_secret,recovery_codes=pending_recovery_codes,
            pending_totp_secret=NULL,pending_recovery_codes=NULL
        WHERE id=? AND pending_totp_secret IS NOT NULL
      `).run(accountId);
    });
  }

  public disableTwoFactor(context: RepositoryExecutionContext, accountId: UserId): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        UPDATE accounts SET totp_secret=NULL,recovery_codes=NULL,
          pending_totp_secret=NULL,pending_recovery_codes=NULL WHERE id=?
      `).run(accountId);
    });
  }

  public updateRecoveryCodes(
    context: RepositoryExecutionContext,
    accountId: UserId,
    recoveryCodes: string
  ): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare('UPDATE accounts SET recovery_codes=? WHERE id=?')
        .run(recoveryCodes, accountId);
    });
  }

  public protectLegacyTwoFactorSecrets(
    context: RepositoryExecutionContext,
    input: ProtectLegacyTwoFactorSecretsInput
  ): RepositoryResult<boolean> {
    return this.execute(context, () => {
      const assignments: string[] = [];
      const parameters: unknown[] = [];
      const predicates = ['id=?'];
      const predicateParameters: unknown[] = [input.accountId];
      if (input.active) {
        assignments.push('totp_secret=?');
        parameters.push(input.active.protectedValue);
        predicates.push('totp_secret=?');
        predicateParameters.push(input.active.expectedPlaintext);
      }
      if (input.pending) {
        assignments.push('pending_totp_secret=?');
        parameters.push(input.pending.protectedValue);
        predicates.push('pending_totp_secret=?');
        predicateParameters.push(input.pending.expectedPlaintext);
      }
      if (assignments.length === 0) return false;
      const result = this.database(context).prepare(
        `UPDATE accounts SET ${assignments.join(',')} WHERE ${predicates.join(' AND ')}`
      ).run(...parameters, ...predicateParameters);
      return result.changes === 1;
    });
  }

}
