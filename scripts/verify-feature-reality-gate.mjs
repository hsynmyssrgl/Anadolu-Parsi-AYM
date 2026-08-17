import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  analyzeProductSurfaceGovernance,
  validateCompleteRequirement
} from './lib/product-surface-governance-analysis.mjs';

const noWrite = process.argv.includes('--no-write');
const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const failures = [];
let checks = 0;
const check = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};
const ids = new Set();
const validStatuses = new Set([
  'NOT_IMPLEMENTED',
  'FOUNDATION_STARTED',
  'PARTIAL',
  'LEGACY_IMPLEMENTED_UNVERIFIED',
  'COMPLETE'
]);

for (const requirement of registry.requirements ?? []) {
  check(Boolean(requirement.id), 'missing id');
  check(!ids.has(requirement.id), `duplicate ${requirement.id}`);
  ids.add(requirement.id);
  check(validStatuses.has(requirement.status), `${requirement.id} invalid status ${requirement.status}`);
  check(Boolean(requirement.title), `${requirement.id} missing title`);
  check(Boolean(requirement.acceptance), `${requirement.id} missing acceptance`);
  if (requirement.status === 'COMPLETE') {
    const completeChain = validateCompleteRequirement(requirement);
    check(completeChain.passed, completeChain.failures.join('; '));
  }
}

check(registry.requirementCount === ids.size, `requirementCount=${registry.requirementCount}/${ids.size}`);
check(registry.mode === 'ACTIVE_BRONZE_DEVELOPMENT', 'registry mode must be active Bronze');

const maliciousComplete = validateCompleteRequirement({
  id: 'FEATURE-REALITY-SELF-TEST',
  status: 'COMPLETE',
  chain: {
    decision: true,
    domain: true,
    schema: true,
    migration: true,
    useCase: true,
    repository: true,
    policy: true,
    apiOrIpc: true,
    ui: true,
    menu: true,
    targetedTest: true,
    documentation: true,
    evidence: false
  }
});
check(!maliciousComplete.passed, 'Feature Reality Gate self-test did not reject a false COMPLETE chain');

const productSurface = await analyzeProductSurfaceGovernance();
check(productSurface.status === 'PASS', `product surface governance failed: ${productSurface.failures.join('; ')}`);
check(productSurface.routeCount === productSurface.menuEntryCount && productSurface.menuEntryCount === productSurface.renderedScreenCount, 'route/menu/screen counts must remain equal');
check(productSurface.classifiedUnusedRendererApiCount === 14 && productSurface.unresolvedUnusedRendererApiCount === 0, 'unused renderer API classification must remain 14 classified / 0 unresolved');

const incompleteRequired = (registry.requirements ?? [])
  .filter((requirement) => requirement.priority === 'P0' || requirement.priority === 'P1')
  .filter((requirement) => requirement.status !== 'COMPLETE');
const silverReady = incompleteRequired.length === 0;
const report = {
  schemaVersion: 2,
  release: registry.release,
  requirements: ids.size,
  incompleteRequired: incompleteRequired.length,
  silverReady,
  enforcement: 'fail-closed',
  productSurface: {
    productModules: productSurface.productModuleCount,
    governanceSurfaces: productSurface.governanceSurfaceCount,
    routes: productSurface.routeCount,
    menuEntries: productSurface.menuEntryCount,
    renderedScreens: productSurface.renderedScreenCount,
    classifiedUnusedRendererApis: productSurface.classifiedUnusedRendererApiCount,
    unresolvedUnusedRendererApis: productSurface.unresolvedUnusedRendererApiCount,
    selfTests: productSurface.selfTests
  },
  checksPassed: checks - failures.length,
  checksFailed: failures.length,
  status: failures.length ? 'FAIL' : 'PASS',
  failures,
  generatedAt: new Date().toISOString()
};
if (!noWrite) {
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/feature-reality-gate.json', `${JSON.stringify(report, null, 2)}\n`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Feature Reality Gate: PASS honesty / ${ids.size} requirements / surface 17+5=22 / unused API 14+0 / Silver ${silverReady ? 'READY' : 'BLOCKED'}.`);
