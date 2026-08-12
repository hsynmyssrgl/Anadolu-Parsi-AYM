import { createHash } from 'node:crypto';
import {
  PLATFORM_APPLICATION_IDS,
  createPlatformDeviceCertificate,
  platformPolicyContextHash,
  type PlatformApplicationId,
  type PlatformPolicyDecision,
  type PlatformPolicyKernel,
  type PlatformPolicyRequest,
  type PolicyReason
} from './policy-kernel.js';

export const POLICY_CONFORMANCE_SUITE_VERSION = 'PPK-020-V1' as const;

export type PolicyConformancePlatformGroup =
  | 'WINDOWS'
  | 'MACOS'
  | 'IOS'
  | 'IPADOS'
  | 'APPLE_ADJACENT'
  | 'SERVICE'
  | 'PLUGIN';

export type PolicyConformanceDeploymentState = 'DEPLOYED' | 'NOT_DEPLOYED';

export interface PolicyConformanceTargetProfile {
  readonly applicationId: PlatformApplicationId;
  readonly platformGroup: PolicyConformancePlatformGroup;
  readonly deploymentState: PolicyConformanceDeploymentState;
  readonly nativeRuntimeExecution: 'CURRENT_RUNTIME' | 'PROFILE_ONLY';
}

export const POLICY_CONFORMANCE_TARGET_PROFILES = Object.freeze([
  { applicationId: 'windows-desktop', platformGroup: 'WINDOWS', deploymentState: 'DEPLOYED', nativeRuntimeExecution: 'CURRENT_RUNTIME' },
  { applicationId: 'windows-core-service', platformGroup: 'SERVICE', deploymentState: 'DEPLOYED', nativeRuntimeExecution: 'CURRENT_RUNTIME' },
  { applicationId: 'windows-cluster-agent', platformGroup: 'SERVICE', deploymentState: 'NOT_DEPLOYED', nativeRuntimeExecution: 'PROFILE_ONLY' },
  { applicationId: 'macos-companion', platformGroup: 'MACOS', deploymentState: 'NOT_DEPLOYED', nativeRuntimeExecution: 'PROFILE_ONLY' },
  { applicationId: 'ios-companion', platformGroup: 'IOS', deploymentState: 'NOT_DEPLOYED', nativeRuntimeExecution: 'PROFILE_ONLY' },
  { applicationId: 'ipados-companion', platformGroup: 'IPADOS', deploymentState: 'NOT_DEPLOYED', nativeRuntimeExecution: 'PROFILE_ONLY' },
  { applicationId: 'watchos-companion', platformGroup: 'APPLE_ADJACENT', deploymentState: 'NOT_DEPLOYED', nativeRuntimeExecution: 'PROFILE_ONLY' },
  { applicationId: 'visionos-companion', platformGroup: 'APPLE_ADJACENT', deploymentState: 'NOT_DEPLOYED', nativeRuntimeExecution: 'PROFILE_ONLY' },
  { applicationId: 'ocr-worker', platformGroup: 'SERVICE', deploymentState: 'NOT_DEPLOYED', nativeRuntimeExecution: 'PROFILE_ONLY' },
  { applicationId: 'ai-worker', platformGroup: 'SERVICE', deploymentState: 'NOT_DEPLOYED', nativeRuntimeExecution: 'PROFILE_ONLY' },
  { applicationId: 'translation-worker', platformGroup: 'SERVICE', deploymentState: 'NOT_DEPLOYED', nativeRuntimeExecution: 'PROFILE_ONLY' },
  { applicationId: 'communication-service', platformGroup: 'SERVICE', deploymentState: 'NOT_DEPLOYED', nativeRuntimeExecution: 'PROFILE_ONLY' },
  { applicationId: 'backup-worker', platformGroup: 'SERVICE', deploymentState: 'NOT_DEPLOYED', nativeRuntimeExecution: 'PROFILE_ONLY' },
  { applicationId: 'signed-plugin', platformGroup: 'PLUGIN', deploymentState: 'NOT_DEPLOYED', nativeRuntimeExecution: 'PROFILE_ONLY' }
] as const satisfies readonly PolicyConformanceTargetProfile[]);

