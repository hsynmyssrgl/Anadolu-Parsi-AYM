import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { FinancePlanningPanel } from '../src/renderer/FinancePlanningPanel';
import { LocalizationProvider } from '../src/renderer/localization';

const renderPanel = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(FinancePlanningPanel, { people: [], workspace: undefined, onRecord: async () => undefined, onWorkspaceChange: () => undefined })
));

describe('feature-panel English localization wave fifteen', () => {
  it('renders finance planning without visible Turkish copy in English', () => {
    const html = renderPanel('en-US');
    expect(html).toContain('Budget, goals, portfolio, and net worth center');
    expect(html).toContain('Each currency is calculated separately');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish product copy', () => {
    expect(renderPanel('tr-TR')).toContain('Bütçe, hedef, portföy ve net değer merkezi');
  });
});
