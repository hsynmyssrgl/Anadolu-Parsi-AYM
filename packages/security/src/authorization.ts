export type AuthorizationAction = 'read' | 'create' | 'update' | 'delete' | 'share' | 'record' | 'ai_process' | 'administer';
export type AuthorizationRole = 'family_admin' | 'adult_member' | 'limited_member' | 'caregiver' | 'advisor';
export type SensitiveRecordPrivacy = 'private' | 'selected_members' | 'family';
export type SensitiveRecordDomain = 'finance' | 'health' | 'life';
export type AuthorizationPurpose = 'general'|'care'|'finance'|'health'|'archive'|'legacy'|'ai_processing'|'administration';

export interface AuthorizationGrant {
  readonly id: string;
  readonly subjectAccountId: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly actions: readonly AuthorizationAction[];
  readonly effect: 'allow' | 'deny';
  readonly purpose: AuthorizationPurpose;
  readonly familyBranchId?: string;
  readonly denialReason?: string;
  readonly startsAt: string;
  readonly endsAt?: string;
}

export interface AuthorizationRequest {
  readonly accountId: string;
  readonly role: AuthorizationRole;
  readonly action: AuthorizationAction;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly occurredAt: string;
  readonly purpose?: AuthorizationPurpose;
  readonly actorBranchIds?: readonly string[];
  readonly resourceBranchId?: string;
  readonly actorPersonId?: string;
  readonly ownerPersonId?: string;
  readonly grants?: readonly AuthorizationGrant[];
  readonly privacy?: SensitiveRecordPrivacy;
  readonly sensitiveDomain?: SensitiveRecordDomain;
}

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly reason:
    | 'role'
    | 'owner'
    | 'explicit_allow'
    | 'explicit_deny'
    | 'inactive_membership'
    | 'branch_boundary'
    | 'privacy_boundary'
    | 'ai_explicit_permission_required'
    | 'no_policy';
  readonly matchedGrantId?: string;
  readonly denialReason?: string;
}

const rolePolicies = {
  family_admin: { '*': ['read','create','update','delete','share','record','ai_process','administer'] },
  adult_member: {
    family: ['read'], person: ['read','create','update'], relation: ['read','create'],
    event: ['read','create','update','share','ai_process'], location: ['read','create','update'],
    archive_item: [], life_record: [],
    finance_record: ['read'], finance_valuation: ['read'],
    health_record: ['read'], medication_plan: ['read'], family_health_history: ['read']
  },
  limited_member: { family: ['read'], person: ['read'], event: ['read'] },
  caregiver: {
    family: ['read'], person: ['read'], event: ['read'],
    health_record: ['read'], medication_plan: ['read'], family_health_history: ['read']
  },
  advisor: { family: ['read'], finance_record: ['read'], finance_valuation: ['read'] }
} as const satisfies Readonly<Record<AuthorizationRole, Readonly<Record<string, readonly AuthorizationAction[]>>>>;

/** Central role-policy query used by presentation and legacy fine-grained guards. */
export const isAdministrativeRole = (role: unknown): role is AuthorizationRole =>
  typeof role === 'string'
  && Object.prototype.hasOwnProperty.call(rolePolicies, role)
  && Boolean((rolePolicies as Readonly<Record<string, Readonly<Record<string, readonly AuthorizationAction[]>>>>)[role]?.['*']?.includes('administer'));

const activeGrant = (grant: AuthorizationGrant, request: AuthorizationRequest): boolean =>
  grant.subjectAccountId === request.accountId &&
  grant.resourceType === request.resourceType &&
  (grant.resourceId === request.resourceId || grant.resourceId === '*') &&
  grant.actions.includes(request.action) &&
  (grant.purpose === 'general' || grant.purpose === (request.purpose ?? 'general')) &&
  (!grant.familyBranchId || grant.familyBranchId === request.resourceBranchId) &&
  Date.parse(grant.startsAt) <= Date.parse(request.occurredAt) &&
  (!grant.endsAt || Date.parse(grant.endsAt) >= Date.parse(request.occurredAt));

const isOwner = (request: AuthorizationRequest): boolean => Boolean(
  request.actorPersonId && request.ownerPersonId && request.actorPersonId === request.ownerPersonId
);

const roleDecision = (request: AuthorizationRequest): AuthorizationDecision => {
  const rolePolicy = rolePolicies[request.role] as Readonly<Record<string, readonly AuthorizationAction[]>>;
  const actions = rolePolicy[request.resourceType] ?? rolePolicy['*'] ?? [];
  return actions.includes(request.action)
    ? { allowed: true, reason: 'role' }
    : { allowed: false, reason: 'no_policy' };
};

export class CentralAuthorizationService {
  public authorize(request: AuthorizationRequest): AuthorizationDecision {
    const grants = (request.grants ?? []).filter((grant) => activeGrant(grant, request));
    const deny = grants.find((grant) => grant.effect === 'deny');
    if (deny) return {
      allowed: false,
      reason: 'explicit_deny',
      matchedGrantId: deny.id,
      ...(deny.denialReason ? { denialReason: deny.denialReason } : {})
    };

    const allow = grants.find((grant) => grant.effect === 'allow');
    const sensitiveRecord = Boolean(request.sensitiveDomain && request.privacy);
    const canAdministerResource = roleDecision({ ...request, action: 'administer' }).allowed;

    if (
      request.resourceBranchId &&
      !canAdministerResource &&
      !(request.actorBranchIds ?? []).includes(request.resourceBranchId) &&
      !allow
    ) return { allowed: false, reason: 'branch_boundary' };

    if (sensitiveRecord && request.action === 'ai_process') {
      return allow
        ? { allowed: true, reason: 'explicit_allow', matchedGrantId: allow.id }
        : { allowed: false, reason: 'ai_explicit_permission_required' };
    }

    if (sensitiveRecord && request.privacy !== 'family') {
      if (isOwner(request) && request.action !== 'administer') return { allowed: true, reason: 'owner' };
      return allow
        ? { allowed: true, reason: 'explicit_allow', matchedGrantId: allow.id }
        : { allowed: false, reason: 'privacy_boundary' };
    }

    if (isOwner(request) && request.action !== 'administer') return { allowed: true, reason: 'owner' };
    if (allow) return { allowed: true, reason: 'explicit_allow', matchedGrantId: allow.id };

    return roleDecision(request);
  }
}
