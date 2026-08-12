import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  PPK025_VULNERABILITY_MAX_AGE_MS,
  prettyCanonicalJson,
  sha256Bytes,
  sha256File
} from './lib/ppk025-software-supply-chain.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) {
    if (fallback !== undefined) return fallback;
    throw new Error(`${name} is required.`);
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};

const requestedScope = option('--scope');
const aliases = new Map([
  ['production', 'root-production'],
  ['build-toolchain', 'root-build-toolchain']
]);
const scope = aliases.get(requestedScope) ?? requestedScope;
const scopeConfig = {
  'root-production': { cwd: '.', lockfile: 'package-lock.json', omitDev: true },
  'root-build-toolchain': { cwd: '.', lockfile: 'package-lock.json', omitDev: false },
  'windows-packager': { cwd: 'tools/windows-packager', lockfile: 'tools/windows-packager/package-lock.json', omitDev: false }
}[scope];
if (!scopeConfig) throw new Error(`Unsupported audit scope=${requestedScope}`);

const rawInputPath = option('--raw');
const reportInputPath = option('--report');
const rawPath = resolve(rawInputPath);
const reportPath = resolve(reportInputPath);
const sbomPath = option('--sbom', 'artifacts/manifests/32-U-ppk-025-cyclonedx-sbom.json');
const rootPackage = JSON.parse(await readFile('package.json', 'utf8'));
const versionMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})-(\d+)$/u.exec(rootPackage.version ?? '');
if (!versionMatch) throw new Error(`Unsupported package version=${rootPackage.version}`);
const [, day, month, year] = versionMatch;
const applicationVersion = `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}.${versionMatch[4]}`;
const auditArgs = ['audit', '--json', '--registry=https://registry.npmjs.org/'];
if (scopeConfig.omitDev) auditArgs.push('--omit=dev');
const lockSha256Before = await sha256File(scopeConfig.lockfile);
const sbomSha256 = await sha256File(sbomPath);

const runNpm = (npmArgs) => new Promise((resolveAudit, rejectAudit) => {
  const npmExecPath = process.env.npm_execpath;
  const command = npmExecPath
    ? process.execPath
    : process.platform === 'win32'
      ? process.env.ComSpec ?? 'cmd.exe'
      : 'npm';
  const commandArgs = npmExecPath
    ? [npmExecPath, ...npmArgs]
    : process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm', ...npmArgs]
      : npmArgs;
  const child = spawn(command, commandArgs, {
    cwd: resolve(scopeConfig.cwd),
    env: { ...process.env, NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org/' },
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('error', rejectAudit);
  child.on('close', (exitCode, signal) => resolveAudit({ stdout, stderr, exitCode, signal: signal ?? null }));
});

const execution = await runNpm(auditArgs);
let audit;
try {
  audit = JSON.parse(execution.stdout.replace(/^\uFEFF/u, ''));
} catch (error) {
  throw new Error(`npm audit did not return valid JSON: ${error.message}; stderr=${execution.stderr.slice(-2000)}`);
}
const counts = audit.metadata?.vulnerabilities;
if (!counts || !Number.isInteger(counts.total)) throw new Error('npm audit metadata.vulnerabilities is missing.');
const severityKeys = ['info', 'low', 'moderate', 'high', 'critical'];
if (!severityKeys.every((key) => Number.isInteger(counts[key]) && counts[key] >= 0)) {
  throw new Error('npm audit severity counters are malformed.');
}
const severityTotal = severityKeys.reduce((total, key) => total + counts[key], 0);
if (severityTotal !== counts.total) throw new Error(`npm audit count mismatch: total=${counts.total}, severityTotal=${severityTotal}.`);
const expectedExitCode = counts.total === 0 ? 0 : 1;
if (execution.exitCode !== expectedExitCode || execution.signal !== null) {
  throw new Error(`npm audit exit/count mismatch: exitCode=${execution.exitCode}, total=${counts.total}, signal=${execution.signal}; stderr=${execution.stderr.slice(-2000)}`);
}
const lockSha256After = await sha256File(scopeConfig.lockfile);
if (lockSha256After !== lockSha256Before) throw new Error(`${scopeConfig.lockfile} changed while npm audit was running.`);

const findings = Object.values(audit.vulnerabilities ?? {})
  .map((item) => ({
    name: item.name,
    severity: item.severity,
    direct: item.isDirect === true,
    range: item.range,
    fixAvailable: typeof item.fixAvailable === 'object'
      ? { name: item.fixAvailable.name, version: item.fixAvailable.version, semverMajor: item.fixAvailable.isSemVerMajor === true }
      : item.fixAvailable === true
  }))
  .sort((left, right) => left.name.localeCompare(right.name, 'en'));
const rawText = prettyCanonicalJson(audit);
const observedAt = new Date();
const expiresAt = new Date(observedAt.getTime() + PPK025_VULNERABILITY_MAX_AGE_MS);
const report = {
  schemaVersion: 2,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion,
  packageVersion: rootPackage.version,
  stage: 'Bronze Active Development',
  scope,
  requestedScope,
  registry: 'https://registry.npmjs.org/',
  workingDirectory: scopeConfig.cwd,
  lockfilePath: scopeConfig.lockfile,
  lockfileSha256: lockSha256Before,
  sbomPath,
  sbomSha256,
  rawPath: rawInputPath.replaceAll('\\', '/'),
  reportPath: reportInputPath.replaceAll('\\', '/'),
  rawResponseSha256: sha256Bytes(Buffer.from(rawText, 'utf8')),
  commandExitCode: execution.exitCode,
  status: counts.total === 0 ? 'PASS' : 'FAIL',
  vulnerabilities: Object.fromEntries([...severityKeys, 'total'].map((key) => [key, counts[key]])),
  findingPackageCount: findings.length,
  findings,
  sourceAuthenticityClaimed: false,
  observationIntegrityMustBeProvidedBySignedReleaseAttestation: true,
  observedAt: observedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
  maximumAgeMs: PPK025_VULNERABILITY_MAX_AGE_MS
};

await Promise.all([
  mkdir(dirname(rawPath), { recursive: true }),
  mkdir(dirname(reportPath), { recursive: true })
]);
await Promise.all([
  writeFile(rawPath, rawText),
  writeFile(reportPath, prettyCanonicalJson(report))
]);
console.log(`npm audit evidence (${scope}): ${report.status} — ${counts.total} finding(s), lock=${lockSha256Before.slice(0, 12)}, sbom=${sbomSha256.slice(0, 12)}.`);
if (report.status !== 'PASS') process.exitCode = 1;
