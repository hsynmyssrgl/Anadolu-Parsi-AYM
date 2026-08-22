import { open, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createNextMonthlyRelease, installerArtifactTemplate } from './lib/monthly-release-version.mjs';

const root = resolve(import.meta.dirname, '..');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const channelArgument = process.argv.find((argument) => argument.startsWith('--channel='))?.slice('--channel='.length);
const previewOnly = process.argv.includes('--preview');
const lockPath = resolve(root, '.monthly-release-version.lock');
let lock;

const packageManifestPaths = async () => {
  const paths = ['package.json'];
  for (const parent of ['apps', 'packages']) {
    for (const entry of await readdir(resolve(root, parent), { withFileTypes: true })) {
      if (entry.isDirectory()) paths.push(`${parent}/${entry.name}/package.json`);
    }
  }
  return paths;
};

const replaceRequired = (source, pattern, replacement, label) => {
  if (!pattern.test(source)) throw new Error(`${label} güncellenemedi; beklenen işaret bulunamadı.`);
  return source.replace(pattern, replacement);
};

const turkishReleaseStage = Object.freeze({
  Bronze: 'Aktif Geliştirme',
  Silver: 'Aktif Test',
  Gold: 'Aktif Sürüm'
});

const updateReleaseJson = (value, release) => {
  const visit = (node, key = '') => {
    if (Array.isArray(node)) return node.map((item) => visit(item));
    if (!node || typeof node !== 'object') return node;
    const next = {};
    for (const [childKey, childValue] of Object.entries(node)) {
      if ((childKey === 'releaseVersion' || (childKey === 'version' && key === 'release')) && typeof childValue === 'string') {
        next[childKey] = release.packageVersion;
      } else if (childKey === 'releaseId' && typeof childValue === 'string' && /anadolu-parsi-aym-/u.test(childValue)) {
        next[childKey] = `anadolu-parsi-aym-${release.channel.toLowerCase()}-${release.packageVersion}`;
      } else next[childKey] = visit(childValue, childKey);
    }
    return next;
  };
  return visit(value);
};

