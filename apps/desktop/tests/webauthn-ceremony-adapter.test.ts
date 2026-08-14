import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { asUserId } from '@ppt/core';
import { createWebAuthnChallenge, hashWebAuthnChallenge } from '@ppt/security';
import { WebAuthnCeremonyAdapter } from '../src/main/webauthn-ceremony-adapter.js';

const ORIGIN='pardus-app://renderer';const RP_ID='renderer';const ACCOUNT_ID=asUserId('account-33-p');const DEVICE_ID='device-33-p';
const sha256=(value:string):string=>createHash('sha256').update(value,'utf8').digest('hex');

const cborText=(value:string):Buffer=>{const bytes=Buffer.from(value);return Buffer.concat([Buffer.from([0x60+bytes.length]),bytes]);};
const cborBytes=(value:Buffer):Buffer=>value.length<24?Buffer.concat([Buffer.from([0x40+value.length]),value])
  :value.length<=0xff?Buffer.concat([Buffer.from([0x58,value.length]),value]):Buffer.concat([Buffer.from([0x59,value.length>>>8,value.length&0xff]),value]);
const es256Cose=(publicKey:ReturnType<typeof generateKeyPairSync>['publicKey']):Buffer=>{const jwk=publicKey.export({format:'jwk'});if(jwk.kty!=='EC'||!jwk.x||!jwk.y)throw new Error('EC fixture');return Buffer.concat([Buffer.from([0xa5,0x01,0x02,0x03,0x26,0x20,0x01,0x21,0x58,0x20]),Buffer.from(jwk.x,'base64url'),Buffer.from([0x22,0x58,0x20]),Buffer.from(jwk.y,'base64url')]);};

const registrationFixture=()=>{
  const keyPair=generateKeyPairSync('ec',{namedCurve:'P-256'});const cose=es256Cose(keyPair.publicKey);const challenge=createWebAuthnChallenge();
  const credentialId=Buffer.from('registration-credential-33-p').toString('base64url');const credentialBytes=Buffer.from(credentialId,'base64url');
  const clientData=Buffer.from(JSON.stringify({type:'webauthn.create',challenge,origin:ORIGIN,crossOrigin:false}));const auth=Buffer.alloc(55);
  createHash('sha256').update(RP_ID).digest().copy(auth);auth[32]=0x45;auth.writeUInt32BE(1,33);Buffer.from('00112233445566778899aabbccddeeff','hex').copy(auth,37);auth.writeUInt16BE(credentialBytes.length,53);
  const authData=Buffer.concat([auth,credentialBytes,cose]);const attestation=Buffer.concat([Buffer.from([0xa3]),cborText('fmt'),cborText('none'),cborText('authData'),cborBytes(authData),cborText('attStmt'),Buffer.from([0xa0])]);
  return {challenge,credentialId,cose:cose.toString('base64url'),response:{credentialId,clientDataJsonBase64url:clientData.toString('base64url'),attestationObjectBase64url:attestation.toString('base64url'),transports:['internal']}};
};

const authenticationFixture=(credentialId:string,cose:string,previousSignCount=1)=>{
  const keyPair=generateKeyPairSync('ec',{namedCurve:'P-256'});const actualCose=es256Cose(keyPair.publicKey).toString('base64url');
  const challenge=createWebAuthnChallenge();const clientData=Buffer.from(JSON.stringify({type:'webauthn.get',challenge,origin:ORIGIN,crossOrigin:false}));const authenticator=Buffer.alloc(37);
  createHash('sha256').update(RP_ID).digest().copy(authenticator);authenticator[32]=0x05;authenticator.writeUInt32BE(previousSignCount+1,33);
  const signature=sign('sha256',Buffer.concat([authenticator,createHash('sha256').update(clientData).digest()]),keyPair.privateKey);
  const userHandle=Buffer.from(String(ACCOUNT_ID));
  return {challenge,cose:actualCose,response:{credentialId,clientDataJsonBase64url:clientData.toString('base64url'),authenticatorDataBase64url:authenticator.toString('base64url'),signatureBase64url:signature.toString('base64url'),userHandleBase64url:userHandle.toString('base64url')}};
};

const setup=()=>{let now='2026-08-14T08:00:00.000Z';let currentDevice:string|null=DEVICE_ID;const adapter=new WebAuthnCeremonyAdapter({trustedRelyingParties:[{relyingPartyId:RP_ID,origin:ORIGIN}],authenticatedDeviceId:()=>currentDevice,clock:()=>now});return {adapter,setNow:(value:string)=>{now=value;},setDevice:(value:string|null)=>{currentDevice=value;}};};
const binding=(id:string)=>({ceremonyResponseId:id,accountId:ACCOUNT_ID,deviceId:DEVICE_ID,expiresAt:'2026-08-14T08:05:00.000Z'});

