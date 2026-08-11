import type { PersonId, UserId } from './types.js';
import type { Sensitivity, TimelineEvent } from './entities.js';

export type PermissionAction = 'read' | 'create' | 'update' | 'delete' | 'share' | 'ai_process';

export interface ActorContext {
  userId: UserId;
  personId: PersonId;
  familyId: string;
  branchIds: string[];
  roles: string[];
  now: string;
}

export interface ObjectGrant {
  subjectPersonId: PersonId;
  resourceType: string;
  resourceId: string;
  actions: PermissionAction[];
  validFrom: string;
  validUntil?: string;
  denied?: boolean;
}

export interface TimelineAuthorizationInput {
  actor: ActorContext;
  event: TimelineEvent;
  grants?: ObjectGrant[];
}

const isActive = (grant: ObjectGrant, now: string): boolean =>
  grant.validFrom <= now && (!grant.validUntil || now <= grant.validUntil);

const hasExplicitGrant = (
  grants: ObjectGrant[],
  actor: ActorContext,
  event: TimelineEvent,
  action: PermissionAction,
  denied: boolean
): boolean => grants.some((grant) =>
  grant.subjectPersonId === actor.personId &&
  grant.resourceType === 'timeline_event' &&
  grant.resourceId === event.id &&
  grant.actions.includes(action) &&
  grant.denied === denied &&
  isActive(grant, actor.now)
);

export function canAccessTimelineEvent(
  input: TimelineAuthorizationInput,
  action: PermissionAction = 'read'
): boolean {
  const { actor, event, grants = [] } = input;

  if (event.familyId !== actor.familyId) return false;
  if (hasExplicitGrant(grants, actor, event, action, true)) return false;
  if (event.ownerPersonId === actor.personId) return true;
  if (hasExplicitGrant(grants, actor, event, action, false)) return true;

  if (action === 'ai_process' && !event.aiProcessingAllowed) return false;

  if (event.visibility === 'family') return actor.roles.length > 0;
  if (event.visibility === 'selected_members') {
    return event.allowedPersonIds.includes(actor.personId);
  }

  return event.participantPersonIds.includes(actor.personId);
}

export const sensitivityRank: Record<Sensitivity, number> = {
  normal: 1,
  private: 2,
  highly_sensitive: 3
};
