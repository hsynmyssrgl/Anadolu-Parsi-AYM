import { describe, expect, it } from 'vitest';
import {
  ACCESSIBILITY_PROFILE_PRESETS,
  FIRST_RUN_NARRATION_TEXT,
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  accessibilityAnnouncement,
  applyAccessibilityProfile,
  cancelFirstRunNarration,
  isFirstRunIntroductionComplete,
  nextRovingIndex,
  parseAccessibilityPreferences,
  persistBrandAudioMuted,
  persistFirstRunIntroductionComplete,
  readBrandAudioMuted,
  resolveAccessibilityTheme,
  serializeAccessibilityPreferences,
  startFirstRunNarration
} from '../src/renderer/accessibility.js';

describe('33-M accessibility preference center', () => {
  it('starts from safe system signals without granting operating-system write authority', () => {
    expect(parseAccessibilityPreferences(null, { highContrast:true, reduceMotion:true })).toMatchObject({
      textScale:'standard', textScalePercent:100, highContrast:true, reduceMotion:true,
      theme:'system', density:'standard', readingMode:'standard', audienceProfile:'standard',
      captionsEnabled:true, audioMuted:false
    });
  });

  it('fails closed to bounded values for malformed local bootstrap data', () => {
    expect(parseAccessibilityPreferences(JSON.stringify({
      textScale:'huge', textScalePercent:999, theme:'remote', density:'hidden',
      readingMode:'unsafe', audienceProfile:'impersonated', captionsEnabled:'yes', audioMuted:1
    }))).toEqual(DEFAULT_ACCESSIBILITY_PREFERENCES);
    expect(parseAccessibilityPreferences('{')).toEqual(DEFAULT_ACCESSIBILITY_PREFERENCES);
  });

  it('accepts every inclusive custom scale from 100 through 225 only as an integer', () => {
    expect(parseAccessibilityPreferences('{"textScalePercent":100}').textScalePercent).toBe(100);
    expect(parseAccessibilityPreferences('{"textScalePercent":225}').textScalePercent).toBe(225);
    expect(parseAccessibilityPreferences('{"textScalePercent":99}').textScalePercent).toBe(100);
    expect(parseAccessibilityPreferences('{"textScalePercent":225.5}').textScalePercent).toBe(100);
  });

  it('provides all audience profiles while compact mode never encodes hidden data', () => {
    expect(Object.keys(ACCESSIBILITY_PROFILE_PRESETS)).toEqual(['youth','standard','senior','low-vision','caregiver']);
    expect(applyAccessibilityProfile('senior')).toMatchObject({textScale:'large',density:'comfortable',readingMode:'easy-read'});
    expect(applyAccessibilityProfile('low-vision')).toMatchObject({textScalePercent:200,highContrast:true});
    expect(ACCESSIBILITY_PROFILE_PRESETS.standard.density).toBe('standard');
  });

  it('round trips the exact governed preference shape', () => {
    const value=applyAccessibilityProfile('caregiver',{highContrast:true,reduceMotion:true});
    expect(parseAccessibilityPreferences(serializeAccessibilityPreferences(value))).toEqual(value);
  });

  it('resolves system theme locally and preserves explicit light or dark choice', () => {
    expect(resolveAccessibilityTheme('system',true)).toBe('dark');
    expect(resolveAccessibilityTheme('system',false)).toBe('light');
    expect(resolveAccessibilityTheme('light',true)).toBe('light');
  });

  it('keeps keyboard roving and Turkish route announcements deterministic', () => {
    expect(nextRovingIndex(0,4,'ArrowUp')).toBe(3);
    expect(nextRovingIndex(3,4,'ArrowDown')).toBe(0);
    expect(nextRovingIndex(2,4,'Home')).toBe(0);
    expect(accessibilityAnnouncement('Sağlık')).toBe('Sağlık bölümü açıldı.');
  });

  it('persists the one-time introduction and unified audio preference without browser authority', () => {
    const values = new Map<string,string>();
    const storage = {
      getItem:(key:string)=>values.get(key)??null,
      setItem:(key:string,value:string)=>{ values.set(key,value); }
    };
    expect(isFirstRunIntroductionComplete(storage)).toBe(false);
    expect(persistFirstRunIntroductionComplete(storage)).toBe(true);
    expect(isFirstRunIntroductionComplete(storage)).toBe(true);
    expect(readBrandAudioMuted(storage)).toBe(false);
    expect(persistBrandAudioMuted(storage,true)).toBe(true);
    expect(readBrandAudioMuted(storage)).toBe(true);
  });

  it('keeps the introduction visible and never crashes when bootstrap storage is denied', () => {
    const denied = {
      getItem:(_key:string):string|null=>{ throw new Error('denied'); },
      setItem:(_key:string,_value:string):void=>{ throw new Error('denied'); }
    };
    expect(isFirstRunIntroductionComplete(denied)).toBe(false);
    expect(readBrandAudioMuted(denied,true)).toBe(true);
    expect(persistFirstRunIntroductionComplete(denied)).toBe(false);
    expect(persistBrandAudioMuted(denied,false)).toBe(false);
  });

  it('speaks the exact visible Turkish caption and reports the local narration lifecycle', () => {
    const statuses:string[]=[];
    let cancelCount=0;
    let spoken:{
      text:string;lang:string;rate:number;pitch:number;
      onstart:(()=>void)|null;onend:(()=>void)|null;onerror:(()=>void)|null;
    }|undefined;
    const result=startFirstRunNarration({
      muted:false,
      synthesis:{cancel:()=>{cancelCount++;},speak:(utterance)=>{spoken=utterance;}},
      createUtterance:(text)=>({text,lang:'',rate:1,pitch:1,onstart:null,onend:null,onerror:null}),
      onStatus:(status)=>statuses.push(status)
    });
    expect(result).toBe('speaking');
    expect(cancelCount).toBe(1);
    expect(spoken).toMatchObject({text:FIRST_RUN_NARRATION_TEXT,lang:'tr-TR',rate:0.9,pitch:0.82});
    expect(statuses).toEqual(['speaking']);
    spoken?.onend?.();
    expect(statuses).toEqual(['speaking','ready']);
  });

  it('starts narration immediately after an explicit unmute instead of using stale mute state', () => {
    let speakCount=0;
    const synthesis={cancel:()=>undefined,speak:()=>{speakCount++;}};
    const createUtterance=()=>({lang:'',rate:1,pitch:1,onstart:null,onend:null,onerror:null});
    expect(startFirstRunNarration({muted:true,synthesis,createUtterance,onStatus:()=>undefined})).toBe('muted');
    expect(speakCount).toBe(0);
    expect(startFirstRunNarration({muted:false,synthesis,createUtterance,onStatus:()=>undefined})).toBe('speaking');
    expect(speakCount).toBe(1);
  });

  it('falls back to the visible caption when speech is unavailable or fails', () => {
    const statuses:string[]=[];
    expect(startFirstRunNarration({muted:false,synthesis:undefined,createUtterance:undefined,onStatus:(status)=>statuses.push(status)})).toBe('unavailable');
    expect(startFirstRunNarration({
      muted:false,
      synthesis:{cancel:()=>undefined,speak:()=>undefined},
      createUtterance:()=>{throw new Error('voice unavailable');},
      onStatus:(status)=>statuses.push(status)
    })).toBe('error');
    expect(statuses).toEqual(['unavailable','error']);
  });

  it('treats narration cleanup failure as non-fatal', () => {
    expect(cancelFirstRunNarration(undefined)).toBe(false);
    expect(cancelFirstRunNarration({cancel:()=>{throw new Error('shutdown');},speak:()=>undefined})).toBe(false);
  });
});
