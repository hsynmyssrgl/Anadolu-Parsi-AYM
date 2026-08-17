import { createHash, randomUUID } from 'node:crypto';
import {
  ERROR_CODES,
  asIsoDateTime,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import type {
  CommunicationCallPreflightPort,
  LifeApplicationContext
} from '@ppt/application';
import type {
  CommunicationCallDeviceCheck,
  VerifiedCommunicationCallPreflightInput
} from '@ppt/domain';

type PermissionCallback = (allowed: boolean) => void;
type BeforeRequestCallback = (response: Readonly<{ cancel: boolean }>) => void;

export interface CommunicationCallPreflightSessionLike {
  setPermissionRequestHandler(handler: (
    requestingContents: unknown,
    permission: string,
    callback: PermissionCallback,
    details: unknown
  ) => void): void;
  setPermissionCheckHandler(handler: (
    requestingContents: unknown,
    permission: string,
    requestingOrigin: string,
    details: unknown
  ) => boolean): void;
  setDisplayMediaRequestHandler?(handler: (
    request: unknown,
    callback: (streams: Readonly<{ video?: unknown; audio?: unknown }>) => void
  ) => void): void;
  webRequest: {
    onBeforeRequest(
      filter: Readonly<{ urls: readonly string[] }>,
      listener: (details: Readonly<{ url: string }>, callback: BeforeRequestCallback) => void
    ): void;
  };
}

export interface CommunicationCallPreflightWebContentsLike {
  readonly session: CommunicationCallPreflightSessionLike;
  executeJavaScript<T>(code: string, userGesture?: boolean): Promise<T>;
  setWindowOpenHandler(handler: () => Readonly<{ action: 'deny' }>): void;
  on(event: 'will-navigate' | 'will-redirect', listener: (event: { preventDefault(): void }) => void): void;
}

export interface CommunicationCallPreflightWindowLike {
  readonly webContents: CommunicationCallPreflightWebContentsLike;
  loadURL(url: string): Promise<void>;
  isDestroyed(): boolean;
  destroy(): void;
}

export interface CommunicationCallPreflightWindowFactory {
  create(options: Readonly<{
    show: false;
    width: 1;
    height: 1;
    frame: false;
    skipTaskbar: true;
    webPreferences: Readonly<{
      nodeIntegration: false;
      contextIsolation: true;
      sandbox: true;
      webSecurity: true;
      devTools: false;
      spellcheck: false;
      partition: string;
    }>;
  }>): CommunicationCallPreflightWindowLike;
}

export interface ElectronCommunicationCallPreflightOptions {
  readonly windows: CommunicationCallPreflightWindowFactory;
  readonly clock: () => string;
  readonly timeoutMs?: number;
}

interface ProbeResult {
  readonly microphone: Exclude<CommunicationCallDeviceCheck, 'not_run'>;
  readonly camera: Exclude<CommunicationCallDeviceCheck, 'not_run'>;
  readonly speaker: Exclude<CommunicationCallDeviceCheck, 'not_run'>;
}

const PROVIDER_ID = 'electron-isolated-local-media-preflight-v1';
const CHECKS = new Set<CommunicationCallDeviceCheck>(['passed', 'failed', 'not_available']);
const DOCUMENT = `data:text/html;charset=utf-8,${encodeURIComponent(
  '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; connect-src \'none\'; img-src \'none\'; media-src \'none\'; object-src \'none\'; frame-src \'none\'"></head><body></body></html>'
)}`;

const exactProbeResult = (value: unknown): value is ProbeResult => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const candidate = value as Record<string, unknown>;
  return Object.keys(candidate).sort().join(',') === 'camera,microphone,speaker'
    && CHECKS.has(candidate.microphone as CommunicationCallDeviceCheck)
    && CHECKS.has(candidate.camera as CommunicationCallDeviceCheck)
    && CHECKS.has(candidate.speaker as CommunicationCallDeviceCheck);
};

const failure = (context: LifeApplicationContext, message: string): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  category: 'security',
  message,
  correlationId: context.correlationId
}));

const mediaTypesOnly = (details: unknown): boolean => {
  if (!details || typeof details !== 'object') return true;
  const mediaTypes = (details as { readonly mediaTypes?: unknown }).mediaTypes;
  return mediaTypes === undefined || (Array.isArray(mediaTypes) && mediaTypes.length > 0
    && mediaTypes.length <= 2 && mediaTypes.every((item) => item === 'audio' || item === 'video'));
};

