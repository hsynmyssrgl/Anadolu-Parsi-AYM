import { access, readdir, rmdir, stat, unlink } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const ledger = JSON.parse(await (await import('node:fs/promises')).readFile(
  new URL('../config/release-ledger.json', import.meta.url),
  'utf8'
));
const parentRelease = ledger.current?.parentRelease;
const match = /^(Bronze|Silver|Gold) (\d{2}\.\d{2}\.\d{4}\.\d+)$/u.exec(parentRelease ?? '');
if (!match) throw new Error('Haricî installer temizliği için parentRelease geçersiz.');

const [, channel, version] = match;
const libraryRoot = resolve('D:\\AYM_LIBRARY\\ParsYuva\\ParsYuva Aile Yasam Merkezi');
const target = resolve(libraryRoot, parentRelease, 'installer');
if (!target.startsWith(`${libraryRoot}${sep}`) || target === libraryRoot) {
  throw new Error('Haricî installer temizleme hedefi güvenilir kütüphane kökü dışında.');
}

let entries;
try {
  entries = await readdir(target, { withFileTypes: true });
} catch (error) {
  if (error?.code === 'ENOENT') {
    console.log(JSON.stringify({ status: 'PASS', parentRelease, target, removedCount: 0, removedBytes: 0 }));
    process.exit(0);
  }
  throw error;
}

const escapedChannel = channel.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const allowed = new RegExp(`^ParsYuva-${escapedChannel}-${escapedVersion}\\.exe(?:\\.blockmap|\\.sha256)?$`, 'u');
for (const entry of entries) {
  if (!entry.isFile() || !allowed.test(entry.name)) {
    throw new Error(`Haricî installer klasöründe beklenmeyen giriş var; silme durduruldu: ${entry.name}`);
  }
}

let removedBytes = 0;
for (const entry of entries) {
  const file = resolve(target, entry.name);
  const info = await stat(file);
  removedBytes += info.size;
  await unlink(file);
}
await rmdir(target);

try {
  await access(target);
  throw new Error('Haricî eski installer klasörü silme sonrasında hâlâ erişilebilir.');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

console.log(JSON.stringify({
  status: 'PASS',
  parentRelease,
  target,
  removedCount: entries.length,
  removedBytes
}));
