import { access, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderLicenseRtf } from './license-rtf-lib.mjs';

const desktopRoot = resolve(process.cwd());
const packageJson = JSON.parse(await readFile(resolve(desktopRoot, 'package.json'), 'utf8'));
const build = packageJson.build ?? {};
const failures = [];
const required = [
  ['build/icon.ico', 1024],
  ['build/LICENSE_TR.txt', 100],
  ['build/LICENSE_TR.rtf', 200],
  ['dist/main/main.mjs', 1000],
  ['dist/main/preload.cjs', 1000],
  ['dist/renderer/index.html', 100]
];
for (const [file, minimum] of required) {
  try {
    await access(resolve(desktopRoot, file));
    const info = await stat(resolve(desktopRoot, file));
    if (info.size < minimum) failures.push(`${file}: dosya beklenenden küçük (${info.size} bayt).`);
  } catch { failures.push(`${file}: bulunamadı.`); }
}
if (build.appId !== 'tr.anadoluparsi.aileyasammerkezi') failures.push('build.appId geçersiz.');
if (build.win?.icon !== 'build/icon.ico') failures.push('Windows simgesi tanımlı değil.');
if (build.nsis?.oneClick !== false) failures.push('NSIS yardımcı kurulum modu etkin değil.');
if (build.nsis?.allowToChangeInstallationDirectory !== true) failures.push('Kurulum dizini seçimi etkin değil.');
if (build.nsis?.license !== 'build/LICENSE_TR.rtf') failures.push('NSIS Unicode lisans dosyası tanımlı değil.');
try {
  const sourceLicense = await readFile(resolve(desktopRoot, 'build/LICENSE_TR.txt'), 'utf8');
  const expectedRtf = renderLicenseRtf(sourceLicense);
  const licenseBytes = await readFile(resolve(desktopRoot, 'build/LICENSE_TR.rtf'));
  if ([...licenseBytes].some((byte) => byte > 0x7f)) {
    failures.push('NSIS lisans RTF dosyası ASCII dışı ham bayt içeriyor.');
  }
  const actualRtf = licenseBytes.toString('ascii').replace(/\r\n/g, '\n').trim();
  if (actualRtf !== expectedRtf) {
    failures.push('NSIS lisans RTF dosyası UTF-8 lisans kaynağıyla eşleşmiyor.');
  }
} catch (error) {
  failures.push(`NSIS lisans kodlama doğrulaması çalışmadı: ${error.message}`);
}
if (failures.length) {
  console.error('Windows installer ön doğrulaması başarısız:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Windows installer ön doğrulaması başarılı: ${packageJson.version}`);
