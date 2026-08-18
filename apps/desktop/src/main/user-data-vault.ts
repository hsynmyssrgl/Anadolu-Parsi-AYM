import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { chmodSync, constants, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { DeviceSecretProtector } from './device-secret-protector.js';
import {
  WindowsHelloVaultUnlockGrant,
  type WindowsHelloVaultGrantBinding
} from './windows-hello-platform-coordinator.js';

interface CipherEnvelope {
  readonly iv: string;
  readonly tag: string;
  readonly ciphertext: string;
}

interface VaultKeySlot {
  readonly id: string;
  readonly salt: string;
  readonly protectedEnvelope: string;
  readonly createdAt: string;
}

interface WindowsHelloVaultKeySlot {
  readonly id: string;
  readonly protectedEnvelope: string;
}

interface WindowsHelloVaultKeyPayload {
  readonly schemaVersion: 1;
  readonly purpose: 'windows-hello-vault-key';
  readonly slotId: string;
  readonly accountId: string;
  readonly registrationId: string;
  readonly deviceId: string;
  readonly deviceFingerprint: string;
  readonly windowsPrincipalHash: string;
  readonly securityEpoch: number;
  readonly dataKeyBase64: string;
}

interface VaultHeader {
  readonly schemaVersion: 1;
  readonly kdf: 'scrypt-v1';
  readonly contentCipher: 'aes-256-gcm';
  readonly deviceProtection: string;
  readonly keySlots: readonly VaultKeySlot[];
  readonly windowsHelloKeySlots?: readonly WindowsHelloVaultKeySlot[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WindowsHelloVaultBinding {
  readonly accountId: string;
  readonly registrationId: string;
  readonly deviceId: string;
  readonly deviceFingerprint: string;
  readonly windowsPrincipalHash: string;
  readonly securityEpoch: number;
}

export interface WindowsHelloVaultUnlockInput {
  readonly grant: WindowsHelloVaultUnlockGrant;
  readonly requestBinding: WindowsHelloVaultGrantBinding;
  readonly slotId?: string;
}

export interface WindowsHelloVaultUnlockResult {
  readonly accountId: string;
  readonly registrationId: string;
  readonly securityEpoch: number;
  readonly slotId: string;
  readonly databaseBytes: Buffer;
}

export type WindowsHelloVaultUnlockFailure =
  | 'slot_not_found'
  | 'device_changed'
  | 'principal_changed'
  | 'slot_invalid';

export class WindowsHelloVaultUnlockError extends Error {
  public constructor(public readonly failure: WindowsHelloVaultUnlockFailure) {
    super(`Windows Hello kasa açma işlemi başarısız: ${failure}.`);
    this.name = 'WindowsHelloVaultUnlockError';
  }
}

export interface UserDataVaultOptions {
  readonly headerPath: string;
  readonly containerPath: string;
  readonly protector: DeviceSecretProtector;
}

export interface UpgradeRollbackSnapshot {
  readonly schemaVersion: 1;
  readonly kind: 'encrypted-upgrade-rollback';
  readonly applicationVersion: string;
  readonly createdAt: string;
  readonly headerFile: string;
  readonly containerFile: string;
  readonly headerSha256: string;
  readonly containerSha256: string;
  readonly headerSizeBytes: number;
  readonly containerSizeBytes: number;
  readonly encryptedAtRest: true;
  readonly readbackVerified: true;
}

const encrypt = (key: Buffer, plain: Buffer): CipherEnvelope => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
};

const decrypt = (key: Buffer, envelope: CipherEnvelope): Buffer => {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
};

const parseEnvelope = (value: string): CipherEnvelope => {
  const parsed = JSON.parse(value) as Partial<CipherEnvelope>;
  if (typeof parsed.iv !== 'string' || typeof parsed.tag !== 'string' || typeof parsed.ciphertext !== 'string') {
    throw new Error('Kasa anahtar zarfı geçersiz.');
  }
  return { iv: parsed.iv, tag: parsed.tag, ciphertext: parsed.ciphertext };
};

const sha256Pattern = /^[a-f0-9]{64}$/u;
const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const safeVersionPattern = /^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$/u;
const sha256File = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');

const exactRegularFile = (path: string, maximumBytes: number): void => {
  const metadata = lstatSync(path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || metadata.size < 1 || metadata.size > maximumBytes) {
    throw new Error('Yükseltme geri dönüş kaynağı güvenilir bir normal dosya değil.');
  }
};

const isWindowsHelloKeySlot = (value: unknown): value is WindowsHelloVaultKeySlot => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Partial<WindowsHelloVaultKeySlot>;
  return typeof row.id === 'string'
    && row.id.length > 0
    && typeof row.protectedEnvelope === 'string'
    && row.protectedEnvelope.length > 0;
};

const parseWindowsHelloKeyPayload = (value: string): WindowsHelloVaultKeyPayload => {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new WindowsHelloVaultUnlockError('slot_invalid');
  }
  const row = parsed as Partial<WindowsHelloVaultKeyPayload>;
  if (
    row.schemaVersion !== 1
    || row.purpose !== 'windows-hello-vault-key'
    || typeof row.slotId !== 'string'
    || row.slotId.length < 1
    || row.slotId.length > 256
    || typeof row.accountId !== 'string'
    || row.accountId.length < 1
    || row.accountId.length > 256
    || typeof row.registrationId !== 'string'
    || row.registrationId.length < 1
    || row.registrationId.length > 256
    || typeof row.deviceId !== 'string'
    || row.deviceId.length < 1
    || row.deviceId.length > 256
    || typeof row.deviceFingerprint !== 'string'
    || !sha256Pattern.test(row.deviceFingerprint)
    || typeof row.windowsPrincipalHash !== 'string'
    || !sha256Pattern.test(row.windowsPrincipalHash)
    || !Number.isSafeInteger(row.securityEpoch)
    || Number(row.securityEpoch) < 0
    || typeof row.dataKeyBase64 !== 'string'
    || !base64Pattern.test(row.dataKeyBase64)
  ) {
    throw new WindowsHelloVaultUnlockError('slot_invalid');
  }
  return row as WindowsHelloVaultKeyPayload;
};

