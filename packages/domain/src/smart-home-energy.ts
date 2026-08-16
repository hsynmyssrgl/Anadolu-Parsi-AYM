import type { IsoDateTime } from '@ppt/core';

export const SMART_HOME_DEVICE_KINDS = Object.freeze([
  'matter_bridge',
  'smoke_sensor',
  'carbon_monoxide_sensor',
  'water_leak_sensor',
  'door_sensor',
  'temperature_sensor',
  'humidity_sensor',
  'energy_meter',
  'thermostat',
  'light',
  'smart_plug',
  'camera',
  'doorbell',
  'ev_charger'
] as const);
export type SmartHomeDeviceKind = (typeof SMART_HOME_DEVICE_KINDS)[number];

export const SMART_HOME_OBSERVATION_KINDS = Object.freeze([
  'smoke_alarm',
  'carbon_monoxide_alarm',
  'water_leak_alarm',
  'door_open',
  'temperature_celsius',
  'humidity_percent',
  'energy_kilowatt_hour',
  'power_watts',
  'ev_charge_kilowatt_hour',
  'thermostat_target_celsius',
  'light_on',
  'smart_plug_on'
] as const);
export type SmartHomeObservationKind = (typeof SMART_HOME_OBSERVATION_KINDS)[number];

export const SMART_HOME_MAX_DEVICES = 500;
export const SMART_HOME_MAX_OBSERVATIONS = 50_000;
export const SMART_HOME_MAX_CAMERA_CONSENTS = 2_000;
export const SMART_HOME_MAX_MUTATIONS = 100_000;

export type SmartHomeObservationUnit = 'boolean' | 'celsius' | 'percent' | 'watt' | 'kilowatt_hour';
export type SmartHomeDeviceStatus = 'active' | 'offline' | 'retired';
export type SmartHomeCameraConsentStatus = 'active' | 'revoked';
export type SmartHomeCameraPurpose = 'live_view' | 'doorbell_answer';

