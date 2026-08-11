import { ERROR_CODES, createAppError, err, type AppError, type Result } from '@ppt/core';
import type { DashboardApplicationContext, DashboardQueryPort, LocationApplicationContext } from '@ppt/application';
import { isAuthorizationRole } from '@ppt/security';
import type {
  DashboardRepositoryPort,
  LocationRepositoryPort
} from '@ppt/repository-contracts';
import {
  RepositoryBackedLocationPolicyTransactionRunner,
  locationCollectionReadIntent
} from './location-application-adapter.js';

export interface RepositoryBackedDashboardDependencies {
  readonly dashboardRepository: DashboardRepositoryPort;
  readonly locationRepository: LocationRepositoryPort;
  readonly locationPolicyTransactionRunner: RepositoryBackedLocationPolicyTransactionRunner;
}

const locationApplicationContext = (
  context: DashboardApplicationContext
): Result<LocationApplicationContext, AppError> => {
  const role = context.actor.roles.find(isAuthorizationRole);
  if (!role || !context.actor.personId) {
    return err(createAppError({
      code: ERROR_CODES.AUTHORIZATION_DENIED,
      message: 'Dashboard konum görünürlüğü etkin kişi üyeliği ve aile rolü olmadan değerlendirilemez.',
      category: 'authorization',
      correlationId: context.correlationId
    }));
  }
  return { ok: true, value: {
    familyId: context.familyId,
    actor: { userId: context.actor.userId, role, personId: context.actor.personId },
    correlationId: context.correlationId
  } };
};

export class RepositoryBackedDashboardQueryPort implements DashboardQueryPort {
  public constructor(private readonly dependencies: RepositoryBackedDashboardDependencies) {}

  public load(context: DashboardApplicationContext): ReturnType<DashboardQueryPort['load']> {
    const locationContext = locationApplicationContext(context);
    if (!locationContext.ok) return Promise.resolve(locationContext);
    return this.dependencies.locationPolicyTransactionRunner.execute(
      locationContext.value,
      locationCollectionReadIntent(),
      ({ repository }) => {
      const locations = this.dependencies.locationRepository.listByFamily(repository, context.familyId);
      if (!locations.ok) return locations;
      const summary = this.dependencies.dashboardRepository.loadSummary(repository, context.familyId, locations.value);
      if (!summary.ok) return summary;
      return { ok: true, value: summary.value };
      }
    );
  }
}
