import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const normalize = (value) => value.split(sep).join('/');
const TYPED_POLICY_FACTORY = 'packages/platform-policy/src/typed-policy-sdk.ts';
const directPepPattern = /new\s+PlatformPolicyEnforcementPoint\s*\(/gu;
const typedPepFactoryPattern = /createTypedPolicyEnforcementPoint\s*\(/gu;

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

const noOpSinkPattern = /receiptSink\s*:\s*(?:undefined|null|\{\s*append\s*:\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*(?:undefined|void\s+0|\{\s*\})\s*[,}]?\s*\})/su;

const scanSource = (file, source) => {
  const findings = [];
  const add = (rule) => findings.push({ file, rule });
  const matches = [
    ...(file === TYPED_POLICY_FACTORY ? [] : source.matchAll(directPepPattern)),
    ...source.matchAll(typedPepFactoryPattern)
  ];
  for (const match of matches) {
    const composition = findBalancedObject(source, match.index ?? 0);
    if (!composition) { add('PEP_COMPOSITION_UNPARSEABLE'); continue; }
    if (!/\breceiptSink\s*:/u.test(composition)) add('PEP_RECEIPT_SINK_MISSING');
    if (noOpSinkPattern.test(composition)) add('PEP_NOOP_RECEIPT_SINK');
    if (/deferAllowedReceiptPersistence\s*:\s*true/u.test(composition)) {
      if (!/receiptSink\.ensure/u.test(source)) add('DEFERRED_RECEIPT_ENSURE_MISSING');
      if (!/verifyProjectionProof/u.test(source)) add('DEFERRED_PROJECTION_VERIFICATION_MISSING');
      if (!/acknowledgeJournalProjection/u.test(source)) add('DEFERRED_PROJECTION_ACK_MISSING');
    }
  }
  if (/JSON\.stringify\s*\(\s*(?:record|receiptRecord|auditRecord)\s*\)/u.test(source)) {
    add('PLAINTEXT_POLICY_AUDIT_SERIALIZATION');
  }
  if (
    /getPolicyDecisionAuditBoundary/u.test(source)
    && /return\s+(?:Object\.freeze\s*\()?\s*\{[^}]*(?:receiptRecord|auditRecord|decisionReason|obligations)\b/su.test(source)
  ) add('CLIENT_POLICY_AUDIT_PAYLOAD_EXPOSURE');
  if (/POLICY_DENIED/u.test(source) && /#appendReceipt/u.test(source)) {
    const deniedStart = source.indexOf('if (!authorization.decision.allowed)');
    const deniedEnd = source.indexOf('if (!this.#deferAllowedReceiptPersistence)', deniedStart + 1);
    const denied = deniedStart >= 0 && deniedEnd > deniedStart ? source.slice(deniedStart, deniedEnd) : '';
    if (!denied || denied.indexOf('await this.#appendReceipt') < 0 || denied.indexOf("'POLICY_DENIED'") < denied.indexOf('await this.#appendReceipt')) {
      add('DENIAL_AUDIT_NOT_PERSISTED_BEFORE_RETURN');
    }
    const allowStart = deniedEnd;
    const operationIndex = source.indexOf('await operation(context)', allowStart);
    const allow = allowStart >= 0 && operationIndex > allowStart ? source.slice(allowStart, operationIndex) : '';
    if (!allow.includes('await this.#appendReceipt')) add('ALLOW_AUDIT_NOT_PERSISTED_BEFORE_OPERATION');
    if (!source.includes("'RECEIPT_PERSISTENCE_FAILED'")) add('AUDIT_PERSISTENCE_FAIL_CLOSED_CODE_MISSING');
  }
  return findings;
};

const malicious = [
  "new PlatformPolicyEnforcementPoint({kernel,authorityResolver,resourceResolver})",
  "createTypedPolicyEnforcementPoint({provider,authorityResolver,resourceResolver})",
  "new PlatformPolicyEnforcementPoint({kernel,authorityResolver,resourceResolver,receiptSink:{append:()=>undefined}})",
  "new PlatformPolicyEnforcementPoint({kernel,authorityResolver,resourceResolver,receiptSink:dependencies.receiptSink,deferAllowedReceiptPersistence:true})",
  "if (!authorization.decision.allowed) { throw new PlatformPolicyEnforcementError('POLICY_DENIED'); await this.#appendReceipt(record); } if (!this.#deferAllowedReceiptPersistence) { await this.#appendReceipt(record); } await operation(context);",
  "const bytes=JSON.stringify(auditRecord)",
  "getPolicyDecisionAuditBoundary(){return {auditRecord,receiptRecord}}"
];
const benign = [
  "new PlatformPolicyEnforcementPoint({kernel,authorityResolver,resourceResolver,receiptSink:dependencies.receiptSink})",
  "createTypedPolicyEnforcementPoint({provider,authorityResolver,resourceResolver,receiptSink:dependencies.receiptSink})",
  "const protectedPayload={auditRecord,receiptRecord}; protectedArtifactStore.sealBuffer('platform-policy-receipt',bytes)",
  "getPolicyDecisionAuditBoundary():Promise<PolicyDecisionAuditBoundaryView>"
];
const maliciousPassed = malicious.filter((source, index) => scanSource(`malicious-${index}.ts`, source).length > 0).length;
const benignPassed = benign.filter((source, index) => scanSource(`benign-${index}.ts`, source).length === 0).length;

const requiredMarkers = (file, source, markers, findings) => {
  for (const marker of markers) {
    if (!source.includes(marker)) findings.push({ file, rule: `REQUIRED_MARKER_MISSING:${marker}` });
  }
};

export const scanImmutablePolicyDecisionAuditBoundary = async () => {
  const files = (await Promise.all(productionZones.map(listFiles))).flat();
  const sources = new Map();
  const findings = [];
  let relevantFiles = 0;
  let enforcementPointCompositions = 0;
  for (const absolute of files) {
    const file = normalize(relative(root, absolute));
    const source = await readFile(absolute, 'utf8');
    sources.set(file, source);
    if (/PolicyReceipt|PolicyDecisionAudit|policy receipt|policy decision audit|PlatformPolicyEnforcementPoint|createTypedPolicyEnforcementPoint/u.test(source)) relevantFiles += 1;
    enforcementPointCompositions += (file === TYPED_POLICY_FACTORY ? 0 : [...source.matchAll(directPepPattern)].length)
      + [...source.matchAll(typedPepFactoryPattern)].length;
    findings.push(...scanSource(file, source));
  }

  const requireSource = (file) => {
    const source = sources.get(file);
    if (source === undefined) findings.push({ file, rule: 'REQUIRED_SOURCE_MISSING' });
    return source ?? '';
  };
  const pep = requireSource('packages/platform-policy/src/policy-enforcement-point.ts');
  requiredMarkers('packages/platform-policy/src/policy-enforcement-point.ts', pep, [
    'await this.#appendReceipt(',
    "'RECEIPT_PERSISTENCE_FAILED'",
    "'POLICY_DENIED'",
    'await operation(context)',
    "typeof options.receiptSink.append !== 'function'",
    "Deferred policy receipt persistence requires an idempotent exact receipt sink"
  ], findings);

  const policy = requireSource('packages/platform-policy/src/immutable-policy-decision-audit.ts');
  requiredMarkers('packages/platform-policy/src/immutable-policy-decision-audit.ts', policy, [
    'IMMUTABLE_POLICY_DECISION_AUDIT_SCHEMA_VERSION',
    'decisionReason',
    'policyPackageVersion',
    'policyPackageSha256',
    'obligations',
    'requestHash',
    'contextHash',
    'receiptHash',
    'recordHash',
    'auditHash',
    'assertObligationExecution(record)',
    'execution.attestationHash',
    "enforcement: 'fail-closed'",
    'payloadExposedToClient: false'
  ], findings);

  const sinkFile = 'apps/desktop/src/main/platform-policy-receipt-file-sink.ts';
  const sink = requireSource(sinkFile);
  requiredMarkers(sinkFile, sink, [
    'ProtectedPolicyDecisionAuditEnvelope',
    'decisionAuditPolicy.create(record)',
    'decisionAuditPolicy.verify(receiptRecord, auditRecord)',
    'protectedArtifactStore.sealBuffer(RECEIPT_ARTIFACT_KIND, recordBytes)',
    'entryHash: entryHash(payload, this.#macKey)',
    'fsyncSync(journalDescriptor)',
    'canonicalize(verified.auditRecord) !== canonicalize(auditRecord)',
    'inspectWithTrustedProvider',
    'checkpointPolicyJournal',
    'inspectDecisionAuditBoundary'
  ], findings);
  if (sink.indexOf('decisionAuditPolicy.create(record)') > sink.indexOf('protectedArtifactStore.sealBuffer(RECEIPT_ARTIFACT_KIND, recordBytes)')) {
    findings.push({ file: sinkFile, rule: 'AUDIT_CREATED_AFTER_PROTECTED_SEAL' });
  }

  const mainFile = 'apps/desktop/src/main/main.ts';
  const main = requireSource(mainFile);
  requiredMarkers(mainFile, main, [
    'archivePolicyReceiptSink = new PlatformPolicyReceiptFileSink({',
    'await archivePolicyReceiptSink.inspectWithTrustedProvider(',
    'receiptSink: policyReceiptSink()',
    "registerIpcHandler('system:getPolicyDecisionAuditBoundary'"
  ], findings);

  const adapterFile = 'apps/desktop/src/main/policy-decision-audit-application-adapter.ts';
  const adapter = requireSource(adapterFile);
  requiredMarkers(adapterFile, adapter, ['inspectDecisionAuditBoundary()'], findings);
  if (/inspectForControlledTest|inspectWithTrustedProvider/u.test(adapter)) {
    findings.push({ file: adapterFile, rule: 'CLIENT_ADAPTER_EXPOSES_PRIVILEGED_INSPECTION' });
  }

  const boundaryFile = 'packages/domain/src/policy-decision-audit.ts';
  const boundary = requireSource(boundaryFile);
  requiredMarkers(boundaryFile, boundary, [
    'payloadExposedToClient: false',
    'allowedDecisionsRecorded: true',
    'deniedDecisionsRecorded: true',
    'obligationsRecordedExactly: true'
  ], findings);
  if (/\b(?:receiptRecord|auditRecord|correlationId|resourceId|decisionReason|obligations)\s*:/u.test(boundary)) {
    findings.push({ file: boundaryFile, rule: 'CLIENT_BOUNDARY_EXPOSES_POLICY_AUDIT_PAYLOAD' });
  }

  const ipcPolicyFile = 'apps/desktop/src/main/ipc-integration-policy.ts';
  requiredMarkers(ipcPolicyFile, requireSource(ipcPolicyFile), [
    "case 'system:getPolicyDecisionAuditBoundary':",
    'return zeroArguments(args);'
  ], findings);
  const cacheFile = 'apps/desktop/src/main/ipc-read-sharing.ts';
  const cache = requireSource(cacheFile);
  const securityStart = cache.indexOf('IPC_SECURITY_POSTURE_NO_CACHE_CHANNELS');
  const securityEnd = cache.indexOf('] as const);', securityStart);
  if (securityStart < 0 || securityEnd < securityStart || !cache.slice(securityStart, securityEnd).includes("'system:getPolicyDecisionAuditBoundary'")) {
    findings.push({ file: cacheFile, rule: 'POLICY_AUDIT_STATUS_CHANNEL_CACHEABLE' });
  }

  if (enforcementPointCompositions < 7) {
    findings.push({ file: 'workspace', rule: 'PRODUCTION_PEP_COMPOSITION_COUNT_BELOW_BASELINE' });
  }
  return {
    status: findings.length === 0 && maliciousPassed === malicious.length && benignPassed === benign.length ? 'PASS' : 'FAIL',
    zones: productionZones.length,
    files: files.length,
    relevantFiles,
    enforcementPointCompositions,
    maliciousSelfTests: malicious.length,
    maliciousSelfTestsPassed: maliciousPassed,
    benignSelfTests: benign.length,
    benignSelfTestsPassed: benignPassed,
    findings
  };
};

const main = async () => {
  const report = await scanImmutablePolicyDecisionAuditBoundary();
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) await main();
