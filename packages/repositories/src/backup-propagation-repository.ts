import type {
  BackupCleanRewriteOutcome,
  BackupCleanRewritePolicyView,
  BackupCleanRewriteRunStatus,
  BackupCleanRewriteRunView,
  BackupCleanRewriteState,
  BackupCleanRewriteTrigger,
  BackupPropagationRunStatus,
  BackupPropagationRunView
} from '@ppt/domain';
import type {
  BackupPropagationRepositoryPort,
  PendingBackupPropagationRow,
  RepositoryExecutionContext,
  RepositoryResult
} from '@ppt/repository-contracts';
import { SqliteRepository } from './sqlite-base.js';

const parseTargetResults=(value:unknown):BackupPropagationRunView['targetResults']=>{
  try {
    const parsed=JSON.parse(String(value)) as unknown;
    return Array.isArray(parsed)?parsed as BackupPropagationRunView['targetResults']:[];
  } catch { return []; }
};

const mapCleanRewritePolicy=(row:Record<string,unknown>):BackupCleanRewritePolicyView=>({
  id:'default',enabled:Number(row.enabled)===1,retentionDays:Number(row.retention_days),
  manualFailureBackoffMinutes:60,automaticFailureBackoffMinutes:360,highLoadDeferMinutes:30,
  state:String(row.state) as BackupCleanRewriteState,consecutiveFailures:Number(row.consecutive_failures),
  lastOutcome:String(row.last_outcome) as BackupCleanRewriteOutcome,
  ...(row.last_trigger?{lastTrigger:String(row.last_trigger) as BackupCleanRewriteTrigger}:{}),
  ...(row.last_attempt_at?{lastAttemptAt:String(row.last_attempt_at)}:{}),
  ...(row.last_success_at?{lastSuccessAt:String(row.last_success_at)}:{}),
  ...(row.next_attempt_at?{nextAttemptAt:String(row.next_attempt_at)}:{}),
  ...(row.last_error?{lastError:String(row.last_error)}:{}),
  ...(row.in_progress_run_id?{inProgressRunId:String(row.in_progress_run_id)}:{}),
  ...(row.in_progress_started_at?{inProgressStartedAt:String(row.in_progress_started_at)}:{}),
  createdAt:String(row.created_at),updatedAt:String(row.updated_at)
});

const mapCleanRewriteRun=(row:Record<string,unknown>):BackupCleanRewriteRunView=>({
  id:String(row.id),
  trigger:String(row.trigger) as BackupCleanRewriteTrigger,
  status:String(row.status) as BackupCleanRewriteRunStatus,
  retentionCutoff:String(row.retention_cutoff),
  dueRecords:Number(row.due_records),
  enabledTargets:Number(row.enabled_targets),
  ...(row.propagation_run_id?{propagationRunId:String(row.propagation_run_id)}:{}),
  ...(row.next_attempt_at?{nextAttemptAt:String(row.next_attempt_at)}:{}),
  ...(row.error?{error:String(row.error)}:{}),
  startedAt:String(row.started_at),
  ...(row.completed_at?{completedAt:String(row.completed_at)}:{}),
  updatedAt:String(row.updated_at)
});

const mapRun=(row:Record<string,unknown>):BackupPropagationRunView=>({
  id:String(row.id),status:String(row.status) as BackupPropagationRunStatus,
  pendingRecords:Number(row.pending_records),targetCount:Number(row.target_count),
  refreshedTargets:Number(row.refreshed_targets),quarantinedArtifacts:Number(row.quarantined_artifacts),
  pendingRemaining:Number(row.pending_remaining),manualBackupWarning:Number(row.manual_backup_warning)===1,
  targetResults:parseTargetResults(row.target_results),...(row.error?{error:String(row.error)}:{}),
  startedAt:String(row.started_at),completedAt:String(row.completed_at)
});

