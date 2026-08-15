import type { IsoDateTime } from '@ppt/core';

export type LocalTranslationSourceKind = 'message' | 'live_caption' | 'document' | 'meeting_summary';
export type LocalTranslationDictionaryCategory = 'family_name' | 'nickname' | 'place' | 'medical_term';
export type LocalTranslationProviderMode = 'local_offline' | 'external_preview';
export type LocalTranslationRequestState = 'provider_unavailable' | 'correction_recorded' | 'cancelled';
export type LocalTranslationQualityFlag = 'not_evaluated' | 'ambiguous' | 'low_confidence' | 'possible_error';

export interface LocalTranslationProfileView {
  readonly id: string;
  readonly preferredLanguage: string;
  readonly secondaryLanguages: readonly string[];
  readonly localFirstRequired: true;
  readonly liveCaptionTranslationEnabled: boolean;
  readonly translatedSpeechEnabled: boolean;
  readonly preserveOriginalAudio: true;
  readonly externalProviderAllowed: boolean;
  readonly externalPreviewRequired: true;
  readonly externalConsentRequired: true;
  readonly encryptedSyncRequested: boolean;
  readonly encryptedSyncExecuted: false;
  readonly revision: number;
  readonly updatedAt: IsoDateTime;
}

export interface LocalTranslationDictionaryEntryView {
  readonly id: string;
  readonly category: LocalTranslationDictionaryCategory;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly sourceTerm: string;
  readonly preferredTerm: string;
  readonly explicitPermissionRecorded: true;
  readonly enabled: boolean;
  readonly revision: number;
  readonly updatedAt: IsoDateTime;
}

export interface LocalTranslationRequestView {
  readonly id: string;
  readonly sourceKind: LocalTranslationSourceKind;
  readonly sourceResourceId: string;
  readonly targetLanguage: string;
  readonly providerMode: LocalTranslationProviderMode;
  readonly state: LocalTranslationRequestState;
  readonly originalPreservationRequired: true;
  readonly separateTranslationViewRequired: true;
  readonly machineTranslationLabelRequired: true;
  readonly qualityFlag: LocalTranslationQualityFlag;
  readonly externalPreviewAcknowledged: boolean;
  readonly explicitExternalConsent: boolean;
  readonly correctionRecorded: boolean;
  readonly correctionSha256?: string;
  readonly correctionCharacterCount?: number;
  readonly languageDetectionExecuted: false;
  readonly translationExecuted: false;
  readonly speechToTextExecuted: false;
  readonly speakerSeparationExecuted: false;
  readonly liveCaptionTranslationExecuted: false;
  readonly textToSpeechExecuted: false;
  readonly networkUsed: false;
  readonly cloudUsed: false;
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface LocalTranslationTruthView {
  readonly commonTranslationProviderPortModeled: true;
  readonly localFirstPolicyModeled: true;
  readonly originalPreservationContractModeled: true;
  readonly separateMachineTranslationLabelModeled: true;
  readonly personalDictionaryModeled: true;
  readonly explicitCorrectionPermissionModeled: true;
  readonly externalPreviewAndConsentModeled: true;
  readonly rendererProviderAuthority: false;
  readonly productionTranslationProviderConfigured: false;
  readonly localLanguagePackInstalled: false;
  readonly languageDetectionExecuted: false;
  readonly translationExecuted: false;
  readonly speechToTextExecuted: false;
  readonly speakerSeparationExecuted: false;
  readonly liveCaptionTranslationExecuted: false;
  readonly textToSpeechExecuted: false;
  readonly originalAudioMuted: false;
  readonly externalProviderConfigured: false;
  readonly externalProviderPreviewDelivered: false;
  readonly encryptedCrossDevicePreferenceSyncExecuted: false;
  readonly networkUsedByCurrentImplementation: false;
}

export interface LocalTranslationCenterView {
  readonly schemaVersion: 1;
  readonly centerId: string;
  readonly ownerPersonId: string;
  readonly profile: LocalTranslationProfileView;
  readonly dictionary: readonly LocalTranslationDictionaryEntryView[];
  readonly requests: readonly LocalTranslationRequestView[];
  readonly truth: LocalTranslationTruthView;
  readonly generatedAt: IsoDateTime;
}

export interface UpdateLocalTranslationProfileInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly preferredLanguage: string;
  readonly secondaryLanguages: readonly string[];
  readonly liveCaptionTranslationEnabled: boolean;
  readonly translatedSpeechEnabled: boolean;
  readonly preserveOriginalAudio: true;
  readonly externalProviderAllowed: boolean;
  readonly encryptedSyncRequested: boolean;
}

export interface AddLocalTranslationDictionaryEntryInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly category: LocalTranslationDictionaryCategory;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly sourceTerm: string;
  readonly preferredTerm: string;
  readonly explicitPermission: true;
}

export interface UpdateLocalTranslationDictionaryEntryInput extends AddLocalTranslationDictionaryEntryInput {
  readonly entryId: string;
}

export interface DeleteLocalTranslationDictionaryEntryInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly entryId: string;
  readonly reason: string;
}

export interface PrepareLocalTranslationRequestInput {
  readonly clientOperationId: string;
  readonly expectedRevision: 0;
  readonly sourceKind: LocalTranslationSourceKind;
  readonly sourceResourceId: string;
  readonly targetLanguage: string;
  readonly providerMode: LocalTranslationProviderMode;
  readonly externalPreviewAcknowledged: boolean;
  readonly explicitExternalConsent: boolean;
}

export interface RecordLocalTranslationCorrectionInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly requestId: string;
  readonly correctedText: string;
  readonly explicitPermission: true;
}

export interface CancelLocalTranslationRequestInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly requestId: string;
  readonly reason: string;
}

export type LocalTranslationMutationKind =
  | 'profile_update'
  | 'dictionary_add'
  | 'dictionary_update'
  | 'dictionary_delete'
  | 'request_prepare'
  | 'correction_record'
  | 'request_cancel';

export type LocalTranslationResourceType = 'local_translation_profile' | 'local_translation_request';

export interface LocalTranslationMutationReceiptView {
  readonly resourceType: LocalTranslationResourceType;
  readonly resourceId: string;
  readonly mutationKind: LocalTranslationMutationKind;
  readonly previousRevision: number;
  readonly revision: number;
  readonly occurredAt: IsoDateTime;
  readonly replayed: boolean;
  readonly providerConfigured: false;
  readonly translationExecuted: false;
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export const localTranslationCenterId = (familyId: string, ownerPersonId: string): string =>
  `local-translation:${familyId}:${ownerPersonId}`;

export const localTranslationProfileId = (familyId: string, ownerPersonId: string): string =>
  `local-translation-profile:${familyId}:${ownerPersonId}`;

export const localTranslationTruth = Object.freeze({
  commonTranslationProviderPortModeled: true as const,
  localFirstPolicyModeled: true as const,
  originalPreservationContractModeled: true as const,
  separateMachineTranslationLabelModeled: true as const,
  personalDictionaryModeled: true as const,
  explicitCorrectionPermissionModeled: true as const,
  externalPreviewAndConsentModeled: true as const,
  rendererProviderAuthority: false as const,
  productionTranslationProviderConfigured: false as const,
  localLanguagePackInstalled: false as const,
  languageDetectionExecuted: false as const,
  translationExecuted: false as const,
  speechToTextExecuted: false as const,
  speakerSeparationExecuted: false as const,
  liveCaptionTranslationExecuted: false as const,
  textToSpeechExecuted: false as const,
  originalAudioMuted: false as const,
  externalProviderConfigured: false as const,
  externalProviderPreviewDelivered: false as const,
  encryptedCrossDevicePreferenceSyncExecuted: false as const,
  networkUsedByCurrentImplementation: false as const
});
