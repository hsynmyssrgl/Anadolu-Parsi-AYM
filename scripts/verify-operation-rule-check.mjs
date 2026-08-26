import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const valueAfter = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const operation = valueAfter('--operation')?.trim() ?? '';
const kind = valueAfter('--kind')?.trim() ?? '';
const allowedKinds = new Set(['mutation', 'test', 'build', 'installation', 'deletion', 'publish', 'read-only']);
const failures = [];
let checks = 0;
const check = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const stable = (value) => Array.isArray(value)
  ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
    : JSON.stringify(value);

check(operation.length >= 3 && operation.length <= 160 && !/[\r\n]/u.test(operation), 'Geçerli --operation açıklaması zorunludur.');
check(allowedKinds.has(kind), `Geçerli --kind zorunludur: ${[...allowedKinds].join(', ')}.`);

const [registry, acknowledgement, constitution, enforcement, mutationReadinessPolicy, dependencyRegistryBytes,
  userDecisionLedger, dec275Bytes, dec276Bytes, workLedger, commercialLedger, masterDecisionRegister,
  adrNames, decisionNames] = await Promise.all([
  readJson('config/canonical-rule-registry.json'),
  readJson('config/rule-acknowledgement.json'),
  readJson('config/project-constitution.json'),
  readJson('config/rule-enforcement-registry.json'),
  readJson('config/mutation-release-readiness-policy.json'),
  readFile('config/change-impact-dependency-registry.json'),
  readJson('config/user-decision-ledger.json'),
  readFile('docs/decisions/DEC-275-mutation-wide-record-and-test-closure.md'),
  readFile('docs/decisions/DEC-276-bronze-51-rejected-predecessor-recovery-bootstrap.md'),
  readJson('docs/ticari-urun-temeli/08_IS_LISTESI/03_ANA_IS_SICILI.json'),
  readJson('docs/ticari-urun-temeli/01_YONETIM/05_DEGISIKLIK_SICILI.json'),
  readFile('docs/10_MASTER_DECISION_REGISTER.md', 'utf8'),
  readdir('docs/adr'),
  readdir('docs/decisions')
]);
const dependencyRegistry = JSON.parse(dependencyRegistryBytes.toString('utf8'));
const dependencyRegistrySha256 = createHash('sha256').update(dependencyRegistryBytes).digest('hex');
const canonical = { ...registry };
delete canonical.rulesSha256;
const calculatedHash = createHash('sha256').update(stable(canonical)).digest('hex');
const activeRules = registry.rules.filter((rule) => rule.state === 'ACTIVE');
const enforcementIds = new Set(enforcement.entries.map((entry) => entry.ruleId));
const channelWorktreeEnforcement = enforcement.entries.find((entry) => entry.ruleId === 'PR-236');
const mutationReadinessEnforcement = enforcement.entries.find((entry) => entry.ruleId === 'PR-235');
const releaseAllocationEnforcement = enforcement.entries.find((entry) => entry.ruleId === 'PR-237');
const installedReleaseUatEnforcement = enforcement.entries.find((entry) => entry.ruleId === 'PR-239');
const mutationWideClosureEnforcement = enforcement.entries.find((entry) => entry.ruleId === 'PR-240');
const recoveryBootstrapEnforcement = enforcement.entries.find((entry) => entry.ruleId === 'PR-241');
const dec275 = userDecisionLedger.decisions?.find((entry) => entry.id === 'DEC-275');
const dec276 = userDecisionLedger.decisions?.find((entry) => entry.id === 'DEC-276');
const exactIds = (values, pattern) => Array.isArray(values)
  && values.every((value) => pattern.test(value))
  && new Set(values).size === values.length;
