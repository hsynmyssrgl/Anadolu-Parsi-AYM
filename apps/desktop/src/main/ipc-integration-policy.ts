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
import type {
  LocalGovernedOcrCenterView,
  LocalGovernedOcrMutationReceiptView,
  LocalGovernedOcrResultView,
  PolicyServiceAvailabilityBoundaryView
} from '@ppt/domain';

export interface IpcIntegrationPolicyDecision {
  readonly accepted: boolean;
  readonly reason?: string;
  readonly path?: string;
}

export interface LocalGovernedOcrSourceIpcView {
  readonly resourceType: 'archive_item';
  readonly resourceId: string;
  readonly mimeType: string;
  readonly size: number;
}

export interface LocalGovernedOcrJobIpcView {
  readonly id: string;
  readonly revision: number;
  readonly source: LocalGovernedOcrSourceIpcView;
  readonly languageHints: readonly string[];
  readonly status: 'queued' | 'running' | 'cancel_requested' | 'completed' | 'failed' | 'cancelled' | 'deleted';
  readonly runAttempt: number;
  readonly correctionRevision: number;
  readonly resultAvailable: boolean;
  readonly resultCharacterCount: number | null;
  readonly resultPageCount: number | null;
  readonly confidenceBasisPoints: number | null;
  readonly retentionUntil: string | null;
  readonly failureCode: 'source_unavailable' | 'consent_unavailable' | 'engine_failed' | 'integrity_mismatch' | null;
  readonly cancellationRequestedAt: string | null;
  readonly completedAt: string | null;
  readonly failedAt: string | null;
  readonly cancelledAt: string | null;
  readonly deletedAt: string | null;
  readonly sourceDeletedAt: string | null;
  readonly deletionPropagation: 'active' | 'locally_deleted';
  readonly processor: 'local_ocr';
  readonly networkUsed: false;
  readonly cloudUsed: false;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LocalGovernedOcrCenterIpcView {
  readonly schemaVersion: 1;
  readonly settings: {
    readonly revision: number;
    readonly enabled: boolean;
    readonly disabledReason: string | null;
    readonly disabledAt: string | null;
    readonly updatedAt: string;
  };
  readonly jobs: readonly LocalGovernedOcrJobIpcView[];
  readonly truth: {
    readonly executionScope: 'bounded_child_process';
    readonly lowPrivilegeSandboxVerified: false;
    readonly sourceContentExposedToRenderer: false;
    readonly plaintextResultPersistedInRepository: false;
    readonly networkUsed: false;
    readonly cloudUsed: false;
    readonly providerDeliveryGuaranteed: false;
    readonly explicitSensitiveProcessingConsentRequired: true;
    readonly derivedPolicyBindingRequired: true;
    readonly sourceDeletionPropagatesToDerivedResult: true;
    readonly sourceDeletionAutoResumeGuaranteed: true;
    readonly authorizationRevocationPropagatesToSealedResult: true;
    readonly derivedDeletionDeletesSource: false;
  };
  readonly generatedAt: string;
}

export interface LocalGovernedOcrResultIpcView {
  readonly jobId: string;
  readonly revision: number;
  readonly text: string;
  readonly corrected: boolean;
  readonly payloadSource: 'sealed_local_result';
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export interface LocalGovernedOcrMutationIpcView {
  readonly previousRevision: number;
  readonly revision: number;
  readonly occurredAt: string;
  readonly replayed: boolean;
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export type LocalGovernedOcrRendererMutationKind = Exclude<
  LocalGovernedOcrMutationReceiptView['mutationKind'],
  'source_delete_propagate'
>;

export interface LocalGovernedOcrResultReadIpcInput {
  readonly jobId: string;
}

export interface LocalGovernedOcrCreateIpcInput {
  readonly expectedRevision: number;
  readonly clientOperationId: string;
  readonly sourceResourceId: string;
  readonly languageHints: readonly string[];
}

export interface LocalGovernedOcrJobMutationIpcInput {
  readonly expectedRevision: number;
  readonly clientOperationId: string;
  readonly jobId: string;
}

export interface LocalGovernedOcrCorrectIpcInput extends LocalGovernedOcrJobMutationIpcInput {
  readonly correctedText: string;
}

export interface LocalGovernedOcrRerunIpcInput extends LocalGovernedOcrJobMutationIpcInput {
  readonly languageHints?: readonly string[];
}

export interface LocalGovernedOcrDeleteIpcInput extends LocalGovernedOcrJobMutationIpcInput {
  readonly reason: string;
}

export interface LocalGovernedOcrSetEnabledIpcInput {
  readonly expectedRevision: number;
  readonly clientOperationId: string;
  readonly enabled: boolean;
  readonly reason: string;
}

export const projectLocalGovernedOcrCenterIpcView = (
  center: LocalGovernedOcrCenterView
): LocalGovernedOcrCenterIpcView => {
  const exactOwnerKey = (candidate: LocalGovernedOcrCenterView['key']): boolean =>
    candidate.familyId === center.key.familyId
    && candidate.accountId === center.key.accountId
    && candidate.ownerPersonId === center.key.ownerPersonId;
  if (!exactOwnerKey(center.settings.key) || center.jobs.some((job) => !exactOwnerKey(job.key))) {
    throw new Error('Local governed OCR center owner binding is incoherent.');
  }
  return {
    schemaVersion: 1,
    settings: {
      revision: center.settings.revision,
      enabled: center.settings.enabled,
      disabledReason: center.settings.disabledReason ?? null,
      disabledAt: center.settings.disabledAt ?? null,
      updatedAt: center.settings.updatedAt
    },
    jobs: center.jobs.map((job) => ({
      id: job.id,
      revision: job.revision,
      source: {
        resourceType: job.source.resourceType,
        resourceId: job.source.resourceId,
        mimeType: job.source.mimeType,
        size: job.source.sizeBytes
      },
      languageHints: [...job.languageHints],
      status: job.status,
      runAttempt: job.runAttempt,
      correctionRevision: job.correctionRevision,
      resultAvailable: job.resultAvailable,
      resultCharacterCount: job.resultCharacterCount ?? null,
      resultPageCount: job.resultPageCount ?? null,
      confidenceBasisPoints: job.confidenceBasisPoints ?? null,
      retentionUntil: job.retentionUntil ?? null,
      failureCode: job.failureCode ?? null,
      cancellationRequestedAt: job.cancellationRequestedAt ?? null,
      completedAt: job.completedAt ?? null,
      failedAt: job.failedAt ?? null,
      cancelledAt: job.cancelledAt ?? null,
      deletedAt: job.deletedAt ?? null,
      sourceDeletedAt: job.sourceDeletedAt ?? null,
      deletionPropagation: job.deletionPropagation,
      processor: job.processor,
      networkUsed: job.networkUsed,
      cloudUsed: job.cloudUsed,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    })),
    truth: {
      executionScope: center.truth.executionScope,
      lowPrivilegeSandboxVerified: center.truth.lowPrivilegeSandboxVerified,
      sourceContentExposedToRenderer: center.truth.sourceBytesExposedToRenderer,
      plaintextResultPersistedInRepository: center.truth.plaintextResultPersistedInRepository,
      networkUsed: center.truth.networkUsed,
      cloudUsed: center.truth.cloudUsed,
      providerDeliveryGuaranteed: center.truth.providerDeliveryGuaranteed,
      explicitSensitiveProcessingConsentRequired: center.truth.explicitSensitiveProcessingConsentRequired,
      derivedPolicyBindingRequired: center.truth.derivedPolicyBindingRequired,
      sourceDeletionPropagatesToDerivedResult: center.truth.sourceDeletionPropagatesToDerivedResult,
      sourceDeletionAutoResumeGuaranteed: center.truth.sourceDeletionAutoResumeGuaranteed,
      authorizationRevocationPropagatesToSealedResult:
        center.truth.authorizationRevocationPropagatesToSealedResult,
      derivedDeletionDeletesSource: center.truth.derivedDeletionDeletesSource
    },
    generatedAt: center.generatedAt
  };
};

export const projectLocalGovernedOcrResultIpcView = (
  result: LocalGovernedOcrResultView
): LocalGovernedOcrResultIpcView => ({
  jobId: result.jobId,
  revision: result.revision,
  text: result.text,
  corrected: result.corrected,
  payloadSource: result.payloadSource,
  networkUsed: result.networkUsed,
  cloudUsed: result.cloudUsed
});

export const projectLocalGovernedOcrMutationIpcView = (
  result: LocalGovernedOcrMutationReceiptView,
  expectedMutationKind: LocalGovernedOcrRendererMutationKind
): LocalGovernedOcrMutationIpcView => {
  if (result.mutationKind === 'source_delete_propagate' || result.sourceResourceDeleted) {
    throw new Error('Main-only OCR source-deletion receipt cannot cross the renderer bridge.');
  }
  const expectedResourceType = expectedMutationKind === 'processing_enable' || expectedMutationKind === 'processing_disable'
    ? 'local_ocr_settings'
    : 'local_ocr_job';
  if (result.mutationKind !== expectedMutationKind || result.resourceType !== expectedResourceType) {
    throw new Error('Local governed OCR mutation receipt does not match its main IPC operation.');
  }
  return {
    previousRevision: result.previousRevision,
    revision: result.revision,
    occurredAt: result.occurredAt,
    replayed: result.replayed,
    networkUsed: result.networkUsed,
    cloudUsed: result.cloudUsed
  };
};

const accepted = (): IpcIntegrationPolicyDecision => ({ accepted: true });
const rejected = (reason: string, path = '$'): IpcIntegrationPolicyDecision => ({ accepted: false, reason, path });
const isObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
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

const accessibilityPreferencesInput = (args:readonly unknown[]):IpcIntegrationPolicyDecision => {
  if(args.length!==1)return rejected('ARGUMENT_COUNT_MISMATCH');
  const value=args[0];
  if(!isObject(value))return rejected('OBJECT_ARGUMENT_REQUIRED','$[0]');
  const secretRejection=containsNestedProhibitedBankingSecret(value);
  if(secretRejection)return secretRejection;
  const keys=['expectedRevision','clientOperationId','textScale','textScalePercent','highContrast','reduceMotion','theme','density','readingMode','audienceProfile','captionsEnabled','audioMuted'];
  if(!hasOnlyKeys(value,keys))return rejected('UNKNOWN_OBJECT_FIELD','$[0]');
  const valid=Number.isSafeInteger(value.expectedRevision)&&Number(value.expectedRevision)>=0&&Number(value.expectedRevision)<2_147_483_647
    &&typeof value.clientOperationId==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(value.clientOperationId)
    &&['standard','large','extra-large'].includes(String(value.textScale))
    &&Number.isInteger(value.textScalePercent)&&Number(value.textScalePercent)>=100&&Number(value.textScalePercent)<=225
    &&typeof value.highContrast==='boolean'&&typeof value.reduceMotion==='boolean'
    &&['system','light','dark'].includes(String(value.theme))
    &&['comfortable','standard','compact'].includes(String(value.density))
    &&['standard','easy-read'].includes(String(value.readingMode))
    &&['youth','standard','senior','low-vision','caregiver'].includes(String(value.audienceProfile))
    &&typeof value.captionsEnabled==='boolean'&&typeof value.audioMuted==='boolean';
  return valid?accepted():rejected('ACCESSIBILITY_PREFERENCES_ARGUMENT_INVALID','$[0]');
};

const formDraftKeyInput = (args:readonly unknown[]):IpcIntegrationPolicyDecision =>
  args.length===1&&typeof args[0]==='string'&&/^[A-Za-z0-9._:-]{3,128}$/u.test(args[0])
    ?accepted():rejected('FORM_DRAFT_KEY_INVALID','$[0]');

const formDraftPayloadValue = (value:unknown, depth=0):boolean => {
  if(depth>32)return false;
  if(value===null||typeof value==='string'||typeof value==='boolean')return true;
  if(typeof value==='number')return Number.isFinite(value);
  if(Array.isArray(value))return value.length<=2048&&value.every(item=>formDraftPayloadValue(item,depth+1));
  if(!isObject(value))return false;
  return Object.keys(value).length<=2048&&Object.values(value).every(item=>formDraftPayloadValue(item,depth+1));
};

const formDraftSaveInput = (args:readonly unknown[]):IpcIntegrationPolicyDecision => {
  if(args.length!==1||!isObject(args[0]))return rejected('FORM_DRAFT_ARGUMENT_INVALID','$[0]');
  const value=args[0];const secret=containsNestedProhibitedBankingSecret(value);if(secret)return secret;
  if(!hasOnlyKeys(value,['formKey','expectedRevision','clientOperationId','payload'])
    ||!boundedString(value.formKey,128)||!/^[A-Za-z0-9._:-]{3,128}$/u.test(String(value.formKey))
    ||!optionalInteger(value.expectedRevision,0,2_147_483_646)
    ||!boundedString(value.clientOperationId,128)||!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(String(value.clientOperationId))
    ||!isObject(value.payload)||!formDraftPayloadValue(value.payload))return rejected('FORM_DRAFT_ARGUMENT_INVALID','$[0]');
  try{if(new TextEncoder().encode(JSON.stringify(value.payload)).byteLength>65_536)return rejected('FORM_DRAFT_PAYLOAD_TOO_LARGE','$[0].payload');}
  catch{return rejected('FORM_DRAFT_ARGUMENT_INVALID','$[0].payload');}
  return accepted();
};

const formDraftUndoInput = (args:readonly unknown[]):IpcIntegrationPolicyDecision => exactObject(
  args,['formKey','expectedRevision','clientOperationId'],
  value=>boundedString(value.formKey,128)&&/^[A-Za-z0-9._:-]{3,128}$/u.test(String(value.formKey))
    &&optionalInteger(value.expectedRevision,2,2_147_483_646)
    &&boundedString(value.clientOperationId,128)&&/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(String(value.clientOperationId))
);

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

const identityAccessChannels = new Set([
  'identityAccess:getCenter',
  'identityAccess:issueOperationToken',
  'identityAccess:beginPasskeyRegistration',
  'identityAccess:beginPasskeyAuthentication',
  'identityAccess:completePasskeyRegistration',
  'identityAccess:authenticateWithPasskey',
  'identityAccess:revokePasskey',
  'identityAccess:recoverLostPasskey',
  'identityAccess:beginFederatedIdentityLink',
  'identityAccess:completeFederatedIdentityLink',
  'identityAccess:unlinkFederatedIdentity',
  'identityAccess:issueTemporaryCredential',
  'identityAccess:revokeTemporaryCredential',
  'identityAccess:verifyTemporaryCredential',
  'identityAccess:createCompanionSnapshot'
]);
const identityAccessProviders = new Set(['apple', 'google', 'microsoft']);
const identityAccessOperationKinds = new Set([
  'passkey_register', 'passkey_authenticate', 'passkey_revoke', 'passkey_recover_lost',
  'federated_link', 'federated_unlink', 'temporary_credential_issue', 'temporary_credential_revoke',
  'companion_snapshot_create'
]);
const identityAccessTemporaryKinds = new Set([
  'school_pickup', 'temporary_caregiver', 'pet_caregiver', 'emergency_contact_health',
  'event_invitation', 'temporary_home_access'
]);
const identityAccessTemporaryPurposes = new Map<string, string>([
  ['school_pickup', 'school_pickup_authorization'],
  ['temporary_caregiver', 'temporary_care_authorization'],
  ['pet_caregiver', 'pet_care_authorization'],
  ['emergency_contact_health', 'emergency_contact_health_access'],
  ['event_invitation', 'event_invitation_access'],
  ['temporary_home_access', 'temporary_home_access']
]);
const identityAccessClaimKeys = new Set([
  'subject_display_name', 'authorized_person_display_name', 'caregiver_display_name', 'pet_display_name',
  'school_name', 'emergency_contact_name', 'emergency_contact_phone', 'allergy_summary',
  'critical_medication_summary', 'event_title', 'valid_location_label', 'contact_phone'
]);
const identityAccessDisclosureRules = new Map<string, {
  readonly required: ReadonlySet<string>;
  readonly allowed: ReadonlySet<string>;
}>([
  ['school_pickup', { required: new Set(['subject_display_name', 'authorized_person_display_name']), allowed: new Set(['subject_display_name', 'authorized_person_display_name', 'school_name', 'contact_phone']) }],
  ['temporary_caregiver', { required: new Set(['subject_display_name', 'caregiver_display_name']), allowed: new Set(['subject_display_name', 'caregiver_display_name', 'contact_phone']) }],
  ['pet_caregiver', { required: new Set(['pet_display_name', 'caregiver_display_name']), allowed: new Set(['pet_display_name', 'caregiver_display_name', 'contact_phone']) }],
  ['emergency_contact_health', { required: new Set(['subject_display_name', 'emergency_contact_name', 'emergency_contact_phone']), allowed: new Set(['subject_display_name', 'emergency_contact_name', 'emergency_contact_phone', 'allergy_summary', 'critical_medication_summary']) }],
  ['event_invitation', { required: new Set(['subject_display_name', 'event_title']), allowed: new Set(['subject_display_name', 'event_title', 'valid_location_label', 'contact_phone']) }],
  ['temporary_home_access', { required: new Set(['subject_display_name', 'valid_location_label']), allowed: new Set(['subject_display_name', 'valid_location_label', 'contact_phone']) }]
]);
const identityAccessId = (value: unknown): boolean => typeof value === 'string'
  && value === value.trim() && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u.test(value);
const identityAccessRevision = (value: unknown): boolean => typeof value === 'number'
  && Number.isSafeInteger(value) && value >= 0 && value < 2_147_483_647;
const identityAccessIso = (value: unknown): boolean => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  && new Date(value).toISOString() === value;
const identityAccessBase64Url = (value: unknown, maximum: number): boolean => typeof value === 'string'
  && value.length >= 1 && value.length <= maximum && !value.includes('=') && /^[A-Za-z0-9_-]+$/u.test(value);
const identityAccessQrPayload = (value: unknown): boolean => typeof value === 'string'
  && value.length >= 32 && value.length <= 4_096
  && /^pptvc1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(value);
const identityAccessText = (value: unknown, maximum: number): boolean => typeof value === 'string'
  && value === value.trim() && value.length >= 1 && value.length <= maximum
  && !/[\u0000-\u001f\u007f]/u.test(value);
const identityAccessPathKeys = /^(?:path|filePath|directory|destination|destinationPath|sourcePath|targetPath|absolutePath)$/iu;
const identityAccessCredentialKeys = /^(?:password|passphrase|pin|cvv|cvc|secret|token|accessToken|refreshToken|idToken|authorizationCode|codeVerifier|clientSecret|privateKey|privateKeyBytes|biometric|biometricData)$/iu;
const identityAccessOpaqueKeys = new Set([
  'credentialId', 'clientDataJsonBase64url', 'attestationObjectBase64url', 'authenticatorDataBase64url',
  'signatureBase64url', 'userHandleBase64url', 'challenge', 'allowedCredentialIds', 'qrPayload',
  'encryptedEnvelopeBase64Url', 'authorizationUrl', 'callbackUrl', 'credentialIdSha256', 'publicKeySha256',
  'providerSubjectSha256', 'audienceRefSha256', 'disclosureSha256', 'payloadSha256', 'signatureSha256',
  'issuerPublicKeySha256', 'ciphertextSha256', 'envelopeSha256', 'stateFingerprint'
]);
const identityAccessLocalPath = (value: string): boolean => /^(?:[A-Za-z]:[\\/]|\\\\|file:|\/(?:Users|home|private|var|tmp|etc)\/)/iu.test(value);
const inspectIdentityAccessPayload = (
  value: unknown,
  channel: string,
  path = '$[0]',
  depth = 0,
  fieldName?: string
): IpcIntegrationPolicyDecision | undefined => {
  if (depth > 10) return rejected('IDENTITY_ACCESS_ARGUMENT_NESTING_TOO_DEEP', path);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || value.length > 512) return rejected('IDENTITY_ACCESS_ARRAY_INVALID', path);
    for (let index = 0; index < value.length; index += 1) {
      const decision = inspectIdentityAccessPayload(value[index], channel, `${path}[${index}]`, depth + 1, fieldName);
      if (decision) return decision;
    }
    return undefined;
  }
  if (typeof value === 'string') {
    const maximum = fieldName === 'encryptedEnvelopeBase64Url' ? 11_184_811 : 32_768;
    if (value.length > maximum) return rejected('IDENTITY_ACCESS_STRING_TOO_LARGE', path);
    if (identityAccessLocalPath(value)) return rejected('PATH_VALUE_PROHIBITED', path);
    if (!fieldName || !identityAccessOpaqueKeys.has(fieldName)) {
      if (containsLikelyFullPan(value)) return rejected('BANKING_SECRET_VALUE_PROHIBITED', path);
    }
    return undefined;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return rejected('NON_FINITE_NUMBER_REJECTED', path);
  if (value === null || typeof value !== 'object') return undefined;
  if (!isObject(value)) return rejected('NON_PLAIN_OBJECT_REJECTED', path);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === 'symbol')) return rejected('SYMBOL_FIELD_PROHIBITED', path);
  const keys = ownKeys as string[];
  if (keys.length > 64) return rejected('IDENTITY_ACCESS_OBJECT_TOO_LARGE', path);
  for (const key of keys) {
    const childPath = `${path}.${key}`;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || descriptor.get || descriptor.set || !('value' in descriptor)) return rejected('ACCESSOR_FIELD_PROHIBITED', childPath);
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') return rejected('PROTOTYPE_FIELD_PROHIBITED', childPath);
    if (identityAccessPathKeys.test(key)) return rejected('PATH_FIELD_PROHIBITED', childPath);
    const fallbackPassword = channel === 'identityAccess:recoverLostPasskey' && path === '$[0].fallback' && key === 'password';
    if (identityAccessCredentialKeys.test(key) && !fallbackPassword) return rejected('CREDENTIAL_FIELD_PROHIBITED', childPath);
    if (isProhibitedBankingSecretField(key) && !fallbackPassword) return rejected('BANKING_SECRET_FIELD_PROHIBITED', childPath);
    const decision = inspectIdentityAccessPayload(descriptor.value, channel, childPath, depth + 1, key);
    if (decision) return decision;
  }
  return undefined;
};
const identityAccessFallback = (value: unknown): boolean => value === undefined || (
  isObject(value) && Object.keys(value).length >= 1 && Object.keys(value).length <= 2
  && hasOnlyKeys(value, ['password', 'secondFactorCode']) && boundedString(value.password, 1_024)
  && optionalBoundedString(value.secondFactorCode, 256)
);
const identityAccessOperation = (value: Record<string, unknown>): boolean =>
  identityAccessId(value.clientOperationId) && identityAccessRevision(value.expectedRevision);
