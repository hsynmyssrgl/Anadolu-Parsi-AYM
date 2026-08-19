import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { FamilyMeetingPanel } from '../src/renderer/FamilyMeetingPanel';
import { LocalizationProvider } from '../src/renderer/localization';

const renderPanel = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(FamilyMeetingPanel, { people: [] })
));

describe('feature-panel English localization wave fourteen', () => {
  it('renders family meetings without visible Turkish copy in English', () => {
    const html = renderPanel('en-US');
    expect(html).toContain('Loading family meetings');
    expect(html).toContain('Reading plans, decisions, and tasks.');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish product copy', () => {
    expect(renderPanel('tr-TR')).toContain('Aile toplantıları yükleniyor');
  });
});
