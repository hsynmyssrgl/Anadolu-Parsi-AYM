import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { DataLifecycleSettings } from '../src/renderer/App';
import { translateDataLifecycleCopy } from '../src/renderer/VeriYasamDongusuYerellestirme';
import { LocalizationProvider } from '../src/renderer/localization';

const auth={authenticated:true,accountId:'account-1',displayName:'Owner',role:'family_admin',twoFactorEnabled:false} as const;
const renderScreen=(locale:'tr-TR'|'en-US'):string=>renderToStaticMarkup(createElement(
  LocalizationProvider,{bootstrap:resolveUiLocalization(locale)},createElement(DataLifecycleSettings,{auth})
));

describe('app shell English localization wave twenty-eight',()=>{
  it('renders the complete initial data-lifecycle administration surface without visible Turkish copy in English',()=>{
    const html=renderScreen('en-US');
    expect(html).toContain('Data retention and secure deletion');
    expect(html).toContain('Automatic clean-backup rewrite');
    expect(html).toContain('External-backup inventory');
    expect(html).toContain('Provider trust chain');
    expect(html).toContain('Standard sensitive-data retention');
    expect(html).not.toContain('Standart hassas veri saklama');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });
  it('preserves fail-honest destruction and external-evidence wording',()=>{
    expect(translateDataLifecycleCopy('Güvenli silme mümkün olan en kapsamlı şekilde uygulanır. Depolama aygıtı, eşitlenen klasörler veya yönetilmeyen yedekler fiziksel kopyaları bir süre daha tutabilir.','en')).toContain('as thoroughly as possible');
    expect(translateDataLifecycleCopy('Kullanıcı beyanı ile sağlayıcı imzalı makbuz ayrı güven seviyeleridir. Geçerli imza yalnız güvenilen açık anahtar, kopya kimliği, makbuz kimliği, zaman ve SHA-256 değerinin değiştirilmediğini kanıtlar; fiziksel medyanın mutlak yok oluşunu tek başına garanti etmez.','en')).toContain('does not by itself guarantee');
  });
  it('preserves Turkish data-lifecycle copy',()=>{
    expect(renderScreen('tr-TR')).toContain('Veri saklama ve güvenli silme');
  });
});
