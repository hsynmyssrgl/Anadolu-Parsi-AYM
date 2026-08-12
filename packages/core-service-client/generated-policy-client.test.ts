import { describe, expect, it } from 'vitest';
import type {
  CoreServiceMethodPayload,
  CoreServiceMethodResult,
  PolicyAuthorizationContractResult,
  PolicyReceiptVerificationContractResult
} from '@ppt/core-service-contracts';
import {
  GENERATED_POLICY_CLIENT_GENERATOR_VERSION,
  GENERATED_POLICY_CLIENT_SCHEMA_VERSION,
  GeneratedPolicyServiceClient,
  type GeneratedPolicyClientTransport,
  type GeneratedPolicyMethod
} from './src/generated-policy-client.js';

describe('32-V PPK-026 deterministic generated policy client', () => {
  it('exposes only the exact governed policy method set and delegates typed payloads unchanged', async () => {
    const authorizationResult = {
      effectiveRequest: { marker: 'effective' },
      authorization: { marker: 'authorization' },
      fence: { writable: true, epoch: 26 }
    } as unknown as PolicyAuthorizationContractResult;
    const verificationResult = {
      valid: true,
      fence: { writable: true, epoch: 26 }
    } satisfies PolicyReceiptVerificationContractResult;
    const calls: Array<{ method: GeneratedPolicyMethod; payload: unknown }> = [];
    const transport: GeneratedPolicyClientTransport = {
      request: async <TMethod extends GeneratedPolicyMethod>(
        method: TMethod,
        payload: CoreServiceMethodPayload<TMethod>
      ): Promise<CoreServiceMethodResult<TMethod>> => {
        calls.push({ method, payload });
        return (method === 'policy.authorize' ? authorizationResult : verificationResult) as CoreServiceMethodResult<TMethod>;
      }
    };
    const client = new GeneratedPolicyServiceClient(transport);
    const authorizePayload = { request: { marker: 'request' }, nonce: 'nonce-32-v' } as never;
    const verifyPayload = { request: { marker: 'request' }, receipt: { marker: 'receipt' } } as never;

    await expect(client.authorize(authorizePayload)).resolves.toBe(authorizationResult);
    await expect(client.verify(verifyPayload)).resolves.toBe(verificationResult);
    expect(calls).toEqual([
      { method: 'policy.authorize', payload: authorizePayload },
      { method: 'policy.verify', payload: verifyPayload }
    ]);
    expect(Object.getOwnPropertyNames(GeneratedPolicyServiceClient.prototype).sort())
      .toEqual(['authorize', 'constructor', 'verify']);
    expect(GENERATED_POLICY_CLIENT_SCHEMA_VERSION).toBe(1);
    expect(GENERATED_POLICY_CLIENT_GENERATOR_VERSION).toBe('1.0.0');
  });

  it('fails closed when the generated transport is absent', () => {
    expect(() => new GeneratedPolicyServiceClient(undefined as never)).toThrow('transport is unavailable');
  });
});
