import { mkdir, stat, writeFile } from 'node:fs/promises';
import { LEDGER_PATH, POLICY_PATH, getRuleSetForBuild, readJson, validateLedger, writeJson, writeLedgerDocument } from './lib/master-build-ledger.mjs';

const args = process.argv.slice(2);
const command = args.shift();
const option = (name, required = false) => {
  const index = args.indexOf(name);
  if (index < 0) {
    if (required) throw new Error(`${name} is required.`);
    return undefined;
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const build = Number(option('--build', true));
if (!Number.isInteger(build) || build < 1) throw new Error('--build must be a positive integer.');

const percentOption = (name, required = false) => {
  const raw = option(name, required);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`${name} must be a number from 0 to 100.`);
  return Math.round(value * 10) / 10;
};
const fileExists = async (path) => { try { await stat(path); return true; } catch { return false; } };
const buildHandoffPrompt = (ledger, entry, ruleSet) => {
  const next = [...ledger.remainingWork].filter((item) => item.status === 'OPEN' || item.status === 'IN_PROGRESS').sort((a, b) => a.order - b.order)[0];
  const remaining = [...ledger.remainingWork].filter((item) => item.status === 'OPEN' || item.status === 'IN_PROGRESS').sort((a, b) => a.order - b.order);
  return [
    'Anadolu Parsı Aile Yaşam Merkezi projesine önceki sohbetten devam ediyorum.',
    '',
    `Önce en güncel Ana Build Defteri olan ${ledger.authoritativeDocument} dosyasını ve en son Build ${entry.build} kaynak paketini bulup oku.`,
    `Son tamamlanan build: ${entry.build} / ${entry.version} / ${entry.stage}.`,
    `Bağlayıcı kural seti: ${ruleSet.version}; SHA-256: ${ruleSet.sha256}. Kuralları yeniden benden isteme; Ana Build Defteri içinden oku ve kabul et.`,
    `Sıradaki iş: ${next ? `${next.id} — ${next.title}${next.plannedBuild ? ` (planlanan Build ${next.plannedBuild})` : ''}` : 'Açık iş yok; kanal geçişi için kullanıcı kararı bekle'}.`,
    '',
    'Açık işler:',
    ...remaining.map((item) => `- ${item.id}: ${item.title} [${item.status}]${item.plannedBuild ? ` — Build ${item.plannedBuild}` : ''}`),
    '',
    'Kesin başlangıç sırası: Ana Build Defteri → güncel Proje Anayasası/hash → son build durumu → kalan işler → sıradaki iş. 20.07.2026 öncesi sohbet, belge veya projeyi kullanma ya da proje geçmişi olarak anma; Ana Build Defteri tek yetkili devam kaynağıdır. Yeni build başlatmadan önce önceki buildin sohbet bağlam kapasitesi kaydını kontrol et ve %90+ ise yeni build başlatma.'
  ].join('\n');
};

const ledger = await readJson(LEDGER_PATH);
const policy = await readJson(POLICY_PATH);
let entry = ledger.builds.find((item) => item.build === build);

if (command === 'start') {
  const previous = ledger.builds.find((item) => item.build === ledger.currentBuild);
  if (build !== ledger.currentBuild + 1 && !entry) throw new Error(`New build must be exactly ${ledger.currentBuild + 1}; requested=${build}.`);
  if (!entry && previous?.status !== 'COMPLETED') throw new Error(`Previous current Build ${ledger.currentBuild} must be COMPLETED before Build ${build} can start.`);
  if (!entry && previous?.build >= 207) {
    const assessment = previous?.conversationCapacityAssessment;
    const hardStop = policy?.rules?.conversationCapacityHardStopUsedPercent ?? 90;
    const warning = policy?.rules?.conversationCapacityWarningUsedPercent ?? 85;
    if (!assessment) throw new Error(`Build ${build} blocked: previous Build ${previous.build} has no conversation-capacity assessment.`);
    if (assessment.method === 'platform_actual' && assessment.actualUsedPercent >= hardStop) {
      const expectedHandoff = `NEW_CHAT_HANDOFF_BUILD${previous.build}`;
      if (option('--new-chat-handoff') !== expectedHandoff) {
        throw new Error(`Build ${build} blocked by actual conversation hard stop: previous Build ${previous.build} actual context use is ${assessment.actualUsedPercent}% (>=${hardStop}%). Start a new chat and pass --new-chat-handoff ${expectedHandoff}.`);
      }
    }
    if (assessment.method === 'platform_actual' && assessment.actualUsedPercent >= warning && assessment.actualUsedPercent < hardStop) {
      console.warn(`WARNING: previous Build ${previous.build} actual context use is ${assessment.actualUsedPercent}%. Handoff threshold=${hardStop}%.`);
    }
  }

  const ruleSet = getRuleSetForBuild(ledger, build);
  if (!ruleSet) throw new Error(`No effective project rule set exists for Build ${build}. Read ${ledger.authoritativeDocument} and define a rule set first.`);
  const rulesAck = option('--rules-ack', true);
  if (rulesAck !== ruleSet.sha256) {
    throw new Error(`Project rules acknowledgement mismatch. Read ${ledger.authoritativeDocument} first, then pass --rules-ack ${ruleSet.sha256}`);
  }

  if (!entry) {
    const version = option('--version', true);
    const date = option('--date', true);
    const channel = option('--channel') ?? 'Bronze';
    const stage = option('--stage') ?? ledger.currentStage;
    const summary = option('--summary', true);
    entry = {
      build,
      version,
      date,
      channel,
      stage,
      status: 'IN_PROGRESS',
      summary,
      evidence: ['docs/17_MASTER_BUILD_LEDGER.md'],
      rulesAcknowledgement: {
        version: ruleSet.version,
        sha256: ruleSet.sha256,
        acknowledgedAt: new Date().toISOString()
      }
    };
    ledger.builds.push(entry);
  } else {
    if (entry.status === 'COMPLETED') throw new Error(`Build ${build} is already completed.`);
    entry.status = 'IN_PROGRESS';
    const summary = option('--summary');
    if (summary) entry.summary = summary;
    entry.rulesAcknowledgement = {
      version: ruleSet.version,
      sha256: ruleSet.sha256,
      acknowledgedAt: new Date().toISOString()
    };
  }
  ledger.currentBuild = build;
  ledger.currentVersion = entry.version;
  ledger.currentStage = entry.stage;
  ledger.lastUpdatedAt = new Date().toISOString();
  ledger.lastStatusNotification = {
    build,
    status: 'IN_PROGRESS',
    message: `Build ${build} başlatıldı; Ana Build Defteri ve ${ruleSet.version} kuralları ${ruleSet.sha256} özetiyle okunup kabul edildi.`,
    recordedAt: new Date().toISOString()
  };
} else {
  if (!entry) throw new Error(`Build ${build} is not present in the master ledger.`);

  if (command === 'complete') {
    const summary = option('--summary', true);
    const statusMessage = option('--status-message', true);
    const evidenceText = option('--evidence');
    const ruleSet = getRuleSetForBuild(ledger, build);
    if ((build >= (policy.effectiveBuild ?? Number.MAX_SAFE_INTEGER)) && (
      entry?.rulesAcknowledgement?.version !== ruleSet?.version ||
      entry?.rulesAcknowledgement?.sha256 !== ruleSet?.sha256
    )) {
      throw new Error(`Build ${build} cannot complete without current project-rule acknowledgement. Start/restart with --rules-ack ${ruleSet?.sha256}.`);
    }
    const contextSource = build >= 225 ? option('--context-source', true) : 'assistant_estimate';
    if (!['platform_actual', 'platform_actual_unavailable', 'assistant_estimate'].includes(contextSource)) {
      throw new Error('--context-source must be platform_actual or platform_actual_unavailable.');
    }
    if (build >= 225 && contextSource === 'assistant_estimate') {
      throw new Error('Build225+ cannot classify an assistant estimate as actual conversation capacity.');
    }
    const contextUsed = contextSource === 'platform_actual_unavailable'
      ? undefined
      : percentOption('--context-used-percent', true);
    const contextRemaining = contextUsed === undefined ? undefined : Math.round((100 - contextUsed) * 10) / 10;
    const hardStop = policy?.rules?.conversationCapacityHardStopUsedPercent ?? 90;
    const warning = policy?.rules?.conversationCapacityWarningUsedPercent ?? 85;
    const level = contextUsed === undefined ? 'UNMEASURED' : contextUsed >= hardStop ? 'HARD_STOP' : contextUsed >= warning ? 'WARNING' : 'NORMAL';
    entry.status = 'COMPLETED';
    entry.summary = summary;
    entry.conversationCapacityAssessment = contextSource === 'platform_actual'
      ? {
          method: 'platform_actual',
          actualUsedPercent: contextUsed,
          actualRemainingPercent: contextRemaining,
          level,
          assessedAt: new Date().toISOString(),
          note: 'Platform tarafından sağlanan gerçek sohbet bağlam kapasitesi ölçümüdür.'
        }
      : contextSource === 'platform_actual_unavailable'
        ? {
            method: 'platform_actual_unavailable',
            level: 'UNMEASURED',
            assessedAt: new Date().toISOString(),
            note: 'Platform gerçek bağlam yüzdesi sağlamadı; tahmin HARD_STOP veya zorunlu handoff üretmez.'
          }
        : {
            method: 'assistant_estimate',
            estimatedUsedPercent: contextUsed,
            estimatedRemainingPercent: contextRemaining,
            level,
            assessedAt: new Date().toISOString(),
            note: 'Tahmini değerdir; platform tarafından sağlanan kesin bağlam/token sayacı değildir.'
          };
    if (build >= 208) {
      const codingComplete = percentOption('--coding-complete-percent', true);
      const startDate = '2026-07-20';
      const elapsedDays = Math.max(1, Math.floor((Date.parse(`${entry.date}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000));
      const confidence = option('--progress-confidence', true);
      const bronzeFinal = option('--bronze-final-date', true);
      const silverDate = option('--silver-date', true);
      const goldDate = option('--gold-date', true);
      entry.projectProgressAssessment = {
        method: 'weighted_engineering_estimate',
        codingCompletionPercent: codingComplete,
        codingRemainingPercent: Math.round((100 - codingComplete) * 10) / 10,
        projectStartDate: startDate,
        elapsedDays,
        historicalBuildsPerElapsedDay: Math.round((build / elapsedDays) * 100) / 100,
        estimatedBronzeFinalDate: bronzeFinal,
        estimatedSilverDate: silverDate,
        estimatedGoldDate: goldDate,
        confidence,
        assessedAt: new Date().toISOString(),
        note: 'Tahmini yönetim metriğidir; yalnız build sayısına dayanmaz, ağırlıklı açık kod işleri ve geçmiş geliştirme hızını kullanır.'
      };
      const docx = `docs/current/MASTER_PROJECT_DOCUMENTATION_BUILD${build}.docx`;
      const pdf = `docs/current/MASTER_PROJECT_DOCUMENTATION_BUILD${build}.pdf`;
      const artifactMd = 'PROJECT_ARTIFACT_INDEX.md';
      const artifactJson = 'PROJECT_ARTIFACT_INDEX.json';
      for (const required of [docx, pdf, artifactMd, artifactJson]) if (!await fileExists(required)) throw new Error(`Build ${build} documentation closure blocked: required file missing=${required}`);
      entry.documentationClosure = { status: 'PASS', masterDocx: docx, masterPdf: pdf, recordedAt: new Date().toISOString() };
      entry.artifactIndex = { status: 'PASS', markdown: artifactMd, json: artifactJson, recordedAt: new Date().toISOString() };
    }
    if (level === 'HARD_STOP') {
      const handoffFile = `handoff/NEW_CHAT_HANDOFF_BUILD${build}.md`;
      const prompt = buildHandoffPrompt(ledger, entry, ruleSet);
      entry.conversationCapacityAssessment.handoffPrompt = prompt;
      entry.conversationCapacityAssessment.handoffFile = handoffFile;
      await mkdir('handoff', { recursive: true });
      await writeFile(handoffFile, `# Yeni Sohbet Devir Promptu — Build ${build}\n\n\`\`\`text\n${prompt}\n\`\`\`\n`);
      console.log(`\n${prompt}\n`);
    }
    if (evidenceText) entry.evidence = evidenceText.split(',').map((value) => value.trim()).filter(Boolean);
    ledger.currentBuild = build;
    ledger.currentVersion = entry.version;
    ledger.currentStage = entry.stage;
    ledger.lastUpdatedAt = new Date().toISOString();
    ledger.lastStatusNotification = {
      build,
      status: 'COMPLETED',
      message: statusMessage,
      recordedAt: new Date().toISOString()
    };
  } else if (command === 'work-status') {
    const id = option('--id', true);
    const status = option('--status', true);
    const item = ledger.remainingWork.find((value) => value.id === id);
    if (!item) throw new Error(`Remaining work item not found: ${id}`);
    if (!(policy.allowedWorkStatuses ?? []).includes(status)) throw new Error(`Invalid work status: ${status}`);
    item.status = status;
    ledger.lastUpdatedAt = new Date().toISOString();
  } else {
    throw new Error('Command must be start, complete or work-status.');
  }
}

const { failures } = validateLedger(ledger, policy, { requireCompleted: command === 'complete' });
if (failures.length > 0) throw new Error(`Ledger update invalid:\n- ${failures.join('\n- ')}`);
await writeJson(LEDGER_PATH, ledger);
await writeLedgerDocument(ledger);
console.log(`Master build ledger updated: command=${command} build=${build}.`);
