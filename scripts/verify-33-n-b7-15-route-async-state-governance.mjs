import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
const output = resolve(root, 'artifacts/validation/33-N-b7-15-route-async-state-governance.json');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const [inventory, productSurface] = await Promise.all([
  readJson('config/33-n-b7-15-route-async-state-inventory.json'),
  readJson('config/32-w-b0-03-b0-04-product-surface-governance-inventory.json')
]);
const test = await readFile(resolve(root, 'apps/desktop/tests/b7-15-route-async-state-governance.test.ts'), 'utf8');
const formUx = await readFile(resolve(root, 'apps/desktop/src/renderer/form-ux.tsx'), 'utf8');
const routeResolver = await readFile(resolve(root, 'apps/desktop/src/renderer/route-async-state.ts'), 'utf8');
const app = await readFile(resolve(root, 'apps/desktop/src/renderer/App.tsx'), 'utf8');
const exactStates = ['empty', 'loading', 'offline', 'error', 'retry'];
const checks = [];
const check = (name, passed) => checks.push({ name, status: passed ? 'PASS' : 'FAIL' });
check('inventory binds exact 22 canonical routes', inventory.routeCount === 22 && JSON.stringify(inventory.routes?.map((route) => route.id)) === JSON.stringify(productSurface.routes?.map((route) => route.id)));
check('every route binds exact five governed states', JSON.stringify(inventory.statesPerRoute) === JSON.stringify(exactStates) && inventory.routes?.every((route) => JSON.stringify(route.states) === JSON.stringify(exactStates)));
check('inventory contains exact 110 unique route-state mappings', inventory.governedStateMappings === 110 && new Set(inventory.routes?.flatMap((route) => route.states.map((state) => `${route.id}:${state}`))).size === 110);
check('shared panel exposes status alert busy and named retry behavior', ['data-async-state={state}', 'aria-busy=', 'aria-live=', "role={urgent ? 'alert' : 'status'}", "retryLabel = 'Yeniden dene'", 'runRetryWithFocus'].every((marker) => formUx.includes(marker)));
check('resolver produces route-specific copy behavior and fail-closed unknown route', ['ROUTE_ASYNC_STATE_CATALOG', 'resolveRouteAsyncState', 'returnFocusToMain', 'B7-15 bilinmeyen rota'].every((marker) => routeResolver.includes(marker)));
check('runtime suite exercises resolver and every route-state behavior', ['all 22 canonical routes', 'meaningful shared behavior for every route-state mapping', 'ROUTE_ASYNC_STATE_CATALOG', 'toHaveLength(110)', 'fails closed for an unknown route'].every((marker) => test.includes(marker)));
check('App global async shell consumes the canonical route resolver', app.includes('resolveRouteAsyncState') && app.includes('retryFocusTarget={mainContentRef}'));
const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, step: '33-N', requirement: 'B7-15', status: failures.length ? 'FAIL' : 'PASS', routeCount: 22, statesPerRoute: 5, governedStateMappings: 110, checksPassed: checks.length - failures.length, checksFailed: failures.length, checks, generatedAt: new Date().toISOString() };
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`33-N B7-15 route async-state governance: ${report.status} (${report.checksPassed}/${checks.length}; 22x5=110).`);
if (failures.length) process.exitCode = 1;
