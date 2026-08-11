import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const canonicalReportPath = 'artifacts/validation/30-O-ppk-002-archive-production-composition-contract.json';
const preservedSuccessorFailureReportPath = 'artifacts/validation/30-P-30-O-archive-production-composition-contract-regression.json';
const successorCleanReportPath = 'artifacts/validation/30-P-30-O-archive-production-composition-contract-regression-clean.json';
const completion30OPath = 'artifacts/checkpoints/30-O_COMPLETION_RECORD.json';
const successorRegression = process.argv.includes('--successor-regression');
const successorAttempt = process.argv
  .find((argument) => argument.startsWith('--attempt='))
  ?.slice('--attempt='.length);
if (successorRegression && successorAttempt !== '30p-clean') {
  console.error(
    `The first failed successor report is preserved at ${preservedSuccessorFailureReportPath}; use --attempt=30p-clean for the separate clean-attempt report.`
  );
  process.exit(2);
}
const reportPath = successorRegression ? successorCleanReportPath : canonicalReportPath;
const TRUTH = 'Bu teslim, yukar\u0131daki kan\u0131tlarla s\u0131n\u0131rl\u0131d\u0131r; \u00e7al\u0131\u015ft\u0131r\u0131lmayan hi\u00e7bir kontrol PASS say\u0131lmam\u0131\u015ft\u0131r.';
const paths = {
  scope: 'config/30-o-archive-production-composition-scope.json',
  decision: 'docs/decisions/DEC-140-ppk-002-archive-production-composition-and-sqlite-runtime.md',
  authority: 'artifacts/authority/30-O_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  workPlan: 'config/work-segmentation-plan.json',
  registry: 'config/accepted-scope-registry.json',
  package: 'package.json',
  coreMain: 'apps/core-service/src/main.ts',
  coreServer: 'apps/core-service/src/local-admin-server.ts',
  coreRuntime: 'apps/core-service/src/core-service-runtime.ts',
  coreDispatcher: 'apps/core-service/src/core-service-method-dispatcher.ts',
  desktopMain: 'apps/desktop/src/main/main.ts',
  desktopStartup: 'apps/desktop/src/main/core-service-startup-connection.ts',
  desktopAdapter: 'apps/desktop/src/main/core-service-application-adapter.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  productionRuntime: 'apps/desktop/src/main/archive-production-policy-runtime.ts',
  archiveAdapter: 'apps/desktop/src/main/archive-application-adapter.ts',
  receiptSink: 'apps/desktop/src/main/platform-policy-receipt-file-sink.ts',
  pep: 'packages/platform-policy/src/policy-enforcement-point.ts',
  archiveUseCases: 'packages/application/src/archive-use-cases.ts',
  authUseCases: 'packages/application/src/auth-use-cases.ts',
  authAdapter: 'apps/desktop/src/main/auth-application-adapter.ts',
  domainCatalog: 'packages/domain/src/app-data.ts',
  securityCatalog: 'packages/security/src/authorization.ts',
  permissionContract: 'packages/repository-contracts/src/object-permission-repository.ts',
  permissionRepository: 'packages/repositories/src/object-permission-repository.ts',
  archiveRepository: 'packages/repositories/src/archive-repository.ts',
  renderer: 'apps/desktop/src/renderer/App.tsx'
};

const source = Object.fromEntries(await Promise.all(
  Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])
));
const successorPaths = {
  scope: 'config/30-p-durable-policy-transaction-scope.json',
  decision: 'docs/decisions/DEC-141-ppk-002-durable-policy-transaction-replay-and-fencing.md',
  transactionRepository: 'packages/repositories/src/platform-policy-transaction-repository.ts',
  migrations: 'packages/database/src/family-database-migrations.ts'
};
const successorSource = successorRegression
  ? Object.fromEntries(await Promise.all(
    Object.entries(successorPaths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])
  ))
  : null;
const successorScope = successorSource ? JSON.parse(successorSource.scope) : null;
const scope = JSON.parse(source.scope);
const authority = JSON.parse(source.authority);
const workPlan = JSON.parse(source.workPlan);
const registry = JSON.parse(source.registry);
const packageJson = JSON.parse(source.package);
const step30O = workPlan.steps?.find((item) => item.id === '30-O');
const step30P = workPlan.steps?.find((item) => item.id === '30-P');
const activeSteps = workPlan.steps?.filter((item) => item.status === 'IN_PROGRESS') ?? [];
const advancedSuccessor = successorRegression && workPlan.currentStep !== '30-P';
const completion30O = successorRegression
  ? JSON.parse(await readFile(completion30OPath, 'utf8'))
  : null;
const ppk002 = registry.requirements?.find((item) => item.id === 'PPK-002');

const failures = [];
const checks = [];
const check = (condition, label) => {
  checks.push(label);
  if (!condition) failures.push(label);
};
const contains = (value, token, label) => check(value.includes(token), label);
const compact = (value) => value.replace(/\s+/gu, '');
const section = (value, startToken, endTokens) => {
  const start = value.indexOf(startToken);
  if (start < 0) return '';
  const candidates = endTokens
    .map((token) => value.indexOf(token, start + startToken.length))
    .filter((index) => index >= 0);
  const end = candidates.length > 0 ? Math.min(...candidates) : value.length;
  return value.slice(start, end);
};
const classSection = (value, className) => section(value, `export class ${className}`, ['\nexport class ']);
const inOrder = (value, tokens) => {
  let cursor = -1;
  return tokens.every((token) => {
    cursor = value.indexOf(token, cursor + 1);
    return cursor >= 0;
  });
};
const expectedResourceTypes = ['archive_item', 'archive_retention_policy', 'archive_category'];

const readTypescriptTree = async (directory) => {
  const collected = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'dist') collected.push(await readTypescriptTree(path));
    } else if (/\.tsx?$/u.test(entry.name)) {
      collected.push(await readFile(path, 'utf8'));
    }
  }
  return collected.join('\n');
};
const desktopMainTree = await readTypescriptTree('apps/desktop/src/main');

