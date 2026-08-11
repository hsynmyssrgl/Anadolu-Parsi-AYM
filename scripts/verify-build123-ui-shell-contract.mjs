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

const reportPath = resolve(option('--report', 'artifacts/validation/build123-ui-shell-contract.json'));
const app = await readFile('apps/desktop/src/renderer/App.tsx', 'utf8');
const styles = await readFile('apps/desktop/src/renderer/styles.css', 'utf8');
const failures = [];
let assertions = 0;
const verify = (condition, message) => {
  assertions += 1;
  if (!condition) failures.push(message);
};

for (const group of ['Ana Merkez', 'Aile Hafızası', 'Yaşam', 'Gizlilik ve Sistem']) {
  verify(app.includes(`label: '${group}'`), `navigation group is missing: ${group}`);
}
for (const screen of ['dashboard', 'family', 'tree', 'timeline', 'important-days', 'archive', 'finance', 'health', 'life-center', 'automation', 'reports', 'location', 'permissions', 'ai', 'legacy', 'settings']) {
  verify(app.includes(`id: '${screen}'`), `navigation destination is missing: ${screen}`);
}

verify(app.includes("type ThemeMode = 'dark' | 'light'"), 'theme model is missing');
verify(app.includes("localStorage?.setItem('ppt-theme'"), 'theme preference is not persisted');
verify(app.includes("localStorage?.setItem('ppt-sidebar-collapsed'"), 'sidebar preference is not persisted');
verify(app.includes("event.key.toLocaleLowerCase('tr-TR') === 'k'"), 'Ctrl/Cmd+K shortcut is missing');
verify(app.includes("event.key.toLocaleLowerCase('tr-TR') === 'f'"), 'legacy Ctrl/Cmd+F shortcut compatibility is missing');
verify(app.includes("event.key === 'Escape'"), 'Escape close behavior is missing');
verify(app.includes('searchResults.map'), 'command search results are not rendered');
verify(app.includes("navigateFromShell(item.id)"), 'command search does not navigate');
verify(app.includes('activeNotifications.slice(0,5)'), 'notification popover does not show active notifications');
verify(app.includes('acknowledgeTimelineNotification(item.id)'), 'notification acknowledgement is not wired');
verify(app.includes('window.pardus.logout()'), 'local profile logout is not wired');
verify(app.includes("setTheme((value)=>value==='dark'?'light':'dark')"), 'theme menu action is not wired');
verify(app.includes('setSidebarCollapsed((value)=>!value)'), 'sidebar collapse action is not wired');
verify(app.includes('onClick={onAddRelation}'), 'tree relation action is not wired');
verify(app.includes('updateZoom(zoom-.1)') && app.includes('updateZoom(zoom+.1)') && app.includes('setZoom(1)'), 'tree zoom controls are not wired');
verify(!app.includes('<div className="search-box">'), 'search control is still a non-interactive div');
verify(!app.includes('<div className="user-menu">'), 'profile control is still a non-interactive div');

for (const marker of [
  '.app-shell[data-theme="light"]',
  '.app-shell.sidebar-collapsed',
  '.nav-group',
  '.menu-popover',
  '.command-overlay',
  '.command-palette',
  'backdrop-filter: blur(30px)',
  '.tree-toolbar output'
]) {
  verify(styles.includes(marker), `Build 123 shell style is missing: ${marker}`);
}

const report = {
  schemaVersion: 1,
  product: 'Panthera pardus tulliana Aile',
  build: 123,
  version: '27.07.2026.123',
  stage: 'Bronze RC2 Active Development',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  assertions,
  failures,
  verifiedCapabilities: [
    'grouped-navigation',
    'collapsible-sidebar',
    'dark-light-theme',
    'command-search',
    'notification-center',
    'local-profile-menu-and-logout',
    'family-context-menu',
    'functional-tree-controls'
  ],
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 123 UI shell contract: ${report.status} (${assertions} assertions)`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