const identityAccessRegistrationResponse = (value: unknown): boolean => {
  if (!isObject(value) || !hasOnlyKeys(value, [
    'credentialId', 'clientDataJsonBase64url', 'attestationObjectBase64url', 'transports'
  ]) || Object.keys(value).length !== 4 || !identityAccessBase64Url(value.credentialId, 1_366)
    || !identityAccessBase64Url(value.clientDataJsonBase64url, 5_462)
    || !identityAccessBase64Url(value.attestationObjectBase64url, 21_846)
    || !Array.isArray(value.transports) || value.transports.length > 5
    || value.transports.some((item) => !['internal', 'usb', 'nfc', 'ble', 'hybrid'].includes(String(item)))) return false;
  return new Set(value.transports).size === value.transports.length;
};
const identityAccessAuthenticationResponse = (value: unknown): boolean => {
  if (!isObject(value) || !hasOnlyKeys(value, [
    'credentialId', 'clientDataJsonBase64url', 'authenticatorDataBase64url', 'signatureBase64url', 'userHandleBase64url'
  ])) return false;
  const expected = value.userHandleBase64url === undefined ? 4 : 5;
  return Object.keys(value).length === expected
    && identityAccessBase64Url(value.credentialId, 1_366)
    && identityAccessBase64Url(value.clientDataJsonBase64url, 5_462)
    && identityAccessBase64Url(value.authenticatorDataBase64url, 5_462)
    && identityAccessBase64Url(value.signatureBase64url, 2_731)
    && (value.userHandleBase64url === undefined || identityAccessBase64Url(value.userHandleBase64url, 342));
};
const identityAccessInput = (channel: string, args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (channel === 'identityAccess:getCenter') return zeroArguments(args);
  if (args.length !== 1 || !isObject(args[0])) return rejected('IDENTITY_ACCESS_OBJECT_REQUIRED', '$[0]');
  const value = args[0];
  const inspection = inspectIdentityAccessPayload(value, channel);
  if (inspection) return inspection;
  try {
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 65_536) {
      return rejected('IDENTITY_ACCESS_PAYLOAD_TOO_LARGE', '$[0]');
    }
  } catch { return rejected('IDENTITY_ACCESS_OBJECT_INVALID', '$[0]'); }
  switch (channel) {
    case 'identityAccess:issueOperationToken':
      return Object.keys(value).length === 1 && hasOnlyKeys(value, ['operationKind'])
        && identityAccessOperationKinds.has(String(value.operationKind))
        ? accepted() : rejected('IDENTITY_ACCESS_OPERATION_TOKEN_ISSUE_INVALID', '$[0]');
    case 'identityAccess:beginPasskeyRegistration':
    case 'identityAccess:beginPasskeyAuthentication':
      return Object.keys(value).length === 1 && hasOnlyKeys(value, ['clientOperationId']) && identityAccessId(value.clientOperationId)
        ? accepted() : rejected('IDENTITY_ACCESS_PASSKEY_BEGIN_INVALID', '$[0]');
    case 'identityAccess:completePasskeyRegistration':
      return Object.keys(value).length === 6 && hasOnlyKeys(value, [
        'expectedRevision', 'clientOperationId', 'challengeId', 'displayName', 'response', 'confirmation'
      ]) && identityAccessOperation(value) && value.expectedRevision === 0 && identityAccessId(value.challengeId)
        && identityAccessText(value.displayName, 120)
        && value.confirmation === 'PASSKEY KAYDINI TAMAMLA' && identityAccessRegistrationResponse(value.response)
        ? accepted() : rejected('IDENTITY_ACCESS_PASSKEY_REGISTRATION_INVALID', '$[0]');
    case 'identityAccess:authenticateWithPasskey':
      return Object.keys(value).length === 6 && hasOnlyKeys(value, [
        'expectedRevision', 'clientOperationId', 'credentialId', 'challengeId', 'response', 'confirmation'
      ]) && identityAccessOperation(value) && identityAccessId(value.credentialId) && identityAccessId(value.challengeId)
        && value.confirmation === 'PASSKEY ILE DOGRULA'
        && identityAccessAuthenticationResponse(value.response)
        ? accepted() : rejected('IDENTITY_ACCESS_PASSKEY_ASSERTION_INVALID', '$[0]');
    case 'identityAccess:revokePasskey':
      return Object.keys(value).length === 5 && hasOnlyKeys(value, [
        'expectedRevision', 'clientOperationId', 'credentialId', 'reason', 'confirmation'
      ]) && identityAccessOperation(value) && identityAccessId(value.credentialId)
        && (value.reason === 'manual' || value.reason === 'lost') && value.confirmation === 'PASSKEY YETKISINI IPTAL ET'
        ? accepted() : rejected('IDENTITY_ACCESS_PASSKEY_REVOKE_INVALID', '$[0]');
    case 'identityAccess:recoverLostPasskey':
      return Object.keys(value).length >= 4 && Object.keys(value).length <= 5 && hasOnlyKeys(value, [
        'expectedRevision', 'clientOperationId', 'credentialId', 'fallback', 'confirmation'
      ]) && identityAccessOperation(value) && identityAccessId(value.credentialId) && identityAccessFallback(value.fallback)
        && value.confirmation === 'KAYIP PASSKEY KURTARMASINI BASLAT'
        ? accepted() : rejected('IDENTITY_ACCESS_PASSKEY_RECOVERY_INVALID', '$[0]');
    case 'identityAccess:beginFederatedIdentityLink':
      return Object.keys(value).length === 2 && hasOnlyKeys(value, ['clientOperationId', 'provider'])
        && identityAccessId(value.clientOperationId) && identityAccessProviders.has(String(value.provider))
        ? accepted() : rejected('IDENTITY_ACCESS_FEDERATED_BEGIN_INVALID', '$[0]');
    case 'identityAccess:completeFederatedIdentityLink':
      return Object.keys(value).length === 5 && hasOnlyKeys(value, [
        'expectedRevision', 'clientOperationId', 'provider', 'flowId', 'confirmation'
      ]) && identityAccessOperation(value) && value.expectedRevision === 0 && identityAccessProviders.has(String(value.provider))
        && identityAccessId(value.flowId)
        && value.confirmation === 'FEDERATED KIMLIGI BAGLA'
        ? accepted() : rejected('IDENTITY_ACCESS_FEDERATED_COMPLETE_INVALID', '$[0]');
    case 'identityAccess:unlinkFederatedIdentity':
      return Object.keys(value).length === 4 && hasOnlyKeys(value, [
        'expectedRevision', 'clientOperationId', 'linkId', 'confirmation'
      ]) && identityAccessOperation(value) && identityAccessId(value.linkId)
        && value.confirmation === 'FEDERATED KIMLIK BAGINI KALDIR'
        ? accepted() : rejected('IDENTITY_ACCESS_FEDERATED_UNLINK_INVALID', '$[0]');
    case 'identityAccess:issueTemporaryCredential': {
      if (Object.keys(value).length !== 9 || !hasOnlyKeys(value, [
        'expectedRevision', 'clientOperationId', 'kind', 'purpose', 'audienceReference', 'disclosedClaims',
        'notBefore', 'expiresAt', 'confirmation'
      ]) || !identityAccessOperation(value) || value.expectedRevision !== 0
        || !identityAccessTemporaryKinds.has(String(value.kind))
        || identityAccessTemporaryPurposes.get(String(value.kind)) !== value.purpose
        || !identityAccessText(value.audienceReference, 160) || !Array.isArray(value.disclosedClaims)
        || value.disclosedClaims.length < 1 || value.disclosedClaims.length > 8
        || !identityAccessIso(value.notBefore) || !identityAccessIso(value.expiresAt)
        || Date.parse(String(value.expiresAt)) <= Date.parse(String(value.notBefore))
        || Date.parse(String(value.expiresAt)) - Date.parse(String(value.notBefore)) > 2_678_400_000
        || value.confirmation !== 'GECICI YETKI BELGESI OLUSTUR') {
        return rejected('IDENTITY_ACCESS_TEMPORARY_ISSUE_INVALID', '$[0]');
      }
      const claims = value.disclosedClaims;
      const valid = claims.every((item) => isObject(item) && Object.keys(item).length === 2
        && hasOnlyKeys(item, ['key', 'value']) && identityAccessClaimKeys.has(String(item.key))
        && identityAccessText(item.value, 256))
        && new Set(claims.map((item) => isObject(item) ? item.key : undefined)).size === claims.length;
      const rules = identityAccessDisclosureRules.get(String(value.kind));
      const keys = claims.map((item) => isObject(item) ? String(item.key) : '');
      const disclosureValid = rules !== undefined && [...rules.required].every((key) => keys.includes(key))
        && keys.every((key) => rules.allowed.has(key));
      return valid && disclosureValid ? accepted() : rejected('IDENTITY_ACCESS_TEMPORARY_CLAIMS_INVALID', '$[0].disclosedClaims');
    }
    case 'identityAccess:revokeTemporaryCredential':
      return Object.keys(value).length === 5 && hasOnlyKeys(value, [
        'expectedRevision', 'clientOperationId', 'credentialId', 'reason', 'confirmation'
      ]) && identityAccessOperation(value) && identityAccessId(value.credentialId) && identityAccessText(value.reason, 256)
        && value.confirmation === 'GECICI YETKI BELGESINI IPTAL ET'
        ? accepted() : rejected('IDENTITY_ACCESS_TEMPORARY_REVOKE_INVALID', '$[0]');
    case 'identityAccess:verifyTemporaryCredential':
      return Object.keys(value).length === 2 && hasOnlyKeys(value, ['qrPayload', 'expectedAudienceReference'])
        && identityAccessQrPayload(value.qrPayload) && identityAccessText(value.expectedAudienceReference, 160)
        ? accepted() : rejected('IDENTITY_ACCESS_TEMPORARY_VERIFY_INVALID', '$[0]');
    case 'identityAccess:createCompanionSnapshot':
      return Object.keys(value).length >= 4 && Object.keys(value).length <= 5 && hasOnlyKeys(value, [
        'clientOperationId', 'trustedDeviceId', 'requestedMode', 'knownSourceVersion', 'confirmation'
      ]) && identityAccessId(value.clientOperationId) && identityAccessId(value.trustedDeviceId)
        && (value.requestedMode === 'read_only' || value.requestedMode === 'write')
        && (value.knownSourceVersion === undefined || identityAccessRevision(value.knownSourceVersion))
        && value.confirmation === 'SALT OKUNUR ESLIKCI KOPYASI OLUSTUR'
        ? accepted() : rejected('IDENTITY_ACCESS_COMPANION_INVALID', '$[0]');
    default:
      return rejected('UNKNOWN_IPC_CHANNEL', '$');
  }
};

