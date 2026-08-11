import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { FixedClock, asIsoDateTime } from '../packages/core/dist/index.js';
import { createArchivePolicyTestOptions } from './lib/archive-policy-test-harness.mjs';

const directory = mkdtempSync(join(tmpdir(), 'panthera-mvp53-collaboration-'));
const databasePath = join(directory, 'family.db');
const deviceIdentityPath = join(directory, 'secrets', 'device-identity.json');
const checks = [];
const check = async (name, operation) => { await operation(); checks.push(name); };
const adminPassword = 'GucluCollaborationParolasi!2026';
const policyOptions = createArchivePolicyTestOptions();
let store;
try {
  store = new FamilyDataStore({
    databasePath,
    deviceIdentityPath,
    applicationVersion: ACTIVE_BUILD_META.applicationVersion,
    migrationBackupDirectory: join(directory, 'migration-backups'),
    clock: new FixedClock(asIsoDateTime('2026-07-23T12:00:00.000Z')),
    ...policyOptions
  });
  store.setupAdmin({ displayName: 'Collaboration Admin', email: 'admin@example.com', password: adminPassword });
  const initialPersonId = (await store.getSnapshot()).people[0].id;
  const invitedPersonId = store.createMember({ displayName: 'Davetli Üye', relationshipType: 'Aile üyesi', generation: 2, branch: 'Davet Dalı' }).person.id;
  const acceptedPersonId = store.createMember({ displayName: 'Kabul Eden Üye', relationshipType: 'Aile üyesi', generation: 2, branch: 'Davet Dalı' }).person.id;
  const locationId = (await store.createLocation({ label: 'Ortak Aile Mekânı', address: 'Ankara', kind: 'residence' })).location.id;

  const created = store.createInvitation({
    email: '  UYE@EXAMPLE.COM  ', role: 'adult_member', personId: invitedPersonId,
    endsAt: '2026-08-23T12:00:00.000Z'
  });
  await check('invitation email is normalized and linked to a family person', () => {
    assert.equal(created.invitation.email, 'uye@example.com');
    assert.equal(created.invitation.personId, invitedPersonId);
    assert.equal(created.invitation.status, 'pending');
    assert.ok(created.token.length >= 32);
  });
  await check('pending invitation duplicate is rejected atomically', () => {
    assert.throws(() => store.createInvitation({ email: 'uye@example.com', role: 'adult_member' }), /RESOURCE-CONFLICT-001/);
    assert.equal(store.listInvitations().filter((item) => item.email === 'uye@example.com').length, 1);
  });
  await check('pending invitation can be revoked', () => {
    const invitations = store.revokeInvitation(created.invitation.id);
    assert.equal(invitations.find((item) => item.id === created.invitation.id)?.status, 'revoked');
  });

  const acceptedInvite = store.createInvitation({ email: 'accepted@example.com', role: 'adult_member', personId: acceptedPersonId });
  await check('weak invitation acceptance password leaves invitation pending', () => {
    assert.throws(() => store.acceptInvitation({ token: acceptedInvite.token, displayName: 'Accepted Member', password: 'weak' }), /CORE-VALIDATION-001/);
    assert.equal(store.listInvitations().find((item) => item.id === acceptedInvite.invitation.id)?.status, 'pending');
  });
  const acceptedState = store.acceptInvitation({
    token: acceptedInvite.token,
    displayName: 'Accepted Member',
    password: 'AcceptedMemberGucluParola!2026'
  });
  await check('invitation acceptance creates and authenticates linked account', () => {
    assert.equal(acceptedState.authenticated, true);
    assert.equal(acceptedState.role, 'adult_member');
  });
  await check('accepted invitation token cannot be consumed twice', () => {
    assert.throws(() => store.acceptInvitation({ token: acceptedInvite.token, displayName: 'Again', password: 'AgainMemberGucluParola!2026' }), /AUTH-CREDENTIALS-001/);
  });

  const trustedDeviceFixture = new DatabaseSync(databasePath);
  try {
    trustedDeviceFixture.prepare(`
      INSERT INTO trusted_devices(
        id,account_id,device_id,display_name,fingerprint,public_key_pem,
        trusted_at,last_seen_at,security_epoch,revoked_at,created_at
      )
      SELECT 'collaboration-member-trusted-device',member.id,device.device_id,
             'Controlled collaboration verifier device',device.fingerprint,device.public_key_pem,
             device.trusted_at,device.last_seen_at,member.security_epoch,NULL,device.created_at
      FROM accounts member
      JOIN accounts administrator ON administrator.email='admin@example.com'
      JOIN trusted_devices device ON device.account_id=administrator.id AND device.revoked_at IS NULL
      WHERE member.email='accepted@example.com'
    `).run();
  } finally {
    trustedDeviceFixture.close();
  }
  await check('non-owner member cannot read the owner governed location without an explicit grant', async () => {
    assert.deepEqual((await store.getSnapshot()).locations, []);
  });

  store.logout();
  store.login({ email: 'admin@example.com', password: adminPassword });
  const eventMutation = await store.createEvent({
    title: 'MVP-55 Aile Daveti',
    startAt: '2026-07-30T12:00:00.000Z',
    locationId,
    visibility: 'family',
    participantPersonIds: [initialPersonId],
    invitationText: 'İlk davetiye',
    notes: 'İlk not',
    aiProcessingAllowed: false,
    reminderDays: [7, 1]
  });
  const event = eventMutation.event;
  assert.ok(event);
  const notification = (await store.getSnapshot()).notifications.find((item) => item.sourceId === event.id);
  assert.ok(notification);

  const participantMutation = await store.updateImportantDayParticipants({
    eventId: event.id,
    participantPersonIds: [initialPersonId, invitedPersonId, initialPersonId],
    visibility: 'selected_members'
  });
  await check('participant mutation normalizes duplicates and persists visibility', () => {
    const updated = participantMutation.event;
    assert.deepEqual(updated?.participantPersonIds, [initialPersonId, invitedPersonId]);
    assert.equal(updated?.visibility, 'selected_members');
  });
  const invitationMutation = await store.updateImportantDayInvitation({ eventId: event.id, invitationText: '  Güncellenmiş aile davetiyesi  ' });
  await check('event invitation text is updated through application use case', () => {
    assert.equal(invitationMutation.event?.invitationText, 'Güncellenmiş aile davetiyesi');
  });
  const notesMutation = await store.updateImportantDayNotes({ eventId: event.id, notes: '  Ortak planlama notu  ' });
  await check('event notes are updated through application use case', () => {
    assert.equal(notesMutation.event?.notes, 'Ortak planlama notu');
  });
  const countProbe = new DatabaseSync(databasePath, { readOnly: true });
  const eventOutboxBeforeInvalid = Number(countProbe.prepare("SELECT COUNT(*) count FROM event_outbox").get().count);
  countProbe.close();
  await check('invalid participant mutation rolls back event audit and outbox', async () => {
    await assert.rejects(() => store.updateImportantDayParticipants({ eventId: event.id, participantPersonIds: ['missing-person'], visibility: 'selected_members' }), /RESOURCE-NOT-FOUND-001/);
    const probe = new DatabaseSync(databasePath, { readOnly: true });
    try { assert.equal(Number(probe.prepare('SELECT COUNT(*) count FROM event_outbox').get().count), eventOutboxBeforeInvalid); }
    finally { probe.close(); }
  });

  const acknowledged = await store.acknowledgeTimelineNotification({ notificationId: notification.id });
  await check('timeline notification is acknowledged for current account', async () => {
    assert.equal(acknowledged.notificationId, notification.id);
    const item = (await store.getSnapshot()).notifications.find((candidate) => candidate.id === notification.id);
    assert.ok(item?.acknowledgedAt);
    assert.equal(item?.occurrenceKey, notification.occurrenceKey);
  });
  await check('notification acknowledgement is idempotent', async () => {
    const repeated = await store.acknowledgeTimelineNotification({ notificationId: notification.id });
    assert.equal(repeated.notificationId, notification.id);
    assert.ok((await store.getSnapshot()).notifications.find((item) => item.id === notification.id)?.acknowledgedAt);
  });

  const dispatch = await store.dispatchPendingEvents();
  await check('membership and collaboration outbox events are publishable', () => {
    assert.ok(dispatch.claimed >= 8);
    assert.equal(dispatch.failed, 0);
  });

  store.close(); store = undefined;
  store = new FamilyDataStore({
    databasePath,
    deviceIdentityPath,
    applicationVersion: ACTIVE_BUILD_META.applicationVersion,
    migrationBackupDirectory: join(directory, 'migration-backups'),
    clock: new FixedClock(asIsoDateTime('2026-07-23T12:00:00.000Z')),
    ...policyOptions
  });
  store.login({ email: 'admin@example.com', password: adminPassword });
  await check('notification acknowledgement survives application restart', async () => {
    assert.ok((await store.getSnapshot()).notifications.find((item) => item.id === notification.id)?.acknowledgedAt);
  });
  store.close(); store = undefined;

  const probe = new DatabaseSync(databasePath, { readOnly: true });
  try {
    await check('membership lifecycle writes audit and outbox records', () => {
      for (const action of ['invitation.created', 'invitation.revoked', 'invitation.accepted']) {
        assert.ok(Number(probe.prepare('SELECT COUNT(*) count FROM audit_log WHERE action=?').get(action).count) >= 1);
      }
      for (const eventType of ['membership.invitation.created', 'membership.invitation.revoked', 'membership.invitation.accepted']) {
        assert.ok(Number(probe.prepare('SELECT COUNT(*) count FROM event_outbox WHERE event_type=?').get(eventType).count) >= 1);
      }
    });
    await check('event collaboration mutations write audit and outbox records', () => {
      for (const action of ['event.participants.updated', 'event.invitation.updated', 'event.notes.updated', 'notification.acknowledged']) {
        assert.ok(Number(probe.prepare('SELECT COUNT(*) count FROM audit_log WHERE action=?').get(action).count) >= 1);
      }
      assert.equal(Number(probe.prepare('SELECT COUNT(*) count FROM event_notification_states WHERE account_id=(SELECT id FROM accounts WHERE email=?)').get('admin@example.com').count), 1);
    });
    await check('accepted account preserves person link and membership period', () => {
      const account = probe.prepare('SELECT person_id,role,status FROM accounts WHERE email=?').get('accepted@example.com');
      assert.equal(account.person_id, acceptedPersonId);
      assert.equal(account.role, 'adult_member');
      assert.equal(account.status, 'active');
    });
  } finally { probe.close(); }

  const report = {
    schemaVersion: 1,
    product: 'Panthera pardus tulliana',
    version: ACTIVE_BUILD_META.applicationVersion,
    milestone: ACTIVE_BUILD_META.milestone,
    status: 'passed',
    checks: checks.length,
    scenarios: checks,
    invitationRepositoryActive: true,
    collaborationMutationsActive: true,
    notificationAcknowledgementPersistent: true,
    transactionalAuditOutboxActive: true,
    generatedAt: new Date().toISOString()
  };
  mkdirSync('artifacts/manifests', { recursive: true });
  writeFileSync('artifacts/manifests/MEMBERSHIP_COLLABORATION_VERIFICATION_MVP56.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  store?.close();
  rmSync(directory, { recursive: true, force: true });
}
