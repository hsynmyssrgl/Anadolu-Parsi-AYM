import { mkdir, readFile, writeFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');
const [installer, desktopPackageText, app, styles, accessibility, main, authUseCases, dataStoreTest, externalProtection, metadataText, registryText] = await Promise.all([
  read('apps/desktop/build/installer.nsh'), read('apps/desktop/package.json'), read('apps/desktop/src/renderer/App.tsx'),
  read('apps/desktop/src/renderer/styles.css'), read('apps/desktop/src/renderer/accessibility.ts'), read('apps/desktop/src/main/main.ts'),
  read('packages/application/src/auth-use-cases.ts'), read('apps/desktop/tests/data-store.test.ts'),
  read('scripts/protect-authoritative-source-external.mjs'), read('repository-metadata.json'), read('config/canonical-rule-registry.json')
]);
const desktopPackage = JSON.parse(desktopPackageText);
const metadata = JSON.parse(metadataText);
const registry = JSON.parse(registryText);
const checks = [];
const check = (id, condition, evidence) => checks.push({ id, status: condition ? 'PASS' : 'FAIL', evidence });

check('CUSTOM_BRANDED_INSTALLER', installer.includes('!macro customWelcomePage') && installer.includes('Page custom AymWelcomePageCreate AymWelcomePageLeave') && installer.includes('PPT_INSTALLER_CHANNEL_BITMAP'), 'custom NSIS welcome and release palette bitmap');
check('DECORATIVE_MOTION_NOT_PROGRESS', installer.includes('nsDialogs::CreateTimer AymWelcomeAnimate') && installer.includes('This page performs no installation work') && installer.includes('MUI_PAGE_CUSTOMFUNCTION_SHOW AymInstallFilesShow'), 'decorative welcome timer is separate from native install-files progress');
check('UPGRADE_PRESERVES_DATA', installer.includes('${If} ${isUpdated}') && installer.includes('${OrIf} ${Silent}') && installer.includes('Goto aym_uninstall_done') && desktopPackage.build?.nsis?.deleteAppDataOnUninstall === false, 'upgrade and silent uninstall paths bypass personal-data removal');
check('RESPONSIVE_FIRST_FAMILY', app.includes('className="auth-shell"') && styles.includes('@media(max-width:900px)') && styles.includes('.auth-shell{grid-template-columns:1fr}') && styles.includes('overflow-x: clip'), '900px breakpoint, one-column auth shell and horizontal clipping boundary');
check('THREE_PARS_FAMILY', ['auth-pars-adult-male','auth-pars-adult-female','auth-pars-child'].every((marker) => app.includes(marker) && styles.includes(marker)), 'male, female and child pars figures are present');
check('REDUCED_MOTION', styles.includes('@media(prefers-reduced-motion:reduce)') && styles.includes('.auth-family-pars .auth-pars { animation:none!important;transition:none!important; }'), 'family pars motion is disabled under reduced-motion');
check('VOICE_LANGUAGE_AND_FALLBACK', accessibility.includes('selectPreferredFemaleNarrationVoice') && accessibility.includes('languageVoices') && accessibility.includes('??languageVoices[0]'), 'same-language female preference with same-language installed voice fallback');
check('WINDOW_AND_TRAY_ICONS', main.includes("new Tray(join(currentDir, 'tray-icon.png'))") && main.includes("icon: join(currentDir, 'window-icon.ico')") && main.includes('titleBarOverlay:'), 'dedicated tray and window icons plus custom title-bar overlay');
check('ATOMIC_FIRST_FAMILY_SQLITE', authUseCases.includes('this.unitOfWork.execute') && authUseCases.includes('seedInitialAdminFamily') && authUseCases.includes('linkInitialAdminMembership') && dataStoreTest.includes('setup_admin_injected_failure') && dataStoreTest.includes('families: 0') && dataStoreTest.includes('families: 1'), 'first-family setup is one unit of work with rollback and recovery regression');
check('CLEAN_ALL_WORKSPACE_PACKAGE', desktopPackage.scripts?.['package:win:local-test']?.includes('clean-stale-windows-installers.mjs') && desktopPackage.scripts?.['package:win:local-test']?.includes('run build:packages') && desktopPackage.scripts?.['package:win:local-test']?.includes('npm run build') && desktopPackage.scripts?.['package:win:local-test']?.includes('verify:installer'), 'local package chain cleans, rebuilds all packages, builds desktop and verifies installer');
check('DYNAMIC_EXTERNAL_SOURCE_BACKUP', externalProtection.includes("repositoryMetadata.visibleRelease") && externalProtection.includes("requirement: 'PR-232'") && externalProtection.includes("decision: 'DEC-266'") && !externalProtection.includes('Bronze 04.08.2026.29'), 'external D source protection is bound to current metadata and DEC-266');
check('RELEASE_IDENTITY', metadata.visibleRelease === registry.effectiveRelease && registry.rules.some((rule) => rule.id === 'PR-232' && rule.state === 'ACTIVE'), 'repository release equals canonical release and PR-232 is active');

const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, release: registry.effectiveRelease, rule: 'PR-232', decision: 'DEC-266', status: failures.length ? 'FAIL' : 'PASS', checks, generatedAt: new Date().toISOString() };
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/first-family-clean-release-policy.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) { console.error(failures.map((item) => `${item.id}: ${item.evidence}`).join('\n')); process.exit(1); }
console.log(`First-family clean release policy: PASS (${checks.length} checks / ${registry.effectiveRelease}).`);
