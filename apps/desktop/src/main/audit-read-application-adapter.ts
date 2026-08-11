import type { AuditReadApplicationContext, AuditReadQueryPort } from '@ppt/application';
import type { TransactionExecutor, TransactionContext } from '@ppt/repository-contracts';
import type { AuditRepositoryPort, RepositoryExecutionContext } from '@ppt/repository-contracts';

export interface RepositoryBackedAuditReadDependencies { readonly transactionExecutor:TransactionExecutor; readonly auditRepository:AuditRepositoryPort; }
const repositoryContext=(context:AuditReadApplicationContext,transaction:TransactionContext):RepositoryExecutionContext=>({transaction:transaction.transaction,actor:{userId:context.actorId,roles:['family_member']},correlationId:context.correlationId,occurredAt:transaction.occurredAt});
export class RepositoryBackedAuditReadQueryPort implements AuditReadQueryPort {
  public constructor(private readonly dependencies:RepositoryBackedAuditReadDependencies){}
  public latestOccurredAt(context:AuditReadApplicationContext){
    return this.dependencies.transactionExecutor.execute(context.correlationId,t=>this.dependencies.auditRepository.latestOccurredAt(repositoryContext(context,t)));
  }
}
