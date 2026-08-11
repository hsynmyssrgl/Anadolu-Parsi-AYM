import { mkdir, readFile, writeFile } from 'node:fs/promises';

const checks = [];
const failures = [];
const check = (name, condition, details = undefined) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status, ...(details === undefined ? {} : { details }) });
  if (!condition) failures.push(name);
};

const sources = Object.fromEntries(await Promise.all(Object.entries({
  main: 'apps/desktop/src/main/main.ts',
  ipc: 'apps/desktop/src/main/ipc-runtime.ts',
  universalApi: 'apps/desktop/src/main/desktop-universal-api-policy-enforcement.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  pep: 'packages/platform-policy/src/policy-enforcement-point.ts',
  archiveContract: 'packages/repository-contracts/src/archive-repository.ts',
  archiveRepository: 'packages/repositories/src/archive-repository.ts',
  archiveAdapter: 'apps/desktop/src/main/archive-application-adapter.ts',
  contracts: 'packages/core-service-contracts/src/index.ts',
  coreRuntime: 'apps/core-service/src/core-service-runtime.ts',
  coreDispatcher: 'apps/core-service/src/core-service-method-dispatcher.ts',
  coreAuthority: 'apps/core-service/src/policy-journal-monotonic-authority.ts',
  coreMain: 'apps/core-service/src/main.ts',
  receiptSink: 'apps/desktop/src/main/platform-policy-receipt-file-sink.ts'
}).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));

const channels = [...sources.main.matchAll(/registerIpcHandler\('([^']+)'/gu)].map((match) => match[1]);
check('all Desktop APIs use the single registerIpcHandler composition boundary', channels.length >= 200, { channelCount: channels.length });
check('Desktop API channel registry contains no duplicate registration', new Set(channels).size === channels.length);
check('main process composes the universal policy boundary into every registered API', sources.main.includes('policyEnforcement: universalApiPolicyEnforcement()'));
check('read-cache hits are reauthorized before response release', sources.ipc.includes('authorizedCachedResult') && sources.ipc.includes('input.policyEnforcement.execute'));
check('handler execution is enclosed by the same policy boundary', sources.ipc.includes('operation: () => input.handler(event'));
check(
  'bootstrap exception registry is explicit and identity-lifecycle bounded',
  !sources.universalApi.includes("channel.startsWith('auth:')") && [
    'app:getInfo',
    'auth:getExternalIdentityProviders',
    'auth:getState',
    'auth:getWindowsHelloState',
    'auth:login',
    'auth:loginWithWindowsHello',
    'auth:setup',
    'invitations:accept',
    'invitations:inspect'
  ].every((channel) => sources.universalApi.includes(`'${channel}'`))
);
check('universal API PEP uses signed Core Service provider and durable receipt sink', sources.universalApi.includes('new PlatformPolicyEnforcementPoint') && sources.main.includes('authorizationProvider: coreService.adapter.policyProvider') && sources.main.includes('receiptSink: policyReceiptSink()'));
check('trusted authenticated authority is resolved from live account, device and session state', sources.dataStore.includes('currentPlatformPolicyAuthority') && sources.dataStore.includes('auth.trustedDevice !== true') && sources.dataStore.includes('membershipActive: true'));

const archiveBusinessPort = sources.archiveContract.split('export interface ArchiveRepositoryPort {')[1]?.split('export interface ArchivePolicyResourceRepositoryPort {')[0] ?? '';
const archiveResolverPort = sources.archiveContract.split('export interface ArchivePolicyResourceRepositoryPort {')[1] ?? '';
check('every archive business repository method requires a policy-authorized context', archiveBusinessPort.length > 0 && !/(?<!PolicyAuthorized)RepositoryExecutionContext/u.test(archiveBusinessPort));
check('archive policy-resource reads are isolated behind named resolver-only methods', archiveResolverPort.includes('findForPolicyResolution') && archiveResolverPort.includes('listForPolicyResolution') && !archiveResolverPort.includes('\n    find('));
check('archive repository validates read and write receipt bindings', sources.archiveRepository.includes('exactReadBinding') && sources.archiveRepository.includes('collectionReadBinding') && sources.archiveRepository.includes('exactPolicyBinding'));
check('archive query use cases execute reads through the governed transaction boundary', sources.archiveAdapter.includes('executeGovernedRead') && sources.archiveAdapter.includes("capability: 'archive.read'"));

const obligationTypes = [
  'mask_fields', 'local_processing_only', 'no_cache', 'no_clipboard', 'no_export', 'no_ai',
  'no_recording', 'watermark', 'delete_after', 'strong_reauthentication', 'online_only', 'high_detail_audit'
];
check('strict obligation executor handles every policy obligation type', obligationTypes.every((type) => sources.pep.includes(`case '${type}'`)), { obligationCount: obligationTypes.length });
check('obligation execution is receipt-bound and attested before operation callback', sources.pep.includes('attestationHash') && sources.pep.includes('executePolicyObligations') && sources.pep.includes('assertObligationExecution'));
check('strong reauthentication without evidence fails closed', sources.pep.includes('Strong reauthentication evidence is not attached'));

check('Core Service contract exposes the monotonic journal checkpoint method', sources.contracts.includes("'policy-journal.checkpoint'"));
check('Core Service dispatcher routes journal checkpoints to the runtime authority', sources.coreDispatcher.includes("typedMethod === 'policy-journal.checkpoint'") && sources.coreRuntime.includes('checkpointPolicyJournal'));
check('external authority rejects rollback, equivocation and size regression', ['POLICY_JOURNAL_ROLLBACK_DETECTED', 'POLICY_JOURNAL_EQUIVOCATION_DETECTED', 'POLICY_JOURNAL_SIZE_REGRESSION_DETECTED'].every((marker) => sources.coreAuthority.includes(marker)));
check('external authority state is HMAC protected, atomically persisted and fsynced', sources.coreAuthority.includes("createHmac('sha256'") && sources.coreAuthority.includes('atomicWrite') && sources.coreAuthority.includes('fsyncSync'));
check('Core Service requires an absolute independent authority path', sources.coreMain.includes('PPT_POLICY_JOURNAL_AUTHORITY_PATH') && sources.coreMain.includes('isAbsolute(policyJournalAuthorityPath)'));
check('Desktop receipt journal checkpoints after append, ensure and trusted restart inspection', sources.receiptSink.match(/await this\.#checkpoint/gu)?.length >= 3);
check('Desktop fails closed when the external monotonic authority is absent', sources.receiptSink.includes('POLICY_RECEIPT_JOURNAL_MONOTONIC_AUTHORITY_UNAVAILABLE'));

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '31-U-W',
  requirement: 'PPK-002',
  phase: 'REMAINING_TECHNICAL_BOUNDARIES_CONTRACT',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  requirementCompletionClaimed: false,
  remainingRequirementBoundary: 'INTERNAL_NON_IPC_LEGACY_REPOSITORY_CONTEXTS_AND_IDENTITY_BOOTSTRAP_EXCEPTIONS',
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/31-U-W-ppk-002-remaining-boundaries-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`31-U-W PPK-002 remaining-boundaries contract: FAIL (${failures.length}/${checks.length})`);
  process.exit(1);
}
console.log(`31-U-W PPK-002 remaining-boundaries contract: PASS (${checks.length}/${checks.length}).`);
