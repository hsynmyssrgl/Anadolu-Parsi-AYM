import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  if (index < 0) throw new Error(`${name} is required.`);
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};

const inputPath = resolve(option('--input'));
const reportPath = resolve(option('--report'));
const scope = option('--scope');
if (!['production', 'build-toolchain'].includes(scope)) {
  throw new Error(`Unsupported audit scope=${scope}`);
}

const raw = await readFile(inputPath, 'utf8');
const audit = JSON.parse(raw.replace(/^\uFEFF/u, ''));
const counts = audit.metadata?.vulnerabilities;
if (!counts || !Number.isInteger(counts.total)) {
  throw new Error('npm audit metadata.vulnerabilities is missing.');
}

const findings = Object.values(audit.vulnerabilities ?? {})
  .map((item) => ({
    name: item.name,
    severity: item.severity,
    direct: item.isDirect === true,
    range: item.range,
    fixAvailable: typeof item.fixAvailable === 'object'
      ? {
          name: item.fixAvailable.name,
          version: item.fixAvailable.version,
          semverMajor: item.fixAvailable.isSemVerMajor === true
        }
      : item.fixAvailable === true
  }))
  .sort((left, right) => left.name.localeCompare(right.name, 'en'));

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: '26.07.2026.122',
  packageVersion: '26.7.2026-122',
  stage: 'Bronze RC2 Active Development',
  scope,
  status: counts.total === 0 ? 'PASS' : 'FAIL',
  vulnerabilities: counts,
  findings,
  generatedAt: new Date().toISOString()
};

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`npm audit evidence (${scope}): ${report.status} — ${counts.total} finding(s).`);
