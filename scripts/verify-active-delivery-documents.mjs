import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const root = resolve(option('--root', '.'));
const reportPath = resolve(root, option('--report', 'artifacts/validation/active-delivery-documents.json'));
const failures = [];
let checks = 0;
const verify = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const read = (path) => readFile(resolve(root, path), 'utf8');
const readJson = async (path) => JSON.parse(await read(path));
const exists = async (path) => { try { await stat(resolve(root, path)); return true; } catch { return false; } };
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ledger = await readJson('config/release-ledger.json');
const current = ledger.current;
verify(Boolean(current), 'release ledger current entry is missing');
const displayVersion = current?.version ?? '';
const packageVersion = current?.packageVersion ?? '';
const build = current?.monthlySequence;
verify(Number.isInteger(build) && build > 0, `invalid build=${build}`);

const documents = ['README.md', 'START_HERE_TR.md', 'PAKET_OZETI_TR.md', 'DELIVERY_SUMMARY_TR.md', 'VERIFICATION_REPORT.md'];
const contents = new Map();
for (const path of documents) {
  verify(await exists(path), `active delivery document missing=${path}`);
  if (!await exists(path)) continue;
  const content = await read(path);
  contents.set(path, content);
  verify(content.includes('docs/17_MASTER_BUILD_LEDGER.md'), `master ledger reference missing=${path}`);
  for (const marker of [
    '- Product: ParsYuva Aile Yaşam Merkezi',
    `- Application Version: \`${displayVersion}\``,
    `- Package Version: \`${packageVersion}\``,
    '- Stage: **Bronze Active Development**',
    `- Monthly Sequence: **${build}**`
  ]) verify(content.includes(marker), `${path} marker missing=${marker}`);

  const displayVersions = [...content.matchAll(/\b\d{2}\.\d{2}\.\d{4}\.\d+\b/g)].map((match) => match[0]);
  for (const value of displayVersions) verify(value === displayVersion, `${path} stale display version=${value}`);
  const packageVersions = [...content.matchAll(/\b\d{1,2}\.\d{1,2}\.\d{4}-\d+\b/g)].map((match) => match[0]);
  for (const value of packageVersions) verify(value === packageVersion, `${path} stale package version=${value}`);
  verify(!/- (?:Stage|Kanal): \*\*(?:Silver|Gold)\b/i.test(content), `${path} claims a promoted stage`);
}

const requiredReferenceFiles = [
  'config/release-ledger.json',
  'config/canonical-rule-registry.json',
  'docs/current/00_AKTIF_ANA_KAPSAM.md',
  'docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md'
];
for (const reference of requiredReferenceFiles) verify(await exists(reference), `current referenced document missing=${reference}`);
for (const path of ['README.md', 'START_HERE_TR.md', 'PAKET_OZETI_TR.md', 'DELIVERY_SUMMARY_TR.md', 'VERIFICATION_REPORT.md']) {
  const content = contents.get(path) ?? '';
  for (const reference of requiredReferenceFiles) verify(content.includes(`\`${reference}\``), `${path} current reference missing=${reference}`);
  verify(!/`(?:BUILD_STATUS_(?:BRONZE_RC2_BUILD|MVP)|RELEASE_NOTES_BRONZE_(?:RC2_BUILD|MVP)|BUILD\d+_)[^`]*`/.test(content), `${path} contains a historical build reference as active authority`);
}

verify((contents.get('PAKET_OZETI_TR.md') ?? '') === (contents.get('DELIVERY_SUMMARY_TR.md') ?? ''), 'package and delivery summaries diverged');

const rootStatus = await read('BUILD_STATUS.md');
const verification = contents.get('VERIFICATION_REPORT.md') ?? '';
const statusLabels = [
  'Source preflight gate',
  'Source integrity',
  'Clean install gate',
  'Full root `tsc --noEmit`',
  'Unit and integration tests',
  'Electron production build',
  'Blocking smoke chain',
  'Windows launch / installer'
];
for (const label of statusLabels) {
  const rootMatch = rootStatus.match(new RegExp(`^- ${escapeRegExp(label)}: \\*\\*(PASS|FAIL|NOT_RUN)`, 'm'));
  verify(Boolean(rootMatch), `BUILD_STATUS status missing=${label}`);
  const reportMatch = verification.match(new RegExp(`^- ${escapeRegExp(label)}: \\*\\*(PASS|FAIL|NOT_RUN)\\*\\*`, 'm'));
  verify(Boolean(reportMatch), `VERIFICATION_REPORT status missing=${label}`);
  if (rootMatch && reportMatch) verify(rootMatch[1] === reportMatch[1], `status mismatch ${label}: root=${rootMatch[1]} report=${reportMatch[1]}`);
}

const evidence = {
  schemaVersion: 1,
  product: 'ParsYuva Aile Yaşam Merkezi',
  version: displayVersion,
  packageVersion,
  build,
  documentCount: documents.length,
  checks,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`Active delivery document contract failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Active delivery document contract verified: ${checks} assertions / ${documents.length} documents / Build ${build}.`);
