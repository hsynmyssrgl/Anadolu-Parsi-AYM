
import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const expectedPackageVersion = '23.7.2026-41';
const expectedDisplayVersion = '23.07.2026.41';
const expectedStage = 'REVİZYON-060 · B060-M2 Foundation';
const foundationPackages = ['core', 'contracts', 'config', 'logging', 'database', 'repositories', 'events'];

const rootPackage = JSON.parse(await readFile('package.json', 'utf8'));
const desktopPackage = JSON.parse(await readFile('apps/desktop/package.json', 'utf8'));
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const meta = await readFile('packages/domain/src/app-meta.ts', 'utf8');

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
if (!meta.includes(`stage: '${expectedStage}'`)) throw new Error('Foundation aşama etiketi eksik.');

for (const packageName of foundationPackages) {
  await access(`packages/${packageName}/package.json`);
  await access(`packages/${packageName}/src/index.ts`);
  if (!lock.packages?.[`packages/${packageName}`]) throw new Error(`Kilit dosyasında workspace eksik: ${packageName}`);
}

for (const requiredFile of [
  'artifacts/manifests/BASELINE_MVP40_21.07.2026.40.json',
  'artifacts/manifests/FOUNDATION_VERIFICATION_MVP41.json',
  'artifacts/manifests/DATA_STORE_SMOKE_MVP41.json',
  'packages/core/src/result.ts',
  'packages/core/src/error.ts',
  'scripts/generate-baseline-manifest.mjs'
]) await access(requiredFile);

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
      if (full.endsWith('verify-bronze-foundation.mjs') || full.endsWith('verify-release-freeze.mjs')) continue;
      const text = await readFile(full, 'utf8');
      if (forbiddenName.test(text)) violations.push(`${full}: eski ürün adı`);
      if (forbiddenIntegration.test(text)) violations.push(`${full}: kapsam dışı yatırım entegrasyonu`);
      if (unfinishedMarker.test(text)) violations.push(`${full}: tamamlanmamış kod işareti`);
    }
  }
}
for (const root of ['apps', 'packages', 'scripts', 'tests']) await walk(root);
if (violations.length) throw new Error(`Bronze foundation gate ihlalleri: ${violations.join(', ')}`);

console.log(`Bronze MVP-41 Foundation Gate başarılı: ${foundationPackages.length} yeni workspace doğrulandı.`);
