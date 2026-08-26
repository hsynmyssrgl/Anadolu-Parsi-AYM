import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const exists = async (path) => { try { await stat(path); return true; } catch { return false; } };
const config = await readJson('config/active-file-classification.json');
const releaseLedger = await readJson('config/release-ledger.json');
const activeDocumentSet = await readJson('config/active-document-set.json');
const current = releaseLedger.current;
const failures = [];
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) failures.push(message); };

check(config.schemaVersion === 2, `active file classification schema=${config.schemaVersion}`);
check(config.versionAuthority === 'config/release-ledger.json', `active version authority=${config.versionAuthority}`);
check(activeDocumentSet.release === current?.visibleRelease, `active document set release=${activeDocumentSet.release}`);

const activeFiles = [...new Set([
  ...(config.activeFiles ?? []),
  ...(activeDocumentSet.authorityOrder ?? [])
])];
const activeReleaseMarkdownPaths = new Set([
  'SECURITY.md',
  'CONTRIBUTING.md',
  'COPYRIGHT.md',
  'docs/current/00_AKTIF_ANA_KAPSAM.md',
  'docs/current/04_AKTIF_BRONZE_YOL_HARITASI.md',
  'docs/current/06_KANONIK_KURAL_SICILI.md',
  'docs/current/07_TESLIM_SOHBET_VE_KALICI_KAYIT_SOZLESMESI.md',
  'docs/current/08_TUM_BELGELER_DIZINI.md',
  'docs/current/09_KULLANICI_KARARLARI_KAYDI.md',
  'docs/current/10_TUM_KURALLAR_ASILAMAZ_YURUTME_SOZLESMESI.md',
  'docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md',
  'docs/current/12_KALAN_IS_SINIFLANDIRMA.md',
  'docs/current/13_KURUMSALLASMA_VE_GLOBAL_MARKA_PLANI.md',
  'docs/current/15_EK_KURAL_TOPLU_BIRLESTIRME_SICILI.md'
]);
const activeReleaseJsonFields = new Map([
  ['config/active-document-set.json', 'release'],
  ['config/canonical-rule-registry.json', 'effectiveRelease'],
  ['config/project-constitution.json', 'effectiveRelease'],
  ['config/active-governance-ledger.json', 'release'],
  ['config/user-decision-ledger.json', 'release'],
  ['config/documentation-synchronization-policy.json', 'release'],
  ['config/work-segmentation-plan.json', 'release'],
  ['config/rule-enforcement-registry.json', 'release'],
  ['config/rule-acknowledgement.json', 'release'],
  ['config/mutation-release-readiness-policy.json', 'release'],
  ['docs/ticari-urun-temeli/00_TEMEL_SURUM_MANIFESTOSU.json', 'sourceRelease']
]);
for (const path of activeFiles) {
  check(await exists(path), `active file missing=${path}`);
  if (!await exists(path) || !path.endsWith('.md')) continue;
  const source = await readFile(path, 'utf8');
  if (['README.md', 'START_HERE_TR.md', 'PAKET_OZETI_TR.md', 'DELIVERY_SUMMARY_TR.md', 'VERIFICATION_REPORT.md', 'BUILD_STATUS.md'].includes(path)) {
    check(source.includes(`- Application Version: \`${current.version}\``), `${path} active application version missing`);
    check(source.includes(`- Monthly Sequence: **${current.monthlySequence}**`), `${path} active monthly sequence missing`);
  }
  if (activeReleaseMarkdownPaths.has(path)) {
    const markers = [...source.matchAll(/^(?:\*\*Aktif sürüm:\*\*|- (?:Aktif kanal ve sürüm|Aktif sürüm|Görünür sürüm|Görünür ürün sürümü|Sürüm):).*$/gmu)];
    check(markers.length > 0, `${path} explicit active version marker missing`);
    for (const match of markers) {
      check(match[0].includes(current.visibleRelease), `${path} stale explicit active version marker=${match[0].trim()}`);
    }
    if (path === 'docs/current/07_TESLIM_SOHBET_VE_KALICI_KAYIT_SOZLESMESI.md') {
      check(source.includes(`/ParsYuva/ParsYuva Aile Yasam Merkezi/${current.visibleRelease}`),
        `${path} stale persistent Library release path`);
    }
  }
}
for (const [path, field] of activeReleaseJsonFields) {
  check(await exists(path), `active release JSON missing=${path}`);
  if (!await exists(path)) continue;
  const value = await readJson(path);
  check(value[field] === current.visibleRelease, `${path} ${field}=${String(value[field])}`);
}
const commercialReadme = await readFile('docs/ticari-urun-temeli/00_OKU_BENI.md', 'utf8');
check(commercialReadme.includes(`Guncel ust kayit ${current.visibleRelease} ve `),
  'commercial current upper record release is stale');
check(commercialReadme.includes(`- Kaynak urun surumu: ${current.visibleRelease}`),
  'commercial source product release is stale');

const report = {
  schemaVersion: 2,
  versionAuthority: config.versionAuthority,
  release: current?.visibleRelease ?? null,
  releaseId: current?.releaseId ?? null,
  monthlySequence: current?.monthlySequence ?? null,
  activeFileCount: activeFiles.length,
  checks,
  status: failures.length ? 'FAIL' : 'PASS',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/active-version-sweep.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Active version sweep: PASS (${checks} checks / ${activeFiles.length} active files / ${current.visibleRelease}).`);
