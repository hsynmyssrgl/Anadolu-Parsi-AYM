import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';
import {
  CORE_SERVICE_APPLICATION_API_VERSION,
  CORE_SERVICE_CUTOVER_READINESS_GENESIS_HASH,
  CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION,
  CORE_SERVICE_REQUIRED_DESKTOP_METHODS,
  canonicalizeCoreServiceCutoverReadinessEntry,
  type CoreServiceArchitectureContract,
  type CoreServiceDeviceSecretProtectionStatusContract,
  type CoreServiceFamilyDataCutoverGateId,
  type CoreServiceFamilyDataCutoverReadinessStatusContract,
  type CoreServiceFamilyDataCutoverStatusContract,
  type CoreServiceFamilyDataStatusContract,
  type CoreServiceHealthContract
} from '@ppt/core-service-contracts';
import { CoreServiceApplicationAdapter, type CoreServiceConnectionAuthority } from './core-service-application-adapter.js';

export const CORE_SERVICE_CONNECTION_AUTHORITY_SCHEMA_VERSION = 1 as const;
export const CORE_SERVICE_CONNECTION_AUTHORITY_KIND = 'core-service-connection-authority';

export interface CoreServiceConnectionAuthorityRecord extends CoreServiceConnectionAuthority {
  readonly schemaVersion: typeof CORE_SERVICE_CONNECTION_AUTHORITY_SCHEMA_VERSION;
  readonly expectedPolicyVersion: string;
  readonly issuedAt: string;
}

export interface CoreServiceAuthorityReader {
  readText(path: string): string;
}

export interface CoreServiceStartupConnectionResult {
  readonly adapter: CoreServiceApplicationAdapter;
  readonly health: CoreServiceHealthContract;
  readonly architecture: CoreServiceArchitectureContract;
  readonly familyData: CoreServiceFamilyDataStatusContract;
  readonly deviceSecretProtection: CoreServiceDeviceSecretProtectionStatusContract;
  readonly familyDataCutover: CoreServiceFamilyDataCutoverStatusContract;
  readonly familyDataCutoverReadiness: CoreServiceFamilyDataCutoverReadinessStatusContract;
  readonly authorityPath: string;
}

export type CoreServiceStartupConnectionErrorCode =
  | 'AUTHORITY_UNAVAILABLE'
  | 'AUTHORITY_INVALID'
  | 'CONNECTION_FAILED'
  | 'POLICY_VERSION_MISMATCH'
  | 'ARCHITECTURE_MISMATCH'
  | 'SERVICE_NOT_READY';

export class CoreServiceStartupConnectionError extends Error {
  public readonly code: CoreServiceStartupConnectionErrorCode;

  public constructor(code: CoreServiceStartupConnectionErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CoreServiceStartupConnectionError';
    this.code = code;
  }
}

const assertEndpoint = (endpoint: string, platform: NodeJS.Platform): void => {
  if (endpoint.length > 512) throw new Error('Core Service endpoint is too long');
  if (platform === 'win32') {
    if (!endpoint.startsWith('\\\\.\\pipe\\') || endpoint.length <= '\\\\.\\pipe\\'.length) {
      throw new Error('Windows Core Service endpoint must be a named pipe');
    }
    return;
  }
  if (!isAbsolute(endpoint)) throw new Error('Core Service endpoint must be an absolute local socket path');
};

const CUTOVER_READINESS_GATES = Object.freeze([
  'END_TO_END_SECURITY_VALIDATION',
  'KEY_LIFECYCLE_PROOF',
  'SINGLE_WRITER_PROOF',
  'ROLLBACK_DRILL',
  'EXPLICIT_USER_CUTOVER_APPROVAL'
] as const satisfies readonly CoreServiceFamilyDataCutoverGateId[]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const exactKeys = (value: object, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
};
const strictIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
};

