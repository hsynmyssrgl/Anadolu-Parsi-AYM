import { createHash } from 'node:crypto';

export const LOCAL_OCR_MAX_INPUT_BYTES = 16 * 1024 * 1024;
export const LOCAL_OCR_MAX_PAGES = 50;
export const LOCAL_OCR_MAX_IMAGE_DIMENSION = 10_000;
export const LOCAL_OCR_MAX_IMAGE_PIXELS = 40_000_000;
export const LOCAL_OCR_MAX_OUTPUT_BYTES = 1024 * 1024;
export const LOCAL_OCR_MAX_TEXT_CHARACTERS = 250_000;
export const LOCAL_OCR_MAX_LAYOUT_BLOCKS = 5_000;
export const LOCAL_OCR_MAX_LANGUAGES = 4;
export const LOCAL_OCR_DEFAULT_TIMEOUT_MS = 30_000;
export const LOCAL_OCR_DEFAULT_MEMORY_LIMIT_MIB = 384;

export type LocalOcrMediaType = 'image/png' | 'image/jpeg' | 'application/pdf';
export type LocalOcrLayoutKind = 'text' | 'heading' | 'table' | 'cell' | 'figure' | 'caption';

export type LocalOcrFailureCode =
  | 'NOT_CONFIGURED'
  | 'UNSUPPORTED_MEDIA'
  | 'INPUT_INVALID'
  | 'INPUT_TOO_LARGE'
  | 'HASH_MISMATCH'
  | 'TYPE_MISMATCH'
  | 'PAGE_LIMIT_EXCEEDED'
  | 'MALWARE_NOT_CLEAN'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'MEMORY_LIMIT_UNATTESTED'
  | 'OUTPUT_LIMIT_EXCEEDED'
  | 'CAPACITY_EXCEEDED'
  | 'ENGINE_FAILURE';

const FAILURE_MESSAGES: Readonly<Record<LocalOcrFailureCode, string>> = Object.freeze({
  NOT_CONFIGURED: 'Yerel OCR sağlayıcısı yapılandırılmamıştır.',
  UNSUPPORTED_MEDIA: 'Yerel OCR bu belge türünü güvenli biçimde işleyemiyor.',
  INPUT_INVALID: 'Yerel OCR girdisi geçersizdir.',
  INPUT_TOO_LARGE: 'Yerel OCR girdisi güvenli boyut sınırını aşıyor.',
  HASH_MISMATCH: 'Yerel OCR girdi özeti eşleşmedi.',
  TYPE_MISMATCH: 'Yerel OCR dosya türü, uzantı veya magic bytes eşleşmedi.',
  PAGE_LIMIT_EXCEEDED: 'Yerel OCR sayfa sınırı aşıldı.',
  MALWARE_NOT_CLEAN: 'Yerel OCR girdisi temiz malware kararı alamadı.',
  CANCELLED: 'Yerel OCR işlemi iptal edildi.',
  TIMEOUT: 'Yerel OCR zaman sınırını aştı.',
  MEMORY_LIMIT_UNATTESTED: 'Yerel OCR worker bellek sınırı doğrulanamadı.',
  OUTPUT_LIMIT_EXCEEDED: 'Yerel OCR çıktı sınırı aşıldı.',
  CAPACITY_EXCEEDED: 'Yerel OCR worker kapasitesi geçici olarak doludur.',
  ENGINE_FAILURE: 'Yerel OCR motoru güvenli sonuç üretemedi.'
});

export class LocalOcrSecurityError extends Error {
  public constructor(public readonly code: LocalOcrFailureCode) {
    super(FAILURE_MESSAGES[code]);
    this.name = 'LocalOcrSecurityError';
  }
}

export interface LocalOcrSourceInput {
  readonly fileName: string;
  readonly mediaType: LocalOcrMediaType;
  readonly bytes: Uint8Array;
  readonly expectedSha256: string;
}

