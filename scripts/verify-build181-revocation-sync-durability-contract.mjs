import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const out = process.argv[2] ?? 'artifacts/validation/build181-revocation-sync-durability-contract.json';
const paths = {
  service: 'apps/desktop/src/main/secure-revocation-sync-service.ts',
  state: 'apps/desktop/src/main/secure-revocation-sync-state.ts',
  main: 'apps/desktop/src/main/main.ts',
  renderer: 'apps/desktop/src/renderer/App.tsx',
  domain: 'packages/domain/src/app-data.ts',
  preflight: 'config/source-preflight-checks.json',
  package: 'package.json',
  decision: 'docs/10_MASTER_DECISION_REGISTER.md',
  authority: 'docs/11_DOCUMENT_AUTHORITY_MATRIX.md',
  security: 'docs/14_SECURITY_PRIVACY_BACKUP_STANDARD.md',
  governance: 'docs/15_RELEASE_VALIDATION_GOVERNANCE.md',
  adr: 'docs/adr/ADR-054-protected-periodic-revocation-sync-state.md'
};
const files = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const activePackageVersion = JSON.parse(files.package).version;
const activeBuild = Number.parseInt(activePackageVersion.split('-').at(-1) ?? '', 10);
const checks = [];
const check = (name, condition) => checks.push({ name, status: condition ? 'PASS' : 'FAIL' });
const has = (key, text) => files[key].includes(text);

check('protected state store exists', has('state', 'export class ProtectedRevocationSyncStateStore'));
check('state uses operating-system protector', has('state', 'DeviceSecretProtector') && has('state', 'protectedPayload'));
check('state writes atomically', has('state', "openSync(temporaryPath, 'wx', 0o600)") && has('state', 'renameSync(temporaryPath, path)'));
check('state verifies plaintext hash after unprotect', has('state', 'PAYLOAD_HASH_MISMATCH') && has('state', 'protector.unprotect'));
check('state quarantines corrupt files', has('state', '.corrupt.json') && has('state', '#quarantine'));
check('state bounds file and endpoint counts', has('state', 'maximumEndpoints') && has('state', 'maximumFileBytes'));
check('service restores protected state', has('service', "restore.status === 'RESTORED'") && has('service', 'revocation.sync_state_restored'));
check('service persists staged pending list', has('service', 'state.pending = { fetched, endpointFingerprint') && has('service', 'this.#persist()'));
check('service invalidates changed endpoint profile', has('service', 'endpoint-profile-fingerprint-changed'));
check('service supports injectable offline test adapter', has('service', 'fetchList?') && has('service', 'this.deps.fetchList ?? fetchExternalBackupEvidenceRevocationList'));
check('service classifies missing fresh expiring and expired lists', has('service', "'expiring_soon'") && has('service', 'EXPIRING_SOON_MS'));
check('freshness warnings are deduplicated and persisted', has('service', 'lastFreshnessNoticeKey') && has('service', 'noticeKey'));
check('expired list notification is critical', has('service', "freshness === 'expired' ? 'critical'"));
check('domain exposes freshness and persistence status', has('domain', 'RevocationSyncListFreshness') && has('domain', 'RevocationSyncPersistenceStatus'));
check('main wires protected store', has('main', 'ProtectedRevocationSyncStateStore') && has('main', 'persistence:protectedRevocationSyncStateStore'));
check('background scheduler runs periodic sync', has('main', 'revocationSync().runDue()'));
check('renderer loads sync states', has('renderer', 'listRevocationSyncStates') && has('renderer', 'setRevocationSyncStates'));
check('renderer exposes source freshness', has('renderer', 'Güven durumu:') && has('renderer', '24 saat içinde sona erecek'));
check('renderer exposes protected pending restart behavior', has('renderer', 'yeniden başlatmada korumalı olarak saklanır'));
check('preflight includes three Build 181 checks', ['contract', 'runtime', 'syntax'].every(kind => files.preflight.includes(`build181-revocation-sync-durability-${kind}`)));
check('preflight writes active-build integrity evidence', Number.isInteger(activeBuild) && has('preflight', `artifacts/validation/build${activeBuild}-source-integrity-preflight.json`));
check('preflight writes active-build archive reproducibility evidence', Number.isInteger(activeBuild) && has('preflight', `artifacts/validation/build${activeBuild}-source-archive-reproducibility.json`));
check('package version preserves Build 181 or later continuity', Number.isInteger(activeBuild) && activeBuild >= 181);
check('master decision records DEC-071', has('decision', 'DEC-071'));
check('authority matrix records ADR-054', has('authority', 'ADR-054'));
check('security standard records protected state', has('security', 'işletim sistemi korumalı') && has('security', 'iptal listesi'));
check('governance keeps feature in Bronze', has('governance', 'Build 181') && has('governance', 'Bronze'));
check('ADR documents persistence and expiry warning', has('adr', 'kalıcı') && has('adr', '24 saat'));
check('strict lifecycle policy remains authoritative', ['decision', 'authority', 'security', 'governance', 'adr'].every(key => has(key, 'PPT-LIFECYCLE-STRICT-V1')));

const failures = checks.filter(item => item.status === 'FAIL');
const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', build: activeBuild, baselineBuild: 181, stage: 'Bronze RC2 Active Development', status: failures.length ? 'FAIL' : 'PASS', checks: checks.length, passed: checks.length - failures.length, failures, scenarios: checks, generatedAt: new Date().toISOString() };
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) { console.error(JSON.stringify(report, null, 2)); process.exit(1); }
console.log(`Build 181 revocation sync durability contract: PASS (${checks.length}/${checks.length})`);
