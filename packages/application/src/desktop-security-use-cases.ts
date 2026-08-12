import {
  DESKTOP_SECURITY_POSTURE,
  type DesktopSecurityPostureView,
  type SessionLockReason,
  type SessionLockStateView
} from '@ppt/domain';
import type { AuthSessionPort, AuthSessionSnapshot } from './auth-use-cases.js';

const toView = (snapshot: AuthSessionSnapshot): SessionLockStateView => ({
  status: snapshot.status,
  idleTimeoutMinutes: snapshot.idleTimeoutMinutes,
  warningBeforeSeconds: snapshot.warningBeforeSeconds,
  secondsRemaining: snapshot.secondsRemaining,
  ...(snapshot.expiresAt ? { expiresAt: snapshot.expiresAt } : {}),
  ...(snapshot.warningAt ? { warningAt: snapshot.warningAt } : {}),
  ...(snapshot.lockedAt ? { lockedAt: snapshot.lockedAt } : {}),
  ...(snapshot.lockReason ? { reason: snapshot.lockReason } : {})
});

export class GetSessionLockStateUseCase {
  public constructor(private readonly session: AuthSessionPort) {}

  public execute(): SessionLockStateView {
    return toView(this.session.snapshot());
  }
}

export class RecordSessionActivityUseCase {
  public constructor(private readonly session: AuthSessionPort) {}

  public execute(): SessionLockStateView {
    return toView(this.session.recordActivity());
  }
}

export class LockSessionUseCase {
  public constructor(private readonly session: AuthSessionPort) {}

  public execute(reason: SessionLockReason = 'manual'): SessionLockStateView {
    return toView(this.session.lock(reason));
  }
}

export class GetDesktopSecurityPostureUseCase {
  public execute(): DesktopSecurityPostureView {
    return DESKTOP_SECURITY_POSTURE;
  }
}
