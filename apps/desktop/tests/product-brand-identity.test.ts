import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP_META,
  CURRENT_PRODUCT_NAME,
  LEGACY_PRODUCT_NAME,
  STABLE_APPLICATION_ID,
  STABLE_USER_DATA_DIRECTORY_NAME
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

describe('ParsYuva AYM product identity', () => {
  it('publishes the new brand while retaining stable Windows data identity', () => {
    expect(APP_META.name).toBe('ParsYuva AYM');
    expect(CURRENT_PRODUCT_NAME).toBe('ParsYuva AYM');
    expect(STABLE_APPLICATION_ID).toBe('tr.anadoluparsi.aileyasammerkezi');
    expect(STABLE_USER_DATA_DIRECTORY_NAME).toBe(LEGACY_PRODUCT_NAME);
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
