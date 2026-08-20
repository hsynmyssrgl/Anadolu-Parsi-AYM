import { describe, expect, it } from 'vitest';
import { resolveBankaKurumGorseli } from '../src/renderer/BankaKurumIsareti.js';

describe('finans banka kurum işaretleri', () => {
  it('yaygın kurumlar için sabit çevrimdışı işaret ve güvenli renk üretir', () => {
    expect(resolveBankaKurumGorseli({ institutionCode: '0046', officialName: 'AKBANK T.A.Ş.' }))
      .toEqual({ shortLabel: 'AK', background: '#d81f2a', foreground: '#ffffff' });
    expect(resolveBankaKurumGorseli({ institutionCode: '0137', officialName: 'HEPSİ BANK A.Ş.' }))
      .toEqual({ shortLabel: 'H', background: '#ff5a36', foreground: '#ffffff' });
    expect(resolveBankaKurumGorseli({ institutionCode: '0807', officialName: 'POSTA VE TELGRAF TEŞKİLATI A.Ş.' }))
      .toEqual({ shortLabel: 'PTT', background: '#f2c500', foreground: '#17375e' });
  });

  it('özel eşlemesi olmayan her katalog kurumu için deterministik yerel işaret üretir', () => {
    const identity = { institutionCode: '0154', officialName: 'TERA YATIRIM BANKASI A.Ş.' };
    const first = resolveBankaKurumGorseli(identity);
    const second = resolveBankaKurumGorseli(identity);
    expect(first).toEqual(second);
    expect(first.shortLabel).toMatch(/^[A-Z0-9]{1,3}$/u);
    expect(first.background).toMatch(/^#[0-9a-f]{6}$/u);
    expect(first.foreground).toBe('#ffffff');
  });
});
