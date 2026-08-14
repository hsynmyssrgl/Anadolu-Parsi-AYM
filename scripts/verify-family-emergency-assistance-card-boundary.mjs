import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { runPlatformPolicyAstGate } from './verify-platform-policy-ast-gate.mjs';
import { runPlatformCapabilityManifestGate } from './verify-platform-capability-manifest-gate.mjs';

const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const ids = Object.freeze(['EXT-012', 'EXT-014']);
const itemTypes = Object.freeze([
  'emergency_profile', 'health_fact', 'emergency_contact', 'assistance_instruction'
]);

export const verifyFamilyEmergencyAssistanceCardBoundary = async () => {
  const [
    scope, inventory, domain, security, application, repositoryContract, repository,
    migrations, adapter, runtime, ipcPolicy, panel, applicationTest, repositoryTest,
    ipcTest, decision, threatModel, audit, masterRegister, registry, decisionLedger,
    rootPackage, astGate, capabilityGate
  ] = await Promise.all([
    json('config/33-i-family-emergency-assistance-card-scope.json'),
    json('config/33-i-family-emergency-assistance-card-inventory.json'),
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
    text('packages/application/tests/family-emergency-assistance.test.ts'),
    text('packages/repositories/family-emergency-assistance-card-repository-policy.test.ts'),
    text('apps/desktop/tests/b5-family-emergency-assistance-ipc-integration.test.ts'),
    text('docs/decisions/DEC-220-family-emergency-assistance-card.md'),
    text('docs/security/THREAT_MODEL_33_I_FAMILY_EMERGENCY_ASSISTANCE_CARD.md'),
    text('docs/audit/33-I_FAMILY_EMERGENCY_ASSISTANCE_CARD_UST_KAPANIS.md'),
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
  const migrationStart = migrations.indexOf('const familyEmergencyAssistanceCardLedgerSql');
  const migrationEnd = migrations.indexOf('export const FAMILY_DATABASE_MIGRATIONS', migrationStart);
  const migration87 = migrationStart < 0 ? '' : migrations.slice(
    migrationStart,
    migrationEnd < 0 ? undefined : migrationEnd
  );
  const production = [adapter, runtime, ipcPolicy, panel].join('\n');

  check('scope closes the exact DEC-220 two-requirement package', scope.status === 'COMPLETE'
    && scope.decision === 'DEC-220' && scope.requirements?.join(',') === ids.join(','));
  check('inventory is complete without open requirements or blockers', inventory.status === 'COMPLETE'
    && inventory.openRequirements?.length === 0 && inventory.openBlockers?.length === 0);
  check('scope fixes one append-only independent private assistance root',
    scope.model?.table === 'family_emergency_assistance_ledger'
    && scope.model?.planTable === 'family_emergency_ledger'
    && scope.model?.independentPolicyRoot === true && scope.model?.appendOnly === true
    && scope.security?.fixedPrivacy === 'private');
  check('scope fixes the exact four assistance variants',
    scope.model?.itemTypes?.join(',') === itemTypes.join(','));
  check('scope fixes exact person and opaque-pet owner bindings',
    scope.subjects?.kinds?.join(',') === 'person,pet'
    && scope.subjects?.personOwnerBinding === 'owner_equals_subject_person'
    && scope.subjects?.petOwnerBinding === 'owner_equals_responsible_person'
    && scope.subjects?.planLinkGrantsVisibility === false);
  check('scope preserves exact manual offline no-service truth', scope.truth?.dataSource === 'manual'
    && scope.truth?.offlineAvailability === 'local_only'
    && ['medicalVerification', 'healthRegistryLookup', 'messageDelivery',
      'emergencyServiceContact', 'exportSharing']
      .every((field) => scope.truth?.[field] === 'not_performed')
    && scope.truth?.emergencyServiceGuarantee === 'not_claimed'
    && scope.truth?.networkEgressAdded === false);
  check('domain declares exact assistance enum constants', includesAll(domain, [
    'FAMILY_EMERGENCY_ASSISTANCE_ITEM_TYPES', 'FAMILY_EMERGENCY_ASSISTANCE_SUBJECT_KINDS',
    'FAMILY_EMERGENCY_HEALTH_FACT_KINDS', 'FAMILY_EMERGENCY_BLOOD_TYPES',
    'FAMILY_EMERGENCY_ASSISTANCE_INSTRUCTION_KINDS'
  ]));
  check('domain stores all four discriminated assistance variants', itemTypes.every((item) =>
    domain.includes(`'${item}'`)));
  check('domain exposes exact assistance views commands and workspace projection', includesAll(domain, [
    'FamilyEmergencyAssistanceLedgerItemView', 'RecordFamilyEmergencyAssistanceItemInput',
    'FamilyEmergencyAssistanceProfileView',
    'emergencyAssistanceProfiles:readonly FamilyEmergencyAssistanceProfileView[]'
  ]));
  check('domain fixes private manual truth and no external claims', includesAll(domain, [
    "privacy:'private'", "dataSource:'manual'", "medicalVerification:'not_performed'",
    "healthRegistryLookup:'not_performed'", "externalDelivery:'not_performed'",
    "localExport:'user_authorized_only'"
  ]));
  check('recursive security contract covers every assistance variant', includesAll(security, [
    'FAMILY_EMERGENCY_ASSISTANCE_INPUT_KEYS',
    'FAMILY_EMERGENCY_ASSISTANCE_REQUIRED_INPUT_KEYS', "'family_emergency_assistance'"
  ]) && itemTypes.every((item) => security.includes(`${item}: Object.freeze(`)));
  check('security contract rejects secrets PAN paths and base64', includesAll(security, [
    'password', 'token', 'credential', 'containsLikelyManagedLifePan', 'isPathLike', 'isBase64Like'
  ]));
  check('application dispatches exact assistance commands', includesAll(application, [
    'isFamilyEmergencyAssistanceCommand',
    "inspection.contractFamily === 'family_emergency_assistance'",
    'RecordFamilyEmergencyAssistanceItemInput'
  ]));
  check('application validates exact E.164 bounded health contact and instruction inputs', includesAll(application, [
    'familyEmergencyE164', 'familyEmergencyHealthFactKinds',
    'familyEmergencyAssistanceInstructionKinds', 'managedLifeText(command.instruction, 2, 1000)'
  ]));
  check('application derives person and pet private ownership without accepting privacy input', includesAll(application, [
    'subjectPersonId', 'subjectPetId', 'responsiblePersonId', "privacy: 'private'"
  ]));
  check('application enforces independent assistance profile create and child update roots', includesAll(application, [
    'const isAssistanceProfile = isAssistance', 'rootId = input.command.profileId',
    "const createOperation = isProfile || isEmergencyPlan || isEmergencyMemberStatus || isAssistanceProfile",
    "action: createOperation ? 'create' : 'update'", 'resourceId: rootId'
  ]));
  check('application validates same-root subtype-preserving supersession', includesAll(application, [
    'findFamilyEmergencyAssistanceItem', 'supersedesItemId', 'prior.value.factKind',
    'prior.value.instructionKind'
  ]));
  check('application projects visible roots and their children', includesAll(application, [
    'buildFamilyEmergencyAssistanceProfiles', 'healthFacts', 'emergencyContacts',
    'assistanceInstructions'
  ]));
  check('application audit and outbox avoid health contact and instruction content',
    !/payload\s*:\s*\{[^}]*?(?:bloodType|factKind|phoneE164|relationship|instructionKind|instruction|note)/su
      .test(application));
  check('repository contract exposes assistance list find insert and policy lookup operations',
    includesAll(repositoryContract, [
      'listFamilyEmergencyAssistanceItems', 'findFamilyEmergencyAssistanceProfile',
      'findFamilyEmergencyAssistanceItem', 'insertFamilyEmergencyAssistanceItem',
      'findFamilyEmergencyAssistanceProfileForPolicyResolution'
    ]));
  check('repository rows bind family owner and branded createdAt', includesAll(repositoryContract, [
    'FamilyEmergencyAssistanceRowCommon', 'familyId:FamilyId', 'ownerPersonId:PersonId',
    'createdAt:IsoDateTime', 'FamilyEmergencyAssistanceLedgerItemRow'
  ]));
  check('migration 87 closure identity remains exact under additive successors', migrationVersions.includes(87)
    && (migrationVersions.at(-1) ?? 0) >= 87
    && includesAll(migrations, [
      "createMigrationDefinition(87, 'b5_family_emergency_assistance_card_ledger'",
      'CREATE TABLE family_emergency_assistance_ledger'
    ]));
  check('migration stores all exact assistance variants', itemTypes.every((item) =>
    migration87.includes(`'${item}'`)));
  check('migration fixes private and manual at storage boundary', includesAll(migration87, [
    "privacy TEXT NOT NULL CHECK(privacy='private')",
    "data_source TEXT NOT NULL CHECK(data_source='manual')"
  ]));
  check('migration validates person and pet owner matrices against active family people', includesAll(migration87, [
    'trg_b5_emergency_assistance_profile_scope', "NEW.subject_kind='person'",
    'subject.id=NEW.owner_person_id', "NEW.subject_kind='pet'",
    'responsible.id=NEW.owner_person_id', "owner.status='active'"
  ]));
  check('migration keeps plan link relational and child scope exact', includesAll(migration87, [
    "plan.item_type='emergency_plan'", 'plan.family_id=NEW.family_id',
    'trg_b5_emergency_assistance_child_scope', 'profile.owner_person_id=NEW.owner_person_id',
    "profile.privacy='private'"
  ]));
  check('migration enforces subtype-preserving append-only corrections', includesAll(migration87, [
    'trg_b5_emergency_assistance_supersession_scope', 'prior.profile_id=NEW.profile_id',
    'NEW.created_at>prior.created_at', "prior.fact_kind=NEW.fact_kind",
    "prior.instruction_kind=NEW.instruction_kind"
  ]));
  check('migration enforces canonical UTC and strict E.164 storage', includesAll(migration87, [
    "strftime('%Y-%m-%dT%H:%M:%fZ',created_at)=created_at", 'phone_e164',
    "substr(phone_e164,1,1)='+'", "substr(phone_e164,2) NOT GLOB '*[^0-9]*'"
  ]));
  check('migration binds exact create profile and update child durable receipts', includesAll(migration87, [
    'trg_b5_emergency_assistance_policy_receipt',
    "receipt.resource_id=CASE WHEN NEW.item_type='emergency_profile' THEN NEW.id ELSE NEW.profile_id END",
    "receipt.action=CASE WHEN NEW.item_type='emergency_profile' THEN 'create' ELSE 'update' END",
    "json_extract(receipt.record_json,'$.request.resource.sensitivity')='highly_sensitive'",
    "json_extract(receipt.record_json,'$.request.occurredAt')=NEW.created_at"
  ]));
  check('migration rejects cross-ledger id and receipt reuse', includesAll(migration87, [
    'trg_b5_emergency_assistance_id_collision', 'life_records', 'life_managed_ledger',
    'life_home_inventory_ledger', 'family_emergency_ledger',
    'family_emergency_preparedness_ledger', 'policy_receipt_hash'
  ]));
  check('migration carries reverse replay fences into health finance archive and prior LIFE ledgers', includesAll(migration87, [
    'archive_items', 'finance_records', 'health_records', 'medication_plans', 'locations',
    'bank_accounts', 'finance_planning_ledger', 'finance_import_batches',
    'already bound to an emergency assistance item'
  ]));
  check('migration makes update and delete fail closed', includesAll(migration87, [
    'BEFORE UPDATE ON family_emergency_assistance_ledger',
    'BEFORE DELETE ON family_emergency_assistance_ledger', 'append-only'
  ]));
  check('repository maps assistance rows without policy receipt projection', includesAll(repository, [
    'mapFamilyEmergencyAssistanceItem', 'listFamilyEmergencyAssistanceItems',
    'insertFamilyEmergencyAssistanceItem'
  ]) && !/mapFamilyEmergencyAssistanceItem[\s\S]{0,3000}policyReceipt:/u.test(repository));
  check('repository list is family scoped and authorized through independent private roots', includesAll(repository, [
    'family_emergency_assistance_ledger assistance',
    "profile.item_type='emergency_profile'", 'managedLifeVisibilitySql', 'family_id=?'
  ]));
  const assistanceProfileLookup = repository.slice(
    repository.indexOf('public findFamilyEmergencyAssistanceProfile('),
    repository.indexOf('public findFamilyEmergencyAssistanceProfileForPolicyResolution(')
  );
  const assistanceItemLookup = repository.slice(
    repository.indexOf('public findFamilyEmergencyAssistanceItem('),
    repository.indexOf('public insertFamilyEmergencyAssistanceItem(')
  );
  check('repository child parent lookups bind exact update root rather than a read receipt',
    includesAll(assistanceProfileLookup, [
      'lifeWriteBinding(context', 'resourceId:String(row.id)', "action:'update'"
    ])
    && includesAll(assistanceItemLookup, [
      'lifeWriteBinding(context', 'resourceId:profileId', "action:'update'"
    ])
    && !assistanceProfileLookup.includes('lifeReadBinding(')
    && !assistanceItemLookup.includes('lifeReadBinding('));
  check('repository policy resolver keeps assistance root lifecycle fail closed', includesAll(repository, [
    'findFamilyEmergencyAssistanceProfileForPolicyResolution',
    "lifecycle.resource_id=assistance.id", "lifecycle.state<>'active'"
  ]));
  check('adapter loads assistance independently and exposes exact write scope methods', includesAll(adapter, [
    'listFamilyEmergencyAssistanceItems', 'visibleAssistanceProfiles',
    'findFamilyEmergencyAssistanceProfile', 'findFamilyEmergencyAssistanceItem',
    'insertFamilyEmergencyAssistanceItem'
  ]));
  check('production policy runtime resolves independent assistance roots', includesAll(runtime, [
    'findFamilyEmergencyAssistanceProfileForPolicyResolution', 'assistanceProfile',
    'Life policy resource snapshot'
  ]));
  check('IPC preserves the exact existing two channels and four assistance variants', includesAll(ipcPolicy, [
    'life:getManagedWorkspace', 'life:recordManagedItem', 'familyEmergencyAssistanceItemTypes'
  ]) && itemTypes.every((item) => ipcPolicy.includes(`'${item}'`)));
  check('IPC validates assistance subject health contact and instruction enums', includesAll(ipcPolicy, [
    'familyEmergencyAssistanceSubjectKinds', 'familyEmergencyAssistanceFactKinds',
    'familyEmergencyAssistanceBloodTypes', 'familyEmergencyAssistanceInstructionKinds',
    'phoneE164'
  ]));
  check('renderer exposes private person pet health contact and assistance workflow', includesAll(panel, [
    'emergencyAssistanceProfiles', 'emergency_profile', 'health_fact',
    'emergency_contact', 'assistance_instruction', 'assistanceSubjectKind'
  ]));
  check('renderer visibly states private manual clinical and no-external truth', includesAll(panel, [
    'medicalVerification', 'healthRegistryLookup', 'exportSharing',
    'emergencyServiceContact', 'networkEgressAdded'
  ]));
  check('application tests cover person pet all variants projection and security', includesAll(applicationTest, [
    'emergency_profile', 'health_fact', 'emergency_contact', 'assistance_instruction',
    'subjectKind', 'emergencyAssistanceProfiles'
  ]));
  check('repository tests cover private visibility receipt replay immutability and subtype scope', includesAll(repositoryTest, [
    'family_emergency_assistance_ledger', 'private', 'receipt', 'UPDATE', 'DELETE',
    'bad-subtype-correction'
  ]));
  check('IPC tests cover private assistance and recursive rejection', includesAll(ipcTest, [
    'emergency_profile', 'health_fact', 'emergency_contact', 'assistance_instruction',
    'private', 'token', 'base64'
  ]));
  check('managed modules add no network or direct external primitive',
    !/(?:node:https|node:http|fetch\s*\(|axios|WebSocket|openExternal)/u.test(production));
  check('decision threat model and audit bind exact private assistance boundary', includesAll(decision, [
    'DEC-220', 'EXT-012', 'EXT-014', 'Migration 87', 'private'
  ]) && includesAll(threatModel, ['confused deputy', 'append-only', 'not_performed'])
    && includesAll(audit, ['DEC-220', 'Migration 87', 'COMPLETE / PASS']));
  check('master register contains active DEC-220 summary', includesAll(masterRegister, [
    '## DEC-220', 'EXT-012', 'EXT-014', 'DEC-220-family-emergency-assistance-card.md'
  ]));
  check('decision ledger carries exact active DEC-220',
    decisionLedger.decisionCount === decisionLedger.decisions?.length
    && decisionLedger.decisions?.some((item) => item.id === 'DEC-220' && item.status === 'ACTIVE'
      && item.requirements?.join(',') === ids.join(',')));
  check('both registry requirements have exact complete 13-link chains', requirements.every((item) =>
    item?.status === 'COMPLETE' && Object.keys(item.chain ?? {}).length === 13
    && Object.values(item.chain).every((value) => value === true)));
  check('platform policy and capability gates remain exact PASS', astGate.status === 'PASS'
    && capabilityGate.status === 'PASS' && astGate.directRoleAuthorizationBypasses === 0);
  check('PPK-022 current successor ratchet remains exact', capabilityGate.exactManifestSurfaces === 282);
  check('root package exposes boundary targeted contract and runtime commands', includesAll(
    JSON.stringify(rootPackage.scripts), [
      'verify:b5-family-emergency-assistance:boundary',
      'verify:b5-family-emergency-assistance:targeted',
      'verify:b5-family-emergency-assistance:contract',
      'verify:b5-family-emergency-assistance:runtime'
    ]
  ));
  check('pretypecheck and prebuild both enforce the current boundary', ['pretypecheck', 'prebuild'].every((name) =>
    rootPackage.scripts?.[name]?.includes('verify-family-emergency-assistance-card-boundary.mjs')));
  check('inventory preserves exactly two IPC and zero network channels',
    inventory.ipcChannels?.length === 2 && inventory.networkChannels?.length === 0);

  const report = {
    schemaVersion: 1,
    step: '33-I',
    requirements: ids,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checksPassed: checks.length - failures.length,
    checksFailed: failures.length,
    checks,
    failures,
    closureDatabaseMigration: 87,
    latestDatabaseMigration: migrationVersions.at(-1),
    familyEmergencyAssistanceTables:
      (migrations.match(/CREATE TABLE family_emergency_assistance_ledger/gu) ?? []).length,
    assistanceItemTypes: itemTypes.length,
    ipcChannels: inventory.ipcChannels?.length ?? 0,
    networkChannels: inventory.networkChannels?.length ?? 0,
    ppk021ExactAllowlistEntries: astGate.exactAllowlistEntries,
    ppk021UseCaseCompositionSurfaces: astGate.surfaceCounts?.USE_CASE_COMPOSITION ?? 0,
    ppk022CapabilitySurfaces: capabilityGate.exactManifestSurfaces,
    dataSource: scope.truth?.dataSource,
    offlineAvailability: scope.truth?.offlineAvailability,
    medicalVerification: scope.truth?.medicalVerification,
    healthRegistryLookup: scope.truth?.healthRegistryLookup,
    messageDelivery: scope.truth?.messageDelivery,
    emergencyServiceContact: scope.truth?.emergencyServiceContact,
    exportSharing: scope.truth?.exportSharing,
    emergencyServiceGuarantee: scope.truth?.emergencyServiceGuarantee,
    networkEgressAdded: scope.truth?.networkEgressAdded,
    generatedAt: new Date().toISOString()
  };
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile(
    'artifacts/validation/33-I-family-emergency-assistance-card-boundary.json',
    `${JSON.stringify(report, null, 2)}\n`
  );
  return report;
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const report = await verifyFamilyEmergencyAssistanceCardBoundary();
  if (report.status !== 'PASS') {
    console.error(`Family emergency assistance card boundary: FAIL (${report.checksFailed}/${report.checks.length}).`);
    for (const failure of report.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`Family emergency assistance card boundary: PASS (${report.checksPassed}/${report.checks.length} checks).`);
}
