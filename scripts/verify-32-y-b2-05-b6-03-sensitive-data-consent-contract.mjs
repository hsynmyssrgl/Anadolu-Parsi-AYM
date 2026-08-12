import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { runPlatformPolicyAstGate } from './verify-platform-policy-ast-gate.mjs';
import { runPlatformCapabilityManifestGate } from './verify-platform-capability-manifest-gate.mjs';

const readText = async (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const allChainTrue = (requirement) => requirement && Object.values(requirement.chain ?? {}).length === 13
  && Object.values(requirement.chain).every((value) => value === true);

const [
  registry, scope, inventory, boundary, domain, application, repositoryContract,
  repository, adapter, dataStore, main, ipcPolicy, preload, declarations, renderer, navigation,
  migrations, rootPackage, applicationTest, integrationTest, decision, threatModel,
  auditDocument, astGate, capabilityGate
] = await Promise.all([
  readJson('config/accepted-scope-registry.json'),
  readJson('config/32-y-b2-05-b6-03-sensitive-data-consent-scope.json'),
  readJson('config/32-y-b2-05-b6-03-sensitive-data-consent-inventory.json'),
  readJson('artifacts/validation/32-Y-b2-05-b6-03-sensitive-data-consent-boundary.json'),
  readText('packages/domain/src/app-data.ts'),
  readText('packages/application/src/ai-consent-use-cases.ts'),
  readText('packages/repository-contracts/src/ai-consent-repository.ts'),
  readText('packages/repositories/src/ai-consent-repository.ts'),
  readText('apps/desktop/src/main/ai-consent-application-adapter.ts'),
  readText('apps/desktop/src/main/data-store.ts'),
  readText('apps/desktop/src/main/main.ts'),
  readText('apps/desktop/src/main/ipc-integration-policy.ts'),
  readText('apps/desktop/src/main/preload.ts'),
  readText('apps/desktop/src/renderer/global.d.ts'),
  readText('apps/desktop/src/renderer/App.tsx'),
  readText('packages/domain/src/product-surface-governance.ts'),
  readText('packages/database/src/family-database-migrations.ts'),
  readJson('package.json'),
  readText('packages/application/tests/sensitive-data-consent-use-cases.test.ts'),
  readText('apps/desktop/tests/b2-b6-sensitive-data-consent-integration.test.ts'),
  readText('docs/decisions/DEC-210-b2-05-b6-03-sensitive-data-consent-and-export-preview.md'),
  readText('docs/security/B2-05_B6-03_SENSITIVE_DATA_CONSENT_THREAT_MODEL.md'),
  readText('docs/audit/32-Y_B2-05_B6-03_SENSITIVE_DATA_CONSENT_UST_KAPANIS.md'),
  runPlatformPolicyAstGate(),
  runPlatformCapabilityManifestGate()
]);

const requirements = registry.requirements ?? [];
const b205 = requirements.find((item) => item.id === 'B2-05');
const b603 = requirements.find((item) => item.id === 'B6-03');
const checks = [];
const failures = [];
const check = (name, condition) => {
  const passed = Boolean(condition);
  checks.push({ name, passed });
  if (!passed) failures.push(name);
};
const migrationVersions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)]
  .map((match) => Number.parseInt(match[1], 10));
const latestMigration = Math.max(...migrationVersions);
const expectedEvidence = [
  'artifacts/validation/32-Y-b2-05-b6-03-sensitive-data-consent-boundary.json',
  'artifacts/validation/32-Y-b2-05-b6-03-sensitive-data-consent-contract.json',
  'artifacts/validation/32-Y-b2-05-b6-03-sensitive-data-consent-runtime.json'
];

