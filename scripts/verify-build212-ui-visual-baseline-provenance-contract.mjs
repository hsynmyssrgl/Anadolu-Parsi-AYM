import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const failures=[]; const checks=[];
const check=(condition,label,actual)=>{checks.push({label,status:condition?'PASS':'FAIL',actual}); if(!condition) failures.push(`${label}: ${actual??'failed'}`)};
const manifest=JSON.parse(await readFile('config/ui-visual-reference-manifest.json','utf8'));
const expectedHash='f2f2a083fb74a50fc31459c8236eff9be74e01f9b359c5889fdb740395850357';
const active='docs/ui/UI_VISUAL_REFERENCE_MANIFESTO_ACTIVE.png';
let bytes; try{bytes=await readFile(active)}catch{bytes=null}
check(manifest.id==='PPT-UI-VISUAL-BASELINE-V2','manifest id',manifest.id);
check(manifest.effectiveBuild===212,'effective build',manifest.effectiveBuild);
check(manifest.image===active,'active image path',manifest.image);
check(Boolean(bytes),'active image exists',Boolean(bytes));
const actualHash=bytes?createHash('sha256').update(bytes).digest('hex'):null;
check(actualHash===expectedHash,'approved image hash',actualHash);
check(manifest.imageSha256===expectedHash,'manifest pinned hash',manifest.imageSha256);
check(manifest.imageDimensions?.width===1491 && manifest.imageDimensions?.height===1055,'approved dimensions',JSON.stringify(manifest.imageDimensions));
check(manifest.logoSubject==='Anadolu parsı esintili ParsYuva işareti','approved ParsYuva mark subject',manifest.logoSubject);
check(manifest.approvedReferenceCharacteristics?.theme==='light','approved light theme',manifest.approvedReferenceCharacteristics?.theme);
check(manifest.shell?.background==='#F4F3F0','light baseline shell background',manifest.shell?.background);
check(manifest.shell?.panel==='#FDFDFC','light baseline panel',manifest.shell?.panel);
check(manifest.shell?.text==='#333537','light baseline text',manifest.shell?.text);
check(manifest.shell?.primary==='#467259','approved primary green',manifest.shell?.primary);
check(manifest.productionPersonalOrDemoContentAllowed===false,'production demo data remains forbidden',manifest.productionPersonalOrDemoContentAllowed);
check(manifest.illustrativeMockContent?.bindingAsUserData===false,'illustrative mock data is non-binding',manifest.illustrativeMockContent?.bindingAsUserData);
check(manifest.illustrativeMockContent?.authorizesProductionSeedOrDemoData===false,'visual does not authorize seed data',manifest.illustrativeMockContent?.authorizesProductionSeedOrDemoData);
check(manifest.driftProtection?.hashPinned===true,'hash drift protection enabled',manifest.driftProtection?.hashPinned);
check(manifest.driftProtection?.legacyIncorrectBaselineSha256==='637087594134b257105011990dc5de38ee90cc46fc6307565cad6df62fbc35f7','legacy wrong baseline hash recorded',manifest.driftProtection?.legacyIncorrectBaselineSha256);
let oldActive=false; try{await stat('docs/ui/UI_VISUAL_REFERENCE_MANIFESTO_BUILD208.png');oldActive=true}catch{}
check(oldActive===false,'legacy wrong image removed from active path',oldActive);
const uiDoc=await readFile('docs/ui/UI_VISUAL_REFERENCE_MANIFESTO.md','utf8');
check(uiDoc.includes(expectedHash),'UI manifesto doc pins approved hash','hash-reference');
check(uiDoc.includes('UI_VISUAL_REFERENCE_MANIFESTO_ACTIVE.png'),'UI manifesto doc points to active approved image','path-reference');
const standard=await readFile('docs/13_UI_UX_ACCESSIBILITY_STANDARD.md','utf8');
check(standard.includes('UI_VISUAL_REFERENCE_MANIFESTO_ACTIVE.png'),'UI/UX standard points to active image','standard-reference');
const report={schemaVersion:1,build:212,scope:'Approved post-2026-07-20 UI visual baseline provenance and hash pinning',expectedHash,actualHash,checks:checks.length,passed:checks.filter(x=>x.status==='PASS').length,status:failures.length?'FAIL':'PASS',failures,results:checks,generatedAt:new Date().toISOString()};
await mkdir('artifacts/validation',{recursive:true});
await writeFile('artifacts/validation/build212-ui-visual-baseline-provenance-contract.json',JSON.stringify(report,null,2)+'\n');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`Build 212 UI visual baseline provenance: PASS (${checks.length}/${checks.length})`);
