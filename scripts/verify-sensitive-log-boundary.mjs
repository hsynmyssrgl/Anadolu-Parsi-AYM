import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const normalize = (value) => value.split(sep).join('/');

const listFiles = async (directory) => {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await listFiles(path));
    else if (/\.(?:ts|tsx)$/u.test(entry.name)) output.push(path);
  }
  return output;
};

const productionZones = [];
for (const owner of ['apps', 'packages']) {
  const ownerPath = resolve(root, owner);
  for (const entry of await readdir(ownerPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sourcePath = join(ownerPath, entry.name, 'src');
    try {
      if ((await stat(sourcePath)).isDirectory()) productionZones.push(sourcePath);
    } catch { /* workspace has no production source directory */ }
  }
}

const findBalancedObject = (source, start) => {
  const open = source.indexOf('{', start);
  if (open < 0) return undefined;
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; index += 1; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; index += 1; continue; }
    if (char === '/' && next === '*') { blockComment = true; index += 1; continue; }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, index + 1);
    }
  }
  return undefined;
};

const invocationPattern = /(?:\b(?:logger|#logger)\??\.(?:debug|info|warn|error)|writeContentFreeConsoleEvent)\s*\(/gu;
const forbiddenMetadataKey = /\b(?:payload|ocrText|recognizedText|transcript|sourceText|body|message|details|content|stack|path|filePath|directory|title|displayName|note|description|query|sql)\s*:/u;

const scanSource = (file, source) => {
  const findings = [];
  const add = (rule) => findings.push({ file, rule });
  if (/\bconsole\.(?:log|error|warn|info|debug)\s*\(/u.test(source)) add('DIRECT_CONSOLE_PRIMITIVE');
  if (/\bprocess\.(?:stdout|stderr)\.write\s*\(/u.test(source)) add('DIRECT_PROCESS_STREAM_PRIMITIVE');
  if (file !== 'packages/logging/src/index.ts' && /\bJsonLinesFileLogger\b/u.test(source)) add('PLAINTEXT_LOGGER_IMPORT');
  if (!['packages/logging/src/index.ts', 'apps/desktop/src/main/protected-side-artifact-logger.ts'].includes(file)
    && /\bserializeLogEvent\b/u.test(source)) add('SERIALIZER_BYPASS');
  if (file !== 'packages/repositories/src/diagnostic-repository.ts'
    && /INSERT(?:\s+OR\s+IGNORE)?\s+INTO\s+diagnostic_entries/iu.test(source)) add('DIAGNOSTIC_SQL_BYPASS');

  for (const match of source.matchAll(invocationPattern)) {
    const invocation = findBalancedObject(source, match.index ?? 0);
    if (!invocation) { add('UNPARSEABLE_LOG_INVOCATION'); continue; }
    if (/\b(?:error|failure|exception)\??\.(?:message|stack)\b|\bString\s*\(\s*(?:error|failure|exception)\s*\)/u.test(invocation)) {
      add('RAW_ERROR_SIGNAL');
    }
    const metadataIndex = invocation.indexOf('metadata:');
    if (metadataIndex < 0) continue;
    const metadata = findBalancedObject(invocation, metadataIndex);
    if (!metadata) { add('UNPARSEABLE_METADATA'); continue; }
    if (forbiddenMetadataKey.test(metadata)) add('FORBIDDEN_METADATA_KEY');
    if (/\.\.\./u.test(metadata)) add('METADATA_SPREAD_FORBIDDEN');
    if (/:\s*\{/u.test(metadata.slice(1, -1))) add('NESTED_METADATA_OBJECT_FORBIDDEN');
    if (/\b(?:error|failure|exception)\??\.(?:message|stack)\b|\bString\s*\(\s*(?:error|failure|exception)\s*\)/u.test(metadata)) {
      add('RAW_ERROR_METADATA');
    }
  }

  if (file === 'apps/desktop/src/main/main.ts') {
    const start = source.indexOf('const writeEarlyStartupFailureEvidence');
    const end = source.indexOf('let revocationSyncService');
    const segment = start >= 0 && end > start ? source.slice(start, end) : '';
    if (!segment.includes('errorFingerprint = sensitiveLogPolicy.hashSensitiveSignal(error)')) add('EARLY_FAILURE_FINGERPRINT_MISSING');
    if (/message:\s*error\.message|stack:\s*error\.stack|error:\s*normalized/u.test(segment)) add('EARLY_FAILURE_RAW_PAYLOAD');
  }
  return findings;
};

const malicious = [
  "console.error('secret')",
  "process.stderr.write('secret')",
  "logger.info({metadata:{payload:'secret'}})",
  "logger.warn({metadata:{ocrText:'secret'}})",
  "logger.error({metadata:{message:error.message}})",
  "logger.error({metadata:{stack:error.stack}})",
  "logger.info({metadata:{result:{status:'completed'}}})",
  "logger.info({metadata:{...unsafe}})",
  "import { JsonLinesFileLogger } from '@ppt/logging'",
  "import { serializeLogEvent } from '@ppt/logging'",
  "db.prepare('INSERT INTO diagnostic_entries VALUES(?,?,?,?,?,?)')"
];
const benign = [
  "logger.info({metadata:{eventId:'evt-1',result:'completed',recordCount:2}})",
  "writeContentFreeConsoleEvent({metadata:{instanceId:'abc',status:'ready'}})",
  "const fingerprint=sensitiveLogPolicy.hashSensitiveSignal(error)"
];
const maliciousPassed = malicious.filter((source, index) => scanSource(`malicious-${index}.ts`, source).length > 0).length;
const benignPassed = benign.filter((source, index) => scanSource(`benign-${index}.ts`, source).length === 0).length;

export const scanSensitiveLogBoundary = async () => {
  const files = (await Promise.all(productionZones.map(listFiles))).flat();
  const findings = [];
  let relevantFiles = 0;
  for (const absolute of files) {
    const file = normalize(relative(root, absolute));
    const source = await readFile(absolute, 'utf8');
    if (/logger|logging|diagnostic|console|stdout|stderr|LogEvent/u.test(source)) relevantFiles += 1;
    findings.push(...scanSource(file, source));
  }
  return {
    status: findings.length === 0 && maliciousPassed === malicious.length && benignPassed === benign.length ? 'PASS' : 'FAIL',
    zones: productionZones.length,
    files: files.length,
    relevantFiles,
    maliciousSelfTests: malicious.length,
    maliciousSelfTestsPassed: maliciousPassed,
    benignSelfTests: benign.length,
    benignSelfTestsPassed: benignPassed,
    findings
  };
};

const main = async () => {
  const report = await scanSensitiveLogBoundary();
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) await main();
