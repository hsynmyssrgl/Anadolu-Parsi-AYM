import {
  BANK_ACCOUNT_INPUT_KEYS,
  LOAN_ACCOUNT_INPUT_KEYS,
  LOAN_PAYMENT_INPUT_KEYS,
  PAYMENT_CARD_INPUT_KEYS,
  FINANCE_PLANNING_INPUT_KEYS,
  FINANCE_RECORD_INPUT_KEYS,
  FINANCE_VALUATION_INPUT_KEYS,
  containsLikelyFullPan,
  inspectManagedLifeDataContract,
  isExactManagedLifeIsoCalendarDate,
  isExactManagedLifeIsoDateTime,
  isProhibitedBankingSecretField
} from '@ppt/application';

export interface IpcIntegrationPolicyDecision {
  readonly accepted: boolean;
  readonly reason?: string;
  readonly path?: string;
}

const accepted = (): IpcIntegrationPolicyDecision => ({ accepted: true });
const rejected = (reason: string, path = '$'): IpcIntegrationPolicyDecision => ({ accepted: false, reason, path });
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
};
const boundedString = (value: unknown, maximum: number, allowEmpty = false): boolean =>
  typeof value === 'string' && value.length <= maximum && (allowEmpty || value.trim().length > 0);
const optionalBoundedString = (value: unknown, maximum: number): boolean => value === undefined || boundedString(value, maximum, true);
const optionalInteger = (value: unknown, minimum: number, maximum: number): boolean =>
  value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum);
const optionalArgument = (args: readonly unknown[]): unknown => args.length === 0 ? undefined : args[0];

