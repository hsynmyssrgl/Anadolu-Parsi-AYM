import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import type { FullBackupFilePort, FullBackupRestorePlan } from '@ppt/application';
import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId
} from '@ppt/core';
import type { BackupInspectionView } from '@ppt/domain';
import { decryptBytes, type EncryptedEnvelope } from '@ppt/security';
import {
  decryptFullBackupPayloadV3,
  encryptFullBackupPayloadV3,
  FULL_BACKUP_FORMAT,
  FULL_BACKUP_VERSION
} from './backup-container-v3.js';
import type { ProtectedArchiveVaultKeyProvider } from './archive-vault-key-provider.js';

type BackupArchiveEntry = {
  readonly name: string;
  readonly data: string;
  readonly sha256?: string;
  readonly sizeBytes?: number;
};

type BackupPayload = {
  readonly version: number;
  readonly createdAt?: string;
  readonly database?: string;
  readonly vaultKey?: string;
  readonly archive?: readonly BackupArchiveEntry[];
  readonly manifest?: {
    readonly algorithm?: string;
    readonly databaseSha256?: string;
    readonly vaultKeySha256?: string;
    readonly archiveCount?: number;
  };
};

type ValidatedBackupPayload = {
  readonly version: 1 | 2;
  readonly createdAt?: string;
  readonly database: string;
  readonly vaultKey: string;
  readonly archive: readonly BackupArchiveEntry[];
  readonly manifest?: BackupPayload['manifest'];
};

type DecodedBackup = {
  readonly formatVersion: 1 | 2 | 3;
  readonly encrypted: boolean;
  readonly createdAt?: string;
  readonly payload: ValidatedBackupPayload;
};

type RestorePhase = 'prepared' | 'live-moved' | 'staged-installed' | 'committed';

type RestoreJournal = {
  readonly schemaVersion: 1;
  readonly transactionId: string;
  readonly phase: RestorePhase;
  readonly databasePath: string;
  readonly keyPath: string;
  readonly archivePath: string;
  readonly stagedDatabasePath: string;
  readonly stagedKeyPath: string;
  readonly stagedArchivePath: string;
  readonly stagingDirectory: string;
  readonly rollbackDatabasePath: string;
  readonly rollbackKeyPath: string;
  readonly rollbackArchivePath: string;
  readonly markerPath: string;
  readonly hadDatabase: boolean;
  readonly hadKey: boolean;
  readonly hadArchive: boolean;
  readonly restoredAt: string;
  readonly safetyBackupPath: string;
  readonly revokedTrustedDeviceCount: number;
};

export type FullBackupRestoreRecoveryResult = {
  readonly recovered: boolean;
  readonly action: 'none' | 'rolled-back' | 'committed-cleanup';
  readonly transactionId?: string;
};

const RESTORE_JOURNAL_FILE = 'restore-transaction.json';
const RESTORE_MARKER_FILE = 'restore-required-login.json';

const isWithin = (baseDirectory: string, candidatePath: string): boolean => {
  const value = relative(baseDirectory, candidatePath);
  return value === '' || (!value.startsWith('..') && !isAbsolute(value));
};

const writeDurableJson = (filePath: string, value: unknown): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    const descriptor = openSync(temporaryPath, 'r+');
    try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
    renameSync(temporaryPath, filePath);
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    throw error;
  }
};

const readJsonObject = (filePath: string): Record<string, unknown> => {
  const value = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('[BKP-020] Geri yükleme işlem günlüğü geçersizdir.');
  }
  return value as Record<string, unknown>;
};

