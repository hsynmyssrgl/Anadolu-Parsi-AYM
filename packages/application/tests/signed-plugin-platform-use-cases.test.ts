import { describe, expect, it } from 'vitest';
import {
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import type { VerifiedSignedPluginReleaseInput } from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  SignedPluginInstallationRow,
  SignedPluginMutationRow,
  SignedPluginReleaseRow
} from '@ppt/repository-contracts';
import {
  EmergencyDisableSignedPluginUseCase,
  RegisterSignedPluginReleaseUseCase,
  RollbackSignedPluginUseCase,
  SetSignedPluginDesiredStateUseCase,
  type LifeApplicationContext,
  type LifePolicyIntent,
  type SignedPluginPlatformUnitOfWork,
  type SignedPluginPlatformWriteScope
} from '../src/index.js';

const FAMILY = asFamilyId('family-33-z');
const OWNER = asPersonId('person-owner-33-z');
const context: LifeApplicationContext = {
  familyId: FAMILY,
  actor: { userId: asUserId('account-owner-33-z'), role: 'family_admin', personId: OWNER },
  correlationId: asCorrelationId('correlation-33-z')
};

const release = (version = '1.0.0'): VerifiedSignedPluginReleaseInput => ({
  pluginId: 'local.bank-reader',
  displayName: 'Yerel banka okuyucu',
  version,
  minimumHostVersion: '4.8.2026-29',
  manifestSha256: 'a'.repeat(64),
  packageSha256: 'b'.repeat(64),
  entrypointSha256: 'c'.repeat(64),
  sbomSha256: 'd'.repeat(64),
  licenseInventorySha256: 'e'.repeat(64),
  provenanceSha256: 'f'.repeat(64),
  signerKeyId: 'trusted-key-33-z',
  signatureVerified: true,
  providerKinds: ['bank'],
  capabilityCodes: ['bank.read'],
  dataDeclarations: [{
    resourceType: 'finance_record',
    sensitivity: 'highly_sensitive',
    purpose: 'finance',
    access: 'read_metadata',
    retentionDays: 0
  }],
  egressMode: 'none',
  egressHosts: [],
  sandboxProfile: 'isolated_child_process',
  filesystemAccess: 'none',
  processSpawnAllowed: false,
  nativeModulesAllowed: false,
  networkBrokerOnly: true,
  issuedAt: '2026-08-15T10:00:00.000Z',
  expiresAt: '2026-09-01T00:00:00.000Z'
});

class Scope implements SignedPluginPlatformWriteScope {
  public occurredAt = asIsoDateTime('2026-08-15T12:00:00.000Z');
  public readonly ownerPersonId = OWNER;
  public readonly installations = new Map<string, SignedPluginInstallationRow>();
  public readonly releases = new Map<string, SignedPluginReleaseRow>();
  public readonly mutations = new Map<string, SignedPluginMutationRow>();
  public storageUsageOverride?: { installationCount: number; releaseCount: number; mutationCount: number };
  public readonly audits: unknown[] = [];
  public readonly events: DomainEvent<unknown>[] = [];
  public findInstallation(id: string) { return ok(this.installations.get(id) ?? null); }
  public findRelease(pluginId: string, version: string) { return ok(this.releases.get(`${pluginId}@${version}`) ?? null); }
  public getStorageUsage(pluginId: string) { return ok(this.storageUsageOverride ?? {
    installationCount: this.installations.size,
    releaseCount: [...this.releases.values()].filter((row) => row.pluginId === pluginId).length,
    mutationCount: this.mutations.size
  }); }
  public findMutation(id: string) { return ok(this.mutations.get(id) ?? null); }
  public insertMutation(row: SignedPluginMutationRow) { this.mutations.set(row.clientOperationId, row); return ok(undefined); }
  public insertRelease(row: SignedPluginReleaseRow) { this.releases.set(`${row.pluginId}@${row.version}`, row); return ok(undefined); }
  public insertInstallation(row: SignedPluginInstallationRow) { this.installations.set(row.id, row); return ok(undefined); }
  public saveInstallation(row: SignedPluginInstallationRow, expected: number) {
    if (this.installations.get(row.id)?.revision !== expected) throw new Error('revision mismatch');
    this.installations.set(row.id, row);
    return ok(undefined);
  }
  public appendAudit(input: unknown) { this.audits.push(input); return ok('audit-33-z'); }
  public enqueueEvent<T>(event: DomainEvent<T>): Result<void, AppError> {
    this.events.push(event as DomainEvent<unknown>);
    return ok(undefined);
  }
}

