
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { mkdir } from 'node:fs/promises';

const root = process.cwd();
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const output = process.argv[2] ?? 'artifacts/manifests/BASELINE_CURRENT.json';
const normalizedOutput = output.replaceAll('\\', '/');
const excludedDirectories = new Set(['node_modules', 'dist', 'release', '.git', 'coverage']);
const excludedFiles = new Set(['manifest.json', 'SHA256SUMS.txt', normalizedOutput]);
const files = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excludedDirectories.has(entry.name) || entry.name.startsWith('.tmp')) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) await walk(fullPath);
    else {
      const relativePath = relative(root, fullPath).replaceAll('\\', '/');
      if (!excludedFiles.has(entry.name) && !excludedFiles.has(relativePath)) files.push(fullPath);
    }
  }
}

await walk(root);
const inventory = [];
for (const filePath of files) {
  const content = await readFile(filePath);
  inventory.push({
    path: relative(root, filePath).replaceAll('\\', '/'),
    sha256: createHash('sha256').update(content).digest('hex'),
    bytes: content.length
  });
}
inventory.sort((left, right) => left.path.localeCompare(right.path));

const mainSource = await readFile(join(root, 'apps/desktop/src/main/main.ts'), 'utf8');
const preloadSource = await readFile(join(root, 'apps/desktop/src/main/preload.ts'), 'utf8');
const migrationSources = await Promise.all([
  'database/migrations/0001_legacy_mvp40_schema.sql',
  'database/migrations/0002_legacy_mvp40_compatibility.sql',
  'database/migrations/0003_database_metadata.sql',
  'database/migrations/0004_transactional_outbox.sql',
  'database/migrations/0005_event_dispatcher_state.sql',
  'database/migrations/0006_trusted_devices.sql',
  'database/migrations/0007_authorization_audit_hardening.sql',
  'database/migrations/0008_membership_collaboration_notifications.sql',
  'database/migrations/0009_health_application_indexes.sql',
  'packages/database/src/migration-runner.ts'
].map((path) => readFile(join(root, path), 'utf8')));
const databaseSource = migrationSources.join('\n');
const uniqueMatches = (source, expression) => [...new Set([...source.matchAll(expression)].map((match) => match[1]))].sort();
const mainChannels = uniqueMatches(mainSource, /(?:ipcMain\.handle|registerIpcHandler)\(\s*['"]([^'"]+)/g);
const preloadChannels = uniqueMatches(preloadSource, /ipcRenderer\.invoke\(\s*['"]([^'"]+)/g);
const tableNames = uniqueMatches(databaseSource, /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`\[]?([A-Za-z0-9_]+)/gi);
const applicationTableNames = tableNames.filter((name) => !['schema_migrations', 'database_metadata', 'event_outbox', 'event_handler_receipts'].includes(name));

await mkdir(dirname(join(root, output)), { recursive: true });
await writeFile(join(root, output), JSON.stringify({
  schemaVersion: 1,
  baseline: {
    packageVersion: packageJson.version,
    channel: 'Bronze'
  },
  generatedAt: new Date().toISOString(),
  summary: {
    fileCount: inventory.length,
    sourceTypeScriptFileCount: inventory.filter((file) => /\.tsx?$/.test(file.path)).length,
    ipcMainChannelCount: mainChannels.length,
    preloadInvokeChannelCount: preloadChannels.length,
    sqliteCreateTableCount: tableNames.length,
    sqliteApplicationTableCount: applicationTableNames.length,
    sqliteInfrastructureTableCount: tableNames.length - applicationTableNames.length,
    migrationFileCount: 9
  },
  ipc: { mainChannels, preloadChannels },
  database: {
    createTableNames: tableNames,
    applicationTableNames,
    schemaFingerprint: createHash('sha256').update(tableNames.join('\n')).digest('hex')
  },
  files: inventory
}, null, 2) + '\n');
console.log(`${output} oluşturuldu: ${inventory.length} dosya`);
