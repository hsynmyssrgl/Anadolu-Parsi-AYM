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
import {
  archiveLegacyOwnershipReattestationConfirmation,
  canonicalLocalGovernedOcrSearchTokens,
  type FamilyMeetingCenterView,
  type FamilyMeetingMinutesContentView,
  type FamilyMeetingMutationKind,
  type FamilyMeetingMutationReceiptView,
  type CommunicationFileSharingCommand,
  type LocalGovernedOcrCenterView,
  type LocalGovernedOcrMutationReceiptView,
  type LocalGovernedOcrResultView,
  type LocalGovernedOcrSearchView,
  type PolicyServiceAvailabilityBoundaryView
} from '@ppt/domain';
import {
  UNIFIED_AUTHORIZED_SEARCH_MAX_RESULTS,
  UNIFIED_AUTHORIZED_SEARCH_MODULES,
  canonicalUnifiedAuthorizedSearchTokens,
  unifiedAuthorizedSearchResourceTypeForModule,
  type UnifiedAuthorizedSearchModule
} from '@ppt/domain';

export interface IpcIntegrationPolicyDecision {
  readonly accepted: boolean;
  readonly reason?: string;
  readonly path?: string;
}

export type FamilyMeetingIpcView = Omit<FamilyMeetingCenterView['meetings'][number], 'ownerPersonId' | 'decisions'> & {
  readonly decisions: readonly Omit<FamilyMeetingCenterView['meetings'][number]['decisions'][number], 'ledgerReference'>[];
};

export type FamilyMeetingCenterIpcView = Omit<FamilyMeetingCenterView, 'centerId' | 'ownerPersonId' | 'meetings'> & {
  readonly meetings: readonly FamilyMeetingIpcView[];
};

export type FamilyMeetingMinutesIpcView = FamilyMeetingMinutesContentView;

export type FamilyMeetingMutationIpcView = Omit<
  FamilyMeetingMutationReceiptView,
  'resourceType' | 'resourceId'
> & {
  readonly meetingId: string;
};

export const projectFamilyMeetingCenterIpcView = (
  center: FamilyMeetingCenterView
): FamilyMeetingCenterIpcView => {
  if (center.meetings.some((meeting) => meeting.ownerPersonId !== center.ownerPersonId)) {
    throw new Error('Family meeting center owner binding is incoherent.');
  }
  return {
    schemaVersion: 1,
    meetings: center.meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      recurrenceKind: meeting.recurrenceKind,
      recurrenceInterval: meeting.recurrenceInterval,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      reminderMinutes: meeting.reminderMinutes,
      state: meeting.state,
      participants: meeting.participants.map((participant) => ({ ...participant, roles: [...participant.roles] })),
      agenda: meeting.agenda.map((item) => ({
        ...item,
        preRead: item.preRead.map((reference) => ({ ...reference }))
      })),
      polls: meeting.polls.map((poll) => ({
        ...poll,
        options: poll.options.map((option) => ({ ...option })),
        votes: poll.votes.map((vote) => ({ ...vote }))
      })),
      decisions: meeting.decisions.map(({ ledgerReference: _ledgerReference, ...decision }) => ({
        ...decision,
        responsiblePersonIds: [...decision.responsiblePersonIds]
      })),
      tasks: meeting.tasks.map((task) => ({ ...task })),
      collaboration: meeting.collaboration.map((item) => ({ ...item })),
      minutes: {
        ...meeting.minutes,
        participantAccessPersonIds: [...meeting.minutes.participantAccessPersonIds],
        selectedRecordingSegmentIds: [...meeting.minutes.selectedRecordingSegmentIds]
      },
      revision: meeting.revision,
      createdAt: meeting.createdAt,
      updatedAt: meeting.updatedAt
    })),
    truth: { ...center.truth },
    generatedAt: center.generatedAt
  };
};

export const projectFamilyMeetingMinutesIpcView = (
  minutes: FamilyMeetingMinutesContentView
): FamilyMeetingMinutesIpcView => ({
  ...minutes,
  decisions: [...minutes.decisions],
  tasks: [...minutes.tasks],
  participantAccessPersonIds: [...minutes.participantAccessPersonIds],
  selectedRecordingSegmentIds: [...minutes.selectedRecordingSegmentIds]
});

export const projectFamilyMeetingMutationIpcView = (
  result: FamilyMeetingMutationReceiptView,
  expectedMutationKind: FamilyMeetingMutationKind
): FamilyMeetingMutationIpcView => {
  if (result.resourceType !== 'family_meeting' || result.mutationKind !== expectedMutationKind) {
    throw new Error('Family meeting mutation receipt does not match its main IPC operation.');
  }
  return {
    meetingId: result.resourceId,
    mutationKind: result.mutationKind,
    previousRevision: result.previousRevision,
    revision: result.revision,
    occurredAt: result.occurredAt,
    replayed: result.replayed,
    encryptedMinutesPackageWritten: result.encryptedMinutesPackageWritten,
    aiProviderConfigured: false,
    networkUsed: false,
    cloudUsed: false
  };
};

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
    readonly encryptedFullTextIndexAvailable: true;
    readonly policyFilteredSearchRequired: true;
    readonly snippetMaskingEnforced: true;
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

export interface LocalGovernedOcrSearchIpcView {
  readonly schemaVersion: 1;
  readonly matches: readonly {
    readonly jobId: string;
    readonly revision: number;
    readonly snippet: string;
    readonly snippetMasked: true;
    readonly matchedTokenCount: number;
    readonly pageNumber: number | null;
    readonly corrected: boolean;
    readonly networkUsed: false;
    readonly cloudUsed: false;
  }[];
  readonly truncated: boolean;
  readonly policyFiltered: true;
  readonly encryptedIndexAtRest: true;
  readonly snippetsMasked: true;
  readonly queryEchoed: false;
  readonly networkUsed: false;
  readonly cloudUsed: false;
  readonly generatedAt: string;
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

export interface LocalGovernedOcrSearchIpcInput {
  readonly query: string;
  readonly limit?: number;
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
      encryptedFullTextIndexAvailable: center.truth.encryptedFullTextIndexAvailable,
      policyFilteredSearchRequired: center.truth.policyFilteredSearchRequired,
      snippetMaskingEnforced: center.truth.snippetMaskingEnforced,
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

export const projectLocalGovernedOcrSearchIpcView = (
  result: LocalGovernedOcrSearchView
): LocalGovernedOcrSearchIpcView => ({
  schemaVersion: 1,
  matches: result.matches.map((match) => ({
    jobId: match.jobId,
    revision: match.revision,
    snippet: match.snippet,
    snippetMasked: true,
    matchedTokenCount: match.matchedTokenCount,
    pageNumber: match.pageNumber,
    corrected: match.corrected,
    networkUsed: false,
    cloudUsed: false
  })),
  truncated: result.truncated,
  policyFiltered: true,
  encryptedIndexAtRest: true,
  snippetsMasked: true,
  queryEchoed: false,
  networkUsed: false,
  cloudUsed: false,
  generatedAt: result.generatedAt
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
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === 'symbol')) return rejected('SYMBOL_FIELD_PROHIBITED', '$[0]');
  for (const key of ownKeys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || descriptor.get || descriptor.set || !('value' in descriptor)) {
      return rejected('ACCESSOR_FIELD_PROHIBITED', `$[0].${key}`);
    }
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
      return rejected('PROTOTYPE_FIELD_PROHIBITED', `$[0].${key}`);
    }
  }
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

export const UNIFIED_AUTHORIZED_SEARCH_IPC_CHANNEL = 'unifiedSearch:search' as const;
const unifiedAuthorizedSearchModules = new Set<unknown>(UNIFIED_AUTHORIZED_SEARCH_MODULES);

const unifiedAuthorizedSearchInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (args.length !== 1 || !isObject(args[0])) return rejected('UNIFIED_SEARCH_OBJECT_REQUIRED', '$[0]');
  const input = args[0];
  if (!hasOnlyKeys(input, ['query', 'limit', 'modules']) || Object.keys(input).length < 1) {
    return rejected('UNIFIED_SEARCH_UNKNOWN_FIELD', '$[0]');
  }
  if (canonicalUnifiedAuthorizedSearchTokens(input.query) === null
    || !optionalInteger(input.limit, 1, UNIFIED_AUTHORIZED_SEARCH_MAX_RESULTS)) {
    return rejected('UNIFIED_SEARCH_ARGUMENT_INVALID', '$[0]');
  }
  if (input.modules === undefined) return accepted();
  if (!Array.isArray(input.modules) || Object.getPrototypeOf(input.modules) !== Array.prototype
    || input.modules.length < 1 || input.modules.length > UNIFIED_AUTHORIZED_SEARCH_MODULES.length
    || input.modules.some((module) => !unifiedAuthorizedSearchModules.has(module))
    || new Set(input.modules).size !== input.modules.length) {
    return rejected('UNIFIED_SEARCH_MODULES_INVALID', '$[0].modules');
  }
  return accepted();
};

const unifiedAuthorizedSearchResult = (result: unknown): IpcIntegrationPolicyDecision => {
  if (!exactNested(result, [
    'schemaVersion', 'items', 'searchedModules', 'truncated', 'policyFiltered', 'complete',
    'queryEchoed', 'generatedAt'
  ]) || result.schemaVersion !== 1 || result.policyFiltered !== true || result.complete !== true
    || result.queryEchoed !== false || typeof result.truncated !== 'boolean' || !privacyIso(result.generatedAt)) {
    return rejected('UNIFIED_SEARCH_RESULT_INVALID', '$result');
  }
  if (!Array.isArray(result.searchedModules) || Object.getPrototypeOf(result.searchedModules) !== Array.prototype
    || result.searchedModules.length < 1 || result.searchedModules.length > UNIFIED_AUTHORIZED_SEARCH_MODULES.length
    || result.searchedModules.some((module) => !unifiedAuthorizedSearchModules.has(module))
    || new Set(result.searchedModules).size !== result.searchedModules.length) {
    return rejected('UNIFIED_SEARCH_RESULT_MODULES_INVALID', '$result.searchedModules');
  }
  if (!Array.isArray(result.items) || Object.getPrototypeOf(result.items) !== Array.prototype
    || result.items.length > UNIFIED_AUTHORIZED_SEARCH_MAX_RESULTS) {
    return rejected('UNIFIED_SEARCH_RESULT_ITEMS_INVALID', '$result.items');
  }
  const selected = new Set(result.searchedModules);
  for (let index = 0; index < result.items.length; index += 1) {
    const item = result.items[index];
    const keys = isObject(item) && item.occurredAt === undefined
      ? ['module', 'resourceType', 'resourceId', 'title']
      : ['module', 'resourceType', 'resourceId', 'title', 'occurredAt'];
    if (!exactNested(item, keys) || !unifiedAuthorizedSearchModules.has(item.module)
      || !selected.has(item.module) || !privacyId(item.resourceId)
      || typeof item.title !== 'string' || item.title !== item.title.trim()
      || item.title.length < 1 || item.title.length > 240 || /[\p{Cc}\p{Cs}]/u.test(item.title)
      || (item.occurredAt !== undefined && !privacyIso(item.occurredAt))
      || item.resourceType !== unifiedAuthorizedSearchResourceTypeForModule(item.module as UnifiedAuthorizedSearchModule)) {
      return rejected('UNIFIED_SEARCH_RESULT_ITEM_INVALID', `$result.items[${index}]`);
    }
  }
  return accepted();
};

export const HEALTH_CARE_COORDINATION_IPC_CHANNELS = Object.freeze({
  getCenter: 'healthCare:getCenter',
  recordEntry: 'healthCare:recordEntry',
  upsertGrant: 'healthCare:upsertGrant',
  revokeGrant: 'healthCare:revokeGrant'
} as const);
const healthCareCoordinationChannels = new Set<string>(Object.values(HEALTH_CARE_COORDINATION_IPC_CHANNELS));
const healthCareWriteChannels = new Set<string>([
  HEALTH_CARE_COORDINATION_IPC_CHANNELS.recordEntry,
  HEALTH_CARE_COORDINATION_IPC_CHANNELS.upsertGrant,
  HEALTH_CARE_COORDINATION_IPC_CHANNELS.revokeGrant
]);
const healthCareEntryKinds = new Set<unknown>([
  'allergy','chronic_condition','blood_type','vaccine','appointment','document_link','care_plan','care_task',
  'medication_confirmation','transport','caregiver_shift','handover_note','blood_pressure','blood_glucose',
  'weight','nutrition','hydration','wellbeing_check','help_request','fall_observation','emergency_observation','contact_action'
]);
const healthCareScopes = new Set<unknown>([
  'emergency_summary','care_plan','medication','appointments','measurements','check_ins','alerts','contacts','documents'
]);
const healthCareStatuses = new Set<unknown>([
  'active','scheduled','completed','cancelled','needs_help','observed','not_performed'
]);
const healthCareIdentifier = (value: unknown): value is string => typeof value === 'string'
  && value === value.trim() && value.length >= 2 && value.length <= 160
  && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value);
const healthCareIso = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  && Number.isFinite(Date.parse(value));
const healthCareRevision = (value: unknown): value is number => typeof value === 'number'
  && Number.isSafeInteger(value) && value >= 0;
const healthCareText = (value: unknown, minimum: number, maximum: number): value is string =>
  typeof value === 'string' && value === value.normalize('NFKC') && value.trim() === value
  && value.length >= minimum && value.length <= maximum && !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value);
const healthCareExactRecord = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => {
  if (!isObject(value)) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some((key) => typeof key === 'symbol')) return false;
  const allowed = new Set(keys);
  return (ownKeys as string[]).every((key) => {
    if (!allowed.has(key) || key === '__proto__' || key === 'prototype' || key === 'constructor') return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return Boolean(descriptor && !descriptor.get && !descriptor.set && 'value' in descriptor);
  });
};

const appInfoResult = (result: unknown): boolean => healthCareExactRecord(result, [
  'name', 'releaseLabel', 'channel', 'stage'
])
  && healthCareText(result.name, 2, 160)
  && healthCareText(result.releaseLabel, 2, 120)
  && (result.channel === 'Bronze' || result.channel === 'Silver' || result.channel === 'Gold')
  && healthCareText(result.stage, 2, 160);

const appLocalizationResult = (result: unknown): boolean => {
  if (!healthCareExactRecord(result, [
    'source', 'preference', 'systemLocale', 'language', 'locale', 'fallbackUsed', 'supportedLanguages'
  ])
    || (result.preference !== 'system' && result.preference !== 'tr' && result.preference !== 'en')
    || (result.source !== 'system' && result.source !== 'user')
    || !boundedString(result.systemLocale, 128)
    || (result.language !== 'tr' && result.language !== 'en')
    || (result.locale !== 'tr-TR' && result.locale !== 'en-US')
    || typeof result.fallbackUsed !== 'boolean'
    || !Array.isArray(result.supportedLanguages)
    || Object.getPrototypeOf(result.supportedLanguages) !== Array.prototype
    || result.supportedLanguages.length !== 2
    || result.supportedLanguages[0] !== 'tr'
    || result.supportedLanguages[1] !== 'en') return false;

  if (result.source !== (result.preference === 'system' ? 'system' : 'user')) return false;
  if (result.locale !== (result.language === 'tr' ? 'tr-TR' : 'en-US')) return false;
  if (result.preference !== 'system') {
    return result.language === result.preference && result.fallbackUsed === false;
  }
  const primaryLanguage = String(result.systemLocale).split('-')[0]?.toLocaleLowerCase('en-US') ?? '';
  return result.language === (primaryLanguage === 'tr' ? 'tr' : 'en')
    && result.fallbackUsed === (primaryLanguage !== 'tr' && primaryLanguage !== 'en');
};
const healthCareCanonicalValues = (
  value: unknown,
  allowed: ReadonlySet<unknown>,
  minimum: number,
  maximum: number
): value is readonly string[] => Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype
  && value.length >= minimum && value.length <= maximum
  && value.every((item) => typeof item === 'string' && allowed.has(item))
  && new Set(value).size === value.length;
const healthCareMeasurement = (value: unknown, bloodPressure: boolean): boolean =>
  healthCareExactRecord(value, bloodPressure ? ['value','secondaryValue','unit'] : ['value','unit'])
  && typeof value.value === 'number' && Number.isFinite(value.value) && value.value >= 0 && value.value <= 1_000_000_000
  && (!bloodPressure || (typeof value.secondaryValue === 'number' && Number.isFinite(value.secondaryValue)
    && value.secondaryValue >= 0 && value.secondaryValue <= 1_000_000_000))
  && healthCareText(value.unit, 1, 32);
const healthCareMutationInput = (value: Record<string, unknown>): boolean =>
  healthCareIdentifier(value.ownerPersonId) && healthCareRevision(value.expectedRevision)
  && healthCareIdentifier(value.clientOperationId);
const healthCareInput = (channel: string, args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (args.length !== 1 || !isObject(args[0])) return rejected('HEALTH_CARE_OBJECT_REQUIRED', '$[0]');
  const input = args[0];
  if (channel === HEALTH_CARE_COORDINATION_IPC_CHANNELS.getCenter) {
    return healthCareExactRecord(input, ['ownerPersonId']) && healthCareIdentifier(input.ownerPersonId)
      ? accepted() : rejected('HEALTH_CARE_CENTER_INPUT_INVALID', '$[0]');
  }
  if (channel === HEALTH_CARE_COORDINATION_IPC_CHANNELS.recordEntry) {
    const optionalKeys = [
      ...(input.scheduledAt === undefined ? [] : ['scheduledAt']),
      ...(input.note === undefined ? [] : ['note']),
      ...(input.measurement === undefined ? [] : ['measurement']),
      ...(input.relatedHealthRecordId === undefined ? [] : ['relatedHealthRecordId']),
      ...(input.relatedMedicationPlanId === undefined ? [] : ['relatedMedicationPlanId']),
      ...(input.relatedArchiveItemId === undefined ? [] : ['relatedArchiveItemId'])
    ];
    const keys = ['ownerPersonId','expectedRevision','clientOperationId','kind','title','status','occurredAt',...optionalKeys];
    if (!healthCareExactRecord(input, keys) || !healthCareMutationInput(input)
      || !healthCareEntryKinds.has(input.kind) || !healthCareText(input.title, 2, 160)
      || !healthCareStatuses.has(input.status) || !healthCareIso(input.occurredAt)
      || (input.scheduledAt !== undefined && !healthCareIso(input.scheduledAt))
      || (input.note !== undefined && !healthCareText(input.note, 1, 4_096))
      || (input.relatedHealthRecordId !== undefined && !healthCareIdentifier(input.relatedHealthRecordId))
      || (input.relatedMedicationPlanId !== undefined && !healthCareIdentifier(input.relatedMedicationPlanId))
      || (input.relatedArchiveItemId !== undefined && !healthCareIdentifier(input.relatedArchiveItemId))) {
      return rejected('HEALTH_CARE_ENTRY_INPUT_INVALID', '$[0]');
    }
    const measurementKind = ['blood_pressure','blood_glucose','weight','nutrition','hydration'].includes(String(input.kind));
    const measurementValid = measurementKind
      ? healthCareMeasurement(input.measurement, input.kind === 'blood_pressure')
      : input.measurement === undefined;
    return measurementValid ? accepted() : rejected('HEALTH_CARE_MEASUREMENT_INPUT_INVALID', '$[0].measurement');
  }
  if (channel === HEALTH_CARE_COORDINATION_IPC_CHANNELS.upsertGrant) {
    const keys = input.endsAt === undefined
      ? ['ownerPersonId','expectedRevision','clientOperationId','grantId','caregiverAccountId','allowedScopes','actions','startsAt']
      : ['ownerPersonId','expectedRevision','clientOperationId','grantId','caregiverAccountId','allowedScopes','actions','startsAt','endsAt'];
    const valid = healthCareExactRecord(input, keys) && healthCareMutationInput(input)
      && healthCareIdentifier(input.grantId) && healthCareIdentifier(input.caregiverAccountId)
      && healthCareCanonicalValues(input.allowedScopes, healthCareScopes, 1, 9)
      && healthCareCanonicalValues(input.actions, new Set(['read','record']), 1, 2)
      && input.actions.includes('read') && healthCareIso(input.startsAt)
      && (input.endsAt === undefined || (healthCareIso(input.endsAt) && Date.parse(input.endsAt) >= Date.parse(input.startsAt)));
    return valid ? accepted() : rejected('HEALTH_CARE_GRANT_INPUT_INVALID', '$[0]');
  }
  if (channel === HEALTH_CARE_COORDINATION_IPC_CHANNELS.revokeGrant) {
    return healthCareExactRecord(input, ['ownerPersonId','expectedRevision','clientOperationId','grantId'])
      && healthCareMutationInput(input) && healthCareIdentifier(input.grantId)
      ? accepted() : rejected('HEALTH_CARE_GRANT_REVOKE_INPUT_INVALID', '$[0]');
  }
  return rejected('UNKNOWN_IPC_CHANNEL', '$');
};
const healthCareEntryResult = (value: unknown): boolean => {
  if (!isObject(value)) return false;
  const optionalKeys = [
    ...(value.scheduledAt === undefined ? [] : ['scheduledAt']),
    ...(value.note === undefined ? [] : ['note']),
    ...(value.measurement === undefined ? [] : ['measurement']),
    ...(value.relatedHealthRecordId === undefined ? [] : ['relatedHealthRecordId']),
    ...(value.relatedMedicationPlanId === undefined ? [] : ['relatedMedicationPlanId']),
    ...(value.relatedArchiveItemId === undefined ? [] : ['relatedArchiveItemId'])
  ];
  const keys = ['id','centerId','ownerPersonId','kind','accessScope','title','status','occurredAt','recordedBy','source','createdAt',...optionalKeys];
  return healthCareExactRecord(value, keys) && healthCareIdentifier(value.id) && healthCareIdentifier(value.centerId)
    && healthCareIdentifier(value.ownerPersonId) && healthCareEntryKinds.has(value.kind) && healthCareScopes.has(value.accessScope)
    && healthCareText(value.title, 2, 160) && healthCareStatuses.has(value.status) && healthCareIso(value.occurredAt)
    && (value.scheduledAt === undefined || healthCareIso(value.scheduledAt))
    && (value.note === undefined || healthCareText(value.note, 1, 4_096))
    && (value.measurement === undefined || healthCareMeasurement(value.measurement, value.kind === 'blood_pressure'))
    && (value.relatedHealthRecordId === undefined || healthCareIdentifier(value.relatedHealthRecordId))
    && (value.relatedMedicationPlanId === undefined || healthCareIdentifier(value.relatedMedicationPlanId))
    && (value.relatedArchiveItemId === undefined || healthCareIdentifier(value.relatedArchiveItemId))
    && (value.recordedBy === 'owner' || value.recordedBy === 'caregiver' || value.recordedBy === 'family_admin')
    && value.source === 'manual_local' && healthCareIso(value.createdAt);
};
const healthCareGrantResult = (value: unknown): boolean => {
  if (!isObject(value)) return false;
  const optionalKeys = [
    ...(value.endsAt === undefined ? [] : ['endsAt']),
    ...(value.revokedAt === undefined ? [] : ['revokedAt'])
  ];
  return healthCareExactRecord(value, [
    'id','centerId','ownerPersonId','caregiverAccountId','caregiverPersonId','allowedScopes','actions',
    'state','startsAt','revision','createdAt','updatedAt',...optionalKeys
  ]) && healthCareIdentifier(value.id) && healthCareIdentifier(value.centerId) && healthCareIdentifier(value.ownerPersonId)
    && healthCareIdentifier(value.caregiverAccountId) && healthCareIdentifier(value.caregiverPersonId)
    && healthCareCanonicalValues(value.allowedScopes, healthCareScopes, 1, 9)
    && healthCareCanonicalValues(value.actions, new Set(['read','record']), 1, 2)
    && (value.state === 'active' || value.state === 'revoked') && healthCareIso(value.startsAt)
    && (value.endsAt === undefined || healthCareIso(value.endsAt)) && healthCareRevision(value.revision) && value.revision >= 1
    && healthCareIso(value.createdAt) && healthCareIso(value.updatedAt)
    && ((value.state === 'active' && value.revokedAt === undefined) || (value.state === 'revoked' && healthCareIso(value.revokedAt)));
};
const healthCareCenterResult = (value: unknown): boolean => {
  if (!healthCareExactRecord(value, [
    'schemaVersion','centerId','ownerPersonId','revision','entries','caregiverGrants','emergencySummary',
    'visibleScopes','canRecord','truncated','truth','generatedAt'
  ]) || value.schemaVersion !== 1 || !healthCareIdentifier(value.centerId) || !healthCareIdentifier(value.ownerPersonId)
    || !healthCareRevision(value.revision) || !Array.isArray(value.entries) || value.entries.length > 500
    || !value.entries.every(healthCareEntryResult) || !Array.isArray(value.caregiverGrants) || value.caregiverGrants.length > 256
    || !value.caregiverGrants.every(healthCareGrantResult)
    || !healthCareCanonicalValues(value.visibleScopes, healthCareScopes, 1, 9)
    || typeof value.canRecord !== 'boolean' || typeof value.truncated !== 'boolean' || !healthCareIso(value.generatedAt)) return false;
  const summary = value.emergencySummary;
  const summaryKeys = isObject(summary) && summary.bloodType === undefined
    ? ['allergies','chronicConditions','activeMedicationConfirmations']
    : ['allergies','chronicConditions','bloodType','activeMedicationConfirmations'];
  if (!healthCareExactRecord(summary, summaryKeys)
    || !Array.isArray(summary.allergies) || !summary.allergies.every(healthCareEntryResult)
    || !Array.isArray(summary.chronicConditions) || !summary.chronicConditions.every(healthCareEntryResult)
    || !(summary.bloodType === undefined || healthCareEntryResult(summary.bloodType))
    || !Array.isArray(summary.activeMedicationConfirmations) || !summary.activeMedicationConfirmations.every(healthCareEntryResult)) return false;
  return healthCareExactRecord(value.truth, [
    'localOnly','medicalVerification','healthRegistryLookup','sensorIntegration','helpDelivery',
    'emergencyServiceContact','remoteAssistance','minimumNecessaryFiltered','largeTextPresentationAvailable'
  ]) && value.truth.localOnly === true && value.truth.medicalVerification === 'not_performed'
    && value.truth.healthRegistryLookup === 'not_performed' && value.truth.sensorIntegration === 'not_configured'
    && value.truth.helpDelivery === 'not_performed' && value.truth.emergencyServiceContact === 'not_performed'
    && value.truth.remoteAssistance === 'not_configured' && value.truth.minimumNecessaryFiltered === true
    && value.truth.largeTextPresentationAvailable === true;
};
const healthCareReceiptResult = (value: unknown): boolean => healthCareExactRecord(value, [
  'centerId','mutationKind','previousRevision','revision','occurredAt','replayed','localOnly','externalDelivery'
]) && healthCareIdentifier(value.centerId)
  && (value.mutationKind === 'entry_record' || value.mutationKind === 'grant_upsert' || value.mutationKind === 'grant_revoke')
  && healthCareRevision(value.previousRevision) && healthCareRevision(value.revision)
  && value.revision === value.previousRevision + 1 && healthCareIso(value.occurredAt)
  && typeof value.replayed === 'boolean' && value.localOnly === true && value.externalDelivery === 'not_performed';
const healthCareResult = (channel: string, result: unknown): IpcIntegrationPolicyDecision => {
  const valid = channel === HEALTH_CARE_COORDINATION_IPC_CHANNELS.getCenter
    ? healthCareCenterResult(result)
    : healthCareWriteChannels.has(channel) && healthCareReceiptResult(result);
  return valid ? accepted() : rejected('HEALTH_CARE_RESULT_INVALID', '$result');
};

export const HOUSEHOLD_OPERATIONS_IPC_CHANNELS = Object.freeze({
  getCenter: 'householdOperations:getCenter',
  createItem: 'householdOperations:createItem',
  updateItem: 'householdOperations:updateItem',
  deleteItem: 'householdOperations:deleteItem'
} as const);
const householdOperationsChannels = new Set<string>(Object.values(HOUSEHOLD_OPERATIONS_IPC_CHANNELS));
const householdOperationWriteChannels = new Set<string>([
  HOUSEHOLD_OPERATIONS_IPC_CHANNELS.createItem,
  HOUSEHOLD_OPERATIONS_IPC_CHANNELS.updateItem,
  HOUSEHOLD_OPERATIONS_IPC_CHANNELS.deleteItem
]);
const householdKinds = new Set<unknown>([
  'shopping_list','shopping_item','stock_item','recipe','meal_plan','chore','routine',
  'bill','subscription','shared_expense','delivery','guest_access','pet_care'
]);
const householdAreas = new Set<unknown>(['shopping','inventory','meals','chores','expenses','deliveries','guests','pets']);
const householdStatuses = new Set<unknown>([
  'planned','active','low_stock','due','completed','cancelled','expired','delivered','revoked','deleted'
]);
const householdMutableStatuses = new Set<unknown>([...householdStatuses].filter((value) => value !== 'deleted'));
const householdArray = (
  value: unknown,
  maximum: number,
  validator: (item: unknown) => boolean
): boolean => Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype
  && value.length <= maximum && value.every(validator);
const householdTextArray = (value: unknown, maximum: number): boolean => householdArray(
  value,
  maximum,
  (item) => healthCareText(item, 1, 80)
) && new Set(value as readonly unknown[]).size === (value as readonly unknown[]).length;
const householdShares = (value: unknown): boolean => householdArray(value, 64, (item) =>
  healthCareExactRecord(item, ['personId','basisPoints']) && healthCareIdentifier(item.personId)
  && typeof item.basisPoints === 'number' && Number.isSafeInteger(item.basisPoints)
  && item.basisPoints >= 1 && item.basisPoints <= 10_000)
  && (value as readonly Record<string, unknown>[]).length >= 2
  && new Set((value as readonly Record<string, unknown>[]).map((item) => item.personId)).size === (value as readonly unknown[]).length
  && (value as readonly Record<string, unknown>[]).reduce((total, item) => total + Number(item.basisPoints), 0) === 10_000;
