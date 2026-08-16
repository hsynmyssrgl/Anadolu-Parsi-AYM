import type { IsoDateTime } from '@ppt/core';

export const FAMILY_AI_ASSISTANT_KINDS = Object.freeze([
  'authorized_search',
  'daily_summary',
  'weekly_summary',
  'reminder_review',
  'emergency_bag',
  'meeting_agenda',
  'ocr_classification',
  'duplicate_record',
  'family_story',
  'spending_review',
  'meal_plan',
  'shopping_list',
  'plain_explanation',
  'read_aloud',
  'translation'
] as const);
export type FamilyAiAssistantKind = (typeof FAMILY_AI_ASSISTANT_KINDS)[number];

export const FAMILY_AI_ASSISTANT_MODULES = Object.freeze([
  'family','event','archive','finance','health','life','ocr','household','places'
] as const);
export type FamilyAiAssistantModule = (typeof FAMILY_AI_ASSISTANT_MODULES)[number];

export const FAMILY_AI_ASSISTANT_MAX_SUGGESTIONS = 500 as const;

const moduleSet=<T extends readonly FamilyAiAssistantModule[]>(...values:T):T=>Object.freeze(values) as T;

export const FAMILY_AI_ASSISTANT_MODULES_BY_KIND: Readonly<Record<FamilyAiAssistantKind,
  readonly FamilyAiAssistantModule[]>> = Object.freeze({
  authorized_search:moduleSet('family','event','archive','finance','health','life'),
  daily_summary:moduleSet('event','archive','finance','health','life','household','places'),
  weekly_summary:moduleSet('event','archive','finance','health','life','household','places'),
  reminder_review:moduleSet('event','archive','finance','health','life','household','places'),
  emergency_bag:moduleSet('life','household','places'),meeting_agenda:moduleSet('family','event'),
  ocr_classification:moduleSet('archive','ocr'),duplicate_record:moduleSet('archive','ocr'),
  family_story:moduleSet('family','event','archive','places'),spending_review:moduleSet('finance','household'),
  meal_plan:moduleSet('household'),shopping_list:moduleSet('household'),
  plain_explanation:moduleSet('archive','health','life'),read_aloud:moduleSet('archive'),translation:moduleSet('archive')
});

export type FamilyAiAssistantPurpose = 'search'|'summary'|'recommendation'|'classification';
export type FamilyAiSuggestionStatus = 'pending_confirmation'|'confirmed'|'dismissed';
export type FamilyAiSuggestionReviewDecision = 'confirm'|'dismiss';

export type FamilyAiAssistantSourceResourceType =
  | 'person'|'event'|'archive_item'|'finance_record'|'health_record'|'life_record'
  | 'local_ocr_job'|'household_operation_item'|'places_travel_item';

export const FAMILY_AI_ASSISTANT_RESOURCE_TYPE_BY_MODULE: Readonly<Record<FamilyAiAssistantModule,
  FamilyAiAssistantSourceResourceType>> = Object.freeze({
  family:'person',event:'event',archive:'archive_item',finance:'finance_record',health:'health_record',life:'life_record',
  ocr:'local_ocr_job',household:'household_operation_item',places:'places_travel_item'
});

export interface FamilyAiAssistantSourceReferenceView {
  readonly module: FamilyAiAssistantModule;
  readonly resourceType: FamilyAiAssistantSourceResourceType;
  readonly resourceId: string;
}

export interface FamilyAiSuggestionView {
  readonly id: string;
  readonly ownerPersonId: string;
  readonly kind: FamilyAiAssistantKind;
  readonly purpose: FamilyAiAssistantPurpose;
  readonly status: FamilyAiSuggestionStatus;
  readonly title: string;
  readonly explanation: string;
  readonly confidenceBasisPoints: number;
  readonly sources: readonly FamilyAiAssistantSourceReferenceView[];
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly confirmedAt?: IsoDateTime;
  readonly dismissedAt?: IsoDateTime;
}

/** Content-free handle that lets the owner dismiss a suggestion after consent revocation. */
export interface FamilyAiInactiveConsentSuggestionView {
  readonly id: string;
  readonly revision: number;
  readonly updatedAt: IsoDateTime;
}

