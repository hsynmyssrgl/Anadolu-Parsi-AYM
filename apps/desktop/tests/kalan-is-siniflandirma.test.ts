import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ACTIVE_BUILD_META } from '../../../scripts/lib/active-build-meta.mjs';

describe('kalan iş sınıflandırması', () => {
  it('358 gereksinimi yeni hata, yerel kod ve dış kabulü karıştırmadan sınıflandırır', () => {
    const run = spawnSync(process.execPath, [
      'scripts/siniflandir-kalan-isler.mjs',
      '--no-write',
      '--json-stdout'
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
      windowsHide: true
    });
    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);

    const report = JSON.parse(run.stdout) as {
      readonly requirementCount: number;
      readonly activeRelease: string;
      readonly scopeBaselineRelease: string;
      readonly strictCompleteCount: number;
      readonly strictRemainingCount: number;
      readonly classificationCounts: Record<string, number>;
      readonly validation: { readonly status: string; readonly failures: readonly string[] };
    };
    expect(report).toMatchObject({
      requirementCount: 358,
      activeRelease: ACTIVE_BUILD_META.milestone,
      scopeBaselineRelease: 'Bronze 04.08.2026.29',
      strictCompleteCount: 109,
      strictRemainingCount: 249,
      classificationCounts: {
        KATI_KAPALI: 109,
        YEREL_KOD_TAMAM_DIS_KABUL_BEKLIYOR: 24,
        YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK: 169,
        YEREL_VE_DIS_IS_BIRLIKTE_ACIK: 53,
        SON_KAPANIS_OTOMASYONU_BEKLIYOR: 3,
        KAYIT_UYUMSUZLUGU: 0,
        ESLESMEYEN_ACIK_GEREKSINIM: 0
      },
      validation: { status: 'PASS', failures: [] }
    });
  });
});
