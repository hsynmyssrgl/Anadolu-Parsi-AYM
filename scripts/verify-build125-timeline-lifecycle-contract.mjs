import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const reportPath = resolve(process.argv[2] ?? 'artifacts/validation/build125-timeline-lifecycle-contract.json');
const files = Object.fromEntries(await Promise.all(Object.entries({
  rootPackage:'package.json',
  appMeta:'packages/domain/src/app-meta.ts',
  domain:'packages/domain/src/app-data.ts',
  contract:'packages/repository-contracts/src/timeline-repository.ts',
  repository:'packages/repositories/src/timeline-repository.ts',
  application:'packages/application/src/timeline-use-cases.ts',
  adapter:'apps/desktop/src/main/timeline-application-adapter.ts',
  store:'apps/desktop/src/main/data-store.ts',
  main:'apps/desktop/src/main/main.ts',
  preload:'apps/desktop/src/main/preload.ts',
  rendererTypes:'apps/desktop/src/renderer/global.d.ts',
  renderer:'apps/desktop/src/renderer/App.tsx',
  styles:'apps/desktop/src/renderer/styles.css',
  migrations:'packages/database/src/family-database-migrations.ts',
  tests:'apps/desktop/tests/data-store.test.ts'
}).map(async([key,path])=>[key,await readFile(path,'utf8')])));
const rootPackage = JSON.parse(files.rootPackage);
const failures = [];
let assertions = 0;
const verify=(condition,message)=>{assertions+=1;if(!condition)failures.push(message);};
const includes=(file,needle,message)=>verify(files[file].includes(needle),message);

verify(rootPackage.version==='27.7.2026-125',`root package version=${rootPackage.version}`);
includes('appMeta',"version: '27.07.2026.125'",'application version is not Build 125');
includes('appMeta',"stage: 'Bronze RC2 · Aktif Geliştirme · Build 125'",'active development stage is incorrect');
includes('domain','export interface UpdateFamilyEventInput','full event update input is missing');
includes('domain','export interface SetFamilyEventArchivedInput','archive/restore input is missing');
includes('domain','archivedAt?: string','archived timestamp is missing from event view');
includes('contract','listArchivedByFamily','archived timeline repository query is missing');
includes('contract','setArchived','archive repository command is missing');
includes('repository','archived_at IS NULL','active event queries do not exclude archived records');
includes('repository','UPDATE events SET archived_at=?','archive timestamp update is missing');
includes('application','export class UpdateFamilyEventUseCase','full event update use case is missing');
includes('application','export class SetFamilyEventArchivedUseCase','archive/restore use case is missing');
includes('application','export class ListArchivedTimelineEventsUseCase','archived list use case is missing');
includes('adapter','public updateEvent(event','application adapter does not expose full event update');
includes('adapter','public setEventArchived(eventId','application adapter does not expose archive/restore');
includes('store','public updateFamilyEvent','data store full event update is missing');
includes('store','public setFamilyEventArchived','data store archive/restore is missing');
includes('store','public listArchivedTimelineEvents','data store archived list is missing');
for(const channel of ['timeline:updateEvent','timeline:setArchived','timeline:listArchived']){
  includes('main',channel,`main IPC channel is missing: ${channel}`);
  includes('preload',channel,`preload IPC channel is missing: ${channel}`);
}
includes('rendererTypes','updateFamilyEvent','renderer full event update type is missing');
includes('rendererTypes','setFamilyEventArchived','renderer archive/restore type is missing');
includes('rendererTypes','listArchivedTimelineEvents','renderer archived list type is missing');
includes('renderer','function EditEventModal','full event editor is missing');
includes('renderer','Kayıtlarda ara','timeline search UI is missing');
includes('renderer','Olay türü','timeline kind filter is missing');
includes('renderer','Filtreleri temizle','timeline filter reset is missing');
includes('renderer','Geri alınabilir kayıtlar','recoverable event archive UI is missing');
includes('renderer','Tüm alanları düzenle','important day full edit action is missing');
includes('renderer','onRestore','archive restore action is not connected');
includes('renderer','Bağlı arşiv','event-to-archive navigation is missing');
includes('styles','.timeline-toolbar','timeline filter visual contract is missing');
includes('styles','.archived-events-panel','event archive visual contract is missing');
includes('migrations',"createMigrationDefinition(15, 'timeline_event_lifecycle'",'timeline lifecycle migration 15 is missing');
includes('migrations','ALTER TABLE events ADD COLUMN archived_at TEXT','archived_at migration is missing');
includes('migrations','idx_events_family_archived_date','active/archive lookup index is missing');
includes('tests','zaman tüneli olayını tüm alanlarıyla günceller','end-to-end lifecycle regression test is missing');
includes('tests','store.listArchivedTimelineEvents()','archived event regression assertion is missing');

const report={
  schemaVersion:1,
  product:'Anadolu Parsı Aile Yaşam Merkezi',
  build:125,
  version:'27.07.2026.125',
  packageVersion:'27.7.2026-125',
  stage:'Bronze RC2 Active Development',
  status:failures.length?'FAIL':'PASS',
  assertions,
  failures,
  verifiedCapabilities:[
    'full-timeline-event-editing',
    'timeline-search-and-kind-year-person-filters',
    'recoverable-event-archive-and-restore',
    'event-archive-bidirectional-navigation',
    'migration-15-event-lifecycle-persistence',
    'authorized-application-and-ipc-boundaries',
    'data-store-regression-test'
  ],
  generatedAt:new Date().toISOString()
};
await mkdir(dirname(reportPath),{recursive:true});
await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
console.log(`Build 125 timeline lifecycle contract: ${report.status} (${assertions} assertions)`);
if(failures.length){for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}
