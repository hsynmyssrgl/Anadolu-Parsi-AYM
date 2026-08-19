import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { FamilyAiAssistantPanel } from '../src/renderer/FamilyAiAssistantPanel';
import { FamilyLocationMap } from '../src/renderer/FamilyLocationMap';
import { LocalizationProvider } from '../src/renderer/localization';
import { LocalTranslationLanguagePanel } from '../src/renderer/LocalTranslationLanguagePanel';

const turkishCharacter = /[ÇĞİÖŞÜçğıöşü]/u;

const renderPanel = (Panel: ComponentType<Record<string, unknown>>, props: Record<string, unknown>, locale: 'tr-TR' | 'en-US'): string =>
  renderToStaticMarkup(createElement(
    LocalizationProvider,
    { bootstrap: resolveUiLocalization(locale) },
    createElement(Panel, props)
  ));

describe('feature-panel English localization wave two', () => {
  const panels = [
    [FamilyLocationMap as ComponentType<Record<string, unknown>>, { locations: [] }, 'Family location map', 'Aile konum haritası'],
    [LocalTranslationLanguagePanel as ComponentType<Record<string, unknown>>, {}, 'Translation, captions and personal dictionary', 'Çeviri, altyazı ve kişisel sözlük'],
    [FamilyAiAssistantPanel as ComponentType<Record<string, unknown>>, {}, 'Family assistant', 'Aile asistanı']
  ] as const;

  it.each(panels)('renders %p without visible Turkish copy in English', (Panel, props, englishMarker) => {
    const html = renderPanel(Panel, props, 'en-US');
    expect(html).toContain(englishMarker);
    expect(html).not.toMatch(turkishCharacter);
  });

  it.each(panels)('preserves the Turkish product copy for %p', (Panel, props, _englishMarker, turkishMarker) => {
    expect(renderPanel(Panel, props, 'tr-TR')).toContain(turkishMarker);
  });
});
