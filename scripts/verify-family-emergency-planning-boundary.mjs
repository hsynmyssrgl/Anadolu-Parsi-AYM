import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { runPlatformPolicyAstGate } from './verify-platform-policy-ast-gate.mjs';
import { runPlatformCapabilityManifestGate } from './verify-platform-capability-manifest-gate.mjs';

const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const ids = Object.freeze(['B5-07', 'EXT-009', 'EXT-010', 'EXT-013']);
const itemTypes = Object.freeze([
  'emergency_plan', 'meeting_point', 'external_contact',
  'checklist_item', 'checklist_status', 'member_status'
]);

export const verifyFamilyEmergencyPlanningBoundary = async () => {
  const [
    scope, inventory, domain, security, application, repositoryContract, repository,
    migrations, adapter, runtime, ipcPolicy, panel, applicationTest, repositoryTest,
    ipcTest, decision, threatModel, audit, masterRegister, registry, decisionLedger,
    rootPackage, astGate, capabilityGate
  ] = await Promise.all([
    json('config/33-g-family-emergency-planning-scope.json'),
    json('config/33-g-family-emergency-planning-inventory.json'),
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
    text('packages/application/tests/family-emergency-planning.test.ts'),
    text('packages/repositories/family-emergency-repository-policy.test.ts'),
    text('apps/desktop/tests/b5-family-emergency-ipc-integration.test.ts'),
    text('docs/decisions/DEC-218-family-emergency-planning.md'),
    text('docs/security/THREAT_MODEL_33_G_FAMILY_EMERGENCY_PLANNING.md'),
    text('docs/audit/33-G_FAMILY_EMERGENCY_PLANNING_UST_KAPANIS.md'),
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
  const migrationStart = migrations.indexOf('const familyEmergencyPlanningLedgerSql');
  const migration85 = migrationStart < 0 ? '' : migrations.slice(migrationStart);
  const production = [adapter, runtime, ipcPolicy, panel].join('\n');

  check('scope closes the exact DEC-218 four-requirement package', scope.status === 'COMPLETE'
    && scope.decision === 'DEC-218' && scope.requirements?.join(',') === ids.join(','));
  check('inventory is complete without an open package blocker', inventory.status === 'COMPLETE'
    && inventory.openRequirements?.length === 0 && inventory.openBlockers?.length === 0);
  check('scope fixes one append-only family emergency ledger', scope.model?.table === 'family_emergency_ledger'
    && scope.model?.appendOnly === true && scope.model?.planPrivacy === 'family');
  check('scope fixes all six exact emergency variants', scope.model?.itemTypes?.join(',') === itemTypes.join(','));
  check('scope preserves exact offline manual no-external truth', scope.truth?.dataSource === 'manual'
    && scope.truth?.offlineAvailability === 'local_only'
    && scope.truth?.mapLookup === 'not_performed'
    && scope.truth?.liveLocation === 'not_performed'
    && scope.truth?.messageDelivery === 'not_performed'
    && scope.truth?.emergencyServiceContact === 'not_performed'
    && scope.truth?.emergencyServiceGuarantee === 'not_claimed'
    && scope.truth?.networkEgressAdded === false);
  check('domain declares exact emergency enums', includesAll(domain, [
    'FAMILY_EMERGENCY_ITEM_TYPES', 'FAMILY_EMERGENCY_PLAN_KINDS',
    'FAMILY_EMERGENCY_MEETING_POINT_KINDS', 'FAMILY_EMERGENCY_CHECKLIST_STATUSES',
    'FAMILY_EMERGENCY_MEMBER_STATUSES'
  ]) && itemTypes.every((item) => domain.includes(`'${item}'`)));
  check('domain includes general plans primary alternate points and safe needs-help status', includesAll(domain, [
    "'general','earthquake','fire','flood','evacuation','other'",
    "['primary','alternate']", "['safe','needs_help']"
  ]));
  check('domain exposes exact discriminated views and commands', includesAll(domain, [
    'FamilyEmergencyLedgerItemView', 'RecordFamilyEmergencyItemInput',
    'FamilyEmergencyPlanView', 'FamilyEmergencyChecklistItemView'
  ]));
  check('workspace exposes emergency plans and exact truth flags', includesAll(domain, [
    'emergencyPlans:readonly FamilyEmergencyPlanView[]', "offlineAvailability:'local_only'",
    "mapLookup:'not_performed'", "liveLocation:'not_performed'",
    "messageDelivery:'not_performed'", "emergencyServiceContact:'not_performed'",
    "emergencyServiceGuarantee:'not_claimed'", 'networkEgressAdded:false'
  ]));
  check('recursive security contract covers every emergency variant', includesAll(security, [
    'FAMILY_EMERGENCY_INPUT_KEYS', 'FAMILY_EMERGENCY_REQUIRED_INPUT_KEYS',
    "'managed_life'|'home_inventory'|'family_emergency'"
  ]) && itemTypes.every((item) => security.includes(`${item}: Object.freeze(`)));
  check('security contract rejects secrets PAN paths and base64 while allowing exact E164', includesAll(security, [
    'password', 'token', 'credential', 'containsLikelyManagedLifePan', 'isPathLike',
    'isBase64Like', "fieldName === 'phoneE164'"
  ]));
  check('application dispatches exact family emergency commands', includesAll(application, [
    'isFamilyEmergencyCommand', "inspection.contractFamily === 'family_emergency'",
    'RecordFamilyEmergencyItemInput'
  ]));
  check('application validates bounded E164 canonical ISO and integer order', includesAll(application, [
    'phoneE164', 'Number.isSafeInteger', 'isExactManagedLifeIsoDateTime', 'sortOrder'
  ]));
  check('application derives plan ownership and reporter identity from live context', includesAll(application, [
    'findFamilyEmergencyPlan', 'reportedByPersonId', 'memberPersonId', "action: 'create'"
  ]));
  check('application validates root parent supersession and latest-event relations', includesAll(application, [
    'findFamilyEmergencyItem', 'supersedesItemId', 'checklistItemId', 'member_status'
  ]));
  check('application exposes E164 only inside the authorized family projection', includesAll(application, [
    'phoneE164', 'projectFamilyEmergency'
  ]));
  check('application workspace groups plans and latest checklist/member status events', includesAll(application, [
    'emergencyPlans', 'latestStatus', 'latestMemberStatuses'
  ]));
  check('application audit and outbox remain content-free', !/payload\s*:\s*\{[^}]*?(?:phoneE164|address|evacuationInstructions|memberStatus|note)/su.test(application));
  check('repository contract exposes list find and insert operations', includesAll(repositoryContract, [
    'listFamilyEmergencyItems', 'findFamilyEmergencyPlan', 'findFamilyEmergencyItem',
    'insertFamilyEmergencyItem', 'findFamilyEmergencyPlanForPolicyResolution'
  ]));
  check('migration 85 is exact latest and additive', migrationVersions.at(-1) === 85
    && includesAll(migrations, ["createMigrationDefinition(85, 'b5_family_emergency_planning_ledger'", 'CREATE TABLE family_emergency_ledger']));
  check('migration stores all exact emergency variants', itemTypes.every((item) => migration85.includes(`'${item}'`)));
  check('migration enforces exact family plan owner and child scope', includesAll(migration85, [
    'trg_b5_family_emergency_root_owner', 'trg_b5_family_emergency_plan_scope',
    "plan.item_type='emergency_plan'", 'plan.family_id=NEW.family_id', 'plan.privacy=NEW.privacy'
  ]));
  check('migration enforces active member and reporter scope', includesAll(migration85, [
    'trg_b5_family_emergency_member_scope', 'member.family_id=NEW.family_id',
    'reporter.family_id=NEW.family_id', "reporter.status='active'"
  ]));
  check('migration enforces checklist parent supersession and chronology', includesAll(migration85, [
    'trg_b5_family_emergency_parent_matrix', 'trg_b5_family_emergency_supersession_scope',
    'trg_b5_family_emergency_event_chronology'
  ]));
  check('migration binds plan and member create versus child update receipts', includesAll(migration85, [
    'trg_b5_family_emergency_policy_receipt', "WHEN NEW.item_type IN ('emergency_plan','member_status') THEN 'create'",
    "ELSE 'update'", "receipt.capability='family.write'"
  ]));
  check('migration binds member status owner and reporter to receipt subject', includesAll(migration85, [
    "WHEN NEW.item_type='member_status' THEN NEW.member_person_id", 'actor_person.id=NEW.reported_by_person_id',
    "receipt.resource_type='life_record'"
  ]));
  check('migration rejects cross-ledger id and receipt reuse', includesAll(migration85, [
    'trg_b5_family_emergency_id_collision', 'life_records', 'life_managed_ledger',
    'life_home_inventory_ledger', 'already bound to a family emergency item'
  ]));
  check('migration makes update and delete fail closed', includesAll(migration85, [
    'BEFORE UPDATE ON family_emergency_ledger', 'BEFORE DELETE ON family_emergency_ledger',
    'family emergency ledger is append-only'
  ]));
  check('repository maps all variants and E164 without receipt projection', includesAll(repository, [
    'mapFamilyEmergencyItem', 'phoneE164',
    'listFamilyEmergencyItems', 'insertFamilyEmergencyItem'
  ]) && !repository.includes('policyReceipt:'));
  check('repository list is exact-family and authorized-plan scoped', includesAll(repository, [
    'family_emergency_ledger', 'family_id=?', 'managedLifeVisibilitySql'
  ]));
  check('repository policy resolver exposes only emergency plan roots', includesAll(repository, [
    'findFamilyEmergencyPlanForPolicyResolution', "item_type='emergency_plan'"
  ]));
  check('adapter loads visible emergency items and exposes write scope methods', includesAll(adapter, [
    'listFamilyEmergencyItems', 'findFamilyEmergencyPlan', 'findFamilyEmergencyItem',
    'insertFamilyEmergencyItem'
  ]));
  check('production policy runtime resolves emergency update roots', includesAll(runtime, [
    'findFamilyEmergencyPlanForPolicyResolution', 'emergencyPlan', 'Life policy resource snapshot'
  ]));
  check('IPC preserves the exact existing two channels', includesAll(ipcPolicy, [
    'life:getManagedWorkspace', 'life:recordManagedItem', 'familyEmergencyItemTypes'
  ]));
  check('IPC validates exact enums E164 status and canonical occurredAt', includesAll(ipcPolicy, [
    'familyEmergencyPlanKinds', 'familyEmergencyMeetingPointKinds',
    'familyEmergencyChecklistStatuses', 'familyEmergencyMemberStatuses', 'phoneE164', 'occurredAt'
  ]));
  check('renderer exposes emergency center and every emergency variant', includesAll(panel, [
    'Acil durum merkezi', 'emergencyPlans', 'emergency_plan', 'meeting_point',
    'external_contact', 'checklist_item', 'checklist_status', 'member_status'
  ]));
  check('renderer visibly states offline manual no-contact and no-guarantee truth', includesAll(panel, [
    'offlineAvailability', 'mapLookup', 'liveLocation', 'messageDelivery',
    'emergencyServiceContact', 'emergencyServiceGuarantee'
  ]));
  check('application tests cover all variants self/admin status and security', includesAll(applicationTest, [
    '33-G', 'six exact', 'member_status', 'reportedByPersonId', 'apiToken', 'base64'
  ]));
  check('repository tests cover receipt scope replay immutability and visibility', includesAll(repositoryTest, [
    'family_emergency_ledger', 'receipt', 'family', 'reported_by_person_id', 'UPDATE', 'DELETE'
  ]));
  check('IPC tests cover all six variants and recursive rejection', includesAll(ipcTest, [
    '33-G', 'all six', 'phoneE164', 'needs_help', 'token', 'base64'
  ]));
  check('managed modules add no network or direct external primitive', !/(?:node:https|node:http|fetch\s*\(|axios|WebSocket|openExternal)/u.test(production));
  check('decision threat model and audit bind exact manual offline boundary', includesAll(decision, [
    'DEC-218', 'B5-07', 'EXT-009', 'EXT-010', 'EXT-013', 'Migration 85'
  ]) && includesAll(threatModel, ['Cross-family', 'reportedByPersonId', 'not_performed'])
    && includesAll(audit, ['DEC-218', 'Migration 85', 'COMPLETE / PASS']));
  check('master register contains active DEC-218 summary', includesAll(masterRegister, [
    '## DEC-218', 'B5-07', 'DEC-218-family-emergency-planning.md'
  ]));
  check('decision ledger carries exact active DEC-218', decisionLedger.decisionCount === decisionLedger.decisions?.length
    && decisionLedger.decisions?.some((item) => item.id === 'DEC-218' && item.status === 'ACTIVE'
      && item.requirements?.join(',') === ids.join(',')));
  check('all four registry requirements have exact complete 13-link chains', requirements.every((item) => item?.status === 'COMPLETE'
    && Object.keys(item.chain ?? {}).length === 13 && Object.values(item.chain).every((value) => value === true)));
  check('platform policy and capability gates remain exact PASS', astGate.status === 'PASS'
    && capabilityGate.status === 'PASS' && astGate.directRoleAuthorizationBypasses === 0);
  check('PPK-022 adds no capability surface', capabilityGate.exactManifestSurfaces === 242);
  check('root package exposes boundary targeted contract runtime and completion commands', includesAll(JSON.stringify(rootPackage.scripts), [
    'verify:b5-family-emergency:boundary', 'verify:b5-family-emergency:targeted',
    'verify:b5-family-emergency:contract', 'verify:b5-family-emergency:runtime',
    'finalize:33-g:external-receipt', 'verify:33-g:completion'
  ]));
  check('pretypecheck and prebuild both enforce the current boundary', ['pretypecheck', 'prebuild'].every((name) =>
    rootPackage.scripts?.[name]?.includes('verify-family-emergency-planning-boundary.mjs')));

  const report = {
    schemaVersion: 1,
    step: '33-G',
    requirements: ids,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checksPassed: checks.length - failures.length,
    checksFailed: failures.length,
    checks,
    failures,
    latestDatabaseMigration: migrationVersions.at(-1),
    familyEmergencyTables: (migrations.match(/CREATE TABLE family_emergency_ledger/gu) ?? []).length,
    emergencyItemTypes: itemTypes.length,
    ipcChannels: inventory.ipcChannels?.length ?? 0,
    networkChannels: inventory.networkChannels?.length ?? 0,
    ppk021ExactAllowlistEntries: astGate.exactAllowlistEntries,
    ppk021UseCaseCompositionSurfaces: astGate.surfaceCounts?.USE_CASE_COMPOSITION ?? 0,
    ppk022CapabilitySurfaces: capabilityGate.exactManifestSurfaces,
    dataSource: scope.truth?.dataSource,
    offlineAvailability: scope.truth?.offlineAvailability,
    mapLookup: scope.truth?.mapLookup,
    liveLocation: scope.truth?.liveLocation,
    messageDelivery: scope.truth?.messageDelivery,
    emergencyServiceContact: scope.truth?.emergencyServiceContact,
    emergencyServiceGuarantee: scope.truth?.emergencyServiceGuarantee,
    generatedAt: new Date().toISOString()
  };
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/33-G-family-emergency-planning-boundary.json', `${JSON.stringify(report, null, 2)}\n`);
  return report;
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const report = await verifyFamilyEmergencyPlanningBoundary();
  if (report.status !== 'PASS') {
    console.error(`Family emergency planning boundary: FAIL (${report.checksFailed}/${report.checks.length}).`);
    for (const failure of report.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`Family emergency planning boundary: PASS (${report.checksPassed}/${report.checks.length} checks).`);
}
