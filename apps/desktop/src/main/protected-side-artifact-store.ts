import { createHash, randomBytes } from 'node:crypto';
import {
  appendFileSync,
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
import { dirname } from 'node:path';
import {
  ACCEPTED_PERSISTED_PRODUCT_NAMES,
  CURRENT_PRODUCT_NAME,
  type PersistedProductName
} from '@ppt/domain';
import { createDataKey, decryptBytes, encryptBytes, type EncryptedEnvelope } from '@ppt/security';
import type { DeviceSecretProtector } from './device-secret-protector.js';

const KEY_SCHEMA_VERSION = 1;
const ARTIFACT_SCHEMA_VERSION = 1;

interface ProtectedSideArtifactKeyEnvelope {
  readonly schemaVersion: 1;
  readonly protectionId: string;
  readonly protectedDataKey: string;
  readonly createdAt: string;
}

export interface ProtectedSideArtifactEnvelope {
  readonly schemaVersion: 1;
  readonly product: PersistedProductName;
  readonly applicationVersion: string;
  readonly kind: string;
  readonly generatedAt: string;
  readonly encryption: EncryptedEnvelope;
}

export interface ProtectedSideArtifactStoreOptions {
  readonly keyPath: string;
  readonly applicationVersion: string;
  readonly protector: DeviceSecretProtector;
  readonly now?: () => string;
}

const atomicWrite = (path: string, bytes: Buffer): void => {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporaryPath, 'wx', 0o600);
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    try { chmodSync(temporaryPath, 0o600); } catch { /* Windows ACL/DPAPI protection is external. */ }
    renameSync(temporaryPath, path);
    try { chmodSync(path, 0o600); } catch { /* Windows ACL/DPAPI protection is external. */ }
  } catch (error) {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* best effort */ }
    }
    rmSync(temporaryPath, { force: true });
    throw error;
  }
};

const parseKeyEnvelope = (raw: Buffer): ProtectedSideArtifactKeyEnvelope => {
  const value = JSON.parse(raw.toString('utf8')) as Partial<ProtectedSideArtifactKeyEnvelope>;
  if (
    value.schemaVersion !== KEY_SCHEMA_VERSION ||
    typeof value.protectionId !== 'string' ||
    typeof value.protectedDataKey !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    throw new Error('Yan-artifact anahtar zarfı geçersiz.');
  }
  return value as ProtectedSideArtifactKeyEnvelope;
};

const parseArtifactEnvelope = (raw: Buffer): ProtectedSideArtifactEnvelope => {
  const value = JSON.parse(raw.toString('utf8')) as Partial<ProtectedSideArtifactEnvelope>;
  if (
    value.schemaVersion !== ARTIFACT_SCHEMA_VERSION ||
    !ACCEPTED_PERSISTED_PRODUCT_NAMES.some(product => product === value.product) ||
    typeof value.applicationVersion !== 'string' ||
    typeof value.kind !== 'string' ||
    typeof value.generatedAt !== 'string' ||
    !value.encryption ||
    value.encryption.algorithm !== 'aes-256-gcm'
  ) {
    throw new Error('Korumalı yan-artifact zarfı geçersiz.');
  }
  return value as ProtectedSideArtifactEnvelope;
};

export class ProtectedSideArtifactStore {
  readonly #dataKey: Buffer;
  readonly #now: () => string;

  public constructor(private readonly options: ProtectedSideArtifactStoreOptions) {
    if (!options.protector.isAvailable()) {
      throw new Error('Yan-artifact koruması için işletim sistemi sır koruması kullanılamıyor.');
    }
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#dataKey = this.#loadOrCreateDataKey();
  }

  public sealBuffer(kind: string, bytes: Uint8Array): ProtectedSideArtifactEnvelope {
    return Object.freeze({
      schemaVersion: ARTIFACT_SCHEMA_VERSION,
      product: CURRENT_PRODUCT_NAME,
      applicationVersion: this.options.applicationVersion,
      kind,
      generatedAt: this.#now(),
      encryption: encryptBytes(bytes, this.#dataKey)
    });
  }

  public openEnvelope(envelope: ProtectedSideArtifactEnvelope): Buffer {
    return decryptBytes(envelope.encryption, this.#dataKey);
  }

  public writeBuffer(path: string, kind: string, bytes: Uint8Array): { readonly filePath: string; readonly sha256: string; readonly sizeBytes: number } {
    const payload = Buffer.from(`${JSON.stringify(this.sealBuffer(kind, bytes))}\n`, 'utf8');
    atomicWrite(path, payload);
    return { filePath: path, sha256: createHash('sha256').update(payload).digest('hex'), sizeBytes: payload.byteLength };
  }

  public writeText(path: string, kind: string, text: string): { readonly filePath: string; readonly sha256: string; readonly sizeBytes: number } {
    return this.writeBuffer(path, kind, Buffer.from(text, 'utf8'));
  }

  public appendTextRecord(path: string, kind: string, text: string): void {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const line = `${JSON.stringify(this.sealBuffer(kind, Buffer.from(text, 'utf8')))}\n`;
    appendFileSync(path, line, { encoding: 'utf8', mode: 0o600 });
    try { chmodSync(path, 0o600); } catch { /* Windows ACL is authoritative. */ }
  }

  public readBuffer(path: string): Buffer {
    const raw = readFileSync(path);
    return this.openEnvelope(parseArtifactEnvelope(raw));
  }

  public readText(path: string): string {
    return this.readBuffer(path).toString('utf8');
  }

  public verify(path: string, expectedSha256: string): { readonly exists: boolean; readonly valid: boolean; readonly expectedSha256: string; readonly actualSha256?: string } {
    if (!existsSync(path)) return { exists: false, valid: false, expectedSha256 };
    const actualSha256 = createHash('sha256').update(readFileSync(path)).digest('hex');
    return { exists: true, valid: actualSha256 === expectedSha256, expectedSha256, actualSha256 };
  }

  public dispose(): void {
    this.#dataKey.fill(0);
  }

  #loadOrCreateDataKey(): Buffer {
    const { keyPath, protector } = this.options;
    mkdirSync(dirname(keyPath), { recursive: true, mode: 0o700 });
    if (existsSync(keyPath)) {
      const envelope = parseKeyEnvelope(readFileSync(keyPath));
      if (envelope.protectionId !== protector.protectionId) {
        throw new Error('Yan-artifact anahtarı farklı bir cihaz koruma sağlayıcısına ait.');
      }
      const decoded = Buffer.from(protector.unprotect(envelope.protectedDataKey), 'base64url');
      if (decoded.byteLength !== 32) throw new Error('Yan-artifact veri anahtarı geçersiz uzunlukta.');
      return decoded;
    }
    const dataKey = createDataKey();
    const envelope: ProtectedSideArtifactKeyEnvelope = {
      schemaVersion: KEY_SCHEMA_VERSION,
      protectionId: protector.protectionId,
      protectedDataKey: protector.protect(dataKey.toString('base64url')),
      createdAt: this.#now()
    };
    atomicWrite(keyPath, Buffer.from(`${JSON.stringify(envelope, null, 2)}\n`, 'utf8'));
    return dataKey;
  }
}
