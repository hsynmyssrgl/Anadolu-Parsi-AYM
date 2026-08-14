import { createHash } from 'node:crypto';
import type { PasskeyCeremonyVerifierPort, VerifiedPasskeyAuthentication, VerifiedPasskeyRegistration } from '@ppt/application';
import { asCorrelationId, createAppError, err, ERROR_CODES, ok, type Result, type UserId } from '@ppt/core';
import {
  verifyWebAuthnAssertion,
  verifyWebAuthnRegistration,
  type WebAuthnAssertionInput,
  type WebAuthnRegistrationInput
} from '@ppt/security';

const MAX_TTL_MS = 300_000;
const MAX_RESPONSES = 256;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const CORRELATION_ID = asCorrelationId('webauthn-ceremony-verifier');

export interface WebAuthnTrustedRelyingParty {
  readonly relyingPartyId: string;
  readonly origin: string;
}

export interface AuthenticatedWebAuthnResponseBinding {
  readonly ceremonyResponseId: string;
  readonly accountId: UserId;
  readonly deviceId: string;
  readonly expiresAt: string;
}

export interface WebAuthnCeremonyAdapterOptions {
  readonly trustedRelyingParties: readonly WebAuthnTrustedRelyingParty[];
  /** Resolves the main-process authenticated device, never renderer-provided state. */
  readonly authenticatedDeviceId: (accountId: UserId) => string | null;
  readonly clock?: () => string;
}

type StoredResponse = Readonly<{
  binding: AuthenticatedWebAuthnResponseBinding;
  kind: 'registration';
  response: WebAuthnRegistrationInput;
}> | Readonly<{
  binding: AuthenticatedWebAuthnResponseBinding;
  kind: 'authentication';
  response: WebAuthnAssertionInput;
}>;

const validIso = (value:string):boolean=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)&&new Date(value).toISOString()===value;
const boundedBase64url = (value:string,maximumCharacters:number):boolean=>typeof value==='string'&&value.length>=1&&value.length<=maximumCharacters&&!value.includes('=')&&/^[A-Za-z0-9_-]+$/u.test(value);
const sha256=(value:string):string=>createHash('sha256').update(value,'utf8').digest('hex');

const failure = <T>():Result<T,ReturnType<typeof createAppError>> => err(createAppError({
  code:ERROR_CODES.AUTH_INVALID_CREDENTIALS,
  message:'WebAuthn tören yanıtı doğrulanamadı.',
  category:'security',correlationId:CORRELATION_ID
}));

export class WebAuthnCeremonyAdapter implements PasskeyCeremonyVerifierPort {
  readonly #responses=new Map<string,StoredResponse>();
  readonly #trustedOriginsByRpId:ReadonlyMap<string,string>;
  readonly #authenticatedDeviceId:(accountId:UserId)=>string|null;
  readonly #clock:()=>string;

  public constructor(options:WebAuthnCeremonyAdapterOptions){
    if(options.trustedRelyingParties.length<1||options.trustedRelyingParties.length>16)throw new Error('WebAuthn trusted RP allowlist gecersiz.');
    const trusted=new Map<string,string>();
    for(const entry of options.trustedRelyingParties){
      if(entry.relyingPartyId.length<1||entry.relyingPartyId.length>253||entry.relyingPartyId!==entry.relyingPartyId.toLowerCase()||/[^a-z0-9.-]/u.test(entry.relyingPartyId)||trusted.has(entry.relyingPartyId))throw new Error('WebAuthn trusted RP allowlist exact ve benzersiz olmali.');
      let origin:URL;try{origin=new URL(entry.origin);}catch{throw new Error('WebAuthn trusted origin URL olmali.');}
      const canonical=`${origin.protocol}//${origin.host}`;
      if(!['https:','pardus-app:'].includes(origin.protocol)||!origin.host||origin.username||origin.password||origin.search||origin.hash||(origin.pathname!==''&&origin.pathname!=='/')||entry.origin!==canonical)throw new Error('WebAuthn trusted origin yalniz scheme ve host icermeli.');
      trusted.set(entry.relyingPartyId,entry.origin);
    }
    this.#trustedOriginsByRpId=trusted;this.#authenticatedDeviceId=options.authenticatedDeviceId;this.#clock=options.clock??(()=>new Date().toISOString());
  }

  public storeRegistrationResponse(binding:AuthenticatedWebAuthnResponseBinding,response:WebAuthnRegistrationInput):void{
    if(!boundedBase64url(response.credentialId,1366)||!boundedBase64url(response.clientDataJsonBase64url,5462)||!boundedBase64url(response.attestationObjectBase64url,21846)
      ||response.transports.length>5||response.transports.some((value)=>!['internal','usb','nfc','ble','hybrid'].includes(value)))throw new Error('WebAuthn registration response siniri gecersiz.');
    this.#store(Object.freeze({binding:this.#binding(binding),kind:'registration',response:Object.freeze({...response,transports:Object.freeze([...response.transports])})}));
  }