export const isSafeCoreServiceCutoverReadinessStatus = (
  status: CoreServiceFamilyDataCutoverReadinessStatusContract
): boolean => {
  if (!status || typeof status !== 'object' || !exactKeys(status, [
    'schemaVersion', 'mode', 'decision', 'ledgerEpoch', 'entryCount', 'headHash', 'verifierAttached',
    'trustedAnchorAttached', 'integrity', 'acceptanceState', 'allRequiredGatesPass', 'cutoverAuthorityAttached',
    'automaticActivationAllowed', 'persistentPathExposed', 'secretMaterialExposed', 'requiredGates', 'entries',
    'reasons', 'observedAt'
  ])) return false;
  if (
    status.schemaVersion !== 1
    || status.mode !== 'monotonic-evidence-no-cutover'
    || status.decision !== 'blocked'
    || !Number.isSafeInteger(status.ledgerEpoch)
    || status.ledgerEpoch < 0
    || !Number.isSafeInteger(status.entryCount)
    || status.entryCount !== status.ledgerEpoch
    || status.entryCount > CUTOVER_READINESS_GATES.length
    || !SHA256_PATTERN.test(status.headHash)
    || typeof status.verifierAttached !== 'boolean'
    || typeof status.trustedAnchorAttached !== 'boolean'
    || status.integrity !== 'verified'
    || status.cutoverAuthorityAttached !== false
    || status.automaticActivationAllowed !== false
    || status.persistentPathExposed !== false
    || status.secretMaterialExposed !== false
    || !Array.isArray(status.entries)
    || status.entries.length !== status.entryCount
    || !Array.isArray(status.requiredGates)
    || status.requiredGates.length !== CUTOVER_READINESS_GATES.length
    || !Array.isArray(status.reasons)
    || !strictIsoTimestamp(status.observedAt)
    || (status.entryCount > 0 && !status.verifierAttached && !status.trustedAnchorAttached)
  ) return false;

  const accepted = new Map<CoreServiceFamilyDataCutoverGateId, { epoch: number; evidenceDigest: string }>();
  let previousHash: string = CORE_SERVICE_CUTOVER_READINESS_GENESIS_HASH;
  for (const [index, entry] of status.entries.entries()) {
    if (!entry || typeof entry !== 'object' || !exactKeys(entry, [
      'epoch', 'gateId', 'status', 'evidenceDigest', 'previousHash', 'entryHash', 'acceptedAt'
    ])) return false;
    if (
      entry.epoch !== index + 1
      || !CUTOVER_READINESS_GATES.includes(entry.gateId)
      || accepted.has(entry.gateId)
      || entry.status !== 'pass'
      || !SHA256_PATTERN.test(entry.evidenceDigest)
      || entry.previousHash !== previousHash
      || !SHA256_PATTERN.test(entry.entryHash)
      || !strictIsoTimestamp(entry.acceptedAt)
    ) return false;
    const expectedHash = createHash('sha256')
      .update(canonicalizeCoreServiceCutoverReadinessEntry(entry), 'utf8')
      .digest('hex');
    if (entry.entryHash !== expectedHash) return false;
    accepted.set(entry.gateId, { epoch: entry.epoch, evidenceDigest: entry.evidenceDigest });
    previousHash = entry.entryHash;
  }
  if (status.headHash !== previousHash) return false;

  for (const [index, gate] of status.requiredGates.entries()) {
    if (!gate || typeof gate !== 'object' || !exactKeys(gate, ['id', 'status', 'evidenceEpoch', 'evidenceDigest'])) return false;
    const entry = accepted.get(gate.id);
    if (
      gate.id !== CUTOVER_READINESS_GATES[index]
      || gate.status !== (entry ? 'pass' : 'pending')
      || gate.evidenceEpoch !== (entry?.epoch ?? null)
      || gate.evidenceDigest !== (entry?.evidenceDigest ?? null)
    ) return false;
  }
  const allRequiredGatesPass = accepted.size === CUTOVER_READINESS_GATES.length;
  const expectedReasons = [
    'DEC_171_CUTOVER_REMAINS_BLOCKED',
    allRequiredGatesPass ? 'SEPARATE_VERSIONED_USER_DECISION_REQUIRED' : 'ALL_INDEPENDENT_GATES_MUST_PASS'
  ];
  return status.allRequiredGatesPass === allRequiredGatesPass
    && status.acceptanceState === (allRequiredGatesPass ? 'all-gates-pass-cutover-still-blocked' : 'incomplete')
    && status.reasons.length === expectedReasons.length
    && status.reasons.every((reason, index) => reason === expectedReasons[index]);
};

