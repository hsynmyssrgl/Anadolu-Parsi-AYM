import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type FamilyId,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import type {
  DashboardModuleId,
  DashboardModuleStatusView,
  DashboardOverviewView,
  FamilyEventView
} from '@ppt/domain';

export interface DashboardApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: { readonly userId: UserId; readonly roles: readonly string[]; readonly personId?: PersonId };
  readonly correlationId: CorrelationId;
}

export interface DashboardModuleCountRecord {
  readonly id: DashboardModuleId;
  readonly label: string;
  readonly recordCount: number;
  readonly attentionCount?: number;
  readonly emptyDetail: string;
  readonly readyDetail: string;
}

export interface DashboardQueryRecord {
  readonly family: { readonly id: string; readonly name: string } | null;
  readonly memberCount: number;
  readonly generationCount: number;
  readonly timelineEventCount: number;
  readonly upcomingImportantDayCount: number;
  readonly upcomingImportantDays: readonly FamilyEventView[];
  readonly recentEvents: readonly FamilyEventView[];
  readonly relatedContentCount: number;
  readonly notificationCount: number;
  readonly modules: readonly DashboardModuleCountRecord[];
  readonly lastActivityAt: IsoDateTime;
}

export interface DashboardQueryPort {
  load(context: DashboardApplicationContext): Promise<Result<DashboardQueryRecord, AppError>>;
}

const notFound = (correlationId: CorrelationId): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_NOT_FOUND,
  message: 'Dashboard için aile kaydı bulunamadı.',
  category: 'not_found',
  correlationId
});

const moduleStatus = (record: DashboardModuleCountRecord): DashboardModuleStatusView => {
  if ((record.attentionCount ?? 0) > 0) {
    return {
      id: record.id, label: record.label, recordCount: record.recordCount, state: 'attention',
      detail: `${record.attentionCount} kayıt dikkat bekliyor`
    };
  }
  return {
    id: record.id,
    label: record.label,
    recordCount: record.recordCount,
    state: record.recordCount > 0 ? 'ready' : 'empty',
    detail: record.recordCount > 0 ? record.readyDetail : record.emptyDetail
  };
};

export class GetDashboardOverviewUseCase {
  public constructor(private readonly query: DashboardQueryPort) {}

  public async execute(input: {
    readonly context: DashboardApplicationContext;
    readonly now: IsoDateTime;
  }): Promise<Result<DashboardOverviewView, AppError>> {
    const loaded = await this.query.load(input.context);
    if (!loaded.ok) return loaded;
    if (!loaded.value.family) return err(notFound(input.context.correlationId));

    const nowMs = new Date(input.now).getTime();
    const upcoming = [...loaded.value.upcomingImportantDays]
      .toSorted((left, right) => left.startAt.localeCompare(right.startAt))
      .slice(0, 6);
    const recent = [...loaded.value.recentEvents]
      .toSorted((left, right) => right.startAt.localeCompare(left.startAt))
      .slice(0, 4);
    const nextDays = upcoming[0]
      ? Math.max(0, Math.ceil((new Date(upcoming[0].startAt).getTime() - nowMs) / 86_400_000))
      : undefined;

    return ok({
      family: loaded.value.family,
      memberCount: loaded.value.memberCount,
      generationCount: loaded.value.generationCount,
      upcomingImportantDayCount: loaded.value.upcomingImportantDayCount,
      ...(nextDays === undefined ? {} : { nextImportantDayInDays: nextDays }),
      timelineEventCount: loaded.value.timelineEventCount,
      relatedContentCount: loaded.value.relatedContentCount,
      notificationCount: loaded.value.notificationCount,
      upcomingImportantDays: upcoming,
      recentEvents: recent,
      modules: loaded.value.modules.map(moduleStatus),
      generatedAt: input.now,
      lastActivityAt: loaded.value.lastActivityAt
    });
  }
}