const identityAccessSha256 = (value: unknown): boolean => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
const identityAccessInteger = (value: unknown, minimum = 0, maximum = 2_147_483_646): boolean =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
const identityAccessExact = (
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = []
): value is Record<string, unknown> => isObject(value)
  && required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  && hasOnlyKeys(value, [...required, ...optional]);
const identityAccessKey = (value: unknown): value is Record<string, unknown> => identityAccessExact(value, ['familyId', 'accountId', 'ownerPersonId'])
  && identityAccessId(value.familyId) && identityAccessId(value.accountId) && identityAccessId(value.ownerPersonId);
const identityAccessKeysEqual = (left: unknown, right: unknown): boolean => identityAccessKey(left) && identityAccessKey(right)
  && left.familyId === right.familyId && left.accountId === right.accountId && left.ownerPersonId === right.ownerPersonId;
const identityAccessUniqueStrings = (
  value: unknown,
  minimum: number,
  maximum: number,
  validate: (item: unknown) => boolean
): value is readonly string[] => Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype
  && value.length >= minimum && value.length <= maximum && value.every(validate) && new Set(value).size === value.length;
const identityAccessRelyingPartyId = (value: unknown): boolean => typeof value === 'string'
  && value.length >= 1 && value.length <= 253 && value === value.toLowerCase()
  && /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/u.test(value);
const identityAccessAuthorizationUrl = (value: unknown): boolean => {
  if (typeof value !== 'string' || value.length < 8 || value.length > 8_192) return false;
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  return url.protocol === 'https:' && Boolean(url.host) && !url.username && !url.password && !url.hash
    && url.searchParams.get('response_type') === 'code'
    && identityAccessText(url.searchParams.get('state'), 512)
    && identityAccessText(url.searchParams.get('nonce'), 512)
    && identityAccessBase64Url(url.searchParams.get('code_challenge'), 512)
    && url.searchParams.get('code_challenge_method') === 'S256';
};

