import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendExternalBaselineRecord, BOOTSTRAP_ADOPTION_BASE_COMMIT,
  CANONICAL_UNIVERSAL_AFFECTED_VITEST_FILES, CANONICAL_UNIVERSAL_DEPENDENT_RECORDS,
  parseVitestJsonFailureInventory, parseVitestJsonSummary,
  readExternalBaselineChain, resolveChangeImpactDependencies,
  validateChangeImpactDependencyRegistry, validateTargetedTestFiles
} from '../../../scripts/lib/mutation-release-evidence.mjs';

describe('PR-235 canonical mutation evidence producers', () => {
  it('binds baseline, impact and real Vitest execution to read-only postflight', async () => {
    const [policyText, dependencyRegistryText, packageText, baseline, assessment, impact, testRunner, preflight, postflight,
      builder, packageProvenance, mutationEvidence, releaseProvenance] = await Promise.all([
      readFile('config/mutation-release-readiness-policy.json', 'utf8'),
      readFile('config/change-impact-dependency-registry.json', 'utf8'),
      readFile('package.json', 'utf8'),
      readFile('scripts/record-mutation-baseline.mjs', 'utf8'),
      readFile('scripts/create-mutation-impact-assessment.mjs', 'utf8'),
      readFile('scripts/create-mutation-impact-analysis.mjs', 'utf8'),
      readFile('scripts/run-mutation-test-evidence.mjs', 'utf8'),
      readFile('scripts/run-governed-preflight.mjs', 'utf8'),
      readFile('scripts/run-governed-postflight.mjs', 'utf8'),
      readFile('apps/desktop/scripts/run-electron-builder.mjs', 'utf8'),
      readFile('scripts/lib/windows-package-provenance.mjs', 'utf8'),
      readFile('scripts/lib/mutation-release-evidence.mjs', 'utf8'),
      readFile('scripts/lib/release-source-provenance.mjs', 'utf8')
    ]);
    const policy = JSON.parse(policyText);
    const dependencyRegistry = JSON.parse(dependencyRegistryText);
    const pkg = JSON.parse(packageText);
    expect(policy).toMatchObject({
      schemaVersion: 2,
      requirement: 'PR-235', decision: 'DEC-270',
      strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275',
      defaultEvidence: { baseline: 'artifacts/validation/mutation-baseline.json' },
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
      evidenceExecution: { fullRegressionCommandFixedAndUnfiltered: true },
      dependencyRegistry: {
        path: 'config/change-impact-dependency-registry.json',
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
      postflight: { trackedFileWritesAllowed: false, artifactIndexGenerationAllowed: false }
    });
    expect(pkg.scripts).toMatchObject({
      'record:mutation-baseline': expect.stringContaining('record-mutation-baseline.mjs'),
      'create:mutation-impact-assessment': expect.stringContaining('create-mutation-impact-assessment.mjs'),
      'create:mutation-impact-evidence': expect.stringContaining('create-mutation-impact-analysis.mjs'),
      'verify:mutation-targeted:evidence': expect.stringContaining('--kind targeted'),
      'verify:mutation-full-regression:evidence': expect.stringContaining('--kind full')
    });
    expect(baseline).toContain("evidenceKind: 'PRE_MUTATION_BASELINE_EXTERNAL'");
    expect(baseline).toContain('appendExternalBaselineRecord');
    expect(baseline).toContain('BOOTSTRAP_ADOPTION_BASE_COMMIT');
    expect(impact).toContain('readExternalBaselineFromPointer');
    expect(assessment).toContain('baselinePointer: baselinePointer.value');
    expect(assessment).toContain("status: 'NOT_AFFECTED_WITH_BASELINE_IDENTITY'");
    expect(assessment).toContain("reasonCode: 'DEPENDENT_RECORD_BASELINE_IDENTITY_UNCHANGED'");
    expect(assessment).toContain('sha256: binding.sha256');
    expect(impact).toContain('baselinePointer: baselinePointer.value');
    expect(impact).not.toContain("optionValue('--assessment");
    expect(mutationEvidence).toContain('assessment.sourceCommit !== expectedSourceCommit');
    expect(mutationEvidence).toContain('assessment.baselineCommit !== expectedBaselineCommit');
    for (const producer of [assessment, impact, postflight, builder, releaseProvenance]) {
      expect(producer).toContain('expectedSourceCommit:');
      expect(producer).toContain('expectedBaselineCommit:');
    }
    expect(packageProvenance.match(/expectedSourceCommit:/gu)).toHaveLength(2);
    expect(packageProvenance.match(/expectedBaselineCommit:/gu)).toHaveLength(2);
    expect(testRunner).toContain('spawnSync(process.execPath');
    expect(testRunner).toContain('validateTargetedTestFiles(requested)');
    expect(testRunner).toContain('Targeted Vitest files must exactly equal the affected files derived from changed paths.');
    expect(testRunner).toContain("id: 'rootTypecheck'");
    expect(testRunner).toContain('changedMjsSyntax:');
    expect(testRunner).toContain('changedPs1Parser:');
    expect(testRunner).toContain('affectedCommand:');
    expect(testRunner).toContain("'--maxWorkers=1', '--reporter=json'");
    expect(testRunner).toContain('snapshotMutationEvidenceAndToolchain(root)');
    expect(testRunner).toContain('parseVitestJsonFailureInventory(vitest, { root })');
    expect(testRunner).toContain('FAILED_TEST: ${failure.file}');
    expect(testRunner).toContain('testResultFiles,');
    expect(testRunner).toContain('assertMatchingReleaseSourceProvenance(after.provenance, before.provenance');
    expect(preflight).toContain("process.argv.includes('--read-only')");
    expect(preflight).toContain('const cliArguments = process.argv.slice(2);');
    expect(preflight).toContain("cliArguments.length > 1 || cliArguments.some((argument) => argument !== '--read-only')");
    expect(preflight).toContain('only the optional --read-only flag is accepted');
    expect(preflight).toContain("await readJson('artifacts/validation/governed-preflight.json')");
    expect(preflight).toContain("['scripts/verify-project-artifact-index-v2.mjs', '--no-report', '--exact-head']");
    expect(preflight).toContain("['scripts/generate-project-artifact-index-v2.mjs', '--git-index']");
    expect(preflight).toContain("['scripts/verify-project-artifact-index-v2.mjs', '--git-index']");
    expect(preflight).toContain('if (!readOnly) {');
    expect(postflight).toContain("['scripts/run-governed-preflight.mjs', '--read-only']");
    expect(postflight).not.toContain("['scripts/generate-project-artifact-index-v2.mjs']");
    expect(postflight).not.toContain("['scripts/verify-universal-rule-enforcement.mjs']");
    expect(builder).toContain('readExternalBaselineFromPointer');
    expect(builder).toContain('baselinePointer: byId.baseline.value');
    expect(postflight).toContain('baselinePointer: bindings.baseline.value');
    expect(packageProvenance).toContain('baselinePointer: baseline');
    expect(packageProvenance).toContain('baselinePointer: byId.baseline.value');
    expect(builder).not.toContain('PPT_MUTATION_BASELINE');
    expect(validateChangeImpactDependencyRegistry(dependencyRegistry)).toBe(dependencyRegistry);
    expect(dependencyRegistry.universalDependentRecords).toEqual(CANONICAL_UNIVERSAL_DEPENDENT_RECORDS);
    expect(dependencyRegistry.universalAffectedVitestFiles).toEqual(CANONICAL_UNIVERSAL_AFFECTED_VITEST_FILES);
    const missingUniversalRecord = structuredClone(dependencyRegistry);
    missingUniversalRecord.universalDependentRecords.pop();
    expect(() => validateChangeImpactDependencyRegistry(missingUniversalRecord)).toThrow(/canonical universal/u);
    const missingUniversalTest = structuredClone(dependencyRegistry);
    missingUniversalTest.universalAffectedVitestFiles.pop();
    expect(() => validateChangeImpactDependencyRegistry(missingUniversalTest)).toThrow(/canonical universal/u);
    const emptySafetyNet = structuredClone(dependencyRegistry);
    const safetyNet = emptySafetyNet.pathRules.find((rule: { id: string }) => rule.id === 'governed-source-safety-net');
    safetyNet.dependentRecords = [];
    expect(() => validateChangeImpactDependencyRegistry(emptySafetyNet)).toThrow(/safety-net/u);
    for (const command of Object.values(dependencyRegistry.affectedCommandCatalog) as Array<{ arguments: string[]; nonMutating: boolean }>) {
      expect(command.nonMutating).toBe(true);
      expect(command.arguments).toContain('--no-write');
    }
    for (const path of [
      'scripts/run-data-store-smoke-regression.mjs',
      'scripts/verify-remaining-package-local-foundation.mjs',
      'scripts/verify-data-store-smoke.mjs',
      'scripts/verify-32-q-ppk-021-platform-policy-ast-gate-runtime.mjs',
      'scripts/verify-32-r-ppk-022-capability-manifest-gate-contract.mjs',
      'scripts/verify-32-r-ppk-022-capability-manifest-gate-runtime.mjs',
      'scripts/verify-32-k-ppk-015-network-egress-contract.mjs',
      'scripts/verify-32-k-ppk-015-network-egress-runtime.mjs',
      'scripts/verify-platform-policy-ast-gate.mjs',
      'scripts/verify-platform-policy-gate.mjs',
      'scripts/verify-platform-capability-manifest-gate.mjs',
      'scripts/verify-application-security-profile-gate.mjs',
      'scripts/verify-database-migrations.mjs',
      'scripts/verify-core-service-boundary.mjs',
      'scripts/verify-30-o-core-service-entrypoint-runtime.mjs',
      'scripts/verify-desktop-core-service-startup-contract.mjs',
      'scripts/verify-desktop-core-service-startup-runtime.mjs'
    ]) {
      const source = await readFile(path, 'utf8');
      expect(source).toContain("process.argv.includes('--no-write')");
      expect(source).toContain('if (!noWrite)');
    }
    for (const path of [
      'scripts/verify-34-b-communication-messaging-lifecycle-privacy-presence-runtime.mjs',
      'scripts/verify-34-c-realtime-calling-media-accessible-ux-runtime.mjs',
      'scripts/verify-34-d-explicit-consent-recording-media-retention-runtime.mjs',
      'scripts/verify-34-e-local-first-translation-caption-language-provider-runtime.mjs',
      'scripts/verify-34-f-family-meetings-decisions-consent-minutes-runtime.mjs'
    ]) {
      const source = await readFile(path, 'utf8');
      expect(source).toContain("join(dirname(process.execPath),'node_modules','npm','bin','npm-cli.js')");
      expect(source).toContain("typeof candidate==='string'&&existsSync(candidate)");
      expect(source).toContain("if(!npmCli)throw new Error('A trusted npm CLI could not be resolved from the active Node installation.')");
      expect(source).not.toContain("const npmCli=process.env.npm_execpath??");
      expect(source).toContain("const governedNpmRun=script=>npmArgs(['run',script,...(noWrite?['--','--no-write']:[])]);");
      for (const script of [
        'verify:migrations',
        'verify:ppk021:runtime',
        'verify:ppk022:runtime',
        'verify:ppk015:egress:runtime'
      ]) expect(source).toContain(`governedNpmRun('${script}')`);
      if (source.includes("'verify:data-store-smoke'")) {
        expect(source).toContain("governedNpmRun('verify:data-store-smoke')");
      }
      expect(source).not.toMatch(/npmArgs\(\['run','verify:(?:migrations|data-store-smoke|ppk021:runtime|ppk022:runtime|ppk015:egress:runtime)'\]\)/u);
    }
    for (const path of [
      'scripts/verify-product-surface-governance.mjs',
      'scripts/verify-desktop-security-boundary.mjs',
      'scripts/verify-sensitive-data-consent-boundary.mjs',
      'scripts/verify-b4-banking-foundation-boundary.mjs',
      'scripts/verify-b4-payment-card-management-boundary.mjs',
      'scripts/verify-b4-loan-management-boundary.mjs',
      'scripts/verify-b4-finance-planning-portfolio-analytics-boundary.mjs',
      'scripts/verify-b4-controlled-import-open-banking-boundary.mjs',
      'scripts/verify-33-m-accessibility-boundary.mjs',
      'scripts/verify-33-n-draft-async-state-ux-boundary.mjs'
    ]) {
      const source = await readFile(path, 'utf8');
      expect(pkg.scripts.pretypecheck).toContain(`node ${path} --no-write`);
      expect(pkg.scripts.prebuild).toContain(`node ${path} --no-write`);
      expect(source).toContain('const cliArguments = process.argv.slice(2);');
      expect(source).toContain("cliArguments.length > 1 || cliArguments.some((argument) => argument !== '--no-write')");
      expect(source).toContain("process.argv.includes('--no-write')");
      expect(source).toContain('if (!noWrite)');
    }
    for (const path of [
      'scripts/verify-33-y-local-first-smart-home-energy-runtime.mjs',
      'scripts/verify-33-z-signed-plugin-external-provider-platform-runtime.mjs',
      'scripts/verify-34-a-communication-policy-mls-foundation-runtime.mjs',
      'scripts/verify-33-r-archive-evidence-relations-media-lifecycle-unified-authorized-search-runtime.mjs'
    ]) {
      const source = await readFile(path, 'utf8');
      expect(source).toMatch(/const governedNodeScript\s*=\s*\(?(?:path)\)?\s*=>\s*\[path,\s*\.\.\.\(noWrite\s*\?\s*\['--no-write'\]\s*:\s*\[\]\)\];/u);
      for (const script of [
        'scripts/verify-database-migrations.mjs',
        'scripts/verify-data-store-smoke.mjs',
        'scripts/verify-platform-policy-ast-gate.mjs',
        'scripts/verify-platform-capability-manifest-gate.mjs'
      ]) expect(source).toContain(`governedNodeScript('${script}')`);
    }
    const ppk022RuntimeSource = await readFile('scripts/verify-32-r-ppk-022-capability-manifest-gate-runtime.mjs', 'utf8');
    expect(ppk022RuntimeSource).toContain("['scripts/verify-desktop-core-service-startup-runtime-wrapper.mjs', ...noWriteArgs]");
    const startupRuntimeWrapperSource = await readFile('scripts/verify-desktop-core-service-startup-runtime-wrapper.mjs', 'utf8');
    expect(startupRuntimeWrapperSource).toContain("process.argv.includes('--no-write')");
    expect(startupRuntimeWrapperSource).toContain("...(noWrite ? ['--no-write'] : [])");
    const remainingFoundationSource = await readFile('scripts/verify-remaining-package-local-foundation.mjs', 'utf8');
    expect(remainingFoundationSource).toContain("const governedNodeScript=path=>[resolve(root,path),...(noWrite?['--no-write']:[])];");
    for (const script of [
      'scripts/verify-database-migrations.mjs',
      'scripts/verify-platform-policy-ast-gate.mjs',
      'scripts/verify-platform-capability-manifest-gate.mjs'
    ]) {
      expect(remainingFoundationSource).toContain(`governedNodeScript('${script}')`);
      expect(remainingFoundationSource).not.toContain(`[resolve(root,'${script}')]`);
    }
  });

  it('derives exact records, Vitest files and non-mutating commands for every changed path', async () => {
    const registry = validateChangeImpactDependencyRegistry(JSON.parse(
      await readFile('config/change-impact-dependency-registry.json', 'utf8')
    ));
    const ppk015Rule = registry.pathRules.find((rule: { id: string }) => rule.id === 'ppk015-network-egress-policy-full-chain');
    expect(ppk015Rule).toBeDefined();
    expect(ppk015Rule.match.exactPaths).toContain('config/32-k-ppk-015-network-egress-policy-scope.json');
    expect(ppk015Rule.dependentRecords).not.toContain('config/32-k-ppk-015-network-egress-policy-scope.json');
    expect(ppk015Rule.dependentRecords).toContain('config/ppk-015-network-egress-current-ratchet.json');
    expect(ppk015Rule.affectedVitestFiles).toContain('apps/desktop/tests/ppk015-network-egress-governance-ratchet.test.ts');
    expect(ppk015Rule.match.exactPaths).toContain('scripts/verify-network-egress-boundary.mjs');
    const helperPlan = resolveChangeImpactDependencies({
      registry,
      changedFiles: ['scripts/verify-network-egress-boundary.mjs']
    });
    const helperCommands = helperPlan.requiredCommands.filter((id) => id.startsWith('affectedCommand:'));
    expect(helperCommands).toEqual(expect.arrayContaining([
      'affectedCommand:ppk015NetworkEgressContract',
      'affectedCommand:ppk015NetworkEgressRuntime',
      'affectedCommand:signedPluginProviderRuntime',
      'affectedCommand:communicationPolicyMlsRuntime',
      'affectedCommand:e2eeFileSharingRemainingRuntime',
      'affectedCommand:communicationAuditArchiveRuntime',
      'affectedCommand:distributedCoreConsensusTenancyRuntime',
      'affectedCommand:distributedClientsOperationsDrRuntime',
      'affectedCommand:windowsResilienceUniversalUxRuntime'
    ]));
    expect(helperCommands).not.toEqual(expect.arrayContaining([
      'affectedCommand:e2eeFileSharingRemainingBoundary',
      'affectedCommand:e2eeFileSharingRemainingContract'
    ]));
    const sharedPlan = resolveChangeImpactDependencies({
      registry,
      changedFiles: ['scripts/verify-remaining-package-local-foundation.mjs']
    });
    const sharedCommands = sharedPlan.requiredCommands.filter((id) => id.startsWith('affectedCommand:'));
    expect(sharedCommands).toHaveLength(15);
    expect(sharedCommands).toEqual(expect.arrayContaining([
      'affectedCommand:e2eeFileSharingRemainingBoundary',
      'affectedCommand:e2eeFileSharingRemainingContract',
      'affectedCommand:e2eeFileSharingRemainingRuntime',
      'affectedCommand:communicationAuditArchiveBoundary',
      'affectedCommand:communicationAuditArchiveContract',
      'affectedCommand:communicationAuditArchiveRuntime',
      'affectedCommand:distributedCoreConsensusTenancyBoundary',
      'affectedCommand:distributedCoreConsensusTenancyContract',
      'affectedCommand:distributedCoreConsensusTenancyRuntime',
      'affectedCommand:distributedClientsOperationsDrBoundary',
      'affectedCommand:distributedClientsOperationsDrContract',
      'affectedCommand:distributedClientsOperationsDrRuntime',
      'affectedCommand:windowsResilienceUniversalUxBoundary',
      'affectedCommand:windowsResilienceUniversalUxContract',
      'affectedCommand:windowsResilienceUniversalUxRuntime'
    ]));
    const plan = resolveChangeImpactDependencies({
      registry,
      changedFiles: [
        '.gitattributes',
        'apps/desktop/tests/data-store.test.ts',
        'apps/desktop/src/renderer/App.tsx',
        'scripts/run-windows-installer-experience-uat.ps1',
        'scripts/verify-data-store-smoke.mjs',
        'scripts/verify-33-q-local-governed-ocr-derived-data-pipeline-runtime.mjs',
        'scripts/verify-33-r-archive-evidence-relations-media-lifecycle-unified-authorized-search-boundary.mjs',
        'scripts/verify-33-y-local-first-smart-home-energy-boundary.mjs',
        'scripts/verify-33-z-signed-plugin-external-provider-platform-boundary.mjs',
        'scripts/verify-34-a-communication-policy-mls-foundation-boundary.mjs',
        'scripts/verify-34-b-communication-messaging-lifecycle-privacy-presence-boundary.mjs',
        'scripts/verify-34-c-realtime-calling-media-accessible-ux-boundary.mjs',
        'scripts/verify-34-d-explicit-consent-recording-media-retention-boundary.mjs',
        'scripts/verify-34-f-family-meetings-decisions-consent-minutes-contract.mjs',
        'tools/windows-packager/package-lock.json'
      ]
    });
    expect(plan.affectedVitestFiles).toEqual(expect.arrayContaining([
      'apps/desktop/tests/data-store.test.ts',
      'apps/desktop/tests/ppk025-software-supply-chain-gates.test.ts',
      'apps/desktop/tests/windows-installer-experience-uat-contract.test.ts',
      'packages/database/family-database-authoritative-receipt-time.test.ts'
    ]));
    expect(plan.dependentRecords).toEqual(expect.arrayContaining([
      'manifest.json', 'SHA256SUMS.txt',
      'config/32-q-ppk-021-platform-policy-ast-gate-inventory.json',
      'config/ppk-015-network-egress-current-ratchet.json',
      'config/33-q-local-governed-ocr-derived-data-pipeline-inventory.json',
      'config/33-r-archive-evidence-relations-media-lifecycle-unified-authorized-search-inventory.json',
      'config/33-y-local-first-smart-home-energy-inventory.json',
      'config/33-z-signed-plugin-external-provider-platform-inventory.json',
      'config/34-a-communication-policy-mls-foundation-inventory.json',
      'config/34-b-communication-messaging-lifecycle-privacy-presence-inventory.json',
      'config/34-c-realtime-calling-media-accessible-ux-inventory.json',
      'config/34-d-explicit-consent-recording-media-retention-inventory.json',
      'config/34-f-family-meetings-decisions-consent-minutes-inventory.json'
    ]));
    expect(plan.changedPathDependencies.find((entry) => entry.path === '.gitattributes')).toMatchObject({
      ruleIds: ['governed-source-safety-net']
    });
    expect(plan.changedPathDependencies.find((entry) => entry.path === 'tools/windows-packager/package-lock.json')).toMatchObject({
      ruleIds: ['governed-source-safety-net', 'isolated-windows-packager-toolchain']
    });
    expect(plan.requiredCommands).toEqual(expect.arrayContaining([
      'rootTypecheck',
      'affectedCommand:dataStoreSmoke',
      'affectedCommand:platformPolicyAstRuntime',
      'affectedCommand:ppk015NetworkEgressContract',
      'affectedCommand:ppk015NetworkEgressRuntime',
      'affectedCommand:localGovernedOcrBoundary',
      'affectedCommand:localGovernedOcrContract',
      'affectedCommand:localGovernedOcrRuntime',
      'affectedCommand:archiveEvidenceRelationsBoundary',
      'affectedCommand:archiveEvidenceRelationsContract',
      'affectedCommand:archiveEvidenceRelationsRuntime',
      'affectedCommand:smartHomeEnergyBoundary',
      'affectedCommand:smartHomeEnergyContract',
      'affectedCommand:smartHomeEnergyRuntime',
      'affectedCommand:signedPluginProviderBoundary',
      'affectedCommand:signedPluginProviderContract',
      'affectedCommand:signedPluginProviderRuntime',
      'affectedCommand:communicationPolicyMlsBoundary',
      'affectedCommand:communicationPolicyMlsContract',
      'affectedCommand:communicationPolicyMlsRuntime',
      'affectedCommand:communicationMessagingBoundary',
      'affectedCommand:communicationMessagingContract',
      'affectedCommand:communicationMessagingRuntime',
      'affectedCommand:realtimeCallingBoundary',
      'affectedCommand:realtimeCallingContract',
      'affectedCommand:realtimeCallingRuntime',
      'affectedCommand:recordingRetentionBoundary',
      'affectedCommand:recordingRetentionContract',
      'affectedCommand:recordingRetentionRuntime',
      'affectedCommand:familyMeetingsBoundary',
      'affectedCommand:familyMeetingsContract',
      'affectedCommand:familyMeetingsRuntime',
      'changedMjsSyntax:scripts/verify-data-store-smoke.mjs',
      'changedMjsSyntax:scripts/verify-33-q-local-governed-ocr-derived-data-pipeline-runtime.mjs',
      'changedMjsSyntax:scripts/verify-33-r-archive-evidence-relations-media-lifecycle-unified-authorized-search-boundary.mjs',
      'changedMjsSyntax:scripts/verify-33-y-local-first-smart-home-energy-boundary.mjs',
      'changedMjsSyntax:scripts/verify-33-z-signed-plugin-external-provider-platform-boundary.mjs',
      'changedMjsSyntax:scripts/verify-34-a-communication-policy-mls-foundation-boundary.mjs',
      'changedMjsSyntax:scripts/verify-34-b-communication-messaging-lifecycle-privacy-presence-boundary.mjs',
      'changedMjsSyntax:scripts/verify-34-c-realtime-calling-media-accessible-ux-boundary.mjs',
      'changedMjsSyntax:scripts/verify-34-d-explicit-consent-recording-media-retention-boundary.mjs',
      'changedMjsSyntax:scripts/verify-34-f-family-meetings-decisions-consent-minutes-contract.mjs',
      'changedPs1Parser:scripts/run-windows-installer-experience-uat.ps1'
    ]));
    expect(() => resolveChangeImpactDependencies({ registry, changedFiles: ['UNMAPPED_ROOT_FILE.xyz'] }))
      .toThrow(/no fail-closed dependency mapping/u);
  });

  it('accepts only measured non-negative Vitest JSON counters', () => {
    expect(parseVitestJsonSummary({
      numPassedTestSuites: 4, numFailedTestSuites: 0,
      numPassedTests: 21, numFailedTests: 0, numPendingTests: 2
    })).toEqual({ testFilesPassed: 4, testFilesFailed: 0, testsPassed: 21, testsFailed: 0, testsSkipped: 2 });
    expect(() => parseVitestJsonSummary({
      numPassedTestSuites: 1, numFailedTestSuites: -1,
      numPassedTests: 1, numFailedTests: 0, numPendingTests: 0
    })).toThrow(/numFailedTestSuites/u);
  });

  it('records only governed relative failed test identities without stack or message payloads', () => {
    const root = join(tmpdir(), 'parsyuva-vitest-failure-root');
    expect(parseVitestJsonFailureInventory({ testResults: [
      {
        name: join(root, 'apps', 'desktop', 'tests', 'z.test.ts'), status: 'failed',
        assertionResults: [{ status: 'failed', fullName: 'Z zinciri reddeder', failureMessages: ['secret stack'] }]
      },
      {
        name: join(root, 'apps', 'desktop', 'tests', 'a.test.ts'), status: 'failed',
        assertionResults: []
      },
      {
        name: join(root, 'apps', 'desktop', 'tests', 'pass.test.ts'), status: 'passed',
        assertionResults: [{ status: 'passed', fullName: 'PASS' }]
      }
    ] }, { root })).toEqual([
      { file: 'apps/desktop/tests/a.test.ts', failureKind: 'SUITE_IMPORT', testName: null },
      { file: 'apps/desktop/tests/z.test.ts', failureKind: 'TEST', testName: 'Z zinciri reddeder' }
    ]);
    expect(() => parseVitestJsonFailureInventory({ testResults: [{
      name: join(root, '..', 'outside.test.ts'), status: 'failed', assertionResults: []
    }] }, { root })).toThrow(/outside/u);
  });

  it('rejects arbitrary Vitest options, absolute paths and traversal', () => {
    expect(validateTargetedTestFiles(['apps/desktop/tests/safe.test.ts'])).toEqual(['apps/desktop/tests/safe.test.ts']);
    for (const value of [
      '--config=evil.ts', '-t', 'apps/desktop/tests/../evil.test.ts',
      'C:/tmp/evil.test.ts', '/tmp/evil.test.ts', 'apps/desktop/tests/evil.test.tsx'
    ]) expect(() => validateTargetedTestFiles([value])).toThrow(/Forbidden targeted Vitest argument or path/u);
  });

  it('keeps the external baseline ledger exclusive, contiguous and tamper evident', async () => {
    const externalRoot = await mkdtemp(join(tmpdir(), 'pr235-baseline-chain-'));
    const record = (commit: string, baselineType = 'PRE_MUTATION') => ({
      schemaVersion: 2, id: 'PPT-MUTATION-BASELINE-EXTERNAL-V2', requirement: 'PR-235', decision: 'DEC-270',
      strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275',
      evidenceKind: 'PRE_MUTATION_BASELINE_EXTERNAL', status: 'PASS', baselineType,
      bootstrapDecision: baselineType === 'BOOTSTRAP_ADOPTION' ? 'DEC-270_INITIAL_ACTIVATION_ONLY' : null,
      fullDiffRequired: baselineType === 'BOOTSTRAP_ADOPTION',
      sourceProvenance: { headCommit: commit },
      operationRuleBinding: { status: 'PASS', kind: 'mutation', operation: 'record-pre-mutation-baseline', sha256: '1'.repeat(64) },
      producer: { path: 'scripts/record-mutation-baseline.mjs', sha256: '2'.repeat(64) }
    });
    try {
      const first = await appendExternalBaselineRecord({ record: record('a'.repeat(40)), externalRoot });
      await expect(appendExternalBaselineRecord({ record: record(BOOTSTRAP_ADOPTION_BASE_COMMIT, 'BOOTSTRAP_ADOPTION'), externalRoot }))
        .rejects.toThrow(/only as the first/u);
      const value = JSON.parse(await readFile(first.fullPath, 'utf8'));
      value.chain.previousRecordSha256 = 'f'.repeat(64);
      await writeFile(first.fullPath, `${JSON.stringify(value, null, 2)}\n`);
      await expect(readExternalBaselineChain({ externalRoot })).rejects.toThrow(/hash link is broken/u);
    } finally {
      await rm(externalRoot, { recursive: true, force: true });
    }
  });
});
