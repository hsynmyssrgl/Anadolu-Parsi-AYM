import { createHash, createPublicKey, verify } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_EVIDENCE_BYTES = 256 * 1024;
const MAX_EVIDENCE_VALIDITY_MS = 31 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const SHA256 = /^[0-9a-f]{64}$/u;
const GIT_OBJECT_ID = /^[0-9a-f]{40,64}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;

export const IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS = Object.freeze([
  'live-provider-account-test',
  'real-authenticator-device-test',
  'cross-device-companion-test',
  'credential-verifier-uat',
  'human-uat',
  'privacy-review',
  'legal-review',
  'identity-review'
]);

const isPlainRecord = (value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const exactKeys = (value, required, optional = []) => {
  if (!isPlainRecord(value)) return false;
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => allowed.has(key));
};

const canonicalJson = (value) => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Kanıt JSON sayısı sonlu olmalıdır.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!isPlainRecord(value)) throw new Error('Kanıt yalnız düz JSON değerleri içerebilir.');
  return `{${Object.keys(value).sort().map((key) => {
    if (/^(?:__proto__|prototype|constructor)$/u.test(key)) throw new Error('Kanıt JSON anahtarı yasaktır.');
    return `${JSON.stringify(key)}:${canonicalJson(value[key])}`;
  }).join(',')}}`;
};

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const validIso = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  && new Date(value).toISOString() === value;
const validSha256 = (value) => typeof value === 'string' && SHA256.test(value);
const pass = (checks, id, condition, details) => checks.push(Object.freeze({
  id,
  status: condition ? 'PASS' : 'FAIL',
  ...(details === undefined ? {} : { details })
}));

const validateReview = (claims) => exactKeys(claims, [
  'decision', 'reviewerRole', 'openBlockingFindings', 'limitationsRecorded', 'certificationClaimed'
]) && claims.decision === 'ACCEPTED_WITH_LIMITATIONS'
  && ['privacy_reviewer', 'legal_reviewer', 'identity_reviewer'].includes(claims.reviewerRole)
  && claims.openBlockingFindings === 0 && claims.limitationsRecorded === true
  && claims.certificationClaimed === false;

const validateProviderClaims = (claims) => {
  if (!exactKeys(claims, ['providers', 'providerAvailabilityGuaranteed', 'networkDeliveryGuaranteed'])
    || claims.providerAvailabilityGuaranteed !== false || claims.networkDeliveryGuaranteed !== false
    || !Array.isArray(claims.providers) || claims.providers.length !== 3) return false;
  const providers = new Set();
  for (const item of claims.providers) {
    if (!exactKeys(item, [
      'provider', 'clientAuthentication', 'configured', 'liveAccountTested', 'authorizationCodeVerified',
      'pkceS256Verified', 'stateVerified', 'nonceVerified', 'packagedCallbackVerified',
      'idTokenSignatureVerified', 'issuerAudienceVerified', 'tokenStoredProtected', 'tokenBytesExposed'
    ]) || !['apple', 'google', 'microsoft'].includes(item.provider) || providers.has(item.provider)
      || item.clientAuthentication !== (item.provider === 'apple' ? 'private_key_jwt' : 'public_pkce')
      || ['configured', 'liveAccountTested', 'authorizationCodeVerified', 'pkceS256Verified', 'stateVerified',
        'nonceVerified', 'packagedCallbackVerified', 'idTokenSignatureVerified', 'issuerAudienceVerified',
        'tokenStoredProtected'].some((key) => item[key] !== true)
      || item.tokenBytesExposed !== false) return false;
    providers.add(item.provider);
  }
  return ['apple', 'google', 'microsoft'].every((provider) => providers.has(provider));
};

