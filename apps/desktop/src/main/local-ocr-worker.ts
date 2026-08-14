import {
  LOCAL_OCR_DEFAULT_MEMORY_LIMIT_MIB,
  LOCAL_OCR_DEFAULT_TIMEOUT_MS,
  LOCAL_OCR_MAX_OUTPUT_BYTES,
  LocalOcrSecurityError,
  bindLocalOcrPageInspection,
  inspectLocalOcrSource,
  validateLocalOcrResult,
  type InspectedLocalOcrSource,
  type LocalOcrMediaType,
  type LocalOcrResult
} from '@ppt/security';
import type {
  LocalOcrEngineDescriptor,
  LocalOcrEnginePort,
  LocalOcrWorkerQuotas
} from './local-ocr-engine-adapter.js';

export type LocalOcrMalwareVerdict = 'clean' | 'malicious' | 'unknown' | 'scanner-error';

export interface LocalOcrMalwareScannerDescriptor {
  readonly configured: boolean;
  readonly scannerId: string;
  readonly localOnly: true;
  readonly networkAccess: false;
  readonly cloudProcessing: false;
}

export interface LocalOcrMalwareScanRequest {
  readonly inputSha256: string;
  readonly mediaType: LocalOcrMediaType;
  readonly sizeBytes: number;
  readonly bytes: Uint8Array;
}

