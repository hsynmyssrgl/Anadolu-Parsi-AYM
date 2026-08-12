import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, posix, resolve } from 'node:path';

export const PPK025_SCHEMA_VERSION = 1;
export const PPK025_SBOM_SPEC_VERSION = '1.6';
export const PPK025_VULNERABILITY_MAX_AGE_MS = 86_400_000;
export const PPK025_MAX_FUTURE_SKEW_MS = 300_000;
export const PPK025_AUDIT_SCOPES = Object.freeze([
  'root-production',
  'root-build-toolchain',
  'windows-packager'
]);

export const normalizePath = (value) => String(value).replaceAll('\\', '/').replace(/^\.\//u, '');

const sortedObject = (value) => {
  if (Array.isArray(value)) return value.map(sortedObject);
  if (!value || typeof value !== 'object' || value instanceof Uint8Array) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([key, child]) => [key, sortedObject(child)])
  );
};

export const canonicalJson = (value) => JSON.stringify(sortedObject(value));
export const prettyCanonicalJson = (value) => `${JSON.stringify(sortedObject(value), null, 2)}\n`;
export const sha256Bytes = (value) => createHash('sha256').update(value).digest('hex');
export const sha256Text = (value) => sha256Bytes(Buffer.from(value, 'utf8'));
export const sha256File = async (path) => sha256Bytes(await readFile(path));
export const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const packageNameFromPath = (packagePath, fallback) => {
  if (fallback) return fallback;
  const normalized = normalizePath(packagePath);
  const marker = 'node_modules/';
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex >= 0) return normalized.slice(markerIndex + marker.length);
  return normalized.split('/').at(-1) ?? normalized;
};

const npmPurlName = (name) => {
  if (!name.startsWith('@')) return encodeURIComponent(name);
  const [scope, packageName] = name.split('/');
  return `${encodeURIComponent(scope)}/${encodeURIComponent(packageName ?? '')}`;
};

export const npmPurl = (name, version) => `pkg:npm/${npmPurlName(name)}@${encodeURIComponent(version)}`;

const integrityToHex = (integrity) => {
  const match = /^sha512-([A-Za-z0-9+/]+={0,2})$/u.exec(String(integrity ?? ''));
  return match ? Buffer.from(match[1], 'base64').toString('hex') : undefined;
};

const resolveDependencyPath = (sourcePath, dependencyName, packages) => {
  let cursor = normalizePath(sourcePath);
  while (true) {
    const candidate = cursor
      ? posix.join(cursor, 'node_modules', dependencyName)
      : posix.join('node_modules', dependencyName);
    if (packages[candidate]) return candidate;
    if (!cursor) return undefined;
    const markerIndex = cursor.lastIndexOf('/node_modules/');
    cursor = markerIndex >= 0 ? cursor.slice(0, markerIndex) : '';
  }
};

const componentType = (packagePath, entry) => {
  if (entry.link === true || (!packagePath.startsWith('node_modules/') && !entry.resolved)) return 'application';
  return 'library';
};

const componentScope = (entry) => entry.optional === true
  ? 'optional'
  : entry.dev === true
    ? 'development'
    : 'required';

