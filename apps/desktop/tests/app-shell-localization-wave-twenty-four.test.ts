import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization, type FamilyAppSnapshot } from '@ppt/domain';
import { AddRelationModal, DigitalLegacyScreen, legacyPermissionActionLabel } from '../src/renderer/App';
import { LocalizationProvider } from '../src/renderer/localization';

const snapshot: FamilyAppSnapshot = {
  family: { id: 'family-1', name: 'ParsYuva' }, people: [], relations: [], locations: [], events: [], notifications: [],
  lastUpdatedAt: '2026-08-19T10:00:00.000Z'
};

const renderLocalized = (locale: 'tr-TR'|'en-US', child: ReturnType<typeof createElement>): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  child
));

describe('app shell English localization wave twenty-four', () => {
  it('renders the family-relationship dialog without visible Turkish copy in English', () => {
    const html = renderLocalized('en-US', createElement(AddRelationModal, {
      onClose: () => undefined,
      onSave: async () => undefined
    }));
    expect(html).toContain('Add family relationship');
    expect(html).toContain('Close Add family relationship dialog');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('renders the digital-legacy workspace without visible Turkish copy in English', () => {
    const html = renderLocalized('en-US', createElement(DigitalLegacyScreen, { snapshot }));
    expect(html).toContain('Digital Legacy Management');
    expect(html).toContain('Create the first digital legacy plan.');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves Turkish relationship and digital-legacy copy', () => {
    expect(renderLocalized('tr-TR', createElement(AddRelationModal, {
      onClose: () => undefined,
      onSave: async () => undefined
    }))).toContain('Aile ilişkisi ekle');
    expect(renderLocalized('tr-TR', createElement(DigitalLegacyScreen, { snapshot }))).toContain('Dijital Miras Yönetimi');
  });

  it('localizes every digital-legacy permission action without exposing raw values', () => {
    expect(['read','create','update','delete','share','record','ai_process','administer'].map(action=>legacyPermissionActionLabel(action as never,'tr'))).toEqual(['Oku','Oluştur','Güncelle','Sil','Paylaş','Kaydet','Yapay zekâ ile işle','Yönet']);
    expect(['read','create','update','delete','share','record','ai_process','administer'].map(action=>legacyPermissionActionLabel(action as never,'en'))).toEqual(['Read','Create','Update','Delete','Share','Record','Process with AI','Administer']);
  });
});
