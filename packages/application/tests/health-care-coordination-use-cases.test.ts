import { describe, expect, it } from 'vitest';
import {
  asCorrelationId,
  asEventId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  ok
} from '@ppt/core';
import type {
  HealthCareAccessGrantRow,
  HealthCareCenterKey,
  HealthCareCenterRow,
  HealthCareEntryRow,
  HealthCareMutationRow,
  ObjectPermissionRow
} from '@ppt/repository-contracts';
import {
  RecordHealthCareEntryUseCase,
  RevokeHealthCareAccessGrantUseCase,
  UpsertHealthCareAccessGrantUseCase,
  type HealthApplicationContext,
  type HealthCareCoordinationUnitOfWork,
  type HealthCareCoordinationWriteScope,
  type HealthPolicyIntent
} from '../src/index.js';

const NOW = asIsoDateTime('2026-08-15T12:00:00.000Z');
const FAMILY = asFamilyId('family-33-s');
const OWNER_ACCOUNT = asUserId('account-33-s-owner');
const OWNER_PERSON = asPersonId('person-33-s-owner');
const CAREGIVER_ACCOUNT = asUserId('account-33-s-caregiver');
const CAREGIVER_PERSON = asPersonId('person-33-s-caregiver');
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

const ownerContext: HealthApplicationContext = Object.freeze({
  familyId: FAMILY,
  actor: { userId: OWNER_ACCOUNT, personId: OWNER_PERSON, role: 'family_admin' },
  correlationId: asCorrelationId('health-care-33-s-owner')
});

const caregiverContext: HealthApplicationContext = Object.freeze({
  familyId: FAMILY,
  actor: { userId: CAREGIVER_ACCOUNT, personId: CAREGIVER_PERSON, role: 'caregiver' },
  correlationId: asCorrelationId('health-care-33-s-caregiver')
});

class Unit implements HealthCareCoordinationUnitOfWork {
  public center: HealthCareCenterRow | null = null;
  public readonly mutations = new Map<string, HealthCareMutationRow>();
  public readonly entries: HealthCareEntryRow[] = [];
  public readonly grants = new Map<string, HealthCareAccessGrantRow>();
  public readonly permissions = new Map<string, ObjectPermissionRow>();
  public readonly audits: unknown[] = [];
  public readonly events: unknown[] = [];
  public readonly intents: HealthPolicyIntent[] = [];

  public async execute<T>(
    _context: HealthApplicationContext,
    intent: HealthPolicyIntent,
    operation: (scope: HealthCareCoordinationWriteScope) => ReturnType<HealthCareCoordinationWriteScope['insertMutation']> | ReturnType<typeof ok<T>>
  ) {
    this.intents.push(intent);
    const scope: HealthCareCoordinationWriteScope = {
      occurredAt: NOW,
      findPerson: (personId) => ok(
        personId === OWNER_PERSON || personId === CAREGIVER_PERSON
          ? { id: personId, familyId: FAMILY, status: 'active' }
          : null
      ),
      findAccount: (accountId) => ok(
        accountId === CAREGIVER_ACCOUNT
          ? { id: CAREGIVER_ACCOUNT, personId: CAREGIVER_PERSON, role: 'caregiver', status: 'active' }
          : accountId === OWNER_ACCOUNT
            ? { id: OWNER_ACCOUNT, personId: OWNER_PERSON, role: 'family_admin', status: 'active' }
            : null
      ),
      findCenter: () => ok(this.center),
      findMutation: (_key, clientOperationId) => ok(this.mutations.get(clientOperationId) ?? null),
      insertMutation: (row) => {
        this.mutations.set(row.clientOperationId, row);
        return ok(undefined);
      },
      insertCenter: (row) => {
        this.center = row;
        return ok(undefined);
      },
      saveCenter: (row, expectedRevision) => {
        if (this.center?.revision !== expectedRevision) throw new Error('test revision mismatch');
        this.center = row;
        return ok(undefined);
      },
      insertEntry: (row) => {
        this.entries.push(row);
        return ok(undefined);
      },
      findGrant: (_key, grantId) => ok(this.grants.get(grantId) ?? null),
      findActiveGrantForActor: (key: HealthCareCenterKey) => ok(
        [...this.grants.values()].find((grant) => grant.centerId === key.centerId
          && grant.caregiverAccountId === key.accountId && grant.state === 'active') ?? null
      ),
      upsertGrant: (row) => {
        this.grants.set(row.id, row);
        return ok(undefined);
      },
      upsertPermission: (row) => {
        this.permissions.set(row.id, row);
        return ok(undefined);
      },
      appendAudit: (input) => {
        this.audits.push(input);
        return ok('audit-hash');
      },
      enqueueEvent: (event) => {
        this.events.push(event);
        return ok(undefined);
      }
    };
    return operation(scope) as Awaited<ReturnType<HealthCareCoordinationUnitOfWork['execute<T>']>>;
  }
}

