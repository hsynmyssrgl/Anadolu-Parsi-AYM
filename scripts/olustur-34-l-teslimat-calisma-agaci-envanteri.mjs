import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readlink, writeFile } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
const expectedRoot = resolve('C:\\PPT\\AYM', '06_KOD', 'app');
if (root !== expectedRoot) throw new Error(`Güvenli olmayan kaynak kökü: ${root}`);

const verifyOnly = process.argv.includes('--verify');
const jsonOutput = 'artifacts/inventory/TESLIMAT_CALISMA_AGACI_ENVANTERI.json';
const markdownOutput = 'docs/current/13_TESLIMAT_CALISMA_AGACI_ENVANTERI.md';
const excludedSelfGeneratedPaths = Object.freeze([
  jsonOutput,
  markdownOutput,
  'artifacts/validation/34-L-bronze-final-local-closure-boundary.json',
  'artifacts/validation/34-L-bronze-final-local-closure-contract.json',
  'artifacts/validation/34-L-bronze-final-local-closure-runtime.json'
]);
const excluded = new Set(excludedSelfGeneratedPaths);
const binaryExtensions = new Set([
  '.bmp', '.dll', '.exe', '.gif', '.ico', '.jpeg', '.jpg', '.node', '.pdf', '.png', '.so', '.webp', '.zip'
]);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const git = (args) => spawnSync('git', ['-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', ...args], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'pipe',
  maxBuffer: 32 * 1024 * 1024
});
const normalizePath = (value) => value.replaceAll('\\', '/');

function classifyPath(path) {
  if (path === '.gitignore' || path === 'package.json') return 'YONETISIM_VE_KONFIGURASYON';
  if (path.startsWith('artifacts/')) return 'URETILMIS_KANIT_VE_INDEKS';
  if (path.includes('/tests/') || /(?:^|\/)tests?\//u.test(path) || /\.test\.[cm]?[jt]sx?$/u.test(path)
    || path.includes('/fixtures/')) return 'TEST_VE_FIXTURE';
  if (path.startsWith('config/')) return 'YONETISIM_VE_KONFIGURASYON';
  if (path.startsWith('docs/')) return 'BELGE';
  if (path.startsWith('scripts/')) return 'DOGRULAMA_VE_URETIM_OTOMASYONU';
  if (path.startsWith('tools/')) return 'YARDIMCI_ARAC';
  if (path.startsWith('apps/') || path.startsWith('packages/') || path.startsWith('native/')) return 'URUN_KAYNAGI';
  return 'ELLE_INCELENECEK_DIGER';
}

function dispositionFor(group) {
  if (group === 'URETILMIS_KANIT_VE_INDEKS') return 'AYRI_KANIT_KUMESI_VEYA_YENIDEN_URETIM';
  if (group === 'ELLE_INCELENECEK_DIGER') return 'ELLE_SAHIPLIK_VE_TESLIM_INCELEMESI';
  return 'KAYNAK_TESLIM_KUMESINDE_INCELENECEK';
}

async function fingerprintPath(path, deleted) {
  if (deleted) return { bytes: 0, sha256: null, fileKind: 'DELETED' };
  const absolute = resolve(root, path);
  const prefix = `${root}${sep}`;
  if (absolute !== root && !absolute.startsWith(prefix)) throw new Error(`Repo disi yol reddedildi: ${path}`);
  const info = await lstat(absolute);
  if (info.isSymbolicLink()) {
    const target = await readlink(absolute);
    const bytes = Buffer.from(`symlink:${target}`, 'utf8');
    return { bytes: bytes.length, sha256: sha256(bytes), fileKind: 'SYMLINK' };
  }
  if (!info.isFile()) throw new Error(`Dosya olmayan Git girdisi reddedildi: ${path}`);
  const bytes = await readFile(absolute);
  return {
    bytes: bytes.length,
    sha256: sha256(bytes),
    fileKind: binaryExtensions.has(extname(path).toLowerCase()) ? 'BINARY' : 'TEXT'
  };
}

