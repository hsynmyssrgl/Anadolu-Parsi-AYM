import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { WindowsHelloScreen } from '../src/renderer/App';
import { translateWindowsHelloCopy } from '../src/renderer/WindowsHelloYerellestirme';
import { LocalizationProvider } from '../src/renderer/localization';

const auth={authenticated:true,accountId:'account-1',displayName:'Owner',role:'family_admin',twoFactorEnabled:false} as const;
const renderScreen=(locale:'tr-TR'|'en-US'):string=>renderToStaticMarkup(createElement(
  LocalizationProvider,{bootstrap:resolveUiLocalization(locale)},createElement(WindowsHelloScreen,{auth})
));

describe('app shell English localization wave twenty-seven',()=>{
  it('renders the Windows Hello shell without visible Turkish copy in English',()=>{
    const html=renderScreen('en-US');
    expect(html).toContain('Device-bound identity');
    expect(html).toContain('Checking');
    expect(html).toContain('This computer');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });
  it('translates security-sensitive enrollment and fallback guidance',()=>{
    expect(translateWindowsHelloCopy('Windows Hello kaydı tamamlanamadı.','en')).toBe('Windows Hello enrollment could not be completed.');
    expect(translateWindowsHelloCopy('Hello olmazsa parola ile devam et','en')).toContain('Continue with password');
  });
  it('preserves the Turkish Windows Hello copy',()=>{
    expect(renderScreen('tr-TR')).toContain('Cihaz bağlı kimlik');
  });
});
