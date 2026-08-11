import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const AUTHORIZED_CLIENT_ADAPTER = 'apps/desktop/src/main/core-service-application-adapter.ts';
const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const forbiddenInternalImport = (specifier) => [
  /^@ppt\/core-service(?:\/|$)/u,
  /(?:^|\/)apps\/core-service\/src(?:\/|$)/u,
  /(?:^|\/)core-service\/src(?:\/|$)/u
].some((pattern) => pattern.test(specifier));
const normalize = (value) => value.replaceAll('\\', '/');

export const scanNonCoreApplicationSourceText = (path, source) => {
  const normalizedPath = normalize(path);
  const findings = [];
  const report = (kind, detail, offset) => {
    const before = source.slice(0, offset);
    const line = (before.match(/\n/gu) ?? []).length + 1;
    const lastBreak = before.lastIndexOf('\n');
    findings.push({ path: normalizedPath, line, column: offset - lastBreak, kind, detail });
  };
  const moduleSpecifierPattern = /\b(?:import|export)\s+(?:[\s\S]{0,2000}?\sfrom\s*)?(['"])([^'"\r\n]+)\1|\b(?:require|import)\s*\(\s*(['"])([^'"\r\n]+)\3\s*\)/gu;
  for (const match of source.matchAll(moduleSpecifierPattern)) {
    const specifier = match[2] ?? match[4];
    const offset = (match.index ?? 0) + match[0].lastIndexOf(specifier);
    if (forbiddenInternalImport(specifier)) report('CORE_SERVICE_INTERNAL_IMPORT', specifier, offset);
    if (specifier === '@ppt/core-service-client' && normalizedPath !== AUTHORIZED_CLIENT_ADAPTER) {
      report('CORE_SERVICE_CLIENT_OUTSIDE_ADAPTER', specifier, offset);
    }
  }
  if (normalizedPath !== AUTHORIZED_CLIENT_ADAPTER) {
    const directClient = /\bnew\s+CoreServiceLocalAdminClient\b/gu.exec(source);
    if (directClient) report('CORE_SERVICE_CLIENT_SYMBOL_OUTSIDE_ADAPTER', 'CoreServiceLocalAdminClient', directClient.index);
  }
  const directSocket = /\bcreateConnection\b/gu.exec(source);
  if (directSocket) {
    report('DIRECT_CORE_SERVICE_SOCKET_PRIMITIVE', 'createConnection', directSocket.index);
  }
  return findings;
};

const collectNonCoreApplicationSources = async (root) => {
  const applicationsRoot = resolve(root, 'apps');
  const applications = await readdir(applicationsRoot, { withFileTypes: true });
  const zones = applications
    .filter((entry) => entry.isDirectory() && entry.name !== 'core-service')
    .map((entry) => join(applicationsRoot, entry.name, 'src'));
  const files = [];
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && sourceExtensions.has(extname(entry.name))) files.push(path);
    }
  };
  for (const zone of zones) await visit(zone);
  return { zones, files };
};

export const scanVersionedCoreServiceApiBoundary = async (root = process.cwd()) => {
  const { zones, files } = await collectNonCoreApplicationSources(root);
  const findings = [];
  for (const file of files) {
    findings.push(...scanNonCoreApplicationSourceText(relative(root, file), await readFile(file, 'utf8')));
  }
  const applicationDirectories = await readdir(resolve(root, 'apps'), { withFileTypes: true });
  for (const entry of applicationDirectories.filter((item) => item.isDirectory() && item.name !== 'core-service')) {
    const manifestPath = join(root, 'apps', entry.name, 'package.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const dependencies = { ...(manifest.dependencies ?? {}), ...(manifest.optionalDependencies ?? {}) };
    if (dependencies['@ppt/core-service']) {
      findings.push({
        path: normalize(relative(root, manifestPath)), line: 1, column: 1,
        kind: 'CORE_SERVICE_IMPLEMENTATION_DEPENDENCY', detail: '@ppt/core-service'
      });
    }
  }
  return { zones: zones.length, files: files.length, findings };
};

const selfTest = () => {
  const cases = [
    ["import { CoreServiceRuntime } from '@ppt/core-service';", 'CORE_SERVICE_INTERNAL_IMPORT'],
    ["import { CoreServiceRuntime } from '../../core-service/src/core-service-runtime.js';", 'CORE_SERVICE_INTERNAL_IMPORT'],
    ["import { createConnection } from 'node:net';", 'DIRECT_CORE_SERVICE_SOCKET_PRIMITIVE'],
    ["import { CoreServiceLocalAdminClient } from '@ppt/core-service-client';", 'CORE_SERVICE_CLIENT_OUTSIDE_ADAPTER'],
    ["const client = new CoreServiceLocalAdminClient(options);", 'CORE_SERVICE_CLIENT_SYMBOL_OUTSIDE_ADAPTER']
  ];
  const failures = cases.filter(([source, kind]) => !scanNonCoreApplicationSourceText(
    'apps/example/src/main/direct-core-service.ts', source
  ).some((finding) => finding.kind === kind));
  if (failures.length) throw new Error(`Versioned Core Service API boundary self-test failed: ${failures.length}/${cases.length}`);
  return cases.length;
};

const main = async () => {
  const assertions = selfTest();
  const rootArgument = process.argv.indexOf('--root');
  const root = rootArgument >= 0 ? resolve(process.argv[rootArgument + 1]) : process.cwd();
  const result = await scanVersionedCoreServiceApiBoundary(root);
  const report = {
    status: result.findings.length === 0 ? 'PASS' : 'FAIL',
    nonCoreApplicationZones: result.zones,
    scannedFiles: result.files,
    selfTestAssertions: assertions,
    directImportExceptions: 0,
    findings: result.findings
  };
  console.log(JSON.stringify(report, null, 2));
  if (result.findings.length) process.exitCode = 1;
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) await main();
