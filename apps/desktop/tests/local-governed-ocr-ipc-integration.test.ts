import { describe, expect, it } from 'vitest';
import type {
  LocalGovernedOcrCenterView,
  LocalGovernedOcrMutationReceiptView,
  LocalGovernedOcrResultView,
  LocalGovernedOcrSearchView
} from '@ppt/domain';
import {
  LOCAL_GOVERNED_OCR_IPC_CHANNELS,
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy,
  projectLocalGovernedOcrCenterIpcView,
  projectLocalGovernedOcrMutationIpcView,
  projectLocalGovernedOcrResultIpcView,
  projectLocalGovernedOcrSearchIpcView
} from '../src/main/ipc-integration-policy.js';
import {
  IpcRequestLifecycleRegistry,
  resolveIpcRequestAdmissionPolicy,
  resolveIpcRequestLifecyclePolicy,
  resolveIpcRequestRatePolicy
} from '../src/main/ipc-request-lifecycle.js';
import { createZeroIpcTransportRevisions } from '../src/main/ipc-transport-context.js';

const occurredAt = '2026-08-14T08:00:00.000Z';
const hash = 'a'.repeat(64);
const mutationIdentity = { expectedRevision: 3, clientOperationId: 'operation-local-ocr-0001' } as const;
const jobMutation = { ...mutationIdentity, jobId: 'local-ocr-job-0001' } as const;
const validInputs = {
  [LOCAL_GOVERNED_OCR_IPC_CHANNELS.getCenter]: [],
  [LOCAL_GOVERNED_OCR_IPC_CHANNELS.getResult]: [{ jobId: 'local-ocr-job-0001' }],
  [LOCAL_GOVERNED_OCR_IPC_CHANNELS.search]: [{ query: 'güvenli sonuç', limit: 10 }],
  [LOCAL_GOVERNED_OCR_IPC_CHANNELS.create]: [{
    expectedRevision: 0,
    clientOperationId: 'operation-local-ocr-create-0001',
    sourceResourceId: 'archive-item-0001',
    languageHints: ['en-US', 'tr-TR']
  }],
  [LOCAL_GOVERNED_OCR_IPC_CHANNELS.run]: [jobMutation],
  [LOCAL_GOVERNED_OCR_IPC_CHANNELS.cancel]: [jobMutation],
  [LOCAL_GOVERNED_OCR_IPC_CHANNELS.correct]: [{ ...jobMutation, correctedText: 'Duzeltilmis yerel OCR metni.' }],
  [LOCAL_GOVERNED_OCR_IPC_CHANNELS.rerun]: [{ ...jobMutation, languageHints: ['tr-TR'] }],
  [LOCAL_GOVERNED_OCR_IPC_CHANNELS.delete]: [{ ...jobMutation, reason: 'Kullanici yerel sonucu sildi.' }],
  [LOCAL_GOVERNED_OCR_IPC_CHANNELS.setEnabled]: [{
    ...mutationIdentity, enabled: false, reason: 'Yerel OCR gecici olarak kapatildi.'
  }]
} as const;

