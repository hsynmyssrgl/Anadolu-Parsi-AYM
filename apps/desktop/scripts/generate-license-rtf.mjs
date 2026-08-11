import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderLicenseRtf } from './license-rtf-lib.mjs';

const desktopRoot = resolve(import.meta.dirname, '..');
const source = await readFile(resolve(desktopRoot, 'build/LICENSE_TR.txt'), 'utf8');
const rtf = renderLicenseRtf(source);
await writeFile(resolve(desktopRoot, 'build/LICENSE_TR.rtf'), rtf, 'ascii');
console.log('LICENSE_TR.rtf güncellendi.');
