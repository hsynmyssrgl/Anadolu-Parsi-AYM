import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { CommunicationFileSharingPanel } from '../src/renderer/CommunicationFileSharingPanel';
import { LocalizationProvider } from '../src/renderer/localization';

const renderPanel = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(CommunicationFileSharingPanel)
));

describe('feature-panel English localization wave eight', () => {
  it('renders the file-sharing loading surface without visible Turkish copy in English', () => {
    const html = renderPanel('en-US');
    expect(html).toContain('Loading file sharing');
    expect(html).toContain('Reading local encrypted file metadata records');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish product copy', () => {
    expect(renderPanel('tr-TR')).toContain('Dosya paylaşımı yükleniyor');
  });
});
