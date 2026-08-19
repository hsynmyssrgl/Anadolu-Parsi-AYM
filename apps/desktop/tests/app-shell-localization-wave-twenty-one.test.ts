import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { UnifiedAuthorizedSearchPanel } from '../src/renderer/App';
import { LocalizationProvider } from '../src/renderer/localization';

const renderSearch = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(UnifiedAuthorizedSearchPanel, { onOpenArchive: async () => undefined })
));

describe('app shell English localization wave twenty-one', () => {
  it('renders unified authorized search without visible Turkish copy in English', () => {
    const html = renderSearch('en-US');
    expect(html).toContain('Search all modules');
    expect(html).toContain('Authorization-filtered read');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish unified-search copy', () => {
    expect(renderSearch('tr-TR')).toContain('Tüm modüllerde ara');
  });
});