export class SqliteBackupPropagationRepository extends SqliteRepository implements BackupPropagationRepositoryPort {
  listPending(context:RepositoryExecutionContext):RepositoryResult<readonly PendingBackupPropagationRow[]>{
    return this.execute(context,()=> (this.database(context).prepare(`
      SELECT resource_type,resource_id,purged_at,updated_at FROM data_lifecycle
      WHERE state='purged' AND backup_propagation_pending=1
      ORDER BY purged_at,resource_type,resource_id
    `).all() as Record<string,unknown>[]).map(row=>({resourceType:String(row.resource_type) as PendingBackupPropagationRow['resourceType'],resourceId:String(row.resource_id),...(row.purged_at?{purgedAt:String(row.purged_at)}:{}),updatedAt:String(row.updated_at)})));
  }
  markCompleted(context:RepositoryExecutionContext,records:readonly PendingBackupPropagationRow[],completedAt:string):RepositoryResult<number>{
    return this.execute(context,()=>{
      const statement=this.database(context).prepare(`UPDATE data_lifecycle SET backup_propagation_pending=0,updated_at=? WHERE resource_type=? AND resource_id=? AND state='purged' AND backup_propagation_pending=1 AND updated_at=?`);
      let changed=0;
      for(const row of records){const result=statement.run(completedAt,row.resourceType,row.resourceId,row.updatedAt) as {changes?:number};changed+=Number(result.changes??0);}
      return changed;
    });
  }
  insertRun(context:RepositoryExecutionContext,run:BackupPropagationRunView):RepositoryResult<void>{
    return this.execute(context,()=>{this.database(context).prepare(`
      INSERT INTO backup_propagation_runs(id,status,pending_records,target_count,refreshed_targets,quarantined_artifacts,pending_remaining,manual_backup_warning,target_results,error,started_at,completed_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(run.id,run.status,run.pendingRecords,run.targetCount,run.refreshedTargets,run.quarantinedArtifacts,run.pendingRemaining,run.manualBackupWarning?1:0,JSON.stringify(run.targetResults),run.error??null,run.startedAt,run.completedAt);});
  }
  listRuns(context:RepositoryExecutionContext,limit:number):RepositoryResult<readonly BackupPropagationRunView[]>{
    return this.execute(context,()=> (this.database(context).prepare(`SELECT * FROM backup_propagation_runs ORDER BY started_at DESC LIMIT ?`).all(limit) as Record<string,unknown>[]).map(mapRun));
  }
  getCleanRewritePolicy(context:RepositoryExecutionContext):RepositoryResult<BackupCleanRewritePolicyView>{
    return this.execute(context,()=>mapCleanRewritePolicy(this.database(context).prepare(`SELECT * FROM backup_clean_rewrite_policy WHERE id='default'`).get() as Record<string,unknown>));
  }
  listCleanRewriteRuns(context:RepositoryExecutionContext,limit:number):RepositoryResult<readonly BackupCleanRewriteRunView[]>{
    return this.execute(context,()=> (this.database(context).prepare(`SELECT * FROM backup_clean_rewrite_runs ORDER BY started_at DESC,id DESC LIMIT ?`).all(limit) as Record<string,unknown>[]).map(mapCleanRewriteRun));
  }
  updateCleanRewritePolicy(context:RepositoryExecutionContext,input:{readonly enabled:boolean;readonly retentionDays:number;readonly updatedAt:string}):RepositoryResult<BackupCleanRewritePolicyView>{
    return this.execute(context,()=>{
      const updatedAtMs=Date.parse(input.updatedAt);
      if(!Number.isFinite(updatedAtMs))throw new Error('Temiz yedek politika güncelleme zamanı geçersizdir.');
      const current=this.database(context).prepare(`SELECT state,updated_at FROM backup_clean_rewrite_policy WHERE id='default'`).get() as Record<string,unknown>|undefined;
      if(!current)throw new Error('Temiz yedek yeniden yazım politikası bulunamadı.');
      if(String(current.state)==='running')throw new Error('Aktif temiz yedek çalışması tamamlanmadan politika ayarları değiştirilemez.');
      const currentUpdatedAtMs=Date.parse(String(current.updated_at));
      if(!Number.isFinite(currentUpdatedAtMs))throw new Error('Kalıcı temiz yedek politika kronolojisi geçersizdir.');
      if(updatedAtMs<currentUpdatedAtMs)throw new Error('Temiz yedek politika güncellemesi kalıcı kronolojiden önce olamaz.');
      const result=this.database(context).prepare(`UPDATE backup_clean_rewrite_policy SET enabled=?,retention_days=?,updated_at=? WHERE id='default' AND state<>'running'`).run(input.enabled?1:0,input.retentionDays,input.updatedAt) as {changes?:number};
      if(Number(result.changes??0)!==1){
        const latest=this.database(context).prepare(`SELECT state FROM backup_clean_rewrite_policy WHERE id='default'`).get() as Record<string,unknown>|undefined;
        if(String(latest?.state??'')==='running')throw new Error('Aktif temiz yedek çalışması tamamlanmadan politika ayarları değiştirilemez.');
        throw new Error('Temiz yedek politika ayarları atomik olarak güncellenemedi.');
      }
      return mapCleanRewritePolicy(this.database(context).prepare(`SELECT * FROM backup_clean_rewrite_policy WHERE id='default'`).get() as Record<string,unknown>);
    });
  }
  claimCleanRewrite(context:RepositoryExecutionContext,input:{readonly trigger:BackupCleanRewriteTrigger;readonly runId:string;readonly startedAt:string;readonly retentionCutoff:string;readonly dueRecords:number;readonly enabledTargets:number}):RepositoryResult<BackupCleanRewritePolicyView|null>{
    return this.execute(context,()=>{
      const startedAtMs=Date.parse(input.startedAt),retentionCutoffMs=Date.parse(input.retentionCutoff);
      if(!Number.isFinite(startedAtMs))throw new Error('Temiz yedek çalışma başlangıç zamanı geçersizdir.');
      if(input.trigger!=='manual'&&input.trigger!=='automatic')throw new Error('Temiz yedek çalışma tetikleyicisi geçersizdir.');
      if(input.runId.trim().length===0)throw new Error('Temiz yedek çalışma kimliği boş olamaz.');
      if(!Number.isFinite(retentionCutoffMs))throw new Error('Temiz yedek saklama kesim zamanı geçersizdir.');
      if(!Number.isInteger(input.dueRecords)||input.dueRecords<0)throw new Error('Temiz yedek bekleyen kayıt sayısı geçersizdir.');
      if(!Number.isInteger(input.enabledTargets)||input.enabledTargets<0)throw new Error('Temiz yedek etkin hedef sayısı geçersizdir.');
      const current=this.database(context).prepare(`SELECT retention_days,updated_at,last_attempt_at,last_success_at FROM backup_clean_rewrite_policy WHERE id='default'`).get() as Record<string,unknown>|undefined;
      if(!current)throw new Error('Temiz yedek yeniden yazım politikası bulunamadı.');
      const floorValues=[current.updated_at,current.last_attempt_at,current.last_success_at].filter((value):value is string=>typeof value==='string'&&value.length>0);
      const floorMs=Math.max(...floorValues.map(value=>{const parsed=Date.parse(value);if(!Number.isFinite(parsed))throw new Error('Kalıcı temiz yedek politika kronolojisi geçersizdir.');return parsed;}));
      if(startedAtMs<floorMs)throw new Error('Temiz yedek çalışma başlangıcı kalıcı politika kronolojisinden önce olamaz.');
      const retentionDays=Number(current.retention_days);
      if(!Number.isInteger(retentionDays)||retentionDays<1||retentionDays>3650)throw new Error('Temiz yedek saklama süresi geçersizdir.');
      if(retentionCutoffMs!==startedAtMs-retentionDays*86_400_000)throw new Error('Temiz yedek saklama kesimi güvenli çalışma başlangıcıyla uyumlu değildir.');
      const reservationResult=this.database(context).prepare(`INSERT INTO backup_clean_rewrite_claim_reservations(run_id,trigger,started_at,retention_cutoff,due_records,enabled_targets,state,created_at) VALUES(?,?,?,?,?,?,'open',?)`).run(input.runId,input.trigger,input.startedAt,input.retentionCutoff,input.dueRecords,input.enabledTargets,input.startedAt) as {changes?:number};
      if(Number(reservationResult.changes??0)!==1)throw new Error('Temiz yedek çalışma sahiplik rezervasyonu oluşturulamadı.');
      const result=this.database(context).prepare(`UPDATE backup_clean_rewrite_policy SET state='running',last_trigger=?,last_attempt_at=?,next_attempt_at=NULL,in_progress_run_id=?,in_progress_started_at=?,last_error=NULL,updated_at=? WHERE id='default' AND (enabled=1 OR ?='manual') AND state<>'running' AND (next_attempt_at IS NULL OR next_attempt_at<=?)`).run(input.trigger,input.startedAt,input.runId,input.startedAt,input.startedAt,input.trigger,input.startedAt) as {changes?:number};
      if(Number(result.changes??0)!==1){
        this.database(context).prepare(`DELETE FROM backup_clean_rewrite_claim_reservations WHERE run_id=? AND state='open'`).run(input.runId);
        return null;
      }
      const runResult=this.database(context).prepare(`INSERT INTO backup_clean_rewrite_runs(id,trigger,status,retention_cutoff,due_records,enabled_targets,started_at,updated_at) VALUES(?,?,'running',?,?,?,?,?)`).run(input.runId,input.trigger,input.retentionCutoff,input.dueRecords,input.enabledTargets,input.startedAt,input.startedAt) as {changes?:number};
      if(Number(runResult.changes??0)!==1)throw new Error('Temiz yedek çalışma defteri sahiplik kaydı oluşturulamadı.');
      const consumed=this.database(context).prepare(`UPDATE backup_clean_rewrite_claim_reservations SET state='consumed',consumed_at=? WHERE run_id=? AND state='open'`).run(input.startedAt,input.runId) as {changes?:number};
      if(Number(consumed.changes??0)!==1)throw new Error('Temiz yedek çalışma sahiplik rezervasyonu kapatılamadı.');
      const owned=this.database(context).prepare(`SELECT 1 AS value FROM backup_clean_rewrite_runs run JOIN backup_clean_rewrite_policy policy ON policy.id='default' JOIN backup_clean_rewrite_claim_reservations reservation ON reservation.run_id=run.id WHERE run.id=? AND run.status='running' AND reservation.state='consumed' AND reservation.trigger=run.trigger AND reservation.retention_cutoff=run.retention_cutoff AND reservation.due_records=run.due_records AND reservation.enabled_targets=run.enabled_targets AND julianday(reservation.started_at)=julianday(run.started_at) AND policy.state='running' AND policy.in_progress_run_id=run.id AND policy.last_trigger=run.trigger AND julianday(policy.in_progress_started_at)=julianday(run.started_at) AND julianday(policy.last_attempt_at)=julianday(run.started_at) AND julianday(policy.updated_at)=julianday(run.updated_at)`).get(input.runId) as Record<string,unknown>|undefined;
      if(Number(owned?.value??0)!==1)throw new Error('Temiz yedek çalışma defteri kalıcı politika sahipliğiyle eşleşmiyor.');
      return mapCleanRewritePolicy(this.database(context).prepare(`SELECT * FROM backup_clean_rewrite_policy WHERE id='default'`).get() as Record<string,unknown>);
    });
  }
  completeCleanRewrite(context:RepositoryExecutionContext,input:{readonly runId:string;readonly state:BackupCleanRewriteState;readonly outcome:BackupCleanRewriteOutcome;readonly runStatus:Exclude<BackupCleanRewriteRunStatus,'running'|'interrupted'>;readonly completedAt:string;readonly nextAttemptAt?:string;readonly error?:string;readonly propagationRunId?:string;readonly success:boolean}):RepositoryResult<{readonly policy:BackupCleanRewritePolicyView;readonly run:BackupCleanRewriteRunView}|null>{
    return this.execute(context,()=>{
      const terminalContract:{readonly state:BackupCleanRewriteState;readonly outcome:BackupCleanRewriteOutcome;readonly success:boolean;readonly retry:boolean}=input.runStatus==='success'
        ?{state:'idle',outcome:'success',success:true,retry:false}
        :input.runStatus==='partial'
          ?{state:'backoff',outcome:'partial',success:false,retry:true}
          :input.runStatus==='failed'
            ?{state:'backoff',outcome:'failed',success:false,retry:true}
            :input.runStatus==='attention'
              ?{state:'attention',outcome:'attention',success:false,retry:true}
              :{state:'deferred',outcome:'deferred',success:false,retry:true};
      if(input.state!==terminalContract.state||input.outcome!==terminalContract.outcome||input.success!==terminalContract.success)throw new Error('Temiz yedek terminal politika ve çalışma durumu birbiriyle uyumlu değildir.');
      if(terminalContract.retry!==Boolean(input.nextAttemptAt))throw new Error('Temiz yedek terminal yeniden deneme zamanı çalışma durumuyla uyumlu değildir.');
      const propagationRequired=input.runStatus==='success'||input.runStatus==='partial';
      if(propagationRequired!==Boolean(input.propagationRunId))throw new Error('Temiz yedek terminal yayılım kimliği çalışma sonucuyla uyumlu değildir.');
      if(input.propagationRunId){
        const propagation=this.database(context).prepare(`SELECT status FROM backup_propagation_runs WHERE id=?`).get(input.propagationRunId) as Record<string,unknown>|undefined;
        const expectedPropagationStatus=input.runStatus==='success'?'success':'partial';
        if(String(propagation?.status??'missing')!==expectedPropagationStatus)throw new Error('Temiz yedek terminal sonucu bağlı yayılım sonucuyla uyumlu değildir.');
      }
      if(input.propagationRunId){
        const reused=this.database(context).prepare(`SELECT id FROM backup_clean_rewrite_runs WHERE propagation_run_id=? AND id<>? LIMIT 1`).get(input.propagationRunId,input.runId) as Record<string,unknown>|undefined;
        if(reused)throw new Error('Temiz yedek yayılım sonucu başka bir çalışma tarafından zaten kullanılmıştır.');
      }
      const completedAtMs=Date.parse(input.completedAt);
      if(!Number.isFinite(completedAtMs))throw new Error('Temiz yedek terminal tamamlanma zamanı geçersizdir.');
      const activeStart=this.database(context).prepare(`SELECT started_at FROM backup_clean_rewrite_runs WHERE id=? AND status='running'`).get(input.runId) as Record<string,unknown>|undefined;
      const activeStartMs=activeStart?Date.parse(String(activeStart.started_at)):Number.NaN;
      if(activeStart&&(!Number.isFinite(activeStartMs)||completedAtMs<activeStartMs))throw new Error('Temiz yedek terminal tamamlanma zamanı çalışma başlangıcından önce olamaz.');
      const ownership=this.database(context).prepare(`SELECT 1 AS value FROM backup_clean_rewrite_policy policy JOIN backup_clean_rewrite_runs run ON run.id=policy.in_progress_run_id JOIN backup_clean_rewrite_claim_reservations reservation ON reservation.run_id=run.id WHERE policy.id='default' AND policy.state='running' AND policy.in_progress_run_id=? AND run.status='running' AND reservation.state='consumed' AND policy.last_trigger=run.trigger AND reservation.trigger=run.trigger AND reservation.retention_cutoff=run.retention_cutoff AND reservation.due_records=run.due_records AND reservation.enabled_targets=run.enabled_targets AND julianday(policy.in_progress_started_at)=julianday(run.started_at) AND julianday(policy.last_attempt_at)=julianday(run.started_at) AND julianday(policy.updated_at)=julianday(run.updated_at) AND julianday(reservation.started_at)=julianday(run.started_at)`).get(input.runId) as Record<string,unknown>|undefined;
      if(Number(ownership?.value??0)!==1)return null;
      const runResult=this.database(context).prepare(`UPDATE backup_clean_rewrite_runs SET status=?,propagation_run_id=?,next_attempt_at=?,error=?,completed_at=?,updated_at=? WHERE id=? AND status='running'`).run(input.runStatus,input.propagationRunId??null,input.nextAttemptAt??null,input.error??null,input.completedAt,input.completedAt,input.runId) as {changes?:number};
      if(Number(runResult.changes??0)!==1)throw new Error('Temiz yedek terminal çalışma defteri ve politika durumu atomik olarak güncellenemedi.');
      const policy=mapCleanRewritePolicy(this.database(context).prepare(`SELECT * FROM backup_clean_rewrite_policy WHERE id='default'`).get() as Record<string,unknown>);
      const run=mapCleanRewriteRun(this.database(context).prepare(`SELECT * FROM backup_clean_rewrite_runs WHERE id=?`).get(input.runId) as Record<string,unknown>);
      return {policy,run};
    });
  }
  recoverInterruptedCleanRewrite(context:RepositoryExecutionContext,input:{readonly observedAt:string;readonly error:string}):RepositoryResult<{readonly policy:BackupCleanRewritePolicyView;readonly run?:BackupCleanRewriteRunView}>{
    return this.execute(context,()=>{
      const observedAtMs=Date.parse(input.observedAt);
      if(!Number.isFinite(observedAtMs))throw new Error('Temiz yedek kesinti kurtarma gözlem zamanı geçersizdir.');
      const current=this.database(context).prepare(`SELECT in_progress_run_id,in_progress_started_at,last_trigger,retention_days,manual_failure_backoff_minutes,automatic_failure_backoff_minutes,updated_at,last_attempt_at,last_success_at FROM backup_clean_rewrite_policy WHERE id='default' AND state='running'`).get() as Record<string,unknown>|undefined;
      if(current){
        const runId=current.in_progress_run_id?String(current.in_progress_run_id):undefined;
        const existingRun=runId?this.database(context).prepare(`SELECT started_at,updated_at FROM backup_clean_rewrite_runs WHERE id=?`).get(runId) as Record<string,unknown>|undefined:undefined;
        const persistedStartedAt=String(existingRun?.started_at??current.in_progress_started_at??input.observedAt);
        const persistedStartedAtMs=Date.parse(persistedStartedAt);
        if(!Number.isFinite(persistedStartedAtMs))throw new Error('Kesilen temiz yedek çalışma başlangıç zamanı geçersizdir.');
        const chronologyValues=[
          ['politika güncelleme',current.updated_at],
          ['son deneme',current.last_attempt_at],
          ['son başarı',current.last_success_at],
          ['politika çalışma başlangıç',current.in_progress_started_at],
          ['çalışma defteri başlangıç',existingRun?.started_at],
          ['çalışma defteri güncelleme',existingRun?.updated_at]
        ] as const;
        let recoveryFloorMs=observedAtMs;
        for(const [label,value] of chronologyValues){
          if(value===null||value===undefined||String(value).length===0)continue;
          const parsed=Date.parse(String(value));
          if(!Number.isFinite(parsed))throw new Error(`Kesilen temiz yedek ${label} zamanı geçersizdir.`);
          recoveryFloorMs=Math.max(recoveryFloorMs,parsed);
        }
        const recoveredAt=new Date(recoveryFloorMs).toISOString();
        const trigger=String(current.last_trigger??'automatic');
        if(trigger!=='manual'&&trigger!=='automatic')throw new Error('Kesilen temiz yedek çalışma tetikleyicisi geçersizdir.');
        const backoffMinutes=Number(trigger==='manual'?current.manual_failure_backoff_minutes:current.automatic_failure_backoff_minutes);
        if(!Number.isInteger(backoffMinutes)||backoffMinutes<1)throw new Error(`Temiz yedek ${trigger==='manual'?'manuel':'otomatik'} geri çekilme süresi geçersizdir.`);
        const nextAttemptAt=new Date(recoveryFloorMs+backoffMinutes*60_000).toISOString();
        if(!runId)throw new Error('Kesilen temiz yedek çalışma sahipliği kimliği bulunamadı.');
        if(existingRun){
          const updated=this.database(context).prepare(`UPDATE backup_clean_rewrite_runs SET status='interrupted',next_attempt_at=?,error=?,completed_at=?,updated_at=? WHERE id=? AND status='running'`).run(nextAttemptAt,input.error,recoveredAt,recoveredAt,runId) as {changes?:number};
          if(Number(updated.changes??0)!==1)throw new Error('Kesilen temiz yedek çalışma defteri ve politika durumu atomik olarak kurtarılamadı.');
        }else{
          const reservation=this.database(context).prepare(`SELECT trigger,started_at,retention_cutoff,due_records,enabled_targets FROM backup_clean_rewrite_claim_reservations WHERE run_id=? AND state='consumed'`).get(runId) as Record<string,unknown>|undefined;
          if(!reservation)throw new Error('Kesilen temiz yedek çalışma rezervasyonu bulunamadı.');
          const inserted=this.database(context).prepare(`INSERT INTO backup_clean_rewrite_runs(id,trigger,status,retention_cutoff,due_records,enabled_targets,next_attempt_at,error,started_at,completed_at,updated_at) VALUES(?,?,'interrupted',?,?,?,?,?,?,?,?)`).run(runId,String(reservation.trigger),String(reservation.retention_cutoff),Number(reservation.due_records),Number(reservation.enabled_targets),nextAttemptAt,input.error,String(reservation.started_at),recoveredAt,recoveredAt) as {changes?:number};
          if(Number(inserted.changes??0)!==1)throw new Error('Kesilen temiz yedek çalışma defteri yeniden oluşturulamadı.');
        }
      }
      const policy=mapCleanRewritePolicy(this.database(context).prepare(`SELECT * FROM backup_clean_rewrite_policy WHERE id='default'`).get() as Record<string,unknown>);
      const runId=current?.in_progress_run_id?String(current.in_progress_run_id):undefined;
      if(!runId)return {policy};
      const row=this.database(context).prepare(`SELECT * FROM backup_clean_rewrite_runs WHERE id=?`).get(runId) as Record<string,unknown>|undefined;
      return row?{policy,run:mapCleanRewriteRun(row)}:{policy};
    });
  }
}
