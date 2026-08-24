import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const LEDGER_PATH = 'config/master-build-ledger.json';
export const POLICY_PATH = 'config/master-build-ledger-policy.json';
export const DOCUMENT_PATH = 'docs/17_MASTER_BUILD_LEDGER.md';

export const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
export const writeJson = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);

const escapeCell = (value) => String(value ?? '').replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();

const canonicalRulePayload = (ruleSet) => JSON.stringify({
  version: ruleSet.version,
  effectiveBuild: ruleSet.effectiveBuild,
  rules: ruleSet.rules
}, Object.keys({version:1,effectiveBuild:1,rules:1}).sort());

const canonicalize = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};

export const calculateRuleSetHash = (ruleSet) => createHash('sha256').update(canonicalize({
  version: ruleSet.version,
  effectiveBuild: ruleSet.effectiveBuild,
  rules: ruleSet.rules
})).digest('hex');

export const getRuleSetForBuild = (ledger, build) => [...(ledger?.projectRules?.versions ?? [])]
  .filter((item) => Number.isInteger(item?.effectiveBuild) && item.effectiveBuild <= build)
  .sort((a, b) => b.effectiveBuild - a.effectiveBuild)[0] ?? null;

export const validateLedger = (ledger, policy, options = {}) => {
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };
  check(ledger?.schemaVersion === 1, `ledger schemaVersion=${ledger?.schemaVersion}`);
  check(ledger?.policyId === policy?.policyId, `ledger policyId=${ledger?.policyId}`);
  check(ledger?.product === 'ParsYuva Aile Yaşam Merkezi', `ledger product=${ledger?.product}`);
  check(Number.isInteger(ledger?.currentBuild) && ledger.currentBuild > 0, `invalid currentBuild=${ledger?.currentBuild}`);
  check(/^\d{2}\.\d{2}\.\d{4}\.\d+$/.test(ledger?.currentVersion ?? ''), `invalid currentVersion=${ledger?.currentVersion}`);
  check(Array.isArray(ledger?.builds) && ledger.builds.length > 0, 'builds must be a non-empty array');
  check(Array.isArray(ledger?.remainingWork) && ledger.remainingWork.length > 0, 'remainingWork must be a non-empty array');
  check(ledger?.projectRules?.authoritative === true, 'projectRules.authoritative must be true');
  check(typeof ledger?.projectRules?.startupRequirement === 'string' && ledger.projectRules.startupRequirement.trim().length > 20, 'projectRules.startupRequirement missing');
  check(Array.isArray(ledger?.projectRules?.versions) && ledger.projectRules.versions.length > 0, 'projectRules.versions must be non-empty');
  const ruleVersions = new Set();
  for (const ruleSet of ledger?.projectRules?.versions ?? []) {
    check(typeof ruleSet?.version === 'string' && ruleSet.version.length > 0, 'project rule version missing');
    check(!ruleVersions.has(ruleSet?.version), `duplicate project rule version=${ruleSet?.version}`);
    ruleVersions.add(ruleSet?.version);
    check(Number.isInteger(ruleSet?.effectiveBuild) && ruleSet.effectiveBuild > 0, `rule set ${ruleSet?.version} invalid effectiveBuild`);
    check(Array.isArray(ruleSet?.rules) && ruleSet.rules.length > 0, `rule set ${ruleSet?.version} rules missing`);
    const ruleIds = new Set();
    for (const rule of ruleSet?.rules ?? []) {
      check(typeof rule?.id === 'string' && /^PR-\d{3}$/.test(rule.id), `rule set ${ruleSet?.version} invalid rule id=${rule?.id}`);
      check(!ruleIds.has(rule?.id), `rule set ${ruleSet?.version} duplicate rule id=${rule?.id}`);
      ruleIds.add(rule?.id);
      check(typeof rule?.text === 'string' && rule.text.trim().length >= 12, `rule ${rule?.id} text missing/short`);
    }
    const expectedHash = calculateRuleSetHash(ruleSet);
    check(ruleSet?.sha256 === expectedHash, `rule set ${ruleSet?.version} sha256 mismatch=${ruleSet?.sha256}; expected=${expectedHash}`);
  }
  const currentRuleSet = getRuleSetForBuild(ledger, ledger?.currentBuild ?? 0);
  check(Boolean(currentRuleSet), `no effective project rule set for current Build ${ledger?.currentBuild}`);
  check(ledger?.projectRules?.currentVersion === currentRuleSet?.version, `projectRules.currentVersion=${ledger?.projectRules?.currentVersion}; expected=${currentRuleSet?.version}`);

  const requiredBuildFields = policy?.requiredBuildFields ?? [];
  const allowedBuildStatuses = new Set(policy?.allowedBuildStatuses ?? []);
  const seenBuilds = new Set();
  for (const entry of ledger?.builds ?? []) {
    for (const field of requiredBuildFields) check(Object.hasOwn(entry, field), `Build ${entry?.build ?? '?'} missing field=${field}`);
    check(Number.isInteger(entry?.build) && entry.build > 0, `invalid build entry=${entry?.build}`);
    check(!seenBuilds.has(entry?.build), `duplicate build=${entry?.build}`);
    seenBuilds.add(entry?.build);
    check(/^\d{2}\.\d{2}\.\d{4}\.\d+$/.test(entry?.version ?? ''), `Build ${entry?.build} invalid version=${entry?.version}`);
    check(entry?.version?.endsWith(`.${entry?.build}`), `Build ${entry?.build} version mismatch=${entry?.version}`);
    check(/^\d{4}-\d{2}-\d{2}$/.test(entry?.date ?? ''), `Build ${entry?.build} invalid date=${entry?.date}`);
    check(allowedBuildStatuses.has(entry?.status), `Build ${entry?.build} invalid status=${entry?.status}`);
    check(typeof entry?.summary === 'string' && entry.summary.trim().length >= 12, `Build ${entry?.build} summary is missing/short`);
    check(Array.isArray(entry?.evidence) && entry.evidence.length > 0, `Build ${entry?.build} evidence is empty`);
    if ((entry?.build ?? 0) >= (policy?.effectiveBuild ?? Number.MAX_SAFE_INTEGER)) {
      const effectiveRules = getRuleSetForBuild(ledger, entry.build);
      check(Boolean(effectiveRules), `Build ${entry?.build} has no effective project rule set`);
      check(entry?.rulesAcknowledgement?.version === effectiveRules?.version, `Build ${entry?.build} rules version=${entry?.rulesAcknowledgement?.version}; expected=${effectiveRules?.version}`);
      check(entry?.rulesAcknowledgement?.sha256 === effectiveRules?.sha256, `Build ${entry?.build} rules sha256=${entry?.rulesAcknowledgement?.sha256}; expected=${effectiveRules?.sha256}`);
      check(typeof entry?.rulesAcknowledgement?.acknowledgedAt === 'string' && entry.rulesAcknowledgement.acknowledgedAt.length > 0, `Build ${entry?.build} rules acknowledgement time missing`);
    }
    if ((entry?.build ?? 0) >= 207 && entry?.status === 'COMPLETED') {
      const assessment = entry?.conversationCapacityAssessment;
      const actualPolicy = (entry?.build ?? 0) >= 225;
      const used = actualPolicy ? assessment?.actualUsedPercent : assessment?.estimatedUsedPercent;
      const remaining = actualPolicy ? assessment?.actualRemainingPercent : assessment?.estimatedRemainingPercent;
      const hardStop = policy?.rules?.conversationCapacityHardStopUsedPercent ?? 90;
      const warning = policy?.rules?.conversationCapacityWarningUsedPercent ?? 85;
      if (actualPolicy) check(['platform_actual', 'platform_actual_unavailable'].includes(assessment?.method), `Build ${entry?.build} conversation capacity method=${assessment?.method}`);
      else check(assessment?.method === 'assistant_estimate', `Build ${entry?.build} conversation capacity method=${assessment?.method}`);
      const unavailable = actualPolicy && assessment?.method === 'platform_actual_unavailable';
      if (!unavailable) {
        check(typeof used === 'number' && Number.isFinite(used) && used >= 0 && used <= 100, `Build ${entry?.build} invalid usedPercent=${used}`);
        check(typeof remaining === 'number' && Number.isFinite(remaining) && remaining >= 0 && remaining <= 100, `Build ${entry?.build} invalid remainingPercent=${remaining}`);
        if (typeof used === 'number' && typeof remaining === 'number') check(Math.abs((used + remaining) - 100) < 0.001, `Build ${entry?.build} context percentages must total 100`);
      }
      const expectedLevel = unavailable ? 'UNMEASURED' : used >= hardStop ? 'HARD_STOP' : used >= warning ? 'WARNING' : 'NORMAL';
      check(assessment?.level === expectedLevel, `Build ${entry?.build} context level=${assessment?.level}; expected=${expectedLevel}`);
      check(typeof assessment?.assessedAt === 'string' && assessment.assessedAt.length > 0, `Build ${entry?.build} context assessment time missing`);
      if (!unavailable && used >= hardStop) {
        check(typeof assessment?.handoffPrompt === 'string' && assessment.handoffPrompt.trim().length >= 200, `Build ${entry?.build} hard-stop handoff prompt missing/short`);
        check(typeof assessment?.handoffFile === 'string' && assessment.handoffFile.trim().length > 0, `Build ${entry?.build} hard-stop handoff file missing`);
      }
    if ((entry?.build ?? 0) >= 208 && entry?.status === 'COMPLETED') {
      const progress = entry?.projectProgressAssessment;
      check(progress?.method === 'weighted_engineering_estimate', `Build ${entry?.build} progress method=${progress?.method}`);
      check(typeof progress?.codingCompletionPercent === 'number' && progress.codingCompletionPercent >= 0 && progress.codingCompletionPercent <= 100, `Build ${entry?.build} invalid coding completion`);
      check(typeof progress?.codingRemainingPercent === 'number' && Math.abs((progress.codingCompletionPercent + progress.codingRemainingPercent) - 100) < 0.001, `Build ${entry?.build} coding percentages must total 100`);
      check(progress?.projectStartDate === '2026-07-20', `Build ${entry?.build} project start date=${progress?.projectStartDate}`);
      check(typeof progress?.elapsedDays === 'number' && progress.elapsedDays >= 1, `Build ${entry?.build} elapsedDays invalid`);
      check(typeof progress?.estimatedBronzeFinalDate === 'string' && progress.estimatedBronzeFinalDate.length > 0, `Build ${entry?.build} Bronze ETA missing`);
      check(typeof progress?.estimatedSilverDate === 'string' && progress.estimatedSilverDate.length > 0, `Build ${entry?.build} Silver ETA missing`);
      check(typeof progress?.estimatedGoldDate === 'string' && progress.estimatedGoldDate.length > 0, `Build ${entry?.build} Gold ETA missing`);
      check(typeof progress?.confidence === 'string' && progress.confidence.length > 0, `Build ${entry?.build} progress confidence missing`);
      check(entry?.documentationClosure?.status === 'PASS', `Build ${entry?.build} documentation closure=${entry?.documentationClosure?.status}`);
      check(typeof entry?.documentationClosure?.masterDocx === 'string' && entry.documentationClosure.masterDocx.length > 0, `Build ${entry?.build} master DOCX missing`);
      check(typeof entry?.documentationClosure?.masterPdf === 'string' && entry.documentationClosure.masterPdf.length > 0, `Build ${entry?.build} master PDF missing`);
      check(entry?.artifactIndex?.status === 'PASS', `Build ${entry?.build} artifact index=${entry?.artifactIndex?.status}`);
      check(typeof entry?.artifactIndex?.markdown === 'string' && typeof entry?.artifactIndex?.json === 'string', `Build ${entry?.build} artifact index paths missing`);
    }
    }
  }
  for (let build = 1; build <= (ledger?.currentBuild ?? 0); build += 1) check(seenBuilds.has(build), `continuous sequence missing Build ${build}`);
  check(seenBuilds.size === ledger?.currentBuild, `build count=${seenBuilds.size}; currentBuild=${ledger?.currentBuild}`);
  const currentEntry = (ledger?.builds ?? []).find((entry) => entry.build === ledger.currentBuild);
  check(Boolean(currentEntry), `current build entry missing=${ledger?.currentBuild}`);
  check(currentEntry?.version === ledger?.currentVersion, `current entry version=${currentEntry?.version}; ledger=${ledger?.currentVersion}`);
  if (options.requireCompleted !== false) check(currentEntry?.status === 'COMPLETED', `current Build ${ledger?.currentBuild} status=${currentEntry?.status}`);

  const allowedWorkStatuses = new Set(policy?.allowedWorkStatuses ?? []);
  const workIds = new Set();
  const openWork = [];
  for (const item of ledger?.remainingWork ?? []) {
    check(typeof item?.id === 'string' && item.id.length > 0, 'remaining work id missing');
    check(!workIds.has(item?.id), `duplicate remaining work id=${item?.id}`);
    workIds.add(item?.id);
    check(Number.isInteger(item?.order) && item.order > 0, `remaining work ${item?.id} invalid order=${item?.order}`);
    check(allowedWorkStatuses.has(item?.status), `remaining work ${item?.id} invalid status=${item?.status}`);
    check(typeof item?.title === 'string' && item.title.trim().length > 0, `remaining work ${item?.id} title missing`);
    check(typeof item?.details === 'string' && item.details.trim().length > 0, `remaining work ${item?.id} details missing`);
    if (item?.status === 'OPEN' || item?.status === 'IN_PROGRESS') openWork.push(item);
  }
  const orders = (ledger?.remainingWork ?? []).map((item) => item.order).sort((a, b) => a - b);
  check(new Set(orders).size === orders.length, 'remaining work order values must be unique');
  check(openWork.length > 0, 'at least one open/in-progress remaining work item is required');
  const firstOpen = [...openWork].sort((a, b) => a.order - b.order)[0];
  check(Boolean(firstOpen), 'explicit next action missing');
  check(ledger?.lastStatusNotification?.build === ledger?.currentBuild, `status notification build=${ledger?.lastStatusNotification?.build}`);
  check(ledger?.lastStatusNotification?.status === currentEntry?.status, `status notification status=${ledger?.lastStatusNotification?.status}`);
  check(typeof ledger?.lastStatusNotification?.message === 'string' && ledger.lastStatusNotification.message.trim().length >= 12, 'status notification message missing/short');

  return { failures, currentEntry, firstOpen };
};

