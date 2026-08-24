import { verifySourceManifestIntegrity, writeIntegrityReport } from './lib/source-manifest.mjs';
import { captureReleaseSourceProvenance } from './lib/release-source-provenance.mjs';
import {
  currentEvidenceIdentity, loadCanonicalProducerBindings, loadMutationEvidencePolicy,
  readEvidenceBinding, readRepoFileBinding, writeEvidenceReceipt
} from './lib/mutation-release-evidence.mjs';

const cliArgs = process.argv.slice(2);
const noReport = cliArgs.includes('--no-report');
const releaseEvidence = cliArgs.includes('--release-evidence');
const optionValue = (name, fallback) => {
  const index = cliArgs.indexOf(name);
  if (index < 0) return fallback;
  const value = cliArgs[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};

const reportPath = optionValue('--report', 'artifacts/validation/source-integrity.json');
let report;
try {
  report = await verifySourceManifestIntegrity('.');
  if (releaseEvidence) {
    if (JSON.stringify(cliArgs) !== JSON.stringify([
      '--release-evidence', '--report', 'artifacts/validation/mutation-source-integrity.json'
    ])) throw new Error('Release source-integrity evidence accepts only its fixed canonical arguments.');
    const root = process.cwd();
    const { policy, registry } = await loadMutationEvidencePolicy(root);
    const [source, producers, impact, targeted, full, manifest, sha256Sums] = await Promise.all([
      captureReleaseSourceProvenance({ root: process.cwd(), expectedChannel: 'Bronze' }),
      loadCanonicalProducerBindings(root, policy),
      readEvidenceBinding(root, policy.defaultEvidence.impactAnalysis, 'mutation impact evidence'),
      readEvidenceBinding(root, policy.defaultEvidence.targetedTest, 'mutation targeted evidence'),
      readEvidenceBinding(root, policy.defaultEvidence.fullRegression, 'mutation full regression evidence'),
      readRepoFileBinding(root, 'manifest.json', 'source integrity manifest'),
      readRepoFileBinding(root, 'SHA256SUMS.txt', 'source integrity SHA256SUMS')
    ]);
    report = {
      ...report,
      schemaVersion: 2,
      id: 'PPT-MUTATION-SOURCE-INTEGRITY-V2',
      requirement: 'PR-235', decision: 'DEC-270',
      strengthenedByRequirement: 'PR-240', strengthenedByDecision: 'DEC-275',
      release: registry.effectiveRelease,
      evidenceKind: 'SOURCE_INTEGRITY',
      exitCode: report.status === 'PASS' ? 0 : 1,
      ...currentEvidenceIdentity({ provenance: source.provenance, registry }),
      producer: producers.sourceIntegrity,
      commandArguments: cliArgs,
      chain: {
        impactAnalysisSha256: impact.sha256,
        targetedTestSha256: targeted.sha256,
        fullRegressionSha256: full.sha256
      },
      manifestBindings: {
        manifest: { path: manifest.path, sizeBytes: manifest.sizeBytes, sha256: manifest.sha256 },
        sha256Sums: { path: sha256Sums.path, sizeBytes: sha256Sums.sizeBytes, sha256: sha256Sums.sha256 }
      },
      generatedAt: new Date().toISOString()
    };
  }
} catch (error) {
  report = {
    schemaVersion: 1,
    product: 'Anadolu Parsı Aile Yaşam Merkezi',
    packageVersion: null,
    manifestSchemaVersion: null,
    manifestFileCount: 0,
    actualSourceFileCount: 0,
    sha256EntryCount: 0,
    symlinksAllowed: false,
    status: 'FAIL',
    failures: [error instanceof Error ? error.message : String(error)]
  };
}
if (!noReport) {
  if (releaseEvidence) await writeEvidenceReceipt(process.cwd(), reportPath, report);
  else await writeIntegrityReport(reportPath, report);
}
console.log(`Source integrity: ${report.status} — manifest=${report.manifestFileCount}, source=${report.actualSourceFileCount}, sha256=${report.sha256EntryCount}`);
for (const failure of report.failures.slice(0, 50)) console.error(`- ${failure}`);
if (report.status !== 'PASS') process.exitCode = 1;
