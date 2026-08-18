import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const POLICY_PATH = 'packages/platform-policy/src/supply-chain-release-policy.ts';
const POLICY_INDEX = 'packages/platform-policy/src/index.ts';
const DOMAIN_PATH = 'packages/domain/src/supply-chain-release.ts';
const DOMAIN_INDEX = 'packages/domain/src/index.ts';
const USE_CASE_PATH = 'packages/application/src/supply-chain-release-use-cases.ts';
const APPLICATION_INDEX = 'packages/application/src/index.ts';
const POLICY_TEST = 'packages/platform-policy/supply-chain-release-policy.test.ts';
const APPLICATION_TEST = 'packages/application/tests/supply-chain-release-use-cases.test.ts';
const DESKTOP_TEST = 'apps/desktop/tests/ppk025-software-supply-chain-gates.test.ts';
const AUTHORIZED_CANONICAL_REFERENCES = new Set([
  POLICY_PATH,
  POLICY_INDEX,
  DOMAIN_PATH,
  DOMAIN_INDEX,
  USE_CASE_PATH,
  APPLICATION_INDEX,
  POLICY_TEST,
  APPLICATION_TEST
]);
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const normalize = (value) => value.replaceAll('\\', '/');

const walk = async (directory) => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && !['dist', 'node_modules', 'coverage'].includes(entry.name)) files.push(...await walk(path));
    else if (sourceExtensions.has(extname(entry.name))) files.push(normalize(path));
  }
  return files;
};

const location = (source, offset) => ({
  line: (source.slice(0, offset).match(/\n/gu) ?? []).length + 1,
  column: offset - source.slice(0, offset).lastIndexOf('\n')
});

