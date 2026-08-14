import { asFamilyId, asIsoDateTime, asPersonId, asUserId } from '@ppt/core';
import { canonicalizeFormDraftPayload } from '@ppt/domain';
import { sha256Hex } from '@ppt/security';
import type {
  FormDraftMutationRow,
  FormDraftRepositoryPort,
  FormDraftRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { assertPolicyAuthorizedRepositoryContext } from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

export const FORM_DRAFT_MAX_CURRENT_PER_ACCOUNT = 32;
export const FORM_DRAFT_MAX_IMMUTABLE_MUTATIONS_PER_RESOURCE = 256;

const mapDraft = (row: Record<string, unknown>): FormDraftRow => ({
  resourceId: String(row.resource_id),
  familyId: asFamilyId(String(row.family_id)),
  accountId: asUserId(String(row.account_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  formKey: String(row.form_key),
  revision: Number(row.revision),
  payloadJson: String(row.payload_json),
  payloadFingerprint: String(row.payload_fingerprint),
  createdAt: asIsoDateTime(String(row.created_at)),
  updatedAt: asIsoDateTime(String(row.updated_at)),
  lastMutationId: String(row.last_mutation_id)
});

const mapMutation = (row: Record<string, unknown>): FormDraftMutationRow => ({
  id: String(row.id),
  clientOperationId: String(row.client_operation_id),
  requestFingerprint: String(row.request_fingerprint),
  familyId: asFamilyId(String(row.family_id)),
  accountId: asUserId(String(row.account_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  formKey: String(row.form_key),
  resourceId: String(row.resource_id),
  operation: String(row.operation) as FormDraftMutationRow['operation'],
  previousRevision: Number(row.previous_revision),
  revision: Number(row.revision),
  payloadJson: String(row.payload_json),
  payloadFingerprint: String(row.payload_fingerprint),
  restoredFromRevision: row.restored_from_revision === null ? null : Number(row.restored_from_revision),
  createdAt: asIsoDateTime(String(row.created_at))
});

interface DraftBinding { readonly familyId: string; readonly ownerPersonId: string }

const assertCanonicalPayload = (row: FormDraftMutationRow | FormDraftRow): void => {
  let canonical: string;
  try {
    canonical = canonicalizeFormDraftPayload(JSON.parse(row.payloadJson));
  } catch {
    throw new Error('Form draft payload must be canonical, bounded JSON without banking secrets');
  }
  if (canonical !== row.payloadJson || sha256Hex(canonical) !== row.payloadFingerprint) {
    throw new Error('Form draft payload fingerprint or canonical representation is invalid');
  }
};

const exactPersonalSubject = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  accountId: string,
  resourceId: string
): DraftBinding => {
  const authorization = context.policyAuthorization;
  const request = authorization.receiptRecord.request;
  if (
    String(context.actor.userId) !== accountId
    || authorization.subject.accountId !== accountId
    || request.subject.accountId !== accountId
    || !authorization.subject.personId
    || request.subject.personId !== authorization.subject.personId
    || context.actor.personId !== authorization.subject.personId
    || authorization.resourceId !== resourceId
    || request.resource.id !== resourceId
    || authorization.resourceOwnerPersonId !== authorization.subject.personId
    || request.resource.ownerPersonId !== authorization.subject.personId
    || request.resource.familyId !== authorization.resourceFamilyId
    || !authorization.subject.familyIds.includes(authorization.resourceFamilyId)
    || request.resource.sensitivity !== 'personal'
    || request.purpose !== 'general'
  ) throw new Error('Form drafts require the exact personal family policy subject');
  return { familyId: authorization.resourceFamilyId, ownerPersonId: authorization.subject.personId };
};

const draftBinding = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  accountId: string,
  formKey: string
): DraftBinding => {
  if (!context.policyAuthorization) throw new Error('Form drafts reject a forged policy context');
  const resourceId = `form_draft/${accountId}/${formKey}`;
  const action = context.policyAuthorization.action;
  const ownerPersonId = context.policyAuthorization.resourceOwnerPersonId;
  if (!ownerPersonId) throw new Error('Form draft policy receipt requires an exact owner');
  if (action !== 'read' && action !== 'create' && action !== 'update') {
    throw new Error('Form draft access requires a supported policy action');
  }
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'form_draft',
    resourceId,
    action,
    capability: action === 'read' ? 'family.read' : 'family.write',
    correlationId: context.correlationId,
    resourceFamilyId: context.policyAuthorization.resourceFamilyId,
    resourceOwnerPersonId: ownerPersonId,
    purpose: 'general'
  });
  return exactPersonalSubject(context, accountId, resourceId);
};

const writeBinding = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  row: FormDraftMutationRow | FormDraftRow,
  expectedRevision: number
) => {
  assertCanonicalPayload(row);
  const action = expectedRevision === 0 ? 'create' : 'update';
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'form_draft',
    resourceId: row.resourceId,
    action,
    capability: 'family.write',
    correlationId: context.correlationId,
    resourceFamilyId: row.familyId,
    resourceOwnerPersonId: row.ownerPersonId,
    purpose: 'general'
  });
  const subject = exactPersonalSubject(context, row.accountId, row.resourceId);
  if (subject.familyId !== row.familyId || subject.ownerPersonId !== row.ownerPersonId
    || row.resourceId !== `form_draft/${row.accountId}/${row.formKey}`
    || row.revision !== expectedRevision + 1) {
    throw new Error('Form draft write scope or revision is invalid');
  }
  const policy = platformPolicyPersistenceBinding(context, 'form_draft', row.resourceId);
  if (!policy) throw new Error('Form draft write requires an active policy receipt');
  return policy;
};

