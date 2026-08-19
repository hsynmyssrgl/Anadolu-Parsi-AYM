import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { AiGovernanceScreen } from '../src/renderer/App';
import { LocalizationProvider } from '../src/renderer/localization';

const renderScreen = (locale: 'tr-TR'|'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(AiGovernanceScreen)
));

describe('app shell English localization wave twenty-five', () => {
  it('renders the AI consent center without visible Turkish copy in English', () => {
    const html = renderScreen('en-US');
    expect(html).toContain('AI consent center');
    expect(html).toContain('Time-limited explicit consent');
    expect(html).toContain('Create preview before sending data');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish AI consent copy', () => {
    const html = renderScreen('tr-TR');
    expect(html).toContain('Yapay zekâ izin merkezi');
    expect(html).toContain('Süreli ve açık rıza');
  });
});
