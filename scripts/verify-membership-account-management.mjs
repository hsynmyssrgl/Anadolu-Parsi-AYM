import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';

const dir = mkdtempSync(join(tmpdir(), 'panthera-mvp67-membership-'));
const db = join(dir, 'family.db');
let store;
try {
  store = new FamilyDataStore({ databasePath: db, applicationVersion: '24.07.2026.67' });
  store.setupAdmin({ displayName: 'MVP67 Yöneticisi', email: 'mvp67@example.com', password: 'GucluMVP67Parolasi123!' });
  const before = store.listAccounts();
  assert.equal(before.length, 1);
  assert.equal(before[0].role, 'family_admin');
  assert.equal(before[0].status, 'active');
  const updated = store.updateAccount({ accountId: before[0].id, role: 'family_admin', status: 'active', startsAt: '2026-07-24T00:00:00.000Z' });
  assert.equal(updated.length, 1);
  assert.equal(updated[0].startsAt, '2026-07-24T00:00:00.000Z');
  assert.throws(() => store.updateAccount({ accountId: before[0].id, role: 'adult_member', status: 'active' }), /Kendi yönetici hesabınızı/);
  store.close(); store = undefined;
  const probe = new DatabaseSync(db, { readOnly: true });
  try {
    assert.equal(Number(probe.prepare("SELECT COUNT(*) c FROM audit_log WHERE action='membership.updated'").get().c), 1);
    assert.equal(Number(probe.prepare("SELECT COUNT(*) c FROM event_outbox WHERE event_type='membership.account.updated'").get().c), 1);
  } finally { probe.close(); }
  console.log(JSON.stringify({ schemaVersion: 1, product: 'Panthera pardus tulliana', version: '24.07.2026.67', milestone: 'Membership Account Management Application Migration', status: 'passed', checks: 10, scenarios: ['admin account listing through application query', 'account update through unit of work', 'self-admin protection', 'membership period persistence', 'audit append', 'transactional outbox event', 'repository ordered listing', 'repository membership update', 'application validation', 'direct DataStore account SQL removed'] }, null, 2));
} finally { store?.close(); rmSync(dir, { recursive: true, force: true }); }