const identityAccessMutationByChannel = Object.freeze({
  'identityAccess:completePasskeyRegistration': ['passkey_register', 'passkey_credential'],
  'identityAccess:authenticateWithPasskey': ['passkey_authenticate', 'passkey_credential'],
  'identityAccess:revokePasskey': ['passkey_revoke', 'passkey_credential'],
  'identityAccess:recoverLostPasskey': ['passkey_recover_lost', 'passkey_credential'],
  'identityAccess:completeFederatedIdentityLink': ['federated_link', 'federated_identity_link'],
  'identityAccess:unlinkFederatedIdentity': ['federated_unlink', 'federated_identity_link'],
  'identityAccess:issueTemporaryCredential': ['temporary_credential_issue', 'temporary_verifiable_credential'],
  'identityAccess:revokeTemporaryCredential': ['temporary_credential_revoke', 'temporary_verifiable_credential']
} as const);
const identityAccessMutationReceipt = (value: unknown, channel: keyof typeof identityAccessMutationByChannel): boolean => {
  if (!identityAccessExact(value, [
    'clientOperationId', 'mutationKind', 'resourceType', 'resourceId', 'previousRevision',
    'revision', 'stateFingerprint', 'occurredAt', 'replayed'
  ])) return false;
  const expected = identityAccessMutationByChannel[channel];
  return identityAccessId(value.clientOperationId) && value.mutationKind === expected[0]
    && value.resourceType === expected[1] && identityAccessId(value.resourceId)
    && identityAccessRevision(value.previousRevision) && identityAccessRevision(value.revision)
    && Number(value.revision) === Number(value.previousRevision) + 1
    && identityAccessSha256(value.stateFingerprint) && identityAccessIso(value.occurredAt)
    && typeof value.replayed === 'boolean';
};

const identityAccessOperationTokenResult = (value: unknown): boolean => {
  if (!identityAccessExact(value, ['clientOperationId', 'operationKind', 'issuedAt', 'expiresAt'])) return false;
  if (typeof value.clientOperationId !== 'string'
    || !/^iat1\.[0-9a-z]{1,10}\.[0-9a-z]{1,10}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{86}$/u.test(value.clientOperationId)
    || value.clientOperationId.length > 160 || !identityAccessOperationKinds.has(String(value.operationKind))
    || !identityAccessIso(value.issuedAt) || !identityAccessIso(value.expiresAt)) return false;
  return Date.parse(String(value.expiresAt)) - Date.parse(String(value.issuedAt)) === 86_400_000;
};

const identityAccessPasskey = (value: unknown): boolean => {
  const required = [
    'id', 'key', 'revision', 'displayName', 'credentialIdSha256', 'publicKeySha256', 'relyingPartyId',
    'transports', 'signCount', 'backupEligible', 'backupState', 'trustedDeviceId', 'securityEpoch',
    'status', 'createdAt', 'privateKeyStored', 'biometricDataStored', 'attestationPayloadStored'
  ];
  if (!identityAccessExact(value, required, ['aaguid', 'lastUsedAt', 'revokedAt', 'revocationReason'])) return false;
  const transports = identityAccessUniqueStrings(value.transports, 0, 5, (item) =>
    ['internal', 'usb', 'nfc', 'ble', 'hybrid'].includes(String(item)));
  const statusValid = value.status === 'active'
    ? value.revokedAt === undefined && value.revocationReason === undefined
    : value.status === 'revoked' && identityAccessIso(value.revokedAt)
      && ['manual', 'lost', 'recovery', 'device_revoked', 'security_epoch_changed'].includes(String(value.revocationReason));
  return identityAccessId(value.id) && identityAccessKey(value.key) && identityAccessRevision(value.revision)
    && Number(value.revision) >= 1 && identityAccessText(value.displayName, 120)
    && identityAccessSha256(value.credentialIdSha256) && identityAccessSha256(value.publicKeySha256)
    && identityAccessRelyingPartyId(value.relyingPartyId)
    && (value.aaguid === undefined || identityAccessText(value.aaguid, 64)) && transports
    && identityAccessInteger(value.signCount, 0, 4_294_967_295)
    && typeof value.backupEligible === 'boolean' && typeof value.backupState === 'boolean'
    && identityAccessId(value.trustedDeviceId) && identityAccessRevision(value.securityEpoch)
    && identityAccessIso(value.createdAt) && (value.lastUsedAt === undefined || identityAccessIso(value.lastUsedAt))
    && statusValid && value.privateKeyStored === false && value.biometricDataStored === false
    && value.attestationPayloadStored === false;
};

const identityAccessFederatedLink = (value: unknown): boolean => {
  if (!identityAccessExact(value, [
    'id', 'key', 'revision', 'provider', 'providerSubjectSha256', 'grantedScopes', 'status', 'liveAccountTested',
    'authorizationCodePkceVerified', 'stateVerified', 'nonceVerified', 'tokenBytesExposed',
    'tokenStoredInEncryptedVault', 'providerAvailabilityGuaranteed', 'providerDeliveryGuaranteed',
    'linkedAt', 'lastLocallyVerifiedAt'
  ], ['revokedAt'])) return false;
  const scopes = identityAccessUniqueStrings(value.grantedScopes, 1, 16, (item) =>
    typeof item === 'string' && /^[A-Za-z0-9._:-]{1,160}$/u.test(item));
  const statusValid = value.status === 'linked'
    ? value.revokedAt === undefined
    : value.status === 'revoked' && identityAccessIso(value.revokedAt);
  return identityAccessId(value.id) && identityAccessKey(value.key) && identityAccessRevision(value.revision)
    && Number(value.revision) >= 1 && identityAccessProviders.has(String(value.provider))
    && identityAccessSha256(value.providerSubjectSha256) && scopes && statusValid
    && value.liveAccountTested === true && value.authorizationCodePkceVerified === true
    && value.stateVerified === true && value.nonceVerified === true && value.tokenBytesExposed === false
    && value.tokenStoredInEncryptedVault === true && value.providerAvailabilityGuaranteed === false
    && value.providerDeliveryGuaranteed === false && identityAccessIso(value.linkedAt)
    && identityAccessIso(value.lastLocallyVerifiedAt);
};

const identityAccessTemporaryCredential = (value: unknown): boolean => {
  if (!identityAccessExact(value, [
    'id', 'key', 'revision', 'kind', 'purpose', 'audienceRefSha256', 'disclosedClaimKeys',
    'disclosureSha256', 'payloadSha256', 'signatureSha256', 'issuerKeyId', 'issuerPublicKeySha256',
    'signatureAlgorithm', 'qrPayloadBytes', 'status', 'notBefore', 'expiresAt', 'issuedAt',
    'encryptedEnvelopeStored', 'offlineSignatureVerifiable', 'expiryOfflineVerifiable',
    'minimumDisclosureEnforced', 'networkDeliveryGuaranteed', 'remoteRevocationFreshnessGuaranteed'
  ], ['revokedAt', 'revocationReason'])) return false;
  const kind = String(value.kind);
  const disclosedClaimKeys = value.disclosedClaimKeys;
  const claims = identityAccessUniqueStrings(disclosedClaimKeys, 1, 8, (item) => identityAccessClaimKeys.has(String(item)));
  const rules = identityAccessDisclosureRules.get(kind);
  const disclosureValid = claims && rules !== undefined
    && [...rules.required].every((key) => disclosedClaimKeys.includes(key))
    && disclosedClaimKeys.every((key) => rules.allowed.has(key));
  const statusValid = value.status === 'active'
    ? value.revokedAt === undefined && value.revocationReason === undefined
    : value.status === 'revoked' && identityAccessIso(value.revokedAt) && identityAccessText(value.revocationReason, 512);
  return identityAccessId(value.id) && identityAccessKey(value.key) && identityAccessRevision(value.revision)
    && Number(value.revision) >= 1 && identityAccessTemporaryKinds.has(kind)
    && identityAccessTemporaryPurposes.get(kind) === value.purpose && identityAccessSha256(value.audienceRefSha256)
    && disclosureValid && identityAccessSha256(value.disclosureSha256) && identityAccessSha256(value.payloadSha256)
    && identityAccessSha256(value.signatureSha256) && identityAccessSha256(value.issuerKeyId)
    && identityAccessSha256(value.issuerPublicKeySha256) && value.signatureAlgorithm === 'Ed25519'
    && identityAccessInteger(value.qrPayloadBytes, 1, 4_096) && statusValid
    && identityAccessIso(value.notBefore) && identityAccessIso(value.expiresAt) && identityAccessIso(value.issuedAt)
    && Date.parse(String(value.notBefore)) >= Date.parse(String(value.issuedAt))
    && Date.parse(String(value.expiresAt)) > Date.parse(String(value.notBefore))
    && Date.parse(String(value.expiresAt)) - Date.parse(String(value.notBefore)) <= 2_678_400_000
    && value.encryptedEnvelopeStored === true && value.offlineSignatureVerifiable === true
    && value.expiryOfflineVerifiable === true && value.minimumDisclosureEnforced === true
    && value.networkDeliveryGuaranteed === false && value.remoteRevocationFreshnessGuaranteed === false;
};

const identityAccessCompanionMetadata = (value: unknown, includeEnvelope: boolean): boolean => {
  const required = [
    'id', 'key', 'trustedDeviceId', 'protocolVersion', 'sourceVersion', 'schemaVersion', 'ciphertextSha256',
    'envelopeSha256', 'envelopeBytes', 'securityEpoch', 'generatedAt', 'expiresAt', 'sourceAuthority',
    'encrypted', 'readOnly', 'remoteWritesAccepted', 'conflictResolution', 'networkDeliveryGuaranteed'
  ];
  if (!identityAccessExact(value, includeEnvelope ? [...required, 'status', 'encryptedEnvelopeBase64Url'] : required)) return false;
  return identityAccessId(value.id) && identityAccessKey(value.key) && identityAccessId(value.trustedDeviceId)
    && value.protocolVersion === 1 && identityAccessRevision(value.sourceVersion)
    && identityAccessInteger(value.schemaVersion, 1) && identityAccessSha256(value.ciphertextSha256)
    && identityAccessSha256(value.envelopeSha256) && identityAccessInteger(value.envelopeBytes, 1, 8_388_608)
    && identityAccessRevision(value.securityEpoch) && identityAccessIso(value.generatedAt) && identityAccessIso(value.expiresAt)
    && Date.parse(String(value.expiresAt)) > Date.parse(String(value.generatedAt))
    && value.sourceAuthority === 'windows_single_writer' && value.encrypted === true && value.readOnly === true
    && value.remoteWritesAccepted === false && value.conflictResolution === 'reject_remote_and_refresh'
    && value.networkDeliveryGuaranteed === false
    && (!includeEnvelope || (value.status === 'snapshot_ready'
      && identityAccessBase64Url(value.encryptedEnvelopeBase64Url, 11_184_811)));
};

const identityAccessTruth = (value: unknown): boolean => identityAccessExact(value, [
  'passkeyPrivateKeyStored', 'biometricDataStored', 'passkeyVerificationScope', 'unconfiguredFederatedProvidersVisible',
  'federatedProviderAvailabilityGuaranteed', 'federatedProviderDeliveryGuaranteed', 'tokenBytesExposed',
  'companionSourceAuthority', 'companionRemoteWritesAccepted', 'companionNetworkDeliveryGuaranteed',
  'credentialQrBounded', 'credentialMinimumDisclosureEnforced', 'offlineSignatureAndExpiryVerifiable',
  'remoteRevocationFreshnessGuaranteed'
]) && value.passkeyPrivateKeyStored === false && value.biometricDataStored === false
  && value.passkeyVerificationScope === 'local_verified_ceremony_metadata_only'
  && value.unconfiguredFederatedProvidersVisible === false
  && value.federatedProviderAvailabilityGuaranteed === false && value.federatedProviderDeliveryGuaranteed === false
  && value.tokenBytesExposed === false && value.companionSourceAuthority === 'windows_single_writer'
  && value.companionRemoteWritesAccepted === false && value.companionNetworkDeliveryGuaranteed === false
  && value.credentialQrBounded === true && value.credentialMinimumDisclosureEnforced === true
  && value.offlineSignatureAndExpiryVerifiable === true && value.remoteRevocationFreshnessGuaranteed === false;