export const POLICY_CONFORMANCE_CASE_IDS = Object.freeze([
  'BASELINE_ALLOW',
  'INVALID_REQUEST_DENIED',
  'POLICY_VERSION_MISMATCH_DENIED',
  'POLICY_PACKAGE_VERSION_MISMATCH_DENIED',
  'POLICY_PACKAGE_HASH_MISMATCH_DENIED',
  'DECISION_AUTHORITY_MISMATCH_DENIED',
  'APPLICATION_NOT_REGISTERED_DENIED',
  'APPLICATION_VERSION_MISMATCH_DENIED',
  'APPLICATION_MANIFEST_MISMATCH_DENIED',
  'DEVICE_CERTIFICATE_MISSING_DENIED',
  'DEVICE_CERTIFICATE_EXPIRED_DENIED',
  'CAPABILITY_NOT_DECLARED_DENIED',
  'ACTION_CAPABILITY_MISMATCH_DENIED',
  'DATA_CLASS_CAPABILITY_MISMATCH_DENIED',
  'DEVICE_NOT_TRUSTED_DENIED',
  'MEMBERSHIP_INACTIVE_DENIED',
  'RESOURCE_SCOPE_DENIED',
  'PURPOSE_REQUIRED_DENIED',
  'OFFLINE_OPERATION_FORBIDDEN_DENIED',
  'CLUSTER_NOT_WRITABLE_DENIED',
  'EXPLICIT_DENY_ENFORCED',
  'OWNER_OR_GRANT_REQUIRED_DENIED'
] as const);

export type PolicyConformanceCaseId = (typeof POLICY_CONFORMANCE_CASE_IDS)[number];

export interface PolicyConformanceCaseResult {
  readonly caseId: PolicyConformanceCaseId;
  readonly expectedAllowed: boolean;
  readonly expectedReason: PolicyReason;
  readonly actualAllowed: boolean;
  readonly actualReason: PolicyReason;
  readonly contextHashPresent: boolean;
  readonly passed: boolean;
}

export interface PolicyConformanceTargetReport {
  readonly schemaVersion: 1;
  readonly suiteVersion: typeof POLICY_CONFORMANCE_SUITE_VERSION;
  readonly target: PolicyConformanceTargetProfile;
  readonly signedPolicyPackageVerified: true;
  readonly identicalCaseSetApplied: true;
  readonly cases: readonly PolicyConformanceCaseResult[];
  readonly passedCases: number;
  readonly failedCases: number;
  readonly reportHash: string;
}

type CaseDefinition = {
  readonly caseId: PolicyConformanceCaseId;
  readonly expectedAllowed: boolean;
  readonly expectedReason: PolicyReason;
  readonly mutate: (request: PlatformPolicyRequest, target: PolicyConformanceTargetProfile) => PlatformPolicyRequest;
};

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('POLICY_CONFORMANCE_NON_FINITE_NUMBER');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (!value || typeof value !== 'object') throw new TypeError('POLICY_CONFORMANCE_UNSUPPORTED_VALUE');
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
};

const sha256 = (value: unknown): string => createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');

const patchSubject = (
  request: PlatformPolicyRequest,
  patch: Partial<PlatformPolicyRequest['subject']>
): PlatformPolicyRequest => ({ ...request, subject: { ...request.subject, ...patch } });

const patchResource = (
  request: PlatformPolicyRequest,
  patch: Partial<PlatformPolicyRequest['resource']>
): PlatformPolicyRequest => ({ ...request, resource: { ...request.resource, ...patch } });

const withoutCorrelationId = (request: PlatformPolicyRequest): PlatformPolicyRequest => {
  const { correlationId: _correlationId, ...rest } = request;
  return rest;
};

const withoutDeviceCertificate = (request: PlatformPolicyRequest): PlatformPolicyRequest => {
  const { deviceCertificate: _deviceCertificate, ...subject } = request.subject;
  return { ...request, subject };
};

const withoutPurposeInLegacyMode = (request: PlatformPolicyRequest): PlatformPolicyRequest => {
  const { purpose: _purpose, ...rest } = request;
  return { ...rest, enforcementMode: 'legacy' };
};

