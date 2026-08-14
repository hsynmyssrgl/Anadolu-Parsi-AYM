import { createHash, timingSafeEqual } from 'node:crypto';
import { decodeWebAuthnCbor, parseWebAuthnCosePublicKey, type WebAuthnCborValue } from './webauthn-cose.js';

export interface WebAuthnRegistrationInput {
  readonly credentialId: string;
  readonly clientDataJsonBase64url: string;
  readonly attestationObjectBase64url: string;
  readonly transports: readonly string[];
}

export interface WebAuthnRegistrationExpectation {
  readonly challengeSha256: string;
  readonly origin: string;
  readonly rpId: string;
  readonly expectedUserHandleSha256: string;
  readonly requireUserVerification: true;
}

export interface VerifiedWebAuthnRegistration {
  readonly verified: true;
  readonly challengeSha256: string;
  readonly relyingPartyId: string;
  readonly credentialId: string;
  readonly publicKeyCoseBase64Url: string;
  readonly publicKeyAlgorithm: 'ES256' | 'RS256';
  readonly userHandleSha256: string;
  readonly aaguid: string;
  readonly transports: readonly ('internal' | 'usb' | 'nfc' | 'ble' | 'hybrid')[];
  readonly signCount: number;
  readonly backupEligible: boolean;
  readonly backupState: boolean;
  readonly attestationFormat: 'none';
  readonly attestationVerified: true;
  readonly userPresent: true;
  readonly userVerified: true;
}

const MAX_CLIENT_DATA_BYTES = 4_096;
const MAX_ATTESTATION_OBJECT_BYTES = 16_384;
const TRANSPORTS = new Set(['internal', 'usb', 'nfc', 'ble', 'hybrid']);
const sha256 = (value: Uint8Array | string): Buffer => createHash('sha256').update(value).digest();
const sha256Hex = (value: Uint8Array | string): string => sha256(value).toString('hex');

const decodeCanonicalBase64url = (value: string, label: string, maximumBytes: number): Buffer => {
  if (typeof value !== 'string' || value.length === 0 || value.includes('=') || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error(`${label} canonical base64url olmalidir.`);
  }
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.length === 0 || decoded.length > maximumBytes || decoded.toString('base64url') !== value) {
    decoded.fill(0);
    throw new Error(`${label} gecersizdir.`);
  }
  return decoded;
};

const exactString = (left: string, right: string): boolean => {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
};

const mapStringValue = (
  map: ReadonlyMap<WebAuthnCborValue, WebAuthnCborValue>,
  key: string
): WebAuthnCborValue | undefined => {
  for (const [candidate, value] of map) if (candidate === key) return value;
  return undefined;
};

const exactStringKeys = (map: ReadonlyMap<WebAuthnCborValue, WebAuthnCborValue>, expected: readonly string[]): boolean => {
  const actual = [...map.keys()];
  return actual.length === expected.length && actual.every((key) => typeof key === 'string' && expected.includes(key));
};

const parseClientData = (bytes: Buffer, expectation: WebAuthnRegistrationExpectation): void => {
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error('WebAuthn registration clientDataJSON UTF-8 degil.');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('WebAuthn registration clientDataJSON gecersiz.'); }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed) || Object.getPrototypeOf(parsed) !== Object.prototype) {
    throw new Error('WebAuthn registration clientDataJSON duz nesne olmali.');
  }
  const record = parsed as Record<string, unknown>;
  const allowed = new Set(['type', 'challenge', 'origin', 'crossOrigin', 'topOrigin']);
  if (Object.keys(record).some((key) => !allowed.has(key)) || record.type !== 'webauthn.create'
    || typeof record.challenge !== 'string' || typeof record.origin !== 'string'
    || (record.crossOrigin !== undefined && record.crossOrigin !== false)
    || (record.topOrigin !== undefined && typeof record.topOrigin !== 'string')) {
    throw new Error('WebAuthn registration clientDataJSON sozlesmesi gecersiz.');
  }
  const challengeBytes = decodeCanonicalBase64url(record.challenge, 'WebAuthn registration challenge', 128);
  try {
    if (challengeBytes.length < 32 || !exactString(sha256Hex(record.challenge), expectation.challengeSha256)) {
      throw new Error('WebAuthn registration challenge eslesmedi.');
    }
  } finally { challengeBytes.fill(0); }
  if (!exactString(record.origin, expectation.origin)
    || record.topOrigin !== undefined && !exactString(record.topOrigin, expectation.origin)) {
    throw new Error('WebAuthn registration origin eslesmedi.');
  }
  let origin: URL;
  try { origin = new URL(record.origin); } catch { throw new Error('WebAuthn registration origin URL degil.'); }
  if (origin.username !== '' || origin.password !== '' || origin.search !== '' || origin.hash !== ''
    || origin.pathname !== '' && origin.pathname !== '/') throw new Error('WebAuthn registration origin yalniz scheme ve host icermeli.');
};

