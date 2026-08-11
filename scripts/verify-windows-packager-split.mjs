import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const reportPath = resolve(option('--report', 'artifacts/validation/build150-windows-packager-split.json'));
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const [rootPackage, desktopPackage, rootLock, packagerPackage, packagerLock, runner, contract] = await Promise.all([
  readJson('package.json'),
  readJson('apps/desktop/package.json'),
  readJson('package-lock.json'),
  readJson('tools/windows-packager/package.json'),
  readJson('tools/windows-packager/package-lock.json'),
  readFile('apps/desktop/scripts/run-electron-builder.mjs', 'utf8'),
  readJson('config/build-toolchain-security.json')
]);
let assertions = 0;
const failures = [];
const verify = (condition, message) => { assertions += 1; if (!condition) failures.push(message); };
verify(desktopPackage.devDependencies?.['electron-builder'] === undefined, 'electron-builder remains in desktop root install graph');
verify(rootLock.packages?.['node_modules/electron-builder'] === undefined, 'electron-builder remains in root lockfile');
verify(rootLock.packages?.['node_modules/app-builder-lib'] === undefined, 'app-builder-lib remains in root lockfile');
verify(rootLock.packages?.['node_modules/yargs-parser'] === undefined, 'Windows-only yargs-parser remains in root lockfile');
verify(packagerPackage.devDependencies?.['electron-builder'] === contract.electronBuilderVersion, 'packager manifest electron-builder pin mismatch');
verify(packagerLock.packages?.['node_modules/electron-builder']?.version === contract.electronBuilderVersion, 'packager lock electron-builder pin mismatch');
verify(packagerLock.packages?.['node_modules/app-builder-lib']?.version === contract.electronBuilderVersion, 'packager lock app-builder-lib pin mismatch');
verify(packagerLock.packages?.['node_modules/electron-builder-squirrel-windows']?.link === true, 'reviewed Squirrel fail-closed link missing');
verify(packagerLock.packages?.['node_modules/electron-builder-squirrel-windows']?.resolved === '../electron-builder-squirrel-windows-stub', 'Squirrel stub link target mismatch');
verify(rootPackage.scripts?.['windows-packager:install']?.includes('--prefix tools/windows-packager'), 'isolated packager install command missing');
verify(runner.includes("tools/windows-packager/node_modules/electron-builder/cli.js"), 'runner does not use isolated packager CLI');
verify(runner.includes("process.argv.includes('--dir')"), 'directory package mode is not explicitly controlled');
verify(runner.includes('Windows paketleme bağımlılıkları kurulmamış'), 'missing toolchain does not fail with actionable error');
verify(desktopPackage.scripts?.['package:win:dir']?.includes('--dir'), 'package:win:dir does not select directory target');
const rootResolved = Object.values(rootLock.packages ?? {}).filter((entry) => typeof entry?.resolved === 'string' && entry.resolved.startsWith('http')).length;
const packagerResolved = Object.values(packagerLock.packages ?? {}).filter((entry) => typeof entry?.resolved === 'string' && entry.resolved.startsWith('http')).length;
verify(rootResolved < packagerResolved, `root dependency graph was not reduced: root=${rootResolved}, packager=${packagerResolved}`);
const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  featureBuild: 150,
  stage: 'Bronze RC2 Active Development',
  rootLockPackageCount: Object.keys(rootLock.packages ?? {}).length,
  rootRegistryTarballCount: rootResolved,
  windowsPackagerLockPackageCount: Object.keys(packagerLock.packages ?? {}).length,
  windowsPackagerRegistryTarballCount: packagerResolved,
  assertions,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 150 Windows packager split: ${report.status} (${assertions - failures.length}/${assertions}).`);
for (const failure of failures) console.error(`- ${failure}`);
if (failures.length) process.exitCode = 1;
