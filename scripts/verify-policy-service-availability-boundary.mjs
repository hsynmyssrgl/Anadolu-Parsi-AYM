import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const AVAILABILITY_POLICY = 'packages/platform-policy/src/policy-service-availability-policy.ts';
const AVAILABILITY_POLICY_INDEX = 'packages/platform-policy/src/index.ts';
const AVAILABILITY_DOMAIN = 'packages/domain/src/policy-service-availability.ts';
const AVAILABILITY_DOMAIN_INDEX = 'packages/domain/src/index.ts';
const AVAILABILITY_USE_CASES = 'packages/application/src/policy-service-availability-use-cases.ts';
const AVAILABILITY_APPLICATION_INDEX = 'packages/application/src/index.ts';
const CORE_CONTRACTS = 'packages/core-service-contracts/src/index.ts';
const CORE_STATE = 'apps/core-service/src/service-state.ts';
const CORE_RUNTIME = 'apps/core-service/src/core-service-runtime.ts';
const CORE_APPLICATION_ADAPTER = 'apps/desktop/src/main/core-service-application-adapter.ts';
const CORE_POLICY_SDK = 'packages/core-service-client/src/core-service-policy-sdk.ts';
const LIVE_OBSERVER = 'apps/desktop/src/main/policy-service-availability-application-adapter.ts';
const STARTUP_CONNECTION = 'apps/desktop/src/main/core-service-startup-connection.ts';
const UNIVERSAL_GATE = 'apps/desktop/src/main/desktop-universal-api-policy-enforcement.ts';
const IPC_INTEGRATION = 'apps/desktop/src/main/ipc-integration-policy.ts';
const IPC_READ_SHARING = 'apps/desktop/src/main/ipc-read-sharing.ts';
const DESKTOP_MAIN = 'apps/desktop/src/main/main.ts';
const PRELOAD = 'apps/desktop/src/main/preload.ts';
const RENDERER_GLOBAL = 'apps/desktop/src/renderer/global.d.ts';
const RENDERER_APP = 'apps/desktop/src/renderer/App.tsx';
const POLICY_ENFORCEMENT_POINT = 'packages/platform-policy/src/policy-enforcement-point.ts';
const STATUS_CHANNEL = 'system:getPolicyServiceAvailabilityBoundary';

// Every production reference to the canonical model must be named here. This
// is deliberately an exact path set: parent directories and regex allowlists
// would let a sibling bypass silently acquire policy authority.
const CANONICAL_REFERENCE_ALLOWLIST = new Set([
  CORE_APPLICATION_ADAPTER,
  CORE_POLICY_SDK,
  CORE_CONTRACTS,
  STARTUP_CONNECTION,
  UNIVERSAL_GATE,
  IPC_INTEGRATION,
  IPC_READ_SHARING,
  DESKTOP_MAIN,
  LIVE_OBSERVER,
  PRELOAD,
  RENDERER_APP,
  RENDERER_GLOBAL,
  AVAILABILITY_APPLICATION_INDEX,
  AVAILABILITY_USE_CASES,
  AVAILABILITY_DOMAIN_INDEX,
  AVAILABILITY_DOMAIN,
  AVAILABILITY_POLICY_INDEX,
  POLICY_ENFORCEMENT_POINT,
  AVAILABILITY_POLICY
]);

const STATUS_CHANNEL_ALLOWLIST = new Set([
  UNIVERSAL_GATE,
  IPC_INTEGRATION,
  IPC_READ_SHARING,
  DESKTOP_MAIN,
  PRELOAD
]);

const REQUIRED_CONTRACT_FILES = new Set([
  ...CANONICAL_REFERENCE_ALLOWLIST,
  CORE_CONTRACTS,
  CORE_STATE,
  CORE_RUNTIME
]);

const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const normalize = (value) => value.replaceAll('\\', '/');
const compact = (value) => value.replace(/\s+/gu, ' ').trim();

const sourceLocation = (source, offset) => {
  const before = source.slice(0, Math.max(0, offset));
  const line = (before.match(/\n/gu) ?? []).length + 1;
  const lastBreak = before.lastIndexOf('\n');
  return { line, column: offset - lastBreak };
};

