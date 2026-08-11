import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { FixedClock, asIsoDateTime } from '../packages/core/dist/index.js';

const root = mkdtempSync(join(tmpdir(), 'ppt-30-g-invitation-lifecycle-'));
const databasePath = join(root, 'runtime.db');
const adminPassword = 'Guclu30GDavetParolasi!2026';
const checks = [];
const check = (name, operation) => { operation(); checks.push(name); };
let store;

try {
  store = new FamilyDataStore({
    databasePath,
    deviceIdentityPath: join(root, 'secrets', 'device-identity.json'),
    applicationVersion: '04.08.2026.29',
    migrationBackupDirectory: join(root, 'migration-backups'),
    clock: new FixedClock(asIsoDateTime('2026-08-05T12:00:00.000Z'))
  });
  store.setupAdmin({ displayName: '30-G Admin', email: 'admin-30g@example.test', password: adminPassword });

  const ready = store.createInvitation({ email: 'ready@example.test', role: 'adult_member', startsAt: '2026-08-05T11:00:00.000Z', endsAt: '2026-08-06T12:00:00.000Z' });
  check('ready invitation code is safely inspectable', () => assert.deepEqual(store.inspectInvitation({ token: ready.token }), { resolution: 'ready', canAccept: true, message: 'Davet kullanıma hazır.', startsAt: '2026-08-05T11:00:00.000Z', endsAt: '2026-08-06T12:00:00.000Z' }));
  check('unknown invitation code is invalid without identity disclosure', () => assert.deepEqual(store.inspectInvitation({ token: 'unknown-code' }), { resolution: 'invalid', canAccept: false, message: 'Davet kodu geçersiz.' }));

  const future = store.createInvitation({ email: 'future@example.test', role: 'limited_member', startsAt: '2026-08-06T12:00:00.000Z', endsAt: '2026-08-13T12:00:00.000Z' });
  check('future invitation is not yet active', () => assert.equal(store.inspectInvitation({ token: future.token }).resolution, 'not_yet_active'));
  const expired = store.createInvitation({ email: 'expired@example.test', role: 'caregiver', startsAt: '2026-08-01T12:00:00.000Z', endsAt: '2026-08-04T12:00:00.000Z' });
  check('expired invitation is explicit and cannot be accepted', () => assert.deepEqual({ resolution: store.inspectInvitation({ token: expired.token }).resolution, canAccept: store.inspectInvitation({ token: expired.token }).canAccept }, { resolution: 'expired', canAccept: false }));

  const revoked = store.createInvitation({ email: 'resend@example.test', role: 'advisor', startsAt: '2026-08-05T11:00:00.000Z', endsAt: '2026-08-06T12:00:00.000Z' });
  store.revokeInvitation(revoked.invitation.id);
  check('manual revocation is timestamped and reasoned', () => {
    const item = store.listInvitations().find((value) => value.id === revoked.invitation.id);
    assert.deepEqual({ status: item?.status, revokedAt: item?.revokedAt, reason: item?.revocationReason }, { status: 'revoked', revokedAt: '2026-08-05T12:00:00.000Z', reason: 'manual' });
    assert.equal(store.inspectInvitation({ token: revoked.token }).resolution, 'revoked');
  });

  const resent = store.resendInvitation({ invitationId: revoked.invitation.id });
  check('resend issues a distinct seven-day single-use code', () => {
    assert.notEqual(resent.token, revoked.token);
    assert.equal(resent.invitation.resentFromInvitationId, revoked.invitation.id);
    assert.equal(resent.invitation.startsAt, '2026-08-05T12:00:00.000Z');
    assert.equal(resent.invitation.endsAt, '2026-08-12T12:00:00.000Z');
  });
  check('resend atomically supersedes the previous code', () => {
    const previous = store.listInvitations().find((value) => value.id === revoked.invitation.id);
    assert.deepEqual({ status: previous?.status, reason: previous?.revocationReason, successor: previous?.supersededByInvitationId }, { status: 'revoked', reason: 'resent', successor: resent.invitation.id });
    assert.equal(store.inspectInvitation({ token: revoked.token }).message, 'Bu davet yerine yeni bir kod gönderilmiş.');
    assert.equal(store.inspectInvitation({ token: resent.token }).resolution, 'ready');
  });
  check('already superseded invitation cannot branch into another code', () => assert.throws(() => store.resendInvitation({ invitationId: revoked.invitation.id }), /RESOURCE-CONFLICT-001/));

  const accepted = store.acceptInvitation({ token: resent.token, displayName: 'Davet Alıcısı', password: 'DavetAlicisiGucluParola!2026' });
  check('recipient accepts the resent code exactly once', () => assert.equal(accepted.authenticated, true));
  check('accepted code becomes an understandable used state', () => assert.deepEqual(store.inspectInvitation({ token: resent.token }), { resolution: 'used', canAccept: false, message: 'Davet daha önce kullanılmış.' }));
  check('second acceptance fails closed with used-code message', () => assert.throws(() => store.acceptInvitation({ token: resent.token, displayName: 'İkinci Deneme', password: 'IkinciDenemeGucluParola!2026' }), /Davet daha önce kullanılmış/));

  store.logout();
  store.login({ email: 'admin-30g@example.test', password: adminPassword });
  check('used invitation cannot be resent', () => assert.throws(() => store.resendInvitation({ invitationId: resent.invitation.id }), /Kullanılmış davet yeniden gönderilemez/));

  const probe = new DatabaseSync(databasePath);
  try {
    check('database preserves bidirectional resend linkage', () => {
      const oldRow = probe.prepare('SELECT status,revocation_reason,superseded_by_invitation_id FROM invitations WHERE id=?').get(revoked.invitation.id);
      const newRow = probe.prepare('SELECT status,resent_from_invitation_id,accepted_at FROM invitations WHERE id=?').get(resent.invitation.id);
      assert.deepEqual({ ...oldRow }, { status: 'revoked', revocation_reason: 'resent', superseded_by_invitation_id: resent.invitation.id });
      assert.deepEqual({ ...newRow }, { status: 'accepted', resent_from_invitation_id: revoked.invitation.id, accepted_at: '2026-08-05T12:00:00.000Z' });
    });
    check('audit and outbox retain revoke resend and accept evidence', () => {
      for (const action of ['invitation.revoked', 'invitation.resent', 'invitation.accepted']) assert.equal(Number(probe.prepare('SELECT COUNT(*) AS total FROM audit_log WHERE action=?').get(action).total), 1);
      for (const eventType of ['membership.invitation.revoked', 'membership.invitation.resent', 'membership.invitation.accepted']) assert.equal(Number(probe.prepare('SELECT COUNT(*) AS total FROM event_outbox WHERE event_type=?').get(eventType).total), 1);
    });
    check('database trigger rejects unreasoned revoked state', () => assert.throws(() => probe.prepare("UPDATE invitations SET status='revoked' WHERE id=?").run(ready.invitation.id), /invalid invitation lifecycle state/));
  } finally {
    probe.close();
  }

  const report = { schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '30-G', requirement: 'B1-04', status: 'PASS', checkCount: checks.length, checks, assertions: { accept: 'PASS', expiration: 'PASS', revocation: 'PASS', resend: 'PASS', safeErrors: 'PASS', auditOutbox: 'PASS', databaseLifecycleGuards: 'PASS' }, generatedAt: new Date().toISOString() };
  mkdirSync('artifacts/validation', { recursive: true });
  writeFileSync('artifacts/validation/30-G-invitation-lifecycle-runtime.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(`30-G invitation lifecycle runtime: PASS (${checks.length} checks).`);
} finally {
  store?.close();
  rmSync(root, { recursive: true, force: true });
}
