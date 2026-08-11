import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const root = process.cwd();
const out = resolve(process.argv[2] ?? 'artifacts/validation/build182-root-trust-verification-contract.json');
const read = (path) => readFile(join(root, path), 'utf8');
const files = Object.fromEntries(await Promise.all([
  ['domain', 'packages/domain/src/app-data.ts'],
  ['useCases', 'packages/application/src/external-backup-evidence-use-cases.ts'],
  ['repoContract', 'packages/repository-contracts/src/external-backup-inventory-repository.ts'],
  ['repository', 'packages/repositories/src/external-backup-inventory-repository.ts'],
  ['migrations', 'packages/database/src/family-database-migrations.ts'],
  ['renderer', 'apps/desktop/src/renderer/App.tsx'],
  ['decision', 'docs/10_MASTER_DECISION_REGISTER.md'],
  ['authority', 'docs/11_DOCUMENT_AUTHORITY_MATRIX.md'],
  ['spec', 'docs/EXTERNAL_EVIDENCE_ROOT_TRUST_VERIFICATION_V1.md'],
  ['adr', 'docs/adr/ADR-055-out-of-band-dual-evidence-root-trust-verification.md'],
  ['policy', 'config/product-lifecycle-policy.json'],
  ['preflight', 'config/source-preflight-checks.json'],
  ['package', 'package.json']
].map(async ([key, path]) => [key, await read(path)])));

const failures = [];
const checks = [];
const check = (label, condition) => {
  checks.push(label);
  if (!condition) failures.push(label);
};
const has = (key, marker) => files[key].includes(marker);

for (const marker of [
  "ExternalBackupEvidenceIssuerVerificationMethod='legacy_unverified'|'out_of_band_dual_evidence'|'rotation_inherited'",
  'legalEntityName:string',
  'identityEvidenceReference:string',
  'keyFingerprintEvidenceReference:string',
  'expectedFingerprintSha256:string',
  'verificationWitnessName:string',
  'verificationWitnessOrganization:string',
  'verificationCheckedAt:string'
]) check(`domain marker: ${marker}`, has('domain', marker));

for (const marker of [
  'ExternalBackupEvidenceRootTrustVerificationV1',
  'canonicalExternalBackupEvidenceRootTrustVerification',
  'out-of-band-dual-evidence-verified',
  'KÖK GÜVENİNİ DOĞRULA',
  'expectedFingerprint!==inspected.value.fingerprintSha256',
  'identityEvidenceReference.toLocaleLowerCase',
  "verificationMethod:'out_of_band_dual_evidence'",
  "verificationMethod:'rotation_inherited'",
  'verificationReceiptSha256:this.crypto.sha256Utf8'
]) check(`use-case marker: ${marker}`, has('useCases', marker));

const useCase = files.useCases;
const registerBody = useCase.slice(useCase.indexOf('export class RegisterExternalBackupEvidenceIssuerUseCase'), useCase.indexOf('export class RotateExternalBackupEvidenceIssuerUseCase'));
check('fingerprint comparison precedes strong authentication', registerBody.indexOf('expectedFingerprint!==inspected.value.fingerprintSha256') < registerBody.indexOf('strongAuth.verify'));
check('confirmation precedes strong authentication', registerBody.indexOf('externalBackupEvidenceIssuerAddConfirmation(expectedFingerprint)') < registerBody.indexOf('strongAuth.verify'));
check('duplicate evidence channel rejected before write', registerBody.indexOf("identityEvidenceReference.toLocaleLowerCase('tr-TR')===keyFingerprintEvidenceReference.toLocaleLowerCase('tr-TR')") < registerBody.indexOf('this.write.insertEvidenceIssuer'));

for (const marker of [
  'verificationMethod', 'legalEntityName', 'identityEvidenceReference',
  'keyFingerprintEvidenceReference', 'verificationWitnessName',
  'verificationWitnessOrganization', 'verificationCheckedAt',
  'verificationReceiptSha256'
]) check(`repository contract marker: ${marker}`, has('repoContract', marker));

for (const marker of [
  'verification_method', 'legal_entity_name', 'identity_evidence_reference',
  'key_fingerprint_evidence_reference', 'verification_witness_name',
  'verification_witness_organization', 'verification_checked_at',
  'verification_receipt_sha256'
]) check(`repository mapping marker: ${marker}`, has('repository', marker));

for (const marker of [
  'REVISION-182-EXTERNAL-EVIDENCE-ROOT-TRUST-VERIFICATION',
  "createMigrationDefinition(28, 'external_evidence_root_trust_verification'",
  "DEFAULT 'legacy_unverified'",
  'idx_external_backup_evidence_issuer_verification'
]) check(`migration marker: ${marker}`, has('migrations', marker));

for (const marker of [
  'Resmî tüzel kişi adı',
  'Bağımsız kanaldan alınan SHA-256 parmak izi',
  'Kurum kimliği kanıt referansı',
  'Anahtar parmak izi kanıt referansı',
  'Bağımsız tanık adı',
  'Doğrulanmış kök güveni ekle',
  'Doğrulama makbuzu SHA-256'
]) check(`renderer marker: ${marker}`, has('renderer', marker));

for (const [key, marker] of [['decision','DEC-072'],['authority','ADR-055'],['spec','KÖK GÜVENİNİ DOĞRULA'],['adr','Kurum Dışı Çift Kanıtlı'],['policy','DEC-072']]) check(`governance marker ${key}: ${marker}`, has(key, marker));
check('policy requires two independent evidence channels', has('policy', '"independentEvidenceChannels": 2'));
check('policy forbids raw identity document storage', has('policy', '"rawIdentityDocumentsStored": false'));
check('package exposes Build 182 contract command', has('package', 'verify:build182:root-trust-verification-contract'));
check('preflight includes Build 182 contract', has('preflight', 'build182-root-trust-verification-contract'));

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  featureBuild: 182,
  stage: 'Bronze RC2 Active Development',
  scope: 'Out-of-band dual-evidence root trust verification before registering external evidence-provider Ed25519 keys',
  status: failures.length ? 'FAIL' : 'PASS',
  assertions: checks.length,
  checks,
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 182 root trust verification contract: ${report.status} (${checks.length - failures.length}/${checks.length})`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
