import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UI_LOCALIZATION,
  resolveUiLocalization
} from '../src/ui-localization.js';

describe('UI localization system-language boundary', () => {
  it.each([
    ['tr', 'tr', 'tr-TR'],
    ['tr-TR', 'tr', 'tr-TR'],
    ['tr_TR', 'tr', 'tr-TR'],
    ['en', 'en', 'en-US'],
    ['en-GB', 'en', 'en-US']
  ] as const)('resolves supported system locale %s', (systemLocale, language, locale) => {
    expect(resolveUiLocalization(systemLocale)).toMatchObject({
      systemLocale: systemLocale.replaceAll('_', '-'),
      language,
      locale,
      fallbackUsed: false,
      source: 'system'
    });
  });

  it.each(['de-DE', 'fr-FR', 'ar-SA', 'ja-JP', '', undefined])(
    'falls back to English for unsupported system locale %s',
    (systemLocale) => {
      expect(resolveUiLocalization(systemLocale)).toMatchObject({
        language: 'en',
        locale: 'en-US',
        fallbackUsed: true,
        source: 'system'
      });
    }
  );

  it('keeps the no-bootstrap renderer default fail-safe in English', () => {
    expect(DEFAULT_UI_LOCALIZATION).toEqual({
      source: 'system',
      systemLocale: 'en-US',
      language: 'en',
      locale: 'en-US',
      fallbackUsed: false,
      supportedLanguages: ['tr', 'en']
    });
  });
});
