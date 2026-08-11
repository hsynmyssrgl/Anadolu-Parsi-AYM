export type TextScale = 'standard' | 'large' | 'extra-large';

export interface AccessibilityPreferences {
  textScale: TextScale;
  highContrast: boolean;
  reduceMotion: boolean;
}

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  textScale: 'standard',
  highContrast: false,
  reduceMotion: false
};

const isTextScale = (value: unknown): value is TextScale =>
  value === 'standard' || value === 'large' || value === 'extra-large';

export const parseAccessibilityPreferences = (
  raw: string | null,
  system: Pick<AccessibilityPreferences, 'highContrast' | 'reduceMotion'> = {
    highContrast: false,
    reduceMotion: false
  }
): AccessibilityPreferences => {
  if (!raw) {
    return {
      ...DEFAULT_ACCESSIBILITY_PREFERENCES,
      highContrast: system.highContrast,
      reduceMotion: system.reduceMotion
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AccessibilityPreferences>;
    return {
      textScale: isTextScale(parsed.textScale) ? parsed.textScale : 'standard',
      highContrast: typeof parsed.highContrast === 'boolean' ? parsed.highContrast : system.highContrast,
      reduceMotion: typeof parsed.reduceMotion === 'boolean' ? parsed.reduceMotion : system.reduceMotion
    };
  } catch {
    return {
      ...DEFAULT_ACCESSIBILITY_PREFERENCES,
      highContrast: system.highContrast,
      reduceMotion: system.reduceMotion
    };
  }
};

export const serializeAccessibilityPreferences = (preferences: AccessibilityPreferences): string =>
  JSON.stringify(preferences);

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
