import { describe, expect, it } from 'vitest';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';
import {
  IpcRequestLifecycleRegistry,
  resolveIpcRequestAdmissionPolicy,
  resolveIpcRequestLifecyclePolicy,
  resolveIpcRequestRatePolicy
} from '../src/main/ipc-request-lifecycle.js';
import { createZeroIpcTransportRevisions } from '../src/main/ipc-transport-context.js';

const validSave = {
  formKey: 'profile.intake',
  expectedRevision: 0,
  clientOperationId: 'form-draft-operation-0001',
  payload: { name: 'Ada', answers: [{ question: 'city', answer: 'Ankara' }] }
} as const;

const validUndo = {
  formKey: 'profile.intake',
  expectedRevision: 2,
  clientOperationId: 'form-draft-undo-0001'
} as const;

describe('33-N form draft IPC boundary', () => {
  it('accepts only the exact workspace, save and undo contracts', () => {
    expect(evaluateIpcIntegrationPolicy('formDraft:getWorkspace', ['profile.intake'])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('formDraft:save', [validSave])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('formDraft:undo', [validUndo])).toEqual({ accepted: true });

    expect(evaluateIpcIntegrationPolicy('formDraft:getWorkspace', ['profile.intake', 'extra']))
      .toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('formDraft:get', ['profile.intake']))
      .toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('formDraft:save', [{ ...validSave, futureField: true }]))
      .toMatchObject({ accepted: false, reason: 'FORM_DRAFT_ARGUMENT_INVALID' });
    expect(evaluateIpcIntegrationPolicy('formDraft:undo', [{ ...validUndo, payload: {} }]))
      .toMatchObject({ accepted: false, reason: 'UNKNOWN_OBJECT_FIELD' });
  });

  it('rejects stale, negative, fractional and out-of-range revisions', () => {
    for (const expectedRevision of [-1, 0.5, 2_147_483_647]) {
      expect(evaluateIpcIntegrationPolicy('formDraft:save', [{ ...validSave, expectedRevision }]))
        .toMatchObject({ accepted: false });
    }
    for (const expectedRevision of [-1, 0, 1, 2.5, 2_147_483_647]) {
      expect(evaluateIpcIntegrationPolicy('formDraft:undo', [{ ...validUndo, expectedRevision }]))
        .toMatchObject({ accepted: false });
    }
  });

  it.each(['cvv', 'cardNumber', 'internetBankingPassword'])(
    'rejects a nested prohibited banking secret field named %s',
    (field) => {
      expect(evaluateIpcIntegrationPolicy('formDraft:save', [{
        ...validSave,
        payload: { safe: { rows: [{ profile: { [field]: 'secret' } }] } }
      }])).toMatchObject({ accepted: false, reason: 'BANKING_SECRET_FIELD_PROHIBITED' });
    }
  );

  it('rejects oversized payloads and excessive nesting', () => {
    expect(evaluateIpcIntegrationPolicy('formDraft:save', [{
      ...validSave, payload: { note: 'x'.repeat(65_537) }
    }])).toMatchObject({ accepted: false, reason: 'FORM_DRAFT_PAYLOAD_TOO_LARGE' });

    let nested: Record<string, unknown> = { value: true };
    for (let depth = 0; depth < 34; depth += 1) nested = { nested };
    expect(evaluateIpcIntegrationPolicy('formDraft:save', [{ ...validSave, payload: nested }]))
      .toMatchObject({ accepted: false });
  });

  it('rejects objects with a forged prototype before dispatch', () => {
    const inherited = Object.assign(Object.create({ cvv: '123' }) as Record<string, unknown>, validSave);
    expect(evaluateIpcIntegrationPolicy('formDraft:save', [inherited]))
      .toMatchObject({ accepted: false });
  });

  it('fails closed for an unknown IPC channel', () => {
    expect(evaluateIpcIntegrationPolicy('formDraft:replaceAll', [validSave]))
      .toMatchObject({ accepted: false });
  });

  it('applies bounded lifecycle admission and adaptive-budget inputs to every draft channel', () => {
    for (const channel of ['formDraft:getWorkspace', 'formDraft:save', 'formDraft:undo']) {
      expect(resolveIpcRequestAdmissionPolicy(channel)).toMatchObject({
        enabled: true, maxConcurrentPerSender: 2, maxConcurrentPerChannel: 1,
        maxQueuedPerSender: 4, queueTimeoutMs: 2_500
      });
      expect(resolveIpcRequestRatePolicy(channel)).toMatchObject({ enabled: true, windowMs: 60_000 });
    }
    expect(resolveIpcRequestLifecyclePolicy('formDraft:get')).toMatchObject({ cancellable: false, latestWins: false });
    expect(resolveIpcRequestLifecyclePolicy('formDraft:getWorkspace')).toMatchObject({ cancellable: true, latestWins: true });
    expect(resolveIpcRequestLifecyclePolicy('formDraft:save')).toMatchObject({ cancellable: false, latestWins: false });
    expect(resolveIpcRequestLifecyclePolicy('formDraft:undo')).toMatchObject({ cancellable: false, latestWins: false });
  });

  it('fails closed when the draft write rate budget is exhausted and admits retry after reset', async () => {
    let now = 10_000;
    const registry = new IpcRequestLifecycleRegistry({ now: () => now });
    const request = (index: number) => ({
      schemaVersion: 1 as const,
      rendererSessionId: '11111111-1111-4111-8111-111111111111',
      requestId: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
      sessionEpoch: 0,
      requestSequence: index,
      channel: 'formDraft:save',
      revisions: createZeroIpcTransportRevisions()
    });
    for (let index = 1; index <= 32; index += 1) {
      const lease = await registry.acquire(7, request(index));
      lease.complete();
    }
    await expect(registry.acquire(7, request(33))).rejects.toMatchObject({
      name: 'IpcRequestAdmissionError', kind: 'rate-limit', channel: 'formDraft:save'
    });
    now += 60_001;
    const retry = await registry.acquire(7, request(33));
    expect(retry.admission.queued).toBe(false);
    retry.complete();
  });
});
