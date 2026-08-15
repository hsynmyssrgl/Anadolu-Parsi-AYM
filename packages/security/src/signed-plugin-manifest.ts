import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { domainToASCII } from 'node:url';

export const SIGNED_PLUGIN_MANIFEST_FORMAT = 'ppt-signed-plugin-manifest' as const;
export const SIGNED_PLUGIN_MANIFEST_VERSION = 1 as const;
export const SIGNED_PLUGIN_MANIFEST_MAX_LIFETIME_MS = 31 * 86_400_000;
export const SIGNED_PLUGIN_MANIFEST_MAX_FUTURE_SKEW_MS = 300_000;

export const VERIFIED_PLUGIN_PROVIDER_KINDS = Object.freeze([
  'bank', 'school', 'matter', 'fhir', 'onedrive', 'maps', 'ocr', 'ai', 'browser'
] as const);
export type VerifiedPluginProviderKind = (typeof VERIFIED_PLUGIN_PROVIDER_KINDS)[number];

export const VERIFIED_PLUGIN_CAPABILITY_CODES = Object.freeze([
  'bank.read', 'school.read', 'matter.read', 'fhir.read', 'onedrive.read',
  'maps.read', 'ocr.process', 'ai.process', 'browser.read'
] as const);
export type VerifiedPluginCapabilityCode = (typeof VERIFIED_PLUGIN_CAPABILITY_CODES)[number];

export interface SignedPluginManifestDataDeclaration {
  readonly resourceType: string;
  readonly sensitivity: 'standard' | 'personal' | 'highly_sensitive';
  readonly purpose: 'general' | 'finance' | 'education' | 'home_automation' | 'health'
    | 'document_processing' | 'ai_assistance' | 'browser_assistance';
  readonly access: 'read_metadata' | 'read_content' | 'process_local';
  readonly retentionDays: number;
}

export interface SignedPluginManifest {
  readonly pluginId: string;
  readonly displayName: string;
  readonly version: string;
  readonly minimumHostVersion: string;
  readonly sourceCommitId: string;
  readonly packageSha256: string;
  readonly entrypointSha256: string;
  readonly sbomSha256: string;
  readonly licenseInventorySha256: string;
  readonly provenanceSha256: string;
  readonly providerKinds: readonly VerifiedPluginProviderKind[];
  readonly capabilityCodes: readonly VerifiedPluginCapabilityCode[];
  readonly dataDeclarations: readonly SignedPluginManifestDataDeclaration[];
  readonly egress: {
    readonly mode: 'none' | 'allowlist';
    readonly hosts: readonly string[];
  };
  readonly sandbox: {
    readonly profile: 'isolated_child_process';
    readonly filesystemAccess: 'none';
    readonly processSpawnAllowed: false;
    readonly nativeModulesAllowed: false;
    readonly networkBrokerOnly: true;
  };
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface SignedPluginManifestEnvelope {
  readonly format: typeof SIGNED_PLUGIN_MANIFEST_FORMAT;
  readonly version: typeof SIGNED_PLUGIN_MANIFEST_VERSION;
  readonly manifest: SignedPluginManifest;
  readonly signature: {
    readonly algorithm: 'Ed25519';
    readonly keyId: string;
    readonly valueBase64Url: string;
  };
}

export interface TrustedPluginSigningKey {
  readonly keyId: string;
  readonly publicKeyPem: string;
  readonly status: 'ACTIVE' | 'RETIRED';
}

export interface VerifiedSignedPluginManifest {
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
  readonly signatureVerified: true;
  readonly providerKinds: readonly VerifiedPluginProviderKind[];
  readonly capabilityCodes: readonly VerifiedPluginCapabilityCode[];
  readonly dataDeclarations: readonly SignedPluginManifestDataDeclaration[];
  readonly egressMode: 'none' | 'allowlist';
  readonly egressHosts: readonly string[];
  readonly sandboxProfile: 'isolated_child_process';
  readonly filesystemAccess: 'none';
  readonly processSpawnAllowed: false;
  readonly nativeModulesAllowed: false;
  readonly networkBrokerOnly: true;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly verifiedAt: string;
}

export interface VerifySignedPluginManifestOptions {
  readonly trustedKeys: readonly TrustedPluginSigningKey[];
  readonly now?: () => Date;
  readonly maximumLifetimeMs?: number;
  readonly maximumFutureSkewMs?: number;
}

export class SignedPluginManifestVerificationError extends Error {
  public constructor(
    public readonly code: 'MALFORMED' | 'UNTRUSTED_SIGNER' | 'SIGNATURE_INVALID' | 'MANIFEST_EXPIRED' | 'POLICY_DENIED',
    message: string
  ) {
    super(message);
    this.name = 'SignedPluginManifestVerificationError';
  }
}

const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_ID = /^[a-f0-9]{40}$/u;
const SAFE_ID = /^[a-z][a-z0-9.-]{2,63}$/u;
const RESOURCE = /^[a-z][a-z0-9._:-]{1,127}$/u;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]{1,64})?$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const CONTROL = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const providerKinds = new Set<string>(VERIFIED_PLUGIN_PROVIDER_KINDS);
const capabilityCodes = new Set<string>(VERIFIED_PLUGIN_CAPABILITY_CODES);
const sensitivities = new Set(['standard', 'personal', 'highly_sensitive']);
const purposes = new Set(['general', 'finance', 'education', 'home_automation', 'health', 'document_processing', 'ai_assistance', 'browser_assistance']);
const accessModes = new Set(['read_metadata', 'read_content', 'process_local']);
const plainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length && actual.every((key, index) => key === canonical[index]);
};
const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;