const domainCenter = {
  schemaVersion: 1,
  key: { familyId: 'family-main', accountId: 'account-main', ownerPersonId: 'person-main' },
  settings: {
    key: { familyId: 'family-main', accountId: 'account-main', ownerPersonId: 'person-main' },
    revision: 2,
    enabled: true,
    updatedAt: occurredAt
  },
  jobs: [{
    id: 'local-ocr-job-0001',
    key: { familyId: 'family-main', accountId: 'account-main', ownerPersonId: 'person-main' },
    revision: 3,
    source: {
      resourceType: 'archive_item', resourceId: 'archive-item-0001', inputSha256: hash,
      mimeType: 'image/png', sizeBytes: 4_096
    },
    derivedResourceId: 'local-ocr-job-0001:result',
    languageHints: ['tr-TR'],
    status: 'completed',
    runAttempt: 1,
    correctionRevision: 0,
    resultAvailable: true,
    resultContentSha256: hash,
    resultCharacterCount: 31,
    resultPageCount: 1,
    confidenceBasisPoints: 9_500,
    derivedBindingHash: hash,
    consentId: 'consent-local-ocr-0001',
    retentionUntil: '2026-09-14T08:00:00.000Z',
    completedAt: occurredAt,
    deletionPropagation: 'active',
    processor: 'local_ocr',
    networkUsed: false,
    cloudUsed: false,
    createdAt: occurredAt,
    updatedAt: occurredAt
  }],
  truth: {
    executionScope: 'bounded_child_process',
    lowPrivilegeSandboxVerified: false,
    sourceBytesExposedToRenderer: false,
    plaintextResultPersistedInRepository: false,
    networkUsed: false,
    cloudUsed: false,
    providerDeliveryGuaranteed: false,
    explicitSensitiveProcessingConsentRequired: true,
    derivedPolicyBindingRequired: true,
    sourceDeletionPropagatesToDerivedResult: true,
    sourceDeletionAutoResumeGuaranteed: true,
    authorizationRevocationPropagatesToSealedResult: true,
    retentionExpiryPropagatesToSealedResult: true,
    scheduledOrphanSweepUsesDistinctMaintenanceAuthority: true,
    encryptedFullTextIndexAvailable: true,
    policyFilteredSearchRequired: true,
    snippetMaskingEnforced: true,
    derivedDeletionDeletesSource: false
  },
  generatedAt: occurredAt
} as unknown as LocalGovernedOcrCenterView;

const domainResult = {
  jobId: 'local-ocr-job-0001', revision: 3, text: 'Guvenli yerel OCR sonucu.', contentSha256: hash,
  corrected: false, payloadSource: 'sealed_local_result', networkUsed: false, cloudUsed: false
} as const satisfies LocalGovernedOcrResultView;

const domainSearch = {
  schemaVersion: 1,
  matches: [{ jobId: 'local-ocr-job-0001', revision: 3, snippet: 'Güvenli [numara maskeli ••••1111] sonuç.',
    snippetMasked: true, matchedTokenCount: 2, pageNumber: 1, corrected: false,
    networkUsed: false, cloudUsed: false }],
  truncated: false,
  policyFiltered: true,
  encryptedIndexAtRest: true,
  snippetsMasked: true,
  queryEchoed: false,
  networkUsed: false,
  cloudUsed: false,
  generatedAt: occurredAt
} as const satisfies LocalGovernedOcrSearchView;

const domainMutation = {
  clientOperationId: 'operation-local-ocr-run-0001',
  mutationKind: 'job_run',
  resourceType: 'local_ocr_job',
  resourceId: 'local-ocr-job-0001',
  previousRevision: 2,
  revision: 3,
  occurredAt,
  stateFingerprint: hash,
  replayed: false,
  sourceResourceDeleted: false,
  networkUsed: false,
  cloudUsed: false
} as const satisfies LocalGovernedOcrMutationReceiptView;

