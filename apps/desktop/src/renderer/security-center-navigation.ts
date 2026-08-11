export const SECURITY_CENTER_ROUTE = 'security' as const;
export const SECURITY_CENTER_LABEL = 'Güvenlik Merkezi';
export const DEVICE_REAUTHORIZATION_CONFIRMATION = 'GÜVENLİ CİHAZI YENİDEN YETKİLENDİR';

export interface SecurityCenterAuthState {
  readonly twoFactorEnabled?: boolean;
  readonly deviceReauthorizationRequired?: boolean;
  readonly securityEpoch?: number;
  readonly sessionSecurityEpoch?: number;
}

export interface DeviceReauthorizationReadinessInput extends SecurityCenterAuthState {
  readonly password: string;
  readonly code: string;
  readonly confirmation: string;
}

export const securityCenterNeedsAttention = (state: SecurityCenterAuthState): boolean => {
  if (state.deviceReauthorizationRequired === true) return true;
  if (state.securityEpoch === undefined || state.sessionSecurityEpoch === undefined) return false;
  return state.securityEpoch !== state.sessionSecurityEpoch;
};

export const canSubmitDeviceReauthorization = (input: DeviceReauthorizationReadinessInput): boolean =>
  input.twoFactorEnabled === true
  && input.password.length > 0
  && input.code.trim().length > 0
  && input.confirmation === DEVICE_REAUTHORIZATION_CONFIRMATION;
