import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sha256Pattern = /^[a-f0-9]{64}$/u;
const safeTokenPattern = /^[a-z0-9][a-z0-9-]{0,79}$/u;
const sha256Bytes = (value) => createHash('sha256').update(value).digest('hex');
const normalize = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
const check = (condition, message) => { if (!condition) throw new Error(message); };

export const INSTALLED_UI_NATIVE_DIALOG_SPECIFICATIONS = Object.freeze([
  Object.freeze({ specId: 'archive-add-file', routeId: 'archive', labelPattern: /^(?:\+\s*)?(?:Dosya ekle|Add file)$/iu, dialogKind: 'OPEN', selectionKind: 'GENERIC_DOCUMENT', extension: '.txt' }),
  Object.freeze({ specId: 'archive-new-version-file', routeId: 'archive', labelPattern: /^(?:Yeni sürüm dosyası seç|Choose new version file)$/iu, dialogKind: 'OPEN', selectionKind: 'GENERIC_DOCUMENT', extension: '.txt' }),
  Object.freeze({ specId: 'finance-import', routeId: 'finance', labelPattern: /^(?:Dosya seç ve önizle|Select file and preview)$/iu, dialogKind: 'OPEN', selectionKind: 'FINANCE_IMPORT', extension: '.csv' }),
  Object.freeze({ specId: 'reports-pdf', routeId: 'reports', labelPattern: /^(?:PDF raporu oluştur|Create PDF report)$/iu, dialogKind: 'SAVE', selectionKind: 'GENERATED_OUTPUT', extension: '.pptreport' }),
  Object.freeze({ specId: 'security-password-backup', routeId: 'security', labelPattern: /^(?:Parola korumalı tam yedek|Password-protected full backup)$/iu, dialogKind: 'SAVE', selectionKind: 'GENERATED_BACKUP', extension: '.pptbackup' }),
  Object.freeze({ specId: 'security-device-backup', routeId: 'security', labelPattern: /^(?:Cihaz korumalı tam yedek|Device-protected full backup)$/iu, dialogKind: 'SAVE', selectionKind: 'GENERATED_BACKUP', extension: '.pptbackup' }),
  Object.freeze({ specId: 'security-inspect-backup', routeId: 'security', labelPattern: /^(?:Yedeği incele|Inspect backup)$/iu, dialogKind: 'OPEN', selectionKind: 'GENERATED_BACKUP', extension: '.pptbackup' }),
  Object.freeze({ specId: 'security-restore-backup', routeId: 'security', labelPattern: /^(?:Geri yükle|Restore)$/iu, dialogKind: 'OPEN', selectionKind: 'GENERATED_BACKUP', extension: '.pptbackup', terminalHybrid: true }),
  Object.freeze({ specId: 'security-family-import', routeId: 'security', labelPattern: /^(?:Yedek dosyası seç ve ön izle|Choose a backup and preview)$/iu, dialogKind: 'OPEN', selectionKind: 'FAMILY_IMPORT', extension: '.json' }),
  Object.freeze({ specId: 'security-local-encrypted-export', routeId: 'security', labelPattern: /^(?:Yerel şifreli dosya oluştur|Create local encrypted file)$/iu, dialogKind: 'SAVE', selectionKind: 'GENERATED_OUTPUT', extension: '.pptprivacy' }),
  Object.freeze({ specId: 'life-center-plain-pdf', routeId: 'life-center', labelPattern: /^(?:Düz PDF|Plain PDF)$/iu, dialogKind: 'SAVE', selectionKind: 'GENERATED_OUTPUT', extension: '.pdf' }),
  Object.freeze({ specId: 'life-center-encrypted-package', routeId: 'life-center', labelPattern: /^(?:Şifreli belge paketi|Encrypted document package)$/iu, dialogKind: 'SAVE', selectionKind: 'GENERATED_OUTPUT', extension: '.pptemergency' }),
  Object.freeze({ specId: 'settings-local-encrypt-file', routeId: 'settings', labelPattern: /^(?:Dosya seç ve yerel olarak şifrele|Select and encrypt locally)$/iu, dialogKind: 'OPEN', selectionKind: 'GENERIC_DOCUMENT', extension: '.txt' }),
  Object.freeze({ specId: 'settings-json-report', routeId: 'settings', labelPattern: /^(?:JSON raporu dışa aktar|Export JSON report|Yeni rapor|New report)$/iu, dialogKind: 'SAVE', selectionKind: 'GENERATED_OUTPUT', extension: '.pptdiag' }),
  Object.freeze({ specId: 'settings-archive-old', routeId: 'settings', labelPattern: /^(?:30 günden eskiyi arşivle|Archive items older than 30 days)$/iu, dialogKind: 'SAVE', selectionKind: 'GENERATED_OUTPUT', extension: '.pptdiag' }),
  Object.freeze({ specId: 'settings-data-export', routeId: 'settings', labelPattern: /^(?:JSON|CSV)$/iu, dialogKind: 'SAVE', selectionKind: 'GENERATED_OUTPUT', extension: '.pptdiag' }),
  Object.freeze({ specId: 'settings-diagnostics-export', routeId: 'settings', labelPattern: /^(?:Tanı paketini dışa aktar|Export diagnostic package)$/iu, dialogKind: 'SAVE', selectionKind: 'GENERATED_OUTPUT', extension: '.pptdiag' }),
]);