const parseRestoreJournal = (filePath: string): RestoreJournal => {
  const value = readJsonObject(filePath);
  const stringFields = [
    'transactionId', 'phase', 'databasePath', 'keyPath', 'archivePath',
    'stagedDatabasePath', 'stagedKeyPath', 'stagedArchivePath', 'stagingDirectory',
    'rollbackDatabasePath', 'rollbackKeyPath', 'rollbackArchivePath', 'markerPath',
    'restoredAt', 'safetyBackupPath'
  ] as const;
  if (value.schemaVersion !== 1 || stringFields.some((field) => typeof value[field] !== 'string')) {
    throw new Error('[BKP-020] Geri yükleme işlem günlüğü eksik veya geçersizdir.');
  }
  if (!['prepared', 'live-moved', 'staged-installed', 'committed'].includes(String(value.phase))) {
    throw new Error('[BKP-020] Geri yükleme işlem aşaması geçersizdir.');
  }
  if (
    typeof value.hadDatabase !== 'boolean'
    || typeof value.hadKey !== 'boolean'
    || typeof value.hadArchive !== 'boolean'
    || !Number.isInteger(value.revokedTrustedDeviceCount)
    || Number(value.revokedTrustedDeviceCount) < 0
  ) {
    throw new Error('[BKP-020] Geri yükleme işlem güvenlik bilgileri geçersizdir.');
  }
  return value as unknown as RestoreJournal;
};

const markerBelongsToTransaction = (markerPath: string, transactionId: string): boolean => {
  if (!existsSync(markerPath)) return false;
  try {
    return readJsonObject(markerPath).restoreTransactionId === transactionId;
  } catch {
    return false;
  }
};

const validateRestoreJournalPaths = (
  journal: RestoreJournal,
  expected: { readonly databasePath: string; readonly keyPath: string; readonly archivePath: string }
): void => {
  const databasePath = resolve(expected.databasePath);
  const keyPath = resolve(expected.keyPath);
  const archivePath = resolve(expected.archivePath);
  const baseDirectory = dirname(databasePath);
  if (
    resolve(journal.databasePath) !== databasePath
    || resolve(journal.keyPath) !== keyPath
    || resolve(journal.archivePath) !== archivePath
    || resolve(journal.markerPath) !== join(baseDirectory, RESTORE_MARKER_FILE)
    || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/iu.test(journal.transactionId)
  ) {
    throw new Error('[BKP-020] Geri yükleme işlem günlüğü mevcut depolama düzeniyle eşleşmiyor.');
  }
  for (const path of [
    journal.stagingDirectory,
    journal.stagedDatabasePath,
    journal.stagedKeyPath,
    journal.stagedArchivePath,
    journal.rollbackDatabasePath,
    journal.rollbackKeyPath,
    journal.rollbackArchivePath
  ]) {
    if (!isWithin(baseDirectory, resolve(path))) {
      throw new Error('[BKP-020] Geri yükleme işlem günlüğünde güvenli olmayan yol bulundu.');
    }
  }
};

const removeLiveComponent = (path: string, directory: boolean): void => {
  rmSync(path, directory ? { recursive: true, force: true } : { force: true });
};

const restoreRollbackComponent = (input: {
  readonly livePath: string;
  readonly rollbackPath: string;
  readonly existedBefore: boolean;
  readonly directory: boolean;
  readonly phase: RestorePhase;
}): void => {
  if (existsSync(input.rollbackPath)) {
    removeLiveComponent(input.livePath, input.directory);
    renameSync(input.rollbackPath, input.livePath);
    return;
  }
  if (input.existedBefore) {
    if (input.phase === 'prepared' && existsSync(input.livePath)) return;
    throw new Error(`[BKP-021] Rollback kopyası bulunamadı: ${basename(input.rollbackPath)}`);
  }
  if (input.phase !== 'prepared') removeLiveComponent(input.livePath, input.directory);
};

const rollbackRestoreJournal = (journal: RestoreJournal, journalPath: string): void => {
  restoreRollbackComponent({
    livePath: journal.databasePath,
    rollbackPath: journal.rollbackDatabasePath,
    existedBefore: journal.hadDatabase,
    directory: false,
    phase: journal.phase
  });
  restoreRollbackComponent({
    livePath: journal.keyPath,
    rollbackPath: journal.rollbackKeyPath,
    existedBefore: journal.hadKey,
    directory: false,
    phase: journal.phase
  });
  restoreRollbackComponent({
    livePath: journal.archivePath,
    rollbackPath: journal.rollbackArchivePath,
    existedBefore: journal.hadArchive,
    directory: true,
    phase: journal.phase
  });
  rmSync(journal.stagingDirectory, { recursive: true, force: true });
  if (markerBelongsToTransaction(journal.markerPath, journal.transactionId)) {
    rmSync(journal.markerPath, { force: true });
  }
  rmSync(journalPath, { force: true });
};

