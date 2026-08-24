import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { assertMatchingReleaseSourceProvenance, captureReleaseSourceProvenance } from './lib/release-source-provenance.mjs';
import {
  createDependencyAssessmentContract, currentEvidenceIdentity, loadCanonicalProducerBindings, loadMutationEvidencePolicy,
  parseVitestJsonSummary, readEvidenceBinding, readRepoFileBinding, renderCommand,
  resolveChangeImpactDependencies, sha256Bytes, snapshotMutationEvidenceAndToolchain,
  validateTargetedTestFiles, writeEvidenceReceipt
} from './lib/mutation-release-evidence.mjs';

const kindIndex = process.argv.indexOf('--kind');
const kind = kindIndex >= 0 ? process.argv[kindIndex + 1] : undefined;
if (!new Set(['targeted', 'full']).has(kind)) throw new Error('--kind targeted|full is required.');
const separator = process.argv.indexOf('--');
const requested = separator >= 0 ? process.argv.slice(separator + 1) : [];
const structuralArgs = process.argv.slice(2, separator >= 0 ? separator : undefined);
if (JSON.stringify(structuralArgs) !== JSON.stringify(['--kind', kind])) throw new Error('Only --kind targeted|full is accepted before --.');
if (kind === 'full' && requested.length !== 0) throw new Error('Full regression evidence accepts no filters or files.');

const root = process.cwd();
const { policy, registry, dependencyRegistry, dependencyRegistryBinding } = await loadMutationEvidencePolicy(root);
const impactAnalysisBinding = await readEvidenceBinding(root, policy.defaultEvidence.impactAnalysis, 'impactAnalysis evidence');
const dependencyPlan = resolveChangeImpactDependencies({
  registry: dependencyRegistry,
  changedFiles: impactAnalysisBinding.value.changedFiles
});
const dependencyAssessment = createDependencyAssessmentContract({ plan: dependencyPlan, registryBinding: dependencyRegistryBinding });
if (JSON.stringify(impactAnalysisBinding.value.dependencyPlan) !== JSON.stringify(dependencyAssessment)) {
  throw new Error('Impact analysis dependency plan does not match the live change-impact registry.');
}
const targetFiles = kind === 'targeted' ? validateTargetedTestFiles(requested) : [];
if (kind === 'targeted'
  && JSON.stringify(targetFiles) !== JSON.stringify(dependencyPlan.affectedVitestFiles)) {
  throw new Error('Targeted Vitest files must exactly equal the affected files derived from changed paths.');
}
if (kind === 'targeted') await Promise.all(targetFiles.map((path) => readRepoFileBinding(root, path, `targeted test ${path}`)));
const [before, producers, guardBefore] = await Promise.all([
  captureReleaseSourceProvenance({ root, expectedChannel: 'Bronze' }),
  loadCanonicalProducerBindings(root, policy),
  snapshotMutationEvidenceAndToolchain(root)
]);
const priorSpecs = kind === 'targeted'
  ? [['baselinePointer', policy.defaultEvidence.baseline], ['assessment', policy.defaultInput.impactAssessment]]
  : [['targetedTest', policy.defaultEvidence.targetedTest]];
const prior = {
  impactAnalysis: impactAnalysisBinding,
  ...Object.fromEntries(await Promise.all(priorSpecs.map(async ([id, path]) => [id, await readEvidenceBinding(root, path, `${id} evidence`)])))
};
const vitestCli = resolve(root, 'node_modules/vitest/vitest.mjs');
const vitestArgs = ['run', ...targetFiles, '--maxWorkers=1', '--reporter=json'];
const startedAt = new Date().toISOString();
const execution = spawnSync(process.execPath, [vitestCli, ...vitestArgs], {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true,
  maxBuffer: 256 * 1024 * 1024
});
if (execution.error) throw execution.error;
const measuredCommand = ({ id, executable, arguments: args, changedPath = null }) => {
  const resolvedExecutable = executable === 'node' ? process.execPath : executable;
  const startedAt = new Date().toISOString();
  const result = spawnSync(resolvedExecutable, args, {
    cwd: root,
    encoding: null,
    windowsHide: true,
    maxBuffer: 256 * 1024 * 1024
  });
  if (result.error) throw result.error;
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? '');
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.from(result.stderr ?? '');
  return Object.freeze({
    id,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exitCode: result.status,
    executable,
    arguments: args,
    command: renderCommand(executable, args),
    changedPath,
    stdout: { sizeBytes: stdout.length, sha256: sha256Bytes(stdout) },
    stderr: { sizeBytes: stderr.length, sha256: sha256Bytes(stderr) },
    startedAt,
    completedAt: new Date().toISOString()
  });
};
const additionalCommands = [];
if (kind === 'full') {
  const matrix = dependencyRegistry.commandMatrix;
  additionalCommands.push(measuredCommand({
    id: 'rootTypecheck', executable: matrix.rootTypecheck.executable, arguments: matrix.rootTypecheck.arguments
  }));
  for (const requiredId of dependencyPlan.requiredCommands.filter((id) => id.startsWith('affectedCommand:'))) {
    const commandId = requiredId.slice('affectedCommand:'.length);
    const command = dependencyRegistry.affectedCommandCatalog[commandId];
    additionalCommands.push(measuredCommand({
      id: requiredId, executable: command.executable, arguments: command.arguments
    }));
  }
  for (const path of impactAnalysisBinding.value.changedFiles.filter((value) => value.endsWith('.mjs')).sort()) {
    await readRepoFileBinding(root, path, `changed MJS ${path}`);
    additionalCommands.push(measuredCommand({
      id: `changedMjsSyntax:${path}`,
      executable: matrix.changedMjsSyntax.executable,
      arguments: [...matrix.changedMjsSyntax.argumentPrefix, path],
      changedPath: path
    }));
  }
  for (const path of impactAnalysisBinding.value.changedFiles.filter((value) => value.endsWith('.ps1')).sort()) {
    await readRepoFileBinding(root, path, `changed PowerShell ${path}`);
    additionalCommands.push(measuredCommand({
      id: `changedPs1Parser:${path}`,
      executable: matrix.changedPs1Parser.executable,
      arguments: matrix.changedPs1Parser.arguments.map((value) => value === '{changedPath}' ? path : value),
      changedPath: path
    }));
  }
}
let vitest;
try { vitest = JSON.parse(execution.stdout); }
catch { throw new Error(`Vitest JSON output could not be parsed: ${execution.stdout.slice(0, 500)}`); }
const summary = parseVitestJsonSummary(vitest);
const [after, guardAfter] = await Promise.all([
  captureReleaseSourceProvenance({ root, expectedChannel: 'Bronze' }),
  snapshotMutationEvidenceAndToolchain(root)
]);
assertMatchingReleaseSourceProvenance(after.provenance, before.provenance, `${kind} test source`);
if (guardBefore.sha256 !== guardAfter.sha256) throw new Error('Validation receipts or Vitest toolchain changed during governed test execution.');
const passed = execution.status === 0 && summary.testFilesPassed > 0 && summary.testsPassed > 0
  && summary.testFilesFailed === 0 && summary.testsFailed === 0;
