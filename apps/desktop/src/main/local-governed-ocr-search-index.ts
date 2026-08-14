import { createHash } from 'node:crypto';
import {
  LOCAL_GOVERNED_OCR_MAX_SEARCH_SNIPPET_CHARACTERS,
  canonicalLocalGovernedOcrSearchTokens
} from '@ppt/domain';

const SEARCH_INDEX_BYTES = 64 * 1024;
const SEARCH_INDEX_BITS = SEARCH_INDEX_BYTES * 8;
const SEARCH_INDEX_HASHES = 7;
const SEARCH_TOKEN_MAX_CHARACTERS = 64;
const SHA256 = /^[0-9a-f]{64}$/u;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const INDEX_KEYS = Object.freeze([
  'schemaVersion', 'algorithm', 'normalization', 'bitCount', 'hashCount', 'tokenCount',
  'contentSha256', 'bitsBase64', 'indexSha256'
]);

export interface LocalGovernedOcrEncryptedSearchIndex {
  readonly schemaVersion: 1;
  readonly algorithm: 'sha256-double-hash-bloom-v1';
  readonly normalization: 'unicode-nfkc-lower-alnum-v1';
  readonly bitCount: typeof SEARCH_INDEX_BITS;
  readonly hashCount: typeof SEARCH_INDEX_HASHES;
  readonly tokenCount: number;
  readonly contentSha256: string;
  readonly bitsBase64: string;
  readonly indexSha256: string;
}

export interface LocalGovernedOcrSearchHit {
  readonly matched: true;
  readonly matchedTokenCount: number;
  readonly snippet: string;
  readonly snippetMasked: true;
  readonly pageNumber: number | null;
}

interface SearchableLayoutBlock {
  readonly text: string;
  readonly pageNumber: number;
}

const plainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const exactKeys = (value: object, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length && actual.every((key, index) => key === canonical[index]);
};

const sha256 = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');

const normalizeToken = (value: string): string => value.normalize('NFKC').toLowerCase();

const uniqueSearchTokens = (value: string): readonly string[] => {
  const tokens = new Set<string>();
  for (const match of value.normalize('NFKC').matchAll(/[\p{L}\p{N}]+/gu)) {
    const token = normalizeToken(match[0]);
    if (token.length >= 2 && token.length <= SEARCH_TOKEN_MAX_CHARACTERS) tokens.add(token);
  }
  return Object.freeze([...tokens].sort());
};

const bloomOffsets = (token: string): readonly number[] => {
  const digest = createHash('sha256').update(token, 'utf8').digest();
  try {
    const first = digest.readUInt32BE(0);
    const step = (digest.readUInt32BE(4) | 1) >>> 0;
    return Object.freeze(Array.from(
      { length: SEARCH_INDEX_HASHES },
      (_value, index) => (first + index * step) % SEARCH_INDEX_BITS
    ));
  } finally {
    digest.fill(0);
  }
};

const canonicalIndexFingerprint = (value: Omit<LocalGovernedOcrEncryptedSearchIndex, 'indexSha256'>): string => sha256(JSON.stringify({
  schemaVersion: value.schemaVersion,
  algorithm: value.algorithm,
  normalization: value.normalization,
  bitCount: value.bitCount,
  hashCount: value.hashCount,
  tokenCount: value.tokenCount,
  contentSha256: value.contentSha256,
  bitsBase64: value.bitsBase64
}));

export const buildLocalGovernedOcrSearchIndex = (
  text: string,
  contentSha256: string
): LocalGovernedOcrEncryptedSearchIndex => {
  if (typeof text !== 'string' || !SHA256.test(contentSha256) || sha256(text) !== contentSha256) {
    throw new TypeError('OCR search index content binding is invalid.');
  }
  const bits = Buffer.alloc(SEARCH_INDEX_BYTES, 0);
  try {
    const tokens = uniqueSearchTokens(text);
    for (const token of tokens) {
      for (const offset of bloomOffsets(token)) {
        const byteIndex = offset >>> 3;
        bits[byteIndex] = (bits[byteIndex] ?? 0) | (1 << (offset & 7));
      }
    }
    const unsigned: Omit<LocalGovernedOcrEncryptedSearchIndex, 'indexSha256'> = Object.freeze({
      schemaVersion: 1,
      algorithm: 'sha256-double-hash-bloom-v1',
      normalization: 'unicode-nfkc-lower-alnum-v1',
      bitCount: SEARCH_INDEX_BITS,
      hashCount: SEARCH_INDEX_HASHES,
      tokenCount: tokens.length,
      contentSha256,
      bitsBase64: bits.toString('base64')
    });
    return Object.freeze({ ...unsigned, indexSha256: canonicalIndexFingerprint(unsigned) });
  } finally {
    bits.fill(0);
  }
};

