export const MAX_ACCOUNT_SECURITY_EPOCH = 2_147_483_647 as const;

export const assertAccountSecurityEpoch = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_ACCOUNT_SECURITY_EPOCH) {
    throw new Error('Hesap güvenlik dönemi geçersiz.');
  }
  return value;
};

export const nextAccountSecurityEpoch = (current: number): number => {
  const validated = assertAccountSecurityEpoch(current);
  if (validated >= MAX_ACCOUNT_SECURITY_EPOCH) {
    throw new Error('Hesap güvenlik dönemi üst sınıra ulaştı.');
  }
  return validated + 1;
};

export const isTrustedDeviceSecurityEpochCurrent = (
  accountSecurityEpoch: number,
  trustedDeviceSecurityEpoch: number
): boolean => (
  assertAccountSecurityEpoch(accountSecurityEpoch)
  === assertAccountSecurityEpoch(trustedDeviceSecurityEpoch)
);

export const isSessionSecurityEpochCurrent = (
  accountSecurityEpoch: number,
  sessionSecurityEpoch: number
): boolean => isTrustedDeviceSecurityEpochCurrent(accountSecurityEpoch, sessionSecurityEpoch);

export interface AccountSecurityEpochRotationPlan {
  readonly previousSecurityEpoch: number;
  readonly securityEpoch: number;
  readonly revokedTrustedDeviceCount: number;
}

export const createAccountSecurityEpochRotationPlan = (
  currentSecurityEpoch: number,
  activeTrustedDeviceCount: number
): AccountSecurityEpochRotationPlan => {
  if (!Number.isSafeInteger(activeTrustedDeviceCount) || activeTrustedDeviceCount < 0) {
    throw new Error('Etkin güvenilir cihaz sayısı geçersiz.');
  }
  return Object.freeze({
    previousSecurityEpoch: assertAccountSecurityEpoch(currentSecurityEpoch),
    securityEpoch: nextAccountSecurityEpoch(currentSecurityEpoch),
    revokedTrustedDeviceCount: activeTrustedDeviceCount
  });
};