export interface FamilyAiAssistantTruthView {
  readonly localFirst: true;
  readonly authorizedSearchAvailableWithoutProvider: true;
  readonly providerConfigured: false;
  readonly networkUsed: false;
  readonly cloudUsed: false;
  readonly modelInferencePerformed: false;
  readonly speechSynthesisPerformed: false;
  readonly translationPerformed: false;
  readonly ocrSuggestionAutomaticallyAccepted: false;
  readonly durableActionPerformed: 'not_performed';
  readonly humanConfirmationRequired: true;
  readonly confirmationExecutesDownstreamAction: false;
  readonly sourceConsentRevalidated: true;
  readonly explicitConsentRevocationOverridesBroaderGrant: true;
  readonly confidenceRepresentsSourceCoverageOnly: true;
  readonly medicalFinancialOrEmergencyDecisionProvided: false;
}

export interface FamilyAiAssistantCenterView {
  readonly schemaVersion: 1;
  readonly centerId: string;
  readonly ownerPersonId: string;
  readonly suggestions: readonly FamilyAiSuggestionView[];
  readonly inactiveConsentSuggestions: readonly FamilyAiInactiveConsentSuggestionView[];
  readonly hiddenAfterConsentRevocationCount: number;
  readonly suggestionCapacity: {
    readonly maximum: typeof FAMILY_AI_ASSISTANT_MAX_SUGGESTIONS;
    readonly used: number;
    readonly remaining: number;
    readonly limitReached: boolean;
  };
  readonly truth: FamilyAiAssistantTruthView;
  readonly generatedAt: IsoDateTime;
}

export interface GenerateFamilyAiSuggestionInput {
  readonly clientOperationId: string;
  readonly suggestionId: string;
  readonly kind: FamilyAiAssistantKind;
  readonly modules?: readonly FamilyAiAssistantModule[];
  readonly query?: string;
}

export interface ReviewFamilyAiSuggestionInput {
  readonly clientOperationId: string;
  readonly suggestionId: string;
  readonly expectedRevision: number;
  readonly decision: FamilyAiSuggestionReviewDecision;
}

export type FamilyAiSuggestionMutationKind = 'suggestion_generate'|'suggestion_confirm'|'suggestion_dismiss';

export interface FamilyAiSuggestionMutationReceiptView {
  readonly suggestionId: string;
  readonly mutationKind: FamilyAiSuggestionMutationKind;
  readonly previousRevision: number;
  readonly revision: number;
  readonly occurredAt: IsoDateTime;
  readonly replayed: boolean;
  readonly durableActionPerformed: 'not_performed';
  readonly humanConfirmationRecorded: boolean;
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export const familyAiAssistantPurposeForKind = (kind:FamilyAiAssistantKind):FamilyAiAssistantPurpose => {
  if (kind === 'authorized_search') return 'search';
  if (kind === 'daily_summary' || kind === 'weekly_summary' || kind === 'plain_explanation') return 'summary';
  if (kind === 'ocr_classification' || kind === 'duplicate_record') return 'classification';
  return 'recommendation';
};

export const familyAiAssistantCenterId = (familyId:string,ownerPersonId:string):string =>
  `family-ai-assistant:${familyId}:${ownerPersonId}`;

export const familyAiAssistantTruth = Object.freeze({
  localFirst:true as const,
  authorizedSearchAvailableWithoutProvider:true as const,
  providerConfigured:false as const,
  networkUsed:false as const,
  cloudUsed:false as const,
  modelInferencePerformed:false as const,
  speechSynthesisPerformed:false as const,
  translationPerformed:false as const,
  ocrSuggestionAutomaticallyAccepted:false as const,
  durableActionPerformed:'not_performed' as const,
  humanConfirmationRequired:true as const,
  confirmationExecutesDownstreamAction:false as const,
  sourceConsentRevalidated:true as const,
  explicitConsentRevocationOverridesBroaderGrant:true as const,
  confidenceRepresentsSourceCoverageOnly:true as const,
  medicalFinancialOrEmergencyDecisionProvided:false as const
});
