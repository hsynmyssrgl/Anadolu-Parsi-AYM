import type { AppError, Result } from '@ppt/core';
import type {
  ExternalBackupEvidenceQueryPort,
  ExternalBackupEvidenceWritePort,
  ExternalBackupRevocationListQueryPort,
  ExternalBackupRevocationListWritePort,
  ExternalBackupRevocationEndpointQueryPort,
  ExternalBackupRevocationEndpointWritePort,
  ExternalBackupInventoryApplicationContext,
  ExternalBackupInventoryQueryPort,
  ExternalBackupInventoryWritePort
} from '@ppt/application';
import type {
  ExternalBackupInventoryRepositoryPort,
  RepositoryExecutionContext,
  TransactionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';

export interface RepositoryBackedExternalBackupInventoryDependencies {
  readonly transactionExecutor:TransactionExecutor;
  readonly repository:ExternalBackupInventoryRepositoryPort;
}
const repositoryContext=(context:ExternalBackupInventoryApplicationContext,transaction:TransactionContext):RepositoryExecutionContext=>({transaction:transaction.transaction,actor:{userId:context.actor.userId,roles:[context.actor.role],...(context.actor.personId?{personId:context.actor.personId}:{})},correlationId:context.correlationId,occurredAt:transaction.occurredAt});
export class RepositoryBackedExternalBackupInventoryAdapter implements ExternalBackupInventoryQueryPort,ExternalBackupInventoryWritePort,ExternalBackupEvidenceQueryPort,ExternalBackupEvidenceWritePort,ExternalBackupRevocationListQueryPort,ExternalBackupRevocationListWritePort,ExternalBackupRevocationEndpointQueryPort,ExternalBackupRevocationEndpointWritePort {
  constructor(private readonly dependencies:RepositoryBackedExternalBackupInventoryDependencies){}
  #execute<T>(context:ExternalBackupInventoryApplicationContext,operation:(repository:RepositoryExecutionContext)=>Result<T,AppError>){return this.dependencies.transactionExecutor.execute(context.correlationId,transaction=>operation(repositoryContext(context,transaction)));}
  listCopies(context:ExternalBackupInventoryApplicationContext,limit:number){return this.#execute(context,repository=>this.dependencies.repository.listCopies(repository,limit));}
  findCopy(context:ExternalBackupInventoryApplicationContext,id:string){return this.#execute(context,repository=>this.dependencies.repository.findCopy(repository,id));}
  insertCopy(context:ExternalBackupInventoryApplicationContext,row:Parameters<ExternalBackupInventoryWritePort['insertCopy']>[1],attestation:Parameters<ExternalBackupInventoryWritePort['insertCopy']>[2]){return this.#execute(context,repository=>this.dependencies.repository.insertCopy(repository,row,{id:attestation.id,copyId:row.id,action:'registered',note:attestation.note,actorId:attestation.actorId,occurredAt:attestation.occurredAt}));}
  reviewCopy(context:ExternalBackupInventoryApplicationContext,input:Parameters<ExternalBackupInventoryWritePort['reviewCopy']>[1]){return this.#execute(context,repository=>this.dependencies.repository.reviewCopy(repository,input));}
  setLegalHold(context:ExternalBackupInventoryApplicationContext,input:Parameters<ExternalBackupInventoryWritePort['setLegalHold']>[1]){return this.#execute(context,repository=>this.dependencies.repository.setLegalHold(repository,input));}
  attestDestroyed(context:ExternalBackupInventoryApplicationContext,input:Parameters<ExternalBackupInventoryWritePort['attestDestroyed']>[1]){return this.#execute(context,repository=>this.dependencies.repository.attestDestroyed(repository,input));}
  listEvidenceIssuers(context:ExternalBackupInventoryApplicationContext,limit:number){return this.#execute(context,repository=>this.dependencies.repository.listEvidenceIssuers(repository,limit));}
  findEvidenceIssuer(context:ExternalBackupInventoryApplicationContext,id:string){return this.#execute(context,repository=>this.dependencies.repository.findEvidenceIssuer(repository,id));}
  findEvidenceIssuerByFingerprint(context:ExternalBackupInventoryApplicationContext,fingerprintSha256:string){return this.#execute(context,repository=>this.dependencies.repository.findEvidenceIssuerByFingerprint(repository,fingerprintSha256));}
  listEvidenceIssuerRotations(context:ExternalBackupInventoryApplicationContext,limit:number){return this.#execute(context,repository=>this.dependencies.repository.listEvidenceIssuerRotations(repository,limit));}
  findEvidenceIssuerRotationByReceipt(context:ExternalBackupInventoryApplicationContext,predecessorIssuerId:string,receiptId:string){return this.#execute(context,repository=>this.dependencies.repository.findEvidenceIssuerRotationByReceipt(repository,predecessorIssuerId,receiptId));}
  insertEvidenceIssuer(context:ExternalBackupInventoryApplicationContext,row:Parameters<ExternalBackupEvidenceWritePort['insertEvidenceIssuer']>[1]){return this.#execute(context,repository=>this.dependencies.repository.insertEvidenceIssuer(repository,row));}
  rotateEvidenceIssuer(context:ExternalBackupInventoryApplicationContext,input:Parameters<ExternalBackupEvidenceWritePort['rotateEvidenceIssuer']>[1]){return this.#execute(context,repository=>this.dependencies.repository.rotateEvidenceIssuer(repository,input));}
  revokeEvidenceIssuer(context:ExternalBackupInventoryApplicationContext,input:Parameters<ExternalBackupEvidenceWritePort['revokeEvidenceIssuer']>[1]){return this.#execute(context,repository=>this.dependencies.repository.revokeEvidenceIssuer(repository,input));}
  listEvidenceRevocationLists(context:ExternalBackupInventoryApplicationContext,limit:number){return this.#execute(context,repository=>this.dependencies.repository.listEvidenceRevocationLists(repository,limit));}
  findLatestEvidenceRevocationList(context:ExternalBackupInventoryApplicationContext,authorityRootIssuerId:string){return this.#execute(context,repository=>this.dependencies.repository.findLatestEvidenceRevocationList(repository,authorityRootIssuerId));}
  findEvidenceRevocationListByListId(context:ExternalBackupInventoryApplicationContext,authorityRootIssuerId:string,listId:string){return this.#execute(context,repository=>this.dependencies.repository.findEvidenceRevocationListByListId(repository,authorityRootIssuerId,listId));}
  applyEvidenceRevocationList(context:ExternalBackupInventoryApplicationContext,input:Parameters<ExternalBackupRevocationListWritePort['applyEvidenceRevocationList']>[1]){return this.#execute(context,repository=>this.dependencies.repository.applyEvidenceRevocationList(repository,input));}
  listRevocationEndpoints(context:ExternalBackupInventoryApplicationContext,limit:number){return this.#execute(context,repository=>this.dependencies.repository.listRevocationEndpoints(repository,limit));}
  findRevocationEndpoint(context:ExternalBackupInventoryApplicationContext,id:string){return this.#execute(context,repository=>this.dependencies.repository.findRevocationEndpoint(repository,id));}
  findRevocationEndpointByIssuer(context:ExternalBackupInventoryApplicationContext,issuerId:string){return this.#execute(context,repository=>this.dependencies.repository.findRevocationEndpointByIssuer(repository,issuerId));}
  upsertRevocationEndpoint(context:ExternalBackupInventoryApplicationContext,row:Parameters<ExternalBackupRevocationEndpointWritePort['upsertRevocationEndpoint']>[1],expectedUpdatedAt?:string){return this.#execute(context,repository=>this.dependencies.repository.upsertRevocationEndpoint(repository,row,expectedUpdatedAt));}
  recordRevocationEndpointFetch(context:ExternalBackupInventoryApplicationContext,input:Parameters<ExternalBackupRevocationEndpointWritePort['recordRevocationEndpointFetch']>[1]){return this.#execute(context,repository=>this.dependencies.repository.recordRevocationEndpointFetch(repository,input));}
  listDestructionEvidence(context:ExternalBackupInventoryApplicationContext,copyId:string|undefined,limit:number){return this.#execute(context,repository=>this.dependencies.repository.listDestructionEvidence(repository,copyId,limit));}
  findDestructionEvidenceByReceipt(context:ExternalBackupInventoryApplicationContext,issuerId:string,receiptId:string){return this.#execute(context,repository=>this.dependencies.repository.findDestructionEvidenceByReceipt(repository,issuerId,receiptId));}
  insertVerifiedDestructionEvidence(context:ExternalBackupInventoryApplicationContext,input:Parameters<ExternalBackupEvidenceWritePort['insertVerifiedDestructionEvidence']>[1]){return this.#execute(context,repository=>this.dependencies.repository.insertVerifiedDestructionEvidence(repository,input));}
}
