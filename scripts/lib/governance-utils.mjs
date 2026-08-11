import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

export const SELF_INDEX_PATHS = new Set([
  'artifacts/manifests/PROJECT_ARTIFACT_INDEX.json',
  'artifacts/manifests/PROJECT_ARTIFACT_INDEX.csv',
  'artifacts/manifests/PROJECT_ARTIFACT_INDEX.md',
  'artifacts/manifests/ALL_DOCUMENTS_INDEX.json',
  'artifacts/manifests/ALL_DOCUMENTS_INDEX.csv',
  'artifacts/manifests/ALL_DOCUMENTS_INDEX.md',
  'docs/current/08_TUM_BELGELER_DIZINI.md',
  'manifest.json',
  'SHA256SUMS.txt'
]);

export const DOCUMENT_EXTENSIONS = new Set(['.md','.pdf','.docx','.txt','.rtf','.json','.csv','.yml','.yaml','.html']);
export const EXCLUDED_DIRECTORIES = new Set(['node_modules','dist','release','coverage','.git','.idea','.vscode']);

export const stableJson = (value) => JSON.stringify(value, Object.keys(value ?? {}).sort());
export const sha256Bytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const sha256File = async (path) => sha256Bytes(await readFile(path));
export const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

export async function walkFiles(root='.') {
  const files=[];
  async function walk(dir) {
    const entries=(await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      const path=join(dir,entry.name);
      if (entry.isDirectory()) await walk(path);
      else files.push(relative(root,path).replaceAll('\\','/'));
    }
  }
  await walk(root);
  return files.sort();
}

export function classifyPath(path, activeAuthority=new Set()) {
  const base=path.split('/').at(-1) ?? path;
  if (activeAuthority.has(path)) return 'ACTIVE_AUTHORITY';
  if (/^(BRONZE_04\.08\.2026\.28_|BUILD_STATUS\.md$|README\.md$|START_HERE_TR\.md$|PAKET_OZETI_TR\.md$|DELIVERY_SUMMARY_TR\.md$|VERIFICATION_REPORT\.md$)/.test(base)) return 'ACTIVE_REFERENCE';
  if (/BUILD\d+|BRONZE_RC2|BRONZE_MVP|MVP\d+|RC2|MASTER_PROJECT_DOCUMENTATION_BUILD\d+/i.test(path)) return 'HISTORICAL';
  if (path.startsWith('docs/current/')) return 'ACTIVE_REFERENCE';
  if (path.startsWith('config/')) return 'ACTIVE_REFERENCE';
  if (path.startsWith('docs/decisions/') || path.startsWith('docs/adr/')) return 'ACTIVE_REFERENCE';
  if (path.startsWith('artifacts/validation/') || path.includes('evidence') || path.includes('EVIDENCE')) return 'EVIDENCE';
  if (path.startsWith('scripts/') || path.includes('/tests/') || /(?:verify|test|gate)/i.test(base)) return 'TEST_OR_GATE';
  if (/\.(?:ts|tsx|js|mjs|cjs|css|scss|sql|ps1|py)$/.test(path)) return 'SOURCE_CODE';
  if (path.startsWith('artifacts/') || path==='manifest.json' || path==='SHA256SUMS.txt') return 'GENERATED';
  return 'ACTIVE_REFERENCE';
}

export const csvEscape = (value) => {
  const s=String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"','""')}"` : s;
};

export async function exists(path) { try { await stat(path); return true; } catch { return false; } }

export async function computeGovernedSourceFingerprint() {
  const prefixes=['apps/','packages/','scripts/','config/','docs/current/','docs/decisions/','docs/adr/'];
  const exact=new Set(['package.json','package-lock.json','repository-metadata.json','tsconfig.base.json']);
  const files=(await walkFiles('.')).filter(path => exact.has(path) || prefixes.some(prefix=>path.startsWith(prefix))).filter(path=>!SELF_INDEX_PATHS.has(path));
  const hash=createHash('sha256');
  for(const path of files.sort()){
    hash.update(path);hash.update('\0');hash.update(await readFile(path));hash.update('\0');
  }
  return { sha256:hash.digest('hex'), fileCount:files.length };
}
