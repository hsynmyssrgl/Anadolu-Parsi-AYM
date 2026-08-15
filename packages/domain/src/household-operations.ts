import type { IsoDateTime } from '@ppt/core';

export const HOUSEHOLD_OPERATION_AREAS = Object.freeze([
  'shopping',
  'inventory',
  'meals',
  'chores',
  'expenses',
  'deliveries',
  'guests',
  'pets'
] as const);

export type HouseholdOperationArea = (typeof HOUSEHOLD_OPERATION_AREAS)[number];

export const HOUSEHOLD_OPERATION_KINDS = Object.freeze([
  'shopping_list',
  'shopping_item',
  'stock_item',
  'recipe',
  'meal_plan',
  'chore',
  'routine',
  'bill',
  'subscription',
  'shared_expense',
  'delivery',
  'guest_access',
  'pet_care'
] as const);

export type HouseholdOperationKind = (typeof HOUSEHOLD_OPERATION_KINDS)[number];

export type HouseholdOperationStatus =
  | 'planned'
  | 'active'
  | 'low_stock'
  | 'due'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'delivered'
  | 'revoked'
  | 'deleted';

export type HouseholdOperationMutationKind = 'item_create' | 'item_update' | 'item_delete';

export interface HouseholdExpenseShareView {
  readonly personId: string;
  readonly basisPoints: number;
}

export interface HouseholdOperationItemView {
  readonly id: string;
  readonly centerId: string;
  readonly ownerPersonId: string;
  readonly kind: HouseholdOperationKind;
  readonly area: HouseholdOperationArea;
  readonly title: string;
  readonly status: HouseholdOperationStatus;
  readonly revision: number;
  readonly parentItemId?: string;
  readonly assignedPersonId?: string;
  readonly stockCategory?: 'food' | 'cleaning';
  readonly quantity?: number;
  readonly unit?: string;
  readonly scheduledAt?: IsoDateTime;
  readonly dueAt?: IsoDateTime;
  readonly expiresAt?: IsoDateTime;
  readonly recurrence?: string;
  readonly amountMinor?: number;
  readonly currency?: string;
  readonly splitShares?: readonly HouseholdExpenseShareView[];
  readonly ingredientNames?: readonly string[];
  readonly allergenCodes?: readonly string[];
  readonly avoidedAllergenCodes?: readonly string[];
  readonly allergyFilterStatus?: 'not_applicable' | 'clear';
  readonly providerLabel?: string;
  /** Only a user-entered final-four display hint. Full tracking identifiers are forbidden. */
  readonly trackingLastFour?: string;
  readonly guestLabel?: string;
  readonly accessArea?: string;
  /** Opaque local reference only; no veterinary or external-provider identity is implied. */
  readonly opaquePetReference?: string;
  readonly note?: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt?: IsoDateTime;
}

export interface HouseholdOperationsTruthView {
  readonly localOnly: true;
  readonly externalShoppingOrder: 'not_performed';
  readonly automaticInventoryScan: 'not_configured';
  readonly recipeMedicalAdvice: 'not_provided';
  readonly paymentExecution: 'not_performed';
  readonly carrierSynchronization: 'not_performed';
  readonly remoteAccessControl: 'not_configured';
  readonly keyCodeStored: false;
  readonly petCareDelivery: 'not_performed';
}

export interface HouseholdOperationsCenterView {
  readonly schemaVersion: 1;
  readonly centerId: string;
  readonly revision: number;
  readonly items: readonly HouseholdOperationItemView[];
  readonly countsByArea: Readonly<Record<HouseholdOperationArea, number>>;
  readonly truth: HouseholdOperationsTruthView;
  readonly generatedAt: IsoDateTime;
}

export interface CreateHouseholdOperationItemInput {
  readonly expectedCenterRevision: number;
  readonly clientOperationId: string;
  readonly itemId: string;
  readonly kind: HouseholdOperationKind;
  readonly title: string;
  readonly status?: Exclude<HouseholdOperationStatus, 'deleted'>;
  readonly parentItemId?: string;
  readonly assignedPersonId?: string;
  readonly stockCategory?: 'food' | 'cleaning';
  readonly quantity?: number;
  readonly unit?: string;
  readonly scheduledAt?: string;
  readonly dueAt?: string;
  readonly expiresAt?: string;
  readonly recurrence?: string;
  readonly amountMinor?: number;
  readonly currency?: string;
  readonly splitShares?: readonly HouseholdExpenseShareView[];
  readonly ingredientNames?: readonly string[];
  readonly allergenCodes?: readonly string[];
  readonly avoidedAllergenCodes?: readonly string[];
  readonly providerLabel?: string;
  readonly trackingLastFour?: string;
  readonly guestLabel?: string;
  readonly accessArea?: string;
  readonly opaquePetReference?: string;
  readonly note?: string;
}

export interface UpdateHouseholdOperationItemInput {
  readonly expectedCenterRevision: number;
  readonly expectedItemRevision: number;
  readonly clientOperationId: string;
  readonly itemId: string;
  readonly status?: Exclude<HouseholdOperationStatus, 'deleted'>;
  readonly assignedPersonId?: string | null;
  readonly quantity?: number;
  readonly scheduledAt?: string | null;
  readonly dueAt?: string | null;
  readonly expiresAt?: string | null;
  readonly note?: string | null;
}

export interface DeleteHouseholdOperationItemInput {
  readonly expectedCenterRevision: number;
  readonly expectedItemRevision: number;
  readonly clientOperationId: string;
  readonly itemId: string;
  readonly reason: string;
}

export interface HouseholdOperationMutationReceiptView {
  readonly centerId: string;
  readonly itemId: string;
  readonly mutationKind: HouseholdOperationMutationKind;
  readonly previousCenterRevision: number;
  readonly centerRevision: number;
  readonly previousItemRevision: number;
  readonly itemRevision: number;
  readonly occurredAt: IsoDateTime;
  readonly replayed: boolean;
  readonly localOnly: true;
  readonly externalAction: 'not_performed';
}

export const householdOperationAreaForKind = (kind: HouseholdOperationKind): HouseholdOperationArea => {
  if (kind === 'shopping_list' || kind === 'shopping_item') return 'shopping';
  if (kind === 'stock_item') return 'inventory';
  if (kind === 'recipe' || kind === 'meal_plan') return 'meals';
  if (kind === 'chore' || kind === 'routine') return 'chores';
  if (kind === 'bill' || kind === 'subscription' || kind === 'shared_expense') return 'expenses';
  if (kind === 'delivery') return 'deliveries';
  if (kind === 'guest_access') return 'guests';
  return 'pets';
};

export const householdOperationsCenterId = (familyId: string): string =>
  `household-operations-center:${familyId}`;
