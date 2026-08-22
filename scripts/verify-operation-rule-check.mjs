import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const valueAfter = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const operation = valueAfter('--operation')?.trim() ?? '';
const kind = valueAfter('--kind')?.trim() ?? '';
const allowedKinds = new Set(['mutation', 'test', 'build', 'installation', 'deletion', 'publish', 'read-only']);
const failures = [];
let checks = 0;
const check = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const stable = (value) => Array.isArray(value)
  ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
    : JSON.stringify(value);

check(operation.length >= 3 && operation.length <= 160 && !/[\r\n]/u.test(operation), 'Geçerli --operation açıklaması zorunludur.');
check(allowedKinds.has(kind), `Geçerli --kind zorunludur: ${[...allowedKinds].join(', ')}.`);

const [registry, acknowledgement, constitution, enforcement] = await Promise.all([
  readJson('config/canonical-rule-registry.json'),
  readJson('config/rule-acknowledgement.json'),
  readJson('config/project-constitution.json'),
  readJson('config/rule-enforcement-registry.json')
]);
const canonical = { ...registry };
delete canonical.rulesSha256;
const calculatedHash = createHash('sha256').update(stable(canonical)).digest('hex');
const activeRules = registry.rules.filter((rule) => rule.state === 'ACTIVE');
const enforcementIds = new Set(enforcement.entries.map((entry) => entry.ruleId));

check(registry.rulesSha256 === calculatedHash, 'Kanonik kural hash doğrulaması başarısız.');
check(registry.ruleCount === registry.rules.length, 'Kanonik kural sayısı uyuşmuyor.');
check(registry.activeRuleCount === activeRules.length, 'Aktif kural sayısı uyuşmuyor.');
check(acknowledgement.release === registry.effectiveRelease, 'Kural onayı sürümü eski.');
check(acknowledgement.rulesSha256 === registry.rulesSha256, 'Kural onayı hash bağı eski.');
check(constitution.canonicalRulesSha256 === registry.rulesSha256, 'Proje anayasası kural hash bağı eski.');
check(enforcement.canonicalRulesSha256 === registry.rulesSha256, 'Enforcement kural hash bağı eski.');
check(enforcement.activeRuleCount === activeRules.length, 'Enforcement aktif kural sayısı uyuşmuyor.');
check(activeRules.every((rule) => enforcementIds.has(rule.id)), 'En az bir aktif kuralın enforcement kaydı eksik.');
check(enforcement.entries.every((entry) => entry.failClosed === true && entry.waiverAllowed === false && entry.skipAllowed === false), 'Enforcement waiver veya atlama içeriyor.');
check(enforcement.entries.every((entry) => entry.evidencePolicy === 'MISSING_EVIDENCE_NEVER_PASS'), 'Enforcement kanıt politikası fail-closed değil.');
check(enforcement.entries.every((entry) => entry.violationEffect === 'BLOCK_CURRENT_REQUIRED_STAGE'), 'Enforcement ihlal etkisi kanonik engelleme değeriyle uyuşmuyor.');

if (failures.length > 0) {
  console.error(`İşlem kural kontrolü başarısız (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const receipt = {
  schemaVersion: 1,
  ruleId: 'PR-231',
  release: registry.effectiveRelease,
  registryId: registry.id,
  rulesSha256: registry.rulesSha256,
  operation,
  kind,
  checks,
  status: 'PASS',
  checkedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/operation-rule-check.json', `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`İşlem kural kontrolü: PASS (${kind} / ${operation} / ${registry.id}).`);
