import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { LongTermPortfolioPanel } from '../src/renderer/LongTermPortfolioPanel';
import { LocalizationProvider } from '../src/renderer/localization';

const renderPanel = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(LongTermPortfolioPanel, { people: [], workspace: undefined, onRecord: async () => undefined })
));

describe('feature-panel English localization wave seventeen', () => {
  it('renders long-term portfolio without visible Turkish copy in English', () => {
    const html = renderPanel('en-US');
    expect(html).toContain('Long-Term Portfolio');
    expect(html).toContain('Tracking and decision support');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish product copy', () => {
    expect(renderPanel('tr-TR')).toContain('Uzun Vadeli Portföy');
  });
});
