import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const expectedRoot = 'C:\\PPT\\AYM\\06_KOD\\app';
const root = resolve(process.cwd());
if (root.toLocaleLowerCase('en-US') !== expectedRoot.toLocaleLowerCase('en-US')) {
  throw new Error(`DEC-156 governance application must run from ${expectedRoot}; received ${root}`);
}

const readJson = (relativePath) => JSON.parse(readFileSync(resolve(root, relativePath), 'utf8'));
const writeJson = (relativePath, value) => writeFileSync(
  resolve(root, relativePath),
  `${JSON.stringify(value, null, 2)}\n`,
  'utf8'
);
const appendUnique = (target, values) => {
  for (const value of values) if (!target.includes(value)) target.push(value);
};

const ledger = readJson('config/user-decision-ledger.json');
const decision = {
  id: 'DEC-156',
  date: '2026-08-10',
  acceptedAt: '2026-08-10',
  title: 'PPK-002 timeline-event policy enforcement local continuation',
  status: 'ACTIVE',
  source: 'Explicit user full-auto instruction to continue started PARTIAL work under DEC-137 without advancing 30-Z or issuing a Build',
  document: 'docs/decisions/DEC-156-ppk-002-timeline-event-policy-local-continuation.md',
  rules: ['PR-087', 'PR-187', 'PR-189', 'PR-194', 'PR-203', 'PR-208'],
  requirements: ['PPK-002'],
  codeAreas: [
    'packages/application/src/timeline-use-cases.ts',
    'packages/repository-contracts/src/timeline-repository.ts',
    'packages/repositories/src/timeline-repository.ts',
    'packages/database/src/family-database-migrations.ts',
    'apps/desktop/src/main/timeline-application-adapter.ts',
    'apps/desktop/src/main/timeline-production-policy-runtime.ts',
    'apps/desktop/src/main/data-store.ts',
    'apps/desktop/src/main/family-data-import-service.ts',
    'scripts/apply-ppk002-timeline-repository-foundation.mjs',
    'scripts/apply-ppk002-timeline-policy-runtime.mjs',
    'scripts/verify-ppk002-timeline-policy-local-continuation.mjs'
  ],
  evidence: [
    'artifacts/authority/PPK002_TIMELINE_LOCAL_CONTINUATION_AUTHORITY.json',
    'artifacts/validation/PPK002_TIMELINE_POLICY_LOCAL_CONTINUATION.json',
    'artifacts/manifests/TIMELINE_USE_CASE_VERIFICATION_MVP56.json',
    'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
    'docs/audit/PPK-002_TIMELINE_POLICY_LOCAL_CONTINUATION.md'
  ]
};
const existingDecision = ledger.decisions.find((candidate) => candidate.id === decision.id);
if (existingDecision) {
  if (JSON.stringify(existingDecision) !== JSON.stringify(decision)) {
    throw new Error('Existing DEC-156 ledger entry differs from the governed local continuation record');
  }
} else {
  ledger.decisions.push(decision);
}
ledger.decisionCount = ledger.decisions.length;
writeJson('config/user-decision-ledger.json', ledger);

const scope = readJson('config/accepted-scope-registry.json');
const requirement = scope.requirements.find((candidate) => candidate.id === 'PPK-002');
if (!requirement) throw new Error('PPK-002 is missing from accepted scope');
if (requirement.status !== 'PARTIAL' || requirement.priority !== 'P0') {
  throw new Error('DEC-156 cannot alter the PPK-002 PARTIAL/P0 truth boundary');
}
const chainBefore = JSON.stringify(requirement.chain);
appendUnique(requirement.evidence, [
  'artifacts/authority/PPK002_TIMELINE_LOCAL_CONTINUATION_AUTHORITY.json',
  'docs/decisions/DEC-156-ppk-002-timeline-event-policy-local-continuation.md',
  'docs/audit/PPK-002_TIMELINE_POLICY_LOCAL_CONTINUATION.md',
  'artifacts/validation/PPK002_TIMELINE_POLICY_LOCAL_CONTINUATION.json',
  'artifacts/manifests/TIMELINE_USE_CASE_VERIFICATION_MVP56.json',
  'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'
]);
if (JSON.stringify(requirement.chain) !== chainBefore || requirement.status !== 'PARTIAL') {
  throw new Error('DEC-156 attempted to overclaim universal PPK-002 completion');
}
writeJson('config/accepted-scope-registry.json', scope);

const packagePath = resolve(root, 'package.json');
const packageSource = readFileSync(packagePath, 'utf8');
const command = '    "verify:ppk002:timeline:local": "node scripts/verify-ppk002-timeline-policy-local-continuation.mjs",\n';
if (!packageSource.includes(command)) {
  const anchor = '    "audit:bronze:current": "node scripts/audit-bronze-current-state.mjs",\n';
  if (!packageSource.includes(anchor) || packageSource.indexOf(anchor) !== packageSource.lastIndexOf(anchor)) {
    throw new Error('package.json current audit command anchor is missing or ambiguous');
  }
  writeFileSync(packagePath, packageSource.replace(anchor, `${command}${anchor}`), 'utf8');
}

const decisionsMarkdown = [
  '# Kullanıcı Kararları Kaydı',
  '',
  `- Görünür sürüm: **${ledger.release}**`,
  '- Makine okunur defter: `config/user-decision-ledger.json`',
  `- Aktif karar sayısı: **${ledger.decisionCount}**`,
  '',
  'Bu kayıt, konuşmanın kelimesi kelimesine kopyası olduğunu iddia etmez. Bağlayıcı kullanıcı kararlarını karar düzeyinde, etkilediği kural/belge/kod alanlarıyla saklar. Ham konuşma erişimi olmadan “tam transcript” iddiası yapılmaz.',
  '',
  '## Bu sürümde kaydedilen kararlar',
  '',
  ...ledger.decisions.map((item) => `- \`${item.id}\` — ${item.title}`),
  ''
].join('\n');
writeFileSync(resolve(root, 'docs/current/09_KULLANICI_KARARLARI_KAYDI.md'), decisionsMarkdown, 'utf8');

console.log(JSON.stringify({
  decisionId: 'DEC-156',
  decisionCount: ledger.decisionCount,
  requirementId: requirement.id,
  requirementStatus: requirement.status,
  chainUnchanged: true,
  packageCommand: 'verify:ppk002:timeline:local',
  officialStepAdvanced: false,
  officialBuildClaim: false,
  external30ZReceipt: 'PENDING'
}, null, 2));
