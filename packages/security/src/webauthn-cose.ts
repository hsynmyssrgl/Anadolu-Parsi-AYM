import { createPublicKey, type KeyObject } from 'node:crypto';

export type WebAuthnCoseAlgorithm = 'ES256' | 'RS256';

export type WebAuthnCborValue = number | string | boolean | null | Buffer | readonly WebAuthnCborValue[] | ReadonlyMap<WebAuthnCborValue, WebAuthnCborValue>;

export interface DecodedCborValue {
  readonly value: WebAuthnCborValue;
  readonly offset: number;
}

const MAX_CBOR_DEPTH = 8;
const MAX_CBOR_COLLECTION_ITEMS = 64;

const readLength = (bytes: Buffer, offset: number, additional: number): { readonly value: number; readonly offset: number } => {
  if (additional < 24) return { value: additional, offset };
  if (additional === 24) {
    if (offset + 1 > bytes.length) throw new Error('CBOR uzunlugu eksik.');
    const value = bytes.readUInt8(offset);
    if (value < 24) throw new Error('CBOR uzunlugu canonical degil.');
    return { value, offset: offset + 1 };
  }
  if (additional === 25) {
    if (offset + 2 > bytes.length) throw new Error('CBOR uzunlugu eksik.');
    const value = bytes.readUInt16BE(offset);
    if (value <= 0xff) throw new Error('CBOR uzunlugu canonical degil.');
    return { value, offset: offset + 2 };
  }
  if (additional === 26) {
    if (offset + 4 > bytes.length) throw new Error('CBOR uzunlugu eksik.');
    const value = bytes.readUInt32BE(offset);
    if (value <= 0xffff) throw new Error('CBOR uzunlugu canonical degil.');
    return { value, offset: offset + 4 };
  }
  throw new Error('CBOR indefinite veya 64-bit uzunluk desteklenmiyor.');
};

const keyIdentity = (value: WebAuthnCborValue): string => {
  if (typeof value === 'number') return `n:${value}`;
  if (typeof value === 'string') return `s:${value}`;
  if (Buffer.isBuffer(value)) return `b:${value.toString('hex')}`;
  throw new Error('CBOR map anahtari desteklenmiyor.');
};

const decodeAt = (bytes: Buffer, initialOffset: number, depth: number): DecodedCborValue => {
  if (depth > MAX_CBOR_DEPTH || initialOffset >= bytes.length) throw new Error('CBOR derinligi veya boyutu gecersiz.');
  const first = bytes.readUInt8(initialOffset);
  const major = first >>> 5;
  const additional = first & 0x1f;
  let offset = initialOffset + 1;

  if (major === 0 || major === 1) {
    const decoded = readLength(bytes, offset, additional);
    const value = major === 0 ? decoded.value : -1 - decoded.value;
    if (!Number.isSafeInteger(value)) throw new Error('CBOR integer guvenli degil.');
    return { value, offset: decoded.offset };
  }

  if (major === 2 || major === 3) {
    const decoded = readLength(bytes, offset, additional);
    offset = decoded.offset;
    if (decoded.value > bytes.length - offset) throw new Error('CBOR byte/text uzunlugu gecersiz.');
    const valueBytes = bytes.subarray(offset, offset + decoded.value);
    if (major === 2) return { value: Buffer.from(valueBytes), offset: offset + decoded.value };
    const text = valueBytes.toString('utf8');
    if (!Buffer.from(text, 'utf8').equals(valueBytes)) throw new Error('CBOR text UTF-8 degil.');
    return { value: text, offset: offset + decoded.value };
  }

  if (major === 4) {
    const decoded = readLength(bytes, offset, additional);
    if (decoded.value > MAX_CBOR_COLLECTION_ITEMS) throw new Error('CBOR array ust siniri asti.');
    offset = decoded.offset;
    const values: WebAuthnCborValue[] = [];
    for (let index = 0; index < decoded.value; index += 1) {
      const item = decodeAt(bytes, offset, depth + 1);
      values.push(item.value);
      offset = item.offset;
    }
    return { value: Object.freeze(values), offset };
  }

  if (major === 5) {
    const decoded = readLength(bytes, offset, additional);
    if (decoded.value > MAX_CBOR_COLLECTION_ITEMS) throw new Error('CBOR map ust siniri asti.');
    offset = decoded.offset;
    const values = new Map<WebAuthnCborValue, WebAuthnCborValue>();
    const identities = new Set<string>();
    for (let index = 0; index < decoded.value; index += 1) {
      const key = decodeAt(bytes, offset, depth + 1);
      offset = key.offset;
      const identity = keyIdentity(key.value);
      if (identities.has(identity)) throw new Error('CBOR map yinelenen anahtar iceriyor.');
      identities.add(identity);
      const item = decodeAt(bytes, offset, depth + 1);
      offset = item.offset;
      values.set(key.value, item.value);
    }
    return { value: values, offset };
  }

  if (major === 7 && additional === 20) return { value: false, offset };
  if (major === 7 && additional === 21) return { value: true, offset };
  if (major === 7 && additional === 22) return { value: null, offset };
  throw new Error('CBOR turu desteklenmiyor.');
};