const identityAccessCenter = (value: unknown): boolean => {
  if (!identityAccessExact(value, [
    'schemaVersion', 'key', 'passkeys', 'federatedLinks', 'temporaryCredentials', 'companionSnapshots', 'truth', 'generatedAt'
  ]) || value.schemaVersion !== 1 || !identityAccessKey(value.key)
    || !Array.isArray(value.passkeys) || value.passkeys.length > 16 || !value.passkeys.every(identityAccessPasskey)
    || !Array.isArray(value.federatedLinks) || value.federatedLinks.length > 3 || !value.federatedLinks.every(identityAccessFederatedLink)
    || !Array.isArray(value.temporaryCredentials) || value.temporaryCredentials.length > 256
    || !value.temporaryCredentials.every(identityAccessTemporaryCredential)
    || !Array.isArray(value.companionSnapshots) || value.companionSnapshots.length > 256
    || !value.companionSnapshots.every((item) => identityAccessCompanionMetadata(item, false))
    || !identityAccessTruth(value.truth) || !identityAccessIso(value.generatedAt)) return false;
  const resources = [...value.passkeys, ...value.federatedLinks, ...value.temporaryCredentials, ...value.companionSnapshots];
  return resources.every((item) => isObject(item) && identityAccessKeysEqual(item.key, value.key))
    && new Set(value.passkeys.map((item) => isObject(item) ? item.id : undefined)).size === value.passkeys.length
    && new Set(value.federatedLinks.map((item) => isObject(item) ? item.id : undefined)).size === value.federatedLinks.length
    && new Set(value.temporaryCredentials.map((item) => isObject(item) ? item.id : undefined)).size === value.temporaryCredentials.length
    && new Set(value.companionSnapshots.map((item) => isObject(item) ? item.id : undefined)).size === value.companionSnapshots.length;
};

const identityAccessChallengeResult = (value: unknown, purpose: 'passkey_registration' | 'passkey_authentication'): boolean => {
  if (!identityAccessExact(value, [
    'challengeId', 'challenge', 'purpose', 'relyingPartyId', 'expiresAt', 'userVerification', 'residentKey',
    'privateKeyLeavesAuthenticator', 'biometricDataRequestedByApplication', 'allowedCredentialIds'
  ])) return false;
  const allowed = identityAccessUniqueStrings(value.allowedCredentialIds, purpose === 'passkey_authentication' ? 1 : 0, 16,
    (item) => identityAccessBase64Url(item, 1_366));
  return identityAccessId(value.challengeId) && identityAccessBase64Url(value.challenge, 512)
    && String(value.challenge).length >= 43 && value.purpose === purpose && identityAccessRelyingPartyId(value.relyingPartyId)
    && identityAccessIso(value.expiresAt) && value.userVerification === 'required' && value.residentKey === 'preferred'
    && value.privateKeyLeavesAuthenticator === false && value.biometricDataRequestedByApplication === false && allowed;
};

const identityAccessFederatedCeremonyResult = (value: unknown): boolean => identityAccessExact(value, [
  'flowId', 'provider', 'authorizationUrl', 'expiresAt', 'responseType', 'pkceMethod', 'stateBound', 'nonceBound',
  'codeVerifierStoredInEncryptedVault', 'codeVerifierExposed', 'tokenBytesExposed', 'providerAvailabilityGuaranteed',
  'providerDeliveryGuaranteed'
]) && identityAccessId(value.flowId) && identityAccessProviders.has(String(value.provider))
  && identityAccessAuthorizationUrl(value.authorizationUrl) && identityAccessIso(value.expiresAt)
  && value.responseType === 'code' && value.pkceMethod === 'S256' && value.stateBound === true && value.nonceBound === true
  && value.codeVerifierStoredInEncryptedVault === true && value.codeVerifierExposed === false
  && value.tokenBytesExposed === false && value.providerAvailabilityGuaranteed === false
  && value.providerDeliveryGuaranteed === false;

const identityAccessIssuedTemporaryResult = (value: unknown): boolean => {
  const credential = isObject(value) ? value.credential : undefined;
  if (!identityAccessExact(value, [
    'credential', 'qrPayload', 'qrPayloadBytes', 'containsOnlySelectedClaims', 'privateSigningKeyExposed',
    'networkDeliveryGuaranteed'
  ]) || !isObject(credential) || !identityAccessTemporaryCredential(credential) || !identityAccessQrPayload(value.qrPayload)
    || !identityAccessInteger(value.qrPayloadBytes, 1, 4_096)
    || value.qrPayloadBytes !== new TextEncoder().encode(String(value.qrPayload)).byteLength) return false;
  return credential.id !== undefined && credential.qrPayloadBytes === value.qrPayloadBytes
    && value.containsOnlySelectedClaims === true
    && value.privateSigningKeyExposed === false && value.networkDeliveryGuaranteed === false;
};

const identityAccessTemporaryVerificationResult = (value: unknown): boolean => {
  if (!identityAccessExact(value, [
    'credentialId', 'signatureValid', 'notYetValid', 'expired', 'disclosureValid', 'revocationStatus', 'decision',
    'audienceMatched', 'issuerIdentityCertified',
    'verifiedAt', 'offlineSignatureVerified', 'networkUsed', 'remoteRevocationFreshnessGuaranteed',
    'providerDeliveryGuaranteed', 'disclosedClaimKeys'
  ]) || !identityAccessId(value.credentialId) || typeof value.signatureValid !== 'boolean'
    || typeof value.notYetValid !== 'boolean' || typeof value.expired !== 'boolean' || typeof value.disclosureValid !== 'boolean'
    || !['not_revoked_locally', 'revoked_locally', 'unknown_offline'].includes(String(value.revocationStatus))
    || !['accepted_locally', 'rejected', 'indeterminate_revocation', 'indeterminate_issuer'].includes(String(value.decision))
    || typeof value.audienceMatched !== 'boolean' || value.issuerIdentityCertified !== false
    || !identityAccessIso(value.verifiedAt) || value.offlineSignatureVerified !== value.signatureValid
    || value.networkUsed !== false || value.remoteRevocationFreshnessGuaranteed !== false
    || value.providerDeliveryGuaranteed !== false
    || !identityAccessUniqueStrings(value.disclosedClaimKeys, 1, 8, (item) => identityAccessClaimKeys.has(String(item)))) return false;
  const cryptographicallyUsable = value.signatureValid && value.disclosureValid && !value.notYetValid && !value.expired;
  if (value.decision === 'accepted_locally') return cryptographicallyUsable && value.audienceMatched && value.revocationStatus === 'not_revoked_locally';
  if (value.decision === 'indeterminate_revocation' || value.decision === 'indeterminate_issuer') return cryptographicallyUsable && value.audienceMatched && value.revocationStatus === 'unknown_offline';
  return !cryptographicallyUsable || !value.audienceMatched || value.revocationStatus === 'revoked_locally';
};

const identityAccessCompanionResult = (value: unknown): boolean => {
  if (isObject(value) && value.status === 'snapshot_ready') return identityAccessCompanionMetadata(value, true);
  return identityAccessExact(value, [
    'status', 'currentSourceVersion', 'sourceAuthority', 'remoteWritesAccepted', 'conflictResolution',
    'networkDeliveryGuaranteed'
  ]) && ['write_forbidden', 'version_conflict', 'device_revoked', 'security_epoch_stale'].includes(String(value.status))
    && identityAccessRevision(value.currentSourceVersion) && value.sourceAuthority === 'windows_single_writer'
    && value.remoteWritesAccepted === false && value.conflictResolution === 'reject_remote_and_refresh'
    && value.networkDeliveryGuaranteed === false;
};

const identityAccessResult = (channel: string, result: unknown): IpcIntegrationPolicyDecision => {
  const inspection = inspectIdentityAccessPayload(result, channel, '$result');
  if (inspection) return inspection;
  let valid = false;
  switch (channel) {
    case 'identityAccess:getCenter': valid = identityAccessCenter(result); break;
    case 'identityAccess:issueOperationToken': valid = identityAccessOperationTokenResult(result); break;
    case 'identityAccess:beginPasskeyRegistration': valid = identityAccessChallengeResult(result, 'passkey_registration'); break;
    case 'identityAccess:beginPasskeyAuthentication': valid = identityAccessChallengeResult(result, 'passkey_authentication'); break;
    case 'identityAccess:beginFederatedIdentityLink': valid = identityAccessFederatedCeremonyResult(result); break;
    case 'identityAccess:issueTemporaryCredential': {
      const receipt = isObject(result) ? result.receipt : undefined;
      valid = identityAccessExact(result, ['receipt'], ['issued'])
        && isObject(receipt) && identityAccessMutationReceipt(receipt, channel)
        && (receipt.replayed === true ? result.issued === undefined : identityAccessIssuedTemporaryResult(result.issued))
        && (receipt.replayed === true || (isObject(result.issued) && isObject(result.issued.credential)
          && receipt.resourceId === result.issued.credential.id));
      break;
    }
    case 'identityAccess:verifyTemporaryCredential': valid = identityAccessTemporaryVerificationResult(result); break;
    case 'identityAccess:createCompanionSnapshot': valid = identityAccessCompanionResult(result); break;
    case 'identityAccess:completePasskeyRegistration':
    case 'identityAccess:authenticateWithPasskey':
    case 'identityAccess:revokePasskey':
    case 'identityAccess:recoverLostPasskey':
    case 'identityAccess:completeFederatedIdentityLink':
    case 'identityAccess:unlinkFederatedIdentity':
    case 'identityAccess:revokeTemporaryCredential':
      valid = identityAccessMutationReceipt(result, channel);
      break;
    default: return rejected('UNKNOWN_IPC_CHANNEL', '$result');
  }
  return valid ? accepted() : rejected('IDENTITY_ACCESS_RESULT_INVALID', '$result');
};

const privacyOwnershipChannels = new Set([
  'privacyOwnership:getCenter',
  'privacyOwnership:correctAiMemory',
  'privacyOwnership:restrictAiMemory',
  'privacyOwnership:deleteAiMemory',
  'privacyOwnership:expireAiMemory',
  'privacyOwnership:createRightsRequest',
  'privacyOwnership:updateRightsRequest',
  'privacyOwnership:createIncident',
  'privacyOwnership:updateIncident',
  'privacyOwnership:simulatePermission',
  'privacyOwnership:exportEncrypted'
]);
const privacyAiMemoryVisibilities = new Set(['owner_only', 'selected_accounts', 'family']);
const privacyAiMemoryPurposes = new Set(['general', 'care', 'finance', 'health', 'archive', 'legacy', 'ai_processing']);
const privacyRightsKinds = new Set(['encrypted_export', 'retention_change', 'erasure', 'legacy_export']);
const privacyRightsStatuses = new Set(['requested', 'in_review', 'locally_completed', 'rejected', 'cancelled']);
const privacyIncidentSeverities = new Set(['low', 'medium', 'high', 'critical']);
const privacyIncidentStatuses = new Set(['open', 'contained_locally', 'resolved', 'cancelled']);
const privacyIncidentActions = new Set([
  'revoke_local_session_authority', 'revoke_trusted_device', 'revoke_offline_capability',
  'revoke_consent', 'revoke_capability', 'quarantine_local_derived_data'
]);
const privacyPermissionPurposes = new Set(['general', 'care', 'finance', 'health', 'archive', 'legacy', 'ai_processing', 'administration']);
const privacyPathKeys = /^(?:path|filePath|directory|destination|destinationPath|sourcePath|targetPath)$/iu;
const privacyCredentialKeys = /^(?:password|passphrase|pin|cvv|cvc|secret|token)$/iu;
const privacyId = (value: unknown): boolean => typeof value === 'string'
  && value === value.trim()
  && value.length >= 2
  && value.length <= 160
  && /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/u.test(value);
