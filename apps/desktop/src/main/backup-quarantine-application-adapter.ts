import type { AppError, Result } from '@ppt/core';
import type {
  BackupQuarantineApplicationContext,
  BackupQuarantineQueryPort,
  BackupQuarantineWritePort
} from '@ppt/application';
import type {
  BackupQuarantineRepositoryPort,
  RepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';

export interface RepositoryBackedBackupQuarantineDependencies {
  readonly transactionExecutor:TransactionExecutor;
  readonly repository:BackupQuarantineRepositoryPort;
}
const repositoryContext=(context:BackupQuarantineApplicationContext,transaction:TransactionContext):RepositoryExecutionContext=>({
  transaction:transaction.transaction,
  actor:{userId:context.actor.userId,roles:[context.actor.role]},
  correlationId:context.correlationId,
  occurredAt:transaction.occurredAt
});
export class RepositoryBackedBackupQuarantineAdapter implements BackupQuarantineQueryPort,BackupQuarantineWritePort {
  constructor(private readonly dependencies:RepositoryBackedBackupQuarantineDependencies){}
  #execute<T>(context:BackupQuarantineApplicationContext,operation:(repository:RepositoryExecutionContext)=>Result<T,AppError>){return this.dependencies.transactionExecutor.execute(context.correlationId,transaction=>operation(repositoryContext(context,transaction)));}
  getPolicy(context:BackupQuarantineApplicationContext){return this.#execute(context,repository=>this.dependencies.repository.getPolicy(repository));}
  listBatches(context:BackupQuarantineApplicationContext,limit:number){return this.#execute(context,repository=>this.dependencies.repository.listBatches(repository,limit));}
  findBatch(context:BackupQuarantineApplicationContext,id:string){return this.#execute(context,repository=>this.dependencies.repository.findBatch(repository,id));}
  updatePolicy(context:BackupQuarantineApplicationContext,retentionDays:number,updatedAt:string){return this.#execute(context,repository=>this.dependencies.repository.updatePolicy(repository,retentionDays,updatedAt));}
  insertBatch(context:BackupQuarantineApplicationContext,row:Parameters<BackupQuarantineWritePort['insertBatch']>[1]){return this.#execute(context,repository=>this.dependencies.repository.insertBatch(repository,row));}
  setLegalHold(context:BackupQuarantineApplicationContext,input:Parameters<BackupQuarantineWritePort['setLegalHold']>[1]){return this.#execute(context,repository=>this.dependencies.repository.setLegalHold(repository,input));}
  beginDestruction(context:BackupQuarantineApplicationContext,input:Parameters<BackupQuarantineWritePort['beginDestruction']>[1]){return this.#execute(context,repository=>this.dependencies.repository.beginDestruction(repository,input));}
  completeDestruction(context:BackupQuarantineApplicationContext,input:Parameters<BackupQuarantineWritePort['completeDestruction']>[1]){return this.#execute(context,repository=>this.dependencies.repository.completeDestruction(repository,input));}
}
