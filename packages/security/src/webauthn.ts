import {
  createHash,
  randomBytes,
  timingSafeEqual,
  verify
} from 'node:crypto';
import { parseWebAuthnCosePublicKey } from './webauthn-cose.js';

export const WEBAUTHN_CHALLENGE_BYTES = 32;
export const WEBAUTHN_MAX_CLIENT_DATA_BYTES = 4096;
export const WEBAUTHN_MAX_AUTHENTICATOR_DATA_BYTES = 4096;

export interface WebAuthnAssertionInput {
  readonly credentialId: string;
  readonly clientDataJsonBase64url: string;
  readonly authenticatorDataBase64url: string;
  readonly signatureBase64url: string;
  readonly userHandleBase64url?: string;
}

export interface WebAuthnAssertionExpectation {
  readonly credentialId: string;
  readonly challengeSha256: string;
  readonly origin: string;
  readonly rpId: string;
  readonly publicKeyCoseBase64url: string;
  readonly previousSignCount?: number;
  readonly requireUserVerification: boolean;
  readonly expectedUserHandleSha256?: string;
}

export interface VerifiedWebAuthnAssertion {
  readonly verified: true;
  readonly signCount: number;
  readonly signCountTracked: boolean;
  readonly userPresent: true;
  readonly userVerified: boolean;
  readonly challengeSha256: string;
  readonly rpIdSha256: string;
  readonly userHandleSha256?: string;
}

interface ParsedClientData {
  readonly type: 'webauthn.get';
  readonly challenge: string;
  readonly origin: string;
  readonly crossOrigin?: false;
  readonly topOrigin?: string;
}

const sha256 = (value: Uint8Array | string): Buffer => createHash('sha256').update(value).digest();
const sha256Hex = (value: Uint8Array | string): string => sha256(value).toString('hex');
const validSha256 = (value: string): boolean => /^[0-9a-f]{64}$/u.test(value);

const decodeCanonicalBase64url = (value: string, label: string, maximumBytes: number): Buffer => {
  if (typeof value !== 'string' || value.length === 0 || value.includes('=') || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error(`${label} canonical base64url olmalidir.`);
  }
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.length === 0 || decoded.length > maximumBytes || decoded.toString('base64url') !== value) {
    decoded.fill(0);
    throw new Error(`${label} boyutu veya base64url kodlamasi gecersizdir.`);
  }
  return decoded;
};

const exactString = (left: string, right: string): boolean => {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
};

const parseClientData = (bytes: Buffer): ParsedClientData => {
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error('WebAuthn clientDataJSON UTF-8 degildir.');
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { throw new Error('WebAuthn clientDataJSON gecerli JSON degildir.'); }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)
    || Object.getPrototypeOf(parsed) !== Object.prototype) {
    throw new Error('WebAuthn clientDataJSON duz bir nesne olmalidir.');
  }
  const record = parsed as Record<string, unknown>;
  const allowed = new Set(['type', 'challenge', 'origin', 'crossOrigin', 'topOrigin']);
  if (Object.keys(record).some((key) => !allowed.has(key))) throw new Error('WebAuthn clientDataJSON bilinmeyen alan iceriyor.');
  if (record.type !== 'webauthn.get'
    || typeof record.challenge !== 'string'
    || typeof record.origin !== 'string'
    || (record.crossOrigin !== undefined && record.crossOrigin !== false)
    || (record.topOrigin !== undefined && typeof record.topOrigin !== 'string')) {
    throw new Error('WebAuthn clientDataJSON sozlesmesi gecersizdir.');
  }
  return record as unknown as ParsedClientData;
};

const validateOrigin = (origin: string, expectedOrigin: string): void => {
  if (!exactString(origin, expectedOrigin)) throw new Error('WebAuthn origin eslesmedi.');
  let parsed: URL;
  try { parsed = new URL(origin); }
  catch { throw new Error('WebAuthn origin URL degildir.'); }
  if (parsed.username !== '' || parsed.password !== '' || parsed.search !== '' || parsed.hash !== ''
    || parsed.pathname !== '' && parsed.pathname !== '/') {
    throw new Error('WebAuthn origin yalniz scheme ve host icermelidir.');
  }
};

const validateExpectation = (expectation: WebAuthnAssertionExpectation): void => {
  decodeCanonicalBase64url(expectation.credentialId, 'WebAuthn credentialId', 1024).fill(0);
  if (!validSha256(expectation.challengeSha256)) throw new Error('WebAuthn challenge hash gecersizdir.');
  if (typeof expectation.rpId !== 'string' || expectation.rpId.length < 1 || expectation.rpId.length > 253
    || expectation.rpId !== expectation.rpId.toLowerCase() || /[^a-z0-9.-]/u.test(expectation.rpId)) {
    throw new Error('WebAuthn RP ID gecersizdir.');
  }
  if (expectation.previousSignCount !== undefined
    && (!Number.isSafeInteger(expectation.previousSignCount) || expectation.previousSignCount < 0 || expectation.previousSignCount > 0xffffffff)) {
    throw new Error('WebAuthn onceki signCount gecersizdir.');
  }
  if (expectation.expectedUserHandleSha256 !== undefined && !validSha256(expectation.expectedUserHandleSha256)) {
    throw new Error('WebAuthn userHandle hash gecersizdir.');
  }
};

