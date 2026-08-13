export type TextScale = 'standard' | 'large' | 'extra-large';
export type AccessibilityThemePreference = 'system' | 'light' | 'dark';
export type AccessibilityDensity = 'comfortable' | 'standard' | 'compact';
export type AccessibilityReadingMode = 'standard' | 'easy-read';
export type AccessibilityAudienceProfile = 'youth' | 'standard' | 'senior' | 'low-vision' | 'caregiver';

export interface AccessibilityPreferences {
  textScale: TextScale;
  textScalePercent: number;
  highContrast: boolean;
  reduceMotion: boolean;
  theme: AccessibilityThemePreference;
  density: AccessibilityDensity;
  readingMode: AccessibilityReadingMode;
  audienceProfile: AccessibilityAudienceProfile;
  captionsEnabled: boolean;
  audioMuted: boolean;
}

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = Object.freeze({
  textScale: 'standard',
  textScalePercent: 100,
  highContrast: false,
  reduceMotion: false,
  theme: 'system',
  density: 'standard',
  readingMode: 'standard',
  audienceProfile: 'standard',
  captionsEnabled: true,
  audioMuted: false
});

export const ACCESSIBILITY_PROFILE_PRESETS: Readonly<Record<AccessibilityAudienceProfile, AccessibilityPreferences>> = Object.freeze({
  youth: Object.freeze({
    ...DEFAULT_ACCESSIBILITY_PREFERENCES,
    audienceProfile: 'youth',
    textScalePercent: 110
  }),
  standard: DEFAULT_ACCESSIBILITY_PREFERENCES,
  senior: Object.freeze({
    ...DEFAULT_ACCESSIBILITY_PREFERENCES,
    audienceProfile: 'senior',
    textScale: 'large',
    textScalePercent: 150,
    density: 'comfortable',
    readingMode: 'easy-read'
  }),
  'low-vision': Object.freeze({
    ...DEFAULT_ACCESSIBILITY_PREFERENCES,
    audienceProfile: 'low-vision',
    textScale: 'extra-large',
    textScalePercent: 200,
    highContrast: true,
    density: 'comfortable',
    readingMode: 'easy-read'
  }),
  caregiver: Object.freeze({
    ...DEFAULT_ACCESSIBILITY_PREFERENCES,
    audienceProfile: 'caregiver',
    textScale: 'large',
    textScalePercent: 125,
    density: 'comfortable'
  })
});

const isTextScale = (value: unknown): value is TextScale =>
  value === 'standard' || value === 'large' || value === 'extra-large';
const isTheme = (value: unknown): value is AccessibilityThemePreference =>
  value === 'system' || value === 'light' || value === 'dark';
const isDensity = (value: unknown): value is AccessibilityDensity =>
  value === 'comfortable' || value === 'standard' || value === 'compact';
const isReadingMode = (value: unknown): value is AccessibilityReadingMode =>
  value === 'standard' || value === 'easy-read';
const isAudienceProfile = (value: unknown): value is AccessibilityAudienceProfile =>
  value === 'youth' || value === 'standard' || value === 'senior' || value === 'low-vision' || value === 'caregiver';
const isScalePercent = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 225;

export const applyAccessibilityProfile = (
  profile: AccessibilityAudienceProfile,
  system: Pick<AccessibilityPreferences, 'highContrast' | 'reduceMotion'> = {
    highContrast: false,
    reduceMotion: false
  }
): AccessibilityPreferences => {
  const preset = ACCESSIBILITY_PROFILE_PRESETS[profile];
  return profile === 'standard' || profile === 'youth' || profile === 'caregiver'
    ? { ...preset, highContrast: system.highContrast, reduceMotion: system.reduceMotion }
    : { ...preset, reduceMotion: preset.reduceMotion || system.reduceMotion };
};

export const parseAccessibilityPreferences = (
  raw: string | null,
  system: Pick<AccessibilityPreferences, 'highContrast' | 'reduceMotion'> = {
    highContrast: false,
    reduceMotion: false
  }
): AccessibilityPreferences => {
  if (!raw) return applyAccessibilityProfile('standard', system);
  try {
    const parsed = JSON.parse(raw) as Partial<AccessibilityPreferences>;
    return {
      textScale: isTextScale(parsed.textScale) ? parsed.textScale : 'standard',
      textScalePercent: isScalePercent(parsed.textScalePercent) ? parsed.textScalePercent : 100,
      highContrast: typeof parsed.highContrast === 'boolean' ? parsed.highContrast : system.highContrast,
      reduceMotion: typeof parsed.reduceMotion === 'boolean' ? parsed.reduceMotion : system.reduceMotion,
      theme: isTheme(parsed.theme) ? parsed.theme : 'system',
      density: isDensity(parsed.density) ? parsed.density : 'standard',
      readingMode: isReadingMode(parsed.readingMode) ? parsed.readingMode : 'standard',
      audienceProfile: isAudienceProfile(parsed.audienceProfile) ? parsed.audienceProfile : 'standard',
      captionsEnabled: typeof parsed.captionsEnabled === 'boolean' ? parsed.captionsEnabled : true,
      audioMuted: typeof parsed.audioMuted === 'boolean' ? parsed.audioMuted : false
    };
  } catch {
    return applyAccessibilityProfile('standard', system);
  }
};

export const serializeAccessibilityPreferences = (preferences: AccessibilityPreferences): string =>
  JSON.stringify(preferences);

export const resolveAccessibilityTheme = (
  preference: AccessibilityThemePreference,
  systemDark: boolean
): 'dark' | 'light' => preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

export type RovingKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End';

export const nextRovingIndex = (current: number, itemCount: number, key: RovingKey): number => {
  if (itemCount <= 0) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return itemCount - 1;
  const safeCurrent = current < 0 || current >= itemCount ? 0 : current;
  return key === 'ArrowDown'
    ? (safeCurrent + 1) % itemCount
    : (safeCurrent - 1 + itemCount) % itemCount;
};

export const accessibilityAnnouncement = (screenLabel: string): string =>
  `${screenLabel} bölümü açıldı.`;