const householdCreateInput = (value: Record<string, unknown>): boolean => {
  const optional = [
    'status','parentItemId','assignedPersonId','stockCategory','quantity','unit','scheduledAt','dueAt','expiresAt',
    'recurrence','amountMinor','currency','splitShares','ingredientNames','allergenCodes','avoidedAllergenCodes',
    'providerLabel','trackingLastFour','guestLabel','accessArea','opaquePetReference','note'
  ].filter((key) => value[key] !== undefined);
  if (!healthCareExactRecord(value, [
    'expectedCenterRevision','clientOperationId','itemId','kind','title',...optional
  ]) || !healthCareRevision(value.expectedCenterRevision) || !healthCareIdentifier(value.clientOperationId)
    || !healthCareIdentifier(value.itemId) || !householdKinds.has(value.kind) || !healthCareText(value.title, 2, 160)
    || (value.status !== undefined && !householdMutableStatuses.has(value.status))
    || (value.parentItemId !== undefined && !healthCareIdentifier(value.parentItemId))
    || (value.assignedPersonId !== undefined && !healthCareIdentifier(value.assignedPersonId))
    || (value.stockCategory !== undefined && value.stockCategory !== 'food' && value.stockCategory !== 'cleaning')
    || (value.quantity !== undefined && (typeof value.quantity !== 'number' || !Number.isFinite(value.quantity) || value.quantity < 0 || value.quantity > 1_000_000_000))
    || (value.unit !== undefined && !healthCareText(value.unit, 1, 32))
    || (value.scheduledAt !== undefined && !healthCareIso(value.scheduledAt))
    || (value.dueAt !== undefined && !healthCareIso(value.dueAt))
    || (value.expiresAt !== undefined && !healthCareIso(value.expiresAt))
    || (value.recurrence !== undefined && !healthCareText(value.recurrence, 1, 160))
    || (value.amountMinor !== undefined && (typeof value.amountMinor !== 'number' || !Number.isSafeInteger(value.amountMinor) || value.amountMinor < 0 || value.amountMinor > 9_000_000_000_000_000))
    || (value.currency !== undefined && (typeof value.currency !== 'string' || !/^[A-Z]{3}$/u.test(value.currency)))
    || (value.splitShares !== undefined && !householdShares(value.splitShares))
    || (value.ingredientNames !== undefined && !householdTextArray(value.ingredientNames, 128))
    || (value.allergenCodes !== undefined && !householdTextArray(value.allergenCodes, 64))
    || (value.avoidedAllergenCodes !== undefined && !householdTextArray(value.avoidedAllergenCodes, 64))
    || (value.providerLabel !== undefined && !healthCareText(value.providerLabel, 1, 120))
    || (value.trackingLastFour !== undefined && (typeof value.trackingLastFour !== 'string' || !/^[A-Za-z0-9]{4}$/u.test(value.trackingLastFour)))
    || (value.guestLabel !== undefined && !healthCareText(value.guestLabel, 1, 120))
    || (value.accessArea !== undefined && !healthCareText(value.accessArea, 1, 120))
    || (value.opaquePetReference !== undefined && !healthCareText(value.opaquePetReference, 1, 128))
    || (value.note !== undefined && !healthCareText(value.note, 1, 2_000))) return false;
  if (value.scheduledAt !== undefined && value.dueAt !== undefined
    && Date.parse(String(value.dueAt)) < Date.parse(String(value.scheduledAt))) return false;
  if (value.kind === 'shopping_item' && value.parentItemId === undefined) return false;
  if (value.kind === 'stock_item' && (value.stockCategory === undefined || value.quantity === undefined
    || value.unit === undefined || (value.stockCategory === 'food' && value.expiresAt === undefined))) return false;
  if (value.kind === 'recipe' && (!Array.isArray(value.ingredientNames) || value.ingredientNames.length === 0)) return false;
  if (value.kind === 'meal_plan' && (value.parentItemId === undefined || value.scheduledAt === undefined)) return false;
  if ((value.kind === 'chore' || value.kind === 'routine') && value.assignedPersonId === undefined) return false;
  if (value.kind === 'routine' && value.recurrence === undefined) return false;
  if ((value.kind === 'bill' || value.kind === 'subscription')
    && (value.amountMinor === undefined || value.currency === undefined || value.dueAt === undefined)) return false;
  if (value.kind === 'subscription' && value.recurrence === undefined) return false;
  if (value.kind === 'shared_expense'
    && (value.amountMinor === undefined || value.currency === undefined || value.splitShares === undefined)) return false;
  if (value.kind === 'delivery' && (value.providerLabel === undefined || value.trackingLastFour === undefined)) return false;
  if (value.kind === 'guest_access' && (value.guestLabel === undefined || value.accessArea === undefined
    || value.scheduledAt === undefined || value.dueAt === undefined)) return false;
  if (value.kind === 'pet_care' && (value.opaquePetReference === undefined || value.dueAt === undefined)) return false;
  return true;
};
const householdUpdateInput = (value: Record<string, unknown>): boolean => {
  const optional = ['status','assignedPersonId','quantity','scheduledAt','dueAt','expiresAt','note']
    .filter((key) => value[key] !== undefined);
  return optional.length >= 1 && healthCareExactRecord(value, [
    'expectedCenterRevision','expectedItemRevision','clientOperationId','itemId',...optional
  ]) && healthCareRevision(value.expectedCenterRevision) && healthCareRevision(value.expectedItemRevision)
    && Number(value.expectedItemRevision) >= 1 && healthCareIdentifier(value.clientOperationId) && healthCareIdentifier(value.itemId)
    && (value.status === undefined || householdMutableStatuses.has(value.status))
    && (value.assignedPersonId === undefined || value.assignedPersonId === null || healthCareIdentifier(value.assignedPersonId))
    && (value.quantity === undefined || (typeof value.quantity === 'number' && Number.isFinite(value.quantity) && value.quantity >= 0 && value.quantity <= 1_000_000_000))
    && (value.scheduledAt === undefined || value.scheduledAt === null || healthCareIso(value.scheduledAt))
    && (value.dueAt === undefined || value.dueAt === null || healthCareIso(value.dueAt))
    && (value.expiresAt === undefined || value.expiresAt === null || healthCareIso(value.expiresAt))
    && (value.note === undefined || value.note === null || healthCareText(value.note, 1, 2_000));
};
const householdInput = (channel: string, args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (channel === HOUSEHOLD_OPERATIONS_IPC_CHANNELS.getCenter) {
    return args.length === 0 ? accepted() : rejected('HOUSEHOLD_OPERATIONS_ZERO_ARGUMENTS_REQUIRED', '$');
  }
  if (args.length !== 1 || !isObject(args[0])) return rejected('HOUSEHOLD_OPERATIONS_OBJECT_REQUIRED', '$[0]');
  const value = args[0];
  if (channel === HOUSEHOLD_OPERATIONS_IPC_CHANNELS.createItem) {
    return householdCreateInput(value) ? accepted() : rejected('HOUSEHOLD_OPERATIONS_CREATE_INPUT_INVALID', '$[0]');
  }
  if (channel === HOUSEHOLD_OPERATIONS_IPC_CHANNELS.updateItem) {
    return householdUpdateInput(value) ? accepted() : rejected('HOUSEHOLD_OPERATIONS_UPDATE_INPUT_INVALID', '$[0]');
  }
  if (channel === HOUSEHOLD_OPERATIONS_IPC_CHANNELS.deleteItem) {
    return healthCareExactRecord(value, [
      'expectedCenterRevision','expectedItemRevision','clientOperationId','itemId','reason'
    ]) && healthCareRevision(value.expectedCenterRevision) && healthCareRevision(value.expectedItemRevision)
      && Number(value.expectedItemRevision) >= 1 && healthCareIdentifier(value.clientOperationId)
      && healthCareIdentifier(value.itemId) && healthCareText(value.reason, 3, 240)
      ? accepted() : rejected('HOUSEHOLD_OPERATIONS_DELETE_INPUT_INVALID', '$[0]');
  }
  return rejected('UNKNOWN_IPC_CHANNEL', '$');
};
const householdItemResult = (value: unknown): boolean => {
  if (!isObject(value)) return false;
  const optional = [
    'parentItemId','assignedPersonId','stockCategory','quantity','unit','scheduledAt','dueAt','expiresAt','recurrence',
    'amountMinor','currency','splitShares','ingredientNames','allergenCodes','avoidedAllergenCodes','allergyFilterStatus',
    'providerLabel','trackingLastFour','guestLabel','accessArea','opaquePetReference','note','deletedAt'
  ].filter((key) => value[key] !== undefined);
  return healthCareExactRecord(value, [
    'id','centerId','ownerPersonId','kind','area','title','status','revision','createdAt','updatedAt',...optional
  ]) && healthCareIdentifier(value.id) && healthCareIdentifier(value.centerId) && healthCareIdentifier(value.ownerPersonId)
    && householdKinds.has(value.kind) && householdAreas.has(value.area) && healthCareText(value.title, 2, 160)
    && householdStatuses.has(value.status) && healthCareRevision(value.revision) && Number(value.revision) >= 1
    && healthCareIso(value.createdAt) && healthCareIso(value.updatedAt)
    && (value.parentItemId === undefined || healthCareIdentifier(value.parentItemId))
    && (value.assignedPersonId === undefined || healthCareIdentifier(value.assignedPersonId))
    && (value.stockCategory === undefined || value.stockCategory === 'food' || value.stockCategory === 'cleaning')
    && (value.quantity === undefined || (typeof value.quantity === 'number' && Number.isFinite(value.quantity) && value.quantity >= 0))
    && (value.unit === undefined || healthCareText(value.unit, 1, 32))
    && (value.scheduledAt === undefined || healthCareIso(value.scheduledAt))
    && (value.dueAt === undefined || healthCareIso(value.dueAt))
    && (value.expiresAt === undefined || healthCareIso(value.expiresAt))
    && (value.recurrence === undefined || healthCareText(value.recurrence, 1, 160))
    && (value.amountMinor === undefined || (typeof value.amountMinor === 'number' && Number.isSafeInteger(value.amountMinor) && value.amountMinor >= 0))
    && (value.currency === undefined || (typeof value.currency === 'string' && /^[A-Z]{3}$/u.test(value.currency)))
    && (value.splitShares === undefined || householdShares(value.splitShares))
    && (value.ingredientNames === undefined || householdTextArray(value.ingredientNames, 128))
    && (value.allergenCodes === undefined || householdTextArray(value.allergenCodes, 64))
    && (value.avoidedAllergenCodes === undefined || householdTextArray(value.avoidedAllergenCodes, 64))
    && (value.allergyFilterStatus === undefined || value.allergyFilterStatus === 'not_applicable' || value.allergyFilterStatus === 'clear')
    && (value.providerLabel === undefined || healthCareText(value.providerLabel, 1, 120))
    && (value.trackingLastFour === undefined || (typeof value.trackingLastFour === 'string' && /^[A-Za-z0-9]{4}$/u.test(value.trackingLastFour)))
    && (value.guestLabel === undefined || healthCareText(value.guestLabel, 1, 120))
    && (value.accessArea === undefined || healthCareText(value.accessArea, 1, 120))
    && (value.opaquePetReference === undefined || healthCareText(value.opaquePetReference, 1, 128))
    && (value.note === undefined || healthCareText(value.note, 1, 2_000))
    && (value.deletedAt === undefined || healthCareIso(value.deletedAt));
};
const householdCenterResult = (value: unknown): boolean => healthCareExactRecord(value, [
  'schemaVersion','centerId','revision','items','countsByArea','truth','generatedAt'
]) && value.schemaVersion === 1 && healthCareIdentifier(value.centerId) && healthCareRevision(value.revision)
  && householdArray(value.items, 2_000, householdItemResult)
  && healthCareExactRecord(value.countsByArea, ['shopping','inventory','meals','chores','expenses','deliveries','guests','pets'])
  && Object.values(value.countsByArea).every((count) => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0)
  && healthCareExactRecord(value.truth, [
    'localOnly','externalShoppingOrder','automaticInventoryScan','recipeMedicalAdvice','paymentExecution',
    'carrierSynchronization','remoteAccessControl','keyCodeStored','petCareDelivery'
  ]) && value.truth.localOnly === true && value.truth.externalShoppingOrder === 'not_performed'
  && value.truth.automaticInventoryScan === 'not_configured' && value.truth.recipeMedicalAdvice === 'not_provided'
  && value.truth.paymentExecution === 'not_performed' && value.truth.carrierSynchronization === 'not_performed'
  && value.truth.remoteAccessControl === 'not_configured' && value.truth.keyCodeStored === false
  && value.truth.petCareDelivery === 'not_performed' && healthCareIso(value.generatedAt);
const householdReceiptResult = (value: unknown): boolean => healthCareExactRecord(value, [
  'centerId','itemId','mutationKind','previousCenterRevision','centerRevision','previousItemRevision',
  'itemRevision','occurredAt','replayed','localOnly','externalAction'
]) && healthCareIdentifier(value.centerId) && healthCareIdentifier(value.itemId)
  && (value.mutationKind === 'item_create' || value.mutationKind === 'item_update' || value.mutationKind === 'item_delete')
  && healthCareRevision(value.previousCenterRevision) && healthCareRevision(value.centerRevision)
  && value.centerRevision === Number(value.previousCenterRevision) + 1
  && healthCareRevision(value.previousItemRevision) && healthCareRevision(value.itemRevision)
  && value.itemRevision === Number(value.previousItemRevision) + 1 && healthCareIso(value.occurredAt)
  && typeof value.replayed === 'boolean' && value.localOnly === true && value.externalAction === 'not_performed';
const householdResult = (channel: string, result: unknown): IpcIntegrationPolicyDecision => {
  const valid = channel === HOUSEHOLD_OPERATIONS_IPC_CHANNELS.getCenter
    ? householdCenterResult(result)
    : householdOperationWriteChannels.has(channel) && householdReceiptResult(result);
  return valid ? accepted() : rejected('HOUSEHOLD_OPERATIONS_RESULT_INVALID', '$result');
};

export const CHILD_EDUCATION_COORDINATION_IPC_CHANNELS = Object.freeze({
  getCenter: 'childEducation:getCenter',
  createItem: 'childEducation:createItem',
  updateItem: 'childEducation:updateItem',
  deleteItem: 'childEducation:deleteItem'
} as const);
const childEducationChannels = new Set<string>(Object.values(CHILD_EDUCATION_COORDINATION_IPC_CHANNELS));
const childEducationWriteChannels = new Set<string>([
  CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.createItem,
  CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.updateItem,
  CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.deleteItem
]);
const childEducationKinds = new Set<unknown>([
  'school','class','timetable','homework','exam','school_event','transport_plan','pickup_authority',
  'course','sport','certificate','book','allowance_budget','education_goal'
]);
const childEducationAreas = new Set<unknown>(['schoolwork','events_access','activities','money_goals']);
const childEducationVisibilities = new Set<unknown>([
  'family_coordination','child_and_selected_guardians','adolescent_private'
]);
const childEducationPrivacyCodes = new Set<unknown>([
  'family_admin_coordination','owner_and_explicit_permission','adolescent_owner_private'
]);
const childEducationStatuses = new Set<unknown>([
  'planned','active','submitted','completed','cancelled','expired','archived','deleted'
]);
const childEducationMutableStatuses = new Set<unknown>([...childEducationStatuses].filter((value) => value !== 'deleted'));
const childEducationTransportModes = new Set<unknown>([
  'school_service','family_dropoff','public_transport','walking','other'
]);
const childEducationCreateInput = (value: Record<string, unknown>): boolean => {
  const optional = [
    'status','institutionLabel','classLabel','subjectLabel','scheduledAt','dueAt','recurrence','transportMode',
    'authorityReferenceId','amountMinor','currency','progressBasisPoints','note'
  ].filter((key) => value[key] !== undefined);
  if (!healthCareExactRecord(value, [
    'clientOperationId','itemId','childPersonId','kind','title','visibility',...optional
  ]) || !healthCareIdentifier(value.clientOperationId) || !healthCareIdentifier(value.itemId)
    || !healthCareIdentifier(value.childPersonId) || !childEducationKinds.has(value.kind)
    || !healthCareText(value.title, 2, 160) || !childEducationVisibilities.has(value.visibility)
    || (value.status !== undefined && !childEducationMutableStatuses.has(value.status))
    || (value.institutionLabel !== undefined && !healthCareText(value.institutionLabel, 1, 120))
    || (value.classLabel !== undefined && !healthCareText(value.classLabel, 1, 80))
    || (value.subjectLabel !== undefined && !healthCareText(value.subjectLabel, 1, 80))
    || (value.scheduledAt !== undefined && !healthCareIso(value.scheduledAt))
    || (value.dueAt !== undefined && !healthCareIso(value.dueAt))
    || (value.recurrence !== undefined && !healthCareText(value.recurrence, 1, 160))
    || (value.transportMode !== undefined && !childEducationTransportModes.has(value.transportMode))
    || (value.authorityReferenceId !== undefined && !healthCareText(value.authorityReferenceId, 1, 128))
    || (value.amountMinor !== undefined && (typeof value.amountMinor !== 'number' || !Number.isSafeInteger(value.amountMinor)
      || value.amountMinor < 0 || value.amountMinor > 9_000_000_000_000_000))
    || (value.currency !== undefined && (typeof value.currency !== 'string' || !/^[A-Z]{3}$/u.test(value.currency)))
    || (value.progressBasisPoints !== undefined && (typeof value.progressBasisPoints !== 'number'
      || !Number.isSafeInteger(value.progressBasisPoints) || value.progressBasisPoints < 0 || value.progressBasisPoints > 10_000))
    || (value.note !== undefined && !healthCareText(value.note, 1, 2_000))) return false;
  const institutionRequired = ['school','class','school_event','course','sport','certificate'].includes(String(value.kind));
  const subjectRequired = ['timetable','homework','exam'].includes(String(value.kind));
  const scheduleRequired = ['timetable','exam','school_event','transport_plan','pickup_authority','course','sport']
    .includes(String(value.kind));
  const dueRequired = value.kind === 'homework' || value.kind === 'pickup_authority';
  const moneyRequired = value.kind === 'allowance_budget';
  const goalRequired = value.kind === 'education_goal';
  return institutionRequired === (value.institutionLabel !== undefined)
    && subjectRequired === (value.subjectLabel !== undefined)
    && (value.kind === 'class') === (value.classLabel !== undefined)
    && (!scheduleRequired || value.scheduledAt !== undefined)
    && (!dueRequired || value.dueAt !== undefined)
    && (value.kind === 'transport_plan') === (value.transportMode !== undefined)
    && (value.kind === 'pickup_authority') === (value.authorityReferenceId !== undefined)
    && moneyRequired === (value.amountMinor !== undefined && value.currency !== undefined)
    && !((value.amountMinor === undefined) !== (value.currency === undefined))
    && goalRequired === (value.progressBasisPoints !== undefined)
    && !(typeof value.scheduledAt === 'string' && typeof value.dueAt === 'string' && value.dueAt < value.scheduledAt);
};
const childEducationUpdateInput = (value: Record<string, unknown>): boolean => {
  const optional = ['title','status','visibility','scheduledAt','dueAt','progressBasisPoints','note']
    .filter((key) => value[key] !== undefined);
  return optional.length >= 1 && healthCareExactRecord(value, [
    'clientOperationId','itemId','childPersonId','expectedRevision',...optional
  ]) && healthCareIdentifier(value.clientOperationId) && healthCareIdentifier(value.itemId)
    && healthCareIdentifier(value.childPersonId) && healthCareRevision(value.expectedRevision)
    && Number(value.expectedRevision) >= 1
    && (value.title === undefined || healthCareText(value.title, 2, 160))
    && (value.status === undefined || childEducationMutableStatuses.has(value.status))
    && (value.visibility === undefined || childEducationVisibilities.has(value.visibility))
    && (value.scheduledAt === undefined || value.scheduledAt === null || healthCareIso(value.scheduledAt))
    && (value.dueAt === undefined || value.dueAt === null || healthCareIso(value.dueAt))
    && (value.progressBasisPoints === undefined || value.progressBasisPoints === null
      || (typeof value.progressBasisPoints === 'number' && Number.isSafeInteger(value.progressBasisPoints)
        && value.progressBasisPoints >= 0 && value.progressBasisPoints <= 10_000))
    && (value.note === undefined || value.note === null || healthCareText(value.note, 1, 2_000));
};
const childEducationInput = (channel: string, args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (args.length !== 1 || !isObject(args[0])) return rejected('CHILD_EDUCATION_OBJECT_REQUIRED', '$[0]');
  const value = args[0];
  if (channel === CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.getCenter) {
    return healthCareExactRecord(value, ['childPersonId']) && healthCareIdentifier(value.childPersonId)
      ? accepted() : rejected('CHILD_EDUCATION_CENTER_INPUT_INVALID', '$[0]');
  }
  if (channel === CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.createItem) {
    return childEducationCreateInput(value) ? accepted() : rejected('CHILD_EDUCATION_CREATE_INPUT_INVALID', '$[0]');
  }
  if (channel === CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.updateItem) {
    return childEducationUpdateInput(value) ? accepted() : rejected('CHILD_EDUCATION_UPDATE_INPUT_INVALID', '$[0]');
  }
  if (channel === CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.deleteItem) {
    return healthCareExactRecord(value, ['clientOperationId','itemId','childPersonId','expectedRevision','reason'])
      && healthCareIdentifier(value.clientOperationId) && healthCareIdentifier(value.itemId)
      && healthCareIdentifier(value.childPersonId) && healthCareRevision(value.expectedRevision)
      && Number(value.expectedRevision) >= 1 && healthCareText(value.reason, 3, 240)
      ? accepted() : rejected('CHILD_EDUCATION_DELETE_INPUT_INVALID', '$[0]');
  }
  return rejected('UNKNOWN_IPC_CHANNEL', '$');
};
const childEducationItemResult = (value: unknown): boolean => {
  if (!isObject(value)) return false;
  const optional = [
    'institutionLabel','classLabel','subjectLabel','scheduledAt','dueAt','recurrence','transportMode',
    'authorityReferenceId','amountMinor','currency','progressBasisPoints','certificateStatus','note','deletedAt'
  ].filter((key) => value[key] !== undefined);
  return healthCareExactRecord(value, [
    'id','childPersonId','kind','area','title','status','visibility','privacyExplanationCode','revision',
    'createdAt','updatedAt',...optional
  ]) && healthCareIdentifier(value.id) && healthCareIdentifier(value.childPersonId)
    && childEducationKinds.has(value.kind) && childEducationAreas.has(value.area)
    && healthCareText(value.title, 2, 160) && childEducationStatuses.has(value.status)
    && childEducationVisibilities.has(value.visibility) && childEducationPrivacyCodes.has(value.privacyExplanationCode)
    && healthCareRevision(value.revision) && Number(value.revision) >= 1
    && (value.institutionLabel === undefined || healthCareText(value.institutionLabel, 1, 120))
    && (value.classLabel === undefined || healthCareText(value.classLabel, 1, 80))
    && (value.subjectLabel === undefined || healthCareText(value.subjectLabel, 1, 80))
    && (value.scheduledAt === undefined || healthCareIso(value.scheduledAt))
    && (value.dueAt === undefined || healthCareIso(value.dueAt))
    && (value.recurrence === undefined || healthCareText(value.recurrence, 1, 160))
    && (value.transportMode === undefined || childEducationTransportModes.has(value.transportMode))
    && (value.authorityReferenceId === undefined || healthCareText(value.authorityReferenceId, 1, 128))
    && (value.amountMinor === undefined || (typeof value.amountMinor === 'number' && Number.isSafeInteger(value.amountMinor) && value.amountMinor >= 0))
    && (value.currency === undefined || (typeof value.currency === 'string' && /^[A-Z]{3}$/u.test(value.currency)))
    && (value.progressBasisPoints === undefined || (typeof value.progressBasisPoints === 'number'
      && Number.isSafeInteger(value.progressBasisPoints) && value.progressBasisPoints >= 0 && value.progressBasisPoints <= 10_000))
    && (value.certificateStatus === undefined || value.certificateStatus === 'locally_recorded_unverified')
    && (value.note === undefined || healthCareText(value.note, 1, 2_000))
    && healthCareIso(value.createdAt) && healthCareIso(value.updatedAt)
    && (value.deletedAt === undefined || healthCareIso(value.deletedAt));
};
const childEducationCenterResult = (value: unknown): boolean => healthCareExactRecord(value, [
  'schemaVersion','centerId','childPersonId','ageBand','viewMode','items','countsByArea','truth','generatedAt'
]) && value.schemaVersion === 1 && healthCareIdentifier(value.centerId) && healthCareIdentifier(value.childPersonId)
  && (value.ageBand === 'under_13' || value.ageBand === 'teen')
  && (value.viewMode === 'guided_child' || value.viewMode === 'teen_standard')
  && householdArray(value.items, 1_000, childEducationItemResult)
  && healthCareExactRecord(value.countsByArea, ['schoolwork','events_access','activities','money_goals'])
  && Object.values(value.countsByArea).every((count) => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0)
  && healthCareExactRecord(value.truth, [
    'localOnly','childDataClassEnforced','aiProcessingAllowed','externalSharingAllowed','schoolPortalSync',
    'teacherMessaging','liveTransportTracking','pickupCredentialIssuance','allowancePaymentExecution',
    'certificateVerification','healthDataDuplicated','ageAppropriatePresentation'
  ]) && value.truth.localOnly === true && value.truth.childDataClassEnforced === true
  && value.truth.aiProcessingAllowed === false && value.truth.externalSharingAllowed === false
  && value.truth.schoolPortalSync === 'not_configured' && value.truth.teacherMessaging === 'not_performed'
  && value.truth.liveTransportTracking === 'not_performed'
  && value.truth.pickupCredentialIssuance === 'managed_separately_in_identity_center'
  && value.truth.allowancePaymentExecution === 'not_performed'
  && value.truth.certificateVerification === 'not_performed' && value.truth.healthDataDuplicated === false
  && value.truth.ageAppropriatePresentation === 'derived_from_local_birth_date' && healthCareIso(value.generatedAt);
const childEducationReceiptResult = (value: unknown): boolean => healthCareExactRecord(value, [
  'itemId','childPersonId','mutationKind','previousRevision','revision','occurredAt','replayed','localOnly','externalAction'
]) && healthCareIdentifier(value.itemId) && healthCareIdentifier(value.childPersonId)
  && (value.mutationKind === 'item_create' || value.mutationKind === 'item_update' || value.mutationKind === 'item_delete')
  && healthCareRevision(value.previousRevision) && healthCareRevision(value.revision)
  && value.revision === Number(value.previousRevision) + 1 && healthCareIso(value.occurredAt)
  && typeof value.replayed === 'boolean' && value.localOnly === true && value.externalAction === 'not_performed';
const childEducationResult = (channel: string, result: unknown): IpcIntegrationPolicyDecision => {
  const valid = channel === CHILD_EDUCATION_COORDINATION_IPC_CHANNELS.getCenter
    ? childEducationCenterResult(result)
    : childEducationWriteChannels.has(channel) && childEducationReceiptResult(result);
  return valid ? accepted() : rejected('CHILD_EDUCATION_RESULT_INVALID', '$result');
};

export const PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS = Object.freeze({
  getCenter:'placesTravel:getCenter',createItem:'placesTravel:createItem',
  updateItem:'placesTravel:updateItem',deleteItem:'placesTravel:deleteItem'
} as const);
const placesTravelChannels=new Set<string>(Object.values(PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS));
const placesTravelWriteChannels=new Set<string>([
  PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.createItem,PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.updateItem,
  PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.deleteItem
]);
const placesTravelKinds=new Set<unknown>(['stored_place','moving_inventory','pet_care_record','travel_plan','reservation',
  'travel_document','travel_budget','shared_expense','packing_item','travel_requirement','offline_travel_pack',
  'language_pack','travel_album','expense_settlement']);
const placesTravelAreas=new Set<unknown>(['places','moving','pet_care','travel']);
const placesTravelVisibilities=new Set<unknown>(['family_coordination','selected_members','private']);
const placesTravelStatuses=new Set<unknown>(['planned','active','completed','cancelled','expired','settled','deleted']);
const placesTravelMutableStatuses=new Set<unknown>([...placesTravelStatuses].filter((value)=>value!=='deleted'));
const placesTravelDocumentKinds=new Set<unknown>(['passport','visa','insurance','reservation_document','other']);
const placesTravelPetWorkflows=new Set<unknown>(['vaccination','veterinary','microchip','food','insurance','travel_document']);
const placesTravelRequirementKinds=new Set<unknown>(['health','medication','child','pet']);
const placesTravelParticipants=(value:unknown):boolean=>Array.isArray(value)&&value.length>=1&&value.length<=50
  &&value.every(healthCareIdentifier)&&new Set(value).size===value.length;
const placesTravelDate=(value:unknown):boolean=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/u.test(value)
  &&Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
  &&new Date(Date.parse(`${value}T00:00:00.000Z`)).toISOString().slice(0,10)===value;
const placesTravelAmount=(value:unknown):boolean=>typeof value==='number'&&Number.isSafeInteger(value)
  &&value>=0&&value<=9_000_000_000_000_000;
const placesTravelCurrency=(value:unknown):boolean=>typeof value==='string'&&/^[A-Z]{3}$/u.test(value);
const placesTravelSpecificFields=Object.freeze(['addressLabel','latitudeE6','longitudeE6','offlineFallbackLabel','participantPersonIds',
  'startsAt','endsAt','providerLabel','opaqueReference','archiveItemId','expiresOn','documentKind','amountMinor','currency',
  'checklistLabel','checklistCompleted','petReferenceId','petWorkflow','requirementKind','opaqueRequirementReference','languageCode','ocrJobId']);
const placesTravelAllowedFields:Readonly<Record<string,ReadonlySet<string>>>=Object.freeze({
  stored_place:new Set(['addressLabel','latitudeE6','longitudeE6','offlineFallbackLabel']),
  moving_inventory:new Set(['archiveItemId','ocrJobId']),
  pet_care_record:new Set(['archiveItemId','expiresOn','petReferenceId','petWorkflow']),
  travel_plan:new Set(['addressLabel','offlineFallbackLabel','participantPersonIds','startsAt','endsAt']),
  reservation:new Set(['participantPersonIds','startsAt','endsAt','providerLabel','opaqueReference']),
  travel_document:new Set(['archiveItemId','expiresOn','documentKind']),
  travel_budget:new Set(['startsAt','endsAt','amountMinor','currency']),
  shared_expense:new Set(['participantPersonIds','opaqueReference','amountMinor','currency']),
  packing_item:new Set(['checklistLabel','checklistCompleted']),
  travel_requirement:new Set(['requirementKind','opaqueRequirementReference']),
  offline_travel_pack:new Set(['archiveItemId']),language_pack:new Set(['archiveItemId','languageCode']),
  travel_album:new Set(['archiveItemId']),expense_settlement:new Set(['participantPersonIds','opaqueReference','amountMinor','currency'])
});
const placesTravelSpecificShape=(value:Record<string,unknown>):boolean=>{
  const kind=typeof value.kind==='string'?value.kind:'';const allowed=placesTravelAllowedFields[kind];if(!allowed)return false;
  if(placesTravelSpecificFields.some((field)=>value[field]!==undefined&&!allowed.has(field)))return false;
  const participants=Array.isArray(value.participantPersonIds)?value.participantPersonIds:undefined;
  const ownerIncluded=participants?.includes(value.ownerPersonId)===true;
  const hasCoordinates=value.latitudeE6!==undefined&&value.longitudeE6!==undefined;
  const dates=typeof value.startsAt==='string'&&typeof value.endsAt==='string'&&value.endsAt>=value.startsAt;
  const amount=value.amountMinor!==undefined&&value.currency!==undefined;
  if(kind==='stored_place')return typeof value.addressLabel==='string'||hasCoordinates;
  if(kind==='moving_inventory')return typeof value.archiveItemId==='string';
  if(kind==='pet_care_record')return typeof value.petReferenceId==='string'&&placesTravelPetWorkflows.has(value.petWorkflow);
  if(kind==='travel_plan')return ownerIncluded&&dates&&(typeof value.addressLabel==='string'||typeof value.offlineFallbackLabel==='string');
  if(kind==='reservation')return ownerIncluded&&dates&&typeof value.providerLabel==='string'&&typeof value.opaqueReference==='string';
  if(kind==='travel_document')return typeof value.archiveItemId==='string'&&typeof value.expiresOn==='string'
    &&placesTravelDocumentKinds.has(value.documentKind);
  if(kind==='travel_budget')return dates&&amount;
  if(kind==='shared_expense'||kind==='expense_settlement')return Boolean(participants&&participants.length>=2&&ownerIncluded&&amount
    &&typeof value.opaqueReference==='string');
  if(kind==='packing_item')return typeof value.checklistLabel==='string';
  if(kind==='travel_requirement')return placesTravelRequirementKinds.has(value.requirementKind)
    &&typeof value.opaqueRequirementReference==='string';
  if(kind==='offline_travel_pack'||kind==='travel_album')return typeof value.archiveItemId==='string';
  return kind==='language_pack'&&typeof value.archiveItemId==='string'&&typeof value.languageCode==='string';
};
const placesTravelCreateInput=(value:Record<string,unknown>):boolean=>{
  const optional=['status','addressLabel','latitudeE6','longitudeE6','offlineFallbackLabel','participantPersonIds','startsAt','endsAt',
    'providerLabel','opaqueReference','archiveItemId','expiresOn','documentKind','amountMinor','currency','checklistLabel',
    'checklistCompleted','petReferenceId','petWorkflow','requirementKind','opaqueRequirementReference','languageCode','ocrJobId','note']
    .filter((key)=>value[key]!==undefined);
  return healthCareExactRecord(value,['clientOperationId','itemId','ownerPersonId','kind','title','visibility',...optional])
    &&healthCareIdentifier(value.clientOperationId)&&healthCareIdentifier(value.itemId)&&healthCareIdentifier(value.ownerPersonId)
    &&placesTravelKinds.has(value.kind)&&healthCareText(value.title,2,160)&&placesTravelVisibilities.has(value.visibility)
    &&(value.status===undefined||placesTravelMutableStatuses.has(value.status))
    &&(value.addressLabel===undefined||healthCareText(value.addressLabel,1,300))
    &&(value.latitudeE6===undefined||(typeof value.latitudeE6==='number'&&Number.isSafeInteger(value.latitudeE6)&&value.latitudeE6>=-90_000_000&&value.latitudeE6<=90_000_000))
    &&(value.longitudeE6===undefined||(typeof value.longitudeE6==='number'&&Number.isSafeInteger(value.longitudeE6)&&value.longitudeE6>=-180_000_000&&value.longitudeE6<=180_000_000))
    &&((value.latitudeE6===undefined)===(value.longitudeE6===undefined))
    &&(value.offlineFallbackLabel===undefined||healthCareText(value.offlineFallbackLabel,1,300))
    &&(value.participantPersonIds===undefined||placesTravelParticipants(value.participantPersonIds))
    &&(value.startsAt===undefined||healthCareIso(value.startsAt))&&(value.endsAt===undefined||healthCareIso(value.endsAt))
    &&(value.providerLabel===undefined||healthCareText(value.providerLabel,1,160))
    &&(value.opaqueReference===undefined||healthCareText(value.opaqueReference,1,160))
    &&(value.archiveItemId===undefined||healthCareIdentifier(value.archiveItemId))
    &&(value.expiresOn===undefined||placesTravelDate(value.expiresOn))
    &&(value.documentKind===undefined||placesTravelDocumentKinds.has(value.documentKind))
    &&(value.amountMinor===undefined||placesTravelAmount(value.amountMinor))
    &&(value.currency===undefined||placesTravelCurrency(value.currency))
    &&((value.amountMinor===undefined)===(value.currency===undefined))
    &&(value.checklistLabel===undefined||healthCareText(value.checklistLabel,1,240))
    &&(value.checklistCompleted===undefined||typeof value.checklistCompleted==='boolean')
    &&(value.petReferenceId===undefined||healthCareIdentifier(value.petReferenceId))
    &&(value.petWorkflow===undefined||placesTravelPetWorkflows.has(value.petWorkflow))
    &&(value.requirementKind===undefined||placesTravelRequirementKinds.has(value.requirementKind))
    &&(value.opaqueRequirementReference===undefined||healthCareIdentifier(value.opaqueRequirementReference))
    &&(value.languageCode===undefined||(typeof value.languageCode==='string'&&/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/u.test(value.languageCode)))
    &&(value.ocrJobId===undefined||healthCareIdentifier(value.ocrJobId))
    &&(value.note===undefined||healthCareText(value.note,1,1000))
    &&placesTravelSpecificShape(value);
};
const placesTravelUpdateInput=(value:Record<string,unknown>):boolean=>{
  const optional=['title','status','visibility','startsAt','endsAt','expiresOn','amountMinor','checklistCompleted','note']
    .filter((key)=>value[key]!==undefined);
  return optional.length>=1&&healthCareExactRecord(value,['clientOperationId','itemId','ownerPersonId','expectedRevision',...optional])
    &&healthCareIdentifier(value.clientOperationId)&&healthCareIdentifier(value.itemId)&&healthCareIdentifier(value.ownerPersonId)
    &&healthCareRevision(value.expectedRevision)&&Number(value.expectedRevision)>=1
    &&(value.title===undefined||healthCareText(value.title,2,160))
    &&(value.status===undefined||placesTravelMutableStatuses.has(value.status))
    &&(value.visibility===undefined||placesTravelVisibilities.has(value.visibility))
    &&(value.startsAt===undefined||value.startsAt===null||healthCareIso(value.startsAt))
    &&(value.endsAt===undefined||value.endsAt===null||healthCareIso(value.endsAt))
    &&(value.expiresOn===undefined||value.expiresOn===null||placesTravelDate(value.expiresOn))
    &&(value.amountMinor===undefined||value.amountMinor===null||placesTravelAmount(value.amountMinor))
    &&(value.checklistCompleted===undefined||typeof value.checklistCompleted==='boolean')
    &&(value.note===undefined||value.note===null||healthCareText(value.note,1,1000));
};
const placesTravelInput=(channel:string,args:readonly unknown[]):IpcIntegrationPolicyDecision=>{
  if(args.length!==1||!isObject(args[0]))return rejected('PLACES_TRAVEL_OBJECT_REQUIRED','$[0]');const value=args[0];
  if(channel===PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.getCenter)return healthCareExactRecord(value,['ownerPersonId'])&&healthCareIdentifier(value.ownerPersonId)
    ?accepted():rejected('PLACES_TRAVEL_CENTER_INPUT_INVALID','$[0]');
  if(channel===PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.createItem)return placesTravelCreateInput(value)
    ?accepted():rejected('PLACES_TRAVEL_CREATE_INPUT_INVALID','$[0]');
  if(channel===PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.updateItem)return placesTravelUpdateInput(value)
    ?accepted():rejected('PLACES_TRAVEL_UPDATE_INPUT_INVALID','$[0]');
  if(channel===PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.deleteItem)return healthCareExactRecord(value,
    ['clientOperationId','itemId','ownerPersonId','expectedRevision','reason'])&&healthCareIdentifier(value.clientOperationId)
    &&healthCareIdentifier(value.itemId)&&healthCareIdentifier(value.ownerPersonId)&&healthCareRevision(value.expectedRevision)
    &&Number(value.expectedRevision)>=1&&healthCareText(value.reason,2,500)?accepted():rejected('PLACES_TRAVEL_DELETE_INPUT_INVALID','$[0]');
  return rejected('UNKNOWN_IPC_CHANNEL','$');
};
const placesTravelItemResult=(value:unknown):boolean=>{
  if(!isObject(value))return false;
  const optional=['addressLabel','latitudeE6','longitudeE6','offlineFallbackLabel','participantPersonIds','startsAt','endsAt','providerLabel',
    'opaqueReference','archiveItemId','expiresOn','documentKind','amountMinor','currency','checklistLabel','checklistCompleted',
    'petReferenceId','petWorkflow','requirementKind','opaqueRequirementReference','languageCode','ocrJobId','note','deletedAt']
    .filter((key)=>value[key]!==undefined);
  return healthCareExactRecord(value,['id','ownerPersonId','kind','area','title','status','visibility','revision','createdAt','updatedAt',...optional])
    &&healthCareIdentifier(value.id)&&healthCareIdentifier(value.ownerPersonId)&&placesTravelKinds.has(value.kind)
    &&placesTravelAreas.has(value.area)&&healthCareText(value.title,2,160)&&placesTravelStatuses.has(value.status)
    &&placesTravelVisibilities.has(value.visibility)&&healthCareRevision(value.revision)&&Number(value.revision)>=1
    &&(value.addressLabel===undefined||healthCareText(value.addressLabel,1,300))
    &&(value.latitudeE6===undefined||(typeof value.latitudeE6==='number'&&Number.isSafeInteger(value.latitudeE6)
      &&value.latitudeE6>=-90_000_000&&value.latitudeE6<=90_000_000))
    &&(value.longitudeE6===undefined||(typeof value.longitudeE6==='number'&&Number.isSafeInteger(value.longitudeE6)
      &&value.longitudeE6>=-180_000_000&&value.longitudeE6<=180_000_000))
    &&((value.latitudeE6===undefined)===(value.longitudeE6===undefined))
    &&(value.offlineFallbackLabel===undefined||healthCareText(value.offlineFallbackLabel,1,300))
    &&(value.participantPersonIds===undefined||placesTravelParticipants(value.participantPersonIds))
    &&(value.startsAt===undefined||healthCareIso(value.startsAt))&&(value.endsAt===undefined||healthCareIso(value.endsAt))
    &&(value.providerLabel===undefined||healthCareText(value.providerLabel,1,160))
    &&(value.opaqueReference===undefined||healthCareText(value.opaqueReference,1,160))
    &&(value.archiveItemId===undefined||healthCareIdentifier(value.archiveItemId))
    &&(value.expiresOn===undefined||placesTravelDate(value.expiresOn))
    &&(value.documentKind===undefined||placesTravelDocumentKinds.has(value.documentKind))
    &&(value.amountMinor===undefined||placesTravelAmount(value.amountMinor))&&(value.currency===undefined||placesTravelCurrency(value.currency))
    &&(value.checklistLabel===undefined||healthCareText(value.checklistLabel,1,240))
    &&(value.checklistCompleted===undefined||typeof value.checklistCompleted==='boolean')
    &&(value.petReferenceId===undefined||healthCareIdentifier(value.petReferenceId))
    &&(value.petWorkflow===undefined||placesTravelPetWorkflows.has(value.petWorkflow))
    &&(value.requirementKind===undefined||placesTravelRequirementKinds.has(value.requirementKind))
    &&(value.opaqueRequirementReference===undefined||healthCareIdentifier(value.opaqueRequirementReference))
    &&(value.languageCode===undefined||(typeof value.languageCode==='string'&&/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/u.test(value.languageCode)))
    &&(value.ocrJobId===undefined||healthCareIdentifier(value.ocrJobId))
    &&(value.note===undefined||healthCareText(value.note,1,1000))&&healthCareIso(value.createdAt)&&healthCareIso(value.updatedAt)
    &&(value.deletedAt===undefined||healthCareIso(value.deletedAt))
    &&(value.status==='deleted'||placesTravelSpecificShape(value));
};
const placesTravelCenterResult=(value:unknown):boolean=>healthCareExactRecord(value,
  ['schemaVersion','centerId','ownerPersonId','items','countsByArea','truth','generatedAt'])&&value.schemaVersion===1
  &&healthCareIdentifier(value.centerId)&&healthCareIdentifier(value.ownerPersonId)&&householdArray(value.items,1000,placesTravelItemResult)
  &&healthCareExactRecord(value.countsByArea,['places','moving','pet_care','travel'])
  &&Object.values(value.countsByArea).every((count)=>typeof count==='number'&&Number.isSafeInteger(count)&&count>=0)
  &&healthCareExactRecord(value.truth,['localOnly','mapProviderConfigured','coordinateAddressFallbackAvailable','schoolOrTravelProviderSync',
    'externalBookingPerformed','liveTransportTrackingPerformed','paymentExecutionPerformed','documentVerificationPerformed',
    'petHealthAdviceProvided','healthDetailsDuplicated','ocrSuggestionAutomaticallyAccepted','offlinePackDeliveryPerformed',
    'languagePackDownloadPerformed','albumMediaStoredHere','aiProcessingAllowed','externalSharingAllowed'])
  &&value.truth.localOnly===true&&value.truth.mapProviderConfigured===false&&value.truth.coordinateAddressFallbackAvailable===true
  &&value.truth.schoolOrTravelProviderSync==='not_configured'&&value.truth.externalBookingPerformed==='not_performed'
  &&value.truth.liveTransportTrackingPerformed==='not_performed'&&value.truth.paymentExecutionPerformed==='not_performed'
  &&value.truth.documentVerificationPerformed==='not_performed'&&value.truth.petHealthAdviceProvided===false
  &&value.truth.healthDetailsDuplicated===false&&value.truth.ocrSuggestionAutomaticallyAccepted===false
  &&value.truth.offlinePackDeliveryPerformed==='not_performed'&&value.truth.languagePackDownloadPerformed==='not_performed'
  &&value.truth.albumMediaStoredHere===false&&value.truth.aiProcessingAllowed===false&&value.truth.externalSharingAllowed===false
  &&healthCareIso(value.generatedAt);
