import { readFileSync } from 'node:fs';
const read=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const app=read('packages/application/src/operational-health-use-cases.ts');
const repo=read('packages/repositories/src/diagnostic-repository.ts');
const adapter=read('apps/desktop/src/main/operational-health-application-adapter.ts');
const store=read('apps/desktop/src/main/data-store.ts');
const checks=[
 ['archive query ports',app.includes('listDiagnosticArchives(context')&&app.includes('findDiagnosticArchive(context')],
 ['archive write ports',app.includes('insertDiagnosticArchive(context')&&app.includes('deleteDiagnosticsThrough(context')],
 ['archive use cases',app.includes('class RecordDiagnosticArchiveUseCase')&&app.includes('class FindDiagnosticArchiveUseCase')],
 ['repository insert',repo.includes('insertDiagnosticArchive(c:')&&repo.includes('INSERT INTO diagnostic_archives')],
 ['repository list/find',repo.includes('listDiagnosticArchives(c:')&&repo.includes('findDiagnosticArchive(c:')],
 ['repository delete',repo.includes('deleteDiagnosticsThrough(c:')&&repo.includes('DELETE FROM diagnostic_entries WHERE occurred_at<=?')],
 ['adapter wiring',adapter.includes('listDiagnosticArchives(c:')&&adapter.includes('insertDiagnosticArchive(c:')],
 ['datastore use cases',store.includes('#recordDiagnosticArchiveUseCase')&&store.includes('#deleteDiagnosticsThroughUseCase')],
 ['direct archive SQL removed',!store.includes("prepare('SELECT * FROM diagnostic_archives")&&!store.includes("prepare('INSERT INTO diagnostic_archives")],
 ['direct archive delete removed',!store.includes("prepare('DELETE FROM diagnostic_entries WHERE occurred_at<=?')")]
];
let passed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(ok)passed++;}
console.log(`MVP-65 diagnostic archive boundary verification: ${passed}/${checks.length}`);if(passed!==checks.length)process.exit(1);
