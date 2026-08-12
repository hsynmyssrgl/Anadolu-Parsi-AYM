import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type {
  LifeRecordView,
  ManagedLifeActivityKind,
  ManagedLifeCategory,
  ManagedLifeDocumentKind,
  ManagedLifeProfileDetails,
  ManagedLifeReminderKind,
  RecordPrivacy
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type LifeAutomationDueProjectionRow,
  type LifeAutomationRunSourceProjectionRow,
  type ManagedLifeActivityLedgerItemRow,
  type ManagedLifeDocumentLedgerItemRow,
  type ManagedLifeLedgerItemRow,
  type ManagedLifeProfileLedgerItemRow,
  type LifePolicyResourceRepositoryPort,
  type LifeProjectionRepositoryPort,
  type LifeRecordRow,
  type LifeRepositoryPort,
  type LifeReportProjection,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';
import { CentralAuthorizationService, isAuthorizationRole } from '@ppt/security';

const mapLifeRecord = (row: Record<string, unknown>): LifeRecordRow => ({
  id: String(row.id),
  familyId: asFamilyId(String(row.family_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  category: String(row.category) as LifeRecordView['category'],
  title: String(row.title),
  status: String(row.status) as LifeRecordView['status'],
  privacy: String(row.privacy) as RecordPrivacy,
  ...(row.starts_at ? { startsAt: asIsoDateTime(String(row.starts_at)) } : {}),
  ...(row.due_at ? { dueAt: asIsoDateTime(String(row.due_at)) } : {}),
  ...(row.provider ? { provider: String(row.provider) } : {}),
  ...(row.reference_no ? { referenceNo: String(row.reference_no) } : {}),
  ...(row.amount !== null && row.amount !== undefined ? { amount: Number(row.amount) } : {}),
  ...(row.currency ? { currency: String(row.currency) } : {}),
  ...(row.location ? { location: String(row.location) } : {}),
  ...(row.notes ? { notes: String(row.notes) } : {}),
  createdAt: asIsoDateTime(String(row.created_at))
});

const managedLifeColumns = `
  ledger.id,ledger.family_id,ledger.owner_person_id,ledger.item_type,
  ledger.parent_record_id,ledger.category,ledger.title,ledger.status,
  ledger.details_json,ledger.starts_at,ledger.ends_at,ledger.reminder_mutation,
  ledger.reminder_kind,ledger.next_reminder_at,ledger.finance_asset_id,
  ledger.activity_kind,ledger.occurred_at,ledger.provider,ledger.amount_minor,
  ledger.currency,ledger.quantity_milliunits,ledger.odometer_km,
  ledger.finance_expense_id,ledger.note,ledger.archive_item_id,
  ledger.document_kind,ledger.label,ledger.privacy,ledger.data_source,
  ledger.external_verification,ledger.payment_execution,ledger.created_at
`;

const mapManagedLifeItem = (row: Record<string, unknown>): ManagedLifeLedgerItemRow => {
  const common = {
    id: String(row.id),
    familyId: asFamilyId(String(row.family_id)),
    ownerPersonId: asPersonId(String(row.owner_person_id)),
    privacy: String(row.privacy) as RecordPrivacy,
    dataSource: 'manual' as const,
    externalVerification: 'not_performed' as const,
    paymentExecution: 'not_performed' as const,
    createdAt: asIsoDateTime(String(row.created_at))
  };
  if (row.item_type === 'profile') {
    return {
      ...common,
      itemType: 'profile',
      category: String(row.category) as ManagedLifeCategory,
      title: String(row.title),
      status: String(row.status) as LifeRecordView['status'],
      details: JSON.parse(String(row.details_json)) as ManagedLifeProfileDetails,
      ...(row.starts_at ? { startsAt: asIsoDateTime(String(row.starts_at)) } : {}),
      ...(row.ends_at ? { endsAt: asIsoDateTime(String(row.ends_at)) } : {}),
      ...(row.reminder_mutation === 'set' ? {
        initialReminder: {
          kind: String(row.reminder_kind) as ManagedLifeReminderKind,
          dueAt: asIsoDateTime(String(row.next_reminder_at))
        }
      } : {}),
      ...(row.finance_asset_id ? { financeAssetId: String(row.finance_asset_id) } : {})
    } as ManagedLifeProfileLedgerItemRow;
  }
  if (row.item_type === 'activity') {
    return {
      ...common,
      itemType: 'activity',
      recordId: String(row.parent_record_id),
      activityKind: String(row.activity_kind) as ManagedLifeActivityKind,
      occurredAt: asIsoDateTime(String(row.occurred_at)),
      ...(row.provider ? { provider: String(row.provider) } : {}),
      ...(row.amount_minor !== null && row.amount_minor !== undefined
        ? { amountMinor: Number(row.amount_minor) }
        : {}),
      ...(row.currency ? { currency: String(row.currency) } : {}),
      ...(row.quantity_milliunits !== null && row.quantity_milliunits !== undefined
        ? { quantityMilliunits: Number(row.quantity_milliunits) }
        : {}),
      ...(row.odometer_km !== null && row.odometer_km !== undefined
        ? { odometerKm: Number(row.odometer_km) }
        : {}),
      ...(row.finance_expense_id ? { financeExpenseId: String(row.finance_expense_id) } : {}),
      financePosting: row.finance_expense_id ? 'linked' : 'not_performed',
      ...(row.reminder_mutation === 'set' ? {
        reminderMutation: {
          action: 'set' as const,
          kind: String(row.reminder_kind) as ManagedLifeReminderKind,
          dueAt: asIsoDateTime(String(row.next_reminder_at))
        }
      } : row.reminder_mutation === 'clear' ? {
        reminderMutation: { action: 'clear' as const }
      } : {}),
      ...(row.note ? { note: String(row.note) } : {})
    } satisfies ManagedLifeActivityLedgerItemRow;
  }
  return {
    ...common,
    itemType: 'document',
    recordId: String(row.parent_record_id),
    archiveItemId: String(row.archive_item_id),
    documentKind: String(row.document_kind) as ManagedLifeDocumentKind,
    ...(row.label ? { label: String(row.label) } : {})
  } satisfies ManagedLifeDocumentLedgerItemRow;
};

interface LifeReadBinding {
  readonly familyId: string;
  readonly accountId: string;
  readonly actorPersonId: string;
  readonly familyRoleAllowed: number;
  readonly occurredAt: string;
}

const centralLifeAuthorization = new CentralAuthorizationService();

const assertReceiptSubject = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  familyId: string
): void => {
  if (context.policyAuthorization.receiptRecord.request.purpose !== 'general') {
    throw new Error('LIFE policy receipt purpose must be general');
  }
  const subject = context.policyAuthorization.subject;
  if (!subject.familyIds.includes(familyId)) {
    throw new Error('LIFE policy receipt subject is outside the resource family');
  }
  if (
    String(context.actor.userId) !== subject.accountId
    || (context.actor.personId === undefined ? undefined : String(context.actor.personId)) !== subject.personId
  ) {
    throw new Error('LIFE repository actor does not match the policy receipt subject');
  }
};

const lifeReadBinding = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  resourceId = '*'
): LifeReadBinding => {
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'life_record',
    resourceId,
    action: 'read',
    capability: 'family.read',
    correlationId: context.correlationId
  });
  const familyId = context.policyAuthorization.resourceFamilyId;
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'life_record',
    resourceId,
    action: 'read',
    capability: 'family.read',
    correlationId: context.correlationId,
    resourceFamilyId: familyId
  });
  assertReceiptSubject(context, familyId);
  const subject = context.policyAuthorization.subject;
  return Object.freeze({
    familyId: asFamilyId(familyId),
    accountId: subject.accountId,
    actorPersonId: subject.personId ?? '',
    familyRoleAllowed: subject.roles.some((role) => isAuthorizationRole(role) && centralLifeAuthorization.authorize({
      accountId: subject.accountId,
      role,
      action: 'read',
      resourceType: 'life_record',
      resourceId,
      occurredAt: context.policyAuthorization.receiptRecord.request.occurredAt,
      purpose: 'general',
      ...(subject.personId ? { actorPersonId: subject.personId } : {})
    }).allowed) ? 1 : 0,
    occurredAt: context.policyAuthorization.receiptRecord.request.occurredAt
  });
};

