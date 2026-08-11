import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { FixedClock, asIsoDateTime } from '../packages/core/dist/index.js';
import { createArchivePolicyTestOptions } from './lib/archive-policy-test-harness.mjs';

const directory = mkdtempSync(join(tmpdir(), 'panthera-mvp48-timeline-'));
const databasePath = join(directory, 'family.db');
const checks = [];
const check = async (name, operation) => {
  await operation();
  checks.push(name);
};

let store;
try {
  store = new FamilyDataStore({
    databasePath,
    applicationVersion: ACTIVE_BUILD_META.applicationVersion,
    migrationBackupDirectory: join(directory, 'migration-backups'),
    clock: new FixedClock(asIsoDateTime('2026-07-23T12:00:00.000Z')),
    ...createArchivePolicyTestOptions()
  });
  store.setupAdmin({
    displayName: 'Timeline Test Admin',
    email: 'timeline@example.com',
    password: 'GucluTimelineParolasi!2026'
  });

  const seed = await store.getSnapshot();
  const ownerPersonId = seed.people[0].id;
  await check('legacy bootstrap locations stay quarantined from the governed read model', () => {
    assert.deepEqual(seed.locations, []);
  });
  const governedLocationMutation = await store.createLocation({
    label: 'İstanbul Teknik Üniversitesi',
    address: 'İstanbul',
    kind: 'venue'
  });
  const governedLocation = governedLocationMutation.location;
  assert.ok(governedLocation);
  await check('governed location create is exactly visible to its owner', async () => {
    const snapshot = await store.getSnapshot();
    assert.deepEqual(snapshot.locations, [governedLocation]);
  });
  const locationDispatch = await store.dispatchPendingEvents();
  await check('governed location outbox event is publishable', () => {
    assert.equal(locationDispatch.claimed, 1);
    assert.equal(locationDispatch.published, 1);
  });

  const firstMutation = await store.createEvent({
    title: '  Aile Kuruluş Yıldönümü  ',
    description: 'Aile tarihinin kayıt altına alındığı özel gün.',
    startAt: '2026-07-30T15:00:00+03:00',
    locationId: governedLocation.id,
    locationLabel: 'Bu değer canonical konum tarafından değiştirilmeli',
    visibility: 'family',
    participantPersonIds: [ownerPersonId, ownerPersonId],
    invitationText: 'Tüm aile üyeleri davetlidir.',
    notes: 'Fotoğraf ve aile defteri getirilecek.',
    aiProcessingAllowed: false,
    recurrence: 'yearly',
    reminderDays: [0, 7, 1, 7, 30]
  });
  const first = firstMutation.event;
  assert.ok(first);

  await check('create important day normalizes all supported fields', () => {
    assert.equal(first.locationId, governedLocation.id);
    assert.equal(first.locationLabel, 'İstanbul Teknik Üniversitesi');
    assert.deepEqual(first.participantPersonIds, [ownerPersonId]);
    assert.deepEqual(first.reminderDays, [30, 7, 1, 0]);
    assert.equal(first.recurrence, 'yearly');
    assert.equal(first.aiProcessingAllowed, false);
    assert.equal(first.invitationText, 'Tüm aile üyeleri davetlidir.');
    assert.equal(first.notes, 'Fotoğraf ve aile defteri getirilecek.');
    assert.equal(first.startAt, '2026-07-30T12:00:00.000Z');
  });

  await check('important day details use case returns full record', async () => {
    const details = await store.getImportantDayDetails(first.id);
    assert.deepEqual(details, first);
  });

  await check('timeline read model generates reminder notification', async () => {
    const notification = (await store.getSnapshot()).notifications.find((item) => item.sourceId === first.id);
    assert.ok(notification);
    assert.equal(notification.body, '7 gün sonra');
    assert.equal(notification.urgency, 'soon');
  });

  const secondMutation = await store.createEvent({
    title: 'AI İzinli Aile Hatırası',
    startAt: '2026-08-10T10:00:00.000Z',
    locationLabel: 'Sakarya',
    visibility: 'family',
    participantPersonIds: [ownerPersonId],
    invitationText: 'Dijital aile arşivi çalışması.',
    notes: 'Yalnızca kullanıcı izniyle AI işleme açık.',
    aiProcessingAllowed: true,
    recurrence: 'none',
    reminderDays: [14, 1]
  });
  const second = secondMutation.event;
  assert.ok(second);

  store.upsertAiConsent({
    purpose: 'summary',
    resourceType: 'event',
    resourceId: first.id,
    status: 'granted'
  });
  store.upsertAiConsent({
    purpose: 'summary',
    resourceType: 'event',
    resourceId: second.id,
    status: 'granted'
  });
  await check('AI preview respects authoritative event permission flag', () => {
    const preview = store.previewAiAccess('summary');
    assert.ok(preview.allowedResources.some((item) => item.resourceId === second.id));
    assert.ok(!preview.allowedResources.some((item) => item.resourceId === first.id));
  });

  const dispatch = await store.dispatchPendingEvents();
  await check('important day events are published by two idempotent handlers', () => {
    assert.equal(dispatch.claimed, 2);
    assert.equal(dispatch.published, 2);
    assert.equal(dispatch.successfulHandlers, 4);
  });
  const repeatedDispatch = await store.dispatchPendingEvents();
  await check('published important day events are not processed twice', () => {
    assert.equal(repeatedDispatch.claimed, 0);
    assert.equal(repeatedDispatch.published, 0);
  });

  const eventCountBeforeInvalid = (await store.getSnapshot()).events.length;
  await check('unknown participant is rejected without partial write', async () => {
    await assert.rejects(() => store.createEvent({
      title: 'Geçersiz Katılımcı',
      startAt: '2026-09-01T10:00:00.000Z',
      visibility: 'family',
      participantPersonIds: ['missing-person'],
      aiProcessingAllowed: false
    }), /RESOURCE-NOT-FOUND-001/);
    assert.equal((await store.getSnapshot()).events.length, eventCountBeforeInvalid);
  });

  await check('unknown location fails closed at policy resolution without partial write', async () => {
    await assert.rejects(() => store.createEvent({
      title: 'Geçersiz Konum',
      startAt: '2026-09-01T10:00:00.000Z',
      locationId: 'missing-location',
      visibility: 'family',
      participantPersonIds: [],
      aiProcessingAllowed: false
    }), /PERMISSION-DENIED-001/);
    assert.equal((await store.getSnapshot()).events.length, eventCountBeforeInvalid);
  });

  await check('selected member visibility requires participant', async () => {
    await assert.rejects(() => store.createEvent({
      title: 'Katılımcısız Seçili Etkinlik',
      startAt: '2026-09-01T10:00:00.000Z',
      visibility: 'selected_members',
      participantPersonIds: [],
      aiProcessingAllowed: false
    }), /CORE-VALIDATION-001/);
  });

  await check('invalid date and oversized notes are rejected', async () => {
    await assert.rejects(() => store.createEvent({
      title: 'Tarih Hatası',
      startAt: 'geçersiz-tarih',
      visibility: 'family',
      participantPersonIds: [],
      aiProcessingAllowed: false
    }), /CORE-VALIDATION-001/);
    await assert.rejects(() => store.createEvent({
      title: 'Not Hatası',
      startAt: '2026-09-01T10:00:00.000Z',
      visibility: 'family',
      participantPersonIds: [],
      notes: 'x'.repeat(8_001),
      aiProcessingAllowed: false
    }), /CORE-VALIDATION-001/);
  });

  await check('unknown important day detail fails closed before resource disclosure', async () => {
    await assert.rejects(() => store.getImportantDayDetails('missing-event'), /PERMISSION-DENIED-001/);
  });

  store.close();
  store = undefined;

  const probe = new DatabaseSync(databasePath, { readOnly: true });
  try {
    await check('important day transaction contains event audit and outbox', () => {
      for (const event of [first, second]) {
        const outbox = probe.prepare(`
          SELECT id,status FROM event_outbox
          WHERE event_type='timeline.important_day.created' AND aggregate_id=?
        `).get(event.id);
        assert.ok(outbox);
        assert.equal(outbox.status, 'published');
        assert.equal(Number(probe.prepare(`
          SELECT COUNT(*) count FROM event_handler_receipts
          WHERE event_id=? AND outcome='success'
        `).get(outbox.id).count), 2);
        assert.equal(Number(probe.prepare(`
          SELECT COUNT(*) count FROM audit_log
          WHERE action='event.created' AND resource_id=?
        `).get(event.id).count), 1);
      }
    });
    await check('diagnostic projection exists once per important day event', () => {
      assert.equal(Number(probe.prepare(`
        SELECT COUNT(*) count FROM diagnostic_entries
        WHERE code='timeline.important_day.created'
      `).get().count), 2);
    });
    await check('rejected commands leave no extra event outbox record', () => {
      assert.equal(Number(probe.prepare(`
        SELECT COUNT(*) count FROM event_outbox
        WHERE event_type='timeline.important_day.created'
      `).get().count), 2);
    });
  } finally {
    probe.close();
  }

  const applicationPackage = JSON.parse(readFileSync(new URL('../packages/application/package.json', import.meta.url), 'utf8'));
  const timelineUseCases = readFileSync(new URL('../packages/application/src/timeline-use-cases.ts', import.meta.url), 'utf8');
  const dataStoreSource = readFileSync(new URL('../apps/desktop/src/main/data-store.ts', import.meta.url), 'utf8');
  await check('timeline application layer has no SQLite dependency', () => {
    assert.equal(applicationPackage.dependencies['@ppt/repositories'], undefined);
    assert.equal(timelineUseCases.includes('node:sqlite'), false);
    assert.equal(timelineUseCases.includes('@ppt/repositories'), false);
  });
  await check('FamilyDataStore delegates timeline operations to application use cases', () => {
    assert.ok(dataStoreSource.includes('this.#getTimelineReadModelUseCase.execute'));
    assert.ok(dataStoreSource.includes('this.#getImportantDayDetailsUseCase.execute'));
    assert.ok(dataStoreSource.includes('this.#createImportantDayUseCase.execute'));
    const snapshotBlock = dataStoreSource.slice(
      dataStoreSource.indexOf('public async getSnapshot()'),
      dataStoreSource.indexOf('public createMember(', dataStoreSource.indexOf('public async getSnapshot()'))
    );
    assert.equal(snapshotBlock.includes('FROM events'), false);
    assert.equal(snapshotBlock.includes('FROM locations'), false);
    const createBlock = dataStoreSource.slice(
      dataStoreSource.indexOf('public async createEvent('),
      dataStoreSource.indexOf('public exportBackup(', dataStoreSource.indexOf('public async createEvent('))
    );
    assert.equal(createBlock.includes('INSERT INTO events'), false);
    assert.equal(createBlock.includes('BEGIN IMMEDIATE'), false);
  });

  const report = {
    schemaVersion: 1,
    product: 'Panthera pardus tulliana',
    version: ACTIVE_BUILD_META.applicationVersion,
    milestone: ACTIVE_BUILD_META.milestone,
    status: 'passed',
    checks: checks.length,
    scenarios: checks,
    timelineRepositoryActive: true,
    importantDayDetailsActive: true,
    participantValidationActive: true,
    aiPermissionPreserved: true,
    transactionalOutboxActive: true,
    generatedAt: new Date().toISOString()
  };
  mkdirSync('artifacts/manifests', { recursive: true });
  writeFileSync(
    'artifacts/manifests/TIMELINE_USE_CASE_VERIFICATION_MVP56.json',
    JSON.stringify(report, null, 2) + '\n'
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  store?.close();
  rmSync(directory, { recursive: true, force: true });
}