async function buildInventory() {
  const headResult = git(['rev-parse', 'HEAD']);
  if (headResult.status !== 0 || !/^[0-9a-f]{40}\s*$/u.test(headResult.stdout ?? '')) {
    throw new Error('Kaynak HEAD kimliği okunamadı.');
  }
  const sourceBaseHead = headResult.stdout.trim();
  const statusResult = git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames']);
  if (statusResult.status !== 0) throw new Error(`Git çalışma ağacı okunamadı: ${statusResult.stderr}`);

  const entries = [];
  for (const raw of (statusResult.stdout ?? '').split('\0').filter(Boolean)) {
    if (raw.length < 4 || raw[2] !== ' ') throw new Error(`Beklenmeyen Git durum girdisi: ${raw}`);
    const gitStatus = raw.slice(0, 2);
    const path = normalizePath(raw.slice(3));
    if (excluded.has(path)) continue;
    const deleted = gitStatus.includes('D');
    const fingerprint = await fingerprintPath(path, deleted);
    const group = classifyPath(path);
    entries.push(Object.freeze({
      path,
      gitStatus,
      tracked: gitStatus !== '??',
      staged: gitStatus[0] !== ' ' && gitStatus[0] !== '?',
      worktreeChanged: gitStatus[1] !== ' ' && gitStatus[1] !== '?',
      group,
      proposedDisposition: dispositionFor(group),
      ...fingerprint
    }));
  }
  entries.sort((left, right) => left.path.localeCompare(right.path, 'en'));

  const groupCounts = Object.fromEntries([...new Set(entries.map((entry) => entry.group))]
    .sort().map((group) => [group, entries.filter((entry) => entry.group === group).length]));
  const counts = Object.freeze({
    total: entries.length,
    trackedChanged: entries.filter((entry) => entry.tracked).length,
    untracked: entries.filter((entry) => !entry.tracked).length,
    staged: entries.filter((entry) => entry.staged).length,
    worktreeChanged: entries.filter((entry) => entry.worktreeChanged).length,
    deleted: entries.filter((entry) => entry.fileKind === 'DELETED').length,
    binary: entries.filter((entry) => entry.fileKind === 'BINARY').length,
    groups: groupCounts
  });
  const snapshotSha256 = sha256(Buffer.from(JSON.stringify({ sourceBaseHead, excludedSelfGeneratedPaths, entries }), 'utf8'));
  return Object.freeze({
    schemaVersion: 1,
    id: '34-L-TESLIMAT-CALISMA-AGACI-ENVANTERI',
    sourceBaseHead,
    status: entries.length === 0 ? 'CLEAN' : 'DIRTY_REQUIRES_PARTITION',
    snapshotSha256,
    deterministicSnapshot: true,
    authorOrOwnerAttributionMade: false,
    finalCommitBindingEstablished: false,
    installerProducedByThisOperation: false,
    destructiveActionPerformed: false,
    excludedSelfGeneratedPaths,
    counts,
    entries
  });
}

function renderMarkdown(inventory) {
  const groups = Object.entries(inventory.counts.groups)
    .map(([group, count]) => `| ${group} | ${count} |`)
    .join('\n') || '| TEMIZ_CALISMA_AGACI | 0 |';
  const rows = inventory.entries.map((entry) => {
    const escapedPath = entry.path.replaceAll('|', '\\|');
    return `| ${entry.gitStatus.replaceAll(' ', '&nbsp;')} | ${escapedPath} | ${entry.group} | ${entry.bytes} | ${entry.sha256 ?? '-'} |`;
  }).join('\n');
  const fileRows = rows || '| - | Çalışma ağacı temiz; listelenecek değişiklik yok. | TEMIZ_CALISMA_AGACI | 0 | - |';
  return `# 34-L Teslimat Çalışma Ağacı Envanteri

Bu belge çalışma ağacındaki değişiklikleri silmeden ve yazarlık/sahiplik iddiası kurmadan teslimat kümelerine ayırır. Otomatik commit, push, kurulum paketi veya gereksinim kabul kanıtı değildir.

- Kaynak HEAD: \`${inventory.sourceBaseHead}\`
- Anlık görüntü SHA-256: \`${inventory.snapshotSha256}\`
- Durum: \`${inventory.status}\`
- Toplam girdi: \`${inventory.counts.total}\` (izlenen \`${inventory.counts.trackedChanged}\`, izlenmeyen \`${inventory.counts.untracked}\`)
- Stage edilmiş girdi: \`${inventory.counts.staged}\`; silinen: \`${inventory.counts.deleted}\`; ikili dosya: \`${inventory.counts.binary}\`
- Son commit bağı: \`KURULMADI\`; kurulum paketi: \`OLUŞTURULMADI\`

## Teslimat kümeleri

| Küme | Dosya sayısı |
| --- | ---: |
${groups}

## Önerilen teslimat sırası

1. \`URUN_KAYNAGI\`: uygulama, paketler ve yerel Windows servis kaynağı.
2. \`TEST_VE_FIXTURE\`: kaynakla aynı davranış kümesine ait testler ve görsel fixture'lar.
3. \`YONETISIM_VE_KONFIGURASYON\`: kapsam, manifest ve politika ratchet'leri.
4. \`DOGRULAMA_VE_URETIM_OTOMASYONU\`: doğrulayıcılar, üreticiler ve bakım komutları.
5. \`BELGE\`: karar, tehdit modeli, denetim ve güncel durum belgeleri.
6. \`YARDIMCI_ARAC\`: Gold aktivasyon yöneticisi gibi bağımsız araçlar; ayrı ürün sınırı olarak incelenir.
7. \`URETILMIS_KANIT_VE_INDEKS\`: kaynak kümeleri sabitlendikten sonra yeniden üretilir ve ayrı kanıt kümesinde tutulur.

## Güvenlik ve kullanım kuralı

- Bu envanter yalnız mevcut Git durumunu ve dosya SHA-256 değerlerini kaydeder.
- Değişikliklerin kullanıcıya veya belirli bir geliştiriciye ait olduğunu varsaymaz.
- \`URETILMIS_KANIT_VE_INDEKS\` girdileri kaynak kod commitinden ayrı ele alınmalı veya kanıt komutlarıyla yeniden üretilmelidir.
- \`ELLE_INCELENECEK_DIGER\` girdileri sahiplik ve teslim amacı belirlenmeden commitlenmemelidir.
- Dış cihaz, sağlayıcı, sertifika, soak veya inceleme kanıtı bu belgeyle PASS sayılmaz.

## Dosya listesi

| Git | Yol | Küme | Bayt | SHA-256 |
| --- | --- | --- | ---: | --- |
${fileRows}
`;
}

