import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  asFamilyId,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import {
  UNIVERSAL_UX_MODES,
  assessWindowsResilienceEvidence,
  evaluatePolicyWeakening,
  isSafeUniversalUxIdentifier,
  isUniversalUxPreferencesView,
  searchUniversalUx,
  type PolicyWeakeningProposalInput,
  type PolicyWeakeningVerificationView,
  type UniversalSearchCandidate,
  type UniversalSearchResultView,
  type UniversalUxMode,
  type UniversalUxPreferencesView,
  type WindowsResilienceEvidenceObservation
} from '@ppt/domain';
import type {
  PolicyWeakeningProposalRow,
  RepositoryResult,
  UniversalUxOperationRow,
  WindowsResilienceEvidenceRow,
  WindowsResilienceUniversalUxKey
} from '@ppt/repository-contracts';
import type { LifeApplicationContext, LifePolicyIntent } from './life-use-cases.js';

export interface WindowsResilienceUniversalUxWriteScope {
  readonly key: WindowsResilienceUniversalUxKey;
  readonly occurredAt: string;
  loadPreferences(): RepositoryResult<UniversalUxPreferencesView | null>;
  findOperation(clientOperationId: string): RepositoryResult<UniversalUxOperationRow | null>;
  savePreferences(
    preferences: UniversalUxPreferencesView,
    operation: UniversalUxOperationRow,
    expectedRevision: number
  ): RepositoryResult<void>;
  appendPolicyProposal(proposal: PolicyWeakeningProposalRow, operation: UniversalUxOperationRow): RepositoryResult<void>;
  appendResilienceEvidence(evidence: WindowsResilienceEvidenceRow, operation: UniversalUxOperationRow): RepositoryResult<void>;
}

export interface WindowsResilienceUniversalUxUnitOfWork {
  execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: WindowsResilienceUniversalUxWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

export interface UniversalUxSearchAuthorityPort {
  readonly configured: boolean;
  readonly productionVerified: boolean;
  readonly providerId: string;
  searchAuthorized(input: {
    readonly context: LifeApplicationContext;
    readonly query: string;
    readonly limit: number;
  }): Promise<{
    readonly candidates: readonly UniversalSearchCandidate[];
    readonly providerEvidenceSha256: string;
    readonly networkUsed: boolean;
  }>;
}

export interface PolicyWeakeningEvidenceVerifierPort {
  readonly configured: boolean;
  readonly productionVerified: boolean;
  readonly providerId: string;
  verify(input: {
    readonly context: LifeApplicationContext;
    readonly proposal: PolicyWeakeningProposalInput;
  }): Promise<PolicyWeakeningVerificationView>;
}

export interface WindowsResilienceEvidenceProviderPort {
  readonly configured: boolean;
  readonly productionVerified: boolean;
  readonly providerId: string;
  collect(input: {
    readonly context: LifeApplicationContext;
    readonly evidenceId: string;
  }): Promise<WindowsResilienceEvidenceObservation>;
}

export interface UniversalUxMutationReceipt {
  readonly operationKind: UniversalUxOperationRow['operationKind'];
  readonly resultId: string;
  readonly replayed: boolean;
  readonly occurredAt: string;
  readonly requirementsClosed: boolean;
}

export const unavailableUniversalUxSearchAuthority: UniversalUxSearchAuthorityPort = Object.freeze({
  configured: false,
  productionVerified: false,
  providerId: 'unavailable-universal-search-authority',
  searchAuthorized: async () => ({candidates: Object.freeze([]), providerEvidenceSha256: '0'.repeat(64), networkUsed: false})
});

export const unavailablePolicyWeakeningEvidenceVerifier: PolicyWeakeningEvidenceVerifierPort = Object.freeze({
  configured: false,
  productionVerified: false,
  providerId: 'unavailable-policy-weakening-verifier',
  verify: async () => ({
    providerId: 'unavailable-policy-weakening-verifier',
    providerConfigured: false,
    providerProductionVerified: false,
    verified: false,
    networkUsed: false
  })
});

export const unavailableWindowsResilienceEvidenceProvider: WindowsResilienceEvidenceProviderPort = Object.freeze({
  configured: false,
  productionVerified: false,
  providerId: 'unavailable-windows-resilience-provider',
  collect: async () => { throw new Error('Windows resilience evidence provider is not configured'); }
});

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/u;

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
};

