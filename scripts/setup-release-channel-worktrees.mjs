import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const repositoryRoot=resolve(import.meta.dirname,'..');
const codeRoot=dirname(repositoryRoot);
const configuration=JSON.parse(readFileSync(join(repositoryRoot,'config/release-channel-worktrees.json'),'utf8'));

const git=(args,{allowFailure=false}={})=>{
  const result=spawnSync('git',['-c',`safe.directory=${repositoryRoot}`,...args],{
    cwd:repositoryRoot,encoding:'utf8',windowsHide:true
  });
  if(!allowFailure&&result.status!==0)throw new Error((result.stderr||result.stdout||`git ${args.join(' ')} failed`).trim());
  return result;
};

if(configuration.schemaVersion!==1||configuration.authoritativeRepositoryDirectory!==basename(repositoryRoot)){
  throw new Error('Release-channel worktree configuration does not match the authoritative repository.');
}
if(git(['status','--porcelain']).stdout.trim()){
  throw new Error('Release-channel worktrees require a clean authoritative repository. Commit and validate first.');
}

const worktreeRoot=resolve(codeRoot,configuration.worktreeRootDirectory);
if(dirname(worktreeRoot)!==codeRoot)throw new Error('Worktree root must be a direct child of the code directory.');
mkdirSync(worktreeRoot,{recursive:true});

const registered=new Map();
const records=git(['worktree','list','--porcelain']).stdout.split(/\r?\n\r?\n/u);
for(const record of records){
  const path=/^worktree (.+)$/mu.exec(record)?.[1];
  const branch=/^branch refs\/heads\/(.+)$/mu.exec(record)?.[1];
  if(path)registered.set(resolve(path),branch??null);
}

const outcomes=[];
for(const definition of configuration.channels){
  const target=resolve(worktreeRoot,definition.directory);
  if(dirname(target)!==worktreeRoot)throw new Error(`Invalid channel worktree directory: ${definition.directory}`);
  const existingBranch=registered.get(target);
  if(existingBranch!==undefined){
    if(existingBranch!==definition.branch)throw new Error(`${definition.channel} worktree is bound to an unexpected branch.`);
    outcomes.push({channel:definition.channel,directory:target,branch:definition.branch,status:'EXISTING'});
    continue;
  }
  if(existsSync(target))throw new Error(`${target} exists but is not a registered Git worktree.`);
  const branchExists=git(['show-ref','--verify','--quiet',`refs/heads/${definition.branch}`],{allowFailure:true}).status===0;
  git(branchExists
    ? ['worktree','add',target,definition.branch]
    : ['worktree','add','-b',definition.branch,target,'HEAD']);
  outcomes.push({channel:definition.channel,directory:target,branch:definition.branch,status:'CREATED'});
}

process.stdout.write(`${JSON.stringify({status:'PASS',policyId:configuration.policyId,worktrees:outcomes},null,2)}\n`);