export const createWebAuthnChallenge = (): string => randomBytes(WEBAUTHN_CHALLENGE_BYTES).toString('base64url');

export const hashWebAuthnChallenge = (challenge: string): string => {
  const bytes = decodeCanonicalBase64url(challenge, 'WebAuthn challenge', 128);
  try {
    if (bytes.length < WEBAUTHN_CHALLENGE_BYTES) throw new Error('WebAuthn challenge en az 32 byte olmalidir.');
    // The application persists the exact wire string hash, not a decoded-byte hash.
    return sha256Hex(challenge);
  } finally { bytes.fill(0); }
};

export const verifyWebAuthnAssertion = (
  input: WebAuthnAssertionInput,
  expectation: WebAuthnAssertionExpectation
): VerifiedWebAuthnAssertion => {
  validateExpectation(expectation);
  if (!exactString(input.credentialId, expectation.credentialId)) throw new Error('WebAuthn credentialId eslesmedi.');

  const clientDataBytes = decodeCanonicalBase64url(input.clientDataJsonBase64url, 'WebAuthn clientDataJSON', WEBAUTHN_MAX_CLIENT_DATA_BYTES);
  const authenticatorData = decodeCanonicalBase64url(input.authenticatorDataBase64url, 'WebAuthn authenticatorData', WEBAUTHN_MAX_AUTHENTICATOR_DATA_BYTES);
  const signature = decodeCanonicalBase64url(input.signatureBase64url, 'WebAuthn signature', 2048);
  const publicKeyBytes = decodeCanonicalBase64url(expectation.publicKeyCoseBase64url, 'WebAuthn COSE public key', 8192);
  let userHandle: Buffer | undefined;
  try {
    const clientData = parseClientData(clientDataBytes);
    const challengeSha256 = hashWebAuthnChallenge(clientData.challenge);
    if (!exactString(challengeSha256, expectation.challengeSha256)) throw new Error('WebAuthn challenge eslesmedi.');
    validateOrigin(clientData.origin, expectation.origin);
    if (clientData.topOrigin !== undefined && !exactString(clientData.topOrigin, expectation.origin)) {
      throw new Error('WebAuthn topOrigin eslesmedi.');
    }
    if (authenticatorData.length < 37) throw new Error('WebAuthn authenticatorData cok kisadir.');
    const expectedRpIdHash = sha256(expectation.rpId);
    if (!timingSafeEqual(authenticatorData.subarray(0, 32), expectedRpIdHash)) throw new Error('WebAuthn RP ID hash eslesmedi.');
    const flags = authenticatorData[32] ?? 0;
    const userPresent = (flags & 0x01) !== 0;
    const userVerified = (flags & 0x04) !== 0;
    const attestedCredentialDataUnexpected = (flags & 0x40) !== 0;
    if (!userPresent || attestedCredentialDataUnexpected || (expectation.requireUserVerification && !userVerified)) {
      throw new Error('WebAuthn UP/UV bayraklari gecersizdir.');
    }
    const signCount = authenticatorData.readUInt32BE(33);
    if (expectation.previousSignCount !== undefined
      && (expectation.previousSignCount > 0 || signCount > 0)
      && signCount <= expectation.previousSignCount) {
      throw new Error('WebAuthn signCount geriledi veya tekrarlandi; credential klonlanmis olabilir.');
    }
    const { publicKey } = parseWebAuthnCosePublicKey(publicKeyBytes);
    const signedBytes = Buffer.concat([authenticatorData, sha256(clientDataBytes)]);
    if (!verify('sha256', signedBytes, publicKey, signature)) throw new Error('WebAuthn assertion imzasi gecersizdir.');

    let userHandleSha256: string | undefined;
    if (input.userHandleBase64url !== undefined) {
      userHandle = decodeCanonicalBase64url(input.userHandleBase64url, 'WebAuthn userHandle', 256);
      userHandleSha256 = sha256Hex(userHandle);
    }
    if (expectation.expectedUserHandleSha256 !== undefined
      && !exactString(userHandleSha256 ?? '', expectation.expectedUserHandleSha256)) {
      throw new Error('WebAuthn userHandle eslesmedi.');
    }
    return Object.freeze({
      verified: true,
      signCount,
      signCountTracked: signCount > 0,
      userPresent: true,
      userVerified,
      challengeSha256,
      rpIdSha256: expectedRpIdHash.toString('hex'),
      ...(userHandleSha256 === undefined ? {} : { userHandleSha256 })
    });
  } finally {
    clientDataBytes.fill(0);
    authenticatorData.fill(0);
    signature.fill(0);
    publicKeyBytes.fill(0);
    userHandle?.fill(0);
  }
};
