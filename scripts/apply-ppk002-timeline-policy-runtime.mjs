import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:/PPT/AYM/06_KOD/app')) throw new Error(`WORKSPACE_ROOT_MISMATCH:${root}`);

const staged = new Map();
const pathFor = (relativePath) => {
  const target = resolve(root, relativePath);
  const rel = relative(root, target);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`OUTSIDE_SOURCE_ROOT:${relativePath}`);
  return target;
};
const load = async (relativePath) => {
  if (staged.has(relativePath)) return staged.get(relativePath);
  const value = await readFile(pathFor(relativePath), 'utf8');
  staged.set(relativePath, value);
  return value;
};
const set = (relativePath, value) => staged.set(relativePath, value.replaceAll('\r\n', '\n'));
const replaceOnce = (value, before, after, label) => {
  if (value.includes(after)) return value;
  const index = value.indexOf(before);
  if (index < 0) throw new Error(`PATCH_ANCHOR_MISSING:${label}`);
  if (value.indexOf(before, index + before.length) >= 0) throw new Error(`PATCH_ANCHOR_NOT_UNIQUE:${label}`);
  return value.slice(0, index) + after + value.slice(index + before.length);
};
const replaceSection = (value, startMarker, endMarker, before, after, label) => {
  const start = value.indexOf(startMarker);
  const end = value.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`SECTION_MISSING:${label}`);
  const section = value.slice(start, end);
  const patched = replaceOnce(section, before, after, label);
  return value.slice(0, start) + patched + value.slice(end);
};

const adapterTemplate = await readFile(
  pathFor('scripts/templates/timeline-application-adapter.ts.txt'),
  'utf8'
);
set('apps/desktop/src/main/timeline-application-adapter.ts', adapterTemplate);

let runtime = await readFile(pathFor('apps/desktop/src/main/location-production-policy-runtime.ts'), 'utf8');
runtime = runtime
  .replaceAll('LOCATION', 'TIMELINE')
  .replaceAll('Location', 'Timeline')
  .replaceAll('location', 'timeline')
  .replaceAll("'timeline'", "'event'")
  .replaceAll("'timeline-write'", "'timeline-event-write'")
  .replaceAll('TimelinePolicyResourceRepositoryPort', 'TimelineEventPolicyResourceRepositoryPort')
  .replaceAll('findTimelineForPolicyResolution', 'findTimelineEventForPolicyResolution');

runtime = replaceOnce(
  runtime,
  '    roles: [context.actor.role],',
  '    roles: context.actor.roles,',
  'timeline-runtime-context-roles'
);
runtime = replaceOnce(
  runtime,
  '    && account.role === context.actor.role\n',
  `    && context.actor.roles.length === 1
    && account.role === context.actor.roles[0]
`,
  'timeline-runtime-account-role'
);
runtime = replaceOnce(
  runtime,
  '    || authority.roles[0] !== context.actor.role\n',
  '    || authority.roles[0] !== context.actor.roles[0]\n',
  'timeline-runtime-authority-role'
);
runtime = replaceOnce(
  runtime,
  '    || input.context.actor.role !== context.actor.role\n',
  '    || stable(input.context.actor.roles) !== stable(context.actor.roles)\n',
  'timeline-runtime-revalidation-roles'
);
runtime = replaceOnce(
  runtime,
  `    && row.actions.length === 1
    && row.actions[0] === 'read'
`,
  `    && row.actions.length >= 1
    && row.actions.length <= 2
    && row.actions.every((action) => action === 'read' || action === 'update')
`,
  'timeline-runtime-permission-actions'
);

