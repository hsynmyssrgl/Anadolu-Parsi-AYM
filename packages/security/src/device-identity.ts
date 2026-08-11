import {
  createHash,
  generateKeyPairSync,
  randomUUID,
  sign,
  verify
} from 'node:crypto';
import type { IsoDateTime } from '@ppt/core';

export interface DeviceIdentityMaterial {
  readonly deviceId: string;
  readonly publicKeyPem: string;
  readonly privateKeyPem: string;
  readonly fingerprint: string;
  readonly createdAt: IsoDateTime;
}

export interface DeviceProof {
  readonly deviceId: string;
  readonly challenge: string;
  readonly signatureBase64: string;
}

export const fingerprintPublicKey = (publicKeyPem: string): string =>
  createHash('sha256').update(publicKeyPem).digest('hex');

export const createDeviceIdentityMaterial = (createdAt: IsoDateTime): DeviceIdentityMaterial => {
  const pair = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return Object.freeze({
    deviceId: randomUUID(),
    publicKeyPem: pair.publicKey,
    privateKeyPem: pair.privateKey,
    fingerprint: fingerprintPublicKey(pair.publicKey),
    createdAt
  });
};

export const createDeviceProof = (
  identity: DeviceIdentityMaterial,
  challenge: string
): DeviceProof => ({
  deviceId: identity.deviceId,
  challenge,
  signatureBase64: sign(null, Buffer.from(challenge), identity.privateKeyPem).toString('base64')
});

export const verifyDeviceProof = (
  publicKeyPem: string,
  proof: DeviceProof
): boolean => {
  try {
    return verify(
      null,
      Buffer.from(proof.challenge),
      publicKeyPem,
      Buffer.from(proof.signatureBase64, 'base64')
    );
  } catch {
    return false;
  }
};
