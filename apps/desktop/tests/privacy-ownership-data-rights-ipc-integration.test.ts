import { describe, expect, it } from 'vitest';
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
import { evaluateIpcPayloadSecurity } from '../src/main/ipc-payload-security.js';
import { createZeroIpcTransportRevisions } from '../src/main/ipc-transport-context.js';

const operation = { expectedRevision: 0, clientOperationId: 'operation-0001' } as const;
const recordId = 'memory-record-0001';
const occurredAt = '2026-08-14T01:00:00.000Z';
const channels = [
  'privacyOwnership:getCenter', 'privacyOwnership:correctAiMemory', 'privacyOwnership:restrictAiMemory',
  'privacyOwnership:deleteAiMemory', 'privacyOwnership:expireAiMemory', 'privacyOwnership:createRightsRequest',
  'privacyOwnership:updateRightsRequest', 'privacyOwnership:createIncident', 'privacyOwnership:updateIncident',
  'privacyOwnership:simulatePermission', 'privacyOwnership:exportEncrypted'
] as const;
const writes = channels.filter((channel) => !['privacyOwnership:getCenter', 'privacyOwnership:simulatePermission'].includes(channel));

describe('33-O privacy ownership and data rights IPC boundary', () => {
  it('accepts only the exact renderer contracts without a renderer-controlled owner key or export destination', () => {
    const acceptedInputs: Readonly<Record<string, readonly unknown[]>> = {
      'privacyOwnership:getCenter': [],
      'privacyOwnership:correctAiMemory': [{ ...operation, recordId, title: 'Düzeltilmiş kayıt', statement: 'Yalnız doğrulanmış yerel olgu.' }],
      'privacyOwnership:restrictAiMemory': [{ ...operation, recordId, restriction: { visibility: 'owner_only', selectedAccountIds: [], allowedPurposes: ['general'], processingAllowed: false } }],
      'privacyOwnership:deleteAiMemory': [{ ...operation, recordId, reason: 'Sahibin yerel silme talebi.' }],
      'privacyOwnership:expireAiMemory': [{ ...operation, recordId, retentionUntil: occurredAt }],
      'privacyOwnership:createRightsRequest': [{ ...operation, kind: 'encrypted_export', scopeResourceType: 'privacy_inventory', scopeResourceId: recordId, reason: 'Yerel şifreli kopya.' }],
      'privacyOwnership:updateRightsRequest': [{ ...operation, requestId: 'rights-request-0001', status: 'in_review' }],
      'privacyOwnership:createIncident': [{ ...operation, title: 'Yerel erişim şüphesi', severity: 'high', suspectedAt: occurredAt, actions: [{ action: 'revoke_local_session_authority', targetId: 'session-0001' }], evidenceReferenceIds: ['evidence-0001'] }],
      'privacyOwnership:updateIncident': [{ ...operation, incidentId: 'incident-0001', status: 'contained_locally' }],
      'privacyOwnership:simulatePermission': [{ targets: [{ subjectAccountId: 'account-0001', resourceType: 'privacy_inventory', resourceId: recordId, action: 'read', purpose: 'general', occurredAt }] }],
      'privacyOwnership:exportEncrypted': [{ requestId: 'rights-request-0001', passphrase: 'Yerel-Gizlilik-2026!' }]
    };
    for (const channel of channels) expect(evaluateIpcIntegrationPolicy(channel, acceptedInputs[channel]!)).toEqual({ accepted: true });

    expect(evaluateIpcIntegrationPolicy('privacyOwnership:getCenter', [{ familyId: 'family-1' }])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('privacyOwnership:createRightsRequest', [{ ...operation, kind: 'encrypted_export',
      scopeResourceType: 'family_data', scopeResourceId: recordId, reason: 'Yanlış kapsam.' }])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('privacyOwnership:createRightsRequest', [{ ...operation, kind: 'legacy_export',
      scopeResourceType: 'privacy_inventory', scopeResourceId: recordId, reason: 'Yanlış kapsam.' }])).toMatchObject({ accepted: false });
    for (const forbidden of ['key', 'value', 'metadata', 'destination']) {
      expect(evaluateIpcIntegrationPolicy('privacyOwnership:exportEncrypted', [{ requestId: 'rights-request-0001', passphrase: 'Yerel-Gizlilik-2026!', [forbidden]: {} }]))
        .toMatchObject({ accepted: false });
    }
    expect(evaluateIpcIntegrationPolicy('privacyOwnership:future', [])).toMatchObject({ accepted: false, reason: 'UNKNOWN_IPC_CHANNEL' });
  });

  it('rejects unknown nested fields, banking secrets, paths, forged prototypes, non-finite and oversized values', () => {
    const correction = { ...operation, recordId, title: 'Başlık', statement: 'Düzeltme' };
    expect(evaluateIpcIntegrationPolicy('privacyOwnership:correctAiMemory', [{ ...correction, unknown: true }])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('privacyOwnership:correctAiMemory', [{ ...correction, cardNumber: '4111111111111111' }])).toMatchObject({ accepted: false, reason: 'BANKING_SECRET_FIELD_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('privacyOwnership:correctAiMemory', [{ ...correction, destinationPath: 'C:\\private\\data' }])).toMatchObject({ accepted: false, reason: 'PATH_FIELD_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('privacyOwnership:correctAiMemory', [{ ...correction, expectedRevision: Number.POSITIVE_INFINITY }])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('privacyOwnership:correctAiMemory', [{ ...correction, statement: 'x'.repeat(4_097) }])).toMatchObject({ accepted: false, reason: 'PRIVACY_STRING_TOO_LARGE' });
    const forged = Object.assign(Object.create({ cvv: '123' }) as Record<string, unknown>, correction);
    expect(evaluateIpcIntegrationPolicy('privacyOwnership:correctAiMemory', [forged])).toMatchObject({ accepted: false });
    expect(evaluateIpcPayloadSecurity([{ safe: { constructor: 'pollute' } }])).toMatchObject({ accepted: false, reason: 'FORBIDDEN_KEY_REJECTED' });
    expect(evaluateIpcPayloadSecurity(['x'.repeat(262_145)])).toMatchObject({ accepted: false, reason: 'STRING_LIMIT_EXCEEDED' });
  });

  it('permits passphrase only on encrypted export and keeps result paths and extra claims out', () => {
    expect(evaluateIpcIntegrationPolicy('privacyOwnership:deleteAiMemory', [{ ...operation, recordId, reason: 'sil', passphrase: 'should-not-cross' }]))
      .toMatchObject({ accepted: false, reason: 'CREDENTIAL_FIELD_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('privacyOwnership:exportEncrypted', [{ requestId: 'rights-request-0001', passphrase: '123456789012' }]))
      .toMatchObject({ accepted: false });
    const result = { fileName: 'verilerim.pptprivacy', artifactSha256: 'a'.repeat(64), artifactSizeBytes: 4096, createdAt: occurredAt, delivery: 'not_performed' };
    expect(evaluateIpcIntegrationResultPolicy('privacyOwnership:exportEncrypted', result)).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationResultPolicy('privacyOwnership:exportEncrypted', { ...result, absolutePath: 'C:\\private\\verilerim.pptprivacy' })).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationResultPolicy('privacyOwnership:exportEncrypted', { ...result, delivery: 'sent' })).toMatchObject({ accepted: false });
  });

  it('applies read/write lifecycle, admission and rate limits to every channel', () => {
    for (const channel of channels) {
      expect(resolveIpcRequestAdmissionPolicy(channel)).toMatchObject({
        enabled: true, maxConcurrentPerSender: 2, maxConcurrentPerChannel: 1,
        maxQueuedPerSender: 4, queueTimeoutMs: 2_500
      });
    }
    for (const channel of ['privacyOwnership:getCenter', 'privacyOwnership:simulatePermission']) {
      expect(resolveIpcRequestLifecyclePolicy(channel)).toMatchObject({ cancellable: true, latestWins: true });
      expect(resolveIpcRequestRatePolicy(channel)).toEqual({ enabled: true, maxRequestsPerWindow: 120, windowMs: 60_000 });
    }
    for (const channel of writes) {
      expect(resolveIpcRequestLifecyclePolicy(channel)).toEqual({ cancellable: false, latestWins: false, timeoutMs: 0 });
      expect(resolveIpcRequestRatePolicy(channel)).toEqual({ enabled: true, maxRequestsPerWindow: 24, windowMs: 60_000 });
    }
  });

  it('fails closed after 24 writes per sender/channel and admits again after the minute window', async () => {
    let now = 10_000;
    const registry = new IpcRequestLifecycleRegistry({ now: () => now });
    const request = (index: number) => ({
      schemaVersion: 1 as const,
      rendererSessionId: '11111111-1111-4111-8111-111111111111',
      requestId: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
      sessionEpoch: 0, requestSequence: index, channel: 'privacyOwnership:deleteAiMemory',
      revisions: createZeroIpcTransportRevisions()
    });
    for (let index = 1; index <= 24; index += 1) {
      const lease = await registry.acquire(12, request(index));
      lease.complete();
    }
    await expect(registry.acquire(12, request(25))).rejects.toMatchObject({ kind: 'rate-limit' });
    now += 60_001;
    const retry = await registry.acquire(12, request(25));
    retry.complete();
  });
});
