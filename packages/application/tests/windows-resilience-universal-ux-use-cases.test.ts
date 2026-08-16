import { describe, expect, it } from 'vitest';
import { asCorrelationId, asFamilyId, asPersonId, asUserId, ok, type AppError, type Result } from '@ppt/core';
import type {
  PolicyWeakeningProposalRow,
  UniversalUxOperationRow,
  WindowsResilienceEvidenceRow
} from '@ppt/repository-contracts';
import {
  RecordPolicyWeakeningProposalUseCase,
  RecordWindowsResilienceEvidenceUseCase,
  SearchUniversalUxUseCase,
  UpdateUniversalUxPreferencesUseCase,
  type LifeApplicationContext,
  type LifePolicyIntent,
  type PolicyWeakeningEvidenceVerifierPort,
  type UniversalUxSearchAuthorityPort,
  type WindowsResilienceEvidenceProviderPort,
  type WindowsResilienceUniversalUxUnitOfWork,
  type WindowsResilienceUniversalUxWriteScope
} from '../src/index.js';

const FAMILY = asFamilyId('family-34-k');
const OWNER = asPersonId('person-owner-34-k');
const SHA = 'a'.repeat(64);
const CONTEXT: LifeApplicationContext = Object.freeze({
  familyId: FAMILY,
  actor: Object.freeze({userId: asUserId('account-owner-34-k'), role: 'family_admin', personId: OWNER}),
  correlationId: asCorrelationId('correlation-34-k')
});

class State {
  public preferences: ReturnType<WindowsResilienceUniversalUxWriteScope['loadPreferences']> extends Result<infer T, AppError> ? T : never = null;
  public operations = new Map<string, UniversalUxOperationRow>();
  public proposals: PolicyWeakeningProposalRow[] = [];
  public evidence: WindowsResilienceEvidenceRow[] = [];
  public clone(): State {
    const next = new State();
    next.preferences = this.preferences;
    next.operations = new Map(this.operations);
    next.proposals = [...this.proposals];
    next.evidence = [...this.evidence];
    return next;
  }
}

class Scope implements WindowsResilienceUniversalUxWriteScope {
  public readonly key = {familyId: FAMILY, ownerPersonId: OWNER};
  public readonly occurredAt = '2026-08-16T02:30:00.000Z';
  public constructor(private readonly state: State) {}
  public loadPreferences() { return ok(this.state.preferences); }
  public findOperation(id: string) { return ok(this.state.operations.get(id) ?? null); }
  public savePreferences(value: NonNullable<State['preferences']>, operation: UniversalUxOperationRow) {
    this.state.preferences = value;
    this.state.operations.set(operation.clientOperationId, operation);
    return ok(undefined);
  }
  public appendPolicyProposal(value: PolicyWeakeningProposalRow, operation: UniversalUxOperationRow) {
    this.state.proposals.push(value);
    this.state.operations.set(operation.clientOperationId, operation);
    return ok(undefined);
  }
  public appendResilienceEvidence(value: WindowsResilienceEvidenceRow, operation: UniversalUxOperationRow) {
    this.state.evidence.push(value);
    this.state.operations.set(operation.clientOperationId, operation);
    return ok(undefined);
  }
}

class Unit implements WindowsResilienceUniversalUxUnitOfWork {
  public state = new State();
  public intents: LifePolicyIntent[] = [];
  public execute<T>(_context: LifeApplicationContext, intent: LifePolicyIntent,
    operation: (scope: WindowsResilienceUniversalUxWriteScope) => Result<T, AppError>) {
    this.intents.push(intent);
    const draft = this.state.clone();
    const result = operation(new Scope(draft));
    if (result.ok) this.state = draft;
    return Promise.resolve(result);
  }
}

const searchAuthority: UniversalUxSearchAuthorityPort = Object.freeze({
  configured: true,
  productionVerified: true,
  providerId: 'local-authorized-search-provider',
  searchAuthorized: async () => ({
    candidates: Object.freeze([
      Object.freeze({id: 'allowed-result', source: 'inbox' as const, title: 'Sağlık randevusu',
        keywords: Object.freeze(['bakım planı']), routeId: 'life-center', authorized: true as const,
        authorizationEvidenceSha256: '1'.repeat(64)}),
      Object.freeze({id: 'unmatched-result', source: 'command' as const, title: 'Takvim',
        keywords: Object.freeze(['takvim']), routeId: 'calendar', authorized: true as const,
        authorizationEvidenceSha256: '2'.repeat(64)})
    ]),
    providerEvidenceSha256: SHA,
    networkUsed: false
  })
});

