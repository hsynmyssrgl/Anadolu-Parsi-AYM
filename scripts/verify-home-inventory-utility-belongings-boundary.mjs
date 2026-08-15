import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { runPlatformPolicyAstGate } from './verify-platform-policy-ast-gate.mjs';
import { runPlatformCapabilityManifestGate } from './verify-platform-capability-manifest-gate.mjs';

const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const ids = Object.freeze(['EXT-030', 'EXT-032']);

export const verifyHomeInventoryUtilityBelongingsBoundary = async () => {
  const [
    scope, inventory, domain, security, application, repositoryContract, repository,
    migrations, adapter, ipcPolicy, panel, applicationTest, repositoryTest, ipcTest,
    decision, threatModel, audit, masterRegister, registry, decisionLedger, rootPackage,
    astGate, capabilityGate
  ] = await Promise.all([
    json('config/33-f-home-inventory-utility-belongings-scope.json'),
    json('config/33-f-home-inventory-utility-belongings-inventory.json'),
    text('packages/domain/src/app-data.ts'),
    text('packages/application/src/life-security.ts'),
    text('packages/application/src/life-use-cases.ts'),
    text('packages/repository-contracts/src/life-repository.ts'),
    text('packages/repositories/src/life-repository.ts'),
    text('packages/database/src/family-database-migrations.ts'),
    text('apps/desktop/src/main/life-application-adapter.ts'),
    text('apps/desktop/src/main/ipc-integration-policy.ts'),
    text('apps/desktop/src/renderer/ManagedLifePanel.tsx'),
    text('packages/application/tests/managed-life-assets.test.ts'),
    text('packages/repositories/managed-life-repository-policy.test.ts'),
    text('apps/desktop/tests/b5-managed-life-ipc-integration.test.ts'),
    text('docs/decisions/DEC-217-home-inventory-utility-belongings.md'),
    text('docs/security/THREAT_MODEL_33_F_HOME_INVENTORY_UTILITY_BELONGINGS.md'),
    text('docs/audit/33-F_HOME_INVENTORY_UTILITY_BELONGINGS_UST_KAPANIS.md'),
    text('docs/10_MASTER_DECISION_REGISTER.md'),
    json('config/accepted-scope-registry.json'),
    json('config/user-decision-ledger.json'),
    json('package.json'),
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
  const requirements = ids.map((id) => registry.requirements?.find((item) => item.id === id));
  const migrationVersions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)]
    .map((match) => Number.parseInt(match[1], 10));
  const migrationStart = migrations.indexOf('const lifeHomeInventoryLedgerSql');
  const migration84 = migrationStart < 0 ? '' : migrations.slice(migrationStart);
  const production = [adapter, ipcPolicy, panel].join('\n');
  const itemTypes = ['room','meter','meter_reading','belonging','warranty','service','document'];

  check('scope closes the exact DEC-217 two-requirement package', scope.status === 'COMPLETE'
    && scope.decision === 'DEC-217' && scope.requirements?.join(',') === ids.join(','));
  check('inventory is complete with no package blocker', inventory.status === 'COMPLETE'
    && inventory.openRequirements?.length === 0 && inventory.openBlockers?.length === 0);
  check('scope fixes an additive append-only managed-home ledger', scope.model?.table === 'life_home_inventory_ledger'
    && scope.model?.rootTable === 'life_managed_ledger' && scope.model?.rootCategory === 'home'
    && scope.model?.appendOnly === true);
  check('scope fixes all seven exact item variants', scope.model?.itemTypes?.join(',') === itemTypes.join(','));
  check('scope preserves exact manual no-external truth', scope.truth?.dataSource === 'manual'
    && scope.truth?.smartMeterLookup === 'not_performed'
    && scope.truth?.providerContact === 'not_performed'
    && scope.truth?.warrantyLookup === 'not_performed'
    && scope.truth?.ocr === 'not_performed'
    && scope.truth?.paymentExecution === 'not_performed'
    && scope.truth?.documentContentExposure === 'not_performed'
    && scope.truth?.networkEgressAdded === false);
  check('domain declares exact item and category enums', includesAll(domain, [
    'MANAGED_HOME_INVENTORY_ITEM_TYPES', 'MANAGED_HOME_ROOM_KINDS', 'MANAGED_HOME_METER_KINDS',
    'MANAGED_HOME_METER_READING_KINDS', 'MANAGED_HOME_BELONGING_KINDS',
    'MANAGED_HOME_SERVICE_KINDS', 'MANAGED_HOME_DOCUMENT_KINDS'
  ]) && itemTypes.every((item) => domain.includes(`'${item}'`)));
  check('domain exposes exact discriminated views and commands', includesAll(domain, [
    'ManagedHomeInventoryLedgerItemView', 'RecordManagedHomeInventoryItemInput',
    "readonly itemType:'room'", "readonly itemType:'meter'", "readonly itemType:'meter_reading'",
    "readonly itemType:'belonging'", "readonly itemType:'warranty'", "readonly itemType:'service'"
  ]));
  check('domain carries safe integer readings money and masked serial output', includesAll(domain, [
    'readingMilliunits:number', 'purchaseAmountMinor?:number', 'amountMinor?:number',
    'serialNumberMasked?:string', "financePosting:'linked'|'not_performed'"
  ]));
  check('workspace exposes inventory and all exact truth flags', includesAll(domain, [
    'homeInventoryItems:readonly ManagedHomeInventoryLedgerItemView[]',
    "smartMeterLookup:'not_performed'", "warrantyLookup:'not_performed'", "ocr:'not_performed'",
    "documentContentExposure:'not_performed'"
  ]));
  check('recursive security contract covers all inventory variants', includesAll(security, [
    'MANAGED_HOME_INVENTORY_INPUT_KEYS', 'MANAGED_HOME_INVENTORY_REQUIRED_INPUT_KEYS',
    "'managed_life'", "'home_inventory'", 'inspectManagedLifeDataContract'
  ]) && itemTypes.every((item) => security.includes(`${item}: Object.freeze(`)));
  check('security contract rejects secrets PAN paths and base64', includesAll(security, [
    'password', 'token', 'credential', 'containsLikelyManagedLifePan', 'isPathLike', 'isBase64Like'
  ]));
  check('application validates exact meter kind-unit and reading event matrices', includesAll(application, [
    'managedHomeMeterUnitMatrix', "natural_gas: 'milliliter_cubic_meter_equivalent'",
    "'reading','reset','replacement'", 'Normal sayaç okuması monoton ilerlemelidir'
  ]));
  check('historical application binds inventory writes to an existing home root', includesAll(application, [
    'isManagedHomeInventoryCommand', "parent!.category !== 'home'", 'findManagedLifeProfile',
    'const createOperation = isProfile', "action: createOperation ? 'create' : 'update'"
  ]));
  check('application validates parent and supersession scope', includesAll(application, [
    'validateManagedHomeInventoryRelations', 'findManagedHomeInventoryItem',
    'supersedesItemId', 'aynı home kökünde'
  ]));
  check('application uses exact integer and canonical date validation', includesAll(application, [
    'Number.isSafeInteger', 'isExactManagedLifeIsoDateTime', 'readingMilliunits', 'amountMinor'
  ]));
  check('application strips raw serial and persistence fields from projections', includesAll(application, [
    'projectManagedHomeInventoryItem', 'maskManagedHomeSerial', 'serialNumberMasked',
    'homeInventoryItems: Object.freeze'
  ]));
  check('application audit and event payloads remain content-free', !/payload\s*:\s*\{[^}]*?(?:serialNumber|readingMilliunits|amountMinor|archiveItemId|financeExpenseId|provider|note)/su.test(application));
  check('repository contract exposes list find latest and insert operations', includesAll(repositoryContract, [
    'listManagedHomeInventoryItems', 'findManagedHomeInventoryItem',
    'findLatestManagedHomeMeterReading', 'insertManagedHomeInventoryItem'
  ]));
  check('migration 84 remains present through authorized successor migrations', (migrationVersions.at(-1) ?? 0) >= 84
    && includesAll(migrations, ["createMigrationDefinition(84, 'b5_life_home_inventory_ledger'", 'CREATE TABLE life_home_inventory_ledger']));
  check('migration stores all exact item variants', itemTypes.every((item) => migration84.includes(`'${item}'`)));
  check('migration enforces exact home root family owner privacy scope', includesAll(migration84, [
    'trg_b5_home_inventory_root_scope', "profile.category='home'", 'profile.family_id=NEW.family_id',
    'profile.owner_person_id=NEW.owner_person_id', 'profile.privacy=NEW.privacy'
  ]));
  check('migration enforces exact parent category matrix', includesAll(migration84, [
    'trg_b5_home_inventory_parent_matrix', "parent.item_type='room'", "parent.item_type='meter'",
    "parent.item_type='belonging'", "parent.item_type IN ('room','meter','belonging')"
  ]));
  check('migration enforces supersession identity scope and chronology', includesAll(migration84, [
    'trg_b5_home_inventory_supersession_scope', 'prior.item_type=NEW.item_type',
    'prior.home_profile_id=NEW.home_profile_id', 'datetime(NEW.created_at)>datetime(prior.created_at)'
  ]));
  check('migration enforces monotonic readings with explicit reset or replacement', includesAll(migration84, [
    'trg_b5_home_inventory_meter_monotonic', "NEW.reading_kind='reading'", "'reset','replacement'"
  ]));
  check('migration enforces canonical dates and safe integer bounds', includesAll(migration84, [
    "typeof(reading_milliunits)='integer'", "typeof(amount_minor)='integer'",
    "strftime('%Y-%m-%dT%H:%M:%fZ',occurred_at) IS NOT NULL",
    "strftime('%Y-%m-%dT%H:%M:%fZ',created_at)=created_at"
  ]));
  check('migration enforces archive and finance exact scope', includesAll(migration84, [
    'trg_b5_home_inventory_external_link_scope', 'archive.family_id=NEW.family_id',
    'archive.destroyed_at IS NULL', 'expense.family_id=NEW.family_id',
    'expense.owner_person_id=NEW.owner_person_id', 'expense.privacy=NEW.privacy'
  ]));
  check('migration binds exact durable LIFE update receipt', includesAll(migration84, [
    'trg_b5_home_inventory_policy_receipt', "receipt.resource_type='life_record'",
    "receipt.action='update'", "receipt.capability='family.write'", "request.purpose')='general'"
  ]));
  check('migration rejects cross-ledger id and receipt reuse', includesAll(migration84, [
    'trg_b5_home_inventory_id_collision', 'life_records', 'life_managed_ledger',
    'already bound to a home inventory item'
  ]));
  check('migration makes update and delete fail closed', includesAll(migration84, [
    'BEFORE UPDATE ON life_home_inventory_ledger', 'BEFORE DELETE ON life_home_inventory_ledger',
    'home inventory ledger is append-only'
  ]));
  check('repository maps every variant with masked serial and no receipt projection', includesAll(repository, [
    'mapManagedHomeInventoryItem', 'maskSerialNumber', 'serialNumberMasked',
    'listManagedHomeInventoryItems', 'insertManagedHomeInventoryItem'
  ]) && !repository.includes('policyReceipt:'));
  check('repository list is family and root-visibility scoped', includesAll(repository, [
    'WHERE profile.family_id=?', 'managedLifeVisibilitySql', 'lifeVisibilityParameters'
  ]));
  check('repository persists exact update policy binding', includesAll(repository, [
    "resourceId: row.recordId", "action: 'update'", 'policy.receiptHash'
  ]));
  check('adapter projects and authorizes inventory by root', includesAll(adapter, [
    'listManagedHomeInventoryItems', 'visibleHomeInventoryItems', 'resourceId: item.recordId',
    'insertManagedHomeInventoryItem'
  ]));
  check('IPC preserves the exact existing two channels', includesAll(ipcPolicy, [
    'life:getManagedWorkspace', 'life:recordManagedItem', 'managedHomeInventoryItemTypes'
  ]));
  check('IPC enforces meter units reset evidence and finance exclusivity', includesAll(ipcPolicy, [
    'managedHomeReadingUnits', 'managedHomeReadingKinds', 'readingMilliunits',
    'financeExpenseId', 'amountCurrencyPairValid'
  ]));
  check('renderer covers seven variants and masked serial display', itemTypes.every((item) => panel.includes(`${item}:`))
    && includesAll(panel, ['serialNumberMasked', 'managed-home-inventory-tabs', 'Opak arşiv']));
  check('renderer visibly declares manual no-lookup no-OCR no-payment truth', includesAll(panel, [
    'smartMeterLookup', 'warrantyLookup', 'ocr', 'paymentExecution', 'documentContentExposure'
  ]));
  check('renderer supports room meter reading belonging warranty service and document forms', includesAll(panel, [
    "inventoryType === 'room'", "inventoryType === 'meter'", "inventoryType === 'meter_reading'",
    "inventoryType === 'belonging'", "inventoryType === 'warranty'", "inventoryType === 'service'",
    "inventoryType === 'document'"
  ]));
  check('application tests cover seven variants security monotonicity and masked output', includesAll(applicationTest, [
    '33-F managed home inventory', 'all seven exact home inventory variants', 'monotonic',
    'masks raw serials', 'PAN', 'base64'
  ]));
  check('repository tests cover migration receipt scope masking immutability and links', includesAll(repositoryTest, [
    '33-F managed home inventory', 'migration84', 'receipt', 'family', 'privacy',
    'serialNumberMasked', 'UPDATE life_home_inventory_ledger', 'DELETE FROM life_home_inventory_ledger'
  ]));
  check('IPC tests cover all seven variants and recursive rejection', includesAll(ipcTest, [
    '33-F EXT-030/EXT-032', 'all seven inventory variants', 'natural_gas', 'replacement',
    'token', '4111 1111 1111 1111', 'rawDocumentContent'
  ]));
  check('managed modules add no network or direct external primitive', !/(?:node:https|node:http|fetch\s*\(|axios|WebSocket|openExternal)/u.test(production));
  check('decision and threat model bind exact manual append-only boundary', includesAll(decision, [
    'DEC-217', 'EXT-030', 'EXT-032', 'Migration 84', 'append-only', 'not_performed'
  ]) && includesAll(threatModel, ['Cross-family', 'Makbuz replay', 'monoton', 'not_performed']));
  check('audit binds exact package evidence and truth', includesAll(audit, [
    'DEC-217', 'EXT-030', 'EXT-032', 'Migration 84', 'manual', 'not_performed'
  ]));
  check('master register contains active DEC-217 summary', includesAll(masterRegister, [
    '## DEC-217', 'EXT-030 ve EXT-032', 'DEC-217-home-inventory-utility-belongings.md'
  ]));
  check('decision ledger carries exact active DEC-217', decisionLedger.decisionCount === decisionLedger.decisions?.length
    && decisionLedger.decisions?.some((item) => item.id === 'DEC-217' && item.status === 'ACTIVE'
      && item.requirements?.join(',') === ids.join(',')));
  check('both registry requirements have exact complete 13-link chains', requirements.every((item) => item?.status === 'COMPLETE'
    && Object.keys(item.chain ?? {}).length === 13 && Object.values(item.chain).every((value) => value === true)));
  check('platform policy and capability gates remain exact PASS', astGate.status === 'PASS'
    && capabilityGate.status === 'PASS' && astGate.directRoleAuthorizationBypasses === 0);
  check('PPK-022 current successor ratchet remains exact', capabilityGate.exactManifestSurfaces === 375);
  check('root package exposes boundary targeted contract and runtime commands', includesAll(JSON.stringify(rootPackage.scripts), [
    'verify:b5-home-inventory:boundary', 'verify:b5-home-inventory:targeted',
    'verify:b5-home-inventory:contract', 'verify:b5-home-inventory:runtime'
  ]));
  check('pretypecheck and prebuild both enforce the current boundary', ['pretypecheck','prebuild'].every((name) =>
    rootPackage.scripts?.[name]?.includes('verify-home-inventory-utility-belongings-boundary.mjs')));

  const report = {
    schemaVersion: 1,
    step: '33-F',
    requirements: ids,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checksPassed: checks.length - failures.length,
    checksFailed: failures.length,
    checks,
    failures,
    latestDatabaseMigration: migrationVersions.at(-1),
    homeInventoryTables: (migrations.match(/CREATE TABLE life_home_inventory_ledger/gu) ?? []).length,
    inventoryItemTypes: itemTypes.length,
    ipcChannels: inventory.ipcChannels?.length ?? 0,
    networkChannels: inventory.networkChannels?.length ?? 0,
    ppk021ExactAllowlistEntries: astGate.exactAllowlistEntries,
    ppk021UseCaseCompositionSurfaces: astGate.surfaceCounts?.USE_CASE_COMPOSITION ?? 0,
    ppk022CapabilitySurfaces: capabilityGate.exactManifestSurfaces,
    dataSource: scope.truth?.dataSource,
    smartMeterLookup: scope.truth?.smartMeterLookup,
    warrantyLookup: scope.truth?.warrantyLookup,
    ocr: scope.truth?.ocr,
    paymentExecution: scope.truth?.paymentExecution,
    documentContentExposure: scope.truth?.documentContentExposure,
    generatedAt: new Date().toISOString()
  };
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/33-F-home-inventory-utility-belongings-boundary.json', `${JSON.stringify(report, null, 2)}\n`);
  return report;
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const report = await verifyHomeInventoryUtilityBelongingsBoundary();
  if (report.status !== 'PASS') {
    console.error(`Home inventory utility belongings boundary: FAIL (${report.checksFailed}/${report.checks.length}).`);
    for (const failure of report.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`Home inventory utility belongings boundary: PASS (${report.checksPassed}/${report.checks.length} checks).`);
}