const placesTravelReceiptResult=(value:unknown):boolean=>healthCareExactRecord(value,
  ['itemId','ownerPersonId','mutationKind','previousRevision','revision','occurredAt','replayed','localOnly','externalAction'])
  &&healthCareIdentifier(value.itemId)&&healthCareIdentifier(value.ownerPersonId)
  &&['item_create','item_update','item_delete'].includes(String(value.mutationKind))
  &&healthCareRevision(value.previousRevision)&&healthCareRevision(value.revision)&&value.revision===Number(value.previousRevision)+1
  &&healthCareIso(value.occurredAt)&&typeof value.replayed==='boolean'&&value.localOnly===true&&value.externalAction==='not_performed';
const placesTravelResult=(channel:string,result:unknown):IpcIntegrationPolicyDecision=>{
  const valid=channel===PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.getCenter?placesTravelCenterResult(result)
    :placesTravelWriteChannels.has(channel)&&placesTravelReceiptResult(result);
  return valid?accepted():rejected('PLACES_TRAVEL_RESULT_INVALID','$result');
};

export const FAMILY_AI_ASSISTANT_IPC_CHANNELS=Object.freeze({
  getCenter:'familyAiAssistant:getCenter',getLocalModelStatus:'familyAiAssistant:getLocalModelStatus',
  runLocalModel:'familyAiAssistant:runLocalModel',generate:'familyAiAssistant:generate',review:'familyAiAssistant:review'
} as const);
const familyAiAssistantChannels=new Set<string>(Object.values(FAMILY_AI_ASSISTANT_IPC_CHANNELS));
const familyAiKinds=new Set<unknown>(['authorized_search','daily_summary','weekly_summary','reminder_review','emergency_bag',
  'meeting_agenda','ocr_classification','duplicate_record','family_story','spending_review','meal_plan','shopping_list',
  'plain_explanation','read_aloud','translation']);
const familyAiModules=new Set<unknown>(['family','event','archive','finance','health','life','ocr','household','places']);
const familyAiPurposes=new Set<unknown>(['search','summary','recommendation','classification']);
const familyAiSourceTypes=new Set<unknown>(['person','event','archive_item','finance_record','health_record','life_record',
  'local_ocr_job','household_operation_item','places_travel_item']);
const familyAiModulesByKind:Readonly<Record<string,readonly string[]>>=Object.freeze({
  authorized_search:['family','event','archive','finance','health','life'],
  daily_summary:['event','archive','finance','health','life','household','places'],
  weekly_summary:['event','archive','finance','health','life','household','places'],
  reminder_review:['event','archive','finance','health','life','household','places'],
  emergency_bag:['life','household','places'],meeting_agenda:['family','event'],ocr_classification:['archive','ocr'],
  duplicate_record:['archive','ocr'],family_story:['family','event','archive','places'],spending_review:['finance','household'],
  meal_plan:['household'],shopping_list:['household'],plain_explanation:['archive','health','life'],read_aloud:['archive'],translation:['archive']
});
const familyAiResourceTypeByModule:Readonly<Record<string,string>>=Object.freeze({family:'person',event:'event',archive:'archive_item',
  finance:'finance_record',health:'health_record',life:'life_record',ocr:'local_ocr_job',household:'household_operation_item',
  places:'places_travel_item'});
const familyAiPurposeByKind=(kind:unknown):string=>kind==='authorized_search'?'search'
  :['daily_summary','weekly_summary','plain_explanation'].includes(String(kind))?'summary'
  :['ocr_classification','duplicate_record'].includes(String(kind))?'classification':'recommendation';
const familyAiInput=(channel:string,args:readonly unknown[]):IpcIntegrationPolicyDecision=>{
  if(channel===FAMILY_AI_ASSISTANT_IPC_CHANNELS.getCenter||channel===FAMILY_AI_ASSISTANT_IPC_CHANNELS.getLocalModelStatus)
    return zeroArguments(args);
  if(args.length!==1||!isObject(args[0]))return rejected('FAMILY_AI_OBJECT_REQUIRED','$[0]');const value=args[0];
  if(channel===FAMILY_AI_ASSISTANT_IPC_CHANNELS.runLocalModel){const optional=['modules'].filter((key)=>value[key]!==undefined);
    const allowedModules=familyAiModulesByKind[String(value.kind)]??[];
    return healthCareExactRecord(value,['kind','prompt',...optional])&&familyAiKinds.has(value.kind)
      &&healthCareText(value.prompt,2,400)
      &&(value.modules===undefined||(Array.isArray(value.modules)&&value.modules.length>=1&&value.modules.length<=9
        &&value.modules.every((module)=>familyAiModules.has(module)&&allowedModules.includes(String(module)))
        &&new Set(value.modules).size===value.modules.length))
      ?accepted():rejected('FAMILY_AI_LOCAL_MODEL_INPUT_INVALID','$[0]');}
  if(channel===FAMILY_AI_ASSISTANT_IPC_CHANNELS.generate){const optional=['modules','query'].filter((key)=>value[key]!==undefined);
    const allowedModules=familyAiModulesByKind[String(value.kind)]??[];
    return healthCareExactRecord(value,['clientOperationId','suggestionId','kind',...optional])
      &&healthCareIdentifier(value.clientOperationId)&&healthCareIdentifier(value.suggestionId)&&familyAiKinds.has(value.kind)
      &&(value.modules===undefined||(Array.isArray(value.modules)&&value.modules.length>=1&&value.modules.length<=9
        &&value.modules.every((module)=>familyAiModules.has(module)&&allowedModules.includes(String(module)))
        &&new Set(value.modules).size===value.modules.length))
      &&(value.kind==='authorized_search'?healthCareText(value.query,2,80):value.query===undefined)
      ?accepted():rejected('FAMILY_AI_GENERATE_INPUT_INVALID','$[0]');}
  if(channel===FAMILY_AI_ASSISTANT_IPC_CHANNELS.review)return healthCareExactRecord(value,
    ['clientOperationId','suggestionId','expectedRevision','decision'])&&healthCareIdentifier(value.clientOperationId)
    &&healthCareIdentifier(value.suggestionId)&&healthCareRevision(value.expectedRevision)&&Number(value.expectedRevision)>=1
    &&(value.decision==='confirm'||value.decision==='dismiss')?accepted():rejected('FAMILY_AI_REVIEW_INPUT_INVALID','$[0]');
  return rejected('UNKNOWN_IPC_CHANNEL','$');
};
const familyAiSourceResult=(value:unknown):boolean=>healthCareExactRecord(value,['module','resourceType','resourceId'])
  &&familyAiModules.has(value.module)&&familyAiSourceTypes.has(value.resourceType)
  &&familyAiResourceTypeByModule[String(value.module)]===value.resourceType&&healthCareIdentifier(value.resourceId);
const familyAiSuggestionResult=(value:unknown):boolean=>{
  if(!isObject(value))return false;const optional=['confirmedAt','dismissedAt'].filter((key)=>value[key]!==undefined);
  return healthCareExactRecord(value,['id','ownerPersonId','kind','purpose','status','title','explanation','confidenceBasisPoints',
    'sources','revision','createdAt','updatedAt',...optional])&&healthCareIdentifier(value.id)&&healthCareIdentifier(value.ownerPersonId)
    &&familyAiKinds.has(value.kind)&&familyAiPurposes.has(value.purpose)
    &&value.purpose===familyAiPurposeByKind(value.kind)
    &&['pending_confirmation','confirmed','dismissed'].includes(String(value.status))&&healthCareText(value.title,2,160)
    &&healthCareText(value.explanation,10,500)&&typeof value.confidenceBasisPoints==='number'
    &&Number.isSafeInteger(value.confidenceBasisPoints)&&value.confidenceBasisPoints>=0&&value.confidenceBasisPoints<=10000
    &&Array.isArray(value.sources)&&householdArray(value.sources,24,familyAiSourceResult)&&value.sources.length>=1
    &&new Set(value.sources.map((source)=>isObject(source)?`${String(source.resourceType)}:${String(source.resourceId)}`:'')).size===value.sources.length
    &&healthCareRevision(value.revision)&&Number(value.revision)>=1&&healthCareIso(value.createdAt)&&healthCareIso(value.updatedAt)
    &&(value.confirmedAt===undefined||healthCareIso(value.confirmedAt))&&(value.dismissedAt===undefined||healthCareIso(value.dismissedAt))
    &&((value.status==='pending_confirmation'&&value.confirmedAt===undefined&&value.dismissedAt===undefined)
      ||(value.status==='confirmed'&&value.confirmedAt===value.updatedAt&&value.dismissedAt===undefined)
      ||(value.status==='dismissed'&&value.dismissedAt===value.updatedAt&&value.confirmedAt===undefined));
};
const familyAiInactiveSuggestionResult=(value:unknown):boolean=>healthCareExactRecord(value,['id','revision','updatedAt'])
  &&healthCareIdentifier(value.id)&&healthCareRevision(value.revision)&&Number(value.revision)>=1&&healthCareIso(value.updatedAt);
const familyAiCenterCollectionsValid=(suggestions:unknown,revoked:unknown,hidden:unknown,capacity:unknown,owner:unknown):boolean=>{
  if(!Array.isArray(suggestions)||!Array.isArray(revoked)||!Number.isSafeInteger(hidden)||Number(hidden)<0
    ||!isObject(capacity)||!healthCareExactRecord(capacity,['maximum','used','remaining','limitReached']))return false;
  return suggestions.every((suggestion)=>isObject(suggestion)&&suggestion.ownerPersonId===owner)
    &&revoked.length<=Number(hidden)&&capacity.maximum===500&&Number.isSafeInteger(capacity.used)&&Number(capacity.used)>=0
    &&Number.isSafeInteger(capacity.remaining)&&Number(capacity.remaining)>=0
    &&Number(capacity.used)+Number(capacity.remaining)===500
    &&Number(capacity.used)===suggestions.length+Number(hidden)&&capacity.limitReached===(Number(capacity.used)>=500);
};
const familyAiCenterResult=(value:unknown):boolean=>healthCareExactRecord(value,
  ['schemaVersion','centerId','ownerPersonId','suggestions','inactiveConsentSuggestions','hiddenAfterConsentRevocationCount',
    'suggestionCapacity','truth','generatedAt'])
  &&value.schemaVersion===1&&healthCareIdentifier(value.centerId)&&healthCareIdentifier(value.ownerPersonId)
  &&householdArray(value.suggestions,500,familyAiSuggestionResult)&&typeof value.hiddenAfterConsentRevocationCount==='number'
  &&Number.isSafeInteger(value.hiddenAfterConsentRevocationCount)&&value.hiddenAfterConsentRevocationCount>=0
  &&householdArray(value.inactiveConsentSuggestions,500,familyAiInactiveSuggestionResult)
  &&familyAiCenterCollectionsValid(value.suggestions,value.inactiveConsentSuggestions,value.hiddenAfterConsentRevocationCount,
    value.suggestionCapacity,value.ownerPersonId)
  &&healthCareExactRecord(value.truth,['localFirst','authorizedSearchAvailableWithoutProvider','providerConfigured','networkUsed',
    'cloudUsed','modelInferencePerformed','speechSynthesisPerformed','translationPerformed','ocrSuggestionAutomaticallyAccepted',
    'durableActionPerformed','humanConfirmationRequired','confirmationExecutesDownstreamAction','sourceConsentRevalidated',
    'explicitConsentRevocationOverridesBroaderGrant','confidenceRepresentsSourceCoverageOnly',
    'medicalFinancialOrEmergencyDecisionProvided'])&&value.truth.localFirst===true
  &&value.truth.authorizedSearchAvailableWithoutProvider===true&&value.truth.providerConfigured===false
  &&value.truth.networkUsed===false&&value.truth.cloudUsed===false&&value.truth.modelInferencePerformed===false
  &&value.truth.speechSynthesisPerformed===false&&value.truth.translationPerformed===false
  &&value.truth.ocrSuggestionAutomaticallyAccepted===false&&value.truth.durableActionPerformed==='not_performed'
  &&value.truth.humanConfirmationRequired===true&&value.truth.confirmationExecutesDownstreamAction===false
  &&value.truth.sourceConsentRevalidated===true&&value.truth.explicitConsentRevocationOverridesBroaderGrant===true
  &&value.truth.confidenceRepresentsSourceCoverageOnly===true&&value.truth.medicalFinancialOrEmergencyDecisionProvided===false
  &&healthCareIso(value.generatedAt);
const familyAiReceiptResult=(value:unknown):boolean=>healthCareExactRecord(value,
  ['suggestionId','mutationKind','previousRevision','revision','occurredAt','replayed','durableActionPerformed',
    'humanConfirmationRecorded','networkUsed','cloudUsed'])&&healthCareIdentifier(value.suggestionId)
  &&['suggestion_generate','suggestion_confirm','suggestion_dismiss'].includes(String(value.mutationKind))
  &&healthCareRevision(value.previousRevision)&&healthCareRevision(value.revision)&&value.revision===Number(value.previousRevision)+1
  &&healthCareIso(value.occurredAt)&&typeof value.replayed==='boolean'&&value.durableActionPerformed==='not_performed'
  &&typeof value.humanConfirmationRecorded==='boolean'
  &&value.humanConfirmationRecorded===(value.mutationKind==='suggestion_confirm')
  &&(value.mutationKind==='suggestion_generate'?value.previousRevision===0&&value.revision===1:Number(value.previousRevision)>=1)
  &&value.networkUsed===false&&value.cloudUsed===false;
const familyAiLocalModelStatusResult=(value:unknown):boolean=>{if(!isObject(value))return false;
  const optional=['model'].filter((key)=>value[key]!==undefined);
  return healthCareExactRecord(value,['provider','configured','available','endpoint','localLoopbackOnly','networkEgressUsed',
    'cloudUsed','checkedAt',...optional])&&value.provider==='ollama_loopback'&&typeof value.configured==='boolean'
    &&typeof value.available==='boolean'&&(!value.configured?value.available===false:true)
    &&(value.model===undefined||healthCareText(value.model,1,80))&&value.endpoint==='http://127.0.0.1:11434'
    &&value.localLoopbackOnly===true&&value.networkEgressUsed===false&&value.cloudUsed===false&&healthCareIso(value.checkedAt);};
const familyAiLocalModelResponseResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['kind','answer','sourceCount','provider','model','generatedAt','truth'])&&familyAiKinds.has(value.kind)
  &&healthCareText(value.answer,1,4000)&&Number.isSafeInteger(value.sourceCount)&&Number(value.sourceCount)>=1
  &&Number(value.sourceCount)<=24&&value.provider==='ollama_loopback'&&healthCareText(value.model,1,80)
  &&healthCareIso(value.generatedAt)&&isObject(value.truth)&&healthCareExactRecord(value.truth,
    ['localLoopbackOnly','networkEgressUsed','cloudUsed','modelInferencePerformed','responsePersisted','durableActionPerformed',
      'humanReviewRequired','sourceConsentRevalidatedAfterInference','medicalFinancialOrEmergencyDecisionProvided'])
  &&value.truth.localLoopbackOnly===true&&value.truth.networkEgressUsed===false&&value.truth.cloudUsed===false
  &&value.truth.modelInferencePerformed===true&&value.truth.responsePersisted===false
  &&value.truth.durableActionPerformed==='not_performed'&&value.truth.humanReviewRequired===true
  &&value.truth.sourceConsentRevalidatedAfterInference===true
  &&value.truth.medicalFinancialOrEmergencyDecisionProvided===false;
const familyAiResult=(channel:string,result:unknown):IpcIntegrationPolicyDecision=>{
  const valid=channel===FAMILY_AI_ASSISTANT_IPC_CHANNELS.getCenter?familyAiCenterResult(result)
    :channel===FAMILY_AI_ASSISTANT_IPC_CHANNELS.getLocalModelStatus?familyAiLocalModelStatusResult(result)
    :channel===FAMILY_AI_ASSISTANT_IPC_CHANNELS.runLocalModel?familyAiLocalModelResponseResult(result)
    :familyAiReceiptResult(result);
  return valid?accepted():rejected('FAMILY_AI_RESULT_INVALID','$result');
};

export const MEMORY_STUDIO_IPC_CHANNELS=Object.freeze({
  getCenter:'memoryStudio:getCenter',createRecord:'memoryStudio:createRecord',deleteRecord:'memoryStudio:deleteRecord',
  createCapsule:'memoryStudio:createCapsule',reviewCapsule:'memoryStudio:reviewCapsule',transitionCapsule:'memoryStudio:transitionCapsule'
} as const);
const memoryStudioChannels=new Set<string>(Object.values(MEMORY_STUDIO_IPC_CHANNELS));
const memoryStudioRecordKinds=new Set<unknown>(['voice_story','transcript','photo_book','annual_album','on_this_day',
  'duplicate_photo_review','face_group','genealogy_media_link','recipe','tradition','letter','future_message',
  'family_documentary','printable_book']);
const memoryStudioIds=(value:unknown):value is readonly string[]=>Array.isArray(value)&&value.length<=32
  &&value.every(healthCareIdentifier)&&new Set(value).size===value.length;
const memoryStudioInput=(channel:string,args:readonly unknown[]):IpcIntegrationPolicyDecision=>{
  if(channel===MEMORY_STUDIO_IPC_CHANNELS.getCenter)return zeroArguments(args);
  if(args.length!==1||!isObject(args[0]))return rejected('MEMORY_STUDIO_OBJECT_REQUIRED','$[0]');const value=args[0];
  if(channel===MEMORY_STUDIO_IPC_CHANNELS.createRecord){
    const optional=['summary','archiveItemIds','personIds','ocrJobId','eventDate','manualFaceGroupingApproved']
      .filter((key)=>value[key]!==undefined);
    const valid=healthCareExactRecord(value,['clientOperationId','recordId','kind','title',...optional])
      &&healthCareIdentifier(value.clientOperationId)&&healthCareIdentifier(value.recordId)&&memoryStudioRecordKinds.has(value.kind)
      &&healthCareText(value.title,2,160)&&(value.summary===undefined||healthCareText(value.summary,2,2000))
      &&(value.archiveItemIds===undefined||memoryStudioIds(value.archiveItemIds))
      &&(value.personIds===undefined||memoryStudioIds(value.personIds))
      &&(value.ocrJobId===undefined||healthCareIdentifier(value.ocrJobId))
      &&(value.eventDate===undefined||healthCareIso(value.eventDate))
      &&(value.manualFaceGroupingApproved===undefined||typeof value.manualFaceGroupingApproved==='boolean')
      &&(value.summary!==undefined||(Array.isArray(value.archiveItemIds)&&value.archiveItemIds.length>0)
        ||(Array.isArray(value.personIds)&&value.personIds.length>0)||value.ocrJobId!==undefined)
      &&(value.kind==='face_group'?value.manualFaceGroupingApproved===true&&Array.isArray(value.archiveItemIds)
        &&value.archiveItemIds.length>0&&Array.isArray(value.personIds)&&value.personIds.length>0
        :value.manualFaceGroupingApproved!==true)
      &&(value.kind!=='transcript'||(Array.isArray(value.archiveItemIds)&&value.archiveItemIds.length>0)||value.ocrJobId!==undefined);
    return valid?accepted():rejected('MEMORY_STUDIO_CREATE_RECORD_INPUT_INVALID','$[0]');
  }
  if(channel===MEMORY_STUDIO_IPC_CHANNELS.deleteRecord)return healthCareExactRecord(value,
    ['clientOperationId','recordId','expectedRevision'])&&healthCareIdentifier(value.clientOperationId)
    &&healthCareIdentifier(value.recordId)&&healthCareRevision(value.expectedRevision)&&Number(value.expectedRevision)>=1
    ?accepted():rejected('MEMORY_STUDIO_DELETE_RECORD_INPUT_INVALID','$[0]');
  if(channel===MEMORY_STUDIO_IPC_CHANNELS.createCapsule){const optional=['archiveItemIds','memoryRecordIds'].filter((key)=>value[key]!==undefined);
    return healthCareExactRecord(value,['clientOperationId','capsuleId','title','unlockAt',...optional])
      &&healthCareIdentifier(value.clientOperationId)&&healthCareIdentifier(value.capsuleId)&&healthCareText(value.title,2,160)
      &&healthCareIso(value.unlockAt)&&(value.archiveItemIds===undefined||memoryStudioIds(value.archiveItemIds))
      &&(value.memoryRecordIds===undefined||memoryStudioIds(value.memoryRecordIds))
      &&((Array.isArray(value.archiveItemIds)&&value.archiveItemIds.length>0)
        ||(Array.isArray(value.memoryRecordIds)&&value.memoryRecordIds.length>0))
      ?accepted():rejected('MEMORY_STUDIO_CREATE_CAPSULE_INPUT_INVALID','$[0]');}
  if(channel===MEMORY_STUDIO_IPC_CHANNELS.reviewCapsule)return healthCareExactRecord(value,
    ['clientOperationId','capsuleId','expectedRevision','decision'])&&healthCareIdentifier(value.clientOperationId)
    &&healthCareIdentifier(value.capsuleId)&&healthCareRevision(value.expectedRevision)&&Number(value.expectedRevision)>=1
    &&['approve','revoke_approval'].includes(String(value.decision))?accepted():rejected('MEMORY_STUDIO_REVIEW_CAPSULE_INPUT_INVALID','$[0]');
  if(channel===MEMORY_STUDIO_IPC_CHANNELS.transitionCapsule)return healthCareExactRecord(value,
    ['clientOperationId','capsuleId','expectedRevision','transition'])&&healthCareIdentifier(value.clientOperationId)
    &&healthCareIdentifier(value.capsuleId)&&healthCareRevision(value.expectedRevision)&&Number(value.expectedRevision)>=1
    &&['seal','release','cancel','rollback'].includes(String(value.transition))?accepted():rejected('MEMORY_STUDIO_TRANSITION_CAPSULE_INPUT_INVALID','$[0]');
  return rejected('UNKNOWN_IPC_CHANNEL','$');
};
const memoryStudioRecordResult=(value:unknown):boolean=>{if(!isObject(value))return false;
  const optional=['summary','ocrJobId','eventDate','deletedAt'].filter((key)=>value[key]!==undefined);
  return healthCareExactRecord(value,['id','ownerPersonId','kind','status','title','archiveItemIds','personIds',
    'manualFaceGroupingApproved','revision','createdAt','updatedAt',...optional])&&healthCareIdentifier(value.id)
    &&healthCareIdentifier(value.ownerPersonId)&&memoryStudioRecordKinds.has(value.kind)&&value.status==='active'
    &&healthCareText(value.title,2,160)&&(value.summary===undefined||healthCareText(value.summary,2,2000))
    &&memoryStudioIds(value.archiveItemIds)&&memoryStudioIds(value.personIds)
    &&(value.ocrJobId===undefined||healthCareIdentifier(value.ocrJobId))&&(value.eventDate===undefined||healthCareIso(value.eventDate))
    &&typeof value.manualFaceGroupingApproved==='boolean'
    &&(value.kind==='face_group'?value.manualFaceGroupingApproved===true&&value.archiveItemIds.length>0&&value.personIds.length>0
      :value.manualFaceGroupingApproved===false)
    &&(value.kind!=='transcript'||value.archiveItemIds.length>0||value.ocrJobId!==undefined)
    &&healthCareRevision(value.revision)&&Number(value.revision)>=1&&healthCareIso(value.createdAt)&&healthCareIso(value.updatedAt)
    &&Date.parse(String(value.updatedAt))>=Date.parse(String(value.createdAt))
    &&value.deletedAt===undefined;};
const memoryStudioMaximumUnlockAt=(createdAt:unknown):number=>{const value=new Date(String(createdAt));
  value.setUTCFullYear(value.getUTCFullYear()+100);return value.getTime();};
const memoryStudioCapsuleResult=(value:unknown):boolean=>{if(!isObject(value))return false;
  const optional=['sealedAt','releasedAt','cancelledAt','rolledBackAt'].filter((key)=>value[key]!==undefined);
  return healthCareExactRecord(value,['id','ownerPersonId','title','status','archiveItemIds','memoryRecordIds','unlockAt',
    'minimumApprovals','approvalCount','currentAccountApprovalRecorded','revision','createdAt','updatedAt',...optional])&&healthCareIdentifier(value.id)
    &&healthCareIdentifier(value.ownerPersonId)&&healthCareText(value.title,2,160)
    &&['awaiting_approvals','sealed','released','cancelled','rolled_back'].includes(String(value.status))
    &&memoryStudioIds(value.archiveItemIds)&&memoryStudioIds(value.memoryRecordIds)
    &&value.archiveItemIds.length+value.memoryRecordIds.length>=1&&healthCareIso(value.unlockAt)
    &&value.minimumApprovals===2&&Number.isSafeInteger(value.approvalCount)&&Number(value.approvalCount)>=0
    &&Number(value.approvalCount)<=32&&typeof value.currentAccountApprovalRecorded==='boolean'
    &&healthCareRevision(value.revision)&&Number(value.revision)>=1&&healthCareIso(value.createdAt)&&healthCareIso(value.updatedAt)
    &&Date.parse(String(value.updatedAt))>=Date.parse(String(value.createdAt))
    &&Date.parse(String(value.unlockAt))>=Date.parse(String(value.createdAt))+7*86_400_000
    &&Date.parse(String(value.unlockAt))<=memoryStudioMaximumUnlockAt(value.createdAt)
    &&(!['sealed','released','rolled_back'].includes(String(value.status))||Number(value.approvalCount)>=2)
    &&(value.sealedAt===undefined||healthCareIso(value.sealedAt))&&(value.releasedAt===undefined||healthCareIso(value.releasedAt))
    &&(value.cancelledAt===undefined||healthCareIso(value.cancelledAt))&&(value.rolledBackAt===undefined||healthCareIso(value.rolledBackAt))
    &&((value.status==='awaiting_approvals'&&value.sealedAt===undefined&&value.releasedAt===undefined
        &&value.cancelledAt===undefined&&value.rolledBackAt===undefined)
      ||(value.status==='sealed'&&value.sealedAt===value.updatedAt&&value.releasedAt===undefined
        &&value.cancelledAt===undefined&&value.rolledBackAt===undefined)
      ||(value.status==='released'&&value.sealedAt!==undefined&&value.releasedAt===value.updatedAt
        &&Date.parse(String(value.updatedAt))>=Date.parse(String(value.unlockAt))
        &&value.cancelledAt===undefined&&value.rolledBackAt===undefined)
      ||(value.status==='cancelled'&&value.releasedAt===undefined&&value.cancelledAt===value.updatedAt&&value.rolledBackAt===undefined)
      ||(value.status==='rolled_back'&&value.releasedAt!==undefined&&value.rolledBackAt===value.updatedAt
        &&Date.parse(String(value.updatedAt))>=Date.parse(String(value.releasedAt))
        &&Date.parse(String(value.updatedAt))<=Date.parse(String(value.releasedAt))+86_400_000&&value.cancelledAt===undefined));};
const memoryStudioCapacityResult=(value:unknown,maximum:number,minimumUsed:number,exactUsed:boolean):boolean=>isObject(value)
  &&healthCareExactRecord(value,['maximum','used','remaining','limitReached'])&&value.maximum===maximum
  &&Number.isSafeInteger(value.used)&&Number(value.used)>=minimumUsed&&Number(value.used)<=maximum
  &&Number.isSafeInteger(value.remaining)&&Number(value.remaining)===maximum-Number(value.used)
  &&value.limitReached===(Number(value.used)>=maximum)&&(!exactUsed||Number(value.used)===minimumUsed);
const memoryStudioCenterResult=(value:unknown):boolean=>{if(!isObject(value)||!Array.isArray(value.records)||!Array.isArray(value.capsules))return false;
  const records=value.records;const capsules=value.capsules;
  return healthCareExactRecord(value,
  ['schemaVersion','centerId','ownerPersonId','records','capsules','storageCapacity','truth','generatedAt'])&&value.schemaVersion===1
  &&healthCareIdentifier(value.centerId)&&healthCareIdentifier(value.ownerPersonId)&&householdArray(records,500,memoryStudioRecordResult)
  &&householdArray(capsules,200,memoryStudioCapsuleResult)
  &&records.every((record:unknown)=>isObject(record)&&record.ownerPersonId===value.ownerPersonId)
  &&capsules.every((capsule:unknown)=>isObject(capsule)&&capsule.ownerPersonId===value.ownerPersonId)
  &&isObject(value.storageCapacity)&&healthCareExactRecord(value.storageCapacity,['records','capsules'])
  &&memoryStudioCapacityResult(value.storageCapacity.records,500,records.length,false)
  &&memoryStudioCapacityResult(value.storageCapacity.capsules,200,capsules.length,true)
  &&healthCareExactRecord(value.truth,
    ['localOnly','linkedArchiveContentRemainsProtected','newBinaryPayloadStored','transcriptionPerformed','faceRecognitionPerformed',
      'duplicateDetectionPerformed','documentaryRendered','printableBookRendered','printingPerformed','networkUsed','cloudUsed',
      'manualCurationOnly','manualFaceGroupingOnly','minimumCapsuleApprovals','waitingPeriodEnforced',
      'sourceReferencesRevalidatedAtSealAndRelease','monotonicStateTimeEnforced','externalDeliveryPerformed'])
  &&value.truth.localOnly===true&&value.truth.linkedArchiveContentRemainsProtected===true&&value.truth.newBinaryPayloadStored===false
  &&value.truth.transcriptionPerformed===false&&value.truth.faceRecognitionPerformed===false&&value.truth.duplicateDetectionPerformed===false
  &&value.truth.documentaryRendered===false&&value.truth.printableBookRendered===false&&value.truth.printingPerformed===false
  &&value.truth.networkUsed===false&&value.truth.cloudUsed===false&&value.truth.manualCurationOnly===true
  &&value.truth.manualFaceGroupingOnly===true&&value.truth.minimumCapsuleApprovals===2&&value.truth.waitingPeriodEnforced===true
  &&value.truth.sourceReferencesRevalidatedAtSealAndRelease===true&&value.truth.monotonicStateTimeEnforced===true
  &&value.truth.externalDeliveryPerformed==='not_performed'&&healthCareIso(value.generatedAt);};