export interface SmartHomeDeviceView {
  readonly id: string;
  readonly ownerPersonId: string;
  readonly adapterId: string;
  readonly providerId: string;
  readonly kind: SmartHomeDeviceKind;
  readonly label: string;
  readonly room?: string;
  readonly status: SmartHomeDeviceStatus;
  readonly signedAdapterEvidencePersisted: true;
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface SmartHomeObservationView {
  readonly id: string;
  readonly deviceId: string;
  readonly kind: SmartHomeObservationKind;
  readonly unit: SmartHomeObservationUnit;
  readonly numericValue?: number;
  readonly booleanValue?: boolean;
  readonly observedAt: IsoDateTime;
  readonly recordedAt: IsoDateTime;
}

export interface SmartHomeCameraConsentView {
  readonly id: string;
  readonly deviceId: string;
  readonly purpose: SmartHomeCameraPurpose;
  readonly status: SmartHomeCameraConsentStatus;
  readonly grantedByAccountId: string;
  readonly grantedByPersonId: string;
  readonly visibleIndicatorRequired: true;
  readonly expiresAt: IsoDateTime;
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly revokedAt?: IsoDateTime;
}

export type SmartHomeCameraConsentEffectiveStatus = 'active' | 'expired' | 'revoked';

/** Renderer-safe consent projection. Durable actor identities remain main-process only. */
export interface SmartHomeCameraConsentCenterItemView extends Omit<SmartHomeCameraConsentView,
  'grantedByAccountId' | 'grantedByPersonId'> {
  readonly effectiveStatus: SmartHomeCameraConsentEffectiveStatus;
}

export interface SmartHomeCapacityBandView {
  readonly current: number;
  readonly maximum: number;
  readonly remaining: number;
  readonly limitReached: boolean;
}

export interface SmartHomeStorageCapacityView {
  readonly devices: SmartHomeCapacityBandView;
  readonly observations: SmartHomeCapacityBandView;
  readonly cameraConsents: SmartHomeCapacityBandView;
  readonly mutations: SmartHomeCapacityBandView;
}

export interface SmartHomeSettingsView {
  readonly id: string;
  readonly ownerPersonId: string;
  readonly processingEnabled: boolean;
  readonly cameraAccessDefaultDenied: true;
  readonly hiddenSurveillanceProhibited: true;
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface SmartHomeEnergyTruthView {
  readonly localFirst: true;
  readonly cloudUsed: false;
  readonly externalDeliveryPerformed: 'not_performed';
  readonly matterCommissioningPerformed: false;
  readonly liveProviderConnectionTested: false;
  readonly liveDeviceControlPerformed: false;
  readonly sensorProviderIngestionPerformed: false;
  readonly rawCameraOrAudioStored: false;
  readonly hiddenSurveillanceProhibited: true;
  readonly visibleTimeBoundedCameraConsentRequired: true;
  readonly maximumCameraConsentMinutes: 60;
  readonly signedAdapterEvidenceRequired: true;
  readonly providerAvailabilityGuaranteed: false;
  readonly observationPayloadMode: 'bounded_scalar_metadata_only';
  readonly networkUsedByCurrentImplementation: false;
  readonly processingDisabledBlocksNewObservations: true;
  readonly expiredConsentPresentedAsActive: false;
  readonly boundedStorageCapsEnforced: true;
  readonly automaticRetentionRecoveryImplemented: false;
}

export interface SmartHomeEnergyCenterView {
  readonly schemaVersion: 1;
  readonly centerId: string;
  readonly ownerPersonId: string;
  readonly devices: readonly SmartHomeDeviceView[];
  readonly observations: readonly SmartHomeObservationView[];
  readonly observationTotal: number;
  readonly observationsTruncated: boolean;
  readonly cameraConsents: readonly SmartHomeCameraConsentCenterItemView[];
  readonly cameraConsentTotal: number;
  readonly cameraConsentsTruncated: boolean;
  readonly storageCapacity: SmartHomeStorageCapacityView;
  readonly settings: SmartHomeSettingsView;
  readonly truth: SmartHomeEnergyTruthView;
  readonly generatedAt: IsoDateTime;
}

/** Main-process only. Renderer IPC never accepts adapter trust evidence. */
export interface RegisterSmartHomeDeviceInput {
  readonly clientOperationId: string;
  readonly deviceId: string;
  readonly adapterId: string;
  readonly providerId: string;
  readonly kind: SmartHomeDeviceKind;
  readonly label: string;
  readonly room?: string;
  readonly localIdentifierSha256: string;
  readonly adapterManifestSha256: string;
  readonly adapterSignerKeyId: string;
  readonly adapterSignatureVerified: true;
}

/** Main-process only. Renderer IPC never accepts provider observations. */
export interface RecordSmartHomeObservationInput {
  readonly clientOperationId: string;
  readonly observationId: string;
  readonly deviceId: string;
  readonly expectedDeviceRevision: number;
  readonly kind: SmartHomeObservationKind;
  readonly numericValue?: number;
  readonly booleanValue?: boolean;
  readonly observedAt: string;
  readonly sourceManifestSha256: string;
}

/** Main-process only device lifecycle update. */
export interface UpdateSmartHomeDeviceStatusInput {
  readonly clientOperationId: string;
  readonly deviceId: string;
  readonly expectedRevision: number;
  readonly status: SmartHomeDeviceStatus;
}

export interface GrantSmartHomeCameraConsentInput {
  readonly clientOperationId: string;
  readonly consentId: string;
  readonly deviceId: string;
  readonly purpose: SmartHomeCameraPurpose;
  readonly expiresAt: string;
}

export interface RevokeSmartHomeCameraConsentInput {
  readonly clientOperationId: string;
  readonly consentId: string;
  readonly expectedRevision: number;
}

export interface SetSmartHomeProcessingInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly enabled: boolean;
  readonly reason: string;
}

export type SmartHomeMutationKind =
  | 'device_register'
  | 'device_status_update'
  | 'observation_record'
  | 'camera_consent_grant'
  | 'camera_consent_revoke'
  | 'processing_enable'
  | 'processing_disable';

export type SmartHomeResourceType =
  | 'smart_home_device'
  | 'smart_home_observation'
  | 'smart_home_camera_consent'
  | 'smart_home_settings';

export interface SmartHomeMutationReceiptView {
  readonly resourceType: SmartHomeResourceType;
  readonly resourceId: string;
  readonly mutationKind: SmartHomeMutationKind;
  readonly previousRevision: number;
  readonly revision: number;
  readonly occurredAt: IsoDateTime;
  readonly replayed: boolean;
  readonly networkUsed: false;
  readonly cloudUsed: false;
  readonly providerActionPerformed: 'not_performed';
}

export const smartHomeEnergyCenterId = (familyId: string, ownerPersonId: string): string =>
  `smart-home-energy:${familyId}:${ownerPersonId}`;

export const smartHomeEnergyTruth = Object.freeze({
  localFirst: true as const,
  cloudUsed: false as const,
  externalDeliveryPerformed: 'not_performed' as const,
  matterCommissioningPerformed: false as const,
  liveProviderConnectionTested: false as const,
  liveDeviceControlPerformed: false as const,
  sensorProviderIngestionPerformed: false as const,
  rawCameraOrAudioStored: false as const,
  hiddenSurveillanceProhibited: true as const,
  visibleTimeBoundedCameraConsentRequired: true as const,
  maximumCameraConsentMinutes: 60 as const,
  signedAdapterEvidenceRequired: true as const,
  providerAvailabilityGuaranteed: false as const,
  observationPayloadMode: 'bounded_scalar_metadata_only' as const,
  networkUsedByCurrentImplementation: false as const,
  processingDisabledBlocksNewObservations: true as const,
  expiredConsentPresentedAsActive: false as const,
  boundedStorageCapsEnforced: true as const,
  automaticRetentionRecoveryImplemented: false as const
});
