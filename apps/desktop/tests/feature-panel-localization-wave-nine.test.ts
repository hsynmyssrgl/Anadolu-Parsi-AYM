import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { LocalizationProvider } from '../src/renderer/localization';
import { MemoryStudioPanel } from '../src/renderer/MemoryStudioPanel';

const renderPanel = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(MemoryStudioPanel)
));

describe('feature-panel English localization wave nine', () => {
  it('renders memory studio without visible Turkish copy in English', () => {
    const html = renderPanel('en-US');
    expect(html).toContain('Memory studio');
    expect(html).toContain('Manual and local operation boundary');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish product copy', () => {
    expect(renderPanel('tr-TR')).toContain('Hafıza stüdyosu');
  });
});