const memoryStudioReceiptResult=(value:unknown):boolean=>healthCareExactRecord(value,
  ['resourceType','resourceId','mutationKind','previousRevision','revision','occurredAt','replayed','networkUsed','cloudUsed',
    'externalDeliveryPerformed'])&&['memory_studio_record','memory_time_capsule'].includes(String(value.resourceType))
  &&healthCareIdentifier(value.resourceId)&&['record_create','record_delete','capsule_create','capsule_approve',
    'capsule_revoke_approval','capsule_seal','capsule_release','capsule_cancel','capsule_rollback'].includes(String(value.mutationKind))
  &&healthCareRevision(value.previousRevision)&&healthCareRevision(value.revision)&&value.revision===Number(value.previousRevision)+1
  &&healthCareIso(value.occurredAt)&&typeof value.replayed==='boolean'&&value.networkUsed===false&&value.cloudUsed===false
  &&value.externalDeliveryPerformed==='not_performed';
const memoryStudioReceiptMatchesChannel=(channel:string,value:unknown):boolean=>isObject(value)&&(
  (channel===MEMORY_STUDIO_IPC_CHANNELS.createRecord&&value.resourceType==='memory_studio_record'&&value.mutationKind==='record_create')
  ||(channel===MEMORY_STUDIO_IPC_CHANNELS.deleteRecord&&value.resourceType==='memory_studio_record'&&value.mutationKind==='record_delete')
  ||(channel===MEMORY_STUDIO_IPC_CHANNELS.createCapsule&&value.resourceType==='memory_time_capsule'&&value.mutationKind==='capsule_create')
  ||(channel===MEMORY_STUDIO_IPC_CHANNELS.reviewCapsule&&value.resourceType==='memory_time_capsule'
    &&['capsule_approve','capsule_revoke_approval'].includes(String(value.mutationKind)))
  ||(channel===MEMORY_STUDIO_IPC_CHANNELS.transitionCapsule&&value.resourceType==='memory_time_capsule'
    &&['capsule_seal','capsule_release','capsule_cancel','capsule_rollback'].includes(String(value.mutationKind))))
  &&(['record_create','capsule_create'].includes(String(value.mutationKind))
    ?value.previousRevision===0&&value.revision===1:Number(value.previousRevision)>=1);
const memoryStudioResult=(channel:string,result:unknown):IpcIntegrationPolicyDecision=>{
  const valid=channel===MEMORY_STUDIO_IPC_CHANNELS.getCenter?memoryStudioCenterResult(result)
    :memoryStudioReceiptResult(result)&&memoryStudioReceiptMatchesChannel(channel,result);
  return valid?accepted():rejected('MEMORY_STUDIO_RESULT_INVALID','$result');
};

export const SMART_HOME_ENERGY_IPC_CHANNELS=Object.freeze({
  getCenter:'smartHomeEnergy:getCenter',grantCameraConsent:'smartHomeEnergy:grantCameraConsent',
  revokeCameraConsent:'smartHomeEnergy:revokeCameraConsent',setProcessing:'smartHomeEnergy:setProcessing'
} as const);
const smartHomeEnergyChannels=new Set<string>(Object.values(SMART_HOME_ENERGY_IPC_CHANNELS));
const smartHomeDeviceKinds=new Set<unknown>(['matter_bridge','smoke_sensor','carbon_monoxide_sensor','water_leak_sensor',
  'door_sensor','temperature_sensor','humidity_sensor','energy_meter','thermostat','light','smart_plug','camera','doorbell','ev_charger']);
const smartHomeObservationKinds=new Set<unknown>(['smoke_alarm','carbon_monoxide_alarm','water_leak_alarm','door_open',
  'temperature_celsius','humidity_percent','energy_kilowatt_hour','power_watts','ev_charge_kilowatt_hour',
  'thermostat_target_celsius','light_on','smart_plug_on']);
const smartHomeInput=(channel:string,args:readonly unknown[]):IpcIntegrationPolicyDecision=>{
  if(channel===SMART_HOME_ENERGY_IPC_CHANNELS.getCenter)return zeroArguments(args);
  if(args.length!==1||!isObject(args[0]))return rejected('SMART_HOME_OBJECT_REQUIRED','$[0]');const value=args[0];
  if(channel===SMART_HOME_ENERGY_IPC_CHANNELS.grantCameraConsent)return healthCareExactRecord(value,
    ['clientOperationId','consentId','deviceId','purpose','expiresAt'])&&healthCareIdentifier(value.clientOperationId)
    &&healthCareIdentifier(value.consentId)&&healthCareIdentifier(value.deviceId)
    &&['live_view','doorbell_answer'].includes(String(value.purpose))&&healthCareIso(value.expiresAt)
    ?accepted():rejected('SMART_HOME_CAMERA_CONSENT_INPUT_INVALID','$[0]');
  if(channel===SMART_HOME_ENERGY_IPC_CHANNELS.revokeCameraConsent)return healthCareExactRecord(value,
    ['clientOperationId','consentId','expectedRevision'])&&healthCareIdentifier(value.clientOperationId)
    &&healthCareIdentifier(value.consentId)&&healthCareRevision(value.expectedRevision)&&Number(value.expectedRevision)>=1
    ?accepted():rejected('SMART_HOME_CAMERA_REVOKE_INPUT_INVALID','$[0]');
  if(channel===SMART_HOME_ENERGY_IPC_CHANNELS.setProcessing)return healthCareExactRecord(value,
    ['clientOperationId','expectedRevision','enabled','reason'])&&healthCareIdentifier(value.clientOperationId)
    &&healthCareRevision(value.expectedRevision)&&typeof value.enabled==='boolean'&&healthCareText(value.reason,3,500)
    ?accepted():rejected('SMART_HOME_PROCESSING_INPUT_INVALID','$[0]');
  return rejected('UNKNOWN_IPC_CHANNEL','$');
};
const smartHomeDeviceResult=(value:unknown):boolean=>{if(!isObject(value))return false;
  const optional=['room'].filter((key)=>value[key]!==undefined);
  return healthCareExactRecord(value,['id','ownerPersonId','adapterId','providerId','kind','label','status',
    'signedAdapterEvidencePersisted','revision','createdAt','updatedAt',...optional])&&healthCareIdentifier(value.id)
    &&healthCareIdentifier(value.ownerPersonId)&&healthCareIdentifier(value.adapterId)&&healthCareIdentifier(value.providerId)
    &&smartHomeDeviceKinds.has(value.kind)&&healthCareText(value.label,2,120)&&(value.room===undefined||healthCareText(value.room,2,120))
    &&['active','offline','retired'].includes(String(value.status))&&value.signedAdapterEvidencePersisted===true
    &&healthCareRevision(value.revision)&&Number(value.revision)>=1&&healthCareIso(value.createdAt)&&healthCareIso(value.updatedAt)
    &&Date.parse(String(value.updatedAt))>=Date.parse(String(value.createdAt));};
const smartHomeObservationResult=(value:unknown):boolean=>{if(!isObject(value))return false;
  const optional=['numericValue','booleanValue'].filter((key)=>value[key]!==undefined);
  return healthCareExactRecord(value,['id','deviceId','kind','unit','observedAt','recordedAt',...optional])
    &&healthCareIdentifier(value.id)&&healthCareIdentifier(value.deviceId)&&smartHomeObservationKinds.has(value.kind)
    &&['boolean','celsius','percent','watt','kilowatt_hour'].includes(String(value.unit))
    &&(value.numericValue===undefined||(typeof value.numericValue==='number'&&Number.isFinite(value.numericValue)))
    &&(value.booleanValue===undefined||typeof value.booleanValue==='boolean')
    &&((value.unit==='boolean'&&value.booleanValue!==undefined&&value.numericValue===undefined)
      ||(value.unit!=='boolean'&&value.numericValue!==undefined&&value.booleanValue===undefined))
    &&((['smoke_alarm','carbon_monoxide_alarm','water_leak_alarm','door_open','light_on','smart_plug_on'].includes(String(value.kind))&&value.unit==='boolean')
      ||(['temperature_celsius','thermostat_target_celsius'].includes(String(value.kind))&&value.unit==='celsius')
      ||(value.kind==='humidity_percent'&&value.unit==='percent')||(value.kind==='power_watts'&&value.unit==='watt')
      ||(['energy_kilowatt_hour','ev_charge_kilowatt_hour'].includes(String(value.kind))&&value.unit==='kilowatt_hour'))
    &&(value.numericValue===undefined||(value.kind==='temperature_celsius'&&value.numericValue>=-100&&value.numericValue<=100)
      ||(value.kind==='thermostat_target_celsius'&&value.numericValue>=-50&&value.numericValue<=60)
      ||(value.kind==='humidity_percent'&&value.numericValue>=0&&value.numericValue<=100)
      ||(!['temperature_celsius','thermostat_target_celsius','humidity_percent'].includes(String(value.kind))
        &&value.numericValue>=0&&value.numericValue<=1_000_000_000))
    &&healthCareIso(value.observedAt)&&healthCareIso(value.recordedAt)
    &&Date.parse(String(value.observedAt))>=Date.parse(String(value.recordedAt))-30*86_400_000
    &&Date.parse(String(value.observedAt))<=Date.parse(String(value.recordedAt))+5*60_000;};
const smartHomeConsentResult=(value:unknown):boolean=>{if(!isObject(value))return false;
  const optional=['revokedAt'].filter((key)=>value[key]!==undefined);
  return healthCareExactRecord(value,['id','deviceId','purpose','status','effectiveStatus','visibleIndicatorRequired',
    'expiresAt','revision','createdAt','updatedAt',...optional])&&healthCareIdentifier(value.id)
    &&healthCareIdentifier(value.deviceId)&&['live_view','doorbell_answer'].includes(String(value.purpose))
    &&['active','revoked'].includes(String(value.status))&&['active','expired','revoked'].includes(String(value.effectiveStatus))
    &&value.visibleIndicatorRequired===true&&healthCareIso(value.expiresAt)
    &&healthCareRevision(value.revision)&&Number(value.revision)>=1&&healthCareIso(value.createdAt)&&healthCareIso(value.updatedAt)
    &&Date.parse(String(value.updatedAt))>=Date.parse(String(value.createdAt))
    &&Date.parse(String(value.expiresAt))>=Date.parse(String(value.createdAt))+5*60_000
    &&Date.parse(String(value.expiresAt))<=Date.parse(String(value.createdAt))+60*60_000
    &&(value.revokedAt===undefined||healthCareIso(value.revokedAt))
    &&((value.status==='revoked'&&value.effectiveStatus==='revoked'&&value.revokedAt===value.updatedAt)
      ||(value.status==='active'&&['active','expired'].includes(String(value.effectiveStatus))&&value.revokedAt===undefined));};
const smartHomeSettingsResult=(value:unknown):boolean=>healthCareExactRecord(value,
  ['id','ownerPersonId','processingEnabled','cameraAccessDefaultDenied','hiddenSurveillanceProhibited','revision','createdAt','updatedAt'])
  &&healthCareIdentifier(value.id)&&healthCareIdentifier(value.ownerPersonId)&&typeof value.processingEnabled==='boolean'
  &&value.cameraAccessDefaultDenied===true&&value.hiddenSurveillanceProhibited===true&&healthCareRevision(value.revision)
  &&healthCareIso(value.createdAt)&&healthCareIso(value.updatedAt)
  &&Date.parse(String(value.updatedAt))>=Date.parse(String(value.createdAt));
const smartHomeCapacityBandResult=(value:unknown,maximum:number):boolean=>healthCareExactRecord(value,
  ['current','maximum','remaining','limitReached'])&&healthCareRevision(value.current)&&value.maximum===maximum
  &&value.current<=maximum&&value.remaining===maximum-value.current&&value.limitReached===(value.current>=maximum);
const smartHomeCenterResult=(value:unknown):boolean=>{
  if(!healthCareExactRecord(value,['schemaVersion','centerId','ownerPersonId','devices','observations','observationTotal',
    'observationsTruncated','cameraConsents','cameraConsentTotal','cameraConsentsTruncated','storageCapacity','settings','truth','generatedAt']))return false;
  const storage=value.storageCapacity;
  if(value.schemaVersion!==1||!healthCareIdentifier(value.centerId)||!healthCareIdentifier(value.ownerPersonId)
    ||!String(value.centerId).endsWith(`:${String(value.ownerPersonId)}`)||!householdArray(value.devices,500,smartHomeDeviceResult)
    ||!householdArray(value.observations,500,smartHomeObservationResult)||!householdArray(value.cameraConsents,500,smartHomeConsentResult)
    ||!healthCareRevision(value.observationTotal)||!healthCareRevision(value.cameraConsentTotal)
    ||typeof value.observationsTruncated!=='boolean'||typeof value.cameraConsentsTruncated!=='boolean'
    ||value.observationTotal<(value.observations as readonly unknown[]).length
    ||value.cameraConsentTotal<(value.cameraConsents as readonly unknown[]).length
    ||value.observationsTruncated!==(value.observationTotal>(value.observations as readonly unknown[]).length)
    ||value.cameraConsentsTruncated!==(value.cameraConsentTotal>(value.cameraConsents as readonly unknown[]).length)
    ||!smartHomeSettingsResult(value.settings)||!healthCareIso(value.generatedAt)
    ||!healthCareExactRecord(storage,['devices','observations','cameraConsents','mutations'])
    ||!smartHomeCapacityBandResult(storage.devices,500)
    ||!smartHomeCapacityBandResult(storage.observations,50_000)
    ||!smartHomeCapacityBandResult(storage.cameraConsents,2_000)
    ||!smartHomeCapacityBandResult(storage.mutations,100_000)
    ||(storage.devices as Record<string,unknown>).current!==(value.devices as readonly unknown[]).length
    ||(storage.observations as Record<string,unknown>).current!==value.observationTotal
    ||(storage.cameraConsents as Record<string,unknown>).current!==value.cameraConsentTotal
    ||!healthCareExactRecord(value.truth,['localFirst','cloudUsed','externalDeliveryPerformed','matterCommissioningPerformed',
      'liveProviderConnectionTested','liveDeviceControlPerformed','sensorProviderIngestionPerformed','rawCameraOrAudioStored',
      'hiddenSurveillanceProhibited','visibleTimeBoundedCameraConsentRequired','maximumCameraConsentMinutes',
      'signedAdapterEvidenceRequired','providerAvailabilityGuaranteed','observationPayloadMode','networkUsedByCurrentImplementation',
      'processingDisabledBlocksNewObservations','expiredConsentPresentedAsActive','boundedStorageCapsEnforced',
      'automaticRetentionRecoveryImplemented']))return false;
  if(value.truth.localFirst!==true||value.truth.cloudUsed!==false||value.truth.externalDeliveryPerformed!=='not_performed'
    ||value.truth.matterCommissioningPerformed!==false||value.truth.liveProviderConnectionTested!==false
    ||value.truth.liveDeviceControlPerformed!==false||value.truth.sensorProviderIngestionPerformed!==false
    ||value.truth.rawCameraOrAudioStored!==false||value.truth.hiddenSurveillanceProhibited!==true
    ||value.truth.visibleTimeBoundedCameraConsentRequired!==true||value.truth.maximumCameraConsentMinutes!==60
    ||value.truth.signedAdapterEvidenceRequired!==true||value.truth.providerAvailabilityGuaranteed!==false
    ||value.truth.observationPayloadMode!=='bounded_scalar_metadata_only'||value.truth.networkUsedByCurrentImplementation!==false
    ||value.truth.processingDisabledBlocksNewObservations!==true||value.truth.expiredConsentPresentedAsActive!==false
    ||value.truth.boundedStorageCapsEnforced!==true||value.truth.automaticRetentionRecoveryImplemented!==false)return false;
  const owner=String(value.ownerPersonId);const generatedAt=Date.parse(String(value.generatedAt));
  const devices=value.devices as readonly Record<string,unknown>[];const deviceIds=new Set(devices.map(item=>String(item.id)));
  if(devices.some(item=>item.ownerPersonId!==owner||Date.parse(String(item.updatedAt))>generatedAt)
    ||(value.settings as Record<string,unknown>).ownerPersonId!==owner
    ||Date.parse(String((value.settings as Record<string,unknown>).updatedAt))>generatedAt)return false;
  if((value.observations as readonly Record<string,unknown>[]).some(item=>!deviceIds.has(String(item.deviceId))
    ||Date.parse(String(item.recordedAt))>generatedAt))return false;
  return !(value.cameraConsents as readonly Record<string,unknown>[]).some(item=>!deviceIds.has(String(item.deviceId))
    ||Date.parse(String(item.updatedAt))>generatedAt
    ||(item.status==='active'&&item.effectiveStatus!==(Date.parse(String(item.expiresAt))<=generatedAt?'expired':'active')));
};
const smartHomeReceiptResult=(value:unknown):boolean=>healthCareExactRecord(value,
  ['resourceType','resourceId','mutationKind','previousRevision','revision','occurredAt','replayed','networkUsed','cloudUsed',
    'providerActionPerformed'])&&['smart_home_device','smart_home_observation','smart_home_camera_consent','smart_home_settings']
    .includes(String(value.resourceType))&&healthCareIdentifier(value.resourceId)
  &&['device_register','device_status_update','observation_record','camera_consent_grant','camera_consent_revoke',
    'processing_enable','processing_disable'].includes(String(value.mutationKind))&&healthCareRevision(value.previousRevision)
  &&healthCareRevision(value.revision)&&value.revision===Number(value.previousRevision)+1&&healthCareIso(value.occurredAt)
  &&typeof value.replayed==='boolean'&&value.networkUsed===false&&value.cloudUsed===false
  &&value.providerActionPerformed==='not_performed';
const smartHomeReceiptMatchesChannel=(channel:string,value:unknown):boolean=>isObject(value)&&(
  (channel===SMART_HOME_ENERGY_IPC_CHANNELS.grantCameraConsent&&value.resourceType==='smart_home_camera_consent'
    &&value.mutationKind==='camera_consent_grant'&&value.previousRevision===0&&value.revision===1)
  ||(channel===SMART_HOME_ENERGY_IPC_CHANNELS.revokeCameraConsent&&value.resourceType==='smart_home_camera_consent'
    &&value.mutationKind==='camera_consent_revoke'&&Number(value.previousRevision)>=1)
  ||(channel===SMART_HOME_ENERGY_IPC_CHANNELS.setProcessing&&value.resourceType==='smart_home_settings'
    &&['processing_enable','processing_disable'].includes(String(value.mutationKind))));
const smartHomeResult=(channel:string,result:unknown):IpcIntegrationPolicyDecision=>{
  const valid=channel===SMART_HOME_ENERGY_IPC_CHANNELS.getCenter?smartHomeCenterResult(result)
    :smartHomeReceiptResult(result)&&smartHomeReceiptMatchesChannel(channel,result);
  return valid?accepted():rejected('SMART_HOME_RESULT_INVALID','$result');
};

export const SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS=Object.freeze({
  getCenter:'signedPluginPlatform:getCenter',
  setDesiredState:'signedPluginPlatform:setDesiredState',
  emergencyDisable:'signedPluginPlatform:emergencyDisable',
  rollback:'signedPluginPlatform:rollback'
} as const);
const signedPluginPlatformChannels=new Set<string>(Object.values(SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS));
const signedPluginId=(value:unknown):boolean=>typeof value==='string'&&/^[a-z][a-z0-9.-]{2,63}$/u.test(value);
const signedPluginOperationId=(value:unknown):boolean=>typeof value==='string'
  &&/^[A-Za-z0-9][A-Za-z0-9._:-]{1,159}$/u.test(value);
const signedPluginSemver=(value:unknown):boolean=>typeof value==='string'
  &&value.length>=5&&value.length<=96
  &&/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?$/u.test(value);
const signedPluginInput=(channel:string,args:readonly unknown[]):IpcIntegrationPolicyDecision=>{
  if(channel===SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.getCenter)return zeroArguments(args);
  if(args.length!==1||!isObject(args[0]))return rejected('SIGNED_PLUGIN_OBJECT_REQUIRED','$[0]');const value=args[0];
  if(channel===SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.setDesiredState)return healthCareExactRecord(value,
    ['clientOperationId','pluginId','expectedRevision','enabled','reason'])&&signedPluginOperationId(value.clientOperationId)
    &&signedPluginId(value.pluginId)&&healthCareRevision(value.expectedRevision)&&Number(value.expectedRevision)>=1
    &&typeof value.enabled==='boolean'&&healthCareText(value.reason,3,500)
    ?accepted():rejected('SIGNED_PLUGIN_DESIRED_STATE_INPUT_INVALID','$[0]');
  if(channel===SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.emergencyDisable)return healthCareExactRecord(value,
    ['clientOperationId','pluginId','expectedRevision','confirmation','reason'])&&signedPluginOperationId(value.clientOperationId)
    &&signedPluginId(value.pluginId)&&healthCareRevision(value.expectedRevision)&&Number(value.expectedRevision)>=1
    &&value.confirmation==='EKLENTIYI ACIL DURDUR'&&healthCareText(value.reason,3,500)
    ?accepted():rejected('SIGNED_PLUGIN_EMERGENCY_INPUT_INVALID','$[0]');
  if(channel===SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.rollback)return healthCareExactRecord(value,
    ['clientOperationId','pluginId','expectedRevision','targetVersion','confirmation'])&&signedPluginOperationId(value.clientOperationId)
    &&signedPluginId(value.pluginId)&&healthCareRevision(value.expectedRevision)&&Number(value.expectedRevision)>=1
    &&signedPluginSemver(value.targetVersion)&&value.confirmation==='ONCEKI SURUME DON'
    ?accepted():rejected('SIGNED_PLUGIN_ROLLBACK_INPUT_INVALID','$[0]');
  return rejected('UNKNOWN_IPC_CHANNEL','$');
};
const signedPluginReleaseResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['version','minimumHostVersion','providerKinds','capabilityCodes','dataDeclarations','egressMode','egressHostCount','sandboxProfile',
    'signatureVerified','sbomEvidencePresent','licenseInventoryEvidencePresent','provenanceEvidencePresent','verifiedAt','expiresAt',
    'manifestStatus'])
  &&signedPluginSemver(value.version)&&signedPluginSemver(value.minimumHostVersion)
  &&Array.isArray(value.providerKinds)&&value.providerKinds.length>=1&&value.providerKinds.length<=9
  &&value.providerKinds.every(item=>['bank','school','matter','fhir','onedrive','maps','ocr','ai','browser'].includes(String(item)))
  &&new Set(value.providerKinds).size===value.providerKinds.length&&Array.isArray(value.capabilityCodes)
  &&value.capabilityCodes.length>=1&&value.capabilityCodes.length<=16&&value.capabilityCodes.every(item=>
    ['bank.read','school.read','matter.read','fhir.read','onedrive.read','maps.read','ocr.process','ai.process','browser.read'].includes(String(item)))
  &&new Set(value.capabilityCodes).size===value.capabilityCodes.length&&Array.isArray(value.dataDeclarations)
  &&value.dataDeclarations.length>=1&&value.dataDeclarations.length<=32&&value.dataDeclarations.every(item=>isObject(item)&&healthCareExactRecord(item,
    ['resourceType','sensitivity','purpose','access','retentionDays'])&&healthCareIdentifier(item.resourceType)
    &&['standard','personal','highly_sensitive'].includes(String(item.sensitivity))
    &&['general','finance','education','home_automation','health','document_processing','ai_assistance','browser_assistance'].includes(String(item.purpose))
    &&['read_metadata','read_content','process_local'].includes(String(item.access))&&Number.isSafeInteger(item.retentionDays)
    &&Number(item.retentionDays)>=0&&Number(item.retentionDays)<=30)
  &&['none','allowlist'].includes(String(value.egressMode))&&Number.isSafeInteger(value.egressHostCount)
  &&Number(value.egressHostCount)>=0&&Number(value.egressHostCount)<=16&&value.sandboxProfile==='isolated_child_process'
  &&value.signatureVerified===true&&value.sbomEvidencePresent===true&&value.licenseInventoryEvidencePresent===true
  &&value.provenanceEvidencePresent===true&&healthCareIso(value.verifiedAt)&&healthCareIso(value.expiresAt)
  &&['valid','expired'].includes(String(value.manifestStatus));
const signedPluginInstallationResult=(value:unknown):boolean=>{
  if(!isObject(value))return false;
  const keys=['id','ownerPersonId','displayName','currentRelease','desiredState','runtimeExecutionReady',
    'externalProviderConnectionReady','rollbackAvailable','releaseHistoryCount','releaseHistoryLimitReached',
    'revision','createdAt','updatedAt',
    ...(value.previousVersion===undefined?[]:['previousVersion']),...(value.emergencyDisabledAt===undefined?[]:['emergencyDisabledAt'])];
  return healthCareExactRecord(value,keys)&&signedPluginId(value.id)&&healthCareIdentifier(value.ownerPersonId)
    &&healthCareText(value.displayName,2,120)&&signedPluginReleaseResult(value.currentRelease)
    &&(value.previousVersion===undefined||signedPluginSemver(value.previousVersion))
    &&['enabled','disabled','emergency_disabled'].includes(String(value.desiredState))&&value.runtimeExecutionReady===false
    &&value.externalProviderConnectionReady===false&&typeof value.rollbackAvailable==='boolean'
    &&(value.desiredState!=='emergency_disabled'||value.rollbackAvailable===false)
    &&Number.isSafeInteger(value.releaseHistoryCount)&&Number(value.releaseHistoryCount)>=1&&Number(value.releaseHistoryCount)<=64
    &&typeof value.releaseHistoryLimitReached==='boolean'
    &&value.releaseHistoryLimitReached===(Number(value.releaseHistoryCount)>=64)
    &&healthCareRevision(value.revision)&&Number(value.revision)>=1&&healthCareIso(value.createdAt)&&healthCareIso(value.updatedAt)
    &&(value.desiredState==='emergency_disabled'
      ?healthCareIso(value.emergencyDisabledAt):value.emergencyDisabledAt===undefined);
};
const signedPluginTruthResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,[
  'localCandidateRegistryImplemented','manifestCryptographyImplemented','verifiedManifestRequired','capabilityDefaultDeny',
  'networkBrokerRequired','sandboxContractRequired','rollbackRegistryImplemented','emergencyDisableRegistryImplemented',
  'sbomLicenseAndProvenanceHashesRequired','supplyChainReleaseGateRequired','rendererInstallAuthority',
  'thirdPartyCodeExecutionPerformed','externalProviderConnectionPerformed','providerCredentialsStored',
  'productionSigningTrustProvisioned','productionReleaseEligible','sandboxRuntimeVerified','osNetworkIsolationVerified',
  'providerAvailabilityGuaranteed','networkUsedByCurrentImplementation','minimumHostVersionEnforced',
  'emergencyDisableRequiresNewHigherSignedRelease','boundedStorageCapsEnforced','automaticRetentionRecoveryImplemented'])
  &&value.localCandidateRegistryImplemented===true&&value.manifestCryptographyImplemented===true
  &&value.verifiedManifestRequired===true&&value.capabilityDefaultDeny===true&&value.networkBrokerRequired===true
  &&value.sandboxContractRequired===true&&value.rollbackRegistryImplemented===true
  &&value.emergencyDisableRegistryImplemented===true&&value.sbomLicenseAndProvenanceHashesRequired===true
  &&value.supplyChainReleaseGateRequired===true&&value.rendererInstallAuthority===false
  &&value.thirdPartyCodeExecutionPerformed===false&&value.externalProviderConnectionPerformed===false
  &&value.providerCredentialsStored===false&&value.productionSigningTrustProvisioned===false
  &&value.productionReleaseEligible===false&&value.sandboxRuntimeVerified===false&&value.osNetworkIsolationVerified===false
  &&value.providerAvailabilityGuaranteed===false&&value.networkUsedByCurrentImplementation===false
  &&value.minimumHostVersionEnforced===true&&value.emergencyDisableRequiresNewHigherSignedRelease===true
  &&value.boundedStorageCapsEnforced===true&&value.automaticRetentionRecoveryImplemented===false;
const signedPluginCapacityBand=(value:unknown,maximum:number):boolean=>isObject(value)
  &&healthCareExactRecord(value,['current','maximum','remaining','limitReached'])
  &&Number.isSafeInteger(value.current)&&Number(value.current)>=0&&Number(value.current)<=maximum
  &&value.maximum===maximum&&value.remaining===maximum-Number(value.current)
  &&value.limitReached===(Number(value.current)>=maximum);
const signedPluginCenterResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['schemaVersion','centerId','ownerPersonId','installations','installationTotal','storageCapacity','truth','generatedAt'])&&value.schemaVersion===1
  &&healthCareIdentifier(value.centerId)&&healthCareIdentifier(value.ownerPersonId)&&Array.isArray(value.installations)
  &&value.installations.length<=200&&value.installations.every(signedPluginInstallationResult)
  &&Number.isSafeInteger(value.installationTotal)&&Number(value.installationTotal)===value.installations.length
  &&isObject(value.storageCapacity)&&healthCareExactRecord(value.storageCapacity,['installations','mutations'])
  &&signedPluginCapacityBand(value.storageCapacity.installations,200)
  &&signedPluginCapacityBand(value.storageCapacity.mutations,100000)
  &&signedPluginTruthResult(value.truth)&&healthCareIso(value.generatedAt);
const signedPluginReceiptResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['pluginId','mutationKind','previousRevision','revision','occurredAt','replayed','runtimeExecutionPerformed',
    'externalProviderConnectionPerformed','networkUsed'])&&signedPluginId(value.pluginId)
  &&['release_register','release_update','desired_enable','desired_disable','emergency_disable','release_rollback'].includes(String(value.mutationKind))
  &&healthCareRevision(value.previousRevision)&&healthCareRevision(value.revision)&&value.revision===Number(value.previousRevision)+1
  &&healthCareIso(value.occurredAt)&&typeof value.replayed==='boolean'&&value.runtimeExecutionPerformed===false
  &&value.externalProviderConnectionPerformed===false&&value.networkUsed===false;
const signedPluginResult=(channel:string,result:unknown):IpcIntegrationPolicyDecision=>{
  const receiptMatches=channel===SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.setDesiredState&&isObject(result)
      &&['desired_enable','desired_disable'].includes(String(result.mutationKind))
    ||channel===SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.emergencyDisable&&isObject(result)&&result.mutationKind==='emergency_disable'
    ||channel===SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.rollback&&isObject(result)&&result.mutationKind==='release_rollback';
  const valid=channel===SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.getCenter?signedPluginCenterResult(result)
    :signedPluginReceiptResult(result)&&receiptMatches;
  return valid?accepted():rejected('SIGNED_PLUGIN_RESULT_INVALID','$result');
};

export const COMMUNICATION_SECURITY_IPC_CHANNELS=Object.freeze({
  getCenter:'communicationSecurity:getCenter',
  registerDeviceCredential:'communicationSecurity:registerDeviceCredential',
  revokeDeviceCredential:'communicationSecurity:revokeDeviceCredential',
  createRoom:'communicationSecurity:createRoom',
  addMember:'communicationSecurity:addMember',
  removeMember:'communicationSecurity:removeMember',
  rekeyRoom:'communicationSecurity:rekeyRoom',
  setHistoryAccess:'communicationSecurity:setHistoryAccess',
  freezeRoom:'communicationSecurity:freezeRoom'
} as const);
const communicationSecurityChannels=new Set<string>(Object.values(COMMUNICATION_SECURITY_IPC_CHANNELS));
const communicationIdentifier=(value:unknown):value is string=>typeof value==='string'&&value===value.trim()
  &&value.length>=2&&value.length<=160&&/^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/u.test(value);
