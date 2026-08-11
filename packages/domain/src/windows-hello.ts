export type WindowsHelloAvailability =
  | 'available'
  | 'device_not_present'
  | 'not_configured_for_user'
  | 'disabled_by_policy'
  | 'device_busy'
  | 'platform_not_supported'
  | 'error';

export type WindowsHelloPromptOutcome =
  | 'verified'
  | 'cancelled'
  | 'retries_exhausted'
  | 'device_not_present'
  | 'not_configured_for_user'
  | 'disabled_by_policy'
  | 'device_busy'
  | 'platform_not_supported'
  | 'error';

export type WindowsHelloAuthenticationOutcome =
  | WindowsHelloPromptOutcome
  | 'fallback_required'
  | 'device_changed'
  | 'principal_changed'
  | 'security_epoch_changed'
  | 'registration_not_found'
  | 'account_unavailable';

export type WindowsHelloRevocationReason =
  | 'manual'
  | 'reenrolled'
  | 'device_changed'
  | 'principal_changed'
  | 'security_epoch_changed';

export interface WindowsHelloRegistrationView {
  readonly id: string;
  readonly deviceId: string;
  readonly displayName: string;
  readonly enrolledAt: string;
  readonly lastVerifiedAt?: string;
  readonly securityEpoch: number;
  readonly revokedAt?: string;
  readonly revocationReason?: WindowsHelloRevocationReason;
}

export interface WindowsHelloStateView {
  readonly availability: WindowsHelloAvailability;
  readonly enrolled: boolean;
  readonly deviceChanged: boolean;
  readonly principalChanged: boolean;
  readonly securityEpochChanged: boolean;
  readonly passwordFallbackAvailable: true;
  readonly diagnosticCode?: string;
  readonly registration?: WindowsHelloRegistrationView;
}

export interface EnrollWindowsHelloInput {
  readonly password: string;
  readonly secondFactorCode?: string;
  readonly displayName?: string;
}

export interface WindowsHelloEnrollmentView {
  readonly enrolled: boolean;
  readonly outcome: WindowsHelloPromptOutcome | 'enrolled' | 'principal_changed' | 'device_changed';
  readonly passwordFallbackAvailable: true;
  readonly diagnosticCode?: string;
  readonly registration?: WindowsHelloRegistrationView;
}

export interface LoginWithWindowsHelloInput {
  /** Renderer supplied account hint; the protected vault slot remains authoritative. */
  readonly accountId?: string;
  readonly fallback?: {
    readonly password: string;
    readonly secondFactorCode?: string;
  };
}

export interface ReauthenticateWithWindowsHelloInput {
  readonly fallback?: {
    readonly password: string;
    readonly secondFactorCode?: string;
  };
}

export interface WindowsHelloAuthenticationView {
  readonly authenticated: boolean;
  readonly method: 'windows_hello' | 'password_fallback' | 'none';
  readonly outcome: WindowsHelloAuthenticationOutcome;
  readonly passwordFallbackAvailable: true;
  readonly diagnosticCode?: string;
  readonly registration?: WindowsHelloRegistrationView;
}