const hash = (value: unknown): string => createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');

const error = (
  context: LifeApplicationContext,
  code: AppError['code'],
  category: AppError['category'],
  message: string
): AppError => createAppError({code, category, message, correlationId: context.correlationId});

const invalid = (context: LifeApplicationContext, message: string): AppError =>
  error(context, ERROR_CODES.CORE_INVALID_ARGUMENT, 'validation', message);
const denied = (context: LifeApplicationContext, message: string): AppError =>
  error(context, ERROR_CODES.AUTHORIZATION_DENIED, 'authorization', message);
const conflict = (context: LifeApplicationContext, message: string): AppError =>
  error(context, ERROR_CODES.RESOURCE_CONFLICT, 'conflict', message);
const unexpected = (context: LifeApplicationContext, message: string): AppError =>
  error(context, ERROR_CODES.CORE_UNEXPECTED, 'unexpected', message);

export const windowsResilienceUniversalUxIntent = (
  action: 'read' | 'create' | 'update',
  resourceId: string
): LifePolicyIntent => ({
  action,
  capability: action === 'read' ? 'family.read' : 'family.write',
  resourceType: 'windows_resilience_universal_ux',
  resourceId,
  purpose: 'general'
});

const canonicalIds = (values: readonly string[], maximum: number): readonly string[] | null => {
  if (!Array.isArray(values) || values.length > maximum || values.some(value => !isSafeUniversalUxIdentifier(value))) return null;
  const result = [...new Set(values)];
  return result.length === values.length ? Object.freeze(result) : null;
};

const operation = (
  scope: WindowsResilienceUniversalUxWriteScope,
  context: LifeApplicationContext,
  clientOperationId: string,
  operationKind: UniversalUxOperationRow['operationKind'],
  requestFingerprint: string,
  resultId: string,
  policyResourceId: string,
  resultRequirementsClosed = false
): UniversalUxOperationRow => Object.freeze({
  clientOperationId,
  familyId: scope.key.familyId,
  ownerPersonId: scope.key.ownerPersonId,
  actorAccountId: context.actor.userId,
  actorPersonId: scope.key.ownerPersonId,
  operationKind,
  requestFingerprint,
  resultId,
  policyResourceId,
  occurredAt: scope.occurredAt,
  resultRequirementsClosed
});

const receipt = (row: UniversalUxOperationRow, replayed: boolean): UniversalUxMutationReceipt => Object.freeze({
  operationKind: row.operationKind,
  resultId: row.resultId,
  replayed,
  occurredAt: row.occurredAt,
  requirementsClosed: row.resultRequirementsClosed
});

export class SearchUniversalUxUseCase {
  public constructor(private readonly authority: UniversalUxSearchAuthorityPort = unavailableUniversalUxSearchAuthority) {}

  public async execute(input: {
    readonly context: LifeApplicationContext;
    readonly query: string;
    readonly limit?: number;
  }): Promise<Result<readonly UniversalSearchResultView[], AppError>> {
    const owner = input.context.actor.personId;
    const limit = input.limit ?? 20;
    if (!owner) return err(denied(input.context, 'Evrensel arama kişi bağlı oturum gerektirir.'));
    if (typeof input.query !== 'string' || input.query.trim().length < 1 || input.query.length > 256 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      return err(invalid(input.context, 'Evrensel arama girdisi geçersizdir.'));
    }
    if (!this.authority.configured || !this.authority.productionVerified ||
      !isSafeUniversalUxIdentifier(this.authority.providerId)) {
      return err(denied(input.context, 'Evrensel arama yetki sağlayıcısı doğrulanmamıştır.'));
    }
    try {
      const resolved = await this.authority.searchAuthorized({context: input.context, query: input.query, limit});
      if (typeof resolved.networkUsed !== 'boolean' || !/^[0-9a-f]{64}$/u.test(resolved.providerEvidenceSha256)) {
        return err(denied(input.context, 'Evrensel arama yetki kanıtı geçersizdir.'));
      }
      return ok(searchUniversalUx(input.query, resolved.candidates, limit));
    } catch {
      return err(denied(input.context, 'Evrensel arama yetki çözümlemesi başarısızdır.'));
    }
  }
}