// This lexer distinguishes executable identifiers/string literals from
// comments. It prevents retired-name prose from becoming a false positive but
// still catches legacy import specifiers and IPC method literals.
const lexicalTokens = (source) => {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    if (character === '/' && next === '/') {
      index += 2;
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }
    if (character === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      index = Math.min(source.length, index + 2);
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      const quote = character;
      const offset = index;
      let value = '';
      index += 1;
      while (index < source.length) {
        const current = source[index];
        if (current === '\\') {
          if (index + 1 < source.length) value += source[index + 1];
          index += 2;
          continue;
        }
        if (current === quote) {
          index += 1;
          break;
        }
        value += current;
        index += 1;
      }
      tokens.push({ kind: 'string', value, offset });
      continue;
    }
    if (character && /[A-Za-z_$]/u.test(character)) {
      const offset = index;
      index += 1;
      while (index < source.length && /[A-Za-z0-9_$]/u.test(source[index])) index += 1;
      tokens.push({ kind: 'identifier', value: source.slice(offset, index), offset });
      continue;
    }
    index += 1;
  }
  return tokens;
};

const markerPresent = (body, marker) => {
  if (typeof marker === 'string') return compact(body).includes(compact(marker));
  marker.lastIndex = 0;
  return marker.test(body);
};

const missingMarkers = (body, markers) => markers
  .filter((marker) => !markerPresent(body, marker))
  .map((marker) => typeof marker === 'string' ? compact(marker) : marker.source);

