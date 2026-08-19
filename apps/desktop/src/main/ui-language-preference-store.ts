import {closeSync,existsSync,fsyncSync,mkdirSync,openSync,readFileSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import type {UiLanguagePreference} from '@ppt/domain';

interface StoredUiLanguagePreference {readonly schemaVersion:1;readonly preference:UiLanguagePreference;}
const allowed=new Set<UiLanguagePreference>(['system','tr','en']);
export const isUiLanguagePreference=(value:unknown):value is UiLanguagePreference=>typeof value==='string'&&allowed.has(value as UiLanguagePreference);
export const readUiLanguagePreference=(filePath:string):UiLanguagePreference=>{
  const target=resolve(filePath);if(!existsSync(target))return'system';
  try{const parsed=JSON.parse(readFileSync(target,'utf8')) as Partial<StoredUiLanguagePreference>;return parsed.schemaVersion===1&&isUiLanguagePreference(parsed.preference)?parsed.preference:'system';}catch{return'system';}
};
export const writeUiLanguagePreference=(filePath:string,preference:UiLanguagePreference):void=>{
  if(!isUiLanguagePreference(preference))throw new Error('Desteklenmeyen uygulama dili tercihi.');
  const target=resolve(filePath),directory=dirname(target),temporary=`${target}.${process.pid}.tmp`;mkdirSync(directory,{recursive:true,mode:0o700});rmSync(temporary,{force:true});
  const descriptor=openSync(temporary,'wx',0o600);try{writeFileSync(descriptor,`${JSON.stringify({schemaVersion:1,preference} satisfies StoredUiLanguagePreference,null,2)}\n`,'utf8');fsyncSync(descriptor);}finally{closeSync(descriptor);}
  try{renameSync(temporary,target);}catch(error){rmSync(temporary,{force:true});throw error;}
};
