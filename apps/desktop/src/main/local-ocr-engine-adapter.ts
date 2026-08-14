import {
  LocalOcrSecurityError,
  type BoundedLocalOcrSource,
  type InspectedLocalOcrSource,
  type LocalOcrMediaType,
  type LocalOcrPageInspection
} from '@ppt/security';

export interface LocalOcrWorkerQuotas {
  readonly timeoutMs: number;
  readonly memoryLimitMiB: number;
  readonly outputLimitBytes: number;
}

export interface LocalOcrEngineDescriptor {
  readonly configured: boolean;
  readonly engineId: string;
  readonly provider: 'windows_media_ocr' | 'not_configured';
  readonly executionBoundary: 'bounded-child-process' | 'none';
  readonly localOnly: true;
  readonly networkAccess: false;
  readonly cloudProcessing: false;
  readonly inputTransferredByPath: false;
  readonly temporaryPlaintextCreated: false;
  readonly processSeparated: boolean;
  readonly lowPrivilegeSandboxVerified: false;
  readonly resourceLimitsEnforcedPerJob: boolean;
  readonly supportedMediaTypes: readonly LocalOcrMediaType[];
  readonly confidenceAvailable: boolean;
}

export interface LocalOcrEnginePort {
  descriptor(): LocalOcrEngineDescriptor;
  inspect(source: InspectedLocalOcrSource, signal: AbortSignal): Promise<LocalOcrPageInspection>;
  recognize(
    source: BoundedLocalOcrSource,
    quotas: LocalOcrWorkerQuotas,
    signal: AbortSignal
  ): Promise<unknown>;
}

export class NotConfiguredLocalOcrEngineAdapter implements LocalOcrEnginePort {
  public descriptor(): LocalOcrEngineDescriptor {
    return Object.freeze({
      configured: false,
      engineId: 'local-ocr-not-configured',
      provider: 'not_configured',
      executionBoundary: 'none',
      localOnly: true,
      networkAccess: false,
      cloudProcessing: false,
      inputTransferredByPath: false,
      temporaryPlaintextCreated: false,
      processSeparated: false,
      lowPrivilegeSandboxVerified: false,
      resourceLimitsEnforcedPerJob: false,
      supportedMediaTypes: Object.freeze([]),
      confidenceAvailable: false
    });
  }

  public async inspect(_source: InspectedLocalOcrSource, _signal: AbortSignal): Promise<LocalOcrPageInspection> {
    throw new LocalOcrSecurityError('NOT_CONFIGURED');
  }

  public async recognize(
    _source: BoundedLocalOcrSource,
    _quotas: LocalOcrWorkerQuotas,
    _signal: AbortSignal
  ): Promise<unknown> {
    throw new LocalOcrSecurityError('NOT_CONFIGURED');
  }
}
