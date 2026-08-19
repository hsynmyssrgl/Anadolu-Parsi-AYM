import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization, type FamilyAppSnapshot } from '@ppt/domain';
import { ArchiveScreen } from '../src/renderer/App';
import { localizeArchiveCenterNode } from '../src/renderer/ArsivMerkeziYerellestirme';
import { LocalizationProvider } from '../src/renderer/localization';

const snapshot: FamilyAppSnapshot = {
  family: { id: 'family-1', name: 'ParsYuva' },
  people: [], relations: [], locations: [], events: [], notifications: [],
  lastUpdatedAt: '2026-08-19T10:00:00.000Z'
};

const renderArchive = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(ArchiveScreen, {
    revision: 0,
    snapshot,
    eventFilter: '',
    onEventFilterChange: () => undefined,
    onImport: async () => undefined,
    onOpen: async () => undefined
  })
));

describe('app shell English localization wave twenty-two', () => {
  it('renders the document center without visible Turkish copy in English', () => {
    const html = renderArchive('en-US');
    expect(html).toContain('Document Center');
    expect(html).toContain('Advanced document lifecycle');
    expect(html).toContain('Archive categories');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish document-center copy', () => {
    const html = renderArchive('tr-TR');
    expect(html).toContain('Doküman Merkezi');
    expect(html).toContain('Arşiv kategorileri');
  });

  it('never translates user-authored values marked for preservation', () => {
    const userValue = createElement('strong', { 'data-localization-preserve': true }, 'Açıklama');
    expect(renderToStaticMarkup(localizeArchiveCenterNode(userValue, 'en'))).toContain('Açıklama');
  });
});
