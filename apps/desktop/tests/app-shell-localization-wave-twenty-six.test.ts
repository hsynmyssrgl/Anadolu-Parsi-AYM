import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import { GovernedFormDraftCenter } from '../src/renderer/App';
import { translateDraftCenterCopy } from '../src/renderer/TaslakMerkeziYerellestirme';
import { LocalizationProvider } from '../src/renderer/localization';

const renderCenter = (locale:'tr-TR'|'en-US'):string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  {bootstrap:resolveUiLocalization(locale)},
  createElement(GovernedFormDraftCenter,{visible:true})
));

describe('app shell English localization wave twenty-six',()=>{
  it('renders the governed draft loading state without visible Turkish copy in English',()=>{
    const html=renderCenter('en-US');
    expect(html).toContain('Loading draft center');
    expect(html).toContain('Preparing the personal versioned draft and change history.');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('translates validation, autosave and immutable-history copy',()=>{
    expect(translateDraftCenterCopy('Taslak başlığı zorunludur.','en')).toBe('The draft title is required.');
    expect(translateDraftCenterCopy('Otomatik kayıt tamamlanamadı','en')).toBe('Autosave could not be completed');
    expect(translateDraftCenterCopy('Her başarılı otomatik kayıt ve geri alma değişmez bir sürüm olarak burada görünür.','en')).toContain('immutable revision');
  });

  it('preserves the Turkish governed-draft copy',()=>{
    expect(renderCenter('tr-TR')).toContain('Taslak merkezi yükleniyor');
  });
});
