import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string): string => readFileSync(path, 'utf8');

const externalPackage = (name: string, version: string) => ({
  name,
  version,
  resolved: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`,
  integrity: `sha512-${Buffer.alloc(64, name.length).toString('base64')}`,
  license: 'MIT'
});

const withLockFixture = async <T>(packages: Record<string, unknown>, run: (lockfilePath: string) => Promise<T>): Promise<T> => {
  const directory = await mkdtemp(join(tmpdir(), 'ppk025-lock-'));
  const lockfilePath = join(directory, 'package-lock.json');
  try {
    await writeFile(lockfilePath, `${JSON.stringify({
      name: 'fixture-root',
      version: '1.0.0',
      lockfileVersion: 3,
      requires: true,
      packages
    }, null, 2)}\n`, 'utf8');
    return await run(lockfilePath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

describe('32-U PPK-025 Desktop software supply-chain release boundary', () => {
  it('routes package:win only through the signed Windows release orchestrator', () => {
    const desktopPackage = JSON.parse(readSource('apps/desktop/package.json')) as {
      scripts: Record<string, string>;
      build: { forceCodeSigning: boolean; win: { artifactName: string } };
    };
    const activeRelease = (JSON.parse(readSource('config/release-ledger.json')) as { current: { channel: string; version: string } }).current;
    expect(desktopPackage.scripts['package:win']).toBe('node scripts/build-signed-windows-release.mjs');
    expect(desktopPackage.scripts['package:win:dir']).not.toContain('build-signed-windows-release.mjs');
    expect(desktopPackage.build.forceCodeSigning).toBe(true);
    expect(desktopPackage.build.win.artifactName).toContain(`${activeRelease.channel}-${activeRelease.version}`);
  });

  it('fails before packaging when external production signing trust is absent', () => {
    const source = readSource('apps/desktop/scripts/build-signed-windows-release.mjs');
    const policyCheck = source.indexOf('codeSigningCertificateProvisionedExternally !== true');
    const packaging = source.indexOf("run-electron-builder.mjs");
    expect(policyCheck).toBeGreaterThan(-1);
    expect(packaging).toBeGreaterThan(policyCheck);
    expect(source).toContain('allowedLeafCertificateThumbprints.length === 0');
    expect(source).toContain('No unsigned installer will be emitted by package:win');
    expect(source).toContain("process.argv.includes('--dir')");
    expect(source).toContain('does not permit directory-only output');
  });

  it('runs both lock/SBOM/license/audit/signature scopes before the build', () => {
    const source = readSource('apps/desktop/scripts/build-signed-windows-release.mjs');
    const build = source.indexOf("await npm('run', 'build:packages')");
    for (const marker of [
      'verify-software-supply-chain-boundary.mjs',
      'verify-lockfile-integrity.mjs',
      'verify-dependency-supply.mjs',
      'verify-workspace-dependencies.mjs',
      'verify-build-toolchain-security-contract.mjs',
      'generate-ppk025-sbom.mjs',
      'generate-ppk025-third-party-notices.mjs',
      'verify-ppk025-sbom.mjs',
      'verify-ppk025-license-policy.mjs',
      'verify-ppk025-external-build-assets.mjs',
      "'root-production'",
      "'root-build-toolchain'",
      "'windows-packager'",
      "run-ppk025-registry-signature-gate.mjs', '--scope', 'root'",
      "run-ppk025-registry-signature-gate.mjs', '--scope', 'windows-packager'"
    ]) {
      const position = source.indexOf(marker);
      expect(position, marker).toBeGreaterThan(-1);
      expect(position, `${marker} must precede build`).toBeLessThan(build);
    }
    expect(source).toContain("await script('scripts/run-governed-preflight.mjs')");
    expect(source).toContain("await npm('run', 'pretypecheck')");
    expect(source).toContain("args: ['node_modules/typescript/bin/tsc', '--noEmit']");
    expect(source).toContain("await npm('run', 'clean')");
    expect(source).toContain("await npm('run', 'build', '--workspace', '@ppt/core-service')");
    expect(source).toContain("await npm('run', 'build', '--workspace', '@ppt/desktop')");
    expect(source).not.toContain("await npm('run', 'build');");
  });

  it('rejects every untrusted mirror and local build-tool override before any preflight or packaging', () => {
    const source = readSource('apps/desktop/scripts/build-signed-windows-release.mjs');
    const firstPreflight = source.indexOf('verify-software-supply-chain-boundary.mjs');
    const overrideCheck = source.indexOf('activeDownloadOverrides.length > 0');
    expect(overrideCheck).toBeGreaterThan(-1);
    expect(overrideCheck).toBeLessThan(firstPreflight);
    for (const variable of [
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
    ]) expect(source, variable).toContain(`'${variable}'`);
  });

  it('binds root optional dependencies and every applicable peer dependency into the SBOM graph', async () => {
    const { loadLockGraph } = await import('../../../scripts/lib/ppk025-software-supply-chain.mjs');
    await withLockFixture({
      '': {
        name: 'fixture-root',
        version: '1.0.0',
        dependencies: { plugin: '1.0.0' },
        optionalDependencies: { optional: '1.0.0' }
      },
      'node_modules/host': externalPackage('host', '1.0.0'),
      'node_modules/optional': { ...externalPackage('optional', '1.0.0'), optional: true },
      'node_modules/plugin': {
        ...externalPackage('plugin', '1.0.0'),
        peerDependencies: { host: '^1.0.0' }
      }
    }, async (lockfilePath) => {
      const graph = await loadLockGraph({ scope: 'fixture', lockfilePath });
      const nodesByPath = new Map(graph.nodes.map((node: { packagePath: string; ref: string }) => [node.packagePath, node.ref]));
      const edgesByRef = new Map(graph.dependencies.map((edge: { ref: string; dependsOn: string[] }) => [edge.ref, edge.dependsOn]));
      expect(edgesByRef.get(nodesByPath.get('')!)).toEqual(expect.arrayContaining([
        nodesByPath.get('node_modules/plugin'),
        nodesByPath.get('node_modules/optional')
      ]));
      expect(edgesByRef.get(nodesByPath.get('node_modules/plugin')!))
        .toContain(nodesByPath.get('node_modules/host'));
    });
  });

  it('fails closed when an applicable required peer cannot be resolved, but permits an explicitly optional missing peer', async () => {
    const { loadLockGraph } = await import('../../../scripts/lib/ppk025-software-supply-chain.mjs');
    const plugin = externalPackage('plugin', '1.0.0');
    await expect(withLockFixture({
      '': { name: 'fixture-root', version: '1.0.0', dependencies: { plugin: '1.0.0' } },
      'node_modules/plugin': { ...plugin, peerDependencies: { missingHost: '^1.0.0' } }
    }, (lockfilePath) => loadLockGraph({ scope: 'fixture', lockfilePath })))
      .rejects.toThrow(/cannot resolve required peer missingHost/u);

    await expect(withLockFixture({
      '': { name: 'fixture-root', version: '1.0.0', dependencies: { plugin: '1.0.0' } },
      'node_modules/plugin': {
        ...plugin,
        peerDependencies: { optionalHost: '^1.0.0' },
        peerDependenciesMeta: { optionalHost: { optional: true } }
      }
    }, (lockfilePath) => loadLockGraph({ scope: 'fixture', lockfilePath }))).resolves.toBeDefined();
  });

  it('verifies both final Windows artifacts after electron-builder and never substitutes a checksum for Authenticode', () => {
    const source = readSource('apps/desktop/scripts/build-signed-windows-release.mjs');
    const packaging = source.lastIndexOf('run-electron-builder.mjs');
    const signatureGate = source.indexOf('verify-ppk025-windows-package-signature.ps1');
    expect(packaging).toBeGreaterThan(-1);
    expect(signatureGate).toBeGreaterThan(packaging);
    expect(source).toContain("'-InstallerPath', installerPath");
    expect(source).toContain("'-ApplicationExecutablePath', installedExecutablePath");
    expect(source).not.toContain('signatureStatus: NotSigned');
    expect(source).not.toContain("status === 'PASS' && signature");
  });

  it('requires Valid Authenticode, exact publisher/certificate trust and a trusted timestamp for installer and executable', () => {
    const verifier = readSource('scripts/verify-ppk025-windows-package-signature.ps1');
    expect(verifier).toContain('statusValid = $signatureStatus -eq "Valid"');
    expect(verifier).toContain('expectedPublisherSubject');
    expect(verifier).toContain('allowedLeafCertificateThumbprints');
    expect(verifier).toContain('Code Signing');
    expect(verifier).toContain('TimeStamperCertificate');
    expect(verifier).toContain('timestampCertificatePresent');
    expect(verifier).toContain('timestampChainTrusted');
    expect(verifier).toContain('certificateValidAtSigningTime');
    expect(verifier).toContain('timestampTimeUtc');
    expect(verifier).toContain('timestampChainStatus');
    expect(verifier).toContain('selfSignedCertificateRejected');
    expect(verifier).toContain('$InstallerPath');
    expect(verifier).toContain('$ApplicationExecutablePath');
  });

  it('installs into an exact temporary current-user root and verifies the installed executable instead of win-unpacked', () => {
    const source = readSource('apps/desktop/scripts/build-signed-windows-release.mjs');
    const packaging = source.lastIndexOf('run-electron-builder.mjs');
    const install = source.indexOf('installRoot', packaging);
    const installedExecutable = source.indexOf('installedExecutablePath', install);
    const verifier = source.indexOf("'-ApplicationExecutablePath', installedExecutablePath", installedExecutable);
    expect(install).toBeGreaterThan(packaging);
    expect(source.slice(install)).toContain("'/S'");
    expect(source.slice(install)).toContain('/D=');
    expect(installedExecutable).toBeGreaterThan(install);
    expect(verifier).toBeGreaterThan(installedExecutable);
    expect(source).not.toContain("'win-unpacked'");
    expect(source).toContain('finally');
    expect(source).toContain('uninstall');
  });

  it('keeps static contract evidence distinct from real Windows signing PASS', () => {
    const boundary = readSource('scripts/verify-software-supply-chain-boundary.mjs');
    const signingPolicy = JSON.parse(readSource('config/32-u-ppk-025-signing-trust-policy.json')) as {
      status: string;
      releaseDecision: { productionReleaseEligible: boolean; checksumOnlyAccepted: boolean; selfSignedAccepted: boolean };
    };
    expect(boundary).toContain('PRIVATE_SIGNING_MATERIAL_IN_SOURCE');
    expect(boundary).toContain('BROAD_VULNERABILITY_OR_LICENSE_WAIVER');
    expect(boundary).toContain('CHECKSUM_MISREPRESENTED_AS_SIGNATURE');
    expect(boundary).toContain('INVALID_AUTHENTICODE_ACCEPTED');
    expect(signingPolicy.status).toBe('EXTERNAL_SIGNING_PENDING');
    expect(signingPolicy.releaseDecision).toMatchObject({
      productionReleaseEligible: false,
      checksumOnlyAccepted: false,
      selfSignedAccepted: false
    });
  });
});