export class SqliteFormDraftRepository extends SqliteRepository implements FormDraftRepositoryPort {
  public find(
    context: PolicyAuthorizedRepositoryExecutionContext,
    accountId: FormDraftRow['accountId'],
    formKey: string
  ): RepositoryResult<FormDraftRow | null> {
    const scope = draftBinding(context, accountId, formKey);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT * FROM governed_form_drafts
        WHERE account_id=? AND form_key=? AND family_id=? AND owner_person_id=?
      `).get(accountId, formKey, scope.familyId, scope.ownerPersonId) as Record<string, unknown> | undefined;
      return row ? mapDraft(row) : null;
    });
  }

  public findForPolicyResolution(
    context: RepositoryExecutionContext,
    accountId: FormDraftRow['accountId'],
    formKey: string
  ): RepositoryResult<FormDraftRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT draft.* FROM governed_form_drafts draft
        JOIN accounts account ON account.id=draft.account_id
          AND account.person_id=draft.owner_person_id AND account.status='active'
        JOIN people owner ON owner.id=draft.owner_person_id
          AND owner.family_id=draft.family_id AND owner.status='active'
        WHERE draft.account_id=? AND draft.form_key=?
      `).get(accountId, formKey) as Record<string, unknown> | undefined;
      return row ? mapDraft(row) : null;
    });
  }

  public findMutationByClientOperationId(
    context: PolicyAuthorizedRepositoryExecutionContext,
    accountId: FormDraftRow['accountId'],
    formKey: string,
    clientOperationId: string
  ): RepositoryResult<FormDraftMutationRow | null> {
    const scope = draftBinding(context, accountId, formKey);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT * FROM governed_form_draft_mutations
        WHERE family_id=? AND account_id=? AND owner_person_id=? AND form_key=? AND client_operation_id=?
      `).get(scope.familyId, accountId, scope.ownerPersonId, formKey, clientOperationId) as Record<string, unknown> | undefined;
      return row ? mapMutation(row) : null;
    });
  }

  public findMutationByRevision(
    context: PolicyAuthorizedRepositoryExecutionContext,
    accountId: FormDraftRow['accountId'],
    formKey: string,
    revision: number
  ): RepositoryResult<FormDraftMutationRow | null> {
    const scope = draftBinding(context, accountId, formKey);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT * FROM governed_form_draft_mutations
        WHERE family_id=? AND account_id=? AND owner_person_id=? AND form_key=? AND revision=?
      `).get(scope.familyId, accountId, scope.ownerPersonId, formKey, revision) as Record<string, unknown> | undefined;
      return row ? mapMutation(row) : null;
    });
  }

  public listMutations(
    context: PolicyAuthorizedRepositoryExecutionContext,
    accountId: FormDraftRow['accountId'],
    formKey: string,
    limit: number
  ): RepositoryResult<readonly FormDraftMutationRow[]> {
    const scope = draftBinding(context, accountId, formKey);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Form draft history limit is invalid');
    return this.execute(context, () => this.database(context).prepare(`
      SELECT * FROM governed_form_draft_mutations
      WHERE family_id=? AND account_id=? AND owner_person_id=? AND form_key=?
      ORDER BY revision DESC LIMIT ?
    `).all(scope.familyId, accountId, scope.ownerPersonId, formKey, limit)
      .map((row) => mapMutation(row as Record<string, unknown>)));
  }

  public insertMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: FormDraftMutationRow
  ): RepositoryResult<void> {
    const policy = writeBinding(context, row, row.previousRevision);
    return this.execute(context, () => {
      const database = this.database(context);
      if (row.previousRevision === 0) {
        const current = database.prepare(`
          SELECT COUNT(*) AS count FROM governed_form_drafts WHERE account_id=?
        `).get(row.accountId) as { count: number };
        if (Number(current.count) >= FORM_DRAFT_MAX_CURRENT_PER_ACCOUNT) {
          throw new Error('Form draft account current quota exceeded; new writes are denied');
        }
      }
      const history = database.prepare(`
        SELECT COUNT(*) AS count FROM governed_form_draft_mutations WHERE resource_id=?
      `).get(row.resourceId) as { count: number };
      if (Number(history.count) >= FORM_DRAFT_MAX_IMMUTABLE_MUTATIONS_PER_RESOURCE) {
        throw new Error('Form draft immutable history quota exceeded; new writes are denied');
      }
      database.prepare(`
        INSERT INTO governed_form_draft_mutations(
          id,client_operation_id,request_fingerprint,family_id,account_id,owner_person_id,
          form_key,resource_id,operation,previous_revision,revision,payload_json,payload_fingerprint,
          restored_from_revision,created_at,policy_receipt_hash,policy_receipt_version,
          policy_receipt_nonce,policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        ) VALUES(${Array.from({ length: 23 }, () => '?').join(',')})
      `).run(
        row.id,row.clientOperationId,row.requestFingerprint,row.familyId,row.accountId,row.ownerPersonId,
        row.formKey,row.resourceId,row.operation,row.previousRevision,row.revision,row.payloadJson,
        row.payloadFingerprint,row.restoredFromRevision,row.createdAt,policy.receiptHash,policy.receiptVersion,
        policy.nonce,context.correlationId,policy.resourceType,policy.resourceId,policy.action,policy.capability
      );
    });
  }

  public saveCurrent(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: FormDraftRow,
    expectedRevision: number
  ): RepositoryResult<boolean> {
    writeBinding(context, row, expectedRevision);
    return this.execute(context, () => {
      if (expectedRevision === 0) {
        const result = this.database(context).prepare(`
          INSERT INTO governed_form_drafts(
            resource_id,family_id,account_id,owner_person_id,form_key,revision,payload_json,
            payload_fingerprint,created_at,updated_at,last_mutation_id
          ) VALUES(${Array.from({ length: 11 }, () => '?').join(',')}) ON CONFLICT(resource_id) DO NOTHING
        `).run(row.resourceId,row.familyId,row.accountId,row.ownerPersonId,row.formKey,row.revision,
          row.payloadJson,row.payloadFingerprint,row.createdAt,row.updatedAt,row.lastMutationId);
        return Number(result.changes) === 1;
      }
      const result = this.database(context).prepare(`
        UPDATE governed_form_drafts SET revision=?,payload_json=?,payload_fingerprint=?,updated_at=?,last_mutation_id=?
        WHERE resource_id=? AND family_id=? AND account_id=? AND owner_person_id=? AND form_key=? AND revision=?
      `).run(row.revision,row.payloadJson,row.payloadFingerprint,row.updatedAt,row.lastMutationId,
        row.resourceId,row.familyId,row.accountId,row.ownerPersonId,row.formKey,expectedRevision);
      return Number(result.changes) === 1;
    });
  }
}
