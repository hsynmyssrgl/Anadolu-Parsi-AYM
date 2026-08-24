import { mkdir, readFile, writeFile } from 'node:fs/promises';

const failures = [];
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const dataStore = await readFile('apps/desktop/src/main/data-store.ts', 'utf8');
const main = await readFile('apps/desktop/src/main/main.ts', 'utf8');
const setupUseCase = await readFile('packages/application/src/auth-use-cases.ts', 'utf8');
const desktop = JSON.parse(await readFile('apps/desktop/package.json', 'utf8'));

check(!dataStore.includes('DEFAULT_FAMILY_SEED'), 'built-in production family seed constant exists');
check(!/if\s*\(options\.seed\s*!==\s*false\)/u.test(dataStore), 'constructor still auto-seeds production data');
check(!main.includes('seed: true'), 'production main enables seed');
check(!main.includes('seed: false'), 'production main retains legacy seed switch instead of clean default');
check(!Object.hasOwn(desktop.dependencies ?? {}, '@ppt/test-data'), 'desktop production dependencies include @ppt/test-data');
check(dataStore.includes('production startup is intentionally empty'), 'explicit empty-startup contract marker missing');
check(setupUseCase.includes("const familyName = input.command.familyName?.trim() ?? '';"), 'first family name must originate from explicit user setup');
check(!setupUseCase.includes("input.command.familyName?.trim() || 'Ailem'"), 'first family retains an implicit production default');
check(setupUseCase.includes('scope.seedInitialAdminFamily({'), 'explicit setup does not create the initial family through the application boundary');

const ledger = JSON.parse(await readFile('config/master-build-ledger.json', 'utf8'));
const report = {
  schemaVersion: 2,
  build: ledger.currentBuild,
  activeReleaseAuthority: 'config/release-ledger.json',
  checks,
  status: failures.length ? 'FAIL' : 'PASS',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(`artifacts/validation/build${ledger.currentBuild}-production-clean-data.json`, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Production clean data gate: PASS (${checks} checks).`);