const inventory = await buildInventory();
if (verifyOnly) {
  const existing = JSON.parse(await readFile(resolve(root, jsonOutput), 'utf8'));
  const storedSnapshotSha256 = sha256(Buffer.from(JSON.stringify({
    sourceBaseHead: existing.sourceBaseHead,
    excludedSelfGeneratedPaths: existing.excludedSelfGeneratedPaths,
    entries: existing.entries
  }), 'utf8'));
  let sourceBindingMatches = existing.sourceBaseHead === inventory.sourceBaseHead
    && existing.snapshotSha256 === inventory.snapshotSha256;
  if (existing.status === 'CLEAN' && existing.entries?.length === 0 && inventory.entries.length === 0
    && existing.snapshotSha256 === storedSnapshotSha256) {
    const parentResult = git(['rev-parse', 'HEAD^']);
    const publishedPathsResult = git(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']);
    const publishedPaths = (publishedPathsResult.stdout ?? '').split(/\r?\n/u).filter(Boolean).map(normalizePath);
    sourceBindingMatches = inventory.sourceBaseHead === existing.sourceBaseHead
      || (parentResult.status === 0 && parentResult.stdout.trim() === existing.sourceBaseHead
        && publishedPathsResult.status === 0 && publishedPaths.length === 2
        && publishedPaths.every((path) => path === jsonOutput || path === markdownOutput));
  }
  if (existing.schemaVersion !== inventory.schemaVersion || existing.id !== inventory.id
    || !sourceBindingMatches
    || JSON.stringify(existing.entries) !== JSON.stringify(inventory.entries)
    || JSON.stringify(existing.counts) !== JSON.stringify(inventory.counts)
    || existing.authorOrOwnerAttributionMade !== false || existing.finalCommitBindingEstablished !== false) {
    throw new Error('Teslimat çalışma ağacı envanteri güncel Git durumuyla eşleşmiyor.');
  }
  console.log(`34-L teslimat çalışma ağacı envanteri: PASS (${inventory.counts.total} girdi; ${inventory.snapshotSha256}).`);
  process.exit(0);
}

await mkdir(resolve(root, 'artifacts/inventory'), { recursive: true });
await mkdir(resolve(root, 'docs/current'), { recursive: true });
await writeFile(resolve(root, jsonOutput), `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
await writeFile(resolve(root, markdownOutput), renderMarkdown(inventory), 'utf8');
console.log(`34-L teslimat çalışma ağacı envanteri oluşturuldu: ${inventory.counts.total} girdi; ${inventory.snapshotSha256}.`);
