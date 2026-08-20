import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';

const noWrite = process.argv.includes('--no-write');
const registryPath = 'config/accepted-scope-registry.json';
const roadmapPath = 'config/remaining-scope-package-roadmap.json';
const jsonOutputPath = 'artifacts/inventory/KALAN_IS_SINIFLANDIRMA.json';
const markdownOutputPath = 'docs/current/12_KALAN_IS_SINIFLANDIRMA.md';

const [registry, roadmap] = await Promise.all([
  readFile(registryPath, 'utf8').then(JSON.parse),
  readFile(roadmapPath, 'utf8').then(JSON.parse)
]);

const requirements = Array.isArray(registry.requirements) ? registry.requirements : [];
const packages = Array.isArray(roadmap.packages) ? roadmap.packages : [];
const failures = [];
const requirementToPackages = new Map();

for (const packageItem of packages) {
  for (const requirementId of packageItem.requirementIds ?? []) {
    const owners = requirementToPackages.get(requirementId) ?? [];
    owners.push(packageItem);
    requirementToPackages.set(requirementId, owners);
  }
}

const externalAcceptanceOnlyStatuses = new Set([
  'IMPLEMENTED_LOCAL_AUTOMATED',
  'LOCAL_FEATURE_COMPLETE_EXTERNAL_ACCEPTANCE_INCOMPLETE'
]);
const productionIntegrationAndAcceptanceStatuses = new Set([
  'EXPANDED_LOCAL_COMPOSED_AND_TESTED_ACCEPTANCE_INCOMPLETE',
  'LOCAL_PRODUCTION_COMPOSITION_ACCEPTANCE_INCOMPLETE',
  'LOCAL_PRODUCTION_QUERY_COMPOSED_ACCEPTANCE_INCOMPLETE',
  'PARTIAL_LOCAL_IMPLEMENTATION_COMPOSED_ACCEPTANCE_INCOMPLETE',
  'PARTIAL_LOCAL_CANDIDATE_REGISTRY_COMPOSED_ACCEPTANCE_INCOMPLETE',
  'PARTIAL_LOCAL_POLICY_METADATA_FOUNDATION_COMPOSED_ACCEPTANCE_INCOMPLETE',
  'PARTIAL_LOCAL_COMPOSED_AND_TESTED_ACCEPTANCE_INCOMPLETE'
]);

const classify = (requirement, packageItem) => {
  if (requirement.status === 'COMPLETE') return 'KATI_KAPALI';
  if (!packageItem) return 'ESLESMEYEN_ACIK_GEREKSINIM';
  if (packageItem.countsAsRequirementPass === true) return 'KAYIT_UYUMSUZLUGU';
  if (packageItem.step === '34-L') return 'SON_KAPANIS_OTOMASYONU_BEKLIYOR';
  if (externalAcceptanceOnlyStatuses.has(packageItem.localImplementationStatus)) {
    return 'YEREL_KOD_TAMAM_DIS_KABUL_BEKLIYOR';
  }
  if (productionIntegrationAndAcceptanceStatuses.has(packageItem.localImplementationStatus)) {
    return 'YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK';
  }
  return 'YEREL_VE_DIS_IS_BIRLIKTE_ACIK';
};

const rows = requirements.map((requirement) => {
  const owners = requirementToPackages.get(requirement.id) ?? [];
  if (requirement.status !== 'COMPLETE' && owners.length !== 1) {
    failures.push(`${requirement.id}: package owner count ${owners.length}`);
  }
  const packageItem = owners[0];
  return Object.freeze({
    requirementId: requirement.id,
    title: requirement.title,
    priority: requirement.priority,
    registryStatus: requirement.status,
    classification: classify(requirement, packageItem),
    packageStep: packageItem?.step ?? null,
    packageStatus: packageItem?.status ?? null,
    localImplementationStatus: packageItem?.localImplementationStatus ?? null,
    countsAsRequirementPass: packageItem?.countsAsRequirementPass ?? requirement.status === 'COMPLETE',
    openReason: requirement.status === 'COMPLETE' ? null : packageItem?.openReason ?? 'Paket eşleşmesi yok.',
    missingEvidence: requirement.status === 'COMPLETE' ? [] : packageItem?.missingEvidence ?? []
  });
});

