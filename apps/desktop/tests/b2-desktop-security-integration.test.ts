import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { DESKTOP_SECURITY_POSTURE } from '@ppt/domain';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';
import { normalizeTrustedRendererDocumentUrl } from '../src/main/ipc-sender-trust.js';
import { resolvePrimaryRendererAssetPath } from '../src/main/renderer-protocol.js';
import { DESKTOP_RENDERER_CSP, installRendererSessionSecurity } from '../src/main/renderer-session-security.js';
import { assertSecureRendererPreferences, createSecureRendererPreferences } from '../src/main/renderer-window-security.js';
import { ELECTRON_FUSE_POLICY } from '../scripts/electron-fuse-policy.mjs';

describe('B2-03/B2-04 desktop integration', () => {
  it('accepts only the privileged application origin in production', () => {
    expect(normalizeTrustedRendererDocumentUrl('pardus-app://renderer/index.html', { allowLocalDevelopmentServer:false }))
      .toBe('pardus-app://renderer/index.html');
    expect(() => normalizeTrustedRendererDocumentUrl('file:///C:/secret.txt', { allowLocalDevelopmentServer:false })).toThrow(/pardus-app/iu);
    expect(() => normalizeTrustedRendererDocumentUrl('pardus-app://attacker/index.html', { allowLocalDevelopmentServer:false })).toThrow(/pardus-app/iu);
  });

  it('confines custom protocol requests to the renderer asset root', () => {
    const root='C:\\application\\dist\\renderer';
    expect(resolvePrimaryRendererAssetPath('pardus-app://renderer/index.html',root)).toBe('C:\\application\\dist\\renderer\\index.html');
    expect(resolvePrimaryRendererAssetPath('pardus-app://renderer/assets/app.js?v=1',root)).toBe('C:\\application\\dist\\renderer\\assets\\app.js');
    expect(resolvePrimaryRendererAssetPath('pardus-app://renderer/..%5csecrets.txt',root)).toBeNull();
    expect(resolvePrimaryRendererAssetPath('pardus-app://attacker/index.html',root)).toBeNull();
    expect(resolvePrimaryRendererAssetPath('pardus-app://user@renderer/index.html',root)).toBeNull();
    expect(resolvePrimaryRendererAssetPath('pardus-app://renderer/%E0%A4%A',root)).toBeNull();
  });

  it('installs restrictive CSP, permission, navigation, download and webview fences', () => {
    const permissionRequest = vi.fn();
    const permissionCheck = vi.fn();
    const sessionOn = vi.fn();
    const headers = vi.fn();
    const webContentsOn = vi.fn();
    const session = { setPermissionRequestHandler:permissionRequest, setPermissionCheckHandler:permissionCheck, on:sessionOn, webRequest:{onHeadersReceived:headers} };
    installRendererSessionSecurity({ webContents:{session,on:webContentsOn}, trustedDocumentUrl:'pardus-app://renderer/index.html' });
    expect(permissionRequest).toHaveBeenCalledOnce();
    expect(permissionCheck).toHaveBeenCalledOnce();
    expect(sessionOn).toHaveBeenCalledWith('will-download',expect.any(Function));
    expect(headers).toHaveBeenCalledOnce();
    expect(DESKTOP_RENDERER_CSP).toContain("default-src 'none'");
    expect(DESKTOP_RENDERER_CSP).toContain("connect-src 'self'");
    expect(webContentsOn.mock.calls.map(([event])=>event)).toEqual(expect.arrayContaining(['will-navigate','will-redirect','will-attach-webview']));
  });

  it('keeps renderer preferences and all nine Electron fuses fail-closed', () => {
    expect(assertSecureRendererPreferences(createSecureRendererPreferences('preload.cjs',false))).toMatchObject({sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,webviewTag:false});
    expect(ELECTRON_FUSE_POLICY).toEqual({RunAsNode:false,EnableCookieEncryption:true,EnableNodeOptionsEnvironmentVariable:false,EnableNodeCliInspectArguments:false,EnableEmbeddedAsarIntegrityValidation:true,OnlyLoadAppFromAsar:true,LoadBrowserProcessSpecificV8Snapshot:false,GrantFileProtocolExtraPrivileges:false,WasmTrapHandlers:true});
    expect(DESKTOP_SECURITY_POSTURE.electron.fileProtocolPrimaryRendererAllowed).toBe(false);
  });

  it('validates lock IPC payloads and binds the state-preserving UI chain', () => {
    expect(evaluateIpcIntegrationPolicy('auth:getSessionLockState',[]).accepted).toBe(true);
    expect(evaluateIpcIntegrationPolicy('auth:getSessionLockState',['pollution']).accepted).toBe(false);
    expect(evaluateIpcIntegrationPolicy('auth:unlockSession',[{password:'correct horse battery staple',secondFactorCode:'123456'}]).accepted).toBe(true);
    expect(evaluateIpcIntegrationPolicy('auth:unlockSession',[{password:'x',extra:true}]).accepted).toBe(false);
    const renderer=readFileSync('apps/desktop/src/renderer/App.tsx','utf8');
    const rendererDomainEntry=readFileSync('packages/domain/src/renderer.ts','utf8');
    expect(renderer).toContain('Kaydedilmemiş form bilgileriniz ekranda korunacak');
    expect(renderer).toContain('getSessionLockState');
    expect(renderer).toContain('recordSessionActivity');
    expect(renderer).toContain('unlockSession');
    expect(renderer).toContain("from '@ppt/domain/renderer';");
    expect(rendererDomainEntry).toContain('PRODUCT_NAVIGATION_ROUTES');
    expect(rendererDomainEntry).toContain("import type { IsoDateTime, UserId } from '@ppt/core';");
    expect(rendererDomainEntry).not.toMatch(/import\s+(?!type\b)[^;]+from\s+['"]@ppt\/core['"]/u);
  });

  it('binds the custom protocol and mandatory afterPack fuse hook', () => {
    const main=readFileSync('apps/desktop/src/main/main.ts','utf8');
    const packageJson=JSON.parse(readFileSync('apps/desktop/package.json','utf8'));
    const afterPack=readFileSync('apps/desktop/scripts/apply-electron-fuses.mjs','utf8');
    const asarRepair=readFileSync('apps/desktop/scripts/repair-electron-asar-integrity.mjs','utf8');
    const builderRunner=readFileSync('apps/desktop/scripts/run-electron-builder.mjs','utf8');
    const windowsSecurityProbe=readFileSync('apps/desktop/src/main/windows-security-evidence-probe.ts','utf8');
    expect(main).toContain("protocol.registerSchemesAsPrivileged");
    expect(main).toContain('protocol.handle(PRIMARY_RENDERER_SCHEME');
    expect(main).not.toContain('window.loadFile(');
    expect(main).toContain('`runtime-${process.pid}-${Date.now().toString(36)}`');
    expect(main).toContain('catch { /* will-quit retries after all windows have closed */ }');
    expect(main).toContain("app.on('will-quit', () => {");
    expect(main).toContain('catch { /* OS temporary-storage maintenance may remove a still-locked residue later. */ }');
    expect(main).toContain('volatileRuntimeCleanupMarker');
    expect(main).toContain('previousProcessAlive');
    expect(main).toContain('dirname(previousRuntimeRoot) === resolve(volatileRuntimeBase)');
    expect(main).toContain('!previousStat.isSymbolicLink()');
    expect(main).toContain('maxRetries: 4');
    expect(main).not.toContain('finally { rmSync(volatileRuntimeRoot, { recursive: true, force: true }); }');
    expect(packageJson.build.afterPack).toBe('scripts/apply-electron-fuses.mjs');
    expect(afterPack).toContain('repairAndVerifyPackagedAsarIntegrity');
    expect(asarRepair).toContain('ASAR entry integrity readback failed.');
    expect(asarRepair).toContain('Electron executable ASAR integrity readback failed.');
    expect(builderRunner).toContain("['--win', 'dir', '--config.forceCodeSigning=false']");
    expect(builderRunner).toContain("['--win', 'nsis']");
    expect(windowsSecurityProbe).toContain("import { assertWindowsEfsEncrypted } from './windows-efs-protection.js';");
    expect(windowsSecurityProbe).toContain("assertWindowsEfsEncrypted(dirname(snapshotPath), 'EFS staging directory')");
    expect(windowsSecurityProbe).not.toContain("-Command', script, path");
  });
});
