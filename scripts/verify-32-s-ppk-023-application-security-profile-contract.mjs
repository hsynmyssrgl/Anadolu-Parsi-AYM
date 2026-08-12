import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { runApplicationSecurityProfileGate } from './verify-application-security-profile-gate.mjs';
import { runPlatformCapabilityManifestGate } from './verify-platform-capability-manifest-gate.mjs';
import { runPlatformPolicyAstGate } from './verify-platform-policy-ast-gate.mjs';

const candidateMode = process.argv.includes('--candidate');
const readText = (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const [
  scope, inventory, manifest, registry, ledger, rootPackage, policy, policyIndex,
  domain, domainIndex, useCase, applicationIndex, desktopMain, preload, globalTypes,
  renderer, ipcPolicy, ipcSharing, profileTest, gateTest, integrationTest, gateScript,
  combinedGate, decision, threatModel, audit, masterRegister, migrations
] = await Promise.all([
  readJson('config/32-s-ppk-023-application-security-profile-gate-scope.json'),
  readJson('config/32-s-ppk-023-application-security-profile-gate-inventory.json'),
  readJson('config/32-s-ppk-023-application-security-profile-manifest.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/user-decision-ledger.json'),
  readJson('package.json'),
  readText('packages/platform-policy/src/application-security-profile-policy.ts'),
  readText('packages/platform-policy/src/index.ts'),
  readText('packages/domain/src/application-security-profile-gate.ts'),
  readText('packages/domain/src/index.ts'),
  readText('packages/application/src/application-security-profile-gate-use-cases.ts'),
  readText('packages/application/src/index.ts'),
  readText('apps/desktop/src/main/main.ts'),
  readText('apps/desktop/src/main/preload.ts'),
  readText('apps/desktop/src/renderer/global.d.ts'),
  readText('apps/desktop/src/renderer/App.tsx'),
  readText('apps/desktop/src/main/ipc-integration-policy.ts'),
  readText('apps/desktop/src/main/ipc-read-sharing.ts'),
  readText('packages/platform-policy/application-security-profile-policy.test.ts'),
  readText('apps/desktop/tests/ppk023-application-security-profile-gate.test.ts'),
  readText('apps/desktop/tests/ppk023-application-security-profile-integration.test.ts'),
  readText('scripts/verify-application-security-profile-gate.mjs'),
  readText('scripts/verify-platform-policy-gate.mjs'),
  readText('docs/decisions/DEC-204-ppk-023-application-security-profile-gate.md'),
  readText('docs/security/PPK-023_APPLICATION_SECURITY_PROFILES_THREAT_MODEL.md'),
  readText('docs/audit/32-S_PPK-023_UYGULAMA_GUVENLIK_PROFILI_UST_KAPANIS.md'),
  readText('docs/10_MASTER_DECISION_REGISTER.md'),
  readText('packages/database/src/family-database-migrations.ts')
]);

const [gate, astGate, capabilityGate] = await Promise.all([
  runApplicationSecurityProfileGate(),
  runPlatformPolicyAstGate(),
  runPlatformCapabilityManifestGate()
]);
const failures = [];
const checks = [];
const check = (name, condition) => {
  checks.push({ name, passed: Boolean(condition) });
  if (!condition) failures.push(name);
};
const requirement = registry.requirements.find((item) => item.id === 'PPK-023');
const predecessors = Array.from({ length: 11 }, (_, index) => `PPK-${String(index + 12).padStart(3, '0')}`)
  .map((id) => registry.requirements.find((item) => item.id === id));
const successor = registry.requirements.find((item) => item.id === 'PPK-024');
const versions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)].map((match) => Number.parseInt(match[1], 10));
const latestMigration = Math.max(...versions);
const applications = [
  'windows-desktop', 'windows-core-service', 'windows-cluster-agent', 'macos-companion',
  'ios-companion', 'ipados-companion', 'watchos-companion', 'visionos-companion',
  'ocr-worker', 'ai-worker', 'translation-worker', 'communication-service', 'backup-worker', 'signed-plugin'
];
const mobileApplications = ['ios-companion', 'ipados-companion', 'watchos-companion', 'visionos-companion'];
const profileIds = manifest.profiles?.map((item) => item.applicationId) ?? [];
const threatHash = sha256(Buffer.from(threatModel, 'utf8'));
const exactThreatSections = applications.map((id) => `## APP-THREAT-${id}`);
const threatSectionCount = [...threatModel.matchAll(/^## APP-THREAT-/gmu)].length;
const policyExportCount = (policyIndex.match(/application-security-profile-policy\.js/gu) ?? []).length;

check('scope identity is exact', scope.step === '32-S' && scope.requirement === 'PPK-023');
check('inventory identity is exact', inventory.step === '32-S' && inventory.requirement === 'PPK-023');
check('accepted registry contains PPK-023', requirement !== undefined);
check('PPK-012 through PPK-022 remain complete', predecessors.every((item) => item?.status === 'COMPLETE'));
check('PPK-024 remains a distinct successor requirement', successor !== undefined && successor.id !== scope.requirement);
check('DEC-204 is active and ledger count is exact', ledger.decisionCount === ledger.decisions.length && ledger.decisions.some((item) => item.id === 'DEC-204' && item.status === 'ACTIVE' && item.requirements?.includes('PPK-023')));
check('master decision register contains DEC-204', masterRegister.includes('## DEC-204') && masterRegister.includes('DEC-204-ppk-023-application-security-profile-gate.md'));

check('application profile production gate passes', gate.status === 'PASS' && gate.findings.length === 0);
check('gate maps all fourteen canonical applications', gate.canonicalApplications === 14 && gate.mappedApplications === 14);
check('gate owns both current application workspaces', gate.applicationWorkspaces === 2);
check('gate validates fourteen threat models', gate.threatModels === 14);
check('gate pins exact standard cardinalities', gate.asvsControls === 21 && gate.masvsControls === 24 && gate.ssdfPractices === 19);
check('gate runs malicious and benign self tests', gate.maliciousSelfTestAssertions === 17 && gate.benignSelfTestAssertions === 4);
check('gate denies compliance and profile-only native claims', gate.complianceClaimed === false && gate.nativeRuntimeValidationClaimedForProfileOnlyTargets === false);
check('gate hashes bind manifest and threat model', gate.manifestSha256 === manifest.manifestSha256 && gate.manifestSha256 === inventory.engine?.manifestSha256 && gate.threatModelSha256 === threatHash && gate.threatModelSha256 === inventory.engine?.threatModelSha256);

check('manifest is exact default deny', manifest.schemaVersion === 1 && manifest.gateVersion === 'PPK-023-V1' && manifest.defaultDecision === 'DENY');
check('manifest makes no certification claim', manifest.mappingState === 'REQUIREMENTS_MAPPED_NOT_CERTIFIED' && manifest.complianceClaimed === false);
check('manifest pins ASVS 5.0.0 stable', manifest.standards?.asvs?.version === '5.0.0' && manifest.standards.asvs.publicationState === 'STABLE' && manifest.standards.asvs.controlIds.length === 21);
check('manifest pins MASVS 2.1.0 stable', manifest.standards?.masvs?.version === '2.1.0' && manifest.standards.masvs.publicationState === 'STABLE' && manifest.standards.masvs.controlIds.length === 24);
check('manifest pins final SSDF 1.1', manifest.standards?.ssdf?.version === '1.1' && manifest.standards.ssdf.publicationState === 'FINAL' && manifest.standards.ssdf.controlIds.length === 19);
check('manifest uses authoritative standard sources', manifest.standards.asvs.officialSource.startsWith('https://owasp.org/') && manifest.standards.masvs.officialSource.startsWith('https://mas.owasp.org/') && manifest.standards.ssdf.officialSource === 'https://csrc.nist.gov/pubs/sp/800/218/final');
check('manifest contains fourteen unique exact profiles', profileIds.length === 14 && new Set(profileIds).size === 14 && applications.every((id) => profileIds.includes(id)));
check('manifest has exactly two assurance profiles', manifest.assuranceProfiles?.length === 2 && new Set(manifest.assuranceProfiles.map((item) => item.id)).size === 2);
check('four mobile profiles use full MASVS mapping', manifest.profiles.filter((item) => mobileApplications.includes(item.applicationId)).every((item) => item.assuranceProfileId === 'MOBILE_COMPANION'));
check('non-mobile assurance has bounded N/A rationale', manifest.assuranceProfiles.find((item) => item.id === 'GENERAL_APPLICATION')?.masvs?.applicability === 'NOT_APPLICABLE' && manifest.assuranceProfiles.find((item) => item.id === 'GENERAL_APPLICATION')?.masvs?.notApplicableReason?.length > 20);
check('profile-only targets never claim native validation', manifest.profiles.filter((item) => item.nativeRuntimeExecution === 'PROFILE_ONLY').length === 12 && manifest.profiles.filter((item) => item.nativeRuntimeExecution === 'PROFILE_ONLY').every((item) => item.nativeRuntimeValidated === false));
check('only current deployed targets claim current validation', manifest.profiles.filter((item) => item.nativeRuntimeValidated).map((item) => item.applicationId).sort().join('|') === 'windows-core-service|windows-desktop');
check('workspace owners are exact', JSON.stringify(manifest.workspaceOwners) === JSON.stringify([{ path: 'apps/core-service', applicationId: 'windows-core-service' }, { path: 'apps/desktop', applicationId: 'windows-desktop' }]));

check('threat document hash is exact', manifest.threatModelDocument?.sha256 === threatHash && manifest.threatModelDocument.modelCount === 14);
check('threat document has exactly fourteen application sections', threatSectionCount === 14 && exactThreatSections.every((marker) => threatModel.includes(marker)));
check('each threat section has six required fields', exactThreatSections.every((marker, index) => {
  const start = threatModel.indexOf(marker);
  const end = index === exactThreatSections.length - 1 ? threatModel.length : threatModel.indexOf(exactThreatSections[index + 1]);
  const segment = threatModel.slice(start, end);
  return ['Korunan varlıklar:', 'Güven sınırları:', 'Giriş yüzeyleri:', 'Kötüye kullanım vakaları:', 'Zorunlu kontroller:', 'Kalan riskler:'].every((field) => segment.includes(field));
}));
check('threat model preserves no-certification truth', includesAll(threatModel, ['uygunluk sertifikası', 'native runtime doğrulaması değildir', 'çalışma yetkisi vermez']));

check('policy pins all three standard versions', includesAll(policy, ['APPLICATION_SECURITY_STANDARD_VERSIONS', "asvs: '5.0.0'", "masvs: '2.1.0'", "ssdf: '1.1'"]));
check('policy pins exact control sets', includesAll(policy, ['APPLICATION_SECURITY_ASVS_BASELINE_CONTROLS', 'APPLICATION_SECURITY_MASVS_MOBILE_CONTROLS', 'APPLICATION_SECURITY_SSDF_BASELINE_PRACTICES']));
check('policy canonicalizes and verifies manifest hash', includesAll(policy, ['applicationSecurityProfileManifestHash', 'MANIFEST_HASH_MISMATCH', 'hasValidDeclaredHash']));
check('policy fails closed for unknown malformed and incomplete mappings', includesAll(policy, ['APPLICATION_UNKNOWN', 'MALFORMED_MANIFEST', 'MAPPING_INCOMPLETE', "defaultDecision: 'DENY'"]));
check('policy snapshot denies runtime and compliance inference', includesAll(policy, ['mappingClaimsCompliance: false', 'nativeRuntimeValidationClaimed: false', "enforcement: 'fail-closed'"]));
check('platform policy exports profile policy exactly once', policyExportCount === 1);

check('domain boundary is content free', includesAll(domain, ['ApplicationSecurityProfileGateBoundaryView', 'canonicalApplicationCount: 14', 'sourcePathsExposedToClient: false', 'threatModelHashesExposedToClient: false']));
check('domain exports profile boundary', domainIndex.includes("export * from './application-security-profile-gate.js'"));
check('application use case verifies policy snapshot', includesAll(useCase, ['GetApplicationSecurityProfileGateBoundaryUseCase', 'this.policy.verifySnapshot(snapshot)', 'APPLICATION_SECURITY_PROFILE_GATE_SNAPSHOT_INVALID']));
check('application boundary records no migration', includesAll(useCase, ['schemaMigrationRequired: false', 'latestDatabaseMigration: 77']));
check('application exports profile use case', applicationIndex.includes("export * from './application-security-profile-gate-use-cases.js'"));

check('Desktop composes policy and boundary use case', includesAll(desktopMain, ['new ApplicationSecurityProfilePolicy()', 'new GetApplicationSecurityProfileGateBoundaryUseCase(applicationSecurityProfilePolicy)']));
check('Desktop registers exact zero-payload status channel', desktopMain.includes("registerIpcHandler('system:getApplicationSecurityProfileGateBoundary'"));
check('preload exposes exact status method', preload.includes("invoke('system:getApplicationSecurityProfileGateBoundary')"));
check('renderer global contract is typed', includesAll(globalTypes, ['ApplicationSecurityProfileGateBoundaryView', 'getApplicationSecurityProfileGateBoundary():Promise<ApplicationSecurityProfileGateBoundaryView>']));
check('IPC policy accepts only zero arguments', ipcPolicy.includes("case 'system:getApplicationSecurityProfileGateBoundary':"));
check('IPC sharing marks profile status no-cache', ipcSharing.includes("'system:getApplicationSecurityProfileGateBoundary'"));
check('renderer states mapping and authority limits', includesAll(renderer, ['PPK-023', 'ASVS, MASVS, SSDF', 'uygunluk sertifikası veya runtime yetkisi değildir']));
check('renderer does not expose manifest or threat hashes', !renderer.includes('manifestSha256') && !renderer.includes('threatModelSha256'));

check('policy tests cover allow hash and denial matrix', includesAll(profileTest, ['ALLOW_MAPPED_PROFILE', 'APPLICATION_UNKNOWN', 'MANIFEST_HASH_MISMATCH', 'MAPPING_INCOMPLETE', 'verifySnapshot']));
check('gate tests cover target drift and threat tamper', includesAll(gateTest, ['CANONICAL_TARGET_INVENTORY_MISMATCH', 'THREAT_MODEL_BINDING_INVALID', 'ASSURANCE_PROFILE_INVALID']));
check('integration tests cover IPC and no-cache policy', includesAll(integrationTest, ['system:getApplicationSecurityProfileGateBoundary', 'ApplicationSecurityProfilePolicy', 'resolveIpcReadSharingPolicy']));
check('gate uses real AST inventory and exact manifest checks', includesAll(gateScript, ["import { parse } from '@babel/parser'", 'PLATFORM_APPLICATION_IDS', '32-p-ppk-020-policy-conformance-target-inventory.json', 'extra manifest escape']));

check('pretypecheck runs PPK-023 gate', rootPackage.scripts?.pretypecheck?.includes('verify-application-security-profile-gate.mjs'));
check('prebuild runs PPK-023 gate before governed preflight', rootPackage.scripts?.prebuild?.indexOf('verify-application-security-profile-gate.mjs') >= 0 && rootPackage.scripts.prebuild.indexOf('verify-application-security-profile-gate.mjs') < rootPackage.scripts.prebuild.indexOf('require-current-governed-preflight.mjs'));
check('combined platform policy gate invokes PPK-023 gate', includesAll(combinedGate, ['verify-application-security-profile-gate.mjs', 'applicationSecurityProfileGateStatus']));
check('root package exposes all PPK-023 commands', ['verify:ppk023:profile-gate', 'verify:ppk023:targeted', 'verify:ppk023:contract', 'verify:ppk023:runtime'].every((name) => typeof rootPackage.scripts?.[name] === 'string'));

check('PPK-021 successor AST ratchet remains green', astGate.status === 'PASS' && astGate.productionSourceZones === 18 && astGate.scannedFiles >= 365 && astGate.privilegedSurfaces === 523 && astGate.exactAllowlistEntries === 523 && astGate.findings.length === 0);
check('PPK-022 successor capability ratchet remains green', capabilityGate.status === 'PASS' && capabilityGate.productionSourceZones === 18 && capabilityGate.scannedFiles === 365 && capabilityGate.capabilitySurfaces === 237 && capabilityGate.exactManifestSurfaces === 237 && capabilityGate.findings.length === 0);
check('scope records exact build and truth boundaries', scope.boundaries?.buildFailGateRequired === true && scope.boundaries?.canonicalApplicationCount === 14 && scope.boundaries?.applicationThreatModelCount === 14 && scope.boundaries?.mappingClaimsCompliance === false && scope.boundaries?.mappingGrantsRuntimeAuthority === false);
check('scope preserves no-cache and data ownership fences', scope.boundaries?.policyStatusIpcCacheAllowed === false && scope.boundaries?.schemaMigrationRequired === false && scope.boundaries?.realDataTransferPerformed === false && scope.boundaries?.cutoverPerformed === false && scope.boundaries?.desktopVaultOwnershipPreserved === true && scope.boundaries?.sqliteOwnershipTransferred === false);
check('inventory has seven implemented controls and no blockers', inventory.controls?.length === 7 && inventory.controls.every((item) => item.disposition === 'IMPLEMENTED') && inventory.closureSummary?.openBlockerCount === 0 && inventory.closureSummary?.openBlockers?.length === 0);
check('decision preserves assurance and successor limits', includesAll(decision, ['DEC-204', 'uygunluk sertifikası', 'PROFILE_ONLY / NOT_DEPLOYED', 'PPK-024']));
check('database migration remains 77', latestMigration === 77 && scope.boundaries?.latestDatabaseMigration === 77);

if (candidateMode) {
  check('candidate registry remains validation pending', requirement?.status === 'IN_PROGRESS' && requirement?.chain?.evidence === false);
  check('candidate scope remains validation pending', scope.status === 'IN_PROGRESS' && scope.implementationState === 'IMPLEMENTED_VALIDATION_PENDING' && scope.validation?.state === 'PENDING' && scope.validation?.finalValidationRecorded === false && scope.requirementCompletionClaimed === false && scope.remainingClosureWork?.length > 0);
  check('candidate inventory remains validation pending', inventory.status === 'IMPLEMENTED_VALIDATION_PENDING' && inventory.completionClaimed === false && inventory.closureSummary?.finalValidationPending === true);
  check('candidate audit makes no final PASS claim', audit.includes('VALIDATION_PENDING') && !audit.includes('COMPLETE / PASS'));
} else {
  check('accepted registry closes complete PPK-023 evidence chain', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true) && requirement.evidence?.length >= 15);
  check('scope closes PPK-023 after final validation', scope.status === 'COMPLETED' && scope.implementationState === 'VALIDATED_COMPLETE' && scope.validation?.state === 'COMPLETE' && scope.validation?.finalValidationRecorded === true && scope.requirementCompletionClaimed === true && scope.remainingClosureWork?.length === 0);
  check('inventory closes only after final validation', inventory.status === 'COMPLETE' && inventory.completionClaimed === true && inventory.closureSummary?.finalValidationPending === false);
  check('threat model is final without expanding assurance claim', threatModel.includes('VALIDATED / COMPLETE') && threatHash === manifest.threatModelDocument.sha256);
  check('audit closes only with final contract and runtime evidence', audit.includes('COMPLETE / PASS') && /contract: `\d+\/\d+ PASS`/u.test(audit) && /runtime kanıt demeti: `\d+\/\d+ PASS`/u.test(audit));
}

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-S',
  requirement: 'PPK-023',
  phase: candidateMode ? 'APPLICATION_SECURITY_PROFILE_CANDIDATE_CONTRACT' : 'APPLICATION_SECURITY_PROFILE_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS',
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  failures,
  checks,
  canonicalApplications: gate.canonicalApplications,
  mappedApplications: gate.mappedApplications,
  applicationThreatModels: gate.threatModels,
  applicationWorkspaces: gate.applicationWorkspaces,
  assuranceProfiles: gate.assuranceProfiles,
  asvsVersion: manifest.standards.asvs.version,
  asvsControls: gate.asvsControls,
  masvsVersion: manifest.standards.masvs.version,
  masvsControls: gate.masvsControls,
  ssdfVersion: manifest.standards.ssdf.version,
  ssdfPractices: gate.ssdfPractices,
  maliciousSelfTests: gate.maliciousSelfTestAssertions,
  benignSelfTests: gate.benignSelfTestAssertions,
  findings: gate.findings.length,
  manifestSha256: gate.manifestSha256,
  threatModelSha256: gate.threatModelSha256,
  mappingClaimsCompliance: false,
  profileOnlyNativeRuntimeValidationClaimed: false,
  mappingGrantsRuntimeAuthority: false,
  schemaMigrationRequired: false,
  latestDatabaseMigration: 77,
  historicalBackfillPerformed: false,
  realDataTransferPerformed: false,
  cutoverPerformed: false,
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  successorRequirementCompletedByThisPackage: false,
  requirementCompletionClaimed: !candidateMode && failures.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-S-ppk-023-application-security-profile-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`PPK-023${candidateMode ? ' candidate' : ''} contract: FAIL (${failures.length}/${checks.length}).`);
  failures.forEach((failure) => console.error(failure));
  process.exit(1);
}
console.log(`PPK-023${candidateMode ? ' candidate' : ''} contract: PASS (${checks.length}/${checks.length}).`);
