import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import { WINDOWS_DPAPI_PROTECTION_ID, type DeviceSecretProtector } from './device-secret-protector.js';
import type { ProtectedSideArtifactStore } from './protected-side-artifact-store.js';
import { VolatileSqliteSession } from './volatile-sqlite-session.js';

export interface WindowsSecurityEvidenceProbeReport {
  readonly schemaVersion: 1;
  readonly build: number;
  readonly status: 'PASS';
  readonly platform: 'win32';
  readonly applicationVersion: string;
  readonly efs: {
    readonly status: 'PASS';
    readonly protectionStatus: 'windows-efs';
    readonly directoryEncryptedAttribute: 'PASS';
    readonly snapshotEncryptedAttribute: 'PASS';
    readonly snapshotSqliteRoundTrip: 'PASS';
    readonly stagingCleanup: 'PASS';
  };
  readonly protectedSideArtifacts: {
    readonly status: 'PASS';
    readonly protectionId: string;
    readonly expectedProtectionId: 'windows-dpapi-current-user-v1';
    readonly selectedStorageBackend: string;
    readonly keyEnvelopeDeviceWrapped: 'PASS';
    readonly ciphertextHidesProbePlaintext: 'PASS';
    readonly decryptRoundTrip: 'PASS';
  };
  readonly probeMarkerSha256: string;
  readonly generatedAt: string;
}

