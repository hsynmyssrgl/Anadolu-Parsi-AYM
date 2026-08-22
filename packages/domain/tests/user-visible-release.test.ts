import { describe, expect, it } from 'vitest';
import {
  APP_META,
  USER_VISIBLE_APP_INFO,
  USER_VISIBLE_DELIVERY_FILE_NAME,
  createUserVisibleDeliveryFileName,
  formatUserVisibleReleaseSummary,
  releaseStageForChannel,
  toUserVisibleAppInfo
} from '../src/app-meta.js';

describe('user-visible release boundary', () => {
  it('projects only the public release DTO and preserves the canonical label', () => {
    expect(USER_VISIBLE_APP_INFO).toEqual({
      name: APP_META.name,
      releaseLabel: APP_META.releaseLabel,
      channel: APP_META.edition,
      stage: 'Aktif Geliştirme'
    });
    expect(Object.keys(USER_VISIBLE_APP_INFO).sort()).toEqual(['channel', 'name', 'releaseLabel', 'stage']);
    for (const key of ['packageVersion', 'releaseId', 'monthlySequence', 'version']) expect(USER_VISIBLE_APP_INFO).not.toHaveProperty(key);
  });

  it('creates the canonical user delivery filename without legacy tokens', () => {
    expect(USER_VISIBLE_DELIVERY_FILE_NAME).toBe(`ParsYuva_Aile_Yasam_Merkezi_${APP_META.releaseLabel.replaceAll(' ', '_')}.json`);
    expect(createUserVisibleDeliveryFileName(APP_META.name, APP_META.releaseLabel, 'zip'))
      .toBe(`ParsYuva_Aile_Yasam_Merkezi_${APP_META.releaseLabel.replaceAll(' ', '_')}.zip`);
    expect(USER_VISIBLE_DELIVERY_FILE_NAME).not.toMatch(/RC2?|MVP|Build/iu);
  });

  it('rejects a legacy visible release label fail-closed', () => {
    expect(() => toUserVisibleAppInfo({ ...APP_META, releaseLabel: 'Bronze RC2 Build 229' } as typeof APP_META)).toThrow();
    expect(() => createUserVisibleDeliveryFileName(APP_META.name, 'Bronze RC2 Build 229')).toThrow();
  });

  it.each(['Bronze', 'Silver', 'Gold'] as const)('shows the %s channel exactly once', (channel) => {
    const stage=releaseStageForChannel(channel,'tr');
    const info = toUserVisibleAppInfo({
      ...APP_META,
      edition: channel,
      releaseLabel: `${channel} ${APP_META.version}`,
      releaseId: `${channel.toLowerCase()}-test`,
      stage
    } as typeof APP_META);
    const summary = formatUserVisibleReleaseSummary(info);
    expect(summary).toBe(`${channel} ${APP_META.version} · ${stage}`);
    expect(summary.match(new RegExp(channel, 'gu'))).toHaveLength(1);
  });

  it('maps the lifecycle stage for every supported channel and language',()=>{
    expect((['Bronze','Silver','Gold'] as const).map((channel)=>releaseStageForChannel(channel,'tr')))
      .toEqual(['Aktif Geliştirme','Aktif Test','Aktif Sürüm']);
    expect((['Bronze','Silver','Gold'] as const).map((channel)=>releaseStageForChannel(channel,'en')))
      .toEqual(['Active Development','Active Testing','Active Release']);
  });

  it('rejects a lifecycle stage that repeats any release channel', () => {
    for (const channel of ['Bronze', 'Silver', 'Gold']) {
      expect(() => toUserVisibleAppInfo({ ...APP_META, stage: `${channel} · Aktif Geliştirme` } as typeof APP_META)).toThrow();
      expect(() => formatUserVisibleReleaseSummary(USER_VISIBLE_APP_INFO, `${channel} · Active Development`)).toThrow();
    }
  });
});
