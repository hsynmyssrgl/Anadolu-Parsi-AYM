import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { createNavigationState, navigationReducer } from '../.tmp/navigation/navigation.js';
import { FixedClock, asIsoDateTime } from '../packages/core/dist/index.js';
import { createArchivePolicyTestOptions } from './lib/archive-policy-test-harness.mjs';

const directory = mkdtempSync(join(tmpdir(), 'panthera-mvp49-dashboard-'));
const databasePath = join(directory, 'family.db');
const checks = [];
const check = async (name, operation) => { await operation(); checks.push(name); };
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
    displayName: 'Dashboard Test Admin',
    email: 'dashboard@example.com',
    password: 'GucluDashboardParolasi!2026'
  });

  const ownerPersonId = (await store.getSnapshot()).people[0].id;
  const governedLocation = (await store.createLocation({
    label: 'Dashboard Governed Konum',
    address: 'Ankara',
    kind: 'residence'
  })).location;
  assert.ok(governedLocation);
  const initial = await store.getDashboardOverview();
  await check('dashboard family identity is authoritative', () => {
    assert.equal(initial.family.id, 'family-main');
    assert.equal(initial.family.name, 'Ailem');
  });
  await check('member and generation metrics are query-backed', () => {
    assert.equal(initial.memberCount, 1);
    assert.equal(initial.generationCount, 1);
  });
  await check('fresh governed dashboard starts without synthetic important days', () => {
    assert.equal(initial.upcomingImportantDayCount, 0);
    assert.equal(initial.nextImportantDayInDays, undefined);
    assert.ok(initial.upcomingImportantDays.length <= 6);
    assert.deepEqual(initial.upcomingImportantDays, []);
  });
  await check('timeline and related content totals are centralized', () => {
    assert.equal(initial.timelineEventCount, 0);
    assert.equal(initial.relatedContentCount, 0);
    assert.equal(initial.recentEvents.length, 0);
  });
  await check('all planned modules have status records', () => {
    assert.equal(initial.modules.length, 15);
    assert.equal(new Set(initial.modules.map((module) => module.id)).size, 15);
    assert.ok(initial.modules.some((module) => module.id === 'family' && module.state === 'ready'));
    assert.ok(initial.modules.some((module) => module.id === 'archive' && module.state === 'empty'));
    assert.equal(initial.modules.find((module) => module.id === 'location')?.recordCount, 1);
  });

  const dashboardMember = store.createMember({
    displayName: 'Dashboard Yeni Üye',
    relationshipType: 'Aile üyesi',
    generation: 5,
    branch: 'Dashboard Dalı'
  });
  const dashboardMemberId = dashboardMember.person.id;
  const afterMember = await store.getDashboardOverview();
  await check('member mutation refreshes dashboard metrics', () => {
    assert.equal(afterMember.memberCount, 2);
    assert.equal(afterMember.generationCount, 2);
    assert.equal(afterMember.modules.find((module) => module.id === 'family')?.recordCount, 2);
  });

  await store.createEvent({
    title: 'Dashboard Yaklaşan Gün',
    startAt: '2026-07-25T12:00:00.000Z',
    visibility: 'family',
    participantPersonIds: [ownerPersonId],
    aiProcessingAllowed: false,
    reminderDays: [2, 1]
  });
  const afterEvent = await store.getDashboardOverview();
  await check('important day mutation refreshes dashboard calendar', () => {
    assert.equal(afterEvent.upcomingImportantDayCount, 1);
    assert.ok(afterEvent.upcomingImportantDays.some((event) => event.title === 'Dashboard Yaklaşan Gün'));
    assert.equal(afterEvent.timelineEventCount, 1);
  });

  const navigation0 = createNavigationState('dashboard');
  const navigation1 = navigationReducer(navigation0, { type: 'navigate', screen: 'family' });
  const navigation2 = navigationReducer(navigation1, { type: 'navigate', screen: 'timeline' });
  const navigation3 = navigationReducer(navigation2, { type: 'back' });
  await check('navigation reducer tracks active and previous modules', () => {
    assert.equal(navigation2.active, 'timeline');
    assert.equal(navigation2.previous, 'family');
    assert.deepEqual(navigation2.history, ['dashboard', 'family', 'timeline']);
  });
  await check('navigation back restores prior module', () => {
    assert.equal(navigation3.active, 'family');
    assert.equal(navigation3.previous, 'timeline');
  });
  await check('duplicate navigation does not grow history', () => {
    assert.equal(navigationReducer(navigation3, { type: 'navigate', screen: 'family' }), navigation3);
  });

  const applicationSource = readFileSync(new URL('../packages/application/src/dashboard-use-cases.ts', import.meta.url), 'utf8');
  const dataStoreSource = readFileSync(new URL('../apps/desktop/src/main/data-store.ts', import.meta.url), 'utf8');
  const rendererSource = readFileSync(new URL('../apps/desktop/src/renderer/App.tsx', import.meta.url), 'utf8');
  await check('dashboard application layer has no infrastructure dependency', () => {
    assert.equal(applicationSource.includes('node:sqlite'), false);
    assert.equal(applicationSource.includes('@ppt/repositories'), false);
    assert.equal(applicationSource.includes('@ppt/infrastructure'), false);
  });
  await check('FamilyDataStore delegates dashboard to application use case', () => {
    const block = dataStoreSource.slice(dataStoreSource.indexOf('public async getDashboardOverview()'), dataStoreSource.indexOf('public async getSnapshot()'));
    assert.ok(block.includes('this.#getDashboardOverviewUseCase.execute'));
    assert.equal(/SELECT\s+/i.test(block), false);
    assert.equal(block.includes('this.#database'), false);
  });
  await check('renderer consumes centralized dashboard overview', () => {
    assert.ok(rendererSource.includes('window.pardus.getDashboardOverview()'));
    assert.ok(rendererSource.includes('navigationReducer'));
    assert.ok(rendererSource.includes('overview.modules'));
  });

  const invitation = store.createInvitation({
    email: 'member-dashboard@example.com',
    role: 'adult_member',
    personId: dashboardMemberId
  });
  store.logout();
  store.acceptInvitation({
    token: invitation.token,
    displayName: 'Dashboard Üye',
    password: 'GucluDashboardUyeParolasi!2026'
  });
  const trustedDeviceFixture = new DatabaseSync(databasePath);
  try {
    trustedDeviceFixture.prepare(`
      INSERT INTO trusted_devices(
        id,account_id,device_id,display_name,fingerprint,public_key_pem,
        trusted_at,last_seen_at,security_epoch,revoked_at,created_at
      )
      SELECT 'dashboard-member-trusted-device',member.id,device.device_id,
             'Controlled dashboard verifier device',device.fingerprint,device.public_key_pem,
             device.trusted_at,device.last_seen_at,member.security_epoch,NULL,device.created_at
      FROM accounts member
      JOIN accounts administrator ON administrator.email='dashboard@example.com'
      JOIN trusted_devices device ON device.account_id=administrator.id AND device.revoked_at IS NULL
      WHERE member.email='member-dashboard@example.com'
    `).run();
  } finally {
    trustedDeviceFixture.close();
  }
  const memberOverview = await store.getDashboardOverview();
  await check('private dashboard counts are scoped to the signed-in member', () => {
    const module = (id) => memberOverview.modules.find((item) => item.id === id);
    assert.equal(module('archive')?.recordCount, 0);
    assert.equal(module('permissions')?.recordCount, 1);
    assert.ok((module('finance')?.recordCount ?? 0) <= (afterEvent.modules.find((item) => item.id === 'finance')?.recordCount ?? 0));
    assert.ok((module('health')?.recordCount ?? 0) <= (afterEvent.modules.find((item) => item.id === 'health')?.recordCount ?? 0));
    assert.ok((module('life-center')?.recordCount ?? 0) <= (afterEvent.modules.find((item) => item.id === 'life-center')?.recordCount ?? 0));
    assert.equal(module('location')?.recordCount, 0);
  });

  const report = {
    schemaVersion: 1,
    status: 'passed',
    version: ACTIVE_BUILD_META.applicationVersion,
    milestone: ACTIVE_BUILD_META.milestone,
    checks: checks.length,
    checkNames: checks,
    metrics: {
      initialMembers: initial.memberCount,
      initialGenerations: initial.generationCount,
      initialUpcomingImportantDays: initial.upcomingImportantDayCount,
      initialTimelineEvents: initial.timelineEventCount,
      initialRelatedContent: initial.relatedContentCount,
      moduleStatusCount: initial.modules.length,
      finalMembers: afterEvent.memberCount,
      finalUpcomingImportantDays: afterEvent.upcomingImportantDayCount,
      finalTimelineEvents: afterEvent.timelineEventCount,
      memberVisibleArchiveCount: memberOverview.modules.find((module) => module.id === 'archive')?.recordCount ?? 0
    },
    verifiedAt: new Date().toISOString()
  };
  mkdirSync('artifacts/manifests', { recursive: true });
  writeFileSync('artifacts/manifests/DASHBOARD_OVERVIEW_VERIFICATION_MVP56.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  store?.close();
  rmSync(directory, { recursive: true, force: true });
}
