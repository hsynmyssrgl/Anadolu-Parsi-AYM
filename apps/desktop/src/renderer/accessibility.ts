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

export const FIRST_RUN_INTRO_STORAGE_KEY = 'ppt-first-run-intro-v1';
export const BRAND_AUDIO_DISABLED_STORAGE_KEY = 'ppt-brand-audio-disabled-v1';
export const FIRST_RUN_NARRATION_STEPS = Object.freeze([
  'Birinci adım: Bu bilgisayardaki yerel aile alanınızı oluşturun.',
  'İkinci adım: Güçlü parolanızı belirleyin ve kurtarma kodlarınızı uygulamanın dışında güvenli bir yerde saklayın.',
  'Üçüncü adım: Yazı boyutu, kontrast, hareket ve ses tercihlerinizi seçin.'
]);
export const FIRST_RUN_NARRATION_TEXT = `ParsYuva Aile Yaşam Merkezi'ne hoş geldiniz. Bu kısa tanıtımda üç adımı birlikte tamamlayacağız. ${FIRST_RUN_NARRATION_STEPS.join(' ')} Kişisel verileriniz siz giriş yapmadan açılmaz. Kurulum sırasında aile veriniz uzak bir sağlayıcıya gönderilmez.`;
export const FIRST_RUN_NARRATION_STEPS_EN = Object.freeze([
  'Step one: Create the local family space on this computer.',
  'Step two: Set a strong password and keep your recovery codes in a safe place outside the application.',
  'Step three: Choose your text size, contrast, motion and audio preferences.'
]);
export const FIRST_RUN_NARRATION_TEXT_EN = `Welcome to ParsYuva Family Life Center. We will complete three steps together in this short introduction. ${FIRST_RUN_NARRATION_STEPS_EN.join(' ')} Your personal data does not open before you sign in. Family data is not sent to a remote provider during setup.`;

export const firstRunNarrationContent = (language: 'tr' | 'en') => language === 'tr'
  ? { steps:FIRST_RUN_NARRATION_STEPS, text:FIRST_RUN_NARRATION_TEXT, locale:'tr-TR' as const }
  : { steps:FIRST_RUN_NARRATION_STEPS_EN, text:FIRST_RUN_NARRATION_TEXT_EN, locale:'en-US' as const };

export interface BootstrapPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type FirstRunNarrationStatus = 'idle' | 'muted' | 'speaking' | 'ready' | 'unavailable' | 'error';

export interface FirstRunNarrationUtterance {
  lang: string;
  rate: number;
  pitch: number;
}

export interface FirstRunNarrationSynthesis<TUtterance extends FirstRunNarrationUtterance> {
  cancel(): void;
  speak(utterance: TUtterance): void;
}

export const readBootstrapPreference = (
  storage: BootstrapPreferenceStorage | undefined,
  key: string
): string | null => {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

export const writeBootstrapPreference = (
  storage: BootstrapPreferenceStorage | undefined,
  key: string,
  value: string
): boolean => {
  try {
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const isFirstRunIntroductionComplete = (storage: BootstrapPreferenceStorage | undefined): boolean =>
  readBootstrapPreference(storage, FIRST_RUN_INTRO_STORAGE_KEY) === '1';

export const persistFirstRunIntroductionComplete = (storage: BootstrapPreferenceStorage | undefined): boolean =>
  writeBootstrapPreference(storage, FIRST_RUN_INTRO_STORAGE_KEY, '1');

export const readBrandAudioMuted = (
  storage: BootstrapPreferenceStorage | undefined,
  fallback = false
): boolean => {
  const value = readBootstrapPreference(storage, BRAND_AUDIO_DISABLED_STORAGE_KEY);
  return value === null ? fallback : value === '1';
};

export const persistBrandAudioMuted = (
  storage: BootstrapPreferenceStorage | undefined,
  muted: boolean
): boolean => writeBootstrapPreference(storage, BRAND_AUDIO_DISABLED_STORAGE_KEY, muted ? '1' : '0');

export const cancelFirstRunNarration = (
  synthesis: Pick<FirstRunNarrationSynthesis<FirstRunNarrationUtterance>, 'cancel'> | undefined
): boolean => {
  try {
    if (!synthesis) return false;
    synthesis.cancel();
    return true;
  } catch {
    return false;
  }
};

export const startFirstRunNarration = <TUtterance extends FirstRunNarrationUtterance>(input: {
  muted: boolean;
  language?: 'tr' | 'en';
  rate?: 'normal' | 'slow';
  synthesis: FirstRunNarrationSynthesis<TUtterance> | undefined;
  createUtterance: ((text: string) => TUtterance) | undefined;
  onStatus: (status: FirstRunNarrationStatus) => void;
}): FirstRunNarrationStatus => {
  if (input.muted) {
    input.onStatus('muted');
    return 'muted';
  }
  if (!input.synthesis || !input.createUtterance) {
    input.onStatus('unavailable');
    return 'unavailable';
  }
  try {
    const narration = firstRunNarrationContent(input.language ?? 'tr');
    input.synthesis.cancel();
    const utterance = input.createUtterance(narration.text);
    utterance.lang = narration.locale;
    utterance.rate = input.rate === 'slow' ? 0.72 : 0.88;
    utterance.pitch = 0.95;
    Object.assign(utterance, {
      onstart:() => input.onStatus('speaking'),
      onend:() => input.onStatus('ready'),
      onerror:() => input.onStatus('error')
    });
    input.onStatus('speaking');
    input.synthesis.speak(utterance);
    return 'speaking';
  } catch {
    input.onStatus('error');
    return 'error';
  }
};

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