const privacyIso = (value: unknown): boolean => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)
  && Number.isFinite(Date.parse(value));
const privacyRevision = (value: unknown): boolean => typeof value === 'number'
  && Number.isSafeInteger(value) && value >= 0 && value <= 9_000_000_000_000_000;
const privacyMutationIdentity = (value: Record<string, unknown>): boolean =>
  privacyRevision(value.expectedRevision) && privacyId(value.clientOperationId);
const exactNested = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  isObject(value) && Object.keys(value).length === keys.length && hasOnlyKeys(value, keys);
const optionalPrivacyText = (value: unknown, maximum = 4_096): boolean =>
  value === undefined || boundedString(value, maximum, true);

const inspectPrivacyOwnershipPayload = (
  value: unknown,
  allowRootPassphrase: boolean,
  path = '$[0]',
  depth = 0
): IpcIntegrationPolicyDecision | undefined => {
  if (depth > 10) return rejected('PRIVACY_ARGUMENT_NESTING_TOO_DEEP', path);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || value.length > 512) return rejected('PRIVACY_ARRAY_INVALID', path);
    for (let index = 0; index < value.length; index += 1) {
      const decision = inspectPrivacyOwnershipPayload(value[index], false, `${path}[${index}]`, depth + 1);
      if (decision) return decision;
    }
    return undefined;
  }
  if (typeof value === 'string') {
    if (value.length > 4_096) return rejected('PRIVACY_STRING_TOO_LARGE', path);
    return containsLikelyFullPan(value) ? rejected('BANKING_SECRET_VALUE_PROHIBITED', path) : undefined;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return rejected('NON_FINITE_NUMBER_REJECTED', path);
  if (value === null || typeof value !== 'object') return undefined;
  if (!isObject(value)) return rejected('NON_PLAIN_OBJECT_REJECTED', path);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === 'symbol')) return rejected('SYMBOL_FIELD_PROHIBITED', path);
  const keys = ownKeys as string[];
  if (keys.length > 64) return rejected('PRIVACY_OBJECT_TOO_LARGE', path);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || descriptor.get || descriptor.set || !('value' in descriptor)) return rejected('ACCESSOR_FIELD_PROHIBITED', `${path}.${key}`);
    const nested = descriptor.value;
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') return rejected('PROTOTYPE_FIELD_PROHIBITED', `${path}.${key}`);
    if (privacyPathKeys.test(key)) return rejected('PATH_FIELD_PROHIBITED', `${path}.${key}`);
    if (privacyCredentialKeys.test(key) && !(allowRootPassphrase && depth === 0 && key === 'passphrase')) {
      return rejected('CREDENTIAL_FIELD_PROHIBITED', `${path}.${key}`);
    }
    if (isProhibitedBankingSecretField(key)) return rejected('BANKING_SECRET_FIELD_PROHIBITED', `${path}.${key}`);
    const decision = inspectPrivacyOwnershipPayload(nested, false, `${path}.${key}`, depth + 1);
    if (decision) return decision;
  }
  return undefined;
};

const privacyOwnershipInput = (channel: string, args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (channel === 'privacyOwnership:getCenter') return zeroArguments(args);
  if (args.length !== 1 || !isObject(args[0])) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  const input = args[0];
  const inspection = inspectPrivacyOwnershipPayload(input, channel === 'privacyOwnership:exportEncrypted');
  if (inspection) return inspection;
  const identity = (): boolean => privacyMutationIdentity(input);
  switch (channel) {
    case 'privacyOwnership:correctAiMemory':
      return exactNested(input, ['expectedRevision', 'clientOperationId', 'recordId', 'title', 'statement'])
        && identity() && privacyId(input.recordId) && boundedString(input.title, 240) && boundedString(input.statement, 4_096)
        ? accepted() : rejected('PRIVACY_AI_MEMORY_CORRECTION_INVALID', '$[0]');
    case 'privacyOwnership:restrictAiMemory': {
      if (!exactNested(input, ['expectedRevision', 'clientOperationId', 'recordId', 'restriction'])
        || !identity() || !privacyId(input.recordId)
        || !exactNested(input.restriction, ['visibility', 'selectedAccountIds', 'allowedPurposes', 'processingAllowed'])) {
        return rejected('PRIVACY_AI_MEMORY_RESTRICTION_INVALID', '$[0]');
      }
      const restriction = input.restriction;
      const accounts = restriction.selectedAccountIds;
      const purposes = restriction.allowedPurposes;
      const valid = privacyAiMemoryVisibilities.has(String(restriction.visibility))
        && Array.isArray(accounts) && accounts.length <= 32 && accounts.every(privacyId) && new Set(accounts).size === accounts.length
        && Array.isArray(purposes) && purposes.length <= 7 && purposes.every((purpose) => privacyAiMemoryPurposes.has(String(purpose))) && new Set(purposes).size === purposes.length
        && typeof restriction.processingAllowed === 'boolean'
        && (restriction.visibility === 'selected_accounts' ? accounts.length > 0 : accounts.length === 0);
      return valid ? accepted() : rejected('PRIVACY_AI_MEMORY_RESTRICTION_INVALID', '$[0].restriction');
    }
    case 'privacyOwnership:deleteAiMemory':
      return exactNested(input, ['expectedRevision', 'clientOperationId', 'recordId', 'reason'])
        && identity() && privacyId(input.recordId) && boundedString(input.reason, 4_096)
        ? accepted() : rejected('PRIVACY_AI_MEMORY_DELETION_INVALID', '$[0]');
    case 'privacyOwnership:expireAiMemory':
      return exactNested(input, ['expectedRevision', 'clientOperationId', 'recordId', 'retentionUntil'])
        && identity() && privacyId(input.recordId) && privacyIso(input.retentionUntil)
        ? accepted() : rejected('PRIVACY_AI_MEMORY_EXPIRY_INVALID', '$[0]');
    case 'privacyOwnership:createRightsRequest':
      return hasOnlyKeys(input, ['expectedRevision', 'clientOperationId', 'kind', 'scopeResourceType', 'scopeResourceId', 'reason', 'requestedRetentionUntil'])
        && Object.keys(input).length >= 6
        && identity() && privacyRightsKinds.has(String(input.kind)) && privacyId(input.scopeResourceType) && privacyId(input.scopeResourceId)
        && boundedString(input.reason, 4_096) && optionalPrivacyText(input.requestedRetentionUntil, 64)
        && (input.requestedRetentionUntil === undefined || privacyIso(input.requestedRetentionUntil))
        && (input.kind !== 'encrypted_export' || input.scopeResourceType === 'privacy_inventory')
        && (input.kind !== 'legacy_export' || input.scopeResourceType === 'digital_legacy')
        ? accepted() : rejected('PRIVACY_RIGHTS_REQUEST_CREATE_INVALID', '$[0]');
    case 'privacyOwnership:updateRightsRequest':
      return hasOnlyKeys(input, ['expectedRevision', 'clientOperationId', 'requestId', 'status', 'resolutionNote'])
        && Object.keys(input).length >= 4
        && identity() && privacyId(input.requestId) && privacyRightsStatuses.has(String(input.status)) && optionalPrivacyText(input.resolutionNote)
        ? accepted() : rejected('PRIVACY_RIGHTS_REQUEST_UPDATE_INVALID', '$[0]');
    case 'privacyOwnership:createIncident': {
      if (!exactNested(input, ['expectedRevision', 'clientOperationId', 'title', 'severity', 'suspectedAt', 'actions', 'evidenceReferenceIds'])
        || !identity() || !boundedString(input.title, 240) || !privacyIncidentSeverities.has(String(input.severity)) || !privacyIso(input.suspectedAt)
        || !Array.isArray(input.actions) || input.actions.length < 1 || input.actions.length > 5 || !Array.isArray(input.evidenceReferenceIds)
        || input.evidenceReferenceIds.length > 64 || !input.evidenceReferenceIds.every(privacyId)) {
        return rejected('PRIVACY_INCIDENT_CREATE_INVALID', '$[0]');
      }
      return input.actions.every((action) => exactNested(action, ['action', 'targetId'])
        && privacyIncidentActions.has(String(action.action)) && privacyId(action.targetId))
        ? accepted() : rejected('PRIVACY_INCIDENT_ACTION_INVALID', '$[0].actions');
    }
    case 'privacyOwnership:updateIncident':
      return hasOnlyKeys(input, ['expectedRevision', 'clientOperationId', 'incidentId', 'status', 'resolutionNote'])
        && Object.keys(input).length >= 4
        && identity() && privacyId(input.incidentId) && privacyIncidentStatuses.has(String(input.status)) && optionalPrivacyText(input.resolutionNote)
        ? accepted() : rejected('PRIVACY_INCIDENT_UPDATE_INVALID', '$[0]');
    case 'privacyOwnership:simulatePermission': {
      if (!exactNested(input, ['targets']) || !Array.isArray(input.targets) || input.targets.length < 1 || input.targets.length > 100) {
        return rejected('PRIVACY_PERMISSION_SIMULATION_INVALID', '$[0]');
      }
      return input.targets.every((target) => exactNested(target, ['subjectAccountId', 'resourceType', 'resourceId', 'action', 'purpose', 'occurredAt'])
        && privacyId(target.subjectAccountId) && target.resourceType === 'privacy_inventory' && privacyId(target.resourceId)
        && target.action === 'read' && privacyPermissionPurposes.has(String(target.purpose)) && privacyIso(target.occurredAt))
        ? accepted() : rejected('PRIVACY_PERMISSION_SIMULATION_TARGET_INVALID', '$[0].targets');
    }
    case 'privacyOwnership:exportEncrypted': {
      if (!exactNested(input, ['requestId', 'passphrase']) || !privacyId(input.requestId) || typeof input.passphrase !== 'string') {
        return rejected('PRIVACY_ENCRYPTED_EXPORT_INVALID', '$[0]');
      }
      const normalized = input.passphrase.normalize('NFKC');
      return normalized === input.passphrase && normalized.length >= 12 && normalized.length <= 1_024
        && normalized.trim() === normalized && !/[\p{Cc}\p{Cf}]/u.test(normalized) && !/^\d+$/u.test(normalized)
        ? accepted() : rejected('PRIVACY_ENCRYPTED_EXPORT_PASSPHRASE_INVALID', '$[0].passphrase');
    }
    default:
      return rejected('UNKNOWN_IPC_CHANNEL', '$');
  }
};

export const LOCAL_GOVERNED_OCR_IPC_CHANNELS = Object.freeze({
  getCenter: 'localOcr:getCenter',
  getResult: 'localOcr:getResult',
  create: 'localOcr:create',
  run: 'localOcr:run',
  cancel: 'localOcr:cancel',
  correct: 'localOcr:correct',
  rerun: 'localOcr:rerun',
  delete: 'localOcr:delete',
  setEnabled: 'localOcr:setEnabled'
} as const);

