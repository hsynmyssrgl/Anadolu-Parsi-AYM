import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const requiredFiles = [
  'README.md',
  'docs/00_SCOPE_FREEZE.md',
  'docs/02_SECURITY_BASELINE.md',
  'packages/infrastructure/schema/001_initial.sql',
  'apps/desktop/src/main/main.ts',
  'apps/desktop/src/main/preload.ts',
  'apps/desktop/src/renderer/App.tsx'
];

for (const file of requiredFiles) await access(resolve(file));

const mainSource = await readFile('apps/desktop/src/main/main.ts', 'utf8');
for (const setting of ['nodeIntegration: false', 'contextIsolation: true', 'sandbox: true']) {
  if (!mainSource.includes(setting)) throw new Error(`Eksik güvenlik ayarı: ${setting}`);
}

const seed = await readFile('packages/test-data/src/index.ts', 'utf8');
if (!seed.includes('Deneme Ailesi')) throw new Error('Sentetik test verisi bulunamadı.');
if (/\b(?:firstName|lastName|familySurname)\b/i.test(seed)) throw new Error('Test verisi kişisel kimlik alanı taşımamalıdır.');

let artifactMode = 'source-only';
try {
  for (const file of ['apps/desktop/dist/main/main.mjs','apps/desktop/dist/main/preload.cjs','apps/desktop/dist/renderer/index.html']) await access(resolve(file));
  artifactMode = 'compiled-artifacts-present';
} catch {
  // Bronze kaynak tesliminde dist/release dosyaları bilinçli olarak paket dışıdır.
}
console.log(`Depo doğrulaması başarılı (${artifactMode}).`);
