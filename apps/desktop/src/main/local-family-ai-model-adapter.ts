import { request as httpRequest } from 'node:http';
import {
  ERROR_CODES,
  asIsoDateTime,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type Result
} from '@ppt/core';
import type { FamilyAiAssistantModelPort } from '@ppt/application';
import type { FamilyAiLocalModelStatusView } from '@ppt/domain';

const ENDPOINT='http://127.0.0.1:11434' as const;
const MODEL=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/u;
const JSON_CONTENT_TYPE=/^application\/json(?:\s*;|$)/iu;

export interface LocalFamilyAiLoopbackTransport {
  request(input:{readonly method:'GET'|'POST';readonly path:'/api/tags'|'/api/chat';readonly body?:string;
    readonly timeoutMs:number;readonly maximumResponseBytes:number}):Promise<{readonly statusCode:number;
      readonly contentType:string;readonly body:string}>;
}

class NodeHttpLocalFamilyAiLoopbackTransport implements LocalFamilyAiLoopbackTransport {
  public request(input:Parameters<LocalFamilyAiLoopbackTransport['request']>[0])
  :ReturnType<LocalFamilyAiLoopbackTransport['request']>{
    return new Promise((resolve,reject)=>{
      const chunks:Buffer[]=[];let bytes=0;let settled=false;
      const finish=(error?:Error):void=>{if(settled)return;settled=true;if(error)reject(error);};
      const request=httpRequest({protocol:'http:',hostname:'127.0.0.1',port:11434,path:input.path,method:input.method,
        agent:false,headers:{Accept:'application/json','Content-Type':'application/json','Connection':'close',
          ...(input.body?{'Content-Length':Buffer.byteLength(input.body,'utf8')}:{})}},(response)=>{
        response.on('data',(chunk:Buffer|string)=>{
          const value=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
          bytes+=value.length;if(bytes>input.maximumResponseBytes){response.destroy();finish(new Error('LOCAL_AI_RESPONSE_TOO_LARGE'));return;}
          chunks.push(value);
        });
        response.on('end',()=>{if(settled)return;settled=true;resolve(Object.freeze({statusCode:response.statusCode??0,
          contentType:String(response.headers['content-type']??''),body:Buffer.concat(chunks).toString('utf8')}));});
        response.on('error',(error)=>finish(error));
      });
      request.setTimeout(input.timeoutMs,()=>{request.destroy(new Error('LOCAL_AI_TIMEOUT'));});
      request.on('error',(error)=>finish(error));
      if(input.body)request.write(input.body,'utf8');request.end();
    });
  }
}

export interface OllamaFamilyAiModelAdapterOptions {
  readonly enabled:boolean;
  readonly model:string;
  readonly clock:()=>string;
  readonly transport?:LocalFamilyAiLoopbackTransport;
}

/**
 * Yerel AI, kurulumdan sonra yalnız sabit loopback adresinde otomatik keşfedilir.
 * Kullanıcı veya yönetici isterse `PPT_LOCAL_AI_ENABLED=0` ile tamamen kapatabilir;
 * tanımsız ya da `1` değeri dış ağ yetkisi vermeden yerel keşfi açık tutar.
 */
export const resolveLocalFamilyAiEnabled = (value: string | undefined): boolean => {
  if (value === undefined) return true;
  const normalized = value.trim();
  return normalized === '' || normalized === '1';
};

const exactObject=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)
  &&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const parseJson=(value:string):unknown=>{try{return JSON.parse(value) as unknown;}catch{return undefined;}};

export class OllamaFamilyAiModelAdapter implements FamilyAiAssistantModelPort {
  readonly #transport:LocalFamilyAiLoopbackTransport;
  readonly #model:string;
  readonly #enabled:boolean;
  public constructor(private readonly options:OllamaFamilyAiModelAdapterOptions){
    this.#enabled=options.enabled&&MODEL.test(options.model);
    this.#model=MODEL.test(options.model)?options.model:'qwen3:4b';
    this.#transport=options.transport??new NodeHttpLocalFamilyAiLoopbackTransport();
  }
  public async getStatus():Promise<FamilyAiLocalModelStatusView>{
    const base={provider:'ollama_loopback' as const,configured:this.#enabled,endpoint:ENDPOINT,localLoopbackOnly:true as const,
      networkEgressUsed:false as const,cloudUsed:false as const,checkedAt:asIsoDateTime(this.options.clock())};
    if(!this.#enabled)return Object.freeze({...base,available:false});
    try{
      const response=await this.#transport.request({method:'GET',path:'/api/tags',timeoutMs:2_000,maximumResponseBytes:262_144});
      if(response.statusCode!==200||!JSON_CONTENT_TYPE.test(response.contentType))return Object.freeze({...base,available:false,model:this.#model});
      const parsed=parseJson(response.body);const models=exactObject(parsed)&&Array.isArray(parsed.models)?parsed.models:[];
      const available=models.some((entry)=>exactObject(entry)&&(entry.name===this.#model||entry.model===this.#model));
      return Object.freeze({...base,available,model:this.#model});
    }catch{return Object.freeze({...base,available:false,model:this.#model});}
  }
  public async run(input:Parameters<FamilyAiAssistantModelPort['run']>[0])
  :ReturnType<FamilyAiAssistantModelPort['run']>{
    if(!this.#enabled)return err(this.#failure(input.correlationId,ERROR_CODES.CONFIG_INVALID,
      'Yerel AI modeli etkinleştirilmemiştir.','validation',false));
    const body=JSON.stringify({model:this.#model,stream:false,format:'json',messages:[
      {role:'system',content:input.systemPrompt},{role:'user',content:input.userPrompt}],
      options:{temperature:0,num_predict:1024}});
    if(Buffer.byteLength(body,'utf8')>32_768)return err(this.#failure(input.correlationId,ERROR_CODES.CORE_INVALID_ARGUMENT,
      'Yerel model isteği güvenli boyut sınırını aşıyor.','validation',false));
    try{
      const response=await this.#transport.request({method:'POST',path:'/api/chat',body,timeoutMs:30_000,
        maximumResponseBytes:131_072});
      if(response.statusCode!==200||!JSON_CONTENT_TYPE.test(response.contentType))return err(this.#failure(input.correlationId,
        ERROR_CODES.CORE_UNEXPECTED,'Yerel model güvenli bir JSON yanıtı vermedi.','infrastructure',true));
      const parsed=parseJson(response.body);const message=exactObject(parsed)&&exactObject(parsed.message)?parsed.message:undefined;
      const content=message&&typeof message.content==='string'?parseJson(message.content):undefined;
      const answer=exactObject(content)&&typeof content.answer==='string'?content.answer.normalize('NFKC').trim():'';
      if(answer.length<1||answer.length>4000)return err(this.#failure(input.correlationId,ERROR_CODES.CORE_UNEXPECTED,
        'Yerel model yanıtı doğrulanamadı.','security',false));
      return ok(Object.freeze({answer,model:this.#model,generatedAt:asIsoDateTime(this.options.clock())}));
    }catch{return err(this.#failure(input.correlationId,ERROR_CODES.CORE_UNEXPECTED,
      'Yerel model hizmetine ulaşılamadı.','infrastructure',true));}
  }
  #failure(correlationId:CorrelationId,code:typeof ERROR_CODES.CONFIG_INVALID|typeof ERROR_CODES.CORE_INVALID_ARGUMENT
    |typeof ERROR_CODES.CORE_UNEXPECTED,message:string,category:AppError['category'],retryable:boolean):AppError{
    return createAppError({code,message,category,correlationId,retryable});
  }
}
