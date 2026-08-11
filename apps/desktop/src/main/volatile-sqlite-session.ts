import { randomUUID } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
  fsyncSync
} from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { DatabaseConnection } from '@ppt/contracts';
import {
  assertWindowsEfsEncrypted,
  assertWindowsEfsTreeEncrypted,
  protectWindowsPathWithEfs
} from './windows-efs-protection.js';

export interface VolatileSqliteSessionOptions {
  readonly stagingRoot: string;
  readonly initialDatabaseBytes?: Buffer;
  readonly requireWindowsEfs?: boolean;
}

export interface VolatileSqliteProtectionStatus {
  readonly activeDatabase: 'memory-only';
  readonly stagingProtection: 'windows-efs' | 'posix-private-directory';
  readonly windowsEfsRequired: boolean;
  readonly windowsEfsVerified: boolean;
}

const quoteSqlLiteral = (value: string): string => `'${value.replaceAll("'", "''")}'`;
const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

const bestEffortOverwrite = (path: string): void => {
  try {
    const size = statSync(path).size;
    if (size <= 0) return;
    const fd = openSync(path, 'r+');
    try {
      const chunk = Buffer.alloc(Math.min(1024 * 1024, Math.max(size, 1)), 0);
      let offset = 0;
      while (offset < size) {
        const length = Math.min(chunk.byteLength, size - offset);
        writeSync(fd, chunk, 0, length, offset);
        offset += length;
      }
      fsyncSync(fd);
      chunk.fill(0);
    } finally {
      closeSync(fd);
    }
  } catch {
    // SSD/NTFS katmanında güvenli fiziksel silme garanti edilemez; EFS ve kısa ömürlü staging asıl kontroldür.
  }
};

const protectDirectory = (
  directory: string,
  requireWindowsEfs: boolean
): VolatileSqliteProtectionStatus => {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { chmodSync(directory, 0o700); } catch { /* Windows ACL/EFS asıl kontroldür. */ }

  if (process.platform !== 'win32') {
    if (requireWindowsEfs) {
      throw new Error('Windows EFS zorunlu staging koruması bu platformda doğrulanamaz.');
    }
    return {
      activeDatabase: 'memory-only',
      stagingProtection: 'posix-private-directory',
      windowsEfsRequired: false,
      windowsEfsVerified: false
    };
  }

  protectWindowsPathWithEfs(directory, 'Windows EFS staging dizini');
  return {
    activeDatabase: 'memory-only',
    stagingProtection: 'windows-efs',
    windowsEfsRequired: requireWindowsEfs,
    windowsEfsVerified: true
  };
};

const copyAttachedDatabaseIntoMain = (database: DatabaseSync, sourcePath: string): void => {
  database.exec(`ATTACH DATABASE ${quoteSqlLiteral(sourcePath)} AS source_vault;`);
  try {
    database.exec('PRAGMA foreign_keys = OFF;');
    const schema = database.prepare(`
      SELECT type,name,tbl_name,sql
      FROM source_vault.sqlite_schema
      WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
      ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 WHEN 'view' THEN 3 ELSE 4 END, name
    `).all() as unknown as ReadonlyArray<{ readonly type: string; readonly name: string; readonly sql: string }>;

    for (const item of schema.filter((value) => value.type === 'table')) database.exec(item.sql);
    for (const item of schema.filter((value) => value.type === 'table')) {
      const name = quoteIdentifier(item.name);
      database.exec(`INSERT INTO main.${name} SELECT * FROM source_vault.${name};`);
    }

    const hasSequence = database.prepare(
      "SELECT 1 AS present FROM source_vault.sqlite_schema WHERE type='table' AND name='sqlite_sequence' LIMIT 1"
    ).get() as { readonly present?: unknown } | undefined;
    if (Number(hasSequence?.present ?? 0) === 1) {
      const sequence = database.prepare('SELECT name,seq FROM source_vault.sqlite_sequence').all() as unknown as ReadonlyArray<{
        readonly name: string;
        readonly seq: number | bigint;
      }>;
      const insert = database.prepare('INSERT OR REPLACE INTO main.sqlite_sequence(name,seq) VALUES(?,?)');
      for (const item of sequence) insert.run(item.name, item.seq);
    }

    for (const item of schema.filter((value) => value.type !== 'table')) database.exec(item.sql);

    const userVersion = database.prepare('PRAGMA source_vault.user_version').get() as { readonly user_version?: unknown } | undefined;
    const applicationId = database.prepare('PRAGMA source_vault.application_id').get() as { readonly application_id?: unknown } | undefined;
    database.exec(`PRAGMA main.user_version = ${Math.trunc(Number(userVersion?.user_version ?? 0))};`);
    database.exec(`PRAGMA main.application_id = ${Math.trunc(Number(applicationId?.application_id ?? 0))};`);
  } finally {
    try { database.exec('DETACH DATABASE source_vault;'); } finally { database.exec('PRAGMA foreign_keys = ON;'); }
  }
};

