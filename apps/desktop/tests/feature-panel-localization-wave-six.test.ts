import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { FinanceImportPanel } from '../src/renderer/FinanceImportPanel';
import { LocalizationProvider } from '../src/renderer/localization';

const renderPanel = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(FinanceImportPanel, { people: [], workspace: undefined, onWorkspaceChange: () => undefined })
));

describe('feature-panel English localization wave six', () => {
  it('renders the finance import panel without visible Turkish copy in English', () => {
    const html = renderPanel('en-US');
    expect(html).toContain('Controlled transaction import and bank-connection boundary');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish product copy', () => {
    expect(renderPanel('tr-TR')).toContain('Kontrollü hareket aktarımı');
  });
});
