import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe,expect,it } from 'vitest';

const configuration=JSON.parse(readFileSync('config/release-channel-worktrees.json','utf8')) as {
  policyId:string;
  channels:Array<{channel:string;directory:string;branch:string}>;
  rules:Record<string,boolean>;
};
const setupScript=readFileSync('scripts/setup-release-channel-worktrees.mjs','utf8');
const verifierScript=readFileSync('scripts/verify-release-channel-worktrees.mjs','utf8');
const allocator=readFileSync('scripts/allocate-monthly-release-version.mjs','utf8');
const installer=readFileSync('apps/desktop/build/installer.nsh','utf8');
const gitAttributes=readFileSync('.gitattributes','utf8');
const setupModule=await import(pathToFileURL(resolve('scripts/setup-release-channel-worktrees.mjs')).href) as {
  assertCleanWorktree:(status:string,label:string)=>void;
  assertExactCommit:(actual:string,expected:string,label:string)=>void;
};
const verifierModule=await import(pathToFileURL(resolve('scripts/verify-release-channel-worktrees.mjs')).href) as {
  verifyReleaseChannelWorktrees:(input:{
    kind:string;checkoutRoot:string;configuration:typeof configuration;
    runGit:(args:string[],cwd:string)=>string;
  })=>{status:string;authoritativeRepositoryRoot:string;commonGitDirectory:string};
};

const createGitDouble=(dirtyChannel?:string,wrongCommonChannel?:string)=>{
  const authoritativeRoot=resolve(process.cwd());
  const codeRoot=dirname(authoritativeRoot);
  const commonGitDirectory=resolve(authoritativeRoot,'.git');
  const roots=new Map(configuration.channels.map((item)=>[
    resolve(codeRoot,'kanallar',item.directory),item
  ]));
  const records=[
    `worktree ${authoritativeRoot}\nHEAD ${'a'.repeat(40)}\nbranch refs/heads/main`,
    ...[...roots].map(([root,item])=>`worktree ${root}\nHEAD ${'a'.repeat(40)}\nbranch refs/heads/${item.branch}`)
  ].join('\n\n');
  return {
    authoritativeRoot,codeRoot,commonGitDirectory,
    runGit:(args:string[],cwd:string):string=>{
      const command=args.join(' ');
      if(command==='worktree list --porcelain')return records;
      if(command==='rev-parse --git-common-dir'){
        const channel=roots.get(resolve(cwd))?.channel;
        return wrongCommonChannel!==undefined&&channel===wrongCommonChannel
          ?resolve(codeRoot,'.wrong-git')
          :commonGitDirectory;
      }
      if(command==='rev-parse --show-toplevel')return resolve(cwd);
      if(command==='symbolic-ref --quiet --short HEAD'){
        const definition=roots.get(resolve(cwd));
        if(!definition)throw new Error(`Unexpected branch lookup: ${cwd}`);
        return definition.branch;
      }
      if(command==='status --porcelain=v1 --untracked-files=all'){
        return roots.get(resolve(cwd))?.channel===dirtyChannel?' M dirty-file.ts':'';
      }
      throw new Error(`Unexpected Git command: ${command} at ${cwd}`);
    }
  };
};

describe('release-channel source and runtime isolation',()=>{
  it('assigns Bronze, Silver and Gold to unique source folders and branches',()=>{
    expect(configuration.policyId).toBe('PPT-RELEASE-CHANNEL-WORKTREE-ISOLATION-V1');
    expect(configuration.channels.map(item=>item.channel)).toEqual(['Bronze','Silver','Gold']);
    expect(new Set(configuration.channels.map(item=>item.directory)).size).toBe(3);
    expect(new Set(configuration.channels.map(item=>item.branch)).size).toBe(3);
    expect(configuration.rules).toMatchObject({
      sharedGitObjectDatabase:true,separateBranchesRequired:true,separateWorkingDirectoriesRequired:true,
      directDirectoryCopyProhibited:true,crossChannelBuildOutputReuseProhibited:true,crossChannelUserDataReuseProhibited:true
    });
  });

  it('preserves exact tracked blob bytes across every release worktree',()=>{
    expect(gitAttributes).toMatch(/^\* -text$/mu);
  });

  it('creates governed Git worktrees only from a clean authoritative repository',()=>{
    expect(setupScript).toContain("git(['status', '--porcelain=v1', '--untracked-files=all'])");
    expect(setupScript).toContain("['worktree', 'add', '-b', definition.branch, target, 'HEAD']");
    expect(setupScript).toContain('exists but is not a registered Git worktree');
    expect(setupScript).toContain('assertExactCommit(branchCommit, authoritativeHead');
    expect(setupScript).toContain('verifyWorktree(definition, target)');
    expect(()=>setupModule.assertCleanWorktree('', 'Bronze worktree')).not.toThrow();
    expect(()=>setupModule.assertCleanWorktree(' M package.json', 'Bronze worktree')).toThrow(/not clean/u);
    const commit='a'.repeat(40);
    expect(()=>setupModule.assertExactCommit(commit,commit,'Bronze branch')).not.toThrow();
    expect(()=>setupModule.assertExactCommit('b'.repeat(40),commit,'Bronze branch')).toThrow(/authoritative HEAD/u);
  });

  it('resolves the canonical repository from shared Git metadata inside a channel worktree',()=>{
    const fake=createGitDouble();
    const result=verifierModule.verifyReleaseChannelWorktrees({
      kind:'build',checkoutRoot:resolve(fake.codeRoot,'kanallar','Bronze'),configuration,runGit:fake.runGit
    });
    expect(result).toMatchObject({
      status:'PASS',authoritativeRepositoryRoot:fake.authoritativeRoot,commonGitDirectory:fake.commonGitDirectory
    });
    expect(verifierScript).toContain('const authoritativeRepositoryRoot = dirname(commonGitDirectory)');
  });

  it('rejects dirty channel worktrees and a divergent shared Git database',()=>{
    const dirty=createGitDouble('Silver');
    expect(()=>verifierModule.verifyReleaseChannelWorktrees({
      kind:'installation',checkoutRoot:dirty.authoritativeRoot,configuration,runGit:dirty.runGit
    })).toThrow(/Silver release worktree is not clean/u);
    const divergent=createGitDouble(undefined,'Gold');
    expect(()=>verifierModule.verifyReleaseChannelWorktrees({
      kind:'publish',checkoutRoot:divergent.authoritativeRoot,configuration,runGit:divergent.runGit
    })).toThrow(/Gold release worktree registration or shared Git database is invalid/u);
  });

  it('updates installer identity and channel token whenever a new release is allocated',()=>{
    for(const marker of ['manifest.build.appId','manifest.build.productName','manifest.build.executableName','manifest.build.nsis.shortcutName','PPT_INSTALLER_RELEASE_CHANNEL']){
      expect(allocator).toContain(marker);
    }
  });

  it('keeps program roots sibling to the legacy root while retaining channel AppData',()=>{
    expect(installer).toContain('StrCpy $INSTDIR "$PROGRAMFILES64\\PPT\\${PPT_INSTALLER_PROGRAM_DIRECTORY}"');
    expect(installer).not.toContain('StrCpy $INSTDIR "$PROGRAMFILES64\\PPT\\ParsYuva\\${PPT_INSTALLER_CHANNEL_DIRECTORY}"');
    expect(installer).toContain('$APPDATA\\ParsYuva\\${PPT_INSTALLER_CHANNEL_DIRECTORY}');
  });
});