const communicationInput=(channel:string,args:readonly unknown[]):IpcIntegrationPolicyDecision=>{
  if(channel===COMMUNICATION_SECURITY_IPC_CHANNELS.getCenter)return zeroArguments(args);
  if(args.length!==1||!isObject(args[0]))return rejected('COMMUNICATION_OBJECT_REQUIRED','$[0]');
  const value=args[0];
  if(channel===COMMUNICATION_SECURITY_IPC_CHANNELS.registerDeviceCredential)return healthCareExactRecord(value,
    ['clientOperationId','expectedRevision'])&&communicationIdentifier(value.clientOperationId)&&value.expectedRevision===0
    ?accepted():rejected('COMMUNICATION_DEVICE_REGISTER_INPUT_INVALID','$[0]');
  if(channel===COMMUNICATION_SECURITY_IPC_CHANNELS.revokeDeviceCredential)return healthCareExactRecord(value,
    ['clientOperationId','expectedRevision','deviceCredentialId','confirmation','reason'])
    &&communicationIdentifier(value.clientOperationId)&&healthCareRevision(value.expectedRevision)&&Number(value.expectedRevision)>=1
    &&communicationIdentifier(value.deviceCredentialId)&&value.confirmation==='ILETISIM CIHAZ KIMLIGINI IPTAL ET'
    &&healthCareText(value.reason,3,500)
    ?accepted():rejected('COMMUNICATION_DEVICE_REVOKE_INPUT_INVALID','$[0]');
  if(channel===COMMUNICATION_SECURITY_IPC_CHANNELS.createRoom){
    return healthCareExactRecord(value,['clientOperationId','expectedRevision','ownerDeviceCredentialId','roomType','displayName'])
      &&communicationIdentifier(value.clientOperationId)&&value.expectedRevision===0
      &&communicationIdentifier(value.ownerDeviceCredentialId)
      &&['direct','family','household','family_branch','event','care','private_topic'].includes(String(value.roomType))
      &&healthCareText(value.displayName,2,160)
      ?accepted():rejected('COMMUNICATION_ROOM_CREATE_INPUT_INVALID','$[0]');
  }
  if(channel===COMMUNICATION_SECURITY_IPC_CHANNELS.addMember)return healthCareExactRecord(value,
    ['clientOperationId','expectedRevision','roomId','memberPersonId','deviceCredentialId','role'])
    &&communicationIdentifier(value.clientOperationId)&&healthCareRevision(value.expectedRevision)&&Number(value.expectedRevision)>=1
    &&communicationIdentifier(value.roomId)&&communicationIdentifier(value.memberPersonId)
    &&communicationIdentifier(value.deviceCredentialId)&&['administrator','member'].includes(String(value.role))
    ?accepted():rejected('COMMUNICATION_MEMBER_ADD_INPUT_INVALID','$[0]');
  if(channel===COMMUNICATION_SECURITY_IPC_CHANNELS.removeMember)return healthCareExactRecord(value,
    ['clientOperationId','expectedRevision','roomId','membershipId','reason'])
    &&communicationIdentifier(value.clientOperationId)&&healthCareRevision(value.expectedRevision)&&Number(value.expectedRevision)>=1
    &&communicationIdentifier(value.roomId)&&communicationIdentifier(value.membershipId)&&healthCareText(value.reason,3,500)
    ?accepted():rejected('COMMUNICATION_MEMBER_REMOVE_INPUT_INVALID','$[0]');
  if(channel===COMMUNICATION_SECURITY_IPC_CHANNELS.rekeyRoom){
    const keys=['clientOperationId','expectedRevision','roomId','revokedDeviceCredentialId','confirmation','reason',
      ...(value.replacementDeviceCredentialId===undefined?[]:['replacementDeviceCredentialId'])];
    return healthCareExactRecord(value,keys)
    &&communicationIdentifier(value.clientOperationId)&&healthCareRevision(value.expectedRevision)&&Number(value.expectedRevision)>=1
    &&communicationIdentifier(value.roomId)&&communicationIdentifier(value.revokedDeviceCredentialId)
    &&(value.replacementDeviceCredentialId===undefined||(communicationIdentifier(value.replacementDeviceCredentialId)
      &&value.replacementDeviceCredentialId!==value.revokedDeviceCredentialId))
    &&value.confirmation==='KAYIP CIHAZ SONRASI ODAYI YENIDEN ANAHTARLA'&&healthCareText(value.reason,3,500)
    ?accepted():rejected('COMMUNICATION_ROOM_REKEY_INPUT_INVALID','$[0]');
  }
  if(channel===COMMUNICATION_SECURITY_IPC_CHANNELS.setHistoryAccess)return healthCareExactRecord(value,
    ['clientOperationId','expectedRevision','roomId','historyAccessMode','reason'])
    &&communicationIdentifier(value.clientOperationId)&&healthCareRevision(value.expectedRevision)&&Number(value.expectedRevision)>=1
    &&communicationIdentifier(value.roomId)&&['new_members_no_history','explicit_snapshot_grant'].includes(String(value.historyAccessMode))
    &&healthCareText(value.reason,3,500)
    ?accepted():rejected('COMMUNICATION_HISTORY_INPUT_INVALID','$[0]');
  if(channel===COMMUNICATION_SECURITY_IPC_CHANNELS.freezeRoom)return healthCareExactRecord(value,
    ['clientOperationId','expectedRevision','roomId','confirmation','reason'])
    &&communicationIdentifier(value.clientOperationId)&&healthCareRevision(value.expectedRevision)&&Number(value.expectedRevision)>=1
    &&communicationIdentifier(value.roomId)&&value.confirmation==='ILETISIM ODASINI DONDUR'&&healthCareText(value.reason,3,500)
    ?accepted():rejected('COMMUNICATION_ROOM_FREEZE_INPUT_INVALID','$[0]');
  return rejected('UNKNOWN_IPC_CHANNEL','$');
};
const communicationDeviceResult=(value:unknown):boolean=>{
  if(!isObject(value))return false;
  const keys=['id','trustedDeviceId','status','providerVerified','keyPackageStoredOutsideDatabase','revision','createdAt','updatedAt',
    ...(value.revokedAt===undefined?[]:['revokedAt'])];
  return healthCareExactRecord(value,keys)&&communicationIdentifier(value.id)&&communicationIdentifier(value.trustedDeviceId)
    &&['active','revoked'].includes(String(value.status))&&value.providerVerified===true
    &&value.keyPackageStoredOutsideDatabase===true&&healthCareRevision(value.revision)&&Number(value.revision)>=1
    &&healthCareIso(value.createdAt)&&healthCareIso(value.updatedAt)&&(value.revokedAt===undefined||healthCareIso(value.revokedAt));
};
const communicationMembershipResult=(value:unknown):boolean=>{
  if(!isObject(value))return false;
  const keys=['id','memberPersonId','deviceCredentialId','role','status','joinedAtEpoch','historyVisibleFromEpoch',
    ...(value.removedAtEpoch===undefined?[]:['removedAtEpoch'])];
  return healthCareExactRecord(value,keys)&&communicationIdentifier(value.id)&&communicationIdentifier(value.memberPersonId)
    &&communicationIdentifier(value.deviceCredentialId)&&['owner','administrator','member'].includes(String(value.role))
    &&['active','removed'].includes(String(value.status))&&Number.isSafeInteger(value.joinedAtEpoch)&&Number(value.joinedAtEpoch)>=1
    &&Number.isSafeInteger(value.historyVisibleFromEpoch)&&Number(value.historyVisibleFromEpoch)>=Number(value.joinedAtEpoch)
    &&(value.removedAtEpoch===undefined||(Number.isSafeInteger(value.removedAtEpoch)&&Number(value.removedAtEpoch)>Number(value.joinedAtEpoch)));
};
const communicationEpochResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['epoch','cipherSuite','providerEvidenceVerified','sealedProviderStateStored','activeDeviceCredentialCount','createdAt','reason'])
  &&Number.isSafeInteger(value.epoch)&&Number(value.epoch)>=1
  &&value.cipherSuite==='MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519'
  &&value.providerEvidenceVerified===true&&value.sealedProviderStateStored===true
  &&Number.isSafeInteger(value.activeDeviceCredentialCount)&&Number(value.activeDeviceCredentialCount)>=1
  &&Number(value.activeDeviceCredentialCount)<=128&&healthCareIso(value.createdAt)
    &&['room_created','member_added','member_removed','device_revoked_recovery'].includes(String(value.reason));
const communicationCapacityResult=(value:unknown,limit:number):boolean=>isObject(value)
  &&healthCareExactRecord(value,['current','limit','limitReached'])&&Number.isSafeInteger(value.current)
  &&Number(value.current)>=0&&value.limit===limit&&value.limitReached===(Number(value.current)>=limit);
const communicationRoomResult=(value:unknown):boolean=>{
  if(!isObject(value))return false;
  const keys=['id','displayName','roomType','status','historyAccessMode','currentEpoch','memberships','currentEpochEvidence','storageCapacity',
    'revision','createdAt','updatedAt'];
  return healthCareExactRecord(value,keys)&&communicationIdentifier(value.id)&&healthCareText(value.displayName,2,160)
    &&['direct','family','household','family_branch','event','care','private_topic'].includes(String(value.roomType))
    &&['active','frozen','closed'].includes(String(value.status))
    &&['new_members_no_history','explicit_snapshot_grant'].includes(String(value.historyAccessMode))
    &&Number.isSafeInteger(value.currentEpoch)&&Number(value.currentEpoch)>=1&&Array.isArray(value.memberships)
    &&value.memberships.length>=1&&value.memberships.length<=128&&value.memberships.every(communicationMembershipResult)
    &&communicationEpochResult(value.currentEpochEvidence)&&healthCareRevision(value.revision)&&Number(value.revision)>=1
    &&isObject(value.storageCapacity)&&healthCareExactRecord(value.storageCapacity,['epochs','memberships'])
    &&communicationCapacityResult(value.storageCapacity.memberships,128)
    &&communicationCapacityResult(value.storageCapacity.epochs,4096)
    &&healthCareIso(value.createdAt)&&healthCareIso(value.updatedAt);
};
const communicationTruthResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,[
  'centralPolicyKernelRequired','localRoomAndEpochMetadataRegistryImplemented','opaqueSealedMlsStateRequired',
  'verifiedProviderEvidenceRequired','newMemberHistoryDefaultDenied','revokedDeviceRekeyWorkflowImplemented',
  'revokedCredentialBlocksRoomEpochMutationUntilRekey','automaticRoomRekeyOnCredentialRevocation',
  'contentFreeAuditRequired','rendererKeyMaterialAuthority','rendererRelayAuthority','privateKeyPersistedInDatabase',
  'messagePlaintextPersistedByFoundation','messageEventSignatureVerificationImplemented','relayDeliveryServiceImplemented',
  'rfc9420ProviderConfigured','rfc9420ConformanceVerified','forwardSecrecyVerifiedInProduction',
  'postCompromiseSecurityVerifiedInProduction','relayContentBlindnessVerifiedInProduction','realMessageExchangePerformed',
  'networkUsedByCurrentImplementation','scopedResourceAuthorizationImplemented','boundedMetadataStorageEnforced',
  'automaticRetentionRecoveryImplemented'])
  &&value.centralPolicyKernelRequired===true&&value.localRoomAndEpochMetadataRegistryImplemented===true
  &&value.opaqueSealedMlsStateRequired===true&&value.verifiedProviderEvidenceRequired===true
  &&value.newMemberHistoryDefaultDenied===true&&value.revokedDeviceRekeyWorkflowImplemented===true
  &&value.revokedCredentialBlocksRoomEpochMutationUntilRekey===true&&value.automaticRoomRekeyOnCredentialRevocation===false
  &&value.contentFreeAuditRequired===true&&value.rendererKeyMaterialAuthority===false&&value.rendererRelayAuthority===false
  &&value.privateKeyPersistedInDatabase===false&&value.messagePlaintextPersistedByFoundation===false
  &&value.messageEventSignatureVerificationImplemented===false&&value.relayDeliveryServiceImplemented===false
  &&value.rfc9420ProviderConfigured===false&&value.rfc9420ConformanceVerified===false
  &&value.forwardSecrecyVerifiedInProduction===false&&value.postCompromiseSecurityVerifiedInProduction===false
  &&value.relayContentBlindnessVerifiedInProduction===false&&value.realMessageExchangePerformed===false
  &&value.networkUsedByCurrentImplementation===false&&value.scopedResourceAuthorizationImplemented===false
  &&value.boundedMetadataStorageEnforced===true&&value.automaticRetentionRecoveryImplemented===false;
const communicationCenterResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['schemaVersion','centerId','ownerPersonId','deviceCredentials','rooms','storageCapacity','truth','generatedAt'])&&value.schemaVersion===1
  &&communicationIdentifier(value.centerId)&&communicationIdentifier(value.ownerPersonId)
  &&Array.isArray(value.deviceCredentials)&&value.deviceCredentials.length<=32&&value.deviceCredentials.every(communicationDeviceResult)
  &&Array.isArray(value.rooms)&&value.rooms.length<=256&&value.rooms.every(communicationRoomResult)
  &&isObject(value.storageCapacity)&&healthCareExactRecord(value.storageCapacity,['deviceCredentials','mutations','rooms'])
  &&communicationCapacityResult(value.storageCapacity.deviceCredentials,32)
  &&communicationCapacityResult(value.storageCapacity.rooms,256)
  &&communicationCapacityResult(value.storageCapacity.mutations,100000)
  &&communicationTruthResult(value.truth)&&healthCareIso(value.generatedAt);
const communicationReceiptResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['resourceType','resourceId','mutationKind','previousRevision','revision','occurredAt','replayed','messageContentProcessed','networkUsed'])
  &&['communication_device_credential','communication_room'].includes(String(value.resourceType))
  &&communicationIdentifier(value.resourceId)
  &&['device_credential_register','device_credential_revoke','room_create','member_add','member_remove','history_policy_update',
    'device_revocation_rekey','room_freeze'].includes(String(value.mutationKind))
  &&healthCareRevision(value.previousRevision)&&healthCareRevision(value.revision)&&value.revision===Number(value.previousRevision)+1
  &&healthCareIso(value.occurredAt)&&typeof value.replayed==='boolean'&&value.messageContentProcessed===false&&value.networkUsed===false;
const communicationResult=(channel:string,result:unknown):IpcIntegrationPolicyDecision=>{
  const valid=channel===COMMUNICATION_SECURITY_IPC_CHANNELS.getCenter
    ?communicationCenterResult(result):communicationReceiptResult(result);
  return valid?accepted():rejected('COMMUNICATION_RESULT_INVALID','$result');
};

export const COMMUNICATION_MESSAGING_IPC_CHANNELS=Object.freeze({
  getCenter:'communicationMessaging:getCenter',
  search:'communicationMessaging:search',
  getContent:'communicationMessaging:getContent',
  create:'communicationMessaging:create',
  edit:'communicationMessaging:edit',
  setLifecycle:'communicationMessaging:setLifecycle',
  annotate:'communicationMessaging:annotate',
  updateDelivery:'communicationMessaging:updateDelivery',
  setPresence:'communicationMessaging:setPresence',
  setRetentionPolicy:'communicationMessaging:setRetentionPolicy'
} as const);
const communicationMessagingChannels=new Set<string>(Object.values(COMMUNICATION_MESSAGING_IPC_CHANNELS));
const communicationMessagingContentKinds=new Set(['text','voice','photo','video','location','document']);
const communicationMessagingDocumentMimes=new Set(['application/pdf','text/plain','application/json','text/csv']);
const communicationMessagingIso=(value:unknown):boolean=>typeof value==='string'
  &&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)&&Number.isFinite(Date.parse(value));
const communicationMessagingText=(value:unknown,minimum:number,maximum:number):boolean=>typeof value==='string'
  &&value===value.normalize('NFKC')&&value.trim().length>=minimum&&value.length<=maximum&&!/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value);
const communicationMessagingRevision=(value:unknown,allowZero=false):boolean=>Number.isSafeInteger(value)
  &&Number(value)>=(allowZero?0:1)&&Number(value)<=Number.MAX_SAFE_INTEGER;
const communicationMessagingOptionalId=(value:unknown):boolean=>value===undefined||communicationIdentifier(value);
const communicationMessagingInput=(channel:string,args:readonly unknown[]):IpcIntegrationPolicyDecision=>{
  if(channel===COMMUNICATION_MESSAGING_IPC_CHANNELS.getCenter)return zeroArguments(args);
  if(channel===COMMUNICATION_MESSAGING_IPC_CHANNELS.getContent)return exactObject(args,['messageId'],value=>
    communicationIdentifier(value.messageId));
  if(channel===COMMUNICATION_MESSAGING_IPC_CHANNELS.search){
    if(args.length!==1||!isObject(args[0]))return rejected('COMMUNICATION_MESSAGING_SEARCH_INPUT_INVALID','$[0]');
    const value=args[0];
    const keys=['queryText','roomId','senderPersonId','contentKind','from','to','includeDeleted','limit'].filter(key=>value[key]!==undefined);
    return exactObject(args,keys,candidate=>communicationMessagingOptionalId(candidate.roomId)
      &&(candidate.queryText===undefined||communicationMessagingText(candidate.queryText,1,128))
      &&communicationMessagingOptionalId(candidate.senderPersonId)
      &&(candidate.contentKind===undefined||communicationMessagingContentKinds.has(String(candidate.contentKind)))
      &&(candidate.from===undefined||communicationMessagingIso(candidate.from))
      &&(candidate.to===undefined||communicationMessagingIso(candidate.to))
      &&(candidate.from===undefined||candidate.to===undefined||Date.parse(String(candidate.from))<=Date.parse(String(candidate.to)))
      &&(candidate.includeDeleted===undefined||typeof candidate.includeDeleted==='boolean')
      &&(candidate.limit===undefined||(Number.isSafeInteger(candidate.limit)&&Number(candidate.limit)>=1&&Number(candidate.limit)<=200)));
  }
  if(channel===COMMUNICATION_MESSAGING_IPC_CHANNELS.create){
    if(args.length!==1||!isObject(args[0]))return rejected('COMMUNICATION_MESSAGING_CREATE_INPUT_INVALID','$[0]');
    const value=args[0];
    const keys=['clientOperationId','expectedRevision','roomId','contentKind','contentMime','text','opaqueAttachmentHandle',
      'replyToMessageId','quotedMessageId','threadRootMessageId','scheduledAt','silent'].filter(key=>value[key]!==undefined);
    return exactObject(args,keys,candidate=>communicationIdentifier(candidate.clientOperationId)&&candidate.expectedRevision===0
      &&communicationIdentifier(candidate.roomId)&&communicationMessagingContentKinds.has(String(candidate.contentKind))
      &&typeof candidate.contentMime==='string'&&/^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,127}$/u.test(candidate.contentMime)
      &&((candidate.contentKind==='text'&&candidate.contentMime==='text/plain'
          &&communicationMessagingText(candidate.text,1,32_768)&&candidate.opaqueAttachmentHandle===undefined)
        ||(candidate.contentKind==='location'&&candidate.contentMime==='application/vnd.ppt.location+text'
          &&communicationMessagingText(candidate.text,1,2_000)&&candidate.opaqueAttachmentHandle===undefined)
        ||(candidate.contentKind==='voice'&&String(candidate.contentMime).startsWith('audio/')&&candidate.text===undefined
          &&communicationIdentifier(candidate.opaqueAttachmentHandle))
        ||(candidate.contentKind==='photo'&&String(candidate.contentMime).startsWith('image/')&&candidate.text===undefined
          &&communicationIdentifier(candidate.opaqueAttachmentHandle))
        ||(candidate.contentKind==='video'&&String(candidate.contentMime).startsWith('video/')&&candidate.text===undefined
          &&communicationIdentifier(candidate.opaqueAttachmentHandle))
        ||(candidate.contentKind==='document'&&communicationMessagingDocumentMimes.has(String(candidate.contentMime))
          &&candidate.text===undefined&&communicationIdentifier(candidate.opaqueAttachmentHandle)))
      &&communicationMessagingOptionalId(candidate.replyToMessageId)&&communicationMessagingOptionalId(candidate.quotedMessageId)
      &&communicationMessagingOptionalId(candidate.threadRootMessageId)
      &&(candidate.scheduledAt===undefined||communicationMessagingIso(candidate.scheduledAt))
      &&(candidate.silent===undefined||typeof candidate.silent==='boolean'));
  }
  if(channel===COMMUNICATION_MESSAGING_IPC_CHANNELS.edit)return exactObject(args,
    ['clientOperationId','expectedRevision','messageId','text','reason'],value=>
      communicationIdentifier(value.clientOperationId)&&communicationMessagingRevision(value.expectedRevision)
      &&communicationIdentifier(value.messageId)&&communicationMessagingText(value.text,1,32_768)
      &&communicationMessagingText(value.reason,3,500));
  if(channel===COMMUNICATION_MESSAGING_IPC_CHANNELS.setLifecycle)return exactObject(args,
    ['clientOperationId','expectedRevision','messageId','action','reason'],value=>
      communicationIdentifier(value.clientOperationId)&&communicationMessagingRevision(value.expectedRevision)
      &&communicationIdentifier(value.messageId)&&['delete','restore'].includes(String(value.action))
      &&communicationMessagingText(value.reason,3,500));
  if(channel===COMMUNICATION_MESSAGING_IPC_CHANNELS.annotate){
    if(args.length!==1||!isObject(args[0]))return rejected('COMMUNICATION_MESSAGING_ANNOTATE_INPUT_INVALID','$[0]');
    const value=args[0];
    const optional=['reactionCode','pinned','bookmarked'].filter(key=>value[key]!==undefined);
    return exactObject(args,['clientOperationId','expectedRevision','messageId',...optional],candidate=>
      communicationIdentifier(candidate.clientOperationId)&&communicationMessagingRevision(candidate.expectedRevision)
      &&communicationIdentifier(candidate.messageId)&&optional.length===1
      &&(candidate.reactionCode===undefined||communicationMessagingText(candidate.reactionCode,1,32))
      &&(candidate.pinned===undefined||typeof candidate.pinned==='boolean')
      &&(candidate.bookmarked===undefined||typeof candidate.bookmarked==='boolean'));
  }
  if(channel===COMMUNICATION_MESSAGING_IPC_CHANNELS.updateDelivery)return exactObject(args,
    ['clientOperationId','expectedRevision','messageId','action'],value=>
      communicationIdentifier(value.clientOperationId)&&communicationMessagingRevision(value.expectedRevision)
      &&communicationIdentifier(value.messageId)&&['queue_offline','retry','mark_ready_local','cancel'].includes(String(value.action)));
  if(channel===COMMUNICATION_MESSAGING_IPC_CHANNELS.setPresence){
    if(args.length!==1||!isObject(args[0]))return rejected('COMMUNICATION_MESSAGING_PRESENCE_INPUT_INVALID','$[0]');
    const value=args[0];
    const keys=['clientOperationId','expectedRevision','status','audience','lastSeenShared','typingIndicatorsEnabled',
      'readReceiptsEnabled','emergencyReachabilityEnabled','expiresAt'].filter(key=>value[key]!==undefined);
    return exactObject(args,keys,candidate=>communicationIdentifier(candidate.clientOperationId)
      &&communicationMessagingRevision(candidate.expectedRevision,true)
      &&['online','away','busy','in_meeting','do_not_disturb','invisible','offline'].includes(String(candidate.status))
      &&['nobody','room_members','selected_people'].includes(String(candidate.audience))
      &&typeof candidate.lastSeenShared==='boolean'&&typeof candidate.typingIndicatorsEnabled==='boolean'
      &&typeof candidate.readReceiptsEnabled==='boolean'&&typeof candidate.emergencyReachabilityEnabled==='boolean'
      &&(candidate.expiresAt===undefined||communicationMessagingIso(candidate.expiresAt)));
  }
  if(channel===COMMUNICATION_MESSAGING_IPC_CHANNELS.setRetentionPolicy){
    if(args.length!==1||!isObject(args[0]))return rejected('COMMUNICATION_MESSAGING_RETENTION_INPUT_INVALID','$[0]');
    const value=args[0];
    const keys=['clientOperationId','expectedRevision','roomId','mode','durationDays','reason'].filter(key=>value[key]!==undefined);
    return exactObject(args,keys,candidate=>communicationIdentifier(candidate.clientOperationId)
      &&communicationMessagingRevision(candidate.expectedRevision,true)&&communicationIdentifier(candidate.roomId)
      &&['permanent','duration','auto_delete','legal_hold'].includes(String(candidate.mode))
      &&((['duration','auto_delete'].includes(String(candidate.mode))&&Number.isSafeInteger(candidate.durationDays)
        &&Number(candidate.durationDays)>=1&&Number(candidate.durationDays)<=3650)
        ||(!['duration','auto_delete'].includes(String(candidate.mode))&&candidate.durationDays===undefined))
      &&communicationMessagingText(candidate.reason,3,500));
  }
  return rejected('UNKNOWN_IPC_CHANNEL','$');
};
const communicationMessagingMessageResult=(value:unknown):boolean=>{
  if(!isObject(value))return false;
  const keys=['id','roomId','senderPersonId','contentKind','contentMime','payloadSizeBytes','state','deliveryState',
    'silent','pinned','bookmarked','edited','deleted','revision','createdAt','updatedAt','sealedPayloadStoredOutsideDatabase',
    'plaintextPersistedInDatabase',...(value.replyToMessageId===undefined?[]:['replyToMessageId']),
    ...(value.quotedMessageId===undefined?[]:['quotedMessageId']),...(value.threadRootMessageId===undefined?[]:['threadRootMessageId']),
    ...(value.scheduledAt===undefined?[]:['scheduledAt']),...(value.reactionCode===undefined?[]:['reactionCode']),
    ...(value.expiresAt===undefined?[]:['expiresAt'])];
  return healthCareExactRecord(value,keys)&&communicationIdentifier(value.id)&&communicationIdentifier(value.roomId)
    &&communicationIdentifier(value.senderPersonId)&&communicationMessagingContentKinds.has(String(value.contentKind))
    &&typeof value.contentMime==='string'&&value.contentMime.length>=3&&value.contentMime.length<=192
    &&Number.isSafeInteger(value.payloadSizeBytes)&&Number(value.payloadSizeBytes)>=1&&Number(value.payloadSizeBytes)<=33_554_432
    &&['draft','queued','scheduled','sealed_local','deleted'].includes(String(value.state))
    &&['not_requested','queued_offline','retry_wait','ready_local','transport_not_configured','cancelled'].includes(String(value.deliveryState))
    &&[value.silent,value.pinned,value.bookmarked,value.edited,value.deleted].every(item=>typeof item==='boolean')
    &&communicationMessagingRevision(value.revision)&&communicationMessagingIso(value.createdAt)&&communicationMessagingIso(value.updatedAt)
    &&communicationMessagingOptionalId(value.replyToMessageId)&&communicationMessagingOptionalId(value.quotedMessageId)
    &&communicationMessagingOptionalId(value.threadRootMessageId)
    &&(value.scheduledAt===undefined||communicationMessagingIso(value.scheduledAt))
    &&(value.reactionCode===undefined||communicationMessagingText(value.reactionCode,1,32))
    &&(value.expiresAt===undefined||communicationMessagingIso(value.expiresAt))
    &&value.sealedPayloadStoredOutsideDatabase===true&&value.plaintextPersistedInDatabase===false;
};
const communicationMessagingPresenceResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['personId','status','publicAvailability','audience','lastSeenShared','typingIndicatorsEnabled','readReceiptsEnabled',
    'activeDeviceDisclosed','preciseActivityDisclosed','emergencyReachabilityEnabled','revision','updatedAt',
    ...(value.expiresAt===undefined?[]:['expiresAt'])])&&communicationIdentifier(value.personId)
  &&['online','away','busy','in_meeting','do_not_disturb','invisible','offline'].includes(String(value.status))
  &&['available','unavailable','hidden'].includes(String(value.publicAvailability))
  &&['nobody','room_members','selected_people'].includes(String(value.audience))
  &&[value.lastSeenShared,value.typingIndicatorsEnabled,value.readReceiptsEnabled,value.emergencyReachabilityEnabled]
    .every(item=>typeof item==='boolean')&&value.activeDeviceDisclosed===false&&value.preciseActivityDisclosed===false
  &&communicationMessagingRevision(value.revision,true)&&communicationMessagingIso(value.updatedAt)
  &&(value.expiresAt===undefined||communicationMessagingIso(value.expiresAt));
const communicationMessagingRetentionResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['roomId','mode','legalHoldReasonRecorded','automaticDeletionScheduled','physicalSecureEraseGuaranteed',
    'backupPropagationGuaranteed','revision','updatedAt',...(value.durationDays===undefined?[]:['durationDays'])])
  &&communicationIdentifier(value.roomId)&&['permanent','duration','auto_delete','legal_hold'].includes(String(value.mode))
  &&(value.durationDays===undefined||(Number.isSafeInteger(value.durationDays)&&Number(value.durationDays)>=1&&Number(value.durationDays)<=3650))
  &&typeof value.legalHoldReasonRecorded==='boolean'&&typeof value.automaticDeletionScheduled==='boolean'
  &&value.physicalSecureEraseGuaranteed===false&&value.backupPropagationGuaranteed===false
  &&communicationMessagingRevision(value.revision)&&communicationMessagingIso(value.updatedAt);
const communicationMessagingTruthResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,[
  'appendOnlyMessageEventLedgerImplemented','sealedPayloadReferenceOnlyInDatabase','offlineOutboxMetadataImplemented',
  'localRetryStateMachineImplemented','replyQuoteThreadReactionPinBookmarkMetadataImplemented','editDeleteRestoreHistoryImplemented',
  'scheduledAndSilentMetadataImplemented','privacyPreservingPresenceImplemented','defaultPresenceIsAvailabilityOnly',
  'activeDeviceDisclosureDefaultDenied','exactActivityDisclosureDefaultDenied','contentSearchImplemented',
  'rendererMediaAttachmentSelectionImplemented','effectivePresenceExpiryEnforced','automaticRetentionExecutionImplemented',
  'payloadOrphanSweepImplemented','reminderExecutionImplemented','multiDevicePresenceAggregationImplemented',
  'selectedPeopleAudienceEnforcementImplemented','relayDeliveryImplemented',
  'deliveryReceiptFromRemoteImplemented','messageSignatureVerificationImplemented','automaticPhysicalSecureEraseGuaranteed',
  'backupDeletionPropagationGuaranteed','calendarPresenceSyncImplemented','productionMlsPayloadProviderConfigured',
  'realMessageExchangePerformed','networkUsedByCurrentImplementation'])
  &&value.appendOnlyMessageEventLedgerImplemented===true&&value.sealedPayloadReferenceOnlyInDatabase===true
  &&value.offlineOutboxMetadataImplemented===true&&value.localRetryStateMachineImplemented===true
  &&value.replyQuoteThreadReactionPinBookmarkMetadataImplemented===true&&value.editDeleteRestoreHistoryImplemented===true
  &&value.scheduledAndSilentMetadataImplemented===true&&value.privacyPreservingPresenceImplemented===true
  &&value.defaultPresenceIsAvailabilityOnly===true&&value.activeDeviceDisclosureDefaultDenied===true
  &&value.exactActivityDisclosureDefaultDenied===true&&value.contentSearchImplemented===true
  &&value.rendererMediaAttachmentSelectionImplemented===true&&value.effectivePresenceExpiryEnforced===true
  &&value.automaticRetentionExecutionImplemented===true&&value.payloadOrphanSweepImplemented===true
  &&value.reminderExecutionImplemented===true&&value.multiDevicePresenceAggregationImplemented===false
  &&value.selectedPeopleAudienceEnforcementImplemented===false
  &&value.relayDeliveryImplemented===false&&value.deliveryReceiptFromRemoteImplemented===false
  &&value.messageSignatureVerificationImplemented===false&&value.automaticPhysicalSecureEraseGuaranteed===false
  &&value.backupDeletionPropagationGuaranteed===false&&value.calendarPresenceSyncImplemented===false
  &&value.productionMlsPayloadProviderConfigured===false&&value.realMessageExchangePerformed===false
  &&value.networkUsedByCurrentImplementation===false;
const communicationMessagingCenterResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['schemaVersion','centerId','ownerPersonId','messages','presence','retentionPolicies','truth','generatedAt'])&&value.schemaVersion===1
  &&communicationIdentifier(value.centerId)&&communicationIdentifier(value.ownerPersonId)&&Array.isArray(value.messages)
  &&value.messages.length<=10_000&&value.messages.every(communicationMessagingMessageResult)
  &&communicationMessagingPresenceResult(value.presence)&&Array.isArray(value.retentionPolicies)
  &&value.retentionPolicies.length<=256&&value.retentionPolicies.every(communicationMessagingRetentionResult)
  &&communicationMessagingTruthResult(value.truth)&&communicationMessagingIso(value.generatedAt);
const communicationMessagingContentResult=(value:unknown):boolean=>{
  if(!isObject(value))return false;
  const optional=value.text===undefined?['opaqueAttachmentHandle']:['text'];
  return healthCareExactRecord(value,['messageId','revision','contentKind','contentMime',...optional,'payloadSource','networkUsed','cloudUsed'])
    &&communicationIdentifier(value.messageId)&&communicationMessagingRevision(value.revision)
    &&communicationMessagingContentKinds.has(String(value.contentKind))&&typeof value.contentMime==='string'
    &&value.contentMime.length>=3&&value.contentMime.length<=192
    &&((['text','location'].includes(String(value.contentKind))&&communicationMessagingText(value.text,1,32_768)
        &&value.opaqueAttachmentHandle===undefined)
      ||(['voice','photo','video','document'].includes(String(value.contentKind))
        &&communicationIdentifier(value.opaqueAttachmentHandle)&&value.text===undefined))
    &&value.payloadSource==='local_sealed_store'&&value.networkUsed===false&&value.cloudUsed===false;
};
const communicationMessagingReceiptResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['resourceType','resourceId','mutationKind','previousRevision','revision','occurredAt','replayed','payloadSealedLocally',
    'remoteDeliveryPerformed','networkUsed'])
  &&['communication_message','communication_presence','communication_retention_policy'].includes(String(value.resourceType))
  &&communicationIdentifier(value.resourceId)&&['message_create','message_edit','message_delete','message_restore','message_annotate',
    'delivery_update','retention_update','presence_update'].includes(String(value.mutationKind))
  &&communicationMessagingRevision(value.previousRevision,true)&&communicationMessagingRevision(value.revision)
  &&Number(value.revision)===Number(value.previousRevision)+1&&communicationMessagingIso(value.occurredAt)
  &&typeof value.replayed==='boolean'&&typeof value.payloadSealedLocally==='boolean'
  &&value.remoteDeliveryPerformed===false&&value.networkUsed===false;
const communicationMessagingResult=(channel:string,result:unknown):IpcIntegrationPolicyDecision=>{
  const valid=channel===COMMUNICATION_MESSAGING_IPC_CHANNELS.getCenter?communicationMessagingCenterResult(result)
    :channel===COMMUNICATION_MESSAGING_IPC_CHANNELS.search?Array.isArray(result)&&result.length<=200
      &&result.every(communicationMessagingMessageResult)
      :channel===COMMUNICATION_MESSAGING_IPC_CHANNELS.getContent?communicationMessagingContentResult(result)
        :communicationMessagingReceiptResult(result);
  return valid?accepted():rejected('COMMUNICATION_MESSAGING_RESULT_INVALID','$result');
};

export const COMMUNICATION_FILE_SHARING_IPC_CHANNELS=Object.freeze({
  getCenter:'communicationFileSharing:getCenter',
  getSafePreview:'communicationFileSharing:getSafePreview',
  selectAndPrepare:'communicationFileSharing:selectAndPrepare',
  apply:'communicationFileSharing:apply'
} as const);
export interface CommunicationFileSharingPreviewIpcInput { readonly fileId:string; }
export interface CommunicationFileSharingSelectIpcInput {
  readonly clientOperationId:string;
  readonly expectedRevision:number;
  readonly roomId?:string;
  readonly meetingId?:string;
}
export type CommunicationFileSharingRendererCommand=Exclude<CommunicationFileSharingCommand,
  {readonly kind:'prepare_file'|'record_chunk'|'set_scan'|'add_version'}>;
export interface CommunicationFileSharingApplyIpcInput {
  readonly clientOperationId:string;
  readonly expectedRevision:number;
  readonly command:CommunicationFileSharingRendererCommand;
}
export interface CommunicationFileSharingPrepareCancelledIpcView { readonly canceled:true; }
const communicationFileSharingChannels=new Set<string>(Object.values(COMMUNICATION_FILE_SHARING_IPC_CHANNELS));
const communicationFileSharingId=(value:unknown):boolean=>communicationIdentifier(value);
const communicationFileSharingText=(value:unknown,minimum:number,maximum:number):boolean=>
  communicationMessagingText(value,minimum,maximum);
const communicationFileSharingClock=(value:unknown):boolean=>typeof value==='string'
  &&/^([01]\d|2[0-3]):[0-5]\d$/u.test(value);
const communicationFileSharingCanonicalIds=(value:unknown,maximum:number):boolean=>Array.isArray(value)
  &&value.length<=maximum&&value.every(communicationFileSharingId)
  &&value.every((item,index)=>index===0||String(value[index-1]).localeCompare(String(item))<0);
