import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const toPosix = (value) => value.replaceAll('\\', '/');
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const stableStringify = (value) => JSON.stringify(stable(value));
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const walk = async (root) => {
  const found = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) found.push(...await walk(path));
    else if (entry.isFile()) found.push(toPosix(path));
  }
  return found.sort();
};
const occurrences = (text, regex) => [...text.matchAll(regex)].length;
const lineCount = (text) => text.length === 0 ? 0 : text.split(/\r?\n/u).length;

const plan = await readJson('config/work-segmentation-plan.json');
await mkdir('artifacts/inventory/snapshots', { recursive: true });
await writeFile('artifacts/inventory/snapshots/29-D4_WORK_PLAN_AT_GENERATION.json', JSON.stringify(plan, null, 2) + '\n');
for (const [source, snapshot] of [
  ['artifacts/validation/governed-preflight.json', 'artifacts/inventory/snapshots/29-D4_GOVERNED_PREFLIGHT_AT_GENERATION.json'],
  ['artifacts/validation/feature-reality-gate.json', 'artifacts/inventory/snapshots/29-D4_FEATURE_REALITY_AT_GENERATION.json'],
  ['artifacts/validation/platform-policy-gate.json', 'artifacts/inventory/snapshots/29-D4_PLATFORM_POLICY_AT_GENERATION.json']
]) await writeFile(snapshot, await readFile(source));

const bindingPaths = [
  ['packageManifest', 'package.json'],
  ['packageLock', 'package-lock.json'],
  ['typescriptBase', 'tsconfig.base.json'],
  ['preflightSnapshot', 'artifacts/inventory/snapshots/29-D4_GOVERNED_PREFLIGHT_AT_GENERATION.json'],
  ['featureRealitySnapshot', 'artifacts/inventory/snapshots/29-D4_FEATURE_REALITY_AT_GENERATION.json'],
  ['platformPolicySnapshot', 'artifacts/inventory/snapshots/29-D4_PLATFORM_POLICY_AT_GENERATION.json'],
  ['d3Analysis', 'artifacts/inventory/29-D3_RULE_GAP_AND_CONFLICT_ANALYSIS.json'],
  ['toolchainDiscovery', 'artifacts/checkpoints/29-D4_TOOLCHAIN_EXECUTION_UNAVAILABLE.json'],
  ['legacyRegressionFailure', 'artifacts/checkpoints/29-D4_LEGACY_REGRESSION_FORWARD_STATE_FAILURES.json'],
  ['mutableBindingFailure', 'artifacts/checkpoints/29-D4_ASSESSMENT_MUTABLE_BINDING_FAILURE.json'],
  ['workPlanSnapshot', 'artifacts/inventory/snapshots/29-D4_WORK_PLAN_AT_GENERATION.json'],
  ['desktopMain', 'apps/desktop/src/main/main.ts'],
  ['desktopDataStore', 'apps/desktop/src/main/data-store.ts'],
  ['rendererApp', 'apps/desktop/src/renderer/App.tsx'],
  ['rendererSecurity', 'apps/desktop/src/main/renderer-window-security.ts'],
  ['rendererHtml', 'apps/desktop/index.html']
];
const sourceBindings = [];
for (const [id, path] of bindingPaths) {
  const bytes = await readFile(path);
  sourceBindings.push({ id, path, sizeBytes: bytes.length, sha256: sha256(bytes) });
}

const packageManifest = await readJson('package.json');
const packageLock = await readJson('package-lock.json');
const tsconfigBase = await readJson('tsconfig.base.json');
const preflight = await readJson('artifacts/inventory/snapshots/29-D4_GOVERNED_PREFLIGHT_AT_GENERATION.json');
const featureReality = await readJson('artifacts/inventory/snapshots/29-D4_FEATURE_REALITY_AT_GENERATION.json');
const platformPolicy = await readJson('artifacts/inventory/snapshots/29-D4_PLATFORM_POLICY_AT_GENERATION.json');
const d3 = await readJson('artifacts/inventory/29-D3_RULE_GAP_AND_CONFLICT_ANALYSIS.json');
const toolchain = await readJson('artifacts/checkpoints/29-D4_TOOLCHAIN_EXECUTION_UNAVAILABLE.json');