check('B2-05 is complete with the exact 13-link chain', b205?.status === 'COMPLETE' && allChainTrue(b205));
check('B6-03 is complete with the exact 13-link chain', b603?.status === 'COMPLETE' && allChainTrue(b603));
check('both requirements bind the 32-Y evidence triplet', [b205, b603].every((item) => expectedEvidence.every((path) => item?.evidence?.includes(path))));
check('scope binds DEC-210 and both exact requirements', scope.status === 'COMPLETE' && scope.decision === 'DEC-210' && scope.requirements.join(',') === 'B2-05,B6-03');
check('scope locks default deny explicit duration revoke visibility and separation', Object.entries({
  defaultDecision: 'DENY', explicitConsentRequired: true, boundedDurationRequired: true,
  revocationImmediate: true, visibleSharingIndicator: true, externalExportApprovalSeparate: true,
  previewBeforeTransfer: true, previewContainsSensitivePayload: false, previewPerformsOutboundTransfer: false,
  exactIpcPayloadValidation: true, genericAiConsentBypassRejected: true
}).every(([key, value]) => scope.policy?.[key] === value));
check('scope fixes duration bounds to 15 minutes and 30 days', scope.policy?.minimumDurationMinutes === 15 && scope.policy?.maximumDurationMinutes === 43_200);
check('inventory lists implementation surfaces and no outbound transfer channel', inventory.status === 'COMPLETE' && inventory.surfaces?.length === 8 && inventory.outboundTransferChannels?.length === 0);
check('source boundary evidence is green', boundary.status === 'PASS' && boundary.checksPassed === 26 && boundary.checksFailed === 0 && boundary.outboundTransferPerformed === false);
check('domain exposes exact four categories', domain.includes("SENSITIVE_DATA_CATEGORIES = ['child','health','finance','location']"));
check('domain separates standard AI from sensitive processing and external export purposes', includesAll(domain, [
  "AI_CONSENT_PURPOSES = ['search','summary','recommendation','classification']",
  "SensitiveDataConsentPurpose = 'sensitive_processing'|'external_export'",
  'StoredAiConsentPurpose = AiConsentPurpose|SensitiveDataConsentPurpose'
]));
check('domain fixes no-transfer preview truth', includesAll(domain, ['SensitiveExportPreviewView', 'outboundTransferPerformed:false']));
check('application implements default deny state projection', includesAll(application, ["effectiveStatus: 'default_denied'", 'buildSensitiveDataProfiles', 'visibleSharing: false']));
check('application enforces explicit bounded consent and rejects the generic-route bypass', includesAll(application, [
  'explicitConsent !== true', '< 15', '> 43_200', '!Number.isFinite(endsAt)',
  'AI_CONSENT_PURPOSES.includes(input.command.purpose)'
]));
check('application handles revoked scheduled expired and granted states', ['revoked','scheduled','expired','granted'].every((state) => application.includes(`'${state}'`)));
check('application keeps external export preview payload-free', includesAll(application, ['fieldNames:', 'recordCount:', 'outboundTransferPerformed: false']));
check('application audits consent and preview decisions', includesAll(application, ['ai.sensitive_consent_', 'ai.sensitive_export_previewed']));
check('application authorization is a required port with no direct role bypass', includesAll(application, ['SensitiveDataAuthorizationPort', 'authorization.authorize']) && !application.includes("actor.role === 'family_admin'"));
check('production adapter routes administer through central authorization', includesAll(adapter, ['RepositoryBackedSensitiveDataAuthorizationPort', 'CentralAuthorizationService', "action: 'administer'"]));
check('repository contract is metadata only', includesAll(repositoryContract, ['SensitiveDataInventoryRow', 'recordCount', 'fieldNames']) && !repositoryContract.includes('payload'));
check('repository counts all four categories without SELECT star payload reads', ['child','health','finance','location'].every((category) => repository.includes(`category:'${category}'`))
  && !/SELECT\s+\*\s+FROM\s+(?:people|health_records|medication_plans|family_health_history|finance_records|finance_valuations|locations)/iu.test(repository));
