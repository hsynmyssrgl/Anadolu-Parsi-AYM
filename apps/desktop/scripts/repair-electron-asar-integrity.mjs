import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, win32 } from 'node:path';
import { NtExecutable, NtExecutableResource, Resource } from '../../../tools/windows-packager/node_modules/resedit/dist/index.mjs';
import asarReader from '../../../tools/windows-packager/node_modules/app-builder-lib/out/asar/asar.js';

const { readAsar, readAsarHeader } = asarReader;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const computeFileIntegrity = (value, blockSize) => {
  const blocks = [];
  for (let offset = 0; offset < value.length; offset += blockSize) {
    blocks.push(sha256(value.subarray(offset, Math.min(offset + blockSize, value.length))));
  }
  if (blocks.length === 0) blocks.push(sha256(value));
  return Object.freeze({ algorithm: 'SHA256', hash: sha256(value), blockSize, blocks });
};

const collectIntegrityEntries = (node, segments = [], entries = []) => {
  for (const [name, child] of Object.entries(node.files ?? {})) {
    const childSegments = [...segments, name];
    if (child.files) collectIntegrityEntries(child, childSegments, entries);
    else if (child.integrity) entries.push({ path: join(...childSegments), node: child });
  }
  return entries;
};

const exactIntegrity = (left, right) => left.algorithm === right.algorithm
  && left.hash === right.hash
  && left.blockSize === right.blockSize
  && JSON.stringify(left.blocks) === JSON.stringify(right.blocks);

const reconcileArchiveEntries = async (archivePath) => {
  const [{ header, size }, filesystem, archiveBytes] = await Promise.all([
    readAsarHeader(archivePath),
    readAsar(archivePath),
    readFile(archivePath)
  ]);
  const originalHeader = header.toString();
  const parsedHeader = JSON.parse(originalHeader);
  const entries = collectIntegrityEntries(parsedHeader);
  let repairedEntries = 0;
  for (const entry of entries) {
    if (entry.node.integrity.algorithm !== 'SHA256'
      || !Number.isSafeInteger(entry.node.integrity.blockSize)
      || entry.node.integrity.blockSize <= 0) {
      throw new Error(`Unsupported ASAR integrity metadata: ${entry.path}`);
    }
    const content = await filesystem.readFile(entry.path);
    const actual = computeFileIntegrity(content, entry.node.integrity.blockSize);
    if (!exactIntegrity(entry.node.integrity, actual)) {
      entry.node.integrity = actual;
      repairedEntries += 1;
    }
  }
  const reconciledHeader = JSON.stringify(parsedHeader);
  const originalHeaderBytes = Buffer.from(originalHeader, 'utf8');
  const reconciledHeaderBytes = Buffer.from(reconciledHeader, 'utf8');
  if (originalHeaderBytes.length !== reconciledHeaderBytes.length) {
    throw new Error('ASAR integrity repair would change the fixed header size.');
  }
  if (repairedEntries > 0) {
    const headerRegionEnd = 8 + size;
    const headerOffset = archiveBytes.subarray(0, headerRegionEnd).indexOf(originalHeaderBytes);
    if (headerOffset < 0 || archiveBytes.indexOf(originalHeaderBytes, headerOffset + 1) >= 0) {
      throw new Error('ASAR header location is missing or ambiguous.');
    }
    reconciledHeaderBytes.copy(archiveBytes, headerOffset);
    await writeFile(archivePath, archiveBytes);
  }
  return Object.freeze({ checkedEntries: entries.length, repairedEntries });
};

const writeExecutableIntegrityResource = async (executablePath, archiveRelativePath, archiveHeaderSha256) => {
  const executable = NtExecutable.from(await readFile(executablePath));
  const resources = NtExecutableResource.from(executable);
  const versionInfo = Resource.VersionInfo.fromEntries(resources.entries);
  const languages = versionInfo.flatMap((entry) => entry.getAllLanguagesForStringValues());
  if (languages.length !== 1) throw new Error('Electron executable language metadata is not exact.');
  for (let index = resources.entries.length - 1; index >= 0; index -= 1) {
    const entry = resources.entries[index];
    if (entry.type === 'INTEGRITY' && entry.id === 'ELECTRONASAR') resources.entries.splice(index, 1);
  }
  const integrityPayload = [{ file: win32.normalize(archiveRelativePath), alg: 'SHA256', value: archiveHeaderSha256 }];
  resources.entries.push({
    type: 'INTEGRITY',
    id: 'ELECTRONASAR',
    bin: Buffer.from(JSON.stringify(integrityPayload)),
    lang: languages[0].lang,
    codepage: languages[0].codepage
  });
  resources.outputResource(executable);
  await writeFile(executablePath, Buffer.from(executable.generate()));
};

const readExecutableIntegrityResource = async (executablePath) => {
  const executable = NtExecutable.from(await readFile(executablePath));
  const resources = NtExecutableResource.from(executable);
  const entries = resources.entries.filter((entry) => entry.type === 'INTEGRITY' && entry.id === 'ELECTRONASAR');
  if (entries.length !== 1) throw new Error(`Electron ASAR integrity resource count is ${entries.length}, expected 1.`);
  return JSON.parse(Buffer.from(entries[0].bin).toString('utf8'));
};

export const repairAndVerifyPackagedAsarIntegrity = async ({ appOutDir, executableName }) => {
  const archivePath = join(appOutDir, 'resources', 'app.asar');
  const executablePath = join(appOutDir, executableName);
  const repair = await reconcileArchiveEntries(archivePath);
  const { header } = await readAsarHeader(archivePath);
  const archiveHeaderSha256 = sha256(header);
  await writeExecutableIntegrityResource(executablePath, 'resources/app.asar', archiveHeaderSha256);
  const embedded = await readExecutableIntegrityResource(executablePath);
  if (embedded.length !== 1
    || embedded[0].file !== 'resources\\app.asar'
    || embedded[0].alg !== 'SHA256'
    || embedded[0].value !== archiveHeaderSha256) {
    throw new Error('Electron executable ASAR integrity readback failed.');
  }
  const verification = await reconcileArchiveEntries(archivePath);
  if (verification.repairedEntries !== 0 || verification.checkedEntries !== repair.checkedEntries) {
    throw new Error('ASAR entry integrity readback failed.');
  }
  return Object.freeze({ archivePath, executablePath, archiveHeaderSha256, ...repair });
};
