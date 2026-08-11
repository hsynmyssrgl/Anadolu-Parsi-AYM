import { asFamilyId, asIsoDateTime, asPersonId, type FamilyId } from '@ppt/core';
import type { FamilyLocationView } from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type LocationPolicyResourceRecord,
  type LocationPolicyResourceRepositoryPort,
  type LocationRecord,
  type LocationRepositoryPort,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const mapLocation = (row: Record<string, unknown>): LocationRecord => ({
  id: String(row.id),
  familyId: asFamilyId(String(row.family_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  label: String(row.label),
  ...(row.address ? { address: String(row.address) } : {}),
  ...(row.latitude !== null && row.latitude !== undefined ? { latitude: Number(row.latitude) } : {}),
  ...(row.longitude !== null && row.longitude !== undefined ? { longitude: Number(row.longitude) } : {}),
  kind: String(row.kind) as FamilyLocationView['kind'],
  createdAt: asIsoDateTime(String(row.created_at))
});

interface LocationReadBinding {
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly actorPersonId: string;
  readonly occurredAt: string;
}

const assertLocationReceiptSubject = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  familyId: FamilyId
): void => {
  const authorization = context.policyAuthorization;
  const request = authorization.receiptRecord.request;
  if (
    request.purpose !== 'general'
    || request.resource.familyId !== familyId
    || request.resource.sensitivity !== 'highly_sensitive'
    || !authorization.subject.familyIds.includes(familyId)
  ) {
    throw new Error('Location policy receipt family, classification or purpose is invalid');
  }
  if (
    String(context.actor.userId) !== authorization.subject.accountId
    || (context.actor.personId === undefined ? undefined : String(context.actor.personId)) !== authorization.subject.personId
  ) {
    throw new Error('Location repository actor does not match the policy receipt subject');
  }
};

const locationReadBinding = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  familyId: FamilyId,
  resourceId: string
): LocationReadBinding => {
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'location',
    resourceId,
    action: 'read',
    capability: 'location.read',
    correlationId: context.correlationId,
    resourceFamilyId: familyId
  });
  if (context.policyAuthorization.resourceFamilyId !== familyId) {
    throw new Error('Location repository family does not match the policy receipt family');
  }
  assertLocationReceiptSubject(context, familyId);
  return Object.freeze({
    familyId,
    accountId: context.policyAuthorization.subject.accountId,
    actorPersonId: context.policyAuthorization.subject.personId ?? '',
    occurredAt: context.policyAuthorization.receiptRecord.request.occurredAt
  });
};

const locationProvenanceSql = `
  AND locations.owner_person_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM platform_policy_transaction_receipts create_receipt
    JOIN platform_policy_journal_projection_outbox create_projection
      ON create_projection.receipt_hash=create_receipt.receipt_hash
     AND create_projection.record_json=create_receipt.record_json
    WHERE create_receipt.receipt_hash=locations.policy_receipt_hash
      AND create_receipt.receipt_version=locations.policy_receipt_version
      AND create_receipt.nonce=locations.policy_receipt_nonce
      AND create_receipt.correlation_id=locations.policy_correlation_id
      AND create_receipt.resource_type=locations.policy_resource_type
      AND create_receipt.resource_id=locations.policy_resource_id
      AND create_receipt.action=locations.policy_action
      AND create_receipt.capability=locations.policy_capability
      AND create_receipt.resource_type='location'
      AND create_receipt.resource_id=locations.id
      AND create_receipt.action='create'
      AND create_receipt.capability='family.write'
      AND json_extract(create_receipt.record_json,'$.request.resource.familyId')=locations.family_id
      AND json_extract(create_receipt.record_json,'$.request.resource.ownerPersonId')=locations.owner_person_id
      AND json_extract(create_receipt.record_json,'$.request.subject.personId')=locations.owner_person_id
      AND json_extract(create_receipt.record_json,'$.request.resource.sensitivity')='highly_sensitive'
      AND json_extract(create_receipt.record_json,'$.request.purpose')='general'
  )
  AND EXISTS (
    SELECT 1 FROM people location_owner
    WHERE location_owner.id=locations.owner_person_id
      AND location_owner.family_id=locations.family_id
      AND location_owner.status='active'
  )
  AND NOT EXISTS (
    SELECT 1 FROM data_lifecycle lifecycle
    WHERE lifecycle.resource_type='location'
      AND lifecycle.resource_id=locations.id
      AND lifecycle.state<>'active'
  )
`;

