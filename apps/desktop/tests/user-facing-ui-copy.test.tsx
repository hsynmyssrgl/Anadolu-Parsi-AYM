import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization, type AuthStateView } from '@ppt/domain';
import { PermissionsScreen } from '../src/renderer/App';
import { LocalizationProvider } from '../src/renderer/localization';
import { userFacingEyebrow } from '../src/renderer/ui';

describe('kullanıcıya görünen arayüz metinleri', () => {
  it('iç kural kimliklerini başlık metninden ayırır', () => {
    expect(userFacingEyebrow('PPK-015 · ağ çıkış güvenliği')).toBe('ağ çıkış güvenliği');
    expect(userFacingEyebrow('B2-03 / B2-04 · masaüstü güvenlik kapanışı')).toBe('masaüstü güvenlik kapanışı');
    expect(userFacingEyebrow('33-L · DEC-223 · LTP-001–008')).toBeUndefined();
    expect(userFacingEyebrow('B2-05 hassasiyet profili')).toBe('hassasiyet profili');
  });

  it('izin eylemlerini Türkçe kullanıcı etiketleriyle gösterir', () => {
    const auth = { role: 'family_admin', authenticated: true } as unknown as AuthStateView;
    const html = renderToStaticMarkup(createElement(
      LocalizationProvider,
      { bootstrap: resolveUiLocalization('tr-TR') },
      createElement(PermissionsScreen, { auth })
    ));
    for (const label of ['Oku', 'Oluştur', 'Güncelle', 'Sil', 'Paylaş', 'Kaydet', 'Yapay zekâ ile işle', 'Yönet']) {
      expect(html).toContain(`>${label}</button>`);
    }
    expect(html).not.toMatch(/>(read|create|update|delete|share|record|ai_process|administer)<\/button>/);
  });
});
