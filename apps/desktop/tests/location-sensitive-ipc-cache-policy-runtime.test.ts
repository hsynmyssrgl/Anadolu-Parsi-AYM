import { describe, expect, it } from 'vitest';
import {
  IPC_POLICY_SENSITIVE_READ_CHANNELS,
  IpcReadResultCacheRegistry,
  IpcReadSharingClient,
  createIpcReadSharingKey,
  resolveIpcReadSharingPolicy
} from '../src/main/ipc-read-sharing.js';

const revisions={graph:0,timeline:0,personCatalog:0,eventCatalog:0,dashboard:0,notifications:0,archive:0} as const;

describe('30-Z location-sensitive IPC cache policy',()=>{
  it('disables read sharing for the exact set of location-bearing production channels',()=>{
    expect(IPC_POLICY_SENSITIVE_READ_CHANNELS).toEqual([
      'data:getSnapshot',
      'data:getSnapshotSections',
      'dashboard:getOverview',
      'largeData:timeline',
      'timeline:listArchived'
    ]);
    for(const channel of IPC_POLICY_SENSITIVE_READ_CHANNELS){
      expect(resolveIpcReadSharingPolicy(channel)).toEqual({enabled:false,priority:'standard',ttlMs:0,maxEntries:0,maxResultBytes:0});
    }
    expect(resolveIpcReadSharingPolicy('catalog:listPeople').enabled).toBe(true);
    expect(resolveIpcReadSharingPolicy('largeData:tree').enabled).toBe(true);
  });

  it('forces the preload client to invoke the governed read again after simulated grant expiry',async()=>{
    let now=1_000;let grantActive=true;let pepInvocations=0;
    const client=new IpcReadSharingClient(()=>now);
    for(const channel of IPC_POLICY_SENSITIVE_READ_CHANNELS){
      const policy=resolveIpcReadSharingPolicy(channel);
      const key=createIpcReadSharingKey({rendererSessionId:'renderer-a',sessionEpoch:1,channel,revisions,arguments:[]});
      grantActive=true;
      const first=await client.execute(key,policy,async()=>{pepInvocations+=1;return grantActive?{locationId:'location-secret',locationLabel:'Gizli ev'}:{};});
      expect(first).toHaveProperty('locationLabel','Gizli ev');
      grantActive=false;now+=1;
      const afterExpiry=await client.execute(key,policy,async()=>{pepInvocations+=1;return grantActive?{locationId:'location-secret',locationLabel:'Gizli ev'}:{};});
      expect(afterExpiry).not.toHaveProperty('locationId');expect(afterExpiry).not.toHaveProperty('locationLabel');
    }
    expect(pepInvocations).toBe(IPC_POLICY_SENSITIVE_READ_CHANNELS.length*2);
    expect(client.cacheCount()).toBe(0);expect(client.inFlightCount()).toBe(0);
  });

  it('prevents the main-process registry from storing an authorized result for later replay',()=>{
    const registry=new IpcReadResultCacheRegistry();
    for(const channel of IPC_POLICY_SENSITIVE_READ_CHANNELS){
      const policy=resolveIpcReadSharingPolicy(channel);
      const key=createIpcReadSharingKey({rendererSessionId:'renderer-a',sessionEpoch:1,channel,revisions,arguments:[]});
      expect(registry.store(7,key,{locationId:'location-secret',locationLabel:'Gizli ev'},policy,2_000)).toBe(false);
      expect(registry.lookup(7,key,2_001)).toEqual({hit:false});
    }
    expect(registry.entryCount()).toBe(0);
  });
});