const expiredCertificateRequest = (request: PlatformPolicyRequest): PlatformPolicyRequest => {
  const certificate = request.subject.deviceCertificate;
  if (!certificate) return request;
  const expired = createPlatformDeviceCertificate({
    schemaVersion: certificate.schemaVersion,
    issuer: certificate.issuer,
    deviceId: certificate.deviceId,
    applicationId: certificate.applicationId,
    publicKeyFingerprintSha256: certificate.publicKeyFingerprintSha256,
    capabilityManifestSha256: certificate.capabilityManifestSha256,
    issuedAt: certificate.issuedAt,
    expiresAt: new Date(Date.parse(request.occurredAt) - 1).toISOString()
  });
  return patchSubject(request, { deviceCertificate: expired });
};

const alternateApplicationId = (target: PlatformApplicationId): PlatformApplicationId =>
  PLATFORM_APPLICATION_IDS.find((applicationId) => applicationId !== target)!;

const CASE_DEFINITIONS: readonly CaseDefinition[] = Object.freeze([
  { caseId: 'BASELINE_ALLOW', expectedAllowed: true, expectedReason: 'ALLOW_POLICY', mutate: (request) => request },
  { caseId: 'INVALID_REQUEST_DENIED', expectedAllowed: false, expectedReason: 'INVALID_REQUEST', mutate: withoutCorrelationId },
  { caseId: 'POLICY_VERSION_MISMATCH_DENIED', expectedAllowed: false, expectedReason: 'POLICY_VERSION_MISMATCH', mutate: (request) => ({ ...request, policyVersion: 'PPK-020-INVALID' }) },
  { caseId: 'POLICY_PACKAGE_VERSION_MISMATCH_DENIED', expectedAllowed: false, expectedReason: 'POLICY_PACKAGE_VERSION_MISMATCH', mutate: (request) => ({ ...request, policyPackageVersion: (request.policyPackageVersion ?? 0) + 1 }) },
  { caseId: 'POLICY_PACKAGE_HASH_MISMATCH_DENIED', expectedAllowed: false, expectedReason: 'POLICY_PACKAGE_HASH_MISMATCH', mutate: (request) => ({ ...request, policyPackageSha256: 'b'.repeat(64) }) },
  { caseId: 'DECISION_AUTHORITY_MISMATCH_DENIED', expectedAllowed: false, expectedReason: 'DECISION_AUTHORITY_MISMATCH', mutate: (request) => ({ ...request, decisionAuthorityId: 'windows-core-service' }) },
  { caseId: 'APPLICATION_NOT_REGISTERED_DENIED', expectedAllowed: false, expectedReason: 'APPLICATION_NOT_REGISTERED', mutate: (request, target) => patchSubject(request, { applicationId: alternateApplicationId(target.applicationId) }) },
  { caseId: 'APPLICATION_VERSION_MISMATCH_DENIED', expectedAllowed: false, expectedReason: 'APPLICATION_VERSION_MISMATCH', mutate: (request) => patchSubject(request, { applicationVersion: 'invalid-conformance-version' }) },
  { caseId: 'APPLICATION_MANIFEST_MISMATCH_DENIED', expectedAllowed: false, expectedReason: 'APPLICATION_MANIFEST_MISMATCH', mutate: (request) => patchSubject(request, { capabilityManifestSha256: 'c'.repeat(64) }) },
  { caseId: 'DEVICE_CERTIFICATE_MISSING_DENIED', expectedAllowed: false, expectedReason: 'DEVICE_CERTIFICATE_INVALID', mutate: withoutDeviceCertificate },
  { caseId: 'DEVICE_CERTIFICATE_EXPIRED_DENIED', expectedAllowed: false, expectedReason: 'DEVICE_CERTIFICATE_INVALID', mutate: expiredCertificateRequest },
  { caseId: 'CAPABILITY_NOT_DECLARED_DENIED', expectedAllowed: false, expectedReason: 'CAPABILITY_NOT_DECLARED', mutate: (request) => ({ ...request, capability: 'archive.read', action: 'read' }) },
  { caseId: 'ACTION_CAPABILITY_MISMATCH_DENIED', expectedAllowed: false, expectedReason: 'ACTION_CAPABILITY_MISMATCH', mutate: (request) => ({ ...request, action: 'create' }) },
  { caseId: 'DATA_CLASS_CAPABILITY_MISMATCH_DENIED', expectedAllowed: false, expectedReason: 'DATA_CLASS_CAPABILITY_MISMATCH', mutate: (request) => ({ ...patchResource(request, { dataClasses: ['finance'] }), capability: 'health.read', action: 'read' }) },
  { caseId: 'DEVICE_NOT_TRUSTED_DENIED', expectedAllowed: false, expectedReason: 'DEVICE_NOT_TRUSTED', mutate: (request) => patchSubject(request, { deviceTrusted: false }) },
  { caseId: 'MEMBERSHIP_INACTIVE_DENIED', expectedAllowed: false, expectedReason: 'MEMBERSHIP_INACTIVE', mutate: (request) => patchSubject(request, { membershipActive: false }) },
  { caseId: 'RESOURCE_SCOPE_DENIED', expectedAllowed: false, expectedReason: 'RESOURCE_SCOPE_DENIED', mutate: (request) => patchResource(request, { familyId: 'family-outside-conformance-scope' }) },
  { caseId: 'PURPOSE_REQUIRED_DENIED', expectedAllowed: false, expectedReason: 'PURPOSE_REQUIRED', mutate: withoutPurposeInLegacyMode },
  { caseId: 'OFFLINE_OPERATION_FORBIDDEN_DENIED', expectedAllowed: false, expectedReason: 'OFFLINE_OPERATION_FORBIDDEN', mutate: (request) => ({ ...request, online: false }) },
  { caseId: 'CLUSTER_NOT_WRITABLE_DENIED', expectedAllowed: false, expectedReason: 'CLUSTER_NOT_WRITABLE', mutate: (request) => ({ ...request, capability: 'family.write', action: 'create', clusterWritable: false }) },
  { caseId: 'EXPLICIT_DENY_ENFORCED', expectedAllowed: false, expectedReason: 'EXPLICIT_DENY', mutate: (request) => ({ ...request, grants: [{ id: 'deny-ppk-020', subjectAccountId: request.subject.accountId, resourceType: request.resource.type, resourceId: request.resource.id, actions: [request.action], purposes: [request.purpose!], effect: 'deny', startsAt: new Date(Date.parse(request.occurredAt) - 60_000).toISOString() }] }) },
  { caseId: 'OWNER_OR_GRANT_REQUIRED_DENIED', expectedAllowed: false, expectedReason: 'OWNER_OR_GRANT_REQUIRED', mutate: (request) => patchResource(request, { ownerPersonId: 'person-other-owner' }) }
]);