const entryIds = (requestFingerprint = HASH_A) => ({
  mutationId: 'mutation-entry-33-s',
  targetId: 'entry-33-s',
  requestFingerprint,
  auditId: 'audit-entry-33-s',
  outboxEventId: asEventId('event-entry-33-s')
});

describe('33-S health care coordination use cases', () => {
  it('records owner health data once and replays the exact operation without duplicate writes', async () => {
    const unit = new Unit();
    const useCase = new RecordHealthCareEntryUseCase(unit);
    const command = {
      ownerPersonId: OWNER_PERSON,
      expectedRevision: 0,
      clientOperationId: 'operation-entry-33-s',
      kind: 'allergy' as const,
      title: 'Penisilin alerjisi',
      status: 'active' as const,
      occurredAt: NOW,
      note: 'Acil kartta görünür.'
    };

    const created = await useCase.execute({ context: ownerContext, command, identifiers: entryIds() });
    const replayed = await useCase.execute({ context: ownerContext, command, identifiers: entryIds() });

    expect(created).toMatchObject({ ok: true, value: { previousRevision: 0, revision: 1, replayed: false } });
    expect(replayed).toMatchObject({ ok: true, value: { previousRevision: 0, revision: 1, replayed: true } });
    expect(unit.entries).toHaveLength(1);
    expect(unit.entries[0]).toMatchObject({ kind: 'allergy', accessScope: 'emergency_summary', recordedBy: 'owner' });
    expect(unit.intents).toEqual([
      expect.objectContaining({ action: 'update', capability: 'health.write', resourceType: 'health_care_center', purpose: 'care' }),
      expect.objectContaining({ action: 'update', capability: 'health.write', resourceType: 'health_care_center', purpose: 'care' })
    ]);
    expect(JSON.stringify(unit.events)).not.toContain('Penisilin');
  });

  it('rejects an operation-id replay with a different fingerprint before any second write', async () => {
    const unit = new Unit();
    const useCase = new RecordHealthCareEntryUseCase(unit);
    const command = {
      ownerPersonId: OWNER_PERSON,
      expectedRevision: 0,
      clientOperationId: 'operation-entry-33-s',
      kind: 'wellbeing_check' as const,
      title: 'Günlük kontrol',
      status: 'completed' as const,
      occurredAt: NOW
    };
    expect((await useCase.execute({ context: ownerContext, command, identifiers: entryIds() })).ok).toBe(true);
    const mismatch = await useCase.execute({ context: ownerContext, command, identifiers: entryIds(HASH_B) });
    expect(mismatch).toMatchObject({ ok: false, error: { category: 'conflict' } });
    expect(unit.entries).toHaveLength(1);
  });

  it('allows caregiver recording only inside an active minimum-necessary grant scope', async () => {
    const deniedUnit = new Unit();
    const command = {
      ownerPersonId: OWNER_PERSON,
      expectedRevision: 0,
      clientOperationId: 'operation-caregiver-33-s',
      kind: 'blood_pressure' as const,
      title: 'Tansiyon ölçümü',
      status: 'observed' as const,
      occurredAt: NOW,
      measurement: { value: 125, secondaryValue: 78, unit: 'mmHg' }
    };
    const denied = await new RecordHealthCareEntryUseCase(deniedUnit).execute({
      context: caregiverContext,
      command,
      identifiers: { ...entryIds(), mutationId: 'mutation-caregiver-denied', targetId: 'entry-caregiver-denied' }
    });
    expect(denied).toMatchObject({ ok: false, error: { category: 'authorization' } });

    const allowedUnit = new Unit();
    allowedUnit.grants.set('grant-33-s', {
      id: 'grant-33-s',
      centerId: `health-care-center:${OWNER_PERSON}`,
      familyId: FAMILY,
      ownerPersonId: OWNER_PERSON,
      caregiverAccountId: CAREGIVER_ACCOUNT,
      caregiverPersonId: CAREGIVER_PERSON,
      allowedScopes: ['measurements'],
      actions: ['read', 'record'],
      state: 'active',
      startsAt: NOW,
      revision: 1,
      mutationId: 'mutation-grant-seed',
      createdAt: NOW,
      updatedAt: NOW
    });
    const allowed = await new RecordHealthCareEntryUseCase(allowedUnit).execute({
      context: caregiverContext,
      command,
      identifiers: { ...entryIds(), mutationId: 'mutation-caregiver-allowed', targetId: 'entry-caregiver-allowed' }
    });
    expect(allowed.ok).toBe(true);
    expect(allowedUnit.entries[0]).toMatchObject({ recordedBy: 'caregiver', accessScope: 'measurements' });
  });

  it('creates and revokes a caregiver grant together with the matching object permission', async () => {
    const unit = new Unit();
    const upsert = await new UpsertHealthCareAccessGrantUseCase(unit).execute({
      context: ownerContext,
      command: {
        ownerPersonId: OWNER_PERSON,
        expectedRevision: 0,
        clientOperationId: 'operation-grant-create-33-s',
        grantId: 'grant-33-s',
        caregiverAccountId: CAREGIVER_ACCOUNT,
        allowedScopes: ['appointments', 'measurements'],
        actions: ['read', 'record'],
        startsAt: NOW
      },
      identifiers: {
        mutationId: 'mutation-grant-create-33-s',
        requestFingerprint: HASH_A,
        auditId: 'audit-grant-create-33-s',
        outboxEventId: asEventId('event-grant-create-33-s')
      }
    });
    expect(upsert).toMatchObject({ ok: true, value: { revision: 1 } });
    expect(unit.permissions.get('health-care-permission:grant-33-s')).toMatchObject({
      effect: 'allow', purpose: 'care', actions: ['read', 'update', 'record']
    });

    const revoked = await new RevokeHealthCareAccessGrantUseCase(unit).execute({
      context: ownerContext,
      command: {
        ownerPersonId: OWNER_PERSON,
        expectedRevision: 1,
        clientOperationId: 'operation-grant-revoke-33-s',
        grantId: 'grant-33-s'
      },
      identifiers: {
        mutationId: 'mutation-grant-revoke-33-s',
        requestFingerprint: HASH_B,
        auditId: 'audit-grant-revoke-33-s',
        outboxEventId: asEventId('event-grant-revoke-33-s')
      }
    });
    expect(revoked).toMatchObject({ ok: true, value: { revision: 2 } });
    expect(unit.grants.get('grant-33-s')).toMatchObject({ state: 'revoked', revision: 2, revokedAt: NOW });
    expect(unit.permissions.get('health-care-permission:grant-33-s')).toMatchObject({ effect: 'deny', purpose: 'care' });
  });
});
