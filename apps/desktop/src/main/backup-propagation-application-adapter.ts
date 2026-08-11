import type { AppError, Result } from '@ppt/core';
import type {
  BackupPropagationApplicationContext,
  BackupPropagationQueryPort,
  BackupPropagationWritePort
} from '@ppt/application';
import type {
  BackupPropagationRepositoryPort,
  RepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';

export interface RepositoryBackedBackupPropagationDependencies {
  readonly transactionExecutor:TransactionExecutor;
  readonly repository:BackupPropagationRepositoryPort;
}
const repositoryContext=(context:BackupPropagationApplicationContext,transaction:TransactionContext):RepositoryExecutionContext=>({
  transaction:transaction.transaction,
  actor:{userId:context.actor.userId,roles:[context.actor.role]},
  correlationId:context.correlationId,
  occurredAt:transaction.occurredAt
});
export class RepositoryBackedBackupPropagationAdapter implements BackupPropagationQueryPort,BackupPropagationWritePort {
  constructor(private readonly dependencies:RepositoryBackedBackupPropagationDependencies){}
  #execute<T>(context:BackupPropagationApplicationContext,operation:(repository:RepositoryExecutionContext)=>Result<T,AppError>){
    return this.dependencies.transactionExecutor.execute(context.correlationId,transaction=>operation(repositoryContext(context,transaction)));
  }
  listPending(context:BackupPropagationApplicationContext){return this.#execute(context,repository=>this.dependencies.repository.listPending(repository));}
  listRuns(context:BackupPropagationApplicationContext,limit:number){return this.#execute(context,repository=>this.dependencies.repository.listRuns(repository,limit));}
  getCleanRewritePolicy(context:BackupPropagationApplicationContext){return this.#execute(context,repository=>this.dependencies.repository.getCleanRewritePolicy(repository));}
  listCleanRewriteRuns(context:BackupPropagationApplicationContext,limit:number){return this.#execute(context,repository=>this.dependencies.repository.listCleanRewriteRuns(repository,limit));}
  markCompleted(context:BackupPropagationApplicationContext,records:Parameters<BackupPropagationWritePort['markCompleted']>[1],completedAt:string){return this.#execute(context,repository=>this.dependencies.repository.markCompleted(repository,records,completedAt));}
  insertRun(context:BackupPropagationApplicationContext,run:Parameters<BackupPropagationWritePort['insertRun']>[1]){return this.#execute(context,repository=>this.dependencies.repository.insertRun(repository,run));}
  updateCleanRewritePolicy(context:BackupPropagationApplicationContext,input:Parameters<BackupPropagationWritePort['updateCleanRewritePolicy']>[1]){return this.#execute(context,repository=>this.dependencies.repository.updateCleanRewritePolicy(repository,input));}
  claimCleanRewrite(context:BackupPropagationApplicationContext,input:Parameters<BackupPropagationWritePort['claimCleanRewrite']>[1]){return this.#execute(context,repository=>this.dependencies.repository.claimCleanRewrite(repository,input));}
  completeCleanRewrite(context:BackupPropagationApplicationContext,input:Parameters<BackupPropagationWritePort['completeCleanRewrite']>[1]){return this.#execute(context,repository=>this.dependencies.repository.completeCleanRewrite(repository,input));}
  recoverInterruptedCleanRewrite(context:BackupPropagationApplicationContext,input:Parameters<BackupPropagationWritePort['recoverInterruptedCleanRewrite']>[1]){return this.#execute(context,repository=>this.dependencies.repository.recoverInterruptedCleanRewrite(repository,input));}
}