const categoryOrder = Object.freeze([
  'KATI_KAPALI',
  'YEREL_KOD_TAMAM_DIS_KABUL_BEKLIYOR',
  'YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK',
  'YEREL_VE_DIS_IS_BIRLIKTE_ACIK',
  'SON_KAPANIS_OTOMASYONU_BEKLIYOR',
  'KAYIT_UYUMSUZLUGU',
  'ESLESMEYEN_ACIK_GEREKSINIM'
]);
const counts = Object.fromEntries(categoryOrder.map((category) => [
  category,
  rows.filter((row) => row.classification === category).length
]));
const packageSummaries = packages.map((packageItem) => {
  const packageRows = rows.filter((row) => row.packageStep === packageItem.step);
  const openRows = packageRows.filter((row) => row.registryStatus !== 'COMPLETE');
  return Object.freeze({
    step: packageItem.step,
    title: packageItem.title,
    packageStatus: packageItem.status,
    localImplementationStatus: packageItem.localImplementationStatus,
    requirementCount: packageRows.length,
    strictCompleteCount: packageRows.length - openRows.length,
    openRequirementCount: openRows.length,
    classification: openRows[0]?.classification ?? 'KATI_KAPALI',
    countsAsRequirementPass: packageItem.countsAsRequirementPass,
    openReason: packageItem.openReason,
    missingEvidence: packageItem.missingEvidence ?? []
  });
});

const requirementIds = requirements.map((item) => item.id);
if (requirements.length !== registry.requirementCount) failures.push('registry requirementCount mismatch');
if (new Set(requirementIds).size !== requirements.length) failures.push('duplicate requirement id');
if (counts.KAYIT_UYUMSUZLUGU !== 0) failures.push('accepted package and registry status mismatch');
if (counts.ESLESMEYEN_ACIK_GEREKSINIM !== 0) failures.push('unmapped open requirement');
if (Object.values(counts).reduce((sum, value) => sum + value, 0) !== requirements.length) {
  failures.push('classification cardinality mismatch');
}

const report = Object.freeze({
  schemaVersion: 1,
  id: 'KALAN-IS-SINIFLANDIRMA',
  generatedAt: new Date().toISOString(),
  release: ACTIVE_BUILD_META.milestone,
  activeRelease: ACTIVE_BUILD_META.milestone,
  scopeBaselineRelease: registry.release,
  authoritativeSources: [registryPath, roadmapPath],
  interpretation: 'Kalan toplamı yeni hata sayısı değildir; katı kapanış, yerel uygulama, dış kabul ve son kapanış katmanları ayrı ölçülür.',
  requirementCount: requirements.length,
  strictCompleteCount: counts.KATI_KAPALI,
  strictRemainingCount: requirements.length - counts.KATI_KAPALI,
  classificationCounts: counts,
  locallyImplementedExternalAcceptancePendingPackages: packageSummaries
    .filter((item) => item.classification === 'YEREL_KOD_TAMAM_DIS_KABUL_BEKLIYOR')
    .map((item) => item.step),
  locallyComposedProductionIntegrationAndAcceptancePendingPackages: packageSummaries
    .filter((item) => item.classification === 'YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK')
    .map((item) => item.step),
  mixedLocalAndExternalOpenPackages: packageSummaries
    .filter((item) => item.classification === 'YEREL_VE_DIS_IS_BIRLIKTE_ACIK')
    .map((item) => item.step),
  finalClosurePackages: packageSummaries
    .filter((item) => item.classification === 'SON_KAPANIS_OTOMASYONU_BEKLIYOR')
    .map((item) => item.step),
  packageSummaries,
  requirements: rows,
  validation: {
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checks: 5,
    failures
  }
});

