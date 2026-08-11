
import { describe, expect, it } from 'vitest';
import {
  ERROR_CODES,
  FixedClock,
  asCorrelationId,
  asIsoDateTime,
  createAppError,
  err,
  flatMapResult,
  fromThrowable,
  mapError,
  mapResult,
  matchResult,
  normalizePageRequest,
  ok
} from '../src/index.js';

describe('@ppt/core Result modeli', () => {
  it('başarılı değeri taşır ve dönüştürür', () => {
    const result = mapResult(ok(4), (value) => value * 2);
    expect(result).toEqual({ ok: true, value: 8 });
  });

  it('hata sonucunda değer dönüştürücüyü çalıştırmaz', () => {
    const result = mapResult(err('problem'), () => 99);
    expect(result).toEqual({ ok: false, error: 'problem' });
  });

  it('hata türünü dönüştürür', () => {
    const result = mapError(err('problem'), (error) => ({ message: error }));
    expect(result).toEqual({ ok: false, error: { message: 'problem' } });
  });

  it('ardışık Result işlemlerini kısa devre yapar', () => {
    const success = flatMapResult(ok(5), (value) => ok(value + 1));
    const failure = flatMapResult(err('stop'), () => ok(10));
    expect(success).toEqual({ ok: true, value: 6 });
    expect(failure).toEqual({ ok: false, error: 'stop' });
  });

  it('yakalanan exception değerini Result hatasına çevirir', () => {
    const result = fromThrowable(
      () => JSON.parse('{'),
      (error) => error instanceof Error ? error.name : 'Unknown'
    );
    expect(result).toEqual({ ok: false, error: 'SyntaxError' });
  });

  it('match ile tek bir çıktı üretir', () => {
    expect(matchResult(ok('aile'), { ok: (value) => value.length, err: () => 0 })).toBe(4);
  });
});

describe('@ppt/core temel tipleri', () => {
  it('merkezi AppError üretir', () => {
    const error = createAppError({
      code: ERROR_CODES.CORE_INVALID_ARGUMENT,
      message: 'Geçersiz değer.',
      category: 'validation',
      correlationId: asCorrelationId('cor-1'),
      details: { field: 'name' }
    });
    expect(error.retryable).toBe(false);
    expect(error.details).toEqual({ field: 'name' });
  });

  it('sabit saat ile deterministik zaman verir', () => {
    const time = asIsoDateTime('2026-07-23T12:00:00.000Z');
    expect(new FixedClock(time).now()).toBe(time);
  });

  it('sayfalama değerlerini güvenli sınırlara getirir', () => {
    expect(normalizePageRequest({ limit: 1000, offset: -4 })).toEqual({ limit: 500, offset: 0 });
  });
});