const proposal = Object.freeze({
  proposalId: 'proposal-valid-34-k',
  currentPolicyVersion: 'version-1',
  proposedPolicyVersion: 'version-2',
  explicitUserDecisionId: 'decision-34-k',
  explicitUserDecisionSha256: '1'.repeat(64),
  riskAnalysisSha256: '2'.repeat(64),
  rollbackPlanSha256: '3'.repeat(64),
  proposedPolicyPackageSha256: '4'.repeat(64),
  reason: 'Açık kullanıcı kararı, risk analizi ve geri alma planı hazırdır.'
});

const verifiedPolicyProvider: PolicyWeakeningEvidenceVerifierPort = Object.freeze({
  configured: true,
  productionVerified: true,
  providerId: 'verified-policy-provider',
  verify: async ({proposal: input}) => ({
    providerId: 'verified-policy-provider',
    providerConfigured: true,
    providerProductionVerified: true,
    verified: true,
    explicitUserDecisionSha256: input.explicitUserDecisionSha256,
    riskAnalysisSha256: input.riskAnalysisSha256,
    rollbackPlanSha256: input.rollbackPlanSha256,
    proposedPolicyPackageSha256: input.proposedPolicyPackageSha256,
    providerEvidenceSha256: SHA,
    networkUsed: false
  })
});

const resilienceProvider = (productionVerified: boolean,
  observedAt = '2026-08-16T02:29:00.000Z'): WindowsResilienceEvidenceProviderPort => Object.freeze({
  configured: true,
  productionVerified,
  providerId: productionVerified ? 'verified-windows-provider' : 'development-windows-provider',
  collect: async () => ({
    providerId: productionVerified ? 'verified-windows-provider' : 'development-windows-provider',
    providerConfigured: true,
    providerProductionVerified: productionVerified,
    providerEvidenceSha256: SHA,
    observedAt,
    networkUsed: false,
    crashSafeTransactionSyntheticPass: true,
    startupRecoverySyntheticPass: true,
    installerCleanInstallRealWindowsPass: productionVerified,
    installerUpgradeRealWindowsPass: productionVerified,
    installerRepairRealWindowsPass: productionVerified,
    installerUninstallDataProtectionRealWindowsPass: productionVerified,
    peopleCount: 10_000,
    eventCount: 100_000,
    documentCount: 10_000,
    soakHours: productionVerified ? 168 : 2,
    realWindowsSoak: productionVerified
  })
});