export const canonicalizeSignedPluginManifest = (value: unknown): string => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new SignedPluginManifestVerificationError('MALFORMED', 'Manifest contains a non-finite number.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeSignedPluginManifest).join(',')}]`;
  if (!plainRecord(value)) throw new SignedPluginManifestVerificationError('MALFORMED', 'Manifest contains an unsupported value.');
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeSignedPluginManifest(value[key])}`).join(',')}}`;
};

const canonicalHost = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length < 4 || value.length > 253 || value !== value.toLowerCase()) return null;
  if (value.includes('*') || value.includes('/') || value.includes(':') || value.includes('@')) return null;
  const ascii = domainToASCII(value);
  if (!ascii || ascii !== value || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u.test(ascii)) return null;
  if (ascii === 'localhost' || ascii.endsWith('.localhost') || ascii.endsWith('.local') || ascii.endsWith('.internal')) return null;
  return ascii;
};

const assertShape: (value: unknown) => asserts value is SignedPluginManifestEnvelope =
  (value: unknown): asserts value is SignedPluginManifestEnvelope => {
  if (!plainRecord(value) || !exactKeys(value, ['format', 'version', 'manifest', 'signature'])
    || value.format !== SIGNED_PLUGIN_MANIFEST_FORMAT || value.version !== SIGNED_PLUGIN_MANIFEST_VERSION) {
    throw new SignedPluginManifestVerificationError('MALFORMED', 'Signed plugin envelope is malformed.');
  }
  if (!plainRecord(value.signature) || !exactKeys(value.signature, ['algorithm', 'keyId', 'valueBase64Url'])
    || value.signature.algorithm !== 'Ed25519' || typeof value.signature.keyId !== 'string' || !SAFE_ID.test(value.signature.keyId)
    || typeof value.signature.valueBase64Url !== 'string' || !BASE64URL.test(value.signature.valueBase64Url)) {
    throw new SignedPluginManifestVerificationError('MALFORMED', 'Signed plugin signature is malformed.');
  }
  const manifest = value.manifest;
  if (!plainRecord(manifest) || !exactKeys(manifest, [
    'pluginId', 'displayName', 'version', 'minimumHostVersion', 'sourceCommitId', 'packageSha256', 'entrypointSha256',
    'sbomSha256', 'licenseInventorySha256', 'provenanceSha256', 'providerKinds', 'capabilityCodes', 'dataDeclarations',
    'egress', 'sandbox', 'issuedAt', 'expiresAt'
  ])) throw new SignedPluginManifestVerificationError('MALFORMED', 'Plugin manifest keys are not exact.');
  if (typeof manifest.pluginId !== 'string' || !SAFE_ID.test(manifest.pluginId)
    || typeof manifest.displayName !== 'string' || manifest.displayName.normalize('NFKC').trim() !== manifest.displayName
    || manifest.displayName.length < 2 || manifest.displayName.length > 120 || CONTROL.test(manifest.displayName)
    || typeof manifest.version !== 'string' || !SEMVER.test(manifest.version)
    || typeof manifest.minimumHostVersion !== 'string' || !SEMVER.test(manifest.minimumHostVersion)
    || typeof manifest.sourceCommitId !== 'string' || !GIT_ID.test(manifest.sourceCommitId)
    || ![manifest.packageSha256, manifest.entrypointSha256, manifest.sbomSha256, manifest.licenseInventorySha256, manifest.provenanceSha256]
      .every((hash) => typeof hash === 'string' && SHA256.test(hash) && !/^0{64}$/u.test(hash))) {
    throw new SignedPluginManifestVerificationError('MALFORMED', 'Plugin manifest identity or evidence hashes are invalid.');
  }
  if (!Array.isArray(manifest.providerKinds) || manifest.providerKinds.length < 1 || manifest.providerKinds.length > 9
    || !manifest.providerKinds.every((item) => typeof item === 'string' && providerKinds.has(item)) || !unique(manifest.providerKinds as string[])
    || !Array.isArray(manifest.capabilityCodes) || manifest.capabilityCodes.length < 1 || manifest.capabilityCodes.length > 16
    || !manifest.capabilityCodes.every((item) => typeof item === 'string' && capabilityCodes.has(item)) || !unique(manifest.capabilityCodes as string[])) {
    throw new SignedPluginManifestVerificationError('POLICY_DENIED', 'Provider or capability declarations violate minimum-authority policy.');
  }
  for (const provider of manifest.providerKinds as string[]) {
    if (!(manifest.capabilityCodes as string[]).some((capability) => capability.startsWith(`${provider}.`))) {
      throw new SignedPluginManifestVerificationError('POLICY_DENIED', 'Every provider must have one explicit capability.');
    }
  }
  if (!Array.isArray(manifest.dataDeclarations) || manifest.dataDeclarations.length > 32) {
    throw new SignedPluginManifestVerificationError('POLICY_DENIED', 'Data declaration count is outside policy.');
  }
  for (const declaration of manifest.dataDeclarations) {
    if (!plainRecord(declaration) || !exactKeys(declaration, ['resourceType', 'sensitivity', 'purpose', 'access', 'retentionDays'])
      || typeof declaration.resourceType !== 'string' || !RESOURCE.test(declaration.resourceType)
      || !sensitivities.has(String(declaration.sensitivity)) || !purposes.has(String(declaration.purpose))
      || !accessModes.has(String(declaration.access)) || !Number.isSafeInteger(declaration.retentionDays)
      || Number(declaration.retentionDays) < 0 || Number(declaration.retentionDays) > 30) {
      throw new SignedPluginManifestVerificationError('POLICY_DENIED', 'Data sensitivity, purpose, access or retention declaration is invalid.');
    }
  }
  if (!plainRecord(manifest.egress) || !exactKeys(manifest.egress, ['mode', 'hosts'])
    || (manifest.egress.mode !== 'none' && manifest.egress.mode !== 'allowlist') || !Array.isArray(manifest.egress.hosts)
    || manifest.egress.hosts.length > 16 || !unique(manifest.egress.hosts as string[])
    || !manifest.egress.hosts.every((host) => canonicalHost(host) === host)
    || (manifest.egress.mode === 'none' ? manifest.egress.hosts.length !== 0 : manifest.egress.hosts.length < 1)) {
    throw new SignedPluginManifestVerificationError('POLICY_DENIED', 'Network egress must use an exact public-host allowlist.');
  }
  if (!plainRecord(manifest.sandbox) || !exactKeys(manifest.sandbox, [
    'profile', 'filesystemAccess', 'processSpawnAllowed', 'nativeModulesAllowed', 'networkBrokerOnly'
  ]) || manifest.sandbox.profile !== 'isolated_child_process' || manifest.sandbox.filesystemAccess !== 'none'
    || manifest.sandbox.processSpawnAllowed !== false || manifest.sandbox.nativeModulesAllowed !== false
    || manifest.sandbox.networkBrokerOnly !== true) {
    throw new SignedPluginManifestVerificationError('POLICY_DENIED', 'Sandbox declaration is not fail-closed.');
  }
  if (typeof manifest.issuedAt !== 'string' || typeof manifest.expiresAt !== 'string'
    || !Number.isFinite(Date.parse(manifest.issuedAt)) || !Number.isFinite(Date.parse(manifest.expiresAt))) {
    throw new SignedPluginManifestVerificationError('MALFORMED', 'Manifest time binding is invalid.');
  }
  };