export const loadLockGraph = async ({ scope, lockfilePath }) => {
  const absoluteLockfilePath = resolve(lockfilePath);
  const lockBytes = await readFile(absoluteLockfilePath);
  const lock = JSON.parse(lockBytes.toString('utf8'));
  if (lock.lockfileVersion !== 3 || !lock.packages || typeof lock.packages !== 'object') {
    throw new Error(`${lockfilePath} must be an npm lockfileVersion 3 package graph.`);
  }
  const normalizedLockfilePath = normalizePath(lockfilePath);
  const rootDirectory = dirname(absoluteLockfilePath);
  const refs = new Map();
  const nodes = [];

  for (const [rawPath, entry] of Object.entries(lock.packages)) {
    const packagePath = normalizePath(rawPath);
    if (!entry || typeof entry !== 'object') continue;
    const isRoot = packagePath === '';
    let linkedManifest;
    if (entry.link === true && entry.resolved) {
      const linkedLockEntry = lock.packages[normalizePath(entry.resolved)];
      if (linkedLockEntry?.name && linkedLockEntry?.version) linkedManifest = linkedLockEntry;
      else {
        try { linkedManifest = await readJson(resolve(rootDirectory, entry.resolved, 'package.json')); }
        catch { linkedManifest = undefined; }
      }
    }
    const name = packageNameFromPath(packagePath, entry.name ?? linkedManifest?.name ?? (isRoot ? lock.name : undefined));
    const version = String(entry.version ?? linkedManifest?.version ?? (isRoot ? lock.version : ''));
    if (!name || !version) {
      throw new Error(`${normalizedLockfilePath}:${packagePath || '<root>'} has no exact name/version.`);
    }
    const ref = `urn:ppt:npm:${scope}:${sha256Text(packagePath || '<root>').slice(0, 24)}`;
    refs.set(packagePath, ref);
    nodes.push({
      scope,
      lockfilePath: normalizedLockfilePath,
      lockRoot: rootDirectory,
      packagePath,
      entry,
      name,
      version,
      ref,
      isRoot,
      isExternal: typeof entry.resolved === 'string' && entry.resolved.endsWith('.tgz')
    });
  }

  const dependencies = [];
  for (const node of nodes) {
    const dependencyRefs = new Set();
    for (const dependencyName of Object.keys(node.entry.dependencies ?? {})) {
      const resolvedPath = resolveDependencyPath(node.packagePath, dependencyName, lock.packages);
      if (!resolvedPath) throw new Error(`${normalizedLockfilePath}:${node.packagePath || '<root>'} cannot resolve ${dependencyName}.`);
      dependencyRefs.add(refs.get(resolvedPath));
    }
    for (const dependencyName of Object.keys(node.entry.optionalDependencies ?? {})) {
      const resolvedPath = resolveDependencyPath(node.packagePath, dependencyName, lock.packages);
      if (resolvedPath) dependencyRefs.add(refs.get(resolvedPath));
    }
    for (const dependencyName of Object.keys(node.entry.peerDependencies ?? {})) {
      const resolvedPath = resolveDependencyPath(node.packagePath, dependencyName, lock.packages);
      const optionalPeer = node.entry.peerDependenciesMeta?.[dependencyName]?.optional === true;
      if (!resolvedPath && !optionalPeer) {
        throw new Error(`${normalizedLockfilePath}:${node.packagePath || '<root>'} cannot resolve required peer ${dependencyName}.`);
      }
      if (resolvedPath) dependencyRefs.add(refs.get(resolvedPath));
    }
    if (node.isRoot) {
      for (const workspacePath of Object.keys(lock.packages).filter((item) => item && !item.startsWith('node_modules/'))) {
        dependencyRefs.add(refs.get(normalizePath(workspacePath)));
      }
      for (const dependencyName of Object.keys({
        ...(node.entry.dependencies ?? {}),
        ...(node.entry.devDependencies ?? {}),
        ...(node.entry.optionalDependencies ?? {})
      })) {
        const resolvedPath = resolveDependencyPath('', dependencyName, lock.packages);
        if (resolvedPath) dependencyRefs.add(refs.get(resolvedPath));
      }
    }
    dependencies.push({ ref: node.ref, dependsOn: [...dependencyRefs].filter(Boolean).sort() });
  }

  return {
    scope,
    lockfilePath: normalizedLockfilePath,
    lockSha256: sha256Bytes(lockBytes),
    lock,
    nodes,
    dependencies: dependencies.sort((left, right) => left.ref.localeCompare(right.ref, 'en'))
  };
};

