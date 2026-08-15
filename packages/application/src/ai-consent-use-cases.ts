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
  AiConsentPurpose,
  AiConsentView,
  FamilyRole,
  SensitiveDataCategory,
  SensitiveDataConsentEffectiveStatus,
  SensitiveDataConsentPurpose,
  SensitiveDataProfileView,
  SensitiveExportPreviewInput,
  SensitiveExportPreviewView,
  UpsertSensitiveDataConsentInput,
  UpsertAiConsentInput
} from '@ppt/domain';
import { AI_CONSENT_PURPOSES, SENSITIVE_DATA_CATEGORIES } from '@ppt/domain';

const STANDARD_AI_CONSENT_RESOURCE_TYPES = Object.freeze([
  'person',
  'event',
  'archive_item',
  'finance_record',
  'health_record',
  'life_record',
  'local_ocr_job',
  'household_operation_item',
  'places_travel_item'
] as const);

export const SENSITIVE_DATA_PROFILE_RESOURCE_TYPE = 'sensitive_data_profile' as const;

export interface SensitiveDataInventoryProjection {
  readonly category: SensitiveDataCategory;
  readonly recordCount: number;
  readonly fieldNames: readonly string[];
}

const sensitiveProfileMetadata: Readonly<Record<SensitiveDataCategory, {
  readonly label: string;
  readonly description: string;
}>> = Object.freeze({
  child: Object.freeze({ label: 'Çocuk verileri', description: '18 yaş altı aile üyelerinin kimlik ve aile bağı bilgileri.' }),
  health: Object.freeze({ label: 'Sağlık verileri', description: 'Sağlık kayıtları, ilaç planları ve aile sağlık geçmişi.' }),
  finance: Object.freeze({ label: 'Finans verileri', description: 'Finans kayıtları, tutarlar ve değerleme bilgileri.' }),
  location: Object.freeze({ label: 'Konum verileri', description: 'Kayıtlı adresler, koordinatlar ve konum etiketleri.' })
});

const resolveSensitiveConsentState = (
  row: AiConsentView | undefined,
  purpose: SensitiveDataConsentPurpose,
  at: string
): SensitiveDataProfileView['aiProcessing'] => {
  if (!row) return { purpose, effectiveStatus: 'default_denied', visibleSharing: false };
  if (row.status !== 'granted' && row.status !== 'revoked') {
    return { purpose, effectiveStatus: 'default_denied', visibleSharing: false };
  }
  const startsAt = Date.parse(row.startsAt);
  const evaluatedAt = Date.parse(at);
  const endsAt = row.endsAt ? Date.parse(row.endsAt) : Number.NaN;
  if (!Number.isFinite(startsAt) || !Number.isFinite(evaluatedAt)) {
    return { purpose, effectiveStatus: 'default_denied', visibleSharing: false };
  }
  if (row.status === 'granted' && (
    !Number.isFinite(endsAt)
    || endsAt - startsAt < 15 * 60_000
    || endsAt - startsAt > 43_200 * 60_000
  )) {
    return { purpose, effectiveStatus: 'default_denied', visibleSharing: false };
  }
  let effectiveStatus: SensitiveDataConsentEffectiveStatus;
  if (row.status === 'revoked') effectiveStatus = 'revoked';
  else if (startsAt > evaluatedAt) effectiveStatus = 'scheduled';
  else if (endsAt < evaluatedAt) effectiveStatus = 'expired';
  else effectiveStatus = 'granted';
  return {
    purpose,
    effectiveStatus,
    visibleSharing: effectiveStatus === 'granted',
    startsAt: row.startsAt,
    ...(row.endsAt ? { endsAt: row.endsAt } : {}),
    consentId: row.id
  };
};

export const buildSensitiveDataProfiles = (
  consents: readonly AiConsentView[],
  at: string
): readonly SensitiveDataProfileView[] => SENSITIVE_DATA_CATEGORIES.map((category) => {
  const find = (purpose: SensitiveDataConsentPurpose): AiConsentView | undefined => consents.find((consent) =>
    consent.resourceType === SENSITIVE_DATA_PROFILE_RESOURCE_TYPE
    && consent.resourceId === category
    && consent.purpose === purpose
  );
  const metadata = sensitiveProfileMetadata[category];
  return Object.freeze({
    category,
    label: metadata.label,
    description: metadata.description,
    defaultDenied: true as const,
    aiProcessing: Object.freeze(resolveSensitiveConsentState(find('sensitive_processing'), 'sensitive_processing', at)),
    externalExport: Object.freeze(resolveSensitiveConsentState(find('external_export'), 'external_export', at))
  });
});

