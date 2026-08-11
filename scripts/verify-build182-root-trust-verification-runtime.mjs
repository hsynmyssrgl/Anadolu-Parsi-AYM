import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const tmp = join(root, '.tmp', 'build182-root-trust-verification-runtime');
const reportPath = resolve(process.argv[2] ?? 'artifacts/validation/build182-root-trust-verification-runtime.json');
await rm(tmp, { recursive: true, force: true });
await mkdir(tmp, { recursive: true });

const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
const ts = (await import(pathToFileURL(join(globalRoot, 'typescript', 'lib', 'typescript.js')).href)).default;
const source = await readFile('packages/application/src/external-backup-evidence-use-cases.ts', 'utf8');
const body = source.slice(source.indexOf('export interface ExternalBackupEvidenceCryptoPort'));
const prelude = `
const ERROR_CODES={AUTHORIZATION_DENIED:'AUTHORIZATION_DENIED',CORE_INVALID_ARGUMENT:'CORE_INVALID_ARGUMENT',RESOURCE_NOT_FOUND:'RESOURCE_NOT_FOUND',RESOURCE_CONFLICT:'RESOURCE_CONFLICT'};
const createAppError=(x)=>x,err=(error)=>({ok:false,error}),ok=(value)=>({ok:true,value});
type AppError=any;type Result<T,E>=({ok:true,value:T}|{ok:false,error:E});
type ExternalBackupCopyView=any;type ExternalBackupDestructionEvidenceView=any;type ExternalBackupEvidenceIssuerRotationView=any;type ExternalBackupEvidenceIssuerView=any;
type RegisterExternalBackupEvidenceIssuerInput=any;type RevokeExternalBackupEvidenceIssuerInput=any;type RotateExternalBackupEvidenceIssuerInput=any;type VerifyExternalBackupDestructionEvidenceInput=any;
type StrongAuthenticationPort=any;type ExternalBackupInventoryApplicationContext=any;
`;
const transpiled = ts.transpileModule(prelude + body, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const useCasePath = join(tmp, 'use-cases.mjs');
await writeFile(useCasePath, transpiled.outputText);

const adapterSource = await readFile('apps/desktop/src/main/external-backup-evidence-crypto-adapter.ts', 'utf8');
const adapterBody = adapterSource.slice(adapterSource.indexOf('export class NodeExternalBackupEvidenceCryptoAdapter'));
const adapterTranspiled = ts.transpileModule(`import { createHash, createPublicKey, verify } from 'node:crypto';const err=(error)=>({ok:false,error}),ok=(value)=>({ok:true,value});\n${adapterBody}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const adapterPath = join(tmp, 'adapter.mjs');
await writeFile(adapterPath, adapterTranspiled.outputText);

const useCases = await import(pathToFileURL(useCasePath).href);
const { NodeExternalBackupEvidenceCryptoAdapter } = await import(pathToFileURL(adapterPath).href);
const crypto = new NodeExternalBackupEvidenceCryptoAdapter();
const admin = { familyId: 'family', actor: { userId: 'admin', role: 'family_admin' }, correlationId: 'corr' };
let authCalls = 0;
const auth = { verify: (_context, input) => { authCalls += 1; return input.password === 'correct-password' ? { ok: true, value: undefined } : { ok: false, error: { message: 'bad auth' } }; } };
const issuers = new Map();
const query = {
  findCopy: () => ({ ok: true, value: null }),
  listEvidenceIssuers: (_context, limit) => ({ ok: true, value: [...issuers.values()].slice(0, limit) }),
  findEvidenceIssuer: (_context, id) => ({ ok: true, value: issuers.get(id) ?? null }),
  findEvidenceIssuerByFingerprint: (_context, fingerprint) => ({ ok: true, value: [...issuers.values()].find((row) => row.fingerprintSha256 === fingerprint) ?? null }),
  listEvidenceIssuerRotations: () => ({ ok: true, value: [] }),
  findEvidenceIssuerRotationByReceipt: () => ({ ok: true, value: null }),
  listDestructionEvidence: () => ({ ok: true, value: [] }),
  findDestructionEvidenceByReceipt: () => ({ ok: true, value: null })
};
const write = {
  insertEvidenceIssuer: (_context, row) => { const value = { ...row, trustState: 'active' }; issuers.set(row.id, value); return { ok: true, value }; },
  rotateEvidenceIssuer: () => ({ ok: true, value: null }),
  revokeEvidenceIssuer: () => ({ ok: true, value: null }),
  insertVerifiedDestructionEvidence: () => ({ ok: true, value: null })
};
const register = new useCases.RegisterExternalBackupEvidenceIssuerUseCase(query, write, crypto, auth);
const key = generateKeyPairSync('ed25519');
const publicKeyPem = key.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const inspected = crypto.inspectEd25519PublicKey(publicKeyPem);
assert.equal(inspected.ok, true);
const fingerprint = inspected.value.fingerprintSha256;
const base = {
  label: 'Sağlayıcı A',
  publicKeyPem,
  legalEntityName: 'Sağlayıcı A Teknoloji A.Ş.',
  identityEvidenceReference: 'Ticaret sicili ve imzalı sözleşme kaydı 2026/182',
  keyFingerprintEvidenceReference: 'Bağımsız telefon görüşmesi ve imzalı anahtar yazısı 2026/182',
  expectedFingerprintSha256: fingerprint,
  verificationWitnessName: 'Bağımsız Denetçi',
  verificationWitnessOrganization: 'Örnek Denetim A.Ş.',
  verificationCheckedAt: '2026-07-30T08:30:00.000Z',
  confirmation: `KÖK GÜVENİNİ DOĞRULA ${fingerprint.slice(0, 16)}`,
  password: 'correct-password'
};
const checks = [];
const check = (label, fn) => { fn(); checks.push(label); };
const fail = (result) => assert.equal(result.ok, false);
const ok = (result) => { assert.equal(result.ok, true); return result.value; };

let before = authCalls;
check('wrong fingerprint rejected', () => fail(register.execute(admin, { ...base, expectedFingerprintSha256: '0'.repeat(64), confirmation: 'KÖK GÜVENİNİ DOĞRULA 0000000000000000' }, 'bad-fingerprint', '2026-07-30T09:00:00.000Z')));
check('wrong fingerprint rejected before auth', () => assert.equal(authCalls, before));
before = authCalls;
check('same evidence channel rejected', () => fail(register.execute(admin, { ...base, keyFingerprintEvidenceReference: base.identityEvidenceReference }, 'same-channel', '2026-07-30T09:00:00.000Z')));
check('same channel rejected before auth', () => assert.equal(authCalls, before));
before = authCalls;
check('stale verification rejected', () => fail(register.execute(admin, { ...base, verificationCheckedAt: '2026-06-01T09:00:00.000Z' }, 'stale', '2026-07-30T09:00:00.000Z')));
check('stale verification rejected before auth', () => assert.equal(authCalls, before));
before = authCalls;
check('wrong confirmation rejected', () => fail(register.execute(admin, { ...base, confirmation: 'yanlış' }, 'wrong-confirmation', '2026-07-30T09:00:00.000Z')));
check('confirmation rejected before auth', () => assert.equal(authCalls, before));

const result = ok(register.execute(admin, base, 'issuer-root', '2026-07-30T09:00:00.000Z'));
check('root key registered', () => assert.equal(result.id, 'issuer-root'));
check('verification method is dual evidence', () => assert.equal(result.verificationMethod, 'out_of_band_dual_evidence'));
check('legal entity retained', () => assert.equal(result.legalEntityName, base.legalEntityName));
check('identity evidence retained', () => assert.equal(result.identityEvidenceReference, base.identityEvidenceReference));
check('fingerprint evidence retained', () => assert.equal(result.keyFingerprintEvidenceReference, base.keyFingerprintEvidenceReference));
check('witness retained', () => assert.equal(result.verificationWitnessName, base.verificationWitnessName));
check('verification timestamp normalized', () => assert.equal(result.verificationCheckedAt, base.verificationCheckedAt));
check('verification receipt hash is SHA-256', () => assert.match(result.verificationReceiptSha256, /^[a-f0-9]{64}$/));
const canonical = useCases.canonicalExternalBackupEvidenceRootTrustVerification({ schemaVersion: 1, type: 'external-backup-evidence-root-trust-verification', issuerLabel: base.label, legalEntityName: base.legalEntityName, fingerprintSha256: fingerprint, identityEvidenceReference: base.identityEvidenceReference, keyFingerprintEvidenceReference: base.keyFingerprintEvidenceReference, witnessName: base.verificationWitnessName, witnessOrganization: base.verificationWitnessOrganization, checkedAt: base.verificationCheckedAt, statement: 'out-of-band-dual-evidence-verified' });
check('verification receipt hash deterministic', () => assert.equal(result.verificationReceiptSha256, crypto.sha256Utf8(canonical)));
check('duplicate fingerprint rejected', () => fail(register.execute(admin, { ...base, label: 'Sağlayıcı Tekrarı' }, 'duplicate', '2026-07-30T09:05:00.000Z')));

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  featureBuild: 182,
  stage: 'Bronze RC2 Active Development',
  status: 'PASS',
  checks: checks.length,
  checkLabels: checks,
  limitations: ['Real provider identity documents and human witness procedures are not independently audited. Runtime exercises the application use case and real Node Ed25519 fingerprinting without network access.'],
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await rm(tmp, { recursive: true, force: true });
console.log(`Build 182 root trust verification runtime: PASS (${checks.length}/${checks.length})`);
