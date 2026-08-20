import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot=resolve(import.meta.dirname,'../../..');
const electronExecutable=resolve(repositoryRoot,'node_modules/electron/dist/electron.exe');
const entrypoint=resolve(import.meta.dirname,'ilk-kurulum-gorselleri/yakalayici.cjs');
if(!existsSync(electronExecutable))throw new Error(`Electron bulunamadi: ${electronExecutable}`);
if(!existsSync(entrypoint))throw new Error(`Gorsel yakalayici bulunamadi: ${entrypoint}`);
const child=spawn(electronExecutable,['--disable-gpu','--disable-gpu-sandbox','--force-device-scale-factor=1',entrypoint],{cwd:repositoryRoot,windowsHide:true,stdio:'inherit',env:{...process.env,PPT_FIRST_SETUP_PREVIEW_URL:process.env.PPT_FIRST_SETUP_PREVIEW_URL??'http://127.0.0.1:4178/'}});
const exitCode=await new Promise((resolveExit,rejectExit)=>{
  const timeout=setTimeout(()=>{if(child.pid)spawnSync('taskkill.exe',['/pid',String(child.pid),'/t','/f'],{windowsHide:true,stdio:'ignore'});rejectExit(new Error('Ilk kurulum gorselleri 45 saniyede tamamlanmadi.'));},45_000);
  child.once('error',(error)=>{clearTimeout(timeout);rejectExit(error);});
  child.once('exit',(code)=>{clearTimeout(timeout);resolveExit(code??1);});
});
if(exitCode!==0)throw new Error(`Ilk kurulum gorsel yakalama cikis kodu: ${exitCode}`);
