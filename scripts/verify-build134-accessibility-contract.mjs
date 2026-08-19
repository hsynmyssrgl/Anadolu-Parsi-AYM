import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const reportPath = resolve(process.argv[2] ?? 'artifacts/validation/build134-accessibility-contract.json');
const [rootPackage, desktopPackage, appMeta, app, ui, accessibility, styles, typography] = await Promise.all([
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('apps/desktop/package.json', 'utf8').then(JSON.parse),
  readFile('packages/domain/src/app-meta.ts', 'utf8'),
  readFile('apps/desktop/src/renderer/App.tsx', 'utf8'),
  readFile('apps/desktop/src/renderer/ui.tsx', 'utf8'),
  readFile('apps/desktop/src/renderer/accessibility.ts', 'utf8'),
  readFile('apps/desktop/src/renderer/styles.css', 'utf8'),
  readFile('apps/desktop/src/renderer/typography.css', 'utf8')
]);

const failures = [];
let assertions = 0;
const verify = (condition, message) => {
  assertions += 1;
  if (!condition) failures.push(message);
};

const activePackageVersion = rootPackage.version;
const activeDisplayVersion = appMeta.match(/version: '([^']+)'/)?.[1] ?? '';
const activeStage = appMeta.match(/stage: '([^']+)'/)?.[1] ?? '';
verify(desktopPackage.version === activePackageVersion, `desktop package version=${desktopPackage.version}`);
verify(appMeta.includes(`version: '${activeDisplayVersion}'`), 'active application version marker is missing');
verify(appMeta.includes(`packageVersion: '${activePackageVersion}'`), 'active package version marker is missing');
verify(appMeta.includes(`stage: '${activeStage}'`) && activeStage.length > 0, 'active stage marker is missing');
verify(rootPackage.scripts?.['verify:build134:accessibility'] === 'node scripts/verify-build134-accessibility-contract.mjs', 'Build 134 contract command is missing');
verify(rootPackage.scripts?.['verify:accessibility:runtime'] === 'node scripts/verify-build134-accessibility-runtime.mjs', 'Build 134 runtime command is missing');

for (const marker of [
  "type TextScale = 'standard' | 'large' | 'extra-large'",
  'parseAccessibilityPreferences',
  'serializeAccessibilityPreferences',
  'nextRovingIndex',
  'accessibilityAnnouncement'
]) verify(accessibility.includes(marker), `accessibility helper missing: ${marker}`);

verify(app.includes("readBootstrapPreference(storage, 'ppt-accessibility')"), 'safe bootstrap accessibility preference read is missing');
verify(app.includes("writeBootstrapPreference(storage,'ppt-accessibility',serializeAccessibilityPreferences(accessibility))"), 'safe bootstrap accessibility preference persistence is missing');
verify(app.includes('window.pardus!.updateAccessibilityPreferences(command)'), 'governed accessibility preference persistence is missing');
verify(app.includes('data-text-scale={accessibility.textScale}'), 'text scale data binding is missing');
verify(app.includes("data-high-contrast={accessibility.highContrast ? 'true' : 'false'}"), 'high contrast data binding is missing');
verify(app.includes("data-reduce-motion={accessibility.reduceMotion ? 'true' : 'false'}"), 'reduced motion data binding is missing');
verify(app.includes('Erişilebilirlik ve görünüm merkezi</h3>'), 'accessibility settings panel is missing');
verify(app.includes('Metin görünümü<select'), 'text scale control is missing');
verify(app.includes('Yüksek kontrast'), 'high contrast control is missing');
verify(app.includes('Hareketi azalt'), 'reduced motion control is missing');
verify(app.includes('aria-live="polite" aria-atomic="true"'), 'route live-region announcement is missing');
verify(app.includes('mainContentRef.current?.focus({ preventScroll: true })'), 'route focus management is missing');
verify(app.includes('aria-labelledby="current-section-title"'), 'main landmark naming is missing');
verify(app.includes('aria-current={active === item.id ? \'page\' : undefined}'), 'active navigation semantics are missing');
verify(app.includes('aria-controls="family-menu"'), 'family popover relationship is missing');
verify(app.includes('aria-controls="notification-menu"'), 'notification popover relationship is missing');
verify(app.includes('aria-controls="profile-menu"'), 'profile menu relationship is missing');
verify(app.includes('role="menuitem"'), 'profile menu item semantics are missing');
verify(app.includes('role="listbox"'), 'command result listbox semantics are missing');
verify(app.includes('role="option"'), 'command option semantics are missing');
verify(app.includes('aria-selected={searchActiveIndex===index}'), 'command selected state is missing');
verify(app.includes("['ArrowDown','ArrowUp','Home','End']"), 'command roving keyboard keys are missing');
verify(app.includes("event.key==='Enter'"), 'command Enter activation is missing');
verify(app.includes('previousSearchFocusRef.current?.focus()'), 'command focus restoration is missing');
verify(app.includes("event.key !== 'Tab'"), 'command focus trap is missing');
verify(app.includes('aria-label="Arşiv kategorisi"'), 'archive category control label is missing');
verify(app.includes('aria-label="Arşiv hassasiyet seviyesi"'), 'archive sensitivity control label is missing');
verify(app.includes('aria-label="Arşiv etiketi"'), 'archive tag control label is missing');
verify(app.includes('aria-label="Arşiv MIME türü"'), 'archive MIME control label is missing');

verify(ui.includes("type={type ?? 'button'}"), 'safe default button type is missing');
verify(ui.includes('aria-live={urgent ? \'assertive\' : \'polite\'}'), 'status live-region policy is missing');
verify(ui.includes('aria-atomic="true"'), 'atomic status announcement is missing');
verify(ui.includes('export function VisuallyHidden'), 'visually hidden utility is missing');
verify(ui.includes("event.key === 'Escape'"), 'modal Escape close behavior was lost');
verify(ui.includes("event.key !== 'Tab'"), 'modal focus trap was lost');
verify(ui.includes('previousFocus?.focus()'), 'modal focus restoration was lost');

for (const marker of [
  '/* Build 134 — accessibility and critical keyboard-flow contract */',
  '.visually-hidden',
  '.skip-link:focus-visible',
  ':focus-visible',
  '[data-text-scale="large"]',
  '[data-text-scale="extra-large"]',
  '[data-high-contrast="true"]',
  '[data-reduce-motion="true"]',
  '@media (prefers-reduced-motion: reduce)',
  '@media (prefers-contrast: more)',
  '@media (forced-colors: active)',
  '.toggle-row',
  '[aria-selected="true"]'
]) verify(styles.includes(marker), `accessibility style missing: ${marker}`);

verify(styles.includes('min-height: 44px;'), 'minimum target height is missing');
verify(typography.includes('--font-size-body: 17px;'), 'Build 126 typography baseline was lost');
verify(styles.includes('outline: 3px solid'), 'visible focus indicator is missing');
verify(!styles.includes('outline: none !important'), 'focus indicators are globally suppressed');

const report = {
  schemaVersion: 1,
  product: 'ParsYuva AYM',
  featureBuild: 134,
  applicationVersion: activeDisplayVersion,
  packageVersion: activePackageVersion,
  stage: activeStage,
  scope: 'Persistent accessibility preferences, visible focus, route announcements, keyboard command navigation, modal continuity and forced-colors support',
  assertions,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 134 accessibility contract: ${report.status} (${assertions} assertions)`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
