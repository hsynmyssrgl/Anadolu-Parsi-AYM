export type TextScale = 'standard' | 'large' | 'extra-large';

export type ThemePreference = 'system' | 'light' | 'dark';

export type ViewDensity = 'comfortable' | 'standard' | 'compact';

export type ReadingMode = 'standard' | 'easy-read';

export type AudienceProfile =
  | 'youth'
  | 'standard'
  | 'senior'
  | 'low-vision'
  | 'caregiver';

export interface AccessibilityPreferencesView {
  readonly accountId: string;
  readonly familyId: string;
  readonly ownerPersonId: string;
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
  readonly updatedAt: string;
}

export interface UpdateAccessibilityPreferencesInput {
  readonly expectedRevision: number;
  readonly clientOperationId: string;
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
}

export interface CreateDefaultAccessibilityPreferencesInput {
  readonly accountId: string;
  readonly familyId: string;
  readonly ownerPersonId: string;
  readonly updatedAt: string;
}

const requireNonEmpty = (value: string, field: string): string => {
  if (value.length === 0 || value !== value.trim()) {
    throw new TypeError(`${field} must be a non-empty, trimmed string`);
  }
  return value;
};

export const createDefaultAccessibilityPreferences = (
  input: CreateDefaultAccessibilityPreferencesInput,
): AccessibilityPreferencesView => {
  const updatedAt = requireNonEmpty(input.updatedAt, 'updatedAt');
  if (!Number.isFinite(Date.parse(updatedAt))) {
    throw new TypeError('updatedAt must be an ISO date-time string');
  }

  return Object.freeze({
    accountId: requireNonEmpty(input.accountId, 'accountId'),
    familyId: requireNonEmpty(input.familyId, 'familyId'),
    ownerPersonId: requireNonEmpty(input.ownerPersonId, 'ownerPersonId'),
    revision: 0,
    textScale: 'standard',
    textScalePercent: 100,
    highContrast: false,
    reduceMotion: false,
    theme: 'system',
    density: 'standard',
    readingMode: 'standard',
    audienceProfile: 'standard',
    captionsEnabled: true,
    audioMuted: false,
    updatedAt,
  });
};
