import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { archiveLegacyOwnershipReattestationConfirmation } from '@ppt/domain';
import {
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy
} from '../src/main/ipc-integration-policy.js';
import {
  IpcRequestLifecycleRegistry,
  resolveIpcRequestAdmissionPolicy,
  resolveIpcRequestLifecyclePolicy,
  resolveIpcRequestRatePolicy
} from '../src/main/ipc-request-lifecycle.js';
import { createZeroIpcTransportRevisions } from '../src/main/ipc-transport-context.js';

const channel = 'archive:reattestLegacyOwnership';
const itemId = 'legacy-ownerless-archive-item';
const validInput = {
  itemId,
  password: 'Strong archive password 33-Q!',
  confirmation: archiveLegacyOwnershipReattestationConfirmation(itemId)
} as const;

describe('33-Q legacy archive ownership reattestation IPC and UI boundary', () => {
  it('accepts only the exact actor-bound strong-authentication input', () => {
    expect(evaluateIpcIntegrationPolicy(channel, [validInput])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy(channel, [{ ...validInput, code: '123456' }])).toEqual({ accepted: true });

    for (const input of [
      { ...validInput, confirmation: 'I accept' },
      { ...validInput, code: '12345' },
      { ...validInput, code: '12345x' },
      { ...validInput, ownerPersonId: 'person-forged' },
      { ...validInput, targetOwnerPersonId: 'person-forged' },
      { ...validInput, policyReceiptHash: 'a'.repeat(64) },
      { ...validInput, sourcePath: 'C:\\private\\archive.db' }
    ]) expect(evaluateIpcIntegrationPolicy(channel, [input])).toMatchObject({ accepted: false });
  });

  it('rejects inherited, accessor and prototype-key payload authority before dispatch', () => {
    const inherited = Object.assign(Object.create({ ownerPersonId: 'person-forged' }) as Record<string, unknown>, validInput);
    expect(evaluateIpcIntegrationPolicy(channel, [inherited])).toMatchObject({ accepted: false });

    const accessor = { ...validInput } as Record<string, unknown>;
    Object.defineProperty(accessor, 'password', { enumerable: true, get: () => validInput.password });
    expect(evaluateIpcIntegrationPolicy(channel, [accessor])).toMatchObject({ accepted: false });

    const prototypeKey = { ...validInput } as Record<string, unknown>;
    Object.defineProperty(prototypeKey, '__proto__', { enumerable: true, value: { ownerPersonId: 'person-forged' } });
    expect(evaluateIpcIntegrationPolicy(channel, [prototypeKey])).toMatchObject({ accepted: false });
  });

  it('returns only the safe ownership result and rejects leaked authority or credentials', () => {
    const result = { itemId, ownershipBinding: 'verified_actor', reattestedAt: '2026-08-14T18:30:00.000Z' } as const;
    expect(evaluateIpcIntegrationResultPolicy(channel, result)).toEqual({ accepted: true });
    for (const leaked of [
      { ...result, password: validInput.password },
      { ...result, ownerPersonId: 'person-main' },
      { ...result, receiptHash: 'a'.repeat(64) },
      { ...result, databasePath: 'C:\\private\\family.db' }
    ]) expect(evaluateIpcIntegrationResultPolicy(channel, leaked)).toMatchObject({ accepted: false });
  });

  it('is non-cancellable, serialized per channel and limited to six attempts per minute', async () => {
    expect(resolveIpcRequestLifecyclePolicy(channel)).toEqual({ cancellable: false, latestWins: false, timeoutMs: 0 });
    expect(resolveIpcRequestAdmissionPolicy(channel)).toEqual({
      enabled: true,
      priority: 'interactive',
      priorityWeight: 100,
      maxConcurrentPerSender: 2,
      maxConcurrentPerChannel: 1,
      maxQueuedPerSender: 4,
      queueTimeoutMs: 2_500
    });
    expect(resolveIpcRequestRatePolicy(channel)).toEqual({ enabled: true, maxRequestsPerWindow: 6, windowMs: 60_000 });

    let now = 10_000;
    const registry = new IpcRequestLifecycleRegistry({ now: () => now });
    const request = (index: number) => ({
      schemaVersion: 1 as const,
      rendererSessionId: '11111111-1111-4111-8111-111111111111',
      requestId: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
      sessionEpoch: 0,
      requestSequence: index,
      channel,
      revisions: createZeroIpcTransportRevisions()
    });
    for (let index = 1; index <= 6; index += 1) {
      const lease = await registry.acquire(33, request(index));
      lease.complete();
    }
    await expect(registry.acquire(33, request(7))).rejects.toMatchObject({
      name: 'IpcRequestAdmissionError', kind: 'rate-limit', channel
    });
    now += 60_001;
    const retry = await registry.acquire(33, request(7));
    retry.complete();
  });

  it('keeps owner selection and durable authority in main while clearing renderer secrets on every outcome', () => {
    const preload = readFileSync('apps/desktop/src/main/preload.ts', 'utf8');
    const main = readFileSync('apps/desktop/src/main/main.ts', 'utf8');
    const globalTypes = readFileSync('apps/desktop/src/renderer/global.d.ts', 'utf8');
    const app = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
    const archiveScreen = app.slice(app.indexOf('function ArchiveScreen('), app.indexOf("const FIRST_RUN_INTRO_KEY="));
    const panel = app.slice(app.indexOf("selected?.ownershipBinding==='legacy_unverified'"), app.indexOf('<LocalGovernedOcrPanel'));

    expect(preload).toContain("reattestLegacyArchiveOwnership:(input:ReattestLegacyArchiveOwnershipInput):Promise<LegacyArchiveOwnershipReattestationView>=>invoke('archive:reattestLegacyOwnership',input)");
    expect(main).toContain("registerIpcHandler('archive:reattestLegacyOwnership', (_event,input:ReattestLegacyArchiveOwnershipInput) => store().reattestLegacyArchiveOwnership(input))");
    expect(globalTypes).toContain('reattestLegacyArchiveOwnership(input:ReattestLegacyArchiveOwnershipInput):Promise<LegacyArchiveOwnershipReattestationView>');
    expect(panel).toContain('aria-label="Eski arşiv sahipliğini yeniden doğrulama"');
    expect(panel).toContain('type="password" autoComplete="current-password"');
    expect(panel).toContain('autoComplete="one-time-code"');
    expect(archiveScreen).toContain("finally{setReattestPassword('');setReattestCode('');setReattestConfirmation('');setBusy(false);}");
    expect(panel).toContain('reattestConfirmation!==archiveLegacyOwnershipReattestationConfirmation(selected.id)');
    expect(panel).not.toContain('ownerPersonId');
    expect(panel).not.toContain('targetOwnerPersonId');
  });
});
