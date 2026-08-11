import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const expectedDisplayVersion = '25.07.2026.100';
const expectedPackageVersion = '25.7.2026-100';
const concreteRepositoryNames = [
  'SqliteAccountRepository',
  'SqliteAiConsentRepository',
  'SqliteArchiveRepository',
  'SqliteAuditRepository',
  'SqliteAutomationRepository',
  'SqliteBackupRepository',
  'SqliteBootstrapRepository',
  'SqliteDashboardRepository',
  'SqliteDiagnosticRepository',
  'SqliteFamilyRepository',
  'SqliteFinanceRepository',
  'SqliteGenealogyRepository',
  'SqliteHealthRepository',
  'SqliteInvitationRepository',
  'SqliteLegacyRepository',
  'SqliteLifeRepository',
  'SqliteLocationRepository',
  'SqliteNotificationStateRepository',
  'SqliteObjectPermissionRepository',
  'SqliteOutboxRepository',
  'SqlitePersonRepository',
  'SqliteRelationRepository',
  'SqliteReportRepository',
  'SqliteTaskRepository',
  'SqliteTimelineRepository',
  'SqliteTrustedDeviceRepository'
];

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const checks = [];
const verify = (name, condition, detail) => {
  if (!condition) throw new Error(`${name}: ${detail}`);
  checks.push(name);
};

const workspaceManifestPaths = ['package.json'];
for (const base of ['apps', 'packages']) {
  for (const entry of await readdir(base, { withFileTypes: true })) {
    if (entry.isDirectory()) workspaceManifestPaths.push(join(base, entry.name, 'package.json'));
  }
}
workspaceManifestPaths.sort();
for (const path of workspaceManifestPaths) {
  const manifest = await readJson(path);
  verify('workspace package version alignment', manifest.version === expectedPackageVersion, `${path}=${manifest.version}`);
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (!name.startsWith('@ppt/')) continue;
      verify('internal dependency version alignment', version === expectedPackageVersion, `${path}:${name}=${version}`);
    }
  }
}