export const buildSensitiveExportPreview = (input: {
  readonly consents: readonly AiConsentView[];
  readonly inventory: readonly SensitiveDataInventoryProjection[];
  readonly request: SensitiveExportPreviewInput;
  readonly previewId: string;
  readonly generatedAt: string;
}): SensitiveExportPreviewView => {
  const profiles = buildSensitiveDataProfiles(input.consents, input.generatedAt);
  const categories = input.request.categories.map((category) => {
    const profile = profiles.find((candidate) => candidate.category === category)!;
    const inventory = input.inventory.find((candidate) => candidate.category === category);
    return {
      category,
      label: profile.label,
      effectiveStatus: profile.externalExport.effectiveStatus,
      approved: profile.externalExport.effectiveStatus === 'granted',
      recordCount: Math.max(0, Math.trunc(inventory?.recordCount ?? 0)),
      fieldNames: [...(inventory?.fieldNames ?? [])],
      ...(profile.externalExport.endsAt ? { consentEndsAt: profile.externalExport.endsAt } : {})
    };
  });
  const allApproved = categories.length > 0 && categories.every((category) => category.approved);
  return {
    previewId: input.previewId,
    destinationLabel: input.request.destinationLabel,
    businessPurpose: input.request.businessPurpose,
    categories,
    totalRecordCount: categories.reduce((total, category) => total + category.recordCount, 0),
    allApproved,
    transferAllowed: allApproved,
    outboundTransferPerformed: false,
    generatedAt: input.generatedAt,
    warning: allApproved
      ? 'Önizleme hazır. Bu işlem veri göndermedi; gerçek aktarım ayrıca açık kullanıcı eylemi ve yeniden politika kontrolü gerektirir.'
      : 'Aktarım kapalı. Seçilen her hassas kategori için süreli dışa gönderim onayı gerekir.'
  };
};

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
    purpose: AiConsentPurpose
  ): Result<AiAccessPreviewView, AppError>;
  listSensitiveProfiles(context: AiConsentApplicationContext): Result<readonly SensitiveDataProfileView[], AppError>;
  previewSensitiveExport(
    context: AiConsentApplicationContext,
    input: SensitiveExportPreviewInput,
    previewId: string
  ): Result<SensitiveExportPreviewView, AppError>;
}

export interface SensitiveDataAuthorizationPort {
  authorize(context: AiConsentApplicationContext): Result<void, AppError>;
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
    purpose: AiConsentPurpose
  ) {
    if (!AI_CONSENT_PURPOSES.includes(purpose)) {
      return err(invalid(context, 'Standart AI önizleme amacı geçersizdir.'));
    }
    return this.query.preview(context, purpose);
  }
}

export class ListSensitiveDataProfilesUseCase {
  public constructor(
    private readonly query: AiConsentQueryPort,
    private readonly authorization: SensitiveDataAuthorizationPort
  ) {}

