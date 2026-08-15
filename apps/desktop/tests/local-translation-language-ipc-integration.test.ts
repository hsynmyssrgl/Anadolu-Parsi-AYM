import { describe, expect, it } from 'vitest';
import {
  LOCAL_TRANSLATION_IPC_CHANNELS,
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy
} from '../src/main/ipc-integration-policy.js';
import {
  resolveIpcRequestAdmissionPolicy,
  resolveIpcRequestLifecyclePolicy,
  resolveIpcRequestRatePolicy
} from '../src/main/ipc-request-lifecycle.js';

const requestId = 'local-translation-request-34-e';
const common = { clientOperationId: 'operation-34-e', expectedRevision: 1, requestId };
const truth = {
  commonTranslationProviderPortModeled: true,
  localFirstPolicyModeled: true,
  originalPreservationContractModeled: true,
  separateMachineTranslationLabelModeled: true,
  personalDictionaryModeled: true,
  explicitCorrectionPermissionModeled: true,
  externalPreviewAndConsentModeled: true,
  rendererProviderAuthority: false,
  productionTranslationProviderConfigured: false,
  localLanguagePackInstalled: false,
  languageDetectionExecuted: false,
  translationExecuted: false,
  speechToTextExecuted: false,
  speakerSeparationExecuted: false,
  liveCaptionTranslationExecuted: false,
  textToSpeechExecuted: false,
  originalAudioMuted: false,
  externalProviderConfigured: false,
  externalProviderPreviewDelivered: false,
  encryptedCrossDevicePreferenceSyncExecuted: false,
  networkUsedByCurrentImplementation: false
};
const profile = {
  id: 'local-translation-profile-34-e', preferredLanguage: 'tr', secondaryLanguages: ['en'],
  localFirstRequired: true, liveCaptionTranslationEnabled: false, translatedSpeechEnabled: false,
  preserveOriginalAudio: true, externalProviderAllowed: false, externalPreviewRequired: true,
  externalConsentRequired: true, encryptedSyncRequested: false, encryptedSyncExecuted: false,
  revision: 1, updatedAt: '2026-08-15T17:00:00.000Z'
};
const center = { schemaVersion: 1, centerId: 'local-translation-family-owner', ownerPersonId: 'person-owner-34-e',
  profile, dictionary: [], requests: [], truth, generatedAt: '2026-08-15T17:00:00.000Z' };
const receipt = { resourceType: 'local_translation_request', resourceId: requestId, mutationKind: 'correction_record',
  previousRevision: 1, revision: 2, occurredAt: '2026-08-15T17:00:00.000Z', replayed: false,
  providerConfigured: false, translationExecuted: false, networkUsed: false, cloudUsed: false };

