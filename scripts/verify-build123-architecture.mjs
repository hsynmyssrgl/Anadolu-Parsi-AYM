import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};

const reportPath = resolve(option('--report', 'artifacts/validation/build123-architecture.json'));
const [rootPackage, desktopPackage, appMeta, renderer, styles, main, senderContract] = await Promise.all([
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('apps/desktop/package.json', 'utf8').then(JSON.parse),
  readFile('packages/domain/src/app-meta.ts', 'utf8'),
  readFile('apps/desktop/src/renderer/App.tsx', 'utf8'),
  readFile('apps/desktop/src/renderer/styles.css', 'utf8'),
  readFile('apps/desktop/src/main/main.ts', 'utf8'),
  readFile('scripts/verify-ipc-sender-trust-contract.mjs', 'utf8')
]);
const failures = [];
let assertions = 0;
const verify = (condition, message) => {
  assertions += 1;
  if (!condition) failures.push(message);
};

verify(rootPackage.version === '27.7.2026-123', `root package version=${rootPackage.version}`);
verify(desktopPackage.version === '27.7.2026-123', `desktop package version=${desktopPackage.version}`);
verify(appMeta.includes("version: '27.07.2026.123'"), 'application version is not Build 123');
verify(appMeta.includes("packageVersion: '27.7.2026-123'"), 'package version is not Build 123');
verify(appMeta.includes("stage: 'Bronze RC2 · Aktif Geliştirme · Build 123'"), 'active development stage is incorrect');
verify(rootPackage.scripts?.['verify:build123:ui-shell'] === 'node scripts/verify-build123-ui-shell-contract.mjs', 'Build 123 UI shell command is missing');
verify(rootPackage.scripts?.['verify:build123:architecture'] === 'node scripts/verify-build123-architecture.mjs', 'Build 123 architecture command is missing');

verify(renderer.includes('const navGroups:'), 'grouped application navigation is missing');
verify(renderer.includes('className="command-palette"'), 'command palette is missing');
verify(renderer.includes('className="menu-popover profile-popover"'), 'local profile menu is missing');
verify(renderer.includes('className="menu-popover notification-popover"'), 'notification center is missing');
verify(renderer.includes('window.pardus.logout()'), 'local logout IPC is not used');
verify(renderer.includes('data-theme={theme}'), 'theme is not applied at the application root');
verify(renderer.includes("sidebarCollapsed ? 'sidebar-collapsed' : ''"), 'collapsible shell class is missing');
verify(renderer.includes('onClick={onAddRelation}'), 'tree relationship action is not connected');
verify(styles.includes('/* Build 123 — Apple-inspired, functional application shell */'), 'Build 123 visual layer is missing');
verify(styles.includes('.command-overlay'), 'command overlay styling is missing');
verify(styles.includes('.app-shell[data-theme="light"]'), 'light theme styling is missing');

verify(main.includes('const primaryWebContentsId = window.webContents.id;'), 'Build 122 close regression fix was lost');
verify(main.includes('trustedRenderer?.webContentsId === primaryWebContentsId'), 'destroyed webContents close guard was lost');
verify(senderContract.includes("mainSource.includes('const primaryWebContentsId = window.webContents.id;')"), 'close regression evidence was lost');
verify(desktopPackage.build?.win?.target?.includes('nsis'), 'Windows NSIS target is missing');

const report = {
  schemaVersion: 1,
  product: 'Panthera pardus tulliana Aile',
  build: 123,
  version: '27.07.2026.123',
  packageVersion: '27.7.2026-123',
  stage: 'Bronze RC2 Active Development',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  assertions,
  failures,
  architecture: {
    shell: 'grouped and collapsible',
    appearance: 'dark/light local preference',
    navigation: 'command search and direct module routing',
    notifications: 'active list with acknowledgement',
    identity: 'local profile menu and logout',
    preservedSecurityBoundary: 'trusted renderer and close-safe webContents identity'
  },
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 123 architecture: ${report.status} (${assertions} assertions)`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
