import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PRODUCT_NAVIGATION_ROUTES } from '@ppt/domain';
import { AsyncStatePanel } from '../src/renderer/form-ux';
import { ROUTE_ASYNC_STATE_CATALOG, ROUTE_ASYNC_STATE_KINDS, resolveRouteAsyncState } from '../src/renderer/route-async-state';

const inventory = JSON.parse(readFileSync('config/33-n-b7-15-route-async-state-inventory.json', 'utf8')) as {
  routeCount: number;
  statesPerRoute: string[];
  routes: Array<{ id: string; states: string[] }>;
  governedStateMappings: number;
};

describe('33-N B7-15 governed route async-state inventory', () => {
  it('binds all 22 canonical routes to exact empty loading offline error and retry evidence', () => {
    const expectedStates = ['empty', 'loading', 'offline', 'error', 'retry'];
    expect(inventory.routeCount).toBe(22);
    expect(inventory.statesPerRoute).toEqual(expectedStates);
    expect(inventory.routes.map((route) => route.id)).toEqual(PRODUCT_NAVIGATION_ROUTES.map((route) => route.id));
    expect(inventory.routes.every((route) => JSON.stringify(route.states) === JSON.stringify(expectedStates))).toBe(true);
    expect(new Set(inventory.routes.flatMap((route) => route.states.map((state) => `${route.id}:${state}`))).size).toBe(110);
    expect(inventory.governedStateMappings).toBe(110);
    expect(ROUTE_ASYNC_STATE_KINDS).toEqual(expectedStates);
    expect(ROUTE_ASYNC_STATE_CATALOG).toHaveLength(110);
    expect(new Set(ROUTE_ASYNC_STATE_CATALOG.map((item) => `${item.routeId}:${item.state}`)).size).toBe(110);
  });

  it('proves meaningful shared behavior for every route-state mapping', () => {
    for (const route of inventory.routes) {
      for (const state of ROUTE_ASYNC_STATE_KINDS) {
        const resolved = resolveRouteAsyncState(route.id as never, state);
        expect(resolved.routeId).toBe(route.id);
        expect(resolved.title).toContain(PRODUCT_NAVIGATION_ROUTES.find((item) => item.id === route.id)!.label);
        expect(resolved.message.length).toBeGreaterThan(25);
        expect(resolved.busy).toBe(state === 'loading' || state === 'retry');
        expect(resolved.announce).toBe(state === 'offline' || state === 'error' ? 'assertive' : 'polite');
        expect(resolved.retry.visible).toBe(state === 'offline' || state === 'error');
        expect(resolved.retry.returnFocusToMain).toBe(state === 'offline' || state === 'error' || state === 'retry');
        const html = renderToStaticMarkup(createElement(AsyncStatePanel, {
          state: resolved.panelState,
          title: resolved.title,
          message: resolved.message,
          ...(resolved.retry.visible ? { retryLabel: resolved.retry.label, onRetry: () => undefined } : {})
        }));
        expect(html).toContain(`data-async-state="${resolved.panelState}"`);
        expect(html).toContain(resolved.message);
        if (resolved.busy) expect(html).toContain('aria-busy="true"');
        if (state === 'offline' || state === 'error') {
          expect(html).toContain('role="alert"');
          expect(html).toContain('Yeniden dene');
        }
      }
    }
  });

  it('fails closed for an unknown route instead of returning generic copy', () => {
    expect(() => resolveRouteAsyncState('unknown-route' as never, 'empty')).toThrow(/bilinmeyen rota/u);
  });
});