export interface InspectedLocalOcrSource {
  readonly schemaVersion: 1;
  readonly fileName: string;
  readonly mediaType: LocalOcrMediaType;
  readonly bytes: Buffer;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly intrinsicPageCount: 1 | null;
  readonly pixelWidth: number | null;
  readonly pixelHeight: number | null;
  readonly containsActivePdfContent: false;
}

export interface LocalOcrPageInspection {
  readonly inputSha256: string;
  readonly pageCount: number;
  readonly encrypted: boolean;
}

export interface BoundedLocalOcrSource extends InspectedLocalOcrSource {
  readonly pageCount: number;
}

export interface LocalOcrConfidenceMetadata {
  readonly available: boolean;
  readonly value: number | null;
}

export interface LocalOcrLanguageMetadata {
  readonly languageTag: string;
  readonly confidence: LocalOcrConfidenceMetadata;
}

export interface LocalOcrBoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface LocalOcrLayoutBlock {
  readonly id: string;
  readonly pageNumber: number;
  readonly kind: LocalOcrLayoutKind;
  readonly text: string;
  readonly boundingBox: LocalOcrBoundingBox;
  readonly confidence: LocalOcrConfidenceMetadata;
}

export interface LocalOcrExecutionMetadata {
  readonly localOnly: true;
  readonly networkUsed: false;
  readonly cloudUsed: false;
  readonly processSeparated: true;
  readonly lowPrivilegeSandboxVerified: false;
  readonly memoryLimitEnforced: true;
  readonly cpuTimeLimitEnforced: true;
  readonly timeLimitEnforced: true;
  readonly outputLimitEnforced: true;
  readonly durationMs: number;
  readonly memoryLimitMiB: number;
  readonly cpuTimeLimitMs: number;
  readonly timeLimitMs: number;
  readonly outputLimitBytes: number;
}

export interface LocalOcrResult {
  readonly schemaVersion: 1;
  readonly engineId: string;
  readonly inputSha256: string;
  readonly mediaType: LocalOcrMediaType;
  readonly pageCount: number;
  readonly text: string;
  readonly confidence: LocalOcrConfidenceMetadata;
  readonly languages: readonly LocalOcrLanguageMetadata[];
  readonly layout: readonly LocalOcrLayoutBlock[];
  readonly execution: LocalOcrExecutionMetadata;
}

const SHA256 = /^[0-9a-f]{64}$/u;
const LANGUAGE_TAG = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u;
const LAYOUT_KINDS = new Set<LocalOcrLayoutKind>(['text', 'heading', 'table', 'cell', 'figure', 'caption']);
const PDF_ACTIVE_CONTENT = /\/(?:JavaScript|JS|Launch|EmbeddedFile|RichMedia|OpenAction|AA)\b/u;
const exactKeys = (value: object, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length && actual.every((key, index) => key === canonical[index]);
};
const plainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const deepFreeze = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null) return value;
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  return Object.freeze(value);
};
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const fail = (code: LocalOcrFailureCode): never => { throw new LocalOcrSecurityError(code); };
const validLeafName = (value: unknown): value is string => typeof value === 'string'
  && value === value.trim() && value.length >= 3 && value.length <= 128
  && value !== '.' && value !== '..' && !/[\\/:\u0000-\u001f\u007f]/u.test(value)
  && !value.startsWith('.') && !value.endsWith('.') && !value.endsWith(' ');
const extensionFor = (fileName: string): string => fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
const extensionMatches = (fileName: string, mediaType: LocalOcrMediaType): boolean => {
  const extension = extensionFor(fileName);
  return mediaType === 'image/png' ? extension === '.png'
    : mediaType === 'image/jpeg' ? extension === '.jpg' || extension === '.jpeg'
      : extension === '.pdf';
};
const boundedImageDimensions = (width: number, height: number): boolean => Number.isInteger(width) && Number.isInteger(height)
  && width > 0 && height > 0 && width <= LOCAL_OCR_MAX_IMAGE_DIMENSION && height <= LOCAL_OCR_MAX_IMAGE_DIMENSION
  && width * height <= LOCAL_OCR_MAX_IMAGE_PIXELS;

