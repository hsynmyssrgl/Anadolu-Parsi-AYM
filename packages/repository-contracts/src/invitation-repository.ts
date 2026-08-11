import type { IsoDateTime, PersonId } from '@ppt/core';
import type { FamilyInvitationRevocationReason, FamilyInvitationView, FamilyRole } from '@ppt/domain';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface InvitationRecord {
  readonly id: string;
  readonly email: string;
  readonly role: FamilyRole;
  readonly personId?: PersonId;
  readonly startsAt: IsoDateTime;
  readonly endsAt?: IsoDateTime;
  readonly status: FamilyInvitationView['status'];
  readonly tokenHash: string;
  readonly createdAt: IsoDateTime;
  readonly acceptedAt?: IsoDateTime;
  readonly revokedAt?: IsoDateTime;
  readonly revocationReason?: FamilyInvitationRevocationReason;
  readonly resentFromInvitationId?: string;
  readonly supersededByInvitationId?: string;
}

export interface InvitationRepositoryPort {
    insert(context: RepositoryExecutionContext, invitation: InvitationRecord): RepositoryResult<void>;
    findById(context: RepositoryExecutionContext, invitationId: string): RepositoryResult<InvitationRecord | null>;
    findByTokenHash(context: RepositoryExecutionContext, tokenHash: string): RepositoryResult<InvitationRecord | null>;
    findPendingByEmail(context: RepositoryExecutionContext, email: string): RepositoryResult<InvitationRecord | null>;
    list(context: RepositoryExecutionContext): RepositoryResult<readonly InvitationRecord[]>;
    revokePending(context: RepositoryExecutionContext, invitationId: string, revokedAt: IsoDateTime, reason: FamilyInvitationRevocationReason, supersededByInvitationId?: string): RepositoryResult<boolean>;
    markAccepted(context: RepositoryExecutionContext, invitationId: string, acceptedAt: IsoDateTime): RepositoryResult<boolean>;
}
