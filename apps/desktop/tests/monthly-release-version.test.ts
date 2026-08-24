import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ACTIVE_BUILD_META } from '../../../scripts/lib/active-build-meta.mjs';
import {
  assertExpectedReleaseId,
  assertPreallocatedReleaseIdentity,
  createNextMonthlyRelease,
  installerArtifactTemplate,
  installerFileName
} from '../../../scripts/lib/monthly-release-version.mjs';

const ledger = {
  schemaVersion: 1,
  current: { channel: 'Bronze', visibleRelease: 'Bronze 04.08.2026.29' },
  entries: [
    { date: '2026-08-04', monthlySequence: 28 },
    { date: '2026-08-04', monthlySequence: 29 }
  ]
};

describe('resmî aylık derleme sürümü', () => {
  it('Europe/Istanbul gününü ve ay içindeki sonraki sıra numarasını üretir', () => {
    const release = createNextMonthlyRelease({ ledger, now: new Date('2026-08-17T22:30:00.000Z') });
    expect(release).toMatchObject({
      date: '2026-08-18', displayDate: '18.08.2026', monthlySequence: 30,
      version: '18.08.2026.30', packageVersion: '18.8.2026-30',
      visibleRelease: 'Bronze 18.08.2026.30', releaseId: 'bronze-2026-08-18-r30'
    });
  });

  it('yeni ayda sıra numarasını birden başlatır', () => {
    expect(createNextMonthlyRelease({ ledger, now: new Date('2026-08-31T22:00:00.000Z') }).monthlySequence).toBe(1);
  });

  it('kurulum dosya adını kanala ve resmî sürüme bağlar', () => {
    const release = createNextMonthlyRelease({ ledger, now: new Date('2026-08-18T08:00:00.000Z'), channel: 'Silver' });
    expect(installerArtifactTemplate(release)).toBe('ParsYuva-Silver-18.08.2026.30.${ext}');
    expect(installerFileName(release)).toBe('ParsYuva-Silver-18.08.2026.30.exe');
  });

  it('tanımsız sürüm kanalını reddeder', () => {
    expect(() => createNextMonthlyRelease({ ledger, channel: 'Platinum' })).toThrow(/Desteklenmeyen/u);
  });

  it('explicit expected release ID ikinci ardışık tahsisin .52 yazmasına izin vermez', () => {
    const ledger50 = {
      schemaVersion: 1,
      current: { channel: 'Bronze', visibleRelease: 'Bronze 22.08.2026.50' },
      entries: [{ date: '2026-08-22', monthlySequence: 50 }]
    };
    const release51 = createNextMonthlyRelease({ ledger: ledger50, now: new Date('2026-08-24T08:00:00.000Z') });
    expect(release51).toMatchObject({
      version: '24.08.2026.51', packageVersion: '24.8.2026-51', releaseId: 'bronze-2026-08-24-r51'
    });
    expect(assertExpectedReleaseId(release51, 'bronze-2026-08-24-r51')).toBe(release51);

    const ledger51 = { ...ledger50, current: release51, entries: [...ledger50.entries, release51] };
    const release52 = createNextMonthlyRelease({ ledger: ledger51, now: new Date('2026-08-24T08:00:00.000Z') });
    expect(release52.releaseId).toBe('bronze-2026-08-24-r52');
    expect(() => assertExpectedReleaseId(release52, 'bronze-2026-08-24-r51')).toThrow(/hesaplanan=bronze-2026-08-24-r52/u);

    const allocator = readFileSync('scripts/allocate-monthly-release-version.mjs', 'utf8');
    expect(allocator.indexOf('assertExpectedReleaseId(previewRelease')).toBeLessThan(allocator.indexOf("open(lockPath, 'wx')"));
  });

  it('preallocated package identity rejects a wrong release ID before packaging', () => {
    const current = {
      channel: 'Bronze', date: '2026-08-24', displayDate: '24.08.2026', monthlySequence: 51,
      version: '24.08.2026.51', visibleRelease: 'Bronze 24.08.2026.51', packageVersion: '24.8.2026-51',
      releaseId: 'bronze-2026-08-24-r51'
    };
    const identity = {
      expectedReleaseId: 'bronze-2026-08-24-r50',
      ledger: { current, entries: [current] },
      rootManifest: { version: current.packageVersion },
      desktopManifest: {
        version: current.packageVersion,
        build: {
          artifactName: 'ParsYuva-Bronze-24.08.2026.51.${ext}',
          win: { artifactName: 'ParsYuva-Bronze-24.08.2026.51.${ext}' }
        }
      },
      repositoryMetadata: {
        repositoryVersion: current.version, applicationVersion: current.version,
        visibleRelease: current.visibleRelease, packageVersion: current.packageVersion, releaseId: current.releaseId
      },
      appMeta: `version: '${current.version}', packageVersion: '${current.packageVersion}', releaseLabel: '${current.visibleRelease}', releaseId: '${current.releaseId}', monthlySequence: 51`
    };
    expect(() => assertPreallocatedReleaseIdentity(identity)).toThrow(/release ID uyuşmazlığı/u);
  });

  it('active version sweep exact active carriers and historical evidence boundaries are explicit', () => {
    const sweep = readFileSync('scripts/verify-active-version-sweep.mjs', 'utf8');
    for (const marker of [
      'docs/current/00_AKTIF_ANA_KAPSAM.md',
      'docs/current/07_TESLIM_SOHBET_VE_KALICI_KAYIT_SOZLESMESI.md',
      'config/active-governance-ledger.json',
      'config/documentation-synchronization-policy.json',
      'docs/ticari-urun-temeli/00_TEMEL_SURUM_MANIFESTOSU.json'
    ]) expect(sweep).toContain(marker);
    expect(sweep).not.toContain('artifacts/validation/bronze-');
  });

  it('aktif rapor metadata değerlerinde tanımsız build veya milestone üretmez', () => {
    expect(ACTIVE_BUILD_META.build).toBe(Number(ACTIVE_BUILD_META.applicationVersion.split('.').at(-1)));
    expect(ACTIVE_BUILD_META.milestone).toContain(ACTIVE_BUILD_META.applicationVersion);
    expect(ACTIVE_BUILD_META.milestone).not.toMatch(/undefined|\bRC2?\b|\bMVP\b|\bBuild\b/iu);
  });
});
