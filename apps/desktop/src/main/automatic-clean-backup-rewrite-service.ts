import { randomUUID } from 'node:crypto';
import type {
  BackupCleanRewritePolicyView,
  BackupCleanRewriteRunResultView,
  BackupCleanRewriteRunStatus,
  BackupCleanRewriteRunView,
  BackupCleanRewriteStatusView,
  BackupCleanRewriteTrigger,
  BackupCleanRewriteState,
  BackupCleanRewriteOutcome,
  BackupPropagationRunView,
  UpdateBackupCleanRewritePolicyInput
} from '@ppt/domain';

export interface AutomaticCleanBackupRewriteStore {
  getBackupCleanRewriteStatus(at?:string):BackupCleanRewriteStatusView;
  getBackupCleanRewritePolicy():BackupCleanRewritePolicyView;
  listBackupCleanRewriteRuns(limit?:number):readonly BackupCleanRewriteRunView[];
  updateBackupCleanRewritePolicy(input:UpdateBackupCleanRewritePolicyInput):BackupCleanRewritePolicyView;
  claimBackupCleanRewrite(input:{readonly trigger:BackupCleanRewriteTrigger;readonly runId:string;readonly startedAt:string;readonly retentionCutoff:string;readonly dueRecords:number;readonly enabledTargets:number}):BackupCleanRewritePolicyView|null;
  completeBackupCleanRewrite(input:{readonly runId:string;readonly state:BackupCleanRewriteState;readonly outcome:BackupCleanRewriteOutcome;readonly runStatus:Exclude<BackupCleanRewriteRunStatus,'running'|'interrupted'>;readonly completedAt:string;readonly nextAttemptAt?:string;readonly error?:string;readonly propagationRunId?:string;readonly success:boolean}):{readonly policy:BackupCleanRewritePolicyView;readonly run:BackupCleanRewriteRunView}|null;
  recoverInterruptedBackupCleanRewrite(observedAt:string,error:string):BackupCleanRewritePolicyView;
  propagatePurgedDataToManagedBackups(retentionCutoff?:string):BackupPropagationRunView;
  recordDiagnostic(severity:'info'|'warning'|'error',code:string,message:string,details?:string):unknown;
}

const addMinutes=(iso:string,minutes:number)=>new Date(Date.parse(iso)+minutes*60_000).toISOString();
const retentionCutoff=(iso:string,days:number)=>new Date(Date.parse(iso)-days*86_400_000).toISOString();
const failureBackoffMinutes=(trigger:BackupCleanRewriteTrigger,policy:Pick<BackupCleanRewritePolicyView,'manualFailureBackoffMinutes'|'automaticFailureBackoffMinutes'>):number=>
  trigger==='manual'?policy.manualFailureBackoffMinutes:policy.automaticFailureBackoffMinutes;
const requireIsoMs=(value:string,label:string):number=>{
  const parsed=Date.parse(value);
  if(!Number.isFinite(parsed))throw new Error(`${label} zamanı geçersizdir.`);
  return parsed;
};
const requireMonotonicMs=(value:number,label:string):number=>{
  if(!Number.isFinite(value)||value<0)throw new Error(`${label} monotonik zamanı geçersizdir.`);
  return value;
};
const createTerminalChronology=(startedAt:string,startedMonotonicMs:number,monotonicNow:()=>number):((label:string)=>string)=>{
  const startedAtMs=requireIsoMs(startedAt,'Temiz yedek çalışma başlangıç');
  let lastMonotonicMs=requireMonotonicMs(startedMonotonicMs,'Temiz yedek çalışma başlangıç');
  return (_label:string):string=>{
    let currentMonotonicMs:number;
    try{currentMonotonicMs=requireMonotonicMs(monotonicNow(),`Temiz yedek ${_label}`);}catch(error){
      if(error instanceof Error)throw error;
      throw new Error(`Temiz yedek ${_label} monotonik saati okunamadı.`);
    }
    if(currentMonotonicMs<lastMonotonicMs)throw new Error(`Temiz yedek ${_label} monotonik zamanı geriye gidemez.`);
    lastMonotonicMs=currentMonotonicMs;
    return new Date(startedAtMs+currentMonotonicMs-startedMonotonicMs).toISOString();
  };
};
const claimAtOrPolicyFloor=(observedAt:string,policy:BackupCleanRewritePolicyView):{readonly effectiveAt:string;readonly adjusted:boolean;readonly floorAt:string}=>{
  const observedMs=requireIsoMs(observedAt,'Temiz yedek çalışma gözlem');
  const candidates:[string,string|undefined][]=[
    ['politika güncelleme',policy.updatedAt],
    ['son deneme',policy.lastAttemptAt],
    ['son başarı',policy.lastSuccessAt],
    ['devam eden çalışma başlangıç',policy.inProgressStartedAt]
  ];
  let floorMs=observedMs;let floorAt=observedAt;
  for(const [label,value] of candidates){
    if(!value)continue;
    const parsed=requireIsoMs(value,`Temiz yedek ${label}`);
    if(parsed>floorMs){floorMs=parsed;floorAt=value;}
  }
  return {effectiveAt:new Date(floorMs).toISOString(),adjusted:floorMs>observedMs,floorAt:new Date(requireIsoMs(floorAt,'Temiz yedek kronoloji tabanı')).toISOString()};
};
const linkedPropagationCompletion=(propagation:BackupPropagationRunView,runStartedAt:string):string=>{
  const runStartedMs=requireIsoMs(runStartedAt,'Temiz yedek çalışma başlangıç');
  const propagationStartedMs=requireIsoMs(propagation.startedAt,'Bağlı yedek yayılım başlangıç');
  const propagationCompletedMs=requireIsoMs(propagation.completedAt,'Bağlı yedek yayılım tamamlanma');
  if(propagationStartedMs<runStartedMs)throw new Error('Bağlı yedek yayılım başlangıcı temiz yeniden yazım çalışmasından önce olamaz.');
  if(propagationCompletedMs<propagationStartedMs)throw new Error('Bağlı yedek yayılım tamamlanma zamanı başlangıçtan önce olamaz.');
  return new Date(propagationCompletedMs).toISOString();
};

