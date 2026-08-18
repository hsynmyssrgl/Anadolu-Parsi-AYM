import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
const noWrite=process.argv.includes('--no-write');
const failures=[];let checks=0;const check=(c,m)=>{checks++;if(!c)failures.push(m)};const readJson=async p=>JSON.parse(await readFile(p,'utf8'));const exists=async p=>{try{await stat(p);return true}catch{return false}};
const ledger=await readJson('config/release-ledger.json');const current=ledger.current;
check(/^(Bronze|Silver|Gold) \d{2}\.\d{2}\.\d{4}\.\d+$/.test(current.visibleRelease),`visible release=${current.visibleRelease}`);
check(/^\d{2}\.\d{2}\.\d{4}\.\d+$/.test(current.version),`version=${current.version}`);
check(/^\d{1,2}\.\d{1,2}\.\d{4}-\d+$/.test(current.packageVersion),`packageVersion=${current.packageVersion}`);
const currentMonth=current.date.slice(0,7);
const currentMonthEntries=ledger.entries.filter(entry=>entry.date?.startsWith(`${currentMonth}-`));
const historicalCount=currentMonth==='2026-08'?ledger.august2026HistoricalCountBeforeCurrent:0;
check(Number.isInteger(current.monthlySequence)&&current.monthlySequence>0,`monthly sequence=${current.monthlySequence}`);
check(Number.isInteger(historicalCount)&&historicalCount>=0,`historical monthly count=${historicalCount}`);
check(currentMonthEntries.length>0,`no release entries found for ${currentMonth}`);
check(current.monthlySequence===historicalCount+currentMonthEntries.length,`monthly sequence ${current.monthlySequence} does not continue historical count ${historicalCount} across ${currentMonthEntries.length} current-month entries`);
check(current.monthlySequence===Math.max(...currentMonthEntries.map(entry=>entry.monthlySequence)),`current monthly sequence ${current.monthlySequence} is not the latest ${currentMonth} entry`);
check(currentMonthEntries.filter(entry=>entry.releaseId===current.releaseId&&entry.monthlySequence===current.monthlySequence&&entry.version===current.version&&entry.packageVersion===current.packageVersion).length===1,'current release does not have exactly one matching monthly ledger entry');
const manifests=['package.json'];for(const parent of ['apps','packages'])for(const e of await readdir(parent,{withFileTypes:true}))if(e.isDirectory()&&await exists(`${parent}/${e.name}/package.json`))manifests.push(`${parent}/${e.name}/package.json`);
const names=new Set();for(const p of manifests.slice(1)){names.add((await readJson(p)).name)}
for(const p of manifests){const j=await readJson(p);check(j.version===current.packageVersion,`${p} version=${j.version}`);for(const s of ['dependencies','devDependencies','peerDependencies','optionalDependencies'])for(const [n,v] of Object.entries(j[s]??{}))if(names.has(n))check(v===current.packageVersion,`${p} ${n}=${v}`)}
const lock=await readJson('package-lock.json');check(lock.version===current.packageVersion,`lock version=${lock.version}`);check(lock.packages?.['']?.version===current.packageVersion,'lock root version mismatch');for(const p of manifests.slice(1)){const key=p.replace(/\/package\.json$/,'');check(lock.packages?.[key]?.version===current.packageVersion,`lock workspace ${key}`)}
const meta=await readFile('packages/domain/src/app-meta.ts','utf8');const metaStart=meta.indexOf('export const APP_META');const metaEnd=meta.indexOf('});',metaStart);const activeMetaBlock=metaStart>=0&&metaEnd>metaStart?meta.slice(metaStart,metaEnd+3):meta;check(meta.includes(`version: '${current.version}'`),'app meta version');check(meta.includes(`releaseLabel: '${current.visibleRelease}'`),'app meta visible release');check(!/\bRC2?\b/iu.test(activeMetaBlock),'active app meta contains RC2');check(!/\bBuild\s+\d+\b/iu.test(activeMetaBlock),'active app meta contains Build label');
check(meta.includes(`releaseId: '${current.releaseId}'`),'app meta release id');check(meta.includes(`monthlySequence: ${current.monthlySequence}`),'app meta monthly sequence');
const repo=await readJson('repository-metadata.json');check(repo.visibleRelease===current.visibleRelease,'repository visible release');check(repo.packageVersion===current.packageVersion,'repository package version');check(repo.releaseId===current.releaseId,'repository release id');check(repo.monthlySequence===current.monthlySequence,'repository monthly sequence');
const report={schemaVersion:1,release:current.visibleRelease,checks,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};if(!noWrite){await mkdir('artifacts/validation',{recursive:true});await writeFile('artifacts/validation/monthly-release-contract.json',JSON.stringify(report,null,2)+'\n');}if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log(`Monthly release contract: PASS (${checks} checks / ${manifests.length-1} workspaces).`);
