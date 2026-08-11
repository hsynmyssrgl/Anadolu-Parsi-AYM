import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const expectedDisplayVersion = '25.07.2026.106';
const expectedPackageVersion = '25.7.2026-106';
const expectedBuild = 106;
const failures = [];
let checks = 0;
const verify = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const manifestPaths = ['package.json'];
for (const parent of ['apps', 'packages']) {
  for (const entry of await readdir(parent, { withFileTypes: true })) {
    if (entry.isDirectory()) manifestPaths.push(join(parent, entry.name, 'package.json'));
  }
}
const workspaceNames = new Set();
for (const path of manifestPaths.slice(1)) workspaceNames.add((await readJson(path)).name);
verify(workspaceNames.size === 14, `workspace count=${workspaceNames.size}`);
verify(workspaceNames.has('@ppt/repository-contracts'), 'repository contract workspace is missing');
for (const path of manifestPaths) {
  const manifest = await readJson(path);
  verify(manifest.version === expectedPackageVersion, `${path} version=${manifest.version}`);
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (workspaceNames.has(name)) verify(version === expectedPackageVersion, `${path} ${name}=${version}`);
    }
  }
}

const persistenceContracts = await readFile('packages/contracts/src/persistence.ts', 'utf8');
verify(persistenceContracts.includes('declare const repositoryTransactionBrand: unique symbol;'), 'repository transaction is not opaque');
verify(persistenceContracts.includes('readonly transaction: RepositoryTransaction;'), 'transaction context does not expose opaque transaction token');
verify(!persistenceContracts.includes('readonly database: DatabaseExecutor;'), 'transaction context exposes SQL executor');
const sqliteTransaction = await readFile('packages/database/src/transaction.ts', 'utf8');
verify(sqliteTransaction.includes('transaction: this.database as unknown as RepositoryTransaction'), 'SQLite transaction executor does not wrap native database as opaque token');
verify(!sqliteTransaction.includes('database: this.database'), 'SQLite transaction callback exposes native database');

const contractManifest = await readJson('packages/repository-contracts/package.json');
verify(contractManifest.name === '@ppt/repository-contracts', `contract package name=${contractManifest.name}`);
verify(contractManifest.exports?.['.'] === './dist/index.js', 'contract package root export is missing');
verify(Object.keys(contractManifest.exports ?? {}).length === 1, 'contract package exposes unexpected runtime subpaths');
for (const dependency of ['@ppt/contracts', '@ppt/core', '@ppt/domain', '@ppt/events']) {
  verify(contractManifest.dependencies?.[dependency] === expectedPackageVersion, `contract package dependency ${dependency} is missing`);
}
verify(contractManifest.dependencies?.['@ppt/database'] === undefined, 'contract package depends on database implementation');
verify(contractManifest.dependencies?.['@ppt/repositories'] === undefined, 'contract package depends on repository implementation');

