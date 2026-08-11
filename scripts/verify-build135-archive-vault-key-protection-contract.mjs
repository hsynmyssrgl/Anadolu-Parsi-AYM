import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const reportPath = resolve(process.argv[2] ?? 'artifacts/validation/build135-archive-vault-key-protection-contract.json');
const [rootPackage, desktopPackage, appMeta, provider, archivePort, backupPort, dataStore, main, decision, adr, security, openItems, traceability] = await Promise.all([
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('apps/desktop/package.json', 'utf8').then(JSON.parse),
  readFile('packages/domain/src/app-meta.ts', 'utf8'),
  readFile('apps/desktop/src/main/archive-vault-key-provider.ts', 'utf8'),
  readFile('apps/desktop/src/main/archive-vault-file-application-adapter.ts', 'utf8'),
  readFile('apps/desktop/src/main/full-backup-file-application-adapter.ts', 'utf8'),
  readFile('apps/desktop/src/main/data-store.ts', 'utf8'),
  readFile('apps/desktop/src/main/main.ts', 'utf8'),
  readFile('docs/10_MASTER_DECISION_REGISTER.md', 'utf8'),
  readFile('docs/adr/ADR-020-os-protected-archive-vault-key-and-portable-rewrap.md', 'utf8'),
  readFile('docs/14_SECURITY_PRIVACY_BACKUP_STANDARD.md', 'utf8'),
  readFile('docs/06_OPEN_ITEMS_AFTER_CODING_START.md', 'utf8'),
  readFile('docs/07_BRONZE_REQUIREMENTS_TRACEABILITY.md', 'utf8')
]);

const failures = [];
let assertions = 0;
const verify = (condition, message) => {
  assertions += 1;
  if (!condition) failures.push(message);
};

const activeSequence=Number(String(rootPackage.version).split('-').at(-1));
const activeDisplayVersion=appMeta.match(/version: '([^']+)'/)?.[1] ?? '';
verify(rootPackage.version === desktopPackage.version, `workspace package version drift=${rootPackage.version}/${desktopPackage.version}`);
verify(Number.isInteger(activeSequence)&&activeSequence>=135, `active sequence predates Build 135=${activeSequence}`);
verify(appMeta.includes(`packageVersion: '${rootPackage.version}'`), 'application package version does not match active workspace');
verify(activeDisplayVersion.endsWith(`.${activeSequence}`), 'application display version does not match active sequence');
verify(appMeta.includes("stage: 'Bronze RC2"), 'active stage is not Bronze RC2 Active Development');
verify(rootPackage.scripts?.['verify:build135:vault-key-protection'] === 'node scripts/verify-build135-archive-vault-key-protection-contract.mjs', 'Build 135 contract command is missing');
verify(rootPackage.scripts?.['verify:vault-key-protection:runtime'] === 'node scripts/verify-archive-vault-key-protection-runtime.mjs', 'Build 135 runtime command is missing');

for (const marker of [
  'ProtectedArchiveVaultKeyEnvelope',
  "schemaVersion: 2",
  "purpose: 'archive-vault-key'",
  'keyCiphertextBase64',
  'keySha256',
  'timingSafeEqual',
  'serializePortableKeyForCurrentDevice',
  'verifyLocalStorageBytes',
  'exportPortableKey',
  'matchesPath',
  '#recoverInterruptedMigration',
  '.migration-backup',
  'fsyncSync',
  'mode: 0o600',
  'this.#protector.protect(key.toString(\'base64\'))',
  'this.#protector.unprotect(parsed.keyCiphertextBase64)',
  'İşletim sistemi dijital kasa anahtarı koruması kullanılamıyor.'
]) verify(provider.includes(marker), `vault key provider missing: ${marker}`);

verify(!provider.includes('writeFileSync(this.filePath, randomBytes(32)'), 'provider writes a plaintext key directly');
verify(provider.includes('if (bytes.length === LEGACY_KEY_BYTES)'), 'legacy raw key migration detection is missing');
verify(provider.includes('this.#writeProtectedKey(key, true'), 'legacy migration does not replace with protected envelope');
verify(provider.includes('rmSync(this.#migrationBackupPath, { force: true })'), 'migration backup cleanup is missing');
verify(provider.includes('renameSync(this.#migrationBackupPath, this.filePath)'), 'interrupted migration recovery is missing');

verify(archivePort.includes('readonly keyProvider?: ProtectedArchiveVaultKeyProvider'), 'archive file adapter key provider option is missing');
verify(archivePort.includes('return this.options.keyProvider.getOrCreateKey()'), 'archive file adapter does not use protected key provider');
verify(archivePort.includes('Dijital kasa anahtarı sağlayıcısı depolama yolu ile eşleşmiyor.'), 'archive path mismatch refusal is missing');

verify(backupPort.includes('readonly vaultKeyProvider?: ProtectedArchiveVaultKeyProvider'), 'full backup key provider option is missing');
verify(backupPort.includes('return this.options.vaultKeyProvider.exportPortableKey()'), 'full backup does not export portable raw key through provider');
verify(backupPort.includes('serializePortableKeyForCurrentDevice(components.keyBytes)'), 'restore does not rewrap portable key for current device');
verify(backupPort.includes('Dijital kasa anahtarı sağlayıcısı yedekleme yolu ile eşleşmiyor.'), 'backup path mismatch refusal is missing');
verify(backupPort.includes('decryptBytes(JSON.parse(bytes.toString(\'utf8\')) as EncryptedEnvelope, keyBytes)'), 'backup archive validation with portable key was lost');

verify(dataStore.includes('vaultKeySecretProtector?: DeviceSecretProtector'), 'data store vault key protector option is missing');
verify(dataStore.includes('new ProtectedArchiveVaultKeyProvider('), 'data store does not compose protected vault key provider');
verify(dataStore.includes('keyProvider: archiveVaultKeyProvider'), 'archive adapter composition is missing');
verify(dataStore.includes('vaultKeyProvider: archiveVaultKeyProvider'), 'full backup adapter composition is missing');
verify(main.includes('vaultKeySecretProtector: osSecretProtector'), 'production OS secret protector wiring is missing');
verify(main.includes('backupSecretProtector: osSecretProtector'), 'backup password OS protection continuity was lost');
verify(main.includes('mfaSecretProtector: osSecretProtector'), 'MFA OS protection continuity was lost');
verify(main.includes('deviceSecretProtector: osSecretProtector'), 'device identity OS protection continuity was lost');

verify(decision.includes('DEC-049'), 'DEC-049 decision record is missing');
verify(decision.includes('hedef cihazın işletim sistemi korumasıyla yeniden sarılır'), 'portable restore rewrap decision is missing');
verify(adr.includes('ADR-020'), 'ADR-020 is missing');
verify(adr.includes('Eski cihazın DPAPI zarfı kopyalanmaz'), 'ADR target-device rewrap rule is missing');
verify(security.includes('Build 135 dijital kasa anahtarı koruma standardı'), 'security standard section is missing');
verify(openItems.includes('Build 135 ile kaynakta kapatılanlar'), 'Build 135 open-items closure is missing');
verify(traceability.includes('Dijital arşiv kasa anahtarının OS korumalı saklanması'), 'Build 135 traceability row is missing');

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  build: 135,
  applicationVersion: activeDisplayVersion,
  packageVersion: rootPackage.version,
  stage: 'Bronze RC2 Active Development',
  scope: 'OS-protected archive vault key envelope, atomic legacy migration, production composition, portable encrypted backup export and current-device restore rewrap',
  assertions,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 135 archive vault key protection contract: ${report.status} (${assertions} assertions)`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
