import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
const truth = 'Bu teslim, yukaridaki kanitlarla sinirlidir; calistirilmayan hicbir kontrol PASS sayilmamistir.';

const paths = {
  policy: resolve(root, 'config/bronze-current-audit-policy.json'),
  scope: resolve(root, 'config/accepted-scope-registry.json'),
  rules: resolve(root, 'config/canonical-rule-registry.json'),
  enforcement: resolve(root, 'config/rule-enforcement-registry.json'),
  governance: resolve(root, 'config/active-governance-ledger.json'),
  workPlan: resolve(root, 'config/work-segmentation-plan.json'),
  stepReport: resolve(root, 'artifacts/inventory/30-Z_SCOPE_AND_STATUS_REPORT.json'),
  step31AReport: resolve(root, 'artifacts/inventory/31-A_SCOPE_AND_STATUS_REPORT.json'),
  step31BReport: resolve(root, 'artifacts/inventory/31-B_SCOPE_AND_STATUS_REPORT.json'),
  step31CReport: resolve(root, 'artifacts/inventory/31-C_SCOPE_AND_STATUS_REPORT.json'),
  step31DReport: resolve(root, 'artifacts/inventory/31-D_SCOPE_AND_STATUS_REPORT.json'),
  step31EReport: resolve(root, 'artifacts/inventory/31-E_SCOPE_AND_STATUS_REPORT.json'),
  step31FReport: resolve(root, 'artifacts/inventory/31-F_SCOPE_AND_STATUS_REPORT.json'),
  step31GReport: resolve(root, 'artifacts/inventory/31-G_SCOPE_AND_STATUS_REPORT.json'),
  step31HReport: resolve(root, 'artifacts/inventory/31-H_SCOPE_AND_STATUS_REPORT.json'),
  step31IReport: resolve(root, 'artifacts/inventory/31-I_SCOPE_AND_STATUS_REPORT.json'),
  step31JReport: resolve(root, 'artifacts/inventory/31-J_SCOPE_AND_STATUS_REPORT.json'),
  step31KReport: resolve(root, 'artifacts/inventory/31-K_SCOPE_AND_STATUS_REPORT.json'),
  step31LReport: resolve(root, 'artifacts/inventory/31-L_SCOPE_AND_STATUS_REPORT.json'),
  step31MReport: resolve(root, 'artifacts/inventory/31-M_SCOPE_AND_STATUS_REPORT.json'),
  step31NReport: resolve(root, 'artifacts/inventory/31-N_SCOPE_AND_STATUS_REPORT.json'),
  step31OReport: resolve(root, 'artifacts/inventory/31-O_SCOPE_AND_STATUS_REPORT.json'),
  step31PReport: resolve(root, 'artifacts/inventory/31-P_SCOPE_AND_STATUS_REPORT.json'),
  step31QReport: resolve(root, 'artifacts/inventory/31-Q_SCOPE_AND_STATUS_REPORT.json'),
  step31RReport: resolve(root, 'artifacts/inventory/31-R_SCOPE_AND_STATUS_REPORT.json'),
  step31SReport: resolve(root, 'artifacts/inventory/31-S_SCOPE_AND_STATUS_REPORT.json'),
  step31TReport: resolve(root, 'artifacts/inventory/31-T_SCOPE_AND_STATUS_REPORT.json'),
  sourceProtection: resolve(root, '..', '..', '05_TEST', '30Z_LOCAL_RECEIPT', 'LATEST.json'),
  jsonReport: resolve(root, 'artifacts/inventory/BRONZE_CURRENT_COMPLETION_AUDIT.json'),
  markdownReport: resolve(root, 'docs/audit/BRONZE_CURRENT_COMPLETION_AUDIT.md')
};

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const round = (value) => Number(value.toFixed(4));
const percent = (part, total) => total === 0 ? 0 : round((part / total) * 100);
const countBy = (items, key) => Object.fromEntries(
  [...new Set(items.map((item) => String(item[key] ?? 'UNAVAILABLE')))]
    .sort()
    .map((value) => [value, items.filter((item) => String(item[key] ?? 'UNAVAILABLE') === value).length])
);

