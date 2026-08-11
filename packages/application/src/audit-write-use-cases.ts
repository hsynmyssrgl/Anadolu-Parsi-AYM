import { ERROR_CODES, createAppError, ok, type AppError, type CorrelationId, type IsoDateTime, type Result, type UserId } from '@ppt/core';

export interface AuditWriteApplicationContext { readonly actorId:UserId; readonly correlationId:CorrelationId; readonly occurredAt:IsoDateTime; }
export interface AppendAuditCommand { readonly id:string; readonly action:string; readonly resourceType:string; readonly resourceId:string; }
export interface AuditWriteCommandPort { append(context:AuditWriteApplicationContext,input:AppendAuditCommand):Result<string,AppError>; }

export class AppendAuditEntryUseCase {
  public constructor(private readonly command:AuditWriteCommandPort){}
  public execute(context:AuditWriteApplicationContext,input:AppendAuditCommand):Result<string,AppError>{
    if(!input.action.trim()||!input.resourceType.trim()||!input.resourceId.trim()){
      return {
        ok:false,
        error:createAppError({
          code:ERROR_CODES.CORE_INVALID_ARGUMENT,
          message:'Denetim kaydı alanları boş bırakılamaz.',
          category:'validation',
          correlationId:context.correlationId
        })
      };
    }
    const result=this.command.append(context,input);
    return result.ok?ok(result.value):result;
  }
}
