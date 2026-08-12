import { mkdir, readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { parse } from '@babel/parser';

const GENERATED_CLIENT = 'packages/core-service-client/src/generated-policy-client.ts';
const APPLICATION_ADAPTER = 'apps/desktop/src/main/core-service-application-adapter.ts';
const RAW_METHOD_ALLOWLIST = new Set([
  'packages/core-service-contracts/src/index.ts',
  GENERATED_CLIENT,
  'apps/core-service/src/core-service-method-dispatcher.ts'
]);
const CANONICAL_FACTORY_CONSUMERS = Object.freeze([
  'apps/desktop/src/main/archive-production-policy-runtime.ts',
  'apps/desktop/src/main/desktop-universal-api-policy-enforcement.ts',
  'apps/desktop/src/main/finance-production-policy-runtime.ts',
  'apps/desktop/src/main/health-production-policy-runtime.ts',
  'apps/desktop/src/main/life-production-policy-runtime.ts',
  'apps/desktop/src/main/location-production-policy-runtime.ts',
  'apps/desktop/src/main/timeline-production-policy-runtime.ts'
]);
const RAW_RESULT_TYPES = new Set([
  'PolicyAuthorizationContractResult',
  'PolicyReceiptVerificationContractResult'
]);
const POLICY_METHODS = new Set(['policy.authorize', 'policy.verify']);

const normalizePath = (value) => value.replaceAll('\\', '/');
const isCoreClientModule = (value) => value === '@ppt/core-service-client' || value.startsWith('@ppt/core-service-client/');
const isCoreContractsModule = (value) => value === '@ppt/core-service-contracts' || value.startsWith('@ppt/core-service-contracts/');
const isDesktopApplicationSource = (path) => path.startsWith('apps/desktop/src/');
const importedName = (specifier) => {
  if (specifier.type !== 'ImportSpecifier') return undefined;
  return specifier.imported.type === 'Identifier' ? specifier.imported.name : specifier.imported.value;
};
const localName = (specifier) => specifier.local?.name;
const staticString = (node) => {
  if (!node || typeof node !== 'object') return undefined;
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map((item) => item.value.cooked ?? item.value.raw).join('');
  }
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    const left = staticString(node.left);
    const right = staticString(node.right);
    return left === undefined || right === undefined ? undefined : `${left}${right}`;
  }
  return undefined;
};

const walk = (node, visit) => {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;
    if (Array.isArray(value)) value.forEach((item) => walk(item, visit));
    else if (value && typeof value === 'object' && typeof value.type === 'string') walk(value, visit);
  }
};

