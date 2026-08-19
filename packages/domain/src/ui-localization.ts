export const SUPPORTED_UI_LANGUAGES = Object.freeze(['tr', 'en'] as const);
export type SupportedUiLanguage = (typeof SUPPORTED_UI_LANGUAGES)[number];
export type SupportedUiLocale = 'tr-TR' | 'en-US';
export type UiLanguagePreference = 'system' | SupportedUiLanguage;

export interface UiLocalizationBootstrapView {
  readonly source: 'system' | 'user';
  readonly preference: UiLanguagePreference;
  readonly systemLocale: string;
  readonly language: SupportedUiLanguage;
  readonly locale: SupportedUiLocale;
  readonly fallbackUsed: boolean;
  readonly supportedLanguages: typeof SUPPORTED_UI_LANGUAGES;
}

const normalizeSystemLocale = (value: string | undefined): string =>
  (value ?? '').trim().replaceAll('_', '-');

export const resolveUiLocalization = (
  systemLocale: string | undefined,
  preference: UiLanguagePreference = 'system'
): Readonly<UiLocalizationBootstrapView> => {
  const normalized = normalizeSystemLocale(systemLocale);
  const primaryLanguage = normalized.split('-')[0]?.toLocaleLowerCase('en-US') ?? '';
  const language: SupportedUiLanguage = preference === 'system'
    ? primaryLanguage === 'tr' ? 'tr' : 'en'
    : preference;
  const locale: SupportedUiLocale = language === 'tr' ? 'tr-TR' : 'en-US';

  return Object.freeze({
    source: preference === 'system' ? 'system' : 'user',
    preference,
    systemLocale: normalized || 'unknown',
    language,
    locale,
    fallbackUsed: preference === 'system' && primaryLanguage !== 'tr' && primaryLanguage !== 'en',
    supportedLanguages: SUPPORTED_UI_LANGUAGES
  });
};

export const DEFAULT_UI_LOCALIZATION = resolveUiLocalization('en-US');