  public storeAuthenticationResponse(binding:AuthenticatedWebAuthnResponseBinding,response:WebAuthnAssertionInput):void{
    if(!boundedBase64url(response.credentialId,1366)||!boundedBase64url(response.clientDataJsonBase64url,5462)||!boundedBase64url(response.authenticatorDataBase64url,5462)
      ||!boundedBase64url(response.signatureBase64url,2731)||(response.userHandleBase64url!==undefined&&!boundedBase64url(response.userHandleBase64url,342)))throw new Error('WebAuthn authentication response siniri gecersiz.');
    this.#store(Object.freeze({binding:this.#binding(binding),kind:'authentication',response:Object.freeze({...response})}));
  }

  public verifyRegistration(input:Parameters<PasskeyCeremonyVerifierPort['verifyRegistration']>[0]):ReturnType<PasskeyCeremonyVerifierPort['verifyRegistration']>{
    const stored=this.#consume(input.ceremonyResponseId);
    if(!stored||stored.kind!=='registration'||stored.binding.accountId!==input.accountId||stored.binding.deviceId!==input.deviceId
      ||this.#authenticatedDeviceId(input.accountId)!==input.deviceId)return failure();
    const origin=this.#trustedOriginsByRpId.get(input.relyingPartyId);if(!origin||!SHA256.test(input.expectedChallengeSha256))return failure();
    try{
      const verified=verifyWebAuthnRegistration(stored.response,{challengeSha256:input.expectedChallengeSha256,origin,rpId:input.relyingPartyId,
        expectedUserHandleSha256:sha256(String(input.accountId)),requireUserVerification:true});
      const value:VerifiedPasskeyRegistration=Object.freeze({challengeSha256:verified.challengeSha256,relyingPartyId:verified.relyingPartyId,
        credentialId:verified.credentialId,publicKeyCoseBase64Url:verified.publicKeyCoseBase64Url,userHandleSha256:verified.userHandleSha256,
        aaguid:verified.aaguid,transports:verified.transports,signCount:verified.signCount,backupEligible:verified.backupEligible,backupState:verified.backupState,
        attestationVerified:true,userPresent:true,userVerified:true});
      return ok(value);
    }catch{return failure();}
  }

  public verifyAuthentication(input:Parameters<PasskeyCeremonyVerifierPort['verifyAuthentication']>[0]):ReturnType<PasskeyCeremonyVerifierPort['verifyAuthentication']>{
    const stored=this.#consume(input.ceremonyResponseId);const deviceId=this.#authenticatedDeviceId(input.accountId);
    if(!stored||stored.kind!=='authentication'||stored.binding.accountId!==input.accountId||!deviceId||stored.binding.deviceId!==deviceId)return failure();
    const origin=this.#trustedOriginsByRpId.get(input.relyingPartyId);
    if(!origin||!SHA256.test(input.expectedChallengeSha256)||!SHA256.test(input.expectedUserHandleSha256))return failure();
    try{
      const verified=verifyWebAuthnAssertion(stored.response,{credentialId:input.credentialId,challengeSha256:input.expectedChallengeSha256,origin,
        rpId:input.relyingPartyId,publicKeyCoseBase64url:input.publicKeyCoseBase64Url,previousSignCount:input.previousSignCount,
        requireUserVerification:true,expectedUserHandleSha256:input.expectedUserHandleSha256});
      const value:VerifiedPasskeyAuthentication=Object.freeze({challengeSha256:verified.challengeSha256,
        credentialIdSha256:sha256(input.credentialId),signCount:verified.signCount,signatureVerified:true,userPresent:true,userVerified:true});
      return ok(value);
    }catch{return failure();}
  }

  #binding(binding:AuthenticatedWebAuthnResponseBinding):AuthenticatedWebAuthnResponseBinding{
    const now=Date.parse(this.#clock());const expiry=Date.parse(binding.expiresAt);
    if(!ID.test(binding.ceremonyResponseId)||!ID.test(String(binding.accountId))||!ID.test(binding.deviceId)||!validIso(binding.expiresAt)
      ||!Number.isFinite(now)||expiry<=now||expiry-now>MAX_TTL_MS||this.#authenticatedDeviceId(binding.accountId)!==binding.deviceId)throw new Error('WebAuthn response authenticated binding veya TTL gecersiz.');
    return Object.freeze({...binding});
  }

  #store(value:StoredResponse):void{
    this.#prune();if(this.#responses.size>=MAX_RESPONSES||this.#responses.has(value.binding.ceremonyResponseId))throw new Error('WebAuthn response registry quota veya replay ihlali.');
    this.#responses.set(value.binding.ceremonyResponseId,value);
  }

  #consume(id:string):StoredResponse|undefined{
    const value=this.#responses.get(id);if(value)this.#responses.delete(id);
    const now=Date.parse(this.#clock());if(!value||!Number.isFinite(now)||Date.parse(value.binding.expiresAt)<=now)return undefined;
    return value;
  }

  #prune():void{const now=Date.parse(this.#clock());for(const [id,value] of this.#responses)if(Date.parse(value.binding.expiresAt)<=now)this.#responses.delete(id);}
}