const ruleIds = registry.rules?.map((entry) => entry.id) ?? [];
const enforcementRuleIds = enforcement.entries?.map((entry) => entry.ruleId) ?? [];
const decisionIds = userDecisionLedger.decisions?.map((entry) => entry.id) ?? [];
const workIds = workLedger.isler?.map((entry) => entry.id) ?? [];
const commercialIds = commercialLedger.kayitlar?.map((entry) => entry.id) ?? [];
const adrFiles = adrNames.filter((name) => /^ADR-\d{3}-.+\.md$/u.test(name));
const decisionFiles = decisionNames.filter((name) => /^DEC-\d{3}-.+\.md$/u.test(name));
const adrIds = adrFiles.map((name) => name.slice(0, 7));
const adrNumbers = adrIds.map((id) => Number(id.slice(4))).sort((left, right) => left - right);
const expectedAdrNumbers = adrNumbers.length > 0
  ? Array.from({ length: adrNumbers.at(-1) }, (_, index) => index + 1)
  : [];
const referencedMasterAdrIds = [...new Set(masterDecisionRegister.match(/\bADR-\d{3}\b/gu) ?? [])];
const decisionFileIds = decisionFiles.map((name) => name.slice(0, 7));
const adrHeadings = await Promise.all(adrFiles.map(async (name) => ({
  id: name.slice(0, 7),
  text: await readFile(`docs/adr/${name}`, 'utf8')
})));
const decisionHeadings = await Promise.all(decisionFiles.map(async (name) => ({
  id: name.slice(0, 7),
  text: await readFile(`docs/decisions/${name}`, 'utf8')
})));
const exactPr240ImpactAreas = ['mainSource', 'channelSources', 'canonicalRules', 'decisions', 'activeDocuments',
  'commercialRecords', 'workList', 'scopesInventoriesRatchets', 'manifestsIndexes', 'masterDocumentation', 'ratchets', 'tests', 'uat'];
const exactUniversalDependentRecords = ['SHA256SUMS.txt', 'artifacts/manifests/PROJECT_ARTIFACT_INDEX.csv',
  'artifacts/manifests/PROJECT_ARTIFACT_INDEX.json', 'artifacts/manifests/PROJECT_ARTIFACT_INDEX.md',
  'docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md',
  'docs/current/MASTER_PROJE_DOKUMANTASYONU_GUNCEL_24.08.2026_V5.docx',
  'docs/current/MASTER_PROJE_DOKUMANTASYONU_GUNCEL_24.08.2026_V5.pdf',
  'docs/ticari-urun-temeli/00_TEMEL_SURUM_MANIFESTOSU.json',
  'docs/ticari-urun-temeli/01_YONETIM/05_DEGISIKLIK_SICILI.json',
  'docs/ticari-urun-temeli/05_KALITE_TEST_KANIT/04_TICARI_TEMEL_DOGRULAMA_KANITI.json',
  'docs/ticari-urun-temeli/08_IS_LISTESI/01_ANA_IS_LISTESI.md',
  'docs/ticari-urun-temeli/08_IS_LISTESI/03_ANA_IS_SICILI.json', 'manifest.json'];
const exactUniversalAffectedVitestFiles = ['apps/desktop/tests/mutation-release-evidence-producers.test.ts',
  'apps/desktop/tests/mutation-release-readiness-contract.test.ts', 'apps/desktop/tests/operation-rule-check-policy.test.ts'];
const exactDec275Documents = ['AGENTS.md', 'SHA256SUMS.txt', 'config/active-governance-ledger.json',
  'config/canonical-rule-registry.json', 'config/change-impact-dependency-registry.json',
  'config/mutation-release-readiness-policy.json', 'config/rule-acknowledgement.json',
  'config/rule-enforcement-registry.json', 'config/project-constitution.json', 'docs/10_MASTER_DECISION_REGISTER.md',
  'docs/current/06_KANONIK_KURAL_SICILI.md', 'docs/current/09_KULLANICI_KARARLARI_KAYDI.md',
  'docs/current/10_TUM_KURALLAR_ASILAMAZ_YURUTME_SOZLESMESI.md',
  'docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md',
  'docs/current/MASTER_PROJE_DOKUMANTASYONU_GUNCEL_24.08.2026_V5.docx',
  'docs/current/MASTER_PROJE_DOKUMANTASYONU_GUNCEL_24.08.2026_V5.pdf',
  'docs/ticari-urun-temeli/00_OKU_BENI.md', 'docs/ticari-urun-temeli/00_TEMEL_SURUM_MANIFESTOSU.json',
  'docs/ticari-urun-temeli/01_YONETIM/01_ASILAMAZ_KURALLAR.md',
  'docs/ticari-urun-temeli/05_KALITE_TEST_KANIT/04_TICARI_TEMEL_DOGRULAMA_KANITI.json',
  'docs/ticari-urun-temeli/08_IS_LISTESI/01_ANA_IS_LISTESI.md', 'manifest.json'];

