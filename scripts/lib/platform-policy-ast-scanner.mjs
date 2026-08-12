import { parse } from '@babel/parser';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const SQL_MODULES = new Set(['node:sqlite', 'sqlite', 'sqlite3', 'better-sqlite3']);
const CRYPTO_MODULES = new Set(['node:crypto', 'crypto']);
const NETWORK_MODULES = new Set([
  'node:net', 'net', 'node:http', 'http', 'node:https', 'https', 'node:http2', 'http2',
  'node:tls', 'tls', 'node:dgram', 'dgram', 'undici'
]);
const ROLE_LITERALS = new Set(['family_admin', 'adult_member', 'limited_member', 'caregiver', 'advisor']);
const SQL_START = /^\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|PRAGMA|VACUUM|WITH|BEGIN|COMMIT|ROLLBACK|REINDEX|ANALYZE)\b/iu;
const CRYPTO_METHODS = new Set([
  'createCipheriv', 'createDecipheriv', 'createHash', 'createHmac', 'createPrivateKey',
  'createPublicKey', 'decrypt', 'deriveBits', 'deriveKey', 'digest', 'encrypt',
  'generateKey', 'generateKeyPair', 'getRandomValues', 'hkdf', 'pbkdf2', 'randomBytes',
  'randomFill', 'randomInt', 'randomUUID', 'scrypt', 'sign', 'timingSafeEqual', 'verify'
]);
const NETWORK_GLOBALS = new Set(['fetch', 'WebSocket', 'EventSource', 'XMLHttpRequest']);
const COMPARISON_OPERATORS = new Set(['==', '===', '!=', '!==']);

export const normalizeAstGatePath = (value) => value.replaceAll('\\', '/');

const nodeLine = (node) => node?.loc?.start?.line ?? 1;
const literalString = (node) => {
  if (node?.type === 'StringLiteral') return node.value;
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map((item) => item.value.cooked ?? item.value.raw).join('');
  }
  return undefined;
};

const unwrapExpression = (node) => {
  let current = node;
  while (current && [
    'TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TypeCastExpression',
    'ParenthesizedExpression', 'TSInstantiationExpression', 'ChainExpression'
  ].includes(current.type)) current = current.expression;
  return current;
};

const memberName = (node) => {
  const current = unwrapExpression(node);
  if (!current || !['MemberExpression', 'OptionalMemberExpression'].includes(current.type)) return undefined;
  if (!current.computed && current.property?.type === 'Identifier') return current.property.name;
  return literalString(current.property);
};

const expressionName = (node) => {
  const current = unwrapExpression(node);
  if (!current) return '';
  if (current.type === 'Identifier') return current.name;
  if (current.type === 'ThisExpression') return 'this';
  if (['MemberExpression', 'OptionalMemberExpression'].includes(current.type)) {
    return `${expressionName(current.object)}.${memberName(current) ?? '?'}`;
  }
  return '';
};

const calleeName = (node) => {
  const current = unwrapExpression(node);
  if (!current) return '';
  if (current.type === 'Identifier') return current.name;
  if (['MemberExpression', 'OptionalMemberExpression'].includes(current.type)) return memberName(current) ?? '';
  return '';
};

const containsRoleReference = (node, roleAliases = new Set()) => {
  const current = unwrapExpression(node);
  if (!current || typeof current !== 'object') return false;
  if (current.type === 'Identifier') return roleAliases.has(current.name) || /(?:^|_)(?:family)?roles?$/iu.test(current.name) || /(?:current|account|auth|profile)Role/iu.test(current.name);
  if (['MemberExpression', 'OptionalMemberExpression'].includes(current.type)) {
    return /role/iu.test(memberName(current) ?? '') || containsRoleReference(current.object, roleAliases);
  }
  return false;
};

const staticSqlArgument = (node) => {
  const value = literalString(node);
  return value !== undefined && SQL_START.test(value);
};

