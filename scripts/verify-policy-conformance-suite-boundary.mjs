import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const normalize = (value) => value.replaceAll('\\', '/');
const POLICY = 'packages/platform-policy/src/policy-conformance-suite.ts';
const TEST = 'packages/platform-policy/policy-conformance-suite.test.ts';
const USE_CASE = 'packages/application/src/policy-conformance-suite-use-cases.ts';
const MAIN = 'apps/desktop/src/main/main.ts';
const PRELOAD = 'apps/desktop/src/main/preload.ts';
const GLOBAL = 'apps/desktop/src/renderer/global.d.ts';
const RENDERER = 'apps/desktop/src/renderer/App.tsx';
const IPC_POLICY = 'apps/desktop/src/main/ipc-integration-policy.ts';
const IPC_CACHE = 'apps/desktop/src/main/ipc-read-sharing.ts';
const CORE_SERVICE = 'apps/core-service/src/main.ts';
const AUTHORIZED_SUITE_COMPOSITION = new Set([MAIN, TEST]);
const AUTHORIZED_CASE_REGISTRY = new Set([POLICY]);
const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const relevant = /PolicyConformance|policy-conformance|POLICY_CONFORMANCE|PPK-020/iu;

const lineOf = (source, offset) => (source.slice(0, offset).match(/\n/gu) ?? []).length + 1;
const finding = (path, source, kind, match) => ({ path, line: lineOf(source, match.index ?? 0), kind, detail: match[0] });