const [policy, scope, rules, enforcement, governance, workPlan, stepReport, step31AReport, step31BReport, step31CReport, step31DReport, step31EReport, step31FReport, step31GReport, step31HReport, step31IReport, step31JReport, step31KReport, step31LReport, step31MReport, step31NReport, step31OReport, step31PReport, step31QReport, step31RReport, step31SReport, step31TReport, sourceProtection] = await Promise.all([
  readJson(paths.policy),
  readJson(paths.scope),
  readJson(paths.rules),
  readJson(paths.enforcement),
  readJson(paths.governance),
  readJson(paths.workPlan),
  readJson(paths.stepReport),
  readJson(paths.step31AReport),
  readJson(paths.step31BReport),
  readJson(paths.step31CReport),
  readJson(paths.step31DReport),
  readJson(paths.step31EReport),
  readJson(paths.step31FReport),
  readJson(paths.step31GReport),
  readJson(paths.step31HReport),
  readJson(paths.step31IReport),
  readJson(paths.step31JReport),
  readJson(paths.step31KReport),
  readJson(paths.step31LReport),
  readJson(paths.step31MReport),
  readJson(paths.step31NReport),
  readJson(paths.step31OReport),
  readJson(paths.step31PReport),
  readJson(paths.step31QReport),
  readJson(paths.step31RReport),
  readJson(paths.step31SReport),
  readJson(paths.step31TReport),
  readJson(paths.sourceProtection)
]);
const official30ZComplete = stepReport.officialStepStatus === 'COMPLETED'
  && stepReport.persistentReceiptStatus === 'PASS'
  && stepReport.officialCompletionClaimed === true;
const official31AComplete = step31AReport.officialStepStatus === 'COMPLETED'
  && step31AReport.persistentReceiptStatus === 'PASS'
  && step31AReport.officialCompletionClaimed === true;
const official31BComplete = step31BReport.officialStepStatus === 'COMPLETED'
  && step31BReport.persistentReceiptStatus === 'PASS'
  && step31BReport.officialCompletionClaimed === true;
const official31CComplete = step31CReport.officialStepStatus === 'COMPLETED'
  && step31CReport.persistentReceiptStatus === 'PASS'
  && step31CReport.officialCompletionClaimed === true;
const official31DComplete = step31DReport.officialStepStatus === 'COMPLETED'
  && step31DReport.persistentReceiptStatus === 'PASS'
  && step31DReport.officialCompletionClaimed === true;
const official31EComplete = step31EReport.officialStepStatus === 'COMPLETED'
  && step31EReport.persistentReceiptStatus === 'PASS'
  && step31EReport.officialCompletionClaimed === true;
const official31FComplete = step31FReport.officialStepStatus === 'COMPLETED'
  && step31FReport.persistentReceiptStatus === 'PASS'
  && step31FReport.officialCompletionClaimed === true;
const official31GComplete = step31GReport.officialStepStatus === 'COMPLETED'
  && step31GReport.persistentReceiptStatus === 'PASS'
  && step31GReport.officialCompletionClaimed === true;
const official31HComplete = step31HReport.officialStepStatus === 'COMPLETED'
  && step31HReport.persistentReceiptStatus === 'PASS'
  && step31HReport.officialCompletionClaimed === true;
const official31IComplete = step31IReport.officialStepStatus === 'COMPLETED'
  && step31IReport.persistentReceiptStatus === 'PASS'
  && step31IReport.officialCompletionClaimed === true;
const official31JComplete = step31JReport.officialStepStatus === 'COMPLETED'
  && step31JReport.persistentReceiptStatus === 'PASS'
  && step31JReport.officialCompletionClaimed === true;
const officialCheckpointComplete = (report) => report.officialStepStatus === 'COMPLETED'
  && report.persistentReceiptStatus === 'PASS'
  && report.officialCompletionClaimed === true;
const official31KComplete = officialCheckpointComplete(step31KReport);
const official31LComplete = officialCheckpointComplete(step31LReport);
const official31MComplete = officialCheckpointComplete(step31MReport);
const official31NComplete = officialCheckpointComplete(step31NReport);
const official31OComplete = officialCheckpointComplete(step31OReport);
const official31PComplete = officialCheckpointComplete(step31PReport);
const official31QComplete = officialCheckpointComplete(step31QReport);
const official31RComplete = officialCheckpointComplete(step31RReport);
const official31SComplete = officialCheckpointComplete(step31SReport);
const official31TComplete = officialCheckpointComplete(step31TReport);

const requirements = Array.isArray(scope.requirements) ? scope.requirements : [];
const activeRules = Array.isArray(rules.rules)
  ? rules.rules.filter((rule) => rule.state === 'ACTIVE')
  : [];
const enforcementEntries = Array.isArray(enforcement.entries) ? enforcement.entries : [];

const chainCoverage = (fields) => {
  let passed = 0;
  let total = 0;
  for (const requirement of requirements) {
    for (const field of fields) {
      total += 1;
      if (requirement.chain?.[field] === true) passed += 1;
    }
  }
  return { passed, total, percent: percent(passed, total) };
};

