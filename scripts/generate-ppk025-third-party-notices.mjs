import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  assertSafeArtifactPath,
  loadLockGraph,
  prettyCanonicalJson,
  sha256Text
} from './lib/ppk025-software-supply-chain.mjs';

const args = process.argv.slice(2);
const valueOf = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const policyPath = valueOf('--policy', 'config/32-u-ppk-025-software-supply-chain-policy.json');
const jsonPath = assertSafeArtifactPath(valueOf('--json', 'artifacts/manifests/32-U-ppk-025-third-party-notices.json'));
const textPath = assertSafeArtifactPath(valueOf('--text', 'artifacts/manifests/32-U-ppk-025-third-party-notices.txt'));
const reportPath = assertSafeArtifactPath(valueOf('--report', 'artifacts/validation/32-U-ppk-025-license-gate.json'));
const policy = JSON.parse(await readFile(policyPath, 'utf8'));
const allowedLicenses = new Set(policy.licensePolicy?.approvedExpressions ?? policy.approvedLicenses ?? []);
if (allowedLicenses.size === 0) throw new Error('PPK-025 license allowlist is empty.');
const lockfiles = (policy.lockfiles ?? [
  { scope: 'root', path: 'package-lock.json' },
  { scope: 'windows-packager', path: 'tools/windows-packager/package-lock.json' }
]).map((item) => ({ scope: item.scope, lockfilePath: item.lockfilePath ?? item.path }));
const graphs = [];
for (const lockfile of lockfiles) graphs.push(await loadLockGraph(lockfile));
const externalNodes = graphs.flatMap((graph) => graph.nodes).filter((node) => node.isExternal);
const grouped = new Map();
for (const node of externalNodes) {
  const license = String(node.entry.license ?? '');
  const key = `${node.name}\u0000${node.version}\u0000${node.entry.integrity}`;
  const current = grouped.get(key) ?? {
    name: node.name,
    version: node.version,
    license,
    resolved: node.entry.resolved,
    integrity: node.entry.integrity,
    scopes: new Set(),
    lockPaths: new Set()
  };
  current.scopes.add(node.scope);
  current.lockPaths.add(`${node.lockfilePath}:${node.packagePath}`);
  grouped.set(key, current);
}
const entries = [...grouped.values()].map((entry) => ({
  name: entry.name,
  version: entry.version,
  license: entry.license,
  decision: allowedLicenses.has(entry.license) ? 'ALLOW' : 'DENY',
  resolved: entry.resolved,
  integrity: entry.integrity,
  scopes: [...entry.scopes].sort(),
  lockPaths: [...entry.lockPaths].sort()
})).sort((left, right) => `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`, 'en'));
const denied = entries.filter((entry) => entry.decision !== 'ALLOW');
const noticeDocument = {
  schemaVersion: 1,
  step: '32-U',
  requirement: 'PPK-025',
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  legalApprovalImplied: false,
  inventoryPurpose: 'Deterministic technical dependency and declared-license disclosure.',
  entries
};
const lines = [
  'ANADOLU PARSI AILE YASAM MERKEZI - THIRD-PARTY NOTICES',
  '',
  'This deterministic inventory records package-declared license expressions. It does not replace legal review or the original license texts distributed by each package.',
  ''
];
for (const entry of entries) {
  lines.push(`${entry.name}@${entry.version}`);
  lines.push(`License: ${entry.license}`);
  lines.push(`Source: ${entry.resolved}`);
  lines.push(`Integrity: ${entry.integrity}`);
  lines.push(`Graphs: ${entry.scopes.join(', ')}`);
  lines.push('');
}
const text = `${lines.join('\n').trimEnd()}\n`;
const jsonText = prettyCanonicalJson(noticeDocument);
const report = {
  schemaVersion: 1,
  step: '32-U',
  requirement: 'PPK-025',
  status: denied.length === 0 ? 'PASS' : 'FAIL',
  policyPath,
  componentCount: entries.length,
  declaredLicenseCount: new Set(entries.map((entry) => entry.license)).size,
  approvedLicenseExpressionCount: allowedLicenses.size,
  missingLicenseCount: entries.filter((entry) => !entry.license).length,
  deniedLicenseCount: denied.length,
  denied: denied.map((entry) => `${entry.name}@${entry.version}:${entry.license}`),
  noticesJsonSha256: sha256Text(jsonText),
  noticesTextSha256: sha256Text(text),
  legalApprovalImplied: false
};
await Promise.all([
  mkdir(dirname(resolve(jsonPath)), { recursive: true }),
  mkdir(dirname(resolve(textPath)), { recursive: true }),
  mkdir(dirname(resolve(reportPath)), { recursive: true })
]);
await Promise.all([
  writeFile(jsonPath, jsonText),
  writeFile(textPath, text),
  writeFile(reportPath, prettyCanonicalJson(report))
]);
console.log(`PPK-025 third-party license gate: ${report.status} (${entries.length} components / ${report.declaredLicenseCount} expressions / ${denied.length} denied).`);
if (report.status !== 'PASS') process.exitCode = 1;
