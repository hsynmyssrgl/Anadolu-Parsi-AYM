import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { parse } from '@babel/parser';
import { describe, expect, it } from 'vitest';

const stylesUrl = new URL('../src/renderer/styles.css', import.meta.url);
const typographyUrl = new URL('../src/renderer/typography.css', import.meta.url);
const brandMarkUrl = new URL('../src/renderer/assets/brand-mark.png', import.meta.url);
const manifestUrl = new URL('../../../config/ui-visual-reference-manifest.json', import.meta.url);
const appUrl = new URL('../src/renderer/App.tsx', import.meta.url);
const mainUrl = new URL('../src/main/main.ts', import.meta.url);
const routeStateUrl = new URL('../src/renderer/route-async-state.ts', import.meta.url);
const familyAiPanelUrl = new URL('../src/renderer/FamilyAiAssistantPanel.tsx', import.meta.url);
const memoryStudioPanelUrl = new URL('../src/renderer/MemoryStudioPanel.tsx', import.meta.url);
const rendererDomainUrl = new URL('../../../packages/domain/src/renderer.ts', import.meta.url);
const rendererDirectoryUrl = new URL('../src/renderer/', import.meta.url);

const relativeLuminance = (hex: string): number => {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
};

const contrastRatio = (left: string, right: string): number => {
  const first = relativeLuminance(left);
  const second = relativeLuminance(right);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

describe('approved brand and release-channel visual contract', () => {
  it('enforces one readable and proportional typography rhythm across the complete application shell', async () => {
    const [styles, typography] = await Promise.all([readFile(stylesUrl, 'utf8'), readFile(typographyUrl, 'utf8')]);
    expect(typography).toContain('--minimum-readable-copy: 16px');
    expect(typography).toContain('font-size: var(--font-size-body) !important;');
    expect(typography).toContain('font-size: var(--font-size-subheadline) !important;');
    expect(typography).toContain('font-size: var(--font-size-footnote) !important;');
    expect(typography).toContain('min-height: 48px !important;');
    expect(typography).toContain('min-height: 44px !important;');
    expect(styles).toContain('.app-shell .main-area { grid-template-rows: minmax(72px, auto) minmax(0, 1fr); }');
    expect(styles).toContain('.app-shell .page-content { padding:28px 32px 40px; }');
  });

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
      Bronze:{background:'#F4F3F0',panel:'#FDFDFC',panelSecondary:'#F7F5F1',text:'#333537',muted:'#676B6A',border:'#8E8A82',accent:'#A5672F',accentSoft:'#FFD39B',accentEdge:'#DC9852',accentStrong:'#71441F',primary:'#467259',primaryHover:'#36563F',focus:'#3979E6'},
      Silver:{background:'#F2F4F5',panel:'#FCFDFD',panelSecondary:'#E9EEF1',text:'#30383E',muted:'#5F6B73',border:'#7C8992',accent:'#718494',accentSoft:'#D4DDE4',accentEdge:'#AEBCC7',accentStrong:'#4F5F6B',primary:'#607888',primaryHover:'#4F6573',focus:'#3979E6'},
      Gold:{background:'#F7F3E8',panel:'#FFFDF6',panelSecondary:'#FAF5E7',text:'#3B3527',muted:'#746B58',border:'#8D7D50',accent:'#A57E17',accentSoft:'#FFE9A0',accentEdge:'#F0CC58',accentStrong:'#6E5411',primary:'#8A6A18',primaryHover:'#6E5411',focus:'#3979E6'}
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
      '@media(prefers-reduced-transparency:reduce)',
      'body:has(.app-shell[data-high-contrast="true"])',
      '@media(forced-colors:active)',
      '@supports not ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px)))'
    ]) expect(styles).toContain(marker);
  });

  it('keeps text, controls and keyboard focus accessible in every release palette', async () => {
    const manifest = JSON.parse(await readFile(manifestUrl, 'utf8')) as {
      releaseChannelSurfacePalettes: Record<string, Record<string, string>>;
    };
    for (const [channel, palette] of Object.entries(manifest.releaseChannelSurfacePalettes)) {
      expect(contrastRatio(palette.text!, palette.background!), `${channel} normal text`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.muted!, palette.background!), `${channel} muted text`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.primary!, '#FFFFFF'), `${channel} primary button text`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.accentStrong!, palette.accentSoft!), `${channel} accent text`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.border!, palette.background!), `${channel} required control boundary`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(palette.focus!, palette.background!), `${channel} keyboard focus`).toBeGreaterThanOrEqual(3);
    }
  });

  it('does not let later light-theme declarations restore Bronze-only colors', async () => {
    const styles = await readFile(stylesUrl, 'utf8');
    const paletteEnd = styles.indexOf('.app-shell:not([data-theme="light"])');
    expect(paletteEnd).toBeGreaterThan(0);
    const laterStyles = styles.slice(paletteEnd);
    expect(laterStyles).not.toMatch(/--(?:bg|bg-soft|sidebar|panel|panel-2|border|blue|shell-accent):\s*#[0-9a-f]{6}/iu);
    expect(laterStyles).toContain('--border: var(--release-border);');
    expect(laterStyles).toContain('--shell-accent: var(--release-primary);');
  });

  it('pins deterministic full-shell Electron screenshots for every release channel', async () => {
    const [styles, typography, rawManifest] = await Promise.all([
      readFile(stylesUrl),
      readFile(typographyUrl),
      readFile(manifestUrl)
    ]);
    const manifest = JSON.parse(rawManifest.toString('utf8')) as {
      releaseChannelSurfacePalettes: Record<string, Record<string, string>>;
      releaseChannelScreenshotBaselines: {
        manifest: string;
        renderer: string;
        platform: string;
        electronVersion: string;
        viewport: Record<string, number>;
        channels: Record<string, { path: string; sha256: string }>;
        typographyScaleBaseline: {
          captureId: string;
          channel: string;
          textScalePercent: number;
          path: string;
          sha256: string;
          requiredSidebarWidthPx: number;
          maximumHorizontalOverflowPx: number;
          maximumClippedTextElements: number;
          verticalPageScrollAllowed: boolean;
        };
        transparencyFallbackBaseline: {
          captureId: string;
          channel: string;
          highContrast: boolean;
          reduceMotion: boolean;
          path: string;
          sha256: string;
          requiredOpaqueSelectors: string[];
          expectedBackdropFilter: string;
          expectedAnimationDuration: string;
          expectedTransitionDuration: string;
        };
        mismatchPolicy: string;
      };
    };
    const screenshotManifestUrl = new URL(
      `../../../${manifest.releaseChannelScreenshotBaselines.manifest}`,
      import.meta.url
    );
    const screenshotManifest = JSON.parse(await readFile(screenshotManifestUrl, 'utf8')) as {
      renderer: string;
      platform: string;
      electronVersion: string;
      viewport: Record<string, number>;
      networkUsed: boolean;
      userOrDemoDataIncluded: boolean;
      sourceStylesCssSha256: string;
      sourceTypographyCssSha256: string;
      combinedCssSha256: string;
      visualManifestSha256: string;
      entries: Array<{
        captureId: string;
        channel: string;
        textScalePercent: number;
        highContrast: boolean;
        reduceMotion: boolean;
        path: string;
        sha256: string;
        width: number;
        height: number;
        computedTokens: Record<string, string>;
        layoutChecks: {
          rootWidth: number;
          rootHeight: number;
          regions: Record<string, {
            clientWidth: number;
            scrollWidth: number;
            clientHeight: number;
            scrollHeight: number;
            horizontalOverflow: number;
          }>;
          clippedText: Array<Record<string, string>>;
        };
        visualEffects: Record<string, {
          backdropFilter: string;
          backgroundColor: string;
          borderWidth: string;
          boxShadow: string;
          animationDuration: string;
          transitionDuration: string;
        }>;
      }>;
    };
    const baselines = manifest.releaseChannelScreenshotBaselines;
    expect(screenshotManifest).toMatchObject({
      renderer: baselines.renderer,
      platform: baselines.platform,
      electronVersion: baselines.electronVersion,
      viewport: baselines.viewport,
      networkUsed: false,
      userOrDemoDataIncluded: false,
      sourceStylesCssSha256: createHash('sha256').update(styles).digest('hex'),
      sourceTypographyCssSha256: createHash('sha256').update(typography).digest('hex'),
      combinedCssSha256: createHash('sha256').update(Buffer.concat([styles, Buffer.from('\n'), typography])).digest('hex'),
      visualManifestSha256: createHash('sha256').update(rawManifest).digest('hex')
    });
    expect(baselines.mismatchPolicy).toBe('fail visual contract test before packaging');
    const channelEntries = screenshotManifest.entries.filter((entry) => entry.textScalePercent === 100 && !entry.highContrast);
    expect(channelEntries.map((entry) => entry.captureId)).toEqual(['Bronze', 'Silver', 'Gold']);

    const paletteKeys = {
      background: 'background',
      panel: 'panel',
      'panel-secondary': 'panelSecondary',
      text: 'text',
      muted: 'muted',
      border: 'border',
      accent: 'accent',
      'accent-soft': 'accentSoft',
      'accent-edge': 'accentEdge',
      'accent-strong': 'accentStrong',
      primary: 'primary',
      'primary-hover': 'primaryHover',
      focus: 'focus'
    } as const;
    const distinctHashes = new Set<string>();
    for (const entry of channelEntries) {
      const baseline = baselines.channels[entry.channel];
      const palette = manifest.releaseChannelSurfacePalettes[entry.channel];
      expect(baseline, `${entry.channel} screenshot baseline`).toBeDefined();
      expect(palette, `${entry.channel} palette`).toBeDefined();
      expect(entry).toMatchObject({
        path: baseline!.path,
        sha256: baseline!.sha256,
        width: baselines.viewport.width,
        height: baselines.viewport.height
      });
      const png = await readFile(new URL(`../../../${entry.path}`, import.meta.url));
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(png.readUInt32BE(16)).toBe(baselines.viewport.width);
      expect(png.readUInt32BE(20)).toBe(baselines.viewport.height);
      expect(createHash('sha256').update(png).digest('hex')).toBe(entry.sha256);
      expect(entry.computedTokens).toEqual(Object.fromEntries(
        Object.entries(paletteKeys).map(([cssKey, manifestKey]) => [cssKey, palette![manifestKey]!.toUpperCase()])
      ));
      distinctHashes.add(entry.sha256);
    }
    expect(distinctHashes.size).toBe(3);

    const typographyBaseline = baselines.typographyScaleBaseline;
    const typographyEntry = screenshotManifest.entries.find((entry) => entry.captureId === typographyBaseline.captureId);
    expect(typographyEntry).toBeDefined();
    expect(typographyEntry).toMatchObject({
      channel: typographyBaseline.channel,
      textScalePercent: typographyBaseline.textScalePercent,
      path: typographyBaseline.path,
      sha256: typographyBaseline.sha256,
      width: baselines.viewport.width,
      height: baselines.viewport.height
    });
    const typographyPng = await readFile(new URL(`../../../${typographyBaseline.path}`, import.meta.url));
    expect(createHash('sha256').update(typographyPng).digest('hex')).toBe(typographyBaseline.sha256);
    expect(typographyEntry!.layoutChecks.regions['.sidebar']!.clientWidth).toBeGreaterThanOrEqual(typographyBaseline.requiredSidebarWidthPx);
    for (const [selector, region] of Object.entries(typographyEntry!.layoutChecks.regions)) {
      expect(region.horizontalOverflow, `${selector} horizontal overflow at 200 percent`).toBeLessThanOrEqual(typographyBaseline.maximumHorizontalOverflowPx);
    }
    expect(typographyEntry!.layoutChecks.clippedText).toHaveLength(typographyBaseline.maximumClippedTextElements);
    expect(typographyBaseline.verticalPageScrollAllowed).toBe(true);
    expect(typographyEntry!.layoutChecks.regions['.page-content']!.scrollHeight)
      .toBeGreaterThanOrEqual(typographyEntry!.layoutChecks.regions['.page-content']!.clientHeight);

    const transparencyBaseline = baselines.transparencyFallbackBaseline;
    const transparencyEntry = screenshotManifest.entries.find((entry) => entry.captureId === transparencyBaseline.captureId);
    const normalBronzeEntry = screenshotManifest.entries.find((entry) => entry.captureId === 'Bronze');
    expect(transparencyEntry).toBeDefined();
    expect(normalBronzeEntry).toBeDefined();
    expect(transparencyEntry).toMatchObject({
      channel: transparencyBaseline.channel,
      highContrast: transparencyBaseline.highContrast,
      reduceMotion: transparencyBaseline.reduceMotion,
      path: transparencyBaseline.path,
      sha256: transparencyBaseline.sha256,
      width: baselines.viewport.width,
      height: baselines.viewport.height
    });
    const transparencyPng = await readFile(new URL(`../../../${transparencyBaseline.path}`, import.meta.url));
    expect(createHash('sha256').update(transparencyPng).digest('hex')).toBe(transparencyBaseline.sha256);
    for (const selector of transparencyBaseline.requiredOpaqueSelectors) {
      expect(normalBronzeEntry!.visualEffects[selector]!.backdropFilter, `${selector} normal glass`).not.toBe('none');
      expect(transparencyEntry!.visualEffects[selector]).toMatchObject({
        backdropFilter: transparencyBaseline.expectedBackdropFilter,
        boxShadow: 'none',
        animationDuration: transparencyBaseline.expectedAnimationDuration,
        transitionDuration: transparencyBaseline.expectedTransitionDuration
      });
      expect(transparencyEntry!.visualEffects[selector]!.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    }
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
      muted:'#676B6A',border:'#8E8A82',primary:'#467259',primarySoft:'#A3AE95',focus:'#3979E6'
    });
    expect(manifest.minimumInteractionTargetPx).toBe(44);
    expect(main).toContain("backgroundColor: '#FDFDFC'");
    expect(main).toContain('minWidth: 900');
    expect(main).toContain('minHeight: 640');
    expect(main).toContain("titleBarStyle: 'hidden'");
    expect(main).toContain("color: '#F7F3ED'");
    expect(main).toContain("symbolColor: '#5B5148'");
    expect(main).toContain('roundedCorners: true');
    expect(main).not.toContain("backgroundColor: '#06111e'");
    for (const marker of [
      '/* Binding release-channel onboarding baseline — light, accessible and version-aware. */',
      'linear-gradient(145deg,var(--release-panel) 0%,var(--release-panel-secondary) 56%,var(--release-background) 100%)',
      'border-color:var(--release-border);',
      'border-color:var(--release-focus);',
      'background:linear-gradient(145deg,var(--release-accent-soft),var(--release-accent-edge));',
      '.desktop-titlebar img {',
      'width:29px;',
      '.auth-brand .auth-brand-mark {',
      'width:112px;',
      'height:112px;',
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
      "Güvenli kurulum bağlantısı başlatılamadı. Uygulamayı tamamen kapatıp yeniden açın."
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

  it('scales the first-family surface with the restored single pars and keeps calm motion optional', async () => {
    const [app, styles] = await Promise.all([readFile(appUrl, 'utf8'), readFile(stylesUrl, 'utf8')]);
    for (const marker of [
      'className="auth-brand-mark" src={brandMarkUrl} alt="" aria-hidden="true"',
      "globalThis.addEventListener('pointerdown',retryAfterUserGesture,{capture:true,once:true})",
      "globalThis.addEventListener('keydown',retryAfterUserGesture,{capture:true,once:true})"
    ]) expect(app).toContain(marker);
    for (const marker of [
      'body {\n  min-width:0;\n  min-height:0;',
      '.desktop-window-content {',
      'height:calc(100vh - 42px);',
      '.auth-shell {\n  grid-template-columns:minmax(340px,.98fr) minmax(470px,1.02fr);',
      '@media(max-height:760px)',
      '@media(prefers-reduced-motion:reduce) {\n  .auth-brand .auth-brand-mark { animation:none!important;transition:none!important; }'
    ]) expect(styles).toContain(marker);
    expect(app).not.toContain('auth-family-pars');
    expect(app).not.toContain('auth-pars-child');
  });

  it('keeps the local password hidden by default and exposes an accessible user-controlled toggle', async () => {
    const [app, styles] = await Promise.all([readFile(appUrl, 'utf8'), readFile(stylesUrl, 'utf8')]);
    for (const marker of [
      "const [passwordVisible,setPasswordVisible]=useState(false);",
      "type={passwordVisible?'text':'password'}",
      'aria-controls="local-password"',
      'aria-pressed={passwordVisible}',
      "aria-label={passwordVisible?t('auth.hidePassword'):t('auth.showPassword')}",
      "onClick={()=>setPasswordVisible(value=>!value)}",
      "{passwordVisible?(language==='tr'?'Gizle':'Hide'):(language==='tr'?'Göster':'Show')}"
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