export const scanSoftwareSupplyChainSourceText = (path, source) => {
  const normalizedPath = normalize(path);
  const findings = [];
  const report = (kind, detail, offset = 0) => findings.push({ path: normalizedPath, ...location(source, offset), kind, detail });
  const canonicalMatch = /\b(?:SupplyChainReleasePolicy|SupplyChainReleaseEvidence|SupplyChainReleaseDecision|EvaluateSupplyChainReleaseUseCase|GetSupplyChainReleaseBoundaryUseCase)\b/gu;
  const matches = [...source.matchAll(canonicalMatch)];
  const moduleMatch = source.match(/['"][^'"]*supply-chain-release(?:-policy|-use-cases)?\.js['"]/u);
  if ((matches.length > 0 || moduleMatch) && !AUTHORIZED_CANONICAL_REFERENCES.has(normalizedPath)) {
    report('CANONICAL_SUPPLY_CHAIN_AUTHORITY_OUTSIDE_EXACT_ALLOWLIST', matches[0]?.[0] ?? moduleMatch?.[0] ?? 'module', matches[0]?.index ?? moduleMatch?.index ?? 0);
  }
  if (/class\s+(?:SoftwareSupplyChain|SupplyChainGate|ReleaseEligibility|PackageSigning)(?:Policy|Authority|Evaluator)/u.test(source) && normalizedPath !== POLICY_PATH) {
    report('PARALLEL_SUPPLY_CHAIN_POLICY_AUTHORITY', 'parallel supply-chain policy class');
  }
  if (/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|BEGIN PKCS12|pfxPassword\s*[:=]\s*['"][^'"]+/iu.test(source)) {
    report('PRIVATE_SIGNING_MATERIAL_IN_SOURCE', 'private signing material marker');
  }
  if (/waiver.{0,80}(?:\*|\.\*|new RegExp)|(?:\*|\.\*).{0,80}waiver/isu.test(source)) {
    report('BROAD_VULNERABILITY_OR_LICENSE_WAIVER', 'wildcard/regex waiver');
  }
  if (/(?:const|let|var)\s+(?:signature|signed|authenticode)\w*\s*=\s*[^;\n]*\.sha256\b/isu.test(source)) {
    report('CHECKSUM_MISREPRESENTED_AS_SIGNATURE', 'checksum/signature semantic collision');
  }
  if (/status\s*===?\s*['"]PASS['"].{0,180}(?:NotSigned|UnknownError|HashMismatch|NotTrusted)/isu.test(source)) {
    report('INVALID_AUTHENTICODE_ACCEPTED', 'invalid Authenticode status accepted');
  }
  return findings;
};

export const scanSoftwareSupplyChainBoundary = async () => {
  const zones = ['apps', 'packages'];
  const files = (await Promise.all(zones.map(walk))).flat().sort();
  const findings = [];
  const canonicalReferencePaths = [];
  let canonicalPolicyClassDefinitions = 0;
  for (const path of files) {
    const source = await readFile(path, 'utf8');
    canonicalPolicyClassDefinitions += (source.match(/export\s+class\s+SupplyChainReleasePolicy\b/gu) ?? []).length;
    const referencesCanonical = /\b(?:SupplyChainReleasePolicy|SupplyChainReleaseEvidence|SupplyChainReleaseDecision|EvaluateSupplyChainReleaseUseCase|GetSupplyChainReleaseBoundaryUseCase)\b|['"][^'"]*supply-chain-release(?:-policy|-use-cases)?\.js['"]/u.test(source);
    if (referencesCanonical) canonicalReferencePaths.push(path);
    findings.push(...scanSoftwareSupplyChainSourceText(path, source));
  }
  return {
    zones: zones.length,
    scannedFiles: files.length,
    canonicalReferencePaths: canonicalReferencePaths.sort(),
    canonicalPolicyClassDefinitions,
    findings
  };
};

const maliciousSelfTests = [
  ['apps/desktop/src/main/fake.ts', 'new SupplyChainReleasePolicy({});', 'CANONICAL_SUPPLY_CHAIN_AUTHORITY_OUTSIDE_EXACT_ALLOWLIST'],
  ['packages/domain/src/fake.ts', 'class ReleaseEligibilityAuthority {}', 'PARALLEL_SUPPLY_CHAIN_POLICY_AUTHORITY'],
  ['apps/desktop/src/main/key.ts', 'const key = `-----BEGIN PRIVATE KEY-----`;', 'PRIVATE_SIGNING_MATERIAL_IN_SOURCE'],
  ['packages/application/src/fake.ts', "const waiver = '*';", 'BROAD_VULNERABILITY_OR_LICENSE_WAIVER'],
  ['apps/desktop/src/main/fake.ts', "const signed = artifact + '.sha256 signature';", 'CHECKSUM_MISREPRESENTED_AS_SIGNATURE'],
  ['apps/desktop/src/main/fake.ts', "const ok = status === 'PASS' && signature === 'NotSigned';", 'INVALID_AUTHENTICODE_ACCEPTED']
];
const benignSelfTests = [
  ['packages/domain/src/clean.ts', 'export interface DependencyInventory { count: number }'],
  ['apps/desktop/src/main/clean.ts', "const status = 'BLOCKED';"],
  ['packages/application/src/clean.ts', "const digest = file + '.sha256';"],
  [POLICY_PATH, 'export class SupplyChainReleasePolicy {}']
];

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await scanSoftwareSupplyChainBoundary();
  const failures = [...report.findings];
  for (const [path, source, expected] of maliciousSelfTests) {
    const findings = scanSoftwareSupplyChainSourceText(path, source);
    if (!findings.some((item) => item.kind === expected)) failures.push({ kind: 'MALICIOUS_SELF_TEST_MISSED', path, detail: expected });
  }
  for (const [path, source] of benignSelfTests) {
    const findings = scanSoftwareSupplyChainSourceText(path, source);
    if (findings.length > 0) failures.push({ kind: 'BENIGN_SELF_TEST_REJECTED', path, detail: findings.map((item) => item.kind).join(',') });
  }
  const canonicalExpected = [...AUTHORIZED_CANONICAL_REFERENCES].filter((path) => path !== DOMAIN_PATH).sort();
  if (JSON.stringify(report.canonicalReferencePaths) !== JSON.stringify(canonicalExpected)) {
    failures.push({
      kind: 'CANONICAL_REFERENCE_SET_MISMATCH',
      path: '<aggregate>',
      detail: `actual=${report.canonicalReferencePaths.join(',')} expected=${canonicalExpected.join(',')}`
    });
  }
  const policySource = await readFile(POLICY_PATH, 'utf8');
  const classDefinitions = (policySource.match(/export\s+class\s+SupplyChainReleasePolicy\b/gu) ?? []).length;
  if (classDefinitions !== 1) failures.push({ kind: 'CANONICAL_POLICY_CLASS_COUNT', path: POLICY_PATH, detail: String(classDefinitions) });
  const rootPackage = JSON.parse(await readFile('package.json', 'utf8'));
  const desktopPackage = JSON.parse(await readFile('apps/desktop/package.json', 'utf8'));
  const requiredPreflight = 'verify-software-supply-chain-boundary.mjs';
  if (!rootPackage.scripts?.pretypecheck?.includes(requiredPreflight) || !rootPackage.scripts?.prebuild?.includes(requiredPreflight)) {
    failures.push({ kind: 'ROOT_PREFLIGHT_INTEGRATION_MISSING', path: 'package.json', detail: requiredPreflight });
  }
  if (rootPackage.scripts?.['verify:ppk025:supply-chain-gate'] !== 'node scripts/verify-software-supply-chain-boundary.mjs') {
    failures.push({ kind: 'ROOT_GATE_COMMAND_MISMATCH', path: 'package.json', detail: 'verify:ppk025:supply-chain-gate' });
  }
  if (!desktopPackage.scripts?.['package:win']?.includes('build-signed-windows-release.mjs')) {
    failures.push({ kind: 'SIGNED_RELEASE_ORCHESTRATOR_NOT_AUTHORITATIVE', path: 'apps/desktop/package.json', detail: String(desktopPackage.scripts?.['package:win']) });
  }
  if (desktopPackage.build?.forceCodeSigning !== true) {
    failures.push({ kind: 'FORCE_CODE_SIGNING_DISABLED', path: 'apps/desktop/package.json', detail: String(desktopPackage.build?.forceCodeSigning) });
  }
  const activeRelease = JSON.parse(await readFile('config/release-ledger.json', 'utf8')).current;
  if (!String(desktopPackage.build?.win?.artifactName ?? '').includes(activeRelease.version)) {
    failures.push({ kind: 'WINDOWS_ARTIFACT_VERSION_DRIFT', path: 'apps/desktop/package.json', detail: String(desktopPackage.build?.win?.artifactName) });
  }
  if (failures.length > 0) {
    console.error(`PPK-025 software supply-chain boundary: FAIL (${failures.length} finding(s)).`);
    for (const failure of failures) console.error(`- ${failure.kind}: ${failure.path}:${failure.line ?? 0} ${failure.detail}`);
    process.exit(1);
  }
  console.log(`PPK-025 software supply-chain boundary: PASS (${report.zones} zones / ${report.scannedFiles} files / ${report.canonicalReferencePaths.length} canonical references / ${maliciousSelfTests.length} malicious / ${benignSelfTests.length} benign / 0 findings).`);
}