try {
  lock = await open(lockPath, 'wx');
  const ledger = await readJson('config/release-ledger.json');
  const release = createNextMonthlyRelease({ ledger, channel: channelArgument || ledger.current.channel });
  if (previewOnly) {
    console.log(jsonText(release).trimEnd());
    process.exitCode = 0;
  } else {
    const planned = new Map();
    const manifests = await packageManifestPaths();
    const manifestValues = await Promise.all(manifests.map(async (path) => [path, await readJson(path)]));
    const workspaceNames = new Set(manifestValues.slice(1).map(([, value]) => value.name));
    for (const [path, manifest] of manifestValues) {
      manifest.version = release.packageVersion;
      for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
        for (const dependencyName of Object.keys(manifest[section] ?? {})) {
          if (workspaceNames.has(dependencyName)) manifest[section][dependencyName] = release.packageVersion;
        }
      }
      if (path === 'apps/desktop/package.json') {
        const artifactName = installerArtifactTemplate(release);
        manifest.build.artifactName = artifactName;
        manifest.build.win.artifactName = artifactName;
      }
      planned.set(path, jsonText(manifest));
    }

    const windowsPackagerManifestPath = 'tools/windows-packager/package.json';
    const windowsPackagerManifest = await readJson(windowsPackagerManifestPath);
    windowsPackagerManifest.version = release.packageVersion;
    planned.set(windowsPackagerManifestPath, jsonText(windowsPackagerManifest));

    const lockFile = await readJson('package-lock.json');
    lockFile.version = release.packageVersion;
    for (const [key, value] of Object.entries(lockFile.packages ?? {})) {
      if (key === '' || key.startsWith('apps/') || key.startsWith('packages/')) {
        if (typeof value.version === 'string') value.version = release.packageVersion;
        for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
          for (const dependencyName of Object.keys(value[section] ?? {})) {
            if (workspaceNames.has(dependencyName)) value[section][dependencyName] = release.packageVersion;
          }
        }
      }
    }
    planned.set('package-lock.json', jsonText(lockFile));

    const windowsPackagerLockPath = 'tools/windows-packager/package-lock.json';
    const windowsPackagerLock = await readJson(windowsPackagerLockPath);
    windowsPackagerLock.version = release.packageVersion;
    if (windowsPackagerLock.packages?.['']) windowsPackagerLock.packages[''].version = release.packageVersion;
    planned.set(windowsPackagerLockPath, jsonText(windowsPackagerLock));

    const appMetaPath = 'packages/domain/src/app-meta.ts';
    let appMeta = await readFile(resolve(root, appMetaPath), 'utf8');
    appMeta = replaceRequired(appMeta, /edition: '[^']+',/u, `edition: '${release.channel}',`, 'APP_META edition');
    appMeta = replaceRequired(appMeta, /version: '[^']+',/u, `version: '${release.version}',`, 'APP_META version');
    appMeta = replaceRequired(appMeta, /packageVersion: '[^']+',/u, `packageVersion: '${release.packageVersion}',`, 'APP_META packageVersion');
    appMeta = replaceRequired(appMeta, /releaseLabel: '[^']+',/u, `releaseLabel: '${release.visibleRelease}',`, 'APP_META releaseLabel');
    appMeta = replaceRequired(appMeta, /releaseId: '[^']+',/u, `releaseId: '${release.releaseId}',`, 'APP_META releaseId');
    appMeta = replaceRequired(appMeta, /monthlySequence: \d+,/u, `monthlySequence: ${release.monthlySequence},`, 'APP_META monthlySequence');
    appMeta = replaceRequired(appMeta, /stage: '[^']+'/u, `stage: '${turkishReleaseStage[release.channel]}'`, 'APP_META stage');
    planned.set(appMetaPath, appMeta);

    ledger.current = { ...release, parentSourceSha256: ledger.current?.parentSourceSha256 ?? null };
    ledger.entries.push({
      channel: release.channel,
      date: release.date,
      monthlySequence: release.monthlySequence,
      version: release.version,
      packageVersion: release.packageVersion,
      releaseId: release.releaseId,
      status: release.status,
      summary: release.summary
    });
    planned.set('config/release-ledger.json', jsonText(ledger));

    const repositoryMetadata = await readJson('repository-metadata.json');
    Object.assign(repositoryMetadata, {
      repositoryVersion: release.version,
      applicationVersion: release.version,
      visibleRelease: release.visibleRelease,
      packageVersion: release.packageVersion,
      edition: release.channel,
      releaseId: release.releaseId,
      revision: `${release.date.replaceAll('-', '')}-${release.monthlySequence}`,
      monthlySequence: release.monthlySequence,
      releaseDate: release.date,
      generatedDate: release.date
    });
    planned.set('repository-metadata.json', jsonText(repositoryMetadata));

    const constitution = await readJson('config/project-constitution.json');
    constitution.effectiveRelease = release.visibleRelease;
    planned.set('config/project-constitution.json', jsonText(constitution));

    const activeDocumentSet = await readJson('config/active-document-set.json');
    activeDocumentSet.release = release.visibleRelease;
    planned.set('config/active-document-set.json', jsonText(activeDocumentSet));

    for (const path of [
      'config/32-u-ppk-025-signing-trust-policy.json',
      'config/32-u-ppk-025-software-supply-chain-inventory.json',
      'config/32-u-ppk-025-software-supply-chain-policy.json',
      'config/32-u-ppk-025-software-supply-chain-scope.json'
    ]) planned.set(path, jsonText(updateReleaseJson(await readJson(path), release)));

    const temporaryPaths = [];
    try {
      for (const [path, content] of planned) {
        const temporaryPath = `${resolve(root, path)}.release-next`;
        await writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx' });
        temporaryPaths.push(temporaryPath);
      }
      for (const path of planned.keys()) await rename(`${resolve(root, path)}.release-next`, resolve(root, path));
    } catch (error) {
      await Promise.allSettled(temporaryPaths.map((path) => rm(path, { force: true })));
      throw error;
    }
    console.log(`Resmî sürüm ayrıldı: ${release.visibleRelease} (${release.packageVersion}).`);
  }
} finally {
  await lock?.close();
  await rm(lockPath, { force: true });
}
