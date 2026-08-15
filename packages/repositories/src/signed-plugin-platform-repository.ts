import { asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type {
  SignedPluginCapabilityCode,
  SignedPluginDataDeclarationView,
  SignedPluginDesiredState,
  SignedPluginMutationKind,
  SignedPluginProviderKind
} from '@ppt/domain';
import {
  assertPolicyAuthorizedRepositoryContext,
  type PolicyAuthorizedRepositoryExecutionContext,
  type RepositoryExecutionContext,
  type RepositoryResult,
  type SignedPluginInstallationRow,
  type SignedPluginInstallationSnapshotRow,
  type SignedPluginMutationRow,
  type SignedPluginPlatformCenterKey,
  type SignedPluginPlatformPolicyResourceRepositoryPort,
  type SignedPluginPlatformRepositoryPort,
  type SignedPluginReleaseRow
} from '@ppt/repository-contracts';
import { platformPolicyPersistenceBinding } from './platform-policy-transaction-repository.js';
import { SqliteRepository } from './sqlite-base.js';

const installationSelect = `SELECT id,family_id,owner_person_id,display_name,current_version,current_release_id,
  previous_version,desired_state,runtime_execution_ready,external_provider_connection_ready,revision,state_fingerprint,
  last_mutation_id,created_at,updated_at,emergency_disabled_at FROM signed_plugin_installations`;
const releaseSelect = `SELECT id,family_id,owner_person_id,plugin_id,display_name,version,manifest_sha256,package_sha256,
  entrypoint_sha256,sbom_sha256,license_inventory_sha256,provenance_sha256,signer_key_id,provider_kinds_json,
  capability_codes_json,data_declarations_json,egress_mode,egress_hosts_json,sandbox_profile,signature_verified,
  verified_at,issued_at,expires_at,release_fingerprint,mutation_id FROM signed_plugin_releases`;
const mutationSelect = `SELECT id,family_id,owner_person_id,resource_type,resource_id,actor_account_id,actor_person_id,
  mutation_kind,client_operation_id,request_fingerprint,expected_revision,revision,resource_state_fingerprint,occurred_at
  FROM signed_plugin_mutations`;

const parseArray = <T>(value: unknown, field: string): readonly T[] => {
  const parsed: unknown = JSON.parse(String(value));
  if (!Array.isArray(parsed)) throw new Error(`Signed plugin ${field} is not an array`);
  return Object.freeze(parsed.map((item) => typeof item === 'object' && item !== null
    ? Object.freeze({ ...(item as Record<string, unknown>) }) as T : item as T));
};
const mapInstallation = (row: Record<string, unknown>): SignedPluginInstallationRow => Object.freeze({
  id: String(row.id),
  familyId: asFamilyId(String(row.family_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  displayName: String(row.display_name),
  currentVersion: String(row.current_version),
  currentReleaseId: String(row.current_release_id),
  ...(row.previous_version ? { previousVersion: String(row.previous_version) } : {}),
  desiredState: String(row.desired_state) as SignedPluginDesiredState,
  runtimeExecutionReady: false,
  externalProviderConnectionReady: false,
  revision: Number(row.revision),
  stateFingerprint: String(row.state_fingerprint),
  lastMutationId: String(row.last_mutation_id),
  createdAt: asIsoDateTime(String(row.created_at)),
  updatedAt: asIsoDateTime(String(row.updated_at)),
  ...(row.emergency_disabled_at ? { emergencyDisabledAt: asIsoDateTime(String(row.emergency_disabled_at)) } : {})
});
const mapRelease = (row: Record<string, unknown>): SignedPluginReleaseRow => Object.freeze({
  id: String(row.id),
  familyId: asFamilyId(String(row.family_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  pluginId: String(row.plugin_id),
  displayName: String(row.display_name),
  version: String(row.version),
  manifestSha256: String(row.manifest_sha256),
  packageSha256: String(row.package_sha256),
  entrypointSha256: String(row.entrypoint_sha256),
  sbomSha256: String(row.sbom_sha256),
  licenseInventorySha256: String(row.license_inventory_sha256),
  provenanceSha256: String(row.provenance_sha256),
  signerKeyId: String(row.signer_key_id),
  providerKinds: parseArray<SignedPluginProviderKind>(row.provider_kinds_json, 'provider kinds'),
  capabilityCodes: parseArray<SignedPluginCapabilityCode>(row.capability_codes_json, 'capabilities'),
  dataDeclarations: parseArray<SignedPluginDataDeclarationView>(row.data_declarations_json, 'data declarations'),
  egressMode: String(row.egress_mode) as SignedPluginReleaseRow['egressMode'],
  egressHosts: parseArray<string>(row.egress_hosts_json, 'egress hosts'),
  sandboxProfile: 'isolated_child_process',
  signatureVerified: true,
  verifiedAt: asIsoDateTime(String(row.verified_at)),
  issuedAt: asIsoDateTime(String(row.issued_at)),
  expiresAt: asIsoDateTime(String(row.expires_at)),
  releaseFingerprint: String(row.release_fingerprint),
  mutationId: String(row.mutation_id)
});
const mapMutation = (row: Record<string, unknown>): SignedPluginMutationRow => Object.freeze({
  id: String(row.id),
  familyId: asFamilyId(String(row.family_id)),
  ownerPersonId: asPersonId(String(row.owner_person_id)),
  resourceType: 'signed_plugin_installation',
  resourceId: String(row.resource_id),
  actorAccountId: String(row.actor_account_id),
  actorPersonId: asPersonId(String(row.actor_person_id)),
  mutationKind: String(row.mutation_kind) as SignedPluginMutationKind,
  clientOperationId: String(row.client_operation_id),
  requestFingerprint: String(row.request_fingerprint),
  expectedRevision: Number(row.expected_revision),
  revision: Number(row.revision),
  resourceStateFingerprint: String(row.resource_state_fingerprint),
  occurredAt: asIsoDateTime(String(row.occurred_at))
});

const assertKey = (
  context: PolicyAuthorizedRepositoryExecutionContext,
  key: SignedPluginPlatformCenterKey,
  mode: 'read' | 'write'
): void => {
  assertPolicyAuthorizedRepositoryContext(context, {
    resourceType: mode === 'read' ? 'signed_plugin_platform_center' : 'signed_plugin_installation',
    resourceId: mode === 'read' ? '*' : context.policyAuthorization.resourceId,
    action: context.policyAuthorization.action,
    capability: mode === 'read' ? 'family.read' : 'family.write',
    correlationId: context.correlationId,
    resourceFamilyId: key.familyId
  });
  const authorization = context.policyAuthorization;
  if (authorization.purpose !== 'general' || authorization.subject.accountId !== key.accountId
    || authorization.subject.personId !== key.actorPersonId || !authorization.subject.familyIds.includes(key.familyId)
    || authorization.resourceFamilyId !== key.familyId
    || authorization.receiptRecord.request.resource.ownerPersonId !== key.ownerPersonId
    || authorization.receiptRecord.request.resource.sensitivity !== 'highly_sensitive'
    || key.centerId !== `signed-plugin-platform:${key.familyId}:${key.ownerPersonId}`
    || (mode === 'read' && (authorization.action !== 'read' || key.actorPersonId !== key.ownerPersonId))
    || (mode === 'write' && !['create', 'update', 'delete'].includes(authorization.action))
    || (mode === 'write' && authorization.action === 'create' && key.actorPersonId !== key.ownerPersonId)) {
    throw new Error('Signed plugin key does not match the exact owner policy receipt');
  }
};

const expectedAction = (kind: SignedPluginMutationKind): 'create' | 'update' | 'delete' => {
  if (kind === 'release_register') return 'create';
  if (kind === 'emergency_disable') return 'delete';
  return 'update';
};
const writeBinding = (context: PolicyAuthorizedRepositoryExecutionContext, row: SignedPluginMutationRow) => {
  const binding = platformPolicyPersistenceBinding(context, 'signed_plugin_installation', row.resourceId);
  if (!binding || binding.resourceFamilyId !== row.familyId || binding.purpose !== 'general'
    || binding.capability !== 'family.write' || binding.occurredAt !== row.occurredAt
    || binding.action !== expectedAction(row.mutationKind)) {
    throw new Error('Signed plugin mutation requires an exact durable policy receipt');
  }
  return binding;
};

export class SqliteSignedPluginPlatformRepository extends SqliteRepository implements
  SignedPluginPlatformRepositoryPort, SignedPluginPlatformPolicyResourceRepositoryPort {
  public resolvePolicyResource(
    context: RepositoryExecutionContext,
    resourceType: 'signed_plugin_installation',
    resourceId: string
  ): ReturnType<SignedPluginPlatformPolicyResourceRepositoryPort['resolvePolicyResource']> {
    return this.execute(context, () => {
      if (resourceType !== 'signed_plugin_installation') return null;
      const row = this.database(context).prepare(`SELECT id,family_id,owner_person_id,revision,desired_state,state_fingerprint
        FROM signed_plugin_installations WHERE id=?`).get(resourceId) as Record<string, unknown> | undefined;
      return row ? Object.freeze({ id: String(row.id), familyId: asFamilyId(String(row.family_id)),
        ownerPersonId: asPersonId(String(row.owner_person_id)), revision: Number(row.revision),
        status: String(row.desired_state) as SignedPluginDesiredState, stateFingerprint: String(row.state_fingerprint) }) : null;
    });
  }

  public loadCenter(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: SignedPluginPlatformCenterKey
  ): RepositoryResult<readonly SignedPluginInstallationSnapshotRow[]> {
    assertKey(context, key, 'read');
    return this.execute(context, () => {
      const rows = this.database(context).prepare(`${installationSelect}
        WHERE family_id=? AND owner_person_id=? ORDER BY updated_at DESC,id LIMIT 201`)
        .all(key.familyId, key.ownerPersonId) as Record<string, unknown>[];
      if (rows.length > 200) throw new Error('Signed plugin center exceeds its bounded installation contract');
      return Object.freeze(rows.map((installationRaw) => {
        const installation = mapInstallation(installationRaw);
        const releaseRaw = this.database(context).prepare(`${releaseSelect} WHERE id=? AND family_id=? AND owner_person_id=? AND plugin_id=?`)
          .get(installation.currentReleaseId, key.familyId, key.ownerPersonId, installation.id) as Record<string, unknown> | undefined;
        if (!releaseRaw) throw new Error('Signed plugin current release binding is missing');
        const releaseCount = Number((this.database(context).prepare(`SELECT COUNT(*) count FROM signed_plugin_releases
          WHERE family_id=? AND owner_person_id=? AND plugin_id=?`).get(key.familyId, key.ownerPersonId, installation.id) as { count: number }).count);
        if (releaseCount < 1 || releaseCount > 64) throw new Error('Signed plugin release history exceeds its bounded contract');
        return Object.freeze({ installation, currentRelease: mapRelease(releaseRaw), releaseCount });
      }));
    });
  }

  public findInstallation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: SignedPluginPlatformCenterKey,
    pluginId: string
  ): RepositoryResult<SignedPluginInstallationRow | null> {
    assertKey(context, key, 'write');
    return this.execute(context, () => {
      const row = this.database(context).prepare(`${installationSelect} WHERE id=? AND family_id=? AND owner_person_id=?`)
        .get(pluginId, key.familyId, key.ownerPersonId) as Record<string, unknown> | undefined;
      return row ? mapInstallation(row) : null;
    });
  }

  public findRelease(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: SignedPluginPlatformCenterKey,
    pluginId: string,
    version: string
  ): RepositoryResult<SignedPluginReleaseRow | null> {
    assertKey(context, key, 'write');
    return this.execute(context, () => {
      const row = this.database(context).prepare(`${releaseSelect} WHERE family_id=? AND owner_person_id=? AND plugin_id=? AND version=?`)
        .get(key.familyId, key.ownerPersonId, pluginId, version) as Record<string, unknown> | undefined;
      return row ? mapRelease(row) : null;
    });
  }

  public findMutationByClientOperationId(
    context: PolicyAuthorizedRepositoryExecutionContext,
    key: SignedPluginPlatformCenterKey,
    clientOperationId: string
  ): RepositoryResult<SignedPluginMutationRow | null> {
    assertKey(context, key, 'write');
    return this.execute(context, () => {
      const row = this.database(context).prepare(`${mutationSelect} WHERE family_id=? AND actor_account_id=? AND client_operation_id=?`)
        .get(key.familyId, key.accountId, clientOperationId) as Record<string, unknown> | undefined;
      return row ? mapMutation(row) : null;
    });
  }

  public insertMutation(context: PolicyAuthorizedRepositoryExecutionContext, row: SignedPluginMutationRow): RepositoryResult<void> {
    const binding = writeBinding(context, row);
    if (row.actorAccountId !== context.policyAuthorization.subject.accountId
      || row.actorPersonId !== context.policyAuthorization.subject.personId
      || row.ownerPersonId !== context.policyAuthorization.receiptRecord.request.resource.ownerPersonId
      || row.revision !== row.expectedRevision + 1) throw new Error('Signed plugin mutation identity or revision is invalid');
    return this.execute(context, () => {
      this.database(context).prepare(`INSERT INTO signed_plugin_mutations(
        id,family_id,owner_person_id,resource_type,resource_id,actor_account_id,actor_person_id,mutation_kind,
        client_operation_id,request_fingerprint,expected_revision,revision,resource_state_fingerprint,occurred_at,
        policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,policy_correlation_id,policy_resource_type,
        policy_resource_id,policy_action,policy_capability) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(row.id,row.familyId,row.ownerPersonId,row.resourceType,row.resourceId,row.actorAccountId,row.actorPersonId,
          row.mutationKind,row.clientOperationId,row.requestFingerprint,row.expectedRevision,row.revision,
          row.resourceStateFingerprint,row.occurredAt,binding.receiptHash,binding.receiptVersion,binding.nonce,
          context.correlationId,binding.resourceType,binding.resourceId,binding.action,binding.capability);
    });
  }

  public insertRelease(context: PolicyAuthorizedRepositoryExecutionContext, row: SignedPluginReleaseRow): RepositoryResult<void> {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType: 'signed_plugin_installation', resourceId: row.pluginId,
      action: context.policyAuthorization.action, capability: 'family.write', correlationId: context.correlationId,
      resourceFamilyId: row.familyId });
    const binding = platformPolicyPersistenceBinding(context, 'signed_plugin_installation', row.pluginId);
    if (!binding || !['create', 'update'].includes(binding.action)) throw new Error('Signed plugin release receipt is missing');
    return this.execute(context, () => {
      this.database(context).prepare(`INSERT INTO signed_plugin_releases(id,family_id,owner_person_id,plugin_id,display_name,
        version,manifest_sha256,package_sha256,entrypoint_sha256,sbom_sha256,license_inventory_sha256,provenance_sha256,
        signer_key_id,provider_kinds_json,capability_codes_json,data_declarations_json,egress_mode,egress_hosts_json,
        sandbox_profile,signature_verified,verified_at,issued_at,expires_at,release_fingerprint,mutation_id,policy_receipt_hash)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id,row.familyId,row.ownerPersonId,row.pluginId,
          row.displayName,row.version,row.manifestSha256,row.packageSha256,row.entrypointSha256,row.sbomSha256,
          row.licenseInventorySha256,row.provenanceSha256,row.signerKeyId,JSON.stringify(row.providerKinds),
          JSON.stringify(row.capabilityCodes),JSON.stringify(row.dataDeclarations),row.egressMode,JSON.stringify(row.egressHosts),
          row.sandboxProfile,1,row.verifiedAt,row.issuedAt,row.expiresAt,row.releaseFingerprint,row.mutationId,binding.receiptHash);
    });
  }

  public insertInstallation(context: PolicyAuthorizedRepositoryExecutionContext, row: SignedPluginInstallationRow): RepositoryResult<void> {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType: 'signed_plugin_installation', resourceId: row.id,
      action: 'create', capability: 'family.write', correlationId: context.correlationId, resourceFamilyId: row.familyId });
    return this.execute(context, () => this.writeInstallation(context, row, null));
  }

  public saveInstallation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: SignedPluginInstallationRow,
    expectedRevision: number
  ): RepositoryResult<void> {
    assertPolicyAuthorizedRepositoryContext(context, { resourceType: 'signed_plugin_installation', resourceId: row.id,
      action: context.policyAuthorization.action, capability: 'family.write', correlationId: context.correlationId,
      resourceFamilyId: row.familyId });
    return this.execute(context, () => this.writeInstallation(context, row, expectedRevision));
  }

  private writeInstallation(
    context: PolicyAuthorizedRepositoryExecutionContext,
    row: SignedPluginInstallationRow,
    expectedRevision: number | null
  ): void {
    const binding = platformPolicyPersistenceBinding(context, 'signed_plugin_installation', row.id);
    if (!binding) throw new Error('Signed plugin installation receipt is missing');
    if (expectedRevision === null) {
      this.database(context).prepare(`INSERT INTO signed_plugin_installations(id,family_id,owner_person_id,display_name,
        current_version,current_release_id,previous_version,desired_state,runtime_execution_ready,
        external_provider_connection_ready,revision,state_fingerprint,last_mutation_id,created_at,updated_at,
        emergency_disabled_at,policy_receipt_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(row.id,row.familyId,row.ownerPersonId,row.displayName,row.currentVersion,row.currentReleaseId,row.previousVersion??null,
          row.desiredState,0,0,row.revision,row.stateFingerprint,row.lastMutationId,row.createdAt,row.updatedAt,
          row.emergencyDisabledAt??null,binding.receiptHash);
      return;
    }
    const result = this.database(context).prepare(`UPDATE signed_plugin_installations SET display_name=?,current_version=?,
      current_release_id=?,previous_version=?,desired_state=?,runtime_execution_ready=0,external_provider_connection_ready=0,
      revision=?,state_fingerprint=?,last_mutation_id=?,updated_at=?,emergency_disabled_at=?,policy_receipt_hash=?
      WHERE id=? AND family_id=? AND owner_person_id=? AND revision=?`).run(row.displayName,row.currentVersion,row.currentReleaseId,
        row.previousVersion??null,row.desiredState,row.revision,row.stateFingerprint,row.lastMutationId,row.updatedAt,
        row.emergencyDisabledAt??null,binding.receiptHash,row.id,row.familyId,row.ownerPersonId,expectedRevision);
    if (Number(result.changes) !== 1) throw new Error('Signed plugin optimistic revision conflict');
  }
}
