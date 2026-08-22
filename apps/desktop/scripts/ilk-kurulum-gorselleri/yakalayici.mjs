import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { app, BrowserWindow } from 'electron';

const outputRoot = process.env.PPT_FIRST_SETUP_CAPTURE_OUTPUT
  ?? 'C:\\PPT\\AYM\\05_TEST\\DOSYALAR\\01_ILK_KURULUM_GORSELLERI_20260820';
const baseUrl = process.env.PPT_FIRST_SETUP_PREVIEW_URL ?? 'http://127.0.0.1:4178/';
const viewportWidth = Number.parseInt(process.env.PPT_FIRST_SETUP_CAPTURE_WIDTH ?? '1560',10);
const viewportHeight = Number.parseInt(process.env.PPT_FIRST_SETUP_CAPTURE_HEIGHT ?? '960',10);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const pause = (milliseconds) => new Promise((resolvePause) => setTimeout(resolvePause,milliseconds));

await app.whenReady();
await mkdir(outputRoot,{recursive:true});
const window = new BrowserWindow({
  width:viewportWidth,height:viewportHeight,show:false,backgroundColor:'#f4f3f0',
  titleBarStyle:'hidden',titleBarOverlay:{color:'#F7F3ED',symbolColor:'#5B5148',height:42},roundedCorners:true,
  webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,partition:`temp:parsyuva-ilk-kurulum-${Date.now()}`}
});

const load = async (query) => {
  await window.loadURL(`${baseUrl}${query}`);
  await window.webContents.executeJavaScript(`(()=>{const style=document.createElement('style');style.dataset.captureOnly='true';style.textContent='*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}';document.head.append(style);})()`,true);
  await pause(300);
};
const capture = async (fileName) => {
  const image=await window.webContents.capturePage();
  const bytes=image.toPNG();
  const path=resolve(outputRoot,fileName);
  await writeFile(path,bytes,{flag:'w',mode:0o600});
  return {fileName,path,sha256:sha256(bytes),bytes:bytes.byteLength,width:image.getSize().width,height:image.getSize().height};
};

await load('?ui-language=tr');
const introduction=await capture('01_TURKCE_ILK_TANITIM_EKRANI.png');

await window.webContents.executeJavaScript("localStorage.setItem('ppt-first-run-intro-v1','1')",true);
await load('?ui-language=tr');
const setup=await capture('02_TURKCE_AILE_VE_PAROLA_KURULUM_EKRANI.png');

await window.webContents.executeJavaScript("localStorage.removeItem('ppt-menu-narration-v1:tr:dashboard')",true);
await load('?shell-preview&ui-language=tr&menu-narration-preview');
const menuNarration=await capture('03_TURKCE_ILK_MENU_SESLI_ANLATIMI.png');

await window.webContents.executeJavaScript("localStorage.clear()",true);
await load('?ui-language=en');
const englishIntroduction=await capture('04_INGILIZCE_ILK_TANITIM_EKRANI.png');

const manifest={schemaVersion:1,product:'ParsYuva Aile Yaşam Merkezi',generatedAt:new Date().toISOString(),viewport:{width:viewportWidth,height:viewportHeight},networkUsed:false,userDataIncluded:false,audioOutputMutedDuringCapture:true,captures:[introduction,setup,menuNarration,englishIntroduction]};
await writeFile(resolve(outputRoot,'05_ILK_KURULUM_GORSEL_MANIFESTI.json'),`${JSON.stringify(manifest,null,2)}\n`,{flag:'w',mode:0o600});
window.destroy();
process.stdout.write(`Ilk kurulum gorselleri: PASS (${manifest.captures.length}/${manifest.captures.length})\n`);
app.exit(0);
