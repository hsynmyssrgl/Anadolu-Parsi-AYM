import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const out = process.argv[2] ?? 'artifacts/validation/build177-security-center-menu-contract.json';
const paths = [
  'apps/desktop/src/renderer/App.tsx',
  'apps/desktop/src/renderer/security-center-navigation.ts',
  'apps/desktop/src/renderer/global.d.ts',
  'apps/desktop/src/main/preload.ts',
  'apps/desktop/src/main/main.ts'
];
const files = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await readFile(path, 'utf8')])));
const app = files['apps/desktop/src/renderer/App.tsx'];
const helper = files['apps/desktop/src/renderer/security-center-navigation.ts'];
const checks = [];
const check = (name, condition) => checks.push({ name, status: condition ? 'PASS' : 'FAIL' });
const has = (path, text) => files[path].includes(text);

check('security center has dedicated route constant', has('apps/desktop/src/renderer/security-center-navigation.ts', "SECURITY_CENTER_ROUTE = 'security'"));
check('security center has dedicated Turkish label', has('apps/desktop/src/renderer/security-center-navigation.ts', "SECURITY_CENTER_LABEL = 'Güvenlik Merkezi'"));
check('screen union includes security route', app.includes("| 'security'"));
check('sidebar item uses security route constant', app.includes("{ id: SECURITY_CENTER_ROUTE, label: SECURITY_CENTER_LABEL"));
check('privacy system group includes security before settings', app.includes("['permissions', 'ai', 'legacy', 'security', 'settings']"));
check('security route renders security component', app.includes("active === SECURITY_CENTER_ROUTE") && app.includes('<SettingsSecurity auth={auth} accessibility={accessibility}'));
check('system screen no longer embeds security center', !/function SystemManagementScreen[\s\S]*?<SettingsSecurity/.test(app.slice(app.indexOf('function SystemManagementScreen'), app.indexOf('function PlaceholderScreen'))));
check('system menu has separate operational name', app.includes("label: 'Sistem ve Bakım'"));
check('profile menu links directly to security center', app.includes("navigateFromShell(SECURITY_CENTER_ROUTE)") && app.includes('>Güvenlik Merkezi</button>'));
check('command palette inherits security nav item', app.includes('searchResults.map') && app.includes('navItems'));
check('security warning badge is bound to auth state', app.includes("item.id === SECURITY_CENTER_ROUTE && securityCenterNeedsAttention(auth)"));
check('accessibility state is passed into correct component boundary', app.includes('function SettingsSecurity({auth,accessibility,onAccessibilityChange,onFamilyDataChanged}'));
check('settings security reads accessibility only through props', app.includes('accessibility.textScale') && app.includes('onAccessibilityChange({...accessibility'));
check('old combined settings label removed', !app.includes('Ayarlar ve güvenlik'));
check('exact device confirmation is centralized', helper.includes("DEVICE_REAUTHORIZATION_CONFIRMATION = 'GÜVENLİ CİHAZI YENİDEN YETKİLENDİR'"));
check('renderer uses centralized confirmation for IPC input', app.includes('confirmation:DEVICE_REAUTHORIZATION_CONFIRMATION'));
check('renderer uses centralized confirmation placeholder', app.includes('placeholder={DEVICE_REAUTHORIZATION_CONFIRMATION}'));
check('reauthorization readiness requires 2FA', helper.includes('input.twoFactorEnabled === true'));
check('reauthorization readiness requires password', helper.includes('input.password.length > 0'));
check('reauthorization readiness requires code', helper.includes('input.code.trim().length > 0'));
check('reauthorization readiness requires exact confirmation', helper.includes('input.confirmation === DEVICE_REAUTHORIZATION_CONFIRMATION'));
check('renderer button uses readiness helper', app.includes('disabled={!canSubmitDeviceReauthorization'));
check('security screen exposes password and 2FA management', app.includes('<h3>Parola ve 2FA</h3>'));
check('security screen exposes trusted devices', app.includes('<h3>Güvenilir cihazlar</h3>'));
check('security screen exposes signed receipt', app.includes('İmzalı güvenlik olayı makbuzu'));
check('security screen exposes audit chain', app.includes('<h3>Denetim kaydı</h3>'));
check('security screen exposes backup controls', app.includes('<h3>Yedekleme</h3>'));
check('security screen exposes data lifecycle', app.includes('<DataLifecycleSettings auth={auth}/>'));
check('reauthorization API is declared for renderer', has('apps/desktop/src/renderer/global.d.ts', 'reauthorizeCurrentDeviceAfterRecovery'));
check('reauthorization API is exposed by preload', has('apps/desktop/src/main/preload.ts', 'reauthorizeCurrentDeviceAfterRecovery'));
check('reauthorization IPC is registered by main', has('apps/desktop/src/main/main.ts', "auth:reauthorizeCurrentDeviceAfterRecovery"));

const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', build: 177, status: failures.length ? 'FAIL' : 'PASS', checks: checks.length, passed: checks.length - failures.length, failures, scenarios: checks, generatedAt: new Date().toISOString() };
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) { console.error(JSON.stringify(report, null, 2)); process.exit(1); }
console.log(`Build 177 security center menu contract: PASS (${checks.length}/${checks.length})`);