const moduleCategory = (moduleName, symbol) => {
  if (SQL_MODULES.has(moduleName)) return 'SQL_IMPORT';
  if (moduleName === '@ppt/repositories' || /(?:^|\/)repositories(?:\/|$)/u.test(moduleName)) return 'REPOSITORY_IMPORT';
  if (moduleName === '@ppt/database' || /(?:^|\/)database(?:\/|$)/u.test(moduleName)) return 'DATABASE_IMPORT';
  if (CRYPTO_MODULES.has(moduleName)) return 'CRYPTO_IMPORT';
  if (NETWORK_MODULES.has(moduleName) || (moduleName === 'electron' && symbol === 'net')) return 'NETWORK_IMPORT';
  return undefined;
};

const importSymbols = (node) => {
  if (!node.specifiers?.length) return ['*side-effect*'];
  return node.specifiers.map((specifier) => {
    if (specifier.type === 'ImportDefaultSpecifier') return 'default';
    if (specifier.type === 'ImportNamespaceSpecifier') return '*';
    if (specifier.imported?.type === 'Identifier') return specifier.imported.name;
    return literalString(specifier.imported) ?? specifier.local?.name ?? '*unknown*';
  });
};

const walkAst = (node, visit) => {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'start', 'end', 'extra', 'errors', 'comments', 'tokens'].includes(key)) continue;
    if (Array.isArray(value)) {
      for (const child of value) walkAst(child, visit);
    } else if (value && typeof value === 'object') {
      walkAst(value, visit);
    }
  }
};

const makeObservation = (path, kind, detail, node, moduleName) => ({
  key: `${kind}|${path}|${detail}`,
  kind,
  path,
  detail,
  ...(moduleName === undefined ? {} : { module: moduleName }),
  line: nodeLine(node)
});

const parseProgram = (path, source) => parse(source, {
  sourceType: 'unambiguous',
  sourceFilename: path,
  errorRecovery: false,
  allowAwaitOutsideFunction: true,
  allowReturnOutsideFunction: true,
  plugins: [
    'typescript',
    ...(extname(path).toLowerCase().includes('x') ? ['jsx'] : []),
    'decorators-legacy',
    'importAttributes',
    'explicitResourceManagement'
  ]
});