const resourceStart = runtime.indexOf('interface TimelinePolicyResourceState {');
const resourceEnd = runtime.indexOf('const loadTimelineResourceSnapshot = (', resourceStart);
if (resourceStart < 0 || resourceEnd < 0) throw new Error('TIMELINE_RUNTIME_RESOURCE_BLOCK_MISSING');
const resourceBlock = `interface TimelinePolicyResourceState {
  readonly familyId: TimelineApplicationContext['familyId'];
  readonly ownerPersonId: NonNullable<TimelinePolicyIntent['ownerPersonId']>;
  readonly sensitivity: NonNullable<TimelinePolicyIntent['targetSensitivity']>;
  readonly sourceResourceId?: string;
  readonly stateFingerprint: string;
}

const findTimelineResourceForPolicyResolution = (
  dependencies: TimelineProductionPolicyRuntimeDependencies,
  execution: RepositoryExecutionContext,
  resourceType: TimelinePolicyIntent['resourceType'],
  resourceId: string
): Result<TimelinePolicyResourceState | null, AppError> => {
  if (resourceType !== 'event') {
    throw new PlatformPolicyEnforcementError(
      'RESOURCE_RESOLUTION_FAILED',
      'Timeline policy resource type is not supported'
    );
  }
  const found = dependencies.timelinePolicyResourceRepository.findTimelineEventForPolicyResolution(
    execution,
    resourceId
  );
  if (!found.ok) return found;
  return ok(found.value
    ? Object.freeze({
        familyId: found.value.familyId,
        ownerPersonId: found.value.ownerPersonId,
        sensitivity: found.value.sensitivity,
        ...(found.value.sourceResourceId ? { sourceResourceId: found.value.sourceResourceId } : {}),
        stateFingerprint: stable(found.value)
      })
    : null);
};

const loadTimelineResourceSnapshotInTransaction = (
  dependencies: TimelineProductionPolicyRuntimeDependencies,
  context: TimelineApplicationContext,
  requestedIntent: TimelinePolicyIntent,
  transaction: TransactionContext
): Result<TimelineResourceSnapshot, AppError> => {
  const execution = repositoryContext(context, transaction);
  if (
    !timelineResourceTypes.has(requestedIntent.resourceType)
    || requestedIntent.purpose !== 'general'
    || !nonEmpty(requestedIntent.resourceId, 256)
    || (requestedIntent.sourceResourceId !== undefined && !nonEmpty(requestedIntent.sourceResourceId, 256))
    || (requestedIntent.action === 'read'
      ? requestedIntent.capability !== 'family.read'
      : requestedIntent.capability !== 'family.write' || requestedIntent.resourceId === '*')
  ) return invalidAuthority(context, 'Timeline policy intent is not a supported exact operation');

  if (requestedIntent.action === 'read' && requestedIntent.resourceId === '*') {
    if (!context.actor.personId) return invalidAuthority(context, 'Timeline collection read requires an exact person identity');
    const resource = Object.freeze({
      type: requestedIntent.resourceType,
      id: '*',
      familyId: context.familyId,
      ownerPersonId: context.actor.personId,
      sensitivity: 'personal' as const
    });
    return ok(Object.freeze({
      resource,
      stateFingerprint: stable({
        scope: 'timeline_collection',
        resourceType: requestedIntent.resourceType,
        familyId: context.familyId,
        actorPersonId: context.actor.personId
      })
    }));
  }

  if (requestedIntent.action === 'create') {
    if (
      !requestedIntent.ownerPersonId
      || !requestedIntent.targetSensitivity
      || requestedIntent.sourceResourceMode !== 'replace'
    ) return invalidAuthority(context, 'Timeline create policy metadata is incomplete');
    const existing = findTimelineResourceForPolicyResolution(
      dependencies,
      execution,
      requestedIntent.resourceType,
      requestedIntent.resourceId
    );
    if (!existing.ok) return existing;
    if (existing.value) return invalidAuthority(context, 'Timeline policy create resource already exists');
    const owner = dependencies.personRepository.findById(execution, requestedIntent.ownerPersonId);
    if (!owner.ok) return owner;
    if (!owner.value || owner.value.familyId !== context.familyId || owner.value.status !== 'active') {
      return invalidAuthority(context, 'Timeline policy owner does not exist in the active family');
    }
    const resource = Object.freeze({
      type: requestedIntent.resourceType,
      id: requestedIntent.resourceId,
      familyId: context.familyId,
      ownerPersonId: requestedIntent.ownerPersonId,
      sensitivity: requestedIntent.targetSensitivity,
      ...(requestedIntent.sourceResourceId ? { sourceResourceId: requestedIntent.sourceResourceId } : {})
    });
    return ok(Object.freeze({
      resource,
      stateFingerprint: stable({
        state: 'absent',
        owner: owner.value,
        resourceType: requestedIntent.resourceType,
        resourceId: requestedIntent.resourceId,
        familyId: context.familyId
      })
    }));
  }

  const existing = findTimelineResourceForPolicyResolution(
    dependencies,
    execution,
    requestedIntent.resourceType,
    requestedIntent.resourceId
  );
  if (!existing.ok) return existing;
  if (!existing.value || existing.value.familyId !== context.familyId) {
    return invalidAuthority(context, 'Timeline policy resource does not exist in the active family');
  }
  const updating = requestedIntent.action === 'update';
  if (updating && !requestedIntent.sourceResourceMode) {
    return invalidAuthority(context, 'Timeline update source-resource mode is missing');
  }
  const sourceResourceId = updating && requestedIntent.sourceResourceMode === 'replace'
    ? requestedIntent.sourceResourceId
    : existing.value.sourceResourceId;
  const resource = Object.freeze({
    type: requestedIntent.resourceType,
    id: requestedIntent.resourceId,
    familyId: existing.value.familyId,
    ownerPersonId: existing.value.ownerPersonId,
    sensitivity: updating && requestedIntent.targetSensitivity
      ? requestedIntent.targetSensitivity
      : existing.value.sensitivity,
    ...(sourceResourceId ? { sourceResourceId } : {})
  });
  return ok(Object.freeze({
    resource,
    stateFingerprint: existing.value.stateFingerprint
  }));
};

`;
runtime = runtime.slice(0, resourceStart) + resourceBlock + runtime.slice(resourceEnd);
if (/context\.actor\.role\b/u.test(runtime)) throw new Error('TIMELINE_RUNTIME_LEGACY_ROLE_ACCESS_REMAINS');
if (runtime.includes('requestedIntent.sensitivity')) throw new Error('TIMELINE_RUNTIME_LEGACY_SENSITIVITY_REMAINS');
if (!runtime.includes("const TIMELINE_POLICY_FENCE_NAME = 'timeline-event-write';")) {
  throw new Error('TIMELINE_RUNTIME_FENCE_NAME_MISMATCH');
}
set('apps/desktop/src/main/timeline-production-policy-runtime.ts', runtime);

