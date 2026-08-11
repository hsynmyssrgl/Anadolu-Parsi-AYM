import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderLicenseRtf } from './license-rtf-lib.mjs';

const desktopRoot = resolve(import.meta.dirname, '..');
const source = await readFile(resolve(desktopRoot, 'build/LICENSE_TR.txt'), 'utf8');
const expected = renderLicenseRtf(source);
const bytes = await readFile(resolve(desktopRoot, 'build/LICENSE_TR.rtf'));
const failures = [];
if ([...bytes].some((byte) => byte > 0x7f)) failures.push('LICENSE_TR.rtf ASCII dışı ham bayt içeriyor.');
const actual = bytes.toString('ascii').replace(/\r\n/g, '\n').trim();
if (actual !== expected) failures.push('LICENSE_TR.rtf, LICENSE_TR.txt kaynağından deterministik üretilmiş güncel içerikle eşleşmiyor.');
if (failures.length) {
  console.error('NSIS lisans senkronizasyon doğrulaması başarısız:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('NSIS lisans TXT/RTF senkronizasyonu başarılı.');
