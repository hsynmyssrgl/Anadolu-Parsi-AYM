import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { SystemManagementScreen } from '../src/renderer/App';
import { LocalizationProvider } from '../src/renderer/localization';

const renderScreen=(locale:'tr-TR'|'en-US'):string=>renderToStaticMarkup(createElement(
  LocalizationProvider,{bootstrap:resolveUiLocalization(locale)},createElement(SystemManagementScreen)
));

describe('app shell English localization wave twenty-nine',()=>{
  it('renders the initial system-maintenance surface without visible Turkish copy in English',()=>{
    const html=renderScreen('en-US');
    expect(html).toContain('System, maintenance, and operations');
    expect(html).toContain('System modules');
    expect(html).toContain('Operations and backups');
    expect(html).toContain('Personal drafts');
    expect(html).toContain('Signed plugin platform');
    expect(html).not.toContain('IPC performance telemetry');
    expect(html.match(/aria-expanded="false"/gu)).toHaveLength(12);
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
    expect(html).not.toMatch(/\b(?:bilinmiyor|keyfi mesaj|ret nedeni|zincir|Manuel|Haftalik|Aylik|Denetleniyor)\b/iu);
  });
  it('preserves the Turkish system-maintenance surface',()=>{
    const html=renderScreen('tr-TR');
    expect(html).toContain('Sistem, bakım ve operasyon');
    expect(html).toContain('Sistem modülleri');
    expect(html).toContain('Modüller kapalı başlar; yalnız açtığınız bölüm yüklenir.');
  });
});
