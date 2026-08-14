import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { runPlatformPolicyAstGate } from './verify-platform-policy-ast-gate.mjs';
import { runPlatformCapabilityManifestGate } from './verify-platform-capability-manifest-gate.mjs';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const text = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await text(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const ids = Object.freeze(['B5-03', 'EXT-016']);
const itemTypes = Object.freeze([
  'card_configuration', 'selected_field', 'document_link', 'export_event', 'power_mode_event'
]);

export const verifyFamilyEmergencyCardPortabilityBoundary = async () => {
  const [
    scope, inventory, domain, security, application, encryption, repositoryContract,
    repository, migrations, adapter, runtime, ipcPolicy, lifecycle, main, preload, panel,
    applicationTest, repositoryTest, encryptionTest, ipcTest, decision, threatModel,
    audit, masterRegister, registry, decisionLedger, workPlan, activeLedger, rootPackage,
    migrationManifest, astGate, capabilityGate
  ] = await Promise.all([
    json('config/33-j-family-emergency-card-portability-scope.json'),
    json('config/33-j-family-emergency-card-portability-inventory.json'),
    text('packages/domain/src/app-data.ts'),
    text('packages/application/src/life-security.ts'),
    text('packages/application/src/life-use-cases.ts'),
    text('packages/security/src/encryption.ts'),
    text('packages/repository-contracts/src/life-repository.ts'),
    text('packages/repositories/src/life-repository.ts'),
    text('packages/database/src/family-database-migrations.ts'),
    text('apps/desktop/src/main/life-application-adapter.ts'),
    text('apps/desktop/src/main/life-production-policy-runtime.ts'),
    text('apps/desktop/src/main/ipc-integration-policy.ts'),
    text('apps/desktop/src/main/ipc-request-lifecycle.ts'),
    text('apps/desktop/src/main/main.ts'),
    text('apps/desktop/src/main/preload.ts'),
    text('apps/desktop/src/renderer/ManagedLifePanel.tsx'),
    text('packages/application/tests/family-emergency-card-portability.test.ts'),
    text('packages/repositories/family-emergency-card-portability-repository-policy.test.ts'),
    text('packages/security/tests/emergency-portable-pack.test.ts'),
    text('apps/desktop/tests/b5-family-emergency-card-portability-ipc-integration.test.ts'),
    text('docs/decisions/DEC-221-family-emergency-card-portability.md'),
    text('docs/security/THREAT_MODEL_33_J_FAMILY_EMERGENCY_CARD_PORTABILITY.md'),
    text('docs/audit/33-J_FAMILY_EMERGENCY_CARD_PORTABILITY_UST_KAPANIS.md'),
    text('docs/10_MASTER_DECISION_REGISTER.md'),
    json('config/accepted-scope-registry.json'),
    json('config/user-decision-ledger.json'),
    json('config/work-segmentation-plan.json'),
    json('config/active-governance-ledger.json'),
    json('package.json'),
    json('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),
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
  const migrationStart = migrations.indexOf('const familyEmergencyCardPortabilityLedgerSql');
  const migrationEnd = migrations.indexOf('export const FAMILY_DATABASE_MIGRATIONS', migrationStart);
  const migration88 = migrationStart < 0 ? '' : migrations.slice(
    migrationStart, migrationEnd < 0 ? undefined : migrationEnd
  );
  const manifest88 = migrationManifest.migrationVersions?.find((item) => item.version === 88);
  const production = [adapter, runtime, ipcPolicy, lifecycle, preload, panel].join('\n');
  const publicExportView = domain.slice(
    domain.indexOf('interface FamilyEmergencyCardExportEventLedgerItemCommonView'),
    domain.indexOf('export interface RecordFamilyEmergencyCardConfigurationInput')
  );

  check('scope binds the exact DEC-221 two-requirement implementation',
    scope.decision === 'DEC-221' && scope.requirements?.join(',') === ids.join(',')
    && scope.status === 'COMPLETE' && scope.validation?.status === 'PASS'
    && scope.validation?.finalEvidence?.productionWorkspaceBuildsPassed === 18
    && scope.validation?.finalEvidence?.finalClosureEvidence === true);
  check('inventory has no open implementation requirements', inventory.requirements?.join(',') === ids.join(',')
    && inventory.status === 'COMPLETE' && inventory.openRequirements?.length === 0
    && inventory.openBlockers?.length === 0);
  check('scope fixes one append-only private portability ledger',
    scope.model?.table === 'family_emergency_card_portability_ledger'
    && scope.model?.sourceTable === 'family_emergency_assistance_ledger'
    && scope.model?.policyRoot === 'independent_private_emergency_profile'
    && scope.model?.appendOnly === true);
  check('scope fixes the exact five item variants', scope.model?.itemTypes?.join(',') === itemTypes.join(','));
  check('scope fixes exact closed source-field matrix',
    scope.selection?.sourceFieldMatrix?.emergency_profile?.join(',') === 'label,subject_display'
    && scope.selection?.sourceFieldMatrix?.health_fact?.join(',') === 'fact_value,note'
    && scope.selection?.sourceFieldMatrix?.emergency_contact?.join(',') === 'name,phone_e164,relationship,note'
    && scope.selection?.sourceFieldMatrix?.assistance_instruction?.join(',') === 'instruction_kind,instruction,note');
  check('scope caps selected fields documents and artifacts', scope.selection?.maximumSelectedFields === 64
    && scope.selection?.maximumDocuments === 10 && scope.artifacts?.maximumArtifactBytes === 67_108_864);
  check('scope preserves manual-only honest power truth', scope.power?.mode === 'manual_only'
    && scope.power?.batteryPromptEnum === 'reserved_not_exposed'
    && scope.power?.batteryLevel === 'not_measured'
    && scope.power?.automaticLowBatteryDetection === 'not_performed'
    && scope.power?.lowBatteryClaimed === false);
  check('scope preserves exact local-only no-delivery truth', scope.truth?.offlineAvailability === 'local_only'
    && scope.truth?.externalDelivery === 'not_performed' && scope.truth?.cloudUpload === 'not_performed'
    && scope.truth?.localExport === 'user_authorized_only' && scope.truth?.networkEgressAdded === false);
  check('domain declares exact item output source field and power enums', includesAll(domain, [
    'FAMILY_EMERGENCY_CARD_PORTABILITY_ITEM_TYPES', 'FAMILY_EMERGENCY_CARD_OUTPUT_MODES',
    'FAMILY_EMERGENCY_CARD_SOURCE_ITEM_TYPES', 'FAMILY_EMERGENCY_CARD_FIELD_CODES',
    'FAMILY_EMERGENCY_CARD_POWER_SOURCES', 'FAMILY_EMERGENCY_CARD_POWER_ACTIVATION_SOURCES'
  ]));
  check('domain field matrix is exact', includesAll(domain, [
    "emergency_profile: Object.freeze(['label','subject_display']",
    "health_fact: Object.freeze(['fact_value','note']",
    "emergency_contact: Object.freeze(['name','phone_e164','relationship','note']",
    "assistance_instruction: Object.freeze(['instruction_kind','instruction','note']"
  ]));
  check('domain fixes private manual locale and three output modes', includesAll(domain, [
    "privacy:'private'", "dataSource:'manual'", "locale:'tr-TR'", "['print','pdf','encrypted_pack']"
  ]));
  check('domain discriminates print and file readback truth', includesAll(domain, [
    "mode:'print'", "artifactReadbackStatus:'not_applicable_print'", "printerDispatchStatus:'confirmed'",
    "mode:'pdf'|'encrypted_pack'", "artifactReadbackStatus:'verified'"
  ]));
  check('public export view omits internal share receipt hash', !publicExportView.includes('shareReceiptHash'));
  check('command and internal write record retain share receipt binding', includesAll(application, [
    'FamilyEmergencyCardExportEventWriteRecord', 'readonly shareReceiptHash:string'
  ]) && includesAll(domain, ['RecordFamilyEmergencyCardExportEventCommonInput', 'readonly shareReceiptHash:string']));
  check('recursive security contract covers every portability variant', includesAll(security, [
    'FAMILY_EMERGENCY_CARD_PORTABILITY_INPUT_KEYS',
    'FAMILY_EMERGENCY_CARD_PORTABILITY_REQUIRED_INPUT_KEYS', "'family_emergency_card_portability'"
  ]) && itemTypes.every((item) => security.includes(`${item}: Object.freeze(`)));
  check('generic renderer record path rejects export completion events', includesAll(application, [
    "isPortability && input.command.itemType === 'export_event'",
    'yalniz tek kullanimlik completion kanitiyla kaydedilebilir'
  ]));
  check('application binds all portability ledger writes to update profile root', includesAll(application, [
    'isFamilyEmergencyCardPortabilityCommand', 'rootId = input.command.profileId',
    "action: createOperation ? 'create' : 'update'", "capability: 'family.write'"
  ]));
  check('application validates relation and projects portability workspace', includesAll(application, [
    'validateFamilyEmergencyCardPortabilityRelations', 'buildFamilyEmergencyCardConfigurations',
    'cardConfigurations: buildFamilyEmergencyCardConfigurations'
  ]));
  check('application creates canonical selection digest and exact share purpose', includesAll(application, [
    'familyEmergencyCardSelectionSha256', '`selection_sha256:${selectionSha256}`',
    "purpose: 'emergency-offline-portability'"
  ]));
  check('application requires operation-bound strong proof within 120 seconds', includesAll(application, [
    'selectionSha256 !== selectionValidation.value.selectionSha256', 'expiresAt - verifiedAt > 120_000'
  ]));
  check('application records completion with internal share receipt and exact truth', includesAll(application, [
    'scope.authorizationReceiptHash', 'shareReceiptHash: binding.shareReceiptHash',
    "artifactReadbackStatus: 'not_applicable_print'", "artifactReadbackStatus: 'verified'"
  ]));
  check('portable encryption uses independent scrypt KEK random DEK and AES GCM', includesAll(encryption, [
    'scryptSync', 'randomBytes', 'createCipheriv', "'aes-256-gcm'", 'wrappedDek'
  ]));
  check('portable encryption implements parse decrypt and payload hash verification', includesAll(encryption, [
    'decryptPortableEmergencyPack', 'verifyPortableEmergencyPackReadback',
    'plaintextSha256', 'timingSafeEqual', 'selectionSha256'
  ]));
  check('repository contract exposes exact list find insert operations', includesAll(repositoryContract, [
    'listFamilyEmergencyCardPortabilityItems', 'findFamilyEmergencyCardConfiguration',
    'findFamilyEmergencyCardPortabilityItem', 'insertFamilyEmergencyCardPortabilityItem'
  ]));
  check('repository internal export row requires share receipt hash', includesAll(repositoryContract, [
    'FamilyEmergencyCardExportEventLedgerItemRow', 'readonly shareReceiptHash:string'
  ]));
  check('repository list uses exact share-aware binding without weakening generic reads', includesAll(repository, [
    'emergencyCardPortabilityVisibilityBinding', "authorization.action === 'read'", 'lifeReadBinding(context',
    "action:'share'", "capability:'file.share'", "purpose:'emergency-offline-portability'"
  ]));
  check('repository resolves only current selected sources and live high archive links', includesAll(repository, [
    "portability.item_type<>'selected_field'", 'supersedes_item_id=source.id',
    "portability.item_type<>'document_link'", "archive.sensitivity='high'", 'archive.destroyed_at IS NULL'
  ]));
  check('repository maps internal share hash but never a generic policy receipt field', includesAll(repository, [
    'mapFamilyEmergencyCardPortabilityItem', 'shareReceiptHash:String(row.share_receipt_hash)'
  ]) && !/mapFamilyEmergencyCardPortabilityItem[\s\S]{0,4500}policyReceipt:/u.test(repository));
  check('migration 88 remains exact through additive successors', migrationVersions.at(-1) >= 89
    && includesAll(migrations, [
      "createMigrationDefinition(88, 'b5_family_emergency_card_portability_ledger'",
      'CREATE TABLE family_emergency_card_portability_ledger',
      "createMigrationDefinition(89, 'b4_long_term_portfolio_ledger'"
    ]));
  check('migration 88 checksum is exact', migrationManifest.status === 'passed'
    && manifest88?.name === 'b5_family_emergency_card_portability_ledger'
    && manifest88?.checksum === '8785551a6ce0facd609e374e7ba65c70d35b552e6f63a7f0b3d790bfbffa2b04');
  check('migration stores all exact variants and immutable private truth', itemTypes.every((item) =>
    migration88.includes(`'${item}'`)) && includesAll(migration88, [
    "privacy TEXT NOT NULL CHECK(privacy='private')", "data_source TEXT NOT NULL CHECK(data_source='manual')",
    'BEFORE UPDATE ON family_emergency_card_portability_ledger',
    'BEFORE DELETE ON family_emergency_card_portability_ledger'
  ]));
  check('migration enforces profile configuration and selected-source scope', includesAll(migration88, [
    'trg_b5_emergency_card_portability_profile_scope',
    'trg_b5_emergency_card_portability_configuration_scope',
    'trg_b5_emergency_card_portability_selected_field_scope'
  ]));
  check('migration enforces exact selection and document limits', includesAll(migration88, [
    'trg_b5_emergency_card_portability_selected_field_limit',
    'trg_b5_emergency_card_portability_document_limit', '>=64', '>=10'
  ]));
  check('migration enforces high same-family undestroyed archive scope', includesAll(migration88, [
    'trg_b5_emergency_card_portability_document_scope', "archive.sensitivity='high'",
    'archive.destroyed_at IS NULL', 'archive.family_id=NEW.family_id'
  ]));
  check('migration binds exact update family-write durable receipts', includesAll(migration88, [
    'trg_b5_emergency_card_portability_policy_receipt', "receipt.resource_id=NEW.profile_id",
    "receipt.action='update'", "receipt.capability='family.write'"
  ]));
  check('migration binds export completion to unique exact prior share receipt', includesAll(migration88, [
    'share_receipt_hash TEXT UNIQUE', 'trg_b5_emergency_card_portability_export_share_receipt',
    "share_receipt.action='share'", "share_receipt.capability='file.share'",
    "$.request.purpose')='emergency-offline-portability'", '(300.0/86400.0)'
  ]));
  check('migration rejects cross-ledger IDs and receipts in both directions', includesAll(migration88, [
    'trg_b5_emergency_card_portability_id_collision', 'already bound to an emergency card portability item',
    'life_records', 'archive_items', 'finance_records', 'health_records', 'family_emergency_assistance_ledger'
  ]));
  check('migration enforces output size readback and honest power shape', includesAll(migration88, [
    'artifact_size_bytes BETWEEN 1 AND 67108864', "artifact_readback_status='not_applicable_print'",
    "artifact_readback_status='verified'", "battery_level='not_measured'",
    "automatic_low_battery_detection='not_performed'", 'low_battery_claimed=0'
  ]));
  check('policy runtime recognizes only exact local emergency share purpose', includesAll(runtime, [
    "requestedIntent.action === 'share'", "requestedIntent.capability === 'file.share'",
    "requestedIntent.purpose === 'emergency-offline-portability'"
  ]));
  check('desktop orchestrator exposes prepare and completion operations', includesAll(main, [
    'prepareEmergencyCardExport', 'completeEmergencyCardExport'
  ]));
  check('IPC validates one new export channel and manual power activation only', includesAll(ipcPolicy, [
    "case 'life:exportEmergencyCard'", "value.activationSource === 'manual'",
    "artifactReadbackStatus === 'not_applicable_print'", "artifactReadbackStatus === 'verified'"
  ]));
  check('IPC lifecycle governs the export channel', lifecycle.includes("'life:exportEmergencyCard'"));
  check('preload exposes only typed emergency card export invocation', includesAll(preload, [
    'exportEmergencyCard:', "invoke('life:exportEmergencyCard',input)"
  ]));
  check('main performs atomic no-overwrite publication and verified readback', includesAll(main, [
    'fsyncSync(descriptor)', 'linkSync(temporaryPath, destinationPath)', 'lstatSync(destinationPath)',
    'readFileSync(destinationPath)'
  ]));
  check('main generates canonical PDF bytes and confirms native print truth', includesAll(main, [
    'webContents.printToPDF', "artifactReadbackStatus = 'not_applicable_print'",
    "printerDispatchStatus = 'confirmed'"
  ]));
  check('main decrypts and verifies encrypted pack before completion', includesAll(main, [
    'verifyPortableEmergencyPackReadback', 'verified.metadata.selectionSha256 !== prepared.selectionSha256',
    "artifactReadbackStatus = 'verified'"
  ]));
  check('renderer exposes explicit card fields output modes strong credentials and manual power', includesAll(panel, [
    'cardConfigurations', 'cardSelectedFieldIds', 'cardDocumentLinkIds', 'encrypted_pack',
    "activationSource:'manual'", 'exportEmergencyCard'
  ]));
  check('application tests cover selection proof subset and completion lifetime', includesAll(applicationTest, [
    'selectionSha256', 'shareReceiptHash', '12:05:00.000Z', '12:05:00.001Z', 'encrypted_pack'
  ]));
  check('repository tests cover limits replay visibility and immutable rows', includesAll(repositoryTest, [
    'exact 64 selected-field and 10 document-link', 'cross-ledger replay', 'UPDATE', 'DELETE',
    'shareReceiptHash'
  ]));
  check('encryption tests cover roundtrip tamper and wrong password', includesAll(encryptionTest, [
    'encrypted', 'decrypt', 'tamper', 'password'
  ]));
  check('desktop tests cover strong authentication print PDF encrypted pack and IPC denial', includesAll(ipcTest, [
    'print', 'pdf', 'encrypted_pack', 'strong', 'life:exportEmergencyCard'
  ]));
  check('33-J production surfaces add no network primitive',
    !/(?:node:https|node:http|fetch\s*\(|axios|WebSocket|openExternal)/u.test(production));
  check('decision threat model and audit bind exact portability security boundary', includesAll(decision, [
    'DEC-221', 'B5-03', 'EXT-016', 'Migration 88', 'shareReceiptHash'
  ]) && includesAll(threatModel, ['Confused deputy', 'AES-256-GCM', 'not_performed'])
    && includesAll(audit, ['DEC-221', 'Migration 88', '554', '246']));
  check('master register contains active DEC-221 summary', includesAll(masterRegister, [
    '## DEC-221', 'B5-03', 'EXT-016', 'DEC-221-family-emergency-card-portability.md'
  ]));
  check('decision ledger carries exact active DEC-221', decisionLedger.decisionCount === decisionLedger.decisions?.length
    && decisionLedger.decisions?.some((item) => item.id === 'DEC-221' && item.status === 'ACTIVE'
      && item.requirements?.join(',') === ids.join(',')));
  check('both registry requirements have exact complete 13-link chains', requirements.every((item) =>
    item?.status === 'COMPLETE' && Object.keys(item.chain ?? {}).length === 13
    && Object.values(item.chain).every((value) => value === true)));
  const step33J = workPlan.steps?.find((step) => step.id === '33-J');
  const step33K = workPlan.steps?.find((step) => step.id === '33-K');
  const laterLifecycle = inspectAuthorizedSuccessorLifecycle({
    plan: workPlan, ledger: activeLedger, predecessorId: '33-J'
  });
  const activeReady = workPlan.currentStep === '33-J' && step33J?.status === 'IN_PROGRESS'
    && step33J.persistentReceiptStatus === 'PENDING' && step33K?.status === 'PENDING'
    && activeLedger.activeMicroStep === '33-J';
  const completedReady = workPlan.currentStep === '33-J' && step33J?.status === 'COMPLETED'
    && step33J.validationStatus === 'PASS' && step33J.persistentReceiptStatus === 'PASS'
    && step33J.completionTransitionStatus === 'PASS' && step33K?.status === 'PENDING'
    && activeLedger.activeMicroStep === null
    && activeLedger.libraryUploadStatus === '33-J_COMPLETED_RECEIPT_PASS'
    && activeLedger.externalLibraryAuthority33J?.status === 'PASS';
  check('33-J is active, receipt-complete, or preserved through an authorized successor',
    activeReady || completedReady
      || (laterLifecycle.planValid && laterLifecycle.ledgerValid && laterLifecycle.nextTaskValid));
  check('platform policy AST successor ratchet is exact green', astGate.status === 'PASS'
    && astGate.privilegedSurfaces === 692 && astGate.exactAllowlistEntries === 692
    && astGate.surfaceCounts?.USE_CASE_COMPOSITION === 333 && astGate.directRoleAuthorizationBypasses === 0);
  check('platform capability successor ratchet is exact green', capabilityGate.status === 'PASS'
    && capabilityGate.capabilitySurfaces === 345 && capabilityGate.exactManifestSurfaces === 345);
  check('root package exposes boundary targeted contract and runtime commands', includesAll(
    JSON.stringify(rootPackage.scripts), [
      'verify:b5-family-emergency-card-portability:boundary',
      'verify:b5-family-emergency-card-portability:targeted',
      'verify:b5-family-emergency-card-portability:contract',
      'verify:b5-family-emergency-card-portability:runtime'
    ]
  ));
  check('pretypecheck and prebuild both enforce the current 33-J boundary', ['pretypecheck', 'prebuild'].every((name) =>
    rootPackage.scripts?.[name]?.includes('verify-family-emergency-card-portability-boundary.mjs')));
  check('inventory exposes exactly three LIFE IPC channels and zero network channels',
    inventory.ipcChannels?.length === 3 && inventory.networkChannels?.length === 0);

  const report = {
    schemaVersion: 1,
    step: '33-J',
    requirements: ids,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checksPassed: checks.length - failures.length,
    checksFailed: failures.length,
    checks,
    failures,
    latestDatabaseMigration: migrationVersions.at(-1),
    migration88Checksum: manifest88?.checksum,
    familyEmergencyCardPortabilityTables:
      (migrations.match(/CREATE TABLE family_emergency_card_portability_ledger/gu) ?? []).length,
    portabilityItemTypes: itemTypes.length,
    ipcChannels: inventory.ipcChannels?.length ?? 0,
    networkChannels: inventory.networkChannels?.length ?? 0,
    ppk021ExactAllowlistEntries: astGate.exactAllowlistEntries,
    ppk021UseCaseCompositionSurfaces: astGate.surfaceCounts?.USE_CASE_COMPOSITION ?? 0,
    ppk022CapabilitySurfaces: capabilityGate.exactManifestSurfaces,
    batteryLevel: scope.power?.batteryLevel,
    automaticLowBatteryDetection: scope.power?.automaticLowBatteryDetection,
    lowBatteryClaimed: scope.power?.lowBatteryClaimed,
    externalDelivery: scope.truth?.externalDelivery,
    networkEgressAdded: scope.truth?.networkEgressAdded,
    generatedAt: new Date().toISOString()
  };
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile(
    'artifacts/validation/33-J-family-emergency-card-portability-boundary.json',
    `${JSON.stringify(report, null, 2)}\n`
  );
  return report;
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const report = await verifyFamilyEmergencyCardPortabilityBoundary();
  if (report.status !== 'PASS') {
    console.error(`Family emergency card portability boundary: FAIL (${report.checksFailed}/${report.checks.length}).`);
    for (const failure of report.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`Family emergency card portability boundary: PASS (${report.checksPassed}/${report.checks.length} checks).`);
}