const applicationPath = 'packages/application/src/timeline-use-cases.ts';
let application = await load(applicationPath);
application = replaceOnce(
  application,
  `const trimOptional = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized || undefined;
};
`,
  `const trimOptional = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized || undefined;
};

const timelineSensitivityForVisibility = (
  visibility: FamilyEventView['visibility']
): TimelineDataSensitivity => visibility === 'personal'
  ? 'highly_sensitive'
  : visibility === 'selected_members' ? 'sensitive' : 'personal';
`,
  'timeline-sensitivity-helper'
);

application = replaceSection(
  application,
  'export class CreateImportantDayUseCase',
  'export interface TimelineMutationIdentifiers',
  `    }, input.command.locationId ? { governedLocationReadId: input.command.locationId } : undefined);
`,
  `    }, {
      policyIntent: {
        action: 'create',
        capability: 'family.write',
        resourceType: 'event',
        resourceId: input.identifiers.eventId,
        purpose: 'general',
        ...(input.context.actor.personId ? { ownerPersonId: input.context.actor.personId } : {}),
        targetSensitivity: timelineSensitivityForVisibility(visibility),
        sourceResourceMode: 'replace',
        ...(input.command.locationId ? { sourceResourceId: input.command.locationId } : {})
      },
      ...(input.command.locationId ? { governedLocationReadId: input.command.locationId } : {})
    });
`,
  'create-event-policy-options'
);
application = replaceSection(
  application,
  'export class UpdateFamilyEventUseCase',
  'export class SetFamilyEventArchivedUseCase',
  `    }, input.command.locationId ? { governedLocationReadId: input.command.locationId } : undefined);
`,
  `    }, {
      policyIntent: {
        action: 'update', capability: 'family.write', resourceType: 'event', resourceId: eventId,
        purpose: 'general', targetSensitivity: timelineSensitivityForVisibility(normalized.value.visibility),
        sourceResourceMode: 'replace',
        ...(input.command.locationId ? { sourceResourceId: input.command.locationId } : {})
      },
      ...(input.command.locationId ? { governedLocationReadId: input.command.locationId } : {})
    });
`,
  'update-event-policy-options'
);
application = replaceSection(
  application,
  'export class SetFamilyEventArchivedUseCase',
  'export class UpdateImportantDayParticipantsUseCase',
  `    });
  }
}
`,
  `    }, { policyIntent: {
      action: 'update', capability: 'family.write', resourceType: 'event', resourceId: eventId,
      purpose: 'general', sourceResourceMode: 'preserve'
    } });
  }
}
`,
  'archive-event-policy-options'
);
application = replaceSection(
  application,
  'export class UpdateImportantDayParticipantsUseCase',
  'export class UpdateImportantDayInvitationUseCase',
  `    });
  }
}
`,
  `    }, { policyIntent: {
      action: 'update', capability: 'family.write', resourceType: 'event', resourceId: eventId,
      purpose: 'general', sourceResourceMode: 'preserve',
      ...(input.command.visibility
        ? { targetSensitivity: timelineSensitivityForVisibility(input.command.visibility) }
        : {})
    } });
  }
}
`,
  'participant-event-policy-options'
);
application = replaceSection(
  application,
  'export class UpdateImportantDayInvitationUseCase',
  'export class UpdateImportantDayNotesUseCase',
  `    });
  }
}
`,
  `    }, { policyIntent: {
      action: 'update', capability: 'family.write', resourceType: 'event', resourceId: eventId,
      purpose: 'general', sourceResourceMode: 'preserve'
    } });
  }
}
`,
  'invitation-event-policy-options'
);
application = replaceSection(
  application,
  'export class UpdateImportantDayNotesUseCase',
  'export class AcknowledgeTimelineNotificationUseCase',
  `    });
  }
}
`,
  `    }, { policyIntent: {
      action: 'update', capability: 'family.write', resourceType: 'event', resourceId: eventId,
      purpose: 'general', sourceResourceMode: 'preserve'
    } });
  }
}
`,
  'notes-event-policy-options'
);
application = replaceOnce(
  application,
  `        payload: { notificationId: notification.id, sourceId: notification.sourceId, occurrenceKey: notification.occurrenceKey }
      });
    });
  }
}
`,
  `        payload: { notificationId: notification.id, sourceId: notification.sourceId, occurrenceKey: notification.occurrenceKey }
      });
    }, { notificationMutation: true });
  }
}
`,
  'notification-mutation-options'
);
set(applicationPath, application);

