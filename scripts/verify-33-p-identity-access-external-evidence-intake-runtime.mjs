import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS,
  canonicalIdentityAccessEvidenceManifestPayload,
  verifyIdentityAccessExternalEvidenceIntake
} from './lib/identity-access-external-evidence-intake.mjs';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
if (process.argv.slice(2).some((argument) => argument !== '--no-write')) {
  throw new Error('Unsupported 33-P external evidence runtime argument');
}
const noWrite = process.argv.includes('--no-write');
const output = resolve(root, 'artifacts/validation/33-P-identity-access-external-evidence-intake-runtime.json');
const NOW = '2026-08-14T12:00:00.000Z';
const EXPIRES = '2026-08-21T12:00:00.000Z';
const COMMIT = 'a'.repeat(40);
const TREE = 'b'.repeat(40);
const SUBJECT = 'c'.repeat(64);

const claims = Object.freeze({
  'live-provider-account-test': {
    providers: ['apple', 'google', 'microsoft'].map((provider) => ({
      provider,
      clientAuthentication: provider === 'apple' ? 'private_key_jwt' : 'public_pkce',
      configured: true,
      liveAccountTested: true,
      authorizationCodeVerified: true,
      pkceS256Verified: true,
      stateVerified: true,
      nonceVerified: true,
      packagedCallbackVerified: true,
      idTokenSignatureVerified: true,
      issuerAudienceVerified: true,
      tokenStoredProtected: true,
      tokenBytesExposed: false
    })),
    providerAvailabilityGuaranteed: false,
    networkDeliveryGuaranteed: false
  },
  'real-authenticator-device-test': {
    distinctAuthenticatorCount: 2,
    registrationVerified: true,
    assertionVerified: true,
    multiplePasskeysVerified: true,
    deletionVerified: true,
    lostKeyRecoveryVerified: true,
    durableAuditVerified: true,
    userPresenceVerified: true,
    userVerificationVerified: true,
    biometricDataExposedToApplication: false,
    remoteAttestationClaimed: false
  },
  'cross-device-companion-test': {
    physicalDeviceCount: 2,
    windowsAuthoritativeSource: true,
    readOnlyCompanionVerified: true,
    remoteWriteRejected: true,
    staleVersionRejected: true,
    deviceRevocationVerified: true,
    encryptedEnvelopeVerified: true,
    deliveryGuaranteed: false
  },
  'credential-verifier-uat': {
    externalVerifierCount: 1,
    trustedIssuerConfigured: true,
    minimumDisclosureVerified: true,
    audienceBindingVerified: true,
    expiryVerified: true,
    revocationVerified: true,
    tamperRejected: true,
    identityCertificationClaimed: false
  },
  'human-uat': {
    participantCount: 2,
    scenarioCount: 8,
    scenariosPassed: 8,
    blockingFindings: 0,
    accessibilityObserved: true,
    secretMaterialObservedInUi: false
  },
  'privacy-review': {
    decision: 'ACCEPTED_WITH_LIMITATIONS', reviewerRole: 'privacy_reviewer', openBlockingFindings: 0,
    limitationsRecorded: true, certificationClaimed: false
  },
  'legal-review': {
    decision: 'ACCEPTED_WITH_LIMITATIONS', reviewerRole: 'legal_reviewer', openBlockingFindings: 0,
    limitationsRecorded: true, certificationClaimed: false
  },
  'identity-review': {
    decision: 'ACCEPTED_WITH_LIMITATIONS', reviewerRole: 'identity_reviewer', openBlockingFindings: 0,
    limitationsRecorded: true, certificationClaimed: false
  }
});

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const checks = [];
const check = (id, condition, details) => checks.push({ id, status: condition ? 'PASS' : 'FAIL', ...(details ? { details } : {}) });

