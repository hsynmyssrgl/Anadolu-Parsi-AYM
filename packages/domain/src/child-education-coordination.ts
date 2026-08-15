import type { IsoDateTime } from '@ppt/core';

export const CHILD_EDUCATION_AREAS = Object.freeze([
  'schoolwork',
  'events_access',
  'activities',
  'money_goals'
] as const);

export type ChildEducationArea = (typeof CHILD_EDUCATION_AREAS)[number];

export const CHILD_EDUCATION_KINDS = Object.freeze([
  'school',
  'class',
  'timetable',
  'homework',
  'exam',
  'school_event',
  'transport_plan',
  'pickup_authority',
  'course',
  'sport',
  'certificate',
  'book',
  'allowance_budget',
  'education_goal'
] as const);

export type ChildEducationKind = (typeof CHILD_EDUCATION_KINDS)[number];

export const CHILD_EDUCATION_VISIBILITIES = Object.freeze([
  'family_coordination',
  'child_and_selected_guardians',
  'adolescent_private'
] as const);

export type ChildEducationVisibility = (typeof CHILD_EDUCATION_VISIBILITIES)[number];

export type ChildEducationPrivacyExplanationCode =
  | 'family_admin_coordination'
  | 'owner_and_explicit_permission'
  | 'adolescent_owner_private';

export type ChildEducationStatus =
  | 'planned'
  | 'active'
  | 'submitted'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'archived'
  | 'deleted';

export type ChildEducationMutationKind = 'item_create' | 'item_update' | 'item_delete';
export type ChildEducationAgeBand = 'under_13' | 'teen';
export type ChildEducationViewMode = 'guided_child' | 'teen_standard';

export interface ChildEducationItemView {
  readonly id: string;
  readonly childPersonId: string;
  readonly kind: ChildEducationKind;
  readonly area: ChildEducationArea;
  readonly title: string;
  readonly status: ChildEducationStatus;
  readonly visibility: ChildEducationVisibility;
  readonly privacyExplanationCode: ChildEducationPrivacyExplanationCode;
  readonly revision: number;
  readonly institutionLabel?: string;
  readonly classLabel?: string;
  readonly subjectLabel?: string;
  readonly scheduledAt?: IsoDateTime;
  readonly dueAt?: IsoDateTime;
  readonly recurrence?: string;
  readonly transportMode?: 'school_service' | 'family_dropoff' | 'public_transport' | 'walking' | 'other';
  /** Opaque reference to a separately governed 33-P temporary credential. */
  readonly authorityReferenceId?: string;
  readonly amountMinor?: number;
  readonly currency?: string;
  readonly progressBasisPoints?: number;
  readonly certificateStatus?: 'locally_recorded_unverified';
  readonly note?: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt?: IsoDateTime;
}

export interface ChildEducationTruthView {
  readonly localOnly: true;
  readonly childDataClassEnforced: true;
  readonly aiProcessingAllowed: false;
  readonly externalSharingAllowed: false;
  readonly schoolPortalSync: 'not_configured';
  readonly teacherMessaging: 'not_performed';
  readonly liveTransportTracking: 'not_performed';
  readonly pickupCredentialIssuance: 'managed_separately_in_identity_center';
  readonly allowancePaymentExecution: 'not_performed';
  readonly certificateVerification: 'not_performed';
  readonly healthDataDuplicated: false;
  readonly ageAppropriatePresentation: 'derived_from_local_birth_date';
}

export interface ChildEducationCenterView {
  readonly schemaVersion: 1;
  readonly centerId: string;
  readonly childPersonId: string;
  readonly ageBand: ChildEducationAgeBand;
  readonly viewMode: ChildEducationViewMode;
  readonly items: readonly ChildEducationItemView[];
  readonly countsByArea: Readonly<Record<ChildEducationArea, number>>;
  readonly truth: ChildEducationTruthView;
  readonly generatedAt: IsoDateTime;
}

export interface CreateChildEducationItemInput {
  readonly clientOperationId: string;
  readonly itemId: string;
  readonly childPersonId: string;
  readonly kind: ChildEducationKind;
  readonly title: string;
  readonly visibility: ChildEducationVisibility;
  readonly status?: Exclude<ChildEducationStatus, 'deleted'>;
  readonly institutionLabel?: string;
  readonly classLabel?: string;
  readonly subjectLabel?: string;
  readonly scheduledAt?: string;
  readonly dueAt?: string;
  readonly recurrence?: string;
  readonly transportMode?: ChildEducationItemView['transportMode'];
  readonly authorityReferenceId?: string;
  readonly amountMinor?: number;
  readonly currency?: string;
  readonly progressBasisPoints?: number;
  readonly note?: string;
}

export interface UpdateChildEducationItemInput {
  readonly clientOperationId: string;
  readonly itemId: string;
  readonly childPersonId: string;
  readonly expectedRevision: number;
  readonly title?: string;
  readonly status?: Exclude<ChildEducationStatus, 'deleted'>;
  readonly visibility?: ChildEducationVisibility;
  readonly scheduledAt?: string | null;
  readonly dueAt?: string | null;
  readonly progressBasisPoints?: number | null;
  readonly note?: string | null;
}

export interface DeleteChildEducationItemInput {
  readonly clientOperationId: string;
  readonly itemId: string;
  readonly childPersonId: string;
  readonly expectedRevision: number;
  readonly reason: string;
}

export interface ChildEducationMutationReceiptView {
  readonly itemId: string;
  readonly childPersonId: string;
  readonly mutationKind: ChildEducationMutationKind;
  readonly previousRevision: number;
  readonly revision: number;
  readonly occurredAt: IsoDateTime;
  readonly replayed: boolean;
  readonly localOnly: true;
  readonly externalAction: 'not_performed';
}

export const childEducationAreaForKind = (kind: ChildEducationKind): ChildEducationArea => {
  if (['school','class','timetable','homework','exam'].includes(kind)) return 'schoolwork';
  if (['school_event','transport_plan','pickup_authority'].includes(kind)) return 'events_access';
  if (['course','sport','certificate','book'].includes(kind)) return 'activities';
  return 'money_goals';
};

export const childEducationPrivacyExplanationFor = (
  visibility: ChildEducationVisibility
): ChildEducationPrivacyExplanationCode => visibility === 'family_coordination'
  ? 'family_admin_coordination'
  : visibility === 'child_and_selected_guardians'
    ? 'owner_and_explicit_permission'
    : 'adolescent_owner_private';

export const childEducationCenterId = (familyId: string, childPersonId: string): string =>
  `child-education-center:${familyId}:${childPersonId}`;
