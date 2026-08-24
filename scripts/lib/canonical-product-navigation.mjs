import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { parse as parseTypeScript } from '@babel/parser';

export const CANONICAL_PRODUCT_NAVIGATION_SOURCE = 'packages/domain/src/product-surface-governance.ts';

const fail = (message) => { throw new Error(message); };
const check = (condition, message) => { if (!condition) fail(message); };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const portable = (value) => value.replaceAll('\\', '/');
const normalize = (value) => resolve(value).replaceAll('/', '\\').toLowerCase();

const assertNoReparsePath = async (root, target) => {
  const segments = relative(root, target).split(/[\\/]/u).filter(Boolean);
  check(!segments.some((segment) => segment === '..'), 'Kanonik rota kaynağı depo dışına çıkıyor.');
  let cursor = resolve(root);
  for (const segment of ['', ...segments]) {
    if (segment) cursor = resolve(cursor, segment);
    const item = await lstat(cursor);
    check(!item.isSymbolicLink(), `Kanonik rota kaynağında reparse/symlink yasaktır: ${cursor}`);
  }
  check(normalize(await realpath(target)) === normalize(target), 'Kanonik rota kaynağının realpath değeri değişti.');
};

const unwrap = (node) => {
  let current = node;
  while (['TSAsExpression', 'TSSatisfiesExpression', 'TSTypeAssertion', 'ParenthesizedExpression'].includes(current?.type)) {
    current = current.expression;
  }
  if (current?.type === 'CallExpression' && current.callee?.type === 'MemberExpression' && current.callee.computed === false
    && current.callee.object?.type === 'Identifier' && current.callee.object.name === 'Object'
    && current.callee.property?.type === 'Identifier' && current.callee.property.name === 'freeze'
    && current.arguments.length === 1) return unwrap(current.arguments[0]);
  return current;
};

const literalObject = (node, expectedKeys, label) => {
  const object = unwrap(node);
  check(object?.type === 'ObjectExpression', `${label} yalnız literal nesneler içermelidir.`);
  const result = {};
  for (const property of object.properties) {
    check(property.type === 'ObjectProperty' && property.computed === false && property.shorthand === false,
      `${label} spread/metot/kısaltma içeremez.`);
    check(property.key?.type === 'Identifier' || property.key?.type === 'StringLiteral', `${label} hesaplanan anahtar içeremez.`);
    const key = property.key.name ?? property.key.value;
    check(!Object.hasOwn(result, key), `${label} yinelenen anahtar içeriyor: ${key}`);
    const value = unwrap(property.value);
    check(value?.type === 'StringLiteral', `${label}.${key} literal metin olmalıdır.`);
    result[key] = value.value;
  }
  check(JSON.stringify(Object.keys(result).sort()) === JSON.stringify([...expectedKeys].sort()), `${label} alan envanteri exact değil.`);
  return Object.freeze(result);
};