const markdownRows = packageSummaries.map((item) =>
  `| ${item.step} | ${item.classification} | ${item.strictCompleteCount}/${item.requirementCount} | ${item.openRequirementCount} | ${item.openReason ?? 'Kapalı'} |`
).join('\n');
const markdown = `# Kalan İş Sınıflandırması\n\n`
  + `> Kaynaklar: \`${registryPath}\` ve \`${roadmapPath}\`. Bu belge otomatik üretilir.\n\n`
  + `- Aktif sürüm: **${ACTIVE_BUILD_META.milestone}**\n`
  + `- Tarihsel kapsam taban sürümü: **${registry.release}**\n\n`
  + `## Sonuç\n\n`
  + `- Toplam gereksinim: **${requirements.length}**\n`
  + `- Katı zincirle kapanmış: **${counts.KATI_KAPALI}**\n`
  + `- Katı kapanışta kalan: **${requirements.length - counts.KATI_KAPALI}**\n`
  + `- Yerel kodu tamamlanmış, yalnız dış/manüel kabul bekleyen: **${counts.YEREL_KOD_TAMAM_DIS_KABUL_BEKLIYOR}**\n`
  + `- Yerel bileşenleri kurulmuş, üretim entegrasyonu ile dış kabulü açık: **${counts.YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK}**\n`
  + `- Yerel teknik iş ile dış kabulü birlikte açık: **${counts.YEREL_VE_DIS_IS_BIRLIKTE_ACIK}**\n`
  + `- Son kapanış otomasyonu bekleyen: **${counts.SON_KAPANIS_OTOMASYONU_BEKLIYOR}**\n`
  + `- Kayıt uyumsuzluğu: **${counts.KAYIT_UYUMSUZLUGU}**\n`
  + `- Eşleşmeyen açık gereksinim: **${counts.ESLESMEYEN_ACIK_GEREKSINIM}**\n\n`
  + `Bu sayılar yeni hata sayısı değildir. Bir gereksinim yerel olarak kodlanmış olsa bile gerçek cihaz, sağlayıcı, uzun süreli saha denemesi, imza veya bağımsız inceleme kanıtı yoksa katı kapanışta açık kalır.\n\n`
  + `## Paketler\n\n`
  + `| Paket | Sınıf | Katı kapalı / toplam | Açık | Neden |\n`
  + `|---|---|---:|---:|---|\n${markdownRows}\n\n`
  + `## Aşılamaz yorumlama kuralı\n\n`
  + `- \`COMPLETE\` yalnız tam gereksinim zinciri ve kabul kanıtıyla kullanılır.\n`
  + `- Yerel otomatik test başarısı, gerçek cihaz/sağlayıcı/insan kabulünün yerine geçmez.\n`
  + `- Bilinçli fail-closed davranış veya kurulmamış dış sağlayıcı yeni kod hatası sayılmaz.\n`
  + `- Açık iş sayısı raporlanırken bu sınıflar bir daha tek “eksik” toplamında karıştırılmaz.\n`;

if (!noWrite) {
  await Promise.all([
    mkdir('artifacts/inventory', { recursive: true }),
    mkdir('docs/current', { recursive: true })
  ]);
  await Promise.all([
    writeFile(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(markdownOutputPath, markdown, 'utf8')
  ]);
}

if (failures.length > 0) {
  console.error(`Kalan iş sınıflandırması: FAIL (${failures.join('; ')})`);
  process.exit(1);
}
console.log(`Kalan iş sınıflandırması: PASS (${requirements.length}; kapalı ${counts.KATI_KAPALI}; yalnız dış kabul ${counts.YEREL_KOD_TAMAM_DIS_KABUL_BEKLIYOR}; üretim+dış kabul ${counts.YEREL_BILESENLER_KURULU_URETIM_ENTEGRASYONU_VE_DIS_KABUL_ACIK}; karma ${counts.YEREL_VE_DIS_IS_BIRLIKTE_ACIK}; final ${counts.SON_KAPANIS_OTOMASYONU_BEKLIYOR}).`);