export const renderLedgerMarkdown = (ledger) => {
  const completed = ledger.builds.filter((entry) => entry.status === 'COMPLETED').length;
  const open = ledger.remainingWork.filter((item) => item.status === 'OPEN' || item.status === 'IN_PROGRESS').length;
  const lines = [
    '# Ana Build Defteri ve Kalan İşler',
    '',
    '> **Tek yetkili devam noktası:** Yeni bir sohbet veya geliştirme oturumu bu dosyayı okuyarak başlar. Geçmiş buildleri yeniden araştırmak yerine `Güncel devam noktası` ve `Kalan işler` bölümleri esas alınır.',
    '',
    `- Ürün: **${ledger.product}**`,
    `- Güncel build: **${ledger.currentBuild}**`,
    `- Güncel sürüm: **${ledger.currentVersion}**`,
    `- Aşama: **${ledger.currentStage}**`,
    `- Tamamlanmış build kaydı: **${completed}/${ledger.builds.length}**`,
    `- Açık/in-progress iş: **${open}**`,
    `- Son güncelleme: **${ledger.lastUpdatedAt}**`,
    '',
    '## BAĞLAYICI PROJE KURAL SETİ — HER SOHBET VE HER BUILD ÖNCESİ ZORUNLU OKUMA',
    '',
    `> **Zorunlu başlangıç sözleşmesi:** ${ledger.projectRules.startupRequirement}`,
    '',
    `- Güncel kural sürümü: **${getRuleSetForBuild(ledger, ledger.currentBuild)?.version ?? 'YOK'}**`,
    `- Kural SHA-256: **${getRuleSetForBuild(ledger, ledger.currentBuild)?.sha256 ?? 'YOK'}**`,
    `- Yürürlük başlangıcı: **Build ${getRuleSetForBuild(ledger, ledger.currentBuild)?.effectiveBuild ?? 'YOK'}**`,
    '- Kural değişikliği: Yeni build + açık kullanıcı kararı + yeni kural sürümü/hash olmadan yapılamaz.',
    '',
    '### Kesin kurallar',
    '',
    ...(getRuleSetForBuild(ledger, ledger.currentBuild)?.rules ?? []).map((rule) => `${rule.id}. ${rule.text}`),
    '',
    '## Kesin süreklilik kuralı',
    '',
    '1. Her yeni build başlatıldığında bu deftere yeni build satırı açılır ve durum `IN_PROGRESS` yapılır.',
    '2. Build tamamlanmadan önce yapılan iş, sürüm, kanıt dosyaları ve kalan iş durumu bu deftere yazılır.',
    '3. Build sonrası kullanıcıya durum bilgilendirmesi yapılır; aynı bildirim `lastStatusNotification` alanına kaydedilir.',
    '4. Güncel build `COMPLETED` değilse, ana defter güncel değilse veya durum bildirimi yoksa kaynak teslimi tamamlanmış sayılamaz.',
    '5. Geçmiş build kayıtları değiştirilmez; düzeltme gerekiyorsa yeni build kaydıyla açıklanır.',
    '',
    '## Güncel devam noktası',
    '',
  ];
  const next = [...ledger.remainingWork].filter((item) => item.status === 'OPEN' || item.status === 'IN_PROGRESS').sort((a, b) => a.order - b.order)[0];
  if (next) {
    lines.push(`- **Sıradaki iş:** ${next.id} — ${next.title}`);
    lines.push(`- **Kanal:** ${next.channel}`);
    if (next.plannedBuild) lines.push(`- **Planlanan build:** ${next.plannedBuild}`);
    lines.push(`- **Açıklama:** ${next.details}`);
  } else {
    lines.push('- Açık iş bulunmuyor. Kanal geçişi ayrıca ürün sahibi kararı gerektirir.');
  }
  lines.push('', '## Kalan işler — tek liste', '');
  for (const item of [...ledger.remainingWork].sort((a, b) => a.order - b.order)) {
    const mark = item.status === 'COMPLETED' ? 'x' : ' ';
    const planned = item.plannedBuild ? ` · Planlanan Build ${item.plannedBuild}` : '';
    lines.push(`- [${mark}] **${item.id} — ${escapeCell(item.title)}** · ${escapeCell(item.channel)}${planned} · Durum: \`${item.status}\``);
    lines.push(`  - ${escapeCell(item.details)}`);
  }
  const currentCapacity = ledger.builds.find((entry) => entry.build === ledger.currentBuild)?.conversationCapacityAssessment;
  lines.push('', '## Sohbet bağlam kapasitesi', '');
  if (currentCapacity) {
    if (currentCapacity.method === 'platform_actual') {
      lines.push(`- Gerçek kullanılan alan: **%${currentCapacity.actualUsedPercent}**`);
      lines.push(`- Gerçek kalan alan: **%${currentCapacity.actualRemainingPercent}**`);
      lines.push('- Ölçüm niteliği: **platform_actual**');
    } else if (currentCapacity.method === 'platform_actual_unavailable') {
      lines.push('- Gerçek platform bağlam yüzdesi: **UNAVAILABLE**');
      lines.push('- Ölçüm niteliği: **platform_actual_unavailable — tahmin HARD_STOP üretmez**');
    } else {
      lines.push(`- Tahmini kullanılan alan: **%${currentCapacity.estimatedUsedPercent}**`);
      lines.push(`- Tahmini kalan alan: **%${currentCapacity.estimatedRemainingPercent}**`);
      lines.push('- Ölçüm niteliği: **assistant_estimate — platformun kesin bağlam sayacı değildir**');
    }
    lines.push(`- Seviye: **${currentCapacity.level}**`);
    if (currentCapacity.handoffFile) lines.push(`- Yeni sohbet devir promptu: \`${currentCapacity.handoffFile}\``);
  } else {
    lines.push('- Güncel build henüz tamamlanmadığı için build-sonu bağlam tahmini bekleniyor.');
  }
  const currentProgress = ledger.builds.find((entry) => entry.build === ledger.currentBuild)?.projectProgressAssessment;
  lines.push('', '## Proje ilerleme tahmini', '');
  if (currentProgress) {
    lines.push(`- Tahmini kodlama tamamlanma: **%${currentProgress.codingCompletionPercent}**`);
    lines.push(`- Tahmini kalan kodlama: **%${currentProgress.codingRemainingPercent}**`);
    lines.push(`- Proje başlangıcı: **${currentProgress.projectStartDate}**`);
    lines.push(`- Geçen süre: **${currentProgress.elapsedDays} gün**`);
    lines.push(`- Tarihsel build hızı: **${currentProgress.historicalBuildsPerElapsedDay} build/gün**`);
    lines.push(`- Tahmini Bronze Final: **${currentProgress.estimatedBronzeFinalDate}**`);
    lines.push(`- Tahmini Silver: **${currentProgress.estimatedSilverDate}**`);
    lines.push(`- Tahmini Gold/genel bitiş: **${currentProgress.estimatedGoldDate}**`);
    lines.push(`- Tahmin güveni: **${currentProgress.confidence}**`);
  } else lines.push('- Güncel build tamamlanmadığı için ilerleme tahmini bekleniyor.');
  lines.push('', '## 20 Temmuz 2026’dan bugüne build geçmişi', '');
  let currentDate = null;
  for (const entry of [...ledger.builds].sort((a, b) => a.build - b.build)) {
    if (entry.date !== currentDate) {
      currentDate = entry.date;
      lines.push(`### ${currentDate}`, '');
    }
    const mark = entry.status === 'COMPLETED' ? 'x' : ' ';
    lines.push(`- [${mark}] **Build ${entry.build} — ${entry.version}** · ${escapeCell(entry.stage)} · Durum: \`${entry.status}\``);
    lines.push(`  - Yapılan: ${escapeCell(entry.summary)}`);
    lines.push(`  - Kanıt: ${entry.evidence.map((value) => `\`${escapeCell(value)}\``).join(', ')}`);
  }
  lines.push('', '## Son build durum bildirimi', '');
  lines.push(`- Build: **${ledger.lastStatusNotification.build}**`);
  lines.push(`- Durum: **${ledger.lastStatusNotification.status}**`);
  lines.push(`- Kayıt zamanı: **${ledger.lastStatusNotification.recordedAt}**`);
  lines.push(`- Bildirim: ${ledger.lastStatusNotification.message}`);
  lines.push('', '---', '', 'Bu dosya `config/master-build-ledger.json` kaynağından üretilir. Elle yapılan ve JSON kaynağıyla eşleşmeyen değişiklikler doğrulama kapısında reddedilir.');
  return lines.join('\n');
};

export const writeLedgerDocument = async (ledger) => writeFile(DOCUMENT_PATH, `${renderLedgerMarkdown(ledger)}\n`);