export const scanPlatformPolicyAstSource = (pathInput, source) => {
  const path = normalizeAstGatePath(pathInput);
  const observations = [];
  const add = (kind, detail, node, moduleName) => observations.push(makeObservation(path, kind, detail, node, moduleName));
  let ast;
  try {
    ast = parseProgram(path, source);
  } catch (error) {
    return [{
      key: `AST_PARSE_ERROR|${path}|parse`,
      kind: 'AST_PARSE_ERROR',
      path,
      detail: error instanceof Error ? error.message : String(error),
      line: error?.loc?.line ?? 1
    }];
  }

  const roleAliases = new Set();
  const useCaseAliases = new Map();
  const networkAliases = new Map([...NETWORK_GLOBALS].map((name) => [name, name]));
  const cryptoAliases = new Set(['crypto']);
  for (let pass = 0; pass < 2; pass += 1) {
    walkAst(ast.program, (node) => {
      if (node.type === 'ImportDeclaration') {
        for (const specifier of node.specifiers ?? []) {
          const imported = specifier.imported?.name ?? literalString(specifier.imported);
          if (imported && /UseCase$/u.test(imported) && specifier.local?.name) useCaseAliases.set(specifier.local.name, imported);
        }
      }
      if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier') {
        const initializer = unwrapExpression(node.init);
        if (initializer && (containsRoleReference(initializer, roleAliases) || memberName(initializer) === 'role')) roleAliases.add(node.id.name);
        const initializerName = calleeName(initializer);
        if (/UseCase$/u.test(initializerName)) useCaseAliases.set(node.id.name, initializerName);
        else if (useCaseAliases.has(initializerName)) useCaseAliases.set(node.id.name, useCaseAliases.get(initializerName));
        const initializerExpression = expressionName(initializer);
        const networkName = networkAliases.get(initializerName)
          ?? (/(?:^|\.)(?:fetch|WebSocket|EventSource|XMLHttpRequest)$/u.test(initializerExpression) ? initializerExpression.split('.').at(-1) : undefined);
        if (networkName) networkAliases.set(node.id.name, networkName);
        if (cryptoAliases.has(initializerName) || /(?:^|\.)crypto$/iu.test(initializerExpression)) cryptoAliases.add(node.id.name);
        if (['prepare', 'exec', 'pragma', 'transaction'].includes(memberName(initializer) ?? '')) {
          add('SQL_METHOD_ALIAS', memberName(initializer), node);
        }
      }
      if (node.type === 'ObjectProperty' && (node.key?.name === 'role' || literalString(node.key) === 'role')) {
        const value = unwrapExpression(node.value);
        if (value?.type === 'Identifier') roleAliases.add(value.name);
        if (value?.type === 'AssignmentPattern' && value.left?.type === 'Identifier') roleAliases.add(value.left.name);
      }
      if (node.type === 'ObjectProperty' && NETWORK_GLOBALS.has(node.key?.name ?? literalString(node.key))) {
        const value = unwrapExpression(node.value);
        if (value?.type === 'Identifier') networkAliases.set(value.name, node.key?.name ?? literalString(node.key));
      }
      if (node.type === 'AssignmentExpression' && node.left?.type === 'Identifier' && containsRoleReference(node.right, roleAliases)) {
        roleAliases.add(node.left.name);
      }
    });
  }

  walkAst(ast.program, (node) => {
    if (node.type === 'ImportDeclaration') {
      const moduleName = literalString(node.source);
      if (!moduleName) return;
      for (const symbol of importSymbols(node)) {
        const kind = moduleCategory(moduleName, symbol);
        if (kind) add(kind, `${moduleName}:${symbol}`, node, moduleName);
      }
      return;
    }

    if (['ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) {
      const moduleName = literalString(node.source);
      if (!moduleName) return;
      const symbols = node.type === 'ExportAllDeclaration'
        ? ['*re-export*']
        : (node.specifiers?.map((item) => item.local?.name ?? item.exported?.name ?? '*re-export*') ?? ['*re-export*']);
      for (const symbol of symbols) {
        const kind = moduleCategory(moduleName, symbol);
        if (kind) add(kind, `${moduleName}:${symbol}`, node, moduleName);
      }
      return;
    }

    if (node.type === 'TSImportEqualsDeclaration' && node.moduleReference?.type === 'TSExternalModuleReference') {
      const moduleName = literalString(node.moduleReference.expression);
      const symbol = node.id?.name ?? '*import-equals*';
      const kind = moduleName ? moduleCategory(moduleName, '*') : undefined;
      if (kind) add(kind, `${moduleName}:${symbol}`, node, moduleName);
      return;
    }

    if (node.type === 'ImportExpression') {
      const moduleName = literalString(node.source);
      const kind = moduleName ? moduleCategory(moduleName, '*dynamic*') : undefined;
      if (kind) add(kind, `${moduleName}:*dynamic*`, node, moduleName);
      return;
    }

    if (node.type === 'CallExpression' || node.type === 'OptionalCallExpression') {
      const callee = unwrapExpression(node.callee);
      if (callee?.type === 'Import') {
        const moduleName = literalString(node.arguments?.[0]);
        const kind = moduleName ? moduleCategory(moduleName, '*dynamic*') : undefined;
        if (kind) add(kind, `${moduleName}:*dynamic*`, node, moduleName);
        else if (!moduleName) add('DYNAMIC_IMPORT_UNRESOLVED', 'import', node);
      }
      if (callee?.type === 'Identifier' && callee.name === 'require') {
        const moduleName = literalString(node.arguments?.[0]);
        const kind = moduleName ? moduleCategory(moduleName, '*require*') : undefined;
        if (kind) add(kind, `${moduleName}:*require*`, node, moduleName);
        else if (!moduleName) add('DYNAMIC_IMPORT_UNRESOLVED', 'require', node);
      }

      const property = memberName(callee);
      if (property === 'prepare') {
        const receiver = expressionName(callee?.object);
        if (staticSqlArgument(node.arguments?.[0]) || /(?:^|\.)(?:db|database|sqlite|connection|store|transaction)$/iu.test(receiver)) {
          add('SQL_CALL', 'prepare', node);
        }
      }
      if (property === 'exec') {
        const receiver = expressionName(callee?.object);
        if (staticSqlArgument(node.arguments?.[0]) || /(?:^|\.)(?:db|database|sqlite|connection)$/iu.test(receiver)) {
          add('SQL_CALL', 'exec', node);
        }
      }
      if (property === 'pragma' || property === 'transaction') add('SQL_CALL', property, node);

      const directName = calleeName(callee);
      if (callee?.type === 'Identifier' && networkAliases.has(directName)) add('NETWORK_GLOBAL', networkAliases.get(directName), node);
      if (property && NETWORK_GLOBALS.has(property) && /^(?:globalThis|window|self)$/u.test(expressionName(callee?.object))) add('NETWORK_GLOBAL', property, node);
      if (property === 'sendBeacon' && /(?:^|\.)navigator$/u.test(expressionName(callee?.object))) add('NETWORK_GLOBAL', 'sendBeacon', node);

      if (property && CRYPTO_METHODS.has(property)) {
        const receiver = expressionName(callee?.object);
        const root = receiver.split('.')[0] ?? '';
        if (cryptoAliases.has(root) || /(?:^|\.)crypto(?:\.subtle)?$/iu.test(receiver)) add('CRYPTO_GLOBAL', property, node);
      }

      if (property === 'construct' && expressionName(callee?.object) === 'Reflect') {
        const targetName = calleeName(node.arguments?.[0]);
        const canonicalUseCaseName = useCaseAliases.get(targetName) ?? targetName;
        if (/UseCase$/u.test(canonicalUseCaseName)) add('USE_CASE_COMPOSITION', canonicalUseCaseName, node);
      }

      if (property === 'includes' || property === 'has') {
        const role = literalString(node.arguments?.[0]);
        if (role && ROLE_LITERALS.has(role) && containsRoleReference(callee?.object, roleAliases)) {
          add(path.startsWith('apps/desktop/src/renderer/') ? 'ROLE_PRESENTATION' : 'ROLE_CHECK', role, node);
        }
      }
      return;
    }

    if (node.type === 'NewExpression') {
      const name = calleeName(node.callee);
      const canonicalUseCaseName = useCaseAliases.get(name) ?? name;
      if (/UseCase$/u.test(canonicalUseCaseName)) add('USE_CASE_COMPOSITION', canonicalUseCaseName, node);
      if (name === 'DatabaseSync' || name === 'Database') add('SQL_CONSTRUCTOR', name, node);
      if (networkAliases.has(name)) add('NETWORK_GLOBAL', networkAliases.get(name), node);
      return;
    }

    if (node.type === 'TaggedTemplateExpression' && calleeName(node.tag) === 'sql') {
      add('SQL_TAGGED_TEMPLATE', 'sql', node);
      return;
    }

    if (node.type === 'BinaryExpression' && COMPARISON_OPERATORS.has(node.operator)) {
      const leftRole = literalString(node.left);
      const rightRole = literalString(node.right);
      const role = ROLE_LITERALS.has(leftRole) && containsRoleReference(node.right, roleAliases)
        ? leftRole
        : ROLE_LITERALS.has(rightRole) && containsRoleReference(node.left, roleAliases) ? rightRole : undefined;
      if (role) add(path.startsWith('apps/desktop/src/renderer/') ? 'ROLE_PRESENTATION' : 'ROLE_CHECK', role, node);
      return;
    }

    if (node.type === 'SwitchStatement' && containsRoleReference(node.discriminant, roleAliases)) {
      for (const item of node.cases ?? []) {
        const role = literalString(item.test);
        if (role && ROLE_LITERALS.has(role)) {
          add(path.startsWith('apps/desktop/src/renderer/') ? 'ROLE_PRESENTATION' : 'ROLE_CHECK', role, item);
        }
      }
    }
  });

  const unique = new Map();
  for (const item of observations) {
    const current = unique.get(item.key);
    if (!current || item.line < current.line) unique.set(item.key, item);
  }
  return [...unique.values()].sort((left, right) => left.key.localeCompare(right.key, 'en'));
};

