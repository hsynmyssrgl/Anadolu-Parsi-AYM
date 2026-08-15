import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import { computePlatformPolicyReceiptHash, computePlatformPolicyReceiptRecordHash } from '@ppt/repositories';
import type { DeviceSecretProtector } from '../src/main/device-secret-protector.js';
import { FamilyDataStore } from '../src/main/data-store.js';
import { ProtectedSideArtifactStore } from '../src/main/protected-side-artifact-store.js';

const POLICY_VERSION = '34-f-family-meeting-v1';
const ADMIN_PASSWORD = 'Guclu34FToplantiParolasi!';
const directories: string[] = [];
const stores: FamilyDataStore[] = [];
let projectionSequence = 0;

const kernel = new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('34-f-family-meeting-policy-key-material', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write', 'location.read'] },
  consentRequiredCapabilities: [], onlineOnlyCapabilities: [], writeActions: ['create', 'update', 'delete']
});
const authorizationProvider: PlatformPolicyAuthorizationProvider = {
  resolvePolicyPackage: () => kernel.policyPackage,
  authorize: ({ request, nonce }) => ({ effectiveRequest: request,
    authorization: kernel.authorizeWithReceipt(request, request.occurredAt, nonce) }),
  verify: ({ request, receipt }) => kernel.verifyReceiptForRequest(receipt, request)
};
const projectionProof = (record: PlatformPolicyReceiptRecord): PlatformPolicyJournalProjectionProof => ({
  schemaVersion: 1, receiptHash: computePlatformPolicyReceiptHash(record.receipt),
  recordHash: computePlatformPolicyReceiptRecordHash(record), receiptNonce: record.receipt.nonce,
  entrySequence: ++projectionSequence, entryHash: 'a'.repeat(64), headSequence: projectionSequence,
  headHash: 'a'.repeat(64), journalSizeBytes: projectionSequence * 512, issuedAt: record.recordedAt,
  proofMac: 'b'.repeat(64)
});
const protector: DeviceSecretProtector = Object.freeze({
  protectionId: '34-f-family-meeting-test-protector', isAvailable: () => true,
  protect: (plaintext: string) => Buffer.from(plaintext, 'utf8').toString('base64url'),
  unprotect: (ciphertext: string) => Buffer.from(ciphertext, 'base64url').toString('utf8')
});

