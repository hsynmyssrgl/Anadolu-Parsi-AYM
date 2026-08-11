import { readFile, readdir, writeFile } from 'node:fs/promises';
import { isWorkspaceLockPath, workspaceManifestPath } from './lib/workspace-paths.mjs';
import { LEDGER_PATH as MASTER_LEDGER_PATH, POLICY_PATH as MASTER_LEDGER_POLICY_PATH, getRuleSetForBuild as getMasterRuleSetForBuild, readJson as readMasterLedgerJson, validateLedger as validateMasterLedger, writeJson as writeMasterLedgerJson, writeLedgerDocument as writeMasterLedgerDocument } from './lib/master-build-ledger.mjs';

const [displayVersion, packageVersion, buildText, summaryText, milestoneText, ruleAckText, newChatHandoffText] = process.argv.slice(2);
if (!/^\d{2}\.\d{2}\.\d{4}\.\d+$/.test(displayVersion ?? '')) {
  throw new Error('Display version must use DD.MM.YYYY.SEQUENCE format.');
}
if (!/^\d{1,2}\.\d{1,2}\.\d{4}-\d+$/.test(packageVersion ?? '')) {
  throw new Error('Package version must use D.M.YYYY-SEQUENCE format.');
}
if (!/^\d+$/.test(buildText ?? '')) throw new Error('Build number must be numeric.');

const masterLedger = await readMasterLedgerJson(MASTER_LEDGER_PATH);
const masterLedgerPolicy = await readMasterLedgerJson(MASTER_LEDGER_POLICY_PATH);
const masterBuild = Number(buildText);
if (masterBuild === masterLedger.currentBuild + 1 && masterLedger.currentBuild >= 207) {
  const previous = masterLedger.builds.find((entry) => entry.build === masterLedger.currentBuild);
  const assessment = previous?.conversationCapacityAssessment;
  const hardStop = masterLedgerPolicy?.rules?.conversationCapacityHardStopUsedPercent ?? 90;
  if (!assessment) throw new Error(`Build ${masterBuild} version update blocked: previous Build ${masterLedger.currentBuild} has no conversation-capacity assessment.`);
  if (assessment.method === 'platform_actual' && assessment.actualUsedPercent >= hardStop) {
    const expectedHandoff = `NEW_CHAT_HANDOFF_BUILD${masterLedger.currentBuild}`;
    if (newChatHandoffText !== expectedHandoff) {
      throw new Error(`Build ${masterBuild} version update blocked by actual conversation hard stop: previous Build ${masterLedger.currentBuild} actual context use is ${assessment.actualUsedPercent}% (>=${hardStop}%). Start a new chat and pass ${expectedHandoff} after reading ${assessment.handoffFile ?? 'the generated handoff prompt'}.`);
    }
  }
}
const effectiveRuleSet = getMasterRuleSetForBuild(masterLedger, masterBuild);
if (!effectiveRuleSet) throw new Error(`No effective project rule set exists for Build ${masterBuild}. Read ${masterLedger.authoritativeDocument} first.`);
if (ruleAckText !== effectiveRuleSet.sha256) {
  throw new Error(`Build ${masterBuild} version update blocked: read ${masterLedger.authoritativeDocument} and pass current project-rules SHA-256 as the sixth argument: ${effectiveRuleSet.sha256}`);
}

const [, day, month, year, sequence] = /^(\d{2})\.(\d{2})\.(\d{4})\.(\d+)$/.exec(displayVersion);
const expectedPackageVersion = `${Number(day)}.${Number(month)}.${year}-${sequence}`;
if (packageVersion !== expectedPackageVersion) {
  throw new Error(`Package version ${packageVersion} does not match display version ${displayVersion}; expected ${expectedPackageVersion}.`);
}
if (buildText !== sequence) throw new Error(`Build number ${buildText} does not match sequence ${sequence}.`);
const attestationFileName = `Anadolu_Parsi_Aile_Yasam_Merkezi_Bronze_RC2_Build${buildText}_Teslim_Kanit_Tasdiki_${displayVersion}.json`;

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const writeJson = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
const replaceRequired = (source, pattern, replacement, label) => {
  if (!pattern.test(source)) throw new Error(`${label} marker was not found.`);
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
};
const manifestPaths = ['package.json'];
for (const parent of ['apps', 'packages']) {
  for (const entry of await readdir(parent, { withFileTypes: true })) {
    if (entry.isDirectory()) manifestPaths.push(workspaceManifestPath(parent, entry.name));
  }
}

