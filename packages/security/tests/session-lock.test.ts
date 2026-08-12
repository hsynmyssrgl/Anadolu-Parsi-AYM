import { describe, expect, it } from 'vitest';
import { asIsoDateTime } from '@ppt/core';
import { InMemorySessionManager } from '../src/session.js';

const mutableClock = (initial: string) => {
  let current = initial;
  return {
    clock: { now: () => asIsoDateTime(current) },
    set: (value: string) => { current = value; }
  };
};

describe('B2-03 idle session lock', () => {
  it('warns for the final minute and locks without clearing the protected session identity', () => {
    const time = mutableClock('2026-08-12T10:00:00.000Z');
    const manager = new InMemorySessionManager(time.clock, 15, 60);
    manager.start('account-1', 7);

    time.set('2026-08-12T10:13:59.000Z');
    expect(manager.snapshot()).toMatchObject({ status: 'active', active: true, secondsRemaining: 61 });

    time.set('2026-08-12T10:14:00.000Z');
    expect(manager.snapshot()).toMatchObject({ status: 'warning', active: true, secondsRemaining: 60 });

    time.set('2026-08-12T10:15:00.000Z');
    expect(manager.snapshot()).toMatchObject({
      status: 'locked',
      active: false,
      accountId: 'account-1',
      securityEpoch: 7,
      lockReason: 'idle_timeout',
      lockedAt: '2026-08-12T10:15:00.000Z'
    });
    expect(manager.currentAccountId({ touch: false })).toBeUndefined();
  });

  it('extends expiry only through explicit renderer activity and keeps passive snapshots read-only', () => {
    const time = mutableClock('2026-08-12T10:00:00.000Z');
    const manager = new InMemorySessionManager(time.clock, 15, 60);
    manager.start('account-1');
    time.set('2026-08-12T10:10:00.000Z');
    manager.snapshot();
    expect(manager.snapshot().expiresAt).toBe('2026-08-12T10:15:00.000Z');

    manager.recordActivity();
    expect(manager.snapshot().expiresAt).toBe('2026-08-12T10:25:00.000Z');
    time.set('2026-08-12T10:24:00.000Z');
    expect(manager.snapshot().status).toBe('warning');
  });

  it('supports idempotent manual locking and rejects unsafe warning policies', () => {
    const time = mutableClock('2026-08-12T10:00:00.000Z');
    const manager = new InMemorySessionManager(time.clock, 15, 60);
    manager.start('account-1');
    const first = manager.lock('manual');
    const second = manager.lock('manual');
    expect(first).toMatchObject({ status: 'locked', lockReason: 'manual', lockedAt: '2026-08-12T10:00:00.000Z' });
    expect(second.lockedAt).toBe(first.lockedAt);
    expect(() => new InMemorySessionManager(time.clock, 1, 60)).toThrow(/uyarı süresi/iu);
  });
});