const validateEvidenceClaims = (id, claims) => {
  if (!isPlainRecord(claims)) return false;
  if (id === 'live-provider-account-test') return validateProviderClaims(claims);
  if (id === 'real-authenticator-device-test') return exactKeys(claims, [
    'distinctAuthenticatorCount', 'registrationVerified', 'assertionVerified', 'multiplePasskeysVerified',
    'deletionVerified', 'lostKeyRecoveryVerified', 'durableAuditVerified', 'userPresenceVerified',
    'userVerificationVerified', 'biometricDataExposedToApplication', 'remoteAttestationClaimed'
  ]) && Number.isSafeInteger(claims.distinctAuthenticatorCount) && claims.distinctAuthenticatorCount >= 2
    && ['registrationVerified', 'assertionVerified', 'multiplePasskeysVerified', 'deletionVerified',
      'lostKeyRecoveryVerified', 'durableAuditVerified', 'userPresenceVerified', 'userVerificationVerified']
      .every((key) => claims[key] === true)
    && claims.biometricDataExposedToApplication === false && claims.remoteAttestationClaimed === false;
  if (id === 'cross-device-companion-test') return exactKeys(claims, [
    'physicalDeviceCount', 'windowsAuthoritativeSource', 'readOnlyCompanionVerified', 'remoteWriteRejected',
    'staleVersionRejected', 'deviceRevocationVerified', 'encryptedEnvelopeVerified', 'deliveryGuaranteed'
  ]) && Number.isSafeInteger(claims.physicalDeviceCount) && claims.physicalDeviceCount >= 2
    && ['windowsAuthoritativeSource', 'readOnlyCompanionVerified', 'remoteWriteRejected', 'staleVersionRejected',
      'deviceRevocationVerified', 'encryptedEnvelopeVerified'].every((key) => claims[key] === true)
    && claims.deliveryGuaranteed === false;
  if (id === 'credential-verifier-uat') return exactKeys(claims, [
    'externalVerifierCount', 'trustedIssuerConfigured', 'minimumDisclosureVerified', 'audienceBindingVerified',
    'expiryVerified', 'revocationVerified', 'tamperRejected', 'identityCertificationClaimed'
  ]) && Number.isSafeInteger(claims.externalVerifierCount) && claims.externalVerifierCount >= 1
    && ['trustedIssuerConfigured', 'minimumDisclosureVerified', 'audienceBindingVerified', 'expiryVerified',
      'revocationVerified', 'tamperRejected'].every((key) => claims[key] === true)
    && claims.identityCertificationClaimed === false;
  if (id === 'human-uat') return exactKeys(claims, [
    'participantCount', 'scenarioCount', 'scenariosPassed', 'blockingFindings', 'accessibilityObserved',
    'secretMaterialObservedInUi'
  ]) && Number.isSafeInteger(claims.participantCount) && claims.participantCount >= 2
    && Number.isSafeInteger(claims.scenarioCount) && claims.scenarioCount >= 8
    && claims.scenariosPassed === claims.scenarioCount && claims.blockingFindings === 0
    && claims.accessibilityObserved === true && claims.secretMaterialObservedInUi === false;
  if (id === 'privacy-review') return validateReview(claims) && claims.reviewerRole === 'privacy_reviewer';
  if (id === 'legal-review') return validateReview(claims) && claims.reviewerRole === 'legal_reviewer';
  if (id === 'identity-review') return validateReview(claims) && claims.reviewerRole === 'identity_reviewer';
  return false;
};

const canonicalRelativePath = (value) => typeof value === 'string' && value.length >= 3 && value.length <= 240
  && !value.includes('\\') && !value.startsWith('/') && !value.split('/').includes('..')
  && /^[A-Za-z0-9][A-Za-z0-9._/-]*\.json$/u.test(value);

const readBoundedJson = async (path, maximumBytes) => {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size < 2 || info.size > maximumBytes) {
    throw new Error('Kanıt dosyası regular, tek-link ve bounded olmalıdır.');
  }
  const bytes = await readFile(path);
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { value: JSON.parse(text), bytes: Buffer.from(bytes), sizeBytes: bytes.byteLength, sha256: sha256(bytes) };
  } finally { bytes.fill(0); }
};

const resolveEvidencePath = async (root, relativePath) => {
  if (!canonicalRelativePath(relativePath)) throw new Error('Kanıt göreli yolu canonical değildir.');
  const candidate = resolve(root, relativePath);
  const candidateInfo = await lstat(candidate);
  if (!candidateInfo.isFile() || candidateInfo.isSymbolicLink()) {
    throw new Error('Kanıt yolu regular dosya olmalı ve symlink olamaz.');
  }
  const rootReal = await realpath(root);
  const candidateReal = await realpath(candidate);
  const inside = relative(rootReal, candidateReal);
  if (inside === '' || inside === '..' || inside.startsWith(`..${sep}`) || resolve(rootReal, inside) !== candidateReal) {
    throw new Error('Kanıt yolu paket kökü dışına çıkamaz.');
  }
  return candidateReal;
};

