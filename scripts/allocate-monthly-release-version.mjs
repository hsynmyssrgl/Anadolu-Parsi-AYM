import { createHash } from 'node:crypto';
import { open, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertExpectedReleaseId, createNextMonthlyRelease, installerArtifactTemplate } from './lib/monthly-release-version.mjs';

const root = resolve(import.meta.dirname, '..');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const stable = (value) => Array.isArray(value)
  ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const channelArgument = process.argv.find((argument) => argument.startsWith('--channel='))?.slice('--channel='.length);
const expectedReleaseIdArgument = process.argv.find((argument) => argument.startsWith('--expected-release-id='))
  ?.slice('--expected-release-id='.length);
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

const releaseChannelIdentity = (channel) => ({
  appId: `tr.anadoluparsi.aileyasammerkezi.${channel.toLowerCase()}`,
  productName: `ParsYuva Aile Yaşam Merkezi ${channel}`,
  executableName: `ParsYuva-${channel}`,
  shortcutName: `ParsYuva ${channel}`
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

const updateJsonReleaseField = (value, field, release) => ({ ...value, [field]: release.visibleRelease });

const updateActiveText = (source, transformations, path) => transformations.reduce(
  (current, [pattern, replacement, label]) => replaceRequired(current, pattern, replacement, `${path} ${label}`),
  source
);

const previewLedger = await readJson('config/release-ledger.json');
const previewRelease = createNextMonthlyRelease({
  ledger: previewLedger,
  channel: channelArgument || previewLedger.current.channel
});
if (previewOnly) {
  console.log(jsonText(previewRelease).trimEnd());
} else {
  assertExpectedReleaseId(previewRelease, expectedReleaseIdArgument);
  try {
    lock = await open(lockPath, 'wx');
    const ledger = await readJson('config/release-ledger.json');
    const release = assertExpectedReleaseId(createNextMonthlyRelease({
      ledger,
      channel: channelArgument || ledger.current.channel
    }), expectedReleaseIdArgument);
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
        const identity = releaseChannelIdentity(release.channel);
        manifest.build.appId = identity.appId;
        manifest.build.productName = identity.productName;
        manifest.build.executableName = identity.executableName;
        manifest.build.nsis.shortcutName = identity.shortcutName;
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

    const installerPath = 'apps/desktop/build/installer.nsh';
    let installer = await readFile(resolve(root, installerPath), 'utf8');
    installer = replaceRequired(
      installer,
      /!define PPT_INSTALLER_RELEASE_CHANNEL "(?:Bronze|Silver|Gold)"/u,
      `!define PPT_INSTALLER_RELEASE_CHANNEL "${release.channel}"`,
      'installer release channel'
    );
    planned.set(installerPath, installer);

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

    const canonicalRegistryPath = 'config/canonical-rule-registry.json';
    const canonicalRegistry = await readJson(canonicalRegistryPath);
    canonicalRegistry.effectiveRelease = release.visibleRelease;
    const canonicalCore = { ...canonicalRegistry };
    delete canonicalCore.rulesSha256;
    canonicalRegistry.rulesSha256 = sha256(stable(canonicalCore));
    planned.set(canonicalRegistryPath, jsonText(canonicalRegistry));

    const constitution = await readJson('config/project-constitution.json');
    constitution.effectiveRelease = release.visibleRelease;
    constitution.canonicalRulesSha256 = canonicalRegistry.rulesSha256;
    planned.set('config/project-constitution.json', jsonText(constitution));

    const activeDocumentSet = await readJson('config/active-document-set.json');
    activeDocumentSet.release = release.visibleRelease;
    planned.set('config/active-document-set.json', jsonText(activeDocumentSet));

    for (const [path, field] of [
      ['config/mutation-release-readiness-policy.json', 'release'],
      ['config/user-decision-ledger.json', 'release'],
      ['config/work-segmentation-plan.json', 'release'],
      ['config/documentation-synchronization-policy.json', 'release']
    ]) planned.set(path, jsonText(updateJsonReleaseField(await readJson(path), field, release)));

    const acknowledgement = await readJson('config/rule-acknowledgement.json');
    acknowledgement.release = release.visibleRelease;
    acknowledgement.rulesSha256 = canonicalRegistry.rulesSha256;
    planned.set('config/rule-acknowledgement.json', jsonText(acknowledgement));

    const enforcement = await readJson('config/rule-enforcement-registry.json');
    enforcement.release = release.visibleRelease;
    enforcement.canonicalRulesSha256 = canonicalRegistry.rulesSha256;
    planned.set('config/rule-enforcement-registry.json', jsonText(enforcement));

    const commercialManifest = await readJson('docs/ticari-urun-temeli/00_TEMEL_SURUM_MANIFESTOSU.json');
    commercialManifest.sourceRelease = release.visibleRelease;
    commercialManifest.canonicalRuleCount = canonicalRegistry.ruleCount;
    commercialManifest.canonicalRuleSha256 = canonicalRegistry.rulesSha256;
    planned.set('docs/ticari-urun-temeli/00_TEMEL_SURUM_MANIFESTOSU.json', jsonText(commercialManifest));

    const commercialRuleBinding = await readJson('docs/ticari-urun-temeli/01_YONETIM/04_AKTIF_KURAL_SICILI.json');
    commercialRuleBinding.anaKuralSiciliId = canonicalRegistry.id;
    commercialRuleBinding.anaKuralSayisi = canonicalRegistry.ruleCount;
    commercialRuleBinding.aktifKuralSayisi = canonicalRegistry.activeRuleCount;
    commercialRuleBinding.degistirilmisKuralSayisi = canonicalRegistry.supersededRuleCount;
    commercialRuleBinding.anaKuralSha256 = canonicalRegistry.rulesSha256;
    planned.set('docs/ticari-urun-temeli/01_YONETIM/04_AKTIF_KURAL_SICILI.json', jsonText(commercialRuleBinding));

    const activeGovernance = await readJson('config/active-governance-ledger.json');
    activeGovernance.release = release.visibleRelease;
    activeGovernance.releaseId = release.releaseId;
    activeGovernance.canonicalRulesSha256 = canonicalRegistry.rulesSha256;
    activeGovernance.persistentLibraryReleasePath = `/ParsYuva/ParsYuva Aile Yasam Merkezi/${release.visibleRelease}`;
    planned.set('config/active-governance-ledger.json', jsonText(activeGovernance));

    const activeTextPlans = new Map([
      ['README.md', [
        [/^- Application Version: `[^`]+`$/mu, `- Application Version: \`${release.version}\``, 'application version'],
        [/^- Package Version: `[^`]+`$/mu, `- Package Version: \`${release.packageVersion}\``, 'package version'],
        [/^- Monthly Sequence: \*\*\d+\*\*$/mu, `- Monthly Sequence: **${release.monthlySequence}**`, 'monthly sequence']
      ]],
      ['START_HERE_TR.md', [
        [/^- Application Version: `[^`]+`$/mu, `- Application Version: \`${release.version}\``, 'application version'],
        [/^- Package Version: `[^`]+`$/mu, `- Package Version: \`${release.packageVersion}\``, 'package version'],
        [/^- Monthly Sequence: \*\*\d+\*\*$/mu, `- Monthly Sequence: **${release.monthlySequence}**`, 'monthly sequence']
      ]],
      ['PAKET_OZETI_TR.md', [
        [/^# Paket Özeti — .*$/mu, `# Paket Özeti — ${release.visibleRelease}`, 'title'],
        [/^- Application Version: `[^`]+`$/mu, `- Application Version: \`${release.version}\``, 'application version'],
        [/^- Package Version: `[^`]+`$/mu, `- Package Version: \`${release.packageVersion}\``, 'package version'],
        [/^- Monthly Sequence: \*\*\d+\*\*$/mu, `- Monthly Sequence: **${release.monthlySequence}**`, 'monthly sequence']
      ]],
      ['DELIVERY_SUMMARY_TR.md', [
        [/^# Paket Özeti — .*$/mu, `# Paket Özeti — ${release.visibleRelease}`, 'title'],
        [/^- Application Version: `[^`]+`$/mu, `- Application Version: \`${release.version}\``, 'application version'],
        [/^- Package Version: `[^`]+`$/mu, `- Package Version: \`${release.packageVersion}\``, 'package version'],
        [/^- Monthly Sequence: \*\*\d+\*\*$/mu, `- Monthly Sequence: **${release.monthlySequence}**`, 'monthly sequence']
      ]],
      ['VERIFICATION_REPORT.md', [
        [/^# Doğrulama Durumu — .*$/mu, `# Doğrulama Durumu — ${release.visibleRelease}`, 'title'],
        [/^- Application Version: `[^`]+`$/mu, `- Application Version: \`${release.version}\``, 'application version'],
        [/^- Package Version: `[^`]+`$/mu, `- Package Version: \`${release.packageVersion}\``, 'package version'],
        [/^- Monthly Sequence: \*\*\d+\*\*$/mu, `- Monthly Sequence: **${release.monthlySequence}**`, 'monthly sequence']
      ]],
      ['BUILD_STATUS.md', [
        [/^- Application Version: `[^`]+`$/mu, `- Application Version: \`${release.version}\``, 'application version'],
        [/^- Package Version: `[^`]+`$/mu, `- Package Version: \`${release.packageVersion}\``, 'package version'],
        [/^- Monthly Sequence: \*\*\d+\*\*$/mu, `- Monthly Sequence: **${release.monthlySequence}**`, 'monthly sequence']
      ]],
      ...['SECURITY.md', 'CONTRIBUTING.md', 'COPYRIGHT.md'].map((path) => [path, [
        [/^\*\*Aktif sürüm:\*\* .*$/mu, `**Aktif sürüm:** ${release.visibleRelease}`, 'active release']
      ]]),
      ['docs/current/00_AKTIF_ANA_KAPSAM.md', [[/^- Aktif kanal ve sürüm: .*$/mu, `- Aktif kanal ve sürüm: **${release.visibleRelease}**`, 'active release']]],
      ['docs/current/04_AKTIF_BRONZE_YOL_HARITASI.md', [[/^- Aktif sürüm: .*$/mu, `- Aktif sürüm: ${release.visibleRelease}`, 'active release']]],
      ['docs/current/06_KANONIK_KURAL_SICILI.md', [
        [/^- Görünür sürüm: .*$/mu, `- Görünür sürüm: **${release.visibleRelease}**`, 'visible release'],
        [/^- Kural SHA-256: `[^`]+`$/mu, `- Kural SHA-256: \`${canonicalRegistry.rulesSha256}\``, 'rule hash']
      ]],
      ['docs/current/07_TESLIM_SOHBET_VE_KALICI_KAYIT_SOZLESMESI.md', [
        [/^- Görünür sürüm: .*$/mu, `- Görünür sürüm: **${release.visibleRelease}**`, 'visible release'],
        [/^- Bu sürümün zorunlu Library dalı: `[^`]+`$/mu, `- Bu sürümün zorunlu Library dalı: \`/ParsYuva/ParsYuva Aile Yasam Merkezi/${release.visibleRelease}\``, 'library release path']
      ]],
      ['docs/current/08_TUM_BELGELER_DIZINI.md', [[/^- Sürüm: .*$/mu, `- Sürüm: **${release.visibleRelease}**`, 'release']]],
      ['docs/current/09_KULLANICI_KARARLARI_KAYDI.md', [[/^- Görünür sürüm: .*$/mu, `- Görünür sürüm: **${release.visibleRelease}**`, 'visible release']]],
      ['docs/current/10_TUM_KURALLAR_ASILAMAZ_YURUTME_SOZLESMESI.md', [
        [/^- Sürüm: .*$/mu, `- Sürüm: **${release.visibleRelease}**`, 'release'],
        [/^- Kural SHA-256: `[^`]+`$/mu, `- Kural SHA-256: \`${canonicalRegistry.rulesSha256}\``, 'rule hash']
      ]],
      ['docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md', [
        [/^- Görünür ürün sürümü: .*$/mu, `- Görünür ürün sürümü: **${release.visibleRelease}**`, 'visible release'],
        [
          /^- Kural sicili: \*\*[^*]+\*\*, toplam \d+, aktif \d+, superseded \d+, SHA-256 `[^`]+`\.$/mu,
          `- Kural sicili: **${canonicalRegistry.id}**, toplam ${canonicalRegistry.ruleCount}, aktif ${canonicalRegistry.activeRuleCount}, superseded ${canonicalRegistry.supersededRuleCount}, SHA-256 \`${canonicalRegistry.rulesSha256}\`.`,
          'canonical rule identity'
        ]
      ]],
      ['docs/current/13_KURUMSALLASMA_VE_GLOBAL_MARKA_PLANI.md', [[/^- Görünür sürüm: .*$/mu, `- Görünür sürüm: **${release.visibleRelease}**`, 'visible release']]],
      ['docs/current/15_EK_KURAL_TOPLU_BIRLESTIRME_SICILI.md', [[/^- Görünür sürüm: .*$/mu, `- Görünür sürüm: **${release.visibleRelease}**`, 'visible release']]],
      ['docs/ticari-urun-temeli/00_OKU_BENI.md', [
        [
          /^Guncel ust kayit (?:Bronze|Silver|Gold) \d{2}\.\d{2}\.\d{4}\.\d+ ve /mu,
          `Guncel ust kayit ${release.visibleRelease} ve `,
          'current upper record'
        ],
        [
          /Kanonik V\d+, \d+ kural ve SHA-256 `[a-f0-9]{64}`/u,
          `Kanonik V${String(canonicalRegistry.id).match(/V(\d+)$/u)?.[1]}, ${canonicalRegistry.ruleCount} kural ve SHA-256 \`${canonicalRegistry.rulesSha256}\``,
          'canonical rule identity'
        ]
      ]]
    ]);
    for (const [path, transformations] of activeTextPlans) {
      planned.set(path, updateActiveText(await readFile(resolve(root, path), 'utf8'), transformations, path));
    }

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
  } finally {
    await lock?.close();
    await rm(lockPath, { force: true });
  }
}
