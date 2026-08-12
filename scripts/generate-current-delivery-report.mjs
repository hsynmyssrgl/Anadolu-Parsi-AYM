import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const sourceRoot = resolve(process.cwd());
const aymRoot = resolve(sourceRoot, '..', '..');
if (sourceRoot !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${sourceRoot}`);

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const writeVerified = async (path, bytes) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  const readback = await readFile(path);
  if (!readback.equals(bytes)) throw new Error(`Delivery backup readback mismatch: ${path}`);
};
const truth = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const verifyProtection = (script) => {
  const result = spawnSync(process.execPath, [script, 'verify'], { cwd: sourceRoot, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    throw new Error(`Current-source protection freshness verification failed (${script}): ${result.stderr || result.stdout}`);
  }
};
verifyProtection('scripts/protect-authoritative-source.mjs');
verifyProtection('scripts/protect-authoritative-source-external.mjs');

const [contract, release, scope, decisions, audit, capacity, receipt, manifestSummary, completion30Z, completion31A, completion31B, completion31C, completion31D, completion31E, completion33D, completion33E, completion33F, completion33G, completion33H] = await Promise.all([
  readJson(resolve(sourceRoot, 'config', 'delivery-report-contract.json')),
  readJson(resolve(sourceRoot, 'config', 'release-ledger.json')),
  readJson(resolve(sourceRoot, 'config', 'accepted-scope-registry.json')),
  readJson(resolve(sourceRoot, 'config', 'user-decision-ledger.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'inventory', 'BRONZE_CURRENT_COMPLETION_AUDIT.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'validation', 'conversation-capacity.json')),
  readJson(resolve(aymRoot, '05_TEST', '30Z_LOCAL_RECEIPT', 'LATEST.json')),
  readJson(resolve(aymRoot, '00_PROJE', 'MANIFEST_OZETI.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '30-Z_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '31-A_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '31-B_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '31-C_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '31-D_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '31-E_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '33-D_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '33-E_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '33-F_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '33-G_COMPLETION_RECORD.json')),
  readJson(resolve(sourceRoot, 'artifacts', 'checkpoints', '33-H_COMPLETION_RECORD.json'))
]);

if (release.current.status !== 'IN_PROGRESS') throw new Error('Current release must remain IN_PROGRESS.');
if (receipt.externalLibraryReceiptStatus !== 'PASS' || receipt.officialCompletionClaimed !== true
  || receipt.externalReceipt?.storageBackend !== 'EXTERNAL_USB_D_DRIVE'
  || !String(receipt.externalReceipt?.externalPath ?? '').startsWith('D:\\AYM_LIBRARY\\')) {
  throw new Error('Current-source external protection truth boundary mismatch.');
}
const expectedDerivedDeliveryExclusions = [
  'artifacts/deliveries/Anadolu_Parsi_Aile_Yasam_Merkezi_Bronze_04.08.2026.29.json',
  'artifacts/reports/DELIVERY_STATUS_04.08.2026.29.json',
  'artifacts/validation/bronze-governance-reality-matrix.json',
  'artifacts/validation/delivery-report-contract-v2.json'
].sort();
if (JSON.stringify(receipt.excludedDerivedDeliveryFiles) !== JSON.stringify(expectedDerivedDeliveryExclusions)) {
  throw new Error('Current-source protection does not exclude only the exact self-referential delivery outputs.');
}
if (completion31D.status !== 'PASS'
  || completion31D.officialStepStatus !== 'COMPLETED'
  || completion31D.persistentReceiptStatus !== 'PASS'
  || completion31D.officialCompletionClaimed !== true) {
  throw new Error('Focused 31-D external Library receipt truth boundary mismatch.');
}
if (completion31E.status !== 'PASS'
  || completion31E.officialStepStatus !== 'COMPLETED'
  || completion31E.persistentReceiptStatus !== 'PASS'
  || completion31E.officialCompletionClaimed !== true
  || completion31E.storageBackend !== 'EXTERNAL_USB_D_DRIVE') {
  throw new Error('Focused 31-E external Library receipt truth boundary mismatch.');
}
if (completion33D.status !== 'PASS'
  || completion33D.officialStepStatus !== 'COMPLETED'
  || completion33D.persistentReceiptStatus !== 'PASS'
  || completion33D.officialCompletionClaimed !== true
  || completion33D.requirementCompletionClaimed !== true
  || completion33D.storageBackend !== 'EXTERNAL_USB_D_DRIVE'
  || completion33D.externalInventory?.closureSealRequired !== true) {
  throw new Error('Focused 33-D controlled-import external Library receipt truth boundary mismatch.');
}
if (completion33E.status !== 'PASS'
  || completion33E.officialStepStatus !== 'COMPLETED'
  || completion33E.persistentReceiptStatus !== 'PASS'
  || completion33E.officialCompletionClaimed !== true
  || completion33E.requirementCompletionClaimed !== true
  || completion33E.storageBackend !== 'EXTERNAL_USB_D_DRIVE'
  || completion33E.externalInventory?.closureSealRequired !== true
  || completion33E.dataSource !== 'manual'
  || completion33E.externalRegistryLookup !== 'not_performed'
  || completion33E.providerContact !== 'not_performed'
  || completion33E.paymentExecution !== 'not_performed'
  || completion33E.documentContentExposure !== 'not_performed'
  || completion33E.networkEgressAdded !== false) {
  throw new Error('Focused 33-E managed-life external Library receipt truth boundary mismatch.');
}
if (completion33F.status !== 'PASS'
  || completion33F.officialStepStatus !== 'COMPLETED'
  || completion33F.persistentReceiptStatus !== 'PASS'
  || completion33F.officialCompletionClaimed !== true
  || completion33F.requirementCompletionClaimed !== true
  || completion33F.storageBackend !== 'EXTERNAL_USB_D_DRIVE'
  || completion33F.externalInventory?.closureSealRequired !== true
  || completion33F.dataSource !== 'manual'
  || completion33F.smartMeterLookup !== 'not_performed'
  || completion33F.providerContact !== 'not_performed'
  || completion33F.warrantyLookup !== 'not_performed'
  || completion33F.ocr !== 'not_performed'
  || completion33F.paymentExecution !== 'not_performed'
  || completion33F.documentContentExposure !== 'not_performed'
  || completion33F.networkEgressAdded !== false) {
  throw new Error('Focused 33-F home-inventory external Library receipt truth boundary mismatch.');
}
if (completion33G.status !== 'PASS'
  || completion33G.officialStepStatus !== 'COMPLETED'
  || completion33G.persistentReceiptStatus !== 'PASS'
  || completion33G.officialCompletionClaimed !== true
  || completion33G.requirementCompletionClaimed !== true
  || completion33G.storageBackend !== 'EXTERNAL_USB_D_DRIVE'
  || completion33G.externalInventory?.closureSealRequired !== true
  || completion33G.dataSource !== 'manual'
  || completion33G.offlineAvailability !== 'local_only'
  || completion33G.mapLookup !== 'not_performed'
  || completion33G.liveLocation !== 'not_performed'
  || completion33G.messageDelivery !== 'not_performed'
  || completion33G.emergencyServiceContact !== 'not_performed'
  || completion33G.emergencyServiceGuarantee !== 'not_claimed'
  || completion33G.networkEgressAdded !== false) {
  throw new Error('Focused 33-G family-emergency external Library receipt truth boundary mismatch.');
}
if (completion33H.status !== 'PASS'
  || completion33H.officialStepStatus !== 'COMPLETED'
  || completion33H.persistentReceiptStatus !== 'PASS'
  || completion33H.officialCompletionClaimed !== true
  || completion33H.requirementCompletionClaimed !== true
  || completion33H.storageBackend !== 'EXTERNAL_USB_D_DRIVE'
  || completion33H.externalInventory?.closureSealRequired !== true
  || completion33H.dataSource !== 'manual'
  || completion33H.offlineAvailability !== 'local_only'
  || completion33H.barcodeLookup !== 'not_performed'
  || completion33H.expiryVerification !== 'not_performed'
  || completion33H.notificationDelivery !== 'not_performed'
  || completion33H.sensorIntegration !== 'not_performed'
  || completion33H.readinessGuarantee !== 'not_claimed'
  || completion33H.networkEgressAdded !== false) {
  throw new Error('Focused 33-H family-emergency preparedness external Library receipt truth boundary mismatch.');
}
if (completion31B.status !== 'PASS'
  || completion31B.officialStepStatus !== 'COMPLETED'
  || completion31B.persistentReceiptStatus !== 'PASS'
  || completion31B.officialCompletionClaimed !== true) {
  throw new Error('Focused 31-B external Library receipt truth boundary mismatch.');
}
if (completion31C.status !== 'PASS'
  || completion31C.officialStepStatus !== 'COMPLETED'
  || completion31C.persistentReceiptStatus !== 'PASS'
  || completion31C.officialCompletionClaimed !== true) {
  throw new Error('Focused 31-C external Library receipt truth boundary mismatch.');
}
if (completion30Z.status !== 'PASS'
  || completion30Z.officialStepStatus !== 'COMPLETED'
  || completion30Z.persistentReceiptStatus !== 'PASS'
  || completion30Z.officialCompletionClaimed !== true) {
  throw new Error('Frozen 30-Z external Library receipt truth boundary mismatch.');
}
if (completion31A.status !== 'PASS'
  || completion31A.officialStepStatus !== 'COMPLETED'
  || completion31A.persistentReceiptStatus !== 'PASS'
  || completion31A.officialCompletionClaimed !== true) {
  throw new Error('Focused 31-A external Library receipt truth boundary mismatch.');
}
const completedRequirementIds = scope.requirements.filter((item) => item.status === 'COMPLETE').map((item) => item.id);
const completedDecisionIds = decisions.decisions.filter((item) => item.status === 'ACTIVE').map((item) => item.id);
const requiredLifecycleDecisionIds = ['DEC-211', 'DEC-212', 'DEC-213', 'DEC-214', 'DEC-215', 'DEC-216', 'DEC-217', 'DEC-218', 'DEC-219'];
const requiredControlledImportRequirementIds = ['B4-13', 'B4-14'];
const requiredManagedLifeRequirementIds = ['B5-04', 'EXT-031', 'EXT-034'];
const requiredHomeInventoryRequirementIds = ['EXT-030', 'EXT-032'];
const requiredFamilyEmergencyRequirementIds = ['B5-07', 'EXT-009', 'EXT-010', 'EXT-013'];
const requiredFamilyEmergencyPreparednessRequirementIds = ['EXT-011', 'EXT-015'];
const required33DGateScripts = [
  'scripts/verify-b4-controlled-import-open-banking-boundary.mjs',
  'scripts/verify-33-d-b4-controlled-import-open-banking-contract.mjs',
  'scripts/verify-33-d-b4-controlled-import-open-banking-runtime.mjs',
  'scripts/verify-33-d-controlled-import-open-banking-completion.mjs'
];
const required33EGateScripts = [
  'scripts/verify-b5-category-life-home-vehicle-boundary.mjs',
  'scripts/verify-33-e-b5-category-life-home-vehicle-contract.mjs',
  'scripts/verify-33-e-b5-category-life-home-vehicle-runtime.mjs',
  'scripts/verify-33-e-b5-category-life-home-vehicle-completion.mjs'
];
const required33FGateScripts = [
  'scripts/verify-home-inventory-utility-belongings-boundary.mjs',
  'scripts/verify-33-f-home-inventory-utility-belongings-contract.mjs',
  'scripts/verify-33-f-home-inventory-utility-belongings-runtime.mjs',
  'scripts/verify-33-f-home-inventory-utility-belongings-completion.mjs'
];
const required33GGateScripts = [
  'scripts/verify-family-emergency-planning-boundary.mjs',
  'scripts/verify-33-g-family-emergency-planning-contract.mjs',
  'scripts/verify-33-g-family-emergency-planning-runtime.mjs',
  'scripts/verify-33-g-family-emergency-planning-completion.mjs'
];
const required33HGateScripts = [
  'scripts/verify-family-emergency-preparedness-boundary.mjs',
  'scripts/verify-33-h-family-emergency-preparedness-contract.mjs',
  'scripts/verify-33-h-family-emergency-preparedness-runtime.mjs',
  'scripts/verify-33-h-family-emergency-preparedness-completion.mjs'
];
if (!requiredLifecycleDecisionIds.every((id) => completedDecisionIds.includes(id))) {
  throw new Error('Current delivery report requires active DEC-211 through DEC-219 decisions.');
}
if (!requiredControlledImportRequirementIds.every((id) => completedRequirementIds.includes(id))) {
  throw new Error('Current delivery report requires B4-13 and B4-14 COMPLETE.');
}
if (!requiredManagedLifeRequirementIds.every((id) => completedRequirementIds.includes(id))) {
  throw new Error('Current delivery report requires B5-04, EXT-031 and EXT-034 COMPLETE.');
}
if (!requiredHomeInventoryRequirementIds.every((id) => completedRequirementIds.includes(id))) {
  throw new Error('Current delivery report requires EXT-030 and EXT-032 COMPLETE.');
}
if (!requiredFamilyEmergencyRequirementIds.every((id) => completedRequirementIds.includes(id))) {
  throw new Error('Current delivery report requires B5-07, EXT-009, EXT-010 and EXT-013 COMPLETE.');
}
if (!requiredFamilyEmergencyPreparednessRequirementIds.every((id) => completedRequirementIds.includes(id))) {
  throw new Error('Current delivery report requires EXT-011 and EXT-015 COMPLETE.');
}
if (!required33DGateScripts.every((script) => audit.gates.current
  .some((gate) => gate.script === script && gate.status === 'PASS'))) {
  throw new Error('Current delivery report requires the 33-D boundary, contract and runtime PASS chain.');
}
if (!required33EGateScripts.every((script) => audit.gates.current
  .some((gate) => gate.script === script && gate.status === 'PASS'))) {
  throw new Error('Current delivery report requires the 33-E boundary, contract, runtime and completion PASS chain.');
}
if (!required33FGateScripts.every((script) => audit.gates.current
  .some((gate) => gate.script === script && gate.status === 'PASS'))) {
  throw new Error('Current delivery report requires the 33-F boundary, contract, runtime and completion PASS chain.');
}
if (!required33GGateScripts.every((script) => audit.gates.current
  .some((gate) => gate.script === script && gate.status === 'PASS'))) {
  throw new Error('Current delivery report requires the 33-G boundary, contract, runtime and completion PASS chain.');
}
if (!required33HGateScripts.every((script) => audit.gates.current
  .some((gate) => gate.script === script && gate.status === 'PASS'))) {
  throw new Error('Current delivery report requires the 33-H boundary, contract, runtime and completion PASS chain.');
}
const validationResults = [
  ...audit.gates.current.map((gate) => ({ name: gate.script, actualStatus: gate.status, reportedAs: gate.status })),
  { name: 'B2-01 native interactive Windows Hello', actualStatus: 'USER_DEFERRED_NOT_RUN', reportedAs: 'USER_DEFERRED_NOT_RUN', classification: 'NON_BLOCKING_HARDWARE_VALIDATION_DEC_162' },
  { name: 'Frozen 30-Z external persistent USB Library receipt', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Focused 31-A external persistent USB Library receipt', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Focused 31-B external persistent USB Library receipt', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Focused 31-C external persistent USB Library receipt', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Focused 31-D external persistent USB Library receipt', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Focused 31-E external persistent USB Library receipt', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Focused 33-D controlled-import external persistent USB Library receipt', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Focused 33-E managed-life external persistent USB Library receipt', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Focused 33-F home-inventory external persistent USB Library receipt', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Focused 33-G family-emergency external persistent USB Library receipt', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Focused 33-H family-emergency preparedness external persistent USB Library receipt', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Current authoritative source external protection', actualStatus: 'PASS', reportedAs: 'PASS' },
  { name: 'Historical 29-D5 verifier', actualStatus: audit.gates.historical29D5.status, reportedAs: audit.gates.historical29D5.status, classification: 'HISTORICAL_ONLY' }
];
const nextTask = audit.remainingWork.find((item) => item.id !== 'GOV-004' && item.completionBlockers?.length === 0)
  ?? audit.remainingWork.find((item) => item.id !== 'GOV-004')
  ?? null;

const report = {
  schemaVersion: 2,
  id: `DELIVERY-STATUS-${release.current.version}`,
  generatedAt: new Date().toISOString(),
  visibleRelease: release.current.visibleRelease,
  userVisibleDeliveryFileName: `Anadolu_Parsi_Aile_Yasam_Merkezi_${release.current.visibleRelease.replaceAll(' ', '_')}.json`,
  releaseStatus: 'IN_PROGRESS',
  workCompleted: [
    'DEC-152 single authoritative source, local receipt and incremental governance binding',
    'DEC-153 B0-01 governance and feature-reality matrix closure',
    'DEC-154 GOV-004 current delivery report closure'
    ,'DEC-158 frozen 30-Z external USB Library receipt and official checkpoint completion',
    'DEC-159 focused 31-A timeline-event Policy Enforcement checkpoint completion',
    'DEC-160 focused 31-B family data import central authorization checkpoint completion',
    'DEC-161 focused 31-C family import multi-policy receipt atomic batch checkpoint completion'
    ,'DEC-162 Windows Hello hardware validation temporary non-blocking deferral'
    ,'DEC-163 focused 31-D reused-location exact read receipt checkpoint completion'
    ,'DEC-164 current authoritative source D: USB protection closure'
    ,'DEC-165 B0-02 public release DTO, UI and canonical delivery filename boundary closure'
    ,'DEC-211 B4-01/B4-02/B4-03/B4-04/B4-07 banking foundation closure'
    ,'DEC-212 B4-05/B4-06 last-four-only payment card management closure'
    ,'DEC-213 B4-08/B4-09 manual and non-executing loan management closure'
    ,'DEC-214 B4-10/B4-11/B4-12 finance planning, portfolio and per-currency analytics closure'
    ,'DEC-215 B4-13/B4-14 controlled import and network-free OHVPS adapter closure'
    ,'DEC-216 B5-04/EXT-031/EXT-034 category-specific life, home and vehicle workflow closure'
    ,'DEC-217 EXT-030/EXT-032 home spaces, utility consumption, belongings, warranty and service closure'
    ,'DEC-218 B5-07/EXT-009/EXT-010/EXT-013 offline family emergency planning closure'
    ,'DEC-219 EXT-011/EXT-015 offline family emergency preparedness kits and drills closure'
  ],
  completedRequirementIds,
  completedDecisionIds,
  changedSourceAreas: [
    'config/accepted-scope-registry.json',
    'config/user-decision-ledger.json',
    'config/bronze-current-audit-policy.json',
    'config/work-segmentation-plan.json',
    'config/32-z-b4-banking-foundation-scope.json',
    'config/33-a-b4-payment-card-management-scope.json',
    'config/33-b-b4-loan-management-scope.json',
    'config/33-c-b4-finance-planning-portfolio-analytics-scope.json',
    'config/33-d-b4-controlled-import-open-banking-scope.json',
    'config/33-d-b4-controlled-import-open-banking-inventory.json',
    'config/33-e-b5-category-life-home-vehicle-scope.json',
    'config/33-e-b5-category-life-home-vehicle-inventory.json',
    'config/33-f-home-inventory-utility-belongings-scope.json',
    'config/33-f-home-inventory-utility-belongings-inventory.json',
    'config/33-g-family-emergency-planning-scope.json',
    'config/33-g-family-emergency-planning-inventory.json',
    'config/33-h-family-emergency-preparedness-scope.json',
    'config/33-h-family-emergency-preparedness-inventory.json',
    'docs/decisions/DEC-152..DEC-154',
    'docs/decisions/DEC-211-b4-banking-foundation.md',
    'docs/decisions/DEC-212-b4-payment-card-management.md',
    'docs/decisions/DEC-213-b4-loan-management.md',
    'docs/decisions/DEC-214-b4-finance-planning-portfolio-analytics.md',
    'docs/decisions/DEC-215-b4-controlled-import-open-banking.md',
    'docs/decisions/DEC-216-b5-category-life-home-vehicle.md',
    'docs/decisions/DEC-217-home-inventory-utility-belongings.md',
    'docs/decisions/DEC-218-family-emergency-planning.md',
    'docs/decisions/DEC-219-family-emergency-preparedness-kits-and-drills.md',
    'docs/security/THREAT_MODEL_33_D_B4_CONTROLLED_IMPORT_OPEN_BANKING.md',
    'docs/security/THREAT_MODEL_33_E_B5_CATEGORY_LIFE_HOME_VEHICLE.md',
    'docs/security/THREAT_MODEL_33_F_HOME_INVENTORY_UTILITY_BELONGINGS.md',
    'docs/security/THREAT_MODEL_33_G_FAMILY_EMERGENCY_PLANNING.md',
    'docs/security/THREAT_MODEL_33_H_FAMILY_EMERGENCY_PREPAREDNESS.md',
    'docs/audit/33-D_B4_CONTROLLED_IMPORT_OPEN_BANKING_UST_KAPANIS.md',
    'docs/audit/33-E_B5_CATEGORY_LIFE_HOME_VEHICLE_UST_KAPANIS.md',
    'docs/audit/33-F_HOME_INVENTORY_UTILITY_BELONGINGS_UST_KAPANIS.md',
    'docs/audit/33-G_FAMILY_EMERGENCY_PLANNING_UST_KAPANIS.md',
    'docs/audit/33-H_FAMILY_EMERGENCY_PREPAREDNESS_UST_KAPANIS.md',
    'packages/domain/src/app-data.ts',
    'packages/application/src/finance-use-cases.ts',
    'packages/application/src/life-use-cases.ts',
    'packages/application/src/life-security.ts',
    'packages/database/src/family-database-migrations.ts',
    'packages/repository-contracts/src/finance-repository.ts',
    'packages/repository-contracts/src/life-repository.ts',
    'packages/repositories/src/finance-repository.ts',
    'packages/repositories/src/life-repository.ts',
    'packages/repositories/src/ai-consent-repository.ts',
    'packages/repositories/src/person-lifecycle-repository.ts',
    'apps/desktop/src/main/finance-import-file-session.ts',
    'apps/desktop/src/main/finance-application-adapter.ts',
    'apps/desktop/src/main/life-application-adapter.ts',
    'apps/desktop/src/main/life-production-policy-runtime.ts',
    'apps/desktop/src/main/data-store.ts',
    'apps/desktop/src/main/main.ts',
    'apps/desktop/src/main/ipc-integration-policy.ts',
    'apps/desktop/src/main/preload.ts',
    'apps/desktop/src/renderer/FinanceImportPanel.tsx',
    'apps/desktop/src/renderer/ManagedLifePanel.tsx',
    'packages/application/tests/finance-controlled-import-open-banking.test.ts',
    'apps/desktop/tests/b4-finance-import-ipc-integration.test.ts',
    'apps/desktop/tests/finance-import-file-session.test.ts',
    'packages/application/tests/managed-life-assets.test.ts',
    'packages/repositories/managed-life-repository-policy.test.ts',
    'apps/desktop/tests/b5-managed-life-ipc-integration.test.ts',
    'packages/application/tests/family-emergency-planning.test.ts',
    'packages/repositories/family-emergency-repository-policy.test.ts',
    'apps/desktop/tests/b5-family-emergency-ipc-integration.test.ts',
    'packages/application/tests/family-emergency-preparedness.test.ts',
    'packages/repositories/family-emergency-preparedness-repository-policy.test.ts',
    'apps/desktop/tests/b5-family-emergency-preparedness-ipc-integration.test.ts',
    'artifacts/validation/33-D-b4-controlled-import-open-banking-boundary.json',
    'artifacts/validation/33-D-b4-controlled-import-open-banking-contract.json',
    'artifacts/validation/33-D-b4-controlled-import-open-banking-runtime.json',
    'scripts/finalize-33-d-controlled-import-open-banking-external-receipt.mjs',
    'scripts/verify-33-d-controlled-import-open-banking-completion.mjs',
    'artifacts/validation/33-E-b5-category-life-home-vehicle-boundary.json',
    'artifacts/validation/33-E-b5-category-life-home-vehicle-contract.json',
    'artifacts/validation/33-E-b5-category-life-home-vehicle-runtime.json',
    'scripts/finalize-33-e-b5-category-life-home-vehicle-external-receipt.mjs',
    'scripts/verify-33-e-b5-category-life-home-vehicle-completion.mjs',
    'artifacts/validation/33-F-home-inventory-utility-belongings-boundary.json',
    'artifacts/validation/33-F-home-inventory-utility-belongings-contract.json',
    'artifacts/validation/33-F-home-inventory-utility-belongings-runtime.json',
    'scripts/finalize-33-f-home-inventory-utility-belongings-external-receipt.mjs',
    'scripts/verify-33-f-home-inventory-utility-belongings-completion.mjs',
    'artifacts/validation/33-G-family-emergency-planning-boundary.json',
    'artifacts/validation/33-G-family-emergency-planning-contract.json',
    'artifacts/validation/33-G-family-emergency-planning-runtime.json',
    'scripts/finalize-33-g-family-emergency-planning-external-receipt.mjs',
    'scripts/verify-33-g-family-emergency-planning-completion.mjs',
    'artifacts/validation/33-H-family-emergency-preparedness-boundary.json',
    'artifacts/validation/33-H-family-emergency-preparedness-contract.json',
    'artifacts/validation/33-H-family-emergency-preparedness-runtime.json',
    'scripts/finalize-33-h-family-emergency-preparedness-external-receipt.mjs',
    'scripts/verify-33-h-family-emergency-preparedness-completion.mjs',
    'artifacts/checkpoints/33-D_LIBRARY_RECEIPT.json',
    'artifacts/checkpoints/33-D_COMPLETION_RECORD.json',
    'artifacts/validation/33-D_LIBRARY_CLOSURE_INVENTORY_VERIFICATION.json',
    'artifacts/checkpoints/33-E_LIBRARY_RECEIPT.json',
    'artifacts/checkpoints/33-E_COMPLETION_RECORD.json',
    'artifacts/validation/33-E_LIBRARY_CLOSURE_INVENTORY_VERIFICATION.json',
    'artifacts/checkpoints/33-F_LIBRARY_RECEIPT.json',
    'artifacts/checkpoints/33-F_COMPLETION_RECORD.json',
    'artifacts/validation/33-F_LIBRARY_CLOSURE_INVENTORY_VERIFICATION.json',
    'artifacts/checkpoints/33-G_LIBRARY_RECEIPT.json',
    'artifacts/checkpoints/33-G_COMPLETION_RECORD.json',
    'artifacts/validation/33-G_LIBRARY_CLOSURE_INVENTORY_VERIFICATION.json',
    'artifacts/checkpoints/33-H_LIBRARY_RECEIPT.json',
    'artifacts/checkpoints/33-H_COMPLETION_RECORD.json',
    'artifacts/validation/33-H_LIBRARY_CLOSURE_INVENTORY_VERIFICATION.json',
    'scripts/protect-authoritative-source.mjs',
    'scripts/protect-authoritative-source-external.mjs',
    'scripts/audit-bronze-current-state.mjs',
    'scripts/update-aym-governance-incrementally.mjs',
    'scripts/generate-current-delivery-report.mjs',
    'scripts/finalize-30-z-external-library-receipt.mjs',
    'artifacts/checkpoints/30-Z_LIBRARY_RECEIPT.json',
    'artifacts/checkpoints/31-A_LIBRARY_RECEIPT.json',
    'artifacts/checkpoints/31-B_LIBRARY_RECEIPT.json',
    'artifacts/checkpoints/31-C_LIBRARY_RECEIPT.json',
    'artifacts/checkpoints/31-D_LIBRARY_RECEIPT.json',
    'artifacts/checkpoints/31-E_LIBRARY_RECEIPT.json',
    'artifacts/deliveries/Anadolu_Parsi_Aile_Yasam_Merkezi_Bronze_04.08.2026.29.json',
    'artifacts/reports/DELIVERY_STATUS_04.08.2026.29.json'
  ],
  validationResults,
  openErrorsAndRisks: [
    'B2-01 is complete under DEC-162 with runtime code and password fallback preserved; native interactive Windows Hello remains USER_DEFERRED_NOT_RUN_NOT_PASS and no native PASS is claimed.',
    'Current authoritative C: source tree has a distinct D: external USB protection receipt.',
    `${audit.scope.incompleteCount} accepted requirements remain open after this report input audit.`,
    'Silver and Gold remain blocked.'
  ],
  bronzeCompletionPercent: audit.percentages.officialWeightedBronzePercent,
  bronzeRemainingPercent: Number((100 - audit.percentages.officialWeightedBronzePercent).toFixed(4)),
  strictRequirementCompletionPercent: audit.percentages.strictRequirementCompletionPercent,
  implementationChainCoveragePercent: audit.percentages.implementationChainCoveragePercent,
  governanceEvidenceChainCoveragePercent: audit.percentages.governanceEvidenceChainCoveragePercent,
  estimatedBronzeCompletion: {
    status: 'UNAVAILABLE_INSUFFICIENT_GOVERNED_VELOCITY_SERIES',
    confidence: 'LOW',
    reason: 'No current governed multi-sample completion velocity series supports a defensible calendar ETA.'
  },
  estimatedSilverTransition: { status: 'BLOCKED_NOT_READY', prerequisite: 'All Bronze P0/P1 scope complete plus mandatory Windows/UAT/security gates.' },
  estimatedGoldTransition: { status: 'BLOCKED_NOT_READY', prerequisite: 'All Silver gates PASS plus production operations readiness and explicit product-owner approval.' },
  estimateConfidence: 'LOW_INSUFFICIENT_GOVERNED_VELOCITY_SERIES',
  conversationCapacity: capacity,
  handoffPromptStatus: capacity.handoff ?? 'NOT_REQUIRED_WITHOUT_ACTUAL_HARD_STOP',
  sourceArchive: receipt.backup.path,
  sourceSha256: receipt.treeSha256,
  deliveryBackupRoots: {
    local: `C:\\PPT\\AYM\\09_ARSIV\\TESLIM_RAPORLARI\\${release.current.visibleRelease}`,
    external: `D:\\AYM_LIBRARY\\Panthera pardus tulliana\\Anadolu Parsı Aile Yaşam Merkezi\\${release.current.visibleRelease}\\deliveries`,
    latestReceipt: 'LATEST_33-H.json'
  },
  sourceReceiptBoundary: 'The focused official 30-Z through 31-E checkpoints, the official 33-D controlled-import closure, the official 33-E managed-life closure, the official 33-F home-inventory closure, the historical official 33-G family-emergency planning closure, the current official 33-H family-emergency preparedness closure, and the current editable C: source tree are independently externally bound on D:. The delivery report files are derived outputs excluded from the source hash to prevent self-reference.',
  manifest: '00_PROJE/MASTER_MANIFEST.json',
  manifestSummary: {
    path: '00_PROJE/MANIFEST_OZETI.json',
    updateMode: manifestSummary.updateMode,
    liveFileCount: manifestSummary.liveFileCount
  },
  persistentLibraryPath: completion33H.libraryPath,
  persistentLibraryUploadStatus: 'PASS',
  completeDocumentIndex: 'artifacts/manifests/ALL_DOCUMENTS_INDEX.json',
  nextOfficialTask: nextTask,
  official30ZCompletionClaimed: true,
  official31ACompletionClaimed: true,
  official31BCompletionClaimed: true,
  official31CCompletionClaimed: true,
  official31DCompletionClaimed: true,
  official31ECompletionClaimed: true,
  official33DCompletionClaimed: true,
  official33ECompletionClaimed: true,
  official33FCompletionClaimed: true,
  official33GCompletionClaimed: true,
  official33HCompletionClaimed: true,
  currentSourceExternalProtectionStatus: 'PASS',
  currentSourceExternalProtectionVerification: 'LIVE_LOCAL_TREE_AND_EXTERNAL_D_READBACK_PASS',
  sourceProtectionExcludedDerivedFiles: receipt.excludedDerivedDeliveryFiles,
  newBuildAssigned: false,
  mandatoryTruthSentence: truth
};

for (const field of contract.requiredFields) {
  if (!Object.hasOwn(report, field)) throw new Error(`Generated report missing contract field: ${field}`);
}
const target = resolve(sourceRoot, 'artifacts', 'reports', `DELIVERY_STATUS_${release.current.version}.json`);
await mkdir(dirname(target), { recursive: true });
const content = `${JSON.stringify(report, null, 2)}\n`;
await writeFile(target, content, 'utf8');
if (await readFile(target, 'utf8') !== content) throw new Error('Delivery report readback mismatch.');
if (/\b(?:RC2?|MVP|Build)\b/iu.test(report.userVisibleDeliveryFileName)) {
  throw new Error(`User-visible delivery filename leaks an internal release token: ${report.userVisibleDeliveryFileName}`);
}
const userVisibleTarget = resolve(sourceRoot, 'artifacts', 'deliveries', report.userVisibleDeliveryFileName);
await mkdir(dirname(userVisibleTarget), { recursive: true });
await writeFile(userVisibleTarget, content, 'utf8');
if (await readFile(userVisibleTarget, 'utf8') !== content) throw new Error('User-visible delivery report readback mismatch.');
const contentBytes = Buffer.from(content, 'utf8');
const reportSha256 = sha256(contentBytes);
const localDeliveryRoot = resolve(report.deliveryBackupRoots.local);
const externalDeliveryRoot = resolve(report.deliveryBackupRoots.external);
const immutableFolder = reportSha256;
const reportFiles = [
  `DELIVERY_STATUS_${release.current.version}.json`,
  report.userVisibleDeliveryFileName
];
for (const root of [localDeliveryRoot, externalDeliveryRoot]) {
  for (const name of reportFiles) {
    await writeVerified(resolve(root, immutableFolder, name), contentBytes);
    await writeVerified(resolve(root, immutableFolder, `${name}.sha256`), Buffer.from(`${reportSha256}  ${name}\n`, 'ascii'));
  }
}
const backupReceipt = {
  schemaVersion: 1,
  id: `DELIVERY-REPORT-BACKUP-${reportSha256}`,
  release: release.current.visibleRelease,
  step: '33-H',
  status: 'PASS',
  sourceTreeSha256: receipt.treeSha256,
  reportSha256,
  immutableFolder,
  files: reportFiles.map((path) => ({ path, sizeBytes: contentBytes.length, sha256: reportSha256 })),
  localRoot: localDeliveryRoot,
  externalRoot: externalDeliveryRoot,
  verificationBasis: 'EXACT_BYTES_SHA256_AND_SIDECAR_READBACK',
  recordedAt: report.generatedAt,
  mandatoryTruthSentence: truth
};
const backupReceiptBytes = Buffer.from(`${JSON.stringify(backupReceipt, null, 2)}\n`, 'utf8');
const backupReceiptSha256 = sha256(backupReceiptBytes);
for (const root of [localDeliveryRoot, externalDeliveryRoot]) {
  const receiptPath = resolve(root, immutableFolder, 'DELIVERY_REPORT_BACKUP_RECEIPT.json');
  await writeVerified(receiptPath, backupReceiptBytes);
  await writeVerified(`${receiptPath}.sha256`, Buffer.from(`${backupReceiptSha256}  DELIVERY_REPORT_BACKUP_RECEIPT.json\n`, 'ascii'));
  await writeVerified(resolve(root, 'LATEST_33-H.json'), backupReceiptBytes);
  await writeVerified(resolve(root, 'LATEST_33-H.json.sha256'), Buffer.from(`${backupReceiptSha256}  LATEST_33-H.json\n`, 'ascii'));
  const exact = (await readdir(resolve(root, immutableFolder))).sort();
  const expected = [
    ...reportFiles.flatMap((name) => [name, `${name}.sha256`]),
    'DELIVERY_REPORT_BACKUP_RECEIPT.json',
    'DELIVERY_REPORT_BACKUP_RECEIPT.json.sha256'
  ].sort();
  if (JSON.stringify(exact) !== JSON.stringify(expected)) throw new Error(`Delivery backup exact-set mismatch: ${root}`);
}
for (const name of [
  ...reportFiles.flatMap((path) => [path, `${path}.sha256`]),
  'DELIVERY_REPORT_BACKUP_RECEIPT.json',
  'DELIVERY_REPORT_BACKUP_RECEIPT.json.sha256'
]) {
  const local = await readFile(resolve(localDeliveryRoot, immutableFolder, name));
  const external = await readFile(resolve(externalDeliveryRoot, immutableFolder, name));
  if (local.length !== external.length || sha256(local) !== sha256(external)) throw new Error(`Delivery local/D: backup mismatch: ${name}`);
}
console.log(`Current delivery report: PASS (${contract.requiredFields.length} required fields; 30-Z through 31-E plus 33-D, 33-E, 33-F, historical 33-G and current 33-H receipts PASS; live current-source external protection PASS on D:; delivery backup ${reportSha256}; new Build false).`);