export const decodeWebAuthnCbor = (bytes: Buffer, offset = 0): DecodedCborValue => decodeAt(bytes, offset, 0);

const mapValue = (map: ReadonlyMap<WebAuthnCborValue, WebAuthnCborValue>, key: number): WebAuthnCborValue | undefined => {
  for (const [candidate, value] of map) if (candidate === key) return value;
  return undefined;
};

const exactNumericKeys = (map: ReadonlyMap<WebAuthnCborValue, WebAuthnCborValue>, expected: readonly number[]): boolean => {
  const actual = [...map.keys()];
  return actual.length === expected.length
    && actual.every((key) => typeof key === 'number' && expected.includes(key));
};

export interface ParsedWebAuthnCosePublicKey {
  readonly publicKey: KeyObject;
  readonly algorithm: WebAuthnCoseAlgorithm;
}

export const parseWebAuthnCosePublicKey = (coseBytes: Buffer): ParsedWebAuthnCosePublicKey => {
  if (coseBytes.length < 16 || coseBytes.length > 8_192) throw new Error('WebAuthn COSE public key boyutu gecersiz.');
  const decoded = decodeWebAuthnCbor(coseBytes);
  if (decoded.offset !== coseBytes.length || !(decoded.value instanceof Map)) throw new Error('WebAuthn COSE public key map degil.');
  const map = decoded.value;
  const kty = mapValue(map, 1);
  const alg = mapValue(map, 3);

  if (kty === 2 && alg === -7) {
    if (!exactNumericKeys(map, [1, 3, -1, -2, -3]) || mapValue(map, -1) !== 1) {
      throw new Error('WebAuthn ES256 COSE anahtari exact degil.');
    }
    const x = mapValue(map, -2);
    const y = mapValue(map, -3);
    if (!Buffer.isBuffer(x) || x.length !== 32 || !Buffer.isBuffer(y) || y.length !== 32) {
      throw new Error('WebAuthn ES256 koordinatlari gecersiz.');
    }
    const publicKey = createPublicKey({
      key: { kty: 'EC', crv: 'P-256', x: x.toString('base64url'), y: y.toString('base64url'), ext: true },
      format: 'jwk'
    });
    return Object.freeze({ publicKey, algorithm: 'ES256' });
  }

  if (kty === 3 && alg === -257) {
    if (!exactNumericKeys(map, [1, 3, -1, -2])) throw new Error('WebAuthn RS256 COSE anahtari exact degil.');
    const modulus = mapValue(map, -1);
    const exponent = mapValue(map, -2);
    if (!Buffer.isBuffer(modulus) || modulus.length < 256 || modulus.length > 512 || modulus[0] === 0
      || (modulus[modulus.length - 1] ?? 0) % 2 === 0
      || !Buffer.isBuffer(exponent) || !exponent.equals(Buffer.from([0x01, 0x00, 0x01]))) {
      throw new Error('WebAuthn RS256 parametreleri gecersiz.');
    }
    const publicKey = createPublicKey({
      key: { kty: 'RSA', n: modulus.toString('base64url'), e: exponent.toString('base64url'), ext: true },
      format: 'jwk'
    });
    return Object.freeze({ publicKey, algorithm: 'RS256' });
  }
  throw new Error('WebAuthn COSE algoritmasi desteklenmiyor.');
};
