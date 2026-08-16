import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source=(path:string):string=>readFileSync(resolve(process.cwd(),path),'utf8');
const policy=source('apps/desktop/src/main/ipc-integration-policy.ts');
const lifecycle=source('apps/desktop/src/main/ipc-request-lifecycle.ts');
const runtime=source('apps/desktop/src/main/ipc-runtime.ts');
const main=source('apps/desktop/src/main/main.ts');
const preload=source('apps/desktop/src/main/preload.ts');
const globalTypes=source('apps/desktop/src/renderer/global.d.ts');
const dataStore=source('apps/desktop/src/main/data-store.ts');

const channels={getCenter:'communicationFileSharing:getCenter',getSafePreview:'communicationFileSharing:getSafePreview',
  selectAndPrepare:'communicationFileSharing:selectAndPrepare',
  apply:'communicationFileSharing:apply'} as const;
const methods=['getCommunicationFileSharingCenter','getCommunicationFileSafePreview','selectAndPrepareCommunicationFile',
  'applyCommunicationFileSharingCommand'] as const;

describe('34-G communication file-sharing desktop bridge',()=>{
  it('exposes and registers the four governed channels exactly once',()=>{
    for(const [key,channel] of Object.entries(channels)){
      expect(preload.match(new RegExp(`invoke\\('${channel}'`,'gu')),channel).toHaveLength(1);
      expect(main.match(new RegExp(`COMMUNICATION_FILE_SHARING_IPC_CHANNELS\\.${key}`,'gu')),channel).toHaveLength(1);
      expect(policy).toContain(`${key}:'${channel}'`);
    }
  });

  it('keeps preload and renderer declarations aligned without byte, path or identity authority',()=>{
    for(const method of methods){
      expect(preload.match(new RegExp(`^  ${method}:`,'gmu')),method).toHaveLength(1);
      expect(globalTypes.match(new RegExp(`(?:^|[;\\s])${method}\\(`,'gmu')),method).toHaveLength(1);
    }
    const preloadSurface=preload.slice(preload.indexOf('getCommunicationFileSharingCenter:'),
      preload.indexOf('getCommunicationRealtimeCallingCenter:'));
    const globalSurface=globalTypes.slice(globalTypes.indexOf('getCommunicationFileSharingCenter()'),
      globalTypes.indexOf('getCommunicationRealtimeCallingCenter()'));
    const rendererSurface=`${preloadSurface}\n${globalSurface}`;
    for(const forbidden of ['rawBytes','sourcePath','sealedPayloadReference','fullContentSha256','providerEvidenceSha256',
      'familyId','accountId','ownerPersonId'])expect(rendererSurface).not.toContain(forbidden);
  });

  it('keeps file selection and bytes entirely in main with no-follow, inode and zeroization checks',()=>{
    expect(main).toContain("dialog.showOpenDialog({title:'Yerel olarak şifrelenecek iletişim dosyasını seç'");
    expect(main).toContain('constants.O_NOFOLLOW');
    expect(main).toContain('stat.nlink!==1');
    expect(main).toContain('opened.nlink!==1');
    expect(main).toContain('opened.dev!==stat.dev||opened.ino!==stat.ino');
    expect(main).toContain('finally{selected.bytes.fill(0);}');
    expect(dataStore).toContain('/** Main-only file selection boundary. Renderer IPC never supplies paths, raw bytes, hashes or sealed references. */');
    expect(dataStore).toContain('this.#prepareCommunicationFileUseCase.execute({');
    expect(dataStore).toContain('this.#getCommunicationFileSafePreviewUseCase.execute(');
    expect(dataStore).toContain('this.#maintainCommunicationFilePayloadVaultUseCase.execute(');
    expect(main).toContain('current.maintainCommunicationFilePayloadVault()');
    expect(policy).toContain("renderingMode==='escaped_plain_text'");
  });

  it('blocks main-only mutation shapes at both IPC and DataStore boundaries',()=>{
    expect(policy).toContain("{readonly kind:'prepare_file'|'record_chunk'|'set_scan'|'add_version'}");
    expect(dataStore).toContain("const communicationFileSharingMainOnlyCommandKinds=new Set<CommunicationFileSharingCommand['kind']>([");
    expect(dataStore).toContain("'prepare_file','record_chunk','set_scan','add_version'");
    for(const forbiddenChannel of ['recordChunk','setScan','addVersion']){
      expect(preload).not.toContain(`communicationFileSharing:${forbiddenChannel}`);
      expect(globalTypes).not.toContain(`communicationFileSharing:${forbiddenChannel}`);
    }
  });

  it('pins request lifecycle and policy-before-dispatch/result-before-response ordering',()=>{
    for(const channel of Object.values(channels))expect(lifecycle).toContain(`'${channel}'`);
    const inputGate=runtime.indexOf('evaluateIpcIntegrationPolicy(input.channel, handlerArguments)');
    const dispatch=runtime.indexOf('input.handler(event, ...(handlerArguments as TArguments))');
    const resultGate=runtime.indexOf('evaluateIpcIntegrationResultPolicy(input.channel, result)');
    const response=runtime.indexOf('createIpcTransportResponseEnvelope(requestContext, correlationId, result)');
    expect(inputGate).toBeGreaterThan(-1);expect(inputGate).toBeLessThan(dispatch);
    expect(resultGate).toBeGreaterThan(dispatch);expect(resultGate).toBeLessThan(response);
  });
});
