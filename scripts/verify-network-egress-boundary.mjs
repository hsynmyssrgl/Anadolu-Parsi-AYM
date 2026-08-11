import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const AUTHORIZED_EGRESS_ADAPTER = 'apps/desktop/src/main/secure-revocation-list-fetcher.ts';
const AUTHORIZED_EGRESS_USE_CASE = 'apps/desktop/src/main/governed-network-egress-use-case.ts';
const AUTHORIZED_EGRESS_CALLER = 'apps/desktop/src/main/secure-revocation-sync-service.ts';
const LOCAL_TRANSPORT_FILES = new Set([
  'apps/core-service/src/local-admin-server.ts',
  'packages/core-service-client/src/local-admin-client.ts'
]);
const NETWORK_MODULES = /^(?:node:)?(?:http|https|http2|net|tls|dgram|dns)(?:\/promises)?$/u;
const NETWORK_PACKAGES = new Set(['axios', 'got', 'undici', 'ws', 'node-fetch', 'superagent']);
const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const normalize = (value) => value.replaceAll('\\', '/');

export const scanNetworkEgressSourceText = (path, source) => {
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
    const text = match[2] ?? match[4];
    const offset = (match.index ?? 0) + match[0].lastIndexOf(text);
    if (NETWORK_MODULES.test(text)) {
      const adapterModule = normalizedPath === AUTHORIZED_EGRESS_ADAPTER && ['node:https', 'node:dns/promises', 'node:net'].includes(text);
      const localTransport = LOCAL_TRANSPORT_FILES.has(normalizedPath) && text === 'node:net';
      if (!adapterModule && !localTransport) report('DIRECT_NETWORK_MODULE', text, offset);
    }
    if (NETWORK_PACKAGES.has(text)) report('THIRD_PARTY_NETWORK_CLIENT', text, offset);
    if (/(?:^|\/)secure-revocation-list-fetcher(?:\.[cm]?[jt]s)?$/u.test(text) && normalizedPath !== AUTHORIZED_EGRESS_USE_CASE) {
      report('EGRESS_ADAPTER_IMPORT_OUTSIDE_USE_CASE', text, offset);
    }
    if (/(?:^|\/)governed-network-egress-use-case(?:\.[cm]?[jt]s)?$/u.test(text) && normalizedPath !== AUTHORIZED_EGRESS_CALLER) {
      report('EGRESS_USE_CASE_IMPORT_OUTSIDE_SYNC_SERVICE', text, offset);
    }
  }
  const globalPrimitivePattern = /\b(fetch|WebSocket|EventSource|XMLHttpRequest)\s*(?:\(|=|:)/gu;
  for (const match of source.matchAll(globalPrimitivePattern)) {
    report('GLOBAL_NETWORK_PRIMITIVE', match[1], match.index ?? 0);
  }
  return findings;
};

const collectProductionSources = async (root) => {
  const files = [];
  const zones = [];
  for (const parent of ['apps', 'packages']) {
    for (const entry of await readdir(resolve(root, parent), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sourceRoot = resolve(root, parent, entry.name, 'src');
      try {
        await readdir(sourceRoot);
      } catch {
        continue;
      }
      zones.push(sourceRoot);
    }
  }
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const candidate = join(directory, entry.name);
      if (entry.isDirectory()) await visit(candidate);
      else if (entry.isFile() && sourceExtensions.has(extname(entry.name))) files.push(candidate);
    }
  };
  for (const zone of zones) await visit(zone);
  return { zones, files };
};

export const scanNetworkEgressBoundary = async (root = process.cwd()) => {
  const { zones, files } = await collectProductionSources(root);
  const findings = [];
  for (const file of files) findings.push(...scanNetworkEgressSourceText(relative(root, file), await readFile(file, 'utf8')));
  for (const parent of ['apps', 'packages']) {
    for (const entry of await readdir(resolve(root, parent), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = resolve(root, parent, entry.name, 'package.json');
      let manifest;
      try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch { continue; }
      const dependencies = { ...(manifest.dependencies ?? {}), ...(manifest.optionalDependencies ?? {}) };
      for (const name of NETWORK_PACKAGES) if (dependencies[name]) findings.push({
        path: normalize(relative(root, manifestPath)), line: 1, column: 1,
        kind: 'THIRD_PARTY_NETWORK_DEPENDENCY', detail: name
      });
    }
  }
  return { zones: zones.length, files: files.length, findings };
};

const selfTest = () => {
  const cases = [
    ["import { request } from 'node:https';", 'DIRECT_NETWORK_MODULE'],
    ["import { connect } from 'node:net';", 'DIRECT_NETWORK_MODULE'],
    ["import axios from 'axios';", 'THIRD_PARTY_NETWORK_CLIENT'],
    ["const response = await fetch(url);", 'GLOBAL_NETWORK_PRIMITIVE'],
    ["import { fetchExternalBackupEvidenceRevocationList } from './secure-revocation-list-fetcher.js';", 'EGRESS_ADAPTER_IMPORT_OUTSIDE_USE_CASE'],
    ["import { fetchGovernedExternalBackupEvidenceRevocationList } from './governed-network-egress-use-case.js';", 'EGRESS_USE_CASE_IMPORT_OUTSIDE_SYNC_SERVICE']
  ];
  const failures = cases.filter(([source, kind]) => !scanNetworkEgressSourceText('apps/example/src/network-bypass.ts', source)
    .some((finding) => finding.kind === kind));
  if (failures.length) throw new Error(`Network egress boundary self-test failed: ${failures.length}/${cases.length}`);
  return cases.length;
};

const main = async () => {
  const assertions = selfTest();
  const rootArgument = process.argv.indexOf('--root');
  const root = rootArgument >= 0 ? resolve(process.argv[rootArgument + 1]) : process.cwd();
  const result = await scanNetworkEgressBoundary(root);
  const report = {
    status: result.findings.length === 0 ? 'PASS' : 'FAIL',
    productionSourceZones: result.zones,
    scannedFiles: result.files,
    selfTestAssertions: assertions,
    authorizedExternalEgressAdapters: 1,
    directPrimitiveExceptions: 0,
    localOnlyTransportFiles: LOCAL_TRANSPORT_FILES.size,
    findings: result.findings
  };
  console.log(JSON.stringify(report, null, 2));
  if (result.findings.length) process.exitCode = 1;
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) await main();