export class VolatileSqliteSession {
  public readonly database: DatabaseConnection;
  public readonly protectionStatus: VolatileSqliteProtectionStatus;
  private readonly nativeDatabase: DatabaseSync;
  private readonly stagingDirectory: string;
  private closed = false;

  public constructor(options: VolatileSqliteSessionOptions) {
    this.stagingDirectory = join(options.stagingRoot, `memory-session-${randomUUID()}`);
    this.protectionStatus = protectDirectory(this.stagingDirectory, options.requireWindowsEfs ?? false);
    this.nativeDatabase = new DatabaseSync(':memory:');
    this.database = this.nativeDatabase;

    const initial = options.initialDatabaseBytes;
    if (initial && initial.byteLength > 0) {
      const sourcePath = join(this.stagingDirectory, `hydrate-${randomUUID()}.sqlite`);
      try {
        writeFileSync(sourcePath, initial, { mode: 0o600, flag: 'wx' });
        if (process.platform === 'win32') {
          protectWindowsPathWithEfs(sourcePath, 'Windows EFS hydrate snapshot');
          assertWindowsEfsTreeEncrypted(this.stagingDirectory, 'Windows EFS hydrate staging tree');
        }
        try { chmodSync(sourcePath, 0o600); } catch { /* EFS/private parent directory is authoritative. */ }
        copyAttachedDatabaseIntoMain(this.nativeDatabase, sourcePath);
      } finally {
        if (existsSync(sourcePath)) bestEffortOverwrite(sourcePath);
        rmSync(sourcePath, { force: true });
      }
    }
  }

  public restoreDatabasePath(): string {
    this.assertOpen();
    return join(this.stagingDirectory, 'restored-live.sqlite');
  }

  public databaseBytes(): number {
    this.assertOpen();
    const pageCount = this.nativeDatabase.prepare('PRAGMA page_count').get() as { readonly page_count?: unknown } | undefined;
    const pageSize = this.nativeDatabase.prepare('PRAGMA page_size').get() as { readonly page_size?: unknown } | undefined;
    return Math.max(0, Number(pageCount?.page_count ?? 0)) * Math.max(0, Number(pageSize?.page_size ?? 0));
  }

  public snapshotBytes(): Buffer {
    return this.withSnapshot((path) => readFileSync(path));
  }

  public withSnapshot<T>(operation: (databasePath: string) => T): T {
    this.assertOpen();
    const snapshotPath = join(this.stagingDirectory, `snapshot-${randomUUID()}.sqlite`);
    try {
      this.nativeDatabase.exec(`VACUUM main INTO ${quoteSqlLiteral(snapshotPath)};`);
      if (process.platform === 'win32') {
        protectWindowsPathWithEfs(snapshotPath, 'Windows EFS SQLite snapshot');
        assertWindowsEfsEncrypted(snapshotPath, 'Windows EFS SQLite snapshot');
        assertWindowsEfsTreeEncrypted(this.stagingDirectory, 'Windows EFS snapshot staging tree');
      }
      try { chmodSync(snapshotPath, 0o600); } catch { /* EFS/private parent directory is authoritative. */ }
      return operation(snapshotPath);
    } finally {
      if (existsSync(snapshotPath)) bestEffortOverwrite(snapshotPath);
      rmSync(snapshotPath, { force: true });
    }
  }

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    try { this.nativeDatabase.close(); } finally { rmSync(this.stagingDirectory, { recursive: true, force: true }); }
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('Bellek-içi SQLite oturumu kapalı.');
  }
}
