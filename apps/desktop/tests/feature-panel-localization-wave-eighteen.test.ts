import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { ManagedLifePanel } from '../src/renderer/ManagedLifePanel';
import { LocalizationProvider } from '../src/renderer/localization';
import { translateManagedLifeCopy } from '../src/renderer/YonetilenYasamYerellestirme';

const renderPanel = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(ManagedLifePanel, { people: [], workspace: undefined, onRecord: async () => undefined })
));

describe('feature-panel English localization wave eighteen', () => {
  it('renders managed life without visible Turkish copy in English', () => {
    const html = renderPanel('en-US');
    expect(html).toContain('Life Center, home inventory, and emergencies');
    expect(html).toContain('Manual local tracking only');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish product copy', () => {
    expect(renderPanel('tr-TR')).toContain('Yaşam Merkezi, ev envanteri ve acil durum');
  });

  it('covers every Turkish-character string literal in the managed-life source', () => {
    const source = readFileSync(new URL('../src/renderer/ManagedLifePanel.tsx', import.meta.url), 'utf8');
    const literals = new Set([...source.matchAll(/(['"])((?:\\.|(?!\1)[\s\S])*?)\1/gu)]
      .map((match) => match[2].trim())
      .filter((value) => /[ÇĞİÖŞÜçğıöşü]/u.test(value)));
    const uncovered = [...literals].filter((value) => /[ÇĞİÖŞÜçğıöşü]/u.test(translateManagedLifeCopy(value, 'en')));
    expect(uncovered).toEqual([]);
  });

  it('does not leave capitalized Turkish UI literals outside the English copy table', () => {
    const source = readFileSync(new URL('../src/renderer/ManagedLifePanel.tsx', import.meta.url), 'utf8');
    const allowedUnchanged = new Set(['A Rh+','A Rh−','B Rh+','B Rh−','AB Rh+','AB Rh−','Assistance','Card','Contact','DASK','Health','Wh']);
    const candidates = new Set([...source.matchAll(/(['"])((?:\\.|(?!\1)[\s\S])*?)\1/gu)]
      .map((match) => match[2].trim())
      .filter((value) => /^[A-Z][a-z]/u.test(value)));
    const untranslated = [...candidates].filter((value) => !allowedUnchanged.has(value)
      && translateManagedLifeCopy(value, 'en') === value);
    expect(untranslated).toEqual([]);
  });

  it('covers visible JSX text in every managed-life mode', () => {
    const source = readFileSync(new URL('../src/renderer/ManagedLifePanel.tsx', import.meta.url), 'utf8');
    const panelSource = source.slice(source.indexOf('const panel = <>'));
    const textNodes = new Set([...panelSource.matchAll(/>\s*([^<>{}=]+?)\s*</gu)]
      .map((match) => match[1].replace(/\s+/gu, ' ').trim())
      .filter((value) => value && (/[ÇĞİÖŞÜçğıöşü]/u.test(value) || /^[A-Z][a-z]/u.test(value))));
    const untranslated = [...textNodes].filter((value) => {
      const translated = translateManagedLifeCopy(value, 'en');
      return /[ÇĞİÖŞÜçğıöşü]/u.test(translated) || translated === value;
    });
    expect(untranslated).toEqual([]);
  });
});
