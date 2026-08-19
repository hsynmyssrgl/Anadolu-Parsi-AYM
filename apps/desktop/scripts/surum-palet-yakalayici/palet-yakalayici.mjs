import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { app, BrowserWindow } from 'electron';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const stylesPath = resolve(repositoryRoot, 'apps/desktop/src/renderer/styles.css');
const logoPath = resolve(repositoryRoot, 'apps/desktop/src/renderer/assets/brand-mark.png');
const visualManifestPath = resolve(repositoryRoot, 'config/ui-visual-reference-manifest.json');
const outputRoot = resolve(repositoryRoot, 'apps/desktop/tests/fixtures/surum-paletleri');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const channels = Object.freeze([
  Object.freeze({ key: 'bronze', label: 'Bronze', fileName: 'bronze-palet-ekran-goruntusu.png' }),
  Object.freeze({ key: 'silver', label: 'Silver', fileName: 'silver-palet-ekran-goruntusu.png' }),
  Object.freeze({ key: 'gold', label: 'Gold', fileName: 'gold-palet-ekran-goruntusu.png' })
]);

const styles = await readFile(stylesPath, 'utf8');
const logoData = (await readFile(logoPath)).toString('base64');
const rawVisualManifest = await readFile(visualManifestPath);
const visualManifest = JSON.parse(rawVisualManifest.toString('utf8'));
await mkdir(outputRoot, { recursive: true });
app.on('window-all-closed', () => {});

const html = (channel) => `<!doctype html>
<html lang="tr" data-release-channel="${channel.key}"><head><meta charset="utf-8">
<meta name="color-scheme" content="light"><style>${styles}</style></head>
<body><div class="app-shell" data-theme="light" data-release-channel="${channel.key}" data-high-contrast="false" data-reduce-motion="true">
  <aside class="sidebar">
    <div class="window-brand"><img src="data:image/png;base64,${logoData}" width="34" height="34" alt=""><div><strong>ParsYuva AYM</strong><small>${channel.label} kanal</small></div></div>
    <div class="family-switcher"><span class="family-icon">⌂</span><div><small>YEREL AİLE ALANI</small><strong>Örnek içermeyen güvenli görünüm</strong></div><span>⌄</span></div>
    <nav aria-label="Örnek gezinme">
      <button class="active"><span>⌂</span>Genel görünüm<i></i></button>
      <button><span>♙</span>Aile bireyleri<i></i></button>
      <button><span>◇</span>Arşiv<i></i></button>
      <button><span>◎</span>Yardım<i></i></button>
    </nav>
    <div class="sidebar-footer"><div class="sync-state"><span>✓</span><div><strong>Veriler bu bilgisayarda</strong><small>Ağ kullanılmıyor</small></div><i>✓</i></div><div class="edition-line"><span>${channel.label}</span><span>19.08.2026.33</span></div></div>
  </aside>
  <section class="main-area"><header class="topbar"><div class="breadcrumb"><span>⌂</span>Genel görünüm</div><div class="topbar-center">${channel.label} palet doğrulaması</div><div class="topbar-actions"><button class="button">Yardım</button><button class="button primary">Yeni kayıt</button></div></header>
  <main class="page-content"><header class="page-header"><div><span class="eyebrow">YEREL VE ÖZEL</span><h1>${channel.label} arayüz paleti</h1><p>Metin, kontrol, odak, kart ve saydam yüzey tokenları etkin sürüm kanalından gelir.</p></div></header>
    <article class="welcome-panel panel"><div class="welcome-copy"><span class="eyebrow">PARSYUVA AYM</span><h2>Ailenizin hikâyesi, tek ve güvenli bir yerde.</h2><p>Bu ekran yalnız görsel regresyon içindir; kişisel veya örnek kullanıcı verisi içermez.</p><div class="welcome-actions"><button class="button primary">Ana eylem</button><button class="button">İkincil eylem</button></div></div><div class="welcome-mark"><span>◆</span><i></i><span>◇</span></div></article>
    <section class="metric-grid"><article class="metric-card"><span class="metric-icon green">✓</span><div><small>Kontrast</small><strong>AA</strong><p>Metin ve kontroller</p></div></article><article class="metric-card"><span class="metric-icon amber">◉</span><div><small>Kanal</small><strong>${channel.label}</strong><p>Tek merkezi token zinciri</p></div></article><article class="metric-card"><span class="metric-icon blue">⌨</span><div><small>Odak</small><strong>3:1</strong><p>Klavye görünürlüğü</p></div></article><article class="metric-card"><span class="metric-icon red">⊘</span><div><small>Ağ</small><strong>Kapalı</strong><p>Yerel yakalama</p></div></article></section>
  </main></section>
</div></body></html>`;

