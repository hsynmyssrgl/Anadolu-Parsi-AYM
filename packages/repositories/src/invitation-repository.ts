import type { InvitationRecord, InvitationRepositoryPort } from '@ppt/repository-contracts';
import { asIsoDateTime, asPersonId, asUserId, type IsoDateTime, type PersonId, type UserId } from '@ppt/core';
import type { FamilyInvitationView, FamilyRole } from '@ppt/domain';
import type { RepositoryResult } from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';

const mapInvitation = (row: Record<string, unknown>): InvitationRecord => ({
  id: String(row.id),
  email: String(row.email),
  role: String(row.role) as FamilyRole,
  ...(row.person_id ? { personId: asPersonId(String(row.person_id)) } : {}),
  startsAt: asIsoDateTime(String(row.starts_at)),
  ...(row.ends_at ? { endsAt: asIsoDateTime(String(row.ends_at)) } : {}),
  status: String(row.status) as FamilyInvitationView['status'],
  tokenHash: String(row.token_hash),
  createdAt: asIsoDateTime(String(row.created_at)),
  ...(row.accepted_at ? { acceptedAt: asIsoDateTime(String(row.accepted_at)) } : {}),
  ...(row.revoked_at ? { revokedAt: asIsoDateTime(String(row.revoked_at)) } : {}),
  ...(row.revocation_reason ? { revocationReason: String(row.revocation_reason) as import('@ppt/domain').FamilyInvitationRevocationReason } : {}),
  ...(row.resent_from_invitation_id ? { resentFromInvitationId: String(row.resent_from_invitation_id) } : {}),
  ...(row.superseded_by_invitation_id ? { supersededByInvitationId: String(row.superseded_by_invitation_id) } : {})
});

export class SqliteInvitationRepository extends SqliteRepository implements InvitationRepositoryPort {
  public insert(context: RepositoryExecutionContext, invitation: InvitationRecord): RepositoryResult<void> {
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO invitations(
          id,email,role,person_id,starts_at,ends_at,status,token_hash,created_at,accepted_at,
          revoked_at,revocation_reason,resent_from_invitation_id,superseded_by_invitation_id
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        invitation.id,
        invitation.email,
        invitation.role,
        invitation.personId ?? null,
        invitation.startsAt,
        invitation.endsAt ?? null,
        invitation.status,
        invitation.tokenHash,
        invitation.createdAt,
        invitation.acceptedAt ?? null,
        invitation.revokedAt ?? null,
        invitation.revocationReason ?? null,
        invitation.resentFromInvitationId ?? null,
        invitation.supersededByInvitationId ?? null
      );
    });
  }

  public findById(context: RepositoryExecutionContext, invitationId: string): RepositoryResult<InvitationRecord | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,email,role,person_id,starts_at,ends_at,status,token_hash,created_at,accepted_at,
               revoked_at,revocation_reason,resent_from_invitation_id,superseded_by_invitation_id
        FROM invitations WHERE id=?
      `).get(invitationId) as Record<string, unknown> | undefined;
      return row ? mapInvitation(row) : null;
    });
  }

  public findByTokenHash(context: RepositoryExecutionContext, tokenHash: string): RepositoryResult<InvitationRecord | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,email,role,person_id,starts_at,ends_at,status,token_hash,created_at,accepted_at,
               revoked_at,revocation_reason,resent_from_invitation_id,superseded_by_invitation_id
        FROM invitations WHERE token_hash=?
      `).get(tokenHash) as Record<string, unknown> | undefined;
      return row ? mapInvitation(row) : null;
    });
  }

  public findPendingByEmail(context: RepositoryExecutionContext, email: string): RepositoryResult<InvitationRecord | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,email,role,person_id,starts_at,ends_at,status,token_hash,created_at,accepted_at,
               revoked_at,revocation_reason,resent_from_invitation_id,superseded_by_invitation_id
        FROM invitations WHERE email=? AND status='pending' ORDER BY created_at DESC LIMIT 1
      `).get(email) as Record<string, unknown> | undefined;
      return row ? mapInvitation(row) : null;
    });
  }

  public list(context: RepositoryExecutionContext): RepositoryResult<readonly InvitationRecord[]> {
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT id,email,role,person_id,starts_at,ends_at,status,token_hash,created_at,accepted_at,
               revoked_at,revocation_reason,resent_from_invitation_id,superseded_by_invitation_id
        FROM invitations ORDER BY created_at DESC,id
      `).all() as ReadonlyArray<Record<string, unknown>>
    ).map(mapInvitation));
  }

  public revokePending(context: RepositoryExecutionContext, invitationId: string, revokedAt: IsoDateTime, reason: import('@ppt/domain').FamilyInvitationRevocationReason, supersededByInvitationId?: string): RepositoryResult<boolean> {
    return this.execute(context, () => Number(
      this.database(context).prepare(`
        UPDATE invitations
        SET status='revoked',revoked_at=?,revocation_reason=?,superseded_by_invitation_id=COALESCE(?,superseded_by_invitation_id)
        WHERE id=? AND status IN ('pending','expired','revoked') AND accepted_at IS NULL AND superseded_by_invitation_id IS NULL
      `).run(revokedAt, reason, supersededByInvitationId ?? null, invitationId).changes
    ) === 1);
  }

  public markAccepted(context: RepositoryExecutionContext, invitationId: string, acceptedAt: IsoDateTime): RepositoryResult<boolean> {
    return this.execute(context, () => Number(
      this.database(context).prepare("UPDATE invitations SET status='accepted',accepted_at=? WHERE id=? AND status='pending'")
        .run(acceptedAt, invitationId).changes
    ) === 1);
  }
}