export const parseCoreServiceConnectionAuthority = (
  raw: string,
  platform: NodeJS.Platform = process.platform
): CoreServiceConnectionAuthorityRecord => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new CoreServiceStartupConnectionError('AUTHORITY_INVALID', 'Core Service connection authority is not valid JSON', { cause: error });
  }
  if (!value || typeof value !== 'object') {
    throw new CoreServiceStartupConnectionError('AUTHORITY_INVALID', 'Core Service connection authority is not an object');
  }
  const record = value as Partial<CoreServiceConnectionAuthorityRecord>;
  try {
    if (record.schemaVersion !== CORE_SERVICE_CONNECTION_AUTHORITY_SCHEMA_VERSION) throw new Error('schema version mismatch');
    if (typeof record.endpoint !== 'string' || record.endpoint.trim() !== record.endpoint || record.endpoint.length === 0) throw new Error('endpoint is missing');
    assertEndpoint(record.endpoint, platform);
    if (typeof record.authenticationToken !== 'string' || Buffer.byteLength(record.authenticationToken, 'utf8') < 32 || Buffer.byteLength(record.authenticationToken, 'utf8') > 4096) {
      throw new Error('authentication token length is invalid');
    }
    if (typeof record.expectedPolicyVersion !== 'string' || !/^PPT-PLATFORM-POLICY-[A-Z0-9._-]+$/u.test(record.expectedPolicyVersion)) {
      throw new Error('policy version is invalid');
    }
    if (typeof record.issuedAt !== 'string' || Number.isNaN(Date.parse(record.issuedAt))) throw new Error('issuedAt is invalid');
  } catch (error) {
    throw new CoreServiceStartupConnectionError('AUTHORITY_INVALID', 'Core Service connection authority failed validation', { cause: error });
  }
  return Object.freeze(record as CoreServiceConnectionAuthorityRecord);
};

