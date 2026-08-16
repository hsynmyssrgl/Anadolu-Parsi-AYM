import type { IsoDateTime } from '@ppt/core';

export const SIGNED_PLUGIN_PROVIDER_KINDS = Object.freeze([
  'bank',
  'school',
  'matter',
  'fhir',
  'onedrive',
  'maps',
  'ocr',
  'ai',
  'browser'
] as const);
export type SignedPluginProviderKind = (typeof SIGNED_PLUGIN_PROVIDER_KINDS)[number];

export const SIGNED_PLUGIN_CAPABILITY_CODES = Object.freeze([
  'bank.read',
  'school.read',
  'matter.read',
  'fhir.read',
  'onedrive.read',
  'maps.read',
  'ocr.process',
  'ai.process',
  'browser.read'
] as const);
export type SignedPluginCapabilityCode = (typeof SIGNED_PLUGIN_CAPABILITY_CODES)[number];

export const SIGNED_PLUGIN_MAX_INSTALLATIONS = 200;
export const SIGNED_PLUGIN_MAX_RELEASES_PER_PLUGIN = 64;
export const SIGNED_PLUGIN_MAX_MUTATIONS = 100_000;

export type SignedPluginDataSensitivity = 'standard' | 'personal' | 'highly_sensitive';
export type SignedPluginDataPurpose =
  | 'general'
  | 'finance'
  | 'education'
  | 'home_automation'
  | 'health'
  | 'document_processing'
  | 'ai_assistance'
  | 'browser_assistance';
export type SignedPluginDataAccessMode = 'read_metadata' | 'read_content' | 'process_local';
export type SignedPluginDesiredState = 'enabled' | 'disabled' | 'emergency_disabled';

export interface SignedPluginDataDeclarationView {
  readonly resourceType: string;
  readonly sensitivity: SignedPluginDataSensitivity;
  readonly purpose: SignedPluginDataPurpose;
  readonly access: SignedPluginDataAccessMode;
  readonly retentionDays: number;
}

export interface SignedPluginReleaseView {
  readonly version: string;
  readonly minimumHostVersion: string;
  readonly providerKinds: readonly SignedPluginProviderKind[];
  readonly capabilityCodes: readonly SignedPluginCapabilityCode[];
  readonly dataDeclarations: readonly SignedPluginDataDeclarationView[];
  readonly egressMode: 'none' | 'allowlist';
  readonly egressHostCount: number;
  readonly sandboxProfile: 'isolated_child_process';
  readonly signatureVerified: true;
  readonly sbomEvidencePresent: true;
  readonly licenseInventoryEvidencePresent: true;
  readonly provenanceEvidencePresent: true;
  readonly verifiedAt: IsoDateTime;
  readonly expiresAt: IsoDateTime;
  readonly manifestStatus: 'valid' | 'expired';
}

export interface SignedPluginInstallationView {
  readonly id: string;
  readonly ownerPersonId: string;
  readonly displayName: string;
  readonly currentRelease: SignedPluginReleaseView;
  readonly previousVersion?: string;
  readonly desiredState: SignedPluginDesiredState;
  readonly runtimeExecutionReady: false;
  readonly externalProviderConnectionReady: false;
  readonly rollbackAvailable: boolean;
  readonly releaseHistoryCount: number;
  readonly releaseHistoryLimitReached: boolean;
  readonly revision: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly emergencyDisabledAt?: IsoDateTime;
}

export interface SignedPluginCapacityBandView {
  readonly current: number;
  readonly maximum: number;
  readonly remaining: number;
  readonly limitReached: boolean;
}

export interface SignedPluginStorageCapacityView {
  readonly installations: SignedPluginCapacityBandView;
  readonly mutations: SignedPluginCapacityBandView;
}

export interface SignedPluginPlatformTruthView {
  readonly localCandidateRegistryImplemented: true;
  readonly manifestCryptographyImplemented: true;
  readonly verifiedManifestRequired: true;
  readonly capabilityDefaultDeny: true;
  readonly networkBrokerRequired: true;
  readonly sandboxContractRequired: true;
  readonly rollbackRegistryImplemented: true;
  readonly emergencyDisableRegistryImplemented: true;
  readonly sbomLicenseAndProvenanceHashesRequired: true;
  readonly supplyChainReleaseGateRequired: true;
  readonly rendererInstallAuthority: false;
  readonly thirdPartyCodeExecutionPerformed: false;
  readonly externalProviderConnectionPerformed: false;
  readonly providerCredentialsStored: false;
  readonly productionSigningTrustProvisioned: false;
  readonly productionReleaseEligible: false;
  readonly sandboxRuntimeVerified: false;
  readonly osNetworkIsolationVerified: false;
  readonly providerAvailabilityGuaranteed: false;
  readonly networkUsedByCurrentImplementation: false;
  readonly minimumHostVersionEnforced: true;
  readonly emergencyDisableRequiresNewHigherSignedRelease: true;
  readonly boundedStorageCapsEnforced: true;
  readonly automaticRetentionRecoveryImplemented: false;
}

