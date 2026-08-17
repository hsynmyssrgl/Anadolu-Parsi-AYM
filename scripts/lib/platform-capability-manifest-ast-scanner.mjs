import { parse } from '@babel/parser';
import { readFile } from 'node:fs/promises';
import { extname, relative } from 'node:path';
import {
  collectPlatformPolicyProductionSources,
  normalizeAstGatePath
} from './platform-policy-ast-scanner.mjs';

const FILE_MODULES = new Set(['node:fs', 'fs', 'node:fs/promises', 'fs/promises']);
const NETWORK_MODULES = new Set([
  'node:net', 'net', 'node:http', 'http', 'node:https', 'https', 'node:http2', 'http2',
  'node:tls', 'tls', 'node:dgram', 'dgram', 'node:dns', 'dns', 'node:dns/promises',
  'dns/promises', 'undici'
]);
const CAMERA_MODULES = new Set(['node-webcam', 'webcamjs', 'camera-controls']);
const MICROPHONE_MODULES = new Set(['mic', 'naudiodon', 'node-record-lpcm16']);
const OCR_MODULE_PATTERN = /(?:^|[/@-])(?:tesseract|ocr|paddleocr|easyocr)(?:[/@.-]|$)/iu;
const AI_MODULE_PATTERN = /(?:^|[/@-])(?:openai|anthropic|generative-ai|ollama|langchain|transformers|onnxruntime)(?:[/@.-]|$)/iu;
const NETWORK_GLOBALS = new Set(['fetch', 'WebSocket', 'EventSource', 'XMLHttpRequest']);
const FILE_GLOBALS = new Set(['FileReader', 'showOpenFilePicker', 'showSaveFilePicker', 'showDirectoryPicker']);
const ELECTRON_RESOURCE_IMPORTS = Object.freeze({
  dialog: 'ELECTRON_DIALOG',
  shell: 'ELECTRON_SHELL',
  desktopCapturer: 'ELECTRON_DESKTOP_CAPTURER',
  net: 'ELECTRON_NET',
  session: 'ELECTRON_SESSION'
});
const CAPABILITY_BY_KIND = Object.freeze({
  CAMERA_API: 'camera.access',
  CAMERA_IMPORT: 'camera.access',
  MICROPHONE_API: 'microphone.access',
  MICROPHONE_IMPORT: 'microphone.access',
  FILE_DIALOG: 'file.access',
  FILE_GLOBAL: 'file.access',
  FILE_IMPORT: 'file.access',
  OCR_API: 'ocr.process',
  OCR_IMPORT: 'ocr.process',
  AI_API: 'ai.process',
  AI_IMPORT: 'ai.process',
  LOCATION_API: 'location.access',
  NETWORK_API: 'network.access',
  NETWORK_IMPORT: 'network.access'
});

const literalString = (node) => {
  if (node?.type === 'StringLiteral') return node.value;
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map((item) => item.value.cooked ?? item.value.raw).join('');
  }
  return undefined;
};
const unwrap = (node) => {
  let current = node;
  while (current && [
    'TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'TypeCastExpression',
    'ParenthesizedExpression', 'TSInstantiationExpression', 'ChainExpression'
  ].includes(current.type)) current = current.expression;
  return current;
};
const memberName = (node) => {
  const current = unwrap(node);
  if (!current || !['MemberExpression', 'OptionalMemberExpression'].includes(current.type)) return undefined;
  if (!current.computed && current.property?.type === 'Identifier') return current.property.name;
  return literalString(current.property);
};
const expressionName = (node) => {
  const current = unwrap(node);
  if (!current) return '';
  if (current.type === 'Identifier') return current.name;
  if (current.type === 'ThisExpression') return 'this';
  if (['MemberExpression', 'OptionalMemberExpression'].includes(current.type)) {
    return `${expressionName(current.object)}.${memberName(current) ?? '?'}`;
  }
  return '';
};
const calleeName = (node) => {
  const current = unwrap(node);
  if (current?.type === 'Identifier') return current.name;
  if (['MemberExpression', 'OptionalMemberExpression'].includes(current?.type)) return memberName(current);
  return undefined;
};
const importSymbols = (node) => {
  if (!node.specifiers?.length) return ['*side-effect*'];
  return node.specifiers.map((specifier) => {
    if (specifier.type === 'ImportDefaultSpecifier') return specifier.local?.name ?? 'default';
    if (specifier.type === 'ImportNamespaceSpecifier') return '*';
    if (specifier.imported?.type === 'Identifier') return specifier.imported.name;
    return literalString(specifier.imported) ?? specifier.local?.name ?? '*unknown*';
  });
};
const walk = (node, visit) => {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'start', 'end', 'extra', 'errors', 'comments', 'tokens'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
};
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
const moduleKind = (moduleName) => {
  if (FILE_MODULES.has(moduleName)) return 'FILE_IMPORT';
  if (NETWORK_MODULES.has(moduleName)) return 'NETWORK_IMPORT';
  if (CAMERA_MODULES.has(moduleName)) return 'CAMERA_IMPORT';
  if (MICROPHONE_MODULES.has(moduleName)) return 'MICROPHONE_IMPORT';
  if (OCR_MODULE_PATTERN.test(moduleName)) return 'OCR_IMPORT';
  if (AI_MODULE_PATTERN.test(moduleName)) return 'AI_IMPORT';
  return undefined;
};
const nodeLine = (node) => node?.loc?.start?.line ?? 1;
const jsxName = (node) => node?.type === 'JSXIdentifier' ? node.name : undefined;
const jsxAttributeValue = (attribute) => {
  if (!attribute || attribute.type !== 'JSXAttribute') return undefined;
  if (attribute.value === null) return true;
  if (attribute.value?.type === 'StringLiteral') return attribute.value.value;
  return literalString(attribute.value?.expression);
};

