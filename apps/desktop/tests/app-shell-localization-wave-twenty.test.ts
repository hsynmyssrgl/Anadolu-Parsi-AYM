import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization, type FamilyAppSnapshot, type FamilyEventView } from '@ppt/domain';
import { ImportantDaysScreen, TimelineScreen } from '../src/renderer/App';
import { LocalizationProvider } from '../src/renderer/localization';

const event: FamilyEventView = {
  id: 'event-1', kind: 'important_day', title: 'Family Day', description: 'Shared memory',
  startAt: '2026-08-20T10:00:00.000Z', participantPersonIds: [], visibility: 'family',
  attachmentCount: 0, aiProcessingAllowed: false, recurrence: 'none', reminderDays: [],
  createdAt: '2026-08-19T10:00:00.000Z'
};

const snapshot = (withEvent: boolean): FamilyAppSnapshot => ({
  family: { id: 'family-1', name: 'ParsYuva' }, people: [], relations: [], locations: [], events: withEvent ? [event] : [], notifications: [],
  lastUpdatedAt: '2026-08-19T10:00:00.000Z'
});

const renderTimelineScreen = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(TimelineScreen, { snapshot: snapshot(false), onEdit: () => undefined, onArchive: async () => undefined, onOpenArchive: () => undefined })
));

const renderImportantDaysScreen = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(ImportantDaysScreen, {
    snapshot: snapshot(true), archivedEvents: [], onAdd: () => undefined, onEdit: () => undefined,
    onArchive: async () => undefined, onRestore: async () => undefined, onOpenArchive: () => undefined
  })
));

describe('app shell English localization wave twenty', () => {
  it('renders timeline and important-date surfaces without visible Turkish copy in English', () => {
    const html = `${renderTimelineScreen('en-US')} ${renderImportantDaysScreen('en-US')}`;
    expect(html).toContain('Digital family memory');
    expect(html).toContain('Memories and events center');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves Turkish timeline and important-date copy', () => {
    expect(renderTimelineScreen('tr-TR')).toContain('Zaman tüneli');
    expect(renderImportantDaysScreen('tr-TR')).toContain('Önemli günler');
  });

  it('keeps timeline and important-date month formatting locale-aware', () => {
    expect(String(TimelineScreen)).not.toContain("toLocaleDateString('tr-TR'");
    expect(String(ImportantDaysScreen)).not.toContain("toLocaleDateString('tr-TR'");
  });
});