const cleanupCommittedRestore = (journal: RestoreJournal, journalPath: string): void => {
  rmSync(journal.rollbackDatabasePath, { force: true });
  rmSync(journal.rollbackKeyPath, { force: true });
  rmSync(journal.rollbackArchivePath, { recursive: true, force: true });
  rmSync(journal.stagingDirectory, { recursive: true, force: true });
  rmSync(journalPath, { force: true });
};

export const recoverInterruptedFullBackupRestore = (input: {
  readonly databasePath: string;
  readonly keyPath: string;
  readonly archivePath: string;
}): FullBackupRestoreRecoveryResult => {
  const journalPath = join(dirname(resolve(input.databasePath)), RESTORE_JOURNAL_FILE);
  if (!existsSync(journalPath)) return { recovered: false, action: 'none' };
  const journal = parseRestoreJournal(journalPath);
  validateRestoreJournalPaths(journal, input);
  const liveSetComplete = existsSync(journal.databasePath)
    && existsSync(journal.keyPath)
    && existsSync(journal.archivePath);
  const committed = journal.phase === 'committed'
    || markerBelongsToTransaction(journal.markerPath, journal.transactionId);
  if (committed && liveSetComplete) {
    cleanupCommittedRestore(journal, journalPath);
    return { recovered: true, action: 'committed-cleanup', transactionId: journal.transactionId };
  }
  rollbackRestoreJournal(journal, journalPath);
  return { recovered: true, action: 'rolled-back', transactionId: journal.transactionId };
};


export interface FileSystemFullBackupFilePortOptions {
  readonly vaultKeyProvider?: ProtectedArchiveVaultKeyProvider;
}

export class FileSystemFullBackupFilePort implements FullBackupFilePort {
  public constructor(private readonly options: FileSystemFullBackupFilePortOptions = {}) {}

