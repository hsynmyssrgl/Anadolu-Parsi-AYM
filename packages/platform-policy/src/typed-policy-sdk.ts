import {
  PlatformPolicyEnforcementPoint,
  type PlatformPolicyEnforcementPointOptions
} from './policy-enforcement-point.js';

export type TypedPolicyEnforcementPointOptions = Extract<
  PlatformPolicyEnforcementPointOptions,
  { readonly provider: unknown }
>;

/**
 * Canonical application composition path for an out-of-process typed policy
 * provider. Production applications are forbidden from constructing the PEP
 * directly, which prevents per-application interpretation of policy results.
 */
export const createTypedPolicyEnforcementPoint = (
  options: TypedPolicyEnforcementPointOptions
): PlatformPolicyEnforcementPoint => {
  if (
    !options
    || typeof options !== 'object'
    || !('provider' in options)
    || options.provider === undefined
    || ('kernel' in options && options.kernel !== undefined)
  ) {
    throw new TypeError('Typed policy enforcement requires exactly one authorization provider');
  }
  return new PlatformPolicyEnforcementPoint(options);
};
