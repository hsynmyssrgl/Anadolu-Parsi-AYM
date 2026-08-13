import { mkdir, readFile, writeFile } from 'node:fs/promises';

const readText = (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const chainComplete = (item) => item?.status === 'COMPLETE'
  && Object.keys(item.chain ?? {}).length === 13
  && Object.values(item.chain).every((value) => value === true);
const ids = Object.freeze(['B5-06', 'EXT-039']);
const evidence = Object.freeze([
  'artifacts/validation/33-K-privacy-consent-lost-device-control-boundary.json',
  'artifacts/validation/33-K-privacy-consent-lost-device-control-contract.json',
  'artifacts/validation/33-K-privacy-consent-lost-device-control-runtime.json'
]);

const [registry, additional, ledger, scope, inventory, boundary, decision, threatModel,
  audit, master, rootPackage, application, adapter, main, renderer] = await Promise.all([
  readJson('config/accepted-scope-registry.json'),
  readJson('config/additional-family-capabilities.json'),
  readJson('config/user-decision-ledger.json'),
  readJson('config/33-k-privacy-consent-lost-device-control-scope.json'),
  readJson('config/33-k-privacy-consent-lost-device-control-inventory.json'),
  readJson(evidence[0]),
  readText('docs/decisions/DEC-222-privacy-consent-lost-device-control-center.md'),
  readText('docs/security/THREAT_MODEL_33_K_PRIVACY_CONSENT_LOST_DEVICE_CONTROL.md'),
  readText('docs/audit/33-K_PRIVACY_CONSENT_LOST_DEVICE_CONTROL_UST_KAPANIS.md'),
  readText('docs/10_MASTER_DECISION_REGISTER.md'),
  readJson('package.json'),
  readText('packages/application/src/privacy-control-use-cases.ts'),
  readText('apps/desktop/src/main/privacy-control-application-adapter.ts'),
  readText('apps/desktop/src/main/main.ts'),
  readText('apps/desktop/src/renderer/App.tsx')
]);

const checks = [];
const failures = [];
const check = (name, condition) => {
  const passed = Boolean(condition);
  checks.push({ name, passed });
  if (!passed) failures.push(name);
};
const requirements = ids.map((id) => registry.requirements?.find((item) => item.id === id));
const ext039 = additional.requirements?.find((item) => item.id === 'EXT-039');

check('both requirements are complete with exact 13-link chains', requirements.every(chainComplete));
check('both requirements bind the exact 33-K evidence triplet', requirements.every((item) =>
  evidence.every((path) => item?.evidence?.includes(path))));
check('additional capability EXT-039 is complete', ext039?.status === 'COMPLETE');
check('DEC-222 is active and decision cardinality is exact', ledger.decisionCount === ledger.decisions?.length
  && ledger.decisions?.some((item) => item.id === 'DEC-222' && item.status === 'ACTIVE'
    && item.requirements?.join(',') === ids.join(',')));
check('scope and inventory are complete and bind no new migration or network channel',
  scope.status === 'COMPLETE' && scope.validation?.status === 'PASS'
  && scope.requirements?.join(',') === ids.join(',') && scope.reuse?.latestDatabaseMigration === 88
  && scope.reuse?.newMigrationRequired === false && inventory.status === 'COMPLETE'
  && inventory.latestDatabaseMigration === 88 && inventory.networkChannels?.length === 0
  && inventory.openBlockers?.length === 0);
check('boundary is exact green with current platform ratchets', boundary.status === 'PASS'
  && boundary.checksFailed === 0 && boundary.ppk021ExactAllowlistEntries === 557
  && boundary.ppk021UseCaseCompositionSurfaces === 284
  && boundary.ppk022CapabilitySurfaces === 246 && boundary.networkChannels === 0);
check('central PEP and one UoW own all authority changes', includesAll(adapter, [
  'CentralAuthorizationService', 'transactionExecutor.execute', 'advanceSecurityEpoch',
  'revokeAllTrustedDevices', 'revokeOfflineLease', 'upsertConsent', 'appendAudit'
]) && !adapter.includes("actor.role === 'family_admin'"));
check('application binds session epoch strong auth lease integrity and commit-success logout', includesAll(application, [
  'requireSession', 'securityEpoch !== authenticated.value.securityEpoch', 'strongAuthentication.verify',
  'revokeOfflineCapabilityLease', 'if (closed.ok) this.session.clear()'
]));
check('desktop success path seals all local authority holders', includesAll(main, [
  "offlineSensitiveCache.lock('REVOKED')", 'financeImportFileSessions.clear()',
  'emergencyCardExportReauthenticationGuard.clearAll()', 'sealUserDataSession()'
]));
check('decision threat model audit and UI state the truthful local-only boundary',
  [decision, threatModel, audit].every((source) => includesAll(source, [
    'DEC-222', 'B5-06', 'EXT-039', 'CentralAuthorizationService'
  ])) && includesAll(`${decision}\n${threatModel}\n${audit}\n${renderer}`, [
    'uzaktan silme', 'MDM', 'networkDelivery=not_performed'
  ]));
check('no remote privacy-control action or network channel exists',
  !/privacyControl:(?:wipe|mdm|deliver|send|upload)/iu.test(main)
  && scope.truth?.remoteWipePerformed === false && scope.truth?.mdmOperationPerformed === false
  && scope.truth?.networkDelivery === 'not_performed');
check('root lifecycle exposes boundary targeted contract and runtime commands',
  ['pretypecheck', 'prebuild'].every((name) => rootPackage.scripts?.[name]?.includes('verify-privacy-consent-lost-device-control-boundary.mjs'))
  && ['verify:b5-privacy-control:boundary', 'verify:b5-privacy-control:targeted',
    'verify:b5-privacy-control:contract', 'verify:b5-privacy-control:runtime']
    .every((name) => typeof rootPackage.scripts?.[name] === 'string'));
check('master register binds the active DEC-222 summary', includesAll(master, [
  '## DEC-222', 'B5-06', 'EXT-039', 'DEC-222-privacy-consent-lost-device-control-center.md'
]));

const report = Object.freeze({
  schemaVersion: 1,
  step: '33-K',
  requirements: ids,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: checks.filter((item) => item.passed).length,
  checksFailed: failures.length,
  checks: Object.freeze(checks),
  failures: Object.freeze(failures),
  latestDatabaseMigration: 88,
  ppk021ExactAllowlistEntries: boundary.ppk021ExactAllowlistEntries,
  ppk021UseCaseCompositionSurfaces: boundary.ppk021UseCaseCompositionSurfaces,
  ppk022CapabilitySurfaces: boundary.ppk022CapabilitySurfaces,
  networkChannels: 0,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile(evidence[1], `${JSON.stringify(report, null, 2)}\n`);
console.log(`Privacy consent lost-device control contract: ${report.status} (${report.checksPassed}/${checks.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