  public prepareDestination(
    input: { readonly destinationPath: string },
    correlationId: CorrelationId
  ): ReturnType<FullBackupFilePort['prepareDestination']> {
    try {
      mkdirSync(dirname(input.destinationPath), { recursive: true });
      return ok(undefined);
    } catch (error) {
      return err(this.#error(correlationId, error));
    }
  }

  public create(
    input: {
      readonly databasePath: string;
      readonly keyPath: string;
      readonly archivePath: string;
      readonly destinationPath: string;
      readonly createdAt: string;
      readonly password: string;
    },
    correlationId: CorrelationId
  ): ReturnType<FullBackupFilePort['create']> {
    try {
      const databaseBytes = readFileSync(input.databasePath);
      const keyBytes = this.#vaultKey(input.keyPath);
      const files = readdirSync(input.archivePath, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort()
        .map((name) => {
          const bytes = readFileSync(join(input.archivePath, name));
          return {
            name,
            data: bytes.toString('base64'),
            sha256: this.#sha256(bytes),
            sizeBytes: bytes.length
          };
        });
      const payload: ValidatedBackupPayload = {
        version: 2,
        createdAt: input.createdAt,
        database: databaseBytes.toString('base64'),
        vaultKey: keyBytes.toString('base64'),
        archive: files,
        manifest: {
          algorithm: 'sha256',
          databaseSha256: this.#sha256(databaseBytes),
          vaultKeySha256: this.#sha256(keyBytes),
          archiveCount: files.length
        }
      };
      const container = encryptFullBackupPayloadV3(payload, input.password, input.createdAt);
      const temporaryPath = `${input.destinationPath}.${randomUUID()}.tmp`;
      try {
        writeFileSync(temporaryPath, JSON.stringify(container), { mode: 0o600, flag: 'wx' });
        renameSync(temporaryPath, input.destinationPath);
      } catch (error) {
        rmSync(temporaryPath, { force: true });
        throw error;
      }
      return ok(undefined);
    } catch (error) {
      return err(this.#error(correlationId, error));
    }
  }

  public inspect(
    input: { readonly sourcePath: string; readonly password?: string },
    correlationId: CorrelationId
  ): ReturnType<FullBackupFilePort['inspect']> {
    try {
      const fileBytes = readFileSync(input.sourcePath);
      const decoded = this.#decodeBackup(fileBytes, input.password);
      const components = this.#validateComponents(decoded.payload);
      const legacy = decoded.formatVersion < FULL_BACKUP_VERSION;
      const checks: BackupInspectionView['checks'] = [
        {
          code: 'backup.container',
          label: 'Yedek kapsayıcısı',
          valid: true,
          detail: decoded.encrypted
            ? `${FULL_BACKUP_FORMAT} v${decoded.formatVersion}`
            : `Eski açık v${decoded.formatVersion} biçimi`
        },
        {
          code: 'backup.encryption',
          label: 'İçerik şifreleme',
          valid: decoded.encrypted,
          detail: decoded.encrypted
            ? 'AES-256-GCM ve parola tabanlı anahtar türetme doğrulandı'
            : 'Bu eski yedekte veritabanı ve kasa anahtarı şifreli kapsayıcı içinde değil'
        },
        { code: 'backup.transaction', label: 'Veritabanı', valid: true, detail: `${components.databaseBytes.length} bayt SQLite verisi` },
        { code: 'backup.vault_key', label: 'Dijital kasa anahtarı', valid: true, detail: '32 bayt anahtar doğrulandı' },
        { code: 'backup.archive', label: 'Şifreli arşiv', valid: true, detail: `${decoded.payload.archive.length} girdi doğrulandı` },
        {
          code: 'backup.manifest',
          label: 'Bütünlük manifesti',
          valid: true,
          detail: decoded.payload.version === 1
            ? 'Eski v1 iç payload; bileşen hash manifesti bulunmuyor'
            : 'SHA-256 bileşen manifesti doğrulandı'
        }
      ];
      return ok({
        valid: true,
        formatVersion: decoded.formatVersion,
        legacy,
        ...(decoded.createdAt ? { createdAt: decoded.createdAt } : {}),
        archiveCount: decoded.payload.archive.length,
        databaseBytes: components.databaseBytes.length,
        archiveBytes: components.archiveBytes,
        fileBytes: fileBytes.length,
        sha256: this.#sha256(fileBytes),
        riskLevel: legacy ? 'attention' : 'low',
        recommendation: legacy
          ? 'Geri yükleme desteklenir; bu eski açık biçim yalnız güvenilir ortamda kullanılmalı ve ardından parola korumalı v3 yedek oluşturulmalıdır.'
          : 'Parola korumalı yedek geri yükleme için uygun ve bütünlük kontrollerinden geçti.',
        checks
      });
    } catch (error) {
      return err(this.#error(correlationId, error));
    }
  }

  public stageRestore(
    input: {
      readonly sourcePath: string;
      readonly databasePath: string;
      readonly keyPath: string;
      readonly archivePath: string;
      readonly password?: string;
    },
    correlationId: CorrelationId
  ): ReturnType<FullBackupFilePort['stageRestore']> {
    const transactionId = randomUUID();
    const baseDir = dirname(resolve(input.databasePath));
    const stagingDirectory = join(baseDir, `.restore-stage-${transactionId}`);
    try {
      const decoded = this.#decodeBackup(readFileSync(input.sourcePath), input.password);
      const components = this.#validateComponents(decoded.payload);
      const stagedDatabasePath = join(stagingDirectory, 'panthera-family.db');
      const stagedKeyPath = join(stagingDirectory, 'vault.key');
      const stagedArchivePath = join(stagingDirectory, 'archive');
      mkdirSync(stagedArchivePath, { recursive: true });
      writeFileSync(stagedDatabasePath, components.databaseBytes, { mode: 0o600, flag: 'wx' });
      const localKeyBytes = this.options.vaultKeyProvider
        ? this.options.vaultKeyProvider.serializePortableKeyForCurrentDevice(components.keyBytes)
        : components.keyBytes;
      writeFileSync(stagedKeyPath, localKeyBytes, { mode: 0o600, flag: 'wx' });
      for (const item of decoded.payload.archive) {
        writeFileSync(
          join(stagedArchivePath, item.name),
          this.#base64(item.data, `Arşiv girdisi ${item.name}`),
          { mode: 0o600, flag: 'wx' }
        );
      }
      return ok({
        transactionId,
        stagingDirectory,
        stagedDatabasePath,
        stagedKeyPath,
        stagedArchivePath,
        databasePath: resolve(input.databasePath),
        keyPath: resolve(input.keyPath),
        archivePath: resolve(input.archivePath)
      });
    } catch (error) {
      rmSync(stagingDirectory, { recursive: true, force: true });
      return err(this.#error(correlationId, error));
    }
  }

  public discardRestore(
    input: { readonly plan: FullBackupRestorePlan },
    correlationId: CorrelationId
  ): ReturnType<FullBackupFilePort['discardRestore']> {
    try {
      const baseDirectory = dirname(resolve(input.plan.databasePath));
      const expectedName = `.restore-stage-${input.plan.transactionId}`;
      if (
        basename(input.plan.stagingDirectory) !== expectedName
        || !isWithin(baseDirectory, resolve(input.plan.stagingDirectory))
      ) {
        throw new Error('[BKP-022] Geri yükleme staging planı güvenli değil.');
      }
      rmSync(input.plan.stagingDirectory, { recursive: true, force: true });
      return ok(undefined);
    } catch (error) {
      return err(this.#error(correlationId, error));
    }
  }

  public commitRestore(
    input: {
      readonly plan: FullBackupRestorePlan;
      readonly restoredAt: string;
      readonly safetyBackupPath: string;
      readonly revokedTrustedDeviceCount: number;
    },
    correlationId: CorrelationId
  ): ReturnType<FullBackupFilePort['commitRestore']> {
    const { plan } = input;
    const baseDirectory = dirname(resolve(plan.databasePath));
    const journalPath = join(baseDirectory, RESTORE_JOURNAL_FILE);
    const markerPath = join(baseDirectory, RESTORE_MARKER_FILE);
    const journalBase: Omit<RestoreJournal, 'phase'> = {
      schemaVersion: 1,
      transactionId: plan.transactionId,
      databasePath: resolve(plan.databasePath),
      keyPath: resolve(plan.keyPath),
      archivePath: resolve(plan.archivePath),
      stagedDatabasePath: resolve(plan.stagedDatabasePath),
      stagedKeyPath: resolve(plan.stagedKeyPath),
      stagedArchivePath: resolve(plan.stagedArchivePath),
      stagingDirectory: resolve(plan.stagingDirectory),
      rollbackDatabasePath: join(baseDirectory, `panthera-family.db.restore-old-${plan.transactionId}`),
      rollbackKeyPath: join(baseDirectory, `vault.key.restore-old-${plan.transactionId}`),
      rollbackArchivePath: join(baseDirectory, `archive.restore-old-${plan.transactionId}`),
      markerPath,
      hadDatabase: existsSync(plan.databasePath),
      hadKey: existsSync(plan.keyPath),
      hadArchive: existsSync(plan.archivePath),
      restoredAt: input.restoredAt,
      safetyBackupPath: input.safetyBackupPath,
      revokedTrustedDeviceCount: input.revokedTrustedDeviceCount
    };
    let journal: RestoreJournal = { ...journalBase, phase: 'prepared' };
    try {
      if (existsSync(journalPath)) {
        throw new Error('[BKP-023] Önceki geri yükleme işlemi kurtarılmadan yeni işlem başlatılamaz.');
      }
      validateRestoreJournalPaths(journal, {
        databasePath: plan.databasePath,
        keyPath: plan.keyPath,
        archivePath: plan.archivePath
      });
      writeDurableJson(journalPath, journal);

      if (journal.hadDatabase) renameSync(journal.databasePath, journal.rollbackDatabasePath);
      if (journal.hadKey) renameSync(journal.keyPath, journal.rollbackKeyPath);
      if (journal.hadArchive) renameSync(journal.archivePath, journal.rollbackArchivePath);
      journal = { ...journalBase, phase: 'live-moved' };
      writeDurableJson(journalPath, journal);

      renameSync(journal.stagedDatabasePath, journal.databasePath);
      renameSync(journal.stagedKeyPath, journal.keyPath);
      renameSync(journal.stagedArchivePath, journal.archivePath);
      journal = { ...journalBase, phase: 'staged-installed' };
      writeDurableJson(journalPath, journal);

      writeDurableJson(markerPath, {
        schemaVersion: 2,
        restoredAt: input.restoredAt,
        safetyBackupPath: input.safetyBackupPath,
        restoreTransactionId: plan.transactionId,
        reauthorizationRequired: true,
        trustedDevicesRevoked: true,
        revokedTrustedDeviceCount: input.revokedTrustedDeviceCount
      });
      journal = { ...journalBase, phase: 'committed' };
      writeDurableJson(journalPath, journal);

      try {
        cleanupCommittedRestore(journal, journalPath);
      } catch {
        // Commit kalıcıdır. Artık rollback yapılmaz; açılış kurtarması yalnız eski kopyaları temizler.
      }
      return ok(undefined);
    } catch (error) {
      try {
        if (existsSync(journalPath)) {
          const persisted = parseRestoreJournal(journalPath);
          rollbackRestoreJournal(persisted, journalPath);
        } else {
          rmSync(plan.stagingDirectory, { recursive: true, force: true });
        }
      } catch (rollbackError) {
        return err(this.#error(
          correlationId,
          new Error(`[BKP-024] Geri yükleme başarısız oldu ve rollback tamamlanamadı: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`)
        ));
      }
      return err(this.#error(correlationId, error));
    }
  }

  #decodeBackup(fileBytes: Buffer, password?: string): DecodedBackup {
    let raw: unknown;
    try {
      raw = JSON.parse(fileBytes.toString('utf8')) as unknown;
    } catch {
      throw new Error('[BKP-002] Yedek dosyası geçerli JSON biçiminde değil.');
    }
    if (this.#looksEncryptedV3(raw)) {
      if (password === undefined || password.length === 0) {
        throw new Error('[BKP-016] Parola korumalı yedeği açmak için yedek parolası zorunludur.');
      }
      const decrypted = decryptFullBackupPayloadV3<BackupPayload>(raw, password);
      const payload = this.#validatedPayload(decrypted.payload, true);
      return {
        formatVersion: 3,
        encrypted: true,
        createdAt: decrypted.container.createdAt,
        payload
      };
    }
    const payload = this.#validatedPayload(raw, false);
    return {
      formatVersion: payload.version,
      encrypted: false,
      ...(payload.createdAt ? { createdAt: payload.createdAt } : {}),
      payload
    };
  }

  #looksEncryptedV3(value: unknown): boolean {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    return record.version === 3 || record.format === FULL_BACKUP_FORMAT;
  }

  #validatedPayload(payload: unknown, encryptedV3: boolean): ValidatedBackupPayload {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      throw new Error('[BKP-003] Yedek biçimi desteklenmiyor.');
    }
    const value = payload as BackupPayload;
    if (
      ![1, 2].includes(value.version)
      || (encryptedV3 && value.version !== 2)
      || typeof value.database !== 'string'
      || typeof value.vaultKey !== 'string'
      || !Array.isArray(value.archive)
    ) {
      throw new Error('[BKP-003] Yedek biçimi desteklenmiyor.');
    }
    if (value.createdAt !== undefined && Number.isNaN(Date.parse(value.createdAt))) {
      throw new Error('[BKP-003] Yedek oluşturma zamanı geçersiz.');
    }
    return {
      version: value.version as 1 | 2,
      ...(value.createdAt ? { createdAt: value.createdAt } : {}),
      database: value.database,
      vaultKey: value.vaultKey,
      archive: value.archive,
      ...(value.manifest ? { manifest: value.manifest } : {})
    };
  }

  #validateComponents(payload: ValidatedBackupPayload): {
    readonly databaseBytes: Buffer;
    readonly keyBytes: Buffer;
    readonly archiveBytes: number;
  } {
    const databaseBytes = this.#base64(payload.database, 'Veritabanı');
    const keyBytes = this.#base64(payload.vaultKey, 'Dijital kasa anahtarı');
    if (databaseBytes.subarray(0, 16).toString('utf8') !== 'SQLite format 3\u0000') {
      throw new Error('[BKP-004] Yedekte geçerli SQLite veritabanı bulunamadı.');
    }
    if (keyBytes.length !== 32) {
      throw new Error('[BKP-005] Yedekteki dijital kasa anahtarı geçersiz.');
    }
    if (payload.version === 2) {
      if (payload.manifest?.algorithm !== 'sha256' || payload.manifest.archiveCount !== payload.archive.length) {
        throw new Error('[BKP-006] Yedek manifesti geçersiz.');
      }
      if (this.#sha256(databaseBytes) !== payload.manifest.databaseSha256) {
        throw new Error('[BKP-007] Yedek veritabanı hash doğrulamasını geçemedi.');
      }
      if (this.#sha256(keyBytes) !== payload.manifest.vaultKeySha256) {
        throw new Error('[BKP-008] Yedek kasa anahtarı hash doğrulamasını geçemedi.');
      }
    }
    const names = new Set<string>();
    let archiveBytes = 0;
    for (const item of payload.archive) {
      if (!item || typeof item.name !== 'string' || basename(item.name) !== item.name || typeof item.data !== 'string') {
        throw new Error('[BKP-009] Yedekte güvenli olmayan arşiv girdisi bulundu.');
      }
      if (names.has(item.name)) {
        throw new Error(`[BKP-009] Yedekte yinelenen arşiv girdisi bulundu: ${item.name}`);
      }
      names.add(item.name);
      const bytes = this.#base64(item.data, `Arşiv girdisi ${item.name}`);
      archiveBytes += bytes.length;
      if (payload.version === 2 && (item.sizeBytes !== bytes.length || this.#sha256(bytes) !== item.sha256)) {
        throw new Error(`[BKP-010] Arşiv girdisi hash doğrulamasını geçemedi: ${item.name}`);
      }
      try {
        decryptBytes(JSON.parse(bytes.toString('utf8')) as EncryptedEnvelope, keyBytes);
      } catch {
        throw new Error(`[BKP-011] Arşiv girdisi doğrulanamadı: ${item.name}`);
      }
    }
    return { databaseBytes, keyBytes, archiveBytes };
  }

  #base64(value: string, label: string): Buffer {
    if (value.length === 0 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) {
      throw new Error(`[BKP-003] ${label} Base64 biçimi geçersiz.`);
    }
    const bytes = Buffer.from(value, 'base64');
    if (bytes.toString('base64') !== value) {
      throw new Error(`[BKP-003] ${label} Base64 biçimi kanonik değil.`);
    }
    return bytes;
  }

  #vaultKey(keyPath: string): Buffer {
    if (this.options.vaultKeyProvider) {
      if (!this.options.vaultKeyProvider.matchesPath(keyPath)) {
        throw new Error('Dijital kasa anahtarı sağlayıcısı yedekleme yolu ile eşleşmiyor.');
      }
      return this.options.vaultKeyProvider.exportPortableKey();
    }
    if (!existsSync(keyPath)) writeFileSync(keyPath, randomBytes(32), { mode: 0o600 });
    const key = readFileSync(keyPath);
    if (key.length !== 32) throw new Error('Dijital kasa anahtarı geçersiz.');
    return key;
  }

  #sha256(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
  }

  #error(correlationId: CorrelationId, error: unknown): AppError {
    return createAppError({
      code: ERROR_CODES.CORE_UNEXPECTED,
      message: error instanceof Error ? error.message : String(error),
      category: 'infrastructure',
      correlationId
    });
  }
}
