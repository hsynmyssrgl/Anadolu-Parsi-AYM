import {
  ERROR_CODES,
  asIsoDateTime,
  asPersonId,
  asUserId,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type EventId,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import {
  assessPassword,
  type AcceptFamilyInvitationInput,
  type CreateFamilyInvitationInput,
  type FamilyAccountView,
  type FamilyInvitationInspectionView,
  type FamilyInvitationRevocationReason,
  type FamilyInvitationView,
  type FamilyRole,
  type InspectFamilyInvitationInput,
  type ResendFamilyInvitationInput,
  type UpdateFamilyAccountInput
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import { isAdministrativeRole } from '@ppt/security';

export interface MembershipApplicationContext { readonly correlationId: CorrelationId; }

export interface MembershipInvitationRecord {
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

export interface MembershipAccountRecord {
  readonly id: UserId;
  readonly displayName: string;
  readonly email: string;
  readonly role: FamilyRole;
  readonly status: FamilyAccountView['status'];
  readonly personId?: PersonId;
  readonly startsAt: IsoDateTime;
  readonly endsAt?: IsoDateTime;
  readonly createdAt: IsoDateTime;
}

export interface MembershipQueryPort {
  list(context: MembershipApplicationContext): Result<readonly MembershipInvitationRecord[], AppError>;
  findInvitationByTokenHash(context: MembershipApplicationContext, tokenHash: string): Result<MembershipInvitationRecord | null, AppError>;
  listAccounts(context: MembershipApplicationContext, actorId: UserId): Result<readonly MembershipAccountRecord[], AppError>;
}

export interface MembershipWriteScope {
  readonly occurredAt: IsoDateTime;
  findAccountByEmail(email: string): Result<MembershipAccountRecord | null, AppError>;
  findAccount(accountId: UserId): Result<MembershipAccountRecord | null, AppError>;
  findPerson(personId: PersonId): Result<{ readonly id: PersonId } | null, AppError>;
  findPendingInvitationByEmail(email: string): Result<MembershipInvitationRecord | null, AppError>;
  findInvitationById(invitationId: string): Result<MembershipInvitationRecord | null, AppError>;
  findInvitationByTokenHash(tokenHash: string): Result<MembershipInvitationRecord | null, AppError>;
  insertInvitation(invitation: MembershipInvitationRecord): Result<void, AppError>;
  revokeInvitation(invitationId: string, revokedAt: IsoDateTime, reason: FamilyInvitationRevocationReason, supersededByInvitationId?: string): Result<boolean, AppError>;
  acceptInvitation(invitationId: string, acceptedAt: IsoDateTime): Result<boolean, AppError>;
  updateAccount(input: { readonly accountId: UserId; readonly role: FamilyRole; readonly status: FamilyAccountView['status']; readonly personId?: PersonId; readonly startsAt: IsoDateTime; readonly endsAt?: IsoDateTime }): Result<boolean, AppError>;
  insertAccount(input: {
    readonly id: UserId;
    readonly displayName: string;
    readonly email: string;
    readonly passwordRecord: string;
    readonly role: FamilyRole;
    readonly status: string;
    readonly personId?: PersonId;
    readonly startsAt: IsoDateTime;
    readonly endsAt?: IsoDateTime;
    readonly createdAt: IsoDateTime;
  }): Result<void, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: IsoDateTime;
    readonly actorId: UserId;
  }): Result<string, AppError>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError>;
}

export interface MembershipUnitOfWork {
  execute<T>(
    context: MembershipApplicationContext,
    actorId: UserId,
    operation: (scope: MembershipWriteScope) => Result<T, AppError>
  ): Result<T, AppError>;
}

export interface InvitationTokenService {
  issue(): { readonly token: string; readonly tokenHash: string };
  hash(token: string): string;
}

export interface MembershipPasswordService { hash(password: string): string; }

export interface MembershipIdentifiers {
  readonly invitationId: string;
  readonly auditId: string;
  readonly outboxEventId: EventId;
}

const validation = (correlationId: CorrelationId, message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_INVALID_ARGUMENT,
  message,
  category: 'validation',
  correlationId
});
const conflict = (correlationId: CorrelationId, message: string): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_CONFLICT,
  message,
  category: 'conflict',
  correlationId
});
const notFound = (correlationId: CorrelationId, message: string): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_NOT_FOUND,
  message,
  category: 'not_found',
  correlationId
});
const authentication = (correlationId: CorrelationId, message: string): AppError => createAppError({
  code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
  message,
  category: 'authentication',
  correlationId
});

const validEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email);
const inviteRoles: readonly FamilyRole[] = ['adult_member', 'limited_member', 'caregiver', 'advisor'];

const toView = (invitation: MembershipInvitationRecord, occurredAt: IsoDateTime): FamilyInvitationView => {
  const expired = invitation.status === 'pending'
    && Boolean(invitation.endsAt)
    && Date.parse(invitation.endsAt as string) < Date.parse(occurredAt);
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    ...(invitation.personId ? { personId: invitation.personId } : {}),
    startsAt: invitation.startsAt,
    ...(invitation.endsAt ? { endsAt: invitation.endsAt } : {}),
    status: expired ? 'expired' : invitation.status,
    createdAt: invitation.createdAt,
    ...(invitation.acceptedAt ? { acceptedAt: invitation.acceptedAt } : {}),
    ...(invitation.revokedAt ? { revokedAt: invitation.revokedAt } : {}),
    ...(invitation.revocationReason ? { revocationReason: invitation.revocationReason } : {}),
    ...(invitation.resentFromInvitationId ? { resentFromInvitationId: invitation.resentFromInvitationId } : {}),
    ...(invitation.supersededByInvitationId ? { supersededByInvitationId: invitation.supersededByInvitationId } : {})
  };
};

const inspectInvitation = (invitation: MembershipInvitationRecord | null, occurredAt: IsoDateTime): FamilyInvitationInspectionView => {
  if (!invitation) return { resolution: 'invalid', canAccept: false, message: 'Davet kodu geçersiz.' };
  if (invitation.status === 'accepted') return { resolution: 'used', canAccept: false, message: 'Davet daha önce kullanılmış.' };
  if (invitation.status === 'revoked') return { resolution: 'revoked', canAccept: false, message: invitation.revocationReason === 'resent' ? 'Bu davet yerine yeni bir kod gönderilmiş.' : 'Davet iptal edilmiş.' };
  if (invitation.endsAt && Date.parse(invitation.endsAt) < Date.parse(occurredAt)) return { resolution: 'expired', canAccept: false, message: 'Davetin süresi dolmuş. Yeni kod isteyin.', startsAt: invitation.startsAt, endsAt: invitation.endsAt };
  if (Date.parse(invitation.startsAt) > Date.parse(occurredAt)) return { resolution: 'not_yet_active', canAccept: false, message: 'Davet henüz etkin değil.', startsAt: invitation.startsAt, ...(invitation.endsAt ? { endsAt: invitation.endsAt } : {}) };
  return { resolution: 'ready', canAccept: true, message: 'Davet kullanıma hazır.', startsAt: invitation.startsAt, ...(invitation.endsAt ? { endsAt: invitation.endsAt } : {}) };
};


const toAccountView = (account: MembershipAccountRecord): FamilyAccountView => ({
  id: account.id,
  displayName: account.displayName,
  email: account.email,
  role: account.role,
  status: account.status,
  ...(account.personId ? { personId: account.personId } : {}),
  startsAt: account.startsAt,
  ...(account.endsAt ? { endsAt: account.endsAt } : {}),
  createdAt: account.createdAt
});

export class ListFamilyAccountsUseCase {
  public constructor(private readonly query: MembershipQueryPort) {}
  public execute(context: MembershipApplicationContext, actorId: UserId): Result<readonly FamilyAccountView[], AppError> {
    const accounts = this.query.listAccounts(context, actorId);
    return accounts.ok ? ok(accounts.value.map(toAccountView)) : accounts;
  }
}