check(registry.rulesSha256 === calculatedHash, 'Kanonik kural hash doğrulaması başarısız.');
check(exactIds(ruleIds, /^PR-\d{3}$/u), 'Kanonik PR kimlikleri tekil ve PR-xxx biçiminde değil.');
check(exactIds(enforcementRuleIds, /^PR-\d{3}$/u), 'Enforcement PR kimlikleri tekil ve PR-xxx biçiminde değil.');
check(exactIds(decisionIds, /^DEC-\d{3}$/u), 'Kullanıcı DEC kimlikleri tekil ve DEC-xxx biçiminde değil.');
check(exactIds(adrIds, /^ADR-\d{3}$/u)
  && adrHeadings.every(({ id, text }) => text.startsWith(`# ${id}`)),
  'ADR dosya kimlikleri tekil değil veya dosya adı ile başlık uyuşmuyor.');
check(JSON.stringify(adrNumbers) === JSON.stringify(expectedAdrNumbers),
  'ADR dosya numaraları ADR-001 ile en yüksek ADR arasında kesintisiz değil.');
check(referencedMasterAdrIds.every((id) => adrIds.includes(id)),
  'Ana karar sicili, karşılık gelen kaynak ADR dosyası olmayan bağlayıcı bir ADR kimliği içeriyor.');
check(exactIds(decisionFileIds, /^DEC-\d{3}$/u)
  && decisionHeadings.every(({ id, text }) => text.startsWith(`# ${id}`)),
  'DEC dosya kimlikleri tekil değil veya dosya adı ile başlık uyuşmuyor.');
check(exactIds(workIds, /^IS-\d{4}$/u), 'İş sicili kimlikleri tekil ve IS-xxxx biçiminde değil.');
check(exactIds(commercialIds, /^TICARI-\d{3}$/u)
  && commercialLedger.sonKayit === commercialIds.at(-1),
  'Ticari kayıt kimlikleri tekil değil veya sonKayit son kayıtla uyuşmuyor.');
check(registry.ruleCount === registry.rules.length, 'Kanonik kural sayısı uyuşmuyor.');
check(registry.activeRuleCount === activeRules.length, 'Aktif kural sayısı uyuşmuyor.');
check(acknowledgement.release === registry.effectiveRelease, 'Kural onayı sürümü eski.');
check(acknowledgement.rulesSha256 === registry.rulesSha256, 'Kural onayı hash bağı eski.');
check(constitution.canonicalRulesSha256 === registry.rulesSha256, 'Proje anayasası kural hash bağı eski.');
check(enforcement.canonicalRulesSha256 === registry.rulesSha256, 'Enforcement kural hash bağı eski.');
check(enforcement.activeRuleCount === activeRules.length, 'Enforcement aktif kural sayısı uyuşmuyor.');
check(activeRules.every((rule) => enforcementIds.has(rule.id)), 'En az bir aktif kuralın enforcement kaydı eksik.');
check(enforcement.entries.every((entry) => entry.failClosed === true && entry.waiverAllowed === false && entry.skipAllowed === false), 'Enforcement waiver veya atlama içeriyor.');
check(enforcement.entries.every((entry) => entry.evidencePolicy === 'MISSING_EVIDENCE_NEVER_PASS'), 'Enforcement kanıt politikası fail-closed değil.');
check(enforcement.entries.every((entry) => entry.violationEffect === 'BLOCK_CURRENT_REQUIRED_STAGE'), 'Enforcement ihlal etkisi kanonik engelleme değeriyle uyuşmuyor.');
check(channelWorktreeEnforcement?.gateScripts?.includes('scripts/verify-release-channel-worktrees.mjs'),
  'PR-236 release-channel worktree enforcement kapısı eksik.');
