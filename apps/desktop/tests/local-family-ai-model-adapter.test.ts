import { describe,expect,it } from 'vitest';
import { asCorrelationId } from '@ppt/core';
import {
  OllamaFamilyAiModelAdapter,
  resolveLocalFamilyAiEnabled,
  type LocalFamilyAiLoopbackTransport
} from '../src/main/local-family-ai-model-adapter.js';

const NOW='2026-08-19T08:00:00.000Z';
class FakeTransport implements LocalFamilyAiLoopbackTransport{
  public readonly calls:Parameters<LocalFamilyAiLoopbackTransport['request']>[0][]=[];
  public responses:{readonly statusCode:number;readonly contentType:string;readonly body:string}[]=[];
  public request(input:Parameters<LocalFamilyAiLoopbackTransport['request']>[0]){
    this.calls.push(input);const response=this.responses.shift();if(!response)return Promise.reject(new Error('unavailable'));
    return Promise.resolve(response);
  }
}
const json=(value:unknown)=>({statusCode:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(value)} as const);

describe('local family AI Ollama loopback adapter',()=>{
  it('enables safe loopback discovery by default and preserves an explicit local kill switch',()=>{
    expect(resolveLocalFamilyAiEnabled(undefined)).toBe(true);
    expect(resolveLocalFamilyAiEnabled('')).toBe(true);
    expect(resolveLocalFamilyAiEnabled('1')).toBe(true);
    expect(resolveLocalFamilyAiEnabled('0')).toBe(false);
    expect(resolveLocalFamilyAiEnabled('true')).toBe(false);
  });

  it('stays fail-closed and performs no I/O when not explicitly enabled',async()=>{
    const transport=new FakeTransport();const adapter=new OllamaFamilyAiModelAdapter({enabled:false,model:'qwen3:4b',
      clock:()=>NOW,transport});
    expect(await adapter.getStatus()).toEqual({provider:'ollama_loopback',configured:false,available:false,
      endpoint:'http://127.0.0.1:11434',localLoopbackOnly:true,networkEgressUsed:false,cloudUsed:false,checkedAt:NOW});
    expect(await adapter.run({correlationId:asCorrelationId('local-ai-disabled'),systemPrompt:'system',userPrompt:'user'}))
      .toMatchObject({ok:false,error:{code:'CONFIG-VALIDATION-001'}});
    expect(transport.calls).toHaveLength(0);
  });

  it('probes only the fixed loopback tags endpoint and reports the exact local model',async()=>{
    const transport=new FakeTransport();transport.responses.push(json({models:[{name:'qwen3:4b'}]}));
    const adapter=new OllamaFamilyAiModelAdapter({enabled:true,model:'qwen3:4b',clock:()=>NOW,transport});
    expect(await adapter.getStatus()).toMatchObject({configured:true,available:true,model:'qwen3:4b',
      endpoint:'http://127.0.0.1:11434',networkEgressUsed:false,cloudUsed:false});
    expect(transport.calls).toEqual([{method:'GET',path:'/api/tags',timeoutMs:2000,maximumResponseBytes:262144}]);
  });

  it('runs bounded non-streaming JSON inference and returns only the answer',async()=>{
    const transport=new FakeTransport();transport.responses.push(json({message:{content:JSON.stringify({
      answer:'Bu hafta aile toplantısı kaydını gözden geçirin.'})}}));
    const adapter=new OllamaFamilyAiModelAdapter({enabled:true,model:'qwen3:4b',clock:()=>NOW,transport});
    const result=await adapter.run({correlationId:asCorrelationId('local-ai-run'),systemPrompt:'Yalnız izinli kaynakları kullan.',
      userPrompt:'[event] Aile toplantısı'});
    expect(result).toEqual({ok:true,value:{answer:'Bu hafta aile toplantısı kaydını gözden geçirin.',model:'qwen3:4b',generatedAt:NOW}});
    expect(transport.calls[0]).toMatchObject({method:'POST',path:'/api/chat',timeoutMs:30000,maximumResponseBytes:131072});
    const body=JSON.parse(transport.calls[0]!.body!) as Record<string,unknown>;
    expect(body).toMatchObject({model:'qwen3:4b',stream:false,format:'json',options:{temperature:0,num_predict:1024}});
    expect(JSON.stringify(body)).not.toContain('https://');
  });

  it('rejects redirects, non-JSON bodies and malformed model output',async()=>{
    for(const response of [
      {statusCode:302,contentType:'application/json',body:'{}'},
      {statusCode:200,contentType:'text/html',body:'<html></html>'},
      json({message:{content:JSON.stringify({answer:''})}})
    ]){
      const transport=new FakeTransport();transport.responses.push(response);
      const adapter=new OllamaFamilyAiModelAdapter({enabled:true,model:'qwen3:4b',clock:()=>NOW,transport});
      expect(await adapter.run({correlationId:asCorrelationId('local-ai-invalid'),systemPrompt:'system',userPrompt:'user'}))
        .toMatchObject({ok:false});
    }
  });
});