const lifeVisibilitySql = `
  AND NOT EXISTS (
    SELECT 1 FROM data_lifecycle dl
    WHERE dl.resource_type='life_record'
      AND dl.resource_id=life_records.id
      AND dl.state<>'active'
  )
  AND NOT EXISTS (
    SELECT 1 FROM object_permissions denied
    WHERE denied.subject_account_id=?
      AND denied.resource_type='life_record'
      AND (denied.resource_id=life_records.id OR denied.resource_id='*')
      AND denied.effect='deny'
      AND denied.purpose='general'
      AND denied.starts_at<=?
      AND (denied.ends_at IS NULL OR denied.ends_at>=?)
      AND EXISTS (SELECT 1 FROM json_each(denied.actions) action WHERE action.value='read')
  )
  AND (
    life_records.owner_person_id=?
    OR EXISTS (
      SELECT 1 FROM object_permissions allowed
      WHERE allowed.subject_account_id=?
        AND allowed.resource_type='life_record'
        AND (allowed.resource_id=life_records.id OR allowed.resource_id='*')
        AND allowed.effect='allow'
        AND allowed.purpose='general'
        AND allowed.starts_at<=?
        AND (allowed.ends_at IS NULL OR allowed.ends_at>=?)
        AND EXISTS (SELECT 1 FROM json_each(allowed.actions) action WHERE action.value='read')
    )
    OR (life_records.privacy='family' AND ?=1)
  )
`;

