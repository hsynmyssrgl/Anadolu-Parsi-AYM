export const STRICT_PRODUCT_LIFECYCLE_POLICY_ID = 'PPT-LIFECYCLE-STRICT-V1' as const;

export type ProductReleaseChannel = 'bronze' | 'silver' | 'gold';
export type CapabilityDeliveryClass = 'bronze_required' | 'api_heavy_deferred';
export type SilverWorkKind = 'infrastructure_improvement' | 'test_execution' | 'defect_fix';
export type GoldWorkKind = 'release_packaging' | 'production_operations' | 'critical_defect_fix';

export interface ApiIntegrationReadiness {
  readonly portContract: boolean;
  readonly adapterBoundary: boolean;
  readonly configurationBoundary: boolean;
  readonly localFallback: boolean;
  readonly testDouble: boolean;
  readonly errorContract: boolean;
  readonly securityPrivacyBoundary: boolean;
}

export interface CapabilityDeliveryDecision {
  readonly capabilityId: string;
  readonly title: string;
  readonly deliveryClass: CapabilityDeliveryClass;
  readonly targetChannel: 'bronze';
  readonly externalApiRequired?: boolean;
  readonly heavyIntegration?: boolean;
  readonly deferralReason?: string;
  readonly readiness?: ApiIntegrationReadiness;
}

export interface LifecyclePolicyValidation {
  readonly ok: boolean;
  readonly violations: readonly string[];
}

export const NEW_PRODUCT_DEVELOPMENT_CHANNEL: ProductReleaseChannel = 'bronze';

export const canIntroduceNewProductCapability = (channel: ProductReleaseChannel): boolean =>
  channel === NEW_PRODUCT_DEVELOPMENT_CHANNEL;

export const isSilverWorkAllowed = (kind: string): kind is SilverWorkKind =>
  ['infrastructure_improvement', 'test_execution', 'defect_fix'].includes(kind);

export const isGoldWorkAllowed = (kind: string): kind is GoldWorkKind =>
  ['release_packaging', 'production_operations', 'critical_defect_fix'].includes(kind);

const readinessFields: readonly (keyof ApiIntegrationReadiness)[] = [
  'portContract',
  'adapterBoundary',
  'configurationBoundary',
  'localFallback',
  'testDouble',
  'errorContract',
  'securityPrivacyBoundary'
];

export const validateCapabilityDeliveryDecision = (
  decision: CapabilityDeliveryDecision
): LifecyclePolicyValidation => {
  const violations: string[] = [];
  if (!decision.capabilityId.trim()) violations.push('capabilityId is required');
  if (!decision.title.trim()) violations.push('title is required');
  if (decision.targetChannel !== 'bronze') {
    violations.push('all product capabilities must target Bronze');
  }
  if (decision.deliveryClass === 'bronze_required') {
    if (decision.externalApiRequired || decision.heavyIntegration || decision.deferralReason || decision.readiness) {
      violations.push('Bronze-required capability cannot carry API deferral metadata');
    }
  } else {
    if (decision.externalApiRequired !== true || decision.heavyIntegration !== true) {
      violations.push('API deferral requires both externalApiRequired and heavyIntegration');
    }
    if (!decision.deferralReason?.trim()) violations.push('API deferral reason is required');
    if (!decision.readiness) {
      violations.push('API deferral requires architecture readiness evidence');
    } else {
      for (const field of readinessFields) {
        if (decision.readiness[field] !== true) {
          violations.push(`API deferral readiness missing: ${field}`);
        }
      }
    }
  }
  return Object.freeze({ ok: violations.length === 0, violations: Object.freeze(violations) });
};

export const assertCapabilityDeliveryDecision = (decision: CapabilityDeliveryDecision): void => {
  const result = validateCapabilityDeliveryDecision(decision);
  if (!result.ok) throw new Error(result.violations.join('; '));
};