  public execute(context: AiConsentApplicationContext): Result<readonly SensitiveDataProfileView[], AppError> {
    const authorized = this.authorization.authorize(context);
    if (!authorized.ok) return authorized;
    return this.query.listSensitiveProfiles(context);
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
    if (!AI_CONSENT_PURPOSES.includes(input.command.purpose)) {
      return err(invalid(input.context, 'Standart AI izin amacı geçersizdir.'));
    }
    if (!(STANDARD_AI_CONSENT_RESOURCE_TYPES as readonly string[]).includes(resourceType)) {
      return err(invalid(input.context, 'Standart AI izin kaynağı geçersizdir.'));
    }
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

export class UpsertSensitiveDataConsentUseCase {
  public constructor(
    private readonly unitOfWork: AiConsentUnitOfWork,
    private readonly authorization: SensitiveDataAuthorizationPort
  ) {}

  public execute(input: {
    context: AiConsentApplicationContext;
    command: UpsertSensitiveDataConsentInput;
    identifiers: { consentId: string; auditId: string };
  }): Result<void, AppError> {
    const authorized = this.authorization.authorize(input.context);
    if (!authorized.ok) return authorized;
    if (!SENSITIVE_DATA_CATEGORIES.includes(input.command.category)) {
      return err(invalid(input.context, 'Hassas veri kategorisi geçersizdir.'));
    }
    if (!['sensitive_processing', 'external_export'].includes(input.command.purpose)) {
      return err(invalid(input.context, 'Hassas veri kullanım amacı geçersizdir.'));
    }
    if (!['granted', 'revoked'].includes(input.command.status)) {
      return err(invalid(input.context, 'Hassas veri izin kararı geçersizdir.'));
    }
    if (input.command.status === 'granted') {
      if (input.command.explicitConsent !== true) {
        return err(invalid(input.context, 'Açık rıza onayı işaretlenmeden hassas veri izni verilemez.'));
      }
      if (!Number.isInteger(input.command.durationMinutes) || (input.command.durationMinutes ?? 0) < 15 || (input.command.durationMinutes ?? 0) > 43_200) {
        return err(invalid(input.context, 'Hassas veri izni 15 dakika ile 30 gün arasında süreli olmalıdır.'));
      }
    }

    return this.unitOfWork.execute(input.context, (scope) => {
      const identity = scope.findIdentity(
        input.context.actor.userId,
        input.command.purpose,
        SENSITIVE_DATA_PROFILE_RESOURCE_TYPE,
        input.command.category
      );
      if (!identity.ok) return identity;
      const id = identity.value ?? input.identifiers.consentId;
      const durationMinutes = input.command.durationMinutes ?? 0;
      const endsAt = input.command.status === 'granted'
        ? new Date(Date.parse(scope.occurredAt) + durationMinutes * 60_000).toISOString()
        : undefined;
      const row: AiConsentView = {
        id,
        accountId: input.context.actor.userId,
        purpose: input.command.purpose,
        resourceType: SENSITIVE_DATA_PROFILE_RESOURCE_TYPE,
        resourceId: input.command.category,
        status: input.command.status,
        startsAt: scope.occurredAt,
        ...(endsAt ? { endsAt } : {}),
        createdAt: scope.occurredAt
      };
      const saved = scope.upsert(row);
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({
        id: input.identifiers.auditId,
        action: `ai.sensitive_consent_${input.command.status}`,
        resourceType: SENSITIVE_DATA_PROFILE_RESOURCE_TYPE,
        resourceId: `${input.command.category}:${input.command.purpose}`,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      return audit.ok ? ok(undefined) : audit;
    });
  }
}

export class PreviewSensitiveExportUseCase {
  public constructor(
    private readonly query: AiConsentQueryPort,
    private readonly unitOfWork: AiConsentUnitOfWork,
    private readonly authorization: SensitiveDataAuthorizationPort
  ) {}

  public execute(input: {
    context: AiConsentApplicationContext;
    command: SensitiveExportPreviewInput;
    identifiers: { previewId: string; auditId: string };
  }): Result<SensitiveExportPreviewView, AppError> {
    const authorized = this.authorization.authorize(input.context);
    if (!authorized.ok) return authorized;
    const destinationLabel = typeof input.command.destinationLabel === 'string' ? input.command.destinationLabel.trim() : '';
    const businessPurpose = typeof input.command.businessPurpose === 'string' ? input.command.businessPurpose.trim() : '';
    const categories = [...new Set(Array.isArray(input.command.categories) ? input.command.categories : [])];
    if (categories.length === 0 || categories.some((category) => !SENSITIVE_DATA_CATEGORIES.includes(category))) {
      return err(invalid(input.context, 'En az bir geçerli hassas veri kategorisi seçilmelidir.'));
    }
    if (destinationLabel.length < 3 || destinationLabel.length > 100) {
      return err(invalid(input.context, 'Hedef açıklaması 3 ile 100 karakter arasında olmalıdır.'));
    }
    if (businessPurpose.length < 10 || businessPurpose.length > 240) {
      return err(invalid(input.context, 'Dışa gönderim amacı 10 ile 240 karakter arasında olmalıdır.'));
    }
    const preview = this.query.previewSensitiveExport(input.context, {
      categories,
      destinationLabel,
      businessPurpose
    }, input.identifiers.previewId);
    if (!preview.ok) return preview;
    const audited = this.unitOfWork.execute(input.context, (scope) => scope.appendAudit({
      id: input.identifiers.auditId,
      action: 'ai.sensitive_export_previewed',
      resourceType: 'sensitive_export_preview',
      resourceId: input.identifiers.previewId,
      occurredAt: scope.occurredAt,
      actorId: input.context.actor.userId
    }));
    if (!audited.ok) return err(audited.error);
    return ok(preview.value);
  }
}
