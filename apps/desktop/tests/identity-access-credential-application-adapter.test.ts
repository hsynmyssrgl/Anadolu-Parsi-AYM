import { describe, expect, it } from 'vitest';
import {
  ERROR_CODES,
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import type {
  IdentityAccessApplicationContext,
  IdentityAccessCredentialWriteScope,
  IdentityAccessPolicyIntent
} from '@ppt/application';
import type {
  IdentityAccessCredentialRepositoryPort,
  PolicyAuthorizedRepositoryExecutionContext
} from '@ppt/repository-contracts';
import {
  RepositoryBackedIdentityAccessCredentialUnitOfWork,
  type RepositoryBackedIdentityAccessCredentialDependencies
} from '../src/main/identity-access-credential-application-adapter.js';

const NOW = asIsoDateTime('2026-08-14T08:30:00.000Z');
const FAMILY = asFamilyId('family-identity-adapter');
const ACCOUNT = asUserId('account-identity-adapter');
const PERSON = asPersonId('person-identity-adapter');
const CORRELATION = asCorrelationId('identity-adapter-test');
const key = { familyId: FAMILY, accountId: ACCOUNT, ownerPersonId: PERSON };
const context: IdentityAccessApplicationContext = {
  familyId: FAMILY,
  actor: { userId: ACCOUNT, role: 'owner', personId: PERSON },
  currentDevice: { trustedDeviceId: 'trusted-current', deviceId: 'device-current', securityEpoch: 7 },
  correlationId: CORRELATION
};

const failure = (): AppError => createAppError({
  code: ERROR_CODES.PERSISTENCE_FAILED,
  category: 'persistence',
  message: 'forced transactional failure',
  correlationId: CORRELATION
});

const intent = (overrides: Partial<IdentityAccessPolicyIntent> = {}): IdentityAccessPolicyIntent => ({
  action: 'read',
  capability: 'family.read',
  resourceType: 'identity_access_center',
  resourceId: ACCOUNT,
  purpose: 'administration',
  familyId: FAMILY,
  ownerPersonId: PERSON,
  privacy: 'private',
  sensitivity: 'highly_sensitive',
  ...overrides
});

interface FixtureState {
  challengeWrites: number;
  passkeyWrites: number;
  federatedWrites: number;
  temporaryWrites: number;
  snapshotWrites: number;
  mutationWrites: number;
  vaultRevocations: number;
  epochAdvances: number;
  deviceRevocations: number;
  audits: number;
  outbox: number;
  localSessionClears: number;
}

const fixture = (options: {
  readonly repositoryPersonId?: ReturnType<typeof asPersonId>;
  readonly repositoryDeviceId?: string;
  readonly failOutbox?: boolean;
} = {}) => {
  const state: FixtureState = {
    challengeWrites: 0,
    passkeyWrites: 0,
    federatedWrites: 0,
    temporaryWrites: 0,
    snapshotWrites: 0,
    mutationWrites: 0,
    vaultRevocations: 0,
    epochAdvances: 0,
    deviceRevocations: 0,
    audits: 0,
    outbox: 0,
    localSessionClears: 0
  };
  let securityEpoch = 7;
  let transactionActive = false;
  const methodCalls: string[] = [];
  const repositoryContexts: PolicyAuthorizedRepositoryExecutionContext[] = [];
  const policyContexts: unknown[] = [];
  const policyIntents: unknown[] = [];
  const externalSecurityCalls: string[] = [];
  const transaction = {} as never;
  const repositoryContext = {
    transaction,
    actor: {
      userId: ACCOUNT,
      roles: ['owner'],
      personId: options.repositoryPersonId ?? PERSON
    },
    correlationId: CORRELATION,
    occurredAt: NOW,
    policyAuthorization: {
      subject: {
        accountId: ACCOUNT,
        personId: options.repositoryPersonId ?? PERSON,
        deviceId: options.repositoryDeviceId ?? 'device-current'
      },
      resourceFamilyId: FAMILY,
      receiptRecord: { receipt: { issuedAt: NOW } }
    }
  } as unknown as PolicyAuthorizedRepositoryExecutionContext;

  const read = <T>(name: string, repository: PolicyAuthorizedRepositoryExecutionContext, value: T): Result<T, AppError> => {
    methodCalls.push(name);
    repositoryContexts.push(repository);
    return ok(value);
  };
  const write = (
    name: string,
    repository: PolicyAuthorizedRepositoryExecutionContext,
    counter: keyof FixtureState
  ): Result<void, AppError> => {
    methodCalls.push(name);
    repositoryContexts.push(repository);
    state[counter] += 1;
    return ok(undefined);
  };

  const identityRepository = {
    loadCenter: (repository: PolicyAuthorizedRepositoryExecutionContext) => read('loadCenter', repository, {
      key, passkeys: [], federatedLinks: [], temporaryCredentials: [], companionSnapshots: [], configuredProviders: [], generatedAt: NOW
    }),
    findTrustedDevice: (repository: PolicyAuthorizedRepositoryExecutionContext) => read('findTrustedDevice', repository, {
      trustedDeviceId: 'trusted-current', accountId: ACCOUNT, deviceId: 'device-current', securityEpoch: 7
    }),
    insertChallenge: (repository: PolicyAuthorizedRepositoryExecutionContext) => write('insertChallenge', repository, 'challengeWrites'),
    findChallenge: (repository: PolicyAuthorizedRepositoryExecutionContext) => read('findChallenge', repository, null),
    consumeChallenge: (repository: PolicyAuthorizedRepositoryExecutionContext) => read('consumeChallenge', repository, true),
    listPasskeys: (repository: PolicyAuthorizedRepositoryExecutionContext) => read('listPasskeys', repository, []),
    findPasskey: (repository: PolicyAuthorizedRepositoryExecutionContext) => read('findPasskey', repository, null),
    findPasskeyByCredentialIdSha256: (repository: PolicyAuthorizedRepositoryExecutionContext) => read('findPasskeyByCredentialIdSha256', repository, null),
    insertPasskey: (repository: PolicyAuthorizedRepositoryExecutionContext) => write('insertPasskey', repository, 'passkeyWrites'),
    savePasskey: (repository: PolicyAuthorizedRepositoryExecutionContext) => {
      const saved = write('savePasskey', repository, 'passkeyWrites');
      return saved.ok ? ok(true) : saved;
    },
    listConfiguredFederatedProviders: (repository: PolicyAuthorizedRepositoryExecutionContext) => read('listConfiguredFederatedProviders', repository, []),
    findFederatedLink: (repository: PolicyAuthorizedRepositoryExecutionContext) => read('findFederatedLink', repository, null),
    findFederatedLinkByProvider: (repository: PolicyAuthorizedRepositoryExecutionContext) => read('findFederatedLinkByProvider', repository, null),
    insertFederatedLink: (repository: PolicyAuthorizedRepositoryExecutionContext) => write('insertFederatedLink', repository, 'federatedWrites'),
    saveFederatedLink: (repository: PolicyAuthorizedRepositoryExecutionContext) => {
      const saved = write('saveFederatedLink', repository, 'federatedWrites');
      return saved.ok ? ok(true) : saved;
    },
    findTemporaryCredential: (repository: PolicyAuthorizedRepositoryExecutionContext) => read('findTemporaryCredential', repository, null),
    insertTemporaryCredential: (repository: PolicyAuthorizedRepositoryExecutionContext) => write('insertTemporaryCredential', repository, 'temporaryWrites'),
    saveTemporaryCredential: (repository: PolicyAuthorizedRepositoryExecutionContext) => {
      const saved = write('saveTemporaryCredential', repository, 'temporaryWrites');
      return saved.ok ? ok(true) : saved;
    },
    loadCompanionSourceProjection: (repository: PolicyAuthorizedRepositoryExecutionContext) => read('loadCompanionSourceProjection', repository, {
      sourceVersion: 12, schemaVersion: 1, passkeys: [], federatedLinks: [], temporaryCredentials: [],
      sourceAuthority: 'windows_single_writer', remoteWritesAccepted: false
    }),
    recordCompanionSnapshot: (repository: PolicyAuthorizedRepositoryExecutionContext) => write('recordCompanionSnapshot', repository, 'snapshotWrites'),
    findMutationByClientOperationId: (repository: PolicyAuthorizedRepositoryExecutionContext) => read('findMutationByClientOperationId', repository, null),
    insertMutation: (repository: PolicyAuthorizedRepositoryExecutionContext) => write('insertMutation', repository, 'mutationWrites')
  } as unknown as IdentityAccessCredentialRepositoryPort;

  const externalPort = new Proxy({}, {
    get: (_target, property) => (..._args: readonly unknown[]) => {
      externalSecurityCalls.push(String(property));
      throw new Error('External security dependency must be called by its use case, not by the UoW adapter');
    }
  });

  const dependencies = {
    policyTransactionRunner: {
      execute: async <T>(policyContext: unknown, policyIntent: unknown, operation: (scope: unknown) => Result<T, AppError>) => {
        policyContexts.push(policyContext);
        policyIntents.push(policyIntent);
        const before = { ...state };
        const beforeEpoch = securityEpoch;
        transactionActive = true;
        const result = operation({
          repository: repositoryContext,
          occurredAt: NOW,
          authorization: repositoryContext.policyAuthorization
        });
        transactionActive = false;
        if (!result.ok) {
          Object.assign(state, before);
          securityEpoch = beforeEpoch;
        }
        return result;
      }
    },
    identityRepository,
    accountRepository: {
      findById: (repository: PolicyAuthorizedRepositoryExecutionContext) => read('account.findById', repository, {
        id: ACCOUNT, personId: PERSON, status: 'active', role: 'owner', securityEpoch
      } as never),
      advanceSecurityEpoch: (repository: PolicyAuthorizedRepositoryExecutionContext) => {
        methodCalls.push('account.advanceSecurityEpoch');
        repositoryContexts.push(repository);
        state.epochAdvances += 1;
        securityEpoch += 1;
        return ok(securityEpoch);
      }
    },
    trustedDeviceRepository: {
      revokeAll: (repository: PolicyAuthorizedRepositoryExecutionContext) => write('trustedDevice.revokeAll', repository, 'deviceRevocations')
    },
    auditRepository: {
      append: (repository: PolicyAuthorizedRepositoryExecutionContext) => {
        const appended = write('audit.append', repository, 'audits');
        return appended.ok ? ok('audit-hash') : appended;
      }
    },
    outboxRepository: {
      enqueue: (repository: PolicyAuthorizedRepositoryExecutionContext) => {
        if (options.failOutbox) {
          methodCalls.push('outbox.enqueue');
          repositoryContexts.push(repository);
          return err(failure());
        }
        return write('outbox.enqueue', repository, 'outbox');
      }
    },
    federatedVaultControl: {
      revokeEntry: (repository: PolicyAuthorizedRepositoryExecutionContext) => write('vault.revokeEntry', repository, 'vaultRevocations')
    },
    quota: {
      countTemporaryCredentials: (repository: PolicyAuthorizedRepositoryExecutionContext) => read('quota.countTemporaryCredentials', repository, 2)
    },
    localSessionRevocation: {
      clearForAccount: (accountId: typeof ACCOUNT) => {
        expect(accountId).toBe(ACCOUNT);
        expect(transactionActive).toBe(false);
        state.localSessionClears += 1;
        return ok(undefined);
      }
    },
    externalSecurityPorts: {
      passkeyCeremonyVerifier: externalPort,
      passkeySession: externalPort,
      passkeyRecoveryVerifier: externalPort,
      federatedAuthorizationCeremony: externalPort,
      federatedAuthorizationCodeVerifier: externalPort,
      temporaryCredentialEnvelope: externalPort,
      encryptedCompanionSnapshot: externalPort
    }
  } as unknown as RepositoryBackedIdentityAccessCredentialDependencies;

  return {
    unit: new RepositoryBackedIdentityAccessCredentialUnitOfWork(dependencies),
    state,
    methodCalls,
    repositoryContexts,
    policyContexts,
    policyIntents,
    externalSecurityCalls,
    repositoryContext
  };
};

const invokeEveryMappedOperation = (scope: IdentityAccessCredentialWriteScope): Result<void, AppError> => {
  const operations: readonly (() => Result<unknown, AppError>)[] = [
    () => scope.loadCenter(key),
    () => scope.findTrustedDevice(key, 'trusted-current'),
    () => scope.insertChallenge({} as never),
    () => scope.findChallenge(key, 'challenge-1'),
    () => scope.consumeChallenge(key, 'challenge-1', NOW, 'mutation-1'),
    () => scope.listPasskeys(key),
    () => scope.findPasskey(key, 'passkey-1'),
    () => scope.findPasskeyByCredentialIdSha256(key, 'a'.repeat(64)),
    () => scope.insertPasskey({} as never),
    () => scope.savePasskey({} as never, 1),
    () => scope.listConfiguredFederatedProviders(),
    () => scope.findFederatedLink(key, 'link-1'),
    () => scope.findFederatedLinkByProvider(key, 'google'),
    () => scope.insertFederatedLink({} as never),
    () => scope.saveFederatedLink({} as never, 1),
    () => scope.revokeFederatedVaultEntry('vault-reference-1'),
    () => scope.findTemporaryCredential(key, 'temporary-1'),
    () => scope.insertTemporaryCredential({} as never),
    () => scope.saveTemporaryCredential({} as never, 1),
    () => scope.countTemporaryCredentials(key),
    () => scope.loadCompanionSourceProjection(key),
    () => scope.recordCompanionSnapshot({} as never),
    () => scope.findMutationByClientOperationId(key, 'operation-1'),
    () => scope.insertMutation({} as never),
    () => scope.appendAudit({} as never),
    () => scope.enqueueEvent({} as never)
  ];
  for (const operation of operations) {
    const result = operation();
    if (!result.ok) return result;
  }
  return ok(undefined);
};

describe('33-P identity access desktop application adapter', () => {
  it('maps exact central PEP context and create/update source-resource modes', async () => {
    const { unit, policyContexts, policyIntents } = fixture();
    const cases: readonly IdentityAccessPolicyIntent[] = [
      intent(),
      intent({ action: 'create', capability: 'family.write', resourceType: 'identity_challenge', resourceId: 'challenge-1' }),
      intent({ action: 'update', capability: 'family.write', resourceType: 'passkey_credential', resourceId: 'passkey-1' }),
      intent({ action: 'delete', capability: 'family.write', resourceType: 'temporary_verifiable_credential', resourceId: 'temporary-1' })
    ];
    for (const policyIntent of cases) {
      expect((await unit.execute(context, policyIntent, () => ok(undefined))).ok).toBe(true);
    }
    expect(policyContexts).toEqual(cases.map(() => ({
      familyId: FAMILY,
      actor: { userId: ACCOUNT, roles: ['owner'], personId: PERSON },
      correlationId: CORRELATION
    })));
    expect(policyIntents).toEqual([
      expect.objectContaining({ action: 'read', capability: 'family.read', resourceType: 'identity_access_center' }),
      expect.objectContaining({ action: 'create', capability: 'family.write', resourceType: 'identity_challenge', sourceResourceMode: 'replace' }),
      expect.objectContaining({ action: 'update', capability: 'family.write', resourceType: 'passkey_credential', sourceResourceMode: 'preserve' }),
      expect.not.objectContaining({ sourceResourceMode: expect.anything() })
    ]);
  });

  it('maps the complete repository, vault, quota and companion surface onto one authorized transaction', async () => {
    const { unit, state, methodCalls, repositoryContexts, repositoryContext, externalSecurityCalls } = fixture();
    const result = await unit.execute(
      context,
      intent({ action: 'create', capability: 'family.write', resourceType: 'passkey_credential', resourceId: 'passkey-1' }),
      invokeEveryMappedOperation
    );
    expect(result.ok).toBe(true);
    expect(methodCalls).toEqual([
      'loadCenter', 'findTrustedDevice', 'insertChallenge', 'findChallenge', 'consumeChallenge',
      'listPasskeys', 'findPasskey', 'findPasskeyByCredentialIdSha256', 'insertPasskey', 'savePasskey',
      'listConfiguredFederatedProviders', 'findFederatedLink', 'findFederatedLinkByProvider',
      'insertFederatedLink', 'saveFederatedLink', 'vault.revokeEntry', 'findTemporaryCredential',
      'insertTemporaryCredential', 'saveTemporaryCredential', 'quota.countTemporaryCredentials',
      'loadCompanionSourceProjection', 'recordCompanionSnapshot', 'findMutationByClientOperationId',
      'insertMutation', 'audit.append', 'outbox.enqueue'
    ]);
    expect(repositoryContexts.every((item) => item === repositoryContext && item.transaction === repositoryContext.transaction)).toBe(true);
    expect(state).toMatchObject({
      challengeWrites: 1, passkeyWrites: 2, federatedWrites: 2, temporaryWrites: 2,
      snapshotWrites: 1, mutationWrites: 1, vaultRevocations: 1, audits: 1, outbox: 1
    });
    expect(externalSecurityCalls).toEqual([]);
  });

  it('advances security_epoch and revokes trusted devices transactionally, then clears the local session after commit', async () => {
    const { unit, state, methodCalls } = fixture();
    const result = await unit.execute(
      context,
      intent({ action: 'delete', capability: 'family.write', resourceType: 'passkey_credential', resourceId: 'passkey-lost' }),
      (scope) => {
        const recovered = scope.advanceSecurityEpochAndRevokeLocalSessions(ACCOUNT);
        if (!recovered.ok) return recovered;
        const mutation = scope.insertMutation({} as never);
        if (!mutation.ok) return mutation;
        const audited = scope.appendAudit({} as never);
        if (!audited.ok) return audited;
        const queued = scope.enqueueEvent({} as never);
        return queued.ok ? ok(recovered.value) : queued;
      }
    );
    expect(result).toEqual(ok({ securityEpoch: 8 }));
    expect(methodCalls).toEqual([
      'account.findById', 'account.advanceSecurityEpoch', 'trustedDevice.revokeAll',
      'insertMutation', 'audit.append', 'outbox.enqueue'
    ]);
    expect(state).toMatchObject({
      epochAdvances: 1, deviceRevocations: 1, mutationWrites: 1, audits: 1, outbox: 1, localSessionClears: 1
    });
  });

  it('rolls security, credential evidence, vault, audit and outbox effects back and does not clear the session on failure', async () => {
    const { unit, state } = fixture({ failOutbox: true });
    const result = await unit.execute(
      context,
      intent({ action: 'delete', capability: 'family.write', resourceType: 'federated_identity_link', resourceId: 'link-rollback' }),
      (scope) => {
        const epoch = scope.advanceSecurityEpochAndRevokeLocalSessions(ACCOUNT);
        if (!epoch.ok) return epoch;
        return invokeEveryMappedOperation(scope);
      }
    );
    expect(result.ok).toBe(false);
    expect(state).toEqual({
      challengeWrites: 0, passkeyWrites: 0, federatedWrites: 0, temporaryWrites: 0,
      snapshotWrites: 0, mutationWrites: 0, vaultRevocations: 0, epochAdvances: 0,
      deviceRevocations: 0, audits: 0, outbox: 0, localSessionClears: 0
    });
  });

  it('fails closed before repository access when person or current device binding changes', async () => {
    for (const options of [
      { repositoryPersonId: asPersonId('person-other') },
      { repositoryDeviceId: 'device-other' }
    ]) {
      const { unit, methodCalls, policyIntents } = fixture(options);
      const result = await unit.execute(context, intent(), (scope) => scope.loadCenter(key));
      expect(result.ok).toBe(false);
      expect(methodCalls).toEqual([]);
      expect(policyIntents).toHaveLength(1);
    }
  });

  it('rejects non-exact intent semantics before opening a governed transaction', async () => {
    const { unit, policyIntents } = fixture();
    const wrongCapability = await unit.execute(
      context,
      intent({ action: 'update', capability: 'family.read', resourceType: 'passkey_credential', resourceId: 'passkey-1' }),
      () => ok(undefined)
    );
    const wrongOwner = await unit.execute(
      context,
      intent({ ownerPersonId: asPersonId('person-other') }),
      () => ok(undefined)
    );
    expect(wrongCapability.ok).toBe(false);
    expect(wrongOwner.ok).toBe(false);
    expect(policyIntents).toEqual([]);
  });
});
