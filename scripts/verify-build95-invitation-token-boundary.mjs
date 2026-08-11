import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const dataStore = read('apps/desktop/src/main/data-store.ts');
const membershipUseCases = read('packages/application/src/membership-use-cases.ts');
const adapter = read('apps/desktop/src/main/invitation-token-application-adapter.ts');
const appMeta = read('packages/domain/src/app-meta.ts');
const metadata = JSON.parse(read('repository-metadata.json'));

const checks = [
  [
    'application invitation token port exists',
    membershipUseCases.includes('export interface InvitationTokenService')
      && membershipUseCases.includes('issue(): { readonly token: string; readonly tokenHash: string }')
      && membershipUseCases.includes('hash(token: string): string')
  ],
  [
    'node invitation token adapter implements the port',
    adapter.includes('export class NodeInvitationTokenService implements InvitationTokenService')
      && adapter.includes("from '@ppt/application'")
  ],
  [
    'adapter preserves 24-byte base64url token generation',
    adapter.includes('randomBytes(24)')
      && adapter.includes("toString('base64url')")
  ],
  [
    'adapter preserves sha256 token hashing',
    adapter.includes("createHash('sha256')")
      && adapter.includes("digest('hex')")
      && adapter.includes('tokenHash: this.hash(token)')
  ],
  [
    'datastore constructs the invitation token adapter',
    dataStore.includes("import { NodeInvitationTokenService } from './invitation-token-application-adapter.js';")
      && dataStore.includes('const invitationTokenService = new NodeInvitationTokenService();')
  ],
  [
    'invitation creation delegates to the adapter',
    dataStore.includes('new CreateFamilyInvitationUseCase(membershipUnitOfWork, invitationTokenService)')
  ],
  [
    'invitation acceptance uses the same adapter instance',
    dataStore.includes('new AcceptFamilyInvitationUseCase(membershipUnitOfWork, invitationTokenService, passwordService)')
  ],
  [
    'datastore no longer owns invitation random bytes or sha256 hashing',
    !dataStore.includes('randomBytes(24)')
      && !dataStore.includes("createHash('sha256').update(token)")
      && !dataStore.includes('const invitationTokenService = {')
      && dataStore.includes("import { randomUUID } from 'node:crypto';")
  ],
  [
    'build95 version metadata is aligned',
    metadata.versionSequence === 95
      && metadata.revision === 'BUILD-95'
      && metadata.packageVersion === '24.7.2026-95'
      && appMeta.includes("version: '24.07.2026.95'")
      && appMeta.includes("packageVersion: '24.7.2026-95'")
      && appMeta.includes('Build 95')
  ],
  [
    'build95 remains active development',
    existsSync(new URL('BUILD_STATUS_BRONZE_RC2_BUILD95.md', root))
      && read('BUILD_STATUS_BRONZE_RC2_BUILD95.md').includes('RC2 Final: No')
      && read('BUILD_STATUS_BRONZE_RC2_BUILD95.md').includes('Code Freeze: No')
      && read('BUILD_STATUS_BRONZE_RC2_BUILD95.md').includes('Silver: No')
  ]
];

for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, passed]) => !passed)) process.exit(1);
console.log(`RESULT ${checks.length}/${checks.length} PASS`);
