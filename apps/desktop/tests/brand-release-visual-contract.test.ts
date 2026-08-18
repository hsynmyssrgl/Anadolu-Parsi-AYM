import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { parse } from '@babel/parser';
import { describe, expect, it } from 'vitest';

const stylesUrl = new URL('../src/renderer/styles.css', import.meta.url);
const brandMarkUrl = new URL('../src/renderer/assets/brand-mark.png', import.meta.url);
const manifestUrl = new URL('../../../config/ui-visual-reference-manifest.json', import.meta.url);
const appUrl = new URL('../src/renderer/App.tsx', import.meta.url);
const mainUrl = new URL('../src/main/main.ts', import.meta.url);
const routeStateUrl = new URL('../src/renderer/route-async-state.ts', import.meta.url);
const familyAiPanelUrl = new URL('../src/renderer/FamilyAiAssistantPanel.tsx', import.meta.url);
const memoryStudioPanelUrl = new URL('../src/renderer/MemoryStudioPanel.tsx', import.meta.url);
const rendererDomainUrl = new URL('../../../packages/domain/src/renderer.ts', import.meta.url);
const rendererDirectoryUrl = new URL('../src/renderer/', import.meta.url);

describe('approved brand and release-channel visual contract', () => {
  it('keeps renderer runtime imports on browser-safe package surfaces', async () => {
    const [app, routeState, familyAiPanel, memoryStudioPanel, rendererDomain] = await Promise.all([
      readFile(appUrl, 'utf8'),
      readFile(routeStateUrl, 'utf8'),
      readFile(familyAiPanelUrl, 'utf8'),
      readFile(memoryStudioPanelUrl, 'utf8'),
      readFile(rendererDomainUrl, 'utf8')
    ]);
    expect(app).not.toMatch(/import\s+\{[^}]*\}\s+from\s+['"]@ppt\/(?:core|domain)['"]/su);
    expect(routeState).toContain("from '@ppt/domain/renderer'");
    expect(familyAiPanel).toContain("import { FAMILY_AI_ASSISTANT_KINDS } from '@ppt/domain/renderer'");
    expect(memoryStudioPanel).toContain("import { MEMORY_STUDIO_RECORD_KINDS } from '@ppt/domain/renderer'");
    expect(familyAiPanel).not.toMatch(/import\s+\{[^}]*FAMILY_AI_ASSISTANT_KINDS[^}]*\}\s+from\s+['"]@ppt\/domain['"]/su);
    expect(memoryStudioPanel).not.toMatch(/import\s+\{[^}]*MEMORY_STUDIO_RECORD_KINDS[^}]*\}\s+from\s+['"]@ppt\/domain['"]/su);
    expect(rendererDomain).toContain("import type { IsoDateTime, UserId } from '@ppt/core'");
    expect(rendererDomain).toContain('archiveLegacyOwnershipReattestationConfirmation');
    expect(rendererDomain).toContain("export { FAMILY_AI_ASSISTANT_KINDS } from './family-ai-assistant.js'");
    expect(rendererDomain).toContain("export { MEMORY_STUDIO_RECORD_KINDS } from './memory-studio.js'");

    const rendererFiles = (await readdir(rendererDirectoryUrl, { recursive: true }))
      .filter((path) => /\.(?:ts|tsx)$/u.test(path) && !path.endsWith('.d.ts'));
    const unsafeRuntimeImports: string[] = [];
    for (const path of rendererFiles) {
      const source = await readFile(new URL(path.replaceAll('\\', '/'), rendererDirectoryUrl), 'utf8');
      const module = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
      for (const declaration of module.program.body) {
        if (declaration.type !== 'ImportDeclaration'
          || !['@ppt/core', '@ppt/domain'].includes(declaration.source.value)
          || declaration.importKind === 'type') continue;
        const hasRuntimeSpecifier = declaration.specifiers.some((specifier) =>
          specifier.type !== 'ImportSpecifier' || specifier.importKind !== 'type');
        if (hasRuntimeSpecifier) unsafeRuntimeImports.push(`${path}:${declaration.loc?.start.line ?? 0}`);
      }
    }
    expect(unsafeRuntimeImports).toEqual([]);
  });

  it('uses exact full Bronze, Silver and Gold palettes selected from the visible stage', async () => {
    const [styles,app,rawManifest]=await Promise.all([
      readFile(stylesUrl,'utf8'),readFile(appUrl,'utf8'),readFile(manifestUrl,'utf8')
    ]);
    const manifest=JSON.parse(rawManifest) as {
      releaseChannelSurfacePalettes:Record<string,Record<string,string>>;
      releasePaletteRule:Record<string,string>;
    };
    expect(styles).toContain('--release-menu-text:#d8ad78');
    expect(styles).toContain('--release-menu-text-strong:#ffd39b');
    expect(styles).toContain('--release-menu-icon:#e4a85f');
    expect(styles).toContain('--release-menu-edge:#dc9852');
    expect(styles).toContain('--release-menu-text:#bcc8d2');
    expect(styles).toContain('--release-menu-text-strong:#f3f7fa');
    expect(styles).toContain('--release-menu-icon:#d4dde4');
    expect(styles).toContain('--release-menu-edge:#d7e0e7');
    expect(styles).toContain('--release-menu-text:#d5b85f');
    expect(styles).toContain('--release-menu-text-strong:#ffe9a0');
    expect(styles).toContain('--release-menu-icon:#edca62');
    expect(styles).toContain('--release-menu-edge:#f0cc58');
    expect(manifest.releaseChannelSurfacePalettes).toEqual({
      Bronze:{background:'#F4F3F0',panel:'#FDFDFC',panelSecondary:'#F7F5F1',text:'#333537',muted:'#777B7A',border:'#DEDCD6',accent:'#A5672F',accentSoft:'#FFD39B',accentEdge:'#DC9852',accentStrong:'#71441F',primary:'#467259',primaryHover:'#36563F',focus:'#4F91FF'},
      Silver:{background:'#F2F4F5',panel:'#FCFDFD',panelSecondary:'#E9EEF1',text:'#30383E',muted:'#6E7B84',border:'#CED7DD',accent:'#718494',accentSoft:'#D4DDE4',accentEdge:'#AEBCC7',accentStrong:'#4F5F6B',primary:'#607888',primaryHover:'#4F6573',focus:'#4F91FF'},
      Gold:{background:'#F7F3E8',panel:'#FFFDF6',panelSecondary:'#FAF5E7',text:'#3B3527',muted:'#746B58',border:'#E3D8B8',accent:'#A57E17',accentSoft:'#FFE9A0',accentEdge:'#F0CC58',accentStrong:'#6E5411',primary:'#8A6A18',primaryHover:'#6E5411',focus:'#4F91FF'}
    });
    expect(manifest.releasePaletteRule).toMatchObject({
      source:'visible release stage',mapping:'Bronze->Bronze, Silver->Silver, Gold->Gold',fallback:'Bronze before renderer bootstrap',mismatchPolicy:'fail build and packaging verification'
    });
    for(const marker of [
      'const releaseChannel=releaseChannelFromInfo(appInfo.channel);',
      'document.documentElement.dataset.releaseChannel=releaseChannel;',
      'data-release-channel={releaseChannel}'
    ])expect(app).toContain(marker);
    for(const marker of [
      ':root[data-release-channel="bronze"]',':root[data-release-channel="silver"]',':root[data-release-channel="gold"]',
      '--release-background:#F4F3F0','--release-accent:#A5672F','--release-background:#F2F4F5','--release-accent:#718494','--release-background:#F7F3E8','--release-accent:#A57E17',
      '.app-shell .brand-icon {','background:linear-gradient(145deg,var(--release-accent-soft),var(--release-accent));',
      '.app-shell .welcome-panel {','.app-shell .onboarding-card.active {'
    ])expect(styles).toContain(marker);
    expect(styles).not.toMatch(/data-theme="light"[^{}]*data-release-channel[^{}]*\{[^}]*--release-menu-(?:text|text-strong|icon|edge):/u);
  });

  it('centralizes channel-specific glass surfaces with accessible opaque fallback', async () => {
    const [app, styles] = await Promise.all([readFile(appUrl, 'utf8'), readFile(stylesUrl, 'utf8')]);
    expect(app).toContain('releaseChannelFromInfo(appInfo.channel)');
    expect(app).not.toContain('releaseChannelFromStage(appInfo.stage)');
    for (const marker of [
      '--glass-filter:blur(22px) saturate(1.12)',
      '--glass-filter:blur(26px) saturate(1.05)',
      '--glass-filter:blur(24px) saturate(1.18)',
      'backdrop-filter:var(--glass-filter)',
      '.app-shell[data-high-contrast="true"]',
      '@supports not ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px)))'
    ]) expect(styles).toContain(marker);
  });

  it('pins the approved transparent warm-Bronze Anadolu parsı mark', async () => {
    const [asset, rawManifest] = await Promise.all([
      readFile(brandMarkUrl),
      readFile(manifestUrl, 'utf8')
    ]);
    const manifest = JSON.parse(rawManifest) as {
      brandMark: {
        path: string;
        style: string;
        sha256: string;
        width: number;
        height: number;
        transparentBackground: boolean;
        approvedDate: string;
      };
    };
    expect(manifest.brandMark).toEqual({
      path: 'apps/desktop/src/renderer/assets/brand-mark.png',
      style: 'warm_bronze_anatolian_leopard',
      sha256: createHash('sha256').update(asset).digest('hex'),
      width: 512,
      height: 512,
      transparentBackground: true,
      approvedDate: '2026-08-17'
    });
  });

  it('opens on the binding warm-white Bronze surface without a retired dark flash', async () => {
    const [styles, main, rawManifest] = await Promise.all([
      readFile(stylesUrl, 'utf8'),
      readFile(mainUrl, 'utf8'),
      readFile(manifestUrl, 'utf8')
    ]);
    const manifest = JSON.parse(rawManifest) as {
      shell: Record<string, string>;
      minimumInteractionTargetPx: number;
      approvedReferenceCharacteristics: { theme: string };
    };
    expect(manifest.approvedReferenceCharacteristics.theme).toBe('light');
    expect(manifest.shell).toMatchObject({
      background:'#F4F3F0',panel:'#FDFDFC',panelSecondary:'#F7F5F1',text:'#333537',
      muted:'#777B7A',border:'#DEDCD6',primary:'#467259',primarySoft:'#A3AE95',focus:'#4F91FF'
    });
    expect(manifest.minimumInteractionTargetPx).toBe(44);
    expect(main).toContain("backgroundColor: '#FDFDFC'");
    expect(main).not.toContain("backgroundColor: '#06111e'");
    for (const marker of [
      '/* Binding release-channel onboarding baseline — light, accessible and version-aware. */',
      'linear-gradient(145deg,var(--release-panel) 0%,var(--release-panel-secondary) 56%,var(--release-background) 100%)',
      'border-color:var(--release-border);',
      'border-color:var(--release-focus);',
      'background:linear-gradient(145deg,var(--release-accent-soft),var(--release-accent-edge));',
      '.auth-brand>img { width:58px;height:58px;',
      '.first-run-actions .button,',
      '.first-run-skip { min-height: 44px; }'
    ]) expect(styles).toContain(marker);
  });

  it('keeps first-admin setup readable and gives the primary action a direct fail-visible path', async () => {
    const [app, styles] = await Promise.all([readFile(appUrl, 'utf8'), readFile(stylesUrl, 'utf8')]);
    for (const marker of [
      'type="button" disabled={busy||helloBusy} aria-describedby="auth-submit-guidance" onClick={()=>void submit()}',
      'onSubmit={event=>{event.preventDefault();void submit();}}',
      'familyNameRef.current?.focus()',
      'displayNameRef.current?.focus()',
      'passwordRef.current?.focus()',
      'aria-invalid={familyNameInvalid}',
      'aria-invalid={displayNameInvalid}',
      'aria-invalid={passwordInvalid}',
      "if(!window.pardus)throw new Error('Güvenli kurulum bağlantısı başlatılamadı. Uygulamayı kapatıp yeniden açın.')"
    ]) expect(app).toContain(marker);
    for (const marker of [
      '.auth-trust strong{font-size:16px}',
      '.auth-trust small{margin-top:5px;color:#a9bed1;font-size:13px',
      '.auth-heading h2{margin:9px 0 9px;font-size:38px',
      '.auth-heading p{margin:0;color:#aec1d3;font-size:16px',
      '.auth-fields label{display:grid;gap:9px;color:#e1eaf2;font-size:15px',
      '.auth-fields input{width:100%;height:54px',
      '.auth-form>.button{height:54px;font-size:16px}',
      '.password-checklist { display: flex; flex-wrap: wrap; gap: 8px 13px; color: #9fb3c6; font-size: 13px;'
    ]) expect(styles).toContain(marker);
  });

  it('keeps the local password hidden by default and exposes an accessible user-controlled toggle', async () => {
    const [app, styles] = await Promise.all([readFile(appUrl, 'utf8'), readFile(stylesUrl, 'utf8')]);
    for (const marker of [
      "const [passwordVisible,setPasswordVisible]=useState(false);",
      "type={passwordVisible?'text':'password'}",
      'aria-controls="local-password"',
      'aria-pressed={passwordVisible}',
      "aria-label={passwordVisible?'Parolayı gizle':'Parolayı göster'}",
      "onClick={()=>setPasswordVisible(value=>!value)}",
      "{passwordVisible?'Gizle':'Göster'}"
    ]) expect(app).toContain(marker);
    for (const marker of [
      '.password-input-shell { position: relative; display: grid; }',
      '.password-input-shell input { padding-right: 96px; }',
      '.password-visibility-toggle {',
      'min-height: 44px;',
      'background: var(--release-panel-secondary);',
      '.password-visibility-toggle:focus-visible {'
    ]) expect(styles).toContain(marker);
  });
});