const workspaceNames = new Set();
for (const path of manifestPaths.slice(1)) workspaceNames.add((await readJson(path)).name);
manifestPaths.push('tools/windows-packager/package.json');
for (const path of manifestPaths) {
  const manifest = await readJson(path);
  manifest.version = packageVersion;
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const dependencyName of Object.keys(manifest[section] ?? {})) {
      if (workspaceNames.has(dependencyName)) manifest[section][dependencyName] = packageVersion;
    }
  }
  await writeJson(path, manifest);
}

const lock = await readJson('package-lock.json');
lock.version = packageVersion;
if (lock.packages?.['']) lock.packages[''].version = packageVersion;
for (const [packagePath, entry] of Object.entries(lock.packages ?? {})) {
  if (packagePath === '' || isWorkspaceLockPath(packagePath)) {
    entry.version = packageVersion;
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const dependencyName of Object.keys(entry[section] ?? {})) {
        if (workspaceNames.has(dependencyName)) entry[section][dependencyName] = packageVersion;
      }
    }
  }
}
await writeJson('package-lock.json', lock);

const windowsPackagerLockPath = 'tools/windows-packager/package-lock.json';
const windowsPackagerLock = await readJson(windowsPackagerLockPath);
windowsPackagerLock.version = packageVersion;
if (windowsPackagerLock.packages?.['']) windowsPackagerLock.packages[''].version = packageVersion;
await writeJson(windowsPackagerLockPath, windowsPackagerLock);

const appMetaPath = 'packages/domain/src/app-meta.ts';
let appMeta = await readFile(appMetaPath, 'utf8');
appMeta = appMeta
  .replace(/version: '[^']+'/, `version: '${displayVersion}'`)
  .replace(/packageVersion: '[^']+'/, `packageVersion: '${packageVersion}'`)
  .replace(/stage: 'Bronze RC2 · Aktif Geliştirme · Build \d+'/, `stage: 'Bronze RC2 · Aktif Geliştirme · Build ${buildText}'`);
await writeFile(appMetaPath, appMeta);

const ledgerPath = 'artifacts/manifests/VERSION_LEDGER.json';
const ledger = await readJson(ledgerPath);
if (!Array.isArray(ledger.entries)) throw new Error('VERSION_LEDGER entries must be an array.');
const ledgerEntry = {
  version: displayVersion,
  packageVersion,
  channel: 'Bronze',
  stage: 'RC2 Aktif Geliştirme',
  date: `${year}-${month}-${day}`,
  summary: summaryText ?? `Bronze RC2 Build ${buildText} kaynak sürümü senkronize edildi; ayrıntılı kapsam Build raporunda tutulur.`,
  sequence: Number(buildText),
  milestone: milestoneText ?? `Bronze RC2 Build ${buildText} active development`
};
const existingIndex = ledger.entries.findIndex((entry) => entry.version === displayVersion);
if (existingIndex >= 0) {
  ledger.entries[existingIndex] = ledgerEntry;
} else {
  const previous = ledger.entries.at(-1);
  if (previous) {
    const previousMatch = /^(\d{2})\.(\d{2})\.(\d{4})\.(\d+)$/.exec(previous.version);
    if (!previousMatch) throw new Error(`Invalid previous ledger version: ${previous.version}`);
    const expectedSequence = Number(previousMatch[4]) + 1;
    if (Number(buildText) !== expectedSequence) {
      throw new Error(`VERSION_LEDGER sequence must be ${expectedSequence}; received ${buildText}.`);
    }
  }
  ledger.entries.push(ledgerEntry);
}
await writeJson(ledgerPath, ledger);