export const validateLocalGovernedOcrSearchIndex = (
  value: unknown,
  text: string,
  contentSha256: string
): value is LocalGovernedOcrEncryptedSearchIndex => {
  if (!plainRecord(value) || !exactKeys(value, INDEX_KEYS)
    || value.schemaVersion !== 1 || value.algorithm !== 'sha256-double-hash-bloom-v1'
    || value.normalization !== 'unicode-nfkc-lower-alnum-v1'
    || value.bitCount !== SEARCH_INDEX_BITS || value.hashCount !== SEARCH_INDEX_HASHES
    || !Number.isSafeInteger(value.tokenCount) || Number(value.tokenCount) < 0
    || value.contentSha256 !== contentSha256 || !SHA256.test(String(value.contentSha256))
    || typeof value.bitsBase64 !== 'string' || !BASE64.test(value.bitsBase64)
    || Buffer.from(value.bitsBase64, 'base64').byteLength !== SEARCH_INDEX_BYTES
    || typeof value.indexSha256 !== 'string' || !SHA256.test(value.indexSha256)) return false;
  if (sha256(text) !== contentSha256) return false;
  const expected = buildLocalGovernedOcrSearchIndex(text, contentSha256);
  return value.tokenCount === expected.tokenCount && value.bitsBase64 === expected.bitsBase64
    && value.indexSha256 === expected.indexSha256;
};

export const parseLocalGovernedOcrSearchQuery = (value: unknown): readonly string[] | null => {
  return canonicalLocalGovernedOcrSearchTokens(value);
};

const indexMayContain = (index: LocalGovernedOcrEncryptedSearchIndex, tokens: readonly string[]): boolean => {
  const bits = Buffer.from(index.bitsBase64, 'base64');
  try {
    return tokens.every((token) => bloomOffsets(token).every((offset) => (bits[offset >>> 3]! & (1 << (offset & 7))) !== 0));
  } finally {
    bits.fill(0);
  }
};

const maskStructuredSecrets = (value: string): string => value
  .replace(/\b[A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]){10,30}\b/giu, (match) => {
    const tail = match.replace(/[^A-Z0-9]/giu, '').slice(-4);
    return `[IBAN maskeli ••••${tail}]`;
  })
  .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/gu, '[e-posta maskeli]')
  .replace(/(?<![\p{L}\p{N}_])(?:parola|şifre|password|secret|token)\s*[:=]\s*[^,;|]+/giu,
    (match) => `${match.split(/[:=]/u)[0]!.trim()}: [maskeli]`)
  .replace(/\p{Nd}(?:[\s./-]?\p{Nd}){5,}/gu, (match) => {
    const digits = match.match(/\p{Nd}/gu)?.join('') ?? '';
    return `[numara maskeli ••••${digits.slice(-4)}]`;
  });

const boundedSnippet = (text: string, firstIndex: number, firstLength: number): string => {
  let start = Math.max(0, firstIndex - 80);
  let end = Math.min(text.length, firstIndex + firstLength + 120);
  if (start > 0 && /[\uDC00-\uDFFF]/u.test(text[start]!)) start -= 1;
  if (end < text.length && /[\uD800-\uDBFF]/u.test(text[end - 1]!)) end += 1;
  const prefix = start > 0 ? '… ' : '';
  const suffix = end < text.length ? ' …' : '';
  const masked = maskStructuredSecrets(text.slice(start, end).replace(/\s+/gu, ' ').trim());
  const bounded = Array.from(`${prefix}${masked}${suffix}`).slice(0, LOCAL_GOVERNED_OCR_MAX_SEARCH_SNIPPET_CHARACTERS).join('');
  return bounded.trim();
};

export const searchLocalGovernedOcrText = (input: {
  readonly index: LocalGovernedOcrEncryptedSearchIndex;
  readonly text: string;
  readonly contentSha256: string;
  readonly query: string;
  readonly corrected: boolean;
  readonly layout: readonly SearchableLayoutBlock[];
}): LocalGovernedOcrSearchHit | null => {
  const queryTokens = parseLocalGovernedOcrSearchQuery(input.query);
  if (!queryTokens || !validateLocalGovernedOcrSearchIndex(input.index, input.text, input.contentSha256)
    || !indexMayContain(input.index, queryTokens)) return null;
  const textTokens = uniqueSearchTokens(input.text);
  const tokenSet = new Set(textTokens);
  if (!queryTokens.every((token) => tokenSet.has(token))) return null;
  const searchableText = input.text.normalize('NFKC');
  let firstIndex = -1;
  let firstLength = 0;
  for (const match of searchableText.matchAll(/[\p{L}\p{N}]+/gu)) {
    if (queryTokens.includes(normalizeToken(match[0]))) {
      firstIndex = match.index;
      firstLength = match[0].length;
      break;
    }
  }
  if (firstIndex < 0) return null;
  let pageNumber: number | null = null;
  if (!input.corrected) {
    for (const block of input.layout) {
      const blockTokens = new Set(uniqueSearchTokens(block.text));
      if (queryTokens.some((token) => blockTokens.has(token))) { pageNumber = block.pageNumber; break; }
    }
  }
  return Object.freeze({
    matched: true,
    matchedTokenCount: queryTokens.length,
    snippet: boundedSnippet(searchableText, firstIndex, firstLength),
    snippetMasked: true,
    pageNumber
  });
};