const locationVisibilitySql = `
  ${locationProvenanceSql}
  AND NOT EXISTS (
    SELECT 1 FROM object_permissions denied
    WHERE denied.subject_account_id=?
      AND denied.resource_type='location'
      AND (denied.resource_id=locations.id OR denied.resource_id='*')
      AND denied.effect='deny'
      AND denied.purpose='general'
      AND denied.starts_at<=?
      AND (denied.ends_at IS NULL OR denied.ends_at>=?)
      AND EXISTS (SELECT 1 FROM json_each(denied.actions) action WHERE action.value='read')
  )
  AND (
    locations.owner_person_id=?
    OR EXISTS (
      SELECT 1 FROM object_permissions allowed
      WHERE allowed.subject_account_id=?
        AND allowed.resource_type='location'
        AND (allowed.resource_id=locations.id OR allowed.resource_id='*')
        AND allowed.effect='allow'
        AND allowed.purpose='general'
        AND allowed.starts_at<=?
        AND allowed.ends_at IS NOT NULL
        AND allowed.ends_at>=?
        AND EXISTS (SELECT 1 FROM json_each(allowed.actions) action WHERE action.value='read')
    )
  )
`;

const locationVisibilityParameters = (binding: LocationReadBinding): readonly unknown[] => [
  binding.accountId,
  binding.occurredAt,
  binding.occurredAt,
  binding.actorPersonId,
  binding.accountId,
  binding.occurredAt,
  binding.occurredAt
];

const locationWriteBinding = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  location: LocationRecord
) => {
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'location',
    resourceId: location.id,
    action: 'create',
    capability: 'family.write',
    correlationId: context.correlationId,
    resourceFamilyId: location.familyId
  });
  assertLocationReceiptSubject(context, location.familyId);
  const request = context.policyAuthorization.receiptRecord.request;
  if (
    !context.policyAuthorization.subject.personId
    || context.policyAuthorization.subject.personId !== location.ownerPersonId
    || request.resource.ownerPersonId !== location.ownerPersonId
  ) {
    throw new Error('Location owner must be the active policy receipt subject');
  }
  const binding = platformPolicyPersistenceBinding(context, 'location', location.id);
  if (!binding) throw new Error('Location write requires an active platform policy receipt binding');
  return binding;
};

export class SqliteLocationRepository extends SqliteRepository implements
  LocationRepositoryPort,
  LocationPolicyResourceRepositoryPort {
  public findById(
    context: PolicyAuthorizedRepositoryExecutionContext,
    familyId: FamilyId,
    locationId: string
  ): RepositoryResult<LocationRecord | null> {
    const visibility = locationReadBinding(context, familyId, locationId);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,family_id,owner_person_id,label,address,latitude,longitude,kind,created_at
        FROM locations
        WHERE id=? AND family_id=?
          ${locationVisibilitySql}
      `).get(locationId, familyId, ...locationVisibilityParameters(visibility)) as Record<string, unknown> | undefined;
      return row ? mapLocation(row) : null;
    });
  }

  public findLocationForPolicyResolution(
    context: RepositoryExecutionContext,
    locationId: string
  ): RepositoryResult<LocationPolicyResourceRecord | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,family_id,owner_person_id,policy_receipt_hash
        FROM locations
        WHERE id=?
          ${locationProvenanceSql}
      `).get(locationId) as Record<string, unknown> | undefined;
      return row ? {
        id: String(row.id),
        familyId: asFamilyId(String(row.family_id)),
        ownerPersonId: asPersonId(String(row.owner_person_id)),
        createReceiptHash: String(row.policy_receipt_hash)
      } : null;
    });
  }

  public insert(
    context: PolicyAuthorizedRepositoryExecutionContext,
    location: LocationRecord
  ): RepositoryResult<void> {
    const policy = locationWriteBinding(context, location);
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO locations(
          id,family_id,owner_person_id,label,address,latitude,longitude,kind,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        location.id,
        location.familyId,
        location.ownerPersonId,
        location.label,
        location.address ?? null,
        location.latitude ?? null,
        location.longitude ?? null,
        location.kind,
        location.createdAt,
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

  public listByFamily(
    context: PolicyAuthorizedRepositoryExecutionContext,
    familyId: FamilyId
  ): RepositoryResult<readonly LocationRecord[]> {
    const visibility = locationReadBinding(context, familyId, '*');
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT id,family_id,owner_person_id,label,address,latitude,longitude,kind,created_at
        FROM locations
        WHERE family_id=?
          ${locationVisibilitySql}
        ORDER BY label COLLATE NOCASE,id
      `).all(familyId, ...locationVisibilityParameters(visibility)) as ReadonlyArray<Record<string, unknown>>
    ).map(mapLocation));
  }
}
