import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { LocalizationProvider } from '../src/renderer/localization';
import { PlacesTravelAssetPetPanel, placesTravelStatusLabel } from '../src/renderer/PlacesTravelAssetPetPanel';

const renderPanel = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(PlacesTravelAssetPetPanel, { people: [] })
));

describe('feature-panel English localization wave ten', () => {
  it('renders places and travel without visible Turkish copy in English', () => {
    const html = renderPanel('en-US');
    expect(html).toContain('Places and travel center');
    expect(html).toContain('No active person found');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish product copy', () => {
    expect(renderPanel('tr-TR')).toContain('Yer ve seyahat merkezi');
  });

  it('localizes every places and travel record status without exposing enum tokens', () => {
    const cases = [
      ['planned', 'Planlandı', 'Planned'], ['active', 'Etkin', 'Active'], ['completed', 'Tamamlandı', 'Completed'],
      ['cancelled', 'İptal edildi', 'Canceled'], ['expired', 'Süresi doldu', 'Expired'],
      ['settled', 'Hesap kapatıldı', 'Settled'], ['deleted', 'Silindi', 'Deleted']
    ] as const;
    for (const [status, turkish, english] of cases) {
      expect(placesTravelStatusLabel(status, 'tr')).toBe(turkish);
      expect(placesTravelStatusLabel(status, 'en')).toBe(english);
      expect(placesTravelStatusLabel(status, 'tr')).not.toBe(status);
    }
  });
});
