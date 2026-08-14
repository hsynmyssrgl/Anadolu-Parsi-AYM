import { randomBytes, verify } from 'node:crypto';
import type { IsoDateTime, UserId } from '@ppt/core';
import type { IdentityAccessOperationKind, IdentityAccessOperationTokenView } from '@ppt/domain';
import type { FileDeviceIdentityProvider } from './device-identity.js';

export const IDENTITY_ACCESS_OPERATION_TOKEN_TTL_SECONDS = 86_400 as const;
const MAX_CLOCK_SKEW_SECONDS = 30;
const TOKEN = /^iat1\.([0-9a-z]{1,10})\.([0-9a-z]{1,10})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{86})$/u;
const OPERATION_KINDS = new Set<IdentityAccessOperationKind>([
  'passkey_register',
  'passkey_authenticate',
  'passkey_revoke',
  'passkey_recover_lost',
  'federated_link',
  'federated_unlink',
  'temporary_credential_issue',
  'temporary_credential_revoke',
  'companion_snapshot_create'
]);

export const isIdentityAccessOperationKind = (value: unknown): value is IdentityAccessOperationKind =>
  typeof value === 'string' && OPERATION_KINDS.has(value as IdentityAccessOperationKind);

export interface IdentityAccessOperationTokenBinding {
  readonly accountId: UserId;
  readonly deviceId: string;
  readonly securityEpoch: number;
  readonly operationKind: IdentityAccessOperationKind;
}

const canonicalPayload = (
  binding: IdentityAccessOperationTokenBinding,
  issuedAtSeconds: number,
  expiresAtSeconds: number,
  nonceBase64Url: string
): Buffer => Buffer.from(JSON.stringify([
  'identity_access_operation_token',
  1,
  binding.accountId,
  binding.deviceId,
  binding.securityEpoch,
  binding.operationKind,
  issuedAtSeconds,
  expiresAtSeconds,
  nonceBase64Url
]), 'utf8');

const secondsFor = (value: IsoDateTime): number => {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error('[IDEMPOTENCY_INVALID] Operation token clock is invalid.');
  return Math.floor(milliseconds / 1_000);
};

const isoForSeconds = (value: number): IsoDateTime => new Date(value * 1_000).toISOString() as IsoDateTime;

/** Main-only issuance. The device private key never crosses this boundary. */
export const issueIdentityAccessOperationToken = (input: {
  readonly binding: IdentityAccessOperationTokenBinding;
  readonly now: IsoDateTime;
  readonly deviceIdentityProvider: FileDeviceIdentityProvider;
}): IdentityAccessOperationTokenView => {
  if (!isIdentityAccessOperationKind(input.binding.operationKind)
    || !Number.isSafeInteger(input.binding.securityEpoch) || input.binding.securityEpoch < 0) {
    throw new Error('[IDEMPOTENCY_INVALID] Operation token binding is invalid.');
  }
  const issuedAtSeconds = secondsFor(input.now);
  const expiresAtSeconds = issuedAtSeconds + IDENTITY_ACCESS_OPERATION_TOKEN_TTL_SECONDS;
  const nonceBase64Url = randomBytes(16).toString('base64url');
  const signature = input.deviceIdentityProvider.signDetached(
    canonicalPayload(input.binding, issuedAtSeconds, expiresAtSeconds, nonceBase64Url)
  ).toString('base64url');
  const clientOperationId = `iat1.${issuedAtSeconds.toString(36)}.${expiresAtSeconds.toString(36)}.${nonceBase64Url}.${signature}`;
  if (clientOperationId.length > 160 || !TOKEN.test(clientOperationId)) {
    throw new Error('[IDEMPOTENCY_INVALID] Main-issued operation token encoding is invalid.');
  }
  return Object.freeze({
    clientOperationId,
    operationKind: input.binding.operationKind,
    issuedAt: isoForSeconds(issuedAtSeconds),
    expiresAt: isoForSeconds(expiresAtSeconds)
  });
};

/** Verifies exact account/device/epoch/kind binding before replay lookup or mutation. */
export const verifyIdentityAccessOperationToken = (input: {
  readonly clientOperationId: string;
  readonly binding: IdentityAccessOperationTokenBinding;
  readonly now: IsoDateTime;
  readonly devicePublicKeyPem: string;
}): { readonly issuedAt: IsoDateTime; readonly expiresAt: IsoDateTime } => {
  if (input.clientOperationId.length > 160) {
    throw new Error('[IDEMPOTENCY_INVALID] Operation token format is invalid.');
  }
  const match = TOKEN.exec(input.clientOperationId);
  if (!match) throw new Error('[IDEMPOTENCY_INVALID] Operation token format is invalid.');
  const issuedAtSeconds = Number.parseInt(match[1]!, 36);
  const expiresAtSeconds = Number.parseInt(match[2]!, 36);
  const nonceBase64Url = match[3]!;
  const signatureBase64Url = match[4]!;
  if (!Number.isSafeInteger(issuedAtSeconds) || !Number.isSafeInteger(expiresAtSeconds)
    || expiresAtSeconds - issuedAtSeconds !== IDENTITY_ACCESS_OPERATION_TOKEN_TTL_SECONDS) {
    throw new Error('[IDEMPOTENCY_INVALID] Operation token lifetime is invalid.');
  }
  const nonce = Buffer.from(nonceBase64Url, 'base64url');
  const signature = Buffer.from(signatureBase64Url, 'base64url');
  if (nonce.length !== 16 || nonce.toString('base64url') !== nonceBase64Url
    || signature.length !== 64 || signature.toString('base64url') !== signatureBase64Url) {
    throw new Error('[IDEMPOTENCY_INVALID] Operation token encoding is not canonical.');
  }
  const signatureValid = verify(
    null,
    canonicalPayload(input.binding, issuedAtSeconds, expiresAtSeconds, nonceBase64Url),
    input.devicePublicKeyPem,
    signature
  );
  if (!signatureValid) throw new Error('[IDEMPOTENCY_SCOPE_MISMATCH] Operation token binding is invalid.');
  const nowSeconds = secondsFor(input.now);
  if (issuedAtSeconds > nowSeconds + MAX_CLOCK_SKEW_SECONDS) {
    throw new Error('[IDEMPOTENCY_INVALID] Operation token is not active yet.');
  }
  if (nowSeconds >= expiresAtSeconds) {
    throw new Error('[IDEMPOTENCY_EXPIRED] Operation token expired; issue a new operation intent.');
  }
  return Object.freeze({ issuedAt: isoForSeconds(issuedAtSeconds), expiresAt: isoForSeconds(expiresAtSeconds) });
};