const PNG_CRC_TABLE = Object.freeze(Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) === 1
    ? (0xedb88320 ^ (value >>> 1)) >>> 0
    : value >>> 1;
  return value >>> 0;
}));
const pngCrc32 = (bytes: Buffer, start: number, end: number): number => {
  let crc = 0xffffffff;
  for (let index = start; index < end; index += 1) {
    crc = (PNG_CRC_TABLE[(crc ^ bytes[index]!) & 0xff]! ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
};
const validPngBitDepth = (colorType: number, bitDepth: number): boolean => (
  (colorType === 0 && [1, 2, 4, 8, 16].includes(bitDepth))
  || (colorType === 2 && [8, 16].includes(bitDepth))
  || (colorType === 3 && [1, 2, 4, 8].includes(bitDepth))
  || (colorType === 4 && [8, 16].includes(bitDepth))
  || (colorType === 6 && [8, 16].includes(bitDepth))
);

const inspectPng = (bytes: Buffer): readonly [number, number] => {
  const magic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 45 || !bytes.subarray(0, 8).equals(magic)) fail('TYPE_MISMATCH');
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  let sawHeader = false;
  let sawPalette = false;
  let sawTransparency = false;
  let sawImageData = false;
  let imageDataClosed = false;
  let sawEnd = false;
  while (offset + 12 <= bytes.length && !sawEnd) {
    const length = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (length > LOCAL_OCR_MAX_INPUT_BYTES || chunkEnd > bytes.length) fail('TYPE_MISMATCH');
    const type = bytes.subarray(typeStart, dataStart).toString('ascii');
    if (!/^[A-Za-z]{4}$/u.test(type)) fail('TYPE_MISMATCH');
    if (type === 'IHDR') {
      if (sawHeader || offset !== 8 || length !== 13) fail('TYPE_MISMATCH');
      width = bytes.readUInt32BE(dataStart);
      height = bytes.readUInt32BE(dataStart + 4);
      const bitDepth = bytes[dataStart + 8]!;
      colorType = bytes[dataStart + 9]!;
      if (!boundedImageDimensions(width, height)) fail('INPUT_INVALID');
      if (!validPngBitDepth(colorType, bitDepth)
        || bytes[dataStart + 10] !== 0 || bytes[dataStart + 11] !== 0
        || ![0, 1].includes(bytes[dataStart + 12]!)) fail('TYPE_MISMATCH');
      sawHeader = true;
    } else if (type === 'PLTE') {
      if (!sawHeader || sawPalette || sawImageData || length < 3 || length > 768 || length % 3 !== 0
        || [0, 4].includes(colorType)) fail('TYPE_MISMATCH');
      sawPalette = true;
    } else if (type === 'tRNS') {
      const validLength = (colorType === 0 && length === 2)
        || (colorType === 2 && length === 6)
        || (colorType === 3 && sawPalette && length >= 1 && length <= 256);
      if (!sawHeader || sawTransparency || sawImageData || !validLength) fail('TYPE_MISMATCH');
      sawTransparency = true;
    } else if (type === 'IDAT') {
      if (!sawHeader || sawEnd || imageDataClosed || length === 0 || (colorType === 3 && !sawPalette)) {
        fail('TYPE_MISMATCH');
      }
      sawImageData = true;
    } else if (type === 'IEND') {
      if (!sawHeader || !sawImageData || length !== 0) fail('TYPE_MISMATCH');
      sawEnd = true;
    } else if (['cHRM', 'gAMA', 'sRGB', 'pHYs'].includes(type)) {
      const expectedLength = type === 'cHRM' ? 32 : type === 'gAMA' ? 4 : type === 'sRGB' ? 1 : 9;
      if (!sawHeader || sawImageData || length !== expectedLength) fail('TYPE_MISMATCH');
    } else {
      // Text, ICC/Exif metadata, animation and unknown chunks are outside the OCR admission profile.
      fail('TYPE_MISMATCH');
    }
    if (pngCrc32(bytes, typeStart, dataEnd) !== bytes.readUInt32BE(dataEnd)) fail('TYPE_MISMATCH');
    if (sawImageData && type !== 'IDAT' && type !== 'IEND') imageDataClosed = true;
    offset = chunkEnd;
  }
  if (!sawHeader || !sawImageData || !sawEnd || offset !== bytes.length) fail('TYPE_MISMATCH');
  return Object.freeze([width, height]);
};

const inspectJpeg = (bytes: Buffer): readonly [number, number] => {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff
    || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) fail('TYPE_MISMATCH');
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) fail('TYPE_MISMATCH');
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) fail('TYPE_MISMATCH');
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) fail('TYPE_MISMATCH');
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (segmentLength < 7) fail('TYPE_MISMATCH');
      const height = bytes.readUInt16BE(offset + 3);
      const width = bytes.readUInt16BE(offset + 5);
      if (!boundedImageDimensions(width, height)) fail('INPUT_INVALID');
      return Object.freeze([width, height]);
    }
    offset += segmentLength;
  }
  return fail('TYPE_MISMATCH');
};

