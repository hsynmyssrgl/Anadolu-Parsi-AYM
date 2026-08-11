import { readFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const app=await readFile(new URL('packages/application/src/archive-use-cases.ts',root),'utf8');
const adapter=await readFile(new URL('apps/desktop/src/main/archive-application-adapter.ts',root),'utf8');
const store=await readFile(new URL('apps/desktop/src/main/data-store.ts',root),'utf8');
const repo=await readFile(new URL('packages/repositories/src/archive-repository.ts',root),'utf8');
const meta=await readFile(new URL('packages/domain/src/app-meta.ts',root),'utf8');
const compact=(value)=>value.replace(/\s+/gu,'');
const checks=[
['open plan use case',app.includes('PrepareArchiveOpenUseCase')],
['opened audit use case',app.includes('RecordArchiveOpenedUseCase')],
['query port open plan',app.includes('getOpenPlan')],
['adapter authorization',compact(adapter).includes("action:'read',resourceId:itemId")],
['repository find used',compact(adapter).includes('archiveRepository.find(execution,itemId)')],
['not found mapped',adapter.includes('RESOURCE_NOT_FOUND')],
['store uses prepare use case',store.includes('#prepareArchiveOpenUseCase.execute')],
['store uses record use case',store.includes('#recordArchiveOpenedUseCase.execute')],
['direct open SQL removed',!store.includes("SELECT stored_name,sha256,original_name FROM archive_items WHERE id=?")],
['active Bronze version retained',compact(meta).includes("version:'04.08.2026.29'")]
];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(checks.some(([,ok])=>!ok)) process.exit(1);
console.log(`${checks.length}/${checks.length} PASS`);
