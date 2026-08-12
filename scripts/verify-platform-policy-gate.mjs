import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const baseline = JSON.parse(await readFile('config/platform-policy-legacy-bypass-baseline.json', 'utf8'));
const authorizationFindings = [];
const presentationConditions = [];
const pattern = /role\s*[!=]==?\s*['"]family_admin['"]|roles\.includes\(['"]family_admin['"]\)/u;

const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'tests') continue;
      await walk(path);
      continue;
    }
    if (!/\.tsx?$/u.test(entry.name) || path.includes('packages\\platform-policy')) continue;
    const rendererPresentation = path.includes(`apps${process.platform === 'win32' ? '\\' : '/'}desktop${process.platform === 'win32' ? '\\' : '/'}src${process.platform === 'win32' ? '\\' : '/'}renderer`);
    const lines = (await readFile(path, 'utf8')).split(/\r?\n/u);
    for (const [index, line] of lines.entries()) {
      if (!pattern.test(line)) continue;
      const finding = {
        path: relative('.', path).replaceAll('\\', '/'),
        line: index + 1,
        lineSha256: createHash('sha256').update(line.trim()).digest('hex')
      };
      (rendererPresentation ? presentationConditions : authorizationFindings).push(finding);
    }
  }
};

await walk('apps');
await walk('packages');

const runtime = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/verify-platform-policy-runtime.mjs'], { encoding: 'utf8' });
const astGate = spawnSync(process.execPath, ['scripts/verify-platform-policy-ast-gate.mjs'], { encoding: 'utf8' });
const capabilityManifestGate = spawnSync(process.execPath, ['scripts/verify-platform-capability-manifest-gate.mjs'], { encoding: 'utf8' });
const applicationSecurityProfileGate = spawnSync(process.execPath, ['scripts/verify-application-security-profile-gate.mjs'], { encoding: 'utf8' });
const failures = [];
if (authorizationFindings.length > 0) failures.push(`direct authorization role bypasses=${authorizationFindings.length}`);
if (runtime.status !== 0) failures.push(runtime.stderr || runtime.stdout || 'policy runtime failed');
if (astGate.status !== 0) failures.push(astGate.stderr || astGate.stdout || 'AST policy gate failed');
if (capabilityManifestGate.status !== 0) failures.push(capabilityManifestGate.stderr || capabilityManifestGate.stdout || 'capability manifest gate failed');
if (applicationSecurityProfileGate.status !== 0) failures.push(applicationSecurityProfileGate.stderr || applicationSecurityProfileGate.stdout || 'application security profile gate failed');
const report = {
  schemaVersion: 4,
  release: baseline.release,
  legacyBypassCount: authorizationFindings.length,
  newBypassCount: authorizationFindings.length,
  presentationRoleConditionCount: presentationConditions.length,
  presentationConditions,
  runtimeStatus: runtime.status === 0 ? 'PASS' : 'FAIL',
  astGateStatus: astGate.status === 0 ? 'PASS' : 'FAIL',
  capabilityManifestGateStatus: capabilityManifestGate.status === 0 ? 'PASS' : 'FAIL',
  applicationSecurityProfileGateStatus: applicationSecurityProfileGate.status === 0 ? 'PASS' : 'FAIL',
  status: failures.length ? 'FAIL' : 'PASS',
  failures,
  authorizationFindings,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/platform-policy-gate.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Platform Policy Gate: PASS / authorization bypass 0 / presentation conditions ${presentationConditions.length} / AST gate PASS / capability manifest gate PASS / application security profile gate PASS.\n${runtime.stdout.trim()}`);
