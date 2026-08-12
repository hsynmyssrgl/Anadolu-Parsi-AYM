import type { AiConsentView, SensitiveDataCategory } from '@ppt/domain';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface AiConsentResourceRow { readonly resourceType:string; readonly resourceId:string; readonly title:string; }
export interface SensitiveDataInventoryRow { readonly category:SensitiveDataCategory; readonly recordCount:number; readonly fieldNames:readonly string[]; }

export interface AiConsentRepositoryPort {
    list(context: RepositoryExecutionContext, accountId: string): RepositoryResult<readonly AiConsentView[]>;
    findIdentity(context: RepositoryExecutionContext, accountId: string, purpose: string, resourceType: string, resourceId: string): RepositoryResult<string | null>;
    upsert(context: RepositoryExecutionContext, row: AiConsentView): RepositoryResult<void>;
    listActive(context: RepositoryExecutionContext, accountId: string, purpose: string, at: string): RepositoryResult<readonly AiConsentView[]>;
    countRevoked(context: RepositoryExecutionContext, accountId: string, purpose: string): RepositoryResult<number>;
    listAllowedResources(context: RepositoryExecutionContext, resourceType: string, resourceId: string): RepositoryResult<readonly AiConsentResourceRow[]>;
    listSensitiveDataInventory(context: RepositoryExecutionContext, at: string): RepositoryResult<readonly SensitiveDataInventoryRow[]>;
}
