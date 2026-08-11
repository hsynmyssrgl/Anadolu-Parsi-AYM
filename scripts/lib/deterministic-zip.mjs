import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { normalizeSourcePath } from './source-manifest.mjs';

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_VERSION_NEEDED = 20;
const ZIP_VERSION_MADE_BY_UNIX = (3 << 8) | ZIP_VERSION_NEEDED;
const UTF8_FLAG = 0x0800;
const STORE_METHOD = 0;
const FIXED_DOS_TIME = 0;
const FIXED_DOS_DATE = 0x0021; // 1980-01-01
const FIXED_UNIX_MODE = 0o100644;
const MAX_UINT16 = 0xffff;
const MAX_UINT32 = 0xffffffff;

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

export const crc32 = (buffer) => {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};

export const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

const assertZip32Value = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_UINT32) throw new Error(`${label} exceeds ZIP32 limits: ${value}`);
};

const localHeader = ({ nameBytes, crc, size }) => {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0);
  header.writeUInt16LE(ZIP_VERSION_NEEDED, 4);
  header.writeUInt16LE(UTF8_FLAG, 6);
  header.writeUInt16LE(STORE_METHOD, 8);
  header.writeUInt16LE(FIXED_DOS_TIME, 10);
  header.writeUInt16LE(FIXED_DOS_DATE, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(size, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(nameBytes.length, 26);
  header.writeUInt16LE(0, 28);
  return header;
};

const centralHeader = ({ nameBytes, crc, size, localOffset }) => {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(CENTRAL_DIRECTORY_SIGNATURE, 0);
  header.writeUInt16LE(ZIP_VERSION_MADE_BY_UNIX, 4);
  header.writeUInt16LE(ZIP_VERSION_NEEDED, 6);
  header.writeUInt16LE(UTF8_FLAG, 8);
  header.writeUInt16LE(STORE_METHOD, 10);
  header.writeUInt16LE(FIXED_DOS_TIME, 12);
  header.writeUInt16LE(FIXED_DOS_DATE, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(size, 20);
  header.writeUInt32LE(size, 24);
  header.writeUInt16LE(nameBytes.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE((FIXED_UNIX_MODE << 16) >>> 0, 38);
  header.writeUInt32LE(localOffset, 42);
  return header;
};

const endOfCentralDirectory = ({ entryCount, centralSize, centralOffset }) => {
  const record = Buffer.alloc(22);
  record.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0);
  record.writeUInt16LE(0, 4);
  record.writeUInt16LE(0, 6);
  record.writeUInt16LE(entryCount, 8);
  record.writeUInt16LE(entryCount, 10);
  record.writeUInt32LE(centralSize, 12);
  record.writeUInt32LE(centralOffset, 16);
  record.writeUInt16LE(0, 20);
  return record;
};

export const buildDeterministicZip = async (root, paths) => {
  const normalizedPaths = paths.map(normalizeSourcePath);
  const sortedPaths = [...normalizedPaths].sort((left, right) => left.localeCompare(right, 'en'));
  if (sortedPaths.length !== new Set(sortedPaths).size) throw new Error('Archive paths must be unique.');
  if (sortedPaths.some((path, index) => path !== normalizedPaths[index])) throw new Error('Archive paths must be strictly sorted.');
  if (sortedPaths.length > MAX_UINT16) throw new Error(`Archive has too many entries for ZIP32: ${sortedPaths.length}`);

  const absoluteRoot = resolve(root);
  const localParts = [];
  const centralParts = [];
  const entries = [];
  let localOffset = 0;

  for (const path of sortedPaths) {
    const content = await readFile(resolve(absoluteRoot, path));
    const nameBytes = Buffer.from(path, 'utf8');
    if (nameBytes.length === 0 || nameBytes.length > MAX_UINT16) throw new Error(`Archive path length is invalid: ${path}`);
    assertZip32Value(content.length, `Archive file size for ${path}`);
    assertZip32Value(localOffset, `Archive local offset for ${path}`);
    const crc = crc32(content);
    const local = localHeader({ nameBytes, crc, size: content.length });
    localParts.push(local, nameBytes, content);
    centralParts.push(centralHeader({ nameBytes, crc, size: content.length, localOffset }), nameBytes);
    entries.push({ path, bytes: content.length, crc32: crc.toString(16).padStart(8, '0'), sha256: sha256(content), localOffset });
    localOffset += local.length + nameBytes.length + content.length;
    assertZip32Value(localOffset, 'Archive local data size');
  }

  const centralDirectory = Buffer.concat(centralParts);
  assertZip32Value(centralDirectory.length, 'Archive central directory size');
  const eocd = endOfCentralDirectory({ entryCount: entries.length, centralSize: centralDirectory.length, centralOffset: localOffset });
  const archive = Buffer.concat([...localParts, centralDirectory, eocd]);
  assertZip32Value(archive.length, 'Archive total size');
  return { archive, entries, centralOffset: localOffset, centralSize: centralDirectory.length };
};

export const writeDeterministicZip = async ({ root = '.', paths, outputPath }) => {
  const { archive, entries, centralOffset, centralSize } = await buildDeterministicZip(root, paths);
  const absoluteOutput = resolve(outputPath);
  await mkdir(dirname(absoluteOutput), { recursive: true });
  await writeFile(absoluteOutput, archive);
  return {
    schemaVersion: 1,
    format: 'ZIP32',
    compression: 'STORE',
    utf8Names: true,
    fixedTimestamp: '1980-01-01T00:00:00Z',
    fixedUnixMode: '100644',
    entryCount: entries.length,
    archiveBytes: archive.length,
    archiveSha256: sha256(archive),
    centralOffset,
    centralSize,
    entries
  };
};

const locateEocd = (archive) => {
  const minimum = Math.max(0, archive.length - 22 - MAX_UINT16);
  for (let offset = archive.length - 22; offset >= minimum; offset -= 1) {
    if (archive.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) return offset;
  }
  throw new Error('ZIP end-of-central-directory record was not found.');
};

const inspectDeterministicZipInternal = (archive) => {
  const failures = [];
  const eocdOffset = locateEocd(archive);
  const diskNumber = archive.readUInt16LE(eocdOffset + 4);
  const centralDisk = archive.readUInt16LE(eocdOffset + 6);
  const entryCountDisk = archive.readUInt16LE(eocdOffset + 8);
  const entryCount = archive.readUInt16LE(eocdOffset + 10);
  const centralSize = archive.readUInt32LE(eocdOffset + 12);
  const centralOffset = archive.readUInt32LE(eocdOffset + 16);
  const commentLength = archive.readUInt16LE(eocdOffset + 20);
  if (diskNumber !== 0 || centralDisk !== 0) failures.push('Archive must use a single disk.');
  if (entryCountDisk !== entryCount) failures.push('Central directory entry counts do not match.');
  if (commentLength !== 0) failures.push('Archive comment must be empty.');
  if (eocdOffset + 22 + commentLength !== archive.length) failures.push('Unexpected bytes follow the end-of-central-directory record.');
  if (centralOffset + centralSize !== eocdOffset) failures.push('Central directory boundaries are inconsistent.');

  const entries = [];
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > archive.length || archive.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_SIGNATURE) {
      failures.push(`Central directory entry ${index} is invalid.`);
      break;
    }
    const madeBy = archive.readUInt16LE(cursor + 4);
    const needed = archive.readUInt16LE(cursor + 6);
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const dosTime = archive.readUInt16LE(cursor + 12);
    const dosDate = archive.readUInt16LE(cursor + 14);
    const crc = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLengthEntry = archive.readUInt16LE(cursor + 32);
    const diskStart = archive.readUInt16LE(cursor + 34);
    const internalAttributes = archive.readUInt16LE(cursor + 36);
    const externalAttributes = archive.readUInt32LE(cursor + 38);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    const name = archive.subarray(nameStart, nameEnd).toString('utf8');
    try { normalizeSourcePath(name); } catch (error) { failures.push(`Entry ${index} path is unsafe: ${error.message}`); }
    if (madeBy !== ZIP_VERSION_MADE_BY_UNIX) failures.push(`Entry ${name} has non-canonical made-by version ${madeBy}.`);
    if (needed !== ZIP_VERSION_NEEDED) failures.push(`Entry ${name} has non-canonical required version ${needed}.`);
    if (flags !== UTF8_FLAG) failures.push(`Entry ${name} has non-canonical flags ${flags}.`);
    if (method !== STORE_METHOD) failures.push(`Entry ${name} is not stored without compression.`);
    if (dosTime !== FIXED_DOS_TIME || dosDate !== FIXED_DOS_DATE) failures.push(`Entry ${name} timestamp is not canonical.`);
    if (compressedSize !== uncompressedSize) failures.push(`Entry ${name} stored sizes do not match.`);
    if (extraLength !== 0 || commentLengthEntry !== 0) failures.push(`Entry ${name} contains non-canonical extra data or comment.`);
    if (diskStart !== 0 || internalAttributes !== 0) failures.push(`Entry ${name} contains non-canonical disk/internal attributes.`);
    if (externalAttributes !== ((FIXED_UNIX_MODE << 16) >>> 0)) failures.push(`Entry ${name} has non-canonical file mode.`);

    if (localOffset + 30 > archive.length || archive.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
      failures.push(`Entry ${name} local header is invalid.`);
    } else {
      const localNeeded = archive.readUInt16LE(localOffset + 4);
      const localFlags = archive.readUInt16LE(localOffset + 6);
      const localMethod = archive.readUInt16LE(localOffset + 8);
      const localTime = archive.readUInt16LE(localOffset + 10);
      const localDate = archive.readUInt16LE(localOffset + 12);
      const localCrc = archive.readUInt32LE(localOffset + 14);
      const localCompressed = archive.readUInt32LE(localOffset + 18);
      const localUncompressed = archive.readUInt32LE(localOffset + 22);
      const localNameLength = archive.readUInt16LE(localOffset + 26);
      const localExtraLength = archive.readUInt16LE(localOffset + 28);
      const localNameStart = localOffset + 30;
      const localNameEnd = localNameStart + localNameLength;
      const localName = archive.subarray(localNameStart, localNameEnd).toString('utf8');
      const dataStart = localNameEnd + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      const content = archive.subarray(dataStart, dataEnd);
      if (localNeeded !== needed || localFlags !== flags || localMethod !== method || localTime !== dosTime || localDate !== dosDate) failures.push(`Entry ${name} local/central metadata mismatch.`);
      if (localCrc !== crc || localCompressed !== compressedSize || localUncompressed !== uncompressedSize) failures.push(`Entry ${name} local/central size or CRC mismatch.`);
      if (localExtraLength !== 0 || localName !== name) failures.push(`Entry ${name} local name or extra data is non-canonical.`);
      if (dataEnd > centralOffset) failures.push(`Entry ${name} data overlaps the central directory.`);
      if (crc32(content) !== crc) failures.push(`Entry ${name} CRC-32 verification failed.`);
      entries.push({ path: name, bytes: content.length, crc32: crc.toString(16).padStart(8, '0'), sha256: sha256(content), localOffset });
    }
    cursor = nameEnd + extraLength + commentLengthEntry;
  }
  if (cursor !== centralOffset + centralSize) failures.push('Central directory parsed size does not match its declared size.');
  const names = entries.map((entry) => entry.path);
  if (names.length !== new Set(names).size) failures.push('Archive contains duplicate paths.');
  const sortedNames = [...names].sort((left, right) => left.localeCompare(right, 'en'));
  if (sortedNames.some((name, index) => name !== names[index])) failures.push('Archive paths are not strictly sorted.');

  return {
    schemaVersion: 1,
    format: 'ZIP32',
    compression: 'STORE',
    entryCount,
    archiveBytes: archive.length,
    archiveSha256: sha256(archive),
    centralOffset,
    centralSize,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    failures,
    entries
  };
};

