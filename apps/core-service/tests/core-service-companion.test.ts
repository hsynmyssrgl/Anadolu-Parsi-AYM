import { randomBytes } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CORE_SERVICE_COMPANION_BOOTSTRAP_KIND,
  CORE_SERVICE_COMPANION_READY_KIND,
  CORE_SERVICE_COMPANION_SHUTDOWN_KIND,
  CORE_SERVICE_DEFAULT_POLICY_VERSION
} from '@ppt/core-service-contracts';
import {
  CoreServiceCompanionProcess,
  parseCoreServiceCompanionBootstrap,
  type CoreServiceCompanionParentPort
} from '../src/companion.js';

const roots: string[] = [];

class FakeParentPort implements CoreServiceCompanionParentPort {
  readonly messages: unknown[] = [];
  #listener: ((event: { readonly data: unknown }) => void) | undefined;

  public on(_event: 'message', listener: (event: { readonly data: unknown }) => void): this {
    this.#listener = listener;
    return this;
  }

  public postMessage(message: unknown): void {
    this.messages.push(message);
  }

  public send(data: unknown): void {
    this.#listener?.({ data });
  }
}

const waitFor = async (predicate: () => boolean, timeoutMs = 2_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('test timeout');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

const fixture = () => {
  const root = join(tmpdir(), `ppt-core-companion-${randomBytes(8).toString('hex')}`);
  roots.push(root);
  return Object.freeze({
    schemaVersion: 1 as const,
    kind: CORE_SERVICE_COMPANION_BOOTSTRAP_KIND,
    configuration: Object.freeze({
      localAdminEndpoint: `\\\\.\\pipe\\ppt-core-service-${randomBytes(12).toString('hex')}`,
      localAdminToken: randomBytes(48).toString('base64url'),
      policySigningKey: new Uint8Array(randomBytes(32)),
      policyVersion: CORE_SERVICE_DEFAULT_POLICY_VERSION,
      policyJournalAuthorityPath: join(root, 'policy-journal-authority.json')
    })
  });
};

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  process.exitCode = undefined;
});

describe('Core Service companion process', () => {
  it('accepts an exact bounded Windows bootstrap and starts the real local service host', async () => {
    const port = new FakeParentPort();
    new CoreServiceCompanionProcess(port, 'win32');
    port.send(fixture());
    await waitFor(() => port.messages.some((message) =>
      Boolean(message && typeof message === 'object' && (message as { kind?: unknown }).kind === CORE_SERVICE_COMPANION_READY_KIND)
    ));
    expect(port.messages).toContainEqual(expect.objectContaining({
      schemaVersion: 1,
      kind: CORE_SERVICE_COMPANION_READY_KIND,
      lifecycle: 'ready',
      policyVersion: CORE_SERVICE_DEFAULT_POLICY_VERSION
    }));
    port.send({ schemaVersion: 1, kind: CORE_SERVICE_COMPANION_SHUTDOWN_KIND });
    await waitFor(() => process.exitCode === 0);
  });

  it('rejects remote pipes, extra fields and malformed key material fail-closed', () => {
    const valid = fixture();
    expect(() => parseCoreServiceCompanionBootstrap({
      ...valid,
      configuration: { ...valid.configuration, localAdminEndpoint: '\\\\remote\\pipe\\ppt-core-service-test' }
    }, 'win32')).toThrow('CORE_SERVICE_COMPANION_BOOTSTRAP_INVALID');
    expect(() => parseCoreServiceCompanionBootstrap({ ...valid, extra: true }, 'win32'))
      .toThrow('CORE_SERVICE_COMPANION_BOOTSTRAP_INVALID');
    expect(() => parseCoreServiceCompanionBootstrap({
      ...valid,
      configuration: { ...valid.configuration, policySigningKey: new Uint8Array(31) }
    }, 'win32')).toThrow('CORE_SERVICE_COMPANION_BOOTSTRAP_INVALID');
  });

  it('rejects a second bootstrap message and never exposes secret material in its failure response', async () => {
    const port = new FakeParentPort();
    new CoreServiceCompanionProcess(port, 'win32');
    const bootstrap = fixture();
    port.send(bootstrap);
    await waitFor(() => port.messages.some((message) =>
      Boolean(message && typeof message === 'object' && (message as { kind?: unknown }).kind === CORE_SERVICE_COMPANION_READY_KIND)
    ));
    port.send(bootstrap);
    await waitFor(() => port.messages.length >= 2);
    expect(JSON.stringify(port.messages)).not.toContain(bootstrap.configuration.localAdminToken);
    expect(JSON.stringify(port.messages)).not.toContain(Buffer.from(bootstrap.configuration.policySigningKey).toString('base64url'));
  });
});