const nodeToComponent = (node) => {
  const properties = [
    { name: 'ppt:lockfile', value: node.lockfilePath },
    { name: 'ppt:lockPath', value: node.packagePath || '<root>' },
    { name: 'ppt:dependencyScope', value: componentScope(node.entry) },
    { name: 'ppt:sourceGraph', value: node.scope }
  ];
  if (node.entry.resolved) properties.push({ name: 'ppt:resolved', value: String(node.entry.resolved) });
  if (node.entry.integrity) properties.push({ name: 'ppt:integrity', value: String(node.entry.integrity) });
  if (node.entry.link === true) properties.push({ name: 'ppt:localLink', value: 'true' });
  const sha512 = integrityToHex(node.entry.integrity);
  return {
    type: componentType(node.packagePath, node.entry),
    'bom-ref': node.ref,
    name: node.name,
    version: node.version,
    purl: npmPurl(node.name, node.version),
    ...(sha512 ? { hashes: [{ alg: 'SHA-512', content: sha512 }] } : {}),
    ...(node.entry.license ? { licenses: [{ expression: String(node.entry.license) }] } : {}),
    properties: properties.sort((left, right) => left.name.localeCompare(right.name, 'en'))
  };
};

export const buildDeterministicSbom = async ({ release, lockfiles }) => {
  const graphs = [];
  for (const item of lockfiles) graphs.push(await loadLockGraph(item));
  const components = graphs.flatMap((graph) => graph.nodes.map(nodeToComponent))
    .sort((left, right) => left['bom-ref'].localeCompare(right['bom-ref'], 'en'));
  const dependencies = graphs.flatMap((graph) => graph.dependencies)
    .sort((left, right) => left.ref.localeCompare(right.ref, 'en'));
  const externalComponents = graphs.flatMap((graph) => graph.nodes).filter((node) => node.isExternal);
  const missingIntegrity = externalComponents.filter((node) => !integrityToHex(node.entry.integrity));
  const missingLicense = externalComponents.filter((node) => typeof node.entry.license !== 'string' || node.entry.license.length === 0);
  const nonCanonicalRegistry = externalComponents.filter((node) => {
    try {
      const url = new URL(node.entry.resolved);
      return url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org';
    } catch {
      return true;
    }
  });
  if (missingIntegrity.length || missingLicense.length || nonCanonicalRegistry.length) {
    throw new Error(`SBOM material gate failed: integrity=${missingIntegrity.length}, license=${missingLicense.length}, registry=${nonCanonicalRegistry.length}.`);
  }
  const document = {
    bomFormat: 'CycloneDX',
    specVersion: PPK025_SBOM_SPEC_VERSION,
    version: 1,
    metadata: {
      component: {
        type: 'application',
        name: release.name,
        version: release.version,
        'bom-ref': `pkg:npm/${encodeURIComponent(release.name)}@${encodeURIComponent(release.version)}`
      },
      properties: [
        { name: 'ppt:deterministic', value: 'true' },
        { name: 'ppt:releaseChannel', value: release.channel },
        { name: 'ppt:releaseId', value: release.releaseId }
      ]
    },
    components,
    dependencies
  };
  return {
    document,
    report: {
      schemaVersion: PPK025_SCHEMA_VERSION,
      status: 'PASS',
      format: 'CycloneDX',
      specVersion: PPK025_SBOM_SPEC_VERSION,
      componentCount: components.length,
      dependencyNodeCount: dependencies.length,
      externalComponentCount: externalComponents.length,
      lockfiles: graphs.map((graph) => ({
        scope: graph.scope,
        path: graph.lockfilePath,
        sha256: graph.lockSha256,
        packageCount: graph.nodes.length,
        externalPackageCount: graph.nodes.filter((node) => node.isExternal).length
      })),
      sbomSha256: sha256Text(prettyCanonicalJson(document)),
      deterministicTimestampOmitted: true,
      randomSerialNumberOmitted: true
    },
    graphs
  };
};

export const validateFreshEvidenceTime = ({ observedAt, expiresAt, now = new Date(), maxAgeMs = PPK025_VULNERABILITY_MAX_AGE_MS, maxFutureSkewMs = PPK025_MAX_FUTURE_SKEW_MS }) => {
  const observed = Date.parse(observedAt);
  const expires = Date.parse(expiresAt);
  const current = now instanceof Date ? now.getTime() : Date.parse(now);
  if (![observed, expires, current].every(Number.isFinite)) return { valid: false, reason: 'TIME_MALFORMED' };
  const ageMs = current - observed;
  if (ageMs < -maxFutureSkewMs) return { valid: false, reason: 'OBSERVATION_FROM_FUTURE', ageMs };
  if (ageMs > maxAgeMs) return { valid: false, reason: 'OBSERVATION_STALE', ageMs };
  if (expires < current) return { valid: false, reason: 'EVIDENCE_EXPIRED', ageMs };
  if (expires <= observed || expires - observed > maxAgeMs) return { valid: false, reason: 'EXPIRY_WINDOW_INVALID', ageMs };
  return { valid: true, reason: 'FRESH', ageMs };
};