export class UpdateUniversalUxPreferencesUseCase {
  public constructor(private readonly uow: WindowsResilienceUniversalUxUnitOfWork) {}

  public execute(input: {
    readonly context: LifeApplicationContext;
    readonly clientOperationId: string;
    readonly expectedRevision: number;
    readonly mode: UniversalUxMode;
    readonly favoriteRouteIds: readonly string[];
    readonly recentRouteIds: readonly string[];
    readonly dashboardCardIds: readonly string[];
    readonly quietHoursEnabled: boolean;
    readonly quietHoursStart: string;
    readonly quietHoursEnd: string;
    readonly weeklyDigestEnabled: boolean;
  }): Promise<Result<UniversalUxMutationReceipt, AppError>> {
    const {context} = input;
    const owner = context.actor.personId;
    const favorites = canonicalIds(input.favoriteRouteIds, 64);
    const recents = canonicalIds(input.recentRouteIds, 64);
    const cards = canonicalIds(input.dashboardCardIds, 32);
    if (!owner) return Promise.resolve(err(denied(context, 'Evrensel UX tercihleri kişi bağlı oturum gerektirir.')));
    if (!isSafeUniversalUxIdentifier(input.clientOperationId) || !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0 || !UNIVERSAL_UX_MODES.includes(input.mode) || !favorites || !recents || !cards ||
      typeof input.quietHoursEnabled !== 'boolean' || typeof input.weeklyDigestEnabled !== 'boolean' ||
      !TIME.test(input.quietHoursStart) || !TIME.test(input.quietHoursEnd) ||
      (input.quietHoursEnabled && input.quietHoursStart === input.quietHoursEnd)) {
      return Promise.resolve(err(invalid(context, 'Evrensel UX tercihi geçersizdir.')));
    }
    const policyResourceId = `universal-ux:${owner}`;
    const requestFingerprint = hash({
      familyId: context.familyId,
      ownerPersonId: owner,
      clientOperationId: input.clientOperationId,
      expectedRevision: input.expectedRevision,
      mode: input.mode,
      favoriteRouteIds: favorites,
      recentRouteIds: recents,
      dashboardCardIds: cards,
      quietHoursEnabled: input.quietHoursEnabled,
      quietHoursStart: input.quietHoursStart,
      quietHoursEnd: input.quietHoursEnd,
      weeklyDigestEnabled: input.weeklyDigestEnabled
    });
    return this.uow.execute(context, windowsResilienceUniversalUxIntent('update', policyResourceId), scope => {
      const prior = scope.findOperation(input.clientOperationId);
      if (!prior.ok) return prior;
      if (prior.value) return prior.value.operationKind === 'preferences_update' &&
        prior.value.requestFingerprint === requestFingerprint && prior.value.policyResourceId === policyResourceId ?
        ok(receipt(prior.value, true)) : err(conflict(context, 'İşlem kimliği farklı UX komutuna aittir.'));
      const loaded = scope.loadPreferences();
      if (!loaded.ok) return loaded;
      const revision = loaded.value?.revision ?? 0;
      if (revision !== input.expectedRevision) return err(conflict(context, 'UX tercih sürümü değişti.'));
      const preferences: UniversalUxPreferencesView = Object.freeze({
        mode: input.mode,
        favoriteRouteIds: favorites,
        recentRouteIds: recents,
        dashboardCardIds: cards,
        quietHoursEnabled: input.quietHoursEnabled,
        quietHoursStart: input.quietHoursStart,
        quietHoursEnd: input.quietHoursEnd,
        weeklyDigestEnabled: input.weeklyDigestEnabled,
        revision: revision + 1,
        updatedAt: scope.occurredAt
      });
      if (!isUniversalUxPreferencesView(preferences)) return err(invalid(context, 'Evrensel UX tercih görünümü geçersizdir.'));
      const resultId = hash({familyId: scope.key.familyId, ownerPersonId: scope.key.ownerPersonId,
        operationKind: 'preferences_update', requestFingerprint, preferences});
      const row = operation(scope, context, input.clientOperationId, 'preferences_update', requestFingerprint,
        resultId, policyResourceId);
      const saved = scope.savePreferences(preferences, row, revision);
      return saved.ok ? ok(receipt(row, false)) : saved;
    });
  }
}

