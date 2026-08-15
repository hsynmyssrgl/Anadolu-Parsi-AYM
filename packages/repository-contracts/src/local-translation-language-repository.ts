import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type {
  LocalTranslationDictionaryCategory,
  LocalTranslationMutationKind,
  LocalTranslationProviderMode,
  LocalTranslationQualityFlag,
  LocalTranslationRequestState,
  LocalTranslationResourceType,
  LocalTranslationSourceKind
} from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface LocalTranslationCenterKey {
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly actorPersonId: PersonId;
  readonly ownerPersonId: PersonId;
  readonly centerId: string;
  readonly profileId: string;
}

export interface LocalTranslationProfileRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly preferredLanguage: string;
  readonly secondaryLanguages: readonly string[];
  readonly localFirstRequired: true;
  readonly liveCaptionTranslationEnabled: boolean;
  readonly translatedSpeechEnabled: boolean;
  readonly preserveOriginalAudio: true;
  readonly externalProviderAllowed: boolean;
  readonly encryptedSyncRequested: boolean;
  readonly encryptedSyncExecuted: false;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface LocalTranslationDictionaryEntryRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly profileId: string;
  readonly category: LocalTranslationDictionaryCategory;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly sourceTerm: string;
  readonly preferredTerm: string;
  readonly explicitPermissionRecorded: true;
  readonly state: 'active' | 'deleted';
  readonly revision: number;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface LocalTranslationRequestRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
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
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface LocalTranslationMutationRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly resourceType: LocalTranslationResourceType;
  readonly resourceId: string;
  readonly actorAccountId: string;
  readonly actorPersonId: PersonId;
  readonly mutationKind: LocalTranslationMutationKind;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly expectedRevision: number;
  readonly revision: number;
  readonly resourceStateFingerprint: string;
  readonly occurredAt: IsoDateTime;
}

export interface LocalTranslationEventRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly resourceType: LocalTranslationResourceType;
  readonly resourceId: string;
  readonly eventKind: LocalTranslationMutationKind;
  readonly resourceRevision: number;
  readonly stateFingerprint: string;
  readonly mutationId: string;
  readonly occurredAt: IsoDateTime;
}

export interface LocalTranslationCenterSnapshotRow {
  readonly profile: LocalTranslationProfileRow | null;
  readonly dictionary: readonly LocalTranslationDictionaryEntryRow[];
  readonly requests: readonly LocalTranslationRequestRow[];
}

export interface LocalTranslationLanguageRepositoryPort {
  loadCenter(context: PolicyAuthorizedRepositoryExecutionContext, key: LocalTranslationCenterKey): RepositoryResult<LocalTranslationCenterSnapshotRow>;
  findProfile(context: PolicyAuthorizedRepositoryExecutionContext, key: LocalTranslationCenterKey): RepositoryResult<LocalTranslationProfileRow | null>;
  findDictionaryEntry(context: PolicyAuthorizedRepositoryExecutionContext, key: LocalTranslationCenterKey, entryId: string): RepositoryResult<LocalTranslationDictionaryEntryRow | null>;
  findRequest(context: PolicyAuthorizedRepositoryExecutionContext, key: LocalTranslationCenterKey, requestId: string): RepositoryResult<LocalTranslationRequestRow | null>;
  findMutationByClientOperationId(context: PolicyAuthorizedRepositoryExecutionContext, key: LocalTranslationCenterKey, clientOperationId: string): RepositoryResult<LocalTranslationMutationRow | null>;
  insertMutation(context: PolicyAuthorizedRepositoryExecutionContext, row: LocalTranslationMutationRow): RepositoryResult<void>;
  insertProfile(context: PolicyAuthorizedRepositoryExecutionContext, row: LocalTranslationProfileRow): RepositoryResult<void>;
  saveProfile(context: PolicyAuthorizedRepositoryExecutionContext, row: LocalTranslationProfileRow, expectedRevision: number): RepositoryResult<void>;
  insertDictionaryEntry(context: PolicyAuthorizedRepositoryExecutionContext, row: LocalTranslationDictionaryEntryRow): RepositoryResult<void>;
  saveDictionaryEntry(context: PolicyAuthorizedRepositoryExecutionContext, row: LocalTranslationDictionaryEntryRow, expectedRevision: number): RepositoryResult<void>;
  insertRequest(context: PolicyAuthorizedRepositoryExecutionContext, row: LocalTranslationRequestRow): RepositoryResult<void>;
  saveRequest(context: PolicyAuthorizedRepositoryExecutionContext, row: LocalTranslationRequestRow, expectedRevision: number): RepositoryResult<void>;
  appendEvent(context: PolicyAuthorizedRepositoryExecutionContext, row: LocalTranslationEventRow): RepositoryResult<void>;
}

export interface LocalTranslationPolicyResourceResolution {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly revision: number;
  readonly status: string;
  readonly stateFingerprint: string;
}

export interface LocalTranslationPolicyResourceRepositoryPort {
  resolvePolicyResource(
    context: RepositoryExecutionContext,
    resourceType: LocalTranslationResourceType,
    resourceId: string
  ): RepositoryResult<LocalTranslationPolicyResourceResolution | null>;
}