if (!Array.isArray(masterLedger.builds)) throw new Error('Master build ledger builds must be an array.');
const previousMasterEntry = masterLedger.builds.find((entry) => entry.build === masterBuild - 1);
if (masterBuild > 1 && (!previousMasterEntry || previousMasterEntry.status !== 'COMPLETED')) {
  throw new Error(`Previous master build entry must be completed before Build ${masterBuild}.`);
}
const masterEntry = {
  build: masterBuild,
  version: displayVersion,
  date: `${year}-${month}-${day}`,
  channel: 'Bronze',
  stage: 'Bronze RC2 Active Development',
  status: 'IN_PROGRESS',
  summary: summaryText ?? `Bronze RC2 Build ${buildText} geliştirmesi başlatıldı; tamamlanma özeti build sonunda yazılacaktır.`,
  evidence: [
    `BUILD_STATUS_BRONZE_RC2_BUILD${buildText}.md`,
    `RELEASE_NOTES_BRONZE_RC2_BUILD${buildText}.md`
  ],
  rulesAcknowledgement: {
    version: effectiveRuleSet.version,
    sha256: effectiveRuleSet.sha256,
    acknowledgedAt: new Date().toISOString()
  }
};
const masterIndex = masterLedger.builds.findIndex((entry) => entry.build === masterBuild);
if (masterIndex >= 0) {
  if (masterLedger.builds[masterIndex].status === 'COMPLETED' && masterLedger.currentBuild !== masterBuild) {
    throw new Error(`Historical completed Build ${masterBuild} cannot be rewritten.`);
  }
  masterLedger.builds[masterIndex] = { ...masterLedger.builds[masterIndex], ...masterEntry };
} else {
  const lastMasterBuild = masterLedger.builds.at(-1)?.build ?? 0;
  if (masterBuild !== lastMasterBuild + 1) throw new Error(`Master build ledger sequence must be ${lastMasterBuild + 1}; received ${masterBuild}.`);
  masterLedger.builds.push(masterEntry);
}
masterLedger.currentBuild = masterBuild;
masterLedger.currentVersion = displayVersion;
masterLedger.currentStage = 'Bronze RC2 Active Development';
masterLedger.lastUpdatedAt = new Date().toISOString();
masterLedger.lastStatusNotification = {
  build: masterBuild,
  status: 'IN_PROGRESS',
  message: `Build ${masterBuild} başlatıldı; Ana Build Defteri ve ${effectiveRuleSet.version} kuralları ${effectiveRuleSet.sha256} özetiyle okunup kabul edildi.`,
  recordedAt: new Date().toISOString()
};
const masterValidation = validateMasterLedger(masterLedger, masterLedgerPolicy, { requireCompleted: false });
if (masterValidation.failures.length > 0) throw new Error(`Master build ledger start update failed:\n- ${masterValidation.failures.join('\n- ')}`);
await writeMasterLedgerJson(MASTER_LEDGER_PATH, masterLedger);
await writeMasterLedgerDocument(masterLedger);

