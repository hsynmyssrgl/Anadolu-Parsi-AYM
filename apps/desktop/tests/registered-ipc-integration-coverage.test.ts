import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COMPATIBILITY_IPC_CHANNELS,
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy
} from '../src/main/ipc-integration-policy.js';

const mainSource = readFileSync(new URL('../src/main/main.ts', import.meta.url), 'utf8');
const registeredChannels = [...mainSource.matchAll(/register(?:Prepared)?IpcHandler\(\s*['"]([^'"]+)['"]/gu)]
  .map((match) => match[1]!)
  .sort();

describe('registered desktop IPC integration coverage', () => {
  it('admits every literal live registration through an exact or inventoried compatibility policy', () => {
    expect(registeredChannels.length).toBeGreaterThan(300);
    expect(new Set(registeredChannels).size).toBe(registeredChannels.length);
    const unknown = registeredChannels.filter((channel) =>
      evaluateIpcIntegrationPolicy(channel, []).reason === 'UNKNOWN_IPC_CHANNEL');
    expect(unknown).toEqual([]);
    expect([...COMPATIBILITY_IPC_CHANNELS].filter((channel) => !registeredChannels.includes(channel))).toEqual([]);
  });

  it('keeps the dashboard contract exact and unknown channels fail-closed in both directions', () => {
    expect(evaluateIpcIntegrationPolicy('dashboard:getOverview', [])).toEqual({ accepted:true });
    expect(evaluateIpcIntegrationPolicy('dashboard:getOverview', ['unexpected'])).toMatchObject({
      accepted:false,reason:'ARGUMENT_COUNT_MISMATCH'
    });
    expect(evaluateIpcIntegrationPolicy('unknown:future', [])).toMatchObject({
      accepted:false,reason:'UNKNOWN_IPC_CHANNEL'
    });
    expect(evaluateIpcIntegrationResultPolicy('unknown:future', {})).toMatchObject({
      accepted:false,reason:'UNKNOWN_IPC_CHANNEL',path:'$result'
    });
  });

  it('bounds compatibility payloads and rejects accessors, prototype fields and unsafe depth', () => {
    const accessor:Record<string,unknown>={};
    Object.defineProperty(accessor,'secret',{get:()=> 'hidden',enumerable:true});
    expect(evaluateIpcIntegrationPolicy('accounts:update',[accessor])).toMatchObject({
      accepted:false,reason:'ACCESSOR_FIELD_PROHIBITED'
    });
    const prototypeField=Object.create(null) as Record<string,unknown>;
    Object.defineProperty(prototypeField,'constructor',{value:'blocked',enumerable:true});
    expect(evaluateIpcIntegrationPolicy('accounts:update',[prototypeField])).toMatchObject({
      accepted:false,reason:'PROTOTYPE_FIELD_PROHIBITED'
    });
    let nested:unknown='leaf';
    for(let depth=0;depth<34;depth+=1)nested={nested};
    expect(evaluateIpcIntegrationResultPolicy('accounts:list',nested)).toMatchObject({
      accepted:false,reason:'COMPATIBILITY_PAYLOAD_DEPTH_EXCEEDED'
    });
  });
});