const targetById = new Map<PlatformApplicationId, PolicyConformanceTargetProfile>(
  POLICY_CONFORMANCE_TARGET_PROFILES.map((target) => [target.applicationId, target])
);

const unsignedReport = (report: Omit<PolicyConformanceTargetReport, 'reportHash'>) => ({
  schemaVersion: report.schemaVersion,
  suiteVersion: report.suiteVersion,
  target: report.target,
  signedPolicyPackageVerified: report.signedPolicyPackageVerified,
  identicalCaseSetApplied: report.identicalCaseSetApplied,
  cases: report.cases,
  passedCases: report.passedCases,
  failedCases: report.failedCases
});

export class PlatformPolicyConformanceSuite {
  public run(input: {
    readonly target: PolicyConformanceTargetProfile;
    readonly kernel: PlatformPolicyKernel;
    readonly baselineRequest: PlatformPolicyRequest;
  }): PolicyConformanceTargetReport {
    const canonicalTarget = targetById.get(input.target.applicationId);
    if (!canonicalTarget || canonicalize(canonicalTarget) !== canonicalize(input.target)) {
      throw new Error('POLICY_CONFORMANCE_TARGET_PROFILE_MISMATCH');
    }
    if (input.baselineRequest.subject.applicationId !== input.target.applicationId) {
      throw new Error('POLICY_CONFORMANCE_BASELINE_APPLICATION_MISMATCH');
    }
    const policyPackage = input.kernel.policyPackage;
    const manifest = policyPackage.payload.applicationManifests[input.target.applicationId];
    if (
      !input.kernel.verifyPolicyPackage(policyPackage)
      || !manifest
      || input.baselineRequest.policyVersion !== policyPackage.payload.policyVersion
      || input.baselineRequest.policyPackageVersion !== policyPackage.payload.packageVersion
      || input.baselineRequest.policyPackageSha256 !== policyPackage.payloadSha256
      || input.baselineRequest.subject.applicationVersion !== manifest.applicationVersion
      || input.baselineRequest.subject.capabilityManifestSha256 !== manifest.capabilityManifestSha256
      || canonicalize(manifest.capabilities) !== canonicalize(['family.read', 'family.write', 'health.read'])
      || manifest.deviceCertificateRequired !== true
      || input.baselineRequest.decisionAuthorityId !== 'local-policy-kernel'
      || input.baselineRequest.enforcementMode !== 'strict'
    ) throw new Error('POLICY_CONFORMANCE_BASELINE_BINDING_INVALID');

    const cases = Object.freeze(CASE_DEFINITIONS.map((definition): PolicyConformanceCaseResult => {
      const request = definition.mutate(input.baselineRequest, input.target);
      const decision: PlatformPolicyDecision = input.kernel.evaluate(request);
      const contextHashPresent = decision.contextHash === platformPolicyContextHash(request);
      const passed = decision.allowed === definition.expectedAllowed
        && decision.reason === definition.expectedReason
        && (definition.expectedReason === 'INVALID_REQUEST' ? decision.contextHash === undefined : contextHashPresent);
      return Object.freeze({
        caseId: definition.caseId,
        expectedAllowed: definition.expectedAllowed,
        expectedReason: definition.expectedReason,
        actualAllowed: decision.allowed,
        actualReason: decision.reason,
        contextHashPresent,
        passed
      });
    }));
    const passedCases = cases.filter((item) => item.passed).length;
    const body = Object.freeze({
      schemaVersion: 1 as const,
      suiteVersion: POLICY_CONFORMANCE_SUITE_VERSION,
      target: canonicalTarget,
      signedPolicyPackageVerified: true as const,
      identicalCaseSetApplied: true as const,
      cases,
      passedCases,
      failedCases: cases.length - passedCases
    });
    return Object.freeze({ ...body, reportHash: sha256(body) });
  }

