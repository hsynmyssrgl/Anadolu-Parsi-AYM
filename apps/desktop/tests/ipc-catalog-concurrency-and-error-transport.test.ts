import { describe, expect, it } from 'vitest';
import { ERROR_CODES, asCorrelationId, createAppError } from '@ppt/core';
import { resolveIpcRequestLifecyclePolicy } from '../src/main/ipc-request-lifecycle.js';
import { toIpcRendererError } from '../src/main/ipc-runtime.js';
import {
  IPC_TRANSPORT_SCHEMA_VERSION,
  assertIpcTransportRequestContext,
  createZeroIpcTransportRevisions
} from '../src/main/ipc-transport-context.js';

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
      timeoutMs: 30_000
    });
    expect(resolveIpcRequestLifecyclePolicy('memoryStudio:getCenter').latestWins).toBe(false);
    expect(resolveIpcRequestLifecyclePolicy('data-repair:workspace').latestWins).toBe(false);
    expect(resolveIpcRequestLifecyclePolicy('offlineCapability:getWorkspace').timeoutMs).toBe(30_000);
  });

  it('düzgün tireli kanal adını kabul ederken bozuk tire kullanımını reddeder', () => {
    const request = {
      schemaVersion: IPC_TRANSPORT_SCHEMA_VERSION,
      rendererSessionId: '00000000-0000-4000-8000-000000000001',
      requestId: '00000000-0000-4000-8000-000000000002',
      sessionEpoch: 1,
      requestSequence: 1,
      channel: 'data-repair:workspace',
      revisions: createZeroIpcTransportRevisions()
    } as const;

    expect(assertIpcTransportRequestContext(request, request.channel).channel).toBe(request.channel);
    for (const channel of ['-data:workspace', 'data-:workspace', 'data--repair:workspace', 'data:work-']) {
      expect(() => assertIpcTransportRequestContext({ ...request, channel }, channel)).toThrow('IPC kanal adı geçersiz.');
    }
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
