import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import {
  computePlatformPolicyReceiptHash,
  computePlatformPolicyReceiptRecordHash
} from '@ppt/repositories';
import type { ObjectPermissionAction } from '@ppt/domain';
import { FamilyDataStore } from '../src/main/data-store.js';
import { decryptFullBackupPayloadV3 } from '../src/main/backup-container-v3.js';
import type { DeviceSecretProtector } from '../src/main/device-secret-protector.js';

const temporaryDirectories: string[] = [];
const openStores = new Set<FamilyDataStore>();
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const BACKUP_PASSWORD = 'GucluYedekParolasi!2026';
const testSecretProtector: DeviceSecretProtector = {
  protectionId: 'test-secret-protector-v1',
  required: false,
  isAvailable: () => true,
  protect: (secret) => Buffer.from(`test:${secret}`, 'utf8').toString('base64'),
  unprotect: (protectedBase64) => {
    const value = Buffer.from(protectedBase64, 'base64').toString('utf8');
    if (!value.startsWith('test:')) throw new Error('Test koruma zarfı geçersiz.');
    return value.slice(5);
  }
};

const ARCHIVE_POLICY_TEST_VERSION = '30-p-vitest-policy-v1';
const archivePolicyTestKernel = new PlatformPolicyKernel({
  policyVersion: ARCHIVE_POLICY_TEST_VERSION,
  signingKey: Buffer.from('30-n-archive-vitest-signing-key-v1', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write', 'finance.read', 'finance.write', 'health.read', 'health.write', 'location.read', 'archive.read', 'archive.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete', 'record']
});

const archivePolicyTestProvider: PlatformPolicyAuthorizationProvider = Object.freeze({
  resolvePolicyPackage: () => archivePolicyTestKernel.policyPackage,
  authorize({ request, nonce }) {
    return Object.freeze({
      effectiveRequest: request,
      authorization: archivePolicyTestKernel.authorizeWithReceipt(request, request.occurredAt, nonce)
    });
  },
  verify({ request, receipt }) {
    return archivePolicyTestKernel.verifyReceiptForRequest(receipt, request);
  }
});

const archivePolicyTestProof = (
  record: PlatformPolicyReceiptRecord
): PlatformPolicyJournalProjectionProof => Object.freeze({
  schemaVersion: 1,
  receiptHash: computePlatformPolicyReceiptHash(record.receipt),
  recordHash: computePlatformPolicyReceiptRecordHash(record),
  receiptNonce: record.receipt.nonce,
  entrySequence: 1,
  entryHash: 'd'.repeat(64),
  headSequence: 1,
  headHash: 'd'.repeat(64),
  journalSizeBytes: 512,
  issuedAt: record.recordedAt,
  proofMac: 'e'.repeat(64)
});

const archivePolicyTestOptions = {
  archivePolicyAuthorizationProvider: archivePolicyTestProvider,
  archivePolicyReceiptSink: {
    append: () => undefined,
    ensure: archivePolicyTestProof,
    verifyProjectionProof: () => true
  },
  archivePolicyVersion: ARCHIVE_POLICY_TEST_VERSION,
  archiveClusterFence: () => ({ writable: true, epoch: 30 })
} as const;

const decodeBase32 = (value: string): Buffer => {
  let bits = '';
  for (const char of value) bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
};

const makeTotp = (secret: string): string => {
  const counter = Math.floor(Date.now() / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary = ((digest[offset]! & 0x7f) << 24) | ((digest[offset + 1]! & 0xff) << 16) | ((digest[offset + 2]! & 0xff) << 8) | (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
};

const makeStore = () => {
  const directory = mkdtempSync(join(tmpdir(), 'panthera-family-'));
  temporaryDirectories.push(directory);
  return { directory, store: trackStore(new FamilyDataStore({ databasePath: join(directory, 'family.db'), backupSecretProtector: testSecretProtector, backupPasswordPath: join(directory, 'managed-backup-password.json'), ...archivePolicyTestOptions })) };
};

const trackStore = (store: FamilyDataStore): FamilyDataStore => {
  openStores.add(store);
  return store;
};

const authenticate = async (store: FamilyDataStore): Promise<void> => {
  const state = store.getAuthState();
  if (!state.initialized) {
    store.setupAdmin({ familyName: 'Test Ailesi', displayName: 'Test Yöneticisi', email: 'test@example.com', password: 'GucluTestParolasi123!' });
    const syntheticMembers = [
      { displayName: 'Test Kişisi 2', birthDate: '1982-09-05', relationshipType: 'Eş', generation: 1, branch: 'Ana Dal' },
      { displayName: 'Test Kişisi 3', birthDate: '2012-06-11', relationshipType: 'Çocuk', generation: 2, branch: 'Ana Dal' },
      { displayName: 'Test Kişisi 4', birthDate: '1960-04-21', relationshipType: 'Ebeveyn', generation: 3, branch: 'Büyükler' },
      { displayName: 'Test Kişisi 5', birthDate: '1938-02-14', relationshipType: 'Büyük ebeveyn', generation: 4, branch: 'Büyükler' },
      { displayName: 'Test Kişisi 6', birthDate: '1990-12-03', relationshipType: 'Kuzen', generation: 2, branch: 'Yan Dal' }
    ];
    for (const member of syntheticMembers) store.createMember(member);
    const participantPersonIds = (await store.getSnapshot()).people.map((person) => person.id);
    for (const [index, title] of ['Mezuniyet', 'Doğum günü', 'Aile buluşması', 'Yeni ev'].entries()) {
      await store.createEvent({ title, startAt: `2026-0${index + 6}-15T12:00:00.000Z`, visibility: 'family', participantPersonIds, aiProcessingAllowed: false });
    }
  }
  else if (!state.authenticated) store.login({ email: 'test@example.com', password: 'GucluTestParolasi123!' });
};

const getAuthenticatedPerson = async (store: FamilyDataStore) => {
  const account = store.listAccounts().find((item) => item.email === 'test@example.com');
  const person = (await store.getSnapshot()).people.find((item) => item.id === account?.personId);
  if (!person) throw new Error('Authenticated test account is not linked to a person.');
  return person;
};

afterEach(() => {
  for (const store of openStores) {
    try { store.close(); } catch { /* best-effort cleanup for a store already closed by the test */ }
  }
  openStores.clear();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('FamilyDataStore', () => {
  it('boş kurulumda e-posta istemeden yalnız yerel aile ve yönetici profilini oluşturur', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'panthera-family-local-profile-'));
    temporaryDirectories.push(directory);
    const store = trackStore(new FamilyDataStore({ databasePath: join(directory, 'family.db'), seed: false, ...archivePolicyTestOptions }));
    const initial = store.getAuthState();
    expect(initial.initialized).toBe(false);
    expect(initial.authenticated).toBe(false);
    expect(initial.profiles).toEqual([]);

    const setup = store.setupAdmin({
      familyName: 'Yılmaz Ailesi',
      displayName: 'Ayşe Yılmaz',
      password: 'GucluYerelParola!2026'
    });
    expect(setup.authenticated).toBe(true);
    expect(setup.displayName).toBe('Ayşe Yılmaz');
    expect(setup.trustedDevice).toBe(true);
    expect(setup.currentDeviceId).toBeTruthy();

    const snapshot = await store.getSnapshot();
    expect(snapshot.family.name).toBe('Yılmaz Ailesi');
    expect(snapshot.people.map((person) => person.displayName)).toEqual(['Ayşe Yılmaz']);
    expect(snapshot.events).toEqual([]);
    expect(snapshot.locations).toEqual([]);
    expect(snapshot.relations).toEqual([]);

    const signedOut = store.logout();
    expect(signedOut.profiles).toHaveLength(1);
    expect(signedOut.profiles?.[0]?.displayName).toBe('Ayşe Yılmaz');
    const localIdentity = new DatabaseSync(join(directory, 'family.db'), { readOnly: true });
    try {
      expect(String(localIdentity.prepare('SELECT email FROM accounts').get()?.email)).toMatch(/@local\.pardus$/u);
      const initialMembership = localIdentity.prepare(`
        SELECT account.person_id,person.family_id,family.name
        FROM accounts AS account
        INNER JOIN people AS person ON person.id=account.person_id
        INNER JOIN families AS family ON family.id=person.family_id
      `).get();
      expect(String(initialMembership?.person_id)).toBe(`person-${signedOut.profiles![0]!.id}`);
      expect(String(initialMembership?.family_id)).toBe('family-main');
      expect(String(initialMembership?.name)).toBe('Yılmaz Ailesi');
      const trustedDevice = localIdentity.prepare(`
        SELECT account_id,device_id,fingerprint,public_key_pem,security_epoch,revoked_at
        FROM trusted_devices
      `).get();
      expect(String(trustedDevice?.account_id)).toBe(signedOut.profiles![0]!.id);
      expect(String(trustedDevice?.device_id)).toBe(setup.currentDeviceId);
      expect(String(trustedDevice?.fingerprint)).toMatch(/^[a-f0-9]{64}$/u);
      expect(String(trustedDevice?.public_key_pem)).toContain('BEGIN PUBLIC KEY');
      expect(Number(trustedDevice?.security_epoch)).toBe(0);
      expect(trustedDevice?.revoked_at).toBeNull();

      const permissions = localIdentity.prepare(`
        SELECT subject_account_id,resource_type,resource_id,actions,effect,purpose,ends_at
        FROM object_permissions ORDER BY resource_type
      `).all();
      expect(permissions).toHaveLength(3);
      expect(permissions.map((permission) => String(permission.resource_type))).toEqual([
        'archive_category',
        'archive_item',
        'archive_retention_policy'
      ]);
      for (const permission of permissions) {
        expect(String(permission.subject_account_id)).toBe(signedOut.profiles![0]!.id);
        expect(String(permission.resource_id)).toBe('*');
        expect(String(permission.effect)).toBe('allow');
        expect(String(permission.purpose)).toBe('archive');
        expect(permission.ends_at).toBeNull();
        expect(JSON.parse(String(permission.actions))).toEqual([
          'read',
          'create',
          'update',
          'delete',
          'record'
        ]);
      }
      expect(Number(localIdentity.prepare(`
        SELECT COUNT(*) AS count FROM audit_log
        WHERE action='device.initially_trusted'
      `).get()?.count)).toBe(1);
      expect(Number(localIdentity.prepare(`
        SELECT COUNT(*) AS count FROM audit_log
        WHERE action='object_permission.initial_archive_grant_created'
      `).get()?.count)).toBe(3);
      expect(Number(localIdentity.prepare(`
        SELECT COUNT(*) AS count FROM audit_log
        WHERE action IN ('database.seeded','account.created','account.initial_family_membership_created')
      `).get()?.count)).toBe(3);
    } finally {
      localIdentity.close();
    }

    expect(() => store.setupAdmin({
      familyName: 'İkinci Aile',
      displayName: 'İkinci Yönetici',
      password: 'BaskaGucluParola!2026'
    })).toThrow(/zaten/u);
    const afterRejectedSetup = new DatabaseSync(join(directory, 'family.db'), { readOnly: true });
    try {
      expect(Number(afterRejectedSetup.prepare('SELECT COUNT(*) AS count FROM accounts').get()?.count)).toBe(1);
      expect(Number(afterRejectedSetup.prepare('SELECT COUNT(*) AS count FROM families').get()?.count)).toBe(1);
      expect(Number(afterRejectedSetup.prepare('SELECT COUNT(*) AS count FROM people').get()?.count)).toBe(1);
      expect(Number(afterRejectedSetup.prepare('SELECT COUNT(*) AS count FROM trusted_devices').get()?.count)).toBe(1);
      expect(Number(afterRejectedSetup.prepare('SELECT COUNT(*) AS count FROM object_permissions').get()?.count)).toBe(3);
      expect(Number(afterRejectedSetup.prepare(`
        SELECT COUNT(*) AS count FROM audit_log
        WHERE action IN (
          'database.seeded','account.created','account.initial_family_membership_created',
          'device.initially_trusted','object_permission.initial_archive_grant_created'
        )
      `).get()?.count)).toBe(7);
    } finally {
      afterRejectedSetup.close();
    }

    expect(store.login({
      accountId: signedOut.profiles![0]!.id,
      password: 'GucluYerelParola!2026'
    }).authenticated).toBe(true);
    store.close();

    const reopened = trackStore(new FamilyDataStore({ databasePath: join(directory, 'family.db'), seed: false }));
    const reopenedState = reopened.getAuthState();
    expect(reopenedState.currentDeviceId).toBe(setup.currentDeviceId);
    const reopenedLogin = reopened.login({
      accountId: signedOut.profiles![0]!.id,
      password: 'GucluYerelParola!2026'
    });
    expect(reopenedLogin.authenticated).toBe(true);
    expect(reopenedLogin.trustedDevice).toBe(true);
    reopened.close();
  });

  it('ilk yönetici kurulumunun her kalıcı aşamasındaki hata tüm başlangıç verisini ve oturumu geri alır', () => {
    const failureStages = [
      { id: 'family-row', sql: `BEFORE INSERT ON families` },
      { id: 'person-row', sql: `BEFORE INSERT ON people` },
      { id: 'family-audit', sql: `BEFORE INSERT ON audit_log WHEN NEW.action='database.seeded'` },
      { id: 'account-row', sql: `BEFORE INSERT ON accounts` },
      { id: 'account-audit', sql: `BEFORE INSERT ON audit_log WHEN NEW.action='account.created'` },
      { id: 'membership-link', sql: `BEFORE UPDATE OF person_id ON accounts WHEN NEW.person_id IS NOT NULL` },
      { id: 'membership-audit', sql: `BEFORE INSERT ON audit_log WHEN NEW.action='account.initial_family_membership_created'` },
      { id: 'trusted-device-row', sql: `BEFORE INSERT ON trusted_devices` },
      { id: 'trusted-device-audit', sql: `BEFORE INSERT ON audit_log WHEN NEW.action='device.initially_trusted'` },
      { id: 'archive-item-grant', sql: `BEFORE INSERT ON object_permissions WHEN NEW.resource_type='archive_item'` },
      { id: 'archive-retention-grant', sql: `BEFORE INSERT ON object_permissions WHEN NEW.resource_type='archive_retention_policy'` },
      { id: 'archive-category-grant', sql: `BEFORE INSERT ON object_permissions WHEN NEW.resource_type='archive_category'` },
      { id: 'archive-grant-audit', sql: `BEFORE INSERT ON audit_log WHEN NEW.action='object_permission.initial_archive_grant_created'` }
    ] as const;

    for (const stage of failureStages) {
      const directory = mkdtempSync(join(tmpdir(), `panthera-setup-rollback-${stage.id}-`));
      temporaryDirectories.push(directory);
      const databasePath = join(directory, 'family.db');
      const store = trackStore(new FamilyDataStore({ databasePath, seed: false }));
      const injector = new DatabaseSync(databasePath);
      injector.exec(`
        CREATE TRIGGER setup_admin_injected_failure
        ${stage.sql}
        BEGIN SELECT RAISE(ABORT,'INJECTED-SETUP-FAILURE-${stage.id}'); END;
      `);
      injector.close();

      expect(() => store.setupAdmin({
        familyName: 'Geri Alma Ailesi',
        displayName: 'Geri Alma Yöneticisi',
        password: 'GeriAlmaGucluParola!2026'
      }), stage.id).toThrow();
      expect(store.getAuthState(), stage.id).toMatchObject({
        initialized: false,
        authenticated: false,
        profiles: []
      });

      const rollbackProbe = new DatabaseSync(databasePath);
      const rolledBack = rollbackProbe.prepare(`
        SELECT
          (SELECT COUNT(*) FROM families) AS families,
          (SELECT COUNT(*) FROM people) AS people,
          (SELECT COUNT(*) FROM accounts) AS accounts,
          (SELECT COUNT(*) FROM trusted_devices) AS trusted_devices,
          (SELECT COUNT(*) FROM object_permissions) AS object_permissions,
          (SELECT COUNT(*) FROM audit_log WHERE action IN (
            'database.seeded','account.created','account.initial_family_membership_created',
            'device.initially_trusted','object_permission.initial_archive_grant_created'
          )) AS setup_audits
      `).get();
      expect(rolledBack, stage.id).toMatchObject({
        families: 0,
        people: 0,
        accounts: 0,
        trusted_devices: 0,
        object_permissions: 0,
        setup_audits: 0
      });
      rollbackProbe.exec('DROP TRIGGER setup_admin_injected_failure');
      rollbackProbe.close();

      const recovered = store.setupAdmin({
        familyName: 'Kurtarılan Aile',
        displayName: 'Kurtarılan Yönetici',
        password: 'KurtarmaGucluParola!2026'
      });
      expect(recovered.authenticated, stage.id).toBe(true);
      expect(recovered.trustedDevice, stage.id).toBe(true);
      store.close();

      const recoveryProbe = new DatabaseSync(databasePath, { readOnly: true });
      const committed = recoveryProbe.prepare(`
        SELECT
          (SELECT COUNT(*) FROM families) AS families,
          (SELECT COUNT(*) FROM people) AS people,
          (SELECT COUNT(*) FROM accounts WHERE person_id IS NOT NULL) AS linked_accounts,
          (SELECT COUNT(*) FROM trusted_devices WHERE revoked_at IS NULL) AS trusted_devices,
          (SELECT COUNT(*) FROM object_permissions WHERE effect='allow' AND purpose='archive') AS archive_permissions,
          (SELECT COUNT(*) FROM audit_log WHERE action IN (
            'database.seeded','account.created','account.initial_family_membership_created',
            'device.initially_trusted','object_permission.initial_archive_grant_created'
          )) AS setup_audits
      `).get();
      expect(committed, stage.id).toMatchObject({
        families: 1,
        people: 1,
        linked_accounts: 1,
        trusted_devices: 1,
        archive_permissions: 3,
        setup_audits: 7
      });
      recoveryProbe.close();
    }
  }, 120_000);

  it('taze kurulum arşiv yetkisini üretim PEP zincirinde kullanır ve açık izin yoksa rolü bypass etmez', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'panthera-family-fresh-archive-authority-'));
    temporaryDirectories.push(directory);
    const policyVersion = '30-o-fresh-setup-policy-v1';
    const kernel = new PlatformPolicyKernel({
      policyVersion,
      signingKey: Buffer.from('30-o-fresh-setup-policy-signing-key-v1', 'utf8'),
      applicationCapabilities: { 'windows-desktop': ['archive.read', 'archive.write'] },
      consentRequiredCapabilities: [],
      onlineOnlyCapabilities: [],
      writeActions: ['create', 'update', 'delete', 'record']
    });
    const provider: PlatformPolicyAuthorizationProvider = Object.freeze({
      resolvePolicyPackage: () => kernel.policyPackage,
      authorize({ request, nonce }) {
        return Object.freeze({
          effectiveRequest: request,
          authorization: kernel.authorizeWithReceipt(request, request.occurredAt, nonce)
        });
      },
      verify({ request, receipt }) {
        return kernel.verifyReceiptForRequest(receipt, request);
      }
    });
    const receipts: PlatformPolicyReceiptRecord[] = [];
    const store = trackStore(new FamilyDataStore({
      databasePath: join(directory, 'family.db'),
      seed: false,
      archivePolicyAuthorizationProvider: provider,
      archivePolicyReceiptSink: {
        append: (record) => { receipts.push(record); },
        ensure: (record) => {
          receipts.push(record);
          return archivePolicyTestProof(record);
        },
        verifyProjectionProof: () => true
      },
      archivePolicyVersion: policyVersion,
      archiveClusterFence: () => ({ writable: true, epoch: 30 })
    }));
    store.setupAdmin({
      familyName: 'Taze Arşiv Ailesi',
      displayName: 'Taze Arşiv Yöneticisi',
      password: 'TazeArsivGucluParola!2026'
    });

    const categories = await store.createArchiveCategory({ name: 'Tapular' });
    expect(categories.some((category) => category.name === 'Tapular')).toBe(true);
    const policies = await store.createArchiveRetentionPolicy({
      name: 'On yıllık saklama',
      retentionDays: 3650,
      secureDestroy: true
    });
    expect(policies.some((policy) => policy.name === 'On yıllık saklama')).toBe(true);
    const sourcePath = join(directory, 'taze-kurulum-belgesi.txt');
    writeFileSync(sourcePath, 'Taze kurulum gerçek arşiv içeriği', 'utf8');
    const archiveItems = await store.importArchiveFile(sourcePath, { title: 'Taze Kurulum Belgesi' });
    expect(archiveItems.some((item) => item.title === 'Taze Kurulum Belgesi')).toBe(true);
    const writeReceipts = receipts.filter((record) => record.capability === 'archive.write');
    const readReceipts = receipts.filter((record) => record.capability === 'archive.read');
    expect(writeReceipts).toHaveLength(3);
    expect(writeReceipts.map((record) => record.resourceType)).toEqual([
      'archive_category',
      'archive_retention_policy',
      'archive_item'
    ]);
    expect(readReceipts).toHaveLength(3);
    expect(readReceipts.every((record) => record.action === 'read')).toBe(true);

    const categoryGrant = store.listPermissions().find((permission) =>
      permission.resourceType === 'archive_category'
      && permission.purpose === 'archive'
      && permission.effect === 'allow'
    );
    expect(categoryGrant).toBeTruthy();
    store.deletePermission(categoryGrant!.id);
    await expect(store.createArchiveCategory({ name: 'İzinsiz kategori' }))
      .rejects.toThrow(/merkezî politika|POLICY/u);
    expect(store.getAuthState().role).toBe('family_admin');
    store.close();
  });

  it('zaman tüneli olayını tüm alanlarıyla günceller, arşivler ve veri kaybetmeden geri alır', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'panthera-family-timeline-lifecycle-'));
    temporaryDirectories.push(directory);
    const store = trackStore(new FamilyDataStore({ databasePath: join(directory, 'family.db'), seed: false, ...archivePolicyTestOptions }));
    store.setupAdmin({ familyName:'Test Ailesi', displayName:'Test Yöneticisi', password:'GucluYerelParola!2026' });
    const personId = (await store.getSnapshot()).people[0]!.id;
    const locationMutation = await store.createLocation({ label:'Aile Evi', address:'Ankara', kind:'residence' });
    const locationId = locationMutation.location!.id;
    const created = await store.createEvent({
      title:'İlk başlık',
      description:'İlk açıklama',
      startAt:'2027-05-10T15:00:00.000Z',
      locationId,
      visibility:'family',
      participantPersonIds:[personId],
      invitationText:'İlk davetiye',
      notes:'İlk not',
      aiProcessingAllowed:false,
      recurrence:'none',
      reminderDays:[7]
    });
    const eventId = created.event!.id;

    const updated = await store.updateFamilyEvent({
      eventId,
      title:'Güncellenen aile buluşması',
      description:'Tüm alanları değişen kayıt',
      startAt:'2027-06-20T18:30:00.000Z',
      locationLabel:'Yeni buluşma alanı',
      visibility:'selected_members',
      participantPersonIds:[personId],
      invitationText:'Yeni davetiye metni',
      notes:'Yeni anı ve plan notları',
      aiProcessingAllowed:true,
      recurrence:'yearly',
      reminderDays:[30,7,1,0]
    });
    const changed = updated.event!;
    expect(changed).toMatchObject({
      title:'Güncellenen aile buluşması',
      description:'Tüm alanları değişen kayıt',
      startAt:'2027-06-20T18:30:00.000Z',
      locationLabel:'Yeni buluşma alanı',
      visibility:'selected_members',
      invitationText:'Yeni davetiye metni',
      notes:'Yeni anı ve plan notları',
      aiProcessingAllowed:true,
      recurrence:'yearly',
      reminderDays:[30,7,1,0]
    });
    expect(changed.locationId).toBeUndefined();
    expect(changed.updatedAt).toBeTruthy();

    const afterArchive = await store.setFamilyEventArchived({ eventId, archived:true });
    expect(afterArchive.operation).toBe('archived');
    expect((await store.getSnapshot()).events.some((event) => event.id === eventId)).toBe(false);
    const archived = await store.listArchivedTimelineEvents();
    expect(archived).toHaveLength(1);
    expect(archived[0]).toMatchObject({ id:eventId, title:'Güncellenen aile buluşması' });
    expect(archived[0]?.archivedAt).toBeTruthy();

    const afterRestore = await store.setFamilyEventArchived({ eventId, archived:false });
    expect(afterRestore.operation).toBe('restored');
    expect((await store.getSnapshot()).events.some((event) => event.id === eventId)).toBe(true);
    expect(await store.listArchivedTimelineEvents()).toEqual([]);
    store.close();
  });

  it('dokunulmamış eski örnek aileyi gerçek hesaba bağlı temiz başlangıca dönüştürür', () => {
    const directory = mkdtempSync(join(tmpdir(), 'panthera-family-legacy-demo-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'family.db');
    const legacy = new DatabaseSync(databasePath);
    legacy.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,name TEXT NOT NULL,checksum TEXT NOT NULL,applied_at TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,application_version TEXT NOT NULL,success INTEGER NOT NULL,
        adopted INTEGER NOT NULL DEFAULT 0
      ) STRICT;`);
    for (const migration of FAMILY_DATABASE_MIGRATIONS.slice(0, 12)) {
      legacy.exec(migration.sql);
      legacy.prepare('INSERT INTO schema_migrations(version,name,checksum,applied_at,duration_ms,application_version,success,adopted) VALUES(?,?,?,?,?,?,1,0)')
        .run(migration.version, migration.name, migration.checksum, '2026-07-25T00:00:00.000Z', 0, '26.07.2026.121');
    }
    legacy.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run('family-main', 'Test Ailesi', '2026-07-25T00:00:00.000Z');
    const legacyPeople = [
      ['person-test-1','Test Kişisi 1'],['person-test-2','Test Kişisi 2'],
      ['person-test-3','Test Kişisi 3'],['person-test-4','Test Kişisi 4'],
      ['person-test-5','Test Kişisi 5'],['person-test-6','Test Kişisi 6']
    ];
    for (const [id,displayName] of legacyPeople) legacy.prepare('INSERT INTO people(id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(id,'family-main',displayName,null,'Örnek',1,'Örnek Dal','active','2026-07-25T00:00:00.000Z');
    const legacyRelations = [
      ['relation-1','person-test-6','person-test-4'],['relation-2','person-test-4','person-test-1'],
      ['relation-3','person-test-5','person-test-1'],['relation-4','person-test-1','person-test-2'],
      ['relation-5','person-test-1','person-test-3'],['relation-6','person-test-2','person-test-3']
    ];
    for (const [id,from,to] of legacyRelations) legacy.prepare('INSERT INTO relations(id,family_id,from_person_id,to_person_id,relation_type) VALUES(?,?,?,?,?)').run(id,'family-main',from,to,'parent');
    legacy.prepare('INSERT INTO locations(id,family_id,label,kind,created_at) VALUES(?,?,?,?,?)').run('location-itu','family-main','İstanbul Teknik Üniversitesi','venue','2026-07-25T00:00:00.000Z');
    legacy.prepare('INSERT INTO locations(id,family_id,label,kind,created_at) VALUES(?,?,?,?,?)').run('location-sakarya','family-main','Sakarya Aile Evi','residence','2026-07-25T00:00:00.000Z');
    for (const id of ['event-graduation','event-birthday','event-family-meeting','event-home']) legacy.prepare("INSERT INTO events(id,family_id,kind,title,start_at,visibility,participant_person_ids,attachment_count,ai_processing_allowed,recurrence,reminder_days,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(id,'family-main','important_day',id,'2026-07-25T00:00:00.000Z','family','[]',0,0,'none','[]','2026-07-25T00:00:00.000Z');
    legacy.prepare('INSERT INTO accounts(id,display_name,email,password_record,created_at,role,status,starts_at) VALUES(?,?,?,?,?,?,?,?)')
      .run('real-account','Gerçek Kullanıcı','real@local.pardus','legacy-record','2026-07-25T00:00:00.000Z','family_admin','active','2026-07-25T00:00:00.000Z');
    legacy.close();

    const migrated = trackStore(new FamilyDataStore({ databasePath, seed:false, migrationBackupDirectory:join(directory,'migration-backups') }));
    migrated.close();
    const probe = new DatabaseSync(databasePath,{readOnly:true});
    try {
      expect(probe.prepare('SELECT name FROM families WHERE id=?').get('family-main')?.name).toBe('Ailem');
      expect(Number(probe.prepare('SELECT COUNT(*) count FROM people').get()?.count)).toBe(1);
      expect(probe.prepare('SELECT display_name FROM people').get()?.display_name).toBe('Gerçek Kullanıcı');
      expect(Number(probe.prepare('SELECT COUNT(*) count FROM events').get()?.count)).toBe(0);
      expect(Number(probe.prepare('SELECT COUNT(*) count FROM relations').get()?.count)).toBe(0);
      expect(Number(probe.prepare('SELECT COUNT(*) count FROM locations').get()?.count)).toBe(0);
      expect(probe.prepare('SELECT person_id FROM accounts WHERE id=?').get('real-account')?.person_id).toBe('person-real-account');
      expect(Number(probe.prepare('SELECT COUNT(*) count FROM schema_migrations WHERE version=13 AND success=1').get()?.count)).toBe(1);
    } finally {
      probe.close();
    }
  });

  it('sentetik aile verisini oluşturur', async () => {
    const { store } = makeStore();
    await authenticate(store);
    const snapshot = await store.getSnapshot();
    expect(snapshot.family.name).toBe('Test Ailesi');
    expect(snapshot.people.length).toBeGreaterThanOrEqual(6);
    expect(snapshot.events.length).toBeGreaterThanOrEqual(4);
    store.close();
  });

  it('ikinci aile hesabının snapshot, bölüm ve dashboard okumalarına family-main verisi sızdırmaz', async () => {
    const { directory, store } = makeStore();
    await authenticate(store);
    const primarySnapshot = await store.getSnapshot();
    expect(primarySnapshot.family.id).toBe('family-main');
    expect(primarySnapshot.events.length).toBeGreaterThanOrEqual(4);

    const database = new DatabaseSync(join(directory, 'family.db'));
    try {
      database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)')
        .run('family-secondary', 'İkinci Aile', '2026-08-08T04:00:00.000Z');
      database.prepare(`
        INSERT INTO people(
          id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at
        ) VALUES(?,?,?,?,?,?,?,?,?)
      `).run(
        'person-secondary',
        'family-secondary',
        'İkinci Aile Üyesi',
        null,
        'Üye',
        1,
        'İkinci Dal',
        'active',
        '2026-08-08T04:00:00.000Z'
      );
    } finally {
      database.close();
    }

    const invitation = store.createInvitation({
      email: 'secondary-family@example.com',
      role: 'limited_member',
      personId: 'person-secondary'
    });
    store.logout();
    store.acceptInvitation({
      token: invitation.token,
      displayName: 'İkinci Aile Hesabı',
      password: 'IkinciAileGucluParola!2026'
    });
    const secondarySetup = store.beginTwoFactorSetup();
    store.enableTwoFactor({ code: makeTotp(secondarySetup.secret) });
    store.trustCurrentDevice({
      password: 'IkinciAileGucluParola!2026',
      code: secondarySetup.recoveryCodes[0]!,
      displayName: 'İkinci aile kapsam testi cihazı'
    });

    const snapshot = await store.getSnapshot();
    expect(snapshot.family).toEqual({ id: 'family-secondary', name: 'İkinci Aile' });
    expect(snapshot.people.map((person) => person.id)).toEqual(['person-secondary']);
    expect(snapshot.relations).toEqual([]);
    expect(snapshot.locations).toEqual([]);
    expect(snapshot.events).toEqual([]);
    expect(snapshot.notifications).toEqual([]);

    const sections = await store.getSnapshotSections({ sections: ['graph', 'timeline'] });
    expect(sections.family).toEqual({ id: 'family-secondary', name: 'İkinci Aile' });
    expect(sections.people?.map((person) => person.id)).toEqual(['person-secondary']);
    expect(sections.relations).toEqual([]);
    expect(sections.locations).toEqual([]);
    expect(sections.events).toEqual([]);
    expect(sections.notifications).toEqual([]);

    const dashboard = await store.getDashboardOverview();
    expect(dashboard.family).toEqual({ id: 'family-secondary', name: 'İkinci Aile' });
    expect(dashboard.memberCount).toBe(1);
    expect(dashboard.timelineEventCount).toBe(0);
    expect(dashboard.upcomingImportantDayCount).toBe(0);
    expect(dashboard.upcomingImportantDays).toEqual([]);
    expect(dashboard.recentEvents).toEqual([]);
    store.close();
  });

  it('aile üyesi ve önemli gün kaydını kalıcı olarak ekler', async () => {
    const { store } = makeStore();
    await authenticate(store);
    const before = await store.getSnapshot();
    const withMember = store.createMember({ displayName: 'Test Kişisi 7', birthDate: '1990-04-14', relationshipType: 'Kuzen', generation: 4, branch: 'Selin Dalı' });
    expect((await store.getSnapshot()).people).toHaveLength(before.people.length + 1);
    const selin = withMember.person;
    const withEvent = await store.createEvent({ title: 'Yeni Aile Buluşması', startAt: '2026-09-01T15:00:00.000Z', visibility: 'family', participantPersonIds: selin ? [selin.id] : [], locationLabel: 'Bursa', aiProcessingAllowed: true });
    expect(withEvent.event?.title).toBe('Yeni Aile Buluşması');
    store.close();
  });

  it('veritabanı yedeğini dışarı aktarır', async () => {
    const { directory, store } = makeStore();
    await authenticate(store);
    const backupPath = join(directory, 'backup.db');
    store.exportBackup(backupPath);
    expect(existsSync(backupPath)).toBe(true);
    store.close();
  });

  it('beş başarısız girişten sonra hesabı geçici kilitler', () => {
    const { store } = makeStore();
    store.setupAdmin({ displayName: 'Test Yöneticisi', email: 'test@example.com', password: 'GucluTestParolasi123!' });
    store.logout();
    for (let index = 0; index < 5; index += 1) expect(() => store.login({ email: 'test@example.com', password: 'yanlis-parola-123' })).toThrow();
    expect(() => store.login({ email: 'test@example.com', password: 'GucluTestParolasi123!' })).toThrow(/kilitli/);
    store.close();
  });

  it('TOTP iki aşamalı doğrulamayı etkinleştirir ve girişte zorunlu tutar', async () => {
    const { store } = makeStore();
    await authenticate(store);
    const setup = store.beginTwoFactorSetup();
    store.enableTwoFactor({ code: makeTotp(setup.secret) });
    expect(store.getAuthState().twoFactorEnabled).toBe(true);
    expect(store.getAuthState().trustedDevice).toBe(false);
    store.logout();
    expect(() => store.login({ email: 'test@example.com', password: 'GucluTestParolasi123!' })).toThrow(/doğrulama/);
    expect(store.login({ email: 'test@example.com', password: 'GucluTestParolasi123!', secondFactorCode: makeTotp(setup.secret) }).authenticated).toBe(true);
    store.close();
  });

  it('tam yedeği güvenlik kopyası alarak geri yükler ve yeniden giriş ister', async () => {
    const { directory, store } = makeStore();
    await authenticate(store);
    store.createMember({ displayName: 'Yedekteki Kişi', relationshipType: 'Kuzen', generation: 4, branch: 'Test Dalı' });
    const backupPath = join(directory, 'family.pptbackup');
    store.exportFullBackup(backupPath, BACKUP_PASSWORD);
    store.createMember({ displayName: 'Yedek Sonrası Kişi', relationshipType: 'Kuzen', generation: 4, branch: 'Test Dalı' });
    const safetyPath = join(directory, 'safety', 'before-restore.pptbackup');
    store.restoreFullBackup(backupPath, safetyPath, BACKUP_PASSWORD);
    expect(existsSync(safetyPath)).toBe(true);

    const restored = trackStore(new FamilyDataStore({ databasePath: join(directory, 'family.db'), seed: false, ...archivePolicyTestOptions }));
    expect(restored.getAuthState().authenticated).toBe(false);
    restored.login({ email: 'test@example.com', password: 'GucluTestParolasi123!' });
    const names = (await restored.getSnapshotSections({ sections: ['graph'] })).people!
      .map((person) => person.displayName);
    expect(names).toContain('Yedekteki Kişi');
    expect(names).not.toContain('Yedek Sonrası Kişi');
    restored.close();
  });

  it('geri yüklenen veritabanında tüm cihaz güvenlerini iptal eder', async () => {
    const { directory, store } = makeStore();
    await authenticate(store);
    const setup = store.beginTwoFactorSetup();
    const code = makeTotp(setup.secret);
    store.enableTwoFactor({ code });
    store.trustCurrentDevice({ password: 'GucluTestParolasi123!', code, displayName: 'Geri yükleme test cihazı' });
    const backupPath = join(directory, 'trusted-device.pptbackup');
    store.exportFullBackup(backupPath, BACKUP_PASSWORD);
    const safetyPath = join(directory, 'safety', 'trusted-device-before-restore.pptbackup');
    store.restoreFullBackup(backupPath, safetyPath, BACKUP_PASSWORD);

    const probe = new DatabaseSync(join(directory, 'family.db'), { readOnly: true });
    try {
      expect(Number(probe.prepare('SELECT COUNT(*) AS count FROM trusted_devices WHERE revoked_at IS NULL').get()!.count)).toBe(0);
      expect(probe.prepare("SELECT value FROM database_metadata WHERE key='restore_reauthorization_required'").get()!.value).toBe('1');
    } finally {
      probe.close();
    }
    const marker = JSON.parse(readFileSync(join(directory, 'restore-required-login.json'), 'utf8')) as {
      reauthorizationRequired: boolean;
      trustedDevicesRevoked: boolean;
      revokedTrustedDeviceCount: number;
      restoreTransactionId: string;
    };
    expect(marker.reauthorizationRequired).toBe(true);
    expect(marker.trustedDevicesRevoked).toBe(true);
    expect(marker.revokedTrustedDeviceCount).toBe(1);
    expect(marker.restoreTransactionId).toMatch(/^[0-9a-f-]{36}$/u);

    const restored = trackStore(new FamilyDataStore({
      databasePath: join(directory, 'family.db'),
      seed: false,
      backupSecretProtector: testSecretProtector,
      backupPasswordPath: join(directory, 'managed-backup-password.json')
    }));
    expect(() => restored.login({ email: 'test@example.com', password: 'GucluTestParolasi123!' })).toThrow(/doğrulama/);
    expect(restored.login({
      email: 'test@example.com',
      password: 'GucluTestParolasi123!',
      secondFactorCode: makeTotp(setup.secret)
    }).authenticated).toBe(true);
    restored.close();
  });

  it('süreli davetle kullanıcı hesabı oluşturur ve nesne izni tanımlar', async () => {
    const { store } = makeStore();
    await authenticate(store);
    const created = store.createInvitation({ email: 'uye@example.com', role: 'limited_member', startsAt: '2026-07-21T00:00:00.000Z', endsAt: '2027-07-21T00:00:00.000Z' });
    expect(created.token.length).toBeGreaterThan(20);
    expect(store.listInvitations()[0]?.status).toBe('pending');
    store.logout();
    expect(store.acceptInvitation({ token: created.token, displayName: 'Davetli Üye', password: 'DavetliGucluParola123!' }).authenticated).toBe(true);
    store.logout();
    store.login({ email: 'test@example.com', password: 'GucluTestParolasi123!' });
    const account = store.listAccounts().find((item) => item.email === 'uye@example.com');
    expect(account?.role).toBe('limited_member');
    const timelineEventId = (await store.getSnapshot()).events[0]!.id;
    const permissions = store.upsertPermission({ subjectAccountId: account!.id, resourceType: 'timeline_event', resourceId: timelineEventId, actions: ['read', 'record'], effect: 'allow' });
    expect(permissions.some((item) => item.subjectAccountId === account!.id && item.actions.includes('read') && item.actions.includes('record'))).toBe(true);
    expect(() => store.upsertPermission({
      subjectAccountId: account!.id,
      resourceType: 'timeline_event',
      resourceId: timelineEventId,
      actions: ['execute_arbitrary'] as unknown as ObjectPermissionAction[],
      effect: 'allow'
    })).toThrow(/CORE-VALIDATION-001/);
    store.close();
  });

  it('rejects an unknown persisted object-permission action instead of silently filtering it', async () => {
    const { directory, store } = makeStore();
    await authenticate(store);
    const database = new DatabaseSync(join(directory, 'family.db'));
    try {
      const permission = database.prepare('SELECT id FROM object_permissions ORDER BY id LIMIT 1').get();
      expect(permission?.id).toBeTruthy();
      database.prepare('UPDATE object_permissions SET actions=? WHERE id=?').run(
        JSON.stringify(['read', 'execute_arbitrary']),
        permission!.id
      );
    } finally {
      database.close();
    }
    try {
      expect(() => store.listPermissions()).toThrow(/CORE-UNEXPECTED-001/u);
    } finally {
      store.close();
    }
  });


  it('kişisel etkinlikleri nesne düzeyi izne göre filtreler', async () => {
    const { store } = makeStore();
    await authenticate(store);
    const administratorPersonId = store.listAccounts().find((item) => item.email === 'test@example.com')!.personId!;
    const limitedPersonId = (await store.getSnapshot()).people.find((person) => person.id !== administratorPersonId)!.id;
    const personal = await store.createEvent({ title: 'Özel Sağlık Görüşmesi', startAt: '2026-10-01T10:00:00.000Z', visibility: 'personal', participantPersonIds: [], aiProcessingAllowed: false });
    const eventId = personal.event!.id;
    const invite = store.createInvitation({ email: 'sinirli@example.com', role: 'limited_member', personId: limitedPersonId });
    store.logout();
    store.acceptInvitation({ token: invite.token, displayName: 'Sınırlı Üye', password: 'SinirliGucluParola123!' });
    const limitedSetup = store.beginTwoFactorSetup();
    store.enableTwoFactor({ code: makeTotp(limitedSetup.secret) });
    store.trustCurrentDevice({
      password: 'SinirliGucluParola123!',
      code: limitedSetup.recoveryCodes[0]!,
      displayName: 'Zaman tüneli görünürlük test cihazı'
    });
    expect((await store.getSnapshot()).events.some((event) => event.id === eventId)).toBe(false);
    store.logout();
    store.login({ email: 'test@example.com', password: 'GucluTestParolasi123!' });
    const account = store.listAccounts().find((item) => item.email === 'sinirli@example.com')!;
    store.upsertPermission({ subjectAccountId: account.id, resourceType: 'event', resourceId: eventId, actions: ['read'], effect: 'allow', endsAt: '2026-12-31T23:59:59.000Z' });
    store.logout();
    store.login({ email: 'sinirli@example.com', password: 'SinirliGucluParola123!' });
    expect((await store.getSnapshot()).events.some((event) => event.id === eventId)).toBe(true);
    store.close();
  });

  it('sağlık ve finans kayıtlarını sahiplik ve nesne iznine göre filtreler', async () => {
    const { store } = makeStore();
    await authenticate(store);
    const people = (await store.getSnapshot()).people;
    const testPersonOne = await getAuthenticatedPerson(store);
    const testPersonThree = people.find((person) => person.id !== testPersonOne.id)!;
    const finance = await store.createFinanceRecord({ ownerPersonId: testPersonOne.id, title: 'Özel yatırım hesabı', kind: 'asset', amount: 125000, currency: 'TRY', privacy: 'private', occurredAt: '2026-07-21T10:00:00.000Z' });
    const financeId = finance.find((record) => record.title === 'Özel yatırım hesabı')!.id;
    const invitation = store.createInvitation({ email: 'testPersonThree@example.com', role: 'adult_member', personId: testPersonThree.id });
    store.logout();
    store.acceptInvitation({ token: invitation.token, displayName: 'Zeynep', password: 'ZeynepGucluParola123!' });
    const invitedSetup = store.beginTwoFactorSetup();
    store.enableTwoFactor({ code: makeTotp(invitedSetup.secret) });
    store.trustCurrentDevice({
      password: 'ZeynepGucluParola123!',
      code: invitedSetup.recoveryCodes[0]!,
      displayName: 'Finans görünürlük test cihazı'
    });
    await store.createHealthRecord({ ownerPersonId: testPersonThree.id, title: 'Kontrol randevusu', kind: 'appointment', privacy: 'private', occurredAt: '2026-07-22T10:00:00.000Z' });
    expect((await store.listHealthRecords()).some((record) => record.title === 'Kontrol randevusu')).toBe(true);
    expect((await store.listFinanceRecords()).some((record) => record.id === financeId)).toBe(false);
    store.logout();
    store.login({ email: 'test@example.com', password: 'GucluTestParolasi123!' });
    const account = store.listAccounts().find((item) => item.personId === testPersonThree.id)!;
    store.upsertPermission({ subjectAccountId: account.id, resourceType: 'finance_record', resourceId: financeId, actions: ['read'], effect: 'allow' });
    store.logout();
    store.login({ email: 'testPersonThree@example.com', password: 'ZeynepGucluParola123!' });
    expect((await store.listFinanceRecords()).some((record) => record.id === financeId)).toBe(true);
    store.close();
  });

  it('ilaç planı, aile sağlık geçmişi ve günlük finans değerlemesi oluşturur', async () => {
    const { store } = makeStore();
    await authenticate(store);
    const owner = await getAuthenticatedPerson(store);
    const plans = await store.createMedicationPlan({ ownerPersonId: owner.id, name: 'Tansiyon ilacı', dosage: '1 tablet', schedule: 'Her gün 08:00', startsAt: '2026-07-21T08:00:00.000Z', privacy: 'private' });
    expect(plans.some((plan) => plan.name === 'Tansiyon ilacı')).toBe(true);
    const history = await store.createFamilyHealthHistory({ relatedPersonId: owner.id, condition: 'Hipertansiyon', privacy: 'family' });
    expect(history.some((item) => item.condition === 'Hipertansiyon')).toBe(true);
    const records = await store.createFinanceRecord({ ownerPersonId: owner.id, title: 'Altın hesabı', kind: 'asset', amount: 100000, currency: 'TRY', symbol: 'XAU', privacy: 'private', occurredAt: '2026-07-21T10:00:00.000Z' });
    const record = records.find((item) => item.title === 'Altın hesabı')!;
    const valuations = await store.createFinanceValuation({ financeRecordId: record.id, valueDate: '2026-07-21T12:00:00.000Z', unitPrice: 5000, quantity: 25, provider: 'Manuel' });
    expect(valuations.find((item) => item.financeRecordId === record.id)?.marketValue).toBe(125000);
    store.close();
  });

  it('görev, sigorta, eğitim, iş, varlık ve acil durum kayıtlarını güvenli biçimde oluşturur', async () => {
    const { store } = makeStore();
    await authenticate(store);
    const owner = await getAuthenticatedPerson(store);
    const categories = ['task','insurance','education','employment','property','emergency'] as const;
    for (const category of categories) await store.createLifeRecord({ ownerPersonId: owner.id, category, title: `${category} kaydı`, status: 'active', privacy: category === 'emergency' ? 'family' : 'private', dueAt: '2026-12-31T12:00:00.000Z' });
    const records = await store.listLifeRecords();
    expect(new Set(records.map((record) => record.category)).size).toBe(6);
    expect(records.find((record) => record.category === 'emergency')?.privacy).toBe('family');
    store.close();
  });


  it('otomasyon kuralı oluşturur ve raporlama özetini üretir', async () => {
    const { store } = makeStore();
    await authenticate(store);
    const rules = await store.createAutomationRule({ title: 'Görev vade uyarısı', sourceType: 'life_record', daysBefore: 3 });
    expect(rules.some((rule) => rule.title === 'Görev vade uyarısı' && rule.enabled)).toBe(true);
    const rule = rules.find((item) => item.title === 'Görev vade uyarısı')!;
    expect((await store.toggleAutomationRule(rule.id, false)).find((item) => item.id === rule.id)?.enabled).toBe(false);
    const report = await store.getReportSummary();
    expect(report.peopleCount).toBeGreaterThan(0);
    expect(Array.isArray(report.financeByCurrency)).toBe(true);
    store.close();
  });

  it('soy ağacı analizi, arşiv sınıflandırması ve yapay zekâ onaylarını uygular', async () => {
    const { store, directory } = makeStore();
    await authenticate(store);
    const insight = store.getGenealogyInsights();
    expect(insight.generations).toBeGreaterThanOrEqual(4);
    expect(insight.timeline.some((item) => item.kind === 'birth')).toBe(true);
    const categories = await store.createArchiveCategory({ name: 'Aile Belgeleri' });
    expect(categories.some((item) => item.name === 'Aile Belgeleri')).toBe(true);
    const source = join(directory, 'belge.txt'); writeFileSync(source, 'aile belgesi');
    const item = (await store.importArchiveFile(source, { title: 'Test Belgesi' })).find((entry) => entry.title === 'Test Belgesi')!;
    const category = categories.find((entry) => entry.name === 'Aile Belgeleri')!;
    const classified = await store.updateArchiveClassification({ itemId: item.id, categoryId: category.id, tagNames: ['resmi','aile'], sensitivity: 'personal', aiProcessingAllowed: true });
    expect(classified.find((entry) => entry.itemId === item.id)?.tags.length).toBe(2);
    store.upsertAiConsent({ purpose: 'classification', resourceType: 'archive_item', resourceId: item.id, status: 'granted' });
    expect(store.previewAiAccess('classification').allowedResources.some((entry) => entry.resourceId === item.id)).toBe(true);
    store.close();
  });

  it('önemli güne bağlı arşiv içeriğini yalnız ilgili etkinlik için getirir', async () => {
    const { store, directory } = makeStore();
    await authenticate(store);
    const event = (await store.getSnapshot()).events.find((entry) => entry.kind === 'important_day')!;
    const initialAttachmentCount = event.attachmentCount;
    const linkedSource = join(directory, 'bagli-fotograf.jpg');
    const unrelatedSource = join(directory, 'diger-belge.txt');
    writeFileSync(linkedSource, 'önemli güne bağlı fotoğraf');
    writeFileSync(unrelatedSource, 'bağlantısız belge');

    const linked = (await store.importArchiveFile(linkedSource, {
      title: 'Etkinlik Fotoğrafı',
      linkedEventId: event.id
    })).find((entry) => entry.title === 'Etkinlik Fotoğrafı')!;
    await store.importArchiveFile(unrelatedSource, { title: 'Bağlantısız Belge' });

    const filtered = await store.searchArchive({ linkedEventId: event.id });
    expect(filtered.map((entry) => entry.id)).toEqual([linked.id]);
    expect(
      (await store.getSnapshot()).events.find((entry) => entry.id === event.id)?.attachmentCount
    ).toBe(initialAttachmentCount + 1);
    store.close();
  });


  it('otomasyon çalıştırıcısı görev üretir ve dijital miras planını kaydeder', async () => {
    const { store } = makeStore();
    await authenticate(store);
    const owner = await getAuthenticatedPerson(store);
    await store.createLifeRecord({ ownerPersonId: owner.id, category: 'task', title: 'Yaklaşan aile görevi', status: 'active', privacy: 'private', dueAt: '2026-07-24T12:00:00.000Z' });
    await store.createAutomationRule({ title: 'Yaklaşan görev', sourceType: 'life_record', daysBefore: 7 });
    const runs = await store.runAutomationRules({ now: '2026-07-21T12:00:00.000Z' });
    expect(runs.some((run) => run.status === 'generated' && run.generatedTaskId)).toBe(true);
    const admin = store.listAccounts()[0]!;
    const plans = store.upsertDigitalLegacyPlan({ ownerPersonId: owner.id, title: 'Dijital miras planı', status: 'active', triggerType: 'death_confirmation', trusteeAccountId: admin.id, instructions: 'Aile arşivini koru.' });
    expect(plans.some((plan) => plan.title === 'Dijital miras planı' && plan.status === 'active')).toBe(true);
    const plan = plans.find((item) => item.title === 'Dijital miras planı')!;
    const grants = store.upsertLegacyGrant({ planId: plan.id, resourceType: 'archive_item', resourceId: '*', actions: ['read'] });
    expect(grants.some((grant) => grant.planId === plan.id && grant.actions.includes('read'))).toBe(true);
    store.close();
  });

  it('dijital miras yürütmesini bekleme süresi ve yönetici onayıyla başlatır', async () => {
    const { store } = makeStore();
    await authenticate(store);
    const owner = await getAuthenticatedPerson(store);
    const admin = store.listAccounts()[0]!;
    const plan = store.upsertDigitalLegacyPlan({ ownerPersonId: owner.id, title: 'Çift onay planı', status: 'active', triggerType: 'death_confirmation', trusteeAccountId: admin.id, waitingDays: 1, rollbackHours: 48 })[0]!;
    const pending = store.executeDigitalLegacyPlan({ planId: plan.id, confirmationNote: 'Resmî belge aile yöneticisi tarafından doğrulandı.' }).find((item) => item.id === plan.id)!;
    expect(pending.status).toBe('pending_execution');
    expect(pending.executeAfter).toBeTruthy();
    expect(store.listLegacyApprovals(plan.id)).toHaveLength(1);
    store.cancelLegacyExecution({ planId: plan.id, reason: 'İkinci doğrulama bekleniyor' });
    expect(store.listDigitalLegacyPlans().find((item) => item.id === plan.id)?.status).toBe('active');
    store.close();
  });

  it('arşiv arama, sürüm ve saklama politikası çekirdeğini uygular', async () => {
    const { store, directory } = makeStore();
    await authenticate(store);
    const source = join(directory, 'arsiv-belgesi.txt'); writeFileSync(source, 'saklama politikası testi');
    const item = (await store.importArchiveFile(source, { title: 'Saklanacak Belge' })).find((entry) => entry.title === 'Saklanacak Belge')!;
    expect((await store.searchArchive({ query: 'saklanacak' })).some((entry) => entry.id === item.id)).toBe(true);
    expect((await store.listArchiveVersions(item.id))[0]?.versionNo).toBe(1);
    const policy = (await store.createArchiveRetentionPolicy({ name: 'Bir Yıllık Saklama', retentionDays: 365, secureDestroy: true }))[0]!;
    const status = (await store.assignArchiveRetentionPolicy({ itemId: item.id, policyId: policy.id })).find((entry) => entry.itemId === item.id)!;
    expect(status.policyName).toBe('Bir Yıllık Saklama');
    expect(status.eligibleForDestruction).toBe(false);
    store.close();
  });


  it('yedek hedeflerini bağımsız çalıştırır ve performans geçmişi oluşturur', async () => {
    const { directory, store } = makeStore();
    await authenticate(store);
    const goodPath = join(directory, 'backups');
    const targets = store.upsertBackupTarget({ name: 'Yerel Test', kind: 'local', path: goodPath, enabled: true });
    const good = targets.find((item) => item.name === 'Yerel Test')!;
    const result = store.runBackupTarget(good.id);
    expect(result.success).toBe(true);
    expect(result.run.sha256).toHaveLength(64);
    expect(result.run.filePath && existsSync(result.run.filePath)).toBe(true);
    expect(store.listBackupRuns().some((run) => run.targetId === good.id && run.status === 'success')).toBe(true);
    const sample = store.capturePerformanceSample();
    expect(sample.memoryUsagePercent).toBeGreaterThanOrEqual(0);
    expect(store.listPerformanceSamples()).toHaveLength(1);
    store.close();
  });

  it('zamanlanmış yedekleri çalıştırır, saklama ve adaptif kaynak durumunu uygular', async () => {
    const { directory, store } = makeStore();
    await authenticate(store);
    const path = join(directory, 'scheduled-backups');
    const target = store.upsertBackupTarget({ name:'Günlük Test', kind:'local', path, enabled:true, schedule:'daily', retentionCount:1, retryCount:1 }).find(x=>x.name==='Günlük Test')!;
    expect(target.schedule).toBe('daily');
    expect(target.nextRunAt).toBeTruthy();
    const scheduler = store.runDueBackupTargets('2999-01-01T00:00:00.000Z');
    expect(scheduler.dueTargets).toBeGreaterThanOrEqual(1);
    expect(scheduler.successful + scheduler.deferred).toBeGreaterThanOrEqual(1);
    const adaptive = store.getAdaptiveResourceState();
    expect(adaptive.maxConcurrentJobs).toBeGreaterThanOrEqual(1);
    expect(['low','balanced','high']).toContain(adaptive.profile);
    store.close();
  });


  it('performans eğilimini ve arka plan görev geçmişini üretir', async () => {
    const { directory, store } = makeStore();
    await authenticate(store);
    store.capturePerformanceSample();
    store.capturePerformanceSample();
    const trend = store.getPerformanceTrend(24);
    expect(trend.sampleCount).toBe(2);
    expect(['improving','stable','degrading']).toContain(trend.direction);
    const target = store.upsertBackupTarget({ name:'Görev İzleme', kind:'local', path:join(directory,'task-backups'), enabled:true })[0]!;
    expect(store.runBackupTarget(target.id).success).toBe(true);
    const tasks = store.listBackgroundTasks();
    expect(tasks.some((task) => task.taskType === 'backup' && task.status === 'success')).toBe(true);
    store.close();
  });


  it('öncelikli görev kuyruğunu, bakım politikasını ve tanılama raporunu yönetir', async () => {
    const { store } = makeStore();
    await authenticate(store);
    const task=store.enqueueTask({taskType:'performance.sample',label:'Örnek al',priority:'critical'});
    expect(task.priority).toBe('critical');
    const cycle=store.processTaskQueue();
    expect(cycle.completed).toBe(1);
    const policy=store.upsertMaintenancePolicy({intervalHours:12,keepDiagnosticDays:30,keepPerformanceDays:60});
    expect(policy.intervalHours).toBe(12);
    const report=store.getDiagnosticReport();
    expect(report.queue.some(item=>item.id===task.id&&item.status==='completed')).toBe(true);
    expect(Array.isArray(report.healthNotifications)).toBe(true);
    store.close();
  });

  it('sistem sağlık puanını, tanılama filtrelerini ve rapor geçmişini üretir', async () => {
    const { directory, store } = makeStore();
    await authenticate(store);
    store.recordDiagnostic('warning','mvp25.filter','Filtrelenebilir tanılama kaydı','ayrıntı');
    expect(store.searchDiagnostics({ query:'Filtrelenebilir', severity:'warning' })).toHaveLength(1);
    const score=store.getSystemHealthScore();
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
    const reportPath=join(directory,'diagnostic-mvp25.json');
    store.exportDiagnosticReport(reportPath);
    const history=store.listDiagnosticReports();
    expect(history).toHaveLength(1);
    expect(history[0]?.sha256).toHaveLength(64);
    expect(history[0]?.healthScore).toBe(score.score);
    store.close();
  });

  it('sağlık geçmişini, olay arşivini ve rapor bütünlüğünü yönetir', async () => {
    const { directory, store } = makeStore();
    await authenticate(store);
    const first=store.captureSystemHealthScore();
    const second=store.captureSystemHealthScore();
    expect(store.listSystemHealthHistory()).toHaveLength(2);
    const trend=store.getSystemHealthTrend(30);
    expect(trend.sampleCount).toBe(2);
    expect(trend.currentScore).toBe(second.score);
    store.recordDiagnostic('warning','mvp26.archive','Arşivlenecek olay');
    const archivePath=join(directory,'diagnostics.json.gz');
    const archive=store.archiveDiagnostics('2999-01-01T00:00:00.000Z',archivePath);
    expect(archive.entryCount).toBeGreaterThanOrEqual(1);
    expect(existsSync(archivePath)).toBe(true);
    const reportPath=join(directory,'diagnostic-mvp26.json');
    store.exportDiagnosticReport(reportPath);
    const report=store.listDiagnosticReports()[0]!;
    expect(store.verifyDiagnosticReport(report.id).valid).toBe(true);
    writeFileSync(reportPath,'değiştirildi','utf8');
    expect(store.verifyDiagnosticReport(report.id).valid).toBe(false);
    expect(Array.isArray(store.getPerformanceAnomalies(24))).toBe(true);
    expect(store.getMaintenanceRecommendations().length).toBeGreaterThan(0);
    expect(first.score).toBeGreaterThanOrEqual(0);
    store.close();
  });

  it('reads and verifies diagnostic reports and archives', async () => {
    const { directory, store } = makeStore();
    await authenticate(store);
    const reportPath = join(directory, 'diagnostic-report.json');
    store.exportDiagnosticReport(reportPath);
    const report = store.listDiagnosticReports(1)[0]!;
    expect(store.readDiagnosticReport(report.id).valid).toBe(true);
    store.recordDiagnostic('info','mvp27.archive','Arşiv testi');
    const archivePath = join(directory, 'diagnostics.json.gz');
    const archive = store.archiveDiagnostics(new Date(Date.now()+1000).toISOString(), archivePath);
    expect(archive.entryCount).toBeGreaterThan(0);
    expect(store.verifyDiagnosticArchive(archive.id).valid).toBe(true);
    store.close();
  });


  it('dışa aktarım geçmişini doğrular ve raporları alan bazında karşılaştırır', async () => {
    const { directory, store } = makeStore();
    await authenticate(store);
    const firstPath=join(directory,'report-first.json');
    store.exportDiagnosticReport(firstPath);
    store.recordDiagnostic('warning','mvp31.diff','Alan farkı oluştur');
    const secondPath=join(directory,'report-second.json');
    store.exportDiagnosticReport(secondPath);
    const reports=store.listDiagnosticReports(2);
    const comparison=store.compareDiagnosticReports(reports[1]!.id,reports[0]!.id);
    expect(comparison.fieldChanges?.length).toBeGreaterThan(0);
    const exports=store.listExportArtifacts();
    expect(exports).toHaveLength(2);
    expect(store.verifyExportArtifact(exports[0]!.id).valid).toBe(true);
    writeFileSync(exports[0]!.filePath,'bozuldu','utf8');
    expect(store.verifyExportArtifact(exports[0]!.id).valid).toBe(false);
    store.close();
  });


  it('MVP-33 tam yedeği bileşen hashleriyle inceler', async () => {
    const { directory, store } = makeStore();
    await authenticate(store);
    const backupPath=join(directory,'mvp33.pptbackup');
    store.exportFullBackup(backupPath, BACKUP_PASSWORD);
    const inspection=store.inspectFullBackup(backupPath, BACKUP_PASSWORD);
    expect(inspection.valid).toBe(true);
    expect(inspection.formatVersion).toBe(3);
    expect(inspection.legacy).toBe(false);
    expect(inspection.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(inspection.riskLevel).toBe('low');
    expect(inspection.checks).toHaveLength(6);
    expect(inspection.checks.every(check=>check.valid)).toBe(true);
    store.close();
  });

  it('bozulmuş v2 yedeği mevcut veriye dokunmadan reddeder', async () => {
    const { directory, store } = makeStore();
    await authenticate(store);
    store.createMember({ displayName:'Korunacak Kişi', relationshipType:'Kuzen', generation:4, branch:'Test' });
    const backupPath=join(directory,'corrupt.pptbackup');
    store.exportFullBackup(backupPath, BACKUP_PASSWORD);
    const payload=JSON.parse(readFileSync(backupPath,'utf8')) as {ciphertext:string};
    const ciphertext=Buffer.from(payload.ciphertext,'base64');
    ciphertext[0]=(ciphertext[0]??0)^0xff;
    payload.ciphertext=ciphertext.toString('base64');
    writeFileSync(backupPath,JSON.stringify(payload));
    const safetyPath=join(directory,'safety','should-not-exist.pptbackup');
    expect(()=>store.restoreFullBackup(backupPath,safetyPath)).toThrow(/parolası yanlış|bütünlüğü bozuk/);
    expect(existsSync(safetyPath)).toBe(false);
    expect((await store.getSnapshot()).people.some(person=>person.displayName==='Korunacak Kişi')).toBe(true);
    store.close();
  });

  it('eski v1 tam yedekleri geriye dönük uyumlu olarak tanır', async () => {
    const { directory, store } = makeStore();
    await authenticate(store);
    const modernPath=join(directory,'modern.pptbackup');
    store.exportFullBackup(modernPath, BACKUP_PASSWORD);
    const modern=JSON.parse(readFileSync(modernPath,'utf8')) as unknown;
    const decrypted=decryptFullBackupPayloadV3<{createdAt?:string;database:string;vaultKey:string;archive:Array<{name:string;data:string}>}>(modern,BACKUP_PASSWORD);
    const legacyPath=join(directory,'legacy.pptbackup');
    writeFileSync(legacyPath,JSON.stringify({version:1,createdAt:decrypted.payload.createdAt,database:decrypted.payload.database,vaultKey:decrypted.payload.vaultKey,archive:decrypted.payload.archive.map(({name,data})=>({name,data}))}));
    const inspection=store.inspectFullBackup(legacyPath,BACKUP_PASSWORD);
    expect(inspection.valid).toBe(true);
    expect(inspection.legacy).toBe(true);
    expect(inspection.formatVersion).toBe(1);
    expect(inspection.riskLevel).toBe('attention');
    expect(inspection.recommendation).toMatch(/v3 yedek/);
    store.close();
  });


  it('MVP-35 yedek inceleme hatalarını kararlı hata kodlarıyla bildirir', async () => {
    const { directory, store } = makeStore();
    await authenticate(store);
    const invalidPath=join(directory,'invalid.pptbackup');
    writeFileSync(invalidPath,'geçersiz-json','utf8');
    expect(()=>store.inspectFullBackup(invalidPath)).toThrow(/\[BKP-002\]/);
    store.close();
  });


  it('büyük görev kuyruklarını güvenli üst sınır ve öncelik sırasıyla listeler', async () => {
    const { store } = makeStore();
    await authenticate(store);
    for (let index = 0; index < 540; index += 1) {
      store.enqueueTask({
        taskType: 'performance.sample',
        label: `Yük testi ${index}`,
        priority: index % 50 === 0 ? 'critical' : 'low'
      });
    }
    const rows = store.listQueuedTasks(10_000);
    expect(rows).toHaveLength(500);
    expect(rows[0]?.priority).toBe('critical');
    expect(rows.filter((row) => row.priority === 'critical').length).toBeGreaterThan(0);
    store.close();
  });

  it('yüksek hacimli geçmiş listelerinde sorgu üst sınırlarını uygular', async () => {
    const { store } = makeStore();
    await authenticate(store);
    for (let index = 0; index < 525; index += 1) {
      store.recordDiagnostic('info', 'performance.bulk_test', `Kayıt ${index}`);
    }
    expect(store.listDiagnostics(50_000)).toHaveLength(500);
    expect(store.listDiagnostics(25)).toHaveLength(25);
    store.close();
  });


  it('denetim kayıtlarını SHA-256 zinciriyle doğrular', async () => {
    const { store } = makeStore();
    await authenticate(store);
    await store.createAutomationRule({ title: 'Denetim zinciri testi', sourceType: 'life_record', daysBefore: 2 });
    const result = store.verifyAuditIntegrity();
    expect(result.valid).toBe(true);
    expect(result.checkedEntries).toBeGreaterThan(1);
    expect(result.headHash).toMatch(/^[a-f0-9]{64}$/);
    store.close();
  });

  it('değiştirilmiş denetim kaydını tespit eder', async () => {
    const { store, directory } = makeStore();
    await authenticate(store);
    await store.createAutomationRule({ title: 'Kurcalama testi', sourceType: 'life_record', daysBefore: 1 });
    store.close();
    const dbPath = join(directory, 'family.db');
    const raw = new DatabaseSync(dbPath);
    raw.exec('DROP TRIGGER audit_log_append_only_update');
    raw.prepare("UPDATE audit_log SET action='tampered.action' WHERE rowid=(SELECT MAX(rowid) FROM audit_log)").run();
    raw.close();
    const reopened = trackStore(new FamilyDataStore({ databasePath: dbPath, archivePath: join(directory, 'archive'), seed: false }));
    await authenticate(reopened);
    const result = reopened.verifyAuditIntegrity();
    expect(result.valid).toBe(false);
    expect(result.firstInvalidEntryId).toBeTruthy();
    reopened.close();
  });

  it('denetim kaydının doğrudan değiştirilmesini depolama katmanında engeller', async () => {
    const { store, directory } = makeStore();
    await authenticate(store);
    await store.createAutomationRule({ title: 'Append-only testi', sourceType: 'life_record', daysBefore: 1 });
    store.close();
    const raw = new DatabaseSync(join(directory, 'family.db'));
    expect(() =>
      raw.prepare("UPDATE audit_log SET action='tampered.action' WHERE rowid=(SELECT MAX(rowid) FROM audit_log)").run()
    ).toThrow(/AUDIT-APPEND-ONLY/);
    raw.close();
  });

  it('PPK-012 çevrimdışı yetki kirasını kalıcılaştırır ve iptali tek yönlü uygular', async () => {
    const { store, directory } = makeStore();
    await authenticate(store);
    const account = store.listAccounts().find((item) => item.status === 'active');
    expect(account).toBeTruthy();
    const issued = store.issueOfflineCapabilityLease({
      subjectAccountId: account!.id,
      capability: 'health.read',
      durationMinutes: 60
    });
    expect(issued).toMatchObject({ state: 'active', capability: 'health.read', remainingSeconds: 3600 });
    expect(issued.leaseSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(store.listOfflineCapabilityLeases().some((lease) => lease.leaseId === issued.leaseId)).toBe(true);
    const raw = new DatabaseSync(join(directory, 'family.db'));
    expect(raw.prepare('SELECT COUNT(*) AS count FROM offline_capability_leases WHERE lease_id=?').get(issued.leaseId)).toEqual({ count: 1 });
    const revoked = store.revokeOfflineCapabilityLease(issued.leaseId);
    expect(revoked.state).toBe('revoked');
    expect(revoked.leaseSha256).not.toBe(issued.leaseSha256);
    expect(() => store.revokeOfflineCapabilityLease(issued.leaseId)).not.toThrow();
    expect(() => store.issueOfflineCapabilityLease({ subjectAccountId: account!.id, capability: 'health.read', durationMinutes: 1_441 })).toThrow(/24 saat/u);
    raw.close();
  });

});
