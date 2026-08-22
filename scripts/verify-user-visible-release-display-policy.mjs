import { mkdir, readFile, writeFile } from 'node:fs/promises';

const failures = [];
let checks = 0;
const check = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};

const [appMeta, renderer, domainTest, desktopTest] = await Promise.all([
  readFile('packages/domain/src/app-meta.ts', 'utf8'),
  readFile('apps/desktop/src/renderer/App.tsx', 'utf8'),
  readFile('packages/domain/tests/user-visible-release.test.ts', 'utf8'),
  readFile('apps/desktop/tests/user-visible-release-boundary-runtime.test.ts', 'utf8')
]);

const stage = appMeta.match(/stage: '([^']+)'/u)?.[1] ?? '';
check(Boolean(stage), 'APP_META stage bulunamadı');
check(!/\b(?:Bronze|Silver|Gold)\b/iu.test(stage), 'APP_META stage kanal adını yineleyemez');
check(appMeta.includes('formatUserVisibleReleaseSummary'), 'ortak görünür sürüm biçimlendiricisi eksik');
check(appMeta.includes('USER_VISIBLE_RELEASE_CHANNEL_TOKEN.test(metadata.stage)'), 'stage kanal yineleme doğrulaması eksik');
check(renderer.includes('formatUserVisibleReleaseSummary(USER_VISIBLE_APP_INFO'), 'ilk kurulum sürüm özeti ortak biçimlendiriciyi kullanmıyor');
check(!renderer.includes("'Bronze · Active Development'"), 'İngilizce görünüm Bronze kanalına sabitlenmiş');
check(!renderer.includes("{appInfo.channel} · {t('shell.version')} {appInfo.releaseLabel}"), 'güvenli başlangıç sürüm kanalı iki kez gösteriyor');
check(domainTest.includes("it.each(['Bronze', 'Silver', 'Gold'] as const)"), 'üç kanal için tek gösterim testi eksik');
check(desktopTest.includes("expect(app).not.toContain(\"{appInfo.channel} · {t('shell.version')} {appInfo.releaseLabel}\")"), 'masaüstü tekrar regresyon kalkanı eksik');

const report = {
  schemaVersion: 1,
  ruleId: 'PR-230',
  checks,
  stage,
  channels: ['Bronze', 'Silver', 'Gold'],
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/user-visible-release-display-policy.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log(`Görünür sürüm kanalı tekilleştirme kuralı: PASS (${checks} kontrol).`);