export const scanTypedPolicySdkBoundarySource = (inputPath, source) => {
  const path = normalizePath(inputPath);
  const findings = [];
  const pepBindings = new Set(['PlatformPolicyEnforcementPoint']);
  const policyNamespaces = new Set();
  const factoryBindings = new Set();
  let factoryImports = 0;
  let factoryCalls = 0;
  let sdkImports = 0;
  let generatedClientImports = 0;
  let ast;
  try {
    ast = parse(source, {
      sourceType: 'module',
      errorRecovery: false,
      plugins: ['typescript', 'jsx', 'importAttributes']
    });
  } catch (error) {
    return Object.freeze({
      path,
      findings: Object.freeze([{ rule: 'AST_PARSE_ERROR', detail: error instanceof Error ? error.message : String(error) }]),
      factoryImports,
      factoryCalls,
      sdkImports,
      generatedClientImports
    });
  }

  for (const statement of ast.program.body) {
    if (statement.type !== 'ImportDeclaration') continue;
    const moduleName = statement.source.value;
    if (moduleName === '@ppt/platform-policy') {
      for (const specifier of statement.specifiers) {
        if (specifier.type === 'ImportNamespaceSpecifier') policyNamespaces.add(specifier.local.name);
        const name = importedName(specifier);
        if (name === 'PlatformPolicyEnforcementPoint') {
          pepBindings.add(localName(specifier));
          if (
            path.startsWith('apps/desktop/src/main/')
            && statement.importKind !== 'type'
            && specifier.importKind !== 'type'
          ) {
            findings.push({ rule: 'DIRECT_PEP_IMPORT', detail: 'Production Desktop imported PlatformPolicyEnforcementPoint directly' });
          }
        }
        if (name === 'createTypedPolicyEnforcementPoint') {
          factoryBindings.add(localName(specifier));
          factoryImports += 1;
        }
      }
    }
    if (isCoreContractsModule(moduleName) && isDesktopApplicationSource(path)) {
      for (const specifier of statement.specifiers) {
        if (specifier.type === 'ImportNamespaceSpecifier') {
          findings.push({ rule: 'RAW_POLICY_CONTRACT_NAMESPACE_IMPORT', detail: 'Application namespace import could expose raw policy contract results' });
        }
        const name = importedName(specifier);
        if (RAW_RESULT_TYPES.has(name)) {
          findings.push({ rule: 'RAW_POLICY_RESULT_IMPORT', detail: `${name} escaped into an application source` });
        }
      }
    }
    if (isCoreClientModule(moduleName)) {
      for (const specifier of statement.specifiers) {
        if (specifier.type === 'ImportNamespaceSpecifier' && path !== APPLICATION_ADAPTER) {
          findings.push({ rule: 'GENERATED_CLIENT_NAMESPACE_ESCAPE', detail: 'Application namespace import could expose the generated policy client' });
        }
        const name = importedName(specifier);
        if (name === 'CoreServicePolicySdk') sdkImports += 1;
        if (name === 'GeneratedPolicyServiceClient') {
          generatedClientImports += 1;
          if (path !== APPLICATION_ADAPTER) {
            findings.push({ rule: 'GENERATED_CLIENT_ESCAPE', detail: 'Generated policy client may only be composed by the Core Service application adapter' });
          }
        }
      }
    }
  }

  for (const statement of ast.program.body) {
    if (statement.type !== 'ExportNamedDeclaration' || !statement.source) continue;
    const moduleName = statement.source.value;
    if (isCoreClientModule(moduleName) && statement.specifiers.some((specifier) =>
      specifier.type === 'ExportNamespaceSpecifier'
      || (specifier.type === 'ExportSpecifier' && (specifier.local.type === 'Identifier' ? specifier.local.name : specifier.local.value) === 'GeneratedPolicyServiceClient')
    )) {
      findings.push({ rule: 'GENERATED_CLIENT_REEXPORT_ESCAPE', detail: 'Generated policy client may not be re-exported through an application boundary' });
    }
    if (isCoreContractsModule(moduleName) && isDesktopApplicationSource(path) && statement.specifiers.some((specifier) =>
      specifier.type === 'ExportNamespaceSpecifier'
      || (specifier.type === 'ExportSpecifier' && RAW_RESULT_TYPES.has(specifier.local.type === 'Identifier' ? specifier.local.name : specifier.local.value))
    )) {
      findings.push({ rule: 'RAW_POLICY_RESULT_REEXPORT', detail: 'Raw policy contract results may not be re-exported through an application boundary' });
    }
  }

  walk(ast.program, (node) => {
    const resolvedString = staticString(node);
    if (resolvedString !== undefined && POLICY_METHODS.has(resolvedString) && !RAW_METHOD_ALLOWLIST.has(path)) {
      findings.push({ rule: 'RAW_POLICY_METHOD_LITERAL', detail: `Raw policy wire method ${resolvedString} is outside the generated or server boundary` });
    }
    if (node.type === 'NewExpression' && path.startsWith('apps/desktop/src/main/')) {
      if (node.callee.type === 'Identifier' && pepBindings.has(node.callee.name)) {
        findings.push({ rule: 'DIRECT_PEP_CONSTRUCTION', detail: 'PlatformPolicyEnforcementPoint was constructed directly' });
      }
      if (
        node.callee.type === 'MemberExpression'
        && node.callee.object.type === 'Identifier'
        && policyNamespaces.has(node.callee.object.name)
        && (
          (!node.callee.computed && node.callee.property.type === 'Identifier' && node.callee.property.name === 'PlatformPolicyEnforcementPoint')
          || (node.callee.computed && staticString(node.callee.property) === 'PlatformPolicyEnforcementPoint')
        )
      ) {
        findings.push({ rule: 'DIRECT_PEP_CONSTRUCTION', detail: 'Namespaced PlatformPolicyEnforcementPoint was constructed directly' });
      }
    }
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && factoryBindings.has(node.callee.name)) {
      factoryCalls += 1;
    }
  });

  return Object.freeze({
    path,
    findings: Object.freeze(findings),
    factoryImports,
    factoryCalls,
    sdkImports,
    generatedClientImports
  });
};

