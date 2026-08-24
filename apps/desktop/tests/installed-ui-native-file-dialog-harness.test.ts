import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY,
  INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY_SHA256,
  INSTALLED_UI_NATIVE_DIALOG_SPECIFICATIONS,
  resolveInstalledUiNativeDialogSpecification,
} from '../../../scripts/lib/windows-native-file-dialog-uat.mjs';

const powerShellUrl = new URL('../../../scripts/lib/windows-native-file-dialog-uat.ps1', import.meta.url);
const runnerUrl = new URL('../../../scripts/run-installed-frontend-user-uat.mjs', import.meta.url);

describe('installed UI Windows native file dialog harness', () => {
  it('maps every currently reachable file-open/save family to an exact canonical route contract', () => {
    const cases = [
      ['archive', '＋ Dosya ekle', 'OPEN', 'GENERIC_DOCUMENT'],
      ['archive', 'Yeni sürüm dosyası seç', 'OPEN', 'GENERIC_DOCUMENT'],
      ['finance', 'Dosya seç ve önizle', 'OPEN', 'FINANCE_IMPORT'],
      ['reports', 'PDF raporu oluştur', 'SAVE', 'GENERATED_OUTPUT'],
      ['security', 'Parola korumalı tam yedek', 'SAVE', 'GENERATED_BACKUP'],
      ['security', 'Cihaz korumalı tam yedek', 'SAVE', 'GENERATED_BACKUP'],
      ['security', 'Yedeği incele', 'OPEN', 'GENERATED_BACKUP'],
      ['security', 'Geri yükle', 'OPEN', 'GENERATED_BACKUP'],
      ['security', 'Yedek dosyası seç ve ön izle', 'OPEN', 'FAMILY_IMPORT'],
      ['security', 'Yerel şifreli dosya oluştur', 'SAVE', 'GENERATED_OUTPUT'],
      ['life-center', 'Düz PDF', 'SAVE', 'GENERATED_OUTPUT'],
      ['life-center', 'Şifreli belge paketi', 'SAVE', 'GENERATED_OUTPUT'],
      ['settings', 'Dosya seç ve yerel olarak şifrele', 'OPEN', 'GENERIC_DOCUMENT'],
      ['settings', 'JSON raporu dışa aktar', 'SAVE', 'GENERATED_OUTPUT'],
      ['settings', 'Yeni rapor', 'SAVE', 'GENERATED_OUTPUT'],
      ['settings', '30 günden eskiyi arşivle', 'SAVE', 'GENERATED_OUTPUT'],
      ['settings', 'JSON', 'SAVE', 'GENERATED_OUTPUT'],
      ['settings', 'CSV', 'SAVE', 'GENERATED_OUTPUT'],
      ['settings', 'Tanı paketini dışa aktar', 'SAVE', 'GENERATED_OUTPUT'],
    ] as const;
    expect(INSTALLED_UI_NATIVE_DIALOG_SPECIFICATIONS).toHaveLength(17);
    expect(new Set(INSTALLED_UI_NATIVE_DIALOG_SPECIFICATIONS.map((item) => item.specId)).size).toBe(17);
    expect(INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY).toHaveLength(17);
    expect(INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY.map((item) => item.specId)).toEqual(INSTALLED_UI_NATIVE_DIALOG_SPECIFICATIONS.map((item) => item.specId));
    expect(INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY_SHA256).toBe(createHash('sha256').update(JSON.stringify(INSTALLED_UI_CANONICAL_NATIVE_DIALOG_INVENTORY)).digest('hex'));
    for (const [routeId, label, dialogKind, selectionKind] of cases) {
      const result = resolveInstalledUiNativeDialogSpecification({ routeId, label });
      expect(result, `${routeId} / ${label}`).toMatchObject({ routeId, dialogKind, selectionKind });
    }
    expect(resolveInstalledUiNativeDialogSpecification({ routeId: 'security', label: 'Geri yükle' })?.terminalHybrid).toBe(true);
    expect(resolveInstalledUiNativeDialogSpecification({ routeId: 'archive', label: 'Belgeyi aç' })).toBeUndefined();
    expect(resolveInstalledUiNativeDialogSpecification({ routeId: 'finance', label: 'Bilinmeyen dışa aktarım' })).toBeUndefined();
  });

  it('uses owned #32770 UIAutomation, target-only PrintWindow and fail-closed close/readback', async () => {
    const source = await readFile(powerShellUrl, 'utf8');
    for (const marker of [
      "'#32770'",
      'OWNED_PROCESS_IDENTITIES_STALE',
      'OWNED_NATIVE_DIALOG_NOT_OBSERVED',
      'UIAutomationClient',
      "$baselineHandles",
      '$ownedByPid.ContainsKey([int]$processId) -or $ownedByPid.ContainsKey([int]$ownerProcessId)',
      '$ownerCreated=if($ownedByPid.ContainsKey($target.OwnerProcessId))',
      "'DIRECT_TARGET_PROCESS'",
      "'OWNER_PROCESS'",
      'ownershipMode=$ownershipMode',
      "WriteLine('READY')",
      "ReadLine())-ne 'GO'",
      "AutomationId)-ne '1148'",
      'InvokePattern',
      'ValuePattern',
      'PrintWindow',
      'DIALOG_SCREENSHOT_INVALID',
      'NATIVE_DIALOG_DID_NOT_CLOSE',
      'selectionPathRecorded=$false',
    ]) expect(source).toContain(marker);
    expect(source).not.toContain('taskkill');
    expect(source).not.toContain('SendKeys');
    expect(source).not.toContain('Remove-Item');
  });

  it('captures CANCEL before action and ACCEPT only after exact filename-field readback', async () => {
    const source = await readFile(powerShellUrl, 'utf8');
    const setValue = source.indexOf('$valuePattern.SetValue($selection)');
    const readback = source.indexOf('DIALOG_FILENAME_READBACK_MISMATCH');
    const screenshot = source.indexOf('[ParsYuvaNativeDialogWindow]::PrintWindow');
    const invoke = source.indexOf('$invoke.Invoke()');
    expect(source).toContain("AutomationId)-ne '1148'");
    expect(source).toContain('DIALOG_FILENAME_EDIT_1148_NOT_EXACT');
    expect(source).toContain('DIALOG_FILENAME_READBACK_EMPTY');
    expect(source).toContain('DIALOG_FILENAME_READBACK_INVALID');
    expect(source).toContain('DIALOG_FILENAME_READBACK_MISMATCH');
    expect(source).not.toContain('$score=');
    expect(setValue).toBeGreaterThan(0);
    expect(readback).toBeGreaterThan(setValue);
    expect(screenshot).toBeGreaterThan(readback);
    expect(invoke).toBeGreaterThan(screenshot);
  });

  it('readbacks target-only screenshots and rejects equal CANCEL/ACCEPT hashes per control', async () => {
    const source = await readFile(powerShellUrl, 'utf8');
    for (const marker of [
      'DIALOG_SCREENSHOT_TARGET_ALREADY_EXISTS',
      'Get-FileHash -LiteralPath $capture -Algorithm SHA256',
      'DIALOG_CANCEL_SCREENSHOT_MISSING',
      'DIALOG_CANCEL_SCREENSHOT_INVALID',
      'NATIVE_DIALOG_DECISION_SCREENSHOT_HASH_COLLISION',
      'screenshotCapturedBeforeInvoke=$true',
      'screenshotSha256=$captureSha256',
      'selectionReadbackVerified=$selectionReadbackVerified',
    ]) expect(source).toContain(marker);
    expect(source.indexOf('NATIVE_DIALOG_DECISION_SCREENSHOT_HASH_COLLISION')).toBeLessThan(source.indexOf('$invoke.Invoke()'));
  });

  it('binds CANCEL and ACCEPT evidence without recording disposable absolute paths', async () => {
    const source = await readFile(runnerUrl, 'utf8');
    for (const marker of [
      "decision: 'CANCEL'",
      "decision: 'ACCEPT'",
      'beginWindowsNativeFileDialogAutomation',
      'await automation.ready',
      'automation.start()',
      'targetWindowIdentity',
      'NATIVE_DIALOG_CANCELLED_WITHOUT_SELECTION_MUTATION',
      'NATIVE_SAVE_ARTIFACT_READBACK_VERIFIED',
      'NATIVE_OPEN_SELECTION_AND_APPLICATION_READBACK_VERIFIED',
      'WINDOWS_UIAUTOMATION_NATIVE_DIALOG_CANCEL_ACCEPT_READBACK',
      'NATIVE_RESTORE_OWNED_RELAUNCH_AND_SESSION_REVOCATION_READBACK',
      'waitForRelaunchedRootIdentity',
      'authenticatedSessionRevoked',
      'nativeDialogEvidenceSha256',
      'pathRecorded: false',
      'withinDisposableProfile: true',
    ]) expect(source).toContain(marker);
    expect(source).not.toContain("disposition: 'DEFERRED_EXTERNAL_EVIDENCE'");
  });
});
