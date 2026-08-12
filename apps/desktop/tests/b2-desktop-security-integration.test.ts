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
    expect(ELECTRON_FUSE_POLICY).toEqual({RunAsNode:false,EnableCookieEncryption:true,EnableNodeOptionsEnvironmentVariable:false,EnableNodeCliInspectArguments:false,EnableEmbeddedAsarIntegrityValidation:true,OnlyLoadAppFromAsar:true,LoadBrowserProcessSpecificV8Snapshot:true,GrantFileProtocolExtraPrivileges:false,WasmTrapHandlers:true});
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
    expect(rendererDomainEntry).not.toContain('@ppt/core');
  });

  it('binds the custom protocol and mandatory afterPack fuse hook', () => {
    const main=readFileSync('apps/desktop/src/main/main.ts','utf8');
    const packageJson=JSON.parse(readFileSync('apps/desktop/package.json','utf8'));
    expect(main).toContain("protocol.registerSchemesAsPrivileged");
    expect(main).toContain('protocol.handle(PRIMARY_RENDERER_SCHEME');
    expect(main).not.toContain('window.loadFile(');
    expect(packageJson.build.afterPack).toBe('scripts/apply-electron-fuses.mjs');
  });
});
