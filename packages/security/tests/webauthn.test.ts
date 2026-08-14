import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createWebAuthnChallenge,
  hashWebAuthnChallenge,
  verifyWebAuthnAssertion,
  type WebAuthnAssertionExpectation
} from '../src/webauthn.js';
import { verifyWebAuthnRegistration as verifyRegistration } from '../src/webauthn-registration.js';
import { parseWebAuthnCosePublicKey } from '../src/webauthn-cose.js';

const ORIGIN = 'pardus-app://renderer';
const RP_ID = 'renderer';

const es256Cose = (key: ReturnType<typeof generateKeyPairSync>['publicKey']): string => {
  const jwk = key.export({ format: 'jwk' });
  if (jwk.kty !== 'EC' || !jwk.x || !jwk.y) throw new Error('EC fixture key bekleniyordu.');
  return Buffer.concat([
    Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
    Buffer.from(jwk.x, 'base64url'),
    Buffer.from([0x22, 0x58, 0x20]),
    Buffer.from(jwk.y, 'base64url')
  ]).toString('base64url');
};

const fixture = (overrides: Partial<WebAuthnAssertionExpectation> = {}, flags = 0x05, signCount = 7) => {
  const keyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const publicKey = es256Cose(keyPair.publicKey);
  const challenge = createWebAuthnChallenge();
  const credentialId = Buffer.from('credential-33-p').toString('base64url');
  const clientData = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin: ORIGIN, crossOrigin: false }), 'utf8');
  const authenticatorData = Buffer.alloc(37);
  createHash('sha256').update(RP_ID).digest().copy(authenticatorData, 0);
  authenticatorData[32] = flags;
  authenticatorData.writeUInt32BE(signCount, 33);
  const signed = Buffer.concat([authenticatorData, createHash('sha256').update(clientData).digest()]);
  const signature = sign('sha256', signed, keyPair.privateKey);
  return {
    input: {
      credentialId,
      clientDataJsonBase64url: clientData.toString('base64url'),
      authenticatorDataBase64url: authenticatorData.toString('base64url'),
      signatureBase64url: signature.toString('base64url')
    },
    expectation: {
      credentialId,
      challengeSha256: hashWebAuthnChallenge(challenge),
      origin: ORIGIN,
      rpId: RP_ID,
      publicKeyCoseBase64url: publicKey,
      previousSignCount: 6,
      requireUserVerification: true,
      ...overrides
    }
  };
};

describe('WebAuthn assertion verification', () => {
  it('origin, RP hash, UP/UV, signature and monotonic signCount are verified', () => {
    const value = fixture();
    expect(verifyWebAuthnAssertion(value.input, value.expectation)).toMatchObject({
      verified: true,
      signCount: 7,
      signCountTracked: true,
      userPresent: true,
      userVerified: true,
      challengeSha256: value.expectation.challengeSha256
    });
  });

  it('challenge replay, foreign origin and foreign RP are rejected', () => {
    const challenge = fixture({ challengeSha256: hashWebAuthnChallenge(createWebAuthnChallenge()) });
    expect(() => verifyWebAuthnAssertion(challenge.input, challenge.expectation)).toThrow(/challenge/u);
    const origin = fixture({ origin: 'pardus-app://foreign' });
    expect(() => verifyWebAuthnAssertion(origin.input, origin.expectation)).toThrow(/origin/u);
    const rp = fixture({ rpId: 'foreign' });
    expect(() => verifyWebAuthnAssertion(rp.input, rp.expectation)).toThrow(/RP ID/u);
  });

  it('missing user verification and cloned signCount are rejected', () => {
    const missingUv = fixture({}, 0x01);
    expect(() => verifyWebAuthnAssertion(missingUv.input, missingUv.expectation)).toThrow(/UP\/UV/u);
    const cloned = fixture({ previousSignCount: 7 }, 0x05, 7);
    expect(() => verifyWebAuthnAssertion(cloned.input, cloned.expectation)).toThrow(/signCount/u);
  });

  it('tampered authenticator bytes and unsupported COSE keys are rejected', () => {
    const tampered = fixture();
    const bytes = Buffer.from(tampered.input.signatureBase64url, 'base64url');
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1;
    expect(() => verifyWebAuthnAssertion({ ...tampered.input, signatureBase64url: bytes.toString('base64url') }, tampered.expectation))
      .toThrow(/imzasi/u);
    const wrongAlgorithm = fixture({ publicKeyCoseBase64url: Buffer.from([0xa1, 0x01, 0x02]).toString('base64url') });
    expect(() => verifyWebAuthnAssertion(wrongAlgorithm.input, wrongAlgorithm.expectation)).toThrow(/COSE/u);
  });
});

const cborText = (value: string): Buffer => {
  const bytes = Buffer.from(value, 'utf8');
  if (bytes.length >= 24) throw new Error('Short CBOR text fixture bekleniyordu.');
  return Buffer.concat([Buffer.from([0x60 + bytes.length]), bytes]);
};

