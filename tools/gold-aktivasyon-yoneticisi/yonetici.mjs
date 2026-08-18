import { generateKeyPairSync, createPrivateKey, createPublicKey } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createGoldActivationCode } from '@ppt/security';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const argument = (name) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const requireAbsolute = (value, label) => {
  if (!value || !isAbsolute(value)) throw new Error(`${label} mutlak bir yol olmalıdır.`);
  return resolve(value);
};
const outsideRepository = (path) => {
  const rel = relative(repositoryRoot, path);
  return rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel);
};
const readTrustedKey = async (path, type) => {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || metadata.size < 64 || metadata.size > 16_384) throw new Error(`${type} anahtar dosyası güvenilir değil.`);
  const pem = await readFile(path, 'utf8');
  const key = type === 'Özel' ? createPrivateKey(pem) : createPublicKey(pem);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error(`${type} anahtar Ed25519 değil.`);
  return pem;
};
const writeExclusive = async (path, content, mode = 0o600) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, { encoding: 'utf8', flag: 'wx', mode });
};
const runApplication = (applicationPath, args) => new Promise((resolveRun, rejectRun) => {
  const child = spawn(applicationPath, args, { shell: false, windowsHide: false, stdio: 'inherit' });
  child.once('error', rejectRun);
  child.once('exit', (code, signal) => code === 0 && !signal ? resolveRun() : rejectRun(new Error(`Uygulama işlemi başarısız: exit=${String(code)}, signal=${String(signal)}`)));
});

export const runGoldActivationManager = async (command) => {
  if (command === 'anahtar-olustur') {
    const privatePath = requireAbsolute(argument('ozel-anahtar'), 'Özel anahtar yolu');
    const publicPath = requireAbsolute(argument('acik-anahtar'), 'Açık anahtar yolu');
    if (!outsideRepository(privatePath)) throw new Error('Gold özel anahtarı kod deposunun içinde oluşturulamaz.');
    const pair = generateKeyPairSync('ed25519');
    await writeExclusive(privatePath, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
    await writeExclusive(publicPath, pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(), 0o644);
    console.log(`Anahtar çifti oluşturuldu. Özel anahtar yalnız şu dış konumda: ${privatePath}`);
    return;
  }
  if (command === 'guven-anahtarini-yukle') {
    const publicPath = requireAbsolute(argument('acik-anahtar'), 'Açık anahtar yolu');
    const publicKeyPem = await readTrustedKey(publicPath, 'Açık');
    const trustPath = resolve(repositoryRoot, 'config/gold-activation-trust.json');
    const trust = JSON.parse(await readFile(trustPath, 'utf8'));
    Object.assign(trust, { status: 'PROVISIONED', publicKeyPem });
    await writeFile(trustPath, `${JSON.stringify(trust, null, 2)}\n`, 'utf8');
    console.log('Gold açık güven anahtarı paket yapılandırmasına yüklendi; özel anahtar kopyalanmadı.');
    return;
  }
  if (command === 'cihaz-bagi-al') {
    const applicationPath = requireAbsolute(argument('uygulama'), 'Uygulama yolu');
    const outputPath = requireAbsolute(argument('cikti'), 'Cihaz bağı çıktı yolu');
    await runApplication(applicationPath, [`--write-license-device-binding=${outputPath}`]);
    return;
  }
  if (command === 'kod-uret') {
    const privatePath = requireAbsolute(argument('ozel-anahtar'), 'Özel anahtar yolu');
    const bindingPath = requireAbsolute(argument('cihaz-bagi-dosyasi'), 'Cihaz bağı dosyası');
    const outputPath = requireAbsolute(argument('cikti'), 'Aktivasyon çıktı yolu');
    const licenseId = argument('lisans-kimligi');
    if (!licenseId || !/^[A-Za-z0-9_-]{8,64}$/u.test(licenseId)) throw new Error('Lisans kimliği geçersiz.');
    const privateKeyPem = await readTrustedKey(privatePath, 'Özel');
    const deviceBindingSha256 = (await readFile(bindingPath, 'utf8')).trim();
    if (!/^[a-f0-9]{64}$/u.test(deviceBindingSha256)) throw new Error('Cihaz bağı geçersiz.');
    const issuedAt = new Date().toISOString();
    const code = createGoldActivationCode({ schemaVersion: 1, productId: 'tr.anadoluparsi.aileyasammerkezi', licenseId, channel: 'Gold', deviceBindingSha256, issuedAt, perpetual: true }, privateKeyPem);
    await writeExclusive(outputPath, `${code}\n`);
    console.log(`Gold aktivasyon kodu dosyaya yazıldı: ${outputPath}`);
    return;
  }
  if (command === 'aktivasyonu-kur') {
    const applicationPath = requireAbsolute(argument('uygulama'), 'Uygulama yolu');
    const codePath = requireAbsolute(argument('kod-dosyasi'), 'Aktivasyon kodu yolu');
    await runApplication(applicationPath, [`--install-gold-activation=${codePath}`]);
    return;
  }
  throw new Error('Komut: anahtar-olustur | guven-anahtarini-yukle | cihaz-bagi-al | kod-uret | aktivasyonu-kur');
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runGoldActivationManager(process.argv[2]).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