const commandMatrixPassed = additionalCommands.every((entry) => entry.status === 'PASS' && entry.exitCode === 0);
const outputPath = kind === 'targeted' ? policy.defaultEvidence.targetedTest : policy.defaultEvidence.fullRegression;
const chain = kind === 'targeted'
  ? { baselinePointerSha256: prior.baselinePointer.sha256, impactAnalysisSha256: prior.impactAnalysis.sha256, assessmentSha256: prior.assessment.sha256 }
  : { targetedTestSha256: prior.targetedTest.sha256, impactAnalysisSha256: prior.impactAnalysis.sha256 };
const receipt = {
  schemaVersion: 2,
  id: kind === 'targeted' ? 'PPT-MUTATION-TARGETED-TEST-V2' : 'PPT-MUTATION-FULL-REGRESSION-V2',
  requirement: 'PR-235',
  decision: 'DEC-270',
  strengthenedByRequirement: 'PR-240',
  strengthenedByDecision: 'DEC-275',
  release: registry.effectiveRelease,
  evidenceKind: kind === 'targeted' ? 'TARGETED_TEST' : 'FULL_REGRESSION',
  status: passed ? 'PASS' : 'FAIL',
  exitCode: execution.status,
  ...currentEvidenceIdentity({ provenance: before.provenance, registry }),
  producer: kind === 'targeted' ? producers.targetedTest : producers.fullRegression,
  targetFiles,
  command: renderCommand(process.execPath, [vitestCli, ...vitestArgs]),
  commandArguments: vitestArgs,
  dependencyRegistry: {
    path: dependencyRegistryBinding.path,
    sizeBytes: dependencyRegistryBinding.sizeBytes,
    sha256: dependencyRegistryBinding.sha256
  },
  dependencyPlan: dependencyAssessment,
  additionalCommandCount: additionalCommands.length,
  additionalCommands,
  additionalCommandsSha256: sha256Bytes(Buffer.from(JSON.stringify(additionalCommands))),
  vitestOutput: {
    stdoutSizeBytes: Buffer.byteLength(execution.stdout ?? '', 'utf8'),
    stdoutSha256: sha256Bytes(Buffer.from(execution.stdout ?? '', 'utf8')),
    stderrSizeBytes: Buffer.byteLength(execution.stderr ?? '', 'utf8'),
    stderrSha256: sha256Bytes(Buffer.from(execution.stderr ?? '', 'utf8'))
  },
  chain,
  executionGuard: {
    beforeSha256: guardBefore.sha256,
    afterSha256: guardAfter.sha256,
    validationFileCount: guardBefore.validation.length,
    toolchainBindings: guardBefore.toolchain
  },
  ...summary,
  startedAt,
  generatedAt: new Date().toISOString()
};
if (kind === 'full' && !commandMatrixPassed) receipt.status = 'FAIL';
await writeEvidenceReceipt(root, outputPath, receipt);
if (execution.stderr) process.stderr.write(execution.stderr);
console.log(`${receipt.evidenceKind}: ${receipt.status} / ${summary.testFilesPassed} files / ${summary.testsPassed} tests.`);
if (!passed || !commandMatrixPassed) process.exitCode = 1;
