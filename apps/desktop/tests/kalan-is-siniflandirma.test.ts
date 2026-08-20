import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('kalan iş sınıflandırması', () => {
  it('358 gereksinimi yeni hata, yerel kod ve dış kabulü karıştırmadan sınıflandırır', () => {
    const run = spawnSync(process.execPath, ['scripts/siniflandir-kalan-isler.mjs', '--no-write'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      windowsHide: true
    });
    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
    expect(run.stdout).toContain('PASS (358; kapalı 109; yalnız dış kabul 24; üretim+dış kabul 169; karma 53; final 3)');

    const report = JSON.parse(readFileSync('artifacts/inventory/KALAN_IS_SINIFLANDIRMA.json', 'utf8')) as {
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
      activeRelease: 'Bronze 20.08.2026.37',
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