const listProductionSources = async (root) => {
  const files = [];
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === 'dist' || entry.name === 'node_modules') continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'].includes(extname(entry.name)) && !entry.name.endsWith('.d.ts')) files.push(absolute);
    }
  };
  for (const zone of ['apps', 'packages']) {
    const zoneRoot = resolve(root, zone);
    for (const workspace of await readdir(zoneRoot, { withFileTypes: true })) {
      if (!workspace.isDirectory()) continue;
      const sourceRoot = join(zoneRoot, workspace.name, 'src');
      try {
        await visit(sourceRoot);
      } catch (error) {
        if (!error || typeof error !== 'object' || error.code !== 'ENOENT') throw error;
      }
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
};

const selfTest = () => {
  const malicious = [
    ["import { PlatformPolicyEnforcementPoint as P } from '@ppt/platform-policy'; new P({});", 'DIRECT_PEP_IMPORT'],
    ["import { PlatformPolicyEnforcementPoint as P } from '@ppt/platform-policy'; new P({});", 'DIRECT_PEP_CONSTRUCTION'],
    ["import * as policy from '@ppt/platform-policy'; new policy.PlatformPolicyEnforcementPoint({});", 'DIRECT_PEP_CONSTRUCTION'],
    ["client.request('policy.authorize', payload);", 'RAW_POLICY_METHOD_LITERAL'],
    ["const method = 'policy.verify';", 'RAW_POLICY_METHOD_LITERAL'],
    ["import type { PolicyAuthorizationContractResult } from '@ppt/core-service-contracts';", 'RAW_POLICY_RESULT_IMPORT'],
    ["import type { PolicyReceiptVerificationContractResult as Result } from '@ppt/core-service-contracts';", 'RAW_POLICY_RESULT_IMPORT'],
    ["import { GeneratedPolicyServiceClient } from '@ppt/core-service-client';", 'GENERATED_CLIENT_ESCAPE'],
    ["import * as policy from '@ppt/platform-policy'; new policy['PlatformPolicyEnforcementPoint']({});", 'DIRECT_PEP_CONSTRUCTION'],
    ["const method = 'policy.' + 'authorize';", 'RAW_POLICY_METHOD_LITERAL'],
    ["const method = `policy.verify`;", 'RAW_POLICY_METHOD_LITERAL'],
    ["import * as client from '@ppt/core-service-client'; new client.GeneratedPolicyServiceClient(transport);", 'GENERATED_CLIENT_NAMESPACE_ESCAPE'],
    ["import * as contracts from '@ppt/core-service-contracts'; let result: contracts.PolicyAuthorizationContractResult;", 'RAW_POLICY_CONTRACT_NAMESPACE_IMPORT'],
    ["export { GeneratedPolicyServiceClient } from '@ppt/core-service-client';", 'GENERATED_CLIENT_REEXPORT_ESCAPE']
  ];
  const maliciousFailures = malicious.filter(([source, rule]) =>
    !scanTypedPolicySdkBoundarySource('apps/desktop/src/main/escape.ts', source).findings.some((finding) => finding.rule === rule)
  );
  if (maliciousFailures.length) throw new Error(`PPK-026 malicious self-test failed: ${maliciousFailures.length}/${malicious.length}`);

  const benign = [
    ["import { createTypedPolicyEnforcementPoint as createPoint } from '@ppt/platform-policy'; createPoint({ provider });", 'apps/desktop/src/main/finance-production-policy-runtime.ts'],
    ["const label = 'policy authorized';", 'apps/desktop/src/main/labels.ts'],
    ["transport.request('policy.authorize', payload);", GENERATED_CLIENT],
    ["import { GeneratedPolicyServiceClient, CoreServicePolicySdk } from '@ppt/core-service-client';", APPLICATION_ADAPTER]
  ];
  const benignFailures = benign.filter(([source, path]) => scanTypedPolicySdkBoundarySource(path, source).findings.length !== 0);
  if (benignFailures.length) throw new Error(`PPK-026 benign self-test failed: ${benignFailures.length}/${benign.length}`);
  return Object.freeze({ malicious: malicious.length, benign: benign.length });
};

export const verifyTypedPolicySdkBoundary = async (root = process.cwd()) => {
  const assertions = selfTest();
  const files = await listProductionSources(root);
  const scans = await Promise.all(files.map(async (absolute) => {
    const path = normalizePath(relative(root, absolute));
    return scanTypedPolicySdkBoundarySource(path, await readFile(absolute, 'utf8'));
  }));
  const findings = scans.flatMap((scan) => scan.findings.map((finding) => ({ path: scan.path, ...finding })));
  for (const path of CANONICAL_FACTORY_CONSUMERS) {
    const scan = scans.find((item) => item.path === path);
    if (!scan || scan.factoryImports !== 1 || scan.factoryCalls < 1) {
      findings.push({ path, rule: 'CANONICAL_FACTORY_MISSING', detail: 'Production policy consumer is not composed through the typed SDK factory' });
    }
  }
  const adapter = scans.find((item) => item.path === APPLICATION_ADAPTER);
  if (!adapter || adapter.sdkImports !== 1 || adapter.generatedClientImports !== 1) {
    findings.push({ path: APPLICATION_ADAPTER, rule: 'SDK_COMPOSITION_MISSING', detail: 'Core Service application adapter must compose the generated client and typed SDK exactly once' });
  }
  const generated = scans.find((item) => item.path === GENERATED_CLIENT);
  const generatedText = await readFile(resolve(root, GENERATED_CLIENT), 'utf8');
  if (!generated || [...POLICY_METHODS].some((method) => !generatedText.includes(`'${method}'`))) {
    findings.push({ path: GENERATED_CLIENT, rule: 'GENERATED_METHOD_SET_INCOMPLETE', detail: 'Generated client does not contain the exact governed policy method set' });
  }
  findings.sort((left, right) => `${left.path}|${left.rule}`.localeCompare(`${right.path}|${right.rule}`));
  return Object.freeze({
    schemaVersion: 1,
    step: '32-V',
    requirement: 'PPK-026',
    status: findings.length === 0 ? 'PASS' : 'FAIL',
    scannedProductionFiles: scans.length,
    canonicalFactoryConsumers: CANONICAL_FACTORY_CONSUMERS.length,
    maliciousSelfTestAssertions: assertions.malicious,
    benignSelfTestAssertions: assertions.benign,
    findings: Object.freeze(findings)
  });
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const report = await verifyTypedPolicySdkBoundary();
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/32-V-ppk-026-typed-policy-sdk-boundary.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
}
