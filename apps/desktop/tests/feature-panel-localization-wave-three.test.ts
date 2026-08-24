import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { CommunicationAuditArchivePanel } from '../src/renderer/CommunicationAuditArchivePanel';
import { CommunicationRecordingRetentionPanel } from '../src/renderer/CommunicationRecordingRetentionPanel';
import { CommunicationSecurityPanel } from '../src/renderer/CommunicationSecurityPanel';
import { LocalizationProvider } from '../src/renderer/localization';

const turkishCharacter = /[ÇĞİÖŞÜçğıöşü]/u;
const renderPanel = (Panel: ComponentType, locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(Panel)
));

describe('feature-panel English localization wave three', () => {
  const panels = [
    [CommunicationAuditArchivePanel, 'Loading activity history', 'İşlem geçmişi yükleniyor'],
    [CommunicationRecordingRetentionPanel, 'Call recording consent plan', 'Görüşme kaydı rıza planı'],
    [CommunicationSecurityPanel, 'Local foundation for room and device security', 'Oda ve cihaz güvenliğinin yerel temeli']
  ] as const;

  it.each(panels)('renders %p without visible Turkish copy in English', (Panel, englishMarker) => {
    const html = renderPanel(Panel, 'en-US');
    expect(html).toContain(englishMarker);
    expect(html).not.toMatch(turkishCharacter);
  });

  it.each(panels)('preserves the Turkish product copy for %p', (Panel, _englishMarker, turkishMarker) => {
    expect(renderPanel(Panel, 'tr-TR')).toContain(turkishMarker);
  });
});
