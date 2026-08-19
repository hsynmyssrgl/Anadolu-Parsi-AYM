import { describe, expect, it } from 'vitest';
import { createNextMonthlyRelease, installerArtifactTemplate, installerFileName } from '../../../scripts/lib/monthly-release-version.mjs';

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
    expect(installerArtifactTemplate(release)).toBe('ParsYuva-AYM-Silver-18.08.2026.30-${arch}-Kurulum.${ext}');
    expect(installerFileName(release)).toBe('ParsYuva-AYM-Silver-18.08.2026.30-x64-Kurulum.exe');
  });

  it('tanımsız sürüm kanalını reddeder', () => {
    expect(() => createNextMonthlyRelease({ ledger, channel: 'Platinum' })).toThrow(/Desteklenmeyen/u);
  });
});
