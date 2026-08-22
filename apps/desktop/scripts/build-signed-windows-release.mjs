import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const node = process.execPath;
const npmExecPath = process.env.npm_execpath;
const npmCommand = npmExecPath
  ? { executable: node, prefix: [npmExecPath] }
  : { executable: process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npm', prefix: process.platform === 'win32' ? ['/d', '/s', '/c', 'npm'] : [] };
const run = ({ executable, args, cwd = root, allowedExitCodes = [0] }) => new Promise((resolveRun, rejectRun) => {
  const child = spawn(executable, args, { cwd, env: process.env, shell: false, windowsHide: true, stdio: 'inherit' });
  child.on('error', rejectRun);
  child.on('close', (exitCode, signal) => {
    if (signal || !allowedExitCodes.includes(exitCode ?? -1)) rejectRun(new Error(`${executable} failed: exit=${exitCode}, signal=${signal}`));
    else resolveRun();
  });
});
const npm = (...args) => run({ executable: npmCommand.executable, args: [...npmCommand.prefix, ...args] });
const script = (...args) => run({ executable: node, args, cwd: root });

if (process.argv.includes('--dir')) {
  console.error('package:win is a signed release authority and does not permit directory-only output. Use package:win:dir for an explicitly unsigned test candidate.');
  process.exit(1);
}
if (process.platform !== 'win32') {
  console.error('PPK-025 signed Windows release can run only on Windows.');
  process.exit(1);
}

const forbiddenDownloadOverrides = [
  'ELECTRON_BUILDER_7ZIP_PATH',
  'ELECTRON_BUILDER_WINDOWS_KITS_PATH',
  'ELECTRON_BUILDER_OSSL_SIGNCODE_PATH',
  'ELECTRON_BUILDER_RCEDIT_PATH',
  'ELECTRON_BUILDER_NSIS_DIR',
  'ELECTRON_BUILDER_NSIS_RESOURCES_DIR',
  'ELECTRON_BUILDER_BINARIES_DOWNLOAD_OVERRIDE_URL',
  'ELECTRON_BUILDER_BINARIES_MIRROR',
  'NPM_CONFIG_ELECTRON_BUILDER_BINARIES_MIRROR',
  'ELECTRON_MIRROR',
  'ELECTRON_CUSTOM_DIR',
  'ELECTRON_CUSTOM_FILENAME',
  'ELECTRON_CUSTOM_VERSION',
  'ELECTRON_OVERRIDE_DIST_PATH',
  'ELECTRON_BUILDER_BINARIES_ALLOW_HTTP'
];
const activeDownloadOverrides = forbiddenDownloadOverrides.filter((name) => String(process.env[name] ?? '').trim() !== '');
if (activeDownloadOverrides.length > 0) {
  console.error(`PPK-025 release blocked: untrusted build-tool/download override environment variables are present: ${activeDownloadOverrides.sort().join(', ')}.`);
  process.exit(1);
}

await script('scripts/clean-stale-windows-installers.mjs');
await script('scripts/allocate-monthly-release-version.mjs');
await script('scripts/run-governed-preflight.mjs');
await npm('run', 'pretypecheck');
await script('scripts/verify-software-supply-chain-boundary.mjs');
await script('scripts/verify-lockfile-integrity.mjs');
await script('scripts/verify-dependency-supply.mjs');
await script('scripts/verify-workspace-dependencies.mjs');
await script('scripts/verify-build-toolchain-security-contract.mjs', '--report', 'artifacts/validation/32-U-ppk-025-build-toolchain-security.json');
await script('scripts/generate-ppk025-sbom.mjs');
await script('scripts/generate-ppk025-third-party-notices.mjs');
await script('scripts/verify-ppk025-sbom.mjs');
await script('scripts/verify-ppk025-license-policy.mjs');
await script('scripts/verify-ppk025-external-build-assets.mjs');
await script('scripts/run-npm-audit-evidence.mjs', '--scope', 'root-production', '--raw', 'artifacts/validation/32-U-ppk-025-root-production-npm-audit-raw.json', '--report', 'artifacts/validation/32-U-ppk-025-root-production-vulnerability.json');
await script('scripts/run-npm-audit-evidence.mjs', '--scope', 'root-build-toolchain', '--raw', 'artifacts/validation/32-U-ppk-025-root-build-npm-audit-raw.json', '--report', 'artifacts/validation/32-U-ppk-025-root-build-vulnerability.json');
await script('scripts/run-npm-audit-evidence.mjs', '--scope', 'windows-packager', '--raw', 'artifacts/validation/32-U-ppk-025-windows-packager-npm-audit-raw.json', '--report', 'artifacts/validation/32-U-ppk-025-windows-packager-vulnerability.json');
await script('scripts/run-ppk025-registry-signature-gate.mjs', '--scope', 'root', '--report', 'artifacts/validation/32-U-ppk-025-root-registry-signatures.json');
await script('scripts/run-ppk025-registry-signature-gate.mjs', '--scope', 'windows-packager', '--report', 'artifacts/validation/32-U-ppk-025-windows-packager-registry-signatures.json');
await script('scripts/verify-ppk025-vulnerability-gate.mjs');
await script('scripts/verify-ppk025-registry-signature-evidence.mjs');
await npm('run', 'verify:license-sync', '--workspace', '@ppt/desktop');
await run({ executable: node, args: ['node_modules/typescript/bin/tsc', '--noEmit'], cwd: root });
await npm('run', 'clean');
await npm('run', 'build:packages');
await npm('run', 'build', '--workspace', '@ppt/core-service');
await npm('run', 'build', '--workspace', '@ppt/desktop');
await npm('run', 'verify:installer', '--workspace', '@ppt/desktop');

const signingPolicy = JSON.parse(await readFile(resolve(root, 'config/32-u-ppk-025-signing-trust-policy.json'), 'utf8'));
if (
  signingPolicy.production?.codeSigningCertificateProvisionedExternally !== true
  || !signingPolicy.production?.expectedPublisherSubject
  || !Array.isArray(signingPolicy.production?.allowedLeafCertificateThumbprints)
  || signingPolicy.production.allowedLeafCertificateThumbprints.length === 0
  || !Array.isArray(signingPolicy.production?.allowedLeafCertificateSha256)
  || signingPolicy.production.allowedLeafCertificateSha256.length === 0
) {
  console.error('PPK-025 release blocked before packaging: production Authenticode certificate/publisher trust policy is not provisioned. No unsigned installer will be emitted by package:win.');
  process.exit(1);
}

await run({ executable: node, args: [resolve(import.meta.dirname, 'run-electron-builder.mjs')], cwd: resolve(root, 'apps/desktop') });
const releaseRoot = resolve(root, 'apps/desktop/release');
const activeRelease = JSON.parse(await readFile(resolve(root, 'config/release-ledger.json'), 'utf8')).current;
const installerName = `ParsYuva-${activeRelease.channel}-${activeRelease.version}.exe`;
const installerPath = resolve(releaseRoot, installerName);
if (!existsSync(installerPath)) throw new Error('Signed installer output is missing after electron-builder.');
const signatureVerifierPath = resolve(root, 'scripts/verify-ppk025-windows-package-signature.ps1');
await run({
  executable: 'powershell.exe',
  args: [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', signatureVerifierPath,
    '-InstallerPath', installerPath,
    '-Mode', 'INSTALLER_PREINSTALL',
    '-EvidencePath', 'artifacts/validation/32-U-ppk-025-installer-preinstall-signature.json'
  ],
  cwd: root
});
const desktopPackage = JSON.parse(await readFile(resolve(root, 'apps/desktop/package.json'), 'utf8'));
const productName = desktopPackage.build?.productName;
if (typeof productName !== 'string' || productName.trim() === '') throw new Error('Desktop productName is missing.');
const executableName = desktopPackage.build?.executableName;
if (typeof executableName !== 'string' || executableName.trim() === '') throw new Error('Desktop executableName is missing.');
const installRoot = await mkdtemp(join(tmpdir(), 'aym-ppk025-install-'));
const installedExecutablePath = resolve(installRoot, `${executableName}.exe`);
const uninstallPath = resolve(installRoot, `Uninstall ${productName}.exe`);
try {
  await run({ executable: installerPath, args: ['/S', `/D=${installRoot}`], cwd: root });
  if (!existsSync(installedExecutablePath)) throw new Error('Installed main executable is missing after the isolated silent install smoke test.');
  await run({
    executable: 'powershell.exe',
    args: [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', signatureVerifierPath,
      '-InstallerPath', installerPath,
      '-ApplicationExecutablePath', installedExecutablePath,
      '-Mode', 'FINAL_PAIR'
    ],
    cwd: root
  });
} finally {
  try {
    if (existsSync(uninstallPath)) {
      await run({ executable: uninstallPath, args: ['/S'], cwd: root });
    }
  } finally {
    await rm(installRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }
}
await script('scripts/create-ppk025-release-evidence.mjs');
console.log('PPK-025 signed Windows release: PASS.');
