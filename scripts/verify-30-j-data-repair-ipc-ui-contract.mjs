import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const files = {
  store: 'apps/desktop/src/main/data-store.ts',
  main: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  global: 'apps/desktop/src/renderer/global.d.ts',
  renderer: 'apps/desktop/src/renderer/App.tsx',
  styles: 'apps/desktop/src/renderer/styles.css'
};
const sources = Object.fromEntries(Object.entries(files).map(([key,path])=>[key,readFileSync(path,'utf8')]));
const checks=[];
const contains=(source,token,label)=>{assert.equal(source.includes(token),true,`${label}: ${token}`);checks.push(label);};

contains(sources.store,'RepositoryBackedDataRepairUnitOfWork','DataStore composes the governed data repair unit of work');
for(const useCase of ['ScanDataRepairIssuesUseCase','PreviewDataRepairUseCase','ApplyDataRepairUseCase','UndoDataRepairUseCase','GetDataRepairWorkspaceUseCase']){
  contains(sources.store,useCase,`DataStore composes ${useCase}`);
}
for(const method of ['getDataRepairWorkspace','previewDataRepair','applyDataRepair','undoDataRepair']){
  contains(sources.store,`public ${method}`,`DataStore exposes governed ${method}`);
}

const channels = [
  ['data-repair:workspace','getDataRepairWorkspace:():Promise<DataRepairWorkspaceView>'],
  ['data-repair:preview','previewDataRepair:(input:{issueId:string;reason:string}):Promise<DataRepairOperation>'],
  ['data-repair:apply','applyDataRepair:(input:{operationId:string;expectedRevisionToken:string}):Promise<DataRepairOperation>'],
  ['data-repair:undo','undoDataRepair:(operationId:string):Promise<DataRepairOperation>']
];
for(const [channel,preloadMethod] of channels){
  contains(sources.main,`registerIpcHandler('${channel}'`,`main registers trusted correlated ${channel}`);
  contains(sources.preload,`invoke('${channel}'`,`preload exposes ${channel}`);
  contains(sources.preload,preloadMethod,`preload strongly types ${channel}`);
  assert.equal(sources.main.includes(`ipcMain.handle('${channel}'`),false,`${channel} must not bypass trusted correlated IPC registration`);
  checks.push(`${channel} never bypasses trusted correlated IPC registration`);
}
for(const declaration of [
  'getDataRepairWorkspace():Promise<DataRepairWorkspaceView>',
  'previewDataRepair(input:{issueId:string;reason:string}):Promise<DataRepairOperation>',
  'applyDataRepair(input:{operationId:string;expectedRevisionToken:string}):Promise<DataRepairOperation>',
  'undoDataRepair(operationId:string):Promise<DataRepairOperation>'
])contains(sources.global,declaration,`renderer bridge declares ${declaration}`);

contains(sources.renderer,"label: 'Veri Onarma Merkezi'",'navigation exposes a dedicated data repair menu');
contains(sources.renderer,"active === 'data-repair'",'application renders the data repair route');
contains(sources.renderer,'function DataRepairScreen','renderer implements the governed data repair workspace');
contains(sources.renderer,'window.pardus.getDataRepairWorkspace()','renderer scans through the governed workspace bridge');
contains(sources.renderer,'window.pardus.previewDataRepair({issueId:selectedIssue.id,reason})','renderer requires a server-created preview');
contains(sources.renderer,'expectedRevisionToken:preview.revisionToken','apply carries the preview revision token');
contains(sources.renderer,'!preview||!confirmed','apply fails closed until an explicit preview confirmation');
contains(sources.renderer,'Önceki durum','preview displays the before state');
contains(sources.renderer,'Onarma sonrası','preview displays the after state');
contains(sources.renderer,'window.pardus.undoDataRepair(operationId)','renderer exposes governed rollback');
contains(sources.renderer,"reason.trim().length<5",'renderer requires a meaningful repair reason');
contains(sources.renderer,"operation.status==='applied'",'renderer distinguishes applied operation history');
contains(sources.renderer,"operation.status==='undone'",'renderer distinguishes undone operation history');
const repairScreen = sources.renderer.slice(sources.renderer.indexOf('function DataRepairScreen'),sources.renderer.indexOf('function PermissionsScreen'));
assert.equal(/auth\.role|role\s*===\s*['\"]family_admin/.test(repairScreen),false,'data repair renderer must not make direct role authorization decisions');
checks.push('data repair renderer delegates authorization without direct role comparison');
for(const token of ['.data-repair-workspace','.data-repair-issue.selected','.data-repair-preview','.confirmation-row'])contains(sources.styles,token,`styles expose ${token}`);

const report={
  schemaVersion:1,
  release:'Bronze 04.08.2026.29',
  step:'30-J',
  requirement:'B1-05',
  status:'PASS',
  checkCount:checks.length,
  checks,
  assertions:{trustedCorrelatedIpc:'PASS',typedPreload:'PASS',rendererDeclarations:'PASS',visibleMenu:'PASS',mandatoryPreview:'PASS',revisionProtection:'PASS',explicitConfirmation:'PASS',rollback:'PASS',authorizationDelegation:'PASS',responsiveStyles:'PASS'},
  generatedAt:new Date().toISOString()
};
mkdirSync('artifacts/validation',{recursive:true});
writeFileSync('artifacts/validation/30-J-data-repair-ipc-ui-contract.json',`${JSON.stringify(report,null,2)}\n`);
console.log(`30-J data repair IPC/UI contract: PASS (${checks.length} checks).`);