const statusCounts = countBy(requirements, 'status');
const priorityCounts = countBy(requirements, 'priority');
const strictComplete = statusCounts.COMPLETE ?? 0;
const ppk002 = requirements.find((requirement) => requirement.id === 'PPK-002');
const ppk003 = requirements.find((requirement) => requirement.id === 'PPK-003');
const ppk004 = requirements.find((requirement) => requirement.id === 'PPK-004');
const ppk005 = requirements.find((requirement) => requirement.id === 'PPK-005');
const ppk006 = requirements.find((requirement) => requirement.id === 'PPK-006');
const ppk007 = requirements.find((requirement) => requirement.id === 'PPK-007');
const startedStatuses = new Set(['PARTIAL', 'FOUNDATION_STARTED']);
const chainScore = (requirement) => [
  ...policy.implementationChainFields,
  ...policy.governanceChainFields
].filter((field) => requirement.chain?.[field] === true).length;
const incomplete = requirements
  .filter((requirement) => requirement.status !== 'COMPLETE')
  .sort((left, right) => {
    const order = { P0: 0, P1: 1, P2: 2 };
    const startedOrder = Number(!startedStatuses.has(left.status)) - Number(!startedStatuses.has(right.status));
    return startedOrder
      || (order[left.priority] ?? 9) - (order[right.priority] ?? 9)
      || chainScore(right) - chainScore(left)
      || String(left.id).localeCompare(String(right.id), 'en');
  });

const runGate = (script) => {
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });
  const combined = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    script,
    exitCode: Number.isInteger(result.status) ? result.status : 99,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    tail: combined.slice(-8)
  };
};

const currentGates = policy.currentGates.map(runGate);
const historicalProgressVerifier = runGate(policy.historicalProgressVerifier);
const currentGatesPass = currentGates.every((gate) => gate.status === 'PASS');
const implementationCoverage = chainCoverage(policy.implementationChainFields);
const governanceCoverage = chainCoverage(policy.governanceChainFields);
const completeByPriority = Object.fromEntries(['P0', 'P1', 'P2'].map((priority) => [
  priority,
  requirements.filter((item) => item.priority === priority && item.status === 'COMPLETE').length
]));
const advancedCheckpoint = (report, officialCompletionClaimed) => ({
  targetSliceStatus: report.targetSliceStatus,
  officialStepStatus: report.officialStepStatus,
  primaryRequirement: report.primaryRequirement,
  requirements: report.requirements ?? [],
  persistentReceiptStatus: report.persistentReceiptStatus,
  officialCompletionClaimed,
  requirementCompletionClaimed: report.requirementCompletionClaimed,
  deliveredBoundary: report.deliveredBoundary ?? {},
  openBoundaries: report.openBoundaries ?? {}
});

