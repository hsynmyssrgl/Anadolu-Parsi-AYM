import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sourceRoot = resolve(process.cwd());
const expectedSource = resolve('C:\\PPT\\AYM', '06_KOD', 'app');
if (sourceRoot !== expectedSource) throw new Error(`Unsafe source root: ${sourceRoot}`);

const mode = process.argv[2] ?? 'group-a';

const writeChecked = async (path, content) => {
  await writeFile(path, content, 'utf8');
  if (await readFile(path, 'utf8') !== content) throw new Error(`Readback mismatch: ${path}`);
};

const replaceOnce = (content, before, after, label) => {
  if (content.includes(after)) return content;
  const first = content.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source text not found`);
  if (content.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: expected source text is not unique`);
  return `${content.slice(0, first)}${after}${content.slice(first + before.length)}`;
};

const patchGroupA = async () => {
  const auditPath = resolve(sourceRoot, 'scripts', 'audit-bronze-current-state.mjs');
  let audit = await readFile(auditPath, 'utf8');
  audit = replaceOnce(
    audit,
    "? rules.rules.filter((rule) => rule.status === 'ACTIVE')",
    "? rules.rules.filter((rule) => rule.state === 'ACTIVE')",
    'active rule field'
  );
  audit = replaceOnce(
    audit,
    "const strictComplete = statusCounts.COMPLETE ?? 0;\nconst incomplete = requirements",
    "const strictComplete = statusCounts.COMPLETE ?? 0;\nconst startedStatuses = new Set(['PARTIAL', 'FOUNDATION_STARTED']);\nconst chainScore = (requirement) => [\n  ...policy.implementationChainFields,\n  ...policy.governanceChainFields\n].filter((field) => requirement.chain?.[field] === true).length;\nconst incomplete = requirements",
    'started work helpers'
  );
  audit = replaceOnce(
    audit,
    "    return (order[left.priority] ?? 9) - (order[right.priority] ?? 9)\n      || String(left.id).localeCompare(String(right.id), 'en');",
    "    const startedOrder = Number(!startedStatuses.has(left.status)) - Number(!startedStatuses.has(right.status));\n    return startedOrder\n      || (order[left.priority] ?? 9) - (order[right.priority] ?? 9)\n      || chainScore(right) - chainScore(left)\n      || String(left.id).localeCompare(String(right.id), 'en');",
    'DEC-137 ordering'
  );
  audit = replaceOnce(
    audit,
    "    status: item.status,\n    area: item.area,\n    title: item.title,",
    "    status: item.status,\n    workOrderClass: startedStatuses.has(item.status) ? 'STARTED_BEFORE_NEW' : 'NEW_NOT_STARTED',\n    area: item.area,\n    title: item.title,\n    completedChainCount: chainScore(item),\n    completionBlockers: item.completionBlockers ?? [],",
    'remaining work trace fields'
  );
  audit = replaceOnce(
    audit,
    "## Ilk 30 acik is\n\n| Kimlik | Oncelik | Durum | Alan | Baslik |\n|---|---|---|---|---|\n${topRemaining.map((item) => `| ${item.id} | ${item.priority} | ${item.status} | ${String(item.area).replaceAll('|', '/')} | ${String(item.title).replaceAll('|', '/')} |`).join('\\n')}",
    "## DEC-137 sirasinda ilk 30 acik is\n\nBaslanmis PARTIAL/FOUNDATION_STARTED isler yeni NOT_IMPLEMENTED islerden once; her sinifta P0, P1 ve P2 sirasiyla listelenir. Ayni oncelikte kapanisa en yakin zincir once gelir.\n\n| Kimlik | Sinif | Oncelik | Durum | Zincir | Alan | Baslik |\n|---|---|---|---|---:|---|---|\n${topRemaining.map((item) => `| ${item.id} | ${item.workOrderClass} | ${item.priority} | ${item.status} | ${item.completedChainCount}/13 | ${String(item.area).replaceAll('|', '/')} | ${String(item.title).replaceAll('|', '/')} |`).join('\\n')}",
    'markdown work order'
  );
  await writeChecked(auditPath, audit);

  const decisionPath = resolve(sourceRoot, 'docs', 'decisions', 'DEC-152-authoritative-source-local-receipt-and-build-numbering.md');
  let decision = await readFile(decisionPath, 'utf8');
  decision = replaceOnce(
    decision,
    "- `scripts/protect-authoritative-source.mjs`\n- `docs/audit/BRONZE_CURRENT_COMPLETION_AUDIT.md`",
    "- `scripts/protect-authoritative-source.mjs`\n- `scripts/apply-dec152-governance-tooling.mjs`\n- `scripts/update-aym-governance-incrementally.mjs`\n- `scripts/verify-aym-governance-incremental-contract.mjs`\n- `docs/audit/BRONZE_CURRENT_COMPLETION_AUDIT.md`\n- `00_PROJE/ARTIMLI_MANIFEST_GUNCELLEME_KANITI.json`",
    'DEC-152 implementation links'
  );
  decision = replaceOnce(
    decision,
    "- `10_YEDEK/AYM_AKTIF_KOD_<tree-hash>.zip`\n\nBu teslim",
    "- `10_YEDEK/AYM_AKTIF_KOD_<tree-hash>.zip`\n\n## Izlenebilirlik\n\n- Kurallar: `PR-092`, `PR-094`, `PR-095`, `PR-208`\n- Gereksinimler: `GOV-003`, `B9-03`\n- Test: `scripts/verify-aym-governance-incremental-contract.mjs`\n- Kanit: `00_PROJE/ARTIMLI_MANIFEST_GUNCELLEME_KANITI.json`\n\nBu teslim",
    'DEC-152 traceability'
  );
  await writeChecked(decisionPath, decision);

  const packagePath = resolve(sourceRoot, 'package.json');
  let packageText = await readFile(packagePath, 'utf8');
  packageText = replaceOnce(
    packageText,
    '    "audit:bronze:current": "node scripts/audit-bronze-current-state.mjs",\n    "protect:source:create":',
    '    "audit:bronze:current": "node scripts/audit-bronze-current-state.mjs",\n    "governance:update:incremental": "node scripts/update-aym-governance-incrementally.mjs",\n    "verify:governance:incremental": "node scripts/verify-aym-governance-incremental-contract.mjs",\n    "verify:bronze:governance-matrix": "node scripts/verify-bronze-governance-reality-matrix.mjs",\n    "protect:source:create":',
    'package scripts'
  );
  await writeChecked(packagePath, packageText);
};