const lifeVisibilityParameters = (binding: LifeReadBinding): readonly unknown[] => [
  binding.accountId,
  binding.occurredAt,
  binding.occurredAt,
  binding.actorPersonId,
  binding.accountId,
  binding.occurredAt,
  binding.occurredAt,
  binding.familyRoleAllowed
];

const managedLifeVisibilitySql = `
  AND NOT EXISTS (
    SELECT 1 FROM data_lifecycle dl
    WHERE dl.resource_type='life_record'
      AND dl.resource_id=profile.id
      AND dl.state<>'active'
  )
  AND NOT EXISTS (
    SELECT 1 FROM object_permissions denied
    WHERE denied.subject_account_id=?
      AND denied.resource_type='life_record'
      AND (denied.resource_id=profile.id OR denied.resource_id='*')
      AND denied.effect='deny'
      AND denied.purpose='general'
      AND denied.starts_at<=?
      AND (denied.ends_at IS NULL OR denied.ends_at>=?)
      AND EXISTS (SELECT 1 FROM json_each(denied.actions) action WHERE action.value='read')
  )
  AND (
    profile.owner_person_id=?
    OR EXISTS (
      SELECT 1 FROM object_permissions allowed
      WHERE allowed.subject_account_id=?
        AND allowed.resource_type='life_record'
        AND (allowed.resource_id=profile.id OR allowed.resource_id='*')
        AND allowed.effect='allow'
        AND allowed.purpose='general'
        AND allowed.starts_at<=?
        AND (allowed.ends_at IS NULL OR allowed.ends_at>=?)
        AND EXISTS (SELECT 1 FROM json_each(allowed.actions) action WHERE action.value='read')
    )
    OR (profile.privacy='family' AND ?=1)
  )
`;

const managedCurrentReminderJoinSql = `
  JOIN life_managed_ledger reminder ON reminder.id=(
    SELECT candidate.id
    FROM life_managed_ledger candidate
    WHERE (candidate.id=profile.id OR candidate.parent_record_id=profile.id)
      AND candidate.reminder_mutation IS NOT NULL
    ORDER BY candidate.created_at DESC,candidate.id DESC
    LIMIT 1
  )
`;