const assertWindowsEncryptedAttribute = (path: string, label: string): void => {
  const script = [
    '$item = Get-Item -LiteralPath $args[0] -Force;',
    'if (($item.Attributes -band [IO.FileAttributes]::Encrypted) -eq 0) {',
    `  Write-Error '${label} is not EFS encrypted.';`,
    '  exit 7;',
    '}',
    'exit 0;'
  ].join(' ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script, path], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15_000
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${label} EFS attribute verification failed: ${result.error?.message ?? result.stderr ?? `exit=${String(result.status)}`}`);
  }
};

const listFilesRecursive = (root: string): string[] => {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursive(path));
    else files.push(path);
  }
  return files;
};

export const runWindowsSecurityEvidenceProbe = (input: {
  readonly applicationVersion: string;
  readonly userDataPath: string;
  readonly volatileRuntimeRoot: string;
  readonly protector: DeviceSecretProtector;
  readonly protectedArtifacts: ProtectedSideArtifactStore;
  readonly selectedStorageBackend: string;
}): WindowsSecurityEvidenceProbeReport => {
  if (process.platform !== 'win32') {
    throw new Error('Windows security evidence probe can run only on Windows.');
  }
  if (input.protector.protectionId !== WINDOWS_DPAPI_PROTECTION_ID || !input.protector.isAvailable()) {
    throw new Error(`Windows CurrentUser DPAPI protector is unavailable or unexpected: ${input.protector.protectionId}`);
  }

  const build = Number(input.applicationVersion.split('.').at(-1));
  if (!Number.isInteger(build) || build < 1) {
    throw new Error(`Windows security evidence probe received invalid application version: ${input.applicationVersion}`);
  }
  const marker = `PPT-WINDOWS-SECURITY-PROBE-${process.pid}-${Date.now()}`;
  const probeMarkerSha256 = createHash('sha256').update(marker, 'utf8').digest('hex');

  const keyPath = join(input.userDataPath, 'secrets', 'side-artifact-key.json');
  if (!existsSync(keyPath)) throw new Error('Protected side-artifact key envelope was not created.');
  const keyEnvelopeText = readFileSync(keyPath, 'utf8');
  const keyEnvelope = JSON.parse(keyEnvelopeText) as {
    readonly protectionId?: unknown;
    readonly protectedDataKey?: unknown;
    readonly dataKey?: unknown;
  };
  if (
    keyEnvelope.protectionId !== WINDOWS_DPAPI_PROTECTION_ID ||
    typeof keyEnvelope.protectedDataKey !== 'string' ||
    keyEnvelope.protectedDataKey.length === 0 ||
    keyEnvelope.dataKey !== undefined
  ) {
    throw new Error('Protected side-artifact key envelope does not prove Windows-DPAPI-wrapped key storage.');
  }

  const protectedProbePath = join(input.userDataPath, 'validation', 'windows-security-probe.pptdiag');
  try {
    input.protectedArtifacts.writeText(protectedProbePath, 'windows-security-evidence-probe', marker);
    const rawProtectedProbe = readFileSync(protectedProbePath, 'utf8');
    if (rawProtectedProbe.includes(marker)) {
      throw new Error('Protected side-artifact ciphertext contains the plaintext probe marker.');
    }
    if (input.protectedArtifacts.readText(protectedProbePath) !== marker) {
      throw new Error('Protected side-artifact Windows-DPAPI/AES round-trip failed.');
    }
  } finally {
    rmSync(protectedProbePath, { force: true });
  }

  const stagingRoot = join(input.volatileRuntimeRoot, 'windows-efs-probe');
  const session = new VolatileSqliteSession({ stagingRoot, requireWindowsEfs: true });
  try {
    if (
      session.protectionStatus.stagingProtection !== 'windows-efs' ||
      session.protectionStatus.windowsEfsRequired !== true ||
      session.protectionStatus.windowsEfsVerified !== true ||
      session.protectionStatus.activeDatabase !== 'memory-only'
    ) {
      throw new Error(`Volatile SQLite Windows EFS protection status failed: ${JSON.stringify(session.protectionStatus)}`);
    }
    session.database.exec('CREATE TABLE probe(value TEXT NOT NULL);');
    session.database.prepare('INSERT INTO probe(value) VALUES(?)').run(marker);
    const roundTrip = session.database.prepare('SELECT value FROM probe LIMIT 1').get() as { readonly value?: unknown } | undefined;
    if (roundTrip?.value !== marker) throw new Error('Memory-only SQLite probe row round-trip failed.');

    session.withSnapshot((snapshotPath) => {
      assertWindowsEncryptedAttribute(dirname(snapshotPath), 'EFS staging directory');
      assertWindowsEncryptedAttribute(snapshotPath, 'EFS SQLite snapshot');
      const bytes = readFileSync(snapshotPath);
      if (!bytes.subarray(0, 16).toString('utf8').startsWith('SQLite format 3')) {
        throw new Error('EFS snapshot is not a valid SQLite image for the authenticated Windows process.');
      }
    });
  } finally {
    session.close();
  }
  const remainingStagingFiles = listFilesRecursive(stagingRoot).filter((path) => /\.sqlite$|\.db$/i.test(path));
  if (remainingStagingFiles.length > 0) {
    throw new Error(`Windows EFS probe left plaintext-addressable SQLite staging files: ${remainingStagingFiles.length}`);
  }
  rmSync(stagingRoot, { recursive: true, force: true });

  return {
    schemaVersion: 1,
    build,
    status: 'PASS',
    platform: 'win32',
    applicationVersion: input.applicationVersion,
    efs: {
      status: 'PASS',
      protectionStatus: 'windows-efs',
      directoryEncryptedAttribute: 'PASS',
      snapshotEncryptedAttribute: 'PASS',
      snapshotSqliteRoundTrip: 'PASS',
      stagingCleanup: 'PASS'
    },
    protectedSideArtifacts: {
      status: 'PASS',
      protectionId: input.protector.protectionId,
      expectedProtectionId: WINDOWS_DPAPI_PROTECTION_ID,
      selectedStorageBackend: input.selectedStorageBackend,
      keyEnvelopeDeviceWrapped: 'PASS',
      ciphertextHidesProbePlaintext: 'PASS',
      decryptRoundTrip: 'PASS'
    },
    probeMarkerSha256,
    generatedAt: new Date().toISOString()
  };
};