const temporaryRoot = await mkdtemp(join(tmpdir(), 'ppt-33p-intake-'));
try {
  const evidenceRoot = join(temporaryRoot, 'evidence');
  await mkdir(evidenceRoot, { recursive: true });
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const signerKeyIdSha256 = sha256(publicKey.export({ type: 'spki', format: 'der' }));
  const files = [];
  for (const id of IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS) {
    const relativePath = `${id}.json`;
    const document = {
      schemaVersion: 1,
      evidenceId: id,
      status: 'PASS',
      source: { commit: COMMIT, tree: TREE },
      observedAt: NOW,
      subjectRefSha256: SUBJECT,
      containsPersonalData: false,
      containsSecretMaterial: false,
      claims: claims[id]
    };
    const bytes = Buffer.from(`${JSON.stringify(document, null, 2)}\n`, 'utf8');
    await writeFile(join(evidenceRoot, relativePath), bytes, { flag: 'wx', mode: 0o600 });
    files.push({ id, relativePath, sizeBytes: bytes.byteLength, sha256: sha256(bytes) });
    bytes.fill(0);
  }
  const unsignedManifest = {
    schemaVersion: 1,
    kind: 'ppt-identity-access-external-evidence',
    step: '33-P',
    decision: 'DEC-227',
    status: 'PASS',
    source: { commit: COMMIT, tree: TREE },
    hostRefSha256: 'd'.repeat(64),
    generatedAt: NOW,
    expiresAt: EXPIRES,
    signerKeyIdSha256,
    files
  };
  const signedManifest = (unsigned) => {
    const payload = Buffer.from(canonicalIdentityAccessEvidenceManifestPayload(unsigned), 'utf8');
    const signature = sign(null, payload, privateKey);
    try { return { ...unsigned, signatureBase64Url: signature.toString('base64url') }; }
    finally { payload.fill(0); signature.fill(0); }
  };
  const manifest = signedManifest(unsignedManifest);
  const manifestPath = join(evidenceRoot, 'manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });

  const verify = () => verifyIdentityAccessExternalEvidenceIntake({
    evidenceRoot,
    manifestPath,
    trustedSignerPublicKeyPem: publicKeyPem,
    trustedSignerKeyIdsSha256: [signerKeyIdSha256],
    expectedSourceCommit: COMMIT,
    expectedSourceTree: TREE,
    observedAt: NOW
  });
  const accepted = await verify();
  check('valid-signed-exact-bundle-ready-for-review', accepted.status === 'PASS'
    && accepted.closureReadiness.status === 'READY_FOR_GOVERNED_REVIEW'
    && accepted.closureReadiness.requirementPassGranted === false
    && accepted.closureReadiness.registryMutationPerformed === false
    && accepted.closureReadiness.persistentReceiptWritten === false
    && accepted.evidenceBinding?.sourceCommit === COMMIT
    && accepted.evidenceBinding?.sourceTree === TREE
    && accepted.evidenceBinding?.signerKeyIdSha256 === signerKeyIdSha256
    && accepted.evidenceBinding?.files?.length === IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS.length
    && /^[0-9a-f]{64}$/u.test(accepted.evidenceBinding?.evidenceTreeSha256 ?? ''), accepted);

  const traversalManifest = signedManifest({
    ...unsignedManifest,
    files: files.map((entry, index) => index === 0 ? { ...entry, relativePath: '../outside.json' } : entry)
  });
  await writeFile(manifestPath, `${JSON.stringify(traversalManifest, null, 2)}\n`, 'utf8');
  const rejectedTraversal = await verify();
  check('path-traversal-entry-rejected', rejectedTraversal.status === 'FAIL'
    && rejectedTraversal.results.some((item) => item.id === 'live-provider-account-test-byte-hash-binding' && item.status === 'FAIL'));
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const tamperPath = join(evidenceRoot, 'human-uat.json');
  const tampered = (await readFile(tamperPath, 'utf8')).replace('"blockingFindings": 0', '"blockingFindings": 1');
  await writeFile(tamperPath, tampered, 'utf8');
  const rejectedTamper = await verify();
  check('tampered-evidence-byte-and-semantic-rejected', rejectedTamper.status === 'FAIL'
    && rejectedTamper.results.some((item) => item.id === 'human-uat-byte-hash-binding' && item.status === 'FAIL'));

  const { publicKey: foreignPublicKey, privateKey: foreignPrivateKey } = generateKeyPairSync('ed25519');
  const foreignPem = foreignPublicKey.export({ type: 'spki', format: 'pem' }).toString();
  const foreignSigner = await verifyIdentityAccessExternalEvidenceIntake({
    evidenceRoot, manifestPath, trustedSignerPublicKeyPem: foreignPem,
    trustedSignerKeyIdsSha256: [signerKeyIdSha256],
    expectedSourceCommit: COMMIT, expectedSourceTree: TREE, observedAt: NOW
  });
  check('foreign-signer-rejected', foreignSigner.status === 'FAIL'
    && foreignSigner.results.some((item) => item.id === 'manifest-ed25519-signature' && item.status === 'FAIL'));

  let privateKeyMaterialRejected = false;
  try {
    await verifyIdentityAccessExternalEvidenceIntake({
      evidenceRoot, manifestPath,
      trustedSignerPublicKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      trustedSignerKeyIdsSha256: [signerKeyIdSha256],
      expectedSourceCommit: COMMIT, expectedSourceTree: TREE, observedAt: NOW
    });
  } catch (error) {
    privateKeyMaterialRejected = error instanceof Error
      && error.message.includes('yalnız bounded public-key PEM');
  }
  check('private-key-material-rejected-before-parse', privateKeyMaterialRejected);

  const foreignSignerKeyIdSha256 = sha256(foreignPublicKey.export({ type: 'spki', format: 'der' }));
  const foreignUnsignedManifest = { ...unsignedManifest, signerKeyIdSha256: foreignSignerKeyIdSha256 };
  const foreignPayload = Buffer.from(canonicalIdentityAccessEvidenceManifestPayload(foreignUnsignedManifest), 'utf8');
  const foreignSignature = sign(null, foreignPayload, foreignPrivateKey);
  const selfSignedForeignManifest = {
    ...foreignUnsignedManifest,
    signatureBase64Url: foreignSignature.toString('base64url')
  };
  foreignPayload.fill(0);
  foreignSignature.fill(0);
  await writeFile(manifestPath, `${JSON.stringify(selfSignedForeignManifest, null, 2)}\n`, 'utf8');
  const rejectedSelfSignedForeign = await verifyIdentityAccessExternalEvidenceIntake({
    evidenceRoot, manifestPath, trustedSignerPublicKeyPem: foreignPem,
    trustedSignerKeyIdsSha256: [signerKeyIdSha256],
    expectedSourceCommit: COMMIT, expectedSourceTree: TREE, observedAt: NOW
  });
  check('self-signed-untrusted-bundle-rejected', rejectedSelfSignedForeign.status === 'FAIL'
    && rejectedSelfSignedForeign.evidenceBinding === null
    && rejectedSelfSignedForeign.results.some((item) => item.id === 'trusted-signer-authority' && item.status === 'FAIL')
    && rejectedSelfSignedForeign.results.some((item) => item.id === 'manifest-ed25519-signature' && item.status === 'PASS'));
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const wrongSource = await verifyIdentityAccessExternalEvidenceIntake({
    evidenceRoot, manifestPath, trustedSignerPublicKeyPem: publicKeyPem,
    trustedSignerKeyIdsSha256: [signerKeyIdSha256],
    expectedSourceCommit: 'e'.repeat(40), expectedSourceTree: TREE, observedAt: NOW
  });
  check('foreign-source-commit-rejected', wrongSource.status === 'FAIL'
    && wrongSource.results.some((item) => item.id === 'manifest-source-binding' && item.status === 'FAIL'));

  const expired = await verifyIdentityAccessExternalEvidenceIntake({
    evidenceRoot, manifestPath, trustedSignerPublicKeyPem: publicKeyPem,
    trustedSignerKeyIdsSha256: [signerKeyIdSha256],
    expectedSourceCommit: COMMIT, expectedSourceTree: TREE, observedAt: '2026-09-30T12:00:00.000Z'
  });
  check('expired-bundle-rejected', expired.status === 'FAIL'
    && expired.results.some((item) => item.id === 'manifest-time-window' && item.status === 'FAIL'));
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

const failures = checks.filter((item) => item.status !== 'PASS');
const report = {
  schemaVersion: 1,
  step: '33-P',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checks: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  results: checks,
  actualExternalEvidenceStatus: 'NOT_RUN',
  requirementPassGranted: false,
  registryMutationPerformed: false,
  persistentReceiptWritten: false,
  generatedAt: new Date().toISOString()
};
if (!noWrite) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
console.log(`33-P external evidence intake runtime: ${report.status} (${report.passed}/${report.checks}; actual evidence NOT_RUN).`);
if (failures.length > 0) process.exitCode = 1;
