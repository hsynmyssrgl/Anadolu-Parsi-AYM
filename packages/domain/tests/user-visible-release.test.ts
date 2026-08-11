import { describe, expect, it } from 'vitest';
import {
  APP_META,
  USER_VISIBLE_APP_INFO,
  USER_VISIBLE_DELIVERY_FILE_NAME,
  createUserVisibleDeliveryFileName,
  toUserVisibleAppInfo
} from '../src/app-meta.js';

describe('user-visible release boundary', () => {
  it('projects only the public release DTO and preserves the canonical label', () => {
    expect(USER_VISIBLE_APP_INFO).toEqual({
      name: 'Anadolu Parsı Aile Yaşam Merkezi',
      releaseLabel: 'Bronze 04.08.2026.29',
      channel: 'Bronze',
      stage: 'Bronze · Aktif Geliştirme'
    });
    expect(Object.keys(USER_VISIBLE_APP_INFO).sort()).toEqual(['channel', 'name', 'releaseLabel', 'stage']);
    for (const key of ['packageVersion', 'releaseId', 'monthlySequence', 'version']) expect(USER_VISIBLE_APP_INFO).not.toHaveProperty(key);
  });

  it('creates the canonical user delivery filename without legacy tokens', () => {
    expect(USER_VISIBLE_DELIVERY_FILE_NAME).toBe('Anadolu_Parsi_Aile_Yasam_Merkezi_Bronze_04.08.2026.29.json');
    expect(createUserVisibleDeliveryFileName(APP_META.name, APP_META.releaseLabel, 'zip'))
      .toBe('Anadolu_Parsi_Aile_Yasam_Merkezi_Bronze_04.08.2026.29.zip');
    expect(USER_VISIBLE_DELIVERY_FILE_NAME).not.toMatch(/RC2?|MVP|Build/iu);
  });

  it('rejects a legacy visible release label fail-closed', () => {
    expect(() => toUserVisibleAppInfo({ ...APP_META, releaseLabel: 'Bronze RC2 Build 229' } as typeof APP_META)).toThrow();
    expect(() => createUserVisibleDeliveryFileName(APP_META.name, 'Bronze RC2 Build 229')).toThrow();
  });
});
