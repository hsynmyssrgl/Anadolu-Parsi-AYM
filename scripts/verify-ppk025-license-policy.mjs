import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { prettyCanonicalJson, sha256Bytes } from './lib/ppk025-software-supply-chain.mjs';

const sbomPath = 'artifacts/manifests/32-U-ppk-025-cyclonedx-sbom.json';
const noticesJsonPath = 'artifacts/manifests/32-U-ppk-025-third-party-notices.json';
const noticesTextPath = 'artifacts/manifests/32-U-ppk-025-third-party-notices.txt';
const outputPath = 'artifacts/validation/32-U-ppk-025-license-verification.json';
const [policyBytes, sbomBytes, noticeBytes, textBytes] = await Promise.all([
  readFile('config/32-u-ppk-025-software-supply-chain-policy.json'),
  readFile(sbomPath),
  readFile(noticesJsonPath),
  readFile(noticesTextPath)
]);
const policy = JSON.parse(policyBytes.toString('utf8'));
const sbom = JSON.parse(sbomBytes.toString('utf8'));
const notices = JSON.parse(noticeBytes.toString('utf8'));
const text = textBytes.toString('utf8');
const approved = new Set(policy.approvedLicenses);
const externalComponents = sbom.components.filter((item) => item.properties?.some((property) => property.name === 'ppt:integrity'));
const expectedKeys = new Set(externalComponents.map((item) => {
  const integrity = item.properties.find((property) => property.name === 'ppt:integrity').value;
  return `${item.name}\u0000${item.version}\u0000${integrity}`;
}));
const actualKeys = new Set(notices.entries.map((item) => `${item.name}\u0000${item.version}\u0000${item.integrity}`));
const checks = [];
const failures = [];
const check = (name, condition) => { checks.push({ name, passed: Boolean(condition) }); if (!condition) failures.push(name); };
check('notice JSON is canonical deterministic JSON', noticeBytes.toString('utf8') === prettyCanonicalJson(notices));
check('notice identity is exact', notices.schemaVersion === 1 && notices.step === '32-U' && notices.requirement === 'PPK-025');
check('notice does not claim legal approval', notices.legalApprovalImplied === false && notices.inventoryPurpose.includes('technical'));
check('external SBOM component count is exact', externalComponents.length === policy.requiredRegistryPackageCount);
check('deduplicated declared-license component count is exact', expectedKeys.size === policy.requiredLicenseComponentCount && notices.entries.length === policy.requiredLicenseComponentCount);
check('notice inventory exactly covers external SBOM components', expectedKeys.size === actualKeys.size && [...expectedKeys].every((key) => actualKeys.has(key)));
check('every license expression is explicit and approved', notices.entries.every((item) => typeof item.license === 'string' && item.license.length > 0 && approved.has(item.license) && item.decision === 'ALLOW'));
check('every entry preserves canonical npm source and SHA-512 integrity', notices.entries.every((item) => item.resolved.startsWith('https://registry.npmjs.org/') && item.resolved.endsWith('.tgz') && /^sha512-[A-Za-z0-9+/]+={0,2}$/u.test(item.integrity)));
check('every entry has graph and lock-path coverage', notices.entries.every((item) => item.scopes.length > 0 && item.lockPaths.length > 0));
check('human-readable notice declares non-legal technical scope', text.includes('does not replace legal review') && text.includes('package-declared license expressions'));
check('human-readable notice includes every exact component and license', notices.entries.every((item) => text.includes(`${item.name}@${item.version}\nLicense: ${item.license}\nSource: ${item.resolved}\nIntegrity: ${item.integrity}`)));
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
  sbomSha256: sha256Bytes(sbomBytes),
  noticesJsonSha256: sha256Bytes(noticeBytes),
  noticesTextSha256: sha256Bytes(textBytes),
  externalSbomComponentCount: externalComponents.length,
  licenseInventoryComponentCount: notices.entries.length,
  approvedExpressionCount: approved.size,
  deniedCount: notices.entries.filter((item) => item.decision !== 'ALLOW').length,
  legalApprovalImplied: false
};
await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(outputPath, prettyCanonicalJson(report));
console.log(`PPK-025 license policy: ${report.status} (${report.passed}/${report.checkCount}, ${report.licenseInventoryComponentCount} components / ${report.approvedExpressionCount} expressions).`);
if (failures.length) process.exitCode = 1;
