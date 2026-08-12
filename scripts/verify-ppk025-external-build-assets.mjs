import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { prettyCanonicalJson, sha256Bytes } from './lib/ppk025-software-supply-chain.mjs';

const manifestPath = 'config/32-u-ppk-025-external-build-assets.json';
const outputPath = 'artifacts/validation/32-U-ppk-025-external-build-assets.json';
const [manifestBytes, electronChecksumsBytes, toolsetsBytes, sevenZipToolsetBytes, desktopBytes] = await Promise.all([
  readFile(manifestPath),
  readFile('node_modules/electron/checksums.json'),
  readFile('tools/windows-packager/node_modules/app-builder-lib/out/toolsets/windows.js'),
  readFile('tools/windows-packager/node_modules/app-builder-lib/out/toolsets/7zip.js'),
  readFile('apps/desktop/package.json')
]);
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const electronChecksums = JSON.parse(electronChecksumsBytes.toString('utf8'));
const toolsets = toolsetsBytes.toString('utf8');
const sevenZipToolset = sevenZipToolsetBytes.toString('utf8');
const desktop = JSON.parse(desktopBytes.toString('utf8'));
const checks = [];
const failures = [];
const check = (name, condition) => { checks.push({ name, passed: Boolean(condition) }); if (!condition) failures.push(name); };
const ids = manifest.assets.map((item) => item.id);
check('manifest identity is exact', manifest.schemaVersion === 1 && manifest.step === '32-U' && manifest.requirement === 'PPK-025');
check('external asset ids are unique', new Set(ids).size === ids.length);
check('required external assets are exact', JSON.stringify(ids) === JSON.stringify(['electron', '7zip', 'nsis', 'nsis-resources', 'winCodeSign']));
check('all assets use pinned HTTPS GitHub release URLs', manifest.assets.every((item) => item.source.startsWith('https://github.com/') && item.source.endsWith(`/${item.fileName}`) && !/[{}*]/u.test(item.source)));
check('all assets use exact SHA-256', manifest.assets.every((item) => /^[a-f0-9]{64}$/u.test(item.sha256)));
const electron = manifest.assets.find((item) => item.id === 'electron');
check('Electron version is exact in Desktop manifest', desktop.devDependencies?.electron === electron.version);
check('Electron Windows archive hash matches installed upstream checksums', electronChecksums[electron.fileName] === electron.sha256);
const sevenZip = manifest.assets.find((item) => item.id === '7zip');
check('7zip Windows archive file and hash are pinned by installed builder toolset', sevenZipToolset.includes(`"${sevenZip.fileName}"`) && sevenZipToolset.includes(`"${sevenZip.sha256}"`) && sevenZipToolset.includes('7zip@1.0.0'));
for (const id of ['nsis', 'nsis-resources', 'winCodeSign']) {
  const asset = manifest.assets.find((item) => item.id === id);
  check(`${id} file and hash are pinned by installed builder toolsets`, toolsets.includes(`"${asset.fileName}"`) && toolsets.includes(`"${asset.sha256}"`));
}
check('all mismatch decisions are fail-closed', manifest.unexpectedAssetDecision === 'DENY' && manifest.missingAssetDecision === 'DENY' && manifest.hashMismatchDecision === 'DENY');
const report = { schemaVersion: 1, step: '32-U', requirement: 'PPK-025', status: failures.length ? 'FAIL' : 'PASS', checkCount: checks.length, passed: checks.length - failures.length, failed: failures.length, checks, failures, manifestPath, manifestSha256: sha256Bytes(manifestBytes), assetCount: manifest.assets.length, assets: manifest.assets.map((item) => ({ id: item.id, version: item.version, fileName: item.fileName, source: item.source, sha256: item.sha256 })) };
await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(outputPath, prettyCanonicalJson(report));
console.log(`PPK-025 external build assets: ${report.status} (${report.passed}/${report.checkCount}, ${report.assetCount} pinned assets).`);
if (failures.length) process.exitCode = 1;
