import { createHash } from 'node:crypto';
import {
  access,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile
} from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';

const mode = process.argv[2] ?? 'verify';
const sourceRoot = resolve(process.cwd());
const aymRoot = resolve(sourceRoot, '..', '..');
const receiptRoot = resolve(aymRoot, '05_TEST', '30Z_LOCAL_RECEIPT');
const backupRoot = resolve(aymRoot, '10_YEDEK');
const excludedDirectoryNames = new Set([
  '.git', '.cache', '.tmp', '.turbo', 'coverage', 'dist', 'node_modules', 'temp', 'tmp'
]);
const excludedRelativePaths = new Set([
  'artifacts/deliveries/Anadolu_Parsi_Aile_Yasam_Merkezi_Bronze_04.08.2026.29.json',
  'artifacts/reports/DELIVERY_STATUS_04.08.2026.29.json',
  'artifacts/validation/delivery-report-contract-v2.json'
]);
const fixedDosDate = 33;
const utf8Flag = 0x0800;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hashFile = async (path) => sha256(await readFile(path));
const normalizePath = (path) => path.split(sep).join('/');

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0 ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const scan = async () => {
  const files = [];
  const visit = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      if (entry.isDirectory() && excludedDirectoryNames.has(entry.name)) continue;
      const absolute = resolve(directory, entry.name);
      const rel = normalizePath(relative(sourceRoot, absolute));
      if (entry.isSymbolicLink()) throw new Error(`Symbolic link is forbidden in authoritative source: ${rel}`);
      if (excludedRelativePaths.has(rel)) continue;
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        const info = await stat(absolute);
        const digest = await hashFile(absolute);
        files.push({ path: rel, bytes: info.size, sha256: digest, absolute });
      }
    }
  };
  await visit(sourceRoot);
  files.sort((left, right) => left.path.localeCompare(right.path, 'en'));
  const canonical = files.map((file) => `${file.sha256}\t${file.bytes}\t${file.path}\n`).join('');
  return {
    files,
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    treeSha256: sha256(Buffer.from(canonical, 'utf8'))
  };
};

const writeImmutable = async (path, bytes) => {
  try {
    await writeFile(path, bytes, { flag: 'wx' });
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const current = await readFile(path);
    if (!current.equals(bytes)) throw new Error(`Immutable artifact conflict: ${path}`);
  }
  const readback = await readFile(path);
  if (!readback.equals(bytes)) throw new Error(`Readback mismatch: ${path}`);
};

const writeAll = async (handle, buffer, start) => {
  let written = 0;
  while (written < buffer.length) {
    const result = await handle.write(buffer, written, buffer.length - written, start + written);
    if (result.bytesWritten <= 0) throw new Error('ZIP write made no progress.');
    written += result.bytesWritten;
  }
};

