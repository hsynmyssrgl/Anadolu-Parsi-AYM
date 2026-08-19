import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { ChildEducationCoordinationPanel } from '../src/renderer/ChildEducationCoordinationPanel';
import { LocalizationProvider } from '../src/renderer/localization';

const renderPanel = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(ChildEducationCoordinationPanel, { people: [] })
));

describe('feature-panel English localization wave twelve', () => {
  it('renders child education without visible Turkish copy in English', () => {
    const html = renderPanel('en-US');
    expect(html).toContain('Child education center');
    expect(html).toContain('No child profile found');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish product copy', () => {
    expect(renderPanel('tr-TR')).toContain('Çocuk eğitim merkezi');
  });
});
