import type { FamilyId, IsoDateTime, PersonId } from '@ppt/core';
import type {
  SignedPluginCapabilityCode,
  SignedPluginDataDeclarationView,
  SignedPluginDesiredState,
  SignedPluginMutationKind,
  SignedPluginProviderKind,
  SignedPluginResourceType
} from '@ppt/domain';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult
} from './repository-context.js';

export interface SignedPluginPlatformCenterKey {
  readonly familyId: FamilyId;
  readonly accountId: string;
  readonly actorPersonId: PersonId;
  readonly ownerPersonId: PersonId;
  readonly centerId: string;
}

export interface SignedPluginReleaseRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly pluginId: string;
  readonly displayName: string;
  readonly version: string;
  readonly manifestSha256: string;
  readonly packageSha256: string;
  readonly entrypointSha256: string;
  readonly sbomSha256: string;
  readonly licenseInventorySha256: string;
  readonly provenanceSha256: string;
  readonly signerKeyId: string;
  readonly providerKinds: readonly SignedPluginProviderKind[];
  readonly capabilityCodes: readonly SignedPluginCapabilityCode[];
  readonly dataDeclarations: readonly SignedPluginDataDeclarationView[];
  readonly egressMode: 'none' | 'allowlist';
  readonly egressHosts: readonly string[];
  readonly sandboxProfile: 'isolated_child_process';
  readonly signatureVerified: true;
  readonly verifiedAt: IsoDateTime;
  readonly issuedAt: IsoDateTime;
  readonly expiresAt: IsoDateTime;
  readonly releaseFingerprint: string;
  readonly mutationId: string;
}

export interface SignedPluginInstallationRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly displayName: string;
  readonly currentVersion: string;
  readonly currentReleaseId: string;
  readonly previousVersion?: string;
  readonly desiredState: SignedPluginDesiredState;
  readonly runtimeExecutionReady: false;
  readonly externalProviderConnectionReady: false;
  readonly revision: number;
  readonly stateFingerprint: string;
  readonly lastMutationId: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly emergencyDisabledAt?: IsoDateTime;
}

export interface SignedPluginInstallationSnapshotRow {
  readonly installation: SignedPluginInstallationRow;
  readonly currentRelease: SignedPluginReleaseRow;
  readonly releaseCount: number;
}

export interface SignedPluginMutationRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly resourceType: SignedPluginResourceType;
  readonly resourceId: string;
  readonly actorAccountId: string;
  readonly actorPersonId: PersonId;
  readonly mutationKind: SignedPluginMutationKind;
  readonly clientOperationId: string;
  readonly requestFingerprint: string;
  readonly expectedRevision: number;
  readonly revision: number;
  readonly resourceStateFingerprint: string;
  readonly occurredAt: IsoDateTime;
}

export interface SignedPluginPlatformRepositoryPort {
  loadCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: SignedPluginPlatformCenterKey
  ): RepositoryResult<readonly SignedPluginInstallationSnapshotRow[]>;
  findInstallation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: SignedPluginPlatformCenterKey,
    pluginId: string
  ): RepositoryResult<SignedPluginInstallationRow | null>;
  findRelease(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: SignedPluginPlatformCenterKey,
    pluginId: string,
    version: string
  ): RepositoryResult<SignedPluginReleaseRow | null>;
  findMutationByClientOperationId(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: SignedPluginPlatformCenterKey,
    clientOperationId: string
  ): RepositoryResult<SignedPluginMutationRow | null>;
  insertMutation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: SignedPluginMutationRow
  ): RepositoryResult<void>;
  insertRelease(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: SignedPluginReleaseRow
  ): RepositoryResult<void>;
  insertInstallation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: SignedPluginInstallationRow
  ): RepositoryResult<void>;
  saveInstallation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: SignedPluginInstallationRow,
    expectedRevision: number
  ): RepositoryResult<void>;
}

/** Payload-free metadata resolver used before the central policy transaction. */
export interface SignedPluginPlatformPolicyResourceRepositoryPort {
  resolvePolicyResource(
    context: RepositoryExecutionContext,
    resourceType: SignedPluginResourceType,
    resourceId: string
  ): RepositoryResult<{
    readonly id: string;
    readonly familyId: FamilyId;
    readonly ownerPersonId: PersonId;
    readonly revision: number;
    readonly status: SignedPluginDesiredState;
    readonly stateFingerprint: string;
  } | null>;
}