const report = {
  schemaVersion: 1,
  id: 'BRONZE-CURRENT-COMPLETION-AUDIT',
  generatedAt: new Date().toISOString(),
  release: governance.release,
  PPK002: ppk002?.status ?? 'MISSING',
  PPK003: ppk003?.status ?? 'MISSING',
  PPK004: ppk004?.status ?? 'MISSING',
  PPK005: ppk005?.status ?? 'MISSING',
  PPK006: ppk006?.status ?? 'MISSING',
  PPK007: ppk007?.status ?? 'MISSING',
  authoritativeSource: policy.authoritativeSource,
  currentStep: workPlan.currentStep,
  status: currentGatesPass ? 'PASS_WITH_OPEN_SCOPE' : 'FAIL_CURRENT_GATE',
  numberingAssessment: {
    status: 'CORRECT_ONLY_WITH_GATED_APPEND_ONLY_NUMBERING',
    ...policy.numberingPolicy,
    newBuildAssigned: false,
    reason: official31TComplete
      ? 'The 31-X, 31-Y, 31-Z, 32-A, 32-B and 32-C top closures complete PPK-002 universal enforcement, PPK-003 bounded default-deny availability, PPK-004 complete policy-context binding, PPK-005 complete data classification, PPK-006 complete policy obligations and PPK-007 signed versioned policy packages. Other Bronze scope remains open.'
      : official31SComplete
      ? 'The 31-S detached versioned cutover decision preflight and current authoritative-source protection have verified D: external receipts. No successor decision, real-data transfer, SQLite ownership transfer, automatic activation, or cutover authority exists.'
      : official31RComplete
      ? 'The 31-R detached explicit-user approval receipt boundary and current authoritative-source protection have verified D: external receipts. No real approval, production verifier, successor decision, activation, or cutover authority exists.'
      : official31QComplete
      ? 'The 31-Q synthetic end-to-end security evidence aggregator and current authoritative-source protection have verified D: external receipts. Real security exercises and independent production evidence verification remain absent.'
      : official31PComplete
      ? 'The 31-P synthetic rollback-recovery drill and current authoritative-source protection have verified D: external receipts. A real process crash and real backup restore remain unperformed.'
      : official31OComplete
      ? 'The 31-O synthetic key-lifecycle proof harness and current authoritative-source protection have verified D: external receipts. A production protected provider and real key-lifecycle proof remain absent.'
      : official31NComplete
      ? 'The 31-N synthetic single-writer proof harness and current authoritative-source protection have verified D: external receipts. A production writer lease and real single-writer proof remain absent.'
      : official31MComplete
      ? 'The 31-M signed readiness-evidence verifier boundary and current authoritative-source protection have verified D: external receipts. Production verifier-key authority and runtime attachment remain absent.'
      : official31LComplete
      ? 'The 31-L protected cutover-readiness journal port and current authoritative-source protection have verified D: external receipts. A production journal adapter remains absent.'
      : official31KComplete
      ? 'The 31-K monotonic cutover-readiness evidence boundary and current authoritative-source protection have verified D: external receipts. Production evidence authorities and real cutover remain absent.'
      : official31JComplete
      ? 'The 31-J family-data coexistence and default-deny cutover gate and current authoritative-source protection have verified D: external receipts. The existing Desktop vault remains authoritative; real data/SQLite cutover, Core Service unlock, family APIs, backup/sync, Windows service installation and remaining Bronze scope stay open.'
      : official31IComplete
      ? 'The 31-I headless shared device-secret protection boundary and current authoritative-source protection have verified D: external receipts. Portable vault, Core Service unlock, SQLite ownership, family APIs, backup/sync, Windows service installation and remaining Bronze scope stay open.'
      : official31HComplete
      ? 'The 31-H protected family-data session ownership control plane and current authoritative-source protection have verified D: external receipts. Protected vault handoff, SQLite ownership, family APIs, backup/sync, Windows service installation and remaining Bronze scope stay open.'
      : official31GComplete
      ? 'The 31-G main-structure Core Service API foundation and current authoritative-source protection have verified D: external receipts. Family data, backup/sync ownership migrations, Windows service installation and remaining Bronze scope stay open.'
      : official31FComplete
      ? 'The focused 31-F PPK-002 created-location linked-event boundary and current authoritative-source protection have verified D: external receipts. Governed import rollback, universal PPK-002 enforcement and remaining Bronze scope stay open.'
      : official31EComplete
      ? 'The focused 31-E B0-02 public release boundary and current authoritative-source protection have verified D: external receipts. PPK-002 and remaining Bronze scope stay open.'
      : official31DComplete
      ? 'The focused 31-D checkpoint and current authoritative-source protection have verified D: external receipts. Newly-created-location-linked event import, governed rollback, PPK-002 and Bronze scope remain open.'
      : official31CComplete
      ? 'The focused 31-C checkpoint has a verified external receipt, while location-linked event import, governed rollback, PPK-002, Bronze scope and current-source external protection remain open.'
      : official31BComplete
      ? 'The focused 31-B checkpoint has a verified external receipt, while multi-receipt import, PPK-002, Bronze scope and current-source external protection remain open.'
      : official31AComplete
      ? 'The focused 31-A checkpoint has a verified external receipt, while PPK-002, Bronze scope and current-source external protection remain open.'
      : official30ZComplete
      ? 'The frozen 30-Z checkpoint has a verified external receipt, while Bronze scope and current-source external protection remain open.'
      : 'Bronze scope is open and the external 30-Z persistent receipt remains pending.'
  },
  percentages: {
    officialWeightedBronzePercent: stepReport.bronzeCompletedPercent,
    officialWeightedEvidenceStep: official31TComplete ? '31-T' : official31SComplete ? '31-S' : official31RComplete ? '31-R' : official31QComplete ? '31-Q' : official31PComplete ? '31-P' : official31OComplete ? '31-O' : official31NComplete ? '31-N' : official31MComplete ? '31-M' : official31LComplete ? '31-L' : official31KComplete ? '31-K' : official31JComplete ? '31-J' : official31IComplete ? '31-I' : official31HComplete ? '31-H' : official31GComplete ? '31-G' : official31FComplete ? '31-F' : official31EComplete ? '31-E' : official31DComplete ? '31-D' : official31CComplete ? '31-C' : official31BComplete ? '31-B' : official31AComplete ? '31-A' : '30-Z',
    strictRequirementCompletionPercent: percent(strictComplete, requirements.length),
    implementationChainCoveragePercent: implementationCoverage.percent,
    governanceEvidenceChainCoveragePercent: governanceCoverage.percent,
    interpretation: 'These are separate measures and must not be blended into an invented single completion claim.'
  },
  scope: {
    total: requirements.length,
    statusCounts,
    priorityCounts,
    completeByPriority,
    incompleteCount: incomplete.length,
    strictComplete,
    implementationCoverage,
    governanceCoverage
  },
  rules: {
    canonicalRuleCount: Array.isArray(rules.rules) ? rules.rules.length : 0,
    activeRuleCount: activeRules.length,
    enforcementEntryCount: enforcementEntries.length,
    allActiveRulesHaveEnforcementEntry: activeRules.every((rule) => enforcementEntries.some((entry) => entry.ruleId === rule.id))
  },
  gates: {
    current: currentGates,
    allCurrentPass: currentGatesPass,
    historical29D5: {
      ...historicalProgressVerifier,
      classification: policy.historicalVerifierUse,
      countsAsCurrentGate: false
    }
  },
  checkpoint30Z: {
    targetSliceStatus: stepReport.targetSliceStatus,
    officialStepStatus: stepReport.officialStepStatus,
    PPK002: stepReport.PPK002,
    persistentReceiptStatus: stepReport.persistentReceiptStatus,
    officialCompletionClaimed: official30ZComplete,
    openBoundaries: stepReport.openBoundaries ?? []
  },
  checkpoint31A: {
    targetSliceStatus: step31AReport.targetSliceStatus,
    officialStepStatus: step31AReport.officialStepStatus,
    PPK002: step31AReport.PPK002,
    persistentReceiptStatus: step31AReport.persistentReceiptStatus,
    officialCompletionClaimed: official31AComplete,
    openBoundaries: step31AReport.openBoundaries ?? []
  },
  checkpoint31B: {
    targetSliceStatus: step31BReport.targetSliceStatus,
    officialStepStatus: step31BReport.officialStepStatus,
    PPK002: step31BReport.PPK002,
    persistentReceiptStatus: step31BReport.persistentReceiptStatus,
    officialCompletionClaimed: official31BComplete,
    openBoundaries: step31BReport.openBoundaries ?? []
  },
  checkpoint31C: {
    targetSliceStatus: step31CReport.targetSliceStatus,
    officialStepStatus: step31CReport.officialStepStatus,
    PPK002: step31CReport.PPK002,
    persistentReceiptStatus: step31CReport.persistentReceiptStatus,
    officialCompletionClaimed: official31CComplete,
    openBoundaries: step31CReport.openBoundaries ?? []
  },
  checkpoint31D: {
    targetSliceStatus: step31DReport.targetSliceStatus,
    officialStepStatus: step31DReport.officialStepStatus,
    PPK002: step31DReport.PPK002,
    persistentReceiptStatus: step31DReport.persistentReceiptStatus,
    officialCompletionClaimed: official31DComplete,
    openBoundaries: step31DReport.openBoundaries ?? []
  },
  checkpoint31E: {
    targetSliceStatus: step31EReport.targetSliceStatus,
    officialStepStatus: step31EReport.officialStepStatus,
    B002: step31EReport.B002,
    persistentReceiptStatus: step31EReport.persistentReceiptStatus,
    officialCompletionClaimed: official31EComplete,
    publicBoundary: step31EReport.publicBoundary ?? {}
  },
  checkpoint31F: {
    targetSliceStatus: step31FReport.targetSliceStatus,
    officialStepStatus: step31FReport.officialStepStatus,
    PPK002: step31FReport.PPK002,
    persistentReceiptStatus: step31FReport.persistentReceiptStatus,
    officialCompletionClaimed: official31FComplete,
    openBoundaries: step31FReport.openBoundaries ?? {}
  },
  checkpoint31G: {
    targetSliceStatus: step31GReport.targetSliceStatus,
    officialStepStatus: step31GReport.officialStepStatus,
    primaryRequirement: step31GReport.primaryRequirement,
    requirements: step31GReport.requirements ?? [],
    persistentReceiptStatus: step31GReport.persistentReceiptStatus,
    officialCompletionClaimed: official31GComplete,
    requirementCompletionClaimed: step31GReport.requirementCompletionClaimed,
    openBoundaries: step31GReport.openBoundaries ?? {}
  },
  checkpoint31H: {
    targetSliceStatus: step31HReport.targetSliceStatus,
    officialStepStatus: step31HReport.officialStepStatus,
    primaryRequirement: step31HReport.primaryRequirement,
    requirements: step31HReport.requirements ?? [],
    persistentReceiptStatus: step31HReport.persistentReceiptStatus,
    officialCompletionClaimed: official31HComplete,
    requirementCompletionClaimed: step31HReport.requirementCompletionClaimed,
    openBoundaries: step31HReport.openBoundaries ?? {}
  },
  checkpoint31I: {
    targetSliceStatus: step31IReport.targetSliceStatus,
    officialStepStatus: step31IReport.officialStepStatus,
    primaryRequirement: step31IReport.primaryRequirement,
    requirements: step31IReport.requirements ?? [],
    persistentReceiptStatus: step31IReport.persistentReceiptStatus,
    officialCompletionClaimed: official31IComplete,
    requirementCompletionClaimed: step31IReport.requirementCompletionClaimed,
    openBoundaries: step31IReport.openBoundaries ?? {}
  },
  checkpoint31J: {
    targetSliceStatus: step31JReport.targetSliceStatus,
    officialStepStatus: step31JReport.officialStepStatus,
    primaryRequirement: step31JReport.primaryRequirement,
    requirements: step31JReport.requirements ?? [],
    persistentReceiptStatus: step31JReport.persistentReceiptStatus,
    officialCompletionClaimed: official31JComplete,
    requirementCompletionClaimed: step31JReport.requirementCompletionClaimed,
    requiredFutureGates: step31JReport.requiredFutureGates ?? [],
    openBoundaries: step31JReport.openBoundaries ?? {}
  },
  checkpoint31K: advancedCheckpoint(step31KReport, official31KComplete),
  checkpoint31L: advancedCheckpoint(step31LReport, official31LComplete),
  checkpoint31M: advancedCheckpoint(step31MReport, official31MComplete),
  checkpoint31N: advancedCheckpoint(step31NReport, official31NComplete),
  checkpoint31O: advancedCheckpoint(step31OReport, official31OComplete),
  checkpoint31P: advancedCheckpoint(step31PReport, official31PComplete),
  checkpoint31Q: advancedCheckpoint(step31QReport, official31QComplete),
  checkpoint31R: advancedCheckpoint(step31RReport, official31RComplete),
  checkpoint31S: advancedCheckpoint(step31SReport, official31SComplete),
  checkpoint31T: advancedCheckpoint(step31TReport, official31TComplete),
  currentSourceExternalProtection: {
    status: sourceProtection.externalLibraryReceiptStatus,
    officialCompletionClaimed: sourceProtection.officialCompletionClaimed,
    storageBackend: sourceProtection.externalReceipt?.storageBackend ?? 'UNAVAILABLE',
    externalPath: sourceProtection.externalReceipt?.externalPath ?? null
  },
  remainingWork: incomplete.map((item) => ({
    id: item.id,
    priority: item.priority,
    status: item.status,
    workOrderClass: startedStatuses.has(item.status) ? 'STARTED_BEFORE_NEW' : 'NEW_NOT_STARTED',
    area: item.area,
    title: item.title,
    completedChainCount: chainScore(item),
    completionBlockers: item.completionBlockers ?? [],
    missingChain: [...policy.implementationChainFields, ...policy.governanceChainFields]
      .filter((field) => item.chain?.[field] !== true)
  })),
  silverStatus: scope.silverGate,
  mandatoryTruthSentence: truth
};