export const inspectDeterministicZip = (archive) => {
  try {
    if (!Buffer.isBuffer(archive)) throw new Error('Archive input must be a Buffer.');
    if (archive.length < 22) throw new Error(`Archive is too short to be a ZIP file: ${archive.length} bytes.`);
    return inspectDeterministicZipInternal(archive);
  } catch (error) {
    return {
      schemaVersion: 1,
      format: 'ZIP32',
      compression: 'STORE',
      entryCount: 0,
      archiveBytes: Buffer.isBuffer(archive) ? archive.length : 0,
      archiveSha256: Buffer.isBuffer(archive) ? sha256(archive) : null,
      centralOffset: null,
      centralSize: null,
      status: 'FAIL',
      failures: [error instanceof Error ? error.message : String(error)],
      entries: []
    };
  }
};

export const readStoredZipEntry = (archive, requestedPath) => {
  const normalized = normalizeSourcePath(requestedPath);
  const inspection = inspectDeterministicZip(archive);
  if (inspection.status !== 'PASS') throw new Error(`Archive is not a valid deterministic ZIP: ${inspection.failures.join('; ')}`);
  const entry = inspection.entries.find((candidate) => candidate.path === normalized);
  if (!entry) throw new Error(`Archive entry is missing: ${normalized}`);
  const localOffset = entry.localOffset;
  const nameLength = archive.readUInt16LE(localOffset + 26);
  const extraLength = archive.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLength + extraLength;
  return Buffer.from(archive.subarray(dataStart, dataStart + entry.bytes));
};

export const verifyDeterministicZipFile = async (archivePath) => inspectDeterministicZip(await readFile(resolve(archivePath)));