  public verify(report: PolicyConformanceTargetReport): boolean {
    try {
      const target = targetById.get(report.target.applicationId);
      return report.schemaVersion === 1
        && report.suiteVersion === POLICY_CONFORMANCE_SUITE_VERSION
        && target !== undefined
        && canonicalize(target) === canonicalize(report.target)
        && report.signedPolicyPackageVerified === true
        && report.identicalCaseSetApplied === true
        && canonicalize(report.cases.map((item) => item.caseId)) === canonicalize(POLICY_CONFORMANCE_CASE_IDS)
        && report.cases.length === POLICY_CONFORMANCE_CASE_IDS.length
        && report.cases.every((item) => item.passed && item.actualAllowed === item.expectedAllowed && item.actualReason === item.expectedReason)
        && report.passedCases === POLICY_CONFORMANCE_CASE_IDS.length
        && report.failedCases === 0
        && report.reportHash === sha256(unsignedReport(report));
    } catch {
      return false;
    }
  }

  public snapshot() {
    return Object.freeze({
      schemaVersion: 1 as const,
      suiteVersion: POLICY_CONFORMANCE_SUITE_VERSION,
      enforcement: 'fail-closed' as const,
      targetProfiles: POLICY_CONFORMANCE_TARGET_PROFILES,
      caseIds: POLICY_CONFORMANCE_CASE_IDS,
      targetCount: POLICY_CONFORMANCE_TARGET_PROFILES.length,
      caseCount: POLICY_CONFORMANCE_CASE_IDS.length,
      totalMatrixAssertions: POLICY_CONFORMANCE_TARGET_PROFILES.length * POLICY_CONFORMANCE_CASE_IDS.length,
      deployedRuntimeTargets: POLICY_CONFORMANCE_TARGET_PROFILES.filter((target) => target.deploymentState === 'DEPLOYED').length,
      profileOnlyTargets: POLICY_CONFORMANCE_TARGET_PROFILES.filter((target) => target.deploymentState === 'NOT_DEPLOYED').length,
      identicalCaseSetRequired: true as const,
      signedPolicyPackageRequired: true as const,
      strictContextRequired: true as const,
      deviceCertificateRequired: true as const,
      referenceHarnessGrantsRuntimeAuthority: false as const,
      nativeAppleRuntimeExecutionClaimed: false as const,
      nativeRuntimeValidationRequiredBeforeDeployment: true as const,
      payloadExposedToClient: false as const
    });
  }
}
