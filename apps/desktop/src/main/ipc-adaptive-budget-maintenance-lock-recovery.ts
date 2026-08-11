import { createHash } from 'node:crypto';
import {
  evaluateIpcAdaptiveBudgetMaintenanceAuthority,
  type IpcAdaptiveBudgetMaintenanceAuthState,
  type IpcAdaptiveBudgetMaintenanceAuthorityView,
  type IpcAdaptiveBudgetMaintenanceReauthenticationThrottleState
} from './ipc-adaptive-budget-maintenance-authority.js';

export const IPC_ADAPTIVE_BUDGET_MAINTENANCE_RECOVERY_CONFIRMATION = 'BAKIM KİLİDİNİ SIFIRLA' as const;

export type IpcAdaptiveBudgetMaintenanceRecoveryAuthorityReason =
  | 'ALLOWED'
  | 'RECOVERY_NOT_REQUIRED'
  | 'AUTHENTICATION_REQUIRED'
  | 'SESSION_EXPIRED'
  | 'ROLE_NOT_ALLOWED'
  | 'DEVICE_CONTEXT_REQUIRED'
  | 'TRUSTED_DEVICE_REQUIRED'
  | 'RECOVERY_RATE_LIMITED'
  | 'RECOVERY_COOLDOWN_ACTIVE';

export interface IpcAdaptiveBudgetMaintenanceRecoveryAuthorityView {
  readonly allowed: boolean;
  readonly reason: IpcAdaptiveBudgetMaintenanceRecoveryAuthorityReason;
  readonly recoveryRequired: boolean;
  readonly requiredRole: 'family_admin';
  readonly trustedDeviceRequired: true;
  readonly strongReauthenticationRequired: true;
  readonly explicitConfirmationRequired: true;
  readonly confirmationPhrase: typeof IPC_ADAPTIVE_BUDGET_MAINTENANCE_RECOVERY_CONFIRMATION;
  readonly twoFactorRequired: boolean;
  readonly recoveryLocked: boolean;
  readonly remainingRecoveryAttempts: number;
  readonly maximumRecoveryAttempts: number;
  readonly recoveryRetryAfterSeconds?: number;
  readonly recoveryLockedUntil?: string;
  readonly recoveryCooldownActive: boolean;
  readonly recoveryCooldownRetryAfterSeconds?: number;
  readonly recoveryCooldownUntil?: string;
  readonly sessionTerminationRequired: true;
  readonly trustedDeviceReevaluationRequired: true;
  readonly sessionExpiresAt?: string;
}

export interface IpcAdaptiveBudgetMaintenanceRecoveryInputValue {
  readonly password: string;
  readonly code?: string;
  readonly confirmation: typeof IPC_ADAPTIVE_BUDGET_MAINTENANCE_RECOVERY_CONFIRMATION;
}

const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const exactKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...allowed].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

export const deriveIpcAdaptiveBudgetMaintenanceRecoveryContextKey = (authFingerprint: string): string => {
  if (!HASH_PATTERN.test(authFingerprint)) throw new Error('Bakım kurtarma yetki parmak izi geçersiz.');
  return createHash('sha256').update(`ipc-adaptive-budget-maintenance-recovery\u0000${authFingerprint}`, 'utf8').digest('hex');
};

export const parseIpcAdaptiveBudgetMaintenanceRecoveryInput = (input: unknown): IpcAdaptiveBudgetMaintenanceRecoveryInputValue => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Bakım kilidi kurtarma girdisi geçersiz.');
  const candidate = input as Record<string, unknown>;
  const allowed = candidate.code === undefined ? ['password', 'confirmation'] : ['password', 'code', 'confirmation'];
  if (!exactKeys(candidate, allowed)) throw new Error('Bakım kilidi kurtarma girdisi beklenmeyen alan içeriyor.');
  if (typeof candidate.password !== 'string' || candidate.password.length < 1 || candidate.password.length > 4_096) {
    throw new Error('Bakım kilidi kurtarma parolası geçersiz.');
  }
  if (candidate.code !== undefined && (typeof candidate.code !== 'string' || candidate.code.length < 1 || candidate.code.length > 64)) {
    throw new Error('Bakım kilidi kurtarma ikinci faktör kodu geçersiz.');
  }
  if (candidate.confirmation !== IPC_ADAPTIVE_BUDGET_MAINTENANCE_RECOVERY_CONFIRMATION) {
    throw new Error(`Bakım kilidi kurtarma onayı için “${IPC_ADAPTIVE_BUDGET_MAINTENANCE_RECOVERY_CONFIRMATION}” yazılmalıdır.`);
  }
  return Object.freeze({
    password: candidate.password,
    ...(candidate.code === undefined ? {} : { code: candidate.code }),
    confirmation: IPC_ADAPTIVE_BUDGET_MAINTENANCE_RECOVERY_CONFIRMATION
  });
};

