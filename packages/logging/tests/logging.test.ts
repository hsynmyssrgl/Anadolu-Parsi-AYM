import { describe, expect, it } from 'vitest';
import { asCorrelationId, asIsoDateTime } from '@ppt/core';
import {
  MemoryLogger,
  SensitiveLogPolicyViolation,
  serializeLogEvent
} from '../src/index.js';

const baseEvent = () => ({
  timestamp: asIsoDateTime('2026-08-12T00:00:00.000Z'),
  service: 'test',
  process: 'unit',
  event: 'logging.completed',
  correlationId: asCorrelationId('cor-1')
});

describe('@ppt/logging PPK-017 content-free boundary', () => {
  it('yalnız kimlik, hash, sonuç, sayaç ve zaman metadata sınıflarını kabul eder', () => {
    const logger = new MemoryLogger();
    logger.info({
      ...baseEvent(),
      outcome: 'success',
      metadata: {
        eventId: 'evt-1',
        headHash: 'a'.repeat(64),
        status: 'completed',
        successfulHandlers: 3,
        safetyBackupCreated: true,
        checkedAt: '2026-08-12T00:00:00.000Z',
        appliedVersions: [76, 77]
      }
    });
    expect(logger.events).toHaveLength(1);
    expect(logger.rejections).toHaveLength(0);
    expect(logger.events[0]?.metadata).toEqual({
      eventId: 'evt-1',
      headHash: 'a'.repeat(64),
      status: 'completed',
      successfulHandlers: 3,
      safetyBackupCreated: true,
      checkedAt: '2026-08-12T00:00:00.000Z',
      appliedVersions: [76, 77]
    });
  });

  it.each([
    ['password', { password: 'never-log' }],
    ['payload', { payload: 'OCR gizli metni' }],
    ['message', { message: 'sağlık kaydı metni' }],
    ['path', { filePath: 'C:\\secret\\document.pdf' }],
    ['stack', { stack: 'Error: secret' }],
    ['nested', { result: { content: 'secret' } }],
    ['masqueraded identifier', { familyId: 'OCR gizli metni boşluklu içerik' }]
  ])('%s metadata girişini kaydetmeden fail-closed reddeder', (_name, metadata) => {
    const logger = new MemoryLogger();
    logger.warn({ ...baseEvent(), metadata });
    expect(logger.events).toHaveLength(0);
    expect(logger.rejections).toHaveLength(1);
    expect(logger.rejections[0]?.code).toBe('SENSITIVE_LOG_POLICY_REJECTED');
  });

  it('JSON Lines için yalnız tek satırlık içeriksiz kayıt üretir', () => {
    const value = serializeLogEvent({
      ...baseEvent(),
      level: 'info',
      metadata: { eventId: 'evt-2', result: 'allowed' }
    });
    expect(value).not.toContain('\n');
    expect(JSON.parse(value)).toMatchObject({
      event: 'logging.completed',
      metadata: { eventId: 'evt-2', result: 'allowed' }
    });
  });

  it('serializer hassas metadata için çıktı üretmez', () => {
    expect(() => serializeLogEvent({
      ...baseEvent(),
      level: 'error',
      metadata: { details: 'ocr transcript payload' }
    })).toThrow(SensitiveLogPolicyViolation);
  });
});
