export const DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES = 15;
export const DEFAULT_SESSION_WARNING_SECONDS = 60;

export type SessionLockStatus = 'signed_out' | 'active' | 'warning' | 'locked';
export type SessionLockReason = 'idle_timeout' | 'manual';

export interface SessionLockStateView {
  readonly status: SessionLockStatus;
  readonly idleTimeoutMinutes: number;
  readonly warningBeforeSeconds: number;
  readonly secondsRemaining: number;
  readonly expiresAt?: string;
  readonly warningAt?: string;
  readonly lockedAt?: string;
  readonly reason?: SessionLockReason;
}

export interface UnlockSessionInput {
  readonly password: string;
  readonly secondFactorCode?: string;
}

export interface DesktopSecurityPostureView {
  readonly requirementIds: readonly ['B2-03', 'B2-04'];
  readonly enforcement: 'fail-closed';
  readonly session: {
    readonly idleTimeoutMinutes: 15;
    readonly warningBeforeSeconds: 60;
    readonly backgroundActivityExtendsSession: false;
    readonly unsavedRendererStatePreservedOnLock: true;
    readonly explicitReauthenticationRequired: true;
  };
  readonly electron: {
    readonly primaryRendererProtocol: 'pardus-app:';
    readonly fileProtocolPrimaryRendererAllowed: false;
    readonly cspHeaderEnforced: true;
    readonly navigationDeniedByDefault: true;
    readonly windowCreationDeniedByDefault: true;
    readonly permissionRequestsDeniedByDefault: true;
    readonly nodeIntegration: false;
    readonly contextIsolation: true;
    readonly sandbox: true;
    readonly webSecurity: true;
    readonly insecureContentAllowed: false;
    readonly webviewAllowed: false;
    readonly fuseVerificationRequired: true;
    readonly runAsNodeAllowed: false;
    readonly nodeOptionsEnvironmentAllowed: false;
    readonly nodeCliInspectAllowed: false;
    readonly embeddedAsarIntegrityRequired: true;
    readonly onlyLoadAppFromAsar: true;
    readonly fileProtocolExtraPrivilegesAllowed: false;
    readonly wasmTrapHandlers: true;
  };
}

export const DESKTOP_SECURITY_POSTURE: DesktopSecurityPostureView = Object.freeze({
  requirementIds: Object.freeze(['B2-03', 'B2-04'] as const),
  enforcement: 'fail-closed',
  session: Object.freeze({
    idleTimeoutMinutes: 15,
    warningBeforeSeconds: 60,
    backgroundActivityExtendsSession: false,
    unsavedRendererStatePreservedOnLock: true,
    explicitReauthenticationRequired: true
  }),
  electron: Object.freeze({
    primaryRendererProtocol: 'pardus-app:',
    fileProtocolPrimaryRendererAllowed: false,
    cspHeaderEnforced: true,
    navigationDeniedByDefault: true,
    windowCreationDeniedByDefault: true,
    permissionRequestsDeniedByDefault: true,
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    insecureContentAllowed: false,
    webviewAllowed: false,
    fuseVerificationRequired: true,
    runAsNodeAllowed: false,
    nodeOptionsEnvironmentAllowed: false,
    nodeCliInspectAllowed: false,
    embeddedAsarIntegrityRequired: true,
    onlyLoadAppFromAsar: true,
    fileProtocolExtraPrivilegesAllowed: false,
    wasmTrapHandlers: true
  })
});
