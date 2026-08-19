import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  PPK025_MAX_FUTURE_SKEW_MS,
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
const scope = option('--scope');
const config = {
  root: { cwd: '.', lockfile: 'package-lock.json' },
  'windows-packager': { cwd: 'tools/windows-packager', lockfile: 'tools/windows-packager/package-lock.json' }
}[scope];
if (!config) throw new Error(`Unsupported registry signature scope=${scope}`);
const reportPath = resolve(option('--report'));
const sbomPath = option('--sbom', 'artifacts/manifests/32-U-ppk-025-cyclonedx-sbom.json');
const lockSha256Before = await sha256File(config.lockfile);
const sbomSha256 = await sha256File(sbomPath);
const npmCli = [
  process.env.npm_execpath,
  join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  resolve('.tmp', 'npm-10.9.2', 'package', 'bin', 'npm-cli.js')
].find((candidate) => typeof candidate === 'string' && existsSync(candidate));
if (!npmCli) throw new Error('A trusted npm CLI could not be resolved from the active Node installation.');

const run = () => new Promise((resolveRun, rejectRun) => {
  const child = spawn(process.execPath, [npmCli, 'audit', 'signatures', '--json', '--registry=https://registry.npmjs.org/'], {
    cwd: resolve(config.cwd),
    env: { ...process.env, NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org/' },
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('error', rejectRun);
  child.on('close', (exitCode, signal) => resolveRun({ stdout, stderr, exitCode, signal: signal ?? null }));
});

const execution = await run();
let raw;
try { raw = JSON.parse(execution.stdout.replace(/^\uFEFF/u, '')); }
catch (error) { throw new Error(`npm audit signatures returned malformed JSON: ${error.message}; stderr=${execution.stderr.slice(-2000)}`); }
const invalid = Array.isArray(raw.invalid) ? raw.invalid : undefined;
const missing = Array.isArray(raw.missing) ? raw.missing : undefined;
if (!invalid || !missing) throw new Error('npm audit signatures response must contain invalid and missing arrays.');
const status = execution.exitCode === 0 && execution.signal === null && invalid.length === 0 && missing.length === 0 ? 'PASS' : 'FAIL';
if (status === 'PASS' && execution.exitCode !== 0) throw new Error('Registry signature command exit/status mismatch.');
const lockSha256After = await sha256File(config.lockfile);
if (lockSha256Before !== lockSha256After) throw new Error(`${config.lockfile} changed during registry signature verification.`);
const observedAt = new Date();
const expiresAt = new Date(observedAt.getTime() + PPK025_VULNERABILITY_MAX_AGE_MS);
const report = {
  schemaVersion: 1,
  step: '32-U',
  requirement: 'PPK-025',
  status,
  scope,
  registry: 'https://registry.npmjs.org/',
  lockfilePath: config.lockfile,
  lockfileSha256: lockSha256Before,
  sbomPath,
  sbomSha256,
  invalidCount: invalid.length,
  missingCount: missing.length,
  invalid,
  missing,
  commandExitCode: execution.exitCode,
  rawResponseSha256: sha256Bytes(Buffer.from(prettyCanonicalJson(raw), 'utf8')),
  observedAt: observedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
  maximumAgeMs: PPK025_VULNERABILITY_MAX_AGE_MS,
  maximumFutureSkewMs: PPK025_MAX_FUTURE_SKEW_MS
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, prettyCanonicalJson(report));
console.log(`PPK-025 npm registry signature gate (${scope}): ${status} (${invalid.length} invalid / ${missing.length} missing).`);
if (status !== 'PASS') process.exitCode = 1;