export class AutomaticCleanBackupRewriteService {
  #running=false;
  constructor(private readonly resolveStore:()=>AutomaticCleanBackupRewriteStore,private readonly now:()=>string=()=>new Date().toISOString(),private readonly monotonicNow:()=>number=()=>0){}

  status():BackupCleanRewriteStatusView{return this.resolveStore().getBackupCleanRewriteStatus(this.now());}
  listRuns(limit=20):readonly BackupCleanRewriteRunView[]{return this.resolveStore().listBackupCleanRewriteRuns(limit);}
  updatePolicy(input:UpdateBackupCleanRewritePolicyInput):BackupCleanRewritePolicyView{
    const store=this.resolveStore();
    const policy=store.getBackupCleanRewritePolicy();
    if(policy.state==='running')throw new Error('Aktif temiz yedek çalışması tamamlanmadan politika ayarları değiştirilemez.');
    return store.updateBackupCleanRewritePolicy(input);
  }

  recoverInterrupted():BackupCleanRewritePolicyView {
    const store=this.resolveStore();const observedAt=this.now();const policy=store.getBackupCleanRewritePolicy();
    if(policy.state!=='running')return policy;
    const runningRun=policy.inProgressRunId?store.listBackupCleanRewriteRuns(100).find(run=>run.id===policy.inProgressRunId):undefined;
    const floorCandidates=[policy.updatedAt,policy.lastAttemptAt,policy.lastSuccessAt,policy.inProgressStartedAt,runningRun?.startedAt,runningRun?.updatedAt].filter((value):value is string=>Boolean(value));
    let safeObservedMs=requireIsoMs(observedAt,'Kesinti kurtarma gözlem');
    for(const value of floorCandidates)safeObservedMs=Math.max(safeObservedMs,requireIsoMs(value,'Kesinti kurtarma kalıcı kronoloji'));
    const safeObservedAt=new Date(safeObservedMs).toISOString();
    const clockAdjusted=safeObservedAt!==new Date(requireIsoMs(observedAt,'Kesinti kurtarma gözlem')).toISOString();
    const recovered=store.recoverInterruptedBackupCleanRewrite(safeObservedAt,'Önceki temiz yedek yeniden yazımı uygulama kapanması nedeniyle kesildi; güvenli geri çekilme uygulandı.');
    this.#recordDiagnostic(
      store,
      'warning',
      clockAdjusted?'backup.clean_rewrite_recovered_clock_adjusted':'backup.clean_rewrite_recovered',
      clockAdjusted?'Kesinti kurtarmasında sistem saati geri alınmıştı; kalıcı politika ve çalışma defterinin en ileri zamanı güvenli taban olarak kullanıldı.':'Kesintiye uğrayan temiz yedek yeniden yazımı güvenli biçimde geri çekildi.',
      `Sonraki deneme: ${recovered.nextAttemptAt??'belirsiz'}${policy.inProgressStartedAt?`; çalışma başlangıcı: ${policy.inProgressStartedAt}`:''}${runningRun?.updatedAt?`; defter güncellemesi: ${runningRun.updatedAt}`:''}; gözlenen saat: ${observedAt}; güvenli kurtarma: ${safeObservedAt}`
    );
    return recovered;
  }

  runManual():BackupCleanRewriteRunResultView{return this.#run('manual');}
  runAutomaticCycle():BackupCleanRewriteRunResultView{return this.#run('automatic');}

  #complete(store:AutomaticCleanBackupRewriteStore,input:Parameters<AutomaticCleanBackupRewriteStore['completeBackupCleanRewrite']>[0]):{readonly policy:BackupCleanRewritePolicyView;readonly run:BackupCleanRewriteRunView} {
    const completed=store.completeBackupCleanRewrite(input);
    if(!completed)throw new Error('Temiz yedek yeniden yazım çalışma sahipliği kayboldu; atomik tamamlama reddedildi.');
    return completed;
  }

  #recordDiagnostic(store:AutomaticCleanBackupRewriteStore,severity:'info'|'warning'|'error',code:string,message:string,details?:string):void {
    try { store.recordDiagnostic(severity,code,message,details); } catch { /* Kalıcı çalışma kaydı tanı altyapısından bağımsızdır. */ }
  }

  #run(trigger:BackupCleanRewriteTrigger):BackupCleanRewriteRunResultView {
    const store=this.resolveStore();const observedAt=this.now();const initial=store.getBackupCleanRewriteStatus(observedAt);
    const claimClock=claimAtOrPolicyFloor(observedAt,initial.policy);
    const checkedAt=claimClock.effectiveAt;
    const before=claimClock.adjusted?store.getBackupCleanRewriteStatus(checkedAt):initial;
    if(this.#running)return {trigger,status:'skipped',reason:'Bu süreçte başka bir temiz yedek yeniden yazımı çalışıyor.',policy:before.policy,checkedAt};
    if(trigger==='automatic'&&!before.policy.enabled)return {trigger,status:'skipped',reason:'Otomatik temiz yedek yeniden yazım politikası kapalı.',policy:before.policy,checkedAt};
    if(before.dueRecords===0)return {trigger,status:'skipped',reason:'Saklama süresi dolmuş bekleyen imha kaydı bulunmuyor.',policy:before.policy,checkedAt};
    const runId=`clean-rewrite-${randomUUID()}`;
    const cutoff=retentionCutoff(checkedAt,before.policy.retentionDays);
    let startedMonotonicMs:number;
    try{startedMonotonicMs=requireMonotonicMs(this.monotonicNow(),'Temiz yedek çalışma başlangıç');}catch(error){
      const message=error instanceof Error?error.message:String(error);
      this.#recordDiagnostic(store,'error','backup.clean_rewrite_monotonic_start_invalid','Temiz yedek yeniden yazımı güvenilir monotonik başlangıç zamanı alınamadığı için başlatılmadı.',message);
      throw error;
    }
    const captureTerminalAt=createTerminalChronology(checkedAt,startedMonotonicMs,this.monotonicNow);
    const claimed=store.claimBackupCleanRewrite({trigger,runId,startedAt:checkedAt,retentionCutoff:cutoff,dueRecords:before.dueRecords,enabledTargets:before.enabledTargets});
    if(!claimed)return {trigger,status:'skipped',reason:'Politika geri çekilme süresinde veya başka bir çalışma tarafından sahiplenilmiş.',policy:store.getBackupCleanRewritePolicy(),checkedAt};
    if(claimClock.adjusted)this.#recordDiagnostic(store,'warning','backup.clean_rewrite_claim_clock_adjusted','Yeni temiz yedek çalışması sistem saati geri alınmış olsa da kalıcı politika kronolojisine göre sahiplenildi.',`Gözlenen saat: ${observedAt}; güvenli çalışma başlangıcı: ${checkedAt}; kronoloji tabanı: ${claimClock.floorAt}`);
    this.#running=true;
    try {
      if(before.adaptiveDeferred){
        const completedAt=captureTerminalAt('erteleme tamamlanma');
        const nextAttemptAt=addMinutes(completedAt,claimed.highLoadDeferMinutes);
        const finalized=this.#complete(store,{runId,state:'deferred',outcome:'deferred',runStatus:'deferred',completedAt,nextAttemptAt,error:before.adaptiveReason??'Yüksek sistem yükü',success:false});
        this.#recordDiagnostic(store,'warning','backup.clean_rewrite_deferred','Temiz yedek yeniden yazımı yüksek sistem yükü nedeniyle güvenli biçimde ertelendi.',`Sonraki deneme: ${nextAttemptAt}; ${before.adaptiveReason??''}`);
        return {trigger,status:'deferred',...(before.adaptiveReason?{reason:before.adaptiveReason}:{}),rewriteRun:finalized.run,policy:finalized.policy,checkedAt};
      }
      if(before.enabledTargets===0){
        const completedAt=captureTerminalAt('hedefsiz çalışma tamamlanma');
        const nextAttemptAt=addMinutes(completedAt,failureBackoffMinutes(trigger,claimed));
        const reason='Etkin yönetilen yedek hedefi bulunamadı.';
        const finalized=this.#complete(store,{runId,state:'attention',outcome:'attention',runStatus:'attention',completedAt,nextAttemptAt,error:reason,success:false});
        this.#recordDiagnostic(store,'warning','backup.clean_rewrite_no_target','Saklama süresi dolmuş imha kayıtları var ancak etkin yönetilen yedek hedefi bulunamadı.',`Bekleyen kayıt: ${before.dueRecords}`);
        return {trigger,status:'attention',reason,rewriteRun:finalized.run,policy:finalized.policy,checkedAt};
      }
      const propagation=store.propagatePurgedDataToManagedBackups(cutoff);
      const completedAt=linkedPropagationCompletion(propagation,checkedAt);
      if(propagation.status==='success'){
        const finalized=this.#complete(store,{runId,state:'idle',outcome:'success',runStatus:'success',completedAt,propagationRunId:propagation.id,success:true});
        this.#recordDiagnostic(store,'info','backup.clean_rewrite_completed','Saklama süresi dolan eski tam yedekler doğrulanmış temiz yedeklerle değiştirildi.',`Yenilenen hedef: ${propagation.refreshedTargets}/${propagation.targetCount}; karantina: ${propagation.quarantinedArtifacts}; çalışma: ${runId}`);
        return {trigger,status:'success',propagationRun:propagation,rewriteRun:finalized.run,policy:finalized.policy,checkedAt:completedAt};
      }
      const delay=failureBackoffMinutes(trigger,claimed);
      const nextAttemptAt=addMinutes(completedAt,delay);
      const reason=propagation.error??`${propagation.pendingRemaining} kayıt beklemede kaldı.`;
      const finalized=this.#complete(store,{runId,state:'backoff',outcome:'partial',runStatus:'partial',completedAt,nextAttemptAt,error:reason,propagationRunId:propagation.id,success:false});
      this.#recordDiagnostic(store,'warning','backup.clean_rewrite_partial','Temiz yedek yeniden yazımı kısmi tamamlandı ve geri çekilme süresine alındı.',`Sonraki deneme: ${nextAttemptAt}; ${reason}; çalışma: ${runId}`);
      return {trigger,status:'failed',reason,propagationRun:propagation,rewriteRun:finalized.run,policy:finalized.policy,checkedAt:completedAt};
    } catch(error){
      let completedAt:string;
      try{completedAt=captureTerminalAt('hata tamamlanma');}catch(chronologyError){
        this.#recordDiagnostic(store,'error','backup.clean_rewrite_terminal_chronology_invalid','Temiz yedek yeniden yazımı terminal zamanı güvenilir monotonik kronolojiyle üretilemediği için sonuçlandırılmadı.',chronologyError instanceof Error?chronologyError.message:String(chronologyError));
        throw chronologyError;
      }
      const message=error instanceof Error?error.message:String(error);
      const delay=failureBackoffMinutes(trigger,claimed);
      const nextAttemptAt=addMinutes(completedAt,delay);
      let finalized:{readonly policy:BackupCleanRewritePolicyView;readonly run:BackupCleanRewriteRunView}|null=null;
      try { finalized=store.completeBackupCleanRewrite({runId,state:'backoff',outcome:'failed',runStatus:'failed',completedAt,nextAttemptAt,error:message,success:false}); } catch(finalizationError) {
        this.#recordDiagnostic(store,'error','backup.clean_rewrite_finalization_failed','Temiz yedek yeniden yazım hatası atomik çalışma kaydına yazılamadı.',finalizationError instanceof Error?finalizationError.message:String(finalizationError));
      }
      const policy=finalized?.policy??store.getBackupCleanRewritePolicy();
      this.#recordDiagnostic(store,'error','backup.clean_rewrite_failed','Temiz yedek yeniden yazımı başarısız oldu ve güvenli geri çekilme uygulandı.',`Sonraki deneme: ${nextAttemptAt}; ${message}; çalışma: ${runId}`);
      return {trigger,status:'failed',reason:message,...(finalized?{rewriteRun:finalized.run}:{}),policy,checkedAt:completedAt};
    } finally {this.#running=false;}
  }
}