export const platformRuntimeCapabilityForSurfaceKind = (kind) => CAPABILITY_BY_KIND[kind];

export const scanPlatformCapabilityManifestSource = (pathInput, source) => {
  const path = normalizeAstGatePath(pathInput);
  const observations = [];
  const aliases = new Map();
  const aliasesFor = (name) => typeof name === 'string' ? aliases.get(name) ?? [] : [];
  const setAliases = (name, values) => {
    if (typeof name !== 'string' || !name || !Array.isArray(values) || values.length === 0) return;
    aliases.set(name, values.map((value) => ({ ...value })));
  };
  const add = (kind, detail, node, moduleName) => observations.push({
    key: `${kind}|${path}|${detail}`,
    kind,
    path,
    detail,
    capability: CAPABILITY_BY_KIND[kind],
    ...(moduleName ? { module: moduleName } : {}),
    line: nodeLine(node)
  });
  let ast;
  try {
    ast = parseProgram(path, source);
  } catch (error) {
    return [{
      key: `AST_PARSE_ERROR|${path}|parse`,
      kind: 'AST_PARSE_ERROR',
      path,
      detail: error instanceof Error ? error.message : String(error),
      capability: null,
      line: error?.loc?.line ?? 1
    }];
  }

  walk(ast, (node) => {
    if (node.type === 'ImportDeclaration') {
      const moduleName = literalString(node.source);
      const kind = moduleName ? moduleKind(moduleName) : undefined;
      if (moduleName === 'node:module' || moduleName === 'module') {
        for (const specifier of node.specifiers ?? []) {
          const imported = specifier.imported?.type === 'Identifier' ? specifier.imported.name : literalString(specifier.imported);
          if (imported === 'createRequire' && specifier.local?.name) {
            setAliases(specifier.local.name, [{ kind: 'CREATE_REQUIRE_FACTORY', detail: 'createRequire' }]);
          }
        }
      }
      if (moduleName === 'electron') {
        for (const specifier of node.specifiers ?? []) {
          const imported = specifier.imported?.type === 'Identifier' ? specifier.imported.name : literalString(specifier.imported);
          const resourceKind = ELECTRON_RESOURCE_IMPORTS[imported];
          if (resourceKind && specifier.local?.name) setAliases(specifier.local.name, [{ kind: resourceKind, detail: imported }]);
        }
      }
      if (!kind) return;
      for (const specifier of node.specifiers ?? []) {
        const imported = specifier.type === 'ImportNamespaceSpecifier'
          ? '*'
          : specifier.type === 'ImportDefaultSpecifier'
            ? 'default'
            : specifier.imported?.type === 'Identifier'
              ? specifier.imported.name
              : literalString(specifier.imported) ?? '*unknown*';
        if (specifier.local?.name) setAliases(specifier.local.name, [{ kind, detail: imported }]);
      }
      for (const symbol of importSymbols(node)) add(kind, `${moduleName}:${symbol}`, node, moduleName);
      return;
    }

    if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') {
      const moduleName = literalString(node.source);
      const kind = moduleName ? moduleKind(moduleName) : undefined;
      if (!kind) return;
      const symbols = node.type === 'ExportAllDeclaration'
        ? ['export-all']
        : (node.specifiers?.length ? node.specifiers.map((specifier) => {
            const exported = specifier.exported?.type === 'Identifier' ? specifier.exported.name : literalString(specifier.exported);
            const local = specifier.local?.type === 'Identifier' ? specifier.local.name : literalString(specifier.local);
            return `${local ?? '*unknown*'}->${exported ?? '*unknown*'}`;
          }) : ['*side-effect-export*']);
      for (const symbol of symbols) add(kind, `${moduleName}:${symbol}`, node, moduleName);
      return;
    }

    if (node.type === 'TSImportEqualsDeclaration') {
      const moduleName = node.moduleReference?.type === 'TSExternalModuleReference'
        ? literalString(node.moduleReference.expression)
        : undefined;
      const kind = moduleName ? moduleKind(moduleName) : undefined;
      if (kind) {
        add(kind, `${moduleName}:*import-equals*`, node, moduleName);
        if (node.id?.name) setAliases(node.id.name, [{ kind, detail: '*' }]);
      }
      return;
    }

    if (node.type === 'ImportExpression') {
      const moduleName = literalString(node.source);
      if (!moduleName) {
        observations.push({
          key: `CAPABILITY_DYNAMIC_IMPORT_UNRESOLVED|${path}|import`,
          kind: 'CAPABILITY_DYNAMIC_IMPORT_UNRESOLVED',
          path,
          detail: 'Non-literal dynamic import cannot prove a resource capability.',
          capability: null,
          line: nodeLine(node)
        });
        return;
      }
      const kind = moduleKind(moduleName);
      if (kind) add(kind, `${moduleName}:*dynamic*`, node, moduleName);
      return;
    }

    if (node.type === 'VariableDeclarator') {
      const init = unwrap(node.init);
      const sourceAliases = init?.type === 'Identifier' ? aliasesFor(init.name) : [];
      if (node.id?.type === 'Identifier' && sourceAliases.length) setAliases(node.id.name, sourceAliases);
      if (node.id?.type === 'Identifier' && init && ['MemberExpression', 'OptionalMemberExpression'].includes(init.type)) {
        const root = expressionName(init.object).split('.')[0];
        const owners = aliasesFor(root);
        if (owners.length) setAliases(node.id.name, owners.map((owner) => ({ kind: owner.kind, detail: memberName(init) ?? owner.detail })));
        const globalName = expressionName(init);
        if (/^(?:globalThis|window|self)\.(?:fetch|WebSocket|EventSource|XMLHttpRequest)$/u.test(globalName)) {
          setAliases(node.id.name, [{ kind: 'NETWORK_API', detail: memberName(init) }]);
        }
        if (/^(?:globalThis|window|self)\.(?:FileReader|showOpenFilePicker|showSaveFilePicker|showDirectoryPicker)$/u.test(globalName)) {
          setAliases(node.id.name, [{ kind: 'FILE_GLOBAL', detail: memberName(init) }]);
        }
        if (/^(?:navigator\.)?mediaDevices\.getUserMedia$/u.test(globalName)) setAliases(node.id.name, [{ kind: 'MEDIA_CAPTURE_API', detail: 'getUserMedia' }]);
        if (/^(?:navigator\.)?mediaDevices\.enumerateDevices$/u.test(globalName)) setAliases(node.id.name, [{ kind: 'MEDIA_CAPTURE_API', detail: 'enumerateDevices' }]);
        if (/^(?:navigator\.)?mediaDevices$/u.test(globalName)) setAliases(node.id.name, [{ kind: 'MEDIA_DEVICES_OBJECT', detail: 'mediaDevices' }]);
        if (/^(?:navigator\.)?geolocation\.(?:getCurrentPosition|watchPosition)$/u.test(globalName)) setAliases(node.id.name, [{ kind: 'LOCATION_API', detail: memberName(init) }]);
        if (/^(?:navigator\.)?geolocation$/u.test(globalName)) setAliases(node.id.name, [{ kind: 'GEOLOCATION_OBJECT', detail: 'geolocation' }]);
      }
      if (node.id?.type === 'Identifier' && init?.type === 'Identifier') {
        if (NETWORK_GLOBALS.has(init.name)) setAliases(node.id.name, [{ kind: 'NETWORK_API', detail: init.name }]);
        if (FILE_GLOBALS.has(init.name)) setAliases(node.id.name, [{ kind: 'FILE_GLOBAL', detail: init.name }]);
      }
      if (node.id?.type === 'Identifier' && init?.type === 'CallExpression') {
        const factoryName = calleeName(init.callee);
        if (aliasesFor(factoryName).some((alias) => alias.kind === 'CREATE_REQUIRE_FACTORY')) {
          setAliases(node.id.name, [{ kind: 'DYNAMIC_REQUIRE_FUNCTION', detail: 'createRequire' }]);
        }
      }
      if (node.id?.type === 'ObjectPattern') {
        const ownerName = expressionName(init);
        const ownerAliases = init?.type === 'Identifier' ? aliasesFor(init.name) : [];
        for (const property of node.id.properties ?? []) {
          if (property.type !== 'ObjectProperty') continue;
          const propertyName = property.key?.type === 'Identifier' ? property.key.name : literalString(property.key);
          const localName = property.value?.type === 'Identifier' ? property.value.name : undefined;
          if (!propertyName || !localName) continue;
          if (/^(?:globalThis|window|self)$/u.test(ownerName) && NETWORK_GLOBALS.has(propertyName)) setAliases(localName, [{ kind: 'NETWORK_API', detail: propertyName }]);
          if (/^(?:globalThis|window|self)$/u.test(ownerName) && FILE_GLOBALS.has(propertyName)) setAliases(localName, [{ kind: 'FILE_GLOBAL', detail: propertyName }]);
          if (/^(?:navigator\.)?mediaDevices$/u.test(ownerName) && ['getUserMedia', 'enumerateDevices'].includes(propertyName)) setAliases(localName, [{ kind: 'MEDIA_CAPTURE_API', detail: propertyName }]);
          if (/^(?:navigator\.)?geolocation$/u.test(ownerName) && ['getCurrentPosition', 'watchPosition'].includes(propertyName)) setAliases(localName, [{ kind: 'LOCATION_API', detail: propertyName }]);
          for (const owner of ownerAliases) setAliases(localName, [{ kind: owner.kind, detail: propertyName }]);
        }
      }
      return;
    }

    if (node.type === 'AssignmentExpression' && node.left?.type === 'Identifier') {
      const right = unwrap(node.right);
      if (right?.type === 'Identifier') {
        const rightAliases = aliasesFor(right.name);
        if (rightAliases.length) setAliases(node.left.name, rightAliases);
        if (NETWORK_GLOBALS.has(right.name)) setAliases(node.left.name, [{ kind: 'NETWORK_API', detail: right.name }]);
        if (FILE_GLOBALS.has(right.name)) setAliases(node.left.name, [{ kind: 'FILE_GLOBAL', detail: right.name }]);
      }
      if (right && ['MemberExpression', 'OptionalMemberExpression'].includes(right.type)) {
        const fullName = expressionName(right);
        if (/^(?:globalThis|window|self)\.(?:fetch|WebSocket|EventSource|XMLHttpRequest)$/u.test(fullName)) setAliases(node.left.name, [{ kind: 'NETWORK_API', detail: memberName(right) }]);
        if (/^(?:globalThis|window|self)\.(?:FileReader|showOpenFilePicker|showSaveFilePicker|showDirectoryPicker)$/u.test(fullName)) setAliases(node.left.name, [{ kind: 'FILE_GLOBAL', detail: memberName(right) }]);
      }
      return;
    }

    if (node.type === 'AssignmentExpression') {
      const target = expressionName(node.left);
      if (/^(?:(?:globalThis|window|document)\.)?location\.(?:href|protocol|host|hostname|pathname|search)$/u.test(target)) {
        add('NETWORK_API', `navigation.${target.split('.').at(-1)}`, node);
      }
    }

    if (node.type === 'CallExpression' || node.type === 'OptionalCallExpression') {
      const callee = unwrap(node.callee);
      if (callee?.type === 'Import') {
        const moduleName = literalString(node.arguments?.[0]);
        if (!moduleName) {
          observations.push({
            key: `CAPABILITY_DYNAMIC_IMPORT_UNRESOLVED|${path}|import`,
            kind: 'CAPABILITY_DYNAMIC_IMPORT_UNRESOLVED',
            path,
            detail: 'Non-literal dynamic import cannot prove a resource capability.',
            capability: null,
            line: nodeLine(node)
          });
          return;
        }
        const kind = moduleKind(moduleName);
        if (kind) add(kind, `${moduleName}:*dynamic*`, node, moduleName);
        return;
      }
      const name = calleeName(callee);
      const receiver = ['MemberExpression', 'OptionalMemberExpression'].includes(callee?.type)
        ? expressionName(callee.object)
        : '';
      if ((name === 'require' || name === 'getBuiltinModule') && (
        name === 'require' || /^(?:process|module)$/u.test(receiver)
      )) {
        const moduleName = literalString(node.arguments?.[0]);
        if (!moduleName) {
          observations.push({
            key: `CAPABILITY_DYNAMIC_IMPORT_UNRESOLVED|${path}|${name}`,
            kind: 'CAPABILITY_DYNAMIC_IMPORT_UNRESOLVED',
            path,
            detail: `Non-literal ${name} cannot prove a resource capability.`,
            capability: null,
            line: nodeLine(node)
          });
          return;
        }
        const kind = moduleKind(moduleName);
        if (kind) add(kind, `${moduleName}:*${name}*`, node, moduleName);
      }
      if (name && aliasesFor(name).some((alias) => alias.kind === 'DYNAMIC_REQUIRE_FUNCTION')) {
        const moduleName = literalString(node.arguments?.[0]);
        if (!moduleName) {
          observations.push({
            key: `CAPABILITY_DYNAMIC_IMPORT_UNRESOLVED|${path}|createRequire`,
            kind: 'CAPABILITY_DYNAMIC_IMPORT_UNRESOLVED',
            path,
            detail: 'Non-literal createRequire target cannot prove a resource capability.',
            capability: null,
            line: nodeLine(node)
          });
        } else {
          const kind = moduleKind(moduleName);
          if (kind) add(kind, `${moduleName}:*createRequire*`, node, moduleName);
        }
      }
      for (const alias of aliasesFor(name)) {
        if (['NETWORK_API', 'FILE_GLOBAL', 'LOCATION_API'].includes(alias.kind)) add(alias.kind, alias.detail, node);
        if (alias.kind === 'MEDIA_CAPTURE_API') {
          add('CAMERA_API', alias.detail, node);
          add('MICROPHONE_API', alias.detail, node);
        }
        if (alias.kind === 'ELECTRON_DIALOG' && ['showOpenDialog', 'showSaveDialog'].includes(alias.detail)) add('FILE_DIALOG', alias.detail, node);
        if (alias.kind === 'ELECTRON_SHELL' && alias.detail === 'openExternal') add('NETWORK_API', 'shell.openExternal', node);
        if (alias.kind === 'ELECTRON_DESKTOP_CAPTURER' && alias.detail === 'getSources') add('CAMERA_API', 'desktopCapturer.getSources', node);
        if (alias.kind === 'ELECTRON_NET' && ['fetch', 'request', 'resolveHost'].includes(alias.detail)) add('NETWORK_API', `electron.net.${alias.detail}`, node);
        if (alias.kind === 'ELECTRON_SESSION' && ['downloadURL', 'resolveProxy'].includes(alias.detail)) add('NETWORK_API', `electron.session.${alias.detail}`, node);
      }
      if (name && NETWORK_GLOBALS.has(name)) add('NETWORK_API', name, node);
      if (name && ['showOpenFilePicker', 'showSaveFilePicker', 'showDirectoryPicker'].includes(name)) add('FILE_GLOBAL', name, node);
      if (name && ['getUserMedia', 'enumerateDevices'].includes(name)) {
        add('CAMERA_API', name, node);
        add('MICROPHONE_API', name, node);
      }
      if (name && ['getCurrentPosition', 'watchPosition'].includes(name) && /(?:^|\.)geolocation$/u.test(receiver)) {
        add('LOCATION_API', name, node);
      }
      if (name === 'getSources' && /(?:^|\.)desktopCapturer$/u.test(receiver)) add('CAMERA_API', 'desktopCapturer.getSources', node);
      if (name && ['showOpenDialog', 'showSaveDialog'].includes(name) && /(?:^|\.)dialog$/u.test(receiver)) add('FILE_DIALOG', name, node);
      if (name === 'sendBeacon' && /(?:^|\.)navigator$/u.test(receiver)) add('NETWORK_API', 'sendBeacon', node);
      if (name === 'openExternal' && /(?:^|\.)shell$/u.test(receiver)) add('NETWORK_API', 'shell.openExternal', node);
      if (name === 'loadURL' || name === 'downloadURL') add('NETWORK_API', name, node);
      if (name === 'executeJavaScript') {
        const executableSource = literalString(unwrap(node.arguments?.[0]));
        if (executableSource === undefined) {
          observations.push({
            key: `CAPABILITY_DYNAMIC_EXECUTION_UNRESOLVED|${path}|executeJavaScript`,
            kind: 'CAPABILITY_DYNAMIC_EXECUTION_UNRESOLVED',
            path,
            detail: 'Non-literal executeJavaScript source cannot prove a resource capability.',
            capability: null,
            line: nodeLine(node)
          });
        } else {
          if (/\b(?:navigator\.)?mediaDevices\s*\.\s*(?:getUserMedia|enumerateDevices)\s*\(/u.test(executableSource)) {
            add('CAMERA_API', 'executeJavaScript.mediaDevices', node);
            add('MICROPHONE_API', 'executeJavaScript.mediaDevices', node);
          }
          if (/\b(?:fetch|WebSocket|EventSource|XMLHttpRequest)\s*\(?/u.test(executableSource)) {
            add('NETWORK_API', 'executeJavaScript.network', node);
          }
          if (/\b(?:showOpenFilePicker|showSaveFilePicker|showDirectoryPicker|FileReader)\b/u.test(executableSource)) {
            add('FILE_GLOBAL', 'executeJavaScript.file', node);
          }
          if (/\bnavigator\s*\.\s*geolocation\s*\.\s*(?:getCurrentPosition|watchPosition)\s*\(/u.test(executableSource)) {
            add('LOCATION_API', 'executeJavaScript.geolocation', node);
          }
        }
      }
      if (name === 'open' && /^(?:globalThis|window|self)$/u.test(receiver)) add('NETWORK_API', 'window.open', node);
      if (name && ['assign', 'replace'].includes(name) && /(?:^|\.)location$/u.test(receiver)) add('NETWORK_API', `location.${name}`, node);
      if (name && ['call', 'apply', 'bind'].includes(name)) {
        const protectedReceiver = receiver.split('.').at(-1);
        if (NETWORK_GLOBALS.has(protectedReceiver)) add('NETWORK_API', protectedReceiver, node);
        if (FILE_GLOBALS.has(protectedReceiver)) add('FILE_GLOBAL', protectedReceiver, node);
        if (['getUserMedia', 'enumerateDevices'].includes(protectedReceiver)) {
          add('CAMERA_API', protectedReceiver, node);
          add('MICROPHONE_API', protectedReceiver, node);
        }
        if (['getCurrentPosition', 'watchPosition'].includes(protectedReceiver)) add('LOCATION_API', protectedReceiver, node);
      }
      if (name && ['apply', 'construct'].includes(name) && receiver === 'Reflect') {
        const target = unwrap(node.arguments?.[0]);
        const targetName = expressionName(target).split('.').at(-1) || calleeName(target);
        if (NETWORK_GLOBALS.has(targetName)) add('NETWORK_API', `Reflect.${name}.${targetName}`, node);
        if (FILE_GLOBALS.has(targetName)) add('FILE_GLOBAL', `Reflect.${name}.${targetName}`, node);
        if (targetName === 'getUserMedia') {
          add('CAMERA_API', `Reflect.${name}.getUserMedia`, node);
          add('MICROPHONE_API', `Reflect.${name}.getUserMedia`, node);
        }
        for (const targetAlias of target?.type === 'Identifier' ? aliasesFor(target.name) : []) {
          if (targetAlias.kind === 'NETWORK_API') add('NETWORK_API', `Reflect.${name}.${targetAlias.detail}`, node);
          if (targetAlias.kind === 'FILE_GLOBAL') add('FILE_GLOBAL', `Reflect.${name}.${targetAlias.detail}`, node);
          if (targetAlias.kind === 'LOCATION_API') add('LOCATION_API', `Reflect.${name}.${targetAlias.detail}`, node);
          if (targetAlias.kind === 'MEDIA_CAPTURE_API') {
            add('CAMERA_API', `Reflect.${name}.${targetAlias.detail}`, node);
            add('MICROPHONE_API', `Reflect.${name}.${targetAlias.detail}`, node);
          }
        }
      }
      const receiverRoot = receiver.split('.')[0];
      for (const receiverAlias of aliasesFor(receiverRoot)) {
        if (receiverAlias.kind === 'OCR_IMPORT' && name) add('OCR_API', `${receiverAlias.detail}.${name}`, node);
        if (receiverAlias.kind === 'AI_IMPORT' && name) add('AI_API', `${receiverAlias.detail}.${name}`, node);
        if (receiverAlias.kind === 'GEOLOCATION_OBJECT' && ['getCurrentPosition', 'watchPosition'].includes(name)) add('LOCATION_API', name, node);
        if (receiverAlias.kind === 'MEDIA_DEVICES_OBJECT' && ['getUserMedia', 'enumerateDevices'].includes(name)) {
          add('CAMERA_API', name, node);
          add('MICROPHONE_API', name, node);
        }
        if (receiverAlias.kind === 'ELECTRON_DIALOG' && ['showOpenDialog', 'showSaveDialog'].includes(name)) add('FILE_DIALOG', name, node);
        if (receiverAlias.kind === 'ELECTRON_SHELL' && name === 'openExternal') add('NETWORK_API', 'shell.openExternal', node);
        if (receiverAlias.kind === 'ELECTRON_DESKTOP_CAPTURER' && name === 'getSources') add('CAMERA_API', 'desktopCapturer.getSources', node);
        if (receiverAlias.kind === 'ELECTRON_NET' && ['fetch', 'request', 'resolveHost'].includes(name)) add('NETWORK_API', `electron.net.${name}`, node);
        if (receiverAlias.kind === 'ELECTRON_SESSION' && ['downloadURL', 'resolveProxy'].includes(name)) add('NETWORK_API', `electron.session.${name}`, node);
      }
      return;
    }

    if (node.type === 'NewExpression') {
      const name = calleeName(node.callee);
      const aliasValues = aliasesFor(name);
      if (name && NETWORK_GLOBALS.has(name)) add('NETWORK_API', name, node);
      if (name === 'FileReader') add('FILE_GLOBAL', 'FileReader', node);
      if (name === 'MediaRecorder') {
        add('CAMERA_API', 'MediaRecorder', node);
        add('MICROPHONE_API', 'MediaRecorder', node);
      }
      for (const alias of aliasValues) {
        if (alias.kind === 'NETWORK_API') add('NETWORK_API', alias.detail, node);
        if (alias.kind === 'FILE_GLOBAL') add('FILE_GLOBAL', alias.detail, node);
        if (alias.kind === 'OCR_IMPORT') add('OCR_API', `${alias.detail}.constructor`, node);
        if (alias.kind === 'AI_IMPORT') add('AI_API', `${alias.detail}.constructor`, node);
        if (alias.kind === 'MEDIA_CAPTURE_API') {
          add('CAMERA_API', alias.detail, node);
          add('MICROPHONE_API', alias.detail, node);
        }
      }
      return;
    }

    if (node.type === 'JSXOpeningElement' && jsxName(node.name) === 'input') {
      const attributes = Object.fromEntries((node.attributes ?? [])
        .filter((attribute) => attribute.type === 'JSXAttribute' && jsxName(attribute.name))
        .map((attribute) => [jsxName(attribute.name), jsxAttributeValue(attribute)]));
      if (attributes.type === 'file') {
        add('FILE_GLOBAL', 'jsx.input[type=file]', node);
        if (Object.hasOwn(attributes, 'capture')) add('CAMERA_API', 'jsx.input[type=file][capture]', node);
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

export const inventoryPlatformCapabilityManifestSurfaces = async (root = process.cwd()) => {
  const { zones, files } = await collectPlatformPolicyProductionSources(root);
  const observations = [];
  for (const file of files) {
    const path = normalizeAstGatePath(relative(root, file));
    observations.push(...scanPlatformCapabilityManifestSource(path, await readFile(file, 'utf8')));
  }
  observations.sort((left, right) => left.key.localeCompare(right.key, 'en'));
  return { zones: zones.length, files: files.length, observations };
};
