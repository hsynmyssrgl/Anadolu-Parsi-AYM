import { randomUUID, createHash, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron';
import {
  advanceProductLicenseLedger,
  createGoldActivationCode,
  createProductLicenseLedger,
  evaluateProductLicense,
  verifyGoldActivationCode
} from '@ppt/security';

const URUN_KIMLIGI = 'tr.anadoluparsi.aileyasammerkezi';
const UYGULAMA_ADI = 'ParsYuva Gold Aktivasyon Merkezi';
const SHA256 = /^[a-f0-9]{64}$/u;
const LISANS_KIMLIGI = /^[A-Za-z0-9_-]{8,64}$/u;
const repositoryRoot = resolve(import.meta.dirname, '../..');
const repositoryTrustPath = resolve(repositoryRoot, 'config/gold-activation-trust.json');
const rendererPath = resolve(import.meta.dirname, 'arayuz/index.html');
const bindingSessions = new Map();
let lastActivation;
const diagnosticPath = process.env.PARSYUVA_GOLD_DIAGNOSTIC_PATH;
const diagnostic = (message) => {
  if (diagnosticPath && isAbsolute(diagnosticPath)) appendFileSync(diagnosticPath, `${new Date().toISOString()} ${message}\n`, { encoding: 'utf8', mode: 0o600 });
};

diagnostic('MODULE_LOADED');

app.setName(UYGULAMA_ADI);
app.setAppUserModelId('tr.parsyuva.goldaktivasyonmerkezi');
app.setPath('userData', resolve(app.getPath('appData'), 'ParsYuva', 'Gold-Aktivasyon-Merkezi'));

const vaultPath = () => resolve(app.getPath('userData'), 'gold-imza-anahtari.pyk');
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('\u0000') === [...keys].sort().join('\u0000');
const fingerprint = (publicKeyPem) => createHash('sha256')
  .update(createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' }))
  .digest('hex');

const ensureSecureDirectory = async (path) => {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const metadata = await lstat(path);
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || await realpath(path) !== resolve(path)) {
    throw new Error('Gold anahtar kasası güvenilir bir gerçek dizin değil.');
  }
};

const atomicWrite = async (path, content, exclusive = false) => {
  await ensureSecureDirectory(dirname(path));
  const temporary = `${resolve(path)}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  try {
    if (exclusive && existsSync(path)) throw new Error('Hedef dosya zaten var; üzerine yazılmadı.');
    await rename(temporary, resolve(path));
  } finally {
    await rm(temporary, { force: true });
  }
};

const validateVault = (value) => exactKeys(value, ['ciphertextBase64', 'createdAt', 'protectionId', 'publicKeyPem', 'schemaVersion'])
  && value.schemaVersion === 1
  && value.protectionId === 'electron.safeStorage'
  && typeof value.ciphertextBase64 === 'string' && value.ciphertextBase64.length <= 32_768
  && typeof value.publicKeyPem === 'string' && value.publicKeyPem.includes('BEGIN PUBLIC KEY')
  && typeof value.createdAt === 'string' && new Date(value.createdAt).toISOString() === value.createdAt;

const readVault = async () => {
  const metadata = await lstat(vaultPath());
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || metadata.size < 128 || metadata.size > 48_000) {
    throw new Error('Gold anahtar kasası güvenilir değil.');
  }
  const vault = JSON.parse(await readFile(vaultPath(), 'utf8'));
  if (!validateVault(vault) || !safeStorage.isEncryptionAvailable()) throw new Error('Gold anahtar kasası açılamadı.');
  const privateKeyPem = safeStorage.decryptString(Buffer.from(vault.ciphertextBase64, 'base64'));
  const derivedPublicKeyPem = createPublicKey(privateKeyPem).export({ type: 'spki', format: 'pem' }).toString();
  if (fingerprint(derivedPublicKeyPem) !== fingerprint(vault.publicKeyPem)) throw new Error('Gold anahtar kasası bütünlük denetiminden geçemedi.');
  return Object.freeze({ privateKeyPem, publicKeyPem: vault.publicKeyPem, createdAt: vault.createdAt });
};

const ensureVault = async () => {
  try { return await readVault(); }
  catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  if (process.platform !== 'win32' || !safeStorage.isEncryptionAvailable()) {
    throw new Error('Gold imza anahtarı yalnız Windows kullanıcı koruması kullanılabildiğinde oluşturulur.');
  }
  const pair = generateKeyPairSync('ed25519');
  const privateKeyPem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicKeyPem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const vault = Object.freeze({
    schemaVersion: 1,
    protectionId: 'electron.safeStorage',
    ciphertextBase64: safeStorage.encryptString(privateKeyPem).toString('base64'),
    publicKeyPem,
    createdAt: new Date().toISOString()
  });
  await atomicWrite(vaultPath(), `${JSON.stringify(vault, null, 2)}\n`, true);
  return readVault();
};

const readTrust = async (path = repositoryTrustPath) => {
  const value = JSON.parse(await readFile(path, 'utf8'));
  if (!exactKeys(value, ['algorithm', 'note', 'privateKeyInRepositoryAllowed', 'productId', 'publicKeyPem', 'schemaVersion', 'status'])
    || value.schemaVersion !== 1 || value.productId !== URUN_KIMLIGI || value.algorithm !== 'Ed25519'
    || value.privateKeyInRepositoryAllowed !== false || !['NOT_PROVISIONED', 'PROVISIONED'].includes(value.status)
    || (value.publicKeyPem !== null && (typeof value.publicKeyPem !== 'string' || !value.publicKeyPem.includes('BEGIN PUBLIC KEY')))) {
    throw new Error('Ana uygulamanın Gold güven dosyası geçersiz.');
  }
  return value;
};

const statusView = async () => {
  let vault;
  try { vault = await readVault(); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  let trust;
  try { trust = await readTrust(); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  const publicKeySha256 = vault ? fingerprint(vault.publicKeyPem) : undefined;
  const trustMatches = Boolean(vault && trust?.status === 'PROVISIONED' && trust.publicKeyPem
    && fingerprint(trust.publicKeyPem) === publicKeySha256);
  return Object.freeze({
    vaultReady: Boolean(vault),
    trustProvisioned: trust?.status === 'PROVISIONED',
    trustMatches,
    publicKeySha256,
    createdAt: vault?.createdAt,
    deviceBindingReady: bindingSessions.size > 0,
    activationReady: Boolean(lastActivation)
  });
};

const provisionTrust = async (targetPath) => {
  const vault = await readVault();
  const target = resolve(targetPath);
  if (basename(target) !== 'gold-activation-trust.json') throw new Error('Yalnız gold-activation-trust.json güven dosyası güncellenebilir.');
  const trust = await readTrust(target);
  const next = Object.freeze({ ...trust, status: 'PROVISIONED', publicKeyPem: vault.publicKeyPem });
  await atomicWrite(target, `${JSON.stringify(next, null, 2)}\n`);
  const readback = await readTrust(target);
  if (readback.status !== 'PROVISIONED' || !readback.publicKeyPem
    || fingerprint(readback.publicKeyPem) !== fingerprint(vault.publicKeyPem)) throw new Error('Gold güven yapılandırması doğrulanamadı.');
};

const runApplication = (applicationPath, args, detached = false) => new Promise((resolveRun, rejectRun) => {
  const child = spawn(applicationPath, args, { shell: false, windowsHide: false, stdio: 'ignore', detached });
  child.once('error', rejectRun);
  if (detached) {
    child.once('spawn', () => { child.unref(); resolveRun(); });
    return;
  }
  child.once('exit', (code, signal) => code === 0 && !signal
    ? resolveRun()
    : rejectRun(new Error(`Gold uygulaması cihaz bağı üretmedi: exit=${String(code)}, signal=${String(signal)}`)));
});

const exactInput = (value, keys) => exactKeys(value, keys);
const registerHandlers = () => {
  ipcMain.handle('gold:durum', async () => statusView());
  ipcMain.handle('gold:kasa-hazirla', async () => {
    await ensureVault();
    return statusView();
  });
  ipcMain.handle('gold:guven-yapilandir', async () => {
    const selection = await dialog.showOpenDialog({
      title: 'Ana uygulamanın Gold güven dosyasını seçin',
      defaultPath: repositoryTrustPath,
      properties: ['openFile'],
      filters: [{ name: 'Gold güven yapılandırması', extensions: ['json'] }]
    });
    if (selection.canceled || selection.filePaths.length !== 1) return { canceled: true, status: await statusView() };
    await provisionTrust(selection.filePaths[0]);
    return { canceled: false, status: await statusView() };
  });
  ipcMain.handle('gold:cihaz-bagi-al', async () => {
    const selection = await dialog.showOpenDialog({
      title: 'Kurulu ParsYuva Gold uygulamasını seçin',
      properties: ['openFile'],
      filters: [{ name: 'Windows uygulaması', extensions: ['exe'] }]
    });
    if (selection.canceled || selection.filePaths.length !== 1) return { canceled: true };
    const applicationPath = resolve(selection.filePaths[0]);
    const outputPath = resolve(app.getPath('temp'), `parsyuva-gold-cihaz-bagi-${randomUUID()}.txt`);
    try {
      await runApplication(applicationPath, [`--write-license-device-binding=${outputPath}`]);
      const value = (await readFile(outputPath, 'utf8')).trim();
      if (!SHA256.test(value)) throw new Error('Gold uygulamasından geçerli cihaz bağı alınamadı.');
      const sessionId = randomUUID();
      bindingSessions.clear();
      bindingSessions.set(sessionId, Object.freeze({ applicationPath, deviceBindingSha256: value, expiresAt: Date.now() + 10 * 60_000 }));
      return { canceled: false, sessionId, maskedBinding: `${value.slice(0, 8)}…${value.slice(-8)}` };
    } finally {
      await rm(outputPath, { force: true });
    }
  });
  ipcMain.handle('gold:kod-uret', async (_event, input) => {
    if (!exactInput(input, ['licenseId', 'sessionId']) || typeof input.licenseId !== 'string' || !LISANS_KIMLIGI.test(input.licenseId)
      || typeof input.sessionId !== 'string' || !/^[a-f0-9-]{36}$/u.test(input.sessionId)) throw new Error('Gold kod üretim girdisi geçersiz.');
    const binding = bindingSessions.get(input.sessionId);
    if (!binding || binding.expiresAt < Date.now()) throw new Error('Cihaz bağı oturumu geçersiz veya süresi dolmuş.');
    const vault = await readVault();
    const trust = await readTrust();
    if (trust.status !== 'PROVISIONED' || !trust.publicKeyPem || fingerprint(trust.publicKeyPem) !== fingerprint(vault.publicKeyPem)) {
      throw new Error('Ana uygulama güven anahtarı bu üreticiyle eşleşmiyor. Önce güven yapılandırmasını tamamlayın.');
    }
    const issuedAt = new Date().toISOString();
    const code = createGoldActivationCode({
      schemaVersion: 1, productId: URUN_KIMLIGI, licenseId: input.licenseId, channel: 'Gold',
      deviceBindingSha256: binding.deviceBindingSha256, issuedAt, perpetual: true
    }, vault.privateKeyPem);
    verifyGoldActivationCode(code, trust.publicKeyPem, binding.deviceBindingSha256, issuedAt);
    const result = await dialog.showSaveDialog({
      title: 'Gold aktivasyon dosyasını kaydedin',
      defaultPath: `ParsYuva-Gold-${input.licenseId}.parsyuva-gold`,
      filters: [{ name: 'ParsYuva Gold aktivasyonu', extensions: ['parsyuva-gold'] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    await atomicWrite(resolve(result.filePath), `${code}\n`, true);
    const readback = (await readFile(result.filePath, 'utf8')).trim();
    verifyGoldActivationCode(readback, trust.publicKeyPem, binding.deviceBindingSha256, issuedAt);
    lastActivation = Object.freeze({ code, applicationPath: binding.applicationPath, licenseId: input.licenseId, issuedAt, outputPath: resolve(result.filePath) });
    return { canceled: false, licenseId: input.licenseId, issuedAt, fileName: basename(result.filePath), verified: true };
  });
  ipcMain.handle('gold:aktivasyonu-kur', async () => {
    if (!lastActivation) throw new Error('Önce doğrulanmış bir Gold aktivasyon dosyası üretin.');
    const temporary = resolve(app.getPath('temp'), `parsyuva-gold-aktivasyon-${randomUUID()}.parsyuva-gold`);
    await atomicWrite(temporary, `${lastActivation.code}\n`, true);
    try {
      await runApplication(lastActivation.applicationPath, [`--install-gold-activation=${temporary}`], true);
    } finally {
      setTimeout(() => { void rm(temporary, { force: true }); }, 30_000);
    }
    return { launched: true, licenseId: lastActivation.licenseId };
  });
};

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#fbf8f1',
    show: false,
    title: UYGULAMA_ADI,
    autoHideMenuBar: true,
    webPreferences: {
      preload: resolve(import.meta.dirname, 'on-yukleyici.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  const capturePath = process.env.PARSYUVA_GOLD_CAPTURE_PATH;
  if (capturePath && isAbsolute(capturePath)) {
    window.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        void (async () => {
          await mkdir(dirname(capturePath), { recursive: true });
          const image = await window.webContents.capturePage();
          await writeFile(capturePath, image.toPNG(), { flag: 'wx', mode: 0o600 });
          app.exit(0);
        })().catch((error) => {
          diagnostic(`CAPTURE_ERROR ${error instanceof Error ? error.message : String(error)}`);
          app.exit(1);
        });
      }, 500);
    });
  }
  void window.loadFile(rendererPath);
};

app.whenReady().then(async () => {
  diagnostic('APP_READY');
  const provisioningArgument = process.env.PARSYUVA_GOLD_PROVISION_TRUST
    ?? process.argv.find((argument) => argument.startsWith('--ilk-guven-kurulumu='))?.slice('--ilk-guven-kurulumu='.length);
  const selfTestRequested = process.env.PARSYUVA_GOLD_SELF_TEST === '1' || process.argv.includes('--kendini-dogrula');
  if (provisioningArgument) {
    diagnostic('PROVISION_START');
    const target = resolve(provisioningArgument);
    await ensureVault();
    await provisionTrust(target);
    diagnostic('PROVISION_COMPLETE');
    app.exit(0);
  } else if (selfTestRequested) {
    diagnostic('SELF_TEST_START');
    const vault = await readVault();
    const trust = await readTrust();
    if (trust.status !== 'PROVISIONED' || !trust.publicKeyPem || fingerprint(trust.publicKeyPem) !== fingerprint(vault.publicKeyPem)) {
      throw new Error('Gold üretici ve ana uygulama güven zinciri eşleşmiyor.');
    }
    const issuedAt = new Date().toISOString();
    const deviceBindingSha256 = createHash('sha256').update(randomUUID(), 'utf8').digest('hex');
    const code = createGoldActivationCode({ schemaVersion: 1, productId: URUN_KIMLIGI, licenseId: 'PARSYUVA_GOLD_SELFTEST', channel: 'Gold', deviceBindingSha256, issuedAt, perpetual: true }, vault.privateKeyPem);
    verifyGoldActivationCode(code, trust.publicKeyPem, deviceBindingSha256, issuedAt);
    const ledger = advanceProductLicenseLedger(createProductLicenseLedger({ installationId: `selftest_${randomUUID()}`, deviceBindingSha256, installedAt: issuedAt }), issuedAt, code);
    const decision = evaluateProductLicense({ channel: 'Gold', ledger, observedAt: issuedAt, goldPublicKeyPem: trust.publicKeyPem });
    if (!decision.allowed || !decision.perpetual || decision.reason !== 'GOLD_ACTIVATION_VALID') throw new Error('Ana uygulama Gold lisans kararı üretilemedi.');
    diagnostic('SELF_TEST_COMPLETE');
    app.exit(0);
  } else {
    diagnostic('WINDOW_START');
    registerHandlers();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
    app.on('window-all-closed', () => app.quit());
  }
}).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (diagnosticPath && isAbsolute(diagnosticPath)) {
    diagnostic(`ERROR ${message}`);
  } else if (app.isReady()) {
    dialog.showErrorBox(UYGULAMA_ADI, message);
  }
  process.stderr.write(`${message}\n`);
  app.exit(1);
});
