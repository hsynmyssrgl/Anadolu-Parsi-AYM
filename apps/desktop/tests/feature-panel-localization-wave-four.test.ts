import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { CommunicationRealtimeCallingPanel } from '../src/renderer/CommunicationRealtimeCallingPanel';
import { LocalizationProvider } from '../src/renderer/localization';

const renderPanel = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(CommunicationRealtimeCallingPanel)
));

describe('feature-panel English localization wave four', () => {
  it('renders the real-time calling panel without visible Turkish copy in English', () => {
    const html = renderPanel('en-US');
    expect(html).toContain('Real-time call preparation');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish product copy', () => {
    expect(renderPanel('tr-TR')).toContain('Gerçek zamanlı çağrı hazırlığı');
  });
});