const communicationFileSharingCommandInput=(value:unknown):boolean=>{
  if(!isObject(value)||typeof value.kind!=='string')return false;
  if(value.kind==='add_comment')return healthCareExactRecord(value,['kind','fileId','commentId','body'])
    &&communicationFileSharingId(value.fileId)&&communicationFileSharingId(value.commentId)
    &&communicationFileSharingText(value.body,1,4_000);
  if(value.kind==='grant_access')return healthCareExactRecord(value,
    ['kind','fileId','grantId','personId','mode','startsAt','endsAt'])&&communicationFileSharingId(value.fileId)
    &&communicationFileSharingId(value.grantId)&&communicationFileSharingId(value.personId)
    &&['preview_only','download'].includes(String(value.mode))&&communicationMessagingIso(value.startsAt)
    &&communicationMessagingIso(value.endsAt)&&Date.parse(String(value.startsAt))<Date.parse(String(value.endsAt));
  if(value.kind==='revoke_share')return healthCareExactRecord(value,['kind','fileId'])&&communicationFileSharingId(value.fileId);
  if(value.kind==='link_archive')return healthCareExactRecord(value,['kind','fileId','archiveItemId'])
    &&communicationFileSharingId(value.fileId)&&communicationFileSharingId(value.archiveItemId);
  if(value.kind==='update_album')return healthCareExactRecord(value,
    ['kind','fileId','albumId','selectedForStory','likedByPersonIds'])&&communicationFileSharingId(value.fileId)
    &&communicationFileSharingId(value.albumId)&&typeof value.selectedForStory==='boolean'
    &&communicationFileSharingCanonicalIds(value.likedByPersonIds,128);
  if(value.kind==='set_notifications')return healthCareExactRecord(value,
    ['kind','quietHoursEnabled','quietHoursStart','quietHoursEnd','nonEmergencyDigestEnabled','roomOverrides','personOverrides'])
    &&typeof value.quietHoursEnabled==='boolean'&&communicationFileSharingClock(value.quietHoursStart)
    &&communicationFileSharingClock(value.quietHoursEnd)&&typeof value.nonEmergencyDigestEnabled==='boolean'
    &&Array.isArray(value.roomOverrides)&&value.roomOverrides.length<=128&&value.roomOverrides.every((item)=>
      isObject(item)&&healthCareExactRecord(item,['roomId','muted'])&&communicationFileSharingId(item.roomId)
        &&typeof item.muted==='boolean')
    &&Array.isArray(value.personOverrides)&&value.personOverrides.length<=128&&value.personOverrides.every((item)=>
      isObject(item)&&healthCareExactRecord(item,['personId','muted'])&&communicationFileSharingId(item.personId)
        &&typeof item.muted==='boolean');
  if(value.kind==='announce_emergency')return healthCareExactRecord(value,['kind','announcementId','title'])
    &&communicationFileSharingId(value.announcementId)&&communicationFileSharingText(value.title,2,500);
  if(value.kind==='acknowledge_emergency')return healthCareExactRecord(value,['kind','announcementId'])
    &&communicationFileSharingId(value.announcementId);
  if(value.kind==='request_remote_assistance')return healthCareExactRecord(value,
    ['kind','sessionId','helperPersonId','allowedControls','endsAt'])&&communicationFileSharingId(value.sessionId)
    &&communicationFileSharingId(value.helperPersonId)&&Array.isArray(value.allowedControls)
    &&value.allowedControls.length>=1&&value.allowedControls.length<=3
    &&value.allowedControls.every((item)=>['pointer','keyboard','annotate'].includes(String(item)))
    &&new Set(value.allowedControls).size===value.allowedControls.length&&communicationMessagingIso(value.endsAt);
  if(value.kind==='grant_remote_assistance')return healthCareExactRecord(value,['kind','sessionId','explicitSingleUseConsent'])
    &&communicationFileSharingId(value.sessionId)&&value.explicitSingleUseConsent===true;
  if(value.kind==='revoke_remote_assistance')return healthCareExactRecord(value,['kind','sessionId'])
    &&communicationFileSharingId(value.sessionId);
  if(value.kind==='plan_co_watch')return healthCareExactRecord(value,
    ['kind','sessionId','mediaReference','narrationEnabled'])&&communicationFileSharingId(value.sessionId)
    &&communicationFileSharingText(value.mediaReference,2,500)&&typeof value.narrationEnabled==='boolean';
  if(value.kind==='prepare_voice_action')return healthCareExactRecord(value,['kind','actionId','action','targetReference'])
    &&communicationFileSharingId(value.actionId)&&['call','send_message','join_meeting'].includes(String(value.action))
    &&communicationFileSharingText(value.targetReference,2,500);
  if(value.kind==='confirm_voice_action')return healthCareExactRecord(value,['kind','actionId','explicitConfirmation'])
    &&communicationFileSharingId(value.actionId)&&value.explicitConfirmation===true;
  return false;
};
const communicationFileSharingInput=(channel:string,args:readonly unknown[]):IpcIntegrationPolicyDecision=>{
  if(channel===COMMUNICATION_FILE_SHARING_IPC_CHANNELS.getCenter)return zeroArguments(args);
  if(channel===COMMUNICATION_FILE_SHARING_IPC_CHANNELS.getSafePreview)return exactObject(args,['fileId'],
    value=>communicationFileSharingId(value.fileId));
  if(channel===COMMUNICATION_FILE_SHARING_IPC_CHANNELS.selectAndPrepare){
    if(args.length!==1||!isObject(args[0]))return rejected('COMMUNICATION_FILE_SHARING_PREPARE_INPUT_INVALID','$[0]');
    const value=args[0];
    const keys=['clientOperationId','expectedRevision',...(value.roomId===undefined?[]:['roomId']),
      ...(value.meetingId===undefined?[]:['meetingId'])];
    return exactObject(args,keys,candidate=>communicationFileSharingId(candidate.clientOperationId)
      &&communicationMessagingRevision(candidate.expectedRevision,true)
      &&(communicationFileSharingId(candidate.roomId)||communicationFileSharingId(candidate.meetingId))
      &&(candidate.roomId===undefined||communicationFileSharingId(candidate.roomId))
      &&(candidate.meetingId===undefined||communicationFileSharingId(candidate.meetingId)));
  }
  if(channel===COMMUNICATION_FILE_SHARING_IPC_CHANNELS.apply)return exactObject(args,
    ['clientOperationId','expectedRevision','command'],value=>communicationFileSharingId(value.clientOperationId)
      &&communicationMessagingRevision(value.expectedRevision,true)&&communicationFileSharingCommandInput(value.command));
  return rejected('UNKNOWN_IPC_CHANNEL','$');
};
const communicationFileSharingCommentResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['id','authorPersonId','body','createdAt'])&&communicationFileSharingId(value.id)
  &&communicationFileSharingId(value.authorPersonId)&&communicationFileSharingText(value.body,1,4_000)
  &&communicationMessagingIso(value.createdAt);
const communicationFileSharingGrantResult=(value:unknown):boolean=>{
  if(!isObject(value))return false;
  const keys=['id','personId','mode','startsAt','endsAt',...(value.revokedAt===undefined?[]:['revokedAt'])];
  return healthCareExactRecord(value,keys)&&communicationFileSharingId(value.id)&&communicationFileSharingId(value.personId)
    &&['preview_only','download'].includes(String(value.mode))&&communicationMessagingIso(value.startsAt)
    &&communicationMessagingIso(value.endsAt)&&(value.revokedAt===undefined||communicationMessagingIso(value.revokedAt));
};
const communicationFileSharingFileResult=(value:unknown):boolean=>{
  if(!isObject(value))return false;
  const keys=['id',...(value.roomId===undefined?[]:['roomId']),...(value.meetingId===undefined?[]:['meetingId']),
    'displayName','mimeType','totalBytes','totalChunks','verifiedChunkCount','state','scanState','versionCount','comments',
    'accessGrants',...(value.archiveItemId===undefined?[]:['archiveItemId']),...(value.albumId===undefined?[]:['albumId']),
    'selectedForStory','likedByPersonIds','externalLinkEnabled','externalLinkAccessCodeRequired','revision','createdAt','updatedAt'];
  return healthCareExactRecord(value,keys)&&communicationFileSharingId(value.id)
    &&(value.roomId===undefined||communicationFileSharingId(value.roomId))
    &&(value.meetingId===undefined||communicationFileSharingId(value.meetingId))
    &&communicationFileSharingText(value.displayName,1,255)&&typeof value.mimeType==='string'&&value.mimeType.length<=192
    &&Number.isSafeInteger(value.totalBytes)&&Number(value.totalBytes)>=1&&Number(value.totalBytes)<=64*1024*1024
    &&Number.isSafeInteger(value.totalChunks)&&Number(value.totalChunks)>=1&&Number(value.totalChunks)<=16
    &&Number.isSafeInteger(value.verifiedChunkCount)&&Number(value.verifiedChunkCount)>=0
    &&Number(value.verifiedChunkCount)<=Number(value.totalChunks)
    &&['prepared_local','transferring_local','paused','scan_required','ready_local','quarantined','revoked'].includes(String(value.state))
    &&['not_run','clean','malicious','provider_unavailable'].includes(String(value.scanState))
    &&Number.isSafeInteger(value.versionCount)&&Number(value.versionCount)>=1&&Number(value.versionCount)<=32
    &&Array.isArray(value.comments)&&value.comments.length<=256&&value.comments.every(communicationFileSharingCommentResult)
    &&Array.isArray(value.accessGrants)&&value.accessGrants.length<=256&&value.accessGrants.every(communicationFileSharingGrantResult)
    &&(value.archiveItemId===undefined||communicationFileSharingId(value.archiveItemId))
    &&(value.albumId===undefined||communicationFileSharingId(value.albumId))&&typeof value.selectedForStory==='boolean'
    &&communicationFileSharingCanonicalIds(value.likedByPersonIds,128)&&value.externalLinkEnabled===false
    &&value.externalLinkAccessCodeRequired===true&&communicationMessagingRevision(value.revision)
    &&communicationMessagingIso(value.createdAt)&&communicationMessagingIso(value.updatedAt);
};
const communicationFileSharingTruthResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,[
  'e2eeEnvelopeMetadataRequired','resumableChunkAndFullHashVerificationModeled',
  'versionCommentRelationAndSingleArchiveCopyModeled','timeBoundPreviewAndDownloadGrantsModeled',
  'localMalwareQuarantineGateModeled','albumSelectionLikesAndStoryTransferModeled','externalLinksDefaultClosed',
  'externalLinksRequireExpiryAndAccessCode','quietHoursAndNonEmergencyDigestModeled',
  'emergencyAnnouncementNotEmergencyService','remoteAssistanceSingleUseConsentRequired',
  'remoteAssistanceSensitiveDesktopHidden','voiceActionConfirmationRequired','productionFileTransportConfigured',
  'productionMalwareScannerConfigured','remoteAssistanceTransportConfigured','sharePlayAdapterConfigured',
  'voiceExecutionProviderConfigured','networkUsedByCurrentImplementation'])
  &&Object.values(value).every((item)=>typeof item==='boolean')
  &&value.e2eeEnvelopeMetadataRequired===true&&value.externalLinksDefaultClosed===true
  &&value.productionFileTransportConfigured===false&&value.productionMalwareScannerConfigured===false
  &&value.remoteAssistanceTransportConfigured===false&&value.sharePlayAdapterConfigured===false
  &&value.voiceExecutionProviderConfigured===false&&value.networkUsedByCurrentImplementation===false;
const communicationFileSharingNotificationResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,[
  'quietHoursEnabled','quietHoursStart','quietHoursEnd','nonEmergencyDigestEnabled','roomOverrides','personOverrides'])
  &&typeof value.quietHoursEnabled==='boolean'&&communicationFileSharingClock(value.quietHoursStart)
  &&communicationFileSharingClock(value.quietHoursEnd)&&typeof value.nonEmergencyDigestEnabled==='boolean'
  &&Array.isArray(value.roomOverrides)&&value.roomOverrides.length<=128&&value.roomOverrides.every((item)=>isObject(item)
    &&healthCareExactRecord(item,['roomId','muted'])&&communicationFileSharingId(item.roomId)&&typeof item.muted==='boolean')
  &&Array.isArray(value.personOverrides)&&value.personOverrides.length<=128&&value.personOverrides.every((item)=>isObject(item)
    &&healthCareExactRecord(item,['personId','muted'])&&communicationFileSharingId(item.personId)&&typeof item.muted==='boolean');
const communicationFileSharingEmergencyResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,[
  'id','title','createdByPersonId','acknowledgedPersonIds','emergencyServiceGuaranteed','localDeliveryOnly','createdAt'])
  &&communicationFileSharingId(value.id)&&communicationFileSharingText(value.title,2,500)
  &&communicationFileSharingId(value.createdByPersonId)&&communicationFileSharingCanonicalIds(value.acknowledgedPersonIds,128)
  &&value.emergencyServiceGuaranteed===false&&value.localDeliveryOnly===true&&communicationMessagingIso(value.createdAt);
const communicationFileSharingRemoteResult=(value:unknown):boolean=>{
  if(!isObject(value))return false;
  const keys=['id','requesterPersonId','helperPersonId','state','singleUseConsent','visibleIndicatorRequired',
    'secureDesktopAndPasswordsHidden','allowedControls','endsAt',...(value.revokedAt===undefined?[]:['revokedAt']),
    'remoteTransportConfigured'];
  return healthCareExactRecord(value,keys)&&communicationFileSharingId(value.id)
    &&communicationFileSharingId(value.requesterPersonId)&&communicationFileSharingId(value.helperPersonId)
    &&['consent_pending','active_local_plan','revoked','expired'].includes(String(value.state))
    &&value.singleUseConsent===true&&value.visibleIndicatorRequired===true&&value.secureDesktopAndPasswordsHidden===true
    &&Array.isArray(value.allowedControls)&&value.allowedControls.length>=1&&value.allowedControls.length<=3
    &&value.allowedControls.every((item)=>['pointer','keyboard','annotate'].includes(String(item)))
    &&new Set(value.allowedControls).size===value.allowedControls.length&&communicationMessagingIso(value.endsAt)
    &&(value.revokedAt===undefined||communicationMessagingIso(value.revokedAt))&&value.remoteTransportConfigured===false;
};
const communicationFileSharingCoWatchResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,[
  'id','mediaReference','narrationEnabled','state','sharePlayAdapterConfigured'])&&communicationFileSharingId(value.id)
  &&communicationFileSharingText(value.mediaReference,2,500)&&typeof value.narrationEnabled==='boolean'
  &&['local_plan','cancelled'].includes(String(value.state))&&value.sharePlayAdapterConfigured===false;
const communicationFileSharingVoiceResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,[
  'id','action','targetReference','state','executedExternally'])&&communicationFileSharingId(value.id)
  &&['call','send_message','join_meeting'].includes(String(value.action))
  &&communicationFileSharingText(value.targetReference,2,500)
  &&['confirmation_required','confirmed_local_only','cancelled'].includes(String(value.state))
  &&value.executedExternally===false;
const communicationFileSharingCenterResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['schemaVersion','files','notificationProfile','emergencyAnnouncements','remoteAssistance','coWatchSessions','voiceActions',
    'truth','revision','generatedAt'])&&value.schemaVersion===1&&Array.isArray(value.files)&&value.files.length<=128
  &&value.files.every(communicationFileSharingFileResult)&&communicationFileSharingNotificationResult(value.notificationProfile)
  &&Array.isArray(value.emergencyAnnouncements)&&value.emergencyAnnouncements.length<=128
  &&value.emergencyAnnouncements.every(communicationFileSharingEmergencyResult)
  &&Array.isArray(value.remoteAssistance)&&value.remoteAssistance.length<=128
  &&value.remoteAssistance.every(communicationFileSharingRemoteResult)&&Array.isArray(value.coWatchSessions)
  &&value.coWatchSessions.length<=128&&value.coWatchSessions.every(communicationFileSharingCoWatchResult)
  &&Array.isArray(value.voiceActions)&&value.voiceActions.length<=128&&value.voiceActions.every(communicationFileSharingVoiceResult)
  &&communicationFileSharingTruthResult(value.truth)&&communicationMessagingRevision(value.revision,true)
  &&communicationMessagingIso(value.generatedAt);
const communicationFileSharingReceiptResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['commandKind','previousRevision','revision','occurredAt','replayed','externalOperationPerformed','networkUsed'])
  &&['prepare_file','add_comment','grant_access','revoke_share','link_archive','update_album','set_notifications',
    'announce_emergency','acknowledge_emergency','request_remote_assistance','grant_remote_assistance',
    'revoke_remote_assistance','plan_co_watch','prepare_voice_action','confirm_voice_action'].includes(String(value.commandKind))
  &&communicationMessagingRevision(value.previousRevision,true)&&communicationMessagingRevision(value.revision)
  &&Number(value.revision)===Number(value.previousRevision)+1&&communicationMessagingIso(value.occurredAt)
  &&typeof value.replayed==='boolean'&&value.externalOperationPerformed===false&&value.networkUsed===false;
const communicationFileSharingPreviewResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,[
  'schemaVersion','fileId','displayName','mimeType','text','totalBytes','scanState','accessMode','renderingMode','truncated',
  'payloadSource','networkUsed','cloudUsed'])&&value.schemaVersion===1&&communicationFileSharingId(value.fileId)
  &&communicationFileSharingText(value.displayName,1,255)
  &&['text/plain','text/markdown','text/csv','application/json'].includes(String(value.mimeType))
  &&typeof value.text==='string'&&value.text.length<=256*1024
  &&!/[\p{Cf}\p{Cs}\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value.text)
  &&Number.isSafeInteger(value.totalBytes)&&Number(value.totalBytes)>=1&&Number(value.totalBytes)<=256*1024
  &&value.scanState==='clean'&&value.accessMode==='owner'&&value.renderingMode==='escaped_plain_text'
  &&value.truncated===false&&value.payloadSource==='local_protected_payload'
  &&value.networkUsed===false&&value.cloudUsed===false;
const communicationFileSharingResult=(channel:string,result:unknown):IpcIntegrationPolicyDecision=>{
  const valid=channel===COMMUNICATION_FILE_SHARING_IPC_CHANNELS.getCenter?communicationFileSharingCenterResult(result)
    :channel===COMMUNICATION_FILE_SHARING_IPC_CHANNELS.getSafePreview?communicationFileSharingPreviewResult(result)
    :channel===COMMUNICATION_FILE_SHARING_IPC_CHANNELS.selectAndPrepare&&isObject(result)
      &&healthCareExactRecord(result,['canceled'])&&result.canceled===true
      ?true:communicationFileSharingReceiptResult(result);
  return valid?accepted():rejected('COMMUNICATION_FILE_SHARING_RESULT_INVALID','$result');
};

export const COMMUNICATION_AUDIT_ARCHIVE_IPC_CHANNELS=Object.freeze({
  getCenter:'communicationAuditArchive:getCenter'
} as const);
const communicationAuditArchiveChannels=new Set<string>(Object.values(COMMUNICATION_AUDIT_ARCHIVE_IPC_CHANNELS));
const communicationAuditArchiveInput=(channel:string,args:readonly unknown[]):IpcIntegrationPolicyDecision=>
  channel===COMMUNICATION_AUDIT_ARCHIVE_IPC_CHANNELS.getCenter?zeroArguments(args):rejected('UNKNOWN_IPC_CHANNEL','$');
const communicationAuditEventKinds=new Set(['room_joined','room_left','call_started','call_ended','file_shared',
  'permission_changed','message_created','message_deleted','recording_consent_changed']);
const communicationAuditResourceTypes=new Set(['communication_room','communication_call_session','communication_file_sharing',
  'communication_permission','communication_message','communication_recording_request']);
const communicationAuditSafeEventResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['eventKind','resourceType','resourceVersion','sequence','occurredAt'])
  &&communicationAuditEventKinds.has(String(value.eventKind))&&communicationAuditResourceTypes.has(String(value.resourceType))
  &&Number.isSafeInteger(value.resourceVersion)&&Number(value.resourceVersion)>=1
  &&Number.isSafeInteger(value.sequence)&&Number(value.sequence)>=1&&communicationMessagingIso(value.occurredAt);
const communicationAuditSafeCheckpointResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['archiveGeneration','vaultVerified','backupVerified','replicaVerified','restoreVerified',
    'externalBackupProviderVerified','remoteReplicationVerified','createdAt'])
  &&Number.isSafeInteger(value.archiveGeneration)&&Number(value.archiveGeneration)>=1
  &&[value.vaultVerified,value.backupVerified,value.replicaVerified,value.restoreVerified].every(item=>typeof item==='boolean')
  &&value.externalBackupProviderVerified===false&&value.remoteReplicationVerified===false
  &&communicationMessagingIso(value.createdAt);
const communicationAuditTruthResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,[
  'appendOnlyHashChainedAuditImplemented','membershipCallFileAndPermissionEventsModeled','contentExcludedFromAuditByConstruction',
  'identityHashAndVersionMetadataOnly','vaultDatabaseBackupRestoreCheckpointModeled','mutationAndCheckpointDeleteBlocked',
  'productionRemoteReplicationConfigured','externalBackupProviderVerified','realRestoreDrillPerformed',
  'networkUsedByCurrentImplementation','productionQueryApiComposed','productionEventProducerHooksComposed',
  'rendererAuditMutationAuthorityExposed'])
  &&value.appendOnlyHashChainedAuditImplemented===true&&value.membershipCallFileAndPermissionEventsModeled===true
  &&value.contentExcludedFromAuditByConstruction===true&&value.identityHashAndVersionMetadataOnly===true
  &&value.vaultDatabaseBackupRestoreCheckpointModeled===true&&value.mutationAndCheckpointDeleteBlocked===true
  &&value.productionRemoteReplicationConfigured===false&&value.externalBackupProviderVerified===false
  &&value.realRestoreDrillPerformed===false&&value.networkUsedByCurrentImplementation===false
  &&value.productionQueryApiComposed===true&&value.productionEventProducerHooksComposed===true
  &&value.rendererAuditMutationAuthorityExposed===false;
const communicationAuditArchiveResult=(channel:string,result:unknown):IpcIntegrationPolicyDecision=>{
  const valid=channel===COMMUNICATION_AUDIT_ARCHIVE_IPC_CHANNELS.getCenter&&isObject(result)
    &&healthCareExactRecord(result,['schemaVersion','eventCount','checkpointCount','recentEvents','recentCheckpoints',
      'recentEventsTruncated','recentCheckpointsTruncated','chainValid','truth','generatedAt','networkUsed','cloudUsed'])
    &&result.schemaVersion===1&&Number.isSafeInteger(result.eventCount)&&Number(result.eventCount)>=0&&Number(result.eventCount)<=100000
    &&Number.isSafeInteger(result.checkpointCount)&&Number(result.checkpointCount)>=0&&Number(result.checkpointCount)<=1000
    &&Array.isArray(result.recentEvents)&&result.recentEvents.length<=100&&result.recentEvents.every(communicationAuditSafeEventResult)
    &&Array.isArray(result.recentCheckpoints)&&result.recentCheckpoints.length<=50
    &&result.recentCheckpoints.every(communicationAuditSafeCheckpointResult)
    &&typeof result.recentEventsTruncated==='boolean'&&typeof result.recentCheckpointsTruncated==='boolean'
    &&typeof result.chainValid==='boolean'&&communicationAuditTruthResult(result.truth)
    &&communicationMessagingIso(result.generatedAt)&&result.networkUsed===false&&result.cloudUsed===false;
  return valid?accepted():rejected('COMMUNICATION_AUDIT_ARCHIVE_RESULT_INVALID','$result');
};

export const COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS=Object.freeze({
  getCenter:'communicationCalling:getCenter',
  create:'communicationCalling:create',
  runPreflight:'communicationCalling:runPreflight',
  updateControls:'communicationCalling:updateControls',
  advance:'communicationCalling:advance',
  setPreferences:'communicationCalling:setPreferences'
} as const);
const communicationCallingChannels=new Set<string>(Object.values(COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS));
const communicationCallingBackgroundEffects=new Set(['off','blur','virtual_background']);
const communicationCallingInput=(channel:string,args:readonly unknown[]):IpcIntegrationPolicyDecision=>{
  if(channel===COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.getCenter)return zeroArguments(args);
  if(channel===COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.create){
    if(args.length!==1||!isObject(args[0]))return rejected('COMMUNICATION_CALL_CREATE_INPUT_INVALID','$[0]');
    const value=args[0];
    return exactObject(args,['clientOperationId','expectedRevision','roomId','topology','requestedMediaMode','invitedPersonIds',
      'waitingRoomEnabled','automaticAudioFallbackEnabled'],candidate=>communicationIdentifier(candidate.clientOperationId)
      &&candidate.expectedRevision===0&&communicationIdentifier(candidate.roomId)
      &&['direct_p2p','family_group_sfu'].includes(String(candidate.topology))
      &&['audio','video'].includes(String(candidate.requestedMediaMode))&&Array.isArray(candidate.invitedPersonIds)
      &&candidate.invitedPersonIds.length>=1&&candidate.invitedPersonIds.length<=15
      &&candidate.invitedPersonIds.every(communicationIdentifier)
      &&new Set(candidate.invitedPersonIds).size===candidate.invitedPersonIds.length
      &&(candidate.topology!=='direct_p2p'||candidate.invitedPersonIds.length===1)
      &&(candidate.topology!=='family_group_sfu'||candidate.invitedPersonIds.length>=2)
      &&typeof candidate.waitingRoomEnabled==='boolean'&&typeof candidate.automaticAudioFallbackEnabled==='boolean');
  }
  if(channel===COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.runPreflight)return exactObject(args,
    ['clientOperationId','expectedRevision','sessionId'],value=>communicationIdentifier(value.clientOperationId)
      &&communicationMessagingRevision(value.expectedRevision)&&communicationIdentifier(value.sessionId));
  if(channel===COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.updateControls){
    if(args.length!==1||!isObject(args[0]))return rejected('COMMUNICATION_CALL_CONTROLS_INPUT_INVALID','$[0]');
    const value=args[0];
    const optional=['audioOnly','meetingLocked','backgroundEffect','captionsRequested','realtimeTextRequested','screenShareRequested',
      'localHandRaised','pinnedPersonId','signLanguagePinnedPersonId','reactionCode'].filter(key=>value[key]!==undefined);
    return exactObject(args,['clientOperationId','expectedRevision','sessionId',...optional],candidate=>
      communicationIdentifier(candidate.clientOperationId)&&communicationMessagingRevision(candidate.expectedRevision)
      &&communicationIdentifier(candidate.sessionId)&&optional.length>=1
      &&['audioOnly','meetingLocked','captionsRequested','realtimeTextRequested','screenShareRequested','localHandRaised']
        .every(key=>candidate[key]===undefined||typeof candidate[key]==='boolean')
      &&(candidate.backgroundEffect===undefined||communicationCallingBackgroundEffects.has(String(candidate.backgroundEffect)))
      &&(candidate.pinnedPersonId===undefined||candidate.pinnedPersonId===null||communicationIdentifier(candidate.pinnedPersonId))
      &&(candidate.signLanguagePinnedPersonId===undefined||candidate.signLanguagePinnedPersonId===null
        ||communicationIdentifier(candidate.signLanguagePinnedPersonId))
      &&(candidate.reactionCode===undefined||candidate.reactionCode===null||communicationMessagingText(candidate.reactionCode,1,32)));
  }
  if(channel===COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.advance)return exactObject(args,
    ['clientOperationId','expectedRevision','sessionId','action','reason'],value=>communicationIdentifier(value.clientOperationId)
      &&communicationMessagingRevision(value.expectedRevision)&&communicationIdentifier(value.sessionId)
      &&['enter_local_waiting_room','end','cancel'].includes(String(value.action))
      &&communicationMessagingText(value.reason,3,500));
  if(channel===COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.setPreferences){
    if(args.length!==1||!isObject(args[0]))return rejected('COMMUNICATION_CALL_PREFERENCES_INPUT_INVALID','$[0]');
    const value=args[0];
    const keys=['clientOperationId','expectedRevision','simpleMode',...(value.favoritePersonId===undefined?[]:['favoritePersonId']),
      'largePersonCards','captionScalePercent','screenReaderAnnouncements','keyboardShortcuts','automaticAudioFallbackEnabled',
      'noiseReductionRequested','echoCancellationRequested','automaticGainControlRequested','backgroundEffect'];
    return exactObject(args,keys,candidate=>communicationIdentifier(candidate.clientOperationId)
      &&communicationMessagingRevision(candidate.expectedRevision,true)
      &&(candidate.favoritePersonId===undefined||communicationIdentifier(candidate.favoritePersonId))
      &&['simpleMode','largePersonCards','screenReaderAnnouncements','keyboardShortcuts','automaticAudioFallbackEnabled',
        'noiseReductionRequested','echoCancellationRequested','automaticGainControlRequested']
        .every(key=>typeof candidate[key]==='boolean')
      &&Number.isSafeInteger(candidate.captionScalePercent)&&Number(candidate.captionScalePercent)>=100
      &&Number(candidate.captionScalePercent)<=300
      &&communicationCallingBackgroundEffects.has(String(candidate.backgroundEffect)));
  }
  return rejected('UNKNOWN_IPC_CHANNEL','$');
};
const communicationCallingParticipantResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['personId','role','state','handRaised','pinnedLocally','signLanguageSpeakerPinnedLocally','revision','updatedAt',
    ...(value.reactionCode===undefined?[]:['reactionCode'])])&&communicationIdentifier(value.personId)
  &&['host','participant'].includes(String(value.role))&&['invited','local_ready','left'].includes(String(value.state))
  &&[value.handRaised,value.pinnedLocally,value.signLanguageSpeakerPinnedLocally].every(item=>typeof item==='boolean')
  &&communicationMessagingRevision(value.revision)&&communicationMessagingIso(value.updatedAt)
  &&(value.reactionCode===undefined||communicationMessagingText(value.reactionCode,1,32));
const communicationCallingPreflightResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['microphone','camera','speaker','noiseReductionRequested','echoCancellationRequested','automaticGainControlRequested',
    'providerVerified','networkUsed',...(value.observedAt===undefined?[]:['observedAt'])])
  &&[value.microphone,value.camera,value.speaker].every(item=>['not_run','passed','failed','not_available'].includes(String(item)))
  &&[value.noiseReductionRequested,value.echoCancellationRequested,value.automaticGainControlRequested,value.providerVerified]
    .every(item=>typeof item==='boolean')&&value.networkUsed===false
  &&(value.observedAt===undefined||communicationMessagingIso(value.observedAt));
const communicationCallingSessionResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['id','roomId','topology','requestedMediaMode','state','networkState','waitingRoomEnabled','meetingLocked','audioOnly',
    'automaticAudioFallbackEnabled','backgroundEffect','captionsRequested','realtimeTextRequested','screenShareRequested',
    'localHandRaised',...(value.pinnedPersonId===undefined?[]:['pinnedPersonId']),
    ...(value.signLanguagePinnedPersonId===undefined?[]:['signLanguagePinnedPersonId']),'preflight','participants','revision',
    'createdAt','updatedAt',...(value.endedAt===undefined?[]:['endedAt'])])&&communicationIdentifier(value.id)
  &&communicationIdentifier(value.roomId)&&['direct_p2p','family_group_sfu'].includes(String(value.topology))
  &&['audio','video'].includes(String(value.requestedMediaMode))
  &&['planned','preflight_ready','waiting_local','ended','cancelled'].includes(String(value.state))
  &&['not_started','local_waiting_only','ended'].includes(String(value.networkState))
  &&[value.waitingRoomEnabled,value.meetingLocked,value.audioOnly,value.automaticAudioFallbackEnabled,value.captionsRequested,
    value.realtimeTextRequested,value.screenShareRequested,value.localHandRaised].every(item=>typeof item==='boolean')
  &&communicationCallingBackgroundEffects.has(String(value.backgroundEffect))
  &&(value.pinnedPersonId===undefined||communicationIdentifier(value.pinnedPersonId))
  &&(value.signLanguagePinnedPersonId===undefined||communicationIdentifier(value.signLanguagePinnedPersonId))
  &&communicationCallingPreflightResult(value.preflight)&&Array.isArray(value.participants)&&value.participants.length<=16
  &&value.participants.every(communicationCallingParticipantResult)&&communicationMessagingRevision(value.revision)
  &&communicationMessagingIso(value.createdAt)&&communicationMessagingIso(value.updatedAt)
  &&(value.endedAt===undefined||communicationMessagingIso(value.endedAt));
const communicationCallingPreferencesResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['simpleMode',...(value.favoritePersonId===undefined?[]:['favoritePersonId']),'largePersonCards','captionScalePercent',
    'screenReaderAnnouncements','keyboardShortcuts','automaticAudioFallbackEnabled','noiseReductionRequested',
    'echoCancellationRequested','automaticGainControlRequested','backgroundEffect','revision','updatedAt'])
  &&(value.favoritePersonId===undefined||communicationIdentifier(value.favoritePersonId))
  &&['simpleMode','largePersonCards','screenReaderAnnouncements','keyboardShortcuts','automaticAudioFallbackEnabled',
    'noiseReductionRequested','echoCancellationRequested','automaticGainControlRequested'].every(key=>typeof value[key]==='boolean')
  &&Number.isSafeInteger(value.captionScalePercent)&&Number(value.captionScalePercent)>=100&&Number(value.captionScalePercent)<=300
  &&communicationCallingBackgroundEffects.has(String(value.backgroundEffect))
  &&communicationMessagingRevision(value.revision,true)&&communicationMessagingIso(value.updatedAt);
const communicationCallingQualityResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['sessionId','roundTripMs','packetLossPermille','jitterMs','uplinkKbps','downlinkKbps','providerVerified','observedAt'])
  &&communicationIdentifier(value.sessionId)&&Number.isSafeInteger(value.roundTripMs)&&Number(value.roundTripMs)>=0
  &&Number(value.roundTripMs)<=60_000&&Number.isSafeInteger(value.packetLossPermille)&&Number(value.packetLossPermille)>=0
  &&Number(value.packetLossPermille)<=1_000&&Number.isSafeInteger(value.jitterMs)&&Number(value.jitterMs)>=0
  &&Number(value.jitterMs)<=60_000&&Number.isSafeInteger(value.uplinkKbps)&&Number(value.uplinkKbps)>=0
  &&Number(value.uplinkKbps)<=10_000_000&&Number.isSafeInteger(value.downlinkKbps)&&Number(value.downlinkKbps)>=0
  &&Number(value.downlinkKbps)<=10_000_000&&value.providerVerified===true&&communicationMessagingIso(value.observedAt);
const communicationCallingTruthResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,[
  'localCallPlanningMetadataImplemented','appendOnlyLifecycleLedgerImplemented','optimisticRevisionRequired',
  'accessibleCallPreferenceModelImplemented','localPreflightEvidenceContractImplemented','localMediaPreflightProviderConfigured',
  'localMediaPreflightExecuted','physicalMediaDeviceFunctionalityCertified','rendererMediaDeviceAuthority',
  'rendererNetworkAuthority','productionMediaProviderConfigured','webRtcPeerConnectionExecuted','sfuServiceConfigured',
  'stunTurnServiceConfigured','shortLivedRelayCredentialsIssued','sframeMediaEncryptionExecuted','mlsMediaKeyBindingVerified',
  'screenOrWindowCaptureImplemented','localBackgroundProcessingImplemented','liveCaptionProviderConfigured',
  'realtimeTextTransportImplemented','callKitPushKitIntegrated','windowsCallNotificationIntegrated',
  'doNotDisturbIntegrationImplemented','realDevicePreflightExecuted','realOneToOneCallPerformed','realGroupCallPerformed',
  'networkUsedByCurrentImplementation'])
  &&value.localCallPlanningMetadataImplemented===true&&value.appendOnlyLifecycleLedgerImplemented===true
  &&value.optimisticRevisionRequired===true&&value.accessibleCallPreferenceModelImplemented===true
  &&value.localPreflightEvidenceContractImplemented===true
  &&typeof value.localMediaPreflightProviderConfigured==='boolean'&&typeof value.localMediaPreflightExecuted==='boolean'
  &&(value.localMediaPreflightExecuted!==true||value.localMediaPreflightProviderConfigured===true)
  &&['physicalMediaDeviceFunctionalityCertified','rendererMediaDeviceAuthority','rendererNetworkAuthority',
    'productionMediaProviderConfigured','webRtcPeerConnectionExecuted','sfuServiceConfigured','stunTurnServiceConfigured',
    'shortLivedRelayCredentialsIssued','sframeMediaEncryptionExecuted','mlsMediaKeyBindingVerified','screenOrWindowCaptureImplemented',
    'localBackgroundProcessingImplemented','liveCaptionProviderConfigured','realtimeTextTransportImplemented',
    'callKitPushKitIntegrated','windowsCallNotificationIntegrated','doNotDisturbIntegrationImplemented','realDevicePreflightExecuted',
    'realOneToOneCallPerformed','realGroupCallPerformed','networkUsedByCurrentImplementation'].every(key=>value[key]===false);
const communicationCallingCenterResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['schemaVersion','centerId','ownerPersonId','sessions','preferences','qualityObservations','truth','generatedAt'])
  &&value.schemaVersion===1&&communicationIdentifier(value.centerId)&&communicationIdentifier(value.ownerPersonId)
  &&Array.isArray(value.sessions)&&value.sessions.length<=256&&value.sessions.every(communicationCallingSessionResult)
  &&communicationCallingPreferencesResult(value.preferences)&&Array.isArray(value.qualityObservations)
  &&value.qualityObservations.length<=512&&value.qualityObservations.every(communicationCallingQualityResult)
  &&communicationCallingTruthResult(value.truth)&&communicationMessagingIso(value.generatedAt);
const communicationCallingReceiptResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['resourceType','resourceId','mutationKind','previousRevision','revision','occurredAt','replayed','mediaTransportStarted','networkUsed'])
  &&['communication_call_session','communication_call_preferences'].includes(String(value.resourceType))
  &&communicationIdentifier(value.resourceId)&&['call_create','call_preflight_update','call_controls_update','call_lifecycle_update',
    'call_preferences_update'].includes(String(value.mutationKind))
  &&communicationMessagingRevision(value.previousRevision,true)&&communicationMessagingRevision(value.revision)
  &&Number(value.revision)===Number(value.previousRevision)+1&&communicationMessagingIso(value.occurredAt)
  &&typeof value.replayed==='boolean'&&value.mediaTransportStarted===false&&value.networkUsed===false;
const communicationCallingResult=(channel:string,result:unknown):IpcIntegrationPolicyDecision=>{
  const valid=channel===COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS.getCenter
    ?communicationCallingCenterResult(result):communicationCallingReceiptResult(result);
  return valid?accepted():rejected('COMMUNICATION_CALL_RESULT_INVALID','$result');
};

export const COMMUNICATION_RECORDING_IPC_CHANNELS=Object.freeze({
  getCenter:'communicationRecording:getCenter',
  createRequest:'communicationRecording:createRequest',
  decideConsent:'communicationRecording:decideConsent',
  withdrawConsent:'communicationRecording:withdrawConsent',
  addLateJoiner:'communicationRecording:addLateJoiner',
  setSegment:'communicationRecording:setSegment',
  updateRetention:'communicationRecording:updateRetention',
  requestDeletion:'communicationRecording:requestDeletion'
} as const);
const communicationRecordingChannels=new Set<string>(Object.values(COMMUNICATION_RECORDING_IPC_CHANNELS));
const recordingRetentionDays=(value:unknown):boolean=>Number.isSafeInteger(value)&&Number(value)>=1&&Number(value)<=3650;
const communicationRecordingInput=(channel:string,args:readonly unknown[]):IpcIntegrationPolicyDecision=>{
  if(channel===COMMUNICATION_RECORDING_IPC_CHANNELS.getCenter)return zeroArguments(args);
  if(channel===COMMUNICATION_RECORDING_IPC_CHANNELS.createRequest)return exactObject(args,
    ['clientOperationId','expectedRevision','callSessionId','participantPersonIds','noticeVersion','audioDays','videoDays',
      'transcriptDays','translationDays','persistTranscript','persistTranslation'],value=>
      communicationIdentifier(value.clientOperationId)&&value.expectedRevision===0&&communicationIdentifier(value.callSessionId)
      &&Array.isArray(value.participantPersonIds)&&value.participantPersonIds.length>=2&&value.participantPersonIds.length<=16
      &&value.participantPersonIds.every(communicationIdentifier)&&new Set(value.participantPersonIds).size===value.participantPersonIds.length
      &&communicationMessagingText(value.noticeVersion,1,64)&&[value.audioDays,value.videoDays,value.transcriptDays,value.translationDays]
        .every(recordingRetentionDays)&&typeof value.persistTranscript==='boolean'&&typeof value.persistTranslation==='boolean');
  if(channel===COMMUNICATION_RECORDING_IPC_CHANNELS.decideConsent)return exactObject(args,
    ['clientOperationId','expectedRevision','requestId','decision','explicitConsent','noticeVersion','ageCategory',
      'ageAppropriateNoticeAcknowledged'],value=>communicationIdentifier(value.clientOperationId)
      &&communicationMessagingRevision(value.expectedRevision)&&communicationIdentifier(value.requestId)
      &&['grant','decline'].includes(String(value.decision))&&value.explicitConsent===true
      &&communicationMessagingText(value.noticeVersion,1,64)&&['adult','minor_or_unknown'].includes(String(value.ageCategory))
      &&value.ageAppropriateNoticeAcknowledged===true);
  if(channel===COMMUNICATION_RECORDING_IPC_CHANNELS.withdrawConsent)return exactObject(args,
    ['clientOperationId','expectedRevision','requestId','reason'],value=>communicationIdentifier(value.clientOperationId)
      &&communicationMessagingRevision(value.expectedRevision)&&communicationIdentifier(value.requestId)
      &&communicationMessagingText(value.reason,2,300));
  if(channel===COMMUNICATION_RECORDING_IPC_CHANNELS.addLateJoiner)return exactObject(args,
    ['clientOperationId','expectedRevision','requestId','participantPersonId'],value=>communicationIdentifier(value.clientOperationId)
      &&communicationMessagingRevision(value.expectedRevision)&&communicationIdentifier(value.requestId)
      &&communicationIdentifier(value.participantPersonId));
  if(channel===COMMUNICATION_RECORDING_IPC_CHANNELS.setSegment)return exactObject(args,
    ['clientOperationId','expectedRevision','requestId','mode','reason'],value=>communicationIdentifier(value.clientOperationId)
      &&communicationMessagingRevision(value.expectedRevision)&&communicationIdentifier(value.requestId)
      &&['on_record_requested','off_record'].includes(String(value.mode))&&communicationMessagingText(value.reason,2,300));
  if(channel===COMMUNICATION_RECORDING_IPC_CHANNELS.updateRetention)return exactObject(args,
    ['clientOperationId','expectedRevision','requestId','audioDays','videoDays','transcriptDays','translationDays',
      'persistTranscript','persistTranslation','secureDeletionRequested'],value=>communicationIdentifier(value.clientOperationId)
      &&communicationMessagingRevision(value.expectedRevision)&&communicationIdentifier(value.requestId)
      &&[value.audioDays,value.videoDays,value.transcriptDays,value.translationDays].every(recordingRetentionDays)
      &&[value.persistTranscript,value.persistTranslation,value.secureDeletionRequested].every(item=>typeof item==='boolean'));
  if(channel===COMMUNICATION_RECORDING_IPC_CHANNELS.requestDeletion)return exactObject(args,
    ['clientOperationId','expectedRevision','requestId','reason'],value=>communicationIdentifier(value.clientOperationId)
      &&communicationMessagingRevision(value.expectedRevision)&&communicationIdentifier(value.requestId)
      &&communicationMessagingText(value.reason,2,300));
  return rejected('UNKNOWN_IPC_CHANNEL','$');
};
const communicationRecordingConsentResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['personId','state','noticeVersion','explicitConsent','ageCategory','ageAppropriateNoticeAcknowledged',
    'guardianPolicyVerified','revision','updatedAt',...(value.decidedAt===undefined?[]:['decidedAt'])])
  &&communicationIdentifier(value.personId)&&['pending','granted','declined','withdrawn'].includes(String(value.state))
  &&communicationMessagingText(value.noticeVersion,1,64)&&typeof value.explicitConsent==='boolean'
  &&['adult','minor_or_unknown'].includes(String(value.ageCategory))&&typeof value.ageAppropriateNoticeAcknowledged==='boolean'
  &&value.guardianPolicyVerified===false&&communicationMessagingRevision(value.revision)&&communicationMessagingIso(value.updatedAt)
  &&(value.decidedAt===undefined||communicationMessagingIso(value.decidedAt));
const communicationRecordingRetentionResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['audioDays','videoDays','transcriptDays','translationDays','persistTranscript','persistTranslation',
    'secureDeletionRequested','revision','updatedAt'])
  &&[value.audioDays,value.videoDays,value.transcriptDays,value.translationDays].every(recordingRetentionDays)
  &&[value.persistTranscript,value.persistTranslation,value.secureDeletionRequested].every(item=>typeof item==='boolean')
  &&communicationMessagingRevision(value.revision)&&communicationMessagingIso(value.updatedAt);
const communicationRecordingSegmentResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['mode','captureStarted','transcriptPersisted','translationPersisted','revision','occurredAt'])
  &&['on_record_requested','off_record'].includes(String(value.mode))&&value.captureStarted===false
  &&value.transcriptPersisted===false&&value.translationPersisted===false
  &&communicationMessagingRevision(value.revision)&&communicationMessagingIso(value.occurredAt);
const communicationRecordingRequestResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['id','callSessionId','state','noticeVersion','lateJoinerPauseRequired','anyDeclineKeepsCallOffRecord',
    'visibleRecordingIndicatorActive','audibleRecordingAnnouncementExecuted','recordingRoleBoundToE2eeGroup',
    'mediaCaptureStarted','participants','retention','segments','revision','createdAt','updatedAt'])
  &&communicationIdentifier(value.id)&&communicationIdentifier(value.callSessionId)
  &&['consent_pending','ready_not_recording','paused_for_joiner','off_record','stopped','cancelled','deletion_requested']
    .includes(String(value.state))&&communicationMessagingText(value.noticeVersion,1,64)
  &&value.lateJoinerPauseRequired===true&&value.anyDeclineKeepsCallOffRecord===true
  &&value.visibleRecordingIndicatorActive===false&&value.audibleRecordingAnnouncementExecuted===false
  &&value.recordingRoleBoundToE2eeGroup===false&&value.mediaCaptureStarted===false
  &&Array.isArray(value.participants)&&value.participants.length>=2&&value.participants.length<=16
  &&value.participants.every(communicationRecordingConsentResult)&&communicationRecordingRetentionResult(value.retention)
  &&Array.isArray(value.segments)&&value.segments.length<=128&&value.segments.every(communicationRecordingSegmentResult)
  &&communicationMessagingRevision(value.revision)&&communicationMessagingIso(value.createdAt)&&communicationMessagingIso(value.updatedAt);
const communicationRecordingTruthResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,[
  'recordingDefaultOff','separateExplicitParticipantConsentModeled','lateJoinerPauseModeled',
  'declineContinuesCallOffRecordModeled','futureRecordingWithdrawalModeled','onRecordOffRecordSegmentsModeled',
  'perMediaRetentionModeled','contentFreeConsentAuditModeled','rendererMediaAuthority','productionRecordingProviderConfigured',
  'actualAudioCaptureExecuted','actualVideoCaptureExecuted','actualTranscriptPersistenceExecuted',
  'actualTranslationPersistenceExecuted','visibleRedIndicatorUatExecuted','audibleAnnouncementUatExecuted',
  'e2eeRecorderRoleVerified','encryptedMediaVaultConfigured','mediaHashSignatureVerified','securePhysicalDeletionVerified',
  'guardianLegalPolicyConfigured','childRecordingLegalReviewCompleted','networkUsedByCurrentImplementation'])
  &&['recordingDefaultOff','separateExplicitParticipantConsentModeled','lateJoinerPauseModeled',
    'declineContinuesCallOffRecordModeled','futureRecordingWithdrawalModeled','onRecordOffRecordSegmentsModeled',
    'perMediaRetentionModeled','contentFreeConsentAuditModeled'].every(key=>value[key]===true)
  &&['rendererMediaAuthority','productionRecordingProviderConfigured','actualAudioCaptureExecuted','actualVideoCaptureExecuted',
    'actualTranscriptPersistenceExecuted','actualTranslationPersistenceExecuted','visibleRedIndicatorUatExecuted',
    'audibleAnnouncementUatExecuted','e2eeRecorderRoleVerified','encryptedMediaVaultConfigured','mediaHashSignatureVerified',
    'securePhysicalDeletionVerified','guardianLegalPolicyConfigured','childRecordingLegalReviewCompleted',
    'networkUsedByCurrentImplementation'].every(key=>value[key]===false);
const communicationRecordingCenterResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['schemaVersion','centerId','ownerPersonId','requests','truth','generatedAt'])&&value.schemaVersion===1
  &&communicationIdentifier(value.centerId)&&communicationIdentifier(value.ownerPersonId)&&Array.isArray(value.requests)
  &&value.requests.length<=256&&value.requests.every(communicationRecordingRequestResult)
  &&communicationRecordingTruthResult(value.truth)&&communicationMessagingIso(value.generatedAt);
const communicationRecordingReceiptResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['resourceType','resourceId','mutationKind','previousRevision','revision','occurredAt','replayed','mediaCaptureStarted',
    'mediaArtifactCreated','networkUsed'])&&value.resourceType==='communication_recording_request'
  &&communicationIdentifier(value.resourceId)&&['recording_request_create','participant_consent_decide',
    'participant_consent_withdraw','late_joiner_add','recording_segment_change','recording_retention_update',
    'recording_delete_request'].includes(String(value.mutationKind))
  &&communicationMessagingRevision(value.previousRevision,true)&&communicationMessagingRevision(value.revision)
  &&Number(value.revision)===Number(value.previousRevision)+1&&communicationMessagingIso(value.occurredAt)
  &&typeof value.replayed==='boolean'&&value.mediaCaptureStarted===false&&value.mediaArtifactCreated===false&&value.networkUsed===false;
const communicationRecordingResult=(channel:string,result:unknown):IpcIntegrationPolicyDecision=>{
  const valid=channel===COMMUNICATION_RECORDING_IPC_CHANNELS.getCenter
    ?communicationRecordingCenterResult(result):communicationRecordingReceiptResult(result);
  return valid?accepted():rejected('COMMUNICATION_RECORDING_RESULT_INVALID','$result');
};

export const LOCAL_TRANSLATION_IPC_CHANNELS=Object.freeze({
  getCenter:'localTranslation:getCenter',
  updateProfile:'localTranslation:updateProfile',
  addDictionary:'localTranslation:addDictionary',
  updateDictionary:'localTranslation:updateDictionary',
  deleteDictionary:'localTranslation:deleteDictionary',
  prepareRequest:'localTranslation:prepareRequest',
  recordCorrection:'localTranslation:recordCorrection',
  cancelRequest:'localTranslation:cancelRequest'
} as const);
const localTranslationChannels=new Set<string>(Object.values(LOCAL_TRANSLATION_IPC_CHANNELS));
const localTranslationLanguage=(value:unknown):boolean=>typeof value==='string'
  &&/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/u.test(value);
const localTranslationInput=(channel:string,args:readonly unknown[]):IpcIntegrationPolicyDecision=>{
  if(channel===LOCAL_TRANSLATION_IPC_CHANNELS.getCenter)return zeroArguments(args);
  if(channel===LOCAL_TRANSLATION_IPC_CHANNELS.updateProfile)return exactObject(args,
    ['clientOperationId','expectedRevision','preferredLanguage','secondaryLanguages','liveCaptionTranslationEnabled',
      'translatedSpeechEnabled','preserveOriginalAudio','externalProviderAllowed','encryptedSyncRequested'],value=>
      communicationIdentifier(value.clientOperationId)&&communicationMessagingRevision(value.expectedRevision,true)
      &&localTranslationLanguage(value.preferredLanguage)&&Array.isArray(value.secondaryLanguages)
      &&value.secondaryLanguages.length<=8&&value.secondaryLanguages.every(localTranslationLanguage)
      &&new Set(value.secondaryLanguages).size===value.secondaryLanguages.length
      &&['liveCaptionTranslationEnabled','translatedSpeechEnabled','externalProviderAllowed','encryptedSyncRequested']
        .every(key=>typeof value[key]==='boolean')&&value.preserveOriginalAudio===true);
  if(channel===LOCAL_TRANSLATION_IPC_CHANNELS.addDictionary)return exactObject(args,
    ['clientOperationId','expectedRevision','category','sourceLanguage','targetLanguage','sourceTerm','preferredTerm','explicitPermission'],value=>
      communicationIdentifier(value.clientOperationId)&&communicationMessagingRevision(value.expectedRevision,true)
      &&['family_name','nickname','place','medical_term'].includes(String(value.category))
      &&localTranslationLanguage(value.sourceLanguage)&&localTranslationLanguage(value.targetLanguage)
      &&communicationMessagingText(value.sourceTerm,1,120)&&communicationMessagingText(value.preferredTerm,1,120)
      &&value.explicitPermission===true);
  if(channel===LOCAL_TRANSLATION_IPC_CHANNELS.updateDictionary)return exactObject(args,
    ['clientOperationId','expectedRevision','entryId','category','sourceLanguage','targetLanguage','sourceTerm','preferredTerm','explicitPermission'],value=>
      communicationIdentifier(value.clientOperationId)&&communicationMessagingRevision(value.expectedRevision)
      &&communicationIdentifier(value.entryId)&&['family_name','nickname','place','medical_term'].includes(String(value.category))
      &&localTranslationLanguage(value.sourceLanguage)&&localTranslationLanguage(value.targetLanguage)
      &&communicationMessagingText(value.sourceTerm,1,120)&&communicationMessagingText(value.preferredTerm,1,120)
      &&value.explicitPermission===true);
  if(channel===LOCAL_TRANSLATION_IPC_CHANNELS.deleteDictionary)return exactObject(args,
    ['clientOperationId','expectedRevision','entryId','reason'],value=>communicationIdentifier(value.clientOperationId)
      &&communicationMessagingRevision(value.expectedRevision)&&communicationIdentifier(value.entryId)
      &&communicationMessagingText(value.reason,2,300));
  if(channel===LOCAL_TRANSLATION_IPC_CHANNELS.prepareRequest)return exactObject(args,
    ['clientOperationId','expectedRevision','sourceKind','sourceResourceId','targetLanguage','providerMode',
      'externalPreviewAcknowledged','explicitExternalConsent'],value=>communicationIdentifier(value.clientOperationId)
      &&value.expectedRevision===0&&['message','live_caption','document','meeting_summary'].includes(String(value.sourceKind))
      &&communicationIdentifier(value.sourceResourceId)&&localTranslationLanguage(value.targetLanguage)
      &&['local_offline','external_preview'].includes(String(value.providerMode))
      &&typeof value.externalPreviewAcknowledged==='boolean'&&typeof value.explicitExternalConsent==='boolean'
      &&(value.providerMode==='local_offline'
        ?value.externalPreviewAcknowledged===false&&value.explicitExternalConsent===false
        :value.externalPreviewAcknowledged===true&&value.explicitExternalConsent===true));
  if(channel===LOCAL_TRANSLATION_IPC_CHANNELS.recordCorrection)return exactObject(args,
    ['clientOperationId','expectedRevision','requestId','correctedText','explicitPermission'],value=>
      communicationIdentifier(value.clientOperationId)&&communicationMessagingRevision(value.expectedRevision)
      &&communicationIdentifier(value.requestId)&&communicationMessagingText(value.correctedText,1,10_000)
      &&value.explicitPermission===true);
  if(channel===LOCAL_TRANSLATION_IPC_CHANNELS.cancelRequest)return exactObject(args,
    ['clientOperationId','expectedRevision','requestId','reason'],value=>communicationIdentifier(value.clientOperationId)
      &&communicationMessagingRevision(value.expectedRevision)&&communicationIdentifier(value.requestId)
      &&communicationMessagingText(value.reason,2,300));
  return rejected('UNKNOWN_IPC_CHANNEL','$');
};
const localTranslationProfileResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['id','preferredLanguage','secondaryLanguages','localFirstRequired','liveCaptionTranslationEnabled',
    'translatedSpeechEnabled','preserveOriginalAudio','externalProviderAllowed','externalPreviewRequired',
    'externalConsentRequired','encryptedSyncRequested','encryptedSyncExecuted','revision','updatedAt'])
  &&communicationIdentifier(value.id)&&localTranslationLanguage(value.preferredLanguage)
  &&Array.isArray(value.secondaryLanguages)&&value.secondaryLanguages.length<=8
  &&value.secondaryLanguages.every(localTranslationLanguage)&&value.localFirstRequired===true
  &&typeof value.liveCaptionTranslationEnabled==='boolean'&&typeof value.translatedSpeechEnabled==='boolean'
  &&value.preserveOriginalAudio===true&&typeof value.externalProviderAllowed==='boolean'
  &&value.externalPreviewRequired===true&&value.externalConsentRequired===true
  &&typeof value.encryptedSyncRequested==='boolean'&&value.encryptedSyncExecuted===false
  &&communicationMessagingRevision(value.revision,true)&&communicationMessagingIso(value.updatedAt);
const localTranslationDictionaryResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['id','category','sourceLanguage','targetLanguage','sourceTerm','preferredTerm','explicitPermissionRecorded','enabled','revision','updatedAt'])
  &&communicationIdentifier(value.id)&&['family_name','nickname','place','medical_term'].includes(String(value.category))
  &&localTranslationLanguage(value.sourceLanguage)&&localTranslationLanguage(value.targetLanguage)
  &&communicationMessagingText(value.sourceTerm,1,120)&&communicationMessagingText(value.preferredTerm,1,120)
  &&value.explicitPermissionRecorded===true&&typeof value.enabled==='boolean'
  &&communicationMessagingRevision(value.revision)&&communicationMessagingIso(value.updatedAt);
const localTranslationRequestResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['id','sourceKind','sourceResourceId','targetLanguage','providerMode','state','originalPreservationRequired',
    'separateTranslationViewRequired','machineTranslationLabelRequired','qualityFlag','externalPreviewAcknowledged',
    'explicitExternalConsent','correctionRecorded',...(value.correctionCharacterCount===undefined?[]:['correctionCharacterCount']),
    'languageDetectionExecuted','translationExecuted','speechToTextExecuted','speakerSeparationExecuted',
    'liveCaptionTranslationExecuted','textToSpeechExecuted','networkUsed','cloudUsed','revision','createdAt','updatedAt'])
  &&communicationIdentifier(value.id)&&['message','live_caption','document','meeting_summary'].includes(String(value.sourceKind))
  &&communicationIdentifier(value.sourceResourceId)&&localTranslationLanguage(value.targetLanguage)
  &&['local_offline','external_preview'].includes(String(value.providerMode))
  &&['provider_unavailable','correction_recorded','cancelled'].includes(String(value.state))
  &&value.originalPreservationRequired===true&&value.separateTranslationViewRequired===true
  &&value.machineTranslationLabelRequired===true&&['not_evaluated','ambiguous','low_confidence','possible_error'].includes(String(value.qualityFlag))
  &&typeof value.externalPreviewAcknowledged==='boolean'&&typeof value.explicitExternalConsent==='boolean'
  &&typeof value.correctionRecorded==='boolean'
  &&(value.correctionRecorded===false?value.correctionCharacterCount===undefined
    :(Number.isSafeInteger(value.correctionCharacterCount)&&Number(value.correctionCharacterCount)>=1
      &&Number(value.correctionCharacterCount)<=10_000))
  &&['languageDetectionExecuted','translationExecuted','speechToTextExecuted','speakerSeparationExecuted',
    'liveCaptionTranslationExecuted','textToSpeechExecuted','networkUsed','cloudUsed'].every(key=>value[key]===false)
  &&communicationMessagingRevision(value.revision)&&communicationMessagingIso(value.createdAt)&&communicationMessagingIso(value.updatedAt);
const localTranslationTruthResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['commonTranslationProviderPortModeled','localFirstPolicyModeled','originalPreservationContractModeled',
    'separateMachineTranslationLabelModeled','personalDictionaryModeled','explicitCorrectionPermissionModeled',
    'externalPreviewAndConsentModeled','rendererProviderAuthority','productionTranslationProviderConfigured',
    'localLanguagePackInstalled','languageDetectionExecuted','translationExecuted','speechToTextExecuted',
    'speakerSeparationExecuted','liveCaptionTranslationExecuted','textToSpeechExecuted','originalAudioMuted',
    'externalProviderConfigured','externalProviderPreviewDelivered','encryptedCrossDevicePreferenceSyncExecuted',
    'networkUsedByCurrentImplementation'])
  &&['commonTranslationProviderPortModeled','localFirstPolicyModeled','originalPreservationContractModeled',
    'separateMachineTranslationLabelModeled','personalDictionaryModeled','explicitCorrectionPermissionModeled',
    'externalPreviewAndConsentModeled'].every(key=>value[key]===true)
  &&['rendererProviderAuthority','productionTranslationProviderConfigured','localLanguagePackInstalled','languageDetectionExecuted',
    'translationExecuted','speechToTextExecuted','speakerSeparationExecuted','liveCaptionTranslationExecuted',
    'textToSpeechExecuted','originalAudioMuted','externalProviderConfigured','externalProviderPreviewDelivered',
    'encryptedCrossDevicePreferenceSyncExecuted','networkUsedByCurrentImplementation'].every(key=>value[key]===false);
const localTranslationCenterResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['schemaVersion','centerId','ownerPersonId','profile','dictionary','requests','truth','generatedAt'])&&value.schemaVersion===1
  &&communicationIdentifier(value.centerId)&&communicationIdentifier(value.ownerPersonId)&&localTranslationProfileResult(value.profile)
  &&Array.isArray(value.dictionary)&&value.dictionary.length<=256&&value.dictionary.every(localTranslationDictionaryResult)
  &&Array.isArray(value.requests)&&value.requests.length<=256&&value.requests.every(localTranslationRequestResult)
  &&localTranslationTruthResult(value.truth)&&communicationMessagingIso(value.generatedAt);
const localTranslationReceiptResult=(value:unknown):boolean=>isObject(value)&&healthCareExactRecord(value,
  ['resourceType','resourceId','mutationKind','previousRevision','revision','occurredAt','replayed','providerConfigured',
    'translationExecuted','networkUsed','cloudUsed'])
  &&['local_translation_profile','local_translation_request'].includes(String(value.resourceType))
  &&communicationIdentifier(value.resourceId)&&['profile_update','dictionary_add','dictionary_update','dictionary_delete',
    'request_prepare','correction_record','request_cancel'].includes(String(value.mutationKind))
  &&communicationMessagingRevision(value.previousRevision,true)&&communicationMessagingRevision(value.revision)
  &&Number(value.revision)===Number(value.previousRevision)+1&&communicationMessagingIso(value.occurredAt)
  &&typeof value.replayed==='boolean'&&value.providerConfigured===false&&value.translationExecuted===false
  &&value.networkUsed===false&&value.cloudUsed===false;
const localTranslationResult=(channel:string,result:unknown):IpcIntegrationPolicyDecision=>{
  const valid=channel===LOCAL_TRANSLATION_IPC_CHANNELS.getCenter
    ?localTranslationCenterResult(result):localTranslationReceiptResult(result);
  return valid?accepted():rejected('LOCAL_TRANSLATION_RESULT_INVALID','$result');
};

export const FAMILY_MEETING_IPC_CHANNELS=Object.freeze({
  getCenter:'familyMeeting:getCenter',
  getMinutes:'familyMeeting:getMinutes',
  create:'familyMeeting:create',
  updatePlan:'familyMeeting:updatePlan',
  setState:'familyMeeting:setState',
  upsertParticipant:'familyMeeting:upsertParticipant',
  upsertAgenda:'familyMeeting:upsertAgenda',
  createPoll:'familyMeeting:createPoll',
  castVote:'familyMeeting:castVote',
  recordDecision:'familyMeeting:recordDecision',
  upsertTask:'familyMeeting:upsertTask',
  addCollaboration:'familyMeeting:addCollaboration',
  prepareAiMinutes:'familyMeeting:prepareAiMinutes',
  finalizeMinutes:'familyMeeting:finalizeMinutes'
} as const);
const familyMeetingChannels=new Set<string>(Object.values(FAMILY_MEETING_IPC_CHANNELS));
const familyMeetingId=(value:unknown):value is string=>typeof value==='string'&&value===value.trim()
  &&value.length>=2&&value.length<=256&&/^[A-Za-z0-9][A-Za-z0-9._:@-]*$/u.test(value);
const familyMeetingText=(value:unknown,minimum:number,maximum:number):value is string=>
  communicationMessagingText(value,minimum,maximum)&&String(value)===String(value).trim();
const familyMeetingOptionalText=(value:unknown,maximum:number):boolean=>value===undefined||familyMeetingText(value,1,maximum);
const familyMeetingCanonicalIds=(value:unknown,minimum:number,maximum:number):value is readonly string[]=>
  Array.isArray(value)&&Object.getPrototypeOf(value)===Array.prototype&&value.length>=minimum&&value.length<=maximum
  &&value.every(familyMeetingId)&&new Set(value).size===value.length;
const familyMeetingCanonicalTexts=(value:unknown,minimum:number,maximum:number,itemMaximum=256):value is readonly string[]=>
  Array.isArray(value)&&Object.getPrototypeOf(value)===Array.prototype&&value.length>=minimum&&value.length<=maximum
  &&value.every((item)=>familyMeetingText(item,2,itemMaximum))&&new Set(value).size===value.length;
const familyMeetingCommonMutation=(value:Record<string,unknown>):boolean=>familyMeetingId(value.clientOperationId)
  &&communicationMessagingRevision(value.expectedRevision)&&familyMeetingId(value.meetingId);