describe('33-Q local governed OCR IPC boundary', () => {
  it('accepts the ten exact renderer contracts and rejects unknown or main-only channels', () => {
    for (const channel of Object.values(LOCAL_GOVERNED_OCR_IPC_CHANNELS)) {
      expect(evaluateIpcIntegrationPolicy(channel, validInputs[channel]), channel).toEqual({ accepted: true });
    }
    expect(evaluateIpcIntegrationPolicy('localOcr:future', [])).toMatchObject({
      accepted: false, reason: 'UNKNOWN_IPC_CHANNEL'
    });
    expect(evaluateIpcIntegrationPolicy('localOcr:propagateSourceDeletion', [{
      sourceResourceId: 'archive-item-0001', purgedAt: occurredAt
    }])).toMatchObject({ accepted: false, reason: 'UNKNOWN_IPC_CHANNEL' });
  });

  it.each([
    ['familyId', 'family-forged'],
    ['accountId', 'account-forged'],
    ['ownerPersonId', 'person-forged'],
    ['sourcePath', 'C:\\private\\source.png'],
    ['rawBytes', [1, 2, 3]],
    ['sealedResultId', 'sealed-forged'],
    ['receipt', { id: 'receipt-forged' }],
    ['inputSha256', hash],
    ['stateFingerprint', hash]
  ] as const)('rejects renderer-authored authority field %s recursively', (field, forgedValue) => {
    const create = validInputs[LOCAL_GOVERNED_OCR_IPC_CHANNELS.create][0];
    expect(evaluateIpcIntegrationPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.create, [{
      ...create, metadata: { [field]: forgedValue }
    }])).toMatchObject({ accepted: false });
  });

  it('rejects forged prototypes, accessors, symbols and prototype keys before field reads', () => {
    const create = validInputs[LOCAL_GOVERNED_OCR_IPC_CHANNELS.create][0];
    const inherited = Object.assign(Object.create({ inheritedAuthority: true }) as Record<string, unknown>, create);
    expect(evaluateIpcIntegrationPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.create, [inherited]))
      .toMatchObject({ accepted: false, reason: 'NON_PLAIN_OBJECT_REJECTED' });

    const accessor = { ...create } as Record<string, unknown>;
    Object.defineProperty(accessor, 'receipt', { enumerable: true, get: () => ({ forged: true }) });
    expect(evaluateIpcIntegrationPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.create, [accessor]))
      .toMatchObject({ accepted: false, reason: 'ACCESSOR_FIELD_PROHIBITED' });

    const symbol = { ...create, [Symbol('secret')]: 'forged' };
    expect(evaluateIpcIntegrationPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.create, [symbol]))
      .toMatchObject({ accepted: false, reason: 'SYMBOL_FIELD_PROHIBITED' });

    const prototypeKey = { ...create } as Record<string, unknown>;
    Object.defineProperty(prototypeKey, '__proto__', { enumerable: true, value: 'forged' });
    expect(evaluateIpcIntegrationPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.create, [prototypeKey]))
      .toMatchObject({ accepted: false, reason: 'PROTOTYPE_FIELD_PROHIBITED' });
  });

  it('rejects excessive depth, nested secrets, absolute paths and full PAN values', () => {
    let nested: Record<string, unknown> = { safe: true };
    for (let depth = 0; depth < 10; depth += 1) nested = { nested };
    const create = validInputs[LOCAL_GOVERNED_OCR_IPC_CHANNELS.create][0];
    expect(evaluateIpcIntegrationPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.create, [{ ...create, metadata: nested }]))
      .toMatchObject({ accepted: false, reason: 'LOCAL_OCR_PAYLOAD_NESTING_TOO_DEEP' });
    expect(evaluateIpcIntegrationPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.create, [{
      ...create, metadata: { password: 'secret-value' }
    }])).toMatchObject({ accepted: false, reason: 'CREDENTIAL_FIELD_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.correct, [{
      ...jobMutation, correctedText: 'C:\\private\\ocr-result.txt'
    }])).toMatchObject({ accepted: false, reason: 'PATH_VALUE_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.correct, [{
      ...jobMutation, correctedText: '4111111111111111'
    }])).toMatchObject({ accepted: false, reason: 'BANKING_SECRET_VALUE_PROHIBITED' });
  });

  it('pins revisions, language count, reason and corrected-text limits', () => {
    expect(evaluateIpcIntegrationPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.correct, [{
      ...jobMutation, correctedText: 'x'.repeat(250_000)
    }])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.correct, [{
      ...jobMutation, correctedText: 'x'.repeat(250_001)
    }])).toMatchObject({ accepted: false, reason: 'LOCAL_OCR_STRING_TOO_LARGE' });
    const create = validInputs[LOCAL_GOVERNED_OCR_IPC_CHANNELS.create][0];
    expect(evaluateIpcIntegrationPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.create, [{
      ...create, languageHints: ['tr', 'en', 'de', 'fr', 'es', 'it', 'nl', 'sv', 'fi']
    }])).toMatchObject({ accepted: false });
    for (const expectedRevision of [-1, 0.5, 2_147_483_647]) {
      expect(evaluateIpcIntegrationPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.run, [{
        ...jobMutation, expectedRevision
      }])).toMatchObject({ accepted: false });
    }
    expect(evaluateIpcIntegrationPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.delete, [{
      ...jobMutation, reason: 'x'.repeat(513)
    }])).toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.search, [{ query: 'güvenli sonuç', limit: 25 }]))
      .toEqual({ accepted: true });
    for (const query of [' kullanıcı@example.com', 'kullanıcı@example.com', 'TR330006100519786457841326', '4111111111111111']) {
      expect(evaluateIpcIntegrationPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.search, [{ query }]))
        .toMatchObject({ accepted: false });
    }
  });

  it('projects center, plaintext and mutation results without owner, receipt or hash authority', () => {
    const center = projectLocalGovernedOcrCenterIpcView(domainCenter);
    const result = projectLocalGovernedOcrResultIpcView(domainResult);
    const search = projectLocalGovernedOcrSearchIpcView(domainSearch);
    const mutation = projectLocalGovernedOcrMutationIpcView(domainMutation, 'job_run');
    const rendererJson = JSON.stringify({ center, result, search, mutation });
    for (const forbidden of [
      'familyId', 'accountId', 'ownerPersonId', 'inputSha256', 'contentSha256', 'derivedBindingHash',
      'stateFingerprint', 'sealedResultId', 'receipt', 'clientOperationId', 'consentId', 'derivedResourceId'
    ]) expect(rendererJson).not.toContain(forbidden);
    expect(rendererJson).not.toContain(hash);
    expect(center.jobs[0]?.source).toEqual({
      resourceType: 'archive_item', resourceId: 'archive-item-0001', mimeType: 'image/png', size: 4_096
    });
    expect(result).toEqual({
      jobId: 'local-ocr-job-0001', revision: 3, text: 'Guvenli yerel OCR sonucu.', corrected: false,
      payloadSource: 'sealed_local_result', networkUsed: false, cloudUsed: false
    });
    expect(search).toEqual(domainSearch);
    expect(rendererJson).not.toContain('güvenli sonuç');
    expect(mutation).toEqual({
      previousRevision: 2, revision: 3, occurredAt, replayed: false, networkUsed: false, cloudUsed: false
    });
  });

  it('accepts only projected safe result schemas and rejects raw domain results', () => {
    const projectedCenter = projectLocalGovernedOcrCenterIpcView(domainCenter);
    expect(projectedCenter.truth.sourceDeletionAutoResumeGuaranteed).toBe(true);
    expect(projectedCenter.truth.authorizationRevocationPropagatesToSealedResult).toBe(true);
    expect(evaluateIpcIntegrationResultPolicy(
      LOCAL_GOVERNED_OCR_IPC_CHANNELS.getCenter,
      projectedCenter
    )).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationResultPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.getCenter, {
      ...projectedCenter,
      truth: { ...projectedCenter.truth, authorizationRevocationPropagatesToSealedResult: false }
    })).toMatchObject({ accepted: false, reason: 'LOCAL_OCR_RESULT_INVALID' });
    expect(evaluateIpcIntegrationResultPolicy(
      LOCAL_GOVERNED_OCR_IPC_CHANNELS.getResult,
      projectLocalGovernedOcrResultIpcView(domainResult)
    )).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationResultPolicy(
      LOCAL_GOVERNED_OCR_IPC_CHANNELS.search,
      projectLocalGovernedOcrSearchIpcView(domainSearch)
    )).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationResultPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.search, {
      ...projectLocalGovernedOcrSearchIpcView(domainSearch), query: 'güvenli sonuç'
    })).toMatchObject({ accepted: false });
    for (const [channel, expectedKind] of [
      [LOCAL_GOVERNED_OCR_IPC_CHANNELS.create, 'job_create'],
      [LOCAL_GOVERNED_OCR_IPC_CHANNELS.run, 'job_run'],
      [LOCAL_GOVERNED_OCR_IPC_CHANNELS.cancel, 'job_cancel'],
      [LOCAL_GOVERNED_OCR_IPC_CHANNELS.correct, 'result_correct'],
      [LOCAL_GOVERNED_OCR_IPC_CHANNELS.rerun, 'job_rerun'],
      [LOCAL_GOVERNED_OCR_IPC_CHANNELS.delete, 'job_delete'],
      [LOCAL_GOVERNED_OCR_IPC_CHANNELS.setEnabled, 'processing_disable']
    ] as const) {
      const resourceType = expectedKind.startsWith('processing_') ? 'local_ocr_settings' : 'local_ocr_job';
      const receipt = { ...domainMutation, mutationKind: expectedKind, resourceType };
      expect(evaluateIpcIntegrationResultPolicy(
        channel,
        projectLocalGovernedOcrMutationIpcView(receipt, expectedKind)
      ), channel)
        .toEqual({ accepted: true });
    }
    expect(evaluateIpcIntegrationResultPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.getCenter, domainCenter))
      .toMatchObject({ accepted: false, reason: 'LOCAL_OCR_AUTHORITY_FIELD_PROHIBITED' });
    expect(evaluateIpcIntegrationResultPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.getResult, domainResult))
      .toMatchObject({ accepted: false, reason: 'LOCAL_OCR_AUTHORITY_FIELD_PROHIBITED' });
    expect(evaluateIpcIntegrationResultPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.run, domainMutation))
      .toMatchObject({ accepted: false, reason: 'LOCAL_OCR_AUTHORITY_FIELD_PROHIBITED' });
  });

  it('rejects unsafe result extras, accessors, symbols, paths, PANs, oversize text and unknown channels', () => {
    const safeResult = projectLocalGovernedOcrResultIpcView(domainResult);
    expect(evaluateIpcIntegrationResultPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.getResult, {
      ...safeResult, receipt: 'forged'
    })).toMatchObject({ accepted: false, reason: 'LOCAL_OCR_AUTHORITY_FIELD_PROHIBITED' });
    expect(evaluateIpcIntegrationResultPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.getResult, {
      ...safeResult, text: 'C:\\private\\result.txt'
    })).toMatchObject({ accepted: false, reason: 'PATH_VALUE_PROHIBITED' });
    expect(evaluateIpcIntegrationResultPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.getResult, {
      ...safeResult, text: '4111111111111111'
    })).toMatchObject({ accepted: false, reason: 'BANKING_SECRET_VALUE_PROHIBITED' });
    expect(evaluateIpcIntegrationResultPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.getResult, {
      ...safeResult, text: 'x'.repeat(250_001)
    })).toMatchObject({ accepted: false, reason: 'LOCAL_OCR_STRING_TOO_LARGE' });

    const accessor = { ...safeResult } as Record<string, unknown>;
    Object.defineProperty(accessor, 'text', { enumerable: true, get: () => 'forged' });
    expect(evaluateIpcIntegrationResultPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.getResult, accessor))
      .toMatchObject({ accepted: false, reason: 'ACCESSOR_FIELD_PROHIBITED' });
    expect(evaluateIpcIntegrationResultPolicy(LOCAL_GOVERNED_OCR_IPC_CHANNELS.getResult, {
      ...safeResult, [Symbol('secret')]: true
    })).toMatchObject({ accepted: false, reason: 'SYMBOL_FIELD_PROHIBITED' });
    expect(evaluateIpcIntegrationResultPolicy('localOcr:future', safeResult))
      .toMatchObject({ accepted: false, reason: 'UNKNOWN_IPC_CHANNEL' });
  });

  it('never projects a main-only source-deletion propagation receipt', () => {
    expect(() => projectLocalGovernedOcrMutationIpcView({
      ...domainMutation,
      mutationKind: 'source_delete_propagate',
      sourceResourceDeleted: true
    }, 'job_run')).toThrow('cannot cross the renderer bridge');
    expect(() => projectLocalGovernedOcrMutationIpcView(domainMutation, 'job_cancel'))
      .toThrow('does not match its main IPC operation');
  });

  it('fails closed before redaction when a center contains a foreign owner binding', () => {
    const foreign = {
      ...domainCenter,
      jobs: [{
        ...domainCenter.jobs[0],
        key: { familyId: 'family-other', accountId: 'account-main', ownerPersonId: 'person-main' }
      }]
    } as unknown as LocalGovernedOcrCenterView;
    expect(() => projectLocalGovernedOcrCenterIpcView(foreign)).toThrow('owner binding is incoherent');
  });

  it('marks reads cancellable and every durable write non-cancellable with bounded admission and rate', () => {
    for (const channel of Object.values(LOCAL_GOVERNED_OCR_IPC_CHANNELS)) {
      expect(resolveIpcRequestAdmissionPolicy(channel)).toMatchObject({
        enabled: true, priority: 'interactive', maxConcurrentPerSender: 2,
        maxConcurrentPerChannel: 1, maxQueuedPerSender: 4, queueTimeoutMs: 2_500
      });
    }
    for (const channel of [LOCAL_GOVERNED_OCR_IPC_CHANNELS.getCenter, LOCAL_GOVERNED_OCR_IPC_CHANNELS.getResult,
      LOCAL_GOVERNED_OCR_IPC_CHANNELS.search]) {
      expect(resolveIpcRequestLifecyclePolicy(channel)).toEqual({ cancellable: true, latestWins: true, timeoutMs: 10_000 });
      expect(resolveIpcRequestRatePolicy(channel)).toEqual({ enabled: true, maxRequestsPerWindow: 60, windowMs: 60_000 });
    }
    for (const channel of Object.values(LOCAL_GOVERNED_OCR_IPC_CHANNELS).filter((channel) =>
      channel !== LOCAL_GOVERNED_OCR_IPC_CHANNELS.getCenter
      && channel !== LOCAL_GOVERNED_OCR_IPC_CHANNELS.getResult
      && channel !== LOCAL_GOVERNED_OCR_IPC_CHANNELS.search)) {
      expect(resolveIpcRequestLifecyclePolicy(channel)).toEqual({ cancellable: false, latestWins: false, timeoutMs: 0 });
      expect(resolveIpcRequestRatePolicy(channel)).toEqual({ enabled: true, maxRequestsPerWindow: 12, windowMs: 60_000 });
    }
  });

  it('fails closed after the twelfth write in a minute and admits a retry after the window resets', async () => {
    let now = 10_000;
    const registry = new IpcRequestLifecycleRegistry({ now: () => now });
    const request = (index: number) => ({
      schemaVersion: 1 as const,
      rendererSessionId: '11111111-1111-4111-8111-111111111111',
      requestId: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
      sessionEpoch: 0,
      requestSequence: index,
      channel: LOCAL_GOVERNED_OCR_IPC_CHANNELS.correct,
      revisions: createZeroIpcTransportRevisions()
    });
    for (let index = 1; index <= 12; index += 1) {
      const lease = await registry.acquire(33, request(index));
      lease.complete();
    }
    await expect(registry.acquire(33, request(13))).rejects.toMatchObject({
      name: 'IpcRequestAdmissionError', kind: 'rate-limit', channel: LOCAL_GOVERNED_OCR_IPC_CHANNELS.correct
    });
    now += 60_001;
    const retry = await registry.acquire(33, request(13));
    expect(retry.admission.queued).toBe(false);
    retry.complete();
  });
});