export class UpdateFamilyAccountUseCase {
  public constructor(private readonly unitOfWork: MembershipUnitOfWork) {}
  public execute(input: {
    readonly context: MembershipApplicationContext;
    readonly actorId: UserId;
    readonly command: UpdateFamilyAccountInput;
    readonly auditId: string;
    readonly outboxEventId: EventId;
  }): Result<void, AppError> {
    const starts = input.command.startsAt ? new Date(input.command.startsAt) : undefined;
    const ends = input.command.endsAt ? new Date(input.command.endsAt) : undefined;
    if ((starts && Number.isNaN(starts.getTime())) || (ends && Number.isNaN(ends.getTime()))) {
      return err(validation(input.context.correlationId, 'Üyelik tarihleri geçersiz.'));
    }
    return this.unitOfWork.execute(input.context, input.actorId, (scope) => {
      const actor = scope.findAccount(input.actorId);
      if (!actor.ok) return actor;
      if (!actor.value || !isAdministrativeRole(actor.value.role) || actor.value.status !== 'active') {
        return err(createAppError({ code: ERROR_CODES.AUTHORIZATION_DENIED, message: 'Bu işlem aile yöneticisi yetkisi gerektirir.', category: 'authorization', correlationId: input.context.correlationId }));
      }
      const targetId = asUserId(input.command.accountId);
      const target = scope.findAccount(targetId);
      if (!target.ok) return target;
      if (!target.value) return err(notFound(input.context.correlationId, 'Hesap bulunamadı.'));
      if (targetId === input.actorId && (!isAdministrativeRole(input.command.role) || input.command.status !== 'active')) {
        return err(validation(input.context.correlationId, 'Kendi yönetici hesabınızı devre dışı bırakamazsınız.'));
      }
      const normalizedStarts = asIsoDateTime((starts ?? new Date(scope.occurredAt)).toISOString());
      const normalizedEnds = ends ? asIsoDateTime(ends.toISOString()) : undefined;
      if (normalizedEnds && Date.parse(normalizedEnds) <= Date.parse(normalizedStarts)) {
        return err(validation(input.context.correlationId, 'Üyelik bitiş tarihi başlangıçtan sonra olmalıdır.'));
      }
      let personId: PersonId | undefined;
      if (input.command.personId) {
        personId = asPersonId(input.command.personId);
        const person = scope.findPerson(personId);
        if (!person.ok) return person;
        if (!person.value) return err(notFound(input.context.correlationId, 'Bağlanacak aile üyesi bulunamadı.'));
      }
      const updated = scope.updateAccount({ accountId: targetId, role: input.command.role, status: input.command.status, ...(personId ? { personId } : {}), startsAt: normalizedStarts, ...(normalizedEnds ? { endsAt: normalizedEnds } : {}) });
      if (!updated.ok) return updated;
      if (!updated.value) return err(notFound(input.context.correlationId, 'Hesap bulunamadı.'));
      const audit = scope.appendAudit({ id: input.auditId, action: 'membership.updated', resourceType: 'account', resourceId: targetId, occurredAt: scope.occurredAt, actorId: input.actorId });
      if (!audit.ok) return audit;
      return scope.enqueueEvent({ eventId: input.outboxEventId, eventType: 'membership.account.updated', eventVersion: 1, aggregateType: 'account', aggregateId: targetId, occurredAt: scope.occurredAt, correlationId: input.context.correlationId, actorId: input.actorId, payload: { accountId: targetId, role: input.command.role, status: input.command.status, personId: personId ?? null, startsAt: normalizedStarts, endsAt: normalizedEnds ?? null } });
    });
  }
}

export class ListFamilyInvitationsUseCase {
  public constructor(private readonly query: MembershipQueryPort) {}
  public execute(context: MembershipApplicationContext, occurredAt: IsoDateTime): Result<readonly FamilyInvitationView[], AppError> {
    const invitations = this.query.list(context);
    return invitations.ok ? ok(invitations.value.map((item) => toView(item, occurredAt))) : invitations;
  }
}

export class InspectFamilyInvitationUseCase {
  public constructor(private readonly query: MembershipQueryPort, private readonly tokens: InvitationTokenService) {}
  public execute(context: MembershipApplicationContext, input: InspectFamilyInvitationInput, occurredAt: IsoDateTime): Result<FamilyInvitationInspectionView, AppError> {
    const token = input.token.trim();
    if (!token) return ok(inspectInvitation(null, occurredAt));
    const invitation = this.query.findInvitationByTokenHash(context, this.tokens.hash(token));
    return invitation.ok ? ok(inspectInvitation(invitation.value, occurredAt)) : invitation;
  }
}

