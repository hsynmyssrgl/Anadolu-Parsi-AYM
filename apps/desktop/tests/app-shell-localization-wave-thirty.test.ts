import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { PrivacyOwnershipCenter } from '../src/renderer/App';
import { LocalizationProvider } from '../src/renderer/localization';
import { translatePrivacyOwnershipCopy } from '../src/renderer/GizlilikSahiplikYerellestirme';

const renderScreen=(locale:'tr-TR'|'en-US'):string=>renderToStaticMarkup(createElement(
  LocalizationProvider,{bootstrap:resolveUiLocalization(locale)},createElement(PrivacyOwnershipCenter)
));

describe('app shell English localization wave thirty',()=>{
  it('renders the initial privacy center state in English',()=>{
    const html=renderScreen('en-US');
    expect(html).toContain('Loading privacy and ownership center');
    expect(html).toContain('Preparing the owner-bound local inventory and audit view.');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });
  it('covers loaded privacy, export, incident, and simulation truth in English',()=>{
    expect(translatePrivacyOwnershipCopy('Gizlilik, Sahiplik ve Olay Kontrol Merkezi','en')).toBe('Privacy, Ownership, and Incident Control Center');
    expect(translatePrivacyOwnershipCopy('Şifreli paket; sahip kapsamındaki yapılandırılmış kayıtları ve gizlilik merkezi verisini içerir. Arşiv ikili dosyaları, sahipliği kesin bağlanamayan aile etkinlikleri ve açıkça seçilmemiş form taslakları dahil edilmez.','en')).toContain('Archive binary files');
    expect(translatePrivacyOwnershipCopy('Uzaktan silme, cihaz yönetimi veya ağ teslimi yapılmadı','en')).toBe('Remote deletion, device management, and network delivery were not performed');
    expect(translatePrivacyOwnershipCopy('Salt okunurdur; yetki oluşturmaz, erişim yapmaz ve erişim denetim kaydı üretmez.','en')).toContain('creates no authority');
  });
  it('preserves the Turkish privacy-center surface',()=>{
    expect(renderScreen('tr-TR')).toContain('Gizlilik ve sahiplik merkezi yükleniyor');
  });
});
