import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp=join(process.cwd(),'.tmp','build193-clean-rewrite-running-ledger-identity-runtime');
const out=resolve(process.argv[2]??'artifacts/validation/build193-clean-rewrite-running-ledger-identity-runtime.json');
await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});
const globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
const ts=(await import(pathToFileURL(join(globalRoot,'typescript','lib','typescript.js')).href)).default;
const source=await readFile('packages/repositories/src/backup-propagation-repository.ts','utf8');
const modulePath=join(tmp,'repository.mjs');
await writeFile(modulePath,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/import \{ SqliteRepository \} from '\.\/sqlite-base\.js';/,`class SqliteRepository { database(context){return context.transaction;} execute(_context,operation){try{return {ok:true,value:operation()};}catch(error){return {ok:false,error};}} }`));
const {SqliteBackupPropagationRepository}=await import(pathToFileURL(modulePath).href);

const start='2026-07-31T08:00:00.000Z';
const cutoff='2026-07-01T08:00:00.000Z';
const basePolicy={id:'default',enabled:1,retention_days:30,manual_failure_backoff_minutes:60,automatic_failure_backoff_minutes:360,high_load_defer_minutes:30,state:'idle',consecutive_failures:0,last_outcome:'never',last_trigger:null,last_attempt_at:null,last_success_at:null,next_attempt_at:null,last_error:null,in_progress_run_id:null,in_progress_started_at:null,created_at:'2026-07-01T00:00:00.000Z',updated_at:start};
class FakeDatabase{
  constructor({policyUpdateChanges=1,insertChanges=1,owned=true}={}){this.policy={...basePolicy};this.policyUpdateChanges=policyUpdateChanges;this.insertChanges=insertChanges;this.owned=owned;this.calls=[];this.inserted=null;}
  prepare(sql){
    const normalized=sql.replace(/\s+/g,' ').trim();this.calls.push(normalized);
    if(normalized.startsWith('SELECT retention_days,updated_at,last_attempt_at,last_success_at'))return{get:()=>({...this.policy})};
    if(normalized.startsWith("UPDATE backup_clean_rewrite_policy SET state='running'"))return{run:(trigger,startedAt,runId)=>{if(this.policyUpdateChanges===1){this.policy={...this.policy,state:'running',last_trigger:trigger,last_attempt_at:startedAt,next_attempt_at:null,in_progress_run_id:runId,in_progress_started_at:startedAt,last_error:null,updated_at:startedAt};}return{changes:this.policyUpdateChanges};}};
    if(normalized.startsWith('INSERT INTO backup_clean_rewrite_runs'))return{run:(id,trigger,retentionCutoff,dueRecords,enabledTargets,startedAt,updatedAt)=>{if(this.insertChanges===1)this.inserted={id,trigger,retentionCutoff,dueRecords,enabledTargets,startedAt,updatedAt,status:'running'};return{changes:this.insertChanges};}};
    if(normalized.startsWith('SELECT 1 AS value FROM backup_clean_rewrite_runs run JOIN'))return{get:()=>this.owned?{value:1}:undefined};
    if(normalized.startsWith("SELECT * FROM backup_clean_rewrite_policy WHERE id='default'"))return{get:()=>({...this.policy})};
    throw new Error(`Unexpected SQL: ${normalized}`);
  }
}
const context=(db)=>({transaction:db,correlationId:'build193'});
const input=(overrides={})=>({trigger:'manual',runId:'run-193',startedAt:start,retentionCutoff:cutoff,dueRecords:2,enabledTargets:1,...overrides});
const checks=[];const check=(label,fn)=>{fn();checks.push(label);};

let db=new FakeDatabase();let repo=new SqliteBackupPropagationRepository();let result=repo.claimCleanRewrite(context(db),input());
check('valid repository claim succeeds',()=>assert.equal(result.ok,true));
check('valid repository claim returns running state',()=>assert.equal(result.value.state,'running'));
check('valid repository claim returns owner id',()=>assert.equal(result.value.inProgressRunId,'run-193'));
check('valid repository claim writes ledger once',()=>assert.equal(db.inserted.id,'run-193'));
check('valid repository claim retains trigger',()=>assert.equal(db.inserted.trigger,'manual'));
check('valid repository claim retains chronology',()=>assert.equal(db.inserted.startedAt,start));
check('valid repository claim performs ownership join',()=>assert.equal(db.calls.some(sql=>sql.startsWith('SELECT 1 AS value FROM backup_clean_rewrite_runs run JOIN')),true));

for(const [label,overrides,message] of [
  ['blank run id',{runId:'   '},/çalışma kimliği boş olamaz/],
  ['invalid trigger',{trigger:'invalid'},/tetikleyicisi geçersiz/]
]){
  db=new FakeDatabase();repo=new SqliteBackupPropagationRepository();result=repo.claimCleanRewrite(context(db),input(overrides));
  check(`${label} is rejected`,()=>assert.equal(result.ok,false));
  check(`${label} error is explicit`,()=>assert.match(String(result.error?.message??result.error),message));
  check(`${label} performs no policy write`,()=>assert.equal(db.calls.some(sql=>sql.startsWith("UPDATE backup_clean_rewrite_policy SET state='running'")),false));
}

db=new FakeDatabase({policyUpdateChanges:0});repo=new SqliteBackupPropagationRepository();result=repo.claimCleanRewrite(context(db),input());
check('lost policy claim result succeeds',()=>assert.equal(result.ok,true));
check('lost policy claim returns null',()=>assert.equal(result.value,null));
check('lost policy claim creates no ledger',()=>assert.equal(db.inserted,null));
check('lost policy claim skips ownership verification',()=>assert.equal(db.calls.some(sql=>sql.startsWith('SELECT 1 AS value FROM backup_clean_rewrite_runs run JOIN')),false));

db=new FakeDatabase({insertChanges:0});repo=new SqliteBackupPropagationRepository();result=repo.claimCleanRewrite(context(db),input());
check('missing ledger insert is rejected',()=>assert.equal(result.ok,false));
check('missing ledger insert error is explicit',()=>assert.match(String(result.error?.message??result.error),/sahiplik kaydı oluşturulamadı/));

db=new FakeDatabase({owned:false});repo=new SqliteBackupPropagationRepository();result=repo.claimCleanRewrite(context(db),input());
check('ownership mismatch is rejected',()=>assert.equal(result.ok,false));
check('ownership mismatch error is explicit',()=>assert.match(String(result.error?.message??result.error),/kalıcı politika sahipliğiyle eşleşmiyor/));
check('ownership mismatch occurs after ledger insert',()=>assert.equal(db.inserted.id,'run-193'));

assert.equal(checks.length,22);
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:193,stage:'Bronze RC2 Active Development',scope:'Repository running clean-rewrite ledger identity validation and post-insert ownership verification',status:'PASS',checks:checks.length,checkLabels:checks,generatedAt:new Date().toISOString()};
await mkdir(dirname(out),{recursive:true});await writeFile(out,`${JSON.stringify(report,null,2)}\n`);await rm(tmp,{recursive:true,force:true});
console.log(`Build 193 clean rewrite running ledger identity runtime: PASS (${checks.length}/${checks.length})`);