const dataStorePath = 'apps/desktop/src/main/data-store.ts';
let dataStore = await load(dataStorePath);
dataStore = replaceOnce(
  dataStore,
  `import { RepositoryBackedTimelineApplicationUnitOfWork, RepositoryBackedTimelineQueryPort } from './timeline-application-adapter.js';`,
  `import {
  RepositoryBackedTimelineApplicationUnitOfWork,
  RepositoryBackedTimelinePolicyTransactionRunner,
  RepositoryBackedTimelineQueryPort,
  failClosedTimelinePolicyEnforcementPointResolver,
  nonWritableTimelineClusterFence,
  type TimelinePolicyEnforcementPointResolver
} from './timeline-application-adapter.js';`,
  'data-store-timeline-adapter-import'
);
dataStore = replaceOnce(
  dataStore,
  `import { createLocationProductionPolicyEnforcementPointResolver } from './location-production-policy-runtime.js';`,
  `import { createLocationProductionPolicyEnforcementPointResolver } from './location-production-policy-runtime.js';
import { createTimelineProductionPolicyEnforcementPointResolver } from './timeline-production-policy-runtime.js';`,
  'data-store-timeline-runtime-import'
);
dataStore = replaceOnce(
  dataStore,
  `  locationPolicyEnforcementPointResolver?: LocationPolicyEnforcementPointResolver;
`,
  `  locationPolicyEnforcementPointResolver?: LocationPolicyEnforcementPointResolver;
  timelinePolicyEnforcementPointResolver?: TimelinePolicyEnforcementPointResolver;
`,
  'data-store-timeline-option'
);
dataStore = replaceOnce(
  dataStore,
  `    || options.locationPolicyEnforcementPointResolver !== undefined
`,
  `    || options.locationPolicyEnforcementPointResolver !== undefined
    || options.timelinePolicyEnforcementPointResolver !== undefined
`,
  'data-store-production-conflict'
);

