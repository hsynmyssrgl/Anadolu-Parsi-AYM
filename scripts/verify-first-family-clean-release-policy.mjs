import { mkdir, readFile, writeFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');
const [installer, installerNarration, desktopPackageText, app, styles, accessibility, main, vaultGuardPolicy, universalPolicy, repositoryPolicyScope, authUseCases, dataStoreTest, externalProtection, externalCleaner, metadataText, registryText, mutationPolicyText, baselineProducer, impactProducer, testProducer, preflight, postflight, builder, finalDelivery] = await Promise.all([
  read('apps/desktop/build/installer.nsh'), read('apps/desktop/build/installer-narration.ps1'), read('apps/desktop/package.json'),
  read('apps/desktop/src/renderer/App.tsx'), read('apps/desktop/src/renderer/styles.css'), read('apps/desktop/src/renderer/accessibility.ts'), read('apps/desktop/src/main/main.ts'),
  read('apps/desktop/src/main/vault-session-guard-policy.ts'), read('apps/desktop/src/main/desktop-universal-api-policy-enforcement.ts'),
  read('apps/desktop/src/main/desktop-repository-policy-scope.ts'),
  read('packages/application/src/auth-use-cases.ts'), read('apps/desktop/tests/data-store.test.ts'),
  read('scripts/protect-authoritative-source-external.mjs'), read('scripts/clean-stale-external-windows-installer.mjs'), read('repository-metadata.json'), read('config/canonical-rule-registry.json'),
  read('config/mutation-release-readiness-policy.json'), read('scripts/record-mutation-baseline.mjs'), read('scripts/create-mutation-impact-analysis.mjs'), read('scripts/run-mutation-test-evidence.mjs'), read('scripts/run-governed-preflight.mjs'), read('scripts/run-governed-postflight.mjs'), read('apps/desktop/scripts/run-electron-builder.mjs'), read('scripts/create-bronze-final-local-test-delivery.mjs')
]);
const desktopPackage = JSON.parse(desktopPackageText);
const metadata = JSON.parse(metadataText);
const registry = JSON.parse(registryText);
const mutationPolicy = JSON.parse(mutationPolicyText);
const checks = [];
const check = (id, condition, evidence) => checks.push({ id, status: condition ? 'PASS' : 'FAIL', evidence });

check('CUSTOM_BRANDED_INSTALLER', installer.includes('!macro customWelcomePage') && installer.includes('Page custom AymWelcomePageCreate AymWelcomePageLeave') && installer.includes('PPT_INSTALLER_CHANNEL_BITMAP'), 'custom NSIS welcome and release palette bitmap');
check('GUIDED_INSTALLER_TRANSITION', installer.includes('Function AymWelcomeTransition') && installer.includes('${NSD_CreateTimer} AymWelcomeTransition 2600') && installer.includes('${NSD_KillTimer} AymWelcomeTransition') && !installer.includes('${NSD_CreateProgressBar}') && !installer.includes('${PBM_GETPOS}') && installer.includes('MUI_PAGE_CUSTOMFUNCTION_SHOW AymInstallFilesShow'), 'welcome cycles through three information cards while native install-files remains the only progress surface');
check('UPGRADE_PRESERVES_DATA', installer.includes('${If} ${isUpdated}') && installer.includes('${OrIf} ${Silent}') && installer.includes('Goto aym_uninstall_done') && desktopPackage.build?.nsis?.deleteAppDataOnUninstall === false, 'upgrade and silent uninstall paths bypass personal-data removal');
check('CHANNEL_SIBLING_PROGRAM_ROOTS', installer.includes('!define PPT_INSTALLER_PROGRAM_DIRECTORY "ParsYuva-${PPT_INSTALLER_RELEASE_CHANNEL}"')
  && installer.includes('StrCpy $INSTDIR "$PROGRAMFILES64\\PPT\\${PPT_INSTALLER_PROGRAM_DIRECTORY}"')
  && !installer.includes('StrCpy $INSTDIR "$PROGRAMFILES64\\PPT\\ParsYuva\\${PPT_INSTALLER_CHANNEL_DIRECTORY}"')
  && installer.includes('RMDir /r "$APPDATA\\ParsYuva\\${PPT_INSTALLER_CHANNEL_DIRECTORY}"')
  && installer.includes('SetShellVarContext current')
  && (installer.match(/SetShellVarContext all/gu) ?? []).length === 2,
'release programs use sibling Program Files roots while interactive removal keeps signed-in-user AppData isolated and restores all-users context');
check('RESPONSIVE_FIRST_FAMILY', app.includes('className="auth-shell"') && styles.includes('@media(max-width:900px)') && styles.includes('.auth-shell{grid-template-columns:1fr}') && styles.includes('overflow-x: clip'), '900px breakpoint, one-column auth shell and horizontal clipping boundary');
check('SINGLE_PARS_BRAND', app.includes('className="auth-brand-mark"') && !app.includes('auth-family-pars') && !app.includes('auth-pars-child') && styles.includes('.auth-brand .auth-brand-mark'), 'first-family brand uses the restored single pars mark');
check('REDUCED_MOTION', styles.includes('@media(prefers-reduced-motion:reduce)') && styles.includes('.auth-brand .auth-brand-mark { animation:none!important;transition:none!important; }'), 'single pars motion is disabled under reduced-motion');
check('VOICE_LANGUAGE_AND_FALLBACK', accessibility.includes('selectPreferredFemaleNarrationVoice') && accessibility.includes('languageVoices') && accessibility.includes('??languageVoices[0]') && installerNarration.includes('VoiceGender]::Female') && installerNarration.includes('VoiceGender]::Male') && installerNarration.includes('$voices[0]'), 'application and installer use same-language female preference with same-language male or installed voice fallback');
const vaultGuardStart = main.indexOf('function startVaultSessionGuard');
const vaultGuardBlock = main.slice(vaultGuardStart, vaultGuardStart + 2_500);
check('VAULT_LOCK_REAUTH_PRESERVED', vaultGuardBlock.includes('resolveVaultSessionGuardAction') && vaultGuardBlock.includes("guardAction === 'defer_locked' || guardAction === 'defer_untrusted'") && vaultGuardBlock.indexOf("guardAction === 'defer_untrusted'") < vaultGuardBlock.indexOf('universalApiPolicyEnforcement().execute') && vaultGuardPolicy.includes("if (status === 'locked') return 'defer_locked'") && vaultGuardPolicy.includes("if (!trustedDevice) return 'defer_untrusted'") && vaultGuardPolicy.includes("return 'seal'") && universalPolicy.includes("VAULT_SESSION_CHECKPOINT_CHANNEL = 'system:captureVaultSessionCheckpoint'") && main.includes('registerClientApplicationServiceChannel(VAULT_SESSION_CHECKPOINT_CHANNEL)') && ['auth:beginTwoFactorSetup','auth:enableTwoFactor','auth:trustCurrentDevice'].every((channel) => universalPolicy.includes(`'${channel}'`) && repositoryPolicyScope.includes(`'${channel}'`)), 'locked and first-trust sessions defer before PEP, the internal checkpoint is registered, and both policy layers admit only the closed first-security ceremony');
check('WINDOW_AND_TRAY_ICONS', main.includes("new Tray(join(currentDir, 'tray-icon.png'))") && main.includes("icon: join(currentDir, 'window-icon.ico')") && main.includes('titleBarOverlay:'), 'dedicated tray and window icons plus custom title-bar overlay');
check('ATOMIC_FIRST_FAMILY_SQLITE', authUseCases.includes('this.unitOfWork.execute') && authUseCases.includes('seedInitialAdminFamily') && authUseCases.includes('linkInitialAdminMembership') && dataStoreTest.includes('setup_admin_injected_failure') && dataStoreTest.includes('families: 0') && dataStoreTest.includes('families: 1'), 'first-family setup is one unit of work with rollback and recovery regression');
check('CLEAN_ALL_WORKSPACE_PACKAGE', desktopPackage.scripts?.['package:win:local-test']?.includes('clean-stale-windows-installers.mjs') && desktopPackage.scripts?.['package:win:local-test']?.includes('run build:packages') && desktopPackage.scripts?.['package:win:local-test']?.includes('npm run build') && desktopPackage.scripts?.['package:win:local-test']?.includes('verify:installer'), 'local package chain cleans, rebuilds all packages, builds desktop and verifies installer');
check('DYNAMIC_EXTERNAL_SOURCE_BACKUP', externalProtection.includes("repositoryMetadata.visibleRelease") && externalProtection.includes("requirement: 'PR-233'") && externalProtection.includes("decision: 'DEC-267'") && !externalProtection.includes('Bronze 04.08.2026.29'), 'external D source protection is bound to current metadata and DEC-267');
check('VERSION_SCOPED_EXTERNAL_CLEANUP', externalCleaner.includes('ledger.current?.parentRelease') && externalCleaner.includes("resolve(libraryRoot, parentRelease, 'installer')") && externalCleaner.includes('beklenmeyen giriş var; silme durduruldu') && !externalCleaner.includes('authoritative-source'), 'external stale-installer cleanup is parent-release scoped and cannot target source archives');
check('RELEASE_IDENTITY', metadata.visibleRelease === registry.effectiveRelease && registry.rules.some((rule) => rule.id === 'PR-233' && rule.state === 'ACTIVE') && registry.rules.some((rule) => rule.id === 'PR-232' && rule.state === 'SUPERSEDED'), 'repository release equals canonical release, PR-233 is active and PR-232 is superseded');
check('MUTATION_EXACT_COMMIT_READINESS', registry.rules.some((rule) => rule.id === 'PR-235' && rule.state === 'ACTIVE')
  && mutationPolicy.schemaVersion === 2 && mutationPolicy.requirement === 'PR-235' && mutationPolicy.decision === 'DEC-270'
  && baselineProducer.includes('PRE_MUTATION_BASELINE')
  && impactProducer.includes('listChangedPathsForImpactAnalysis')
  && testProducer.includes('spawnSync(process.execPath') && testProducer.includes("kind === 'full'")
  && preflight.includes("process.argv.includes('--read-only')")
  && postflight.includes("['scripts/run-governed-preflight.mjs', '--read-only']")
  && !postflight.includes("['scripts/generate-project-artifact-index-v2.mjs']")
  && postflight.includes('validateMutationReleaseEvidence')
  && builder.includes('mutationReleaseReadiness')
  && builder.includes('listChangedPathsForImpactAnalysis')
  && finalDelivery.includes("mutationReadiness.requirement === 'PR-235'")
  && finalDelivery.includes("installedUi.runtimeKind === 'INSTALLED_EXECUTABLE'")
  && finalDelivery.includes('packageGeneratedAt < installedUiStartedAt'),
'PR-235 exact-commit targeted/full/integrity package gate and fresh installed-executable UAT delivery gate');

const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, release: registry.effectiveRelease, rule: 'PR-233', decision: 'DEC-267', status: failures.length ? 'FAIL' : 'PASS', checks, generatedAt: new Date().toISOString() };
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/first-family-clean-release-policy.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) { console.error(failures.map((item) => `${item.id}: ${item.evidence}`).join('\n')); process.exit(1); }
console.log(`First-family clean release policy: PASS (${checks.length} checks / ${registry.effectiveRelease}).`);