const lifeOwnerProjectionVisibilitySql = `
  AND life_records.owner_person_id=?
  AND NOT EXISTS (
    SELECT 1 FROM data_lifecycle dl
    WHERE dl.resource_type='life_record'
      AND dl.resource_id=life_records.id
      AND dl.state<>'active'
  )
  AND NOT EXISTS (
    SELECT 1 FROM object_permissions denied
    WHERE denied.subject_account_id=?
      AND denied.resource_type='life_record'
      AND (denied.resource_id=life_records.id OR denied.resource_id='*')
      AND denied.effect='deny'
      AND denied.purpose='general'
      AND denied.starts_at<=?
      AND (denied.ends_at IS NULL OR denied.ends_at>=?)
      AND EXISTS (SELECT 1 FROM json_each(denied.actions) action WHERE action.value='read')
  )
`;

const lifeOwnerProjectionParameters = (binding: LifeReadBinding): readonly unknown[] => [
  binding.actorPersonId,
  binding.accountId,
  binding.occurredAt,
  binding.occurredAt
];

const lifeWriteBinding = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  input: {
    readonly familyId: string;
    readonly resourceId: string;
    readonly action: 'create' | 'update';
  }
) => {
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: 'life_record',
    resourceId: input.resourceId,
    action: input.action,
    capability: 'family.write',
    correlationId: context.correlationId,
    resourceFamilyId: input.familyId
  });
  assertReceiptSubject(context, input.familyId);
  const binding = platformPolicyPersistenceBinding(context, 'life_record', input.resourceId);
  if (!binding) throw new Error('LIFE write requires an active platform policy receipt binding');
  return binding;
};