export interface SignedPluginPlatformCenterView {
  readonly schemaVersion: 1;
  readonly centerId: string;
  readonly ownerPersonId: string;
  readonly installations: readonly SignedPluginInstallationView[];
  readonly installationTotal: number;
  readonly storageCapacity: SignedPluginStorageCapacityView;
  readonly truth: SignedPluginPlatformTruthView;
  readonly generatedAt: IsoDateTime;
}

/** Main-process only. The renderer cannot submit signatures, manifests, hashes or package paths. */
export interface VerifiedSignedPluginReleaseInput {
  readonly pluginId: string;
  readonly displayName: string;
  readonly version: string;
  readonly minimumHostVersion: string;
  readonly manifestSha256: string;
  readonly packageSha256: string;
  readonly entrypointSha256: string;
  readonly sbomSha256: string;
  readonly licenseInventorySha256: string;
  readonly provenanceSha256: string;
  readonly signerKeyId: string;
  readonly signatureVerified: true;
  readonly providerKinds: readonly SignedPluginProviderKind[];
  readonly capabilityCodes: readonly SignedPluginCapabilityCode[];
  readonly dataDeclarations: readonly SignedPluginDataDeclarationView[];
  readonly egressMode: 'none' | 'allowlist';
  readonly egressHosts: readonly string[];
  readonly sandboxProfile: 'isolated_child_process';
  readonly filesystemAccess: 'none';
  readonly processSpawnAllowed: false;
  readonly nativeModulesAllowed: false;
  readonly networkBrokerOnly: true;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

/** Main-process only package registration or update command. */
export interface RegisterSignedPluginReleaseInput {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly release: VerifiedSignedPluginReleaseInput;
}

export interface SetSignedPluginDesiredStateInput {
  readonly clientOperationId: string;
  readonly pluginId: string;
  readonly expectedRevision: number;
  readonly enabled: boolean;
  readonly reason: string;
}

export interface EmergencyDisableSignedPluginInput {
  readonly clientOperationId: string;
  readonly pluginId: string;
  readonly expectedRevision: number;
  readonly confirmation: 'EKLENTIYI ACIL DURDUR';
  readonly reason: string;
}

export interface RollbackSignedPluginInput {
  readonly clientOperationId: string;
  readonly pluginId: string;
  readonly expectedRevision: number;
  readonly targetVersion: string;
  readonly confirmation: 'ONCEKI SURUME DON';
}

export type SignedPluginMutationKind =
  | 'release_register'
  | 'release_update'
  | 'desired_enable'
  | 'desired_disable'
  | 'emergency_disable'
  | 'release_rollback';

export type SignedPluginResourceType = 'signed_plugin_installation';

export interface SignedPluginMutationReceiptView {
  readonly pluginId: string;
  readonly mutationKind: SignedPluginMutationKind;
  readonly previousRevision: number;
  readonly revision: number;
  readonly occurredAt: IsoDateTime;
  readonly replayed: boolean;
  readonly runtimeExecutionPerformed: false;
  readonly externalProviderConnectionPerformed: false;
  readonly networkUsed: false;
}

export const signedPluginPlatformCenterId = (familyId: string, ownerPersonId: string): string =>
  `signed-plugin-platform:${familyId}:${ownerPersonId}`;

export const signedPluginPlatformTruth = Object.freeze({
  localCandidateRegistryImplemented: true as const,
  manifestCryptographyImplemented: true as const,
  verifiedManifestRequired: true as const,
  capabilityDefaultDeny: true as const,
  networkBrokerRequired: true as const,
  sandboxContractRequired: true as const,
  rollbackRegistryImplemented: true as const,
  emergencyDisableRegistryImplemented: true as const,
  sbomLicenseAndProvenanceHashesRequired: true as const,
  supplyChainReleaseGateRequired: true as const,
  rendererInstallAuthority: false as const,
  thirdPartyCodeExecutionPerformed: false as const,
  externalProviderConnectionPerformed: false as const,
  providerCredentialsStored: false as const,
  productionSigningTrustProvisioned: false as const,
  productionReleaseEligible: false as const,
  sandboxRuntimeVerified: false as const,
  osNetworkIsolationVerified: false as const,
  providerAvailabilityGuaranteed: false as const,
  networkUsedByCurrentImplementation: false as const,
  minimumHostVersionEnforced: true as const,
  emergencyDisableRequiresNewHigherSignedRelease: true as const,
  boundedStorageCapsEnforced: true as const,
  automaticRetentionRecoveryImplemented: false as const
});
