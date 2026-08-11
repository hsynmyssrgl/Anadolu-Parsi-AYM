import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { VolatileSqliteSession } from './volatile-sqlite-session.js';
import { assertWindowsEfsEncrypted, assertWindowsEfsTreeEncrypted } from './windows-efs-protection.js';

export interface WindowsOpen021EfsEvidenceProbeReport {
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
    readonly activeDatabase: 'memory-only';
  };
  readonly probeMarkerSha256: string;
  readonly generatedAt: string;
}

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

export const runWindowsOpen021EfsEvidenceProbe = (input: {
  readonly applicationVersion: string;
  readonly volatileRuntimeRoot: string;
}): WindowsOpen021EfsEvidenceProbeReport => {
  if (process.platform !== 'win32') {
    throw new Error('OPEN-021 Windows EFS evidence probe can run only on Windows.');
  }

  const build = Number(input.applicationVersion.split('.').at(-1));
  if (!Number.isInteger(build) || build < 1) {
    throw new Error(`OPEN-021 probe received invalid application version: ${input.applicationVersion}`);
  }

  const marker = `PPT-OPEN021-EFS-PROBE-${process.pid}-${Date.now()}`;
  const probeMarkerSha256 = createHash('sha256').update(marker, 'utf8').digest('hex');
  const stagingRoot = join(input.volatileRuntimeRoot, 'open021-windows-efs-probe');
  const session = new VolatileSqliteSession({ stagingRoot, requireWindowsEfs: true });

  try {
    if (
      session.protectionStatus.stagingProtection !== 'windows-efs' ||
      session.protectionStatus.windowsEfsRequired !== true ||
      session.protectionStatus.windowsEfsVerified !== true ||
      session.protectionStatus.activeDatabase !== 'memory-only'
    ) {
      throw new Error(`OPEN-021 Windows EFS protection status failed: ${JSON.stringify(session.protectionStatus)}`);
    }

    session.database.exec('CREATE TABLE open021_probe(value TEXT NOT NULL);');
    session.database.prepare('INSERT INTO open021_probe(value) VALUES(?)').run(marker);
    const row = session.database.prepare('SELECT value FROM open021_probe LIMIT 1').get() as
      | { readonly value?: unknown }
      | undefined;
    if (row?.value !== marker) throw new Error('OPEN-021 memory-only SQLite round-trip failed.');

    session.withSnapshot((snapshotPath) => {
      assertWindowsEfsEncrypted(dirname(snapshotPath), 'OPEN-021 EFS staging directory');
      assertWindowsEfsEncrypted(snapshotPath, 'OPEN-021 EFS SQLite snapshot');
      assertWindowsEfsTreeEncrypted(dirname(snapshotPath), 'OPEN-021 EFS staging tree');
      const bytes = readFileSync(snapshotPath);
      if (!bytes.subarray(0, 16).toString('utf8').startsWith('SQLite format 3')) {
        throw new Error('OPEN-021 EFS snapshot is not a valid SQLite image for the authenticated Windows process.');
      }
    });
  } finally {
    session.close();
  }

  const remainingStagingFiles = listFilesRecursive(stagingRoot).filter((path) => /(?:\.sqlite|\.db|\.sqlite-(?:journal|wal|shm)|\.db-(?:journal|wal|shm)|\.tmp)$/i.test(path));
  if (remainingStagingFiles.length > 0) {
    throw new Error(`OPEN-021 EFS probe left SQLite staging files: ${remainingStagingFiles.length}`);
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
      stagingCleanup: 'PASS',
      activeDatabase: 'memory-only'
    },
    probeMarkerSha256,
    generatedAt: new Date().toISOString()
  };
};