export const dssePreAuthEncoding = (payloadType, payloadBytes) => Buffer.concat([
  Buffer.from(`DSSEv1 ${Buffer.byteLength(payloadType)} ${payloadType} ${payloadBytes.length} `, 'utf8'),
  payloadBytes
]);

export const signDsseEnvelope = ({ payloadType, statement, keyId, privateKey }) => {
  const payloadBytes = Buffer.from(canonicalJson(statement), 'utf8');
  const pae = dssePreAuthEncoding(payloadType, payloadBytes);
  return {
    payloadType,
    payload: payloadBytes.toString('base64'),
    signatures: [{ keyid: keyId, sig: sign(null, pae, privateKey).toString('base64') }]
  };
};

export const verifyDsseEnvelope = ({ envelope, trustedKeys }) => {
  if (!envelope || typeof envelope !== 'object' || typeof envelope.payloadType !== 'string' || typeof envelope.payload !== 'string') {
    return { valid: false, reason: 'ENVELOPE_MALFORMED' };
  }
  let payloadBytes;
  try { payloadBytes = Buffer.from(envelope.payload, 'base64'); } catch { return { valid: false, reason: 'PAYLOAD_ENCODING_INVALID' }; }
  const signatures = Array.isArray(envelope.signatures) ? envelope.signatures : [];
  if (signatures.length !== 1) return { valid: false, reason: 'SIGNATURE_COUNT_INVALID' };
  const signature = signatures[0];
  const trusted = (trustedKeys ?? []).find((item) => item.keyId === signature.keyid && item.status === 'ACTIVE');
  if (!trusted) return { valid: false, reason: 'SIGNING_KEY_UNTRUSTED' };
  try {
    const publicKey = createPublicKey(trusted.publicKeyPem);
    const pae = dssePreAuthEncoding(envelope.payloadType, payloadBytes);
    if (!verify(null, pae, publicKey, Buffer.from(signature.sig, 'base64'))) return { valid: false, reason: 'SIGNATURE_INVALID' };
    const statement = JSON.parse(payloadBytes.toString('utf8'));
    if (canonicalJson(statement) !== payloadBytes.toString('utf8')) return { valid: false, reason: 'PAYLOAD_NOT_CANONICAL' };
    return { valid: true, reason: 'VERIFIED', statement, keyId: trusted.keyId };
  } catch {
    return { valid: false, reason: 'SIGNATURE_INVALID' };
  }
};

export const PPK025_NPM_REGISTRY_TRUST_MODEL = 'npm-cli-managed-registry-keys';

const exactStringSet = (actual, expected) => Array.isArray(actual)
  && actual.length === expected.length
  && new Set(actual).size === actual.length
  && expected.every((item) => actual.includes(item));

