import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP_META,
  CURRENT_PRODUCT_NAME,
  LEGACY_PRODUCT_NAME,
  STABLE_APPLICATION_ID,
  STABLE_USER_DATA_DIRECTORY_NAME,
  releaseApplicationId,
  releaseExecutableName,
  releaseProductName,
  releaseShortcutName,
  releaseUserDataDirectoryName
} from '@ppt/domain';
import { ProtectedSideArtifactStore } from '../src/main/protected-side-artifact-store.js';
import type { DeviceSecretProtector } from '../src/main/device-secret-protector.js';

const protector: DeviceSecretProtector = {
  protectionId: 'test-protector',
  required: true,
  isAvailable: () => true,
  protect: (value) => Buffer.from(value, 'utf8').toString('base64'),
  unprotect: (value) => Buffer.from(value, 'base64').toString('utf8')
};

describe('ParsYuva Aile Yaşam Merkezi product identity', () => {
  it('publishes the new brand while retaining stable Windows data identity', () => {
    expect(APP_META.name).toBe('ParsYuva Aile Yaşam Merkezi');
    expect(CURRENT_PRODUCT_NAME).toBe('ParsYuva Aile Yaşam Merkezi');
    expect(STABLE_APPLICATION_ID).toBe('tr.anadoluparsi.aileyasammerkezi');
    expect(STABLE_USER_DATA_DIRECTORY_NAME).toBe(LEGACY_PRODUCT_NAME);
  });

  it('isolates application, executable, shortcut and user-data identities by release channel', () => {
    expect(['Bronze','Silver','Gold'].map((channel) => ({
      applicationId: releaseApplicationId(channel as 'Bronze'|'Silver'|'Gold'),
      executableName: releaseExecutableName(channel as 'Bronze'|'Silver'|'Gold'),
      productName: releaseProductName(channel as 'Bronze'|'Silver'|'Gold'),
      shortcutName: releaseShortcutName(channel as 'Bronze'|'Silver'|'Gold'),
      userDataDirectory: releaseUserDataDirectoryName(channel as 'Bronze'|'Silver'|'Gold')
    }))).toEqual([
      { applicationId:'tr.anadoluparsi.aileyasammerkezi.bronze', executableName:'ParsYuva-Bronze', productName:'ParsYuva Aile Yaşam Merkezi Bronze', shortcutName:'ParsYuva Bronze', userDataDirectory:'ParsYuva/Bronze' },
      { applicationId:'tr.anadoluparsi.aileyasammerkezi.silver', executableName:'ParsYuva-Silver', productName:'ParsYuva Aile Yaşam Merkezi Silver', shortcutName:'ParsYuva Silver', userDataDirectory:'ParsYuva/Silver' },
      { applicationId:'tr.anadoluparsi.aileyasammerkezi.gold', executableName:'ParsYuva-Gold', productName:'ParsYuva Aile Yaşam Merkezi Gold', shortcutName:'ParsYuva Gold', userDataDirectory:'ParsYuva/Gold' }
    ]);
  });

  it('writes new protected envelopes and reads the legacy product envelope', () => {
    const root = mkdtempSync(join(tmpdir(), 'parsyuva-brand-'));
    try {
      const store = new ProtectedSideArtifactStore({
        keyPath: join(root, 'artifact.key'),
        applicationVersion: APP_META.version,
        protector,
        now: () => '2026-08-18T10:00:00.000Z'
      });
      const path = join(root, 'artifact.pptdata');
      store.writeText(path, 'brand-compatibility', 'korunan içerik');
      const current = JSON.parse(readFileSync(path, 'utf8')) as { product: string };
      expect(current.product).toBe(CURRENT_PRODUCT_NAME);
      writeFileSync(path, `${JSON.stringify({ ...current, product: LEGACY_PRODUCT_NAME })}\n`, 'utf8');
      expect(store.readBuffer(path).toString('utf8')).toBe('korunan içerik');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