const productFiles = [...await walk('apps'), ...await walk('packages')];
const testFiles = await walk('tests');
const sourceExtensions = new Set(['.ts', '.tsx']);
const isTestSource = (path) => path.includes('/tests/') || /\.(?:test|spec)\.[cm]?tsx?$/u.test(path);
const allTypeScriptFiles = [...new Set([...productFiles, ...testFiles])].filter((path) => sourceExtensions.has(extname(path)) && !path.includes('/dist/'));
const productSourceFiles = allTypeScriptFiles.filter((path) => !isTestSource(path));
const testSourceFiles = allTypeScriptFiles.filter(isTestSource);
const fileMetrics = [];
const scan = {
  todoFixmeHack: 0,
  tsIgnoreOrNoCheck: 0,
  explicitAny: 0,
  dynamicCodeExecution: 0,
  insecureRendererPreference: 0,
  childProcessApi: 0
};
for (const path of [...productSourceFiles, ...testSourceFiles]) {
  const text = await readFile(path, 'utf8');
  const lines = text.split(/\r?\n/u);
  const bytes = Buffer.byteLength(text);
  fileMetrics.push({ path, bytes, lines: lineCount(text), maxLineLength: Math.max(0, ...lines.map((line) => line.length)) });
  scan.todoFixmeHack += occurrences(text, /\b(?:TODO|FIXME|HACK|XXX)\b/gu);
  scan.tsIgnoreOrNoCheck += occurrences(text, /@ts-(?:ignore|nocheck)/gu);
  scan.explicitAny += occurrences(text, /(?:\bas\s+any\b|:\s*any\b|<any>)/gu);
  scan.dynamicCodeExecution += occurrences(text, /(?:\beval\s*\(|\bnew\s+Function\s*\()/gu);
  scan.insecureRendererPreference += occurrences(text, /(?:nodeIntegration\s*:\s*true|contextIsolation\s*:\s*false|sandbox\s*:\s*false)/gu);
  scan.childProcessApi += occurrences(text, /(?:node:child_process|child_process)/gu);
}
fileMetrics.sort((left, right) => right.bytes - left.bytes || left.path.localeCompare(right.path));

const workspaceEntries = Object.entries(packageLock.packages ?? {}).filter(([path]) => /^(?:apps|packages)\//u.test(path));
const internalNames = new Set(workspaceEntries.map(([, manifest]) => manifest.name).filter(Boolean));
let internalDependencyEdges = 0;
for (const [, manifest] of workspaceEntries) {
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    internalDependencyEdges += Object.keys(manifest[section] ?? {}).filter((name) => internalNames.has(name)).length;
  }
}

const desktopMain = await readFile('apps/desktop/src/main/main.ts', 'utf8');
const rendererHtml = await readFile('apps/desktop/index.html', 'utf8');
const securitySignals = {
  sharedSecureRendererPreferences: desktopMain.includes('createSecureRendererPreferences('),
  explicitSecurePreviewPreferences: desktopMain.includes('sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true'),
  pdfWindowOnlyDeclaresSandbox: desktopMain.includes('new BrowserWindow({show:false,webPreferences:{sandbox:true}})'),
  cspPresent: /Content-Security-Policy/iu.test(rendererHtml),
  cspAllowsInlineStyle: /style-src[^;]*'unsafe-inline'/iu.test(rendererHtml),
  cspAllowsLocalhostConnect: /connect-src[^;]*(?:127\.0\.0\.1|localhost)/iu.test(rendererHtml)
};

const preflightWarnings = preflight.results.filter((item) => item.exitCode === 0 && item.stderr?.trim()).map((item) => ({ script: item.script, stderr: item.stderr.trim() }));
const architecture = {
  workspaceCount: workspaceEntries.length,
  internalDependencyEdges,
  acyclicProductionGraph: preflight.results.some((item) => item.script === 'scripts/verify-workspace-dependencies.mjs' && item.exitCode === 0 && item.stdout.includes('acyclic production graph')),
  strictTypeScript: tsconfigBase.compilerOptions.strict === true,
  noUncheckedIndexedAccess: tsconfigBase.compilerOptions.noUncheckedIndexedAccess === true,
  exactOptionalPropertyTypes: tsconfigBase.compilerOptions.exactOptionalPropertyTypes === true,
  productSourceFileCount: productSourceFiles.length,
  productPhysicalLineCount: fileMetrics.filter((item) => productSourceFiles.includes(item.path)).reduce((sum, item) => sum + item.lines, 0),
  testSourceFileCount: testSourceFiles.length,
  testPhysicalLineCount: fileMetrics.filter((item) => testSourceFiles.includes(item.path)).reduce((sum, item) => sum + item.lines, 0),
  filesOver1000Lines: fileMetrics.filter((item) => productSourceFiles.includes(item.path) && item.lines > 1000).length,
  filesOver100KiB: fileMetrics.filter((item) => productSourceFiles.includes(item.path) && item.bytes > 102400).length,
  topHotspots: fileMetrics.filter((item) => productSourceFiles.includes(item.path)).slice(0, 12)
};

const findings = [
  {
    id: '29-D4-FIND-001', severity: 'HIGH', category: 'EXECUTABILITY',
    status: 'OPEN_NOT_PASS', countedAsPass: false,
    title: 'Current workspace cannot execute the full TypeScript validation chain',
    evidence: ['artifacts/checkpoints/29-D4_TOOLCHAIN_EXECUTION_UNAVAILABLE.json'],
    detail: 'npm and node_modules are unavailable; typecheck, unit/integration tests, production build and installer build are NOT_RUN and are not PASS.',
    remediation: 'Provide a governed dependency runtime or verified offline npm cache, then run typecheck, tests, build and installer gates with real exit codes.'
  },
  {
    id: '29-D4-FIND-002', severity: 'HIGH', category: 'PRODUCT_READINESS',
    status: 'OPEN_NOT_PASS', countedAsPass: false,
    title: 'Silver promotion is blocked by incomplete required scope',
    evidence: ['artifacts/validation/feature-reality-gate.json'],
    detail: `${featureReality.incompleteRequired} of ${featureReality.requirements} required items remain incomplete; the honesty gate passes but readiness does not.`,
    remediation: 'Continue Bronze scope closure; do not infer Silver readiness from the honesty-gate PASS.'
  },
  {
    id: '29-D4-FIND-003', severity: 'MEDIUM', category: 'MAINTAINABILITY',
    status: 'OPEN_NOT_PASS', countedAsPass: false,
    title: 'Large source hotspots concentrate change and review risk',
    evidence: architecture.topHotspots.slice(0, 5).map((item) => item.path),
    detail: `${architecture.filesOver1000Lines} product source files exceed 1000 physical lines and ${architecture.filesOver100KiB} exceed 100 KiB.`,
    remediation: 'Split renderer, main-process and data-store responsibilities behind stable interfaces while preserving behavior and evidence.'
  },
  {
    id: '29-D4-FIND-004', severity: 'MEDIUM', category: 'PLATFORM_DEBT',
    status: 'OPEN_NOT_PASS', countedAsPass: false,
    title: 'Legacy platform bypass debt remains active',
    evidence: ['artifacts/validation/platform-policy-gate.json'],
    detail: `${platformPolicy.legacyBypassCount} legacy bypass records remain; the latest gate proves zero new bypasses, not zero total debt.`,
    remediation: 'Retire legacy bypasses incrementally with contract and runtime evidence.'
  },
  {
    id: '29-D4-FIND-005', severity: 'MEDIUM', category: 'RENDERER_SECURITY_HARDENING',
    status: 'OPEN_NOT_PASS', countedAsPass: false,
    title: 'Renderer CSP retains broad development-oriented allowances',
    evidence: ['apps/desktop/index.html'],
    detail: "The CSP allows 'unsafe-inline' styles and localhost development connections in the shared document policy.",
    remediation: 'Use environment-specific CSP and remove packaged-build allowances that are not required.'
  },
  {
    id: '29-D4-FIND-006', severity: 'MEDIUM', category: 'WINDOW_SECURITY_CONSISTENCY',
    status: 'OPEN_NOT_PASS', countedAsPass: false,
    title: 'Offscreen PDF window does not use the shared explicit renderer security profile',
    evidence: ['apps/desktop/src/main/main.ts', 'apps/desktop/src/main/renderer-window-security.ts'],
    detail: 'The PDF BrowserWindow explicitly sets sandbox only; secure Electron defaults may apply, but policy drift is not fail-closed evidence.',
    remediation: 'Construct every BrowserWindow through the shared secure preferences helper or assert the complete explicit preference set.'
  },
  {
    id: '29-D4-FIND-007', severity: 'LOW', category: 'TOOLCHAIN_FORWARD_COMPATIBILITY',
    status: 'OPEN_NOT_PASS', countedAsPass: false,
    title: 'Experimental loader deprecation warnings are present',
    evidence: ['artifacts/validation/governed-preflight.json'],
    detail: `${preflightWarnings.length} successful preflight runtimes emitted experimental-loader deprecation warnings.`,
    remediation: 'Migrate wrappers to the Node register() mechanism before loader removal affects validation.'
  },
  {
    id: '29-D4-FIND-008', severity: 'INFO', category: 'GOVERNANCE_OPEN_TRUTH',
    status: 'OPEN_NOT_PASS', countedAsPass: false,
    title: 'Nine governance gaps remain explicit',
    evidence: ['artifacts/inventory/29-D3_RULE_GAP_AND_CONFLICT_ANALYSIS.json'],
    detail: `${d3.summary.openGapCount} gaps remain open and ${d3.summary.openContradictionCount} contradictions remain open; none are counted as PASS.`,
    remediation: 'Keep unavailable and historical-evidence gaps open until direct immutable evidence exists.'
  }
];

const assessmentBasis = {
  release: packageManifest.version,
  sourceBindings,
  architecture,
  scan,
  securitySignals,
  findings: findings.map(({ id, severity, category, status, countedAsPass, title, evidence, detail, remediation }) => ({ id, severity, category, status, countedAsPass, title, evidence, detail, remediation })),
  readiness: {
    bronzeContinuation: 'AUTHORIZED_WITH_OPEN_REMEDIATION',
    silver: 'BLOCKED_NOT_READY',
    gold: 'BLOCKED_NOT_READY'
  }
};
const assessmentFingerprintSha256 = sha256(Buffer.from(stableStringify(assessmentBasis)));
const assessment = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '29-D4',
  title: 'Pro-level technical assessment of the latest code',
  phase: 'LOCAL_ASSESSMENT_AWAITING_LIBRARY_RECEIPT',
  status: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT',
  validationStatus: 'PENDING',
  persistentReceiptStatus: 'PENDING',
  persistentReceiptPath: null,
  scope: {
    product: packageManifest.name,
    version: packageManifest.version,
    nodeEngine: packageManifest.engines.node,
    assessedRoots: ['apps', 'packages', 'tests', 'config', 'artifacts/validation'],
    exclusions: ['No full dependency-backed typecheck/test/build execution', 'No Windows installed-app, DPAPI, EFS or installer result simulation']
  },
  sourceBindings,
  executionEvidence: {
    bundledNode: toolchain.workspaceChecks.bundledNode,
    governedPreflight: { status: preflight.status, sourceFingerprint: preflight.sourceFingerprint, executed: preflight.results.length, failed: preflight.results.filter((item) => item.exitCode !== 0).length },
    dependencyBackedTypecheck: { status: 'NOT_RUN_NOT_PASS', countedAsPass: false },
    unitAndIntegrationTests: { status: 'NOT_RUN_NOT_PASS', countedAsPass: false },
    productionBuild: { status: 'NOT_RUN_NOT_PASS', countedAsPass: false },
    installerBuild: { status: 'NOT_RUN_NOT_PASS', countedAsPass: false }
  },
  architecture,
  staticScan: scan,
  securitySignals,
  strengths: [
    'Governed preflight completed with all child process exit codes equal to zero.',
    `${architecture.workspaceCount} workspaces have an acyclic production dependency graph.`,
    'Strict TypeScript, noUncheckedIndexedAccess and exactOptionalPropertyTypes are enabled.',
    'Renderer policy explicitly enforces sandbox, context isolation, disabled Node integration and navigation restrictions for the main window.',
    'Platform policy reports zero new bypasses and feature-reality reporting remains fail-honest.'
  ],
  preservedFailures: [
    {
      path: 'artifacts/checkpoints/29-D4_LEGACY_REGRESSION_FORWARD_STATE_FAILURES.json',
      status: 'FAIL', processExitCode: 1, result: '8/13', countedAsPass: false,
      correctionScope: 'FORWARD_STATE_COMPATIBILITY_ONLY'
    },
    {
      path: 'artifacts/checkpoints/29-D4_ASSESSMENT_MUTABLE_BINDING_FAILURE.json',
      status: 'FAIL', processExitCode: 1, result: '4 binding mismatches', countedAsPass: false,
      correctionScope: 'BIND_MUTABLE_VALIDATION_INPUTS_TO_IMMUTABLE_GENERATION_SNAPSHOTS'
    }
  ],
  findings,
  findingSummary: {
    total: findings.length,
    high: findings.filter((item) => item.severity === 'HIGH').length,
    medium: findings.filter((item) => item.severity === 'MEDIUM').length,
    low: findings.filter((item) => item.severity === 'LOW').length,
    info: findings.filter((item) => item.severity === 'INFO').length,
    open: findings.filter((item) => item.status === 'OPEN_NOT_PASS').length,
    countedAsPass: findings.filter((item) => item.countedAsPass).length
  },
  readiness: {
    technicalAssessmentValidation: 'PENDING',
    bronzeContinuation: 'AUTHORIZED_WITH_OPEN_REMEDIATION',
    releasePromotion: 'NOT_AUTHORIZED',
    silver: 'BLOCKED_NOT_READY',
    gold: 'BLOCKED_NOT_READY',
    rationale: 'The source governance chain is strong, but dependency-backed execution is NOT_RUN, required scope is incomplete, and open technical debt remains.'
  },
  assessmentFingerprintSha256,
  nextOfficialStep: '29-D5',
  nextOfficialStepStatus: 'PENDING_AWAITING_29-D4_RECEIPT',
  nextOfficialStepAuthorized: false,
  bronzeCompletedPercent: 25.0,
  conversationCapacity: 'UNAVAILABLE',
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/inventory', { recursive: true });
await mkdir('docs/audit', { recursive: true });
await writeFile('artifacts/inventory/29-D4_PROFESSIONAL_TECHNICAL_ASSESSMENT.json', JSON.stringify(assessment, null, 2) + '\n');
const rows = findings.map((item) => `| ${item.id} | ${item.severity} | ${item.category} | ${item.title} | ${item.status} |`).join('\n');
const hotspots = architecture.topHotspots.slice(0, 8).map((item) => `- \`${item.path}\`: ${item.lines} lines, ${item.bytes} bytes, max line ${item.maxLineLength}`).join('\n');
const markdown = `# 29-D4 — Profesyonel Teknik Değerlendirme\n\n- Değerlendirme üretimi: **PENDING VALIDATION**\n- Governed preflight: **${preflight.status}; ${preflight.results.length} process; ${preflight.results.filter((item) => item.exitCode !== 0).length} fail**\n- Typecheck/test/build/installer: **NOT_RUN / PASS DEĞİL**\n- Çalışma alanı: **${architecture.workspaceCount} workspace; acyclic: ${architecture.acyclicProductionGraph ? 'PASS' : 'FAIL'}**\n- Ürün kaynakları: **${architecture.productSourceFileCount} dosya; ${architecture.productPhysicalLineCount} fiziksel satır**\n- Test kaynakları: **${architecture.testSourceFileCount} dosya; ${architecture.testPhysicalLineCount} fiziksel satır**\n- Bulgular: **${findings.length} toplam / ${findings.filter((item) => item.severity === 'HIGH').length} HIGH / ${findings.filter((item) => item.severity === 'MEDIUM').length} MEDIUM / ${findings.filter((item) => item.severity === 'LOW').length} LOW / ${findings.filter((item) => item.severity === 'INFO').length} INFO**\n- Silver/Gold: **YASAK / HAZIR DEĞİL**\n- Bronze doğrulanmış ilerleme: **%25,0 (değişmedi)**\n- İlk toplu regresyon denemesi: **8/13 FAIL; PASS sayılmadı; ileri-durum uyumluluğu kapsamında korundu**\n- İlk yeniden doğrulama: **FAIL; 4 değişken bağ uyuşmazlığı; PASS sayılmadı; snapshot düzeltmesi kapsamında korundu**\n\n## Bulgular\n\n| Kimlik | Önem | Alan | Başlık | Durum |\n|---|---:|---|---|---|\n${rows}\n\n## En büyük kaynak odakları\n\n${hotspots}\n\nBu rapor kod kalitesi veya sürüm hazırlığını topluca PASS ilan etmez; yalnız değerlendirme doğruluğu ayrı kapıda doğrulanabilir.\n\n${TRUTH}\n`;
await writeFile('docs/audit/29-D4_PROFESYONEL_TEKNIK_DEGERLENDIRME.md', markdown);
console.log(`29-D4 technical assessment generated: ${findings.length} findings / ${architecture.productSourceFileCount} product source files / validation PENDING.`);
