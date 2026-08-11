import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { asCorrelationId, asIsoDateTime, asPersonId, asUserId } from '@ppt/core';
import type { RepositoryTransaction } from '@ppt/contracts';
import {
  PlatformPolicyEnforcementPoint,
  PlatformPolicyKernel,
  type PlatformPolicyTransactionContext
} from '@ppt/platform-policy';
import type {
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext
} from '@ppt/repository-contracts';
import { SqliteHealthRepository } from '@ppt/repositories';

const NOW = '2026-08-08T01:00:00.000Z';
const ACCOUNT_ID = 'account-row-visibility';
const ACTOR_PERSON_ID = 'person-2';
const FAMILY_ID = 'family-main';
const databases: DatabaseSync[] = [];

const kernel = new PlatformPolicyKernel({
  policyVersion: '30-x-health-row-visibility-v1',
  signingKey: Buffer.from('30-x-health-row-visibility-controlled-test-key', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['health.read'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

const schema = `
  CREATE TABLE health_records(
    id TEXT PRIMARY KEY,family_id TEXT NOT NULL,owner_person_id TEXT NOT NULL,
    title TEXT NOT NULL,kind TEXT NOT NULL,privacy TEXT NOT NULL,provider TEXT,notes TEXT,
    occurred_at TEXT NOT NULL,created_at TEXT NOT NULL
  );
  CREATE TABLE medication_plans(
    id TEXT PRIMARY KEY,family_id TEXT NOT NULL,owner_person_id TEXT NOT NULL,
    name TEXT NOT NULL,dosage TEXT NOT NULL,schedule TEXT NOT NULL,provider TEXT,
    starts_at TEXT NOT NULL,ends_at TEXT,privacy TEXT NOT NULL,notes TEXT,created_at TEXT NOT NULL
  );
  CREATE TABLE family_health_history(
    id TEXT PRIMARY KEY,family_id TEXT NOT NULL,related_person_id TEXT NOT NULL,
    condition TEXT NOT NULL,relationship_note TEXT,diagnosed_at TEXT,privacy TEXT NOT NULL,
    notes TEXT,created_at TEXT NOT NULL
  );
  CREATE TABLE data_lifecycle(
    resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,owner_person_id TEXT,
    privacy TEXT,state TEXT NOT NULL,updated_at TEXT NOT NULL,
    PRIMARY KEY(resource_type,resource_id)
  );
  CREATE TABLE object_permissions(
    id TEXT PRIMARY KEY,subject_account_id TEXT NOT NULL,resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,actions TEXT NOT NULL,effect TEXT NOT NULL,
    purpose TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT
  );
`;

const database = (): DatabaseSync => {
  const value = new DatabaseSync(':memory:');
  value.exec(schema);
  databases.push(value);
  return value;
};

const addLifecycle = (
  db: DatabaseSync,
  resourceType: string,
  resourceId: string,
  ownerPersonId: string,
  privacy: string,
  state = 'active'
): void => {
  db.prepare('INSERT INTO data_lifecycle VALUES(?,?,?,?,?,?)').run(
    resourceType, resourceId, ownerPersonId, privacy, state, NOW
  );
};

const addHealthRecord = (
  db: DatabaseSync,
  id: string,
  ownerPersonId: string,
  privacy: string,
  familyId = FAMILY_ID,
  state = 'active'
): void => {
  db.prepare('INSERT INTO health_records VALUES(?,?,?,?,?,?,?,?,?,?)').run(
    id, familyId, ownerPersonId, id, 'appointment', privacy, null, null, NOW, NOW
  );
  addLifecycle(db, 'health_record', id, ownerPersonId, privacy, state);
};

const addMedicationPlan = (
  db: DatabaseSync,
  id: string,
  ownerPersonId: string,
  privacy: string
): void => {
  db.prepare('INSERT INTO medication_plans VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(
    id, FAMILY_ID, ownerPersonId, id, '1 tablet', 'daily', null, NOW, null, privacy, null, NOW
  );
  addLifecycle(db, 'medication_plan', id, ownerPersonId, privacy);
};

const addFamilyHistory = (
  db: DatabaseSync,
  id: string,
  ownerPersonId: string,
  privacy: string
): void => {
  db.prepare('INSERT INTO family_health_history VALUES(?,?,?,?,?,?,?,?,?)').run(
    id, FAMILY_ID, ownerPersonId, id, null, null, privacy, null, NOW
  );
  addLifecycle(db, 'family_health_history', id, ownerPersonId, privacy);
};

const addGrant = (db: DatabaseSync, input: {
  readonly id: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly actions?: readonly string[];
  readonly effect?: 'allow' | 'deny';
  readonly purpose?: string;
  readonly startsAt?: string;
  readonly endsAt?: string;
}): void => {
  db.prepare('INSERT INTO object_permissions VALUES(?,?,?,?,?,?,?,?,?)').run(
    input.id,
    ACCOUNT_ID,
    input.resourceType,
    input.resourceId,
    JSON.stringify(input.actions ?? ['read']),
    input.effect ?? 'allow',
    input.purpose ?? 'general',
    input.startsAt ?? '2026-08-08T00:00:00.000Z',
    input.endsAt ?? null
  );
};

type HealthResourceType = 'health_record' | 'medication_plan' | 'family_health_history';
type RepositoryRows = ReturnType<SqliteHealthRepository['listHealthRecords']>;

const executeRead = async (
  db: DatabaseSync,
  resourceType: HealthResourceType,
  role: string,
  operation: (
    repository: SqliteHealthRepository,
    context: PolicyAuthorizedRepositoryExecutionContext
  ) => RepositoryRows
): Promise<RepositoryRows> => {
  const correlationId = `visibility-${resourceType}-${role}-${Math.random()}`;
  const pep = new PlatformPolicyEnforcementPoint({
    kernel,
    authorityResolver: {
      resolve: () => ({
        policyVersion: '30-x-health-row-visibility-v1',
        accountId: ACCOUNT_ID,
        personId: ACTOR_PERSON_ID,
        deviceId: 'device-row-visibility',
        applicationId: 'windows-desktop',
        deviceTrusted: true,
        membershipActive: true,
        roles: [role],
        familyIds: [FAMILY_ID],
        grants: [{
          id: `platform-${resourceType}-collection-read`,
          subjectAccountId: ACCOUNT_ID,
          resourceType,
          resourceId: '*',
          actions: ['read'],
          effect: 'allow',
          startsAt: '2026-08-08T00:00:00.000Z'
        }],
        online: true,
        expiresAt: '2026-08-08T02:00:00.000Z'
      })
    },
    resourceResolver: {
      resolve: () => ({
        type: resourceType,
        id: '*',
        familyId: FAMILY_ID,
        sensitivity: 'personal'
      })
    },
    receiptSink: { append: () => undefined },
    clock: () => NOW
  });
  return pep.execute({
    correlationId,
    action: 'read',
    capability: 'health.read',
    resourceType,
    resourceId: '*',
    purpose: 'health-care'
  }, () => ({ writable: true, epoch: 30 }), (policyAuthorization) => operation(
    new SqliteHealthRepository(),
    {
      transaction: db as unknown as RepositoryTransaction,
      actor: {
        userId: asUserId(ACCOUNT_ID),
        roles: [role],
        personId: asPersonId(ACTOR_PERSON_ID)
      },
      correlationId: asCorrelationId(correlationId),
      occurredAt: asIsoDateTime(NOW),
      policyAuthorization
    }
  ));
};

const ids = (result: RepositoryRows): readonly string[] => {
  expect(result.ok).toBe(true);
  if (!result.ok) return [];
  return result.value.map((row) => row.id).sort();
};

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

describe('30-X health repository row visibility', () => {
  it('enforces lifecycle, family, privacy, role, grants, time, action and deny precedence in SQL', async () => {
    const db = database();

    addHealthRecord(db, 'health-owner', ACTOR_PERSON_ID, 'private');
    addHealthRecord(db, 'health-private', 'person-1', 'private');
    addHealthRecord(db, 'health-selected-allowed', 'person-1', 'selected_members');
    addHealthRecord(db, 'health-family', 'person-1', 'family');
    addHealthRecord(db, 'health-family-denied', 'person-1', 'family');
    addHealthRecord(db, 'health-create-only', 'person-1', 'private');
    addHealthRecord(db, 'health-expired-allow', 'person-1', 'private');
    addHealthRecord(db, 'health-health-purpose', 'person-1', 'private');
    addHealthRecord(db, 'health-inactive-owner', ACTOR_PERSON_ID, 'private', FAMILY_ID, 'archived');
    addHealthRecord(db, 'health-cross-family', 'person-1', 'family', 'family-other');
    addGrant(db, {
      id: 'allow-health-selected', resourceType: 'health_record',
      resourceId: 'health-selected-allowed'
    });
    addGrant(db, {
      id: 'deny-health-family', resourceType: 'health_record',
      resourceId: 'health-family-denied', effect: 'deny'
    });
    addGrant(db, {
      id: 'allow-health-create-only', resourceType: 'health_record',
      resourceId: 'health-create-only', actions: ['create']
    });
    addGrant(db, {
      id: 'allow-health-expired', resourceType: 'health_record',
      resourceId: 'health-expired-allow', endsAt: '2026-08-08T00:30:00.000Z'
    });
    addGrant(db, {
      id: 'allow-health-purpose', resourceType: 'health_record',
      resourceId: 'health-health-purpose', purpose: 'health'
    });

    const adultHealth = await executeRead(db, 'health_record', 'adult_member', (repository, context) => (
      repository.listHealthRecords(context)
    ));
    expect(ids(adultHealth)).toEqual([
      'health-family', 'health-owner', 'health-selected-allowed'
    ]);

    const limitedHealth = await executeRead(db, 'health_record', 'limited_member', (repository, context) => (
      repository.listHealthRecords(context)
    ));
    expect(ids(limitedHealth)).toEqual(['health-owner', 'health-selected-allowed']);

    const caregiverHealth = await executeRead(db, 'health_record', 'caregiver', (repository, context) => (
      repository.listHealthRecords(context)
    ));
    expect(ids(caregiverHealth)).toContain('health-family');

    addMedicationPlan(db, 'medication-owner', ACTOR_PERSON_ID, 'private');
    addMedicationPlan(db, 'medication-private', 'person-1', 'private');
    addMedicationPlan(db, 'medication-family', 'person-1', 'family');
    addGrant(db, {
      id: 'allow-medication-wildcard', resourceType: 'medication_plan', resourceId: '*'
    });
    const allowedMedication = await executeRead(db, 'medication_plan', 'adult_member', (repository, context) => (
      repository.listMedicationPlans(context) as RepositoryRows
    ));
    expect(ids(allowedMedication)).toEqual([
      'medication-family', 'medication-owner', 'medication-private'
    ]);

    addGrant(db, {
      id: 'deny-medication-wildcard', resourceType: 'medication_plan', resourceId: '*', effect: 'deny'
    });
    const deniedMedication = await executeRead(db, 'medication_plan', 'adult_member', (repository, context) => (
      repository.listMedicationPlans(context) as RepositoryRows
    ));
    expect(ids(deniedMedication)).toEqual([]);

    addFamilyHistory(db, 'history-owner', ACTOR_PERSON_ID, 'private');
    addFamilyHistory(db, 'history-private-allowed', 'person-1', 'selected_members');
    addFamilyHistory(db, 'history-family', 'person-1', 'family');
    addFamilyHistory(db, 'history-owner-denied', ACTOR_PERSON_ID, 'private');
    addGrant(db, {
      id: 'allow-history-private', resourceType: 'family_health_history',
      resourceId: 'history-private-allowed'
    });
    addGrant(db, {
      id: 'deny-history-owner', resourceType: 'family_health_history',
      resourceId: 'history-owner-denied', effect: 'deny'
    });
    const history = await executeRead(db, 'family_health_history', 'family_admin', (repository, context) => (
      repository.listFamilyHealthHistory(context) as RepositoryRows
    ));
    expect(ids(history)).toEqual(['history-family', 'history-owner', 'history-private-allowed']);
  });

  it('rejects ordinary, forged and receipt-subject-mismatched repository contexts before SQL', async () => {
    const db = database();
    const repository = new SqliteHealthRepository();
    const ordinary = {
      transaction: db as unknown as RepositoryTransaction,
      actor: { userId: asUserId(ACCOUNT_ID), roles: ['adult_member'], personId: asPersonId(ACTOR_PERSON_ID) },
      correlationId: asCorrelationId('ordinary-health-row-visibility'),
      occurredAt: asIsoDateTime(NOW)
    } satisfies RepositoryExecutionContext;
    const forged = {
      ...ordinary,
      correlationId: asCorrelationId('forged-health-row-visibility'),
      policyAuthorization: Object.freeze({})
    } as unknown as PolicyAuthorizedRepositoryExecutionContext;

    expect(() => repository.listHealthRecords(ordinary as PolicyAuthorizedRepositoryExecutionContext)).toThrow(/forged|transaction context/i);
    expect(() => repository.listMedicationPlans(forged)).toThrow(/forged|transaction context/i);
    expect(() => repository.listFamilyHealthHistory(forged)).toThrow(/forged|transaction context/i);

    await executeRead(db, 'health_record', 'adult_member', (governedRepository, context) => {
      const mismatched = {
        ...context,
        actor: { ...context.actor, userId: asUserId('another-account') }
      } as PolicyAuthorizedRepositoryExecutionContext;
      expect(() => governedRepository.listHealthRecords(mismatched)).toThrow(/does not match.*receipt subject/i);
      return { ok: true, value: [] } as unknown as RepositoryRows;
    });
  });
});
