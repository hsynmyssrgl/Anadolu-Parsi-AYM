import assert from 'node:assert/strict';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveTypeScriptCommand } from './lib/typescript-command.mjs';

const root = process.cwd();
const compileRoot = join(root, '.tmp', 'build132-startup-security-runtime');
const compiler = resolveTypeScriptCommand(root);
const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
const firstExisting = (values) => values.find((value) => value && existsSync(value));
const nodeTypes = firstExisting([
  join(root, 'node_modules', '@types', 'node'),
  join(globalRoot, '@types', 'node'),
  join(globalRoot, 'ts-node', 'node_modules', '@types', 'node'),
  join(globalRoot, 'pptxgenjs', 'node_modules', '@types', 'node')
]);
const undiciTypes = firstExisting([
  join(root, 'node_modules', 'undici-types'),
  join(globalRoot, 'undici-types'),
  join(globalRoot, 'ts-node', 'node_modules', 'undici-types'),
  join(globalRoot, 'pptxgenjs', 'node_modules', 'undici-types')
]);
if (!nodeTypes) throw new Error('@types/node bulunamadı.');
await rm(compileRoot, { recursive: true, force: true });
await mkdir(join(compileRoot, 'node_modules', '@types'), { recursive: true });
await cp(nodeTypes, join(compileRoot, 'node_modules', '@types', 'node'), { recursive: true });
if (undiciTypes) await cp(undiciTypes, join(compileRoot, 'node_modules', 'undici-types'), { recursive: true });
const tsconfigPath = join(compileRoot, 'tsconfig.json');
await writeFile(tsconfigPath, `${JSON.stringify({
  extends: resolve(root, 'tsconfig.base.json'),
  compilerOptions: {
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    outDir: join(compileRoot, 'dist'),
    rootDir: join(root, 'apps', 'desktop', 'src', 'main'),
    declaration: false,
    declarationMap: false,
    sourceMap: false,
    types: ['node']
  },
  include: [
    resolve(root, 'apps/desktop/src/main/startup-security-preflight.ts'),
    resolve(root, 'apps/desktop/src/main/renderer-window-security.ts'),
    resolve(root, 'apps/desktop/src/main/device-secret-protector.ts')
  ]
}, null, 2)}\n`);
const compilation = spawnSync(
  compiler.command,
  [...compiler.prefixArgs, '-p', tsconfigPath, '--pretty', 'false'],
  { cwd: root, encoding: 'utf8' }
);
if (compilation.status !== 0) {
  process.stderr.write(compilation.stdout || '');
  process.stderr.write(compilation.stderr || '');
  throw new Error(`Build 132 runtime source compilation failed: ${compilation.status}`);
}

const startupModule = await import(pathToFileURL(join(compileRoot, 'dist', 'startup-security-preflight.js')).href);
const rendererModule = await import(pathToFileURL(join(compileRoot, 'dist', 'renderer-window-security.js')).href);
const {
  findUnsafeElectronSwitches,
  resolveProtectionProvider,
  runStartupSecurityPreflight
} = startupModule;
const { createSecureRendererPreferences, assertSecureRendererPreferences } = rendererModule;

