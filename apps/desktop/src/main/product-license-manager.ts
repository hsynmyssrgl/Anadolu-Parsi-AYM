import { randomBytes } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  advanceProductLicenseLedger,
  createProductLicenseLedger,
  evaluateProductLicense,
  verifyGoldActivationCode,
  validateProductLicenseLedger,
  type DeviceSecretProtector,
  type ProductLicenseChannel,
  type ProductLicenseLedger,
  type ProductLicenseStatusView
} from '@ppt/security';

interface ProtectedLicenseEnvelope {
  readonly schemaVersion: 1;
  readonly protectionId: string;
  readonly protectedLedger: string;
}

export interface ProductLicenseManagerOptions {
  readonly primaryPath: string;
  readonly anchorPath: string;
  readonly protector: DeviceSecretProtector;
  readonly channel: ProductLicenseChannel;
  readonly deviceBindingSha256: string;
  readonly goldPublicKeyPem?: string;
  readonly clock?: () => Date;
  readonly installationId?: () => string;
}

const exactEnvelope = (value: unknown): value is ProtectedLicenseEnvelope => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const envelope = value as Record<string, unknown>;
  return Object.keys(envelope).sort().join('\u0000') === ['protectedLedger', 'protectionId', 'schemaVersion'].sort().join('\u0000')
    && envelope.schemaVersion === 1 && typeof envelope.protectionId === 'string'
    && typeof envelope.protectedLedger === 'string' && envelope.protectedLedger.length <= 16_384;
};

const sameLicenseIdentity = (left: ProductLicenseLedger, right: ProductLicenseLedger): boolean =>
  left.installationId === right.installationId && left.deviceBindingSha256 === right.deviceBindingSha256
  && left.installedAt === right.installedAt && left.trialEndsAt === right.trialEndsAt;

export class ProductLicenseManager {
  readonly #options: ProductLicenseManagerOptions;
  #ledger: ProductLicenseLedger | undefined;
  #status: ProductLicenseStatusView | undefined;

  public constructor(options: ProductLicenseManagerOptions) {
    if (resolve(options.primaryPath) === resolve(options.anchorPath)) throw new Error('Lisans kayıt yolları ayrı olmalıdır.');
    if (!/^[a-f0-9]{64}$/u.test(options.deviceBindingSha256)) throw new Error('Lisans cihaz bağı geçersiz.');
    this.#options = options;
  }