const lock = await readJson('package-lock.json');
verify('lockfile root version', lock.version === expectedPackageVersion, `lock.version=${lock.version}`);
for (const [path, entry] of Object.entries(lock.packages ?? {})) {
  const isWorkspace = path === '' || /^(apps|packages)\/[^/]+$/.test(path);
  if (isWorkspace) {
    verify('lockfile workspace version alignment', entry.version === expectedPackageVersion, `${path || '<root>'}=${entry.version}`);
    for (const [name, version] of Object.entries(entry.dependencies ?? {})) {
      if (!name.startsWith('@ppt/')) continue;
      verify('lockfile internal dependency alignment', version === expectedPackageVersion, `${path}:${name}=${version}`);
    }
  }
  if (path.startsWith('node_modules/@ppt/')) {
    verify('local workspace lock link', entry.link === true && /^(apps|packages)\//.test(entry.resolved ?? ''), `${path} is not a local link`);
  }
}

const desktopMigrationShim = await readFile('apps/desktop/src/main/database-migrations.ts', 'utf8');
const databaseMigrations = await readFile('packages/database/src/family-database-migrations.ts', 'utf8');
const databaseIndex = await readFile('packages/database/src/index.ts', 'utf8');
const databaseRuntime = await readFile('apps/desktop/src/main/family-database-runtime.ts', 'utf8');
verify('desktop migration SQL removal', !/\b(?:CREATE|ALTER|INSERT|UPDATE|DELETE|PRAGMA)\b/i.test(desktopMigrationShim), 'desktop migration shim contains SQL');
verify('database migration ownership', /CREATE TABLE/i.test(databaseMigrations) && databaseMigrations.includes('FAMILY_DATABASE_MIGRATIONS'), 'database migration module is incomplete');
verify('database migration export', databaseIndex.includes("export * from './family-database-migrations.js';"), 'database package does not export family migrations');
verify('runtime migration dependency', databaseRuntime.includes('runFamilyDatabaseMigrations') && databaseRuntime.includes("from '@ppt/database'"), 'runtime does not consume database migration port');

const desktopMainFiles = (await readdir('apps/desktop/src/main')).filter((name) => name.endsWith('.ts'));
const rawSqlPattern = /\b(?:SELECT|INSERT\s+INTO|UPDATE\s+[A-Za-z_]|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|PRAGMA)\b/i;
for (const file of desktopMainFiles) {
  const text = await readFile(join('apps/desktop/src/main', file), 'utf8');
  verify('desktop raw SQL boundary', !rawSqlPattern.test(text), `${file} contains a raw SQL token`);
}

const compositionRootPath = 'apps/desktop/src/main/repository-composition-root.ts';
const compositionRoot = await readFile(compositionRootPath, 'utf8');
const dataStore = await readFile('apps/desktop/src/main/data-store.ts', 'utf8');
const repositoryPorts = await readFile('packages/repositories/src/repository-ports.ts', 'utf8');
verify('composition root wiring', dataStore.includes('createSqliteRepositoryCompositionRoot') && dataStore.includes('#repositories'), 'FamilyDataStore does not consume repository composition root');
verify('repository port export', repositoryPorts.includes('AccountRepositoryPort') && repositoryPorts.includes('TrustedDeviceRepositoryPort'), 'repository port catalog is incomplete');
for (const name of concreteRepositoryNames) {
  verify('composition root repository coverage', compositionRoot.includes(`new ${name}()`), `${name} is not composed`);
  verify('data store concrete dependency removal', !dataStore.includes(name), `${name} remains in data-store.ts`);
}

for (const file of desktopMainFiles.filter((name) => name.endsWith('-application-adapter.ts'))) {
  const text = await readFile(join('apps/desktop/src/main', file), 'utf8');
  if (!text.includes("from '@ppt/repositories'")) continue;
  verify('adapter repository type-only import', /import\s+type\s*\{[^;]*\}\s*from '@ppt\/repositories';/s.test(text), `${file} uses a runtime repository import`);
  for (const name of concreteRepositoryNames) {
    verify('adapter concrete repository removal', !text.includes(name), `${file} references ${name}`);
  }
}

const rootManifest = await readJson('package.json');
const rootTsconfig = await readJson('tsconfig.json');
verify('root no-emit command', rootManifest.scripts?.typecheck === 'tsc --noEmit', `typecheck=${rootManifest.scripts?.typecheck}`);
verify('root no-emit config', rootTsconfig.compilerOptions?.noEmit === true, 'tsconfig.json must set noEmit=true');
verify('root source coverage', (rootTsconfig.include ?? []).includes('packages/*/src/**/*.ts') && (rootTsconfig.include ?? []).includes('apps/desktop/src/renderer/**/*.tsx'), 'tsconfig.json source coverage is incomplete');
for (const manifestPath of workspaceManifestPaths.filter((path) => path !== 'package.json')) {
  const manifest = await readJson(manifestPath);
  if (manifest.name === '@ppt/desktop') continue;
  verify('root path alias coverage', Array.isArray(rootTsconfig.compilerOptions?.paths?.[manifest.name]), `${manifest.name} is missing from root tsconfig paths`);
}
verify('lockfile verifier registration', rootManifest.scripts?.['verify:lockfile'] === 'node scripts/verify-lockfile-integrity.mjs', 'verify:lockfile script is missing');
verify('safe version updater presence', (await readFile('scripts/set-workspace-version.mjs', 'utf8')).includes('workspaceNames.has(dependencyName)'), 'safe workspace version updater is incomplete');

const appMeta = await readFile('packages/domain/src/app-meta.ts', 'utf8');
verify('display version metadata', appMeta.includes(`version: '${expectedDisplayVersion}'`), 'APP_META display version mismatch');
verify('package version metadata', appMeta.includes(`packageVersion: '${expectedPackageVersion}'`), 'APP_META package version mismatch');
verify('active development stage', appMeta.includes("stage: 'Bronze RC2 · Aktif Geliştirme · Build 100'"), 'APP_META stage mismatch');

console.log(`Build 100 architecture verification completed: ${checks.length} targeted assertions.`);
