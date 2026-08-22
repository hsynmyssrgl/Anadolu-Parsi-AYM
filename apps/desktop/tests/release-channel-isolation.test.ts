import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

const configuration=JSON.parse(readFileSync('config/release-channel-worktrees.json','utf8')) as {
  policyId:string;
  channels:Array<{channel:string;directory:string;branch:string}>;
  rules:Record<string,boolean>;
};
const setupScript=readFileSync('scripts/setup-release-channel-worktrees.mjs','utf8');
const allocator=readFileSync('scripts/allocate-monthly-release-version.mjs','utf8');

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

  it('creates governed Git worktrees only from a clean authoritative repository',()=>{
    expect(setupScript).toContain("git(['status','--porcelain'])");
    expect(setupScript).toContain("['worktree','add','-b',definition.branch,target,'HEAD']");
    expect(setupScript).toContain('exists but is not a registered Git worktree');
  });

  it('updates installer identity and channel token whenever a new release is allocated',()=>{
    for(const marker of ['manifest.build.appId','manifest.build.productName','manifest.build.executableName','manifest.build.nsis.shortcutName','PPT_INSTALLER_RELEASE_CHANNEL']){
      expect(allocator).toContain(marker);
    }
  });
});
