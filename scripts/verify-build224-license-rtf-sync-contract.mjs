import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { renderLicenseRtf } from '../apps/desktop/scripts/license-rtf-lib.mjs';

const packageJson=JSON.parse(await readFile('apps/desktop/package.json','utf8'));
const generator=await readFile('apps/desktop/scripts/generate-license-rtf.mjs','utf8');
const verifier=await readFile('apps/desktop/scripts/verify-license-rtf-sync.mjs','utf8');
const installerVerifier=await readFile('apps/desktop/scripts/verify-installer.mjs','utf8');
const library=await readFile('apps/desktop/scripts/license-rtf-lib.mjs','utf8');
const source=await readFile('apps/desktop/docs/LISANS_TR_KAYNAK.txt','utf8');
const rtfBytes=await readFile('apps/desktop/build/LICENSE_TR.rtf');
const actual=rtfBytes.toString('ascii').replace(/\r\n/g,'\n').trim();
const expected=renderLicenseRtf(source);
const sha=(value)=>createHash('sha256').update(value).digest('hex');
const checks=[];const add=(id,c,d)=>checks.push({id,status:c?'PASS':'FAIL',...(d===undefined?{}:{details:d})});
add('desktop-version',packageJson.version==='2.8.2026-224');
add('sync-script',packageJson.scripts?.['sync:license:rtf']==='node scripts/generate-license-rtf.mjs');
add('verify-sync-script',packageJson.scripts?.['verify:license-sync']==='node scripts/verify-license-rtf-sync.mjs');
for (const key of ['package:win','package:win:dir']) {
  const script=packageJson.scripts?.[key]??'';
  add(`${key}-has-sync-verifier`,script.includes('npm run verify:license-sync'));
  add(`${key}-verify-before-build`,script.indexOf('npm run verify:license-sync')>=0&&script.indexOf('npm run verify:license-sync')<script.indexOf('npm run build'));
  add(`${key}-no-silent-sync`,!script.includes('npm run sync:license:rtf'));
  add(`${key}-installer-verifier`,script.includes('npm run verify:installer --workspace @ppt/desktop'));
}
add('verify-workflow-license-gate',(packageJson.scripts?.verify??'').startsWith('npm run verify:license-sync'));
add('generator-shared-renderer',generator.includes("import { renderLicenseRtf } from './license-rtf-lib.mjs';"));
add('generator-ascii-write',generator.includes("writeFile(resolve(desktopRoot, 'build/LICENSE_TR.rtf'), rtf, 'ascii')"));
add('verifier-shared-renderer',verifier.includes("import { renderLicenseRtf } from './license-rtf-lib.mjs';"));
add('verifier-ascii-raw-byte-check',verifier.includes('byte > 0x7f'));
add('verifier-exact-equality',verifier.includes('actual !== expected'));
add('installer-shared-renderer',installerVerifier.includes("import { renderLicenseRtf } from './license-rtf-lib.mjs';"));
add('installer-no-duplicate-encoder',!installerVerifier.includes('const encodeRtf'));
add('library-normalizes-bom',library.includes("replace(/^\\uFEFF/, '')"));
add('library-normalizes-crlf',library.includes("replace(/\\r\\n/g, '\\n')"));
add('library-escapes-backslash',library.includes("character === '\\\\'"));
add('library-escapes-braces',library.includes("character === '{'")&&library.includes("character === '}'"));
add('library-encodes-newline',library.includes("character === '\\n'"));
add('library-unicode-escape',library.includes('codePoint > 32767 ? codePoint - 65536 : codePoint'));
add('library-rtf-header',library.includes('\\\\rtf1\\\\ansi\\\\ansicpg1254'));
add('source-hash',sha(Buffer.from(source,'utf8'))==='f9dac9ce24bfa4be18cdcc6336c6ccea1419f27f52ee282a73e6ea4893d686d6');
add('rtf-hash',sha(rtfBytes)==='0d781ca2e3cd920e8204f345d62aea6dea06df6b8a2cfbb277b2f9fef604fbc1');
add('rtf-ascii-only',[...rtfBytes].every(byte=>byte<=0x7f));
add('rtf-exact-render',actual===expected);
add('stale-build223-rtf-removed',sha(rtfBytes)!=='235e92f934fccd257f5a6302bedbe4355cdc866ff198ad29ab57f56df63f81ce');
const ok=checks.every(c=>c.status==='PASS');
await import('node:fs/promises').then(({mkdir,writeFile})=>mkdir('artifacts/validation',{recursive:true}).then(()=>writeFile('artifacts/validation/build224-license-rtf-sync-contract.json',JSON.stringify({schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',applicationVersion:'02.08.2026.224',packageVersion:'2.8.2026-224',build:224,status:ok?'PASS':'FAIL',checks:checks.length,passCount:checks.filter(c=>c.status==='PASS').length,results:checks,generatedAt:new Date().toISOString()},null,2)+'\n')));
console.log(`Build224 license RTF sync contract: ${ok?'PASS':'FAIL'} (${checks.filter(c=>c.status==='PASS').length}/${checks.length}).`);
if(!ok){console.error(JSON.stringify(checks.filter(c=>c.status==='FAIL'),null,2));process.exitCode=1;}
