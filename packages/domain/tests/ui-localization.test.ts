import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UI_LOCALIZATION,
  resolveUiLocalization,
  selectOperatingSystemUiLanguage
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
      source: 'system',
      preference: 'system'
    });
  });

  it.each(['de-DE', 'fr-FR', 'ar-SA', 'ja-JP', '', undefined])(
    'falls back to English for unsupported system locale %s',
    (systemLocale) => {
      expect(resolveUiLocalization(systemLocale)).toMatchObject({
        language: 'en',
        locale: 'en-US',
        fallbackUsed: true,
        source: 'system',
        preference: 'system'
      });
    }
  );

  it('keeps the no-bootstrap renderer default fail-safe in English', () => {
    expect(DEFAULT_UI_LOCALIZATION).toEqual({
      source: 'system',
      preference: 'system',
      systemLocale: 'en-US',
      language: 'en',
      locale: 'en-US',
      fallbackUsed: false,
      supportedLanguages: ['tr', 'en']
    });
  });

  it('lets an explicit user preference override the detected system language',()=>{
    expect(resolveUiLocalization('tr-TR','en')).toMatchObject({source:'user',preference:'en',systemLocale:'tr-TR',language:'en',locale:'en-US',fallbackUsed:false});
    expect(resolveUiLocalization('de-DE','tr')).toMatchObject({source:'user',preference:'tr',systemLocale:'de-DE',language:'tr',locale:'tr-TR',fallbackUsed:false});
  });

  it('uses the Windows display locale before content-language preferences',()=>{
    expect(selectOperatingSystemUiLanguage('tr-TR',['en-US','tr-TR'])).toBe('tr-TR');
    expect(selectOperatingSystemUiLanguage('tr_TR',['en-US'])).toBe('tr-TR');
    expect(selectOperatingSystemUiLanguage('', ['en-US','tr-TR'])).toBe('en-US');
    expect(selectOperatingSystemUiLanguage(undefined, ['  ','tr_TR'])).toBe('tr-TR');
  });
});
