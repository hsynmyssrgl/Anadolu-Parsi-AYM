import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CORE_SERVICE_COMPANION_BOOTSTRAP_KIND,
  CORE_SERVICE_COMPANION_FAILURE_KIND,
  CORE_SERVICE_COMPANION_READY_KIND,
  CORE_SERVICE_DEFAULT_POLICY_VERSION
} from '@ppt/core-service-contracts';
import {
  CoreServiceCompanionManager,
  type CoreServiceCompanionForkOptions,
  type CoreServiceCompanionProcessLike,
  type CoreServiceCompanionProtectedStore
} from '../src/main/core-service-companion-manager.js';

class MemoryProtectedStore implements CoreServiceCompanionProtectedStore {
  readonly values = new Map<string, string>();

  public readText(path: string): string {
    const value = this.values.get(path);
    if (value === undefined) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    return value;
  }

  public writeText(path: string, _kind: string, text: string) {
    this.values.set(path, text);
    return Object.freeze({
      filePath: path,
      sha256: createHash('sha256').update(text).digest('hex'),
      sizeBytes: Buffer.byteLength(text)
    });
  }
}

class FakeUtilityProcess extends EventEmitter implements CoreServiceCompanionProcessLike {
  public readonly pid = 7421;
  public killed = false;
  public bootstrap: unknown;

  public constructor(private readonly response: 'ready' | 'failure' = 'ready') {
    super();
    queueMicrotask(() => this.emit('spawn'));
  }

  public override on(event: 'spawn' | 'message' | 'exit' | 'error', listener: (...args: never[]) => void): this {
    return super.on(event, listener);
  }

  public postMessage(message: unknown): void {
    if (message && typeof message === 'object' && (message as { kind?: unknown }).kind === CORE_SERVICE_COMPANION_BOOTSTRAP_KIND) {
      this.bootstrap = message;
      queueMicrotask(() => this.emit('message', this.response === 'ready'
        ? Object.freeze({
            schemaVersion: 1,
            kind: CORE_SERVICE_COMPANION_READY_KIND,
            lifecycle: 'ready',
            policyVersion: CORE_SERVICE_DEFAULT_POLICY_VERSION,
            writable: true,
            safeMode: false
          })
        : Object.freeze({ schemaVersion: 1, kind: CORE_SERVICE_COMPANION_FAILURE_KIND, code: 'START_FAILED' }))
      );
    }
  }

  public kill(): boolean {
    this.killed = true;
    return true;
  }
}

const paths = Object.freeze({
  modulePath: 'C:\\Program Files\\PPT\\AYM\\resources\\app.asar\\dist\\core-service\\companion.js',
  authorityPath: 'C:\\Users\\Owner\\AppData\\Roaming\\AYM\\secrets\\core-service-connection.pptsecret',
  provisioningPath: 'C:\\Users\\Owner\\AppData\\Roaming\\AYM\\secrets\\core-service-device-provisioning.pptsecret',
  policyJournalAuthorityPath: 'C:\\Users\\Owner\\AppData\\Roaming\\AYM\\data\\core-service-policy-journal-authority.json'
});

const createManager = (
  store: MemoryProtectedStore,
  child: FakeUtilityProcess,
  capture: { options?: CoreServiceCompanionForkOptions }
) => new CoreServiceCompanionManager({
  ...paths,
  protectedStore: store,
  platform: 'win32',
  clock: () => '2026-08-17T10:00:00.000Z',
  fork: (_modulePath, options) => {
    capture.options = options;
    return child;
  }
});

describe('Core Service companion manager', () => {
  it('persists a DPAPI-side-artifact provisioning key, rotates connection authority and starts the child without secret environment values', async () => {
    const store = new MemoryProtectedStore();
    const firstChild = new FakeUtilityProcess();
    const firstCapture: { options?: CoreServiceCompanionForkOptions } = {};
    const first = createManager(store, firstChild, firstCapture);
    const firstResult = await first.start();
    const firstAuthority = store.readText(paths.authorityPath);
    const provisioning = store.readText(paths.provisioningPath);

    expect(firstResult).toEqual({ authorityPath: paths.authorityPath, pid: 7421 });
    expect(firstCapture.options?.env).toEqual(expect.objectContaining({ PPT_CORE_SERVICE_COMPANION: '1' }));
    expect(JSON.stringify(firstCapture.options?.env)).not.toContain('authenticationToken');
    expect(JSON.stringify(firstCapture.options?.env)).not.toContain('policySigningKey');
    expect(JSON.stringify(firstChild.bootstrap)).not.toContain(paths.provisioningPath);

    first.dispose();
    const secondChild = new FakeUtilityProcess();
    const second = createManager(store, secondChild, {});
    await second.start();
    expect(store.readText(paths.provisioningPath)).toBe(provisioning);
    expect(store.readText(paths.authorityPath)).not.toBe(firstAuthority);
    second.dispose();
  });

  it('fails closed on tampered persistent provisioning instead of silently rotating the policy authority', async () => {
    const store = new MemoryProtectedStore();
    store.values.set(paths.provisioningPath, JSON.stringify({
      schemaVersion: 1,
      kind: 'core-service-device-provisioning',
      policySigningKeyBase64Url: 'tampered',
      createdAt: '2026-08-17T10:00:00.000Z'
    }));
    const child = new FakeUtilityProcess();
    await expect(createManager(store, child, {}).start()).rejects.toThrow('CORE_SERVICE_PROVISIONING_INVALID');
    expect(child.bootstrap).toBeUndefined();
  });

  it('kills the child and rejects startup when the companion reports a content-free failure', async () => {
    const store = new MemoryProtectedStore();
    const child = new FakeUtilityProcess('failure');
    await expect(createManager(store, child, {}).start()).rejects.toThrow('CORE_SERVICE_COMPANION_REJECTED:START_FAILED');
    expect(child.killed).toBe(true);
    expect(JSON.stringify(child.bootstrap)).not.toContain(join(paths.provisioningPath, 'secret'));
  });
});