afterEach(() => {
  projectionSequence = 0;
  for (const store of stores.splice(0)) try { store.close(); } catch { /* best effort */ }
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const makeStore = (governed: boolean) => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-34f-meeting-')); directories.push(directory);
  const databasePath = join(directory, 'family.db');
  const protectedSideArtifacts = new ProtectedSideArtifactStore({ keyPath: join(directory, 'protected', 'artifacts.key'),
    applicationVersion: '34-f-test', protector, now: () => new Date().toISOString() });
  const store = new FamilyDataStore({ databasePath, seed: false, protectedSideArtifacts,
    familyMeetingMinutesPath: join(directory, 'family-meeting-minutes'),
    ...(governed ? { archivePolicyAuthorizationProvider: authorizationProvider,
      archivePolicyReceiptSink: { append: () => undefined, ensure: projectionProof, verifyProjectionProof: () => true },
      archivePolicyVersion: POLICY_VERSION, archiveClusterFence: () => ({ writable: true, epoch: 110 }) } : {}) });
  stores.push(store);
  store.setupAdmin({ familyName: '34-F Meeting Family', displayName: '34-F Family Admin',
    email: 'meeting-34f-admin@example.test', password: ADMIN_PASSWORD });
  return { databasePath, directory, store };
};

const allow = (store: FamilyDataStore) => {
  const account = store.listAccounts()[0]!;
  store.upsertPermission({ subjectAccountId: account.id, resourceType: 'family_meeting_center', resourceId: '*',
    actions: ['read'], effect: 'allow', purpose: 'general' });
  store.upsertPermission({ subjectAccountId: account.id, resourceType: 'family_meeting', resourceId: '*',
    actions: ['create','update','delete'], effect: 'allow', purpose: 'general' });
};

describe('34-F family meeting DataStore production composition', () => {
  it('fails closed without central policy and writes no meeting metadata or minutes files', async () => {
    const value = makeStore(false);
    await expect(value.store.getFamilyMeetingCenter()).rejects.toThrow(/policy enforcement is not composed/i);
    await expect(value.store.createFamilyMeeting({ clientOperationId: 'meeting-create-unconfigured-34-f', expectedRevision: 0,
      title: 'Blocked meeting', recurrenceKind: 'once', recurrenceInterval: 1,
      startsAt: '2026-08-16T18:00:00.000Z', endsAt: '2026-08-16T19:00:00.000Z', reminderMinutes: 15,
      participantPersonIds: [] })).rejects.toThrow(/policy enforcement is not composed/i);
    const database = new DatabaseSync(value.databasePath, { readOnly: true });
    try {
      for (const table of ['family_meetings','family_meeting_mutations','family_meeting_minutes','family_meeting_events'])
        expect(database.prepare(`SELECT COUNT(*) count FROM ${table}`).get()).toEqual({ count: 0 });
    } finally { database.close(); }
  });

  it('persists the full local meeting flow and keeps approved minutes encrypted outside SQLite', async () => {
    const { databasePath, directory, store } = makeStore(true); allow(store);
    expect(await store.getFamilyMeetingCenter()).toMatchObject({ meetings: [], truth: {
      encryptedMinutesPackageImplemented: true, productionAiMinutesProviderConfigured: false,
      externalCalendarDeliveryExecuted: false, networkUsedByCurrentImplementation: false } });
    const create = { clientOperationId: 'meeting-create-34-f', expectedRevision: 0 as const,
      title: 'Weekly family meeting', recurrenceKind: 'weekly' as const, recurrenceInterval: 1,
      startsAt: '2026-08-16T18:00:00.000Z', endsAt: '2026-08-16T19:00:00.000Z', reminderMinutes: 30,
      participantPersonIds: [] as const };
    const created = await store.createFamilyMeeting(create);
    expect(created).toMatchObject({ mutationKind: 'meeting_create', revision: 1, replayed: false });
    expect(await store.createFamilyMeeting(create)).toMatchObject({ revision: 1, replayed: true });
    await expect(store.createFamilyMeeting({ ...create, title: 'Changed command' })).rejects.toThrow(/clientOperationId|farkl/i);
    const meetingId = created.resourceId;
    await store.upsertFamilyMeetingAgendaItem({ clientOperationId: 'agenda-add-34-f', expectedRevision: 1, meetingId,
      title: 'Budget and travel review', order: 1,
      preRead: [{ resourceType: 'archive_item', resourceId: 'archive-preread-34-f' }], carryForwardToNextMeeting: true });
    await store.createFamilyMeetingPoll({ clientOperationId: 'poll-create-34-f', expectedRevision: 2, meetingId,
      question: 'Choose the next activity', options: ['Museum','Picnic'] });
    let center = await store.getFamilyMeetingCenter(); const poll = center.meetings[0]!.polls[0]!;
    await store.castFamilyMeetingVote({ clientOperationId: 'vote-cast-34-f', expectedRevision: 3, meetingId,
      pollId: poll.id, optionId: poll.options[0]!.id, abstain: false, opinionNote: 'Accessible venue preferred.' });
    await store.recordFamilyMeetingDecision({ clientOperationId: 'decision-record-34-f', expectedRevision: 4, meetingId,
      statement: 'Visit the museum.', sourcePollId: poll.id, responsiblePersonIds: [center.ownerPersonId] });
    center = await store.getFamilyMeetingCenter(); const decisionId = center.meetings[0]!.decisions[0]!.id;
    await store.upsertFamilyMeetingTask({ clientOperationId: 'task-add-34-f', expectedRevision: 5, meetingId,
      decisionId, title: 'Book accessible tickets', responsiblePersonId: center.ownerPersonId,
      dueAt: '2026-08-20T18:00:00.000Z', state: 'open', carryForwardToNextMeeting: true });
    await store.addFamilyMeetingCollaboration({ clientOperationId: 'collaboration-add-34-f', expectedRevision: 6,
      meetingId, kind: 'document_annotation', resourceType: 'archive_item', resourceId: 'archive-collaboration-34-f',
      annotation: 'Compare ticket options.' });
    await store.setFamilyMeetingState({ clientOperationId: 'meeting-start-34-f', expectedRevision: 7, meetingId,
      state: 'in_progress', reason: 'Meeting started.' });
    await store.setFamilyMeetingState({ clientOperationId: 'meeting-complete-34-f', expectedRevision: 8, meetingId,
      state: 'completed', reason: 'Meeting completed.' });
    const plaintextSummary = 'The family approved a museum visit and assigned the ticket task.';
    expect(await store.finalizeFamilyMeetingMinutes({ clientOperationId: 'minutes-finalize-34-f', expectedRevision: 9,
      meetingId, summary: plaintextSummary, decisions: ['Visit the museum.'], tasks: ['Book accessible tickets.'],
      participantAccessPersonIds: [center.ownerPersonId], selectedRecordingSegmentIds: [],
      explicitHumanApproval: true, machineGeneratedSource: false })).toMatchObject({
        mutationKind: 'minutes_finalize', revision: 10, encryptedMinutesPackageWritten: true,
        aiProviderConfigured: false, networkUsed: false, cloudUsed: false
      });
    expect(await store.getFamilyMeetingMinutes(meetingId)).toMatchObject({ meetingId, summary: plaintextSummary,
      humanApproved: true, machineGeneratedSource: false, payloadSource: 'local_sealed_store', networkUsed: false });
    center = await store.getFamilyMeetingCenter();
    expect(center.meetings[0]).toMatchObject({ state: 'completed', revision: 10,
      agenda: [{ title: 'Budget and travel review', carryForwardToNextMeeting: true }],
      polls: [{ votes: [{ abstained: false }] }], decisions: [{ statement: 'Visit the museum.' }],
      tasks: [{ title: 'Book accessible tickets', carryForwardToNextMeeting: true }],
      minutes: { state: 'sealed_local', humanApprovalRecorded: true, encryptedPackageAvailable: true } });
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const durable = JSON.stringify({ minutes: database.prepare('SELECT * FROM family_meeting_minutes').all(),
        mutations: database.prepare('SELECT * FROM family_meeting_mutations').all(),
        events: database.prepare('SELECT * FROM family_meeting_events').all(),
        audit: database.prepare("SELECT * FROM audit_log WHERE resource_type='family_meeting'").all(),
        outbox: database.prepare("SELECT * FROM event_outbox WHERE event_type='family.meeting.changed'").all() });
      expect(durable).not.toContain(plaintextSummary);
      expect(database.prepare('SELECT human_approval_recorded,network_used,cloud_used FROM family_meeting_minutes').get())
        .toEqual({ human_approval_recorded: 1, network_used: 0, cloud_used: 0 });
      expect(database.prepare('SELECT COUNT(*) count FROM family_meeting_votes').get()).toEqual({ count: 1 });
      expect(database.prepare('SELECT COUNT(*) count FROM family_meeting_decisions').get()).toEqual({ count: 1 });
    } finally { database.close(); }
    const minuteFiles = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const referenceRow = minuteFiles.prepare('SELECT sealed_payload_reference FROM family_meeting_minutes').get() as unknown;
      const reference = (referenceRow as { sealed_payload_reference: string }).sealed_payload_reference;
      expect(reference).toMatch(/^family-meeting-minutes-[0-9a-f]{64}\.pptminutes$/u);
      expect(readFileSync(join(directory, 'family-meeting-minutes', reference), 'utf8')).not.toContain(plaintextSummary);
    } finally { minuteFiles.close(); }
  }, 30_000);

  it('rolls mutation, current row, event and audit back together on downstream failure', async () => {
    const { databasePath, store } = makeStore(true); allow(store);
    const injector = new DatabaseSync(databasePath);
    try { injector.exec(`CREATE TRIGGER test_34f_outbox_failure BEFORE INSERT ON event_outbox
      WHEN NEW.event_type='family.meeting.changed'
      BEGIN SELECT RAISE(ABORT,'controlled 34-F outbox failure'); END;`); } finally { injector.close(); }
    await expect(store.createFamilyMeeting({ clientOperationId: 'meeting-rollback-34-f', expectedRevision: 0,
      title: 'Rollback meeting', recurrenceKind: 'once', recurrenceInterval: 1,
      startsAt: '2026-08-16T18:00:00.000Z', endsAt: '2026-08-16T19:00:00.000Z', reminderMinutes: 15,
      participantPersonIds: [] })).rejects.toThrow();
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      for (const table of ['family_meetings','family_meeting_participants','family_meeting_mutations','family_meeting_events'])
        expect(database.prepare(`SELECT COUNT(*) count FROM ${table}`).get()).toEqual({ count: 0 });
      expect(database.prepare("SELECT COUNT(*) count FROM audit_log WHERE resource_type='family_meeting'").get()).toEqual({ count: 0 });
      expect(database.prepare("SELECT COUNT(*) count FROM event_outbox WHERE event_type='family.meeting.changed'").get()).toEqual({ count: 0 });
    } finally { database.close(); }
  }, 30_000);
});
