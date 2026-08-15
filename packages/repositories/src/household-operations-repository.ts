import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type {
  HouseholdExpenseShareView,
  HouseholdOperationArea,
  HouseholdOperationItemView,
  HouseholdOperationKind,
  HouseholdOperationMutationKind,
  HouseholdOperationStatus
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type HouseholdOperationItemRow,
  type HouseholdOperationMutationRow,
  type HouseholdOperationsCenterKey,
  type HouseholdOperationsCenterRow,
  type HouseholdOperationsCenterSnapshotRow,
  type HouseholdOperationsPolicyResourceRepositoryPort,
  type HouseholdOperationsRepositoryPort,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const parseArray = <T>(value: unknown): readonly T[] => {
  if (typeof value !== 'string') return Object.freeze([]);
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error('Household operations JSON array is invalid');
  return Object.freeze(parsed as T[]);
};

const centerSelect = `
  SELECT id,family_id,revision,state_fingerprint,last_mutation_id,created_at,updated_at
  FROM household_operations_centers`;

const itemSelect = `
  SELECT id,center_id,family_id,owner_person_id,kind,area,title,status,revision,parent_item_id,
    assigned_person_id,stock_category,quantity,unit,scheduled_at,due_at,expires_at,recurrence,
    amount_minor,currency,split_shares_json,ingredient_names_json,allergen_codes_json,
    avoided_allergen_codes_json,allergy_filter_status,provider_label,tracking_last_four,
    guest_label,access_area,opaque_pet_reference,note,state_fingerprint,last_mutation_id,
    created_at,updated_at,deleted_at
  FROM household_operation_items`;

const mutationSelect = `
  SELECT id,center_id,family_id,item_id,owner_person_id,actor_account_id,actor_person_id,
    mutation_kind,client_operation_id,request_fingerprint,expected_center_revision,center_revision,
    expected_item_revision,item_revision,center_state_fingerprint,item_state_fingerprint,occurred_at
  FROM household_operation_mutations`;

const mapCenter = (row: Record<string, unknown>): HouseholdOperationsCenterRow => Object.freeze({
  id: String(row.id),
  familyId: asFamilyId(String(row.family_id)),
  revision: Number(row.revision),
  stateFingerprint: String(row.state_fingerprint),
  lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)),
  updatedAt: asIsoDateTime(String(row.updated_at))
});

const mapItem = (row: Record<string, unknown>): HouseholdOperationItemRow => Object.freeze({
  id: String(row.id),
  centerId: String(row.center_id),
  familyId: asFamilyId(String(row.family_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  kind: String(row.kind) as HouseholdOperationKind,
  area: String(row.area) as HouseholdOperationArea,
  title: String(row.title),
  status: String(row.status) as HouseholdOperationStatus,
  revision: Number(row.revision),
  ...(row.parent_item_id ? { parentItemId: String(row.parent_item_id) } : {}),
  ...(row.assigned_person_id ? { assignedPersonId: asPersonId(String(row.assigned_person_id)) } : {}),
  ...(row.stock_category ? { stockCategory: String(row.stock_category) as 'food' | 'cleaning' } : {}),
  ...(row.quantity !== null && row.quantity !== undefined ? { quantity: Number(row.quantity) } : {}),
  ...(row.unit ? { unit: String(row.unit) } : {}),
  ...(row.scheduled_at ? { scheduledAt: asIsoDateTime(String(row.scheduled_at)) } : {}),
  ...(row.due_at ? { dueAt: asIsoDateTime(String(row.due_at)) } : {}),
  ...(row.expires_at ? { expiresAt: asIsoDateTime(String(row.expires_at)) } : {}),
  ...(row.recurrence ? { recurrence: String(row.recurrence) } : {}),
  ...(row.amount_minor !== null && row.amount_minor !== undefined ? { amountMinor: Number(row.amount_minor) } : {}),
  ...(row.currency ? { currency: String(row.currency) } : {}),
  ...(row.split_shares_json ? { splitShares: parseArray<HouseholdExpenseShareView>(row.split_shares_json) } : {}),
  ...(row.ingredient_names_json ? { ingredientNames: parseArray<string>(row.ingredient_names_json) } : {}),
  ...(row.allergen_codes_json ? { allergenCodes: parseArray<string>(row.allergen_codes_json) } : {}),
  ...(row.avoided_allergen_codes_json ? { avoidedAllergenCodes: parseArray<string>(row.avoided_allergen_codes_json) } : {}),
  ...(row.allergy_filter_status ? { allergyFilterStatus: String(row.allergy_filter_status) as NonNullable<HouseholdOperationItemView['allergyFilterStatus']> } : {}),
  ...(row.provider_label ? { providerLabel: String(row.provider_label) } : {}),
  ...(row.tracking_last_four ? { trackingLastFour: String(row.tracking_last_four) } : {}),
  ...(row.guest_label ? { guestLabel: String(row.guest_label) } : {}),
  ...(row.access_area ? { accessArea: String(row.access_area) } : {}),
  ...(row.opaque_pet_reference ? { opaquePetReference: String(row.opaque_pet_reference) } : {}),
  ...(row.note ? { note: String(row.note) } : {}),
  stateFingerprint: String(row.state_fingerprint),
  lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)),
  updatedAt: asIsoDateTime(String(row.updated_at)),
  ...(row.deleted_at ? { deletedAt: asIsoDateTime(String(row.deleted_at)) } : {})
});

