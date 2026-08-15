import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
const panel = readFileSync('apps/desktop/src/renderer/LocalTranslationLanguagePanel.tsx', 'utf8');
const styles = readFileSync('apps/desktop/src/renderer/styles.css', 'utf8');

describe('34-E local-first translation renderer surface', () => {
  it('extends the existing system screen exactly once without adding a route', () => {
    expect(app).toContain("import { LocalTranslationLanguagePanel } from './LocalTranslationLanguagePanel';");
    expect(app.match(/<LocalTranslationLanguagePanel\/>/gu)).toHaveLength(1);
    expect(app.indexOf('<LocalTranslationLanguagePanel/>')).toBeGreaterThan(app.indexOf('<CommunicationRecordingRetentionPanel/>'));
    expect(app).not.toContain("id: 'local-translation'");
  });

  it('uses every safe bridge and preserves the client operation identity until success', () => {
    for (const method of ['getLocalTranslationCenter', 'updateLocalTranslationProfile',
      'addLocalTranslationDictionaryEntry', 'updateLocalTranslationDictionaryEntry', 'deleteLocalTranslationDictionaryEntry',
      'prepareLocalTranslationRequest', 'recordLocalTranslationCorrection', 'cancelLocalTranslationRequest'])
      expect(panel).toContain(`.${method}(`);
    expect(panel).toContain('operations.current.get(key)');
    expect(panel).toContain('operations.current.delete(key)');
    expect(panel).toContain('explicitPermission:true');
  });

  it('states no-provider, no-network and no-execution truth while preserving originals and consent', () => {
    for (const marker of ['providerMode', 'externalPreviewAcknowledged', 'explicitExternalConsent',
      'preserveOriginalAudio:true', "providerMode==='external_preview'&&externalConsent",
      "value==='local_offline'"])
      expect(panel).toContain(marker);
    for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'navigator.mediaDevices',
      'MediaRecorder', 'TranslationProviderPort', 'providerToken', 'apiKey', 'translatedText'])
      expect(panel).not.toContain(forbidden);
  });

  it('offers profile, personal dictionary, request, correction and cancellation controls accessibly', () => {
    for (const marker of ['saveProfile', 'saveDictionary', 'deleteDictionary', 'prepare', 'correct', 'cancel',
      'aria-labelledby="local-translation-title"', 'role="note"', 'role="alert"'])
      expect(panel).toContain(marker);
    expect(styles).toContain('.local-translation');
    expect(styles).toContain('.local-translation-truth');
    expect(styles).toContain('.local-translation-grid');
  });
});