const checks = [];
const failures = [];
const check = (label, action) => {
  try {
    action();
    checks.push(label);
  } catch (error) {
    failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
};
const expectThrow = (label, action, pattern) => check(label, () => assert.throws(action, pattern));

const runtimeRoot = mkdtempSync(join(tmpdir(), 'ppt-build132-startup-'));
const makeProtector = ({ available = true, protectionId = 'test-protector-v1' } = {}) => ({
  protectionId,
  required: true,
  isAvailable: () => available,
  protect: (secret) => Buffer.from([...secret].reverse().join(''), 'utf8').toString('base64'),
  unprotect: (protectedValue) => [...Buffer.from(protectedValue, 'base64').toString('utf8')].reverse().join('')
});
const rendererPreferences = createSecureRendererPreferences('/tmp/preload.cjs', false);
const rendererPolicy = assertSecureRendererPreferences(rendererPreferences);
const baseInput = {
  applicationVersion: '27.07.2026.132',
  packageVersion: '27.7.2026-132',
  platform: 'win32',
  isPackaged: true,
  electronVersion: '43.2.0',
  commandLineArguments: ['application.exe'],
  allowUnsafeDiagnostic: false,
  protector: makeProtector(),
  sentinelPath: join(runtimeRoot, 'secrets', 'startup-security-sentinel.json'),
  evidencePath: join(runtimeRoot, 'logs', 'startup-security-preflight.json'),
  rendererPolicy,
  now: () => '2026-07-27T21:00:00.000Z'
};

try {
  const first = runStartupSecurityPreflight(baseInput);
  check('first launch passes', () => assert.equal(first.status, 'PASS'));
  check('first launch creates sentinel', () => assert.equal(first.sentinelState, 'created'));
  check('Windows provider is DPAPI', () => assert.equal(first.protectionProvider, 'windows-dpapi'));
  check('encryption round trip passes', () => assert.equal(first.encryptionRoundTrip, 'PASS'));
  check('renderer sandbox is recorded', () => assert.equal(first.rendererPolicy.sandbox, true));
  check('renderer Node integration is disabled', () => assert.equal(first.rendererPolicy.nodeIntegration, false));
  check('sentinel file exists', () => assert.equal(existsSync(baseInput.sentinelPath), true));
  check('evidence file exists', () => assert.equal(existsSync(baseInput.evidencePath), true));
  check('sentinel does not contain plaintext challenge prefix', () => {
    assert.equal(readFileSync(baseInput.sentinelPath, 'utf8').includes('ppt-startup-'), false);
  });

  const second = runStartupSecurityPreflight({ ...baseInput, now: () => '2026-07-27T21:01:00.000Z' });
  check('second launch verifies sentinel', () => assert.equal(second.sentinelState, 'verified'));
  check('second launch remains PASS', () => assert.equal(second.status, 'PASS'));
  check('persistent sentinel keeps creation time', () => {
    const sentinel = JSON.parse(readFileSync(baseInput.sentinelPath, 'utf8'));
    assert.equal(sentinel.createdAt, '2026-07-27T21:00:00.000Z');
    assert.equal(sentinel.lastVerifiedAt, '2026-07-27T21:01:00.000Z');
  });

  const tampered = JSON.parse(readFileSync(baseInput.sentinelPath, 'utf8'));
  tampered.challengeSha256 = '0'.repeat(64);
  writeFileSync(baseInput.sentinelPath, `${JSON.stringify(tampered, null, 2)}\n`);
  expectThrow(
    'tampered sentinel fails closed',
    () => runStartupSecurityPreflight(baseInput),
    /bütünlük doğrulamasını geçemedi/u
  );

  rmSync(baseInput.sentinelPath, { force: true });
  expectThrow(
    'unsafe no-sandbox switch is rejected',
    () => runStartupSecurityPreflight({ ...baseInput, commandLineArguments: ['app.exe', '--no-sandbox'] }),
    /Güvensiz Electron/u
  );
  const diagnostic = runStartupSecurityPreflight({
    ...baseInput,
    commandLineArguments: ['app.exe', '--no-sandbox'],
    allowUnsafeDiagnostic: true
  });
  check('explicit diagnostic is classified', () => assert.equal(diagnostic.status, 'DIAGNOSTIC_PASS'));
  check('diagnostic evidence records unsafe switch', () => assert.deepEqual(diagnostic.unsafeSwitches, ['--no-sandbox']));

  rmSync(baseInput.sentinelPath, { force: true });
  expectThrow(
    'unavailable required protector fails closed',
    () => runStartupSecurityPreflight({ ...baseInput, protector: makeProtector({ available: false }) }),
    /Zorunlu işletim sistemi/u
  );
  check('unsafe disabled renderer feature is detected', () => {
    assert.deepEqual(
      findUnsafeElectronSwitches(['--disable-features=RendererAppContainer,OtherFeature']),
      ['--disable-features:RendererAppContainer']
    );
  });
  check('macOS provider is Keychain', () => assert.equal(resolveProtectionProvider('darwin'), 'macos-keychain'));
  check('Linux provider is secret service', () => assert.equal(resolveProtectionProvider('linux'), 'linux-secret-service'));
  expectThrow(
    'renderer policy rejects disabled sandbox',
    () => assertSecureRendererPreferences({ ...rendererPreferences, sandbox: false }),
    /sandbox etkin/u
  );
  expectThrow(
    'renderer policy rejects Node integration',
    () => assertSecureRendererPreferences({ ...rendererPreferences, nodeIntegration: true }),
    /Node.js entegrasyonu/u
  );
} finally {
  rmSync(runtimeRoot, { recursive: true, force: true });
  await rm(compileRoot, { recursive: true, force: true });
}

const evidence = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: '27.07.2026.132',
  packageVersion: '27.7.2026-132',
  checks: checks.length,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(join(root, 'artifacts', 'validation'), { recursive: true });
await writeFile(
  join(root, 'artifacts', 'validation', 'build132-startup-security-runtime.json'),
  `${JSON.stringify(evidence, null, 2)}\n`
);
if (failures.length > 0) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 132 startup security runtime verified: ${checks.length}/${checks.length} PASS.`);
