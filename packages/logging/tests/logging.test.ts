
import { describe, expect, it } from 'vitest';
import { asCorrelationId, asIsoDateTime } from '@ppt/core';
import { MemoryLogger, serializeLogEvent } from '../src/index.js';

describe('@ppt/logging', () => {
  it('hassas metadata alanlarını redact eder', () => {
    const logger = new MemoryLogger();
    logger.info({
      timestamp: asIsoDateTime('2026-07-23T12:00:00.000Z'),
      service: 'test',
      process: 'unit',
      event: 'auth.completed',
      correlationId: asCorrelationId('cor-1'),
      metadata: { password: 'secret', nested: { totpSecret: 'ABC', safe: 2 } }
    });
    expect(logger.events[0]?.metadata).toEqual({
      password: '<redacted>',
      nested: { totpSecret: '<redacted>', safe: 2 }
    });
  });

  it('JSON Lines için tek satırlık structured kayıt üretir', () => {
    const value = serializeLogEvent({
      timestamp: asIsoDateTime('2026-07-23T12:00:00.000Z'),
      level: 'info',
      service: 'desktop-main',
      process: 'electron-main',
      event: 'startup.completed',
      correlationId: asCorrelationId('cor-2')
    });
    expect(value).not.toContain('\n');
    expect(JSON.parse(value).event).toBe('startup.completed');
  });
});