const exactObject = (
  args: readonly unknown[],
  keys: readonly string[],
  validate: (value: Record<string, unknown>) => boolean
): IpcIntegrationPolicyDecision => {
  if (args.length !== 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = args[0];
  if (!isObject(value)) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  if (!hasOnlyKeys(value, keys)) return rejected('UNKNOWN_OBJECT_FIELD', '$[0]');
  return validate(value) ? accepted() : rejected('OBJECT_ARGUMENT_INVALID', '$[0]');
};

const zeroArguments = (args: readonly unknown[]): IpcIntegrationPolicyDecision =>
  args.length === 0 ? accepted() : rejected('ARGUMENT_COUNT_MISMATCH');

const optionalIdentifier = (args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (args.length > 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = optionalArgument(args);
  return value === undefined || boundedString(value, 128) ? accepted() : rejected('IDENTIFIER_INVALID', '$[0]');
};

const optionalLimit = (args: readonly unknown[], maximum = 500): IpcIntegrationPolicyDecision => {
  if (args.length > 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = optionalArgument(args);
  return optionalInteger(value, 1, maximum) ? accepted() : rejected('LIMIT_INVALID', '$[0]');
};

const pageInput = (args: readonly unknown[], kind: 'tree' | 'timeline' | 'archive'): IpcIntegrationPolicyDecision => {
  if (args.length > 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = optionalArgument(args);
  if (value === undefined) return accepted();
  if (!isObject(value)) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  const common = ['cursor', 'limit', 'query'];
  const keys = kind === 'tree'
    ? [...common, 'branch', 'generation']
    : kind === 'timeline'
      ? [...common, 'personId', 'kind', 'year']
      : [...common, 'categoryId', 'sensitivity', 'tag', 'mimeType', 'linkedEventId'];
  if (!hasOnlyKeys(value, keys)) return rejected('UNKNOWN_OBJECT_FIELD', '$[0]');
  if (!optionalBoundedString(value.cursor, 512) || !optionalInteger(value.limit, 20, 200) || !optionalBoundedString(value.query, 120)) return rejected('PAGE_ARGUMENT_INVALID', '$[0]');
  if (kind === 'tree') {
    if (!optionalBoundedString(value.branch, 160) || !optionalInteger(value.generation, 1, 20)) return rejected('PAGE_ARGUMENT_INVALID', '$[0]');
  } else if (kind === 'timeline') {
    if (!optionalBoundedString(value.personId, 128) || !optionalBoundedString(value.kind, 64) || !optionalInteger(value.year, 1000, 9999)) return rejected('PAGE_ARGUMENT_INVALID', '$[0]');
  } else if (!optionalBoundedString(value.categoryId, 128) || !optionalBoundedString(value.sensitivity, 16) || !optionalBoundedString(value.tag, 80) || !optionalBoundedString(value.mimeType, 120) || !optionalBoundedString(value.linkedEventId, 128)) {
    return rejected('PAGE_ARGUMENT_INVALID', '$[0]');
  }
  return accepted();
};


const catalogPageInput = (args: readonly unknown[], kind: 'person' | 'event'): IpcIntegrationPolicyDecision => {
  if (args.length > 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = optionalArgument(args);
  if (value === undefined) return accepted();
  if (!isObject(value)) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  const keys = kind === 'person' ? ['cursor', 'limit', 'query'] : ['cursor', 'limit', 'query', 'personId', 'kind', 'archiveMode'];
  if (!hasOnlyKeys(value, keys)) return rejected('UNKNOWN_OBJECT_FIELD', '$[0]');
  if (!optionalBoundedString(value.cursor, 512) || !optionalInteger(value.limit, 10, 100) || !optionalBoundedString(value.query, 120)) return rejected('CATALOG_ARGUMENT_INVALID', '$[0]');
  if (kind === 'event') {
    if (!optionalBoundedString(value.personId, 128) || !optionalBoundedString(value.kind, 64)) return rejected('CATALOG_ARGUMENT_INVALID', '$[0]');
    if (value.archiveMode !== undefined && !['active', 'archived', 'all'].includes(String(value.archiveMode))) return rejected('CATALOG_ARGUMENT_INVALID', '$[0]');
  }
  return accepted();
};

const catalogLookupInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => exactObject(args, ['personIds', 'eventIds'], (value) => {
  const validIds = (candidate: unknown): boolean => candidate === undefined || (Array.isArray(candidate) && candidate.length <= 100 && candidate.every((id) => boundedString(id, 128)));
  return validIds(value.personIds) && validIds(value.eventIds);
});

const aiConsentPurposes = new Set(['search', 'summary', 'recommendation', 'classification']);
const aiConsentResourceTypes = new Set(['event', 'archive_item']);
const sensitiveCategories = new Set(['child', 'health', 'finance', 'location']);
const sensitivePurposes = new Set(['sensitive_processing', 'external_export']);
const bankAccountTypes = new Set(['checking','savings','time_deposit','participation','investment','other']);
const bankAccountStatuses = new Set(['active','inactive','closed']);
const recordPrivacyValues = new Set(['private','selected_members','family']);
const financeRecordKinds = new Set(['asset','debt','income','expense']);
const paymentCardKinds = new Set(['credit','debit','prepaid']);
const paymentCardNetworks = new Set(['troy','visa','mastercard','american_express','unionpay','other']);
const paymentCardFormFactors = new Set(['physical','virtual','supplementary']);
const paymentCardAutomaticPaymentModes = new Set(['none','minimum','full']);
const paymentCardStatuses = new Set(['active','frozen','closed']);
const loanKinds = new Set(['consumer','mortgage','vehicle','other']);
const loanRateTypes = new Set(['fixed','variable','profit_share','interest_free']);
const loanStatuses = new Set(['active','overdue','restructured','closed']);
const loanInsuranceStatuses = new Set(['none','active','expired','cancelled']);
const loanCollateralTypes = new Set(['none','vehicle','real_estate','deposit','guarantee','other']);
const financePlanningItemTypes = new Set(Object.keys(FINANCE_PLANNING_INPUT_KEYS));
const financeCategoryKinds = new Set(['income','expense']);
const financeCashFlowStatuses = new Set(['planned','realized']);
const financeRecurringFrequencies = new Set(['weekly','monthly','quarterly','yearly']);
const financeRecurringStatuses = new Set(['active','paused','ended']);
const financeGoalKinds = new Set(['savings','debt_reduction','investment','purchase','emergency_fund','other']);
const financeAssetClasses = new Set(['cash','deposit','precious_metal_fx','investment','pension','real_estate','vehicle']);
const managedLifeCategories = new Set(['insurance','subscription','education','employment','official_operation','home','vehicle']);
const managedLifeStatuses = new Set(['planned','active','completed','expired','cancelled']);
const managedLifeReminderKinds = new Set(['renewal','expiry','payment','term','contract_end','official_deadline','rent','insurance','inspection','maintenance','other']);
const managedLifeActivityKinds = new Set(['renewal','rent_payment','insurance_premium','inspection','maintenance','service','fuel','charging','expense']);
const managedLifeDocumentKinds = new Set(['policy','contract','certificate','application_receipt','invoice','lease','deed','dask_policy','home_insurance_policy','vehicle_registration','vehicle_insurance_policy','inspection_report','service_receipt','fuel_receipt','charging_receipt','other']);
const managedLifeInsuranceKinds = new Set(['dask','home','vehicle_compulsory','vehicle_comprehensive','other']);
const managedLifeBillingCycles = new Set(['monthly','quarterly','yearly','other']);
const managedLifeTenures = new Set(['owner','tenant']);
const managedLifePropertyTypes = new Set(['residence','workplace','land','other']);
const managedLifeVehicleTypes = new Set(['car','motorcycle','commercial','other']);
const managedLifeEnergyTypes = new Set(['fuel','electric','hybrid','other']);
const managedHomeInventoryItemTypes = new Set([
  'room','meter','meter_reading','belonging','warranty','service','document'
]);
const familyEmergencyItemTypes = new Set([
  'emergency_plan','meeting_point','external_contact','checklist_item','checklist_status','member_status'
]);
const familyEmergencyPreparednessItemTypes = new Set([
  'preparedness_kit','preparedness_kit_item','preparedness_kit_check','emergency_drill'
]);
const familyEmergencyAssistanceItemTypes = new Set([
  'emergency_profile','health_fact','emergency_contact','assistance_instruction'
]);
const familyEmergencyCardPortabilityItemTypes = new Set([
  'card_configuration','selected_field','document_link','export_event','power_mode_event'
]);
const familyEmergencyCardSourceFieldMatrix = new Map<string, ReadonlySet<string>>([
  ['emergency_profile', new Set(['label','subject_display'])],
  ['health_fact', new Set(['fact_value','note'])],
  ['emergency_contact', new Set(['name','phone_e164','relationship','note'])],
  ['assistance_instruction', new Set(['instruction_kind','instruction','note'])]
]);
const familyEmergencyPlanKinds = new Set(['general','earthquake','fire','flood','evacuation','other']);
const familyEmergencyMeetingPointKinds = new Set(['primary','alternate']);
const familyEmergencyChecklistStatuses = new Set(['open','completed']);
const familyEmergencyMemberStatuses = new Set(['safe','needs_help']);
const familyEmergencyPreparednessKitKinds = new Set(['household_72_hour','vehicle','workplace','other']);
const familyEmergencyPreparednessKitItemCategories = new Set([
  'water','food','first_aid','hygiene','lighting_power','communication',
  'clothing_shelter','document_copy','tool','other'
]);
const familyEmergencyPreparednessQuantityUnits = new Set([
  'item','liter','kilogram','dose','meter','other'
]);
const familyEmergencyPreparednessCheckStatuses = new Set([
  'ready','low','missing','expired','replace'
]);
const familyEmergencyDrillKinds = new Set(['earthquake','fire','flood','power_outage']);
const familyEmergencyDrillStatuses = new Set(['completed','partial','cancelled']);
const familyEmergencyAssistanceSubjectKinds = new Set(['person','pet']);
const familyEmergencyAssistanceFactKinds = new Set([
  'blood_type','allergy','chronic_condition','medication','medical_device','other'
]);
const familyEmergencyAssistanceBloodTypes = new Set([
  'a_positive','a_negative','b_positive','b_negative','ab_positive','ab_negative',
  'o_positive','o_negative','unknown'
]);
const familyEmergencyAssistanceInstructionKinds = new Set([
  'mobility','vision','hearing','communication','cognitive','medication_support',
  'evacuation','pet_care','other'
]);
const familyEmergencyText = (value: unknown, maximum: number): boolean =>
  boundedString(value, maximum) && String(value).trim().length >= 2;
const optionalFamilyEmergencyText = (value: unknown, maximum: number): boolean =>
  value === undefined || familyEmergencyText(value, maximum);
const managedHomeRoomKinds = new Set([
  'living_room','bedroom','kitchen','bathroom','storage','garage','garden','other'
]);
const managedHomeMeterKinds = new Set(['electricity','water','natural_gas','other']);
const managedHomeReadingUnits = new Set([
  'wh','milliliter','milliliter_cubic_meter_equivalent','custom_milliunit'
]);
const managedHomeReadingKinds = new Set(['reading','reset','replacement']);
const managedHomeBelongingKinds = new Set(['appliance','electronics','furniture','tool','other']);
const managedHomeServiceTargetTypes = new Set(['room','meter','belonging']);
const managedHomeServiceKinds = new Set(['maintenance','repair','inspection','installation','other']);
const managedHomeDocumentTargetTypes = new Set(['meter','belonging','warranty','service']);
const managedHomeDocumentKinds = new Set(['invoice','warranty','service_receipt','meter_document','other']);
const validManagedHomeSupersession = (value: Record<string, unknown>): boolean =>
  value.supersedesItemId === undefined || validManagedLifeId(value.supersedesItemId);

const validManagedLifeTimestamp = (value: unknown): boolean =>
  isExactManagedLifeIsoDateTime(value);

const optionalManagedLifeTimestamp = (value: unknown): boolean =>
  value === undefined || validManagedLifeTimestamp(value);

const optionalExactIsoDate = (value: unknown): boolean =>
  value === undefined || isExactManagedLifeIsoCalendarDate(value);

const optionalManagedLifeCount = (value: unknown): boolean =>
  value === undefined
  || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 9_000_000_000_000_000);
const optionalManagedLifePositiveCount = (value: unknown): boolean =>
  value === undefined
  || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= 9_000_000_000_000_000);
const optionalManagedLifeText = (value: unknown, maximum: number): boolean =>
  value === undefined || boundedString(value, maximum);
const validManagedLifeId = (value: unknown): boolean =>
  typeof value === 'string'
  && value === value.trim()
  && value.length >= 2
  && value.length <= 160
  && !/[\\/\0]/u.test(value);

const validManagedLifeReminder = (value: unknown): boolean =>
  value === undefined
  || (isObject(value)
    && managedLifeReminderKinds.has(String(value.kind))
    && validManagedLifeTimestamp(value.dueAt));

const validManagedLifeDetails = (category: unknown, details: unknown): boolean => {
  if (!isObject(details)) return false;
  switch (category) {
    case 'insurance':
      return managedLifeInsuranceKinds.has(String(details.insuranceKind))
        && boundedString(details.provider, 160);
    case 'subscription':
      return boundedString(details.provider, 160)
        && boundedString(details.planName, 120)
        && managedLifeBillingCycles.has(String(details.billingCycle));
    case 'education':
      return boundedString(details.institution, 160) && boundedString(details.program, 160);
    case 'employment':
      return boundedString(details.employer, 160) && boundedString(details.position, 120);
    case 'official_operation':
      return boundedString(details.authority, 160) && boundedString(details.operationType, 120);
    case 'home':
      return managedLifeTenures.has(String(details.tenure))
        && managedLifePropertyTypes.has(String(details.propertyType))
        && boundedString(details.addressLabel, 240);
    case 'vehicle':
      return managedLifeVehicleTypes.has(String(details.vehicleType))
        && managedLifeEnergyTypes.has(String(details.energyType))
        && (details.plate === undefined
          || (boundedString(details.plate, 20) && /^[\p{L}\p{N} -]+$/u.test(String(details.plate))));
    default:
      return false;
  }
};

const managedLifeInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (args.length !== 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = args[0];
  if (!isObject(value)) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  if (value.itemType !== 'profile'
    && value.itemType !== 'activity'
    && !managedHomeInventoryItemTypes.has(String(value.itemType))
    && !familyEmergencyItemTypes.has(String(value.itemType))
    && !familyEmergencyPreparednessItemTypes.has(String(value.itemType))
    && !familyEmergencyAssistanceItemTypes.has(String(value.itemType))
    && !familyEmergencyCardPortabilityItemTypes.has(String(value.itemType))) {
    return rejected('MANAGED_LIFE_ITEM_TYPE_INVALID', '$[0].itemType');
  }
  if (value.itemType === 'export_event') {
    return rejected('MANAGED_LIFE_MAIN_PROCESS_ONLY', '$[0].itemType');
  }
  const inspection = inspectManagedLifeDataContract(value);
  if (inspection.prohibitedFields.length > 0) {
    return rejected('MANAGED_LIFE_SECRET_FIELD_PROHIBITED', inspection.prohibitedFields[0]);
  }
  if (inspection.panLikeValueDetected || inspection.base64LikeValueDetected) {
    return rejected('MANAGED_LIFE_SECRET_VALUE_PROHIBITED', '$[0]');
  }
  if (inspection.pathLikeValueDetected) {
    return rejected('MANAGED_LIFE_PATH_VALUE_PROHIBITED', '$[0]');
  }
  if (inspection.unknownFields.length > 0) {
    return rejected('UNKNOWN_OBJECT_FIELD', inspection.unknownFields[0]);
  }
  if (!inspection.exactShape || inspection.missingFields.length > 0) {
    return rejected('MANAGED_LIFE_ARGUMENT_INVALID', inspection.missingFields[0] ?? '$[0]');
  }

  if (value.itemType === 'profile') {
    const valid = validManagedLifeId(value.ownerPersonId)
      && managedLifeCategories.has(String(value.category))
      && boundedString(value.title, 120) && String(value.title).trim().length >= 2
      && managedLifeStatuses.has(String(value.status))
      && recordPrivacyValues.has(String(value.privacy))
      && validManagedLifeDetails(value.category, value.details)
      && optionalManagedLifeTimestamp(value.startsAt)
      && optionalManagedLifeTimestamp(value.endsAt)
      && validManagedLifeReminder(value.initialReminder)
      && (value.financeAssetId === undefined || validManagedLifeId(value.financeAssetId))
      && (value.startsAt === undefined || value.endsAt === undefined
        || Date.parse(String(value.endsAt)) >= Date.parse(String(value.startsAt)));
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'activity') {
    const reminderValid = value.reminderMutation === undefined
      || (isObject(value.reminderMutation)
        && (value.reminderMutation.action === 'clear'
          || (value.reminderMutation.action === 'set'
            && managedLifeReminderKinds.has(String(value.reminderMutation.kind))
            && validManagedLifeTimestamp(value.reminderMutation.dueAt))));
    const amountCurrencyPairValid = (value.amountMinor === undefined) === (value.currency === undefined);
    const valid = validManagedLifeId(value.recordId)
      && managedLifeActivityKinds.has(String(value.activityKind))
      && validManagedLifeTimestamp(value.occurredAt)
      && optionalManagedLifeText(value.provider, 160)
      && optionalManagedLifePositiveCount(value.amountMinor)
      && (value.currency === undefined || (typeof value.currency === 'string' && /^[A-Za-z]{3}$/u.test(value.currency)))
      && amountCurrencyPairValid
      && optionalManagedLifePositiveCount(value.quantityMilliunits)
      && optionalManagedLifeCount(value.odometerKm)
      && (value.financeExpenseId === undefined || validManagedLifeId(value.financeExpenseId))
      && reminderValid
      && optionalManagedLifeText(value.note, 500)
      && ((value.activityKind === 'fuel' || value.activityKind === 'charging')
        === (value.quantityMilliunits !== undefined))
      && !(value.financeExpenseId !== undefined && (value.amountMinor !== undefined || value.currency !== undefined))
      && (value.reminderMutation === undefined
        || !isObject(value.reminderMutation)
        || value.reminderMutation.action !== 'set'
        || Date.parse(String(value.reminderMutation.dueAt)) >= Date.parse(String(value.occurredAt)));
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'emergency_plan') {
    const valid = familyEmergencyPlanKinds.has(String(value.planKind))
      && familyEmergencyText(value.title, 120)
      && familyEmergencyText(value.evacuationInstructions, 2_000);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'meeting_point') {
    const valid = validManagedLifeId(value.planId)
      && familyEmergencyMeetingPointKinds.has(String(value.meetingPointKind))
      && familyEmergencyText(value.label, 240)
      && optionalFamilyEmergencyText(value.address, 300)
      && optionalFamilyEmergencyText(value.directions, 500)
      && validManagedHomeSupersession(value);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'external_contact') {
    const valid = validManagedLifeId(value.planId)
      && familyEmergencyText(value.name, 120)
      && typeof value.phoneE164 === 'string'
      && /^\+[1-9][0-9]{7,14}$/u.test(value.phoneE164)
      && familyEmergencyText(value.city, 120)
      && optionalFamilyEmergencyText(value.note, 500)
      && validManagedHomeSupersession(value);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'checklist_item') {
    const valid = validManagedLifeId(value.planId)
      && familyEmergencyText(value.label, 240)
      && typeof value.sortOrder === 'number'
      && Number.isSafeInteger(value.sortOrder)
      && value.sortOrder >= 0
      && value.sortOrder <= 10_000
      && validManagedHomeSupersession(value);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'checklist_status') {
    const valid = validManagedLifeId(value.planId)
      && validManagedLifeId(value.checklistItemId)
      && familyEmergencyChecklistStatuses.has(String(value.status));
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'member_status') {
    const valid = validManagedLifeId(value.planId)
      && validManagedLifeId(value.memberPersonId)
      && familyEmergencyMemberStatuses.has(String(value.status))
      && validManagedLifeTimestamp(value.occurredAt)
      && optionalFamilyEmergencyText(value.note, 500);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'preparedness_kit') {
    const valid = validManagedLifeId(value.planId)
      && familyEmergencyPreparednessKitKinds.has(String(value.kitKind))
      && familyEmergencyText(value.label, 120)
      && validManagedHomeSupersession(value);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'preparedness_kit_item') {
    const valid = validManagedLifeId(value.planId)
      && validManagedLifeId(value.kitId)
      && familyEmergencyPreparednessKitItemCategories.has(String(value.category))
      && familyEmergencyText(value.label, 160)
      && value.targetQuantityMilliunits !== undefined
      && optionalManagedLifePositiveCount(value.targetQuantityMilliunits)
      && familyEmergencyPreparednessQuantityUnits.has(String(value.quantityUnit))
      && optionalExactIsoDate(value.expiresOn)
      && validManagedHomeSupersession(value);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'preparedness_kit_check') {
    const valid = validManagedLifeId(value.planId)
      && validManagedLifeId(value.kitItemId)
      && familyEmergencyPreparednessCheckStatuses.has(String(value.status))
      && value.actualQuantityMilliunits !== undefined
      && optionalManagedLifeCount(value.actualQuantityMilliunits)
      && validManagedLifeTimestamp(value.checkedAt)
      && optionalFamilyEmergencyText(value.note, 500);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'emergency_drill') {
    const valid = validManagedLifeId(value.planId)
      && familyEmergencyDrillKinds.has(String(value.drillKind))
      && familyEmergencyDrillStatuses.has(String(value.status))
      && validManagedLifeTimestamp(value.occurredAt)
      && (value.durationSeconds === undefined
        || (typeof value.durationSeconds === 'number'
          && Number.isSafeInteger(value.durationSeconds)
          && value.durationSeconds >= 1
          && value.durationSeconds <= 604_800))
      && optionalFamilyEmergencyText(value.note, 500)
      && validManagedHomeSupersession(value);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'emergency_profile') {
    const personSubject = value.subjectKind === 'person'
      && validManagedLifeId(value.subjectPersonId);
    const petSubject = value.subjectKind === 'pet'
      && validManagedLifeId(value.subjectPetId)
      && validManagedLifeId(value.responsiblePersonId);
    const valid = validManagedLifeId(value.planId)
      && familyEmergencyText(value.label, 120)
      && familyEmergencyAssistanceSubjectKinds.has(String(value.subjectKind))
      && (personSubject || petSubject);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'health_fact') {
    const bloodFact = value.factKind === 'blood_type'
      && familyEmergencyAssistanceBloodTypes.has(String(value.bloodType));
    const textFact = value.factKind !== 'blood_type'
      && familyEmergencyAssistanceFactKinds.has(String(value.factKind))
      && familyEmergencyText(value.value, 240);
    const valid = validManagedLifeId(value.profileId)
      && (bloodFact || textFact)
      && optionalFamilyEmergencyText(value.note, 500)
      && validManagedHomeSupersession(value);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'emergency_contact') {
    const valid = validManagedLifeId(value.profileId)
      && familyEmergencyText(value.name, 120)
      && typeof value.phoneE164 === 'string'
      && /^\+[1-9][0-9]{7,14}$/u.test(value.phoneE164)
      && optionalFamilyEmergencyText(value.relationship, 120)
      && optionalFamilyEmergencyText(value.note, 500)
      && validManagedHomeSupersession(value);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'assistance_instruction') {
    const valid = validManagedLifeId(value.profileId)
      && familyEmergencyAssistanceInstructionKinds.has(String(value.instructionKind))
      && familyEmergencyText(value.instruction, 1_000)
      && optionalFamilyEmergencyText(value.note, 500)
      && validManagedHomeSupersession(value);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'card_configuration') {
    const valid = validManagedLifeId(value.profileId)
      && familyEmergencyText(value.label, 120)
      && value.locale === 'tr-TR';
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'selected_field') {
    const sourceFields = familyEmergencyCardSourceFieldMatrix.get(String(value.sourceItemType));
    const valid = validManagedLifeId(value.profileId)
      && validManagedLifeId(value.configurationId)
      && validManagedLifeId(value.sourceItemId)
      && sourceFields !== undefined
      && sourceFields.has(String(value.fieldCode));
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'document_link') {
    const valid = validManagedLifeId(value.profileId)
      && validManagedLifeId(value.configurationId)
      && typeof value.archiveItemId === 'string'
      && /^[A-Za-z0-9][A-Za-z0-9._-]{1,159}$/u.test(value.archiveItemId);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'export_event') {
    const commonValid = validManagedLifeId(value.profileId)
      && validManagedLifeId(value.configurationId)
      && ['print','pdf','encrypted_pack'].includes(String(value.mode))
      && typeof value.selectedFieldCount === 'number'
      && Number.isSafeInteger(value.selectedFieldCount)
      && value.selectedFieldCount >= 0 && value.selectedFieldCount <= 64
      && typeof value.documentCount === 'number'
      && Number.isSafeInteger(value.documentCount)
      && value.documentCount >= 0 && value.documentCount <= 10
      && typeof value.artifactSha256 === 'string'
      && /^[a-f0-9]{64}$/u.test(value.artifactSha256)
      && typeof value.selectionSha256 === 'string'
      && /^[a-f0-9]{64}$/u.test(value.selectionSha256)
      && typeof value.artifactSizeBytes === 'number'
      && Number.isSafeInteger(value.artifactSizeBytes)
      && value.artifactSizeBytes >= 1 && value.artifactSizeBytes <= 50 * 1024 * 1024
      && ['battery','ac','unknown'].includes(String(value.powerSource))
      && value.batteryLevel === 'not_measured'
      && value.automaticLowBatteryDetection === 'not_performed'
      && value.lowBatteryClaimed === false;
    const modeValid = value.mode === 'print'
      ? value.artifactReadbackStatus === 'not_applicable_print'
        && value.printerDispatchStatus === 'confirmed'
      : (value.mode === 'pdf' || value.mode === 'encrypted_pack')
        && value.artifactReadbackStatus === 'verified'
        && value.printerDispatchStatus === undefined;
    return commonValid && modeValid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'power_mode_event') {
    const valid = validManagedLifeId(value.profileId)
      && validManagedLifeId(value.configurationId)
      && ['enabled','disabled'].includes(String(value.mode))
      && value.activationSource === 'manual'
      && ['battery','ac','unknown'].includes(String(value.powerSource))
      && value.batteryLevel === 'not_measured'
      && value.automaticLowBatteryDetection === 'not_performed'
      && value.lowBatteryClaimed === false;
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'room') {
    const valid = validManagedLifeId(value.recordId)
      && boundedString(value.name, 120)
      && managedHomeRoomKinds.has(String(value.roomKind))
      && validManagedHomeSupersession(value);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'meter') {
    const valid = validManagedLifeId(value.recordId)
      && (value.roomId === undefined || validManagedLifeId(value.roomId))
      && boundedString(value.label, 120)
      && managedHomeMeterKinds.has(String(value.meterKind))
      && managedHomeReadingUnits.has(String(value.readingUnit))
      && ((value.meterKind === 'electricity' && value.readingUnit === 'wh')
        || (value.meterKind === 'water' && value.readingUnit === 'milliliter')
        || (value.meterKind === 'natural_gas' && value.readingUnit === 'milliliter_cubic_meter_equivalent')
        || (value.meterKind === 'other' && value.readingUnit === 'custom_milliunit'))
      && validManagedHomeSupersession(value);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'meter_reading') {
    const valid = validManagedLifeId(value.recordId)
      && validManagedLifeId(value.meterId)
      && managedHomeReadingKinds.has(String(value.readingKind))
      && optionalManagedLifeCount(value.readingMilliunits)
      && value.readingMilliunits !== undefined
      && validManagedLifeTimestamp(value.recordedAt)
      && optionalManagedLifeText(value.note, 500)
      && (value.readingKind === 'reading' || boundedString(value.note, 500))
      && validManagedHomeSupersession(value);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'belonging') {
    const amountCurrencyPairValid = (value.purchaseAmountMinor === undefined) === (value.currency === undefined);
    const valid = validManagedLifeId(value.recordId)
      && (value.roomId === undefined || validManagedLifeId(value.roomId))
      && boundedString(value.name, 120)
      && managedHomeBelongingKinds.has(String(value.belongingKind))
      && (value.serialNumber === undefined
        || (boundedString(value.serialNumber, 160)
          && String(value.serialNumber).trim().length >= 2
          && /^[\p{L}\p{N}][\p{L}\p{N} ._:/+()-]*$/u.test(String(value.serialNumber).trim())))
      && optionalManagedLifeTimestamp(value.purchasedAt)
      && optionalManagedLifePositiveCount(value.purchaseAmountMinor)
      && (value.currency === undefined || (typeof value.currency === 'string' && /^[A-Za-z]{3}$/u.test(value.currency)))
      && amountCurrencyPairValid
      && (value.financeExpenseId === undefined || validManagedLifeId(value.financeExpenseId))
      && !(value.financeExpenseId !== undefined
        && (value.purchaseAmountMinor !== undefined || value.currency !== undefined))
      && validManagedHomeSupersession(value);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'warranty') {
    const valid = validManagedLifeId(value.recordId)
      && validManagedLifeId(value.belongingId)
      && optionalManagedLifeText(value.provider, 160)
      && validManagedLifeTimestamp(value.startsAt)
      && validManagedLifeTimestamp(value.endsAt)
      && optionalManagedLifeTimestamp(value.reminderAt)
      && optionalManagedLifeText(value.note, 500)
      && Date.parse(String(value.endsAt)) >= Date.parse(String(value.startsAt))
      && (value.reminderAt === undefined
        || (Date.parse(String(value.reminderAt)) >= Date.parse(String(value.startsAt))
          && Date.parse(String(value.reminderAt)) <= Date.parse(String(value.endsAt))))
      && validManagedHomeSupersession(value);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'service') {
    const amountCurrencyPairValid = (value.amountMinor === undefined) === (value.currency === undefined);
    const valid = validManagedLifeId(value.recordId)
      && validManagedLifeId(value.targetItemId)
      && managedHomeServiceTargetTypes.has(String(value.targetType))
      && managedHomeServiceKinds.has(String(value.serviceKind))
      && validManagedLifeTimestamp(value.occurredAt)
      && optionalManagedLifeText(value.provider, 160)
      && optionalManagedLifePositiveCount(value.amountMinor)
      && (value.currency === undefined || (typeof value.currency === 'string' && /^[A-Za-z]{3}$/u.test(value.currency)))
      && amountCurrencyPairValid
      && (value.financeExpenseId === undefined || validManagedLifeId(value.financeExpenseId))
      && !(value.financeExpenseId !== undefined && (value.amountMinor !== undefined || value.currency !== undefined))
      && optionalManagedLifeText(value.note, 500)
      && validManagedHomeSupersession(value);
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  if (value.itemType === 'document') {
    const inventoryDocument = value.targetItemId !== undefined || value.targetType !== undefined;
    const valid = validManagedLifeId(value.recordId)
      && typeof value.archiveItemId === 'string'
      && /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.test(value.archiveItemId)
      && (inventoryDocument
        ? validManagedLifeId(value.targetItemId)
          && managedHomeDocumentTargetTypes.has(String(value.targetType))
          && managedHomeDocumentKinds.has(String(value.documentKind))
        : managedLifeDocumentKinds.has(String(value.documentKind)))
      && optionalBoundedString(value.label, inventoryDocument ? 120 : 240)
      && (!inventoryDocument || validManagedHomeSupersession(value));
    return valid ? accepted() : rejected('MANAGED_LIFE_ARGUMENT_INVALID', '$[0]');
  }

  return rejected('MANAGED_LIFE_ITEM_TYPE_INVALID', '$[0].itemType');
};

const emergencyCardExportInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => exactObject(
  args,
  ['profileId','configurationId','mode','selectedFieldIds','documentLinkIds','password','code','packagePassphrase','plaintextWarningConfirmed'],
  (value) => {
    const mode = String(value.mode);
    const ids = (candidate: unknown, maximum: number): candidate is readonly string[] =>
      Array.isArray(candidate)
      && candidate.length <= maximum
      && candidate.every(validManagedLifeId)
      && new Set(candidate).size === candidate.length;
    return validManagedLifeId(value.profileId)
      && validManagedLifeId(value.configurationId)
      && ['print','pdf','encrypted_pack'].includes(mode)
      && ids(value.selectedFieldIds, 64)
      && ids(value.documentLinkIds, 10)
      && (mode === 'encrypted_pack' || (value.documentLinkIds as readonly string[]).length === 0)
      && (value.selectedFieldIds as readonly string[]).length + (value.documentLinkIds as readonly string[]).length > 0
      && boundedString(value.password, 1024)
      && optionalBoundedString(value.code, 256)
      && (mode === 'encrypted_pack'
        ? typeof value.packagePassphrase === 'string'
          && value.packagePassphrase.normalize('NFKC').length >= 12
          && value.packagePassphrase.length <= 1024
        : value.packagePassphrase === undefined)
      && (mode === 'encrypted_pack'
        ? value.plaintextWarningConfirmed === false
        : value.plaintextWarningConfirmed === true);
  }
);

const containsProhibitedBankingSecret = (
  value: Record<string, unknown>,
  panSearchFields: readonly string[]
): IpcIntegrationPolicyDecision | undefined => {
  if (Object.keys(value).some(isProhibitedBankingSecretField)) {
    return rejected('BANKING_SECRET_FIELD_PROHIBITED', '$[0]');
  }
  if (panSearchFields.some((key) => containsLikelyFullPan(value[key]))) {
    return rejected('BANKING_SECRET_VALUE_PROHIBITED', '$[0]');
  }
  return undefined;
};

const containsNestedProhibitedBankingSecret = (
  value: unknown,
  path = '$[0]',
  depth = 0
): IpcIntegrationPolicyDecision | undefined => {
  if (depth > 8) return rejected('ARGUMENT_NESTING_TOO_DEEP', path);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const rejectedValue = containsNestedProhibitedBankingSecret(value[index], `${path}[${index}]`, depth + 1);
      if (rejectedValue) return rejectedValue;
    }
    return undefined;
  }
  if (!isObject(value)) return containsLikelyFullPan(value) ? rejected('BANKING_SECRET_VALUE_PROHIBITED', path) : undefined;
  for (const [key, nested] of Object.entries(value)) {
    if (isProhibitedBankingSecretField(key)) return rejected('BANKING_SECRET_FIELD_PROHIBITED', `${path}.${key}`);
    const rejectedValue = containsNestedProhibitedBankingSecret(nested, `${path}.${key}`, depth + 1);
    if (rejectedValue) return rejectedValue;
  }
  return undefined;
};

const ibanValidationInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => exactObject(
  args,
  ['iban'],
  (value) => boundedString(value.iban, 64)
);

const bankAccountInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (args.length !== 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = args[0];
  if (!isObject(value)) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  const secretRejection = containsProhibitedBankingSecret(value, ['alias', 'branch']);
  if (secretRejection) return secretRejection;
  if (!hasOnlyKeys(value, BANK_ACCOUNT_INPUT_KEYS)) return rejected('UNKNOWN_OBJECT_FIELD', '$[0]');
  return boundedString(value.ownerPersonId, 128)
    && typeof value.institutionCode === 'string' && /^\d{4}$/u.test(value.institutionCode)
    && boundedString(value.iban, 64)
    && bankAccountTypes.has(String(value.accountType))
    && typeof value.currency === 'string' && /^[A-Za-z]{3}$/u.test(value.currency)
    && boundedString(value.alias, 100)
    && optionalBoundedString(value.branch, 120)
    && typeof value.ownershipBasisPoints === 'number'
    && Number.isInteger(value.ownershipBasisPoints)
    && value.ownershipBasisPoints >= 1
    && value.ownershipBasisPoints <= 10_000
    && bankAccountStatuses.has(String(value.status))
    && recordPrivacyValues.has(String(value.privacy))
    ? accepted()
    : rejected('BANK_ACCOUNT_ARGUMENT_INVALID', '$[0]');
};

const paymentCardInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (args.length !== 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = args[0];
  if (!isObject(value)) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  const secretRejection = containsProhibitedBankingSecret(value, ['productName']);
  if (secretRejection) return secretRejection;
  if (!hasOnlyKeys(value, PAYMENT_CARD_INPUT_KEYS)) return rejected('UNKNOWN_OBJECT_FIELD', '$[0]');
  const finiteAmount = (candidate: unknown): candidate is number =>
    typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0 && candidate <= 1_000_000_000_000_000;
  const amountsValid = [
    value.creditLimit,
    value.availableLimit,
    value.currentDebt,
    value.statementBalance,
    value.installmentOutstandingAmount,
    value.rewardPoints,
    value.rewardMiles,
    value.annualFeeAmount
  ].every(finiteAmount);
  const installmentPairValid = typeof value.activeInstallmentCount === 'number'
    && typeof value.installmentOutstandingAmount === 'number'
    && ((value.activeInstallmentCount === 0 && value.installmentOutstandingAmount === 0)
      || (value.activeInstallmentCount > 0 && value.installmentOutstandingAmount > 0));
  const annualFeePairValid = typeof value.annualFeeAmount === 'number'
    && (value.annualFeeAmount === 0 || boundedString(value.annualFeeDueAt, 64));
  return boundedString(value.ownerPersonId, 128)
    && typeof value.institutionCode === 'string' && /^\d{4}$/u.test(value.institutionCode)
    && boundedString(value.productName, 120)
    && paymentCardKinds.has(String(value.kind))
    && paymentCardNetworks.has(String(value.network))
    && paymentCardFormFactors.has(String(value.formFactor))
    && typeof value.last4 === 'string' && /^\d{4}$/u.test(value.last4)
    && typeof value.currency === 'string' && /^[A-Za-z]{3}$/u.test(value.currency)
    && amountsValid
    && typeof value.availableLimit === 'number'
    && typeof value.creditLimit === 'number'
    && value.availableLimit <= value.creditLimit
    && boundedString(value.statementClosingAt, 64)
    && boundedString(value.paymentDueAt, 64)
    && optionalInteger(value.activeInstallmentCount, 0, 999)
    && installmentPairValid
    && paymentCardAutomaticPaymentModes.has(String(value.automaticPaymentMode))
    && optionalBoundedString(value.annualFeeDueAt, 64)
    && annualFeePairValid
    && typeof value.alertsEnabled === 'boolean'
    && typeof value.utilizationAlertBasisPoints === 'number'
    && optionalInteger(value.utilizationAlertBasisPoints, 1, 10_000)
    && typeof value.paymentDueAlertDays === 'number'
    && optionalInteger(value.paymentDueAlertDays, 0, 365)
    && paymentCardStatuses.has(String(value.status))
    && recordPrivacyValues.has(String(value.privacy))
    ? accepted()
    : rejected('PAYMENT_CARD_ARGUMENT_INVALID', '$[0]');
};

const loanAccountInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (args.length !== 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = args[0];
  if (!isObject(value)) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  const secretRejection = containsProhibitedBankingSecret(value, [
    'title',
    'insuranceProvider',
    'insurancePolicyReference',
    'collateralDescription'
  ]);
  if (secretRejection) return secretRejection;
  if (!hasOnlyKeys(value, LOAN_ACCOUNT_INPUT_KEYS)) return rejected('UNKNOWN_OBJECT_FIELD', '$[0]');
  const finiteAmount = (candidate: unknown): candidate is number =>
    typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0 && candidate <= 1_000_000_000_000_000;
  const amountsValid = [
    value.originalPrincipal,
    value.installmentAmount,
    value.remainingPrincipal,
    value.earlySettlementAmount,
    value.overdueAmount,
    value.insurancePremiumAmount,
    value.collateralEstimatedValue
  ].every(finiteAmount);
  const earlySettlementValid = typeof value.earlySettlementAmount === 'number'
    && ((value.earlySettlementAmount === 0 && value.earlySettlementQuotedAt === undefined)
      || (value.earlySettlementAmount > 0 && boundedString(value.earlySettlementQuotedAt, 64)));
  const overdue = typeof value.overdueInstallmentCount === 'number'
    && typeof value.overdueAmount === 'number'
    && typeof value.daysPastDue === 'number'
    && value.overdueInstallmentCount > 0
    && value.overdueAmount > 0
    && value.daysPastDue > 0;
  const noOverdue = value.overdueInstallmentCount === 0 && value.overdueAmount === 0 && value.daysPastDue === 0;
  const insuranceValid = value.insuranceStatus === 'none'
    ? value.insuranceProvider === undefined
      && value.insurancePolicyReference === undefined
      && value.insurancePremiumAmount === 0
      && value.insuranceEndsAt === undefined
    : boundedString(value.insuranceProvider, 120)
      && boundedString(value.insurancePolicyReference, 120)
      && typeof value.insurancePremiumAmount === 'number'
      && value.insurancePremiumAmount > 0
      && boundedString(value.insuranceEndsAt, 64);
  const collateralValid = value.collateralType === 'none'
    ? value.collateralDescription === undefined && value.collateralEstimatedValue === 0
    : boundedString(value.collateralDescription, 240)
      && typeof value.collateralEstimatedValue === 'number'
      && value.collateralEstimatedValue > 0;
  return boundedString(value.ownerPersonId, 128)
    && typeof value.institutionCode === 'string' && /^\d{4}$/u.test(value.institutionCode)
    && boundedString(value.title, 120)
    && loanKinds.has(String(value.kind))
    && loanRateTypes.has(String(value.rateType))
    && typeof value.annualRateBasisPoints === 'number'
    && optionalInteger(value.annualRateBasisPoints, 0, 100_000)
    && (value.rateType !== 'interest_free' || value.annualRateBasisPoints === 0)
    && typeof value.termMonths === 'number'
    && optionalInteger(value.termMonths, 1, 600)
    && typeof value.currency === 'string' && /^[A-Za-z]{3}$/u.test(value.currency)
    && amountsValid
    && typeof value.originalPrincipal === 'number' && value.originalPrincipal > 0
    && typeof value.installmentAmount === 'number' && value.installmentAmount > 0
    && typeof value.remainingPrincipal === 'number'
    && value.remainingPrincipal <= value.originalPrincipal
    && boundedString(value.disbursedAt, 64)
    && boundedString(value.firstPaymentAt, 64)
    && earlySettlementValid
    && typeof value.overdueInstallmentCount === 'number'
    && optionalInteger(value.overdueInstallmentCount, 0, 600)
    && typeof value.daysPastDue === 'number'
    && optionalInteger(value.daysPastDue, 0, 36_500)
    && (overdue || noOverdue)
    && loanInsuranceStatuses.has(String(value.insuranceStatus))
    && optionalBoundedString(value.insuranceProvider, 120)
    && optionalBoundedString(value.insurancePolicyReference, 120)
    && optionalBoundedString(value.insuranceEndsAt, 64)
    && insuranceValid
    && loanCollateralTypes.has(String(value.collateralType))
    && optionalBoundedString(value.collateralDescription, 240)
    && collateralValid
    && loanStatuses.has(String(value.status))
    && ((value.status === 'overdue' && overdue) || (value.status !== 'overdue' && noOverdue))
    && ((value.status === 'closed' && value.remainingPrincipal === 0)
      || (value.status !== 'closed' && typeof value.remainingPrincipal === 'number' && value.remainingPrincipal > 0))
    && recordPrivacyValues.has(String(value.privacy))
    ? accepted()
    : rejected('LOAN_ACCOUNT_ARGUMENT_INVALID', '$[0]');
};

const loanPaymentInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (args.length !== 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = args[0];
  if (!isObject(value)) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  const secretRejection = containsProhibitedBankingSecret(value, ['notes']);
  if (secretRejection) return secretRejection;
  if (!hasOnlyKeys(value, LOAN_PAYMENT_INPUT_KEYS)) return rejected('UNKNOWN_OBJECT_FIELD', '$[0]');
  const finiteAmount = (candidate: unknown): candidate is number =>
    typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0 && candidate <= 1_000_000_000_000_000;
  const amountsValid = [value.amount, value.principalAmount, value.interestAmount, value.lateFeeAmount].every(finiteAmount);
  const components = Number(value.principalAmount) + Number(value.interestAmount) + Number(value.lateFeeAmount);
  return boundedString(value.loanId, 160)
    && boundedString(value.paidAt, 64)
    && optionalInteger(value.scheduledInstallmentSequence, 1, 600)
    && amountsValid
    && typeof value.amount === 'number' && value.amount > 0
    && Math.round(value.amount * 100) === Math.round(components * 100)
    && optionalBoundedString(value.notes, 500)
    ? accepted()
    : rejected('LOAN_PAYMENT_ARGUMENT_INVALID', '$[0]');
};

const financePlanningInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (args.length !== 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = args[0];
  if (!isObject(value)) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  const itemType = typeof value.itemType === 'string' ? value.itemType : '';
  if (!financePlanningItemTypes.has(itemType)) return rejected('FINANCE_PLANNING_ITEM_TYPE_INVALID', '$[0].itemType');
  const secretRejection = containsProhibitedBankingSecret(value, Object.keys(value));
  if (secretRejection) return secretRejection;
  const keys = FINANCE_PLANNING_INPUT_KEYS[itemType as keyof typeof FINANCE_PLANNING_INPUT_KEYS];
  if (!hasOnlyKeys(value, keys)) return rejected('UNKNOWN_OBJECT_FIELD', '$[0]');
  const finiteMoney = (candidate: unknown): candidate is number =>
    typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0 && candidate <= 1_000_000_000_000_000;
  const currency = (candidate: unknown): boolean => typeof candidate === 'string' && /^[A-Za-z]{3}$/u.test(candidate);
  const identifier = (candidate: unknown): boolean => boundedString(candidate, 160);
  const dateValue = (candidate: unknown): boolean => boundedString(candidate, 64);
  const privacy = (candidate: unknown): boolean => recordPrivacyValues.has(String(candidate));
  let valid = false;
  switch (itemType) {
    case 'category':
      valid = identifier(value.ownerPersonId) && boundedString(value.name, 80)
        && financeCategoryKinds.has(String(value.kind)) && privacy(value.privacy);
      break;
    case 'cash_flow':
      valid = identifier(value.categoryId) && finiteMoney(value.amount) && value.amount > 0
        && currency(value.currency) && dateValue(value.occurredAt)
        && financeCashFlowStatuses.has(String(value.status)) && optionalBoundedString(value.description, 240);
      break;
    case 'budget':
      valid = identifier(value.categoryId) && finiteMoney(value.plannedAmount)
        && currency(value.currency) && typeof value.periodMonth === 'string'
        && /^\d{4}-(?:0[1-9]|1[0-2])$/u.test(value.periodMonth);
      break;
    case 'recurring_rule':
      valid = identifier(value.categoryId) && finiteMoney(value.amount) && value.amount > 0
        && currency(value.currency) && financeRecurringFrequencies.has(String(value.frequency))
        && typeof value.intervalCount === 'number' && Number.isInteger(value.intervalCount)
        && value.intervalCount >= 1 && value.intervalCount <= 120
        && dateValue(value.startsAt) && dateValue(value.nextOccurrenceAt)
        && (value.endsAt === undefined || dateValue(value.endsAt))
        && optionalBoundedString(value.description, 240);
      break;
    case 'recurring_state':
      valid = identifier(value.recurringRuleId) && financeRecurringStatuses.has(String(value.status))
        && dateValue(value.effectiveAt);
      break;
    case 'goal':
      valid = identifier(value.ownerPersonId) && boundedString(value.title, 120)
        && financeGoalKinds.has(String(value.kind)) && finiteMoney(value.targetAmount) && value.targetAmount > 0
        && finiteMoney(value.initialAmount) && currency(value.currency)
        && (value.dueAt === undefined || dateValue(value.dueAt)) && privacy(value.privacy);
      break;
    case 'goal_progress':
      valid = identifier(value.goalId) && finiteMoney(value.currentAmount) && dateValue(value.recordedAt)
        && optionalBoundedString(value.note, 500);
      break;
    case 'asset':
      valid = identifier(value.ownerPersonId) && boundedString(value.name, 120)
        && financeAssetClasses.has(String(value.assetClass)) && currency(value.currency)
        && finiteMoney(value.quantity) && value.quantity > 0 && finiteMoney(value.unitValue)
        && dateValue(value.valuedAt) && optionalBoundedString(value.note, 500) && privacy(value.privacy);
      break;
    case 'asset_valuation':
      valid = identifier(value.assetId) && finiteMoney(value.quantity) && value.quantity > 0
        && finiteMoney(value.unitValue) && dateValue(value.valuedAt) && optionalBoundedString(value.note, 500);
      break;
  }
  return valid ? accepted() : rejected('FINANCE_PLANNING_ARGUMENT_INVALID', '$[0]');
};

const longTermPortfolioInput = (args:readonly unknown[]):IpcIntegrationPolicyDecision => {
  if(args.length!==1)return rejected('ARGUMENT_COUNT_MISMATCH');
  const value=args[0];if(!isObject(value))return rejected('OBJECT_ARGUMENT_REQUIRED','$[0]');
  const allowedTypes=new Set(['bootstrap_default','instrument_revision','plan_version','ledger_event','price_observation']);
  if(!allowedTypes.has(String(value.itemType)))return rejected('LONG_TERM_PORTFOLIO_ITEM_TYPE_INVALID','$[0].itemType');
  const secretRejection=containsNestedProhibitedBankingSecret(value);
  if(secretRejection)return secretRejection;
  const exactKeys:Record<string,readonly string[]>={
    bootstrap_default:['itemType','clientOperationId','ownerPersonId','portfolioName','effectiveMonth','targetDate','privacy'],
    instrument_revision:['itemType','clientOperationId','instrumentId','replacesRevisionId','assetClass','groupLabel','code','name','currency','effectiveFrom','status','isin','exchange','countryCode','priceSource','taxProfile','feeProfile','notes'],
    plan_version:['itemType','clientOperationId','portfolioId','effectiveMonth','monthlyContribution','contributionCurrency','contributionChangeReason','rebalanceIntervalMonths','inflationAdjustment','targetDate','assumptions','allocations'],
    ledger_event:['itemType','clientOperationId','portfolioId','instrumentId','eventType','direction','currency','orderAt','executedAt','settlementAt','entitlementAt','recordAt','paymentAt','quantity','unitPrice','grossAmount','feeAmount','taxAmount','netCashAmount','fxRate','broker','accountReference','orderReference','executionReference','partialFillSequence','lotReference','costLayerMethod','corporateActionReference','ratioNumerator','ratioDenominator','cashCarryoverInstrumentId','transferCounterpartyInstrumentId','reversalOfEventId','correctionReason','sourceLabel','sourceDocumentReference','notes'],
    price_observation:['itemType','clientOperationId','instrumentId','observedAt','unitPrice','currency','sourceLabel']
  };
  if(!hasOnlyKeys(value,exactKeys[String(value.itemType)]??[]))return rejected('UNKNOWN_OBJECT_FIELD','$[0]');
  const serialized=JSON.stringify(value);
  if(serialized.length>100_000)return rejected('LONG_TERM_PORTFOLIO_ARGUMENT_TOO_LARGE','$[0]');
  if(!boundedString(value.clientOperationId,128)||!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(String(value.clientOperationId)))return rejected('LONG_TERM_PORTFOLIO_OPERATION_ID_INVALID','$[0].clientOperationId');
  const finite=(candidate:unknown,min=-1_000_000_000_000_000,max=1_000_000_000_000_000)=>typeof candidate==='number'&&Number.isFinite(candidate)&&candidate>=min&&candidate<=max;
  const date=(candidate:unknown)=>boundedString(candidate,64)&&!Number.isNaN(Date.parse(String(candidate)));
  const optionalDate=(candidate:unknown)=>candidate===undefined||date(candidate);
  const optionalFinite=(candidate:unknown,min=-1_000_000_000_000_000,max=1_000_000_000_000_000)=>candidate===undefined||finite(candidate,min,max);
  const optionalIdentifier=(candidate:unknown)=>candidate===undefined||boundedString(candidate,160);
  const assetClasses=new Set(['domestic_equity','foreign_equity','fund','etf','bond_note','eurobond','deposit','foreign_currency','gold','silver','commodity','private_pension','ipo_reserve','cash_savings','crypto_asset','real_estate','vehicle','custom']);
  const instrumentStatuses=new Set(['active','inactive','matured','merged']);
  const inflationAdjustments=new Set(['manual_realized_inflation','fixed_assumption','none']);
  const sleeves=new Set(['core','growth','opportunity','ipo_reserve','liquidity','hedge','custom']);
  const eventTypes=new Set(['buy','sell','cash_dividend','rights_issue_used','rights_issue_sold','rights_issue_expired','bonus_shares','split','reverse_split','coupon','interest','fund_distribution','merger_exchange','code_change','transfer_in','transfer_out','fee','tax','cash_adjustment','reversal']);
  const directions=new Set(['cash_in','cash_out','security_in','security_out','non_cash']);
  const costLayerMethods=new Set(['fifo','weighted_average','specific_lot','not_applicable']);
  const corporateActions=new Set(['rights_issue_used','rights_issue_sold','rights_issue_expired','bonus_shares','split','reverse_split','merger_exchange','code_change']);
  const assumptionKeys=['pessimisticAnnualReturnBasisPoints','baseAnnualReturnBasisPoints','optimisticAnnualReturnBasisPoints','annualInflationBasisPoints','annualContributionGrowthBasisPoints'] as const;
  switch(value.itemType){
    case 'bootstrap_default':return boundedString(value.ownerPersonId,128)&&boundedString(value.portfolioName,160)&&typeof value.effectiveMonth==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/u.test(value.effectiveMonth)&&date(value.targetDate)&&String(value.targetDate).slice(0,7)>=String(value.effectiveMonth)&&recordPrivacyValues.has(String(value.privacy))?accepted():rejected('LONG_TERM_PORTFOLIO_BOOTSTRAP_INVALID','$[0]');
    case 'instrument_revision':return assetClasses.has(String(value.assetClass))&&boundedString(value.groupLabel,80)&&boundedString(value.code,32)&&boundedString(value.name,180)&&typeof value.currency==='string'&&/^[A-Za-z]{3}$/u.test(value.currency)&&date(value.effectiveFrom)&&instrumentStatuses.has(String(value.status))&&optionalBoundedString(value.instrumentId,160)&&optionalBoundedString(value.replacesRevisionId,160)&&(value.replacesRevisionId===undefined||boundedString(value.instrumentId,160))&&optionalBoundedString(value.isin,32)&&optionalBoundedString(value.exchange,120)&&(value.countryCode===undefined||typeof value.countryCode==='string'&&/^[A-Za-z]{2}$/u.test(value.countryCode))&&optionalBoundedString(value.priceSource,180)&&optionalBoundedString(value.taxProfile,240)&&optionalBoundedString(value.feeProfile,240)&&optionalBoundedString(value.notes,1000)?accepted():rejected('LONG_TERM_PORTFOLIO_INSTRUMENT_INVALID','$[0]');
    case 'plan_version':{
      const assumptions=isObject(value.assumptions)?value.assumptions:undefined;
      const valid=boundedString(value.portfolioId,160)&&typeof value.effectiveMonth==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/u.test(value.effectiveMonth)&&finite(value.monthlyContribution,0.01)&&typeof value.contributionCurrency==='string'&&/^[A-Za-z]{3}$/u.test(value.contributionCurrency)&&boundedString(value.contributionChangeReason,240)&&typeof value.rebalanceIntervalMonths==='number'&&Number.isInteger(value.rebalanceIntervalMonths)&&value.rebalanceIntervalMonths>=1&&value.rebalanceIntervalMonths<=60&&inflationAdjustments.has(String(value.inflationAdjustment))&&date(value.targetDate)&&String(value.targetDate).slice(0,7)>=String(value.effectiveMonth)&&assumptions!==undefined&&hasOnlyKeys(assumptions,assumptionKeys)&&assumptionKeys.every(key=>typeof assumptions[key]==='number'&&Number.isInteger(assumptions[key])&&finite(assumptions[key],-10000,100000))&&Number(assumptions.pessimisticAnnualReturnBasisPoints)<=Number(assumptions.baseAnnualReturnBasisPoints)&&Number(assumptions.baseAnnualReturnBasisPoints)<=Number(assumptions.optimisticAnnualReturnBasisPoints)&&Array.isArray(value.allocations)&&value.allocations.length>=1&&value.allocations.length<=250&&value.allocations.every(allocation=>isObject(allocation)&&hasOnlyKeys(allocation,['instrumentId','sleeve','targetBasisPoints','displayOrder','note'])&&boundedString(allocation.instrumentId,160)&&sleeves.has(String(allocation.sleeve))&&typeof allocation.targetBasisPoints==='number'&&Number.isInteger(allocation.targetBasisPoints)&&allocation.targetBasisPoints>=0&&allocation.targetBasisPoints<=10000&&typeof allocation.displayOrder==='number'&&Number.isInteger(allocation.displayOrder)&&allocation.displayOrder>=1&&allocation.displayOrder<=10000&&optionalBoundedString(allocation.note,500))&&new Set(value.allocations.map(allocation=>`${String((allocation as Record<string,unknown>).instrumentId)}:${String((allocation as Record<string,unknown>).sleeve)}`)).size===value.allocations.length&&value.allocations.reduce((sum,allocation)=>sum+Number((allocation as Record<string,unknown>).targetBasisPoints),0)===10000;
      return valid?accepted():rejected('LONG_TERM_PORTFOLIO_PLAN_INVALID','$[0]');
    }
    case 'ledger_event':{
      const trade=value.eventType==='buy'||value.eventType==='sell';const income=['cash_dividend','coupon','interest','fund_distribution'].includes(String(value.eventType));const reversal=value.eventType==='reversal';
      const directionByType:Record<string,string>={buy:'cash_out',rights_issue_used:'cash_out',fee:'cash_out',tax:'cash_out',sell:'cash_in',cash_dividend:'cash_in',rights_issue_sold:'cash_in',coupon:'cash_in',interest:'cash_in',fund_distribution:'cash_in',bonus_shares:'security_in',transfer_in:'security_in',rights_issue_expired:'security_out',transfer_out:'non_cash',split:'non_cash',reverse_split:'non_cash',merger_exchange:'non_cash',code_change:'non_cash',reversal:'non_cash'};
      const direction=String(value.direction),eventType=String(value.eventType),gross=Number(value.grossAmount),fees=Number(value.feeAmount),taxes=Number(value.taxAmount),net=Number(value.netCashAmount);
      const directionValid=eventType==='cash_adjustment'?(direction==='cash_in'||direction==='cash_out'):directionByType[eventType]===direction;
      const expectedNet=direction==='cash_out'?-(gross+fees+taxes):direction==='cash_in'?gross-fees-taxes:0;
      const chronological=date(value.executedAt)
        && (value.orderAt===undefined||Date.parse(String(value.orderAt))<=Date.parse(String(value.executedAt)))
        && (value.settlementAt===undefined||Date.parse(String(value.executedAt))<=Date.parse(String(value.settlementAt)))
        && (value.entitlementAt===undefined||value.recordAt===undefined||Date.parse(String(value.entitlementAt))<=Date.parse(String(value.recordAt)))
        && (value.entitlementAt===undefined||value.paymentAt===undefined||Date.parse(String(value.entitlementAt))<=Date.parse(String(value.paymentAt)))
        && (value.recordAt===undefined||value.paymentAt===undefined||Date.parse(String(value.recordAt))<=Date.parse(String(value.paymentAt)));
      const quantityValid=!['buy','sell','rights_issue_used','rights_issue_sold','rights_issue_expired','bonus_shares','split','reverse_split','transfer_in'].includes(eventType)||(boundedString(value.instrumentId,160)&&finite(value.quantity,0.00000001));
      const transferValid=eventType==='transfer_out'
        ? boundedString(value.instrumentId,160)&&boundedString(value.transferCounterpartyInstrumentId,160)&&value.transferCounterpartyInstrumentId!==value.instrumentId&&value.quantity===undefined&&finite(value.grossAmount,0.00000001)
        : value.transferCounterpartyInstrumentId===undefined&&(eventType!=='transfer_in'||boundedString(value.sourceDocumentReference,240));
      const ratioValid=!['split','reverse_split','merger_exchange'].includes(eventType)||(finite(value.ratioNumerator,0.00000001)&&finite(value.ratioDenominator,0.00000001));
      const tradeGrossValid=!trade||typeof value.quantity!=='number'||typeof value.unitPrice!=='number'||Math.abs(gross-value.quantity*value.unitPrice)<=0.01;
      const valid=quantityValid&&transferValid&&ratioValid&&tradeGrossValid&&boundedString(value.portfolioId,160)&&eventTypes.has(eventType)&&directions.has(direction)&&directionValid&&Math.abs(net-expectedNet)<=0.000001&&typeof value.currency==='string'&&/^[A-Za-z]{3}$/u.test(value.currency)&&chronological&&optionalDate(value.orderAt)&&optionalDate(value.settlementAt)&&optionalDate(value.entitlementAt)&&optionalDate(value.recordAt)&&optionalDate(value.paymentAt)&&finite(value.grossAmount,0)&&finite(value.feeAmount,0)&&finite(value.taxAmount,0)&&finite(value.netCashAmount)&&boundedString(value.sourceLabel,180)&&optionalIdentifier(value.instrumentId)&&optionalFinite(value.quantity,0.00000001)&&optionalFinite(value.unitPrice,0)&&optionalFinite(value.fxRate,0.00000001,1_000_000_000)&&optionalInteger(value.partialFillSequence,1,1_000_000)&&optionalFinite(value.ratioNumerator,0.00000001)&&optionalFinite(value.ratioDenominator,0.00000001)&&optionalIdentifier(value.cashCarryoverInstrumentId)&&optionalIdentifier(value.transferCounterpartyInstrumentId)&&optionalBoundedString(value.broker,160)&&optionalBoundedString(value.accountReference,160)&&optionalBoundedString(value.orderReference,160)&&optionalBoundedString(value.executionReference,160)&&optionalBoundedString(value.lotReference,160)&&(value.costLayerMethod===undefined||costLayerMethods.has(String(value.costLayerMethod)))&&optionalBoundedString(value.corporateActionReference,160)&&optionalIdentifier(value.reversalOfEventId)&&optionalBoundedString(value.correctionReason,500)&&optionalBoundedString(value.sourceDocumentReference,240)&&optionalBoundedString(value.notes,1000)&&(!trade||(boundedString(value.instrumentId,160)&&date(value.orderAt)&&date(value.settlementAt)&&finite(value.quantity,0.00000001)&&finite(value.unitPrice,0)))&&(!income||(boundedString(value.instrumentId,160)&&date(value.recordAt)&&date(value.paymentAt)&&value.cashCarryoverInstrumentId===value.instrumentId))&&(value.cashCarryoverInstrumentId===undefined||value.cashCarryoverInstrumentId===value.instrumentId)&&(!corporateActions.has(eventType)||(boundedString(value.instrumentId,160)&&boundedString(value.corporateActionReference,160)))&&(reversal?(boundedString(value.reversalOfEventId,160)&&boundedString(value.correctionReason,500)&&String(value.correctionReason).trim().length>=3):(value.reversalOfEventId===undefined&&value.correctionReason===undefined));
      return valid?accepted():rejected('LONG_TERM_PORTFOLIO_LEDGER_INVALID','$[0]');
    }
    case 'price_observation':return boundedString(value.instrumentId,160)&&date(value.observedAt)&&finite(value.unitPrice,0.00000001)&&typeof value.currency==='string'&&/^[A-Za-z]{3}$/u.test(value.currency)&&boundedString(value.sourceLabel,180)?accepted():rejected('LONG_TERM_PORTFOLIO_PRICE_INVALID','$[0]');
    default:return rejected('LONG_TERM_PORTFOLIO_ARGUMENT_INVALID','$[0]');
  }
};

const financeImportCommitInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => exactObject(
  args,
  ['previewId','ownerPersonId','privacy','mapping','defaultCurrency','incomeCategoryId','expenseCategoryId','duplicateStrategy'],
  (value) => {
    if (!isObject(value.mapping) || !hasOnlyKeys(value.mapping, [
      'dateColumn','descriptionColumn','amountColumn','debitColumn','creditColumn',
      'directionColumn','currencyColumn','externalIdColumn','amountMode'
    ])) return false;
    const optionalColumn = (candidate: unknown): boolean => optionalBoundedString(candidate, 120);
    return boundedString(value.previewId, 160)
      && boundedString(value.ownerPersonId, 128)
      && recordPrivacyValues.has(String(value.privacy))
      && boundedString(value.mapping.dateColumn, 120)
      && optionalColumn(value.mapping.descriptionColumn)
      && optionalColumn(value.mapping.amountColumn)
      && optionalColumn(value.mapping.debitColumn)
      && optionalColumn(value.mapping.creditColumn)
      && optionalColumn(value.mapping.directionColumn)
      && optionalColumn(value.mapping.currencyColumn)
      && optionalColumn(value.mapping.externalIdColumn)
      && ['signed','absolute_with_direction','debit_credit_columns'].includes(String(value.mapping.amountMode))
      && typeof value.defaultCurrency === 'string'
      && /^[A-Z]{3}$/u.test(value.defaultCurrency)
      && optionalBoundedString(value.incomeCategoryId, 160)
      && optionalBoundedString(value.expenseCategoryId, 160)
      && ['skip','reject'].includes(String(value.duplicateStrategy));
  }
);

const financeRecordInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (args.length !== 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = args[0];
  if (!isObject(value)) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  const secretRejection = containsProhibitedBankingSecret(value, ['title', 'notes', 'symbol']);
  if (secretRejection) return secretRejection;
  if (!hasOnlyKeys(value, FINANCE_RECORD_INPUT_KEYS)) return rejected('UNKNOWN_OBJECT_FIELD', '$[0]');
  return boundedString(value.ownerPersonId, 128)
    && boundedString(value.title, 240)
    && financeRecordKinds.has(String(value.kind))
    && typeof value.amount === 'number' && Number.isFinite(value.amount) && value.amount >= 0
    && typeof value.currency === 'string' && value.currency.length <= 16
    && recordPrivacyValues.has(String(value.privacy))
    && optionalBoundedString(value.notes, 4_000)
    && boundedString(value.occurredAt, 64)
    && optionalBoundedString(value.dueAt, 64)
    && (value.remainingPrincipal === undefined || (typeof value.remainingPrincipal === 'number' && Number.isFinite(value.remainingPrincipal) && value.remainingPrincipal >= 0))
    && optionalBoundedString(value.symbol, 32)
    ? accepted()
    : rejected('FINANCE_RECORD_ARGUMENT_INVALID', '$[0]');
};

const financeValuationInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (args.length !== 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = args[0];
  if (!isObject(value)) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  const secretRejection = containsProhibitedBankingSecret(value, ['provider']);
  if (secretRejection) return secretRejection;
  if (!hasOnlyKeys(value, FINANCE_VALUATION_INPUT_KEYS)) return rejected('UNKNOWN_OBJECT_FIELD', '$[0]');
  return boundedString(value.financeRecordId, 128)
    && boundedString(value.valueDate, 64)
    && typeof value.unitPrice === 'number' && Number.isFinite(value.unitPrice) && value.unitPrice >= 0
    && typeof value.quantity === 'number' && Number.isFinite(value.quantity) && value.quantity >= 0
    && optionalBoundedString(value.provider, 240)
    ? accepted()
    : rejected('FINANCE_VALUATION_ARGUMENT_INVALID', '$[0]');
};

const standardAiConsentInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => exactObject(
  args,
  ['purpose', 'resourceType', 'resourceId', 'status', 'startsAt', 'endsAt'],
  (value) => aiConsentPurposes.has(String(value.purpose))
    && aiConsentResourceTypes.has(String(value.resourceType))
    && boundedString(value.resourceId, 128)
    && (value.status === 'granted' || value.status === 'revoked')
    && optionalBoundedString(value.startsAt, 64)
    && optionalBoundedString(value.endsAt, 64)
);

const standardAiPreviewPurpose = (args: readonly unknown[]): IpcIntegrationPolicyDecision =>
  args.length === 1 && aiConsentPurposes.has(String(args[0]))
    ? accepted()
    : rejected('AI_CONSENT_PURPOSE_INVALID', '$[0]');

const sensitiveConsentInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => exactObject(
  args,
  ['category', 'purpose', 'status', 'durationMinutes', 'explicitConsent'],
  (value) => sensitiveCategories.has(String(value.category))
    && sensitivePurposes.has(String(value.purpose))
    && (value.status === 'granted' || value.status === 'revoked')
    && typeof value.explicitConsent === 'boolean'
    && optionalInteger(value.durationMinutes, 15, 43_200)
    && (value.status !== 'granted' || (value.explicitConsent === true && typeof value.durationMinutes === 'number'))
);

const sensitiveExportPreviewInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => exactObject(
  args,
  ['categories', 'destinationLabel', 'businessPurpose'],
  (value) => Array.isArray(value.categories)
    && value.categories.length >= 1
    && value.categories.length <= 4
    && value.categories.every((category) => sensitiveCategories.has(String(category)))
    && new Set(value.categories).size === value.categories.length
    && boundedString(value.destinationLabel, 100)
    && boundedString(value.businessPurpose, 240)
);

const liveLocationConsentInput = (args:readonly unknown[]):IpcIntegrationPolicyDecision => exactObject(
  args,
  ['status','durationMinutes','explicitConsent'],
  (value) => (value.status === 'granted' || value.status === 'revoked')
    && value.explicitConsent === true
    && optionalInteger(value.durationMinutes,15,43_200)
    && (value.status !== 'granted' || typeof value.durationMinutes === 'number')
);

const lostDeviceShutdownInput = (args:readonly unknown[]):IpcIntegrationPolicyDecision => exactObject(
  args,
  ['trustedDeviceId','password','code','confirmation'],
  (value) => boundedString(value.trustedDeviceId,128)
    && boundedString(value.password,1024)
    && optionalBoundedString(value.code,256)
    && value.confirmation === 'KAYIP CİHAZ YETKİLERİNİ KAPAT'
);

const optionalWindowsHelloFallback = (value: unknown): boolean => {
  if (value === undefined) return true;
  if (!isObject(value) || !hasOnlyKeys(value, ['password', 'secondFactorCode'])) return false;
  return boundedString(value.password, 1024)
    && optionalBoundedString(value.secondFactorCode, 256);
};

export const evaluateIpcIntegrationPolicy = (channel: string, args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  switch (channel) {
    case 'life:getManagedWorkspace':
      return zeroArguments(args);
    case 'life:recordManagedItem':
      return managedLifeInput(args);
    case 'life:exportEmergencyCard':
      return emergencyCardExportInput(args);
    case 'finance:list':
    case 'finance:listValuations':
    case 'finance:listBankInstitutions':
    case 'finance:listBankAccounts':
    case 'finance:listPaymentCards':
    case 'finance:listLoanAccounts':
    case 'finance:getPlanningWorkspace':
    case 'finance:getLongTermPortfolioWorkspace':
    case 'finance:selectImportFile':
    case 'finance:previewOpenBankingSandbox':
      return zeroArguments(args);
    case 'finance:create':
      return financeRecordInput(args);
    case 'finance:createValuation':
      return financeValuationInput(args);
    case 'finance:validateIban':
      return ibanValidationInput(args);
    case 'finance:createBankAccount':
      return bankAccountInput(args);
    case 'finance:createPaymentCard':
      return paymentCardInput(args);
    case 'finance:createLoanAccount':
      return loanAccountInput(args);
    case 'finance:recordLoanPayment':
      return loanPaymentInput(args);
    case 'finance:recordPlanningItem':
      return financePlanningInput(args);
    case 'finance:recordLongTermPortfolioItem':
      return longTermPortfolioInput(args);
    case 'finance:commitImportPreview':
      return financeImportCommitInput(args);
    case 'ai:listConsents':
      return zeroArguments(args);
    case 'ai:upsertConsent':
      return standardAiConsentInput(args);
    case 'ai:previewAccess':
      return standardAiPreviewPurpose(args);
    case 'ai:listSensitiveProfiles':
      return zeroArguments(args);
    case 'ai:upsertSensitiveConsent':
      return sensitiveConsentInput(args);
    case 'ai:previewSensitiveExport':
      return sensitiveExportPreviewInput(args);
    case 'privacyControl:getCenter':
      return zeroArguments(args);
    case 'privacyControl:setLiveLocationConsent':
      return liveLocationConsentInput(args);
    case 'privacyControl:shutdownLostDevice':
      return lostDeviceShutdownInput(args);
    case 'auth:getSessionLockState':
    case 'auth:recordSessionActivity':
    case 'auth:lockSession':
    case 'auth:getWindowsHelloState':
      return zeroArguments(args);
    case 'auth:unlockSession':
      return exactObject(args, ['password', 'secondFactorCode'], (value) =>
        boundedString(value.password, 1024)
        && optionalBoundedString(value.secondFactorCode, 256));
    case 'auth:enrollWindowsHello':
      return exactObject(args, ['password', 'secondFactorCode', 'displayName'], (value) =>
        boundedString(value.password, 1024)
        && optionalBoundedString(value.secondFactorCode, 256)
        && optionalBoundedString(value.displayName, 120));
    case 'auth:loginWithWindowsHello':
      return exactObject(args, ['accountId'], (value) =>
        value.accountId === undefined || boundedString(value.accountId, 128));
    case 'auth:reauthenticateWithWindowsHello':
      return exactObject(args, ['fallback'], (value) => optionalWindowsHelloFallback(value.fallback));
    case 'system:getCoreServiceHealth':
    case 'system:getCoreServiceApiBoundary':
    case 'system:getNetworkEgressBoundary':
    case 'system:getDerivedDataPolicyBoundary':
    case 'system:getSensitiveLoggingBoundary':
    case 'system:getPolicyDecisionAuditBoundary':
    case 'system:getSourceDeletionPropagationBoundary':
    case 'system:getPolicyConformanceSuiteBoundary':
    case 'system:getPlatformPolicyAstGateBoundary':
    case 'system:getPlatformCapabilityManifestGateBoundary':
    case 'system:getApplicationSecurityProfileGateBoundary':
    case 'system:getPolicyServiceAvailabilityBoundary':
    case 'system:getProductSurfaceGovernance':
    case 'system:getDesktopSecurityPosture':
    case 'system:getIpcAdaptiveBudgetMaintenanceAuthority':
    case 'system:getIpcPerformanceTelemetry':
      return zeroArguments(args);
    case 'system:beginIpcAdaptiveBudgetMaintenanceSession':
      return args.length === 3
        && (args[0] === 'reset' || args[0] === 'diagnostics-export')
        && boundedString(args[1], 64)
        && isObject(args[2])
        && Object.keys(args[2]).every((key) => key === 'password' || key === 'code')
        && boundedString(args[2].password, 1024)
        && optionalBoundedString(args[2].code, 16)
        ? accepted()
        : rejected('ARGUMENTS_INVALID', '$');
    case 'system:resetIpcAdaptiveBudget':
    case 'system:exportIpcAdaptiveBudgetDiagnostics':
      return args.length === 1 && isObject(args[0])
        && typeof args[0].sessionId === 'string'
        && typeof args[0].rendererSessionId === 'string'
        && (args[0].operation === 'reset' || args[0].operation === 'diagnostics-export')
        ? accepted()
        : rejected('ARGUMENTS_INVALID', '$');
    case 'dataLifecycle:listRevocationSyncStates':
    case 'familyData:previewImport':
      return zeroArguments(args);
    case 'dataLifecycle:runRevocationSync':
      return optionalIdentifier(args);
    case 'dataLifecycle:getPendingRevocationSyncList':
      return args.length === 1 && boundedString(args[0], 128) ? accepted() : rejected('IDENTIFIER_INVALID', '$[0]');
    case 'dataLifecycle:applyPendingRevocationSyncList':
      return exactObject(args, ['endpointId', 'pendingListId', 'confirmation', 'password', 'code'], (value) =>
        boundedString(value.endpointId, 128) && boundedString(value.pendingListId, 128) && boundedString(value.confirmation, 512) && boundedString(value.password, 1024) && optionalBoundedString(value.code, 256));
    case 'dataLifecycle:upsertExternalBackupRevocationEndpoint':
      return exactObject(args, ['issuerId', 'sourceUrl', 'primarySpkiSha256', 'secondarySpkiSha256', 'secondaryValidFrom', 'primaryValidUntil', 'enabled', 'confirmation', 'password', 'code'], (value) =>
        boundedString(value.issuerId, 128) && boundedString(value.sourceUrl, 2_048) && boundedString(value.primarySpkiSha256, 256) && optionalBoundedString(value.secondarySpkiSha256, 256) && optionalBoundedString(value.secondaryValidFrom, 64) && optionalBoundedString(value.primaryValidUntil, 64) && typeof value.enabled === 'boolean' && boundedString(value.confirmation, 512) && boundedString(value.password, 1024) && optionalBoundedString(value.code, 256));
    case 'familyData:applyImport':
      return exactObject(args, ['previewId', 'password', 'code'], (value) => boundedString(value.previewId, 128) && boundedString(value.password, 1024) && optionalBoundedString(value.code, 256));
    case 'familyData:listImports':
      return optionalLimit(args, 200);
    case 'familyData:rollbackImport':
      return exactObject(args, ['batchId', 'password', 'code'], (value) => boundedString(value.batchId, 128) && boundedString(value.password, 1024) && optionalBoundedString(value.code, 256));
    case 'data:getSnapshotSections':
      return exactObject(args, ['sections'], (value) => Array.isArray(value.sections)
        && value.sections.length >= 1
        && value.sections.length <= 2
        && value.sections.every((section) => section === 'graph' || section === 'timeline')
        && new Set(value.sections).size === value.sections.length);
    case 'largeData:tree':
      return pageInput(args, 'tree');
    case 'largeData:timeline':
      return pageInput(args, 'timeline');
    case 'largeData:archive':
      return pageInput(args, 'archive');
    case 'catalog:listPeople':
      return catalogPageInput(args, 'person');
    case 'catalog:listEvents':
      return catalogPageInput(args, 'event');
    case 'catalog:lookup':
      return catalogLookupInput(args);
    default:
      return accepted();
  }
};
