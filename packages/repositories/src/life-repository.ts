import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type {
  FamilyEmergencyCardFieldCode,
  FamilyEmergencyCardOutputMode,
  FamilyEmergencyCardPortabilityItemType,
  FamilyEmergencyCardPowerActivationSource,
  FamilyEmergencyCardPowerMode,
  FamilyEmergencyCardPowerSource,
  FamilyEmergencyCardSourceItemType,
  FamilyEmergencyAssistanceInstructionKind,
  FamilyEmergencyAssistanceItemType,
  FamilyEmergencyAssistanceSubjectKind,
  FamilyEmergencyBloodType,
  FamilyEmergencyChecklistStatus,
  FamilyEmergencyDrillKind,
  FamilyEmergencyDrillStatus,
  FamilyEmergencyItemType,
  FamilyEmergencyMeetingPointKind,
  FamilyEmergencyMemberStatus,
  FamilyEmergencyHealthFactKind,
  FamilyEmergencyPlanKind,
  FamilyEmergencyPreparednessCheckStatus,
  FamilyEmergencyPreparednessItemType,
  FamilyEmergencyPreparednessKitItemCategory,
  FamilyEmergencyPreparednessKitKind,
  FamilyEmergencyPreparednessQuantityUnit,
  LifeRecordView,
  ManagedHomeBelongingKind,
  ManagedHomeDocumentKind,
  ManagedHomeDocumentTargetType,
  ManagedHomeInventoryItemType,
  ManagedHomeMeterKind,
  ManagedHomeMeterReadingKind,
  ManagedHomeMeterReadingUnit,
  ManagedHomeRoomKind,
  ManagedHomeServiceKind,
  ManagedHomeServiceTargetType,
  ManagedLifeActivityKind,
  ManagedLifeCategory,
  ManagedLifeDocumentKind,
  ManagedLifeProfileDetails,
  ManagedLifeReminderKind,
  RecordPrivacy
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type FamilyEmergencyCardConfigurationLedgerItemRow,
  type FamilyEmergencyCardPortabilityLedgerItemRow,
  type FamilyEmergencyAssistanceLedgerItemRow,
  type FamilyEmergencyAssistanceProfileLedgerItemRow,
  type FamilyEmergencyLedgerItemRow,
  type FamilyEmergencyPlanLedgerItemRow,
  type FamilyEmergencyPreparednessLedgerItemRow,
  type LifeAutomationDueProjectionRow,
  type LifeAutomationRunSourceProjectionRow,
  type ManagedHomeInventoryLedgerItemRow,
  type ManagedHomeInventoryMeterReadingLedgerItemRow,
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

const managedHomeInventoryColumns = `
  inventory.id,inventory.home_profile_id,inventory.family_id,inventory.owner_person_id,
  inventory.item_type,inventory.parent_item_id,inventory.supersedes_item_id,
  inventory.name,inventory.room_kind,inventory.label,inventory.meter_kind,
  inventory.reading_unit,inventory.reading_milliunits,inventory.reading_kind,
  inventory.belonging_kind,inventory.serial_number,inventory.purchased_at,
  inventory.starts_at,inventory.ends_at,inventory.reminder_at,inventory.target_type,
  inventory.service_kind,inventory.occurred_at,inventory.provider,inventory.amount_minor,
  inventory.currency,inventory.finance_expense_id,inventory.archive_item_id,
  inventory.document_kind,inventory.note,inventory.privacy,inventory.data_source,
  inventory.external_verification,inventory.payment_execution,inventory.created_at
`;

const maskSerialNumber = (serialNumber: string): string => {
  const suffix = serialNumber.slice(-4);
  return `${'*'.repeat(Math.max(4, Math.min(12, serialNumber.length - suffix.length)))}${suffix}`;
};

const mapManagedHomeInventoryItem = (
  row: Record<string, unknown>,
  includeRawSerial = false
): ManagedHomeInventoryLedgerItemRow => {
  const common = {
    id: String(row.id),
    recordId: String(row.home_profile_id),
    familyId: asFamilyId(String(row.family_id)),
    ownerPersonId: asPersonId(String(row.owner_person_id)),
    privacy: String(row.privacy) as RecordPrivacy,
    ...(row.supersedes_item_id ? { supersedesItemId: String(row.supersedes_item_id) } : {}),
    dataSource: 'manual' as const,
    externalVerification: 'not_performed' as const,
    paymentExecution: 'not_performed' as const,
    createdAt: asIsoDateTime(String(row.created_at))
  };
  const itemType = String(row.item_type) as ManagedHomeInventoryItemType;
  if (itemType === 'room') return {
    ...common,
    itemType,
    name: String(row.name),
    roomKind: String(row.room_kind) as ManagedHomeRoomKind
  };
  if (itemType === 'meter') return {
    ...common,
    itemType,
    ...(row.parent_item_id ? { roomId: String(row.parent_item_id) } : {}),
    label: String(row.label),
    meterKind: String(row.meter_kind) as ManagedHomeMeterKind,
    readingUnit: String(row.reading_unit) as ManagedHomeMeterReadingUnit
  };
  if (itemType === 'meter_reading') return {
    ...common,
    itemType,
    meterId: String(row.parent_item_id),
    readingKind: String(row.reading_kind) as ManagedHomeMeterReadingKind,
    readingMilliunits: Number(row.reading_milliunits),
    recordedAt: asIsoDateTime(String(row.occurred_at)),
    ...(row.note ? { note: String(row.note) } : {})
  };
  if (itemType === 'belonging') return {
    ...common,
    itemType,
    ...(row.parent_item_id ? { roomId: String(row.parent_item_id) } : {}),
    name: String(row.name),
    belongingKind: String(row.belonging_kind) as ManagedHomeBelongingKind,
    ...(row.serial_number ? {
      ...(includeRawSerial ? { serialNumber: String(row.serial_number) } : {}),
      serialNumberMasked: maskSerialNumber(String(row.serial_number))
    } : {}),
    ...(row.purchased_at ? { purchasedAt: asIsoDateTime(String(row.purchased_at)) } : {}),
    ...(row.amount_minor !== null && row.amount_minor !== undefined
      ? { purchaseAmountMinor: Number(row.amount_minor) }
      : {}),
    ...(row.currency ? { currency: String(row.currency) } : {}),
    ...(row.finance_expense_id ? { financeExpenseId: String(row.finance_expense_id) } : {}),
    financePosting: row.finance_expense_id ? 'linked' : 'not_performed'
  };
  if (itemType === 'warranty') return {
    ...common,
    itemType,
    belongingId: String(row.parent_item_id),
    ...(row.provider ? { provider: String(row.provider) } : {}),
    startsAt: asIsoDateTime(String(row.starts_at)),
    endsAt: asIsoDateTime(String(row.ends_at)),
    ...(row.reminder_at ? { reminderAt: asIsoDateTime(String(row.reminder_at)) } : {}),
    ...(row.note ? { note: String(row.note) } : {})
  };
  if (itemType === 'service') return {
    ...common,
    itemType,
    targetItemId: String(row.parent_item_id),
    targetType: String(row.target_type) as ManagedHomeServiceTargetType,
    serviceKind: String(row.service_kind) as ManagedHomeServiceKind,
    occurredAt: asIsoDateTime(String(row.occurred_at)),
    ...(row.provider ? { provider: String(row.provider) } : {}),
    ...(row.amount_minor !== null && row.amount_minor !== undefined
      ? { amountMinor: Number(row.amount_minor) }
      : {}),
    ...(row.currency ? { currency: String(row.currency) } : {}),
    ...(row.finance_expense_id ? { financeExpenseId: String(row.finance_expense_id) } : {}),
    financePosting: row.finance_expense_id ? 'linked' : 'not_performed',
    ...(row.note ? { note: String(row.note) } : {})
  };
  return {
    ...common,
    itemType: 'document',
    targetItemId: String(row.parent_item_id),
    targetType: String(row.target_type) as ManagedHomeDocumentTargetType,
    archiveItemId: String(row.archive_item_id),
    documentKind: String(row.document_kind) as ManagedHomeDocumentKind,
    ...(row.label ? { label: String(row.label) } : {})
  };
};

const familyEmergencyColumns = `
  emergency.id,emergency.family_id,emergency.owner_person_id,emergency.item_type,
  emergency.plan_id,emergency.parent_item_id,emergency.supersedes_item_id,
  emergency.plan_kind,emergency.title,emergency.evacuation_instructions,
  emergency.meeting_point_kind,emergency.label,emergency.address,emergency.directions,
  emergency.contact_name,emergency.phone_e164,emergency.city,emergency.sort_order,
  emergency.checklist_status,emergency.member_person_id,emergency.reported_by_person_id,
  emergency.member_status,emergency.occurred_at,emergency.note,emergency.privacy,
  emergency.data_source,emergency.created_at
`;

const mapFamilyEmergencyItem = (row:Record<string, unknown>):FamilyEmergencyLedgerItemRow => {
  const common = {
    id: String(row.id),
    familyId: asFamilyId(String(row.family_id)),
    ownerPersonId: asPersonId(String(row.owner_person_id)),
    privacy: 'family' as const,
    dataSource: 'manual' as const,
    createdAt: asIsoDateTime(String(row.created_at))
  };
  const itemType = String(row.item_type) as FamilyEmergencyItemType;
  if (itemType === 'emergency_plan') return {
    ...common,
    itemType,
    planKind: String(row.plan_kind) as FamilyEmergencyPlanKind,
    title: String(row.title),
    evacuationInstructions: String(row.evacuation_instructions)
  };
  const child = { ...common, planId: String(row.plan_id) };
  if (itemType === 'meeting_point') return {
    ...child,
    itemType,
    ...(row.supersedes_item_id ? { supersedesItemId: String(row.supersedes_item_id) } : {}),
    meetingPointKind: String(row.meeting_point_kind) as FamilyEmergencyMeetingPointKind,
    label: String(row.label),
    ...(row.address ? { address: String(row.address) } : {}),
    ...(row.directions ? { directions: String(row.directions) } : {})
  };
  if (itemType === 'external_contact') return {
    ...child,
    itemType,
    ...(row.supersedes_item_id ? { supersedesItemId: String(row.supersedes_item_id) } : {}),
    name: String(row.contact_name),
    phoneE164: String(row.phone_e164),
    city: String(row.city),
    ...(row.note ? { note: String(row.note) } : {})
  };
  if (itemType === 'checklist_item') return {
    ...child,
    itemType,
    ...(row.supersedes_item_id ? { supersedesItemId: String(row.supersedes_item_id) } : {}),
    label: String(row.label),
    sortOrder: Number(row.sort_order)
  };
  if (itemType === 'checklist_status') return {
    ...child,
    itemType,
    checklistItemId: String(row.parent_item_id),
    status: String(row.checklist_status) as FamilyEmergencyChecklistStatus
  };
  return {
    ...child,
    itemType: 'member_status',
    memberPersonId: asPersonId(String(row.member_person_id)),
    reportedByPersonId: asPersonId(String(row.reported_by_person_id)),
    status: String(row.member_status) as FamilyEmergencyMemberStatus,
    occurredAt: asIsoDateTime(String(row.occurred_at)),
    ...(row.note ? { note: String(row.note) } : {})
  };
};

const familyEmergencyPreparednessColumns = `
  preparedness.id,preparedness.plan_id,preparedness.family_id,preparedness.owner_person_id,
  preparedness.item_type,preparedness.parent_item_id,preparedness.supersedes_item_id,
  preparedness.kit_kind,preparedness.category,preparedness.label,
  preparedness.target_quantity_milliunits,preparedness.quantity_unit,preparedness.expires_on,
  preparedness.check_status,preparedness.actual_quantity_milliunits,preparedness.checked_at,
  preparedness.drill_kind,preparedness.drill_status,preparedness.occurred_at,
  preparedness.duration_seconds,preparedness.note,preparedness.privacy,
  preparedness.data_source,preparedness.created_at
`;

const mapFamilyEmergencyPreparednessItem = (
  row:Record<string, unknown>
):FamilyEmergencyPreparednessLedgerItemRow => {
  const common = {
    id:String(row.id),
    planId:String(row.plan_id),
    familyId:asFamilyId(String(row.family_id)),
    ownerPersonId:asPersonId(String(row.owner_person_id)),
    privacy:'family' as const,
    dataSource:'manual' as const,
    createdAt:asIsoDateTime(String(row.created_at))
  };
  const itemType = String(row.item_type) as FamilyEmergencyPreparednessItemType;
  if (itemType === 'preparedness_kit') return {
    ...common,
    itemType,
    ...(row.supersedes_item_id ? { supersedesItemId:String(row.supersedes_item_id) } : {}),
    kitKind:String(row.kit_kind) as FamilyEmergencyPreparednessKitKind,
    label:String(row.label)
  };
  if (itemType === 'preparedness_kit_item') return {
    ...common,
    itemType,
    kitId:String(row.parent_item_id),
    ...(row.supersedes_item_id ? { supersedesItemId:String(row.supersedes_item_id) } : {}),
    category:String(row.category) as FamilyEmergencyPreparednessKitItemCategory,
    label:String(row.label),
    targetQuantityMilliunits:Number(row.target_quantity_milliunits),
    quantityUnit:String(row.quantity_unit) as FamilyEmergencyPreparednessQuantityUnit,
    ...(row.expires_on ? { expiresOn:String(row.expires_on) } : {})
  };
  if (itemType === 'preparedness_kit_check') return {
    ...common,
    itemType,
    kitItemId:String(row.parent_item_id),
    status:String(row.check_status) as FamilyEmergencyPreparednessCheckStatus,
    actualQuantityMilliunits:Number(row.actual_quantity_milliunits),
    checkedAt:asIsoDateTime(String(row.checked_at)),
    ...(row.note ? { note:String(row.note) } : {})
  };
  return {
    ...common,
    itemType:'emergency_drill',
    ...(row.supersedes_item_id ? { supersedesItemId:String(row.supersedes_item_id) } : {}),
    drillKind:String(row.drill_kind) as FamilyEmergencyDrillKind,
    status:String(row.drill_status) as FamilyEmergencyDrillStatus,
    occurredAt:asIsoDateTime(String(row.occurred_at)),
    ...(row.duration_seconds === null || row.duration_seconds === undefined
      ? {} : { durationSeconds:Number(row.duration_seconds) }),
    ...(row.note ? { note:String(row.note) } : {})
  };
};

const familyEmergencyAssistanceColumns = `
  assistance.id,assistance.plan_id,assistance.profile_id,assistance.family_id,
  assistance.owner_person_id,assistance.item_type,assistance.supersedes_item_id,
  assistance.subject_kind,assistance.subject_person_id,assistance.subject_pet_id,
  assistance.responsible_person_id,assistance.label,assistance.fact_kind,
  assistance.blood_type,assistance.fact_value,assistance.contact_name,
  assistance.phone_e164,assistance.relationship,assistance.instruction_kind,
  assistance.instruction,assistance.note,assistance.privacy,assistance.data_source,
  assistance.created_at
`;

const mapFamilyEmergencyAssistanceItem = (
  row:Record<string, unknown>
):FamilyEmergencyAssistanceLedgerItemRow => {
  const common = {
    id:String(row.id),
    planId:String(row.plan_id),
    familyId:asFamilyId(String(row.family_id)),
    ownerPersonId:asPersonId(String(row.owner_person_id)),
    privacy:'private' as const,
    dataSource:'manual' as const,
    createdAt:asIsoDateTime(String(row.created_at))
  };
  const itemType = String(row.item_type) as FamilyEmergencyAssistanceItemType;
  if (itemType === 'emergency_profile') {
    const profile = {
      ...common,
      itemType,
      label:String(row.label),
      subjectKind:String(row.subject_kind) as FamilyEmergencyAssistanceSubjectKind
    };
    return profile.subjectKind === 'person'
      ? { ...profile, subjectKind:'person', subjectPersonId:String(row.subject_person_id) }
      : {
          ...profile,
          subjectKind:'pet',
          subjectPetId:String(row.subject_pet_id),
          responsiblePersonId:String(row.responsible_person_id)
        };
  }
  const child = {
    ...common,
    profileId:String(row.profile_id),
    ...(row.supersedes_item_id ? { supersedesItemId:String(row.supersedes_item_id) } : {})
  };
  if (itemType === 'health_fact') {
    const factKind = String(row.fact_kind) as FamilyEmergencyHealthFactKind;
    return factKind === 'blood_type'
      ? {
          ...child,
          itemType,
          factKind:'blood_type',
          bloodType:String(row.blood_type) as FamilyEmergencyBloodType,
          ...(row.note ? { note:String(row.note) } : {})
        }
      : {
          ...child,
          itemType,
          factKind:factKind as Exclude<FamilyEmergencyHealthFactKind, 'blood_type'>,
          value:String(row.fact_value),
          ...(row.note ? { note:String(row.note) } : {})
        };
  }
  if (itemType === 'emergency_contact') return {
    ...child,
    itemType,
    name:String(row.contact_name),
    phoneE164:String(row.phone_e164),
    ...(row.relationship ? { relationship:String(row.relationship) } : {}),
    ...(row.note ? { note:String(row.note) } : {})
  };
  return {
    ...child,
    itemType:'assistance_instruction',
    instructionKind:String(row.instruction_kind) as FamilyEmergencyAssistanceInstructionKind,
    instruction:String(row.instruction),
    ...(row.note ? { note:String(row.note) } : {})
  };
};

const familyEmergencyCardPortabilityColumns = `
  portability.id,portability.profile_id,portability.configuration_id,
  portability.family_id,portability.owner_person_id,portability.item_type,
  portability.configuration_label,portability.locale,portability.source_item_id,
  portability.source_item_type,portability.field_code,portability.archive_item_id,
  portability.export_mode,portability.selected_field_count,portability.document_count,
  portability.selection_sha256,portability.share_receipt_hash,
  portability.artifact_sha256,portability.artifact_size_bytes,
  portability.artifact_readback_status,portability.printer_dispatch_status,
  portability.power_mode,portability.activation_source,portability.power_source,
  portability.battery_level,portability.automatic_low_battery_detection,
  portability.low_battery_claimed,portability.privacy,portability.data_source,
  portability.created_at
`;

const mapFamilyEmergencyCardPortabilityItem = (
  row:Record<string, unknown>
):FamilyEmergencyCardPortabilityLedgerItemRow => {
  const common = {
    id:String(row.id),
    profileId:String(row.profile_id),
    familyId:asFamilyId(String(row.family_id)),
    ownerPersonId:asPersonId(String(row.owner_person_id)),
    privacy:'private' as const,
    dataSource:'manual' as const,
    createdAt:asIsoDateTime(String(row.created_at))
  };
  const itemType = String(row.item_type) as FamilyEmergencyCardPortabilityItemType;
  if (itemType === 'card_configuration') return {
    ...common,
    itemType,
    label:String(row.configuration_label),
    locale:'tr-TR'
  };
  const configurationId = String(row.configuration_id);
  if (itemType === 'selected_field') return {
    ...common,
    itemType,
    configurationId,
    sourceItemId:String(row.source_item_id),
    sourceItemType:String(row.source_item_type) as FamilyEmergencyCardSourceItemType,
    fieldCode:String(row.field_code) as FamilyEmergencyCardFieldCode
  };
  if (itemType === 'document_link') return {
    ...common,
    itemType,
    configurationId,
    archiveItemId:String(row.archive_item_id)
  };
  if (itemType === 'export_event') {
    const exportCommon = {
      ...common,
      itemType,
      configurationId,
      selectedFieldCount:Number(row.selected_field_count),
      documentCount:Number(row.document_count),
      selectionSha256:String(row.selection_sha256),
      shareReceiptHash:String(row.share_receipt_hash),
      artifactSha256:String(row.artifact_sha256),
      artifactSizeBytes:Number(row.artifact_size_bytes),
      powerSource:String(row.power_source) as FamilyEmergencyCardPowerSource,
      batteryLevel:'not_measured' as const,
      automaticLowBatteryDetection:'not_performed' as const,
      lowBatteryClaimed:false as const
    };
    const mode = String(row.export_mode) as FamilyEmergencyCardOutputMode;
    return mode === 'print'
      ? {
          ...exportCommon,
          mode,
          artifactReadbackStatus:'not_applicable_print',
          printerDispatchStatus:'confirmed'
        }
      : {
          ...exportCommon,
          mode,
          artifactReadbackStatus:'verified'
        };
  }
  return {
    ...common,
    itemType:'power_mode_event',
    configurationId,
    mode:String(row.power_mode) as FamilyEmergencyCardPowerMode,
    activationSource:String(row.activation_source) as FamilyEmergencyCardPowerActivationSource,
    powerSource:String(row.power_source) as FamilyEmergencyCardPowerSource,
    batteryLevel:'not_measured',
    automaticLowBatteryDetection:'not_performed',
    lowBatteryClaimed:false
  };
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

const emergencyCardSelectionHashPattern = /^selection_sha256:[0-9a-f]{64}$/u;
const emergencyCardShareFieldCodes = new Set([
  'fact_value','instruction','instruction_kind','label','name','note',
  'phone_e164','relationship','subject_display'
]);

const emergencyCardPortabilityVisibilityBinding = (
  context:PolicyAuthorizedRepositoryExecutionContext,
  profileId:string
):LifeReadBinding => {
  const authorization = context.policyAuthorization;
  if (authorization.action === 'read') {
    return lifeReadBinding(context, authorization.resourceId);
  }
  if (!authorization.resourceOwnerPersonId) {
    throw new Error('Emergency card export read requires an exact owner-bound resource');
  }
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType:'life_record',
    resourceId:profileId,
    action:'share',
    capability:'file.share',
    correlationId:context.correlationId,
    resourceFamilyId:authorization.resourceFamilyId,
    resourceOwnerPersonId:authorization.resourceOwnerPersonId,
    purpose:'emergency-offline-portability'
  });
  const subject = authorization.subject;
  const actorPersonId = context.actor.personId === undefined ? undefined : String(context.actor.personId);
  const requestedFields = authorization.receiptRecord.request.requestedFields;
  const selectionHashes = requestedFields?.filter((field) => emergencyCardSelectionHashPattern.test(field)) ?? [];
  if (
    subject.accountId !== String(context.actor.userId)
    || !subject.personId
    || subject.personId !== actorPersonId
    || subject.personId !== authorization.resourceOwnerPersonId
    || !subject.familyIds.includes(authorization.resourceFamilyId)
    || !requestedFields
    || requestedFields.length < 1
    || requestedFields.length > emergencyCardShareFieldCodes.size + 1
    || new Set(requestedFields).size !== requestedFields.length
    || JSON.stringify(requestedFields) !== JSON.stringify([...requestedFields].sort())
    || selectionHashes.length !== 1
    || !requestedFields.every((field) =>
      emergencyCardSelectionHashPattern.test(field) || emergencyCardShareFieldCodes.has(field))
  ) {
    throw new Error('Emergency card export read requires an exact owner-bound sorted selection receipt');
  }
  return Object.freeze({
    familyId:asFamilyId(authorization.resourceFamilyId),
    accountId:subject.accountId,
    actorPersonId:subject.personId,
    familyRoleAllowed:0,
    occurredAt:authorization.receiptRecord.request.occurredAt
  });
};

