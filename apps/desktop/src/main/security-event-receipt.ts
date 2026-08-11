import { createHash, verify } from 'node:crypto';
import type { SecurityEventReceiptView } from '@ppt/domain';

export interface SecurityEventReceiptDraft {
  readonly receiptId: string;
  readonly accountId: string;
  readonly deviceId: string;
  readonly deviceFingerprint: string;
  readonly securityEpoch: number;
  readonly trustedDeviceId: string;
  readonly auditId: string;
  readonly occurredAt: string;
  readonly signerPublicKeyPem: string;
}

export const createAccountSecurityReceiptFingerprint = (accountId: string): string => createHash('sha256')
  .update(`anadolu-parsi-account-receipt-v1:${accountId}`)
  .digest('hex');

const canonicalPayload = (receipt: Pick<SecurityEventReceiptView,
  'schemaVersion' | 'receiptId' | 'eventType' | 'accountFingerprint' | 'deviceId' |
  'deviceFingerprint' | 'securityEpoch' | 'trustedDeviceId' | 'auditId' | 'occurredAt' |
  'signatureAlgorithm' | 'signerPublicKeyPem'>): string => JSON.stringify({
  schemaVersion: receipt.schemaVersion,
  receiptId: receipt.receiptId,
  eventType: receipt.eventType,
  accountFingerprint: receipt.accountFingerprint,
  deviceId: receipt.deviceId,
  deviceFingerprint: receipt.deviceFingerprint,
  securityEpoch: receipt.securityEpoch,
  trustedDeviceId: receipt.trustedDeviceId,
  auditId: receipt.auditId,
  occurredAt: receipt.occurredAt,
  signatureAlgorithm: receipt.signatureAlgorithm,
  signerPublicKeyPem: receipt.signerPublicKeyPem
});

export const createSecurityEventReceipt = (
  draft: SecurityEventReceiptDraft,
  signPayload: (payload: string) => string
): SecurityEventReceiptView => {
  if (!Number.isSafeInteger(draft.securityEpoch) || draft.securityEpoch < 1) {
    throw new Error('Güvenlik olayı makbuzu için geçerli bir güvenlik dönemi gereklidir.');
  }
  const unsigned = Object.freeze({
    schemaVersion: 1 as const,
    receiptId: draft.receiptId,
    eventType: 'trusted_device_reauthorized_after_maintenance_recovery' as const,
    accountFingerprint: createAccountSecurityReceiptFingerprint(draft.accountId),
    deviceId: draft.deviceId,
    deviceFingerprint: draft.deviceFingerprint,
    securityEpoch: draft.securityEpoch,
    trustedDeviceId: draft.trustedDeviceId,
    auditId: draft.auditId,
    occurredAt: draft.occurredAt,
    signatureAlgorithm: 'Ed25519' as const,
    signerPublicKeyPem: draft.signerPublicKeyPem
  });
  const payload = canonicalPayload(unsigned);
  return Object.freeze({
    ...unsigned,
    payloadSha256: createHash('sha256').update(payload).digest('hex'),
    signatureBase64: signPayload(payload)
  });
};

export const verifySecurityEventReceipt = (receipt: SecurityEventReceiptView): boolean => {
  try {
    const payload = canonicalPayload(receipt);
    const expectedHash = createHash('sha256').update(payload).digest('hex');
    if (expectedHash !== receipt.payloadSha256) return false;
    return verify(
      null,
      Buffer.from(payload),
      receipt.signerPublicKeyPem,
      Buffer.from(receipt.signatureBase64, 'base64')
    );
  } catch {
    return false;
  }
};
