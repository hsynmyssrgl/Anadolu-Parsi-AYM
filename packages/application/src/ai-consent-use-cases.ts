import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type IsoDateTime,
  type Result,
  type UserId
} from '@ppt/core';
import type {
  AiAccessPreviewView,
  AiConsentView,
  FamilyRole,
  UpsertAiConsentInput
} from '@ppt/domain';

export interface AiConsentApplicationContext {
  readonly actor: {
    readonly userId: UserId;
    readonly role: FamilyRole;
    readonly personId?: string;
  };
  readonly correlationId: CorrelationId;
}

export interface AiConsentQueryPort {
  list(context: AiConsentApplicationContext): Result<readonly AiConsentView[], AppError>;
  preview(
    context: AiConsentApplicationContext,
    purpose: AiConsentView['purpose']
  ): Result<AiAccessPreviewView, AppError>;
}

export interface AiConsentWriteScope {
  readonly occurredAt: IsoDateTime;
  findIdentity(
    accountId: string,
    purpose: string,
    resourceType: string,
    resourceId: string
  ): Result<string | null, AppError>;
  upsert(row: AiConsentView): Result<void, AppError>;
  appendAudit(input: {
    id: string;
    action: string;
    resourceType: string;
    resourceId: string;
    occurredAt: IsoDateTime;
    actorId: UserId;
  }): Result<string, AppError>;
}

export interface AiConsentUnitOfWork {
  execute<T>(
    context: AiConsentApplicationContext,
    operation: (scope: AiConsentWriteScope) => Result<T, AppError>
  ): Result<T, AppError>;
}

const invalid = (
  context: AiConsentApplicationContext,
  message: string
): AppError => createAppError({
  code: ERROR_CODES.CORE_INVALID_ARGUMENT,
  message,
  category: 'validation',
  correlationId: context.correlationId
});

export class ListAiConsentsUseCase {
  public constructor(private readonly query: AiConsentQueryPort) {}

  public execute(context: AiConsentApplicationContext) {
    return this.query.list(context);
  }
}

export class PreviewAiAccessUseCase {
  public constructor(private readonly query: AiConsentQueryPort) {}

  public execute(
    context: AiConsentApplicationContext,
    purpose: AiConsentView['purpose']
  ) {
    return this.query.preview(context, purpose);
  }
}

export class UpsertAiConsentUseCase {
  public constructor(private readonly unitOfWork: AiConsentUnitOfWork) {}

  public execute(input: {
    context: AiConsentApplicationContext;
    command: UpsertAiConsentInput;
    identifiers: { consentId: string; auditId: string };
  }): Result<void, AppError> {
    const resourceType = input.command.resourceType.trim();
    const resourceId = input.command.resourceId.trim();
    if (!resourceType || !resourceId) {
      return err(invalid(input.context, 'Kaynak türü ve kimliği zorunludur.'));
    }
    if (!['granted', 'revoked'].includes(input.command.status)) {
      return err(invalid(input.context, 'AI izin durumu geçersizdir.'));
    }

    let requestedStartsAt: string | undefined;
    let endsAt: string | undefined;
    try {
      requestedStartsAt = input.command.startsAt
        ? new Date(input.command.startsAt).toISOString()
        : undefined;
      endsAt = input.command.endsAt
        ? new Date(input.command.endsAt).toISOString()
        : undefined;
    } catch {
      return err(invalid(input.context, 'AI izin tarihleri geçersizdir.'));
    }

    return this.unitOfWork.execute(input.context, (scope) => {
      const startsAt = requestedStartsAt ?? scope.occurredAt;
      if (endsAt && Date.parse(endsAt) < Date.parse(startsAt)) {
        return err(invalid(input.context, 'İzin bitişi başlangıçtan önce olamaz.'));
      }

      const identity = scope.findIdentity(
        input.context.actor.userId,
        input.command.purpose,
        resourceType,
        resourceId
      );
      if (!identity.ok) return identity;

      const id = identity.value ?? input.identifiers.consentId;
      const row: AiConsentView = {
        id,
        accountId: input.context.actor.userId,
        purpose: input.command.purpose,
        resourceType,
        resourceId,
        status: input.command.status,
        startsAt,
        ...(endsAt ? { endsAt } : {}),
        createdAt: scope.occurredAt
      };
      const saved = scope.upsert(row);
      if (!saved.ok) return saved;

      const audit = scope.appendAudit({
        id: input.identifiers.auditId,
        action: `ai.consent_${input.command.status}`,
        resourceType: 'ai_consent',
        resourceId: id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      return audit.ok ? ok(undefined) : audit;
    });
  }
}