check(mutationReadinessPolicy?.schemaVersion === 2
  && mutationReadinessPolicy?.id === 'PPT-MUTATION-RELEASE-READINESS-V2'
  && mutationReadinessPolicy?.requirement === 'PR-235'
  && mutationReadinessPolicy?.decision === 'DEC-270'
  && mutationReadinessPolicy?.strengthenedByRequirement === 'PR-240'
  && mutationReadinessPolicy?.strengthenedByDecision === 'DEC-275'
  && mutationReadinessPolicy?.failClosed === true
  && mutationReadinessPolicy?.waiverAllowed === false
  && JSON.stringify(mutationReadinessPolicy?.impactAreas) === JSON.stringify(exactPr240ImpactAreas)
  && mutationReadinessPolicy?.dependencyRegistry?.path === 'config/change-impact-dependency-registry.json'
  && mutationReadinessPolicy?.dependencyRegistry?.sha256 === dependencyRegistrySha256
  && mutationReadinessPolicy?.dependencyRegistry?.unmatchedChangedPathEffect === 'BLOCK'
  && mutationReadinessPolicy?.dependencyRegistry?.dependentRecordsMustBeChanged === true
  && mutationReadinessPolicy?.dependencyRegistry?.dependentRecordNotAffected?.allowed === true
  && mutationReadinessPolicy?.dependencyRegistry?.dependentRecordNotAffected?.status === 'NOT_AFFECTED_WITH_BASELINE_IDENTITY'
  && mutationReadinessPolicy?.dependencyRegistry?.dependentRecordNotAffected?.reasonCode === 'DEPENDENT_RECORD_BASELINE_IDENTITY_UNCHANGED'
  && mutationReadinessPolicy?.dependencyRegistry?.dependentRecordNotAffected?.sha256Required === true
  && mutationReadinessPolicy?.dependencyRegistry?.dependentRecordNotAffected?.baselineDiffAbsenceRequired === true
  && mutationReadinessPolicy?.dependencyRegistry?.dependentRecordNotAffected?.evidencePathsRequired === true
  && mutationReadinessPolicy?.dependencyRegistry?.targetedVitestMustEqualAffectedFiles === true
  && mutationReadinessPolicy?.externalBaselineChain?.bootstrapAdoption?.historicalBaseCommitPreservedAsImpactBase === true
  && mutationReadinessPolicy?.externalBaselineChain?.bootstrapAdoption?.producerCommitSource === 'REPOSITORY_POINTER_SOURCE_COMMIT'
  && mutationReadinessPolicy?.externalBaselineChain?.bootstrapAdoption?.producerCommitMustDifferFromBaseCommit === true
  && mutationReadinessPolicy?.externalBaselineChain?.bootstrapAdoption?.producerCommitAncestry === 'BASE_COMMIT_TO_POINTER_SOURCE_COMMIT_TO_CURRENT_HEAD'
  && mutationReadinessPolicy?.externalBaselineChain?.bootstrapAdoption?.producerBindingReadback === 'GIT_SHOW_EXACT_PATH_SIZE_SHA256'
  && mutationReadinessPolicy?.baseline?.preMutationProducerBoundToBaselineCommit === true
  && dependencyRegistry?.schemaVersion === 1
  && dependencyRegistry?.id === 'PPT-CHANGE-IMPACT-DEPENDENCY-REGISTRY-V1'
  && dependencyRegistry?.requirement === 'PR-235'
  && dependencyRegistry?.decision === 'DEC-270'
  && dependencyRegistry?.strengthenedByRequirement === 'PR-240'
  && dependencyRegistry?.strengthenedByDecision === 'DEC-275'
  && dependencyRegistry?.failClosed === true
  && dependencyRegistry?.unmatchedChangedPathEffect === 'BLOCK'
  && JSON.stringify(dependencyRegistry?.universalDependentRecords) === JSON.stringify(exactUniversalDependentRecords)
  && JSON.stringify(dependencyRegistry?.universalAffectedVitestFiles) === JSON.stringify(exactUniversalAffectedVitestFiles)
  && dependencyRegistry?.pathRules?.filter((rule) => rule.id === 'governed-source-safety-net').length === 1
  && dependencyRegistry.pathRules.find((rule) => rule.id === 'governed-source-safety-net')?.dependentRecords?.length > 0
  && dependencyRegistry.pathRules.find((rule) => rule.id === 'governed-source-safety-net')?.affectedVitestFiles?.length > 0
  && Array.isArray(dependencyRegistry?.pathRules) && dependencyRegistry.pathRules.length > 0
  && ['targetedVitest', 'fullVitest', 'rootTypecheck', 'changedMjsSyntax', 'changedPs1Parser']
    .every((id) => dependencyRegistry?.commandMatrix?.[id]?.nonMutating === true)
  && Object.keys(dependencyRegistry?.affectedCommandCatalog ?? {}).length > 0
  && Object.values(dependencyRegistry?.affectedCommandCatalog ?? {}).every((entry) => entry?.nonMutating === true),
'PR-235 mutation-release readiness politikası eksik veya gevşetilmiş.');
const exactPr235GateScripts = ['scripts/verify-operation-rule-check.mjs', 'scripts/lib/mutation-release-evidence.mjs',
  'scripts/lib/release-source-provenance.mjs', 'scripts/lib/windows-package-provenance.mjs',
  'scripts/record-mutation-baseline.mjs', 'scripts/create-mutation-impact-assessment.mjs',
  'scripts/create-mutation-impact-analysis.mjs',
  'scripts/run-mutation-test-evidence.mjs', 'scripts/verify-source-integrity.mjs',
  'scripts/generate-project-artifact-index-v2.mjs', 'scripts/verify-project-artifact-index-v2.mjs',
  'scripts/run-governed-postflight.mjs', 'apps/desktop/scripts/run-electron-builder.mjs',
  'scripts/create-bronze-final-local-test-delivery.mjs'];