const inspectPdf = (bytes: Buffer): void => {
  if (bytes.length < 16 || !/^%PDF-1\.[0-7](?:\r\n|\r|\n)/u.test(bytes.subarray(0, 12).toString('latin1'))) fail('TYPE_MISMATCH');
  const tail = bytes.subarray(Math.max(0, bytes.length - 1_024)).toString('latin1');
  const eof = tail.lastIndexOf('%%EOF');
  if (eof < 0 || !/^[\u0000\t\n\f\r ]*$/u.test(tail.slice(eof + 5))) fail('TYPE_MISMATCH');
  const text = bytes.toString('latin1').replace(/#([0-9A-Fa-f]{2})/gu,
    (_match, value: string) => String.fromCharCode(Number.parseInt(value, 16)));
  if (PDF_ACTIVE_CONTENT.test(text) || /\/Encrypt\b/u.test(text)) fail('INPUT_INVALID');
};

export const inspectLocalOcrSource = (input: LocalOcrSourceInput): InspectedLocalOcrSource => {
  if (!plainRecord(input) || !exactKeys(input, ['fileName', 'mediaType', 'bytes', 'expectedSha256'])
    || !validLeafName(input.fileName) || !['image/png', 'image/jpeg', 'application/pdf'].includes(input.mediaType)
    || !(input.bytes instanceof Uint8Array) || input.bytes.byteLength < 12 || input.bytes.byteLength > LOCAL_OCR_MAX_INPUT_BYTES
    || typeof input.expectedSha256 !== 'string' || !SHA256.test(input.expectedSha256)) {
    if (input?.bytes instanceof Uint8Array && input.bytes.byteLength > LOCAL_OCR_MAX_INPUT_BYTES) fail('INPUT_TOO_LARGE');
    fail('INPUT_INVALID');
  }
  if (!extensionMatches(input.fileName, input.mediaType)) fail('TYPE_MISMATCH');
  const bytes = Buffer.from(input.bytes);
  const observedSha256 = sha256(bytes);
  if (observedSha256 !== input.expectedSha256) { bytes.fill(0); fail('HASH_MISMATCH'); }
  let dimensions: readonly [number, number] | null = null;
  try {
    if (input.mediaType === 'image/png') dimensions = inspectPng(bytes);
    else if (input.mediaType === 'image/jpeg') dimensions = inspectJpeg(bytes);
    else inspectPdf(bytes);
  } catch (error) {
    bytes.fill(0);
    throw error;
  }
  return Object.freeze({
    schemaVersion: 1,
    fileName: input.fileName,
    mediaType: input.mediaType,
    bytes,
    sha256: observedSha256,
    sizeBytes: bytes.length,
    intrinsicPageCount: dimensions ? 1 : null,
    pixelWidth: dimensions?.[0] ?? null,
    pixelHeight: dimensions?.[1] ?? null,
    containsActivePdfContent: false
  });
};

