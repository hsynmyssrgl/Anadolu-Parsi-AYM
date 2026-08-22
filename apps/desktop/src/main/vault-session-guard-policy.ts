import type { SessionLockStatus } from '@ppt/domain';

export type VaultSessionGuardAction = 'checkpoint' | 'defer_locked' | 'seal';

/**
 * A locked desktop session is still a recoverable local session. Keep the
 * already-open vault available only to the reauthentication overlay; sealing
 * it here would destroy the very state that the unlock flow needs.
 */
export const resolveVaultSessionGuardAction = (
  status: SessionLockStatus,
  authenticated: boolean
): VaultSessionGuardAction => {
  if (status === 'locked') return 'defer_locked';
  if ((status === 'active' || status === 'warning') && authenticated) return 'checkpoint';
  return 'seal';
};