const validateEvidenceDocument = (value, id, manifest, observedAt) => exactKeys(value, [
  'schemaVersion', 'evidenceId', 'status', 'source', 'observedAt', 'subjectRefSha256',
  'containsPersonalData', 'containsSecretMaterial', 'claims'
]) && value.schemaVersion === 1 && value.evidenceId === id && value.status === 'PASS'
  && exactKeys(value.source, ['commit', 'tree'])
  && value.source.commit === manifest.source.commit && value.source.tree === manifest.source.tree
  && validIso(value.observedAt)
  && Date.parse(value.observedAt) <= Date.parse(manifest.generatedAt) + MAX_FUTURE_SKEW_MS
  && Date.parse(manifest.generatedAt) - Date.parse(value.observedAt) <= MAX_EVIDENCE_VALIDITY_MS
  && Date.parse(value.observedAt) <= Date.parse(observedAt) + MAX_FUTURE_SKEW_MS
  && validSha256(value.subjectRefSha256) && value.containsPersonalData === false
  && value.containsSecretMaterial === false && validateEvidenceClaims(id, value.claims);

/**
 * Verifies a detached, Ed25519-signed 33-P evidence bundle. A PASS result is only
 * READY_FOR_GOVERNED_REVIEW and never mutates the registry or completion ledger.
 */