export class CreateFamilyInvitationUseCase {
  public constructor(private readonly unitOfWork: MembershipUnitOfWork, private readonly tokens: InvitationTokenService) {}
  public execute(input: {
    readonly context: MembershipApplicationContext;
    readonly actorId: UserId;
    readonly command: CreateFamilyInvitationInput;
    readonly identifiers: MembershipIdentifiers;
  }): Result<{ readonly invitation: FamilyInvitationView; readonly token: string }, AppError> {
    const email = input.command.email.trim().toLowerCase();
    if (!validEmail(email)) return err(validation(input.context.correlationId, 'Geçerli e-posta adresi gereklidir.'));
    if (!inviteRoles.includes(input.command.role)) return err(validation(input.context.correlationId, 'Bu rol için davet oluşturulamaz.'));
    const startsAt = input.command.startsAt ? new Date(input.command.startsAt) : undefined;
    const endsAt = input.command.endsAt ? new Date(input.command.endsAt) : undefined;
    if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) {
      return err(validation(input.context.correlationId, 'Davet tarihleri geçersiz.'));
    }
    const token = this.tokens.issue();
    return this.unitOfWork.execute(input.context, input.actorId, (scope) => {
      const normalizedStartsAt = asIsoDateTime((startsAt ?? new Date(scope.occurredAt)).toISOString());
      const normalizedEndsAt = endsAt ? asIsoDateTime(endsAt.toISOString()) : undefined;
      if (normalizedEndsAt && Date.parse(normalizedEndsAt) <= Date.parse(normalizedStartsAt)) {
        return err(validation(input.context.correlationId, 'Davet bitiş tarihi başlangıçtan sonra olmalıdır.'));
      }
      const account = scope.findAccountByEmail(email);
      if (!account.ok) return account;
      if (account.value) return err(conflict(input.context.correlationId, 'Bu e-posta için zaten hesap var.'));
      const existing = scope.findPendingInvitationByEmail(email);
      if (!existing.ok) return existing;
      if (existing.value) return err(conflict(input.context.correlationId, 'Bu e-posta için bekleyen bir davet zaten var.'));
      let personId: PersonId | undefined;
      if (input.command.personId) {
        personId = asPersonId(input.command.personId);
        const person = scope.findPerson(personId);
        if (!person.ok) return person;
        if (!person.value) return err(notFound(input.context.correlationId, 'Davete bağlanacak aile üyesi bulunamadı.'));
      }
      const invitation: MembershipInvitationRecord = {
        id: input.identifiers.invitationId,
        email,
        role: input.command.role,
        ...(personId ? { personId } : {}),
        startsAt: normalizedStartsAt,
        ...(normalizedEndsAt ? { endsAt: normalizedEndsAt } : {}),
        status: 'pending',
        tokenHash: token.tokenHash,
        createdAt: scope.occurredAt
      };
      const saved = scope.insertInvitation(invitation);
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({ id: input.identifiers.auditId, action: 'invitation.created', resourceType: 'invitation', resourceId: invitation.id, occurredAt: scope.occurredAt, actorId: input.actorId });
      if (!audit.ok) return audit;
      const queued = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'membership.invitation.created',
        eventVersion: 1,
        aggregateType: 'invitation',
        aggregateId: invitation.id,
        occurredAt: scope.occurredAt,
        correlationId: input.context.correlationId,
        actorId: input.actorId,
        payload: { invitationId: invitation.id, email, role: invitation.role, personId: invitation.personId ?? null, startsAt: invitation.startsAt, endsAt: invitation.endsAt ?? null }
      });
      return queued.ok ? ok({ invitation: toView(invitation, scope.occurredAt), token: token.token }) : queued;
    });
  }
}

