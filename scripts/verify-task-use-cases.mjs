import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { SqliteTaskRepository } from '../packages/repositories/dist/index.js';
import { StartBackgroundTaskUseCase, FinishBackgroundTaskUseCase, ListBackgroundTasksUseCase, EnqueueTaskUseCase, ListQueuedTasksUseCase, ListRunnableQueuedTasksUseCase, StartQueuedTaskUseCase, CompleteQueuedTaskUseCase, FailOrRetryQueuedTaskUseCase, DeferQueuedTaskUseCase } from '../packages/application/dist/index.js';
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE background_tasks (id TEXT PRIMARY KEY,task_type TEXT NOT NULL,label TEXT NOT NULL,status TEXT NOT NULL,started_at TEXT NOT NULL,completed_at TEXT,duration_ms INTEGER,warning_threshold_ms INTEGER NOT NULL DEFAULT 30000,details TEXT);CREATE TABLE task_queue (id TEXT PRIMARY KEY,task_type TEXT NOT NULL,label TEXT NOT NULL,priority TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,started_at TEXT,completed_at TEXT,attempts INTEGER NOT NULL DEFAULT 0,max_attempts INTEGER NOT NULL DEFAULT 2,payload TEXT,details TEXT);`);
const repo=new SqliteTaskRepository();
const context={actorId:'account-test',correlationId:'corr-test'};
const rc={transaction:db,actor:{userId:'account-test',roles:['system_operator']},correlationId:'corr-test',occurredAt:'2026-07-24T12:00:00.000Z'};
const port={
 listBackgroundTasks:(_c,l)=>repo.listBackgroundTasks(rc,l),insertBackgroundTask:(_c,t)=>repo.insertBackgroundTask(rc,t),finishBackgroundTask:(_c,...a)=>repo.finishBackgroundTask(rc,...a),
 listQueuedTasks:(_c,l)=>repo.listQueuedTasks(rc,l),listRunnableQueuedTasks:(_c,l)=>repo.listRunnableQueuedTasks(rc,l),enqueueTask:(_c,t)=>repo.enqueueTask(rc,t),markQueuedTaskDeferred:(_c,...a)=>repo.markQueuedTaskDeferred(rc,...a),markQueuedTaskRunning:(_c,...a)=>repo.markQueuedTaskRunning(rc,...a),markQueuedTaskCompleted:(_c,...a)=>repo.markQueuedTaskCompleted(rc,...a),markQueuedTaskRetryOrFailed:(_c,...a)=>repo.markQueuedTaskRetryOrFailed(rc,...a)
};
const started=new StartBackgroundTaskUseCase(port).execute(context,{id:'bg-1',taskType:'backup',label:'Yedek',status:'running',startedAt:'2026-07-24T12:00:00.000Z',warningThresholdMs:30000});assert.equal(started.ok,true);
assert.equal(new FinishBackgroundTaskUseCase(port).execute(context,'bg-1','success','2026-07-24T12:00:01.000Z',1000).ok,true);
const bg=new ListBackgroundTasksUseCase(port).execute(context,10);assert.equal(bg.ok,true);assert.equal(bg.value[0].status,'success');assert.equal(bg.value[0].durationMs,1000);
const enqueue=new EnqueueTaskUseCase(port).execute(context,{taskType:'performance.sample',label:'Örnek',priority:'high',maxAttempts:2},'q-1','2026-07-24T12:01:00.000Z');assert.equal(enqueue.ok,true);
assert.equal(new EnqueueTaskUseCase(port).execute(context,{taskType:'backup.due',label:'Yedek',priority:'critical'},'q-2','2026-07-24T12:02:00.000Z').ok,true);
const runnable=new ListRunnableQueuedTasksUseCase(port).execute(context,10);assert.equal(runnable.ok,true);assert.deepEqual(runnable.value.map(x=>x.id),['q-2','q-1']);
assert.equal(new StartQueuedTaskUseCase(port).execute(context,'q-2','2026-07-24T12:03:00.000Z',1).ok,true);
assert.equal(new CompleteQueuedTaskUseCase(port).execute(context,'q-2','2026-07-24T12:04:00.000Z').ok,true);
assert.equal(new StartQueuedTaskUseCase(port).execute(context,'q-1','2026-07-24T12:03:00.000Z',1).ok,true);
assert.equal(new FailOrRetryQueuedTaskUseCase(port).execute(context,'q-1','queued',undefined,'geçici hata').ok,true);
assert.equal(new DeferQueuedTaskUseCase(port).execute(context,'q-1','yüksek sistem yükü').ok,true);
const all=new ListQueuedTasksUseCase(port).execute(context,10);assert.equal(all.ok,true);assert.equal(all.value.find(x=>x.id==='q-2').status,'completed');assert.equal(all.value.find(x=>x.id==='q-1').status,'deferred');
console.log('Task architecture verification passed: 10/10');
