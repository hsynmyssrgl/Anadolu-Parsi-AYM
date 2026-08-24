import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('apps/desktop/src/renderer/CommunicationFileSharingPanel.tsx', 'utf8');

describe('communication file sharing notification decision', () => {
  it('keeps the save action disabled until the notification profile changes', () => {
    expect(source).toContain('const notificationsChanged=Boolean(center&&(');
    expect(source).toContain('const saveNotifications=()=>center&&notificationsChanged&&void mutate');
    expect(source).toContain('disabled={Boolean(busy)||!notificationsChanged}');
  });

  it('renders natural localized labels instead of raw communication enum values', () => {
    for (const labeler of [
      'communicationFileStateLabel(file.state,language)',
      'communicationFileScanStateLabel(file.scanState,language)',
      'communicationRemoteAssistanceStateLabel(item.state,language)',
      'communicationVoiceActionLabel(item.action,language)',
      'communicationVoiceActionStateLabel(item.state,language)'
    ]) expect(source).toContain(labeler);
    expect(source).not.toContain('<b>{file.state} / {file.scanState}</b>');
    expect(source).not.toContain('<strong>{item.state}</strong>');
    expect(source).not.toContain('<strong>{item.action}</strong> · {item.state}');
    for(const copy of ['Bu bilgisayardan dosya seç','Görüşme alanı','haricî birlikte izleme hizmeti kullanılmadı','yalnız bu bilgisayarda saklanır'])expect(source).toContain(copy);
    for(const technical of ['Ana süreçte dosya seç','yerel metadata','SharePlay','renderer','ham bayt','kasa referansı'])expect(source).not.toContain(technical);
  });
});
