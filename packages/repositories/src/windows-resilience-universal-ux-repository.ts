import { createHash } from 'node:crypto';
import { asFamilyId, asPersonId, asUserId } from '@ppt/core';
import {
  assessWindowsResilienceEvidence,
  isCanonicalUniversalUxIsoDateTime,
  isSafeUniversalUxIdentifier,
  isSafeUniversalUxText,
  isUniversalUxPreferencesView,
  isUniversalUxSha256,
  type UniversalUxPreferencesView
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type PolicyAuthorizedRepositoryExecutionContext,
  type PolicyWeakeningProposalRow,
  type UniversalUxOperationRow,
  type WindowsResilienceEvidenceRow,
  type WindowsResilienceUniversalUxKey,
  type WindowsResilienceUniversalUxRepositoryPort
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const OPERATION_KINDS = new Set<UniversalUxOperationRow['operationKind']>([
  'preferences_update', 'policy_weakening_record', 'resilience_evidence_record'
]);
const POLICY_DECISIONS = new Set([
  'VERIFIED_EXPLICIT_DECISION_RISK_ROLLBACK_AND_SIGNED_PACKAGE',
  'POLICY_WEAKENING_VERIFICATION_REQUIRED'
]);

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
};
const sha256 = (value: unknown): string => createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');

const assertKey = (key: WindowsResilienceUniversalUxKey): void => {
  if (!isSafeUniversalUxIdentifier(key.familyId) || !isSafeUniversalUxIdentifier(key.ownerPersonId)) {
    throw new Error('Windows resilience universal UX key is invalid');
  }
};

const assertAccess = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  key: WindowsResilienceUniversalUxKey
): void => {
  assertKey(key);
  const authorization = context.policyAuthorization;
  const action = authorization.action;
  if (action !== 'read' && action !== 'create' && action !== 'update') {
    throw new Error('Windows resilience universal UX action is invalid');
  }
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'windows_resilience_universal_ux',
    resourceId: authorization.resourceId,
    action,
    capability: action === 'read' ? 'family.read' : 'family.write',
    purpose: 'general',
    correlationId: context.correlationId,
    resourceFamilyId: key.familyId,
    resourceOwnerPersonId: key.ownerPersonId
  });
  const request = authorization.receiptRecord.request;
  if (context.actor.userId !== authorization.subject.accountId ||
    context.actor.personId !== key.ownerPersonId ||
    authorization.subject.personId !== key.ownerPersonId ||
    !authorization.subject.familyIds.includes(key.familyId) ||
    authorization.resourceFamilyId !== key.familyId ||
    request.resource.familyId !== key.familyId ||
    request.resource.ownerPersonId !== key.ownerPersonId ||
    request.resource.sensitivity !== 'personal') {
    throw new Error('Windows resilience universal UX access is not exact-owner bound');
  }
};

const mapOperation = (row: Record<string, unknown>): UniversalUxOperationRow => {
  const operationKind = String(row.operation_kind) as UniversalUxOperationRow['operationKind'];
  const resultRequirementsClosed = Number(row.result_requirements_closed) === 1;
  const mapped: UniversalUxOperationRow = Object.freeze({
    clientOperationId: String(row.client_operation_id),
    familyId: asFamilyId(String(row.family_id)),
    ownerPersonId: asPersonId(String(row.owner_person_id)),
    actorAccountId: asUserId(String(row.actor_account_id)),
    actorPersonId: asPersonId(String(row.actor_person_id)),
    operationKind,
    requestFingerprint: String(row.request_fingerprint),
    resultId: String(row.result_id),
    policyResourceId: String(row.policy_resource_id),
    occurredAt: String(row.occurred_at),
    resultRequirementsClosed
  });
  if (!isSafeUniversalUxIdentifier(mapped.clientOperationId) || !OPERATION_KINDS.has(operationKind) ||
    !isUniversalUxSha256(mapped.requestFingerprint) || !isUniversalUxSha256(mapped.resultId) ||
    !isSafeUniversalUxIdentifier(mapped.policyResourceId) ||
    !isCanonicalUniversalUxIsoDateTime(mapped.occurredAt) || !isSafeUniversalUxIdentifier(mapped.actorAccountId) ||
    !isSafeUniversalUxIdentifier(mapped.actorPersonId) || mapped.actorPersonId !== mapped.ownerPersonId) {
    throw new Error('Persisted Windows resilience universal UX operation is invalid');
  }
  return mapped;
};

