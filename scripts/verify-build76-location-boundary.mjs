import { readFileSync } from 'node:fs';
const root=new URL('../',import.meta.url); const read=p=>readFileSync(new URL(p,root),'utf8');
const ds=read('apps/desktop/src/main/data-store.ts'), app=read('packages/application/src/timeline-use-cases.ts'), repo=read('packages/repositories/src/location-repository.ts'), adapter=read('apps/desktop/src/main/timeline-application-adapter.ts'), meta=read('packages/domain/src/app-meta.ts');
const checks=[
['use case exists',app.includes('class CreateFamilyLocationUseCase')],
['validation in application',app.includes('Konum adı 2 ile 160')],
['scope insert contract',app.includes('insertLocation(location:')],
['repository insert exists',repo.includes('public insert(context: SqliteRepositoryContext')],
['adapter delegates',adapter.includes('locationRepository.insert')],
['datastore uses use case',ds.includes('#createFamilyLocationUseCase.execute')],
['direct create SQL removed',!ds.slice(ds.indexOf('public createLocation'),ds.indexOf('public createEvent')).includes('INSERT INTO locations')],
['audit in use case',app.includes("action: 'location.created'")],
['version 76',meta.includes("24.07.2026.76")],
['active development',meta.includes('Aktif Geliştirme · Build 76')]
]; checks.forEach(([n,ok])=>console.log(`${ok?'PASS':'FAIL'} ${n}`)); if(checks.some(([,ok])=>!ok))process.exit(1); console.log(`Result: ${checks.length}/${checks.length}`);