export const collectPlatformPolicyProductionSources = async (root = process.cwd()) => {
  const zones = [];
  const files = [];
  for (const parent of ['apps', 'packages']) {
    const directory = resolve(root, parent);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sourceRoot = resolve(directory, entry.name, 'src');
      try { await readdir(sourceRoot); } catch { continue; }
      zones.push(sourceRoot);
    }
  }
  const visit = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const candidate = join(directory, entry.name);
      if (entry.isDirectory()) await visit(candidate);
      else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase())) files.push(candidate);
    }
  };
  for (const zone of zones) await visit(zone);
  return { zones, files };
};

export const inventoryPlatformPolicyAstSurfaces = async (root = process.cwd()) => {
  const { zones, files } = await collectPlatformPolicyProductionSources(root);
  const observations = [];
  for (const file of files) {
    const path = normalizeAstGatePath(relative(root, file));
    observations.push(...scanPlatformPolicyAstSource(path, await readFile(file, 'utf8')));
  }
  observations.sort((left, right) => left.key.localeCompare(right.key, 'en'));
  return { zones: zones.length, files: files.length, observations };
};

const hasWildcard = (value) => /[*?\[\]{}]/u.test(value);

export const evaluatePlatformPolicyAstAllowlist = (inventory, manifest) => {
  const findings = [];
  const entries = Array.isArray(manifest?.allowedSurfaceKeys) ? manifest.allowedSurfaceKeys : [];
  const allowed = new Map();
  for (const key of entries) {
    const kind = typeof key === 'string' ? key.split('|', 1)[0] : '';
    const reason = manifest?.categoryRationales?.[kind];
    if (typeof key !== 'string' || key.split('|').length !== 3 || typeof reason !== 'string' || reason.trim().length < 12) {
      findings.push({ kind: 'ALLOWLIST_ENTRY_INVALID', key: String(key ?? ''), detail: 'Every exact key requires a meaningful category rationale.' });
      continue;
    }
    if (hasWildcard(key)) findings.push({ kind: 'ALLOWLIST_WILDCARD_FORBIDDEN', key, detail: 'Wildcard allowances are forbidden.' });
    if (allowed.has(key)) findings.push({ kind: 'ALLOWLIST_DUPLICATE', key, detail: 'Duplicate exact allowance.' });
    allowed.set(key, { key, reason });
  }

  const observed = new Map(inventory.observations.map((item) => [item.key, item]));
  for (const item of inventory.observations) {
    if (item.kind === 'AST_PARSE_ERROR') {
      findings.push({ kind: 'AST_PARSE_ERROR', key: item.key, path: item.path, line: item.line, detail: item.detail });
      continue;
    }
    if (item.kind === 'ROLE_CHECK') {
      findings.push({ kind: 'DIRECT_ROLE_AUTHORIZATION_FORBIDDEN', key: item.key, path: item.path, line: item.line, detail: item.detail });
      continue;
    }
    if (!allowed.has(item.key)) findings.push({ kind: 'UNAPPROVED_PRIVILEGED_SURFACE', key: item.key, path: item.path, line: item.line, detail: item.detail });
  }
  for (const key of entries) {
    if (typeof key === 'string' && !observed.has(key)) {
      findings.push({ kind: 'STALE_ALLOWLIST_ENTRY', key, detail: 'The exact privileged surface no longer exists.' });
    }
  }

  const requiredKinds = new Set([
    'SQL_IMPORT', 'SQL_CALL', 'SQL_CONSTRUCTOR', 'REPOSITORY_IMPORT', 'DATABASE_IMPORT',
    'CRYPTO_IMPORT', 'NETWORK_IMPORT', 'NETWORK_GLOBAL', 'ROLE_PRESENTATION', 'USE_CASE_COMPOSITION'
  ]);
  const observedKinds = new Set(inventory.observations.map((item) => item.kind));
  for (const kind of requiredKinds) {
    if (!observedKinds.has(kind) && !['NETWORK_GLOBAL', 'SQL_IMPORT'].includes(kind)) {
      findings.push({ kind: 'REQUIRED_SURFACE_CLASS_UNOBSERVED', key: kind, detail: 'Expected production surface class is absent; scanner drift is possible.' });
    }
  }
  if (manifest?.defaultDecision !== 'DENY' || manifest?.exactMatchRequired !== true || manifest?.wildcardsAllowed !== false) {
    findings.push({ kind: 'FAIL_CLOSED_MANIFEST_INVARIANT_MISSING', key: 'manifest', detail: 'Manifest must require exact default-deny matching without wildcards.' });
  }

  const counts = Object.fromEntries([...new Set(inventory.observations.map((item) => item.kind))]
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((kind) => [kind, inventory.observations.filter((item) => item.kind === kind).length]));
  return { findings, counts, allowedCount: entries.length };
};
