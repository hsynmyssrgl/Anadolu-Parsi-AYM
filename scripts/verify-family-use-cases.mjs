import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { createArchivePolicyTestOptions } from './lib/archive-policy-test-harness.mjs';

const directory = mkdtempSync(join(tmpdir(), 'panthera-mvp47-family-use-cases-'));
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
    ...createArchivePolicyTestOptions()
  });
  store.setupAdmin({
    displayName: 'Aile Use Case Test',
    email: 'family-use-case@example.com',
    password: 'GucluAileUseCaseParolasi123!'
  });

  const initial = await store.getSnapshot();
  const referencePersonId = initial.people[0].id;
  await check('family graph query returns seeded family', () => {
    assert.equal(initial.family.id, 'family-main');
    assert.equal(initial.people.length, 1);
    assert.equal(initial.relations.length, 0);
    assert.equal(initial.people[0].generation, 1);
  });

  const memberMutation = store.createMember({
    displayName: 'Use Case Üyesi',
    birthDate: '1990-10-12',
    relationshipType: 'Kuzen',
    generation: 4,
    branch: 'Use Case Dalı'
  });
  const createdMember = memberMutation.person;
  await check('create member use case writes person', async () => {
    assert.ok(createdMember);
    assert.equal((await store.getSnapshot()).people.length, 2);
    assert.equal(createdMember.branch, 'Use Case Dalı');
  });

  const memberDispatch = await store.dispatchPendingEvents();
  await check('member event is published by registered handlers', () => {
    assert.equal(memberDispatch.claimed, 1);
    assert.equal(memberDispatch.published, 1);
    assert.equal(memberDispatch.successfulHandlers, 2);
  });

  const relationMutation = store.createRelation({
    fromPersonId: createdMember.id,
    toPersonId: referencePersonId,
    relationType: 'other'
  });
  const createdRelation = relationMutation.relation;
  await check('create relation use case writes relation', async () => {
    assert.ok(createdRelation);
    assert.equal((await store.getSnapshot()).relations.length, 1);
  });

  const relationDispatch = await store.dispatchPendingEvents();
  await check('relation event is published by registered handlers', () => {
    assert.equal(relationDispatch.claimed, 1);
    assert.equal(relationDispatch.published, 1);
    assert.equal(relationDispatch.successfulHandlers, 2);
  });

  await check('duplicate relation is rejected without partial write', async () => {
    assert.throws(() => store.createRelation({
      fromPersonId: createdMember.id,
      toPersonId: referencePersonId,
      relationType: 'other'
    }), /RESOURCE-CONFLICT-001/);
    assert.equal((await store.getSnapshot()).relations.length, 1);
  });

  await check('self relation is rejected', () => {
    assert.throws(() => store.createRelation({
      fromPersonId: createdMember.id,
      toPersonId: createdMember.id,
      relationType: 'other'
    }), /CORE-VALIDATION-001/);
  });

  await check('unknown member relation is rejected', () => {
    assert.throws(() => store.createRelation({
      fromPersonId: createdMember.id,
      toPersonId: 'missing-person',
      relationType: 'other'
    }), /RESOURCE-NOT-FOUND-001/);
  });

  const peopleBeforeInvalid = (await store.getSnapshot()).people.length;
  await check('invalid member is rejected before transaction', async () => {
    assert.throws(() => store.createMember({
      displayName: 'X',
      birthDate: '2026-02-31',
      relationshipType: 'Test',
      generation: 0
    }), /CORE-VALIDATION-001/);
    assert.equal((await store.getSnapshot()).people.length, peopleBeforeInvalid);
  });

  store.close();
  store = undefined;

  const probe = new DatabaseSync(databasePath, { readOnly: true });
  try {
    await check('member transaction contains audit and outbox', () => {
      const memberEvent = probe.prepare("SELECT id,status FROM event_outbox WHERE event_type='family.member.created'").get();
      assert.equal(memberEvent.status, 'published');
      assert.equal(Number(probe.prepare("SELECT COUNT(*) count FROM event_handler_receipts WHERE event_id=? AND outcome='success'").get(memberEvent.id).count), 2);
      assert.equal(Number(probe.prepare("SELECT COUNT(*) count FROM audit_log WHERE action='member.created' AND resource_id=?").get(createdMember.id).count), 1);
    });
    await check('relation transaction contains audit and outbox', () => {
      const relationEvent = probe.prepare("SELECT id,status,aggregate_id FROM event_outbox WHERE event_type='family.relation.created'").get();
      assert.equal(relationEvent.status, 'published');
      assert.equal(relationEvent.aggregate_id, createdRelation.id);
      assert.equal(Number(probe.prepare("SELECT COUNT(*) count FROM event_handler_receipts WHERE event_id=? AND outcome='success'").get(relationEvent.id).count), 2);
      assert.equal(Number(probe.prepare("SELECT COUNT(*) count FROM audit_log WHERE action='relation.created' AND resource_id=?").get(createdRelation.id).count), 1);
      assert.equal(Number(probe.prepare("SELECT COUNT(*) count FROM diagnostic_entries WHERE code='family.relation.created'").get().count), 1);
    });
    await check('rejected commands leave no extra outbox events', () => {
      assert.equal(Number(probe.prepare("SELECT COUNT(*) count FROM event_outbox WHERE event_type='family.relation.created'").get().count), 1);
      assert.equal(Number(probe.prepare("SELECT COUNT(*) count FROM event_outbox WHERE event_type='family.member.created'").get().count), 1);
    });
  } finally {
    probe.close();
  }

  const applicationPackage = JSON.parse(readFileSync(new URL('../packages/application/package.json', import.meta.url), 'utf8'));
  const applicationService = readFileSync(new URL('../packages/application/src/family-use-cases.ts', import.meta.url), 'utf8');
  const dataStoreSource = readFileSync(new URL('../apps/desktop/src/main/data-store.ts', import.meta.url), 'utf8');
  await check('application package has no infrastructure dependency', () => {
    assert.equal(applicationPackage.dependencies['@ppt/infrastructure'], undefined);
    assert.equal(applicationService.includes('node:sqlite'), false);
    assert.equal(applicationService.includes('@ppt/repositories'), false);
  });
  await check('FamilyDataStore delegates core family commands to use cases', () => {
    assert.ok(dataStoreSource.includes('this.#createFamilyMemberUseCase.execute'));
    assert.ok(dataStoreSource.includes('this.#createFamilyRelationUseCase.execute'));
    assert.ok(dataStoreSource.includes('this.#getFamilyGraphUseCase.execute'));
  });

  const report = {
    status: 'passed',
    version: ACTIVE_BUILD_META.applicationVersion,
    milestone: ACTIVE_BUILD_META.milestone,
    checks: checks.length,
    scenarios: checks
  };
  mkdirSync('artifacts/manifests', { recursive: true });
  writeFileSync('artifacts/manifests/FAMILY_USE_CASE_VERIFICATION_MVP56.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  store?.close();
  rmSync(directory, { recursive: true, force: true });
}