export const scanPolicyServiceAvailabilitySourceText = (path, source) => {
  const normalizedPath = normalize(path);
  const findings = [];
  const report = (kind, detail, offset = 0) => findings.push({
    path: normalizedPath,
    ...sourceLocation(source, offset),
    kind,
    detail
  });
  const requireMarkers = (kind, markers) => {
    const missing = missingMarkers(source, markers);
    if (missing.length > 0) report(kind, `missing: ${missing.join(' | ')}`);
  };

  let canonicalReference = false;
  for (const token of lexicalTokens(source)) {
    if (token.kind === 'identifier') {
      if (
        token.value.startsWith('PolicyServiceRuntime')
        || token.value.startsWith('policyServiceRuntime')
        || token.value.startsWith('POLICY_SERVICE_RUNTIME')
      ) report('LEGACY_POLICY_SERVICE_RUNTIME_MODEL', token.value, token.offset);
      if (
        token.value.startsWith('PolicyServiceAvailability')
        || token.value.startsWith('policyServiceAvailability')
        || token.value.startsWith('POLICY_SERVICE_AVAILABILITY')
      ) canonicalReference = true;
    } else {
      if (token.value.includes('policy-service-runtime') || token.value === 'policy-runtime.status') {
        report('LEGACY_POLICY_SERVICE_RUNTIME_MODEL', token.value, token.offset);
      }
      if (token.value.includes('policy-service-availability') || token.value === STATUS_CHANNEL) {
        canonicalReference = true;
      }
      if (token.value === STATUS_CHANNEL && !STATUS_CHANNEL_ALLOWLIST.has(normalizedPath)) {
        report('STATUS_CHANNEL_OUTSIDE_EXACT_ALLOWLIST', token.value, token.offset);
      }
    }
  }

  if (normalizedPath.includes('policy-service-runtime')) {
    report('LEGACY_POLICY_SERVICE_RUNTIME_FILE', normalizedPath);
  }
  if (canonicalReference && !CANONICAL_REFERENCE_ALLOWLIST.has(normalizedPath)) {
    report('CANONICAL_AVAILABILITY_REFERENCE_OUTSIDE_EXACT_ALLOWLIST', normalizedPath);
  }

  if (normalizedPath === AVAILABILITY_POLICY) {
    requireMarkers('CANONICAL_AVAILABILITY_POLICY_INCOMPLETE', [
      'export class PolicyServiceAvailabilityPolicy',
      "if (!observation.policyPackageVerified) return decision('deny', 'POLICY_PACKAGE_SIGNATURE_INVALID');",
      'observation.policyVersion !== observation.expectedPolicyVersion',
      'observation.policyPackageVersion !== observation.expectedPolicyPackageVersion',
      'observation.policyPackageSha256 !== observation.expectedPolicyPackageSha256',
      "return decision('deny', 'OBSERVATION_STALE'",
      "observation.lifecycle !== 'ready' && observation.lifecycle !== 'degraded'",
      "return decision('read-only', 'FRESH_VERIFIED_READ_ONLY'",
      "return decision('read-write', 'FRESH_VERIFIED_READ_WRITE'",
      'public assertOperationAllowed('
    ]);
  }

  if (normalizedPath === AVAILABILITY_DOMAIN) {
    requireMarkers('CANONICAL_AVAILABILITY_DOMAIN_INCOMPLETE', [
      'export interface PolicyServiceAvailabilityBoundaryView',
      "readonly enforcement: 'fail-closed';",
      "readonly mode: 'read-write' | 'read-only' | 'deny';",
      'readonly policyPackageVerified: boolean;',
      'readonly mappingGrantsRuntimeAuthority: false;',
      'readonly historicalReceiptGrantsCurrentAuthority: false;'
    ]);
  }

  if (normalizedPath === AVAILABILITY_USE_CASES) {
    requireMarkers('CANONICAL_AVAILABILITY_USE_CASE_INCOMPLETE', [
      'export class EvaluatePolicyServiceAvailabilityUseCase',
      'return this.policy.evaluate(await this.observation.observe());',
      'return this.policy.evaluate(undefined);',
      'export class EnforcePolicyServiceAvailabilityUseCase',
      'this.policy.assertOperationAllowed(input.operation, availability);',
      'export class GetPolicyServiceAvailabilityBoundaryUseCase'
    ]);
  }

  const requiredIndexExport = new Map([
    [AVAILABILITY_POLICY_INDEX, "export * from './policy-service-availability-policy.js';"],
    [AVAILABILITY_DOMAIN_INDEX, "export * from './policy-service-availability.js';"],
    [AVAILABILITY_APPLICATION_INDEX, "export * from './policy-service-availability-use-cases.js';"]
  ]).get(normalizedPath);
  if (requiredIndexExport && !markerPresent(source, requiredIndexExport)) {
    report('CANONICAL_AVAILABILITY_INDEX_EXPORT_MISSING', requiredIndexExport);
  }

  if (normalizedPath === LIVE_OBSERVER) {
    requireMarkers('LIVE_CORE_HEALTH_OBSERVER_OR_STARTUP_PIN_MISSING', [
      'this.#expectedPolicyVersion = options.startupHealth.policyVersion;',
      'this.#expectedPolicyPackageVersion = options.startupHealth.policyPackage.payload.packageVersion;',
      'this.#expectedPolicyPackageSha256 = options.startupHealth.policyPackage.payloadSha256;',
      'public async observe(): Promise<PolicyServiceAvailabilityObservation | undefined>',
      'const health = await this.#adapter.getHealth();',
      'policyPackageVerified: health.policyPackageVerified',
      'policyVersion: health.policyVersion',
      'policyPackageVersion: health.policyPackage.payload.packageVersion',
      'policyPackageSha256: health.policyPackage.payloadSha256',
      'expectedPolicyVersion: this.#expectedPolicyVersion',
      'expectedPolicyPackageVersion: this.#expectedPolicyPackageVersion',
      'expectedPolicyPackageSha256: this.#expectedPolicyPackageSha256',
      'observedAt: health.observedAt',
      'checkedAt: this.#clock()',
      'catch { return undefined; }'
    ]);
  }

  if (normalizedPath === CORE_APPLICATION_ADAPTER) {
    requireMarkers('CORE_PROVIDER_LIVE_OBSERVER_BINDING_MISSING', [
      'CoreServicePolicySdk,',
      'new CoreServicePolicySdk(new GeneratedPolicyServiceClient(this.#client))',
      'const health = await this.#client.health();',
      'this.#policySdk.observeHealth(health);',
      'public bindPolicyServiceAvailabilityObserver(',
      'this.#policySdk.bindPolicyServiceAvailabilityObserver(observer);'
    ]);
  }

  if (normalizedPath === CORE_POLICY_SDK) {
    requireMarkers('CORE_SDK_LIVE_OBSERVER_BINDING_MISSING', [
      "decisionAuthority: 'windows-core-service' as const",
      'observePolicyServiceAvailability: () => this.#observePolicyServiceAvailability?.()',
      'resolvePolicyPackage: () => {',
      'health.policyPackageVerified !== true',
      'this.#clearObservedState();',
      'this.#observePolicyServiceAvailability = observer;'
    ]);
  }

  if (normalizedPath === STARTUP_CONNECTION) {
    requireMarkers('STARTUP_POLICY_PIN_OR_VERIFICATION_MISSING', [
      'health.policyVersion !== authority.expectedPolicyVersion',
      "createHash('sha256').update(stable(policyPackage.payload), 'utf8').digest('hex') !== policyPackage.payloadSha256",
      'policyPackageVerified: health.policyPackageVerified',
      'expectedPolicyVersion: authority.expectedPolicyVersion',
      'expectedPolicyPackageVersion: policyPackage.payload.packageVersion',
      'expectedPolicyPackageSha256: policyPackage.payloadSha256',
      "if (policyServiceAvailability.mode === 'deny')"
    ]);
  }

  if (normalizedPath === UNIVERSAL_GATE) {
    requireMarkers('UNIVERSAL_AVAILABILITY_GATE_INCOMPLETE', [
      `export const POLICY_SERVICE_AVAILABILITY_STATUS_CHANNEL = '${STATUS_CHANNEL}' as const;`,
      'channel === POLICY_SERVICE_AVAILABILITY_STATUS_CHANNEL',
      'const availability = await this.#evaluatePolicyServiceAvailability();',
      "if (availability.mode !== 'read-write') this.#onAvailabilityRestricted?.(availability);",
      "if (availability.mode === 'deny')",
      'if (isDesktopPolicyBootstrapChannel(input.channel))'
    ]);
    const helperStart = source.indexOf('export const isDesktopPolicyServiceAvailabilityStatusChannel');
    const helperEnd = helperStart < 0 ? -1 : source.indexOf(';', helperStart);
    const helper = helperStart >= 0 && helperEnd > helperStart ? source.slice(helperStart, helperEnd + 1) : '';
    if (
      !helper.includes('channel === POLICY_SERVICE_AVAILABILITY_STATUS_CHANNEL')
      || /\.startsWith\s*\(|\.includes\s*\(|\.test\s*\(|\.has\s*\(/u.test(helper)
    ) report('BROAD_OR_MISSING_STATUS_EXCEPTION', compact(helper) || 'status helper missing', Math.max(0, helperStart));

    const executeStart = source.indexOf('public async execute<T>');
    const statusBypass = source.indexOf('if (isDesktopPolicyServiceAvailabilityStatusChannel(input.channel))', executeStart);
    const availabilityGate = source.indexOf('const availability = await this.#evaluatePolicyServiceAvailability();', executeStart);
    const bootstrapBranch = source.indexOf('if (isDesktopPolicyBootstrapChannel(input.channel))', executeStart);
    if (!(executeStart >= 0 && statusBypass > executeStart && availabilityGate > statusBypass && bootstrapBranch > availabilityGate)) {
      report('UNIVERSAL_GATE_NOT_BEFORE_BOOTSTRAP', 'status exception -> availability gate -> bootstrap order required', Math.max(0, executeStart));
    }
  }

  if (normalizedPath === IPC_INTEGRATION) {
    const zeroArgumentStatus = /case\s+'system:getPolicyServiceAvailabilityBoundary':\s*(?:case\s+'[^']+':\s*)*return\s+zeroArguments\(args\);/u;
    if (!zeroArgumentStatus.test(source)) {
      report('STATUS_IPC_NOT_ZERO_ARGUMENT', STATUS_CHANNEL);
    }
  }

  if (normalizedPath === IPC_READ_SHARING) {
    const listStart = source.indexOf('export const IPC_SECURITY_POSTURE_NO_CACHE_CHANNELS');
    const listEnd = listStart < 0 ? -1 : source.indexOf('] as const);', listStart);
    const list = listStart >= 0 && listEnd > listStart ? source.slice(listStart, listEnd) : '';
    const occurrences = list.split(`'${STATUS_CHANNEL}'`).length - 1;
    if (
      occurrences !== 1
      || !source.includes('for (const channel of IPC_SECURITY_POSTURE_NO_CACHE_CHANNELS) policySensitiveChannels.add(channel);')
      || !source.includes('if (policySensitiveChannels.has(channel)) return disabledPolicy;')
    ) report('STATUS_IPC_NO_CACHE_FENCE_MISSING', `no-cache occurrences: ${occurrences}`, Math.max(0, listStart));
  }

  if (normalizedPath === PRELOAD) {
    const zeroArgumentPreload = /getPolicyServiceAvailabilityBoundary\s*:\s*\(\s*\)\s*:\s*Promise<PolicyServiceAvailabilityBoundaryView>\s*=>\s*invoke\(\s*'system:getPolicyServiceAvailabilityBoundary'\s*\)/u;
    if (!zeroArgumentPreload.test(source)) report('STATUS_PRELOAD_NOT_ZERO_ARGUMENT', STATUS_CHANNEL);
  }

  if (normalizedPath === RENDERER_GLOBAL) {
    const zeroArgumentRenderer = /getPolicyServiceAvailabilityBoundary\s*\(\s*\)\s*:\s*Promise<PolicyServiceAvailabilityBoundaryView>/u;
    if (!zeroArgumentRenderer.test(source)) report('STATUS_RENDERER_CONTRACT_NOT_ZERO_ARGUMENT', STATUS_CHANNEL);
  }

  if (normalizedPath === DESKTOP_MAIN) {
    requireMarkers('DESKTOP_AVAILABILITY_COMPOSITION_INCOMPLETE', [
      'startupHealth: coreServiceStartupConnection.health',
      'coreServiceStartupConnection.adapter.bindPolicyServiceAvailabilityObserver(',
      '() => policyServiceObservation.observe()',
      'evaluatePolicyServiceAvailability: () => policyServiceAvailabilityEvaluation().execute()',
      'onAvailabilityRestricted: () => { ipcReadResults.clearAll(); offlineSensitiveCache.lock(',
      `registerIpcHandler('${STATUS_CHANNEL}', ():Promise<PolicyServiceAvailabilityBoundaryView> => policyServiceAvailabilityBoundary().execute());`
    ]);
    const statusRegistration = new RegExp(
      `registerIpcHandler\\('system:getPolicyServiceAvailabilityBoundary',\\s*\\(\\)\\s*:\\s*Promise<PolicyServiceAvailabilityBoundaryView>`,
      'u'
    );
    if (!statusRegistration.test(source)) report('STATUS_MAIN_HANDLER_NOT_ZERO_ARGUMENT', STATUS_CHANNEL);
  }

  if (normalizedPath === CORE_CONTRACTS || normalizedPath === CORE_STATE) {
    requireMarkers('CORE_HEALTH_VERIFICATION_FIELD_MISSING', ['readonly policyPackageVerified: boolean;']);
  }

  if (normalizedPath === CORE_RUNTIME) {
    requireMarkers('CORE_HEALTH_ACTUAL_PACKAGE_VERIFY_MISSING', [
      'policyPackageVerified: this.#policyPackageVerified()',
      'return this.#kernel.verifyPolicyPackage(this.#kernel.policyPackage) === true;',
      'catch { return false; }',
      "return (this.#lifecycle === 'ready' || this.#lifecycle === 'degraded') && this.#policyPackageVerified();",
      'public authorize(request: PlatformPolicyRequest): PlatformPolicyDecision { this.#assertPolicyDecisionServiceAvailable();',
      'public authorizeWithReceipt(request: PlatformPolicyRequest, nonce: string = this.#nonceFactory()): AuthorizedPolicyResult { this.#assertPolicyDecisionServiceAvailable();',
      'if (!this.#policyDecisionServiceAvailable()) { return Object.freeze({ valid: false, fence: this.#fenceSnapshot() });'
    ]);
  }

  if (normalizedPath === POLICY_ENFORCEMENT_POINT) {
    requireMarkers('PEP_AVAILABILITY_OR_READ_ONLY_FENCE_MISSING', [
      'await this.#assertPolicyServiceAvailability(intent.action);',
      "if (!this.#provider || this.#provider.decisionAuthority !== 'windows-core-service') return;",
      "if (availability.mode === 'deny' || action === 'read')",
      "this.#policyServiceAvailability.assertOperationAllowed(action === 'read' ? 'read' : 'mutation', availability);",
      "if (authorization.decision.allowed && !effectiveRequest.clusterWritable && effectiveRequest.action !== 'read')",
      "throw new PlatformPolicyEnforcementError('POLICY_DENIED'"
    ]);
    const verification = source.indexOf('if (!(await this.#verifyWithinDecisionDeadline(effectiveRequest, authorization.receipt)))');
    const readOnlyFence = source.indexOf("if (authorization.decision.allowed && !effectiveRequest.clusterWritable && effectiveRequest.action !== 'read')", verification);
    const signedDenial = source.indexOf('if (!authorization.decision.allowed)', readOnlyFence);
    const denialPersistence = source.indexOf('await this.#appendReceipt(', signedDenial);
    if (!(verification >= 0 && readOnlyFence > verification && signedDenial > readOnlyFence && denialPersistence > signedDenial)) {
      report('PEP_SIGNED_DENIAL_ORDER_INVALID', 'receipt verify -> non-read allow rejection -> signed denial persistence required', Math.max(0, verification));
    }
  }

  return { findings, canonicalReference };
};

const collectProductionSources = async (root) => {
  const zones = [];
  const files = [];
  for (const parent of ['apps', 'packages']) {
    const parentPath = resolve(root, parent);
    for (const entry of await readdir(parentPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sourceRoot = resolve(parentPath, entry.name, 'src');
      try {
        await readdir(sourceRoot);
      } catch {
        continue;
      }
      zones.push(sourceRoot);
    }
  }
  const visit = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const candidate = join(directory, entry.name);
      if (entry.isDirectory()) await visit(candidate);
      else if (entry.isFile() && sourceExtensions.has(extname(entry.name))) files.push(candidate);
    }
  };
  for (const zone of zones) await visit(zone);
  return { zones, files };
};

export const scanPolicyServiceAvailabilityBoundary = async (root = process.cwd()) => {
  const { zones, files } = await collectProductionSources(root);
  const findings = [];
  const canonicalReferencePaths = new Set();
  const availablePaths = new Set();
  let securityRelevantFiles = 0;
  let canonicalPolicyClassDefinitions = 0;

  for (const file of files) {
    const path = normalize(relative(root, file));
    const source = await readFile(file, 'utf8');
    availablePaths.add(path);
    const scanned = scanPolicyServiceAvailabilitySourceText(path, source);
    if (scanned.canonicalReference || REQUIRED_CONTRACT_FILES.has(path)) securityRelevantFiles += 1;
    if (scanned.canonicalReference) canonicalReferencePaths.add(path);
    canonicalPolicyClassDefinitions += source.match(/\bexport\s+class\s+PolicyServiceAvailabilityPolicy\b/gu)?.length ?? 0;
    findings.push(...scanned.findings);
  }

  for (const path of REQUIRED_CONTRACT_FILES) {
    if (!availablePaths.has(path)) findings.push({
      path,
      line: 1,
      column: 1,
      kind: 'REQUIRED_AVAILABILITY_CONTRACT_FILE_MISSING',
      detail: path
    });
  }
  for (const path of CANONICAL_REFERENCE_ALLOWLIST) {
    if (!canonicalReferencePaths.has(path)) findings.push({
      path,
      line: 1,
      column: 1,
      kind: 'CANONICAL_AVAILABILITY_REFERENCE_MISSING',
      detail: path
    });
  }
  if (canonicalPolicyClassDefinitions !== 1) findings.push({
    path: AVAILABILITY_POLICY,
    line: 1,
    column: 1,
    kind: 'CANONICAL_AVAILABILITY_POLICY_DEFINITION_COUNT',
    detail: `expected 1, observed ${canonicalPolicyClassDefinitions}`
  });

  return {
    zones: zones.length,
    files: files.length,
    securityRelevantFiles,
    canonicalReferencePaths: [...canonicalReferencePaths].sort(),
    canonicalPolicyClassDefinitions,
    findings
  };
};

const selfTest = () => {
  const maliciousCases = [
    ['apps/example/src/legacy.ts', 'export class PolicyServiceRuntimeGatePolicy {}', 'LEGACY_POLICY_SERVICE_RUNTIME_MODEL'],
    ['apps/example/src/legacy-method.ts', "const method = 'policy-runtime.status';", 'LEGACY_POLICY_SERVICE_RUNTIME_MODEL'],
    ['apps/example/src/bypass.ts', 'new PolicyServiceAvailabilityPolicy();', 'CANONICAL_AVAILABILITY_REFERENCE_OUTSIDE_EXACT_ALLOWLIST'],
    ['apps/example/src/channel.ts', `const channel = '${STATUS_CHANNEL}';`, 'STATUS_CHANNEL_OUTSIDE_EXACT_ALLOWLIST'],
    [UNIVERSAL_GATE, `export const isDesktopPolicyServiceAvailabilityStatusChannel = (channel) => channel.startsWith('${STATUS_CHANNEL}');`, 'BROAD_OR_MISSING_STATUS_EXCEPTION'],
    [LIVE_OBSERVER, 'export class PolicyServiceAvailabilityApplicationAdapter { observe() { return this.startupHealth; } }', 'LIVE_CORE_HEALTH_OBSERVER_OR_STARTUP_PIN_MISSING'],
    [STARTUP_CONNECTION, 'const policyServiceAvailability = health;', 'STARTUP_POLICY_PIN_OR_VERIFICATION_MISSING'],
    [UNIVERSAL_GATE, `if (isDesktopPolicyBootstrapChannel(input.channel)) run(); const availability = await this.#evaluatePolicyServiceAvailability(); const channel='${STATUS_CHANNEL}';`, 'UNIVERSAL_GATE_NOT_BEFORE_BOOTSTRAP'],
    [IPC_INTEGRATION, `case '${STATUS_CHANNEL}': return accepted();`, 'STATUS_IPC_NOT_ZERO_ARGUMENT'],
    [IPC_READ_SHARING, `const status = '${STATUS_CHANNEL}';`, 'STATUS_IPC_NO_CACHE_FENCE_MISSING'],
    [CORE_RUNTIME, 'return { policyPackageVerified: true };', 'CORE_HEALTH_ACTUAL_PACKAGE_VERIFY_MISSING'],
    [CORE_POLICY_SDK, "export class CoreServicePolicySdk { public readonly policyProvider = {}; }", 'CORE_SDK_LIVE_OBSERVER_BINDING_MISSING'],
    [POLICY_ENFORCEMENT_POINT, "if (authorization.decision.allowed && !effectiveRequest.clusterWritable) throw error;", 'PEP_AVAILABILITY_OR_READ_ONLY_FENCE_MISSING'],
    [DESKTOP_MAIN, `registerIpcHandler('${STATUS_CHANNEL}', (_event, input) => input);`, 'DESKTOP_AVAILABILITY_COMPOSITION_INCOMPLETE']
  ];
  const maliciousFailures = maliciousCases.filter(([path, source, expected]) =>
    !scanPolicyServiceAvailabilitySourceText(path, source).findings.some((finding) => finding.kind === expected));
  if (maliciousFailures.length > 0) {
    throw new Error(`Policy-service availability malicious self-test failed: ${maliciousFailures.length}/${maliciousCases.length}`);
  }

  const benignCases = [
    'const serviceAvailability = network.online;',
    '// PolicyServiceRuntime and policy-runtime.status are retired documentation terms.',
    'const policyRuntimeNotes = Object.freeze([]);',
    "const channel = 'system:getApplicationSecurityProfileGateBoundary';",
    'class AvailabilityIndicator { render() { return true; } }'
  ];
  const benignFindings = benignCases.flatMap((source) =>
    scanPolicyServiceAvailabilitySourceText('apps/example/src/ordinary-feature.ts', source).findings);
  if (benignFindings.length > 0) {
    throw new Error(`Policy-service availability benign self-test produced ${benignFindings.length} false positive(s)`);
  }
  return { malicious: maliciousCases.length, benign: benignCases.length };
};

const main = async () => {
  const assertions = selfTest();
  const rootArgument = process.argv.indexOf('--root');
  const root = rootArgument >= 0 ? resolve(process.argv[rootArgument + 1]) : process.cwd();
  const result = await scanPolicyServiceAvailabilityBoundary(root);
  const legacyFindings = result.findings.filter((finding) => finding.kind.startsWith('LEGACY_'));
  const report = {
    status: result.findings.length === 0 ? 'PASS' : 'FAIL',
    productionSourceZones: result.zones,
    scannedFiles: result.files,
    securityRelevantFiles: result.securityRelevantFiles,
    canonicalAvailabilityReferenceFiles: result.canonicalReferencePaths.length,
    exactCanonicalReferenceAllowlistEntries: CANONICAL_REFERENCE_ALLOWLIST.size,
    exactStatusChannelAllowlistEntries: STATUS_CHANNEL_ALLOWLIST.size,
    canonicalPolicyClassDefinitions: result.canonicalPolicyClassDefinitions,
    legacyPolicyServiceRuntimeReferences: legacyFindings.length,
    broadAllowlistExceptions: 0,
    maliciousSelfTestAssertions: assertions.malicious,
    benignFalsePositiveAssertions: assertions.benign,
    canonicalReferencePaths: result.canonicalReferencePaths,
    findings: result.findings
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) await main();