const buildStatusPath = 'BUILD_STATUS.md';
let buildStatus = await readFile(buildStatusPath, 'utf8');
buildStatus = replaceRequired(buildStatus, /- Current Application Version: `[^`]+`/, `- Current Application Version: \`${displayVersion}\``, 'BUILD_STATUS application version');
buildStatus = replaceRequired(buildStatus, /- Current Package Version: `[^`]+`/, `- Current Package Version: \`${packageVersion}\``, 'BUILD_STATUS package version');
buildStatus = replaceRequired(buildStatus, /- Current Build: \*\*\d+\*\*/, `- Current Build: **${buildText}**`, 'BUILD_STATUS build number');
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const resetStatusLine = (label, value) => {
  const pattern = new RegExp(`^- ${escapeRegExp(label)}: \\*\\*[^\\n]+`, 'm');
  buildStatus = replaceRequired(buildStatus, pattern, `- ${label}: **${value}**`, `BUILD_STATUS ${label}`);
};
resetStatusLine('Source preflight gate', `NOT_RUN — Build ${buildText} için yeniden doğrulanmadı`);
resetStatusLine('Source integrity', `NOT_RUN — Build ${buildText} için yeniden doğrulanmadı`);
resetStatusLine('Clean install gate', `NOT_RUN — Build ${buildText} için yeniden denenmedi`);
resetStatusLine('Full root `tsc --noEmit`', 'NOT_RUN');
resetStatusLine('Unit and integration tests', `NOT_RUN — Build ${buildText} için yeniden çalıştırılmadı`);
resetStatusLine('Electron production build', 'NOT_RUN');
resetStatusLine('Blocking smoke chain', 'NOT_RUN');
resetStatusLine('Windows launch / installer', 'NOT_RUN');
const channelFlowPattern = /^- (?:Final\/Freeze\/Silver\/Gold|Channel flow): .*$/m;
const channelFlowLine = '- Channel flow: **Bronze development → Silver validation → Gold production**';
if (channelFlowPattern.test(buildStatus)) buildStatus = buildStatus.replace(channelFlowPattern, channelFlowLine);
else buildStatus = buildStatus.replace(/^- Current Stage: .*$/m, (line) => `${line}\n${channelFlowLine}`);
const attestationStatusPattern = /^- Detached delivery attestation: .*$/m;
const attestationStatusLine = `- Detached delivery attestation: \`${attestationFileName}\` — dış teslim dosyası, kaynak ZIP üretildikten sonra oluşturulur`;
if (attestationStatusPattern.test(buildStatus)) buildStatus = buildStatus.replace(attestationStatusPattern, attestationStatusLine);
else buildStatus = `${buildStatus.trimEnd()}\n${attestationStatusLine}\n`;
await writeFile(buildStatusPath, buildStatus);

const activeDevelopmentStatusPath = 'docs/09_ACTIVE_DEVELOPMENT_STATUS.md';
let activeDevelopmentStatus = await readFile(activeDevelopmentStatusPath, 'utf8');
activeDevelopmentStatus = replaceRequired(activeDevelopmentStatus, /\*\*Sürüm:\*\* [^\n]+/, `**Sürüm:** ${displayVersion}  `, 'active development version');
await writeFile(activeDevelopmentStatusPath, activeDevelopmentStatus);


const activeDocumentHeader = (title) => `# ${title}

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: \`${displayVersion}\`
- Package Version: \`${packageVersion}\`
- Stage: **Bronze RC2 Active Development**
- Build: **${buildText}**
`;
const currentReferences = `- Güncel durum: \`BUILD_STATUS_BRONZE_RC2_BUILD${buildText}.md\`
- Sürüm notları: \`RELEASE_NOTES_BRONZE_RC2_BUILD${buildText}.md\`
- Mimari doğrulama: \`BUILD${buildText}_ARCHITECTURE_VALIDATION_REPORT.md\`
- Teslim doğrulaması: \`BUILD${buildText}_DELIVERY_VALIDATION_REPORT.md\`
- Ayrık teslim kanıt tasdiki: \`${attestationFileName}\``;
const activeSummary = summaryText ?? `Bronze RC2 Build ${buildText} aktif geliştirme kaynak sürümü.`;
const activeMilestone = milestoneText ?? `Bronze RC2 Build ${buildText} active development`;

