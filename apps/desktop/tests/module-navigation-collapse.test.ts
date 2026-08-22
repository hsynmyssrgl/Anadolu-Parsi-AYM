import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRODUCT_NAVIGATION_GROUPS, PRODUCT_NAVIGATION_ROUTES } from '@ppt/domain';
import { toggleNavigationModule } from '../src/renderer/navigation.js';

const appSource=readFileSync(new URL('../src/renderer/App.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/renderer/styles.css',import.meta.url),'utf8');

describe('collapsed module navigation',()=>{
  it('starts with every module closed and behaves as a one-module accordion',()=>{
    expect(appSource).toContain('useState<string | null>(null)');
    expect(toggleNavigationModule(null,'family')).toBe('family');
    expect(toggleNavigationModule('family','family')).toBeNull();
    expect(toggleNavigationModule('family','records')).toBe('records');
  });

  it('binds every canonical group to an accessible toggle and every route to a hidden submenu',()=>{
    expect(PRODUCT_NAVIGATION_GROUPS.length).toBeGreaterThan(1);
    expect(PRODUCT_NAVIGATION_ROUTES.length).toBeGreaterThan(20);
    expect(appSource).toContain('className="nav-module-toggle" aria-expanded={expanded} aria-controls={groupItemsId}');
    expect(appSource).toContain('className="nav-module-items" hidden={!expanded}');
    expect(appSource).toContain('data-navigation-route={item.id}');
    expect(styles).toContain('.nav-module-items[hidden] { display:none; }');
  });
});