describe('main-process WebAuthn ceremony adapter',()=>{
  it('consumes a none-attestation registration once with exact account/device/RP/origin binding',()=>{
    const {adapter}=setup();const fixture=registrationFixture();adapter.storeRegistrationResponse(binding('registration-1'),fixture.response);
    const result=adapter.verifyRegistration({ceremonyResponseId:'registration-1',expectedChallengeSha256:hashWebAuthnChallenge(fixture.challenge),relyingPartyId:RP_ID,accountId:ACCOUNT_ID,deviceId:DEVICE_ID});
    expect(result.ok&&result.value).toMatchObject({credentialId:fixture.credentialId,publicKeyCoseBase64Url:fixture.cose,userHandleSha256:sha256(String(ACCOUNT_ID)),aaguid:'00112233-4455-6677-8899-aabbccddeeff',attestationVerified:true,userPresent:true,userVerified:true});
    expect(adapter.verifyRegistration({ceremonyResponseId:'registration-1',expectedChallengeSha256:hashWebAuthnChallenge(fixture.challenge),relyingPartyId:RP_ID,accountId:ACCOUNT_ID,deviceId:DEVICE_ID}).ok).toBe(false);
  });

  it('verifies assertion signature/user handle/signCount and consumes failures on attempt',()=>{
    const {adapter}=setup();const credentialId=Buffer.from('authentication-credential-33-p').toString('base64url');const fixture=authenticationFixture(credentialId,'',4);
    adapter.storeAuthenticationResponse(binding('authentication-1'),fixture.response);
    const result=adapter.verifyAuthentication({ceremonyResponseId:'authentication-1',expectedChallengeSha256:hashWebAuthnChallenge(fixture.challenge),relyingPartyId:RP_ID,credentialId,publicKeyCoseBase64Url:fixture.cose,expectedUserHandleSha256:sha256(String(ACCOUNT_ID)),previousSignCount:4,accountId:ACCOUNT_ID});
    expect(result.ok&&result.value).toMatchObject({credentialIdSha256:sha256(credentialId),signCount:5,signatureVerified:true,userPresent:true,userVerified:true});
    const bad=authenticationFixture(credentialId,'',5);adapter.storeAuthenticationResponse(binding('authentication-bad'),bad.response);
    expect(adapter.verifyAuthentication({ceremonyResponseId:'authentication-bad',expectedChallengeSha256:'0'.repeat(64),relyingPartyId:RP_ID,credentialId,publicKeyCoseBase64Url:bad.cose,expectedUserHandleSha256:sha256(String(ACCOUNT_ID)),previousSignCount:5,accountId:ACCOUNT_ID}).ok).toBe(false);
    expect(adapter.verifyAuthentication({ceremonyResponseId:'authentication-bad',expectedChallengeSha256:hashWebAuthnChallenge(bad.challenge),relyingPartyId:RP_ID,credentialId,publicKeyCoseBase64Url:bad.cose,expectedUserHandleSha256:sha256(String(ACCOUNT_ID)),previousSignCount:5,accountId:ACCOUNT_ID}).ok).toBe(false);
  });

  it('rejects stale, foreign-device, oversized and untrusted RP responses fail closed',()=>{
    const state=setup();const fixture=registrationFixture();state.setDevice('foreign-device');
    expect(()=>state.adapter.storeRegistrationResponse(binding('foreign-device'),fixture.response)).toThrow(/binding/u);
    state.setDevice(DEVICE_ID);expect(()=>state.adapter.storeRegistrationResponse({...binding('too-long'),expiresAt:'2026-08-14T08:05:00.001Z'},fixture.response)).toThrow(/TTL/u);
    expect(()=>state.adapter.storeRegistrationResponse(binding('oversized'),{...fixture.response,clientDataJsonBase64url:'A'.repeat(6000)})).toThrow(/siniri/u);
    state.adapter.storeRegistrationResponse(binding('untrusted-rp'),fixture.response);
    expect(state.adapter.verifyRegistration({ceremonyResponseId:'untrusted-rp',expectedChallengeSha256:hashWebAuthnChallenge(fixture.challenge),relyingPartyId:'foreign',accountId:ACCOUNT_ID,deviceId:DEVICE_ID}).ok).toBe(false);
    state.adapter.storeRegistrationResponse(binding('device-revoked-after-store'),fixture.response);state.setDevice(null);
    expect(state.adapter.verifyRegistration({ceremonyResponseId:'device-revoked-after-store',expectedChallengeSha256:hashWebAuthnChallenge(fixture.challenge),relyingPartyId:RP_ID,accountId:ACCOUNT_ID,deviceId:DEVICE_ID}).ok).toBe(false);
    state.setDevice(DEVICE_ID);
    state.setNow('2026-08-14T08:05:00.000Z');expect(()=>state.adapter.storeRegistrationResponse(binding('expired'),fixture.response)).toThrow(/TTL/u);
  });
});
