import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const expectedPackageVersion = '21.7.2026-40';
const expectedDisplayVersion = '21.07.2026.40';
const expectedStage = 'MVP-40 · Code Freeze';

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
if (!meta.includes(`stage: '${expectedStage}'`)) throw new Error('Code Freeze aşama etiketi eksik.');

const forbidden = /\b(TODO|FIXME|HACK|XXX)\b/;
const roots = ['apps', 'packages', 'scripts'];
const violations = [];
async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (['dist', 'node_modules', 'release'].includes(entry.name)) continue;
    const full = join(path, entry.name);
    if (full.endsWith('scripts/verify-release-freeze.mjs')) continue;
    if (entry.isDirectory()) await walk(full);
    else if (/\.(ts|tsx|js|mjs|cjs|sql)$/.test(entry.name)) {
      const text = await readFile(full, 'utf8');
      if (forbidden.test(text)) violations.push(full);
    }
  }
}
for (const root of roots) await walk(root);
if (violations.length) throw new Error(`Code Freeze işaretleri bulundu: ${violations.join(', ')}`);

const freezeDoc = await readFile('docs/03_RELEASE_FREEZE.md', 'utf8');
for (const marker of ['Code Freeze', 'MVP-40', 'kritik hata']) {
  if (!freezeDoc.includes(marker)) throw new Error(`Sürüm dondurma belgesinde eksik ifade: ${marker}`);
}
console.log('MVP-40 Code Freeze doğrulaması başarılı.');
