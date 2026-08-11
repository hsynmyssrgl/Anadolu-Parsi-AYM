import type { AppendAuditCommand, AuditWriteApplicationContext, AuditWriteCommandPort } from '@ppt/application';
import type { TransactionExecutor } from '@ppt/repository-contracts';
import type { AuditRepositoryPort, RepositoryExecutionContext } from '@ppt/repository-contracts';

export interface RepositoryBackedAuditWriteDependencies { readonly transactionExecutor:TransactionExecutor; readonly auditRepository:AuditRepositoryPort; }
const repositoryContext=(context:AuditWriteApplicationContext,transaction:RepositoryExecutionContext['transaction']):RepositoryExecutionContext=>({transaction,actor:{userId:context.actorId,roles:['family_member']},correlationId:context.correlationId,occurredAt:context.occurredAt});
export class RepositoryBackedAuditWriteCommandPort implements AuditWriteCommandPort {
  public constructor(private readonly dependencies:RepositoryBackedAuditWriteDependencies){}
  public append(context:AuditWriteApplicationContext,input:AppendAuditCommand){
    return this.dependencies.transactionExecutor.execute(context.correlationId,transaction=>this.dependencies.auditRepository.append(repositoryContext(context,transaction.transaction),{...input,occurredAt:context.occurredAt,actorId:context.actorId}));
  }
}