const familyMeetingInput=(channel:string,args:readonly unknown[]):IpcIntegrationPolicyDecision=>{
  if(channel===FAMILY_MEETING_IPC_CHANNELS.getCenter)return zeroArguments(args);
  if(channel===FAMILY_MEETING_IPC_CHANNELS.getMinutes)return exactObject(args,['meetingId'],value=>familyMeetingId(value.meetingId));
  if(channel===FAMILY_MEETING_IPC_CHANNELS.create)return exactObject(args,
    ['clientOperationId','expectedRevision','title','recurrenceKind','recurrenceInterval','startsAt','endsAt','reminderMinutes','participantPersonIds'],value=>
      familyMeetingId(value.clientOperationId)&&value.expectedRevision===0&&familyMeetingText(value.title,2,200)
      &&['once','daily','weekly','monthly'].includes(String(value.recurrenceKind))
      &&Number.isSafeInteger(value.recurrenceInterval)&&Number(value.recurrenceInterval)>=1&&Number(value.recurrenceInterval)<=52
      &&communicationMessagingIso(value.startsAt)&&communicationMessagingIso(value.endsAt)
      &&Date.parse(String(value.endsAt))>Date.parse(String(value.startsAt))
      &&Number.isSafeInteger(value.reminderMinutes)&&Number(value.reminderMinutes)>=0&&Number(value.reminderMinutes)<=10_080
      &&familyMeetingCanonicalIds(value.participantPersonIds,0,32));
  if(channel===FAMILY_MEETING_IPC_CHANNELS.updatePlan)return exactObject(args,
    ['clientOperationId','expectedRevision','meetingId','title','recurrenceKind','recurrenceInterval','startsAt','endsAt','reminderMinutes'],value=>
      familyMeetingCommonMutation(value)&&familyMeetingText(value.title,2,200)
      &&['once','daily','weekly','monthly'].includes(String(value.recurrenceKind))
      &&Number.isSafeInteger(value.recurrenceInterval)&&Number(value.recurrenceInterval)>=1&&Number(value.recurrenceInterval)<=52
      &&communicationMessagingIso(value.startsAt)&&communicationMessagingIso(value.endsAt)
      &&Date.parse(String(value.endsAt))>Date.parse(String(value.startsAt))
      &&Number.isSafeInteger(value.reminderMinutes)&&Number(value.reminderMinutes)>=0&&Number(value.reminderMinutes)<=10_080);
  if(channel===FAMILY_MEETING_IPC_CHANNELS.setState)return exactObject(args,
    ['clientOperationId','expectedRevision','meetingId','state','reason'],value=>familyMeetingCommonMutation(value)
      &&['in_progress','completed','cancelled'].includes(String(value.state))&&familyMeetingText(value.reason,3,500));
  if(channel===FAMILY_MEETING_IPC_CHANNELS.upsertParticipant)return exactObject(args,
    ['clientOperationId','expectedRevision','meetingId','participantPersonId','roles','attendance','reminderEnabled'],value=>
      familyMeetingCommonMutation(value)&&familyMeetingId(value.participantPersonId)
      &&healthCareCanonicalValues(value.roles,new Set(['host','facilitator','note_taker','translator','caregiver','attendee']),1,6)
      &&['invited','accepted','tentative','declined','attended','absent'].includes(String(value.attendance))
      &&typeof value.reminderEnabled==='boolean');
  if(channel===FAMILY_MEETING_IPC_CHANNELS.upsertAgenda)return exactObject(args,
    ['clientOperationId','expectedRevision','meetingId','agendaItemId','title','note','order','preRead','carryForwardToNextMeeting'],value=>
      familyMeetingCommonMutation(value)&&(value.agendaItemId===undefined||familyMeetingId(value.agendaItemId))
      &&familyMeetingText(value.title,2,500)&&familyMeetingOptionalText(value.note,4_000)
      &&Number.isSafeInteger(value.order)&&Number(value.order)>=1&&Number(value.order)<=256
      &&Array.isArray(value.preRead)&&value.preRead.length<=16&&value.preRead.every((item)=>healthCareExactRecord(item,['resourceType','resourceId'])
        &&['archive_item','communication_message','memory_studio_record'].includes(String(item.resourceType))&&familyMeetingId(item.resourceId))
      &&typeof value.carryForwardToNextMeeting==='boolean');
  if(channel===FAMILY_MEETING_IPC_CHANNELS.createPoll)return exactObject(args,
    ['clientOperationId','expectedRevision','meetingId','question','options'],value=>familyMeetingCommonMutation(value)
      &&familyMeetingText(value.question,2,1_000)&&familyMeetingCanonicalTexts(value.options,2,12));
  if(channel===FAMILY_MEETING_IPC_CHANNELS.castVote)return exactObject(args,
    ['clientOperationId','expectedRevision','meetingId','pollId','optionId','abstain','opinionNote'],value=>familyMeetingCommonMutation(value)
      &&familyMeetingId(value.pollId)&&(value.optionId===undefined||familyMeetingId(value.optionId))
      &&typeof value.abstain==='boolean'&&(value.abstain===(value.optionId===undefined))&&familyMeetingOptionalText(value.opinionNote,2_000));
  if(channel===FAMILY_MEETING_IPC_CHANNELS.recordDecision)return exactObject(args,
    ['clientOperationId','expectedRevision','meetingId','statement','sourcePollId','responsiblePersonIds'],value=>familyMeetingCommonMutation(value)
      &&familyMeetingText(value.statement,2,4_000)&&(value.sourcePollId===undefined||familyMeetingId(value.sourcePollId))
      &&familyMeetingCanonicalIds(value.responsiblePersonIds,0,32));
  if(channel===FAMILY_MEETING_IPC_CHANNELS.upsertTask)return exactObject(args,
    ['clientOperationId','expectedRevision','meetingId','taskId','decisionId','title','responsiblePersonId','dueAt','state','followUpNote','carryForwardToNextMeeting'],value=>
      familyMeetingCommonMutation(value)&&(value.taskId===undefined||familyMeetingId(value.taskId))
      &&(value.decisionId===undefined||familyMeetingId(value.decisionId))&&familyMeetingText(value.title,2,1_000)
      &&familyMeetingId(value.responsiblePersonId)&&communicationMessagingIso(value.dueAt)
      &&['open','in_progress','completed','cancelled'].includes(String(value.state))&&familyMeetingOptionalText(value.followUpNote,2_000)
      &&typeof value.carryForwardToNextMeeting==='boolean');
  if(channel===FAMILY_MEETING_IPC_CHANNELS.addCollaboration)return exactObject(args,
    ['clientOperationId','expectedRevision','meetingId','kind','resourceType','resourceId','annotation'],value=>familyMeetingCommonMutation(value)
      &&['whiteboard','photo_album','document_annotation'].includes(String(value.kind))
      &&['archive_item','album','whiteboard'].includes(String(value.resourceType))&&familyMeetingId(value.resourceId)
      &&familyMeetingOptionalText(value.annotation,4_000));
  if(channel===FAMILY_MEETING_IPC_CHANNELS.prepareAiMinutes)return exactObject(args,
    ['clientOperationId','expectedRevision','meetingId','recordingRequestId'],value=>familyMeetingCommonMutation(value)
      &&familyMeetingId(value.recordingRequestId));
  if(channel===FAMILY_MEETING_IPC_CHANNELS.finalizeMinutes)return exactObject(args,
    ['clientOperationId','expectedRevision','meetingId','summary','decisions','tasks','participantAccessPersonIds',
      'selectedRecordingSegmentIds','explicitHumanApproval','machineGeneratedSource'],value=>familyMeetingCommonMutation(value)
      &&familyMeetingText(value.summary,2,32_768)&&familyMeetingCanonicalTexts(value.decisions,0,128)
      &&familyMeetingCanonicalTexts(value.tasks,0,128)&&familyMeetingCanonicalIds(value.participantAccessPersonIds,1,32)
      &&familyMeetingCanonicalIds(value.selectedRecordingSegmentIds,0,64)&&value.explicitHumanApproval===true
      &&typeof value.machineGeneratedSource==='boolean');
  return rejected('UNKNOWN_IPC_CHANNEL','$');
};

const familyMeetingExact=(value:unknown,required:readonly string[],optional:readonly string[]=[]):value is Record<string,unknown>=>
  isObject(value)&&healthCareExactRecord(value,[...required,...optional.filter((key)=>value[key]!==undefined)]);
const familyMeetingPreReadResult=(value:unknown):boolean=>familyMeetingExact(value,['resourceType','resourceId'])
  &&['archive_item','communication_message','memory_studio_record'].includes(String(value.resourceType))&&familyMeetingId(value.resourceId);
const familyMeetingParticipantResult=(value:unknown):boolean=>familyMeetingExact(value,
  ['personId','roles','attendance','reminderEnabled','revision','updatedAt'])&&familyMeetingId(value.personId)
  &&healthCareCanonicalValues(value.roles,new Set(['host','facilitator','note_taker','translator','caregiver','attendee']),1,6)
  &&['invited','accepted','tentative','declined','attended','absent'].includes(String(value.attendance))
  &&typeof value.reminderEnabled==='boolean'&&communicationMessagingRevision(value.revision)&&communicationMessagingIso(value.updatedAt);
const familyMeetingAgendaResult=(value:unknown):boolean=>familyMeetingExact(value,
  ['id','title','order','preRead','carryForwardToNextMeeting','revision','updatedAt'],['note'])&&familyMeetingId(value.id)
  &&familyMeetingText(value.title,2,500)&&familyMeetingOptionalText(value.note,4_000)&&Number.isSafeInteger(value.order)
  &&Number(value.order)>=1&&Number(value.order)<=256&&Array.isArray(value.preRead)&&value.preRead.length<=16
  &&value.preRead.every(familyMeetingPreReadResult)&&typeof value.carryForwardToNextMeeting==='boolean'
  &&communicationMessagingRevision(value.revision)&&communicationMessagingIso(value.updatedAt);
const familyMeetingVoteResult=(value:unknown):boolean=>familyMeetingExact(value,
  ['voterPersonId','abstained','castAt'],['optionId','opinionNote'])&&familyMeetingId(value.voterPersonId)
  &&(value.optionId===undefined||familyMeetingId(value.optionId))&&typeof value.abstained==='boolean'
  &&(value.abstained===(value.optionId===undefined))&&familyMeetingOptionalText(value.opinionNote,2_000)&&communicationMessagingIso(value.castAt);
const familyMeetingPollResult=(value:unknown):boolean=>familyMeetingExact(value,
  ['id','question','options','state','votes','createdAt'])&&familyMeetingId(value.id)&&familyMeetingText(value.question,2,1_000)
  &&Array.isArray(value.options)&&value.options.length>=2&&value.options.length<=12
  &&value.options.every((option)=>familyMeetingExact(option,['id','label'])&&familyMeetingId(option.id)&&familyMeetingText(option.label,2,256))
  &&['open','closed'].includes(String(value.state))&&Array.isArray(value.votes)&&value.votes.length<=32
  &&value.votes.every(familyMeetingVoteResult)&&communicationMessagingIso(value.createdAt);
const familyMeetingDecisionResult=(value:unknown):boolean=>familyMeetingExact(value,
  ['id','statement','responsiblePersonIds','recordedAt'],['sourcePollId'])&&familyMeetingId(value.id)
  &&familyMeetingText(value.statement,2,4_000)&&(value.sourcePollId===undefined||familyMeetingId(value.sourcePollId))
  &&familyMeetingCanonicalIds(value.responsiblePersonIds,0,32)&&communicationMessagingIso(value.recordedAt);
const familyMeetingTaskResult=(value:unknown):boolean=>familyMeetingExact(value,
  ['id','title','responsiblePersonId','dueAt','state','carryForwardToNextMeeting','revision','updatedAt'],['decisionId','followUpNote'])
  &&familyMeetingId(value.id)&&(value.decisionId===undefined||familyMeetingId(value.decisionId))&&familyMeetingText(value.title,2,1_000)
  &&familyMeetingId(value.responsiblePersonId)&&communicationMessagingIso(value.dueAt)
  &&['open','in_progress','completed','cancelled'].includes(String(value.state))&&familyMeetingOptionalText(value.followUpNote,2_000)
  &&typeof value.carryForwardToNextMeeting==='boolean'&&communicationMessagingRevision(value.revision)&&communicationMessagingIso(value.updatedAt);
const familyMeetingCollaborationResult=(value:unknown):boolean=>familyMeetingExact(value,
  ['id','kind','resourceType','resourceId','addedByPersonId','addedAt'],['annotation'])&&familyMeetingId(value.id)
  &&['whiteboard','photo_album','document_annotation'].includes(String(value.kind))
  &&['archive_item','album','whiteboard'].includes(String(value.resourceType))&&familyMeetingId(value.resourceId)
  &&familyMeetingOptionalText(value.annotation,4_000)&&familyMeetingId(value.addedByPersonId)&&communicationMessagingIso(value.addedAt);
const familyMeetingMinutesMetadataResult=(value:unknown):boolean=>familyMeetingExact(value,
  ['id','state','transcriptConsentVerified','aiSuggestionGenerated','humanApprovalRecorded','encryptedPackageAvailable',
    'participantAccessPersonIds','selectedRecordingSegmentIds','revision','updatedAt','networkUsed','cloudUsed'],['recordingRequestId'])
  &&familyMeetingId(value.id)&&['not_prepared','provider_unavailable','pending_human_review','dismissed','sealed_local'].includes(String(value.state))
  &&(value.recordingRequestId===undefined||familyMeetingId(value.recordingRequestId))
  &&['transcriptConsentVerified','aiSuggestionGenerated','humanApprovalRecorded','encryptedPackageAvailable'].every((key)=>typeof value[key]==='boolean')
  &&familyMeetingCanonicalIds(value.participantAccessPersonIds,0,32)&&familyMeetingCanonicalIds(value.selectedRecordingSegmentIds,0,64)
  &&communicationMessagingRevision(value.revision,true)&&communicationMessagingIso(value.updatedAt)&&value.networkUsed===false&&value.cloudUsed===false;
const familyMeetingTruthResult=(value:unknown):boolean=>familyMeetingExact(value,[
  'singleAndRecurringSchedulingModeled','agendaPreReadAttendanceReminderModeled','explicitMeetingRolesModeled',
  'pollVoteAbstentionOpinionModeled','appendOnlyDecisionLedgerModeled','taskFollowUpCarryForwardModeled',
  'collaborationReferencesModeled','transcriptConsentGateModeled','humanApprovalRequiredForAiMinutes',
  'encryptedMinutesPackageImplemented','participantScopedMinutesReadImplemented','productionAiMinutesProviderConfigured',
  'transcriptPayloadReadExecutedByCurrentImplementation','externalCalendarDeliveryExecuted','externalReminderDeliveryExecuted',
  'remoteCollaborationExecuted','networkUsedByCurrentImplementation'])
  &&['singleAndRecurringSchedulingModeled','agendaPreReadAttendanceReminderModeled','explicitMeetingRolesModeled',
    'pollVoteAbstentionOpinionModeled','appendOnlyDecisionLedgerModeled','taskFollowUpCarryForwardModeled',
    'collaborationReferencesModeled','transcriptConsentGateModeled','humanApprovalRequiredForAiMinutes',
    'encryptedMinutesPackageImplemented','participantScopedMinutesReadImplemented'].every((key)=>value[key]===true)
  &&['productionAiMinutesProviderConfigured','transcriptPayloadReadExecutedByCurrentImplementation','externalCalendarDeliveryExecuted',
    'externalReminderDeliveryExecuted','remoteCollaborationExecuted','networkUsedByCurrentImplementation'].every((key)=>value[key]===false);
const familyMeetingResultItem=(value:unknown):boolean=>familyMeetingExact(value,
  ['id','title','recurrenceKind','recurrenceInterval','startsAt','endsAt','reminderMinutes','state','participants','agenda','polls',
    'decisions','tasks','collaboration','minutes','revision','createdAt','updatedAt'])&&familyMeetingId(value.id)
  &&familyMeetingText(value.title,2,200)&&['once','daily','weekly','monthly'].includes(String(value.recurrenceKind))
  &&Number.isSafeInteger(value.recurrenceInterval)&&Number(value.recurrenceInterval)>=1&&Number(value.recurrenceInterval)<=52
  &&communicationMessagingIso(value.startsAt)&&communicationMessagingIso(value.endsAt)&&Number.isSafeInteger(value.reminderMinutes)
  &&Number(value.reminderMinutes)>=0&&Number(value.reminderMinutes)<=10_080&&['scheduled','in_progress','completed','cancelled'].includes(String(value.state))
  &&Array.isArray(value.participants)&&value.participants.length<=32&&value.participants.every(familyMeetingParticipantResult)
  &&Array.isArray(value.agenda)&&value.agenda.length<=256&&value.agenda.every(familyMeetingAgendaResult)
  &&Array.isArray(value.polls)&&value.polls.length<=64&&value.polls.every(familyMeetingPollResult)
  &&Array.isArray(value.decisions)&&value.decisions.length<=256&&value.decisions.every(familyMeetingDecisionResult)
  &&Array.isArray(value.tasks)&&value.tasks.length<=256&&value.tasks.every(familyMeetingTaskResult)
  &&Array.isArray(value.collaboration)&&value.collaboration.length<=256&&value.collaboration.every(familyMeetingCollaborationResult)
  &&familyMeetingMinutesMetadataResult(value.minutes)&&communicationMessagingRevision(value.revision)
  &&communicationMessagingIso(value.createdAt)&&communicationMessagingIso(value.updatedAt);
const familyMeetingCenterResult=(value:unknown):boolean=>familyMeetingExact(value,['schemaVersion','meetings','truth','generatedAt'])
  &&value.schemaVersion===1&&Array.isArray(value.meetings)&&value.meetings.length<=64
  &&value.meetings.every(familyMeetingResultItem)&&familyMeetingTruthResult(value.truth)&&communicationMessagingIso(value.generatedAt);
const familyMeetingMinutesResult=(value:unknown):boolean=>familyMeetingExact(value,
  ['meetingId','minutesRevision','summary','decisions','tasks','participantAccessPersonIds','selectedRecordingSegmentIds',
    'payloadSource','machineGeneratedSource','humanApproved','networkUsed','cloudUsed'])&&familyMeetingId(value.meetingId)
  &&communicationMessagingRevision(value.minutesRevision)&&familyMeetingText(value.summary,2,32_768)
  &&familyMeetingCanonicalTexts(value.decisions,0,128)&&familyMeetingCanonicalTexts(value.tasks,0,128)
  &&familyMeetingCanonicalIds(value.participantAccessPersonIds,1,32)&&familyMeetingCanonicalIds(value.selectedRecordingSegmentIds,0,64)
  &&value.payloadSource==='local_sealed_store'&&typeof value.machineGeneratedSource==='boolean'
  &&value.humanApproved===true&&value.networkUsed===false&&value.cloudUsed===false;
const familyMeetingMutationResult=(value:unknown):boolean=>familyMeetingExact(value,
  ['meetingId','mutationKind','previousRevision','revision','occurredAt','replayed','encryptedMinutesPackageWritten',
    'aiProviderConfigured','networkUsed','cloudUsed'])&&familyMeetingId(value.meetingId)
  &&['meeting_create','meeting_plan_update','meeting_state_update','participant_upsert','agenda_upsert','poll_create','vote_cast',
    'decision_record','task_upsert','collaboration_add','ai_minutes_prepare','minutes_finalize'].includes(String(value.mutationKind))
  &&communicationMessagingRevision(value.previousRevision,true)&&communicationMessagingRevision(value.revision)
  &&Number(value.revision)===Number(value.previousRevision)+1&&communicationMessagingIso(value.occurredAt)
  &&typeof value.replayed==='boolean'&&typeof value.encryptedMinutesPackageWritten==='boolean'
  &&value.aiProviderConfigured===false&&value.networkUsed===false&&value.cloudUsed===false;
const familyMeetingResult=(channel:string,result:unknown):IpcIntegrationPolicyDecision=>{
  const valid=channel===FAMILY_MEETING_IPC_CHANNELS.getCenter?familyMeetingCenterResult(result)
    :channel===FAMILY_MEETING_IPC_CHANNELS.getMinutes?familyMeetingMinutesResult(result):familyMeetingMutationResult(result);
  return valid?accepted():rejected('FAMILY_MEETING_RESULT_INVALID','$result');
};

export const ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS = Object.freeze({
  listEvidence: 'archive:listRelationEvidence',
  listEvidenceHistory: 'archive:listRelationEvidenceHistory',
  addEvidence: 'archive:addRelationEvidence',
  removeEvidence: 'archive:removeRelationEvidence',
  addVersion: 'archive:addVersion'
} as const);
const archiveEvidenceMediaChannels = new Set<string>(Object.values(ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS));
const archiveEvidenceConfidence = new Set<unknown>(['low', 'medium', 'high']);
const archiveEvidenceId = (value: unknown): boolean => typeof value === 'string'
  && value === value.trim() && value.length >= 1 && value.length <= 128
  && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value);
const archiveEvidenceDate = (value: unknown): boolean => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
};
const archiveEvidenceMediaInput = (channel: string, args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (channel === ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.listEvidence
    || channel === ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.listEvidenceHistory) {
    return args.length === 1 && archiveEvidenceId(args[0])
      ? accepted() : rejected('ARCHIVE_EVIDENCE_ITEM_ID_INVALID', '$[0]');
  }
  if (args.length !== 1 || !isObject(args[0])) return rejected('ARCHIVE_EVIDENCE_OBJECT_REQUIRED', '$[0]');
  const input = args[0];
  if (channel === ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.addEvidence) {
    return hasOnlyKeys(input, ['relationId', 'archiveItemId', 'evidenceDate', 'confidence', 'clientOperationId'])
      && archiveEvidenceId(input.relationId) && archiveEvidenceId(input.archiveItemId)
      && archiveEvidenceDate(input.evidenceDate) && archiveEvidenceConfidence.has(input.confidence)
      && privacyId(input.clientOperationId)
      ? accepted() : rejected('ARCHIVE_EVIDENCE_ADD_INPUT_INVALID', '$[0]');
  }
  if (channel === ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.removeEvidence) {
    return hasOnlyKeys(input, ['evidenceId', 'archiveItemId', 'expectedRevision', 'clientOperationId'])
      && archiveEvidenceId(input.evidenceId) && archiveEvidenceId(input.archiveItemId)
      && privacyRevision(input.expectedRevision) && Number(input.expectedRevision) >= 1
      && privacyId(input.clientOperationId)
      ? accepted() : rejected('ARCHIVE_EVIDENCE_REMOVE_INPUT_INVALID', '$[0]');
  }
  if (channel === ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.addVersion) {
    const keys = input.note === undefined
      ? ['itemId', 'clientOperationId'] : ['itemId', 'note', 'clientOperationId'];
    return hasOnlyKeys(input, keys) && archiveEvidenceId(input.itemId)
      && privacyId(input.clientOperationId)
      && (input.note === undefined || (boundedString(input.note, 500, true) && !/[\p{Cc}\p{Cs}]/u.test(String(input.note))))
      ? accepted() : rejected('ARCHIVE_VERSION_ADD_INPUT_INVALID', '$[0]');
  }
  return rejected('UNKNOWN_IPC_CHANNEL', '$');
};
const archiveRelationEvidenceItemResult = (value: unknown): boolean => {
  if (!isObject(value)) return false;
  const keys = value.removedAt === undefined
    ? ['id', 'relationId', 'archiveItemId', 'documentTitle', 'documentOriginalName', 'documentMimeType', 'evidenceDate', 'confidence', 'status', 'revision', 'createdAt', 'updatedAt']
    : ['id', 'relationId', 'archiveItemId', 'documentTitle', 'documentOriginalName', 'documentMimeType', 'evidenceDate', 'confidence', 'status', 'revision', 'createdAt', 'updatedAt', 'removedAt'];
  return hasOnlyKeys(value, keys) && archiveEvidenceId(value.id) && archiveEvidenceId(value.relationId)
    && archiveEvidenceId(value.archiveItemId) && boundedString(value.documentTitle, 240)
    && boundedString(value.documentOriginalName, 255) && boundedString(value.documentMimeType, 160)
    && archiveEvidenceDate(value.evidenceDate) && archiveEvidenceConfidence.has(value.confidence)
    && (value.status === 'active' || value.status === 'removed')
    && privacyRevision(value.revision) && Number(value.revision) >= 1
    && privacyIso(value.createdAt) && privacyIso(value.updatedAt)
    && ((value.status === 'active' && value.removedAt === undefined)
      || (value.status === 'removed' && privacyIso(value.removedAt)));
};
const archiveRelationEvidenceHistoryItemResult = (value: unknown): boolean => isObject(value)
  && hasOnlyKeys(value, ['mutationId', 'evidenceId', 'mutationKind', 'revision', 'evidenceDate', 'confidence', 'status', 'occurredAt'])
  && archiveEvidenceId(value.mutationId) && archiveEvidenceId(value.evidenceId)
  && (value.mutationKind === 'evidence_create' || value.mutationKind === 'evidence_remove')
  && privacyRevision(value.revision) && Number(value.revision) >= 1
  && archiveEvidenceDate(value.evidenceDate) && archiveEvidenceConfidence.has(value.confidence)
  && (value.status === 'active' || value.status === 'removed') && privacyIso(value.occurredAt);
const archiveVersionItemResult = (value: unknown): boolean => {
  if (!isObject(value)) return false;
  const keys = value.note === undefined
    ? ['id', 'archiveItemId', 'versionNo', 'originalName', 'mimeType', 'sizeBytes', 'sha256', 'createdAt']
    : ['id', 'archiveItemId', 'versionNo', 'originalName', 'mimeType', 'sizeBytes', 'sha256', 'createdAt', 'note'];
  return hasOnlyKeys(value, keys) && archiveEvidenceId(value.id) && archiveEvidenceId(value.archiveItemId)
    && Number.isSafeInteger(value.versionNo) && Number(value.versionNo) >= 1 && Number(value.versionNo) <= 1_000
    && boundedString(value.originalName, 255) && boundedString(value.mimeType, 160)
    && Number.isSafeInteger(value.sizeBytes) && Number(value.sizeBytes) >= 1 && Number(value.sizeBytes) <= 250 * 1024 * 1024
    && typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/u.test(value.sha256)
    && privacyIso(value.createdAt) && (value.note === undefined || boundedString(value.note, 500, true));
};
const archiveEvidenceMediaResult = (channel: string, result: unknown): IpcIntegrationPolicyDecision => {
  if (!Array.isArray(result) || Object.getPrototypeOf(result) !== Array.prototype || result.length > 1_000) {
    return rejected('ARCHIVE_EVIDENCE_RESULT_ARRAY_INVALID', '$result');
  }
  const valid = channel === ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.listEvidenceHistory
    ? result.every(archiveRelationEvidenceHistoryItemResult)
    : channel === ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.addVersion
      ? result.every(archiveVersionItemResult)
      : result.every(archiveRelationEvidenceItemResult);
  return valid ? accepted() : rejected('ARCHIVE_EVIDENCE_RESULT_ITEM_INVALID', '$result');
};
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
  search: 'localOcr:search',
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
    case LOCAL_GOVERNED_OCR_IPC_CHANNELS.search: {
      const keys = input.limit === undefined ? ['query'] : ['query', 'limit'];
      return localOcrExact(input, keys) && canonicalLocalGovernedOcrSearchTokens(input.query) !== null
        && (input.limit === undefined || localOcrBoundedInteger(input.limit, 1, 25))
        ? accepted() : rejected('LOCAL_OCR_SEARCH_ARGUMENT_INVALID', '$[0]');
    }
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
      'encryptedFullTextIndexAvailable', 'policyFilteredSearchRequired', 'snippetMaskingEnforced',
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
    || value.truth.encryptedFullTextIndexAvailable !== true
    || value.truth.policyFilteredSearchRequired !== true
    || value.truth.snippetMaskingEnforced !== true
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

const localOcrSearchResult = (value: unknown): boolean => localOcrExact(value, [
  'schemaVersion', 'matches', 'truncated', 'policyFiltered', 'encryptedIndexAtRest', 'snippetsMasked',
  'queryEchoed', 'networkUsed', 'cloudUsed', 'generatedAt'
]) && value.schemaVersion === 1 && Array.isArray(value.matches) && value.matches.length <= 25
  && value.matches.every((match) => localOcrExact(match, [
    'jobId', 'revision', 'snippet', 'snippetMasked', 'matchedTokenCount', 'pageNumber', 'corrected', 'networkUsed', 'cloudUsed'
  ]) && localOcrId(match.jobId) && localOcrRevision(match.revision)
    && typeof match.snippet === 'string' && match.snippet.length >= 1 && match.snippet.length <= 240
    && match.snippetMasked === true && localOcrBoundedInteger(match.matchedTokenCount, 1, 8)
    && (match.pageNumber === null || localOcrBoundedInteger(match.pageNumber, 1, 50))
    && typeof match.corrected === 'boolean' && match.networkUsed === false && match.cloudUsed === false)
  && new Set(value.matches.map((match) => isObject(match) ? match.jobId : undefined)).size === value.matches.length
  && typeof value.truncated === 'boolean' && value.policyFiltered === true && value.encryptedIndexAtRest === true
  && value.snippetsMasked === true && value.queryEchoed === false && value.networkUsed === false
  && value.cloudUsed === false && localOcrIso(value.generatedAt);

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
      : channel === LOCAL_GOVERNED_OCR_IPC_CHANNELS.search
        ? localOcrSearchResult(result)
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
  if (channel === 'app:getInfo') {
    return appInfoResult(result) ? accepted() : rejected('APP_INFO_RESULT_INVALID', '$result');
  }
  if (channel === 'app:getLocalizationBootstrap' || channel === 'app:setLanguagePreference') {
    return appLocalizationResult(result) ? accepted() : rejected('APP_LOCALIZATION_RESULT_INVALID', '$result');
  }
  if (channel.startsWith('app:')) return rejected('UNKNOWN_IPC_CHANNEL', '$result');
  if (channel === UNIFIED_AUTHORIZED_SEARCH_IPC_CHANNEL) return unifiedAuthorizedSearchResult(result);
  if (familyAiAssistantChannels.has(channel)) return familyAiResult(channel,result);
  if (channel.startsWith('familyAiAssistant:')) return rejected('UNKNOWN_IPC_CHANNEL','$result');
  if (memoryStudioChannels.has(channel)) return memoryStudioResult(channel,result);
  if (channel.startsWith('memoryStudio:')) return rejected('UNKNOWN_IPC_CHANNEL','$result');
  if (smartHomeEnergyChannels.has(channel)) return smartHomeResult(channel,result);
  if (channel.startsWith('smartHomeEnergy:')) return rejected('UNKNOWN_IPC_CHANNEL','$result');
  if (signedPluginPlatformChannels.has(channel)) return signedPluginResult(channel,result);
  if (channel.startsWith('signedPluginPlatform:')) return rejected('UNKNOWN_IPC_CHANNEL','$result');
  if (communicationSecurityChannels.has(channel)) return communicationResult(channel,result);
  if (channel.startsWith('communicationSecurity:')) return rejected('UNKNOWN_IPC_CHANNEL','$result');
  if (communicationMessagingChannels.has(channel)) return communicationMessagingResult(channel,result);
  if (channel.startsWith('communicationMessaging:')) return rejected('UNKNOWN_IPC_CHANNEL','$result');
  if (communicationFileSharingChannels.has(channel)) return communicationFileSharingResult(channel,result);
  if (channel.startsWith('communicationFileSharing:')) return rejected('UNKNOWN_IPC_CHANNEL','$result');
  if (communicationAuditArchiveChannels.has(channel)) return communicationAuditArchiveResult(channel,result);
  if (channel.startsWith('communicationAuditArchive:')) return rejected('UNKNOWN_IPC_CHANNEL','$result');
  if (communicationCallingChannels.has(channel)) return communicationCallingResult(channel,result);
  if (channel.startsWith('communicationCalling:')) return rejected('UNKNOWN_IPC_CHANNEL','$result');
  if (communicationRecordingChannels.has(channel)) return communicationRecordingResult(channel,result);
  if (channel.startsWith('communicationRecording:')) return rejected('UNKNOWN_IPC_CHANNEL','$result');
  if (localTranslationChannels.has(channel)) return localTranslationResult(channel,result);
  if (channel.startsWith('localTranslation:')) return rejected('UNKNOWN_IPC_CHANNEL','$result');
  if (familyMeetingChannels.has(channel)) return familyMeetingResult(channel,result);
  if (channel.startsWith('familyMeeting:')) return rejected('UNKNOWN_IPC_CHANNEL','$result');
  if (childEducationChannels.has(channel)) return childEducationResult(channel, result);
  if (channel.startsWith('childEducation:')) return rejected('UNKNOWN_IPC_CHANNEL', '$result');
  if (placesTravelChannels.has(channel)) return placesTravelResult(channel, result);
  if (channel.startsWith('placesTravel:')) return rejected('UNKNOWN_IPC_CHANNEL', '$result');
  if (householdOperationsChannels.has(channel)) return householdResult(channel, result);
  if (channel.startsWith('householdOperations:')) return rejected('UNKNOWN_IPC_CHANNEL', '$result');
  if (healthCareCoordinationChannels.has(channel)) return healthCareResult(channel, result);
  if (channel.startsWith('healthCare:')) return rejected('UNKNOWN_IPC_CHANNEL', '$result');
  if (archiveEvidenceMediaChannels.has(channel)) return archiveEvidenceMediaResult(channel, result);
  if (channel.startsWith('archive:') && (channel.includes('RelationEvidence') || channel === 'archive:addVersion')) return rejected('UNKNOWN_IPC_CHANNEL', '$result');
  if (channel === 'archive:reattestLegacyOwnership') {
    return exactNested(result, ['itemId', 'ownershipBinding', 'reattestedAt'])
      && boundedString(result.itemId, 256)
      && result.ownershipBinding === 'verified_actor'
      && privacyIso(result.reattestedAt)
      ? accepted()
      : rejected('ARCHIVE_OWNERSHIP_REATTESTATION_RESULT_INVALID', '$result');
  }
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
  if (channel === 'app:getInfo' || channel === 'app:getLocalizationBootstrap') return zeroArguments(args);
  if (channel === 'app:setLanguagePreference') {
    return args.length === 1 && (args[0] === 'system' || args[0] === 'tr' || args[0] === 'en')
      ? accepted()
      : rejected('APP_LANGUAGE_PREFERENCE_INVALID', '$[0]');
  }
  if (channel.startsWith('app:')) return rejected('UNKNOWN_IPC_CHANNEL', '$');
  if (channel === UNIFIED_AUTHORIZED_SEARCH_IPC_CHANNEL) return unifiedAuthorizedSearchInput(args);
  if (familyAiAssistantChannels.has(channel)) return familyAiInput(channel,args);
  if (channel.startsWith('familyAiAssistant:')) return rejected('UNKNOWN_IPC_CHANNEL','$');
  if (memoryStudioChannels.has(channel)) return memoryStudioInput(channel,args);
  if (channel.startsWith('memoryStudio:')) return rejected('UNKNOWN_IPC_CHANNEL','$');
  if (smartHomeEnergyChannels.has(channel)) return smartHomeInput(channel,args);
  if (channel.startsWith('smartHomeEnergy:')) return rejected('UNKNOWN_IPC_CHANNEL','$');
  if (signedPluginPlatformChannels.has(channel)) return signedPluginInput(channel,args);
  if (channel.startsWith('signedPluginPlatform:')) return rejected('UNKNOWN_IPC_CHANNEL','$');
  if (communicationSecurityChannels.has(channel)) return communicationInput(channel,args);
  if (channel.startsWith('communicationSecurity:')) return rejected('UNKNOWN_IPC_CHANNEL','$');
  if (communicationMessagingChannels.has(channel)) return communicationMessagingInput(channel,args);
  if (channel.startsWith('communicationMessaging:')) return rejected('UNKNOWN_IPC_CHANNEL','$');
  if (communicationFileSharingChannels.has(channel)) return communicationFileSharingInput(channel,args);
  if (channel.startsWith('communicationFileSharing:')) return rejected('UNKNOWN_IPC_CHANNEL','$');
  if (communicationAuditArchiveChannels.has(channel)) return communicationAuditArchiveInput(channel,args);
  if (channel.startsWith('communicationAuditArchive:')) return rejected('UNKNOWN_IPC_CHANNEL','$');
  if (communicationCallingChannels.has(channel)) return communicationCallingInput(channel,args);
  if (channel.startsWith('communicationCalling:')) return rejected('UNKNOWN_IPC_CHANNEL','$');
  if (communicationRecordingChannels.has(channel)) return communicationRecordingInput(channel,args);
  if (channel.startsWith('communicationRecording:')) return rejected('UNKNOWN_IPC_CHANNEL','$');
  if (localTranslationChannels.has(channel)) return localTranslationInput(channel,args);
  if (channel.startsWith('localTranslation:')) return rejected('UNKNOWN_IPC_CHANNEL','$');
  if (familyMeetingChannels.has(channel)) return familyMeetingInput(channel,args);
  if (channel.startsWith('familyMeeting:')) return rejected('UNKNOWN_IPC_CHANNEL','$');
  if (childEducationChannels.has(channel)) return childEducationInput(channel, args);
  if (channel.startsWith('childEducation:')) return rejected('UNKNOWN_IPC_CHANNEL', '$');
  if (placesTravelChannels.has(channel)) return placesTravelInput(channel, args);
  if (channel.startsWith('placesTravel:')) return rejected('UNKNOWN_IPC_CHANNEL', '$');
  if (householdOperationsChannels.has(channel)) return householdInput(channel, args);
  if (channel.startsWith('householdOperations:')) return rejected('UNKNOWN_IPC_CHANNEL', '$');
  if (healthCareCoordinationChannels.has(channel)) return healthCareInput(channel, args);
  if (channel.startsWith('healthCare:')) return rejected('UNKNOWN_IPC_CHANNEL', '$');
  if (archiveEvidenceMediaChannels.has(channel)) return archiveEvidenceMediaInput(channel, args);
  if (channel.startsWith('archive:') && (channel.includes('RelationEvidence') || channel === 'archive:addVersion')) return rejected('UNKNOWN_IPC_CHANNEL', '$');
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
    case 'archive:reattestLegacyOwnership':
      return exactObject(args, ['itemId', 'password', 'code', 'confirmation'], (value) =>
        boundedString(value.itemId, 256)
        && boundedString(value.password, 1024)
        && (value.code === undefined || (typeof value.code === 'string' && /^\d{6,10}$/u.test(value.code)))
        && typeof value.confirmation === 'string'
        && value.confirmation === archiveLegacyOwnershipReattestationConfirmation(value.itemId as string));
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