const assertFamilyEmergencyLookupAccess = (
  context:PolicyAuthorizedRepositoryExecutionContext,
  familyId:string,
  planId:string
):void => {
  const authorization = context.policyAuthorization;
  if (authorization.action === 'update') {
    assertPolicyAuthorizedRepositoryContext(context, {
      resourceType: 'life_record',
      resourceId: planId,
      action: 'update',
      capability: 'family.write',
      correlationId: context.correlationId,
      resourceFamilyId: familyId
    });
  } else if (authorization.action === 'create') {
    assertPolicyAuthorizedRepositoryContext(context, {
      resourceType: 'life_record',
      resourceId: authorization.resourceId,
      action: 'create',
      capability: 'family.write',
      correlationId: context.correlationId,
      resourceFamilyId: familyId
    });
  } else {
    throw new Error('Family emergency write lookup requires create or root-bound update authorization');
  }
  assertReceiptSubject(context, familyId);
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
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT ${managedLifeColumns}
        FROM life_managed_ledger ledger
        WHERE ledger.id=? AND ledger.item_type='profile'
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle lifecycle
            WHERE lifecycle.resource_type='life_record'
              AND lifecycle.resource_id=ledger.id
              AND lifecycle.state<>'active'
          )
      `).get(id) as Record<string, unknown> | undefined;
      if (row) lifeWriteBinding(context, {
        familyId:String(row.family_id),
        resourceId:String(row.id),
        action:'update'
      });
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

  public listManagedHomeInventoryItems(
    context: PolicyAuthorizedRepositoryExecutionContext
  ): RepositoryResult<readonly ManagedHomeInventoryLedgerItemRow[]> {
    const visibility = lifeReadBinding(context);
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT ${managedHomeInventoryColumns}
        FROM life_home_inventory_ledger inventory
        JOIN life_managed_ledger profile
          ON profile.id=inventory.home_profile_id AND profile.item_type='profile' AND profile.category='home'
        WHERE profile.family_id=?
          ${managedLifeVisibilitySql}
        ORDER BY inventory.created_at DESC,inventory.id
      `).all(
        visibility.familyId,
        ...lifeVisibilityParameters(visibility)
      ) as ReadonlyArray<Record<string, unknown>>
    ).map((row) => mapManagedHomeInventoryItem(row)));
  }

  public findManagedHomeInventoryItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    id: string
  ): RepositoryResult<ManagedHomeInventoryLedgerItemRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT ${managedHomeInventoryColumns}
        FROM life_home_inventory_ledger inventory
        WHERE inventory.id=?
      `).get(id) as Record<string, unknown> | undefined;
      if (!row) return null;
      lifeWriteBinding(context, {
        familyId: String(row.family_id),
        resourceId: String(row.home_profile_id),
        action: 'update'
      });
      return mapManagedHomeInventoryItem(row, true);
    });
  }

  public findLatestManagedHomeMeterReading(
    context: PolicyAuthorizedRepositoryExecutionContext,
    recordId: string,
    meterId: string
  ): RepositoryResult<ManagedHomeInventoryMeterReadingLedgerItemRow | null> {
    return this.execute(context, () => {
      const meter = this.database(context).prepare(`
        SELECT family_id,home_profile_id FROM life_home_inventory_ledger
        WHERE id=? AND item_type='meter' AND home_profile_id=?
      `).get(meterId, recordId) as Record<string, unknown> | undefined;
      if (!meter) return null;
      lifeWriteBinding(context, {
        familyId: String(meter.family_id),
        resourceId: recordId,
        action: 'update'
      });
      const row = this.database(context).prepare(`
        SELECT ${managedHomeInventoryColumns}
        FROM life_home_inventory_ledger inventory
        WHERE inventory.item_type='meter_reading'
          AND inventory.home_profile_id=? AND inventory.parent_item_id=?
        ORDER BY inventory.occurred_at DESC,inventory.created_at DESC,inventory.id DESC
        LIMIT 1
      `).get(recordId, meterId) as Record<string, unknown> | undefined;
      return row ? mapManagedHomeInventoryItem(row) as ManagedHomeInventoryMeterReadingLedgerItemRow : null;
    });
  }

  public insertManagedHomeInventoryItem(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: ManagedHomeInventoryLedgerItemRow
  ): RepositoryResult<void> {
    if (
      row.dataSource !== 'manual'
      || row.externalVerification !== 'not_performed'
      || row.paymentExecution !== 'not_performed'
      || ((row.itemType === 'belonging' || row.itemType === 'service')
        && row.financePosting !== (row.financeExpenseId ? 'linked' : 'not_performed'))
      || ((row.itemType === 'belonging' || row.itemType === 'service')
        && row.financeExpenseId !== undefined
        && (('amountMinor' in row && row.amountMinor !== undefined)
          || ('purchaseAmountMinor' in row && row.purchaseAmountMinor !== undefined)
          || row.currency !== undefined))
    ) {
      throw new Error('Managed home inventory item contains a non-local or inconsistent execution claim');
    }
    const policy = lifeWriteBinding(context, {
      familyId: row.familyId,
      resourceId: row.recordId,
      action: 'update'
    });
    const parentItemId = row.itemType === 'meter' ? row.roomId
      : row.itemType === 'meter_reading' ? row.meterId
        : row.itemType === 'belonging' ? row.roomId
          : row.itemType === 'warranty' ? row.belongingId
            : row.itemType === 'service' || row.itemType === 'document' ? row.targetItemId
              : undefined;
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO life_home_inventory_ledger(
          id,home_profile_id,family_id,owner_person_id,item_type,parent_item_id,
          supersedes_item_id,name,room_kind,label,meter_kind,reading_unit,
          reading_milliunits,reading_kind,belonging_kind,serial_number,purchased_at,
          starts_at,ends_at,reminder_at,target_type,service_kind,occurred_at,provider,
          amount_minor,currency,finance_expense_id,archive_item_id,document_kind,note,
          privacy,data_source,external_verification,payment_execution,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,
          policy_correlation_id,policy_resource_type,policy_resource_id,policy_action,
          policy_capability
        ) VALUES(${Array.from({ length: 43 }, () => '?').join(',')})
      `).run(
        row.id,
        row.recordId,
        row.familyId,
        row.ownerPersonId,
        row.itemType,
        parentItemId ?? null,
        row.supersedesItemId ?? null,
        row.itemType === 'room' || row.itemType === 'belonging' ? row.name : null,
        row.itemType === 'room' ? row.roomKind : null,
        row.itemType === 'meter' ? row.label : row.itemType === 'document' ? row.label ?? null : null,
        row.itemType === 'meter' ? row.meterKind : null,
        row.itemType === 'meter' ? row.readingUnit : null,
        row.itemType === 'meter_reading' ? row.readingMilliunits : null,
        row.itemType === 'meter_reading' ? row.readingKind : null,
        row.itemType === 'belonging' ? row.belongingKind : null,
        row.itemType === 'belonging' ? row.serialNumber ?? null : null,
        row.itemType === 'belonging' ? row.purchasedAt ?? null : null,
        row.itemType === 'warranty' ? row.startsAt : null,
        row.itemType === 'warranty' ? row.endsAt : null,
        row.itemType === 'warranty' ? row.reminderAt ?? null : null,
        row.itemType === 'service' || row.itemType === 'document' ? row.targetType : null,
        row.itemType === 'service' ? row.serviceKind : null,
        row.itemType === 'meter_reading' ? row.recordedAt
          : row.itemType === 'service' ? row.occurredAt : null,
        row.itemType === 'warranty' || row.itemType === 'service' ? row.provider ?? null : null,
        row.itemType === 'belonging' ? row.purchaseAmountMinor ?? null
          : row.itemType === 'service' ? row.amountMinor ?? null : null,
        row.itemType === 'belonging' || row.itemType === 'service' ? row.currency ?? null : null,
        row.itemType === 'belonging' || row.itemType === 'service' ? row.financeExpenseId ?? null : null,
        row.itemType === 'document' ? row.archiveItemId : null,
        row.itemType === 'document' ? row.documentKind : null,
        row.itemType === 'meter_reading' || row.itemType === 'warranty' || row.itemType === 'service'
          ? row.note ?? null : null,
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
    });
  }

  public listFamilyEmergencyItems(
    context:PolicyAuthorizedRepositoryExecutionContext
  ):RepositoryResult<readonly FamilyEmergencyLedgerItemRow[]> {
    const visibility = lifeReadBinding(context);
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT ${familyEmergencyColumns}
        FROM family_emergency_ledger emergency
        JOIN family_emergency_ledger profile
          ON profile.id=CASE
            WHEN emergency.item_type='emergency_plan' THEN emergency.id
            ELSE emergency.plan_id
          END
          AND profile.item_type='emergency_plan'
        WHERE profile.family_id=?
          ${managedLifeVisibilitySql}
        ORDER BY emergency.created_at DESC,emergency.id
      `).all(
        visibility.familyId,
        ...lifeVisibilityParameters(visibility)
      ) as ReadonlyArray<Record<string, unknown>>
    ).map(mapFamilyEmergencyItem));
  }

  public findFamilyEmergencyPlan(
    context:PolicyAuthorizedRepositoryExecutionContext,
    id:string
  ):RepositoryResult<FamilyEmergencyPlanLedgerItemRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT ${familyEmergencyColumns}
        FROM family_emergency_ledger emergency
        WHERE emergency.id=? AND emergency.item_type='emergency_plan'
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle lifecycle
            WHERE lifecycle.resource_type='life_record'
              AND lifecycle.resource_id=emergency.id
              AND lifecycle.state<>'active'
          )
      `).get(id) as Record<string, unknown> | undefined;
      if (!row) return null;
      assertFamilyEmergencyLookupAccess(context, String(row.family_id), String(row.id));
      return mapFamilyEmergencyItem(row) as FamilyEmergencyPlanLedgerItemRow;
    });
  }

  public findFamilyEmergencyItem(
    context:PolicyAuthorizedRepositoryExecutionContext,
    id:string
  ):RepositoryResult<FamilyEmergencyLedgerItemRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT ${familyEmergencyColumns}
        FROM family_emergency_ledger emergency
        WHERE emergency.id=?
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle lifecycle
            WHERE lifecycle.resource_type='life_record'
              AND lifecycle.resource_id=CASE
                WHEN emergency.item_type='emergency_plan' THEN emergency.id
                ELSE emergency.plan_id
              END
              AND lifecycle.state<>'active'
          )
      `).get(id) as Record<string, unknown> | undefined;
      if (!row) return null;
      const planId = row.item_type === 'emergency_plan' ? String(row.id) : String(row.plan_id);
      assertFamilyEmergencyLookupAccess(context, String(row.family_id), planId);
      return mapFamilyEmergencyItem(row);
    });
  }

  public findFamilyEmergencyPlanForPolicyResolution(
    context:RepositoryExecutionContext,
    id:string
  ):RepositoryResult<FamilyEmergencyPlanLedgerItemRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT ${familyEmergencyColumns}
        FROM family_emergency_ledger emergency
        WHERE emergency.id=? AND emergency.item_type='emergency_plan'
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle lifecycle
            WHERE lifecycle.resource_type='life_record'
              AND lifecycle.resource_id=emergency.id
              AND lifecycle.state<>'active'
          )
      `).get(id) as Record<string, unknown> | undefined;
      return row ? mapFamilyEmergencyItem(row) as FamilyEmergencyPlanLedgerItemRow : null;
    });
  }

  public insertFamilyEmergencyItem(
    context:PolicyAuthorizedRepositoryExecutionContext,
    row:FamilyEmergencyLedgerItemRow
  ):RepositoryResult<void> {
    if (row.privacy !== 'family' || row.dataSource !== 'manual') {
      throw new Error('Family emergency item contains a non-local or non-family execution claim');
    }
    const isCreate = row.itemType === 'emergency_plan' || row.itemType === 'member_status';
    const resourceId = isCreate ? row.id : row.planId;
    const expectedOwner = row.itemType === 'member_status' ? row.memberPersonId : row.ownerPersonId;
    const authorization = context.policyAuthorization;
    if (authorization.resourceOwnerPersonId !== String(expectedOwner)) {
      throw new Error('Family emergency receipt owner does not match the exact write target');
    }
    if (row.itemType === 'emergency_plan'
      && authorization.subject.personId !== String(row.ownerPersonId)) {
      throw new Error('Family emergency plan owner must be the receipt subject');
    }
    if (row.itemType === 'member_status') {
      if (authorization.subject.personId !== String(row.reportedByPersonId)) {
        throw new Error('Family emergency reporter must be the receipt subject');
      }
    }
    const policy = lifeWriteBinding(context, {
      familyId: row.familyId,
      resourceId,
      action: isCreate ? 'create' : 'update'
    });
    const parentItemId = row.itemType === 'checklist_status' ? row.checklistItemId : undefined;
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO family_emergency_ledger(
          id,family_id,owner_person_id,item_type,plan_id,parent_item_id,supersedes_item_id,
          plan_kind,title,evacuation_instructions,meeting_point_kind,label,address,directions,
          contact_name,phone_e164,city,sort_order,checklist_status,member_person_id,
          reported_by_person_id,member_status,occurred_at,note,privacy,data_source,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,
          policy_resource_type,policy_resource_id,policy_action,policy_capability
        ) VALUES(${Array.from({ length: 35 }, () => '?').join(',')})
      `).run(
        row.id,
        row.familyId,
        row.ownerPersonId,
        row.itemType,
        row.itemType === 'emergency_plan' ? null : row.planId,
        parentItemId ?? null,
        'supersedesItemId' in row ? row.supersedesItemId ?? null : null,
        row.itemType === 'emergency_plan' ? row.planKind : null,
        row.itemType === 'emergency_plan' ? row.title : null,
        row.itemType === 'emergency_plan' ? row.evacuationInstructions : null,
        row.itemType === 'meeting_point' ? row.meetingPointKind : null,
        row.itemType === 'meeting_point' || row.itemType === 'checklist_item' ? row.label : null,
        row.itemType === 'meeting_point' ? row.address ?? null : null,
        row.itemType === 'meeting_point' ? row.directions ?? null : null,
        row.itemType === 'external_contact' ? row.name : null,
        row.itemType === 'external_contact' ? row.phoneE164 : null,
        row.itemType === 'external_contact' ? row.city : null,
        row.itemType === 'checklist_item' ? row.sortOrder : null,
        row.itemType === 'checklist_status' ? row.status : null,
        row.itemType === 'member_status' ? row.memberPersonId : null,
        row.itemType === 'member_status' ? row.reportedByPersonId : null,
        row.itemType === 'member_status' ? row.status : null,
        row.itemType === 'member_status' ? row.occurredAt : null,
        row.itemType === 'external_contact' || row.itemType === 'member_status' ? row.note ?? null : null,
        row.privacy,
        row.dataSource,
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
      if (row.itemType === 'emergency_plan') {
        this.database(context).prepare(
          "INSERT INTO data_lifecycle(resource_type,resource_id,owner_person_id,privacy,state,updated_at) VALUES('life_record',?,?,?,'active',?)"
        ).run(row.id, row.ownerPersonId, row.privacy, row.createdAt);
      }
    });
  }

  public listFamilyEmergencyPreparednessItems(
    context:PolicyAuthorizedRepositoryExecutionContext
  ):RepositoryResult<readonly FamilyEmergencyPreparednessLedgerItemRow[]> {
    const visibility = lifeReadBinding(context);
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT ${familyEmergencyPreparednessColumns}
        FROM family_emergency_preparedness_ledger preparedness
        JOIN family_emergency_ledger profile
          ON profile.id=preparedness.plan_id AND profile.item_type='emergency_plan'
        WHERE profile.family_id=?
          ${managedLifeVisibilitySql}
        ORDER BY preparedness.created_at DESC,preparedness.id
      `).all(
        visibility.familyId,
        ...lifeVisibilityParameters(visibility)
      ) as ReadonlyArray<Record<string, unknown>>
    ).map(mapFamilyEmergencyPreparednessItem));
  }

  public findFamilyEmergencyPreparednessItem(
    context:PolicyAuthorizedRepositoryExecutionContext,
    id:string
  ):RepositoryResult<FamilyEmergencyPreparednessLedgerItemRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT ${familyEmergencyPreparednessColumns}
        FROM family_emergency_preparedness_ledger preparedness
        JOIN family_emergency_ledger profile
          ON profile.id=preparedness.plan_id AND profile.item_type='emergency_plan'
        WHERE preparedness.id=?
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle lifecycle
            WHERE lifecycle.resource_type='life_record'
              AND lifecycle.resource_id=profile.id
              AND lifecycle.state<>'active'
          )
      `).get(id) as Record<string, unknown> | undefined;
      if (!row) return null;
      assertFamilyEmergencyLookupAccess(context, String(row.family_id), String(row.plan_id));
      return mapFamilyEmergencyPreparednessItem(row);
    });
  }

  public insertFamilyEmergencyPreparednessItem(
    context:PolicyAuthorizedRepositoryExecutionContext,
    row:FamilyEmergencyPreparednessLedgerItemRow
  ):RepositoryResult<void> {
    if (row.privacy !== 'family' || row.dataSource !== 'manual') {
      throw new Error('Emergency preparedness item contains a non-local or non-family execution claim');
    }
    if (context.policyAuthorization.resourceOwnerPersonId !== String(row.ownerPersonId)) {
      throw new Error('Emergency preparedness receipt owner does not match the exact plan root');
    }
    const policy = lifeWriteBinding(context, {
      familyId:row.familyId,
      resourceId:row.planId,
      action:'update'
    });
    const parentItemId = row.itemType === 'preparedness_kit_item' ? row.kitId
      : row.itemType === 'preparedness_kit_check' ? row.kitItemId
        : undefined;
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO family_emergency_preparedness_ledger(
          id,plan_id,family_id,owner_person_id,item_type,parent_item_id,supersedes_item_id,
          kit_kind,category,label,target_quantity_milliunits,quantity_unit,expires_on,
          check_status,actual_quantity_milliunits,checked_at,drill_kind,drill_status,
          occurred_at,duration_seconds,note,privacy,data_source,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,
          policy_resource_type,policy_resource_id,policy_action,policy_capability
        ) VALUES(${Array.from({ length:32 }, () => '?').join(',')})
      `).run(
        row.id,
        row.planId,
        row.familyId,
        row.ownerPersonId,
        row.itemType,
        parentItemId ?? null,
        'supersedesItemId' in row ? row.supersedesItemId ?? null : null,
        row.itemType === 'preparedness_kit' ? row.kitKind : null,
        row.itemType === 'preparedness_kit_item' ? row.category : null,
        row.itemType === 'preparedness_kit' || row.itemType === 'preparedness_kit_item'
          ? row.label : null,
        row.itemType === 'preparedness_kit_item' ? row.targetQuantityMilliunits : null,
        row.itemType === 'preparedness_kit_item' ? row.quantityUnit : null,
        row.itemType === 'preparedness_kit_item' ? row.expiresOn ?? null : null,
        row.itemType === 'preparedness_kit_check' ? row.status : null,
        row.itemType === 'preparedness_kit_check' ? row.actualQuantityMilliunits : null,
        row.itemType === 'preparedness_kit_check' ? row.checkedAt : null,
        row.itemType === 'emergency_drill' ? row.drillKind : null,
        row.itemType === 'emergency_drill' ? row.status : null,
        row.itemType === 'emergency_drill' ? row.occurredAt : null,
        row.itemType === 'emergency_drill' ? row.durationSeconds ?? null : null,
        row.itemType === 'preparedness_kit_check' || row.itemType === 'emergency_drill'
          ? row.note ?? null : null,
        row.privacy,
        row.dataSource,
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

  public listFamilyEmergencyAssistanceItems(
    context:PolicyAuthorizedRepositoryExecutionContext
  ):RepositoryResult<readonly FamilyEmergencyAssistanceLedgerItemRow[]> {
    const visibility = lifeReadBinding(context);
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT ${familyEmergencyAssistanceColumns}
        FROM family_emergency_assistance_ledger assistance
        JOIN family_emergency_assistance_ledger profile
          ON profile.id=CASE
            WHEN assistance.item_type='emergency_profile' THEN assistance.id
            ELSE assistance.profile_id
          END
          AND profile.item_type='emergency_profile'
        WHERE profile.family_id=?
          ${managedLifeVisibilitySql}
        ORDER BY assistance.created_at DESC,assistance.id
      `).all(
        visibility.familyId,
        ...lifeVisibilityParameters(visibility)
      ) as ReadonlyArray<Record<string, unknown>>
    ).map(mapFamilyEmergencyAssistanceItem));
  }

  public findFamilyEmergencyAssistanceProfile(
    context:PolicyAuthorizedRepositoryExecutionContext,
    id:string
  ):RepositoryResult<FamilyEmergencyAssistanceProfileLedgerItemRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT ${familyEmergencyAssistanceColumns}
        FROM family_emergency_assistance_ledger assistance
        WHERE assistance.id=? AND assistance.item_type='emergency_profile'
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle lifecycle
            WHERE lifecycle.resource_type='life_record'
              AND lifecycle.resource_id=assistance.id
              AND lifecycle.state<>'active'
          )
          AND EXISTS (
            SELECT 1 FROM family_emergency_ledger plan
            WHERE plan.id=assistance.plan_id AND plan.item_type='emergency_plan'
              AND NOT EXISTS (
                SELECT 1 FROM data_lifecycle lifecycle
                WHERE lifecycle.resource_type='life_record'
                  AND lifecycle.resource_id=plan.id
                  AND lifecycle.state<>'active'
              )
          )
      `).get(id) as Record<string, unknown> | undefined;
      if (row) {
        if (context.policyAuthorization.action === 'share') {
          emergencyCardPortabilityVisibilityBinding(context, String(row.id));
        } else {
          lifeWriteBinding(context, {
            familyId:String(row.family_id),
            resourceId:String(row.id),
            action:'update'
          });
        }
      }
      return row
        ? mapFamilyEmergencyAssistanceItem(row) as FamilyEmergencyAssistanceProfileLedgerItemRow
        : null;
    });
  }

  public findFamilyEmergencyAssistanceProfileForPolicyResolution(
    context:RepositoryExecutionContext,
    id:string
  ):RepositoryResult<FamilyEmergencyAssistanceProfileLedgerItemRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT ${familyEmergencyAssistanceColumns}
        FROM family_emergency_assistance_ledger assistance
        WHERE assistance.id=? AND assistance.item_type='emergency_profile'
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle lifecycle
            WHERE lifecycle.resource_type='life_record'
              AND lifecycle.resource_id=assistance.id
              AND lifecycle.state<>'active'
          )
          AND EXISTS (
            SELECT 1 FROM family_emergency_ledger plan
            WHERE plan.id=assistance.plan_id AND plan.item_type='emergency_plan'
              AND NOT EXISTS (
                SELECT 1 FROM data_lifecycle lifecycle
                WHERE lifecycle.resource_type='life_record'
                  AND lifecycle.resource_id=plan.id
                  AND lifecycle.state<>'active'
              )
          )
      `).get(id) as Record<string, unknown> | undefined;
      return row
        ? mapFamilyEmergencyAssistanceItem(row) as FamilyEmergencyAssistanceProfileLedgerItemRow
        : null;
    });
  }

  public findFamilyEmergencyAssistanceItem(
    context:PolicyAuthorizedRepositoryExecutionContext,
    id:string
  ):RepositoryResult<FamilyEmergencyAssistanceLedgerItemRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT ${familyEmergencyAssistanceColumns}
        FROM family_emergency_assistance_ledger assistance
        JOIN family_emergency_assistance_ledger profile
          ON profile.id=CASE
            WHEN assistance.item_type='emergency_profile' THEN assistance.id
            ELSE assistance.profile_id
          END
          AND profile.item_type='emergency_profile'
        WHERE assistance.id=?
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle lifecycle
            WHERE lifecycle.resource_type='life_record'
              AND lifecycle.resource_id=profile.id
              AND lifecycle.state<>'active'
          )
          AND EXISTS (
            SELECT 1 FROM family_emergency_ledger plan
            WHERE plan.id=profile.plan_id AND plan.item_type='emergency_plan'
              AND NOT EXISTS (
                SELECT 1 FROM data_lifecycle lifecycle
                WHERE lifecycle.resource_type='life_record'
                  AND lifecycle.resource_id=plan.id
                  AND lifecycle.state<>'active'
              )
          )
      `).get(id) as Record<string, unknown> | undefined;
      if (!row) return null;
      const profileId = String(row.item_type) === 'emergency_profile'
        ? String(row.id)
        : String(row.profile_id);
      if (context.policyAuthorization.action === 'share') {
        emergencyCardPortabilityVisibilityBinding(context, profileId);
      } else {
        lifeWriteBinding(context, {
          familyId:String(row.family_id),
          resourceId:profileId,
          action:'update'
        });
      }
      return mapFamilyEmergencyAssistanceItem(row);
    });
  }

  public insertFamilyEmergencyAssistanceItem(
    context:PolicyAuthorizedRepositoryExecutionContext,
    row:FamilyEmergencyAssistanceLedgerItemRow
  ):RepositoryResult<void> {
    if (row.privacy !== 'private' || row.dataSource !== 'manual') {
      throw new Error('Emergency assistance item must remain manual and fixed private');
    }
    if (context.policyAuthorization.resourceOwnerPersonId !== String(row.ownerPersonId)) {
      throw new Error('Emergency assistance receipt owner does not match the private profile root');
    }
    const isProfile = row.itemType === 'emergency_profile';
    const resourceId = isProfile ? row.id : row.profileId;
    const policy = lifeWriteBinding(context, {
      familyId:row.familyId,
      resourceId,
      action:isProfile ? 'create' : 'update'
    });
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO family_emergency_assistance_ledger(
          id,plan_id,profile_id,family_id,owner_person_id,item_type,supersedes_item_id,
          subject_kind,subject_person_id,subject_pet_id,responsible_person_id,label,
          fact_kind,blood_type,fact_value,contact_name,phone_e164,relationship,
          instruction_kind,instruction,note,privacy,data_source,created_at,
          policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,
          policy_resource_type,policy_resource_id,policy_action,policy_capability
        ) VALUES(${Array.from({ length:32 }, () => '?').join(',')})
      `).run(
        row.id,
        row.planId,
        isProfile ? null : row.profileId,
        row.familyId,
        row.ownerPersonId,
        row.itemType,
        isProfile ? null : row.supersedesItemId ?? null,
        isProfile ? row.subjectKind : null,
        isProfile && row.subjectKind === 'person' ? row.subjectPersonId : null,
        isProfile && row.subjectKind === 'pet' ? row.subjectPetId : null,
        isProfile && row.subjectKind === 'pet' ? row.responsiblePersonId : null,
        isProfile ? row.label : null,
        row.itemType === 'health_fact' ? row.factKind : null,
        row.itemType === 'health_fact' && row.factKind === 'blood_type' ? row.bloodType : null,
        row.itemType === 'health_fact' && row.factKind !== 'blood_type' ? row.value : null,
        row.itemType === 'emergency_contact' ? row.name : null,
        row.itemType === 'emergency_contact' ? row.phoneE164 : null,
        row.itemType === 'emergency_contact' ? row.relationship ?? null : null,
        row.itemType === 'assistance_instruction' ? row.instructionKind : null,
        row.itemType === 'assistance_instruction' ? row.instruction : null,
        isProfile ? null : row.note ?? null,
        row.privacy,
        row.dataSource,
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
      if (isProfile) {
        this.database(context).prepare(
          "INSERT INTO data_lifecycle(resource_type,resource_id,owner_person_id,privacy,state,updated_at) VALUES('life_record',?,?,?,'active',?)"
        ).run(row.id, row.ownerPersonId, row.privacy, row.createdAt);
      }
    });
  }

  public listFamilyEmergencyCardPortabilityItems(
    context:PolicyAuthorizedRepositoryExecutionContext,
    profileId:string
  ):RepositoryResult<readonly FamilyEmergencyCardPortabilityLedgerItemRow[]> {
    const visibility = emergencyCardPortabilityVisibilityBinding(context, profileId);
    return this.execute(context, () => (
      this.database(context).prepare(`
        SELECT ${familyEmergencyCardPortabilityColumns}
        FROM family_emergency_card_portability_ledger portability
        JOIN family_emergency_assistance_ledger profile
          ON profile.id=portability.profile_id AND profile.item_type='emergency_profile'
        JOIN family_emergency_ledger plan
          ON plan.id=profile.plan_id AND plan.item_type='emergency_plan'
        WHERE portability.profile_id=?
          AND profile.family_id=?
          AND portability.family_id=profile.family_id
          AND portability.owner_person_id=profile.owner_person_id
          AND portability.privacy=profile.privacy
          AND (
            portability.item_type<>'selected_field'
            OR EXISTS (
              SELECT 1 FROM family_emergency_assistance_ledger source
              WHERE source.id=portability.source_item_id
                AND source.item_type=portability.source_item_type
                AND source.family_id=profile.family_id
                AND source.owner_person_id=profile.owner_person_id
                AND source.privacy=profile.privacy
                AND (
                  (source.item_type='emergency_profile' AND source.id=profile.id)
                  OR (source.item_type<>'emergency_profile' AND source.profile_id=profile.id)
                )
                AND NOT EXISTS (
                  SELECT 1 FROM family_emergency_assistance_ledger correction
                  WHERE correction.supersedes_item_id=source.id
                )
            )
          )
          AND (
            portability.item_type<>'document_link'
            OR EXISTS (
              SELECT 1 FROM archive_items archive
              WHERE archive.id=portability.archive_item_id
                AND archive.family_id=profile.family_id
                AND archive.destroyed_at IS NULL
                AND archive.sensitivity='high'
            )
          )
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle lifecycle
            WHERE lifecycle.resource_type='life_record'
              AND lifecycle.resource_id=plan.id
              AND lifecycle.state<>'active'
          )
          ${managedLifeVisibilitySql}
        ORDER BY portability.created_at DESC,portability.id
      `).all(
        profileId,
        visibility.familyId,
        ...lifeVisibilityParameters(visibility)
      ) as ReadonlyArray<Record<string, unknown>>
    ).map(mapFamilyEmergencyCardPortabilityItem));
  }

  public findFamilyEmergencyCardConfiguration(
    context:PolicyAuthorizedRepositoryExecutionContext,
    id:string
  ):RepositoryResult<FamilyEmergencyCardConfigurationLedgerItemRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT ${familyEmergencyCardPortabilityColumns}
        FROM family_emergency_card_portability_ledger portability
        JOIN family_emergency_assistance_ledger profile
          ON profile.id=portability.profile_id AND profile.item_type='emergency_profile'
        JOIN family_emergency_ledger plan
          ON plan.id=profile.plan_id AND plan.item_type='emergency_plan'
        WHERE portability.id=? AND portability.item_type='card_configuration'
          AND portability.family_id=profile.family_id
          AND portability.owner_person_id=profile.owner_person_id
          AND portability.privacy=profile.privacy
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle lifecycle
            WHERE lifecycle.resource_type='life_record'
              AND lifecycle.resource_id=profile.id
              AND lifecycle.state<>'active'
          )
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle lifecycle
            WHERE lifecycle.resource_type='life_record'
              AND lifecycle.resource_id=plan.id
              AND lifecycle.state<>'active'
          )
      `).get(id) as Record<string, unknown> | undefined;
      if (!row) return null;
      lifeWriteBinding(context, {
        familyId:String(row.family_id),
        resourceId:String(row.profile_id),
        action:'update'
      });
      return mapFamilyEmergencyCardPortabilityItem(row) as
        FamilyEmergencyCardConfigurationLedgerItemRow;
    });
  }

  public findFamilyEmergencyCardPortabilityItem(
    context:PolicyAuthorizedRepositoryExecutionContext,
    id:string
  ):RepositoryResult<FamilyEmergencyCardPortabilityLedgerItemRow | null> {
    return this.execute(context, () => {
      const row = this.database(context).prepare(`
        SELECT ${familyEmergencyCardPortabilityColumns}
        FROM family_emergency_card_portability_ledger portability
        JOIN family_emergency_assistance_ledger profile
          ON profile.id=portability.profile_id AND profile.item_type='emergency_profile'
        JOIN family_emergency_ledger plan
          ON plan.id=profile.plan_id AND plan.item_type='emergency_plan'
        WHERE portability.id=?
          AND portability.family_id=profile.family_id
          AND portability.owner_person_id=profile.owner_person_id
          AND portability.privacy=profile.privacy
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle lifecycle
            WHERE lifecycle.resource_type='life_record'
              AND lifecycle.resource_id=profile.id
              AND lifecycle.state<>'active'
          )
          AND NOT EXISTS (
            SELECT 1 FROM data_lifecycle lifecycle
            WHERE lifecycle.resource_type='life_record'
              AND lifecycle.resource_id=plan.id
              AND lifecycle.state<>'active'
          )
      `).get(id) as Record<string, unknown> | undefined;
      if (!row) return null;
      lifeWriteBinding(context, {
        familyId:String(row.family_id),
        resourceId:String(row.profile_id),
        action:'update'
      });
      return mapFamilyEmergencyCardPortabilityItem(row);
    });
  }

  public insertFamilyEmergencyCardPortabilityItem(
    context:PolicyAuthorizedRepositoryExecutionContext,
    row:FamilyEmergencyCardPortabilityLedgerItemRow
  ):RepositoryResult<void> {
    if (row.privacy !== 'private' || row.dataSource !== 'manual') {
      throw new Error('Emergency card portability item must remain manual and fixed private');
    }
    if (context.policyAuthorization.resourceOwnerPersonId !== String(row.ownerPersonId)) {
      throw new Error('Emergency card portability receipt owner does not match the private profile root');
    }
    const policy = lifeWriteBinding(context, {
      familyId:row.familyId,
      resourceId:row.profileId,
      action:'update'
    });
    return this.execute(context, () => {
      this.database(context).prepare(`
        INSERT INTO family_emergency_card_portability_ledger(
          id,profile_id,configuration_id,family_id,owner_person_id,item_type,
          configuration_label,locale,source_item_id,source_item_type,field_code,
          archive_item_id,export_mode,selected_field_count,document_count,
          selection_sha256,share_receipt_hash,artifact_sha256,artifact_size_bytes,artifact_readback_status,
          printer_dispatch_status,power_mode,activation_source,power_source,
          battery_level,automatic_low_battery_detection,low_battery_claimed,
          privacy,data_source,created_at,policy_receipt_hash,policy_receipt_version,
          policy_receipt_nonce,policy_correlation_id,policy_resource_type,
          policy_resource_id,policy_action,policy_capability
        ) VALUES(${Array.from({ length:38 }, () => '?').join(',')})
      `).run(
        row.id,
        row.profileId,
        row.itemType === 'card_configuration' ? null : row.configurationId,
        row.familyId,
        row.ownerPersonId,
        row.itemType,
        row.itemType === 'card_configuration' ? row.label : null,
        row.itemType === 'card_configuration' ? row.locale : null,
        row.itemType === 'selected_field' ? row.sourceItemId : null,
        row.itemType === 'selected_field' ? row.sourceItemType : null,
        row.itemType === 'selected_field' ? row.fieldCode : null,
        row.itemType === 'document_link' ? row.archiveItemId : null,
        row.itemType === 'export_event' ? row.mode : null,
        row.itemType === 'export_event' ? row.selectedFieldCount : null,
        row.itemType === 'export_event' ? row.documentCount : null,
        row.itemType === 'export_event' ? row.selectionSha256 : null,
        row.itemType === 'export_event' ? row.shareReceiptHash : null,
        row.itemType === 'export_event' ? row.artifactSha256 : null,
        row.itemType === 'export_event' ? row.artifactSizeBytes : null,
        row.itemType === 'export_event' ? row.artifactReadbackStatus : null,
        row.itemType === 'export_event' && row.mode === 'print'
          ? row.printerDispatchStatus : null,
        row.itemType === 'power_mode_event' ? row.mode : null,
        row.itemType === 'power_mode_event' ? row.activationSource : null,
        row.itemType === 'export_event' || row.itemType === 'power_mode_event'
          ? row.powerSource : null,
        row.itemType === 'export_event' || row.itemType === 'power_mode_event'
          ? row.batteryLevel : null,
        row.itemType === 'export_event' || row.itemType === 'power_mode_event'
          ? row.automaticLowBatteryDetection : null,
        row.itemType === 'export_event' || row.itemType === 'power_mode_event' ? 0 : null,
        row.privacy,
        row.dataSource,
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
