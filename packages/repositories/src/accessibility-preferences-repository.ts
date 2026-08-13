import {
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId
} from '@ppt/core';
import type {
  AccessibilityPreferencesMutationRow,
  AccessibilityPreferencesRepositoryPort,
  AccessibilityPreferencesRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { assertPolicyAuthorizedRepositoryContext } from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const mapPreferences = (row: Record<string, unknown>): AccessibilityPreferencesRow => ({
  accountId: asUserId(String(row.account_id)),
  familyId: asFamilyId(String(row.family_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  revision: Number(row.revision),
  textScale: String(row.text_scale) as AccessibilityPreferencesRow['textScale'],
  textScalePercent: Number(row.text_scale_percent),
  highContrast: Number(row.high_contrast) === 1,
  reduceMotion: Number(row.reduce_motion) === 1,
  theme: String(row.theme) as AccessibilityPreferencesRow['theme'],
  density: String(row.density) as AccessibilityPreferencesRow['density'],
  readingMode: String(row.reading_mode) as AccessibilityPreferencesRow['readingMode'],
  audienceProfile: String(row.audience_profile) as AccessibilityPreferencesRow['audienceProfile'],
  captionsEnabled: Number(row.captions_enabled) === 1,
  audioMuted: Number(row.audio_muted) === 1,
  createdAt: asIsoDateTime(String(row.created_at)),
  updatedAt: asIsoDateTime(String(row.updated_at)),
  lastMutationId: String(row.last_mutation_id)
});

const mapMutation = (row: Record<string, unknown>): AccessibilityPreferencesMutationRow => ({
  id: String(row.id),
  clientOperationId: String(row.client_operation_id),
  requestFingerprint: String(row.request_fingerprint),
  familyId: asFamilyId(String(row.family_id)),
  accountId: asUserId(String(row.account_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  previousRevision: Number(row.previous_revision),
  revision: Number(row.revision),
  textScale: String(row.text_scale) as AccessibilityPreferencesMutationRow['textScale'],
  textScalePercent: Number(row.text_scale_percent),
  highContrast: Number(row.high_contrast) === 1,
  reduceMotion: Number(row.reduce_motion) === 1,
  theme: String(row.theme) as AccessibilityPreferencesMutationRow['theme'],
  density: String(row.density) as AccessibilityPreferencesMutationRow['density'],
  readingMode: String(row.reading_mode) as AccessibilityPreferencesMutationRow['readingMode'],
  audienceProfile: String(row.audience_profile) as AccessibilityPreferencesMutationRow['audienceProfile'],
  captionsEnabled: Number(row.captions_enabled) === 1,
  audioMuted: Number(row.audio_muted) === 1,
  createdAt: asIsoDateTime(String(row.created_at))
});

interface AccessibilityReadBinding {
  readonly familyId: string;
  readonly ownerPersonId: string;
}

const assertPersonalSubject = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  accountId: string
): AccessibilityReadBinding => {
  const authorization = context.policyAuthorization;
  const request = authorization.receiptRecord.request;
  if (
    String(context.actor.userId) !== accountId
    || authorization.subject.accountId !== accountId
    || request.subject.accountId !== accountId
    || !authorization.subject.personId
    || request.subject.personId !== authorization.subject.personId
    || context.actor.personId !== authorization.subject.personId
    || authorization.resourceOwnerPersonId !== authorization.subject.personId
    || request.resource.ownerPersonId !== authorization.subject.personId
    || request.resource.familyId !== authorization.resourceFamilyId
    || !authorization.subject.familyIds.includes(authorization.resourceFamilyId)
    || request.resource.sensitivity !== 'personal'
    || request.purpose !== 'general'
  ) {
    throw new Error('Accessibility preferences require the exact personal family policy subject');
  }
  return {
    familyId: authorization.resourceFamilyId,
    ownerPersonId: authorization.subject.personId
  };
};

const accessibilityReadBinding = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  accountId: string
): AccessibilityReadBinding => {
  if (!context.policyAuthorization) {
    throw new Error('Accessibility preferences reject a forged policy transaction context');
  }
  const action = context.policyAuthorization.action;
  const resourceId = context.policyAuthorization.resourceId;
  const ownerPersonId = context.policyAuthorization.resourceOwnerPersonId;
  if (resourceId !== accountId && !(action === 'read' && resourceId === '*')) {
    throw new Error('Accessibility preference read receipt must target the account or collection');
  }
  if (!ownerPersonId) {
    throw new Error('Accessibility preference read receipt requires an exact owner');
  }
  if (action !== 'read' && action !== 'create' && action !== 'update') {
    throw new Error('Accessibility preference access requires a supported policy action');
  }
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'accessibility_preferences',
    resourceId,
    action,
    capability: action === 'read' ? 'family.read' : 'family.write',
    correlationId: context.correlationId,
    resourceFamilyId: context.policyAuthorization.resourceFamilyId,
    resourceOwnerPersonId: ownerPersonId,
    purpose: 'general'
  });
  return assertPersonalSubject(context, accountId);
};

const accessibilityWriteBinding = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  row: AccessibilityPreferencesMutationRow | AccessibilityPreferencesRow,
  expectedRevision: number
) => {
  const action = expectedRevision === 0 ? 'create' : 'update';
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'accessibility_preferences',
    resourceId: row.accountId,
    action,
    capability: 'family.write',
    correlationId: context.correlationId,
    resourceFamilyId: row.familyId,
    resourceOwnerPersonId: row.ownerPersonId,
    purpose: 'general'
  });
  const subject = assertPersonalSubject(context, row.accountId);
  if (
    subject.familyId !== row.familyId
    || subject.ownerPersonId !== row.ownerPersonId
    || row.revision !== expectedRevision + 1
  ) {
    throw new Error('Accessibility preference write scope or revision is invalid');
  }
  const policy = platformPolicyPersistenceBinding(
    context,
    'accessibility_preferences',
    row.accountId
  );
  if (!policy) {
    throw new Error('Accessibility preference write requires an active policy receipt');
  }
  return policy;
};

