import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { DeviceSecretProtector } from './device-secret-protector.js';

export interface ArchiveVaultClock {
  now(): string;
}

interface ProtectedArchiveVaultKeyEnvelope {
  readonly schemaVersion: 2;
  readonly purpose: 'archive-vault-key';
  readonly protection: {
    readonly id: string;
    readonly encoding: 'base64';
  };
  readonly keyCiphertextBase64: string;
  readonly keySha256: string;
  readonly createdAt: string;
}

const LEGACY_KEY_BYTES = 32;

const isProtectedEnvelope = (value: unknown): value is ProtectedArchiveVaultKeyEnvelope => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const row = value as Partial<ProtectedArchiveVaultKeyEnvelope>;
  return row.schemaVersion === 2
    && row.purpose === 'archive-vault-key'
    && typeof row.protection === 'object'
    && row.protection !== null
    && row.protection.id !== undefined
    && row.protection.encoding === 'base64'
    && typeof row.keyCiphertextBase64 === 'string'
    && typeof row.keySha256 === 'string'
    && /^[a-f0-9]{64}$/iu.test(row.keySha256)
    && typeof row.createdAt === 'string'
    && !Number.isNaN(Date.parse(row.createdAt));
};

const isCanonicalBase64 = (value: string): boolean => {
  if (value.length === 0 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) {
    return false;
  }
  return Buffer.from(value, 'base64').toString('base64') === value;
};

const sha256 = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');

const assertVaultKey = (value: Uint8Array): Buffer => {
  const key = Buffer.from(value);
  if (key.length !== LEGACY_KEY_BYTES) throw new Error('Dijital kasa anahtarı 32 bayt olmalıdır.');
  return key;
};

export class ProtectedArchiveVaultKeyProvider {
  public readonly filePath: string;
  readonly #protector: DeviceSecretProtector;
  readonly #clock: ArchiveVaultClock;
  readonly #migrationBackupPath: string;

  public constructor(
    filePath: string,
    protector: DeviceSecretProtector,
    clock: ArchiveVaultClock
  ) {
    this.filePath = filePath;
    this.#protector = protector;
    this.#clock = clock;
    mkdirSync(dirname(filePath), { recursive: true });
    this.#migrationBackupPath = `${filePath}.migration-backup`;
    this.#recoverInterruptedMigration();
  }

  public getOrCreateKey(): Buffer {
    this.#assertProtectorAvailable();
    if (!existsSync(this.filePath)) {
      const key = randomBytes(LEGACY_KEY_BYTES);
      this.#writeProtectedKey(key, false, this.#clock.now());
      return key;
    }
    return this.#loadAndMigrateIfNeeded();
  }

  public exportPortableKey(): Buffer {
    return this.getOrCreateKey();
  }

  public serializePortableKeyForCurrentDevice(key: Uint8Array, createdAt = this.#clock.now()): Buffer {
    this.#assertProtectorAvailable();
    const validated = assertVaultKey(key);
    return Buffer.from(`${JSON.stringify(this.#envelope(validated, createdAt), null, 2)}\n`, 'utf8');
  }

  public verifyLocalStorageBytes(value: Uint8Array): Buffer {
    this.#assertProtectorAvailable();
    return this.#decodeProtectedEnvelope(Buffer.from(value));
  }

  public matchesPath(candidatePath: string): boolean {
    return resolve(candidatePath) === resolve(this.filePath);
  }

  #loadAndMigrateIfNeeded(): Buffer {
    const bytes = readFileSync(this.filePath);
    if (bytes.length === LEGACY_KEY_BYTES) {
      const key = assertVaultKey(bytes);
      this.#writeProtectedKey(key, true, this.#clock.now());
      return key;
    }
    const key = this.#decodeProtectedEnvelope(bytes);
    rmSync(this.#migrationBackupPath, { force: true });
    return key;
  }

  #decodeProtectedEnvelope(bytes: Buffer): Buffer {
    let parsed: unknown;
    try {
      parsed = JSON.parse(bytes.toString('utf8')) as unknown;
    } catch {
      throw new Error('Dijital kasa anahtarı zarfı okunamadı.');
    }
    if (!isProtectedEnvelope(parsed)) throw new Error('Dijital kasa anahtarı zarfı geçersiz.');
    if (parsed.protection.id !== this.#protector.protectionId) {
      throw new Error('Dijital kasa anahtarı farklı bir koruma sağlayıcısına ait.');
    }
    const plainBase64 = this.#protector.unprotect(parsed.keyCiphertextBase64);
    if (!isCanonicalBase64(plainBase64)) {
      throw new Error('Dijital kasa anahtarı korumalı içeriği geçersiz.');
    }
    const key = assertVaultKey(Buffer.from(plainBase64, 'base64'));
    const expected = Buffer.from(parsed.keySha256, 'hex');
    const actual = Buffer.from(sha256(key), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new Error('Dijital kasa anahtarı bütünlük doğrulamasını geçemedi.');
    }
    return key;
  }

  #writeProtectedKey(key: Buffer, replacingExisting: boolean, createdAt: string): void {
    const payload = Buffer.from(`${JSON.stringify(this.#envelope(key, createdAt), null, 2)}\n`, 'utf8');
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    rmSync(temporaryPath, { force: true });
    try {
      writeFileSync(temporaryPath, payload, { mode: 0o600, flag: 'wx' });
      try { chmodSync(temporaryPath, 0o600); } catch { /* Windows ACL protection is provided by safeStorage/DPAPI. */ }
      const descriptor = openSync(temporaryPath, 'r');
      try { fsyncSync(descriptor); } finally { closeSync(descriptor); }

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
        throw error;
      }
    } finally {
      rmSync(temporaryPath, { force: true });
    }
  }

  #envelope(key: Buffer, createdAt: string): ProtectedArchiveVaultKeyEnvelope {
    if (Number.isNaN(Date.parse(createdAt))) throw new Error('Dijital kasa anahtarı oluşturma zamanı geçersiz.');
    return {
      schemaVersion: 2,
      purpose: 'archive-vault-key',
      protection: {
        id: this.#protector.protectionId,
        encoding: 'base64'
      },
      keyCiphertextBase64: this.#protector.protect(key.toString('base64')),
      keySha256: sha256(key),
      createdAt
    };
  }

  #recoverInterruptedMigration(): void {
    if (!existsSync(this.filePath) && existsSync(this.#migrationBackupPath)) {
      renameSync(this.#migrationBackupPath, this.filePath);
    }
  }

  #assertProtectorAvailable(): void {
    if (!this.#protector.isAvailable()) {
      throw new Error('İşletim sistemi dijital kasa anahtarı koruması kullanılamıyor.');
    }
  }
}
