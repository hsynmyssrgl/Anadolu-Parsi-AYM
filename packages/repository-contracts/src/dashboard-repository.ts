import type { asIsoDateTime, FamilyId } from '@ppt/core';
import type { FamilyEventView } from '@ppt/domain';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export type DashboardRepositoryModuleId =
  | 'family' | 'tree' | 'timeline' | 'important-days' | 'archive' | 'finance'
  | 'health' | 'life-center' | 'automation' | 'reports' | 'location'
  | 'permissions' | 'ai' | 'legacy' | 'settings';

export interface DashboardRepositoryModuleCount {
  readonly id: DashboardRepositoryModuleId;
  readonly label: string;
  readonly recordCount: number;
  readonly attentionCount: number;
  readonly emptyDetail: string;
  readonly readyDetail: string;
}

export interface DashboardRepositorySummary {
  readonly family: { readonly id: string; readonly name: string } | null;
  readonly memberCount: number;
  readonly generationCount: number;
  readonly timelineEventCount: number;
  readonly upcomingImportantDayCount: number;
  readonly relatedContentCount: number;
  readonly notificationCount: number;
  readonly upcomingImportantDays: readonly FamilyEventView[];
  readonly recentEvents: readonly FamilyEventView[];
  readonly modules: readonly DashboardRepositoryModuleCount[];
  readonly lastActivityAt: ReturnType<typeof asIsoDateTime>;
}

export interface DashboardRepositoryVisibleLocation {
  readonly id: string;
  readonly label: string;
}

export interface DashboardRepositoryPort {
  loadSummary(
    context: RepositoryExecutionContext,
    familyId: FamilyId,
    visibleLocations: readonly DashboardRepositoryVisibleLocation[]
  ): RepositoryResult<DashboardRepositorySummary>;
}