class Unit implements SignedPluginPlatformUnitOfWork {
  public readonly scope = new Scope();
  public readonly intents: LifePolicyIntent[] = [];
  public execute<T>(
    _context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: SignedPluginPlatformWriteScope) => Result<T, AppError>
  ) {
    this.intents.push(intent);
    return Promise.resolve(operation(this.scope));
  }
}

const register = (unit: Unit, version = '1.0.0', expectedRevision = 0, operation = `register-${version}`) =>
  new RegisterSignedPluginReleaseUseCase(unit).execute({
    context,
    command: { clientOperationId: operation, expectedRevision, release: release(version) }
  });

describe('33-Z signed plugin platform use cases', () => {
  it('registers only verified metadata, emits content-free evidence and replays exactly', async () => {
    const unit = new Unit();
    expect(await register(unit)).toMatchObject({
      ok: true,
      value: { mutationKind: 'release_register', revision: 1, replayed: false, networkUsed: false }
    });
    expect(await register(unit)).toMatchObject({ ok: true, value: { replayed: true } });
    expect(unit.scope.installations.get('local.bank-reader')).toMatchObject({
      desiredState: 'disabled', runtimeExecutionReady: false, externalProviderConnectionReady: false
    });
    expect(unit.intents[0]).toMatchObject({ resourceType: 'signed_plugin_installation', action: 'create' });
    expect(JSON.stringify(unit.scope.events)).not.toContain('trusted-key-33-z');
    expect(JSON.stringify(unit.scope.events)).not.toContain('finance_record');
  });

  it('keeps updates disabled and rolls back only to the exact previous signed release', async () => {
    const unit = new Unit();
    await register(unit);
    expect(await register(unit, '1.1.0', 1, 'register-v2')).toMatchObject({
      ok: true, value: { mutationKind: 'release_update', revision: 2 }
    });
    expect(unit.scope.installations.get('local.bank-reader')).toMatchObject({
      currentVersion: '1.1.0', previousVersion: '1.0.0', desiredState: 'disabled'
    });
    expect(await new RollbackSignedPluginUseCase(unit).execute({ context, command: {
      clientOperationId: 'rollback-v1', pluginId: 'local.bank-reader', expectedRevision: 2,
      targetVersion: '1.0.0', confirmation: 'ONCEKI SURUME DON'
    } })).toMatchObject({ ok: true, value: { mutationKind: 'release_rollback', revision: 3 } });
    expect(unit.scope.installations.get('local.bank-reader')).toMatchObject({
      currentVersion: '1.0.0', previousVersion: '1.1.0', desiredState: 'disabled'
    });
    unit.scope.occurredAt = asIsoDateTime('2026-10-01T00:00:00.000Z');
    expect(await new SetSignedPluginDesiredStateUseCase(unit).execute({ context, command: {
      clientOperationId: 'safe-disable-expired', pluginId: 'local.bank-reader', expectedRevision: 3,
      enabled: false, reason: 'Süresi geçmiş aday güvenli biçimde kapatılır.'
    } })).toMatchObject({ ok: false, error: { category: 'conflict' } });
  });

  it('persists emergency disable and requires a newer signed release before re-enable', async () => {
    const unit = new Unit();
    await register(unit);
    expect(await register(unit, '1.1.0', 1, 'register-v2-before-emergency'))
      .toMatchObject({ ok: true, value: { mutationKind: 'release_update', revision: 2 } });
    const desired = new SetSignedPluginDesiredStateUseCase(unit);
    expect(await desired.execute({ context, command: {
      clientOperationId: 'enable-v2', pluginId: 'local.bank-reader', expectedRevision: 2,
      enabled: true, reason: 'Yerel inceleme tamamlandi.'
    } })).toMatchObject({ ok: true, value: { mutationKind: 'desired_enable', revision: 3 } });
    expect(await new EmergencyDisableSignedPluginUseCase(unit).execute({ context, command: {
      clientOperationId: 'emergency-stop', pluginId: 'local.bank-reader', expectedRevision: 3,
      confirmation: 'EKLENTIYI ACIL DURDUR', reason: 'Supheli yerel paket davranisi.'
    } })).toMatchObject({ ok: true, value: { mutationKind: 'emergency_disable', revision: 4 } });
    expect(await desired.execute({ context, command: {
      clientOperationId: 'enable-again', pluginId: 'local.bank-reader', expectedRevision: 4,
      enabled: true, reason: 'Tekrar etkinlestirme denemesi.'
    } })).toMatchObject({ ok: false, error: { category: 'conflict' } });
    expect(await desired.execute({ context, command: {
      clientOperationId: 'disable-after-emergency', pluginId: 'local.bank-reader', expectedRevision: 4,
      enabled: false, reason: 'Acil durumu normal kapalı duruma çevirme denemesi.'
    } })).toMatchObject({ ok: false, error: { category: 'conflict' } });
    expect(await new RollbackSignedPluginUseCase(unit).execute({ context, command: {
      clientOperationId: 'rollback-after-emergency', pluginId: 'local.bank-reader', expectedRevision: 4,
      targetVersion: '1.0.0', confirmation: 'ONCEKI SURUME DON'
    } })).toMatchObject({ ok: false, error: { category: 'conflict' } });
    expect(await register(unit, '1.2.0', 4, 'register-after-emergency')).toMatchObject({ ok: true, value: { revision: 5 } });
    expect(unit.scope.installations.get('local.bank-reader')).toMatchObject({ desiredState: 'disabled', currentVersion: '1.2.0' });
  });

  it('rejects expired or forged release evidence before durable writes', async () => {
    const unit = new Unit();
    const useCase = new RegisterSignedPluginReleaseUseCase(unit);
    expect(await useCase.execute({ context, command: {
      clientOperationId: 'expired-release', expectedRevision: 0,
      release: { ...release(), expiresAt: '2026-08-15T11:59:59.000Z' }
    } })).toMatchObject({ ok: false, error: { category: 'authorization' } });
    expect(await useCase.execute({ context, command: {
      clientOperationId: 'forged-release', expectedRevision: 0,
      release: { ...release(), signatureVerified: false as never }
    } })).toMatchObject({ ok: false, error: { category: 'authorization' } });
    expect(unit.scope.mutations.size).toBe(0);
    expect(unit.scope.installations.size).toBe(0);
  });

  it('rejects extra command fields, forged verified metadata and bounded-capacity overflow', async () => {
    const unit = new Unit();
    const useCase = new RegisterSignedPluginReleaseUseCase(unit);
    expect(await useCase.execute({ context, command: {
      clientOperationId: 'extra-field', expectedRevision: 0, release: release(), token: 'secret'
    } as never })).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(await useCase.execute({ context, command: {
      clientOperationId: 'undeclared-provider', expectedRevision: 0,
      release: { ...release(), capabilityCodes: ['bank.read', 'maps.read'] }
    } })).toMatchObject({ ok: false, error: { category: 'authorization' } });
    unit.scope.storageUsageOverride = { installationCount: 200, releaseCount: 0, mutationCount: 0 };
    expect(await register(unit, '1.0.0', 0, 'capacity-full')).toMatchObject({ ok: false, error: { category: 'conflict' } });
    expect(unit.scope.mutations.size).toBe(0);
  });
});
