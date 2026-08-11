import { ERROR_CODES, createAppError, err, type AppError, type CorrelationId, type Result, type UserId } from '@ppt/core';
import type { BackgroundTaskView, EnqueueTaskInput, QueuedTaskView } from '@ppt/domain';

export interface TaskApplicationContext { readonly actorId:UserId; readonly correlationId:CorrelationId; }
export interface TaskQueryPort {
  listBackgroundTasks(context:TaskApplicationContext,limit:number):Result<readonly BackgroundTaskView[],AppError>;
  listQueuedTasks(context:TaskApplicationContext,limit:number):Result<readonly QueuedTaskView[],AppError>;
  listRunnableQueuedTasks(context:TaskApplicationContext,limit:number):Result<readonly QueuedTaskView[],AppError>;
}
export interface TaskWritePort {
  insertBackgroundTask(context:TaskApplicationContext,task:BackgroundTaskView):Result<void,AppError>;
  finishBackgroundTask(context:TaskApplicationContext,id:string,status:BackgroundTaskView['status'],completedAt:string,durationMs:number,details?:string):Result<void,AppError>;
  enqueueTask(context:TaskApplicationContext,task:QueuedTaskView):Result<void,AppError>;
  markQueuedTaskDeferred(context:TaskApplicationContext,id:string,details:string):Result<void,AppError>;
  markQueuedTaskRunning(context:TaskApplicationContext,id:string,startedAt:string,attempts:number):Result<void,AppError>;
  markQueuedTaskCompleted(context:TaskApplicationContext,id:string,completedAt:string):Result<void,AppError>;
  markQueuedTaskRetryOrFailed(context:TaskApplicationContext,id:string,status:'queued'|'failed',completedAt:string|undefined,details:string):Result<void,AppError>;
}
const invalid=(c:TaskApplicationContext,m:string)=>createAppError({code:ERROR_CODES.CORE_INVALID_ARGUMENT,message:m,category:'validation',correlationId:c.correlationId});
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(Math.trunc(n),max));
export class ListBackgroundTasksUseCase { constructor(private readonly q:TaskQueryPort){} execute(c:TaskApplicationContext,limit=100){return this.q.listBackgroundTasks(c,clamp(limit,1,500));} }
export class StartBackgroundTaskUseCase { constructor(private readonly w:TaskWritePort){} execute(c:TaskApplicationContext,task:BackgroundTaskView){if(!task.id||!task.taskType.trim()||!task.label.trim())return err(invalid(c,'Arka plan görevi kimliği, türü ve etiketi zorunludur.'));return this.w.insertBackgroundTask(c,task);} }
export class FinishBackgroundTaskUseCase { constructor(private readonly w:TaskWritePort){} execute(c:TaskApplicationContext,id:string,status:BackgroundTaskView['status'],completedAt:string,durationMs:number,details?:string){if(!id)return err(invalid(c,'Arka plan görevi kimliği zorunludur.'));return this.w.finishBackgroundTask(c,id,status,completedAt,Math.max(0,Math.trunc(durationMs)),details);} }
export class ListQueuedTasksUseCase { constructor(private readonly q:TaskQueryPort){} execute(c:TaskApplicationContext,limit=100){return this.q.listQueuedTasks(c,clamp(limit,1,500));} }
export class ListRunnableQueuedTasksUseCase { constructor(private readonly q:TaskQueryPort){} execute(c:TaskApplicationContext,limit:number){return this.q.listRunnableQueuedTasks(c,clamp(limit,1,100));} }
export class EnqueueTaskUseCase { constructor(private readonly w:TaskWritePort){} execute(c:TaskApplicationContext,input:EnqueueTaskInput,id:string,createdAt:string):Result<QueuedTaskView,AppError>{const taskType=input.taskType.trim(),label=input.label.trim();if(!taskType||!label)return err(invalid(c,'Görev türü ve etiketi zorunludur.'));const task:QueuedTaskView={id,taskType,label,priority:input.priority??'normal',status:'queued',createdAt,attempts:0,maxAttempts:clamp(input.maxAttempts??2,1,10),...(input.payload?{payload:input.payload}:{})};const saved=this.w.enqueueTask(c,task);return saved.ok?{ok:true,value:task}:saved;} }
export class DeferQueuedTaskUseCase { constructor(private readonly w:TaskWritePort){} execute(c:TaskApplicationContext,id:string,details:string){return this.w.markQueuedTaskDeferred(c,id,details);} }
export class StartQueuedTaskUseCase { constructor(private readonly w:TaskWritePort){} execute(c:TaskApplicationContext,id:string,startedAt:string,attempts:number){return this.w.markQueuedTaskRunning(c,id,startedAt,Math.max(1,Math.trunc(attempts)));} }
export class CompleteQueuedTaskUseCase { constructor(private readonly w:TaskWritePort){} execute(c:TaskApplicationContext,id:string,completedAt:string){return this.w.markQueuedTaskCompleted(c,id,completedAt);} }
export class FailOrRetryQueuedTaskUseCase { constructor(private readonly w:TaskWritePort){} execute(c:TaskApplicationContext,id:string,status:'queued'|'failed',completedAt:string|undefined,details:string){return this.w.markQueuedTaskRetryOrFailed(c,id,status,completedAt,details);} }