export const evaluateIpcAdaptiveBudgetMaintenanceRecoveryAuthority = (
  auth: IpcAdaptiveBudgetMaintenanceAuthState,
  primaryAuthority: IpcAdaptiveBudgetMaintenanceAuthorityView,
  recoveryThrottle: IpcAdaptiveBudgetMaintenanceReauthenticationThrottleState,
  recoveryCooldown: IpcAdaptiveBudgetMaintenanceReauthenticationThrottleState,
  now = Date.now()
): IpcAdaptiveBudgetMaintenanceRecoveryAuthorityView => {
  const base = evaluateIpcAdaptiveBudgetMaintenanceAuthority(auth, now, recoveryThrottle);
  const common = {
    recoveryRequired: primaryAuthority.reason === 'REAUTHENTICATION_LOCKED',
    requiredRole: 'family_admin' as const,
    trustedDeviceRequired: true as const,
    strongReauthenticationRequired: true as const,
    explicitConfirmationRequired: true as const,
    confirmationPhrase: IPC_ADAPTIVE_BUDGET_MAINTENANCE_RECOVERY_CONFIRMATION,
    twoFactorRequired: auth.twoFactorEnabled === true,
    recoveryLocked: recoveryThrottle.locked,
    recoveryCooldownActive: recoveryCooldown.locked,
    ...(recoveryCooldown.retryAfterSeconds === undefined ? {} : { recoveryCooldownRetryAfterSeconds: recoveryCooldown.retryAfterSeconds }),
    ...(recoveryCooldown.lockedUntil === undefined ? {} : { recoveryCooldownUntil: recoveryCooldown.lockedUntil }),
    sessionTerminationRequired: true as const,
    trustedDeviceReevaluationRequired: true as const,
    remainingRecoveryAttempts: recoveryThrottle.remainingAttempts,
    maximumRecoveryAttempts: recoveryThrottle.maximumAttempts,
    ...(recoveryThrottle.retryAfterSeconds === undefined ? {} : { recoveryRetryAfterSeconds: recoveryThrottle.retryAfterSeconds }),
    ...(recoveryThrottle.lockedUntil === undefined ? {} : { recoveryLockedUntil: recoveryThrottle.lockedUntil }),
    ...(auth.sessionExpiresAt ? { sessionExpiresAt: auth.sessionExpiresAt } : {})
  };
  if (recoveryCooldown.locked) {
    return Object.freeze({ ...common, allowed: false, reason: 'RECOVERY_COOLDOWN_ACTIVE' as const });
  }
  if (primaryAuthority.reason !== 'REAUTHENTICATION_LOCKED') {
    return Object.freeze({ ...common, allowed: false, reason: 'RECOVERY_NOT_REQUIRED' as const });
  }
  if (base.reason === 'REAUTHENTICATION_LOCKED') {
    return Object.freeze({ ...common, allowed: false, reason: 'RECOVERY_RATE_LIMITED' as const });
  }
  if (!base.allowed) return Object.freeze({ ...common, allowed: false, reason: base.reason });
  return Object.freeze({ ...common, allowed: true, reason: 'ALLOWED' as const });
};

export const deriveIpcAdaptiveBudgetMaintenanceRecoveryCooldownContextKey = (authFingerprint: string): string => {
  if (!HASH_PATTERN.test(authFingerprint)) throw new Error('Bakım kurtarma soğuma parmak izi geçersiz.');
  return createHash('sha256').update(`ipc-adaptive-budget-maintenance-recovery-cooldown\u0000${authFingerprint}`, 'utf8').digest('hex');
};
