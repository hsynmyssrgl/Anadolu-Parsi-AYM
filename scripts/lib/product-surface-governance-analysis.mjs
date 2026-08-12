import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const readText = async (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse((await readText(path)).replace(/^\uFEFF/u, ''));

const listRendererSources = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return listRendererSources(path);
    if (!entry.isFile() || !/\.(?:ts|tsx)$/u.test(entry.name) || entry.name.endsWith('.d.ts')) return [];
    return [path];
  }));
  return nested.flat();
};

const exactKey = (item) => `${item.method}\u0000${item.channel}`;

export const validateCompleteRequirement = (requirement) => {
  const failures = [];
  if (requirement?.status !== 'COMPLETE') failures.push(`${requirement?.id ?? 'UNKNOWN'} is not COMPLETE`);
  const chainEntries = Object.entries(requirement?.chain ?? {});
  if (chainEntries.length !== 13) failures.push(`${requirement?.id ?? 'UNKNOWN'} chain does not contain 13 fields`);
  for (const [name, value] of chainEntries) {
    if (value !== true) failures.push(`${requirement?.id ?? 'UNKNOWN'} chain.${name} is not true`);
  }
  return Object.freeze({ passed: failures.length === 0, failures: Object.freeze(failures) });
};

export const compareProductSurfaceInventory = ({ actualRoutes, actualUnusedApis, inventory }) => {
  const failures = [];
  const expectedRouteKeys = (inventory.routes ?? []).map((item) => `${item.id}\u0000${item.groupId}\u0000${item.kind}`).sort();
  const actualRouteKeys = actualRoutes.map((item) => `${item.id}\u0000${item.groupId}\u0000${item.kind}`).sort();
  if (JSON.stringify(actualRouteKeys) !== JSON.stringify(expectedRouteKeys)) failures.push('canonical route inventory drifted');

  const expectedUnused = (inventory.unusedRendererApis ?? []).map(exactKey).sort();
  const actualUnused = actualUnusedApis.map(exactKey).sort();
  if (JSON.stringify(actualUnused) !== JSON.stringify(expectedUnused)) failures.push('unused renderer API inventory drifted');
  return Object.freeze({ passed: failures.length === 0, failures: Object.freeze(failures) });
};