export const INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY = Object.freeze(INSTALLED_UI_NATIVE_DIALOG_SPECIFICATIONS.map((specification) => Object.freeze({
  specId: specification.specId,
  routeId: specification.routeId,
  labelPatternSource: specification.labelPattern.source,
  labelPatternFlags: specification.labelPattern.flags,
  labelClass: `${specification.routeId}:${specification.dialogKind}:${specification.selectionKind}`,
  dialogKind: specification.dialogKind,
  selectionKind: specification.selectionKind,
  extension: specification.extension,
  terminalHybrid: specification.terminalHybrid === true,
})));
export const INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY_SHA256 = sha256Bytes(Buffer.from(JSON.stringify(INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY)));

export const resolveInstalledUiNativeDialogSpecification = (control) => {
  const routeId = normalize(control?.routeId);
  const label = normalize(control?.label).replace(/^\+\s*/u, '');
  const matches = INSTALLED_UI_NATIVE_DIALOG_SPECIFICATIONS.filter((candidate) => candidate.routeId === routeId && candidate.labelPattern.test(label));
  check(matches.length <= 1, `Native dialog kontrolü birden çok sözleşmeyle eşleşti: ${routeId} / ${label}`);
  if (matches.length === 0) return undefined;
  const specification = matches[0];
  return Object.freeze({
    specId: specification.specId,
    routeId,
    labelClass: `${routeId}:${specification.dialogKind}:${specification.selectionKind}`,
    dialogKind: specification.dialogKind,
    selectionKind: specification.selectionKind,
    extension: specification.extension,
    terminalHybrid: specification.terminalHybrid === true,
  });
};

export const createInstalledUiNativeDialogFixtures = async (profilePath) => {
  check(isAbsolute(profilePath), 'Native dialog fixture kökü mutlak olmalıdır.');
  const root = resolve(profilePath, 'native-dialog-fixtures');
  await mkdir(root, { recursive: false });
  const definitions = Object.freeze({
    GENERIC_DOCUMENT: Object.freeze({ name: 'synthetic-document.txt', bytes: Buffer.from('ParsYuva synthetic installed UI fixture\n', 'utf8') }),
    FINANCE_IMPORT: Object.freeze({ name: 'synthetic-finance.csv', bytes: Buffer.from('date,description,amount,currency\n2026-08-24,Synthetic UAT,1.00,TRY\n', 'utf8') }),
    FAMILY_IMPORT: Object.freeze({ name: 'synthetic-family-import.json', bytes: Buffer.from('{"schemaVersion":0,"synthetic":true,"records":[]}\n', 'utf8') }),
    GENERATED_BACKUP: Object.freeze({ name: 'synthetic-invalid-backup.pptbackup', bytes: Buffer.from('PARSYUVA_SYNTHETIC_INVALID_BACKUP\n', 'utf8') }),
  });
  const fixtures = {};
  for (const [kind, definition] of Object.entries(definitions)) {
    const path = resolve(root, definition.name);
    await writeFile(path, definition.bytes, { flag: 'wx' });
    fixtures[kind] = Object.freeze({
      kind,
      path,
      fileName: definition.name,
      extension: extname(definition.name).toLowerCase(),
      sizeBytes: definition.bytes.length,
      sha256: sha256Bytes(definition.bytes),
      synthetic: true,
      pathRecorded: false,
      withinDisposableProfile: true,
    });
  }
  return Object.freeze({ root, fixtures: Object.freeze(fixtures) });
};

export const createInstalledUiNativeDialogSelection = async ({ specification, fixtureSet, outputToken, generatedBackups = [] }) => {
  check(specification && fixtureSet?.root && safeTokenPattern.test(outputToken), 'Native dialog seçim planı geçersizdir.');
  if (specification.dialogKind === 'SAVE') {
    const fileName = `${outputToken}${specification.extension}`;
    return Object.freeze({
      kind: specification.selectionKind,
      path: resolve(fixtureSet.root, fileName),
      fileName,
      extension: specification.extension,
      synthetic: true,
      pathRecorded: false,
      withinDisposableProfile: true,
      expectedPreexisting: false,
    });
  }
  const backup = specification.selectionKind === 'GENERATED_BACKUP' ? generatedBackups.at(-1) : undefined;
  const fixture = backup ?? fixtureSet.fixtures[specification.selectionKind] ?? fixtureSet.fixtures.GENERIC_DOCUMENT;
  check(fixture && await access(fixture.path).then(() => true).catch(() => false), `Native dialog sentetik seçimi bulunamadı: ${specification.selectionKind}`);
  return Object.freeze({ ...fixture, expectedPreexisting: true });
};