export interface LocalOcrMalwareScanResult {
  readonly schemaVersion: 1;
  readonly scannerId: string;
  readonly inputSha256: string;
  readonly sizeBytes: number;
  readonly verdict: LocalOcrMalwareVerdict;
  readonly localOnly: true;
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export interface LocalOcrMalwareVerdictPort {
  descriptor(): LocalOcrMalwareScannerDescriptor;
  scan(request: LocalOcrMalwareScanRequest, signal: AbortSignal): Promise<LocalOcrMalwareScanResult>;
}

export interface BoundedLocalOcrWorkerOptions {
  readonly timeoutMs?: number;
  readonly memoryLimitMiB?: number;
  readonly outputLimitBytes?: number;
}

const ENGINE_DESCRIPTOR_KEYS = Object.freeze([
  'configured', 'engineId', 'provider', 'executionBoundary', 'localOnly', 'networkAccess', 'cloudProcessing',
  'inputTransferredByPath', 'temporaryPlaintextCreated', 'processSeparated', 'lowPrivilegeSandboxVerified',
  'resourceLimitsEnforcedPerJob', 'supportedMediaTypes', 'confidenceAvailable'
]);
const SCANNER_DESCRIPTOR_KEYS = Object.freeze([
  'configured', 'scannerId', 'localOnly', 'networkAccess', 'cloudProcessing'
]);
const SCAN_RESULT_KEYS = Object.freeze([
  'schemaVersion', 'scannerId', 'inputSha256', 'sizeBytes', 'verdict', 'localOnly', 'networkUsed', 'cloudUsed'
]);
const SHA256 = /^[0-9a-f]{64}$/u;
const COMPONENT_ID = /^[a-z0-9][a-z0-9._-]{2,63}$/u;
const MEDIA_TYPES = new Set<LocalOcrMediaType>(['image/png', 'image/jpeg', 'application/pdf']);

const plainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const exactKeys = (value: object, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};
const fail = (code: ConstructorParameters<typeof LocalOcrSecurityError>[0]): never => {
  throw new LocalOcrSecurityError(code);
};

const validateEngineDescriptor = (value: LocalOcrEngineDescriptor, mediaType: LocalOcrMediaType): void => {
  if (!plainRecord(value) || !exactKeys(value, ENGINE_DESCRIPTOR_KEYS)
    || typeof value.configured !== 'boolean' || typeof value.engineId !== 'string' || !COMPONENT_ID.test(value.engineId)
    || !['windows_media_ocr', 'not_configured'].includes(value.provider)
    || !['bounded-child-process', 'none'].includes(value.executionBoundary)
    || value.localOnly !== true || value.networkAccess !== false || value.cloudProcessing !== false
    || value.inputTransferredByPath !== false || value.temporaryPlaintextCreated !== false
    || typeof value.processSeparated !== 'boolean' || value.lowPrivilegeSandboxVerified !== false
    || typeof value.resourceLimitsEnforcedPerJob !== 'boolean' || typeof value.confidenceAvailable !== 'boolean'
    || !Array.isArray(value.supportedMediaTypes)
    || value.supportedMediaTypes.some((item) => !MEDIA_TYPES.has(item))
    || new Set(value.supportedMediaTypes).size !== value.supportedMediaTypes.length) fail('ENGINE_FAILURE');
  if (!value.configured) fail('NOT_CONFIGURED');
  if (value.provider !== 'windows_media_ocr' || value.executionBoundary !== 'bounded-child-process' || value.processSeparated !== true
    || value.resourceLimitsEnforcedPerJob !== true) fail('MEMORY_LIMIT_UNATTESTED');
  if (!value.supportedMediaTypes.includes(mediaType)) fail('UNSUPPORTED_MEDIA');
};

const validateScannerDescriptor = (value: LocalOcrMalwareScannerDescriptor): void => {
  if (!plainRecord(value) || !exactKeys(value, SCANNER_DESCRIPTOR_KEYS)
    || typeof value.configured !== 'boolean' || typeof value.scannerId !== 'string' || !COMPONENT_ID.test(value.scannerId)
    || value.localOnly !== true || value.networkAccess !== false || value.cloudProcessing !== false) fail('MALWARE_NOT_CLEAN');
  if (!value.configured) fail('NOT_CONFIGURED');
};

const validateCleanVerdict = (
  value: LocalOcrMalwareScanResult,
  descriptor: LocalOcrMalwareScannerDescriptor,
  source: InspectedLocalOcrSource
): void => {
  if (!plainRecord(value) || !exactKeys(value, SCAN_RESULT_KEYS) || value.schemaVersion !== 1
    || value.scannerId !== descriptor.scannerId || !COMPONENT_ID.test(value.scannerId)
    || value.inputSha256 !== source.sha256 || !SHA256.test(value.inputSha256) || value.sizeBytes !== source.sizeBytes
    || !['clean', 'malicious', 'unknown', 'scanner-error'].includes(value.verdict)
    || value.localOnly !== true || value.networkUsed !== false || value.cloudUsed !== false
    || value.verdict !== 'clean') fail('MALWARE_NOT_CLEAN');
};

const reinspect = (source: InspectedLocalOcrSource): InspectedLocalOcrSource => inspectLocalOcrSource({
  fileName: source.fileName,
  mediaType: source.mediaType,
  bytes: source.bytes,
  expectedSha256: source.sha256
});

const normalizeQuotas = (options: BoundedLocalOcrWorkerOptions | undefined): LocalOcrWorkerQuotas => {
  if (options !== undefined && (!plainRecord(options)
    || Object.keys(options).some((key) => !['timeoutMs', 'memoryLimitMiB', 'outputLimitBytes'].includes(key)))) fail('INPUT_INVALID');
  const configured = options as BoundedLocalOcrWorkerOptions | undefined;
  const timeoutMs = configured?.timeoutMs ?? LOCAL_OCR_DEFAULT_TIMEOUT_MS;
  const memoryLimitMiB = configured?.memoryLimitMiB ?? LOCAL_OCR_DEFAULT_MEMORY_LIMIT_MIB;
  const outputLimitBytes = configured?.outputLimitBytes ?? LOCAL_OCR_MAX_OUTPUT_BYTES;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > LOCAL_OCR_DEFAULT_TIMEOUT_MS
    || !Number.isInteger(memoryLimitMiB) || memoryLimitMiB < 128 || memoryLimitMiB > LOCAL_OCR_DEFAULT_MEMORY_LIMIT_MIB
    || !Number.isInteger(outputLimitBytes) || outputLimitBytes < 4_096 || outputLimitBytes > LOCAL_OCR_MAX_OUTPUT_BYTES) {
    fail('INPUT_INVALID');
  }
  return Object.freeze({ timeoutMs, memoryLimitMiB, outputLimitBytes });
};

export class NotConfiguredLocalOcrMalwareVerdictAdapter implements LocalOcrMalwareVerdictPort {
  public descriptor(): LocalOcrMalwareScannerDescriptor {
    return Object.freeze({
      configured: false,
      scannerId: 'malware-scanner-not-configured',
      localOnly: true,
      networkAccess: false,
      cloudProcessing: false
    });
  }

  public async scan(_request: LocalOcrMalwareScanRequest, _signal: AbortSignal): Promise<LocalOcrMalwareScanResult> {
    throw new LocalOcrSecurityError('NOT_CONFIGURED');
  }
}

/**
 * One-at-a-time, fail-closed OCR coordinator. It consumes and zeroes the inspected source buffer.
 * The caller remains responsible for zeroing the original archive-vault read buffer after inspection.
 */
export class BoundedLocalOcrWorker {
  readonly #engine: LocalOcrEnginePort;
  readonly #malwareScanner: LocalOcrMalwareVerdictPort;
  readonly #quotas: LocalOcrWorkerQuotas;
  #active = false;

