import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import type { DeviceSecretProtector } from '@ppt/security';

export const FACTORY_RESET_CONFIRMATION = 'ILK KURULUM ANINA DON' as const;

interface FactoryResetIntent {
  readonly schemaVersion: 1;
  readonly createdAt: string;
  readonly userDataPath: string;
  readonly confirmation: typeof FACTORY_RESET_CONFIRMATION;
  readonly noBackupCreated: true;
  readonly deleteKnownBackups: true;
  readonly backupArtifactPaths: readonly string[];
}

export class FactoryResetManager {
  public constructor(private readonly options: {
    readonly markerPath: string;
    readonly protector: DeviceSecretProtector;
    readonly userDataPath: string;
    readonly clock?: () => Date;
  }) {
    if (!isAbsolute(options.markerPath) || !isAbsolute(options.userDataPath)) throw new Error('Fabrika ayarı yolları mutlak olmalıdır.');
  }

  public async request(backupArtifactPaths: readonly string[], confirmation: string): Promise<void> {
    if (confirmation !== FACTORY_RESET_CONFIRMATION || backupArtifactPaths.length > 4096) throw new Error('Fabrika ayarı onayı geçersiz.');
    const paths = [...new Set(backupArtifactPaths.map((path) => resolve(path)))];
    if (paths.some((path) => !isAbsolute(path) || !path.toLowerCase().endsWith('.pptbackup'))) throw new Error('Fabrika ayarı yedek listesi geçersiz.');
    const intent: FactoryResetIntent = Object.freeze({
      schemaVersion: 1, createdAt: (this.options.clock?.() ?? new Date()).toISOString(),
      userDataPath: resolve(this.options.userDataPath), confirmation: FACTORY_RESET_CONFIRMATION,
      noBackupCreated: true, deleteKnownBackups: true, backupArtifactPaths: Object.freeze(paths)
    });
    await mkdir(dirname(this.options.markerPath), { recursive: true });
    const temporary = `${this.options.markerPath}.${randomBytes(8).toString('hex')}.tmp`;
    const protectedIntent = this.options.protector.protect(JSON.stringify(intent));
    await writeFile(temporary, `${JSON.stringify({ schemaVersion: 1, protectionId: this.options.protector.protectionId, protectedIntent }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await rename(temporary, this.options.markerPath);
  }

  public async executePending(): Promise<{ readonly executed: boolean; readonly deletedBackupCount: number }> {
    if (!existsSync(this.options.markerPath)) return { executed: false, deletedBackupCount: 0 };
    const metadata = await lstat(this.options.markerPath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || metadata.size > 64 * 1024) throw new Error('Fabrika ayarı işareti güvenilir değil.');
    const envelope = JSON.parse(await readFile(this.options.markerPath, 'utf8')) as Record<string, unknown>;
    if (envelope.schemaVersion !== 1 || envelope.protectionId !== this.options.protector.protectionId || typeof envelope.protectedIntent !== 'string') throw new Error('Fabrika ayarı zarfı geçersiz.');
    const intent = JSON.parse(this.options.protector.unprotect(envelope.protectedIntent)) as FactoryResetIntent;
    if (intent.schemaVersion !== 1 || intent.confirmation !== FACTORY_RESET_CONFIRMATION || intent.noBackupCreated !== true
      || intent.deleteKnownBackups !== true || resolve(intent.userDataPath) !== resolve(this.options.userDataPath)
      || !Array.isArray(intent.backupArtifactPaths) || intent.backupArtifactPaths.length > 4096) throw new Error('Fabrika ayarı isteği geçersiz.');
    let deletedBackupCount = 0;
    for (const path of intent.backupArtifactPaths) {
      if (!isAbsolute(path) || !path.toLowerCase().endsWith('.pptbackup')) throw new Error('Fabrika ayarı yedek yolu geçersiz.');
      if (!existsSync(path)) continue;
      const file = await lstat(path);
      if (!file.isFile() || file.isSymbolicLink() || file.nlink !== 1) throw new Error('Fabrika ayarı yedek dosyası güvenilir değil.');
      await rm(path, { force: true });
      if (existsSync(path)) throw new Error('Bilinen yedek dosyası silinemedi.');
      deletedBackupCount += 1;
    }
    await rm(this.options.userDataPath, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
    if (existsSync(this.options.userDataPath)) throw new Error('Kişisel veri kökü silinemedi.');
    await rm(this.options.markerPath, { force: true });
    return { executed: true, deletedBackupCount };
  }
}
