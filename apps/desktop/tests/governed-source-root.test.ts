import { describe, expect, it } from 'vitest';
import {
  assertGovernedSourceRoot,
  classifyGovernedSourceRoot
} from '../../../scripts/lib/governed-source-root.mjs';

describe('governed source root', () => {
  it('ana kaynağı yazan ve salt-okunur doğrulamalar için kabul eder', () => {
    expect(classifyGovernedSourceRoot({
      root: 'C:\\PPT\\AYM\\06_KOD\\app'
    })).toMatchObject({ kind: 'AUTHORITATIVE', channel: null });
    expect(assertGovernedSourceRoot()).toBe(process.cwd());
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