  public constructor(
    engine: LocalOcrEnginePort,
    malwareScanner: LocalOcrMalwareVerdictPort,
    options?: BoundedLocalOcrWorkerOptions
  ) {
    if (!engine || typeof engine.descriptor !== 'function' || typeof engine.inspect !== 'function' || typeof engine.recognize !== 'function'
      || !malwareScanner || typeof malwareScanner.descriptor !== 'function' || typeof malwareScanner.scan !== 'function') fail('INPUT_INVALID');
    this.#engine = engine;
    this.#malwareScanner = malwareScanner;
    this.#quotas = normalizeQuotas(options);
  }

  public quotas(): LocalOcrWorkerQuotas {
    return this.#quotas;
  }

  public async run(source: InspectedLocalOcrSource, signal?: AbortSignal): Promise<LocalOcrResult> {
    if (this.#active) fail('CAPACITY_EXCEEDED');
    this.#active = true;
    let trusted: InspectedLocalOcrSource | undefined;
    try {
      trusted = inspectLocalOcrSource({
        fileName: source.fileName,
        mediaType: source.mediaType,
        bytes: source.bytes,
        expectedSha256: source.sha256
      });
      return await this.#runWithDeadline(trusted, signal);
    } catch (error) {
      if (error instanceof LocalOcrSecurityError) throw error;
      throw new LocalOcrSecurityError('ENGINE_FAILURE');
    } finally {
      trusted?.bytes.fill(0);
      if (source?.bytes instanceof Uint8Array) source.bytes.fill(0);
      this.#active = false;
    }
  }

  async #runWithDeadline(source: InspectedLocalOcrSource, externalSignal?: AbortSignal): Promise<LocalOcrResult> {
    const controller = new AbortController();
    let terminalError: LocalOcrSecurityError | undefined;
    const abort = (code: 'CANCELLED' | 'TIMEOUT'): void => {
      if (terminalError) return;
      terminalError = new LocalOcrSecurityError(code);
      controller.abort();
    };
    const cancel = (): void => abort('CANCELLED');
    externalSignal?.addEventListener('abort', cancel, { once: true });
    if (externalSignal?.aborted) cancel();
    const timeout = setTimeout(() => abort('TIMEOUT'), this.#quotas.timeoutMs);
    timeout.unref();
    const abortGate = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener('abort', () => reject(terminalError ?? new LocalOcrSecurityError('CANCELLED')), { once: true });
      if (controller.signal.aborted) reject(terminalError ?? new LocalOcrSecurityError('CANCELLED'));
    });
    try {
      return await Promise.race([this.#execute(source, controller.signal), abortGate]);
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', cancel);
      if (!controller.signal.aborted) controller.abort();
    }
  }

  async #execute(initialSource: InspectedLocalOcrSource, signal: AbortSignal): Promise<LocalOcrResult> {
    let current = initialSource;
    try {
      if (signal.aborted) fail('CANCELLED');
      const engineDescriptor = this.#engine.descriptor();
      validateEngineDescriptor(engineDescriptor, current.mediaType);
      const scannerDescriptor = this.#malwareScanner.descriptor();
      validateScannerDescriptor(scannerDescriptor);
      const verdict = await this.#malwareScanner.scan(Object.freeze({
        inputSha256: current.sha256,
        mediaType: current.mediaType,
        sizeBytes: current.sizeBytes,
        bytes: current.bytes
      }), signal);
      if (signal.aborted) fail('CANCELLED');
      validateCleanVerdict(verdict, scannerDescriptor, current);
      let refreshed = reinspect(current);
      current.bytes.fill(0);
      current = refreshed;
      const inspection = await this.#engine.inspect(current, signal);
      if (signal.aborted) fail('CANCELLED');
      refreshed = reinspect(current);
      current.bytes.fill(0);
      current = refreshed;
      const bounded = bindLocalOcrPageInspection(current, inspection);
      const rawResult = await this.#engine.recognize(bounded, this.#quotas, signal);
      if (signal.aborted) fail('CANCELLED');
      refreshed = reinspect(current);
      current.bytes.fill(0);
      current = refreshed;
      const validated = validateLocalOcrResult(rawResult, bindLocalOcrPageInspection(current, inspection), {
        memoryLimitMiB: this.#quotas.memoryLimitMiB,
        timeLimitMs: this.#quotas.timeoutMs,
        outputLimitBytes: this.#quotas.outputLimitBytes
      });
      if (validated.engineId !== engineDescriptor.engineId) fail('ENGINE_FAILURE');
      if (!engineDescriptor.confidenceAvailable && (validated.confidence.available
        || validated.languages.some((language) => language.confidence.available)
        || validated.layout.some((block) => block.confidence.available))) fail('ENGINE_FAILURE');
      return validated;
    } finally {
      current.bytes.fill(0);
    }
  }
}
