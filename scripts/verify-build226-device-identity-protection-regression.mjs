import { mkdir, readFile, writeFile } from 'node:fs/promises';

const [identitySource, runtimeReport] = await Promise.all([
  readFile('apps/desktop/src/main/device-identity.ts', 'utf8'),
  readFile('artifacts/validation/build226-fresh-profile-startup-runtime.json', 'utf8').then(JSON.parse)
]);
const results = [];
const check = (id, condition, details = undefined) => results.push({
  id,
  status: condition ? 'PASS' : 'FAIL',
  ...(details === undefined ? {} : { details })
});
const runtimePassed = (id) => runtimeReport.results?.some((item) => item.id === id && item.status === 'PASS');

check('protected-envelope-schema-v2', identitySource.includes('readonly schemaVersion: 2;'));
check('private-key-never-written-in-protected-identity', identitySource.includes("identity: Omit<DeviceIdentityMaterial, 'privateKeyPem'>") && identitySource.includes('privateKeyCiphertextBase64: protector.protect(identity.privateKeyPem)'));
check('provider-id-validated', identitySource.includes('protector.protectionId !== expectedProtectionId'));
check('required-protection-fails-closed', identitySource.includes('this.secretProtector?.required') && (identitySource.match(/this\.secretProtector\?\.required/gu)?.length ?? 0) >= 2);
check('identity-keypair-validated', identitySource.includes('verifyDeviceProof(identity.publicKeyPem, createDeviceProof(identity, challenge))'));
check('fresh-profile-production-identity-pass', runtimePassed('first-launch-protected-device-identity-created'));
check('corrupt-identity-rejected', runtimePassed('corrupt-device-identity-fails-closed'));
check('wrong-provider-rejected', runtimePassed('wrong-device-protection-provider-fails-closed'));
check('undecryptable-ciphertext-rejected', runtimePassed('undecipherable-device-ciphertext-fails-closed'));
check('unavailable-protection-rejected', runtimePassed('unavailable-os-protection-fails-closed'));

const failures = results.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1,
  build: 226,
  applicationVersion: '02.08.2026.226',
  scope: 'OS-protected device identity behavior regression',
  status: failures.length ? 'FAIL' : 'PASS',
  checks: results.length,
  passed: results.length - failures.length,
  failed: failures.length,
  results,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build226-device-identity-protection-regression.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build226 device identity protection regression: ${report.status} (${report.passed}/${report.checks}).`);
if (failures.length) process.exitCode = 1;