export const verifySignedPluginManifest = (
  value: unknown,
  options: VerifySignedPluginManifestOptions
): VerifiedSignedPluginManifest => {
  assertShape(value);
  const now = (options.now ?? (() => new Date()))().getTime();
  const issuedAt = Date.parse(value.manifest.issuedAt);
  const expiresAt = Date.parse(value.manifest.expiresAt);
  const maximumFutureSkewMs = options.maximumFutureSkewMs ?? SIGNED_PLUGIN_MANIFEST_MAX_FUTURE_SKEW_MS;
  const maximumLifetimeMs = options.maximumLifetimeMs ?? SIGNED_PLUGIN_MANIFEST_MAX_LIFETIME_MS;
  if (issuedAt > now + maximumFutureSkewMs || expiresAt <= now || expiresAt <= issuedAt || expiresAt - issuedAt > maximumLifetimeMs) {
    throw new SignedPluginManifestVerificationError('MANIFEST_EXPIRED', 'Manifest is expired or outside the trusted time window.');
  }
  const trusted = options.trustedKeys.find((key) => key.keyId === value.signature.keyId && key.status === 'ACTIVE');
  if (!trusted || options.trustedKeys.filter((key) => key.keyId === value.signature.keyId).length !== 1) {
    throw new SignedPluginManifestVerificationError('UNTRUSTED_SIGNER', 'Manifest signer is not uniquely trusted.');
  }
  const canonical = canonicalizeSignedPluginManifest(value.manifest);
  let signature: Buffer | undefined;
  try {
    signature = Buffer.from(value.signature.valueBase64Url, 'base64url');
    if (signature.length !== 64 || signature.toString('base64url') !== value.signature.valueBase64Url
      || !verifySignature(null, Buffer.from(canonical, 'utf8'), createPublicKey(trusted.publicKeyPem), signature)) {
      throw new Error('invalid signature');
    }
  } catch {
    throw new SignedPluginManifestVerificationError('SIGNATURE_INVALID', 'Manifest signature verification failed.');
  } finally {
    signature?.fill(0);
  }
  return Object.freeze({
    pluginId: value.manifest.pluginId,
    displayName: value.manifest.displayName,
    version: value.manifest.version,
    manifestSha256: createHash('sha256').update(canonical, 'utf8').digest('hex'),
    packageSha256: value.manifest.packageSha256,
    entrypointSha256: value.manifest.entrypointSha256,
    sbomSha256: value.manifest.sbomSha256,
    licenseInventorySha256: value.manifest.licenseInventorySha256,
    provenanceSha256: value.manifest.provenanceSha256,
    signerKeyId: value.signature.keyId,
    signatureVerified: true,
    providerKinds: Object.freeze([...value.manifest.providerKinds]),
    capabilityCodes: Object.freeze([...value.manifest.capabilityCodes]),
    dataDeclarations: Object.freeze(value.manifest.dataDeclarations.map((item) => Object.freeze({ ...item }))),
    egressMode: value.manifest.egress.mode,
    egressHosts: Object.freeze([...value.manifest.egress.hosts]),
    sandboxProfile: value.manifest.sandbox.profile,
    filesystemAccess: value.manifest.sandbox.filesystemAccess,
    processSpawnAllowed: false,
    nativeModulesAllowed: false,
    networkBrokerOnly: true,
    issuedAt: new Date(issuedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    verifiedAt: new Date(now).toISOString()
  });
};