const mapMutation = (row: Record<string, unknown>): HouseholdOperationMutationRow => Object.freeze({
  id: String(row.id),
  centerId: String(row.center_id),
  familyId: asFamilyId(String(row.family_id)),
  itemId: String(row.item_id),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  actorAccountId: String(row.actor_account_id),
  actorPersonId: asPersonId(String(row.actor_person_id)),
  mutationKind: String(row.mutation_kind) as HouseholdOperationMutationKind,
  clientOperationId: String(row.client_operation_id),
  requestFingerprint: String(row.request_fingerprint),
  expectedCenterRevision: Number(row.expected_center_revision),
  centerRevision: Number(row.center_revision),
  expectedItemRevision: Number(row.expected_item_revision),
  itemRevision: Number(row.item_revision),
  centerStateFingerprint: String(row.center_state_fingerprint),
  itemStateFingerprint: String(row.item_state_fingerprint),
  occurredAt: asIsoDateTime(String(row.occurred_at))
});

const assertKey = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  key: HouseholdOperationsCenterKey,
  mode: 'read' | 'write',
  itemId?: string
): void => {
  const resourceType = mode === 'read' ? 'household_operations_center' : 'household_operation_item';
  const resourceId = mode === 'read' ? '*' : itemId!;
  const capability = mode === 'read' ? 'family.read' : 'family.write';
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType,
    resourceId,
    action: context.policyAuthorization.action,
    capability,
    correlationId: context.correlationId,
    resourceFamilyId: key.familyId
  });
  const authorization = context.policyAuthorization;
  if (
    authorization.purpose !== 'general'
    || authorization.subject.accountId !== key.accountId
    || authorization.subject.personId !== key.actorPersonId
    || !authorization.subject.familyIds.includes(key.familyId)
    || authorization.resourceFamilyId !== key.familyId
    || key.centerId !== `household-operations-center:${key.familyId}`
    || (mode === 'read' && authorization.action !== 'read')
    || (mode === 'write' && !['create', 'update', 'delete'].includes(authorization.action))
  ) throw new Error('Household operations repository key does not match the exact policy receipt');
};

const writeBinding = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  row: HouseholdOperationMutationRow
) => {
  const binding = platformPolicyPersistenceBinding(context, 'household_operation_item', row.itemId);
  if (!binding || binding.resourceFamilyId !== row.familyId || binding.purpose !== 'general'
    || binding.capability !== 'family.write' || binding.occurredAt !== row.occurredAt) {
    throw new Error('Household operations mutation requires an exact durable policy receipt');
  }
  const expectedAction = row.mutationKind === 'item_create' ? 'create'
    : row.mutationKind === 'item_delete' ? 'delete' : 'update';
  if (binding.action !== expectedAction) throw new Error('Household operations mutation action does not match the receipt');
  return binding;
};

