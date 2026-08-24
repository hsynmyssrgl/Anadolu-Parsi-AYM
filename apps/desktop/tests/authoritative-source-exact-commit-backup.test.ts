import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('tracked-only authoritative source protection contract', () => {
  it('archives exact Git commit blobs and propagates schema-2 provenance externally', async () => {
    const [localProtection, externalProtection, packageBuilder, packageProvenance] = await Promise.all([
      readFile('scripts/protect-authoritative-source.mjs', 'utf8'),
      readFile('scripts/protect-authoritative-source-external.mjs', 'utf8'),
      readFile('apps/desktop/scripts/run-electron-builder.mjs', 'utf8'),
      readFile('scripts/lib/windows-package-provenance.mjs', 'utf8')
    ]);
    for (const marker of [
      'captureReleaseSourceProvenance',
      "backupScope: 'TRACKED_FILES_AT_EXACT_COMMIT'",
      "scope: 'TRACKED_FILES_AT_EXACT_COMMIT'",
      'sourceProvenance: inventory.sourceProvenance',
      'file.data'
    ]) expect(localProtection).toContain(marker);
    expect(localProtection).not.toContain('readFile(file.absolute)');
    expect(externalProtection).toContain("schemaVersion: 2, release: visibleRelease");
    expect(externalProtection).toContain("backupScope: 'TRACKED_FILES_AT_EXACT_COMMIT'");
    expect(packageBuilder).toContain('writeWindowsPackageProvenanceTransaction');
    expect(packageProvenance).toContain("WINDOWS_PACKAGE_PROVENANCE_PATH = 'artifacts/validation/windows-package-provenance.json'");
    expect(packageProvenance).toContain('windowsPackageHistoryBundleRelativePath');
    expect(packageProvenance).toContain('WINDOWS_PACKAGE_PROVENANCE_CHAIN_ROOT');
    expect(packageProvenance).toContain('EXTERNAL_APPEND_ONLY_LOCAL_EVIDENCE_NOT_PRODUCTION_SIGNATURE');
    expect(packageProvenance).toContain('appendExternalWindowsPackageProvenanceAnchor');
    expect(packageProvenance).toContain("await link(temporary, path)");
    expect(packageProvenance).toContain("authority: 'IMMUTABLE_RELEASE_BUNDLE_WITH_EXTERNAL_APPEND_ONLY_ANCHOR'");
    expect(packageProvenance).toContain('currentConveniencePromise');
    expect(packageBuilder).toContain('assertMatchingReleaseSourceProvenance');
    expect(packageBuilder).toContain('readCanonicalChannelSourceProtection');
    expect(packageBuilder).toContain('suppliedPath: sourceProtectionPath');
    expect(packageBuilder).not.toContain("sourceProtectionBinding = await readRegularFile(sourceProtectionPath");
    expect(packageBuilder).not.toContain('NSIS packaging requires --source-protection=<schema2 receipt>');
    expect(packageBuilder).toContain('verifyLocalSourceProtectionArtifacts');
    expect(packageBuilder).toContain('localArtifactReadback: localSourceProtectionReadback');
    expect(packageBuilder).toContain('Source protection receipt is not a verified tracked-only exact-commit receipt.');
  });
});
