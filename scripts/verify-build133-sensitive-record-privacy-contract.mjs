import { mkdir, readFile, writeFile } from 'node:fs/promises';
const files = {
  authorization: 'packages/security/src/authorization.ts', financeAdapter: 'apps/desktop/src/main/finance-application-adapter.ts',
  healthAdapter: 'apps/desktop/src/main/health-application-adapter.ts', financeUseCases: 'packages/application/src/finance-use-cases.ts',
  healthUseCases: 'packages/application/src/health-use-cases.ts', package: 'package.json', meta: 'packages/domain/src/app-meta.ts',
  decision: 'docs/10_MASTER_DECISION_REGISTER.md', adr: 'docs/adr/ADR-018-sensitive-finance-health-object-privacy.md',
  openItems: 'docs/06_OPEN_ITEMS_AFTER_CODING_START.md', traceability: 'docs/07_BRONZE_REQUIREMENTS_TRACEABILITY.md',
  security: 'docs/14_SECURITY_PRIVACY_BACKUP_STANDARD.md'
};
const source = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const activePackageVersion = JSON.parse(source.package).version;
const activeSequence = activePackageVersion.split('-').at(-1);
const activeDisplayVersion = source.meta.match(/version: '([^']+)'/)?.[1] ?? '';
const assertions = [
  ['authorization', "SensitiveRecordPrivacy = 'private' | 'selected_members' | 'family'", 'privacy type'],
  ['authorization', "SensitiveRecordDomain = 'finance' | 'health'", 'domain type'],
  ['authorization', 'readonly privacy?: SensitiveRecordPrivacy', 'privacy request'],
  ['authorization', 'readonly sensitiveDomain?: SensitiveRecordDomain', 'domain request'],
  ['authorization', "'privacy_boundary'", 'privacy denial reason'],
  ['authorization', "'ai_explicit_permission_required'", 'AI denial reason'],
  ['authorization', "if (deny) return { allowed: false, reason: 'explicit_deny'", 'deny precedence'],
  ['authorization', "sensitiveRecord && request.action === 'ai_process'", 'AI boundary'],
  ['authorization', "request.privacy !== 'family'", 'private/selected boundary'],
  ['authorization', "isOwner(request) && request.action !== 'administer'", 'owner access'],
  ['authorization', "finance_record: ['read']", 'adult finance family read'],
  ['authorization', "health_record: ['read']", 'health family read'],
  ['authorization', "advisor: { family: ['read'], finance_record: ['read']", 'advisor finance policy'],
  ['financeAdapter', "sensitiveDomain:'finance'", 'finance domain binding'],
  ['financeAdapter', 'privacy:i.privacy', 'finance privacy binding'],
  ['financeAdapter', 'privacy:x.privacy', 'finance list privacy'],
  ['financeAdapter', 'privacy:rec.privacy', 'valuation parent privacy'],
  ['healthAdapter', "sensitiveDomain: 'health'", 'health domain binding'],
  ['healthAdapter', 'privacy: input.privacy', 'health privacy binding'],
  ['healthAdapter', 'privacy: record.privacy', 'health record list privacy'],
  ['healthAdapter', 'privacy: plan.privacy', 'medication list privacy'],
  ['financeUseCases', 'privacy:RecordPrivacy', 'finance scope privacy'],
  ['financeUseCases', 'privacy:i.command.privacy', 'finance create privacy'],
  ['financeUseCases', 'privacy:rec.value.privacy', 'valuation privacy'],
  ['healthUseCases', 'readonly privacy: RecordPrivacy', 'health scope privacy'],
  ['healthUseCases', 'ownerPersonId, privacy', 'health create policy'],
  ['package', 'verify:build133:sensitive-record-privacy', 'contract command'],
  ['package', 'verify:sensitive-record-privacy:runtime', 'runtime command'],
  ['meta', `version: '${activeDisplayVersion}'`, 'application version'],
  ['meta', `packageVersion: '${activePackageVersion}'`, 'package version'],
  ['meta', `Build ${activeSequence}`, 'build marker'],
  ['decision', 'DEC-047', 'decision record'],
  ['adr', 'ADR-018', 'architecture decision'],
  ['openItems', 'finans ve sağlık nesne mahremiyeti', 'open item state'],
  ['traceability', 'Build 133 hassas kayıt mahremiyet sınırı', 'traceability'],
  ['security', 'Özel ve seçili üye kayıtları', 'security standard']
];
const failures = assertions.filter(([key, needle]) => !source[key].includes(needle)).map(([,,label]) => label);
const evidence = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', featureBuild: 133, applicationVersion: activeDisplayVersion, packageVersion: activePackageVersion, assertions: assertions.length, status: failures.length ? 'FAIL' : 'PASS', failures, generatedAt: new Date().toISOString() };
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build133-sensitive-record-privacy-contract.json', `${JSON.stringify(evidence, null, 2)}\n`);
if (failures.length) { failures.forEach((failure) => console.error(`- ${failure}`)); process.exit(1); }
console.log(`Build 133 sensitive-record privacy contract verified: ${assertions.length}/${assertions.length} PASS.`);
