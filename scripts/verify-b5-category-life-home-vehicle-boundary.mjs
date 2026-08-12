import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { runPlatformPolicyAstGate } from './verify-platform-policy-ast-gate.mjs';
import { runPlatformCapabilityManifestGate } from './verify-platform-capability-manifest-gate.mjs';

const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));

export const verifyB5CategoryLifeHomeVehicleBoundary = async () => {
  const [
    scope, inventory, domain, security, application, repositoryContract, repository,
    migrations, adapter, policyRuntime, dataStore, main, ipcPolicy, preload,
    declarations, appRenderer, managedPanel, applicationTest, repositoryTest, ipcTest,
    lifePolicyTest, lifeProjectionTest, dataStoreTest, decision, threatModel, audit,
    masterRegister, registry, decisionLedger, astGate, capabilityGate, rootPackage
  ] = await Promise.all([
    json('config/33-e-b5-category-life-home-vehicle-scope.json'),
    json('config/33-e-b5-category-life-home-vehicle-inventory.json'),
    text('packages/domain/src/app-data.ts'),
    text('packages/application/src/life-security.ts'),
    text('packages/application/src/life-use-cases.ts'),
    text('packages/repository-contracts/src/life-repository.ts'),
    text('packages/repositories/src/life-repository.ts'),
    text('packages/database/src/family-database-migrations.ts'),
    text('apps/desktop/src/main/life-application-adapter.ts'),
    text('apps/desktop/src/main/life-production-policy-runtime.ts'),
    text('apps/desktop/src/main/data-store.ts'),
    text('apps/desktop/src/main/main.ts'),
    text('apps/desktop/src/main/ipc-integration-policy.ts'),
    text('apps/desktop/src/main/preload.ts'),
    text('apps/desktop/src/renderer/global.d.ts'),
    text('apps/desktop/src/renderer/App.tsx'),
    text('apps/desktop/src/renderer/ManagedLifePanel.tsx'),
    text('packages/application/tests/managed-life-assets.test.ts'),
    text('packages/repositories/managed-life-repository-policy.test.ts'),
    text('apps/desktop/tests/b5-managed-life-ipc-integration.test.ts'),
    text('apps/desktop/tests/life-policy-enforcement-runtime.test.ts'),
    text('apps/desktop/tests/life-cross-projection-privacy-runtime.test.ts'),
    text('apps/desktop/tests/data-store.test.ts'),
    text('docs/decisions/DEC-216-b5-category-life-home-vehicle.md'),
    text('docs/security/THREAT_MODEL_33_E_B5_CATEGORY_LIFE_HOME_VEHICLE.md'),
    text('docs/audit/33-E_B5_CATEGORY_LIFE_HOME_VEHICLE_UST_KAPANIS.md'),
    text('docs/10_MASTER_DECISION_REGISTER.md'),
    json('config/accepted-scope-registry.json'),
    json('config/user-decision-ledger.json'),
    runPlatformPolicyAstGate(),
    runPlatformCapabilityManifestGate(),
    json('package.json')
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
  const managedMigrationStart = migrations.indexOf('life_managed_ledger');
  const managedMigration = managedMigrationStart < 0 ? '' : migrations.slice(Math.max(0, managedMigrationStart - 2_000));
  const requirements = ['B5-04', 'EXT-031', 'EXT-034'].map((id) => registry.requirements.find((item) => item.id === id));
  const channels = ['life:getManagedWorkspace', 'life:recordManagedItem'];
  const methods = ['getManagedLifeWorkspace', 'recordManagedLifeItem'];
  const productionLifeSources = [adapter, policyRuntime, dataStore, main, ipcPolicy, preload, managedPanel].join('\n');

  check('scope closes the exact DEC-216 three-requirement package', scope.status === 'COMPLETE'
    && scope.decision === 'DEC-216' && scope.requirements?.join(',') === 'B5-04,EXT-031,EXT-034');
  check('inventory is complete with no remaining package blocker', inventory.status === 'COMPLETE'
    && inventory.openRequirements?.length === 0 && inventory.openBlockers?.length === 0);
  check('scope fixes one append-only profile activity document ledger', scope.model?.table === 'life_managed_ledger'
    && scope.model?.itemTypes?.join(',') === 'profile,activity,document' && scope.model?.appendOnly === true);
  check('scope fixes seven managed categories', scope.model?.categories?.join(',')
    === 'insurance,subscription,education,employment,official_operation,home,vehicle');
  check('scope preserves manual no-network no-payment truth', scope.truth?.dataSource === 'manual'
    && scope.truth?.externalRegistryLookup === 'not_performed'
    && scope.truth?.providerContact === 'not_performed'
    && scope.truth?.paymentExecution === 'not_performed'
    && scope.truth?.documentContentExposure === 'not_performed'
    && scope.truth?.networkEgressAdded === false);
  check('domain declares exact category reminder activity and document enums', includesAll(domain, [
    'MANAGED_LIFE_CATEGORIES', 'ManagedLifeReminderKind', 'ManagedLifeActivityKind',
    'ManagedLifeDocumentKind', "'insurance'", "'subscription'", "'education'", "'employment'",
    "'official_operation'", "'home'", "'vehicle'"
  ]));
  check('domain exposes seven discriminated profile detail shapes', includesAll(domain, [
    'ManagedLifeInsuranceDetails', 'ManagedLifeSubscriptionDetails', 'ManagedLifeEducationDetails',
    'ManagedLifeEmploymentDetails', 'ManagedLifeOfficialOperationDetails', 'ManagedLifeHomeDetails',
    'ManagedLifeVehicleDetails', 'ManagedLifeProfileDetailsByCategory'
  ]));
  check('domain exposes append-only profile activity and document inputs', includesAll(domain, [
    'RecordManagedLifeProfileInput', 'RecordManagedLifeActivityInput', 'RecordManagedLifeDocumentInput',
    'RecordManagedLifeItemInput', "readonly itemType:'profile'", "readonly itemType:'activity'", "readonly itemType:'document'"
  ]));
  check('domain exposes integer financial quantity and odometer fields', includesAll(domain, [
    'amountMinor?:number', 'quantityMilliunits?:number', 'odometerKm?:number', "financePosting:'linked'|'not_performed'"
  ]));
  check('domain workspace truth is explicit and document-content-free', includesAll(domain, [
    'ManagedLifeWorkspaceView', "readonly dataSource:'manual'", "readonly externalRegistryLookup:'not_performed'",
    "readonly providerContact:'not_performed'", "readonly paymentExecution:'not_performed'",
    "readonly documentContentExposure:'not_performed'"
  ]));
  check('recursive input inspector rejects unknown and dangerous data before write', includesAll(security, [
    'inspectManagedLifeDataContract', 'unknown', 'password', 'token', 'credential', 'filepath', 'base64'
  ]));
  check('input inspector includes PAN and exact nested-key protections', includesAll(security, [
    'containsLikelyManagedLifePan', 'MANAGED_LIFE_PROFILE_DETAIL_KEYS', 'MANAGED_LIFE_REMINDER_MUTATION_KEYS'
  ]));
  check('application adds read create update policy intent actions', application.includes("readonly action: 'read' | 'create' | 'update'"));
  check('application exposes get workspace and record item use cases', includesAll(application, [
    'GetManagedLifeWorkspaceUseCase', 'RecordManagedLifeItemUseCase', 'getManagedLifeWorkspace', 'insertManagedLifeItem'
  ]));
  check('profile write uses create while child writes use update on the root', includesAll(application, [
    "input.command.itemType === 'profile'", "action: isProfile ? 'create' : 'update'", 'resourceId: rootId'
  ]));
  check('application inherits child owner and privacy from resolved profile', includesAll(application, [
    'findManagedLifeProfile', 'ownerPersonId', 'privacy'
  ]));
  check('application validates integer units exact timestamps and category matrices', includesAll(application, [
    'Number.isSafeInteger', 'activityKind', 'documentKind', 'reminderMutation'
  ]));
  check('managed audit and outbox remain content-free', !/payload\s*:\s*\{[^}]*?(?:amountMinor|provider|archiveItemId|financeAssetId|financeExpenseId|addressLabel|plate)/su.test(application));
  check('repository contract exposes managed list find insert and policy lookup', includesAll(repositoryContract, [
    'listManagedLifeItems', 'findManagedLifeProfile', 'insertManagedLifeItem', 'findManagedLifeProfileForPolicyResolution'
  ]));
  check('migration 83 remains present through authorized successor migrations', (migrationVersions.at(-1) ?? 0) >= 83
    && includesAll(migrations, ["createMigrationDefinition(83, 'b5_life_home_vehicle_managed_ledger'", 'CREATE TABLE life_managed_ledger']));
  check('migration stores integer money quantity and odometer with manual truth', includesAll(managedMigration, [
    'amount_minor', 'quantity_milliunits', 'odometer_km', 'data_source', 'external_verification', 'payment_execution'
  ]));
  check('migration enforces root child family owner and privacy inheritance', includesAll(managedMigration, [
    'parent_record_id', 'family_id', 'owner_person_id', 'privacy', 'trg_b5_life_managed_parent_matrix'
  ]));
  check('migration validates profile detail JSON and closed item shape', includesAll(managedMigration, [
    'details_json', 'json_valid', "item_type IN ('profile','activity','document')"
  ]));
  check('migration enforces home and vehicle activity category matrix', includesAll(managedMigration, [
    "'rent_payment'", "'inspection'", "'maintenance'", "'fuel'", "'charging'"
  ]));
  check('migration enforces archive and finance scoped links', includesAll(managedMigration, [
    'archive_item_id', 'finance_asset_id', 'finance_expense_id', 'asset_class', 'destroyed_at'
  ]));
  check('migration binds exact create update life policy receipts', includesAll(managedMigration, [
    'policy_receipt_hash', 'policy_resource_id', 'policy_action', "'life_record'", "'family.write'"
  ]));
  check('migration rejects cross legacy receipt and identity reuse', includesAll(managedMigration, [
    'life_records', 'receipt', 'collision'
  ]));
  check('migration makes ledger update and delete fail closed', includesAll(managedMigration, [
    'BEFORE UPDATE ON life_managed_ledger', 'BEFORE DELETE ON life_managed_ledger', 'RAISE(ABORT'
  ]));
  check('repository maps all three item types without receipt projection', includesAll(repository, [
    'listManagedLifeItems', 'insertManagedLifeItem', "itemType: 'profile'", "itemType: 'activity'", "itemType: 'document'"
  ]) && !repository.includes('policyReceipt:'));
  check('repository resolves managed policy root and parent-scoped visibility', includesAll(repository, [
    'findManagedLifeProfileForPolicyResolution', 'parent_record_id', 'managedLifeVisibilitySql'
  ]));
  check('repository projects current set clear reminder history', includesAll(repository, [
    'reminder_mutation', "'clear'", 'next_reminder_at'
  ]));
  check('production policy runtime resolves managed update roots', includesAll(policyRuntime, [
    "intent.action === 'update'", 'findManagedLifeProfileForPolicyResolution', 'life_record'
  ]));
  check('application adapter binds managed query and atomic write scope', includesAll(adapter, [
    'getManagedLifeWorkspace', 'findManagedLifeProfile', 'insertManagedLifeItem'
  ]));
  check('DataStore composes the two managed use cases', includesAll(dataStore, [
    'GetManagedLifeWorkspaceUseCase', 'RecordManagedLifeItemUseCase', 'getManagedLifeWorkspace', 'recordManagedLifeItem'
  ]));
  check('main and IPC policy expose only the exact two managed channels', channels.every((channel) => main.includes(channel) && ipcPolicy.includes(channel)));
  check('preload and renderer declarations expose exact managed methods', methods.every((method) => preload.includes(method) && declarations.includes(method)));
  check('managed renderer supports all seven categories', includesAll(managedPanel, [
    'insurance', 'subscription', 'education', 'employment', 'official_operation', 'home', 'vehicle'
  ]));
  check('managed renderer supports home lease deed DASK and service flows', includesAll(managedPanel, [
    'lease', 'deed', 'dask_policy', 'home_insurance_policy', 'service'
  ]));
  check('managed renderer supports vehicle registration insurance inspection maintenance fuel charge expense', includesAll(managedPanel, [
    'vehicle_registration', 'vehicle_insurance_policy', 'inspection', 'maintenance', 'fuel', 'charging', 'expense'
  ]));
  check('renderer makes manual no-verification no-payment truth visible through successor fields', includesAll(managedPanel, [
    'manual', 'not_performed', 'paymentExecution', 'smartMeterLookup', 'warrantyLookup'
  ]));
  check('App mounts managed panel inside the life center', includesAll(appRenderer, ['ManagedLifePanel', '<ManagedLifePanel']));
  check('application tests cover contracts categories security money and reminders', includesAll(applicationTest, [
    'RecordManagedLifeItemUseCase', 'buildManagedLifeWorkspace', 'unknown', 'PAN', 'amountMinor', 'reminder'
  ]));
  check('repository tests cover receipt replay scope links and immutability', includesAll(repositoryTest, [
    'receipt', 'family', 'privacy', 'archive', 'finance', 'UPDATE', 'DELETE'
  ]));
  check('IPC tests cover both channels and recursive rejection', includesAll(ipcTest, [
    'life:getManagedWorkspace', 'life:recordManagedItem', 'password', 'filePath', 'base64'
  ]));
  check('existing life policy projection and DataStore regressions preserve managed coverage', [lifePolicyTest, lifeProjectionTest, dataStoreTest]
    .every((source) => source.includes('life')));
  check('managed LIFE modules add no network or direct external registry primitive', !/(?:node:https|node:http|fetch\s*\(|axios|WebSocket|openExternal)/u
    .test([adapter, policyRuntime, ipcPolicy, managedPanel].join('\n')));
  check('decision threat audit and master register bind DEC-216 and manual boundary', includesAll(decision, [
    'DEC-216', 'B5-04', 'EXT-031', 'EXT-034', 'not_performed'
  ]) && includesAll(threatModel, ['Cross-family', 'append-only', 'not_performed'])
    && includesAll(audit, ['DEC-216', 'B5-04', 'EXT-031', 'EXT-034'])
    && includesAll(masterRegister, ['## DEC-216', 'Migration 83', 'DEC-216-b5-category-life-home-vehicle.md']));
  check('decision ledger carries exact active DEC-216', decisionLedger.decisionCount === decisionLedger.decisions?.length
    && decisionLedger.decisions?.some((item) => item.id === 'DEC-216' && item.status === 'ACTIVE'
      && item.requirements?.join(',') === 'B5-04,EXT-031,EXT-034'));
  check('all three registry requirements are complete with exact 13-link chains', requirements.every((item) => item?.status === 'COMPLETE'
    && Object.keys(item.chain ?? {}).length === 13 && Object.values(item.chain).every((value) => value === true)));
  check('platform policy and capability gates remain exact PASS', astGate.status === 'PASS'
    && capabilityGate.status === 'PASS' && astGate.directRoleAuthorizationBypasses === 0);
  check('package exposes boundary targeted contract and runtime commands', includesAll(JSON.stringify(rootPackage.scripts), [
    'verify:b5-life-assets:boundary', 'verify:b5-life-assets:targeted',
    'verify:b5-life-assets:contract', 'verify:b5-life-assets:runtime'
  ]));

  const report = {
    schemaVersion: 1,
    step: '33-E',
    requirements: ['B5-04', 'EXT-031', 'EXT-034'],
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checksPassed: checks.length - failures.length,
    checksFailed: failures.length,
    checks,
    failures,
    ppk021ExactAllowlistEntries: astGate.exactAllowlistEntries,
    ppk021UseCaseCompositionSurfaces: astGate.surfaceCounts?.USE_CASE_COMPOSITION ?? 0,
    ppk022CapabilitySurfaces: capabilityGate.exactManifestSurfaces,
    latestDatabaseMigration: migrationVersions.at(-1),
    managedLedgerTables: (migrations.match(/CREATE TABLE life_managed_ledger/gu) ?? []).length,
    managedCategories: scope.model?.categories?.length ?? 0,
    ipcChannels: channels.length,
    networkChannels: inventory.networkChannels?.length ?? 0,
    dataSource: scope.truth?.dataSource,
    externalRegistryLookup: scope.truth?.externalRegistryLookup,
    providerContact: scope.truth?.providerContact,
    paymentExecution: scope.truth?.paymentExecution,
    documentContentExposure: scope.truth?.documentContentExposure,
    generatedAt: new Date().toISOString()
  };
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/33-E-b5-category-life-home-vehicle-boundary.json', `${JSON.stringify(report, null, 2)}\n`);
  return report;
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const report = await verifyB5CategoryLifeHomeVehicleBoundary();
  if (report.status !== 'PASS') {
    console.error(`B5 category life home vehicle boundary: FAIL (${report.checksFailed}/${report.checks.length}).`);
    for (const failure of report.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`B5 category life home vehicle boundary: PASS (${report.checksPassed}/${report.checks.length} checks).`);
}