check('existing ai_consents schema is reused', includesAll(migrations, ['CREATE TABLE IF NOT EXISTS ai_consents', 'UNIQUE(account_id,purpose,resource_type,resource_id)']));
check('migration 77 package baseline remains present with no package-owned migration', migrationVersions.includes(77) && latestMigration >= 77 && scope.migrationDecision.includes('Yeni migration'));
check('DataStore composes three use cases with central authorization', includesAll(dataStore, ['ListSensitiveDataProfilesUseCase', 'UpsertSensitiveDataConsentUseCase', 'PreviewSensitiveExportUseCase', 'sensitiveDataAuthorization']));
check('main and preload bind exact channels', ['ai:listSensitiveProfiles','ai:upsertSensitiveConsent','ai:previewSensitiveExport'].every((channel) => main.includes(channel) && preload.includes(channel)));
check('IPC integration policy rejects unknown fields and implicit grants', includesAll(ipcPolicy, [
  'sensitiveConsentInput', 'sensitiveExportPreviewInput', 'hasOnlyKeys', 'explicitConsent === true',
  'standardAiConsentInput', "case 'ai:upsertConsent':", "case 'ai:previewAccess':",
  "case 'ai:upsertSensitiveConsent':", "case 'ai:previewSensitiveExport':"
]));
check('renderer declaration binds exact typed methods', ['listSensitiveDataProfiles','upsertSensitiveDataConsent','previewSensitiveExport'].every((method) => declarations.includes(method)));
check('AI menu route and screen remain canonical', navigation.includes("id: 'ai'") && renderer.includes("active === 'ai'") && renderer.includes('<AiGovernanceScreen'));
check('UI exposes category purpose duration explicit consent revoke and preview', includesAll(renderer, ['B2-05 hassasiyet profili', 'Kullanım amacı', 'Onay süresi', 'açık rıza veriyorum', 'Derhal iptal et', 'Veri göndermeden önizleme oluştur']));
check('UI has no outbound send action', !/ai:(?:send|upload|transfer)Sensitive/iu.test(`${main}\n${preload}\n${renderer}`));
check('targeted application tests cover deny grant preview and expiry', includesAll(applicationTest, ['defaults all four categories', 'requires explicit consent', 'without transferring data', 'expired approval']));
check('desktop integration test covers policy repository IPC UI and no egress', includesAll(integrationTest, ['domain, policy and SQLite repository metadata', 'exact IPC and preload methods', 'no outbound transfer action']));
check('DEC-210 records the exact privacy and migration decision', includesAll(decision, ['DEC-210', 'CentralAuthorizationService', 'outboundTransferPerformed=false', 'latest migration 77']));
check('threat model covers all four sensitive classes and audit', includesAll(threatModel, ['18 yaş altı', 'Sağlık kayıtları', 'Finans kayıtları', 'koordinat', 'audit']));
check('upper closure document keeps excluded claims open', includesAll(auditDocument, ['B2-02', 'PPK-025', 'B9-01', 'Silver readiness', 'Bronze Final']));
check('PPK-021 successor ratchet is exact green with no role bypass', astGate.status === 'PASS' && astGate.privilegedSurfaces === 542 && astGate.exactAllowlistEntries === 542 && astGate.directRoleAuthorizationBypasses === 0 && astGate.findings.length === 0);
check('PPK-022 ratchet remains exact green with no added capability', capabilityGate.status === 'PASS' && capabilityGate.capabilitySurfaces === 238 && capabilityGate.exactManifestSurfaces === 238 && capabilityGate.findings.length === 0);
check('root lifecycle and explicit package scripts bind 32-Y', ['pretypecheck','prebuild'].every((name) => rootPackage.scripts?.[name]?.includes('verify-sensitive-data-consent-boundary.mjs'))
  && ['verify:sensitive-data-consent:boundary','verify:b2-b6-sensitive-data-consent:targeted','verify:b2-b6-sensitive-data-consent:contract','verify:b2-b6-sensitive-data-consent:runtime'].every((name) => typeof rootPackage.scripts?.[name] === 'string'));
check('contract prerequisites exist', expectedEvidence.slice(0, 1).every((path) => existsSync(path)));

const report = Object.freeze({
  schemaVersion: 1,
  step: '32-Y',
  requirements: Object.freeze(['B2-05', 'B6-03']),
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: checks.filter((item) => item.passed).length,
  checksFailed: failures.length,
  checks: Object.freeze(checks),
  failures: Object.freeze(failures),
  latestDatabaseMigration: latestMigration,
  ppk021ExactAllowlistEntries: astGate.exactAllowlistEntries,
  ppk022CapabilitySurfaces: capabilityGate.capabilitySurfaces,
  outboundTransferPerformed: false,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-Y-b2-05-b6-03-sensitive-data-consent-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`B2-05/B6-03 sensitive data consent contract: ${report.status} (${report.checksPassed}/${checks.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