export const analyzeProductSurfaceGovernance = async (root = process.cwd()) => {
  const absolute = (path) => resolve(root, path);
  const [inventory, registry, appSource, domainSource, mainSource, preloadSource, ipcPolicySource] = await Promise.all([
    readJson(absolute('config/32-w-b0-03-b0-04-product-surface-governance-inventory.json')),
    readJson(absolute('config/accepted-scope-registry.json')),
    readText(absolute('apps/desktop/src/renderer/App.tsx')),
    readText(absolute('packages/domain/src/product-surface-governance.ts')),
    readText(absolute('apps/desktop/src/main/main.ts')),
    readText(absolute('apps/desktop/src/main/preload.ts')),
    readText(absolute('apps/desktop/src/main/ipc-integration-policy.ts'))
  ]);
  const rendererFiles = await listRendererSources(absolute('apps/desktop/src/renderer'));
  const rendererSource = (await Promise.all(rendererFiles.map(readText))).join('\n');
  const failures = [];
  let checks = 0;
  const check = (condition, message) => {
    checks += 1;
    if (!condition) failures.push(message);
  };

  const preloadPairs = [...preloadSource.matchAll(/\b([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?\([^\n]*?\)\s*(?::[^=\n]+)?=>\s*(?:unwrapIpcTransportResponse\()?invoke\(\s*['"]([^'"]+)['"]/gu)]
    .map((match) => Object.freeze({ method: match[1], channel: match[2] }));
  const registeredChannels = new Set([...mainSource.matchAll(/registerIpcHandler\(\s*['"]([^'"]+)['"]/gu)].map((match) => match[1]));
  const registeredPreloadPairs = preloadPairs.filter((item) => registeredChannels.has(item.channel));
  const unusedRendererApis = registeredPreloadPairs.filter((item) => {
    const expression = new RegExp(`\\.${item.method}\\b`, 'gu');
    return !expression.test(rendererSource);
  });

  const routeBlock = domainSource.slice(
    domainSource.indexOf('export const PRODUCT_NAVIGATION_ROUTES'),
    domainSource.indexOf('export type ProductScreenId')
  );
  const domainRoutes = [...routeBlock.matchAll(/id:\s*'([^']+)'[^\n]+groupId:\s*'([^']+)'[^\n]+kind:\s*'([^']+)'/gu)]
    .map((match) => Object.freeze({ id: match[1], groupId: match[2], kind: match[3] }));
  const routeIds = domainRoutes.map((item) => item.id);
  const literalDispatchRoutes = [...appSource.slice(appSource.indexOf('let screen: ReactNode;'), appSource.indexOf('return (', appSource.indexOf('let screen: ReactNode;'))).matchAll(/(?:if|else if)\s*\(\s*active\s*===\s*'([^']+)'\s*\)\s*screen\s*=/gu)]
    .map((match) => match[1]);
  const dispatchedRoutes = [...literalDispatchRoutes, ...(appSource.includes("active === SECURITY_CENTER_ROUTE) screen =") ? ['security'] : [])];

  const inventoryComparison = compareProductSurfaceInventory({
    actualRoutes: domainRoutes,
    actualUnusedApis: unusedRendererApis,
    inventory
  });
  check(inventoryComparison.passed, inventoryComparison.failures.join('; '));
  check(new Set(routeIds).size === 22 && routeIds.length === 22, 'domain must expose 22 unique routes');
  check(domainRoutes.filter((item) => item.kind === 'product-module').length === 17, 'domain must expose 17 product modules');
  check(domainRoutes.filter((item) => item.kind === 'governance-surface').length === 5, 'domain must expose 5 governance surfaces');
  check(inventory.routeCounts?.productModules === 17 && inventory.routeCounts?.governanceSurfaces === 5 && inventory.routeCounts?.total === 22, 'inventory route counts must be 17 + 5 = 22');
  check(appSource.includes('PRODUCT_NAVIGATION_ROUTES.map') && appSource.includes('PRODUCT_NAVIGATION_GROUPS.map'), 'renderer menu must derive from shared navigation constants');
  check(!/type ScreenId\s*=\s*\n\s*\|/u.test(appSource) && !/const navItems[^=]*=\s*\[/u.test(appSource), 'renderer must not redeclare route or menu literals');
  check(new Set(dispatchedRoutes).size === 22 && routeIds.every((id) => dispatchedRoutes.includes(id)), 'each canonical route must have exactly one screen dispatch');
  check(appSource.includes('else screen = <PlaceholderScreen'), 'unknown route must fail to the explicit placeholder');
  check(preloadPairs.length === new Set(preloadPairs.map(exactKey)).size, 'preload method/channel pairs must be unique');
  check(unusedRendererApis.length === 14, `expected 14 unused renderer APIs, found ${unusedRendererApis.length}`);
  check(inventory.unusedRendererApiCounts?.classified === 14 && inventory.unusedRendererApiCounts?.unresolved === 0, 'inventory must classify 14 APIs with zero unresolved');
  check((inventory.unusedRendererApis ?? []).every((item) => ['BACKGROUND_OPERATIONAL', 'DIAGNOSTIC_OPERATOR_API', 'SUPERSEDED_READ_MODEL'].includes(item.classification)), 'unused API classifications must use the closed taxonomy');
  check((inventory.unusedRendererApis ?? []).every((item) => domainSource.includes(`method: '${item.method}'`) && domainSource.includes(`channel: '${item.channel}'`) && domainSource.includes(`classification: '${item.classification}'`)), 'domain classification contract must contain every inventory API');
  check(mainSource.includes("registerIpcHandler('system:getProductSurfaceGovernance'") && preloadSource.includes("getProductSurfaceGovernance:():Promise<ProductSurfaceGovernanceView>=>invoke('system:getProductSurfaceGovernance')"), 'product governance IPC chain must be complete');
  check(ipcPolicySource.includes("case 'system:getProductSurfaceGovernance':"), 'product governance IPC must be zero-argument policy guarded');
  check(appSource.includes('getProductSurfaceGovernance().then(setProductSurfaceGovernance)') && appSource.includes('B0-03 / B0-04 · ürün yüzeyi gerçeklik kapısı'), 'renderer must consume and display the governance boundary');

  const b003 = registry.requirements?.find((item) => item.id === 'B0-03');
  const b004 = registry.requirements?.find((item) => item.id === 'B0-04');
  const b901 = registry.requirements?.find((item) => item.id === 'B9-01');
  const b003Chain = validateCompleteRequirement(b003);
  const b004Chain = validateCompleteRequirement(b004);
  check(b003Chain.passed, b003Chain.failures.join('; '));
  check(b004Chain.passed, b004Chain.failures.join('; '));
  check(b901?.status !== 'COMPLETE', 'B9-01 must remain open until every Bronze closure gate passes');

  const maliciousChain = validateCompleteRequirement({ ...b003, status: 'COMPLETE', chain: { ...b003?.chain, evidence: false } });
  const fakeUnused = compareProductSurfaceInventory({ actualRoutes: domainRoutes, actualUnusedApis: [...unusedRendererApis, { method: 'fakeApi', channel: 'fake:api' }], inventory });
  const missingRoute = compareProductSurfaceInventory({ actualRoutes: domainRoutes.slice(1), actualUnusedApis: unusedRendererApis, inventory });
  const selfTests = Object.freeze({
    incompleteCompleteChainRejected: !maliciousChain.passed,
    unclassifiedApiRejected: !fakeUnused.passed,
    missingRouteRejected: !missingRoute.passed
  });
  check(Object.values(selfTests).every(Boolean), 'fail-closed self-tests must reject chain, API and route mutations');

  return Object.freeze({
    schemaVersion: 1,
    requirements: Object.freeze(['B0-03', 'B0-04']),
    enforcement: 'fail-closed',
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checksPassed: checks - failures.length,
    checksFailed: failures.length,
    failures: Object.freeze(failures),
    productModuleCount: domainRoutes.filter((item) => item.kind === 'product-module').length,
    governanceSurfaceCount: domainRoutes.filter((item) => item.kind === 'governance-surface').length,
    routeCount: domainRoutes.length,
    menuEntryCount: routeIds.length,
    renderedScreenCount: new Set(dispatchedRoutes).size,
    preloadPairCount: preloadPairs.length,
    registeredPreloadPairCount: registeredPreloadPairs.length,
    classifiedUnusedRendererApiCount: inventory.unusedRendererApis?.length ?? 0,
    unresolvedUnusedRendererApiCount: inventoryComparison.passed ? 0 : Math.max(0, unusedRendererApis.length - (inventory.unusedRendererApis?.length ?? 0)),
    unusedRendererApis: Object.freeze(unusedRendererApis),
    selfTests,
    b901CompletedByThisPackage: false,
    databaseMigrationRequired: false,
    generatedAt: new Date().toISOString()
  });
};