describe('34-E local translation IPC integration boundary', () => {
  it('accepts the exact eight-channel input contract', () => {
    const accepted: [string, unknown[]][] = [
      [LOCAL_TRANSLATION_IPC_CHANNELS.getCenter, []],
      [LOCAL_TRANSLATION_IPC_CHANNELS.updateProfile, [{ clientOperationId: 'profile-34-e', expectedRevision: 0,
        preferredLanguage: 'tr', secondaryLanguages: ['en'], liveCaptionTranslationEnabled: false,
        translatedSpeechEnabled: false, preserveOriginalAudio: true, externalProviderAllowed: false,
        encryptedSyncRequested: false }]],
      [LOCAL_TRANSLATION_IPC_CHANNELS.addDictionary, [{ clientOperationId: 'dictionary-add-34-e', expectedRevision: 1,
        category: 'family_name', sourceLanguage: 'tr', targetLanguage: 'en', sourceTerm: 'Aile',
        preferredTerm: 'Family', explicitPermission: true }]],
      [LOCAL_TRANSLATION_IPC_CHANNELS.updateDictionary, [{ clientOperationId: 'dictionary-update-34-e', expectedRevision: 2,
        entryId: 'dictionary-entry-34-e', category: 'family_name', sourceLanguage: 'tr', targetLanguage: 'en',
        sourceTerm: 'Aile', preferredTerm: 'Family name', explicitPermission: true }]],
      [LOCAL_TRANSLATION_IPC_CHANNELS.deleteDictionary, [{ clientOperationId: 'dictionary-delete-34-e', expectedRevision: 3,
        entryId: 'dictionary-entry-34-e', reason: 'Owner removed this entry.' }]],
      [LOCAL_TRANSLATION_IPC_CHANNELS.prepareRequest, [{ clientOperationId: 'request-prepare-34-e', expectedRevision: 0,
        sourceKind: 'message', sourceResourceId: 'message-local-34-e', targetLanguage: 'en', providerMode: 'external_preview',
        externalPreviewAcknowledged: true, explicitExternalConsent: true }]],
      [LOCAL_TRANSLATION_IPC_CHANNELS.recordCorrection, [{ ...common, correctedText: 'Owner correction', explicitPermission: true }]],
      [LOCAL_TRANSLATION_IPC_CHANNELS.cancelRequest, [{ ...common, reason: 'Owner cancelled this request.' }]]
    ];
    for (const [channel, args] of accepted) expect(evaluateIpcIntegrationPolicy(channel, args)).toEqual({ accepted: true });
  });

  it('rejects renderer provider authority, paths, credentials, extra keys and consent mismatch', () => {
    const base = { clientOperationId: 'request-prepare-34-e', expectedRevision: 0, sourceKind: 'message',
      sourceResourceId: 'message-local-34-e', targetLanguage: 'en', providerMode: 'external_preview',
      externalPreviewAcknowledged: true, explicitExternalConsent: true };
    for (const forged of [{ ...base, translatedText: 'forged' }, { ...base, providerToken: 'secret' },
      { ...base, filePath: 'C:/secret.txt' }, { ...base, explicitExternalConsent: false }])
      expect(evaluateIpcIntegrationPolicy(LOCAL_TRANSLATION_IPC_CHANNELS.prepareRequest, [forged]).accepted).toBe(false);
    expect(evaluateIpcIntegrationPolicy('localTranslation:executeProvider', [base]).accepted).toBe(false);
  });

  it('rejects inherited and accessor-bearing payloads before dispatch', () => {
    const inherited = Object.assign(Object.create({ providerToken: 'forged' }), {
      ...common, reason: 'Owner cancelled this request.'
    });
    expect(evaluateIpcIntegrationPolicy(LOCAL_TRANSLATION_IPC_CHANNELS.cancelRequest, [inherited]).accepted).toBe(false);
    const accessor = { ...common, reason: 'Owner cancelled this request.' };
    Object.defineProperty(accessor, 'reason', { get: () => 'forged', enumerable: true });
    expect(evaluateIpcIntegrationPolicy(LOCAL_TRANSLATION_IPC_CHANNELS.cancelRequest, [accessor]).accepted).toBe(false);
  });

  it('accepts only redacted center and no-provider mutation results', () => {
    expect(evaluateIpcIntegrationResultPolicy(LOCAL_TRANSLATION_IPC_CHANNELS.getCenter, center)).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationResultPolicy(LOCAL_TRANSLATION_IPC_CHANNELS.recordCorrection, receipt)).toEqual({ accepted: true });
    for (const forged of [{ ...receipt, providerConfigured: true }, { ...receipt, translationExecuted: true },
      { ...receipt, networkUsed: true }, { ...receipt, cloudUsed: true }, { ...receipt, translatedText: 'forged' }])
      expect(evaluateIpcIntegrationResultPolicy(LOCAL_TRANSLATION_IPC_CHANNELS.recordCorrection, forged).accepted).toBe(false);
    expect(evaluateIpcIntegrationResultPolicy(LOCAL_TRANSLATION_IPC_CHANNELS.getCenter,
      { ...center, providerCredential: 'secret' }).accepted).toBe(false);
  });

  it('keeps reads cancellable and durable writes non-cancellable with bounded admission', () => {
    expect(resolveIpcRequestLifecyclePolicy(LOCAL_TRANSLATION_IPC_CHANNELS.getCenter))
      .toEqual({ cancellable: true, latestWins: true, timeoutMs: 10_000 });
    expect(resolveIpcRequestLifecyclePolicy(LOCAL_TRANSLATION_IPC_CHANNELS.prepareRequest))
      .toEqual({ cancellable: false, latestWins: false, timeoutMs: 0 });
    expect(resolveIpcRequestAdmissionPolicy(LOCAL_TRANSLATION_IPC_CHANNELS.recordCorrection)).toMatchObject({
      enabled: true, maxConcurrentPerSender: 2, maxConcurrentPerChannel: 1, maxQueuedPerSender: 4
    });
  });

  it('applies separate read and write rate limits', () => {
    expect(resolveIpcRequestRatePolicy(LOCAL_TRANSLATION_IPC_CHANNELS.getCenter))
      .toEqual({ enabled: true, maxRequestsPerWindow: 120, windowMs: 60_000 });
    expect(resolveIpcRequestRatePolicy(LOCAL_TRANSLATION_IPC_CHANNELS.cancelRequest))
      .toEqual({ enabled: true, maxRequestsPerWindow: 16, windowMs: 60_000 });
  });
});
