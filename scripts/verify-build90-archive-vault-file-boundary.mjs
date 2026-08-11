import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const dataStore = read('apps/desktop/src/main/data-store.ts');
const useCases = read('packages/application/src/archive-vault-file-use-cases.ts');
const adapter = read('apps/desktop/src/main/archive-vault-file-application-adapter.ts');
const appMeta = read('packages/domain/src/app-meta.ts');
const metadata = JSON.parse(read('repository-metadata.json'));

const checks = [
  [
    'archive vault file application port exists',
    useCases.includes('export interface ArchiveVaultFilePort')
      && useCases.includes('store(')
      && useCases.includes('materialize(')
      && useCases.includes('destroy(')
  ],
  [
    'archive vault file use cases exist',
    useCases.includes('export class StoreArchiveFileUseCase')
      && useCases.includes('export class MaterializeArchiveFileUseCase')
      && useCases.includes('export class DestroyArchiveFileUseCase')
  ],
  [
    'filesystem adapter owns encrypted vault storage',
    adapter.includes('export class FileSystemArchiveVaultFilePort')
      && adapter.includes('encryptBytes(plain, vaultKey)')
      && adapter.includes("writeFileSync(targetPath, JSON.stringify(envelope), { flag: 'wx', mode: 0o600 })")
      && adapter.includes('existingSha256 !== metadata.sha256')
      && adapter.includes('createdNewFile: false')
  ],
  [
    'filesystem adapter owns materialization integrity check',
    adapter.includes('decryptBytes(envelope, this.#vaultKey())')
      && adapter.includes("createHash('sha256').update(plain).digest('hex')")
      && adapter.includes("message: 'Dosya bütünlük kontrolü başarısız.'")
  ],
  [
    'filesystem adapter owns secure destruction',
    adapter.includes('if (input.secureDestroy)')
      && adapter.includes('writeFileSync(targetPath, randomBytes(Math.max(1, size)))')
      && adapter.includes('rmSync(targetPath, { force: true })')
  ],
  [
    'datastore constructs archive vault use cases',
    dataStore.includes('new FileSystemArchiveVaultFilePort')
      && dataStore.includes('new StoreArchiveFileUseCase(archiveVaultFiles)')
      && dataStore.includes('new MaterializeArchiveFileUseCase(archiveVaultFiles)')
      && dataStore.includes('new DestroyArchiveFileUseCase(archiveVaultFiles)')
  ],
  [
    'archive import and rollback delegate through use cases',
    dataStore.includes('this.#storeArchiveFileUseCase.execute(fileContext.correlationId')
      && dataStore.includes('this.#destroyArchiveFileUseCase.execute(context.correlationId,{storedName:stored.value.storedName,secureDestroy:false})')
      && dataStore.includes('stored.value.createdNewFile && safeToRemoveNewFile')
      && dataStore.includes('this.#importArchiveItemUseCase.execute')
  ],
  [
    'archive open and destruction delegate while metadata audit remains',
    dataStore.includes('this.#materializeArchiveFileUseCase.execute(context.correlationId')
      && dataStore.includes('this.#recordArchiveOpenedUseCase.execute')
      && dataStore.includes('this.#destroyArchiveFileUseCase.execute(context.correlationId,prepared.value)')
      && dataStore.includes('this.#markArchiveDestroyedUseCase.execute')
  ],
  [
    'direct datastore archive vault filesystem and crypto removed',
    !dataStore.includes('encryptBytes(plain,this.#vaultKey())')
      && !dataStore.includes('extname(sourcePath)')
      && !dataStore.includes('unlinkSync(target)')
      && !dataStore.includes("readFileSync(join(this.#archivePath,plan.value.storedName),'utf8')")
      && !dataStore.includes('join(this.#archivePath,prepared.value.storedName)')
  ],
  [
    'active development metadata and historical build90 evidence exist',
    metadata.monthlySequence === 29
      && metadata.revision === 'AUGUST-29'
      && metadata.stage === 'ACTIVE_DEVELOPMENT'
      && appMeta.includes("version: '04.08.2026.29'")
      && existsSync(new URL('BUILD_STATUS_BRONZE_RC2_BUILD90.md', root))
      && read('BUILD_STATUS_BRONZE_RC2_BUILD90.md').includes('RC2 Final: No')
      && read('BUILD_STATUS_BRONZE_RC2_BUILD90.md').includes('Code Freeze: No')
  ]
];

for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, passed]) => !passed)) process.exit(1);
console.log(`RESULT ${checks.length}/${checks.length} PASS`);
