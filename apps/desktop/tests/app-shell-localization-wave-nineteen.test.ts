import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization, type DashboardOverviewView, type FamilyEventView } from '@ppt/domain';
import { Dashboard } from '../src/renderer/App';
import { LocalizationProvider } from '../src/renderer/localization';

const event: FamilyEventView = {
  id: 'event-1', kind: 'important_day', title: 'Family Day', description: 'Shared memory',
  startAt: '2026-08-20T10:00:00.000Z', participantPersonIds: [], visibility: 'family',
  attachmentCount: 0, aiProcessingAllowed: false, recurrence: 'none', reminderDays: [],
  createdAt: '2026-08-19T10:00:00.000Z'
};

const overview = (justStarted: boolean): DashboardOverviewView => ({
  family: { id: 'family-1', name: 'ParsYuva' }, memberCount: justStarted ? 1 : 3,
  generationCount: 2, upcomingImportantDayCount: 1, nextImportantDayInDays: 1,
  timelineEventCount: justStarted ? 0 : 1, relatedContentCount: 0, notificationCount: 0,
  upcomingImportantDays: justStarted ? [] : [event], recentEvents: justStarted ? [] : [event],
  modules: [
    { id: 'family', label: 'Aile', recordCount: justStarted ? 1 : 3, state: 'ready', detail: 'Modül verisi hazır' },
    { id: 'tree', label: 'Soy Ağacı', recordCount: justStarted ? 0 : 1, state: justStarted ? 'empty' : 'ready', detail: justStarted ? 'Kayıt bekleniyor' : 'Modül verisi hazır' },
    { id: 'timeline', label: 'Zaman Tüneli', recordCount: justStarted ? 0 : 1, state: justStarted ? 'empty' : 'ready', detail: justStarted ? 'Kayıt bekleniyor' : 'Modül verisi hazır' },
    { id: 'location', label: 'Konum', recordCount: 0, state: 'empty', detail: 'Kayıt bekleniyor' }
  ],
  generatedAt: '2026-08-19T10:00:00.000Z', lastActivityAt: '2026-08-19T10:00:00.000Z'
});

const renderDashboard = (locale: 'tr-TR' | 'en-US', justStarted = false): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(Dashboard, { overview: overview(justStarted), onNavigate: () => undefined, onAddMember: () => undefined, onAddImportantDay: () => undefined })
));

describe('app shell English localization wave nineteen', () => {
  it('renders the populated dashboard without visible Turkish copy in English', () => {
    const html = renderDashboard('en-US');
    expect(html).toContain('Family life dashboard');
    expect(html).toContain('No location');
    expect(html).toContain('Family Tree');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('renders the first-use dashboard without visible Turkish copy in English', () => {
    const html = renderDashboard('en-US', true);
    expect(html).toContain('Your family space is ready');
    expect(html).toContain('Configure backup');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish dashboard copy', () => {
    expect(renderDashboard('tr-TR')).toContain('Aile yaşamı panosu');
    expect(renderDashboard('tr-TR', true)).toContain('Aile alanınız hazır');
  });

  it('does not pin dashboard event formatting to the Turkish locale', () => {
    const source = String(Dashboard);
    expect(source).not.toContain("toLocaleDateString('tr-TR'");
  });
});