check(JSON.stringify(mutationReadinessEnforcement?.gateScripts) === JSON.stringify(exactPr235GateScripts),
'PR-235 kalıcı completion/paket/teslim enforcement kapıları eksik.');
check(mutationReadinessEnforcement?.bootstrapAdoptionDiffBaseCommit === '440d5c7a9fbbd840faef58d1e1ef2048f8a989b4'
  && mutationReadinessEnforcement?.bootstrapAdoptionProducerCommitSource === 'REPOSITORY_POINTER_SOURCE_COMMIT'
  && mutationReadinessEnforcement?.bootstrapAdoptionProducerBinding === 'EXTERNAL_RECEIPT_EQUALS_POINTER_AND_BASE_TO_POINTER_TO_HEAD_ANCESTRY'
  && mutationReadinessEnforcement?.preMutationProducerBinding === 'BASELINE_COMMIT_EXACT_PATH_SIZE_SHA256'
  && constitution.mutationBootstrapProducerPointerCommitBindingRequired === true
  && constitution.mutationBootstrapProducerBasePointerHeadAncestryRequired === true
  && constitution.mutationPreMutationProducerBaselineCommitBindingRequired === true
  && constitution.mutationImpactAssessmentSourceCommitExactProvenanceRequired === true
  && constitution.mutationImpactAssessmentBaselineCommitExactPointerRequired === true,
'PR-235 bootstrap ve normal baseline producer commit bağları eksik veya gevşetilmiş.');
check(['scripts/allocate-monthly-release-version.mjs', 'scripts/verify-active-version-sweep.mjs',
  'apps/desktop/scripts/build-signed-windows-release.mjs', 'apps/desktop/scripts/run-electron-builder.mjs']
  .every((gate) => releaseAllocationEnforcement?.gateScripts?.includes(gate)),
'PR-237 tek tahsis ve önceden tahsisli paket kimliği enforcement kapıları eksik.');
const exactPr239GateScripts = ['apps/desktop/scripts/run-electron-builder.mjs', 'scripts/lib/windows-package-provenance.mjs',
  'scripts/verify-windows-package-provenance.mjs',
  'scripts/run-windows-installer-experience-uat.ps1', 'scripts/run-windows-installed-release-uat.ps1',
  'scripts/run-installed-frontend-user-uat.mjs', 'scripts/lib/installed-ui-interaction-coverage.mjs',
  'scripts/lib/windows-native-file-dialog-uat.mjs', 'scripts/lib/windows-native-file-dialog-uat.ps1',
  'scripts/lib/exclusive-evidence-run-root-guard.mjs', 'scripts/lib/canonical-product-navigation.mjs',
  'scripts/create-bronze-final-local-test-delivery.mjs'];
