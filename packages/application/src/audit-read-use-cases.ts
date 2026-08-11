import { asIsoDateTime, ok, type AppError, type CorrelationId, type IsoDateTime, type Result, type UserId } from '@ppt/core';

export interface AuditReadApplicationContext { readonly actorId:UserId; readonly correlationId:CorrelationId; readonly occurredAt:IsoDateTime; }
export interface AuditReadQueryPort { latestOccurredAt(context:AuditReadApplicationContext):Result<IsoDateTime|undefined,AppError>; }

export class GetLatestAuditOccurredAtUseCase {
  public constructor(private readonly query:AuditReadQueryPort){}
  public execute(context:AuditReadApplicationContext):Result<IsoDateTime,AppError>{
    const result=this.query.latestOccurredAt(context);
    if(!result.ok)return result;
    return ok(result.value ?? asIsoDateTime(context.occurredAt));
  }
}
