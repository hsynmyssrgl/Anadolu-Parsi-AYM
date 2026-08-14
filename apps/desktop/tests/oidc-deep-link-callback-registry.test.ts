import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  MainOnlyOidcDeepLinkCallbackRegistry,
  OidcDeepLinkRegistryError
} from '../src/main/oidc-deep-link-callback-registry.js';

const state = 'state-value-that-is-long-and-random-enough';
const binding = Object.freeze({
  flowId: 'oidc-flow-00000001',
  provider: 'google' as const,
  accountId: 'account-00000001',
  stateSha256: createHash('sha256').update(state).digest('hex'),
  redirectUri: 'pardus-app://oidc',
  expiresAt: '2026-08-14T10:05:00.000Z'
});

describe('MainOnlyOidcDeepLinkCallbackRegistry', () => {
  it('captures one exact state-bound deep link and consumes it once without renderer projection', () => {
    const registry = new MainOnlyOidcDeepLinkCallbackRegistry(() => '2026-08-14T10:00:00.000Z');
    registry.register(binding);
    expect(registry.captureFromArguments(['app.exe', `pardus-app://oidc?code=authorization-code-value&state=${state}`])).toBe(true);
    const captured = registry.take({ flowId: binding.flowId, provider: 'google', accountId: binding.accountId });
    expect(captured.callbackUrl).toContain('authorization-code-value');
    expect(() => registry.take({ flowId: binding.flowId, provider: 'google', accountId: binding.accountId })).toThrow(OidcDeepLinkRegistryError);
    expect(Object.keys(captured)).toEqual(['flowId', 'provider', 'accountId', 'callbackUrl', 'capturedAt']);
  });

  it('rejects unknown, duplicate, expired, foreign-account and multi-callback deliveries', () => {
    const registry = new MainOnlyOidcDeepLinkCallbackRegistry(() => '2026-08-14T10:00:00.000Z');
    registry.register(binding);
    expect(() => registry.captureFromArguments(['app.exe', 'pardus-app://oidc?code=authorization-code-value&state=unknown-state-value-0000'])).toThrow(/exact state-bound/u);
    expect(() => registry.captureFromArguments(['app.exe',
      `pardus-app://oidc?code=authorization-code-value&state=${state}`,
      `pardus-app://oidc?code=another-authorization-code&state=${state}`])).toThrow(/yalniz bir/u);
    expect(registry.captureFromArguments(['app.exe', `pardus-app://oidc?code=authorization-code-value&state=${state}`])).toBe(true);
    expect(() => registry.captureFromArguments(['app.exe', `pardus-app://oidc?code=authorization-code-value&state=${state}`])).toThrow(/daha once/u);
    expect(() => registry.take({ flowId: binding.flowId, provider: 'google', accountId: 'account-foreign-0001' })).toThrow(/binding/u);

    const expired = new MainOnlyOidcDeepLinkCallbackRegistry(() => '2026-08-14T10:06:00.000Z');
    expect(() => expired.register(binding)).toThrow(/gecersiz/u);
  });

  it('rejects duplicate/unknown parameters, mixed success-error and non-exact redirect URLs', () => {
    const make = () => { const registry = new MainOnlyOidcDeepLinkCallbackRegistry(() => '2026-08-14T10:00:00.000Z'); registry.register(binding); return registry; };
    expect(() => make().captureFromArguments(['app.exe', `pardus-app://oidc?code=authorization-code-value&state=${state}&state=${state}`])).toThrow(/exact state-bound/u);
    expect(() => make().captureFromArguments(['app.exe', `pardus-app://oidc?code=authorization-code-value&state=${state}&token=secret`])).toThrow(/exact state-bound/u);
    expect(() => make().captureFromArguments(['app.exe', `pardus-app://oidc?code=authorization-code-value&error=denied&state=${state}`])).toThrow(/exact state-bound/u);
    expect(() => make().captureFromArguments(['app.exe', `pardus-app://foreign?code=authorization-code-value&state=${state}`])).toThrow(/exact state-bound/u);
    expect(() => make().captureFromArguments(['app.exe', `pardus-app://oidc/extra?code=authorization-code-value&state=${state}`])).toThrow(/exact state-bound/u);
  });

  it('bounds pending flows and ignores ordinary process arguments', () => {
    const registry = new MainOnlyOidcDeepLinkCallbackRegistry(() => '2026-08-14T10:00:00.000Z');
    expect(registry.captureFromArguments(['app.exe', '--safe-mode'])).toBe(false);
    for (let index = 0; index < 16; index += 1) {
      registry.register({ ...binding, flowId: `oidc-flow-${String(index).padStart(8, '0')}`,
        stateSha256: createHash('sha256').update(`${state}-${index}`).digest('hex') });
    }
    expect(() => registry.register({ ...binding, flowId: 'oidc-flow-over-quota',
      stateSha256: createHash('sha256').update('another-state-value').digest('hex') })).toThrow(/kotasi/u);
  });
});
