import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from '@babel/parser';

const MANIFEST_PATH = 'config/32-s-ppk-023-application-security-profile-manifest.json';
const KERNEL_PATH = 'packages/platform-policy/src/policy-kernel.ts';
const TARGET_PATH = 'config/32-p-ppk-020-policy-conformance-target-inventory.json';
const EXPECTED_ASVS = [
  'v5.0.0-1.2.4', 'v5.0.0-1.2.5', 'v5.0.0-2.2.2', 'v5.0.0-2.3.3',
  'v5.0.0-5.3.2', 'v5.0.0-6.8.2', 'v5.0.0-7.2.1', 'v5.0.0-7.4.1',
  'v5.0.0-8.2.1', 'v5.0.0-8.2.2', 'v5.0.0-8.3.1', 'v5.0.0-9.1.1',
  'v5.0.0-11.6.1', 'v5.0.0-12.3.1', 'v5.0.0-13.2.4', 'v5.0.0-14.1.1',
  'v5.0.0-14.2.4', 'v5.0.0-15.1.2', 'v5.0.0-15.4.2', 'v5.0.0-16.2.5',
  'v5.0.0-16.3.2'
];
const EXPECTED_MASVS = [
  'MASVS-AUTH-1', 'MASVS-AUTH-2', 'MASVS-AUTH-3',
  'MASVS-CODE-1', 'MASVS-CODE-2', 'MASVS-CODE-3', 'MASVS-CODE-4',
  'MASVS-CRYPTO-1', 'MASVS-CRYPTO-2', 'MASVS-NETWORK-1', 'MASVS-NETWORK-2',
  'MASVS-PLATFORM-1', 'MASVS-PLATFORM-2', 'MASVS-PLATFORM-3',
  'MASVS-PRIVACY-1', 'MASVS-PRIVACY-2', 'MASVS-PRIVACY-3', 'MASVS-PRIVACY-4',
  'MASVS-RESILIENCE-1', 'MASVS-RESILIENCE-2', 'MASVS-RESILIENCE-3', 'MASVS-RESILIENCE-4',
  'MASVS-STORAGE-1', 'MASVS-STORAGE-2'
];
const EXPECTED_SSDF = [
  'PO.1', 'PO.2', 'PO.3', 'PO.4', 'PO.5', 'PS.1', 'PS.2', 'PS.3',
  'PW.1', 'PW.2', 'PW.4', 'PW.5', 'PW.6', 'PW.7', 'PW.8', 'PW.9',
  'RV.1', 'RV.2', 'RV.3'
];
const MOBILE_IDS = new Set(['ios-companion', 'ipados-companion', 'watchos-companion', 'visionos-companion']);
const GENERAL_NA_REASON = 'OWASP MASVS is mobile-specific; this profile records an explicit non-mobile applicability decision.';
const SHA256 = /^[a-f0-9]{64}$/u;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const plainRecord = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const exactKeys = (value, expected) => {
  if (!plainRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length && actual.every((key, index) => key === canonical[index]);
};
const same = (left, right) => Array.isArray(left) && left.length === right.length
  && left.every((value, index) => value === right[index]);
const canonicalize = (value) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('PPK023_NON_FINITE_NUMBER');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (!plainRecord(value)) throw new TypeError('PPK023_UNSUPPORTED_VALUE');
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
};
const manifestHash = (manifest) => {
  const { manifestSha256: _manifestSha256, ...payload } = manifest;
  return sha256(Buffer.from(canonicalize(payload), 'utf8'));
};
const clone = (value) => JSON.parse(JSON.stringify(value));

const extractCanonicalApplicationIds = (source) => {
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript'] });
  let values;
  const unwrap = (node) => {
    let current = node;
    while (current && ['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'ParenthesizedExpression'].includes(current.type)) {
      current = current.expression;
    }
    return current;
  };
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier'
      && node.id.name === 'PLATFORM_APPLICATION_IDS') {
      const initializer = unwrap(node.init);
      const array = unwrap(initializer?.type === 'CallExpression' ? initializer.arguments?.[0] : initializer);
      if (array?.type === 'ArrayExpression') {
        values = array.elements.map((element) => element?.type === 'StringLiteral' ? element.value : null);
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object' && typeof value.type === 'string') walk(value);
    }
  };
  walk(ast.program);
  if (!values || values.some((value) => typeof value !== 'string') || new Set(values).size !== values.length) {
    throw new Error('PPK-023 canonical application AST inventory is invalid.');
  }
  return values;
};

