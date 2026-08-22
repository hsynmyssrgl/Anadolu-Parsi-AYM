import type { SessionLockStatus } from '@ppt/domain';

export type VaultSessionGuardAction = 'checkpoint' | 'defer_locked' | 'defer_untrusted' | 'seal';

/**
 * A locked desktop session is still a recoverable local session. Keep the
 * already-open vault available only to the reauthentication overlay; sealing
 * it here would destroy the very state that the unlock flow needs.
 */
export const resolveVaultSessionGuardAction = (
  status: SessionLockStatus,
  authenticated: boolean,
  trustedDevice: boolean
): VaultSessionGuardAction => {
  if (status === 'locked') return 'defer_locked';
  if ((status === 'active' || status === 'warning') && authenticated) {
    // İlk 2FA/güven töreni sırasında normal politika otoritesi henüz bilinçli
    // olarak yoktur. Kasayı kapatmak töreni tamamlanamaz hâle getirir; yalnız
    // açık bootstrap kimlik kanalları çalışırken checkpoint'i erteleriz.
    if (!trustedDevice) return 'defer_untrusted';
    return 'checkpoint';
  }
  return 'seal';
};
