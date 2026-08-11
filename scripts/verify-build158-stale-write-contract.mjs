import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
const read=(path)=>readFile(path,'utf8');
const [guard,renderer,pkg,ledger]=await Promise.all([
  read('apps/desktop/src/renderer/async-state-guard.ts'),
  read('apps/desktop/src/renderer/App.tsx'),
  read('package.json'),
  read('artifacts/manifests/VERSION_LEDGER.json')
]);
let assertions=0;const failures=[];const verify=(condition,label)=>{assertions++;if(!condition)failures.push(label);};
verify(guard.includes('export class AsyncWriteGuard'),'async write guard class');
verify(guard.includes('#epoch += 1'),'session epoch invalidation');
verify(guard.includes('this.#sequences.get(ticket.scope) === ticket.sequence'),'scope sequence comparison');
verify(guard.includes('public commit(ticket: AsyncWriteTicket'),'guarded commit API');
verify(guard.includes('export class MutationRevisionWatermark'),'mutation revision watermark class');
verify(guard.includes('Math.max(merged[key], result.revisions[key])'),'revision watermark monotonic merge');
verify(guard.includes('this.#seenMutationIds.has(result.mutationId)'),'mutation id deduplication');
verify(renderer.includes("import { AsyncWriteGuard, MutationRevisionWatermark } from './async-state-guard'"),'renderer imports guards');
verify(renderer.includes("guardRef.current.start('person-page')"),'person catalog guarded');
verify(renderer.includes("guardRef.current.start('event-page')"),'event catalog guarded');
verify(renderer.includes("relatedGuardRef.current.start('related-events')"),'family related events guarded');
verify(renderer.includes("guardRef.current.start('tree-page')"),'tree page guarded');
verify(renderer.includes("guardRef.current.start('timeline-page')"),'timeline page guarded');
verify(renderer.includes("guardRef.current.start('archive-page')"),'archive page guarded');
verify(renderer.includes('asyncWriteGuardRef.current.invalidateAll()'),'session reset invalidates pending writes');
verify(renderer.includes('mutationRevisionWatermarkRef.current.reset()'),'session reset clears mutation watermark');
verify(renderer.includes('const acceptance=mutationRevisionWatermarkRef.current.accept(result)'),'mutation result filtered through watermark');
verify(renderer.includes('if(!acceptance.accepted)return false'),'stale mutation result rejected');
verify(renderer.includes("acceptance.advancedKeys.includes('graph')"),'graph write requires advanced graph revision');
verify(renderer.includes("acceptance.advancedKeys.includes('timeline')"),'timeline write requires advanced timeline revision');
verify(renderer.includes("asyncWriteGuardRef.current.invalidate('snapshot:graph')"),'graph mutation invalidates in-flight graph snapshot');
verify(renderer.includes("asyncWriteGuardRef.current.invalidate('snapshot:timeline')"),'timeline mutation invalidates in-flight timeline snapshot');
verify(renderer.includes("delete snapshotSectionLoadsRef.current.graph"),'stale graph promise detached before retry');
verify(renderer.includes("setScreenLoadRevision((current)=>current+1)"),'stale section load triggers active-screen retry');
verify(renderer.includes("current.lastUpdatedAt.localeCompare(result.occurredAt)>=0"),'snapshot activity timestamp remains monotonic');
verify(renderer.includes("asyncWriteGuardRef.current.start(`snapshot:${section}`)"),'snapshot section guarded');
verify(renderer.includes("asyncWriteGuardRef.current.start(`auxiliary:${screen}`)"),'auxiliary screen guarded');
verify(renderer.includes("asyncWriteGuardRef.current.start('session-bootstrap')"),'session bootstrap guarded');
verify(renderer.includes("asyncWriteGuardRef.current.start('dashboard')"),'dashboard refresh guarded');
verify(renderer.includes("asyncWriteGuardRef.current.start('family-refresh')"),'family refresh guarded');
verify(renderer.includes("asyncWriteGuardRef.current.start('auth-transition')"),'auth transitions guarded');
verify(renderer.includes('if(snapshotSectionLoadsRef.current[section]===task)'), 'stale snapshot promise cannot clear newer task');
verify(renderer.includes('if(auxiliaryLoadsRef.current[screen]===task)'), 'stale auxiliary promise cannot clear newer task');
const packageJson=JSON.parse(pkg),versionLedger=JSON.parse(ledger),current=versionLedger.entries?.at(-1);
verify(Number(current?.sequence)>=158,'feature evaluated on Build 158 or later');
verify(packageJson.version===current?.packageVersion,'package and ledger aligned');
verify(current?.stage==='RC2 Aktif Geliştirme','stage preserved');
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:158,stage:'Bronze RC2 Active Development',scope:'Session-safe async writes and monotonic renderer mutation revision watermark',assertions,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
const reportPath='artifacts/validation/build158-stale-write-contract.json';await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
if(failures.length){console.error(`Build 158 stale write contract: FAIL (${assertions-failures.length}/${assertions})`);for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}else console.log(`Build 158 stale write contract: PASS (${assertions}/${assertions}).`);
