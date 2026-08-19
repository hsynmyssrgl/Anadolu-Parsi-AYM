import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { HealthCareCoordinationPanel } from '../src/renderer/HealthCareCoordinationPanel';
import { LocalizationProvider } from '../src/renderer/localization';

const renderPanel = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(HealthCareCoordinationPanel, { people: [] })
));

describe('feature-panel English localization wave eleven', () => {
  it('renders health coordination without visible Turkish copy in English', () => {
    const html = renderPanel('en-US');
    expect(html).toContain('Health coordination and elder support');
    expect(html).toContain('Medical verification');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish product copy', () => {
    expect(renderPanel('tr-TR')).toContain('Sağlık koordinasyonu ve yaşlı desteği');
  });
});