const cborBytes = (value: Buffer): Buffer => value.length < 24
  ? Buffer.concat([Buffer.from([0x40 + value.length]), value])
  : value.length <= 0xff
    ? Buffer.concat([Buffer.from([0x58, value.length]), value])
    : Buffer.concat([Buffer.from([0x59, value.length >>> 8, value.length & 0xff]), value]);

const registrationFixture = (flags = 0x45) => {
  const keyPair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const cose = Buffer.from(es256Cose(keyPair.publicKey), 'base64url');
  const challenge = createWebAuthnChallenge();
  const credentialId = Buffer.from('registration-credential-33-p').toString('base64url');
  const credentialBytes = Buffer.from(credentialId, 'base64url');
  const clientData = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge, origin: ORIGIN, crossOrigin: false }), 'utf8');
  const authData = Buffer.alloc(55);
  createHash('sha256').update(RP_ID).digest().copy(authData, 0);
  authData[32] = flags;
  authData.writeUInt32BE(1, 33);
  Buffer.from('00112233445566778899aabbccddeeff', 'hex').copy(authData, 37);
  authData.writeUInt16BE(credentialBytes.length, 53);
  const completeAuthData = Buffer.concat([authData, credentialBytes, cose]);
  const attestationObject = Buffer.concat([
    Buffer.from([0xa3]),
    cborText('fmt'), cborText('none'),
    cborText('authData'), cborBytes(completeAuthData),
    cborText('attStmt'), Buffer.from([0xa0])
  ]);
  return {
    input: {
      credentialId,
      clientDataJsonBase64url: clientData.toString('base64url'),
      attestationObjectBase64url: attestationObject.toString('base64url'),
      transports: ['internal']
    },
    expectation: {
      challengeSha256: hashWebAuthnChallenge(challenge),
      origin: ORIGIN,
      rpId: RP_ID,
      expectedUserHandleSha256: createHash('sha256').update('account-33-p').digest('hex'),
      requireUserVerification: true as const
    }
  };
};

describe('WebAuthn registration verification', () => {
  it('none attestation, RP binding, credential and exact COSE key are verified', () => {
    const value = registrationFixture();
    expect(verifyRegistration(value.input, value.expectation)).toMatchObject({
      verified: true,
      challengeSha256: value.expectation.challengeSha256,
      relyingPartyId: RP_ID,
      credentialId: value.input.credentialId,
      publicKeyAlgorithm: 'ES256',
      aaguid: '00112233-4455-6677-8899-aabbccddeeff',
      transports: ['internal'],
      attestationFormat: 'none',
      attestationVerified: true
    });
  });

  it('foreign challenge and foreign RP are rejected', () => {
    const challenge = registrationFixture();
    expect(() => verifyRegistration(challenge.input, { ...challenge.expectation, challengeSha256: hashWebAuthnChallenge(createWebAuthnChallenge()) }))
      .toThrow(/challenge/u);
    const rp = registrationFixture();
    expect(() => verifyRegistration(rp.input, { ...rp.expectation, rpId: 'foreign' })).toThrow(/RP ID/u);
  });

  it('unexpected extension data and non-canonical transport metadata are rejected', () => {
    const extension = registrationFixture(0xc5);
    expect(() => verifyRegistration(extension.input, extension.expectation)).toThrow(/bayraklari/u);
    const duplicate = registrationFixture();
    expect(() => verifyRegistration({ ...duplicate.input, transports: ['internal', 'internal'] }, duplicate.expectation))
      .toThrow(/transports/u);
  });
});

describe('WebAuthn COSE algorithm constraints', () => {
  const rsaCose = (exponent: Buffer): Buffer => {
    const key = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ format: 'jwk' });
    if (!key.n) throw new Error('RSA fixture modulus bekleniyordu.');
    const modulus = Buffer.from(key.n, 'base64url');
    return Buffer.concat([
      Buffer.from([0xa4, 0x01, 0x03, 0x03, 0x39, 0x01, 0x00, 0x20]),
      cborBytes(modulus),
      Buffer.from([0x21]),
      cborBytes(exponent)
    ]);
  };

  it('RS256 only accepts the reviewed 65537 exponent', () => {
    expect(parseWebAuthnCosePublicKey(rsaCose(Buffer.from([0x01, 0x00, 0x01]))).algorithm).toBe('RS256');
    expect(() => parseWebAuthnCosePublicKey(rsaCose(Buffer.from([0x01])))).toThrow(/RS256 parametreleri/u);
    expect(() => parseWebAuthnCosePublicKey(rsaCose(Buffer.from([0x02])))).toThrow(/RS256 parametreleri/u);
    expect(() => parseWebAuthnCosePublicKey(rsaCose(Buffer.from([0x03])))).toThrow(/RS256 parametreleri/u);
  });
});
