import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};

const reportPath = resolve(option('--report', 'artifacts/validation/build122-build-toolchain-security-contract.json'));
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const [
  contract,
  rootPackage,
  desktopPackage,
  rootLock,
  packagerPackage,
  lock,
  stubPackage,
  stubEntry,
  versionLedger
] = await Promise.all([
  readJson('config/build-toolchain-security.json'),
  readJson('package.json'),
  readJson('apps/desktop/package.json'),
  readJson('package-lock.json'),
  readJson('tools/windows-packager/package.json'),
  readJson('tools/windows-packager/package-lock.json'),
  readJson('tools/electron-builder-squirrel-windows-stub/package.json'),
  readFile('tools/electron-builder-squirrel-windows-stub/index.cjs', 'utf8'),
  readJson('artifacts/manifests/VERSION_LEDGER.json')
]);

const failures = [];
let assertions = 0;
const verify = (condition, message) => {
  assertions += 1;
  if (!condition) failures.push(message);
};
const canonicalPackage = (path, version, sourceLock = lock) => {
  const entry = sourceLock.packages?.[path];
  verify(Boolean(entry), `Lockfile package is missing: ${path}`);
  if (!entry) return;
  verify(entry.version === version, `${path} version=${entry.version}; expected=${version}`);
  verify(
    typeof entry.resolved === 'string' &&
      entry.resolved.startsWith('https://registry.npmjs.org/') &&
      entry.resolved.endsWith(`-${version}.tgz`),
    `${path} does not resolve to the pinned canonical npm tarball`
  );
  verify(/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(String(entry.integrity ?? '')), `${path} lacks SHA-512 integrity`);
};

verify(contract.schemaVersion === 3, `Unsupported contract schemaVersion=${contract.schemaVersion}`);
verify(desktopPackage.devDependencies?.electron === contract.electronVersion, 'Electron is not exactly pinned');
verify(desktopPackage.devDependencies?.['electron-builder'] === undefined, 'electron-builder must not remain in the root desktop install graph');
verify(packagerPackage.devDependencies?.['electron-builder'] === contract.electronBuilderVersion, 'isolated electron-builder is not exactly pinned');
verify(packagerPackage.version === rootPackage.version, 'isolated Windows packager release version differs from the root package');
verify(lock.version === packagerPackage.version && lock.packages?.['']?.version === packagerPackage.version, 'isolated Windows packager lock version differs from its manifest');
verify(rootPackage.scripts?.['audit:production:evidence']?.includes('run-npm-audit-evidence.mjs --scope root-production'), 'Production audit evidence command is missing');
verify(rootPackage.scripts?.['audit:toolchain:evidence']?.includes('run-npm-audit-evidence.mjs --scope root-build-toolchain'), 'Root build-toolchain audit evidence command is missing');
verify(rootPackage.scripts?.['audit:windows-packager:evidence']?.includes('run-npm-audit-evidence.mjs --scope windows-packager'), 'Isolated Windows packager audit evidence command is missing');
verify(
  JSON.stringify(packagerPackage.overrides) === JSON.stringify(contract.safeOverrides),
  'Isolated Windows packager overrides differ from the reviewed toolchain contract'
);
verify(rootPackage.allowScripts?.['electron-winstaller@5.4.0'] === undefined, 'Unused electron-winstaller install script remains approved');
verify(
  JSON.stringify(desktopPackage.build?.win?.target) === JSON.stringify([contract.windowsTarget]),
  'Windows packaging target is not exclusively NSIS'
);
verify(desktopPackage.build?.squirrelWindows === undefined, 'Squirrel.Windows configuration must remain absent');
verify(!desktopPackage.scripts?.['package:win']?.includes('squirrel'), 'Windows package command enables Squirrel.Windows');