export class SqliteHouseholdOperationsRepository extends SqliteRepository implements
  HouseholdOperationsRepositoryPort,
  HouseholdOperationsPolicyResourceRepositoryPort {
  public findItemForPolicyResolution(
    context: RepositoryExecutionContext,
    itemId: string
  ): ReturnType<HouseholdOperationsPolicyResourceRepositoryPort['findItemForPolicyResolution']> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,family_id,owner_person_id,revision,status,state_fingerprint
        FROM household_operation_items WHERE id=?
      `).get(itemId) as Record<string, unknown> | undefined;
      return row ? Object.freeze({
        id: String(row.id),
        familyId: asFamilyId(String(row.family_id)),
        ownerPersonId: asPersonId(String(row.owner_person_id)),
        revision: Number(row.revision),
        status: String(row.status) as HouseholdOperationStatus,
        stateFingerprint: String(row.state_fingerprint)
      }) : null;
    });
  }

  public loadCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: HouseholdOperationsCenterKey
  ): RepositoryResult<HouseholdOperationsCenterSnapshotRow> {
    assertKey(context, key, 'read');
    return this.execute(context, () => {
      const database = this.database(context);
      const centerRow = database.prepare(`${centerSelect} WHERE id=? AND family_id=?`)
        .get(key.centerId, key.familyId) as Record<string, unknown> | undefined;
      const itemRows = database.prepare(`
        ${itemSelect} WHERE center_id=? AND family_id=? ORDER BY area,updated_at DESC,id LIMIT 2001
      `).all(key.centerId, key.familyId) as ReadonlyArray<Record<string, unknown>>;
      if (itemRows.length > 2_000) throw new Error('Household operations center exceeds its bounded local result contract');
      return Object.freeze({
        center: centerRow ? mapCenter(centerRow) : null,
        items: Object.freeze(itemRows.map(mapItem))
      });
    });
  }

  public findCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: HouseholdOperationsCenterKey
  ): RepositoryResult<HouseholdOperationsCenterRow | null> {
    assertKey(context, key, 'write', context.policyAuthorization.resourceId);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`${centerSelect} WHERE id=? AND family_id=?`)
        .get(key.centerId, key.familyId) as Record<string, unknown> | undefined;
      return row ? mapCenter(row) : null;
    });
  }

  public findItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: HouseholdOperationsCenterKey,
    itemId: string
  ): RepositoryResult<HouseholdOperationItemRow | null> {
    assertKey(context, key, 'write', context.policyAuthorization.resourceId);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`${itemSelect} WHERE id=? AND center_id=? AND family_id=?`)
        .get(itemId, key.centerId, key.familyId) as Record<string, unknown> | undefined;
      return row ? mapItem(row) : null;
    });
  }

  public findMutationByClientOperationId(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: HouseholdOperationsCenterKey,
    clientOperationId: string
  ): RepositoryResult<HouseholdOperationMutationRow | null> {
    assertKey(context, key, 'write', context.policyAuthorization.resourceId);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        ${mutationSelect} WHERE family_id=? AND actor_account_id=? AND client_operation_id=?
      `).get(key.familyId, key.accountId, clientOperationId) as Record<string, unknown> | undefined;
      return row ? mapMutation(row) : null;
    });
  }

  public insertMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: HouseholdOperationMutationRow
  ): RepositoryResult<void> {
    const binding = writeBinding(context, row);
    if (row.actorAccountId !== context.policyAuthorization.subject.accountId
      || row.actorPersonId !== context.policyAuthorization.subject.personId
      || row.ownerPersonId !== context.policyAuthorization.receiptRecord.request.resource.ownerPersonId
      || row.centerRevision !== row.expectedCenterRevision + 1
      || row.itemRevision !== row.expectedItemRevision + 1) {
      throw new Error('Household operations mutation identity or revision is invalid');
    }
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO household_operation_mutations(
          id,center_id,family_id,item_id,owner_person_id,actor_account_id,actor_person_id,
          mutation_kind,client_operation_id,request_fingerprint,expected_center_revision,
          center_revision,expected_item_revision,item_revision,center_state_fingerprint,
          item_state_fingerprint,occurred_at,policy_receipt_hash,policy_receipt_version,
          policy_receipt_nonce,policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        row.id,row.centerId,row.familyId,row.itemId,row.ownerPersonId,row.actorAccountId,row.actorPersonId,
        row.mutationKind,row.clientOperationId,row.requestFingerprint,row.expectedCenterRevision,
        row.centerRevision,row.expectedItemRevision,row.itemRevision,row.centerStateFingerprint,
        row.itemStateFingerprint,row.occurredAt,binding.receiptHash,binding.receiptVersion,binding.nonce,
        context.correlationId,binding.resourceType,binding.resourceId,binding.action,binding.capability
      );
    });
  }

  public insertCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: HouseholdOperationsCenterRow
  ): RepositoryResult<void> {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType:'household_operation_item', resourceId:context.policyAuthorization.resourceId,
      action:'create', capability:'family.write', correlationId:context.correlationId, resourceFamilyId:row.familyId });
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO household_operations_centers(id,family_id,revision,state_fingerprint,last_mutation_id,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?)
      `).run(row.id,row.familyId,row.revision,row.stateFingerprint,row.lastMutationId,row.createdAt,row.updatedAt);
    });
  }

  public saveCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: HouseholdOperationsCenterRow,
    expectedRevision: number
  ): RepositoryResult<void> {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType:'household_operation_item', resourceId:context.policyAuthorization.resourceId,
      action:context.policyAuthorization.action, capability:'family.write', correlationId:context.correlationId, resourceFamilyId:row.familyId });
    return this.execute(context, () => {
      const result = this.database(context).prepare(`
        UPDATE household_operations_centers
        SET revision=?,state_fingerprint=?,last_mutation_id=?,updated_at=?
        WHERE id=? AND family_id=? AND revision=?
      `).run(row.revision,row.stateFingerprint,row.lastMutationId,row.updatedAt,row.id,row.familyId,expectedRevision);
      if (result.changes !== 1) throw new Error('Household operations center optimistic revision conflict');
    });
  }

  public insertItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: HouseholdOperationItemRow
  ): RepositoryResult<void> {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType:'household_operation_item', resourceId:row.id,
      action:'create', capability:'family.write', correlationId:context.correlationId, resourceFamilyId:row.familyId });
    return this.execute(context, () => this.writeItem(context, row, null));
  }

  public saveItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: HouseholdOperationItemRow,
    expectedRevision: number
  ): RepositoryResult<void> {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType:'household_operation_item', resourceId:row.id,
      action:context.policyAuthorization.action, capability:'family.write', correlationId:context.correlationId, resourceFamilyId:row.familyId });
    return this.execute(context, () => this.writeItem(context, row, expectedRevision));
  }

  private writeItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: HouseholdOperationItemRow,
    expectedRevision: number | null
  ): void {
    const values = [
      row.centerId,row.familyId,row.ownerPersonId,row.kind,row.area,row.title,row.status,row.revision,
      row.parentItemId ?? null,row.assignedPersonId ?? null,row.stockCategory ?? null,row.quantity ?? null,
      row.unit ?? null,row.scheduledAt ?? null,row.dueAt ?? null,row.expiresAt ?? null,row.recurrence ?? null,
      row.amountMinor ?? null,row.currency ?? null,row.splitShares ? JSON.stringify(row.splitShares) : null,
      row.ingredientNames ? JSON.stringify(row.ingredientNames) : null,row.allergenCodes ? JSON.stringify(row.allergenCodes) : null,
      row.avoidedAllergenCodes ? JSON.stringify(row.avoidedAllergenCodes) : null,row.allergyFilterStatus ?? null,
      row.providerLabel ?? null,row.trackingLastFour ?? null,row.guestLabel ?? null,row.accessArea ?? null,
      row.opaquePetReference ?? null,row.note ?? null,row.stateFingerprint,row.lastMutationId,row.updatedAt,row.deletedAt ?? null
    ] as const;
    if (expectedRevision === null) {
      this.database(context).prepare(`
        INSERT INTO household_operation_items(
          id,center_id,family_id,owner_person_id,kind,area,title,status,revision,parent_item_id,
          assigned_person_id,stock_category,quantity,unit,scheduled_at,due_at,expires_at,recurrence,
          amount_minor,currency,split_shares_json,ingredient_names_json,allergen_codes_json,
          avoided_allergen_codes_json,allergy_filter_status,provider_label,tracking_last_four,
          guest_label,access_area,opaque_pet_reference,note,state_fingerprint,last_mutation_id,
          created_at,updated_at,deleted_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(row.id,...values.slice(0,32),row.createdAt,row.updatedAt,row.deletedAt ?? null);
      return;
    }
    const result = this.database(context).prepare(`
      UPDATE household_operation_items SET
        center_id=?,family_id=?,owner_person_id=?,kind=?,area=?,title=?,status=?,revision=?,parent_item_id=?,
        assigned_person_id=?,stock_category=?,quantity=?,unit=?,scheduled_at=?,due_at=?,expires_at=?,recurrence=?,
        amount_minor=?,currency=?,split_shares_json=?,ingredient_names_json=?,allergen_codes_json=?,
        avoided_allergen_codes_json=?,allergy_filter_status=?,provider_label=?,tracking_last_four=?,guest_label=?,
        access_area=?,opaque_pet_reference=?,note=?,state_fingerprint=?,last_mutation_id=?,updated_at=?,deleted_at=?
      WHERE id=? AND revision=?
    `).run(...values,row.id,expectedRevision);
    if (result.changes !== 1) throw new Error('Household operation item optimistic revision conflict');
  }
}
