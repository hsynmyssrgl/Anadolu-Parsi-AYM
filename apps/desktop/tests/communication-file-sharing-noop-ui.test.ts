import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('apps/desktop/src/renderer/CommunicationFileSharingPanel.tsx', 'utf8');

describe('communication file sharing notification decision', () => {
  it('keeps the save action disabled until the notification profile changes', () => {
    expect(source).toContain('const notificationsChanged=Boolean(center&&(');
    expect(source).toContain('const saveNotifications=()=>center&&notificationsChanged&&void mutate');
    expect(source).toContain('disabled={Boolean(busy)||!notificationsChanged}');
  });
});
