import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, copyFile, lstat, mkdir, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export interface UninstallBackupTarget {
  readonly kind: 'local_documents' | 'onedrive' | 'google_drive' | 'icloud_drive';
  readonly rootPath: string;
}

export interface UninstallBackupResult {
  readonly status: 'success' | 'no_data';
  readonly backupDirectories: readonly string[];
  readonly copiedFiles: number;
  readonly copiedBytes: number;
}

const isWithin = (parent: string, child: string): boolean => {
  const rel = relative(resolve(parent), resolve(child));
  return rel !== '' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};
const existsDirectory = async (path: string): Promise<boolean> => {
  try { return (await lstat(path)).isDirectory(); } catch { return false; }
};

export const discoverUninstallBackupTargets = async (input: {
  readonly documentsPath: string;
  readonly homePath: string;
  readonly environment: NodeJS.ProcessEnv;
}): Promise<readonly UninstallBackupTarget[]> => {
  const candidates: UninstallBackupTarget[] = [
    { kind: 'local_documents', rootPath: join(input.documentsPath, 'Anadolu Parsi Yedekleri') }
  ];
  for (const path of [input.environment.OneDrive, input.environment.OneDriveCommercial, input.environment.OneDriveConsumer]) {
    if (path && await existsDirectory(path)) candidates.push({ kind: 'onedrive', rootPath: join(path, 'Anadolu Parsi Yedekleri') });
  }
  for (const path of [join(input.homePath, 'My Drive'), join(input.homePath, 'Google Drive')]) {
    if (await existsDirectory(path)) candidates.push({ kind: 'google_drive', rootPath: join(path, 'Anadolu Parsi Yedekleri') });
  }
  const iCloud = join(input.homePath, 'iCloudDrive');
  if (await existsDirectory(iCloud)) candidates.push({ kind: 'icloud_drive', rootPath: join(iCloud, 'Anadolu Parsi Yedekleri') });
  const unique = new Map<string, UninstallBackupTarget>();
  for (const candidate of candidates) unique.set(resolve(candidate.rootPath).toLocaleLowerCase('tr-TR'), candidate);
  return Object.freeze([...unique.values()]);
};

const sha256File = (path: string): Promise<string> => new Promise((resolveHash, rejectHash) => {
  const hash = createHash('sha256');
  const stream = createReadStream(path, { flags: 'r' });
  stream.on('data', (chunk) => hash.update(chunk));
  stream.once('error', rejectHash);
  stream.once('end', () => resolveHash(hash.digest('hex')));
});

const listProtectedPersistentFiles = async (userDataPath: string): Promise<readonly { readonly path: string; readonly relativePath: string; readonly size: number; readonly sha256: string }[]> => {
  const allowedRoots = ['data', 'archive', 'secrets', 'safety-backups'];
  const files: { path: string; relativePath: string; size: number; sha256: string }[] = [];
  let totalBytes = 0;
  const walk = async (path: string): Promise<void> => {
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries) {
      const child = join(path, entry.name);
      const metadata = await lstat(child);
      if (metadata.isSymbolicLink()) throw new Error('Yedek kaynağında sembolik bağ bulundu.');
      if (metadata.isDirectory()) { await walk(child); continue; }
      if (!metadata.isFile() || metadata.nlink !== 1) throw new Error('Yedek kaynağında güvenilmeyen dosya türü bulundu.');
      const relativePath = relative(userDataPath, child);
      if (relativePath.startsWith('..') || isAbsolute(relativePath)) throw new Error('Yedek kaynağı kullanıcı verisi dışına çıktı.');
      totalBytes += metadata.size;
      if (files.length >= 100_000 || totalBytes > 256 * 1024 * 1024 * 1024) throw new Error('Kaldırma yedeği güvenli boyut sınırını aştı.');
      files.push({ path: child, relativePath, size: metadata.size, sha256: await sha256File(child) });
    }
  };
  for (const rootName of allowedRoots) {
    const path = join(userDataPath, rootName);
    if (await existsDirectory(path)) await walk(path);
  }
  return Object.freeze(files);
};

export const createVerifiedUninstallBackups = async (input: {
  readonly userDataPath: string;
  readonly targets: readonly UninstallBackupTarget[];
  readonly createdAt: string;
  readonly applicationVersion: string;
}): Promise<UninstallBackupResult> => {
  if (!isAbsolute(input.userDataPath) || input.targets.length < 1 || input.targets.length > 8) throw new Error('Kaldırma yedeği girdisi geçersiz.');
  const userDataPath = resolve(input.userDataPath);
  const sourceExists = await existsDirectory(userDataPath);
  if (!sourceExists) return Object.freeze({ status: 'no_data', backupDirectories: [], copiedFiles: 0, copiedBytes: 0 });
  const files = await listProtectedPersistentFiles(userDataPath);
  const timestamp = input.createdAt.replace(/[:.]/gu, '-');
  const backupDirectories: string[] = [];
  for (const target of input.targets) {
    const rootPath = resolve(target.rootPath);
    if (rootPath === userDataPath || isWithin(userDataPath, rootPath) || isWithin(rootPath, userDataPath)) throw new Error('Kaldırma yedeği kaynak veriyle iç içe olamaz.');
    await mkdir(rootPath, { recursive: true });
    const realRoot = await realpath(rootPath);
    if (realRoot !== rootPath || (await lstat(rootPath)).isSymbolicLink()) throw new Error('Kaldırma yedek hedefi güvenilir gerçek dizin değil.');
    const backupDirectory = join(rootPath, `ParsYuva_AYM_Kaldirma_Yedegi_${timestamp}`);
    await mkdir(backupDirectory, { recursive: false });
    const manifestFiles: Array<{ relativePath: string; size: number; sha256: string }> = [];
    for (const source of files) {
      const destination = join(backupDirectory, source.relativePath);
      if (!isWithin(backupDirectory, destination)) throw new Error('Kaldırma yedek hedefi sınır dışına çıktı.');
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(source.path, destination, 1);
      const destinationMetadata = await lstat(destination);
      const destinationHash = await sha256File(destination);
      if (!destinationMetadata.isFile() || destinationMetadata.nlink !== 1 || destinationMetadata.size !== source.size || destinationHash !== source.sha256) {
        throw new Error('Kaldırma yedeği okuma sonrası doğrulanamadı.');
      }
      manifestFiles.push({ relativePath: source.relativePath.replaceAll('\\', '/'), size: source.size, sha256: source.sha256 });
    }
    const manifest = {
      schemaVersion: 1, product: 'ParsYuva AYM', applicationVersion: input.applicationVersion,
      createdAt: input.createdAt, sourceDirectoryName: basename(userDataPath), targetKind: target.kind,
      encryptedPersistentCopy: true, cloudUploadObserved: false, providerSyncResponsibility: target.kind !== 'local_documents',
      files: manifestFiles
    };
    const manifestPath = join(backupDirectory, 'YEDEK_MANIFESTOSU.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    JSON.parse(await readFile(manifestPath, 'utf8'));
    backupDirectories.push(backupDirectory);
  }
  return Object.freeze({
    status: 'success', backupDirectories: Object.freeze(backupDirectories), copiedFiles: files.length,
    copiedBytes: files.reduce((sum, file) => sum + file.size, 0)
  });
};
