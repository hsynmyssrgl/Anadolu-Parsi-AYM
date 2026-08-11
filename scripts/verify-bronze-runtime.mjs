import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const expectedPackageVersion = '24.7.2026-56';
const expectedDisplayVersion = ACTIVE_BUILD_META.applicationVersion;
const expectedStage = 'REVİZYON-060 · B060-M16 Document Archive & Versioning Application Migration';
const foundationPackages = ['core', 'contracts', 'config', 'logging', 'database', 'repositories', 'events'];
const rootPackage = JSON.parse(await readFile('package.json', 'utf8'));
const desktopPackage = JSON.parse(await readFile('apps/desktop/package.json', 'utf8'));
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const meta = await readFile('packages/domain/src/app-meta.ts', 'utf8');
const main = await readFile('apps/desktop/src/main/main.ts', 'utf8');
const preload = await readFile('apps/desktop/src/main/preload.ts', 'utf8');

for (const [label, value] of [
  ['kök paket', rootPackage.version],
  ['masaüstü paket', desktopPackage.version],
  ['kilit dosyası', lock.version],
  ['kilit kök paketi', lock.packages?.['']?.version],
  ['kilit masaüstü paketi', lock.packages?.['apps/desktop']?.version]
]) {
  if (value !== expectedPackageVersion) throw new Error(`${label} sürümü uyumsuz: ${value ?? 'yok'}`);
}
if (!meta.includes(`version: '${expectedDisplayVersion}'`)) throw new Error('Görünen uygulama sürümü uyumsuz.');
if (!meta.includes(`packageVersion: '${expectedPackageVersion}'`)) throw new Error('APP_META paket sürümü uyumsuz.');
if (!meta.includes(`stage: '${expectedStage}'`)) throw new Error('Runtime aşama etiketi eksik.');

for (const packageName of foundationPackages) {
  await access(`packages/${packageName}/package.json`);
  await access(`packages/${packageName}/src/index.ts`);
  if (!lock.packages?.[`packages/${packageName}`]) throw new Error(`Kilit dosyasında workspace eksik: ${packageName}`);
}
for (const dependency of ['@ppt/core', '@ppt/config', '@ppt/logging']) {
  if (desktopPackage.dependencies?.[dependency] !== '2.1.0') throw new Error(`Desktop runtime bağımlılığı eksik: ${dependency}`);
}
for (const requiredFile of [
  'apps/desktop/src/main/runtime-bootstrap.ts',
  'apps/desktop/src/main/ipc-runtime.ts',
  'artifacts/manifests/RUNTIME_FOUNDATION_VERIFICATION_MVP42.json',
  'artifacts/manifests/DATA_STORE_SMOKE_MVP42.json',
  'packages/logging/src/index.ts'
]) await access(requiredFile);

const mainChannels = [...main.matchAll(/registerIpcHandler\(\s*['"]([^'"]+)/g)].map((match) => match[1]);
const preloadChannels = [...preload.matchAll(/ipcRenderer\.invoke\(\s*['"]([^'"]+)/g)].map((match) => match[1]);
if (mainChannels.length !== 128) throw new Error(`IPC handler sayısı 128 olmalı: ${mainChannels.length}`);
if (preloadChannels.length !== 128) throw new Error(`Preload invoke sayısı 128 olmalı: ${preloadChannels.length}`);
const missing = preloadChannels.filter((channel) => !mainChannels.includes(channel));
if (missing.length) throw new Error(`Main tarafında eksik IPC kanalları: ${missing.join(', ')}`);
if (main.includes('ipcMain.handle(')) throw new Error('Main process correlation wrapper dışında doğrudan ipcMain.handle kullanamaz.');
if (!main.includes('current.config.paths.data')) throw new Error('SQLite yolu merkezi configuration üzerinden kurulmamış.');
if (!main.includes('createRuntimeCorrelationId')) throw new Error('Runtime correlation entegrasyonu eksik.');

const forbiddenName = /Anadolu Pars[ıi]/i;
const forbiddenIntegration = /(Matriks|İş Yatırım|Is Yatirim|Deniz Yatırım|Deniz Yatirim|\bbroker\b|otomatik emir)/i;
const unfinishedMarker = /\b(TODO|FIXME|HACK|XXX)\b/;
const violations = [];
async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (['dist', 'node_modules', 'release', '.tmp'].includes(entry.name)) continue;
    const full = join(path, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (/\.(ts|tsx|js|mjs|cjs|sql)$/.test(entry.name)) {
      if (full.startsWith('scripts/verify-') || full.endsWith('verify-bronze-runtime.mjs') || full.endsWith('verify-bronze-foundation.mjs') || full.endsWith('verify-release-freeze.mjs')) continue;
      const text = await readFile(full, 'utf8');
      if (forbiddenName.test(text)) violations.push(`${full}: eski ürün adı`);
      if (forbiddenIntegration.test(text)) violations.push(`${full}: kapsam dışı yatırım entegrasyonu`);
      if (unfinishedMarker.test(text)) violations.push(`${full}: tamamlanmamış kod işareti`);
    }
  }
}
for (const root of ['apps', 'packages', 'scripts', 'tests']) await walk(root);
if (violations.length) throw new Error(`Bronze runtime gate ihlalleri: ${violations.join(', ')}`);
console.log(`Bronze MVP-55 Runtime Gate başarılı: ${mainChannels.length} IPC kanalı correlation kapsamındadır.`);