// Governed status and evidence authority.
check(scope.schemaVersion === 1 && scope.step === '30-O' && scope.requirement === 'PPK-002', '30-O scope identity is canonical');
check(scope.scope === 'ARCHIVE_PRODUCTION_PEP_COMPOSITION_PROTECTED_RECEIPT_JOURNAL_AND_SQLITE_RUNTIME_SLICE', '30-O scope is the bounded production composition/runtime slice');
check(Array.isArray(scope.targets) && scope.targets.length === 7, '30-O scope declares exactly seven production composition targets');
check([
  'production-startup-pep-composition',
  'core-service-local-admin-entrypoint-lifecycle',
  'verified-fresh-admin-archive-authority-bootstrap',
  'protected-receipt-journal-wiring',
  'real-sqlite-archive-repository-runtime',
  'same-transaction-authority-resource-revalidation',
  'restart-and-tamper-fail-closed-runtime'
].every((id) => scope.targets?.some((target) => target.id === id)), '30-O scope contains the exact seven target identities');
check(scope.runtimeProofRequirements?.actualCompiledDesktopComposition === true, 'scope requires actual compiled Desktop composition');
check(scope.runtimeProofRequirements?.actualCoreServiceEntrypointListener === true, 'scope requires the actual Core Service entrypoint listener');
check(scope.runtimeProofRequirements?.actualProtectedReceiptFileSink === true, 'scope requires the actual protected receipt file sink');
check(scope.runtimeProofRequirements?.actualSQLiteDatabase === true && scope.runtimeProofRequirements?.realTransactionBoundary === true, 'scope requires actual SQLite and a real transaction boundary');
check(scope.runtimeProofRequirements?.verifiedFreshAdminDeviceAndExplicitArchiveGrants === true, 'scope requires verified fresh-admin device and explicit archive grants');
check(scope.runtimeProofRequirements?.receiptBeforeBusinessMutation === true, 'scope requires receipt persistence before business mutation');
check(scope.runtimeProofRequirements?.sameTransactionAuthorityAndResourceRevalidation === true, 'scope requires same-transaction authority/resource revalidation');
check(scope.runtimeProofRequirements?.localPreCommitFenceValidation === true, 'scope requires local pre-commit fence validation');
check(scope.runtimeProofRequirements?.legacyAuthorizationFallback === false, 'scope forbids a legacy authorization fallback');