const validateExpectation = (expectation: WebAuthnRegistrationExpectation): void => {
  if (!/^[0-9a-f]{64}$/u.test(expectation.challengeSha256)) throw new Error('WebAuthn registration challenge hash gecersiz.');
  if (expectation.rpId.length < 1 || expectation.rpId.length > 253 || expectation.rpId !== expectation.rpId.toLowerCase()
    || /[^a-z0-9.-]/u.test(expectation.rpId) || !/^[0-9a-f]{64}$/u.test(expectation.expectedUserHandleSha256)) {
    throw new Error('WebAuthn registration expectation gecersiz.');
  }
};

export const verifyWebAuthnRegistration = (
  input: WebAuthnRegistrationInput,
  expectation: WebAuthnRegistrationExpectation
): VerifiedWebAuthnRegistration => {
  validateExpectation(expectation);
  const credentialId = decodeCanonicalBase64url(input.credentialId, 'WebAuthn credentialId', 1_024);
  const clientData = decodeCanonicalBase64url(input.clientDataJsonBase64url, 'WebAuthn registration clientDataJSON', MAX_CLIENT_DATA_BYTES);
  const attestationObject = decodeCanonicalBase64url(input.attestationObjectBase64url, 'WebAuthn attestationObject', MAX_ATTESTATION_OBJECT_BYTES);
  try {
    parseClientData(clientData, expectation);
    const decoded = decodeWebAuthnCbor(attestationObject);
    if (decoded.offset !== attestationObject.length || !(decoded.value instanceof Map)
      || !exactStringKeys(decoded.value, ['fmt', 'authData', 'attStmt'])) throw new Error('WebAuthn attestation object exact degil.');
    const format = mapStringValue(decoded.value, 'fmt');
    const authData = mapStringValue(decoded.value, 'authData');
    const statement = mapStringValue(decoded.value, 'attStmt');
    if (format !== 'none' || !Buffer.isBuffer(authData) || !(statement instanceof Map) || statement.size !== 0) {
      throw new Error('Yalniz WebAuthn none attestation desteklenir; cihaz provenansi iddia edilmez.');
    }
    if (authData.length < 55 || authData.length > 8_192) throw new Error('WebAuthn registration authData boyutu gecersiz.');
    const rpIdHash = sha256(expectation.rpId);
    if (!timingSafeEqual(authData.subarray(0, 32), rpIdHash)) throw new Error('WebAuthn registration RP ID hash eslesmedi.');
    const flags = authData[32] ?? 0;
    const userPresent = (flags & 0x01) !== 0;
    const userVerified = (flags & 0x04) !== 0;
    const backupEligible = (flags & 0x08) !== 0;
    const backupState = (flags & 0x10) !== 0;
    const attestedCredentialData = (flags & 0x40) !== 0;
    const extensionData = (flags & 0x80) !== 0;
    if (!userPresent || !userVerified || !attestedCredentialData || extensionData || backupState && !backupEligible) {
      throw new Error('WebAuthn registration UP/UV/AT/BE/BS bayraklari gecersiz.');
    }
    const signCount = authData.readUInt32BE(33);
    const aaguidBytes = authData.subarray(37, 53);
    const aaguidHex = aaguidBytes.toString('hex');
    const aaguid = `${aaguidHex.slice(0, 8)}-${aaguidHex.slice(8, 12)}-${aaguidHex.slice(12, 16)}-${aaguidHex.slice(16, 20)}-${aaguidHex.slice(20)}`;
    const credentialLength = authData.readUInt16BE(53);
    const credentialOffset = 55;
    const coseOffset = credentialOffset + credentialLength;
    if (credentialLength < 16 || credentialLength > 1_024 || coseOffset >= authData.length) {
      throw new Error('WebAuthn registration credential uzunlugu gecersiz.');
    }
    const authenticatorCredentialId = authData.subarray(credentialOffset, coseOffset);
    if (authenticatorCredentialId.length !== credentialId.length || !timingSafeEqual(authenticatorCredentialId, credentialId)) {
      throw new Error('WebAuthn registration credentialId eslesmedi.');
    }
    const coseDecoded = decodeWebAuthnCbor(authData, coseOffset);
    if (coseDecoded.offset !== authData.length) throw new Error('WebAuthn registration beklenmeyen trailing authData iceriyor.');
    const coseBytes = Buffer.from(authData.subarray(coseOffset, coseDecoded.offset));
    try {
      const cose = parseWebAuthnCosePublicKey(coseBytes);
      const transports = [...new Set(input.transports)];
      if (transports.length !== input.transports.length || transports.length > 5
        || transports.some((transport) => !TRANSPORTS.has(transport))) throw new Error('WebAuthn transports gecersiz.');
      return Object.freeze({
        verified: true,
        challengeSha256: expectation.challengeSha256,
        relyingPartyId: expectation.rpId,
        credentialId: input.credentialId,
        publicKeyCoseBase64Url: coseBytes.toString('base64url'),
        publicKeyAlgorithm: cose.algorithm,
        userHandleSha256: expectation.expectedUserHandleSha256,
        aaguid,
        transports: Object.freeze(transports as ('internal' | 'usb' | 'nfc' | 'ble' | 'hybrid')[]),
        signCount,
        backupEligible,
        backupState,
        attestationFormat: 'none',
        attestationVerified: true,
        userPresent: true,
        userVerified: true
      });
    } finally { coseBytes.fill(0); }
  } finally {
    credentialId.fill(0);
    clientData.fill(0);
    attestationObject.fill(0);
  }
};