export class RecordPolicyWeakeningProposalUseCase {
  public constructor(
    private readonly uow: WindowsResilienceUniversalUxUnitOfWork,
    private readonly verifier: PolicyWeakeningEvidenceVerifierPort = unavailablePolicyWeakeningEvidenceVerifier
  ) {}

  public async execute(input: {
    readonly context: LifeApplicationContext;
    readonly clientOperationId: string;
    readonly proposal: PolicyWeakeningProposalInput;
  }): Promise<Result<UniversalUxMutationReceipt, AppError>> {
    const {context} = input;
    const owner = context.actor.personId;
    if (!owner) return err(denied(context, 'Politika değişikliği kişi bağlı oturum gerektirir.'));
    if (!isSafeUniversalUxIdentifier(input.clientOperationId)) return err(invalid(context, 'Politika değişikliği işlem kimliği geçersizdir.'));
    const shape = evaluatePolicyWeakening(input.proposal, {
      providerId: this.verifier.providerId,
      providerConfigured: false,
      providerProductionVerified: false,
      verified: false,
      networkUsed: false
    });
    if (!shape.evidenceShapeValid) return err(invalid(context, 'Politika zayıflatma kanıt biçimi geçersizdir.'));
    let verification: PolicyWeakeningVerificationView;
    try {
      verification = this.verifier.configured ? await this.verifier.verify({context, proposal: input.proposal}) : {
        providerId: this.verifier.providerId,
        providerConfigured: false,
        providerProductionVerified: false,
        verified: false,
        networkUsed: false
      };
    } catch {
      verification = {providerId: this.verifier.providerId, providerConfigured: this.verifier.configured,
        providerProductionVerified: this.verifier.productionVerified, verified: false, networkUsed: null};
    }
    if (verification.providerId !== this.verifier.providerId ||
      verification.providerConfigured !== this.verifier.configured ||
      verification.providerProductionVerified !== this.verifier.productionVerified) {
      return err(denied(context, 'Politika zayıflatma doğrulayıcı kimliği uyuşmuyor.'));
    }
    const decision = evaluatePolicyWeakening(input.proposal, verification);
    const policyResourceId = input.proposal.proposalId;
    const requestFingerprint = hash({familyId: context.familyId, ownerPersonId: owner,
      clientOperationId: input.clientOperationId, proposal: input.proposal, verification: decision});
    return this.uow.execute(context, windowsResilienceUniversalUxIntent('create', policyResourceId), scope => {
      const prior = scope.findOperation(input.clientOperationId);
      if (!prior.ok) return prior;
      if (prior.value) return prior.value.operationKind === 'policy_weakening_record' &&
        prior.value.requestFingerprint === requestFingerprint && prior.value.policyResourceId === policyResourceId ?
        ok(receipt(prior.value, true)) : err(conflict(context, 'İşlem kimliği farklı politika önerisine aittir.'));
      const proposal: PolicyWeakeningProposalRow = Object.freeze({
        ...input.proposal,
        familyId: asFamilyId(context.familyId),
        ownerPersonId: asPersonId(owner),
        accepted: decision.accepted,
        decisionReason: decision.reason,
        verificationProviderId: decision.verificationProviderId,
        verificationProviderProductionVerified: decision.verificationProviderProductionVerified,
        ...(decision.verificationEvidenceSha256 ? {verificationEvidenceSha256: decision.verificationEvidenceSha256} : {}),
        networkUsed: decision.networkUsed,
        recordedAt: scope.occurredAt
      });
      const resultId = hash({familyId: scope.key.familyId, ownerPersonId: scope.key.ownerPersonId,
        operationKind: 'policy_weakening_record', requestFingerprint, proposal});
      const row = operation(scope, context, input.clientOperationId, 'policy_weakening_record', requestFingerprint,
        resultId, policyResourceId);
      const saved = scope.appendPolicyProposal(proposal, row);
      return saved.ok ? ok(receipt(row, false)) : saved;
    });
  }
}

