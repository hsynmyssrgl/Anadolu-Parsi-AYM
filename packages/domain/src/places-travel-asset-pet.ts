import type { IsoDate, IsoDateTime } from '@ppt/core';

export const PLACES_TRAVEL_AREAS = Object.freeze([
  'places','moving','pet_care','travel'
] as const);
export type PlacesTravelArea = (typeof PLACES_TRAVEL_AREAS)[number];

export const PLACES_TRAVEL_KINDS = Object.freeze([
  'stored_place','moving_inventory','pet_care_record','travel_plan','reservation','travel_document',
  'travel_budget','shared_expense','packing_item','travel_requirement','offline_travel_pack',
  'language_pack','travel_album','expense_settlement'
] as const);
export type PlacesTravelKind = (typeof PLACES_TRAVEL_KINDS)[number];

export const PLACES_TRAVEL_VISIBILITIES = Object.freeze([
  'family_coordination','selected_members','private'
] as const);
export type PlacesTravelVisibility = (typeof PLACES_TRAVEL_VISIBILITIES)[number];

export type PlacesTravelStatus = 'planned'|'active'|'completed'|'cancelled'|'expired'|'settled'|'deleted';
export type PlacesTravelMutationKind = 'item_create'|'item_update'|'item_delete';
export type PetCareWorkflow = 'vaccination'|'veterinary'|'microchip'|'food'|'insurance'|'travel_document';
export type TravelDocumentKind = 'passport'|'visa'|'insurance'|'reservation_document'|'other';
export type TravelRequirementKind = 'health'|'medication'|'child'|'pet';

export interface PlacesTravelItemView {
  readonly id: string;
  readonly ownerPersonId: string;
  readonly kind: PlacesTravelKind;
  readonly area: PlacesTravelArea;
  readonly title: string;
  readonly status: PlacesTravelStatus;
  readonly visibility: PlacesTravelVisibility;
  readonly revision: number;
  readonly addressLabel?: string;
  readonly latitudeE6?: number;
  readonly longitudeE6?: number;
  readonly offlineFallbackLabel?: string;
  readonly participantPersonIds?: readonly string[];
  readonly startsAt?: IsoDateTime;
  readonly endsAt?: IsoDateTime;
  readonly providerLabel?: string;
  readonly opaqueReference?: string;
  readonly archiveItemId?: string;
  readonly expiresOn?: IsoDate;
  readonly documentKind?: TravelDocumentKind;
  readonly amountMinor?: number;
  readonly currency?: string;
  readonly checklistLabel?: string;
  readonly checklistCompleted?: boolean;
  readonly petReferenceId?: string;
  readonly petWorkflow?: PetCareWorkflow;
  readonly requirementKind?: TravelRequirementKind;
  readonly opaqueRequirementReference?: string;
  readonly languageCode?: string;
  readonly ocrJobId?: string;
  readonly note?: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt?: IsoDateTime;
}

export interface PlacesTravelTruthView {
  readonly localOnly: true;
  readonly mapProviderConfigured: false;
  readonly coordinateAddressFallbackAvailable: true;
  readonly schoolOrTravelProviderSync: 'not_configured';
  readonly externalBookingPerformed: 'not_performed';
  readonly liveTransportTrackingPerformed: 'not_performed';
  readonly paymentExecutionPerformed: 'not_performed';
  readonly documentVerificationPerformed: 'not_performed';
  readonly petHealthAdviceProvided: false;
  readonly healthDetailsDuplicated: false;
  readonly ocrSuggestionAutomaticallyAccepted: false;
  readonly offlinePackDeliveryPerformed: 'not_performed';
  readonly languagePackDownloadPerformed: 'not_performed';
  readonly albumMediaStoredHere: false;
  readonly aiProcessingAllowed: false;
  readonly externalSharingAllowed: false;
}

export interface PlacesTravelCenterView {
  readonly schemaVersion: 1;
  readonly centerId: string;
  readonly ownerPersonId: string;
  readonly items: readonly PlacesTravelItemView[];
  readonly countsByArea: Readonly<Record<PlacesTravelArea,number>>;
  readonly truth: PlacesTravelTruthView;
  readonly generatedAt: IsoDateTime;
}

export interface CreatePlacesTravelItemInput {
  readonly clientOperationId: string;
  readonly itemId: string;
  readonly ownerPersonId: string;
  readonly kind: PlacesTravelKind;
  readonly title: string;
  readonly visibility: PlacesTravelVisibility;
  readonly status?: Exclude<PlacesTravelStatus,'deleted'>;
  readonly addressLabel?: string;
  readonly latitudeE6?: number;
  readonly longitudeE6?: number;
  readonly offlineFallbackLabel?: string;
  readonly participantPersonIds?: readonly string[];
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly providerLabel?: string;
  readonly opaqueReference?: string;
  readonly archiveItemId?: string;
  readonly expiresOn?: string;
  readonly documentKind?: TravelDocumentKind;
  readonly amountMinor?: number;
  readonly currency?: string;
  readonly checklistLabel?: string;
  readonly checklistCompleted?: boolean;
  readonly petReferenceId?: string;
  readonly petWorkflow?: PetCareWorkflow;
  readonly requirementKind?: TravelRequirementKind;
  readonly opaqueRequirementReference?: string;
  readonly languageCode?: string;
  readonly ocrJobId?: string;
  readonly note?: string;
}

export interface UpdatePlacesTravelItemInput {
  readonly clientOperationId: string;
  readonly itemId: string;
  readonly ownerPersonId: string;
  readonly expectedRevision: number;
  readonly title?: string;
  readonly status?: Exclude<PlacesTravelStatus,'deleted'>;
  readonly visibility?: PlacesTravelVisibility;
  readonly startsAt?: string|null;
  readonly endsAt?: string|null;
  readonly expiresOn?: string|null;
  readonly amountMinor?: number|null;
  readonly checklistCompleted?: boolean;
  readonly note?: string|null;
}

export interface DeletePlacesTravelItemInput {
  readonly clientOperationId: string;
  readonly itemId: string;
  readonly ownerPersonId: string;
  readonly expectedRevision: number;
  readonly reason: string;
}

export interface PlacesTravelMutationReceiptView {
  readonly itemId: string;
  readonly ownerPersonId: string;
  readonly mutationKind: PlacesTravelMutationKind;
  readonly previousRevision: number;
  readonly revision: number;
  readonly occurredAt: IsoDateTime;
  readonly replayed: boolean;
  readonly localOnly: true;
  readonly externalAction: 'not_performed';
}

export const placesTravelAreaForKind = (kind: PlacesTravelKind): PlacesTravelArea => {
  if (kind === 'stored_place') return 'places';
  if (kind === 'moving_inventory') return 'moving';
  if (kind === 'pet_care_record') return 'pet_care';
  return 'travel';
};

export const placesTravelCenterId = (familyId:string,ownerPersonId:string):string =>
  `places-travel-center:${familyId}:${ownerPersonId}`;