const timelineComposition = `    const timelinePolicyEnforcementPointResolver = productionArchivePolicy === undefined
      ? options.timelinePolicyEnforcementPointResolver ?? failClosedTimelinePolicyEnforcementPointResolver
      : createTimelineProductionPolicyEnforcementPointResolver({
          transactionExecutor: this.#transactionExecutor,
          accountRepository: this.#repositories.accountRepository,
          permissionRepository: this.#repositories.objectPermissionRepository,
          trustedDeviceRepository: this.#repositories.trustedDeviceRepository,
          timelinePolicyResourceRepository: this.#repositories.timelineRepository,
          personRepository: this.#repositories.personRepository,
          deviceIdentityProvider: this.#deviceIdentityProvider,
          authorizationProvider: productionArchivePolicy.authorizationProvider,
          receiptSink: productionArchivePolicy.receiptSink,
          policyTransactionRepository: this.#repositories.platformPolicyTransactionRepository,
          clusterFence: productionArchivePolicy.clusterFence,
          policyVersion: productionArchivePolicy.policyVersion,
          clock: this.#clock
        });
`;
dataStore = replaceOnce(
  dataStore,
  `    const timelineApplicationDependencies = {
`,
  timelineComposition + `    const timelineApplicationDependencies = {
`,
  'data-store-timeline-composition'
);
dataStore = replaceOnce(
  dataStore,
  `      locationPolicyTransactionRunner,
      objectPermissionRepository: this.#repositories.objectPermissionRepository
`,
  `      locationPolicyTransactionRunner,
      policyEnforcementPointResolver: timelinePolicyEnforcementPointResolver,
      clusterFence: productionArchivePolicy?.clusterFence
        ?? options.archiveClusterFence
        ?? nonWritableTimelineClusterFence
`,
  'data-store-timeline-dependencies'
);
dataStore = replaceOnce(
  dataStore,
  `    const timelineQuery = new RepositoryBackedTimelineQueryPort(timelineApplicationDependencies);
    const timelineUnitOfWork = new RepositoryBackedTimelineApplicationUnitOfWork(timelineApplicationDependencies);`,
  `    const timelinePolicyTransactionRunner = new RepositoryBackedTimelinePolicyTransactionRunner(
      timelineApplicationDependencies
    );
    const timelineQuery = new RepositoryBackedTimelineQueryPort(
      timelineApplicationDependencies,
      timelinePolicyTransactionRunner
    );
    const timelineUnitOfWork = new RepositoryBackedTimelineApplicationUnitOfWork(
      timelineApplicationDependencies,
      timelinePolicyTransactionRunner
    );`,
  'data-store-timeline-runner'
);
dataStore = dataStore.replaceAll(
  /\s*if \(!this\.#authorize\('timeline_event', input\.eventId, 'update'\)\) throw new Error\([^\n]+\);/gu,
  ''
);
if (dataStore.includes("this.#authorize('timeline_event'")) {
  throw new Error('DATA_STORE_LEGACY_TIMELINE_AUTHORIZATION_REMAINS');
}
set(dataStorePath, dataStore);

for (const [relativePath, value] of staged) {
  await writeFile(pathFor(relativePath), value.endsWith('\n') ? value : value + '\n', 'utf8');
}
console.log(`PPK-002 timeline policy runtime applied (${staged.size} files; official step and Build unchanged).`);
