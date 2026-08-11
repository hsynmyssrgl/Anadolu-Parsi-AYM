import { spawn } from 'node:child_process';
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

const scope = option('--scope');
if (!['production', 'build-toolchain'].includes(scope)) throw new Error(`Unsupported audit scope=${scope}`);
const rawPath = resolve(option('--raw'));
const reportPath = resolve(option('--report'));
const rootPackage = JSON.parse(await readFile('package.json', 'utf8'));
const versionMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})-(\d+)$/.exec(rootPackage.version ?? '');
if (!versionMatch) throw new Error(`Unsupported package version=${rootPackage.version}`);
const [, day, month, year] = versionMatch;
const applicationVersion = `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}.${versionMatch[4]}`;
const auditArgs = ['audit', '--json', '--registry=https://registry.npmjs.org/'];
if (scope === 'production') auditArgs.push('--omit=dev');

const runAudit = () => new Promise((resolveAudit, rejectAudit) => {
  const npmExecPath = process.env.npm_execpath;
  const command = npmExecPath
    ? process.execPath
    : process.platform === 'win32'
      ? process.env.ComSpec ?? 'cmd.exe'
      : 'npm';
  const commandArgs = npmExecPath
    ? [npmExecPath, ...auditArgs]
    : process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm', ...auditArgs]
      : auditArgs;
  const child = spawn(command, commandArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org/'
    },
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

const execution = await runAudit();
let audit;
try {
  audit = JSON.parse(execution.stdout.replace(/^\uFEFF/u, ''));
} catch (error) {
  throw new Error(`npm audit did not return valid JSON: ${error.message}; stderr=${execution.stderr.slice(-2000)}`);
}
const counts = audit.metadata?.vulnerabilities;
if (!counts || !Number.isInteger(counts.total)) throw new Error('npm audit metadata.vulnerabilities is missing.');
if (![0, 1].includes(execution.exitCode)) {
  throw new Error(`npm audit execution failed with exitCode=${execution.exitCode}; stderr=${execution.stderr.slice(-2000)}`);
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
  applicationVersion,
  packageVersion: rootPackage.version,
  stage: 'Bronze RC2 Active Development',
  scope,
  registry: 'https://registry.npmjs.org/',
  commandExitCode: execution.exitCode,
  status: counts.total === 0 ? 'PASS' : 'FAIL',
  vulnerabilities: counts,
  findings,
  generatedAt: new Date().toISOString()
};

await Promise.all([
  mkdir(dirname(rawPath), { recursive: true }),
  mkdir(dirname(reportPath), { recursive: true })
]);
await Promise.all([
  writeFile(rawPath, `${JSON.stringify(audit, null, 2)}\n`),
  writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
]);
console.log(`npm audit evidence (${scope}): ${report.status} — ${counts.total} finding(s).`);
if (report.status !== 'PASS') process.exitCode = 1;