await writeFile('README.md', `${activeDocumentHeader('Anadolu Parsı Aile Yaşam Merkezi')}
## Güncel kaynak teslimi

${activeSummary}

- Milestone: **${activeMilestone}**

## Başlangıç

${currentReferences}
- Ana devam defteri: \`docs/17_MASTER_BUILD_LEDGER.md\`
- Kaynak kod: \`apps/\` ve \`packages/\`

Bu paket Bronze geliştirme sürümüdür. Yeni özellik ve ürün geliştirmeleri Bronze kanalında tamamlanır; kapsam tamamlandığında Silver doğrulama ve altyapı iyileştirme kanalına geçilir.
`);
await writeFile('START_HERE_TR.md', `${activeDocumentHeader('Başlangıç')}
## İzlenecek sıra

${currentReferences}
- Ana devam defteri: \`docs/17_MASTER_BUILD_LEDGER.md\`
- Kaynak kod: \`apps/\` ve \`packages/\`
- Makine tarafından okunabilir kanıtlar: \`artifacts/validation/\`

Bu paket yalnızca **Bronze RC2 Active Development** kaynak teslimidir; production installer içermez.
`);
const packageSummary = `${activeDocumentHeader(`Paket Özeti — Build ${buildText}`)}
## Kapsam

${activeSummary}

- Milestone: **${activeMilestone}**

## Yetkili belgeler

${currentReferences}
- Ana devam defteri: \`docs/17_MASTER_BUILD_LEDGER.md\`

Bu teslim Bronze geliştirme kanalındadır. Silver yalnız mevcut altyapının iyileştirilmesi ve bütün testlerin yürütülmesi için kullanılır; başarılı Silver sonrasında Gold üretim sürümü hazırlanır.
`;
await writeFile('PAKET_OZETI_TR.md', packageSummary);
await writeFile('DELIVERY_SUMMARY_TR.md', packageSummary);
await writeFile('VERIFICATION_REPORT.md', `${activeDocumentHeader(`Doğrulama Durumu — Bronze RC2 Build ${buildText}`)}
## Kaynak ve zorunlu kapılar

- Source preflight gate: **NOT_RUN**
- Source integrity: **NOT_RUN**
- Clean install gate: **NOT_RUN**
- Full root \`tsc --noEmit\`: **NOT_RUN**
- Unit and integration tests: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke chain: **NOT_RUN**
- Windows launch / installer: **NOT_RUN**

Bu durumlar Build ${buildText} doğrulamaları gerçekten çalıştırıldıkça güncellenir. Çalıştırılmayan bir kapı PASS olarak gösterilemez.

## Yetkili belgeler

${currentReferences}
- Ana devam defteri: \`docs/17_MASTER_BUILD_LEDGER.md\`
`);

const repositoryMetadataPath = 'repository-metadata.json';
const repositoryMetadata = await readJson(repositoryMetadataPath);
repositoryMetadata.repositoryVersion = displayVersion;
repositoryMetadata.applicationVersion = displayVersion;
repositoryMetadata.packageVersion = packageVersion;
repositoryMetadata.revision = `BUILD-${buildText}`;
repositoryMetadata.generatedDate = `${year}-${month}-${day}`;
repositoryMetadata.versionSequence = Number(buildText);
repositoryMetadata.workspaceCount = workspaceNames.size;
const foundationWorkspaceNames = new Set([
  '@ppt/core',
  '@ppt/contracts',
  '@ppt/config',
  '@ppt/logging',
  '@ppt/database',
  '@ppt/domain',
  '@ppt/events',
  '@ppt/repository-contracts',
  '@ppt/repositories'
]);
repositoryMetadata.foundationWorkspaceCount = [...foundationWorkspaceNames].filter((name) => workspaceNames.has(name)).length;
if (milestoneText) {
  const milestones = Array.isArray(repositoryMetadata.milestones)
    ? repositoryMetadata.milestones.filter((value) => typeof value === 'string')
    : [];
  if (!milestones.includes(milestoneText)) milestones.push(milestoneText);
  repositoryMetadata.milestones = milestones;
}
await writeJson(repositoryMetadataPath, repositoryMetadata);

console.log(`Workspace version, active status surfaces, ledger and repository metadata updated safely: ${displayVersion} / ${packageVersion} / Build ${buildText}.`);
