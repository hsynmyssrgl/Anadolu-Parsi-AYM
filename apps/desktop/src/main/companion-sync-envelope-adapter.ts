import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  asIsoDateTime,
  asCorrelationId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import type { EncryptedCompanionSnapshotPort } from '@ppt/application';
import type { IdentityAccessAggregateKey } from '@ppt/domain';
import { encryptCompanionSyncEnvelope } from '@ppt/security';

export interface CompanionEncryptionKeyResolverPort {
  resolve(input: {
    readonly key: IdentityAccessAggregateKey;
    readonly trustedDeviceId: string;
    readonly securityEpoch: number;
  }): Result<{ readonly publicKeySpkiBase64Url: string; readonly algorithm: 'X25519'; readonly securityEpoch: number }, AppError>;
}

export interface EncryptedCompanionSnapshotAdapterOptions {
  readonly encryptionKeys: CompanionEncryptionKeyResolverPort;
}

const failure = (message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_UNEXPECTED,
  category: 'security',
  message,
  correlationId: asCorrelationId('identity-companion-sync-envelope')
});
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export class X25519EncryptedCompanionSnapshotAdapter implements EncryptedCompanionSnapshotPort {
  public constructor(private readonly options: EncryptedCompanionSnapshotAdapterOptions) {}

  public create(input: Parameters<EncryptedCompanionSnapshotPort['create']>[0]): ReturnType<EncryptedCompanionSnapshotPort['create']> {
    if (input.snapshot.sourceVersion !== input.sourceVersion || input.snapshot.schemaVersion !== input.schemaVersion
      || input.snapshot.sourceAuthority !== 'windows_single_writer' || input.snapshot.remoteWritesAccepted !== false) {
      return err(failure('Companion snapshot kaynagi version binding ile eslesmedi.'));
    }
    const recipient = this.options.encryptionKeys.resolve({ key: input.key, trustedDeviceId: input.trustedDeviceId, securityEpoch: input.securityEpoch });
    if (!recipient.ok) return recipient;
    if (recipient.value.algorithm !== 'X25519' || recipient.value.securityEpoch !== input.securityEpoch) {
      return err(failure('Companion encryption key security epoch ile eslesmedi.'));
    }
    try {
      const expiresAt = new Date(Date.parse(input.generatedAt) + 24 * 60 * 60 * 1_000).toISOString();
      const encrypted = encryptCompanionSyncEnvelope({
        metadata: {
          protocolVersion: 1,
          sourceVersion: input.sourceVersion,
          schemaVersion: input.schemaVersion,
          securityEpoch: input.securityEpoch,
          trustedDeviceId: input.trustedDeviceId,
          ownerBindingSha256: sha256(JSON.stringify([input.key.familyId, input.key.accountId, input.key.ownerPersonId])),
          generatedAt: input.generatedAt,
          expiresAt,
          sourceAuthority: 'windows_single_writer',
          readOnly: true,
          remoteWritesAccepted: false,
          conflictResolution: 'reject_remote_and_refresh',
          networkDelivery: 'not_performed'
        },
        snapshot: input.snapshot,
        recipientPublicKeySpkiBase64Url: recipient.value.publicKeySpkiBase64Url
      });
      return ok(Object.freeze({
        encryptedEnvelopeBase64Url: encrypted.envelopeBase64Url,
        ciphertextSha256: encrypted.ciphertextSha256,
        envelopeSha256: encrypted.envelopeSha256,
        sourceVersion: input.sourceVersion,
        schemaVersion: input.schemaVersion,
        expiresAt: asIsoDateTime(encrypted.metadata.expiresAt)
      }));
    } catch { return err(failure('Companion snapshot X25519 envelope olusturulamadi.')); }
  }
}
