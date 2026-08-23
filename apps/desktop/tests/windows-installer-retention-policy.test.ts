import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  evaluateWindowsInstallerRetention,
  listWindowsInstallerArtifacts,
  removeWindowsInstallerArtifacts,
  removeWindowsPackagingArtifacts,
} from '../../../scripts/lib/windows-installer-artifacts.mjs';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

const createTemporaryRelease = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'parsyuva-installer-retention-'));
  temporaryDirectories.push(directory);
  return directory;
};

describe('Windows installer retention policy', () => {
  it('rebuilds every workspace package before all unsigned Windows package paths', async () => {
    const manifest = JSON.parse(await readFile('apps/desktop/package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    for (const scriptName of ['package:win:local-test', 'package:win:dir']) {
      const script = manifest.scripts[scriptName] ?? '';
      expect(script).toContain('npm --prefix ../.. run build:packages');
      expect(script.indexOf('npm --prefix ../.. run build:packages')).toBeLessThan(
        script.indexOf('npm run build'),
      );
    }
  });

  it('rejects installer artifacts from an older visible version', async () => {
    const directory = await createTemporaryRelease();
    await writeFile(join(directory, 'ParsYuva-Bronze-22.08.2026.42.exe'), 'old');
    const artifacts = await listWindowsInstallerArtifacts(directory);

    expect(evaluateWindowsInstallerRetention({
      artifacts,
      channel: 'Bronze',
      version: '22.08.2026.43',
    })).toMatchObject({ status: 'FAIL', artifactCount: 1 });
  });

  it('accepts only the current installer set', async () => {
    const directory = await createTemporaryRelease();
    await writeFile(join(directory, 'ParsYuva-Bronze-22.08.2026.43.exe'), 'current');
    await writeFile(join(directory, 'ParsYuva-Bronze-22.08.2026.43.exe.blockmap'), 'blockmap');
    const artifacts = await listWindowsInstallerArtifacts(directory);

    expect(evaluateWindowsInstallerRetention({
      artifacts,
      channel: 'Bronze',
      version: '22.08.2026.43',
    })).toMatchObject({ status: 'PASS', artifactCount: 2 });
  });

  it('fails closed when a non-empty artifact set has no current installer executable', async () => {
    const directory = await createTemporaryRelease();
    await writeFile(join(directory, 'ParsYuva-Bronze-22.08.2026.43.exe.blockmap'), 'blockmap');
    const artifacts = await listWindowsInstallerArtifacts(directory);

    const result = evaluateWindowsInstallerRetention({
      artifacts,
      channel: 'Bronze',
      version: '22.08.2026.43',
    });

    expect(result.status).toBe('FAIL');
    expect(result.failures).toContain(
      "Geçerli kurulum EXE'si eksik: ParsYuva-Bronze-22.08.2026.43.exe",
    );
  });

  it('rejects an installer-shaped reparse point', async () => {
    const directory = await createTemporaryRelease();
    const targetDirectory = join(directory, 'reparse-target');
    await mkdir(targetDirectory);
    await symlink(
      targetDirectory,
      join(directory, 'ParsYuva-Bronze-22.08.2026.43.exe'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    await expect(listWindowsInstallerArtifacts(directory)).rejects.toThrow(
      'Installer artifact must be a regular file',
    );
  });

  it('removes installer artifacts but preserves unrelated release diagnostics', async () => {
    const directory = await createTemporaryRelease();
    await writeFile(join(directory, 'ParsYuva-Bronze-22.08.2026.42.exe'), 'old');
    await writeFile(join(directory, 'ParsYuva-Bronze-22.08.2026.42.exe.sha256'), 'hash');
    await writeFile(join(directory, 'builder-debug.yml'), 'diagnostic');

    const result = await removeWindowsInstallerArtifacts(directory);

    expect(result.removedCount).toBe(2);
    expect(await listWindowsInstallerArtifacts(directory)).toEqual([]);
    expect(await readFile(join(directory, 'builder-debug.yml'), 'utf8')).toBe('diagnostic');
  });

  it('cleans every stale generated Windows package output before a new build', async () => {
    const directory = await createTemporaryRelease();
    await writeFile(join(directory, 'ParsYuva-Bronze-22.08.2026.42.exe'), 'old');
    await writeFile(join(directory, '@pptdesktop-22.8.2026-42-x64.nsis.7z'), 'stale-payload');
    await writeFile(join(directory, 'builder-debug.yml'), 'diagnostic');
    await writeFile(join(directory, 'builder-effective-config.yaml'), 'config');
    await mkdir(join(directory, 'win-unpacked'));
    await writeFile(join(directory, 'win-unpacked', 'ParsYuva.exe'), 'old-runtime');
    await writeFile(join(directory, 'keep-me.txt'), 'unrelated');

    const result = await removeWindowsPackagingArtifacts(directory);

    expect(result.removed.map((item) => item.name).sort()).toEqual([
      '@pptdesktop-22.8.2026-42-x64.nsis.7z',
      'ParsYuva-Bronze-22.08.2026.42.exe',
      'builder-debug.yml',
      'builder-effective-config.yaml',
      'win-unpacked',
    ]);
    expect(await listWindowsInstallerArtifacts(directory)).toEqual([]);
    expect(await readFile(join(directory, 'keep-me.txt'), 'utf8')).toBe('unrelated');
  });

  it('fails before cleanup when an installer-shaped entry is a directory', async () => {
    const directory = await createTemporaryRelease();
    const regularArtifact = join(directory, 'ParsYuva-Bronze-22.08.2026.43.exe');
    await writeFile(regularArtifact, 'current');
    await mkdir(join(directory, 'ParsYuva-Bronze-22.08.2026.42.exe'));

    await expect(removeWindowsPackagingArtifacts(directory)).rejects.toThrow(
      'Installer artifact must be a regular file',
    );
    expect(await readFile(regularArtifact, 'utf8')).toBe('current');
  });
});
