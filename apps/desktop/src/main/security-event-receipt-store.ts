import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { SecurityEventReceiptArchiveItemView, SecurityEventReceiptVerificationView, SecurityEventReceiptView } from '@ppt/domain';
import { verifySecurityEventReceipt } from './security-event-receipt.js';
import type { ProtectedSideArtifactStore } from './protected-side-artifact-store.js';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_RECEIPTS = 256;

interface ReceiptEnvelope {
  readonly schemaVersion: 1;
  readonly receipts: readonly SecurityEventReceiptView[];
}

const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

export const isSecurityEventReceiptView = (value: unknown): value is SecurityEventReceiptView => {
  if (!value || typeof value !== 'object') return false;
  const receipt = value as Partial<SecurityEventReceiptView>;
  return receipt.schemaVersion === 1
    && receipt.eventType === 'trusted_device_reauthorized_after_maintenance_recovery'
    && receipt.signatureAlgorithm === 'Ed25519'
    && isString(receipt.receiptId)
    && isString(receipt.accountFingerprint)
    && isString(receipt.deviceId)
    && isString(receipt.deviceFingerprint)
    && Number.isSafeInteger(receipt.securityEpoch)
    && Number(receipt.securityEpoch) >= 1
    && isString(receipt.trustedDeviceId)
    && isString(receipt.auditId)
    && isString(receipt.occurredAt)
    && isString(receipt.payloadSha256)
    && isString(receipt.signerPublicKeyPem)
    && isString(receipt.signatureBase64);
};

export class SecurityEventReceiptStore {
  public constructor(
    private readonly filePath: string,
    private readonly protectedArtifacts?: ProtectedSideArtifactStore
  ) {}

  public append(receipt: SecurityEventReceiptView): boolean {
    try {
      const current = this.readAll().filter((entry) => entry.receiptId !== receipt.receiptId);
      const receipts = [...current, receipt].slice(-MAX_RECEIPTS);
      this.writeEnvelope({ schemaVersion: 1, receipts });
      return true;
    } catch {
      return false;
    }
  }

  public list(accountFingerprint: string, limit = 20): SecurityEventReceiptArchiveItemView[] {
    const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    return this.readAll()
      .filter((receipt) => receipt.accountFingerprint === accountFingerprint)
      .slice()
      .reverse()
      .slice(0, boundedLimit)
      .map((receipt) => ({ receipt, verificationStatus: verifySecurityEventReceipt(receipt) ? 'valid' : 'invalid' }));
  }

  public verifyJson(receiptJson: string): SecurityEventReceiptVerificationView {
    if (receiptJson.length > 256 * 1024) {
      return { valid: false, status: 'MALFORMED', message: 'Makbuz metni izin verilen boyutu aşıyor.' };
    }
    try {
      const parsed: unknown = JSON.parse(receiptJson);
      if (!isSecurityEventReceiptView(parsed)) {
        return { valid: false, status: 'MALFORMED', message: 'Makbuz şeması geçerli değil.' };
      }
      const valid = verifySecurityEventReceipt(parsed);
      return {
        valid,
        status: valid ? 'VALID' : 'INVALID',
        message: valid ? 'Ed25519 imzası ve payload özeti doğrulandı.' : 'Makbuz imzası veya payload özeti doğrulanamadı.',
        receipt: parsed
      };
    } catch {
      return { valid: false, status: 'MALFORMED', message: 'Makbuz JSON olarak ayrıştırılamadı.' };
    }
  }

  private readAll(): SecurityEventReceiptView[] {
    try {
      if (!existsSync(this.filePath)) return [];
      const rawText = this.protectedArtifacts
        ? this.protectedArtifacts.readText(this.filePath)
        : readFileSync(this.filePath, 'utf8');
      if (Buffer.byteLength(rawText, 'utf8') > MAX_FILE_BYTES) return [];
      const parsed: unknown = JSON.parse(rawText);
      if (!parsed || typeof parsed !== 'object') return [];
      const envelope = parsed as Partial<ReceiptEnvelope>;
      if (envelope.schemaVersion !== 1 || !Array.isArray(envelope.receipts)) return [];
      return envelope.receipts.filter(isSecurityEventReceiptView).slice(-MAX_RECEIPTS);
    } catch {
      return [];
    }
  }

  private writeEnvelope(envelope: ReceiptEnvelope): void {
    const payload = `${JSON.stringify(envelope, null, 2)}\n`;
    if (this.protectedArtifacts) {
      this.protectedArtifacts.writeText(this.filePath, 'security-event-receipts', payload);
      return;
    }
    const directory = dirname(this.filePath);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    const descriptor = openSync(temporaryPath, 'wx', 0o600);
    try {
      writeFileSync(descriptor, payload, { encoding: 'utf8' });
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    try {
      renameSync(temporaryPath, this.filePath);
    } catch (error) {
      try { unlinkSync(temporaryPath); } catch { /* best effort */ }
      throw error;
    }
  }
}
