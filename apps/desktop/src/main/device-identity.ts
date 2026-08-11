import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { dirname } from 'node:path';
import type { Clock } from '@ppt/core';
import {
  createDeviceIdentityMaterial,
  createDeviceProof,
  fingerprintPublicKey,
  verifyDeviceProof,
  type DeviceIdentityMaterial,
  type DeviceProof
} from '@ppt/security';
import type { DeviceSecretProtector } from './device-secret-protector.js';

interface ProtectedDeviceIdentityEnvelope {
  readonly schemaVersion: 2;
  readonly protection: {
    readonly id: string;
    readonly encoding: 'base64';
  };
  readonly identity: Omit<DeviceIdentityMaterial, 'privateKeyPem'>;
  readonly privateKeyCiphertextBase64: string;
}

const isProtectedEnvelope = (value: unknown): value is ProtectedDeviceIdentityEnvelope => {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Partial<ProtectedDeviceIdentityEnvelope>;
  return row.schemaVersion === 2
    && typeof row.protection === 'object'
    && row.protection !== null
    && typeof row.protection.id === 'string'
    && row.protection.encoding === 'base64'
    && typeof row.identity === 'object'
    && row.identity !== null
    && typeof row.privateKeyCiphertextBase64 === 'string';
};

const validateIdentity = (value: unknown): DeviceIdentityMaterial => {
  if (typeof value !== 'object' || value === null) throw new Error('Cihaz kimliği biçimi geçersiz.');
  const row = value as Partial<DeviceIdentityMaterial>;
  if (
    typeof row.deviceId !== 'string'
    || typeof row.publicKeyPem !== 'string'
    || typeof row.privateKeyPem !== 'string'
    || typeof row.fingerprint !== 'string'
    || typeof row.createdAt !== 'string'
  ) {
    throw new Error('Cihaz kimliği alanları eksik.');
  }
  if (fingerprintPublicKey(row.publicKeyPem) !== row.fingerprint) {
    throw new Error('Cihaz kimliği parmak izi doğrulanamadı.');
  }
  const identity = Object.freeze({
    deviceId: row.deviceId,
    publicKeyPem: row.publicKeyPem,
    privateKeyPem: row.privateKeyPem,
    fingerprint: row.fingerprint,
    createdAt: row.createdAt
  });
  const challenge = `device-identity-key-match:${identity.deviceId}`;
  if (!verifyDeviceProof(identity.publicKeyPem, createDeviceProof(identity, challenge))) {
    throw new Error('Cihaz kimliği özel ve açık anahtar eşleşmesi doğrulanamadı.');
  }
  return identity;
};

export class FileDeviceIdentityProvider {
  readonly #identity: DeviceIdentityMaterial;
  readonly #migrationBackupPath: string;

  public constructor(
    private readonly filePath: string,
    clock: Clock,
    private readonly secretProtector?: DeviceSecretProtector
  ) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.#migrationBackupPath = `${filePath}.migration-backup`;
    this.#recoverInterruptedMigration();
    this.#identity = existsSync(filePath)
      ? this.#loadAndMigrateIfNeeded()
      : this.#create(clock);
    try { chmodSync(filePath, 0o600); } catch { /* Windows koruması safeStorage/DPAPI katmanındadır. */ }
  }

  #recoverInterruptedMigration(): void {
    if (!existsSync(this.filePath) && existsSync(this.#migrationBackupPath)) {
      renameSync(this.#migrationBackupPath, this.filePath);
    }
  }

  #loadAndMigrateIfNeeded(): DeviceIdentityMaterial {
    const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as unknown;
    if (isProtectedEnvelope(parsed)) {
      const protector = this.#availableProtector(parsed.protection.id);
      const identity = validateIdentity({
        ...parsed.identity,
        privateKeyPem: protector.unprotect(parsed.privateKeyCiphertextBase64)
      });
      rmSync(this.#migrationBackupPath, { force: true });
      return identity;
    }

    const identity = validateIdentity(parsed);
    const protector = this.#optionalAvailableProtector();
    if (protector) this.#writeProtectedIdentity(identity, protector, true);
    else if (this.secretProtector?.required) {
      throw new Error('Açık cihaz kimliği güvenli depolamaya taşınamadı; işletim sistemi koruması zorunludur.');
    }
    return identity;
  }

  #create(clock: Clock): DeviceIdentityMaterial {
    const identity = createDeviceIdentityMaterial(clock.now());
    const protector = this.#optionalAvailableProtector();
    if (protector) this.#writeProtectedIdentity(identity, protector, false);
    else if (this.secretProtector?.required) {
      throw new Error('Cihaz kimliği oluşturulamadı; işletim sistemi sırrı koruması zorunludur.');
    } else {
      this.#writePayload(identity, false);
    }
    return identity;
  }

  #optionalAvailableProtector(): DeviceSecretProtector | undefined {
    return this.secretProtector?.isAvailable() ? this.secretProtector : undefined;
  }

  #availableProtector(expectedProtectionId: string): DeviceSecretProtector {
    const protector = this.#optionalAvailableProtector();
    if (!protector) {
      throw new Error('Şifreli cihaz kimliği açılamadı; işletim sistemi sırrı koruması kullanılamıyor.');
    }
    if (protector.protectionId !== expectedProtectionId) {
      throw new Error('Cihaz kimliği farklı veya desteklenmeyen bir koruma sağlayıcısıyla şifrelenmiş.');
    }
    return protector;
  }

  #writeProtectedIdentity(
    identity: DeviceIdentityMaterial,
    protector: DeviceSecretProtector,
    replacingExisting: boolean
  ): void {
    const envelope: ProtectedDeviceIdentityEnvelope = {
      schemaVersion: 2,
      protection: {
        id: protector.protectionId,
        encoding: 'base64'
      },
      identity: {
        deviceId: identity.deviceId,
        publicKeyPem: identity.publicKeyPem,
        fingerprint: identity.fingerprint,
        createdAt: identity.createdAt
      },
      privateKeyCiphertextBase64: protector.protect(identity.privateKeyPem)
    };
    this.#writePayload(envelope, replacingExisting);
  }

  #writePayload(payload: unknown, replacingExisting: boolean): void {
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    rmSync(temporaryPath, { force: true });
    writeFileSync(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    try { chmodSync(temporaryPath, 0o600); } catch { /* Windows ACL işlemi Electron güvenli depolama katmanına bırakılır. */ }

    if (!replacingExisting || !existsSync(this.filePath)) {
      renameSync(temporaryPath, this.filePath);
      return;
    }

    rmSync(this.#migrationBackupPath, { force: true });
    renameSync(this.filePath, this.#migrationBackupPath);
    try {
      renameSync(temporaryPath, this.filePath);
      rmSync(this.#migrationBackupPath, { force: true });
    } catch (error) {
      rmSync(this.filePath, { force: true });
      if (existsSync(this.#migrationBackupPath)) renameSync(this.#migrationBackupPath, this.filePath);
      rmSync(temporaryPath, { force: true });
      throw error;
    }
  }

  public snapshot(): Omit<DeviceIdentityMaterial, 'privateKeyPem'> {
    return {
      deviceId: this.#identity.deviceId,
      publicKeyPem: this.#identity.publicKeyPem,
      fingerprint: this.#identity.fingerprint,
      createdAt: this.#identity.createdAt
    };
  }

  public createProof(challenge: string): DeviceProof {
    return createDeviceProof(this.#identity, challenge);
  }

  public destroyForTest(): void {
    rmSync(this.filePath, { force: true });
    rmSync(this.#migrationBackupPath, { force: true });
  }
}