export const verifyIdentityAccessExternalEvidenceIntake = async ({
  evidenceRoot,
  manifestPath,
  trustedSignerPublicKeyPem,
  trustedSignerKeyIdsSha256,
  expectedSourceCommit,
  expectedSourceTree,
  observedAt = new Date().toISOString()
}) => {
  const checks = [];
  const root = resolve(evidenceRoot);
  if (!validIso(observedAt) || !GIT_OBJECT_ID.test(expectedSourceCommit) || !GIT_OBJECT_ID.test(expectedSourceTree)) {
    throw new Error('Kanıt intake kaynak veya zaman girdisi geçersizdir.');
  }
  if (typeof trustedSignerPublicKeyPem !== 'string'
    || Buffer.byteLength(trustedSignerPublicKeyPem, 'utf8') > 16 * 1024
    || !trustedSignerPublicKeyPem.includes('-----BEGIN PUBLIC KEY-----')
    || !trustedSignerPublicKeyPem.includes('-----END PUBLIC KEY-----')
    || trustedSignerPublicKeyPem.includes('PRIVATE KEY')) {
    throw new Error('Kanıt signer girdisi yalnız bounded public-key PEM içerebilir.');
  }
  if (!Array.isArray(trustedSignerKeyIdsSha256) || trustedSignerKeyIdsSha256.length < 1
    || trustedSignerKeyIdsSha256.length > 16
    || trustedSignerKeyIdsSha256.some((keyId) => !validSha256(keyId))
    || new Set(trustedSignerKeyIdsSha256).size !== trustedSignerKeyIdsSha256.length) {
    throw new Error('Kanıt signer güven kümesi exact, benzersiz ve kaynak-yönetimli olmalıdır.');
  }
  const publicKey = createPublicKey(trustedSignerPublicKeyPem);
  if (publicKey.type !== 'public' || publicKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('Kanıt signer anahtarı Ed25519 public key olmalıdır.');
  }
  const signerKeyIdSha256 = sha256(publicKey.export({ type: 'spki', format: 'der' }));
  pass(checks, 'trusted-signer-authority', trustedSignerKeyIdsSha256.includes(signerKeyIdSha256));
  const manifestRelativePath = relative(root, resolve(manifestPath)).split(sep).join('/');
  const manifestFilePath = await resolveEvidencePath(root, manifestRelativePath);
  const manifestRead = await readBoundedJson(manifestFilePath, MAX_MANIFEST_BYTES);
  const manifest = manifestRead.value;
  manifestRead.bytes.fill(0);
  const requiredManifestKeys = [
    'schemaVersion', 'kind', 'step', 'decision', 'status', 'source', 'hostRefSha256',
    'generatedAt', 'expiresAt', 'signerKeyIdSha256', 'files', 'signatureBase64Url'
  ];
  pass(checks, 'manifest-exact-shape', exactKeys(manifest, requiredManifestKeys));
  pass(checks, 'manifest-authority', manifest?.schemaVersion === 1
    && manifest?.kind === 'ppt-identity-access-external-evidence'
    && manifest?.step === '33-P' && manifest?.decision === 'DEC-227' && manifest?.status === 'PASS');
  pass(checks, 'manifest-source-binding', exactKeys(manifest?.source, ['commit', 'tree'])
    && manifest.source.commit === expectedSourceCommit && manifest.source.tree === expectedSourceTree, manifest?.source);
  pass(checks, 'manifest-host-binding', validSha256(manifest?.hostRefSha256));
  pass(checks, 'manifest-signer-binding', manifest?.signerKeyIdSha256 === signerKeyIdSha256);
  const validTimes = validIso(manifest?.generatedAt) && validIso(manifest?.expiresAt)
    && Date.parse(manifest.generatedAt) <= Date.parse(observedAt) + MAX_FUTURE_SKEW_MS
    && Date.parse(manifest.expiresAt) > Date.parse(observedAt)
    && Date.parse(manifest.expiresAt) - Date.parse(manifest.generatedAt) <= MAX_EVIDENCE_VALIDITY_MS;
  pass(checks, 'manifest-time-window', validTimes);
  let signatureValid = false;
  if (exactKeys(manifest, requiredManifestKeys) && typeof manifest.signatureBase64Url === 'string'
    && !manifest.signatureBase64Url.includes('=') && BASE64URL.test(manifest.signatureBase64Url)) {
    const signature = Buffer.from(manifest.signatureBase64Url, 'base64url');
    const signed = { ...manifest };
    delete signed.signatureBase64Url;
    const payload = Buffer.from(canonicalJson(signed), 'utf8');
    try {
      signatureValid = signature.byteLength === 64 && verify(null, payload, publicKey, signature);
    } finally { signature.fill(0); payload.fill(0); }
  }
  pass(checks, 'manifest-ed25519-signature', signatureValid);

  const files = Array.isArray(manifest?.files) ? manifest.files : [];
  pass(checks, 'manifest-exact-evidence-set', files.length === IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS.length
    && files.every((entry, index) => exactKeys(entry, ['id', 'relativePath', 'sizeBytes', 'sha256'])
      && entry.id === IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS[index])
    && new Set(files.map((entry) => entry.id)).size === files.length);

  for (const id of IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS) {
    const entry = files.find((candidate) => candidate?.id === id);
    pass(checks, `${id}-manifest-entry`, Boolean(entry));
    if (!entry) continue;
    try {
      const filePath = await resolveEvidencePath(root, entry.relativePath);
      const evidenceRead = await readBoundedJson(filePath, MAX_EVIDENCE_BYTES);
      const digestMatches = Number.isSafeInteger(entry.sizeBytes) && entry.sizeBytes === evidenceRead.sizeBytes
        && validSha256(entry.sha256) && entry.sha256 === evidenceRead.sha256;
      pass(checks, `${id}-byte-hash-binding`, digestMatches);
      pass(checks, `${id}-semantic-contract`, validateEvidenceDocument(evidenceRead.value, id, manifest, observedAt));
      evidenceRead.bytes.fill(0);
    } catch (error) {
      pass(checks, `${id}-byte-hash-binding`, false, error instanceof Error ? error.message : String(error));
      pass(checks, `${id}-semantic-contract`, false);
    }
  }

  const failures = checks.filter((item) => item.status !== 'PASS');
  return Object.freeze({
    schemaVersion: 1,
    step: '33-P',
    decision: 'DEC-227',
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checks: checks.length,
    passed: checks.length - failures.length,
    failed: failures.length,
    results: Object.freeze(checks),
    closureReadiness: Object.freeze({
      status: failures.length === 0 ? 'READY_FOR_GOVERNED_REVIEW' : 'NOT_READY',
      requirementPassGranted: false,
      registryMutationPerformed: false,
      persistentReceiptWritten: false
    }),
    limitations: Object.freeze([
      'İntake doğrulaması dış işlemleri kendisi çalıştırmaz.',
      'PASS yalnız exact kaynak ve signer bağlı kanıt paketinin gözden geçirmeye hazır olduğunu gösterir.',
      'Registry, persistent receipt veya requirement durumu ayrı yönetişim kapanışı olmadan değişmez.'
    ]),
    observedAt
  });
};

export const canonicalIdentityAccessEvidenceManifestPayload = (manifestWithoutSignature) =>
  canonicalJson(manifestWithoutSignature);