const topRemaining = report.remainingWork.slice(0, 30);
const advancedCheckpointTitles = Object.freeze({
  K: 'monotonic cutover readiness evidence',
  L: 'protected cutover-readiness journal port',
  M: 'signed readiness-evidence verifier boundary',
  N: 'synthetic single-writer proof harness',
  O: 'synthetic key-lifecycle proof harness',
  P: 'synthetic rollback-recovery drill',
  Q: 'synthetic end-to-end security evidence aggregator',
  R: 'explicit-user cutover approval receipt boundary',
  S: 'versioned cutover decision preflight',
  T: 'PPK-002 family import governed rollback receipt fence'
});
const advancedCheckpointMarkdown = Object.entries(advancedCheckpointTitles).map(([letter, title]) => {
  const checkpoint = report[`checkpoint31${letter}`];
  return `## 31-${letter} ${title}\n\n- Hedef dilim: ${checkpoint.targetSliceStatus}\n- Resmi adim: ${checkpoint.officialStepStatus}\n- Birincil gereksinim: ${checkpoint.primaryRequirement}\n- Harici persistent receipt: ${checkpoint.persistentReceiptStatus}\n- Resmi 31-${letter} checkpoint tamamlanma iddiasi: ${checkpoint.officialCompletionClaimed}\n- Gereksinim COMPLETE iddiasi: ${checkpoint.requirementCompletionClaimed}`;
}).join('\n\n');
const markdown = `# Bronze guncel tamamlama denetimi

Olusturma (UTC): ${report.generatedAt}

## Sonuc

- Denetim durumu: **${report.status}**
- Yetkili kaynak: \`${report.authoritativeSource}\`
- Guncel adim: **${report.currentStep}**
- PPK-002: **${report.PPK002}**
- PPK-003: **${report.PPK003}**
- PPK-004: **${report.PPK004}**
- PPK-005: **${report.PPK005}**
- PPK-006: **${report.PPK006}**
- PPK-007: **${report.PPK007}**
- Yeni Build verildi: **Hayir**

## Yuzde gercekligi

- Resmi agirlikli Bronze ilerlemesi: **%${report.percentages.officialWeightedBronzePercent}**
- Kati gereksinim kapanisi: **%${report.percentages.strictRequirementCompletionPercent}** (${strictComplete}/${requirements.length})
- Uygulama zinciri kapsami: **%${report.percentages.implementationChainCoveragePercent}**
- Yonetisim ve kanit zinciri kapsami: **%${report.percentages.governanceEvidenceChainCoveragePercent}**

Bu oranlar farkli seyleri olcer ve tek bir uydurma yuzdede birlestirilemez.

## Kapsam durumu

- COMPLETE: ${statusCounts.COMPLETE ?? 0}
- PARTIAL: ${statusCounts.PARTIAL ?? 0}
- FOUNDATION_STARTED: ${statusCounts.FOUNDATION_STARTED ?? 0}
- NOT_IMPLEMENTED: ${statusCounts.NOT_IMPLEMENTED ?? 0}
- Toplam acik gereksinim: ${incomplete.length}

## Kural ve kapilar

- Kanonik kural: ${report.rules.canonicalRuleCount}
- Aktif kural: ${report.rules.activeRuleCount}
- Enforcement kaydi: ${report.rules.enforcementEntryCount}
- Tum guncel kapilar PASS: ${report.gates.allCurrentPass}
- 29-D5 dogrulayici: ${historicalProgressVerifier.status}; yalniz tarihsel baseline, guncel 30-Z kapisi degildir.

## 30-Z siniri

- Hedef dilim: ${report.checkpoint30Z.targetSliceStatus}
- Resmi adim: ${report.checkpoint30Z.officialStepStatus}
- PPK-002: ${report.checkpoint30Z.PPK002}
- Harici persistent receipt: ${report.checkpoint30Z.persistentReceiptStatus}
- Resmi 30-Z tamamlanma iddiasi: ${report.checkpoint30Z.officialCompletionClaimed}
- Guncel C kaynak agaci harici koruma: ${report.currentSourceExternalProtection.status}
- Harici kaynak backend: ${report.currentSourceExternalProtection.storageBackend}

## 31-A siniri

- Hedef dilim: ${report.checkpoint31A.targetSliceStatus}
- Resmi adim: ${report.checkpoint31A.officialStepStatus}
- PPK-002: ${report.checkpoint31A.PPK002}
- Harici persistent receipt: ${report.checkpoint31A.persistentReceiptStatus}
- Resmi 31-A tamamlanma iddiasi: ${report.checkpoint31A.officialCompletionClaimed}

## 31-B siniri

- Hedef dilim: ${report.checkpoint31B.targetSliceStatus}
- Resmi adim: ${report.checkpoint31B.officialStepStatus}
- PPK-002: ${report.checkpoint31B.PPK002}
- Harici persistent receipt: ${report.checkpoint31B.persistentReceiptStatus}
- Resmi 31-B tamamlanma iddiasi: ${report.checkpoint31B.officialCompletionClaimed}

## 31-C siniri

- Hedef dilim: ${report.checkpoint31C.targetSliceStatus}
- Resmi adim: ${report.checkpoint31C.officialStepStatus}
- PPK-002: ${report.checkpoint31C.PPK002}
- Harici persistent receipt: ${report.checkpoint31C.persistentReceiptStatus}
- Resmi 31-C tamamlanma iddiasi: ${report.checkpoint31C.officialCompletionClaimed}

## 31-D siniri

- Hedef dilim: ${report.checkpoint31D.targetSliceStatus}
- Resmi adim: ${report.checkpoint31D.officialStepStatus}
- PPK-002: ${report.checkpoint31D.PPK002}
- Harici persistent receipt: ${report.checkpoint31D.persistentReceiptStatus}
- Resmi 31-D tamamlanma iddiasi: ${report.checkpoint31D.officialCompletionClaimed}

## 31-E siniri

- Hedef dilim: ${report.checkpoint31E.targetSliceStatus}
- Resmi adim: ${report.checkpoint31E.officialStepStatus}
- B0-02: ${report.checkpoint31E.B002}
- Harici persistent receipt: ${report.checkpoint31E.persistentReceiptStatus}
- Resmi 31-E tamamlanma iddiasi: ${report.checkpoint31E.officialCompletionClaimed}

## 31-F siniri

- Hedef dilim: ${report.checkpoint31F.targetSliceStatus}
- Resmi adim: ${report.checkpoint31F.officialStepStatus}
- PPK-002: ${report.checkpoint31F.PPK002}
- Harici persistent receipt: ${report.checkpoint31F.persistentReceiptStatus}
- Resmi 31-F tamamlanma iddiasi: ${report.checkpoint31F.officialCompletionClaimed}

## 31-G ana yapi siniri

- Hedef dilim: ${report.checkpoint31G.targetSliceStatus}
- Resmi adim: ${report.checkpoint31G.officialStepStatus}
- Birincil gereksinim: ${report.checkpoint31G.primaryRequirement}
- Harici persistent receipt: ${report.checkpoint31G.persistentReceiptStatus}
- Resmi 31-G checkpoint tamamlanma iddiasi: ${report.checkpoint31G.officialCompletionClaimed}
- Gereksinim COMPLETE iddiasi: ${report.checkpoint31G.requirementCompletionClaimed}

## 31-H aile-verisi sahiplik kontrol duzlemi

- Hedef dilim: ${report.checkpoint31H.targetSliceStatus}
- Resmi adim: ${report.checkpoint31H.officialStepStatus}
- Birincil gereksinim: ${report.checkpoint31H.primaryRequirement}
- Harici persistent receipt: ${report.checkpoint31H.persistentReceiptStatus}
- Resmi 31-H checkpoint tamamlanma iddiasi: ${report.checkpoint31H.officialCompletionClaimed}
- Gereksinim COMPLETE iddiasi: ${report.checkpoint31H.requirementCompletionClaimed}

## 31-I headless cihaz-sir koruma siniri

- Hedef dilim: ${report.checkpoint31I.targetSliceStatus}
- Resmi adim: ${report.checkpoint31I.officialStepStatus}
- Birincil gereksinim: ${report.checkpoint31I.primaryRequirement}
- Harici persistent receipt: ${report.checkpoint31I.persistentReceiptStatus}
- Resmi 31-I checkpoint tamamlanma iddiasi: ${report.checkpoint31I.officialCompletionClaimed}
- Gereksinim COMPLETE iddiasi: ${report.checkpoint31I.requirementCompletionClaimed}

## 31-J aile-verisi birlikte calisma ve varsayilan-ret gecis kapisi

- Hedef dilim: ${report.checkpoint31J.targetSliceStatus}
- Resmi adim: ${report.checkpoint31J.officialStepStatus}
- Birincil gereksinim: ${report.checkpoint31J.primaryRequirement}
- Harici persistent receipt: ${report.checkpoint31J.persistentReceiptStatus}
- Resmi 31-J checkpoint tamamlanma iddiasi: ${report.checkpoint31J.officialCompletionClaimed}
- Gereksinim COMPLETE iddiasi: ${report.checkpoint31J.requirementCompletionClaimed}
- Gercek kasa gecisi: ${report.checkpoint31J.openBoundaries.realVaultTransfer}
- SQLite sahiplik gecisi: ${report.checkpoint31J.openBoundaries.sqliteOwnershipTransfer}

${advancedCheckpointMarkdown}

## DEC-137 sirasinda ilk 30 acik is

Baslanmis PARTIAL/FOUNDATION_STARTED isler yeni NOT_IMPLEMENTED islerden once; her sinifta P0, P1 ve P2 sirasiyla listelenir. Ayni oncelikte kapanisa en yakin zincir once gelir.

| Kimlik | Sinif | Oncelik | Durum | Zincir | Alan | Baslik |
|---|---|---|---|---:|---|---|
${topRemaining.map((item) => `| ${item.id} | ${item.workOrderClass} | ${item.priority} | ${item.status} | ${item.completedChainCount}/13 | ${String(item.area).replaceAll('|', '/')} | ${String(item.title).replaceAll('|', '/')} |`).join('\n')}

Tam acik-is listesi \`artifacts/inventory/BRONZE_CURRENT_COMPLETION_AUDIT.json\` icindedir.

${truth}
`;

await mkdir(dirname(paths.jsonReport), { recursive: true });
await mkdir(dirname(paths.markdownReport), { recursive: true });
await writeFile(paths.jsonReport, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await writeFile(paths.markdownReport, markdown, 'utf8');

console.log(`Bronze current audit: ${report.status}; official=${report.percentages.officialWeightedBronzePercent}%; strict=${report.percentages.strictRequirementCompletionPercent}%; implementation-chain=${report.percentages.implementationChainCoveragePercent}%.`);
if (!currentGatesPass) process.exit(1);