const approvedLink = contract.approvedLocalLinks?.[0];
verify(contract.approvedLocalLinks?.length === 1, 'Exactly one reviewed local toolchain link is required');
verify(stubPackage.name === approvedLink?.packageName, `Stub package name=${stubPackage.name}`);
verify(stubPackage.version === approvedLink?.version, `Stub package version=${stubPackage.version}`);
verify(stubPackage.private === true, 'Squirrel compatibility package must remain private');
verify(stubPackage.main === 'index.cjs', `Stub entry point=${stubPackage.main}`);
verify(stubEntry.includes('"use strict"'), 'Stub entry does not enable strict mode');
verify(stubEntry.includes('Squirrel.Windows packaging is disabled'), 'Stub does not fail closed');
verify(!/\brequire\s*\(|\bimport\s*\(/u.test(stubEntry), 'Stub must not load executable dependencies');

for (const packagePath of contract.forbiddenRootPackages ?? []) {
  verify(rootLock.packages?.[packagePath] === undefined, `Windows-only package leaked into root lockfile: ${packagePath}`);
}
verify(
  JSON.stringify(rootPackage.overrides) === JSON.stringify(contract.approvedRootOverrides),
  'Root dependency overrides differ from the exact reviewed security allowlist'
);
verify(rootPackage.scripts?.['windows-packager:install']?.includes('--prefix tools/windows-packager'), 'isolated Windows packager install command is missing');

const linkEntry = lock.packages?.[approvedLink?.packagePath];
verify(Boolean(linkEntry), `Approved local lock link is missing: ${approvedLink?.packagePath}`);
verify(linkEntry?.link === true, 'Approved Squirrel compatibility lock entry is not a local link');
verify(linkEntry?.resolved === approvedLink?.lockResolved, `Approved lock link target=${linkEntry?.resolved}`);

canonicalPackage('node_modules/electron-builder', contract.electronBuilderVersion);
canonicalPackage('node_modules/app-builder-lib', contract.electronBuilderVersion);
canonicalPackage('node_modules/electron', contract.electronVersion, rootLock);
canonicalPackage('node_modules/@electron/asar', contract.safeOverrides['@electron/asar']);
canonicalPackage('node_modules/@electron/universal', contract.safeOverrides['@electron/universal']);
canonicalPackage('node_modules/ejs', contract.safeOverrides.ejs);
canonicalPackage('node_modules/glob', '13.0.6');
canonicalPackage('node_modules/minimatch', '10.2.5');
for (const [name, version] of Object.entries(contract.reviewedTransitiveSecurityPins ?? {})) {
  canonicalPackage(`node_modules/${name}`, version);
}

for (const packagePath of contract.forbiddenInstalledPackages ?? []) {
  verify(lock.packages?.[packagePath] === undefined, `Forbidden unused toolchain package is installed: ${packagePath}`);
}

const appBuilder = lock.packages?.['node_modules/app-builder-lib'];
verify(appBuilder?.peerDependencies?.['electron-builder-squirrel-windows'] === contract.electronBuilderVersion, 'Squirrel peer version changed unexpectedly');
verify(appBuilder?.dependencies?.['@electron/asar'] === '3.4.1', 'Upstream ASAR pin changed; the reviewed override must be reassessed');
verify(appBuilder?.dependencies?.['@electron/universal'] === '2.0.3', 'Upstream universal pin changed; the reviewed override must be reassessed');
verify(appBuilder?.dependencies?.ejs === '^3.1.8', 'Upstream EJS range changed; the reviewed override must be reassessed');

const report = {
  schemaVersion: 1,
  product: 'ParsYuva Aile Yaşam Merkezi',
  applicationVersion: versionLedger.entries?.at(-1)?.version ?? null,
  packageVersion: rootPackage.version,
  stage: 'Bronze Active Development',
  policy: 'NSIS-only reviewed and root-isolated build toolchain',
  electronVersion: contract.electronVersion,
  electronBuilderVersion: contract.electronBuilderVersion,
  safeOverrides: contract.safeOverrides,
  forbiddenPackagesAbsent: contract.forbiddenInstalledPackages,
  assertions,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (report.status === 'PASS') {
  console.log(`Build toolchain security contract: PASS — ${assertions} assertions.`);
} else {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
