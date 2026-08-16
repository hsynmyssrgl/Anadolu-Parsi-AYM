import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';

const source=(path:string):string=>readFileSync(resolve(process.cwd(),path),'utf8');
const policy=source('apps/desktop/src/main/ipc-integration-policy.ts');
const lifecycle=source('apps/desktop/src/main/ipc-request-lifecycle.ts');
const runtime=source('apps/desktop/src/main/ipc-runtime.ts');
const main=source('apps/desktop/src/main/main.ts');
const preload=source('apps/desktop/src/main/preload.ts');
const globalTypes=source('apps/desktop/src/renderer/global.d.ts');
const dataStore=source('apps/desktop/src/main/data-store.ts');
const lifeRuntime=source('apps/desktop/src/main/life-production-policy-runtime.ts');

describe('34-H communication audit archive desktop bridge',()=>{
  it('registers one read-only safe center channel across main, preload and renderer types',()=>{
    const channel='communicationAuditArchive:getCenter';
    expect(policy).toContain(`getCenter:'${channel}'`);
    expect(preload.match(new RegExp(`invoke\\('${channel}'`,'gu'))).toHaveLength(1);
    expect(main.match(/COMMUNICATION_AUDIT_ARCHIVE_IPC_CHANNELS\.getCenter/gu)).toHaveLength(1);
    expect(preload.match(/^  getCommunicationAuditArchiveCenter:/gmu)).toHaveLength(1);
    expect(globalTypes.match(/getCommunicationAuditArchiveCenter\(\)/gu)).toHaveLength(1);
    expect(lifecycle).toContain(`'${channel}'`);
    expect(`${main}\n${preload}\n${globalTypes}`).not.toContain('communicationAuditArchive:append');
  });
  it('composes the PEP query and exposes no identity, hash, manifest or mutation fields',()=>{
    expect(dataStore).toContain('new RepositoryBackedCommunicationAuditArchiveQueryPort(');
    expect(dataStore).toContain('this.#getCommunicationAuditArchiveSafeCenterUseCase.execute(');
    expect(lifeRuntime).toContain("resourceType === 'communication_audit_archive'");
    for(const forbidden of ['eventHash','previousHash','resourceFingerprint','vaultManifestSha256','databaseManifestSha256',
      'backupManifestSha256','actorPersonId','actorDeviceId','ownerPersonId','familyId'])
      expect(policy.slice(policy.indexOf('const communicationAuditSafeEventResult'),
        policy.indexOf('export const COMMUNICATION_REALTIME_CALLING_IPC_CHANNELS'))).not.toContain(forbidden);
  });
  it('keeps policy-before-dispatch and safe-result-before-response ordering',()=>{
    const inputGate=runtime.indexOf('evaluateIpcIntegrationPolicy(input.channel, handlerArguments)');
    const dispatch=runtime.indexOf('input.handler(event, ...(handlerArguments as TArguments))');
    const resultGate=runtime.indexOf('evaluateIpcIntegrationResultPolicy(input.channel, result)');
    const response=runtime.indexOf('createIpcTransportResponseEnvelope(requestContext, correlationId, result)');
    expect(inputGate).toBeGreaterThan(-1);expect(inputGate).toBeLessThan(dispatch);
    expect(resultGate).toBeGreaterThan(dispatch);expect(resultGate).toBeLessThan(response);
  });
});
