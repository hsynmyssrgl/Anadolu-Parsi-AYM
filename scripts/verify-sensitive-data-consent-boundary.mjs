import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { runPlatformPolicyAstGate } from './verify-platform-policy-ast-gate.mjs';
import { runPlatformCapabilityManifestGate } from './verify-platform-capability-manifest-gate.mjs';

const readText = async (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));

export const verifySensitiveDataConsentBoundary = async () => {
  const [
    domain, application, repositoryContract, repository, adapter, dataStore,
    main, ipcPolicy, preload, declarations, renderer, navigation, migrations, rootPackage,
    scope, inventory, decision, threatModel, auditDocument, astGate, capabilityGate
  ] = await Promise.all([
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
    readJson('config/32-y-b2-05-b6-03-sensitive-data-consent-scope.json'),
    readJson('config/32-y-b2-05-b6-03-sensitive-data-consent-inventory.json'),
    readText('docs/decisions/DEC-210-b2-05-b6-03-sensitive-data-consent-and-export-preview.md'),
    readText('docs/security/B2-05_B6-03_SENSITIVE_DATA_CONSENT_THREAT_MODEL.md'),
    readText('docs/audit/32-Y_B2-05_B6-03_SENSITIVE_DATA_CONSENT_UST_KAPANIS.md'),
    runPlatformPolicyAstGate(),
    runPlatformCapabilityManifestGate()
  ]);

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
  const channels = ['ai:listSensitiveProfiles', 'ai:upsertSensitiveConsent', 'ai:previewSensitiveExport'];
  const methods = ['listSensitiveDataProfiles', 'upsertSensitiveDataConsent', 'previewSensitiveExport'];

  check('domain fixes the exact four sensitive categories', domain.includes("SENSITIVE_DATA_CATEGORIES = ['child','health','finance','location']"));
  check('domain separates processing and export purposes', includesAll(domain, [
    "AI_CONSENT_PURPOSES = ['search','summary','recommendation','classification']",
    "SensitiveDataConsentPurpose = 'sensitive_processing'|'external_export'",
    'StoredAiConsentPurpose = AiConsentPurpose|SensitiveDataConsentPurpose',
    "SensitiveDataConsentEffectiveStatus = 'default_denied'|'granted'|'revoked'|'expired'|'scheduled'"
  ]));
  check('domain preview explicitly proves no outbound transfer', includesAll(domain, [
    'SensitiveExportPreviewView', 'outboundTransferPerformed:false', 'transferAllowed:boolean'
  ]));
  check('application defaults absent consent to deny', includesAll(application, [
    "effectiveStatus: 'default_denied'", 'visibleSharing: false', 'buildSensitiveDataProfiles'
  ]));
  check('application requires explicit bounded consent', includesAll(application, [
    'explicitConsent !== true', '< 15', '> 43_200', '!Number.isFinite(endsAt)',
    'AI_CONSENT_PURPOSES.includes(input.command.purpose)', '15 dakika ile 30 gün'
  ]));
  check('application distinguishes expiry revoke and scheduled state', includesAll(application, [
    "row.status === 'revoked'", "effectiveStatus = 'scheduled'", "effectiveStatus = 'expired'"
  ]));
  check('application validates export target purpose and category selection', includesAll(application, [
    'destinationLabel.length < 3', 'businessPurpose.length < 10', 'categories.length === 0'
  ]));
  check('application audits grant revoke and preview', includesAll(application, [
    'ai.sensitive_consent_', "action: 'ai.sensitive_export_previewed'"
  ]));
  check('application depends on central authorization port without direct role check', includesAll(application, [
    'SensitiveDataAuthorizationPort', 'this.authorization.authorize'
  ]) && !application.includes("actor.role === 'family_admin'"));
  check('production adapter uses central administer policy', includesAll(adapter, [
    'RepositoryBackedSensitiveDataAuthorizationPort', 'CentralAuthorizationService', "action: 'administer'",
    'SENSITIVE_DATA_PROFILE_RESOURCE_TYPE'
  ]));
  check('repository contract exposes metadata inventory only', includesAll(repositoryContract, [
    'SensitiveDataInventoryRow', 'recordCount', 'fieldNames', 'listSensitiveDataInventory'
  ]));
  check('repository counts all four domains without payload projection', includesAll(repository, [
    "category:'child'", "category:'health'", "category:'finance'", "category:'location'",
    'SELECT COUNT(*) FROM health_records', 'SELECT COUNT(*) FROM finance_records', 'SELECT COUNT(*) AS count FROM locations'
  ]) && !/SELECT\s+\*\s+FROM\s+(?:people|health_records|medication_plans|family_health_history|finance_records|finance_valuations|locations)/iu.test(repository));
  check('existing consent schema retains unique account purpose resource identity', includesAll(migrations, [
    'CREATE TABLE IF NOT EXISTS ai_consents', 'UNIQUE(account_id,purpose,resource_type,resource_id)'
  ]));
  check('no package-owned migration is introduced', migrationVersions.includes(77) && latestMigration >= 77 && scope.migrationDecision.includes('latest migration 77'));
  check('desktop composition binds all three use cases and authorization adapter', includesAll(dataStore, [
    'ListSensitiveDataProfilesUseCase', 'UpsertSensitiveDataConsentUseCase', 'PreviewSensitiveExportUseCase',
    'RepositoryBackedSensitiveDataAuthorizationPort'
  ]));
  check('main registers exactly the three sensitive consent channels', channels.every((channel) => main.includes(`'${channel}'`)));
  check('IPC policy validates exact sensitive consent and preview payloads', includesAll(ipcPolicy, [
    "case 'ai:upsertConsent':", "case 'ai:previewAccess':", 'standardAiConsentInput',
    "case 'ai:listSensitiveProfiles':", "case 'ai:upsertSensitiveConsent':", "case 'ai:previewSensitiveExport':",
    "['category', 'purpose', 'status', 'durationMinutes', 'explicitConsent']",
    "['categories', 'destinationLabel', 'businessPurpose']"
  ]));
  check('typed preload and declarations expose all three methods', [preload, declarations].every((source) => methods.every((method) => source.includes(method))));
  check('renderer exposes visible consent revoke and no-send preview', includesAll(renderer, [
    'Süreli ve açık rıza', 'Görünür paylaşım durumu', 'Derhal iptal et',
    'Veri göndermeden önizleme oluştur', 'outboundTransferPerformed'
  ]));
  check('existing AI route remains reachable from canonical navigation', navigation.includes("id: 'ai'"));
  check('no sensitive send upload or transfer IPC action exists', !/ai:(?:send|upload|transfer)Sensitive/iu.test(`${main}\n${preload}`));
  check('PPK-021 exact ratchet accepts the reviewed compositions and zero direct role bypass',
    astGate.status === 'PASS' && astGate.privilegedSurfaces === 829 && astGate.exactAllowlistEntries === 829
    && astGate.directRoleAuthorizationBypasses === 0 && astGate.findings.length === 0);
  check('PPK-022 successor capability ratchet stays exact and green',
    capabilityGate.status === 'PASS' && capabilityGate.capabilitySurfaces === 360
    && capabilityGate.exactManifestSurfaces === 360 && capabilityGate.findings.length === 0);
  check('scope and inventory bind both requirements and no outbound channel',
    scope.status === 'COMPLETE' && scope.requirements.join(',') === 'B2-05,B6-03'
    && inventory.status === 'COMPLETE' && inventory.outboundTransferChannels.length === 0);
  check('decision threat model and audit describe the no-transfer boundary',
    includesAll(decision, ['DEC-210', 'default_denied', 'outboundTransferPerformed=false', 'latest migration 77'])
    && includesAll(threatModel, ['default_denied', 'CentralAuthorizationService', 'outboundTransferPerformed=false'])
    && includesAll(auditDocument, ['B2-05', 'B6-03', 'PPK-021', 'latest migration 77']));
  check('root pretypecheck and prebuild execute this boundary', ['pretypecheck', 'prebuild'].every((name) =>
    rootPackage.scripts?.[name]?.includes('verify-sensitive-data-consent-boundary.mjs')));

  return Object.freeze({
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
};

const report = await verifySensitiveDataConsentBoundary();
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-Y-b2-05-b6-03-sensitive-data-consent-boundary.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`B2-05/B6-03 sensitive data consent boundary: ${report.status} (${report.checksPassed}/${report.checks.length} checks).`);
if (report.status !== 'PASS') {
  console.error(report.failures.join('\n'));
  process.exitCode = 1;
}