export const connectCoreServiceAtStartup = async (options: {
  readonly authorityPath: string;
  readonly authorityReader: CoreServiceAuthorityReader;
  readonly platform?: NodeJS.Platform;
}): Promise<CoreServiceStartupConnectionResult> => {
  let raw: string;
  try {
    raw = options.authorityReader.readText(options.authorityPath);
  } catch (error) {
    throw new CoreServiceStartupConnectionError('AUTHORITY_UNAVAILABLE', 'Protected Core Service connection authority is unavailable', { cause: error });
  }
  const authority = parseCoreServiceConnectionAuthority(raw, options.platform ?? process.platform);
  const adapter = new CoreServiceApplicationAdapter(authority);
  let health: CoreServiceHealthContract;
  let architecture: CoreServiceArchitectureContract;
  let familyData: CoreServiceFamilyDataStatusContract;
  let deviceSecretProtection: CoreServiceDeviceSecretProtectionStatusContract;
  let familyDataCutover: CoreServiceFamilyDataCutoverStatusContract;
  let familyDataCutoverReadiness: CoreServiceFamilyDataCutoverReadinessStatusContract;
  try {
    [health, architecture, familyData, deviceSecretProtection, familyDataCutover, familyDataCutoverReadiness] = await Promise.all([
      adapter.getHealth(),
      adapter.getArchitecture(),
      adapter.getFamilyDataStatus(),
      adapter.getDeviceSecretProtectionStatus(),
      adapter.getFamilyDataCutoverStatus(),
      adapter.getFamilyDataCutoverReadinessStatus()
    ]);
  } catch (error) {
    throw new CoreServiceStartupConnectionError('CONNECTION_FAILED', 'Core Service startup health handshake failed', { cause: error });
  }
  if (health.policyVersion !== authority.expectedPolicyVersion) {
    throw new CoreServiceStartupConnectionError('POLICY_VERSION_MISMATCH', 'Core Service policy version does not match the protected startup authority');
  }
  if (
    architecture.schemaVersion !== 1
    || architecture.apiVersion !== CORE_SERVICE_APPLICATION_API_VERSION
    || architecture.protocolVersion !== CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION
    || architecture.processBoundary !== 'headless-core-service'
    || architecture.ownership.process !== 'core-service'
    || architecture.ownership.policyKernel !== 'core-service'
    || architecture.ownership.applicationApi !== 'core-service'
    || architecture.safety?.familyDataCutover !== 'blocked'
    || architecture.safety.legacyDesktopDataActive !== true
    || architecture.safety.automaticCutoverAllowed !== false
    || CORE_SERVICE_REQUIRED_DESKTOP_METHODS.some((method) => !architecture.supportedMethods.includes(method))
  ) throw new CoreServiceStartupConnectionError('ARCHITECTURE_MISMATCH', 'Core Service architecture contract does not satisfy the Desktop startup boundary');
  if (
    familyData.schemaVersion !== 1
    || !Number.isSafeInteger(familyData.epoch)
    || familyData.epoch < 0
    || familyData.persistentPathExposed !== false
    || architecture.ownership.familyData !== familyData.owner
    || (familyData.owner === 'core-service' && (familyData.lifecycle !== 'ready' || familyData.mode === 'none' || !familyData.protectedSessionAttached))
    || (familyData.owner === 'desktop-transition' && familyData.writable)
  ) throw new CoreServiceStartupConnectionError('ARCHITECTURE_MISMATCH', 'Core Service family-data ownership status is inconsistent or unsafe');
  if (
    deviceSecretProtection.schemaVersion !== 1
    || deviceSecretProtection.secretMaterialExposed !== false
    || deviceSecretProtection.electronDependency !== false
    || architecture.ownership.deviceSecretProtection !== deviceSecretProtection.owner
    || (deviceSecretProtection.owner === 'detached' && (
      deviceSecretProtection.lifecycle !== 'detached'
      || deviceSecretProtection.providerId !== null
      || deviceSecretProtection.available
    ))
    || (deviceSecretProtection.owner === 'core-service' && (
      typeof deviceSecretProtection.providerId !== 'string'
      || deviceSecretProtection.providerId.length < 1
      || (deviceSecretProtection.lifecycle === 'ready') !== deviceSecretProtection.available
      || !['ready', 'unavailable'].includes(deviceSecretProtection.lifecycle)
    ))
  ) throw new CoreServiceStartupConnectionError('ARCHITECTURE_MISMATCH', 'Core Service device-secret protection status is inconsistent or unsafe');
  const requiredCutoverGates = [
    'END_TO_END_SECURITY_VALIDATION',
    'KEY_LIFECYCLE_PROOF',
    'SINGLE_WRITER_PROOF',
    'ROLLBACK_DRILL',
    'EXPLICIT_USER_CUTOVER_APPROVAL'
  ];
  if (
    familyDataCutover.schemaVersion !== 1
    || familyDataCutover.mode !== 'coexistence-no-cutover'
    || familyDataCutover.decision !== 'blocked'
    || familyDataCutover.cutoverEpoch !== 0
    || familyDataCutover.legacyDesktopDataActive !== true
    || familyDataCutover.realDataTransferAllowed !== false
    || familyDataCutover.writeOwnershipTransferAllowed !== false
    || familyDataCutover.automaticActivationAllowed !== false
    || familyDataCutover.cutoverAuthorityAttached !== false
    || familyDataCutover.persistentPathExposed !== false
    || familyDataCutover.secretMaterialExposed !== false
    || familyDataCutover.requiredGates.length !== requiredCutoverGates.length
    || familyDataCutover.requiredGates.some((gate, index) => gate.id !== requiredCutoverGates[index] || gate.status !== 'pending')
    || architecture.safety.familyDataCutover !== familyDataCutover.decision
    || architecture.safety.legacyDesktopDataActive !== familyDataCutover.legacyDesktopDataActive
    || architecture.safety.automaticCutoverAllowed !== familyDataCutover.automaticActivationAllowed
  ) throw new CoreServiceStartupConnectionError('ARCHITECTURE_MISMATCH', 'Core Service family-data cutover guard is inconsistent or unsafe');
  if (!isSafeCoreServiceCutoverReadinessStatus(familyDataCutoverReadiness)) {
    throw new CoreServiceStartupConnectionError('ARCHITECTURE_MISMATCH', 'Core Service cutover-readiness evidence is inconsistent or tampered');
  }
  if (health.lifecycle !== 'ready' && health.lifecycle !== 'degraded') {
    throw new CoreServiceStartupConnectionError('SERVICE_NOT_READY', `Core Service lifecycle ${health.lifecycle} is not safe for Desktop startup`);
  }
  return Object.freeze({ adapter, health, architecture, familyData, deviceSecretProtection, familyDataCutover, familyDataCutoverReadiness, authorityPath: options.authorityPath });
};
