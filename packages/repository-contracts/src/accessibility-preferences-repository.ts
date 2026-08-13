import type { FamilyId, IsoDateTime, PersonId, UserId } from '@ppt/core';
import type {
  AccessibilityPreferencesView,
  AudienceProfile,
  ReadingMode,
  TextScale,
  ThemePreference,
  ViewDensity
} from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface AccessibilityPreferencesMutationRow {
  readonly id: string;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly familyId: FamilyId;
  readonly accountId: UserId;
  readonly ownerPersonId: PersonId;
  readonly previousRevision: number;
  readonly revision: number;
  readonly textScale: TextScale;
  readonly textScalePercent: number;
  readonly highContrast: boolean;
  readonly reduceMotion: boolean;
  readonly theme: ThemePreference;
  readonly density: ViewDensity;
  readonly readingMode: ReadingMode;
  readonly audienceProfile: AudienceProfile;
  readonly captionsEnabled: boolean;
  readonly audioMuted: boolean;
  readonly createdAt: IsoDateTime;
}

export interface AccessibilityPreferencesRow extends AccessibilityPreferencesView {
  readonly accountId: UserId;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly lastMutationId: string;
}

export interface AccessibilityPreferencesRepositoryPort {
  find(
    context: PolicyAuthorizedRepositoryExecutionContext,
    accountId: UserId
  ): RepositoryResult<AccessibilityPreferencesRow | null>;
  findForPolicyResolution(
    context: RepositoryExecutionContext,
    accountId: UserId
  ): RepositoryResult<AccessibilityPreferencesRow | null>;
  findMutationByClientOperationId(
    context: PolicyAuthorizedRepositoryExecutionContext,
    accountId: UserId,
    clientOperationId: string
  ): RepositoryResult<AccessibilityPreferencesMutationRow | null>;
  insertMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: AccessibilityPreferencesMutationRow
  ): RepositoryResult<void>;
  saveCurrent(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: AccessibilityPreferencesRow,
    expectedRevision: number
  ): RepositoryResult<boolean>;
}