export const createSupplyChainReleasePolicyOptions = ({
  policy,
  trust,
  sourceIdentity,
  currentMaterials,
  externalAssetManifest,
  localGateEvidenceVerified,
  clock
}) => {
  const rootLock = policy.lockfiles?.find((item) => item.scope === 'root');
  const release = policy.release;
  if (!release || !sourceIdentity || !currentMaterials || !Array.isArray(externalAssetManifest?.assets)) {
    throw new Error('PPK-025 trusted policy inputs are incomplete.');
  }
  if (!Number.isInteger(rootLock?.workspaceCount) || rootLock.workspaceCount < 1) {
    throw new Error('PPK-025 canonical workspace count is missing.');
  }
  const expectedExternalAssets = externalAssetManifest.assets.map(({ id, version, source, sha256 }) => ({
    id,
    version,
    source,
    sha256
  }));
  return {
    expectedRelease: {
      version: release.version,
      channel: release.channel,
      releaseId: release.releaseId,
      sourceCommitId: sourceIdentity.sourceCommitId,
      sourceTreeId: sourceIdentity.sourceTreeId
    },
    expectedMaterials: { ...currentMaterials },
    expectedCoverage: {
      workspaceCount: rootLock.workspaceCount,
      sbomComponentCount: policy.requiredSbomComponentCount,
      dependencyNodeCount: policy.requiredDependencyNodeCount,
      externalRegistryPackageCount: policy.requiredRegistryPackageCount,
      licenseInventoryComponentCount: policy.requiredLicenseComponentCount
    },
    expectedExternalAssets,
    trustedProvenanceKeys: (trust.provenanceTrust?.trustedKeys ?? []).map((item) => ({
      keyId: item.keyId,
      publicKeyPem: item.publicKeyPem,
      status: item.status
    })),
    expectedPublisherSubject: trust.production?.expectedPublisherSubject ?? '',
    allowedCertificateThumbprints: trust.production?.allowedLeafCertificateThumbprints ?? [],
    allowedCertificateSha256: trust.production?.allowedLeafCertificateSha256 ?? [],
    registrySignatureTrustModel: PPK025_NPM_REGISTRY_TRUST_MODEL,
    localGateEvidenceVerified: localGateEvidenceVerified === true,
    vulnerabilityMaximumAgeMs: policy.vulnerability?.maxAgeMs ?? PPK025_VULNERABILITY_MAX_AGE_MS,
    maximumFutureSkewMs: policy.vulnerability?.maxFutureSkewMs ?? PPK025_MAX_FUTURE_SKEW_MS,
    ...(clock ? { clock } : {})
  };
};