const patchGroupB = async () => {
  const scopePath = resolve(sourceRoot, 'config', 'accepted-scope-registry.json');
  const scope = JSON.parse(await readFile(scopePath, 'utf8'));
  const requirement = scope.requirements?.find((item) => item.id === 'B0-01');
  if (!requirement) throw new Error('B0-01 requirement not found');
  requirement.status = 'COMPLETE';
  requirement.chain = Object.fromEntries(Object.keys(requirement.chain ?? {}).map((key) => [key, true]));
  requirement.evidence = [
    'docs/decisions/DEC-153-b0-01-governance-reality-matrix-closure.md',
    'config/accepted-scope-registry.json',
    'config/user-decision-ledger.json',
    'config/bronze-current-audit-policy.json',
    'scripts/audit-bronze-current-state.mjs',
    'scripts/verify-bronze-governance-reality-matrix.mjs',
    'artifacts/validation/bronze-governance-reality-matrix.json',
    '../../01_YONETIM/KARAR_SICILI.json',
    '../../00_PROJE/KAPSAM.json'
  ];
  const windowsHello = scope.requirements?.find((item) => item.id === 'B2-01');
  if (!windowsHello) throw new Error('B2-01 requirement not found');
  windowsHello.status = 'COMPLETE';
  windowsHello.completionBlockers = [];
  windowsHello.deferredValidations = [
    {
      id: 'B2-01-NATIVE-WINDOWS-HELLO',
      status: 'USER_DEFERRED_NOT_RUN_NOT_PASS',
      countsAsCompletionBlocker: false,
      reason: 'The current machine does not support native interactive Windows Hello. The product owner temporarily deferred this hardware-only validation; no native PASS is claimed, while the implemented code and strong local-password fallback remain intact.',
      reopenCondition: 'A compatible Windows Hello device and interactive user session become available, or the product owner explicitly re-enables the hardware gate.',
      evidence: [
        'artifacts/validation/30-K-windows-hello-foundation-runtime.json',
        'artifacts/validation/30-L-windows-hello-ipc-ui-runtime.json',
        'artifacts/checkpoints/30-L_COMPLETION_RECORD.json',
        'docs/decisions/DEC-162-windows-hello-hardware-validation-deferral.md'
      ]
    }
  ];
  windowsHello.temporaryClosure = {
    decision: 'DEC-162',
    status: 'COMPLETE_WITH_NON_BLOCKING_HARDWARE_VALIDATION_DEFERRAL',
    runtimeCodePreserved: true,
    passwordFallbackPreserved: true,
    nativePassClaimed: false
  };
  await writeChecked(scopePath, `${JSON.stringify(scope, null, 2)}\n`);

  const ledgerPath = resolve(sourceRoot, 'config', 'user-decision-ledger.json');
  const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
  if (!ledger.decisions.some((item) => item.id === 'DEC-153')) {
    ledger.decisions.push({
      id: 'DEC-153',
      date: '2026-08-09',
      acceptedAt: '2026-08-09',
      title: 'B0-01 single governance and feature-reality matrix closure',
      status: 'ACTIVE',
      source: 'Explicit current user instruction to close started Bronze slices under DEC-137',
      document: 'docs/decisions/DEC-153-b0-01-governance-reality-matrix-closure.md',
      rules: ['PR-087', 'PR-098', 'PR-101', 'PR-124', 'PR-187', 'PR-194', 'PR-203'],
      requirements: ['B0-01'],
      codeAreas: ['scripts/verify-bronze-governance-reality-matrix.mjs', 'scripts/audit-bronze-current-state.mjs'],
      evidence: ['artifacts/validation/bronze-governance-reality-matrix.json']
    });
    ledger.decisionCount = ledger.decisions.length;
  }
  await writeChecked(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
};

if (mode === 'group-a') await patchGroupA();
else if (mode === 'group-b') await patchGroupB();
else throw new Error(`Unknown mode: ${mode}`);

console.log(`DEC-152 governed source transformation: PASS (${mode}).`);
