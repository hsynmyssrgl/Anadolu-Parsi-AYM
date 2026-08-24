import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization } from '@ppt/domain';
import {
  CommunicationFileSharingPanel,
  communicationFileScanStateLabel,
  communicationFileStateLabel,
  communicationRemoteAssistanceStateLabel,
  communicationVoiceActionLabel,
  communicationVoiceActionStateLabel
} from '../src/renderer/CommunicationFileSharingPanel';
import { LocalizationProvider } from '../src/renderer/localization';

const renderPanel = (locale: 'tr-TR' | 'en-US'): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  createElement(CommunicationFileSharingPanel)
));

describe('feature-panel English localization wave eight', () => {
  it('renders the file-sharing loading surface without visible Turkish copy in English', () => {
    const html = renderPanel('en-US');
    expect(html).toContain('Loading file sharing');
    expect(html).toContain('Reading encrypted file records on this computer');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish product copy', () => {
    expect(renderPanel('tr-TR')).toContain('Dosya paylaşımı yükleniyor');
  });

  it('localizes file, remote-assistance and voice-action enum values', () => {
    const fileStates = [
      ['prepared_local', 'Yerel olarak hazırlandı', 'Prepared locally'], ['transferring_local', 'Yerel aktarım sürüyor', 'Local transfer in progress'],
      ['paused', 'Duraklatıldı', 'Paused'], ['scan_required', 'Tarama gerekiyor', 'Scan required'],
      ['ready_local', 'Yerel olarak hazır', 'Ready locally'], ['quarantined', 'Karantinada', 'Quarantined'], ['revoked', 'İptal edildi', 'Revoked']
    ] as const;
    for (const [state, turkish, english] of fileStates) {
      expect(communicationFileStateLabel(state, 'tr')).toBe(turkish);
      expect(communicationFileStateLabel(state, 'en')).toBe(english);
    }
    const scanStates = [
      ['not_run', 'Taranmadı', 'Not scanned'], ['clean', 'Temiz', 'Clean'],
      ['malicious', 'Zararlı olarak işaretlendi', 'Marked as malicious'],
      ['provider_unavailable', 'Güvenlik taraması kullanılamıyor', 'Security scan unavailable']
    ] as const;
    for (const [state, turkish, english] of scanStates) {
      expect(communicationFileScanStateLabel(state, 'tr')).toBe(turkish);
      expect(communicationFileScanStateLabel(state, 'en')).toBe(english);
    }
    const remoteStates = [
      ['consent_pending', 'Açık rıza bekliyor', 'Awaiting explicit consent'], ['active_local_plan', 'Etkin yerel plan', 'Active local plan'],
      ['revoked', 'İptal edildi', 'Revoked'], ['expired', 'Süresi doldu', 'Expired']
    ] as const;
    for (const [state, turkish, english] of remoteStates) {
      expect(communicationRemoteAssistanceStateLabel(state, 'tr')).toBe(turkish);
      expect(communicationRemoteAssistanceStateLabel(state, 'en')).toBe(english);
    }
    const voiceActions = [['call', 'Arama', 'Call'], ['send_message', 'Mesaj gönderme', 'Send message'], ['join_meeting', 'Toplantıya katılma', 'Join meeting']] as const;
    for (const [action, turkish, english] of voiceActions) {
      expect(communicationVoiceActionLabel(action, 'tr')).toBe(turkish);
      expect(communicationVoiceActionLabel(action, 'en')).toBe(english);
    }
    const voiceStates = [
      ['confirmation_required', 'Açık onay gerekiyor', 'Explicit confirmation required'],
      ['confirmed_local_only', 'Yalnız yerel olarak onaylandı', 'Confirmed locally only'], ['cancelled', 'İptal edildi', 'Canceled']
    ] as const;
    for (const [state, turkish, english] of voiceStates) {
      expect(communicationVoiceActionStateLabel(state, 'tr')).toBe(turkish);
      expect(communicationVoiceActionStateLabel(state, 'en')).toBe(english);
    }
  });
});