export class RevokeFamilyInvitationUseCase {
  public constructor(private readonly unitOfWork: MembershipUnitOfWork) {}
  public execute(input: { readonly context: MembershipApplicationContext; readonly actorId: UserId; readonly invitationId: string; readonly auditId: string; readonly outboxEventId: EventId }): Result<void, AppError> {
    return this.unitOfWork.execute(input.context, input.actorId, (scope) => {
      const revoked = scope.revokeInvitation(input.invitationId, scope.occurredAt, 'manual');
      if (!revoked.ok) return revoked;
      if (!revoked.value) return err(notFound(input.context.correlationId, 'Bekleyen davet bulunamadı.'));
      const audit = scope.appendAudit({ id: input.auditId, action: 'invitation.revoked', resourceType: 'invitation', resourceId: input.invitationId, occurredAt: scope.occurredAt, actorId: input.actorId });
      if (!audit.ok) return audit;
      return scope.enqueueEvent({
        eventId: input.outboxEventId,
        eventType: 'membership.invitation.revoked',
        eventVersion: 1,
        aggregateType: 'invitation',
        aggregateId: input.invitationId,
        occurredAt: scope.occurredAt,
        correlationId: input.context.correlationId,
        actorId: input.actorId,
        payload: { invitationId: input.invitationId }
      });
    });
  }
}

export class ResendFamilyInvitationUseCase {
  public constructor(private readonly unitOfWork: MembershipUnitOfWork, private readonly tokens: InvitationTokenService) {}
  public execute(input: {
    readonly context: MembershipApplicationContext;
    readonly actorId: UserId;
    readonly command: ResendFamilyInvitationInput;
    readonly identifiers: MembershipIdentifiers;
  }): Result<{ readonly invitation: FamilyInvitationView; readonly token: string }, AppError> {
    const startsAt = input.command.startsAt ? new Date(input.command.startsAt) : undefined;
    const endsAt = input.command.endsAt ? new Date(input.command.endsAt) : undefined;
    if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) {
      return err(validation(input.context.correlationId, 'Davet tarihleri geçersiz.'));
    }
    const issued = this.tokens.issue();
    return this.unitOfWork.execute(input.context, input.actorId, (scope) => {
      const previous = scope.findInvitationById(input.command.invitationId);
      if (!previous.ok) return previous;
      if (!previous.value) return err(notFound(input.context.correlationId, 'Yeniden gönderilecek davet bulunamadı.'));
      if (previous.value.status === 'accepted') return err(conflict(input.context.correlationId, 'Kullanılmış davet yeniden gönderilemez.'));
      if (previous.value.supersededByInvitationId) return err(conflict(input.context.correlationId, 'Bu davet için daha önce yeni bir kod gönderilmiş.'));
      const account = scope.findAccountByEmail(previous.value.email);
      if (!account.ok) return account;
      if (account.value) return err(conflict(input.context.correlationId, 'Bu davetin e-posta adresi için hesap zaten var.'));
      const pending = scope.findPendingInvitationByEmail(previous.value.email);
      if (!pending.ok) return pending;
      if (pending.value && pending.value.id !== previous.value.id) return err(conflict(input.context.correlationId, 'Bu e-posta için daha yeni bekleyen bir davet var.'));
      const normalizedStartsAt = asIsoDateTime((startsAt ?? new Date(scope.occurredAt)).toISOString());
      const normalizedEndsAt = asIsoDateTime((endsAt ?? new Date(Date.parse(normalizedStartsAt) + 7 * 24 * 60 * 60 * 1000)).toISOString());
      if (Date.parse(normalizedEndsAt) <= Date.parse(normalizedStartsAt)) {
        return err(validation(input.context.correlationId, 'Davet bitiş tarihi başlangıçtan sonra olmalıdır.'));
      }
      const invitation: MembershipInvitationRecord = {
        id: input.identifiers.invitationId,
        email: previous.value.email,
        role: previous.value.role,
        ...(previous.value.personId ? { personId: previous.value.personId } : {}),
        startsAt: normalizedStartsAt,
        endsAt: normalizedEndsAt,
        status: 'pending',
        tokenHash: issued.tokenHash,
        createdAt: scope.occurredAt,
        resentFromInvitationId: previous.value.id
      };
      const superseded = scope.revokeInvitation(previous.value.id, scope.occurredAt, 'resent', invitation.id);
      if (!superseded.ok) return superseded;
      if (!superseded.value) return err(conflict(input.context.correlationId, 'Davet başka bir işlem tarafından değiştirilmiş.'));
      const saved = scope.insertInvitation(invitation);
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({ id: input.identifiers.auditId, action: 'invitation.resent', resourceType: 'invitation', resourceId: invitation.id, occurredAt: scope.occurredAt, actorId: input.actorId });
      if (!audit.ok) return audit;
      const queued = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,
        eventType: 'membership.invitation.resent',
        eventVersion: 1,
        aggregateType: 'invitation',
        aggregateId: invitation.id,
        occurredAt: scope.occurredAt,
        correlationId: input.context.correlationId,
        actorId: input.actorId,
        payload: { invitationId: invitation.id, previousInvitationId: previous.value.id, email: invitation.email, startsAt: invitation.startsAt, endsAt: invitation.endsAt }
      });
      return queued.ok ? ok({ invitation: toView(invitation, scope.occurredAt), token: issued.token }) : queued;
    });
  }
}

