import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { LocalGovernedOcrPanel } from '../src/renderer/LocalGovernedOcrPanel';
import { LocalizationProvider } from '../src/renderer/localization';

const renderPanel = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(LocalGovernedOcrPanel, { selectedSource: undefined })
));

describe('feature-panel English localization wave sixteen', () => {
  it('renders local text recognition without visible Turkish copy in English', () => {
    const html = renderPanel('en-US');
    expect(html).toContain('Loading the local text-recognition center');
    expect(html).toContain('Reading jobs and the local processing setting.');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish product copy', () => {
    expect(renderPanel('tr-TR')).toContain('Yerel metin tanıma merkezi yükleniyor');
  });
});
