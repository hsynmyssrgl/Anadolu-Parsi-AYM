import { isAdministrativeRole } from '@ppt/security';

export type IpcAdaptiveBudgetMaintenanceAuthorityReason =
  | 'ALLOWED'
  | 'AUTHENTICATION_REQUIRED'
  | 'SESSION_EXPIRED'
  | 'ROLE_NOT_ALLOWED'
  | 'DEVICE_CONTEXT_REQUIRED'
  | 'TRUSTED_DEVICE_REQUIRED'
  | 'REAUTHENTICATION_LOCKED';

export interface IpcAdaptiveBudgetMaintenanceAuthState {
  readonly authenticated: boolean;
  readonly role?: string;
  readonly sessionExpiresAt?: string;
  readonly currentDeviceId?: string;
  readonly trustedDevice?: boolean;
  readonly twoFactorEnabled?: boolean;
}

export interface IpcAdaptiveBudgetMaintenanceReauthenticationThrottleState {
  readonly locked: boolean;
  readonly failedAttempts: number;
  readonly remainingAttempts: number;
  readonly maximumAttempts: number;
  readonly retryAfterSeconds?: number;
  readonly lockedUntil?: string;
}

export interface IpcAdaptiveBudgetMaintenanceAuthorityView {
  readonly allowed: boolean;
  readonly reason: IpcAdaptiveBudgetMaintenanceAuthorityReason;
  readonly requiredRole: 'family_admin';
  readonly trustedDeviceRequired: true;
  readonly strongReauthenticationRequired: true;
  readonly twoFactorRequired: boolean;
  readonly reauthenticationLocked: boolean;
  readonly remainingReauthenticationAttempts: number;
  readonly maximumReauthenticationAttempts: number;
  readonly reauthenticationRetryAfterSeconds?: number;
  readonly reauthenticationLockedUntil?: string;
  readonly sessionExpiresAt?: string;
}

const DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]{8,160}$/u;

export const evaluateIpcAdaptiveBudgetMaintenanceAuthority = (
  auth: IpcAdaptiveBudgetMaintenanceAuthState,
  now = Date.now(),
  throttle: IpcAdaptiveBudgetMaintenanceReauthenticationThrottleState = Object.freeze({ locked: false, failedAttempts: 0, remainingAttempts: 5, maximumAttempts: 5 })
): IpcAdaptiveBudgetMaintenanceAuthorityView => {
  const base = {
    requiredRole: 'family_admin' as const,
    trustedDeviceRequired: true as const,
    strongReauthenticationRequired: true as const,
    twoFactorRequired: auth.twoFactorEnabled === true,
    reauthenticationLocked: throttle.locked,
    remainingReauthenticationAttempts: throttle.remainingAttempts,
    maximumReauthenticationAttempts: throttle.maximumAttempts,
    ...(throttle.retryAfterSeconds === undefined ? {} : { reauthenticationRetryAfterSeconds: throttle.retryAfterSeconds }),
    ...(throttle.lockedUntil === undefined ? {} : { reauthenticationLockedUntil: throttle.lockedUntil }),
    ...(auth.sessionExpiresAt ? { sessionExpiresAt: auth.sessionExpiresAt } : {})
  };
  if (!auth.authenticated) return Object.freeze({ ...base, allowed: false, reason: 'AUTHENTICATION_REQUIRED' as const });
  const expiresAt = auth.sessionExpiresAt ? Date.parse(auth.sessionExpiresAt) : Number.NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return Object.freeze({ ...base, allowed: false, reason: 'SESSION_EXPIRED' as const });
  if (!isAdministrativeRole(auth.role)) return Object.freeze({ ...base, allowed: false, reason: 'ROLE_NOT_ALLOWED' as const });
  if (!auth.currentDeviceId || !DEVICE_ID_PATTERN.test(auth.currentDeviceId)) return Object.freeze({ ...base, allowed: false, reason: 'DEVICE_CONTEXT_REQUIRED' as const });
  if (auth.trustedDevice !== true) return Object.freeze({ ...base, allowed: false, reason: 'TRUSTED_DEVICE_REQUIRED' as const });
  if (throttle.locked) return Object.freeze({ ...base, allowed: false, reason: 'REAUTHENTICATION_LOCKED' as const });
  return Object.freeze({ ...base, allowed: true, reason: 'ALLOWED' as const });
};