const discoverApplicationWorkspaces = async (root) => {
  const applicationsRoot = resolve(root, 'apps');
  const paths = [];
  for (const entry of await readdir(applicationsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packagePath = resolve(applicationsRoot, entry.name, 'package.json');
    try {
      if ((await stat(packagePath)).isFile()) paths.push(`apps/${entry.name}`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return paths.sort((left, right) => left.localeCompare(right, 'en'));
};

const targetMatches = (profile, target) => {
  const exact = exactKeys(profile, [
    'applicationId', 'platformGroup', 'deploymentState', 'nativeRuntimeExecution',
    'assuranceProfileId', 'threatModelId', 'threatModelSection', 'mappingState',
    'complianceClaimed', 'nativeRuntimeValidated'
  ]);
  const assurance = MOBILE_IDS.has(target.applicationId) ? 'MOBILE_COMPANION' : 'GENERAL_APPLICATION';
  return exact
    && profile.applicationId === target.applicationId
    && profile.platformGroup === target.platformGroup
    && profile.deploymentState === target.deploymentState
    && profile.nativeRuntimeExecution === target.nativeRuntimeExecution
    && profile.assuranceProfileId === assurance
    && profile.threatModelId === `APP-THREAT-${target.applicationId}`
    && profile.threatModelSection === `## APP-THREAT-${target.applicationId}`
    && profile.mappingState === 'MAPPED'
    && profile.complianceClaimed === false
    && profile.nativeRuntimeValidated === (target.nativeRuntimeExecution === 'CURRENT_RUNTIME');
};

export const evaluateApplicationSecurityProfileGate = (input) => {
  const { manifest, threatModelBytes, applicationIds, targetProfiles, workspacePaths } = input;
  const findings = [];
  const add = (kind, detail) => findings.push({ kind, detail });
  if (!exactKeys(manifest, [
    'schemaVersion', 'gateVersion', 'defaultDecision', 'mappingState', 'complianceClaimed',
    'standards', 'threatModelDocument', 'workspaceOwners', 'assuranceProfiles', 'profiles', 'manifestSha256'
  ])) add('MANIFEST_SHAPE_INVALID', 'The manifest must have the exact PPK-023 envelope.');
  if (manifest?.schemaVersion !== 1 || manifest?.gateVersion !== 'PPK-023-V1'
    || manifest?.defaultDecision !== 'DENY' || manifest?.mappingState !== 'REQUIREMENTS_MAPPED_NOT_CERTIFIED'
    || manifest?.complianceClaimed !== false) add('FAIL_CLOSED_INVARIANT_MISSING', 'Mapping truth or default denial is invalid.');
  if (!SHA256.test(String(manifest?.manifestSha256 ?? '')) || manifestHash(manifest) !== manifest?.manifestSha256) {
    add('MANIFEST_HASH_MISMATCH', 'Canonical profile manifest hash mismatch.');
  }
  const standards = manifest?.standards;
  const standardChecks = [
    ['asvs', 'OWASP ASVS', '5.0.0', 'STABLE', EXPECTED_ASVS],
    ['masvs', 'OWASP MASVS', '2.1.0', 'STABLE', EXPECTED_MASVS],
    ['ssdf', 'NIST SSDF', '1.1', 'FINAL', EXPECTED_SSDF]
  ];
  if (!exactKeys(standards, ['asvs', 'masvs', 'ssdf'])) add('STANDARD_CATALOG_INVALID', 'Exactly ASVS, MASVS and SSDF are required.');
  for (const [key, name, version, state, controls] of standardChecks) {
    const standard = standards?.[key];
    if (!exactKeys(standard, ['name', 'version', 'publicationState', 'officialSource', 'controlIds'])
      || standard.name !== name || standard.version !== version || standard.publicationState !== state
      || typeof standard.officialSource !== 'string' || !standard.officialSource.startsWith('https://')
      || !same(standard.controlIds, controls)) add('STANDARD_MAPPING_INVALID', `${key} version or control set is not exact.`);
  }
  if (!same(applicationIds, targetProfiles.map((target) => target.applicationId))) {
    add('CANONICAL_TARGET_INVENTORY_MISMATCH', 'Kernel and conformance target application identities differ.');
  }
  const profiles = manifest?.profiles;
  if (!Array.isArray(profiles) || profiles.length !== applicationIds.length
    || !profiles?.every((profile, index) => targetMatches(profile, targetProfiles[index]))) {
    add('APPLICATION_PROFILE_COVERAGE_INVALID', 'Every canonical application requires one exact ordered profile.');
  }
  const profileIds = Array.isArray(profiles) ? profiles.map((profile) => profile?.applicationId) : [];
  if (new Set(profileIds).size !== profileIds.length || !same(profileIds, applicationIds)) {
    add('APPLICATION_PROFILE_IDENTITY_INVALID', 'Missing, duplicate, stale or new application profile detected.');
  }
  const assurance = manifest?.assuranceProfiles;
  if (!Array.isArray(assurance) || assurance.length !== 2
    || assurance[0]?.id !== 'GENERAL_APPLICATION' || assurance[1]?.id !== 'MOBILE_COMPANION'
    || !same(assurance[0]?.asvsControlIds, EXPECTED_ASVS) || !same(assurance[1]?.asvsControlIds, EXPECTED_ASVS)
    || !same(assurance[0]?.ssdfPracticeIds, EXPECTED_SSDF) || !same(assurance[1]?.ssdfPracticeIds, EXPECTED_SSDF)
    || assurance[0]?.masvs?.applicability !== 'NOT_APPLICABLE'
    || !same(assurance[0]?.masvs?.controlIds, [])
    || assurance[0]?.masvs?.notApplicableReason !== GENERAL_NA_REASON
    || assurance[1]?.masvs?.applicability !== 'APPLICABLE'
    || !same(assurance[1]?.masvs?.controlIds, EXPECTED_MASVS)
    || assurance[1]?.masvs?.notApplicableReason !== null) {
    add('ASSURANCE_PROFILE_INVALID', 'General and mobile applicability decisions must be exact.');
  }
  const owners = manifest?.workspaceOwners;
  const ownerPaths = Array.isArray(owners) ? owners.map((owner) => owner?.path) : [];
  if (!same(ownerPaths, workspacePaths)
    || !owners?.every((owner) => applicationIds.includes(owner?.applicationId))) {
    add('WORKSPACE_OWNER_COVERAGE_INVALID', 'Every apps/* package needs one canonical application owner.');
  }
  const threat = manifest?.threatModelDocument;
  const actualThreatHash = sha256(threatModelBytes);
  const threatText = threatModelBytes.toString('utf8');
  if (!exactKeys(threat, ['path', 'sha256', 'modelCount', 'reviewState'])
    || threat.path !== 'docs/security/PPK-023_APPLICATION_SECURITY_PROFILES_THREAT_MODEL.md'
    || threat.sha256 !== actualThreatHash || threat.modelCount !== applicationIds.length
    || threat.reviewState !== 'REVIEWED') add('THREAT_MODEL_BINDING_INVALID', 'Threat model path, count or SHA-256 binding is invalid.');
  for (const applicationId of applicationIds) {
    const marker = `## APP-THREAT-${applicationId}`;
    if (threatText.split(marker).length !== 2) add('THREAT_MODEL_SECTION_INVALID', `${marker} must occur exactly once.`);
    const section = threatText.split(marker)[1]?.split('\n## ')[0] ?? '';
    for (const required of ['Korunan varlıklar:', 'Güven sınırları:', 'Giriş yüzeyleri:', 'Kötüye kullanım vakaları:', 'Zorunlu kontroller:', 'Kalan riskler:']) {
      if (!section.includes(required)) add('THREAT_MODEL_CONTENT_INCOMPLETE', `${marker} is missing ${required}`);
    }
  }
  return { findings, actualThreatHash };
};

const recomputeManifestHash = (manifest) => ({ ...manifest, manifestSha256: manifestHash(manifest) });
const runSelfTests = (baseline) => {
  const malicious = [];
  const copyBaseline = () => ({
    manifest: clone(baseline.manifest),
    threatModelBytes: Buffer.from(baseline.threatModelBytes),
    applicationIds: [...baseline.applicationIds],
    targetProfiles: clone(baseline.targetProfiles),
    workspacePaths: [...baseline.workspacePaths]
  });
  const expectFailure = (name, mutateInput) => {
    const input = copyBaseline();
    mutateInput(input);
    if (input.manifest) input.manifest = recomputeManifestHash(input.manifest);
    if (evaluateApplicationSecurityProfileGate(input).findings.length === 0) malicious.push(name);
  };
  expectFailure('default allow', (x) => { x.manifest.defaultDecision = 'ALLOW'; });
  expectFailure('compliance false claim', (x) => { x.manifest.complianceClaimed = true; });
  expectFailure('ASVS version drift', (x) => { x.manifest.standards.asvs.version = '5.0.1'; });
  expectFailure('ASVS control omission', (x) => { x.manifest.standards.asvs.controlIds.pop(); });
  expectFailure('MASVS control omission', (x) => { x.manifest.standards.masvs.controlIds.pop(); });
  expectFailure('SSDF practice omission', (x) => { x.manifest.standards.ssdf.controlIds.pop(); });
  expectFailure('profile omission', (x) => { x.manifest.profiles.pop(); });
  expectFailure('profile duplicate', (x) => { x.manifest.profiles[13] = clone(x.manifest.profiles[12]); });
  expectFailure('new canonical application', (x) => { x.applicationIds.push('new-app'); });
  expectFailure('workspace owner omission', (x) => { x.manifest.workspaceOwners.pop(); });
  expectFailure('missing N/A rationale', (x) => { x.manifest.assuranceProfiles[0].masvs.notApplicableReason = null; });
  expectFailure('mobile MASVS omission', (x) => { x.manifest.assuranceProfiles[1].masvs.controlIds.pop(); });
  expectFailure('profile-only native false claim', (x) => { x.manifest.profiles[2].nativeRuntimeValidated = true; });
  expectFailure('threat section omission', (x) => { x.threatModelBytes = Buffer.from(x.threatModelBytes.toString('utf8').replace('## APP-THREAT-ai-worker', '## APP-REMOVED-ai-worker')); });
  expectFailure('threat hash substitution', (x) => { x.manifest.threatModelDocument.sha256 = 'a'.repeat(64); });
  const hashTamper = copyBaseline();
  hashTamper.manifest.manifestSha256 = 'b'.repeat(64);
  if (evaluateApplicationSecurityProfileGate(hashTamper).findings.length === 0) malicious.push('manifest hash tamper');
  const extra = copyBaseline();
  extra.manifest.unreviewedException = true;
  extra.manifest = recomputeManifestHash(extra.manifest);
  if (evaluateApplicationSecurityProfileGate(extra).findings.length === 0) malicious.push('extra manifest escape');
  if (malicious.length) throw new Error(`PPK-023 malicious self-tests failed: ${malicious.join(', ')}`);
  const benign = [copyBaseline(), copyBaseline(), copyBaseline(), copyBaseline()];
  if (benign.some((input) => evaluateApplicationSecurityProfileGate(input).findings.length !== 0)) {
    throw new Error('PPK-023 benign self-tests failed.');
  }
  return { malicious: 17, benign: benign.length };
};

export const runApplicationSecurityProfileGate = async (root = process.cwd()) => {
  const [manifestBytes, kernelSource, targetBytes] = await Promise.all([
    readFile(resolve(root, MANIFEST_PATH)),
    readFile(resolve(root, KERNEL_PATH), 'utf8'),
    readFile(resolve(root, TARGET_PATH))
  ]);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const targetInventory = JSON.parse(targetBytes.toString('utf8'));
  const applicationIds = extractCanonicalApplicationIds(kernelSource);
  const workspacePaths = await discoverApplicationWorkspaces(root);
  const threatModelBytes = await readFile(resolve(root, manifest.threatModelDocument?.path ?? 'INVALID'));
  const baseline = { manifest, threatModelBytes, applicationIds, targetProfiles: targetInventory.targets, workspacePaths };
  const assertions = runSelfTests(baseline);
  const evaluation = evaluateApplicationSecurityProfileGate(baseline);
  return {
    schemaVersion: 1,
    requirement: 'PPK-023',
    gateVersion: 'PPK-023-V1',
    status: evaluation.findings.length === 0 ? 'PASS' : 'FAIL',
    canonicalApplications: applicationIds.length,
    mappedApplications: Array.isArray(manifest.profiles) ? manifest.profiles.length : 0,
    applicationWorkspaces: workspacePaths.length,
    assuranceProfiles: Array.isArray(manifest.assuranceProfiles) ? manifest.assuranceProfiles.length : 0,
    threatModels: manifest.threatModelDocument?.modelCount ?? 0,
    mobileMasvsApplications: manifest.profiles?.filter((profile) => profile.assuranceProfileId === 'MOBILE_COMPANION').length ?? 0,
    asvsControls: manifest.standards?.asvs?.controlIds?.length ?? 0,
    masvsControls: manifest.standards?.masvs?.controlIds?.length ?? 0,
    ssdfPractices: manifest.standards?.ssdf?.controlIds?.length ?? 0,
    maliciousSelfTestAssertions: assertions.malicious,
    benignSelfTestAssertions: assertions.benign,
    manifestSha256: manifest.manifestSha256,
    threatModelSha256: evaluation.actualThreatHash,
    complianceClaimed: false,
    nativeRuntimeValidationClaimedForProfileOnlyTargets: false,
    findings: evaluation.findings
  };
};

if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/verify-application-security-profile-gate.mjs')) {
  const report = await runApplicationSecurityProfileGate();
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/application-security-profile-gate.json', `${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'PASS') {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  console.log(`PPK-023 Application Security Profile Gate: PASS / ${report.mappedApplications}/${report.canonicalApplications} applications / ${report.threatModels} threat models / ASVS ${report.asvsControls} / MASVS ${report.masvsControls} / SSDF ${report.ssdfPractices} / ${report.maliciousSelfTestAssertions} malicious + ${report.benignSelfTestAssertions} benign self-tests / 0 findings.`);
}
