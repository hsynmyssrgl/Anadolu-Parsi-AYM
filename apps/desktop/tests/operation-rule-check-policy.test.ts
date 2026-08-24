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
    const enforcement = JSON.parse(enforcementRaw) as { entries: Array<{ ruleId: string; gateScripts: string[] }> };
    const mutationPolicy = JSON.parse(mutationPolicyRaw) as any;
    const dependencyRegistry = JSON.parse(dependencyRegistryRaw) as any;
    expect(source).toContain("readJson('config/canonical-rule-registry.json')");
    expect(source).toContain("readJson('config/rule-acknowledgement.json')");
    expect(source).toContain("readJson('config/user-decision-ledger.json')");
    expect(source).toContain("readFile('docs/decisions/DEC-275-mutation-wide-record-and-test-closure.md')");
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
    expect(mutationPolicy).toMatchObject({
      schemaVersion: 2, id: 'PPT-MUTATION-RELEASE-READINESS-V2',
      requirement: 'PR-235', decision: 'DEC-270', failClosed: true,
      strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275',
      baseline: { impactBaseOverrideAllowed: false },
      dependencyRegistry: {
        path: 'config/change-impact-dependency-registry.json',
        sha256: createHash('sha256').update(dependencyRegistryRaw).digest('hex'),
        unmatchedChangedPathEffect: 'BLOCK',
        dependentRecordsMustBeChanged: true,
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
    expect(sourceProtection).toContain('...DERIVED_DOCUMENT_INDEX_PATHS');
    expect(deliveryReport).toContain('...DERIVED_DOCUMENT_INDEX_PATHS');
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
