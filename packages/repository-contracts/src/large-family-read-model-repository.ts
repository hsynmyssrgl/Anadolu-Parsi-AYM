import type { FamilyId, PersonId } from '@ppt/core';
import type { ArchiveSensitivity, FamilyEventView } from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface LargeTreeCursor { readonly generation:number; readonly displayName:string; readonly id:string; }
export interface LargeTimelineCursor { readonly startAt:string; readonly id:string; }
export interface LargeArchiveCursor { readonly createdAt:string; readonly id:string; }

export interface LargeTreeRow {
  readonly id:PersonId; readonly displayName:string; readonly birthDate?:string; readonly relationshipType:string;
  readonly generation:number; readonly branch:string; readonly status:'active'|'invited'|'archived';
  readonly relationCount:number; readonly parentCount:number; readonly childCount:number;
}

export interface LargeArchiveRow {
  readonly id:string; readonly title:string; readonly originalName:string; readonly mimeType:string; readonly sizeBytes:number;
  readonly sha256:string; readonly createdAt:string; readonly linkedEventId?:string; readonly categoryId?:string;
  readonly categoryName?:string; readonly sensitivity:ArchiveSensitivity; readonly tagNames:readonly string[];
  readonly retentionPolicyId?:string; readonly retentionPolicyName?:string; readonly retentionDays?:number;
}

/**
 * Internal timeline row. A linked location id is never a presentation grant:
 * callers must resolve it through a governed location collection read before
 * projecting either the id or its authoritative label. The free-form label is
 * populated only for events that have no saved-location link.
 */
export interface LargeTimelineRow extends Omit<FamilyEventView, 'locationId' | 'locationLabel'> {
  readonly linkedLocationId?: string;
  readonly freeformLocationLabel?: string;
}

export interface LargeFamilyReadModelRepositoryPort {
  listTreePage(context:RepositoryExecutionContext,input:{familyId:FamilyId;limit:number;query:string;branch:string;generation?:number;cursor?:LargeTreeCursor}):RepositoryResult<readonly LargeTreeRow[]>;
  listTimelinePage(context:PolicyAuthorizedRepositoryExecutionContext,input:{familyId:FamilyId;limit:number;query:string;visibleLocationIds:readonly string[];locationIdsMatchingQuery?:readonly string[];personId?:PersonId;kind:string;year?:number;cursor?:LargeTimelineCursor}):RepositoryResult<readonly LargeTimelineRow[]>;
  listArchivePage(context:RepositoryExecutionContext,input:{familyId:FamilyId;limit:number;query:string;categoryId:string;sensitivity:string;tag:string;mimeType:string;linkedEventId:string;cursor?:LargeArchiveCursor}):RepositoryResult<readonly LargeArchiveRow[]>;
}
