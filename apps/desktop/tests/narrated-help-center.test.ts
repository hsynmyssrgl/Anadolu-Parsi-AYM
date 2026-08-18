import { describe, expect, it } from 'vitest';
import { SILVER_HELP_TOPICS, silverHelpNarrationText, startSilverHelpNarration } from '../src/renderer/NarratedHelpCenter';

describe('Silver narrated help center', () => {
  it('keeps the bounded Turkish topic catalog and a current-screen explanation', () => {
    expect(SILVER_HELP_TOPICS.map((topic) => topic.id)).toEqual(['getting-started','current-screen','privacy','accessibility','troubleshooting']);
    expect(new Set(SILVER_HELP_TOPICS.map((topic) => topic.id)).size).toBe(SILVER_HELP_TOPICS.length);
    expect(SILVER_HELP_TOPICS.every((topic) => topic.title.length > 5 && topic.summary.length > 10 && topic.narration.length > 80)).toBe(true);
    expect(silverHelpNarrationText(SILVER_HELP_TOPICS[1]!, 'Arşiv')).toMatch(/^Şu anda Arşiv bölümündesiniz\./u);
  });

  it('speaks exact visible text in Turkish at normal and slow rates', () => {
    const spoken:Array<{text:string;lang:string;rate:number;pitch:number;onend:(()=>void)|null}> = [];
    const statuses:string[]=[];
    const synthesis={cancel:()=>undefined,speak:(value:(typeof spoken)[number])=>spoken.push(value)};
    const createUtterance=(text:string)=>({text,lang:'',rate:1,pitch:1,onstart:null,onend:null,onerror:null});
    expect(startSilverHelpNarration({text:'Görünür yardım metni.',rate:'normal',synthesis,createUtterance,onStatus:(status)=>statuses.push(status)})).toBe('speaking');
    expect(startSilverHelpNarration({text:'Yavaş yardım metni.',rate:'slow',synthesis,createUtterance,onStatus:(status)=>statuses.push(status)})).toBe('speaking');
    expect(spoken).toMatchObject([
      {text:'Görünür yardım metni.',lang:'tr-TR',rate:0.88,pitch:0.95},
      {text:'Yavaş yardım metni.',lang:'tr-TR',rate:0.72,pitch:0.95}
    ]);
    spoken[1]?.onend?.();
    expect(statuses.at(-1)).toBe('ready');
  });

  it('fails closed to visible text when speech is unavailable or throws', () => {
    const statuses:string[]=[];
    expect(startSilverHelpNarration({text:'Metin',rate:'normal',synthesis:undefined,createUtterance:undefined,onStatus:(status)=>statuses.push(status)})).toBe('unavailable');
    expect(startSilverHelpNarration({text:'Metin',rate:'normal',synthesis:{cancel:()=>undefined,speak:()=>undefined},createUtterance:()=>{throw new Error('unavailable');},onStatus:(status)=>statuses.push(status)})).toBe('error');
    expect(statuses).toEqual(['unavailable','error']);
  });
});
