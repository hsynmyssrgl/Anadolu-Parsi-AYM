import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { HouseholdOperationsPanel } from '../src/renderer/HouseholdOperationsPanel';
import { LocalizationProvider } from '../src/renderer/localization';

const renderPanel = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(HouseholdOperationsPanel, { people: [] })
));

describe('feature-panel English localization wave thirteen', () => {
  it('renders household operations without visible Turkish copy in English', () => {
    const html = renderPanel('en-US');
    expect(html).toContain('Household operations center');
    expect(html).toContain('This center stores records');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish product copy', () => {
    expect(renderPanel('tr-TR')).toContain('Hane operasyonları merkezi');
  });
});