const localOcrChannels = new Set<string>(Object.values(LOCAL_GOVERNED_OCR_IPC_CHANNELS));
const localOcrWriteChannels = new Set<string>([
  LOCAL_GOVERNED_OCR_IPC_CHANNELS.create,
  LOCAL_GOVERNED_OCR_IPC_CHANNELS.run,
  LOCAL_GOVERNED_OCR_IPC_CHANNELS.cancel,
  LOCAL_GOVERNED_OCR_IPC_CHANNELS.correct,
  LOCAL_GOVERNED_OCR_IPC_CHANNELS.rerun,
  LOCAL_GOVERNED_OCR_IPC_CHANNELS.delete,
  LOCAL_GOVERNED_OCR_IPC_CHANNELS.setEnabled
]);
const localOcrStatuses = new Set([
  'queued', 'running', 'cancel_requested', 'completed', 'failed', 'cancelled', 'deleted'
]);
const localOcrFailureCodes = new Set([
  'source_unavailable', 'consent_unavailable', 'engine_failed', 'integrity_mismatch'
]);
const localOcrIdentifierPattern = /^[A-Za-z0-9._:-]{8,160}$/u;
const localOcrLanguagePattern = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})?$/u;
const localOcrMimePattern = /^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,127}$/u;
const localOcrAbsolutePathValuePattern = /(?:^|[\s"'`])(?:[A-Za-z]:[\\/]|\\\\[^\\\s]|\/(?:[A-Za-z0-9._-]+[\\/])+|file:\/\/)/iu;
const localOcrForbiddenAuthorityKeyPattern = /^(?:familyId|accountId|ownerPersonId|sealedResultId|receipt|authorizationReceipt|policyReceipt|authorization|stateFingerprint|requestFingerprint|inputSha256|contentSha256|resultContentSha256|derivedBindingHash|hash|sha256|raw|rawBytes|fileBytes|sourcePath|filePath|destinationPath|targetPath|directoryPath|absolutePath)$/iu;
const localOcrCredentialKeyPattern = /^(?:password|passphrase|pin|cvv|cvc|secret|token|pan|iban|cardNumber|accountNumber)$/iu;

const localOcrExact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => {
  if (!isObject(value)) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === 'symbol')) return false;
  const actual = (ownKeys as string[]).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const inspectLocalOcrPayloadUnsafe = (
  value: unknown,
  path: string,
  depth: number
): IpcIntegrationPolicyDecision | undefined => {
  if (depth > 8) return rejected('LOCAL_OCR_PAYLOAD_NESTING_TOO_DEEP', path);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || value.length > 500) {
      return rejected('LOCAL_OCR_ARRAY_INVALID', path);
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key === 'symbol')) return rejected('SYMBOL_FIELD_PROHIBITED', path);
    const stringKeys = ownKeys as string[];
    if (stringKeys.some((key) => key !== 'length' && !/^(?:0|[1-9]\d*)$/u.test(key))) {
      return rejected('LOCAL_OCR_ARRAY_FIELD_PROHIBITED', path);
    }
    if (Object.keys(value).length !== value.length) return rejected('LOCAL_OCR_SPARSE_ARRAY_PROHIBITED', path);
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || descriptor.get || descriptor.set || !('value' in descriptor)) {
        return rejected('ACCESSOR_FIELD_PROHIBITED', `${path}[${index}]`);
      }
      const decision = inspectLocalOcrPayloadUnsafe(descriptor.value, `${path}[${index}]`, depth + 1);
      if (decision) return decision;
    }
    return undefined;
  }
  if (typeof value === 'string') {
    if (value.length > 250_000) return rejected('LOCAL_OCR_STRING_TOO_LARGE', path);
    if (containsLikelyFullPan(value)) return rejected('BANKING_SECRET_VALUE_PROHIBITED', path);
    if (localOcrAbsolutePathValuePattern.test(value)) return rejected('PATH_VALUE_PROHIBITED', path);
    return undefined;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return rejected('NON_FINITE_NUMBER_REJECTED', path);
  if (value === null || typeof value !== 'object') return undefined;
  if (!isObject(value)) return rejected('NON_PLAIN_OBJECT_REJECTED', path);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === 'symbol')) return rejected('SYMBOL_FIELD_PROHIBITED', path);
  const keys = ownKeys as string[];
  if (keys.length > 64) return rejected('LOCAL_OCR_OBJECT_TOO_LARGE', path);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || descriptor.get || descriptor.set || !('value' in descriptor)) {
      return rejected('ACCESSOR_FIELD_PROHIBITED', `${path}.${key}`);
    }
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
      return rejected('PROTOTYPE_FIELD_PROHIBITED', `${path}.${key}`);
    }
    if (localOcrForbiddenAuthorityKeyPattern.test(key)) {
      return rejected('LOCAL_OCR_AUTHORITY_FIELD_PROHIBITED', `${path}.${key}`);
    }
    if (localOcrCredentialKeyPattern.test(key)) {
      return rejected('CREDENTIAL_FIELD_PROHIBITED', `${path}.${key}`);
    }
    if (isProhibitedBankingSecretField(key)) {
      return rejected('BANKING_SECRET_FIELD_PROHIBITED', `${path}.${key}`);
    }
    const decision = inspectLocalOcrPayloadUnsafe(descriptor.value, `${path}.${key}`, depth + 1);
    if (decision) return decision;
  }
  return undefined;
};

const inspectLocalOcrPayload = (
  value: unknown,
  path: string
): IpcIntegrationPolicyDecision | undefined => {
  try {
    return inspectLocalOcrPayloadUnsafe(value, path, 0);
  } catch {
    return rejected('LOCAL_OCR_PAYLOAD_INSPECTION_FAILED', path);
  }
};

const localOcrJsonWithin = (value: unknown, maximumBytes: number): boolean => {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' && new TextEncoder().encode(serialized).byteLength <= maximumBytes;
  } catch {
    return false;
  }
};

const localOcrId = (value: unknown): value is string => typeof value === 'string'
  && value === value.trim() && localOcrIdentifierPattern.test(value);
const localOcrRevision = (value: unknown): value is number => typeof value === 'number'
  && Number.isSafeInteger(value) && value >= 0 && value < 2_147_483_647;
const localOcrBoundedInteger = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
const localOcrIso = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)
  && Number.isFinite(Date.parse(value));
const localOcrNullableIso = (value: unknown): boolean => value === null || localOcrIso(value);
const localOcrNullableInteger = (value: unknown, minimum: number, maximum: number): boolean =>
  value === null || localOcrBoundedInteger(value, minimum, maximum);
const localOcrReason = (value: unknown): boolean => typeof value === 'string'
  && value === value.trim() && value.length >= 1 && value.length <= 512 && !value.includes('\0');
const localOcrLanguages = (value: unknown): value is readonly string[] => Array.isArray(value)
  && Object.getPrototypeOf(value) === Array.prototype
  && value.length <= 8
  && value.every((language) => typeof language === 'string'
    && language === language.trim() && localOcrLanguagePattern.test(language))
  && new Set(value).size === value.length;
const localOcrMutationIdentity = (value: Record<string, unknown>): boolean =>
  localOcrRevision(value.expectedRevision) && localOcrId(value.clientOperationId);

const localOcrInput = (channel: string, args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  const inspection = inspectLocalOcrPayload(args, '$args');
  if (inspection) return inspection;
  if (!localOcrJsonWithin(args, 1_048_576)) return rejected('LOCAL_OCR_ARGUMENT_SIZE_EXCEEDED', '$args');
  if (channel === LOCAL_GOVERNED_OCR_IPC_CHANNELS.getCenter) return zeroArguments(args);
  if (args.length !== 1 || !isObject(args[0])) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  const input = args[0];
  switch (channel) {
    case LOCAL_GOVERNED_OCR_IPC_CHANNELS.getResult:
      return localOcrExact(input, ['jobId']) && localOcrId(input.jobId)
        ? accepted() : rejected('LOCAL_OCR_RESULT_READ_ARGUMENT_INVALID', '$[0]');
    case LOCAL_GOVERNED_OCR_IPC_CHANNELS.create:
      return localOcrExact(input, ['expectedRevision', 'clientOperationId', 'sourceResourceId', 'languageHints'])
        && localOcrMutationIdentity(input) && input.expectedRevision === 0
        && localOcrId(input.sourceResourceId) && localOcrLanguages(input.languageHints)
        ? accepted() : rejected('LOCAL_OCR_CREATE_ARGUMENT_INVALID', '$[0]');
    case LOCAL_GOVERNED_OCR_IPC_CHANNELS.run:
    case LOCAL_GOVERNED_OCR_IPC_CHANNELS.cancel:
      return localOcrExact(input, ['expectedRevision', 'clientOperationId', 'jobId'])
        && localOcrMutationIdentity(input) && localOcrId(input.jobId)
        ? accepted() : rejected('LOCAL_OCR_JOB_ARGUMENT_INVALID', '$[0]');
    case LOCAL_GOVERNED_OCR_IPC_CHANNELS.correct:
      return localOcrExact(input, ['expectedRevision', 'clientOperationId', 'jobId', 'correctedText'])
        && localOcrMutationIdentity(input) && localOcrId(input.jobId)
        && typeof input.correctedText === 'string' && input.correctedText.length >= 1
        && input.correctedText.length <= 250_000 && !input.correctedText.includes('\0')
        ? accepted() : rejected('LOCAL_OCR_CORRECTION_ARGUMENT_INVALID', '$[0]');
    case LOCAL_GOVERNED_OCR_IPC_CHANNELS.rerun: {
      const keys = input.languageHints === undefined
        ? ['expectedRevision', 'clientOperationId', 'jobId']
        : ['expectedRevision', 'clientOperationId', 'jobId', 'languageHints'];
      return localOcrExact(input, keys) && localOcrMutationIdentity(input) && localOcrId(input.jobId)
        && (input.languageHints === undefined || localOcrLanguages(input.languageHints))
        ? accepted() : rejected('LOCAL_OCR_RERUN_ARGUMENT_INVALID', '$[0]');
    }
    case LOCAL_GOVERNED_OCR_IPC_CHANNELS.delete:
      return localOcrExact(input, ['expectedRevision', 'clientOperationId', 'jobId', 'reason'])
        && localOcrMutationIdentity(input) && localOcrId(input.jobId) && localOcrReason(input.reason)
        ? accepted() : rejected('LOCAL_OCR_DELETE_ARGUMENT_INVALID', '$[0]');
    case LOCAL_GOVERNED_OCR_IPC_CHANNELS.setEnabled:
      return localOcrExact(input, ['expectedRevision', 'clientOperationId', 'enabled', 'reason'])
        && localOcrMutationIdentity(input) && typeof input.enabled === 'boolean' && localOcrReason(input.reason)
        ? accepted() : rejected('LOCAL_OCR_SETTINGS_ARGUMENT_INVALID', '$[0]');
    default:
      return rejected('UNKNOWN_IPC_CHANNEL', '$');
  }
};

const localOcrSourceResult = (value: unknown): boolean => localOcrExact(value, [
  'resourceType', 'resourceId', 'mimeType', 'size'
]) && value.resourceType === 'archive_item' && localOcrId(value.resourceId)
  && typeof value.mimeType === 'string' && localOcrMimePattern.test(value.mimeType)
  && localOcrBoundedInteger(value.size, 1, 16 * 1_024 * 1_024);

