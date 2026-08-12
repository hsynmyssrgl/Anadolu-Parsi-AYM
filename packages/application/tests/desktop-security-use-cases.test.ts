import { describe, expect, it } from 'vitest';
import { asUserId } from '@ppt/core';
import type { AuthSessionPort, AuthSessionSnapshot } from '../src/auth-use-cases.js';
import {
  GetDesktopSecurityPostureUseCase,
  GetSessionLockStateUseCase,
  LockSessionUseCase,
  RecordSessionActivityUseCase
} from '../src/desktop-security-use-cases.js';

const snapshot = (status: AuthSessionSnapshot['status']): AuthSessionSnapshot => ({
  active: status === 'active' || status === 'warning',
  status,
  accountId: 'account-1',
  expiresAt: '2026-08-12T10:15:00.000Z' as AuthSessionSnapshot['expiresAt'],
  warningAt: '2026-08-12T10:14:00.000Z' as AuthSessionSnapshot['warningAt'],
  idleTimeoutMinutes: 15,
  warningBeforeSeconds: 60,
  secondsRemaining: status === 'locked' ? 0 : 60,
  securityEpoch: 4,
  ...(status === 'locked' ? { lockedAt: '2026-08-12T10:15:00.000Z' as NonNullable<AuthSessionSnapshot['lockedAt']>, lockReason: 'idle_timeout' as const } : {})
});

class SessionPortStub implements AuthSessionPort {
  state = snapshot('warning');
  start(): void { this.state = snapshot('active'); }
  clear(): void { this.state = { active:false,status:'signed_out',idleTimeoutMinutes:15,warningBeforeSeconds:60,secondsRemaining:0 }; }
  currentAccountId(){ return this.state.active ? asUserId('account-1') : undefined; }
  snapshot(){ return this.state; }
  recordActivity(){ this.state=snapshot('active');return this.state; }
  lock(){ this.state=snapshot('locked');return this.state; }
}

describe('B2-03/B2-04 application boundary', () => {
  it('maps warning, activity and lock transitions without exposing account identity', () => {
    const port = new SessionPortStub();
    expect(new GetSessionLockStateUseCase(port).execute()).not.toHaveProperty('accountId');
    expect(new RecordSessionActivityUseCase(port).execute().status).toBe('active');
    expect(new LockSessionUseCase(port).execute().status).toBe('locked');
  });

  it('publishes a content-free fail-closed Electron and session posture', () => {
    expect(new GetDesktopSecurityPostureUseCase().execute()).toMatchObject({
      enforcement: 'fail-closed',
      session: { idleTimeoutMinutes: 15, backgroundActivityExtendsSession: false, unsavedRendererStatePreservedOnLock: true },
      electron: { primaryRendererProtocol: 'pardus-app:', sandbox: true, onlyLoadAppFromAsar: true, runAsNodeAllowed: false }
    });
  });
});