export class UserDataVault {
  private readonly options: UserDataVaultOptions;
  private dataKey: Buffer | undefined;
  private initializedThisSession = false;

  public constructor(options: UserDataVaultOptions) { this.options = options; }

  public isInitialized(): boolean { return existsSync(this.options.headerPath); }
  public isUnlocked(): boolean { return Boolean(this.dataKey); }

  public createUpgradeRollbackSnapshot(input: { readonly directory: string; readonly applicationVersion: string; readonly createdAt?: string }): UpgradeRollbackSnapshot | undefined {
    if (!this.dataKey) throw new Error('Kullanıcı veri kasası açılmadan yükseltme geri dönüş kopyası oluşturulamaz.');
    if (!isAbsolute(input.directory) || !safeVersionPattern.test(input.applicationVersion)) throw new Error('Yükseltme geri dönüş hedefi geçersiz.');
    if (!existsSync(this.options.containerPath)) return undefined;
    exactRegularFile(this.options.headerPath, 4 * 1024 * 1024);
    exactRegularFile(this.options.containerPath, 4 * 1024 * 1024 * 1024);
    const directory = resolve(input.directory);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    try { chmodSync(directory, 0o700); } catch { /* Windows ACL/DPAPI ve şifreli kaynak zarfı asıl kontroldür. */ }
    const stem = `surum-${input.applicationVersion}-oncesi`;
    const headerFile = `${stem}.baslik.pptrollback`;
    const containerFile = `${stem}.kasa.pptrollback`;
    const manifestFile = `${stem}.manifest.json`;
    const headerTarget = join(directory, headerFile);
    const containerTarget = join(directory, containerFile);
    const manifestTarget = join(directory, manifestFile);
    if (existsSync(manifestTarget)) {
      exactRegularFile(manifestTarget, 64 * 1024);
      const existing = JSON.parse(readFileSync(manifestTarget, 'utf8')) as Partial<UpgradeRollbackSnapshot>;
      if (existing.schemaVersion !== 1 || existing.kind !== 'encrypted-upgrade-rollback'
        || existing.applicationVersion !== input.applicationVersion || existing.headerFile !== headerFile
        || existing.containerFile !== containerFile || existing.encryptedAtRest !== true || existing.readbackVerified !== true
        || !existsSync(headerTarget) || !existsSync(containerTarget)) throw new Error('Mevcut yükseltme geri dönüş manifesti geçersiz.');
      exactRegularFile(headerTarget, 4 * 1024 * 1024);
      exactRegularFile(containerTarget, 4 * 1024 * 1024 * 1024);
      if (existing.headerSha256 !== sha256File(headerTarget) || existing.containerSha256 !== sha256File(containerTarget)
        || existing.headerSizeBytes !== statSync(headerTarget).size || existing.containerSizeBytes !== statSync(containerTarget).size) {
        throw new Error('Mevcut yükseltme geri dönüş kopyasının bütünlüğü bozulmuş.');
      }
      return Object.freeze(existing as UpgradeRollbackSnapshot);
    }
    if (existsSync(headerTarget) || existsSync(containerTarget)) throw new Error('Eksik yükseltme geri dönüş yayını güvenli biçimde yeniden kullanılamaz.');
    try {
      copyFileSync(this.options.headerPath, headerTarget, constants.COPYFILE_EXCL);
      copyFileSync(this.options.containerPath, containerTarget, constants.COPYFILE_EXCL);
      try { chmodSync(headerTarget, 0o600); chmodSync(containerTarget, 0o600); } catch { /* best effort */ }
      const evidence: UpgradeRollbackSnapshot = Object.freeze({
        schemaVersion: 1, kind: 'encrypted-upgrade-rollback', applicationVersion: input.applicationVersion,
        createdAt: input.createdAt ?? new Date().toISOString(), headerFile, containerFile,
        headerSha256: sha256File(headerTarget), containerSha256: sha256File(containerTarget),
        headerSizeBytes: statSync(headerTarget).size, containerSizeBytes: statSync(containerTarget).size,
        encryptedAtRest: true, readbackVerified: true
      });
      if (evidence.headerSha256 !== sha256File(this.options.headerPath) || evidence.containerSha256 !== sha256File(this.options.containerPath)) {
        throw new Error('Yükseltme geri dönüş kopyası geri-okuma doğrulamasından geçemedi.');
      }
      const temporaryManifest = `${manifestTarget}.tmp-${randomUUID()}`;
      writeFileSync(temporaryManifest, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      renameSync(temporaryManifest, manifestTarget);
      return evidence;
    } catch (error) {
      rmSync(headerTarget, { force: true });
      rmSync(containerTarget, { force: true });
      rmSync(manifestTarget, { force: true });
      throw error;
    }
  }

  private readHeader(): VaultHeader {
    const parsed = JSON.parse(readFileSync(this.options.headerPath, 'utf8')) as Partial<VaultHeader>;
    if (
      parsed.schemaVersion !== 1
      || parsed.kdf !== 'scrypt-v1'
      || parsed.contentCipher !== 'aes-256-gcm'
      || parsed.deviceProtection !== this.options.protector.protectionId
      || !Array.isArray(parsed.keySlots)
      || (parsed.windowsHelloKeySlots !== undefined
        && (!Array.isArray(parsed.windowsHelloKeySlots) || !parsed.windowsHelloKeySlots.every(isWindowsHelloKeySlot)))
    ) {
      throw new Error('Kullanıcı veri kasası başlığı geçersiz.');
    }
    return parsed as VaultHeader;
  }

  private writeHeader(header: VaultHeader): void {
    mkdirSync(dirname(this.options.headerPath), { recursive: true });
    const temp = `${this.options.headerPath}.tmp-${randomUUID()}`;
    writeFileSync(temp, `${JSON.stringify(header, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    try { chmodSync(temp, 0o600); } catch { /* Windows ACL is enforced by safeStorage/DPAPI; POSIX mode is best effort. */ }
    renameSync(temp, this.options.headerPath);
  }

  private createPasswordSlot(password: string, dataKey: Buffer): VaultKeySlot {
    if (password.length < 12) throw new Error('Kasa parolası en az 12 karakter olmalıdır.');
    if (!this.options.protector.isAvailable()) throw new Error('Windows cihaz sır koruması kullanılamıyor.');
    const salt = randomBytes(16);
    const wrappingKey = scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    try {
      const passwordEnvelope = encrypt(wrappingKey, dataKey);
      const protectedEnvelope = this.options.protector.protect(JSON.stringify(passwordEnvelope));
      return { id: randomUUID(), salt: salt.toString('base64'), protectedEnvelope, createdAt: new Date().toISOString() };
    } finally {
      wrappingKey.fill(0);
    }
  }

  public initialize(password: string): Buffer {
    if (this.isInitialized()) throw new Error('Kullanıcı veri kasası zaten oluşturulmuş.');
    const dataKey = randomBytes(32);
    const now = new Date().toISOString();
    const header: VaultHeader = {
      schemaVersion: 1,
      kdf: 'scrypt-v1',
      contentCipher: 'aes-256-gcm',
      deviceProtection: this.options.protector.protectionId,
      keySlots: [this.createPasswordSlot(password, dataKey)],
      windowsHelloKeySlots: [],
      createdAt: now,
      updatedAt: now
    };
    this.writeHeader(header);
    this.dataKey = dataKey;
    this.initializedThisSession = true;
    return Buffer.alloc(0);
  }

  public registerAdditionalPassword(password: string): void {
    if (!this.dataKey) throw new Error('Kasa kilitliyken yeni parola anahtar yuvası eklenemez.');
    const header = this.readHeader();
    const now = new Date().toISOString();
    this.writeHeader({ ...header, keySlots: [...header.keySlots, this.createPasswordSlot(password, this.dataKey)], updatedAt: now });
  }

  public replacePassword(password: string): void {
    if (!this.dataKey) throw new Error('Kasa kilitliyken parola değiştirilemez.');
    const header = this.readHeader();
    const now = new Date().toISOString();
    this.writeHeader({ ...header, keySlots: [this.createPasswordSlot(password, this.dataKey)], updatedAt: now });
  }

  public hasWindowsHelloKeySlots(): boolean {
    if (!this.isInitialized()) return false;
    return (this.readHeader().windowsHelloKeySlots?.length ?? 0) > 0;
  }

  public registerWindowsHelloKeySlot(binding: WindowsHelloVaultBinding): string {
    if (!this.dataKey) throw new Error('Kasa kilitliyken Windows Hello anahtar yuvası eklenemez.');
    if (!this.options.protector.isAvailable()) throw new Error('Windows cihaz sır koruması kullanılamıyor.');
    if (
      !binding.accountId
      || binding.accountId.length > 256
      || !binding.registrationId
      || binding.registrationId.length > 256
      || !binding.deviceId
      || binding.deviceId.length > 256
      || !sha256Pattern.test(binding.deviceFingerprint)
      || !sha256Pattern.test(binding.windowsPrincipalHash)
      || !Number.isSafeInteger(binding.securityEpoch)
      || binding.securityEpoch < 0
    ) {
      throw new Error('Windows Hello kasa bağı geçersiz.');
    }
    const header = this.readHeader();
    const id = randomUUID();
    const payload: WindowsHelloVaultKeyPayload = {
      schemaVersion: 1,
      purpose: 'windows-hello-vault-key',
      slotId: id,
      accountId: binding.accountId,
      registrationId: binding.registrationId,
      deviceId: binding.deviceId,
      deviceFingerprint: binding.deviceFingerprint,
      windowsPrincipalHash: binding.windowsPrincipalHash,
      securityEpoch: binding.securityEpoch,
      dataKeyBase64: this.dataKey.toString('base64')
    };
    const protectedEnvelope = this.options.protector.protect(JSON.stringify(payload));
    const now = new Date().toISOString();
    this.writeHeader({
      ...header,
      windowsHelloKeySlots: [{ id, protectedEnvelope }],
      updatedAt: now
    });
    return id;
  }

  public removeWindowsHelloKeySlot(slotId: string): void {
    const header = this.readHeader();
    const current = header.windowsHelloKeySlots ?? [];
    const next = current.filter((slot) => slot.id !== slotId);
    if (next.length === current.length) return;
    this.writeHeader({ ...header, windowsHelloKeySlots: next, updatedAt: new Date().toISOString() });
  }

  public clearWindowsHelloKeySlots(): void {
    const header = this.readHeader();
    if ((header.windowsHelloKeySlots?.length ?? 0) === 0) return;
    this.writeHeader({ ...header, windowsHelloKeySlots: [], updatedAt: new Date().toISOString() });
  }

  public unlockWithWindowsHello(input: WindowsHelloVaultUnlockInput): WindowsHelloVaultUnlockResult {
    if (this.isUnlocked()) throw new Error('Kullanıcı veri kasası zaten açık.');
    if (!(input.grant instanceof WindowsHelloVaultUnlockGrant)) {
      throw new WindowsHelloVaultUnlockError('slot_invalid');
    }
    let verified;
    try {
      verified = input.grant.consume(input.requestBinding);
    } catch {
      throw new WindowsHelloVaultUnlockError('slot_invalid');
    }
    if (!sha256Pattern.test(verified.deviceFingerprint) || !sha256Pattern.test(verified.windowsPrincipalHash)) {
      throw new WindowsHelloVaultUnlockError('slot_invalid');
    }
    const header = this.readHeader();
    const candidates = (header.windowsHelloKeySlots ?? [])
      .filter((slot) => input.slotId === undefined || slot.id === input.slotId)
      .slice()
      .reverse();
    if (candidates.length === 0) throw new WindowsHelloVaultUnlockError('slot_not_found');
    let mismatch: WindowsHelloVaultUnlockFailure = 'slot_not_found';
    for (const slot of candidates) {
      let candidateKey: Buffer | undefined;
      try {
        const payload = parseWindowsHelloKeyPayload(this.options.protector.unprotect(slot.protectedEnvelope));
        if (payload.slotId !== slot.id) throw new WindowsHelloVaultUnlockError('slot_invalid');
        if (payload.deviceId !== verified.deviceId || payload.deviceFingerprint !== verified.deviceFingerprint) {
          mismatch = 'device_changed';
          continue;
        }
        if (payload.windowsPrincipalHash !== verified.windowsPrincipalHash) {
          mismatch = 'principal_changed';
          continue;
        }
        candidateKey = Buffer.from(payload.dataKeyBase64, 'base64');
        if (candidateKey.byteLength !== 32) throw new WindowsHelloVaultUnlockError('slot_invalid');
        const databaseBytes = existsSync(this.options.containerPath)
          ? decrypt(candidateKey, parseEnvelope(readFileSync(this.options.containerPath, 'utf8')))
          : Buffer.alloc(0);
        this.dataKey = candidateKey;
        candidateKey = undefined;
        return {
          accountId: payload.accountId,
          registrationId: payload.registrationId,
          securityEpoch: payload.securityEpoch,
          slotId: slot.id,
          databaseBytes
        };
      } catch (error) {
        if (error instanceof WindowsHelloVaultUnlockError) throw error;
        throw new WindowsHelloVaultUnlockError('slot_invalid');
      } finally {
        candidateKey?.fill(0);
      }
    }
    throw new WindowsHelloVaultUnlockError(mismatch);
  }

  public unlock(password: string): Buffer {
    if (this.isUnlocked()) throw new Error('Kullanıcı veri kasası zaten açık.');
    const header = this.readHeader();
    let dataKey: Buffer | undefined;
    for (const slot of header.keySlots) {
      let wrappingKey: Buffer | undefined;
      try {
        const protectedPayload = this.options.protector.unprotect(slot.protectedEnvelope);
        const envelope = parseEnvelope(protectedPayload);
        wrappingKey = scryptSync(password, Buffer.from(slot.salt, 'base64'), 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
        const candidate = decrypt(wrappingKey, envelope);
        if (candidate.byteLength === 32) { dataKey = candidate; break; }
        candidate.fill(0);
      } catch {
        // Try the next opaque key slot without exposing which factor failed.
      } finally {
        wrappingKey?.fill(0);
      }
    }
    if (!dataKey) throw new Error('Kasa parolası veya bu cihazın güvenlik bağı geçersiz.');
    this.dataKey = dataKey;
    return existsSync(this.options.containerPath)
      ? decrypt(dataKey, parseEnvelope(readFileSync(this.options.containerPath, 'utf8')))
      : Buffer.alloc(0);
  }

  public checkpoint(databaseBytes: Buffer): void {
    if (!this.dataKey) throw new Error('Kullanıcı veri kasası kilitliyken checkpoint oluşturulamaz.');
    const envelope = encrypt(this.dataKey, databaseBytes);
    mkdirSync(dirname(this.options.containerPath), { recursive: true });
    const temp = `${this.options.containerPath}.tmp-${randomUUID()}`;
    try {
      writeFileSync(temp, `${JSON.stringify(envelope)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      try { chmodSync(temp, 0o600); } catch { /* best effort */ }
      renameSync(temp, this.options.containerPath);
    } catch (error) {
      rmSync(temp, { force: true });
      throw error;
    }
  }

  public seal(databaseBytes: Buffer): void {
    this.checkpoint(databaseBytes);
    this.discardSession();
  }

  public sealExternalDatabaseFile(databasePath: string): void {
    if (!existsSync(databasePath)) throw new Error('Mühürlenecek geri yükleme veritabanı bulunamadı.');
    const bytes = readFileSync(databasePath);
    try {
      this.seal(bytes);
    } finally {
      bytes.fill(0);
      rmSync(databasePath, { force: true });
    }
  }

  public discardSession(): void {
    if (this.dataKey) this.dataKey.fill(0);
    this.dataKey = undefined;
  }

  public abortInitialization(): void {
    if (!this.initializedThisSession) { this.discardSession(); return; }
    this.discardSession();
    rmSync(this.options.headerPath, { force: true });
    rmSync(this.options.containerPath, { force: true });
    this.initializedThisSession = false;
  }

  public markInitializationCommitted(): void { this.initializedThisSession = false; }
}
