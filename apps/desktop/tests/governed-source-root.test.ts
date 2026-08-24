import { describe, expect, it } from 'vitest';
import {
  assertGovernedSourceRoot,
  classifyGovernedSourceRoot
} from '../../../scripts/lib/governed-source-root.mjs';

describe('governed source root', () => {
  it('ana kaynağı yazan ve salt-okunur doğrulamalar için kabul eder', () => {
    const authoritativeRoot = 'C:\\PPT\\AYM\\06_KOD\\app';
    expect(classifyGovernedSourceRoot({
      root: authoritativeRoot
    })).toMatchObject({ kind: 'AUTHORITATIVE', channel: null });
    expect(assertGovernedSourceRoot({ root: authoritativeRoot })).toBe(authoritativeRoot);
  });

  it('mevcut exact worktree kökünü ana kaynakta veya kanal checkoutunda kabul eder', () => {
    expect(classifyGovernedSourceRoot({
      root: process.cwd(),
      allowReleaseChannel: true
    })).toMatchObject({ root: process.cwd() });
    expect(assertGovernedSourceRoot({ allowReleaseChannel: true })).toBe(process.cwd());
  });

  it.each(['Bronze', 'Silver', 'Gold'])('%s kanalını yalnız açık salt-okunur yetkiyle kabul eder', (channel) => {
    const root = `C:\\PPT\\AYM\\06_KOD\\kanallar\\${channel}`;
    expect(() => classifyGovernedSourceRoot({ root })).toThrow('Unsafe source root');
    expect(classifyGovernedSourceRoot({ root, allowReleaseChannel: true })).toMatchObject({
      kind: 'RELEASE_CHANNEL',
      channel
    });
  });

  it.each([
    'C:\\PPT\\AYM\\06_KOD',
    'C:\\PPT\\AYM\\06_KOD\\kanallar',
    'C:\\PPT\\AYM\\06_KOD\\kanallar\\Bronze\\scripts',
    'C:\\PPT\\AYM\\06_KOD\\kanallar\\Unknown'
  ])('izinli kök dışındaki yolu reddeder: %s', (root) => {
    expect(() => classifyGovernedSourceRoot({ root, allowReleaseChannel: true })).toThrow('Unsafe source root');
  });
});
