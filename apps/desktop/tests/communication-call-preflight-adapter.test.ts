import { asCorrelationId, asFamilyId, asPersonId, asUserId } from '@ppt/core';
import { describe, expect, it, vi } from 'vitest';
import type { LifeApplicationContext } from '@ppt/application';
import {
  ElectronCommunicationCallPreflightPort,
  type CommunicationCallPreflightSessionLike,
  type CommunicationCallPreflightWebContentsLike,
  type CommunicationCallPreflightWindowLike
} from '../src/main/communication-call-preflight-adapter.js';

const CONTEXT: LifeApplicationContext = Object.freeze({
  familyId: asFamilyId('family-call-preflight-test'),
  actor: Object.freeze({
    userId: asUserId('account-call-preflight-test'),
    personId: asPersonId('person-call-preflight-test'),
    role: 'family_admin' as const
  }),
  correlationId: asCorrelationId('call-preflight-adapter-test')
});

const INPUT = Object.freeze({
  sessionId: 'communication-call-preflight-session',
  requestedMediaMode: 'video' as const,
  noiseReductionRequested: true,
  echoCancellationRequested: true,
  automaticGainControlRequested: true
});

const fixture = (result: unknown, executeError?: Error) => {
  let requestHandler: Parameters<CommunicationCallPreflightSessionLike['setPermissionRequestHandler']>[0] | undefined;
  let checkHandler: Parameters<CommunicationCallPreflightSessionLike['setPermissionCheckHandler']>[0] | undefined;
  let displayHandler: Parameters<NonNullable<CommunicationCallPreflightSessionLike['setDisplayMediaRequestHandler']>>[0] | undefined;
  let beforeRequest: ((details: Readonly<{ url: string }>, callback: (response: Readonly<{ cancel: boolean }>) => void) => void) | undefined;
  let windowOpen: (() => Readonly<{ action: 'deny' }>) | undefined;
  const prevented: string[] = [];
  const session: CommunicationCallPreflightSessionLike = {
    setPermissionRequestHandler: (handler) => { requestHandler = handler; },
    setPermissionCheckHandler: (handler) => { checkHandler = handler; },
    setDisplayMediaRequestHandler: (handler) => { displayHandler = handler; },
    webRequest: { onBeforeRequest: (_filter, listener) => { beforeRequest = listener; } }
  };
  const contents: CommunicationCallPreflightWebContentsLike = {
    session,
    executeJavaScript: vi.fn(async () => {
      if (executeError) throw executeError;
      return result;
    }),
    setWindowOpenHandler: (handler) => { windowOpen = handler; },
    on: (event, listener) => listener({ preventDefault: () => prevented.push(event) })
  };
  let destroyed = false;
  const window: CommunicationCallPreflightWindowLike = {
    webContents: contents,
    loadURL: vi.fn(async () => undefined),
    isDestroyed: () => destroyed,
    destroy: vi.fn(() => { destroyed = true; })
  };
  let options: unknown;
  const adapter = new ElectronCommunicationCallPreflightPort({
    windows: { create: (value) => { options = value; return window; } },
    clock: () => '2026-08-17T06:30:00.000Z'
  });
  return {
    adapter,
    contents,
    window,
    get options() { return options; },
    get requestHandler() { return requestHandler; },
    get checkHandler() { return checkHandler; },
    get displayHandler() { return displayHandler; },
    get beforeRequest() { return beforeRequest; },
    get windowOpen() { return windowOpen; },
    prevented
  };
};

describe('34-C isolated local media preflight adapter', () => {
  it('runs an exact hidden sandbox probe, denies network/display capture, and returns content-free evidence', async () => {
    const value = fixture(Object.freeze({ microphone: 'passed', camera: 'passed', speaker: 'passed' }));
    const result = await value.adapter.run(CONTEXT, INPUT);
    expect(result).toMatchObject({ ok: true, value: {
      sessionId: INPUT.sessionId,
      microphone: 'passed',
      camera: 'passed',
      speaker: 'passed',
      providerId: 'electron-isolated-local-media-preflight-v1',
      providerVerified: true,
      networkUsed: false,
      observedAt: '2026-08-17T06:30:00.000Z'
    } });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.providerEvidenceSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(value.options).toMatchObject({ show: false, width: 1, height: 1, frame: false, skipTaskbar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true,
        devTools: false, spellcheck: false } });
    expect(value.windowOpen?.()).toEqual({ action: 'deny' });
    expect(value.prevented).toEqual(['will-navigate', 'will-redirect']);
    let allowed: boolean | undefined;
    value.requestHandler?.(value.contents, 'media', (decision) => { allowed = decision; }, { mediaTypes: ['audio', 'video'] });
    expect(allowed).toBe(true);
    value.requestHandler?.({}, 'media', (decision) => { allowed = decision; }, { mediaTypes: ['audio'] });
    expect(allowed).toBe(false);
    expect(value.checkHandler?.(value.contents, 'media', 'data:', {})).toBe(true);
    expect(value.checkHandler?.(value.contents, 'geolocation', 'data:', {})).toBe(false);
    let display: unknown;
    value.displayHandler?.({}, (streams) => { display = streams; });
    expect(display).toEqual({});
    let networkDecision: unknown;
    value.beforeRequest?.({ url: 'https://attacker.invalid/media' }, (decision) => { networkDecision = decision; });
    expect(networkDecision).toEqual({ cancel: true });
    expect(value.window.destroy).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toMatch(/deviceId|label|groupId|path|token|credential/iu);
  });

  it('fails closed and destroys the probe for malformed results or execution failure', async () => {
    for (const current of [
      fixture(Object.freeze({ microphone: 'passed', camera: 'passed', speaker: 'passed', deviceId: 'forged' })),
      fixture(undefined, new Error('controlled probe failure'))
    ]) {
      await expect(current.adapter.run(CONTEXT, INPUT)).resolves.toMatchObject({ ok: false });
      expect(current.window.destroy).toHaveBeenCalledOnce();
    }
  });
});
