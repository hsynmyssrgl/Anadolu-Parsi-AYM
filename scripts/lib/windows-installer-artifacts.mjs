import { lstat, readdir, rm, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const INSTALLER_ARTIFACT_PATTERN = /^ParsYuva-.*\.exe(?:\.blockmap|\.sha256)?$/u;
const GENERATED_NSIS_PAYLOAD_PATTERN =
  /^@pptdesktop-\d+\.\d+\.\d+-\d+-(?:x64|arm64|ia32)\.nsis\.7z$/u;
const VERSIONED_INSTALLER_ARTIFACT_PATTERN =
  /^ParsYuva-(Bronze|Silver|Gold)-(\d{2}\.\d{2}\.\d{4}\.\d+)\.exe(?:(\.blockmap|\.sha256))?$/u;
const GENERATED_WINDOWS_PACKAGE_ENTRY_NAMES = new Set([
  'builder-debug.yml',
  'builder-effective-config.yaml',
  'latest.yml',
  'win-unpacked',
]);

const readDirectory = async (directory) => {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
};

const inspectInstallerArtifactEntry = async (entry, resolvedRoot) => {
  const path = resolve(resolvedRoot, entry.name);
  if (resolve(path) !== path || resolve(path, '..') !== resolvedRoot) {
    throw new Error(`Unsafe installer artifact path: ${path}`);
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    throw new Error(`Installer artifact must be a regular file: ${path}`);
  }
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`Installer artifact must be a regular file: ${path}`);
  }
  return { path, info };
};

export const parseWindowsInstallerArtifact = (name) => {
  const match = VERSIONED_INSTALLER_ARTIFACT_PATTERN.exec(name);
  if (!match) return null;
  return {
    name,
    channel: match[1],
    version: match[2],
    kind: match[3] ?? '.exe',
  };
};

export async function listWindowsInstallerArtifacts(releaseRoot) {
  const resolvedRoot = resolve(releaseRoot);
  const entries = await readDirectory(resolvedRoot);
  const artifacts = [];
  for (const entry of entries) {
    if (!INSTALLER_ARTIFACT_PATTERN.test(entry.name)) continue;
    const { path, info } = await inspectInstallerArtifactEntry(entry, resolvedRoot);
    artifacts.push({
      name: basename(path),
      path,
      bytes: info.size,
      parsed: parseWindowsInstallerArtifact(entry.name),
    });
  }
  return artifacts.sort((left, right) => left.name.localeCompare(right.name, 'en'));
}

export function evaluateWindowsInstallerRetention({ artifacts, channel, version }) {
  const expectedPrefix = `ParsYuva-${channel}-${version}.exe`;
  const failures = [];
  const kinds = new Set();
  let validInstallerExecutableFound = false;
  for (const artifact of artifacts) {
    if (!artifact.parsed) {
      failures.push(`Tanınmayan kurulum artefaktı: ${artifact.name}`);
      continue;
    }
    if (artifact.parsed.channel !== channel || artifact.parsed.version !== version) {
      failures.push(`Eski kurulum artefaktı: ${artifact.name}; beklenen ${expectedPrefix}`);
    }
    if (artifact.name === expectedPrefix && artifact.parsed.kind === '.exe') {
      validInstallerExecutableFound = true;
    }
    if (kinds.has(artifact.parsed.kind)) {
      failures.push(`Aynı türden birden fazla kurulum artefaktı: ${artifact.parsed.kind}`);
    }
    kinds.add(artifact.parsed.kind);
  }
  if (artifacts.length > 0 && !validInstallerExecutableFound) {
    failures.push(`Geçerli kurulum EXE'si eksik: ${expectedPrefix}`);
  }
  return {
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    expectedPrefix,
    artifactCount: artifacts.length,
    failures,
  };
}

export async function removeWindowsInstallerArtifacts(releaseRoot) {
  const artifacts = await listWindowsInstallerArtifacts(releaseRoot);
  for (const artifact of artifacts) await rm(artifact.path, { force: true });
  const remaining = await listWindowsInstallerArtifacts(releaseRoot);
  if (remaining.length > 0) {
    throw new Error(`Kurulum artefaktı temizliği tamamlanamadı: ${remaining.map((item) => item.name).join(', ')}`);
  }
  return {
    removed: artifacts.map(({ name, bytes }) => ({ name, bytes })),
    removedCount: artifacts.length,
    removedBytes: artifacts.reduce((total, artifact) => total + artifact.bytes, 0),
  };
}

export async function removeWindowsPackagingArtifacts(releaseRoot) {
  const resolvedRoot = resolve(releaseRoot);
  const entries = await readDirectory(resolvedRoot);
  for (const entry of entries) {
    if (INSTALLER_ARTIFACT_PATTERN.test(entry.name)) {
      await inspectInstallerArtifactEntry(entry, resolvedRoot);
    }
  }
  const removed = [];
  for (const entry of entries) {
    if (!INSTALLER_ARTIFACT_PATTERN.test(entry.name)
      && !GENERATED_NSIS_PAYLOAD_PATTERN.test(entry.name)
      && !GENERATED_WINDOWS_PACKAGE_ENTRY_NAMES.has(entry.name)) {
      continue;
    }
    const path = resolve(resolvedRoot, entry.name);
    if (resolve(path) !== path || resolve(path, '..') !== resolvedRoot) {
      throw new Error(`Unsafe Windows packaging artifact path: ${path}`);
    }
    const info = await stat(path);
    await rm(path, { recursive: entry.isDirectory(), force: true });
    removed.push({ name: basename(path), bytes: info.size });
  }
  const remainingEntries = await readDirectory(resolvedRoot);
  const remaining = remainingEntries.filter(
    (entry) => INSTALLER_ARTIFACT_PATTERN.test(entry.name)
      || GENERATED_NSIS_PAYLOAD_PATTERN.test(entry.name)
      || GENERATED_WINDOWS_PACKAGE_ENTRY_NAMES.has(entry.name),
  );
  if (remaining.length > 0) {
    throw new Error(`Windows paketleme artefaktı temizliği tamamlanamadı: ${remaining.map((item) => item.name).join(', ')}`);
  }
  return {
    removed,
    removedCount: removed.length,
    removedBytes: removed.reduce((total, artifact) => total + artifact.bytes, 0),
  };
}