describe('34-K Windows resilience and universal UX use cases', () => {
  it('denies universal search when the production authorization provider is absent', async () => {
    const result = await new SearchUniversalUxUseCase().execute({context: CONTEXT, query: 'sağlık'});
    expect(result).toMatchObject({ok: false, error: {category: 'authorization'}});
  });

  it('searches only production-provider-authorized candidates and supports natural Turkish keywords', async () => {
    const result = await new SearchUniversalUxUseCase(searchAuthority).execute({context: CONTEXT, query: 'sağlık bakım'});
    expect(result).toEqual({ok: true, value: [{id: 'allowed-result', source: 'inbox', title: 'Sağlık randevusu',
      routeId: 'life-center', score: 2, authorizationFiltered: true, authorizationEvidenceSha256: '1'.repeat(64)}]});
  });

  it('persists bounded owner preferences and replays exact identity without a second write', async () => {
    const unit = new Unit();
    const useCase = new UpdateUniversalUxPreferencesUseCase(unit);
    const input = {context: CONTEXT, clientOperationId: 'preferences-34-k', expectedRevision: 0,
      mode: 'caregiver' as const, favoriteRouteIds: ['life-center'], recentRouteIds: ['archive'],
      dashboardCardIds: ['today', 'health'], quietHoursEnabled: true, quietHoursStart: '23:00',
      quietHoursEnd: '07:00', weeklyDigestEnabled: true};
    expect(await useCase.execute(input)).toMatchObject({ok: true, value: {operationKind: 'preferences_update',
      requirementsClosed: false, replayed: false}});
    expect(unit.state.preferences).toMatchObject({mode: 'caregiver', revision: 1, weeklyDigestEnabled: true});
    expect(await useCase.execute(input)).toMatchObject({ok: true, value: {replayed: true}});
    expect(unit.state.operations.size).toBe(1);
  });

  it('rejects malformed policy evidence without persisting a proposal', async () => {
    const unit = new Unit();
    const result = await new RecordPolicyWeakeningProposalUseCase(unit).execute({context: CONTEXT,
      clientOperationId: 'policy-invalid-34-k', proposal: {...proposal, proposedPolicyVersion: proposal.currentPolicyVersion}});
    expect(result).toMatchObject({ok: false, error: {category: 'validation'}});
    expect(unit.state.proposals).toEqual([]);
  });

  it('records a valid proposal as rejected while the production verifier is unavailable', async () => {
    const unit = new Unit();
    const result = await new RecordPolicyWeakeningProposalUseCase(unit).execute({context: CONTEXT,
      clientOperationId: 'policy-unverified-34-k', proposal});
    expect(result).toMatchObject({ok: true, value: {requirementsClosed: false}});
    expect(unit.state.proposals[0]).toMatchObject({accepted: false,
      decisionReason: 'POLICY_WEAKENING_VERIFICATION_REQUIRED', verificationProviderProductionVerified: false});
  });

  it('accepts a proposal only with exact production-provider proof and never auto-activates it', async () => {
    const unit = new Unit();
    const result = await new RecordPolicyWeakeningProposalUseCase(unit, verifiedPolicyProvider).execute({context: CONTEXT,
      clientOperationId: 'policy-verified-34-k', proposal});
    expect(result).toMatchObject({ok: true, value: {requirementsClosed: false}});
    expect(unit.state.proposals[0]).toMatchObject({accepted: true,
      decisionReason: 'VERIFIED_EXPLICIT_DECISION_RISK_ROLLBACK_AND_SIGNED_PACKAGE',
      verificationProviderProductionVerified: true, verificationEvidenceSha256: SHA});
  });

  it('fails closed without a Windows evidence provider and writes nothing', async () => {
    const unit = new Unit();
    const result = await new RecordWindowsResilienceEvidenceUseCase(unit).execute({context: CONTEXT,
      clientOperationId: 'resilience-unavailable-34-k', evidenceId: 'evidence-unavailable-34-k'});
    expect(result).toMatchObject({ok: false, error: {category: 'authorization'}});
    expect(unit.state.evidence).toEqual([]);
  });

  it('rejects future-dated provider evidence without writing a closure record', async () => {
    const unit = new Unit();
    const result = await new RecordWindowsResilienceEvidenceUseCase(unit,
      resilienceProvider(true, '2026-08-17T02:29:00.000Z')).execute({context: CONTEXT,
      clientOperationId: 'resilience-future-34-k', evidenceId: 'evidence-future-34-k'});
    expect(result).toMatchObject({ok: false, error: {category: 'validation'}});
    expect(unit.state.evidence).toEqual([]);
  });

  it('keeps non-production lifecycle evidence open and closes only exact production evidence', async () => {
    const incompleteUnit = new Unit();
    const incomplete = await new RecordWindowsResilienceEvidenceUseCase(incompleteUnit, resilienceProvider(false)).execute({
      context: CONTEXT, clientOperationId: 'resilience-incomplete-34-k', evidenceId: 'evidence-incomplete-34-k'});
    expect(incomplete).toMatchObject({ok: true, value: {requirementsClosed: false}});
    expect(incompleteUnit.state.evidence[0]).toMatchObject({requirementsClosed: false, realWindowsSoak: false});

    const verifiedUnit = new Unit();
    const verified = await new RecordWindowsResilienceEvidenceUseCase(verifiedUnit, resilienceProvider(true)).execute({
      context: CONTEXT, clientOperationId: 'resilience-verified-34-k', evidenceId: 'evidence-verified-34-k'});
    expect(verified).toMatchObject({ok: true, value: {requirementsClosed: true}});
    expect(verifiedUnit.state.evidence[0]).toMatchObject({requirementsClosed: true,
      providerProductionVerified: true, soakHours: 168, realWindowsSoak: true});
  });
});
