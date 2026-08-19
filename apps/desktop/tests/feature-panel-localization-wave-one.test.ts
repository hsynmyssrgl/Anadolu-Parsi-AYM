import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { DistributedOperationsPanel } from '../src/renderer/DistributedOperationsPanel';
import { LocalizationProvider } from '../src/renderer/localization';
import { SignedPluginPlatformPanel } from '../src/renderer/SignedPluginPlatformPanel';
import { UniversalUxConsolidationPanel } from '../src/renderer/UniversalUxConsolidationPanel';

const turkishCharacter = /[ÇĞİÖŞÜçğıöşü]/u;

const renderPanel = (Panel: ComponentType, locale: 'tr-TR' | 'en-US'): string =>
  renderToStaticMarkup(createElement(
    LocalizationProvider,
    { bootstrap: resolveUiLocalization(locale) },
    createElement(Panel)
  ));

describe('feature-panel English localization wave one', () => {
  const panels = [
    [DistributedOperationsPanel, 'Cluster and device center', 'Dağıtık Core Service'],
    [UniversalUxConsolidationPanel, 'Unified family view', 'Tek aile görünümü'],
    [SignedPluginPlatformPanel, 'Plugin and external provider platform', 'İmzalı aday kayıt']
  ] as const;

  it.each(panels)('renders %p without visible Turkish copy in English', (Panel, englishMarker) => {
    const html = renderPanel(Panel, 'en-US');
    expect(html).toContain(englishMarker);
    expect(html).not.toMatch(turkishCharacter);
  });

  it.each(panels)('preserves the Turkish product copy for %p', (Panel, _englishMarker, turkishMarker) => {
    const html = renderPanel(Panel, 'tr-TR');
    expect(html).toContain(turkishMarker);
  });
});
