import { createHash } from 'node:crypto';
import { delimiter, extname, join, normalize } from 'node:path';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const readJson = async (path) => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/u, ''));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const stableStringify = (value) => JSON.stringify(stable(value));
const exists = async (path) => { try { await access(path); return true; } catch { return false; } };
const bind = async (id, path) => {
  const bytes = await readFile(path);
  return { id, path, sizeBytes: bytes.length, sha256: sha256(bytes) };
};

const findOnPath = async (names) => {
  for (const directory of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) {
    for (const name of names) {
      const candidate = join(directory, name);
      if (await exists(candidate)) return normalize(candidate);
    }
  }
  return null;
};

const scriptTargets = (command) => [...command.matchAll(/(?:^|\s)(\.?\/?scripts\/[A-Za-z0-9._/-]+\.(?:mjs|js))(?:\s|$)/gu)].map((match) => match[1].replace(/^\.\//u, ''));
const importsOf = (source) => [...source.matchAll(/(?:import\s+(?:[^'"\n]+?\s+from\s+)?|import\s*\()\s*['"]([^'"]+)['"]/gu)].map((match) => match[1]);
const externalImports = (imports) => imports.filter((item) => !item.startsWith('node:') && !item.startsWith('./') && !item.startsWith('../') && !item.startsWith('file:'));
const securityPattern = /(security|secure|policy|auth|identity|privacy|consent|crypto|signature|sandbox|provenance|production-clean|version-sweep|personal-identity|artifact-index|documentation-closure|progress-report|rules|decisions|active-release|conversation-capacity|core-service)/iu;
const targetedPattern = /^(test|verify|validate):|(?:^|:)contract(?:$|:)|(?:^|:)runtime(?:$|:)|build\d+/iu;
const dependencyCommandPattern = /(?:^|\s|&&)(?:npx|npm|pnpm|yarn|tsc|vitest|vite|electron-builder|eslint|playwright|tsx)(?:\s|$)/iu;
const platformCommandPattern = /(?:powershell|pwsh|\.ps1\b|\.cmd\b|\.bat\b|signtool|msiexec)/iu;

const packageJson = await readJson('package.json');
const packageLock = await readJson('package-lock.json');
const plan = await readJson('config/work-segmentation-plan.json');
const governance = await readJson('config/active-governance-ledger.json');
const d3 = await readJson('artifacts/inventory/29-D3_RULE_GAP_AND_CONFLICT_ANALYSIS.json');
const d4 = await readJson('artifacts/inventory/29-D4_PROFESSIONAL_TECHNICAL_ASSESSMENT.json');
const d5 = await readJson('artifacts/inventory/29-D5_SCOPE_AND_REAL_PROGRESS_REPORT.json');

await mkdir('artifacts/inventory/snapshots', { recursive: true });
await writeFile('artifacts/inventory/snapshots/29-E1_WORK_PLAN_AT_GENERATION.json', JSON.stringify(plan, null, 2) + '\n');
await writeFile('artifacts/inventory/snapshots/29-E1_GOVERNANCE_AT_GENERATION.json', JSON.stringify(governance, null, 2) + '\n');

const scripts = [];
for (const [name, command] of Object.entries(packageJson.scripts ?? {}).sort(([a], [b]) => a.localeCompare(b, 'en'))) {
  const targets = scriptTargets(command);
  const target = targets.at(-1) ?? null;
  const targetExists = target ? await exists(target) : false;
  let imports = [];
  if (targetExists) imports = importsOf(await readFile(target, 'utf8'));
  const external = externalImports(imports);
  let executionClass = 'UNCLASSIFIED_REVIEW_REQUIRED';
  let readiness = 'REVIEW_REQUIRED_NOT_PASS';
  if (dependencyCommandPattern.test(command) || external.length > 0) {
    executionClass = 'DEPENDENCY_BACKED';
    readiness = 'BLOCKED_DEPENDENCY_TOOLCHAIN_NOT_READY_NOT_PASS';
  } else if (platformCommandPattern.test(command)) {
    executionClass = 'PLATFORM_SPECIFIC';
    readiness = 'NOT_RUN_PLATFORM_EVIDENCE_REQUIRED_NOT_PASS';
  } else if (targetExists && /(?:^|\s)node(?:\.exe)?(?:\s|$)/iu.test(command)) {
    if (/--experimental-(?:loader|strip-types)/u.test(command)) {
      executionClass = 'CONTROLLED_NODE_RUNTIME';
      readiness = 'READY_REQUIRES_ISOLATED_EXECUTION';
    } else {
      executionClass = 'DEPENDENCY_FREE_NODE';
      readiness = 'READY_FOR_ISOLATED_EXECUTION';
    }
  }
  scripts.push({
    name, command, commandSha256: sha256(Buffer.from(command)), target, targetExists,
    directExternalImports: external,
    securityCandidate: securityPattern.test(`${name} ${command}`),
    targetedTestCandidate: targetedPattern.test(name),
    executionClass, readiness,
  });
}

const byClass = Object.fromEntries([...new Set(scripts.map((item) => item.executionClass))].sort().map((key) => [key, scripts.filter((item) => item.executionClass === key).length]));
const npmPath = await findOnPath(['npm.cmd', 'npm.exe', 'npm']);
const nodeModulesExists = await exists('node_modules');
const packageLockStat = await stat('package-lock.json');
const toolchain = {
  node: { executable: process.execPath, version: process.version, status: 'AVAILABLE' },
  npm: { requiredVersion: packageJson.packageManager ?? 'UNAVAILABLE', executable: npmPath, status: npmPath ? 'AVAILABLE_NOT_EXECUTED' : 'NOT_FOUND' },
  nodeModules: { path: 'node_modules', exists: nodeModulesExists, status: nodeModulesExists ? 'PRESENT_NOT_VALIDATED' : 'NOT_FOUND' },
  packageLock: { path: 'package-lock.json', exists: true, sizeBytes: packageLockStat.size, lockfileVersion: packageLock.lockfileVersion, packageEntries: Object.keys(packageLock.packages ?? {}).length, status: 'AVAILABLE' },
  dependencyInstall: { status: 'NOT_RUN_NOT_PASS', networkUsed: false },
  dependencyBackedExecution: { typecheck: 'NOT_RUN_NOT_PASS', tests: 'NOT_RUN_NOT_PASS', productionBuild: 'NOT_RUN_NOT_PASS', installerBuild: 'NOT_RUN_NOT_PASS' },
};

const sourceBindings = await Promise.all([
  bind('packageJson', 'package.json'),
  bind('packageLock', 'package-lock.json'),
  bind('testAcceptanceStrategy', 'docs/03_TEST_AND_ACCEPTANCE.md'),
  bind('releaseValidationGovernance', 'docs/15_RELEASE_VALIDATION_GOVERNANCE.md'),
  bind('activeSecurityPolicy', 'docs/current/01_AKTIF_GUVENLIK_GIZLILIK_POLITIKASI.md'),
  bind('d3GapAnalysis', 'artifacts/inventory/29-D3_RULE_GAP_AND_CONFLICT_ANALYSIS.json'),
  bind('d4TechnicalAssessment', 'artifacts/inventory/29-D4_PROFESSIONAL_TECHNICAL_ASSESSMENT.json'),
  bind('d5ProgressReport', 'artifacts/inventory/29-D5_SCOPE_AND_REAL_PROGRESS_REPORT.json'),
  bind('d6Completion', 'artifacts/checkpoints/29-D6_COMPLETION_RECORD.json'),
  bind('workPlanSnapshot', 'artifacts/inventory/snapshots/29-E1_WORK_PLAN_AT_GENERATION.json'),
  bind('governanceSnapshot', 'artifacts/inventory/snapshots/29-E1_GOVERNANCE_AT_GENERATION.json'),
]);

const classificationSummary = {
  packageScriptCount: scripts.length,
  classCounts: byClass,
  securityCandidateCount: scripts.filter((item) => item.securityCandidate).length,
  targetedTestCandidateCount: scripts.filter((item) => item.targetedTestCandidate).length,
  dependencyFreeCandidateCount: scripts.filter((item) => item.executionClass === 'DEPENDENCY_FREE_NODE').length,
  controlledRuntimeCandidateCount: scripts.filter((item) => item.executionClass === 'CONTROLLED_NODE_RUNTIME').length,
  dependencyBackedCount: scripts.filter((item) => item.executionClass === 'DEPENDENCY_BACKED').length,
  platformSpecificCount: scripts.filter((item) => item.executionClass === 'PLATFORM_SPECIFIC').length,
  reviewRequiredCount: scripts.filter((item) => item.executionClass === 'UNCLASSIFIED_REVIEW_REQUIRED').length,
};
const gateSets = {
  securityCandidates: scripts.filter((item) => item.securityCandidate).map((item) => item.name),
  targetedTestCandidates: scripts.filter((item) => item.targetedTestCandidate).map((item) => item.name),
  dependencyFreeCandidates: scripts.filter((item) => item.executionClass === 'DEPENDENCY_FREE_NODE').map((item) => item.name),
  controlledRuntimeCandidates: scripts.filter((item) => item.executionClass === 'CONTROLLED_NODE_RUNTIME').map((item) => item.name),
  dependencyBackedCandidates: scripts.filter((item) => item.executionClass === 'DEPENDENCY_BACKED').map((item) => item.name),
  platformSpecificCandidates: scripts.filter((item) => item.executionClass === 'PLATFORM_SPECIFIC').map((item) => item.name),
};
const executionClaims = {
  inventoryGeneration: 'PASS',
  executedTestOrSecurityGateCommands: [],
  dependencyFreeTargetedExecution: 'NOT_RUN_NOT_PASS',
  controlledRuntimeExecution: 'NOT_RUN_NOT_PASS',
  dependencyBackedExecution: 'NOT_RUN_NOT_PASS',
  platformSpecificExecution: 'NOT_RUN_NOT_PASS',
};
const unresolvedTruth = {
  governanceGapsOpen: d3.summary.openGapCount,
  governanceContradictionsOpen: d3.summary.openContradictionCount,
  technicalFindingsOpen: d4.findingSummary.open,
  acceptedScopeIncomplete: d5.scopeMetrics.strictIncompleteCount,
  promotionRequiredIncomplete: d5.scopeMetrics.promotionRequired.incomplete,
  countedAsPass: 0,
};
const fingerprintBasis = { sourceBindings, classificationSummary, toolchain, gateSets, executionClaims, unresolvedTruth };
const inventory = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '29-E1',
  title: 'Executable targeted-test/security-gate inventory and dependency readiness',
  status: 'IN_PROGRESS_LOCAL_INVENTORY',
  validationStatus: 'PENDING',
  persistentReceiptStatus: 'PENDING',
  sourceBindings,
  classificationMethod: {
    dependencyFree: 'NODE_SCRIPT_EXISTS_AND_NO_DIRECT_EXTERNAL_IMPORT_AND_NO_DEPENDENCY_CLI_TOKEN',
    controlledRuntime: 'NODE_SCRIPT_WITH_EXPERIMENTAL_LOADER_OR_STRIP_TYPES_REQUIRES_ISOLATED_EXECUTION',
    dependencyBacked: 'DEPENDENCY_CLI_TOKEN_OR_DIRECT_EXTERNAL_IMPORT',
    platformSpecific: 'POWERSHELL_CMD_BAT_SIGNTOOL_OR_MSIEXEC',
    conservative: true,
  },
  classificationSummary,
  toolchain,
  gateSets,
  scripts,
  executionClaims,
  unresolvedTruth,
  nextMicroStep: '29-E2',
  nextMicroStepStatus: 'PENDING_AWAITING_29-E1_LIBRARY_RECEIPT',
  bronzeCompletedPercent: 25,
  silverStatus: 'FORBIDDEN_NOT_READY',
  goldStatus: 'FORBIDDEN_NOT_READY',
  conversationCapacity: 'UNAVAILABLE',
  inventoryFingerprintSha256: sha256(Buffer.from(stableStringify(fingerprintBasis))),
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH,
};
const readiness = {
  schemaVersion: 1,
  release: inventory.release,
  step: '29-E1',
  status: 'DEPENDENCY_FREE_READY_DEPENDENCY_BACKED_BLOCKED_NOT_PASS',
  node: toolchain.node,
  npm: toolchain.npm,
  nodeModules: toolchain.nodeModules,
  packageLock: toolchain.packageLock,
  dependencyInstall: toolchain.dependencyInstall,
  dependencyBackedExecution: toolchain.dependencyBackedExecution,
  dependencyFreeCandidateCount: classificationSummary.dependencyFreeCandidateCount,
  controlledRuntimeCandidateCount: classificationSummary.controlledRuntimeCandidateCount,
  nextAction: 'RUN_29-E2_ISOLATED_DEPENDENCY_FREE_AND_CONTROLLED_RUNTIME_GATES_AFTER_29-E1_DURABLE_RECEIPT',
  countedAsPass: false,
  generatedAt: inventory.generatedAt,
  mandatoryTruthSentence: TRUTH,
};
await mkdir('artifacts/inventory', { recursive: true });
await mkdir('artifacts/checkpoints', { recursive: true });
await mkdir('docs/audit', { recursive: true });
await writeFile('artifacts/inventory/29-E1_TARGETED_TEST_SECURITY_GATE_INVENTORY.json', JSON.stringify(inventory, null, 2) + '\n');
await writeFile('artifacts/checkpoints/29-E1_DEPENDENCY_READINESS.json', JSON.stringify(readiness, null, 2) + '\n');
await writeFile('docs/audit/29-E1_HEDEFLI_TEST_GUVENLIK_KAPISI_ENVANTERI.md', `# 29-E1 — Hedefli Test ve Güvenlik Kapısı Envanteri\n\n- Paket scripti: **${scripts.length}**\n- Dependency-free Node adayı: **${classificationSummary.dependencyFreeCandidateCount}**\n- Kontrollü runtime adayı: **${classificationSummary.controlledRuntimeCandidateCount}**\n- Dependency-backed: **${classificationSummary.dependencyBackedCount}; NOT_RUN / PASS DEĞİL**\n- Platforma özel: **${classificationSummary.platformSpecificCount}; NOT_RUN / PASS DEĞİL**\n- Güvenlik kapısı adayı: **${classificationSummary.securityCandidateCount}**\n- Hedefli test adayı: **${classificationSummary.targetedTestCandidateCount}**\n- Node: **${process.version} / AVAILABLE**\n- npm: **${toolchain.npm.status}**\n- node_modules: **${toolchain.nodeModules.status}**\n- Bronze ilerleme: **%25,0; değişmedi**\n- Silver/Gold: **YASAK / HAZIR DEĞİL**\n\nBu mikro-adım test çalıştırma iddiası taşımaz; yalnız yürütülebilir kapıları ve gerçek toolchain durumunu fail-closed sınıflandırır.\n\n${TRUTH}\n`);
console.log(`29-E1 inventory generated: ${scripts.length} scripts / ${classificationSummary.dependencyFreeCandidateCount} dependency-free / ${classificationSummary.dependencyBackedCount} dependency-backed / npm ${toolchain.npm.status}.`);
