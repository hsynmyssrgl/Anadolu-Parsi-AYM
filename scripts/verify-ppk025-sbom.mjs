import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  buildDeterministicSbom,
  canonicalJson,
  prettyCanonicalJson,
  sha256Bytes,
  sha256Text
} from './lib/ppk025-software-supply-chain.mjs';

const policyPath = 'config/32-u-ppk-025-software-supply-chain-policy.json';
const sbomPath = 'artifacts/manifests/32-U-ppk-025-cyclonedx-sbom.json';
const reportPath = 'artifacts/validation/32-U-ppk-025-sbom-verification.json';
const policy = JSON.parse(await readFile(policyPath, 'utf8'));
const actualBytes = await readFile(sbomPath);
const actual = JSON.parse(actualBytes.toString('utf8'));
const lockfiles = policy.lockfiles.map((item) => ({ scope: item.scope, lockfilePath: item.path }));
const { document: expected, report: expectedReport } = await buildDeterministicSbom({ release: policy.release, lockfiles });
const checks = [];
const failures = [];
const check = (name, condition) => {
  checks.push({ name, passed: Boolean(condition) });
  if (!condition) failures.push(name);
};
const componentRefs = actual.components?.map((item) => item['bom-ref']) ?? [];
const dependencyRefs = actual.dependencies?.map((item) => item.ref) ?? [];
check('SBOM bytes are canonical and deterministic', actualBytes.toString('utf8') === prettyCanonicalJson(actual));
check('SBOM exactly matches both current lock graphs', canonicalJson(actual) === canonicalJson(expected));
check('CycloneDX identity and version are exact', actual.bomFormat === 'CycloneDX' && actual.specVersion === '1.6' && actual.version === 1);
check('random serial number is omitted', actual.serialNumber === undefined);
check('wall-clock timestamp is omitted', actual.metadata?.timestamp === undefined);
check('component count is exact', actual.components?.length === expectedReport.componentCount && actual.components.length === policy.requiredSbomComponentCount);
check('every bom-ref is unique', new Set(componentRefs).size === componentRefs.length);
check('dependency graph has one node per component', dependencyRefs.length === componentRefs.length && dependencyRefs.length === policy.requiredDependencyNodeCount && new Set(dependencyRefs).size === dependencyRefs.length);
check('dependency graph references only known components', actual.dependencies.every((edge) => componentRefs.includes(edge.ref) && edge.dependsOn.every((ref) => componentRefs.includes(ref))));
check('every external component carries SHA-512 and declared license', actual.components.filter((item) => item.properties?.some((property) => property.name === 'ppt:integrity')).every((item) => item.hashes?.some((hash) => hash.alg === 'SHA-512' && /^[a-f0-9]{128}$/u.test(hash.content)) && item.licenses?.length === 1));
check('both lockfile hashes are bound', expectedReport.lockfiles.length === 2 && expectedReport.lockfiles.every((item) => /^[a-f0-9]{64}$/u.test(item.sha256)));
check('external component coverage is exact', expectedReport.externalComponentCount === policy.requiredRegistryPackageCount);
const report = {
  schemaVersion: 1,
  step: '32-U',
  requirement: 'PPK-025',
  status: failures.length ? 'FAIL' : 'PASS',
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  failures,
  sbomPath,
  sbomSha256: sha256Bytes(actualBytes),
  componentCount: actual.components?.length ?? 0,
  externalComponentCount: expectedReport.externalComponentCount,
  dependencyNodeCount: actual.dependencies?.length ?? 0,
  lockfiles: expectedReport.lockfiles
};
await mkdir(dirname(resolve(reportPath)), { recursive: true });
await writeFile(reportPath, prettyCanonicalJson(report));
console.log(`PPK-025 SBOM verification: ${report.status} (${report.passed}/${report.checkCount}, sha256=${sha256Text(prettyCanonicalJson(actual)).slice(0, 12)}).`);
if (failures.length) process.exitCode = 1;