  async #ensureParent(path: string): Promise<void> {
    const parent = dirname(resolve(path));
    await mkdir(parent, { recursive: true });
    const metadata = await lstat(parent);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || await realpath(parent) !== parent) {
      throw new Error('Lisans kayıt dizini güvenilir bir gerçek dizin değil.');
    }
  }

  async #read(path: string): Promise<ProductLicenseLedger | undefined> {
    try {
      const metadata = await lstat(path);
      if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || metadata.size < 32 || metadata.size > 32_768) throw new Error('Lisans kayıt dosyası güvenilir değil.');
      const envelope = JSON.parse(await readFile(path, 'utf8')) as unknown;
      if (!exactEnvelope(envelope) || envelope.protectionId !== this.#options.protector.protectionId) throw new Error('Lisans kayıt zarfı geçersiz.');
      const ledger = JSON.parse(this.#options.protector.unprotect(envelope.protectedLedger)) as unknown;
      if (!validateProductLicenseLedger(ledger)) throw new Error('Lisans defteri geçersiz.');
      return ledger;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }

  #reconcile(primary: ProductLicenseLedger | undefined, anchor: ProductLicenseLedger | undefined): ProductLicenseLedger | undefined {
    if (!primary) return anchor;
    if (!anchor) return primary;
    if (!sameLicenseIdentity(primary, anchor)) throw new Error('Lisans kayıtları birbiriyle uyuşmuyor.');
    let activationCode = primary.activationCode;
    if (primary.activationCode !== anchor.activationCode) {
      const candidates = [primary.activationCode, anchor.activationCode].filter((value): value is string => Boolean(value));
      const valid = this.#options.channel === 'Gold' && this.#options.goldPublicKeyPem
        ? candidates.filter((code) => {
          try {
            verifyGoldActivationCode(code, this.#options.goldPublicKeyPem!, this.#options.deviceBindingSha256, this.#now());
            return true;
          } catch { return false; }
        })
        : [];
      if (valid.length !== 1) throw new Error('Lisans aktivasyon kayıtları uzlaştırılamadı.');
      activationCode = valid[0];
    }
    return advanceProductLicenseLedger(
      primary,
      new Date(Math.max(Date.parse(primary.lastObservedAt), Date.parse(anchor.lastObservedAt))).toISOString(),
      activationCode
    );
  }

  #now(): string { return (this.#options.clock?.() ?? new Date()).toISOString(); }

  async #write(path: string, ledger: ProductLicenseLedger): Promise<void> {
    await this.#ensureParent(path);
    const envelope: ProtectedLicenseEnvelope = Object.freeze({
      schemaVersion: 1,
      protectionId: this.#options.protector.protectionId,
      protectedLedger: this.#options.protector.protect(JSON.stringify(ledger))
    });
    const temporary = `${resolve(path)}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
    await writeFile(temporary, `${JSON.stringify(envelope, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    try { await rename(temporary, resolve(path)); }
    finally { await rm(temporary, { force: true }); }
    const readback = await this.#read(resolve(path));
    if (!readback || JSON.stringify(readback) !== JSON.stringify(ledger)) throw new Error('Lisans kayıt yazımı doğrulanamadı.');
  }

  async #persist(ledger: ProductLicenseLedger): Promise<void> {
    await this.#write(this.#options.primaryPath, ledger);
    await this.#write(this.#options.anchorPath, ledger);
  }

  public async initialize(): Promise<ProductLicenseStatusView> {
    if (!this.#options.protector.isAvailable()) throw new Error('Lisans kaydı için işletim sistemi koruması kullanılamıyor.');
    const [primary, anchor] = await Promise.all([this.#read(this.#options.primaryPath), this.#read(this.#options.anchorPath)]);
    const now = this.#now();
    const existing = this.#reconcile(primary, anchor);
    const ledger = existing ?? createProductLicenseLedger({
      installationId: this.#options.installationId?.() ?? randomBytes(24).toString('base64url'),
      deviceBindingSha256: this.#options.deviceBindingSha256,
      installedAt: now
    });
    if (ledger.deviceBindingSha256 !== this.#options.deviceBindingSha256) throw new Error('Lisans kaydı başka bir cihaza bağlı.');
    const status = evaluateProductLicense({
      channel: this.#options.channel, ledger, observedAt: now,
      ...(this.#options.goldPublicKeyPem ? { goldPublicKeyPem: this.#options.goldPublicKeyPem } : {})
    });
    const next = status.reason === 'CLOCK_ROLLBACK_DETECTED' ? ledger : advanceProductLicenseLedger(ledger, now);
    await this.#persist(next);
    this.#ledger = next;
    this.#status = status;
    return status;
  }

  public status(): ProductLicenseStatusView {
    if (!this.#status) throw new Error('Lisans yöneticisi başlatılmadı.');
    return this.#status;
  }

  public async refresh(): Promise<ProductLicenseStatusView> {
    if (!this.#ledger) return this.initialize();
    const now = this.#now();
    const status = evaluateProductLicense({
      channel: this.#options.channel, ledger: this.#ledger, observedAt: now,
      ...(this.#options.goldPublicKeyPem ? { goldPublicKeyPem: this.#options.goldPublicKeyPem } : {})
    });
    if (status.reason !== 'CLOCK_ROLLBACK_DETECTED') {
      this.#ledger = advanceProductLicenseLedger(this.#ledger, now);
      await this.#persist(this.#ledger);
    }
    this.#status = status;
    return status;
  }

  public async activateGold(code: string): Promise<ProductLicenseStatusView> {
    if (this.#options.channel !== 'Gold' || !this.#options.goldPublicKeyPem || !this.#ledger) throw new Error('Gold aktivasyon yetkisi kullanılamıyor.');
    const now = this.#now();
    verifyGoldActivationCode(code, this.#options.goldPublicKeyPem, this.#options.deviceBindingSha256, now);
    const next = advanceProductLicenseLedger(this.#ledger, now, code);
    const status = evaluateProductLicense({ channel: 'Gold', ledger: next, observedAt: now, goldPublicKeyPem: this.#options.goldPublicKeyPem });
    if (!status.allowed || !status.perpetual) throw new Error('Gold aktivasyon doğrulanamadı.');
    await this.#persist(next);
    this.#ledger = next;
    this.#status = status;
    return status;
  }
}