export class RecordWindowsResilienceEvidenceUseCase {
  public constructor(
    private readonly uow: WindowsResilienceUniversalUxUnitOfWork,
    private readonly provider: WindowsResilienceEvidenceProviderPort = unavailableWindowsResilienceEvidenceProvider
  ) {}

  public async execute(input: {
    readonly context: LifeApplicationContext;
    readonly clientOperationId: string;
    readonly evidenceId: string;
  }): Promise<Result<UniversalUxMutationReceipt, AppError>> {
    const {context} = input;
    const owner = context.actor.personId;
    if (!owner) return err(denied(context, 'Windows dayanıklılık kanıtı kişi bağlı oturum gerektirir.'));
    if (!isSafeUniversalUxIdentifier(input.clientOperationId) || !isSafeUniversalUxIdentifier(input.evidenceId)) {
      return err(invalid(context, 'Dayanıklılık kanıt kimliği geçersizdir.'));
    }
    if (!this.provider.configured || !isSafeUniversalUxIdentifier(this.provider.providerId)) {
      return err(denied(context, 'Windows dayanıklılık kanıt sağlayıcısı yapılandırılmamıştır.'));
    }
    let observed: WindowsResilienceEvidenceObservation;
    try {
      observed = await this.provider.collect({context, evidenceId: input.evidenceId});
    } catch {
      return err(unexpected(context, 'Windows dayanıklılık kanıtı doğrulanamadı.'));
    }
    if (observed.providerId !== this.provider.providerId ||
      observed.providerConfigured !== this.provider.configured ||
      observed.providerProductionVerified !== this.provider.productionVerified) {
      return err(denied(context, 'Windows dayanıklılık sağlayıcı kimliği uyuşmuyor.'));
    }
    let assessed;
    try {
      assessed = assessWindowsResilienceEvidence(observed);
    } catch {
      return err(invalid(context, 'Windows dayanıklılık kanıtı geçersizdir.'));
    }
    const policyResourceId = input.evidenceId;
    const requestFingerprint = hash({familyId: context.familyId, ownerPersonId: owner,
      clientOperationId: input.clientOperationId, evidenceId: input.evidenceId, assessed});
    return this.uow.execute(context, windowsResilienceUniversalUxIntent('create', policyResourceId), scope => {
      const prior = scope.findOperation(input.clientOperationId);
      if (!prior.ok) return prior;
      if (prior.value) return prior.value.operationKind === 'resilience_evidence_record' &&
        prior.value.requestFingerprint === requestFingerprint && prior.value.policyResourceId === policyResourceId ?
        ok(receipt(prior.value, true)) : err(conflict(context, 'İşlem kimliği farklı dayanıklılık kanıtına aittir.'));
      if (Date.parse(assessed.observedAt) > Date.parse(scope.occurredAt)) {
        return err(invalid(context, 'Windows dayanıklılık kanıtı gelecekte gözlemlenmiş olamaz.'));
      }
      const evidence: WindowsResilienceEvidenceRow = Object.freeze({...assessed, id: input.evidenceId,
        familyId: asFamilyId(context.familyId), ownerPersonId: asPersonId(owner), recordedAt: scope.occurredAt});
      const resultId = hash({familyId: scope.key.familyId, ownerPersonId: scope.key.ownerPersonId,
        operationKind: 'resilience_evidence_record', requestFingerprint, evidence});
      const row = operation(scope, context, input.clientOperationId, 'resilience_evidence_record', requestFingerprint,
        resultId, policyResourceId, assessed.requirementsClosed);
      const saved = scope.appendResilienceEvidence(evidence, row);
      return saved.ok ? ok(receipt(row, false)) : saved;
    });
  }
}