const localOcrJobResult = (value: unknown): boolean => {
  if (!localOcrExact(value, [
    'id', 'revision', 'source', 'languageHints', 'status', 'runAttempt', 'correctionRevision',
    'resultAvailable', 'resultCharacterCount', 'resultPageCount', 'confidenceBasisPoints', 'retentionUntil',
    'failureCode', 'cancellationRequestedAt', 'completedAt', 'failedAt', 'cancelledAt', 'deletedAt',
    'sourceDeletedAt', 'deletionPropagation', 'processor', 'networkUsed', 'cloudUsed', 'createdAt', 'updatedAt'
  ])) return false;
  if (!localOcrId(value.id) || !localOcrRevision(value.revision) || !localOcrSourceResult(value.source)
    || !localOcrLanguages(value.languageHints) || !localOcrStatuses.has(String(value.status))
    || !localOcrBoundedInteger(value.runAttempt, 0, 1_000_000)
    || !localOcrBoundedInteger(value.correctionRevision, 0, 1_000_000)
    || typeof value.resultAvailable !== 'boolean'
    || !localOcrNullableInteger(value.resultCharacterCount, 1, 250_000)
    || !localOcrNullableInteger(value.resultPageCount, 1, 50)
    || !localOcrNullableInteger(value.confidenceBasisPoints, 0, 10_000)
    || !localOcrNullableIso(value.retentionUntil)
    || !(value.failureCode === null || localOcrFailureCodes.has(String(value.failureCode)))
    || !localOcrNullableIso(value.cancellationRequestedAt) || !localOcrNullableIso(value.completedAt)
    || !localOcrNullableIso(value.failedAt) || !localOcrNullableIso(value.cancelledAt)
    || !localOcrNullableIso(value.deletedAt) || !localOcrNullableIso(value.sourceDeletedAt)
    || !['active', 'locally_deleted'].includes(String(value.deletionPropagation))
    || value.processor !== 'local_ocr' || value.networkUsed !== false || value.cloudUsed !== false
    || !localOcrIso(value.createdAt) || !localOcrIso(value.updatedAt)) return false;
  if (value.resultAvailable) {
    if (value.status !== 'completed' || value.resultCharacterCount === null || value.resultPageCount === null) return false;
  } else if (value.resultCharacterCount !== null || value.resultPageCount !== null || value.confidenceBasisPoints !== null) {
    return false;
  }
  return value.deletionPropagation !== 'locally_deleted' || value.status === 'deleted';
};

const localOcrCenterResult = (value: unknown): boolean => {
  if (!localOcrExact(value, ['schemaVersion', 'settings', 'jobs', 'truth', 'generatedAt']) || value.schemaVersion !== 1
    || !localOcrExact(value.settings, ['revision', 'enabled', 'disabledReason', 'disabledAt', 'updatedAt'])
    || !localOcrRevision(value.settings.revision) || typeof value.settings.enabled !== 'boolean'
    || !(value.settings.disabledReason === null || localOcrReason(value.settings.disabledReason))
    || !localOcrNullableIso(value.settings.disabledAt) || !localOcrIso(value.settings.updatedAt)
    || !Array.isArray(value.jobs) || value.jobs.length > 500 || !value.jobs.every(localOcrJobResult)
    || new Set(value.jobs.map((job) => isObject(job) ? job.id : undefined)).size !== value.jobs.length
    || !localOcrExact(value.truth, [
      'executionScope', 'lowPrivilegeSandboxVerified', 'sourceContentExposedToRenderer',
      'plaintextResultPersistedInRepository', 'networkUsed', 'cloudUsed', 'providerDeliveryGuaranteed',
      'explicitSensitiveProcessingConsentRequired', 'derivedPolicyBindingRequired',
      'sourceDeletionPropagatesToDerivedResult', 'sourceDeletionAutoResumeGuaranteed',
      'authorizationRevocationPropagatesToSealedResult',
      'derivedDeletionDeletesSource'
    ]) || value.truth.executionScope !== 'bounded_child_process'
    || value.truth.lowPrivilegeSandboxVerified !== false || value.truth.sourceContentExposedToRenderer !== false
    || value.truth.plaintextResultPersistedInRepository !== false || value.truth.networkUsed !== false
    || value.truth.cloudUsed !== false || value.truth.providerDeliveryGuaranteed !== false
    || value.truth.explicitSensitiveProcessingConsentRequired !== true
    || value.truth.derivedPolicyBindingRequired !== true
    || value.truth.sourceDeletionPropagatesToDerivedResult !== true
    || value.truth.sourceDeletionAutoResumeGuaranteed !== true
    || value.truth.authorizationRevocationPropagatesToSealedResult !== true
    || value.truth.derivedDeletionDeletesSource !== false || !localOcrIso(value.generatedAt)) return false;
  return value.settings.enabled
    ? value.settings.disabledReason === null && value.settings.disabledAt === null
    : value.settings.disabledReason !== null && value.settings.disabledAt !== null;
};

const localOcrTextResult = (value: unknown): boolean => localOcrExact(value, [
  'jobId', 'revision', 'text', 'corrected', 'payloadSource', 'networkUsed', 'cloudUsed'
]) && localOcrId(value.jobId) && localOcrRevision(value.revision)
  && typeof value.text === 'string' && value.text.length >= 1 && value.text.length <= 250_000 && !value.text.includes('\0')
  && typeof value.corrected === 'boolean' && value.payloadSource === 'sealed_local_result'
  && value.networkUsed === false && value.cloudUsed === false;

const localOcrMutationResult = (value: unknown): boolean => localOcrExact(value, [
  'previousRevision', 'revision', 'occurredAt', 'replayed', 'networkUsed', 'cloudUsed'
]) && localOcrRevision(value.previousRevision) && localOcrRevision(value.revision)
  && value.revision > value.previousRevision && localOcrIso(value.occurredAt)
  && typeof value.replayed === 'boolean' && value.networkUsed === false && value.cloudUsed === false;

const localOcrResult = (channel: string, result: unknown): IpcIntegrationPolicyDecision => {
  const inspection = inspectLocalOcrPayload(result, '$result');
  if (inspection) return inspection;
  if (!localOcrJsonWithin(result, 1_048_576)) return rejected('LOCAL_OCR_RESULT_SIZE_EXCEEDED', '$result');
  const valid = channel === LOCAL_GOVERNED_OCR_IPC_CHANNELS.getCenter
    ? localOcrCenterResult(result)
    : channel === LOCAL_GOVERNED_OCR_IPC_CHANNELS.getResult
      ? localOcrTextResult(result)
      : localOcrWriteChannels.has(channel) && localOcrMutationResult(result);
  return valid ? accepted() : rejected('LOCAL_OCR_RESULT_INVALID', '$result');
};

const policyServiceAvailabilityReasons = new Set([
  'FRESH_VERIFIED_READ_WRITE',
  'FRESH_VERIFIED_READ_ONLY',
  'SERVICE_UNAVAILABLE',
  'OBSERVATION_MALFORMED',
  'POLICY_PACKAGE_SIGNATURE_INVALID',
  'POLICY_VERSION_MISMATCH',
  'POLICY_PACKAGE_VERSION_MISMATCH',
  'POLICY_PACKAGE_HASH_MISMATCH',
  'OBSERVATION_STALE',
  'OBSERVATION_FROM_FUTURE',
  'SERVICE_NOT_READY',
  'UNSAFE_SERVICE_STATE',
  'READ_ONLY_MUTATION_DENIED'
]);

const policyServiceAvailabilityResult = (
  value: unknown
): value is PolicyServiceAvailabilityBoundaryView => {
  try {
    if (!isObject(value)) return false;
    const expectedKeys = [
      'schemaVersion', 'status', 'enforcement', 'mode', 'reason', 'sensitiveReadAllowed',
      'sensitiveMutationAllowed', 'policyPackageVerified', 'observationFresh',
      'maximumObservationAgeMs', 'maximumFutureSkewMs', 'mappingGrantsRuntimeAuthority',
      'historicalReceiptGrantsCurrentAuthority', 'sourcePathsExposedToClient',
      'policyPackageHashesExposedToClient', 'schemaMigrationRequired', 'latestDatabaseMigration'
    ] as const;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== expectedKeys.length || ownKeys.some((key) => typeof key === 'symbol')) return false;
    const actualKeys = (ownKeys as string[]).sort();
    const canonicalKeys = [...expectedKeys].sort();
    if (!actualKeys.every((key, index) => key === canonicalKeys[index])) return false;
    if (actualKeys.some((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return !descriptor || descriptor.get !== undefined || descriptor.set !== undefined || !('value' in descriptor);
    })) return false;
    const result = value as Record<string, unknown>;
    const mode = result.mode;
    const sensitiveReadAllowed = mode !== 'deny';
    const sensitiveMutationAllowed = mode === 'read-write';
    return result.schemaVersion === 1
      && result.status === 'policy-service-availability-evaluated'
      && result.enforcement === 'fail-closed'
      && (mode === 'read-write' || mode === 'read-only' || mode === 'deny')
      && typeof result.reason === 'string' && policyServiceAvailabilityReasons.has(result.reason)
      && result.sensitiveReadAllowed === sensitiveReadAllowed
      && result.sensitiveMutationAllowed === sensitiveMutationAllowed
      && typeof result.policyPackageVerified === 'boolean'
      && typeof result.observationFresh === 'boolean'
      && result.maximumObservationAgeMs === 30_000
      && result.maximumFutureSkewMs === 5_000
      && result.mappingGrantsRuntimeAuthority === false
      && result.historicalReceiptGrantsCurrentAuthority === false
      && result.sourcePathsExposedToClient === false
      && result.policyPackageHashesExposedToClient === false
      && result.schemaMigrationRequired === false
      && result.latestDatabaseMigration === 77;
  } catch {
    return false;
  }
};

export const evaluateIpcIntegrationResultPolicy = (channel: string, result: unknown): IpcIntegrationPolicyDecision => {
  if (localOcrChannels.has(channel)) return localOcrResult(channel, result);
  if (channel.startsWith('localOcr:')) return rejected('UNKNOWN_IPC_CHANNEL', '$result');
  if (identityAccessChannels.has(channel)) return identityAccessResult(channel, result);
  if (channel.startsWith('identityAccess:')) return rejected('UNKNOWN_IPC_CHANNEL', '$result');
  if (channel === 'system:getPolicyServiceAvailabilityBoundary') {
    return policyServiceAvailabilityResult(result)
      ? accepted()
      : rejected('POLICY_SERVICE_AVAILABILITY_RESULT_INVALID', '$result');
  }
  if (channel !== 'privacyOwnership:exportEncrypted') return accepted();
  if (!exactNested(result, ['fileName', 'artifactSha256', 'artifactSizeBytes', 'createdAt', 'delivery'])) {
    return rejected('PRIVACY_EXPORT_RESULT_INVALID', '$result');
  }
  return typeof result.fileName === 'string' && result.fileName.length >= 12 && result.fileName.length <= 255
    && !/[\\/\0]/u.test(result.fileName) && result.fileName.toLowerCase().endsWith('.pptprivacy')
    && typeof result.artifactSha256 === 'string' && /^[0-9a-f]{64}$/u.test(result.artifactSha256)
    && typeof result.artifactSizeBytes === 'number' && Number.isSafeInteger(result.artifactSizeBytes)
    && result.artifactSizeBytes > 0 && result.artifactSizeBytes <= 50 * 1024 * 1024
    && privacyIso(result.createdAt) && result.delivery === 'not_performed'
    ? accepted() : rejected('PRIVACY_EXPORT_RESULT_INVALID', '$result');
};

export const evaluateIpcIntegrationPolicy = (channel: string, args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (localOcrChannels.has(channel)) return localOcrInput(channel, args);
  if (channel.startsWith('localOcr:')) return rejected('UNKNOWN_IPC_CHANNEL', '$');
  if (identityAccessChannels.has(channel)) return identityAccessInput(channel, args);
  if (privacyOwnershipChannels.has(channel)) return privacyOwnershipInput(channel, args);
  switch (channel) {
    case 'accessibility:getPreferences':
      return zeroArguments(args);
    case 'accessibility:updatePreferences':
      return accessibilityPreferencesInput(args);
    case 'formDraft:getWorkspace':
      return formDraftKeyInput(args);
    case 'formDraft:save':
      return formDraftSaveInput(args);
    case 'formDraft:undo':
      return formDraftUndoInput(args);
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
      return rejected('UNKNOWN_IPC_CHANNEL', '$');
  }
};