export const readInstalledUiNativeDialogSelection = async (selection, { requirePresent }) => {
  const exists = await access(selection.path).then(() => true).catch(() => false);
  check(requirePresent ? exists : !exists, requirePresent ? 'Native dialog seçilen/üretilen dosyası yok.' : 'İptal edilen native dialog beklenmedik dosya üretti.');
  if (!exists) return Object.freeze({ exists: false, pathRecorded: false });
  const item = await lstat(selection.path);
  check(item.isFile() && !item.isSymbolicLink(), 'Native dialog seçilen/üretilen hedef düzenli dosya değildir.');
  check(resolve(await realpath(selection.path)) === resolve(selection.path), 'Native dialog seçilen/üretilen hedef realpath değiştiriyor.');
  const bytes = await readFile(selection.path);
  check(bytes.length > 0, 'Native dialog seçilen/üretilen dosya boştur.');
  return Object.freeze({
    exists: true,
    fileName: basename(selection.path),
    extension: extname(selection.path).toLowerCase(),
    sizeBytes: bytes.length,
    sha256: sha256Bytes(bytes),
    pathRecorded: false,
    synthetic: true,
    withinDisposableProfile: true,
  });
};

const automationScript = fileURLToPath(new URL('./windows-native-file-dialog-uat.ps1', import.meta.url));

export const beginWindowsNativeFileDialogAutomation = ({ decision, ownedProcessIdentities, selectionPath, screenshotPath }) => {
  check(process.platform === 'win32', 'Native dosya diyaloğu UAT yalnız Windows üzerinde çalışır.');
  check(['CANCEL', 'ACCEPT'].includes(decision), 'Native dialog kararı geçersizdir.');
  check(Array.isArray(ownedProcessIdentities) && ownedProcessIdentities.length > 0, 'Native dialog sahipli süreç kimliği yoktur.');
  for (const identity of ownedProcessIdentities) {
    check(Number.isInteger(identity.processId) && identity.processId > 0 && normalize(identity.creationTimeUtc), 'Native dialog süreç kimliği eksiktir.');
  }
  check(isAbsolute(selectionPath) && isAbsolute(screenshotPath), 'Native dialog seçim ve screenshot yolları mutlak olmalıdır.');
  const encodedIdentities = Buffer.from(JSON.stringify(ownedProcessIdentities.map(({ processId, creationTimeUtc }) => ({ processId, creationTimeUtc }))), 'utf8').toString('base64');
  const child = spawn('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', automationScript,
    '-Decision', decision,
    '-OwnedProcessIdentitiesBase64', encodedIdentities,
    '-SelectionPath', selectionPath,
    '-ScreenshotPath', screenshotPath,
  ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let outputText = '';
  let readySettled = false;
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolvePromise, rejectPromise) => { resolveReady = resolvePromise; rejectReady = rejectPromise; });
  const completion = new Promise((resolveCompletion, rejectCompletion) => {
    const stderr = [];
    child.stdout.on('data', (chunk) => {
      outputText += Buffer.from(chunk).toString('utf8');
      if (!readySettled && outputText.split(/\r?\n/u).includes('READY')) {
        readySettled = true;
        resolveReady(undefined);
      }
    });
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.once('error', (error) => { if (!readySettled) rejectReady(error); rejectCompletion(error); });
    child.once('close', (code) => {
      if (!readySettled) rejectReady(new Error(`Windows native dialog helper READY üretmeden kapandı: ${code}`));
      const output = outputText.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line && line !== 'READY').at(-1) ?? '';
      const failure = Buffer.concat(stderr).toString('utf8').trim();
      if (code !== 0) return rejectCompletion(new Error(`Windows native dialog ${decision} başarısız: ${failure || output || `exit ${code}`}`));
      try {
        const parsed = JSON.parse(output);
        check(parsed.status === 'PASS' && parsed.decision === decision && parsed.targetClosed === true, 'Windows native dialog helper PASS/close üretmedi.');
        check(parsed.targetWindow?.className === '#32770' && Number.isInteger(parsed.targetWindow.processId), 'Windows native dialog hedef kimliği geçersizdir.');
        check(sha256Pattern.test(parsed.targetWindow.titleSha256) && sha256Pattern.test(parsed.targetWindow.automationIdSha256), 'Windows native dialog pencere hashleri geçersizdir.');
        resolveCompletion(Object.freeze(parsed));
      } catch (error) { rejectCompletion(error); }
    });
  });
  let started = false;
  return Object.freeze({
    child,
    ready,
    start() {
      check(!started, 'Windows native dialog helper GO sinyali tekrarlandı.');
      check(readySettled, 'Windows native dialog helper READY olmadan başlatıldı.');
      started = true;
      child.stdin.end('GO\n');
    },
    completion,
  });
};
