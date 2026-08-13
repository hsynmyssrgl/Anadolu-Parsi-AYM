import { ERROR_CODES, asPersonId, createAppError, err, ok, type AppError, type Result } from '@ppt/core';
import {
  buildLongTermPortfolioWorkspace,
  type LongTermPortfolioApplicationContext,
  type LongTermPortfolioPolicyIntent,
  type LongTermPortfolioQueryPort,
  type LongTermPortfolioUnitOfWork,
  type LongTermPortfolioWriteScope
} from '@ppt/application';
import type { DomainEvent } from '@ppt/events';
import type { LongTermPortfolioPrivacy, RecordLongTermPortfolioItemInput } from '@ppt/domain';
import type { PlatformPolicyTransactionContext } from '@ppt/platform-policy';
import type {
  AccountRepositoryPort,
  AuditRepositoryPort,
  LongTermPortfolioRepository,
  FinanceRepositoryPort,
  ObjectPermissionRepositoryPort,
  OutboxRepositoryPort,
  PersonRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';
import { CentralAuthorizationService } from '@ppt/security';
import {
  executeGovernedFinancePolicy,
  establishGovernedFinanceTransaction,
  financeLegacyAllowed,
  governedFinanceRepositoryContext,
  loadFinanceAuthorizationSnapshot,
  type FinancePolicyEnforcementPoint,
  type FinancePolicyEnforcementPointResolver
} from './finance-application-adapter.js';

export interface RepositoryBackedLongTermPortfolioDependencies {
  readonly transactionExecutor:TransactionExecutor;
  readonly repository:LongTermPortfolioRepository;
  readonly financeRepository:FinanceRepositoryPort;
  readonly accountRepository:AccountRepositoryPort;
  readonly permissionRepository:ObjectPermissionRepositoryPort;
  readonly personRepository:PersonRepositoryPort;
  readonly auditRepository:AuditRepositoryPort;
  readonly outboxRepository:OutboxRepositoryPort;
  readonly policyEnforcementPointResolver:FinancePolicyEnforcementPointResolver;
  readonly clusterFence:Parameters<typeof executeGovernedFinancePolicy>[0]['clusterFence'];
}

const asFinanceContext=(context:LongTermPortfolioApplicationContext)=>context;
const asFinanceIntent=(intent:LongTermPortfolioPolicyIntent)=>intent;

const visibleToActor=(dependencies:RepositoryBackedLongTermPortfolioDependencies,context:LongTermPortfolioApplicationContext,execution:PolicyAuthorizedRepositoryExecutionContext,input:{readonly id:string;readonly ownerPersonId:string;readonly privacy:'private'|'selected_members'|'family'}):Result<boolean,AppError>=>{
  const snapshot=loadFinanceAuthorizationSnapshot({
    transactionExecutor:dependencies.transactionExecutor,financeRepository:dependencies.financeRepository,
    accountRepository:dependencies.accountRepository,permissionRepository:dependencies.permissionRepository,
    personRepository:dependencies.personRepository,auditRepository:dependencies.auditRepository,outboxRepository:dependencies.outboxRepository,
    policyEnforcementPointResolver:dependencies.policyEnforcementPointResolver,clusterFence:dependencies.clusterFence
  },asFinanceContext(context),execution);
  if(!snapshot.ok)return snapshot;
  return {ok:true,value:financeLegacyAllowed(new CentralAuthorizationService(),snapshot.value,{action:'read',resourceType:'finance_record',resourceId:input.id,ownerPersonId:input.ownerPersonId,occurredAt:execution.occurredAt,privacy:input.privacy})};
};

export class RepositoryBackedLongTermPortfolioQueryPort implements LongTermPortfolioQueryPort {
  public constructor(private readonly dependencies:RepositoryBackedLongTermPortfolioDependencies){}
  public getWorkspace(context:LongTermPortfolioApplicationContext):Promise<Result<ReturnType<LongTermPortfolioQueryPort['getWorkspace']> extends Promise<Result<infer V,AppError>>?V:never,AppError>>{
    const intent:LongTermPortfolioPolicyIntent={action:'read',capability:'finance.read',resourceType:'finance_record',resourceId:'*',purpose:'finance'};
    return executeGovernedFinancePolicy(this.dependencies,asFinanceContext(context),asFinanceIntent(intent),(authorization,enforcementPoint)=>this.dependencies.transactionExecutor.execute(context.correlationId,transaction=>{
      const established=establishGovernedFinanceTransaction(enforcementPoint,{context:asFinanceContext(context),intent:asFinanceIntent(intent),authorization,transaction});if(!established.ok)return established;
      const execution=governedFinanceRepositoryContext(asFinanceContext(context),transaction,authorization,asFinanceIntent(intent));
      const portfolios=this.dependencies.repository.listPortfolios(execution);if(!portfolios.ok)return portfolios;
      const visible=[];for(const portfolio of portfolios.value){const allowed=visibleToActor(this.dependencies,context,execution,portfolio);if(!allowed.ok)return allowed;if(allowed.value)visible.push(portfolio);}
      const portfolio=visible[0];const revisions=this.dependencies.repository.listInstrumentRevisions(execution);if(!revisions.ok)return revisions;
      const planVersions=portfolio?this.dependencies.repository.listPlanVersions(execution,portfolio.id):{ok:true as const,value:[]};if(!planVersions.ok)return planVersions;
      const allocations=portfolio?this.dependencies.repository.listAllocations(execution,portfolio.id):{ok:true as const,value:[]};if(!allocations.ok)return allocations;
      const events=portfolio?this.dependencies.repository.listLedgerEvents(execution,portfolio.id):{ok:true as const,value:[]};if(!events.ok)return events;
      const prices=portfolio?this.dependencies.repository.listPriceObservations(execution,portfolio.id):{ok:true as const,value:[]};if(!prices.ok)return prices;
      const visibleRevisions=portfolio?revisions.value.filter(row=>row.ownerPersonId===portfolio.ownerPersonId&&row.privacy===portfolio.privacy):[];
      return {ok:true,value:buildLongTermPortfolioWorkspace({portfolios:visible,instrumentRevisions:visibleRevisions,planVersions:planVersions.value,allocations:allocations.value,ledgerEvents:events.value,priceObservations:prices.value,generatedAt:execution.occurredAt})};
    }));
  }
}

class GovernedLongTermPortfolioWriteScope implements LongTermPortfolioWriteScope {
  readonly #authorization=new CentralAuthorizationService();
  readonly #snapshot;
  public constructor(private readonly dependencies:RepositoryBackedLongTermPortfolioDependencies,private readonly context:LongTermPortfolioApplicationContext,private readonly execution:PolicyAuthorizedRepositoryExecutionContext,public readonly occurredAt:LongTermPortfolioWriteScope['occurredAt']){
    this.#snapshot=loadFinanceAuthorizationSnapshot({transactionExecutor:dependencies.transactionExecutor,financeRepository:dependencies.financeRepository,accountRepository:dependencies.accountRepository,permissionRepository:dependencies.permissionRepository,personRepository:dependencies.personRepository,auditRepository:dependencies.auditRepository,outboxRepository:dependencies.outboxRepository,policyEnforcementPointResolver:dependencies.policyEnforcementPointResolver,clusterFence:dependencies.clusterFence},asFinanceContext(context),execution);
  }
  public findPerson(id:Parameters<LongTermPortfolioWriteScope['findPerson']>[0]){const value=this.dependencies.personRepository.findById(this.execution,id);return value.ok?{ok:true as const,value:value.value?{id:value.value.id,familyId:value.value.familyId}:null}:value;}
  public findMutationByClientOperationId(clientOperationId:string){return this.dependencies.repository.findMutationByClientOperationId(this.execution,clientOperationId);}
  public listPortfolios(){return this.dependencies.repository.listPortfolios(this.execution);}
  public findPortfolio(id:string){return this.dependencies.repository.findPortfolio(this.execution,id);}
  public listInstrumentRevisions(){return this.dependencies.repository.listInstrumentRevisions(this.execution);}
  public findInstrument(id:string){return this.dependencies.repository.findInstrument(this.execution,id);}
  public findInstrumentRevision(id:string){return this.dependencies.repository.findInstrumentRevision(this.execution,id);}
  public listPlanVersions(portfolioId:string){return this.dependencies.repository.listPlanVersions(this.execution,portfolioId);}
  public listAllocations(portfolioId:string){return this.dependencies.repository.listAllocations(this.execution,portfolioId);}
  public listLedgerEvents(portfolioId:string){return this.dependencies.repository.listLedgerEvents(this.execution,portfolioId);}
  public findLedgerEvent(id:string){return this.dependencies.repository.findLedgerEvent(this.execution,id);}
  public listPriceObservations(portfolioId:string){return this.dependencies.repository.listPriceObservations(this.execution,portfolioId);}
  public authorize(input:Parameters<LongTermPortfolioWriteScope['authorize']>[0]){if(!this.#snapshot.ok)return this.#snapshot;return {ok:true as const,value:financeLegacyAllowed(this.#authorization,this.#snapshot.value,{...input,occurredAt:this.execution.occurredAt})};}
  public insertMutation(row:Parameters<LongTermPortfolioWriteScope['insertMutation']>[0]){return this.dependencies.repository.insertMutation(this.execution,row);}
  public insertInstrument(row:Parameters<LongTermPortfolioWriteScope['insertInstrument']>[0]){return this.dependencies.repository.insertInstrument(this.execution,row);}
  public insertInstrumentRevision(row:Parameters<LongTermPortfolioWriteScope['insertInstrumentRevision']>[0]){return this.dependencies.repository.insertInstrumentRevision(this.execution,row);}
  public insertPortfolio(row:Parameters<LongTermPortfolioWriteScope['insertPortfolio']>[0]){return this.dependencies.repository.insertPortfolio(this.execution,row);}
  public insertPlanVersion(row:Parameters<LongTermPortfolioWriteScope['insertPlanVersion']>[0]){return this.dependencies.repository.insertPlanVersion(this.execution,row);}
  public insertAllocation(row:Parameters<LongTermPortfolioWriteScope['insertAllocation']>[0]){return this.dependencies.repository.insertAllocation(this.execution,row);}
  public insertPlanSeal(row:Parameters<LongTermPortfolioWriteScope['insertPlanSeal']>[0]){return this.dependencies.repository.insertPlanSeal(this.execution,row);}
  public insertLedgerEvent(row:Parameters<LongTermPortfolioWriteScope['insertLedgerEvent']>[0]){return this.dependencies.repository.insertLedgerEvent(this.execution,row);}
  public insertPriceObservation(row:Parameters<LongTermPortfolioWriteScope['insertPriceObservation']>[0]){return this.dependencies.repository.insertPriceObservation(this.execution,row);}
  public appendAudit(input:Parameters<LongTermPortfolioWriteScope['appendAudit']>[0]){return this.dependencies.auditRepository.append(this.execution,input);}
  public enqueueEvent<T>(event:DomainEvent<T>){return this.dependencies.outboxRepository.enqueue(this.execution,event);}
}

export class RepositoryBackedLongTermPortfolioUnitOfWork implements LongTermPortfolioUnitOfWork {
  public constructor(private readonly dependencies:RepositoryBackedLongTermPortfolioDependencies){}
  public resolvePolicyScope(context:LongTermPortfolioApplicationContext,command:RecordLongTermPortfolioItemInput):Promise<Result<{readonly ownerPersonId:ReturnType<typeof asPersonId>;readonly privacy:LongTermPortfolioPrivacy},AppError>>{
    if(command.itemType==='bootstrap_default')return Promise.resolve(ok({ownerPersonId:asPersonId(command.ownerPersonId),privacy:command.privacy}));
    if(!context.actor.personId)return Promise.resolve(err(createAppError({code:ERROR_CODES.AUTHORIZATION_DENIED,message:'Portföy yazma kapsamı için kişi kimliği gereklidir.',category:'authorization',correlationId:context.correlationId})));
    const intent:LongTermPortfolioPolicyIntent={action:'read',capability:'finance.read',resourceType:'finance_record',resourceId:'*',purpose:'finance'};
    return executeGovernedFinancePolicy(this.dependencies,asFinanceContext(context),asFinanceIntent(intent),(authorization,enforcementPoint)=>this.dependencies.transactionExecutor.execute(context.correlationId,transaction=>{
      const established=establishGovernedFinanceTransaction(enforcementPoint,{context:asFinanceContext(context),intent:asFinanceIntent(intent),authorization,transaction});if(!established.ok)return established;
      const execution=governedFinanceRepositoryContext(asFinanceContext(context),transaction,authorization,asFinanceIntent(intent));
      let scoped:{readonly id:string;readonly ownerPersonId:ReturnType<typeof asPersonId>;readonly privacy:'private'|'selected_members'|'family'}|undefined;
      if(command.itemType==='instrument_revision'){
        if(command.replacesRevisionId){const revision=this.dependencies.repository.findInstrumentRevision(execution,command.replacesRevisionId);if(!revision.ok)return revision;if(revision.value){const instrument=this.dependencies.repository.findInstrument(execution,revision.value.instrumentId);if(!instrument.ok)return instrument;scoped=instrument.value??undefined;}}
        else if(command.instrumentId){const instrument=this.dependencies.repository.findInstrument(execution,command.instrumentId);if(!instrument.ok)return instrument;scoped=instrument.value??undefined;}
        else {const portfolios=this.dependencies.repository.listPortfolios(execution);if(!portfolios.ok)return portfolios;scoped=portfolios.value[0];}
      }else if(command.itemType==='plan_version'||command.itemType==='ledger_event'){
        const portfolio=this.dependencies.repository.findPortfolio(execution,command.portfolioId);if(!portfolio.ok)return portfolio;scoped=portfolio.value??undefined;
      }else{
        const portfolios=this.dependencies.repository.listPortfolios(execution);if(!portfolios.ok)return portfolios;scoped=portfolios.value[0];
      }
      if(!scoped)return err(createAppError({code:ERROR_CODES.RESOURCE_NOT_FOUND,message:'Uzun vadeli portföy politika kapsamı bulunamadı.',category:'not_found',correlationId:context.correlationId}));
      const allowed=visibleToActor(this.dependencies,context,execution,scoped);if(!allowed.ok)return allowed;if(!allowed.value)return err(createAppError({code:ERROR_CODES.AUTHORIZATION_DENIED,message:'Uzun vadeli portföy politika kapsamına erişim reddedildi.',category:'authorization',correlationId:context.correlationId}));
      return ok({ownerPersonId:asPersonId(scoped.ownerPersonId),privacy:scoped.privacy});
    }));
  }
  public execute<T>(context:LongTermPortfolioApplicationContext,intent:LongTermPortfolioPolicyIntent,operation:(scope:LongTermPortfolioWriteScope)=>Result<T,AppError>):Promise<Result<T,AppError>>{
    return executeGovernedFinancePolicy(this.dependencies,asFinanceContext(context),asFinanceIntent(intent),(authorization:PlatformPolicyTransactionContext,enforcementPoint:FinancePolicyEnforcementPoint)=>this.dependencies.transactionExecutor.execute(context.correlationId,transaction=>{
      const established=establishGovernedFinanceTransaction(enforcementPoint,{context:asFinanceContext(context),intent:asFinanceIntent(intent),authorization,transaction});if(!established.ok)return established;
      const execution=governedFinanceRepositoryContext(asFinanceContext(context),transaction,authorization,asFinanceIntent(intent));return operation(new GovernedLongTermPortfolioWriteScope(this.dependencies,context,execution,transaction.occurredAt));
    }));
  }
}
