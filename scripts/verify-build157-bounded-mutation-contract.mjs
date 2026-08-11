import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
const read=(path)=>readFile(path,'utf8');
const [domain,service,dataStore,main,preload,globalTypes,renderer,pkg,ledger]=await Promise.all([
  read('packages/domain/src/app-data.ts'),
  read('apps/desktop/src/main/family-mutation-revision-service.ts'),
  read('apps/desktop/src/main/data-store.ts'),
  read('apps/desktop/src/main/main.ts'),
  read('apps/desktop/src/main/preload.ts'),
  read('apps/desktop/src/renderer/global.d.ts'),
  read('apps/desktop/src/renderer/App.tsx'),
  read('package.json'),
  read('artifacts/manifests/VERSION_LEDGER.json')
]);
let assertions=0;const failures=[];const verify=(condition,label)=>{assertions++;if(!condition)failures.push(label);};
verify(domain.includes('interface FamilyMutationResultView'),'bounded mutation result contract');
verify(domain.includes('interface FamilyMutationRevisionsView'),'mutation revision contract');
verify(domain.includes("FamilyMutationRevisionKey = 'graph' | 'timeline' | 'personCatalog' | 'eventCatalog' | 'dashboard' | 'notifications' | 'archive'"),'revision key scope');
verify(service.includes('class FamilyMutationRevisionService'),'revision service');
verify(service.includes('uniqueRevisionKeys.size !== input.changedRevisions.length'),'duplicate revision rejection');
verify(service.includes('this.#revisions[key] += 1'),'targeted revision increment');
verify(service.includes('revisions: { ...this.#revisions }'),'revision snapshot copy');
const mutationMethodNames=['createMember','createRelation','createLocation','createEvent','updateImportantDayParticipants','updateImportantDayInvitation','updateImportantDayNotes','updateFamilyEvent','setFamilyEventArchived','acknowledgeTimelineNotification'];
for(const name of mutationMethodNames){
  const signature=new RegExp(`public ${name}\\([^)]*\\): FamilyMutationResultView`);
  verify(signature.test(dataStore),`${name} bounded return type`);
  const start=dataStore.indexOf(`public ${name}(`),end=dataStore.indexOf('\n  public ',start+10),block=dataStore.slice(start,end<0?dataStore.length:end);
  verify(!block.includes('return this.getSnapshot()'),`${name} does not return full snapshot`);
  verify(block.includes('#recordMutation'),`${name} publishes revision result`);
}
verify(dataStore.includes("changedRevisions: ['graph', 'personCatalog', 'dashboard']"),'person mutation targeted revisions');
verify(dataStore.includes("changedRevisions: ['timeline', 'eventCatalog', 'dashboard', 'notifications']"),'event mutation targeted revisions');
verify(dataStore.includes("changedRevisions: ['timeline', 'eventCatalog', 'dashboard', 'notifications', 'archive']"),'archive mutation targeted revisions');
verify(main.includes('const mutation = store().createMember(input)'),'main returns mutation result');
verify(!main.includes('const snapshot = store().createMember(input)'),'main no member snapshot naming');
verify(preload.includes('createMember: (input: CreateFamilyMemberInput): Promise<FamilyMutationResultView>'),'preload bounded member type');
verify(preload.includes('updateFamilyEvent: (input:UpdateFamilyEventInput):Promise<FamilyMutationResultView>'),'preload bounded update type');
verify(globalTypes.includes('createMember(input:CreateFamilyMemberInput):Promise<FamilyMutationResultView>'),'renderer global bounded member type');
verify(globalTypes.includes('setFamilyEventArchived(input:SetFamilyEventArchivedInput):Promise<FamilyMutationResultView>'),'renderer global bounded archive type');
verify(renderer.includes('const applyMutationResult=(result:FamilyMutationResultView)=>'),'renderer bounded mutation applicator');
verify(!renderer.includes('applyFullSnapshot'),'renderer full-snapshot mutation applicator removed');
verify(renderer.includes("result.changedRevisions.includes('personCatalog')")||renderer.includes("acceptance.advancedKeys.includes('personCatalog')"),'person catalog targeted refresh');
verify(renderer.includes("result.changedRevisions.includes('archive')")||renderer.includes("acceptance.advancedKeys.includes('archive')"),'archive targeted refresh');
verify(renderer.includes("result.operation==='archived'"),'bounded archive local removal');
const packageJson=JSON.parse(pkg),versionLedger=JSON.parse(ledger),current=versionLedger.entries?.at(-1);
verify(Number(current?.sequence)>=157,'feature evaluated on Build 157 or later');
verify(packageJson.version===current?.packageVersion,'package and ledger aligned');
verify(current?.stage==='RC2 Aktif Geliştirme','stage preserved');
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:157,stage:'Bronze RC2 Active Development',scope:'Bounded mutation results and targeted family/catalog revision signals',assertions,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
const reportPath='artifacts/validation/build157-bounded-mutation-contract.json';await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
if(failures.length){console.error(`Build 157 bounded mutation contract: FAIL (${assertions-failures.length}/${assertions})`);for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}else console.log(`Build 157 bounded mutation contract: PASS (${assertions}/${assertions}).`);
