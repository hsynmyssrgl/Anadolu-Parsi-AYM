import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRODUCT_NAVIGATION_ROUTES } from '@ppt/domain';
import {
  AsyncStatePanel,
  canUndoGovernedDraft,
  focusFirstInvalid,
  GovernedDraftController,
  runRetryWithFocus,
  shouldFocusValidationSummary,
  ValidationSummary
} from '../src/renderer/form-ux';

afterEach(() => vi.useRealTimers());

describe('33-N renderer form UX', () => {
  it('B7-15 tüm ürün rotalarını ortak async durum kabuğuna ve anlamlı empty yüzeyine bağlar', () => {
    const appSource = readFileSync(new URL('../src/renderer/App.tsx', import.meta.url), 'utf8');
    const uiSource = readFileSync(new URL('../src/renderer/ui.tsx', import.meta.url), 'utf8');
    const selectionStart = appSource.indexOf('let screen: ReactNode;');
    const selectionEnd = appSource.indexOf('return (<>', selectionStart);
    const screenSelection = appSource.slice(selectionStart, selectionEnd);
    const explicitRoutes = new Set(
      [...screenSelection.matchAll(/else if \(active === '([^']+)'\)/gu)].map((match) => match[1])
    );
    if (screenSelection.includes('active === SECURITY_CENTER_ROUTE')) explicitRoutes.add('security');

    expect(selectionStart).toBeGreaterThan(-1);
    expect(selectionEnd).toBeGreaterThan(selectionStart);
    expect(appSource).toContain('PRODUCT_NAVIGATION_ROUTES.map(({ id, label, icon })');
    expect([...explicitRoutes].sort()).toEqual(PRODUCT_NAVIGATION_ROUTES.map((route) => route.id).sort());

    const pageContentStart = appSource.indexOf('<div className="page-content">');
    const pageContentEnd = appSource.indexOf('</main>', pageContentStart);
    const globalStateShell = appSource.slice(pageContentStart, pageContentEnd);
    expect(pageContentStart).toBeGreaterThan(-1);
    expect(globalStateShell).toContain('!networkOnline&&<AsyncStatePanel state={routeOfflineState.panelState}');
    expect(globalStateShell).toContain('? <AsyncStatePanel state="loading"');
    expect(globalStateShell).toContain('? <AsyncStatePanel state={routeErrorState.panelState}');
    expect(globalStateShell).toContain('onRetry=');
    expect(globalStateShell).toContain('retryFocusTarget={mainContentRef}');
    expect(globalStateShell).toMatch(/active!==['"]dashboard['"]&&!activeScreenDataReady[\s\S]*?<AsyncStatePanel state=\{routeLoadingState\.panelState\}[\s\S]*?: screen\}/u);

    expect(appSource).toContain('import { Button, EmptyState,');
    expect(appSource.match(/<EmptyState\b/gu)?.length ?? 0).toBeGreaterThan(0);
    expect(uiSource).toMatch(/function EmptyState[\s\S]*?className="empty-state" role="status"/u);
  });

  it('asenkron durumları canlı bölge ve erişilebilir yeniden deneme eylemiyle sunar', () => {
    const errorHtml = renderToStaticMarkup(createElement(AsyncStatePanel, {
      state: 'error', title: 'Yüklenemedi', message: 'Bir sorun oluştu.', onRetry: () => undefined
    }));
    expect(errorHtml).toContain('role="alert"');
    expect(errorHtml).toContain('async-state-panel async-state-panel--error');
    expect(errorHtml).toContain('aria-live="assertive"');
    expect(errorHtml).toContain('type="button"');
    expect(errorHtml).toContain('Yeniden dene');

    const loadingHtml = renderToStaticMarkup(createElement(AsyncStatePanel, {
      state: 'loading', title: 'Yükleniyor', message: 'Lütfen bekleyin.'
    }));
    expect(loadingHtml).toContain('role="status"');
    expect(loadingHtml).toContain('aria-busy="true"');
  });

  it('doğrulama özetini alan bağlantıları ve odaklanabilir başlıkla üretir', () => {
    const html = renderToStaticMarkup(createElement(ValidationSummary, {
      issues: [{ fieldId: 'family-name', message: 'Aile adı zorunludur.' }]
    }));
    expect(html).toContain('role="alert"');
    expect(html).toContain('class="validation-summary"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('href="#family-name"');
    expect(html).toContain('Aile adı zorunludur.');
  });

  it('doğrulama özetini yalnızca submit isteğinde veya 0→pozitif hata geçişinde odaklar', () => {
    expect(shouldFocusValidationSummary(0, 1)).toBe(true);
    expect(shouldFocusValidationSummary(1, 1)).toBe(false);
    expect(shouldFocusValidationSummary(1, 2)).toBe(false);
    expect(shouldFocusValidationSummary(2, 2, true)).toBe(true);
    expect(shouldFocusValidationSummary(0, 0, true)).toBe(false);
  });

  it('geri almayı yalnızca temiz ve kararlı taslak fazlarında açar', () => {
    expect(canUndoGovernedDraft('idle')).toBe(true);
    expect(canUndoGovernedDraft('saved')).toBe(true);
    for (const phase of ['dirty', 'invalid', 'saving', 'error'] as const) {
      expect(canUndoGovernedDraft(phase)).toBe(false);
    }
  });

  it('taslak merkezini ilk Ayarlar ziyaretinde başlatır, sonra oturum boyunca mounted tutar ve ağ sinyalini yerel yazma kapısı yapmaz', () => {
    const appSource = readFileSync(new URL('../src/renderer/App.tsx', import.meta.url), 'utf8');
    const centerStart = appSource.indexOf('function GovernedFormDraftCenter');
    const centerEnd = appSource.indexOf('function SystemManagementScreen', centerStart);
    const centerSource = appSource.slice(centerStart, centerEnd);
    expect(appSource).toContain('data-session-draft-host="workspace.notes"');
    expect(appSource).toContain("if(auth.authenticated&&active==='settings')setDraftCenterActivated(true);");
    expect(appSource).toContain('draftCenterActivated&&<div data-session-draft-host="workspace.notes"');
    expect(appSource).toContain('setDraftCenterActivated(false);');
    expect(appSource).toContain('<GovernedFormDraftCenter visible={active===\'settings\'}/>');
    expect(centerSource).toContain("leavingVisibleRoute&&draft.state.phase==='dirty'");
    expect(centerSource).toContain('expectedRevision:operation.expectedRevision');
    expect(centerSource).toContain('void refreshWorkspace();');
    expect(centerSource).toContain('canUndoGovernedDraft(draft.state.phase)');
    expect(centerSource).not.toContain("navigator?.onLine===false)throw");
    expect(centerSource).not.toContain('catch{await load();}');
  });

  it('ilk geçersiz alanı odaklar', () => {
    const focus = vi.fn();
    const root = { getElementById: (id: string) => id === 'email' ? { focus } : null };
    expect(focusFirstInvalid([{ fieldId: 'email', message: 'E-posta geçersiz.' }], root as never)).toBe(true);
    expect(focus).toHaveBeenCalledOnce();
  });

  it('taslağı debounce eder ve sadece son monotonik sonucu kabul eder', async () => {
    vi.useFakeTimers();
    const completions: Array<() => void> = [];
    const saved: string[] = [];
    const controller = new GovernedDraftController('', {
      debounceMs: 50,
      save: (draft) => new Promise<void>((resolve) => completions.push(() => { saved.push(draft); resolve(); }))
    });

    controller.update('ilk');
    await vi.advanceTimersByTimeAsync(50);
    expect(controller.state.phase).toBe('saving');
    controller.update('son');
    await vi.advanceTimersByTimeAsync(50);
    completions[0]();
    await Promise.resolve();
    expect(controller.state.phase).toBe('saving');
    completions[1]();
    await Promise.resolve();
    expect(controller.state.phase).toBe('saved');
    expect(saved).toEqual(['ilk', 'son']);
  });

  it('geçersiz taslağı otomatik veya elle kaydetmez', async () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const controller = new GovernedDraftController({ title: '' }, {
      debounceMs: 50,
      validate: (draft) => draft.title.trim() ? [] : [{ fieldId: 'title', message: 'Başlık zorunludur.' }],
      save
    });
    controller.update({ title: '   ' });
    expect(controller.state.phase).toBe('invalid');
    await vi.advanceTimersByTimeAsync(500);
    expect(await controller.flush()).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('retry sonucuna göre beklenen odağı geri yükler', async () => {
    const successFocus = vi.fn();
    const retryFocus = vi.fn();
    expect(await runRetryWithFocus(async () => undefined, { focus: successFocus }, { focus: retryFocus })).toBe(true);
    expect(successFocus).toHaveBeenCalledOnce();
    expect(retryFocus).not.toHaveBeenCalled();

    expect(await runRetryWithFocus(async () => { throw new Error('geçici'); }, null, { focus: retryFocus })).toBe(false);
    expect(retryFocus).toHaveBeenCalledOnce();
  });

  it('hata sonrasında açık retry ile aynı bellek içi taslağı yeniden gönderir', async () => {
    let attempts = 0;
    const controller = new GovernedDraftController({ note: 'hassas' }, {
      debounceMs: 10,
      save: async () => { if (++attempts === 1) throw new Error('geçici'); }
    });
    controller.update({ note: 'hassas' });
    expect(await controller.flush()).toBe(false);
    expect(controller.state.phase).toBe('error');
    expect(await controller.retry()).toBe(true);
    expect(controller.state.phase).toBe('saved');
    expect(attempts).toBe(2);
  });
});
