import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const reportPath = resolve(process.argv[2] ?? 'artifacts/validation/build124-product-and-feature-contract.json');
const [rootPackage, desktopPackage, appMeta, renderer, styles, main, migrations, license, icon] = await Promise.all([
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('apps/desktop/package.json', 'utf8').then(JSON.parse),
  readFile('packages/domain/src/app-meta.ts', 'utf8'),
  readFile('apps/desktop/src/renderer/App.tsx', 'utf8'),
  readFile('apps/desktop/src/renderer/styles.css', 'utf8'),
  readFile('apps/desktop/src/main/main.ts', 'utf8'),
  readFile('packages/database/src/family-database-migrations.ts', 'utf8'),
  readFile('apps/desktop/build/LICENSE_TR.txt', 'utf8'),
  readFile('apps/desktop/build/icon.ico')
]);
const failures = [];
let assertions = 0;
const verify = (condition, message) => {
  assertions += 1;
  if (!condition) failures.push(message);
};

verify(rootPackage.version === '27.7.2026-124', `root package version=${rootPackage.version}`);
verify(desktopPackage.version === '27.7.2026-124', `desktop package version=${desktopPackage.version}`);
verify(appMeta.includes("name: 'Anadolu Parsı Aile Yaşam Merkezi'"), 'application name was not changed');
verify(appMeta.includes("version: '27.07.2026.124'"), 'application version is not Build 124');
verify(appMeta.includes("stage: 'Bronze RC2 · Aktif Geliştirme · Build 124'"), 'active stage is incorrect');
verify(desktopPackage.build?.appId === 'tr.anadoluparsi.aileyasammerkezi', 'Windows application id is incorrect');
verify(desktopPackage.build?.productName === 'Anadolu Parsı Aile Yaşam Merkezi', 'Windows product name is incorrect');
verify(desktopPackage.build?.nsis?.shortcutName === 'Anadolu Parsı Aile Yaşam Merkezi', 'shortcut name is incorrect');
verify(desktopPackage.build?.artifactName?.startsWith('Anadolu-Parsi-Aile-Yasam-Merkezi-'), 'installer artifact name is incorrect');
verify(license.startsWith('ANADOLU PARSI AİLE YAŞAM MERKEZİ'), 'license identity is stale');
verify(icon.byteLength > 4096, 'new Windows icon is missing or too small');
verify(createHash('sha256').update(icon).digest('hex') === '82d9eced2ed639e6ef52c407995ac0ade87fe8f4ccea7103a28cd683a4a1b9be', 'Windows icon differs from generated Build 124 brand asset');

verify(main.includes("const legacyProductName = 'Panthera pardus tulliana Aile'"), 'legacy user-data source is not recognized');
verify(main.includes("const currentProductName = 'Anadolu Parsı Aile Yaşam Merkezi'"), 'new user-data destination is missing');
verify(main.includes('cpSync(legacyUserDataPath, currentUserDataPath'), 'non-destructive user-data migration is missing');
verify(!main.includes('seed: true'), 'production runtime must not enable a built-in seed');
verify(migrations.includes("createMigrationDefinition(14, 'remove_known_synthetic_profiles'"), 'synthetic profile cleanup migration is missing');
for (const id of ['person-test-1','person-test-2','person-test-3','person-test-4','person-test-5','person-test-6']) {
  verify(migrations.includes(`('${id}')`) || migrations.includes(`'${id}'`), `known synthetic id is not covered: ${id}`);
}

verify(renderer.includes("import brandMarkUrl from './assets/brand-mark.png'"), 'new brand mark is not used by the renderer');
verify(renderer.includes('<strong>Anadolu Parsı</strong><small>Aile Yaşam Merkezi</small>'), 'sidebar identity is stale');
verify(renderer.includes('getGenealogyInsights().then(setInsights)'), 'genealogy insights are not surfaced');
verify(renderer.includes('createArchiveCategory'), 'archive category creation is not surfaced');
verify(renderer.includes('listTrustedDevices().then(setDevices)'), 'trusted device list is not surfaced');
verify(renderer.includes('trustCurrentDevice'), 'trust current device action is not surfaced');
verify(renderer.includes('runAutomationRules()'), 'manual automation execution is not surfaced');
verify(renderer.includes('listAutomationRuns().then(setRuns)'), 'automation run history is not surfaced');
verify(renderer.includes('exportSystemPdf()'), 'PDF report action is not surfaced');
verify(renderer.includes('window.pardus.updateAccount'), 'profile role/status update is not surfaced');
verify(renderer.includes('<SystemManagementScreen auth={auth}/>'), 'security center is not connected to Settings');
verify(!renderer.includes('DEFAULT_FAMILY_SEED'), 'production UI/source must not expose a built-in family seed');
verify(!renderer.includes('MVP-2 planında') && !renderer.includes('Silver kapsamı'), 'stale placeholder module promises remain');
verify(styles.includes('/* Build 124 — shared Apple-inspired component language */'), 'shared Apple-inspired component layer is missing');
for (const selector of ['.security-grid', '.insight-grid', '.profile-admin-row', '.auth-brand>img']) {
  verify(styles.includes(selector), `shared visual style is missing: ${selector}`);
}

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  build: 124,
  version: '27.07.2026.124',
  packageVersion: '27.7.2026-124',
  stage: 'Bronze RC2 Active Development',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  assertions,
  failures,
  verifiedCapabilities: [
    'renamed-product-and-installer-identity',
    'non-destructive-legacy-user-data-path-migration',
    'known-synthetic-data-removal',
    'new-brand-icon',
    'shared-apple-inspired-component-language',
    'genealogy-insights',
    'archive-category-creation',
    'trusted-device-management',
    'manual-automation-and-run-history',
    'pdf-report-export',
    'profile-role-and-status-management'
  ],
  icon: {
    bytes: (await stat('apps/desktop/build/icon.ico')).size,
    sha256: createHash('sha256').update(icon).digest('hex')
  },
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 124 product and feature contract: ${report.status} (${assertions} assertions)`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