export class SqliteLifeRepository extends SqliteRepository implements
  LifeRepositoryPort,
  LifePolicyResourceRepositoryPort,
  LifeProjectionRepositoryPort {
  public listLifeRecords(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly LifeRecordRow[]> {
    const visibility = lifeReadBinding(context);
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT id,family_id,owner_person_id,category,title,status,privacy,starts_at,due_at,
          provider,reference_no,amount,currency,location,notes,created_at
        FROM life_records
        WHERE family_id=?
          ${lifeVisibilitySql}
        ORDER BY COALESCE(due_at,starts_at,created_at) DESC,id
      `).all(visibility.familyId, ...lifeVisibilityParameters(visibility)) as ReadonlyArray<Record<string, unknown>>
    ).map(mapLifeRecord));
  }

  public findLifeRecordForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<LifeRecordRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT id,family_id,owner_person_id,category,title,status,privacy,starts_at,due_at,
          provider,reference_no,amount,currency,location,notes,created_at
        FROM life_records
        WHERE id=?
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle dl
            WHERE dl.resource_type='life_record'
              AND dl.resource_id=life_records.id
              AND dl.state<>'active'
          )
      `).get(id) as Record<string, unknown> | undefined;
      return row ? mapLifeRecord(row) : null;
    });
  }

  public insertLifeRecord(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: LifeRecordRow
  ): RepositoryResult<void> {
    const policy = lifeWriteBinding(context, {
      familyId: row.familyId,
      resourceId: row.id,
      action: 'create'
    });
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO life_records(
          id,family_id,owner_person_id,category,title,status,privacy,starts_at,due_at,
          provider,reference_no,amount,currency,location,notes,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        row.id,
        row.familyId,
        row.ownerPersonId,
        row.category,
        row.title,
        row.status,
        row.privacy,
        row.startsAt ?? null,
        row.dueAt ?? null,
        row.provider ?? null,
        row.referenceNo ?? null,
        row.amount ?? null,
        row.currency ?? null,
        row.location ?? null,
        row.notes ?? null,
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
      this.database(context).prepare(
        "INSERT OR IGNORE INTO data_lifecycle(resource_type,resource_id,owner_person_id,privacy,state,updated_at) VALUES('life_record',?,?,?,'active',?)"
      ).run(row.id, row.ownerPersonId, row.privacy, row.createdAt);
    });
  }

  public listManagedLifeItems(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly ManagedLifeLedgerItemRow[]> {
    const visibility = lifeReadBinding(context);
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT ${managedLifeColumns}
        FROM life_managed_ledger ledger
        JOIN life_managed_ledger profile
          ON profile.id=CASE WHEN ledger.item_type='profile' THEN ledger.id ELSE ledger.parent_record_id END
          AND profile.item_type='profile'
        WHERE profile.family_id=?
          ${managedLifeVisibilitySql}
        ORDER BY ledger.created_at DESC,ledger.id
      `).all(
        visibility.familyId,
        ...lifeVisibilityParameters(visibility)
      ) as ReadonlyArray<Record<string, unknown>>
    ).map(mapManagedLifeItem));
  }

  public findManagedLifeProfile(
    context: PolicyAuthorizedRepositoryExecutionContext,
    id: string
  ): RepositoryResult<ManagedLifeProfileLedgerItemRow | null> {
    const visibility = lifeReadBinding(context, id);
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT ${managedLifeColumns}
        FROM life_managed_ledger ledger
        JOIN life_managed_ledger profile ON profile.id=ledger.id AND profile.item_type='profile'
        WHERE ledger.id=? AND profile.family_id=?
          ${managedLifeVisibilitySql}
      `).get(
        id,
        visibility.familyId,
        ...lifeVisibilityParameters(visibility)
      ) as Record<string, unknown> | undefined;
      return row ? mapManagedLifeItem(row) as ManagedLifeProfileLedgerItemRow : null;
    });
  }

  public findManagedLifeProfileForPolicyResolution(
    context: RepositoryExecutionContext,
    id: string
  ): RepositoryResult<ManagedLifeProfileLedgerItemRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT ${managedLifeColumns}
        FROM life_managed_ledger ledger
        WHERE ledger.id=? AND ledger.item_type='profile'
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle dl
            WHERE dl.resource_type='life_record'
              AND dl.resource_id=ledger.id
              AND dl.state<>'active'
          )
      `).get(id) as Record<string, unknown> | undefined;
      return row ? mapManagedLifeItem(row) as ManagedLifeProfileLedgerItemRow : null;
    });
  }

  public insertManagedLifeItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: ManagedLifeLedgerItemRow
  ): RepositoryResult<void> {
    if (
      row.dataSource !== 'manual'
      || row.externalVerification !== 'not_performed'
      || row.paymentExecution !== 'not_performed'
      || (row.itemType === 'activity'
        && row.financePosting !== (row.financeExpenseId ? 'linked' : 'not_performed'))
    ) {
      throw new Error('Managed LIFE item contains a non-local or inconsistent execution claim');
    }
    const parentProfileId = row.itemType === 'profile' ? undefined : row.recordId;
    const action = row.itemType === 'profile' ? 'create' : 'update';
    const resourceId = parentProfileId ?? row.id;
    const policy = lifeWriteBinding(context, {
      familyId: row.familyId,
      resourceId,
      action
    });
    const reminderMutation = row.itemType === 'profile'
      ? row.initialReminder ? { action: 'set' as const, ...row.initialReminder } : undefined
      : row.itemType === 'activity'
        ? row.reminderMutation
        : undefined;
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO life_managed_ledger(
          id,family_id,owner_person_id,item_type,parent_record_id,category,title,status,
          details_json,starts_at,ends_at,reminder_mutation,reminder_kind,next_reminder_at,
          finance_asset_id,activity_kind,occurred_at,provider,amount_minor,currency,
          quantity_milliunits,odometer_km,finance_expense_id,note,archive_item_id,
          document_kind,label,privacy,data_source,external_verification,payment_execution,
          created_at,policy_receipt_hash,policy_receipt_version,
          policy_receipt_nonce,policy_correlation_id,policy_resource_type,policy_resource_id,
          policy_action,policy_capability
        ) VALUES(${Array.from({ length: 40 }, () => '?').join(',')})
      `).run(
        row.id,
        row.familyId,
        row.ownerPersonId,
        row.itemType,
        parentProfileId ?? null,
        row.itemType === 'profile' ? row.category : null,
        row.itemType === 'profile' ? row.title : null,
        row.itemType === 'profile' ? row.status : null,
        row.itemType === 'profile' ? JSON.stringify(row.details) : null,
        row.itemType === 'profile' ? row.startsAt ?? null : null,
        row.itemType === 'profile' ? row.endsAt ?? null : null,
        reminderMutation?.action ?? null,
        reminderMutation?.action === 'set' ? reminderMutation.kind : null,
        reminderMutation?.action === 'set' ? reminderMutation.dueAt : null,
        row.itemType === 'profile' ? row.financeAssetId ?? null : null,
        row.itemType === 'activity' ? row.activityKind : null,
        row.itemType === 'activity' ? row.occurredAt : null,
        row.itemType === 'activity' ? row.provider ?? null : null,
        row.itemType === 'activity' ? row.amountMinor ?? null : null,
        row.itemType === 'activity' ? row.currency ?? null : null,
        row.itemType === 'activity' ? row.quantityMilliunits ?? null : null,
        row.itemType === 'activity' ? row.odometerKm ?? null : null,
        row.itemType === 'activity' ? row.financeExpenseId ?? null : null,
        row.itemType === 'activity' ? row.note ?? null : null,
        row.itemType === 'document' ? row.archiveItemId : null,
        row.itemType === 'document' ? row.documentKind : null,
        row.itemType === 'document' ? row.label ?? null : null,
        row.privacy,
        row.dataSource,
        row.externalVerification,
        row.paymentExecution,
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
      if (row.itemType === 'profile') {
        this.database(context).prepare(
          "INSERT INTO data_lifecycle(resource_type,resource_id,owner_person_id,privacy,state,updated_at) VALUES('life_record',?,?,?,'active',?)"
        ).run(row.id, row.ownerPersonId, row.privacy, row.createdAt);
      }
    });
  }

  public listAutomationDueLife(
    context: PolicyAuthorizedRepositoryExecutionContext,
    input: { readonly fromAt: import('@ppt/core').IsoDateTime; readonly toAt: import('@ppt/core').IsoDateTime }
  ): RepositoryResult<readonly LifeAutomationDueProjectionRow[]> {
    const visibility = lifeReadBinding(context);
    return this.execute(context, () => {
      const legacyRows = this.database(context).prepare(`
        SELECT id,title,due_at
        FROM life_records
        WHERE family_id=?
          AND due_at IS NOT NULL
          AND due_at>=?
          AND due_at<=?
          AND status IN ('planned','active')
          ${lifeOwnerProjectionVisibilitySql}
        ORDER BY due_at,id
      `).all(
        visibility.familyId,
        input.fromAt,
        input.toAt,
        ...lifeOwnerProjectionParameters(visibility)
      ) as ReadonlyArray<Record<string, unknown>>;
      const managedLedgerAvailable = Boolean(this.database(context).prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='life_managed_ledger'"
      ).get());
      const managedRows = managedLedgerAvailable ? this.database(context).prepare(`
        SELECT reminder.id,profile.title,reminder.next_reminder_at AS due_at
        FROM life_managed_ledger profile
        ${managedCurrentReminderJoinSql}
        WHERE profile.item_type='profile'
          AND profile.family_id=?
          AND profile.status IN ('planned','active')
          AND reminder.reminder_mutation='set'
          AND reminder.next_reminder_at>=?
          AND reminder.next_reminder_at<=?
          ${managedLifeVisibilitySql}
        ORDER BY reminder.next_reminder_at,reminder.id
      `).all(
        visibility.familyId,
        input.fromAt,
        input.toAt,
        ...lifeVisibilityParameters(visibility)
      ) as ReadonlyArray<Record<string, unknown>> : [];
      return [...legacyRows, ...managedRows].map((row) => ({
      id: String(row.id),
      title: String(row.title),
      dueAt: asIsoDateTime(String(row.due_at))
      })).sort((left, right) => left.dueAt.localeCompare(right.dueAt) || left.id.localeCompare(right.id));
    });
  }

  public listVisibleAutomationLifeRunSources(
    context: PolicyAuthorizedRepositoryExecutionContext,
    ids: readonly string[]
  ): RepositoryResult<readonly LifeAutomationRunSourceProjectionRow[]> {
    const visibility = lifeReadBinding(context);
    const distinctIds = [...new Set(ids.filter((id) => id.length > 0))];
    if (distinctIds.length === 0) return { ok: true, value: [] };
    if (distinctIds.length > 500) {
      throw new Error('LIFE automation run-source lookup is limited to 500 ids');
    }
    const placeholders = distinctIds.map(() => '?').join(',');
    return this.execute(context, () => {
      const legacyRows = this.database(context).prepare(`
        SELECT id,title,due_at
        FROM life_records
        WHERE family_id=?
          AND id IN (${placeholders})
          ${lifeVisibilitySql}
        ORDER BY id
      `).all(
        visibility.familyId,
        ...distinctIds,
        ...lifeVisibilityParameters(visibility)
      ) as ReadonlyArray<Record<string, unknown>>;
      const managedLedgerAvailable = Boolean(this.database(context).prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='life_managed_ledger'"
      ).get());
      const managedRows = managedLedgerAvailable ? this.database(context).prepare(`
        SELECT reminder.id,profile.title,reminder.next_reminder_at AS due_at
        FROM life_managed_ledger profile
        ${managedCurrentReminderJoinSql}
        WHERE profile.item_type='profile'
          AND profile.family_id=?
          AND profile.status IN ('planned','active')
          AND reminder.reminder_mutation='set'
          AND reminder.id IN (${placeholders})
          ${managedLifeVisibilitySql}
        ORDER BY reminder.id
      `).all(
        visibility.familyId,
        ...distinctIds,
        ...lifeVisibilityParameters(visibility)
      ) as ReadonlyArray<Record<string, unknown>> : [];
      return [...legacyRows, ...managedRows].map((row) => ({
        id: String(row.id),
        title: String(row.title),
        ...(row.due_at ? { dueAt: asIsoDateTime(String(row.due_at)) } : {})
      })).sort((left, right) => left.id.localeCompare(right.id));
    });
  }

  public getLifeReportProjection(
    context: PolicyAuthorizedRepositoryExecutionContext,
    input: {
      readonly now: import('@ppt/core').IsoDateTime;
      readonly in30Days: import('@ppt/core').IsoDateTime;
      readonly overdueLimit?: number;
    }
  ): RepositoryResult<LifeReportProjection> {
    const visibility = lifeReadBinding(context);
    const overdueLimit = Math.max(0, Math.min(100, Math.trunc(input.overdueLimit ?? 25)));
    return this.execute(context, () => {
      const projection = this.database(context).prepare(`
        SELECT
          SUM(CASE WHEN category='task' AND status IN ('planned','active') THEN 1 ELSE 0 END) active_tasks,
          SUM(CASE WHEN category='insurance' AND status='active' AND due_at IS NOT NULL AND due_at<=? THEN 1 ELSE 0 END) expiring_insurance
        FROM life_records
        WHERE family_id=?
          ${lifeOwnerProjectionVisibilitySql}
      `).get(
        input.in30Days,
        visibility.familyId,
        ...lifeOwnerProjectionParameters(visibility)
      ) as Record<string, unknown>;
      const overdueItems = (this.database(context).prepare(`
        SELECT id,title,due_at
        FROM life_records
        WHERE family_id=?
          AND due_at IS NOT NULL
          AND due_at<?
          AND status IN ('planned','active')
          ${lifeOwnerProjectionVisibilitySql}
        ORDER BY due_at,id
        LIMIT ?
      `).all(
        visibility.familyId,
        input.now,
        ...lifeOwnerProjectionParameters(visibility),
        overdueLimit
      ) as ReadonlyArray<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        title: String(row.title),
        sourceType: 'life_record' as const,
        dueAt: asIsoDateTime(String(row.due_at))
      }));
      return {
        activeTasks: Number(projection.active_tasks ?? 0),
        expiringInsurance: Number(projection.expiring_insurance ?? 0),
        overdueItems
      };
    });
  }
}