const buildDeterministicZip = async (inventory, target) => {
  const temp = `${target}.tmp-${process.pid}`;
  const handle = await open(temp, 'wx');
  const central = [];
  let offset = 0;
  try {
    for (const file of inventory.files) {
      const data = await readFile(file.absolute);
      if (data.length !== file.bytes || sha256(data) !== file.sha256) {
        throw new Error(`Source changed during backup: ${file.path}`);
      }
      if (data.length > 0xffffffff || offset > 0xffffffff) throw new Error('ZIP64 is required but not supported.');
      const name = Buffer.from(file.path, 'utf8');
      const crc = crc32(data);
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(utf8Flag, 6);
      local.writeUInt16LE(0, 8);
      local.writeUInt16LE(0, 10);
      local.writeUInt16LE(fixedDosDate, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(data.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(name.length, 26);
      local.writeUInt16LE(0, 28);
      await writeAll(handle, local, offset);
      await writeAll(handle, name, offset + local.length);
      await writeAll(handle, data, offset + local.length + name.length);

      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50, 0);
      header.writeUInt16LE(20, 4);
      header.writeUInt16LE(20, 6);
      header.writeUInt16LE(utf8Flag, 8);
      header.writeUInt16LE(0, 10);
      header.writeUInt16LE(0, 12);
      header.writeUInt16LE(fixedDosDate, 14);
      header.writeUInt32LE(crc, 16);
      header.writeUInt32LE(data.length, 20);
      header.writeUInt32LE(data.length, 24);
      header.writeUInt16LE(name.length, 28);
      header.writeUInt16LE(0, 30);
      header.writeUInt16LE(0, 32);
      header.writeUInt16LE(0, 34);
      header.writeUInt16LE(0, 36);
      header.writeUInt32LE(0, 38);
      header.writeUInt32LE(offset, 42);
      central.push(Buffer.concat([header, name]));
      offset += local.length + name.length + data.length;
    }

    const centralOffset = offset;
    for (const entry of central) {
      await writeAll(handle, entry, offset);
      offset += entry.length;
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(central.length, 8);
    end.writeUInt16LE(central.length, 10);
    end.writeUInt32LE(offset - centralOffset, 12);
    end.writeUInt32LE(centralOffset, 16);
    end.writeUInt16LE(0, 20);
    await writeAll(handle, end, offset);
    await handle.sync();
  } finally {
    await handle.close();
  }

  const tempHash = await hashFile(temp);
  try {
    await access(target);
    const currentHash = await hashFile(target);
    if (currentHash !== tempHash) throw new Error(`Deterministic backup conflict: ${target}`);
    await unlink(temp);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      await rename(temp, target);
    } else {
      throw error;
    }
  }
  return { sha256: tempHash, bytes: (await stat(target)).size };
};

const verifyZipEnvelope = async (path, expectedEntries) => {
  const info = await stat(path);
  if (info.size < 22) throw new Error('ZIP is too short.');
  const handle = await open(path, 'r');
  const end = Buffer.alloc(22);
  try {
    await handle.read(end, 0, end.length, info.size - end.length);
  } finally {
    await handle.close();
  }
  if (end.readUInt32LE(0) !== 0x06054b50) throw new Error('ZIP end record is missing.');
  if (end.readUInt16LE(10) !== expectedEntries) throw new Error('ZIP entry count mismatch.');
};

const createProtection = async () => {
  await mkdir(receiptRoot, { recursive: true });
  await mkdir(backupRoot, { recursive: true });
  const inventory = await scan();
  const publicFiles = inventory.files.map(({ path, bytes, sha256: digest }) => ({ path, bytes, sha256: digest }));
  const receipt = {
    schemaVersion: 1,
    id: `AYM-AUTHORITATIVE-SOURCE-${inventory.treeSha256}`,
    source: '06_KOD/app',
    exclusions: [...excludedDirectoryNames].sort(),
    excludedDerivedDeliveryFiles: [...excludedRelativePaths].sort(),
    fileCount: inventory.fileCount,
    totalBytes: inventory.totalBytes,
    treeSha256: inventory.treeSha256,
    files: publicFiles,
    localReceiptStatus: 'LOCAL_RECEIPT_VERIFIED',
    externalLibraryReceiptStatus: 'PENDING',
    officialCompletionClaimed: false
  };
  const receiptBytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  const receiptHash = sha256(receiptBytes);
  const receiptName = `SOURCE_${inventory.treeSha256}.json`;
  const receiptPath = resolve(receiptRoot, receiptName);
  await writeImmutable(receiptPath, receiptBytes);
  await writeImmutable(`${receiptPath}.sha256`, Buffer.from(`${receiptHash}  ${receiptName}\n`, 'ascii'));

  const backupName = `AYM_AKTIF_KOD_${inventory.treeSha256.slice(0, 16)}.zip`;
  const backupPath = resolve(backupRoot, backupName);
  const backup = await buildDeterministicZip(inventory, backupPath);
  await verifyZipEnvelope(backupPath, inventory.fileCount);
  await writeImmutable(`${backupPath}.sha256`, Buffer.from(`${backup.sha256}  ${backupName}\n`, 'ascii'));

  const protection = {
    schemaVersion: 1,
    id: `AYM-LOCAL-PROTECTION-${inventory.treeSha256}`,
    source: '06_KOD/app',
    treeSha256: inventory.treeSha256,
    fileCount: inventory.fileCount,
    totalBytes: inventory.totalBytes,
    excludedDerivedDeliveryFiles: [...excludedRelativePaths].sort(),
    receipt: {
      path: `05_TEST/30Z_LOCAL_RECEIPT/${receiptName}`,
      sha256: receiptHash
    },
    backup: {
      path: `10_YEDEK/${backupName}`,
      bytes: backup.bytes,
      sha256: backup.sha256,
      format: 'DETERMINISTIC_ZIP_STORE_FIXED_1980_TIMESTAMP'
    },
    readbackStatus: 'PASS',
    localReceiptStatus: 'LOCAL_RECEIPT_VERIFIED',
    externalLibraryReceiptStatus: 'PENDING',
    officialCompletionClaimed: false
  };
  const protectionName = `PROTECTION_${inventory.treeSha256}.json`;
  const protectionBytes = Buffer.from(`${JSON.stringify(protection, null, 2)}\n`, 'utf8');
  await writeImmutable(resolve(receiptRoot, protectionName), protectionBytes);
  await writeFile(resolve(receiptRoot, 'LATEST.json'), protectionBytes, 'utf8');
  return verifyProtection();
};

const verifyProtection = async () => {
  const latestPath = resolve(receiptRoot, 'LATEST.json');
  const protectionBytes = await readFile(latestPath);
  const protection = JSON.parse(protectionBytes.toString('utf8'));
  const receiptPath = resolve(aymRoot, ...protection.receipt.path.split('/'));
  const backupPath = resolve(aymRoot, ...protection.backup.path.split('/'));
  const receiptBytes = await readFile(receiptPath);
  const receipt = JSON.parse(receiptBytes.toString('utf8'));
  const receiptHash = sha256(receiptBytes);
  if (receiptHash !== protection.receipt.sha256) throw new Error('Receipt SHA-256 mismatch.');
  const expectedDerivedExclusions = JSON.stringify([...excludedRelativePaths].sort());
  if (JSON.stringify(receipt.excludedDerivedDeliveryFiles) !== expectedDerivedExclusions
    || JSON.stringify(protection.excludedDerivedDeliveryFiles) !== expectedDerivedExclusions) {
    throw new Error('Derived delivery report exclusion boundary mismatch.');
  }
  const inventory = await scan();
  if (inventory.treeSha256 !== receipt.treeSha256) throw new Error('Authoritative source tree mismatch.');
  if (inventory.fileCount !== receipt.fileCount || inventory.totalBytes !== receipt.totalBytes) {
    throw new Error('Authoritative source count or byte total mismatch.');
  }
  if (await hashFile(backupPath) !== protection.backup.sha256) throw new Error('Backup SHA-256 mismatch.');
  await verifyZipEnvelope(backupPath, receipt.fileCount);
  const result = {
    status: protection.externalLibraryReceiptStatus === 'PASS' ? 'EXTERNAL_RECEIPT_VERIFIED' : 'LOCAL_RECEIPT_VERIFIED',
    source: protection.source,
    treeSha256: inventory.treeSha256,
    fileCount: inventory.fileCount,
    backup: protection.backup.path,
    externalLibraryReceiptStatus: protection.externalLibraryReceiptStatus,
    officialCompletionClaimed: protection.officialCompletionClaimed,
    ...(protection.externalReceipt ? { externalReceipt: protection.externalReceipt } : {})
  };
  console.log(JSON.stringify(result));
  return result;
};

if (basename(sourceRoot) !== 'app' || basename(dirname(sourceRoot)) !== '06_KOD') {
  throw new Error(`Run from AYM/06_KOD/app; received ${sourceRoot}`);
}
if (!sourceRoot.startsWith(`${aymRoot}${sep}`)) throw new Error('Source is outside AYM root.');

if (mode === 'create') {
  await createProtection();
} else if (mode === 'verify') {
  await verifyProtection();
} else {
  throw new Error(`Unknown mode: ${mode}. Use create or verify.`);
}
