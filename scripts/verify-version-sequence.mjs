import { readFile } from 'node:fs/promises';

const ledger = JSON.parse(await readFile('config/release-ledger.json', 'utf8'));
const rootPackage = JSON.parse(await readFile('package.json', 'utf8'));
const desktopPackage = JSON.parse(await readFile('apps/desktop/package.json', 'utf8'));
const appMeta = await readFile('packages/domain/src/app-meta.ts', 'utf8');

if (ledger.product !== 'ParsYuva Aile Yaşam Merkezi') throw new Error('Sürüm defterinde ürün adı uyumsuz.');
if (!Array.isArray(ledger.entries) || ledger.entries.length < 2) throw new Error('Sürüm defteri yeterli geçmiş içermiyor.');
if (!ledger.current || typeof ledger.current !== 'object') throw new Error('Güncel sürüm kaydı eksik.');

const releaseIds = new Set();
const visibleVersions = new Set();
const packageVersions = new Set();
const previousByMonth = new Map();

for (const entry of ledger.entries) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})\.(\d+)$/.exec(entry.version);
  if (!match) throw new Error('Geçersiz kullanıcı sürümü: ' + entry.version);
  const [, day, month, year, sequenceText] = match;
  const sequence = Number(sequenceText);
  const monthKey = year + '-' + month;
  const expectedPackage = Number(day) + '.' + Number(month) + '.' + year + '-' + sequence;
  if (entry.monthlySequence !== sequence) throw new Error('Aylık sıra alanı sürümle uyuşmuyor: ' + entry.version);
  if (entry.packageVersion !== expectedPackage) throw new Error('Paket sürümü eşleşmiyor: ' + entry.version);
  if (!/^(Bronze|Silver|Gold)$/.test(entry.channel)) throw new Error('Geçersiz sürüm kanalı: ' + entry.channel);
  if (releaseIds.has(entry.releaseId)) throw new Error('Tekrarlanan releaseId: ' + entry.releaseId);
  if (visibleVersions.has(entry.version)) throw new Error('Tekrarlanan görünür sürüm: ' + entry.version);
  if (packageVersions.has(entry.packageVersion)) throw new Error('Tekrarlanan paket sürümü: ' + entry.packageVersion);
  releaseIds.add(entry.releaseId);
  visibleVersions.add(entry.version);
  packageVersions.add(entry.packageVersion);
  const previous = previousByMonth.get(monthKey);
  if (previous !== undefined && sequence !== previous + 1) {
    throw new Error('Aylık sürüm sırası kesintili: ' + monthKey + ' ' + previous + ' → ' + sequence);
  }
  previousByMonth.set(monthKey, sequence);
}

const current = ledger.current;
const matchingCurrentEntries = ledger.entries.filter((entry) =>
  entry.releaseId === current.releaseId
  && entry.version === current.version
  && entry.packageVersion === current.packageVersion
  && entry.monthlySequence === current.monthlySequence
  && entry.channel === current.channel
);
if (matchingCurrentEntries.length !== 1) throw new Error('Güncel sürümün kanonik defterde tek exact kaydı yok.');
const currentMonthKey = current.date.slice(0, 7);
const currentMonthMaximum = Math.max(
  ...ledger.entries
    .filter((entry) => entry.date?.startsWith(currentMonthKey + '-'))
    .map((entry) => entry.monthlySequence),
);
if (current.monthlySequence !== currentMonthMaximum) throw new Error('Güncel sürüm aylık defterin en yeni kaydı değil.');
if (rootPackage.version !== current.packageVersion) throw new Error('Kök paket sürümü güncel sürüm defteriyle uyuşmuyor.');
if (desktopPackage.version !== current.packageVersion) throw new Error('Desktop paket sürümü güncel sürüm defteriyle uyuşmuyor.');
if (!appMeta.includes("version: '" + current.version + "'")) throw new Error('Görünen sürüm sürüm defteriyle uyuşmuyor.');
if (!appMeta.includes("packageVersion: '" + current.packageVersion + "'")) throw new Error('APP_META paket sürümü sürüm defteriyle uyuşmuyor.');

console.log('Sürüm sırası doğrulandı: ' + current.visibleRelease + '; aylık sıra ' + current.monthlySequence + '.');
