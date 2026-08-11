import { randomBytes, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { dirname } from 'node:path';
import type { DeviceSecretProtector } from './device-secret-protector.js';
import { validateFullBackupPassword } from './backup-container-v3.js';

interface ManagedBackupPasswordEnvelope {
  readonly schemaVersion: 1;
  readonly protectionId: string;
  readonly protectedPassword: string;
  readonly createdAt: string;
}

const isEnvelope = (value: unknown): value is ManagedBackupPasswordEnvelope => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === 1
    && typeof record.protectionId === 'string'
    && typeof record.protectedPassword === 'string'
    && typeof record.createdAt === 'string'
    && !Number.isNaN(Date.parse(record.createdAt));
};

export class ManagedBackupPasswordProvider {
  public constructor(
    private readonly filePath: string,
    private readonly protector: DeviceSecretProtector
  ) {}

  public getOrCreate(): string {
    if (!this.protector.isAvailable()) {
      throw new Error('İşletim sistemi yedek parolası koruması kullanılamıyor.');
    }
    if (existsSync(this.filePath)) return this.#read();
    const password = randomBytes(48).toString('base64url');
    validateFullBackupPassword(password);
    const envelope: ManagedBackupPasswordEnvelope = {
      schemaVersion: 1,
      protectionId: this.protector.protectionId,
      protectedPassword: this.protector.protect(password),
      createdAt: new Date().toISOString()
    };
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporaryPath, `${JSON.stringify(envelope, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
        flag: 'wx'
      });
      renameSync(temporaryPath, this.filePath);
    } catch (error) {
      rmSync(temporaryPath, { force: true });
      if (existsSync(this.filePath)) return this.#read();
      throw error;
    }
    return password;
  }

  #read(): string {
    let value: unknown;
    try {
      value = JSON.parse(readFileSync(this.filePath, 'utf8')) as unknown;
    } catch {
      throw new Error('Yönetilen yedek parolası dosyası okunamadı.');
    }
    if (!isEnvelope(value)) {
      throw new Error('Yönetilen yedek parolası zarfı geçersiz.');
    }
    if (value.protectionId !== this.protector.protectionId) {
      throw new Error('Yönetilen yedek parolası farklı bir koruma sağlayıcısına ait.');
    }
    const password = this.protector.unprotect(value.protectedPassword);
    validateFullBackupPassword(password);
    return password;
  }
}