const assertOperation = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  key: WindowsResilienceUniversalUxKey,
  operation: UniversalUxOperationRow,
  expectedKind: UniversalUxOperationRow['operationKind'],
  expectedResultId: string,
  expectedOccurredAt: string
) => {
  assertAccess(context, key);
  if (operation.familyId !== key.familyId || operation.ownerPersonId !== key.ownerPersonId ||
    operation.actorAccountId !== context.actor.userId || operation.actorPersonId !== key.ownerPersonId ||
    operation.operationKind !== expectedKind || operation.resultId !== expectedResultId ||
    operation.policyResourceId !== context.policyAuthorization.resourceId ||
    operation.occurredAt !== expectedOccurredAt || operation.occurredAt !== context.occurredAt ||
    !isSafeUniversalUxIdentifier(operation.clientOperationId) ||
    !isUniversalUxSha256(operation.requestFingerprint) || !isUniversalUxSha256(operation.resultId) ||
    !isCanonicalUniversalUxIsoDateTime(operation.occurredAt)) {
    throw new Error('Windows resilience universal UX operation binding is invalid');
  }
  const expectedAction = expectedKind === 'preferences_update' ? 'update' : 'create';
  const binding = platformPolicyPersistenceBinding(context, 'windows_resilience_universal_ux', operation.policyResourceId);
  if (!binding || binding.action !== expectedAction || binding.capability !== 'family.write' ||
    binding.purpose !== 'general' || binding.resourceFamilyId !== key.familyId ||
    binding.occurredAt !== operation.occurredAt) {
    throw new Error('Windows resilience universal UX operation requires an exact durable policy receipt');
  }
  return binding;
};

