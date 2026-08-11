import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  LEDGER_PATH,
  calculateRuleSetHash,
  readJson,
  writeJson,
  writeLedgerDocument
} from './lib/master-build-ledger.mjs';

const RULE_VERSION = 'PROJECT-RULES-2026-08-02-V6';
const RULE_TEXT = 'PR-172 yalnız platform tarafından sağlanan gerçek sohbet bağlam kapasitesi yüzde 90 veya üzerindeyken HARD_STOP üretir. Tahmin, geçmiş build tahmini veya kullanılamayan platform sayacı HARD_STOP ya da zorunlu handoff sayılmaz. Gerçek kullanım yüzde 90 altındaysa zorunlu devir üretilmez. Gerçek HARD_STOP durumunda aynı sohbette yeni build başlatılmaz; aynı yanıt içinde tam kopyalanabilir devir metni gösterilir ve NEW_CHAT_HANDOFF_BUILDxxx.md oluşturulur.';
const sha = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const ledger = await readJson(LEDGER_PATH);
const historicalBefore = sha(ledger.builds.filter((entry) => entry.build <= 224));
const base = ledger.projectRules.versions.find((entry) => entry.version === 'PROJECT-RULES-2026-08-01-V5');
if (!base || base.rules.length !== 171) throw new Error('Canonical V5 rule set is missing or unexpected.');

let v6 = ledger.projectRules.versions.find((entry) => entry.version === RULE_VERSION);
if (!v6) {
  v6 = {
    version: RULE_VERSION,
    effectiveBuild: 225,
    rules: [...base.rules, { id: 'PR-172', text: RULE_TEXT }]
  };
  v6.sha256 = calculateRuleSetHash(v6);
  ledger.projectRules.versions.push(v6);
}
if (v6.effectiveBuild !== 225 || v6.rules.length !== 172 || v6.sha256 !== calculateRuleSetHash(v6)) {
  throw new Error('Build225 V6 rule set is invalid.');
}
ledger.projectRules.currentVersion = RULE_VERSION;
ledger.policyId = 'PPT-BUILD-LEDGER-CONTINUITY-V6';
const historicalAfter = sha(ledger.builds.filter((entry) => entry.build <= 224));
if (historicalAfter !== historicalBefore) throw new Error('Historical Build224-and-earlier ledger entries changed.');
await writeJson(LEDGER_PATH, ledger);
await writeLedgerDocument(ledger);

const constitutionConfig = await readJson('config/project-constitution.json');
await writeJson('config/project-constitution.json', {
  ...constitutionConfig,
  id: 'PPT-PROJECT-CONSTITUTION-V6',
  effectiveBuild: 225,
  conversationCapacityPolicy: {
    hardStopPercent: 90,
    measurementRequired: 'platform_actual',
    unavailableMeasurementLevel: 'UNMEASURED',
    assistantEstimateCanTriggerHardStop: false,
    mandatoryHandoffBelowHardStop: false,
    sameChatBuildStartAtHardStop: false,
    sameResponseFullHandoffRequiredAtHardStop: true,
    handoffFilePattern: 'handoff/NEW_CHAT_HANDOFF_BUILDxxx.md'
  }
});

const constitution = {
  schemaVersion: 1,
  id: 'PPT-PROJECT-CONSTITUTION-V6',
  effectiveBuild: 225,
  applicationVersion: '02.08.2026.225',
  ruleSetVersion: RULE_VERSION,
  ruleCount: v6.rules.length,
  ruleSha256: v6.sha256,
  sourceStartDate: '2026-07-20',
  authoritativeLedger: 'docs/17_MASTER_BUILD_LEDGER.md',
  predecessor: 'PPT-PROJECT-CONSTITUTION-V5',
  newRule: { id: 'PR-172', text: RULE_TEXT }
};
await writeJson('docs/18_PROJECT_CONSTITUTION_V6.json', constitution);
await writeFile('docs/18_PROJECT_CONSTITUTION_V6.md', `# Proje Anayasası V6 — Aktif Build 225\n\n**Aktif sürüm:** 02.08.2026.225  \n**Yürürlük başlangıcı:** Build 225  \n**Kural seti:** \`${RULE_VERSION}\`  \n**Kural sayısı:** 172  \n**Kural SHA-256:** \`${v6.sha256}\`  \n**Yetkili ana kaynak:** \`docs/17_MASTER_BUILD_LEDGER.md\`\n\nV5 hükümleri aynen yürürlüktedir. V6 yalnız PR-172 sohbet bağlamı HARD_STOP ölçüm semantiğini kesinleştirir.\n\n## PR-172 — Gerçek bağlam ölçümü ve zorunlu devir\n\n${RULE_TEXT}\n\n## Devralınan bağlayıcı sınırlar\n\n- Proje kaynağı yalnız 20.07.2026 ve sonrasıdır.\n- Build224 ve daha eski tarihsel kayıtlar değiştirilemez.\n- NOT_RUN sonucu PASS sayılamaz.\n- Gerçek Windows EFS ve safeStorage kanıtları gerçek Windows altında çalışmadan PASS sayılamaz.\n`);

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build225-pr172-governance-migration.json', `${JSON.stringify({
  schemaVersion: 1,
  build: 225,
  status: 'PASS',
  ruleVersion: RULE_VERSION,
  ruleCount: v6.rules.length,
  ruleSha256: v6.sha256,
  historicalBuildsThrough224Sha256Before: historicalBefore,
  historicalBuildsThrough224Sha256After: historicalAfter,
  generatedAt: new Date().toISOString()
}, null, 2)}\n`);
console.log(`Build225 governance V6 applied: rules=${v6.rules.length}; sha256=${v6.sha256}`);
