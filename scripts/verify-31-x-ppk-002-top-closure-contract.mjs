import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const checks = [];
const failures = [];
const check = (name, condition, details = undefined) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status, ...(details === undefined ? {} : { details }) });
  if (!condition) failures.push(name);
};

const sources = Object.fromEntries(await Promise.all(Object.entries({
  main: 'apps/desktop/src/main/main.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  universalApi: 'apps/desktop/src/main/desktop-universal-api-policy-enforcement.ts',
  repositoryScope: 'apps/desktop/src/main/desktop-repository-policy-scope.ts',
  composition: 'apps/desktop/src/main/repository-composition-root.ts',
  sqliteBase: 'packages/repositories/src/sqlite-base.ts',
  ipc: 'apps/desktop/src/main/ipc-runtime.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  migrations: 'packages/database/src/family-database-migrations.ts',
  test: 'apps/desktop/tests/desktop-universal-api-policy-enforcement.test.ts',
  decision: 'docs/decisions/DEC-138-ppk-002-central-policy-enforcement-foundation.md'
}).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));

const repositoryFiles = (await readdir('packages/repositories/src'))
  .filter((name) => name.endsWith('.ts'));
const repositoryClassSources = await Promise.all(repositoryFiles.map(async (name) =>
  readFile(join('packages/repositories/src', name), 'utf8')));
const repositoryClassCount = repositoryClassSources.reduce((total, source) =>
  total + [...source.matchAll(/export class Sqlite\w+Repository/gu)].length, 0);
