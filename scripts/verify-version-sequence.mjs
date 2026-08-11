import { readFile } from 'node:fs/promises';

const ledger = JSON.parse(await readFile('artifacts/manifests/VERSION_LEDGER.json', 'utf8'));
const rootPackage = JSON.parse(await readFile('package.json', 'utf8'));
const desktopPackage = JSON.parse(await readFile('apps/desktop/package.json', 'utf8'));
const appMeta = await readFile('packages/domain/src/app-meta.ts', 'utf8');

if (ledger.product !== 'Anadolu Parsı Aile Yaşam Merkezi') throw new Error('Sürüm defterinde ürün adı uyumsuz.');
if (ledger.channel !== 'Bronze') throw new Error('Sürüm defteri Bronze kanalında olmalıdır.');
if (ledger.sequenceScope !== 'project') throw new Error('Sürüm sırası proje genelinde kesintisiz tutulmalıdır.');
if (!Array.isArray(ledger.entries) || ledger.entries.length < 2) throw new Error('Sürüm defteri yeterli geçmiş içermiyor.');

let previous;
for (const entry of ledger.entries) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})\.(\d+)$/.exec(entry.version);
  if (!match) throw new Error(`Geçersiz kullanıcı sürümü: ${entry.version}`);
  const [, day, month, year, sequenceText] = match;
  const sequence = Number(sequenceText);
  if (entry.sequence !== sequence) throw new Error(`Sıra alanı sürümle uyuşmuyor: ${entry.version}`);
  const expectedPackage = `${Number(day)}.${Number(month)}.${year}-${sequence}`;
  if (entry.packageVersion !== expectedPackage) throw new Error(`Paket sürümü eşleşmiyor: ${entry.version}`);
  if (previous && sequence !== previous.sequence + 1) {
    throw new Error(`Proje build sırası kesintili: ${previous.version} → ${entry.version}`);
  }
  previous = entry;
}

const current = ledger.entries.at(-1);
if (rootPackage.version !== current.packageVersion) throw new Error('Kök paket sürümü sürüm defterinin son kaydıyla uyuşmuyor.');
if (desktopPackage.version !== current.packageVersion) throw new Error('Desktop paket sürümü sürüm defterinin son kaydıyla uyuşmuyor.');
if (!appMeta.includes(`version: '${current.version}'`)) throw new Error('Görünen sürüm sürüm defteriyle uyuşmuyor.');
if (!appMeta.includes(`packageVersion: '${current.packageVersion}'`)) throw new Error('APP_META paket sürümü sürüm defteriyle uyuşmuyor.');

console.log(`Sürüm sırası doğrulandı: ${current.version}; proje build sırası ${current.sequence}.`);
