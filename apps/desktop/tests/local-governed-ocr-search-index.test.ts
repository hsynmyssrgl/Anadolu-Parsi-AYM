import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildLocalGovernedOcrSearchIndex,
  parseLocalGovernedOcrSearchQuery,
  searchLocalGovernedOcrText,
  validateLocalGovernedOcrSearchIndex
} from '../src/main/local-governed-ocr-search-index.js';

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

describe('33-Q encrypted local OCR search index', () => {
  it('builds a deterministic fixed-size index bound to the exact plaintext hash without embedding tokens', () => {
    const text = 'Aylık kaynak bütçesi ve sigorta özeti';
    const contentSha256 = sha256(text);
    const first = buildLocalGovernedOcrSearchIndex(text, contentSha256);
    const second = buildLocalGovernedOcrSearchIndex(text, contentSha256);

    expect(first).toEqual(second);
    expect(Buffer.from(first.bitsBase64, 'base64')).toHaveLength(64 * 1_024);
    expect(JSON.stringify(first)).not.toContain('bütçesi');
    expect(validateLocalGovernedOcrSearchIndex(first, text, contentSha256)).toBe(true);
    expect(validateLocalGovernedOcrSearchIndex(first, `${text}!`, contentSha256)).toBe(false);
  });

  it('requires exact plaintext verification after the bloom precheck and rejects tampered indexes', () => {
    const text = 'Yerel OCR sonucu yalnız yetkili kullanıcıya açıktır.';
    const contentSha256 = sha256(text);
    const index = buildLocalGovernedOcrSearchIndex(text, contentSha256);
    const tampered = { ...index, bitsBase64: `${index.bitsBase64.slice(0, -4)}AAAA` };

    expect(searchLocalGovernedOcrText({ index, text, contentSha256, query: 'yetkili kullanıcıya', corrected: false,
      layout: [{ text, pageNumber: 2 }] })).toMatchObject({ matched: true, matchedTokenCount: 2, pageNumber: 2 });
    expect(searchLocalGovernedOcrText({ index, text, contentSha256, query: 'olmayan sözcük', corrected: false,
      layout: [{ text, pageNumber: 2 }] })).toBeNull();
    expect(searchLocalGovernedOcrText({ index: tampered, text, contentSha256, query: 'yetkili', corrected: false,
      layout: [{ text, pageNumber: 2 }] })).toBeNull();
  });

  it('masks structured secrets in bounded snippets and never emits page metadata for corrected text', () => {
    const text = 'Bütçe özeti TR330006100519786457841326, kullanıcı@example.com, şifre: cok gizli ifade; 4111111111111111 ve ٤١١١١١١١١١١١١١١١ içerir.';
    const contentSha256 = sha256(text);
    const index = buildLocalGovernedOcrSearchIndex(text, contentSha256);
    const hit = searchLocalGovernedOcrText({ index, text, contentSha256, query: 'bütçe özeti', corrected: true,
      layout: [{ text, pageNumber: 7 }] });

    expect(hit).not.toBeNull();
    expect(hit?.snippetMasked).toBe(true);
    expect(hit?.pageNumber).toBeNull();
    expect(hit?.snippet.length).toBeLessThanOrEqual(240);
    expect(hit?.snippet).not.toContain('TR330006100519786457841326');
    expect(hit?.snippet).not.toContain('kullanıcı@example.com');
    expect(hit?.snippet).not.toContain('cok gizli ifade');
    expect(hit?.snippet).not.toContain('4111111111111111');
    expect(hit?.snippet).not.toContain('٤١١١١١١١١١١١١١١١');
    expect(hit?.snippet).toContain('maskeli');
  });

  it('canonicalizes Unicode queries and rejects sensitive or unbounded search probes', () => {
    expect(parseLocalGovernedOcrSearchQuery('BÜTÇE bütçe')).toEqual(['bütçe']);
    expect(parseLocalGovernedOcrSearchQuery('kullanıcı@example.com')).toBeNull();
    expect(parseLocalGovernedOcrSearchQuery('TR330006100519786457841326')).toBeNull();
    expect(parseLocalGovernedOcrSearchQuery('4111111111111111')).toBeNull();
    expect(parseLocalGovernedOcrSearchQuery('４１１１１１１１１１１１１１１１')).toBeNull();
    expect(parseLocalGovernedOcrSearchQuery('٤١١١١١١١١١١١١١١١')).toBeNull();
    expect(parseLocalGovernedOcrSearchQuery('password')).toBeNull();
    expect(parseLocalGovernedOcrSearchQuery('şifre')).toBeNull();
    expect(parseLocalGovernedOcrSearchQuery(' x')).toBeNull();
    expect(parseLocalGovernedOcrSearchQuery('x'.repeat(81))).toBeNull();
  });
});