export const parseCanonicalProductNavigationSource = (sourceText, fileName = CANONICAL_PRODUCT_NAVIGATION_SOURCE) => {
  let sourceFile;
  try { sourceFile = parseTypeScript(sourceText, { sourceType: 'module', sourceFilename: fileName, plugins: ['typescript'] }); }
  catch { fail('Kanonik rota TypeScript kaynağı parse edilemedi.'); }
  const initializers = new Map();
  const targetNames = new Set(['PRODUCT_NAVIGATION_GROUPS', 'PRODUCT_NAVIGATION_ROUTES']);
  for (const rawStatement of sourceFile.program.body) {
    const statement = rawStatement.type === 'ExportNamedDeclaration' ? rawStatement.declaration : rawStatement;
    if (statement?.type !== 'VariableDeclaration') continue;
    for (const declaration of statement.declarations) {
      if (declaration.id?.type !== 'Identifier' || !targetNames.has(declaration.id.name)) continue;
      check(rawStatement.type === 'ExportNamedDeclaration' && statement.kind === 'const' && declaration.init,
        `${declaration.id.name} exported const literal declaration olmalıdır.`);
      check(!initializers.has(declaration.id.name), `${declaration.id.name} yinelenen declaration içeriyor.`);
      initializers.set(declaration.id.name, declaration.init);
    }
  }
  const parseArray = (name, keys, expectedCount) => {
    const expression = unwrap(initializers.get(name));
    check(expression?.type === 'ArrayExpression', `${name} literal dizi değildir.`);
    check(expression.elements.length === expectedCount, `${name} sayısı ${expectedCount} değildir.`);
    return Object.freeze(expression.elements.map((element, index) => literalObject(element, keys, `${name}[${index}]`)));
  };
  const groups = parseArray('PRODUCT_NAVIGATION_GROUPS', ['id', 'label', 'englishLabel'], 4);
  const routes = parseArray('PRODUCT_NAVIGATION_ROUTES', ['id', 'label', 'englishLabel', 'icon', 'groupId', 'kind'], 22);
  check(new Set(groups.map(({ id }) => id)).size === 4, 'Kanonik grup kimlikleri benzersiz değildir.');
  check(new Set(routes.map(({ id }) => id)).size === 22, 'Kanonik rota kimlikleri benzersiz değildir.');
  const groupIds = new Set(groups.map(({ id }) => id));
  check(routes.every(({ groupId }) => groupIds.has(groupId)), 'Kanonik rota bilinmeyen gruba bağlıdır.');
  check(routes.every(({ kind }) => kind === 'product-module' || kind === 'governance-surface'), 'Kanonik rota kind değeri geçersizdir.');
  return Object.freeze({ groups, routes });
};

export const loadCanonicalProductNavigation = async ({ root = resolve(import.meta.dirname, '../..') } = {}) => {
  const sourcePath = resolve(root, CANONICAL_PRODUCT_NAVIGATION_SOURCE);
  await assertNoReparsePath(root, sourcePath);
  const git = (args) => execFileSync('git', ['-c', `safe.directory=${portable(root)}`, ...args], { cwd: root, encoding: null });
  const tracked = git(['ls-files', '--error-unmatch', '--', CANONICAL_PRODUCT_NAVIGATION_SOURCE]).toString('utf8').trim();
  check(tracked === CANONICAL_PRODUCT_NAVIGATION_SOURCE, 'Kanonik rota kaynağı Git tracked değildir.');
  const treeLine = git(['ls-tree', 'HEAD', '--', CANONICAL_PRODUCT_NAVIGATION_SOURCE]).toString('utf8').trim();
  const treeMatch = /^(100644|100755) blob ([a-f0-9]{40,64})\t(.+)$/u.exec(treeLine);
  check(treeMatch?.[3] === CANONICAL_PRODUCT_NAVIGATION_SOURCE, 'Kanonik rota kaynağı exact HEAD blob değildir.');
  const [headBytes, liveBytes] = await Promise.all([
    Promise.resolve(git(['show', `HEAD:${CANONICAL_PRODUCT_NAVIGATION_SOURCE}`])),
    readFile(sourcePath)
  ]);
  check(headBytes.equals(liveBytes), 'Kanonik rota kaynağı HEAD blobundan sapmış durumda.');
  const parsed = parseCanonicalProductNavigationSource(liveBytes.toString('utf8'));
  return Object.freeze({ ...parsed, authority: Object.freeze({
    sourcePath: CANONICAL_PRODUCT_NAVIGATION_SOURCE,
    gitBlob: treeMatch[2],
    sizeBytes: liveBytes.length,
    sha256: sha256(liveBytes)
  }) });
};

const canonical = await loadCanonicalProductNavigation();
export const PRODUCT_NAVIGATION_GROUPS = canonical.groups;
export const PRODUCT_NAVIGATION_ROUTES = canonical.routes;
export const CANONICAL_PRODUCT_NAVIGATION_AUTHORITY = canonical.authority;