export const bindLocalOcrPageInspection = (
  source: InspectedLocalOcrSource,
  inspection: LocalOcrPageInspection
): BoundedLocalOcrSource => {
  if (!plainRecord(inspection) || !exactKeys(inspection, ['inputSha256', 'pageCount', 'encrypted'])
    || inspection.inputSha256 !== source.sha256 || !Number.isInteger(inspection.pageCount) || inspection.pageCount < 1
    || typeof inspection.encrypted !== 'boolean') fail('INPUT_INVALID');
  if (inspection.encrypted) fail('INPUT_INVALID');
  if (inspection.pageCount > LOCAL_OCR_MAX_PAGES) fail('PAGE_LIMIT_EXCEEDED');
  if (source.intrinsicPageCount !== null && inspection.pageCount !== source.intrinsicPageCount) fail('TYPE_MISMATCH');
  return Object.freeze({ ...source, pageCount: inspection.pageCount });
};

const validConfidence = (value: unknown): value is LocalOcrConfidenceMetadata => plainRecord(value)
  && exactKeys(value, ['available', 'value']) && typeof value.available === 'boolean'
  && (value.available ? typeof value.value === 'number' && Number.isFinite(value.value) && value.value >= 0 && value.value <= 1 : value.value === null);
const validText = (value: unknown, maximum: number): value is string => typeof value === 'string'
  && value.length <= maximum && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
const validBoundingBox = (value: unknown): value is LocalOcrBoundingBox => {
  if (!plainRecord(value) || !exactKeys(value, ['x', 'y', 'width', 'height'])) return false;
  const values = [value.x, value.y, value.width, value.height];
  return values.every((item) => typeof item === 'number' && Number.isFinite(item) && item >= 0 && item <= 1)
    && Number(value.width) > 0 && Number(value.height) > 0
    && Number(value.x) + Number(value.width) <= 1.000_001 && Number(value.y) + Number(value.height) <= 1.000_001;
};