export const validatePpk025LocalGateReports = ({
  policy,
  materials,
  externalAssetManifest,
  reports,
  now = new Date()
}) => {
  const failures = [];
  const check = (name, condition) => { if (!condition) failures.push(name); };
  const pass = (report) => report?.status === 'PASS'
    && (report.failed === undefined || report.failed === 0)
    && Array.isArray(report.failures)
    && report.failures.length === 0;
  const sbom = reports?.sbom;
  const license = reports?.license;
  const vulnerability = reports?.vulnerability;
  const registry = reports?.registry;
  const externalAssets = reports?.externalAssets;
  const buildToolchain = reports?.buildToolchain;
  const vulnerabilityDetails = reports?.vulnerabilityDetails ?? [];
  const registryDetails = reports?.registryDetails ?? [];
  const expectedVulnerabilityScopes = policy.vulnerability?.scopes ?? PPK025_AUDIT_SCOPES;
  const expectedRegistryScopes = policy.registrySignature?.scopes ?? ['root', 'windows-packager'];
  const expectedLockHashes = {
    'root-production': materials.rootPackageLockSha256,
    'root-build-toolchain': materials.rootPackageLockSha256,
    root: materials.rootPackageLockSha256,
    'windows-packager': materials.windowsPackagerLockSha256
  };

  check('SBOM_GATE_NOT_PASS', pass(sbom));
  check('SBOM_HASH_STALE', sbom?.sbomSha256 === materials.sbomSha256);
  check('SBOM_LOCK_BINDING_STALE', Array.isArray(sbom?.lockfiles)
    && sbom.lockfiles.length === 2
    && sbom.lockfiles.every((item) => item.sha256 === expectedLockHashes[item.scope]));
  check('LICENSE_GATE_NOT_PASS', pass(license));
  check('LICENSE_BINDING_STALE', license?.sbomSha256 === materials.sbomSha256
    && license?.noticesJsonSha256 === materials.thirdPartyNoticesJsonSha256
    && license?.noticesTextSha256 === materials.thirdPartyNoticesTextSha256
    && license?.licenseInventoryComponentCount === policy.requiredLicenseComponentCount);
  check('VULNERABILITY_GATE_NOT_PASS', pass(vulnerability));
  check('VULNERABILITY_GATE_SBOM_STALE', vulnerability?.sbomSha256 === materials.sbomSha256);
  check('VULNERABILITY_SCOPE_COVERAGE_INVALID', exactStringSet(
    vulnerabilityDetails.map((item) => item?.scope),
    expectedVulnerabilityScopes
  ));
  for (const report of vulnerabilityDetails) {
    const freshness = validateFreshEvidenceTime({
      observedAt: report?.observedAt,
      expiresAt: report?.expiresAt,
      now,
      maxAgeMs: policy.vulnerability?.maxAgeMs,
      maxFutureSkewMs: policy.vulnerability?.maxFutureSkewMs
    });
    check(`VULNERABILITY_DETAIL_INVALID:${report?.scope ?? 'UNKNOWN'}`, report?.status === 'PASS'
      && report?.commandExitCode === 0
      && report?.vulnerabilities?.total === 0
      && report?.findingPackageCount === 0
      && Array.isArray(report?.findings) && report.findings.length === 0
      && report?.lockfileSha256 === expectedLockHashes[report?.scope]
      && report?.sbomSha256 === materials.sbomSha256
      && freshness.valid === true);
  }
  check('REGISTRY_GATE_NOT_PASS', pass(registry));
  check('REGISTRY_SCOPE_COVERAGE_INVALID', exactStringSet(
    registryDetails.map((item) => item?.scope),
    expectedRegistryScopes
  ));
  for (const report of registryDetails) {
    const freshness = validateFreshEvidenceTime({
      observedAt: report?.observedAt,
      expiresAt: report?.expiresAt,
      now,
      maxAgeMs: policy.vulnerability?.maxAgeMs,
      maxFutureSkewMs: policy.vulnerability?.maxFutureSkewMs
    });
    check(`REGISTRY_DETAIL_INVALID:${report?.scope ?? 'UNKNOWN'}`, report?.status === 'PASS'
      && report?.commandExitCode === 0
      && report?.invalidCount === 0
      && report?.missingCount === 0
      && Array.isArray(report?.invalid) && report.invalid.length === 0
      && Array.isArray(report?.missing) && report.missing.length === 0
      && report?.lockfileSha256 === expectedLockHashes[report?.scope]
      && report?.sbomSha256 === materials.sbomSha256
      && freshness.valid === true);
  }
  const expectedAssets = externalAssetManifest?.assets?.map(({ id, version, source, sha256 }) => ({ id, version, source, sha256 })) ?? [];
  const reportedAssets = externalAssets?.assets?.map(({ id, version, source, sha256 }) => ({ id, version, source, sha256 })) ?? [];
  check('EXTERNAL_ASSET_GATE_NOT_PASS', pass(externalAssets));
  check('EXTERNAL_ASSET_MANIFEST_STALE', externalAssets?.manifestSha256 === materials.externalAssetManifestSha256);
  check('EXTERNAL_ASSET_COVERAGE_INVALID', externalAssets?.assetCount === expectedAssets.length
    && canonicalJson(reportedAssets) === canonicalJson(expectedAssets));
  const generatedAt = Date.parse(buildToolchain?.generatedAt);
  const currentTime = now instanceof Date ? now.getTime() : Date.parse(now);
  const buildAgeMs = currentTime - generatedAt;
  check('BUILD_TOOLCHAIN_GATE_NOT_PASS', pass(buildToolchain));
  check('BUILD_TOOLCHAIN_GATE_VERSION_STALE', buildToolchain?.packageVersion === policy.release?.version);
  check('BUILD_TOOLCHAIN_GATE_STALE', Number.isFinite(generatedAt)
    && Number.isFinite(currentTime)
    && buildAgeMs >= -PPK025_MAX_FUTURE_SKEW_MS
    && buildAgeMs <= PPK025_VULNERABILITY_MAX_AGE_MS);
  return Object.freeze({ valid: failures.length === 0, failures: Object.freeze(failures) });
};

export const publicKeySha256 = (publicKeyPem) => sha256Bytes(createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' }));

export const assertSafeArtifactPath = (path, prefixes = ['artifacts/manifests/', 'artifacts/validation/']) => {
  const normalized = normalizePath(path);
  if (normalized.includes('..') || !prefixes.some((prefix) => normalized.startsWith(prefix))) {
    throw new Error(`Unsafe supply-chain artifact path: ${path}`);
  }
  return normalized;
};
