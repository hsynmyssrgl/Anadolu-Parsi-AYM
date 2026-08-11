import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { calculateGenealogyGenerations } from '../packages/application/dist/genealogy-use-cases.js';
import { createArchivePolicyTestOptions } from './lib/archive-policy-test-harness.mjs';

const directory = mkdtempSync(join(tmpdir(), 'panthera-mvp47-genealogy-'));
const checks = [];
const check = async (name, operation) => {
  await operation();
  checks.push(name);
};

let store;
try {
  store = new FamilyDataStore({
    databasePath: join(directory, 'family.db'),
    applicationVersion: ACTIVE_BUILD_META.applicationVersion,
    migrationBackupDirectory: join(directory, 'migration-backups'),
    ...createArchivePolicyTestOptions()
  });
  store.setupAdmin({
    displayName: 'Genealogy Test Admin',
    email: 'genealogy@example.com',
    password: 'GucluGenealogyParolasi!2026'
  });

  const rootPersonId = (await store.getSnapshot()).people[0].id;
  const generation2Id = store.createMember({
    displayName: 'İkinci Nesil', birthDate: '1970-01-01', relationshipType: 'Çocuk', generation: 2, branch: 'Test Dalı'
  }).person.id;
  const generation3Id = store.createMember({
    displayName: 'Üçüncü Nesil', birthDate: '1995-01-01', relationshipType: 'Çocuk', generation: 3, branch: 'Test Dalı'
  }).person.id;
  const generation4Id = store.createMember({
    displayName: 'Dördüncü Nesil', birthDate: '2015-01-01', relationshipType: 'Çocuk', generation: 4, branch: 'Test Dalı'
  }).person.id;
  store.createRelation({ fromPersonId: rootPersonId, toPersonId: generation2Id, relationType: 'parent' });
  store.createRelation({ fromPersonId: generation2Id, toPersonId: generation3Id, relationType: 'parent' });
  store.createRelation({ fromPersonId: generation3Id, toPersonId: generation4Id, relationType: 'parent' });

  await check('explicit governed genealogy read model', () => {
    const insight = store.getGenealogyInsights();
    assert.equal(insight.generations, 4);
    assert.equal(insight.integrity?.normalizedParentLinkCount, 3);
    assert.deepEqual(insight.integrity?.cyclePersonIds, []);
    assert.deepEqual(insight.integrity?.brokenRelationIds, []);
    assert.ok(insight.timeline.some((item) => item.kind === 'birth'));
  });

  const memberMutation = store.createMember({
    displayName: 'Nesil Hesaplama Çocuğu',
    birthDate: '2020-01-02',
    relationshipType: 'Çocuk',
    generation: 1,
    branch: 'Test Dalı'
  });
  const newPersonId = memberMutation.person?.id;
  assert.ok(newPersonId);
  store.createRelation({
    fromPersonId: generation3Id,
    toPersonId: newPersonId,
    relationType: 'parent'
  });

  await check('calculated-generation-applied-to-tree', async () => {
    const snapshot = await store.getSnapshot();
    const person = snapshot.people.find((item) => item.id === newPersonId);
    assert.ok(person);
    assert.equal(person.generation, 4);
  });

  await check('parent-link-removes-missing-link', () => {
    const insight = store.getGenealogyInsights();
    assert.equal(insight.integrity?.calculatedGenerationCount, 5);
    assert.ok(!insight.missingParentLinks.includes('Nesil Hesaplama Çocuğu'));
    assert.ok(insight.timeline.some((item) => item.id === `birth-${newPersonId}`));
  });

  await check('cycle-is-detected-without-unbounded-generation', () => {
    const analysis = calculateGenealogyGenerations({
      people: [
        { id: 'a', generation: 1 },
        { id: 'b', generation: 2 },
        { id: 'c', generation: 3 }
      ],
      relations: [
        { id: 'r1', fromPersonId: 'a', toPersonId: 'b', relationType: 'parent' },
        { id: 'r2', fromPersonId: 'b', toPersonId: 'c', relationType: 'parent' },
        { id: 'r3', fromPersonId: 'c', toPersonId: 'a', relationType: 'parent' }
      ]
    });
    assert.deepEqual(analysis.cyclePersonIds, ['a', 'b', 'c']);
    assert.equal(analysis.normalizedParentLinkCount, 0);
    assert.equal(analysis.generationByPersonId.get('c'), 3);
  });

  await check('broken-relations-are-ignored-and-reported', () => {
    const analysis = calculateGenealogyGenerations({
      people: [{ id: 'known', generation: 1 }],
      relations: [{ id: 'broken', fromPersonId: 'known', toPersonId: 'missing', relationType: 'parent' }]
    });
    assert.deepEqual(analysis.brokenRelationIds, ['broken']);
    assert.equal(analysis.normalizedParentLinkCount, 0);
  });

  await check('child-relation-is-normalized-to-parent-edge', () => {
    const analysis = calculateGenealogyGenerations({
      people: [
        { id: 'parent', generation: 2 },
        { id: 'child', generation: 1 }
      ],
      relations: [{ id: 'child-link', fromPersonId: 'child', toPersonId: 'parent', relationType: 'child' }]
    });
    assert.equal(analysis.generationByPersonId.get('child'), 3);
    assert.ok(analysis.parentedPersonIds.has('child'));
  });

  const report = {
    schemaVersion: 1,
    product: 'Panthera pardus tulliana',
    version: ACTIVE_BUILD_META.applicationVersion,
    milestone: ACTIVE_BUILD_META.milestone,
    status: 'passed',
    checks: checks.length,
    scenarios: checks,
    cycleSafe: true,
    brokenRelationSafe: true,
    generationCalculationActive: true,
    generatedAt: new Date().toISOString()
  };
  mkdirSync('artifacts/manifests', { recursive: true });
  writeFileSync('artifacts/manifests/GENEALOGY_READ_MODEL_VERIFICATION_MVP56.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  store?.close();
  rmSync(directory, { recursive: true, force: true });
}