export class ElectronCommunicationCallPreflightPort implements CommunicationCallPreflightPort {
  readonly #timeoutMs: number;
  public constructor(private readonly options: ElectronCommunicationCallPreflightOptions) {
    this.#timeoutMs = options.timeoutMs ?? 15_000;
    if (!Number.isSafeInteger(this.#timeoutMs) || this.#timeoutMs < 100 || this.#timeoutMs > 30_000)
      throw new Error('Communication call preflight timeout is outside the bounded policy');
  }

  public async run(
    context: LifeApplicationContext,
    input: Parameters<CommunicationCallPreflightPort['run']>[1]
  ): Promise<Result<VerifiedCommunicationCallPreflightInput, AppError>> {
    const window = this.options.windows.create(Object.freeze({
      show: false,
      width: 1,
      height: 1,
      frame: false,
      skipTaskbar: true,
      webPreferences: Object.freeze({
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        devTools: false,
        spellcheck: false,
        partition: `communication-call-preflight-${randomUUID()}`
      })
    }));
    const contents = window.webContents;
    contents.setWindowOpenHandler(() => Object.freeze({ action: 'deny' as const }));
    contents.on('will-navigate', (event) => event.preventDefault());
    contents.on('will-redirect', (event) => event.preventDefault());
    contents.session.setPermissionRequestHandler((requestingContents, permission, callback, details) => {
      callback(requestingContents === contents && permission === 'media' && mediaTypesOnly(details));
    });
    contents.session.setPermissionCheckHandler((requestingContents, permission) =>
      requestingContents === contents && permission === 'media');
    contents.session.setDisplayMediaRequestHandler?.((_request, callback) => callback(Object.freeze({})));
    contents.session.webRequest.onBeforeRequest({ urls: ['*://*/*', 'data:*', 'about:*'] }, (details, callback) => {
      callback(Object.freeze({ cancel: !details.url.startsWith('data:') && details.url !== 'about:blank' }));
    });

    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const constraintFlags = [
        input.noiseReductionRequested,
        input.echoCancellationRequested,
        input.automaticGainControlRequested
      ].map((enabled) => enabled ? '1' : '0').join('');
      await window.loadURL(`${DOCUMENT}#${constraintFlags}`);
      const result = await Promise.race([
        contents.executeJavaScript<unknown>(`
(async()=>{
  const flags=globalThis.location.hash.slice(1);
  if(!/^[01]{3}$/.test(flags)) throw new Error('INVALID_MEDIA_CONSTRAINT_FLAGS');
  const classify=(error)=>error&&typeof error==='object'&&['NotFoundError','DevicesNotFoundError'].includes(String(error.name))
    ?'not_available':'failed';
  let microphone='failed',camera='failed',speaker='failed';
  let audioStream=null,videoStream=null,audioContext=null;
  try {
    try {
      audioStream=await navigator.mediaDevices.getUserMedia({audio:{
        noiseSuppression:flags[0]==='1',
        echoCancellation:flags[1]==='1',
        autoGainControl:flags[2]==='1'
      },video:false});
      microphone=audioStream.getAudioTracks().some((track)=>track.readyState==='live')?'passed':'failed';
    } catch(error) { microphone=classify(error); }
    try {
      videoStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:15,max:30}}});
      camera=videoStream.getVideoTracks().some((track)=>track.readyState==='live')?'passed':'failed';
    } catch(error) { camera=classify(error); }
    try {
      const devices=await navigator.mediaDevices.enumerateDevices();
      const AudioContextCtor=globalThis.AudioContext||globalThis.webkitAudioContext;
      if(!AudioContextCtor||!devices.some((device)=>device.kind==='audiooutput')) speaker='not_available';
      else {
        audioContext=new AudioContextCtor({latencyHint:'interactive'});
        await audioContext.resume();
        const oscillator=audioContext.createOscillator();
        const gain=audioContext.createGain();gain.gain.value=0;
        oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+0.02);
        speaker=audioContext.state==='running'?'passed':'failed';
      }
    } catch(error) { speaker=classify(error); }
    return Object.freeze({microphone,camera,speaker});
  } finally {
    for(const stream of [audioStream,videoStream]) if(stream) for(const track of stream.getTracks()) track.stop();
    if(audioContext) await audioContext.close().catch(()=>undefined);
  }
})()`, true),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error('LOCAL_MEDIA_PREFLIGHT_TIMEOUT')), this.#timeoutMs);
        })
      ]);
      if (!exactProbeResult(result)) return failure(context, 'Yerel medya preflight sonucu güvenilir değildir.');
      const observedAt = asIsoDateTime(this.options.clock());
      const providerEvidenceSha256 = createHash('sha256').update(JSON.stringify({
        schemaVersion: 1,
        providerId: PROVIDER_ID,
        sessionId: input.sessionId,
        requestedMediaMode: input.requestedMediaMode,
        constraints: {
          noiseReductionRequested: input.noiseReductionRequested,
          echoCancellationRequested: input.echoCancellationRequested,
          automaticGainControlRequested: input.automaticGainControlRequested
        },
        result,
        observedAt,
        networkUsed: false
      }), 'utf8').digest('hex');
      return ok(Object.freeze({
        sessionId: input.sessionId,
        microphone: result.microphone,
        camera: result.camera,
        speaker: result.speaker,
        providerId: PROVIDER_ID,
        providerEvidenceSha256,
        providerVerified: true as const,
        networkUsed: false as const,
        observedAt
      }));
    } catch {
      return failure(context, 'Yerel kamera, mikrofon ve hoparlör preflight işlemi tamamlanamadı.');
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      if (!window.isDestroyed()) window.destroy();
    }
  }
}