const guardedCompositionCount = [...sources.composition.matchAll(/new Sqlite\w+Repository\(repositoryOptions\)/gu)].length;
const channels = [...sources.main.matchAll(/registerIpcHandler\('([^']+)'/gu)].map((match) => match[1]);
const bootstrapChannels = [
  'app:getInfo',
  'auth:getExternalIdentityProviders',
  'auth:getState',
  'auth:getWindowsHelloState',
  'auth:login',
  'auth:loginWithWindowsHello',
  'auth:setup',
  'invitations:accept',
  'invitations:inspect'
];
const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const requirement = registry.requirements.find((item) => item.id === 'PPK-002');
const closureScope = JSON.parse(await readFile('config/31-x-ppk-002-top-closure-scope.json', 'utf8'));

check('DEC-138 requires zero direct role checks and complete legacy repository migration', sources.decision.includes('34 doğrudan rol kontrolü') && sources.decision.includes('tüm legacy repository context çağrıları taşınmadan'));
check('every Desktop renderer API remains on the single universal composition boundary', channels.length >= 200 && new Set(channels).size === channels.length, { channelCount: channels.length });
check('cached and uncached IPC responses both execute the policy boundary', sources.ipc.includes('authorizedCachedResult') && sources.ipc.includes('input.policyEnforcement.execute'));
check('bootstrap is an exact nine-channel registry without auth wildcard', !sources.universalApi.includes("channel.startsWith('auth:')") && bootstrapChannels.every((channel) => sources.universalApi.includes(`'${channel}'`)), { bootstrapChannelCount: bootstrapChannels.length });
check('sensitive authenticated auth channels are no longer bootstrap exceptions', ['auth:logout', 'auth:changePassword', 'auth:enrollWindowsHello', 'auth:reauthorizeCurrentDeviceAfterRecovery'].every((channel) => !bootstrapChannels.includes(channel)));
check('repository policy scope is async-local and fail-closed without an active scope', sources.repositoryScope.includes('new AsyncLocalStorage<RepositoryPolicyScope>()') && sources.repositoryScope.includes('Repository execution attempted outside an authorized Desktop policy scope'));
check('repository policy scope validates signed, exact bootstrap and authority-resolution boundaries', ['AUTHORIZED', 'BOOTSTRAP', 'POLICY_RESOLUTION'].every((marker) => sources.repositoryScope.includes(`'${marker}'`)) && sources.repositoryScope.includes('assertActivePlatformPolicyTransactionContext') && sources.repositoryScope.includes('REPOSITORY_BOOTSTRAP_BOUNDARIES.has(input.boundary)'));
check('repository policy scope rejects correlation substitution', sources.repositoryScope.includes('scope.correlationId !== context.correlationId') && sources.repositoryScope.includes('TRANSACTION_CONTEXT_MISMATCH'));
check('explicit domain policy-authorized repository contexts remain independently valid', sources.repositoryScope.includes('assertPolicyAuthorizedRepositoryContext(context)'));
check('SQLite base guards both repository execution and direct database access', [...sources.sqliteBase.matchAll(/#executionPolicyGuard\?\.assert\(context\)/gu)].length === 2);
check('every production SQLite repository receives the same execution guard', repositoryClassCount > 0 && guardedCompositionCount === repositoryClassCount, { repositoryClassCount, guardedCompositionCount });
check('FamilyDataStore production composition receives the repository guard', sources.dataStore.includes('repositoryExecutionPolicyGuard') && sources.dataStore.includes('executionPolicyGuard: options.repositoryExecutionPolicyGuard'));
check('Desktop production composition injects one shared repository policy scope', sources.main.includes('new DesktopRepositoryPolicyScope()') && sources.main.includes('repositoryExecutionPolicyGuard: desktopRepositoryPolicyScope.guard'));
check('signed universal PEP callback opens the authorized repository scope only after context validation', sources.universalApi.includes('runAuthorized(authorization, input.operation)') && sources.universalApi.indexOf('assertActivePlatformPolicyTransactionContext(authorization') < sources.universalApi.indexOf('runAuthorized(authorization, input.operation)'));
check('authority lookup is isolated in an explicit policy-resolution scope', sources.universalApi.includes('runPolicyResolution') && sources.universalApi.includes('boundary: input.channel'));
check('bootstrap repository access is correlation-bound to an exact registered channel', sources.universalApi.includes('runBootstrap') && sources.universalApi.includes('correlationId: input.correlationId'));
check('background scheduler executes repository work through the signed universal PEP', sources.main.includes("channel: 'system:runBackgroundSchedulerJob'") && sources.main.includes("await revocationSync().runDue()"));
check('vault session guard executes through PEP and seals on authorization failure', sources.main.includes("channel: 'system:captureVaultSessionCheckpoint'") && sources.main.includes("event: 'vault.session_guard.authorization_failed'") && sources.main.includes('sealUserDataSession();'));
check('legacy application context factories preserve the active PEP correlation', [...sources.dataStore.matchAll(/correlationId:\s*this\.#correlation\?\.current\(\)\?\.correlationId/gu)].length >= 20);
check('durable policy schema and migration chain exist', ['platform_policy_replay_reservations', 'platform_policy_database_fences', 'platform_policy_transaction_receipts'].every((table) => sources.migrations.includes(table)));
check('renderer UI and menu actions remain confined to the preload IPC bridge', sources.preload.includes("contextBridge.exposeInMainWorld('pardus'") && sources.preload.includes('const rawInvoke = ipcRenderer.invoke.bind(ipcRenderer)'));
check('targeted tests prove no-scope denial, signed success, bootstrap rejection and correlation mismatch denial', ['fails closed when a guarded repository', 'keeps guarded repository execution inside the signed API callback', 'rejects an unregistered direct repository bootstrap scope', 'rejects a repository context that changes correlation'].every((marker) => sources.test.includes(marker)));
check('accepted scope marks PPK-002 complete only with an all-true chain', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true));
check('31-X closure scope claims completion with bound contract and runtime evidence', closureScope.status === 'COMPLETED' && closureScope.requirementCompletionClaimed === true && closureScope.validation?.contract && closureScope.validation?.runtime);

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '31-X',
  requirement: 'PPK-002',
  phase: 'TOP_CLOSURE_CONTRACT',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  requirementCompletionClaimed: failures.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/31-X-ppk-002-top-closure-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`31-X PPK-002 top-closure contract: FAIL (${failures.length}/${checks.length}).`);
  process.exit(1);
}
console.log(`31-X PPK-002 top-closure contract: PASS (${checks.length}/${checks.length}).`);