export class SqliteAccessibilityPreferencesRepository
  extends SqliteRepository
  implements AccessibilityPreferencesRepositoryPort {
  public find(
    context: PolicyAuthorizedRepositoryExecutionContext,
    accountId: AccessibilityPreferencesRow['accountId']
  ): RepositoryResult<AccessibilityPreferencesRow | null> {
    const scope = accessibilityReadBinding(context, accountId);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT * FROM accessibility_preferences
        WHERE account_id=? AND family_id=? AND owner_person_id=?
      `).get(accountId, scope.familyId, scope.ownerPersonId) as Record<string, unknown> | undefined;
      return row ? mapPreferences(row) : null;
    });
  }

  public findForPolicyResolution(
    context: RepositoryExecutionContext,
    accountId: AccessibilityPreferencesRow['accountId']
  ): RepositoryResult<AccessibilityPreferencesRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT preferences.*
        FROM accessibility_preferences preferences
        JOIN accounts account
          ON account.id=preferences.account_id
         AND account.person_id=preferences.owner_person_id
         AND account.status='active'
        JOIN people owner
          ON owner.id=preferences.owner_person_id
         AND owner.family_id=preferences.family_id
         AND owner.status='active'
        WHERE preferences.account_id=?
      `).get(accountId) as Record<string, unknown> | undefined;
      return row ? mapPreferences(row) : null;
    });
  }

  public findMutationByClientOperationId(
    context: PolicyAuthorizedRepositoryExecutionContext,
    accountId: AccessibilityPreferencesRow['accountId'],
    clientOperationId: string
  ): RepositoryResult<AccessibilityPreferencesMutationRow | null> {
    const scope = accessibilityReadBinding(context, accountId);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT * FROM accessibility_preference_mutations
        WHERE family_id=? AND account_id=? AND owner_person_id=? AND client_operation_id=?
      `).get(scope.familyId, accountId, scope.ownerPersonId, clientOperationId) as Record<string, unknown> | undefined;
      return row ? mapMutation(row) : null;
    });
  }

  public insertMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: AccessibilityPreferencesMutationRow
  ): RepositoryResult<void> {
    const policy = accessibilityWriteBinding(context, row, row.previousRevision);
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO accessibility_preference_mutations(
          id,client_operation_id,request_fingerprint,family_id,account_id,owner_person_id,
          previous_revision,revision,text_scale,text_scale_percent,high_contrast,reduce_motion,
          theme,density,reading_mode,audience_profile,captions_enabled,audio_muted,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,
          policy_resource_type,policy_resource_id,policy_action,policy_capability
        ) VALUES(${Array.from({ length: 27 }, () => '?').join(',')})
      `).run(
        row.id,
        row.clientOperationId,
        row.requestFingerprint,
        row.familyId,
        row.accountId,
        row.ownerPersonId,
        row.previousRevision,
        row.revision,
        row.textScale,
        row.textScalePercent,
        row.highContrast ? 1 : 0,
        row.reduceMotion ? 1 : 0,
        row.theme,
        row.density,
        row.readingMode,
        row.audienceProfile,
        row.captionsEnabled ? 1 : 0,
        row.audioMuted ? 1 : 0,
        row.createdAt,
        policy.receiptHash,
        policy.receiptVersion,
        policy.nonce,
        context.correlationId,
        policy.resourceType,
        policy.resourceId,
        policy.action,
        policy.capability
      );
    });
  }

  public saveCurrent(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: AccessibilityPreferencesRow,
    expectedRevision: number
  ): RepositoryResult<boolean> {
    accessibilityWriteBinding(context, row, expectedRevision);
    return this.execute(context, () => {
      if (expectedRevision === 0) {
        const result = this.database(context).prepare(`
          INSERT INTO accessibility_preferences(
            account_id,family_id,owner_person_id,revision,text_scale,text_scale_percent,
            high_contrast,reduce_motion,theme,density,reading_mode,audience_profile,
            captions_enabled,audio_muted,created_at,updated_at,last_mutation_id
          ) VALUES(${Array.from({ length: 17 }, () => '?').join(',')})
          ON CONFLICT(account_id) DO NOTHING
        `).run(
          row.accountId,row.familyId,row.ownerPersonId,row.revision,row.textScale,
          row.textScalePercent,row.highContrast ? 1 : 0,row.reduceMotion ? 1 : 0,
          row.theme,row.density,row.readingMode,row.audienceProfile,
          row.captionsEnabled ? 1 : 0,row.audioMuted ? 1 : 0,row.createdAt,row.updatedAt,
          row.lastMutationId
        );
        return Number(result.changes) === 1;
      }
      const result = this.database(context).prepare(`
        UPDATE accessibility_preferences SET
          revision=?,text_scale=?,text_scale_percent=?,high_contrast=?,reduce_motion=?,
          theme=?,density=?,reading_mode=?,audience_profile=?,captions_enabled=?,audio_muted=?,
          updated_at=?,last_mutation_id=?
        WHERE account_id=? AND family_id=? AND owner_person_id=? AND revision=?
      `).run(
        row.revision,row.textScale,row.textScalePercent,row.highContrast ? 1 : 0,
        row.reduceMotion ? 1 : 0,row.theme,row.density,row.readingMode,row.audienceProfile,
        row.captionsEnabled ? 1 : 0,row.audioMuted ? 1 : 0,row.updatedAt,row.lastMutationId,
        row.accountId,row.familyId,row.ownerPersonId,expectedRevision
      );
      return Number(result.changes) === 1;
    });
  }
}