check(JSON.stringify(installedReleaseUatEnforcement?.gateScripts) === JSON.stringify(exactPr239GateScripts),
  'PR-239 adversarial Windows delivery evidence enforcement kapıları eksik.');
const exactPr240GateScripts = ['scripts/verify-operation-rule-check.mjs',
  'scripts/lib/mutation-release-evidence.mjs', 'scripts/lib/release-source-provenance.mjs',
  'scripts/lib/windows-package-provenance.mjs',
  'scripts/create-mutation-impact-assessment.mjs', 'scripts/create-mutation-impact-analysis.mjs',
  'scripts/run-mutation-test-evidence.mjs', 'scripts/verify-source-integrity.mjs',
  'scripts/verify-current-master-documentation-v5.mjs',
  'docs/ticari-urun-temeli/11_OTOMASYON/dogrula-ticari-temel-alani.mjs',
  'scripts/verify-release-channel-worktrees.mjs', 'scripts/run-installed-frontend-user-uat.mjs',
  'scripts/run-governed-postflight.mjs', 'apps/desktop/scripts/run-electron-builder.mjs'];
check(JSON.stringify(mutationWideClosureEnforcement?.gateScripts) === JSON.stringify(exactPr240GateScripts),
  'PR-240 tum kayit ve test kapanisi enforcement kapilari eksik.');
const exactPr241GateScripts = ['scripts/lib/windows-package-provenance.mjs',
  'scripts/lib/mutation-release-evidence.mjs', 'scripts/lib/release-source-provenance.mjs',
  'scripts/create-mutation-impact-assessment.mjs', 'scripts/create-mutation-impact-analysis.mjs',
  'scripts/run-governed-postflight.mjs',
  'scripts/lib/monthly-release-version.mjs', 'scripts/run-windows-installed-release-uat.ps1',
  'scripts/run-installed-frontend-user-uat.mjs', 'scripts/create-bronze-final-local-test-delivery.mjs',
  'scripts/allocate-monthly-release-version.mjs', 'apps/desktop/scripts/run-electron-builder.mjs',
  'apps/desktop/tests/mutation-release-readiness-contract.test.ts',
  'apps/desktop/tests/windows-package-provenance-history.test.ts',
  'apps/desktop/tests/monthly-release-version.test.ts',
  'apps/desktop/tests/windows-installed-release-uat-contract.test.ts',
  'apps/desktop/tests/installed-frontend-user-uat-contract.test.ts',
  'apps/desktop/tests/installed-frontend-user-uat-receipt.test.ts',
  'apps/desktop/tests/bronze-final-local-test-delivery-contract.test.ts'];
check(JSON.stringify(recoveryBootstrapEnforcement?.gateScripts) === JSON.stringify(exactPr241GateScripts),
  'PR-241 recovery bootstrap enforcement kapilari eksik.');
