import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { runPlatformPolicyAstGate } from './verify-platform-policy-ast-gate.mjs';
import { runPlatformCapabilityManifestGate } from './verify-platform-capability-manifest-gate.mjs';

const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const ids = Object.freeze(['EXT-011', 'EXT-015']);
const itemTypes = Object.freeze([
  'preparedness_kit', 'preparedness_kit_item', 'preparedness_kit_check', 'emergency_drill'
]);

export const verifyFamilyEmergencyPreparednessBoundary = async () => {
  const [
    scope, inventory, domain, security, application, repositoryContract, repository,
    migrations, adapter, runtime, ipcPolicy, panel, applicationTest, repositoryTest,
    ipcTest, decision, threatModel, audit, masterRegister, registry, decisionLedger,
    rootPackage, astGate, capabilityGate
  ] = await Promise.all([
    json('config/33-h-family-emergency-preparedness-scope.json'),
    json('config/33-h-family-emergency-preparedness-inventory.json'),
    text('packages/domain/src/app-data.ts'),
    text('packages/application/src/life-security.ts'),
    text('packages/application/src/life-use-cases.ts'),
    text('packages/repository-contracts/src/life-repository.ts'),
    text('packages/repositories/src/life-repository.ts'),
    text('packages/database/src/family-database-migrations.ts'),
    text('apps/desktop/src/main/life-application-adapter.ts'),
    text('apps/desktop/src/main/life-production-policy-runtime.ts'),
    text('apps/desktop/src/main/ipc-integration-policy.ts'),
    text('apps/desktop/src/renderer/ManagedLifePanel.tsx'),
    text('packages/application/tests/family-emergency-preparedness.test.ts'),
    text('packages/repositories/family-emergency-preparedness-repository-policy.test.ts'),
    text('apps/desktop/tests/b5-family-emergency-preparedness-ipc-integration.test.ts'),
    text('docs/decisions/DEC-219-family-emergency-preparedness-kits-and-drills.md'),
    text('docs/security/THREAT_MODEL_33_H_FAMILY_EMERGENCY_PREPAREDNESS.md'),
    text('docs/audit/33-H_FAMILY_EMERGENCY_PREPAREDNESS_UST_KAPANIS.md'),
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
  const migrationStart = migrations.indexOf('const familyEmergencyPreparednessLedgerSql');
  const migrationEnd = migrations.indexOf('export const FAMILY_DATABASE_MIGRATIONS', migrationStart);
  const migration86 = migrationStart < 0 ? '' : migrations.slice(
    migrationStart,
    migrationEnd < 0 ? undefined : migrationEnd
  );
  const production = [adapter, runtime, ipcPolicy, panel].join('\n');

  check('scope closes the exact DEC-219 two-requirement package', scope.status === 'COMPLETE'
    && scope.decision === 'DEC-219' && scope.requirements?.join(',') === ids.join(','));
  check('inventory is complete without an open package blocker', inventory.status === 'COMPLETE'
    && inventory.openRequirements?.length === 0 && inventory.openBlockers?.length === 0);
  check('scope fixes one append-only preparedness ledger under emergency plans',
    scope.model?.table === 'family_emergency_preparedness_ledger'
    && scope.model?.rootTable === 'family_emergency_ledger'
    && scope.model?.rootItemType === 'emergency_plan' && scope.model?.appendOnly === true);
  check('scope fixes all four exact preparedness variants',
    scope.model?.itemTypes?.join(',') === itemTypes.join(','));
  check('scope fixes exact kit check and drill enum sets',
    scope.kit?.kinds?.join(',') === 'household_72_hour,vehicle,workplace,other'
    && scope.kit?.checkStatuses?.join(',') === 'ready,low,missing,expired,replace'
    && scope.drill?.kinds?.join(',') === 'earthquake,fire,flood,power_outage'
    && scope.drill?.statuses?.join(',') === 'completed,partial,cancelled');
  check('scope preserves exact manual offline no-external truth', scope.truth?.dataSource === 'manual'
    && scope.truth?.offlineAvailability === 'local_only'
    && scope.truth?.barcodeLookup === 'not_performed'
    && scope.truth?.expiryVerification === 'not_performed'
    && scope.truth?.notificationDelivery === 'not_performed'
    && scope.truth?.sensorIntegration === 'not_performed'
    && scope.truth?.readinessGuarantee === 'not_claimed'
    && scope.truth?.networkEgressAdded === false);
  check('domain declares exact preparedness enum constants', includesAll(domain, [
    'FAMILY_EMERGENCY_PREPAREDNESS_ITEM_TYPES', 'FAMILY_EMERGENCY_PREPAREDNESS_KIT_KINDS',
    'FAMILY_EMERGENCY_PREPAREDNESS_KIT_ITEM_CATEGORIES',
    'FAMILY_EMERGENCY_PREPAREDNESS_QUANTITY_UNITS',
    'FAMILY_EMERGENCY_PREPAREDNESS_CHECK_STATUSES', 'FAMILY_EMERGENCY_DRILL_KINDS',
    'FAMILY_EMERGENCY_DRILL_STATUSES'
  ]));
  check('domain stores all four discriminated preparedness variants', itemTypes.every((item) =>
    domain.includes(`itemType:'${item}'`)));
  check('domain exposes exact preparedness views and commands', includesAll(domain, [
    'FamilyEmergencyPreparednessLedgerItemView', 'RecordFamilyEmergencyPreparednessItemInput',
    'FamilyEmergencyPreparednessKitView', 'FamilyEmergencyPreparednessKitItemView'
  ]));
  check('domain uses integer quantities duration and exact calendar fields', includesAll(domain, [
    'targetQuantityMilliunits:number', 'actualQuantityMilliunits:number',
    'durationSeconds?:number', 'expiresOn?:string', 'checkedAt:string', 'occurredAt:string'
  ]));
  check('workspace exposes kits drills and exact preparedness truth flags', includesAll(domain, [
    'preparednessKits:readonly FamilyEmergencyPreparednessKitView[]',
    'emergencyDrills:readonly FamilyEmergencyDrillLedgerItemView[]',
    "barcodeLookup:'not_performed'", "expiryVerification:'not_performed'",
    "notificationDelivery:'not_performed'", "sensorIntegration:'not_performed'",
    "readinessGuarantee:'not_claimed'", 'networkEgressAdded:false'
  ]));
  check('recursive security contract covers every preparedness variant', includesAll(security, [
    'FAMILY_EMERGENCY_PREPAREDNESS_INPUT_KEYS',
    'FAMILY_EMERGENCY_PREPAREDNESS_REQUIRED_INPUT_KEYS',
    "'family_emergency_preparedness'"
  ]) && itemTypes.every((item) => security.includes(`${item}: Object.freeze(`)));
  check('security contract rejects secrets PAN paths and base64', includesAll(security, [
    'password', 'token', 'credential', 'containsLikelyManagedLifePan', 'isPathLike', 'isBase64Like'
  ]));
  check('application dispatches exact preparedness commands', includesAll(application, [
    'isFamilyEmergencyPreparednessCommand',
    "inspection.contractFamily === 'family_emergency_preparedness'",
    'RecordFamilyEmergencyPreparednessItemInput'
  ]));
  check('application validates bounded integer quantities and duration', includesAll(application, [
    'targetQuantityMilliunits', 'actualQuantityMilliunits', 'durationSeconds', 'Number.isSafeInteger'
  ]));
  check('application validates exact calendar date and canonical timestamps', includesAll(application, [
    'expiresOn', 'checkedAt', 'occurredAt', 'isExactManagedLifeIsoDateTime'
  ]));
  check('application derives preparedness ownership and privacy from the emergency plan', includesAll(application, [
    'findFamilyEmergencyPlan', 'planId', "privacy: plan.privacy", "action: 'update'"
  ]));
  check('application validates kit item check and supersession relations', includesAll(application, [
    'findFamilyEmergencyPreparednessItem', 'kitId', 'kitItemId', 'supersedesItemId'
  ]));
  check('application groups kits items latest checks and drills', includesAll(application, [
    'preparednessItems', 'preparednessKits', 'latestCheck', 'emergencyDrills'
  ]));
  check('application audit and outbox remain content-free',
    !/payload\s*:\s*\{[^}]*?(?:label|note|targetQuantityMilliunits|actualQuantityMilliunits|expiresOn|durationSeconds)/su.test(application));
  check('repository contract exposes preparedness list find and insert operations', includesAll(repositoryContract, [
    'listFamilyEmergencyPreparednessItems', 'findFamilyEmergencyPreparednessItem',
    'insertFamilyEmergencyPreparednessItem'
  ]));
  check('repository contract keeps preparedness rows family owner and typed domain scope bound',
    includesAll(repositoryContract, [
      'FamilyEmergencyPreparednessRowCommon', 'familyId:FamilyId', 'ownerPersonId:PersonId',
      'FamilyEmergencyPreparednessLedgerItemRow', 'FamilyEmergencyPreparednessKitLedgerItemView'
    ]));
  check('migration 86 remains present through authorized successor migrations',
    (migrationVersions.at(-1) ?? 0) >= 86
    && migrationVersions.includes(86)
    && includesAll(migrations, [
      "createMigrationDefinition(86, 'b5_family_emergency_preparedness_ledger'",
      'CREATE TABLE family_emergency_preparedness_ledger'
    ]));
  check('migration stores all exact preparedness variants', itemTypes.every((item) =>
    migration86.includes(`'${item}'`)));
  check('migration binds every row to an emergency plan root', includesAll(migration86, [
    'family_emergency_ledger plan', "plan.item_type='emergency_plan'", 'NEW.plan_id',
    'plan.family_id=NEW.family_id', 'plan.owner_person_id=NEW.owner_person_id',
    'plan.privacy=NEW.privacy'
  ]));
  check('migration enforces exact kit item and check parent matrices', includesAll(migration86, [
    'trg_b5_emergency_preparedness_parent_matrix', 'NEW.parent_item_id',
    "WHEN NEW.item_type='preparedness_kit_item' THEN 'preparedness_kit'",
    "ELSE 'preparedness_kit_item'"
  ]));
  check('migration enforces supersession root type and chronology', includesAll(migration86, [
    'trg_b5_emergency_preparedness_supersession_scope', 'prior.id=NEW.supersedes_item_id',
    'prior.item_type=NEW.item_type', 'prior.plan_id=NEW.plan_id',
    'NEW.created_at>prior.created_at',
    "NEW.item_type<>'preparedness_kit_item' OR prior.parent_item_id=NEW.parent_item_id"
  ]));
  check('migration enforces exact quantity and duration integer bounds', includesAll(migration86, [
    "typeof(target_quantity_milliunits)='integer'", "typeof(actual_quantity_milliunits)='integer'",
    "typeof(duration_seconds)='integer'", '604800'
  ]));
  check('migration enforces policy receipt update binding to plan root', includesAll(migration86, [
    'trg_b5_emergency_preparedness_policy_receipt', "receipt.resource_type='life_record'", "receipt.action='update'",
    "receipt.capability='family.write'", 'NEW.plan_id'
  ]));
  check('migration rejects cross-ledger id and receipt reuse', includesAll(migration86, [
    'family_emergency_ledger', 'life_records', 'life_managed_ledger',
    'life_home_inventory_ledger', 'policy_receipt_hash'
  ]));
  check('migration makes update and delete fail closed', includesAll(migration86, [
    'BEFORE UPDATE ON family_emergency_preparedness_ledger',
    'BEFORE DELETE ON family_emergency_preparedness_ledger', 'append-only'
  ]));
  check('repository maps preparedness rows without receipt projection', includesAll(repository, [
    'mapFamilyEmergencyPreparednessItem', 'listFamilyEmergencyPreparednessItems',
    'insertFamilyEmergencyPreparednessItem'
  ]) && !/mapFamilyEmergencyPreparednessItem[\s\S]{0,2500}policyReceipt:/u.test(repository));
  check('repository list is exact-family and authorized-plan scoped', includesAll(repository, [
    'family_emergency_preparedness_ledger', 'family_id=?', 'managedLifeVisibilitySql'
  ]));
  check('adapter loads visible preparedness items and exposes write scope methods', includesAll(adapter, [
    'listFamilyEmergencyPreparednessItems', 'findFamilyEmergencyPreparednessItem',
    'insertFamilyEmergencyPreparednessItem'
  ]));
  check('production policy runtime continues resolving emergency plan update roots', includesAll(runtime, [
    'findFamilyEmergencyPlanForPolicyResolution', 'emergencyPlan', 'Life policy resource snapshot'
  ]));
  check('IPC preserves the exact existing two channels', includesAll(ipcPolicy, [
    'life:getManagedWorkspace', 'life:recordManagedItem', 'familyEmergencyPreparednessItemTypes'
  ]));
  check('IPC validates preparedness enums quantities duration and exact dates', includesAll(ipcPolicy, [
    'familyEmergencyPreparednessKitKinds', 'familyEmergencyPreparednessKitItemCategories',
    'familyEmergencyPreparednessQuantityUnits', 'familyEmergencyPreparednessCheckStatuses',
    'familyEmergencyDrillKinds', 'familyEmergencyDrillStatuses',
    'targetQuantityMilliunits', 'actualQuantityMilliunits', 'durationSeconds', 'expiresOn'
  ]));
  check('renderer exposes kits items checks and drills inside emergency center', includesAll(panel, [
    'preparednessKits', 'emergencyDrills', 'preparedness_kit', 'preparedness_kit_item',
    'preparedness_kit_check', 'emergency_drill'
  ]));
  check('renderer visibly states manual offline no-service and no-guarantee truth', includesAll(panel, [
    'barcodeLookup', 'expiryVerification', 'notificationDelivery', 'sensorIntegration',
    'readinessGuarantee', 'offlineAvailability'
  ]));
  check('application tests cover all variants relations latest check and security', includesAll(applicationTest, [
    '33-H', 'preparedness_kit', 'preparedness_kit_item', 'preparedness_kit_check',
    'emergency_drill', 'latestCheck', 'apiToken', 'base64LikeValueDetected'
  ]));
  check('repository tests cover receipt scope replay immutability and visibility', includesAll(repositoryTest, [
    'family_emergency_preparedness_ledger', 'receipt', 'family', 'UPDATE', 'DELETE'
  ]));
  check('IPC tests cover all four variants and recursive rejection', includesAll(ipcTest, [
    '33-H', 'preparedness_kit', 'preparedness_kit_item', 'preparedness_kit_check',
    'emergency_drill', 'token', 'base64'
  ]));
  check('managed modules add no network or direct external primitive',
    !/(?:node:https|node:http|fetch\s*\(|axios|WebSocket|openExternal)/u.test(production));
  check('decision threat model and audit bind exact preparedness boundary', includesAll(decision, [
    'DEC-219', 'EXT-011', 'EXT-015', 'Migration 86'
  ]) && includesAll(threatModel, ['Cross-family', 'append-only', 'not_performed'])
    && includesAll(audit, ['DEC-219', 'Migration 86', 'COMPLETE / PASS']));
  check('master register contains active DEC-219 summary', includesAll(masterRegister, [
    '## DEC-219', 'EXT-011', 'EXT-015', 'DEC-219-family-emergency-preparedness-kits-and-drills.md'
  ]));
  check('decision ledger carries exact active DEC-219', decisionLedger.decisionCount === decisionLedger.decisions?.length
    && decisionLedger.decisions?.some((item) => item.id === 'DEC-219' && item.status === 'ACTIVE'
      && item.requirements?.join(',') === ids.join(',')));
  check('both registry requirements have exact complete 13-link chains', requirements.every((item) =>
    item?.status === 'COMPLETE' && Object.keys(item.chain ?? {}).length === 13
    && Object.values(item.chain).every((value) => value === true)));
  check('platform policy and capability gates remain exact PASS', astGate.status === 'PASS'
    && capabilityGate.status === 'PASS' && astGate.directRoleAuthorizationBypasses === 0);
  check('PPK-022 current successor ratchet remains exact', capabilityGate.exactManifestSurfaces === 282);
  check('root package exposes boundary targeted contract runtime and completion commands',
    includesAll(JSON.stringify(rootPackage.scripts), [
      'verify:b5-family-emergency-preparedness:boundary',
      'verify:b5-family-emergency-preparedness:targeted',
      'verify:b5-family-emergency-preparedness:contract',
      'verify:b5-family-emergency-preparedness:runtime',
      'finalize:33-h:external-receipt', 'verify:33-h:completion'
    ]));
  check('pretypecheck and prebuild both enforce the current boundary', ['pretypecheck', 'prebuild'].every((name) =>
    rootPackage.scripts?.[name]?.includes('verify-family-emergency-preparedness-boundary.mjs')));
  check('inventory preserves exactly two IPC and zero network channels',
    inventory.ipcChannels?.length === 2 && inventory.networkChannels?.length === 0);

  const report = {
    schemaVersion: 1,
    step: '33-H',
    requirements: ids,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checksPassed: checks.length - failures.length,
    checksFailed: failures.length,
    checks,
    failures,
    latestDatabaseMigration: migrationVersions.at(-1),
    closureDatabaseMigration: 86,
    familyEmergencyPreparednessTables:
      (migrations.match(/CREATE TABLE family_emergency_preparedness_ledger/gu) ?? []).length,
    preparednessItemTypes: itemTypes.length,
    ipcChannels: inventory.ipcChannels?.length ?? 0,
    networkChannels: inventory.networkChannels?.length ?? 0,
    ppk021ExactAllowlistEntries: astGate.exactAllowlistEntries,
    ppk021UseCaseCompositionSurfaces: astGate.surfaceCounts?.USE_CASE_COMPOSITION ?? 0,
    ppk022CapabilitySurfaces: capabilityGate.exactManifestSurfaces,
    dataSource: scope.truth?.dataSource,
    offlineAvailability: scope.truth?.offlineAvailability,
    barcodeLookup: scope.truth?.barcodeLookup,
    expiryVerification: scope.truth?.expiryVerification,
    notificationDelivery: scope.truth?.notificationDelivery,
    sensorIntegration: scope.truth?.sensorIntegration,
    readinessGuarantee: scope.truth?.readinessGuarantee,
    generatedAt: new Date().toISOString()
  };
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile(
    'artifacts/validation/33-H-family-emergency-preparedness-boundary.json',
    `${JSON.stringify(report, null, 2)}\n`
  );
  return report;
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const report = await verifyFamilyEmergencyPreparednessBoundary();
  if (report.status !== 'PASS') {
    console.error(`Family emergency preparedness boundary: FAIL (${report.checksFailed}/${report.checks.length}).`);
    for (const failure of report.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`Family emergency preparedness boundary: PASS (${report.checksPassed}/${report.checks.length} checks).`);
}
