import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';

const reportPath = resolve(process.argv[2] ?? 'artifacts/validation/build126-typography-contract.json');
const [rootPackage, desktopPackage, appMeta, mainSource, typography, legacyStyles] = await Promise.all([
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('apps/desktop/package.json', 'utf8').then(JSON.parse),
  readFile('packages/domain/src/app-meta.ts', 'utf8'),
  readFile('apps/desktop/src/renderer/main.tsx', 'utf8'),
  readFile('apps/desktop/src/renderer/typography.css', 'utf8'),
  readFile('apps/desktop/src/renderer/styles.css', 'utf8')
]);

const failures = [];
let assertions = 0;
const verify = (condition, message) => {
  assertions += 1;
  if (!condition) failures.push(message);
};

verify(rootPackage.version === '27.7.2026-126', `root package version=${rootPackage.version}`);
verify(desktopPackage.version === '27.7.2026-126', `desktop package version=${desktopPackage.version}`);
verify(appMeta.includes("version: '27.07.2026.126'"), 'application version is not Build 126');
verify(appMeta.includes("packageVersion: '27.7.2026-126'"), 'package version is not Build 126');
verify(appMeta.includes("stage: 'Bronze RC2 · Aktif Geliştirme · Build 126'"), 'active stage is not Build 126');
verify(rootPackage.scripts?.['verify:build126:typography'] === 'node scripts/verify-build126-typography-contract.mjs', 'Build 126 typography command is missing');

const styleImport = mainSource.indexOf("import './styles.css';");
const typographyImport = mainSource.indexOf("import './typography.css';");
verify(styleImport >= 0, 'legacy application styles import is missing');
verify(typographyImport > styleImport, 'typography layer must load after application styles');
verify(typography.includes('/* Build 126 — Apple system typography contract */'), 'Build 126 typography marker is missing');
verify(typography.includes('--font-family-system: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display"'), 'Apple system font stack is incomplete');
verify(typography.includes('--font-size-large-title: 34px;'), 'large title token is missing');
verify(typography.includes('--font-size-title-1: 28px;'), 'title 1 token is missing');
verify(typography.includes('--font-size-title-2: 22px;'), 'title 2 token is missing');
verify(typography.includes('--font-size-title-3: 20px;'), 'title 3 token is missing');
verify(typography.includes('--font-size-body: 17px;'), 'body token is missing');
verify(typography.includes('--font-size-subheadline: 15px;'), 'control/subheadline token is missing');
verify(typography.includes('--font-size-footnote: 13px;'), 'footnote token is missing');
verify(typography.includes('--font-size-caption-1: 12px;'), 'caption token is missing');
verify(typography.includes('--font-size-caption-2: 11px;'), 'minimum caption token is missing');
verify(typography.includes('body .app-shell .page-header h1'), 'page title semantic rule is missing');
verify(typography.includes('body .app-shell :is(p, li, dd, dt, blockquote, .body-copy)'), 'normal text semantic rule is missing');
verify(typography.includes('body .app-shell :is(label, input, select, textarea, button'), 'control typography rule is missing');
verify(typography.includes('body .app-shell :is(small, time, kbd'), 'secondary text rule is missing');
verify(typography.includes('text-transform: none;'), 'natural casing override is missing');
verify(typography.includes('min-height: 44px;'), 'minimum control height is missing');
verify(!typography.includes('@font-face'), 'font binaries must not be embedded through @font-face');
verify(legacyStyles.includes('/* Build 124 — shared Apple-inspired component language */'), 'existing Build 124 component layer was lost');

const fontExtensions = new Set(['.ttf', '.otf', '.woff', '.woff2', '.eot']);
const fontFiles = [];
const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (fontExtensions.has(extname(entry.name).toLowerCase()) && (await stat(path)).isFile()) fontFiles.push(path);
  }
};
await walk('apps');
verify(fontFiles.length === 0, `embedded font binaries found: ${fontFiles.join(', ')}`);

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  build: 126,
  applicationVersion: '27.07.2026.126',
  packageVersion: '27.7.2026-126',
  stage: 'Bronze RC2 Active Development',
  scope: 'Central Apple system font stack, semantic type scale, natural casing and readable control typography',
  assertions,
  failures,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 126 typography contract: ${report.status} (${assertions} assertions)`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