check(mutationWideClosureEnforcement?.trackedIn === 'docs/decisions/DEC-275-mutation-wide-record-and-test-closure.md'
  && dec275?.status === 'ACTIVE' && dec275?.syncStatus === 'SYNCHRONIZED'
  && dec275?.document === mutationWideClosureEnforcement.trackedIn
  && dec275?.documentSha256 === createHash('sha256').update(dec275Bytes).digest('hex')
  && JSON.stringify(dec275?.documents) === JSON.stringify(exactDec275Documents)
  && JSON.stringify(dec275?.requirements) === JSON.stringify(['PR-240'])
  && dec275Bytes.toString('utf8').includes('En küçük değişiklikte tüm kayıt ve test kapanışı'),
  'DEC-275 kullanici karari, belge hash/readback veya exact kayit kapsami eksik.');
check(recoveryBootstrapEnforcement?.trackedIn === 'docs/decisions/DEC-276-bronze-51-rejected-predecessor-recovery-bootstrap.md'
  && dec276?.status === 'ACTIVE' && dec276?.syncStatus === 'SYNCHRONIZED'
  && dec276?.document === recoveryBootstrapEnforcement.trackedIn
  && dec276?.documentSha256 === createHash('sha256').update(dec276Bytes).digest('hex')
  && JSON.stringify(dec276?.requirements) === JSON.stringify(['PR-241'])
  && dec276Bytes.toString('utf8').includes('top-level current kaydı ile exact tek release entry statusu')
  && dec276Bytes.toString('utf8').includes('transaction yayımlanmadan hemen önce'),
  'DEC-276 recovery karari, belge hash/readback veya PR-241 kapsami eksik.');
check(constitution.everyMutationDependentRecordAtomicSyncRequired === true
  && constitution.everyMutationTargetedAndFullRegressionRequired === true
  && constitution.uiMutationAllInteractiveAndVisualSurfacesUatRequired === true
  && constitution.actualTestFailureRejectedCheckpointRequired === true
  && constitution.intermediateInstallerBuildForbidden === true
  && constitution.packageRequiresMainAndChannelSourceEquality === true
  && constitution.mutationImpactAssessmentSourceCommitExactProvenanceRequired === true
  && constitution.mutationImpactAssessmentBaselineCommitExactPointerRequired === true,
  'PR-240 Proje Anayasasi baglari eksik veya gevsetilmis.');
check(constitution.windowsInstalledReleaseUatSequence51CurrentLedgerStatus === 'IN_PROGRESS'
  && constitution.windowsInstalledReleaseUatSequence51CurrentAndEntryStatusMustMatch === true
  && constitution.windowsPreviousPackageProvenanceSequence51PrecommitLiveReadbackRequired === true
  && constitution.windowsPreviousPackageProvenanceSequence51PrecommitExactPathSizeShaIdentityRequired === true
  && constitution.mutationImpactAssessmentSourceCommitExactProvenanceRequired === true
  && constitution.mutationImpactAssessmentBaselineCommitExactPointerRequired === true,
  'PR-241 Proje Anayasasi lifecycle veya parent bundle precommit readback baglari eksik.');

if (failures.length === 0) {
  const channelGate = spawnSync(process.execPath, [
    'scripts/verify-release-channel-worktrees.mjs', '--kind', kind
  ], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true });
  check(channelGate.status === 0,
    `PR-236 release-channel worktree kapısı başarısız: ${(channelGate.stderr || channelGate.stdout || '').trim()}`);
}

if (failures.length > 0) {
  console.error(`İşlem kural kontrolü başarısız (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const receipt = {
  schemaVersion: 1,
  ruleId: 'PR-231',
  release: registry.effectiveRelease,
  registryId: registry.id,
  rulesSha256: registry.rulesSha256,
  operation,
  kind,
  checks,
  status: 'PASS',
  checkedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/operation-rule-check.json', `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`İşlem kural kontrolü: PASS (${kind} / ${operation} / ${registry.id}).`);
