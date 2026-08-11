import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import assert from 'node:assert/strict';
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
} from '../packages/core/dist/index.js';
import { createDefaultConfig, redactConfig, validateConfig } from '../packages/config/dist/index.js';
import { MemoryLogger, serializeLogEvent } from '../packages/logging/dist/index.js';

const checks = [];
const verify = (name, operation) => {
  operation();
  checks.push(name);
};

verify('Result success mapping', () => {
  assert.deepEqual(mapResult(ok(4), (value) => value * 2), { ok: true, value: 8 });
});
verify('Result error short-circuit', () => {
  assert.deepEqual(mapResult(err('problem'), () => 99), { ok: false, error: 'problem' });
});
verify('Result error mapping', () => {
  assert.deepEqual(mapError(err('problem'), (error) => ({ message: error })), { ok: false, error: { message: 'problem' } });
});
verify('Result flatMap', () => {
  assert.deepEqual(flatMapResult(ok(5), (value) => ok(value + 1)), { ok: true, value: 6 });
});
verify('Throwable mapping', () => {
  const result = fromThrowable(() => JSON.parse('{'), (error) => error instanceof Error ? error.name : 'Unknown');
  assert.deepEqual(result, { ok: false, error: 'SyntaxError' });
});
verify('Result matching', () => {
  assert.equal(matchResult(ok('aile'), { ok: (value) => value.length, err: () => 0 }), 4);
});
verify('Central AppError', () => {
  const error = createAppError({
    code: ERROR_CODES.CORE_INVALID_ARGUMENT,
    message: 'Geçersiz değer.',
    category: 'validation',
    correlationId: asCorrelationId('cor-1'),
    details: { field: 'name' }
  });
  assert.equal(error.retryable, false);
  assert.deepEqual(error.details, { field: 'name' });
});
verify('Deterministic clock', () => {
  const time = asIsoDateTime('2026-07-23T12:00:00.000Z');
  assert.equal(new FixedClock(time).now(), time);
});
verify('Pagination limits', () => {
  assert.deepEqual(normalizePageRequest({ limit: 1000, offset: -4 }), { limit: 500, offset: 0 });
});

const paths = {
  data: 'C:/PPT/data', archive: 'C:/PPT/archive', cache: 'C:/PPT/cache', logs: 'C:/PPT/logs', temp: 'C:/PPT/temp'
};
verify('Configuration defaults and validation', () => {
  const config = createDefaultConfig({ version: ACTIVE_BUILD_META.applicationVersion, environment: 'development', paths });
  assert.equal(config.app.channel, 'bronze');
  assert.equal(config.database.journalMode, 'WAL');
  assert.equal(validateConfig(config).ok, true);
});
verify('Configuration path isolation', () => {
  const config = createDefaultConfig({ version: ACTIVE_BUILD_META.applicationVersion, environment: 'test', paths: { ...paths, cache: paths.data } });
  assert.equal(validateConfig(config).ok, false);
});
verify('Configuration redaction', () => {
  const config = createDefaultConfig({ version: ACTIVE_BUILD_META.applicationVersion, environment: 'production', paths });
  assert.deepEqual(redactConfig(config).paths, {
    data: '<configured>', archive: '<configured>', cache: '<configured>', logs: '<configured>', temp: '<configured>'
  });
});
verify('Structured logging fail-closed content boundary', () => {
  const logger = new MemoryLogger();
  logger.info({
    timestamp: asIsoDateTime('2026-07-23T12:00:00.000Z'),
    service: 'test', process: 'unit', event: 'auth.completed', correlationId: asCorrelationId('cor-2'),
    metadata: { password: 'secret', nested: { totpSecret: 'ABC', safe: 2 } }
  });
  assert.equal(logger.events.length, 0);
  assert.equal(logger.rejections.length, 1);
  assert.equal(logger.rejections[0].code, 'SENSITIVE_LOG_POLICY_REJECTED');
});
verify('JSON Lines serialization', () => {
  const value = serializeLogEvent({
    timestamp: asIsoDateTime('2026-07-23T12:00:00.000Z'), level: 'info', service: 'desktop-main',
    process: 'electron-main', event: 'startup.completed', correlationId: asCorrelationId('cor-3')
  });
  assert.equal(value.includes('\n'), false);
  assert.equal(JSON.parse(value).event, 'startup.completed');
});

console.log(JSON.stringify({ status: 'passed', checks: checks.length, names: checks }, null, 2));