const contractDirectory = 'packages/repository-contracts/src';
const contractFiles = (await readdir(contractDirectory)).filter((name) => name.endsWith('-repository.ts')).sort();
verify(contractFiles.length === 26, `repository contract module count=${contractFiles.length}`);
const portByFile = new Map();
for (const file of contractFiles) {
  const source = await readFile(join(contractDirectory, file), 'utf8');
  const ports = [...source.matchAll(/export interface ([A-Za-z0-9]+RepositoryPort)\b/g)].map((match) => match[1]);
  verify(ports.length === 1, `${file} port count=${ports.length}`);
  if (ports[0]) portByFile.set(file, ports[0]);
  verify(!/export class\b/.test(source), `${file} contains a concrete class`);
  verify(!/\bSqlite[A-Za-z0-9]*/.test(source), `${file} contains SQLite naming`);
  verify(!/\.(?:prepare|exec)\(/.test(source), `${file} contains database operations`);
  verify(!source.includes("from '@ppt/database'"), `${file} imports database implementation`);
  verify(!source.includes("from '@ppt/repositories'"), `${file} imports repository implementation`);
  verify(source.includes("from './repository-context.js';"), `${file} does not use contract-owned repository context`);
}
const contractContext = await readFile(join(contractDirectory, 'repository-context.ts'), 'utf8');
for (const name of ['ActorContext', 'RepositoryContext', 'RepositoryExecutionContext', 'RepositoryResult', 'RepositoryHealth']) {
  verify(new RegExp(`export (?:interface|type) ${name}\\b`).test(contractContext), `contract context does not own ${name}`);
}
verify(contractContext.includes("from '@ppt/contracts';"), 'contract context does not consume opaque transaction contract');
const contractIndex = await readFile(join(contractDirectory, 'index.ts'), 'utf8');
for (const file of contractFiles) verify(contractIndex.includes(`export * from './${file.replace(/\.ts$/, '.js')}';`), `contract index does not export ${file}`);

const repositoriesManifest = await readJson('packages/repositories/package.json');
for (const dependency of ['@ppt/contracts', '@ppt/core', '@ppt/database', '@ppt/domain', '@ppt/events', '@ppt/repository-contracts']) {
  verify(repositoriesManifest.dependencies?.[dependency] === expectedPackageVersion, `repository package dependency ${dependency} is missing`);
}
verify(repositoriesManifest.exports?.['./ports'] === undefined, 'repository runtime package still exposes the old ports subpath');
const repositoryIndex = await readFile('packages/repositories/src/index.ts', 'utf8');
verify(!repositoryIndex.includes("@ppt/repository-contracts"), 'repository runtime root re-exports contract package');
verify(!repositoryIndex.includes("'./repository-ports.js'"), 'repository runtime root exports compatibility port surface');
verify(!repositoryIndex.includes("'./repository-context.js'"), 'repository runtime root exports contract context compatibility surface');
verify(!repositoryIndex.includes("'./transaction-ports.js'"), 'repository runtime root exports transaction compatibility surface');
const sqliteBase = await readFile('packages/repositories/src/sqlite-base.ts', 'utf8');
verify(sqliteBase.includes("import type { RepositoryExecutionContext } from '@ppt/repository-contracts';"), 'SQLite base does not consume dedicated contract package');
verify(sqliteBase.includes('context.transaction as unknown as DatabaseExecutor'), 'SQLite base does not control opaque transaction unwrap');
verify(!sqliteBase.includes('export type { RepositoryExecutionContext'), 'SQLite base re-exports contract types');

const repositoryDirectory = 'packages/repositories/src';
const repositoryFiles = (await readdir(repositoryDirectory)).filter((name) => name.endsWith('-repository.ts') && name !== 'repository-ports.ts').sort();
verify(repositoryFiles.length === 26, `repository implementation count=${repositoryFiles.length}`);
for (const file of repositoryFiles) {
  const source = await readFile(join(repositoryDirectory, file), 'utf8');
  const portName = portByFile.get(file);
  verify(Boolean(portName), `${file} has no corresponding contract module`);
  if (portName) {
    verify(source.includes(`from '@ppt/repository-contracts';`), `${file} does not import dedicated repository contracts`);
    verify(new RegExp(`implements ${portName}\\b`).test(source), `${file} does not implement ${portName}`);
  }
  verify(!/^export (?:interface|type)\b/m.test(source), `${file} still owns exported contract declarations`);
  verify(!source.includes("from './repository-context.js'"), `${file} imports the old local contract context`);
  verify(!/import\s+\{[^}]*RepositoryExecutionContext[^}]*\}\s+from\s+['"]\.\/sqlite-base\.js['"]/.test(source), `${file} imports contract context through SQLite base`);
  verify(!source.includes("from '@ppt/repositories/ports'"), `${file} imports removed repository ports subpath`);
  verify(!/\b[A-Za-z_$][A-Za-z0-9_$]*\.transaction\.(?:prepare|exec)\(/.test(source), `${file} directly uses opaque transaction token`);
}

const adapterDirectory = 'apps/desktop/src/main';
const adapterFiles = (await readdir(adapterDirectory)).filter((name) => name.endsWith('-application-adapter.ts')).sort();
verify(adapterFiles.length === 30, `desktop application adapter count=${adapterFiles.length}`);
let contractConsumerCount = 0;
for (const file of adapterFiles) {
  const source = await readFile(join(adapterDirectory, file), 'utf8');
  verify(!source.includes("from '@ppt/repositories'"), `${file} imports repository runtime package`);
  verify(!source.includes("from '@ppt/repositories/ports'"), `${file} imports removed repository ports subpath`);
  verify(!source.includes("from '@ppt/database'"), `${file} imports database implementation package`);
  verify(!source.includes("from '@ppt/infrastructure'"), `${file} imports infrastructure package`);
  if (/\b(?:RepositoryPort|TransactionExecutor|TransactionContext|RepositoryExecutionContext)\b/.test(source)) {
    contractConsumerCount += 1;
    verify(source.includes("from '@ppt/repository-contracts';"), `${file} does not import dedicated contract package`);
  }
}
verify(contractConsumerCount === 21, `repository contract consuming adapter count=${contractConsumerCount}`);
const dataStore = await readFile('apps/desktop/src/main/data-store.ts', 'utf8');
verify(dataStore.includes("from '@ppt/repository-contracts';"), 'FamilyDataStore does not consume dedicated repository contracts');
verify(!dataStore.includes("@ppt/repositories/ports"), 'FamilyDataStore uses removed ports subpath');
const familyRuntime = await readFile('apps/desktop/src/main/family-database-runtime.ts', 'utf8');
verify(familyRuntime.includes("from '@ppt/repository-contracts';"), 'database runtime does not expose dedicated transaction contract');
const compositionRoot = await readFile('apps/desktop/src/main/repository-composition-root.ts', 'utf8');
verify(compositionRoot.includes("from '@ppt/repositories';"), 'composition root does not own repository implementation imports');

const desktopManifest = await readJson('apps/desktop/package.json');
verify(desktopManifest.dependencies?.['@ppt/repository-contracts'] === expectedPackageVersion, 'desktop does not declare repository contract package');
const rootTsconfig = await readJson('tsconfig.json');
verify(rootTsconfig.compilerOptions?.paths?.['@ppt/repository-contracts']?.[0] === 'packages/repository-contracts/src/index.ts', 'root typecheck path does not resolve repository contract package');
verify(rootTsconfig.compilerOptions?.paths?.['@ppt/repositories/ports'] === undefined, 'root typecheck preserves removed repository ports alias');

const rootManifest = await readJson('package.json');
verify(rootManifest.scripts?.['build:foundation']?.includes('npm run build --workspace @ppt/repository-contracts && npm run build --workspace @ppt/repositories'), 'foundation build order does not build contracts before implementations');
verify(rootManifest.scripts?.['verify:workspace-dependencies'] === 'node scripts/verify-workspace-import-dependencies.mjs', 'workspace dependency verifier is not registered');
verify(rootManifest.scripts?.['verify:lockfile']?.includes('verify-workspace-import-dependencies.mjs'), 'lockfile gate does not include workspace dependency alignment');
verify(rootManifest.scripts?.['verify:build106:architecture'] === 'node scripts/verify-build106-architecture.mjs', 'Build 106 verifier is not registered');
verify(rootManifest.scripts?.typecheck === 'tsc --noEmit', `typecheck=${rootManifest.scripts?.typecheck}`);

const dependencyVerifier = await readFile('scripts/verify-workspace-import-dependencies.mjs', 'utf8');
verify(dependencyVerifier.includes("for (const parent of ['apps', 'packages'])"), 'workspace dependency verifier does not discover all workspaces');
verify(dependencyVerifier.includes('imports ${dependencyName} but does not declare it in package.json'), 'workspace dependency verifier does not reject undeclared imports');

const appMeta = await readFile('packages/domain/src/app-meta.ts', 'utf8');
verify(appMeta.includes(`version: '${expectedDisplayVersion}'`), 'display version mismatch');
verify(appMeta.includes(`packageVersion: '${expectedPackageVersion}'`), 'package version mismatch');
verify(appMeta.includes("stage: 'Bronze RC2 · Aktif Geliştirme · Build 106'"), 'active development stage mismatch');
const ledger = await readJson('artifacts/manifests/VERSION_LEDGER.json');
const latestLedger = ledger.entries?.at(-1);
verify(latestLedger?.version === expectedDisplayVersion, `ledger version=${latestLedger?.version}`);
verify(latestLedger?.packageVersion === expectedPackageVersion, `ledger package=${latestLedger?.packageVersion}`);
verify(latestLedger?.sequence === expectedBuild, `ledger sequence=${latestLedger?.sequence}`);
const metadata = await readJson('repository-metadata.json');
verify(metadata.repositoryVersion === expectedDisplayVersion, `metadata repositoryVersion=${metadata.repositoryVersion}`);
verify(metadata.packageVersion === expectedPackageVersion, `metadata packageVersion=${metadata.packageVersion}`);
verify(metadata.revision === 'BUILD-106', `metadata revision=${metadata.revision}`);
verify(metadata.versionSequence === expectedBuild, `metadata sequence=${metadata.versionSequence}`);

if (failures.length > 0) {
  console.error(`Build 106 architecture verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 106 architecture verification completed: ${checks} targeted assertions / ${contractFiles.length} contract modules / ${repositoryFiles.length} repositories / ${adapterFiles.length} application adapters.`);
