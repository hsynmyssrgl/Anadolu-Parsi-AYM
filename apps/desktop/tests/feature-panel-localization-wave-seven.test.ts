import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { CommunicationMessagingPanel } from '../src/renderer/CommunicationMessagingPanel';
import { LocalizationProvider } from '../src/renderer/localization';

const renderPanel = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(CommunicationMessagingPanel)
));

describe('feature-panel English localization wave seven', () => {
  it('renders the messaging panel without visible Turkish copy in English', () => {
    const html = renderPanel('en-US');
    expect(html).toContain('Local sealed messaging workspace');
    expect(html).toContain('Loading messaging center');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish product copy', () => {
    expect(renderPanel('tr-TR')).toContain('Yerel, mühürlü mesajlaşma çalışma alanı');
  });
});
