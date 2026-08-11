import { describe, expect, it } from 'vitest';
import { asCorrelationId } from '@ppt/core';
import { SqliteRepository } from '@ppt/repositories';
import type { RepositoryExecutionContext } from '@ppt/repository-contracts';
import {
  PlatformPolicyKernel,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import {
  DesktopUniversalApiPolicyEnforcement,
  isDesktopPolicyBootstrapChannel,
  resolveDesktopUniversalApiIntent
} from '../src/main/desktop-universal-api-policy-enforcement.js';
import { DesktopRepositoryPolicyScope } from '../src/main/desktop-repository-policy-scope.js';

const NOW = '2026-08-11T09:00:00.000Z';
const EXPIRES = '2026-08-11T10:00:00.000Z';
const correlationId = asCorrelationId('corr-31-u-universal-api');

class GuardedProbeRepository extends SqliteRepository {
  public probe(context: RepositoryExecutionContext) {
    return this.execute(context, () => 'repository-ok');
  }
}

const repositoryContext = (value = correlationId): RepositoryExecutionContext => ({
  transaction: {} as RepositoryExecutionContext['transaction'],
  actor: { userId: 'account-31-u' as RepositoryExecutionContext['actor']['userId'], roles: ['adult_member'] },
  correlationId: value,
  occurredAt: NOW as RepositoryExecutionContext['occurredAt']
});

const createHarness = (writable = true, trusted = true) => {
  const records: PlatformPolicyReceiptRecord[] = [];
  const repositoryPolicyScope = new DesktopRepositoryPolicyScope();
  const kernel = new PlatformPolicyKernel({
    policyVersion: 'PPK-31-U',
    signingKey: Buffer.alloc(32, 31),
    applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write'] },
    consentRequiredCapabilities: [],
    onlineOnlyCapabilities: [],
    writeActions: ['create', 'update', 'delete']
  });
  const enforcement = new DesktopUniversalApiPolicyEnforcement({
    authorizationProvider: {
      authorize: ({ request, nonce }) => ({ effectiveRequest: request, authorization: kernel.authorizeWithReceipt(request, NOW, nonce) }),
      verify: ({ request, receipt }) => kernel.verifyReceiptForRequest(receipt, request)
    },
    receiptSink: { append: (record) => { records.push(record); } },
    clusterFence: () => ({ writable, epoch: 31 }),
    resolveAuthority: () => ({
      policyVersion: 'PPK-31-U',
      accountId: 'account-31-u',
      personId: 'person-31-u',
      deviceId: 'device-31-u',
      applicationId: 'windows-desktop',
      deviceTrusted: trusted,
      membershipActive: true,
      roles: ['adult_member'],
      familyIds: ['family-main'],
      online: true,
      expiresAt: EXPIRES
    }),
    repositoryPolicyScope,
    clock: () => NOW
  });
  return { enforcement, records, repositoryPolicyScope };
};

describe('31-U universal Desktop API policy enforcement', () => {
  it('classifies read and mutation channels deterministically', () => {
    expect(resolveDesktopUniversalApiIntent('dashboard:getOverview', correlationId)).toMatchObject({ action: 'read', capability: 'family.read' });
    expect(resolveDesktopUniversalApiIntent('family:createMember', correlationId)).toMatchObject({ action: 'update', capability: 'family.write' });
    expect(isDesktopPolicyBootstrapChannel('auth:login')).toBe(true);
    expect(isDesktopPolicyBootstrapChannel('auth:reauthorizeCurrentDeviceAfterRecovery')).toBe(false);
    expect(isDesktopPolicyBootstrapChannel('family:createMember')).toBe(false);
  });

  it('persists an allow receipt before executing a protected API operation', async () => {
    const { enforcement, records } = createHarness();
    const order: string[] = [];
    const result = await enforcement.execute({
      channel: 'dashboard:getOverview',
      correlationId,
      operation: () => { order.push(`operation-after-${records.length}-receipt`); return 'ok'; }
    });
    expect(result).toBe('ok');
    expect(order).toEqual(['operation-after-1-receipt']);
    expect(records[0]).toMatchObject({ resourceType: 'desktop_ipc_endpoint', resourceId: 'dashboard:getOverview', action: 'read', capability: 'family.read' });
  });

  it('fails closed before a mutation when the cluster fence is not writable', async () => {
    const { enforcement, records } = createHarness(false);
    let executed = false;
    await expect(enforcement.execute({
      channel: 'family:createMember',
      correlationId,
      operation: () => { executed = true; }
    })).rejects.toMatchObject({ code: 'POLICY_DENIED' });
    expect(executed).toBe(false);
    expect(records).toHaveLength(1);
    expect(records[0]?.decision.reason).toBe('CLUSTER_NOT_WRITABLE');
  });

  it('fails closed for an untrusted authenticated device', async () => {
    const { enforcement } = createHarness(true, false);
    await expect(enforcement.execute({ channel: 'dashboard:getOverview', correlationId, operation: () => 'must-not-run' }))
      .rejects.toMatchObject({ code: 'POLICY_DENIED' });
  });

  it('limits the receiptless path to the explicit bootstrap registry', async () => {
    const { enforcement, records } = createHarness();
    await expect(enforcement.execute({ channel: 'auth:login', correlationId, operation: () => 'bootstrap' })).resolves.toBe('bootstrap');
    expect(records).toHaveLength(0);
  });

  it('fails closed when a guarded repository is called outside every policy scope', () => {
    const { repositoryPolicyScope } = createHarness();
    const repository = new GuardedProbeRepository({ executionPolicyGuard: repositoryPolicyScope.guard });
    expect(() => repository.probe(repositoryContext())).toThrowError(
      expect.objectContaining({ code: 'TRANSACTION_CONTEXT_INVALID' })
    );
  });

  it('keeps guarded repository execution inside the signed API callback', async () => {
    const { enforcement, repositoryPolicyScope } = createHarness();
    const repository = new GuardedProbeRepository({ executionPolicyGuard: repositoryPolicyScope.guard });
    await expect(enforcement.execute({
      channel: 'dashboard:getOverview',
      correlationId,
      operation: () => repository.probe(repositoryContext())
    })).resolves.toMatchObject({ ok: true, value: 'repository-ok' });
  });

  it('rejects an unregistered direct repository bootstrap scope', () => {
    const { repositoryPolicyScope } = createHarness();
    const repository = new GuardedProbeRepository({ executionPolicyGuard: repositoryPolicyScope.guard });
    expect(() => repositoryPolicyScope.runBootstrap({
      correlationId,
      boundary: 'auth:logout'
    }, () => repository.probe(repositoryContext()))).toThrowError(
      expect.objectContaining({ code: 'INTENT_INVALID' })
    );
  });

  it('rejects a repository context that changes correlation inside an authorized callback', async () => {
    const { enforcement, repositoryPolicyScope } = createHarness();
    const repository = new GuardedProbeRepository({ executionPolicyGuard: repositoryPolicyScope.guard });
    await expect(enforcement.execute({
      channel: 'dashboard:getOverview',
      correlationId,
      operation: () => repository.probe(repositoryContext(asCorrelationId('corr-mismatch')))
    })).rejects.toMatchObject({ code: 'TRANSACTION_CONTEXT_MISMATCH' });
  });
});