export const scanPolicyConformanceSourceText = (path, source) => {
  const normalizedPath = normalize(path);
  const findings = [];
  const add = (kind, match) => findings.push(finding(normalizedPath, source, kind, match));
  const skipped = /\b(?:it|test|describe)\.(?:skip|only)\s*\(/u.exec(source);
  if (skipped && normalizedPath === TEST) add('CONFORMANCE_CASE_SKIP_OR_ONLY', skipped);
  const caseSubset = /POLICY_CONFORMANCE_CASE_IDS\s*\.\s*(?:filter|slice|splice)\s*\(/u.exec(source);
  if (caseSubset && !AUTHORIZED_CASE_REGISTRY.has(normalizedPath)) add('CONFORMANCE_CASE_SUBSET', caseSubset);
  const targetSubset = /it\.each\s*\(\s*POLICY_CONFORMANCE_TARGET_PROFILES\s*\.\s*(?:filter|slice|splice)\s*\(/u.exec(source);
  if (targetSubset && normalizedPath === TEST) add('CONFORMANCE_TARGET_SUBSET', targetSubset);
  const nativeClaim = /nativeAppleRuntimeExecutionClaimed\s*:\s*true/u.exec(source);
  if (nativeClaim) add('UNDEPLOYED_NATIVE_RUNTIME_FALSE_CLAIM', nativeClaim);
  const harnessAuthority = /referenceHarnessGrantsRuntimeAuthority\s*:\s*true/u.exec(source);
  if (harnessAuthority) add('REFERENCE_HARNESS_RUNTIME_AUTHORITY', harnessAuthority);
  const suiteComposition = /new\s+PlatformPolicyConformanceSuite\s*\(/u.exec(source);
  if (suiteComposition && !AUTHORIZED_SUITE_COMPOSITION.has(normalizedPath)) add('CONFORMANCE_SUITE_UNAUTHORIZED_COMPOSITION', suiteComposition);
  const duplicateCaseRegistry = /(?:const|let|var)\s+POLICY_CONFORMANCE_CASE_IDS\b/u.exec(source);
  if (duplicateCaseRegistry && !AUTHORIZED_CASE_REGISTRY.has(normalizedPath)) add('CONFORMANCE_CASE_REGISTRY_DUPLICATED', duplicateCaseRegistry);
  const bypass = /identicalCaseSetApplied\s*:\s*false/u.exec(source);
  if (bypass) add('IDENTICAL_CASE_SET_DISABLED', bypass);
  return findings;
};

const collectProductionSources = async (root) => {
  const zones = [];
  const files = [];
  for (const parent of ['apps', 'packages']) {
    for (const entry of await readdir(resolve(root, parent), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sourceRoot = resolve(root, parent, entry.name, 'src');
      try { await readdir(sourceRoot); } catch { continue; }
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

const selfTest = () => {
  const malicious = [
    ["it.skip('macOS', () => {})", 'CONFORMANCE_CASE_SKIP_OR_ONLY', TEST],
    ["test.only('iOS', () => {})", 'CONFORMANCE_CASE_SKIP_OR_ONLY', TEST],
    ['POLICY_CONFORMANCE_CASE_IDS.filter(Boolean)', 'CONFORMANCE_CASE_SUBSET', TEST],
    ['it.each(POLICY_CONFORMANCE_TARGET_PROFILES.slice(0, 2))', 'CONFORMANCE_TARGET_SUBSET', TEST],
    ['nativeAppleRuntimeExecutionClaimed:true', 'UNDEPLOYED_NATIVE_RUNTIME_FALSE_CLAIM', POLICY],
    ['referenceHarnessGrantsRuntimeAuthority:true', 'REFERENCE_HARNESS_RUNTIME_AUTHORITY', POLICY],
    ['new PlatformPolicyConformanceSuite()', 'CONFORMANCE_SUITE_UNAUTHORIZED_COMPOSITION', 'apps/example/src/bypass.ts'],
    ['identicalCaseSetApplied:false', 'IDENTICAL_CASE_SET_DISABLED', POLICY]
  ];
  const failed = malicious.filter(([source, kind, path]) => !scanPolicyConformanceSourceText(path, source).some((item) => item.kind === kind));
  if (failed.length) throw new Error(`Policy conformance malicious self-test failed: ${failed.length}/${malicious.length}`);
  const benign = [
    ['const profileOnlyTargets = targets.filter(Boolean);', POLICY],
    ["const label = 'policy conformance';", RENDERER],
    ['const identicalCaseSetApplied = true;', POLICY],
    ['const nativeRuntimeValidationRequiredBeforeDeployment = true;', POLICY]
  ];
  const falsePositives = benign.flatMap(([source, path]) => scanPolicyConformanceSourceText(path, source));
  if (falsePositives.length) throw new Error(`Policy conformance benign self-test produced ${falsePositives.length} finding(s)`);
  return { malicious: malicious.length, benign: benign.length };
};

export const scanPolicyConformanceBoundary = async (root = process.cwd()) => {
  const { zones, files } = await collectProductionSources(root);
  const findings = [];
  let relevantFiles = 0;
  for (const file of files) {
    const path = normalize(relative(root, file));
    const source = await readFile(file, 'utf8');
    if (!relevant.test(source) && ![POLICY, USE_CASE, MAIN, PRELOAD, GLOBAL, RENDERER, IPC_POLICY, IPC_CACHE, CORE_SERVICE].includes(path)) continue;
    relevantFiles += 1;
    findings.push(...scanPolicyConformanceSourceText(path, source));
  }

  const paths = [POLICY, TEST, USE_CASE, MAIN, PRELOAD, GLOBAL, RENDERER, IPC_POLICY, IPC_CACHE, CORE_SERVICE];
  const sources = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await readFile(resolve(root, path), 'utf8')])));
  findings.push(...scanPolicyConformanceSourceText(TEST, sources[TEST]));
  const required = [
    [POLICY, 'POLICY_CONFORMANCE_TARGET_PROFILES', 'TARGET_PROFILE_REGISTRY_MISSING'],
    [POLICY, 'POLICY_CONFORMANCE_CASE_IDS', 'CASE_REGISTRY_MISSING'],
    [POLICY, "'BASELINE_ALLOW'", 'BASELINE_ALLOW_CASE_MISSING'],
    [POLICY, "'OWNER_OR_GRANT_REQUIRED_DENIED'", 'FINAL_DENY_CASE_MISSING'],
    [POLICY, 'platformPolicyContextHash(request)', 'CONTEXT_HASH_BINDING_MISSING'],
    [POLICY, 'verifyPolicyPackage(policyPackage)', 'SIGNED_PACKAGE_VERIFICATION_MISSING'],
    [POLICY, 'nativeAppleRuntimeExecutionClaimed: false', 'NATIVE_DEPLOYMENT_TRUTH_MISSING'],
    [POLICY, 'referenceHarnessGrantsRuntimeAuthority: false', 'HARNESS_AUTHORITY_TRUTH_MISSING'],
    [TEST, 'it.each(POLICY_CONFORMANCE_TARGET_PROFILES)', 'IDENTICAL_TARGET_MATRIX_MISSING'],
    [TEST, 'passedCases: 22', 'TARGET_CASE_COUNT_ASSERTION_MISSING'],
    [USE_CASE, 'GetPolicyConformanceSuiteBoundaryUseCase', 'BOUNDARY_USE_CASE_MISSING'],
    [MAIN, "system:getPolicyConformanceSuiteBoundary", 'MAIN_IPC_HANDLER_MISSING'],
    [PRELOAD, "system:getPolicyConformanceSuiteBoundary", 'PRELOAD_API_MISSING'],
    [GLOBAL, 'getPolicyConformanceSuiteBoundary()', 'RENDERER_GLOBAL_API_MISSING'],
    [RENDERER, 'Yerel Apple çalıştırması tamamlandı iddiası yoktur', 'UI_DEPLOYMENT_TRUTH_MISSING'],
    [IPC_POLICY, "case 'system:getPolicyConformanceSuiteBoundary':", 'IPC_ARGUMENT_POLICY_MISSING'],
    [IPC_CACHE, "'system:getPolicyConformanceSuiteBoundary'", 'IPC_NO_CACHE_MISSING']
  ];
  for (const [path, marker, kind] of required) {
    if (!sources[path].includes(marker)) findings.push({ path, line: 1, kind, detail: marker });
  }

  const policy = sources[POLICY];
  for (const applicationId of [
    'windows-desktop', 'windows-core-service', 'windows-cluster-agent', 'macos-companion',
    'ios-companion', 'ipados-companion', 'watchos-companion', 'visionos-companion',
    'ocr-worker', 'ai-worker', 'translation-worker', 'communication-service', 'backup-worker', 'signed-plugin'
  ]) {
    const count = (policy.match(new RegExp(`applicationId: '${applicationId}'`, 'gu')) ?? []).length;
    if (count !== 1) findings.push({ path: POLICY, line: 1, kind: 'TARGET_PROFILE_CARDINALITY_MISMATCH', detail: `${applicationId}:${count}` });
  }
  const coreService = sources[CORE_SERVICE];
  for (const applicationId of [
    'windows-cluster-agent', 'macos-companion', 'ios-companion', 'ipados-companion',
    'watchos-companion', 'visionos-companion', 'ocr-worker', 'ai-worker',
    'translation-worker', 'communication-service', 'backup-worker', 'signed-plugin'
  ]) {
    if (!coreService.includes(`'${applicationId}': 'not-deployed'`)) {
      findings.push({ path: CORE_SERVICE, line: 1, kind: 'DEPLOYMENT_TRUTH_MISMATCH', detail: applicationId });
    }
  }
  return { zones: zones.length, files: files.length, relevantFiles, findings };
};

const main = async () => {
  const assertions = selfTest();
  const result = await scanPolicyConformanceBoundary();
  const report = {
    status: result.findings.length === 0 ? 'PASS' : 'FAIL',
    productionSourceZones: result.zones,
    scannedFiles: result.files,
    securityRelevantFiles: result.relevantFiles,
    maliciousSelfTestAssertions: assertions.malicious,
    benignFalsePositiveAssertions: assertions.benign,
    canonicalTargets: 14,
    identicalCasesPerTarget: 22,
    totalMatrixAssertions: 308,
    deployedRuntimeTargets: 2,
    profileOnlyTargets: 12,
    nativeAppleRuntimeExecutionClaimed: false,
    findings: result.findings
  };
  console.log(JSON.stringify(report, null, 2));
  if (result.findings.length) process.exitCode = 1;
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) await main();
