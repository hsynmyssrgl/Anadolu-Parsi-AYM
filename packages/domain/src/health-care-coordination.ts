import type { IsoDateTime } from '@ppt/core';

export const HEALTH_CARE_ENTRY_KINDS = Object.freeze([
  'allergy',
  'chronic_condition',
  'blood_type',
  'vaccine',
  'appointment',
  'document_link',
  'care_plan',
  'care_task',
  'medication_confirmation',
  'transport',
  'caregiver_shift',
  'handover_note',
  'blood_pressure',
  'blood_glucose',
  'weight',
  'nutrition',
  'hydration',
  'wellbeing_check',
  'help_request',
  'fall_observation',
  'emergency_observation',
  'contact_action'
] as const);

export type HealthCareEntryKind = (typeof HEALTH_CARE_ENTRY_KINDS)[number];

export const HEALTH_CARE_ACCESS_SCOPES = Object.freeze([
  'emergency_summary',
  'care_plan',
  'medication',
  'appointments',
  'measurements',
  'check_ins',
  'alerts',
  'contacts',
  'documents'
] as const);

export type HealthCareAccessScope = (typeof HEALTH_CARE_ACCESS_SCOPES)[number];
export type HealthCareGrantAction = 'read' | 'record';
export type HealthCareEntryStatus =
  | 'active'
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'needs_help'
  | 'observed'
  | 'not_performed';

export type HealthCareMutationKind = 'entry_record' | 'grant_upsert' | 'grant_revoke';

export interface HealthCareMeasurementView {
  readonly value: number;
  readonly secondaryValue?: number;
  readonly unit: string;
}

export interface HealthCareEntryView {
  readonly id: string;
  readonly centerId: string;
  readonly ownerPersonId: string;
  readonly kind: HealthCareEntryKind;
  readonly accessScope: HealthCareAccessScope;
  readonly title: string;
  readonly status: HealthCareEntryStatus;
  readonly occurredAt: IsoDateTime;
  readonly scheduledAt?: IsoDateTime;
  readonly note?: string;
  readonly measurement?: HealthCareMeasurementView;
  readonly relatedHealthRecordId?: string;
  readonly relatedMedicationPlanId?: string;
  readonly relatedArchiveItemId?: string;
  readonly recordedBy: 'owner' | 'caregiver' | 'family_admin';
  readonly source: 'manual_local';
  readonly createdAt: IsoDateTime;
}

export interface HealthCareAccessGrantView {
  readonly id: string;
  readonly centerId: string;
  readonly ownerPersonId: string;
  readonly caregiverAccountId: string;
  readonly caregiverPersonId: string;
  readonly allowedScopes: readonly HealthCareAccessScope[];
  readonly actions: readonly HealthCareGrantAction[];
  readonly state: 'active' | 'revoked';
  readonly startsAt: IsoDateTime;
  readonly endsAt?: IsoDateTime;
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly revokedAt?: IsoDateTime;
}

export interface HealthCareEmergencySummaryView {
  readonly allergies: readonly HealthCareEntryView[];
  readonly chronicConditions: readonly HealthCareEntryView[];
  readonly bloodType?: HealthCareEntryView;
  readonly activeMedicationConfirmations: readonly HealthCareEntryView[];
}

export interface HealthCareCoordinationTruthView {
  readonly localOnly: true;
  readonly medicalVerification: 'not_performed';
  readonly healthRegistryLookup: 'not_performed';
  readonly sensorIntegration: 'not_configured';
  readonly helpDelivery: 'not_performed';
  readonly emergencyServiceContact: 'not_performed';
  readonly remoteAssistance: 'not_configured';
  readonly minimumNecessaryFiltered: true;
  readonly largeTextPresentationAvailable: true;
}

export interface HealthCareCoordinationCenterView {
  readonly schemaVersion: 1;
  readonly centerId: string;
  readonly ownerPersonId: string;
  readonly revision: number;
  readonly entries: readonly HealthCareEntryView[];
  readonly caregiverGrants: readonly HealthCareAccessGrantView[];
  readonly emergencySummary: HealthCareEmergencySummaryView;
  readonly visibleScopes: readonly HealthCareAccessScope[];
  readonly canRecord: boolean;
  readonly truncated: boolean;
  readonly truth: HealthCareCoordinationTruthView;
  readonly generatedAt: IsoDateTime;
}

export interface RecordHealthCareEntryInput {
  readonly ownerPersonId: string;
  readonly expectedRevision: number;
  readonly clientOperationId: string;
  readonly kind: HealthCareEntryKind;
  readonly title: string;
  readonly status: HealthCareEntryStatus;
  readonly occurredAt: string;
  readonly scheduledAt?: string;
  readonly note?: string;
  readonly measurement?: HealthCareMeasurementView;
  readonly relatedHealthRecordId?: string;
  readonly relatedMedicationPlanId?: string;
  readonly relatedArchiveItemId?: string;
}

export interface UpsertHealthCareAccessGrantInput {
  readonly ownerPersonId: string;
  readonly expectedRevision: number;
  readonly clientOperationId: string;
  readonly grantId: string;
  readonly caregiverAccountId: string;
  readonly allowedScopes: readonly HealthCareAccessScope[];
  readonly actions: readonly HealthCareGrantAction[];
  readonly startsAt: string;
  readonly endsAt?: string;
}

export interface RevokeHealthCareAccessGrantInput {
  readonly ownerPersonId: string;
  readonly expectedRevision: number;
  readonly clientOperationId: string;
  readonly grantId: string;
}

export interface HealthCareMutationReceiptView {
  readonly centerId: string;
  readonly mutationKind: HealthCareMutationKind;
  readonly previousRevision: number;
  readonly revision: number;
  readonly occurredAt: IsoDateTime;
  readonly replayed: boolean;
  readonly localOnly: true;
  readonly externalDelivery: 'not_performed';
}

export const healthCareCenterId = (ownerPersonId: string): string =>
  `health-care-center:${ownerPersonId}`;

export const healthCareAccessScopeForEntryKind = (
  kind: HealthCareEntryKind
): HealthCareAccessScope => {
  if (kind === 'allergy' || kind === 'chronic_condition' || kind === 'blood_type') return 'emergency_summary';
  if (kind === 'care_plan' || kind === 'care_task' || kind === 'caregiver_shift' || kind === 'handover_note') return 'care_plan';
  if (kind === 'medication_confirmation') return 'medication';
  if (kind === 'appointment' || kind === 'transport') return 'appointments';
  if (kind === 'blood_pressure' || kind === 'blood_glucose' || kind === 'weight' || kind === 'nutrition' || kind === 'hydration') return 'measurements';
  if (kind === 'wellbeing_check' || kind === 'help_request') return 'check_ins';
  if (kind === 'fall_observation' || kind === 'emergency_observation') return 'alerts';
  if (kind === 'contact_action') return 'contacts';
  if (kind === 'document_link' || kind === 'vaccine') return 'documents';
  return 'care_plan';
};
