import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const dataStore = read('apps/desktop/src/main/data-store.ts');
const adapter = read('apps/desktop/src/main/family-storage-layout-application-adapter.ts');
const useCases = read('packages/application/src/family-storage-layout-use-cases.ts');
const applicationIndex = read('packages/application/src/index.ts');
const appMeta = read('packages/domain/src/app-meta.ts');
const metadata = JSON.parse(read('repository-metadata.json'));

const constructorStart = dataStore.indexOf('public constructor(options: DataStoreOptions)');
const constructorEnd = dataStore.indexOf('public close(): void', constructorStart);
const constructorBody = dataStore.slice(constructorStart, constructorEnd);

const checks = [
  [
    'application storage layout port remains explicit',
    useCases.includes('export interface FamilyStorageLayoutView')
      && useCases.includes('export interface FamilyStorageLayoutPort')
      && useCases.includes('export class ResolveFamilyStorageLayoutUseCase')
  ],
  [
    'storage layout use case validates required and optional paths',
    useCases.includes("if (!input.databasePath.trim())")
      && useCases.includes("input.deviceIdentityPath !== undefined && !input.deviceIdentityPath.trim()")
      && useCases.includes("input.archivePath !== undefined && !input.archivePath.trim()")
  ],
  [
    'Node adapter owns path derivation and previous layout',
    adapter.includes("from 'node:path'")
      && adapter.includes("join(rootPath, 'secrets', 'device-identity.json')")
      && adapter.includes("join(rootPath, 'archive')")
      && adapter.includes("join(rootPath, 'vault.key')")
      && adapter.includes("join(rootPath, 'temp-open')")
  ],
  [
    'application package exports the storage layout boundary',
    applicationIndex.includes("export * from './family-storage-layout-use-cases.js';")
  ],
  [
    'datastore constructs and executes the storage layout boundary',
    dataStore.includes("from './family-storage-layout-application-adapter.js';")
      && constructorBody.includes('new ResolveFamilyStorageLayoutUseCase(')
      && constructorBody.includes('new NodeFamilyStorageLayoutPort()')
      && constructorBody.includes('storageLayoutResult.value')
  ],
  [
    'custom device identity and archive paths remain optional overrides',
    constructorBody.includes('options.deviceIdentityPath === undefined')
      && constructorBody.includes('{ deviceIdentityPath: options.deviceIdentityPath }')
      && constructorBody.includes('options.archivePath === undefined')
      && constructorBody.includes('{ archivePath: options.archivePath }')
  ],
  [
    'resolved layout feeds runtime, identity and archive vault wiring',
    constructorBody.includes('this.#databasePath = storageLayout.databasePath')
      && constructorBody.includes('storageLayout.deviceIdentityPath')
      && constructorBody.includes('this.#archivePath = storageLayout.archivePath')
      && constructorBody.includes('this.#keyPath = storageLayout.vaultKeyPath')
      && constructorBody.includes('temporaryOpenPath: storageLayout.temporaryOpenPath')
      && constructorBody.includes('databasePath: this.#databasePath')
  ],
  [
    'datastore no longer owns direct Node path or host OS imports',
    !dataStore.includes("from 'node:path'")
      && !dataStore.includes("from 'node:os'")
      && !dataStore.includes('join(dirname(options.databasePath)')
  ],
  [
    'build98 version metadata is aligned',
    metadata.versionSequence === 98
      && metadata.revision === 'BUILD-98'
      && metadata.packageVersion === '24.7.2026-98'
      && appMeta.includes("version: '24.07.2026.98'")
      && appMeta.includes("packageVersion: '24.7.2026-98'")
      && appMeta.includes('Build 98')
  ],
  [
    'build98 remains active development',
    existsSync(new URL('BUILD_STATUS_BRONZE_RC2_BUILD98.md', root))
      && read('BUILD_STATUS_BRONZE_RC2_BUILD98.md').includes('RC2 Final: No')
      && read('BUILD_STATUS_BRONZE_RC2_BUILD98.md').includes('Code Freeze: No')
      && read('BUILD_STATUS_BRONZE_RC2_BUILD98.md').includes('Silver: No')
  ]
];

for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, passed]) => !passed)) process.exit(1);
console.log(`RESULT ${checks.length}/${checks.length} PASS`);
