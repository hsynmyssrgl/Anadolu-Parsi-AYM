import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root=process.cwd();
const read=p=>readFileSync(join(root,p),'utf8');
const app=read('packages/application/src/archive-use-cases.ts');
const repo=read('packages/repositories/src/archive-repository.ts');
const adapter=read('apps/desktop/src/main/archive-application-adapter.ts');
const store=read('apps/desktop/src/main/data-store.ts');
const compact=value=>value.replace(/\s+/gu,'');
const checks=[
 ['Search use case exists',app.includes('class SearchArchiveItemsUseCase')],
 ['Search input normalized',app.includes("toLocaleLowerCase('tr-TR')")&&app.includes('const normalized=')],
 ['Query port exposes search',app.includes('search(c:ArchiveApplicationContext,input:')],
 ['Repository search exists',compact(repo).includes('search(context:RepositoryExecutionContext')],
 ['Repository owns archive search SQL',repo.includes("group_concat(t.name,'|') tags")],
 ['Destroyed items excluded',repo.includes('WHERE a.destroyed_at IS NULL')],
 ['Adapter delegates to repository',compact(adapter).includes('archiveRepository.search(execution,input)')],
 ['Adapter applies read authorization',compact(adapter).includes("action:'read',resourceId:row.id")],
 ['DataStore delegates to use case',store.includes("#searchArchiveItemsUseCase.execute(this.#archiveApplicationContext('archive-search'),input)")],
 ['Direct search SQL removed from DataStore',!store.includes("group_concat(t.name,'|') tags FROM archive_items")]
];
let pass=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(ok)pass++;}
console.log(`${pass} / ${checks.length} PASS`);if(pass!==checks.length)process.exit(1);
