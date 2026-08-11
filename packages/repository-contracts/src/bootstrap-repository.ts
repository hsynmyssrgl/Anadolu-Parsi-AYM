import type { FamilyId, IsoDateTime } from '@ppt/core';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface BootstrapSeedData {
  readonly family: { readonly id: FamilyId; readonly name: string };
  readonly people: readonly {
    readonly id: string; readonly displayName: string; readonly birthDate?: string;
    readonly relationshipType: string; readonly generation: number; readonly branch: string;
  }[];
  readonly relations: readonly {
    readonly id: string; readonly fromPersonId: string; readonly toPersonId: string; readonly relationType: string;
  }[];
  readonly events: readonly {
    readonly id: string; readonly kind: string; readonly title: string; readonly description?: string;
    readonly startAt: string; readonly locationId?: string; readonly locationLabel?: string;
    readonly visibility: string; readonly participantPersonIds: readonly string[];
    readonly invitationText?: string; readonly notes?: string; readonly attachmentCount: number;
    readonly aiProcessingAllowed: boolean; readonly recurrence: string; readonly reminderDays: readonly number[];
  }[];
}

export interface BootstrapRepositoryPort {
    seedIfEmpty(context: RepositoryExecutionContext, seed: BootstrapSeedData, occurredAt: IsoDateTime): RepositoryResult<boolean>;
}