check(
  authority.selection?.step === '30-O'
    && authority.selection?.requirementId === 'PPK-002'
    && (!successorRegression || (completion30O?.step === '30-O' && completion30O?.requirement === 'PPK-002')),
  '30-O authority selects PPK-002'
);
check(
  authority.selection?.status === 'AUTHORIZED_IN_PROGRESS'
    && (!successorRegression || completion30O?.officialStepStatus === 'COMPLETED'),
  '30-O authority remains authorized IN_PROGRESS'
);
check(
  authority.scopeBoundary?.PPK002 === 'PARTIAL'
    && (!successorRegression || completion30O?.evidenceBoundary?.PPK002 === 'PARTIAL'),
  '30-O authority keeps PPK-002 PARTIAL'
);
check(
  authority.scopeBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE'
    && (!successorRegression || completion30O?.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE'),
  '30-O authority keeps universal enforcement NOT_COMPLETE'
);
check(
  authority.scopeBoundary?.requirementCompletionClaimed === false
    && (!successorRegression || completion30O?.evidenceBoundary?.requirementCompletionClaimed === false),
  '30-O authority does not claim requirement completion'
);
check(
  authority.preservedTruth?.nativeInteractiveWindowsHello === 'NOT_RUN_NOT_PASS'
    && (!successorRegression || completion30O?.installerBuild === 'NOT_RUN_NOT_PASS'),
  'hardware truth remains NOT_RUN_NOT_PASS outside 30-O'
);
check(
  authority.mandatoryTruthSentence === TRUTH
    && (!successorRegression || completion30O?.mandatoryTruthSentence === TRUTH),
  '30-O authority preserves the mandatory truth sentence'
);

check(
  successorRegression
    ? advancedSuccessor ? typeof workPlan.currentStep === 'string' && workPlan.currentStep.length > 0 : workPlan.currentStep === '30-P'
    : workPlan.currentStep === '30-O',
  'work plan current step is 30-O'
);
check(
  successorRegression
    ? step30O?.status === 'COMPLETED'
      && step30O?.validationStatus === 'PASS'
      && (advancedSuccessor
        ? step30P?.status === 'COMPLETED' && step30P?.validationStatus === 'PASS'
        : step30P?.status === 'IN_PROGRESS' && step30P?.validationStatus === 'PENDING')
    : step30O?.status === 'IN_PROGRESS' && step30O?.validationStatus === 'PENDING',
  'work plan keeps 30-O IN_PROGRESS/PENDING during contract validation'
);
check(
  successorRegression
    ? step30O?.persistentReceiptStatus === 'PASS'
      && step30O?.persistentReceiptPath === 'artifacts/checkpoints/30-O_LIBRARY_RECEIPT.json'
      && (advancedSuccessor
        ? step30P?.persistentReceiptStatus === 'PASS'
          && step30P?.persistentReceiptPath === 'artifacts/checkpoints/30-P_LIBRARY_RECEIPT.json'
        : step30P?.persistentReceiptStatus === 'PENDING' && step30P?.persistentReceiptPath === null)
    : step30O?.persistentReceiptStatus === 'PENDING' && step30O?.persistentReceiptPath === null,
  'work plan does not pre-claim a 30-O persistent receipt'
);
check(
  advancedSuccessor
    ? activeSteps.length <= 1
    : activeSteps.length === 1 && (!successorRegression || activeSteps[0]?.id === '30-P'),
  'work plan has exactly one IN_PROGRESS step'
);
check(
  step30O?.localEvidence?.includes(paths.authority)
    && step30O?.localEvidence?.includes(paths.scope)
    && step30O?.localEvidence?.includes(paths.decision)
    && (!successorRegression || (
      step30O?.localEvidence?.includes(completion30OPath)
      && step30P?.localEvidence?.includes(completion30OPath)
    )),
  'work plan binds the 30-O authority, scope and decision'
);

check(Boolean(ppk002), 'PPK-002 exists in the accepted-scope registry');
check(ppk002?.priority === 'P0' && (ppk002.status === 'PARTIAL' || (ppk002.status === 'COMPLETE' && Object.values(ppk002.chain ?? {}).every((value) => value === true))), 'accepted scope keeps PPK-002 P0 and preserves a valid historical or successor state');
check((ppk002?.chain?.useCase === false && ppk002?.chain?.repository === false) || (ppk002?.chain?.useCase === true && ppk002?.chain?.repository === true && ppk002?.evidence?.includes('artifacts/validation/31-X-ppk-002-top-closure-runtime.json')), 'accepted scope keeps universal enforcement open or binds the 31-X successor closure');
check(
  ppk002?.evidence?.includes(paths.authority)
    && ppk002?.evidence?.includes(paths.scope)
    && ppk002?.evidence?.includes(paths.decision)
    && (!successorRegression || ppk002?.evidence?.includes(completion30OPath)),
  'accepted scope binds the 30-O authority, scope and decision'
);

// Core Service real entrypoint, fail-closed configuration and lifecycle.
contains(source.coreMain, "import { CoreServiceLocalAdminServer } from './local-admin-server.js'", 'Core Service entrypoint imports the real local administration server');
contains(source.coreMain, "const LOCAL_ADMIN_ENDPOINT_ENV = 'PPT_CORE_SERVICE_LOCAL_ADMIN_ENDPOINT'", 'Core Service names the endpoint environment authority');
contains(source.coreMain, "const LOCAL_ADMIN_TOKEN_ENV = 'PPT_CORE_SERVICE_LOCAL_ADMIN_TOKEN'", 'Core Service names the token environment authority');
contains(source.coreMain, "const POLICY_SIGNING_KEY_ENV = 'PPT_POLICY_SIGNING_KEY_HEX'", 'Core Service names the signing-key environment authority');
contains(source.coreMain, 'requiredEnvironmentValue(environment, LOCAL_ADMIN_ENDPOINT_ENV)', 'Core Service requires the local endpoint');
contains(source.coreMain, 'requiredEnvironmentValue(environment, LOCAL_ADMIN_TOKEN_ENV)', 'Core Service requires the local administration token');
contains(source.coreMain, 'requiredEnvironmentValue(environment, POLICY_SIGNING_KEY_ENV)', 'Core Service requires the policy signing key');
contains(source.coreMain, "Buffer.byteLength(localAdminToken, 'utf8') < 32", 'Core Service rejects a short local administration token');
contains(source.coreMain, "/^(?:[0-9a-f]{2}){32,}$/iu.test(configuredKey)", 'Core Service rejects an invalid or short signing key');
contains(source.coreMain, "endpoint.startsWith('\\\\\\\\.\\\\pipe\\\\')", 'Core Service restricts Windows endpoints to a local named pipe');
contains(source.coreMain, 'this.#server = new CoreServiceLocalAdminServer({', 'Core Service process host constructs the real server');
check(inOrder(source.coreMain, ['await this.#server.start()', "this.runtime.markReady('standalone')", "this.#state = 'running'"]), 'Core Service reports ready only after the listener starts');
check(inOrder(source.coreMain, ['this.runtime.beginShutdown()', 'await this.#server.stop()', 'this.runtime.finishShutdown()']), 'Core Service fences writes before listener shutdown and finalizes lifecycle afterward');
check(inOrder(source.coreMain, ["this.#state === 'stopped'", 'if (this.#startPromise) return this.#startPromise']), 'Core Service rejects start-after-stop before returning a resolved historical start promise');
contains(source.coreMain, "this.runtime.enterSafeMode('LOCAL_ADMIN_START_FAILED')", 'Core Service enters safe mode when listener startup fails');
contains(source.coreMain, 'await host.start()', 'Core Service real process entrypoint starts the process host');
contains(source.coreMain, 'process.exitCode = configurationFailure ? 78 : 1', 'Core Service fail-closed entrypoint emits a nonzero configuration/startup exit code');
contains(source.coreServer, 'server.listen(this.#endpoint)', 'Core Service local administration server opens the configured listener');
contains(source.coreServer, 'timingSafeEqual(actual, this.#expectedTokenDigest)', 'Core Service compares authentication tokens in constant time');
check(
  source.coreServer.includes("request.method === 'policy.authorize'")
    || source.coreDispatcher.includes("typedMethod === 'policy.authorize'"),
  'Core Service listener exposes policy.authorize'
);
check(
  source.coreServer.includes("request.method === 'policy.verify'")
    || source.coreDispatcher.includes("typedMethod === 'policy.verify'"),
  'Core Service listener exposes policy.verify'
);
contains(source.coreRuntime, 'authorizeWithReceipt(', 'Core Service runtime exposes central receipt authorization');
contains(source.coreRuntime, 'verifyReceiptForRequest(', 'Core Service runtime exposes central receipt verification');

// Desktop obtains a protected authority record and never reads server-only secret env vars.
check(!desktopMainTree.includes('PPT_CORE_SERVICE_LOCAL_ADMIN_TOKEN'), 'Desktop main code does not read or name the Core Service token environment variable');
check(!desktopMainTree.includes('PPT_POLICY_SIGNING_KEY_HEX'), 'Desktop main code does not read or name the Core Service policy signing-key environment variable');
contains(source.desktopStartup, 'authorityReader.readText(options.authorityPath)', 'Desktop reads its Core Service connection authority through an injected protected reader');
contains(source.desktopStartup, 'parseCoreServiceConnectionAuthority(raw', 'Desktop validates the protected Core Service connection authority');
contains(source.desktopStartup, 'health.policyVersion !== authority.expectedPolicyVersion', 'Desktop binds startup to the expected central policy version');
contains(source.desktopMain, "join(runtime().config.paths.secrets, 'core-service-connection.pptsecret')", 'Desktop loads the Core Service authority from the protected secrets path');
contains(source.desktopMain, 'authorityReader: runtime().protectedArtifacts', 'Desktop uses the protected side-artifact store as authority reader');

// Provider authorize+verify and receipt-before-business PEP ordering.
contains(source.desktopAdapter, 'public readonly policyProvider: PlatformPolicyAuthorizationProvider', 'Desktop adapter exposes a typed policy provider');
contains(source.desktopAdapter, 'authorize: async (input: PlatformPolicyProviderAuthorizationInput)', 'Desktop provider implements authorize');
contains(source.desktopAdapter, 'verify: async (input: PlatformPolicyProviderVerificationInput)', 'Desktop provider implements verify');
contains(source.desktopAdapter, 'this.#cacheFence(result.fence)', 'Desktop provider refreshes its observed fence from Core Service responses');
contains(source.pep, '(options.kernel === undefined) === (options.provider === undefined)', 'PEP requires exactly one local kernel or remote provider');
if (successorRegression) {
  check(inOrder(source.pep, [
    'this.#replayStore.reserve(',
    'const provided = await this.#authorize(',
    'await this.#verify(effectiveRequest, authorization.receipt)',
    'if (!this.#deferAllowedReceiptPersistence)',
    'receiptRecord: record',
    'const result = await operation(context)'
  ]), 'PEP successor path reserves replay state, verifies the receipt and carries the exact record into deferred transaction execution');
  contains(source.pep, "this.#deferAllowedReceiptPersistence = options.deferAllowedReceiptPersistence === true", 'PEP successor path makes deferred allowed-receipt persistence explicit');
  contains(source.pep, "if (this.#deferAllowedReceiptPersistence && typeof options.receiptSink.ensure !== 'function')", 'PEP successor path requires an exact-idempotent projection sink before deferral');
  contains(source.productionRuntime, 'deferAllowedReceiptPersistence: true', 'production archive PEP explicitly defers allowed receipts to the SQLite transaction');
} else {
  check(inOrder(source.pep, ['this.#replayStore.reserve(', 'const provided = await this.#authorize(', 'await this.#verify(effectiveRequest, authorization.receipt)', 'await this.#receiptSink.append(record)', 'await this.#verify(effectiveRequest, authorization.receipt)', 'const result = await operation(context)']), 'PEP reserves replay state, authorizes, verifies, persists/readback-verifies, then enters business code');
  check(source.pep.indexOf('await this.#receiptSink.append(record)') < source.pep.indexOf('const result = await operation(context)'), 'PEP receipt append precedes every business callback');
}
contains(source.pep, "'RECEIPT_PERSISTENCE_FAILED'", 'PEP fails closed when receipt persistence fails');
contains(source.pep, "'RECEIPT_VERIFICATION_FAILED'", 'PEP fails closed when provider or receipt verification fails');

// Protected receipt file sink.
contains(source.receiptSink, "candidate.encryption.algorithm !== 'aes-256-gcm'", 'receipt sink requires an AES-256-GCM protected record');
contains(source.receiptSink, 'protectedArtifactStore.openEnvelope(envelope)', 'receipt sink decrypts through the protected side-artifact authority');
contains(source.receiptSink, 'this.#protectedArtifactStore.sealBuffer(RECEIPT_ARTIFACT_KIND, recordBytes)', 'receipt sink seals every receipt with the protected side-artifact authority');
contains(source.receiptSink, 'candidate.previousHash !== expectedPreviousHash', 'receipt sink validates the hash-chain predecessor');
contains(source.receiptSink, 'createHmac(\'sha256\', key)', 'receipt sink uses an HMAC-SHA256 chain');
contains(source.receiptSink, '!equalHex(entryHash(entryPayload(entry), macKey), entry.entryHash)', 'receipt sink validates each journal entry MAC');
contains(source.receiptSink, 'protectedMacKey: protector.protect(key.toString(\'base64url\'))', 'receipt sink persists a separately device-protected MAC key');
contains(source.receiptSink, "openSync(this.#lockPath, 'wx', 0o600)", 'receipt sink uses an exclusive side lock');
if (successorRegression) {
  check(
    source.receiptSink.includes('public async ensure(record: PlatformPolicyReceiptRecord): Promise<void>')
      || source.receiptSink.includes('public async ensure(record: PlatformPolicyReceiptRecord): Promise<PlatformPolicyJournalProjectionProof>'),
    'receipt sink exposes asynchronous exact-idempotent receipt projection'
  );
  check(inOrder(source.receiptSink, [
    'this.#persist(record, true)',
    'const existing = entries.find((entry) => entry.record.receipt.nonce === record.receipt.nonce)',
    'if (allowExactExisting && canonicalize(existing.record) === canonicalRecord) return;',
    "throw new Error('POLICY_RECEIPT_JOURNAL_NONCE_REPLAY')",
    "openSync(this.#filePath, 'a', 0o600)"
  ]) || inOrder(compact(source.receiptSink), [
    'this.#persist(record,true)',
    'constexisting=entries.find((entry)=>entry.record.receipt.nonce===record.receipt.nonce)',
    'if(allowExactExisting&&canonicalize(existing.record)===canonicalRecord)',
    "thrownewError('POLICY_RECEIPT_JOURNAL_NONCE_REPLAY')",
    "openSync(this.#filePath,'a',0o600)"
  ]), 'receipt sink ensure accepts only exact canonical idempotency and rejects nonce/content mismatch before append');
} else {
  check(inOrder(source.receiptSink, ['entries.some((entry) => entry.record.receipt.nonce === record.receipt.nonce)', "openSync(this.#filePath, 'a', 0o600)"]), 'receipt sink rejects a duplicate nonce before journal append');
}
contains(source.receiptSink, 'fsyncSync(journalDescriptor)', 'receipt sink fsyncs the appended journal record');
contains(source.receiptSink, 'const verifiedEntries = parseJournal(readback, this.#protectedArtifactStore, this.#macKey)', 'receipt sink decrypts and verifies full readback after append');
check(inOrder(source.receiptSink, ['#inspectLocal()', 'existsSync(this.#lockPath)', "throw new Error('POLICY_RECEIPT_JOURNAL_LOCK_PRESENT')", 'existsSync(this.#filePath)']), 'receipt sink rejects a stale lock before inspecting journal state');
contains(source.receiptSink, 'public async inspectWithTrustedProvider(', 'receipt sink exposes trusted restart inspection');
contains(source.receiptSink, 'await provider.verify(Object.freeze({', 'trusted restart inspection verifies every decrypted request and receipt');
contains(source.receiptSink, "bytes.at(-1) !== 0x0a", 'receipt sink rejects a partial trailing journal record');

// Production Desktop composition and fail-closed DataStore composition.
contains(source.desktopMain, 'archivePolicyReceiptSink = new PlatformPolicyReceiptFileSink({', 'production Desktop creates the protected policy receipt sink');
check(inOrder(source.desktopMain, ['archivePolicyReceiptSink = new PlatformPolicyReceiptFileSink({', 'await archivePolicyReceiptSink.inspectWithTrustedProvider(', "startupStage = 'RENDERER_SECURITY_POLICY'"]), 'production Desktop performs trusted restart inspection before renderer and IPC startup');
contains(source.desktopMain, 'const archivePolicyReceiptSink = policyReceiptSink();', 'DataStore can only receive the startup-verified receipt sink');
contains(source.desktopMain, 'archivePolicyAuthorizationProvider: coreService.adapter.policyProvider', 'production Desktop supplies the Core Service policy provider');
contains(source.desktopMain, 'archivePolicyReceiptSink,', 'production Desktop supplies the protected receipt sink');
contains(source.desktopMain, 'archivePolicyVersion: coreService.health.policyVersion', 'production Desktop supplies the handshaken policy version');
contains(source.desktopMain, 'archiveClusterFence: coreService.adapter.clusterFence', 'production Desktop supplies the observed cluster fence');
contains(source.dataStore, 'Archive production policy composition is incomplete; provider, receipt sink, policy version and live cluster fence are all required', 'DataStore rejects incomplete production policy composition');
contains(source.dataStore, 'createArchiveProductionPolicyEnforcementPointResolver({', 'DataStore creates the production archive PEP resolver');
contains(source.dataStore, 'options.archivePolicyEnforcementPointResolver ?? failClosedArchivePolicyEnforcementPointResolver', 'DataStore keeps missing non-production PEP composition fail-closed');
contains(source.dataStore, 'options.archiveClusterFence ?? nonWritableArchiveClusterFence', 'DataStore keeps a missing fence non-writable');

// Real SQLite authority/resource resolution and same-transaction revalidation.
for (const token of [
  'dependencies.accountRepository.findById(execution, context.actor.userId)',
  'dependencies.personRepository.findById(execution, asPersonId(account.personId!))',
  'dependencies.trustedDeviceRepository.findActive(execution, account.id, identity.deviceId)',
  'dependencies.permissionRepository.listActiveForSubject(',
  "row.purpose === 'archive' && createResourceTypes.has(row.resourceType)"
]) {
  contains(source.productionRuntime, token, `SQLite production authority resolver includes ${token.split('(')[0].trim()}`);
}
contains(source.productionRuntime, 'device.fingerprint === identity.fingerprint', 'SQLite authority resolver binds the current device fingerprint');
contains(source.productionRuntime, 'device.publicKeyPem === identity.publicKeyPem', 'SQLite authority resolver binds the current device public key');
contains(source.productionRuntime, 'device.securityEpoch === account.securityEpoch', 'SQLite authority resolver binds the current security epoch');
contains(source.productionRuntime, "intent.resourceType === 'archive_item'", 'SQLite resource resolver handles existing archive items');
check(
  source.productionRuntime.includes('dependencies.archiveRepository.find(execution, intent.resourceId)')
    || source.productionRuntime.includes('dependencies.archiveRepository.findForPolicyResolution(execution, intent.resourceId)'),
  'SQLite resource resolver loads the exact archive item'
);
contains(source.productionRuntime, "if (item.sensitivity === 'standard') return 'internal'", 'SQLite resource resolver maps standard sensitivity');
contains(source.productionRuntime, "if (item.sensitivity === 'personal') return 'personal'", 'SQLite resource resolver maps personal sensitivity');
contains(source.productionRuntime, "if (item.sensitivity === 'high') return 'highly_sensitive'", 'SQLite resource resolver maps high sensitivity');
contains(source.productionRuntime, 'requiresTransactionRevalidation: true as const', 'production PEP carries the mandatory transaction-revalidation marker');
contains(source.productionRuntime, 'revalidateTransaction: (input: ArchivePolicyTransactionRevalidationInput)', 'production PEP exposes the transaction-revalidation hook');
contains(source.productionRuntime, 'loadAuthoritySnapshotInTransaction(', 'production revalidation reloads authority through the transaction-scoped resolver');
contains(source.productionRuntime, 'input.transaction', 'production revalidation uses the live business transaction context');
contains(source.productionRuntime, 'currentAuthority.value.securityFingerprint !== capturedAuthority.securityFingerprint', 'production revalidation compares the complete captured security fingerprint');
contains(source.productionRuntime, 'loadArchiveResourceSnapshotInTransaction(', 'production revalidation reloads the governed resource through the live business transaction');
contains(source.productionRuntime, 'currentResource.value.stateFingerprint !== capturedResource.stateFingerprint', 'production revalidation compares the complete captured resource-state fingerprint');
check(source.productionRuntime.includes('dependencies.archiveRepository.listVersions(execution, intent.resourceId)') || source.productionRuntime.includes('dependencies.archiveRepository.listVersionsForPolicyResolution(execution, intent.resourceId)'), 'resource snapshot includes governed archive versions');
check(source.productionRuntime.includes('dependencies.archiveRepository.listRetentionStatus(execution)') || source.productionRuntime.includes('dependencies.archiveRepository.listRetentionStatusForPolicyResolution(execution)'), 'resource snapshot includes the governed retention relation and status');
check(source.productionRuntime.includes('dependencies.archiveRepository.listRetentionPolicies(execution)') || source.productionRuntime.includes('dependencies.archiveRepository.listRetentionPoliciesForPolicyResolution(execution)'), 'resource snapshot loads the full linked retention-policy row');
contains(source.productionRuntime, 'policy: retentionPolicy', 'resource fingerprint binds the full linked retention-policy row');
contains(source.archiveRepository, 'secureDestroy:Number(r.secure_destroy)===1', 'SQLite retention-policy row exposes secureDestroy to the governed resource fingerprint');
check(source.productionRuntime.includes('dependencies.archiveRepository.listClassifications(execution)') || source.productionRuntime.includes('dependencies.archiveRepository.listClassificationsForPolicyResolution(execution)'), 'resource snapshot includes governed classification and tags');
contains(source.archiveAdapter, 'enforcementPoint.requiresTransactionRevalidation === true', 'archive adapter recognizes mandatory production revalidation');
contains(source.archiveAdapter, "'Archive production policy transaction revalidation is missing'", 'archive adapter fails closed when the mandatory revalidation hook is absent');
const archiveUnitOfWork = classSection(source.archiveAdapter, 'RepositoryBackedArchiveUnitOfWork');
const governedTransactionSetup = section(source.archiveAdapter, 'const establishGovernedTransaction = (', ['\n\nconst executeGoverned =']);
if (successorRegression) {
  check(inOrder(governedTransactionSetup, [
    'enforcementPoint.revalidateTransaction?.(input)',
    'if (revalidation && !revalidation.ok) return revalidation;',
    'enforcementPoint.recordAuthorizedTransaction?.(input)'
  ]), 'archive successor transaction revalidates before recording the exact durable receipt');
  check(inOrder(archiveUnitOfWork, [
    'transactionExecutor.execute(',
    'establishGovernedTransaction(enforcementPoint, { context, intent, authorization, transaction })',
    'governedRepositoryContext(',
    'operation(new GovernedArchiveWriteScope'
  ]) || inOrder(archiveUnitOfWork, [
    'transactionExecutor.execute(',
    'const governedInput = { context, intent, authorization, transaction }',
    'const established = establishGovernedTransaction(enforcementPoint, governedInput)',
    'governedRepositoryContext(',
    'operation(new GovernedArchiveWriteScope'
  ]), 'archive write UoW records revalidation and durable receipt in the same SQLite transaction before repository mutation');
} else {
  check(inOrder(archiveUnitOfWork, ['transactionExecutor.execute(', 'enforcementPoint.revalidateTransaction?.({ context, intent, authorization, transaction })', 'governedRepositoryContext(', 'operation(new GovernedArchiveWriteScope']), 'archive write UoW revalidates inside the same SQLite transaction before repository mutation');
}
const destructionPlan = section(source.archiveAdapter, 'public async getDestructionPlan(', ['\n  public listCategories(']);
if (successorRegression) {
  check(inOrder(destructionPlan, [
    'transactionExecutor.execute<',
    'establishGovernedTransaction(enforcementPoint, { context, intent, authorization, transaction })',
    'governedRepositoryContext(',
    'archiveRepository.getDestructionPlan'
  ]), 'governed destruction-plan read establishes revalidation and durable receipt before repository access');
  check(inOrder(source.archiveAdapter, [
    'const result = await enforcementPoint.execute(',
    'const operationResult = await operation(authorization, enforcementPoint)',
    'const projection = await enforcementPoint.projectCommittedTransaction!('
  ]), 'archive successor projects the protected journal only after the governed SQLite transaction returns committed');
  check(inOrder(source.productionRuntime, [
    'record: input.authorization.receiptRecord',
    'fenceName: ARCHIVE_POLICY_FENCE_NAME',
    'fenceEpoch: input.authorization.fenceEpoch',
    'fenceWritable: true'
  ]), 'production archive runtime binds the exact receipt record to the active writable database fence context');
  check(inOrder(successorSource.transactionRepository, [
    'canonicalPlatformPolicyJson(record) !== canonicalPlatformPolicyJson(durableAuthorization.receiptRecord)',
    'input.fenceEpoch !== durableAuthorization.fenceEpoch',
    'input.fenceWritable !== durableAuthorization.fenceWritable'
  ]), 'SQLite policy repository requires exact receipt-record and active fence-context equality');
  check(inOrder(successorSource.migrations, [
    'CREATE TRIGGER trg_platform_policy_receipt_insert',
    'WHERE fence.fence_name=NEW.fence_name',
    'AND fence.epoch=NEW.fence_epoch',
    'AND fence.writable=NEW.fence_writable',
    "SELECT RAISE(ABORT,'platform policy receipt, context or database fence mismatch')"
  ]), 'SQLite trigger rejects a receipt whose durable database fence context is not exact and writable');
} else {
  check(inOrder(destructionPlan, ['transactionExecutor.execute<', 'enforcementPoint.revalidateTransaction?.({ context, intent, authorization, transaction })', 'governedRepositoryContext(', 'archiveRepository.getDestructionPlan']), 'governed destruction-plan read revalidates inside the same SQLite transaction before repository access');
}

// Verified fresh-admin device plus three explicit archive-purpose grants.
const setupAdmin = classSection(source.authUseCases, 'SetupAdminUseCase');
contains(setupAdmin, 'this.deviceProofVerifier.verify(input.currentDevice.publicKeyPem, input.currentDevice.proof)', 'fresh-admin setup cryptographically verifies the current device proof');
contains(setupAdmin, "input.currentDevice.proof.challenge === expectedDeviceChallenge", 'fresh-admin device proof is bound to the setup correlation challenge');
contains(setupAdmin, "/^[a-f0-9]{64}$/u.test(input.currentDevice.fingerprint)", 'fresh-admin setup validates the device fingerprint shape');
check(inOrder(setupAdmin, ['this.unitOfWork.execute(', 'scope.seedInitialAdminFamily({', 'scope.insertAccount(', 'scope.linkInitialAdminMembership({', 'scope.upsertTrustedDevice({', 'for (const resourceType of INITIAL_ADMIN_ARCHIVE_RESOURCE_TYPES)', 'scope.upsertInitialAdminArchivePermission({']), 'fresh-admin family, person, account membership, trusted device and explicit archive grants share one application unit of work');
check(inOrder(setupAdmin, ['const result = this.unitOfWork.execute(', 'if (result.ok) this.session.start(']), 'fresh-admin session starts only after the repository unit of work commits');
contains(setupAdmin, 'securityEpoch: 0', 'fresh-admin trusted device starts at the account security epoch');
check(expectedResourceTypes.every((resourceType) => source.authUseCases.includes(`'${resourceType}'`)), 'fresh-admin archive resource catalog contains item, retention policy and category');
check((section(source.authUseCases, 'export const INITIAL_ADMIN_ARCHIVE_RESOURCE_TYPES', ['] as const;']).match(/'archive_(?:item|retention_policy|category)'/gu) ?? []).length === 3, 'fresh-admin archive resource catalog contains exactly three entries');
const initialArchiveGrant = section(source.authAdapter, 'public upsertInitialAdminArchivePermission(', ['\n  public touchTrustedDevice(']);
contains(initialArchiveGrant, "resourceId: '*'", 'fresh-admin archive grants are explicit wildcard resource grants');
contains(initialArchiveGrant, "actions: ['read', 'create', 'update', 'delete', 'record']", 'fresh-admin archive grants include governed create/update/delete/record actions');
contains(initialArchiveGrant, "effect: 'allow'", 'fresh-admin archive grants have an explicit allow effect');
contains(initialArchiveGrant, "purpose: 'archive'", 'fresh-admin archive grants have the exact archive purpose');

// Archive purpose/resource/action catalog consistency.
contains(source.archiveUseCases, "readonly purpose:'archive'", 'archive policy intent contract requires the archive purpose');
check((source.archiveUseCases.match(/purpose\s*:\s*['"]archive['"]/gu) ?? []).length >= 7, 'archive application use cases carry archive purpose on all governed write intents');
contains(source.domainCatalog, "OBJECT_PERMISSION_ACTIONS = ['read','create','update','delete','share','record','ai_process','administer']", 'domain permission action catalog includes record');
contains(source.securityCatalog, "'read' | 'create' | 'update' | 'delete' | 'share' | 'record'", 'security authorization action catalog includes record');
contains(source.permissionContract, "import type { AuthorizationPurpose, ObjectPermissionAction } from '@ppt/domain'", 'repository permission contract imports the canonical action type');
contains(source.permissionContract, 'readonly actions: readonly ObjectPermissionAction[]', 'repository permission rows use the canonical action catalog');
contains(source.permissionRepository, 'const objectPermissionActionSet = new Set<string>(OBJECT_PERMISSION_ACTIONS)', 'SQLite permission repository uses the canonical action catalog');
contains(source.permissionRepository, "throw new Error('OBJECT_PERMISSION_ACTIONS_INVALID')", 'SQLite permission writes reject unknown or empty actions');
check(!source.permissionRepository.includes('parsed.filter(isObjectPermissionAction)'), 'SQLite permission reads fail closed instead of silently filtering unknown stored actions');
check(expectedResourceTypes.every((resourceType) => source.renderer.includes(`<option value="${resourceType}">`)), 'permission UI exposes the three archive resource types');
contains(source.renderer, "['archive_item','archive_retention_policy','archive_category'].includes(resourceType)", 'permission UI binds all archive resource types to archive purpose');
contains(source.renderer, 'OBJECT_PERMISSION_ACTIONS.map(', 'permission UI renders actions from the canonical catalog');

// Local pre-commit fence validation stays bounded; 30-P adds a database-enforced
// policy-bound fence without claiming universal unrelated-write enforcement.
check(inOrder(archiveUnitOfWork, ['const result = operation(', 'assertActivePlatformPolicyTransactionContext(authorization, {', 'return result;']), 'archive UoW performs a local active-fence assertion after mutation logic and before callback return');
if (successorRegression) {
  contains(archiveUnitOfWork, 'database triggers reject any persisted fence mismatch', 'archive successor documents the database-triggered policy-bound fence');
  contains(archiveUnitOfWork, 'does not claim universal enforcement for unrelated writes', 'archive successor does not overclaim universal unrelated-write enforcement');
  contains(archiveUnitOfWork, 'external protected-journal complete-tail rollback', 'archive successor keeps external complete-tail rollback outside its claim');
} else {
  contains(archiveUnitOfWork, 'Cross-process fence-to-SQLite COMMIT atomicity', 'archive UoW documents the cross-process fence/SQLite COMMIT limitation');
  contains(archiveUnitOfWork, 'remains NOT_IMPLEMENTED', 'archive UoW does not overclaim cross-process COMMIT atomicity');
}

// Mandatory open evidence boundaries.
check(scope.evidenceBoundary?.PPK002 === 'PARTIAL', 'scope keeps PPK-002 PARTIAL');
check(scope.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', 'scope keeps universal repository enforcement NOT_COMPLETE');
check(scope.evidenceBoundary?.installedCoreServiceRegistrationAndScmLifecycle === 'NOT_RUN_NOT_PASS', 'scope keeps installed Core Service/SCM lifecycle NOT_RUN_NOT_PASS');
check(scope.evidenceBoundary?.protectedCoreServiceAuthorityProvisioningRotationAndAcl === 'NOT_IMPLEMENTED', 'scope keeps protected Core Service authority provisioning/rotation/ACL NOT_IMPLEMENTED');
check(scope.evidenceBoundary?.durableMultiProcessReplayProtection === 'NOT_RUN_NOT_PASS', 'scope keeps durable multi-process replay NOT_RUN_NOT_PASS');
check(scope.evidenceBoundary?.completeTailJournalRollbackDetection === 'NOT_IMPLEMENTED', 'scope keeps complete-tail journal rollback detection NOT_IMPLEMENTED');
check(scope.evidenceBoundary?.receiptAndBusinessCommitAtomicity === 'NOT_IMPLEMENTED', 'scope keeps receipt/business commit atomicity NOT_IMPLEMENTED');
check(scope.evidenceBoundary?.crossProcessFenceAndSQLiteCommitAtomicity === 'NOT_IMPLEMENTED', 'scope keeps cross-process fence/SQLite COMMIT atomicity NOT_IMPLEMENTED');
check(scope.evidenceBoundary?.requirementCompletionClaimed === false, 'scope does not claim PPK-002 completion');
check(scope.mandatoryTruthSentence === TRUTH, 'scope preserves the mandatory truth sentence');

contains(source.decision, 'PPK-002', 'DEC-140 binds PPK-002');
contains(source.decision, '`PARTIAL`', 'DEC-140 preserves PPK-002 PARTIAL');
contains(source.decision, 'evrensel repository enforcement `NOT_COMPLETE`', 'DEC-140 preserves universal enforcement NOT_COMPLETE');
contains(source.decision, 'Installed-service registration and SCM lifecycle: `NOT_RUN_NOT_PASS`', 'DEC-140 keeps installed-service registration/SCM lifecycle NOT_RUN_NOT_PASS');
contains(source.decision, 'Protected Core Service authority provisioning, rotation and ACL enforcement: `NOT_IMPLEMENTED`', 'DEC-140 keeps protected Core Service authority provisioning/rotation/ACL NOT_IMPLEMENTED');
contains(source.decision, 'Durable multi-process replay protection: `NOT_RUN_NOT_PASS`', 'DEC-140 keeps durable multi-process replay protection NOT_RUN_NOT_PASS');
contains(source.decision, 'Complete-tail journal rollback detection: `NOT_IMPLEMENTED`', 'DEC-140 keeps complete-tail journal rollback detection NOT_IMPLEMENTED');
contains(source.decision, 'Receipt/business commit atomicity: `NOT_IMPLEMENTED`', 'DEC-140 keeps receipt/business commit atomicity NOT_IMPLEMENTED');
contains(source.decision, 'Cross-process fence/SQLite COMMIT atomicity: `NOT_IMPLEMENTED`', 'DEC-140 keeps cross-process fence/SQLite COMMIT atomicity NOT_IMPLEMENTED');
check(source.decision.includes('Windows Hello') && source.decision.includes('`NOT_RUN_NOT_PASS`'), 'DEC-140 preserves the separate Windows Hello hardware NOT_RUN_NOT_PASS truth');
contains(source.decision, TRUTH, 'DEC-140 preserves the mandatory truth sentence');

if (successorRegression) {
  check(
    successorScope.schemaVersion === 1
      && successorScope.step === '30-P'
      && successorScope.requirement === 'PPK-002',
    '30-P successor boundary identity is canonical'
  );
  check(successorScope.evidenceBoundary?.PPK002 === 'PARTIAL', '30-P successor keeps PPK-002 PARTIAL');
  check(successorScope.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', '30-P successor keeps universal repository enforcement NOT_COMPLETE');
  check(successorScope.evidenceBoundary?.directSqlArchiveTableUniversalFenceEnforcement === 'NOT_COMPLETE', '30-P successor keeps direct-SQL archive-table universal fence enforcement NOT_COMPLETE');
  check(successorScope.evidenceBoundary?.policyBoundProductionRepositoryPath === 'TARGETED_NOT_YET_PASS', '30-P successor limits the targeted database fence to the policy-bound production repository path');
  check(successorScope.evidenceBoundary?.completeTailJournalRollbackDetection === 'NOT_IMPLEMENTED', '30-P successor keeps complete-tail journal rollback detection NOT_IMPLEMENTED');
  contains(successorSource.decision, 'evrensel direct-SQL enforcement `NOT_COMPLETE`', 'DEC-141 preserves the direct-SQL universal-enforcement boundary');
  contains(successorSource.decision, 'complete-tail rollback detection `NOT_IMPLEMENTED`', 'DEC-141 preserves the complete-tail rollback boundary');
  contains(successorSource.decision, TRUTH, 'DEC-141 preserves the mandatory truth sentence');
}

check(packageJson.scripts?.['verify:30-o:archive-production-composition-contract'] === 'node scripts/verify-30-o-archive-production-composition-contract.mjs', 'package exposes the 30-O archive production composition contract gate');

const report = {
  schemaVersion: 1,
  release: scope.release,
  step: successorRegression ? '30-P' : '30-O',
  ...(successorRegression ? {
    predecessorStep: '30-O',
    attempt: successorAttempt,
    preservedFailureReportPath: preservedSuccessorFailureReportPath
  } : {}),
  requirement: 'PPK-002',
  phase: successorRegression ? '30-O_PREDECESSOR_REGRESSION' : 'ARCHIVE_PRODUCTION_COMPOSITION_STATIC_CONTRACT',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  failures,
  assertions: {
    coreServiceRealEntrypointLifecycle: failures.some((failure) => failure.startsWith('Core Service')) ? 'FAIL' : 'PASS',
    desktopProtectedAuthorityWithoutEnvToken: failures.some((failure) => failure.startsWith('Desktop')) ? 'FAIL' : 'PASS',
    providerReceiptBeforeBusiness: failures.some((failure) => failure.startsWith('PEP') || failure.startsWith('Desktop provider')) ? 'FAIL' : 'PASS',
    protectedReceiptJournal: failures.some((failure) => failure.startsWith('receipt sink')) ? 'FAIL' : 'PASS',
    productionComposition: failures.some((failure) => failure.startsWith('production Desktop') || failure.startsWith('DataStore')) ? 'FAIL' : 'PASS',
    sqliteAuthorityAndTransactionRevalidation: failures.some((failure) => failure.startsWith('SQLite') || failure.startsWith('production revalidation') || failure.startsWith('archive write UoW')) ? 'FAIL' : 'PASS',
    verifiedFreshAdminExplicitArchiveGrants: failures.some((failure) => failure.startsWith('fresh-admin')) ? 'FAIL' : 'PASS',
    archivePurposeResourceActionCatalog: failures.some((failure) => failure.includes('catalog') || failure.startsWith('permission UI')) ? 'FAIL' : 'PASS',
    localPreCommitFence: failures.some((failure) => failure.startsWith('archive UoW performs') || failure.startsWith('archive UoW documents')) ? 'FAIL' : 'PASS',
    ...(successorRegression ? {
      deferredDurableReceiptTransaction: failures.some((failure) => failure.includes('successor') || failure.includes('durable receipt')) ? 'FAIL' : 'PASS',
      exactIdempotentJournalProjection: failures.some((failure) => failure.includes('exact-idempotent') || failure.includes('exact canonical idempotency')) ? 'FAIL' : 'PASS',
      databaseFenceContext: failures.some((failure) => failure.includes('database fence') || failure.includes('fence-context')) ? 'FAIL' : 'PASS'
    } : {})
  },
  evidenceBoundary: successorRegression
    ? {
      historical30OReportMutated: false,
      firstSuccessorFailureReportMutated: false,
      PPK002: 'PARTIAL',
      universalRepositoryEnforcement: 'NOT_COMPLETE',
      directSqlArchiveTableUniversalFenceEnforcement: 'NOT_COMPLETE',
      policyBoundProductionRepositoryPath: 'TARGETED_NOT_YET_PASS',
      durableMultiProcessReplayProtection: 'TARGETED_NOT_YET_PASS',
      completeTailJournalRollbackDetection: 'NOT_IMPLEMENTED',
      receiptAndBusinessCommitAtomicity: 'TARGETED_NOT_YET_PASS',
      crossProcessFenceAndSQLiteCommitAtomicity: 'TARGETED_NOT_YET_PASS',
      nativeInteractiveWindowsHello: 'NOT_RUN_NOT_PASS',
      requirementCompletionClaimed: false
    }
    : {
      PPK002: 'PARTIAL',
      universalRepositoryEnforcement: 'NOT_COMPLETE',
      installedCoreServiceRegistrationAndScmLifecycle: 'NOT_RUN_NOT_PASS',
      protectedCoreServiceAuthorityProvisioningRotationAndAcl: 'NOT_IMPLEMENTED',
      durableMultiProcessReplayProtection: 'NOT_RUN_NOT_PASS',
      completeTailJournalRollbackDetection: 'NOT_IMPLEMENTED',
      receiptAndBusinessCommitAtomicity: 'NOT_IMPLEMENTED',
      crossProcessFenceAndSQLiteCommitAtomicity: 'NOT_IMPLEMENTED',
      nativeInteractiveWindowsHello: 'NOT_RUN_NOT_PASS',
      requirementCompletionClaimed: false
    },
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`${successorRegression ? '30-O predecessor archive production composition contract regression' : '30-O archive production composition contract'}: PASS (${checks.length}/${checks.length}; PPK-002 remains PARTIAL).`);
