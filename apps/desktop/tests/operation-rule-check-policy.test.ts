import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string): Promise<string> => readFile(resolve(process.cwd(), path), 'utf8');

describe('operation rule check policy', () => {
  it('validates rule integrity, acknowledgement and universal fail-closed enforcement', async () => {
    const [source, channelGate, enforcementRaw, mutationPolicyRaw, dependencyRegistryRaw] = await Promise.all([
      readSource('scripts/verify-operation-rule-check.mjs'),
      readSource('scripts/verify-release-channel-worktrees.mjs'),
      readSource('config/rule-enforcement-registry.json'),
      readSource('config/mutation-release-readiness-policy.json'),
      readSource('config/change-impact-dependency-registry.json')
    ]);
    const enforcement = JSON.parse(enforcementRaw) as { entries: Array<Record<string, any> & { ruleId: string; gateScripts: string[] }> };
    const mutationPolicy = JSON.parse(mutationPolicyRaw) as any;
    const dependencyRegistry = JSON.parse(dependencyRegistryRaw) as any;
    expect(source).toContain("readJson('config/canonical-rule-registry.json')");
    expect(source).toContain("readJson('config/rule-acknowledgement.json')");
    expect(source).toContain("readJson('config/user-decision-ledger.json')");
    expect(source).toContain("readFile('docs/decisions/DEC-275-mutation-wide-record-and-test-closure.md')");
    expect(source).toContain("readFile('docs/decisions/DEC-276-bronze-51-rejected-predecessor-recovery-bootstrap.md')");
    expect(source).toContain("readdir('docs/adr')");
    expect(source).toContain("readdir('docs/decisions')");
    expect(source).toContain("readFile('docs/10_MASTER_DECISION_REGISTER.md', 'utf8')");
    expect(source).toContain("readJson('docs/ticari-urun-temeli/08_IS_LISTESI/03_ANA_IS_SICILI.json')");
    expect(source).toContain("readJson('docs/ticari-urun-temeli/01_YONETIM/05_DEGISIKLIK_SICILI.json')");
    expect(source).toContain("const exactTypecheckNoWriteProducers = ['scripts/verify-product-surface-governance.mjs'");
    expect(source).toContain("['pretypecheck', 'prebuild'].every((lifecycle)");
    expect(source).toContain("TypeScript/build producer strict no-write CLI veya write guard eksik.");
    expect(source).toContain("exactIds(ruleIds, /^PR-\\d{3}$/u)");
    expect(source).toContain("exactIds(decisionIds, /^DEC-\\d{3}$/u)");
    expect(source).toContain("text.startsWith(`# ${id}`)");
    expect(source).toContain('JSON.stringify(adrNumbers) === JSON.stringify(expectedAdrNumbers)');
    expect(source).toContain('referencedMasterAdrIds.every((id) => adrIds.includes(id))');
    expect(source).toContain("exactIds(workIds, /^IS-\\d{4}$/u)");
    expect(source).toContain("exactIds(commercialIds, /^TICARI-\\d{3}$/u)");
    expect(source).toContain('registry.rulesSha256 === calculatedHash');
    expect(source).toContain('activeRules.every((rule) => enforcementIds.has(rule.id))');
    expect(source).toContain('entry.waiverAllowed === false && entry.skipAllowed === false');
    expect(source).toContain("entry.evidencePolicy === 'MISSING_EVIDENCE_NEVER_PASS'");
    expect(source).toContain("entry.violationEffect === 'BLOCK_CURRENT_REQUIRED_STAGE'");
    expect(source).toContain("entry.ruleId === 'PR-236'");
    expect(source).toContain("'scripts/verify-release-channel-worktrees.mjs', '--kind', kind");
    expect(enforcement.entries.find((entry) => entry.ruleId === 'PR-236')?.gateScripts)
      .toContain('scripts/verify-release-channel-worktrees.mjs');
    expect(source).toContain("entry.ruleId === 'PR-235'");
    expect(enforcement.entries.find((entry) => entry.ruleId === 'PR-235')?.gateScripts)
      .toEqual([
        'scripts/verify-operation-rule-check.mjs',
        'scripts/lib/mutation-release-evidence.mjs',
        'scripts/lib/release-source-provenance.mjs',
        'scripts/lib/windows-package-provenance.mjs',
        'scripts/record-mutation-baseline.mjs',
        'scripts/create-mutation-impact-assessment.mjs',
        'scripts/create-mutation-impact-analysis.mjs',
        'scripts/run-mutation-test-evidence.mjs',
        'scripts/verify-source-integrity.mjs',
        'scripts/generate-project-artifact-index-v2.mjs',
        'scripts/verify-project-artifact-index-v2.mjs',
        'scripts/run-governed-postflight.mjs',
        'apps/desktop/scripts/run-electron-builder.mjs',
        'scripts/create-bronze-final-local-test-delivery.mjs'
      ]);
    expect(enforcement.entries.find((entry) => entry.ruleId === 'PR-235')).toMatchObject({
      bootstrapAdoptionDiffBaseCommit: '440d5c7a9fbbd840faef58d1e1ef2048f8a989b4',
      bootstrapAdoptionProducerCommitSource: 'REPOSITORY_POINTER_SOURCE_COMMIT',
      bootstrapAdoptionProducerBinding: 'EXTERNAL_RECEIPT_EQUALS_POINTER_AND_BASE_TO_POINTER_TO_HEAD_ANCESTRY',
      preMutationProducerBinding: 'BASELINE_COMMIT_EXACT_PATH_SIZE_SHA256'
    });
    expect(source).toContain('constitution.mutationBootstrapProducerPointerCommitBindingRequired === true');
    expect(source).toContain('constitution.mutationBootstrapProducerBasePointerHeadAncestryRequired === true');
    expect(source).toContain('constitution.mutationPreMutationProducerBaselineCommitBindingRequired === true');
    expect(source).toContain('constitution.mutationImpactAssessmentSourceCommitExactProvenanceRequired === true');
    expect(source).toContain('constitution.mutationImpactAssessmentBaselineCommitExactPointerRequired === true');
    expect(source).toContain("entry.ruleId === 'PR-237'");
    expect(enforcement.entries.find((entry) => entry.ruleId === 'PR-237')?.gateScripts)
      .toEqual(expect.arrayContaining([
        'scripts/allocate-monthly-release-version.mjs',
        'scripts/verify-active-version-sweep.mjs',
        'apps/desktop/scripts/build-signed-windows-release.mjs',
        'apps/desktop/scripts/run-electron-builder.mjs'
      ]));
    expect(source).toContain("entry.ruleId === 'PR-239'");
    expect(enforcement.entries.find((entry) => entry.ruleId === 'PR-239')?.gateScripts)
      .toEqual([
        'apps/desktop/scripts/run-electron-builder.mjs',
        'scripts/lib/windows-package-provenance.mjs',
        'scripts/verify-windows-package-provenance.mjs',
        'scripts/run-windows-installer-experience-uat.ps1',
        'scripts/run-windows-installed-release-uat.ps1',
        'scripts/run-installed-frontend-user-uat.mjs',
        'scripts/lib/installed-ui-interaction-coverage.mjs',
        'scripts/lib/windows-native-file-dialog-uat.mjs',
        'scripts/lib/windows-native-file-dialog-uat.ps1',
        'scripts/lib/exclusive-evidence-run-root-guard.mjs',
        'scripts/lib/canonical-product-navigation.mjs',
        'scripts/create-bronze-final-local-test-delivery.mjs'
      ]);
    expect(source).toContain("entry.ruleId === 'PR-240'");
    expect(enforcement.entries.find((entry) => entry.ruleId === 'PR-240')?.gateScripts)
      .toEqual([
        'scripts/verify-operation-rule-check.mjs',
        'scripts/lib/mutation-release-evidence.mjs',
        'scripts/lib/release-source-provenance.mjs',
        'scripts/lib/windows-package-provenance.mjs',
        'scripts/create-mutation-impact-assessment.mjs',
        'scripts/create-mutation-impact-analysis.mjs',
        'scripts/run-mutation-test-evidence.mjs',
        'scripts/verify-source-integrity.mjs',
        'scripts/verify-current-master-documentation-v5.mjs',
        'docs/ticari-urun-temeli/11_OTOMASYON/dogrula-ticari-temel-alani.mjs',
        'scripts/verify-release-channel-worktrees.mjs',
        'scripts/run-installed-frontend-user-uat.mjs',
        'scripts/run-governed-postflight.mjs',
        'apps/desktop/scripts/run-electron-builder.mjs'
      ]);
    expect(source).toContain('constitution.everyMutationDependentRecordAtomicSyncRequired === true');
    expect(source).toContain('constitution.intermediateInstallerBuildForbidden === true');
    expect(source).toContain("entry.ruleId === 'PR-241'");
    expect(enforcement.entries.find((entry) => entry.ruleId === 'PR-241')?.gateScripts)
      .toEqual([
        'scripts/lib/windows-package-provenance.mjs',
        'scripts/lib/mutation-release-evidence.mjs',
        'scripts/lib/release-source-provenance.mjs',
        'scripts/create-mutation-impact-assessment.mjs',
        'scripts/create-mutation-impact-analysis.mjs',
        'scripts/run-governed-postflight.mjs',
        'scripts/lib/monthly-release-version.mjs',
        'scripts/run-windows-technical-predecessor-preparation.ps1',
        'scripts/run-windows-installed-release-uat.ps1',
        'scripts/run-installed-frontend-user-uat.mjs',
        'scripts/create-bronze-final-local-test-delivery.mjs',
        'scripts/allocate-monthly-release-version.mjs',
        'apps/desktop/scripts/run-electron-builder.mjs',
        'apps/desktop/tests/mutation-release-readiness-contract.test.ts',
        'apps/desktop/tests/windows-package-provenance-history.test.ts',
        'apps/desktop/tests/monthly-release-version.test.ts',
        'apps/desktop/tests/windows-technical-predecessor-preparation-contract.test.ts',
        'apps/desktop/tests/windows-installed-release-uat-contract.test.ts',
        'apps/desktop/tests/installed-frontend-user-uat-contract.test.ts',
        'apps/desktop/tests/installed-frontend-user-uat-receipt.test.ts',
        'apps/desktop/tests/bronze-final-local-test-delivery-contract.test.ts'
      ]);
    expect(source).toContain('constitution.windowsInstalledReleaseUatSequence51CurrentLedgerStatus');
    expect(source).toContain('constitution.windowsPreviousPackageProvenanceSequence51PrecommitLiveReadbackRequired');
    expect(source).toContain('dec276?.documentSha256 === createHash');
    expect(mutationPolicy).toMatchObject({
      schemaVersion: 2, id: 'PPT-MUTATION-RELEASE-READINESS-V2',
      requirement: 'PR-235', decision: 'DEC-270', failClosed: true,
      strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275',
      baseline: { impactBaseOverrideAllowed: false, preMutationProducerBoundToBaselineCommit: true },
      externalBaselineChain: {
        bootstrapAdoption: {
          historicalBaseCommitPreservedAsImpactBase: true,
          producerCommitSource: 'REPOSITORY_POINTER_SOURCE_COMMIT',
          producerCommitMustDifferFromBaseCommit: true,
          producerCommitAncestry: 'BASE_COMMIT_TO_POINTER_SOURCE_COMMIT_TO_CURRENT_HEAD',
          producerBindingReadback: 'GIT_SHOW_EXACT_PATH_SIZE_SHA256'
        }
      },
      dependencyRegistry: {
        path: 'config/change-impact-dependency-registry.json',
        sha256: createHash('sha256').update(dependencyRegistryRaw).digest('hex'),
        unmatchedChangedPathEffect: 'BLOCK',
        dependentRecordsMustBeChanged: true,
        dependentRecordNotAffected: {
          allowed: true,
          status: 'NOT_AFFECTED_WITH_BASELINE_IDENTITY',
          reasonCode: 'DEPENDENT_RECORD_BASELINE_IDENTITY_UNCHANGED',
          sha256Required: true,
          baselineDiffAbsenceRequired: true,
          evidencePathsRequired: true
        },
        targetedVitestMustEqualAffectedFiles: true
      },
      evidenceExecution: {
        fullRegressionCommandFixedAndUnfiltered: true,
        fullRegressionRootTypecheckRequired: true,
        fullRegressionChangedMjsNodeCheckRequired: true,
        fullRegressionChangedPs1ParserRequired: true
      },
      postflight: { trackedFileWritesAllowed: false, artifactIndexGenerationAllowed: false }
    });
    expect(dependencyRegistry).toMatchObject({
      schemaVersion: 1, id: 'PPT-CHANGE-IMPACT-DEPENDENCY-REGISTRY-V1',
      requirement: 'PR-235', decision: 'DEC-270',
      strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275', failClosed: true,
      unmatchedChangedPathEffect: 'BLOCK'
    });
    expect(dependencyRegistry.universalDependentRecords).toHaveLength(13);
    expect(dependencyRegistry.universalAffectedVitestFiles).toHaveLength(3);
    expect(dependencyRegistry.pathRules.find((rule: any) => rule.id === 'governed-source-safety-net')).toMatchObject({
      match: { exactPaths: expect.arrayContaining(['.gitattributes']) },
      dependentRecords: ['SHA256SUMS.txt', 'manifest.json'], includeChangedTestFile: true
    });
    expect(source).toContain('dec275?.documentSha256 === createHash');
    expect(source).toContain("JSON.stringify(dec275?.requirements) === JSON.stringify(['PR-240'])");
    expect(Object.values(dependencyRegistry.commandMatrix)).toEqual(expect.arrayContaining([
      expect.objectContaining({ nonMutating: true })
    ]));
    expect(channelGate).toContain("const releaseSensitiveKinds = new Set(['build', 'installation', 'publish'])");
    expect(channelGate).toContain("runGit(['rev-parse', '--git-common-dir'], checkoutRoot)");
    expect(channelGate).toContain("runGit(['worktree', 'list', '--porcelain'], checkoutRoot)");
    expect(channelGate).toContain("runGit(['rev-parse', '--git-common-dir'], expectedRoot)");
    expect(channelGate).toContain("runGit(['status', '--porcelain=v1', '--untracked-files=all'], expectedRoot)");
  });

  it('fails closed on stale Bronze 52 records and PR-241 commercial enforcement drift', async () => {
    const [validator, canonicalRaw, enforcementRaw, releaseRaw, decisionsRaw, activeRaw, workRaw, workMarkdown, evidenceRaw, evidenceRegistryRaw] = await Promise.all([
      readSource('docs/ticari-urun-temeli/11_OTOMASYON/dogrula-ticari-temel-alani.mjs'),
      readSource('config/canonical-rule-registry.json'),
      readSource('config/rule-enforcement-registry.json'),
      readSource('config/release-ledger.json'),
      readSource('config/user-decision-ledger.json'),
      readSource('config/active-governance-ledger.json'),
      readSource('docs/ticari-urun-temeli/08_IS_LISTESI/03_ANA_IS_SICILI.json'),
      readSource('docs/ticari-urun-temeli/08_IS_LISTESI/01_ANA_IS_LISTESI.md'),
      readSource('docs/ticari-urun-temeli/05_KALITE_TEST_KANIT/04_TICARI_TEMEL_DOGRULAMA_KANITI.json'),
      readSource('docs/ticari-urun-temeli/05_KALITE_TEST_KANIT/03_KANIT_SICILI.json')
    ]);
    const canonical = JSON.parse(canonicalRaw) as any;
    const enforcement = JSON.parse(enforcementRaw) as any;
    const release = JSON.parse(releaseRaw) as any;
    const decisions = JSON.parse(decisionsRaw) as any;
    const active = JSON.parse(activeRaw) as any;
    const work = JSON.parse(workRaw) as any;
    const evidence = JSON.parse(evidenceRaw) as any;
    const evidenceRegistry = JSON.parse(evidenceRegistryRaw) as any;
    const latestRejectedCheckpoint = active.activeDeliveryClosure.latestRejectedCheckpoint as string;
    const exactPr241GateScripts = [
      'scripts/lib/windows-package-provenance.mjs',
      'scripts/lib/mutation-release-evidence.mjs',
      'scripts/lib/release-source-provenance.mjs',
      'scripts/create-mutation-impact-assessment.mjs',
      'scripts/create-mutation-impact-analysis.mjs',
      'scripts/run-governed-postflight.mjs',
      'scripts/lib/monthly-release-version.mjs',
      'scripts/run-windows-technical-predecessor-preparation.ps1',
      'scripts/run-windows-installed-release-uat.ps1',
      'scripts/run-installed-frontend-user-uat.mjs',
      'scripts/create-bronze-final-local-test-delivery.mjs',
      'scripts/allocate-monthly-release-version.mjs',
      'apps/desktop/scripts/run-electron-builder.mjs',
      'apps/desktop/tests/mutation-release-readiness-contract.test.ts',
      'apps/desktop/tests/windows-package-provenance-history.test.ts',
      'apps/desktop/tests/monthly-release-version.test.ts',
      'apps/desktop/tests/windows-technical-predecessor-preparation-contract.test.ts',
      'apps/desktop/tests/windows-installed-release-uat-contract.test.ts',
      'apps/desktop/tests/installed-frontend-user-uat-contract.test.ts',
      'apps/desktop/tests/installed-frontend-user-uat-receipt.test.ts',
      'apps/desktop/tests/bronze-final-local-test-delivery-contract.test.ts'
    ];
    const pr241Entries = enforcement.entries.filter((entry: any) => entry.ruleId === 'PR-241');
    expect(pr241Entries).toHaveLength(1);
    expect(pr241Entries[0].gateScripts).toEqual(exactPr241GateScripts);
    expect(pr241Entries[0]).toMatchObject({ failClosed: true, waiverAllowed: false, skipAllowed: false });
    expect(enforcement.canonicalRulesSha256).toBe(canonical.rulesSha256);
    expect(validator).toContain("readJson(resolve(REPO, 'config', 'rule-enforcement-registry.json'))");
    expect(validator).toContain('JSON.stringify(pr241Enforcement?.gateScripts) === JSON.stringify(exactPr241GateScripts)');
    expect(validator).toContain("!String(decision276?.ppk015DocumentationQaImpact ?? '').includes('Bronze 52 hâlâ NOT_BUILT')");
    expect(validator).toContain('workRegistry.latestMutationClosure?.checkpoint === latestRejectedCheckpoint');
    expect(validator).toContain('currentDecisionSummary.includes(latestRejectedCheckpoint) && currentMaster.includes(latestRejectedCheckpoint)');
    expect(validator).toContain('const selfReferentialEvidencePaths = new Set([evidenceRegistryPath, generatedEvidencePath])');
    expect(validator).toContain('if (!selfReferentialEvidencePaths.has(path))');
    expect(validator).toContain("generatedEvidenceEntry.sha256 = sha256(serializedReport)");
    expect(validator).toContain("persistedEvidenceEntry?.sha256 !== persistedReportSha256");
    const decision276 = decisions.decisions.find((decision: any) => decision.id === 'DEC-276');
    expect(decision276.ppk015DocumentationQaImpact).not.toContain('Bronze 52 hâlâ NOT_BUILT');
    expect(decision276.ppk015DocumentationQaImpact).toContain('REJECTED_INSTALLER_VISUAL_UAT_FAIL');
    const work212 = work.isler.find((item: any) => item.id === 'IS-0212');
    expect(work212.acikNedeni).toContain(`Aktif son kaynak reti ${latestRejectedCheckpoint}`);
    expect(work212.acikNedeni).not.toContain('Aktif son kaynak reti 219836c6');
    expect(workMarkdown).toContain(`Aktif son kaynak reti \`${latestRejectedCheckpoint}\`; yeni exact kapılar pendingdir`);
    expect(release.current).toMatchObject({ monthlySequence: 53, status: 'IN_PROGRESS', parentRelease: 'Bronze 27.08.2026.52' });
    expect(release.entries.find((entry: any) => entry.monthlySequence === 52)).toMatchObject({
      status: 'REJECTED_INSTALLER_VISUAL_UAT_FAIL',
      parentRelease: 'Bronze 26.08.2026.51',
      rejection: {
        immutablePackageHistoryRewritten: false,
        countsAsDeliveryPass: false,
        technicalPredecessorUse: 'SILENT_INSTALL_ONLY_NO_APPLICATION_LAUNCH_WITH_BEFORE_AFTER_DATA_AND_RUNTIME_READBACK'
      }
    });
    expect(evidence.canonicalRuleSha256).toBe(canonical.rulesSha256);
    expect(evidence.commercialReleaseEligible).toBe(false);
    expect(['NOT_RUN', 'FAIL', 'PASS']).toContain(evidence.status);
    if (evidence.status === 'NOT_RUN') {
      expect(evidence).toMatchObject({ checks: 0, mutationWideRecordAndTestClosureVerified: false });
    } else if (evidence.status === 'FAIL') {
      expect(evidence.checks).toBeGreaterThan(0);
      expect(evidence.mutationWideRecordAndTestClosureVerified).toBe(false);
      expect(evidence.failures.length).toBeGreaterThan(0);
    } else {
      expect(evidence.checks).toBeGreaterThan(0);
      expect(evidence.mutationWideRecordAndTestClosureVerified).toBe(true);
      expect(evidence.failures).toEqual([]);
    }
    const commercialEvidenceEntry = evidenceRegistry.kayitlar.find((entry: any) => entry.id === 'KANIT-0002');
    expect(commercialEvidenceEntry).toMatchObject({ durum: evidence.status, disKaynak: false });
    expect(commercialEvidenceEntry.sha256).toBe(createHash('sha256').update(evidenceRaw).digest('hex'));
  });

  it('requires an explicit operation and rerun guidance before mutations', async () => {
    const [source, workspaceInstructions] = await Promise.all([
      readSource('scripts/verify-operation-rule-check.mjs'),
      readSource('AGENTS.md')
    ]);
    expect(source).toContain("valueAfter('--operation')");
    expect(source).toContain("valueAfter('--kind')");
    expect(workspaceInstructions).toContain('durum değiştiren hiçbir işlem');
    expect(workspaceInstructions).toContain('kural hash\'i değişirse');
    expect(workspaceInstructions).toContain('Waiver, sessiz atlama');
  });

  it('keeps the per-operation receipt outside the authoritative source hash cycle', async () => {
    const [governanceUtils, sourceProtection, deliveryReport] = await Promise.all([
      readSource('scripts/lib/governance-utils.mjs'),
      readSource('scripts/protect-authoritative-source.mjs'),
      readSource('scripts/generate-current-delivery-report.mjs')
    ]);
    expect(governanceUtils).toContain("'artifacts/validation/operation-rule-check.json'");
    expect(governanceUtils).toContain("'__pycache__'");
    expect(sourceProtection).toContain('...DERIVED_DOCUMENT_INDEX_PATHS');
    expect(deliveryReport).toContain('...DERIVED_DOCUMENT_INDEX_PATHS');
  });

  it('keeps the active product lifecycle separate from the PR-240 delivery closure', async () => {
    const ledger = JSON.parse(await readSource('config/active-governance-ledger.json')) as any;
    expect(ledger).toMatchObject({
      activeMicroStep: '33-P',
      nextOfficialTask: '33-P_DEC-227_IMPLEMENTATION_VALIDATION_AND_RECEIPT',
      libraryUploadStatus: '33-P_PENDING',
      activeDeliveryClosure: {
        requirement: 'PR-240',
        decision: 'DEC-275',
        status: 'IN_PROGRESS',
        task: 'PR-240_MUTATION_WIDE_RECORD_TEST_AND_UI_UAT_CLOSURE',
        preflightStatus: 'NOT_RUN_CURRENT_MUTATION',
        postflightStatus: 'NOT_RUN_CURRENT_MUTATION'
      }
    });
    expect(ledger.activeDeliveryClosure.packageStatus).toMatch(/^(?:BLOCKED_|FAIL_)/u);
  });

  it('keeps the first-family release policy on the PR-240 strengthened evidence chain', async () => {
    const source = await readSource('scripts/verify-first-family-clean-release-policy.mjs');
    for (const marker of [
      "rule.id === 'PR-240' && rule.state === 'ACTIVE'",
      "mutationPolicy.strengthenedByRequirement === 'PR-240'",
      "mutationPolicy.strengthenedByDecision === 'DEC-275'",
      "mutationReadiness.strengthenedByRequirement === 'PR-240'",
      "mutationReadiness.strengthenedByDecision === 'DEC-275'",
      'packageGeneratedAt < installerStartedAt',
      'installationAt <= installedUiStartedAt'
    ]) expect(source).toContain(marker);
  });

  it('binds local, external and delivery verification to one live source boundary', async () => {
    const completionPaths = [
      'scripts/verify-33-l-long-term-portfolio-completion.mjs',
      'scripts/verify-33-m-accessibility-completion.mjs',
      'scripts/verify-33-n-draft-async-state-ux-completion.mjs',
      'scripts/verify-33-o-privacy-ownership-data-rights-incident-control-completion.mjs',
      'scripts/verify-33-p-passkeys-federated-identity-verifiable-temporary-credentials-completion.mjs'
    ];
    const [sourceProtection, externalProtection, deliveryReport, ...completionVerifiers] = await Promise.all([
      readSource('scripts/protect-authoritative-source.mjs'),
      readSource('scripts/protect-authoritative-source-external.mjs'),
      readSource('scripts/generate-current-delivery-report.mjs'),
      ...completionPaths.map(readSource)
    ]);
    for (const source of [sourceProtection, deliveryReport]) {
      expect(source).toContain('resolveCurrentDeliveryOutputBoundary');
      expect(source).toContain('currentDeliveryBoundary.excludedRelativePaths');
    }
    expect(deliveryReport).toContain('currentDeliveryBoundary.reportRelativePath');
    expect(deliveryReport).toContain('currentDeliveryBoundary.userVisibleRelativePath');
    expect(externalProtection).toContain("['scripts/protect-authoritative-source.mjs', 'verify']");
    expect(externalProtection).toContain('Live local source changed before external protection promotion');
    expect(externalProtection).toContain("schemaVersion: 2, release: visibleRelease, requirement: 'PR-233', decision: 'DEC-267'");
    expect(externalProtection).toContain("governanceRequirement: 'GOV-005'");
    expect(externalProtection).toContain("backupScope: 'TRACKED_FILES_AT_EXACT_COMMIT'");
    expect(externalProtection).toContain("readback.governanceRequirement === receipt.governanceRequirement");
    for (const verifier of completionVerifiers) {
      expect(verifier).toMatch(/protectionResult\?\.requirement\s*===\s*'PR-233'/u);
      expect(verifier).toMatch(/protectionResult\?\.governanceRequirement\s*===\s*'GOV-005'/u);
      expect(verifier).toMatch(/protectionResult\?\.decision\s*===\s*'DEC-267'/u);
      expect(verifier).not.toContain('"requirement":"GOV-005"');
    }
  });
});
