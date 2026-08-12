import { describe, expect, it } from 'vitest';
import {
  PlatformPolicyEnforcementPoint,
  createTypedPolicyEnforcementPoint
} from './src/index.js';

describe('32-V PPK-026 typed policy enforcement factory', () => {
  it('composes provider-backed enforcement without requiring an application-specific provider subtype', () => {
    const point = createTypedPolicyEnforcementPoint({
      provider: {
        authorize: () => { throw new Error('not-executed'); },
        verify: () => false
      },
      authorityResolver: { resolve: () => { throw new Error('not-executed'); } },
      resourceResolver: { resolve: () => { throw new Error('not-executed'); } },
      receiptSink: { append: () => undefined }
    });
    expect(point).toBeInstanceOf(PlatformPolicyEnforcementPoint);
  });

  it('rejects kernel-backed or missing-provider composition at the typed factory boundary', () => {
    expect(() => createTypedPolicyEnforcementPoint({} as never)).toThrow('exactly one authorization provider');
    expect(() => createTypedPolicyEnforcementPoint({ kernel: {}, provider: undefined } as never))
      .toThrow('exactly one authorization provider');
  });
});
