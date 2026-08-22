import { describe, expect, it } from 'vitest';
import { ERROR_CODES, asCorrelationId, createAppError } from '@ppt/core';
import { resolveIpcRequestLifecyclePolicy } from '../src/main/ipc-request-lifecycle.js';
import { toIpcRendererError } from '../src/main/ipc-runtime.js';

describe('IPC katalog eşzamanlılığı ve hata taşıma sözleşmesi', () => {
  it('aynı ekrandaki katalog seçicilerinin birbirini iptal etmesine izin vermez', () => {
    expect(resolveIpcRequestLifecyclePolicy('catalog:listPeople')).toEqual({
      cancellable: true,
      latestWins: false,
      timeoutMs: 30_000
    });
    expect(resolveIpcRequestLifecyclePolicy('catalog:listEvents').latestWins).toBe(false);
    expect(resolveIpcRequestLifecyclePolicy('catalog:lookup').latestWins).toBe(false);
  });

  it('ilk yükleme sürerken yerel model durumu yenilendiğinde isteği iptal etmez', () => {
    expect(resolveIpcRequestLifecyclePolicy('familyAiAssistant:getLocalModelStatus')).toEqual({
      cancellable: true,
      latestWins: false,
      timeoutMs: 10_000
    });
    expect(resolveIpcRequestLifecyclePolicy('memoryStudio:getCenter').latestWins).toBe(false);
    expect(resolveIpcRequestLifecyclePolicy('data-repair:workspace').latestWins).toBe(false);
  });

  it('AppError nesnesini Electron tarafında okunabilir gerçek Error olarak taşır', () => {
    const transported = toIpcRendererError(createAppError({
      code: ERROR_CODES.CORE_INVALID_ARGUMENT,
      message: 'İstek bağlamı geçersiz.',
      category: 'validation',
      correlationId: asCorrelationId('ipc-error-transport-test')
    }));

    expect(transported).toBeInstanceOf(Error);
    expect(transported.name).toBe('AppError');
    expect(transported.message).toBe(`[${ERROR_CODES.CORE_INVALID_ARGUMENT}] İstek bağlamı geçersiz.`);
    expect(String(transported)).not.toContain('[object Object]');
  });

  it('güvenli taşıma tanısını AppError ayrıntısından okunabilir biçimde aktarır', () => {
    const transported = toIpcRendererError(createAppError({
      code: ERROR_CODES.CORE_INVALID_ARGUMENT,
      message: 'IPC taşıma bağlamı geçersiz.',
      category: 'validation',
      correlationId: asCorrelationId('ipc-error-diagnostic-test'),
      details: { reason: 'INVALID_REQUEST_CONTEXT', protocolMessage: 'İstek bağlamı nesnesi eksik.' }
    }));

    expect(transported.message).toContain('INVALID_REQUEST_CONTEXT');
    expect(transported.message).toContain('İstek bağlamı nesnesi eksik.');
  });
});