export class AcceptFamilyInvitationUseCase {
  public constructor(
    private readonly unitOfWork: MembershipUnitOfWork,
    private readonly tokens: InvitationTokenService,
    private readonly passwords: MembershipPasswordService
  ) {}
  public execute(input: {
    readonly context: MembershipApplicationContext;
    readonly command: AcceptFamilyInvitationInput;
    readonly accountId: UserId;
    readonly auditId: string;
    readonly outboxEventId: EventId;
  }): Result<UserId, AppError> {
    const displayName = input.command.displayName.trim();
    if (displayName.length < 2 || displayName.length > 120) return err(validation(input.context.correlationId, 'Ad soyad 2 ile 120 karakter arasında olmalıdır.'));
    const passwordAssessment = assessPassword(input.command.password, 12);
    if (!passwordAssessment.valid) return err(validation(input.context.correlationId, 'Parola güvenlik koşullarını karşılamıyor.'));
    const tokenHash = this.tokens.hash(input.command.token.trim());
    return this.unitOfWork.execute(input.context, asUserId('anonymous-invitation-acceptance'), (scope) => {
      const invitation = scope.findInvitationByTokenHash(tokenHash);
      if (!invitation.ok) return invitation;
      const inspection = inspectInvitation(invitation.value, scope.occurredAt);
      if (!inspection.canAccept || !invitation.value) return err(authentication(input.context.correlationId, inspection.message));
      const account = scope.findAccountByEmail(invitation.value.email);
      if (!account.ok) return account;
      if (account.value) return err(conflict(input.context.correlationId, 'Bu davet e-postası için hesap zaten oluşturulmuş.'));
      const inserted = scope.insertAccount({
        id: input.accountId,
        displayName,
        email: invitation.value.email,
        passwordRecord: this.passwords.hash(input.command.password),
        role: invitation.value.role,
        status: 'active',
        ...(invitation.value.personId ? { personId: invitation.value.personId } : {}),
        startsAt: invitation.value.startsAt,
        ...(invitation.value.endsAt ? { endsAt: invitation.value.endsAt } : {}),
        createdAt: scope.occurredAt
      });
      if (!inserted.ok) return inserted;
      const accepted = scope.acceptInvitation(invitation.value.id, scope.occurredAt);
      if (!accepted.ok) return accepted;
      if (!accepted.value) return err(conflict(input.context.correlationId, 'Davet başka bir işlem tarafından kullanıldı.'));
      const audit = scope.appendAudit({ id: input.auditId, action: 'invitation.accepted', resourceType: 'invitation', resourceId: invitation.value.id, occurredAt: scope.occurredAt, actorId: input.accountId });
      if (!audit.ok) return audit;
      const queued = scope.enqueueEvent({
        eventId: input.outboxEventId,
        eventType: 'membership.invitation.accepted',
        eventVersion: 1,
        aggregateType: 'account',
        aggregateId: input.accountId,
        occurredAt: scope.occurredAt,
        correlationId: input.context.correlationId,
        actorId: input.accountId,
        payload: { invitationId: invitation.value.id, accountId: input.accountId, email: invitation.value.email, role: invitation.value.role, personId: invitation.value.personId ?? null }
      });
      return queued.ok ? ok(input.accountId) : queued;
    });
  }
}