await app.whenReady();
const entries = [];
let currentStage = 'uygulama-hazir';
try {
  for (const channel of channels) {
    currentStage = `${channel.key}:pencere-olustur`;
    const window = new BrowserWindow({
      width: 1280,
      height: 800,
      useContentSize: true,
      show: false,
      backgroundColor: visualManifest.releaseChannelSurfacePalettes[channel.label].background,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        backgroundThrottling: false
      }
    });
    window.setMenuBarVisibility(false);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const filter = { urls: ['http://*/*', 'https://*/*'] };
    window.webContents.session.webRequest.onBeforeRequest(filter, (_details, callback) => callback({ cancel: true }));
    const temporaryHtmlPath = resolve(outputRoot, `.${channel.key}-palet-yakalama.html`);
    currentStage = `${channel.key}:html-yaz`;
    await writeFile(temporaryHtmlPath, html(channel), { flag: 'w', mode: 0o600 });
    currentStage = `${channel.key}:html-yukle`;
    await window.loadFile(temporaryHtmlPath);
    window.webContents.setZoomFactor(1);
    currentStage = `${channel.key}:font-bekle`;
    await window.webContents.executeJavaScript('document.fonts.ready.then(() => true)', true);
    currentStage = `${channel.key}:token-oku`;
    const computedTokens = await window.webContents.executeJavaScript(`(() => {
      const style=getComputedStyle(document.querySelector('.app-shell'));
      return Object.fromEntries(['background','panel','panel-secondary','text','muted','border','accent','accent-soft','accent-edge','accent-strong','primary','primary-hover','focus'].map((name)=>[name,style.getPropertyValue('--release-'+name).trim().toUpperCase()]));
    })()`, true);
    currentStage = `${channel.key}:ekran-yakala`;
    const image = await window.webContents.capturePage({ x: 0, y: 0, width: 1280, height: 800 });
    const png = image.toPNG();
    const outputPath = resolve(outputRoot, channel.fileName);
    currentStage = `${channel.key}:png-yaz`;
    await writeFile(outputPath, png, { flag: 'w', mode: 0o600 });
    entries.push(Object.freeze({
      channel: channel.label,
      path: `apps/desktop/tests/fixtures/surum-paletleri/${channel.fileName}`,
      sha256: sha256(png),
      width: image.getSize().width,
      height: image.getSize().height,
      bytes: png.byteLength,
      computedTokens
    }));
    window.destroy();
    currentStage = `${channel.key}:gecici-html-sil`;
    await rm(temporaryHtmlPath, { force: true });
  }
} catch (error) {
  app.exit(1);
  throw new Error(`${currentStage}: ${error?.stack ?? String(error)}`);
}

const output = Object.freeze({
  schemaVersion: 1,
  id: 'PARSYUVA-AYM-SURUM-PALET-EKRAN-GORUNTULERI-V1',
  renderer: 'electron-capturePage',
  platform: process.platform,
  electronVersion: process.versions.electron,
  viewport: Object.freeze({ width: 1280, height: 800, zoomFactor: 1, deviceScaleFactor: 1 }),
  networkUsed: false,
  userOrDemoDataIncluded: false,
  sourceCssSha256: sha256(Buffer.from(styles, 'utf8')),
  visualManifestSha256: sha256(rawVisualManifest),
  entries: Object.freeze(entries)
});
await writeFile(resolve(outputRoot, 'PALET_EKRAN_GORUNTUSU_MANIFESTI.json'), `${JSON.stringify(output, null, 2)}\n`, { flag: 'w', mode: 0o600 });
process.stdout.write(`Surum palet ekran goruntuleri: PASS (${entries.length}/${entries.length}).\n`);
app.exit(0);
