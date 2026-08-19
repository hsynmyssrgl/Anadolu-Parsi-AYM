import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { LocalizationProvider } from '../src/renderer/localization';
import { SmartHomeEnergyPanel } from '../src/renderer/SmartHomeEnergyPanel';

const renderPanel = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(SmartHomeEnergyPanel)
));

describe('feature-panel English localization wave five', () => {
  it('renders the smart-home panel without visible Turkish copy in English', () => {
    const html = renderPanel('en-US');
    expect(html).toContain('Smart home and energy');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish product copy', () => {
    expect(renderPanel('tr-TR')).toContain('Akıllı ev ve enerji');
  });
});
