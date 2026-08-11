import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LanguageVariant, SyntaxKind, createScanner } from 'typescript/unstable/ast';

const DEFAULT_CLIENT_ZONES = Object.freeze([
  'apps/desktop/src/renderer',
  'apps/desktop/src/main/preload.ts',
  'packages/core-service-client/src'
]);

const FORBIDDEN_DATA_IMPORTS = Object.freeze([
  /^@ppt\/repositories(?:\/|$)/u,
  /^@ppt\/repository-contracts(?:\/|$)/u,
  /^@ppt\/database(?:\/|$)/u,
  /^@ppt\/infrastructure(?:\/|$)/u,
  /(?:^|\/)(?:packages\/)?(?:repositories|repository-contracts|database|infrastructure)(?:\/|$)/u,
  /^(?:node:)?sqlite$/u,
  /^better-sqlite3$/u,
  /^(?:node:)?fs(?:\/promises)?$/u,
  /(?:^|\/)(?:user-data-vault|archive-vault-file-application-adapter|archive-vault-key-provider|volatile-sqlite-session|family-database-runtime|repository-composition-root|data-store)(?:\.[cm]?[jt]s)?$/u
]);

const RAW_SQL = /(?:\bSELECT\b[\s\S]{0,200}\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+[A-Za-z_][A-Za-z0-9_]*\s+SET\b|\bDELETE\s+FROM\b|\b(?:CREATE|ALTER|DROP)\s+TABLE\b|\bPRAGMA\b|\bBEGIN\s+(?:IMMEDIATE|EXCLUSIVE|TRANSACTION)\b)/iu;
const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

const normalize = (value) => value.replaceAll('\\', '/');
const forbiddenImport = (specifier) => FORBIDDEN_DATA_IMPORTS.some((pattern) => pattern.test(specifier));

export const scanClientSourceText = (path, source) => {
  const findings = [];
  const report = (kind, detail, offset) => {
    const before = source.slice(0, offset);
    const line = (before.match(/\n/gu) ?? []).length + 1;
    const lastBreak = before.lastIndexOf('\n');
    const column = offset - lastBreak;
    findings.push({ path: normalize(path), line, column, kind, detail });
  };
  const scanner = createScanner(true, LanguageVariant.Standard, source);
  for (let token = scanner.scan(); token !== SyntaxKind.EndOfFile; token = scanner.scan()) {
    const offset = scanner.getTokenStart();
    const text = scanner.getTokenValue();
    if ([
      SyntaxKind.StringLiteral,
      SyntaxKind.NoSubstitutionTemplateLiteral,
      SyntaxKind.TemplateHead,
      SyntaxKind.TemplateMiddle,
      SyntaxKind.TemplateTail
    ].includes(token)) {
      if (forbiddenImport(text)) report('FORBIDDEN_DATA_IMPORT', text, offset);
      if (text === 'electron' && normalize(path).includes('/renderer/')) {
        report('RENDERER_ELECTRON_IMPORT', 'electron', offset);
      }
      if (RAW_SQL.test(text)) report('RAW_SQL_LITERAL', text.slice(0, 120), offset);
    }
    if (token === SyntaxKind.Identifier && ['DatabaseSync', 'openDatabase'].includes(text)) {
      report('SQLITE_RUNTIME_SYMBOL', text, offset);
    }
  }
  return findings;
};

const collectFiles = async (path) => {
  if (sourceExtensions.has(extname(path))) return [path];
  const files = [];
  const visit = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const candidate = join(directory, entry.name);
      if (entry.isDirectory()) await visit(candidate);
      else if (entry.isFile() && sourceExtensions.has(extname(entry.name))) files.push(candidate);
    }
  };
  await visit(path);
  return files;
};

export const scanClientDataAccessBoundary = async (root = process.cwd()) => {
  const files = [];
  for (const zone of DEFAULT_CLIENT_ZONES) files.push(...await collectFiles(resolve(root, zone)));
  const findings = [];
  for (const file of files) findings.push(...scanClientSourceText(relative(root, file), await readFile(file, 'utf8')));
  return { files: files.length, zones: DEFAULT_CLIENT_ZONES.length, findings };
};

const selfTest = () => {
  const cases = [
    ["import { SqliteThing } from '@ppt/repositories';", 'FORBIDDEN_DATA_IMPORT'],
    ["import { DatabaseSync } from 'node:sqlite';", 'FORBIDDEN_DATA_IMPORT'],
    ["import { readFileSync } from 'node:fs';", 'FORBIDDEN_DATA_IMPORT'],
    ["import db from '../../../../packages/database/src/index.js';", 'FORBIDDEN_DATA_IMPORT'],
    ["const sql = 'SELECT secret FROM family_data';", 'RAW_SQL_LITERAL'],
    ["import vault from '../main/user-data-vault.js';", 'FORBIDDEN_DATA_IMPORT']
  ];
  const failures = cases.filter(([source, kind]) => !scanClientSourceText('apps/example/src/renderer/probe.ts', source)
    .some((finding) => finding.kind === kind));
  if (failures.length) throw new Error(`Client boundary self-test failed: ${failures.length}/${cases.length}`);
  return cases.length;
};

const main = async () => {
  const assertions = selfTest();
  const rootArgument = process.argv.indexOf('--root');
  const root = rootArgument >= 0 ? resolve(process.argv[rootArgument + 1]) : process.cwd();
  const result = await scanClientDataAccessBoundary(root);
  const report = {
    status: result.findings.length === 0 ? 'PASS' : 'FAIL',
    clientZones: result.zones,
    scannedFiles: result.files,
    selfTestAssertions: assertions,
    directAccessExceptions: 0,
    findings: result.findings
  };
  console.log(JSON.stringify(report, null, 2));
  if (result.findings.length) process.exitCode = 1;
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) await main();
