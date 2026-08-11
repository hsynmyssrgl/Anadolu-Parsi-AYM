import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PlatformPolicyKernel } from '@ppt/platform-policy';
import { CoreServiceRuntime } from '../src/core-service-runtime.js';
import {
  CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES,
  CoreServiceFamilyDataCutoverError,
  CoreServiceFamilyDataCutoverGuard
} from '../src/family-data-cutover-guard.js';

const clock = (): string => '2026-08-10T20:30:00.000Z';

describe('31-J family-data cutover default-deny guard', () => {
  it('reports an immutable no-cutover decision without exposing sensitive material', () => {
    const status = new CoreServiceFamilyDataCutoverGuard(clock).status();
    expect(status).toMatchObject({
      mode: 'coexistence-no-cutover',
      decision: 'blocked',
      cutoverEpoch: 0,
      legacyDesktopDataActive: true,
      realDataTransferAllowed: false,
      writeOwnershipTransferAllowed: false,
      automaticActivationAllowed: false,
      cutoverAuthorityAttached: false,
      persistentPathExposed: false,
      secretMaterialExposed: false
    });
    expect(status.requiredGates).toEqual(CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES.map((id) => ({ id, status: 'pending' })));
    expect(Object.isFrozen(status)).toBe(true);
    expect(Object.isFrozen(status.requiredGates)).toBe(true);
    expect(status.requiredGates.every(Object.isFrozen)).toBe(true);
  });

  it('blocks session attachment at the Core Service composition boundary', () => {
    const policyVersion = 'PPT-PLATFORM-POLICY-2026-08-04-V1';
    const runtime = new CoreServiceRuntime({
      policyKernel: new PlatformPolicyKernel({
        policyVersion,
        signingKey: randomBytes(32),
        applicationCapabilities: {},
        consentRequiredCapabilities: [],
        onlineOnlyCapabilities: [],
        writeActions: []
      }),
      policyVersion,
      clock
    });
    expect(() => runtime.attachFamilyDataSession({ mode: 'read-only', close: () => undefined })).toThrowError(CoreServiceFamilyDataCutoverError);
    expect(runtime.familyDataStatus()).toMatchObject({ owner: 'desktop-transition', lifecycle: 'detached', protectedSessionAttached: false });
    expect(runtime.familyDataCutoverStatus()).toMatchObject({ decision: 'blocked', realDataTransferAllowed: false });
  });
});