export class SqliteWindowsResilienceUniversalUxRepository extends SqliteRepository
  implements WindowsResilienceUniversalUxRepositoryPort {
  public loadPreferences(context: PolicyAuthorizedRepositoryExecutionContext, key: WindowsResilienceUniversalUxKey) {
    assertAccess(context, key);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`SELECT preferences_json FROM universal_ux_preferences
        WHERE family_id=? AND owner_person_id=?`).get(key.familyId, key.ownerPersonId) as {preferences_json: string} | undefined;
      if (!row) return null;
      const parsed = JSON.parse(row.preferences_json) as unknown;
      if (!isUniversalUxPreferencesView(parsed)) throw new Error('Persisted universal UX preferences are invalid');
      return Object.freeze(parsed);
    });
  }

  public findOperation(context: PolicyAuthorizedRepositoryExecutionContext, key: WindowsResilienceUniversalUxKey,
    clientOperationId: string) {
    assertAccess(context, key);
    if (!isSafeUniversalUxIdentifier(clientOperationId)) throw new Error('Universal UX client operation id is invalid');
    return this.execute(context, () => {
      const row = this.database(context).prepare(`SELECT client_operation_id,family_id,owner_person_id,actor_account_id,
        actor_person_id,operation_kind,request_fingerprint,result_id,policy_resource_id,occurred_at,result_requirements_closed
        FROM universal_ux_operations WHERE family_id=? AND owner_person_id=? AND client_operation_id=?`)
        .get(key.familyId, key.ownerPersonId, clientOperationId) as Record<string, unknown> | undefined;
      return row ? mapOperation(row) : null;
    });
  }

  #insertOperation(context: PolicyAuthorizedRepositoryExecutionContext, operation: UniversalUxOperationRow,
    binding: ReturnType<typeof platformPolicyPersistenceBinding>): void {
    if (!binding) throw new Error('Universal UX operation receipt is missing');
    this.database(context).prepare(`INSERT INTO universal_ux_operations(
      client_operation_id,family_id,owner_person_id,actor_account_id,actor_person_id,operation_kind,
      request_fingerprint,result_id,policy_resource_id,occurred_at,result_requirements_closed,
      policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      operation.clientOperationId, operation.familyId, operation.ownerPersonId, operation.actorAccountId,
      operation.actorPersonId, operation.operationKind, operation.requestFingerprint, operation.resultId,
      operation.policyResourceId, operation.occurredAt, operation.resultRequirementsClosed ? 1 : 0,
      binding.receiptHash, binding.receiptVersion, binding.nonce, context.correlationId
    );
  }

  public savePreferences(context: PolicyAuthorizedRepositoryExecutionContext, key: WindowsResilienceUniversalUxKey,
    preferences: UniversalUxPreferencesView, operation: UniversalUxOperationRow, expectedRevision: number) {
    if (!isUniversalUxPreferencesView(preferences) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 ||
      preferences.revision !== expectedRevision + 1 || operation.resultRequirementsClosed !== false ||
      operation.policyResourceId !== `universal-ux:${key.ownerPersonId}`) {
      throw new Error('Universal UX preference write is invalid');
    }
    const resultId = sha256({familyId: key.familyId, ownerPersonId: key.ownerPersonId,
      operationKind: 'preferences_update', requestFingerprint: operation.requestFingerprint, preferences});
    const binding = assertOperation(context, key, operation, 'preferences_update', resultId, preferences.updatedAt);
    return this.execute(context, () => {
      this.#insertOperation(context, operation, binding);
      const database = this.database(context);
      const json = canonicalJson(preferences);
      if (expectedRevision === 0) {
        const inserted = database.prepare(`INSERT INTO universal_ux_preferences(family_id,owner_person_id,preferences_json,
          revision,last_operation_id,updated_at) VALUES(?,?,?,?,?,?)`).run(key.familyId, key.ownerPersonId, json,
          preferences.revision, operation.resultId, preferences.updatedAt);
        if (Number(inserted.changes) !== 1) throw new Error('Universal UX preference insert failed');
      } else {
        const updated = database.prepare(`UPDATE universal_ux_preferences SET preferences_json=?,revision=?,
          last_operation_id=?,updated_at=? WHERE family_id=? AND owner_person_id=? AND revision=?`).run(json,
          preferences.revision, operation.resultId, preferences.updatedAt, key.familyId, key.ownerPersonId, expectedRevision);
        if (Number(updated.changes) !== 1) throw new Error('Universal UX optimistic revision conflict');
      }
    });
  }

  public appendPolicyProposal(context: PolicyAuthorizedRepositoryExecutionContext, key: WindowsResilienceUniversalUxKey,
    proposal: PolicyWeakeningProposalRow, operation: UniversalUxOperationRow) {
    const accepted = proposal.accepted === true;
    if (proposal.familyId !== key.familyId || proposal.ownerPersonId !== key.ownerPersonId ||
      operation.policyResourceId !== proposal.proposalId || operation.resultRequirementsClosed !== false ||
      !isSafeUniversalUxIdentifier(proposal.proposalId) || !isSafeUniversalUxIdentifier(proposal.currentPolicyVersion) ||
      !isSafeUniversalUxIdentifier(proposal.proposedPolicyVersion) || proposal.currentPolicyVersion === proposal.proposedPolicyVersion ||
      !isSafeUniversalUxIdentifier(proposal.explicitUserDecisionId) ||
      ![proposal.explicitUserDecisionSha256, proposal.riskAnalysisSha256, proposal.rollbackPlanSha256,
        proposal.proposedPolicyPackageSha256].every(isUniversalUxSha256) ||
      !isSafeUniversalUxText(proposal.reason, 10, 2000) || !POLICY_DECISIONS.has(proposal.decisionReason) ||
      !isSafeUniversalUxIdentifier(proposal.verificationProviderId) ||
      !isCanonicalUniversalUxIsoDateTime(proposal.recordedAt) ||
      (proposal.networkUsed !== null && typeof proposal.networkUsed !== 'boolean') ||
      (accepted && (proposal.decisionReason !== 'VERIFIED_EXPLICIT_DECISION_RISK_ROLLBACK_AND_SIGNED_PACKAGE' ||
        proposal.verificationProviderProductionVerified !== true ||
        !isUniversalUxSha256(proposal.verificationEvidenceSha256) || typeof proposal.networkUsed !== 'boolean')) ||
      (!accepted && proposal.decisionReason !== 'POLICY_WEAKENING_VERIFICATION_REQUIRED')) {
      throw new Error('Policy weakening proposal persistence is invalid');
    }
    const resultId = sha256({familyId: key.familyId, ownerPersonId: key.ownerPersonId,
      operationKind: 'policy_weakening_record', requestFingerprint: operation.requestFingerprint, proposal});
    const binding = assertOperation(context, key, operation, 'policy_weakening_record', resultId, proposal.recordedAt);
    return this.execute(context, () => {
      this.#insertOperation(context, operation, binding);
      this.database(context).prepare(`INSERT INTO policy_weakening_proposals(
        proposal_id,family_id,owner_person_id,current_policy_version,proposed_policy_version,
        explicit_user_decision_id,explicit_user_decision_sha256,risk_analysis_sha256,rollback_plan_sha256,
        proposed_policy_package_sha256,reason,accepted,decision_reason,verification_provider_id,
        verification_provider_production_verified,verification_evidence_sha256,network_used,recorded_at,operation_result_id)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(proposal.proposalId, key.familyId, key.ownerPersonId,
        proposal.currentPolicyVersion, proposal.proposedPolicyVersion, proposal.explicitUserDecisionId,
        proposal.explicitUserDecisionSha256, proposal.riskAnalysisSha256, proposal.rollbackPlanSha256,
        proposal.proposedPolicyPackageSha256, proposal.reason, accepted ? 1 : 0, proposal.decisionReason,
        proposal.verificationProviderId, proposal.verificationProviderProductionVerified ? 1 : 0,
        proposal.verificationEvidenceSha256 ?? null, proposal.networkUsed === null ? null : proposal.networkUsed ? 1 : 0,
        proposal.recordedAt, operation.resultId);
    });
  }

  public appendResilienceEvidence(context: PolicyAuthorizedRepositoryExecutionContext, key: WindowsResilienceUniversalUxKey,
    evidence: WindowsResilienceEvidenceRow, operation: UniversalUxOperationRow) {
    let assessed;
    try { assessed = assessWindowsResilienceEvidence(evidence); } catch {
      throw new Error('Windows resilience evidence persistence is invalid');
    }
    if (evidence.familyId !== key.familyId || evidence.ownerPersonId !== key.ownerPersonId ||
      operation.policyResourceId !== evidence.id || evidence.recordedAt !== operation.occurredAt ||
      evidence.requirementsClosed !== assessed.requirementsClosed || Date.parse(evidence.observedAt) > Date.parse(evidence.recordedAt) ||
      operation.resultRequirementsClosed !== evidence.requirementsClosed) {
      throw new Error('Windows resilience evidence binding is invalid');
    }
    const resultId = sha256({familyId: key.familyId, ownerPersonId: key.ownerPersonId,
      operationKind: 'resilience_evidence_record', requestFingerprint: operation.requestFingerprint, evidence});
    const binding = assertOperation(context, key, operation, 'resilience_evidence_record', resultId, evidence.recordedAt);
    return this.execute(context, () => {
      this.#insertOperation(context, operation, binding);
      this.database(context).prepare(`INSERT INTO windows_resilience_evidence(
        id,family_id,owner_person_id,provider_id,provider_configured,provider_production_verified,
        provider_evidence_sha256,observed_at,network_used,crash_safe_transaction_synthetic_pass,
        startup_recovery_synthetic_pass,installer_clean_install_real_windows_pass,
        installer_upgrade_real_windows_pass,installer_repair_real_windows_pass,
        installer_uninstall_data_protection_real_windows_pass,people_count,event_count,document_count,
        soak_hours,real_windows_soak,requirements_closed,recorded_at,operation_result_id)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(evidence.id, key.familyId, key.ownerPersonId,
        evidence.providerId, evidence.providerConfigured ? 1 : 0, evidence.providerProductionVerified ? 1 : 0,
        evidence.providerEvidenceSha256, evidence.observedAt, evidence.networkUsed ? 1 : 0,
        evidence.crashSafeTransactionSyntheticPass ? 1 : 0, evidence.startupRecoverySyntheticPass ? 1 : 0,
        evidence.installerCleanInstallRealWindowsPass ? 1 : 0, evidence.installerUpgradeRealWindowsPass ? 1 : 0,
        evidence.installerRepairRealWindowsPass ? 1 : 0, evidence.installerUninstallDataProtectionRealWindowsPass ? 1 : 0,
        evidence.peopleCount, evidence.eventCount, evidence.documentCount, evidence.soakHours,
        evidence.realWindowsSoak ? 1 : 0, evidence.requirementsClosed ? 1 : 0, evidence.recordedAt, operation.resultId);
    });
  }
}