export const validateLocalOcrResult = (
  value: unknown,
  source: BoundedLocalOcrSource,
  expected: { readonly memoryLimitMiB: number; readonly timeLimitMs: number; readonly outputLimitBytes: number }
): LocalOcrResult => {
  if (!plainRecord(expected) || !exactKeys(expected, ['memoryLimitMiB', 'timeLimitMs', 'outputLimitBytes'])) fail('INPUT_INVALID');
  const expectedQuotas = expected as { readonly memoryLimitMiB: number; readonly timeLimitMs: number; readonly outputLimitBytes: number };
  if (!Number.isInteger(expectedQuotas.memoryLimitMiB) || expectedQuotas.memoryLimitMiB < 128
    || expectedQuotas.memoryLimitMiB > LOCAL_OCR_DEFAULT_MEMORY_LIMIT_MIB
    || !Number.isInteger(expectedQuotas.timeLimitMs) || expectedQuotas.timeLimitMs < 100
    || expectedQuotas.timeLimitMs > LOCAL_OCR_DEFAULT_TIMEOUT_MS
    || !Number.isInteger(expectedQuotas.outputLimitBytes) || expectedQuotas.outputLimitBytes < 4_096
    || expectedQuotas.outputLimitBytes > LOCAL_OCR_MAX_OUTPUT_BYTES) fail('INPUT_INVALID');
  if (!plainRecord(value)) fail('ENGINE_FAILURE');
  const result = value as Record<string, unknown>;
  if (!exactKeys(result, [
    'schemaVersion', 'engineId', 'inputSha256', 'mediaType', 'pageCount', 'text',
    'confidence', 'languages', 'layout', 'execution'
  ]) || result.schemaVersion !== 1 || typeof result.engineId !== 'string'
    || !/^[a-z0-9][a-z0-9._-]{2,63}$/u.test(result.engineId) || result.inputSha256 !== source.sha256
    || result.mediaType !== source.mediaType || result.pageCount !== source.pageCount
    || !validText(result.text, LOCAL_OCR_MAX_TEXT_CHARACTERS) || !validConfidence(result.confidence)
    || !Array.isArray(result.languages) || result.languages.length < 1 || result.languages.length > LOCAL_OCR_MAX_LANGUAGES
    || !Array.isArray(result.layout) || result.layout.length > LOCAL_OCR_MAX_LAYOUT_BLOCKS
    || !plainRecord(result.execution) || !exactKeys(result.execution, [
      'localOnly', 'networkUsed', 'cloudUsed', 'processSeparated', 'lowPrivilegeSandboxVerified',
      'memoryLimitEnforced', 'cpuTimeLimitEnforced', 'timeLimitEnforced', 'outputLimitEnforced',
      'durationMs', 'memoryLimitMiB', 'cpuTimeLimitMs', 'timeLimitMs', 'outputLimitBytes'
    ])) fail('ENGINE_FAILURE');
  const languages = result.languages as unknown[];
  const languageTags = new Set<string>();
  for (const language of languages) {
    if (!plainRecord(language)) fail('ENGINE_FAILURE');
    const record = language as Record<string, unknown>;
    if (!exactKeys(record, ['languageTag', 'confidence'])
      || typeof record.languageTag !== 'string' || !LANGUAGE_TAG.test(record.languageTag)
      || languageTags.has(record.languageTag) || !validConfidence(record.confidence)) fail('ENGINE_FAILURE');
    languageTags.add(record.languageTag as string);
  }
  const layout = result.layout as unknown[];
  const ids = new Set<string>();
  for (const item of layout) {
    if (!plainRecord(item)) fail('ENGINE_FAILURE');
    const record = item as Record<string, unknown>;
    if (!exactKeys(record, ['id', 'pageNumber', 'kind', 'text', 'boundingBox', 'confidence'])
      || typeof record.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/u.test(record.id) || ids.has(record.id)
      || !Number.isInteger(record.pageNumber) || Number(record.pageNumber) < 1 || Number(record.pageNumber) > source.pageCount
      || typeof record.kind !== 'string' || !LAYOUT_KINDS.has(record.kind as LocalOcrLayoutKind)
      || !validText(record.text, 4_096) || !validBoundingBox(record.boundingBox) || !validConfidence(record.confidence)) fail('ENGINE_FAILURE');
    ids.add(record.id as string);
  }
  const execution = result.execution as Record<string, unknown>;
  if (execution.localOnly !== true || execution.networkUsed !== false || execution.cloudUsed !== false
    || execution.processSeparated !== true || execution.lowPrivilegeSandboxVerified !== false
    || execution.memoryLimitEnforced !== true || execution.cpuTimeLimitEnforced !== true
    || execution.timeLimitEnforced !== true || execution.outputLimitEnforced !== true
    || typeof execution.durationMs !== 'number' || !Number.isInteger(execution.durationMs) || execution.durationMs < 0 || execution.durationMs > expectedQuotas.timeLimitMs
    || execution.memoryLimitMiB !== expectedQuotas.memoryLimitMiB || execution.cpuTimeLimitMs !== expectedQuotas.timeLimitMs
    || execution.timeLimitMs !== expectedQuotas.timeLimitMs
    || execution.outputLimitBytes !== expectedQuotas.outputLimitBytes) fail('MEMORY_LIMIT_UNATTESTED');
  let serializedBytes: number;
  try { serializedBytes = Buffer.byteLength(JSON.stringify(result), 'utf8'); }
  catch { return fail('OUTPUT_LIMIT_EXCEEDED'); }
  if (serializedBytes > expectedQuotas.outputLimitBytes || serializedBytes > LOCAL_OCR_MAX_OUTPUT_BYTES) fail('OUTPUT_LIMIT_EXCEEDED');
  return deepFreeze(result as unknown as LocalOcrResult);
};
