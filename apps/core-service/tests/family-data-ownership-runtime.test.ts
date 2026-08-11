import { describe, expect, it, vi } from 'vitest';
import { CoreServiceFamilyDataOwnershipError, CoreServiceFamilyDataOwnershipRuntime } from '../src/family-data-ownership-runtime.js';

describe('31-H protected family-data session ownership runtime', () => {
  it('stays detached and path-private until a real session port is attached', () => {
    const runtime = new CoreServiceFamilyDataOwnershipRuntime(() => '2026-08-10T20:00:00.000Z');
    expect(runtime.status()).toEqual({
      schemaVersion: 1,
      owner: 'desktop-transition',
      lifecycle: 'detached',
      mode: 'none',
      writable: false,
      epoch: 0,
      protectedSessionAttached: false,
      persistentPathExposed: false,
      reasons: ['PROTECTED_SESSION_NOT_ATTACHED'],
      observedAt: '2026-08-10T20:00:00.000Z'
    });
  });

  it('moves ownership with monotonic epochs and seals the attached session', async () => {
    const close = vi.fn();
    const runtime = new CoreServiceFamilyDataOwnershipRuntime(() => '2026-08-10T20:00:00.000Z');
    expect(runtime.attach({ mode: 'read-write', close })).toMatchObject({
      owner: 'core-service', lifecycle: 'ready', mode: 'read-write', writable: true, epoch: 2,
      protectedSessionAttached: true, persistentPathExposed: false
    });
    expect(() => runtime.attach({ mode: 'read-only', close })).toThrow(CoreServiceFamilyDataOwnershipError);
    await expect(runtime.seal()).resolves.toMatchObject({
      owner: 'desktop-transition', lifecycle: 'sealed', mode: 'none', writable: false, epoch: 4,
      protectedSessionAttached: false, persistentPathExposed: false
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it('fails closed when the protected session cannot be sealed', async () => {
    const runtime = new CoreServiceFamilyDataOwnershipRuntime();
    runtime.attach({ mode: 'read-write', close: () => { throw new Error('close failed'); } });
    await expect(runtime.seal()).rejects.toMatchObject({ code: 'SESSION_CLOSE_FAILED' });
    expect(runtime.status()).toMatchObject({
      owner: 'desktop-transition', lifecycle: 'failed', mode: 'none', writable: false, epoch: 4,
      protectedSessionAttached: false, persistentPathExposed: false
    });
  });
});
